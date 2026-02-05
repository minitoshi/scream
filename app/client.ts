import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";

export const PROGRAM_ID = new PublicKey(
  "5zPdLCuRqcPqN5TZxR6yUcfTJ9ufLhoZAMVn6pEFXnyc"
);

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

export class ScreamClient {
  program: Program;
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

  // --- PDA derivation ---

  getPanicConfigPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("panic_config"), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  getVaultPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  getAlertPda(owner: PublicKey, contact: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("alert"), owner.toBuffer(), contact.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  getAttackerFlagPda(attacker: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attacker"), attacker.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  getCompromisedFlagPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("compromised"), owner.toBuffer()],
      this.program.programId
    );
    return pda;
  }

  // --- Helpers ---

  hashPin(pin: string): number[] {
    return Array.from(crypto.createHash("sha256").update(pin).digest());
  }

  // --- Instructions ---

  async initializeConfig(params: {
    pin: string;
    contacts: PublicKey[];
    recoveryThreshold: number;
    timeLockDuration: number;
    decoyLamports: number;
  }): Promise<string> {
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

  // --- Account fetching ---

  private get accounts(): any {
    return this.program.account;
  }

  async getConfig(owner: PublicKey): Promise<any | null> {
    try {
      return await this.accounts.panicConfig.fetch(
        this.getPanicConfigPda(owner)
      );
    } catch {
      return null;
    }
  }

  async getVault(owner: PublicKey): Promise<any | null> {
    try {
      return await this.accounts.vault.fetch(this.getVaultPda(owner));
    } catch {
      return null;
    }
  }

  async getVaultBalance(owner: PublicKey): Promise<number> {
    return await this.provider.connection.getBalance(this.getVaultPda(owner));
  }

  async getAlertAccount(
    owner: PublicKey,
    contact: PublicKey
  ): Promise<any | null> {
    try {
      return await this.accounts.alertAccount.fetch(
        this.getAlertPda(owner, contact)
      );
    } catch {
      return null;
    }
  }

  async getAttackerFlag(attacker: PublicKey): Promise<any | null> {
    try {
      return await this.accounts.attackerFlag.fetch(
        this.getAttackerFlagPda(attacker)
      );
    } catch {
      return null;
    }
  }

  async getCompromisedFlag(owner: PublicKey): Promise<any | null> {
    try {
      return await this.accounts.compromisedFlag.fetch(
        this.getCompromisedFlagPda(owner)
      );
    } catch {
      return null;
    }
  }
}
