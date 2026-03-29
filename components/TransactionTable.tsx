"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Filter,
  X,
  Download,
  Eye,
  Info,
} from "lucide-react";
import TransactionModal from "./TransactionModal";

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

interface TransactionTableProps {
  onDataLoaded?: (transactions: Transaction[]) => void;
}

type SortColumn =
  | "txId"
  | "type"
  | "amount"
  | "timestamp"
  | "risk_score"
  | "nameOrig"
  | "nameDest";

function RiskBadge({
  score,
  rulesJson,
}: {
  score: number;
  rulesJson?: string;
}) {
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
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold border cursor-default ${color}`}
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

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-600 text-xs">—</span>;
  if (status === "confirmed_suspicious")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
        <ShieldX className="w-3 h-3 flex-shrink-0" /> Suspicious
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
      <ShieldCheck className="w-3 h-3 flex-shrink-0" /> False Positive
    </span>
  );
}

function RulesTags({ rulesJson }: { rulesJson: string }) {
  const rules = JSON.parse(rulesJson || "[]") as {
    rule: string;
    points: number;
  }[];
  if (rules.length === 0)
    return <span className="text-gray-600 text-xs">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {rules.map((r) => (
        <span
          key={r.rule}
          className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300"
          title={`+${r.points} points`}
        >
          {r.rule}
        </span>
      ))}
    </div>
  );
}

const TX_TYPES = ["ALL", "TRANSFER", "CASH_OUT", "PAYMENT", "DEBIT", "CASH_IN"];

export default function TransactionTable({
  onDataLoaded,
}: TransactionTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [minRisk, setMinRisk] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<SortColumn>("risk_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [exportingCSV, setExportingCSV] = useState(false);

  const isInitialMount = useRef(true);

  const fetchTransactions = useCallback(
    async (
      p: number,
      opts?: {
        search?: string;
        typeFilter?: string;
        minRisk?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: string;
      }
    ) => {
      setLoading(true);
      const s = opts?.search ?? search;
      const tf = opts?.typeFilter ?? typeFilter;
      const mr = opts?.minRisk ?? minRisk;
      const sd = opts?.startDate ?? startDate;
      const ed = opts?.endDate ?? endDate;
      const sb = opts?.sortBy ?? sortBy;
      const so = opts?.sortOrder ?? sortOrder;

      const params = new URLSearchParams({
        page: String(p),
        limit: "50",
        sortBy: sb,
        sortOrder: so,
      });
      if (s) params.set("search", s);
      if (tf !== "ALL") params.set("type", tf);
      if (mr) params.set("minRisk", mr);
      if (sd) params.set("startDate", sd);
      if (ed) params.set("endDate", ed);

      try {
        const res = await fetch(`/api/transactions?${params}`);
        const data = await res.json();
        setTransactions(data.transactions);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        onDataLoaded?.(data.transactions);
      } catch (e) {
        console.error("Failed to fetch transactions", e);
      } finally {
        setLoading(false);
      }
    },
    [search, typeFilter, minRisk, startDate, endDate, sortBy, sortOrder, onDataLoaded]
  );

  // Initial load
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchTransactions(1);
    }
  }, [fetchTransactions]);

  // Auto-apply when filter dropdowns/dates change
  const applyFilters = useCallback(
    (overrides: {
      typeFilter?: string;
      minRisk?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      setPage(1);
      fetchTransactions(1, overrides);
    },
    [fetchTransactions]
  );

  const handleSort = (col: SortColumn) => {
    const newOrder = sortBy === col ? (sortOrder === "asc" ? "desc" : "asc") : "desc";
    setSortBy(col);
    setSortOrder(newOrder);
    setPage(1);
    fetchTransactions(1, { sortBy: col, sortOrder: newOrder });
  };

  const handleSearchSubmit = () => {
    setPage(1);
    fetchTransactions(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchTransactions(newPage);
  };

  const handleReview = async (
    txId: string,
    status: "false_positive" | "confirmed_suspicious" | null
  ) => {
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txId, status }),
    });
    setTransactions((prev) =>
      prev.map((t) =>
        t.txId === txId ? { ...t, reviewed_status: status } : t
      )
    );
    window.dispatchEvent(new Event("review-updated"));
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setMinRisk("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    fetchTransactions(1, {
      typeFilter: "ALL",
      minRisk: "",
      startDate: "",
      endDate: "",
    });
  };

  const hasActiveFilters =
    search || typeFilter !== "ALL" || minRisk || startDate || endDate;

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter !== "ALL") params.set('type', typeFilter);
      if (minRisk) params.set('minRisk', minRisk);
      if (startDate) params.set('dateFrom', startDate);
      if (endDate) params.set('dateTo', endDate);

      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `paggo-report-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Check console for details.');
    } finally {
      setExportingCSV(false);
    }
  };

  const thClass =
    "px-3 py-3 text-left whitespace-nowrap text-[11px] font-semibold text-gray-400 uppercase tracking-wider";

  return (
    <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b border-[#2A2A2A] space-y-3 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearchSubmit();
              }}
              placeholder="Search by ID or account... (press Enter)"
              className="w-full pl-9 pr-3 py-2 bg-[#141414] border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#9B4A1E]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${
              showFilters || hasActiveFilters
                ? "bg-[#C4622A]/10 border-[#9B4A1E]/30 text-[#C4622A]"
                : "bg-[#141414] border-gray-600 text-gray-400 hover:text-gray-200"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exportingCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingCSV ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-300" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSearchSubmit}
            className="px-4 py-2 bg-[#9B4A1E] hover:bg-[#5A2A0E] text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Apply
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-gray-200 text-sm cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}

          <span className="text-xs text-gray-500 ml-auto">
            {total.toLocaleString()} results
          </span>
        </div>

        {showFilters && (
          <div className="flex items-end gap-4 flex-wrap pt-2 bg-[#141414]/40 rounded-lg p-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  applyFilters({ typeFilter: e.target.value });
                }}
                className="px-3 py-2 bg-[#141414] border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#9B4A1E]"
              >
                {TX_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === "ALL" ? "All Types" : t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                Min Risk Score
              </label>
              <input
                type="number"
                value={minRisk}
                onChange={(e) => {
                  setMinRisk(e.target.value);
                  applyFilters({ minRisk: e.target.value });
                }}
                placeholder="0"
                className="w-28 px-3 py-2 bg-[#141414] border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#9B4A1E]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  applyFilters({ startDate: e.target.value });
                }}
                className="px-3 py-2 bg-[#141414] border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#9B4A1E]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  applyFilters({ endDate: e.target.value });
                }}
                className="px-3 py-2 bg-[#141414] border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-[#9B4A1E]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Scrollable table wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#141414]/60 border-b border-[#2A2A2A]">
              <th
                className={`${thClass} min-w-[120px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("txId")}
              >
                <span className="inline-flex items-center gap-1">
                  ID
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "txId" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
                <span className="block text-xs text-gray-500 font-normal mt-0.5">open details</span>
              </th>
              <th
                className={`${thClass} min-w-[160px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("timestamp")}
              >
                <span className="inline-flex items-center gap-1">
                  Date
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "timestamp" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
              </th>
              <th
                className={`${thClass} min-w-[100px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("type")}
              >
                <span className="inline-flex items-center gap-1">
                  Type
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "type" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
              </th>
              <th
                className={`${thClass} min-w-[120px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("amount")}
              >
                <span className="inline-flex items-center gap-1">
                  Amount
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "amount" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
              </th>
              <th
                className={`${thClass} min-w-[130px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("nameOrig")}
              >
                <span className="inline-flex items-center gap-1">
                  Origin
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "nameOrig" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
                <span className="block text-xs text-gray-500 font-normal mt-0.5">open account</span>
              </th>
              <th
                className={`${thClass} min-w-[130px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("nameDest")}
              >
                <span className="inline-flex items-center gap-1">
                  Dest
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "nameDest" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
                <span className="block text-xs text-gray-500 font-normal mt-0.5">open account</span>
              </th>
              <th
                className={`${thClass} min-w-[100px] cursor-pointer hover:text-gray-200`}
                onClick={() => handleSort("risk_score")}
              >
                <span className="inline-flex items-center gap-1">
                  Risk
                  <ArrowUpDown className={`w-3 h-3 ${sortBy === "risk_score" ? "text-[#C4622A]" : "text-gray-600"}`} />
                </span>
                <span className="block text-xs text-gray-500 font-normal mt-0.5">hover to expand</span>
              </th>
              <th className={`${thClass} min-w-[200px]`}>Rules Fired</th>
              <th className={`${thClass} min-w-[100px]`}>Status</th>
              <th className={`${thClass} min-w-[100px]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#2A2A2A]/40">
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-8 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-700 rounded animate-pulse" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-700 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-gray-700/30 rounded-full">
                      <ShieldAlert className="w-8 h-8 text-gray-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">No transactions match your filters</p>
                    <p className="text-xs text-gray-500">Try adjusting your search criteria or clearing the filters</p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Clear Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr
                  key={tx.txId}
                  className={`border-b border-[#2A2A2A]/40 hover:bg-gray-700/30 transition-colors ${
                    tx.risk_score >= 75
                      ? "border-l-[3px] border-l-red-500"
                      : tx.risk_score >= 50
                        ? "border-l-[3px] border-l-orange-500"
                        : tx.risk_score >= 25
                          ? "border-l-[3px] border-l-yellow-500"
                          : tx.risk_score > 0
                            ? "border-l-[3px] border-l-blue-500"
                            : "border-l-[3px] border-l-transparent"
                  }`}
                >
                  <td className="px-4 py-2.5 font-mono text-xs overflow-hidden text-ellipsis">
                    <button
                      type="button"
                      onClick={() => setSelectedTx(tx)}
                      className="inline-flex items-center gap-1.5 text-[#C4622A] hover:text-[#D4824A] hover:underline cursor-pointer group/tx"
                      title="Click to view details"
                    >
                      {tx.txId}
                      <Eye className="w-3 h-3 opacity-0 group-hover/tx:opacity-60 transition-opacity" />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">
                    {tx.timestamp}
                  </td>
                  <td className="px-4 py-2.5">
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
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-200 text-right">
                    {tx.amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs overflow-hidden text-ellipsis">
                    <Link
                      href={`/account/${tx.nameOrig}`}
                      className="text-[#C4622A] hover:text-[#D4824A] hover:underline"
                    >
                      {tx.nameOrig}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs overflow-hidden text-ellipsis">
                    <Link
                      href={`/account/${tx.nameDest}`}
                      className="text-[#C4622A] hover:text-[#D4824A] hover:underline"
                    >
                      {tx.nameDest}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <RiskBadge score={tx.risk_score} rulesJson={tx.fired_rules} />
                  </td>
                  <td className="px-4 py-2.5">
                    <RulesTags rulesJson={tx.fired_rules} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={tx.reviewed_status} />
                  </td>
                  <td className="px-4 py-2.5">
                    {tx.risk_score > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleReview(
                              tx.txId,
                              tx.reviewed_status === "false_positive"
                                ? null
                                : "false_positive"
                            )
                          }
                          title="Mark as False Positive"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                            tx.reviewed_status === "false_positive"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "text-gray-500 hover:text-green-400 hover:bg-green-500/10 border-gray-600"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                          FP
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleReview(
                              tx.txId,
                              tx.reviewed_status === "confirmed_suspicious"
                                ? null
                                : "confirmed_suspicious"
                            )
                          }
                          title="Confirm Suspicious"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                            tx.reviewed_status === "confirmed_suspicious"
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : "text-gray-500 hover:text-red-400 hover:bg-red-500/10 border-gray-600"
                          }`}
                        >
                          <ShieldX className="w-3.5 h-3.5 flex-shrink-0" />
                          Sus
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-[#2A2A2A] flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-gray-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button
                type="button"
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                  p === page
                    ? "bg-[#9B4A1E] text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <TransactionModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onReview={(txId, status) => {
            handleReview(txId, status);
            setSelectedTx((prev) =>
              prev && prev.txId === txId
                ? { ...prev, reviewed_status: status }
                : prev
            );
          }}
        />
      )}
    </div>
  );
}
