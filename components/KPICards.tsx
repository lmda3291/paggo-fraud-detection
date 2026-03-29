"use client";

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ClipboardCheck,
} from "lucide-react";

interface ReviewStats {
  confirmedSuspicious: number;
  falsePositives: number;
  pendingReview: number;
  reviewRate: number;
}

interface KPICardsProps {
  total: number;
  flagged: number;
  fraudRate: number;
  amountAtRisk: number;
  loading?: boolean;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target: number, duration: number = 1500) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    startTime.current = null;

    function animate(timestamp: number) {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      setValue(eased * target);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    }

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration]);

  return value;
}

interface CardProps {
  title: string;
  children: React.ReactNode;
  subtitle: string;
  icon: React.ReactNode;
  bgColor: string;
}

function Card({ title, children, subtitle, icon, bgColor }: CardProps) {
  return (
    <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {title}
          </p>
          <div className="text-2xl font-bold">{children}</div>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-lg flex-shrink-0 ${bgColor}`}>{icon}</div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2.5 flex-1">
          <div className="h-3 w-28 bg-gray-700 rounded animate-pulse" />
          <div className="h-7 w-20 bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="w-10 h-10 bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function KPICards({
  total,
  flagged,
  fraudRate,
  amountAtRisk,
  loading,
}: KPICardsProps) {
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  const fetchReviewStats = () => {
    fetch("/api/stats/reviews")
      .then((res) => res.json())
      .then((data) => setReviewStats(data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchReviewStats();
    const handler = () => fetchReviewStats();
    window.addEventListener("review-updated", handler);
    return () => window.removeEventListener("review-updated", handler);
  }, []);

  const animatedTotal = useCountUp(total);
  const animatedFlagged = useCountUp(flagged);
  const animatedRate = useCountUp(fraudRate);
  const animatedAmount = useCountUp(amountAtRisk);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <div className="col-span-2 lg:col-span-1">
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <Card
        title="Total Transactions"
        subtitle="Transactions loaded"
        icon={<Activity className="w-5 h-5 text-[#C4622A]" />}
        bgColor="bg-[#C4622A]/10"
      >
        <span className="text-white">{Math.round(animatedTotal).toLocaleString()}</span>
      </Card>
      <Card
        title="Flagged Transactions"
        subtitle="Flagged for investigation"
        icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        bgColor="bg-amber-500/10"
      >
        <span className="text-amber-400">{Math.round(animatedFlagged).toLocaleString()}</span>
      </Card>
      <Card
        title="Fraud Rate"
        subtitle="Of all transactions"
        icon={<TrendingUp className="w-5 h-5 text-red-400" />}
        bgColor="bg-red-500/10"
      >
        <span className="text-red-400">{animatedRate.toFixed(1)}%</span>
      </Card>
      <Card
        title="Amount at Risk"
        subtitle="Total value of flagged transactions"
        icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
        bgColor="bg-emerald-500/10"
      >
        <span className="text-emerald-400">
          R$ {Math.round(animatedAmount).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </Card>
      <div className="col-span-2 lg:col-span-1">
        <Card
          title="Analyst Reviews"
          subtitle={
            reviewStats
              ? `${reviewStats.pendingReview} transactions still need review`
              : "Loading..."
          }
          icon={<ClipboardCheck className="w-5 h-5 text-[#C4622A]" />}
          bgColor="bg-[#C4622A]/10"
        >
          {reviewStats ? (
            <div>
              <span className="text-red-400">{reviewStats.confirmedSuspicious}</span>
              <span className="text-gray-500 mx-1">/</span>
              <span className="text-green-400">{reviewStats.falsePositives}</span>
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">
                confirmed · cleared
              </p>
            </div>
          ) : (
            <span className="text-gray-500">—</span>
          )}
        </Card>
      </div>
    </div>
  );
}
