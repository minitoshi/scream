use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AlertAccount {
    pub owner: Pubkey,
    pub contact: Pubkey,
    /// Timestamp when alert was created
    pub alerted_at: i64,
    /// Whether this contact has approved recovery
    pub has_approved: bool,
    /// Bump seed for PDA
    pub bump: u8,
}

impl AlertAccount {
    pub const SEED_PREFIX: &'static [u8] = b"alert";
}
