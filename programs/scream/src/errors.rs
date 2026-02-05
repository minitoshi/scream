use anchor_lang::prelude::*;

#[error_code]
pub enum ScreamError {
    #[msg("Invalid trigger proof: hash does not match stored trigger hash")]
    InvalidTriggerProof,
    #[msg("Panic has already been triggered for this config")]
    PanicAlreadyTriggered,
    #[msg("Panic has not been triggered yet")]
    PanicNotTriggered,
    #[msg("Time-lock has not expired yet")]
    TimeLockActive,
    #[msg("Recovery has not been initiated")]
    RecoveryNotInitiated,
    #[msg("Recovery has already been initiated")]
    RecoveryAlreadyInitiated,
    #[msg("Insufficient approvals for recovery")]
    InsufficientApprovals,
    #[msg("Contact is not in the emergency contacts list")]
    InvalidContact,
    #[msg("Contact has already approved recovery")]
    AlreadyApproved,
    #[msg("Too many contacts (max 5)")]
    TooManyContacts,
    #[msg("Recovery threshold must be <= number of contacts")]
    InvalidThreshold,
    #[msg("Insufficient funds for decoy transfer")]
    InsufficientFundsForDecoy,
    #[msg("Number of remaining accounts does not match number of contacts")]
    ContactAccountMismatch,
}
