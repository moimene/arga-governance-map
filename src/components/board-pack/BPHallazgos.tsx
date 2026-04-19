import { BPSection } from "./BPSection";
import { BoardPackFinding } from "@/hooks/useBoardPackData";

interface BPHallazgosProps {
  findings: BoardPackFinding[];
}

const SEVERITY_ORDER: Record<string, number> = {
  Crítico: 0,
  Alto: 1,
  Medio: 2,
  Bajo: 3,
};

const SEVERITY_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const PLAN_STATUS_CHIP: Record<string, string> = {
  "En progreso": "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  "En curso":    "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  "Completado":  "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  "Pendiente":   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 75
      ? "bg-[var(--status-success)]"
      : clamped >= 30
      ? "bg-[var(--status-warning)]"
      : "bg-[var(--status-error)]";
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-20 overflow-hidden bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-full)" }}
      >
        <div className={`h-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[10px] text-[var(--g-text-secondary)]">{clamped}%</span>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES");
}

export function BPHallazgos({ findings }: BPHallazgosProps) {
  if (findings.length === 0) {
    return (
      <BPSection title="6. Hallazgos abiertos">
        <div
          className="flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm text-[var(--status-success)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Sin hallazgos abiertos
        </div>
      </BPSection>
    );
  }

  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  return (
    <BPSection title="6. Hallazgos abiertos">
      <div className="space-y-4">
        {sorted.map((f) => {
          const isAI = f.origin === "AI Governance";
          return (
            <div
              key={f.code}
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-md)", boxShadow: "var(--g-shadow-card)" }}
            >
              {/* Cabecera hallazgo */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 bg-[var(--g-surface-subtle)]">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="shrink-0 font-mono text-xs font-semibold text-[var(--g-text-secondary)] mt-0.5">
                    {f.code}
                  </span>
                  <p className="text-sm font-medium text-[var(--g-text-primary)] leading-snug">
                    {f.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isAI && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        borderRadius: "var(--g-radius-sm)",
                        backgroundColor: "rgb(147 51 234 / 0.1)",
                        color: "rgb(126 34 206)",
                        border: "1px solid rgb(196 181 253)",
                      }}
                    >
                      AI Gov
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                      SEVERITY_CHIP[f.severity] ??
                      "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {f.severity}
                  </span>
                  <span className="text-[11px] text-[var(--g-text-secondary)]">
                    Vence {formatDate(f.due_date)}
                  </span>
                </div>
              </div>

              {/* Planes de acción */}
              {f.action_plans.length > 0 ? (
                <div className="divide-y divide-[var(--g-border-subtle)]">
                  {f.action_plans.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <p className="text-xs text-[var(--g-text-secondary)] flex-1 min-w-0 truncate">
                        {p.title}
                      </p>
                      <div className="flex shrink-0 items-center gap-3">
                        <ProgressBar pct={p.progress_pct} />
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium ${
                            PLAN_STATUS_CHIP[p.status] ??
                            "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {p.status}
                        </span>
                        <span className="text-[10px] text-[var(--g-text-secondary)] w-20 text-right">
                          {formatDate(p.due_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-2.5">
                  <p className="text-xs text-[var(--status-warning)]">
                    Sin plan de acción asignado — requiere atención
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BPSection>
  );
}
