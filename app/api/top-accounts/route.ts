import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const accounts = db
    .prepare(
      `SELECT
        nameOrig as id,
        MAX(risk_score) as maxRiskScore,
        COUNT(CASE WHEN risk_score > 0 THEN 1 END) as flaggedCount,
        COUNT(*) as totalTx,
        SUM(CASE WHEN risk_score > 0 THEN amount ELSE 0 END) as totalVolume
      FROM transactions
      WHERE risk_score > 0
      GROUP BY nameOrig
      ORDER BY maxRiskScore DESC, totalVolume DESC
      LIMIT 50`
    )
    .all() as {
    id: string;
    maxRiskScore: number;
    flaggedCount: number;
    totalTx: number;
    totalVolume: number;
  }[];

  const result = accounts.map((acc) => {
    const topRuleTx = db
      .prepare(
        `SELECT fired_rules FROM transactions
         WHERE nameOrig = ? AND risk_score > 0
         ORDER BY risk_score DESC LIMIT 1`
      )
      .get(acc.id) as { fired_rules: string } | undefined;

    let topRule = "—";
    try {
      const rules = JSON.parse(topRuleTx?.fired_rules || "[]") as { rule: string }[];
      topRule = rules[0]?.rule || "—";
    } catch {
      /* ignore */
    }

    return { ...acc, topRule };
  });

  return NextResponse.json(result);
}
