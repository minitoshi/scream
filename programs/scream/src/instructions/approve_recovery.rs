use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::ScreamError;
use crate::events::RecoveryApproved;

#[derive(Accounts)]
pub struct ApproveRecovery<'info> {
    pub contact: Signer<'info>,

    /// CHECK: The owner whose vault we're approving recovery for. Validated via PDA seeds.
    pub owner: UncheckedAccount<'info>,

    #[account(
        seeds = [PanicConfig::SEED_PREFIX, owner.key().as_ref()],
        bump = panic_config.bump,
        constraint = panic_config.owner == owner.key(),
    )]
    pub panic_config: Account<'info, PanicConfig>,

    #[account(
        mut,
        seeds = [Vault::SEED_PREFIX, owner.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == owner.key(),
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [AlertAccount::SEED_PREFIX, owner.key().as_ref(), contact.key().as_ref()],
        bump = alert_account.bump,
        constraint = alert_account.owner == owner.key(),
        constraint = alert_account.contact == contact.key(),
    )]
    pub alert_account: Account<'info, AlertAccount>,
}

pub fn handler(ctx: Context<ApproveRecovery>) -> Result<()> {
    let config = &ctx.accounts.panic_config;
    let vault = &mut ctx.accounts.vault;
    let alert = &mut ctx.accounts.alert_account;

    require!(config.is_triggered, ScreamError::PanicNotTriggered);
    require!(vault.recovery_initiated, ScreamError::RecoveryNotInitiated);

    // Verify contact is in the contacts list
    require!(
        config.contacts.contains(&ctx.accounts.contact.key()),
        ScreamError::InvalidContact
    );

    require!(!alert.has_approved, ScreamError::AlreadyApproved);

    alert.has_approved = true;
    vault.approvals += 1;

    emit!(RecoveryApproved {
        owner: ctx.accounts.owner.key(),
        contact: ctx.accounts.contact.key(),
        approvals_so_far: vault.approvals,
        threshold: config.recovery_threshold,
    });

    Ok(())
}
