"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AccountSummary {
  id: string;
  maxRiskScore: number;
  flaggedCount: number;
  totalTx: number;
  totalVolume: number;
  topRule: string;
}

export default function TopSuspiciousAccounts() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [topFilter, setTopFilter] = useState<number>(15);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/top-accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getRiskColor = (score: number) => {
    if (score >= 75)
      return {
        bar: "#ef4444",
        badge: "bg-red-500/20 text-red-400 border-red-500/30",
        label: "Critical",
      };
    if (score >= 50)
      return {
        bar: "#f97316",
        badge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        label: "High",
      };
    if (score >= 25)
      return {
        bar: "#eab308",
        badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        label: "Medium",
      };
    return {
      bar: "#3b82f6",
      badge: "bg-[#C4622A]/20 text-[#C4622A] border-[#9B4A1E]/30",
      label: "Low",
    };
  };

  if (loading)
    return (
      <div className="bg-[#141414] rounded-xl border border-[#2A2A2A]/50 p-8 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#9B4A1E] mx-auto mb-2" />
        <p className="text-sm text-gray-400">Loading accounts...</p>
      </div>
    );

  const displayedAccounts = accounts.slice(0, topFilter === 999 ? accounts.length : topFilter);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500 font-medium">Show:</span>
        {[
          { label: 'Top 5', value: 5 },
          { label: 'Top 10', value: 10 },
          { label: 'Top 15', value: 15 },
          { label: 'Top 25', value: 25 },
          { label: 'All', value: 999 },
        ].map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTopFilter(value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all
              ${topFilter === value
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-[#1C1C1C] border-[#2A2A2A] text-gray-400 hover:bg-gray-700'
              }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-gray-600 ml-2">
          Showing {Math.min(topFilter === 999 ? accounts.length : topFilter, accounts.length)} of {accounts.length} flagged accounts
        </span>
      </div>

      <div className="bg-[#141414] rounded-xl border border-[#2A2A2A]/50 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#2A2A2A]/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">Account</div>
          <div className="col-span-2">Risk Level</div>
          <div className="col-span-3">Risk Score</div>
          <div className="col-span-1 text-center">Flagged</div>
          <div className="col-span-2 text-right">Volume at Risk</div>
          <div className="col-span-1" />
        </div>

      {displayedAccounts.map((acc, i) => {
        const risk = getRiskColor(acc.maxRiskScore);
        return (
          <div
            key={acc.id}
            onClick={() => router.push(`/account/${acc.id}`)}
            className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-[#2A2A2A]/30 hover:bg-[#1C1C1C]/50 cursor-pointer transition-colors group"
          >
            {/* Rank + Account ID */}
            <div className="col-span-3 flex items-center gap-3">
              <span className="text-xs text-gray-600 w-4 font-mono">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-mono text-[#C4622A] group-hover:text-[#D4824A] font-semibold transition-colors">
                  {acc.id}
                </p>
                <p className="text-xs text-gray-500">
                  {acc.totalTx} {acc.totalTx === 1 ? "transaction" : "transactions"}
                </p>
                {acc.topRule && acc.topRule !== "—" && (
                  <span className="text-xs text-gray-500 mt-0.5 block">
                    Top trigger: <span className="text-orange-400">{acc.topRule}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Risk badge */}
            <div className="col-span-2 flex items-center">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded border ${risk.badge}`}
              >
                {risk.label}
              </span>
            </div>

            {/* Risk score bar */}
            <div className="col-span-3 flex items-center gap-2">
              <div className="flex-1 bg-gray-700/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${acc.maxRiskScore}%`,
                    background: risk.bar,
                    boxShadow: `0 0 8px ${risk.bar}60`,
                  }}
                />
              </div>
              <span className="text-xs font-bold text-white w-12 text-right">
                {acc.maxRiskScore}/100
              </span>
            </div>

            {/* Flagged count */}
            <div className="col-span-1 flex items-center justify-center">
              <span className="text-sm font-bold text-red-400">
                {acc.flaggedCount}
              </span>
            </div>

            {/* Volume */}
            <div className="col-span-2 flex items-center justify-end">
              <span className="text-sm text-gray-300 font-mono">
                R${" "}
                {acc.totalVolume.toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>

            {/* Investigate hint */}
            <div className="col-span-1 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-[#C4622A] flex items-center gap-1">
                Investigate &rarr;
              </span>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
