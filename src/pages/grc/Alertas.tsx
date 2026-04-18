import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, Bell } from "lucide-react";
import { deadlineLabel } from "@/hooks/useRegulatoryNotif";
import { Link } from "react-router-dom";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

function useAlerts() {
  return useQuery({
    queryKey: ["grc", "alertas"],
    queryFn: async () => {
      const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const [regNots, bcmPlans, excs] = await Promise.all([
        supabase
          .from("regulatory_notifications")
          .select("id, authority, notification_type, notification_deadline, status, incident_id, incidents:incident_id(code, title)")
          .eq("tenant_id", DEMO_TENANT)
          .eq("status", "Pendiente")
          .order("notification_deadline", { ascending: true }),
        supabase
          .from("bcm_plans")
          .select("id, plan_code, plan_type, next_test_date, test_result")
          .eq("tenant_id", DEMO_TENANT)
          .lt("next_test_date", in30Days)
          .order("next_test_date", { ascending: true }),
        supabase
          .from("exceptions")
          .select("id, code, status, expires_at, obligation_id, obligations:obligation_id(code, title)")
          .eq("tenant_id", DEMO_TENANT)
          .eq("status", "Pendiente")
          .order("expires_at", { ascending: true }),
      ]);

      return {
        regNots: regNots.data ?? [],
        bcmTests: bcmPlans.data ?? [],
        exceptions: excs.data ?? [],
      };
    },
  });
}

function AlertCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</h2>
        {count > 0 && (
          <span
            className="ml-auto inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="divide-y divide-[var(--g-border-subtle)]">{children}</div>
    </div>
  );
}

export default function Alertas() {
  const { data, isLoading } = useAlerts();

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-[var(--g-brand-3308)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Alertas</h1>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Deadlines regulatorios, tests BCM y excepciones pendientes.
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando alertas…</div>
      )}

      {/* Regulatory notifications */}
      <AlertCard
        icon={Clock}
        title="Deadlines regulatorios pendientes"
        count={data?.regNots.length ?? 0}
      >
        {data?.regNots.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">
            Sin notificaciones pendientes.
          </div>
        ) : (
          data?.regNots.map((n: any) => {
            const dl = deadlineLabel(n.notification_deadline);
            const isVencida = dl === "VENCIDA";
            return (
              <div key={n.id} className="px-5 py-3 flex items-start gap-3">
                <Clock
                  className={`h-4 w-4 shrink-0 mt-0.5 ${isVencida ? "text-[var(--status-error)]" : "text-[var(--status-warning)]"}`}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                    {n.authority} · {n.notification_type}
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)]">
                    Incidente: {n.incidents?.code ?? n.incident_id} — {n.incidents?.title}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold shrink-0 ${isVencida ? "text-[var(--status-error)]" : "text-[var(--status-warning)]"}`}
                >
                  {dl}
                </span>
              </div>
            );
          })
        )}
      </AlertCard>

      {/* BCM tests */}
      <AlertCard
        icon={AlertTriangle}
        title="Tests BCM próximos (30 días)"
        count={data?.bcmTests.length ?? 0}
      >
        {data?.bcmTests.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">
            Sin tests BCM próximos.
          </div>
        ) : (
          data?.bcmTests.map((p: any) => (
            <div key={p.id} className="px-5 py-3 flex items-center gap-3 text-sm">
              <span className="font-medium text-[var(--g-text-primary)]">{p.plan_code}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {p.plan_type}
              </span>
              <span className="flex-1 text-[var(--g-text-secondary)]">
                Próximo test: <strong>{p.next_test_date}</strong>
              </span>
              {p.test_result && (
                <span className="text-xs text-[var(--g-text-secondary)]">{p.test_result}</span>
              )}
            </div>
          ))
        )}
      </AlertCard>

      {/* Exceptions */}
      <AlertCard
        icon={AlertTriangle}
        title="Excepciones pendientes de aprobación"
        count={data?.exceptions.length ?? 0}
      >
        {data?.exceptions.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">
            Sin excepciones pendientes.
          </div>
        ) : (
          data?.exceptions.map((e: any) => (
            <div key={e.id} className="px-5 py-3 flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-[var(--g-text-secondary)] w-28 shrink-0">
                {e.code}
              </span>
              <span className="flex-1 text-[var(--g-text-primary)]">
                {e.obligations?.code ? `${e.obligations.code} · ${e.obligations.title}` : "Obligación no vinculada"}
              </span>
              {e.expires_at && (
                <span className="text-xs text-[var(--g-text-secondary)]">
                  Expira: {e.expires_at}
                </span>
              )}
              <Link
                to="/grc/excepciones"
                className="text-xs text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
              >
                Ver →
              </Link>
            </div>
          ))
        )}
      </AlertCard>
    </div>
  );
}
