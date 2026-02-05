use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CompromisedFlag {
    pub owner: Pubkey,
    /// Timestamp when the wallet was flagged compromised
    pub flagged_at: i64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl CompromisedFlag {
    pub const SEED_PREFIX: &'static [u8] = b"compromised";
}
