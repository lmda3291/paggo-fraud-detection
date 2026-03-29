# Detection System by Paggo

> A compliance investigation tool for financial analysts — built for the Paggo Product Engineer case.

**[Live Demo →](https://paggo-fraud-detection.vercel.app)** | **[Repository →](https://github.com/lmda3291/paggo-fraud-detection)**

Built with Next.js 14 · SQLite · Claude AI · TypeScript · Tailwind CSS

---

## Screenshots

> Dashboard, Account Investigation, and AI Analyst views available at the live demo link above.

---

## Overview

Detection System by Paggo is a full-stack web application that helps
compliance analysts investigate suspicious bank transactions. It processes
7,800 synthetic transactions, applies 5 fraud detection rules, scores each
transaction from 0–95, and provides an AI-powered analyst for natural
language investigation.

The system is designed around a real compliance workflow: analysts see
flagged transactions first, can drill into individual accounts, mark false
positives or confirm suspicions, and export professional reports — all
within a single authenticated interface.

---

## Detection Rules & Reasoning

### 1. Balance Drain (+40 points)
**What it detects:** TRANSFER or CASH_OUT transactions where the origin
account balance drops to exactly R$0.00 after the transaction.

**Why this matters:** In account takeover fraud, attackers drain the
victim's account completely and immediately. A legitimate user almost never
empties their account to exactly zero — the precision is the signal. This
is one of the most reliable fraud indicators used by Brazilian fintechs.

**False positive risk:** Very low.

### 2. Anomalous Amount (+25 points)
**What it detects:** Transaction amounts more than 3 standard deviations
above the mean for their transaction type.

**Why this matters:** Statistical outliers per type avoid flagging naturally
large TRANSFERs just because small DEBITs are common. The 3-sigma threshold
means only ~0.3% of normal transactions would be flagged by chance.

**False positive risk:** Low.

### 3. Repeated Origin (+15 points)
**What it detects:** Accounts that appear as origin in 3 or more
suspicious transactions.

**Why this matters:** Single suspicious transactions can be coincidence.
When the same account repeatedly originates flagged activity, it indicates
systematic exploitation — a compromised account or an automated attack.
This network-level signal is used by PayPal and Stripe to identify fraud
campaigns rather than isolated incidents.

**False positive risk:** Low.

### 4. Suspicious Hours (+10 points)
**What it detects:** Transactions occurring between 00:00 and 05:00
with amounts above R$10,000.

**Why this matters:** Large financial transactions at 3am are unusual.
Fraudsters operate at night because victims and bank support teams are
asleep, reducing the chance of real-time intervention.

**False positive risk:** Medium.

### 5. Round Amount (+5 points)
**What it detects:** Transactions with values divisible by 1,000
above R$50,000.

**Why this matters:** Round numbers above thresholds are associated with
money laundering structuring. The R$50k threshold avoids flagging normal
round payments.

**False positive risk:** Medium-high. Designed to tip borderline cases.

---

## Risk Scoring System

Scores are additive across rules (maximum: 95/100):

| Score | Level | Action |
|-------|-------|--------|
| 0 | Clean | No review needed |
| 1–20 | Low | Monitor |
| 21–49 | Medium | Review when time permits |
| 50–74 | High | Priority review |
| 75+ | Critical | Immediate action required |

**Why additive scoring?** A transaction triggering multiple rules is
exponentially more suspicious than one triggering a single rule. Additive
scoring lets analysts prioritize by severity — matching how production
fraud tools like Feedzai, Sardine, and Unit21 work.

---

## Features

### Dashboard
- 5 KPI cards: Total Transactions, Flagged, Fraud Rate, Amount at Risk, Analyst Reviews
- Daily Transaction Volume chart with dual Y-axis
- Transaction Type Distribution donut colored by fraud concentration
- Amount Distribution histogram with fraud rate curve
- Top Suspicious Accounts table with Top 5/10/15/25/All filter

### Transaction Explorer
- Search by transaction ID or account
- Filter by type, minimum risk score, date range
- Sort by any column
- Export to formatted Excel (.xlsx) with color-coded rows, frozen headers, summary sheet
- 50 results per page with pagination

### Transaction Detail Modal
- Full balance flow (before/after for origin and destination)
- Per-rule explanation in plain language
- Risk score breakdown
- FP/Sus review buttons

### Account Investigation
- Risk badge (Critical/High/Medium/Low)
- Transaction timeline chart
- As Origin / As Destination tabs
- Fraud Rule Breakdown with score impact per rule
- Related Accounts with risk scores
- Export PDF compliance report

### AI Analyst
- Powered by Claude (claude-sonnet-4-20250514)
- Real database context injected into system prompt
- Context-aware: different behavior on dashboard vs account page
- Streaming responses via Anthropic SDK
- Suggested questions tailored to current view

### Security & Auth
- NextAuth.js with JWT sessions
- Edge middleware protects all routes
- Demo: analyst@paggo.com / paggo2025

---

## Setup Instructions
```bash
git clone https://github.com/lmda3291/paggo-fraud-detection
cd paggo-fraud-detection
npm install
cp .env.example .env.local
# Add ANTHROPIC_API_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL to .env.local
npx tsx scripts/seed.ts
npm run dev
```

Open http://localhost:3000

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | Full-stack, API routes, SSR |
| Database | Turso (libsql) | Distributed SQLite, persistent writes in serverless |
| AI | Anthropic Claude (Sonnet) | Best reasoning for data analysis |
| Auth | NextAuth.js | Simple JWT sessions, edge middleware |
| Charts | Recharts | Composable React charts |
| Styling | Tailwind CSS | Rapid, consistent UI |
| Export | ExcelJS + jsPDF | Professional formatted exports |
| Deploy | Vercel | Zero-config Next.js deployment |

---

## Security

- All routes protected by NextAuth.js JWT middleware at the edge
- SQL injection prevented via column allowlist — no dynamic SQL construction
- API keys stored in environment variables, never in source code
- No sensitive transaction data logged to console or external services

---

## Performance

- SQLite indexes on risk_score, nameOrig, nameDest, type, timestamp
- Paginated API responses (50 rows default, configurable up to 99,999 for export)
- Dynamic imports for heavy libraries (jsPDF, ExcelJS) — loaded only on demand
- Recharts renders only visible data points

---

## If I Had More Time

- **Real-time collaboration** — WebSocket updates so multiple analysts
  see each other's FP/Sus reviews in real time (Pusher or Ably)
- **ML scoring** — Replace rule-based scoring with a trained classifier
  using analyst reviews as training labels over time
- **Graph analysis** — Neo4j to detect fraud rings via PageRank on the
  transaction graph
- **Audit log** — Full history of analyst actions for compliance reporting
- **Multi-tenant** — Each analyst sees only their assigned case queue

---

*Built by Lucas Meili Dell Aquila · Paggo Product Engineer Case · March 2026*
