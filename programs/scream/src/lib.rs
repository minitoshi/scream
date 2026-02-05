use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;
pub mod events;

// Re-export instruction context structs and their hidden __client_accounts modules
// at the crate root, which is required by the #[program] macro.
pub use instructions::initialize_config::*;
pub use instructions::deposit::*;
pub use instructions::trigger_panic::*;
pub use instructions::initiate_recovery::*;
pub use instructions::approve_recovery::*;
pub use instructions::claim_from_vault::*;

declare_id!("5zPdLCuRqcPqN5TZxR6yUcfTJ9ufLhoZAMVn6pEFXnyc");

#[program]
pub mod scream {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        trigger_hash: [u8; 32],
        contacts: Vec<Pubkey>,
        recovery_threshold: u8,
        time_lock_duration: i64,
        decoy_lamports: u64,
    ) -> Result<()> {
        crate::instructions::initialize_config::handler(
            ctx,
            trigger_hash,
            contacts,
            recovery_threshold,
            time_lock_duration,
            decoy_lamports,
        )
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        crate::instructions::deposit::handler(ctx, amount)
    }

    pub fn trigger_panic<'info>(
        ctx: Context<'_, '_, 'info, 'info, TriggerPanic<'info>>,
        trigger_proof: Vec<u8>,
    ) -> Result<()> {
        crate::instructions::trigger_panic::handler(ctx, trigger_proof)
    }

    pub fn initiate_recovery(ctx: Context<InitiateRecovery>) -> Result<()> {
        crate::instructions::initiate_recovery::handler(ctx)
    }

    pub fn approve_recovery(ctx: Context<ApproveRecovery>) -> Result<()> {
        crate::instructions::approve_recovery::handler(ctx)
    }

    pub fn claim_from_vault(ctx: Context<ClaimFromVault>) -> Result<()> {
        crate::instructions::claim_from_vault::handler(ctx)
    }
}
