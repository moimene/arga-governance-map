/**
 * SLODashboard
 *
 * Displays current SLO compliance status with three gauges:
 * - P95 Latency (target ≤ 800ms)
 * - Error Rate (target < 1%)
 * - Uptime (target 99.9%)
 *
 * Shows green when SLO is met, red when exceeded.
 * Uses Garrigues design tokens for consistent styling.
 */

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, TrendingDown } from "lucide-react";
import { getSLOMetrics, type SLOMetrics } from "@/lib/telemetry";

/**
 * SLO Gauge Component
 * Displays a single metric with status indicator
 */
interface SLOGaugeProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  isInverted?: boolean; // For metrics where lower is better (latency, error rate)
}

function SLOGauge({
  label,
  value,
  target,
  unit,
  isInverted = true,
}: SLOGaugeProps) {
  // Determine status: green if within target, red if exceeds
  const isMet = isInverted ? value <= target : value >= target;
  const statusColor = isMet
    ? "var(--status-success)" // Green
    : "var(--status-error)"; // Red
  const bgColor = isMet
    ? "var(--g-surface-subtle)" // Light green-ish surface
    : "var(--g-surface-muted)"; // Neutral muted for warning
  const borderColor = isMet
    ? "var(--g-border-subtle)"
    : "var(--status-error)";

  return (
    <div
      className="p-6 rounded-lg border transition-all"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      {/* Header with icon and label */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--g-text-primary)]">
          {label}
        </h3>
        {isMet ? (
          <CheckCircle2
            size={20}
            color={statusColor}
            strokeWidth={2}
          />
        ) : (
          <AlertCircle
            size={20}
            color={statusColor}
            strokeWidth={2}
          />
        )}
      </div>

      {/* Large value display */}
      <div className="mb-3">
        <div
          className="text-3xl font-bold"
          style={{ color: statusColor }}
        >
          {value.toFixed(value < 10 ? 1 : 0)}
          <span className="text-lg ml-1">{unit}</span>
        </div>
        <p className="text-xs text-[var(--g-text-secondary)] mt-1">
          Target: {target}
          {unit}
        </p>
      </div>

      {/* Status indicator bar */}
      <div className="w-full h-2 rounded-full bg-[var(--g-border-subtle)] overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min((value / target) * 100, 100)}%`,
            backgroundColor: statusColor,
          }}
        />
      </div>

      {/* Status text */}
      <p className="text-xs mt-3 font-medium">
        <span style={{ color: statusColor }}>
          {isMet ? "✓ SLO Met" : "⚠ SLO Exceeded"}
        </span>
      </p>
    </div>
  );
}

/**
 * SLODashboard - Main component
 * Queries telemetry and displays current SLO status
 */
export default function SLODashboard() {
  const [metrics, setMetrics] = useState<SLOMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch metrics on mount and set up polling
  useEffect(() => {
    const updateMetrics = () => {
      const sloMetrics = getSLOMetrics();
      setMetrics(sloMetrics);
      setLoading(false);
    };

    // Initial load
    updateMetrics();

    // Poll every 10 seconds
    const interval = setInterval(updateMetrics, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div
        className="p-8 rounded-lg border"
        style={{
          backgroundColor: "var(--g-surface-card)",
          borderColor: "var(--g-border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full animate-pulse bg-[var(--status-info)]" />
          <p className="text-sm text-[var(--g-text-secondary)]">
            Loading SLO metrics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown size={20} className="text-[var(--g-brand-3308)]" />
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            SLO Status
          </h2>
        </div>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Real-time service level objective compliance across TGMS Platform
        </p>
      </div>

      {/* Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* P95 Latency */}
        <SLOGauge
          label="P95 Latency"
          value={metrics.p95LatencyMs}
          target={metrics.targets.p95}
          unit="ms"
          isInverted={true}
        />

        {/* Error Rate */}
        <SLOGauge
          label="Error Rate"
          value={metrics.errorRate}
          target={1} // 1%
          unit="%"
          isInverted={true}
        />

        {/* Uptime */}
        <SLOGauge
          label="Uptime"
          value={metrics.uptimePercent}
          target={99.9}
          unit="%"
          isInverted={false}
        />
      </div>

      {/* SLO Targets Card */}
      <div
        className="p-6 rounded-lg border"
        style={{
          backgroundColor: "var(--g-surface-card)",
          borderColor: "var(--g-border-subtle)",
        }}
      >
        <h3 className="text-sm font-semibold text-[var(--g-text-primary)] mb-4">
          SLO Targets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[var(--g-text-secondary)] text-xs uppercase tracking-wide">
              P95 Latency
            </p>
            <p className="font-semibold text-[var(--g-text-primary)] mt-1">
              ≤ {metrics.targets.p95}ms
            </p>
          </div>
          <div>
            <p className="text-[var(--g-text-secondary)] text-xs uppercase tracking-wide">
              Error Rate
            </p>
            <p className="font-semibold text-[var(--g-text-primary)] mt-1">
              &lt; 1%
            </p>
          </div>
          <div>
            <p className="text-[var(--g-text-secondary)] text-xs uppercase tracking-wide">
              RPO
            </p>
            <p className="font-semibold text-[var(--g-text-primary)] mt-1">
              {metrics.targets.rpo}
            </p>
          </div>
          <div>
            <p className="text-[var(--g-text-secondary)] text-xs uppercase tracking-wide">
              RTO
            </p>
            <p className="font-semibold text-[var(--g-text-primary)] mt-1">
              {metrics.targets.rto}
            </p>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <p className="text-xs text-[var(--g-text-secondary)] px-1">
        SLO metrics are updated every 10 seconds. In production, data flows to
        Microsoft Sentinel via Edge Function for comprehensive observability.
      </p>
    </div>
  );
}
