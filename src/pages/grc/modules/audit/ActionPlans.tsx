import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { actionPlanStatusChip } from "@/lib/grc/status-labels";
import { useTenantContext } from "@/context/TenantContext";
import { PLAN_ACCION_AUSENCIA } from "../../../../../scripts/garrigues/hallazgos/hallazgos-penales";

type AuditActionPlanRow = {
  id: string;
  title: string;
  status: string;
  progress_pct: number | null;
  due_date: string | null;
  findings?: { code?: string | null; title?: string | null; origin?: string | null } | null;
};

function useAuditActionPlans(tenantId: string | null) {
  return useQuery({
    // El tenant va en la clave Y `enabled` espera a que resuelva. RLS filtra la
    // consulta, pero la CACHE no: con la clave anterior —["audit",
    // "action-plans"], sin tenant— los dos tenants compartian entrada y el
    // segundo en entrar veia lo que trajo el primero. `TenantProvider` arranca
    // en null y resuelve por red, asi que sin `enabled` el primer render de
    // todos los tenants comparte tambien la clave [...,null].
    queryKey: ["audit", "action-plans", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_plans")
        .select("id, title, status, progress_pct, due_date, findings:finding_id(code, title, origin)")
        .order("due_date", { ascending: true })
        .limit(20);
      if (error) throw error;
      // Filter to AuditInterna findings
      return ((data ?? []) as AuditActionPlanRow[]).filter((p) => p.findings?.origin === "AuditInterna");
    },
  });
}

export default function ActionPlans() {
  const { tenantId } = useTenantContext();
  const { data: plans = [], isLoading } = useAuditActionPlans(tenantId);
  // Un vacío con procedencia declarada NO es un vacío: es una decisión, y se
  // explica. Los demás tenants conservan su texto genérico sin cambio alguno.
  // (El comentario va aquí y no dentro del JSX: el escáner de literales de
  // marca de los milestone-challenger no reconoce `{/* … */}` como comentario
  // y lo contaba como texto visible.)
  const hayProcedenciaDeclarada = tenantId === PLAN_ACCION_AUSENCIA.tenantId;

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

      {!isLoading && plans.length === 0 && !hayProcedenciaDeclarada && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay planes de acción disponibles.
        </div>
      )}

      {!isLoading && plans.length === 0 && hayProcedenciaDeclarada && (
        <section
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-subtle)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            {PLAN_ACCION_AUSENCIA.titulo}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--g-text-secondary)]">
            {PLAN_ACCION_AUSENCIA.motivo}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--g-text-secondary)]">
            {PLAN_ACCION_AUSENCIA.consecuencia}
          </p>
          <p className="mt-3 text-[11px] text-[var(--g-text-secondary)]">
            Fuente: {PLAN_ACCION_AUSENCIA.fuente}
          </p>
          <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
            Lo que sí consta del mecanismo está registrado como controles de supervisión, con órgano
            responsable:{" "}
            <Link
              to="/controles"
              className="text-[var(--g-link)] underline hover:text-[var(--g-link-hover)]"
            >
              {PLAN_ACCION_AUSENCIA.controlesRelacionados.join(", ")}
            </Link>
          </p>
        </section>
      )}

      <div className="space-y-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 flex items-center gap-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${actionPlanStatusChip(p.status)}`}
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
