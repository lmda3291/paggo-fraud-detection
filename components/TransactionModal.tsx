"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  X,
  ShieldCheck,
  ShieldX,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

interface Transaction {
  txId: string;
  timestamp: string;
  type: string;
  amount: number;
  nameOrig: string;
  nameDest: string;
  oldbalanceOrig: number;
  newbalanceOrig: number;
  oldbalanceDest: number;
  newbalanceDest: number;
  risk_score: number;
  fired_rules: string;
  reviewed_status: string | null;
}

interface TransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onReview: (
    txId: string,
    status: "false_positive" | "confirmed_suspicious" | null
  ) => void;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ruleExplanation(
  rule: string,
  tx: Transaction
): string {
  switch (rule) {
    case "Balance Drain":
      return `Account balance went from ${formatBRL(tx.oldbalanceOrig)} to ${formatBRL(tx.newbalanceOrig)} after this ${tx.type} — the origin account was fully drained.`;
    case "Anomalous Amount":
      return `The amount ${formatBRL(tx.amount)} is unusually large for ${tx.type} transactions — it exceeds 3 standard deviations above the mean for this type.`;
    case "Suspicious Hours":
      return `This ${formatBRL(tx.amount)} transaction occurred at ${tx.timestamp.split(" ")[1]} — high-value activity between midnight and 5 AM is a common fraud pattern.`;
    case "Round Amount":
      return `The amount ${formatBRL(tx.amount)} is a suspiciously round number above R$ 50,000 — a pattern often seen in money laundering.`;
    default:
      return `This rule was triggered for this transaction.`;
  }
}

export default function TransactionModal({
  transaction: tx,
  onClose,
  onReview,
}: TransactionModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const rules = JSON.parse(tx.fired_rules || "[]") as {
    rule: string;
    points: number;
  }[];

  let riskColor = "bg-green-500/20 text-green-400 border-green-500/30";
  if (tx.risk_score > 60)
    riskColor = "bg-red-500/20 text-red-400 border-red-500/30";
  else if (tx.risk_score > 40)
    riskColor = "bg-orange-500/20 text-orange-400 border-orange-500/30";
  else if (tx.risk_score > 20)
    riskColor = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  const origChange = tx.newbalanceOrig - tx.oldbalanceOrig;
  const destChange = tx.newbalanceDest - tx.oldbalanceDest;

  const typeColor =
    tx.type === "TRANSFER"
      ? "bg-[#C4622A]/15 text-[#C4622A]"
      : tx.type === "CASH_OUT"
        ? "bg-amber-500/15 text-amber-400"
        : tx.type === "PAYMENT"
          ? "bg-emerald-500/15 text-emerald-400"
          : tx.type === "DEBIT"
            ? "bg-purple-500/15 text-purple-400"
            : "bg-cyan-500/15 text-cyan-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#1C1C1C] border border-[#2A2A2A] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white font-mono">
              {tx.txId}
            </h2>
            <span
              className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium ${typeColor}`}
            >
              {tx.type}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Timestamp and Amount */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{tx.timestamp}</span>
            <span className="text-xl font-bold text-white font-mono">
              {formatBRL(tx.amount)}
            </span>
          </div>

          {/* Account Details — Two Columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Origin */}
            <div className="bg-[#141414]/60 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Origin Account
                </span>
                <ArrowUpRight className="w-4 h-4 text-red-400" />
              </div>
              <Link
                href={`/account/${tx.nameOrig}`}
                className="block font-mono text-sm text-[#C4622A] hover:text-[#D4824A] hover:underline"
              >
                {tx.nameOrig}
              </Link>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Before</span>
                  <span className="text-gray-300 font-mono">
                    {formatBRL(tx.oldbalanceOrig)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">After</span>
                  <span className="text-gray-300 font-mono">
                    {formatBRL(tx.newbalanceOrig)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-[#2A2A2A]">
                  <span className="text-gray-500">Change</span>
                  <span
                    className={`font-mono font-medium ${origChange >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {origChange >= 0 ? "+" : ""}
                    {formatBRL(origChange)}
                  </span>
                </div>
              </div>
            </div>

            {/* Destination */}
            <div className="bg-[#141414]/60 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Destination Account
                </span>
                <ArrowDownRight className="w-4 h-4 text-green-400" />
              </div>
              <Link
                href={`/account/${tx.nameDest}`}
                className="block font-mono text-sm text-[#C4622A] hover:text-[#D4824A] hover:underline"
              >
                {tx.nameDest}
              </Link>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Before</span>
                  <span className="text-gray-300 font-mono">
                    {formatBRL(tx.oldbalanceDest)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">After</span>
                  <span className="text-gray-300 font-mono">
                    {formatBRL(tx.newbalanceDest)}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-[#2A2A2A]">
                  <span className="text-gray-500">Change</span>
                  <span
                    className={`font-mono font-medium ${destChange >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {destChange >= 0 ? "+" : ""}
                    {formatBRL(destChange)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Analysis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">
                Risk Analysis
              </h3>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-mono font-bold border ${riskColor}`}
              >
                Score: {tx.risk_score}/100
              </span>
            </div>

            {rules.length === 0 ? (
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 text-center">
                <ShieldCheck className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-400">
                  No suspicious patterns detected
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((r) => (
                  <div
                    key={r.rule}
                    className="bg-red-500/5 border border-red-500/15 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-red-400">
                        {r.rule}
                      </span>
                      <span className="text-xs font-mono text-red-400/80 bg-red-500/10 px-2 py-0.5 rounded">
                        +{r.points} pts
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {ruleExplanation(r.rule, tx)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {tx.risk_score > 0 && (
            <div className="flex gap-3 pt-2 border-t border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => {
                  onReview(
                    tx.txId,
                    tx.reviewed_status === "false_positive"
                      ? null
                      : "false_positive"
                  );
                }}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                  tx.reviewed_status === "false_positive"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "text-gray-300 border-gray-600 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {tx.reviewed_status === "false_positive"
                  ? "Marked as False Positive"
                  : "Mark as False Positive"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onReview(
                    tx.txId,
                    tx.reviewed_status === "confirmed_suspicious"
                      ? null
                      : "confirmed_suspicious"
                  );
                }}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                  tx.reviewed_status === "confirmed_suspicious"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "text-gray-300 border-gray-600 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                }`}
              >
                <ShieldX className="w-4 h-4" />
                {tx.reviewed_status === "confirmed_suspicious"
                  ? "Confirmed Suspicious"
                  : "Confirm Suspicious"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
