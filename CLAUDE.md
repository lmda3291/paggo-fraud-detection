# Paggo Fraud Detection — Claude Code Context

## Project Overview
Detection System by Paggo is a compliance investigation tool built for
Paggo's Product Engineer hiring case. It processes 7,800 synthetic bank
transactions, applies 5 fraud detection rules with additive risk scoring
(0–95 points), and provides an AI-powered analyst interface.

**Stack:** Next.js 14 (App Router) · TypeScript · Turso (libsql) ·
Anthropic Claude API (claude-sonnet-4-20250514) · Recharts · NextAuth.js ·
ExcelJS · jsPDF · Tailwind CSS

**Location:** C:\Dev\paggo-fraud-detection
**Dev server:** http://localhost:3000
**Database:** Turso (distributed SQLite, hosted on us-east-1)

---

## Architecture Decisions

### Why Turso over Postgres?
Fixed dataset of 7,800 transactions. Turso offers a familiar SQL API with persistent writes in serverless --
network latency — perfect for a read-heavy compliance dashboard.
Migration path to Turso (distributed SQLite) or Neon (serverless Postgres)
is trivial if the dataset grows.

### Why additive risk scoring?
Binary flags lose severity information. A transaction triggering 3 rules
is exponentially more suspicious than one triggering 1. Additive scoring
(0–95) lets analysts triage by severity — matching how Feedzai, Sardine,
and Unit21 present risk in production systems.

### Why Claude for AI instead of GPT-4?
Claude's instruction-following and context utilization are superior for
structured data analysis. The key insight: inject real database stats into
the system prompt (top accounts, rule breakdown, flagged count) so answers
are data-grounded, not generic. We use claude-sonnet-4-20250514 with
streaming enabled via the Anthropic SDK — this gives perceived performance
improvements since the analyst sees tokens arriving in real time rather than
waiting for the full response.

### Why server-side Excel export (ExcelJS) instead of client-side (SheetJS)?
SheetJS free tier doesn't support cell styling. ExcelJS on the server
generates fully formatted .xlsx files with colored rows, frozen headers,
and multiple sheets — a professional compliance artifact that opens
correctly in Excel, Google Sheets, and LibreOffice.

### Why NextAuth.js for authentication?
Compliance tools require access control. NextAuth.js with JWT strategy adds
session management with zero infrastructure — no separate auth server needed.
The middleware.ts file protects all routes except /login and /api/auth/*
at the edge, before any page renders.

---

## Fraud Detection Rules

| Rule | Points | Logic |
|------|--------|-------|
| Balance Drain | +40 | newbalanceOrig = 0 after TRANSFER or CASH_OUT |
| Anomalous Amount | +25 | amount > mean + 3σ per transaction type |
| Repeated Origin | +15 | nameOrig appears in 3+ flagged transactions |
| Suspicious Hours | +10 | timestamp 00:00–05:00 AND amount > 10,000 |
| Round Amount | +5 | amount % 1000 = 0 AND amount > 50,000 |

Max possible score: 95/100

Risk levels: Clean (0) · Low (1–20) · Medium (21–49) · High (50–74) · Critical (75+)

---

## Database Schema
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txId TEXT UNIQUE NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,           -- TRANSFER|CASH_OUT|PAYMENT|DEBIT|CASH_IN
  amount REAL NOT NULL,
  nameOrig TEXT NOT NULL,
  nameDest TEXT NOT NULL,
  oldbalanceOrig REAL,
  newbalanceOrig REAL,
  oldbalanceDest REAL,
  newbalanceDest REAL,
  risk_score INTEGER DEFAULT 0,
  fired_rules TEXT DEFAULT '[]', -- JSON array of rule names
  reviewed_status TEXT           -- null|confirmed_suspicious|false_positive
);

CREATE INDEX idx_risk_score ON transactions(risk_score DESC);
CREATE INDEX idx_nameOrig ON transactions(nameOrig);
CREATE INDEX idx_nameDest ON transactions(nameDest);
CREATE INDEX idx_type ON transactions(type);
CREATE INDEX idx_timestamp ON transactions(timestamp);
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/transactions | Paginated list with filters (type, minRisk, dateRange, search) |
| GET | /api/account/[id] | Full account profile with transaction history |
| GET | /api/export | Server-side Excel generation with ExcelJS |
| GET | /api/stats/reviews | Human review counts (FP/Sus) |
| GET | /api/top-accounts | Top suspicious accounts ranked by risk+volume |
| POST | /api/chat | Streaming AI responses via Anthropic SDK |
| POST | /api/review | Mark transaction as FP or suspicious |
| GET+POST | /api/auth/[...nextauth] | NextAuth.js credential authentication |

---

## Key Files
app/
page.tsx              — Main dashboard (KPIs, charts, table)
layout.tsx            — Root layout with SessionProvider
globals.css           — Global styles + Paggo brand colors
login/page.tsx        — Authentication page
account/[id]/page.tsx — Account investigation page
api/                  — All API routes (see table above)
components/
Charts.tsx            — All Recharts visualizations
TransactionTable.tsx  — Filterable, sortable transaction explorer
ChatPanel.tsx         — AI chat with streaming + context injection
KPICards.tsx          — Animated counter KPI cards
TopSuspiciousAccounts.tsx — Ranked account table with filters
RulesInfoModal.tsx    — Detection rules explanation modal
lib/
db.ts                 — Turso client instance
fraud-rules.ts        — 5 detection rules + scoring engine
generate-report.ts    — jsPDF account report generator
scripts/
seed.ts               — CSV import + fraud scoring pipeline

---

## Anthropic SDK Usage Pattern

The chat API uses streaming with the Anthropic SDK:
```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: systemPrompt, // contains real DB stats injected at request time
  messages: conversationHistory,
});

// Stream tokens to the client as they arrive
for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    controller.enqueue(chunk.delta.text);
  }
}
```

The system prompt is built dynamically per request, injecting:
- Total transaction count and flagged count
- Top 5 suspicious accounts with risk scores
- Rule breakdown (how many transactions each rule flagged)
- If on account page: full account profile and transaction history

This makes Claude's answers specific to the actual data, not generic.

---

## Common Tasks for Claude Code

### Re-seed the database after rule changes:
```bash
npx tsx scripts/seed.ts
```

### Add a new detection rule:
1. Add rule function in lib/fraud-rules.ts
2. Add to the rules array with name and points
3. Update ruleDescriptions in app/account/[id]/page.tsx
4. Update RULE_DETAILS in lib/generate-report.ts
5. Re-seed the database

### Fix CSS cache issues (Windows PowerShell):
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

### Environment variables required:
ANTHROPIC_API_KEY=    # Claude API key — never commit this
NEXTAUTH_SECRET=      # Any random string, min 32 chars
NEXTAUTH_URL=         # http://localhost:3000 (dev) or deployed URL (prod)

---

## Claude Code Best Practices Used in This Project

- **CLAUDE.md as persistent context** — eliminates re-explaining architecture
  at every session. Claude Code reads this file automatically on startup.
- **Allowlist-based SQL** — column sort allowlist prevents SQL injection
  in /api/transactions without needing an ORM.
- **Streaming AI responses** — Anthropic SDK streaming gives perceived
  performance improvements; analysts see responses token-by-token.
- **Dynamic imports for heavy libs** — jsPDF and ExcelJS imported with
  dynamic import() to avoid SSR issues and keep initial bundle lean.
- **Turso client singleton** — single db instance in lib/db.ts prevents
  connection exhaustion during Next.js hot reload cycles.
- **Optimistic UI updates** — FP/Sus button clicks update the row
  immediately before the API confirms, improving perceived responsiveness.
- **Context-aware AI** — system prompt changes based on current page
  (dashboard vs account page), so suggested questions and answers are
  always relevant to what the analyst is looking at.
- **Edge middleware auth** — NextAuth middleware runs at the edge before
  any page renders, protecting all routes with zero latency overhead.

---

## Known Constraints & Tradeoffs

- **Turso (distributed SQLite)** � used for production. Persistent writes work correctly in Vercel serverless.
- **Repeated Origin rule** — requires full table scan at seed time.
  Acceptable for a fixed dataset; would need materialized views or a
  pre-computed column in production.
- **No real-time updates** — review counts refresh on interaction, not
  via WebSocket. Sufficient for single-analyst use; would need
  Pusher/Ably for multi-analyst teams.
- **Demo credentials in repo** — analyst@paggo.com / paggo2025 are
  intentionally visible for evaluator access. In production, credentials
  would be provisioned via environment variables or an identity provider.



