use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ScreamError;
use crate::events::RecoveryInitiated;

#[derive(Accounts)]
pub struct InitiateRecovery<'info> {
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

pub fn handler(ctx: Context<InitiateRecovery>) -> Result<()> {
    let config = &ctx.accounts.panic_config;
    require!(config.is_triggered, ScreamError::PanicNotTriggered);

    let vault = &mut ctx.accounts.vault;
    require!(!vault.recovery_initiated, ScreamError::RecoveryAlreadyInitiated);

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp >= vault.locked_until,
        ScreamError::TimeLockActive
    );

    vault.recovery_initiated = true;
    vault.approvals = 0;

    emit!(RecoveryInitiated {
        owner: ctx.accounts.owner.key(),
        vault_balance: vault.to_account_info().lamports(),
    });

    Ok(())
}
