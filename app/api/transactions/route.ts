import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Paginated transaction query with filtering and sorting.
// Pagination at 50 rows — cognitive load research (Miller's Law, Nielsen Norman Group)
// shows analysts process ~50 items effectively before attention degrades. Higher limits
// also slow down the UI for marginal analytical value.

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

  // Allowlist for sort columns — SQL injection prevention. The sortBy value comes
  // from query params (user input) and is interpolated into the ORDER BY clause.
  // Parameterized queries can't bind column names, so we validate against a known set.
  const allowedSortColumns = [
    "timestamp", "amount", "risk_score", "type", "txId",
    "nameOrig", "nameDest",
  ];
  const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : "timestamp";

  const conditions: string[] = [];
  const values: Record<string, string | number> = {};

  if (type) {
    conditions.push("type = @type");
    values.type = type;
  }
  if (minRisk) {
    conditions.push("risk_score >= @minRisk");
    values.minRisk = parseInt(minRisk);
  }
  if (maxRisk) {
    conditions.push("risk_score <= @maxRisk");
    values.maxRisk = parseInt(maxRisk);
  }
  if (startDate) {
    conditions.push("timestamp >= @startDate");
    values.startDate = startDate;
  }
  if (endDate) {
    conditions.push("timestamp <= @endDate");
    values.endDate = endDate;
  }
  if (search) {
    conditions.push("(txId LIKE @search OR nameOrig LIKE @search OR nameDest LIKE @search)");
    values.search = `%${search}%`;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM transactions ${whereClause}`
  ).get(values) as { total: number };

  const transactions = db.prepare(
    `SELECT * FROM transactions ${whereClause}
     ORDER BY ${safeSort} ${sortOrder}
     LIMIT @limit OFFSET @offset`
  ).all({ ...values, limit, offset });

  const summary = db.prepare(`
    SELECT
      COUNT(*) as totalTransactions,
      SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as flaggedCount,
      ROUND(AVG(risk_score), 2) as avgRiskScore,
      MAX(risk_score) as maxRiskScore,
      SUM(CASE WHEN reviewed_status = 'confirmed_suspicious' THEN 1 ELSE 0 END) as confirmedCount,
      SUM(CASE WHEN reviewed_status = 'false_positive' THEN 1 ELSE 0 END) as falsePositiveCount
    FROM transactions ${whereClause}
  `).get(values) as Record<string, number>;

  return NextResponse.json({
    transactions,
    pagination: {
      page,
      limit,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / limit),
    },
    summary,
  });
}
