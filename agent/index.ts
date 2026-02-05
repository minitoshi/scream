import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { ScreamClient, loadProvider } from "../app/client";
import { GuardianAgent, GuardianConfig } from "./guardian";

const program = new Command();
program
  .name("scream-agent")
  .description("SCREAM Guardian Agent - Autonomous wallet protection")
  .version("0.1.0")
  .requiredOption("--wallet <address>", "Wallet address to monitor")
  .option(
    "--threshold <percent>",
    "Balance drop % to trigger critical alert",
    "50"
  )
  .option(
    "--rapid-window <ms>",
    "Time window for rapid transaction detection (ms)",
    "60000"
  )
  .option(
    "--rapid-limit <n>",
    "Number of outflows in window to flag as rapid",
    "3"
  )
  .option(
    "--auto-panic",
    "Automatically trigger panic on critical threat",
    false
  )
  .option("--pin <pin>", "Duress PIN (required with --auto-panic)")
  .option("--attacker <address>", "Default attacker address for auto-panic")
  .option("--poll <ms>", "Polling interval in milliseconds", "5000")
  .action(async (opts) => {
    if (opts.autoPanic && !opts.pin) {
      console.error(
        "ERROR: --pin is required when --auto-panic is enabled"
      );
      process.exit(1);
    }

    const provider = loadProvider();
    const client = new ScreamClient(provider);

    const config: GuardianConfig = {
      walletAddress: new PublicKey(opts.wallet),
      balanceDropThreshold: parseInt(opts.threshold),
      rapidTxWindow: parseInt(opts.rapidWindow),
      rapidTxLimit: parseInt(opts.rapidLimit),
      autoTriggerPanic: opts.autoPanic || false,
      duressPin: opts.pin,
      attackerAddress: opts.attacker
        ? new PublicKey(opts.attacker)
        : undefined,
      pollIntervalMs: parseInt(opts.poll),
    };

    const agent = new GuardianAgent(client, provider.connection, config);

    process.on("SIGINT", async () => {
      console.log("\n  Shutting down Guardian Agent...");
      await agent.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await agent.stop();
      process.exit(0);
    });

    await agent.start();
  });

program.parse();
