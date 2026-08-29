import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowRight, FileWarning, Plus, Route, AlertCircle, 
  Send, Loader2, ShieldAlert, CheckCircle2, Clock, X 
} from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";
import { exceptionStatusChip } from "@/lib/grc/status-labels";
import { useCrossModuleLinks } from "@/hooks/useCrossModuleLinks";
import { useExceptions, useCreateException, type ExceptionRow } from "@/hooks/useExceptions";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
      <span className="block text-xs uppercase tracking-wide text-[var(--g-text-secondary)]">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {children}
      </select>
    </label>
  );
}

export default function Excepciones() {
  const navigate = useNavigate();
  const { data: exceptions = [], isLoading, error } = useExceptions();
  const createExceptionMutation = useCreateException();

  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [dateFilter, setDateFilter] = useState("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal para solicitar nueva excepción
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newExceptionJustification, setNewExceptionJustification] = useState("");
  const [newExceptionCompensatory, setNewExceptionCompensatory] = useState("");
  const [newExceptionExpiresAt, setNewExceptionExpiresAt] = useState(
    new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );

  // Modal para elevar a Secretaría / Consejo
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [escalateCommittee, setEscalateCommittee] = useState("CDA");
  const [escalateMatter, setEscalateMatter] = useState("");
  const [escalateRationale, setEscalateRationale] = useState("");

  const availableStatuses = useMemo(() => {
    const values = Array.from(
      new Set(
        exceptions
          .map((item) => item.status?.trim())
          .filter((status): status is string => Boolean(status))
      )
    );
    return [FILTER_ALL, ...values];
  }, [exceptions]);

  const filteredExceptions = useMemo(() => {
    return exceptions.filter((item) => {
      const matchesStatus =
        statusFilter === FILTER_ALL ||
        (item.status?.trim().toUpperCase() ?? "") === statusFilter.toUpperCase();

      const matchesDate = (() => {
        switch (dateFilter) {
          case "vencidas":
            return isExpired(item.expires_at);
          case "proximas":
            return isDueSoon(item.expires_at);
          case "sinFecha":
            return !item.expires_at;
          default:
            return true;
        }
      })();

      return matchesStatus && matchesDate;
    });
  }, [exceptions, statusFilter, dateFilter]);

  const selectedException = useMemo(() => {
    return exceptions.find((item) => item.id === selectedId) ?? null;
  }, [exceptions, selectedId]);

  const { data: crossLinks = [], isLoading: loadingCrossLinks } = useCrossModuleLinks(
    "grc",
    "exception",
    selectedException?.id ?? ""
  );

  const pendingCount = useMemo(
    () => exceptions.filter((item) => (item.status ?? "").toUpperCase() === "PENDIENTE").length,
    [exceptions]
  );
  const expiringCount = useMemo(
    () => exceptions.filter((item) => isExpired(item.expires_at) || isDueSoon(item.expires_at)).length,
    [exceptions]
  );
  const approvedCount = useMemo(
    () => exceptions.filter((item) => (item.status ?? "").toUpperCase() === "APROBADA").length,
    [exceptions]
  );

  const handleOpenEscalation = (exc: ExceptionRow) => {
    setEscalateMatter(`Ratificación de Excepción Temporal ${exc.code} · ${exc.obligations?.title || "Obligación Regulatoria"}`);
    setEscalateRationale(`Excepción en estado ${exc.status}. Justificación: ${exc.justification || "Sin justificación"}. Controles compensatorios: ${exc.compensatory_controls || "Sin controles"}. Vencimiento: ${formatDate(exc.expires_at)}.`);
    setShowEscalationModal(true);
  };

  const handleConfirmEscalation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedException) return;

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

  const handleCreateExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExceptionJustification.trim() || !newExceptionCompensatory.trim()) {
      toast.error("La justificación técnica y los controles compensatorios son obligatorios.");
      return;
    }

    try {
      await createExceptionMutation.mutateAsync({
        justification: newExceptionJustification,
        compensatory_controls: newExceptionCompensatory,
        expires_at: newExceptionExpiresAt,
      });
      toast.success("Excepción solicitada y registrada para revisión de 2ª Línea.");
      setShowRequestModal(false);
      setNewExceptionJustification("");
      setNewExceptionCompensatory("");
    } catch (err) {
      toast.error("Error al registrar la solicitud de excepción.");
    }
  };

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-6 animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <FileWarning className="mt-1 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--g-text-primary)] sm:text-2xl">
              Excepciones y Desviaciones Temporales
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Registro formal de desviaciones aceptadas o pendientes con justificación técnica, controles compensatorios y vigencia acotada.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowRequestModal(true)}
          className="inline-flex h-10 w-full items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Solicitar excepción
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Prioridad de excepciones">
        {[
          { label: "Pendientes", value: pendingCount, helper: "Esperan evaluación de 2ª Línea" },
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
            className="text-xs font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)] underline self-start sm:self-auto"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SelectField id="filter-status" label="Estado" value={statusFilter} onChange={setStatusFilter}>
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SelectField>

          <SelectField id="filter-date" label="Vencimiento" value={dateFilter} onChange={setDateFilter}>
            {Object.entries(DATE_FILTER_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: List */}
        <section
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4 shadow-[var(--g-shadow-card)] lg:col-span-2"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-[var(--g-text-primary)]">Código / Obligación</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-[var(--g-text-primary)]">Vencimiento</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-[var(--g-text-primary)]">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[var(--g-text-primary)]">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g-border-subtle)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-[var(--g-text-secondary)]">
                      Cargando catálogo de excepciones…
                    </td>
                  </tr>
                ) : filteredExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-[var(--g-text-secondary)]">
                      No hay excepciones con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredExceptions.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50",
                          isSelected && "bg-[var(--g-surface-subtle)]"
                        )}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] block">
                            {item.code}
                          </span>
                          <span className="text-xs text-[var(--g-text-secondary)] line-clamp-1">
                            {item.obligations?.title || item.justification || "Sin descripción"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={cn("font-medium", expiryTone(item.expires_at))}>
                            {formatDate(item.expires_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium", exceptionStatusChip(item.status))}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEscalation(item);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)] underline"
                          >
                            <Send className="h-3 w-3" />
                            Elevar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right Column: Selected Detail Drawer */}
        <section
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-5 shadow-[var(--g-shadow-card)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          {!selectedException ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center p-6 text-xs text-[var(--g-text-secondary)]">
              <FileWarning className="h-8 w-8 text-[var(--g-text-secondary)]/40 mb-2" />
              <div className="font-semibold text-[var(--g-text-primary)]">Seleccione una excepción</div>
              <p className="mt-1">Haga clic en una fila de la tabla para ver la justificación técnica, controles compensatorios y enlaces de gobernanza.</p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                    {selectedException.code}
                  </span>
                  <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-0.5">
                    Ficha de Desviación Aceptada
                  </h3>
                </div>
                <span
                  className={cn("px-2 py-0.5 text-xs font-medium", exceptionStatusChip(selectedException.status))}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {selectedException.status}
                </span>
              </div>

              <div className="border-t border-[var(--g-border-subtle)] pt-3 space-y-3">
                <div>
                  <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Justificación Técnica:</span>
                  <p className="text-[var(--g-text-primary)] mt-1 leading-relaxed bg-[var(--g-surface-subtle)] p-2.5 rounded">
                    {selectedException.justification || "Sin justificación aportada."}
                  </p>
                </div>

                <div>
                  <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Controles Compensatorios Obligatorios:</span>
                  <p className="text-[var(--g-text-primary)] mt-1 leading-relaxed bg-[var(--g-surface-subtle)] p-2.5 rounded font-medium">
                    {selectedException.compensatory_controls || "Sin controles compensatorios registrados."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Fecha Solicitud:</span>
                    <span className="text-[var(--g-text-primary)]">{formatDate(selectedException.requested_at)}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Fecha Caducidad:</span>
                    <span className={cn("font-semibold", expiryTone(selectedException.expires_at))}>
                      {formatDate(selectedException.expires_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--g-border-subtle)] pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEscalation(selectedException)}
                  className="w-full py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Elevar a Consejo / Comisión
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal: Solicitar Nueva Excepción */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Solicitar Excepción o Desviación Temporal
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateExceptionSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Justificación Técnica / Causa de la Desviación:
                </label>
                <textarea
                  required
                  rows={3}
                  value={newExceptionJustification}
                  onChange={(e) => setNewExceptionJustification(e.target.value)}
                  placeholder="Explique el motivo técnico u operativo que impide el cumplimiento estricto del estándar..."
                  className="w-full p-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Controles Compensatorios Obligatorios (2ª Línea):
                </label>
                <textarea
                  required
                  rows={3}
                  value={newExceptionCompensatory}
                  onChange={(e) => setNewExceptionCompensatory(e.target.value)}
                  placeholder="Detalle los controles temporales de mitigación (ej. monitorización reforzada, segregación física, autenticación multifactor)..."
                  className="w-full p-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Fecha Límite de Vigencia (Máximo 6-12 meses):
                </label>
                <input
                  type="date"
                  required
                  value={newExceptionExpiresAt}
                  onChange={(e) => setNewExceptionExpiresAt(e.target.value)}
                  className="w-full h-9 px-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="px-0 py-3 border-t border-[var(--g-border-subtle)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createExceptionMutation.isPending}
                  className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] flex items-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {createExceptionMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Registrar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Elevar a Consejo / Comisión */}
      {showEscalationModal && selectedException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Elevar Excepción a Órgano de Gobierno
              </h3>
              <button
                type="button"
                onClick={() => setShowEscalationModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleConfirmEscalation} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Órgano Destinatario:
                </label>
                <select
                  value={escalateCommittee}
                  onChange={(e) => setEscalateCommittee(e.target.value)}
                  className="w-full h-9 px-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="CDA">Consejo de Administración (Matriz)</option>
                  <option value="COMITE_EJECUTIVO">Comité Ejecutivo Delegado</option>
                  <option value="AUDITORIA">Comisión de Auditoría y Control</option>
                  <option value="RIESGOS">Comisión Delegada de Riesgos</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Punto del Orden del Día Propuesto:
                </label>
                <input
                  type="text"
                  required
                  value={escalateMatter}
                  onChange={(e) => setEscalateMatter(e.target.value)}
                  className="w-full h-9 px-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Resumen Ejecutivo y Justificación:
                </label>
                <textarea
                  required
                  rows={4}
                  value={escalateRationale}
                  onChange={(e) => setEscalateRationale(e.target.value)}
                  className="w-full p-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="px-0 py-3 border-t border-[var(--g-border-subtle)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] flex items-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Proponer Punto en Secretaría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
