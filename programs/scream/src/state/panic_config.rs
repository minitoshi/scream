use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PanicConfig {
    pub owner: Pubkey,
    /// SHA-256 hash of the duress trigger (e.g., PIN)
    pub trigger_hash: [u8; 32],
    /// Emergency contacts who can approve recovery
    #[max_len(5)]
    pub contacts: Vec<Pubkey>,
    /// Number of contacts required to approve recovery
    pub recovery_threshold: u8,
    /// Time-lock duration in seconds
    pub time_lock_duration: i64,
    /// Decoy amount in lamports to send to attacker
    pub decoy_lamports: u64,
    /// Whether panic has been triggered
    pub is_triggered: bool,
    /// Bump seed for PDA
    pub bump: u8,
}

impl PanicConfig {
    pub const SEED_PREFIX: &'static [u8] = b"panic_config";
}
