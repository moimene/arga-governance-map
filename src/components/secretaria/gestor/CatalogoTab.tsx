/**
 * CatalogoTab — Catálogo master-detail de plantillas protegidas.
 *
 * Extraído de `GestorPlantillas.tsx` previo al refactor: filtros (búsqueda,
 * tipo, estado, revisión legal), tabla maestro, panel de detalle con las
 * 3 capas, sección de revisión legal y transiciones de estado vía
 * `useUpdateEstadoPlantilla` (compatible legacy).
 *
 * Añadido en Commit 5: badge `ACTIVE_WITH_P0` cuando la plantilla está en
 * `KNOWN_P0_TEMPLATE_IDS` (vía `isKnownP0`), para que el equipo legal vea
 * sin click qué plantillas activas tienen P0 conocido pendiente.
 *
 * Sprint 1 — Task 5.4 (catálogo).
 */
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  FileCode2,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  Play,
  Scale,
  Search,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePlantillasProtegidas,
  useUpdateEstadoPlantilla,
  type PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { getTemplateUsageTarget } from "@/lib/secretaria/template-routing";
import {
  buildLegalTemplateReviewRows,
  matchesLegalTemplateReviewFilter,
  type LegalTemplateReviewFilter,
  type LegalTemplateReviewRow,
  type LegalTemplateReviewStatus,
} from "@/lib/secretaria/legal-template-review";
import { withLegalTeamTemplateFixtures } from "@/lib/secretaria/legal-template-fixtures";
import { isKnownP0 } from "@/lib/secretaria/template-admin";
import { TriCapaEditor } from "./TriCapaEditor";
import { useTabAccess } from "./tab-guards";

const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: ElementType }> = {
  BORRADOR: {
    label: "Borrador",
    className: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
    icon: Edit3,
  },
  REVISADA: {
    label: "Revisada",
    className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
    icon: Eye,
  },
  APROBADA: {
    label: "Aprobada",
    className: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
    icon: CheckCircle2,
  },
  ACTIVA: {
    label: "Activa",
    className: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
    icon: Shield,
  },
  ARCHIVADA: {
    label: "Archivada",
    className: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
    icon: FolderOpen,
  },
  DEPRECADA: {
    label: "Deprecada",
    className: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
    icon: AlertTriangle,
  },
};

const TIPO_LABELS: Record<string, string> = {
  ACTA_SESION: "Acta de sesión",
  ACTA_CONSIGNACION: "Acta de consignación",
  ACTA_ACUERDO_ESCRITO: "Acta acuerdo escrito sin sesión",
  ACTA_DECISION_CONJUNTA: "Acta decisión conjunta",
  ACTA_ORGANO_ADMIN: "Acta órgano de administración",
  CERTIFICACION: "Certificación de acuerdos",
  CONVOCATORIA: "Convocatoria",
  CONVOCATORIA_SL_NOTIFICACION: "Convocatoria SL con notificación",
  MODELO_ACUERDO: "Modelo de acuerdo",
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe documental PRE",
  DOCUMENTO_REGISTRAL: "Documento registral",
  SUBSANACION_REGISTRAL: "Subsanación registral",
  INFORME_GESTION: "Informe de gestión",
};

const ORGANO_LABELS: Record<string, string> = {
  JUNTA_GENERAL: "Junta General",
  CONSEJO: "Consejo de Administración",
};

const MODE_LABELS: Record<string, string> = {
  MEETING: "Sesión",
  UNIVERSAL: "Universal",
  NO_SESSION: "Sin sesión",
  UNIPERSONAL_SOCIO: "Socio único",
  UNIPERSONAL_ADMIN: "Admin. único",
  CO_APROBACION: "Co-aprobación",
  SOLIDARIO: "Admin. solidario",
};

const TRANSITION_MAP: Record<string, { next: string; label: string; confirm: string }> = {
  BORRADOR: {
    next: "REVISADA",
    label: "Marcar como revisada",
    confirm: "¿Confirmar que el contenido jurídico ha sido revisado?",
  },
  REVISADA: {
    next: "APROBADA",
    label: "Aprobar",
    confirm: "¿Confirmar la aprobación formal por el Comité Legal?",
  },
  APROBADA: {
    next: "ACTIVA",
    label: "Activar en producción",
    confirm:
      "¿Activar esta plantilla para uso en producción? Esta acción habilita el Gate PRE.",
  },
  ACTIVA: {
    next: "ARCHIVADA",
    label: "Archivar",
    confirm:
      "¿Archivar esta plantilla? Dejará de seleccionarse como plantilla activa.",
  },
};

const LEGAL_REVIEW_STATUS_STYLE: Record<
  LegalTemplateReviewStatus,
  { className: string; icon: ElementType }
> = {
  legally_approved: {
    className: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
    icon: BadgeCheck,
  },
  operational_unapproved: {
    className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
    icon: AlertTriangle,
  },
  needs_review: {
    className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
    icon: Scale,
  },
  fixture_bridge: {
    className: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
    icon: FileCode2,
  },
  in_workflow: {
    className: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
    icon: Clock,
  },
};

const LEGAL_REVIEW_FILTER_LABELS: Record<LegalTemplateReviewFilter, string> = {
  ALL: "Todas las revisiones",
  LEGAL_APPROVED: "Aprobadas legalmente",
  REVISION_LEGAL: "Requieren revisión legal",
  LEGAL_REPORT_APPROVED: "Informe: aprobadas",
  LEGAL_REPORT_APPROVED_VARIANTS: "Informe: aprobadas con variantes",
  MISSING_APPROVAL: "Sin aprobación formal",
  DRAFT_VERSION: "Versión técnica",
  MISSING_REFERENCE: "Sin referencia legal",
  MISSING_OWNER: "Sin órgano o modo",
  DUPLICATE_MATTER: "Duplicadas por materia",
  LOCAL_FIXTURE: "Fixtures locales",
};

function normalizeSearch(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function templateAppliesToJurisdiction(
  plantilla: PlantillaProtegidaRow,
  jurisdiction?: string | null,
) {
  if (!jurisdiction) return true;
  return (
    !plantilla.jurisdiccion ||
    plantilla.jurisdiccion === jurisdiction ||
    plantilla.jurisdiccion === "GLOBAL" ||
    plantilla.jurisdiccion === "MULTI"
  );
}

function plantillaSearchText(plantilla: PlantillaProtegidaRow) {
  return [
    plantilla.tipo,
    TIPO_LABELS[plantilla.tipo],
    plantilla.materia,
    plantilla.materia_acuerdo,
    plantilla.jurisdiccion,
    plantilla.referencia_legal,
    plantilla.adoption_mode,
    plantilla.organo_tipo,
  ].join(" ");
}

function safeString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLocalFixture(plantilla: PlantillaProtegidaRow) {
  return (
    plantilla.tenant_id === "local-legal-fixture" ||
    (isRecord(plantilla.protecciones) && plantilla.protecciones.source === "legal-team-fixture")
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.BORRADOR;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function LegalReviewBadge({ review }: { review?: LegalTemplateReviewRow }) {
  if (!review) return null;
  const config = LEGAL_REVIEW_STATUS_STYLE[review.status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold ${config.className}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {review.label}
    </span>
  );
}

function ActiveWithP0Badge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Activa con P0
    </span>
  );
}

function SectionToggle({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  count,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--g-border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--g-text-secondary)]" aria-hidden="true" />
        )}
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
        <span>{title}</span>
        {count !== undefined ? (
          <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{count}</span>
        ) : null}
      </button>
      {open ? <div className="px-5 pb-4">{children}</div> : null}
    </div>
  );
}

function PlantillaDetailPanel({
  plantilla,
  review,
  onUseTemplate,
  scopeContextLabel,
}: {
  plantilla: PlantillaProtegidaRow;
  review?: LegalTemplateReviewRow;
  onUseTemplate: (plantilla: PlantillaProtegidaRow) => void;
  scopeContextLabel?: string | null;
}) {
  const updateEstado = useUpdateEstadoPlantilla();
  const { canAccess } = useTabAccess();
  const canManageTemplates = canAccess("validacion");
  const estado = safeString(plantilla.estado, "BORRADOR");
  const tipo = safeString(plantilla.tipo, "SIN_TIPO");
  const localFixture = isLocalFixture(plantilla);
  const transition = localFixture || !canManageTemplates ? undefined : TRANSITION_MAP[estado];
  const tipoLabel = TIPO_LABELS[tipo] || tipo;
  const organoLabel = plantilla.organo_tipo
    ? ORGANO_LABELS[plantilla.organo_tipo] || plantilla.organo_tipo
    : null;
  const modeLabel = plantilla.adoption_mode
    ? MODE_LABELS[plantilla.adoption_mode] || plantilla.adoption_mode
    : "Todos";
  const usageTarget = getTemplateUsageTarget(plantilla);
  const isActiveP0 = estado === "ACTIVA" && isKnownP0(plantilla.id);

  const handleTransition = () => {
    if (!transition) return;
    if (!window.confirm(transition.confirm)) return;
    updateEstado.mutate(
      {
        id: plantilla.id,
        nuevo_estado: transition.next,
        aprobada_por: "Comité Legal TGMS",
      },
      {
        onSuccess: () =>
          toast.success(
            `Plantilla actualizada a ${ESTADO_CONFIG[transition.next]?.label ?? transition.next}`,
          ),
        onError: () => toast.error("No se pudo actualizar el estado de la plantilla"),
      },
    );
  };

  const editorReadOnlyReason = localFixture
    ? "Fixture local no persistido: no admite edición tri-capa."
    : !canManageTemplates
      ? "Rol sin permisos de escritura sobre plantillas."
      : estado !== "BORRADOR"
        ? "Solo las plantillas en BORRADOR admiten edición tri-capa."
        : null;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--g-text-primary)]">{tipoLabel}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              {organoLabel ? (
                <span
                  className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {organoLabel}
                </span>
              ) : null}
              <span
                className="bg-[var(--g-surface-muted)] px-2 py-0.5"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {modeLabel}
              </span>
              {localFixture ? (
                <span
                  className="bg-[var(--g-sec-100)] px-2 py-0.5 font-semibold text-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  Fixture local
                </span>
              ) : null}
              <span>v{plantilla.version}</span>
              <span>·</span>
              <span>{plantilla.jurisdiccion}</span>
            </div>
            {plantilla.referencia_legal ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {plantilla.referencia_legal}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <EstadoBadge estado={estado} />
            {isActiveP0 ? <ActiveWithP0Badge /> : null}
            <LegalReviewBadge review={review} />
          </div>
        </div>

        {transition ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {estado === "ACTIVA" ? (
              <button
                type="button"
                onClick={() => onUseTemplate(plantilla)}
                className="flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {usageTarget.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleTransition}
              disabled={updateEstado.isPending}
              className="flex items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50 transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={updateEstado.isPending}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {updateEstado.isPending ? "Procesando…" : transition.label}
            </button>
          </div>
        ) : null}

        {estado === "ACTIVA" && !transition ? (
          <button
            type="button"
            onClick={() => onUseTemplate(plantilla)}
            className="mt-3 flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {usageTarget.label}
          </button>
        ) : null}

        {estado === "ACTIVA" ? (
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">{usageTarget.hint}</p>
        ) : null}

        {localFixture ? (
          <p className="mt-2 text-xs text-[var(--status-warning)]">
            Fixture local no persistido: sirve para probar cobertura durante el freeze
            Supabase y debe sustituirse por plantilla Cloud aprobada.
          </p>
        ) : null}

        {isActiveP0 ? (
          <p className="mt-2 text-xs text-[var(--status-error)]">
            Plantilla activa con P0 conocido pendiente revisión Comité Legal — ver consola
            Auditoría.
          </p>
        ) : null}

        {review ? (
          <div
            className="mt-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--g-brand-3308)]">
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              Revisión legal
            </div>
            {review.reasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-[var(--g-text-secondary)]">
                {review.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <AlertTriangle
                      className="mt-0.5 h-3 w-3 shrink-0 text-[var(--status-warning)]"
                      aria-hidden="true"
                    />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                Plantilla activa con aprobación legal formal y sin incidencias de revisión
                detectadas.
              </p>
            )}
          </div>
        ) : null}

        {plantilla.fecha_aprobacion ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Aprobada: {new Date(plantilla.fecha_aprobacion).toLocaleDateString("es-ES")}
            {plantilla.aprobada_por ? ` por ${plantilla.aprobada_por}` : null}
          </div>
        ) : null}

        {scopeContextLabel ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            {scopeContextLabel}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        <TriCapaEditor
          key={plantilla.id}
          plantilla={plantilla}
          readOnlyReason={editorReadOnlyReason}
        />

        <SectionToggle title="Gate PRE — Configuración" icon={Shield}>
          <div className="space-y-2 text-xs text-[var(--g-text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--g-text-primary)]">Snapshot requerido:</span>
              {plantilla.snapshot_rule_pack_required ? (
                <span className="text-[var(--status-success)]">Sí — Rule Pack obligatorio</span>
              ) : (
                <span>No</span>
              )}
            </div>
            {plantilla.contrato_variables_version ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--g-text-primary)]">
                  Contrato de variables:
                </span>
                <span>{plantilla.contrato_variables_version}</span>
              </div>
            ) : null}
          </div>
        </SectionToggle>
      </div>
    </div>
  );
}

export function CatalogoTab() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data: plantillas, isLoading } = usePlantillasProtegidas();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>("ALL");
  const [filterTipo, setFilterTipo] = useState<string>("ALL");
  const [filterReview, setFilterReview] = useState<LegalTemplateReviewFilter>("ALL");
  const [filterP0, setFilterP0] = useState<"ALL" | "ONLY_P0">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName =
    selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const selectedJurisdiction = selectedEntity?.jurisdiction ?? null;

  const scopedPlantillas = useMemo(() => {
    const rows = withLegalTeamTemplateFixtures(plantillas ?? []);
    if (!isSociedadMode) return rows;
    return rows.filter((plantilla) =>
      templateAppliesToJurisdiction(plantilla, selectedJurisdiction),
    );
  }, [isSociedadMode, plantillas, selectedJurisdiction]);

  const legalReviewRows = useMemo(
    () => buildLegalTemplateReviewRows(scopedPlantillas),
    [scopedPlantillas],
  );

  const legalReviewById = useMemo(
    () => new Map(legalReviewRows.map((row) => [row.templateId, row])),
    [legalReviewRows],
  );

  const filtered = useMemo(
    () =>
      scopedPlantillas.filter((p) => {
        if (filterEstado !== "ALL" && p.estado !== filterEstado) return false;
        if (filterTipo !== "ALL" && p.tipo !== filterTipo) return false;
        if (!matchesLegalTemplateReviewFilter(legalReviewById.get(p.id), filterReview))
          return false;
        if (filterP0 === "ONLY_P0" && !(p.estado === "ACTIVA" && isKnownP0(p.id))) return false;
        if (searchQuery.trim()) {
          const query = normalizeSearch(searchQuery);
          if (!normalizeSearch(plantillaSearchText(p)).includes(query)) return false;
        }
        return true;
      }),
    [filterEstado, filterReview, filterTipo, filterP0, legalReviewById, scopedPlantillas, searchQuery],
  );

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && filtered.some((p) => p.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const tipos = [...new Set(scopedPlantillas.map((p) => p.tipo))];
  const estados = [...new Set(scopedPlantillas.map((p) => p.estado))];

  const handleUseTemplate = (plantilla: PlantillaProtegidaRow) => {
    const target = getTemplateUsageTarget(plantilla).to;
    navigate(scope.createScopedTo(target));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
        <Layers className="h-4 w-4" aria-hidden="true" />
        Catálogo de plantillas protegidas
      </div>
      <p className="max-w-3xl text-sm text-[var(--g-text-secondary)]">
        {isSociedadMode
          ? `Filtros activos por jurisdicción de ${selectedEntityName}.`
          : "Catálogo completo del tenant. Selecciona una plantilla para ver sus 3 capas y transicionar su estado."}
      </p>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Buscar
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tipo, materia, referencia legal…"
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Tipo
          </span>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABELS[t] || t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Estado
          </span>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todos los estados</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {ESTADO_CONFIG[e]?.label || e}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            Revisión legal
          </span>
          <select
            value={filterReview}
            onChange={(e) => setFilterReview(e.target.value as LegalTemplateReviewFilter)}
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {(Object.keys(LEGAL_REVIEW_FILTER_LABELS) as LegalTemplateReviewFilter[]).map(
              (filter) => (
                <option key={filter} value={filter}>
                  {LEGAL_REVIEW_FILTER_LABELS[filter]}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            P0 conocido
          </span>
          <select
            value={filterP0}
            onChange={(e) => setFilterP0(e.target.value as "ALL" | "ONLY_P0")}
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todas</option>
            <option value="ONLY_P0">Solo activas con P0</option>
          </select>
        </label>
        <span className="pb-2 text-xs text-[var(--g-text-secondary)]">
          {filtered.length} de {scopedPlantillas.length} plantillas
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div
          className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--g-text-primary)]">
              Plantillas
            </h2>
          </div>
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                Cargando…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <FolderOpen className="h-9 w-9 text-[var(--g-text-secondary)]" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-[var(--g-text-primary)]">
                  Sin plantillas que coincidan con los filtros.
                </p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  Prueba a retirar filtros o ampliar la búsqueda.
                </p>
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = selectedId === p.id;
                const tipoLabel = TIPO_LABELS[p.tipo] || p.tipo;
                const organoLabel = p.organo_tipo ? ORGANO_LABELS[p.organo_tipo] : null;
                const hasCapa1 = !!p.capa1_inmutable;
                const localFixture = isLocalFixture(p);
                const review = legalReviewById.get(p.id);
                const isActiveP0 = p.estado === "ACTIVA" && isKnownP0(p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    aria-pressed={isSelected}
                    className={`w-full px-5 py-3.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--g-sec-100)] border-l-[3px] border-l-[var(--g-brand-3308)]"
                        : "hover:bg-[var(--g-surface-subtle)]/50 border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--g-text-primary)] truncate">
                        {tipoLabel}
                      </span>
                      <EstadoBadge estado={p.estado} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                      {organoLabel ? <span>{organoLabel}</span> : null}
                      {organoLabel ? <span>·</span> : null}
                      <span>{MODE_LABELS[p.adoption_mode ?? ""] || "Todos"}</span>
                      <span>·</span>
                      <span>v{p.version}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {isActiveP0 ? <ActiveWithP0Badge /> : null}
                      <LegalReviewBadge review={review} />
                      {localFixture ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--g-brand-3308)]">
                          <FileCode2 className="h-3 w-3" aria-hidden="true" /> Fixture local
                        </span>
                      ) : null}
                      {hasCapa1 ? (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--status-success)]">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Contenido jurídico
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--status-warning)]">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Sin contenido
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] overflow-hidden"
          style={{
            borderRadius: "var(--g-radius-lg)",
            boxShadow: "var(--g-shadow-card)",
            minHeight: "500px",
          }}
        >
          {selected ? (
            <PlantillaDetailPanel
              plantilla={selected}
              review={legalReviewById.get(selected.id)}
              onUseTemplate={handleUseTemplate}
              scopeContextLabel={
                isSociedadMode && selectedEntity
                  ? `Se usará en el contexto de ${selectedEntityName}`
                  : null
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="w-full max-w-xl text-center">
                <FileText
                  className="mx-auto h-12 w-12 text-[var(--g-border-subtle)]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
                  Selecciona una plantilla para ver su detalle y contenido jurídico.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
