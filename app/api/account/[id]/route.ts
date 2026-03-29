import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const accountId = params.id;

  // Transactions as origin
  const asOrigin = db
    .prepare(
      `SELECT * FROM transactions WHERE nameOrig = @id ORDER BY timestamp ASC`
    )
    .all({ id: accountId }) as Record<string, unknown>[];

  // Transactions as destination
  const asDest = db
    .prepare(
      `SELECT * FROM transactions WHERE nameDest = @id ORDER BY timestamp ASC`
    )
    .all({ id: accountId }) as Record<string, unknown>[];

  if (asOrigin.length === 0 && asDest.length === 0) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const allTxs = [...asOrigin, ...asDest];

  // Summary stats
  const totalTransactions = allTxs.length;
  const totalVolume = allTxs.reduce(
    (sum, tx) => sum + (tx.amount as number),
    0
  );
  const maxRiskScore = Math.max(
    ...allTxs.map((tx) => tx.risk_score as number)
  );
  const flaggedCount = allTxs.filter(
    (tx) => (tx.risk_score as number) > 0
  ).length;

  // Risk level
  let riskLevel = "Low";
  if (maxRiskScore >= 60) riskLevel = "Critical";
  else if (maxRiskScore >= 40) riskLevel = "High";
  else if (maxRiskScore >= 20) riskLevel = "Medium";

  // Rule breakdown
  const ruleCounts: Record<string, number> = {};
  for (const tx of allTxs) {
    const rules = JSON.parse((tx.fired_rules as string) || "[]") as {
      rule: string;
    }[];
    for (const r of rules) {
      ruleCounts[r.rule] = (ruleCounts[r.rule] || 0) + 1;
    }
  }

  // Related accounts
  const relatedMap: Record<
    string,
    { account: string; txCount: number; totalVolume: number; maxRisk: number }
  > = {};
  for (const tx of asOrigin) {
    const dest = tx.nameDest as string;
    if (!relatedMap[dest])
      relatedMap[dest] = {
        account: dest,
        txCount: 0,
        totalVolume: 0,
        maxRisk: 0,
      };
    relatedMap[dest].txCount++;
    relatedMap[dest].totalVolume += tx.amount as number;
    relatedMap[dest].maxRisk = Math.max(
      relatedMap[dest].maxRisk,
      tx.risk_score as number
    );
  }
  for (const tx of asDest) {
    const orig = tx.nameOrig as string;
    if (!relatedMap[orig])
      relatedMap[orig] = {
        account: orig,
        txCount: 0,
        totalVolume: 0,
        maxRisk: 0,
      };
    relatedMap[orig].txCount++;
    relatedMap[orig].totalVolume += tx.amount as number;
    relatedMap[orig].maxRisk = Math.max(
      relatedMap[orig].maxRisk,
      tx.risk_score as number
    );
  }
  const relatedAccounts = Object.values(relatedMap).sort(
    (a, b) => b.totalVolume - a.totalVolume
  );

  // Timeline data (daily aggregation)
  const dailyMap: Record<
    string,
    { date: string; amount: number; flaggedAmount: number; count: number }
  > = {};
  for (const tx of allTxs) {
    const day = (tx.timestamp as string).split(" ")[0];
    if (!dailyMap[day])
      dailyMap[day] = { date: day, amount: 0, flaggedAmount: 0, count: 0 };
    dailyMap[day].amount += tx.amount as number;
    dailyMap[day].count++;
    if ((tx.risk_score as number) > 0)
      dailyMap[day].flaggedAmount += tx.amount as number;
  }
  const timeline = Object.values(dailyMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return NextResponse.json({
    accountId,
    summary: {
      totalTransactions,
      totalVolume,
      maxRiskScore,
      flaggedCount,
      riskLevel,
      asOriginCount: asOrigin.length,
      asDestCount: asDest.length,
    },
    asOrigin,
    asDest,
    relatedAccounts,
    ruleCounts,
    timeline,
  });
}
