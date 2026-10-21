// Durable state of the paywall, in SQLite (node:sqlite): the orders it issued, and the consumption keys of
// the proofs it has accepted. A file-backed database survives a restart; ":memory:" is for tests.
// The claim is one transaction: of two concurrent presentations exactly one succeeds
// (draft-taler-charge-03, "Single-use claim").
import { DatabaseSync } from "node:sqlite";

export interface IssuedRecord {
  orderId: string;
  resource: string;
  /** The order amount as a Taler amount string, e.g. "KUDOS:0.1". */
  amount: string;
  baseUnits: string;
  /** Currency code as written in the Taler amount (verbatim). */
  currency: string;
  summary: string;
  talerPayUri: string;
  merchantBaseUrl: string;
  /** The fulfillment_url as sent to the merchant, with the ${ORDER_ID} placeholder. */
  fulfillmentTemplate: string;
  exchanges: { url: string; masterPub: string }[];
  payDeadlineMs: number;
  refundDeadlineMs: number;
}

export type ClaimResult = "ok" | "duplicate" | "unknown";

export class Store {
  private readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout = 5000");
    if (path !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS issued (
        order_id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        redeemed INTEGER NOT NULL DEFAULT 0,
        retain_until_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS consumed (
        key TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        retain_until_ms INTEGER NOT NULL
      );
    `);
  }

  /** The retention bound: the later of the pay deadline and the refund deadline. */
  static retainUntil(r: Pick<IssuedRecord, "payDeadlineMs" | "refundDeadlineMs">): number {
    return Math.max(r.payDeadlineMs, r.refundDeadlineMs);
  }

  putIssued(r: IssuedRecord): void {
    this.db.prepare("INSERT INTO issued (order_id, json, redeemed, retain_until_ms) VALUES (?, ?, 0, ?)").run(r.orderId, JSON.stringify(r), Store.retainUntil(r));
  }

  getIssued(orderId: string): (IssuedRecord & { redeemed: boolean }) | undefined {
    const row = this.db.prepare("SELECT json, redeemed FROM issued WHERE order_id = ?").get(orderId) as { json: string; redeemed: number } | undefined;
    return row ? { ...(JSON.parse(row.json) as IssuedRecord), redeemed: row.redeemed === 1 } : undefined;
  }

  /**
   * Atomically records `key` as consumed and marks the order redeemed. Returns "duplicate" if the key or the
   * order was already used (whichever format used it first), "unknown" if the order was never issued.
   */
  claim(orderId: string, key: string): ClaimResult {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT redeemed, retain_until_ms FROM issued WHERE order_id = ?").get(orderId) as { redeemed: number; retain_until_ms: number } | undefined;
      if (!row) { this.db.exec("ROLLBACK"); return "unknown"; }
      if (row.redeemed === 1) { this.db.exec("ROLLBACK"); return "duplicate"; }
      const ins = this.db.prepare("INSERT OR IGNORE INTO consumed (key, order_id, retain_until_ms) VALUES (?, ?, ?)").run(key, orderId, row.retain_until_ms);
      if (Number(ins.changes) === 0) { this.db.exec("ROLLBACK"); return "duplicate"; }
      this.db.prepare("UPDATE issued SET redeemed = 1 WHERE order_id = ?").run(orderId);
      this.db.exec("COMMIT");
      return "ok";
    } catch (e) {
      try { this.db.exec("ROLLBACK"); } catch { /* already rolled back */ }
      throw e;
    }
  }

  hasConsumed(key: string): boolean {
    return this.db.prepare("SELECT 1 AS x FROM consumed WHERE key = ?").get(key) !== undefined;
  }

  /** Forgets records whose retention bound has passed. Never removes a record that can still be presented. */
  purge(nowMs: number): number {
    const a = this.db.prepare("DELETE FROM consumed WHERE retain_until_ms < ?").run(nowMs);
    const b = this.db.prepare("DELETE FROM issued WHERE retain_until_ms < ?").run(nowMs);
    return Number(a.changes) + Number(b.changes);
  }

  close(): void {
    this.db.close();
  }
}
