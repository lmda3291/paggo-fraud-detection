import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get('search') || '';
  const type     = searchParams.get('type') || '';
  const minRisk  = searchParams.get('minRisk') || '0';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo   = searchParams.get('dateTo') || '';

  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (search) {
    conditions.push('(txId LIKE ? OR nameOrig LIKE ? OR nameDest LIKE ?)');
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (type) { conditions.push('type = ?'); args.push(type); }
  if (Number(minRisk) > 0) { conditions.push('risk_score >= ?'); args.push(Number(minRisk)); }
  if (dateFrom) { conditions.push('timestamp >= ?'); args.push(dateFrom); }
  if (dateTo) { conditions.push('timestamp <= ?'); args.push(dateTo + ' 23:59:59'); }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db.execute({
    sql: `SELECT txId, timestamp, type, amount, nameOrig, nameDest, oldbalanceOrig, newbalanceOrig, oldbalanceDest, newbalanceDest, risk_score as riskScore, fired_rules as rulesFired, reviewed_status as reviewedStatus FROM transactions ${whereClause} ORDER BY risk_score DESC, amount DESC`,
    args,
  });

  const rows = result.rows as unknown as {
    txId: string; timestamp: string; type: string; amount: number;
    nameOrig: string; nameDest: string; oldbalanceOrig: number; newbalanceOrig: number;
    oldbalanceDest: number; newbalanceDest: number; riskScore: number;
    rulesFired: string; reviewedStatus: string | null;
  }[];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Paggo Fraud Detection System';
  wb.created = new Date();

  const ws = wb.addWorksheet('Fraud Report', {
    views: [{ state: 'frozen' as const, ySplit: 1 }],
    properties: { defaultRowHeight: 15 },
  });

  ws.columns = [
    { header: 'Transaction ID',             key: 'txId',             width: 16 },
    { header: 'Date & Time',                key: 'timestamp',        width: 20 },
    { header: 'Type',                        key: 'type',             width: 12 },
    { header: 'Amount (R$)',                 key: 'amount',           width: 18 },
    { header: 'Origin Account',              key: 'nameOrig',         width: 16 },
    { header: 'Origin Balance Before (R$)',  key: 'oldbalanceOrig',   width: 24 },
    { header: 'Origin Balance After (R$)',   key: 'newbalanceOrig',   width: 24 },
    { header: 'Destination Account',         key: 'nameDest',         width: 16 },
    { header: 'Dest. Balance Before (R$)',   key: 'oldbalanceDest',   width: 24 },
    { header: 'Dest. Balance After (R$)',    key: 'newbalanceDest',   width: 24 },
    { header: 'Risk Score',                  key: 'riskScore',        width: 12 },
    { header: 'Risk Level',                  key: 'riskLevel',        width: 12 },
    { header: 'Rules Fired',                 key: 'rulesFired',       width: 38 },
    { header: 'Analyst Review',              key: 'review',           width: 22 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font      = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = {
      top:    { style: 'medium', color: { argb: 'FF3B82F6' } },
      bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      left:   { style: 'thin',  color: { argb: 'FFCBD5E1' } },
      right:  { style: 'thin',  color: { argb: 'FFCBD5E1' } },
    };
  });

  const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (v: string) => { if (!v) return ''; const d = new Date(v); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR'); };
  const getRiskLabel = (s: number) => { if (s >= 75) return 'Critical'; if (s >= 50) return 'High'; if (s >= 25) return 'Medium'; if (s > 0) return 'Low'; return 'Clean'; };
  const getReviewLabel = (s: string | null) => { if (s === 'confirmed_suspicious') return 'Confirmed Suspicious'; if (s === 'false_positive') return 'False Positive'; return 'Pending Review'; };
  const parseRules = (r: string) => { try { const parsed = JSON.parse(r || '[]') as { rule: string }[]; return parsed.map(x => x.rule).join(' | '); } catch { return r || 'None'; } };

  const typeColors: Record<string, { bg: string; fg: string }> = {
    TRANSFER: { bg: 'FFDBEAFE', fg: 'FF1D4ED8' }, CASH_OUT: { bg: 'FFFCE7F3', fg: 'FF9D174D' },
    CASH_IN:  { bg: 'FFDCFCE7', fg: 'FF15803D' }, PAYMENT:  { bg: 'FFF3E8FF', fg: 'FF6B21A8' }, DEBIT: { bg: 'FFFEF3C7', fg: 'FF92400E' },
  };
  const riskColors: Record<string, { bg: string; fg: string; rowBg: string }> = {
    Critical: { bg: 'FFFEE2E2', fg: 'FF991B1B', rowBg: 'FFFFF5F5' }, High: { bg: 'FFFFEDD5', fg: 'FF9A3412', rowBg: 'FFFFFAF5' },
    Medium:   { bg: 'FFFEF9C3', fg: 'FF713F12', rowBg: 'FFFFFFF8' }, Low:  { bg: 'FFDBEAFE', fg: 'FF1E40AF', rowBg: 'FFFFFEFF' }, Clean: { bg: 'FFDCFCE7', fg: 'FF166534', rowBg: 'FFFFFFFF' },
  };

  rows.forEach((r, i) => {
    const riskLabel = getRiskLabel(r.riskScore);
    const riskColor = riskColors[riskLabel] || riskColors.Clean;
    const isEven = i % 2 === 0;
    const rowBg = r.riskScore > 0 ? riskColor.rowBg : (isEven ? 'FFF8FAFC' : 'FFFFFFFF');
    const dataRow = ws.addRow({ txId: r.txId, timestamp: fmtDate(r.timestamp), type: r.type, amount: fmt(r.amount), nameOrig: r.nameOrig, oldbalanceOrig: fmt(r.oldbalanceOrig), newbalanceOrig: fmt(r.newbalanceOrig), nameDest: r.nameDest, oldbalanceDest: fmt(r.oldbalanceDest), newbalanceDest: fmt(r.newbalanceDest), riskScore: r.riskScore, riskLevel: riskLabel, rulesFired: parseRules(r.rulesFired), review: getReviewLabel(r.reviewedStatus) });
    const rowColor = r.riskScore > 0 ? riskColor.fg : 'FF1E293B';
    const cellBorder: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
    dataRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.border = cellBorder; cell.alignment = { vertical: 'middle' }; cell.font = { name: 'Arial', size: 9, color: { argb: rowColor } }; });
    dataRow.getCell(1).font = { name: 'Courier New', bold: true, size: 9, color: { argb: rowColor } };
    const tc = typeColors[r.type];
    if (tc) { const typeCell = dataRow.getCell(3); typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tc.bg } }; typeCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: tc.fg } }; typeCell.alignment = { horizontal: 'center', vertical: 'middle' }; }
    const amtCell = dataRow.getCell(4); amtCell.alignment = { horizontal: 'right', vertical: 'middle' }; amtCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: rowColor } };
    [5, 8].forEach(col => { dataRow.getCell(col).font = { name: 'Courier New', size: 9, color: { argb: 'FF475569' } }; });
    const rsCell = dataRow.getCell(11); rsCell.alignment = { horizontal: 'center', vertical: 'middle' }; rsCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: rowColor } };
    const rlCell = dataRow.getCell(12); rlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: riskColor.bg } }; rlCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: riskColor.fg } }; rlCell.alignment = { horizontal: 'center', vertical: 'middle' };
    const reviewCell = dataRow.getCell(14); const rv = r.reviewedStatus;
    if (rv === 'confirmed_suspicious') { reviewCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF991B1B' } }; }
    else if (rv === 'false_positive') { reviewCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FF166534' } }; }
    else { reviewCell.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } }; }
  });

  ws.autoFilter = { from: 'A1', to: 'N1' };

  const wss = wb.addWorksheet('Summary');
  wss.columns = [{ width: 28 }, { width: 32 }];
  const flagged = rows.filter(r => r.riskScore > 0).length;
  const totalAmt = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const flaggedAmt = rows.filter(r => r.riskScore > 0).reduce((s, r) => s + (r.amount || 0), 0);
  const fraudRate = rows.length ? ((flagged / rows.length) * 100).toFixed(1) + '%' : '0%';

  const addTitle = (text: string) => { const row = wss.addRow([text, '']); wss.mergeCells(`A${row.number}:B${row.number}`); row.getCell(1).font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FFFFFFFF' } }; row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; row.height = 28; };
  const addSection = (label: string) => { wss.addRow(['', '']); const row = wss.addRow([label, '']); row.getCell(1).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }; row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }; row.height = 18; };
  const addStat = (label: string, value: string | number, i: number) => { const row = wss.addRow([label, value]); const bg = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF'; row.getCell(1).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF334155' } }; row.getCell(2).font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } }; [1, 2].forEach(c => { row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; row.getCell(c).alignment = { vertical: 'middle' }; }); row.height = 16; };

  addTitle('PAGGO FRAUD DETECTION - EXPORT SUMMARY');
  addSection('Transaction Statistics');
  ([['Total Transactions', rows.length], ['Flagged Transactions', flagged], ['Fraud Rate', fraudRate], ['Total Volume (R$)', fmt(totalAmt)], ['Amount at Risk (R$)', fmt(flaggedAmt)], ['Generated', new Date().toLocaleString('pt-BR')]] as [string, string | number][]).forEach(([l, v], i) => addStat(l, v, i));
  addSection('Filters Applied');
  ([['Search', search || 'None'], ['Type', type || 'All types'], ['Min Risk Score', minRisk || 'None'], ['Date From', dateFrom || 'None'], ['Date To', dateTo || 'None']] as [string, string][]).forEach(([l, v], i) => addStat(l, v, i));

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().split('T')[0];
  const suffix = [type && `-${type.toLowerCase()}`, Number(minRisk) > 0 && `-risk${minRisk}`].filter(Boolean).join('');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="paggo-report${suffix}-${date}.xlsx"`,
    },
  });
}
