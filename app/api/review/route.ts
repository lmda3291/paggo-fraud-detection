import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { txId, status } = body as {
    txId: string;
    status: "false_positive" | "confirmed_suspicious" | null;
  };

  if (!txId) {
    return NextResponse.json({ error: "txId is required" }, { status: 400 });
  }

  const validStatuses = ["false_positive", "confirmed_suspicious", null];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "status must be 'false_positive', 'confirmed_suspicious', or null" },
      { status: 400 }
    );
  }

  const result = await db.execute({
    sql: "UPDATE transactions SET reviewed_status = ? WHERE txId = ?",
    args: [status, txId],
  });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, txId, reviewed_status: status });
}
