import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

function useAuditFindings() {
  return useQuery({
    queryKey: ["audit", "findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("findings")
        .select("id, code, title, severity, status, origin, due_date, action_plans(id, title, status, progress_pct)")
        .eq("origin", "AuditInterna")
        .order("code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function AuditFindings() {
  const { data: findings = [], isLoading } = useAuditFindings();

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
          Hallazgos de Auditoría Interna
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Vista GRC de hallazgos con origin=AuditInterna. {findings.length} hallazgos.
        </p>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      {!isLoading && findings.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay hallazgos de Auditoría Interna.
        </div>
      )}

      <div className="space-y-3">
        {findings.map((f: any) => {
          const plans: any[] = f.action_plans ?? [];
          const avgProgress = plans.length
            ? Math.round(plans.reduce((s: number, p: any) => s + (p.progress_pct ?? 0), 0) / plans.length)
            : null;

          return (
            <div
              key={f.id}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-[var(--g-text-secondary)]">{f.code}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[f.severity] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {f.severity}
                    </span>
                    <span className="text-xs text-[var(--g-text-secondary)]">{f.status}</span>
                  </div>
                  <div className="text-sm font-medium text-[var(--g-text-primary)]">{f.title}</div>
                  {avgProgress !== null && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                        <div
                          className="h-full bg-[var(--g-brand-3308)]"
                          style={{ width: `${avgProgress}%`, borderRadius: "var(--g-radius-full)" }}
                        />
                      </div>
                      <span className="text-xs text-[var(--g-text-secondary)] w-12">{avgProgress}%</span>
                    </div>
                  )}
                </div>
                <Link
                  to={`/hallazgos/${f.code}`}
                  className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline shrink-0"
                >
                  Ver en TGMS →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
