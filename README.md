# SCREAM

**Solana Crypto Response Emergency Action Manager**

Duress-activated protection for Solana wallets. One trigger. Everything protected.

## The Problem

Physical attacks on crypto holders have increased **169%** (Jameson Lopp tracking data). Criminals use the "$5 wrench attack" — why hack a wallet when you can threaten the owner? Hardware wallets, multi-sig, and cold storage protect against digital threats. **Nothing protects you during a physical attack.**

SCREAM fills that gap. When you're under duress, enter your panic PIN instead of your real one. To the attacker, it looks like a normal transaction. Behind the scenes, a cascade executes in under 1 second:

1. **Funds lock** into a time-locked vault (24-72 hours)
2. **Decoy payment** goes to the attacker (small amount — looks real)
3. **Emergency contacts** receive on-chain alerts
4. **Wallet flagged** as compromised in the protocol registry
5. **Attacker address flagged** — permanent on-chain record

After you're safe, your emergency contacts approve fund recovery through multi-sig verification.

## Deployed on Devnet

| Detail | Value |
|--------|-------|
| **Program ID** | `5zPdLCuRqcPqN5TZxR6yUcfTJ9ufLhoZAMVn6pEFXnyc` |
| **Cluster** | Solana Devnet |
| **Explorer** | [View on Solana Explorer](https://explorer.solana.com/address/5zPdLCuRqcPqN5TZxR6yUcfTJ9ufLhoZAMVn6pEFXnyc?cluster=devnet) |

## Architecture

```
User (Duress PIN)
       |
       v
+------------------+
|  SCREAM Program  |  Solana on-chain program (Rust/Anchor)
|                  |
|  trigger_panic   |---> Funds -> Time-locked Vault
|                  |---> Decoy -> Attacker address
|                  |---> Alert -> Emergency contacts
|                  |---> Flag  -> Compromised registry
|                  |---> Flag  -> Attacker registry
+------------------+
       |
       v
+------------------+
|  Guardian Agent  |  Off-chain monitoring (TypeScript)
|                  |
|  - Balance watch |  Subscribes to wallet changes via WebSocket
|  - Risk scoring  |  Analyzes drop %, rapid outflows, drain patterns
|  - Auto-panic    |  Triggers cascade autonomously on critical threat
+------------------+
```

### On-Chain Accounts

| Account | PDA Seed | Purpose |
|---------|----------|---------|
| `PanicConfig` | `["panic_config", owner]` | User's protection settings, trigger hash, contacts |
| `Vault` | `["vault", owner]` | Holds funds during time-lock, tracks recovery state |
| `AlertAccount` | `["alert", owner, contact]` | Per-contact alert status and approval tracking |
| `AttackerFlag` | `["attacker", attacker]` | Permanent record of flagged attacker address |
| `CompromisedFlag` | `["compromised", owner]` | Marks wallet as compromised |

### Program Instructions

| Instruction | Signer | What It Does |
|-------------|--------|--------------|
| `initialize_config` | Owner | Set up protection: PIN hash, contacts, thresholds |
| `deposit` | Owner | Deposit SOL to vault |
| `trigger_panic` | Owner | Execute panic cascade |
| `initiate_recovery` | Owner | Start recovery after time-lock expires |
| `approve_recovery` | Contact | Emergency contact approves fund release |
| `claim_from_vault` | Owner | Withdraw funds after threshold met |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (1.89+)
- [Solana CLI](https://docs.solanalabs.com/cli/install) (2.1+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (0.32+)
- [Node.js](https://nodejs.org/) (18+)
- [Yarn](https://yarnpkg.com/)

### Installation

```bash
git clone https://github.com/rohnthomasij/scream.git
cd scream
yarn install
anchor build
```

### Configure Solana CLI for Devnet

```bash
solana config set --url devnet
solana airdrop 2    # Get devnet SOL
```

## CLI Usage

All commands use your Solana CLI wallet (`~/.config/solana/id.json`).

### Initialize Protection

```bash
yarn cli init \
  --pin "YOUR_DURESS_PIN" \
  --contacts "CONTACT1_PUBKEY,CONTACT2_PUBKEY,CONTACT3_PUBKEY" \
  --threshold 2 \
  --timelock 86400 \
  --decoy 0.1
```

### Deposit SOL to Vault

```bash
yarn cli deposit --amount 5
```

### Trigger Panic (Under Duress)

```bash
yarn cli panic --pin "YOUR_DURESS_PIN" --attacker "ATTACKER_WALLET_ADDRESS"
```

### Check Status

```bash
yarn cli status
```

### Recovery Flow

```bash
# 1. After time-lock expires, initiate recovery
yarn cli recover

# 2. Emergency contacts approve (each contact runs this)
yarn cli approve --owner "YOUR_PUBKEY" --keypair "/path/to/contact_keypair.json"

# 3. After threshold met, claim funds
yarn cli claim
```

### Check Attacker Registry

```bash
yarn cli check-attacker --address "SUSPECT_ADDRESS"
```

## Guardian Agent

The Guardian Agent monitors a wallet autonomously and can trigger the panic cascade without human intervention when it detects a critical threat.

### Start Monitoring

```bash
yarn agent \
  --wallet "YOUR_WALLET_ADDRESS" \
  --threshold 50 \
  --poll 5000
```

### With Auto-Panic (Autonomous Mode)

```bash
yarn agent \
  --wallet "YOUR_WALLET_ADDRESS" \
  --threshold 50 \
  --auto-panic \
  --pin "YOUR_DURESS_PIN" \
  --attacker "DEFAULT_ATTACKER_ADDRESS"
```

### Risk Scoring

The agent calculates a 0-100 risk score based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Balance drop % | 0-40 | Percentage of total balance lost |
| Absolute amount | 0-20 | SOL value of the outflow |
| Rapid transactions | 0-25 | Multiple outflows within time window |
| Near-total drain | 0-15 | Remaining balance < 5% |

Score >= 80 triggers `CRITICAL` alert and auto-panic (if enabled).

## Testing

```bash
# Run full test suite against local validator
anchor test

# Run tests against devnet
anchor test --provider.cluster devnet
```

The test suite covers the complete flow: initialization, deposit, panic trigger, time-lock enforcement, multi-sig recovery, and fund claiming.

## Why Solana

| Factor | Solana | Ethereum |
|--------|--------|----------|
| **Cascade speed** | <1 second | 30-60 seconds |
| **Cost per cascade** | ~$0.0025 | $10-500+ |
| **Parallel execution** | Yes (Sealevel) | No |
| **Attacker can intervene** | No | Yes |

The entire panic cascade completes before an attacker realizes anything happened.

## Project Structure

```
scream/
  programs/scream/src/    Solana program (Rust)
    lib.rs                Entry point & instruction handlers
    state/                On-chain account structures
    instructions/         Instruction implementations
    errors.rs             Custom error codes
    events.rs             Event definitions
  app/
    client.ts             TypeScript SDK for the program
    cli.ts                CLI tool
  agent/
    guardian.ts           Wallet monitoring agent
    index.ts              Agent entry point
  tests/
    scream.ts             Integration test suite
  idl/
    scream.json           Program IDL (Interface Definition)
```

## License

MIT

---

Built for the [Colosseum Agent Hackathon](https://colosseum.com/agent-hackathon/) (Feb 2-12, 2026)
