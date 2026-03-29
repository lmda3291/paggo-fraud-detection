// Data pipeline: CSV → parse → compute fraud signals → insert with risk scores.
//
// Risk scores are pre-computed at seed time rather than computed at query time.
// This is a deliberate trade-off: reads are instant (no per-request rule evaluation),
// every API consumer sees consistent scores, and the scoring logic is versioned with
// the seed script. The cost — re-seeding to update rules — is acceptable because
// rule changes in compliance are deliberate, audited events, not hot-path operations.
//
// The pipeline first computes per-type statistical distributions (μ, σ) across the
// entire dataset, then evaluates each transaction against all 5 rules using those
// distributions. This two-pass approach ensures the anomalous amount rule has
// accurate baselines before scoring begins.

import fs from "fs";
import path from "path";
import Papa from "papaparse";
import Database from "better-sqlite3";
import {
  Transaction,
  analyzeTransaction,
  computeTypeStats,
} from "../lib/fraud-rules";

const DB_PATH = path.join(__dirname, "..", "data", "fraud.db");
const CSV_PATH = path.join(__dirname, "..", "data", "transactions.csv");

// Remove existing DB so we start fresh
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log("Removed existing fraud.db");
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    txId TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    nameOrig TEXT NOT NULL,
    nameDest TEXT NOT NULL,
    oldbalanceOrig REAL NOT NULL,
    newbalanceOrig REAL NOT NULL,
    oldbalanceDest REAL NOT NULL,
    newbalanceDest REAL NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    fired_rules TEXT NOT NULL DEFAULT '[]',
    reviewed_status TEXT DEFAULT NULL
  )
`);

console.log("Created transactions table");

// Read CSV
const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
const parsed = Papa.parse<Record<string, string>>(csvContent, {
  header: true,
  skipEmptyLines: true,
});

if (parsed.errors.length > 0) {
  console.warn("CSV parse warnings:", parsed.errors.slice(0, 5));
}

const transactions: Transaction[] = parsed.data.map((row) => ({
  txId: row.txId,
  timestamp: row.timestamp,
  type: row.type,
  amount: parseFloat(row.amount),
  nameOrig: row.nameOrig,
  nameDest: row.nameDest,
  oldbalanceOrig: parseFloat(row.oldbalanceOrig),
  newbalanceOrig: parseFloat(row.newbalanceOrig),
  oldbalanceDest: parseFloat(row.oldbalanceDest),
  newbalanceDest: parseFloat(row.newbalanceDest),
}));

console.log(`Parsed ${transactions.length} transactions from CSV`);

// Compute stats for anomalous amount rule
const stats = computeTypeStats(transactions);
console.log("\nType statistics:");
for (const [type, s] of Object.entries(stats)) {
  console.log(`  ${type}: mean=${s.mean.toFixed(2)}, std=${s.std.toFixed(2)}`);
}

// Analyze and insert
const insert = db.prepare(`
  INSERT INTO transactions (
    txId, timestamp, type, amount, nameOrig, nameDest,
    oldbalanceOrig, newbalanceOrig, oldbalanceDest, newbalanceDest,
    risk_score, fired_rules, reviewed_status
  ) VALUES (
    @txId, @timestamp, @type, @amount, @nameOrig, @nameDest,
    @oldbalanceOrig, @newbalanceOrig, @oldbalanceDest, @newbalanceDest,
    @risk_score, @fired_rules, NULL
  )
`);

const insertAll = db.transaction((txs: Transaction[]) => {
  let flaggedCount = 0;
  let totalRisk = 0;
  const ruleCounts: Record<string, number> = {};

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const analysis = analyzeTransaction(tx, stats, txs);

    insert.run({
      ...tx,
      risk_score: analysis.riskScore,
      fired_rules: JSON.stringify(analysis.firedRules),
    });

    totalRisk += analysis.riskScore;
    if (analysis.riskScore > 0) flaggedCount++;

    for (const r of analysis.firedRules) {
      ruleCounts[r.rule] = (ruleCounts[r.rule] || 0) + 1;
    }

    if ((i + 1) % 2000 === 0) {
      console.log(`  Inserted ${i + 1}/${txs.length} transactions...`);
    }
  }

  return { flaggedCount, totalRisk, ruleCounts };
});

console.log("\nInserting transactions...");
const { flaggedCount, totalRisk, ruleCounts } = insertAll(transactions);

console.log("\n========== SEED SUMMARY ==========");
console.log(`Total transactions: ${transactions.length}`);
console.log(`Flagged (risk > 0):  ${flaggedCount} (${((flaggedCount / transactions.length) * 100).toFixed(1)}%)`);
console.log(`Average risk score:  ${(totalRisk / transactions.length).toFixed(2)}`);
console.log("\nRule trigger counts:");
for (const [rule, count] of Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${rule}: ${count}`);
}
console.log("===================================");
console.log(`\nDatabase saved to ${DB_PATH}`);

db.close();
