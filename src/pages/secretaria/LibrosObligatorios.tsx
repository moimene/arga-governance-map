import { Building2, Library, AlertTriangle, CheckCircle2, Clock, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
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

const LEG_STATUS_FILTERS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "PRESENTADO", label: "Preparados para legalización" },
  { value: "LEGALIZADO", label: "Legalizados" },
  { value: "RECHAZADO", label: "Rechazados" },
];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDeadline(dateStr: string | null): string {
  return dateStr ? new Date(dateStr).toLocaleDateString("es-ES") : "Sin plazo registrado";
}

function deadlineHelp(days: number | null, isOk: boolean): string | null {
  if (days === null || isOk) return null;
  if (days >= 0) return `Vence en ${days} día${days === 1 ? "" : "s"}`;
  return `Vencido hace ${-days} día${days === -1 ? "" : "s"}`;
}

export default function LibrosObligatorios() {
  const scope = useSecretariaScope();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const scopedEntityId = isSociedadMode ? selectedEntity?.id ?? null : null;
  const { data, isLoading } = useLibrosList(scopedEntityId);
  const books = data ?? [];
  const hasFilters = !!search || !!statusFilter;
  const filteredBooks = books.filter((book) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (BOOK_KIND_LABEL[book.book_kind] ?? book.book_kind).toLowerCase().includes(q) ||
      (book.entity_name ?? "").toLowerCase().includes(q) ||
      String(book.period).includes(q);
    const matchesStatus = !statusFilter || book.legalization_status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const colSpan = isSociedadMode ? 4 : 5;
  const alertCount = books.filter((b) => {
    const days = daysUntil(b.legalization_deadline);
    return days !== null && days <= 30 && b.legalization_status !== "LEGALIZADO";
  }).length;
  const legalizedCount = books.filter((b) => b.legalization_status === "LEGALIZADO").length;
  const pendingCount = books.filter((b) => b.legalization_status !== "LEGALIZADO").length;
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
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

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <div
          className="flex min-w-0 items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--g-border-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--g-surface-page)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
          <input
            aria-label="Buscar libro"
            type="search"
            placeholder="Buscar por libro, sociedad o periodo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)]"
          />
        </div>

        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)] sm:flex-row sm:items-center sm:gap-2">
          <span>Legalización</span>
          <select
            aria-label="Filtrar libros por estado de legalización"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {LEG_STATUS_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1 text-xs text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {filteredBooks.length} de {books.length} libros
          </span>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>

      <div
        data-testid="libros-mobile-list"
        className="space-y-3 lg:hidden"
      >
        {isLoading ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--g-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando libros...
            </div>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            {hasFilters
              ? "Ningún libro coincide con los filtros."
              : isSociedadMode
                ? "Sin libros registrados para esta sociedad."
                : "Sin libros registrados."}
          </div>
        ) : (
          filteredBooks.map((b) => {
            const days = daysUntil(b.legalization_deadline);
            const isAlert = days !== null && days <= 30 && b.legalization_status !== "LEGALIZADO";
            const isOk = b.legalization_status === "LEGALIZADO";
            const help = deadlineHelp(days, isOk);

            return (
              <article
                key={b.id}
                className={`border border-[var(--g-border-subtle)] px-4 py-4 ${
                  isAlert ? "bg-[var(--g-sec-100)]/40" : "bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold text-[var(--g-text-primary)]">
                      {BOOK_KIND_LABEL[b.book_kind] ?? b.book_kind.replace(/_/g, " ")}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                      Volumen {b.volume_number} · periodo {b.period}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 text-[11px] font-medium ${
                      LEG_STATUS_TONE[b.legalization_status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {statusLabel(b.legalization_status)}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {!isSociedadMode ? (
                    <div>
                      <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Sociedad</dt>
                      <dd className="mt-1 break-words text-[var(--g-text-primary)]">{b.entity_name ?? "—"}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Plazo</dt>
                    <dd className="mt-1 flex items-center gap-2 text-[var(--g-text-primary)]">
                      {isOk ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />
                      ) : isAlert ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                      )}
                      <span>{formatDeadline(b.legalization_deadline)}</span>
                    </dd>
                    {help ? <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{help}</p> : null}
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Jurisdicción</dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">{b.jurisdiction ?? "—"}</dd>
                  </div>
                </dl>
              </article>
            );
          })
        )}
      </div>

      <div
        data-testid="libros-desktop-table"
        className="hidden overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] lg:block"
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
            ) : filteredBooks.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  {hasFilters
                    ? "Ningún libro coincide con los filtros."
                    : isSociedadMode
                      ? "Sin libros registrados para esta sociedad."
                      : "Sin libros registrados."}
                </td>
              </tr>
            ) : (
              filteredBooks.map((b) => {
                const days = daysUntil(b.legalization_deadline);
                const isAlert = days !== null && days <= 30 && b.legalization_status !== "LEGALIZADO";
                const isOk = b.legalization_status === "LEGALIZADO";
                return (
                  <tr key={b.id} className={isAlert ? "bg-[var(--g-sec-100)]/40" : ""}>
                    <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                      {BOOK_KIND_LABEL[b.book_kind] ?? b.book_kind}
                      <span className="ml-2 text-[11px] text-[var(--g-text-secondary)]">
                        Volumen {b.volume_number}
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
                          {formatDeadline(b.legalization_deadline)}
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
