/**
 * SCREAM SDK - Solana Crypto Response Emergency Action Manager
 *
 * Integration SDK for wallet providers to add duress-activated
 * protection to their wallets. Wraps all on-chain program
 * instructions and account queries.
 *
 * @example
 * ```typescript
 * import { ScreamClient, loadProvider } from "@scream/sdk";
 *
 * const provider = loadProvider("https://api.devnet.solana.com");
 * const client = new ScreamClient(provider);
 *
 * // Set up protection
 * await client.initializeConfig({
 *   pin: "DURESS_PIN",
 *   contacts: [contact1, contact2, contact3],
 *   recoveryThreshold: 2,
 *   timeLockDuration: 86400,
 *   decoyLamports: 50_000_000,
 * });
 *
 * // Under duress — triggers full cascade in <1s
 * await client.triggerPanic("DURESS_PIN", attackerAddress, contacts);
 * ```
 *
 * @packageDocumentation
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Connection,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** Deployed SCREAM program ID (devnet & localnet) */
export const PROGRAM_ID = new PublicKey(
  "5zPdLCuRqcPqN5TZxR6yUcfTJ9ufLhoZAMVn6pEFXnyc"
);

/** PDA seed prefixes used by the on-chain program */
export const SEEDS = {
  PANIC_CONFIG: "panic_config",
  VAULT: "vault",
  ALERT: "alert",
  ATTACKER: "attacker",
  COMPROMISED: "compromised",
} as const;

// ────────────────────────────────────────────────────────────
// Types — on-chain account structures
// ────────────────────────────────────────────────────────────

/** User's panic protection configuration (on-chain) */
export interface PanicConfig {
  /** Wallet owner */
  owner: PublicKey;
  /** SHA-256 hash of the duress trigger PIN */
  triggerHash: number[];
  /** Emergency contact wallet addresses (max 5) */
  contacts: PublicKey[];
  /** Number of contacts required to approve recovery (M-of-N) */
  recoveryThreshold: number;
  /** Time-lock duration in seconds before funds can be recovered */
  timeLockDuration: anchor.BN;
  /** Small decoy amount in lamports sent to attacker to fake compliance */
  decoyLamports: anchor.BN;
  /** Whether the panic cascade has been triggered */
  isTriggered: boolean;
  /** PDA bump seed */
  bump: number;
}

/** Time-locked vault holding protected funds (on-chain) */
export interface Vault {
  /** Wallet owner */
  owner: PublicKey;
  /** Unix timestamp when funds unlock (0 if not locked) */
  lockedUntil: anchor.BN;
  /** Whether the recovery process has started */
  recoveryInitiated: boolean;
  /** Number of contact approvals received */
  approvals: number;
  /** PDA bump seed */
  bump: number;
}

/** Per-contact alert and approval tracking (on-chain) */
export interface AlertAccount {
  /** Wallet owner who triggered panic */
  owner: PublicKey;
  /** Emergency contact address */
  contact: PublicKey;
  /** Unix timestamp when alert was created */
  alertedAt: anchor.BN;
  /** Whether this contact has approved recovery */
  hasApproved: boolean;
  /** PDA bump seed */
  bump: number;
}

/** Permanent record of a flagged attacker address (on-chain) */
export interface AttackerFlag {
  /** Flagged attacker wallet */
  attacker: PublicKey;
  /** Who reported this attacker */
  reportedBy: PublicKey;
  /** Unix timestamp when flagged */
  flaggedAt: anchor.BN;
  /** PDA bump seed */
  bump: number;
}

/** Marks a wallet as compromised (on-chain) */
export interface CompromisedFlag {
  /** Compromised wallet address */
  owner: PublicKey;
  /** Unix timestamp when flagged */
  flaggedAt: anchor.BN;
  /** PDA bump seed */
  bump: number;
}

/** Parameters for initializing panic protection */
export interface InitializeConfigParams {
  /** Duress PIN string (hashed before sending on-chain — never stored in plaintext) */
  pin: string;
  /** Emergency contact wallet addresses (1-5) */
  contacts: PublicKey[];
  /** Number of contact approvals needed for recovery (must be <= contacts.length) */
  recoveryThreshold: number;
  /** Time-lock duration in seconds (e.g. 86400 = 24 hours) */
  timeLockDuration: number;
  /** Decoy amount in lamports sent to attacker (e.g. 50_000_000 = 0.05 SOL) */
  decoyLamports: number;
}

/** Full protection status snapshot for a wallet */
export interface ProtectionStatus {
  /** Whether protection is configured */
  configured: boolean;
  /** On-chain panic config (null if not configured) */
  config: PanicConfig | null;
  /** On-chain vault state (null if not configured) */
  vault: Vault | null;
  /** SOL balance in the vault (lamports) */
  vaultBalance: number;
  /** SOL balance in the wallet (lamports) */
  walletBalance: number;
  /** Per-contact alert/approval status */
  contacts: { address: PublicKey; status: "standby" | "alerted" | "approved" }[];
  /** Whether the wallet is flagged as compromised */
  isCompromised: boolean;
  /** Seconds remaining on time-lock (0 if expired or not locked) */
  timeLockRemaining: number;
}

// ────────────────────────────────────────────────────────────
// Provider helper
// ────────────────────────────────────────────────────────────

/**
 * Create an AnchorProvider from RPC URL and wallet keypair path.
 *
 * For wallet integrations, providers should construct their own
 * AnchorProvider using their wallet adapter instead of this helper.
 *
 * @param rpcUrl - Solana RPC endpoint (defaults to devnet)
 * @param walletPath - Path to keypair JSON (defaults to ~/.config/solana/id.json)
 */
export function loadProvider(
  rpcUrl?: string,
  walletPath?: string
): AnchorProvider {
  const connection = new Connection(
    rpcUrl ||
      process.env.ANCHOR_PROVIDER_URL ||
      "https://api.devnet.solana.com",
    "confirmed"
  );

  const keyPath =
    walletPath ||
    process.env.ANCHOR_WALLET ||
    `${os.homedir()}/.config/solana/id.json`;
  const keypairData = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const wallet = new anchor.Wallet(keypair);

  return new AnchorProvider(connection, wallet, { commitment: "confirmed" });
}

// ────────────────────────────────────────────────────────────
// ScreamClient
// ────────────────────────────────────────────────────────────

/**
 * SCREAM SDK client for interacting with the on-chain program.
 *
 * Provides methods for all program instructions and account queries.
 * Wallet providers should instantiate this with their own AnchorProvider
 * built from the user's connected wallet.
 *
 * @example
 * ```typescript
 * // Wallet provider integration
 * const connection = new Connection("https://api.devnet.solana.com");
 * const wallet = walletAdapter; // from @solana/wallet-adapter
 * const provider = new AnchorProvider(connection, wallet, {});
 * const client = new ScreamClient(provider);
 * ```
 */
export class ScreamClient {
  /** Anchor program instance */
  program: Program;
  /** Anchor provider (connection + wallet) */
  provider: AnchorProvider;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    let idl: any;
    try {
      idl = require("../target/idl/scream.json");
    } catch {
      idl = require("../idl/scream.json");
    }
    this.program = new Program(idl, provider);
  }

  // ──────────────────────────────────────────────────────────
  // PDA derivation
  // ──────────────────────────────────────────────────────────

  /** Derive the PanicConfig PDA for a wallet owner */
  getPanicConfigPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.PANIC_CONFIG), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  /** Derive the Vault PDA for a wallet owner */
  getVaultPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.VAULT), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  /** Derive the AlertAccount PDA for an owner + contact pair */
  getAlertPda(owner: PublicKey, contact: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.ALERT), owner.toBuffer(), contact.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  /** Derive the AttackerFlag PDA for an attacker address */
  getAttackerFlagPda(attacker: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.ATTACKER), attacker.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  /** Derive the CompromisedFlag PDA for a wallet owner */
  getCompromisedFlagPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(SEEDS.COMPROMISED), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  // ──────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────

  /**
   * SHA-256 hash a duress PIN string into the 32-byte array
   * format expected by the on-chain program.
   */
  hashPin(pin: string): number[] {
    return Array.from(crypto.createHash("sha256").update(pin).digest());
  }

  // ──────────────────────────────────────────────────────────
  // Instructions
  // ──────────────────────────────────────────────────────────

  /**
   * Initialize panic protection for the connected wallet.
   *
   * Creates PanicConfig and Vault PDAs on-chain. The duress PIN
   * is hashed client-side (SHA-256) before being stored — the
   * plaintext PIN is never sent or stored on-chain.
   *
   * @returns Transaction signature
   */
  async initializeConfig(params: InitializeConfigParams): Promise<string> {
    const owner = this.provider.wallet.publicKey;

    return await this.program.methods
      .initializeConfig(
        this.hashPin(params.pin),
        params.contacts,
        params.recoveryThreshold,
        new anchor.BN(params.timeLockDuration),
        new anchor.BN(params.decoyLamports)
      )
      .accounts({
        owner,
        panicConfig: this.getPanicConfigPda(owner),
        vault: this.getVaultPda(owner),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Deposit SOL into the protection vault.
   *
   * Funds in the vault are swept into the time-lock when
   * panic is triggered, keeping them safe from the attacker.
   *
   * @param amountLamports - Amount to deposit in lamports
   * @returns Transaction signature
   */
  async deposit(amountLamports: number): Promise<string> {
    const owner = this.provider.wallet.publicKey;

    return await this.program.methods
      .deposit(new anchor.BN(amountLamports))
      .accounts({
        owner,
        panicConfig: this.getPanicConfigPda(owner),
        vault: this.getVaultPda(owner),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * **TRIGGER THE PANIC CASCADE.**
   *
   * Executes the full protection flow in a single transaction:
   * 1. Sweeps all wallet SOL into the time-locked vault
   * 2. Sends decoy amount to attacker (fakes compliance)
   * 3. Creates AlertAccount PDAs for each emergency contact
   * 4. Flags the wallet as compromised
   * 5. Flags the attacker address
   *
   * The PIN is verified on-chain by hashing and comparing to
   * the stored trigger_hash. If the hash doesn't match, the
   * transaction fails and nothing happens.
   *
   * @param pin - The duress PIN (plaintext — hashed on-chain)
   * @param attackerAddress - Address to receive decoy and be flagged
   * @param contacts - Emergency contacts (must match config)
   * @returns Transaction signature
   */
  async triggerPanic(
    pin: string,
    attackerAddress: PublicKey,
    contacts: PublicKey[]
  ): Promise<string> {
    const owner = this.provider.wallet.publicKey;

    const alertAccounts = contacts.map((contact) => ({
      pubkey: this.getAlertPda(owner, contact),
      isWritable: true,
      isSigner: false,
    }));

    return await this.program.methods
      .triggerPanic(Buffer.from(pin))
      .accounts({
        owner,
        panicConfig: this.getPanicConfigPda(owner),
        vault: this.getVaultPda(owner),
        compromisedFlag: this.getCompromisedFlagPda(owner),
        attacker: attackerAddress,
        attackerFlag: this.getAttackerFlagPda(attackerAddress),
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(alertAccounts)
      .rpc();
  }

  /**
   * Initiate the fund recovery process.
   *
   * Can only be called after panic has been triggered AND the
   * time-lock has expired. Sets recovery_initiated = true and
   * resets the approval counter to 0.
   *
   * @returns Transaction signature
   */
  async initiateRecovery(): Promise<string> {
    const owner = this.provider.wallet.publicKey;

    return await this.program.methods
      .initiateRecovery()
      .accounts({
        owner,
        panicConfig: this.getPanicConfigPda(owner),
        vault: this.getVaultPda(owner),
      })
      .rpc();
  }

  /**
   * Approve recovery as an emergency contact.
   *
   * The contact must be a registered emergency contact in the
   * owner's PanicConfig. Each contact can only approve once.
   * When approvals >= recovery_threshold, the owner can claim.
   *
   * @param ownerAddress - The wallet owner requesting recovery
   * @param contactKeypair - The approving contact's keypair (signer)
   * @returns Transaction signature
   */
  async approveRecovery(
    ownerAddress: PublicKey,
    contactKeypair: Keypair
  ): Promise<string> {
    return await this.program.methods
      .approveRecovery()
      .accounts({
        contact: contactKeypair.publicKey,
        owner: ownerAddress,
        panicConfig: this.getPanicConfigPda(ownerAddress),
        vault: this.getVaultPda(ownerAddress),
        alertAccount: this.getAlertPda(ownerAddress, contactKeypair.publicKey),
      })
      .signers([contactKeypair])
      .rpc();
  }

  /**
   * Claim funds from the vault after recovery threshold is met.
   *
   * Requires: panic triggered, recovery initiated, time-lock
   * expired, and approvals >= recovery_threshold.
   *
   * Transfers all vault SOL (minus rent) back to the owner.
   *
   * @returns Transaction signature
   */
  async claimFromVault(): Promise<string> {
    const owner = this.provider.wallet.publicKey;

    return await this.program.methods
      .claimFromVault()
      .accounts({
        owner,
        panicConfig: this.getPanicConfigPda(owner),
        vault: this.getVaultPda(owner),
      })
      .rpc();
  }

  // ──────────────────────────────────────────────────────────
  // Account queries
  // ──────────────────────────────────────────────────────────

  /** Fetch the PanicConfig for a wallet owner. Returns null if not configured. */
  async getConfig(owner: PublicKey): Promise<PanicConfig | null> {
    try {
      return await (this.program.account as any).panicConfig.fetch(
        this.getPanicConfigPda(owner)
      );
    } catch {
      return null;
    }
  }

  /** Fetch the Vault state for a wallet owner. Returns null if not initialized. */
  async getVault(owner: PublicKey): Promise<Vault | null> {
    try {
      return await (this.program.account as any).vault.fetch(
        this.getVaultPda(owner)
      );
    } catch {
      return null;
    }
  }

  /** Get the SOL balance of the vault in lamports. */
  async getVaultBalance(owner: PublicKey): Promise<number> {
    return await this.provider.connection.getBalance(this.getVaultPda(owner));
  }

  /** Fetch an AlertAccount for a specific owner + contact pair. */
  async getAlertAccount(
    owner: PublicKey,
    contact: PublicKey
  ): Promise<AlertAccount | null> {
    try {
      return await (this.program.account as any).alertAccount.fetch(
        this.getAlertPda(owner, contact)
      );
    } catch {
      return null;
    }
  }

  /** Check if an address is flagged as an attacker. */
  async getAttackerFlag(attacker: PublicKey): Promise<AttackerFlag | null> {
    try {
      return await (this.program.account as any).attackerFlag.fetch(
        this.getAttackerFlagPda(attacker)
      );
    } catch {
      return null;
    }
  }

  /** Check if a wallet is flagged as compromised. */
  async getCompromisedFlag(
    owner: PublicKey
  ): Promise<CompromisedFlag | null> {
    try {
      return await (this.program.account as any).compromisedFlag.fetch(
        this.getCompromisedFlagPda(owner)
      );
    } catch {
      return null;
    }
  }

  /**
   * Get the full protection status for a wallet in one call.
   *
   * Aggregates config, vault, balances, contact statuses,
   * and compromise flag into a single snapshot. Useful for
   * wallet UIs that need to render the full protection state.
   *
   * @param owner - Wallet address to check
   */
  async getProtectionStatus(owner: PublicKey): Promise<ProtectionStatus> {
    const config = await this.getConfig(owner);

    if (!config) {
      const walletBalance = await this.provider.connection.getBalance(owner);
      return {
        configured: false,
        config: null,
        vault: null,
        vaultBalance: 0,
        walletBalance,
        contacts: [],
        isCompromised: false,
        timeLockRemaining: 0,
      };
    }

    const [vault, vaultBalance, walletBalance, compromised] = await Promise.all(
      [
        this.getVault(owner),
        this.getVaultBalance(owner),
        this.provider.connection.getBalance(owner),
        this.getCompromisedFlag(owner),
      ]
    );

    // Fetch contact statuses in parallel
    const contactStatuses = await Promise.all(
      config.contacts.map(async (address: PublicKey) => {
        const alert = await this.getAlertAccount(owner, address);
        let status: "standby" | "alerted" | "approved" = "standby";
        if (alert) {
          status = alert.hasApproved ? "approved" : "alerted";
        }
        return { address, status };
      })
    );

    const now = Math.floor(Date.now() / 1000);
    const lockedUntil = vault ? vault.lockedUntil.toNumber() : 0;
    const timeLockRemaining = Math.max(0, lockedUntil - now);

    return {
      configured: true,
      config,
      vault,
      vaultBalance,
      walletBalance,
      contacts: contactStatuses,
      isCompromised: compromised !== null,
      timeLockRemaining,
    };
  }
}
