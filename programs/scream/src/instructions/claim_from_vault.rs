use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ScreamError;
use crate::events::FundsRecovered;

#[derive(Accounts)]
pub struct ClaimFromVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
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
}

pub fn handler(ctx: Context<ClaimFromVault>) -> Result<()> {
    let config = &ctx.accounts.panic_config;
    let vault = &mut ctx.accounts.vault;

    require!(config.is_triggered, ScreamError::PanicNotTriggered);
    require!(vault.recovery_initiated, ScreamError::RecoveryNotInitiated);
    require!(
        vault.approvals >= config.recovery_threshold,
        ScreamError::InsufficientApprovals
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= vault.locked_until,
        ScreamError::TimeLockActive
    );

    // Transfer all lamports from vault to owner (keeping rent-exempt minimum)
    let vault_info = vault.to_account_info();
    let owner_info = ctx.accounts.owner.to_account_info();

    let vault_balance = vault_info.lamports();
    let rent = Rent::get()?.minimum_balance(vault_info.data_len());
    let claimable = vault_balance.saturating_sub(rent);

    if claimable > 0 {
        **vault_info.try_borrow_mut_lamports()? -= claimable;
        **owner_info.try_borrow_mut_lamports()? += claimable;
    }

    emit!(FundsRecovered {
        owner: ctx.accounts.owner.key(),
        amount: claimable,
    });

    Ok(())
}
