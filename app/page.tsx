"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Search, HelpCircle, X, Eye, Users, Target, Bot, LogOut } from "lucide-react";
import KPICards from "@/components/KPICards";
import Charts from "@/components/Charts";
import TransactionTable from "@/components/TransactionTable";
import ChatPanel from "@/components/ChatPanel";
import RulesInfoModal from "@/components/RulesInfoModal";
import TopSuspiciousAccounts from "@/components/TopSuspiciousAccounts";

interface SummaryData {
  totalTransactions: number;
  flaggedCount: number;
  avgRiskScore: number;
  maxRiskScore: number;
  confirmedCount: number;
  falsePositiveCount: number;
}

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

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountSearch, setAccountSearch] = useState("");
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [rulesButtonPulse, setRulesButtonPulse] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("paggo-guide-dismissed");
      if (!dismissed) setShowGuide(true);
    }
    const timer = setTimeout(() => setRulesButtonPulse(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Fetch summary stats
        const summaryRes = await fetch("/api/transactions?page=1&limit=1");
        const summaryData = await summaryRes.json();
        setSummary(summaryData.summary);

        // Fetch all transactions for charts
        const allTxs: Transaction[] = [];
        let page = 1;
        let totalPages = 1;
        while (page <= totalPages) {
          const res = await fetch(
            `/api/transactions?page=${page}&limit=100&sortBy=timestamp&sortOrder=asc`
          );
          const data = await res.json();
          allTxs.push(...data.transactions);
          totalPages = data.pagination.totalPages;
          page++;
        }
        setAllTransactions(allTxs);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const amountAtRisk = allTransactions
    .filter((t) => t.risk_score > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const ruleCounts: Record<string, number> = {};
  for (const tx of allTransactions) {
    const rules = JSON.parse(tx.fired_rules || "[]") as { rule: string }[];
    for (const r of rules) {
      ruleCounts[r.rule] = (ruleCounts[r.rule] || 0) + 1;
    }
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#141414]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="4" fill="#000000"/>
              <path d="M5,5 L21,5 C23,9 19,14 16,14 C13,14 3,17 5,21 Z" fill="#FFFFFF"/>
              <path d="M27,11 C29,15 19,18 16,18 C13,18 9,23 11,27 L27,27 Z" fill="#FFFFFF"/>
            </svg>
            <div className="flex items-center gap-1">
              <span className="font-bold text-white text-lg">Detection System</span>
              <span className="text-gray-400 text-sm font-normal">by Paggo</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && accountSearch.trim()) {
                    router.push(`/account/${accountSearch.trim()}`);
                  }
                }}
                placeholder="Investigate account..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#9B4A1E]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowRulesInfo(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-amber-400 hover:bg-amber-500/10 border hover:border-amber-500/30 transition-colors cursor-pointer text-xs font-medium whitespace-nowrap ${rulesButtonPulse ? "animate-pulse border-amber-500/40 text-amber-400/80" : "text-gray-400 border-[#2A2A2A]"}`}
            >
              <HelpCircle className="w-4 h-4" />
              Detection Rules
            </button>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-gray-500 hidden lg:inline">Active</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden md:block">
                {session?.user?.email
                  ? session.user.email.split('@')[0].charAt(0).toUpperCase() +
                    session.user.email.split('@')[0].slice(1)
                  : session?.user?.name ?? "Analyst"}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-[#2A2A2A] hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Guide Banner */}
      {showGuide && (
        <div className="bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-indigo-500/10 border-b border-indigo-500/20">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-indigo-300">
                Quick Guide
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowGuide(false);
                  localStorage.setItem("paggo-guide-dismissed", "true");
                }}
                className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => document.getElementById("transaction-table")?.scrollIntoView({ behavior: "smooth" })}
                className="flex flex-col items-center gap-2 p-4 bg-[#1C1C1C]/60 hover:bg-[#1C1C1C] border border-indigo-500/20 hover:border-indigo-400/40 rounded-xl transition-all cursor-pointer group text-center"
              >
                <div className="p-2 bg-[#C4622A]/10 rounded-lg group-hover:bg-[#C4622A]/20 transition-colors">
                  <Eye className="w-5 h-5 text-[#C4622A]" />
                </div>
                <p className="text-xs font-semibold text-[#D4824A]">Inspect Transactions</p>
                <p className="text-[11px] text-gray-400 leading-snug">Click a transaction ID to see the full breakdown</p>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("transaction-table")?.scrollIntoView({ behavior: "smooth" })}
                className="flex flex-col items-center gap-2 p-4 bg-[#1C1C1C]/60 hover:bg-[#1C1C1C] border border-indigo-500/20 hover:border-indigo-400/40 rounded-xl transition-all cursor-pointer group text-center"
              >
                <div className="p-2 bg-violet-500/10 rounded-lg group-hover:bg-violet-500/20 transition-colors">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <p className="text-xs font-semibold text-[#D4824A]">Investigate Accounts</p>
                <p className="text-[11px] text-gray-400 leading-snug">Click any account ID to explore its activity</p>
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("transaction-table")?.scrollIntoView({ behavior: "smooth" })}
                className="flex flex-col items-center gap-2 p-4 bg-[#1C1C1C]/60 hover:bg-[#1C1C1C] border border-indigo-500/20 hover:border-indigo-400/40 rounded-xl transition-all cursor-pointer group text-center"
              >
                <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                  <Target className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-xs font-semibold text-[#D4824A]">Risk Breakdown</p>
                <p className="text-[11px] text-gray-400 leading-snug">Hover over any risk score to see what triggered it</p>
              </button>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("open-chat-panel"))}
                className="flex flex-col items-center gap-2 p-4 bg-[#1C1C1C]/60 hover:bg-[#1C1C1C] border border-indigo-500/20 hover:border-indigo-400/40 rounded-xl transition-all cursor-pointer group text-center"
              >
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <Bot className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-xs font-semibold text-[#D4824A]">AI Analyst</p>
                <p className="text-[11px] text-gray-400 leading-snug">Chat with AI to uncover patterns and investigate leads</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards — show skeletons while loading */}
        <KPICards
          total={summary?.totalTransactions ?? 0}
          flagged={summary?.flaggedCount ?? 0}
          fraudRate={
            summary
              ? (summary.flaggedCount / summary.totalTransactions) * 100
              : 0
          }
          amountAtRisk={amountAtRisk}
          loading={loading}
        />

        {/* Charts */}
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
                  <div className="h-4 w-32 bg-gray-700 rounded animate-pulse mb-4" />
                  <div className="h-48 bg-gray-700/50 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
              <div className="h-4 w-32 bg-gray-700 rounded animate-pulse mb-4" />
              <div className="h-48 bg-gray-700/50 rounded animate-pulse" />
            </div>
          </div>
        ) : (
          allTransactions.length > 0 && (
            <Charts transactions={allTransactions} />
          )
        )}

        {/* Top Suspicious Accounts */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 bg-red-500 rounded-full" />
            <h2 className="text-xl font-bold text-white">Top Suspicious Accounts</h2>
            <div className="flex-1 h-px bg-gray-700/50" />
          </div>
          <p className="text-sm text-gray-400 mb-4 ml-4">
            Accounts with the highest fraud risk — click any row to investigate
          </p>
          <TopSuspiciousAccounts />
        </section>

        {/* Transaction Table */}
        <div id="transaction-table">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Transaction Explorer
            </h2>
            <div className="flex-1 h-px bg-gray-700/50" />
          </div>
          <TransactionTable />
        </div>
      </main>

      {/* Chat Panel */}
      <ChatPanel />

      {showRulesInfo && (
        <RulesInfoModal
          onClose={() => setShowRulesInfo(false)}
          ruleCounts={ruleCounts}
        />
      )}
    </div>
  );
}
