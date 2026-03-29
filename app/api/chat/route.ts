import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import db from "@/lib/db";

const anthropic = new Anthropic();

async function buildAccountContext(accountId: string): Promise<string> {
  const result = await db.execute({
    sql: `SELECT txId, timestamp, type, amount, nameOrig, nameDest, risk_score, fired_rules, reviewed_status FROM transactions WHERE nameOrig = ? OR nameDest = ? ORDER BY timestamp ASC`,
    args: [accountId, accountId],
  });
  const txs = result.rows as Record<string, number | string>[];
  if (txs.length === 0) return "";
  const asOrigin = txs.filter((t) => t.nameOrig === accountId);
  const asDest = txs.filter((t) => t.nameDest === accountId);
  const flagged = txs.filter((t) => Number(t.risk_score) > 0);
  const totalVolume = txs.reduce((sum, t) => sum + Number(t.amount), 0);
  return `CURRENT INVESTIGATION - ACCOUNT ${accountId}:
Account Summary:
- Total transactions: ${txs.length} (${asOrigin.length} as origin, ${asDest.length} as destination)
- Flagged transactions: ${flagged.length}
- Total volume: R$ ${totalVolume.toLocaleString("pt-BR")}

All transactions for ${accountId}:
${txs.map((t) => `- ${t.txId} | ${t.timestamp} | ${t.type} | R$ ${Number(t.amount).toLocaleString("pt-BR")} | ${t.nameOrig} -> ${t.nameDest} | risk: ${t.risk_score} | rules: ${t.fired_rules} | status: ${t.reviewed_status || "pending"}`).join("\n")}`.trim();
}

async function buildContext(): Promise<string> {
  const [overviewRes, byTypeRes, ruleRes, topRes, highRiskRes] = await Promise.all([
    db.execute(`SELECT COUNT(*) as total, SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as flagged, ROUND(AVG(risk_score), 2) as avgRisk, MAX(risk_score) as maxRisk, MIN(timestamp) as earliest, MAX(timestamp) as latest, ROUND(SUM(amount), 2) as totalVolume FROM transactions`),
    db.execute(`SELECT type, COUNT(*) as count, ROUND(AVG(amount), 2) as avgAmount, SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as flagged FROM transactions GROUP BY type ORDER BY count DESC`),
    db.execute(`SELECT fired_rules FROM transactions WHERE risk_score > 0`),
    db.execute(`SELECT nameOrig, COUNT(*) as flaggedTxCount, ROUND(SUM(amount), 2) as totalAmount, MAX(risk_score) as maxRisk FROM transactions WHERE risk_score > 0 GROUP BY nameOrig ORDER BY flaggedTxCount DESC, maxRisk DESC LIMIT 10`),
    db.execute(`SELECT txId, timestamp, type, amount, nameOrig, nameDest, risk_score, fired_rules FROM transactions WHERE risk_score >= 40 ORDER BY risk_score DESC, amount DESC LIMIT 20`),
  ]);

  const overview = overviewRes.rows[0] as Record<string, number | string>;
  const byType = byTypeRes.rows as Record<string, number | string>[];
  const ruleCounts: Record<string, number> = {};
  for (const row of ruleRes.rows as { fired_rules: string }[]) {
    const rules = JSON.parse(row.fired_rules) as { rule: string }[];
    for (const r of rules) { ruleCounts[r.rule] = (ruleCounts[r.rule] || 0) + 1; }
  }
  const topSuspicious = topRes.rows as Record<string, number | string>[];
  const highRisk = highRiskRes.rows as Record<string, number | string>[];

  return `DATABASE SUMMARY:
- Total transactions: ${overview.total}
- Flagged transactions (risk > 0): ${overview.flagged}
- Average risk score: ${overview.avgRisk}
- Max risk score: ${overview.maxRisk}
- Date range: ${overview.earliest} to ${overview.latest}
- Total volume: $${Number(overview.totalVolume).toLocaleString()}

TRANSACTIONS BY TYPE:
${byType.map((t) => `- ${t.type}: ${t.count} transactions, avg $${t.avgAmount}, ${t.flagged} flagged`).join("\n")}

FRAUD RULE TRIGGER COUNTS:
${Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]).map(([rule, count]) => `- ${rule}: ${count}`).join("\n")}

TOP 10 SUSPICIOUS ACCOUNTS:
${topSuspicious.map((a) => `- ${a.nameOrig}: ${a.flaggedTxCount} flagged txs, total $${Number(a.totalAmount).toLocaleString()}, max risk ${a.maxRisk}`).join("\n")}

HIGH RISK TRANSACTIONS (risk >= 40, top 20):
${highRisk.map((t) => `- ${t.txId} | ${t.timestamp} | ${t.type} | $${Number(t.amount).toLocaleString()} | ${t.nameOrig} -> ${t.nameDest} | risk: ${t.risk_score} | rules: ${t.fired_rules}`).join("\n")}`.trim();
}

const SYSTEM_PROMPT = `You are a fraud analysis assistant embedded in a bank's internal compliance tool. You help financial analysts investigate suspicious transactions. Use the data provided to answer questions accurately. When referencing specific transactions, always include the transaction ID (txId). Be concise, professional, and analytical.

Fraud detection rules in use:
1. Balance Drain (+40 pts): Account fully drained via TRANSFER or CASH_OUT
2. Anomalous Amount (+25 pts): Amount exceeds mean + 3 sigma for that transaction type
3. Suspicious Hours (+10 pts): Transactions between midnight and 5 AM exceeding $10,000
4. Round Amount (+5 pts): Round number amounts exceeding $50,000
5. Repeated Origin (+15 pts): Account appears as origin in 3+ suspicious transactions`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages = [], question, currentAccountId } = body as {
    messages?: { role: "user" | "assistant"; content: string }[];
    question: string;
    currentAccountId?: string;
  };

  const globalContext = await buildContext();
  const accountContext = currentAccountId ? await buildAccountContext(currentAccountId) : "";
  const context = accountContext ? `${globalContext}\n\n${accountContext}` : globalContext;

  const allMessages: Anthropic.MessageParam[] = [
    ...messages,
    { role: "user", content: `<database_context>\n${context}\n</database_context>\n\n${question}` },
  ];

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: allMessages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
