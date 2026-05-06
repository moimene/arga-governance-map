import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Check, ChevronDown, ChevronRight,
  AlertTriangle, FileText, Globe, Plus, Send, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { evaluarConvocatoria } from "@/lib/rules-engine";
import type { ConvocatoriaInput, RulePack, RuleParamOverride, RuleResolution, TipoOrgano, TipoSocial } from "@/lib/rules-engine";
import { checkNoticePeriodByType, useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useBodyMandates } from "@/hooks/useBodies";
import { useCreateConvocatoria, type AgendaItem } from "@/hooks/useConvocatorias";
import { useRuleResolutions } from "@/hooks/useRuleResolution";
import { usePlantillaProtegida } from "@/hooks/usePlantillasProtegidas";
import { useEntityDemoReadiness } from "@/hooks/useEntityDemoReadiness";
import { Capa3CaptureDialog } from "@/components/secretaria/Capa3CaptureDialog";
import { EntityReadinessNotice } from "@/components/secretaria/EntityReadinessNotice";
import { validateCapa3 } from "@/lib/secretaria/capa3-form-validation";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "@/lib/secretaria/legal-template-fixtures";
import { isRequiredCapa3Field } from "@/lib/secretaria/capa3-fields";
import { bodyOptionLabel } from "@/lib/secretaria/body-labels";
import { buildConvocatoriaNoticeDoubleEvaluation } from "@/lib/secretaria/dual-evaluation";
import {
  buildTemplateTraceEvidence,
  resolveTemplateProcessMatrix,
} from "@/lib/secretaria/template-process-matrix";

const STEPS = [
  { n: 1, label: "Sociedad y órgano",      hint: "Seleccionar sociedad, órgano convocante y tipo de reunión" },
  { n: 2, label: "Fecha y plazo legal",     hint: "Calcular antelación según jurisdicción y forma jurídica" },
  { n: 3, label: "Orden del día",           hint: "Clasificar ítems en ordinaria / estatutaria / estructural" },
  { n: 4, label: "Destinatarios",           hint: "Miembros del órgano que recibirán la convocatoria" },
  { n: 5, label: "Canales de publicación",  hint: "BORME / PSM / JORNAL / web corporativa / ERDS" },
  { n: 6, label: "Adjuntos",               hint: "Documentos de referencia y propuestas que se adjuntan" },
  { n: 7, label: "Revisión y emisión",      hint: "Verificación de compliance y emisión definitiva" },
];

const JURIS_FLAGS: Record<string, string> = { ES: "🇪🇸", PT: "🇵🇹", BR: "🇧🇷", MX: "🇲🇽" };

const CHANNEL_OPTIONS: Record<string, { value: string; label: string; recommended?: boolean }[]> = {
  ES: [
    { value: "WEB_CORPORATIVA",    label: "Web corporativa (art. 173 LSC)", recommended: true },
    { value: "BORME",              label: "BORME" },
    { value: "ERDS",               label: "Notificación ERDS (EAD Trust)", recommended: true },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado" },
    { value: "BUROFAX",            label: "Burofax" },
  ],
  PT: [
    { value: "JORNAL_OFICIAL",  label: "Diário da República", recommended: true },
    { value: "JORNAL_DIARIO",   label: "Jornal diário de grande circulação" },
    { value: "WEB_CORPORATIVA", label: "Site corporativo" },
    { value: "ERDS",            label: "Notificação ERDS certificada (EAD Trust)" },
  ],
  BR: [
    { value: "DIARIO_OFICIAL",    label: "Diário Oficial do Estado", recommended: true },
    { value: "JORNAL_CIRCULACAO", label: "Jornal de grande circulação" },
    { value: "WEB_CORPORATIVA",   label: "Site corporativo" },
  ],
  MX: [
    { value: "DOF",                label: "Diario Oficial de la Federación", recommended: true },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado a socios" },
    { value: "WEB_CORPORATIVA",    label: "Sitio corporativo" },
    { value: "ERDS",               label: "Notificación ERDS (EAD Trust)" },
  ],
};

const AGENDA_TIPOS = [
  { value: "ORDINARIA",    label: "Ordinaria" },
  { value: "ESTATUTARIA",  label: "Estatutaria" },
  { value: "ESTRUCTURAL",  label: "Estructural (inscribible)" },
] as const;

const AGENDA_MATERIAS = [
  { value: "APROBACION_CUENTAS", label: "Aprobación de cuentas", tipo: "ORDINARIA", inscribible: false },
  { value: "DISTRIBUCION_DIVIDENDOS", label: "Distribución de dividendos", tipo: "ORDINARIA", inscribible: false },
  { value: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", tipo: "ORDINARIA", inscribible: true },
  { value: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento de auditor", tipo: "ORDINARIA", inscribible: true },
  { value: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", tipo: "ESTATUTARIA", inscribible: true },
  { value: "AUMENTO_CAPITAL", label: "Aumento de capital", tipo: "ESTATUTARIA", inscribible: true },
  { value: "AUTORIZACION_GARANTIA", label: "Garantía intragrupo", tipo: "ESTRUCTURAL", inscribible: false },
] as const;

const CHANNEL_LABELS: Record<string, string> = {
  BORME: "BORME",
  WEB_SOCIEDAD: "Web de la sociedad",
  WEB_CORPORATIVA: "Web corporativa",
  DIARIO_OFICIAL: "Diario oficial",
  JORNAL_OFICIAL: "Diário da República",
  JORNAL_DIARIO: "Jornal diário de grande circulação",
  JORNAL_CIRCULACAO: "Jornal de grande circulação",
  DOF: "Diario Oficial de la Federación",
  NOTIFICACION: "Notificación individual",
  PERSONALIZADA: "Notificación individual personalizada",
  NOTIFICACION_CERTIFICADA: "Notificación certificada",
  ERDS: "Notificación ERDS (EAD Trust)",
  CORREO_CERTIFICADO: "Correo certificado",
  BUROFAX: "Burofax",
  EMAIL_CON_ACUSE: "Email con acuse",
};

function newAgendaItem(): AgendaItem {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    materia: "APROBACION_CUENTAS",
    tipo: "ORDINARIA",
    inscribible: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRulePackPayload(payload: unknown): payload is RulePack {
  return (
    isRecord(payload) &&
    isRecord(payload.convocatoria) &&
    isRecord(payload.constitucion) &&
    isRecord(payload.votacion) &&
    isRecord(payload.documentacion)
  );
}

function toTipoSocial(value: unknown): TipoSocial {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("SLU")) return "SLU";
  if (raw.includes("SAU")) return "SAU";
  if (raw.includes("SL")) return "SL";
  return "SA";
}

function toTipoOrgano(value: unknown): TipoOrgano {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("CDA") || raw.includes("CONSEJO")) return "CONSEJO";
  if (raw.includes("COMISION") || raw.includes("COMIT")) return "COMISION_DELEGADA";
  return "JUNTA_GENERAL";
}

function materiaClaseFromTipo(tipo: AgendaItem["tipo"]) {
  if (tipo === "ESTATUTARIA") return "ESTATUTARIA";
  if (tipo === "ESTRUCTURAL") return "ESTRUCTURAL";
  return "ORDINARIA";
}

function labelMateria(materia: string) {
  return AGENDA_MATERIAS.find((m) => m.value === materia)?.label ?? materia;
}

function statusLabel(status?: string | null) {
  if (!status) return "Sin estado";
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    LEGAL_REVIEW: "Revisión Legal",
    APPROVED: "Aprobada",
    ACTIVE: "Activa",
    DEPRECATED: "Deprecada",
    RETIRED: "Retirada",
    UNKNOWN: "Sin lifecycle",
  };
  return labels[status] ?? status;
}

function normalizeChannel(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function channelLabel(value: string, options = CHANNEL_OPTIONS["ES"]) {
  const normalized = normalizeChannel(value);
  return (
    options.find((option) => normalizeChannel(option.value) === normalized)?.label ??
    Object.entries(CHANNEL_OPTIONS)
      .flatMap(([, opts]) => opts)
      .find((option) => normalizeChannel(option.value) === normalized)?.label ??
    CHANNEL_LABELS[normalized] ??
    normalized
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^\w/, (char) => char.toUpperCase())
  );
}

function channelSatisfiesReminder(selected: string, reminder: string) {
  const selectedValue = normalizeChannel(selected);
  const reminderValue = normalizeChannel(reminder);
  if (selectedValue === reminderValue) return true;

  const webChannels = new Set(["WEB_SOCIEDAD", "WEB_CORPORATIVA"]);
  if (webChannels.has(selectedValue) && webChannels.has(reminderValue)) return true;

  const individualNoticeChannels = new Set([
    "NOTIFICACION",
    "PERSONALIZADA",
    "NOTIFICACION_CERTIFICADA",
    "ERDS",
    "CORREO_CERTIFICADO",
    "BUROFAX",
    "EMAIL_CON_ACUSE",
  ]);
  if (individualNoticeChannels.has(selectedValue) && individualNoticeChannels.has(reminderValue)) return true;

  const officialGazetteChannels = new Set([
    "DIARIO_OFICIAL",
    "JORNAL_OFICIAL",
    "JORNAL_DIARIO",
    "JORNAL_CIRCULACAO",
    "DOF",
  ]);
  return officialGazetteChannels.has(selectedValue) && officialGazetteChannels.has(reminderValue);
}

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

function serializeRuleResolution(resolution: RuleResolution) {
  return {
    ok: resolution.ok,
    severity: resolution.severity,
    materia: resolution.rulePack?.materia ?? null,
    clase: resolution.rulePack?.clase ?? null,
    pack_id: resolution.rulePack?.packId ?? null,
    version: resolution.rulePack?.version ?? null,
    lifecycle_status: resolution.rulePack?.lifecycleStatus ?? "UNKNOWN",
    ruleset_snapshot_id: resolution.rulesetSnapshotId ?? null,
    blocking_issues: resolution.blocking_issues,
    warnings: resolution.warnings,
    applicable_overrides: resolution.applicableOverrides.map((override) => ({
      id: override.id,
      materia: override.materia,
      clave: override.clave,
      valor: override.valor,
      fuente: override.fuente,
      referencia: override.referencia ?? null,
    })),
    explain: resolution.explain.map((node) => ({
      regla: node.regla,
      fuente: node.fuente,
      referencia: node.referencia ?? null,
      resultado: node.resultado,
      mensaje: node.mensaje,
      valor: node.valor ?? null,
    })),
  };
}

export default function ConvocatoriasStepper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedEntityId =
    searchParams.get("scope") === "sociedad" ? searchParams.get("entity") : null;
  const requestedPlantillaId = searchParams.get("plantilla");
  const isSociedadScoped = Boolean(scopedEntityId);
  const scopedListPath = isSociedadScoped && scopedEntityId
    ? `/secretaria/convocatorias?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/convocatorias";
  const createConvocatoria = useCreateConvocatoria();
  const { data: cloudRequestedPlantilla, isLoading: requestedPlantillaLoading } =
    usePlantillaProtegida(requestedPlantillaId ?? undefined);
  const localRequestedPlantilla = useMemo(
    () => requestedPlantillaId
      ? LEGAL_TEAM_TEMPLATE_FIXTURES.find((plantilla) => plantilla.id === requestedPlantillaId) ?? null
      : null,
    [requestedPlantillaId],
  );
  const requestedPlantilla = cloudRequestedPlantilla ?? localRequestedPlantilla;
  const requestedPlantillaIsLoading = requestedPlantillaLoading && !localRequestedPlantilla;

  const [current, setCurrent] = useState(1);
  const [expandExplain, setExpandExplain] = useState(false);
  const [emitidoId, setEmitidoId] = useState<string | null>(null);
  const [appliedPlantillaId, setAppliedPlantillaId] = useState<string | null>(null);
  const [templateCapa3Open, setTemplateCapa3Open] = useState(false);
  const [templateCapa3Values, setTemplateCapa3Values] = useState<Record<string, string>>({});
  const [templateCapa3Errors, setTemplateCapa3Errors] = useState<Record<string, string>>({});

  // ── Step 1 ──
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(() => scopedEntityId);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [tipoConvocatoria, setTipoConvocatoria] = useState<"ORDINARIA" | "EXTRAORDINARIA" | "UNIVERSAL">("ORDINARIA");

  useEffect(() => {
    if (!scopedEntityId) return;
    setSelectedEntityId((current) => (current === scopedEntityId ? current : scopedEntityId));
    setSelectedBodyId(null);
  }, [scopedEntityId]);

  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesList();
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const scopedEntityInvalid = Boolean(
    isSociedadScoped && selectedEntityId && !entitiesLoading && !selectedEntity,
  );
  const bodyQueryEntityId =
    selectedEntityId && (entitiesLoading || selectedEntity) ? selectedEntityId : undefined;
  const {
    data: bodies = [],
    isLoading: bodiesLoading,
    isFetching: bodiesFetching,
    error: bodiesError,
  } = useBodiesByEntity(bodyQueryEntityId);
  const selectedBody = bodies.find((b) => b.id === selectedBodyId) ?? null;
  const bodiesPending = Boolean(selectedEntityId && (entitiesLoading || bodiesLoading || bodiesFetching));
  const jurisdiction = selectedEntity?.jurisdiction ?? "ES";
  const tipoSocial = toTipoSocial(selectedEntity?.tipo_social ?? selectedEntity?.legal_form);
  const organoTipo = toTipoOrgano(selectedBody?.body_type);
  const { data: readiness } = useEntityDemoReadiness(selectedEntityId);
  const readinessBlocked = readiness?.status === "reference_only";

  // ── Step 3 ──
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([newAgendaItem()]);
  const agendaRuleSpecs = agendaItems.map((item) => ({
    materia: item.materia,
    clase: materiaClaseFromTipo(item.tipo),
  }));

  const {
    data: ruleResolutions = [],
    isLoading: ruleResolutionsLoading,
    error: ruleResolutionsError,
  } = useRuleResolutions({
    materias: agendaRuleSpecs,
    entityId: selectedEntityId,
    organoTipo,
  });
  const selectedRulePacks = ruleResolutions
    .map((resolution) => resolution.rulePack?.payload)
    .filter(isRulePackPayload);
  const allRulePayloadsCompatible =
    ruleResolutions.length > 0 &&
    ruleResolutions.every((resolution) => !!resolution.rulePack && isRulePackPayload(resolution.rulePack.payload));
  const agendaApplicableOverrides = uniqueOverrides(
    ruleResolutions.flatMap((resolution) => resolution.applicableOverrides),
  );
  const ruleGatePending =
    tipoConvocatoria !== "UNIVERSAL" &&
    (!!selectedEntityId || !!selectedBodyId) &&
    (ruleResolutionsLoading || ruleResolutions.length === 0 || !!ruleResolutionsError);
  const ruleAlertActive =
    ruleResolutions.length > 0 &&
    (ruleResolutions.some((resolution) => !resolution.ok) || !allRulePayloadsCompatible) &&
    tipoConvocatoria !== "UNIVERSAL";

  const { data: ruleSets = [] } = useEntityRules(
    selectedEntityId ? jurisdiction : undefined,
    selectedEntityId ? tipoSocial : undefined,
  );
  const activeRuleSet = ruleSets.find((r) => r.is_active) ?? ruleSets[0] ?? null;
  const liveNoticeDays = activeRuleSet?.rule_config?.notice_min_days_first_call ?? null;

  // ── Step 2 ──
  const [fechaReunion, setFechaReunion] = useState("");
  const [horaReunion, setHoraReunion] = useState("10:00");
  const [lugar, setLugar] = useState("");
  const [formatoReunion, setFormatoReunion] = useState<"PRESENCIAL" | "TELEMATICA" | "MIXTA">("PRESENCIAL");
  const [habilitarSegunda, setHabilitarSegunda] = useState(false);
  const [fechaReunion2, setFechaReunion2] = useState("");
  const [horaReunion2, setHoraReunion2] = useState("10:30");

  const meetingIso = fechaReunion
    ? new Date(`${fechaReunion}T${horaReunion}:00`).toISOString()
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const noticeOkV1 = checkNoticePeriodByType({
    meetingDate: meetingIso,
    jurisdiction,
    convocationType: tipoConvocatoria,
    tipoSocial,
  });

  const convocatoriaInput: ConvocatoriaInput = {
    tipoSocial,
    organoTipo,
    adoptionMode: "MEETING",
    fechaJunta: meetingIso,
    esCotizada: false,
    webInscrita: true,
    primeraConvocatoria: true,
    esJuntaUniversal: tipoConvocatoria === "UNIVERSAL",
    materias: agendaItems.map((i) => i.materia),
  };
  const evaluacionV2 = evaluarConvocatoria(
    convocatoriaInput,
    selectedRulePacks,
    agendaApplicableOverrides,
  );
  const noticeDoubleEvaluation = buildConvocatoriaNoticeDoubleEvaluation({
    meetingDate: meetingIso,
    isUniversal: tipoConvocatoria === "UNIVERSAL",
    v1NoticeOk: noticeOkV1,
    v2RequiredDays: evaluacionV2.antelacionDiasRequerida,
    v2Severity: evaluacionV2.severity,
    v2BlockingIssues: evaluacionV2.blocking_issues,
    v2Warnings: evaluacionV2.warnings,
  });
  const noticeOk = tipoConvocatoria === "UNIVERSAL"
    ? true
    : noticeDoubleEvaluation.effective_ok;

  function addAgendaItem() {
    setAgendaItems((prev) => [...prev, newAgendaItem()]);
  }
  function removeAgendaItem(id: string) {
    setAgendaItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateAgendaItem(id: string, patch: Partial<AgendaItem>) {
    setAgendaItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  }

  // ── Step 4 ──
  const { data: mandates = [] } = useBodyMandates(selectedBodyId ?? undefined);
  const activeMandates = mandates.filter((m) => m.status === "Activo");
  const [excludedPersonIds, setExcludedPersonIds] = useState<Set<string>>(new Set());
  function toggleExclude(personId: string) {
    setExcludedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }

  // ── Step 5 ──
  const channelOpts = CHANNEL_OPTIONS[jurisdiction] ?? CHANNEL_OPTIONS["ES"];
  const [channels, setChannels] = useState<string[]>([]);
  function toggleChannel(val: string) {
    setChannels((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val],
    );
  }

  const requestedTemplateMateria =
    requestedPlantilla?.materia_acuerdo ?? requestedPlantilla?.materia ?? null;
  const templateMatrixContext = useMemo(() => ({
    processHint: "convocatoria",
    variables: {
      denominacion_social: selectedEntity?.legal_name ?? selectedEntity?.common_name ?? "",
      organo_nombre: selectedBody?.name ?? "",
      materia_acuerdo: requestedTemplateMateria ?? agendaItems[0]?.materia ?? "",
      tipo_convocatoria: tipoConvocatoria,
      lugar,
      fecha_junta: fechaReunion,
      hora_junta: horaReunion,
    },
    capa3Values: templateCapa3Values,
  }), [
    agendaItems,
    fechaReunion,
    horaReunion,
    lugar,
    requestedTemplateMateria,
    selectedBody?.name,
    selectedEntity?.common_name,
    selectedEntity?.legal_name,
    templateCapa3Values,
    tipoConvocatoria,
  ]);
  const requestedTemplateMatrix = useMemo(
    () => resolveTemplateProcessMatrix(requestedPlantilla, templateMatrixContext),
    [requestedPlantilla, templateMatrixContext],
  );
  const isRequestedConvocatoriaTemplate = requestedTemplateMatrix?.processId === "convocatoria";
  const isRequestedTemplateFlowCompatible =
    requestedTemplateMatrix?.processId === "convocatoria" ||
    requestedTemplateMatrix?.processId === "informe_pre";
  const requestedTemplateCapa3Fields = requestedTemplateMatrix?.capa3Fields ?? [];
  const requestedTemplatePendingCapa3 = requestedTemplateCapa3Fields.filter(
    (field) => isRequiredCapa3Field(field) && !templateCapa3Values[field.campo]?.trim(),
  ).length;
  const requestedTemplateTraceEvidence = useMemo(
    () => buildTemplateTraceEvidence(requestedPlantilla, requestedTemplateMatrix),
    [requestedPlantilla, requestedTemplateMatrix],
  );

  useEffect(() => {
    if (!requestedPlantillaId || !requestedPlantilla || appliedPlantillaId === requestedPlantillaId) return;
    if (!isRequestedConvocatoriaTemplate) return;

    const materiaMeta = requestedTemplateMateria
      ? AGENDA_MATERIAS.find((materia) => materia.value === requestedTemplateMateria)
      : null;

    if (requestedTemplateMateria || materiaMeta) {
      setAgendaItems((prev) => {
        const first = prev[0] ?? newAgendaItem();
        return [
          {
            ...first,
            titulo: first.titulo.trim() || materiaMeta?.label || requestedTemplateMateria || first.titulo,
            materia: materiaMeta?.value ?? requestedTemplateMateria ?? first.materia,
            tipo: (materiaMeta?.tipo ?? first.tipo) as AgendaItem["tipo"],
            inscribible: materiaMeta?.inscribible ?? first.inscribible,
          },
          ...prev.slice(1),
        ];
      });
    }

    if (requestedPlantilla.tipo === "CONVOCATORIA_SL_NOTIFICACION") {
      setChannels((prev) => (prev.includes("ERDS") ? prev : [...prev, "ERDS"]));
    }

    setAppliedPlantillaId(requestedPlantillaId);
  }, [appliedPlantillaId, isRequestedConvocatoriaTemplate, requestedPlantilla, requestedPlantillaId, requestedTemplateMateria]);

  function openTemplateCapa3Capture() {
    if (requestedTemplateCapa3Fields.length === 0) return;
    setTemplateCapa3Values((currentValues) =>
      Object.keys(currentValues).length > 0
        ? currentValues
        : requestedTemplateMatrix?.initialCapa3Values ?? {},
    );
    setTemplateCapa3Errors({});
    setTemplateCapa3Open(true);
  }

  function submitTemplateCapa3Capture() {
    const errors = validateCapa3(requestedTemplateCapa3Fields, templateCapa3Values);
    if (Object.keys(errors).length > 0) {
      setTemplateCapa3Errors(errors);
      return;
    }
    setTemplateCapa3Errors({});
    setTemplateCapa3Open(false);
  }
  const legalChannelReminderItems = tipoConvocatoria === "UNIVERSAL"
    ? []
    : Array.from(new Set(evaluacionV2.canalesExigidos)).map((channel) => {
      const selectedVia = channels.find((selected) => channelSatisfiesReminder(selected, channel)) ?? null;
      return {
        value: channel,
        label: channelLabel(channel, channelOpts),
        selectedVia,
        selectedLabel: selectedVia ? channelLabel(selectedVia, channelOpts) : null,
      };
    });
  const pendingLegalChannelReminders = legalChannelReminderItems.filter((item) => !item.selectedVia);

  // ── Step 6 ──
  const [adjuntos, setAdjuntos] = useState<{ id: string; nombre: string; descripcion: string }[]>([]);
  const [documentosIncluidos, setDocumentosIncluidos] = useState<Set<string>>(new Set());
  const requiredDocuments = evaluacionV2.documentosObligatorios;
  const missingRequiredDocuments = tipoConvocatoria === "UNIVERSAL"
    ? []
    : requiredDocuments.filter((doc) => !documentosIncluidos.has(doc.id));
  const documentReminderOk = missingRequiredDocuments.length === 0;
  function addAdjunto() {
    setAdjuntos((prev) => [...prev, { id: crypto.randomUUID(), nombre: "", descripcion: "" }]);
  }
  function removeAdjunto(id: string) {
    setAdjuntos((prev) => prev.filter((a) => a.id !== id));
  }
  function updateAdjunto(id: string, field: "nombre" | "descripcion", val: string) {
    setAdjuntos((prev) => prev.map((a) => a.id === id ? { ...a, [field]: val } : a));
  }
  function toggleDocumentoIncluido(id: string) {
    setDocumentosIncluidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Validation gates ──
  function canAdvance(): boolean {
    switch (current) {
      case 1: return !!selectedEntity && !!selectedBody && !readinessBlocked;
      case 2: return !!fechaReunion && !!lugar;
      case 3: return agendaItems.some((i) => i.titulo.trim().length > 0);
      default: return true;
    }
  }

  const acceptedWarnings = [
    ...(!noticeOk && tipoConvocatoria !== "UNIVERSAL"
      ? [{
        type: "NOTICE_PERIOD",
        severity: "WARNING",
        message: "El plazo de convocatoria no parece cumplido; la emisión continúa como recordatorio no bloqueante.",
        required_days: evaluacionV2.antelacionDiasRequerida,
        meeting_date: meetingIso,
        deadline: evaluacionV2.fechaLimitePublicacion,
      }]
      : []),
    ...(ruleGatePending
      ? [{
        type: "RULE_RESOLUTION_PENDING",
        severity: "WARNING",
        message: "La regla aplicable no estaba completamente resuelta al emitir; se conserva el estado disponible.",
      }]
      : []),
    ...(ruleAlertActive
      ? [{
        type: "RULE_PACK_NOT_PRODUCTION_READY",
        severity: "WARNING",
        message: "Alguna regla aplicable no está lista para producción o su payload no es compatible.",
      }]
      : []),
    ...(!noticeDoubleEvaluation.converged
      ? [{
        type: "DUAL_EVALUATION_DIVERGENCE",
        severity: "WARNING",
        message: noticeDoubleEvaluation.divergence?.message ?? "Divergencia V1/V2 en plazo de convocatoria.",
        stage: noticeDoubleEvaluation.stage,
        effective_source: noticeDoubleEvaluation.effective_source,
      }]
      : []),
    ...pendingLegalChannelReminders.map((item) => ({
      type: "CHANNEL_REMINDER",
      severity: "WARNING",
      channel: item.value,
      label: item.label,
      message: "Canal legal recordado por el motor pendiente de evidencia externa o selección equivalente.",
    })),
    ...missingRequiredDocuments.map((doc) => ({
      type: "DOCUMENT_REMINDER",
      severity: "WARNING",
      document_id: doc.id,
      document_name: doc.nombre,
      condition: doc.condicion ?? null,
      message: "Documento obligatorio recordado por el motor pendiente de incorporación en TGMS.",
    })),
  ];

  function buildConvocatoriaTrace() {
    const emittedAt = new Date().toISOString();
    const selectedChannels = channels.map((channel) => ({
      value: channel,
      label: channelLabel(channel, channelOpts),
    }));
    const includedRequiredDocuments = requiredDocuments.filter((doc) => documentosIncluidos.has(doc.id));

    return {
      rule_trace: {
        schema_version: 1,
        emitted_at: emittedAt,
        legal_decision: "CONVOCATORIA_WARNINGS_NON_BLOCKING",
        input: convocatoriaInput,
        context: {
          entity_id: selectedEntityId,
          entity_name: selectedEntity?.legal_name ?? null,
          body_id: selectedBodyId,
          body_name: selectedBody?.name ?? null,
          jurisdiction,
          tipo_social: tipoSocial,
          organo_tipo: organoTipo,
          tipo_convocatoria: tipoConvocatoria,
          selected_template: requestedPlantilla
            ? {
              id: requestedPlantilla.id,
              tipo: requestedPlantilla.tipo,
              version: requestedPlantilla.version,
              estado: requestedPlantilla.estado,
              source: requestedTemplateTraceEvidence.template.source,
              source_of_truth: requestedTemplateTraceEvidence.template.source_of_truth,
              matrix_process: requestedTemplateMatrix?.processId ?? null,
              variable_sources: requestedTemplateMatrix?.sources ?? {},
              missing_required: requestedTemplateMatrix?.missingRequired ?? [],
              capa3_values: requestedTemplateCapa3Fields.length > 0 ? requestedTemplateMatrix?.capa3Draft.values ?? {} : null,
              trace_evidence: requestedTemplateTraceEvidence,
            }
            : null,
        },
        rule_resolutions: ruleResolutions.map(serializeRuleResolution),
        dual_evaluation: noticeDoubleEvaluation,
        active_rule_set: activeRuleSet
          ? {
            id: activeRuleSet.id,
            legal_reference: activeRuleSet.legal_reference ?? null,
            notice_min_days_first_call: activeRuleSet.rule_config?.notice_min_days_first_call ?? null,
            statutory_override: activeRuleSet.statutory_override ?? false,
          }
          : null,
        evaluation: {
          ok: evaluacionV2.ok,
          severity: evaluacionV2.severity,
          blocking_issues: evaluacionV2.blocking_issues,
          warnings: evaluacionV2.warnings,
          antelacion_dias_requerida: evaluacionV2.antelacionDiasRequerida,
          fecha_limite_publicacion: evaluacionV2.fechaLimitePublicacion,
          canales_exigidos: evaluacionV2.canalesExigidos,
          contenido_minimo: evaluacionV2.contenidoMinimo,
          documentos_obligatorios: evaluacionV2.documentosObligatorios,
          ventana_disponibilidad: evaluacionV2.ventanaDisponibilidad,
          explain: evaluacionV2.explain.map((node) => ({
            regla: node.regla,
            fuente: node.fuente,
            referencia: node.referencia ?? null,
            resultado: node.resultado,
            mensaje: node.mensaje,
            valor: node.valor ?? null,
          })),
        },
      },
      reminders_trace: {
        schema_version: 1,
        emitted_at: emittedAt,
        non_blocking: true,
        notice_period: {
          ok: noticeOk,
          is_universal: tipoConvocatoria === "UNIVERSAL",
          meeting_date: meetingIso,
          required_days: evaluacionV2.antelacionDiasRequerida,
          deadline: evaluacionV2.fechaLimitePublicacion,
          dual_evaluation: noticeDoubleEvaluation,
        },
        channels: {
          selected: selectedChannels,
          required_or_reminded: legalChannelReminderItems.map((item) => ({
            value: item.value,
            label: item.label,
            selected_via: item.selectedVia,
            selected_label: item.selectedLabel,
            covered: !!item.selectedVia,
          })),
          pending: pendingLegalChannelReminders.map((item) => ({
            value: item.value,
            label: item.label,
          })),
        },
        documents: {
          selected_template: requestedPlantilla
            ? {
              id: requestedPlantilla.id,
              tipo: requestedPlantilla.tipo,
              version: requestedPlantilla.version,
              source: requestedTemplateTraceEvidence.template.source,
              source_of_truth: requestedTemplateTraceEvidence.template.source_of_truth,
              matrix_process: requestedTemplateMatrix?.processId ?? null,
              variable_sources: requestedTemplateMatrix?.sources ?? {},
              missing_required: requestedTemplateMatrix?.missingRequired ?? [],
              capa3_values: requestedTemplateCapa3Fields.length > 0 ? requestedTemplateMatrix?.capa3Draft.values ?? {} : null,
              trace_evidence: requestedTemplateTraceEvidence,
            }
            : null,
          included_required: includedRequiredDocuments,
          missing_required: missingRequiredDocuments,
          uploaded_references: adjuntos
            .filter((adjunto) => adjunto.nombre.trim().length > 0)
            .map((adjunto) => ({
              id: adjunto.id,
              nombre: adjunto.nombre,
              descripcion: adjunto.descripcion,
            })),
        },
        recipients: {
          total_active: activeMandates.length,
          excluded_person_ids: Array.from(excludedPersonIds),
          selected_count: Math.max(activeMandates.length - excludedPersonIds.size, 0),
        },
      },
      accepted_warnings: acceptedWarnings.map((warning) => ({
        ...warning,
        accepted_at: emittedAt,
        accepted_by: "demo-user",
      })),
    };
  }

  // ── Submit ──
  async function handleEmitir() {
    if (!selectedBodyId || !fechaReunion || createConvocatoria.isPending) return;
    const fecha2Iso = habilitarSegunda && fechaReunion2
      ? new Date(`${fechaReunion2}T${horaReunion2}:00`).toISOString()
      : null;
    try {
      const created = await createConvocatoria.mutateAsync({
        body_id: selectedBodyId,
        tipo_convocatoria: tipoConvocatoria,
        fecha_1: meetingIso,
        fecha_2: fecha2Iso,
        modalidad: formatoReunion,
        lugar,
        junta_universal: tipoConvocatoria === "UNIVERSAL",
        is_second_call: false,
        publication_channels: channels,
        agenda_items: agendaItems
          .filter((i) => i.titulo.trim().length > 0)
          .map(({ titulo, materia, tipo, inscribible }) => ({ titulo, materia, tipo, inscribible })),
        statutory_basis: activeRuleSet?.legal_reference ?? null,
        ...buildConvocatoriaTrace(),
      });
      setEmitidoId(created.id);
      toast.success("Convocatoria emitida correctamente");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error("No se pudo emitir la convocatoria", { description: msg });
    }
  }

  const isLastStep = current === STEPS.length;

  // ── Success screen ──
  if (emitidoId) {
    return (
      <div className="mx-auto max-w-[640px] p-6">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-8 text-center"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-[var(--status-success)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            <Check className="h-6 w-6 text-[var(--g-text-inverse)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--g-text-primary)]">
            Convocatoria emitida
          </h2>
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            La convocatoria ha quedado registrada. Los destinatarios recibirán la notificación
            según los canales seleccionados.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate(scopedListPath)}
              className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ver convocatorias
            </button>
            <button
              type="button"
              onClick={() => navigate("/secretaria/reuniones")}
              className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ir a reuniones
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(scopedListPath)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Nueva convocatoria
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de convocatoria
        </h1>
      </div>

      {requestedPlantillaId ? (
        <div
          className={`mb-6 border px-4 py-3 text-sm ${
            isRequestedTemplateFlowCompatible
              ? "border-[var(--g-sec-300)] bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
              : "border-[var(--status-warning)] bg-[var(--g-surface-muted)] text-[var(--g-text-primary)]"
          }`}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {requestedPlantillaIsLoading ? (
            "Cargando plantilla indicada..."
          ) : isRequestedTemplateFlowCompatible && requestedPlantilla ? (
            <>
              Plantilla aplicada: <span className="font-semibold">{requestedPlantilla.tipo}</span>
              <span className="ml-1 text-xs text-[var(--g-text-secondary)]">
                v{requestedPlantilla.version} · {requestedPlantilla.id.slice(0, 8)}
              </span>
              {requestedPlantilla.tipo === "CONVOCATORIA_SL_NOTIFICACION" ? (
                <span className="ml-1 text-xs text-[var(--g-text-secondary)]">
                  · se sugiere ERDS como canal certificado
                </span>
              ) : null}
              {localRequestedPlantilla ? (
                <span className="ml-1 text-xs text-[var(--g-text-secondary)]">
                  · fixture local no persistido
                </span>
              ) : null}
            </>
          ) : (
            <>
              La plantilla indicada no es compatible con convocatoria/PRE. Se mantendrá el asistente estándar.
              <span className="ml-1 font-mono text-xs">{requestedPlantillaId.slice(0, 8)}</span>
            </>
          )}
        </div>
      ) : null}

      {isRequestedTemplateFlowCompatible && requestedTemplateCapa3Fields.length > 0 ? (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm"
          style={{ borderRadius: "var(--g-radius-md)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div>
            <p className="font-medium text-[var(--g-text-primary)]">
              Capa 3 de la plantilla
            </p>
            <p className="text-xs text-[var(--g-text-secondary)]">
              {requestedTemplateCapa3Fields.length} campo(s) editable(s)
              {requestedTemplatePendingCapa3 > 0
                ? ` · ${requestedTemplatePendingCapa3} obligatorio(s) pendiente(s)`
                : " · captura preparada"}
            </p>
          </div>
          <button
            type="button"
            onClick={openTemplateCapa3Capture}
            className="border border-[var(--g-border-subtle)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Completar Capa 3
          </button>
        </div>
      ) : null}

      <Capa3CaptureDialog
        open={templateCapa3Open}
        title="Completar Capa 3 de convocatoria"
        subtitle={requestedPlantilla ? `${requestedPlantilla.tipo} · ${requestedPlantilla.version}` : "Plantilla de convocatoria"}
        fields={requestedTemplateCapa3Fields}
        values={templateCapa3Values}
        errors={templateCapa3Errors}
        submitLabel="Guardar captura"
        onChange={(values) => {
          setTemplateCapa3Values(values);
          setTemplateCapa3Errors({});
        }}
        onClose={() => setTemplateCapa3Open(false)}
        onSubmit={submitTemplateCapa3Capture}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Stepper rail */}
        <nav
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Pasos"
        >
          {STEPS.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => s.n < current && setCurrent(s.n)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : done
                    ? "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50 cursor-pointer"
                    : "text-[var(--g-text-secondary)] opacity-50 cursor-default"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                    done
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : active
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Step body */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {current}. {STEPS[current - 1].label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {STEPS[current - 1].hint}
          </p>

          {/* ── PASO 1: Sociedad y órgano ── */}
          {current === 1 && (
            <div className="mt-6 space-y-5">
              {/* Entidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Sociedad convocante
                </label>
                {isSociedadScoped && (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    Modo Sociedad activo: la convocatoria se emitirá dentro de esta sociedad.
                  </p>
                )}
                <select
                  value={selectedEntityId ?? ""}
                  disabled={isSociedadScoped && !scopedEntityInvalid}
                  onChange={(e) => {
                    setSelectedEntityId(e.target.value || null);
                    setSelectedBodyId(null);
                  }}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">— Seleccionar sociedad —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {JURIS_FLAGS[e.jurisdiction ?? "ES"] ?? "🏢"} {e.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              <EntityReadinessNotice readiness={readiness} />

              {/* Órgano */}
              {selectedEntityId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Órgano convocante
                  </label>
                  {scopedEntityInvalid ? (
                    <p className="text-xs text-[var(--status-warning)]">
                      La sociedad indicada en la URL no existe en el catálogo cargado. Seleccione una sociedad válida.
                    </p>
                  ) : bodiesPending ? (
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      Cargando órganos de la sociedad…
                    </p>
                  ) : bodiesError ? (
                    <p className="text-xs text-[var(--status-error)]">
                      No se han podido cargar los órganos de esta sociedad.
                    </p>
                  ) : bodies.length === 0 ? (
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      No hay órganos registrados para esta sociedad.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--g-text-secondary)]">
                        Mostrando {bodies.length} órgano(s) vinculados a {selectedEntity?.legal_name ?? "la sociedad seleccionada"}.
                      </p>
                      <select
                        value={selectedBodyId ?? ""}
                        onChange={(e) => setSelectedBodyId(e.target.value || null)}
                        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <option value="">— Seleccionar órgano —</option>
                        {bodies.map((b) => (
                          <option key={b.id} value={b.id}>
                            {bodyOptionLabel(b)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              {/* Tipo de convocatoria */}
              {selectedBodyId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Tipo de reunión
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(["ORDINARIA", "EXTRAORDINARIA", "UNIVERSAL"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoConvocatoria(t)}
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                          tipoConvocatoria === t
                            ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                            : "border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {tipoConvocatoria === "UNIVERSAL" && (
                    <p className="text-xs text-[var(--g-text-secondary)] mt-1">
                      Junta universal: todos los socios presentes y de acuerdo en celebrarla. No requiere plazo de convocatoria.
                    </p>
                  )}
                </div>
              )}

              {/* Jurisdicción info badge */}
              {selectedEntity && (
                <div
                  className="flex items-center gap-3 p-3 bg-[var(--g-sec-100)] border border-[var(--g-sec-300)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Globe className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">
                      {JURIS_FLAGS[jurisdiction] ?? "🏢"} {jurisdiction}
                      {selectedEntity.tipo_social && (
                        <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                          {selectedEntity.tipo_social}
                        </span>
                      )}
                    </p>
                    {liveNoticeDays != null && (
                      <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                        Preaviso mínimo (TGMS):{" "}
                        <span className="font-semibold text-[var(--g-brand-3308)]">
                          {liveNoticeDays} días
                        </span>
                        {activeRuleSet?.legal_reference && (
                          <span className="ml-1 text-[10px]">· {activeRuleSet.legal_reference}</span>
                        )}
                      </p>
                    )}
                    {activeRuleSet?.statutory_override && (
                      <p className="text-xs text-[var(--status-warning)] mt-0.5">
                        ⚠ statutory_override — confirmar plazos con estatutos de la entidad
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedEntityId && selectedBodyId && (
                <RuleResolutionPanel
                  loading={ruleResolutionsLoading}
                  error={ruleResolutionsError}
                  ruleResolutions={ruleResolutions}
                  payloadsCompatible={allRulePayloadsCompatible}
                />
              )}
            </div>
          )}

          {/* ── PASO 2: Fecha y plazo legal ── */}
          {current === 2 && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Fecha de la reunión
                  </label>
                  <input
                    type="date"
                    value={fechaReunion}
                    onChange={(e) => setFechaReunion(e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={horaReunion}
                    onChange={(e) => setHoraReunion(e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Lugar / enlace de acceso
                </label>
                <input
                  type="text"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  placeholder="Ej. Sede social C/ Gran Vía 1, Madrid"
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Formato
                </label>
                <div className="flex gap-2">
                  {(["PRESENCIAL", "TELEMATICA", "MIXTA"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormatoReunion(f)}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                        formatoReunion === f
                          ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                          : "border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {f === "PRESENCIAL" ? "Presencial" : f === "TELEMATICA" ? "Telemática" : "Mixta"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Engine V2 compliance panel */}
              {tipoConvocatoria !== "UNIVERSAL" && evaluacionV2 && (
                <div
                  className="border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">
                        Evaluación de antelación — Motor LSC v2
                      </p>
                      {fechaReunion && (
                        <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                          {evaluacionV2.antelacionDiasRequerida} días requeridos
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex h-6 items-center px-2.5 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
                        evaluacionV2.ok ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {evaluacionV2.ok ? "OK" : "Revisar"}
                    </span>
                  </div>

                  {ruleResolutions.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <MiniFact label="Rule packs" value={String(ruleResolutions.filter((r) => r.rulePack).length)} />
                      <MiniFact label="Antelación" value={`${evaluacionV2.antelacionDiasRequerida} días`} />
                      <MiniFact label="Overrides" value={String(agendaApplicableOverrides.length)} />
                      <MiniFact
                        label="Doble eval."
                        value={noticeDoubleEvaluation.converged ? "Convergente" : "Divergente"}
                      />
                    </div>
                  )}

                  {!evaluacionV2.ok && fechaReunion && (
                    <p className="mt-2 text-xs text-[var(--status-error)]">
                      El plazo mínimo no está cumplido. Ajusta la fecha de la reunión.
                    </p>
                  )}
                  {ruleAlertActive && (
                    <p className="mt-2 text-xs text-[var(--status-error)]">
                      Recordatorio: alguna regla aplicable no está lista para producción o su payload no es compatible con el motor de convocatoria.
                    </p>
                  )}
                  {!noticeDoubleEvaluation.converged && (
                    <p className="mt-2 text-xs text-[var(--status-warning)]">
                      Doble evaluación V1/V2 divergente. Se conserva el criterio operativo V1 como recordatorio y se registra la divergencia para revisión.
                    </p>
                  )}
                  {ruleGatePending && (
                    <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                      Resolviendo regla aplicable para dejar trazabilidad del aviso.
                    </p>
                  )}
                  {!fechaReunion && (
                    <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                      Selecciona la fecha para calcular el plazo.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandExplain(!expandExplain)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandExplain ? "rotate-180" : ""}`} />
                    {expandExplain ? "Ocultar detalles" : "Ver detalles de evaluación"}
                  </button>

                  {expandExplain && (
                    <div className="mt-3 space-y-2 border-t border-[var(--g-border-subtle)] pt-3">
                      {ruleResolutions.map((resolution) =>
                        resolution.explain.map((node, idx) => (
                          <div key={`${resolution.rulePack?.packId ?? "missing"}-${idx}`} className="text-xs text-[var(--g-text-secondary)]">
                            <p className="font-medium text-[var(--g-text-primary)]">{node.regla}</p>
                            <p>{node.mensaje}</p>
                          </div>
                        )),
                      )}
                      {evaluacionV2.explain.map((node, idx) => (
                        <div key={idx} className="text-xs text-[var(--g-text-secondary)]">
                          <p className="font-medium text-[var(--g-text-primary)]">{node.regla}</p>
                          <p>{node.mensaje}</p>
                          {node.referencia && (
                            <p className="text-[11px]">{node.fuente}: {node.referencia}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Segunda convocatoria */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={habilitarSegunda}
                    onChange={(e) => setHabilitarSegunda(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-[var(--g-text-primary)]">
                    Habilitar segunda convocatoria
                  </span>
                </label>
                {habilitarSegunda && (
                  <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--g-text-primary)]">
                        Fecha segunda convocatoria
                      </label>
                      <input
                        type="date"
                        value={fechaReunion2}
                        onChange={(e) => setFechaReunion2(e.target.value)}
                        min={fechaReunion}
                        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--g-text-primary)]">Hora</label>
                      <input
                        type="time"
                        value={horaReunion2}
                        onChange={(e) => setHoraReunion2(e.target.value)}
                        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: Orden del día ── */}
          {current === 3 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-[var(--g-text-secondary)]">
                Añade los puntos del orden del día. Clasifica cada punto para que el motor
                aplique el quórum y mayoría correspondientes.
              </p>

              <div className="space-y-3">
                {agendaItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="border border-[var(--g-border-subtle)] p-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[var(--g-text-secondary)]">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={item.titulo}
                        onChange={(e) => updateAgendaItem(item.id, { titulo: e.target.value })}
                        placeholder="Descripción del punto del orden del día"
                        className="flex-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                      {agendaItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAgendaItem(item.id)}
                          aria-label="Eliminar punto"
                          className="text-[var(--g-text-secondary)] hover:text-[var(--status-error)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pl-5">
                      <select
                        value={item.materia}
                        onChange={(e) => {
                          const materia = e.target.value;
                          const meta = AGENDA_MATERIAS.find((m) => m.value === materia);
                          updateAgendaItem(item.id, {
                            materia,
                            tipo: (meta?.tipo ?? item.tipo) as AgendaItem["tipo"],
                            inscribible: meta?.inscribible ?? item.inscribible,
                          });
                        }}
                        className="min-w-[220px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs text-[var(--g-text-primary)] focus:outline-none"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {AGENDA_MATERIAS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <select
                        value={item.tipo}
                        onChange={(e) => updateAgendaItem(item.id, { tipo: e.target.value as AgendaItem["tipo"] })}
                        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs text-[var(--g-text-primary)] focus:outline-none"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {AGENDA_TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.inscribible}
                          onChange={(e) => updateAgendaItem(item.id, { inscribible: e.target.checked })}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-[var(--g-text-secondary)]">Inscribible en RM</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAgendaItem}
                className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir punto
              </button>
            </div>
          )}

          {/* ── PASO 4: Destinatarios ── */}
          {current === 4 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Miembros del órgano convocante
                </p>
              </div>

              {activeMandates.length === 0 ? (
                <div
                  className="bg-[var(--g-sec-100)] border border-[var(--g-sec-300)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm text-[var(--g-text-secondary)]">
                    No hay miembros vigentes registrados para este órgano.
                    La convocatoria se enviará sin destinatarios predefinidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMandates.map((m) => {
                    const excluded = excludedPersonIds.has(m.person_id);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3 border ${
                          excluded
                            ? "border-[var(--g-border-subtle)] opacity-50"
                            : "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--g-text-primary)]">
                            {m.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-[var(--g-text-secondary)]">
                            {m.role ?? "Miembro"}{m.email ? ` · ${m.email}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExclude(m.person_id)}
                          className={`text-xs px-2 py-1 border ${
                            excluded
                              ? "border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-sec-100)]"
                              : "border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--g-surface-card)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {excluded ? "Incluir" : "Excluir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-[var(--g-text-secondary)]">
                {activeMandates.length - excludedPersonIds.size} destinatario(s) seleccionado(s).
                Las notificaciones se enviarán por los canales que configures en el paso siguiente.
              </p>
            </div>
          )}

          {/* ── PASO 5: Canales de publicación ── */}
          {current === 5 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-[var(--g-text-secondary)]">
                Selecciona los canales de publicación y notificación. Los canales recomendados
                se resaltan según la jurisdicción ({jurisdiction}).
              </p>

              <div
                className={`border p-3 ${
                  pendingLegalChannelReminders.length > 0
                    ? "border-[var(--status-warning)] bg-[var(--g-surface-card)]"
                    : "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-start gap-2">
                  {pendingLegalChannelReminders.length > 0 ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                  ) : (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">
                      Recordatorios de canales del motor legal
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                      No bloquean el avance ni la emisión; quedan como trazabilidad si la publicación o notificación se ejecuta fuera de TGMS.
                    </p>
                  </div>
                </div>

                {legalChannelReminderItems.length === 0 ? (
                  <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
                    El motor no devuelve canales a recordar para esta convocatoria.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {legalChannelReminderItems.map((item) => (
                      <div
                        key={item.value}
                        className="flex items-start justify-between gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--g-text-primary)]">
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">
                            Motor LSC: {item.value}
                            {item.selectedLabel
                              ? ` · seleccionado como ${item.selectedLabel}`
                              : " · pendiente de evidencia externa si se gestiona fuera"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold text-[var(--g-text-inverse)] ${
                            item.selectedVia ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-full)" }}
                        >
                          {item.selectedVia ? "Seleccionado" : "Recordatorio"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {channelOpts.map((ch) => (
                  <label
                    key={ch.value}
                    className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                      channels.includes(ch.value)
                        ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                        : "border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes(ch.value)}
                      onChange={() => toggleChannel(ch.value)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="text-sm text-[var(--g-text-primary)] flex-1">{ch.label}</span>
                    {ch.recommended && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        Recomendado
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {channels.length === 0 && (
                <p className="text-xs text-[var(--status-warning)]">
                  Sin canales seleccionados la convocatoria se archivará pero no generará notificaciones.
                </p>
              )}
            </div>
          )}

          {/* ── PASO 6: Adjuntos ── */}
          {current === 6 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Documentos adjuntos a la convocatoria
                </p>
              </div>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Registra los documentos que se remiten junto con la convocatoria
                (informe de gestión, propuestas de acuerdo, cuentas anuales, etc.).
              </p>

              <div
                className={`border p-3 ${
                  documentReminderOk
                    ? "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
                    : "border-[var(--status-warning)] bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-start gap-2">
                  {documentReminderOk ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">
                      Recordatorio PRE documental
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                      {requiredDocuments.length === 0
                        ? "El motor no exige documentos obligatorios adicionales para las materias seleccionadas."
                        : `${requiredDocuments.length - missingRequiredDocuments.length}/${requiredDocuments.length} documento(s) obligatorio(s) incorporado(s).`}
                    </p>
                  </div>
                </div>

                {requiredDocuments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {requiredDocuments.map((doc) => {
                      const included = documentosIncluidos.has(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`flex cursor-pointer items-start gap-3 border p-2 transition-colors ${
                            included
                              ? "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
                              : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggleDocumentoIncluido(doc.id)}
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium text-[var(--g-text-primary)]">
                              {doc.nombre}
                            </span>
                            <span className="block text-[11px] text-[var(--g-text-secondary)]">
                              {doc.condicion ? `${doc.id} · ${doc.condicion}` : doc.id}
                            </span>
                          </span>
                          {!included && (
                            <span
                              className="shrink-0 bg-[var(--status-warning)] px-2 py-0.5 text-[10px] font-semibold text-[var(--g-text-inverse)]"
                              style={{ borderRadius: "var(--g-radius-full)" }}
                            >
                              Recordatorio
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {adjuntos.length === 0 ? (
                <div
                  className="border border-dashed border-[var(--g-border-subtle)] p-6 text-center"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm text-[var(--g-text-secondary)]">No hay adjuntos añadidos.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {adjuntos.map((a) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center border border-[var(--g-border-subtle)] p-2"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <input
                        type="text"
                        value={a.nombre}
                        onChange={(e) => updateAdjunto(a.id, "nombre", e.target.value)}
                        placeholder="Nombre del documento"
                        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      />
                      <input
                        type="text"
                        value={a.descripcion}
                        onChange={(e) => updateAdjunto(a.id, "descripcion", e.target.value)}
                        placeholder="Descripción (opcional)"
                        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeAdjunto(a.id)}
                        aria-label="Eliminar adjunto"
                        className="text-[var(--g-text-secondary)] hover:text-[var(--status-error)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addAdjunto}
                className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir adjunto
              </button>
            </div>
          )}

          {/* ── PASO 7: Revisión y emisión ── */}
          {current === 7 && (
            <div className="mt-6 space-y-5">
              {/* Summary grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SummaryCard label="Sociedad" value={selectedEntity?.legal_name ?? "—"} />
                <SummaryCard label="Órgano" value={selectedBody?.name ?? "—"} />
                <SummaryCard label="Tipo" value={tipoConvocatoria} />
                <SummaryCard label="Formato" value={formatoReunion} />
                <SummaryCard
                  label="Primera convocatoria"
                  value={fechaReunion ? `${fechaReunion} ${horaReunion}` : "—"}
                />
                {habilitarSegunda && (
                  <SummaryCard
                    label="Segunda convocatoria"
                    value={fechaReunion2 ? `${fechaReunion2} ${horaReunion2}` : "—"}
                  />
                )}
                <SummaryCard label="Lugar" value={lugar || "—"} />
                <SummaryCard
                  label="Canales"
                  value={channels.length > 0 ? channels.join(", ") : "Ninguno seleccionado"}
                />
              </div>

              {/* Orden del día summary */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)] mb-2">
                  Orden del día ({agendaItems.filter((i) => i.titulo.trim()).length} puntos)
                </p>
                {agendaItems.filter((i) => i.titulo.trim()).length === 0 ? (
                  <p className="text-xs text-[var(--status-warning)]">Sin puntos definidos.</p>
                ) : (
                  <ol className="space-y-1">
                    {agendaItems
                      .filter((i) => i.titulo.trim())
                      .map((item, idx) => (
                        <li key={item.id} className="text-sm text-[var(--g-text-primary)]">
                          <span className="text-[var(--g-text-secondary)]">{idx + 1}. </span>
                          {item.titulo}
                          <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                            [{labelMateria(item.materia)} · {item.tipo}{item.inscribible ? " · inscribible" : ""}]
                          </span>
                        </li>
                      ))}
                  </ol>
                )}
              </div>

              {/* Compliance badge */}
              <div
                className={`p-3 border-l-4 ${
                  tipoConvocatoria === "UNIVERSAL" || noticeOk
                    ? "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                    : "border-[var(--status-warning)] bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  {tipoConvocatoria === "UNIVERSAL"
                    ? "Junta universal — no requiere plazo de convocatoria"
                    : ruleGatePending
                    ? "Resolviendo rule pack aplicable para trazabilidad"
                    : ruleAlertActive
                    ? "Recordatorio: rule pack no activable para producción — revisar con Legal"
                    : noticeOk
                    ? "Plazo de convocatoria cumplido"
                    : "Recordatorio: el plazo de convocatoria no parece cumplido"}
                </p>
                {ruleResolutions.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    {ruleResolutions
                      .map((resolution) =>
                        resolution.rulePack
                          ? `${resolution.rulePack.packId} v${resolution.rulePack.version} (${statusLabel(resolution.rulePack.lifecycleStatus)})`
                          : "rule pack pendiente",
                      )
                      .join(" · ")}
                  </p>
                )}
              </div>

              {/* Recordatorio canales */}
              <div
                className={`p-3 border-l-4 ${
                  pendingLegalChannelReminders.length > 0
                    ? "border-[var(--status-warning)] bg-[var(--g-surface-card)]"
                    : "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  {legalChannelReminderItems.length === 0
                    ? "Sin recordatorios de canal del motor legal"
                    : pendingLegalChannelReminders.length > 0
                    ? "Recordatorio de canales — hay canales pendientes de trazabilidad"
                    : "Recordatorio de canales cubierto"}
                </p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  {legalChannelReminderItems.length === 0
                    ? "La emisión no queda condicionada por canales de publicación o notificación."
                    : `${legalChannelReminderItems.length - pendingLegalChannelReminders.length}/${legalChannelReminderItems.length} canal(es) seleccionados o equivalentes.`}
                </p>
                {pendingLegalChannelReminders.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pendingLegalChannelReminders.map((item) => (
                      <li key={item.value} className="text-xs text-[var(--status-warning)]">
                        {item.label} · {item.value}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recordatorio documental */}
              <div
                className={`p-3 border-l-4 ${
                  documentReminderOk
                    ? "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                    : "border-[var(--status-warning)] bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  {documentReminderOk
                    ? "Recordatorio PRE documental cubierto"
                    : "Recordatorio PRE documental — hay documentos pendientes"}
                </p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  {requiredDocuments.length === 0
                    ? "Sin documentos obligatorios adicionales para el OdD actual."
                    : `${requiredDocuments.length - missingRequiredDocuments.length}/${requiredDocuments.length} documento(s) obligatorio(s) incorporado(s).`}
                </p>
                {missingRequiredDocuments.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {missingRequiredDocuments.map((doc) => (
                      <li key={doc.id} className="text-xs text-[var(--status-warning)]">
                        {doc.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Destinatarios count */}
              <p className="text-xs text-[var(--g-text-secondary)]">
                <span className="font-semibold">{activeMandates.length - excludedPersonIds.size}</span> destinatario(s)
                {adjuntos.filter((a) => a.nombre.trim()).length > 0 && (
                  <> · <span className="font-semibold">{adjuntos.filter((a) => a.nombre.trim()).length}</span> adjunto(s)</>
                )}
              </p>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>

            {isLastStep ? (
              <button
                type="button"
                disabled={createConvocatoria.isPending}
                onClick={handleEmitir}
                aria-busy={createConvocatoria.isPending}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Send className="h-4 w-4" />
                {createConvocatoria.isPending ? "Emitiendo…" : "Emitir convocatoria"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canAdvance()}
                onClick={() => setCurrent((n) => Math.min(STEPS.length, n + 1))}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--g-text-primary)] truncate">{value}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">{label}</p>
      <p className="truncate text-xs font-medium text-[var(--g-text-primary)]">{value}</p>
    </div>
  );
}

function RuleResolutionPanel({
  loading,
  error,
  ruleResolutions,
  payloadsCompatible,
}: {
  loading: boolean;
  error: Error | null;
  ruleResolutions: RuleResolution[];
  payloadsCompatible: boolean;
}) {
  if (loading) {
    return (
      <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
        <p className="text-sm font-medium text-[var(--g-text-primary)]">Resolviendo reglas aplicables</p>
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
          El asistente está cargando rule packs, versiones, overrides y snapshots del orden del día.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
          <div>
            <p className="text-sm font-medium text-[var(--g-text-primary)]">No se pudo resolver la regla</p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (ruleResolutions.length === 0) {
    return (
      <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
        <p className="text-sm font-medium text-[var(--g-text-primary)]">Regla pendiente de selección</p>
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
          Selecciona materia y órgano para resolver el rule pack.
        </p>
      </div>
    );
  }

  const blocking = ruleResolutions.some((resolution) => !resolution.ok) || !payloadsCompatible;
  const warnings = ruleResolutions.flatMap((resolution) => resolution.warnings);
  if (!payloadsCompatible) {
    warnings.push("Alguna versión existe, pero su payload no expone el contrato completo de convocatoria.");
  }
  const overridesCount = uniqueOverrides(ruleResolutions.flatMap((resolution) => resolution.applicableOverrides)).length;

  return (
    <div
      className={`border p-3 ${
        blocking
          ? "border-[var(--status-error)] bg-[var(--g-surface-card)]"
          : warnings.length > 0
            ? "border-[var(--status-warning)] bg-[var(--g-surface-card)]"
            : "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
      }`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-start gap-2">
        {blocking ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--g-text-primary)]">
            Reglas aplicables al orden del día
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {ruleResolutions.length} materia(s), {ruleResolutions.filter((resolution) => resolution.rulePack).length} rule pack(s), {overridesCount} override(s).
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {ruleResolutions.map((resolution) => {
          const materia = resolution.rulePack?.materia ?? resolution.rulePack?.packId ?? "Materia sin pack";
          const compatible = !!resolution.rulePack && isRulePackPayload(resolution.rulePack.payload);
          return (
            <div
              key={`${materia}-${resolution.rulePack?.version ?? "missing"}`}
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[var(--g-text-primary)]">
                    {labelMateria(materia)}
                  </p>
                  {resolution.rulePack ? (
                    <p className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">
                      {resolution.rulePack.packId} v{resolution.rulePack.version} · {statusLabel(resolution.rulePack.lifecycleStatus)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-[var(--status-error)]">Sin versión activa</p>
                  )}
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold text-[var(--g-text-inverse)] ${
                    resolution.ok && compatible ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {resolution.ok && compatible ? "OK" : "BLOCK"}
                </span>
              </div>
              {resolution.rulesetSnapshotId && (
                <p className="mt-1 truncate text-[10px] text-[var(--g-text-secondary)]">
                  Snapshot {resolution.rulesetSnapshotId}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {ruleResolutions.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MiniFact label="Rule packs" value={String(ruleResolutions.filter((resolution) => resolution.rulePack).length)} />
          <MiniFact label="Overrides" value={String(overridesCount)} />
          <MiniFact label="Snapshots" value={String(ruleResolutions.filter((resolution) => resolution.rulesetSnapshotId).length)} />
        </div>
      )}

      {(ruleResolutions.some((resolution) => resolution.blocking_issues.length > 0) || warnings.length > 0) && (
        <div className="mt-3 space-y-1 border-t border-[var(--g-border-subtle)] pt-2">
          {ruleResolutions.flatMap((resolution) => resolution.blocking_issues).map((issue) => (
            <p key={issue} className="text-xs text-[var(--status-error)]">{issue}</p>
          ))}
          {warnings.map((warning) => (
            <p key={warning} className="text-xs text-[var(--g-text-secondary)]">{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}
