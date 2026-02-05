use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ScreamError;
use crate::events::ConfigInitialized;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + PanicConfig::INIT_SPACE,
        seeds = [PanicConfig::SEED_PREFIX, owner.key().as_ref()],
        bump,
    )]
    pub panic_config: Account<'info, PanicConfig>,

    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [Vault::SEED_PREFIX, owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeConfig>,
    trigger_hash: [u8; 32],
    contacts: Vec<Pubkey>,
    recovery_threshold: u8,
    time_lock_duration: i64,
    decoy_lamports: u64,
) -> Result<()> {
    require!(contacts.len() <= 5, ScreamError::TooManyContacts);
    require!(
        recovery_threshold <= contacts.len() as u8,
        ScreamError::InvalidThreshold
    );

    let config = &mut ctx.accounts.panic_config;
    config.owner = ctx.accounts.owner.key();
    config.trigger_hash = trigger_hash;
    config.contacts = contacts.clone();
    config.recovery_threshold = recovery_threshold;
    config.time_lock_duration = time_lock_duration;
    config.decoy_lamports = decoy_lamports;
    config.is_triggered = false;
    config.bump = ctx.bumps.panic_config;

    let vault = &mut ctx.accounts.vault;
    vault.owner = ctx.accounts.owner.key();
    vault.locked_until = 0;
    vault.recovery_initiated = false;
    vault.approvals = 0;
    vault.bump = ctx.bumps.vault;

    emit!(ConfigInitialized {
        owner: ctx.accounts.owner.key(),
        contacts_count: contacts.len() as u8,
        time_lock_duration,
        decoy_lamports,
    });

    Ok(())
}
