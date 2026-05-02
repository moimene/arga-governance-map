import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  FileText, Shield, ChevronRight, ChevronDown,
  CheckCircle2, Clock, AlertTriangle, Eye, Lock,
  Layers, Variable, Edit3, ArrowRight, BookOpen,
  Building2, Filter, FolderOpen, Play, Search,
  Database, FileCode2, BadgeCheck, Scale, ListChecks,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  usePlantillasProtegidas,
  useUpdateEstadoPlantilla,
  useUpdateContenidoPlantilla,
  type PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { getTemplateUsageTarget } from "@/lib/secretaria/template-routing";
import { buildLegalTemplateCoverage, type LegalTemplateCoverageState } from "@/lib/secretaria/legal-template-coverage";
import {
  buildLegalTemplateReviewRows,
  matchesLegalTemplateReviewFilter,
  summarizeLegalTemplateReview,
  type LegalTemplateReviewFilter,
  type LegalTemplateReviewRow,
  type LegalTemplateReviewStatus,
} from "@/lib/secretaria/legal-template-review";
import { withLegalTeamTemplateFixtures } from "@/lib/secretaria/legal-template-fixtures";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: ElementType }> = {
  BORRADOR:  { label: "Borrador",  className: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]", icon: Edit3 },
  REVISADA:  { label: "Revisada",  className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]", icon: Eye },
  APROBADA:  { label: "Aprobada",  className: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]", icon: CheckCircle2 },
  ACTIVA:    { label: "Activa",    className: "bg-[var(--status-success)] text-[var(--g-text-inverse)]", icon: Shield },
  ARCHIVADA: { label: "Archivada", className: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]", icon: FolderOpen },
  DEPRECADA: { label: "Deprecada", className: "bg-[var(--status-error)] text-[var(--g-text-inverse)]", icon: AlertTriangle },
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

const EXPECTED_TEMPLATE_TYPES = [
  "CONVOCATORIA",
  "CONVOCATORIA_SL_NOTIFICACION",
  "ACTA_SESION",
  "ACTA_CONSIGNACION",
  "ACTA_ACUERDO_ESCRITO",
  "ACTA_DECISION_CONJUNTA",
  "ACTA_ORGANO_ADMIN",
  "CERTIFICACION",
  "INFORME_PRECEPTIVO",
  "INFORME_DOCUMENTAL_PRE",
  "DOCUMENTO_REGISTRAL",
  "SUBSANACION_REGISTRAL",
  "INFORME_GESTION",
  "MODELO_ACUERDO",
];

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
  BORRADOR:  { next: "REVISADA",  label: "Marcar como revisada", confirm: "¿Confirmar que el contenido jurídico ha sido revisado?" },
  REVISADA:  { next: "APROBADA",  label: "Aprobar",              confirm: "¿Confirmar la aprobación formal por el Comité Legal?" },
  APROBADA:  { next: "ACTIVA",    label: "Activar en producción", confirm: "¿Activar esta plantilla para uso en producción? Esta acción habilita el Gate PRE." },
  ACTIVA:    { next: "ARCHIVADA", label: "Archivar",             confirm: "¿Archivar esta plantilla? Dejará de seleccionarse como plantilla activa." },
};

const OBLIGATORIEDAD_STYLE: Record<string, string> = {
  OBLIGATORIO:              "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  OBLIGATORIO_SI_CONFLICTOS: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  OPCIONAL:                 "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

const JURISDICTION_LABEL: Record<string, string> = {
  ES: "España",
  PT: "Portugal",
  BR: "Brasil",
  MX: "México",
  GLOBAL: "Global",
  MULTI: "Multijurisdicción",
};

const COVERAGE_STATE_STYLE: Record<LegalTemplateCoverageState, { className: string; icon: ElementType }> = {
  cloud_active: {
    className: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
    icon: CheckCircle2,
  },
  cloud_pending: {
    className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
    icon: Clock,
  },
  fixture_pending_load: {
    className: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
    icon: FileCode2,
  },
  missing: {
    className: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
    icon: AlertTriangle,
  },
};

const LEGAL_REVIEW_STATUS_STYLE: Record<LegalTemplateReviewStatus, { className: string; icon: ElementType }> = {
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

function jurisdictionLabel(code?: string | null) {
  if (!code) return "Jurisdicción pendiente";
  return JURISDICTION_LABEL[code] ?? code;
}

function normalizeSearch(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function templateAppliesToJurisdiction(plantilla: PlantillaProtegidaRow, jurisdiction?: string | null) {
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

function obligatoriedadLabel(value?: string | null) {
  return safeString(value, "OPCIONAL").replace(/_/g, " ");
}

function asCapa2Variables(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      variable: safeString(item.variable, "variable_pendiente"),
      fuente: safeString(item.fuente, "No definida"),
      condicion: safeString(item.condicion, "No definida"),
    }));
}

function asCapa3Fields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      campo: safeString(item.campo, "campo_pendiente"),
      obligatoriedad: safeString(item.obligatoriedad, "OPCIONAL"),
      descripcion: safeString(item.descripcion, "Sin descripción jurídica."),
    }));
}

// ── Subcomponents ──────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.BORRADOR;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function CoverageStateBadge({ state, label }: { state: LegalTemplateCoverageState; label: string }) {
  const config = COVERAGE_STATE_STYLE[state];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold ${config.className}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" />
      {label}
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
      <Icon className="h-3 w-3" />
      {review.label}
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
      >
        {open ? <ChevronDown className="h-4 w-4 text-[var(--g-brand-3308)]" /> : <ChevronRight className="h-4 w-4 text-[var(--g-text-secondary)]" />}
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <span>{title}</span>
        {count !== undefined && (
          <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{count}</span>
        )}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
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
  const updateContenido = useUpdateContenidoPlantilla();
  const [editingCapa1, setEditingCapa1] = useState(false);
  const [capa1Draft, setCapa1Draft] = useState("");
  const estado = safeString(plantilla.estado, "BORRADOR");
  const tipo = safeString(plantilla.tipo, "SIN_TIPO");
  const localFixture = isLocalFixture(plantilla);
  const transition = localFixture ? undefined : TRANSITION_MAP[estado];
  const tipoLabel = TIPO_LABELS[tipo] || tipo;
  const organoLabel = plantilla.organo_tipo ? ORGANO_LABELS[plantilla.organo_tipo] || plantilla.organo_tipo : null;
  const modeLabel = plantilla.adoption_mode ? MODE_LABELS[plantilla.adoption_mode] || plantilla.adoption_mode : "Todos";
  const usageTarget = getTemplateUsageTarget(plantilla);

  const handleTransition = () => {
    if (!transition) return;
    if (!window.confirm(transition.confirm)) return;
    updateEstado.mutate({
      id: plantilla.id,
      nuevo_estado: transition.next,
      aprobada_por: "Comité Legal TGMS",
    }, {
      onSuccess: () => toast.success(`Plantilla actualizada a ${ESTADO_CONFIG[transition.next]?.label ?? transition.next}`),
      onError: () => toast.error("No se pudo actualizar el estado de la plantilla"),
    });
  };

  const capa2 = asCapa2Variables(plantilla.capa2_variables);
  const capa3 = asCapa3Fields(plantilla.capa3_editables);
  const hasCapa1 = !!plantilla.capa1_inmutable;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--g-text-primary)]">{tipoLabel}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              {organoLabel && (
                <span className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[var(--g-brand-3308)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {organoLabel}
                </span>
              )}
              <span className="bg-[var(--g-surface-muted)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                {modeLabel}
              </span>
              {localFixture ? (
                <span className="bg-[var(--g-sec-100)] px-2 py-0.5 font-semibold text-[var(--g-brand-3308)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  Fixture local
                </span>
              ) : null}
              <span>v{plantilla.version}</span>
              <span>·</span>
              <span>{plantilla.jurisdiccion}</span>
            </div>
            {plantilla.referencia_legal && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
                <BookOpen className="h-3 w-3" />
                {plantilla.referencia_legal}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <EstadoBadge estado={estado} />
            <LegalReviewBadge review={review} />
          </div>
        </div>

        {/* Transition button */}
        {transition && (
          <div className="mt-3 flex flex-wrap gap-2">
            {estado === "ACTIVA" && (
              <button
                type="button"
                onClick={() => onUseTemplate(plantilla)}
                className="flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Play className="h-4 w-4" />
                {usageTarget.label}
              </button>
            )}
            <button
              type="button"
              onClick={handleTransition}
              disabled={updateEstado.isPending}
              className="flex items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50 transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={updateEstado.isPending}
            >
              <ArrowRight className="h-4 w-4" />
              {updateEstado.isPending ? "Procesando…" : transition.label}
            </button>
          </div>
        )}

        {estado === "ACTIVA" && !transition && (
          <button
            type="button"
            onClick={() => onUseTemplate(plantilla)}
            className="mt-3 flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Play className="h-4 w-4" />
            {usageTarget.label}
          </button>
        )}

        {estado === "ACTIVA" ? (
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            {usageTarget.hint}
          </p>
        ) : null}

        {localFixture ? (
          <p className="mt-2 text-xs text-[var(--status-warning)]">
            Fixture local no persistido: sirve para probar cobertura durante el freeze Supabase y debe sustituirse por plantilla Cloud aprobada.
          </p>
        ) : null}

        {review ? (
          <div
            className="mt-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--g-brand-3308)]">
              <Scale className="h-3.5 w-3.5" />
              Revisión legal
            </div>
            {review.reasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-[var(--g-text-secondary)]">
                {review.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--status-warning)]" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                Plantilla activa con aprobación legal formal y sin incidencias de revisión detectadas.
              </p>
            )}
            {review.approvalPlan ? (
              <div className="mt-3 grid gap-2 border-t border-[var(--g-border-subtle)] pt-3 text-xs text-[var(--g-text-secondary)] sm:grid-cols-2">
                <div>
                  <span className="font-medium text-[var(--g-text-primary)]">Resultado informe:</span>{" "}
                  {review.approvalDecision}
                </div>
                <div>
                  <span className="font-medium text-[var(--g-text-primary)]">Versión propuesta:</span>{" "}
                  {review.proposedVersion}
                </div>
                {review.approvalPlan.variantRequired ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-[var(--g-text-primary)]">Variante requerida:</span>{" "}
                    {review.approvalPlan.variantRequired}
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <span className="font-medium text-[var(--g-text-primary)]">Alcance:</span>{" "}
                  {review.approvalPlan.summary}
                </div>
                {review.approvalPlan.variablesToAdd?.length ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-[var(--g-text-primary)]">Variables a preparar:</span>{" "}
                    {review.approvalPlan.variablesToAdd.join(", ")}
                  </div>
                ) : null}
                {review.approvalPlan.capa3ToChange?.length ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-[var(--g-text-primary)]">Capa 3:</span>{" "}
                    {review.approvalPlan.capa3ToChange.join(", ")}
                  </div>
                ) : null}
                {review.approvalPlan.notes ? (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-[var(--g-text-primary)]">Nota:</span>{" "}
                    {review.approvalPlan.notes}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {plantilla.fecha_aprobacion && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
            <Clock className="h-3 w-3" />
            Aprobada: {new Date(plantilla.fecha_aprobacion).toLocaleDateString("es-ES")}
            {plantilla.aprobada_por && ` por ${plantilla.aprobada_por}`}
          </div>
        )}

        {scopeContextLabel ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
            <Building2 className="h-3 w-3" />
            {scopeContextLabel}
          </div>
        ) : null}
      </div>

      {/* Content sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Capa 1 — Inmutable */}
        <SectionToggle title="Capa 1 — Contenido inmutable" icon={Lock} defaultOpen={true}>
          {editingCapa1 ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={capa1Draft}
                onChange={(e) => setCapa1Draft(e.target.value)}
                rows={16}
                className="w-full resize-y rounded border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-3 font-mono text-[12px] leading-relaxed text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={updateContenido.isPending}
                  onClick={() => {
                    updateContenido.mutate(
                      { id: plantilla.id, capa1_inmutable: capa1Draft },
                      { onSuccess: () => setEditingCapa1(false) }
                    );
                  }}
                  className="flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {updateContenido.isPending ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCapa1(false)}
                  className="flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : hasCapa1 ? (
            <div className="flex flex-col gap-2">
              <pre className="whitespace-pre-wrap bg-[var(--g-surface-subtle)] p-4 text-[12px] leading-relaxed text-[var(--g-text-primary)] font-sans max-h-[400px] overflow-y-auto" style={{ borderRadius: "var(--g-radius-md)" }}>
                {plantilla.capa1_inmutable}
              </pre>
              {estado === "BORRADOR" && (
                <button
                  type="button"
                  onClick={() => { setCapa1Draft(plantilla.capa1_inmutable ?? ""); setEditingCapa1(true); }}
                  className="self-start flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar contenido
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 py-2 text-sm text-[var(--status-warning)]">
                <AlertTriangle className="h-4 w-4" />
                Sin contenido jurídico todavía.
              </div>
              {estado === "BORRADOR" && (
                <button
                  type="button"
                  onClick={() => { setCapa1Draft(""); setEditingCapa1(true); }}
                  className="self-start flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Añadir contenido
                </button>
              )}
            </div>
          )}
        </SectionToggle>

        {/* Capa 2 — Variables parametrizadas */}
        <SectionToggle title="Capa 2 — Variables del motor" icon={Variable} count={capa2.length}>
          {capa2.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Variable</th>
                    <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Fuente</th>
                    <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Condición</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {capa2.map((v, i) => (
                    <tr key={i} className="hover:bg-[var(--g-surface-subtle)]/50">
                      <td className="px-3 py-2 font-mono text-[var(--g-brand-3308)]">{`{{${v.variable}}}`}</td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{v.fuente}</td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{v.condicion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-2 text-xs text-[var(--g-text-secondary)]">Sin variables definidas.</p>
          )}
        </SectionToggle>

        {/* Capa 3 — Campos editables */}
        <SectionToggle title="Capa 3 — Campos editables (usuario)" icon={Edit3} count={capa3.length}>
          {capa3.length > 0 ? (
            <div className="space-y-3">
              {capa3.map((f, i) => (
                <div key={i} className="flex items-start gap-3 border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[var(--g-brand-3308)]">{`{{${f.campo}}}`}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold ${OBLIGATORIEDAD_STYLE[f.obligatoriedad] || OBLIGATORIEDAD_STYLE.OPCIONAL}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {obligatoriedadLabel(f.obligatoriedad)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">{f.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-[var(--g-text-secondary)]">Sin campos editables definidos.</p>
          )}
        </SectionToggle>

        {/* Notas legales */}
        {plantilla.notas_legal && (
          <SectionToggle title="Notas para Legal" icon={BookOpen}>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {plantilla.notas_legal}
            </p>
          </SectionToggle>
        )}

        {/* Gate PRE info */}
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
            {plantilla.contrato_variables_version && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--g-text-primary)]">Contrato de variables:</span>
                <span>{plantilla.contrato_variables_version}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--g-text-primary)]">Protecciones:</span>
              <span className="font-mono">{JSON.stringify(plantilla.protecciones)}</span>
            </div>
          </div>
        </SectionToggle>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export default function GestorPlantillas() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data: plantillas, isLoading } = usePlantillasProtegidas();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>("ALL");
  const [filterTipo, setFilterTipo] = useState<string>("ALL");
  const [filterReview, setFilterReview] = useState<LegalTemplateReviewFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const selectedJurisdiction = selectedEntity?.jurisdiction ?? null;

  const scopedCloudPlantillas = useMemo(() => {
    const rows = plantillas ?? [];
    if (!isSociedadMode) return rows;
    return rows.filter((plantilla) => templateAppliesToJurisdiction(plantilla, selectedJurisdiction));
  }, [isSociedadMode, plantillas, selectedJurisdiction]);

  const scopedPlantillas = useMemo(() => {
    const rows = withLegalTeamTemplateFixtures(plantillas ?? []);
    if (!isSociedadMode) return rows;
    return rows.filter((plantilla) => templateAppliesToJurisdiction(plantilla, selectedJurisdiction));
  }, [isSociedadMode, plantillas, selectedJurisdiction]);

  const legalReviewRows = useMemo(
    () => buildLegalTemplateReviewRows(scopedPlantillas),
    [scopedPlantillas],
  );

  const legalReviewById = useMemo(
    () => new Map(legalReviewRows.map((row) => [row.templateId, row])),
    [legalReviewRows],
  );

  const legalReviewSummary = useMemo(
    () => summarizeLegalTemplateReview(legalReviewRows),
    [legalReviewRows],
  );

  const filtered = useMemo(() => scopedPlantillas.filter((p) => {
    if (filterEstado !== "ALL" && p.estado !== filterEstado) return false;
    if (filterTipo !== "ALL" && p.tipo !== filterTipo) return false;
    if (!matchesLegalTemplateReviewFilter(legalReviewById.get(p.id), filterReview)) return false;
    if (searchQuery.trim()) {
      const query = normalizeSearch(searchQuery);
      if (!normalizeSearch(plantillaSearchText(p)).includes(query)) return false;
    }
    return true;
  }), [filterEstado, filterReview, filterTipo, legalReviewById, scopedPlantillas, searchQuery]);

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && filtered.some((p) => p.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  const tipos = [...new Set(scopedPlantillas.map((p) => p.tipo))];
  const estados = [...new Set(scopedPlantillas.map((p) => p.estado))];

  // Stats
  const totalActivas = scopedPlantillas.filter((p) => p.estado === "ACTIVA").length;
  const coverageRows = buildLegalTemplateCoverage(scopedCloudPlantillas, { jurisdiction: selectedJurisdiction });
  const coverageCloudActive = coverageRows.filter((row) => row.state === "cloud_active").length;
  const coverageCloudPending = coverageRows.filter((row) => row.state === "cloud_pending").length;
  const coverageFixture = coverageRows.filter((row) => row.state === "fixture_pending_load").length;
  const coverageMissing = coverageRows.filter((row) => row.state === "missing").length;
  const coverageTypes = Array.from(new Set([...EXPECTED_TEMPLATE_TYPES, ...tipos]));
  const coberturaTipos = coverageTypes.map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo] || tipo,
    total: scopedPlantillas.filter((p) => p.tipo === tipo).length,
    activas: scopedPlantillas.filter((p) => p.tipo === tipo && p.estado === "ACTIVA").length,
    expected: EXPECTED_TEMPLATE_TYPES.includes(tipo),
  }));
  const coberturaPendiente = coverageRows.filter((row) => row.state !== "cloud_active");
  const coberturaCriticaPendiente = coberturaPendiente.filter((row) => row.critical).length;
  const exactJurisdiction = selectedJurisdiction
    ? scopedPlantillas.filter((p) => p.jurisdiccion === selectedJurisdiction).length
    : 0;

  const handleUseTemplate = (plantilla: PlantillaProtegidaRow) => {
    const target = getTemplateUsageTarget(plantilla).to;
    navigate(scope.createScopedTo(target));
  };

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Layers className="h-4 w-4" />
          Secretaría · Gestor de plantillas protegidas
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {isSociedadMode ? `Plantillas de ${selectedEntityName}` : "Plantillas con contenido jurídico"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
          {isSociedadMode
            ? `Gestión del ciclo de vida y cobertura documental aplicable a la sociedad seleccionada. Filtro activo por jurisdicción ${jurisdictionLabel(selectedJurisdiction)}.`
            : "Gestión del ciclo de vida de las plantillas protegidas del Motor de Reglas LSC. Cada plantilla tiene 3 capas: inmutable, parametrizada y editable."}
        </p>
      </div>

      {isSociedadMode && selectedEntity ? (
        <div
          className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                <Building2 className="h-3.5 w-3.5" />
                Sociedad en contexto
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">{selectedEntityName}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <span>{selectedEntity.legalForm}</span>
                <span aria-hidden="true">·</span>
                <span>{jurisdictionLabel(selectedJurisdiction)}</span>
                <span aria-hidden="true">·</span>
                <span>{statusLabel(selectedEntity.status)}</span>
              </div>
            </div>

            <dl className="grid min-w-full grid-cols-2 gap-3 text-sm sm:min-w-[520px] sm:grid-cols-4">
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Aplicables</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{scopedPlantillas.length}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Activas</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{totalActivas}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Jurisdicción exacta</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{exactJurisdiction}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Huecos críticos</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{coberturaCriticaPendiente}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {/* KPI summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--g-text-primary)]">{scopedPlantillas.length}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Total</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--status-success)]">{totalActivas}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Activas</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--g-brand-3308)]">{legalReviewSummary.legallyApproved}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Aprobadas Legal</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--status-warning)]">{legalReviewSummary.needsReview}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Revisión Legal</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--status-warning)]">{legalReviewSummary.missingApproval}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Sin Aprobación</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--g-brand-3308)]">{coberturaCriticaPendiente}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Huecos</div>
        </div>
      </div>

      <div
        className="mb-6 overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <ListChecks className="h-3.5 w-3.5" />
            Panel de revisión legal
          </div>
          <h2 className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
            Activa operativa frente a aprobada legalmente
          </h2>
          <p className="mt-1 max-w-4xl text-xs text-[var(--g-text-secondary)]">
            Una plantilla `ACTIVA` puede operar en demo. Para considerarla aprobada legalmente debe tener aprobación formal, versión final, referencia legal y metadatos de órgano/modo cuando aplica.
          </p>
        </div>
        <div className="grid gap-0 divide-y divide-[var(--g-border-subtle)] lg:grid-cols-[1.1fr_1fr] lg:divide-x lg:divide-y-0">
          <dl className="grid grid-cols-2 gap-0 divide-x divide-y divide-[var(--g-border-subtle)] sm:grid-cols-4">
            <div className="p-4">
              <dt className="text-xs text-[var(--g-text-secondary)]">Aprobadas legal</dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--g-text-primary)]">{legalReviewSummary.legallyApproved}</dd>
            </div>
            <div className="p-4">
              <dt className="text-xs text-[var(--g-text-secondary)]">Activas sin aprobación</dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--g-text-primary)]">{legalReviewSummary.operationalUnapproved}</dd>
            </div>
            <div className="p-4">
              <dt className="text-xs text-[var(--g-text-secondary)]">Versiones técnicas</dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--g-text-primary)]">{legalReviewSummary.draftVersion}</dd>
            </div>
            <div className="p-4">
              <dt className="text-xs text-[var(--g-text-secondary)]">Duplicadas materia</dt>
              <dd className="mt-1 text-xl font-semibold text-[var(--g-text-primary)]">{legalReviewSummary.duplicateMatter}</dd>
            </div>
          </dl>
          <div className="space-y-2 p-4 text-sm">
            <div className="flex items-start gap-2 text-[var(--g-text-secondary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
              <span>{legalReviewSummary.missingReference} plantilla(s) sin referencia legal explícita.</span>
            </div>
            <div className="flex items-start gap-2 text-[var(--g-text-secondary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
              <span>{legalReviewSummary.missingOwner} modelo(s) sin órgano competente o AdoptionMode.</span>
            </div>
            <div className="flex items-start gap-2 text-[var(--g-text-secondary)]">
              <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
              <span>{legalReviewSummary.fixtureBridge} fixture(s) locales como puente no persistente.</span>
            </div>
            <div className="flex items-start gap-2 text-[var(--g-text-secondary)]">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
              <span>
                Informe legal final: {legalReviewSummary.legalReportApproved} aprobada(s) y{" "}
                {legalReviewSummary.legalReportApprovedWithVariants} aprobada(s) con variantes.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="mb-6 overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
              <Database className="h-3.5 w-3.5" />
              Cobertura legal
            </div>
            <h2 className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
              Plantillas Cloud y fixtures locales
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Cloud activas</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{coverageCloudActive}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Cloud pendientes</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{coverageCloudPending}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Fixtures</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{coverageFixture}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Sin cobertura</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{coverageMissing}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-0 divide-y divide-[var(--g-border-subtle)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {coverageRows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--g-text-primary)]">{row.label}</span>
                  <CoverageStateBadge state={row.state} label={row.sourceLabel} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
                  <span>{TIPO_LABELS[row.tipo] ?? row.tipo}</span>
                  {row.organoTipo ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{ORGANO_LABELS[row.organoTipo] ?? row.organoTipo}</span>
                    </>
                  ) : null}
                  {row.adoptionMode ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{MODE_LABELS[row.adoptionMode] ?? row.adoptionMode}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-[var(--g-text-secondary)]">
                {row.activeCloudCount > 0 ? (
                  <div>{row.activeCloudCount} activa</div>
                ) : row.pendingCloudCount > 0 ? (
                  <div>{row.pendingCloudCount} en ciclo</div>
                ) : row.fixtureAvailable ? (
                  <div>Pendiente carga</div>
                ) : (
                  <div>Pendiente Legal</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Search className="h-3.5 w-3.5" />
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
            <Filter className="h-3.5 w-3.5" />
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
              <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Shield className="h-3.5 w-3.5" />
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
              <option key={e} value={e}>{ESTADO_CONFIG[e]?.label || e}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Scale className="h-3.5 w-3.5" />
            Revisión legal
          </span>
          <select
            value={filterReview}
            onChange={(e) => setFilterReview(e.target.value as LegalTemplateReviewFilter)}
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {(Object.keys(LEGAL_REVIEW_FILTER_LABELS) as LegalTemplateReviewFilter[]).map((filter) => (
              <option key={filter} value={filter}>{LEGAL_REVIEW_FILTER_LABELS[filter]}</option>
            ))}
          </select>
        </label>
        <span className="pb-2 text-xs text-[var(--g-text-secondary)]">
          {filtered.length} de {scopedPlantillas.length} plantillas
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {coberturaTipos.map((item) => (
          <span
            key={item.tipo}
            className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
              item.activas > 0
                ? "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)]"
                : item.expected
                  ? "border-[var(--status-warning)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            <span className="font-medium text-[var(--g-text-primary)]">{item.label}</span>
            <span>{item.activas}/{item.total} activas</span>
          </span>
        ))}
      </div>

      {/* Master-detail layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Master list */}
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
              <div className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <FolderOpen className="h-9 w-9 text-[var(--g-text-secondary)]" />
                <p className="mt-3 text-sm font-medium text-[var(--g-text-primary)]">Sin plantillas que coincidan con los filtros.</p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  {isSociedadMode ? "Prueba a retirar filtros o revisar plantillas globales/multijurisdicción." : "Prueba a retirar filtros de tipo o estado."}
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

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
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
                      {organoLabel && <span>{organoLabel}</span>}
                      {organoLabel && <span>·</span>}
                      <span>{MODE_LABELS[p.adoption_mode ?? ""] || "Todos"}</span>
                      <span>·</span>
                      <span>v{p.version}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <LegalReviewBadge review={review} />
                      {localFixture ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--g-brand-3308)]">
                          <FileCode2 className="h-3 w-3" /> Fixture local
                        </span>
                      ) : null}
                      {hasCapa1 ? (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--status-success)]">
                          <CheckCircle2 className="h-3 w-3" /> Contenido jurídico
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--status-warning)]">
                          <AlertTriangle className="h-3 w-3" /> Sin contenido
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
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
              scopeContextLabel={isSociedadMode && selectedEntity ? `Se usará en el contexto de ${selectedEntityName}` : null}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="w-full max-w-xl text-center">
                {filtered.length === 0 && coberturaPendiente.length > 0 ? (
                  <>
                    <AlertTriangle className="mx-auto h-12 w-12 text-[var(--status-warning)]" />
                    <h2 className="mt-3 text-base font-semibold text-[var(--g-text-primary)]">
                      Cobertura documental pendiente
                    </h2>
                    <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                      {isSociedadMode && selectedEntity
                    ? `No hay plantillas activas aplicables a ${selectedEntityName} para la jurisdicción ${jurisdictionLabel(selectedJurisdiction)}.`
                        : "No hay plantillas activas para los filtros seleccionados."}
                    </p>
                    <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
                      {coberturaPendiente.map((item) => (
                        <div
                          key={item.key}
                          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <div className="text-sm font-medium text-[var(--g-text-primary)]">{item.label}</div>
                          <div className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                            {item.state === "fixture_pending_load"
                              ? "Cubierta por fixture local"
                              : item.pendingCloudCount > 0
                                ? "Sin versión Cloud activa"
                                : "Sin plantilla aplicable"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <FileText className="mx-auto h-12 w-12 text-[var(--g-border-subtle)]" />
                    <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
                      Selecciona una plantilla para ver su detalle y contenido jurídico.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
