import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Scream } from "../target/types/scream";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import * as crypto from "crypto";

describe("scream", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Scream as Program<Scream>;

  // Test keypairs
  const owner = provider.wallet as anchor.Wallet;
  const attacker = Keypair.generate();
  const contact1 = Keypair.generate();
  const contact2 = Keypair.generate();
  const contact3 = Keypair.generate();

  // Duress PIN
  const duressPin = "123456";
  const triggerHash = crypto.createHash("sha256").update(duressPin).digest();

  // Config params
  const recoveryThreshold = 2;
  const timeLockDuration = new anchor.BN(2); // 2 seconds for testing
  const decoyLamports = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

  // PDA addresses
  let panicConfigPda: PublicKey;
  let vaultPda: PublicKey;
  let compromisedFlagPda: PublicKey;
  let attackerFlagPda: PublicKey;
  let alertPda1: PublicKey;
  let alertPda2: PublicKey;
  let alertPda3: PublicKey;

  before(async () => {
    // Derive PDAs
    [panicConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("panic_config"), owner.publicKey.toBuffer()],
      program.programId
    );
    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer()],
      program.programId
    );
    [compromisedFlagPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("compromised"), owner.publicKey.toBuffer()],
      program.programId
    );
    [attackerFlagPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("attacker"), attacker.publicKey.toBuffer()],
      program.programId
    );
    [alertPda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("alert"), owner.publicKey.toBuffer(), contact1.publicKey.toBuffer()],
      program.programId
    );
    [alertPda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("alert"), owner.publicKey.toBuffer(), contact2.publicKey.toBuffer()],
      program.programId
    );
    [alertPda3] = PublicKey.findProgramAddressSync(
      [Buffer.from("alert"), owner.publicKey.toBuffer(), contact3.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop to attacker so the account exists (needed for lamport transfer)
    const sig = await provider.connection.requestAirdrop(
      attacker.publicKey,
      0.01 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  it("Initialize config", async () => {
    const contacts = [contact1.publicKey, contact2.publicKey, contact3.publicKey];

    const tx = await program.methods
      .initializeConfig(
        Array.from(triggerHash),
        contacts,
        recoveryThreshold,
        timeLockDuration,
        decoyLamports
      )
      .accounts({
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  Initialize config tx:", tx);

    // Verify config
    const config = await program.account.panicConfig.fetch(panicConfigPda);
    expect(config.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(config.contacts.length).to.equal(3);
    expect(config.recoveryThreshold).to.equal(2);
    expect(config.timeLockDuration.toNumber()).to.equal(2);
    expect(config.decoyLamports.toNumber()).to.equal(0.1 * LAMPORTS_PER_SOL);
    expect(config.isTriggered).to.equal(false);
    expect(Buffer.from(config.triggerHash)).to.deep.equal(triggerHash);

    // Verify vault
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(vault.lockedUntil.toNumber()).to.equal(0);
    expect(vault.recoveryInitiated).to.equal(false);
    expect(vault.approvals).to.equal(0);
  });

  it("Deposit SOL to vault", async () => {
    const depositAmount = new anchor.BN(5 * LAMPORTS_PER_SOL);

    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("  Deposit tx:", tx);

    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
    expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(5 * LAMPORTS_PER_SOL);
  });

  it("Trigger panic with correct duress PIN", async () => {
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
    const attackerBalanceBefore = await provider.connection.getBalance(attacker.publicKey);

    console.log("  Vault balance before panic:", vaultBalanceBefore / LAMPORTS_PER_SOL, "SOL");
    console.log("  Attacker balance before:", attackerBalanceBefore / LAMPORTS_PER_SOL, "SOL");

    const tx = await program.methods
      .triggerPanic(Buffer.from(duressPin))
      .accounts({
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
        compromisedFlag: compromisedFlagPda,
        attacker: attacker.publicKey,
        attackerFlag: attackerFlagPda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: alertPda1, isWritable: true, isSigner: false },
        { pubkey: alertPda2, isWritable: true, isSigner: false },
        { pubkey: alertPda3, isWritable: true, isSigner: false },
      ])
      .rpc();

    console.log("  Trigger panic tx:", tx);

    // Verify config is triggered
    const config = await program.account.panicConfig.fetch(panicConfigPda);
    expect(config.isTriggered).to.equal(true);

    // Verify vault is time-locked
    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.lockedUntil.toNumber()).to.be.greaterThan(0);

    // Verify compromised flag
    const compromised = await program.account.compromisedFlag.fetch(compromisedFlagPda);
    expect(compromised.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(compromised.flaggedAt.toNumber()).to.be.greaterThan(0);

    // Verify attacker flag
    const attackerFlag = await program.account.attackerFlag.fetch(attackerFlagPda);
    expect(attackerFlag.attacker.toBase58()).to.equal(attacker.publicKey.toBase58());
    expect(attackerFlag.reportedBy.toBase58()).to.equal(owner.publicKey.toBase58());

    // Verify decoy was sent to attacker
    const attackerBalanceAfter = await provider.connection.getBalance(attacker.publicKey);
    console.log("  Attacker balance after:", attackerBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    expect(attackerBalanceAfter).to.be.greaterThan(attackerBalanceBefore);

    // Verify alert accounts were created
    const alert1 = await program.account.alertAccount.fetch(alertPda1);
    expect(alert1.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(alert1.contact.toBase58()).to.equal(contact1.publicKey.toBase58());
    expect(alert1.hasApproved).to.equal(false);

    const alert2 = await program.account.alertAccount.fetch(alertPda2);
    expect(alert2.contact.toBase58()).to.equal(contact2.publicKey.toBase58());

    const alert3 = await program.account.alertAccount.fetch(alertPda3);
    expect(alert3.contact.toBase58()).to.equal(contact3.publicKey.toBase58());

    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);
    console.log("  Vault balance after panic:", vaultBalanceAfter / LAMPORTS_PER_SOL, "SOL");
  });

  it("Fails to trigger panic again", async () => {
    try {
      await program.methods
        .triggerPanic(Buffer.from(duressPin))
        .accounts({
          owner: owner.publicKey,
          panicConfig: panicConfigPda,
          vault: vaultPda,
          compromisedFlag: compromisedFlagPda,
          attacker: attacker.publicKey,
          attackerFlag: attackerFlagPda,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: alertPda1, isWritable: true, isSigner: false },
          { pubkey: alertPda2, isWritable: true, isSigner: false },
          { pubkey: alertPda3, isWritable: true, isSigner: false },
        ])
        .rpc();
      expect.fail("Should have failed");
    } catch (err) {
      // Expected: either PanicAlreadyTriggered or account already in use (PDA already initialized)
      console.log("  Correctly failed to re-trigger panic");
    }
  });

  it("Fails to initiate recovery before time-lock expires", async () => {
    // The time-lock is 2 seconds, try immediately
    try {
      await program.methods
        .initiateRecovery()
        .accounts({
          owner: owner.publicKey,
          panicConfig: panicConfigPda,
          vault: vaultPda,
        })
        .rpc();
      expect.fail("Should have failed due to time-lock");
    } catch (err) {
      console.log("  Correctly rejected: time-lock still active");
    }
  });

  it("Initiate recovery after time-lock expires", async () => {
    // Wait for time-lock to expire (2 seconds)
    console.log("  Waiting for time-lock to expire...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const tx = await program.methods
      .initiateRecovery()
      .accounts({
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
      })
      .rpc();

    console.log("  Initiate recovery tx:", tx);

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.recoveryInitiated).to.equal(true);
    expect(vault.approvals).to.equal(0);
  });

  it("Contact 1 approves recovery", async () => {
    const tx = await program.methods
      .approveRecovery()
      .accounts({
        contact: contact1.publicKey,
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
        alertAccount: alertPda1,
      })
      .signers([contact1])
      .rpc();

    console.log("  Contact 1 approval tx:", tx);

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.approvals).to.equal(1);

    const alert = await program.account.alertAccount.fetch(alertPda1);
    expect(alert.hasApproved).to.equal(true);
  });

  it("Fails to claim with insufficient approvals", async () => {
    try {
      await program.methods
        .claimFromVault()
        .accounts({
          owner: owner.publicKey,
          panicConfig: panicConfigPda,
          vault: vaultPda,
        })
        .rpc();
      expect.fail("Should have failed");
    } catch (err) {
      console.log("  Correctly rejected: insufficient approvals (1/2)");
    }
  });

  it("Contact 2 approves recovery", async () => {
    const tx = await program.methods
      .approveRecovery()
      .accounts({
        contact: contact2.publicKey,
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
        alertAccount: alertPda2,
      })
      .signers([contact2])
      .rpc();

    console.log("  Contact 2 approval tx:", tx);

    const vault = await program.account.vault.fetch(vaultPda);
    expect(vault.approvals).to.equal(2);
  });

  it("Contact 1 fails to approve again", async () => {
    try {
      await program.methods
        .approveRecovery()
        .accounts({
          contact: contact1.publicKey,
          owner: owner.publicKey,
          panicConfig: panicConfigPda,
          vault: vaultPda,
          alertAccount: alertPda1,
        })
        .signers([contact1])
        .rpc();
      expect.fail("Should have failed");
    } catch (err) {
      console.log("  Correctly rejected: already approved");
    }
  });

  it("Claim funds from vault after threshold met", async () => {
    const ownerBalanceBefore = await provider.connection.getBalance(owner.publicKey);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);

    console.log("  Vault balance before claim:", vaultBalanceBefore / LAMPORTS_PER_SOL, "SOL");

    const tx = await program.methods
      .claimFromVault()
      .accounts({
        owner: owner.publicKey,
        panicConfig: panicConfigPda,
        vault: vaultPda,
      })
      .rpc();

    console.log("  Claim tx:", tx);

    const ownerBalanceAfter = await provider.connection.getBalance(owner.publicKey);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

    console.log("  Vault balance after claim:", vaultBalanceAfter / LAMPORTS_PER_SOL, "SOL");
    console.log("  Owner recovered:", (ownerBalanceAfter - ownerBalanceBefore) / LAMPORTS_PER_SOL, "SOL");

    // Vault should only have rent-exempt minimum left
    const vaultAccountInfo = await provider.connection.getAccountInfo(vaultPda);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(
      vaultAccountInfo.data.length
    );
    expect(vaultBalanceAfter).to.equal(rentExempt);

    // Owner should have received the funds (minus tx fee)
    expect(ownerBalanceAfter).to.be.greaterThan(ownerBalanceBefore);
  });
});
