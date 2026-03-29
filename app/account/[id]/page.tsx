"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,

  Activity,
  DollarSign,
  AlertTriangle,
  Users,
  Search,
  ChevronRight,
  Info,
  TrendingDown,
  BarChart2,
  Moon,
  CircleDot,
  Download,
  Repeat,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import ChatPanel from "@/components/ChatPanel";

interface Transaction {
  txId: string;
  timestamp: string;
  type: string;
  amount: number;
  nameOrig: string;
  nameDest: string;
  risk_score: number;
  fired_rules: string;
  reviewed_status: string | null;
}

interface AccountData {
  accountId: string;
  summary: {
    totalTransactions: number;
    totalVolume: number;
    maxRiskScore: number;
    flaggedCount: number;
    riskLevel: string;
    asOriginCount: number;
    asDestCount: number;
  };
  asOrigin: Transaction[];
  asDest: Transaction[];
  relatedAccounts: {
    account: string;
    txCount: number;
    totalVolume: number;
    maxRisk: number;
  }[];
  ruleCounts: Record<string, number>;
  timeline: {
    date: string;
    amount: number;
    flaggedAmount: number;
    count: number;
  }[];
}

function RiskLevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    Low: "bg-green-500/20 text-green-400 border-green-500/30",
    Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${styles[level] || styles.Low}`}
    >
      {level}
    </span>
  );
}

function RiskBadge({ score, rulesJson }: { score: number; rulesJson?: string }) {
  let color = "bg-green-500/20 text-green-400 border-green-500/30";
  if (score > 60) color = "bg-red-500/20 text-red-400 border-red-500/30";
  else if (score > 40)
    color = "bg-orange-500/20 text-orange-400 border-orange-500/30";
  else if (score > 20)
    color = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

  const rules = rulesJson
    ? (JSON.parse(rulesJson) as { rule: string; points: number }[])
    : [];

  return (
    <span className="relative group">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold border cursor-default ${color}`}
      >
        {score}
        {rules.length > 0 && <Info className="w-3 h-3 opacity-50" />}
      </span>
      {rules.length > 0 && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-50 pointer-events-none">
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#141414] border-l border-t border-gray-600 rotate-45" />
          <span className="block bg-[#141414] border border-gray-600 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap text-left relative">
            {rules.map((r) => (
              <span
                key={r.rule}
                className="block text-[11px] text-gray-300 py-0.5"
              >
                {r.rule}:{" "}
                <span className="text-red-400 font-mono">+{r.points}</span>
              </span>
            ))}
            <span className="block text-[11px] text-white font-semibold pt-1 mt-1 border-t border-[#2A2A2A]">
              Total: {score}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}

const tooltipStyle = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#f3f4f6",
  fontSize: "12px",
};

function TxTable({
  transactions,
  role,
}: {
  transactions: Transaction[];
  role: "origin" | "destination";
}) {
  const counterpartyLabel = role === "origin" ? "Destination" : "Origin";
  return (
    <div style={{ overflowX: "scroll" }}>
      <table
        className="text-sm border-collapse"
        style={{ width: "1100px", tableLayout: "fixed" }}
      >
        <colgroup>
          <col style={{ width: "90px" }} />
          <col style={{ width: "160px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "65px" }} />
          <col style={{ width: "250px" }} />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead>
          <tr className="bg-[#141414]/60 border-b border-[#2A2A2A]">
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              ID
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Date
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Type
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {counterpartyLabel}
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Risk
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Rules Fired
            </th>
            <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-3 py-8 text-center text-gray-500 text-sm"
              >
                No transactions found
              </td>
            </tr>
          ) : (
            transactions.map((tx) => {
              const counterparty =
                role === "origin" ? tx.nameDest : tx.nameOrig;
              const rules = JSON.parse(tx.fired_rules || "[]") as {
                rule: string;
                points: number;
              }[];
              return (
                <tr
                  key={tx.txId}
                  className={`border-b border-[#2A2A2A]/40 hover:bg-gray-700/30 transition-colors ${
                    tx.risk_score > 40
                      ? "border-l-[3px] border-l-red-500"
                      : tx.risk_score > 0
                        ? "border-l-[3px] border-l-orange-500/60"
                        : "border-l-[3px] border-l-transparent"
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-300">
                    {tx.txId}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">
                    {tx.timestamp}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        tx.type === "TRANSFER"
                          ? "bg-[#C4622A]/15 text-[#C4622A]"
                          : tx.type === "CASH_OUT"
                            ? "bg-amber-500/15 text-amber-400"
                            : tx.type === "PAYMENT"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : tx.type === "DEBIT"
                                ? "bg-purple-500/15 text-purple-400"
                                : "bg-cyan-500/15 text-cyan-400"
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-200 text-right">
                    {tx.amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <Link
                      href={`/account/${counterparty}`}
                      className="text-[#C4622A] hover:text-[#D4824A] hover:underline"
                    >
                      {counterparty}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <RiskBadge score={tx.risk_score} rulesJson={tx.fired_rules} />
                  </td>
                  <td className="px-3 py-2.5">
                    {rules.length === 0 ? (
                      <span className="text-gray-600 text-xs">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {rules.map((r) => (
                          <span
                            key={r.rule}
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300"
                            title={`+${r.points} pts`}
                          >
                            {r.rule}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {tx.reviewed_status === "confirmed_suspicious" ? (
                      <span className="text-red-400">Suspicious</span>
                    ) : tx.reviewed_status === "false_positive" ? (
                      <span className="text-green-400">False Positive</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AccountPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"origin" | "destination">(
    "origin"
  );
  const [searchId, setSearchId] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/account/${accountId}`);
        if (!res.ok) {
          setError("Account not found");
          return;
        }
        const json = await res.json();
        setData(json);
        // Default to the tab with more transactions
        if (json.summary.asDestCount > json.summary.asOriginCount) {
          setActiveTab("destination");
        }
      } catch {
        setError("Failed to load account data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [accountId]);

  const handleSearchAccount = () => {
    const trimmed = searchId.trim();
    if (trimmed) router.push(`/account/${trimmed}`);
  };

  const handleExportReport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const account = {
        maxRiskScore: data.summary.maxRiskScore,
        totalTx: String(data.summary.totalTransactions),
        flaggedTx: String(data.summary.flaggedCount),
        totalVolume: data.summary.totalVolume,
        amountAtRisk: [...data.asOrigin, ...data.asDest]
          .filter((tx) => tx.risk_score > 0)
          .reduce((sum, tx) => sum + tx.amount, 0),
        relatedAccounts: String(data.relatedAccounts.length),
        ruleBreakdown: Object.entries(data.ruleCounts)
          .map(([name, count]) => ({ name, count })),
        transactions: [...data.asOrigin, ...data.asDest],
      };

      // Paggo brand colors
      const terracotta: [number, number, number] = [155, 74, 30];
      const terracottaLight: [number, number, number] = [196, 98, 42];
      const darkBg: [number, number, number] = [26, 26, 26];

      // HEADER — Dark branded bar
      doc.setFillColor(...darkBg);
      doc.rect(0, 0, pageWidth, 42, "F");
      // Terracotta accent line
      doc.setFillColor(...terracotta);
      doc.rect(0, 42, pageWidth, 1.5, "F");

      // Logo — black square with white S-curve cutout
      const logoX = 14;
      const logoY = 7;
      const logoS = 12;
      const s = logoS / 32;
      doc.setFillColor(20, 20, 20);
      doc.roundedRect(logoX, logoY, logoS, logoS, 1, 1, "F");
      doc.setFillColor(255, 255, 255);
      const tlPts = [[5*s,5*s],[21*s,5*s],[18*s,10*s],[16*s,14*s],[12*s,16*s],[5*s,20*s]];
      const tlLn = [];
      for (let i = 1; i < tlPts.length; i++) tlLn.push([tlPts[i][0]-tlPts[i-1][0], tlPts[i][1]-tlPts[i-1][1]]);
      doc.lines(tlLn, logoX+tlPts[0][0], logoY+tlPts[0][1], [1,1], "F", true);
      const brPts = [[27*s,12*s],[27*s,27*s],[11*s,27*s],[14*s,22*s],[16*s,18*s],[20*s,16*s]];
      const brLn = [];
      for (let i = 1; i < brPts.length; i++) brLn.push([brPts[i][0]-brPts[i-1][0], brPts[i][1]-brPts[i-1][1]]);
      doc.lines(brLn, logoX+brPts[0][0], logoY+brPts[0][1], [1,1], "F", true);

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("DETECTION SYSTEM", logoX + 16, 16);
      const titleW = doc.getTextWidth("DETECTION SYSTEM  ");
      doc.setFontSize(18);
      doc.setTextColor(...terracottaLight);
      doc.setFont("helvetica", "bold");
      doc.text("by Paggo", logoX + 16 + titleW, 16);

      // Subtitle
      doc.setFontSize(9);
      doc.setTextColor(160, 160, 160);
      doc.text("Compliance Investigation Report — Confidential", logoX + 16, 22);

      // Account info
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(`Account: ${accountId}`, 14, 33);
      doc.text(`Generated: ${new Date().toLocaleString("pt-BR")}`, 14, 38);

      // Risk badge
      const riskLabel =
        account.maxRiskScore >= 75
          ? "CRITICAL"
          : account.maxRiskScore >= 50
            ? "HIGH"
            : "MEDIUM";
      doc.setFillColor(...terracotta);
      doc.roundedRect(pageWidth - 50, 8, 36, 12, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(riskLabel, pageWidth - 32, 16, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(160, 160, 160);
      doc.text(`Score: ${account.maxRiskScore}/100`, pageWidth - 32, 24, { align: "center" });

      // SECTION 1 — ACCOUNT SUMMARY
      doc.setTextColor(...terracotta);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Account Summary", 14, 55);
      doc.setDrawColor(...terracotta);
      doc.setLineWidth(0.5);
      doc.line(14, 56.5, pageWidth - 14, 56.5);

      autoTable(doc, {
        startY: 60,
        head: [["Metric", "Value", "Metric", "Value"]],
        body: [
          ["Total Transactions", account.totalTx, "Flagged Transactions", account.flaggedTx],
          [
            "Total Volume",
            `R$ ${account.totalVolume.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            "Amount at Risk",
            `R$ ${account.amountAtRisk.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          ],
          ["Related Accounts", account.relatedAccounts, "Review Period", "January 2025"],
          ["Max Risk Score", `${account.maxRiskScore}/100`, "Risk Level", riskLabel],
        ],
        theme: "grid",
        headStyles: { fillColor: darkBg, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 245, 242] },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: { 0: { fontStyle: "bold" }, 2: { fontStyle: "bold" } },
      });

      // SECTION 2 — FRAUD RULES TRIGGERED
      const rulesY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.setTextColor(...terracotta);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Fraud Rules Triggered", 14, rulesY);
      doc.setDrawColor(...terracotta);
      doc.setLineWidth(0.5);
      doc.line(14, rulesY + 1.5, pageWidth - 14, rulesY + 1.5);

      const ruleDescriptions: Record<string, string> = {
        "Balance Drain": "Account balance dropped to zero after outgoing transfer",
        "Anomalous Amount": "Amount is 3+ standard deviations above type average",
        "Repeated Origin": "Account appears as origin in 3+ flagged transactions",
        "Suspicious Hours": "Transaction between midnight and 5am with amount > R$10k",
        "Round Amount": "Suspiciously round value above R$50k",
      };
      const rulePointsMap: Record<string, number> = {
        "Balance Drain": 40,
        "Anomalous Amount": 25,
        "Repeated Origin": 15,
        "Suspicious Hours": 10,
        "Round Amount": 5,
      };

      const sortedRuleBreakdown = [...account.ruleBreakdown].sort(
        (a, b) => (rulePointsMap[b.name] || 0) - (rulePointsMap[a.name] || 0)
      );

      autoTable(doc, {
        startY: rulesY + 5,
        head: [["Rule", "Times Fired", "Points Added", "Description"]],
        body: sortedRuleBreakdown.map((rule) => [
          rule.name,
          `${rule.count}×`,
          `+${rulePointsMap[rule.name] || 0} pts`,
          ruleDescriptions[rule.name] || "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: darkBg, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 245, 242] },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: {
          2: { textColor: terracotta, fontStyle: "bold" },
        },
      });

      // SECTION 3 — FLAGGED TRANSACTIONS
      const flaggedY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.setTextColor(...terracotta);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Flagged Transactions", 14, flaggedY);
      doc.setDrawColor(...terracotta);
      doc.setLineWidth(0.5);
      doc.line(14, flaggedY + 1.5, pageWidth - 14, flaggedY + 1.5);

      const txMap = new Map<string, Transaction>();
      for (const tx of account.transactions) {
        if (tx.risk_score > 0) txMap.set(tx.txId, tx);
      }
      const flaggedTxs = Array.from(txMap.values()).sort((a, b) => b.risk_score - a.risk_score);

      autoTable(doc, {
        startY: flaggedY + 5,
        head: [["TX ID", "Date", "Type", "Amount (R$)", "Destination", "Score", "Rules"]],
        body: flaggedTxs.map((tx) => {
          const rules = JSON.parse(tx.fired_rules || "[]") as { rule: string }[];
          return [
            tx.txId,
            tx.timestamp.split(" ")[0],
            tx.type,
            tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
            tx.nameDest,
            `${tx.risk_score}/100`,
            rules.map((r) => r.rule).join(", "),
          ];
        }),
        theme: "grid",
        headStyles: { fillColor: terracotta, textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 245, 242] },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
        columnStyles: { 5: { textColor: terracotta, fontStyle: "bold" } },
      });

      // FOOTER on every page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...terracotta);
        doc.setLineWidth(0.3);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text("Detection System by Paggo — Confidential", 14, pageHeight - 9);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 9, { align: "right" });
      }

      doc.save(`paggo-report-${accountId}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate report. Check console for details.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading account data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg font-semibold mb-2">
            Failed to load account data
          </p>
          <p className="text-gray-500 text-sm mb-4">{error || "Account not found"}</p>
          <button
            onClick={() => router.back()}
            className="text-[#C4622A] hover:text-[#D4824A] text-sm cursor-pointer"
          >
            &larr; Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const { summary, relatedAccounts, ruleCounts, timeline } = data;

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#141414]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1C1C1C] transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="4" fill="#000000"/>
              <path d="M5,5 L21,5 C23,9 19,14 16,14 C13,14 3,17 5,21 Z" fill="#FFFFFF"/>
              <path d="M27,11 C29,15 19,18 16,18 C13,18 9,23 11,27 L27,27 Z" fill="#FFFFFF"/>
            </svg>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Account Investigation
              </h1>
              <p className="text-xs text-gray-500">
                Compliance Investigation — Detection System by Paggo
              </p>
            </div>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchAccount();
              }}
              placeholder="Jump to account ID..."
              className="w-full pl-9 pr-3 py-2 bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#9B4A1E]"
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-400">Account {accountId}</span>
        </nav>

        {/* Account Header */}
        <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white font-mono">
                  {accountId}
                </h2>
                <RiskLevelBadge level={summary.riskLevel} />
              </div>
              <p className="text-sm text-gray-400">
                Max risk score: {summary.maxRiskScore} | {summary.asOriginCount}{" "}
                sent, {summary.asDestCount} received
              </p>
            </div>
            <div>
              <button
                onClick={handleExportReport}
                disabled={exporting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-[#9B4A1E] hover:bg-[#C4622A] active:bg-[#5A2A0E] text-white shadow-lg shadow-[#9B4A1E]/30 border border-[#9B4A1E] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export Report
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-1 text-right">
                Download a full compliance report for this account
              </p>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-[#141414]/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-[#C4622A]" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Total Transactions
                </span>
              </div>
              <p className="text-xl font-bold text-white">
                {summary.totalTransactions}
              </p>
            </div>
            <div className="bg-[#141414]/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Total Volume
                </span>
              </div>
              <p className="text-xl font-bold text-emerald-400">
                R${" "}
                {summary.totalVolume.toLocaleString("pt-BR", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="bg-[#141414]/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Flagged Transactions
                </span>
              </div>
              <p className="text-xl font-bold text-amber-400">
                {summary.flaggedCount}
              </p>
            </div>
            <div className="bg-[#141414]/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                  Related Accounts
                </span>
              </div>
              <p className="text-xl font-bold text-purple-400">
                {relatedAccounts.length}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        {(() => {
          const hasFlagged = timeline.some((d) => d.flaggedAmount > 0);
          const totalFlaggedCount = summary.flaggedCount;
          const totalFlaggedVolume = timeline.reduce((s, d) => s + d.flaggedAmount, 0);
          const peakDay = timeline.length > 0
            ? timeline.reduce((max, d) => d.amount > max.amount ? d : max, timeline[0])
            : null;

          // Dynamic date range label
          const allTxs = [...data.asOrigin, ...data.asDest];
          const txDates = allTxs.map((t) => new Date(t.timestamp));
          const minDate = txDates.length > 0 ? new Date(Math.min(...txDates.map((d) => d.getTime()))) : null;
          const maxDate = txDates.length > 0 ? new Date(Math.max(...txDates.map((d) => d.getTime()))) : null;
          const formatMonth = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const dateRangeLabel = minDate && maxDate
            ? (minDate.getMonth() === maxDate.getMonth() && minDate.getFullYear() === maxDate.getFullYear()
              ? formatMonth(minDate)
              : `${formatMonth(minDate)} \u2013 ${formatMonth(maxDate)}`)
            : 'Analysis period';
          // Filter out zero flaggedAmount so red bars don't render for clean days
          const timelineClean = timeline.map((d) => ({
            ...d,
            flaggedAmount: d.flaggedAmount > 0 ? d.flaggedAmount : undefined,
          }));
          return (
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-300">
                Transaction Timeline — {dateRangeLabel}
              </h3>
              <p className="text-[11px] text-gray-500 mb-4">
                {hasFlagged
                  ? "Daily activity for this account — red means a flagged transaction occurred"
                  : "No flagged activity detected for this account"}
              </p>
              {timeline.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={timelineClean}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                        tickFormatter={(v: string) => {
                          const day = v.split("-")[2];
                          return `Jan ${day}`;
                        }}
                        stroke="#4b5563"
                      />
                      <YAxis
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        stroke="#4b5563"
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                        label={{ value: "R$ Volume", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10, dx: -5 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as { date: string; amount: number; flaggedAmount?: number; count: number };
                          const parts = d.date.split("-");
                          const dateLabel = `Jan ${parts[2]}`;
                          const hasFlaggedDay = d.flaggedAmount && d.flaggedAmount > 0;
                          return (
                            <div style={tooltipStyle} className="px-3 py-2.5 shadow-xl">
                              <p className="text-xs font-semibold text-gray-200 mb-1.5">Date: {dateLabel}</p>
                              <p className="text-[11px] text-gray-400">
                                Total Volume: <span className="text-[#C4622A] font-mono">R$ {d.amount.toLocaleString("pt-BR")}</span>
                              </p>
                              {hasFlaggedDay && (
                                <p className="text-[11px] text-gray-400">
                                  Flagged Volume: <span className="text-red-400 font-mono">R$ {d.flaggedAmount!.toLocaleString("pt-BR")}</span>
                                </p>
                              )}
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {d.count} transaction{d.count !== 1 ? "s" : ""}
                              </p>
                              {hasFlaggedDay && (
                                <>
                                  <div className="border-t border-gray-600 my-1.5" />
                                  <p className="text-[10px] text-amber-400">{"\u26A0"} Contains flagged transactions</p>
                                </>
                              )}
                            </div>
                          );
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "12px", color: "#9ca3af" }}
                      />
                      <Bar
                        dataKey="amount"
                        name="Total Amount"
                        fill="#3b82f6"
                        radius={[2, 2, 0, 0]}
                      />
                      {hasFlagged && (
                        <Bar
                          dataKey="flaggedAmount"
                          name="Flagged Amount"
                          fill="#ef4444"
                          radius={[2, 2, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    {hasFlagged ? (
                      <>
                        {totalFlaggedCount} flagged transaction{totalFlaggedCount !== 1 ? "s" : ""}
                        {" \u00B7 "}
                        R$ {totalFlaggedVolume.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} at risk
                        {peakDay && (
                          <>
                            {" \u00B7 "}
                            peak activity: Jan {peakDay.date.split("-")[2]}
                          </>
                        )}
                      </>
                    ) : (
                      peakDay && <>Peak activity: Jan {peakDay.date.split("-")[2]}</>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-sm py-8 text-center">
                  No timeline data
                </p>
              )}
            </div>
          );
        })()}

        {/* Two-column: Transactions + Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Transactions (2/3) */}
          <div className="xl:col-span-2 space-y-0">
            {/* Tabs */}
            <div className="flex border-b border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => setActiveTab("origin")}
                className={`px-5 py-3 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === "origin"
                    ? "text-[#C4622A] border-b-2 border-[#9B4A1E]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                As Origin ({data.asOrigin.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("destination")}
                className={`px-5 py-3 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === "destination"
                    ? "text-[#C4622A] border-b-2 border-[#9B4A1E]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                As Destination ({data.asDest.length})
              </button>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2A2A2A] border-t-0 rounded-b-lg">
              <TxTable
                transactions={
                  activeTab === "origin" ? data.asOrigin : data.asDest
                }
                role={activeTab}
              />
            </div>
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-6">
            {/* Rule Breakdown */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
              <h3 className="text-sm font-medium text-white mb-0.5">
                Why this account is flagged
              </h3>
              <p className="text-[11px] text-gray-500 mb-4">
                Each rule that fired and how many points it added to the risk score
              </p>
              {Object.keys(ruleCounts).length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No fraud rules triggered
                </p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(ruleCounts)
                    .sort((a, b) => {
                      const pointsMap: Record<string, number> = {
                        'Balance Drain': 40,
                        'Anomalous Amount': 25,
                        'Repeated Origin': 15,
                        'Suspicious Hours': 10,
                        'Round Amount': 5,
                      };
                      return (pointsMap[b[0]] || 0) - (pointsMap[a[0]] || 0);
                    })
                    .map(([rule, count]) => {
                      const ruleConfig: Record<string, { icon: React.ReactNode; color: string; points: number; description: string }> = {
                        "Balance Drain": {
                          icon: <TrendingDown className="w-4 h-4" />,
                          color: "#ef4444",
                          points: 40,
                          description: "Account balance dropped to zero after outgoing transfer",
                        },
                        "Anomalous Amount": {
                          icon: <BarChart2 className="w-4 h-4" />,
                          color: "#f97316",
                          points: 25,
                          description: "Amount is 3+ standard deviations above average for this type",
                        },
                        "Suspicious Hours": {
                          icon: <Moon className="w-4 h-4" />,
                          color: "#8b5cf6",
                          points: 10,
                          description: "Transaction between midnight and 5am with amount > R$10k",
                        },
                        "Round Amount": {
                          icon: <CircleDot className="w-4 h-4" />,
                          color: "#3b82f6",
                          points: 5,
                          description: "Suspiciously round value above R$50k",
                        },
                        "Repeated Origin": {
                          icon: <Repeat className="w-4 h-4" />,
                          color: "#8b5cf6",
                          points: 15,
                          description: "Account flagged as origin in 3+ suspicious transactions",
                        },
                      };
                      const config = ruleConfig[rule] || {
                        icon: <AlertTriangle className="w-4 h-4" />,
                        color: "#6b7280",
                        points: 0,
                        description: "Fraud detection rule triggered",
                      };
                      return (
                        <div
                          key={rule}
                          className="flex items-center gap-3 bg-[#1C1C1C]/50 border border-[#2A2A2A]/50 rounded-lg p-3"
                        >
                          <div
                            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${config.color}20`, color: config.color }}
                          >
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{rule}</p>
                            <p className="text-xs text-gray-400 leading-snug mt-0.5 truncate">
                              {config.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold"
                              style={{ backgroundColor: `${config.color}20`, color: config.color }}
                            >
                              +{config.points} pts
                            </span>
                            {count > 1 && (
                              <span className="text-[11px] text-gray-500 font-mono">
                                &times;{count}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Related Accounts */}
            <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-0.5">
                Related Accounts
                <span className="text-gray-500 font-normal ml-1">
                  ({relatedAccounts.length})
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 mb-4">
                Other accounts that transacted with this one
              </p>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {relatedAccounts.map((ra) => (
                  <Link
                    key={ra.account}
                    href={`/account/${ra.account}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-700/50 transition-colors group"
                  >
                    <div>
                      <span className="font-mono text-xs text-[#C4622A] group-hover:text-[#D4824A]">
                        {ra.account}
                      </span>
                      <span className="text-[10px] text-gray-500 ml-2">
                        {ra.txCount} tx{ra.txCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-300">
                        R${" "}
                        {ra.totalVolume.toLocaleString("pt-BR", {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      {ra.maxRisk > 0 && (
                        <span
                          className={`ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            ra.maxRisk > 40
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {ra.maxRisk}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ChatPanel />
    </div>
  );
}
