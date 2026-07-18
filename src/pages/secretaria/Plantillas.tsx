import {
  FileText,
  ChevronRight,
  CheckCircle,
  Clock,
  Archive,
  AlertCircle,
  AlertTriangle,
  Play,
  FolderOpen,
  Building2,
  ShieldCheck,
  Shield,
  GitCompare,
  Minus,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAssignTemplateBinding, useTemplateBindings } from "@/hooks/useNormativeGovernance";
import { useMateriaCatalogoSocietario } from "@/hooks/useMesaControlSocietaria";
import {
  usePlantillasProtegidas,
  useUpdateEstadoPlantilla,
  extractTransitionResult,
  PlantillaProtegidaRow,
  type TransitionAttemptContext,
} from "@/hooks/usePlantillasProtegidas";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";
import { gatePreIssueLabel } from "@/lib/secretaria/template-admin/gate-pre-issue-labels";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  FUNCTIONAL_MATTER_GROUPS,
  MATTER_GROUP_BY_MATERIA,
  normativeRoleFromAppRole,
  resolveMateriaAlias,
} from "@/lib/secretaria/mesa-control-societaria";
import {
  buildLegalTemplateReviewRows,
  matchesLegalTemplateReviewFilter,
  summarizeLegalTemplateReview,
  type LegalTemplateReviewFilter,
} from "@/lib/secretaria/legal-template-review";
import { getTemplateUsageTarget } from "@/lib/secretaria/template-routing";
import { templateUsabilityNotice } from "@/lib/doc-gen/template-operability";
import {
  // ITEM-138: labels y transiciones canónicas compartidas (antes copiadas con
  // divergencias en esta página, CatalogoTab y CoberturaLegalTab).
  TEMPLATE_PRIMARY_TRANSITIONS,
  SEMANTIC_TONE_CLASS,
  adoptionModeLabel as canonicalAdoptionModeLabel,
  buildFunctionalKey,
  organoLabel,
  serializeFunctionalKey,
  templateStateTone,
  tipoSocialLabel,
  tipoLabel,
  estadoLabel,
  jurisdictionLabel,
  // UX-7.B: modelo de cohortes de plantilla (clasificación pura + filtro).
  clasificarCohortePlantilla,
  cohorteLabel,
  COHORTE_ORDER,
} from "@/lib/secretaria/template-admin";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { CohorteBadge } from "@/components/secretaria/CohorteBadge";
import { ConfigurationLoadError } from "@/components/secretaria/ConfigurationLoadError";
import { toast } from "sonner";
import {
  applyTemplateRouteScope,
  buildMatterCatalogUrl,
  buildTemplateGovernanceUrl,
  isTemplateCycleParam,
  patchSearchParams,
  templateCycleForEstado,
} from "@/lib/secretaria/template-configuration-routing";
import { TemplateApprovalDialog } from "@/components/secretaria/TemplateApprovalDialog";
import {
  activeTemplateBindingMatters,
  buildTemplateBindingMutationInput,
  buildTemplateTransitionMutationInput,
  buildTemplateVersionComparison,
  canonicalBindingTipoSocial,
  hasEffectiveTemplateBinding,
  normalizeApprovalChecklist,
  normalizeTemplateEditableFields,
  normalizeTemplateVariables,
  resolveTemplateMatterContext,
  templateAppliesToSocialType,
  templateAvailabilityPresentation,
} from "@/lib/secretaria/template-library-ux";

const ESTADO_SORT_RANK: Record<string, number> = {
  ACTIVA: 0,
  APROBADA: 1,
  REVISADA: 2,
  BORRADOR: 3,
  ARCHIVADA: 4,
  DEPRECADA: 5,
};

// ITEM-138 (a): las transiciones se derivan del mapa canónico
// TEMPLATE_PRIMARY_TRANSITIONS (que a su vez valida contra TRANSITION_MATRIX).
// Aquí solo se adjunta el icono (capa UI) y se preserva el shape legacy
// { label, nextState, icon } que consume esta página.
const TRANSITION_ICONS: Record<string, LucideIcon> = {
  BORRADOR: Clock,
  REVISADA: CheckCircle,
  APROBADA: CheckCircle,
  ACTIVA: Archive,
};

const WORKFLOW_TRANSITIONS: Record<string, { label: string; nextState: string; icon: LucideIcon }> =
  Object.fromEntries(
    Object.entries(TEMPLATE_PRIMARY_TRANSITIONS).map(([from, t]) => [
      from,
      { label: t.label, nextState: t.next, icon: TRANSITION_ICONS[from] ?? Clock },
    ]),
  );

const MATERIAS_ACUERDO = [
  'APLICACION_RESULTADO',
  'APROBACION_CUENTAS',
  'APROBACION_PRESUPUESTO',
  'DISTRIBUCION_DIVIDENDOS',
  'DIVIDENDO_A_CUENTA',
  'NOMBRAMIENTO_CONSEJERO',
  'CESE_CONSEJERO',
  'DELEGACION_FACULTADES',
  'FORMULACION_CUENTAS',
  'CUENTAS_CONSOLIDADAS',
  'FINANCIACION',
  'CONTRATACION_RELEVANTE',
  'MODIFICACION_ESTATUTOS',
  'AUMENTO_CAPITAL',
  'EJECUCION_AUMENTO_DELEGADO',
  'REDUCCION_CAPITAL',
  'SUPRESION_PREFERENTE',
  'OPERACION_VINCULADA',
  'NOMBRAMIENTO_AUDITOR',
  'APROBACION_PLAN_NEGOCIO',
  'ACUERDO_CONVOCATORIA_JUNTA',
  'AUTORIZACION_GARANTIA',
  'TRANSMISION_PARTICIPACIONES',
  'PRESTACIONES_ACCESORIAS',
  'CONTRATOS_SOCIO_UNICO_SOCIEDAD',
  'EXCLUSION_SOCIO',
  'SEPARACION_SOCIO',
  'DISTRIBUCION_CARGOS',
  'APROBACION_REGLAMENTO_CONSEJO',
  'PODER_REPRESENTACION',
  'TRASLADO_DOMICILIO_NACIONAL',
  'RATIFICACION_ACTOS',
];

const FALLBACK_MATTER_GROUP = FUNCTIONAL_MATTER_GROUPS.find((g) => g.id === "INFORMACION_SEGUIMIENTO_CONTROL")
  ?? FUNCTIONAL_MATTER_GROUPS[0];

function matterGroup(value: string) {
  const groupId = MATTER_GROUP_BY_MATERIA[value] ?? FALLBACK_MATTER_GROUP.id;
  return FUNCTIONAL_MATTER_GROUPS.find((g) => g.id === groupId) ?? FALLBACK_MATTER_GROUP;
}

// Segmentación por ciclo de vida (informe UX Plantillas 2026-07-10): la vista
// por defecto responde a "qué plantilla puedo usar ahora" sin ocultar el
// histórico (política "todas visibles + avisar", decisión 2026-06-26).
type CicloSegment = "vigentes" | "preparacion" | "historico" | "todas";

const CICLO_SEGMENTS: Array<{ id: CicloSegment; label: string }> = [
  { id: "vigentes", label: "Vigentes" },
  { id: "preparacion", label: "En preparación" },
  { id: "historico", label: "Histórico" },
  { id: "todas", label: "Todas" },
];

function cicloOf(estado?: string | null): Exclude<CicloSegment, "todas"> {
  return templateCycleForEstado(estado);
}

function templateMatchesTypeParam(plantilla: PlantillaProtegidaRow, requested?: string | null) {
  if (!requested) return true;
  const normalized = requested.trim().toUpperCase().replace(/[ -]+/g, "_");
  if (plantilla.tipo === normalized) return true;
  if (normalized === "ACTA") return plantilla.tipo.startsWith("ACTA_");
  if (normalized === "PRE_ACUERDO") {
    return plantilla.tipo === "INFORME_PRECEPTIVO" || plantilla.tipo === "INFORME_DOCUMENTAL_PRE";
  }
  if (normalized === "CONVOCATORIA") return plantilla.tipo.startsWith("CONVOCATORIA");
  if (normalized === "MODELO_DE_ACUERDO") return plantilla.tipo === "MODELO_ACUERDO";
  if (normalized === "CERTIFICACIÓN" || normalized === "CERTIFICACION") {
    return plantilla.tipo === "CERTIFICACION";
  }
  if (normalized === "POST_ACUERDO") {
    return plantilla.tipo === "DOCUMENTO_REGISTRAL" || plantilla.tipo === "SUBSANACION_REGISTRAL";
  }
  return false;
}

// Identidad funcional para localizar la versión vigente que sustituye a una
// histórica (misma pieza: tipo + materia efectiva + órgano + adopción + jurisdicción).
function templateIdentityKey(t: PlantillaProtegidaRow) {
  return serializeFunctionalKey(buildFunctionalKey(t, t.tenant_id));
}

const INCIDENCIA_CHIPS: Array<{ filter: LegalTemplateReviewFilter; label: string; summaryKey: "draftVersion" | "duplicateMatter" | "missingOwner" | "missingReference" }> = [
  { filter: "DRAFT_VERSION", label: "Versión provisional", summaryKey: "draftVersion" },
  { filter: "DUPLICATE_MATTER", label: "Duplicidad de plantilla vigente", summaryKey: "duplicateMatter" },
  { filter: "MISSING_OWNER", label: "Falta órgano o forma de adopción", summaryKey: "missingOwner" },
  { filter: "MISSING_REFERENCE", label: "Falta referencia legal", summaryKey: "missingReference" },
];

function templateEngineSort(a: PlantillaProtegidaRow, b: PlantillaProtegidaRow) {
  const rankA = ESTADO_SORT_RANK[a.estado] ?? 99;
  const rankB = ESTADO_SORT_RANK[b.estado] ?? 99;
  return (
    rankA - rankB ||
    String(b.version).localeCompare(String(a.version), "es", { numeric: true }) ||
    tipoLabel(a.tipo).localeCompare(tipoLabel(b.tipo), "es")
  );
}

function materiaLabel(value?: string | null) {
  return value ? labelMateria(value) : "Materia no informada";
}

function adoptionModeLabel(value?: string | null, tipo?: string | null) {
  return canonicalAdoptionModeLabel(value, { tipo });
}

// Etiqueta de negocio de órgano compartida con el catálogo de materias
// (cubre CONSEJO_ADMIN, SOCIO_UNICO, ADMIN_UNICO, COMISION_DELEGADA, etc.).
function organoTipoLabel(value?: string | null) {
  return organoLabel(value);
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

// Advertencia de madurez (informe UX Plantillas): plantilla vigente con versión
// técnica/preliminar (0.x o sin formato de versión final, predicado
// isDraftVersion de legal-template-review). Vigente, pero se usa con cautela.
const MADUREZ_EXPLICACION =
  "Versión técnica o preliminar (0.x o sin formato de versión final): vigente con advertencia de madurez.";

function MadurezChip() {
  return (
    <span
      className="inline-flex items-center gap-1 border border-[var(--status-warning)] bg-[var(--g-surface-card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-full)" }}
      title={MADUREZ_EXPLICACION}
    >
      <AlertTriangle className="h-3 w-3 text-[var(--status-warning)]" aria-hidden="true" />
      Versión provisional
      <span className="sr-only">. {MADUREZ_EXPLICACION}</span>
    </span>
  );
}

function ProcessCoverageChips({
  items,
}: {
  items: Array<{ tipo: string; label: string; total: number; activas: number }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.tipo}
          className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1 text-xs text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          <span className="font-medium text-[var(--g-text-primary)]">{item.label}</span>
          <span>{item.activas}/{item.total} vigentes</span>
        </span>
      ))}
    </div>
  );
}

// ITEM-087: lista accionable de issues del Gate PRE (código + mensaje + hint),
// con el mismo lenguaje visual que el preflight del TemplateImportWizard.
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
// imposible de completar desde el catálogo de uso.
export function TransitionAckDialog({
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
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

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-text-primary)]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ack-plantillas-title"
      aria-describedby="ack-plantillas-description"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
      >
        <h2 id="ack-plantillas-title" className="mb-2 text-lg font-semibold text-[var(--g-text-primary)]">
          Revisar advertencias de la comprobación documental
        </h2>
        <p id="ack-plantillas-description" className="mb-4 text-sm text-[var(--g-text-secondary)]">
          La comprobación detectó advertencias no bloqueantes. Para continuar, escribe
          un motivo de al menos 20 caracteres; quedará registrado en el historial como
          evidencia documental.
        </p>
        <div
          className="mb-4 max-h-48 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
          role="region"
          aria-label="Advertencias que requieren reconocimiento"
          tabIndex={0}
        >
          <GatePreIssueList issues={issues} />
        </div>
        <div>
          <label className="block" htmlFor="ack-plantillas-motivo">
          <span className="mb-1 block text-sm font-medium text-[var(--g-text-primary)]">
            Motivo (≥20 caracteres)
          </span>
          </label>
          <textarea
            id="ack-plantillas-motivo"
            ref={textareaRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={pending}
            placeholder="P. ej.: Advertencias revisadas con el Comité Legal; se acepta marcar la plantilla como vigente."
            className="w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:border-[var(--g-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
            rows={4}
            aria-describedby="ack-plantillas-help"
            aria-invalid={motivo.length > 0 && tooShort ? "true" : undefined}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          <p id="ack-plantillas-help" className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {motivo.trim().length}/20 caracteres mínimos
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="min-h-11 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(motivo.trim())}
            disabled={tooShort || pending}
            aria-busy={pending}
            className="inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {pending ? "Procesando…" : "Confirmar y marcar como vigente"}
          </button>
        </div>
      </div>
    </div>
  );
}

type TransitionRunOptions = Partial<TransitionAttemptContext> & {
  motivo?: string;
  ackWarnings?: boolean;
  aprobadaPor?: string;
  fechaAprobacion?: string;
  confirmed?: boolean;
};

export default function Plantillas() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const {
    data,
    isLoading,
    isError,
    isFetching: isFetchingTemplates,
    refetch,
  } = usePlantillasProtegidas();
  const {
    data: templateBindings = [],
    isError: isBindingsError,
    isFetching: isFetchingBindings,
    isPending: isBindingsPending,
    refetch: refetchBindings,
  } = useTemplateBindings();
  const {
    data: materiaCatalog = [],
    isError: isMateriaCatalogError,
    isFetching: isFetchingMateriaCatalog,
    isPending: isMateriaCatalogPending,
    refetch: refetchMateriaCatalog,
  } = useMateriaCatalogoSocietario();
  const updateEstado = useUpdateEstadoPlantilla();
  const assignTemplate = useAssignTemplateBinding();
  const { primaryRole, user, displayName } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);
  const transitionActor = user?.email ?? displayName;
  // ITEM-084: solo ADMIN_TENANT gestiona el ciclo de vida de plantillas desde el
  // catálogo de uso (paridad con el guard del gestor).
  const canManageLifecycle = primaryRole === "ADMIN_TENANT";
  const [selected, setSelected] = useState<PlantillaProtegidaRow | null>(null);
  // ITEM-087: estado para superficie de errores accionables de transición.
  const [blockingIssues, setBlockingIssues] = useState<GatePreIssue[]>([]);
  const [ackIssues, setAckIssues] = useState<GatePreIssue[] | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PlantillaProtegidaRow | null>(null);
  const [pendingTransitionOptions, setPendingTransitionOptions] = useState<TransitionRunOptions>({});
  const [approvalTarget, setApprovalTarget] = useState<PlantillaProtegidaRow | null>(null);
  const [transitionAnnouncement, setTransitionAnnouncement] = useState("");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [detailFocusRequest, setDetailFocusRequest] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLElement>(null);
  const comparisonTriggerRef = useRef<HTMLButtonElement>(null);
  const shouldFocusDetailRef = useRef(false);
  const shouldFocusComparisonRef = useRef(false);
  const procesoTabRef = useRef<HTMLButtonElement>(null);
  const modelosTabRef = useRef<HTMLButtonElement>(null);
  const initialMateriaFilter = resolveMateriaAlias(searchParams.get("materia"));
  const initialTipoFilter = searchParams.get("tipo") ?? "";
  const materiaFilterParam = resolveMateriaAlias(searchParams.get("materia"));
  const tipoFilterParam = searchParams.get("tipo") ?? "";
  const plantillaFilterParam = searchParams.get("plantilla") ?? "";
  const [activeTab, setActiveTab] = useState<'proceso' | 'modelos'>(() =>
    initialTipoFilter
      ? initialTipoFilter.toUpperCase().includes("MODELO")
        ? "modelos"
        : "proceso"
      : initialMateriaFilter
        ? "modelos"
        : "proceso",
  );
  const [filterMateria, setFilterMateria] = useState<string>(initialMateriaFilter);
  // UX-7.B: filtro por cohorte de plantilla (aplica a ambas pestañas).
  const [filterCohorte, setFilterCohorte] = useState<string>("");
  // Informe UX Plantillas: segmento de ciclo (default = qué puedo usar ahora).
  const [filterCiclo, setFilterCiclo] = useState<CicloSegment>(() => {
    const requested = searchParams.get("ciclo");
    return isTemplateCycleParam(requested) ? requested : "vigentes";
  });
  // Filtro de incidencias de calidad documental (reutiliza legal-template-review).
  const [filterRevision, setFilterRevision] = useState<LegalTemplateReviewFilter | "">("");
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const selectedJurisdiction = selectedEntity?.jurisdiction ?? null;
  const selectedEntityTipoSocial = selectedEntity?.tipoSocial ?? null;

  const scopedData = useMemo(() => {
    const rows = data ?? [];
    if (!isSociedadMode) return rows;
    return rows.filter(
      (plantilla) =>
        templateAppliesToJurisdiction(plantilla, selectedJurisdiction) &&
        templateAppliesToSocialType(plantilla, selectedEntityTipoSocial),
    );
  }, [data, isSociedadMode, selectedEntityTipoSocial, selectedJurisdiction]);

  // Salud documental (informe UX Plantillas): agrega los detectores existentes
  // de legal-template-review sobre las VIGENTES — no crea un sistema nuevo.
  const vigentesData = useMemo(() => scopedData.filter((p) => cicloOf(p.estado) === "vigentes"), [scopedData]);
  const showTipoSocialColumn = useMemo(
    () => scopedData.some((plantilla) => canonicalBindingTipoSocial(plantilla.tipo_social) !== "ANY"),
    [scopedData],
  );
  const reviewRows = useMemo(() => buildLegalTemplateReviewRows(vigentesData), [vigentesData]);
  const reviewByTemplateId = useMemo(
    () => new Map(reviewRows.map((row) => [row.templateId, row])),
    [reviewRows],
  );
  const reviewSummary = useMemo(() => summarizeLegalTemplateReview(reviewRows), [reviewRows]);
  const healthMetrics = useMemo(() => {
    const historico = scopedData.filter((p) => cicloOf(p.estado) === "historico").length;
    const modelosVigentes = vigentesData.filter((p) => p.tipo === "MODELO_ACUERDO").length;
    return {
      vigentes: vigentesData.length,
      modelos: modelosVigentes,
      historico,
      incidencias: reviewSummary.needsReview,
    };
  }, [reviewSummary.needsReview, scopedData, vigentesData]);

  const runTransicion = (
    plantilla: PlantillaProtegidaRow,
    options: TransitionRunOptions = {},
  ) => {
    const transition = WORKFLOW_TRANSITIONS[plantilla.estado];
    if (!transition) return;
    // ITEM-084: confirmación explícita antes de mutar el ciclo de vida (paridad
    // con el window.confirm del gestor; evita archivar/activar de un solo clic).
    if (
      !options.confirmed &&
      !window.confirm(
        `¿Confirmar la transición de la plantilla a "${estadoLabel(transition.nextState)}"? Esta acción queda registrada en la auditoría.`,
      )
    ) {
      return;
    }

    updateEstado.mutate(
      buildTemplateTransitionMutationInput({
        templateId: plantilla.id,
        nextState: transition.nextState,
        motivo: options.motivo,
        ackWarnings: options.ackWarnings,
        aprobadaPor: options.aprobadaPor,
        fechaAprobacion: options.fechaAprobacion,
        actor: transitionActor,
        operationId: options.operationId,
        expectedFrom: options.expectedFrom,
        expectedPredecessorId: options.expectedPredecessorId,
      }),
      {
        onSuccess: () => {
          const successMessage = `Plantilla transicionada a ${estadoLabel(transition.nextState)}`;
          setBlockingIssues([]);
          setAckIssues(null);
          setPendingTransition(null);
          setPendingTransitionOptions({});
          setApprovalTarget(null);
          setTransitionAnnouncement(successMessage);
          toast.success(successMessage);
          setSelected(null);
          window.requestAnimationFrame(() => {
            (activeTab === "modelos" ? modelosTabRef.current : procesoTabRef.current)?.focus();
          });
        },
        onError: (error) => {
          // ITEM-075 + ITEM-087: el TransitionResult adjunto al Error ya no se descarta. Los
          // issues bloqueantes del Gate PRE se listan en un panel accionable y los
          // warnings que requieren ack abren el diálogo de reconocimiento.
          const result = extractTransitionResult(error);
          if (result && result.ok === false && result.reason === "GATE_PRE_BLOCKING") {
            setBlockingIssues(result.issues);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            toast.error(
              `La comprobación documental bloqueó la activación con ${result.issues.length} incidencia(s). Revisa el detalle.`,
            );
          } else if (result && result.ok === false && result.reason === "WARNINGS_NEED_ACK") {
            setBlockingIssues([]);
            setAckIssues(result.issues);
            setPendingTransition(plantilla);
            setPendingTransitionOptions({
              ...options,
              operationId: result.operationId,
              expectedFrom: result.expectedFrom,
              expectedPredecessorId: result.expectedPredecessorId,
              confirmed: true,
            });
          } else if (result && result.ok === false && result.reason === "STALE_STATE") {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            setApprovalTarget(null);
            setSelected(null);
            void refetch().finally(() => {
              window.requestAnimationFrame(() => {
                (activeTab === "modelos" ? modelosTabRef.current : procesoTabRef.current)?.focus();
              });
            });
            toast.error(
              "La plantilla cambió en otra sesión. Estamos actualizando los datos; revisa su estado antes de volver a intentarlo.",
            );
          } else if (result && result.ok === false && result.reason === "STALE_PREDECESSOR") {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            setApprovalTarget(null);
            setSelected(null);
            void refetch().finally(() => {
              window.requestAnimationFrame(() => {
                (activeTab === "modelos" ? modelosTabRef.current : procesoTabRef.current)?.focus();
              });
            });
            toast.error(
              "La plantilla vigente que iba a sustituirse ha cambiado. Estamos actualizando los datos; revisa la identidad documental antes de confirmar de nuevo.",
            );
          } else if (result && result.ok === false && result.reason === "INVALID_TRANSITION") {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            setApprovalTarget(null);
            toast.error(`Transición no permitida: ${result.from} → ${result.to}.`);
          } else if (result && result.ok === false && result.reason === "MISSING_APPROVAL_DATA") {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            toast.error(
              "Faltan los datos de aprobación formal para aprobar la plantilla.",
            );
          } else if (
            result &&
            result.ok === false &&
            result.reason === "ACTIVE_BINDINGS_REQUIRE_REPLACEMENT"
          ) {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            toast.error(
              "Esta plantilla tiene vinculaciones activas. Activa primero una plantilla sustituta de la misma identidad documental; las vinculaciones se moverán automáticamente antes de archivar la vigente.",
            );
          } else {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
            toast.error("Error al actualizar el estado de la plantilla", {
              description: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }
    );
  };

  const handleTransicion = (plantilla: PlantillaProtegidaRow) => {
    const transition = WORKFLOW_TRANSITIONS[plantilla.estado];
    if (!transition) return;
    setBlockingIssues([]);
    setAckIssues(null);
    setPendingTransition(null);
    setPendingTransitionOptions({});
    if (transition.nextState === "APROBADA") {
      setApprovalTarget(plantilla);
      return;
    }
    runTransicion(plantilla);
  };

  const catalogMatterCodes = useMemo(
    () => [...new Set(materiaCatalog.map((row) => resolveMateriaAlias(row.materia)).filter(Boolean))],
    [materiaCatalog],
  );

  const handleAssignBinding = (plantilla: PlantillaProtegidaRow, materia: string) => {
    const canonicalMatter = resolveMateriaAlias(materia);
    if (!canonicalMatter || !catalogMatterCodes.includes(canonicalMatter)) {
      toast.error("Selecciona una materia canónica antes de vincular la plantilla.");
      return;
    }
    const mutationInput = buildTemplateBindingMutationInput({
      template: plantilla,
      bindings: templateBindings,
      materia: canonicalMatter,
      entityTipoSocial: selectedEntity?.tipoSocial,
      jurisdiction: selectedEntity?.jurisdiction,
      userRole: normativeRole,
    });
    if (!mutationInput) {
      toast.info("La plantilla ya está vinculada a esta regla.");
      return;
    }
    assignTemplate.mutate(
      mutationInput,
      {
        onSuccess: () => toast.success("Plantilla vinculada a la regla aplicable."),
        onError: (error) => toast.error(error instanceof Error ? error.message : "No se pudo vincular la plantilla."),
      },
    );
  };

  const procesoDatos = useMemo(
    () => scopedData.filter((p) => p.tipo !== 'MODELO_ACUERDO'),
    [scopedData],
  );
  const modelosDatos = useMemo(
    () => scopedData.filter((p) => p.tipo === 'MODELO_ACUERDO'),
    [scopedData],
  );
  const materiaOptionsByGroup = useMemo(() => {
    // B7 Lote 3: dedupe por código canónico — sin él, un alias legacy presente
    // en datos históricos (p.ej. APROBACION_PRESUPUESTOS archivada) duplicaba
    // la opción con el mismo label jurídico.
    const materias = new Set<string>(MATERIAS_ACUERDO.map((materia) => resolveMateriaAlias(materia)));
    for (const plantilla of modelosDatos) {
      const materia = plantilla.materia_acuerdo ?? plantilla.materia;
      if (materia) materias.add(resolveMateriaAlias(materia));
      for (const bindingMatter of activeTemplateBindingMatters(templateBindings, plantilla.id)) {
        materias.add(resolveMateriaAlias(bindingMatter));
      }
    }

    return FUNCTIONAL_MATTER_GROUPS.map((group) => {
      const options = [...materias]
        .filter((materia) => matterGroup(materia).id === group.id)
        .sort((a, b) => materiaLabel(a).localeCompare(materiaLabel(b), "es"))
        .map((materia) => ({ value: materia, label: materiaLabel(materia) }));

      return { group, options };
    }).filter((entry) => entry.options.length > 0);
  }, [modelosDatos, templateBindings]);
  const displayData = activeTab === 'proceso' ? procesoDatos : modelosDatos;
  const procesoCoverage = [...new Set(procesoDatos.map((p) => p.tipo))].map((tipo) => {
    const rows = procesoDatos.filter((p) => p.tipo === tipo);
    return {
      tipo,
      label: tipoLabel(tipo),
      total: rows.length,
      activas: rows.filter((p) => p.estado === "ACTIVA").length,
    };
  });

  const cicloCounts = useMemo(() => {
    const counts: Record<CicloSegment, number> = { vigentes: 0, preparacion: 0, historico: 0, todas: displayData.length };
    for (const plantilla of displayData) counts[cicloOf(plantilla.estado)] += 1;
    return counts;
  }, [displayData]);

  // Incidencias de la PESTAÑA activa: los chips y su filtro deben coincidir con
  // lo que la tabla puede mostrar (missingOwner/missingReference solo existen en
  // modelos; un chip global daría vacíos garantizados en la pestaña proceso).
  const tabReviewRows = useMemo(
    () => buildLegalTemplateReviewRows(displayData.filter((p) => cicloOf(p.estado) === "vigentes")),
    [displayData],
  );
  const tabReviewById = useMemo(
    () => new Map(tabReviewRows.map((row) => [row.templateId, row])),
    [tabReviewRows],
  );
  const tabReviewSummary = useMemo(() => summarizeLegalTemplateReview(tabReviewRows), [tabReviewRows]);

  const filteredData = useMemo(
    () => {
      let rows = activeTab === 'modelos' && filterMateria
        ? displayData.filter(
            (p) =>
              resolveMateriaAlias(p.materia_acuerdo ?? p.materia) === filterMateria ||
              activeTemplateBindingMatters(templateBindings, p.id).includes(filterMateria),
          )
        : displayData;
      if (tipoFilterParam) {
        rows = rows.filter((p) => templateMatchesTypeParam(p, tipoFilterParam));
      }
      if (filterCiclo !== "todas") {
        rows = rows.filter((p) => cicloOf(p.estado) === filterCiclo);
      }
      if (filterRevision) {
        rows = rows.filter((p) => matchesLegalTemplateReviewFilter(tabReviewById.get(p.id), filterRevision));
      }
      if (filterCohorte) {
        rows = rows.filter((p) => clasificarCohortePlantilla(p) === filterCohorte);
      }
      return [...rows].sort(templateEngineSort);
    },
    [activeTab, displayData, filterMateria, filterCiclo, filterRevision, tabReviewById, filterCohorte, templateBindings, tipoFilterParam],
  );

  // Sustitución segura: solo una ACTIVA con la misma identidad funcional completa.
  // Si hay cero o varias candidatas no inferimos el linaje desde texto libre.
  const replacementCandidatesForSelected = useMemo(() => {
    if (!selected || cicloOf(selected.estado) !== "historico") return [];
    const identity = templateIdentityKey(selected);
    return scopedData.filter(
      (p) => cicloOf(p.estado) === "vigentes" && templateIdentityKey(p) === identity,
    );
  }, [scopedData, selected]);
  const replacementForSelected =
    replacementCandidatesForSelected.length === 1
      ? replacementCandidatesForSelected[0]
      : null;
  const replacementIsAmbiguous = replacementCandidatesForSelected.length > 1;
  const versionComparison = useMemo(
    () =>
      selected && replacementForSelected
        ? buildTemplateVersionComparison(selected, replacementForSelected)
        : null,
    [replacementForSelected, selected],
  );

  const missingDeepLinkTarget = Boolean(
    plantillaFilterParam &&
      !isLoading &&
      !scopedData.some((plantilla) => plantilla.id === plantillaFilterParam),
  );

  const selectedBoundMatterCodes = useMemo(
    () => activeTemplateBindingMatters(templateBindings, selected?.id),
    [selected?.id, templateBindings],
  );
  const selectedRegisteredBoundMatterCodes = useMemo(
    () => selectedBoundMatterCodes.filter((materia) => catalogMatterCodes.includes(materia)),
    [catalogMatterCodes, selectedBoundMatterCodes],
  );
  const selectedMatterCodes = useMemo(() => {
    if (!selected) return [];
    if (selectedRegisteredBoundMatterCodes.length > 0) return selectedRegisteredBoundMatterCodes;
    const fallback = resolveMateriaAlias(selected.materia_acuerdo ?? selected.materia);
    return fallback && catalogMatterCodes.includes(fallback) ? [fallback] : [];
  }, [catalogMatterCodes, selected, selectedRegisteredBoundMatterCodes]);
  const selectedAvailability = selected
    ? templateAvailabilityPresentation(selected)
    : null;
  const selectedChecklist = useMemo(
    () => normalizeApprovalChecklist(selected?.approval_checklist),
    [selected?.approval_checklist],
  );
  const selectedVariables = useMemo(
    () => normalizeTemplateVariables(selected?.capa2_variables),
    [selected?.capa2_variables],
  );
  const selectedEditableFields = useMemo(
    () => normalizeTemplateEditableFields(selected?.capa3_editables),
    [selected?.capa3_editables],
  );
  const selectedBindingTipoSocial = canonicalBindingTipoSocial(selectedEntity?.tipoSocial);
  const selectedEffectiveBindingMatterCodes = useMemo(() => {
    if (!selected) return [];
    return selectedRegisteredBoundMatterCodes.filter((materia) =>
      hasEffectiveTemplateBinding(templateBindings, {
        template: selected,
        materia,
        jurisdiccion: selectedEntity?.jurisdiction ?? selected.jurisdiccion,
        tipoSocial: selectedBindingTipoSocial,
      }),
    );
  }, [selected, selectedBindingTipoSocial, selectedEntity?.jurisdiction, selectedRegisteredBoundMatterCodes, templateBindings]);
  const selectedBindingMateria = selected
    ? resolveTemplateMatterContext({
        requestedMatter: materiaFilterParam,
        templateMatter: selected.materia_acuerdo ?? selected.materia,
        boundMatters: selectedEffectiveBindingMatterCodes,
        knownMatters: catalogMatterCodes,
      })
    : "";
  const selectedIsAlreadyBound = Boolean(
    selected &&
      selectedBindingMateria &&
      hasEffectiveTemplateBinding(templateBindings, {
        template: selected,
        materia: selectedBindingMateria,
        jurisdiccion: selectedEntity?.jurisdiction ?? selected.jurisdiccion,
        tipoSocial: selectedBindingTipoSocial,
      }),
  );
  const hasAmbiguousBindingContext = Boolean(
    selected &&
      !resolveMateriaAlias(materiaFilterParam) &&
      selectedEffectiveBindingMatterCodes.length > 1,
  );

  function updateLibraryParams(patch: Record<string, string | null | undefined>) {
    setSearchParams(patchSearchParams(searchParams, patch), { replace: true });
  }

  function selectLibraryTemplate(
    plantilla: PlantillaProtegidaRow,
    options: { focusDetail?: boolean } = {},
  ) {
    shouldFocusDetailRef.current =
      Boolean(options.focusDetail) ||
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches;
    if (shouldFocusDetailRef.current) {
      setDetailFocusRequest((current) => current + 1);
    }
    setComparisonOpen(false);
    setSelected(plantilla);
    updateLibraryParams({
      plantilla: plantilla.id,
      ciclo: cicloOf(plantilla.estado),
      tipo: plantilla.tipo === "MODELO_ACUERDO" ? "MODELO_ACUERDO" : null,
    });
  }

  function openVersionComparison() {
    if (!versionComparison) return;
    shouldFocusComparisonRef.current = true;
    setComparisonOpen(true);
  }

  function closeVersionComparison() {
    setComparisonOpen(false);
    window.requestAnimationFrame(() => comparisonTriggerRef.current?.focus());
  }

  function openTemplateGovernance() {
    if (!selected) return;
    navigate(
      scope.createScopedTo(
        buildTemplateGovernanceUrl({
          materia: selectedBindingMateria || undefined,
          plantilla: selected.id,
          estado: selected.estado,
          scope: scope.mode,
          entityId: scope.selectedEntity?.id,
        }),
      ),
    );
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

  function activateLibraryTab(tab: "proceso" | "modelos", moveFocus = false) {
    setActiveTab(tab);
    setSelected(null);
    setComparisonOpen(false);
    setFilterMateria("");
    setFilterRevision("");
    setFilterCohorte("");
    updateLibraryParams({
      plantilla: null,
      materia: null,
      tipo: tab === "modelos" ? "MODELO_ACUERDO" : null,
    });
    if (moveFocus) {
      window.requestAnimationFrame(() => {
        (tab === "modelos" ? modelosTabRef.current : procesoTabRef.current)?.focus();
      });
    }
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    current: "proceso" | "modelos",
  ) {
    let target: "proceso" | "modelos" | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      target = current === "proceso" ? "modelos" : "proceso";
    } else if (event.key === "Home") {
      target = "proceso";
    } else if (event.key === "End") {
      target = "modelos";
    }
    if (!target) return;
    event.preventDefault();
    activateLibraryTab(target, true);
  }

  useEffect(() => {
    if (!selected || !shouldFocusDetailRef.current) return;
    shouldFocusDetailRef.current = false;
    window.requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, [detailFocusRequest, selected]);

  useEffect(() => {
    if (!comparisonOpen || !shouldFocusComparisonRef.current) return;
    shouldFocusComparisonRef.current = false;
    window.requestAnimationFrame(() => {
      comparisonRef.current?.focus({ preventScroll: true });
      comparisonRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, [comparisonOpen]);

  useEffect(() => {
    if (plantillaFilterParam) {
      if (isBindingsPending || isMateriaCatalogPending) return;
      const target = scopedData.find((plantilla) => plantilla.id === plantillaFilterParam);
      if (!target) {
        if (!isLoading) setSelected(null);
        return;
      }

      const targetTab = target.tipo === "MODELO_ACUERDO" ? "modelos" : "proceso";
      const targetMatter =
        targetTab === "modelos"
          ? resolveTemplateMatterContext({
              requestedMatter: materiaFilterParam,
              templateMatter: target.materia_acuerdo ?? target.materia,
              boundMatters: activeTemplateBindingMatters(templateBindings, target.id),
              knownMatters: catalogMatterCodes,
            })
          : "";
      const targetCycle = cicloOf(target.estado);
      setActiveTab(targetTab);
      setFilterMateria(targetMatter);
      setFilterCiclo(targetCycle);
      setFilterRevision("");
      setFilterCohorte("");
      setComparisonOpen(false);
      setSelected(target);

      const next = patchSearchParams(searchParams, {
        materia: targetMatter || null,
        tipo: targetTab === "modelos" ? "MODELO_ACUERDO" : null,
        ciclo: targetCycle,
      });
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
      return;
    }

    const requestedCycle = searchParams.get("ciclo");
    const nextCycle = isTemplateCycleParam(requestedCycle) ? requestedCycle : "vigentes";
    const nextTab = tipoFilterParam
      ? tipoFilterParam.toUpperCase().includes("MODELO")
        ? "modelos"
        : "proceso"
      : materiaFilterParam
        ? "modelos"
        : activeTab;
    const canonical = patchSearchParams(searchParams, {
      ciclo:
        requestedCycle && !isTemplateCycleParam(requestedCycle)
          ? "vigentes"
          : undefined,
      tipo:
        nextTab === "modelos" && tipoFilterParam !== "MODELO_ACUERDO"
          ? "MODELO_ACUERDO"
          : undefined,
    });
    if (canonical.toString() !== searchParams.toString()) {
      setSearchParams(canonical, { replace: true });
    }
    if (filterCiclo !== nextCycle) setFilterCiclo(nextCycle);
    if (activeTab !== nextTab) setActiveTab(nextTab);
    const nextMateria = nextTab === "modelos" ? materiaFilterParam : "";
    if (filterMateria !== nextMateria) setFilterMateria(nextMateria);

    setSelected((current) => {
      if (current && filteredData.some((plantilla) => plantilla.id === current.id)) return current;
      return filteredData[0] ?? null;
    });
  }, [
    activeTab,
    filterCiclo,
    filterMateria,
    filteredData,
    catalogMatterCodes,
    isBindingsPending,
    isLoading,
    isMateriaCatalogPending,
    materiaFilterParam,
    plantillaFilterParam,
    scopedData,
    searchParams,
    setSearchParams,
    templateBindings,
    tipoFilterParam,
  ]);

  if (isError || isBindingsError || isMateriaCatalogError) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Secretaría · Plantillas
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Plantillas documentales
          </h1>
        </div>
        <ConfigurationLoadError
          title={
            isBindingsError
              ? "No se han podido cargar el catálogo y sus vinculaciones."
              : isMateriaCatalogError
                ? "No se ha podido validar el catálogo canónico de materias."
              : "No se ha podido cargar el catálogo de plantillas."
          }
          onRetry={() => {
            void refetch();
            void refetchBindings();
            void refetchMateriaCatalog();
          }}
          retrying={isFetchingTemplates || isFetchingBindings || isFetchingMateriaCatalog}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Encabezado */}
      <div className="mb-6">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {transitionAnnouncement}
        </p>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileText className="h-3.5 w-3.5" />
          Secretaría · Plantillas
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {isSociedadMode ? `Plantillas aplicables a ${selectedEntityName}` : "Plantillas documentales protegidas"}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {isSociedadMode
            ? `Biblioteca documental filtrada por jurisdicción ${jurisdictionLabel(selectedJurisdiction)}. Las plantillas alimentan documentos demo/operativos o sirven de referencia del proceso; no crean expedientes por sí solas.`
            : "Ciclo de vida: Borrador → Revisada → Aprobada → Vigente → Archivada"}
        </p>
        <div
          className="mt-3 inline-flex max-w-4xl items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--g-brand-3308)]" aria-hidden="true" />
          <span>
            Configuración de uso: cada plantilla vigente participa en la comprobación documental
            previa, resuelve variables automáticas y se vincula por materia, órgano, tipo social y
            forma de adopción.
          </span>
        </div>
      </div>

      {missingDeepLinkTarget ? (
        <div
          role="alert"
          className="mb-5 flex flex-col gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
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
            onClick={() => updateLibraryParams({ plantilla: null })}
            className="shrink-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Mostrar plantillas disponibles
          </button>
        </div>
      ) : null}

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
                <span>{jurisdictionLabel(selectedEntity.jurisdiction)}</span>
                <span aria-hidden="true">·</span>
                <span>{statusLabel(selectedEntity.status)}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
                El ámbito de sociedad se conserva para resolver variables, órgano competente y regla aplicable. La generación final queda separada en el carril documental; este módulo mantiene la traza societaria y la salida de validación.
              </p>
              <p className="mt-2 max-w-3xl text-sm font-medium text-[var(--g-text-primary)]">
                {healthMetrics.incidencias > 0
                  ? `Biblioteca operativa con advertencias: ${healthMetrics.vigentes} plantillas vigentes, ${healthMetrics.historico} archivadas y ${healthMetrics.incidencias} con revisión legal pendiente.`
                  : `Biblioteca operativa: ${healthMetrics.vigentes} plantillas vigentes y ${healthMetrics.historico} archivadas, sin revisión legal pendiente.`}
              </p>
            </div>

            <dl className="grid min-w-full grid-cols-1 gap-3 text-sm sm:min-w-[480px] sm:grid-cols-4 lg:min-w-[640px]">
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Vigentes
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{healthMetrics.vigentes}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <FileText className="h-3.5 w-3.5" />
                  Modelos vigentes
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{healthMetrics.modelos}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <Archive className="h-3.5 w-3.5" />
                  Histórico
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{healthMetrics.historico}</dd>
              </div>
              <div
                className="border-l border-[var(--g-border-subtle)] pl-3"
                title="Plantillas vigentes que requieren revisión legal: versión provisional, variantes por confirmar, metadatos, referencia o aprobación pendientes."
              >
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {/* Lote 2 coherencia (glosario): este KPI agrega revisión legal
                      pendiente (WARNING+ERROR), no "incidencias" en el sentido
                      del Gestor (solo ERROR). */}
                  Revisión legal pendiente
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{healthMetrics.incidencias}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {/* Tab bar */}
      <div
        className="mb-5 flex gap-1 border-b border-[var(--g-border-subtle)]"
        role="tablist"
        aria-label="Biblioteca de plantillas"
      >
        {(['proceso', 'modelos'] as const).map((tab) => (
          <button
            key={tab}
            ref={tab === "proceso" ? procesoTabRef : modelosTabRef}
            type="button"
            role="tab"
            id={`plantillas-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls="plantillas-panel"
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => activateLibraryTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, tab)}
            className={`min-h-11 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 ${
              activeTab === tab
                ? 'border-b-2 border-[var(--g-brand-3308)] text-[var(--g-brand-3308)]'
                : 'text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]'
            }`}
          >
            {tab === 'proceso' ? 'Plantillas de proceso' : 'Modelos de acuerdo'}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="plantillas-panel"
        aria-labelledby={`plantillas-tab-${activeTab}`}
      >
      {activeTab === 'proceso' && procesoCoverage.length > 0 && (
        <>
          <details
            className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 lg:hidden"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
              Cobertura de plantillas de proceso ({procesoCoverage.length} tipos)
            </summary>
            <div className="mt-3">
              <ProcessCoverageChips items={procesoCoverage} />
            </div>
          </details>
          <div className="mb-4 hidden lg:block">
            <ProcessCoverageChips items={procesoCoverage} />
          </div>
        </>
      )}

      {/* Segmentación por ciclo de vida (informe UX 2026-07-10): la vista por
          defecto muestra lo usable ahora; el histórico queda a un clic. */}
      <div
        className="mb-4 inline-flex flex-wrap gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-1"
        role="group"
        aria-label="Filtrar plantillas por ciclo de vida"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {CICLO_SEGMENTS.map((segment) => {
          const active = filterCiclo === segment.id;
          return (
            <button
              key={segment.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                // Reconciliar filtros dependientes del estado: cohorte y revisión
                // se definen sobre subconjuntos del ciclo (evita vacíos garantizados).
                setFilterCiclo(segment.id);
                setFilterCohorte("");
                setFilterRevision("");
                setSelected(null);
                updateLibraryParams({ ciclo: segment.id, plantilla: null });
              }}
              className={`min-h-11 px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 ${
                active
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-text-primary)]"
              }`}
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              {segment.label} ({cicloCounts[segment.id]})
            </button>
          );
        })}
      </div>

      {/* Incidencias de calidad documental sobre las vigentes (agrega detectores
          de legal-template-review; cada chip filtra la tabla). */}
      {INCIDENCIA_CHIPS.some((chip) => tabReviewSummary[chip.summaryKey] > 0) ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Revisión legal pendiente por tipo de hallazgo">
          <span className="text-xs font-medium text-[var(--g-text-secondary)]">Revisión legal pendiente:</span>
          {INCIDENCIA_CHIPS.filter((chip) => tabReviewSummary[chip.summaryKey] > 0).map((chip) => {
            const active = filterRevision === chip.filter;
            return (
              <button
                key={chip.filter}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFilterRevision(active ? "" : chip.filter);
                  if (!active) {
                    setFilterCiclo("vigentes");
                    setFilterCohorte("");
                  }
                  setSelected(null);
                  updateLibraryParams({
                    ciclo: active ? undefined : "vigentes",
                    plantilla: null,
                  });
                }}
                className={`inline-flex min-h-11 items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 ${
                  active
                    ? "border-[var(--status-warning)] bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-text-primary)]"
                    : "border-[var(--status-warning)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                <AlertTriangle className="h-3 w-3 text-[var(--status-warning)]" aria-hidden="true" />
                {chip.label} ({tabReviewSummary[chip.summaryKey]})
              </button>
            );
          })}
        </div>
      ) : null}

      {/* B11 Lote 4: en la pestaña proceso el ?materia= de los enlaces por fase
          de Materias y reglas no filtra (las plantillas de proceso no son
          materia-específicas) — se muestra como contexto explícito y
          descartable en vez de quedar como parámetro huérfano en la URL. */}
      {activeTab === 'proceso' && materiaFilterParam ? (
        <div
          className="mb-4 flex flex-wrap items-center gap-2 border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-3 py-2 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          <span>
            Contexto desde Materias y reglas:{' '}
            <span className="font-semibold">{materiaLabel(materiaFilterParam)}</span> · esta pestaña
            muestra todas las plantillas de proceso del tipo seleccionado.
          </span>
          <button
            type="button"
            onClick={() => updateLibraryParams({ materia: null })}
            className="font-semibold text-[var(--g-link)] underline-offset-2 hover:underline"
          >
            Quitar contexto
          </button>
        </div>
      ) : null}
      {/* Filtros: materia (solo Modelos) + cohorte (ambas pestañas, UX-7.B) */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        {activeTab === 'modelos' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor="plantillas-filter-materia" className="text-xs font-medium text-[var(--g-text-secondary)]">Materia</label>
            <select
              id="plantillas-filter-materia"
              aria-label="Filtrar modelos por materia"
              value={filterMateria}
              onChange={(e) => {
                const materia = resolveMateriaAlias(e.target.value);
                setFilterMateria(materia);
                setSelected(null);
                updateLibraryParams({ materia: materia || null, plantilla: null });
              }}
              className="min-h-11 min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              style={{ borderRadius: 'var(--g-radius-md)' }}
            >
              <option value="">Todas</option>
              {materiaOptionsByGroup.map(({ group, options }) => (
                <optgroup key={group.id} label={group.title}>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="plantillas-filter-calidad" className="text-xs font-medium text-[var(--g-text-secondary)]">Completitud de metadatos</label>
          <select
            id="plantillas-filter-calidad"
            aria-label="Filtrar por completitud de metadatos"
            value={filterCohorte}
            onChange={(e) => {
              setFilterCohorte(e.target.value);
              setSelected(null);
              updateLibraryParams({ plantilla: null });
            }}
            className="min-h-11 min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
            style={{ borderRadius: 'var(--g-radius-md)' }}
          >
            <option value="">Todas</option>
            {/* Solo cohortes compatibles con el segmento de ciclo activo (las demás
                serían intersección vacía por construcción). */}
            {COHORTE_ORDER.filter((c) =>
              filterCiclo === "todas"
                ? true
                : filterCiclo === "vigentes"
                  ? c.startsWith("ACTIVA")
                  : filterCiclo === "historico"
                    ? c === "HISTORICO"
                    : c === "EN_PREPARACION",
            ).map((c) => (
              <option key={c} value={c}>{cohorteLabel(c)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Master-Detail Grid */}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Tabla Master */}
        <div
          data-testid="plantillas-mobile-list"
          className="space-y-3 lg:hidden"
        >
          {isLoading ? (
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              Cargando plantillas...
            </div>
          ) : filteredData.length === 0 ? (
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <FolderOpen className="mx-auto mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
              <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                {activeTab === 'modelos' && filterMateria
                  ? `Sin modelos para la materia "${materiaLabel(filterMateria)}".`
                  : activeTab === 'modelos'
                  ? isSociedadMode
                    ? 'No hay modelos de acuerdo aplicables a esta sociedad.'
                    : 'No hay modelos de acuerdo disponibles.'
                  : isSociedadMode
                  ? 'Sin plantillas protegidas aplicables a esta sociedad.'
                  : 'Sin plantillas protegidas.'}
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    scope.createScopedTo(
                      buildTemplateGovernanceUrl({
                        // B12 Lote 4: la creación vive en el tab Importar
                        // (ADMIN_TENANT); para el resto el destino veraz es el
                        // catálogo gobernado de consulta.
                        tab: canManageLifecycle ? "importar" : "catalogo",
                        materia: filterMateria,
                        estado: filterCiclo === "vigentes" ? "ACTIVA" : "ALL",
                        scope: scope.mode,
                        entityId: scope.selectedEntity?.id,
                      }),
                    ),
                  )
                }
                className="mt-4 inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                style={{ borderRadius: 'var(--g-radius-md)' }}
              >
                <FileText className="h-4 w-4" />
                {canManageLifecycle ? "Crear nueva plantilla" : "Revisar en Gobierno de plantillas"}
              </button>
            </div>
          ) : (
            filteredData.map((plantilla) => (
              <button
                key={plantilla.id}
                type="button"
                onClick={() => selectLibraryTemplate(plantilla)}
                aria-pressed={selected?.id === plantilla.id}
                className={`block min-h-11 w-full border border-[var(--g-border-subtle)] px-4 py-4 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 ${
                  selected?.id === plantilla.id ? "bg-[var(--g-surface-subtle)]" : "bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? materiaLabel(plantilla.materia_acuerdo ?? plantilla.materia ?? plantilla.tipo)
                        : tipoLabel(plantilla.tipo)}
                    </h2>
                    <p className="mt-1 break-words text-xs text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos'
                        ? `${tipoLabel(plantilla.tipo)} · ${adoptionModeLabel(plantilla.adoption_mode, plantilla.tipo)}`
                        : materiaLabel(plantilla.materia_acuerdo ?? plantilla.materia)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`px-2 py-1 text-[11px] font-medium ${
                        SEMANTIC_TONE_CLASS[templateStateTone(plantilla.estado)]
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {estadoLabel(plantilla.estado)}
                    </span>
                    <CohorteBadge plantilla={plantilla} />
                    {plantilla.estado === "ACTIVA" && reviewByTemplateId.get(plantilla.id)?.flags.draftVersion ? (
                      <MadurezChip />
                    ) : null}
                  </div>
                </div>
                <dl
                  className={`mt-4 grid grid-cols-1 gap-3 text-sm ${
                    showTipoSocialColumn ? "sm:grid-cols-4" : "sm:grid-cols-3"
                  }`}
                >
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos' ? 'Órgano' : 'Jurisdicción'}
                    </dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? organoTipoLabel(plantilla.organo_tipo)
                        : jurisdictionLabel(plantilla.jurisdiccion)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Versión</dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">v{plantilla.version}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Acción</dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">
                      {templateAvailabilityPresentation(plantilla).label}
                    </dd>
                  </div>
                  {showTipoSocialColumn ? (
                    <div>
                      <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Tipo social</dt>
                      <dd className="mt-1 text-[var(--g-text-primary)]">
                        {tipoSocialLabel(plantilla.tipo_social)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </button>
            ))
          )}
        </div>

        <div
          data-testid="plantillas-desktop-table"
          className="hidden overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] lg:block"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  {activeTab === 'modelos' ? 'Materia' : 'Tipo'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  {activeTab === 'modelos' ? 'Uso' : 'Materia'}
                </th>
                {/* En Modelos, el órgano y la adopción son lo que distingue variantes
                    jurídicas (junta vs consejo); la jurisdicción sigue en el detalle. */}
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  {activeTab === 'modelos' ? 'Órgano' : 'Jurisdicción'}
                </th>
                {activeTab === 'modelos' ? (
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                    Adopción
                  </th>
                ) : null}
                {showTipoSocialColumn ? (
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                    Tipo social
                  </th>
                ) : null}
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Versión
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Estado
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={(activeTab === 'modelos' ? 7 : 6) + (showTipoSocialColumn ? 1 : 0)} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    Cargando…
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={(activeTab === 'modelos' ? 7 : 6) + (showTipoSocialColumn ? 1 : 0)}>
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <FolderOpen className="mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
                      <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                        {activeTab === 'modelos' && filterMateria
                          ? `Sin modelos para la materia "${materiaLabel(filterMateria)}".`
                          : activeTab === 'modelos'
                          ? isSociedadMode
                            ? 'No hay modelos de acuerdo aplicables a esta sociedad.'
                            : 'No hay modelos de acuerdo disponibles.'
                          : isSociedadMode
                          ? 'Sin plantillas protegidas aplicables a esta sociedad.'
                          : 'Sin plantillas protegidas.'}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            scope.createScopedTo(
                              buildTemplateGovernanceUrl({
                                tab: canManageLifecycle ? "importar" : "catalogo",
                                materia: filterMateria,
                                estado: filterCiclo === "vigentes" ? "ACTIVA" : "ALL",
                                scope: scope.mode,
                                entityId: scope.selectedEntity?.id,
                              }),
                            ),
                          )
                        }
                        className="mt-4 inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                        style={{ borderRadius: 'var(--g-radius-md)' }}
                      >
                        <FileText className="h-4 w-4" />
                        {canManageLifecycle ? "Crear nueva plantilla" : "Revisar en Gobierno de plantillas"}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((plantilla) => (
                  <tr
                    key={plantilla.id}
                    onClick={() => selectLibraryTemplate(plantilla)}
                    className={`cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                      selected?.id === plantilla.id ? "bg-[var(--g-surface-subtle)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? materiaLabel(plantilla.materia_acuerdo ?? plantilla.materia ?? plantilla.tipo)
                        : tipoLabel(plantilla.tipo)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos'
                        ? templateAvailabilityPresentation(plantilla).label
                        : materiaLabel(plantilla.materia)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {/* En modelos, NULL = metadato no informado (mismo criterio que la
                          incidencia "Sin órgano o adopción"); "Cualquier órgano" queda
                          reservado al valor explícito ANY. */}
                      {activeTab === 'modelos'
                        ? organoTipoLabel(plantilla.organo_tipo)
                        : jurisdictionLabel(plantilla.jurisdiccion)}
                    </td>
                    {activeTab === 'modelos' ? (
                      <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                        {adoptionModeLabel(plantilla.adoption_mode, plantilla.tipo)}
                      </td>
                    ) : null}
                    {showTipoSocialColumn ? (
                      <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                        {tipoSocialLabel(plantilla.tipo_social)}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {plantilla.version}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-medium ${
                            SEMANTIC_TONE_CLASS[templateStateTone(plantilla.estado)]
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {estadoLabel(plantilla.estado)}
                        </span>
                        <CohorteBadge plantilla={plantilla} />
                        {plantilla.estado === "ACTIVA" && reviewByTemplateId.get(plantilla.id)?.flags.draftVersion ? (
                          <MadurezChip />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectLibraryTemplate(plantilla);
                        }}
                        aria-label={`Ver detalles de ${tipoLabel(plantilla.tipo)}`}
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div
          ref={detailRef}
          role="complementary"
          aria-label="Detalle de la plantilla seleccionada"
          tabIndex={-1}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          {selected ? (
            <div className="flex h-full flex-col">
              {/* Detail Header */}
              <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Detalles</h2>
              </div>

              {/* Detail Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Tipo */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Tipo</div>
                  <div className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {tipoLabel(selected.tipo)}
                  </div>
                </div>

                {/* Disponibilidad — distingue ciclo técnico de uso jurídico. */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Disponibilidad
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {selectedAvailability?.label}
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--g-text-secondary)]">
                    {selectedAvailability?.description}
                  </p>
                </div>

                {/* Materia / materia_acuerdo */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Materia</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {materiaLabel(selected.materia_acuerdo ?? selected.materia)}
                  </div>
                </div>

                {/* Jurisdicción */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Jurisdicción</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {jurisdictionLabel(selected.jurisdiccion)}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Tipo social
                  </div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {tipoSocialLabel(selected.tipo_social)}
                  </div>
                </div>

                {isSociedadMode && selectedEntity && (
                  <div
                    className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Aplicación
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {templateAppliesToJurisdiction(selected, selectedEntity.jurisdiction)
                        ? `Disponible para ${selectedEntity.legalName}`
                        : "No aplica a la jurisdicción seleccionada"}
                    </div>
                  </div>
                )}

                {/* Versión */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Versión</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    v{selected.version}
                  </div>
                </div>

                {/* Estado */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Estado</div>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium ${
                        SEMANTIC_TONE_CLASS[templateStateTone(selected.estado)]
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {estadoLabel(selected.estado)}
                    </span>
                  </div>
                </div>

                <div
                  className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Configuración de uso
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--g-text-secondary)]">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Vinculación</dt>
                      <dd className="text-right">
                        {materiaLabel(selected.materia_acuerdo ?? selected.materia)} · {organoTipoLabel(selected.organo_tipo)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Adopción</dt>
                      <dd className="text-right">{adoptionModeLabel(selected.adoption_mode, selected.tipo)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Tipo social</dt>
                      <dd className="text-right">{tipoSocialLabel(selected.tipo_social)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Comprobación documental previa</dt>
                      <dd className="text-right">
                        {selected.snapshot_rule_pack_required
                          ? "Exige fijar la versión de la regla aplicable"
                          : "No exige fijar una versión de la regla"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Contrato variables</dt>
                      <dd className="text-right">
                        {selected.contrato_variables_version ?? "No informado"}
                      </dd>
                    </div>
                  </dl>
                  {selected.estado === "ACTIVA" && !(selected.materia_acuerdo ?? selected.materia) ? (
                    <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
                      Esta plantilla existe, pero no está vinculada a una regla aplicable.
                    </p>
                  ) : null}
                  {selected.estado === "ACTIVA" && !selected.contrato_variables_version ? (
                    <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
                      Esta plantilla está vigente, pero faltan metadatos de gobierno documental. Revisa
                      versión, vinculación, jurisdicción y cobertura antes de usarla como requisito bloqueante.
                    </p>
                  ) : null}
                  {selected.estado === "ACTIVA" && reviewByTemplateId.get(selected.id)?.flags.draftVersion ? (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-[var(--g-text-secondary)]">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
                      <span>
                        <strong className="text-[var(--g-text-primary)]">Vigente con advertencia de madurez:</strong>{" "}
                        la versión v{selected.version} es técnica o preliminar. Revísala con el Comité
                        Legal antes de usarla en expedientes sensibles.
                      </span>
                    </p>
                  ) : null}
                </div>

                {replacementForSelected ? (
                  <div
                    className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Sustituida para nuevos expedientes
                    </div>
                    <p className="mt-1 text-sm text-[var(--g-text-primary)]">
                      La versión vigente de esta pieza documental es v{replacementForSelected.version}.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        ref={comparisonTriggerRef}
                        type="button"
                        onClick={openVersionComparison}
                        className="inline-flex min-h-11 items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                        Comparar con vigente
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterCiclo("vigentes");
                          setFilterRevision("");
                          setFilterCohorte("");
                          selectLibraryTemplate(replacementForSelected, { focusDetail: true });
                        }}
                        className="inline-flex min-h-11 items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        Ver versión vigente <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : cicloOf(selected.estado) === "historico" ? (
                  <div
                    className="mb-4 border border-[var(--status-info)] bg-[var(--g-surface-card)] px-3 py-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Sin versión vigente comparable
                    </div>
                    <p className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {replacementIsAmbiguous
                        ? "Hay más de una candidata con la misma identidad documental. No se selecciona una sustituta automáticamente."
                        : "No existe una plantilla vigente con la misma identidad documental. Puede haber cambiado el tipo, la materia, el órgano o la forma de adopción."}
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                      Consulta Gobierno de plantillas para investigar el linaje sin inferirlo desde notas de texto libre.
                    </p>
                  </div>
                ) : null}

                {/* Referencia Legal */}
                {selected.referencia_legal && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Referencia Legal
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {selected.referencia_legal}
                    </div>
                  </div>
                )}

                {/* Capa 1 Inmutable */}
                {selected.capa1_inmutable && (
                  <details open className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-medium text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
                      Texto literal protegido · Capa 1 completa
                    </summary>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                      <span className="font-medium text-[var(--g-text-primary)]">Contenido canónico inmutable</span>
                      <span aria-hidden="true">·</span>
                      <span>{selected.capa1_inmutable.length.toLocaleString("es-ES")} caracteres</span>
                    </div>
                    <pre
                      className="mt-2 max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words bg-[var(--g-surface-subtle)] p-3 font-mono text-[11px] leading-relaxed text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {selected.capa1_inmutable}
                    </pre>
                    <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                      Este es el texto base de la generación documental; las variables se resuelven en Capa 2 y los campos editables se capturan en Capa 3.
                    </p>
                  </details>
                )}

                {/* Capa 2 Variables */}
                {selectedVariables.length > 0 && (
                  <details className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-medium text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
                      Variables automáticas
                    </summary>
                    <div className="mt-2 text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Detalle técnico · Capa 2
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selectedVariables.map((variable, i) => (
                        <div
                          key={i}
                          className="bg-[var(--g-surface-subtle)] px-2 py-1"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <span className="font-mono font-medium">{variable.name}</span>
                          {" — "}
                          <span className="text-[10px]">{variable.source || "Fuente no informada"}</span>
                          {variable.display ? (
                            <span className="ml-2 text-[10px]">{variable.display}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Capa 3 Editables (Modelos de acuerdo) */}
                {selectedEditableFields.length > 0 && (
                  <details className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-medium text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
                      Campos para completar
                    </summary>
                    <div className="mt-2 text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Detalle técnico · Capa 3
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selectedEditableFields.map((field, i) => (
                        <div
                          key={i}
                          className="bg-[var(--g-surface-muted)] px-2 py-1"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <span className="font-mono font-medium">{field.name}</span>
                          {field.required && (
                            <span className="ml-2 font-semibold text-[var(--g-text-primary)]">*</span>
                          )}
                          {field.description && (
                            <span className="ml-2 text-[10px] text-[var(--g-text-secondary)]">{field.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Aprobación */}
                {selected.aprobada_por && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Aprobada por
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {selected.aprobada_por}
                    </div>
                  </div>
                )}

                {selected.fecha_aprobacion && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Fecha aprobación
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {new Date(selected.fecha_aprobacion).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                )}

                {/* Checklist de aprobación */}
                {selectedChecklist.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Checklist de aprobación</div>
                    <div className="mt-2 space-y-1">
                      {selectedChecklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {item.passed ? <CheckCircle className="h-3.5 w-3.5 text-[var(--status-success)]" /> : <AlertCircle className="h-3.5 w-3.5 text-[var(--status-error)]" />}
                          <span className="text-[var(--g-text-primary)]">{item.check}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial de estado */}
                {selected.version_history && selected.version_history.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Historial de estado</div>
                    <div className="mt-2 space-y-1">
                      {selected.version_history.map((h, i) => (
                        <div key={i} className="text-xs text-[var(--g-text-secondary)]">
                          <span className="font-medium text-[var(--g-text-primary)]">
                            {estadoLabel(h.from)} → {estadoLabel(h.to)}
                          </span>
                          {" · "}{new Date(h.at).toLocaleDateString("es-ES")}
                          {h.by && h.by !== "system" && ` · ${h.by}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creación */}
                <div className="mb-4 border-t border-[var(--g-border-subtle)] pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Creada
                  </div>
                  <div className="mt-1 text-sm text-[var(--g-text-secondary)]">
                    {new Date(selected.created_at).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>

              {/* Detail Footer - Action Buttons */}
              <div className="border-t border-[var(--g-border-subtle)] px-5 py-4 flex flex-col gap-2">
                {selectedMatterCodes.map((materia) => (
                  <button
                    key={materia}
                    type="button"
                    onClick={() => openMatter(materia)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-primary)] transition-all hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Ver materia y regla: {materiaLabel(materia)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={openTemplateGovernance}
                  className="flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-primary)] transition-all hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  Administrar esta plantilla
                </button>
                {selectedAvailability?.canUse && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = getTemplateUsageTarget(selected).to;
                      navigate(
                        applyTemplateRouteScope(target, scope.mode, scope.selectedEntity?.id),
                      );
                    }}
                    className={`flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 ${
                      selectedAvailability.isCurrent
                        ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                        : "border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {getTemplateUsageTarget(selected).label}
                    {!selectedAvailability.isCurrent ? " · versión de preparación" : ""}
                  </button>
                )}
                {selected.estado === "ACTIVA" && isSociedadMode && selectedEntity ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAssignBinding(selected, selectedBindingMateria)}
                      disabled={
                        assignTemplate.isPending ||
                        selectedIsAlreadyBound ||
                        !selectedBindingMateria ||
                        hasAmbiguousBindingContext
                      }
                      aria-busy={assignTemplate.isPending}
                      className="flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-primary)] transition-all hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {hasAmbiguousBindingContext
                        ? `Ya vinculada a ${selectedEffectiveBindingMatterCodes.length} reglas`
                        : selectedIsAlreadyBound
                          ? "Ya vinculada a esta regla"
                          : selectedBindingMateria
                            ? "Vincular como plantilla vigente"
                            : "Selecciona una regla en Materias"}
                    </button>
                    {hasAmbiguousBindingContext ? (
                      <p className="text-xs text-[var(--g-text-secondary)]">
                        Abre una materia concreta para revisar o modificar su asignación; no se creará una vinculación genérica ni compuesta.
                      </p>
                    ) : !selectedBindingMateria ? (
                      <p className="text-xs text-[var(--g-text-secondary)]">
                        La plantilla no identifica una materia canónica inequívoca. Selecciónala desde Materias y reglas o desde Gobierno de plantillas.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {selectedAvailability?.canUse ? (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    {getTemplateUsageTarget(selected).hint}{" "}
                    {!selectedAvailability.isCurrent
                      ? "Esta versión es utilizable por la política transitoria, pero todavía no está vigente para nuevos expedientes."
                      : ""}
                  </p>
                ) : null}
                {templateUsabilityNotice(selected) ? (
                  <div
                    className="flex items-start gap-2 border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-3 text-xs text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
                    <span>{templateUsabilityNotice(selected)}</span>
                  </div>
                ) : null}
                {/* ITEM-084: la gestión de ciclo de vida (revisar/aprobar/activar/
                    archivar) solo se ofrece a ADMIN_TENANT, coherente con el gestor
                    (CatalogoTab gatea con canAccess('validacion')). El catálogo
                    /secretaria/plantillas es de USO para el SECRETARIO; sin este
                    guard, el demo (SECRETARIO) podía archivar una plantilla ACTIVA
                    de producción con un clic (la RLS solo aísla por tenant). */}
                {canManageLifecycle && WORKFLOW_TRANSITIONS[selected.estado] && (
                  (() => {
                    const transition = WORKFLOW_TRANSITIONS[selected.estado];
                    const IconComponent = transition.icon;
                    return (
                      <button
                        type="button"
                        onClick={() => handleTransicion(selected)}
                        disabled={updateEstado.isPending}
                        aria-busy={updateEstado.isPending}
                        className="flex min-h-11 w-full items-center justify-center gap-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-primary)] transition-all hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 disabled:opacity-60"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <IconComponent className="h-4 w-4" />
                        {updateEstado.isPending ? "Procesando…" : transition.label}
                      </button>
                    );
                  })()
                )}
                {/* ITEM-087: panel accionable con los issues bloqueantes del Gate
                    PRE, que antes solo eran visibles re-ejecutando manualmente el
                    tab Validación del gestor. */}
                {blockingIssues.length > 0 ? (
                  <div
                    className="border border-[var(--status-error)] bg-[var(--status-error)]/5 p-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--g-text-primary)]">
                      <Shield className="h-3.5 w-3.5 text-[var(--status-error)]" aria-hidden="true" />
                      La comprobación documental bloqueó la activación
                    </div>
                    <GatePreIssueList issues={blockingIssues} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-5">
              <div className="text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-[var(--g-text-secondary)] opacity-50" />
                <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                  Selecciona una plantilla para ver detalles y gestionar su ciclo de vida.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {comparisonOpen && selected && replacementForSelected && versionComparison ? (
        <section
          ref={comparisonRef}
          role="region"
          aria-label="Comparación de versiones"
          tabIndex={-1}
          className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex flex-col gap-4 border-b border-[var(--g-border-subtle)] p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                <GitCompare className="h-4 w-4" aria-hidden="true" />
                Comparación de versiones
              </div>
              <h2 className="mt-1 text-xl font-semibold text-[var(--g-text-primary)]">
                Histórica v{selected.version} ↔ Vigente v{replacementForSelected.version}
              </h2>
              <p className="mt-1 max-w-4xl text-sm text-[var(--g-text-secondary)]">
                Comparación segura entre dos versiones con la misma identidad documental. Las notas de texto libre no se usan para inferir el linaje.
              </p>
            </div>
            <button
              type="button"
              onClick={closeVersionComparison}
              aria-label="Cerrar comparación de versiones"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">Secciones modificadas</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{versionComparison.summary.changedSections}</dd>
              </div>
              <div className="border border-[var(--status-success)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">Líneas añadidas</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{versionComparison.summary.addedLines}</dd>
              </div>
              <div className="border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">Líneas retiradas</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{versionComparison.summary.removedLines}</dd>
              </div>
            </dl>

            <div>
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Resumen del cambio</h3>
              {versionComparison.identical ? (
                <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                  No hay cambios de contenido o metadatos entre estas dos versiones.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Secciones modificadas">
                  {versionComparison.summary.labels.map((label) => (
                    <li
                      key={label}
                      className="border border-[var(--status-info)] bg-[var(--g-surface-card)] px-2.5 py-1 text-xs text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Cambios en el texto literal protegido</h3>
              <div
                role="region"
                tabIndex={0}
                className="mt-2 max-h-[520px] overflow-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-label="Diferencias línea a línea del texto protegido"
              >
                {versionComparison.lineDiff.map((line, index) => (
                  <div
                    key={`${line.kind}-${line.oldLine ?? "n"}-${line.newLine ?? "n"}-${index}`}
                    className={`grid grid-cols-[44px_20px_minmax(0,1fr)] gap-2 border-b border-[var(--g-border-subtle)]/60 px-2 py-1.5 last:border-b-0 ${
                      line.kind === "added"
                        ? "bg-[var(--status-success)]/10 text-[var(--g-text-primary)]"
                        : line.kind === "removed"
                          ? "bg-[var(--status-error)]/10 text-[var(--g-text-primary)]"
                          : "text-[var(--g-text-secondary)]"
                    }`}
                  >
                    <span className="text-right text-[10px] text-[var(--g-text-secondary)]">
                      {line.kind === "added" ? line.newLine : line.oldLine}
                    </span>
                    <span aria-hidden="true">
                      {line.kind === "added" ? (
                        <Plus className="h-3.5 w-3.5 text-[var(--status-success)]" />
                      ) : line.kind === "removed" ? (
                        <Minus className="h-3.5 w-3.5 text-[var(--status-error)]" />
                      ) : null}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      <span className="sr-only">
                        {line.kind === "added"
                          ? "Línea añadida: "
                          : line.kind === "removed"
                            ? "Línea retirada: "
                            : "Línea sin cambios: "}
                      </span>
                      {line.text || " "}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Detalle por sección</h3>
              {versionComparison.sections.map((section) => (
                <details
                  key={section.key}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <summary className="flex min-h-11 cursor-pointer items-center py-2 text-sm font-medium text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
                    {section.label} · {section.changed ? "Modificada" : "Sin cambios"}
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                        Histórica · v{selected.version}
                      </div>
                      <pre
                        className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                        role="region"
                        aria-label={`${section.label}, versión histórica ${selected.version}`}
                        tabIndex={0}
                      >
                        {section.before.length > 0 ? section.before.join("\n") : "No informado"}
                      </pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                        Vigente · v{replacementForSelected.version}
                      </div>
                      <pre
                        className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                        role="region"
                        aria-label={`${section.label}, versión vigente ${replacementForSelected.version}`}
                        tabIndex={0}
                      >
                        {section.after.length > 0 ? section.after.join("\n") : "No informado"}
                      </pre>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      </div>

      {/* ITEM-087: diálogo de reconocimiento de warnings. Reintenta la transición
          con ackWarnings:true y el motivo escrito (persistido en changelog). */}
      {ackIssues && pendingTransition ? (
        <TransitionAckDialog
          issues={ackIssues}
          pending={updateEstado.isPending}
          onConfirm={(motivo) =>
            runTransicion(pendingTransition, {
              ...pendingTransitionOptions,
              motivo,
              ackWarnings: true,
              confirmed: true,
            })
          }
          onCancel={() => {
            setAckIssues(null);
            setPendingTransition(null);
            setPendingTransitionOptions({});
          }}
        />
      ) : null}
      {approvalTarget ? (
        <TemplateApprovalDialog
          pending={updateEstado.isPending}
          onConfirm={({ aprobadaPor, fechaAprobacion }) =>
            runTransicion(approvalTarget, {
              aprobadaPor,
              fechaAprobacion,
              confirmed: true,
            })
          }
          onCancel={() => setApprovalTarget(null)}
        />
      ) : null}
    </div>
  );
}
