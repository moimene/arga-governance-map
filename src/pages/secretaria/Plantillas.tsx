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
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAssignTemplateBinding } from "@/hooks/useNormativeGovernance";
import {
  usePlantillasProtegidas,
  useUpdateEstadoPlantilla,
  extractTransitionResult,
  PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  FUNCTIONAL_MATTER_GROUPS,
  MATTER_GROUP_BY_MATERIA,
  compareTemplateVersions,
  normativeRoleFromAppRole,
  organoTipoBusinessLabel,
} from "@/lib/secretaria/mesa-control-societaria";
import {
  buildLegalTemplateReviewRows,
  matchesLegalTemplateReviewFilter,
  summarizeLegalTemplateReview,
  type LegalTemplateReviewFilter,
} from "@/lib/secretaria/legal-template-review";
import { templateSelectionReason } from "@/lib/secretaria/normative-governance";
import { getTemplateUsageTarget } from "@/lib/secretaria/template-routing";
import { isOperationalTemplate, templateUsabilityNotice } from "@/lib/doc-gen/template-operability";
import {
  // ITEM-138: labels y transiciones canónicas compartidas (antes copiadas con
  // divergencias en esta página, CatalogoTab y CoberturaLegalTab).
  TEMPLATE_PRIMARY_TRANSITIONS,
  tipoLabel,
  estadoLabel,
  jurisdictionLabel,
  // UX-7.B: modelo de cohortes de plantilla (clasificación pura + filtro).
  clasificarCohortePlantilla,
  cohorteLabel,
  cohorteDescripcion,
  COHORTE_ORDER,
} from "@/lib/secretaria/template-admin";
import { CohorteBadge } from "@/components/secretaria/CohorteBadge";
import { toast } from "sonner";

// ITEM-138 (d): badge de estado con DEPRECADA (antes omitido). Los colores son
// presentación local; las ETIQUETAS vienen del módulo canónico labels.ts.
const ESTADO_BADGE = {
  BORRADOR: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  REVISADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  APROBADA: "bg-[var(--g-sec-300)] text-[var(--g-brand-3308)]",
  ACTIVA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  ARCHIVADA: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  DEPRECADA: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

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
  'APROBACION_PRESUPUESTOS',
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
  const value = (estado ?? "").trim().toUpperCase();
  if (value === "ACTIVA") return "vigentes";
  if (value === "ARCHIVADA" || value === "DEPRECADA") return "historico";
  return "preparacion";
}

// Identidad funcional para localizar la versión vigente que sustituye a una
// histórica (misma pieza: tipo + materia efectiva + órgano + adopción + jurisdicción).
function templateIdentityKey(t: PlantillaProtegidaRow) {
  return [t.tipo, t.materia_acuerdo ?? t.materia ?? "", t.organo_tipo ?? "", t.adoption_mode ?? "", t.jurisdiccion ?? ""].join("|");
}

const INCIDENCIA_CHIPS: Array<{ filter: LegalTemplateReviewFilter; label: string; summaryKey: "draftVersion" | "duplicateMatter" | "missingOwner" | "missingReference" }> = [
  { filter: "DRAFT_VERSION", label: "Versión provisional", summaryKey: "draftVersion" },
  { filter: "DUPLICATE_MATTER", label: "Variantes por confirmar", summaryKey: "duplicateMatter" },
  { filter: "MISSING_OWNER", label: "Sin órgano o adopción", summaryKey: "missingOwner" },
  { filter: "MISSING_REFERENCE", label: "Sin referencia legal", summaryKey: "missingReference" },
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
  return value ? value.replace(/_/g, " ") : "—";
}

function adoptionModeLabel(value?: string | null) {
  if (!value) return "Cualquier forma de adopción";
  const labels: Record<string, string> = {
    MEETING: "Sesión formal",
    UNIVERSAL: "Junta universal",
    NO_SESSION: "Acuerdo sin sesión",
    UNIPERSONAL_SOCIO: "Decisión de socio único",
    UNIPERSONAL_ADMIN: "Decisión de administrador único",
    CO_APROBACION: "Decisión mancomunada",
    SOLIDARIO: "Administrador solidario",
    ANY: "Cualquier forma de adopción",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

// Etiqueta de negocio de órgano compartida con el catálogo de materias
// (cubre CONSEJO_ADMIN, SOCIO_UNICO, ADMIN_UNICO, COMISION_DELEGADA, etc.).
function organoTipoLabel(value?: string | null) {
  return organoTipoBusinessLabel(value);
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

// ITEM-087: lista accionable de issues del Gate PRE (código + mensaje + hint),
// con el mismo lenguaje visual que el preflight del TemplateImportWizard.
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
// imposible de completar desde el catálogo de uso.
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
            aria-describedby="ack-plantillas-help"
            aria-invalid={motivo.length > 0 && tooShort ? "true" : undefined}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          <p id="ack-plantillas-help" className="mt-1 text-xs text-[var(--g-text-secondary)]">
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

export default function Plantillas() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const { data, isLoading } = usePlantillasProtegidas();
  const updateEstado = useUpdateEstadoPlantilla();
  const assignTemplate = useAssignTemplateBinding();
  const { primaryRole } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);
  // ITEM-084: solo ADMIN_TENANT gestiona el ciclo de vida de plantillas desde el
  // catálogo de uso (paridad con el guard del gestor).
  const canManageLifecycle = primaryRole === "ADMIN_TENANT";
  const [selected, setSelected] = useState<PlantillaProtegidaRow | null>(null);
  // ITEM-087: estado para superficie de errores accionables de transición.
  const [blockingIssues, setBlockingIssues] = useState<GatePreIssue[]>([]);
  const [ackIssues, setAckIssues] = useState<GatePreIssue[] | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PlantillaProtegidaRow | null>(null);
  const initialMateriaFilter = searchParams.get("materia") ?? "";
  const initialTipoFilter = searchParams.get("tipo") ?? "";
  const materiaFilterParam = searchParams.get("materia") ?? "";
  const [activeTab, setActiveTab] = useState<'proceso' | 'modelos'>(() =>
    initialMateriaFilter || initialTipoFilter.toUpperCase().includes("MODELO") ? "modelos" : "proceso",
  );
  const [filterMateria, setFilterMateria] = useState<string>(initialMateriaFilter);
  // UX-7.B: filtro por cohorte de plantilla (aplica a ambas pestañas).
  const [filterCohorte, setFilterCohorte] = useState<string>("");
  // Informe UX Plantillas: segmento de ciclo (default = qué puedo usar ahora).
  const [filterCiclo, setFilterCiclo] = useState<CicloSegment>("vigentes");
  // Filtro de incidencias de calidad documental (reutiliza legal-template-review).
  const [filterRevision, setFilterRevision] = useState<LegalTemplateReviewFilter | "">("");
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const selectedJurisdiction = selectedEntity?.jurisdiction ?? null;

  const scopedData = useMemo(() => {
    const rows = data ?? [];
    if (!isSociedadMode) return rows;
    return rows.filter((plantilla) => templateAppliesToJurisdiction(plantilla, selectedJurisdiction));
  }, [data, isSociedadMode, selectedJurisdiction]);

  // Salud documental (informe UX Plantillas): agrega los detectores existentes
  // de legal-template-review sobre las VIGENTES — no crea un sistema nuevo.
  const vigentesData = useMemo(() => scopedData.filter((p) => cicloOf(p.estado) === "vigentes"), [scopedData]);
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
    motivo?: string,
    ackWarnings?: boolean,
  ) => {
    const transition = WORKFLOW_TRANSITIONS[plantilla.estado];
    if (!transition) return;
    // ITEM-084: confirmación explícita antes de mutar el ciclo de vida (paridad
    // con el window.confirm del gestor; evita archivar/activar de un solo clic).
    if (
      !window.confirm(
        `¿Confirmar la transición de la plantilla a "${estadoLabel(transition.nextState)}"? Esta acción queda registrada en la auditoría.`,
      )
    ) {
      return;
    }

    updateEstado.mutate(
      { id: plantilla.id, nuevo_estado: transition.nextState, motivo, ackWarnings },
      {
        onSuccess: () => {
          setBlockingIssues([]);
          setAckIssues(null);
          setPendingTransition(null);
          toast.success(`Plantilla transicionada a ${estadoLabel(transition.nextState)}`);
          setSelected(null);
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
            toast.error(
              `El Gate PRE bloqueó la activación con ${result.issues.length} incidencia(s). Revisa el detalle.`,
            );
          } else if (result && result.ok === false && result.reason === "WARNINGS_NEED_ACK") {
            setBlockingIssues([]);
            setAckIssues(result.issues);
            setPendingTransition(plantilla);
          } else if (result && result.ok === false && result.reason === "INVALID_TRANSITION") {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            toast.error(`Transición no permitida: ${result.from} → ${result.to}.`);
          } else if (result && result.ok === false && result.reason === "MISSING_APPROVAL_DATA") {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
            toast.error(
              "Faltan datos de aprobación (aprobada_por/fecha) para activar la plantilla.",
            );
          } else {
            setBlockingIssues([]);
            setAckIssues(null);
            setPendingTransition(null);
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
    runTransicion(plantilla);
  };

  const handleAssignBinding = (plantilla: PlantillaProtegidaRow) => {
    const materia = plantilla.materia_acuerdo ?? plantilla.materia ?? filterMateria;
    if (!materia) {
      toast.error("No se puede vincular una plantilla sin materia.");
      return;
    }
    assignTemplate.mutate(
      {
        materia,
        organoTipo: plantilla.organo_tipo ?? "ANY",
        tipoSocial: selectedEntity?.legalForm ?? "ANY",
        jurisdiccion: selectedEntity?.jurisdiction ?? plantilla.jurisdiccion ?? "ES",
        adoptionMode: plantilla.adoption_mode ?? "ANY",
        docType: plantilla.tipo,
        templateId: plantilla.id,
        priority: 100,
        selectionReason: templateSelectionReason({
          materia,
          docType: plantilla.tipo,
          jurisdiction: selectedEntity?.jurisdiction ?? plantilla.jurisdiccion,
          tipoSocial: selectedEntity?.legalForm,
          organoTipo: plantilla.organo_tipo,
          adoptionMode: plantilla.adoption_mode,
        }),
        userRole: normativeRole,
      },
      {
        onSuccess: () => toast.success("Plantilla vinculada a la regla efectiva."),
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
    const materias = new Set<string>(MATERIAS_ACUERDO);
    for (const plantilla of modelosDatos) {
      const materia = plantilla.materia_acuerdo ?? plantilla.materia;
      if (materia) materias.add(materia);
    }

    return FUNCTIONAL_MATTER_GROUPS.map((group) => {
      const options = [...materias]
        .filter((materia) => matterGroup(materia).id === group.id)
        .sort((a, b) => materiaLabel(a).localeCompare(materiaLabel(b), "es"))
        .map((materia) => ({ value: materia, label: materiaLabel(materia) }));

      return { group, options };
    }).filter((entry) => entry.options.length > 0);
  }, [modelosDatos]);
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
        ? displayData.filter((p) => (p.materia_acuerdo ?? p.materia) === filterMateria)
        : displayData;
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
    [activeTab, displayData, filterMateria, filterCiclo, filterRevision, tabReviewById, filterCohorte],
  );

  // Sustitución de una histórica: versión vigente de la misma pieza documental.
  const replacementForSelected = useMemo(() => {
    if (!selected || cicloOf(selected.estado) !== "historico") return null;
    const identity = templateIdentityKey(selected);
    const candidates = scopedData.filter(
      (p) => cicloOf(p.estado) === "vigentes" && templateIdentityKey(p) === identity,
    );
    return (
      [...candidates].sort((a, b) => compareTemplateVersions(b.version, a.version))[0] ?? null
    );
  }, [scopedData, selected]);

  useEffect(() => {
    const materia = materiaFilterParam;
    if (!materia) return;
    setActiveTab("modelos");
    setFilterMateria(materia);
    setSelected(null);
  }, [materiaFilterParam]);

  useEffect(() => {
    setSelected((current) => {
      if (current && filteredData.some((plantilla) => plantilla.id === current.id)) return current;
      return filteredData[0] ?? null;
    });
  }, [filteredData]);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Encabezado */}
      <div className="mb-6">
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
            : "Ciclo de vida: Borrador → Revisada → Aprobada → Activa → Archivada"}
        </p>
        <div
          className="mt-3 inline-flex max-w-4xl items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--g-brand-3308)]" aria-hidden="true" />
          <span>
            Configuración del motor: cada plantilla activa alimenta Gate PRE, variables automáticas,
            campos editables y bindings materia × órgano × tipo social × forma de adopción.
          </span>
        </div>
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
                <span>{jurisdictionLabel(selectedEntity.jurisdiction)}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity.status}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
                El ámbito de sociedad se conserva para resolver variables, órgano competente y rule pack aplicable. La generación final queda separada en el carril documental; este módulo mantiene la traza societaria y la salida demo/operativa.
              </p>
              <p className="mt-2 max-w-3xl text-sm font-medium text-[var(--g-text-primary)]">
                {healthMetrics.incidencias > 0
                  ? `Biblioteca operativa con advertencias: ${healthMetrics.vigentes} plantillas vigentes, ${healthMetrics.historico} archivadas y ${healthMetrics.incidencias} con incidencias de calidad documental.`
                  : `Biblioteca operativa: ${healthMetrics.vigentes} plantillas vigentes y ${healthMetrics.historico} archivadas, sin incidencias de calidad documental.`}
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
                  Incidencias
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{healthMetrics.incidencias}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-[var(--g-border-subtle)]">
        {(['proceso', 'modelos'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setSelected(null); setFilterMateria(''); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[var(--g-brand-3308)] text-[var(--g-brand-3308)]'
                : 'text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]'
            }`}
          >
            {tab === 'proceso' ? 'Plantillas de proceso' : 'Modelos de acuerdo'}
          </button>
        ))}
      </div>

      {activeTab === 'proceso' && procesoCoverage.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {procesoCoverage.map((item) => (
            <span
              key={item.tipo}
              className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1 text-xs text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              <span className="font-medium text-[var(--g-text-primary)]">{item.label}</span>
              <span>{item.activas}/{item.total} activas</span>
            </span>
          ))}
        </div>
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
              }}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] ${
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
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Incidencias de calidad documental">
          <span className="text-xs font-medium text-[var(--g-text-secondary)]">Incidencias:</span>
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
                }}
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] ${
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

      {/* Filtros: materia (solo Modelos) + cohorte (ambas pestañas, UX-7.B) */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        {activeTab === 'modelos' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-xs font-medium text-[var(--g-text-secondary)]">Materia</label>
            <select
              aria-label="Filtrar modelos por materia"
              value={filterMateria}
              onChange={(e) => setFilterMateria(e.target.value)}
              className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
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
          <label className="text-xs font-medium text-[var(--g-text-secondary)]">Cohorte</label>
          <select
            aria-label="Filtrar plantillas por cohorte"
            value={filterCohorte}
            onChange={(e) => setFilterCohorte(e.target.value)}
            className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
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
                onClick={() => navigate(scope.createScopedTo('/secretaria/gestor-plantillas'))}
                className="mt-4 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: 'var(--g-radius-md)' }}
              >
                <FileText className="h-4 w-4" />
                Crear nueva plantilla
              </button>
            </div>
          ) : (
            filteredData.map((plantilla) => (
              <button
                key={plantilla.id}
                type="button"
                onClick={() => setSelected(plantilla)}
                aria-pressed={selected?.id === plantilla.id}
                className={`block w-full border border-[var(--g-border-subtle)] px-4 py-4 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                  selected?.id === plantilla.id ? "bg-[var(--g-surface-subtle)]" : "bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? materiaLabel(plantilla.materia_acuerdo ?? plantilla.tipo)
                        : tipoLabel(plantilla.tipo)}
                    </h2>
                    <p className="mt-1 break-words text-xs text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos'
                        ? `${tipoLabel(plantilla.tipo)} · ${plantilla.adoption_mode ? adoptionModeLabel(plantilla.adoption_mode) : "Adopción no informada"}`
                        : materiaLabel(plantilla.materia_acuerdo ?? plantilla.materia)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`px-2 py-1 text-[11px] font-medium ${
                        ESTADO_BADGE[plantilla.estado as keyof typeof ESTADO_BADGE] ||
                        "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
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
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos' ? 'Órgano' : 'Jurisdicción'}
                    </dt>
                    <dd className="mt-1 text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? (plantilla.organo_tipo ? organoTipoLabel(plantilla.organo_tipo) : "No informado")
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
                      {isOperationalTemplate(plantilla) ? "Lista para usar" : "Pendiente de ciclo"}
                    </dd>
                  </div>
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
                  <td colSpan={activeTab === 'modelos' ? 7 : 6} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    Cargando…
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'modelos' ? 7 : 6}>
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
                        onClick={() => navigate(scope.createScopedTo('/secretaria/gestor-plantillas'))}
                        className="mt-4 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                        style={{ borderRadius: 'var(--g-radius-md)' }}
                      >
                        <FileText className="h-4 w-4" />
                        Crear nueva plantilla
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((plantilla) => (
                  <tr
                    key={plantilla.id}
                    onClick={() => setSelected(plantilla)}
                    className={`cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                      selected?.id === plantilla.id ? "bg-[var(--g-surface-subtle)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? materiaLabel(plantilla.materia_acuerdo ?? plantilla.tipo)
                        : tipoLabel(plantilla.tipo)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos'
                        ? (isOperationalTemplate(plantilla) ? "Lista para usar" : "Pendiente de ciclo")
                        : materiaLabel(plantilla.materia)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {/* En modelos, NULL = metadato no informado (mismo criterio que la
                          incidencia "Sin órgano o adopción"); "Cualquier órgano" queda
                          reservado al valor explícito ANY. */}
                      {activeTab === 'modelos'
                        ? (plantilla.organo_tipo ? organoTipoLabel(plantilla.organo_tipo) : "No informado")
                        : jurisdictionLabel(plantilla.jurisdiccion)}
                    </td>
                    {activeTab === 'modelos' ? (
                      <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                        {plantilla.adoption_mode ? adoptionModeLabel(plantilla.adoption_mode) : "No informada"}
                      </td>
                    ) : null}
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {plantilla.version}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-medium ${
                            ESTADO_BADGE[plantilla.estado as keyof typeof ESTADO_BADGE] ||
                            "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
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
                      <ChevronRight className="inline h-4 w-4 text-[var(--g-text-secondary)]" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
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

                {/* Cohorte (UX-7.B) — estado de ciclo de vida + completitud */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Cohorte</div>
                  <div className="mt-1.5">
                    <CohorteBadge plantilla={selected} />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--g-text-secondary)]">
                    {cohorteDescripcion(clasificarCohortePlantilla(selected))}
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
                        ESTADO_BADGE[selected.estado as keyof typeof ESTADO_BADGE] ||
                        "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
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
                    Configuración del motor
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--g-text-secondary)]">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Binding</dt>
                      <dd className="text-right">
                        {materiaLabel(selected.materia_acuerdo ?? selected.materia)} · {organoTipoLabel(selected.organo_tipo)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Adopción</dt>
                      <dd className="text-right">{adoptionModeLabel(selected.adoption_mode)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-[var(--g-text-primary)]">Gate PRE</dt>
                      <dd className="text-right">
                        {selected.snapshot_rule_pack_required
                          ? "Exige snapshot de rule pack"
                          : "Sin snapshot obligatorio configurado"}
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
                    <p className="mt-3 text-xs text-[var(--status-warning)]">
                      Esta plantilla existe, pero no está vinculada a una regla aplicable.
                    </p>
                  ) : null}
                  {selected.estado === "ACTIVA" && !selected.contrato_variables_version ? (
                    <p className="mt-3 text-xs text-[var(--status-warning)]">
                      Esta plantilla está activa, pero faltan metadatos de gobierno documental. Revisa
                      versión, binding, jurisdicción y cobertura antes de usarla como base de bloqueo.
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
                    <button
                      type="button"
                      onClick={() => {
                        setFilterCiclo("vigentes");
                        setFilterRevision("");
                        setFilterCohorte("");
                        setSelected(replacementForSelected);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      Ver versión vigente <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
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
                    <summary className="cursor-pointer text-sm font-medium text-[var(--g-text-primary)]">
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
                      Este es el texto base que usa el motor de documentos; las variables se resuelven en Capa 2 y los campos editables se capturan en Capa 3.
                    </p>
                  </details>
                )}

                {/* Capa 2 Variables */}
                {selected.capa2_variables && Array.isArray(selected.capa2_variables) && selected.capa2_variables.length > 0 && (
                  <details className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <summary className="cursor-pointer text-sm font-medium text-[var(--g-text-primary)]">
                      Variables automáticas
                    </summary>
                    <div className="mt-2 text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Detalle técnico · Capa 2
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selected.capa2_variables.map((v, i) => (
                        <div
                          key={i}
                          className="bg-[var(--g-surface-subtle)] px-2 py-1"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <span className="font-mono font-medium">{v.variable}</span>
                          {" — "}
                          <span className="text-[10px]">{v.fuente}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Capa 3 Editables (Modelos de acuerdo) */}
                {selected.capa3_editables && selected.capa3_editables.length > 0 && (
                  <details className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <summary className="cursor-pointer text-sm font-medium text-[var(--g-text-primary)]">
                      Campos para completar
                    </summary>
                    <div className="mt-2 text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Detalle técnico · Capa 3
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selected.capa3_editables.map((v, i) => (
                        <div
                          key={i}
                          className="bg-[var(--g-surface-muted)] px-2 py-1"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <span className="font-mono font-medium">{v.campo}</span>
                          {v.obligatoriedad === 'OBLIGATORIO' && (
                            <span className="ml-2 text-[var(--status-error)]">*</span>
                          )}
                          {v.descripcion && (
                            <span className="ml-2 text-[10px] text-[var(--g-text-secondary)]">{v.descripcion}</span>
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
                {selected.approval_checklist && selected.approval_checklist.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Checklist de aprobación</div>
                    <div className="mt-2 space-y-1">
                      {selected.approval_checklist.map((item, i) => (
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
                {isOperationalTemplate(selected) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = getTemplateUsageTarget(selected).to;
                      navigate(scope.createScopedTo(target));
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {getTemplateUsageTarget(selected).label}
                  </button>
                )}
                {selected.estado === "ACTIVA" && isSociedadMode && selectedEntity ? (
                  <button
                    type="button"
                    onClick={() => handleAssignBinding(selected)}
                    disabled={assignTemplate.isPending}
                    aria-busy={assignTemplate.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Vincular como plantilla activa
                  </button>
                ) : null}
                {isOperationalTemplate(selected) ? (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    {getTemplateUsageTarget(selected).hint}
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
                        onClick={() => handleTransicion(selected)}
                        disabled={updateEstado.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
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
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--status-error)]">
                      <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                      Gate PRE bloqueó la activación
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

      {/* ITEM-087: diálogo de reconocimiento de warnings. Reintenta la transición
          con ackWarnings:true y el motivo escrito (persistido en changelog). */}
      {ackIssues && pendingTransition ? (
        <TransitionAckDialog
          issues={ackIssues}
          pending={updateEstado.isPending}
          onConfirm={(motivo) => runTransicion(pendingTransition, motivo, true)}
          onCancel={() => {
            setAckIssues(null);
            setPendingTransition(null);
          }}
        />
      ) : null}
    </div>
  );
}
