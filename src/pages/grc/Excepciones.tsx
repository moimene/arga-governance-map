import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, FileWarning, Plus } from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";

type ExceptionRow = {
  id: string;
  code: string;
  status: string;
  justification: string | null;
  compensatory_controls: string | null;
  requested_at: string | null;
  expires_at: string | null;
  obligation_id: string | null;
  obligations?: { code?: string | null; title?: string | null } | null;
};

const FILTER_ALL = "Todas";

const STATUS_CHIP: Record<string, string> = {
  Pendiente: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Aprobada: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Rechazada: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Expirada: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const DATE_FILTER_LABEL: Record<string, string> = {
  todas: "Todas",
  vencidas: "Vencidas",
  proximas: "Vencen en 30 días",
  sinFecha: "Sin vencimiento",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function useExceptions() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "excepciones", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exceptions")
        .select("id, code, status, justification, compensatory_controls, requested_at, expires_at, obligation_id, obligations:obligation_id(code, title)")
        .eq("tenant_id", tenantId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExceptionRow[];
    },
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : DATE_FORMATTER.format(date);
}

function isExpired(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function isDueSoon(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const in30Days = Date.now() + 30 * 86_400_000;
  return date.getTime() >= Date.now() && date.getTime() <= in30Days;
}

function expiryTone(value?: string | null) {
  if (isExpired(value)) return "text-[var(--status-error)]";
  if (isDueSoon(value)) return "text-[var(--status-warning)]";
  return "text-[var(--g-text-secondary)]";
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="space-y-1 text-sm font-medium text-[var(--g-text-primary)]">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {children}
      </select>
    </label>
  );
}

function ExceptionCard({ exception }: { exception: ExceptionRow }) {
  return (
    <article
      className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--g-text-secondary)]">{exception.code}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[exception.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {exception.status}
            </span>
          </div>
          <h2 className="mt-2 break-words text-sm font-semibold leading-5 text-[var(--g-text-primary)]">
            {exception.obligations?.code
              ? `${exception.obligations.code} · ${exception.obligations.title}`
              : "Excepción sin obligación vinculada"}
          </h2>
        </div>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-hidden="true"
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Solicitada</dt>
          <dd className="text-[var(--g-text-secondary)]">{formatDate(exception.requested_at)}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Vencimiento</dt>
          <dd className={`font-medium ${expiryTone(exception.expires_at)}`}>
            {formatDate(exception.expires_at)}
          </dd>
        </div>
      </dl>

      {exception.justification && (
        <p className="mt-4 line-clamp-3 text-xs leading-5 text-[var(--g-text-secondary)]">
          {exception.justification}
        </p>
      )}
    </article>
  );
}

export default function Excepciones() {
  const { data: exceptions = [], isLoading } = useExceptions();
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [dateFilter, setDateFilter] = useState("todas");

  const filteredExceptions = useMemo(
    () =>
      exceptions.filter((exception) => {
        const statusMatches = statusFilter === FILTER_ALL || exception.status === statusFilter;
        const dateMatches =
          dateFilter === "todas" ||
          (dateFilter === "vencidas" && isExpired(exception.expires_at)) ||
          (dateFilter === "proximas" && isDueSoon(exception.expires_at)) ||
          (dateFilter === "sinFecha" && !exception.expires_at);
        return statusMatches && dateMatches;
      }),
    [exceptions, statusFilter, dateFilter],
  );

  const pendingCount = exceptions.filter((exception) => exception.status === "Pendiente").length;
  const expiringCount = exceptions.filter((exception) => isExpired(exception.expires_at) || isDueSoon(exception.expires_at)).length;
  const approvedCount = exceptions.filter((exception) => exception.status === "Aprobada").length;
  const hasFilters = statusFilter !== FILTER_ALL || dateFilter !== "todas";
  const selectedException = filteredExceptions[0] ?? exceptions[0] ?? null;

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <FileWarning className="mt-1 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--g-text-primary)] sm:text-2xl">
              Excepciones
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Desviaciones aceptadas o pendientes con justificación, controles compensatorios y vencimiento visible.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          aria-label="Solicitar excepción próximamente"
          className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 text-sm font-medium text-[var(--g-text-inverse)] opacity-50 sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-disabled="true"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Solicitar excepción
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Prioridad de excepciones">
        {[
          { label: "Pendientes", value: pendingCount, helper: "Esperan aprobación o rechazo" },
          { label: "Vencidas o próximas", value: expiringCount, helper: "Requieren revisión de plazo" },
          { label: "Aprobadas", value: approvedCount, helper: "Con controles compensatorios" },
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

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-labelledby="grc-exception-filters"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="grc-exception-filters" className="text-sm font-semibold text-[var(--g-text-primary)]">
              Filtros
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              {filteredExceptions.length} de {exceptions.length} excepciones visibles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(FILTER_ALL);
              setDateFilter("todas");
            }}
            disabled={!hasFilters}
            className="inline-flex h-9 w-full items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-3 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SelectField id="exception-status-filter" label="Estado" value={statusFilter} onChange={setStatusFilter}>
            {[FILTER_ALL, "Pendiente", "Aprobada", "Rechazada", "Expirada"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectField>
          <SelectField id="exception-date-filter" label="Vencimiento" value={dateFilter} onChange={setDateFilter}>
            {Object.entries(DATE_FILTER_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectField>
        </div>
      </section>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando excepciones...</div>
      )}

      {!isLoading && exceptions.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay excepciones registradas.
        </div>
      )}

      {!isLoading && exceptions.length > 0 && filteredExceptions.length === 0 && (
        <div className="py-10 text-center text-sm text-[var(--g-text-secondary)]">
          No hay excepciones para los filtros seleccionados.
        </div>
      )}

      <section className="space-y-3 lg:hidden" aria-label="Lista operativa de excepciones">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Lista operativa
        </div>
        {filteredExceptions.map((exception) => (
          <ExceptionCard key={exception.id} exception={exception} />
        ))}
      </section>

      <div
        className="hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)] lg:block"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["Código", "Obligación", "Estado", "Solicitada", "Vencimiento"].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {filteredExceptions.map((exception) => (
                <tr
                  key={exception.id}
                  className="transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                    {exception.code}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {exception.obligations ? (
                      <div className="max-w-[360px]">
                        <div className="font-medium text-[var(--g-text-primary)]">
                          {exception.obligations.code}
                        </div>
                        <div className="truncate text-xs text-[var(--g-text-secondary)]">
                          {exception.obligations.title}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--g-text-secondary)]">Sin obligación vinculada</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[exception.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {exception.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                    {formatDate(exception.requested_at)}
                  </td>
                  <td className={`px-5 py-3 text-sm font-medium ${expiryTone(exception.expires_at)}`}>
                    {formatDate(exception.expires_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedException && (
          <div className="border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-page)] px-5 py-4">
            <div className="mb-2 text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
              Detalle operativo · {selectedException.code}
            </div>
            <p className="mb-2 text-sm leading-relaxed text-[var(--g-text-secondary)]">
              {selectedException.justification ?? "Sin justificación informada."}
            </p>
            {selectedException.compensatory_controls && (
              <>
                <div className="mb-1 text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Controles compensatorios
                </div>
                <p className="text-sm leading-relaxed text-[var(--g-text-secondary)]">
                  {selectedException.compensatory_controls}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
