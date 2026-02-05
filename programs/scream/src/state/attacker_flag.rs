use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AttackerFlag {
    pub attacker: Pubkey,
    /// Who flagged this attacker
    pub reported_by: Pubkey,
    /// Timestamp when flagged
    pub flagged_at: i64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl AttackerFlag {
    pub const SEED_PREFIX: &'static [u8] = b"attacker";
}
