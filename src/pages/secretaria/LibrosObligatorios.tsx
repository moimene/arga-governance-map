import { Building2, Library, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useLibrosList } from "@/hooks/useLibros";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { useSecretariaScope } from "@/components/secretaria/shell";

const BOOK_KIND_LABEL: Record<string, string> = {
  ACTAS:       "Libro de actas",
  SOCIOS:      "Libro de socios",
  ACCIONES:    "Libro de acciones nominativas",
  SOCIO_UNICO: "Libro del socio único",
};

const LEG_STATUS_TONE: Record<string, string> = {
  PENDIENTE:  "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  PRESENTADO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  LEGALIZADO: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  RECHAZADO:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function LibrosObligatorios() {
  const scope = useSecretariaScope();
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const scopedEntityId = isSociedadMode ? selectedEntity?.id ?? null : null;
  const { data, isLoading } = useLibrosList(scopedEntityId);
  const books = data ?? [];
  const colSpan = isSociedadMode ? 4 : 5;
  const alertCount = books.filter((b) => {
    const days = daysUntil(b.legalization_deadline);
    return days !== null && days <= 30 && b.legalization_status !== "LEGALIZADO";
  }).length;
  const legalizedCount = books.filter((b) => b.legalization_status === "LEGALIZADO").length;
  const pendingCount = books.filter((b) => b.legalization_status !== "LEGALIZADO").length;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Library className="h-3.5 w-3.5" />
          Secretaría · Libros obligatorios
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {isSociedadMode ? `Libros obligatorios de ${selectedEntityName}` : "Libros obligatorios"}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {isSociedadMode
            ? "Libros exigibles, periodos y estado de legalización electrónica de la sociedad seleccionada."
            : "Libros de actas, socios, acciones y contratos del socio único — con alertas de legalización electrónica."}
        </p>
      </div>

      {isSociedadMode && selectedEntity ? (
        <div
          className="mb-5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                <Building2 className="h-3.5 w-3.5" />
                Sociedad en contexto
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
                {selectedEntityName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <span>{selectedEntity.legalForm}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity.jurisdiction}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity.status}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
                La tabla muestra solo libros asociados a esta sociedad; los vencimientos se calculan por periodo y estado de legalización.
              </p>
            </div>
            <dl className="grid min-w-full grid-cols-1 gap-3 text-sm sm:min-w-[420px] sm:grid-cols-3 lg:min-w-[500px]">
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Libros</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{books.length}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Legalizados</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--status-success)]">{legalizedCount}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Pendientes</dt>
                <dd className={`mt-1 text-lg font-semibold ${alertCount > 0 ? "text-[var(--status-warning)]" : "text-[var(--g-text-primary)]"}`}>
                  {pendingCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Libro</th>
              {!isSociedadMode && (
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Entidad</th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Periodo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Plazo legalización</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Legalización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--g-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  {isSociedadMode ? "Sin libros registrados para esta sociedad." : "Sin libros."}
                </td>
              </tr>
            ) : (
              books.map((b) => {
                const days = daysUntil(b.legalization_deadline);
                const isAlert = days !== null && days <= 30 && b.legalization_status !== "LEGALIZADO";
                const isOk = b.legalization_status === "LEGALIZADO";
                return (
                  <tr key={b.id} className={isAlert ? "bg-[var(--g-sec-100)]/40" : ""}>
                    <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                      {BOOK_KIND_LABEL[b.book_kind] ?? b.book_kind}
                      <span className="ml-2 text-[11px] text-[var(--g-text-secondary)]">
                        vol. {b.volume_number}
                      </span>
                    </td>
                    {!isSociedadMode && (
                      <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                        {b.entity_name ?? "—"}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{b.period}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {isOk ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                        ) : isAlert ? (
                          <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />
                        ) : (
                          <Clock className="h-4 w-4 text-[var(--g-text-secondary)]" />
                        )}
                        <span className="text-[var(--g-text-primary)]">
                          {b.legalization_deadline
                            ? new Date(b.legalization_deadline).toLocaleDateString("es-ES")
                            : "—"}
                        </span>
                        {days !== null && !isOk ? (
                          <span className="text-[11px] text-[var(--g-text-secondary)]">
                            ({days >= 0 ? `en ${days}d` : `vencido hace ${-days}d`})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                          LEG_STATUS_TONE[b.legalization_status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {statusLabel(b.legalization_status)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
