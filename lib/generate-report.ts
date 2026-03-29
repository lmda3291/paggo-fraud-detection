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
}

const RULE_DETAILS: Record<string, { points: number; description: string }> = {
  "Balance Drain": { points: 40, description: "Account balance dropped to zero after outgoing transfer" },
  "Anomalous Amount": { points: 25, description: "Amount is 3+ standard deviations above type average" },
  "Repeated Origin": { points: 15, description: "Account appears as origin in 3+ flagged transactions" },
  "Suspicious Hours": { points: 10, description: "Transaction between midnight and 5am with amount > R$10k" },
  "Round Amount": { points: 5, description: "Suspiciously round value above R$50k" },
};

export async function generateAccountReport(data: AccountData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF("p", "mm", "a4") as unknown as { internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    autoTable: (options: Record<string, unknown>) => void;
    lastAutoTable: { finalY: number };
  };

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Paggo brand colors
  const terracotta = [155, 74, 30] as const;       // #9B4A1E
  const terracottaLight = [196, 98, 42] as const;  // #C4622A
  const darkBg = [26, 26, 26] as const;            // #1A1A1A
  const nearBlack = [20, 20, 20] as const;          // #141414
  const textDark = [40, 40, 40] as const;
  const gray = [120, 120, 120] as const;
  const grayLight = [160, 160, 160] as const;

  function drawLogo(x: number, y: number, size: number) {
    const s = size / 32;
    // Black rounded rect background
    doc.setFillColor(...nearBlack);
    doc.roundedRect(x, y, size, size, 2 * s, 2 * s, "F");

    // Draw two white shapes (square with S-curve cutout)
    // Top-left white region
    doc.setFillColor(255, 255, 255);

    // Approximate the S-curve shapes as triangular/polygonal regions
    // Top-left piece
    const tlPoints = [
      [5 * s, 5 * s],   // top-left corner
      [21 * s, 5 * s],  // top edge end
      [18 * s, 10 * s], // curve point
      [16 * s, 14 * s], // center-ish
      [12 * s, 16 * s], // curve point
      [5 * s, 20 * s],  // left edge
    ];
    // Draw as filled polygon
    doc.setFillColor(255, 255, 255);
    const tlLines = [];
    for (let i = 1; i < tlPoints.length; i++) {
      tlLines.push([tlPoints[i][0] - tlPoints[i - 1][0], tlPoints[i][1] - tlPoints[i - 1][1]]);
    }
    doc.lines(tlLines, x + tlPoints[0][0], y + tlPoints[0][1], [1, 1], "F", true);

    // Bottom-right piece
    const brPoints = [
      [27 * s, 12 * s],  // right edge
      [27 * s, 27 * s],  // bottom-right corner
      [11 * s, 27 * s],  // bottom edge
      [14 * s, 22 * s],  // curve point
      [16 * s, 18 * s],  // center-ish
      [20 * s, 16 * s],  // curve point
    ];
    const brLines = [];
    for (let i = 1; i < brPoints.length; i++) {
      brLines.push([brPoints[i][0] - brPoints[i - 1][0], brPoints[i][1] - brPoints[i - 1][1]]);
    }
    doc.lines(brLines, x + brPoints[0][0], y + brPoints[0][1], [1, 1], "F", true);
  }

  function addFooter() {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...terracotta);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text("Detection System by Paggo — Confidential", margin, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    }
  }

  function sectionTitle(title: string, y: number): number {
    doc.setFontSize(13);
    doc.setTextColor(...terracotta);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    doc.setDrawColor(...terracotta);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 1.5, margin + contentWidth, y + 1.5);
    return y + 8;
  }

  function checkPageBreak(y: number, needed: number): number {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      return 20;
    }
    return y;
  }

  // === PAGE 1 — BRANDED HEADER BAR ===
  // Dark header bar
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, pageWidth, 42, "F");

  // Terracotta accent line at bottom of header
  doc.setFillColor(...terracotta);
  doc.rect(0, 42, pageWidth, 1.5, "F");

  // Logo
  drawLogo(margin, 7, 12);

  // Title text
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DETECTION SYSTEM", margin + 16, 16);

  doc.setFontSize(10);
  doc.setTextColor(...terracottaLight);
  doc.setFont("helvetica", "normal");
  doc.text("by Paggo", margin + 16 + doc.getTextWidth("DETECTION SYSTEM "), 16);

  // Subtitle
  doc.setFontSize(9);
  doc.setTextColor(...grayLight);
  doc.text("Compliance Investigation Report — Confidential", margin + 16, 22);

  // Risk badge on the right
  const riskLevel = data.summary.riskLevel;
  const badgeWidth = 36;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(...terracotta);
  doc.roundedRect(badgeX, 8, badgeWidth, 12, 3, 3, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(riskLevel, badgeX + badgeWidth / 2, 15.5, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(...grayLight);
  doc.text(`Score: ${data.summary.maxRiskScore}/100`, badgeX + badgeWidth / 2, 24, { align: "center" });

  // Account info below header bar
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.setFont("helvetica", "normal");
  const now = new Date();
  const dateStr = `${now.toLocaleDateString("pt-BR")}, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  doc.text(`Account: ${data.accountId}`, margin, 52);
  doc.text(`Generated: ${dateStr}`, margin, 58);

  let y = 68;

  // === SECTION 1 — ACCOUNT SUMMARY ===
  y = sectionTitle("Account Summary", y);

  const allTx = [...data.asOrigin, ...data.asDest];
  const flaggedTx = allTx.filter((tx) => tx.risk_score > 0);
  const amountAtRisk = flaggedTx.reduce((sum, tx) => sum + tx.amount, 0);
  const highRiskRelated = data.relatedAccounts.filter((r) => r.maxRisk > 0);

  (doc as Record<string, unknown>).autoTable = (doc as Record<string, unknown>).autoTable || (() => {});


  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fillColor: [...nearBlack], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [...textDark] },
    alternateRowStyles: { fillColor: [248, 245, 242] },
    styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      [
        "Total Transactions", String(data.summary.totalTransactions),
        "Flagged Transactions", String(data.summary.flaggedCount),
      ],
      [
        "Total Volume", `R$ ${data.summary.totalVolume.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        "Amount at Risk", `R$ ${amountAtRisk.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      ],
      [
        "Related Accounts", String(data.relatedAccounts.length),
        "Review Period", "January 2025",
      ],
      [
        "Max Risk Score", `${data.summary.maxRiskScore}/100`,
        "Risk Level", riskLevel,
      ],
    ],
    didParseCell: (hookData: { section: string; column: { index: number }; cell: { styles: { fontStyle: string } } }) => {
      if (hookData.section === "body" && (hookData.column.index === 0 || hookData.column.index === 2)) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });


  y = doc.lastAutoTable.finalY + 12;

  // === SECTION 2 — FRAUD RULES TRIGGERED ===
  y = checkPageBreak(y, 40);
  y = sectionTitle("Fraud Rules Triggered", y);

  const ruleRows = Object.entries(data.ruleCounts)
    .sort((a, b) => {
      const pointsA = RULE_DETAILS[a[0]]?.points || 0;
      const pointsB = RULE_DETAILS[b[0]]?.points || 0;
      return pointsB - pointsA;
    })
    .map(([rule, count]) => {
      const details = RULE_DETAILS[rule] || { points: 0, description: "Unknown rule" };
      return [rule, `${count}×`, `+${details.points} pts`, details.description];
    });

  if (ruleRows.length > 0) {
  
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [...nearBlack], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [...textDark] },
      alternateRowStyles: { fillColor: [248, 245, 242] },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
      head: [["Rule", "Times Fired", "Points Added", "Description"]],
      body: ruleRows,
      columnStyles: {
        2: { textColor: [...terracotta], fontStyle: "bold" },
      },
    });
  
    y = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...gray);
    doc.text("No fraud rules triggered for this account.", margin, y);
    y += 12;
  }

  // === SECTION 3 — FLAGGED TRANSACTIONS ===
  y = checkPageBreak(y, 40);
  y = sectionTitle("Flagged Transactions", y);

  // Deduplicate transactions
  const txMap = new Map<string, Transaction>();
  for (const tx of allTx) {
    if (tx.risk_score > 0) txMap.set(tx.txId, tx);
  }
  const flaggedUnique = Array.from(txMap.values()).sort((a, b) => b.risk_score - a.risk_score);

  if (flaggedUnique.length > 0) {
    const txRows = flaggedUnique.map((tx) => {
      const rules = JSON.parse(tx.fired_rules || "[]") as { rule: string }[];
      const ruleNames = rules.map((r) => r.rule).join(", ");
      const dest = tx.nameOrig === data.accountId ? tx.nameDest : tx.nameOrig;
      return [
        tx.txId,
        tx.timestamp.split(" ")[0],
        tx.type,
        tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        dest,
        `${tx.risk_score}/100`,
        ruleNames,
      ];
    });

  
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [...terracotta], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [...textDark] },
      alternateRowStyles: { fillColor: [248, 245, 242] },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
      head: [["TX ID", "Date", "Type", "Amount (R$)", "Destination", "Score", "Rules"]],
      body: txRows,
      columnStyles: {
        5: { textColor: [...terracotta], fontStyle: "bold", halign: "center" as const },
      },
    });
  
    y = doc.lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...gray);
    doc.text("No flagged transactions for this account.", margin, y);
    y += 12;
  }

  // === SECTION 4 — RELATED HIGH-RISK ACCOUNTS ===
  y = checkPageBreak(y, 40);
  y = sectionTitle("Related High-Risk Accounts", y);

  if (highRiskRelated.length > 0) {
    const relRows = highRiskRelated
      .sort((a, b) => b.maxRisk - a.maxRisk)
      .map((r) => [
        r.account,
        String(r.txCount),
        `R$ ${r.totalVolume.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${r.maxRisk}/100`,
      ]);

  
    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [...nearBlack], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [...textDark] },
      alternateRowStyles: { fillColor: [248, 245, 242] },
      styles: { lineColor: [200, 200, 200], lineWidth: 0.2 },
      head: [["Account ID", "Transactions", "Volume (R$)", "Max Risk Score"]],
      body: relRows,
      columnStyles: {
        3: { textColor: [...terracotta], fontStyle: "bold", halign: "center" as const },
      },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...gray);
    doc.text("No related high-risk accounts found.", margin, y);
  }

  // Add footers to all pages
  addFooter();

  // Save
  const dateFile = now.toISOString().split("T")[0];
  doc.save(`paggo-report-${data.accountId}-${dateFile}.pdf`);
}
