use anchor_lang::prelude::*;
use anchor_lang::system_program;
use solana_sha256_hasher::hash;
use crate::state::*;
use crate::errors::ScreamError;
use crate::events::PanicTriggered;

#[derive(Accounts)]
pub struct TriggerPanic<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [PanicConfig::SEED_PREFIX, owner.key().as_ref()],
        bump = panic_config.bump,
        has_one = owner,
    )]
    pub panic_config: Account<'info, PanicConfig>,

    #[account(
        mut,
        seeds = [Vault::SEED_PREFIX, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = 8 + CompromisedFlag::INIT_SPACE,
        seeds = [CompromisedFlag::SEED_PREFIX, owner.key().as_ref()],
        bump,
    )]
    pub compromised_flag: Account<'info, CompromisedFlag>,

    /// The attacker's address to receive decoy funds and be flagged
    /// CHECK: This is the attacker address provided by the user; we only send them a decoy amount and flag them.
    #[account(mut)]
    pub attacker: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + AttackerFlag::INIT_SPACE,
        seeds = [AttackerFlag::SEED_PREFIX, attacker.key().as_ref()],
        bump,
    )]
    pub attacker_flag: Account<'info, AttackerFlag>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, TriggerPanic<'info>>,
    trigger_proof: Vec<u8>,
) -> Result<()> {
    let config = &ctx.accounts.panic_config;

    // Step 1: Verify trigger proof
    let proof_hash = hash(&trigger_proof);
    require!(
        proof_hash.to_bytes() == config.trigger_hash,
        ScreamError::InvalidTriggerProof
    );
    require!(!config.is_triggered, ScreamError::PanicAlreadyTriggered);

    let clock = Clock::get()?;
    let contacts = config.contacts.clone();
    let decoy_lamports = config.decoy_lamports;
    let time_lock_duration = config.time_lock_duration;
    let owner_key = ctx.accounts.owner.key();

    // Verify remaining accounts match contacts count
    // Each contact needs 1 account (the alert PDA -- we init it manually)
    require!(
        ctx.remaining_accounts.len() == contacts.len(),
        ScreamError::ContactAccountMismatch
    );

    // Step 2: Transfer remaining SOL from owner to vault
    let owner_lamports = ctx.accounts.owner.lamports();
    // Keep enough for rent + tx fees (0.01 SOL buffer)
    let min_keep = 10_000_000; // 0.01 SOL
    if owner_lamports > min_keep {
        let transfer_amount = owner_lamports - min_keep;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            transfer_amount,
        )?;
    }

    // Step 3: Set time-lock
    let vault = &mut ctx.accounts.vault;
    vault.locked_until = clock.unix_timestamp + time_lock_duration;

    // Step 4: Mark wallet as compromised
    let compromised = &mut ctx.accounts.compromised_flag;
    compromised.owner = owner_key;
    compromised.flagged_at = clock.unix_timestamp;
    compromised.bump = ctx.bumps.compromised_flag;

    // Step 5: Send decoy SOL from vault to attacker
    let vault_info = vault.to_account_info();
    let attacker_info = ctx.accounts.attacker.to_account_info();

    let vault_balance = vault_info.lamports();
    let vault_rent = Rent::get()?.minimum_balance(vault_info.data_len());
    let available = vault_balance.saturating_sub(vault_rent);
    let decoy_to_send = decoy_lamports.min(available);

    require!(decoy_to_send > 0, ScreamError::InsufficientFundsForDecoy);

    **vault_info.try_borrow_mut_lamports()? -= decoy_to_send;
    **attacker_info.try_borrow_mut_lamports()? += decoy_to_send;

    // Step 6: Flag the attacker
    let attacker_flag = &mut ctx.accounts.attacker_flag;
    attacker_flag.attacker = ctx.accounts.attacker.key();
    attacker_flag.reported_by = owner_key;
    attacker_flag.flagged_at = clock.unix_timestamp;
    attacker_flag.bump = ctx.bumps.attacker_flag;

    // Step 7: Create alert accounts for each contact via remaining_accounts
    let vault_bump = vault.bump;
    for (i, contact) in contacts.iter().enumerate() {
        let alert_account_info = &ctx.remaining_accounts[i];

        let (expected_pda, bump) = Pubkey::find_program_address(
            &[
                AlertAccount::SEED_PREFIX,
                owner_key.as_ref(),
                contact.as_ref(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(alert_account_info.key(), expected_pda);

        let space = 8 + AlertAccount::INIT_SPACE;
        let rent = Rent::get()?.minimum_balance(space);

        // Create the alert account via CPI
        let signer_seeds: &[&[u8]] = &[
            AlertAccount::SEED_PREFIX,
            owner_key.as_ref(),
            contact.as_ref(),
            &[bump],
        ];

        anchor_lang::system_program::create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::CreateAccount {
                    from: ctx.accounts.owner.to_account_info(),
                    to: alert_account_info.clone(),
                },
                &[signer_seeds],
            ),
            rent,
            space as u64,
            ctx.program_id,
        )?;

        // Serialize the alert account data
        let mut data = alert_account_info.try_borrow_mut_data()?;
        let alert = AlertAccount {
            owner: owner_key,
            contact: *contact,
            alerted_at: clock.unix_timestamp,
            has_approved: false,
            bump,
        };
        // Write discriminator (8 bytes)
        let discriminator = AlertAccount::DISCRIMINATOR;
        data[..8].copy_from_slice(discriminator);
        // Write account data after discriminator
        let mut writer = &mut data[8..];
        anchor_lang::prelude::borsh::BorshSerialize::serialize(&alert, &mut writer)?;
    }

    // Mark panic as triggered
    let config = &mut ctx.accounts.panic_config;
    config.is_triggered = true;

    let vault_final_balance = ctx.accounts.vault.to_account_info().lamports();

    emit!(PanicTriggered {
        owner: owner_key,
        attacker: ctx.accounts.attacker.key(),
        vault_balance: vault_final_balance,
        decoy_sent: decoy_to_send,
        locked_until: clock.unix_timestamp + time_lock_duration,
        contacts_alerted: contacts.len() as u8,
    });

    // Use vault_bump to suppress warning
    msg!("Vault bump: {}", vault_bump);

    Ok(())
}
