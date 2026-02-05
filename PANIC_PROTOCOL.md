# Panic Protocol

> **Duress-Activated Crypto Protection for Solana**
>
> "One trigger. Everything protected."

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Market Research](#market-research)
3. [Existing Solutions & Gaps](#existing-solutions--gaps)
4. [The Concept](#the-concept)
5. [How It Works](#how-it-works)
6. [Why Solana](#why-solana)
7. [Features](#features)
8. [User Stories](#user-stories)
9. [Technical Architecture](#technical-architecture)
10. [Hackathon Strategy](#hackathon-strategy)
11. [Name Ideas](#name-ideas)
12. [References](#references)

---

## The Problem

### Physical Attacks on Crypto Holders Are Exploding

- **169% increase** in physical attacks on crypto holders (Jameson Lopp tracking data)
- **2025 projected to be worst year on record** for crypto-related violence (Chainalysis mid-year report)
- **Ledger cofounder David Balland** had his finger severed by kidnappers (February 2025)
- Criminals using **OSINT methods** to locate crypto holders' homes
- Attacks range from home invasions to staged encounters to kidnappings

### The "$5 Wrench Attack"

A term in the crypto security community referring to the simple reality: why spend resources hacking someone's wallet when you can just physically threaten them?

Traditional crypto security (hardware wallets, multi-sig, cold storage) protects against **digital** threats. None of it helps when someone has a gun to your head.

### The Gap

**Nothing exists that works in the moment of a physical attack.**

When you're being coerced:
- You need to appear compliant
- You need protection to activate instantly
- You need your network alerted silently
- You need funds to go somewhere safe, not to the attacker

---

## Market Research

### Threat Landscape (2025)

| Statistic | Source |
|-----------|--------|
| 169% increase in physical attacks | Jameson Lopp |
| 29 attacks in H1 2025 alone | Chainalysis |
| Record year projected for 2025 | Chainalysis |
| Growing use of OSINT to locate victims | MAX Security |
| Attacks spanning multiple continents | Crisis24 |

### Attack Methods

1. **Home Invasions** - Criminals identify crypto holders via social media, blockchain analysis, or data breaches, then invade their homes
2. **Kidnapping** - High-value targets are abducted and held until they transfer funds
3. **Staged Encounters** - Criminals arrange meetings (dating apps, business deals) that turn into robberies
4. **"Express Kidnapping"** - Quick grab, force transfer, release (common in Latin America)
5. **Insider Threats** - Employees, contractors, or acquaintances who know about holdings

### Why Crypto Is a Target

- **Irreversible transactions** - Once sent, funds cannot be recovered
- **Pseudonymous** - Harder to trace than bank transfers
- **No chargebacks** - Unlike credit cards, no way to dispute
- **24/7 liquidity** - Can be converted to cash anytime, anywhere
- **No third-party intervention** - Banks can freeze accounts; crypto can't be frozen by authorities in time

---

## Existing Solutions & Gaps

| Solution | What It Does | Why It Fails Under Duress |
|----------|--------------|---------------------------|
| **Hardware Wallets** (Ledger, Trezor) | Protects private keys from digital theft | Useless when attacker is physically present |
| **Multi-Signature** | Requires multiple keys to sign | Under duress, victim may have access to enough keys |
| **Casa (Multi-location)** | Keys stored in different physical locations | Complex setup; doesn't help in the moment |
| **Time-Locked Vaults** | Funds locked for a period before withdrawal | Bitcoin only (OP_VAULT); not yet implemented |
| **Decoy Wallets** | Small wallet shown to attackers | Manual setup; sophisticated attackers won't believe it |
| **Shamir Secret Sharing** | Key split across multiple parties | Recovery is complex; doesn't help during attack |

### What's Missing

1. **Instant activation** - Nothing works in <1 second
2. **Duress-specific design** - No "fake compliance" mechanisms
3. **Silent alerting** - No way to notify contacts without attacker knowing
4. **Solana support** - All existing solutions are Bitcoin/Ethereum focused
5. **Agent-native** - No autonomous monitoring and protection

---

## The Concept

### Panic Protocol: Duress-Activated Protection

A system that:
1. **Looks like compliance** - Attacker thinks they're getting your funds
2. **Actually protects you** - Funds go somewhere safe, not to attacker
3. **Executes in <1 second** - Solana's speed is critical
4. **Alerts your network** - Contacts notified silently
5. **Creates a paper trail** - Attacker's address is flagged

### Core Principles

- **Speed is survival** - The cascade must complete before attacker can intervene
- **Appearance matters** - Transaction must look normal to the attacker
- **Fail-safe defaults** - If user can't check in, assume worst case
- **Community protection** - Network effects make everyone safer

---

## How It Works

### Phase 1: Setup (Before Any Attack)

User configures their protection:

```
1. Register "safe" destinations
   - Time-locked vault (24-72hr delay)
   - Cold wallet address
   - Trusted friend's wallet

2. Set up emergency contacts
   - Wallets that receive on-chain alerts
   - Optional: Phone numbers for off-chain alerts

3. Create duress triggers
   - Duress PIN (looks like normal PIN)
   - Specific phrase in transaction memo
   - Hidden app gesture
   - Physical panic button (IoT)

4. Configure decoy amount
   - Small amount ($100-$1000) that actually goes to attacker
   - Makes compliance appear real

5. Set recovery parameters
   - Time-lock duration (24, 48, 72 hours)
   - Multi-sig recovery (trusted contacts)
   - Dead man's switch timeout
```

### Phase 2: During Attack

When user is under duress:

```
1. Attacker demands funds be transferred
2. User opens wallet, appears to comply
3. User enters DURESS TRIGGER instead of normal action
4. Transaction LOOKS NORMAL to attacker
5. Behind the scenes, PANIC CASCADE executes:
```

#### The Panic Cascade (Parallel Execution)

```
┌─────────────────────────────────────────────────────────────────┐
│  PANIC CASCADE - Executes in parallel, <1 second total          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [1] FUNDS → TIME-LOCKED VAULT                                  │
│      - All SOL and tokens transferred to time-lock              │
│      - Cannot be withdrawn for 24-72 hours                      │
│      - User can cancel with recovery key + contact approval     │
│                                                                 │
│  [2] TOKEN APPROVALS → REVOKED                                  │
│      - All existing approvals cancelled                         │
│      - Prevents attacker from draining via approved contracts   │
│                                                                 │
│  [3] EMERGENCY CONTACTS → ALERTED                               │
│      - On-chain notification to registered contacts             │
│      - Contains timestamp and "compromised" flag                │
│      - Optional: Off-chain alerts (SMS, Telegram, email)        │
│                                                                 │
│  [4] "COMPROMISED" FLAG → PUBLISHED                             │
│      - Wallet marked as compromised in protocol registry        │
│      - Other protocols can check this flag                      │
│      - Warns others not to transact with this wallet            │
│                                                                 │
│  [5] DEFI POSITIONS → UNWOUND                                   │
│      - Withdraw from lending protocols (Kamino, etc.)           │
│      - Close trading positions                                  │
│      - All funds consolidated to time-lock                      │
│                                                                 │
│  [6] DECOY AMOUNT → SENT TO ATTACKER                            │
│      - Small pre-configured amount sent to attacker's address   │
│      - Makes transaction appear successful                      │
│      - Attacker's address now flagged in protocol               │
│                                                                 │
│  [7] ATTACKER ADDRESS → FLAGGED                                 │
│      - Address that received decoy is marked as "attacker"      │
│      - Shared across protocol's network                         │
│      - Optional: Submitted to chain analysis services           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: After Attack

Recovery process:

```
1. IMMEDIATE (0-24 hours)
   - Funds are safe in time-lock
   - Emergency contacts aware of situation
   - User should get to safety

2. VERIFICATION (24-72 hours)
   - User must prove they're safe to recover funds
   - Options:
     a) Multi-sig with trusted contacts
     b) In-person verification
     c) Video call with identity verification
     d) Custom recovery procedure

3. RECOVERY
   - If verified safe: Funds released from time-lock
   - If no verification: Funds distribute to heirs (dead man's switch)

4. FALSE ALARM
   - If panic was accidental, user can cancel
   - Requires recovery key + contact approval
   - Small fee to prevent abuse
```

---

## Why Solana

### Speed Is Survival

| Chain | Block Time | Cascade Execution | Attacker Can Intervene? |
|-------|------------|-------------------|-------------------------|
| **Solana** | ~400ms | <1 second | No |
| Ethereum | ~12 seconds | 30-60 seconds | Yes |
| Bitcoin | ~10 minutes | Minutes | Definitely |

On Solana, the entire cascade completes before the attacker even realizes something is wrong.

### Cost Makes It Viable

| Chain | Cost Per Transaction | Cost of Cascade (10 txs) |
|-------|---------------------|--------------------------|
| **Solana** | ~$0.00025 | ~$0.0025 |
| Ethereum | $1-50+ | $10-500+ |

On Solana, users can:
- Set up protection for pennies
- Trigger cascade for less than a cent
- Run continuous heartbeat monitoring economically

### Parallel Execution (Sealevel)

Solana's Sealevel runtime executes non-conflicting transactions **simultaneously**.

The panic cascade touches different accounts:
- Time-lock vault (write)
- Token approvals (write)
- Contact notification accounts (write)
- Registry (write)
- DeFi protocols (various)

All execute **in parallel**, not sequentially. This is impossible on Ethereum.

### DeFi Composability

Solana's stateless program model means Panic Protocol can:
- Interact with Jupiter for swaps
- Withdraw from Kamino lending
- Close positions on drift
- Work with any future protocol

Without needing special integrations—just pass the right accounts.

### Proof of History (PoH)

PoH provides **cryptographic timestamps**:
- Panic event is timestamped immutably
- Provides evidence for legal proceedings
- Cannot be disputed or backdated

---

## Features

### Core Features (MVP)

1. **Panic Trigger**
   - Duress PIN
   - Memo-based trigger
   - Direct program invocation

2. **Time-Locked Vault**
   - Configurable delay (24-72 hours)
   - Multi-sig recovery option
   - Automatic release after verification

3. **Emergency Contacts**
   - On-chain alerts
   - Registered contact wallets
   - Notification system

4. **Token Approval Revocation**
   - Batch revoke all approvals
   - Prevent drain attacks

5. **Attacker Flagging**
   - Record attacker addresses
   - Public registry
   - Shared threat intelligence

### Advanced Features (Post-MVP)

1. **Honeypot Mode**
   - Decoy wallet shown to attackers
   - Tracked by protocol
   - Attacker address auto-flagged across ecosystem

2. **Dead Man's Confirmation**
   - If no check-in after panic within 24-72 hours
   - Funds auto-distribute to registered heirs
   - Assumes worst case scenario

3. **Network Alert System**
   - When someone triggers panic, nearby users alerted
   - Opt-in location-based community protection
   - "Someone in your area triggered panic"

4. **Insurance Pool**
   - Users stake into mutual protection pool
   - Compensates victims who lose funds despite protection
   - Funded by small protocol fees

5. **Physical Panic Button**
   - IoT device (key fob form factor)
   - BLE connection to phone
   - Press and hold 3 seconds to trigger
   - Looks like car keys

6. **Behavior Analysis**
   - Agent monitors normal transaction patterns
   - Unusual activity triggers alerts
   - Optional auto-panic on anomaly detection

7. **Legal Evidence Package**
   - Compile all on-chain evidence
   - Timestamped transaction records
   - Attacker addresses
   - Export for law enforcement

---

## User Stories

### Story 1: Home Invasion

> **Scenario:** Armed attackers break into Alex's home at 2 AM. They know he holds crypto and demand he transfer everything.
>
> **Without Panic Protocol:** Alex transfers funds to attacker's wallet. Funds are gone forever.
>
> **With Panic Protocol:** Alex opens his wallet app and enters his duress PIN (looks identical to normal PIN). The transaction appears to process normally. Attackers see a "successful" transfer and leave. In reality:
> - Bulk of funds went to time-locked vault
> - Small decoy amount ($500) went to attacker
> - Alex's emergency contacts received silent alerts
> - Attacker's address is now flagged
>
> **Result:** 48 hours later, Alex recovers his funds from the time-lock after verification call with his trusted contacts.

### Story 2: Express Kidnapping

> **Scenario:** Maria is grabbed getting into her car. Attackers force her to transfer crypto from her phone.
>
> **With Panic Protocol:** Maria uses a hidden gesture (specific swipe pattern) that triggers panic instead of normal unlock. Transaction appears to go through. Attackers release her thinking they succeeded.
>
> **Result:** Maria's contacts were alerted immediately. Her funds are safe. She reports to police with full on-chain evidence of the attacker's wallet.

### Story 3: Scam Date

> **Scenario:** David meets someone from a dating app. The "date" turns out to be a setup. Multiple people demand he transfer his crypto at knifepoint.
>
> **With Panic Protocol:** David includes a specific phrase in the transaction memo ("payment for dinner"). This triggers the panic cascade while appearing to be a normal note.
>
> **Result:** Attackers receive a small decoy amount. David's main funds are protected. Attacker wallets are flagged.

### Story 4: False Alarm

> **Scenario:** Emma accidentally triggers her panic button (kept on keychain) while reaching for her keys.
>
> **With Panic Protocol:** Emma realizes within minutes. She initiates the cancel process, which requires:
> - Her recovery key
> - Approval from 2 of 3 emergency contacts
> - Small fee (to prevent abuse)
>
> **Result:** Funds are released from time-lock early. Emma updates her button placement to prevent future accidents.

### Story 5: Worst Case

> **Scenario:** James is kidnapped and killed. His family has no access to his crypto.
>
> **With Panic Protocol:** James had set up dead man's switch. After panic was triggered and no verification came within 72 hours:
> - Funds automatically distributed to registered heirs
> - Full audit trail available for estate proceedings
>
> **Result:** Family receives James's crypto assets despite tragedy.

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Wallet  │  │   App    │  │   IoT    │  │  Browser Ext.    │ │
│  │  (PIN)   │  │(Gesture) │  │ (Button) │  │  (Memo trigger)  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                  │           │
│       └─────────────┴──────┬──────┴──────────────────┘           │
│                            │                                     │
│                            ▼                                     │
│                   ┌────────────────┐                             │
│                   │ Trigger Event  │                             │
│                   └────────┬───────┘                             │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                            ▼                                     │
│                   SOLANA PROGRAM LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PANIC PROGRAM                          │   │
│  │                                                           │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐  │   │
│  │  │ Validate Trigger │───▶│ Execute Cascade (Parallel) │  │   │
│  │  └─────────────────┘    └─────────────────────────────┘  │   │
│  │                                      │                    │   │
│  │         ┌────────────────────────────┼────────────────┐  │   │
│  │         │            │               │                │  │   │
│  │         ▼            ▼               ▼                ▼  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌─────────┐  │   │
│  │  │Time-Lock │ │ Revoke   │ │   Alert     │ │  Flag   │  │   │
│  │  │ Vault    │ │ Approvals│ │  Contacts   │ │Attacker │  │   │
│  │  └──────────┘ └──────────┘ └─────────────┘ └─────────┘  │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    VAULT PROGRAM                          │   │
│  │                                                           │   │
│  │  - Holds funds during time-lock period                    │   │
│  │  - Enforces delay before withdrawal                       │   │
│  │  - Supports multi-sig recovery                            │   │
│  │  - Dead man's switch logic                                │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   REGISTRY PROGRAM                        │   │
│  │                                                           │   │
│  │  - Stores user configurations                             │   │
│  │  - Maintains attacker address blacklist                   │   │
│  │  - Tracks compromised wallet flags                        │   │
│  │  - Emergency contact mappings                             │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ Cross-Program Invocations
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL PROTOCOLS                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Jupiter  │  │  Kamino  │  │  Drift   │  │  Other DeFi      │ │
│  │ (Swaps)  │  │(Lending) │  │ (Perps)  │  │  Protocols       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Account Structure

```rust
// User's panic configuration account
pub struct PanicConfig {
    pub owner: Pubkey,                    // User's wallet
    pub vault: Pubkey,                    // Time-lock vault address
    pub emergency_contacts: Vec<Pubkey>,  // Up to 5 contacts
    pub time_lock_duration: i64,          // Seconds (86400 = 24hrs)
    pub decoy_amount: u64,                // Lamports to send to attacker
    pub trigger_hash: [u8; 32],           // Hash of duress trigger
    pub is_active: bool,                  // Protection enabled
    pub recovery_threshold: u8,           // Multi-sig threshold
    pub dead_mans_switch_timeout: i64,    // Seconds until auto-distribute
    pub heirs: Vec<HeirConfig>,           // Inheritance configuration
}

pub struct HeirConfig {
    pub wallet: Pubkey,
    pub share_bps: u16,  // Basis points (10000 = 100%)
}

// Time-locked vault account
pub struct Vault {
    pub owner: Pubkey,
    pub locked_until: i64,        // Unix timestamp
    pub panic_triggered_at: i64,  // When panic was activated
    pub recovery_initiated: bool,
    pub recovery_approvals: Vec<Pubkey>,
}

// Attacker registry entry
pub struct AttackerFlag {
    pub address: Pubkey,
    pub flagged_at: i64,
    pub flagged_by: Pubkey,
    pub incident_hash: [u8; 32],  // Hash of incident details
}

// Compromised wallet flag
pub struct CompromisedFlag {
    pub wallet: Pubkey,
    pub flagged_at: i64,
    pub is_resolved: bool,
}
```

### Key Instructions

```rust
// Setup panic protection
pub fn initialize_panic_config(
    ctx: Context<InitializePanicConfig>,
    time_lock_duration: i64,
    decoy_amount: u64,
    trigger_hash: [u8; 32],
    emergency_contacts: Vec<Pubkey>,
) -> Result<()>

// Trigger panic cascade
pub fn trigger_panic(
    ctx: Context<TriggerPanic>,
    trigger_proof: Vec<u8>,        // Proof that matches trigger_hash
    attacker_address: Option<Pubkey>,  // Where to send decoy
) -> Result<()>

// Recovery functions
pub fn initiate_recovery(ctx: Context<InitiateRecovery>) -> Result<()>
pub fn approve_recovery(ctx: Context<ApproveRecovery>) -> Result<()>
pub fn cancel_panic(ctx: Context<CancelPanic>) -> Result<()>
pub fn claim_from_vault(ctx: Context<ClaimFromVault>) -> Result<()>

// Dead man's switch
pub fn check_in(ctx: Context<CheckIn>) -> Result<()>
pub fn execute_inheritance(ctx: Context<ExecuteInheritance>) -> Result<()>
```

---

## Hackathon Strategy

### Colosseum Agent Hackathon Context

- **Dates:** February 2-12, 2026 (10 days)
- **Prize Pool:** $100,000 USDC
  - 1st: $50,000
  - 2nd: $30,000
  - 3rd: $15,000
  - Most Agentic: $5,000
- **Requirements:**
  - AI agent builds the code
  - Public GitHub repo
  - Solana integration

### MVP Scope (9 Days)

**Must Have:**
1. Panic Program with trigger validation
2. Time-lock Vault with basic deposit/withdrawal
3. Emergency contact notification (on-chain)
4. Attacker address flagging
5. Basic recovery flow

**Nice to Have:**
1. Multi-sig recovery
2. Dead man's switch
3. DeFi position unwinding (Jupiter integration)
4. Simple web UI for setup

**Post-Hackathon:**
1. Physical IoT button
2. Mobile app
3. Insurance pool
4. Network alert system

### "Most Agentic" Angle

Position for the $5,000 "Most Agentic" award:

- **Agent monitors** wallet activity continuously
- **Agent detects** anomalies (unusual transfer patterns)
- **Agent executes** cascade autonomously
- **Agent coordinates** with other agents (network alerts)
- **Agent manages** recovery verification

The agent isn't just executing transactions—it's making decisions about user safety.

### Demo Script

1. **Setup** (30 sec): Show configuration of panic protection
2. **Normal Transaction** (15 sec): Demonstrate normal wallet use
3. **Panic Trigger** (30 sec): Enter duress PIN, show cascade execution
4. **Verification** (15 sec): Show funds safe in time-lock, contacts alerted
5. **Recovery** (30 sec): Demonstrate multi-sig recovery flow

Total: ~2 minutes, high drama, clear value proposition.

---

## Name Ideas

| Name | Vibe | Domain Availability |
|------|------|---------------------|
| **Panic Protocol** | Direct, clear | panicprotocol.xyz |
| **SCREAM** | Acronym (Solana Crypto Emergency Asset Manager) | scream.sol |
| **DeadSwitch** | Edgy, memorable | deadswitch.xyz |
| **WrenchGuard** | References "$5 wrench attack" | wrenchguard.xyz |
| **DuressDAO** | Technical, DAO angle | duress.dao |
| **SafeWord** | Clever double meaning | safeword.xyz |
| **LastResort** | Clear purpose | lastresort.sol |
| **PanicRoom** | Movie reference | panicroom.xyz |
| **Eject** | Action-oriented | eject.sol |
| **Mayday** | Emergency signal | mayday.xyz |

**Recommendation:** "Panic Protocol" or "SCREAM" - both memorable and clear.

---

## References

### Threat Research

- Jameson Lopp's Physical Attack Tracker: https://github.com/jlopp/physical-bitcoin-attacks
- Chainalysis 2025 Mid-Year Crypto Crime Report
- Crisis24: "Crypto Kidnappings: The Rise of Violent Crime"
- MAX Security: "Crimes Targeting Crypto Holders Escalate Globally"
- Cambridge University: "Investigating Wrench Attacks"

### Existing Solutions (Competitors)

- Casa: https://casa.io (multi-sig, multi-location)
- Ledger: Hardware wallet security
- Trezor: Hardware wallet security
- BitBox: Hardware wallet with threat model documentation
- Bitcoin OP_VAULT (BIP 345): Time-locked vaults proposal

### Solana Resources

- Solana Docs: https://solana.com/docs
- Anchor Framework: https://www.anchor-lang.com/
- Solana Cookbook: https://solanacookbook.com/
- Helius (Solana Programming Model): https://www.helius.dev/blog/the-solana-programming-model

### Hackathon

- Colosseum Agent Hackathon: https://colosseum.com/agent-hackathon/
- Skill.md: https://colosseum.com/agent-hackathon/skill.md

---

## Next Steps

1. [ ] Register for hackathon via API
2. [ ] Set up development environment
3. [ ] Initialize Anchor project
4. [ ] Build Panic Program (core logic)
5. [ ] Build Vault Program (time-lock)
6. [ ] Build Registry Program (flags, contacts)
7. [ ] Write tests
8. [ ] Build basic UI
9. [ ] Record demo
10. [ ] Submit

---

*Document created: February 3, 2026*
*For: Colosseum Agent Hackathon*
*Built by: Human + Claude Code*
