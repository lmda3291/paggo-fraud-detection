"use client";

import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
  LabelList,
} from "recharts";

interface Transaction {
  timestamp: string;
  type: string;
  amount: number;
  risk_score: number;
}

interface ChartsProps {
  transactions: Transaction[];
}

const CustomTooltipStyle = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#f3f4f6",
  fontSize: "12px",
};

const RANK_COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#22c55e"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const sliceColor = d.fill || payload[0].color;
  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "10px 14px",
        minWidth: "190px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: sliceColor }} />
        <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13 }}>
          {d.name}
        </p>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0" }}>
        {d.value?.toLocaleString("pt-BR")} transactions ({d.percent}%)
      </p>
      <p style={{ color: sliceColor, fontSize: 12, fontWeight: 600, margin: "2px 0" }}>
        {d.fraudRate}% fraud rate ({d.flagged} flagged)
      </p>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomDot = (props: any) => {
  const { cx, cy, index } = props;
  if (cx === undefined || cy === undefined) return null;
  if (index > 3) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#1e293b"
        stroke="#f97316"
        strokeWidth={1.5}
        opacity={0.5}
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="white"
      stroke="#f97316"
      strokeWidth={2}
      opacity={1}
    />
  );
};

export default function Charts({ transactions }: ChartsProps) {
  // Daily volume
  const dailyVolume: Record<string, { date: string; count: number; flagged: number }> = {};
  for (const tx of transactions) {
    const day = tx.timestamp.split(" ")[0];
    if (!dailyVolume[day]) {
      dailyVolume[day] = { date: day, count: 0, flagged: 0 };
    }
    dailyVolume[day].count++;
    if (tx.risk_score > 0) dailyVolume[day].flagged++;
  }
  const dailyData = Object.values(dailyVolume).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Pie chart: by type with fraud rate + rank-based coloring
  const typeCounts: Record<string, { total: number; flagged: number }> = {};
  for (const tx of transactions) {
    if (!typeCounts[tx.type]) typeCounts[tx.type] = { total: 0, flagged: 0 };
    typeCounts[tx.type].total++;
    if (tx.risk_score > 0) typeCounts[tx.type].flagged++;
  }
  const totalTx = transactions.length;
  const pieData = Object.entries(typeCounts).map(([name, v]) => ({
    name,
    value: v.total,
    flagged: v.flagged,
    fraudRate: v.total > 0 ? Math.round((v.flagged / v.total) * 1000) / 10 : 0,
    percent: totalTx > 0 ? Math.round((v.total / totalTx) * 1000) / 10 : 0,
  }));

  // Rank by fraud rate descending to assign colors
  const rankedTypes = [...pieData].sort((a, b) => b.fraudRate - a.fraudRate);
  const typeColorMap: Record<string, string> = {};
  rankedTypes.forEach((entry, i) => {
    typeColorMap[entry.name] = RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)];
  });

  // Add fill color to each pie entry so the tooltip can read it
  const pieDataWithFill = pieData.map((entry) => ({
    ...entry,
    fill: typeColorMap[entry.name],
  }));

  // Amount distribution with fraud rate
  const ranges = [
    { label: "0\u20131k", min: 0, max: 1000 },
    { label: "1k\u201310k", min: 1000, max: 10000 },
    { label: "10k\u201350k", min: 10000, max: 50000 },
    { label: "50k\u2013100k", min: 50000, max: 100000 },
    { label: "100k\u2013500k", min: 100000, max: 500000 },
    { label: "500k+", min: 500000, max: Infinity },
  ];
  const histogramData = ranges.map((r) => {
    const inRange = transactions.filter(
      (tx) => tx.amount >= r.min && tx.amount < r.max
    );
    const total = inRange.length;
    const flagged = inRange.filter((tx) => tx.risk_score > 0).length;
    return {
      range: r.label,
      total,
      flagged,
      fraudRate: total > 0 ? Math.round((flagged / total) * 1000) / 10 : 0,
      lowSample: total < 5,
    };
  });

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily Volume — Dual Axis */}
      <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 bg-[#C4622A] rounded-full" />
          <h3 className="text-xl font-bold text-white tracking-tight">
            Daily Transaction Volume
          </h3>
        </div>
        <p className="text-sm text-gray-400 mt-1 ml-3">
          How many transactions happened each day, and how many raised flags
        </p>
        <div className="mt-4">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              tickFormatter={(v: string) => v.split("-")[2]}
              stroke="#4b5563"
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              stroke="#4b5563"
              label={{ value: "Total", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10, dx: -5 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#fca5a5", fontSize: 11 }}
              stroke="#4b5563"
              label={{ value: "Flagged", angle: 90, position: "insideRight", fill: "#fca5a5", fontSize: 10, dx: 5 }}
            />
            <Tooltip
              contentStyle={CustomTooltipStyle}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Bar
              yAxisId="left"
              dataKey="count"
              name="Total Transactions"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
              opacity={0.8}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="flagged"
              name="Flagged Transactions"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#ef4444", stroke: "#1f2937", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      {/* Type Distribution Donut — Rank-based color */}
      <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 bg-[#C4622A] rounded-full" />
          <h3 className="text-xl font-bold text-white tracking-tight">
            Transaction Type Distribution
          </h3>
        </div>
        <p className="text-sm text-gray-400 mt-1 ml-3">
          Which transaction types carry the most fraud risk
        </p>
        <div className="mt-4">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={pieDataWithFill}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={98}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              label={({ cx, cy, midAngle, outerRadius: or, name, payload }) => {
                const RADIAN = Math.PI / 180;
                const radius = (or ?? 98) + 20;
                const x = (cx ?? 0) + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
                const y = (cy ?? 0) + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
                const fr = payload.fraudRate;
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={x > (cx ?? 0) ? "start" : "end"}
                    dominantBaseline="central"
                  >
                    <tspan x={x} dy="-0.5em" fontSize={12} fontWeight={600} fill="#d1d5db">
                      {name}
                    </tspan>
                    <tspan x={x} dy="1.3em" fontSize={11} fill="#9ca3af">
                      {fr}% fraud rate
                    </tspan>
                  </text>
                );
              }}
              labelLine={{ stroke: "#4b5563", strokeWidth: 1 }}
            >
              {pieDataWithFill.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
            {/* Center label */}
            <text x="50%" y="42%" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize={22} fontWeight={700}>
              {transactions.length.toLocaleString()}
            </text>
            <text x="50%" y="51%" textAnchor="middle" dominantBaseline="central" fill="#6b7280" fontSize={11}>
              transactions
            </text>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11 }}>
          <span className="text-gray-400"><span style={{ color: "#ef4444" }}>●</span> High fraud rate</span>
          <span className="text-gray-400"><span style={{ color: "#f97316" }}>●</span> Medium</span>
          <span className="text-gray-400"><span style={{ color: "#3b82f6" }}>●</span> Low</span>
          <span className="text-gray-400"><span style={{ color: "#22c55e" }}>●</span> Minimal</span>
        </div>
        </div>
      </div>
    </div>

    {/* Amount Distribution — Bar + Fraud Rate Line */}
    <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-6 bg-[#C4622A] rounded-full" />
        <h3 className="text-xl font-bold text-white tracking-tight">
          Amount Distribution
        </h3>
      </div>
      <p className="text-sm text-gray-400 mt-1 ml-3">
        Most fraud concentrates in high-value transactions — see where risk spikes
      </p>
      <div className="mt-4">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={histogramData} margin={{ top: 20, right: 50, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="range"
            tick={{ fill: "#d1d5db", fontSize: 12 }}
            stroke="#4b5563"
            angle={-15}
            textAnchor="end"
            height={45}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            stroke="#4b5563"
            label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10, dx: -5 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#fca5a5", fontSize: 11 }}
            stroke="#4b5563"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            label={{ value: "Fraud Rate", angle: 90, position: "insideRight", fill: "#fca5a5", fontSize: 10, dx: 5 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { range: string; total: number; flagged: number; fraudRate: number; lowSample: boolean };
              return (
                <div style={CustomTooltipStyle} className="px-3 py-2.5 shadow-xl">
                  <p className="text-xs font-semibold text-gray-200 mb-1.5">{label}</p>
                  <p className="text-[11px] text-gray-400">
                    Total: <span className="text-[#C4622A] font-mono">{d.total.toLocaleString()}</span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Flagged: <span className="text-red-400 font-mono">{d.flagged.toLocaleString()}</span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Sample size: <span className="text-gray-300 font-mono">{d.total} transactions</span>
                    {d.lowSample && <span className="text-yellow-400 ml-1">(low sample)</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Fraud rate: <span className="text-orange-400 font-semibold">{d.fraudRate}%</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="total"
            name="Total Transactions"
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
            opacity={0.8}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="fraudRate"
            name="Fraud Rate"
            stroke="#f97316"
            strokeWidth={3}
            dot={<CustomDot />}
            activeDot={{ r: 7, fill: "#f97316" }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="fraudRate"
              content={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((props: any) => {
                  const { x, y, value, index } = props;
                  if (x == null || y == null || value == null || index == null) return null;
                  if (index > 3) return null;
                  return (
                    <text
                      x={Number(x)}
                      y={Number(y) - 10}
                      fill="#f97316"
                      fontSize={11}
                      textAnchor="middle"
                      fontWeight={600}
                    >
                      {value}%
                    </text>
                  );
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any
              }
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
    </div>
  );
}
