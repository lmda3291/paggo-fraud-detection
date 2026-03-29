import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") || "1"));
  const limit = Math.min(100000, Math.max(1, parseInt(params.get("limit") || "20")));
  const offset = (page - 1) * limit;
  const type = params.get("type");
  const minRisk = params.get("minRisk");
  const maxRisk = params.get("maxRisk");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const search = params.get("search");
  const sortBy = params.get("sortBy") || "timestamp";
  const sortOrder = params.get("sortOrder") === "asc" ? "ASC" : "DESC";

  const allowedSortColumns = ["timestamp", "amount", "risk_score", "type", "txId", "nameOrig", "nameDest"];
  const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : "timestamp";

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (type) { conditions.push("type = ?"); args.push(type); }
  if (minRisk) { conditions.push("risk_score >= ?"); args.push(parseInt(minRisk)); }
  if (maxRisk) { conditions.push("risk_score <= ?"); args.push(parseInt(maxRisk)); }
  if (startDate) { conditions.push("timestamp >= ?"); args.push(startDate); }
  if (endDate) { conditions.push("timestamp <= ?"); args.push(endDate); }
  if (search) { conditions.push("(txId LIKE ? OR nameOrig LIKE ? OR nameDest LIKE ?)"); args.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.execute({ sql: `SELECT COUNT(*) as total FROM transactions ${whereClause}`, args });
  const total = countResult.rows[0].total as number;

  const txResult = await db.execute({
    sql: `SELECT * FROM transactions ${whereClause} ORDER BY ${safeSort} ${sortOrder} LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const summaryResult = await db.execute({
    sql: `SELECT COUNT(*) as totalTransactions, SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as flaggedCount, ROUND(AVG(risk_score), 2) as avgRiskScore, MAX(risk_score) as maxRiskScore, SUM(CASE WHEN reviewed_status = 'confirmed_suspicious' THEN 1 ELSE 0 END) as confirmedCount, SUM(CASE WHEN reviewed_status = 'false_positive' THEN 1 ELSE 0 END) as falsePositiveCount FROM transactions ${whereClause}`,
    args,
  });

  return NextResponse.json({
    transactions: txResult.rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: summaryResult.rows[0],
  });
}
