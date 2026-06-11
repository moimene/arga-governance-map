import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { readMeetingHandoff } from "@/lib/secretaria/cross-module-handoff";
import { toast } from "sonner";
import { useTenantContext } from "@/context/TenantContext";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useCapitalHoldings } from "@/hooks/useCapitalHoldings";
import { useActiveConflicts, type ConflictFull } from "@/hooks/useConflicts";
import { useEntitiesList, type EntityWithParent } from "@/hooks/useEntities";
import { useEntityNormativeProfile } from "@/hooks/useNormativeFramework";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { useRuleResolutions } from "@/hooks/useRuleResolution";
import {
  useBodyMembers,
  useCreateUniversalMeeting,
  useGenerarActa,
  useMeetingAgendaSources,
  useMinuteForMeeting,
  useOpenMeeting,
  useReplaceAttendees,
  useReplaceAgendaItemConstancias,
  useReunionAttendees,
  useReunionById,
  useReunionResolutions,
  useSaveMeetingResolutions,
  useUpdateQuorumData,
  type AgendaItemConstanciaInput,
  type BodyMember,
  type MeetingResolution,
} from "@/hooks/useReunionSecretaria";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { supabase } from "@/integrations/supabase/client";
import {
  buildMeetingAdoptionSnapshot,
  evaluateMeetingVoteCompleteness,
  evaluarConstitucion,
  evaluarPuntoOrdenDia,
  type MeetingAdoptionSnapshot,
  type MeetingAdoptionRuleTrace,
  type MateriaClase,
  type RuleParamOverride,
  type RuleResolution,
  type TipoOrgano,
  type TipoSocial,
} from "@/lib/rules-engine";
import { resolveOrganoTipo } from "@/lib/secretaria/organo-resolver";
import {
  AGENDA_ORIGIN_LABELS,
  newSessionAgendaPoint,
  type AgendaPointOrigin,
  type MeetingAgendaPoint,
} from "@/lib/secretaria/meeting-agenda";
import {
  normalizeAgendaItemKind,
  type AgendaItemKind,
  type AgendaDecisionSubtype,
} from "@/lib/secretaria/agenda-kind";
import {
  checkReclassificationAllowed,
  type OrganType,
} from "@/lib/secretaria/reclassification-matrix";
import { useReclassifyAgendaItemKind } from "@/hooks/useReclassifyAgendaItemKind";
import { useMaterializeAgendaItem } from "@/hooks/useMaterializeAgendaItem";
import { useAgendaItemRealtimeSubscription } from "@/hooks/useAgendaItemRealtimeSubscription";
import { useActaAgendaContract } from "@/hooks/useActas";
import {
  buildAgendaConstanciaSummary,
  renderActaAgendaItemsText,
} from "@/lib/secretaria/acta-agenda";
import {
  buildMeetingAdoptionDoubleEvaluation,
  type DualEvaluationComparison,
} from "@/lib/secretaria/dual-evaluation";
import {
  patchQuorumDataSourceLinks,
  sourceLinksFromAgendaPoints,
} from "@/lib/secretaria/meeting-links";
import {
  buildAgreementNormativeSnapshot,
  type AgreementNormativeSnapshot,
} from "@/lib/secretaria/normative-framework";
import {
  buildUniversalAgendaPoint,
  isUniversalMeetingQuorumData,
  patchUniversalAgendaAcceptance,
  patchUniversalCapitalSummary,
  universalAcceptanceText,
  universalMeetingLabel,
  universalMeetingNamespace,
  universalMeetingRequirementLabel,
  type UniversalMeetingModality,
  type UniversalVotePointInput,
} from "@/lib/secretaria/junta-universal";
import {
  isMeetingRulePackPayload,
  resolveCloudMeetingRulePacksStrict,
  resolvePrototypeMeetingRulePacks,
  uniqueMeetingRuleSpecs,
} from "@/lib/secretaria/prototype-rule-pack-fallback";
import {
  evaluateMeetingCensusAvailability,
  meetingCensusSourceForBodyType,
  selectVotingCapitalHoldings,
} from "@/lib/secretaria/meeting-census";
import { BookDestinationNotice } from "@/components/secretaria/BookDestinationNotice";
import { StepperShell, StepDef } from "./_shared/StepperShell";

// ── Tipos locales ────────────────────────────────────────────────────────────

type VoteValue = "FAVOR" | "CONTRA" | "ABSTENCION" | "";

interface VoterRow {
  id: string;
  person_id: string | null;
  name: string;
  attendance_type?: string | null;
  capital_representado?: number | null;
  shares_represented?: number | null;
  voting_rights?: number | null;
  vote: VoteValue;
  conflict_flag: boolean;
  conflict_reason: string;
}

type CensusMember = BodyMember & {
  default_capital_representado?: number | null;
  default_shares_represented?: number | null;
};

interface MeetingVoterRow {
  id: string;
  person_id: string | null;
  attendance_type: string | null;
  capital_representado: number | null;
  shares_represented: number | null;
  voting_rights: number | null;
  person_name: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const nested = value[key];
  return isRecord(nested) ? nested : {};
}

function stringAt(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const nested = value[key];
  return typeof nested === "string" ? nested : null;
}

function entityDomicilioSocial(entity?: EntityWithParent | null) {
  const parts = [
    entity?.registered_address,
    entity?.address,
    [entity?.address_street, entity?.address_number, entity?.address_floor].filter(Boolean).join(" "),
    entity?.postal_code,
    entity?.city,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(", ");
}

function formatPercent(value: number) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
}

function formatMeetingVoterName(voter: MeetingVoterRow) {
  return voter.person_name?.trim() || "Miembro sin identificar";
}

const AGENDA_MATERIAS = [
  { value: "FORMULACION_CUENTAS", label: "Formulación de cuentas", tipo: "ORDINARIA" },
  { value: "APROBACION_PRESUPUESTOS", label: "Aprobación del presupuesto anual", tipo: "ORDINARIA" },
  { value: "FINANCIACION", label: "Aprobación de financiación", tipo: "ORDINARIA" },
  { value: "CONTRATACION_RELEVANTE", label: "Contratación relevante", tipo: "ORDINARIA" },
  { value: "APROBACION_CUENTAS", label: "Aprobación de cuentas", tipo: "ORDINARIA" },
  { value: "DISTRIBUCION_DIVIDENDOS", label: "Distribución de dividendos", tipo: "ORDINARIA" },
  { value: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", tipo: "ORDINARIA" },
  { value: "DELEGACION_FACULTADES", label: "Delegación de facultades", tipo: "ORDINARIA" },
  { value: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento de auditor", tipo: "ORDINARIA" },
  { value: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", tipo: "ESTATUTARIA" },
  { value: "AUMENTO_CAPITAL", label: "Aumento de capital", tipo: "ESTATUTARIA" },
  { value: "AUTORIZACION_GARANTIA", label: "Garantía intragrupo", tipo: "ESTRUCTURAL" },
] as const;

const EMPTY_ACTIVE_CONFLICTS: ConflictFull[] = [];

const UNIVERSAL_SPECIAL_DOCUMENTATION_MATERIAS = new Set([
  "MODIFICACION_ESTATUTOS",
  "AUMENTO_CAPITAL",
  "FUSION_ESCISION",
  "ESCISION",
  "FUSION",
  "REDUCCION_CAPITAL",
]);

function uniqueOverrides(overrides: RuleParamOverride[]): RuleParamOverride[] {
  const seen = new Set<string>();
  const out: RuleParamOverride[] = [];
  for (const override of overrides) {
    const key = override.id || `${override.entity_id}:${override.materia}:${override.clave}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(override);
  }
  return out;
}

function toTipoSocial(value: unknown): TipoSocial {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("SLU")) return "SLU";
  if (raw.includes("SAU")) return "SAU";
  if (raw.includes("SL")) return "SL";
  return "SA";
}

function normalizeMateriaClase(value: unknown): MateriaClase {
  const raw = String(value ?? "").toUpperCase();
  if (raw === "ESTATUTARIA") return "ESTATUTARIA";
  if (raw === "ESTRUCTURAL") return "ESTRUCTURAL";
  if (raw === "ESPECIAL") return "ESPECIAL";
  return "ORDINARIA";
}

function defaultMateriaForTitle(title: string) {
  const raw = title.toUpperCase();
  if (raw.includes("ESTATUT")) return "MODIFICACION_ESTATUTOS";
  if (raw.includes("CAPITAL")) return "AUMENTO_CAPITAL";
  if (raw.includes("AUDITOR")) return "NOMBRAMIENTO_AUDITOR";
  if (raw.includes("DIVIDENDO") || raw.includes("RESULTADO")) return "DISTRIBUCION_DIVIDENDOS";
  if (raw.includes("CONSEJ") || raw.includes("CARGO")) return "NOMBRAMIENTO_CONSEJERO";
  return "APROBACION_CUENTAS";
}

function materiaClaseFromMateria(materia: string): MateriaClase {
  return normalizeMateriaClase(AGENDA_MATERIAS.find((m) => m.value === materia)?.tipo);
}

function labelMateria(materia: string) {
  return AGENDA_MATERIAS.find((m) => m.value === materia)?.label ?? materia;
}

function selectedOverrides(resolutions: RuleResolution[]) {
  return uniqueOverrides(resolutions.flatMap((resolution) => resolution.applicableOverrides));
}

function votingWeightFor(voter: VoterRow, organoTipo: TipoOrgano) {
  if (organoTipo === "CONSEJO" || organoTipo === "COMISION_DELEGADA") return 1;
  const raw = voter.voting_rights ?? voter.capital_representado ?? voter.shares_represented;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function votoCalidadHabilitadoPorOrgano(organoTipo: TipoOrgano, quorumRule?: Record<string, unknown> | null) {
  // ITEM-040/052: la configuración explícita del órgano manda. El Comité
  // Ejecutivo de ARGA (body_type COMITE → COMISION_DELEGADA) tiene
  // quorum_rule.voto_calidad_presidente=true (DL-5); el early-return por
  // bucket lo dejaba como código muerto. Default sin config: CONSEJO sí,
  // comisiones delegadas no.
  const explicit = quorumRule?.voto_calidad_presidente;
  if (typeof explicit === "boolean") return explicit;
  return organoTipo === "CONSEJO";
}

function snapshotBadgeClass(snapshot?: MeetingAdoptionSnapshot) {
  if (!snapshot) return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
  return snapshot.societary_validity.ok
    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
    : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
}

function formatVoteWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatSavedQuorumPct(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").replace(",", ".").trim());
    if (Number.isFinite(parsed)) {
      return parsed.toLocaleString("es-ES", { maximumFractionDigits: 1 });
    }
  }
  return "—";
}

function formatSavedQuorumDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "fecha pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha pendiente";
  return date.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function agreementOriginForPoint(point: DebatePunto) {
  if (point.agreement_id || point.origin === "PREPARED_AGREEMENT") return "PREPARED" as const;
  if (point.origin === "CONVOCATORIA" || point.origin === "MEETING_AGENDA") return "AGENDA_ITEM" as const;
  return "MEETING_FLOOR" as const;
}

// ── agenda_items.kind helpers (Task 8) ───────────────────────────────────────

type AgendaKindRow = {
  id: string;
  kind: string | null;
  order_number: number | null;
  title: string | null;
};

/**
 * Carga la columna `kind` de `agenda_items` filtrada por meeting_id.
 * Resultado indexado por id para resolver chips por punto.
 * El query se invalida desde `useAgendaItemRealtimeSubscription` y desde
 * la mutación `useReclassifyAgendaItemKind`.
 */
function useAgendaItemsKind(meetingId: string | undefined) {
  return useQuery({
    enabled: !!meetingId,
    queryKey: ["agenda_items", meetingId],
    staleTime: 30_000,
    queryFn: async (): Promise<AgendaKindRow[]> => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("id, kind, order_number, title")
        .eq("meeting_id", meetingId!)
        .order("order_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgendaKindRow[];
    },
  });
}

function resolvePointKind(
  point: DebatePunto,
  kindIndex: Map<string, AgendaItemKind>,
): AgendaItemKind {
  // Codex P1 #2 fix: resolución por orden de prioridad
  //  1. agenda_items.kind (SSOT autoritative cuando el row existe)
  //  2. point.kind propagado desde convocatoria JSON o savedDebates JSON
  //  3. Default conservador DELIBERATIVO
  if (point.source_table === "agenda_items" && point.source_id) {
    const fromTable = kindIndex.get(point.source_id);
    if (fromTable) return fromTable;
  }
  // Codex P1 #2: aceptar kind propagado desde convocatoria JSON, savedDebates, etc.
  // Sin esto, un punto DECISORIO de convocatoria recién creada (sin row en
  // agenda_items todavía) renderiza como DELIBERATIVO en VotacionesStep y queda
  // out-of-rail, bloqueando el flujo normal vote/materialization.
  if (point.kind) return point.kind;
  return "DELIBERATIVO";
}

const KIND_CHIP_STYLES: Record<AgendaItemKind, string> = {
  DECISORIO: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  INFORMATIVO: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  TOMA_DE_RAZON: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  DELIBERATIVO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  ACEPTACION_INFORME: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  RUEGOS_PREGUNTAS:
    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const KIND_CHIP_LABELS: Record<AgendaItemKind, string> = {
  DECISORIO: "DECIS",
  INFORMATIVO: "INFO",
  TOMA_DE_RAZON: "TOMA",
  DELIBERATIVO: "DELIB",
  ACEPTACION_INFORME: "INF",
  RUEGOS_PREGUNTAS: "R/P",
};

const KIND_CHIP_LONG_LABELS: Record<AgendaItemKind, string> = {
  DECISORIO: "decisorio",
  INFORMATIVO: "informativo",
  TOMA_DE_RAZON: "toma de razón",
  DELIBERATIVO: "deliberativo",
  ACEPTACION_INFORME: "aceptación de informe",
  RUEGOS_PREGUNTAS: "ruegos y preguntas",
};

const AGENDA_KIND_OPTIONS: Array<{ value: AgendaItemKind; label: string; helper: string }> = [
  {
    value: "DECISORIO",
    label: "Acuerdo",
    helper: "Produce negocio jurídico y activa votación, mayoría y Acuerdo 360.",
  },
  {
    value: "INFORMATIVO",
    label: "Informativo",
    helper: "Presentación de información sin votación.",
  },
  {
    value: "TOMA_DE_RAZON",
    label: "Toma de razón",
    helper: "Constancia de un hecho o acto ya producido.",
  },
  {
    value: "DELIBERATIVO",
    label: "Deliberativo",
    helper: "Debate sin decisión formal.",
  },
  {
    value: "ACEPTACION_INFORME",
    label: "Aceptación de informe",
    helper: "Recepción de informe con conformidad u observaciones.",
  },
  {
    value: "RUEGOS_PREGUNTAS",
    label: "Ruegos y preguntas",
    helper: "Intervenciones, solicitudes y compromisos de respuesta.",
  },
];

function KindChip({ kind }: { kind: AgendaItemKind }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${KIND_CHIP_STYLES[kind]}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
      aria-label={`Punto ${KIND_CHIP_LONG_LABELS[kind]}`}
    >
      {KIND_CHIP_LABELS[kind]}
    </span>
  );
}

interface ReclassifyKindDialogProps {
  open: boolean;
  agendaItemId: string | null;
  meetingId: string;
  currentKind: AgendaItemKind;
  meetingStatus: string;
  organType: OrganType | undefined;
  isUniversal: boolean | undefined;
  pointTitle: string;
  pointOrderNumber: number;
  onClose: () => void;
}

function ReclassifyKindDialog({
  open,
  agendaItemId,
  meetingId,
  currentKind,
  meetingStatus,
  organType,
  isUniversal,
  pointTitle,
  pointOrderNumber,
  onClose,
}: ReclassifyKindDialogProps) {
  const reclassify = useReclassifyAgendaItemKind();
  const [motivo, setMotivo] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMotivo("");
      setSubmitError(null);
    }
  }, [open]);

  if (!open || !agendaItemId) return null;

  // Pre-validación matriz P7 (UX: bloquear submit ANTES de la mutación)
  const matrixCheck = checkReclassificationAllowed({
    meetingStatus,
    currentKind,
    newKind: "DECISORIO",
    organType,
    isUniversal,
  });

  const trimmedMotivo = motivo.trim();
  const motivoTooShort = trimmedMotivo.length > 0 && trimmedMotivo.length < 3;
  const canSubmit =
    matrixCheck.allowed && trimmedMotivo.length >= 3 && !reclassify.isPending;

  async function handleSubmit() {
    if (!canSubmit || !agendaItemId) return;
    setSubmitError(null);
    try {
      await reclassify.mutateAsync({
        agendaItemId,
        meetingId,
        newKind: "DECISORIO",
        motivo: trimmedMotivo,
      });
      toast.success(`Punto ${pointOrderNumber} reclasificado a DECISORIO`);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error al reclasificar el punto";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reclassify-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-brand-3308)]/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{
          borderRadius: "var(--g-radius-xl)",
          boxShadow: "var(--g-shadow-modal)",
        }}
      >
        <h3
          id="reclassify-dialog-title"
          className="text-base font-semibold text-[var(--g-text-primary)]"
        >
          Reclasificar punto {pointOrderNumber} a DECISORIO
        </h3>
        <p className="mt-2 text-xs text-[var(--g-text-secondary)]">{pointTitle}</p>
        <div
          className="mt-3 flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span>Cambio:</span>
          <KindChip kind={currentKind} />
          <span className="text-[var(--g-text-secondary)]">→</span>
          <KindChip kind="DECISORIO" />
        </div>

        {!matrixCheck.allowed && (
          <div
            className="mt-4 flex items-start gap-2 border border-[var(--status-error)] bg-[var(--g-surface-muted)] px-3 py-2 text-xs text-[var(--status-error)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">Matriz P7 deniega:</span>{" "}
              {matrixCheck.reason ?? "reclasificación no permitida."}
            </span>
          </div>
        )}

        <div className="mt-4">
          <label
            htmlFor="reclassify-motivo"
            className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]"
          >
            Motivo de la reclasificación
            <span className="ml-1 text-[var(--status-error)]">*</span>
          </label>
          <textarea
            id="reclassify-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            disabled={!matrixCheck.allowed || reclassify.isPending}
            aria-invalid={motivoTooShort ? true : undefined}
            aria-describedby={motivoTooShort ? "reclassify-motivo-error" : undefined}
            placeholder="Justifica la elevación a decisorio (mínimo 3 caracteres). Queda registrado en el changelog de auditoría."
            className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          {motivoTooShort && (
            <p
              id="reclassify-motivo-error"
              className="mt-1 text-xs text-[var(--status-error)]"
            >
              Mínimo 3 caracteres.
            </p>
          )}
        </div>

        {submitError && (
          <div
            className="mt-3 flex items-start gap-2 border border-[var(--status-error)] bg-[var(--g-surface-muted)] px-3 py-2 text-xs text-[var(--status-error)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={reclassify.isPending}
            className="inline-flex items-center bg-transparent px-3 py-1.5 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={reclassify.isPending}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {reclassify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reclasificar a DECISORIO
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Paso 1: Constitución ─────────────────────────────────────────────────────

function ConstitutionStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting, isLoading } = useReunionById(meetingId);
  const openMeeting = useOpenMeeting(meetingId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando datos de la reunión…</span>
      </div>
    );
  }

  if (!meeting) {
    return <p className="text-sm text-[var(--g-text-secondary)]">Reunión no encontrada.</p>;
  }

  const m = meeting as {
    status: string | null;
    meeting_type: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    location: string | null;
    confidentiality_level: string | null;
    governing_bodies?: { name?: string | null; entities?: { common_name?: string | null } | null } | null;
  };

  const isOpen = m.status === "CELEBRADA";
  const bodyName = m.governing_bodies?.name ?? "—";
  const entityName = m.governing_bodies?.entities?.common_name ?? "—";

  const fields: [string, string][] = [
    ["Entidad", entityName],
    ["Órgano", bodyName],
    ["Tipo de sesión", m.meeting_type ?? "—"],
    [
      "Inicio previsto",
      m.scheduled_start
        ? new Date(m.scheduled_start).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
        : "—",
    ],
    [
      "Fin previsto",
      m.scheduled_end
        ? new Date(m.scheduled_end).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
        : "—",
    ],
    ["Lugar / Modalidad", m.location ?? "—"],
    ["Confidencialidad", m.confidentiality_level ?? "NORMAL"],
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Verifica los datos de la sesión antes de declararla abierta. Al abrir la sesión el estado
        pasa a <span className="font-medium text-[var(--g-text-primary)]">CELEBRADA</span> y se activan
        los pasos de asistentes y quórum.
      </p>

      <div
        className="divide-y divide-[var(--g-border-subtle)] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-start gap-4 px-5 py-3">
            <span className="w-36 shrink-0 text-xs font-medium text-[var(--g-text-secondary)]">
              {label}
            </span>
            <span className="text-sm text-[var(--g-text-primary)]">{value}</span>
          </div>
        ))}
        <div className="flex items-start gap-4 px-5 py-3">
          <span className="w-36 shrink-0 text-xs font-medium text-[var(--g-text-secondary)]">
            Estado actual
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
              isOpen ? "bg-[var(--status-success)]" : "bg-[var(--status-info)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {isOpen ? <CheckCircle2 className="h-3 w-3" /> : null}
            {m.status ?? "SCHEDULED"}
          </span>
        </div>
      </div>

      {isOpen ? (
        <div
          className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <p className="text-sm font-semibold text-[var(--g-text-primary)]">
            Sesión declarada abierta. Continúa al paso de asistentes.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            openMeeting.mutate(undefined, {
              onSuccess: () => toast.success("Sesión abierta"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Error al abrir sesión"),
            })
          }
          disabled={openMeeting.isPending}
          aria-busy={openMeeting.isPending}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-5 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {openMeeting.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Declarar apertura de la sesión
        </button>
      )}
    </div>
  );
}

// ── Paso 2: Asistentes ───────────────────────────────────────────────────────

type AttendanceEntry = {
  attendance_type: "PRESENCIAL" | "REPRESENTADO" | "AUSENTE";
  represented_by_id: string;
  capital_representado: string;
  via_representante: boolean;
};

const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENCIAL: "Presencial",
  REPRESENTADO: "Representado",
  AUSENTE: "Ausente",
};

const TIPO_CONDICION_LABELS: Record<string, string> = {
  ACCIONISTA: "Accionista",
  CONSEJERO: "Consejero",
  PRESIDENTE: "Presidente",
  SECRETARIO: "Secretario",
  VICEPRESIDENTE: "Vicepresidente",
  CONSEJERO_COORDINADOR: "Coordinador independiente",
  SOCIO: "Socio",
  ADMIN_UNICO: "Administrador único",
  ADMIN_SOLIDARIO: "Administrador solidario",
  ADMIN_MANCOMUNADO: "Administrador mancomunado",
  ADMIN_PJ: "Administrador persona jurídica",
};

function AsistentesStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting, isLoading: meetingLoading } = useReunionById(meetingId);
  const bodyId = (meeting as { body_id?: string } | null)?.body_id;
  const meetingRaw = meeting as
    | {
        quorum_data?: Record<string, unknown> | null;
        governing_bodies?: {
          body_type?: string | null;
          entity_id?: string | null;
          entities?: { legal_form?: string | null; tipo_social?: string | null } | null;
        } | null;
      }
    | null;
  const organoTipo = resolveOrganoTipo(meetingRaw?.governing_bodies);
  const censusSource = meetingCensusSourceForBodyType(meetingRaw?.governing_bodies?.body_type);
  const isJuntaCensus = censusSource === "capital_holdings";
  const isUniversalMeeting = isUniversalMeetingQuorumData(meetingRaw?.quorum_data);
  const entityId = meetingRaw?.governing_bodies?.entity_id ?? null;
  const tipoSocial = toTipoSocial(
    meetingRaw?.governing_bodies?.entities?.tipo_social ??
      meetingRaw?.governing_bodies?.entities?.legal_form
  );

  const { data: bodyMembers = [], isLoading: membersLoading } = useBodyMembers(bodyId);
  const { data: capitalHoldings = [], isLoading: holdingsLoading } = useCapitalHoldings(
    isJuntaCensus ? entityId ?? undefined : undefined
  );
  const { data: existingAttendees = [] } = useReunionAttendees(meetingId);
  const replaceAttendees = useReplaceAttendees(meetingId);
  const members: CensusMember[] = useMemo(() => {
    const existingAttendeeMembers: CensusMember[] = existingAttendees
      .filter((attendee) => Boolean(attendee.person_id))
      .map((attendee) => ({
        id: attendee.id,
        person_id: attendee.person_id!,
        tipo_condicion: organoTipo === "JUNTA_GENERAL" ? (tipoSocial === "SA" || tipoSocial === "SAU" ? "ACCIONISTA" : "SOCIO") : "MIEMBRO",
        full_name: attendee.full_name?.trim() || "Miembro sin identificar",
        es_vocal: attendee.voting_rights === null || attendee.voting_rights === undefined || Number(attendee.voting_rights) !== 0,
        default_capital_representado: attendee.capital_representado ?? null,
        default_shares_represented: attendee.shares_represented ?? null,
      }));

    if (!isJuntaCensus) {
      return bodyMembers.length > 0 ? bodyMembers : existingAttendeeMembers;
    }

    const shareholderMembers = selectVotingCapitalHoldings(capitalHoldings)
      .map((holding): CensusMember => ({
        id: holding.id,
        person_id: holding.holder_person_id,
        tipo_condicion: tipoSocial === "SA" || tipoSocial === "SAU" ? "ACCIONISTA" : "SOCIO",
        es_vocal: true,
        full_name:
          holding.holder?.full_name?.trim() ||
          holding.holder?.denomination?.trim() ||
          "Socio sin identificar",
        default_capital_representado: holding.porcentaje_capital ?? null,
        default_shares_represented: holding.numero_titulos ?? null,
      }));

    return shareholderMembers.length > 0 ? shareholderMembers : existingAttendeeMembers;
  }, [bodyMembers, capitalHoldings, existingAttendees, isJuntaCensus, organoTipo, tipoSocial]);

  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (members.length === 0) return;

    const map: Record<string, AttendanceEntry> = {};
    if (existingAttendees.length > 0) {
      for (const a of existingAttendees) {
        if (a.person_id) {
          map[a.person_id] = {
            attendance_type: (a.attendance_type as "PRESENCIAL" | "REPRESENTADO" | "AUSENTE") ?? "PRESENCIAL",
            represented_by_id: a.represented_by_id ?? "",
            capital_representado:
              a.capital_representado === null || a.capital_representado === undefined
                ? ""
                : String(a.capital_representado),
            via_representante: Boolean(a.via_representante),
          };
        }
      }
    }
    for (const m of members) {
      if (!map[m.person_id]) {
        map[m.person_id] = {
          attendance_type: "PRESENCIAL",
          represented_by_id: "",
          capital_representado:
            m.default_capital_representado === null || m.default_capital_representado === undefined
              ? ""
              : String(m.default_capital_representado),
          via_representante: false,
        };
      }
    }
    setAttendance(map);
    setInitialized(true);
  }, [initialized, members, existingAttendees]);

  function setType(personId: string, type: AttendanceEntry["attendance_type"]) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        attendance_type: type,
        represented_by_id: type === "REPRESENTADO" ? prev[personId]?.represented_by_id ?? "" : "",
        via_representante: type === "REPRESENTADO",
      },
    }));
  }

  function setRepr(personId: string, val: string) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], represented_by_id: val },
    }));
  }

  function setCapital(personId: string, val: string) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], capital_representado: val },
    }));
  }

  function handleSave() {
    const missingRepresentative = members.find((m) => {
      const entry = attendance[m.person_id];
      return entry?.attendance_type === "REPRESENTADO" && !entry.represented_by_id;
    });
    if (missingRepresentative) {
      toast.error(`Selecciona representante para ${missingRepresentative.full_name}`);
      return;
    }

    const rows = members.map((m) => {
      const entry = attendance[m.person_id];
      const attendanceType = entry?.attendance_type ?? "PRESENCIAL";
      const capitalValue = entry?.capital_representado === ""
        ? m.default_capital_representado ?? null
        : Number(entry?.capital_representado ?? 0);
      return {
        person_id: m.person_id,
        attendance_type: attendanceType,
        represented_by_id: attendanceType === "REPRESENTADO" ? entry?.represented_by_id || null : null,
        capital_representado: Number.isFinite(capitalValue) ? capitalValue : null,
        shares_represented: attendanceType === "AUSENTE" ? 0 : m.default_shares_represented ?? null,
        // ITEM-028/037: en órganos colegiados voting_rights marca la condición
        // de vocal (1) o voz sin voto (0, secretario no consejero); en juntas
        // conserva el capital con derecho a voto.
        voting_rights: isJuntaCensus
          ? (Number.isFinite(capitalValue) ? capitalValue : null)
          : (m.es_vocal ? 1 : 0),
        via_representante: attendanceType === "REPRESENTADO",
      };
    });
    if (isUniversalMeeting && !universalConcurrenceOk) {
      toast.error(
        `${universalMeetingLabel(organoTipo)} requiere ${universalMeetingRequirementLabel(organoTipo)}. Concurrencia actual: ${formatPercent(universalConcurrencePct)}%.`
      );
      return;
    }
    replaceAttendees.mutate(rows, {
      onSuccess: () => toast.success(`Asistencia de ${rows.length} miembros guardada`),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar asistencia"),
    });
  }

  // ITEM-028/037: en órganos colegiados solo los vocales computan
  // (el secretario no consejero asiste con voz sin voto — art. 247 LSC).
  const censoVocal = isJuntaCensus ? members : members.filter((m) => m.es_vocal);
  const presentes = censoVocal.filter(
    (m) => (attendance[m.person_id]?.attendance_type ?? "PRESENCIAL") !== "AUSENTE"
  ).length;
  const universalCapitalPct = members.reduce((sum, member) => {
    const entry = attendance[member.person_id];
    if ((entry?.attendance_type ?? "PRESENCIAL") === "AUSENTE") return sum;
    const raw = entry?.capital_representado === ""
      ? member.default_capital_representado ?? 0
      : Number(entry?.capital_representado ?? 0);
    return Number.isFinite(raw) ? sum + raw : sum;
  }, 0);
  const universalMembersPct = censoVocal.length > 0 ? (presentes / censoVocal.length) * 100 : 0;
  const universalConcurrencePct = organoTipo === "JUNTA_GENERAL" ? universalCapitalPct : universalMembersPct;
  const universalConcurrenceOk = universalConcurrencePct >= 99.999;

  if (meetingLoading || (!isJuntaCensus && Boolean(bodyId) && membersLoading) || (isJuntaCensus && holdingsLoading)) {
    return (
      <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">
          {isJuntaCensus ? "Cargando accionistas con derecho de voto…" : "Cargando miembros del órgano…"}
        </span>
      </div>
    );
  }

  if (!bodyId) {
    return (
      <div
        className="space-y-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
          La reunión no tiene órgano asociado
        </p>
        <p className="text-sm text-[var(--g-text-secondary)]">
          No se puede cargar la lista de asistentes hasta vincular la reunión con un órgano social.
        </p>
      </div>
    );
  }

  const censusAvailability = evaluateMeetingCensusAvailability({
    sourceCount: isJuntaCensus ? selectVotingCapitalHoldings(capitalHoldings).length : bodyMembers.length,
    existingAttendeesCount: existingAttendees.length,
  });

  if (!censusAvailability.ok || members.length === 0) {
    return (
      <div
        className="space-y-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
          {isJuntaCensus ? "No hay socios/accionistas vigentes" : "No hay censo vigente del órgano"}
        </p>
        <p className="text-sm text-[var(--g-text-secondary)]">
          {isJuntaCensus
            ? "No se puede celebrar la Junta hasta cargar posiciones vigentes en el libro de socios/accionistas. Registra capital_holdings antes de calcular quórum, votar o generar acta."
            : "No se puede celebrar la sesión hasta cargar miembros vigentes del órgano en el censo societario. Registra el censo legal antes de calcular quórum, votar o generar acta."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        {isJuntaCensus
          ? "Registra asistencia, representación y capital/derechos de voto de cada socio o accionista. Los porcentajes se precargan desde el libro vigente."
          : "Registra la modalidad de asistencia de cada miembro. Los representados requieren indicar quién actúa en su nombre."}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Miembro
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Cargo
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Asistencia
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Representado por
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Capital / votos
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Vía
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {members.map((m: CensusMember) => {
              const entry = attendance[m.person_id] ?? {
                attendance_type: "PRESENCIAL",
                represented_by_id: "",
                capital_representado: "",
                via_representante: false,
              };
              const needsRepr = entry.attendance_type === "REPRESENTADO";
              // ITEM-028/037: en consejo/comisiones solo cabe delegar en otro
              // vocal (la secretaria no consejera no puede representar).
              const representativeOptions = members.filter((member) => {
                if (member.person_id === m.person_id) return false;
                if (!isJuntaCensus && !member.es_vocal) return false;
                const candidateAttendance = attendance[member.person_id]?.attendance_type ?? "PRESENCIAL";
                return candidateAttendance !== "AUSENTE";
              });
              return (
                <tr key={m.id} className="transition-colors hover:bg-[var(--g-surface-subtle)]/30">
                  <td className="px-4 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                    {m.full_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                    {TIPO_CONDICION_LABELS[m.tipo_condicion] ?? m.tipo_condicion}
                    {!isJuntaCensus && !m.es_vocal ? (
                      <span
                        className="ml-2 inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-xs text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        Con voz sin voto
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={entry.attendance_type}
                      onChange={(e) =>
                        setType(m.person_id, e.target.value as AttendanceEntry["attendance_type"])
                      }
                      aria-label={`Tipo de asistencia de ${m.full_name}`}
                      className="rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {(["PRESENCIAL", "REPRESENTADO", "AUSENTE"] as const).map((t) => (
                        <option key={t} value={t}>
                          {ATTENDANCE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {needsRepr ? (
                      <select
                        value={entry.represented_by_id}
                        onChange={(e) => setRepr(m.person_id, e.target.value)}
                        aria-label={`Representante de ${m.full_name}`}
                        className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <option value="">Seleccionar representante</option>
                        {representativeOptions.map((representative) => (
                          <option key={representative.person_id} value={representative.person_id}>
                            {representative.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.capital_representado}
                      onChange={(e) => setCapital(m.person_id, e.target.value)}
                      aria-label={`Capital o votos de ${m.full_name}`}
                      className="w-28 rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium ${
                        entry.via_representante
                          ? "bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {entry.via_representante ? "Representante" : "Directa"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center gap-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Users className="h-4 w-4 text-[var(--g-text-secondary)]" />
        <span className="font-medium text-[var(--g-text-primary)]">
          {presentes} / {members.length} presentes o representados
        </span>
        <span className="text-[var(--g-text-secondary)]">
          {members.length - presentes} ausentes
        </span>
      </div>

      {isUniversalMeeting ? (
        <div
          className="space-y-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              {universalMeetingRequirementLabel(organoTipo)}
            </p>
            <span
              className={`text-sm font-semibold ${
                universalConcurrenceOk ? "text-[var(--status-success)]" : "text-[var(--status-error)]"
              }`}
            >
              {formatPercent(universalConcurrencePct)}%
            </span>
          </div>
          <div
            className="h-2 overflow-hidden bg-[var(--g-surface-muted)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
            aria-label={`Concurrencia universal ${formatPercent(universalConcurrencePct)}%`}
          >
            <div
              className={universalConcurrenceOk ? "h-full bg-[var(--status-success)]" : "h-full bg-[var(--status-error)]"}
              style={{
                width: `${Math.min(Math.max(universalConcurrencePct, 0), 100)}%`,
                borderRadius: "var(--g-radius-full)",
              }}
            />
          </div>
          {!universalConcurrenceOk ? (
            <p className="text-xs font-medium text-[var(--status-error)]" role="alert">
              {universalMeetingLabel(organoTipo)} requiere {universalMeetingRequirementLabel(organoTipo)}.
              Concurrencia actual: {formatPercent(universalConcurrencePct)}%.
            </p>
          ) : (
            <p className="text-xs text-[var(--g-text-secondary)]">
              La lista queda preparada como Anexo A del acta con concurrencia universal completa.
            </p>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={replaceAttendees.isPending || (isUniversalMeeting && !universalConcurrenceOk)}
        aria-busy={replaceAttendees.isPending}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {replaceAttendees.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Guardar asistencia
      </button>
    </div>
  );
}

// ── Paso 3: Quórum ───────────────────────────────────────────────────────────

function QuorumStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting, isLoading: meetingLoading } = useReunionById(meetingId);
  const bodyId = (meeting as { body_id?: string } | null)?.body_id;
  const existingQuorum = (meeting as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data;
  const meetingRaw = meeting as
    | {
        quorum_data?: Record<string, unknown> | null;
        governing_bodies?: {
          body_type?: string | null;
          entity_id?: string | null;
          quorum_rule?: Record<string, unknown> | null;
          entities?: { legal_form?: string | null; tipo_social?: string | null } | null;
        } | null;
      }
    | null;

  const { data: attendees = [], isLoading: attendeesLoading } = useReunionAttendees(meetingId);
  const { data: members = [], isLoading: membersLoading } = useBodyMembers(bodyId);
  const { data: agendaSources = [], isLoading: agendaSourcesLoading } = useMeetingAgendaSources(meetingId);
  const updateQuorum = useUpdateQuorumData(meetingId);

  // ITEM-016/038: el quórum de junta SA depende de si la sesión se celebra en
  // 1ª o 2ª convocatoria (arts. 193-194 LSC). El secretario lo declara aquí y
  // queda persistido en quorum_data para constitución y votación.
  const [convocatoriaLlamada, setConvocatoriaLlamada] = useState<"PRIMERA" | "SEGUNDA">("PRIMERA");
  const [llamadaInitialized, setLlamadaInitialized] = useState(false);
  useEffect(() => {
    if (llamadaInitialized || !meeting) return;
    const saved = (existingQuorum?.quorum as { convocatoria_llamada?: string } | undefined)
      ?.convocatoria_llamada;
    if (saved === "SEGUNDA") setConvocatoriaLlamada("SEGUNDA");
    setLlamadaInitialized(true);
  }, [llamadaInitialized, meeting, existingQuorum]);

  const agendaForRules = agendaSources.length > 0
    ? agendaSources
    : ((existingQuorum?.debates ?? []) as DebatePunto[]);
  const debates = agendaForRules.map((debate) => {
    const materia = debate.materia ?? defaultMateriaForTitle(debate.punto);
    return {
      ...debate,
      materia,
      tipo: debate.tipo ?? materiaClaseFromMateria(materia),
    };
  });
  const ruleSpecs = uniqueMeetingRuleSpecs(
    debates.length > 0
      ? debates.map((debate) => ({
          materia: debate.materia ?? "APROBACION_CUENTAS",
          clase: normalizeMateriaClase(debate.tipo),
        }))
      : [{ materia: "APROBACION_CUENTAS", clase: "ORDINARIA" as MateriaClase }]
  );
  const tipoSocial = toTipoSocial(
    meetingRaw?.governing_bodies?.entities?.tipo_social ??
      meetingRaw?.governing_bodies?.entities?.legal_form
  );
  const organoTipo = resolveOrganoTipo(meetingRaw?.governing_bodies);
  const isUniversalMeeting = isUniversalMeetingQuorumData(existingQuorum);
  const entityId = meetingRaw?.governing_bodies?.entity_id ?? null;
  const { data: ruleResolutions = [], isLoading: rulesLoading } = useRuleResolutions({
    materias: ruleSpecs,
    entityId,
    organoTipo,
  });
  const prototypeRuleContext = resolvePrototypeMeetingRulePacks(ruleSpecs, ruleResolutions, organoTipo);
  const packs = prototypeRuleContext.packs;
  const overrides = selectedOverrides(ruleResolutions);
  const loadingCensus =
    meetingLoading || attendeesLoading || agendaSourcesLoading || (Boolean(bodyId) && membersLoading);
  const noBody = !loadingCensus && !bodyId;
  const noPersistentCensus = !loadingCensus && members.length === 0 && attendees.length === 0;
  const noPersistedAttendance = !loadingCensus && members.length > 0 && attendees.length === 0;

  if (loadingCensus) {
    return (
      <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando censo y asistencia de la sesión…</span>
      </div>
    );
  }

  if (noBody) {
    return (
      <div
        className="space-y-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
          La reunión no tiene órgano asociado
        </p>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Vincula la reunión con un órgano social antes de calcular quórum.
        </p>
      </div>
    );
  }

  if (noPersistentCensus) {
    return (
      <div
        className="space-y-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
          No hay censo vigente para calcular quórum
        </p>
        <p className="text-sm text-[var(--g-text-secondary)]">
          La sesión necesita miembros vigentes o asistentes persistidos. Carga el censo del órgano
          y guarda la lista de asistencia antes de confirmar quórum.
        </p>
      </div>
    );
  }

  if (noPersistedAttendance) {
    return (
      <div
        className="space-y-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
          No hay lista de asistentes guardada
        </p>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Guarda la asistencia real de la sesión antes de calcular quórum. El motor no usa
          asistentes implícitos ni censos ficticios para constituir una reunión.
        </p>
      </div>
    );
  }

  // ITEM-028/037: en órganos colegiados el quórum se computa sobre VOCALES
  // (arts. 247.1/247.2 LSC) — el secretario no consejero asiste con voz sin
  // voto y no entra ni en numerador ni en denominador.
  const isOrganoColegiado = organoTipo !== "JUNTA_GENERAL";
  const vocalMembers = isOrganoColegiado ? members.filter((m) => m.es_vocal) : members;
  const vocalPersonIds = new Set(vocalMembers.map((m) => m.person_id));
  const countableAttendees =
    isOrganoColegiado && members.length > 0
      ? attendees.filter((a) => a.person_id && vocalPersonIds.has(a.person_id))
      : attendees;
  const presentes = countableAttendees.filter((a) => a.attendance_type !== "AUSENTE").length;
  const total = vocalMembers.length > 0 ? vocalMembers.length : countableAttendees.length;
  const attendeeCapital = attendees.reduce(
    (sum, attendee) =>
      attendee.attendance_type === "AUSENTE" ? sum : sum + Number(attendee.capital_representado ?? 0),
    0
  );
  const attendeeCapitalImporte = attendees.reduce(
    (sum, attendee) =>
      attendee.attendance_type === "AUSENTE" ? sum : sum + Number(attendee.shares_represented ?? 0),
    0
  );
  const hasCapitalData = attendeeCapital > 0;
  const capitalTotal = hasCapitalData ? 100 : Math.max(total, 1);
  const capitalPresente = hasCapitalData ? attendeeCapital : presentes;
  const materiaClase = ruleSpecs.some((spec) => spec.clase === "ESTRUCTURAL")
    ? "ESTRUCTURAL"
    : ruleSpecs.some((spec) => spec.clase === "ESTATUTARIA")
    ? "ESTATUTARIA"
    : "ORDINARIA";
  const constitutionResult = evaluarConstitucion(
    {
      tipoSocial,
      organoTipo,
      adoptionMode: "MEETING",
      primeraConvocatoria: convocatoriaLlamada !== "SEGUNDA",
      materiaClase,
      capitalConDerechoVoto: capitalTotal,
      capitalPresenteRepresentado: capitalPresente,
      asistentesPresentes: presentes,
      totalMiembros: total,
    },
    packs,
    overrides
  );
  const universalPct =
    organoTipo === "JUNTA_GENERAL"
      ? (hasCapitalData ? attendeeCapital : 0)
      : total > 0
        ? (presentes / total) * 100
        : 0;
  const pct = isUniversalMeeting ? universalPct : constitutionResult.quorumPresente * 100;
  const quorumReached = isUniversalMeeting ? pct >= 99.999 : constitutionResult.quorumCubierto;

  const savedQuorum = existingQuorum?.quorum as
    | {
        present: number;
        total: number;
        pct: string;
        reached: boolean;
        evaluated_at: string;
        rule_pack_ids?: string[];
        materia_clase?: MateriaClase;
      }
    | undefined;

  function handleConfirm() {
    if (isUniversalMeeting && !quorumReached) {
      toast.error(
        `${universalMeetingLabel(organoTipo)} requiere ${universalMeetingRequirementLabel(organoTipo)}. Concurrencia actual: ${formatPercent(pct)}%.`
      );
      return;
    }

    const baseQuorumData: Record<string, unknown> = {
      ...(existingQuorum ?? {}),
      is_universal: isUniversalMeeting || existingQuorum?.is_universal === true,
      junta_universal: isUniversalMeeting || existingQuorum?.junta_universal === true,
      quorum: {
        present: presentes,
        total,
        pct: pct.toFixed(1),
        reached: quorumReached,
        convocatoria_llamada: convocatoriaLlamada,
        engine: "evaluarConstitucion",
        organo_tipo: organoTipo,
        tipo_social: tipoSocial,
        materia_clase: materiaClase,
        rule_pack_ids: packs.map((pack) => pack.id),
        prototype_rule_pack_fallback_ids: prototypeRuleContext.fallbackPackIds,
        explain: constitutionResult.explain,
        warnings: constitutionResult.warnings,
        blocking_issues: constitutionResult.blocking_issues,
        evaluated_at: new Date().toISOString(),
        universal_requirement: isUniversalMeeting ? universalMeetingRequirementLabel(organoTipo) : null,
      },
    };
    const quorumData = isUniversalMeeting
      ? patchUniversalCapitalSummary(baseQuorumData, {
          capitalConcurrentePorcentaje: Number(pct.toFixed(2)),
          capitalConcurrenteImporte: attendeeCapitalImporte || null,
          calculoCapitalRef: `${organoTipo === "JUNTA_GENERAL" ? "capital_holdings" : "body_members"}:${meetingId}:universal:${new Date().toISOString()}`,
        })
      : baseQuorumData;
    updateQuorum.mutate(quorumData, {
      onSuccess: () => toast.success("Quórum registrado en el acta"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar quórum"),
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        {isUniversalMeeting
          ? `${universalMeetingLabel(organoTipo)} exige ${universalMeetingRequirementLabel(organoTipo)} y aceptación unánime del orden del día. El sistema bloquea el avance si falta cualquier participación.`
          : "El quórum se calcula con el motor de constitución según órgano, tipo social y materias debatidas. En juntas se usa capital/derechos de voto cuando existe dato disponible; en consejo se usa mayoría de miembros."}
      </p>

      {organoTipo === "JUNTA_GENERAL" && (tipoSocial === "SA" || tipoSocial === "SAU") && !isUniversalMeeting ? (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <label
            htmlFor="convocatoria-llamada"
            className="block text-sm font-medium text-[var(--g-text-primary)]"
          >
            Convocatoria en la que se celebra la sesión
          </label>
          <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
            El quórum exigible cambia entre 1ª y 2ª convocatoria (arts. 193-194 LSC).
          </p>
          <select
            id="convocatoria-llamada"
            value={convocatoriaLlamada}
            onChange={(e) => setConvocatoriaLlamada(e.target.value === "SEGUNDA" ? "SEGUNDA" : "PRIMERA")}
            className="mt-2 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
            data-testid="quorum-convocatoria-llamada"
          >
            <option value="PRIMERA">Primera convocatoria</option>
            <option value="SEGUNDA">Segunda convocatoria</option>
          </select>
        </div>
      ) : null}

      <div
        className="grid grid-cols-3 gap-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="text-center">
          <p className="text-3xl font-bold text-[var(--g-text-primary)]">{presentes}</p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Presentes / representados</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-[var(--g-text-primary)]">{total}</p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Total miembros</p>
        </div>
        <div className="text-center">
          <p
            className={`text-3xl font-bold ${
              quorumReached ? "text-[var(--status-success)]" : "text-[var(--status-error)]"
            }`}
          >
            {pct.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {organoTipo === "JUNTA_GENERAL" ? "Capital/derecho de voto" : "Miembros presentes"}
          </p>
        </div>
      </div>

      {isUniversalMeeting && !quorumReached ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
          <p className="text-xs font-medium text-[var(--status-error)]">
            {universalMeetingLabel(organoTipo)} requiere {universalMeetingRequirementLabel(organoTipo)}.
            Concurrencia actual: {formatPercent(pct)}%.
          </p>
        </div>
      ) : null}

      {organoTipo === "JUNTA_GENERAL" && !hasCapitalData && !isUniversalMeeting && (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            No hay capital/derechos de voto informados en la lista de asistentes. El motor usa el
            número de asistentes como aproximación demo; para una junta real debe cargarse capital,
            derechos de voto y clases afectadas.
          </p>
        </div>
      )}

      {prototypeRuleContext.hasFallback && (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Rule pack Cloud no resuelto para {prototypeRuleContext.fallbackPackIds.length} materia(s).
            El prototipo usa un fallback tecnico documentado para mantener el circuito operativo;
            no sustituye un rule pack aprobado ni habilita evidencia final productiva.
          </p>
        </div>
      )}

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
          Materias y rule packs aplicados
        </h3>
        <div className="space-y-2">
          {ruleSpecs.map((spec, index) => (
            <div
              key={`${spec.materia}-${index}`}
              className="flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]"
            >
              <span className="font-medium text-[var(--g-text-primary)]">
                {labelMateria(spec.materia)}
              </span>
              <span>{spec.clase}</span>
              <span>
                {ruleResolutions.find((resolution) => resolution.rulePack?.materia === spec.materia)?.rulePack
                  ? "pack resuelto"
                  : "pack pendiente"}
              </span>
            </div>
          ))}
          {rulesLoading && (
            <p className="text-xs text-[var(--g-text-secondary)]">Cargando reglas aplicables…</p>
          )}
        </div>
      </div>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
          Evaluación Motor V2 — Quórum de constitución
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {quorumReached ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
            )}
            <span
              className={`inline-flex px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
                quorumReached ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {quorumReached ? "QUÓRUM ALCANZADO" : "SIN QUÓRUM"}
            </span>
          </div>
          <p className="text-xs text-[var(--g-text-secondary)]">
            <span className="font-mono">
              {constitutionResult.explain[0]?.regla ?? "Quórum requerido"}
            </span>
          </p>
          <p className="text-xs text-[var(--g-text-primary)]">
            {constitutionResult.explain[0]?.mensaje ?? "Sin explicación disponible."}
          </p>
          {constitutionResult.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {constitutionResult.warnings.map((warning) => (
                <li key={warning} className="text-xs text-[var(--status-warning)]">
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {savedQuorum && (
        <div
          className="flex items-center gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Quórum ya registrado: {formatSavedQuorumPct(savedQuorum.pct)}% ·{" "}
            {savedQuorum.materia_clase ?? "sin clase"} — {formatSavedQuorumDate(savedQuorum.evaluated_at)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={updateQuorum.isPending || !quorumReached}
        aria-busy={updateQuorum.isPending}
        title={!quorumReached ? "No hay quórum suficiente para abrir la sesión" : undefined}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {updateQuorum.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Confirmar quórum y continuar
      </button>
    </div>
  );
}

// ── Paso 4: Debates ──────────────────────────────────────────────────────────

interface DebatePunto {
  punto: string;
  notas: string;
  materia?: string;
  tipo?: MateriaClase;
  origin?: AgendaPointOrigin;
  source_table?: string | null;
  source_id?: string | null;
  source_index?: number | null;
  agreement_id?: string | null;
  group_campaign_id?: string | null;
  group_campaign_step?: string | null;
  /** Codex P1 #2 fix: kind propagado desde fuente (convocatoria JSON, agenda_items, etc.). */
  kind?: AgendaItemKind | null;
  /** Codex P2 round 6: decision_subtype para materialización on-demand del agenda_item. */
  decision_subtype?: AgendaDecisionSubtype | null;
}

function DebatesStep({ meetingId }: { meetingId?: string }) {
  const { tenantId } = useTenantContext();
  const { data: meeting } = useReunionById(meetingId);
  const { data: agendaSources = [], isLoading: agendaSourcesLoading } = useMeetingAgendaSources(meetingId);
  const { data: agendaKindRows = [] } = useAgendaItemsKind(meetingId);
  useAgendaItemRealtimeSubscription(meetingId);
  const kindIndex = useMemo(() => {
    const map = new Map<string, AgendaItemKind>();
    for (const row of agendaKindRows) {
      map.set(row.id, normalizeAgendaItemKind(row.kind));
    }
    return map;
  }, [agendaKindRows]);
  const existingQD = (meeting as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data;
  const existingDebates = useMemo(
    () => (existingQD?.debates ?? []) as DebatePunto[],
    [existingQD?.debates],
  );
  const meetingRaw = meeting as
    | { governing_bodies?: { body_type?: string | null; config?: Record<string, unknown> | null } | null }
    | null
    | undefined;
  const organoTipo = resolveOrganoTipo(meetingRaw?.governing_bodies);
  const universalLabel = universalMeetingLabel(organoTipo);
  const universalNamespace = universalMeetingNamespace(organoTipo);
  const isUniversalMeeting = isUniversalMeetingQuorumData(existingQD);
  const existingAcceptance = recordAt(existingQD, "aceptacion_unanime_orden_dia");

  const updateQuorum = useUpdateQuorumData(meetingId);
  const saveConstancias = useReplaceAgendaItemConstancias(meetingId);
  const materializeAgendaItem = useMaterializeAgendaItem();

  const [debates, setDebates] = useState<DebatePunto[]>([newSessionAgendaPoint()]);
  const [universalAcceptanceConfirmed, setUniversalAcceptanceConfirmed] = useState(
    existingAcceptance.confirmada === true,
  );
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (meeting === undefined) return;
    if (agendaSourcesLoading) return;
    const initialDebates = agendaSources.length > 0 ? agendaSources : existingDebates;
    if (initialDebates.length > 0) {
      setDebates(
        initialDebates.map((debate) => {
          const materia = debate.materia ?? defaultMateriaForTitle(debate.punto);
          return {
            ...debate,
            materia,
            tipo: debate.tipo ?? materiaClaseFromMateria(materia),
            origin: debate.origin ?? "MEETING_FLOOR",
          };
        })
      );
    }
    setInitialized(true);
  }, [agendaSources, agendaSourcesLoading, initialized, meeting, existingDebates]);

  function addPunto() {
    setDebates((prev) => [...prev, newSessionAgendaPoint()]);
  }

  function removePunto(idx: number) {
    setDebates((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePunto(idx: number, field: keyof DebatePunto, val: string) {
    setDebates((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        if (field === "materia") {
          return { ...d, materia: val, tipo: materiaClaseFromMateria(val) };
        }
        if (field === "tipo") {
          return { ...d, tipo: normalizeMateriaClase(val) };
        }
        return { ...d, [field]: val };
      })
    );
  }

  async function handleSave() {
    const debatesForSave: MeetingAgendaPoint[] = debates
      .filter((debate) => debate.punto.trim())
      .map((debate, index) => ({
        ...debate,
        materia: debate.materia ?? defaultMateriaForTitle(debate.punto),
        tipo: normalizeMateriaClase(debate.tipo),
        kind: resolvePointKind(debate, kindIndex),
        origin: debate.origin ?? "MEETING_FLOOR",
        source_index: index + 1,
      }));
    const constancias: AgendaItemConstanciaInput[] = [];

    if (isUniversalMeeting && debatesForSave.length === 0) {
      toast.error(`Añade al menos un punto del orden del día para la ${universalLabel}.`);
      return;
    }
    if (isUniversalMeeting && !universalAcceptanceConfirmed) {
      toast.error("Confirma la aceptación unánime de la celebración y del orden del día.");
      return;
    }

    try {
      for (let index = 0; index < debatesForSave.length; index += 1) {
        const point = debatesForSave[index];
        const kind = resolvePointKind(point, kindIndex);
        if (!meetingId || !tenantId) {
          throw new Error("No se puede guardar el punto: falta contexto de reunión.");
        }

        const existingAgendaItemId =
          point.source_table === "agenda_items" && point.source_id ? point.source_id : null;
        const agendaItemId =
          existingAgendaItemId ??
          await materializeAgendaItem.mutateAsync({
            meetingId,
            tenantId,
            orderNumber: index + 1,
            title: point.punto,
            kind,
            decisionSubtype: point.decision_subtype ?? null,
          });

        if (existingAgendaItemId) {
          const persistedKind = kindIndex.get(existingAgendaItemId);
          const updatePayload: Record<string, unknown> = {
            title: point.punto,
            description: point.notas || null,
            decision_subtype: kind === "DECISORIO" ? point.decision_subtype ?? null : null,
          };
          if (persistedKind !== kind) {
            updatePayload.kind = kind;
          }
          const { error: agendaUpdateError } = await supabase
            .from("agenda_items")
            .update(updatePayload)
            .eq("tenant_id", tenantId)
            .eq("id", existingAgendaItemId);
          if (agendaUpdateError) throw agendaUpdateError;
        }

        debatesForSave[index] = {
          ...point,
          kind,
          source_table: "agenda_items",
          source_id: agendaItemId,
          source_index: index + 1,
        };
        if (kind === "DECISORIO") continue;
        constancias.push({
          agenda_item_id: agendaItemId,
          kind,
          summary: buildAgendaConstanciaSummary({
            kind,
            title: point.punto,
            notes: point.notas,
          }),
          participants: [],
          follow_ups: [],
          attachments: [],
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al preparar constancias");
      return;
    }

    let latestQD = existingQD ?? null;
    if (meetingId && tenantId) {
      const { data, error } = await supabase
        .from("meetings")
        .select("quorum_data")
        .eq("id", meetingId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      latestQD = (data as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? latestQD;
    }
    const qd: Record<string, unknown> = {
      ...patchQuorumDataSourceLinks(latestQD, sourceLinksFromAgendaPoints(debatesForSave)),
      debates: debatesForSave,
    };
    const universalRulePack = recordAt(recordAt(latestQD, "rule_pack"), universalNamespace);
    const capitalPct =
      typeof universalRulePack === "object"
        ? Number(universalRulePack.capital_concurrente_porcentaje ?? 100)
        : 100;
    const nextQd = isUniversalMeeting
      ? patchUniversalAgendaAcceptance(
          qd,
          debatesForSave.map((point, index) => ({
            numero: index + 1,
            titulo: point.punto,
            materia: point.materia,
            texto_acuerdo: point.notas || null,
            kind: point.kind ?? resolvePointKind(point, kindIndex),
            agreement_id: point.agreement_id ?? null,
          })),
          Number.isFinite(capitalPct) ? capitalPct : 100,
        )
      : qd;
    try {
      await updateQuorum.mutateAsync(nextQd);
      await saveConstancias.mutateAsync(constancias);
      toast.success("Agenda, debate y constancias guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar agenda y constancias");
    }
  }

  const savingDebates =
    updateQuorum.isPending ||
    saveConstancias.isPending ||
    materializeAgendaItem.isPending;
  const hasUniversalSpecialDocumentationMatter = isUniversalMeeting && debates.some((debate) =>
    UNIVERSAL_SPECIAL_DOCUMENTATION_MATERIAS.has(debate.materia ?? defaultMateriaForTitle(debate.punto))
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        {isUniversalMeeting
          ? `Añade el orden del día aceptado por unanimidad en el acto de constitución. No se solicitan datos de convocatoria porque la ${universalLabel} nace directamente de la reunión.`
          : "Revisa la agenda formal, las propuestas preparadas y los puntos que nazcan durante la sesión. El origen queda guardado para explicar si el acuerdo venía preparado, de convocatoria o nació en sala."}
      </p>

      {agendaSourcesLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando agenda preparada…
        </div>
      )}

      {hasUniversalSpecialDocumentationMatter ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Esta materia normalmente exige puesta a disposición previa de documentación. En una reunión universal,
            verifica que todos los asistentes disponen de la información necesaria antes de aceptar el orden del día.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {debates.map((d, idx) => (
          <div
            key={idx}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                  Punto {idx + 1}
                </span>
                <KindChip kind={resolvePointKind(d, kindIndex)} />
                <span
                  className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {AGENDA_ORIGIN_LABELS[d.origin ?? "MEETING_FLOOR"]}
                </span>
                {d.agreement_id ? (
                  <span
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Propuesta vinculada
                  </span>
                ) : null}
              </div>
              {debates.length > 1 && (d.origin ?? "MEETING_FLOOR") === "MEETING_FLOOR" && (
                <button
                  type="button"
                  onClick={() => removePunto(idx)}
                  aria-label={`Eliminar punto ${idx + 1}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--status-error)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                    Tipo de punto
                  </label>
                  <select
                    value={resolvePointKind(d, kindIndex)}
                    onChange={(e) => updatePunto(idx, "kind", e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    title={
                      AGENDA_KIND_OPTIONS.find((option) => option.value === resolvePointKind(d, kindIndex))
                        ?.helper ?? "Naturaleza del punto"
                    }
                  >
                    {AGENDA_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                    Materia o ámbito
                  </label>
                  <select
                    value={d.materia ?? "APROBACION_CUENTAS"}
                    onChange={(e) => updatePunto(idx, "materia", e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    {AGENDA_MATERIAS.map((materia) => (
                      <option key={materia.value} value={materia.value}>
                        {materia.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                    Clase de acuerdo
                  </label>
                  <select
                    value={d.tipo ?? materiaClaseFromMateria(d.materia ?? "APROBACION_CUENTAS")}
                    onChange={(e) => updatePunto(idx, "tipo", e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="ORDINARIA">Ordinaria</option>
                    <option value="ESTATUTARIA">Estatutaria</option>
                    <option value="ESTRUCTURAL">Estructural</option>
                    <option value="ESPECIAL">Especial</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                  Título / descripción del punto
                </label>
                <input
                  type="text"
                  value={d.punto}
                  onChange={(e) => updatePunto(idx, "punto", e.target.value)}
                  placeholder="p.ej. Aprobación de cuentas anuales ejercicio 2025"
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                {isUniversalMeeting ? "Descripción / propuesta de acuerdo" : "Notas del secretario"}
                </label>
                <textarea
                  value={d.notas}
                  onChange={(e) => updatePunto(idx, "notas", e.target.value)}
                  rows={3}
                  placeholder="Resumen del debate, intervenciones relevantes, acuerdos adoptados en este punto…"
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPunto}
        className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Plus className="h-4 w-4" />
        {isUniversalMeeting ? "Añadir punto del orden del día" : "Añadir punto nacido en sesión"}
      </button>

      {isUniversalMeeting ? (
        <label
          className="flex items-start gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <input
            type="checkbox"
            checked={universalAcceptanceConfirmed}
            onChange={(event) => setUniversalAcceptanceConfirmed(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--g-brand-3308)]"
          />
          <span>
            {universalAcceptanceText(organoTipo)}
          </span>
        </label>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={
          savingDebates ||
          debates.every((d) => !d.punto.trim()) ||
          (isUniversalMeeting && !universalAcceptanceConfirmed)
        }
        aria-busy={savingDebates}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {savingDebates ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Guardar debates
      </button>
    </div>
  );
}

// ── Paso 5: Votaciones ───────────────────────────────────────────────────────

function patchUniversalVotingMetadata(
  quorumData: Record<string, unknown>,
  agendaPoints: Array<{
    punto: string;
    notas?: string | null;
    materia?: string | null;
    agreement_id?: string | null;
  }>,
  snapshots: MeetingAdoptionSnapshot[],
) {
  const meetings = recordAt(quorumData, "meetings");
  const junta = recordAt(meetings, "junta");
  const rulePack = recordAt(quorumData, "rule_pack");
  const conflictCount = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.vote_summary.conflict_excluded,
    0,
  );
  const pactosAplicables = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.pacto_compliance.pactos_aplicables,
    0,
  );
  const pactosIncumplidos = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.pacto_compliance.pactos_incumplidos,
    0,
  );
  const puntos = agendaPoints.map((point, index) => {
    const snapshot = snapshots.find((item) => item.agenda_item_index === index + 1);
    const mayoria =
      snapshot?.societary_validity.explain[snapshot.societary_validity.explain.length - 1]?.mensaje ??
      snapshot?.societary_validity.explain[0]?.mensaje ??
      null;
    const input: UniversalVotePointInput = {
      numero: index + 1,
      titulo: point.punto,
      materia: point.materia ?? snapshot?.materia ?? null,
      texto_acuerdo: point.notas?.trim() || snapshot?.resolution_text || null,
      votos_favor: snapshot?.vote_summary.favor ?? null,
      votos_contra: snapshot?.vote_summary.contra ?? null,
      abstenciones: snapshot?.vote_summary.abstenciones ?? null,
      votos_nulos: snapshot?.vote_summary.en_blanco ?? null,
      mayoria_descripcion: mayoria,
      rule_pack_ref:
        snapshot?.rule_trace?.rule_pack_id ??
        snapshot?.rule_trace?.ruleset_snapshot_id ??
        null,
      agreement_id: snapshot?.agreement_id ?? point.agreement_id ?? null,
      proclamacion:
        snapshot?.status_resolucion === "ADOPTED"
          ? "APROBADO"
          : snapshot?.status_resolucion === "REJECTED"
            ? "RECHAZADO"
            : null,
    };
    return buildUniversalAgendaPoint(input);
  });

  return {
    ...quorumData,
    meetings: {
      ...meetings,
      junta: {
        ...junta,
        puntos,
      },
    },
    rule_pack: {
      ...rulePack,
      conflictos: {
        ...recordAt(rulePack, "conflictos"),
        estado_resumen:
          conflictCount > 0
            ? `${formatVoteWeight(conflictCount)} voto(s)/capital excluido(s) por conflicto en los puntos evaluados`
            : "Sin conflictos declarados",
      },
      pactos: {
        ...recordAt(rulePack, "pactos"),
        estado_resumen:
          pactosAplicables > 0
            ? `${pactosAplicables} pacto(s) aplicable(s), ${pactosIncumplidos} incumplimiento(s) contractual(es)`
            : "Sin pactos parasociales relevantes identificados",
      },
    },
  };
}

const ENGINE_V2 = true;

function VotacionesStep({ meetingId }: { meetingId?: string }) {
  const { tenantId } = useTenantContext();
  const { data: meetingForDebates } = useReunionById(meetingId);
  const { data: agendaSources = [] } = useMeetingAgendaSources(meetingId);
  const { data: agendaKindRows = [] } = useAgendaItemsKind(meetingId);
  useAgendaItemRealtimeSubscription(meetingId);
  const { data: existingResolutions = [] } = useReunionResolutions(meetingId);
  const saveResolutions = useSaveMeetingResolutions(meetingId);
  const updateQuorumData = useUpdateQuorumData(meetingId);
  const [resolutionsSaved, setResolutionsSaved] = useState(false);
  const [snapshotOnlySaved, setSnapshotOnlySaved] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [reclassifyTargetIndex, setReclassifyTargetIndex] = useState<number | null>(null);
  // Codex P2 round 6: cuando un punto procede de convocatoria, no existe row
  // en agenda_items. El RPC reclassify_agenda_item_kind requiere un id real,
  // así que materializamos on-demand. Mantenemos el id resuelto aquí para
  // pasarlo al dialog sin esperar a que la query invalidation refresque
  // agendaPoints (que ocurriría un tick después).
  const [pendingAgendaItemId, setPendingAgendaItemId] = useState<string | null>(null);
  const [materializingIndex, setMaterializingIndex] = useState<number | null>(null);
  const materializeAgendaItem = useMaterializeAgendaItem();
  const [votesByPoint, setVotesByPoint] = useState<
    Record<number, Record<string, Pick<VoterRow, "vote" | "conflict_flag" | "conflict_reason">>>
  >({});

  const kindIndex = useMemo(() => {
    const map = new Map<string, AgendaItemKind>();
    for (const row of agendaKindRows) {
      map.set(row.id, normalizeAgendaItemKind(row.kind));
    }
    return map;
  }, [agendaKindRows]);

  const { data: meetingContext } = useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["secretaria", tenantId, "meetings", meetingId, "votaciones"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ entityId: string | null; voters: MeetingVoterRow[] }> => {
      const [meetingRes, attendeesRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("governing_bodies(entity_id)")
          .eq("tenant_id", tenantId!)
          .eq("id", meetingId!)
          .maybeSingle(),
        supabase
          .from("meeting_attendees")
          .select("id, person_id, attendance_type, capital_representado, shares_represented, voting_rights, person:person_id(full_name)")
          .eq("tenant_id", tenantId!)
          .eq("meeting_id", meetingId!)
          .order("attendance_type", { ascending: true }),
      ]);

      if (meetingRes.error) throw meetingRes.error;
      if (attendeesRes.error) throw attendeesRes.error;

      type MeetingRaw = { governing_bodies?: { entity_id?: string | null } | null } | null;
      type AttendeeRaw = {
        id: string;
        person_id: string | null;
        attendance_type: string | null;
        capital_representado: number | null;
        shares_represented: number | null;
        voting_rights: number | null;
        person?: { full_name?: string | null } | null;
      };

      const voters = ((attendeesRes.data ?? []) as AttendeeRaw[])
        .map((a) => ({
          id: a.id,
          person_id: a.person_id,
          attendance_type: a.attendance_type ?? null,
          capital_representado: a.capital_representado ?? null,
          shares_represented: a.shares_represented ?? null,
          voting_rights: a.voting_rights ?? null,
          person_name: a.person?.full_name ?? null,
        }))
        // ITEM-028/037: voting_rights=0 marca asistentes con voz sin voto
        // (secretario no consejero) — no son votantes (art. 248.1 LSC).
        .filter((v) => v.voting_rights === null || Number(v.voting_rights) !== 0);
      const presentVoters = voters.filter((v) => v.attendance_type !== "AUSENTE");

      return {
        entityId: ((meetingRes.data as MeetingRaw)?.governing_bodies?.entity_id ?? null),
        voters: presentVoters.length > 0 ? presentVoters : voters,
      };
    },
  });

  const activeConflictScope = meetingId ? (meetingContext?.entityId ?? null) : undefined;
  const { data: activeConflicts = EMPTY_ACTIVE_CONFLICTS, isLoading: activeConflictsLoading } =
    useActiveConflicts(activeConflictScope);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const activeConflictPersonIds = useMemo(
    () =>
      new Set(
        activeConflicts
          .map((c) => c.person_id)
          .filter((pid): pid is string => Boolean(pid))
      ),
    [activeConflicts]
  );

  useEffect(() => {
    const nextVoters =
      meetingContext && meetingContext.voters.length > 0
        ? meetingContext.voters.map((v) => ({
            id: v.id,
            person_id: v.person_id,
            name: formatMeetingVoterName(v),
            attendance_type: v.attendance_type,
            capital_representado: v.capital_representado,
            shares_represented: v.shares_represented,
            voting_rights: v.voting_rights,
            vote: "" as VoteValue,
            conflict_flag: v.person_id ? activeConflictPersonIds.has(v.person_id) : false,
            conflict_reason: v.person_id && activeConflictPersonIds.has(v.person_id)
              ? "Conflicto activo registrado en el expediente — revisar si afecta a este punto (arts. 190 y 228.c LSC)"
              : "",
          }))
        : [];

    setVoters((prev) =>
      nextVoters.map((next) => {
        const existing = prev.find(
          (cur) =>
            cur.id === next.id ||
            (next.person_id !== null && cur.person_id === next.person_id)
        );
        const forcedConflict = next.person_id ? activeConflictPersonIds.has(next.person_id) : false;
        return existing
          ? {
              ...next,
              vote: existing.vote,
              conflict_flag: forcedConflict || existing.conflict_flag,
              conflict_reason: forcedConflict
                ? existing.conflict_reason || next.conflict_reason || "Conflicto activo registrado en el expediente"
                : existing.conflict_reason,
            }
          : next;
      })
    );
  }, [activeConflictPersonIds, meetingContext]);

  const agendaPoints = useMemo(() => {
    const debates = (
      (meetingForDebates as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data
        ?.debates ?? []
    ) as DebatePunto[];
    const formalAgenda = agendaSources.length > 0 ? agendaSources : debates;
    const normalized =
      formalAgenda.length > 0
        ? formalAgenda.map((debate) => {
            const materia = debate.materia ?? defaultMateriaForTitle(debate.punto);
            return {
              ...debate,
              punto: debate.punto || "Acuerdo de la sesión",
              materia,
              tipo: debate.tipo ?? materiaClaseFromMateria(materia),
              origin: debate.origin ?? "MEETING_FLOOR",
            };
          })
        : [
            {
              punto: "Acuerdo de la sesión",
              notas: "",
              materia: "APROBACION_CUENTAS",
              tipo: "ORDINARIA" as MateriaClase,
              origin: "MEETING_FLOOR" as AgendaPointOrigin,
            },
          ];
    return normalized;
  }, [agendaSources, meetingForDebates]);

  // Task 8: índice original→{punto, kind, agendaItemId}. El contrato del motor
  // `evaluarPuntoOrdenDia` decide qué puntos ejecutan FULL_GATE de acuerdo.
  // Los demás se muestran en sección aparte con CTA "Reclasificar a DECISORIO".
  const pointKinds = useMemo(
    () => agendaPoints.map((p) => resolvePointKind(p, kindIndex)),
    [agendaPoints, kindIndex],
  );
  const agendaItemEvaluations = useMemo(
    () =>
      agendaPoints.map((point, index) =>
        evaluarPuntoOrdenDia({
          kind: pointKinds[index],
          title: point.punto,
          orderNumber: index + 1,
          hasAgreement: Boolean(point.agreement_id),
        }),
      ),
    [agendaPoints, pointKinds],
  );
  const votablePointIndices = useMemo(
    () => agendaPoints.map((_, i) => i).filter((i) => agendaItemEvaluations[i]?.shouldRunAgreementGates),
    [agendaItemEvaluations, agendaPoints],
  );
  const nonVotablePointIndices = useMemo(
    () => agendaPoints.map((_, i) => i).filter((i) => !agendaItemEvaluations[i]?.shouldRunAgreementGates),
    [agendaItemEvaluations, agendaPoints],
  );

  const meetingRaw = meetingForDebates as
    | {
        status?: string | null;
        quorum_data?: (Record<string, unknown> & { is_universal?: boolean }) | null;
        governing_bodies?: {
          body_type?: string | null;
          entity_id?: string | null;
          quorum_rule?: Record<string, unknown> | null;
          entities?: { legal_form?: string | null; tipo_social?: string | null } | null;
        } | null;
      }
    | null;
  const tipoSocial = toTipoSocial(
    meetingRaw?.governing_bodies?.entities?.tipo_social ??
      meetingRaw?.governing_bodies?.entities?.legal_form
  );
  const organoTipo = resolveOrganoTipo(meetingRaw?.governing_bodies);
  const entityId = meetingRaw?.governing_bodies?.entity_id ?? meetingContext?.entityId ?? null;
  // Datos para matriz P7 del diálogo de reclasificación
  const meetingStatusForMatrix = meetingRaw?.status ?? "DRAFT";
  const bodyTypeForMatrix = meetingRaw?.governing_bodies?.body_type ?? undefined;
  const isUniversalForMatrix =
    meetingRaw?.quorum_data?.is_universal === true ? true : undefined;
  const votoCalidadHabilitado = votoCalidadHabilitadoPorOrgano(
    organoTipo,
    meetingRaw?.governing_bodies?.quorum_rule ?? null
  );
  // ITEM-017/039: para dirimir empates con voto de calidad el motor necesita
  // el SENTIDO del voto del presidente del órgano.
  const bodyIdForVotes = (meetingForDebates as { body_id?: string | null } | null)?.body_id ?? undefined;
  const { data: bodyMembersForVotes = [] } = useBodyMembers(bodyIdForVotes);
  const presidentPersonIds = useMemo(
    () =>
      new Set(
        bodyMembersForVotes
          .filter((m) => m.tipo_condicion === "PRESIDENTE")
          .map((m) => m.person_id)
      ),
    [bodyMembersForVotes]
  );
  const quorumData = meetingRaw?.quorum_data ?? null;
  const savedQuorumForVote = quorumData?.quorum as { reached?: boolean } | undefined;
  const quorumReachedForVote = savedQuorumForVote?.reached === true;
  const ruleSpecsForVotes = uniqueMeetingRuleSpecs(
    agendaPoints.map((point) => ({
      materia: point.materia ?? defaultMateriaForTitle(point.punto),
      clase: normalizeMateriaClase(point.tipo),
    }))
  );
  const { data: ruleResolutions = [] } = useRuleResolutions({
    materias: ruleSpecsForVotes,
    entityId,
    organoTipo,
  });
  const { data: pactosVigentes = [] } = usePactosVigentes(entityId ?? undefined);
  const voteRuleContext = resolvePrototypeMeetingRulePacks(ruleSpecsForVotes, ruleResolutions, organoTipo);
  const strictVoteRuleContext = resolveCloudMeetingRulePacksStrict(ruleSpecsForVotes, ruleResolutions, organoTipo);
  const votePacks = voteRuleContext.packs;
  const strictVotePacks = strictVoteRuleContext.packs;
  const voteOverrides = selectedOverrides(ruleResolutions);

  const selectedPoint = agendaPoints[selectedPointIndex] ?? agendaPoints[0];

  useEffect(() => {
    if (selectedPointIndex > agendaPoints.length - 1) {
      setSelectedPointIndex(Math.max(agendaPoints.length - 1, 0));
    }
  }, [agendaPoints.length, selectedPointIndex]);

  // Task 8: si el índice actual no es DECISORIO, reapuntar al primer votable
  // disponible para que el formulario de voto solo opere sobre DECIS.
  useEffect(() => {
    if (votablePointIndices.length === 0) return;
    if (!votablePointIndices.includes(selectedPointIndex)) {
      setSelectedPointIndex(votablePointIndices[0]);
    }
  }, [votablePointIndices, selectedPointIndex]);

  function rowForPoint(voter: VoterRow, pointIndex = selectedPointIndex): VoterRow {
    const pointState = votesByPoint[pointIndex]?.[voter.id];
    return pointState ? { ...voter, ...pointState } : voter;
  }

  function pointRows(pointIndex = selectedPointIndex) {
    return voters.map((voter) => rowForPoint(voter, pointIndex));
  }

  function update(id: string, patch: Partial<VoterRow>) {
    // ITEM-041: el conflicto registrado PRE-MARCA el flag pero no lo impone.
    // Arts. 190.1 (privación solo en supuestos tasados y para el acuerdo
    // afectado), 190.3 (no priva del voto) y 228.c LSC (abstención en los
    // acuerdos afectados): la decisión es por punto y la toma el secretario.
    setVotesByPoint((prev) => {
      const currentPoint = prev[selectedPointIndex] ?? {};
      const existing = currentPoint[id] ?? { vote: "" as VoteValue, conflict_flag: false, conflict_reason: "" };
      const nextConflictFlag = patch.conflict_flag ?? existing.conflict_flag;
      const nextConflictReason = patch.conflict_reason ?? existing.conflict_reason;
      return {
        ...prev,
        [selectedPointIndex]: {
          ...currentPoint,
          [id]: {
            vote: patch.vote ?? existing.vote,
            conflict_flag: nextConflictFlag,
            conflict_reason: nextConflictReason,
          },
        },
      };
    });
  }

  function applyUnanimousFastTrack() {
    if (!hasPersistentVoters || votablePointIndices.length === 0) return;
    setVotesByPoint((prev) => {
      const next = { ...prev };
      for (const pointIndex of votablePointIndices) {
        const currentPoint = next[pointIndex] ?? {};
        const votesForPoint: Record<
          string,
          Pick<VoterRow, "vote" | "conflict_flag" | "conflict_reason">
        > = {};
        for (const voter of voters) {
          const hasActiveConflict =
            !activeConflictsLoading && voter.person_id ? activeConflictPersonIds.has(voter.person_id) : false;
          votesForPoint[voter.id] = hasActiveConflict
            ? {
                vote: "",
                conflict_flag: true,
                conflict_reason:
                  currentPoint[voter.id]?.conflict_reason ||
                  "Conflicto activo registrado en el expediente; excluido del acuerdo por unanimidad.",
              }
            : {
                vote: "FAVOR",
                conflict_flag: false,
                conflict_reason: "",
              };
        }
        next[pointIndex] = { ...currentPoint, ...votesForPoint };
      }
      return next;
    });
    toast.success("Todos los puntos decisorios quedan marcados como aprobados por unanimidad");
  }

  const currentVoters = pointRows();

  function missingStrictSpecLabelsForPoint(pointIndex: number) {
    const point = agendaPoints[pointIndex] ?? agendaPoints[0];
    const materia = point.materia ?? defaultMateriaForTitle(point.punto);
    const clase = normalizeMateriaClase(point.tipo);
    return strictVoteRuleContext.missingSpecs
      .filter((spec) => spec.materia === materia && spec.clase === clase)
      .map((spec) => `${organoTipo}:${spec.materia}:${spec.clase}`);
  }

  function ruleResolutionForPoint(pointIndex: number): RuleResolution | null {
    const point = agendaPoints[pointIndex] ?? agendaPoints[0];
    const materia = point.materia ?? defaultMateriaForTitle(point.punto);
    const clase = normalizeMateriaClase(point.tipo);
    return ruleResolutions.find((resolution) => {
      const pack = resolution.rulePack;
      if (!pack || !isMeetingRulePackPayload(pack.payload)) return false;
      const materiaMatches = pack.materia === materia || pack.packId === materia;
      const claseMatches = !pack.clase || pack.clase === clase;
      const organoMatches = !pack.organoTipo || pack.organoTipo === organoTipo;
      return materiaMatches && claseMatches && organoMatches;
    }) ?? null;
  }

  function ruleTraceForPoint(pointIndex: number): MeetingAdoptionRuleTrace {
    const resolution = ruleResolutionForPoint(pointIndex);
    if (resolution?.rulePack && resolution.rulesetSnapshotId) {
      return {
        source: "V2_CLOUD",
        rule_pack_id: resolution.rulePack.packId,
        rule_pack_version_id: resolution.rulePack.versionId,
        rule_pack_version: resolution.rulePack.version,
        payload_hash: resolution.rulePack.payloadHash,
        ruleset_snapshot_id: resolution.rulesetSnapshotId,
        warnings: resolution.warnings,
      };
    }

    return {
      source: "PROTOTYPE_FALLBACK",
      rule_pack_id: null,
      rule_pack_version_id: null,
      rule_pack_version: null,
      payload_hash: null,
      ruleset_snapshot_id: null,
      warnings: missingStrictSpecLabelsForPoint(pointIndex).map((label) => `missing_cloud_rule_pack:${label}`),
    };
  }

  function buildSnapshotForPoint(pointIndex: number, mode: "operational" | "cloud_strict" = "operational") {
    const point = agendaPoints[pointIndex] ?? agendaPoints[0];
    const rowsForPoint = pointRows(pointIndex);
    const materia = point.materia ?? defaultMateriaForTitle(point.punto);
    const explicitVotingData = rowsForPoint.some((voter) => {
      const raw = voter.voting_rights ?? voter.capital_representado ?? voter.shares_represented;
      return typeof raw === "number" && Number.isFinite(raw) && raw > 0;
    });
    const totalWeight = rowsForPoint.reduce(
      (sum, voter) => sum + votingWeightFor(voter, organoTipo),
      0
    );
    const capitalTotal =
      organoTipo === "JUNTA_GENERAL"
        ? explicitVotingData
          ? Math.max(100, totalWeight)
          : Math.max(totalWeight, 1)
        : Math.max(rowsForPoint.length, 1);

    const adoptionMode = isUniversalMeetingQuorumData(quorumData) ? "UNIVERSAL" : "MEETING";
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: pointIndex + 1,
      resolutionText: point.punto || "Acuerdo de la sesión",
      materia,
      materiaClase: normalizeMateriaClase(point.tipo),
      tipoSocial,
      organoTipo,
      adoptionMode,
      // ITEM-016/038: la llamada (1ª/2ª convocatoria) se declara en el paso
      // de quórum y queda persistida en quorum_data.quorum.
      primeraConvocatoria:
        (quorumData?.quorum as { convocatoria_llamada?: string } | undefined)
          ?.convocatoria_llamada !== "SEGUNDA",
      quorumReached: quorumReachedForVote,
      voters: rowsForPoint.map((voter) => ({
        id: voter.id,
        person_id: voter.person_id,
        name: voter.name,
        vote: voter.vote,
        conflict_flag: voter.conflict_flag,
        conflict_reason: voter.conflict_reason,
        voting_weight: votingWeightFor(voter, organoTipo),
      })),
      // ITEM-009/036: total = tamaño real del órgano (vocales del censo);
      // concurrentes aparte. Antes total era el nº de presentes, falseando
      // voting_context.total_miembros y las fórmulas sobre el total.
      totalMiembros:
        organoTipo === "JUNTA_GENERAL"
          ? Math.max(voters.length, rowsForPoint.length, 1)
          : Math.max(
              bodyMembersForVotes.filter((m) => m.es_vocal).length,
              voters.length,
              rowsForPoint.length,
              1
            ),
      miembrosPresentes: rowsForPoint.length,
      capitalTotal,
      // ITEM-019: señala si capitalTotal son datos REALES de capital o un proxy
      // por cabezas. En consejo la base es por miembros (no aplica); en junta
      // sin datos de capital el motor emite census_not_available.
      capitalDataAvailable: organoTipo !== "JUNTA_GENERAL" || explicitVotingData,
      packs: mode === "cloud_strict" ? strictVotePacks : votePacks,
      overrides: voteOverrides,
      pactos: pactosVigentes,
      votoCalidadHabilitado,
      votoPresidente: (() => {
        const presidentRow = rowsForPoint.find(
          (voter) => voter.person_id && presidentPersonIds.has(voter.person_id)
        );
        const vote = presidentRow?.vote;
        return vote === "FAVOR" || vote === "CONTRA" || vote === "ABSTENCION" ? vote : null;
      })(),
    });

    if (mode === "operational" && voteRuleContext.hasFallback) {
      const warning = `prototype_rule_pack_fallback_used:${voteRuleContext.fallbackPackIds.join(",")}`;
      snapshot.societary_validity.warnings = [
        ...snapshot.societary_validity.warnings,
        warning,
      ];
      snapshot.societary_validity.voting.warnings = [
        ...snapshot.societary_validity.voting.warnings,
        warning,
      ];
    }

    if (mode === "operational") {
      snapshot.rule_trace = ruleTraceForPoint(pointIndex);
    }

    return snapshot;
  }

  function buildDualEvaluationForPoint(pointIndex: number): DualEvaluationComparison {
    const operationalSnapshot = buildSnapshotForPoint(pointIndex, "operational");
    const cloudSnapshot = buildSnapshotForPoint(pointIndex, "cloud_strict");
    const missingSpecs = missingStrictSpecLabelsForPoint(pointIndex);
    return buildMeetingAdoptionDoubleEvaluation({
      operationalSnapshot,
      cloudSnapshot,
      cloudRulePackMissing: missingSpecs.length > 0,
      cloudMissingSpecs: missingSpecs,
    });
  }

  const currentSnapshot = buildSnapshotForPoint(selectedPointIndex);
  const currentDualEvaluation = buildDualEvaluationForPoint(selectedPointIndex);
  const currentVoteCompleteness = evaluateMeetingVoteCompleteness(currentVoters);
  const favor = currentSnapshot.vote_summary.favor;
  const contra = currentSnapshot.vote_summary.contra;
  const abstencion = currentSnapshot.vote_summary.abstenciones;
  const hasPersistentVoters = voters.length > 0;
  // Codex P1 (round 3 fix): VotacionesStep solo renderiza puntos DECISORIO en
  // la UI de votación; los puntos no decisorios no reciben voters/votes y
  // `evaluateMeetingVoteCompleteness` devolvería complete=false para ellos.
  // `allPointsHaveVotes` debe iterar exclusivamente `votablePointIndices`
  // para no bloquear el botón "Registrar resultado" en agendas mixtas.
  //
  // Codex P2 round 6: si NO hay puntos DECISORIO,
  // el botón "Registrar resolución" no tiene sentido — handleSaveResolutions
  // sometería un rows=[] vacío. allPointsHaveVotes ahora retorna false en
  // ese caso para mantener el botón disabled. Una agenda sin decisorios cierra
  // el acta vía el step de generación de documento, no vía resoluciones.
  const allPointsHaveVotes =
    votablePointIndices.length === 0
      ? false
      : hasPersistentVoters &&
        votablePointIndices.every((index) =>
          evaluateMeetingVoteCompleteness(pointRows(index)).complete,
        );

  const hasResolutions = existingResolutions.length > 0 || resolutionsSaved;
  const linkedAgreementCount = existingResolutions.filter((resolution) => resolution.agreement_id).length;
  const existingPointSnapshots = ((quorumData?.point_snapshots ?? []) as MeetingAdoptionSnapshot[]);
  const hasCertifiableExistingSnapshot = existingPointSnapshots.some(
    (snapshot) => snapshot.societary_validity.ok && snapshot.status_resolucion === "ADOPTED"
  );
  const hasBlockedExistingSnapshot =
    existingPointSnapshots.length > 0 && !hasCertifiableExistingSnapshot;
  const hasRejectedExistingResolution = existingResolutions.some(
    (resolution) => resolution.status !== "ADOPTED"
  );
  const canRecalculateExistingResolutions =
    existingResolutions.length > 0 &&
    (linkedAgreementCount === 0 || hasBlockedExistingSnapshot || hasRejectedExistingResolution);

  async function handleSaveResolutions() {
    const snapshots = agendaPoints.map((_, i) => {
      const operationalSnapshot = buildSnapshotForPoint(i, "operational");
      return {
        ...operationalSnapshot,
        dual_evaluation: buildDualEvaluationForPoint(i),
      };
    });
    // Codex P1 (round 3 fix): solo puntos DECISORIO generan rows en
    // `meeting_resolutions`. Los puntos no decisorios se trazan en el acta vía
    // `buildActaPuntosSequencial` (RRM art. 99, orden secuencial). Insertar
    // rows sin votos forzaría a T4 a auto-derivar kind_resolution sobre
    // resoluciones que no son tales (status sin sentido).
    const rows = votablePointIndices.map((i) => {
      const point = agendaPoints[i];
      const rowsForPoint = pointRows(i);
      const snapshot = snapshots[i];
      const materia = point.materia ?? defaultMateriaForTitle(point.punto);
      const tipo = normalizeMateriaClase(point.tipo);
      return {
        agenda_item_index: i + 1,
        resolution_text: point.punto,
        resolution_type: tipo,
        status: snapshot.status_resolucion,
        required_majority_code: `${materia}:${tipo}`,
        agreement_id: point.agreement_id ?? null,
        agreement_origin: agreementOriginForPoint(point),
        adoption_snapshot: snapshot,
        votes: rowsForPoint
          .filter((v) => v.vote !== "")
          .map((v) => ({
            attendee_id: v.person_id ? v.id : null,
            vote_value: v.vote,
            conflict_flag: v.conflict_flag,
            reason: v.conflict_reason.trim() || null,
          })),
      };
    });

    try {
      const savedPoints = await saveResolutions.mutateAsync(rows);
      const agreementIdByAgendaIndex = new Map(
        savedPoints.map((point) => [point.agenda_item_index, point.agreement_id])
      );
      const enrichedSnapshots = snapshots.map((snapshot) => {
        const savedPoint = savedPoints.find(
          (point) => point.agenda_item_index === snapshot.agenda_item_index
        );
        return savedPoint?.adoption_snapshot ?? snapshot;
      });
      const agendaPointsWithAgreements = agendaPoints.map((point, index) => ({
        punto: point.punto,
        notas: point.notas ?? "",
        materia: point.materia ?? defaultMateriaForTitle(point.punto),
        tipo: normalizeMateriaClase(point.tipo),
        origin: point.origin ?? "MEETING_FLOOR",
        source_table: point.source_table ?? null,
        source_id: point.source_id ?? null,
        source_index: point.source_index ?? index + 1,
        agreement_id: agreementIdByAgendaIndex.get(index + 1) ?? point.agreement_id ?? null,
        group_campaign_id: point.group_campaign_id ?? null,
        group_campaign_step: point.group_campaign_step ?? null,
      }));
      const baseQuorumData = {
        ...patchQuorumDataSourceLinks(
          (quorumData ?? {}) as Record<string, unknown>,
          sourceLinksFromAgendaPoints(agendaPointsWithAgreements)
        ),
        point_snapshots: enrichedSnapshots,
      };
      const nextQuorumData = isUniversalMeetingQuorumData(quorumData)
        ? patchUniversalVotingMetadata(baseQuorumData, agendaPointsWithAgreements, enrichedSnapshots)
        : baseQuorumData;

      await updateQuorumData.mutateAsync(nextQuorumData);
      const materialized = savedPoints.filter((point) => Boolean(point.agreement_id)).length;
      setSnapshotOnlySaved(false);
      toast.success(
        `${rows.length} resolución(es) registrada(s); ${materialized} acuerdo(s) 360 materializado(s)`
      );
      setResolutionsSaved(true);
    } catch (e) {
      setSnapshotOnlySaved(false);
      toast.error(e instanceof Error ? e.message : "Error al registrar resoluciones");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra el sentido del voto por cada punto del orden del día. La materia y clase del punto
        se guardan con la resolución para que el motor pueda explicar denominador, mayoría y regla
        aplicable sin mezclar acuerdos distintos.
      </p>

      {votablePointIndices.length === 0 ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-sm text-[var(--g-text-secondary)]">
            No hay puntos clasificados como <KindChip kind="DECISORIO" /> en esta reunión. Solo los
            puntos decisorios pueden votarse. Reclasifica un punto informativo o deliberativo
            usando los botones de la sección siguiente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {votablePointIndices.map((index) => {
                const point = agendaPoints[index];
                const hasVotes = pointRows(index).some((v) => v.vote !== "");
                const active = index === selectedPointIndex;
                const linkedAgreement = existingResolutions.find(
                  (resolution) =>
                    resolution.agenda_item_index === index + 1 && Boolean(resolution.agreement_id),
                );
                return (
                  <button
                    key={`${point.punto}-${index}`}
                    type="button"
                    onClick={() => setSelectedPointIndex(index)}
                    className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--g-brand-3308)] bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                        : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <span>Punto {index + 1}</span>
                    <KindChip kind="DECISORIO" />
                    {hasVotes && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {linkedAgreement && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold ${
                          active
                            ? "bg-[var(--g-text-inverse)] text-[var(--g-brand-3308)]"
                            : "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        360
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={applyUnanimousFastTrack}
              disabled={!hasPersistentVoters || activeConflictsLoading}
              title={
                activeConflictsLoading
                  ? "Cargando conflictos activos antes de aplicar unanimidad"
                  : "Marca voto favorable de todos los votantes elegibles en todos los puntos decisorios"
              }
              className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
              Aprobar todo por unanimidad
            </button>
          </div>
        </div>
      )}

      {nonVotablePointIndices.length > 0 && (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="mb-3 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-info)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--g-text-primary)]">
                Puntos no decisorios — fuera del carril de votación
              </p>
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                Los puntos de constancia, informe, deliberación o ruegos no se someten a votación.
                Si durante la sesión emerge la necesidad de elevar uno a decisorio, reclasifícalo.
                La matriz P7 valida si la elevación es admisible según estado de la reunión y tipo de órgano.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--g-border-subtle)]">
            {nonVotablePointIndices.map((index) => {
              const point = agendaPoints[index];
              const kind = pointKinds[index];
              const existingAgendaItemId =
                point.source_table === "agenda_items" && point.source_id ? point.source_id : null;
              // Codex P2 round 6: ya no chequeamos disabled aquí. Si el punto
              // viene de convocatoria sin agenda_items materializada, hacemos
              // INSERT on-demand antes de abrir el dialog. El usuario solo
              // ve la latencia del INSERT (~100-200ms) sin perder el flujo.
              const isMaterializing =
                materializingIndex === index && materializeAgendaItem.isPending;
              const handleClickReclassify = async () => {
                if (!meetingId || !tenantId) return;
                if (existingAgendaItemId) {
                  setPendingAgendaItemId(existingAgendaItemId);
                  setReclassifyTargetIndex(index);
                  return;
                }
                try {
                  setMaterializingIndex(index);
                  const newId = await materializeAgendaItem.mutateAsync({
                    meetingId,
                    tenantId,
                    orderNumber: index + 1,
                    title: point.punto,
                    kind,
                    decisionSubtype: point.decision_subtype ?? null,
                  });
                  setPendingAgendaItemId(newId);
                  setReclassifyTargetIndex(index);
                } catch (e) {
                  toast.error(
                    `No se pudo materializar el punto en BD: ${e instanceof Error ? e.message : String(e)}`,
                  );
                } finally {
                  setMaterializingIndex(null);
                }
              };
              return (
                <li
                  key={`non-decis-${point.punto}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                      Punto {index + 1}
                    </span>
                    <KindChip kind={kind} />
                    <span className="text-sm text-[var(--g-text-primary)]">{point.punto}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClickReclassify}
                    disabled={isMaterializing}
                    aria-busy={isMaterializing}
                    title={
                      existingAgendaItemId
                        ? "Reclasificar este punto a DECISORIO"
                        : "Punto procedente de convocatoria: se materializará en agenda_items antes de reclasificar (~100 ms)."
                    }
                    className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    {isMaterializing ? "Materializando..." : "Reclasificar a DECISORIO"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {meetingId && reclassifyTargetIndex !== null && agendaPoints[reclassifyTargetIndex] ? (
        (() => {
          const point = agendaPoints[reclassifyTargetIndex];
          const kind = pointKinds[reclassifyTargetIndex];
          // Codex P2 round 6: usar pendingAgendaItemId (id materializado on-demand
          // o existente) en lugar de resolver siempre desde point.source_*.
          // Tras invalidación de queries, agendaPoints se refresca con el id
          // nuevo, pero el primer render del dialog podría llegar antes que el
          // refetch; pendingAgendaItemId garantiza id correcto en el primer paint.
          const resolvedAgendaItemId =
            pendingAgendaItemId ??
            (point.source_table === "agenda_items" && point.source_id ? point.source_id : null);
          return (
            <ReclassifyKindDialog
              open
              agendaItemId={resolvedAgendaItemId}
              meetingId={meetingId}
              currentKind={kind}
              meetingStatus={meetingStatusForMatrix}
              organType={bodyTypeForMatrix}
              isUniversal={isUniversalForMatrix}
              pointTitle={point.punto}
              pointOrderNumber={reclassifyTargetIndex + 1}
              onClose={() => {
                setReclassifyTargetIndex(null);
                setPendingAgendaItemId(null);
              }}
            />
          );
        })()
      ) : null}

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <KindChip kind={pointKinds[selectedPointIndex] ?? "DELIBERATIVO"} />
          <p className="text-sm font-semibold text-[var(--g-text-primary)]">
            {selectedPoint?.punto ?? "Acuerdo de la sesión"}
          </p>
        </div>
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
          {labelMateria(selectedPoint?.materia ?? "APROBACION_CUENTAS")} ·{" "}
          {normalizeMateriaClase(selectedPoint?.tipo)} ·{" "}
          {AGENDA_ORIGIN_LABELS[selectedPoint?.origin ?? "MEETING_FLOOR"]}
          {selectedPoint?.agreement_id ? " · propuesta preparada vinculada" : ""}
        </p>
      </div>

      {voteRuleContext.hasFallback && (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Esta votacion usa fallback tecnico de prototipo porque no hay rule pack Cloud
            aplicable para todos los puntos. El snapshot queda marcado con warning y no se
            considera validacion legal productiva.
          </p>
        </div>
      )}

      {!hasPersistentVoters ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-sm text-[var(--g-text-secondary)]">
            No hay asistentes persistidos con derecho a voto. Guarda la lista real de asistentes
            antes de registrar votos o crear expedientes Acuerdo 360.
          </p>
        </div>
      ) : null}

      {hasPersistentVoters ? (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Miembro
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Voto
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Conflicto
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Motivo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {currentVoters.map((v) => {
              const hasActiveConflict =
                !activeConflictsLoading && v.person_id ? activeConflictPersonIds.has(v.person_id) : false;
              const needsReason = v.vote === "ABSTENCION" || v.conflict_flag;
              return (
                <tr key={v.id} className="transition-colors hover:bg-[var(--g-surface-subtle)]/30">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--g-text-primary)]">
                          {v.name}
                        </span>
                        {hasActiveConflict && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--status-warning)]">
                            <AlertTriangle className="h-3 w-3" />
                            Conflicto de interés activo — valorar exclusión solo en los puntos afectados (arts. 190 y 228.c LSC)
                          </span>
                        )}
                      </div>
                      {v.conflict_flag && (
                        <span
                          className="inline-flex w-fit items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--status-warning)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Conflicto declarado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={v.vote}
                      onChange={(e) => update(v.id, { vote: e.target.value as VoteValue })}
                      className="rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <option value="">— Sin votar —</option>
                      <option value="FAVOR">A favor</option>
                      <option value="CONTRA">En contra</option>
                      <option value="ABSTENCION">Abstención</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={v.conflict_flag}
                        onChange={(e) => update(v.id, { conflict_flag: e.target.checked })}
                        className="h-4 w-4 accent-[var(--g-brand-3308)]"
                      />
                      Conflicto de interés
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {needsReason ? (
                      <input
                        type="text"
                        value={v.conflict_reason}
                        onChange={(e) => update(v.id, { conflict_reason: e.target.value })}
                        placeholder={
                          v.vote === "ABSTENCION"
                            ? "Motivo de la abstención…"
                            : "Motivo del conflicto declarado…"
                        }
                        className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    ) : (
                      <span className="text-xs text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      ) : null}

      <div
        className="flex items-center gap-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <span className="font-medium text-[var(--g-text-primary)]">Resumen:</span>
        <span className="text-[var(--status-success)]">{formatVoteWeight(favor)} a favor</span>
        <span className="text-[var(--status-error)]">{formatVoteWeight(contra)} en contra</span>
        <span className="text-[var(--g-text-secondary)]">{formatVoteWeight(abstencion)} abstenciones</span>
        {currentVoters.filter((v) => v.conflict_flag).length > 0 && (
          <span className="text-[var(--status-warning)]">
            {currentVoters.filter((v) => v.conflict_flag).length} conflicto(s) declarado(s)
          </span>
        )}
      </div>

      {!currentVoteCompleteness.complete || currentVoteCompleteness.ignored_conflict_vote_ids.length > 0 ? (
        <div
          className="space-y-1 border border-[var(--status-warning)] bg-[var(--g-surface-muted)] px-4 py-3 text-xs text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {currentVoteCompleteness.missing_vote_ids.length > 0 ? (
            <p className="font-medium text-[var(--status-warning)]">
              Faltan {currentVoteCompleteness.missing_vote_ids.length} voto(s) expresos en este punto.
            </p>
          ) : null}
          {currentVoteCompleteness.missing_conflict_reason_ids.length > 0 ? (
            <p className="font-medium text-[var(--status-warning)]">
              Faltan motivos en {currentVoteCompleteness.missing_conflict_reason_ids.length} conflicto(s) declarado(s).
            </p>
          ) : null}
          {currentVoteCompleteness.ignored_conflict_vote_ids.length > 0 ? (
            <p>
              Los votos de personas conflictuadas se conservan en pantalla como dato operativo, pero el motor los excluye del denominador legal.
            </p>
          ) : null}
        </div>
      ) : null}

      {ENGINE_V2 && (
        <div className="mt-6 space-y-4">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
              Evaluación de adopción por punto
            </h3>
            <div
              className={`mb-3 border px-3 py-2 text-xs ${
                currentDualEvaluation.converged
                  ? "border-[var(--g-sec-300)] bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                  : "border-[var(--status-warning)] bg-[var(--g-surface-muted)] text-[var(--g-text-primary)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span className="font-semibold">Doble evaluación V1/V2:</span>{" "}
              {currentDualEvaluation.converged
                ? "convergente."
                : "divergente; se conserva el resultado operativo del prototipo y se registra el contraste Cloud estricto."}
              {currentDualEvaluation.divergence ? (
                <span className="ml-1 text-[var(--g-text-secondary)]">
                  {currentDualEvaluation.divergence.message}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Validez societaria
                </p>
                <span
                  className={`mt-2 inline-flex px-2.5 py-1 text-[11px] font-semibold ${snapshotBadgeClass(currentSnapshot)}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {currentSnapshot.societary_validity.ok ? "PROCLAMABLE" : "NO PROCLAMABLE"}
                </span>
                <p className="mt-2 text-xs text-[var(--g-text-primary)]">
                  {currentSnapshot.societary_validity.explain[
                    currentSnapshot.societary_validity.explain.length - 1
                  ]?.mensaje ??
                    currentSnapshot.societary_validity.explain[0]?.mensaje ??
                    "Sin explicación disponible."}
                </p>
                <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  Voto de calidad: {votoCalidadHabilitado ? "habilitado" : "no habilitado"}
                  {currentSnapshot.societary_validity.voting.votoCalidadUsado ? " · usado para desempate" : ""}
                </p>
              </div>
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Denominador y conflictos
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">
                  {formatVoteWeight(currentSnapshot.vote_summary.voting_weight)} computable
                </p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  Excluido por conflicto: {formatVoteWeight(currentSnapshot.vote_summary.conflict_excluded)}
                </p>
              </div>
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Pactos parasociales
                </p>
                <span
                  className={`mt-2 inline-flex px-2.5 py-1 text-[11px] font-semibold ${
                    currentSnapshot.pacto_compliance.ok
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {currentSnapshot.pacto_compliance.ok ? "SIN INCUMPLIMIENTO" : "INCUMPLIMIENTO CONTRACTUAL"}
                </span>
                <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  {currentSnapshot.pacto_compliance.pactos_aplicables} pacto(s) aplicable(s);
                  no alteran la validez societaria salvo estatutarización.
                </p>
              </div>
            </div>

            {(currentSnapshot.societary_validity.blocking_issues.length > 0 ||
              currentSnapshot.pacto_compliance.blocking_issues.length > 0) && (
              <div className="mt-3 space-y-1 border-t border-[var(--g-border-subtle)] pt-3">
                {currentSnapshot.societary_validity.blocking_issues.map((issue) => (
                  <p key={`soc-${issue}`} className="text-xs text-[var(--status-error)]">
                    Societario: {issue}
                  </p>
                ))}
                {currentSnapshot.pacto_compliance.blocking_issues.map((issue) => (
                  <p key={`pacto-${issue}`} className="text-xs text-[var(--status-warning)]">
                    Pacto: {issue}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-[var(--g-border-subtle)] pt-4">
        {snapshotOnlySaved ? (
          <div
            className="flex items-center gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-muted)] px-4 py-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">
              Snapshot legal actualizado para prototipo; la resolución owner queda pendiente de
              normalización. Puede continuar al cierre y certificar con referencia temporal del punto.
            </p>
          </div>
        ) : hasResolutions && !canRecalculateExistingResolutions ? (
          <div
            className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] px-4 py-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">
              {existingResolutions.length > 0 ? existingResolutions.length : "Las"} resoluciones
              ya están registradas; {linkedAgreementCount} expediente(s)
              Acuerdo 360 vinculado(s). Continúa al paso de cierre.
            </p>
          </div>
        ) : null}

        {canRecalculateExistingResolutions && !snapshotOnlySaved ? (
          <div
            className="mb-3 flex items-start gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-muted)] px-4 py-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
            <p className="text-sm text-[var(--g-text-secondary)]">
              Hay resoluciones operativas sin expediente Acuerdo 360 o con snapshot no
              proclamable. Puede recalcular la votación para crear o actualizar el expediente
              canónico con el snapshot legal actual.
            </p>
          </div>
        ) : null}

        {(!hasResolutions || canRecalculateExistingResolutions) && !snapshotOnlySaved ? (
          <button
            type="button"
            onClick={handleSaveResolutions}
            disabled={saveResolutions.isPending || updateQuorumData.isPending || !hasPersistentVoters || !allPointsHaveVotes}
            aria-busy={saveResolutions.isPending || updateQuorumData.isPending}
            title={
              !hasPersistentVoters
                ? "Guarda asistentes reales antes de registrar resoluciones"
                : !allPointsHaveVotes
                ? "Registra voto expreso de cada votante elegible y motivo de cada conflicto"
                : undefined
            }
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {saveResolutions.isPending || updateQuorumData.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {canRecalculateExistingResolutions
              ? "Recalcular resolución y crear expediente Acuerdo 360"
              : "Registrar resolución y crear expediente Acuerdo 360"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Paso 6: Cierre ───────────────────────────────────────────────────────────

function actaNarrativeForAgendaPoint(point: DebatePunto, index: number) {
  const kind = normalizeAgendaItemKind(point.kind ?? "DELIBERATIVO");
  const origin = AGENDA_ORIGIN_LABELS[point.origin ?? "MEETING_FLOOR"];
  const lines = [`${index + 1}. ${point.punto} — ${KIND_CHIP_LONG_LABELS[kind]} · origen: ${origin}`];
  if (point.agreement_id) lines.push(`   Propuesta preparada: ${point.agreement_id}`);

  const note = point.notas?.trim();
  if (kind === "DECISORIO") {
    if (note) lines.push(`   Deliberación previa: ${note}`);
    return lines;
  }

  if (kind === "INFORMATIVO") {
    lines.push(`   Se deja constancia de la información presentada al órgano.${note ? ` ${note}` : ""}`);
  } else if (kind === "TOMA_DE_RAZON") {
    lines.push(`   El órgano toma razón del hecho comunicado.${note ? ` ${note}` : ""}`);
  } else if (kind === "ACEPTACION_INFORME") {
    lines.push(`   El órgano recibe el informe y deja constancia de su conformidad u observaciones.${note ? ` ${note}` : ""}`);
  } else if (kind === "RUEGOS_PREGUNTAS") {
    lines.push(`   Se recogen las intervenciones, ruegos, preguntas y compromisos de respuesta.${note ? ` ${note}` : ""}`);
  } else {
    lines.push(`   Se deja constancia del debate mantenido, sin adopción de acuerdo.${note ? ` ${note}` : ""}`);
  }

  return lines;
}

function buildActaContent(
  meeting: ReturnType<typeof useReunionById>["data"],
  attendees: ReturnType<typeof useReunionAttendees>["data"],
  resolutions: MeetingResolution[],
  actaPuntos: Parameters<typeof renderActaAgendaItemsText>[0],
  canonicalMinutesHash?: string | null,
): string {
  const m = meeting as {
    meeting_type?: string | null;
    scheduled_start?: string | null;
    location?: string | null;
    quorum_data?: Record<string, unknown> | null;
    governing_bodies?: {
      name?: string | null;
      entities?: { common_name?: string | null } | null;
    } | null;
  } | null;

  const qd = m?.quorum_data as Record<string, unknown> | null;
  const universalMeeting = isUniversalMeetingQuorumData(qd);
  const universalIntake = recordAt(qd, "universal_intake");
  const universalOrganoTipo = stringAt(universalIntake, "organo_tipo");
  const universalNamespace = universalMeetingNamespace(
    stringAt(universalIntake, "meeting_namespace") || universalOrganoTipo,
  );
  const universalMeta = recordAt(recordAt(qd, "meetings"), universalNamespace);
  const isUniversalJunta = universalNamespace === "junta";
  const acceptance = recordAt(qd, "aceptacion_unanime_orden_dia");
  const lines: string[] = [];
  lines.push("ACTA DE REUNIÓN");
  lines.push("================");
  lines.push(`Entidad: ${m?.governing_bodies?.entities?.common_name ?? "—"}`);
  lines.push(`Órgano: ${m?.governing_bodies?.name ?? "—"}`);
  lines.push(`Tipo de sesión: ${m?.meeting_type ?? "—"}`);
  if (m?.scheduled_start) {
    lines.push(
      `Fecha: ${new Date(m.scheduled_start).toLocaleString("es-ES", {
        dateStyle: "long",
        timeStyle: "short",
      })}`
    );
  }
  if (m?.location) lines.push(`Lugar: ${m.location}`);
  if (universalMeeting) {
    lines.push(`Modalidad: ${isUniversalJunta ? "Junta Universal" : "Sesión universal"} sin convocatoria previa`);
    lines.push(isUniversalJunta
      ? "Conforme al artículo 178 LSC, concurre la totalidad del capital social presente o representado y se acepta por unanimidad la celebración de la Junta y el orden del día."
      : "Concurre la totalidad de los miembros del órgano social, presentes o representados, y se acepta por unanimidad la celebración de la sesión y el orden del día."
    );
    if (acceptance.timestamp) {
      lines.push(`Aceptación unánime registrada: ${acceptance.timestamp}`);
    }
    const cierre = stringAt(universalMeta, "hora_cierre");
    if (cierre) lines.push(`Hora de cierre: ${cierre}`);
    const modo = stringAt(universalMeta, "modo_aprobacion_acta");
    if (modo) lines.push(`Aprobación del acta: ${modo}`);
  }
  lines.push("");

  const safeAttendees = attendees ?? [];
  const present = safeAttendees.filter((a) => a.attendance_type !== "AUSENTE").length;
  lines.push(`ASISTENTES: ${present}/${safeAttendees.length} presentes o representados`);
  lines.push("");

  const quorum = qd?.quorum as
    | { present?: number; total?: number; pct?: string; reached?: boolean }
    | undefined;
  if (quorum) {
    lines.push(
      `QUÓRUM: ${quorum.present}/${quorum.total} (${quorum.pct}%) — ${quorum.reached ? "ALCANZADO" : "NO ALCANZADO"}`
    );
    lines.push("");
  }

  if (actaPuntos.length > 0) {
    lines.push("PUNTOS DEL ORDEN DEL DÍA:");
    lines.push(renderActaAgendaItemsText(actaPuntos));
    lines.push("");
  } else {
    const debates = (qd?.debates ?? []) as DebatePunto[];
    if (debates.length > 0) {
      lines.push("PUNTOS DEL ORDEN DEL DÍA:");
      debates.forEach((d, i) => {
        lines.push(...actaNarrativeForAgendaPoint(d, i));
      });
      lines.push("");
    }

    if (resolutions.length > 0) {
      lines.push("RESOLUCIONES:");
      resolutions.forEach((r, i) => {
        const label =
          r.status === "ADOPTED" ? "APROBADO" : r.status === "REJECTED" ? "RECHAZADO" : r.status;
        lines.push(`${i + 1}. ${r.resolution_text} — ${label}`);
      });
      lines.push("");
    }
  }

  const snapshots = (qd?.point_snapshots ?? []) as MeetingAdoptionSnapshot[];
  if (snapshots.length > 0) {
    lines.push("ANEXO PROBATORIO DE ADOPCIÓN:");
    snapshots.forEach((snapshot) => {
      lines.push(
        `${snapshot.agenda_item_index}. ${snapshot.materia} — validez societaria: ${
          snapshot.societary_validity.ok ? "PROCLAMABLE" : "NO PROCLAMABLE"
        }`
      );
      lines.push(
        `   Votos computables: favor ${formatVoteWeight(snapshot.vote_summary.favor)}, contra ${formatVoteWeight(snapshot.vote_summary.contra)}, abstenciones ${formatVoteWeight(snapshot.vote_summary.abstenciones)}`
      );
      if (snapshot.vote_completeness && !snapshot.vote_completeness.complete) {
        lines.push(
          `   Votación incompleta: ${snapshot.vote_completeness.missing_vote_ids.length} voto(s) pendiente(s), ${snapshot.vote_completeness.missing_conflict_reason_ids.length} motivo(s) de conflicto pendiente(s).`
        );
      }
      if (snapshot.vote_completeness?.ignored_conflict_vote_ids.length) {
        lines.push(
          `   Conflictos: ${snapshot.vote_completeness.ignored_conflict_vote_ids.length} voto(s) de conflictuados excluido(s) del denominador.`
        );
      }
      if (!snapshot.pacto_compliance.ok) {
        lines.push("   Pactos: incumplimiento contractual advertido; no altera la validez societaria salvo estatutarización.");
      }
    });
    lines.push("");
  }

  if (canonicalMinutesHash) {
    lines.push("HASH CANÓNICO DEL ACTA:");
    lines.push(canonicalMinutesHash);
    lines.push("");
  }

  lines.push("EVIDENCIA DEMO/OPERATIVA:");
  lines.push("Documento generado para el prototipo TGMS; la evidencia cualificada queda sujeta al pipeline QTSP configurado.");
  lines.push("");

  lines.push(
    `Generado el ${new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}`
  );
  return lines.join("\n");
}

type CensoSnapshotType = "ECONOMICO" | "POLITICO" | "UNIVERSAL";

function inferCensoSnapshotType(
  meeting: {
    meeting_type?: string | null;
    quorum_data?: Record<string, unknown> | null;
    governing_bodies?: { body_type?: string | null } | null;
  } | null | undefined,
): CensoSnapshotType {
  const raw = `${meeting?.meeting_type ?? ""} ${meeting?.governing_bodies?.body_type ?? ""}`.toUpperCase();
  if (meeting?.quorum_data?.junta_universal === true || raw.includes("UNIVERSAL")) return "UNIVERSAL";
  if (raw.includes("JUNTA")) return "ECONOMICO";
  return "POLITICO";
}

function CierreStep({ meetingId }: { meetingId?: string }) {
  const navigate = useNavigate();
  const { data: meeting } = useReunionById(meetingId);
  const { data: attendees } = useReunionAttendees(meetingId);
  const { data: resolutions = [], isLoading: resLoading } = useReunionResolutions(meetingId);
  const { data: existingMinute } = useMinuteForMeeting(meetingId);
  const { data: actaAgendaContract, isLoading: actaAgendaLoading } = useActaAgendaContract(meetingId);
  const generarActa = useGenerarActa();
  const updateQuorumData = useUpdateQuorumData(meetingId);
  const [minuteId, setMinuteId] = useState<string | null>(null);
  const meetingQuorumData = (meeting as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? null;
  const isUniversalMeeting = isUniversalMeetingQuorumData(meetingQuorumData);
  const meetingBodyForUniversal = (meeting as
    | { governing_bodies?: { name?: string | null; body_type?: string | null; config?: Record<string, unknown> | null } | null }
    | null
    | undefined
  )?.governing_bodies;
  const meetingOrganoTipo = resolveOrganoTipo(meetingBodyForUniversal);
  const meetingUniversalNamespace = universalMeetingNamespace(meetingOrganoTipo);
  const meetingUniversalLabel = universalMeetingLabel(meetingOrganoTipo);
  const meetingUniversalMeta = recordAt(recordAt(meetingQuorumData, "meetings"), meetingUniversalNamespace);
  const cotizadaMeta = recordAt(meetingUniversalMeta, "cotizada");
  const [salvedades, setSalvedades] = useState(stringAt(meetingUniversalMeta, "salvedades") ?? "");
  const [modoAprobacionActa, setModoAprobacionActa] = useState(
    stringAt(meetingUniversalMeta, "modo_aprobacion_acta") ?? "AL_FINAL_SESION",
  );
  const [horaCierre, setHoraCierre] = useState(stringAt(meetingUniversalMeta, "hora_cierre") ?? "");
  const [referenciaNotarial, setReferenciaNotarial] = useState(
    stringAt(meetingUniversalMeta, "referencia_notarial_ref") ?? "",
  );
  const [cotizadaRecuentoCanales, setCotizadaRecuentoCanales] = useState(
    stringAt(cotizadaMeta, "recuento_por_canal") ?? "",
  );
  const [cotizadaDelegaciones, setCotizadaDelegaciones] = useState(
    stringAt(cotizadaMeta, "delegaciones_voto_distancia") ?? "",
  );
  const [cotizadaIncidencias, setCotizadaIncidencias] = useState(
    stringAt(cotizadaMeta, "incidencias_tecnicas") ?? "",
  );
  useEffect(() => {
    if (!meetingQuorumData) return;
    const nextUniversal = recordAt(recordAt(meetingQuorumData, "meetings"), meetingUniversalNamespace);
    const nextCotizada = recordAt(nextUniversal, "cotizada");
    setSalvedades(stringAt(nextUniversal, "salvedades") ?? "");
    setModoAprobacionActa(stringAt(nextUniversal, "modo_aprobacion_acta") ?? "AL_FINAL_SESION");
    setHoraCierre(stringAt(nextUniversal, "hora_cierre") ?? "");
    setReferenciaNotarial(stringAt(nextUniversal, "referencia_notarial_ref") ?? "");
    setCotizadaRecuentoCanales(stringAt(nextCotizada, "recuento_por_canal") ?? "");
    setCotizadaDelegaciones(stringAt(nextCotizada, "delegaciones_voto_distancia") ?? "");
    setCotizadaIncidencias(stringAt(nextCotizada, "incidencias_tecnicas") ?? "");
  }, [meetingQuorumData, meetingUniversalNamespace]);
  const materializedAgreementCount = resolutions.filter((resolution) => resolution.agreement_id).length;
  const adoptedWithoutAgreement = resolutions.filter(
    (resolution) => resolution.status === "ADOPTED" && !resolution.agreement_id
  );
  const censoEntityId = meeting?.governing_bodies?.entity_id ?? null;
  const censoBodyId = meeting?.body_id ?? null;
  const censoSnapshotType = inferCensoSnapshotType(meeting);
  const canCreateCensoSnapshot = Boolean(censoEntityId && censoBodyId);
  const isEntidadCotizada = Boolean(meeting?.governing_bodies?.entities?.es_cotizada);
  const actaPuntos = actaAgendaContract?.puntos ?? [];
  const actaValidationIssues = actaAgendaContract?.validation.blockingIssues ?? [];
  const actaValidationOk = actaAgendaContract?.validation.ok ?? false;
  const universalCloseReady =
    !isUniversalMeeting ||
    (Boolean(horaCierre) &&
      Boolean(modoAprobacionActa) &&
      (modoAprobacionActa !== "POR_ACTA_NOTARIAL" || Boolean(referenciaNotarial.trim())));
  const canGenerateMinute =
    actaPuntos.length > 0 &&
    adoptedWithoutAgreement.length === 0 &&
    actaValidationOk &&
    !existingMinute?.id &&
    canCreateCensoSnapshot &&
    universalCloseReady;

  async function handleConfirmar() {
    if (!meetingId || adoptedWithoutAgreement.length > 0) {
      toast.error("No se puede generar el acta: hay acuerdos adoptados sin expediente Acuerdo 360.");
      return;
    }
    if (!actaValidationOk) {
      toast.error("No se puede generar el acta: la estructura legal no es válida.", {
        description: actaValidationIssues[0]?.message ?? "Revise el orden del día y las constancias de la reunión.",
      });
      return;
    }
    if (!censoEntityId || !censoBodyId) {
      toast.error("No se puede generar el acta: falta sociedad u órgano para crear el snapshot WORM de censo.");
      return;
    }
    const baseQuorumData = (meetingQuorumData ?? {}) as Record<string, unknown>;
    const meetings = recordAt(baseQuorumData, "meetings");
    const universalMeetingMeta = recordAt(meetings, meetingUniversalNamespace);
    const qdForMinute = isUniversalMeeting
      ? {
          ...baseQuorumData,
          meetings: {
            ...meetings,
            [meetingUniversalNamespace]: {
              ...universalMeetingMeta,
              salvedades: salvedades.trim() || null,
              modo_aprobacion_acta: modoAprobacionActa,
              hora_cierre: horaCierre || null,
              referencia_notarial_ref:
                modoAprobacionActa === "POR_ACTA_NOTARIAL" ? referenciaNotarial.trim() || null : null,
              cotizada: isEntidadCotizada
                ? {
                    recuento_por_canal: cotizadaRecuentoCanales.trim() || null,
                    delegaciones_voto_distancia: cotizadaDelegaciones.trim() || null,
                    incidencias_tecnicas: cotizadaIncidencias.trim() || null,
                  }
                : null,
            },
          },
        }
      : baseQuorumData;
    const content = buildActaContent(
      meeting ? { ...meeting, quorum_data: qdForMinute } : meeting,
      attendees,
      resolutions,
      actaPuntos,
      actaAgendaContract?.canonicalMinutesHash,
    );
    try {
      if (isUniversalMeeting) {
        await updateQuorumData.mutateAsync(qdForMinute);
      }
      const id = await generarActa.mutateAsync({
        meetingId,
        content,
        canonicalMinutesHash: actaAgendaContract?.canonicalMinutesHash,
        entityId: censoEntityId,
        bodyId: censoBodyId,
        sessionKind: "MEETING",
        snapshotType: censoSnapshotType,
      });
      setMinuteId(id);
      toast.success("Acta generada en borrador");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el acta");
    }
  }

  if (minuteId) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Acta generada en borrador
            </p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              {resolutions.length} resolución(es) registrada(s), {materializedAgreementCount} expediente(s)
              Acuerdo 360 vinculados. Procede a firmar el acta y emitir la certificación.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/secretaria/actas/${minuteId}`)}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <FileText className="h-4 w-4" />
          Ver acta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Revisa las resoluciones y sus expedientes Acuerdo 360 vinculados antes de confirmar el cierre. Al confirmar, se generará el
        acta en borrador mediante el proceso interno de Secretaría.
      </p>

      <BookDestinationNotice
        body={meetingBodyForUniversal}
        adoptionLabel={isUniversalMeeting ? meetingUniversalLabel.toLowerCase() : "acta de sesion"}
      />

      {isUniversalMeeting ? (
        <div
          className="space-y-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Cierre de {meetingUniversalLabel}
            </p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              Estos campos completan `meetings.{meetingUniversalNamespace}.*` antes de renderizar el acta.
              La convocatoria permanece nula.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Hora de cierre
              </label>
              <input
                type="time"
                value={horaCierre}
                onChange={(event) => setHoraCierre(event.target.value)}
                aria-invalid={!horaCierre}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Modo de aprobación del acta
              </label>
              <select
                value={modoAprobacionActa}
                onChange={(event) => setModoAprobacionActa(event.target.value)}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="AL_FINAL_SESION">Al final de la sesión</option>
                <option value="EN_PLAZO_15_DIAS">En plazo de 15 días</option>
                <option value="POR_ACTA_NOTARIAL">Por acta notarial</option>
              </select>
            </div>
          </div>
          {modoAprobacionActa === "POR_ACTA_NOTARIAL" ? (
            <div
              className="space-y-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <label className="block text-xs font-medium text-[var(--g-text-secondary)]">
                Referencia notarial
              </label>
              <input
                type="text"
                value={referenciaNotarial}
                onChange={(event) => setReferenciaNotarial(event.target.value)}
                aria-invalid={!referenciaNotarial.trim()}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
                placeholder="Protocolo / notario / referencia de requerimiento"
              />
              <p className="text-xs text-[var(--g-text-secondary)]">
                La plantilla operativa no sustituye el acta notarial exigida cuando se active este modo.
              </p>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
              Salvedades
            </label>
            <textarea
              value={salvedades}
              onChange={(event) => setSalvedades(event.target.value)}
              rows={3}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
              placeholder="Salvedades o incidencias de cierre, si existen"
            />
          </div>
          {isEntidadCotizada ? (
            <div
              className="grid gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 md:grid-cols-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                  Recuento por canal
                </label>
                <input
                  type="text"
                  value={cotizadaRecuentoCanales}
                  onChange={(event) => setCotizadaRecuentoCanales(event.target.value)}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                  Delegaciones / voto a distancia
                </label>
                <input
                  type="text"
                  value={cotizadaDelegaciones}
                  onChange={(event) => setCotizadaDelegaciones(event.target.value)}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                  Incidencias técnicas
                </label>
                <input
                  type="text"
                  value={cotizadaIncidencias}
                  onChange={(event) => setCotizadaIncidencias(event.target.value)}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {existingMinute?.id ? (
        <div
          className="flex items-start justify-between gap-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Esta reunión ya tiene acta operativa
            </p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              El prototipo reutiliza el acta existente para evitar duplicados y mantener trazabilidad
              estable entre reunión, acuerdo, certificación y tramitador.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/secretaria/actas/${existingMinute.id}`)}
            className="inline-flex shrink-0 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileText className="h-4 w-4" />
            Ver acta existente
          </button>
        </div>
      ) : null}

      {resLoading || actaAgendaLoading ? (
        <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando orden del día y acuerdos…</span>
        </div>
      ) : actaPuntos.length === 0 ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-info)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-info)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            No hay acuerdos registrados. Si la sesión solo contiene puntos informativos,
            deliberativos, toma de razón o ruegos y preguntas, el acta se generará como
            constancia de los asuntos tratados sin Acuerdo 360.
          </p>
        </div>
      ) : (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Resoluciones y expedientes Acuerdo 360 ({resolutions.length})
            </p>
          </div>
          <ul className="divide-y divide-[var(--g-border-subtle)]">
            {resolutions.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-sm text-[var(--g-text-primary)]">{r.resolution_text}</span>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {r.agreement_id && (
                    <span
                      className="bg-[var(--g-sec-100)] px-2.5 py-1 text-[11px] font-semibold text-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      Acuerdo 360
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
                      r.status === "ADOPTED" ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {r.status === "ADOPTED" ? "APROBADO" : "RECHAZADO"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {adoptedWithoutAgreement.length > 0 ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Hay {adoptedWithoutAgreement.length} resolución(es) aprobada(s) sin expediente
            Acuerdo 360. Vuelve al paso de votaciones y recalcula la resolución antes de generar
            el acta.
          </p>
        </div>
      ) : null}

      {actaValidationIssues.length > 0 ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
          <div className="text-xs text-[var(--g-text-secondary)]">
            <p className="font-semibold text-[var(--g-text-primary)]">
              El acta no está preparada para firma
            </p>
            <p className="mt-1">
              {actaValidationIssues[0].message}
            </p>
          </div>
        </div>
      ) : actaPuntos.length > 0 ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-success)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Acta preparada en orden cronológico conforme al orden del día. Los puntos decisorios generan acuerdo; los demás quedan como constancia.
          </p>
        </div>
      ) : null}

      <div
        className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
        <p className="text-xs text-[var(--g-text-secondary)]">
          Esta acción no se puede deshacer desde la interfaz. El acta quedará en estado BORRADOR
          hasta que sea firmada por la Secretaria.
        </p>
      </div>

      <button
        type="button"
        onClick={handleConfirmar}
        disabled={generarActa.isPending || updateQuorumData.isPending || !canGenerateMinute}
        aria-busy={generarActa.isPending || updateQuorumData.isPending}
        title={
          existingMinute?.id
            ? "La reunión ya tiene un acta operativa vinculada"
            : isUniversalMeeting && !universalCloseReady
              ? "Completa hora de cierre, modo de aprobación y referencia notarial cuando aplique"
            : !canCreateCensoSnapshot
              ? "Falta sociedad u órgano para crear el snapshot WORM de censo"
            : actaPuntos.length === 0
              ? "Guarda al menos un punto del orden del día antes de generar el acta"
            : adoptedWithoutAgreement.length > 0
              ? "Recalcula las resoluciones adoptadas sin Acuerdo 360 antes de generar el acta"
              : !actaValidationOk
                ? "Corrige la estructura legal del acta antes de generar el documento"
              : undefined
        }
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {generarActa.isPending || updateQuorumData.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando acta…
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Confirmar cierre y generar acta
          </>
        )}
      </button>
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function buildSteps(meetingId?: string): StepDef[] {
  return [
    {
      n: 1,
      label: "Constitución",
      hint: "Verificación del contexto de constitución y declaración de apertura de la sesión",
      body: <ConstitutionStep meetingId={meetingId} />,
    },
    {
      n: 2,
      label: "Asistentes",
      hint: "Registro de presentes, representados y ausentes — cálculo de capital representado",
      body: <AsistentesStep meetingId={meetingId} />,
    },
    {
      n: 3,
      label: "Quórum",
      hint: "Evaluación automática del quórum de constitución contra la regla jurisdiccional aplicable",
      body: <QuorumStep meetingId={meetingId} />,
    },
    {
      n: 4,
      label: "Agenda y debate",
      hint: "Agenda formal, propuestas preparadas y puntos nacidos durante la sesión",
      body: <DebatesStep meetingId={meetingId} />,
    },
    {
      n: 5,
      label: "Votaciones",
      hint: "Resultado por punto con mayoría, conflictos, vetos, pactos y snapshot legal",
      body: <VotacionesStep meetingId={meetingId} />,
    },
    {
      n: 6,
      label: "Cierre",
      hint: "Revisión de acuerdos adoptados y generación del acta en borrador",
      body: <CierreStep meetingId={meetingId} />,
    },
  ];
}

const UNIVERSAL_MODALITY_OPTIONS: Array<{ value: UniversalMeetingModality; label: string }> = [
  { value: "PRESENCIAL", label: "Presencial" },
  { value: "TELEMATICA", label: "Telemática" },
  { value: "MIXTA", label: "Mixta" },
];

function UniversalMeetingIntake() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const isSociedadScoped = searchParams.get("scope") === "sociedad";
  const scopedEntityId = isSociedadScoped ? searchParams.get("entity") : null;
  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesList({ sociedadesOnly: true });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    scopedEntityId ?? scope.selectedEntity?.id ?? null,
  );
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(searchParams.get("body"));
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const { data: bodies = [], isLoading: bodiesLoading } = useBodiesByEntity(selectedEntityId ?? undefined);
  const selectedBody = bodies.find((body) => body.id === selectedBodyId) ?? null;
  const selectedOrganoTipo = selectedBody ? resolveOrganoTipo(selectedBody) : null;
  const selectedNamespace = universalMeetingNamespace(selectedOrganoTipo);
  const selectedUniversalLabel = universalMeetingLabel(selectedOrganoTipo);
  const normativeProfile = useEntityNormativeProfile(selectedEntityId);
  const createUniversalMeeting = useCreateUniversalMeeting();
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [lugar, setLugar] = useState("");
  const [modalidad, setModalidad] = useState<UniversalMeetingModality>("PRESENCIAL");
  const domicilioSocial = entityDomicilioSocial(selectedEntity);

  useEffect(() => {
    if (!scopedEntityId) return;
    setSelectedEntityId(scopedEntityId);
  }, [scopedEntityId]);

  useEffect(() => {
    if (bodies.length === 0) {
      setSelectedBodyId(null);
      return;
    }
    if (selectedBodyId && bodies.some((body) => body.id === selectedBodyId)) return;
    const defaultBody = bodies.find((body) => resolveOrganoTipo(body) === "JUNTA_GENERAL") ?? bodies[0];
    setSelectedBodyId(defaultBody.id);
  }, [bodies, selectedBodyId]);

  function handleEntityChange(entityId: string | null) {
    setSelectedEntityId(entityId);
    setSelectedBodyId(null);
  }

  useEffect(() => {
    if (!domicilioSocial || lugar.trim()) return;
    setLugar(domicilioSocial);
  }, [domicilioSocial, lugar]);

  const normativeSnapshot: AgreementNormativeSnapshot | null = useMemo(() => {
    if (!selectedEntityId || !normativeProfile.data || !selectedOrganoTipo) return null;
    return buildAgreementNormativeSnapshot({
      agreement: {
        id: `reunion-universal:${selectedEntityId}:${selectedBodyId || "body"}:${fecha || "draft"}:${horaInicio || "draft"}`,
        entity_id: selectedEntityId,
        agreement_kind: "ACTA_SESION",
        matter_class: selectedOrganoTipo,
        adoption_mode: "UNIVERSAL",
        status: "BORRADOR",
        inscribable: false,
      },
      profile: normativeProfile.data,
    });
  }, [fecha, horaInicio, normativeProfile.data, selectedBodyId, selectedEntityId, selectedOrganoTipo]);

  const normativeReady =
    Boolean(normativeProfile.data) &&
    normativeProfile.data?.status !== "INCOMPLETO" &&
    (normativeProfile.data?.blockers ?? []).length === 0;
  const canSubmit =
    Boolean(selectedEntityId) &&
    Boolean(selectedBody?.id) &&
    Boolean(fecha) &&
    Boolean(horaInicio) &&
    Boolean(lugar.trim()) &&
    Boolean(modalidad) &&
    normativeReady;

  async function handleSubmit() {
    if (!selectedEntityId || !selectedEntity || !selectedBody || !selectedOrganoTipo) {
      toast.error("Selecciona una sociedad y un órgano social operativo.");
      return;
    }
    if (!normativeReady) {
      toast.error("La sociedad no tiene perfil normativo proyectable para congelar el snapshot.");
      return;
    }
    try {
      const result = await createUniversalMeeting.mutateAsync({
        entityId: selectedEntityId,
        entityName: selectedEntity.legal_name ?? selectedEntity.common_name,
        bodyId: selectedBody.id,
        bodyName: selectedBody.name,
        organoTipo: selectedOrganoTipo,
        fecha,
        horaInicio,
        lugar,
        modalidad,
        normativeSnapshot: normativeSnapshot as unknown as Record<string, unknown> | null,
      });
      toast.success(result.reused ? `${selectedUniversalLabel} existente reutilizada` : `${selectedUniversalLabel} creada`);
      navigate(`/secretaria/reuniones/${result.id}?scope=sociedad&entity=${encodeURIComponent(selectedEntityId)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear reunión universal");
    }
  }

  return (
    <main
      className="min-h-screen bg-[var(--g-surface-page)] p-6 text-[var(--g-text-primary)]"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
            Secretaría · Reunión universal
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--g-text-primary)]">
            Iniciar reunión sin convocatoria
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Crea directamente el objeto reunión con marca universal en el namespace del órgano.
            Para Junta General se documenta como Junta Universal; para Consejo, comisiones y comités se
            tramita como sesión universal del órgano social. No se crea convocatoria.
          </p>
        </div>

        <section
          className="space-y-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
              Paso 1
            </p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--g-text-primary)]">
              Sociedad y órgano
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Sociedad
              </label>
              {isSociedadScoped ? (
                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {selectedEntity?.legal_name ?? scope.selectedEntity?.legalName ?? "Sociedad seleccionada"}
                </div>
              ) : (
                <select
                  value={selectedEntityId ?? ""}
                  onChange={(event) => handleEntityChange(event.target.value || null)}
                  disabled={entitiesLoading}
                  aria-invalid={!selectedEntityId}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-60"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">Seleccionar sociedad</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.legal_name || entity.common_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Órgano
              </label>
              <select
                value={selectedBodyId ?? ""}
                onChange={(event) => setSelectedBodyId(event.target.value || null)}
                disabled={bodiesLoading || bodies.length === 0}
                aria-invalid={!selectedBodyId}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-60"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">
                  {bodiesLoading ? "Cargando órganos..." : "Seleccionar órgano social"}
                </option>
                {bodies.map((body) => (
                  <option key={body.id} value={body.id}>
                    {body.name} · {resolveOrganoTipo(body)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className={`border-l-4 p-3 ${
              normativeReady
                ? "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                : "border-[var(--status-warning)] bg-[var(--g-surface-muted)]"
            }`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <p className="text-xs font-semibold text-[var(--g-text-primary)]">
              Perfil normativo
            </p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              {normativeProfile.isLoading
                ? "Cargando marco normativo de Acuerdo 360..."
                : normativeReady
                  ? `Perfil proyectable: ${normativeProfile.data?.status} · snapshot ${normativeSnapshot?.snapshot_id ?? "pendiente"}`
                  : "La sociedad debe tener un perfil normativo proyectable antes de crear una reunión universal."}
            </p>
          </div>
        </section>

        <section
          className="space-y-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
              Paso 2
            </p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--g-text-primary)]">
              Datos básicos de la reunión
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Fecha de la reunión
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                aria-invalid={!fecha}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Hora de inicio
              </label>
              <input
                type="time"
                value={horaInicio}
                onChange={(event) => setHoraInicio(event.target.value)}
                aria-invalid={!horaInicio}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Modalidad
              </label>
              <select
                value={modalidad}
                onChange={(event) => setModalidad(event.target.value as UniversalMeetingModality)}
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {UNIVERSAL_MODALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                Flag universal
              </label>
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                meetings.{selectedNamespace}.es_universal = SÍ
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
              Lugar
            </label>
            <input
              type="text"
              value={lugar}
              onChange={(event) => setLugar(event.target.value)}
              aria-invalid={!lugar.trim()}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
              placeholder='Dirección física, "telemática" o "mixta"'
            />
          </div>

          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            No se crearán `agreements.convocatoria.*`, canal de convocatoria, referencia de
            publicación ni segunda convocatoria. La exigencia será: {universalMeetingRequirementLabel(selectedOrganoTipo)}.
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={scope.createScopedTo("/secretaria/reuniones/nueva")}
            className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Volver al intake
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || createUniversalMeeting.isPending}
            aria-busy={createUniversalMeeting.isPending}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-5 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {createUniversalMeeting.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Crear {selectedUniversalLabel} y continuar
          </button>
        </div>
      </div>
    </main>
  );
}

function ReunionIntake() {
  const [searchParams] = useSearchParams();
  // Contrato de handoff compartido (ver cross-module-handoff.ts): preserva el contexto
  // completo de la propuesta (órgano/asunto/justificación) emitido por GRC/AIMS.
  const { source, event, sourceId, organ, matter, rationale, isCrossModule } = readMeetingHandoff(
    (key) => searchParams.get(key),
  );
  const scopedEntityId =
    searchParams.get("scope") === "sociedad" ? searchParams.get("entity") : null;
  const scopedConvocatoriasPath = scopedEntityId
    ? `/secretaria/convocatorias?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/convocatorias";
  const scopedNuevaConvocatoriaPath = scopedEntityId
    ? `/secretaria/convocatorias/nueva?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/convocatorias/nueva";
  const scopedJuntaUniversalPath = scopedEntityId
    ? `/secretaria/reuniones/nueva?flow=junta-universal&scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/reuniones/nueva?flow=junta-universal";
  const sourceLabel = source === "grc" ? "GRC Compass" : source === "aims" ? "AIMS 360" : "Secretaría";

  return (
    <main
      className="min-h-screen bg-[var(--g-surface-page)] p-6 text-[var(--g-text-primary)]"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
            Secretaría · Intake de reunión
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--g-text-primary)]">
            Preparar una sesión societaria
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Las reuniones ordinarias se crean desde convocatoria emitida para conservar órgano, sociedad, fecha y
            trazabilidad legal. La vía universal se inicia directamente como reunión cuando concurre el 100% del
            capital social en Junta General o el 100% de los miembros en otros órganos, con aceptación unánime del
            orden del día.
          </p>
        </div>

        {isCrossModule ? (
          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning)]" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Handoff read-only desde {sourceLabel}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
                  Evento propuesto: <span className="font-medium text-[var(--g-text-primary)]">{event ?? "sin evento"}</span>
                  {sourceId ? (
                    <>
                      {" "}
                      · Referencia: <span className="font-medium text-[var(--g-text-primary)]">{sourceId}</span>
                    </>
                  ) : null}
                  . Secretaría decide si lo incorpora a una convocatoria, orden del día o expediente. No se escriben
                  `governance_module_events`, `governance_module_links`, reuniones, acuerdos ni actas desde este intake.
                </p>
                {(organ || matter || rationale) ? (
                  <dl className="mt-3 space-y-1.5 border-t border-[var(--g-border-subtle)] pt-3 text-sm">
                    {organ ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium text-[var(--g-text-secondary)]">Órgano propuesto:</dt>
                        <dd className="text-[var(--g-text-primary)]">{organ}</dd>
                      </div>
                    ) : null}
                    {matter ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium text-[var(--g-text-secondary)]">Asunto propuesto:</dt>
                        <dd className="text-[var(--g-text-primary)]">{matter}</dd>
                      </div>
                    ) : null}
                    {rationale ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 font-medium text-[var(--g-text-secondary)]">Justificación:</dt>
                        <dd className="text-[var(--g-text-primary)]">{rationale}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label="Opciones para crear una reunión"
        >
          <Link
            to={scopedNuevaConvocatoriaPath}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <FileText className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h2 className="mt-3 text-sm font-semibold text-[var(--g-text-primary)]">Crear convocatoria</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
              Camino recomendado: emite convocatoria, genera o reutiliza la reunión vinculada y continúa con asistentes,
              quórum, votaciones y acta.
            </p>
          </Link>

          <Link
            to={scopedConvocatoriasPath}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <Users className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h2 className="mt-3 text-sm font-semibold text-[var(--g-text-primary)]">Abrir convocatoria existente</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
              Selecciona una convocatoria emitida para entrar en la sesión asociada sin perder el contexto societario.
            </p>
          </Link>

          <Link
            to={scopedJuntaUniversalPath}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] md:col-span-2 lg:col-span-1"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <Zap className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h2 className="mt-3 text-sm font-semibold text-[var(--g-text-primary)]">Reunión universal</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
              Inicia directamente una Junta Universal o una sesión universal de cualquier órgano social. Requiere
              concurrencia del 100% y aceptación unánime del orden del día.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function ReunionStepper() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get("flow");
  const scopedEntityId =
    searchParams.get("scope") === "sociedad" ? searchParams.get("entity") : null;
  const backTo = scopedEntityId
    ? `/secretaria/reuniones?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/reuniones";
  if (!id && flow === "junta-universal") return <UniversalMeetingIntake />;
  if (!id) return <ReunionIntake />;

  return (
    <StepperShell
      eyebrow="Secretaría · Reunión"
      title="Asistente de sesión societaria"
      backTo={backTo}
      steps={buildSteps(id)}
    />
  );
}
