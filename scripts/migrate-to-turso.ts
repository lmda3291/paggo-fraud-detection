import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "data", "fraud.db");

const sqlite = new Database(DB_PATH);
const turso = createClient({
  url: "libsql://paggo-fraud-lmda3291.aws-us-east-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQ3NTI0ODUsImlkIjoiMDE5ZDM3NzctOTcwMS03ODc1LTlhZjEtYmJlMjExMjUwN2RlIiwicmlkIjoiMTQ2N2Y1MzgtYjgyNS00ZDk3LWFiMTUtZWE0MTU0NWJkN2NlIn0.TSyHF5BcdGrEN23NUSTuc6Szw9-w8uUvtf5lavL02kSySbV11e8ao-BTZdtSv4QBZnR2Sv_iRZ73_wMXc8EdCA",
});

async function migrate() {
  console.log("Creating table in Turso...");
  await turso.execute(`
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
  console.log("Table created.");

  const rows = sqlite.prepare("SELECT * FROM transactions").all() as any[];
  console.log(`Migrating ${rows.length} rows...`);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const statements = batch.map((r: any) => ({
      sql: `INSERT OR REPLACE INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        r.txId, r.timestamp, r.type, r.amount, r.nameOrig, r.nameDest,
        r.oldbalanceOrig, r.newbalanceOrig, r.oldbalanceDest, r.newbalanceDest,
        r.risk_score, r.fired_rules, r.reviewed_status,
      ],
    }));
    await turso.batch(statements);
    console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log("Migration complete!");
  sqlite.close();
}

migrate().catch(console.error);
