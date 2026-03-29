import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const result = await db.execute(`
    SELECT
      SUM(CASE WHEN reviewed_status = 'confirmed_suspicious' THEN 1 ELSE 0 END) as confirmedSuspicious,
      SUM(CASE WHEN reviewed_status = 'false_positive' THEN 1 ELSE 0 END) as falsePositives,
      SUM(CASE WHEN risk_score > 0 AND reviewed_status IS NULL THEN 1 ELSE 0 END) as pendingReview,
      SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as totalFlagged
    FROM transactions
  `);

  const stats = result.rows[0] as unknown as { confirmedSuspicious: number; falsePositives: number; pendingReview: number; totalFlagged: number };
  const reviewed = stats.confirmedSuspicious + stats.falsePositives;
  const reviewRate = stats.totalFlagged > 0 ? Math.round((reviewed / stats.totalFlagged) * 1000) / 10 : 0;

  return NextResponse.json({
    confirmedSuspicious: stats.confirmedSuspicious,
    falsePositives: stats.falsePositives,
    pendingReview: stats.pendingReview,
    reviewRate,
  });
}
