"use client";

import { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";

interface RulesInfoModalProps {
  onClose: () => void;
  ruleCounts: Record<string, number>;
}

const RULES = [
  {
    name: "Balance Drain",
    points: 40,
    description:
      "Detects when an account's balance drops to exactly zero after a TRANSFER or CASH_OUT transaction.",
    reasoning:
      "Complete balance drainage is a hallmark of account takeover fraud. Legitimate users rarely withdraw every last cent — attackers do, because they want to extract maximum value before the victim notices.",
  },
  {
    name: "Anomalous Amount",
    points: 25,
    description:
      "Flags transactions where the amount exceeds the mean plus 3 standard deviations for that transaction type.",
    reasoning:
      "Statistical outliers in transaction amounts often indicate fraudulent activity. A CASH_OUT of R$ 500,000 when the average is R$ 6,000 is highly abnormal and warrants investigation.",
  },
  {
    name: "Repeated Origin",
    points: 15,
    description:
      "Account appears as the origin in 3 or more suspicious transactions — a strong indicator of systematic fraud or account compromise being used as a money mule.",
    reasoning:
      "Legitimate users rarely initiate multiple high-risk transactions. When the same account repeatedly appears as origin in flagged activity, it suggests either an automated attack or a compromised account being actively exploited.",
  },
  {
    name: "Suspicious Hours",
    points: 10,
    description:
      "Flags transactions over R$ 10,000 that occur between midnight and 5:00 AM.",
    reasoning:
      "Large financial transfers during overnight hours are uncommon for legitimate business. Fraudsters often operate at night to minimize the chance of real-time detection by account holders or compliance teams.",
  },
  {
    name: "Round Amount",
    points: 5,
    description:
      "Detects transactions with perfectly round amounts (no decimal places) exceeding R$ 50,000.",
    reasoning:
      "Money laundering and structuring schemes frequently use round numbers for convenience. While not conclusive on its own, it raises the score when combined with other indicators.",
  },
];

export default function RulesInfoModal({
  onClose,
  ruleCounts,
}: RulesInfoModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

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
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Detection Rules
              </h2>
              <p className="text-xs text-gray-500">
                How we score and flag suspicious transactions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Every transaction is scored from 0 to 100. The more rules it triggers,
            the higher the score — and the more urgently it needs review.
          </p>

          {RULES.map((rule) => {
            const count = ruleCounts[rule.name] || 0;
            return (
              <div
                key={rule.name}
                className="bg-[#141414]/60 border border-[#2A2A2A] rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    {rule.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                      {count} flagged
                    </span>
                    <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      +{rule.points} pts
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-300">{rule.description}</p>
                <p className="text-xs text-gray-500 italic">
                  Why it matters: {rule.reasoning}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
