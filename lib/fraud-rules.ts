// Weighted additive risk model — chosen over ML classification because compliance
// requires explainability. An analyst must justify every flag to regulators with
// specific rule citations, not model probabilities. Additive scoring also lets
// analysts mentally combine and weigh signals during review.

export interface Transaction {
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
}

export interface RuleResult {
  rule: string;
  points: number;
}

export interface FraudAnalysis {
  riskScore: number;
  firedRules: RuleResult[];
}

// Rule 1: Balance Drain (+40 pts) — highest weight because zeroing an account is
// the strongest single indicator of unauthorized access. Account takeover attacks
// almost always drain the full balance in one transaction to minimize the window
// for detection. A zero remaining balance is a much stronger signal than just
// "large amount" — legitimate large transfers rarely leave exactly zero.
function balanceDrain(tx: Transaction): RuleResult | null {
  if (
    (tx.type === "TRANSFER" || tx.type === "CASH_OUT") &&
    tx.newbalanceOrig === 0 &&
    tx.oldbalanceOrig > 0
  ) {
    return { rule: "Balance Drain", points: 40 };
  }
  return null;
}

// Rule 2: Anomalous Amount (+25 pts) — per-type normalization is critical here.
// A R$500k CASH_IN is normal (business deposits), but a R$500k TRANSFER is an
// extreme outlier. Computing separate μ and σ per transaction type catches
// contextually unusual behavior, not just big numbers. The 3σ threshold follows
// Chebyshev's inequality — captures the ~0.3% distribution tail.
export interface TypeStats {
  mean: number;
  std: number;
}

function anomalousAmount(
  tx: Transaction,
  stats: Record<string, TypeStats>
): RuleResult | null {
  const s = stats[tx.type];
  if (s && tx.amount > s.mean + 3 * s.std) {
    return { rule: "Anomalous Amount", points: 25 };
  }
  return null;
}

// Rule 3: Suspicious Hours (+10 pts) — the 00:00–05:00 window is a known blind
// spot: human oversight is minimal, automated monitoring runs batch jobs, and
// customer service is unavailable for victims to report compromises. Low weight
// because timing alone is weak evidence — this rule is designed to compound with
// other signals, not flag independently. The R$10k floor filters routine activity.
function suspiciousHours(tx: Transaction): RuleResult | null {
  const hour = new Date(tx.timestamp).getHours();
  if (hour >= 0 && hour < 5 && tx.amount > 10000) {
    return { rule: "Suspicious Hours", points: 10 };
  }
  return null;
}

// Rule 4: Round Amount (+5 pts) — behavioral fingerprint of structured fraud.
// Legitimate transactions reflect real prices (R$47,329.84). Fraudsters construct
// transactions with clean numbers (R$100,000) because they're moving money, not
// paying for goods. Well-documented in FATF money laundering typologies. Lowest
// weight because round amounts also occur in legitimate wire transfers.
function roundAmount(tx: Transaction): RuleResult | null {
  if (tx.amount > 50000 && tx.amount % 1 === 0) {
    return { rule: "Round Amount", points: 5 };
  }
  return null;
}

// Rule 5: Repeated Origin (+15 pts) — accounts that appear as origin in 3+
// suspicious transactions are strong indicators of systematic fraud or account
// compromise. In fraud networks, money mules or hijacked accounts are reused to
// move funds repeatedly. A single suspicious transaction could be coincidence —
// but recurrence across multiple flagged transactions signals coordinated abuse.
function repeatedOrigin(
  tx: Transaction,
  allTransactions: Transaction[]
): RuleResult | null {
  const sameOriginFlagged = allTransactions.filter(
    (t) =>
      t.nameOrig === tx.nameOrig &&
      t.txId !== tx.txId &&
      (
        // Balance drain condition
        (["TRANSFER", "CASH_OUT"].includes(t.type) &&
          t.newbalanceOrig === 0 &&
          t.oldbalanceOrig > 0) ||
        // High-value outlier
        t.amount > 50000
      )
  );
  if (sameOriginFlagged.length >= 2) {
    return { rule: "Repeated Origin", points: 15 };
  }
  return null;
}

export const MAX_SCORE = 100;

export function analyzeTransaction(
  tx: Transaction,
  stats: Record<string, TypeStats>,
  allTransactions: Transaction[] = []
): FraudAnalysis {
  const checks = [
    balanceDrain(tx),
    anomalousAmount(tx, stats),
    suspiciousHours(tx),
    roundAmount(tx),
    repeatedOrigin(tx, allTransactions),
  ];

  const firedRules = checks.filter((r): r is RuleResult => r !== null);
  const riskScore = Math.min(MAX_SCORE, firedRules.reduce((sum, r) => sum + r.points, 0));

  return { riskScore, firedRules };
}

// Per-type statistical normalization — grouping by transaction type before computing
// μ and σ is essential because the amount distributions are radically different.
// PAYMENT transactions cluster around small values; TRANSFER spans orders of magnitude.
// A single global threshold would either miss TRANSFER anomalies or flood PAYMENT
// with false positives.
export function computeTypeStats(
  transactions: Transaction[]
): Record<string, TypeStats> {
  const grouped: Record<string, number[]> = {};

  for (const tx of transactions) {
    if (!grouped[tx.type]) grouped[tx.type] = [];
    grouped[tx.type].push(tx.amount);
  }

  const stats: Record<string, TypeStats> = {};
  for (const [type, amounts] of Object.entries(grouped)) {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, v) => sum + (v - mean) ** 2, 0) / amounts.length;
    const std = Math.sqrt(variance);
    stats[type] = { mean, std };
  }

  return stats;
}
