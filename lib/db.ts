// SQLite — embedded, zero-ops, perfect for a single-analyst compliance tool.
// The .db file IS the deployment artifact — no Docker, no connection strings,
// no managed database. At 7,800 rows, Postgres would be resume-driven development.
//
// better-sqlite3 over the async driver (sqlite3): synchronous reads are fine for
// this workload — all queries are fast (<5ms) and Next.js API routes handle
// concurrency at the request level. Synchronous API means simpler code, no
// connection pool management, and no callback/promise overhead for reads.
// WAL mode allows concurrent reads during the rare write (review status updates).

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "fraud.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export default db;
