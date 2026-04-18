import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

function useAuditActionPlans() {
  return useQuery({
    queryKey: ["audit", "action-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("id, title, status, progress_pct, due_date, findings:finding_id(code, title, origin)")
        .order("due_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      // Filter to AuditInterna findings
      return (data ?? []).filter((p: any) => p.findings?.origin === "AuditInterna");
    },
  });
}

const STATUS_CHIP: Record<string, string> = {
  Abierto:    "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  "En curso": "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Cerrado:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

export default function ActionPlans() {
  const { data: plans = [], isLoading } = useAuditActionPlans();

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Planes de Acción</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Planes de remediación vinculados a hallazgos de Auditoría Interna.
        </p>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      {!isLoading && plans.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay planes de acción disponibles.
        </div>
      )}

      <div className="space-y-3">
        {plans.map((p: any) => (
          <div
            key={p.id}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 flex items-center gap-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[p.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {p.status}
                </span>
                {p.findings?.code && (
                  <Link
                    to={`/hallazgos/${p.findings.code}`}
                    className="text-xs text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
                  >
                    {p.findings.code}
                  </Link>
                )}
              </div>
              <div className="text-sm font-medium text-[var(--g-text-primary)]">{p.title}</div>
              {p.due_date && (
                <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                  Vence: {p.due_date}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 w-32">
              <div className="flex-1 h-1.5 bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                <div
                  className="h-full bg-[var(--g-brand-3308)]"
                  style={{ width: `${p.progress_pct ?? 0}%`, borderRadius: "var(--g-radius-full)" }}
                />
              </div>
              <span className="text-xs text-[var(--g-text-secondary)] w-8 text-right">
                {p.progress_pct ?? 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
