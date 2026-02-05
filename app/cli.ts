import { Command } from "commander";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { ScreamClient, loadProvider } from "./client";
import * as fs from "fs";

const log = {
  info: (msg: string) => console.log(`  ${msg}`),
  header: (msg: string) => console.log(`\n[SCREAM] ${msg}`),
  success: (msg: string) => console.log(`  + ${msg}`),
  error: (msg: string) => console.error(`  ! ${msg}`),
  divider: () => console.log("  " + "-".repeat(50)),
  tx: (sig: string) =>
    console.log(`  TX: ${sig}`),
  explorer: (sig: string) =>
    console.log(
      `  https://explorer.solana.com/tx/${sig}?cluster=devnet`
    ),
};

function getClient(): ScreamClient {
  const provider = loadProvider();
  return new ScreamClient(provider);
}

function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const program = new Command();
program
  .name("scream")
  .description("SCREAM - Solana Crypto Response Emergency Action Manager")
  .version("0.1.0");

// --- init ---
program
  .command("init")
  .description("Initialize panic protection for your wallet")
  .requiredOption("--pin <pin>", "Duress PIN (will be hashed, never stored)")
  .requiredOption(
    "--contacts <addresses>",
    "Comma-separated emergency contact wallet addresses"
  )
  .option("--threshold <n>", "Recovery approval threshold (M-of-N)", "2")
  .option("--timelock <seconds>", "Time-lock duration in seconds", "86400")
  .option("--decoy <sol>", "Decoy SOL amount sent to attacker", "0.1")
  .action(async (opts) => {
    try {
      const client = getClient();
      const contacts = opts.contacts
        .split(",")
        .map((a: string) => new PublicKey(a.trim()));
      const threshold = parseInt(opts.threshold);
      const timelock = parseInt(opts.timelock);
      const decoy = Math.floor(parseFloat(opts.decoy) * LAMPORTS_PER_SOL);

      log.header("Initializing Panic Protection");
      log.divider();
      log.info(
        `Wallet:    ${client.provider.wallet.publicKey.toBase58()}`
      );
      log.info(`Contacts:  ${contacts.length}`);
      contacts.forEach((c: PublicKey, i: number) =>
        log.info(`  [${i + 1}] ${c.toBase58()}`)
      );
      log.info(`Threshold: ${threshold}-of-${contacts.length}`);
      log.info(`Time-lock: ${formatTime(timelock)} (${timelock}s)`);
      log.info(`Decoy:     ${opts.decoy} SOL`);
      log.divider();

      const tx = await client.initializeConfig({
        pin: opts.pin,
        contacts,
        recoveryThreshold: threshold,
        timeLockDuration: timelock,
        decoyLamports: decoy,
      });

      log.success("Protection ACTIVE");
      log.tx(tx);
      log.explorer(tx);
      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- deposit ---
program
  .command("deposit")
  .description("Deposit SOL to your protection vault")
  .requiredOption("--amount <sol>", "Amount in SOL")
  .action(async (opts) => {
    try {
      const client = getClient();
      const amount = Math.floor(parseFloat(opts.amount) * LAMPORTS_PER_SOL);

      log.header("Depositing to Vault");
      log.info(`Amount: ${opts.amount} SOL`);

      const tx = await client.deposit(amount);

      const balance = await client.getVaultBalance(
        client.provider.wallet.publicKey
      );
      log.success(`Deposited. Vault balance: ${formatSol(balance)} SOL`);
      log.tx(tx);
      log.explorer(tx);
      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- panic ---
program
  .command("panic")
  .description("TRIGGER PANIC CASCADE (duress activation)")
  .requiredOption("--pin <pin>", "Duress PIN")
  .requiredOption("--attacker <address>", "Attacker wallet address")
  .action(async (opts) => {
    try {
      const client = getClient();
      const owner = client.provider.wallet.publicKey;
      const attackerAddress = new PublicKey(opts.attacker);

      const config = await client.getConfig(owner);
      if (!config) {
        log.error("No panic config found. Run 'scream init' first.");
        process.exit(1);
      }

      log.header("PANIC CASCADE TRIGGERED");
      log.divider();

      const tx = await client.triggerPanic(
        opts.pin,
        attackerAddress,
        config.contacts
      );

      const vaultBalance = await client.getVaultBalance(owner);

      log.success("Funds moved to time-locked vault");
      log.success(`Vault balance: ${formatSol(vaultBalance)} SOL`);
      log.success("Emergency contacts alerted");
      log.success("Wallet flagged as compromised");
      log.success(`Attacker ${opts.attacker} flagged`);
      log.success(
        `Decoy sent: ${formatSol(config.decoyLamports.toNumber())} SOL`
      );
      log.divider();
      log.tx(tx);
      log.explorer(tx);
      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- recover ---
program
  .command("recover")
  .description("Initiate fund recovery (after time-lock expires)")
  .action(async () => {
    try {
      const client = getClient();

      log.header("Initiating Recovery");

      const tx = await client.initiateRecovery();

      log.success("Recovery initiated. Awaiting contact approvals.");
      log.tx(tx);
      log.explorer(tx);
      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- approve ---
program
  .command("approve")
  .description("Approve recovery as an emergency contact")
  .requiredOption("--owner <address>", "Wallet owner address to approve for")
  .requiredOption(
    "--keypair <path>",
    "Path to contact's keypair JSON file"
  )
  .action(async (opts) => {
    try {
      const client = getClient();
      const ownerAddress = new PublicKey(opts.owner);
      const keypairData = JSON.parse(fs.readFileSync(opts.keypair, "utf8"));
      const contactKeypair = Keypair.fromSecretKey(
        Uint8Array.from(keypairData)
      );

      log.header("Approving Recovery");
      log.info(`Owner:   ${ownerAddress.toBase58()}`);
      log.info(`Contact: ${contactKeypair.publicKey.toBase58()}`);

      const tx = await client.approveRecovery(ownerAddress, contactKeypair);

      const vault = await client.getVault(ownerAddress);
      const config = await client.getConfig(ownerAddress);

      log.success(
        `Approved (${vault.approvals}/${config.recoveryThreshold} needed)`
      );
      log.tx(tx);
      log.explorer(tx);
      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- claim ---
program
  .command("claim")
  .description("Claim funds from vault after recovery threshold met")
  .action(async () => {
    try {
      const client = getClient();
      const owner = client.provider.wallet.publicKey;

      const vaultBefore = await client.getVaultBalance(owner);

      log.header("Claiming Funds from Vault");
      log.info(`Vault balance: ${formatSol(vaultBefore)} SOL`);

      const tx = await client.claimFromVault();

      log.success(`Recovered ${formatSol(vaultBefore)} SOL`);
      log.tx(tx);
      log.explorer(tx);
      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- status ---
program
  .command("status")
  .description("View protection status for a wallet")
  .option(
    "--owner <address>",
    "Wallet address (defaults to your wallet)"
  )
  .action(async (opts) => {
    try {
      const client = getClient();
      const owner = opts.owner
        ? new PublicKey(opts.owner)
        : client.provider.wallet.publicKey;

      log.header("Protection Status");
      log.divider();
      log.info(`Wallet: ${owner.toBase58()}`);

      const config = await client.getConfig(owner);
      if (!config) {
        log.info("Status: NOT CONFIGURED");
        log.info("Run 'scream init' to set up protection.");
        console.log();
        return;
      }

      const vault = await client.getVault(owner);
      const vaultBalance = await client.getVaultBalance(owner);
      const walletBalance = await client.provider.connection.getBalance(owner);

      log.divider();
      log.info(`Status:      ${config.isTriggered ? "PANIC TRIGGERED" : "ARMED"}`);
      log.info(`Wallet SOL:  ${formatSol(walletBalance)}`);
      log.info(`Vault SOL:   ${formatSol(vaultBalance)}`);
      log.info(
        `Time-lock:   ${formatTime(config.timeLockDuration.toNumber())}`
      );
      log.info(
        `Threshold:   ${config.recoveryThreshold}-of-${config.contacts.length}`
      );
      log.info(`Decoy:       ${formatSol(config.decoyLamports.toNumber())} SOL`);
      log.divider();

      log.info("Contacts:");
      for (let i = 0; i < config.contacts.length; i++) {
        const contact = config.contacts[i];
        const alert = await client.getAlertAccount(owner, contact);
        const status = alert
          ? alert.hasApproved
            ? "APPROVED"
            : "ALERTED"
          : "standby";
        log.info(`  [${i + 1}] ${contact.toBase58()} (${status})`);
      }

      if (vault && config.isTriggered) {
        log.divider();
        const now = Math.floor(Date.now() / 1000);
        const lockedUntil = vault.lockedUntil.toNumber();
        const remaining = lockedUntil - now;

        log.info(
          `Time-lock:   ${remaining > 0 ? `${formatTime(remaining)} remaining` : "EXPIRED"}`
        );
        log.info(
          `Recovery:    ${vault.recoveryInitiated ? "INITIATED" : "not started"}`
        );
        log.info(
          `Approvals:   ${vault.approvals}/${config.recoveryThreshold}`
        );
      }

      // Check compromised flag
      const compromised = await client.getCompromisedFlag(owner);
      if (compromised) {
        log.divider();
        log.info(
          `COMPROMISED: flagged at ${new Date(compromised.flaggedAt.toNumber() * 1000).toISOString()}`
        );
      }

      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

// --- check-attacker ---
program
  .command("check-attacker")
  .description("Check if an address is flagged as an attacker")
  .requiredOption("--address <address>", "Address to check")
  .action(async (opts) => {
    try {
      const client = getClient();
      const address = new PublicKey(opts.address);

      const flag = await client.getAttackerFlag(address);

      log.header("Attacker Check");
      log.info(`Address: ${address.toBase58()}`);

      if (flag) {
        log.info("STATUS: FLAGGED AS ATTACKER");
        log.info(`Reported by: ${flag.reportedBy.toBase58()}`);
        log.info(
          `Flagged at:  ${new Date(flag.flaggedAt.toNumber() * 1000).toISOString()}`
        );
      } else {
        log.info("STATUS: Clean (no flags)");
      }

      console.log();
    } catch (err: any) {
      log.error(err.message);
      process.exit(1);
    }
  });

program.parse();
