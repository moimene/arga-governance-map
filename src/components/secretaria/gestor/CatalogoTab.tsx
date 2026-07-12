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
import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  extractTransitionResult,
  type PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { ConfigurationLoadError } from "@/components/secretaria/ConfigurationLoadError";
import { getTemplateUsageTarget } from "@/lib/secretaria/template-routing";
import {
  buildLegalTemplateReviewRows,
  isLocalFixture,
  matchesLegalTemplateReviewFilter,
  type LegalTemplateReviewFilter,
  type LegalTemplateReviewRow,
  type LegalTemplateReviewStatus,
} from "@/lib/secretaria/legal-template-review";
import { withLegalTeamTemplateFixtures } from "@/lib/secretaria/legal-template-fixtures";
import {
  isKnownP0,
  SEMANTIC_TONE_CLASS,
  adoptionModeLabel,
  estadoLabel,
  gatePreIssueLabel,
  organoLabel,
  templateStateTone,
  tipoSocialLabel,
  tipoLabel,
  TEMPLATE_PRIMARY_TRANSITIONS as TRANSITION_MAP,
} from "@/lib/secretaria/template-admin";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import { TriCapaEditor } from "./TriCapaEditor";
import { useTabAccess } from "./tab-guards";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTemplateBindings } from "@/hooks/useNormativeGovernance";
import { resolveMateriaAlias } from "@/lib/secretaria/mesa-control-societaria";
import {
  applyTemplateRouteScope,
  buildMatterCatalogUrl,
  buildTemplateLibraryUrl,
  patchSearchParams,
  templateCycleForEstado,
} from "@/lib/secretaria/template-configuration-routing";
import { groupTemplatesForGovernance } from "@/lib/secretaria/template-governance-ux";
import { useTenantContext } from "@/context/TenantContext";

type CatalogAudienceMode = "legal" | "tecnica";

const ESTADO_CONFIG: Record<string, { icon: ElementType }> = {
  BORRADOR: {
    icon: Edit3,
  },
  REVISADA: {
    icon: Eye,
  },
  APROBADA: {
    icon: CheckCircle2,
  },
  ACTIVA: {
    icon: Shield,
  },
  ARCHIVADA: {
    icon: FolderOpen,
  },
  DEPRECADA: {
    icon: AlertTriangle,
  },
};

const LEGAL_REVIEW_STATUS_STYLE: Record<
  LegalTemplateReviewStatus,
  { className: string; icon: ElementType }
> = {
  legally_approved: {
    className: SEMANTIC_TONE_CLASS.success,
    icon: BadgeCheck,
  },
  operational_unapproved: {
    className: SEMANTIC_TONE_CLASS.warning,
    icon: AlertTriangle,
  },
  needs_review: {
    className: SEMANTIC_TONE_CLASS.warning,
    icon: Scale,
  },
  fixture_bridge: {
    className: SEMANTIC_TONE_CLASS.warning,
    icon: FileCode2,
  },
  in_workflow: {
    className: SEMANTIC_TONE_CLASS.info,
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
  DRAFT_VERSION: "Versión provisional",
  MISSING_REFERENCE: "Falta referencia legal",
  MISSING_OWNER: "Falta órgano o forma de adopción",
  DUPLICATE_MATTER: "Plantilla activa equivalente",
  LOCAL_FIXTURE: "Cobertura provisional",
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

// ITEM-080/112 — DL-4: compatibilidad por tipo social. Una plantilla sin
// tipo_social (NULL) aplica a cualquier sociedad; si lo declara, solo aplica a
// sociedades del mismo régimen (SAU comparte régimen SA; SLU comparte régimen SL).
function regimenTipoSocial(value?: string | null): "SA" | "SL" | null {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "SA" || v === "SAU") return "SA";
  if (v === "SL" || v === "SLU" || v === "SRL") return "SL";
  return null;
}

function templateAppliesToTipoSocial(
  plantilla: PlantillaProtegidaRow,
  entityTipoSocial?: string | null,
) {
  if (!plantilla.tipo_social) return true; // NULL = aplica a todos
  const entidad = regimenTipoSocial(entityTipoSocial);
  if (!entidad) return true; // sin tipo social de entidad conocido, no filtramos
  return regimenTipoSocial(plantilla.tipo_social) === entidad;
}

function plantillaSearchText(plantilla: PlantillaProtegidaRow) {
  const materia = resolveMateriaAlias(plantilla.materia_acuerdo ?? plantilla.materia);
  return [
    plantilla.tipo,
    tipoLabel(plantilla.tipo),
    plantilla.materia,
    plantilla.materia_acuerdo,
    materia ? labelMateria(materia) : null,
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

// ITEM-087: lista accionable de issues del Gate PRE (código + mensaje + hint),
// con el mismo lenguaje visual que el preflight del TemplateImportWizard. Se usa
// tanto para los bloqueantes (GATE_PRE_BLOCKING) como para los warnings que el
// usuario debe reconocer (WARNINGS_NEED_ACK).
function GatePreIssueList({ issues }: { issues: GatePreIssue[] }) {
  return (
    <div className="space-y-2" aria-label="Incidencias de la comprobación documental previa">
      {issues.map((i, idx) => (
        <div
          key={`${i.code}-${idx}`}
          className={`flex gap-2 border p-3 text-sm ${
            i.severity === "BLOCKING"
              ? "border-[var(--status-error)] bg-[var(--status-error)]/10 text-[var(--g-text-primary)]"
              : i.severity === "WARNING"
                ? "border-[var(--status-warning)] bg-[var(--status-warning)]/10 text-[var(--g-text-primary)]"
                : "border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)]"
          }`}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <strong className="text-[var(--g-text-primary)]">{gatePreIssueLabel(i.code)}</strong>
            <span className="text-[var(--g-text-secondary)]"> — {i.message}</span>
            <span className="ml-1 font-mono text-[10px] text-[var(--g-text-secondary)]" title={i.code}>
              {i.code}
            </span>
            {i.hint ? (
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{i.hint}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ITEM-087: diálogo de reconocimiento de warnings no-bloqueantes (WARNINGS_NEED_ACK),
// reutilizando el patrón del wizard de importación (motivo ≥20 chars persistido en
// changelog). Sin esto, una transición APROBADA→ACTIVA con cualquier warning era
// imposible de completar desde el catálogo.
function TransitionAckDialog({
  issues,
  pending,
  onConfirm,
  onCancel,
}: {
  issues: GatePreIssue[];
  pending: boolean;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const tooShort = motivo.trim().length < 20;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    textareaRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onCancel, pending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-text-primary)]/40 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-ack-title"
        aria-describedby="catalog-ack-description"
        className="w-full max-w-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
      >
        <h2 id="catalog-ack-title" className="mb-2 text-lg font-semibold text-[var(--g-text-primary)]">
          Revisar advertencias de la comprobación documental
        </h2>
        <p id="catalog-ack-description" className="mb-4 text-sm text-[var(--g-text-secondary)]">
          La comprobación detectó advertencias no bloqueantes. Para continuar, escribe
          un motivo de al menos 20 caracteres; quedará registrado en el historial como
          evidencia documental.
        </p>
        <div className="mb-4 max-h-48 overflow-y-auto" role="region" aria-label="Advertencias detectadas" tabIndex={0}>
          <GatePreIssueList issues={issues} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--g-text-primary)]">
            Motivo (≥20 caracteres)
          </span>
          <textarea
            ref={textareaRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="P. ej.: Advertencias revisadas con el Comité Legal; se acepta marcar la plantilla como vigente."
            className="w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:border-[var(--g-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]/30"
            rows={4}
            aria-describedby="ack-catalogo-help"
            aria-invalid={motivo.length > 0 && tooShort ? "true" : undefined}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          <p id="ack-catalogo-help" className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {motivo.trim().length}/20 caracteres mínimos
          </p>
        </label>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-11 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(motivo.trim())}
            disabled={tooShort || pending}
            aria-busy={pending}
            className="inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {pending ? "Procesando…" : "Confirmar y marcar como vigente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado, localFixture }: { estado: string; localFixture?: boolean }) {
  // G3 (UX Oleada 1): un fixture local no debe presentarse como "Activa" — es
  // cobertura puente sin plantilla Cloud aprobada detrás. El badge de estado
  // pasa a "Cobertura provisional" en tono neutro con borde warning; el resto
  // de señales de fixture (LocalFixtureBadge, chips, avisos) se conservan.
  if (localFixture) {
    return (
      <span
        className="inline-flex items-center gap-1.5 border border-[var(--status-warning)] bg-[var(--g-surface-card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-primary)]"
        style={{ borderRadius: "var(--g-radius-full)" }}
      >
        <FileCode2 className="h-3 w-3" aria-hidden="true" />
        Cobertura provisional
      </span>
    );
  }
  const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.BORRADOR;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${SEMANTIC_TONE_CLASS[templateStateTone(estado)]}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {estadoLabel(estado)}
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

// ITEM-089: badge que distingue los fixtures locales del freeze del inventario Cloud real
function LocalFixtureBadge() {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold ${SEMANTIC_TONE_CLASS.warning}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <FileCode2 className="h-3 w-3" aria-hidden="true" />
      Fixture local · puente de cobertura
    </span>
  );
}

function ActiveWithP0Badge() {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold ${SEMANTIC_TONE_CLASS.error}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Incidencia crítica
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
        className="flex min-h-11 w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--g-brand-3308)] transition-colors"
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
  matterCodes,
  onOpenMatter,
  onOpenUsageCatalog,
  scopeContextLabel,
  audienceMode,
}: {
  plantilla: PlantillaProtegidaRow;
  review?: LegalTemplateReviewRow;
  onUseTemplate: (plantilla: PlantillaProtegidaRow) => void;
  matterCodes: string[];
  onOpenMatter: (materia: string) => void;
  onOpenUsageCatalog: () => void;
  scopeContextLabel?: string | null;
  audienceMode: CatalogAudienceMode;
}) {
  const updateEstado = useUpdateEstadoPlantilla();
  const { canAccess } = useTabAccess();
  const { user } = useCurrentUser();
  const canManageTemplates = canAccess("validacion");
  const estado = safeString(plantilla.estado, "BORRADOR");
  const tipo = safeString(plantilla.tipo, "SIN_TIPO");
  const localFixture = isLocalFixture(plantilla);
  const transition = localFixture || !canManageTemplates ? undefined : TRANSITION_MAP[estado];
  const tipoDisplayLabel = tipoLabel(tipo);
  const organoDisplayLabel = organoLabel(plantilla.organo_tipo);
  const modeDisplayLabel = adoptionModeLabel(plantilla.adoption_mode, {
    tipo: plantilla.tipo,
  });
  const usageTarget = getTemplateUsageTarget(plantilla);
  const isActiveP0 = estado === "ACTIVA" && isKnownP0(plantilla.id);

  // ITEM-087: el TransitionResult adjunto al Error ya no se descarta. Los issues
  // bloqueantes del Gate PRE se listan en un panel accionable; los warnings que
  // requieren ack abren un diálogo de reconocimiento (motivo ≥20 chars) que
  // reintenta con ackWarnings:true.
  const [blockingIssues, setBlockingIssues] = useState<GatePreIssue[]>([]);
  const [ackIssues, setAckIssues] = useState<GatePreIssue[] | null>(null);

  const runTransition = (motivo?: string, ackWarnings?: boolean) => {
    if (!transition) return;
    updateEstado.mutate(
      {
        id: plantilla.id,
        nuevo_estado: transition.next,
        aprobada_por: user?.email ?? "Comité Legal TGMS",
        motivo,
        ackWarnings,
      },
      {
        onSuccess: () => {
          setBlockingIssues([]);
          setAckIssues(null);
          toast.success(
            `Plantilla actualizada a ${estadoLabel(transition.next)}`,
          );
        },
        onError: (error) => {
          const result = extractTransitionResult(error);
          if (result && result.ok === false && result.reason === "GATE_PRE_BLOCKING") {
            // Gate PRE bloqueante: el usuario debe corregir la plantilla antes de
            // activarla. Se listan los issues (código + mensaje) en el panel.
            setBlockingIssues(result.issues);
            setAckIssues(null);
            toast.error(
              `La comprobación documental bloqueó la activación con ${result.issues.length} incidencia(s). Revisa el detalle.`,
            );
          } else if (result && result.ok === false && result.reason === "WARNINGS_NEED_ACK") {
            // Warnings no-bloqueantes: se abre el diálogo de reconocimiento.
            setBlockingIssues([]);
            setAckIssues(result.issues);
          } else if (result && result.ok === false && result.reason === "INVALID_TRANSITION") {
            setBlockingIssues([]);
            setAckIssues(null);
            toast.error(`Transición no permitida: ${result.from} → ${result.to}.`);
          } else if (result && result.ok === false && result.reason === "MISSING_APPROVAL_DATA") {
            setBlockingIssues([]);
            setAckIssues(null);
            toast.error(
              "Faltan los datos de aprobación formal para marcar la plantilla como vigente.",
            );
          } else {
            setBlockingIssues([]);
            setAckIssues(null);
            toast.error("No se pudo actualizar el estado de la plantilla", {
              description: error instanceof Error ? error.message : String(error),
            });
          }
        },
      },
    );
  };

  const handleTransition = () => {
    if (!transition) return;
    if (!window.confirm(transition.confirm)) return;
    setBlockingIssues([]);
    setAckIssues(null);
    runTransition();
  };

  const editorReadOnlyReason = localFixture
    ? "Fixture local no persistido: no admite edición tri-capa."
    : !canManageTemplates
      ? "Rol sin permisos de escritura sobre plantillas."
      : estado !== "BORRADOR"
        ? "Solo las plantillas en BORRADOR admiten edición tri-capa."
        : null;
  const editorReadOnlyDetail = localFixture
    ? "La cobertura provisional se muestra para revisión, pero no es una fila Cloud editable."
    : !canManageTemplates
      ? "Tu rol permite revisar esta plantilla, no modificarla."
      : estado !== "BORRADOR"
        ? "Las versiones fuera de borrador se conservan sin edición directa."
        : null;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--g-text-primary)]">{tipoDisplayLabel}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              <span
                className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {organoDisplayLabel}
              </span>
              <span
                className="bg-[var(--g-surface-muted)] px-2 py-0.5"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {modeDisplayLabel}
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
            {audienceMode === "tecnica" ? (
              <p className="mt-2 break-all font-mono text-[11px] text-[var(--g-text-secondary)]">
                ID {plantilla.id} · estado {plantilla.estado} · tipo {plantilla.tipo}
              </p>
            ) : null}
            {plantilla.referencia_legal ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {plantilla.referencia_legal}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {/* G3: en fixtures el badge de estado muestra "Cobertura provisional", no "Activa" */}
            <EstadoBadge estado={estado} localFixture={localFixture} />
            {/* ITEM-089: distingue fixtures locales del freeze frente a plantillas ACTIVA reales de Cloud */}
            {localFixture ? <LocalFixtureBadge /> : null}
            {isActiveP0 ? <ActiveWithP0Badge /> : null}
            <LegalReviewBadge review={review} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {matterCodes.map((materia) => (
            <button
              key={materia}
              type="button"
              onClick={() => onOpenMatter(materia)}
              className="flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Ver materia y regla: {labelMateria(materia)}
            </button>
          ))}
          {!localFixture ? (
            <button
              type="button"
              onClick={onOpenUsageCatalog}
              className="flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Ver en catálogo de uso
            </button>
          ) : null}
        </div>

        {transition ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Los fixtures locales conservan el CTA de uso: la navegación es client-side y el id
                se resuelve vía withLegalTeamTemplateFixtures (puente de cobertura del freeze, e2e 14/17). */}
            {estado === "ACTIVA" ? (
              <button
                type="button"
                onClick={() => onUseTemplate(plantilla)}
                className="flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors"
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
              className="flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50 transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={updateEstado.isPending}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {updateEstado.isPending ? "Procesando…" : transition.label}
            </button>
          </div>
        ) : null}

        {/* ITEM-087: panel accionable con los issues bloqueantes del Gate PRE,
            que antes solo eran visibles re-ejecutando manualmente el tab Validación. */}
        {blockingIssues.length > 0 ? (
          <div
            className="mt-3 border border-[var(--status-error)] bg-[var(--status-error)]/5 p-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--g-text-primary)]">
              <Shield className="h-3.5 w-3.5 text-[var(--status-error)]" aria-hidden="true" />
              La comprobación documental bloqueó la activación
            </div>
            <GatePreIssueList issues={blockingIssues} />
          </div>
        ) : null}

        {/* Los fixtures locales conservan el CTA de uso: la navegación es client-side y el id
            se resuelve vía withLegalTeamTemplateFixtures (puente de cobertura del freeze, e2e 14/17). */}
        {estado === "ACTIVA" && !transition ? (
          <button
            type="button"
            onClick={() => onUseTemplate(plantilla)}
            className="mt-3 flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors"
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
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Cobertura provisional no persistida: permite comprobar el recorrido y debe
            sustituirse por una plantilla aprobada antes del uso jurídico.
            No aparece en el catálogo de uso porque no es una fila Cloud gobernada.
          </p>
        ) : null}

        {isActiveP0 ? (
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Plantilla vigente con una incidencia crítica pendiente de revisión por el
            Comité Legal. Consulta Auditoría.
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
                Plantilla vigente con aprobación legal formal y sin incidencias de revisión
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
          readOnlyDetail={editorReadOnlyDetail}
          mode={audienceMode}
        />

        <SectionToggle title="Comprobación documental previa (Gate PRE)" icon={Shield} defaultOpen>
          <div className="space-y-2 text-xs text-[var(--g-text-secondary)]">
            <p>
              Esta configuración determina si la plantilla puede utilizarse en la
              comprobación documental previa de una materia.
            </p>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--g-text-primary)]">Versión de regla fijada:</span>
              {plantilla.snapshot_rule_pack_required ? (
                <span className="text-[var(--g-text-primary)]">Sí — regla aplicable obligatoria</span>
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

      {/* ITEM-087: diálogo de reconocimiento de warnings. Reintenta la transición
          con ackWarnings:true y el motivo escrito (persistido en changelog). */}
      {ackIssues ? (
        <TransitionAckDialog
          issues={ackIssues}
          pending={updateEstado.isPending}
          onConfirm={(motivo) => runTransition(motivo, true)}
          onCancel={() => setAckIssues(null)}
        />
      ) : null}
    </div>
  );
}

function GovernedVersionRow({
  plantilla,
  selected,
  review,
  audienceMode,
  setRef,
  onSelect,
}: {
  plantilla: PlantillaProtegidaRow;
  selected: boolean;
  review?: LegalTemplateReviewRow;
  audienceMode: CatalogAudienceMode;
  setRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
}) {
  const localFixture = isLocalFixture(plantilla);
  const isActiveP0 = plantilla.estado === "ACTIVA" && isKnownP0(plantilla.id);
  const hasCapa1 = !!plantilla.capa1_inmutable;
  const materia = resolveMateriaAlias(plantilla.materia_acuerdo ?? plantilla.materia);

  return (
    <button
      ref={setRef}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${tipoLabel(plantilla.tipo)} · ${materia ? labelMateria(materia) : "Sin materia"} · ${organoLabel(plantilla.organo_tipo)} · versión ${plantilla.version}`}
      className={`min-h-11 w-full px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--g-brand-3308)] ${
        selected
          ? "bg-[var(--g-sec-100)] ring-2 ring-inset ring-[var(--g-brand-3308)]"
          : "hover:bg-[var(--g-surface-subtle)]/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--g-text-primary)]">
          Versión {plantilla.version}
        </span>
        <EstadoBadge estado={plantilla.estado} localFixture={localFixture} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
        <span>{plantilla.jurisdiccion || "Jurisdicción no informada"}</span>
        <span>·</span>
        <span>{tipoSocialLabel(plantilla.tipo_social)}</span>
        {audienceMode === "tecnica" ? (
          <>
            <span>·</span>
            <span className="font-mono">{plantilla.id.slice(0, 8)}</span>
          </>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {isActiveP0 ? <ActiveWithP0Badge /> : null}
        <LegalReviewBadge review={review} />
        {localFixture ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--g-brand-3308)]">
            <FileCode2 className="h-3 w-3" aria-hidden="true" /> Fixture local
          </span>
        ) : null}
        <span className="flex items-center gap-1 text-[10px] text-[var(--g-text-secondary)]">
          {hasCapa1 ? (
            <CheckCircle2 className="h-3 w-3 text-[var(--status-success)]" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-[var(--status-warning)]" aria-hidden="true" />
          )}
          {hasCapa1 ? "Contenido jurídico" : "Sin contenido"}
        </span>
      </div>
    </button>
  );
}

export function CatalogoTab() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { isLoading: tenantLoading } = useTenantContext();
  const {
    data: plantillas,
    isPending: plantillasPending,
    isError,
    isFetching,
    refetch,
  } = usePlantillasProtegidas();
  const { data: templateBindings = [] } = useTemplateBindings();
  // Deep-links contextuales (?tab=catalogo&materia=X / &plantilla=Y) desde
  // CatalogoMaterias/ActivarMarcoNormativo: antes estos params se descartaban y
  // el CTA aterrizaba en un catálogo sin contexto. `materia` es un filtro exacto
  // con label jurídico; la búsqueda libre usa `q` y `plantilla` preselecciona ficha.
  const [searchParams, setSearchParams] = useSearchParams();
  const contextMatter = searchParams.get("materia");
  const requestedSearch = searchParams.get("q") ?? "";
  const audienceMode: CatalogAudienceMode =
    searchParams.get("modo") === "tecnica" ? "tecnica" : "legal";
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("plantilla") || null,
  );
  // G4 (UX Oleada 1): el catálogo abre con las vigentes por defecto ("ACTIVA");
  // "Todos los estados" y las archivadas/deprecadas quedan a un clic en el
  // select. Con ello el auto-select abre una ACTIVA, no una ARCHIVADA alfabética.
  const [filterEstado, setFilterEstado] = useState<string>(() => {
    const requested = searchParams.get("estado");
    return requested === "ALL" || (requested && ESTADO_CONFIG[requested]) ? requested : "ACTIVA";
  });
  const [filterTipo, setFilterTipo] = useState<string>("ALL");
  const [filterReview, setFilterReview] = useState<LegalTemplateReviewFilter>("ALL");
  const [filterP0, setFilterP0] = useState<"ALL" | "ONLY_P0">("ALL");
  const [searchQuery, setSearchQuery] = useState(requestedSearch);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(() => new Set());
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName =
    selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const selectedJurisdiction = selectedEntity?.jurisdiction ?? null;
  // ITEM-080/112: tipo social de la sociedad en scope para compatibilidad DL-4.
  const selectedTipoSocial = selectedEntity?.tipoSocial ?? null;
  const configurationLoading =
    tenantLoading || plantillasPending || (isSociedadMode && scope.isLoadingEntities);

  const scopedPlantillas = useMemo(() => {
    // No mezclar fixtures antes de que llegue Cloud: la selección anticipada
    // producía un detalle de fixture con la lista ya reemplazada por filas Cloud.
    if (configurationLoading) return [];
    const rows = withLegalTeamTemplateFixtures(plantillas ?? []);
    if (!isSociedadMode) return rows;
    return rows.filter(
      (plantilla) =>
        templateAppliesToJurisdiction(plantilla, selectedJurisdiction) &&
        templateAppliesToTipoSocial(plantilla, selectedTipoSocial),
    );
  }, [configurationLoading, isSociedadMode, plantillas, selectedJurisdiction, selectedTipoSocial]);

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
        if (
          contextMatter &&
          resolveMateriaAlias(p.materia_acuerdo ?? p.materia) !==
            resolveMateriaAlias(contextMatter)
        ) {
          return false;
        }
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
    [
      contextMatter,
      filterEstado,
      filterReview,
      filterTipo,
      filterP0,
      legalReviewById,
      scopedPlantillas,
      searchQuery,
    ],
  );

  // ITEM-089 + G3 (UX Oleada 1): el contador del catálogo explicita cuántos
  // ítems son fixtures locales puente (LEGAL-FIXTURE-2026-04-28), etiquetados
  // como cobertura provisional. El conteo filtrado (filtered.length) se
  // mantiene íntegro porque el filtro "Fixtures locales" sigue siendo legítimo.
  const fixtureCount = useMemo(
    () => scopedPlantillas.filter((p) => isLocalFixture(p)).length,
    [scopedPlantillas],
  );

  const selected = scopedPlantillas.find((p) => p.id === selectedId) ?? null;

  const deepLinkPlantillaId = searchParams.get("plantilla");
  const missingDeepLinkTarget = Boolean(
    deepLinkPlantillaId &&
      !configurationLoading &&
      !scopedPlantillas.some((plantilla) => plantilla.id === deepLinkPlantillaId),
  );

  // El target explícito tiene precedencia sobre todos los filtros. El efecto no
  // usa un boolean ref: un segundo `?plantilla=` en el mismo mount se resuelve
  // igual que el primero y el estado exacto queda recuperable en la URL.
  useEffect(() => {
    if (configurationLoading) return;

    if (deepLinkPlantillaId) {
      const target = scopedPlantillas.find((p) => p.id === deepLinkPlantillaId);
      if (!target) {
        setSelectedId(null);
        return;
      }

      const targetMatchesSearch =
        !searchQuery.trim() ||
        normalizeSearch(plantillaSearchText(target)).includes(normalizeSearch(searchQuery));
      const targetMatchesMatter =
        !contextMatter ||
        resolveMateriaAlias(target.materia_acuerdo ?? target.materia) ===
          resolveMateriaAlias(contextMatter);
      setFilterEstado(target.estado);
      setFilterTipo("ALL");
      setFilterReview("ALL");
      setFilterP0("ALL");
      if (!targetMatchesSearch) setSearchQuery("");
      setSelectedId(deepLinkPlantillaId);

      const next = patchSearchParams(searchParams, {
        estado: target.estado,
        materia: targetMatchesMatter ? undefined : null,
        q: targetMatchesSearch ? undefined : null,
      });
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
      return;
    }

    const requestedEstado = searchParams.get("estado");
    const nextEstado =
      requestedEstado === "ALL" || (requestedEstado && ESTADO_CONFIG[requestedEstado])
        ? requestedEstado
        : "ACTIVA";
    if (filterEstado !== nextEstado) setFilterEstado(nextEstado);
    if (searchQuery !== requestedSearch) setSearchQuery(requestedSearch);
    if (selectedId && filtered.some((p) => p.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [
    contextMatter,
    deepLinkPlantillaId,
    filterEstado,
    filtered,
    configurationLoading,
    scopedPlantillas,
    searchParams,
    searchQuery,
    selectedId,
    requestedSearch,
    setSearchParams,
  ]);

  const matchingTemplateIds = useMemo(
    () => new Set(filtered.map((template) => template.id)),
    [filtered],
  );
  const groupedTemplates = useMemo(
    () =>
      groupTemplatesForGovernance(scopedPlantillas, {
        matchingTemplateIds,
        targetTemplateId: deepLinkPlantillaId,
      }),
    [deepLinkPlantillaId, matchingTemplateIds, scopedPlantillas],
  );

  const selectedFamilyKey = useMemo(() => {
    if (!selectedId) return null;
    for (const typeGroup of groupedTemplates) {
      for (const matterGroup of typeGroup.matters) {
        const family = matterGroup.families.find((candidate) =>
          candidate.versions.some((version) => version.id === selectedId),
        );
        if (family) return family.functionalKey;
      }
    }
    return null;
  }, [groupedTemplates, selectedId]);

  useEffect(() => {
    if (!selectedFamilyKey) return;
    setExpandedFamilies((current) => {
      if (current.has(selectedFamilyKey)) return current;
      const next = new Set(current);
      next.add(selectedFamilyKey);
      return next;
    });
  }, [selectedFamilyKey]);

  useEffect(() => {
    if (!selectedId) return;
    const frame = window.requestAnimationFrame(() => {
      const container = listRef.current;
      const row = rowRefs.current[selectedId];
      if (!container || !row) return;
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      if (rowRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - rowRect.top;
      } else if (rowRect.bottom > containerRect.bottom) {
        container.scrollTop += rowRect.bottom - containerRect.bottom;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedFamilies, groupedTemplates, selectedId]);

  const tipos = [...new Set(scopedPlantillas.map((p) => p.tipo))].sort((a, b) =>
    tipoLabel(a).localeCompare(tipoLabel(b), "es"),
  );
  // G4: "ACTIVA" se garantiza en la lista para que el select controlado siempre
  // tenga una option que respalde su valor por defecto, incluso durante la carga.
  const estados = [...new Set(["ACTIVA", ...scopedPlantillas.map((p) => p.estado)])];

  const handleUseTemplate = (plantilla: PlantillaProtegidaRow) => {
    const target = getTemplateUsageTarget(plantilla).to;
    navigate(applyTemplateRouteScope(target, scope.mode, scope.selectedEntity?.id));
  };

  const selectedMatterCodes = useMemo(() => {
    if (!selected) return [];
    const bound = templateBindings
      .filter((binding) => binding.template_id === selected.id)
      .map((binding) => resolveMateriaAlias(binding.materia));
    const fallback = resolveMateriaAlias(selected.materia_acuerdo ?? selected.materia);
    if (fallback) bound.push(fallback);
    return [...new Set(bound.filter(Boolean))];
  }, [selected, templateBindings]);

  function updateCatalogParams(patch: Record<string, string | null | undefined>) {
    setSearchParams(patchSearchParams(searchParams, patch), { replace: true });
  }

  function toggleFamily(functionalKey: string) {
    setExpandedFamilies((current) => {
      const next = new Set(current);
      if (next.has(functionalKey)) next.delete(functionalKey);
      else next.add(functionalKey);
      return next;
    });
  }

  function setAudienceMode(mode: CatalogAudienceMode) {
    updateCatalogParams({ modo: mode === "tecnica" ? "tecnica" : null });
  }

  function selectTemplate(plantilla: PlantillaProtegidaRow) {
    setSelectedId(plantilla.id);
    updateCatalogParams({ plantilla: plantilla.id, estado: plantilla.estado });
  }

  function openMatter(materia: string) {
    navigate(
      scope.createScopedTo(
        buildMatterCatalogUrl({
          materia,
          vista: "plantillas",
          scope: scope.mode,
          entityId: scope.selectedEntity?.id,
        }),
      ),
    );
  }

  function openUsageCatalog() {
    if (!selected) return;
    navigate(
      scope.createScopedTo(
        buildTemplateLibraryUrl({
          materia: selectedMatterCodes[0],
          plantilla: selected.id,
          ciclo: templateCycleForEstado(selected.estado),
          scope: scope.mode,
          entityId: scope.selectedEntity?.id,
        }),
      ),
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Layers className="h-4 w-4" aria-hidden="true" />
          Catálogo de plantillas protegidas
        </div>
        <ConfigurationLoadError
          title="No se ha podido cargar el catálogo gobernado."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Layers className="h-4 w-4" aria-hidden="true" />
            Catálogo de plantillas protegidas
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
            {isSociedadMode
              ? `Filtros activos por jurisdicción de ${selectedEntityName}.`
              : "Biblioteca gobernada por tipo, materia, variante jurídica y serie de versiones."}
          </p>
        </div>
        <div
          className="inline-flex self-start border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-1"
          role="group"
          aria-label="Vista del contenido de las plantillas"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {(["legal", "tecnica"] as const).map((mode) => {
            const active = audienceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setAudienceMode(mode)}
                className={`min-h-11 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] ${
                  active
                    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                    : "text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                Vista {mode === "legal" ? "legal" : "técnica"}
              </button>
            );
          })}
        </div>
      </div>

      {contextMatter ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Contexto de materia activo">
          <span
            className="inline-flex min-h-11 items-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-subtle)] px-3 text-sm font-medium text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            Materia: {labelMateria(resolveMateriaAlias(contextMatter))}
          </span>
          <button
            type="button"
            onClick={() => updateCatalogParams({ materia: null, plantilla: null })}
            className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-[var(--g-link)] underline hover:text-[var(--g-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Quitar contexto
          </button>
        </div>
      ) : null}

      {missingDeepLinkTarget ? (
        <div
          role="alert"
          className="flex flex-col gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-[var(--g-text-primary)]">
                No se ha encontrado la plantilla solicitada en este ámbito.
              </p>
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                Puede haber sido archivada, eliminada del origen o no ser aplicable a la sociedad seleccionada.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateCatalogParams({ plantilla: null })}
            className="min-h-11 shrink-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Mostrar plantillas disponibles
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
        <label className="block sm:col-span-2 xl:col-span-2">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--g-text-secondary)]">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Buscar
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              updateCatalogParams({ q: e.target.value || null, plantilla: null });
            }}
            placeholder="Tipo, materia, referencia legal…"
            className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
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
            onChange={(e) => {
              setFilterTipo(e.target.value);
              updateCatalogParams({ plantilla: null });
            }}
            className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todos los tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {tipoLabel(t)}
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
            onChange={(e) => {
              setFilterEstado(e.target.value);
              updateCatalogParams({ estado: e.target.value, plantilla: null });
            }}
            className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todos los estados</option>
            {estados.map((e) => (
              <option key={e} value={e}>
                {estadoLabel(e)}
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
            onChange={(e) => {
              setFilterReview(e.target.value as LegalTemplateReviewFilter);
              updateCatalogParams({ plantilla: null });
            }}
            className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
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
            Incidencia crítica
          </span>
          <select
            value={filterP0}
            onChange={(e) => {
              setFilterP0(e.target.value as "ALL" | "ONLY_P0");
              updateCatalogParams({ plantilla: null });
            }}
            className="min-h-11 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todas</option>
            <option value="ONLY_P0">Solo activas con incidencia crítica</option>
          </select>
        </label>
        <span className="pb-2 text-xs text-[var(--g-text-secondary)] xl:col-span-6">
          {filtered.length} de {scopedPlantillas.length} plantillas
          {fixtureCount > 0
            ? ` · ${fixtureCount} ${
                fixtureCount === 1 ? "fixture puente" : "fixtures puente"
              } (cobertura provisional)`
            : ""}
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
          <div
            ref={listRef}
            className="max-h-[calc(100vh-380px)] overflow-y-auto"
            aria-label="Plantillas agrupadas por tipo, materia y variante jurídica"
          >
            {configurationLoading ? (
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
              groupedTemplates.map((typeGroup) => (
                <section key={typeGroup.tipo} aria-labelledby={`catalog-type-${typeGroup.tipo}`}>
                  <div className="border-y border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 first:border-t-0">
                    <h3
                      id={`catalog-type-${typeGroup.tipo}`}
                      className="text-xs font-bold uppercase tracking-wider text-[var(--g-text-primary)]"
                    >
                      {tipoLabel(typeGroup.tipo)}
                    </h3>
                    <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                      {typeGroup.familyCount} {typeGroup.familyCount === 1 ? "variante" : "variantes"}
                    </p>
                  </div>
                  {typeGroup.matters.map((matterGroup) => (
                    <section
                      key={`${typeGroup.tipo}-${matterGroup.canonicalMatter || "sin-materia"}`}
                      aria-label={
                        matterGroup.canonicalMatter
                          ? labelMateria(matterGroup.canonicalMatter)
                          : "Sin materia informada"
                      }
                    >
                      <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--g-brand-3308)]">
                          {matterGroup.canonicalMatter
                            ? labelMateria(matterGroup.canonicalMatter)
                            : "Sin materia informada"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">
                          {matterGroup.familyCount} {matterGroup.familyCount === 1 ? "variante jurídica" : "variantes jurídicas"}
                        </p>
                      </div>
                      {matterGroup.families.map((family) => {
                        const expanded = expandedFamilies.has(family.functionalKey);
                        const remainingVersions = family.versions.filter(
                          (version) => version.id !== family.head.id,
                        );
                        return (
                          <div
                            key={family.functionalKey}
                            className="border-b border-[var(--g-border-subtle)] last:border-b-0"
                          >
                            <div className="bg-[var(--g-surface-subtle)]/50 px-4 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[var(--g-text-primary)]">
                                    {organoLabel(family.organoTipo)} · {adoptionModeLabel(family.adoptionMode, { tipo: family.tipo })}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">
                                    {family.jurisdiccion || "Jurisdicción no informada"} · {tipoSocialLabel(family.tipoSocial)}
                                  </p>
                                  {family.hasHistoricalOnly ? (
                                    <p className="mt-1 text-[11px] font-medium text-[var(--status-warning)]">
                                      Sin versión vigente comparable
                                    </p>
                                  ) : null}
                                  {family.activeCount > 1 ? (
                                    <p className="mt-1 text-[11px] font-medium text-[var(--status-error)]">
                                      Incidencia: {family.activeCount} versiones vigentes equivalentes
                                    </p>
                                  ) : null}
                                </div>
                                {family.versions.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleFamily(family.functionalKey)}
                                    aria-expanded={expanded}
                                    className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-xs font-medium text-[var(--g-link)] hover:text-[var(--g-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                                    style={{ borderRadius: "var(--g-radius-md)" }}
                                  >
                                    {expanded ? (
                                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                    {family.versions.length} versiones
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <GovernedVersionRow
                              plantilla={family.head}
                              selected={selectedId === family.head.id}
                              review={legalReviewById.get(family.head.id)}
                              audienceMode={audienceMode}
                              setRef={(node) => {
                                rowRefs.current[family.head.id] = node;
                              }}
                              onSelect={() => selectTemplate(family.head)}
                            />
                            {expanded
                              ? remainingVersions.map((version) => (
                                  <GovernedVersionRow
                                    key={version.id}
                                    plantilla={version}
                                    selected={selectedId === version.id}
                                    review={legalReviewById.get(version.id)}
                                    audienceMode={audienceMode}
                                    setRef={(node) => {
                                      rowRefs.current[version.id] = node;
                                    }}
                                    onSelect={() => selectTemplate(version)}
                                  />
                                ))
                              : null}
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </section>
              ))
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
              key={selected.id}
              plantilla={selected}
              review={legalReviewById.get(selected.id)}
              onUseTemplate={handleUseTemplate}
              matterCodes={selectedMatterCodes}
              onOpenMatter={openMatter}
              onOpenUsageCatalog={openUsageCatalog}
              audienceMode={audienceMode}
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
