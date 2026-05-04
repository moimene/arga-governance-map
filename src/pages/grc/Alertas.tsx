import type { ElementType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Bell, Clock } from "lucide-react";
import { deadlineLabel } from "@/hooks/useRegulatoryNotif";
import { Link } from "react-router-dom";
import { useTenantContext } from "@/context/TenantContext";

type RegNotRow = {
  id: string;
  authority: string;
  notification_type: string;
  notification_deadline: string | null;
  status: string;
  incident_id: string | null;
  incidents?: { code?: string | null; title?: string | null } | null;
};

type BcmPlanRow = {
  id: string;
  plan_code: string;
  plan_type: string | null;
  next_test_date: string | null;
  test_result: string | null;
};

type ExceptionRow = {
  id: string;
  code: string;
  status: string;
  expires_at: string | null;
  obligation_id: string | null;
  obligations?: { code?: string | null; title?: string | null } | null;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function useAlerts() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "alertas", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const [regNots, bcmPlans, excs] = await Promise.all([
        supabase
          .from("regulatory_notifications")
          .select("id, authority, notification_type, notification_deadline, status, incident_id, incidents:incident_id(code, title)")
          .eq("tenant_id", tenantId!)
          .eq("status", "Pendiente")
          .order("notification_deadline", { ascending: true }),
        supabase
          .from("bcm_plans")
          .select("id, plan_code, plan_type, next_test_date, test_result")
          .eq("tenant_id", tenantId!)
          .lt("next_test_date", in30Days)
          .order("next_test_date", { ascending: true }),
        supabase
          .from("exceptions")
          .select("id, code, status, expires_at, obligation_id, obligations:obligation_id(code, title)")
          .eq("tenant_id", tenantId!)
          .eq("status", "Pendiente")
          .order("expires_at", { ascending: true }),
      ]);

      return {
        regNots: (regNots.data ?? []) as RegNotRow[],
        bcmTests: (bcmPlans.data ?? []) as BcmPlanRow[],
        exceptions: (excs.data ?? []) as ExceptionRow[],
      };
    },
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : DATE_FORMATTER.format(date);
}

function deadlineText(value?: string | null) {
  const label = deadlineLabel(value ?? null);
  if (label === "—") return "Sin plazo informado";
  return label === "VENCIDA" ? "Plazo vencido" : label;
}

function AlertCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: ElementType;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section
      className="min-w-0 border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      aria-label={title}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-4 py-4 sm:px-5">
        <Icon className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-[var(--g-text-primary)]">
          {title}
        </h2>
        {count > 0 && (
          <span
            className="inline-flex shrink-0 items-center px-2 py-0.5 text-xs font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="divide-y divide-[var(--g-border-subtle)]">{children}</div>
    </section>
  );
}

export default function Alertas() {
  const { data, isLoading } = useAlerts();
  const regCount = data?.regNots.length ?? 0;
  const bcmCount = data?.bcmTests.length ?? 0;
  const exceptionCount = data?.exceptions.length ?? 0;
  const totalCount = regCount + bcmCount + exceptionCount;

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Bell className="mt-1 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--g-text-primary)] sm:text-2xl">
              Alertas
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Plazos, pruebas de continuidad y excepciones que pueden requerir intervención del equipo GRC.
            </p>
          </div>
        </div>
        <Link
          to="/grc/mywork"
          className="inline-flex h-10 w-full items-center justify-center bg-[var(--g-brand-3308)] px-4 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Abrir bandeja GRC
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-4" aria-label="Prioridad de alertas">
        {[
          { label: "Total", value: totalCount, helper: "Alertas activas" },
          { label: "Notificaciones", value: regCount, helper: "Plazos regulatorios" },
          { label: "Continuidad", value: bcmCount, helper: "Pruebas próximas" },
          { label: "Excepciones", value: exceptionCount, helper: "Pendientes de decisión" },
        ].map((item) => (
          <div
            key={item.label}
            className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">{item.value}</div>
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{item.helper}</p>
          </div>
        ))}
      </section>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando alertas...</div>
      )}

      <AlertCard
        icon={Clock}
        title="Notificaciones regulatorias pendientes"
        count={regCount}
      >
        {data?.regNots.length === 0 ? (
          <div className="px-4 py-4 text-sm text-[var(--g-text-secondary)] sm:px-5">
            Sin notificaciones pendientes.
          </div>
        ) : (
          data?.regNots.map((notification) => {
            const label = deadlineText(notification.notification_deadline);
            const isOverdue = label === "Plazo vencido";
            return (
              <div key={notification.id} className="flex flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Clock
                    className={`mt-0.5 h-4 w-4 shrink-0 ${isOverdue ? "text-[var(--status-error)]" : "text-[var(--status-warning)]"}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-[var(--g-text-primary)]">
                      {notification.authority} · {notification.notification_type}
                    </div>
                    <div className="mt-1 break-words text-xs leading-5 text-[var(--g-text-secondary)]">
                      {notification.incidents?.code
                        ? `${notification.incidents.code} · ${notification.incidents.title}`
                        : "Incidente sin detalle vinculado"}
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold ${isOverdue ? "text-[var(--status-error)]" : "text-[var(--status-warning)]"}`}
                >
                  {label}
                </span>
              </div>
            );
          })
        )}
      </AlertCard>

      <AlertCard
        icon={AlertTriangle}
        title="Pruebas de continuidad próximas"
        count={bcmCount}
      >
        {data?.bcmTests.length === 0 ? (
          <div className="px-4 py-4 text-sm text-[var(--g-text-secondary)] sm:px-5">
            Sin pruebas próximas.
          </div>
        ) : (
          data?.bcmTests.map((plan) => (
            <div key={plan.id} className="flex flex-col gap-3 px-4 py-3 text-sm sm:px-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-[var(--g-text-primary)]">
                    {plan.plan_code}
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {plan.plan_type ?? "Plan de continuidad"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  Próxima prueba: <strong>{formatDate(plan.next_test_date)}</strong>
                </p>
              </div>
              {plan.test_result && (
                <span className="text-xs text-[var(--g-text-secondary)]">{plan.test_result}</span>
              )}
            </div>
          ))
        )}
      </AlertCard>

      <AlertCard
        icon={AlertTriangle}
        title="Excepciones pendientes de decisión"
        count={exceptionCount}
      >
        {data?.exceptions.length === 0 ? (
          <div className="px-4 py-4 text-sm text-[var(--g-text-secondary)] sm:px-5">
            Sin excepciones pendientes.
          </div>
        ) : (
          data?.exceptions.map((exception) => (
            <div key={exception.id} className="flex flex-col gap-3 px-4 py-3 text-sm sm:px-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-[var(--g-text-secondary)]">{exception.code}</div>
                <div className="mt-1 break-words text-sm text-[var(--g-text-primary)]">
                  {exception.obligations?.code
                    ? `${exception.obligations.code} · ${exception.obligations.title}`
                    : "Obligación no vinculada"}
                </div>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  Vencimiento: {formatDate(exception.expires_at)}
                </p>
              </div>
              <Link
                to="/grc/excepciones"
                className="inline-flex h-9 w-full items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-3 text-xs font-medium text-[var(--g-link)] transition-colors hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Ver excepciones
              </Link>
            </div>
          ))
        )}
      </AlertCard>
    </div>
  );
}
