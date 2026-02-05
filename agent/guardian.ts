import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ScreamClient } from "../app/client";

export interface WebhookConfig {
  /** Generic webhook URL (receives JSON POST) */
  url?: string;
  /** Telegram bot token */
  telegramToken?: string;
  /** Telegram chat ID to send alerts to */
  telegramChatId?: string;
}

export interface GuardianConfig {
  walletAddress: PublicKey;
  balanceDropThreshold: number;
  rapidTxWindow: number;
  rapidTxLimit: number;
  autoTriggerPanic: boolean;
  duressPin?: string;
  attackerAddress?: PublicKey;
  pollIntervalMs: number;
  webhook?: WebhookConfig;
}

interface TxEvent {
  timestamp: number;
  balanceChange: number;
  newBalance: number;
}

export class GuardianAgent {
  private client: ScreamClient;
  private connection: Connection;
  private config: GuardianConfig;
  private lastBalance: number = 0;
  private running: boolean = false;
  private subscriptionId: number | null = null;
  private recentEvents: TxEvent[] = [];
  private startTime: number = 0;
  private alertCount: number = 0;

  constructor(
    client: ScreamClient,
    connection: Connection,
    config: GuardianConfig
  ) {
    this.client = client;
    this.connection = connection;
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
    this.startTime = Date.now();
    this.lastBalance = await this.connection.getBalance(
      this.config.walletAddress
    );

    this.printBanner();

    // Check if protection is configured
    const panicConfig = await this.client.getConfig(this.config.walletAddress);
    if (panicConfig) {
      this.log(
        "INFO",
        `Protection configured: ${panicConfig.isTriggered ? "PANIC ACTIVE" : "ARMED"}`
      );
      this.log(
        "INFO",
        `Contacts: ${panicConfig.contacts.length} | Threshold: ${panicConfig.recoveryThreshold}`
      );
      this.log(
        "INFO",
        `Time-lock: ${panicConfig.timeLockDuration.toNumber()}s | Decoy: ${(panicConfig.decoyLamports.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL`
      );
    } else {
      this.log(
        "WARN",
        "No panic protection configured for this wallet"
      );
    }

    console.log();
    this.log("INFO", "Subscribing to account changes...");

    // WebSocket subscription for real-time monitoring
    this.subscriptionId = this.connection.onAccountChange(
      this.config.walletAddress,
      async (accountInfo) => {
        await this.onBalanceChange(accountInfo.lamports);
      },
      "confirmed"
    );

    this.log("INFO", "Monitoring active. Ctrl+C to stop.\n");

    // Polling fallback (WebSocket can drop)
    while (this.running) {
      await this.poll();
      await this.sleep(this.config.pollIntervalMs);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.subscriptionId !== null) {
      await this.connection.removeAccountChangeListener(this.subscriptionId);
      this.subscriptionId = null;
    }
    this.printSummary();
  }

  private async poll(): Promise<void> {
    try {
      const balance = await this.connection.getBalance(
        this.config.walletAddress
      );
      if (balance !== this.lastBalance) {
        await this.onBalanceChange(balance);
      }
    } catch (err: any) {
      this.log("WARN", `Poll error: ${err.message}`);
    }
  }

  private async onBalanceChange(newBalance: number): Promise<void> {
    const oldBalance = this.lastBalance;
    const change = newBalance - oldBalance;

    if (change === 0) return;

    const event: TxEvent = {
      timestamp: Date.now(),
      balanceChange: change,
      newBalance,
    };
    this.recentEvents.push(event);

    // Prune old events outside the rapid-tx window
    const cutoff = Date.now() - this.config.rapidTxWindow;
    this.recentEvents = this.recentEvents.filter((e) => e.timestamp > cutoff);

    if (change < 0) {
      const dropPercent =
        oldBalance > 0 ? ((oldBalance - newBalance) / oldBalance) * 100 : 0;
      const riskScore = this.calculateRiskScore(
        dropPercent,
        Math.abs(change),
        oldBalance
      );

      this.log("ALERT", "BALANCE DROP DETECTED");
      console.log(
        `         Previous: ${this.formatSol(oldBalance)} SOL`
      );
      console.log(
        `         Current:  ${this.formatSol(newBalance)} SOL`
      );
      console.log(
        `         Change:   -${this.formatSol(Math.abs(change))} SOL (${dropPercent.toFixed(1)}% drop)`
      );
      console.log(
        `         Risk:     ${riskScore}/100 ${this.riskLabel(riskScore)}`
      );

      this.alertCount++;

      // Send webhook alert for balance drop
      await this.sendWebhookAlert({
        type: "BALANCE_DROP",
        wallet: this.config.walletAddress.toBase58(),
        riskScore,
        previousBalance: this.formatSol(oldBalance),
        currentBalance: this.formatSol(newBalance),
        change: `-${this.formatSol(Math.abs(change))}`,
        message: `${dropPercent.toFixed(1)}% balance drop detected. Risk: ${this.riskLabel(riskScore)}`,
        timestamp: new Date().toISOString(),
      });

      // Check for rapid successive transactions
      const recentOutflows = this.recentEvents.filter(
        (e) => e.balanceChange < 0
      );
      if (recentOutflows.length >= this.config.rapidTxLimit) {
        this.log(
          "ALERT",
          `RAPID OUTFLOW: ${recentOutflows.length} withdrawals in ${this.config.rapidTxWindow / 1000}s window`
        );
      }

      // Critical threshold check
      if (riskScore >= 80) {
        this.log("CRIT", "THREAT LEVEL CRITICAL");

        await this.sendWebhookAlert({
          type: "CRITICAL",
          wallet: this.config.walletAddress.toBase58(),
          riskScore,
          previousBalance: this.formatSol(oldBalance),
          currentBalance: this.formatSol(newBalance),
          change: `-${this.formatSol(Math.abs(change))}`,
          message: `THREAT LEVEL CRITICAL. ${this.config.autoTriggerPanic ? "Auto-panic initiating." : "Manual intervention required."}`,
          timestamp: new Date().toISOString(),
        });

        if (this.config.autoTriggerPanic && this.config.duressPin) {
          await this.executePanic();
        } else {
          this.log(
            "WARN",
            "Auto-panic disabled. Manual intervention required."
          );
        }
      }

      console.log();
    } else {
      this.log(
        "INFO",
        `Deposit: +${this.formatSol(change)} SOL (balance: ${this.formatSol(newBalance)} SOL)`
      );
    }

    this.lastBalance = newBalance;
  }

  private calculateRiskScore(
    dropPercent: number,
    absChange: number,
    previousBalance: number
  ): number {
    let score = 0;

    // Factor 1: Percentage of balance dropped (0-40 points)
    if (dropPercent >= this.config.balanceDropThreshold) {
      score += 40;
    } else {
      score += Math.floor(
        (dropPercent / this.config.balanceDropThreshold) * 30
      );
    }

    // Factor 2: Absolute amount (0-20 points)
    const solAmount = absChange / LAMPORTS_PER_SOL;
    if (solAmount >= 10) score += 20;
    else if (solAmount >= 1) score += 10;
    else score += 5;

    // Factor 3: Rapid successive transactions (0-25 points)
    const recentOutflows = this.recentEvents.filter(
      (e) => e.balanceChange < 0
    );
    if (recentOutflows.length >= this.config.rapidTxLimit) {
      score += 25;
    } else if (recentOutflows.length >= 2) {
      score += 15;
    }

    // Factor 4: Near-total drain (0-15 points)
    const remainingPercent =
      previousBalance > 0
        ? ((previousBalance - absChange) / previousBalance) * 100
        : 0;
    if (remainingPercent < 5) {
      score += 15;
    } else if (remainingPercent < 20) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private async executePanic(): Promise<void> {
    console.log();
    this.log("EXEC", "=== AUTO-PANIC CASCADE INITIATED ===");

    try {
      const config = await this.client.getConfig(this.config.walletAddress);
      if (!config) {
        this.log("ERROR", "No panic config found for wallet. Cannot trigger.");
        return;
      }
      if (config.isTriggered) {
        this.log("INFO", "Panic already triggered. Skipping.");
        return;
      }

      const attackerAddress =
        this.config.attackerAddress || PublicKey.default;

      const tx = await this.client.triggerPanic(
        this.config.duressPin!,
        attackerAddress,
        config.contacts
      );

      this.log("EXEC", "CASCADE COMPLETE");
      console.log(`         TX: ${tx}`);
      console.log("         - Funds moved to time-locked vault");
      console.log(
        `         - ${config.contacts.length} emergency contacts alerted`
      );
      console.log("         - Wallet flagged as compromised");
      console.log("         - Attacker address flagged");
      this.log("EXEC", "=== CASCADE COMPLETE ===\n");

      await this.sendWebhookAlert({
        type: "PANIC_EXECUTED",
        wallet: this.config.walletAddress.toBase58(),
        message: `Panic cascade executed. TX: ${tx}. Funds locked, ${config.contacts.length} contacts alerted, attacker flagged.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.log("ERROR", `Panic execution failed: ${err.message}`);
    }
  }

  private printBanner(): void {
    console.log();
    console.log(
      "  ============================================"
    );
    console.log(
      "   SCREAM GUARDIAN AGENT"
    );
    console.log(
      "   Autonomous Wallet Protection"
    );
    console.log(
      "  ============================================"
    );
    console.log(
      `   Wallet:     ${this.config.walletAddress.toBase58()}`
    );
    console.log(
      `   Balance:    ${this.formatSol(this.lastBalance)} SOL`
    );
    console.log(
      `   Threshold:  ${this.config.balanceDropThreshold}% balance drop`
    );
    console.log(
      `   Rapid TX:   ${this.config.rapidTxLimit} outflows in ${this.config.rapidTxWindow / 1000}s`
    );
    console.log(
      `   Auto-panic: ${this.config.autoTriggerPanic ? "ENABLED" : "disabled"}`
    );
    console.log(
      `   Poll:       ${this.config.pollIntervalMs / 1000}s`
    );
    if (this.config.webhook?.url) {
      console.log(
        `   Webhook:    ${this.config.webhook.url}`
      );
    }
    if (this.config.webhook?.telegramToken) {
      console.log(
        `   Telegram:   chat ${this.config.webhook.telegramChatId}`
      );
    }
    console.log(
      "  ============================================"
    );
    console.log();
  }

  private printSummary(): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    console.log();
    console.log("  --- Guardian Agent Session Summary ---");
    console.log(`   Uptime:  ${uptime}s`);
    console.log(`   Alerts:  ${this.alertCount}`);
    console.log(`   Events:  ${this.recentEvents.length}`);
    console.log("  -------------------------------------\n");
  }

  private riskLabel(score: number): string {
    if (score >= 80) return "[CRITICAL]";
    if (score >= 60) return "[HIGH]";
    if (score >= 40) return "[MEDIUM]";
    if (score >= 20) return "[LOW]";
    return "[MINIMAL]";
  }

  private formatSol(lamports: number): string {
    return (lamports / LAMPORTS_PER_SOL).toFixed(4);
  }

  private log(level: string, msg: string): void {
    const ts = new Date().toISOString().slice(11, 23);
    const pad = level.length < 5 ? " ".repeat(5 - level.length) : "";
    console.log(`  [${ts}] ${level}${pad} ${msg}`);
  }

  private async sendWebhookAlert(event: {
    type: string;
    wallet: string;
    riskScore?: number;
    previousBalance?: string;
    currentBalance?: string;
    change?: string;
    message: string;
    timestamp: string;
  }): Promise<void> {
    const webhook = this.config.webhook;
    if (!webhook) return;

    // Send to generic webhook URL
    if (webhook.url) {
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
        if (!res.ok) {
          this.log("WARN", `Webhook POST failed: ${res.status}`);
        }
      } catch (err: any) {
        this.log("WARN", `Webhook error: ${err.message}`);
      }
    }

    // Send to Telegram
    if (webhook.telegramToken && webhook.telegramChatId) {
      try {
        const icon = event.type === "CRITICAL" ? "\u{1F6A8}" :
                     event.type === "PANIC_EXECUTED" ? "\u{2620}\u{FE0F}" :
                     event.type === "BALANCE_DROP" ? "\u{26A0}\u{FE0F}" : "\u{1F514}";
        const text = [
          `${icon} *SCREAM Guardian Alert*`,
          ``,
          `*${event.type}*`,
          `Wallet: \`${event.wallet}\``,
          event.riskScore !== undefined ? `Risk: ${event.riskScore}/100` : null,
          event.previousBalance ? `Previous: ${event.previousBalance} SOL` : null,
          event.currentBalance ? `Current: ${event.currentBalance} SOL` : null,
          event.change ? `Change: ${event.change} SOL` : null,
          ``,
          event.message,
          ``,
          `_${event.timestamp}_`,
        ].filter(Boolean).join("\n");

        const url = `https://api.telegram.org/bot${webhook.telegramToken}/sendMessage`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: webhook.telegramChatId,
            text,
            parse_mode: "Markdown",
          }),
        });
        if (!res.ok) {
          this.log("WARN", `Telegram alert failed: ${res.status}`);
        }
      } catch (err: any) {
        this.log("WARN", `Telegram error: ${err.message}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
