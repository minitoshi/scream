use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    /// Timestamp when funds can be recovered (0 if not locked)
    pub locked_until: i64,
    /// Whether recovery has been initiated
    pub recovery_initiated: bool,
    /// Number of approvals received so far
    pub approvals: u8,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Vault {
    pub const SEED_PREFIX: &'static [u8] = b"vault";
}
