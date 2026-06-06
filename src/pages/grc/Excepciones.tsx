import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowRight, FileWarning, Plus, Route, AlertCircle, 
  Send, Loader2 
} from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";
import { exceptionStatusChip } from "@/lib/grc/status-labels";
import { useCrossModuleLinks } from "@/hooks/useCrossModuleLinks";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

function ExceptionCard({ 
  exception, 
  isSelected, 
  onSelect 
}: { 
  exception: ExceptionRow; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  return (
    <article
      onClick={onSelect}
      className={cn(
        "border bg-[var(--g-surface-card)] p-4 cursor-pointer transition-all duration-150",
        isSelected 
          ? "border-[var(--g-brand-3308)] shadow-[var(--g-shadow-brand)] ring-1 ring-[var(--g-brand-3308)]" 
          : "border-[var(--g-border-default)] hover:border-[var(--g-border-subtle)] shadow-[var(--g-shadow-card)]"
      )}
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--g-text-secondary)]">{exception.code}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${exceptionStatusChip(exception.status)}`}
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
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center border text-[var(--g-text-secondary)]",
            isSelected ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)]" : "border-[var(--g-border-subtle)]"
          )}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // V2 Integration States
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalateMatter, setEscalateMatter] = useState("");
  const [escalateCommittee, setEscalateCommittee] = useState("CDA");
  const [escalateRationale, setEscalateRationale] = useState("");

  const navigate = useNavigate();

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

  const selectedException = useMemo(() => {
    if (selectedId) {
      const found = exceptions.find(e => e.id === selectedId);
      if (found) return found;
    }
    return filteredExceptions[0] ?? exceptions[0] ?? null;
  }, [exceptions, filteredExceptions, selectedId]);

  const { data: crossLinks = [], refetch: refetchCrossLinks } = useCrossModuleLinks(
    "GRC",
    "EXCEPTION",
    selectedException?.id ?? ""
  );

  const pendingCount = exceptions.filter((exception) => exception.status === "Pendiente").length;
  const expiringCount = exceptions.filter((exception) => isExpired(exception.expires_at) || isDueSoon(exception.expires_at)).length;
  const approvedCount = exceptions.filter((exception) => exception.status === "Aprobada").length;
  const hasFilters = statusFilter !== FILTER_ALL || dateFilter !== "todas";

  const activeEscalation = crossLinks.find(link => link.status === "PROPOSED");

  const handleOpenEscalation = () => {
    if (!selectedException) return;
    setEscalateMatter(`Revisión y aprobación de la excepción de cumplimiento: ${selectedException.code}`);
    setEscalateRationale(`Se solicita evaluar la materialidad de la excepción ${selectedException.code} vinculada a la obligación ${selectedException.obligations?.code || 'general'} y validar los controles compensatorios propuestos.`);
    setEscalateCommittee("CDA");
    setShowEscalationModal(true);
  };

  const handleEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException) return;
    // Handoff READ-ONLY a Secretaría (guardrail CLAUDE.md: no se escribe en
    // governance_module_*). Navega al intake de Secretaría con la propuesta como
    // query params; Secretaría decide la materialización desde su owner.
    setShowEscalationModal(false);
    toast.success("Abriendo intake de Secretaría con la propuesta (handoff read-only)…");
    navigate(buildMeetingHandoffPath({
      source: "grc",
      event: "GRC_EXCEPTION_MATERIAL",
      sourceId: selectedException.id,
      organ: escalateCommittee,
      matter: escalateMatter,
      rationale: escalateRationale,
    }));
  };

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-6 animate-fade-in">
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
            className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4 shadow-[var(--g-shadow-card)]"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">{item.value}</div>
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{item.helper}</p>
          </div>
        ))}
      </section>

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4 shadow-[var(--g-shadow-card)]"
        style={{ borderRadius: "var(--g-radius-lg)" }}
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
          <ExceptionCard 
            key={exception.id} 
            exception={exception} 
            isSelected={selectedException?.id === exception.id}
            onSelect={() => setSelectedId(exception.id)}
          />
        ))}
      </section>

      <div
        className="hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)] lg:block shadow-[var(--g-shadow-card)]"
        style={{ borderRadius: "var(--g-radius-lg)" }}
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
              {filteredExceptions.map((exception) => {
                const isSelected = selectedException?.id === exception.id;
                return (
                  <tr
                    key={exception.id}
                    onClick={() => setSelectedId(exception.id)}
                    className={cn(
                      "cursor-pointer transition-colors duration-150",
                      isSelected 
                        ? "bg-[var(--g-surface-subtle)]/70 font-semibold" 
                        : "hover:bg-[var(--g-surface-subtle)]/30"
                    )}
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
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${exceptionStatusChip(exception.status)}`}
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
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedException && (
          <div className="border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-page)] px-5 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Operational Detail (col-span-2) */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Detalle operativo · {selectedException.code}
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--g-text-primary)]">
                    {selectedException.justification ?? "Sin justificación informada."}
                  </p>
                </div>
                
                {selectedException.compensatory_controls && (
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Controles compensatorios
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--g-text-primary)]">
                      {selectedException.compensatory_controls}
                    </p>
                  </div>
                )}
              </div>

              {/* Escalation Control (col-span-1) */}
              <div className="col-span-1 border-t lg:border-t-0 lg:border-l border-[var(--g-border-subtle)] pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Escalado Societario
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
                    Si esta excepción tiene carácter material o representa un riesgo de cumplimiento grave, propóngala para el Orden del Día de Secretaría Societaria.
                  </p>
                </div>

                {activeEscalation ? (
                  <div className="p-3 border border-[var(--status-warning)]/30 bg-[var(--g-surface-subtle)] rounded-md space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--g-text-primary)]">
                      <AlertCircle className="h-4 w-4 text-[var(--status-warning)]" />
                      Propuesta en Trámite
                    </div>
                    <div className="text-[10px] text-[var(--g-text-secondary)] leading-relaxed">
                      <div><strong>Destinatario:</strong> {activeEscalation.payload?.organ || "CdA"}</div>
                      <div><strong>Asunto:</strong> {activeEscalation.payload?.matter}</div>
                    </div>
                    <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-[var(--status-warning)]/20 text-[var(--status-warning)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                      PROPOSED
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenEscalation}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] py-2 px-3 text-xs font-semibold hover:bg-[var(--g-sec-700)] transition-colors duration-150"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Route className="h-3.5 w-3.5" />
                    Proponer a Secretaría
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Drawer / Modal: Escalado de Excepción                        */}
      {/* ============================================================ */}
      {showEscalationModal && selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between bg-[var(--g-surface-subtle)]">
              <div className="flex items-center gap-2">
                <Route className="h-5 w-5 text-[var(--g-brand-3308)]" />
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Proponer a Secretaría Societaria
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEscalationModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] text-lg"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleEscalateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="escalate-organ" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                  Órgano de Destino
                </label>
                <select
                  id="escalate-organ"
                  value={escalateCommittee}
                  onChange={(e) => setEscalateCommittee(e.target.value)}
                  className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>
                  <option value="COMITE_EJECUTIVO">Comité Ejecutivo Delegado</option>
                  <option value="AUDITORIA">Comisión de Auditoría y Cumplimiento</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="escalate-matter" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                  Asunto Propuesto
                </label>
                <input
                  id="escalate-matter"
                  type="text"
                  required
                  value={escalateMatter}
                  onChange={(e) => setEscalateMatter(e.target.value)}
                  className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="escalate-rationale" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                  Justificación de la Desviación y Controles
                </label>
                <textarea
                  id="escalate-rationale"
                  required
                  rows={4}
                  value={escalateRationale}
                  onChange={(e) => setEscalateRationale(e.target.value)}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] resize-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  className="flex-1 h-10 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-semibold transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Proponer Punto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
