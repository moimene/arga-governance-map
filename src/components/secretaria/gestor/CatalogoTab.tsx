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
  extractTransitionResult,
  type PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";
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
import {
  isKnownP0,
  // ITEM-138: labels y transiciones canónicas compartidas (antes copiadas con
  // divergencias). TEMPLATE_PRIMARY_TRANSITIONS deriva de TRANSITION_MATRIX.
  TIPO_LABEL as TIPO_LABELS,
  ORGANO_LABEL as ORGANO_LABELS,
  MODE_LABEL as MODE_LABELS,
  TEMPLATE_PRIMARY_TRANSITIONS as TRANSITION_MAP,
} from "@/lib/secretaria/template-admin";
import { TriCapaEditor } from "./TriCapaEditor";
import { useTabAccess } from "./tab-guards";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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

// ITEM-087: lista accionable de issues del Gate PRE (código + mensaje + hint),
// con el mismo lenguaje visual que el preflight del TemplateImportWizard. Se usa
// tanto para los bloqueantes (GATE_PRE_BLOCKING) como para los warnings que el
// usuario debe reconocer (WARNINGS_NEED_ACK).
function GatePreIssueList({ issues }: { issues: GatePreIssue[] }) {
  return (
    <div className="space-y-2" aria-label="Incidencias del Gate PRE">
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
            <strong className="text-[var(--g-text-primary)]">{i.code}</strong>{" "}
            <span className="text-[var(--g-text-secondary)]">— {i.message}</span>
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
  const tooShort = motivo.trim().length < 20;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-text-primary)]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reconocer warnings antes de activar la plantilla"
    >
      <div
        className="w-full max-w-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
      >
        <h2 className="mb-2 text-lg font-semibold text-[var(--g-text-primary)]">
          Reconocer warnings del Gate PRE
        </h2>
        <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
          La transición detectó warnings no-bloqueantes. Para completarla, escribe un
          motivo de ≥20 caracteres que se persiste en el changelog como evidencia
          documental.
        </p>
        <div className="mb-4 max-h-48 overflow-y-auto">
          <GatePreIssueList issues={issues} />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--g-text-primary)]">
            Motivo (≥20 caracteres)
          </span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="P. ej.: Warnings revisadas con Comité Legal; se acepta activar tal cual."
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
            className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(motivo.trim())}
            disabled={tooShort || pending}
            aria-busy={pending}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {pending ? "Procesando…" : "Reconocer y activar"}
          </button>
        </div>
      </div>
    </div>
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

// ITEM-089: badge que distingue los fixtures locales del freeze del inventario Cloud real
function LocalFixtureBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <FileCode2 className="h-3 w-3" aria-hidden="true" />
      Fixture local · no usable
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
  const { user } = useCurrentUser();
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
            `Plantilla actualizada a ${ESTADO_CONFIG[transition.next]?.label ?? transition.next}`,
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
              `El Gate PRE bloqueó la activación con ${result.issues.length} incidencia(s). Revisa el detalle.`,
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
              "Faltan datos de aprobación (aprobada_por/fecha) para activar la plantilla.",
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
            {/* ITEM-089: distingue fixtures locales del freeze frente a plantillas ACTIVA reales de Cloud */}
            {localFixture ? <LocalFixtureBadge /> : null}
            {isActiveP0 ? <ActiveWithP0Badge /> : null}
            <LegalReviewBadge review={review} />
          </div>
        </div>

        {transition ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {/* ITEM-089: el CTA "Usar plantilla" no aplica a fixtures locales (id no resoluble en Cloud) */}
            {estado === "ACTIVA" && !localFixture ? (
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

        {/* ITEM-087: panel accionable con los issues bloqueantes del Gate PRE,
            que antes solo eran visibles re-ejecutando manualmente el tab Validación. */}
        {blockingIssues.length > 0 ? (
          <div
            className="mt-3 border border-[var(--status-error)] bg-[var(--status-error)]/5 p-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--status-error)]">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              Gate PRE bloqueó la activación
            </div>
            <GatePreIssueList issues={blockingIssues} />
          </div>
        ) : null}

        {/* ITEM-089: el CTA "Usar plantilla" no aplica a fixtures locales (id no resoluble en Cloud) */}
        {estado === "ACTIVA" && !transition && !localFixture ? (
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

        {/* ITEM-089: el hint de uso solo es válido para plantillas Cloud reales, no fixtures locales */}
        {estado === "ACTIVA" && !localFixture ? (
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

        <SectionToggle title="Gate PRE — Configuración" icon={Shield} defaultOpen>
          <div className="space-y-2 text-xs text-[var(--g-text-secondary)]">
            <p>
              Esta configuración determina si el motor puede usar la plantilla en el
              preflight documental de una materia.
            </p>
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

  // ITEM-089: el contador del catálogo desmezcla el inventario Cloud real de los
  // fixtures locales puente (LEGAL-FIXTURE-2026-04-28). Antes sumaba ambos como si
  // fueran plantillas equivalentes ("75"); ahora explicita la composición real
  // ("59 reales + 16 fixtures puente"). El conteo filtrado (filtered.length) se
  // mantiene íntegro porque el filtro "Fixtures locales" sigue siendo legítimo.
  const { realCount, fixtureCount } = useMemo(() => {
    let real = 0;
    let fixture = 0;
    for (const p of scopedPlantillas) {
      if (isLocalFixture(p)) fixture += 1;
      else real += 1;
    }
    return { realCount: real, fixtureCount: fixture };
  }, [scopedPlantillas]);

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
          {fixtureCount > 0
            ? ` · ${realCount} ${realCount === 1 ? "real" : "reales"} + ${fixtureCount} ${
                fixtureCount === 1 ? "fixture puente" : "fixtures puente"
              }`
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
                        ? "bg-[var(--g-sec-100)] ring-2 ring-inset ring-[var(--g-brand-3308)]"
                        : "hover:bg-[var(--g-surface-subtle)]/50"
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
