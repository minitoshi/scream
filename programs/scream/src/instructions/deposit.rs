use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::events::Deposited;

#[derive(Accounts)]
pub struct Deposit<'info> {
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

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    emit!(Deposited {
        owner: ctx.accounts.owner.key(),
        amount,
        vault_balance: ctx.accounts.vault.to_account_info().lamports(),
    });

    Ok(())
}
