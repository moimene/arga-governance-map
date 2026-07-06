import { Building2, Library, AlertTriangle, CheckCircle2, Clock, Loader2, Search, X, FileSignature, BookOpen, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLibrosList, useCerrarVolumen, useLegalizacionTransicion } from "@/hooks/useLibros";
import { statusLabel } from "@/lib/secretaria/status-labels";
import {
  availableLegalizacionActions,
  type LegalizacionStatus,
  type LegalizacionAction,
} from "@/lib/secretaria/libro-legalizacion";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { StandaloneCertificationActions } from "@/components/secretaria/StandaloneCertificationActions";
import {
  summarizeBookPortfolio,
  type BookDeadlineState,
  type LegalizationRequirement,
  type SocietaryBookGroup,
  type SocietaryBookView,
} from "@/lib/secretaria/libros-societarios";

// W4 — acciones de cierre de volumen + legalización para libros PERSISTIDOS y
// legalizables (los virtuales no se pueden cerrar/legalizar). Surface read/write
// mínimo: usa la máquina de estados pura y las RPC con tenant-assert.
function LibroLegalizacionActions({ book }: { book: SocietaryBookView }) {
  const cerrar = useCerrarVolumen();
  const transicion = useLegalizacionTransicion();
  if (book.is_virtual || book.legalization_requirement === "NO_APLICA") return null;
  const libroId = book.source_book_id ?? book.id;
  const volumeClosed = book.status === "CERRADO" || Boolean(book.closed_at);
  const actions = availableLegalizacionActions(
    book.legalization_status as LegalizacionStatus,
    volumeClosed,
  );
  const busy = cerrar.isPending || transicion.isPending;
  const LABELS: Record<LegalizacionAction, string> = {
    PRESENTAR: "Presentar a legalización",
    LEGALIZAR: "Marcar legalizado",
    RECHAZAR: "Marcar rechazado",
  };
  const btnCls =
    "inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-[11px] font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-60";
  const onFail = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "No se pudo completar la acción.");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--g-border-subtle)] pt-3">
      <span className="text-[11px] font-medium text-[var(--g-text-secondary)]">Legalización:</span>
      {!volumeClosed && (
        <button
          type="button"
          disabled={busy}
          className={btnCls}
          onClick={() =>
            cerrar.mutate(libroId, {
              onSuccess: () => toast.success("Volumen cerrado."),
              onError: onFail,
            })
          }
        >
          Cerrar volumen
        </button>
      )}
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          disabled={busy}
          className={btnCls}
          onClick={() =>
            transicion.mutate(
              {
                libroId,
                action: a,
                evidenceUrl: a === "LEGALIZAR" ? `CSV-DEMO-${libroId.slice(0, 8)}` : null,
              },
              {
                onSuccess: () => toast.success(`${LABELS[a]} — hecho.`),
                onError: onFail,
              },
            )
          }
        >
          {LABELS[a]}
        </button>
      ))}
      {volumeClosed && actions.length === 0 && (
        <span className="text-[11px] text-[var(--g-text-secondary)]">
          {statusLabel(book.legalization_status)}
        </span>
      )}
    </div>
  );
}

// BATCH 12 (ronda 2 F-E): mapping book_kind → ruta del contenido del libro.
// En cierre demo-ready no dejamos "vista no disponible": cada libro enlaza a
// su registro natural o, como fallback, a la ficha de la sociedad.
const LEGACY_BOOK_KIND_ALIASES = ["ACTAS", "SOCIOS", "ACCIONES", "SOCIO_UNICO"];

const BOOK_CONTENT_ICON: Record<string, typeof FileSignature> = {
  LIBRO_ACTAS: FileSignature,
  LIBRO_ACTAS_JUNTA_GENERAL: FileSignature,
  LIBRO_ACTAS_CONSEJO_ADMINISTRACION: FileSignature,
  LIBRO_ACTAS_COMISION_AUDITORIA: FileSignature,
  LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES: FileSignature,
  LIBRO_ACTAS_COMISION_RIESGOS: FileSignature,
  LIBRO_ACTAS_COMISION_EJECUTIVA: FileSignature,
  LIBRO_ACTAS_COMISION_DELEGADA: FileSignature,
  LIBRO_REGISTRO_SOCIOS: BookOpen,
  LIBRO_ACCIONES_NOMINATIVAS: BookOpen,
  LIBRO_CONTRATOS_SOCIO_UNICO: FileSignature,
  REGISTRO_COMUNICACIONES_REGULATORIAS: ClipboardList,
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

const GROUP_FILTERS: Array<{ value: "" | SocietaryBookGroup; label: string }> = [
  { value: "", label: "Todos" },
  { value: "LIBRO_MERCANTIL", label: "Libros mercantiles" },
  { value: "REGISTRO_AUXILIAR", label: "Registros auxiliares" },
];

const GROUP_TONE: Record<SocietaryBookGroup, string> = {
  LIBRO_MERCANTIL: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  REGISTRO_AUXILIAR: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)] border border-[var(--g-sec-300)]",
};

const GROUP_LABEL: Record<SocietaryBookGroup, string> = {
  LIBRO_MERCANTIL: "Libro legal",
  REGISTRO_AUXILIAR: "Registro auxiliar",
};

const LEGALIZATION_TONE: Record<LegalizationRequirement, string> = {
  OBLIGATORIA: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  RECOMENDADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  NO_APLICA: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const DEADLINE_TONE: Record<BookDeadlineState, string> = {
  legalized: "text-[var(--status-success)]",
  overdue: "text-[var(--status-error)]",
  due_soon: "text-[var(--status-warning)]",
  in_time: "text-[var(--g-text-primary)]",
  unknown: "text-[var(--g-text-secondary)]",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDeadline(dateStr: string | null): string {
  return dateStr ? new Date(dateStr).toLocaleDateString("es-ES") : "Sin plazo registrado";
}

function formatDateTime(dateStr: string | null): string {
  return dateStr ? new Date(dateStr).toLocaleDateString("es-ES") : "Sin asientos";
}

function deadlineHelp(book: SocietaryBookView): string | null {
  if (book.deadline_state === "legalized") return "Legalizado";
  if (book.legalization_requirement === "NO_APLICA") return "No requiere legalización";
  const days = daysUntil(book.legalization_deadline);
  if (days === null) return "Sin plazo registrado";
  if (days >= 0) return `Vence en ${days} día${days === 1 ? "" : "s"}`;
  return `Vencido hace ${-days} día${days === -1 ? "" : "s"}`;
}

function getBookContentRoute(book: SocietaryBookView) {
  const Icon = BOOK_CONTENT_ICON[book.book_code] ?? (book.group === "REGISTRO_AUXILIAR" ? ClipboardList : Building2);
  if (book.content_route && book.content_route !== "/secretaria/libros") {
    return {
      path: book.content_route,
      label: book.group === "REGISTRO_AUXILIAR" ? "Mantener registro" : "Ver contenido",
      icon: Icon,
    };
  }
  return {
    path: book.entity_id ? `/secretaria/sociedades/${book.entity_id}` : "/secretaria/libros",
    label: book.entity_id ? "Ver sociedad" : "Ver detalle",
    icon: Icon,
  };
}

export default function LibrosObligatorios() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<"" | SocietaryBookGroup>("");
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const scopedEntityId = isSociedadMode ? selectedEntity?.id ?? null : null;
  const { data, isLoading } = useLibrosList(scopedEntityId);
  const books = data ?? [];
  const hasFilters = !!search || !!statusFilter || !!groupFilter;
  const filteredBooks = books.filter((book) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      book.display_label.toLowerCase().includes(q) ||
      book.short_label.toLowerCase().includes(q) ||
      book.book_code.toLowerCase().includes(q) ||
      LEGACY_BOOK_KIND_ALIASES.some((alias) => alias.toLowerCase().includes(q) && book.book_kind === alias) ||
      (book.entity_name ?? "").toLowerCase().includes(q) ||
      (book.legal_basis ?? "").toLowerCase().includes(q) ||
      (book.documented_organ ?? "").toLowerCase().includes(q) ||
      book.supervision_tags.some((tag) => tag.toLowerCase().includes(q)) ||
      String(book.period).includes(q);
    const matchesStatus = !statusFilter || book.legalization_status === statusFilter;
    const matchesGroup = !groupFilter || book.group === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
  });
  // BATCH 12: +1 columna "Contenido" para todas las vistas.
  const colSpan = isSociedadMode ? 6 : 7;
  const summary = summarizeBookPortfolio(books);
  const alertCount = summary.alerts;
  const pendingCount = summary.nonLegalized;
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setGroupFilter("");
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
            ? "Libros exigibles, registros auxiliares, periodos y estado de legalización electrónica de la sociedad seleccionada."
            : "Libros de actas por órgano, socios/acciones, contratos del socio único, contables y registros auxiliares de gobernanza."}
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
                La tabla muestra libros legales y registros auxiliares asociados a esta sociedad; las secciones de actas se derivan de sus organos vigentes.
              </p>
            </div>
            <dl className="grid min-w-full grid-cols-1 gap-3 text-sm sm:min-w-[420px] sm:grid-cols-3 lg:min-w-[500px]">
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Libros legales</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{summary.mandatory}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Registros aux.</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-brand-3308)]">{summary.auxiliary}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Pendientes legaliz.</dt>
                <dd className={`mt-1 text-lg font-semibold ${alertCount > 0 ? "text-[var(--status-warning)]" : "text-[var(--g-text-primary)]"}`}>
                  {pendingCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {isSociedadMode && scopedEntityId ? (
        <div className="mb-5">
          <StandaloneCertificationActions
            title="Certificados de libros"
            actions={[
              {
                kindCode: "CERT_LIBROS_LEGALIZACION",
                label: "Estado de legalización",
                description: "Certifica el estado de libros obligatorios y registros auxiliares de la sociedad.",
                entityId: scopedEntityId,
              },
              {
                kindCode: "CERT_LIBRO_ACTAS_EXTRACTO",
                label: "Extracto de libro de actas",
                description: "Prepara extracto certificable desde actas y libros de órganos sociales.",
                entityId: scopedEntityId,
              },
            ]}
          />
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
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
          <span>Tipo</span>
          <select
            aria-label="Filtrar libros por tipo"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as "" | SocietaryBookGroup)}
            className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {GROUP_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

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
            const isAlert = b.deadline_state === "overdue" || b.deadline_state === "due_soon";
            const isOk = b.deadline_state === "legalized";
            const help = deadlineHelp(b);
            const route = getBookContentRoute(b);
            const Icon = route.icon;

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
                      {b.display_label}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                      Volumen {b.volume_number} · periodo {b.period}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`px-2 py-1 text-[11px] font-medium ${GROUP_TONE[b.group]}`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {GROUP_LABEL[b.group]}
                    </span>
                    <span
                      className={`px-2 py-1 text-[11px] font-medium ${
                        LEG_STATUS_TONE[b.legalization_status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {statusLabel(b.legalization_status)}
                    </span>
                  </div>
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
                    <dd className={`mt-1 flex items-center gap-2 ${DEADLINE_TONE[b.deadline_state]}`}>
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
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Órgano / registro</dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">{b.documented_organ}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Base legal</dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">{b.legal_basis}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Asientos</dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">
                      {b.entries_count ?? 0} · último: {formatDateTime(b.last_entry_at)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-1 text-[11px] font-medium ${LEGALIZATION_TONE[b.legalization_requirement]}`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {b.legalization_requirement === "NO_APLICA" ? "No legalizable" : b.legalization_requirement.toLowerCase()}
                  </span>
                  {b.supervision_tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-[11px] text-[var(--g-text-secondary)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(scope.createScopedTo(route.path))}
                  className="mt-4 inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {route.label}
                </button>
                <div className="mt-3">
                  <StandaloneCertificationActions
                    compact
                    actions={[
                      {
                        kindCode: "CERT_LIBROS_LEGALIZACION",
                        label: "Certificar libro",
                        entityId: b.entity_id,
                        bookId: b.source_book_id ?? b.id,
                      },
                    ]}
                  />
                </div>
                <LibroLegalizacionActions book={b} />
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
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Base y custodia</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Actividad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Plazo legalización</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Legalización</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Contenido</th>
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
                const isAlert = b.deadline_state === "overdue" || b.deadline_state === "due_soon";
                const isOk = b.deadline_state === "legalized";
                return (
                  <tr key={b.id} className={isAlert ? "bg-[var(--g-sec-100)]/40" : ""}>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-primary)]">
                      <div className="font-medium">{b.display_label}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${GROUP_TONE[b.group]}`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {GROUP_LABEL[b.group]}
                        </span>
                        {b.is_virtual ? (
                          <span
                            className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-0.5 text-[11px] text-[var(--g-text-secondary)]"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            derivado
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {!isSociedadMode && (
                      <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                        {b.entity_name ?? "—"}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm">
                      <div className="max-w-[320px] text-[var(--g-text-primary)]">{b.legal_basis}</div>
                      <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                        Custodia: {b.custodian_role}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-[var(--g-text-primary)]">{b.documented_organ}</div>
                      <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                        Periodo {b.period} · {b.entries_count ?? 0} asiento(s)
                      </div>
                      <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                        Ultimo: {formatDateTime(b.last_entry_at)}
                      </div>
                    </td>
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
                          <span className={`text-[11px] ${DEADLINE_TONE[b.deadline_state]}`}>
                            ({days >= 0 ? `en ${days}d` : `vencido hace ${-days}d`})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                            LEG_STATUS_TONE[b.legalization_status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {statusLabel(b.legalization_status)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${LEGALIZATION_TONE[b.legalization_requirement]}`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {b.legalization_requirement === "NO_APLICA" ? "No legalizable" : b.legalization_requirement.toLowerCase()}
                        </span>
                      </div>
                    </td>
                    {/* BATCH 12 (ronda 2 F-E): botón "Ver contenido" para todos
                        los book_kind mediante registro natural o fallback a
                        ficha de sociedad. */}
                    <td className="px-6 py-4 text-sm">
                      {(() => {
                        const route = getBookContentRoute(b);
                        const Icon = route.icon;
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate(scope.createScopedTo(route.path))}
                              className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                              style={{ borderRadius: "var(--g-radius-md)" }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {route.label}
                            </button>
                            <div className="mt-2">
                              <StandaloneCertificationActions
                                compact
                                actions={[
                                  {
                                    kindCode: "CERT_LIBROS_LEGALIZACION",
                                    label: "Certificar",
                                    entityId: b.entity_id,
                                    bookId: b.source_book_id ?? b.id,
                                  },
                                ]}
                              />
                            </div>
                          </>
                        );
                      })()}
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
