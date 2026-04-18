import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type IncidentLite = {
  code: string;
  title: string;
  status: string;
  incident_type: string;
};

type ActionPlanLite = {
  id: string;
  title: string;
  status: string;
  progress_pct: number | null;
  findings?: { code?: string | null } | null;
};

type ExceptionLite = {
  code: string;
  status: string;
};

function useMyWork() {
  return useQuery({
    queryKey: ["grc", "mywork"],
    queryFn: async () => {
      const [incidents, actionPlans, exceptions] = await Promise.all([
        supabase
          .from("incidents")
          .select("code, title, status, incident_type")
          .eq("tenant_id", DEMO_TENANT)
          .neq("status", "Cerrado")
          .order("detection_date", { ascending: false })
          .limit(5),
        supabase
          .from("action_plans")
          .select("id, title, status, progress_pct, findings:finding_id(code)")
          .neq("status", "Cerrado")
          .limit(5),
        supabase
          .from("exceptions")
          .select("code, status")
          .eq("tenant_id", DEMO_TENANT)
          .eq("status", "Pendiente"),
      ]);

      return {
        incidents: (incidents.data ?? []) as IncidentLite[],
        plans: (actionPlans.data ?? []) as ActionPlanLite[],
        exceptions: (exceptions.data ?? []) as ExceptionLite[],
      };
    },
  });
}

const STATUS_CHIP: Record<string, string> = {
  Abierto:           "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  "En contención":   "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  "En investigación":"bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  Resuelto:          "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="px-5 py-3 border-b border-[var(--g-border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--g-border-subtle)]">{children}</div>
    </div>
  );
}

export default function MyWork() {
  const { data, isLoading } = useMyWork();

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-[var(--g-brand-3308)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Mi Trabajo</h1>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Resumen transversal de tareas GRC activas asignadas al equipo.
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      {/* Incidents */}
      <Section title={`Incidentes activos (${data?.incidents.length ?? 0})`}>
        {data?.incidents.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">
            Sin incidentes activos.
          </div>
        ) : (
          data?.incidents.map((i) => (
            <div key={i.code} className="px-5 py-3 flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-[var(--g-text-secondary)] w-28 shrink-0">
                {i.code}
              </span>
              <span className="flex-1 text-[var(--g-text-primary)]">{i.title}</span>
              <span className="text-xs text-[var(--g-text-secondary)]">{i.incident_type}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[i.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {i.status}
              </span>
            </div>
          ))
        )}
      </Section>

      {/* Action plans */}
      <Section title={`Planes de acción abiertos (${data?.plans.length ?? 0})`}>
        {data?.plans.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">
            Sin planes de acción abiertos.
          </div>
        ) : (
          data?.plans.map((p) => (
            <div key={p.id} className="px-5 py-3 flex items-center gap-3 text-sm">
              <span className="flex-1 text-[var(--g-text-primary)]">
                {p.title}
                {p.findings?.code && (
                  <Link
                    to={`/hallazgos/${p.findings.code}`}
                    className="ml-2 text-xs text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
                  >
                    ({p.findings.code})
                  </Link>
                )}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 h-1.5 bg-[var(--g-surface-muted)] overflow-hidden" style={{ borderRadius: "var(--g-radius-full)" }}>
                  <div
                    className="h-full bg-[var(--g-brand-3308)]"
                    style={{ width: `${p.progress_pct ?? 0}%`, borderRadius: "var(--g-radius-full)" }}
                  />
                </div>
                <span className="text-xs text-[var(--g-text-secondary)] w-8">{p.progress_pct ?? 0}%</span>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Exceptions */}
      <Section title={`Excepciones pendientes (${data?.exceptions.length ?? 0})`}>
        {data?.exceptions.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">
            Sin excepciones pendientes.
          </div>
        ) : (
          data?.exceptions.map((e) => (
            <div key={e.code} className="px-5 py-3 flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-[var(--g-text-secondary)] w-28 shrink-0">
                {e.code}
              </span>
              <span className="flex-1 text-[var(--g-text-secondary)]">
                Pendiente de aprobación
              </span>
              <Link
                to="/grc/excepciones"
                className="text-xs text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
              >
                Ver →
              </Link>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
