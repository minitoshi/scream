use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub owner: Pubkey,
    pub contacts_count: u8,
    pub time_lock_duration: i64,
    pub decoy_lamports: u64,
}

#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub amount: u64,
    pub vault_balance: u64,
}

#[event]
pub struct PanicTriggered {
    pub owner: Pubkey,
    pub attacker: Pubkey,
    pub vault_balance: u64,
    pub decoy_sent: u64,
    pub locked_until: i64,
    pub contacts_alerted: u8,
}

#[event]
pub struct RecoveryInitiated {
    pub owner: Pubkey,
    pub vault_balance: u64,
}

#[event]
pub struct RecoveryApproved {
    pub owner: Pubkey,
    pub contact: Pubkey,
    pub approvals_so_far: u8,
    pub threshold: u8,
}

#[event]
pub struct FundsRecovered {
    pub owner: Pubkey,
    pub amount: u64,
}
