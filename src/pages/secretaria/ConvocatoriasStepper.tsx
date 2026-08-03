import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Copy,
  AlertTriangle, FileText, Globe, Plus, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { evaluarConvocatoria, tiposPlantillaConvocatoriaPreferidos } from "@/lib/rules-engine";
import { segundaConvocatoriaGapIncumplido, gapSegundaConvocatoriaHoras } from "@/lib/secretaria/segunda-convocatoria";
import type { ConvocatoriaInput, RulePack, RuleParamOverride, RuleResolution, TipoOrgano, TipoSocial } from "@/lib/rules-engine";
import { resolveOrganoTipo } from "@/lib/secretaria/organo-resolver";
import {
  AGENDA_INFORMATIVE_MATERIAS,
  AGENDA_MATERIAS,
  LMV_COTIZADA_ADVERTENCIAS,
  MATERIAS_LIBRES,
  agendaItemsForDecisionEngine,
  agendaMateriaSelectionForKind,
  agendaMateriaGroups,
  isMateriaInformativa,
  isMateriaCompatibleWithOrgano,
  labelMateria,
  materiaDefaultForOrgano,
  materiaInformativaDefault,
  resolveMateriaAlias,
} from "@/lib/secretaria/agenda-materias";
import { checkNoticePeriodByType, useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useMateriaCatalog } from "@/hooks/useMateriaConfig";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBodyMandates } from "@/hooks/useBodies";
import {
  useConvocatoriasList,
  useConvocatoriaById,
  useCreateConvocatoria,
  useUploadConvocatoriaAttachment,
  buildSupportingAttachmentIntents,
  type AgendaItem,
  type ConvocatoriaWithBody,
  type SupportingAttachmentIntent,
} from "@/hooks/useConvocatorias";
import { secretariaErrorMessage } from "@/lib/secretaria/supabase-error-message";
import { useCapitalHoldings } from "@/hooks/useCapitalHoldings";
import { usePresidenteVigente } from "@/hooks/useAuthorityEvidence";
import { useShareholderRepresentationCandidates } from "@/hooks/useDelegations";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { Capa3Form } from "@/components/secretaria/Capa3Form";
import { selectProcessTemplate } from "@/lib/doc-gen/process-documents";
import {
  DOCUMENT_DEMO_NOTICE,
  normalizeVisibleDocumentText,
} from "@/lib/doc-gen/document-output-normalizer";
import type { AgendaItemKind, AgendaDecisionSubtype } from "@/lib/secretaria/agenda-kind";
import { useRuleResolutions } from "@/hooks/useRuleResolution";
import { usePlantillaProtegida } from "@/hooks/usePlantillasProtegidas";
import { useEntityDemoReadiness } from "@/hooks/useEntityDemoReadiness";
import { Capa3CaptureDialog } from "@/components/secretaria/Capa3CaptureDialog";
import { EntityReadinessNotice } from "@/components/secretaria/EntityReadinessNotice";
import { validateCapa3 } from "@/lib/secretaria/capa3-form-validation";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "@/lib/secretaria/legal-template-fixtures";
import {
  capa3ValueToText,
  isRequiredCapa3Field,
  type Capa3Values,
} from "@/lib/secretaria/capa3-fields";
import {
  buildConvocatoriaCapa3Resolution,
  type ConvocatoriaCapa3Field,
} from "@/lib/secretaria/convocatoria-capa3-resolver";
import { bodyOptionLabel } from "@/lib/secretaria/body-labels";
import { buildConvocatoriaNoticeDoubleEvaluation } from "@/lib/secretaria/dual-evaluation";
import {
  buildTemplateTraceEvidence,
  resolveTemplateProcessMatrix,
} from "@/lib/secretaria/template-process-matrix";
import { resolveWorkflowDateTimeInputParts } from "@/lib/secretaria/workflow-date-semantics";
import {
  EAD_INTERPOSITION_CHANNEL,
  channelsForNewCapture,
  isLegacyErdsChannel,
} from "@/lib/secretaria/ead-channel-semantics";
import {
  buildSoleShareholderRepresentativeProposal,
  evaluateAnnualAccountsTimeliness,
  hasSoleShareholderRepresentativeConditions,
} from "@/lib/secretaria/convocation-agenda-gates";

const WORKFLOW_TIME_ZONE_BY_JURISDICTION: Record<string, string> = {
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
};

const STEPS = [
  { n: 1, label: "Sociedad y órgano",      hint: "Seleccionar sociedad, órgano convocante y tipo de reunión" },
  { n: 2, label: "Fecha y plazo legal",     hint: "Calcular antelación según jurisdicción y forma jurídica" },
  { n: 3, label: "Orden del día",           hint: "Clasificar ítems en ordinaria / estatutaria / estructural" },
  { n: 4, label: "Destinatarios",           hint: "Miembros del órgano que recibirán la convocatoria" },
  { n: 5, label: "Publicación y comunicación", hint: "Publicación / notificación / interposición EAD" },
  { n: 6, label: "Adjuntos",                hint: "Documentos de referencia y propuestas que se adjuntan" },
  { n: 7, label: "Borrador documento",      hint: "Plantilla + capa 3 editable + borrador final del texto" },
  { n: 8, label: "Revisión y registro",     hint: "Verificación y registro de la simulación DEMO sin efecto jurídico" },
];

const JURIS_FLAGS: Record<string, string> = { ES: "🇪🇸", PT: "🇵🇹", BR: "🇧🇷", MX: "🇲🇽" };

const CHANNEL_OPTIONS: Record<string, { value: string; label: string; recommended?: boolean }[]> = {
  ES: [
    { value: "WEB_CORPORATIVA",    label: "Web corporativa (art. 173 LSC)", recommended: true },
    { value: "BORME",              label: "BORME" },
    {
      value: EAD_INTERPOSITION_CHANNEL,
      label: "EAD Trust · interposición, mensajería básica y custodia (sin firma ni ERDS)",
    },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado" },
    { value: "BUROFAX",            label: "Burofax" },
    { value: "EMAIL_SIMPLE",       label: "Email simple a los miembros del órgano" },
  ],
  PT: [
    { value: "JORNAL_OFICIAL",  label: "Diário da República", recommended: true },
    { value: "JORNAL_DIARIO",   label: "Jornal diário de grande circulação" },
    { value: "WEB_CORPORATIVA", label: "Site corporativo" },
    {
      value: EAD_INTERPOSITION_CHANNEL,
      label: "EAD Trust · interposição, mensagem básica e custódia (sem assinatura nem ERDS)",
    },
    { value: "EMAIL_SIMPLE",    label: "Email simple aos membros do órgão" },
  ],
  BR: [
    { value: "DIARIO_OFICIAL",    label: "Diário Oficial do Estado", recommended: true },
    { value: "JORNAL_CIRCULACAO", label: "Jornal de grande circulação" },
    { value: "WEB_CORPORATIVA",   label: "Site corporativo" },
    { value: "EMAIL_SIMPLE",      label: "Email simples aos membros do órgão" },
  ],
  MX: [
    { value: "DOF",                label: "Diario Oficial de la Federación", recommended: true },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado a socios" },
    { value: "WEB_CORPORATIVA",    label: "Sitio corporativo" },
    {
      value: EAD_INTERPOSITION_CHANNEL,
      label: "EAD Trust · interposición, mensajería básica y custodia (sin firma ni ERDS)",
    },
    { value: "EMAIL_SIMPLE",       label: "Email simple a los miembros del órgano" },
  ],
};

// BATCH 8.5 (ronda 2 U-C) + corrección post-revisión adversarial:
// Filtra canales según body_type del órgano. La revisión reveló que mi
// mapping inicial solo cubría 'CDA' y 'COMISION_DELEGADA' pero ARGA
// Seguros (cliente demo) usa body_types 'COMISION' y 'COMITE' (sin _DELEGADA)
// → para esos órganos caía al default mostrando toda la lista pública
// (BORME etc.) que no aplica.
//
// Reglas:
//   JUNTA → todos los canales (publicidad oficial art. 173 LSC + EAD opcional)
//   CDA / COMISION / COMITE / COMISION_DELEGADA → notificación directa
//     al miembro (email, correo certificado, interposición EAD, burofax)
const CHANNELS_RELEVANT_BY_BODY_TYPE: Record<string, Set<string>> = {
  JUNTA: new Set([]),  // empty = no filter, mostrar todos
  CDA: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", EAD_INTERPOSITION_CHANNEL, "BUROFAX"]),
  COMISION: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", EAD_INTERPOSITION_CHANNEL, "BUROFAX"]),
  COMISION_DELEGADA: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", EAD_INTERPOSITION_CHANNEL, "BUROFAX"]),
  COMITE: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", EAD_INTERPOSITION_CHANNEL, "BUROFAX"]),
};

// BATCH 8.3 (ronda 2 U-A): tooltips para clarificar las 3 clases de materia.
// Antes solo se mostraban las etiquetas sin explicación → confusión usuario.
const AGENDA_TIPOS = [
  {
    value: "ORDINARIA",
    label: "Ordinaria",
    hint: "Mayoría simple (>50%). Gestión ordinaria del órgano: cuentas, nombramientos, dividendos, etc.",
  },
  {
    value: "ESTATUTARIA",
    label: "Estatutaria",
    hint: "Mayoría reforzada (art. 199 LSC para SL = mayoría 2/3 votos / art. 201 LSC para SA). Modifica estatutos: capital, denominación, domicilio.",
  },
  {
    value: "ESTRUCTURAL",
    label: "Estructural (inscribible)",
    hint: "Mayoría reforzada + escritura pública + notario + registro mercantil. Operaciones estructurales: fusión, escisión, transformación, disolución.",
  },
] as const;

// agenda_item.kind v3.1: naturaleza del punto del orden del día.
// Solo los puntos DECISORIO (label visible: "Acuerdo") se someten a votación
// y materializan como acuerdo registrable. El resto se documenta en acta como
// constancia, deliberación, toma de razón, informe o ruegos/preguntas.
const KIND_OPTIONS: { value: AgendaItemKind; label: string; helper: string }[] = [
  {
    value: "DECISORIO",
    label: "Acuerdo",
    helper: "Propuesta concreta sometible a votación y materializable como acuerdo registrable.",
  },
  {
    value: "INFORMATIVO",
    label: "Informativo",
    helper: "Solo informe, sin decisión ni debate formal.",
  },
  {
    value: "TOMA_DE_RAZON",
    label: "Toma de razón",
    helper: "Constancia de un hecho o acto ya producido, sin manifestación de voluntad.",
  },
  {
    value: "DELIBERATIVO",
    label: "Deliberativo",
    helper: "Debate y conclusiones, sin votación formal.",
  },
  {
    value: "ACEPTACION_INFORME",
    label: "Aceptación de informe",
    helper: "Recepción de informe con conformidad u observaciones, sin activar gates de validez LSC.",
  },
  {
    value: "RUEGOS_PREGUNTAS",
    label: "Ruegos y preguntas",
    helper: "Intervenciones, solicitudes o compromisos de respuesta al cierre de la sesión.",
  },
];

// Subtipos de decisión cuando kind === DECISORIO (opcional, NULL por defecto).
const DECISION_SUBTYPE_OPTIONS: { value: AgendaDecisionSubtype; label: string; hint: string }[] = [
  {
    value: "CONSTITUTIVE",
    label: "Constitutivo",
    hint: "Crea, modifica o extingue derechos / obligaciones (ej: aumento capital, nombramiento).",
  },
  {
    value: "RATIFICATORY",
    label: "Ratificatorio",
    hint: "Confirma o convalida un acto previo (ej: ratificación de operación apoderada).",
  },
  {
    value: "ELEVATION",
    label: "Elevación a público",
    hint: "Eleva a escritura pública un acuerdo ya adoptado.",
  },
  {
    value: "ACKNOWLEDGEMENT",
    label: "Acuse / constancia",
    hint: "Deja constancia formal de un hecho sin efectos constitutivos.",
  },
];

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
  EAD_INTERPOSITION: "EAD Trust · interposición, mensajería básica y custodia (sin firma ni ERDS)",
  ERDS: "Canal ERDS histórico · capacidad no acreditada en la demo",
  CORREO_CERTIFICADO: "Correo certificado",
  BUROFAX: "Burofax",
  EMAIL_CON_ACUSE: "Email con acuse",
  EMAIL_SIMPLE: "Email simple",
};

const MANDATE_ROLE_PRIORITY: Record<string, number> = {
  PRESIDENTE: 1,
  VICEPRESIDENTE: 2,
  CONSEJERO_COORDINADOR: 3,
  CONSEJERO: 4,
};

const POLITICAL_BOARD_RECIPIENT_ROLES = new Set([
  "CONSEJERO",
  "PRESIDENTE",
  "VICEPRESIDENTE",
  "CONSEJERO_COORDINADOR",
]);

function newAgendaItem(organoTipo: TipoOrgano = "JUNTA_GENERAL"): AgendaItem {
  const materia = materiaInformativaDefault();
  return {
    id: crypto.randomUUID(),
    titulo: "",
    materia: materia.value,
    tipo: "ORDINARIA",
    inscribible: false,
    // La UI crea un punto informativo explícito con categoría visible. Así
    // nunca nace con una materia decisoria oculta bajo el default de BD.
    kind: "INFORMATIVO",
    decision_subtype: null,
    propuesta_acuerdo: null,
    requires_attachments: false,
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

function materiaClaseFromTipo(tipo: AgendaItem["tipo"]) {
  if (tipo === "ESTATUTARIA") return "ESTATUTARIA";
  if (tipo === "ESTRUCTURAL") return "ESTRUCTURAL";
  return "ORDINARIA";
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
  // Los códigos históricos son únicamente legibles: ni siquiera una
  // coincidencia literal puede convertirlos en capacidad válida de captura.
  if (isLegacyErdsChannel(selectedValue) || isLegacyErdsChannel(reminderValue)) return false;
  if (selectedValue === reminderValue) return true;

  const webChannels = new Set(["WEB_SOCIEDAD", "WEB_CORPORATIVA"]);
  if (webChannels.has(selectedValue) && webChannels.has(reminderValue)) return true;

  // La interposición EAD solo satisface el recordatorio canónico homónimo. No
  // se interpreta como una capacidad histórica distinta ni como acreditación
  // de un resultado externo.
  if (selectedValue === EAD_INTERPOSITION_CHANNEL || reminderValue === EAD_INTERPOSITION_CHANNEL) return false;

  const individualNoticeChannels = new Set([
    "NOTIFICACION",
    "PERSONALIZADA",
    "NOTIFICACION_CERTIFICADA",
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

function firstText(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function entityDomicilioSocial(entity: {
  registered_address?: string | null;
  address?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_floor?: string | null;
  postal_code?: string | null;
  city?: string | null;
} | null | undefined) {
  if (!entity) return "";
  const direct = firstText(entity.registered_address, entity.address);
  if (direct) return direct;
  return [
    entity.address_street,
    entity.address_number,
    entity.address_floor,
    entity.postal_code,
    entity.city,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

function isConvocatoriaType(value: string | null | undefined): value is "ORDINARIA" | "EXTRAORDINARIA" | "UNIVERSAL" {
  return value === "ORDINARIA" || value === "EXTRAORDINARIA" || value === "UNIVERSAL";
}

function isFormatoReunion(value: string | null | undefined): value is "PRESENCIAL" | "TELEMATICA" | "MIXTA" {
  return value === "PRESENCIAL" || value === "TELEMATICA" || value === "MIXTA";
}

function normalizeAgendaDraftItems(items: ConvocatoriaWithBody["agenda_items"], organoTipo: TipoOrgano): AgendaItem[] {
  if (!Array.isArray(items) || items.length === 0) return [newAgendaItem(organoTipo)];
  return items.map((item) => {
    const kind = item.kind ?? "DELIBERATIVO";
    const rawMateria = item.materia ?? "";
    // Los expedientes anteriores a la ruta gobernada conservan el código
    // genérico NOMBRAMIENTO_REPRESENTANTE_FILIAL. En una nueva captura no
    // puede quedar como valor huérfano (el catálogo ya no lo ofrece): lo
    // elevamos a la materia canónica para que el Paso 3 exija filial,
    // representante, delegación vigente y propuesta condicionada.
    const normalizedRawMateria =
      kind === "DECISORIO" && rawMateria === "NOMBRAMIENTO_REPRESENTANTE_FILIAL"
        ? "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
        : rawMateria;
    const materia = kind === "DECISORIO"
      ? (
          isMateriaInformativa(normalizedRawMateria)
            ? materiaDefaultForOrgano(organoTipo).value
            : normalizedRawMateria || materiaDefaultForOrgano(organoTipo).value
        )
      : (isMateriaInformativa(normalizedRawMateria) ? normalizedRawMateria : "");
    const meta = AGENDA_MATERIAS.find((m) => m.value === materia);
    return {
      id: crypto.randomUUID(),
      titulo: item.titulo ?? "",
      materia,
      tipo: ((item.tipo ?? meta?.tipo ?? "ORDINARIA") as AgendaItem["tipo"]),
      inscribible: kind === "DECISORIO" ? (item.inscribible ?? meta?.inscribible ?? false) : false,
      kind,
      decision_subtype: kind === "DECISORIO" ? (item.decision_subtype ?? null) : null,
      propuesta_acuerdo: kind === "DECISORIO" ? (item.propuesta_acuerdo ?? null) : null,
      requires_attachments:
        kind === "DECISORIO" && (materia === "FORMULACION_CUENTAS" || item.requires_attachments === true),
      target_entity_id:
        materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
          ? (item.target_entity_id ?? null)
          : null,
      representative_person_id:
        materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
          ? (item.representative_person_id ?? null)
          : null,
      representation_authority_route:
        materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
          ? (item.representation_authority_route ?? null)
          : null,
      representation_delegation_id:
        materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
          ? (item.representation_delegation_id ?? null)
          : null,
      representation_evidence_status:
        materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
          ? (item.representation_evidence_status ?? null)
          : null,
    };
  });
}

function excludedRecipientsFromTrace(trace: Record<string, unknown> | null | undefined) {
  const recipients = trace && typeof trace === "object" ? trace.recipients : null;
  if (!recipients || typeof recipients !== "object" || Array.isArray(recipients)) return new Set<string>();
  const ids = (recipients as { excluded_person_ids?: unknown }).excluded_person_ids;
  if (!Array.isArray(ids)) return new Set<string>();
  return new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0));
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
  const { user } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const scopedEntityId =
    searchParams.get("scope") === "sociedad" ? searchParams.get("entity") : null;
  const requestedPlantillaId = searchParams.get("plantilla");
  // Lote 1 coherencia (A2): `?materia=<code>` es el intake del proceso de
  // adopción desde Materias y reglas / Tramitador — pre-siembra el primer
  // punto del orden del día con la materia canónica.
  const requestedMateriaParam = searchParams.get("materia");
  const requestedMateria = requestedMateriaParam ? resolveMateriaAlias(requestedMateriaParam) : null;
  // ITEM-097: `?draft=<id>` permite retomar una convocatoria en estado
  // BORRADOR (p.ej. las creadas por campañas de grupo) para completarla y
  // emitirla, en vez de quedar como dead-end sin ruta de continuación.
  // `?clonarDe=<id>` es el alias usado por el botón "Usar como base / Clonar
  // como nueva" del detalle read-only: reutiliza exactamente el mismo prefill
  // (órgano, entidad, tipo de sesión, fechas, canales, agenda…) sin copiar
  // identificadores ni estado del origen.
  const requestedDraftId = searchParams.get("draft") ?? searchParams.get("clonarDe");
  const isSociedadScoped = Boolean(scopedEntityId);
  const scopedListPath = isSociedadScoped && scopedEntityId
    ? `/secretaria/convocatorias?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/convocatorias";
  const scopedReunionesPath = isSociedadScoped && scopedEntityId
    ? `/secretaria/reuniones?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/reuniones";
  const createConvocatoria = useCreateConvocatoria();
  const uploadAttachment = useUploadConvocatoriaAttachment();
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
  const [templateCapa3Values, setTemplateCapa3Values] = useState<Capa3Values>({});
  const [templateCapa3Errors, setTemplateCapa3Errors] = useState<Record<string, string>>({});

  // ── Step 1 ──
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(() => scopedEntityId);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [tipoConvocatoria, setTipoConvocatoria] = useState<"ORDINARIA" | "EXTRAORDINARIA" | "UNIVERSAL">("ORDINARIA");
  const previousScopedEntityIdRef = useRef(scopedEntityId);

  useEffect(() => {
    if (!scopedEntityId) return;
    setSelectedEntityId((current) => (current === scopedEntityId ? current : scopedEntityId));
    // Fast Refresh vuelve a ejecutar efectos conservando el estado React. El
    // reset incondicional anterior borraba el Consejo ya seleccionado mientras
    // `appliedDraftRef` impedía rehidratarlo, y el motor degradaba la agenda a
    // JUNTA_GENERAL. Solo se limpia el órgano cuando cambia realmente la
    // sociedad del scope.
    if (previousScopedEntityIdRef.current !== scopedEntityId) {
      setSelectedBodyId(null);
    }
    previousScopedEntityIdRef.current = scopedEntityId;
  }, [scopedEntityId]);

  const { data: entities = [], isLoading: entitiesLoading } = useEntitiesList({ sociedadesOnly: true });
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
  const { data: convocanteAuthority } = usePresidenteVigente(
    selectedEntityId ?? undefined,
    selectedBodyId,
  );
  const lastResolvedOrganoTipoRef = useRef<TipoOrgano>("JUNTA_GENERAL");
  const resolvedOrganoTipo = selectedBody ? resolveOrganoTipo(selectedBody) : null;
  if (resolvedOrganoTipo) lastResolvedOrganoTipoRef.current = resolvedOrganoTipo;
  const bodiesPending = Boolean(selectedEntityId && (entitiesLoading || bodiesLoading || bodiesFetching));
  const jurisdiction = selectedEntity?.jurisdiction ?? "ES";
  const tipoSocial = toTipoSocial(selectedEntity?.tipo_social ?? selectedEntity?.legal_form);
  const organoTipo = resolvedOrganoTipo ?? (
    selectedBodyId ? lastResolvedOrganoTipoRef.current : "JUNTA_GENERAL"
  );
  const domicilioSocial = entityDomicilioSocial(selectedEntity);
  const { data: readiness } = useEntityDemoReadiness(selectedEntityId);
  const readinessBlocked = readiness?.status === "reference_only";
  const { data: previousConvocatorias = [] } = useConvocatoriasList(selectedEntityId);

  // ── Step 3 ──
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([newAgendaItem()]);
  const agendaRuleSpecs = agendaItemsForDecisionEngine(agendaItems)
    // BATCH 8.3 (ronda 2 U-A): filtrar materias libres antes del motor.
    // OTROS_LIBRE indica intencionalmente que el secretario asume el punto
    // como no decisorio / sin reglas LSC aplicables — no es bug, es diseño.
    .filter((item) => !MATERIAS_LIBRES.has(item.materia))
    .map((item) => ({
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
  // ITEM-033: el rule set debe corresponder al ÓRGANO convocado. Antes se
  // tomaba find(is_active) ?? [0] sin orden determinista: el badge de preaviso
  // y el statutory_basis persistido podían ser los de otro órgano (p.ej.
  // 'art. 247' de CdA en una convocatoria de JGA, o 3 días para una junta).
  const ruleSetTypologiesForOrgano: string[] =
    organoTipo === "JUNTA_GENERAL"
      ? ["JUNTA_GENERAL", "JGA", "JGE"]
      : organoTipo === "CONSEJO"
        ? ["CONSEJO_ADMINISTRACION", "CDA", "CONSEJO"]
        : ["COMISION_DELEGADA", "COMISION", "COMITE"];
  const activeRuleSet =
    ruleSets.find(
      (r) =>
        r.is_active &&
        ruleSetTypologiesForOrgano.includes(String(r.typology_code ?? "").toUpperCase())
    ) ?? null;
  const liveNoticeDays = activeRuleSet?.rule_config?.notice_min_days_first_call ?? null;

  // ── Step 2 ──
  const [fechaReunion, setFechaReunion] = useState("");
  const {
    data: shareholderRepresentationCandidates = [],
    isLoading: shareholderRepresentationCandidatesLoading,
    error: shareholderRepresentationCandidatesError,
  } = useShareholderRepresentationCandidates(
    selectedEntityId ?? undefined,
    fechaReunion || undefined,
  );
  const agendaTitleForDocument = useCallback((item: AgendaItem) => {
    if (item.materia !== "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL") {
      return item.titulo;
    }
    const target = entities.find((entity) => entity.id === item.target_entity_id);
    const candidate = shareholderRepresentationCandidates.find(
      (row) => row.delegation_id === item.representation_delegation_id,
    );
    const targetName = target?.legal_name ?? target?.common_name ?? "filial pendiente";
    const representativeName = candidate?.representative_name ?? "representante pendiente";
    return `${item.titulo} — Filial: ${targetName}; representante propuesta: ${representativeName}`;
  }, [entities, shareholderRepresentationCandidates]);
  const canonicalAgendaSummary = useMemo(
    () =>
      agendaItems
        .filter((item) => item.titulo.trim())
        .map(
          (item, index) =>
            `${index + 1}. ${agendaTitleForDocument(item)}${
              item.kind === "DECISORIO"
                ? ` (Acuerdo · ${labelMateria(item.materia)})`
                : ""
            }`,
        )
        .join("\n"),
    [agendaItems, agendaTitleForDocument],
  );
  const [horaReunion, setHoraReunion] = useState("10:00");
  // A.2 (art. 176.2 LSC): fecha de remisión del anuncio al último socio cuando la
  // convocatoria es por comunicación individual y escrita; el motor computa el
  // "un mes" desde aquí (vía fechaPublicacion). Vacío → desde la convocatoria.
  const [fechaRemisionUltimoSocio, setFechaRemisionUltimoSocio] = useState("");
  const [lugar, setLugar] = useState("");
  const [formatoReunion, setFormatoReunion] = useState<"PRESENCIAL" | "TELEMATICA" | "MIXTA">("PRESENCIAL");
  const [habilitarSegunda, setHabilitarSegunda] = useState(false);
  const [fechaReunion2, setFechaReunion2] = useState("");
  const [horaReunion2, setHoraReunion2] = useState("10:30");
  // ITEM-034 — art. 177 LSC: la segunda convocatoria es figura exclusiva de
  // la junta de SA/SAU (177.1) y entre ambas reuniones debe mediar al menos
  // un plazo de 24 horas (177.2).
  const segundaConvocatoriaDisponible =
    organoTipo === "JUNTA_GENERAL" && (tipoSocial === "SA" || tipoSocial === "SAU");
  const segundaConvocatoriaGapWarning = (() => {
    if (!habilitarSegunda || !fechaReunion || !fechaReunion2) return null;
    if (!segundaConvocatoriaGapIncumplido(fechaReunion, horaReunion, fechaReunion2, horaReunion2)) return null;
    const gapHours = gapSegundaConvocatoriaHoras(fechaReunion, horaReunion, fechaReunion2, horaReunion2);
    return `Entre la primera y la segunda convocatoria debe mediar, por lo menos, un plazo de 24 horas (art. 177.2 LSC). Gap actual: ${gapHours?.toFixed(1)} h.`;
  })();
  const lastAutoLugarRef = useRef("");

  useEffect(() => {
    if (!domicilioSocial) return;
    setLugar((currentLugar) => {
      const shouldAutofill = !currentLugar.trim() || currentLugar === lastAutoLugarRef.current;
      if (!shouldAutofill) return currentLugar;
      lastAutoLugarRef.current = domicilioSocial;
      return domicilioSocial;
    });
  }, [domicilioSocial]);

  const lugarRequired = formatoReunion !== "TELEMATICA";

  // ITEM-142: el fallback (sin fecha aún) alimenta SOLO el preview
  // date-independiente del Paso 2 (antelación requerida, canales y documentos
  // obligatorios, que no dependen de la fecha). Los indicadores date-dependientes
  // (convergencia V1/V2, "plazo cumplido/no cumplido") están gateados por
  // `fechaReunion` para no emitir veredictos sobre esta fecha ficticia. El paso 2
  // exige fecha real para avanzar (canMoveNext case 2).
  const meetingIso = fechaReunion
    ? new Date(`${fechaReunion}T${horaReunion}:00`).toISOString()
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const noticeOkV1 = checkNoticePeriodByType({
    meetingDate: meetingIso,
    jurisdiction,
    convocationType: tipoConvocatoria,
    tipoSocial,
    organoTipo,
  });

  const convocatoriaInput: ConvocatoriaInput = {
    tipoSocial,
    organoTipo,
    adoptionMode: "MEETING",
    fechaJunta: meetingIso,
    // Lectura canonical desde `entities.es_cotizada` (override en
    // entity_settings no se aplica aquí — el motor V2 lo recibe ya
    // resuelto desde variable-resolver en otros flujos. Para el motor
    // de convocatoria nos basta la columna directa).
    esCotizada: Boolean(selectedEntity?.es_cotizada),
    webInscrita: true,
    primeraConvocatoria: true,
    esJuntaUniversal: tipoConvocatoria === "UNIVERSAL",
    // agenda_item.kind v3.1: motor V2 solo recibe materias DECISORIO.
    materias: agendaItemsForDecisionEngine(agendaItems)
      .map((i) => i.materia),
    // Codex P2 round 17 PR #3: jurisdiction es necesaria para elegir el
    // canal de fallback non-junta que la UI de cada país sí puede
    // ofrecer (interposición EAD para ES/PT, CORREO_CERTIFICADO para MX,
    // EMAIL_SIMPLE para BR).
    jurisdiction,
    organoNoticeDays:
      organoTipo === "JUNTA_GENERAL" || typeof liveNoticeDays !== "number"
        ? undefined
        : liveNoticeDays,
    // A.2 (art. 176.2 LSC): si se informa la fecha de remisión al último socio, el
    // motor computa el plazo desde esa fecha (Rule 6 de convocatoria-engine).
    fechaPublicacion: fechaRemisionUltimoSocio || undefined,
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
    setAgendaItems((prev) => [...prev, newAgendaItem(organoTipo)]);
  }
  function removeAgendaItem(id: string) {
    setAgendaItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateAgendaItem(id: string, patch: Partial<AgendaItem>) {
    setAgendaItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  }

  useEffect(() => {
    const defaultMateria = materiaDefaultForOrgano(organoTipo);
    setAgendaItems((prev) =>
      prev.map((item) => {
        const isEmptyDraft = item.titulo.trim().length === 0 && !item.propuesta_acuerdo?.trim();
        if (!isEmptyDraft || isMateriaCompatibleWithOrgano(item.materia, organoTipo)) return item;
        return {
          ...item,
          materia: defaultMateria.value,
          tipo: defaultMateria.tipo,
          inscribible: defaultMateria.inscribible,
        };
      }),
    );
  }, [organoTipo]);

  // ── Step 4 ──
  const { data: mandates = [] } = useBodyMandates(selectedBodyId ?? undefined);
  const { data: capitalHoldings = [] } = useCapitalHoldings(selectedEntityId ?? undefined);
  // La convocatoria del Consejo se dirige a sus miembros políticos, no a los
  // cargos operativos de Secretaría. El corte temporal es fecha_1: incorpora
  // PROGRAMADO en futuro y CESADO en histórico, igual que el censo servidor.
  const activeMandates = useMemo(() => {
    const effectiveDay = fechaReunion || new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
    }).format(new Date());
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
    }).format(new Date());
    const byPerson = new Map<string, (typeof mandates)[number]>();
    for (const mandate of mandates) {
      const role = String(mandate.role ?? "").toUpperCase();
      const state = String(mandate.source_status ?? "").toUpperCase();
      const stateValid = effectiveDay > today
        ? state === "VIGENTE" || state === "PROGRAMADO"
        : effectiveDay < today
          ? state === "VIGENTE" || state === "CESADO"
          : state === "VIGENTE";
      if (
        !mandate.person_id
        || !POLITICAL_BOARD_RECIPIENT_ROLES.has(role)
        || String(mandate.seat_semantics ?? "PRIMARY").toUpperCase() === "ACCESSORY"
        || !stateValid
        || (mandate.start_date && mandate.start_date > effectiveDay)
        || (mandate.end_date && mandate.end_date < effectiveDay)
      ) continue;
      if (!byPerson.has(mandate.person_id)) byPerson.set(mandate.person_id, mandate);
    }
    return [...byPerson.values()].sort((a, b) => {
      const pa = MANDATE_ROLE_PRIORITY[a.role ?? ""] ?? 99;
      const pb = MANDATE_ROLE_PRIORITY[b.role ?? ""] ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "", "es");
    });
  }, [fechaReunion, mandates]);
  const activeRecipients = useMemo(() => {
    if (organoTipo !== "JUNTA_GENERAL") return activeMandates;

    const byPersonId = new Map<string, (typeof activeMandates)[number]>();
    for (const holding of capitalHoldings) {
      if (!holding.holder_person_id || holding.is_treasury || holding.voting_rights === false) continue;
      const existing = byPersonId.get(holding.holder_person_id);
      const fullName =
        holding.holder?.full_name ??
        holding.holder?.denomination ??
        existing?.full_name ??
        "Socio";
      byPersonId.set(holding.holder_person_id, {
        id: existing?.id ?? `holding:${holding.id}`,
        body_id: selectedBodyId ?? "",
        person_id: holding.holder_person_id,
        role: tipoSocial === "SA" || tipoSocial === "SAU" ? "ACCIONISTA" : "SOCIO",
        type: "CAPITAL_HOLDER",
        start_date: holding.effective_from ?? null,
        end_date: holding.effective_to ?? null,
        status: "Activo",
        full_name: fullName,
        email: existing?.email ?? null,
        porcentaje_capital: holding.porcentaje_capital,
        share_class: holding.share_class?.class_code ?? null,
      });
    }

    return Array.from(byPersonId.values()).sort((a, b) =>
      (a.full_name ?? "").localeCompare(b.full_name ?? "", "es"),
    );
  }, [activeMandates, capitalHoldings, organoTipo, selectedBodyId, tipoSocial]);
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
  // BATCH 8.5 (ronda 2 U-C): filtrar canales según body_type del órgano
  // convocado. JUNTA → lista completa (publicidad oficial); CDA / COMISION
  // → solo notificación directa (email/correo certificado/EAD/burofax).
  // Sin este filtro, el secretario ve toda la lista cuando convoca CdA y
  // genera ruido innecesario.
  const channelOptsBase = CHANNEL_OPTIONS[jurisdiction] ?? CHANNEL_OPTIONS["ES"];
  const bodyTypeForChannels = selectedBody?.body_type?.toUpperCase() ?? "JUNTA";
  const relevantChannelSet = CHANNELS_RELEVANT_BY_BODY_TYPE[bodyTypeForChannels];
  const channelOpts = useMemo(
    () =>
      relevantChannelSet && relevantChannelSet.size > 0
        ? channelOptsBase.filter((ch) => relevantChannelSet.has(ch.value))
        : channelOptsBase,
    [channelOptsBase, relevantChannelSet],
  );
  const [channels, setChannels] = useState<string[]>([]);
  function toggleChannel(val: string) {
    setChannels((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val],
    );
  }
  const [cloneSourceId, setCloneSourceId] = useState("");
  const cloneCandidates = useMemo(
    () =>
      previousConvocatorias
        .filter((convocatoria) => convocatoria.body_id === selectedBodyId)
        .filter((convocatoria) => convocatoria.tipo_convocatoria !== "UNIVERSAL")
        .slice(0, 8),
    [previousConvocatorias, selectedBodyId],
  );

  useEffect(() => {
    setCloneSourceId("");
  }, [selectedBodyId]);

  function applyCloneFromConvocatoria(sourceId: string) {
    const source = cloneCandidates.find((convocatoria) => convocatoria.id === sourceId);
    if (!source) return;

    if (isConvocatoriaType(source.tipo_convocatoria) && source.tipo_convocatoria !== "UNIVERSAL") {
      setTipoConvocatoria(source.tipo_convocatoria);
    }
    if (isFormatoReunion(source.modalidad)) {
      setFormatoReunion(source.modalidad);
    }
    setLugar(source.lugar ?? domicilioSocial);
    lastAutoLugarRef.current = source.lugar ?? domicilioSocial;
    // Compatibilidad histórica: las capturas ERDS se pueden consultar, pero
    // al clonarlas pasan al valor seguro de nueva captura EAD_INTERPOSITION.
    setChannels(channelsForNewCapture(source.publication_channels));
    setExcludedPersonIds(excludedRecipientsFromTrace(source.reminders_trace));
    setAgendaItems(normalizeAgendaDraftItems(source.agenda_items, organoTipo));
    setDocumentosIncluidos(new Set());
    setBorradorDirty(false);
    setCloneSourceId(source.id);
    toast.success("Convocatoria anterior aplicada como borrador", {
      description: "Fecha y hora se mantienen como nueva captura; el motor re-evaluará la agenda final.",
    });
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
  // Lote 1 coherencia (A2): un MODELO_ACUERDO también es intake válido — la
  // convocatoria es la apertura de su proceso de adopción y el modelo siembra
  // el punto DECISORIO del orden del día.
  const isRequestedModeloTemplate = requestedPlantilla?.tipo === "MODELO_ACUERDO";
  const isRequestedTemplateFlowCompatible =
    requestedTemplateMatrix?.processId === "convocatoria" ||
    requestedTemplateMatrix?.processId === "informe_pre" ||
    isRequestedModeloTemplate;
  const requestedTemplateCapa3Fields = requestedTemplateMatrix?.capa3Fields ?? [];
  const requestedTemplatePendingCapa3 = requestedTemplateCapa3Fields.filter(
    (field) => isRequiredCapa3Field(field) && !capa3ValueToText(templateCapa3Values[field.campo]),
  ).length;
  const requestedTemplateTraceEvidence = useMemo(
    () => buildTemplateTraceEvidence(requestedPlantilla, requestedTemplateMatrix),
    [requestedPlantilla, requestedTemplateMatrix],
  );

  // Lote 1 coherencia (A2): catálogo societario para resolver el label
  // jurídico y la clase LSC de materias que no existen en AGENDA_MATERIAS
  // (p.ej. DIVIDENDO_A_CUENTA, ADQUISICION_PROPIA). Solo clases compatibles
  // con `agreements` (ORDINARIA/ESTATUTARIA/ESTRUCTURAL).
  const { data: materiaCatalogRows = [], isLoading: materiaCatalogLoading } = useMateriaCatalog();
  const findCatalogMateria = useCallback(
    (canonical: string | null) =>
      canonical
        ? materiaCatalogRows.find((row) => resolveMateriaAlias(row.materia) === canonical) ?? null
        : null,
    [materiaCatalogRows],
  );

  useEffect(() => {
    if (!requestedPlantillaId || !requestedPlantilla || appliedPlantillaId === requestedPlantillaId) return;
    if (!isRequestedConvocatoriaTemplate && !isRequestedModeloTemplate) return;

    const canonicalTemplateMateria = requestedTemplateMateria
      ? resolveMateriaAlias(requestedTemplateMateria)
      : null;
    const materiaMeta = canonicalTemplateMateria
      ? AGENDA_MATERIAS.find((materia) => materia.value === canonicalTemplateMateria)
      : null;
    // Si la materia no está en la agenda, espera al catálogo para derivar
    // label y clase LSC reales en vez de heredar los del punto placeholder.
    if (canonicalTemplateMateria && !materiaMeta && materiaCatalogLoading) return;
    const catalogRow = materiaMeta ? null : findCatalogMateria(canonicalTemplateMateria);

    if (canonicalTemplateMateria || materiaMeta) {
      setAgendaItems((prev) => {
        const first = prev[0] ?? newAgendaItem();
        return [
          {
            ...first,
            titulo:
              first.titulo.trim() ||
              materiaMeta?.label ||
              catalogRow?.materia_label_es ||
              labelMateria(canonicalTemplateMateria),
            materia: materiaMeta?.value ?? canonicalTemplateMateria ?? first.materia,
            tipo: (materiaMeta?.tipo ?? catalogRow?.matter_class ?? first.tipo) as AgendaItem["tipo"],
            inscribible: materiaMeta?.inscribible ?? first.inscribible,
            // agenda_item.kind v3.1: si llega una plantilla MODELO_ACUERDO,
            // el punto se trata como DECISORIO (se va a votar). Las plantillas
            // de convocatoria sin materia conservan el kind por defecto.
            kind: "DECISORIO",
          },
          ...prev.slice(1),
        ];
      });
    }

    if (requestedPlantilla.tipo === "CONVOCATORIA_SL_NOTIFICACION") {
      setChannels((prev) => (
        prev.includes(EAD_INTERPOSITION_CHANNEL)
          ? prev
          : [...prev, EAD_INTERPOSITION_CHANNEL]
      ));
    }

    setAppliedPlantillaId(requestedPlantillaId);
  }, [appliedPlantillaId, findCatalogMateria, isRequestedConvocatoriaTemplate, isRequestedModeloTemplate, materiaCatalogLoading, requestedPlantilla, requestedPlantillaId, requestedTemplateMateria]);

  // Lote 1 coherencia (A2): intake por materia sin plantilla — incorpora la
  // materia canónica como primer punto DECISORIO del orden del día.
  const [appliedMateriaParam, setAppliedMateriaParam] = useState<string | null>(null);
  useEffect(() => {
    if (!requestedMateria || requestedPlantillaId || requestedDraftId) return;
    if (appliedMateriaParam === requestedMateria) return;
    const materiaMeta = AGENDA_MATERIAS.find((materia) => materia.value === requestedMateria) ?? null;
    if (!materiaMeta && materiaCatalogLoading) return;
    const catalogRow = materiaMeta ? null : findCatalogMateria(requestedMateria);
    setAgendaItems((prev) => {
      const first = prev[0] ?? newAgendaItem();
      return [
        {
          ...first,
          titulo:
            first.titulo.trim() ||
            materiaMeta?.label ||
            catalogRow?.materia_label_es ||
            labelMateria(requestedMateria),
          materia: materiaMeta?.value ?? requestedMateria,
          tipo: (materiaMeta?.tipo ?? catalogRow?.matter_class ?? first.tipo) as AgendaItem["tipo"],
          inscribible: materiaMeta?.inscribible ?? first.inscribible,
          kind: "DECISORIO",
        },
        ...prev.slice(1),
      ];
    });
    setAppliedMateriaParam(requestedMateria);
  }, [appliedMateriaParam, findCatalogMateria, materiaCatalogLoading, requestedDraftId, requestedMateria, requestedPlantillaId]);

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
  // ── Step 7: Borrador documento ────────────────────────────────────────────
  // Carga plantillas tipo CONVOCATORIA, selecciona la mejor candidata por
  // organoTipo + jurisdiction, expone capa3 editable y un textarea con el
  // borrador renderizado (capa1 con variables sustituidas). El secretario
  // puede editar el texto antes de emitir; se persiste en
  // `convocatorias.convocatoria_text`.
  const { data: plantillasProtegidas = [] } = usePlantillasProtegidas();
  // ITEM-119: DL-4 resuelta por el motor (resolverPlantillaConvocatoria /
  // tiposPlantillaConvocatoriaPreferidos), no reimplementada inline. El motor
  // mapea régimen (SAU→SA, SLU→SL) y cubre los 4 tipos sociales.
  const convocatoriaTemplateTypes = useMemo(
    () => tiposPlantillaConvocatoriaPreferidos(tipoSocial),
    [tipoSocial],
  );
  const autoSelectedTemplate = useMemo<PlantillaProtegidaRow | null>(() => {
    if (!plantillasProtegidas.length) return null;
    return selectProcessTemplate(
      plantillasProtegidas,
      convocatoriaTemplateTypes,
      { jurisdiction, organoTipo },
      requestedPlantillaId ?? undefined,
    );
  }, [plantillasProtegidas, convocatoriaTemplateTypes, jurisdiction, organoTipo, requestedPlantillaId]);

  const [selectedBorradorTemplateId, setSelectedBorradorTemplateId] = useState<string | null>(null);
  // Codex P2 PR #3 round 7: el efectivo SE RESUELVE DESDE `candidateTemplates`
  // (no desde la lista completa). Si el usuario selecciona una plantilla en
  // Paso 7 y luego vuelve a Paso 1 a cambiar entidad/jurisdicción/órgano,
  // candidateTemplates re-filtra y la plantilla previamente seleccionada
  // puede dejar de ser compatible. En ese caso caemos a auto (compatible
  // con el nuevo contexto) en vez de seguir trazando texto legal para
  // contexto incorrecto. Nota: el useMemo necesita ver `candidateTemplates`
  // declarado abajo — declaramos primero el filter, luego el effective.

  // Codex P2 PR #3 round 6: el selector manual debe filtrar por la misma
  // metadata que `selectProcessTemplate()` aplica en auto-selección, para
  // que el usuario no pueda elegir plantillas de otra jurisdicción
  // (PT/MX/BR) ni de un órgano incompatible (CdA vs JGA) y persistir texto
  // legal en contexto erróneo. Las plantillas globales (jurisdiccion o
  // organo_tipo == null/vacío) se consideran compatibles con cualquier
  // contexto — son plantillas-marco multi-jurisdicción.
  const candidateTemplates = useMemo(() => {
    const jurisdictionUpper = (jurisdiction ?? "").toUpperCase();
    const organoTipoUpper = (organoTipo ?? "").toUpperCase();
    return plantillasProtegidas.filter((p) => {
      if (!convocatoriaTemplateTypes.includes(p.tipo)) return false;
      const estadoOk =
        p.estado === "ACTIVA" ||
        p.estado === "APROBADA" ||
        p.estado === "REVISADA" ||
        p.estado === "BORRADOR";
      if (!estadoOk) return false;

      // Jurisdicción: plantilla global (null/vacía) o coincide con la
      // jurisdicción de la entidad.
      const plantillaJurisdiccion = (p.jurisdiccion ?? "").toUpperCase();
      const jurisdiccionOk =
        !plantillaJurisdiccion || !jurisdictionUpper || plantillaJurisdiccion === jurisdictionUpper;
      if (!jurisdiccionOk) return false;

      // Órgano: plantilla global (null/vacía) o coincide con el
      // organoTipo del órgano seleccionado. Matching tolerante por
      // substring para variantes (CDA ↔ CONSEJO_ADMINISTRACION).
      const plantillaOrgano = (p.organo_tipo ?? "").toUpperCase();
      if (!plantillaOrgano || !organoTipoUpper) return true;
      const organoOk =
        plantillaOrgano === organoTipoUpper ||
        plantillaOrgano.includes(organoTipoUpper) ||
        organoTipoUpper.includes(plantillaOrgano);
      return organoOk;
    });
  }, [plantillasProtegidas, convocatoriaTemplateTypes, jurisdiction, organoTipo]);

  // Codex P2 PR #3 round 7 — declaración tras candidateTemplates: resuelve
  // `selectedBorradorTemplateId` ÚNICAMENTE en la lista filtrada por
  // contexto actual. Si la plantilla seleccionada manualmente ya no es
  // compatible (cambio de entidad/jurisdicción/órgano tras la selección),
  // cae a `autoSelectedTemplate`.
  const effectiveBorradorTemplate = useMemo<PlantillaProtegidaRow | null>(() => {
    if (selectedBorradorTemplateId) {
      const matchedInCurrent = candidateTemplates.find((p) => p.id === selectedBorradorTemplateId);
      if (matchedInCurrent) return matchedInCurrent;
      // La selección previa ya no encaja con el contexto actual.
      return autoSelectedTemplate;
    }
    return autoSelectedTemplate;
  }, [autoSelectedTemplate, candidateTemplates, selectedBorradorTemplateId]);

  // Limpiar `selectedBorradorTemplateId` cuando ya no exista en la lista
  // filtrada, para que el selector NO muestre un valor stale. Evita
  // confusión visual: el `<select>` mostraría "— Seleccionar plantilla —"
  // mientras el id en estado sigue siendo el anterior.
  useEffect(() => {
    if (!selectedBorradorTemplateId) return;
    const stillCompatible = candidateTemplates.some((p) => p.id === selectedBorradorTemplateId);
    if (!stillCompatible) {
      setSelectedBorradorTemplateId(null);
    }
  }, [candidateTemplates, selectedBorradorTemplateId]);

  // Codex P2 round 15 PR #3: preservar `opciones` y `default` del shape
  // canonical de capa3_editables. Sin esto:
  //   - Capa3Form renderiza textarea libre en vez de `<select>` con
  //     opciones cerradas → datos fuera de lista permitida.
  //   - El default sugerido no se prefillea — el usuario tiene que
  //     escribir desde cero aunque la plantilla traiga un valor por defecto.
  //   - `validateCapa3` no rechaza valores fuera de `opciones` (la guarda
  //     del round 5 en capa3-form-validation depende de que el campo
  //     llegue con `opciones`).
  const borradorCapa3BaseFields = useMemo(() => {
    const raw = (effectiveBorradorTemplate?.capa3_editables ?? []) as Array<{
      campo?: string;
      obligatoriedad?: string;
      descripcion?: string;
      opciones?: unknown[];
      default?: unknown;
    }>;
    return raw
      .filter((f): f is { campo: string } & typeof f => typeof f.campo === "string" && f.campo.length > 0)
      .map((f) => {
        const opciones = Array.isArray(f.opciones)
          ? f.opciones.filter((o): o is string => typeof o === "string")
          : undefined;
        const defaultValue = typeof f.default === "string" ? f.default : undefined;
        return {
          campo: f.campo,
          obligatoriedad: f.obligatoriedad ?? "OPCIONAL",
          descripcion: f.descripcion ?? "",
          ...(opciones && opciones.length > 0 ? { opciones } : {}),
          ...(defaultValue !== undefined ? { default: defaultValue } : {}),
        };
      });
  }, [effectiveBorradorTemplate]);
  // El índice documental alimenta Capa 3 y el borrador del Paso 7, por lo que
  // su estado debe existir antes de resolver esos campos derivados.
  const [adjuntos, setAdjuntos] = useState<{
    id: string;
    file: File;
    alias: string;
    descripcion: string;
    error?: string;
  }[]>([]);
  const [borradorCapa3Values, setBorradorCapa3Values] = useState<Capa3Values>({});
  const channelLabelsForCapa3 = useMemo(
    () => channels.map((channel) => channelLabel(channel, channelOpts)),
    [channels, channelOpts],
  );
  const borradorCapa3Resolution = useMemo(
    () =>
      buildConvocatoriaCapa3Resolution(borradorCapa3BaseFields, {
        fechaReunion,
        horaReunion,
        lugar,
        formatoReunion,
        domicilioSocial,
        denominacionSocial: selectedEntity?.legal_name ?? selectedEntity?.common_name ?? "",
        entidadCotizada: Boolean(selectedEntity?.es_cotizada),
        organoNombre: selectedBody?.name ?? "",
        convocanteNombre: convocanteAuthority?.person?.full_name ?? "",
        convocanteCargo: convocanteAuthority?.cargo ?? "",
        agendaSummaryText: canonicalAgendaSummary,
        agendaItems,
        channelLabels: channelLabelsForCapa3,
        attachmentAliases: adjuntos.map((adjunto) => adjunto.alias.trim()).filter(Boolean),
        haySegundaConvocatoria: habilitarSegunda,
      }),
    [
      agendaItems,
      adjuntos,
      borradorCapa3BaseFields,
      channelLabelsForCapa3,
      canonicalAgendaSummary,
      convocanteAuthority?.person?.full_name,
      convocanteAuthority?.cargo,
      domicilioSocial,
      fechaReunion,
      formatoReunion,
      habilitarSegunda,
      horaReunion,
      lugar,
      selectedBody?.name,
      selectedEntity?.common_name,
      selectedEntity?.es_cotizada,
      selectedEntity?.legal_name,
    ],
  );
  const borradorCapa3Fields: ConvocatoriaCapa3Field[] = borradorCapa3Resolution.fields;
  const borradorCapa3PrefillValues = borradorCapa3Resolution.values;
  const lastCapa3PrefillsRef = useRef<Record<string, string>>({});

  // Reset capa3 + prefill defaults cuando cambia la plantilla efectiva.
  // Codex P2 round 15: el reset previo solo ponía `{}`; ahora prefilleamos
  // los defaults de la plantilla para que el usuario no tenga que retipear
  // valores ya sugeridos por Legal.
  useEffect(() => {
    const prefills: Record<string, string> = {};
    for (const f of borradorCapa3Fields) {
      const def = (f as { default?: string }).default;
      if (typeof def === "string" && def.length > 0) {
        prefills[f.campo] = def;
      }
    }
    setBorradorCapa3Values(prefills);
    lastCapa3PrefillsRef.current = {};
  }, [effectiveBorradorTemplate?.id, borradorCapa3BaseFields, borradorCapa3Fields]);

  useEffect(() => {
    setBorradorCapa3Values((currentValues) => {
      const nextValues = { ...currentValues };
      const previousPrefills = lastCapa3PrefillsRef.current;
      let changed = false;

      for (const [campo, value] of Object.entries(borradorCapa3PrefillValues)) {
        const field = borradorCapa3Fields.find((item) => item.campo === campo);
        const currentValue = currentValues[campo] ?? "";
        const previousValue = previousPrefills[campo] ?? "";
        const currentText = capa3ValueToText(currentValue);
        const shouldWrite =
          field?.readonly === true ||
          !currentText ||
          currentText === previousValue;

        if (shouldWrite && currentText !== value) {
          nextValues[campo] = value;
          changed = true;
        }
      }

      lastCapa3PrefillsRef.current = borradorCapa3PrefillValues;
      return changed ? nextValues : currentValues;
    });
  }, [borradorCapa3Fields, borradorCapa3PrefillValues]);

  function handleBorradorCapa3ValuesChange(nextValues: Capa3Values) {
    const nextFecha = firstText(
      nextValues.fecha_sesion,
      nextValues.fecha_reunion,
      nextValues.fecha_junta,
      nextValues.fecha_primera_convocatoria,
    );
    if (/^\d{4}-\d{2}-\d{2}$/.test(nextFecha) && nextFecha !== fechaReunion) {
      setFechaReunion(nextFecha);
    }

    const nextHora = firstText(
      nextValues.hora_sesion,
      nextValues.hora_reunion,
      nextValues.hora_junta,
      nextValues.hora_primera_convocatoria,
    );
    if (/^\d{2}:\d{2}$/.test(nextHora) && nextHora !== horaReunion) {
      setHoraReunion(nextHora);
    }

    const nextLugar = firstText(
      nextValues.lugar_sesion,
      nextValues.lugar_reunion,
      nextValues.lugar_junta,
      nextValues.lugar,
    );
    if (nextLugar && nextLugar !== lugar) {
      setLugar(nextLugar);
    }

    setBorradorCapa3Values(nextValues);
  }

  const borradorVariables = useMemo<Record<string, unknown>>(() => {
    const memberNames = activeRecipients
      .filter((m) => !excludedPersonIds.has(m.person_id))
      .map((m) => m.full_name)
      .filter(Boolean);
    // Codex P1 PR #3 round 3: la plantilla CONVOCATORIA_SL_NOTIFICACION
    // de migration 20260419_000009 usa aliases canonical del contrato
    // variables-plantillas v1.1:
    //   - `{{lugar_junta}}` (alias de `lugar`)
    //   - `{{tipo_junta}}` / `{{tipo_junta_texto}}` (alias de `tipo_convocatoria`)
    //   - `{{#if segunda_convocatoria}}` (boolean, NO `habilitarSegunda`)
    //   - `{{fecha_segunda_convocatoria}}` / `{{hora_segunda_convocatoria}}`
    //     (aliases largos, NO `fecha_segunda` / `hora_segunda`)
    //   - `{{domicilio_social}}`
    // Sin estos aliases, las plantillas omiten la sección de 2ª convocatoria
    // y otros bloques aun cuando el usuario los ha rellenado. Exponemos
    // ambos nombres (corto y largo) para retro-compat con plantillas legacy.
    const tipoJuntaTexto =
      tipoConvocatoria === "ORDINARIA" ? "Junta General Ordinaria"
      : tipoConvocatoria === "EXTRAORDINARIA" ? "Junta General Extraordinaria"
      : "Junta Universal";
    const tipoJuntaBreve =
      tipoConvocatoria === "ORDINARIA" ? "ordinaria"
      : tipoConvocatoria === "EXTRAORDINARIA" ? "extraordinaria"
      : "universal";
    const ordenDelDiaResumen = canonicalAgendaSummary;
    const canalDocumentacion = firstText(
      borradorCapa3Values.canal_documentacion,
      "repositorio documental privado de TGMS",
    );
    const publicacionRef = firstText(
      borradorCapa3Values.publicacion_ref,
      "expediente de publicación y comunicaciones de la convocatoria",
    );
    const votoDistanciaRef = firstText(
      borradorCapa3Values.cotizada_procedimiento_voto_distancia_ref,
      "procedimiento de delegación y voto a distancia publicado en la web corporativa",
    );
    const cotizadaCanalPublicidad = channelLabelsForCapa3.join(", ") || "web corporativa y BORME";

    return {
      denominacion_social: selectedEntity?.legal_name ?? selectedEntity?.common_name ?? "",
      // `cif` = registration_number (alias canonical de plantilla).
      // `domicilio_social` se resuelve desde entities.address /
      // registered_address cuando existe. El usuario puede overridearlo
      // desde Capa 3 si la plantilla lo expone como campo editable.
      cif: selectedEntity?.registration_number ?? "",
      domicilio_social: domicilioSocial,
      // Codex P2 PR #3 round 6: la plantilla CONVOCATORIA (migration
      // 20260419_000008_ajustes_revision_legal) usa `{{#if forma_social == 'SA'}}`
      // mientras nosotros exponíamos solo `tipo_social`. Sin el alias
      // canonical, SA caía al rama else y el texto emitía "socios" en
      // vez de "accionistas" + párrafo de derecho-de-información SL.
      tipo_social: tipoSocial,
      forma_social: tipoSocial,
      entidad_cotizada: selectedEntity?.es_cotizada ? "Sí" : "No",
      es_cotizada: selectedEntity?.es_cotizada ? "Sí" : "No",
      organo_nombre: selectedBody?.name ?? "",
      organo_tipo: organoTipo,
      jurisdiction,

      // Aliases tipo de junta
      tipo_convocatoria: tipoConvocatoria,
      tipo_junta: tipoConvocatoria,
      tipo_junta_texto: tipoJuntaTexto,

      // Aliases lugar
      lugar,
      lugar_junta: lugar,
      lugar_sesion: lugar,
      lugar_reunion: lugar,

      // Fecha / hora primera convocatoria. Codex P2 round 10 PR #3:
      // la plantilla CONVOCATORIA usa `{{fecha_primera_convocatoria}}` y
      // `{{hora_primera_convocatoria}}` (aliases canonical largos),
      // mientras nosotros exponíamos solo `fecha_junta` / `hora_junta`.
      // Sin aliases largos, el render del Paso 7 dejaba en blanco la
      // hora de primera convocatoria aunque el usuario la hubiera
      // rellenado en Paso 2.
      fecha_junta: fechaReunion,
      hora_junta: horaReunion,
      fecha_sesion: fechaReunion,
      hora_sesion: horaReunion,
      fecha_reunion: fechaReunion,
      hora_reunion: horaReunion,
      fecha_primera_convocatoria: fechaReunion,
      hora_primera_convocatoria: horaReunion,
      fecha_emision: new Date().toISOString().slice(0, 10),
      // Lugar y fecha son datos del documento. La eventual interposición o
      // custodia EAD se registra después en el expediente, nunca como una
      // variable de firma o sello dentro de la convocatoria.
      lugar_emision: lugar || domicilioSocial || "Madrid",
      SISTEMA: {
        lugar_emision: lugar || domicilioSocial || "Madrid",
        fecha_emision: new Date().toISOString().slice(0, 10),
      },
      entities: {
        name: selectedEntity?.legal_name ?? selectedEntity?.common_name ?? "",
        es_cotizada: selectedEntity?.es_cotizada ? "SÍ" : "NO",
      },
      persons: {
        socio_destinatario: {
          nombre_completo: memberNames.join(", "),
          nif: "según libro registro",
        },
      },
      agreements: {
        convocatoria: {
          id: "pendiente de emisión",
          fecha_adopcion: new Date().toISOString().slice(0, 10),
          expediente_id: "expediente electrónico de convocatoria TGMS",
          indice_documentacion_ref: "expediente de convocatoria",
        },
      },

      formato_reunion: formatoReunion,
      modalidad_sesion: formatoReunion,
      modalidad_reunion: formatoReunion,

      // Segunda convocatoria — boolean + aliases canonical + cortos.
      segunda_convocatoria: habilitarSegunda,
      hay_segunda_convocatoria: habilitarSegunda,
      fecha_segunda: habilitarSegunda ? fechaReunion2 : "",
      hora_segunda: habilitarSegunda ? horaReunion2 : "",
      fecha_segunda_convocatoria: habilitarSegunda ? fechaReunion2 : "",
      hora_segunda_convocatoria: habilitarSegunda ? horaReunion2 : "",

      antelacion_dias_requerida: evaluacionV2.antelacionDiasRequerida,
      fecha_limite_publicacion: evaluacionV2.fechaLimitePublicacion,
      canales: channelLabelsForCapa3.join(", "),
      canal_convocatoria: channelLabelsForCapa3.join(", "),
      canales_convocatoria: channelLabelsForCapa3.join(", "),
      meetings: {
        junta: {
          tipo_junta: tipoJuntaBreve,
          forma_social: tipoSocial.startsWith("SA") ? "SA" : "SL",
          fecha: fechaReunion,
          hora: horaReunion,
          lugar,
          modalidad: formatoReunion,
          fecha_segunda_convocatoria: habilitarSegunda ? fechaReunion2 : "",
          hora_segunda_convocatoria: habilitarSegunda ? horaReunion2 : "",
          orden_del_dia_resumen: ordenDelDiaResumen,
          canal_documentacion: canalDocumentacion,
          canal_convocatoria: channelLabelsForCapa3.join(", "),
          publicacion_ref: publicacionRef,
          cotizada_canal_publicidad: cotizadaCanalPublicidad,
          cotizada_procedimiento_preguntas_ref:
            "procedimiento de información y preguntas de la Junta General publicado en la web corporativa",
          cotizada_procedimiento_voto_distancia_ref: votoDistanciaRef,
        },
        junta_sl: {
          canal_notificacion: channelLabelsForCapa3.join(", "),
          canal_documentacion: "repositorio documental TGMS",
          tipo_junta: tipoJuntaTexto,
          fecha: fechaReunion,
          hora: horaReunion,
          lugar,
          modalidad: formatoReunion,
          orden_del_dia_resumen: ordenDelDiaResumen,
          fecha_envio: new Date().toISOString().slice(0, 10),
          envio_ref: "TGMS-demo-pending",
          acuse_ref: firstText(borradorCapa3Values["meetings.junta_sl.acuse_ref"], "pendiente de acuse"),
        },
      },
      // Codex P1 PR #3: las plantillas reales (verificado en migration
      // 20260419_000009) hacen `{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}{{/each}}`.
      // Con un string newline-delimited, Handlebars itera caracter por caracter
      // y produce bloque vacío. Pasamos array de objetos con el shape
      // exacto que el template espera (contrato variables-plantillas v1.1).
      orden_dia: agendaItems
        .filter((i) => i.titulo.trim())
        .map((i, idx) => {
          const carriesMatter = i.kind === "DECISORIO" || isMateriaInformativa(i.materia);
          const itemKind: AgendaItemKind = i.kind ?? "DELIBERATIVO";
          const kindLabel = KIND_OPTIONS.find((option) => option.value === itemKind)?.label ?? itemKind;
          const targetEntity = entities.find((entity) => entity.id === i.target_entity_id) ?? null;
          const representative = shareholderRepresentationCandidates.find(
            (candidate) => candidate.delegation_id === i.representation_delegation_id,
          ) ?? null;
          return {
            ordinal: idx + 1,
            descripcion_punto: agendaTitleForDocument(i),
            kind: i.kind ?? "DELIBERATIVO",
            materia: carriesMatter ? i.materia : null,
            materia_label: carriesMatter ? labelMateria(i.materia) : null,
            tipo: itemKind === "DECISORIO" ? `Acuerdo · ${labelMateria(i.materia)}` : kindLabel,
            inscribible: i.inscribible,
            propuesta_acuerdo: i.kind === "DECISORIO" ? (i.propuesta_acuerdo ?? null) : null,
            requires_attachments:
              i.kind === "DECISORIO" &&
              (i.materia === "FORMULACION_CUENTAS" || i.requires_attachments === true),
            target_entity_id: i.target_entity_id ?? null,
            target_entity_name: targetEntity?.legal_name ?? targetEntity?.common_name ?? null,
            representative_person_id: i.representative_person_id ?? null,
            representative_name: representative?.representative_name ?? null,
          };
        }),
      // Plain-text fallback para plantillas legacy que esperaban string
      // newline-delimited (compatibilidad backwards).
      orden_dia_texto: agendaItems
        .filter((i) => i.titulo.trim())
        .map((i, idx) => `${idx + 1}. ${agendaTitleForDocument(i)}${i.kind === "DECISORIO" ? ` (Acuerdo · ${labelMateria(i.materia)})` : ""}`)
        .join("\n"),
      orden_del_dia_resumen: agendaItems
        .filter((i) => i.titulo.trim())
        .map((i, idx) => `${idx + 1}. ${agendaTitleForDocument(i)}${i.kind === "DECISORIO" ? ` (Acuerdo · ${labelMateria(i.materia)})` : ""}`)
        .join("\n"),
      destinatarios: memberNames.join(", "),
      // Misma protección para `destinatarios`: si la plantilla espera
      // `{{#each destinatarios_lista}}{{nombre}}{{/each}}`, le damos array;
      // si espera string concatenado, usa `destinatarios`.
      destinatarios_lista: activeRecipients
        .filter((m) => !excludedPersonIds.has(m.person_id) && m.full_name)
        .map((m) => ({
          nombre: m.full_name,
          email: m.email ?? null,
          rol: m.role ?? null,
        })),
      nombre_convocante: convocanteAuthority?.person?.full_name ?? "",
      cargo_convocante: convocanteAuthority?.cargo ?? "",
    };
  }, [
    activeRecipients, excludedPersonIds, selectedEntity, tipoSocial, selectedBody, organoTipo,
    jurisdiction, tipoConvocatoria, fechaReunion, horaReunion, lugar, formatoReunion,
    habilitarSegunda, fechaReunion2, horaReunion2, evaluacionV2.antelacionDiasRequerida,
    evaluacionV2.fechaLimitePublicacion, channelLabelsForCapa3, agendaItems, domicilioSocial,
    borradorCapa3Values, convocanteAuthority?.person?.full_name, convocanteAuthority?.cargo,
    entities, agendaTitleForDocument, canonicalAgendaSummary, shareholderRepresentationCandidates,
  ]);

  const [borradorTexto, setBorradorTexto] = useState<string>("");
  const [borradorDirty, setBorradorDirty] = useState(false);
  const [renderUnresolved, setRenderUnresolved] = useState<string[]>([]);
  // Codex P2 round 12 PR #3: render-pending state. El import dinámico de
  // `template-renderer` es async; entre que el usuario llega al Paso 7 y
  // el render completa, `borradorTexto` puede estar vacío. Si el usuario
  // click "Siguiente" en ese intervalo, llegaría al Paso 8 con
  // `convocatoria_text: null` aunque hay plantilla aprobada. Bloqueamos
  // `canAdvance` mientras pending=true.
  const [borradorRenderPending, setBorradorRenderPending] = useState(false);

  // ── ITEM-097: retomar BORRADOR vía `?draft=<id>` ──
  // Carga la convocatoria pedida (cualquier estado, pero el caso de uso son
  // los BORRADOR sin ruta de continuación) y aplica sus campos una sola vez.
  // A diferencia de `applyCloneFromConvocatoria` (clona dentro del mismo
  // órgano), aquí seleccionamos también entidad/órgano y restauramos
  // fecha/hora y el texto del borrador para que el secretario pueda completar
  // y emitir el borrador existente.
  const { data: draftConvocatoria } = useConvocatoriaById(requestedDraftId ?? undefined);
  const appliedDraftRef = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedDraftId || !draftConvocatoria) return;
    if (appliedDraftRef.current === requestedDraftId) return;
    const source = draftConvocatoria;
    appliedDraftRef.current = requestedDraftId;

    if (source.entity_id) setSelectedEntityId(source.entity_id);
    if (source.body_id) setSelectedBodyId(source.body_id);
    if (isConvocatoriaType(source.tipo_convocatoria)) {
      setTipoConvocatoria(source.tipo_convocatoria);
    }
    if (isFormatoReunion(source.modalidad)) {
      setFormatoReunion(source.modalidad);
    }
    if (source.lugar) {
      setLugar(source.lugar);
      lastAutoLugarRef.current = source.lugar;
    }
    // fecha_1 / fecha_2 son ISO; los partimos en fecha (YYYY-MM-DD) y hora.
    if (source.fecha_1) {
      const parts = resolveWorkflowDateTimeInputParts(
        source.fecha_1,
        WORKFLOW_TIME_ZONE_BY_JURISDICTION[jurisdiction],
      );
      if (parts) {
        setFechaReunion(parts.date);
        setHoraReunion(parts.time);
      }
    }
    if (source.fecha_2) {
      const parts = resolveWorkflowDateTimeInputParts(
        source.fecha_2,
        WORKFLOW_TIME_ZONE_BY_JURISDICTION[jurisdiction],
      );
      if (parts) {
        setHabilitarSegunda(true);
        setFechaReunion2(parts.date);
        setHoraReunion2(parts.time);
      }
    }
    // Un borrador legacy se puede reabrir sin perderlo, pero cualquier nueva
    // persistencia abandona el claim ERDS no acreditado.
    setChannels(channelsForNewCapture(source.publication_channels));
    setExcludedPersonIds(excludedRecipientsFromTrace(source.reminders_trace));
    if (Array.isArray(source.agenda_items) && source.agenda_items.length > 0) {
      setAgendaItems(normalizeAgendaDraftItems(source.agenda_items, organoTipo));
    }
    if (source.convocatoria_text) {
      setBorradorTexto(source.convocatoria_text);
    }
    setBorradorDirty(false);
    toast.info("Borrador de convocatoria cargado", {
      description: "Revisa los pasos y emite cuando esté completo.",
    });
    // organoTipo se deriva del órgano; en el primer render aún puede ser el
    // por defecto, pero la agenda se renormaliza al cambiar organoTipo en el
    // efecto de saneamiento de materias ya existente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedDraftId, draftConvocatoria]);

  // ── ITEM-097: trabajo sin guardar ──
  // El stepper no persiste nada hasta `handleEmitir`. Detectamos si el
  // usuario ha introducido datos significativos para (1) avisar con
  // `beforeunload` ante refresh/cierre y (2) confirmar al cancelar.
  const hasUnsavedWork =
    !emitidoId &&
    (Boolean(selectedBodyId) ||
      Boolean(fechaReunion) ||
      Boolean(borradorTexto.trim()) ||
      channels.length > 0 ||
      agendaItems.some((i) => i.titulo.trim().length > 0));

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Algunos navegadores requieren returnValue para mostrar el diálogo.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  // ITEM-097: cancelar con confirmación si hay trabajo sin guardar.
  const handleCancel = useCallback(() => {
    if (
      hasUnsavedWork &&
      !window.confirm(
        "Tienes una simulación DEMO sin registrar. Si sales ahora se perderán los datos introducidos. ¿Seguro que quieres salir?",
      )
    ) {
      return;
    }
    navigate(scopedListPath);
  }, [hasUnsavedWork, navigate, scopedListPath]);

  // Guard contra setState tras unmount o tras nueva regeneración (cancela
  // promesas en vuelo). Sin esto, navegar fuera de Paso 7 mientras el
  // import dinámico de `template-renderer` resuelve produciría un React
  // warning "Can't perform a state update on an unmounted component" y
  // dejaría escrituras race que sobreescriben edits manuales del usuario.
  const isMountedRef = useRef(true);
  const regenerateTokenRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Codex P2 round 8 PR #3: hash del contexto bajo el que se generó (o
  // editó) el borrador. Cuando el contexto cambia (entidad / órgano /
  // fecha / agenda / plantilla / capa3), comparamos contra este hash
  // para mostrar al usuario que su borrador editado puede haber quedado
  // stale. Sólo trackeamos los campos que afectan el render.
  const borradorContextHash = useMemo(() => {
    const agendaSignature = agendaItems
      .filter((i) => i.titulo.trim())
      .map((i) => [
        i.titulo,
        i.materia,
        i.tipo,
        i.kind ?? "",
        i.propuesta_acuerdo ?? "",
        i.target_entity_id ?? "",
        i.representative_person_id ?? "",
      ].join("|"))
      .join("");
    const capa3Signature = Object.entries(borradorCapa3Values)
      .map(([k, v]) => `${k}=${capa3ValueToText(v)}`)
      .join("");
    return [
      selectedEntityId ?? "",
      selectedBodyId ?? "",
      tipoConvocatoria,
      fechaReunion,
      horaReunion,
      lugar,
      formatoReunion,
      habilitarSegunda ? `2:${fechaReunion2}|${horaReunion2}` : "1",
      channels.slice().sort().join(","),
      effectiveBorradorTemplate?.id ?? "",
      effectiveBorradorTemplate?.version ?? "",
      capa3Signature,
      agendaSignature,
    ].join("");
  }, [
    selectedEntityId, selectedBodyId, tipoConvocatoria,
    fechaReunion, horaReunion, lugar, formatoReunion,
    habilitarSegunda, fechaReunion2, horaReunion2,
    channels, effectiveBorradorTemplate?.id, effectiveBorradorTemplate?.version,
    borradorCapa3Values, agendaItems,
  ]);

  const borradorLastRenderHashRef = useRef<string>("");

  const regenerateBorrador = useCallback(() => {
    if (!effectiveBorradorTemplate?.capa1_inmutable) {
      setBorradorTexto("");
      setRenderUnresolved([]);
      setBorradorRenderPending(false);
      borradorLastRenderHashRef.current = borradorContextHash;
      return;
    }
    // Cada llamada incrementa el token; sólo el último vuelve a setState.
    const token = ++regenerateTokenRef.current;
    // Codex P2 round 12 PR #3: marca render pendiente para bloquear
    // navegación adelante (canAdvance) y emisión hasta que el render
    // complete o sea cancelado.
    setBorradorRenderPending(true);
    void import("@/lib/doc-gen/template-renderer").then(({ renderTemplate }) => {
      // Cancelado si: componente desmontado o llegó una regeneración nueva
      // (la `onChange` del textarea también incrementa el token — Codex
      // P2 round 10 PR #3). El check de token cubre el caso edit-during-
      // import, este guard es defensa en profundidad para imports muy
      // lentos donde el render rezagado de otra plantilla no debe pisar
      // un texto que el usuario ya empezó a editar.
      if (!isMountedRef.current) return;
      if (token !== regenerateTokenRef.current) {
        // Cancelado por una llamada posterior — la nueva ya habrá puesto
        // pending=true; no lo bajamos aquí porque la nueva sigue activa.
        return;
      }
      const merged = {
        ...borradorVariables,
        ...borradorCapa3Values,
        // La plantilla expone el indicador como Capa 3 por trazabilidad,
        // pero su fuente de verdad es el interruptor del Paso 2. Un texto
        // "No" sería truthy en Handlebars y mostraría indebidamente el
        // bloque; preservamos aquí el booleano canónico del stepper.
        hay_segunda_convocatoria: habilitarSegunda,
        entidad_cotizada: Boolean(selectedEntity?.es_cotizada),
      };
      const result = renderTemplate({
        template: effectiveBorradorTemplate.capa1_inmutable!,
        variables: merged,
      });
      const normalizedText = normalizeVisibleDocumentText(result.text);
      setBorradorTexto(
        normalizedText.startsWith(DOCUMENT_DEMO_NOTICE)
          ? normalizedText
          : `${DOCUMENT_DEMO_NOTICE}\n\n${normalizedText}`,
      );
      setRenderUnresolved(result.unresolvedVariables);
      setBorradorDirty(false);
      setBorradorRenderPending(false);
      // Tras render limpio el hash queda alineado con el contexto actual.
      borradorLastRenderHashRef.current = borradorContextHash;
    }).catch(() => {
      // Si el import o el render fallan, libera el pending para no
      // dejar el botón Siguiente bloqueado para siempre.
      if (!isMountedRef.current) return;
      if (token === regenerateTokenRef.current) {
        setBorradorRenderPending(false);
      }
    });
  }, [effectiveBorradorTemplate, borradorVariables, borradorCapa3Values, borradorContextHash, habilitarSegunda, selectedEntity?.es_cotizada]);

  // Auto-regenerar cuando cambian plantilla / variables / capa3 — solo si:
  //   1. usuario está actualmente en Paso 7 (evita imports dinámicos y
  //      setStates durante Paso 1-6 que cambian fecha/orden/etc.); cuando
  //      el usuario llega al Paso 7 el effect dispara una sola vez.
  //   2. no está "dirty" (no sobreescribir edits manuales del usuario).
  useEffect(() => {
    if (borradorDirty) return;
    // Solo renderizar al entrar en el paso o cuando cambió de verdad el
    // contexto. `borradorRenderPending` forma parte de las dependencias del
    // efecto: regenerar incondicionalmente al volver a `false` creaba un
    // ciclo false → true → false y dejaba "Siguiente" bloqueado para siempre.
    if (
      current === 7 &&
      !borradorRenderPending &&
      borradorLastRenderHashRef.current !== borradorContextHash
    ) {
      regenerateBorrador();
      return;
    }
    // W0: el render del Paso 7 es asíncrono; un salto rápido 6→7→8 puede dejar
    // `borradorTexto` vacío. Regeneramos también al entrar al Paso 8 si no hay
    // texto y existe plantilla efectiva. Sin plantilla, regenerateBorrador no
    // produce texto, así que NO lo llamamos en ese caso (evita bucle infinito).
    if (
      current === 8 &&
      !borradorTexto.trim() &&
      !borradorRenderPending &&
      effectiveBorradorTemplate?.capa1_inmutable
    ) {
      regenerateBorrador();
    }
  }, [
    current,
    regenerateBorrador,
    borradorDirty,
    borradorTexto,
    borradorRenderPending,
    borradorContextHash,
    effectiveBorradorTemplate,
  ]);

  // Codex P2 round 8 PR #3: detectar stale draft. Si el usuario editó el
  // textarea (dirty) y luego cambió el contexto upstream (entidad / órgano
  // / agenda / etc.), `borradorTexto` ya no refleja la metadata persistida.
  // No descartamos el texto del usuario (puede ser intencional) — el flag
  // alimenta un callout visual + bloquea emisión hasta resolución
  // explícita.
  //
  // Codex P2 round 11 PR #3: el botón "Conservar texto como válido" debe
  // poder DESBLOQUEAR la emisión. Si solo mutamos refs + setState con el
  // mismo valor, React bail-out y `borradorIsStale` se queda true en el
  // render. Añadimos un state real `staleAcknowledgedHash` que el usuario
  // setea para confirmar bajo qué contexto aceptó el texto. Mientras
  // siga igual al contextHash actual, el texto se considera explícitamente
  // válido. Si el contexto cambia de nuevo, vuelve a stale.
  const [staleAcknowledgedHash, setStaleAcknowledgedHash] = useState<string>("");
  const borradorIsStale =
    borradorDirty &&
    borradorLastRenderHashRef.current !== "" &&
    borradorLastRenderHashRef.current !== borradorContextHash &&
    staleAcknowledgedHash !== borradorContextHash;

  // BORME/diario/web que pueda declarar el rule pack de una materia
  // inscribible pertenece a la formalización/publicidad POSTERIOR del acuerdo,
  // no a la citación de los consejeros. En Consejo, la convocatoria se dirige
  // a sus miembros por el canal estatutario; trasladar aquí
  // esos canales generaba falsos pendientes en la evidencia de convocatoria.
  const legalChannelReminderItems = tipoConvocatoria === "UNIVERSAL" || organoTipo === "CONSEJO"
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
  // Cada adjunto mantiene el File en memoria; el upload a Storage + INSERT
  // en `attachments` se ejecuta tras crear la convocatoria (handleEmitir).
  // Si el usuario abandona antes de emitir no quedan huérfanos en Storage.
  const [uploadStatus, setUploadStatus] = useState<{
    ok: number;
    failed: number;
    messages: string[];
    inFlight: number;
  }>({
    ok: 0,
    failed: 0,
    messages: [],
    inFlight: 0,
  });
  const [isPreparingAttachmentIntents, setIsPreparingAttachmentIntents] = useState(false);
  const [documentosIncluidos, setDocumentosIncluidos] = useState<Set<string>>(new Set());
  const requiredDocuments = evaluacionV2.documentosObligatorios;
  // BATCH 8.6 (ronda 2 U-D): mapear cada documento obligatorio a las
  // materias del orden del día que lo exigen. Antes la UI mostraba
  // "Borrador de cuentas anuales" sin contexto — ahora explica "exigido
  // por la materia APROBACION_CUENTAS" para que el secretario entienda
  // el vínculo entre el punto del orden y el documento requerido.
  const documentToMaterias = (() => {
    const map = new Map<string, Set<string>>();
    for (const resolution of ruleResolutions) {
      const materia = resolution.rulePack?.materia;
      const payload = resolution.rulePack?.payload;
      const docs =
        payload && typeof payload === "object" && "convocatoria" in payload &&
        payload.convocatoria && typeof payload.convocatoria === "object" &&
        "documentosObligatorios" in payload.convocatoria
          ? (payload.convocatoria as { documentosObligatorios?: Array<{ id: string }> }).documentosObligatorios ?? []
          : [];
      for (const doc of docs) {
        if (!doc?.id || !materia) continue;
        if (!map.has(doc.id)) map.set(doc.id, new Set());
        map.get(doc.id)!.add(materia);
      }
    }
    const out: Record<string, string[]> = {};
    map.forEach((set, id) => { out[id] = Array.from(set); });
    return out;
  })();
  const missingRequiredDocuments = tipoConvocatoria === "UNIVERSAL"
    ? []
    : requiredDocuments.filter((doc) => !documentosIncluidos.has(doc.id));
  const documentReminderOk = missingRequiredDocuments.length === 0;
  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const next: typeof adjuntos = [];
    for (const file of Array.from(files)) {
      next.push({
        id: crypto.randomUUID(),
        file,
        alias: file.name,
        descripcion: "",
      });
    }
    setAdjuntos((prev) => [...prev, ...next]);
  }
  function removeAdjunto(id: string) {
    setAdjuntos((prev) => prev.filter((a) => a.id !== id));
  }
  function updateAdjunto(id: string, field: "alias" | "descripcion", val: string) {
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
  // Codex P2 round 12 PR #3: capa3 fields obligatorios deben rellenarse
  // antes de avanzar de Paso 7. Sin este gate, una plantilla con campos
  // OBLIGATORIO permitía emitir con valores vacíos → render incompleto
  // del `convocatoria_text` que omite secciones críticas.
  //
  // Codex P2 round 13 PR #3: pasar `telematicaEnabled` real para que la
  // validación reconozca campos `OBLIGATORIO_SI_TELEMATICA` cuando el
  // formato es TELEMATICA o MIXTA. Sin esto los campos condicionales
  // (ej. `instrucciones_telematica`) no bloqueaban aunque la UI los
  // marcara visualmente como required.
  const telematicaEnabled = formatoReunion !== "PRESENCIAL";
  const borradorCapa3MissingRequired = useMemo(
    () => validateCapa3(borradorCapa3Fields, borradorCapa3Values, telematicaEnabled),
    [borradorCapa3Fields, borradorCapa3Values, telematicaEnabled],
  );
  const borradorCapa3HasMissing = Object.keys(borradorCapa3MissingRequired).length > 0;
  const convocationAuthorityReady =
    organoTipo !== "CONSEJO" || convocanteAuthority?.cargo === "PRESIDENTE";
  const representationAgendaReady = agendaItems.every((item) => {
    if (item.materia !== "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL") return true;
    const target = entities.find((entity) => entity.id === item.target_entity_id) ?? null;
    const candidate = shareholderRepresentationCandidates.find(
      (row) =>
        row.delegation_id === item.representation_delegation_id &&
        row.representative_person_id === item.representative_person_id,
    ) ?? null;
    const proposal = item.propuesta_acuerdo?.toLocaleLowerCase("es") ?? "";
    const targetName = (target?.legal_name ?? target?.common_name ?? "").toLocaleLowerCase("es");
    const representativeName = (candidate?.representative_name ?? "").toLocaleLowerCase("es");
    return Boolean(
      item.target_entity_id &&
      item.representative_person_id &&
      item.representation_delegation_id &&
      candidate &&
      targetName &&
      representativeName &&
      proposal.includes(targetName) &&
      proposal.includes(representativeName) &&
      hasSoleShareholderRepresentativeConditions(item.propuesta_acuerdo),
    );
  });
  const annualAccountsAgendaIssues = useMemo(
    () => agendaItems
      .filter((item) => item.materia === "FORMULACION_CUENTAS")
      .map((item) => ({
        item,
        result: evaluateAnnualAccountsTimeliness({
          sessionDate: fechaReunion,
          title: item.titulo,
          proposal: item.propuesta_acuerdo,
        }),
      }))
      .filter(({ result }) => result.blocking),
    [agendaItems, fechaReunion],
  );
  const annualAccountsAgendaReady = annualAccountsAgendaIssues.length === 0;

  function canAdvance(): boolean {
    switch (current) {
      case 1:
        return Boolean(
          selectedEntity &&
          selectedBody &&
          !readinessBlocked &&
          convocationAuthorityReady,
        );
      case 2: return !!fechaReunion && (!lugarRequired || !!lugar);
      case 3: {
        if (!annualAccountsAgendaReady) return false;
        const populatedItems = agendaItems.filter((i) => i.titulo.trim().length > 0);
        return populatedItems.length > 0 && populatedItems.every((item) => {
          if (item.kind !== "DECISORIO" && !isMateriaInformativa(item.materia)) return false;
          if (item.materia !== "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL") return true;
          return representationAgendaReady;
        });
      }
      // Codex P2 round 12: bloqueamos avance del Paso 7 si:
      //   - el render del borrador está aún pendiente (import dinámico)
      //   - hay capa3 obligatorios sin rellenar
      // El stale guard (round 8) sigue actuando en el botón Emitir del 8.
      case 7: return !borradorRenderPending && !borradorCapa3HasMissing;
      default: return true;
    }
  }

  const acceptedWarnings = [
    ...(!noticeOk && tipoConvocatoria !== "UNIVERSAL"
      ? [{
        type: "NOTICE_PERIOD",
        severity: "WARNING",
        message: "El plazo de convocatoria no parece cumplido; el registro DEMO continúa como recordatorio no bloqueante.",
        required_days: evaluacionV2.antelacionDiasRequerida,
        meeting_date: meetingIso,
        deadline: evaluacionV2.fechaLimitePublicacion,
      }]
      : []),
    ...(ruleGatePending
      ? [{
        type: "RULE_RESOLUTION_PENDING",
        severity: "WARNING",
        message: "La regla aplicable no estaba completamente resuelta al registrar la simulación; se conserva el estado disponible.",
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

  function buildConvocatoriaTrace(attachmentIntents: SupportingAttachmentIntent[]) {
    const emittedAt = new Date().toISOString();
    const selectedChannels = channels.map((channel) => ({
      value: channel,
      label: channelLabel(channel, channelOpts),
    }));
    const includedRequiredDocuments = requiredDocuments.filter((doc) => documentosIncluidos.has(doc.id));

    // Codex P2 PR #3 round 5: trazabilidad de la plantilla efectivamente
    // usada para renderizar `convocatoria_text` (Paso 7). Sin esto, drafts
    // emitidos vía auto-selección o selección manual en Paso 7 quedaban
    // sin pista del template id/version/source que generó el texto legal
    // → no auditables hacia atrás. requestedPlantilla solo cubre el flujo
    // `?plantilla=` (handoff externo), que es minoritario.
    const borradorTemplateTrace = effectiveBorradorTemplate
      ? {
          id: effectiveBorradorTemplate.id,
          tipo: effectiveBorradorTemplate.tipo,
          version: effectiveBorradorTemplate.version,
          estado: effectiveBorradorTemplate.estado,
          aprobada_por: effectiveBorradorTemplate.aprobada_por,
          fecha_aprobacion: effectiveBorradorTemplate.fecha_aprobacion,
          referencia_legal: effectiveBorradorTemplate.referencia_legal,
          organo_tipo: effectiveBorradorTemplate.organo_tipo,
          jurisdiccion: effectiveBorradorTemplate.jurisdiccion,
          source_of_truth: effectiveBorradorTemplate.estado === "ACTIVA" && effectiveBorradorTemplate.aprobada_por
            ? "approved_template"
            : "demo_or_operative_template",
          // Distinción manual vs auto-seleccionada: si el usuario tocó el
          // selector, `selectedBorradorTemplateId` no es null.
          selection_mode: selectedBorradorTemplateId ? "manual" : "auto",
          capa3_fields_count: effectiveBorradorTemplate.capa3_editables?.length ?? 0,
          capa3_values: borradorCapa3Values,
          // Render outcome: el texto editable del usuario puede haber
          // divergido del render canonical de la plantilla. Marcamos el
          // estado dirty para que auditoría sepa que el draft fue editado
          // manualmente tras el render inicial.
          borrador_dirty: borradorDirty,
          render_unresolved: renderUnresolved,
        }
      : null;

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
          // Plantilla del Paso 7 (auto-selected o manual) — la que de
          // hecho generó `convocatoria_text` cuando lo hubo. Independiente
          // de `selected_template` (que vincula handoff externo).
          borrador_template: borradorTemplateTrace,
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
          borrador_template: borradorTemplateTrace,
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
          // Identidad dual precomprometida antes de la emisión. El servidor
          // materializa esta proyección en un set WORM y `attachments` es la
          // fuente autoritativa del resultado de cada registro posterior.
          uploaded_references: attachmentIntents,
        },
        recipients: {
          source: organoTipo === "JUNTA_GENERAL" ? "capital_holdings" : "condiciones_persona",
          total_active: activeRecipients.length,
          excluded_person_ids: Array.from(excludedPersonIds),
          selected_count: Math.max(activeRecipients.length - excludedPersonIds.size, 0),
        },
      },
      accepted_warnings: acceptedWarnings.map((warning) => ({
        ...warning,
        accepted_at: emittedAt,
        accepted_by: user?.email ?? "demo-user",
      })),
    };
  }

  // ── Submit ──
  async function handleEmitir() {
    if (createConvocatoria.isPending || isPreparingAttachmentIntents) return;
    if (!selectedBodyId) {
      toast.error("Selecciona el órgano convocante antes de registrar la simulación DEMO.");
      setCurrent(1);
      return;
    }
    if (!fechaReunion) {
      toast.error("Indica la fecha de la reunión antes de registrar la simulación DEMO.");
      setCurrent(2);
      return;
    }
    const invalidNonDecisionItem = agendaItems.find(
      (item) =>
        item.titulo.trim().length > 0 &&
        item.kind !== "DECISORIO" &&
        !isMateriaInformativa(item.materia),
    );
    if (invalidNonDecisionItem) {
      toast.error(
        `Selecciona una categoría informativa válida para «${invalidNonDecisionItem.titulo}».`,
      );
      return;
    }
    if (
      organoTipo !== "CONSEJO" ||
      jurisdiction.toUpperCase() !== "ES" ||
      selectedEntity?.entity_status !== "Active"
    ) {
      toast.error(
        "Este registro gobernado solo está habilitado para Consejos de sociedades españolas activas en el entorno DEMO.",
      );
      return;
    }
    if (agendaItems.some((item) => item.materia === "NOMBRAMIENTO_REPRESENTANTE_FILIAL")) {
      toast.error(
        "La materia legacy de representante en filial no está disponible en este flujo. Selecciona «Designación de representante de la socia única en la filial».",
      );
      return;
    }
    if (!lugar.trim()) {
      toast.error("Indica el lugar de la sesión; el servidor lo contrasta con el borrador DEMO revisado.");
      return;
    }
    if (organoTipo === "CONSEJO" && convocanteAuthority?.cargo !== "PRESIDENTE") {
      toast.error(
        "No existe evidencia vigente del cargo de Presidente para este Consejo. Esa evidencia solo acredita el cargo y no una actuación personal; el registro DEMO queda bloqueado.",
      );
      return;
    }
    if (!representationAgendaReady) {
      toast.error(
        "Completa la filial, selecciona un registro de representante para validación y genera una propuesta condicionada al poder público, al 100 % del capital y a la ausencia de administrador persona jurídica.",
      );
      return;
    }
    if (!annualAccountsAgendaReady) {
      toast.error(
        annualAccountsAgendaIssues[0]?.result.message ??
          "La propuesta de formulación extemporánea debe incorporar expresamente su condición de regularización.",
      );
      return;
    }
    // ITEM-034: el gap mínimo de 24h entre 1ª y 2ª convocatoria (art. 177.2 LSC)
    // es un mínimo legal imperativo → bloquea la emisión, no solo advierte.
    if (segundaConvocatoriaGapWarning) {
      toast.error(segundaConvocatoriaGapWarning);
      return;
    }
    // ITEM-034: la 2ª convocatoria solo se persiste cuando la figura existe
    // (junta SA/SAU, art. 177.1 LSC).
    const fecha2Iso = habilitarSegunda && segundaConvocatoriaDisponible && fechaReunion2
      ? new Date(`${fechaReunion2}T${horaReunion2}:00`).toISOString()
      : null;
    setIsPreparingAttachmentIntents(true);
    try {
      const attachmentIntents = await buildSupportingAttachmentIntents(adjuntos);
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
          .map(({
            titulo,
            materia,
            tipo,
            inscribible,
            kind,
            decision_subtype,
            propuesta_acuerdo,
            requires_attachments,
            target_entity_id,
            representative_person_id,
            representation_delegation_id,
          }) => {
            const effectiveKind: AgendaItemKind = kind ?? "DELIBERATIVO";
            return {
              titulo,
              materia,
              tipo,
              inscribible,
              // agenda_item.kind v3.1: persistir naturaleza del punto.
              // Solo DECISORIO admite decision_subtype; resto → null.
              kind: effectiveKind,
              decision_subtype:
                effectiveKind === "DECISORIO" ? (decision_subtype ?? null) : null,
              // BATCH 3: persistir propuesta concreta del acuerdo en JSONB.
              // Backward-compat: convocatorias antiguas leen null.
              // Para puntos no decisorios no hay propuesta de acuerdo posible.
              propuesta_acuerdo:
                effectiveKind === "DECISORIO" ? (propuesta_acuerdo ?? null) : null,
              requires_attachments:
                effectiveKind === "DECISORIO" &&
                (materia === "FORMULACION_CUENTAS" || requires_attachments === true),
              target_entity_id:
                materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
                  ? (target_entity_id ?? null)
                  : null,
              representative_person_id:
                materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
                  ? (representative_person_id ?? null)
                  : null,
              representation_delegation_id:
                materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
                  ? (representation_delegation_id ?? null)
                  : null,
            };
          }),
        statutory_basis: activeRuleSet?.legal_reference ?? null,
        convocatoria_text: borradorTexto.trim() ? borradorTexto : null,
        ...buildConvocatoriaTrace(attachmentIntents),
      });
      setIsPreparingAttachmentIntents(false);

      // Upload de adjuntos paralelo con Promise.allSettled — la convocatoria
      // ya está creada en DB (rollback no es viable sin DELETE), así que
      // ejecutamos uploads en paralelo y reportamos fallos parciales. El
      // usuario podrá reintentar adjuntos fallidos desde el detalle.
      // Indicador "Subiendo X de N" gracias a un counter que se incrementa
      // cuando cada promesa termina (no estrictamente ordenado pero útil).
      let okCount = 0;
      let failCount = 0;
      const failMessages: string[] = [];
      if (adjuntos.length > 0) {
        setUploadStatus({ ok: 0, failed: 0, messages: [], inFlight: adjuntos.length });
        type UploadOutcome =
          | { adjunto: typeof adjuntos[number]; ok: true }
          | { adjunto: typeof adjuntos[number]; ok: false; msg: string };
        const results = await Promise.allSettled(
          adjuntos.map<Promise<UploadOutcome>>((adjunto) =>
            uploadAttachment
              .mutateAsync({
                convocatoriaId: created.id,
                file: adjunto.file,
                intentId: adjunto.id,
              })
              .then((): UploadOutcome => ({ adjunto, ok: true }))
              .catch((err: unknown): UploadOutcome => ({
                adjunto,
                ok: false,
                msg: err instanceof Error ? err.message : "Error de subida",
              })),
          ),
        );
        for (const result of results) {
          // allSettled SIEMPRE devuelve fulfilled aquí (porque hacemos catch).
          if (result.status !== "fulfilled") continue;
          const outcome = result.value;
          if (outcome.ok === true) {
            okCount += 1;
            continue;
          }
          // outcome.ok === false aquí → TS estrecha a la variante con msg.
          failCount += 1;
          const failedAdjunto = outcome.adjunto;
          const failedMsg = outcome.msg;
          failMessages.push(`${failedAdjunto.file.name}: ${failedMsg}`);
          setAdjuntos((prev) =>
            prev.map((a) => (a.id === failedAdjunto.id ? { ...a, error: failedMsg } : a)),
          );
        }
        setUploadStatus({ ok: okCount, failed: failCount, messages: failMessages, inFlight: 0 });
      }

      setEmitidoId(created.id);
      if (failCount === 0) {
        toast.success(
          adjuntos.length > 0
            ? `Simulación DEMO registrada con ${okCount} adjunto(s)`
            : "Simulación DEMO registrada correctamente",
        );
      } else {
        toast.warning(
          `Simulación DEMO registrada; ${okCount} adjunto(s) subidos, ${failCount} fallaron`,
          { description: failMessages[0] },
        );
      }
    } catch (err) {
      const msg = secretariaErrorMessage(
        err,
        "No se pudo completar el registro DEMO.",
      );
      toast.error("No se pudo registrar la simulación DEMO", { description: msg });
    } finally {
      setIsPreparingAttachmentIntents(false);
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
            Simulación DEMO registrada
          </h2>
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            {/* ITEM-095: copy honesto — TGMS registra los canales, no realiza el envío. */}
            Se ha registrado un borrador operativo sin efecto jurídico. No afirma que el Presidente
            haya ordenado, consentido, emitido o firmado una convocatoria y no realiza ningún envío real.
          </p>
          {(uploadStatus.ok > 0 || uploadStatus.failed > 0) && (
            <div
              className={`mt-4 border p-3 text-left text-xs ${
                uploadStatus.failed === 0
                  ? "border-[var(--g-sec-300)] bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                  : "border-[var(--status-warning)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <p className="font-medium">
                Adjuntos: {uploadStatus.ok} subido(s) · {uploadStatus.failed} fallido(s)
              </p>
              {uploadStatus.messages.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {uploadStatus.messages.map((m, i) => (
                    <li key={i} className="text-[var(--status-error)]">{m}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div
            className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-left text-xs text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            La comunicación se habilita en el detalle después de generar y archivar el DOCX final.
            El sistema vinculará la convocatoria, la reunión y el binario real de Storage antes de programar el envío.
          </div>
          {/* ITEM-069/062 + ITEM-064: CTA de comunicación (si procede) + navegación
              al artefacto creado. "Abrir convocatoria" es el destino primario. */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(
                  isSociedadScoped && scopedEntityId
                    ? `/secretaria/convocatorias/${emitidoId}?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
                    : `/secretaria/convocatorias/${emitidoId}`,
                )
              }
              className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Abrir convocatoria
            </button>
            <button
              type="button"
              onClick={() => navigate(scopedReunionesPath)}
              className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ir a reuniones
            </button>
            <button
              type="button"
              onClick={() => navigate(scopedListPath)}
              className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ver convocatorias
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
        onClick={handleCancel}
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
                  · se sugiere interposición EAD sin firma ni claim ERDS
                </span>
              ) : null}
              {isRequestedModeloTemplate ? (
                <span className="ml-1 text-xs text-[var(--g-text-secondary)]">
                  · el modelo incorpora la propuesta de acuerdo al orden del día
                </span>
              ) : null}
              {localRequestedPlantilla ? (
                <span className="ml-1 text-xs text-[var(--g-text-secondary)]">
                  · cobertura provisional pendiente de aprobación
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

      {!requestedPlantillaId && requestedMateria ? (
        <div
          className="mb-6 border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {/* Copy neutral: a esta URL se llega desde Materias y reglas, pero
              también desde el rescate del Tramitador registral. */}
          Materia recibida para la adopción del acuerdo:{" "}
          <span className="font-semibold">
            {findCatalogMateria(requestedMateria)?.materia_label_es ?? labelMateria(requestedMateria)}
          </span>
          <span className="ml-1 text-xs text-[var(--g-text-secondary)]">
            · incorporada como primer punto del orden del día
          </span>
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
                    Modo Sociedad activo: la simulación DEMO se registrará dentro de esta sociedad.
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

              {selectedBodyId && organoTipo === "CONSEJO" && (
                <div
                  className={`border-l-4 p-3 ${
                    convocanteAuthority?.cargo === "PRESIDENTE"
                      ? "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                      : "border-[var(--status-error)] bg-[var(--g-surface-card)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  role="status"
                >
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    {convocanteAuthority?.cargo === "PRESIDENTE"
                      ? "Cargo de Presidencia vigente"
                      : "Falta evidencia del cargo de Presidencia"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    {convocanteAuthority?.cargo === "PRESIDENTE"
                      ? `${convocanteAuthority.person?.full_name ?? "Presidente"} · art. 246.1 LSC · evidencia de cargo ${convocanteAuthority.id.slice(0, 8)}. Acredita el cargo, no el acto concreto; el manifiesto registra una simulación DEMO sin efecto jurídico.`
                      : "Esta versión solo permite la ruta del Presidente del Consejo (art. 246.1 LSC). Registra la evidencia vigente antes de continuar; la ruta excepcional del art. 246.2 no se simula."}
                  </p>
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
                        onClick={() => {
                          if (t === "UNIVERSAL") {
                            // Una junta/sesión universal NO tiene convocatoria por
                            // definición legal (art. 178 LSC). El flujo correcto
                            // es el intake dedicado, que crea la reunión con
                            // marca universal directamente.
                            const params = new URLSearchParams();
                            params.set("flow", "junta-universal");
                            if (selectedEntityId) {
                              params.set("scope", "sociedad");
                              params.set("entity", selectedEntityId);
                            }
                            if (selectedBodyId) params.set("body", selectedBodyId);
                            navigate(`/secretaria/reuniones/nueva?${params.toString()}`);
                            return;
                          }
                          setTipoConvocatoria(t);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                          tipoConvocatoria === t
                            ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                            : "border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        {t === "UNIVERSAL" ? "UNIVERSAL →" : t}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)] mt-1">
                    {tipoConvocatoria === "UNIVERSAL"
                      ? "Una reunión universal no se convoca: se inicia directamente con todos los asistentes presentes y la aceptación unánime del orden del día. Pulsa UNIVERSAL → para abrir el asistente específico."
                      : "Si la sesión va a celebrarse como universal (sin convocatoria previa), pulsa UNIVERSAL → y te llevamos al asistente que crea la reunión directamente."}
                  </p>
                </div>
              )}

              {selectedBodyId && tipoConvocatoria !== "UNIVERSAL" && (
                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-start gap-2">
                    <Copy className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">
                        Usar convocatoria anterior como modelo
                      </p>
                      <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                        Solo se muestran convocatorias del mismo órgano y sociedad. La agenda clonada queda como borrador editable y se re-evalúa con las reglas actuales.
                      </p>
                    </div>
                  </div>
                  {cloneCandidates.length === 0 ? (
                    <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
                      No hay convocatorias anteriores compatibles para este órgano.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={cloneSourceId}
                        onChange={(e) => setCloneSourceId(e.target.value)}
                        className="min-w-0 flex-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <option value="">— Seleccionar convocatoria —</option>
                        {cloneCandidates.map((convocatoria) => (
                          <option key={convocatoria.id} value={convocatoria.id}>
                            {convocatoria.fecha_1
                              ? new Date(convocatoria.fecha_1).toLocaleDateString("es-ES")
                              : "Sin fecha"}{" "}
                            · {convocatoria.tipo_convocatoria ?? "Sin tipo"} · {(convocatoria.agenda_items ?? []).length} punto(s)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!cloneSourceId}
                        onClick={() => applyCloneFromConvocatoria(cloneSourceId)}
                        className="inline-flex items-center justify-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Aplicar modelo
                      </button>
                    </div>
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
                    {liveNoticeDays != null && tipoConvocatoria !== "UNIVERSAL" && (
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
                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    Reglas LSC aplicables
                  </p>
                  <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Las reglas (rule packs + overrides) se resolverán automáticamente
                    cuando definas el orden del día en el Paso 3. Solo los puntos
                    marcados como <span className="font-semibold">Acuerdo</span> activan
                    el motor LSC.
                  </p>
                </div>
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
                    onInput={(e) => setFechaReunion(e.currentTarget.value)}
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
              {/* A.2 (art. 176.2 LSC): fecha de remisión al último socio (comunicación individual) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Fecha de remisión a los socios (comunicación individual) — opcional
                </label>
                <input
                  type="date"
                  value={fechaRemisionUltimoSocio}
                  onChange={(e) => setFechaRemisionUltimoSocio(e.target.value)}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <p className="text-[11px] text-[var(--g-text-secondary)]">
                  Si la convocatoria se hace por comunicación individual y escrita (art. 176.2 LSC),
                  el plazo de un mes se computa desde la fecha de remisión del último anuncio. Si se
                  deja vacío, se computa desde la fecha de la convocatoria.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Lugar / enlace de acceso
                  </label>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold ${
                      lugarRequired
                        ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                        : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {lugarRequired ? "Obligatorio" : "Recomendado"}
                  </span>
                </div>
                <input
                  type="text"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  placeholder={
                    domicilioSocial ||
                    (formatoReunion === "TELEMATICA"
                      ? "Referencia regulatoria: domicilio social o enlace de acceso"
                      : "Ej. Sede social C/ Gran Vía 1, Madrid")
                  }
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <p className="text-xs text-[var(--g-text-secondary)]">
                  {formatoReunion === "TELEMATICA"
                    ? "En sesión telemática el domicilio social queda como referencia regulatoria; el enlace o instrucciones de acceso se completan en la convocatoria."
                    : domicilioSocial
                    ? "Pre-rellenado con el domicilio social de la entidad. Puedes sustituirlo si la sesión se celebra en otra sede permitida."
                    : "No hay domicilio social cargado para esta entidad; introdúcelo manualmente."}
                </p>
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
                        Evaluación Reglas — Motor LSC v2
                      </p>
                      {fechaReunion && (
                        <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                          {evaluacionV2.antelacionDiasRequerida} días requeridos
                        </p>
                      )}
                    </div>
                    {/* ITEM-093: el badge reflejaba evaluacionV2.ok, que es
                        vacuamente true (el motor V2 computa requisitos pero no
                        recibe fecha de emisión, así que nunca puebla
                        blocking_issues por plazo). El señal real de cumplimiento
                        de plazo es noticeOk (= noticeDoubleEvaluation.effective_ok,
                        que sí factoriza la fecha vía doble eval V1/V2). Sin fecha
                        elegida se muestra estado neutro; el incumplimiento es un
                        recordatorio no bloqueante (DL-2) → tono warning. */}
                    {!fechaReunion ? (
                      <span
                        className="inline-flex h-6 items-center px-2.5 text-[11px] font-semibold bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        Pendiente fecha
                      </span>
                    ) : (
                      <span
                        className={`inline-flex h-6 items-center px-2.5 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
                          noticeOk ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {noticeOk ? "OK" : "Revisar plazo"}
                      </span>
                    )}
                  </div>

                  {ruleResolutions.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <MiniFact label="Rule packs" value={String(ruleResolutions.filter((r) => r.rulePack).length)} />
                      <MiniFact label="Antelación" value={`${evaluacionV2.antelacionDiasRequerida} días`} />
                      <MiniFact label="Overrides" value={String(agendaApplicableOverrides.length)} />
                      <MiniFact
                        label="Doble eval."
                        // ITEM-142: la convergencia V1/V2 depende de la fecha de
                        // la reunión; sin fecha elegida no se muestra un veredicto
                        // (evita señal sobre la fecha ficticia de fallback).
                        value={
                          fechaReunion
                            ? noticeDoubleEvaluation.converged
                              ? "Convergente"
                              : "Divergente"
                            : "—"
                        }
                      />
                    </div>
                  ) : (
                    /* B1 — sin items DECISORIO en el orden del día, el
                       motor V2 corre con 0 rule packs y cae a defaults por
                       organoTipo (LSC art. 176 para juntas, art. 246.1 +
                       reglamento para CdA). Mostramos copy contextual que
                       explica QUÉ default está aplicando para que el
                       secretario sepa que la antelación es orientativa
                       hasta definir el orden del día. */
                    <p className="mt-3 text-[11px] text-[var(--g-text-secondary)]">
                      Cálculo orientativo con defaults por órgano
                      ({organoTipo}). Las reglas específicas se resolverán al
                      definir el orden del día en el Paso 3 (sólo los puntos
                      marcados como Acuerdo activan rule packs).
                    </p>
                  )}

                  {/* ITEM-093: antes gateado por !evaluacionV2.ok (rama muerta,
                      ok siempre true). Ahora usa noticeOk (cumplimiento real de
                      plazo según doble eval V1/V2). Este bloque ya está dentro de
                      tipoConvocatoria !== "UNIVERSAL". Recordatorio no bloqueante
                      (DL-2) → warning. */}
                  {!noticeOk && fechaReunion && (
                    <p className="mt-2 text-xs text-[var(--status-warning)]">
                      El plazo mínimo de antelación no parece cumplido para la fecha elegida. Es un recordatorio (no bloquea el registro DEMO); ajusta la fecha de la reunión si procede.
                    </p>
                  )}
                  {ruleAlertActive && (
                    <p className="mt-2 text-xs text-[var(--status-error)]">
                      Recordatorio: alguna regla aplicable no está lista para producción o su payload no es compatible con el motor de convocatoria.
                    </p>
                  )}
                  {fechaReunion && !noticeDoubleEvaluation.converged && (
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

              {/* Segunda convocatoria — solo juntas de SA/SAU (art. 177.1 LSC;
                  la DGSJFP la rechaza para SL y la figura no existe en
                  consejo/comisiones). ITEM-034. */}
              {organoTipo === "JUNTA_GENERAL" && (tipoSocial === "SA" || tipoSocial === "SAU") ? (
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
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[var(--g-text-primary)]">
                            Fecha segunda convocatoria
                          </label>
                        <input
                          type="date"
                          value={fechaReunion2}
                          onChange={(e) => setFechaReunion2(e.target.value)}
                          onInput={(e) => setFechaReunion2(e.currentTarget.value)}
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
                      {segundaConvocatoriaGapWarning ? (
                        <div
                          className="mt-3 ml-6 flex items-start gap-2 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-3"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                          <p className="text-xs text-[var(--g-text-primary)]">
                            {segundaConvocatoriaGapWarning}
                          </p>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* ── PASO 3: Orden del día ── */}
          {current === 3 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-[var(--g-text-secondary)]">
                Añade los puntos del orden del día. Clasifica cada punto según su
                naturaleza (informativo, deliberativo o acuerdo); solo los puntos
                de acuerdo requieren materia, clase LSC y propuesta concreta, y se
                someten al motor de validez.
              </p>

              {agendaRuleSpecs.length > 0 && (
                <RuleResolutionPanel
                  loading={ruleResolutionsLoading}
                  error={ruleResolutionsError}
                  ruleResolutions={ruleResolutions}
                  payloadsCompatible={allRulePayloadsCompatible}
                />
              )}

              <div className="space-y-3">
                {agendaItems.map((item, idx) => {
                  const itemKind: AgendaItemKind = item.kind ?? "DELIBERATIVO";
                  const isDecisorio = itemKind === "DECISORIO";
                  const categoriaInformativaValida = isMateriaInformativa(item.materia);
                  const kindHelper =
                    KIND_OPTIONS.find((k) => k.value === itemKind)?.helper ?? "";
                  const materiaCompatible = isMateriaCompatibleWithOrgano(item.materia, organoTipo);
                  // Coherencia materia × órgano (2026-07-03): el select se
                  // estructura en grupos (propias del órgano / transversales /
                  // punto libre) en vez de lista plana. La materia incompatible
                  // de un borrador previo se conserva visible en su propio
                  // grupo para no perder el valor, pero no se ofrece el resto
                  // del catálogo incompatible.
                  const materiaGroups = agendaMateriaGroups(organoTipo)
                    .map((group) => ({
                      ...group,
                      materias: group.materias.filter(
                        (materia) => materia.value !== "NOMBRAMIENTO_REPRESENTANTE_FILIAL",
                      ),
                    }))
                    .filter((group) => group.materias.length > 0);
                  // Lote 1 coherencia (A2): las materias del catálogo societario
                  // que no existen en AGENDA_MATERIAS (p.ej. DIVIDENDO_A_CUENTA)
                  // también necesitan su opción propia — sin ella el select
                  // controlado queda en blanco y tocar el select pierde la
                  // materia recibida por intake sin vía de recuperación.
                  const materiaEnAgenda = materiaGroups.some((group) =>
                    group.materias.some((m) => m.value === item.materia),
                  );
                  const isShareholderRepresentativeMatter =
                    item.materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL";
                  const targetEntityOptions = entities.filter((entity) => {
                    if (entity.id === selectedEntityId) return false;
                    if (entity.entity_status !== "Active" || entity.jurisdiction?.toUpperCase() !== "ES") {
                      return false;
                    }
                    const targetType = toTipoSocial(entity.tipo_social ?? entity.legal_form);
                    return targetType === "SL" || targetType === "SLU";
                  });
                  const selectedRepresentationCandidate = shareholderRepresentationCandidates.find(
                    (candidate) =>
                      candidate.delegation_id === item.representation_delegation_id &&
                      candidate.representative_person_id === item.representative_person_id,
                  ) ?? null;
                  const selectedRepresentationTarget = entities.find(
                    (entity) => entity.id === item.target_entity_id,
                  ) ?? null;
                  const annualAccountsTimeliness = item.materia === "FORMULACION_CUENTAS"
                    ? evaluateAnnualAccountsTimeliness({
                        sessionDate: fechaReunion,
                        title: item.titulo,
                        proposal: item.propuesta_acuerdo,
                      })
                    : null;
                  return (
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
                        // Legibility BATCH 2: text-sm → text-base con padding más
                        // generoso. Es texto legal que el secretario relee.
                        className="flex-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-base text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
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

                    {/* agenda_item.kind v3.1: selector de naturaleza del punto.
                        Determina si exige materia / mayoría / propuesta de
                        acuerdo (DECISORIO) o solo constancia no decisoria. */}
                    <div className="pl-5">
                      <div
                        className="flex flex-wrap gap-2"
                        role="radiogroup"
                        aria-label={`Naturaleza del punto ${idx + 1}`}
                      >
                        {KIND_OPTIONS.map((opt) => {
                          const active = itemKind === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              aria-label={`${opt.label}: ${opt.helper}`}
                              onClick={() => {
                                const materiaSelection = agendaMateriaSelectionForKind({
                                  kind: opt.value,
                                  currentMateria: item.materia,
                                  organoTipo,
                                });
                                const patch: Partial<AgendaItem> = {
                                  kind: opt.value,
                                  ...materiaSelection,
                                  requires_attachments:
                                    opt.value === "DECISORIO" &&
                                    materiaSelection.materia === "FORMULACION_CUENTAS",
                                };
                                if (opt.value !== "DECISORIO") {
                                  patch.decision_subtype = null;
                                }
                                updateAgendaItem(item.id, patch);
                              }}
                              title={opt.helper}
                              className={`px-3 py-2 text-sm border transition-colors ${
                                active
                                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                                  : "bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                              }`}
                              style={{ borderRadius: "var(--g-radius-md)" }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-[var(--g-text-secondary)]">
                        {kindHelper}
                      </p>
                    </div>

                    {/* La categoría permanece visible en todo punto no
                        decisorio. Es una clasificación de constancia, no una
                        materia de acuerdo: no activa rule pack ni votación. */}
                    {!isDecisorio && (
                      <div className="mt-3 pl-5">
                        <label
                          htmlFor={`informative-matter-${item.id}`}
                          className="block text-xs font-medium text-[var(--g-text-primary)] mb-1"
                        >
                          Categoría informativa
                        </label>
                        <select
                          id={`informative-matter-${item.id}`}
                          value={categoriaInformativaValida ? item.materia : ""}
                          onChange={(e) =>
                            updateAgendaItem(item.id, {
                              materia: e.target.value,
                              tipo: "ORDINARIA",
                              inscribible: false,
                              requires_attachments: false,
                            })
                          }
                          aria-invalid={!categoriaInformativaValida}
                          aria-describedby={`informative-matter-help-${item.id}`}
                          className="min-w-[320px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <option value="" disabled>— Selecciona una categoría —</option>
                          {AGENDA_INFORMATIVE_MATERIAS.map((materia) => (
                            <option key={materia.value} value={materia.value}>
                              {materia.label}
                            </option>
                          ))}
                        </select>
                        <p
                          id={`informative-matter-help-${item.id}`}
                          className={`mt-1 text-xs ${
                            categoriaInformativaValida
                              ? "text-[var(--g-text-secondary)]"
                              : "text-[var(--status-error)]"
                          }`}
                        >
                          {categoriaInformativaValida
                            ? "Esta categoría se documenta como constancia y queda fuera del motor de acuerdos y votación."
                            : "Revisa el borrador legacy y selecciona una categoría informativa antes de continuar."}
                        </p>
                      </div>
                    )}

                    {/* Subtipo de decisión: solo aplica a DECISORIO. */}
                    {isDecisorio && (
                      <div className="mt-3 pl-5">
                        <label
                          htmlFor={`decision-subtype-${item.id}`}
                          className="block text-xs font-medium text-[var(--g-text-primary)] mb-1"
                        >
                          Subtipo de decisión
                          <span className="ml-1 text-[var(--g-text-secondary)]">
                            (opcional — clasifica el efecto jurídico)
                          </span>
                        </label>
                        <select
                          id={`decision-subtype-${item.id}`}
                          value={item.decision_subtype ?? ""}
                          onChange={(e) =>
                            updateAgendaItem(item.id, {
                              decision_subtype:
                                e.target.value === ""
                                  ? null
                                  : (e.target.value as AgendaDecisionSubtype),
                            })
                          }
                          title={
                            DECISION_SUBTYPE_OPTIONS.find((s) => s.value === item.decision_subtype)
                              ?.hint ?? "Subtipo opcional"
                          }
                          className="min-w-[220px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <option value="">— Sin clasificar —</option>
                          {DECISION_SUBTYPE_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value} title={s.hint}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Materia / clase / inscribible / propuesta solo aplican a
                        puntos DECISORIO. Para puntos no decisorios no hay acuerdo. */}
                    {isDecisorio && (
                      <>
                        <div className="flex items-center gap-3 pl-5 mt-3">
                          <select
                            value={item.materia}
                            onChange={(e) => {
                              const materia = e.target.value;
                              const meta = AGENDA_MATERIAS.find((m) => m.value === materia);
                              updateAgendaItem(item.id, {
                                materia,
                                tipo: (meta?.tipo ?? item.tipo) as AgendaItem["tipo"],
                                inscribible: meta?.inscribible ?? item.inscribible,
                                target_entity_id:
                                  materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
                                    ? item.target_entity_id ?? null
                                    : null,
                                representative_person_id:
                                  materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
                                    ? item.representative_person_id ?? null
                                    : null,
                                representation_authority_route: null,
                                representation_delegation_id:
                                  materia === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"
                                    ? item.representation_delegation_id ?? null
                                    : null,
                                representation_evidence_status: null,
                              });
                            }}
                            aria-label="Materia del acuerdo"
                            className="min-w-[220px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs text-[var(--g-text-primary)] focus:outline-none"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {(!materiaCompatible || !materiaEnAgenda) && (
                              <optgroup
                                label={
                                  !materiaCompatible
                                    ? "Materia actual — incompatible con este órgano"
                                    : "Materia actual — del catálogo de materias"
                                }
                              >
                                <option value={item.materia}>{labelMateria(item.materia)}</option>
                              </optgroup>
                            )}
                            {materiaGroups.map((group) => (
                              <optgroup key={group.key} label={group.label}>
                                {group.materias.map((m) => (
                                  <option key={m.value} value={m.value}>
                                    {m.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <select
                            value={item.tipo}
                            onChange={(e) => updateAgendaItem(item.id, { tipo: e.target.value as AgendaItem["tipo"] })}
                            aria-label="Clase de materia LSC"
                            // BATCH 8.3 (ronda 2 U-A): tooltip sobre el select
                            // explica las 3 clases de materia para que el
                            // secretario sepa cuándo aplica cada una.
                            title={
                              AGENDA_TIPOS.find((t) => t.value === item.tipo)?.hint ??
                              "Clase de materia LSC: ORDINARIA / ESTATUTARIA / ESTRUCTURAL"
                            }
                            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs text-[var(--g-text-primary)] focus:outline-none"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {AGENDA_TIPOS.map((t) => (
                              <option key={t.value} value={t.value} title={t.hint}>{t.label}</option>
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

                        {!materiaCompatible && (
                          <div
                            className="mt-3 ml-5 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                            role="alert"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--status-warning)]">
                              Materia incompatible con el órgano seleccionado
                            </p>
                            <p className="mt-1 text-xs text-[var(--g-text-primary)]">
                              {labelMateria(item.materia)} no corresponde a {organoTipo}. Selecciona una materia compatible para prevenir errores del motor LSC.
                            </p>
                          </div>
                        )}

                        {/* M2 — Advertencia LMV cotizada. Aparece sólo si la
                            entidad es cotizada (`entities.es_cotizada=true`)
                            Y la materia tiene `lmvCotizada: true` en el
                            catálogo. No bloquea ni modifica el motor; sirve
                            de recordatorio al secretario sobre la
                            especialidad aplicable (CNMV, comisión auditoría,
                            ventanas trading, folleto, etc.). */}
                        {Boolean(selectedEntity?.es_cotizada) &&
                          (AGENDA_MATERIAS.find((m) => m.value === item.materia)?.lmvCotizada ?? false) && (
                          <div
                            className="mt-3 ml-5 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                            role="note"
                            aria-label="Advertencia LMV cotizada"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--status-warning)]">
                              ⚠ Especialidad LMV — SA cotizada
                            </p>
                            <p className="mt-1 text-xs text-[var(--g-text-primary)]">
                              {LMV_COTIZADA_ADVERTENCIAS[item.materia] ??
                                "SA cotizada: revisar especialidades LMV / CNMV aplicables a esta materia antes de convocar."}
                            </p>
                          </div>
                        )}

                        {(annualAccountsTimeliness?.isLate || annualAccountsTimeliness?.blocking) && (
                          <div
                            className={`mt-3 ml-5 border p-3 ${
                              annualAccountsTimeliness.blocking
                                ? "border-[var(--status-error)] bg-[var(--g-surface-card)]"
                                : "border-[var(--status-warning)] bg-[var(--g-surface-subtle)]"
                            }`}
                            style={{ borderRadius: "var(--g-radius-md)" }}
                            role="alert"
                            aria-label="Alerta de formulación extemporánea"
                          >
                            <p className={`text-xs font-semibold ${
                              annualAccountsTimeliness.blocking
                                ? "text-[var(--status-error)]"
                                : "text-[var(--status-warning)]"
                            }`}>
                              Validación del ejercicio y del plazo · art. 253.1 LSC
                            </p>
                            <p className="mt-1 text-xs text-[var(--g-text-primary)]">
                              {annualAccountsTimeliness.message}
                            </p>
                            {annualAccountsTimeliness.blocking && (
                              <p className="mt-2 text-xs font-medium text-[var(--status-error)]">
                                Bloqueo: añade a la propuesta que la formulación es extemporánea, que se adopta como regularización y que se hace sin convalidar el incumplimiento del plazo.
                              </p>
                            )}
                          </div>
                        )}

                        {isShareholderRepresentativeMatter && (
                          <div
                            className="mt-3 ml-5 border border-[var(--g-border-default)] bg-[var(--g-surface-subtle)] p-3"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                            aria-label="Gate de representación de la socia única"
                          >
                            <p className="text-xs font-semibold text-[var(--g-text-primary)]">
                              Datos autoritativos de la representación
                            </p>
                            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                              La selección es un registro para validación, no una acreditación. El servidor deberá comprobar el poder general en documento público (art. 183.1 LSC), la titularidad del 100 % y la ausencia de administrador persona jurídica. El texto libre no sustituye esas evidencias.
                            </p>

                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <label
                                  htmlFor={`target-entity-${item.id}`}
                                  className="block text-xs font-medium text-[var(--g-text-primary)]"
                                >
                                  Filial participada al 100 %
                                </label>
                                <select
                                  id={`target-entity-${item.id}`}
                                  value={item.target_entity_id ?? ""}
                                  onChange={(event) => updateAgendaItem(item.id, {
                                    target_entity_id: event.target.value || null,
                                    representative_person_id: null,
                                    representation_authority_route: null,
                                    representation_delegation_id: null,
                                    representation_evidence_status: null,
                                  })}
                                  aria-invalid={!item.target_entity_id}
                                  aria-describedby={`target-entity-help-${item.id}`}
                                  className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                                  style={{ borderRadius: "var(--g-radius-md)" }}
                                >
                                  <option value="">— Selecciona la filial —</option>
                                  {targetEntityOptions.map((entity) => (
                                    <option key={entity.id} value={entity.id}>
                                      {entity.legal_name ?? entity.common_name}
                                    </option>
                                  ))}
                                </select>
                                <p
                                  id={`target-entity-help-${item.id}`}
                                  className={`mt-1 text-xs ${
                                    item.target_entity_id
                                      ? "text-[var(--g-text-secondary)]"
                                      : "text-[var(--status-error)]"
                                  }`}
                                >
                                  {item.target_entity_id
                                    ? "Selección pendiente de verificar: no acredita por sí sola el 100 % del capital."
                                    : "La filial concreta es obligatoria."}
                                </p>
                              </div>

                              <div>
                                <label
                                  htmlFor={`representative-${item.id}`}
                                  className="block text-xs font-medium text-[var(--g-text-primary)]"
                                >
                                  Registro de representante para validación
                                </label>
                                <select
                                  id={`representative-${item.id}`}
                                  value={item.representation_delegation_id ?? ""}
                                  onChange={(event) => {
                                    const candidate = shareholderRepresentationCandidates.find(
                                      (row) => row.delegation_id === event.target.value,
                                    );
                                    updateAgendaItem(item.id, {
                                      representative_person_id: candidate?.representative_person_id ?? null,
                                      representation_authority_route: null,
                                      representation_delegation_id: candidate?.delegation_id ?? null,
                                      representation_evidence_status: null,
                                    });
                                  }}
                                  disabled={shareholderRepresentationCandidatesLoading}
                                  aria-invalid={!item.representation_delegation_id}
                                  aria-describedby={`representative-help-${item.id}`}
                                  className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
                                  style={{ borderRadius: "var(--g-radius-md)" }}
                                >
                                  <option value="">
                                    {shareholderRepresentationCandidatesLoading
                                      ? "Cargando registros…"
                                      : "— Selecciona representante —"}
                                  </option>
                                  {shareholderRepresentationCandidates.map((candidate) => (
                                    <option
                                      key={candidate.delegation_id}
                                      value={candidate.delegation_id}
                                    >
                                      {candidate.representative_name} · {candidate.source_reference ?? candidate.delegation_id.slice(0, 8)}
                                    </option>
                                  ))}
                                </select>
                                <p
                                  id={`representative-help-${item.id}`}
                                  className={`mt-1 text-xs ${
                                    item.representation_delegation_id && !shareholderRepresentationCandidatesError
                                      ? "text-[var(--g-text-secondary)]"
                                      : "text-[var(--status-error)]"
                                  }`}
                                >
                                  {shareholderRepresentationCandidatesError
                                    ? "No se pudo verificar el registro de poderes. El registro DEMO quedará bloqueado."
                                    : selectedRepresentationCandidate
                                    ? `Registro candidato: ${selectedRepresentationCandidate.authority_route} · estado declarado ${selectedRepresentationCandidate.evidence_status}. Pendiente de comprobar el documento público y su suficiencia.`
                                    : "Solo se muestran registros estructurados candidatos; ninguno acredita por sí solo poder vigente o suficiente."}
                                </p>
                              </div>
                            </div>

                            {selectedRepresentationCandidate?.legal_effect === "DEMO_SIMULATION_NO_LEGAL_EFFECT" && (
                              <p className="mt-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2 text-xs text-[var(--g-text-primary)]">
                                Registro sintético del tenant DEMO: permite validar el flujo, pero no acredita poder vigente, titularidad del capital ni estructura del órgano de la filial y no produce efectos jurídicos.
                              </p>
                            )}

                            <button
                              type="button"
                              disabled={!selectedRepresentationTarget || !selectedRepresentationCandidate || !selectedEntity}
                              onClick={() => {
                                if (!selectedRepresentationTarget || !selectedRepresentationCandidate || !selectedEntity) return;
                                updateAgendaItem(item.id, {
                                  propuesta_acuerdo: buildSoleShareholderRepresentativeProposal({
                                    shareholderName: selectedEntity.legal_name ?? selectedEntity.common_name,
                                    targetName: selectedRepresentationTarget.legal_name ?? selectedRepresentationTarget.common_name,
                                    representativeName: selectedRepresentationCandidate.representative_name,
                                  }),
                                });
                              }}
                              className="mt-3 border border-[var(--g-brand-3308)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-brand-3308)] hover:bg-[var(--g-sec-100)] disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ borderRadius: "var(--g-radius-md)" }}
                            >
                              Generar propuesta condicionada a validación
                            </button>
                          </div>
                        )}

                        {/* Propuesta de acuerdo concreta — art. 197.1 / 287 LSC.
                            Texto que el secretario redacta para el punto y que
                            los consejeros estudian antes de la sesión. Persiste
                            en agenda_items JSONB. */}
                        <div className="mt-3 pl-5">
                          <label className="block text-xs font-medium text-[var(--g-text-primary)] mb-1">
                            Propuesta de acuerdo
                            <span className="ml-1 text-[var(--g-text-secondary)]">
                              (texto que se someterá a votación — opcional pero recomendable
                              {item.tipo !== "ORDINARIA" && (
                                <span className="ml-1 text-[var(--status-warning)]">
                                  · obligatoria para materias {item.tipo.toLowerCase()}
                                </span>
                              )})
                            </span>
                          </label>
                          <textarea
                            value={item.propuesta_acuerdo ?? ""}
                            onChange={(e) =>
                              updateAgendaItem(item.id, {
                                propuesta_acuerdo: e.target.value.length > 0 ? e.target.value : null,
                              })
                            }
                            placeholder={
                              item.tipo === "ORDINARIA"
                                ? "Ej: Aprobar las cuentas anuales del ejercicio 2025 cerradas a 31/12/2025…"
                                : "Texto íntegro del acuerdo que se propondrá. Para materias estatutarias / estructurales LSC art. 197.1 / 287 exige que los socios dispongan del texto exacto antes de la sesión."
                            }
                            rows={3}
                            className="w-full resize-y border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-base leading-relaxed text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  );
                })}
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
                  {organoTipo === "JUNTA_GENERAL" ? "Socios destinatarios" : "Miembros del órgano convocante"}
                </p>
              </div>

              {activeRecipients.length === 0 ? (
                <div
                  className="bg-[var(--g-sec-100)] border border-[var(--g-sec-300)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm text-[var(--g-text-secondary)]">
                    {organoTipo === "JUNTA_GENERAL"
                      ? "No hay socios vigentes registrados para esta sociedad."
                      : "No hay miembros vigentes registrados para este órgano."}
                    La convocatoria se enviará sin destinatarios predefinidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeRecipients.map((m) => {
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
                {activeRecipients.length - excludedPersonIds.size} destinatario(s) seleccionado(s).
                {/* ITEM-064: tras emitir, la pantalla de éxito ofrece generar la
                    comunicación de convocatoria a estos destinatarios. */}
                Tras registrar la simulación podrás preparar la comunicación en sandbox para estos destinatarios.
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
              <p className="border-l-4 border-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-primary)]">
                EAD Trust se registra exclusivamente como interposición, mensajería básica y custodia/e-archiving. En esta demo no existe capacidad contractual acreditada para afirmar firma, ERDS, envío o entrega.
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
                      No bloquean el avance ni el registro DEMO; quedan como trazabilidad si una publicación o notificación se ejecuta fuera de TGMS.
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
                  {/* ITEM-064: los canales son trazabilidad del expediente; la
                      notificación efectiva se genera tras emitir desde
                      "Generar comunicación". */}
                  Sin canales seleccionados quedan sin recordatorio de publicación; podrás preparar una comunicación sandbox tras registrar la simulación.
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
                            {documentToMaterias[doc.id]?.length ? (
                              <span className="mt-0.5 block text-[11px] text-[var(--g-brand-3308)]">
                                Exigido por:{" "}
                                {documentToMaterias[doc.id]
                                  .map((m) => AGENDA_MATERIAS.find((am) => am.value === m)?.label ?? m)
                                  .join(", ")}
                              </span>
                            ) : null}
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
                  <p className="text-sm text-[var(--g-text-secondary)]">
                    No hay adjuntos añadidos. Los archivos se subirán al registrar la simulación DEMO
                    y quedarán archivados con SHA-512 en <code>attachments</code>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {adjuntos.map((a) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center border border-[var(--g-border-subtle)] p-2"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={a.alias}
                          onChange={(e) => updateAdjunto(a.id, "alias", e.target.value)}
                          placeholder="Alias visible"
                          aria-label="Alias del documento"
                          className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        />
                        <p className="mt-1 truncate text-[10px] text-[var(--g-text-secondary)]">
                          {a.file.name} · {(a.file.size / 1024).toFixed(0)} KB · {a.file.type || "desconocido"}
                        </p>
                        {a.error && (
                          <p className="mt-0.5 text-[10px] text-[var(--status-error)]">{a.error}</p>
                        )}
                      </div>
                      <input
                        type="text"
                        value={a.descripcion}
                        onChange={(e) => updateAdjunto(a.id, "descripcion", e.target.value)}
                        placeholder="Descripción (opcional)"
                        aria-label="Descripción del adjunto"
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

              <label
                className="inline-flex cursor-pointer items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir adjuntos (PDF / DOCX, ≤25 MB)
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}

          {/* ── PASO 7: Borrador documento ── */}
          {current === 7 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Borrador del documento de convocatoria
                </p>
              </div>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Se aplica la plantilla protegida correspondiente al órgano y forma jurídica.
                Capa 1 (texto inmutable) + Capa 2 (variables resueltas del expediente) +
                Capa 3 (campos editables) componen el borrador. El texto final queda
                persistido en <code>convocatoria_text</code> al registrar la simulación.
              </p>

              {candidateTemplates.length === 0 ? (
                <div
                  className="border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    Sin plantilla CONVOCATORIA disponible
                  </p>
                  <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    No hay plantillas protegidas de tipo CONVOCATORIA o
                    CONVOCATORIA_SL_NOTIFICACION cargadas en el tenant. Puedes escribir el
                    texto del borrador manualmente, pero perderás trazabilidad de plantilla
                    legal aprobada.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-[var(--g-text-primary)]">
                    Plantilla seleccionada
                  </label>
                  <select
                    value={effectiveBorradorTemplate?.id ?? ""}
                    onChange={(e) => {
                      setSelectedBorradorTemplateId(e.target.value || null);
                      setBorradorDirty(false);
                    }}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="">— Seleccionar plantilla —</option>
                    {candidateTemplates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.tipo} · v{p.version} · {p.estado}
                        {p.organo_tipo ? ` · ${p.organo_tipo}` : ""}
                      </option>
                    ))}
                  </select>
                  {effectiveBorradorTemplate && (
                    <p className="text-[11px] text-[var(--g-text-secondary)]">
                      ID {effectiveBorradorTemplate.id.slice(0, 8)} ·{" "}
                      {effectiveBorradorTemplate.referencia_legal ?? "Sin referencia legal anotada"}
                    </p>
                  )}

                  {/* M4 — Badge BORRADOR / no apta para producción.
                      El flujo de plantillas protegidas exige
                      BORRADOR → REVISADA → APROBADA → ACTIVA con
                      `aprobada_por IS NOT NULL` en estado ACTIVA. Una
                      convocatoria emitida con plantilla en BORRADOR rompe
                      la cadena de trazabilidad legal — la probe de cierre
                      del proyecto lo detectaría. Mostramos badge
                      bloqueante visual aunque la emisión siga siendo
                      posible (decisión consciente del secretario). */}
                  {/* Codex P2 PR #3 round 4: REVISADA también merece badge.
                      `selectProcessTemplate()` automático no la usaría
                      (sólo ACTIVA/APROBADA son operacionales), pero el
                      selector manual sí la exponía. La probe de cierre
                      del proyecto exige `estado='ACTIVA' AND aprobada_por
                      IS NOT NULL` — REVISADA está en limbo. */}
                  {effectiveBorradorTemplate &&
                    (effectiveBorradorTemplate.estado === "BORRADOR" ||
                      effectiveBorradorTemplate.estado === "REVISADA") && (
                    <div
                      className="border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                      role="alert"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--status-warning)]">
                        ⚠ Plantilla en {effectiveBorradorTemplate.estado} — no apta para producción
                      </p>
                      <p className="mt-1 text-xs text-[var(--g-text-primary)]">
                        {effectiveBorradorTemplate.estado === "BORRADOR" ? (
                          <>
                            Esta plantilla no ha pasado por el flujo de revisión legal
                            (BORRADOR → REVISADA → APROBADA → ACTIVA). Su uso en una
                            simulación registrada queda como evidencia{" "}
                            <em>demo / operativa</em>, sin cobertura legal de plantilla
                            aprobada.
                          </>
                        ) : (
                          <>
                            Esta plantilla ha sido revisada por Legal pero todavía
                            no ha sido aprobada ni promovida a ACTIVA. Su uso queda
                            como evidencia <em>demo / operativa</em> hasta que
                            complete el ciclo REVISADA → APROBADA → ACTIVA.
                          </>
                        )}{" "}
                        Promover en Gestor de Plantillas antes de uso en producción real.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {borradorCapa3Fields.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
                    Capa 3 — campos editables
                  </p>
                  <Capa3Form
                    fields={borradorCapa3Fields}
                    values={borradorCapa3Values}
                    onChange={handleBorradorCapa3ValuesChange}
                    telematicaEnabled={formatoReunion !== "PRESENCIAL"}
                  />
                  {/* Codex P2 round 12 PR #3: gate visible cuando faltan
                      campos obligatorios. El botón "Siguiente" queda
                      disabled por canAdvance() — este banner explica al
                      secretario por qué. */}
                  {borradorCapa3HasMissing && (
                    <p className="text-[11px] text-[var(--status-error)]">
                      ⚠ Faltan campos obligatorios de la plantilla:{" "}
                      {Object.keys(borradorCapa3MissingRequired).join(", ")}.
                      No se puede avanzar al Paso 8 hasta rellenarlos.
                    </p>
                  )}
                </div>
              )}

              {/* Codex P2 round 12 PR #3: aviso render pendiente. Si el
                  usuario llega al Paso 7 con plantilla seleccionada y el
                  import dinámico aún no resolvió, el textarea está vacío.
                  canAdvance() bloquea pasar a Paso 8 y este aviso explica
                  por qué el botón "Siguiente" no está habilitado. */}
              {borradorRenderPending && (
                <div
                  className="border-l-4 border-[var(--status-info)] bg-[var(--g-surface-card)] p-2"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                  role="status"
                  aria-busy="true"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--status-info)]">
                    ⏳ Cargando motor de plantillas…
                  </p>
                  <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Renderizando el borrador desde la plantilla. Espera unos segundos
                    antes de avanzar al Paso 8.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-[var(--g-text-primary)]">
                    Texto del borrador (editable)
                  </label>
                  <button
                    type="button"
                    onClick={regenerateBorrador}
                    disabled={!effectiveBorradorTemplate?.capa1_inmutable}
                    className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-2 py-1 text-[11px] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    Regenerar desde plantilla
                  </button>
                </div>
                <textarea
                  value={borradorTexto}
                  onChange={(e) => {
                    // Codex P2 round 10 PR #3: cualquier edit manual del
                    // usuario invalida el token de cualquier render async
                    // pendiente. Sin esto, un import dinámico de
                    // `template-renderer` rezagado podía resolver tras los
                    // primeros keystrokes, ejecutar setBorradorTexto +
                    // setBorradorDirty(false), y borrar silenciosamente
                    // los edits del usuario.
                    //
                    // Codex P2 round 13 PR #3: además limpiar
                    // `borradorRenderPending`. El callback async con token
                    // stale hace early-return sin tocar pending — si el
                    // cancelador fue un edit manual (no otra
                    // `regenerateBorrador`), pending quedaba bloqueado en
                    // true para siempre, dejando "Siguiente" + "Emitir"
                    // deshabilitados.
                    //
                    // Codex P2 round 16 PR #3: además registrar baseline
                    // del hash de contexto en `borradorLastRenderHashRef`.
                    // Si el usuario edita ANTES de que el primer render
                    // del template se complete, el ref queda en "" y
                    // `borradorIsStale` (que requiere ref !== "") nunca
                    // dispara aunque luego cambie el contexto upstream.
                    // Marcamos el contexto actual como baseline del edit
                    // manual para que cambios posteriores SÍ disparen el
                    // stale guard.
                    regenerateTokenRef.current += 1;
                    setBorradorRenderPending(false);
                    if (borradorLastRenderHashRef.current === "") {
                      borradorLastRenderHashRef.current = borradorContextHash;
                    }
                    setBorradorTexto(e.target.value);
                    setBorradorDirty(true);
                  }}
                  rows={16}
                  placeholder={effectiveBorradorTemplate?.capa1_inmutable ? "Borrador generado desde plantilla…" : "Sin plantilla aplicada — escribe el texto manualmente o continúa sin texto."}
                  className="w-full resize-y border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 font-mono text-sm leading-relaxed text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--g-text-secondary)]">
                  <span>{borradorTexto.length} caracteres</span>
                  {borradorDirty && (
                    <span className="text-[var(--status-warning)]">
                      Editado manualmente — "Regenerar" descartará tus cambios.
                    </span>
                  )}
                </div>
                {renderUnresolved.length > 0 && (
                  <p className="text-[11px] text-[var(--status-warning)]">
                    Variables sin valor en la plantilla: {renderUnresolved.slice(0, 8).join(", ")}
                    {renderUnresolved.length > 8 ? ` y ${renderUnresolved.length - 8} más` : ""}.
                  </p>
                )}

                {/* Codex P2 round 8 PR #3: borrador stale cuando el contexto
                    upstream (entidad, órgano, fecha, agenda, plantilla)
                    cambió tras el último render limpio. Bloquea el registro DEMO
                    hasta que el usuario decida explícitamente: regenerar
                    desde plantilla o confirmar que el texto editado sigue
                    siendo correcto. */}
                {borradorIsStale && (
                  <div
                    className="mt-2 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-card)] p-2"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                    role="alert"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--status-error)]">
                      ⚠ Borrador desactualizado — contexto cambió
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-primary)]">
                      Editaste manualmente el texto y después cambiaste alguno
                      de: entidad, órgano, fecha, orden del día, canales,
                      plantilla o capa 3. El texto puede haberse quedado
                      desfasado respecto a la metadata que se persistirá. Pulsa{" "}
                      <span className="font-semibold">"Regenerar desde plantilla"</span>{" "}
                      para reincorporar el contexto nuevo o confirma manualmente
                      que el texto sigue siendo válido (Paso 8 emite tal cual).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        // Codex P2 round 11 PR #3: confirmación explícita.
                        // Actualizamos el hash de referencia para alinear
                        // los refs con el contexto actual, Y el state
                        // `staleAcknowledgedHash` para forzar re-render
                        // (refs solos no disparan re-render → React
                        // bail-out con setBorradorTexto(prev=>prev)).
                        // `borradorDirty` se mantiene true como evidencia
                        // de que el texto fue editado manualmente.
                        borradorLastRenderHashRef.current = borradorContextHash;
                        setStaleAcknowledgedHash(borradorContextHash);
                      }}
                      className="mt-2 border border-[var(--status-warning)] bg-transparent px-2 py-1 text-[11px] text-[var(--status-warning)] hover:bg-[var(--g-surface-subtle)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      Conservar texto como válido bajo mi responsabilidad
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 8: Revisión y registro DEMO ── */}
          {current === 8 && (
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
                      .map((item, idx) => {
                        const itemKind: AgendaItemKind = item.kind ?? "DELIBERATIVO";
                        const kindLabel =
                          KIND_OPTIONS.find((k) => k.value === itemKind)?.label ?? itemKind;
                        return (
                          <li key={item.id} className="text-sm text-[var(--g-text-primary)]">
                            <span className="text-[var(--g-text-secondary)]">{idx + 1}. </span>
                            {item.titulo}
                            <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                              [{kindLabel}
                              {itemKind === "DECISORIO" && (
                                <>
                                  {" · "}
                                  {labelMateria(item.materia)} · {item.tipo}
                                  {item.inscribible ? " · inscribible" : ""}
                                </>
                              )}
                              ]
                            </span>
                          </li>
                        );
                      })}
                  </ol>
                )}
              </div>

              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
                      Borrador DEMO que se registrará
                    </p>
                    <p className="mt-1 text-sm text-[var(--g-text-primary)]">
                      Fuente del documento: texto revisado del Paso 7
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
                    <span
                      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {borradorTexto.trim().length} caracteres
                    </span>
                    <span
                      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {borradorDirty ? "Editado por Secretaría" : "Sin edición manual"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[var(--g-text-secondary)] sm:grid-cols-3">
                  <MiniFact label="Plantilla" value={effectiveBorradorTemplate ? `${effectiveBorradorTemplate.tipo} v${effectiveBorradorTemplate.version}` : "Sin plantilla"} />
                  <MiniFact label="Estado" value={effectiveBorradorTemplate?.estado ?? "—"} />
                  <MiniFact label="Variables sin resolver" value={String(renderUnresolved.length)} />
                </div>

                {renderUnresolved.length > 0 ? (
                  <div
                    className="mt-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--status-warning)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Variables pendientes: {renderUnresolved.slice(0, 6).join(", ")}
                    {renderUnresolved.length > 6 ? ` y ${renderUnresolved.length - 6} más` : ""}
                  </div>
                ) : null}

                {borradorTexto.trim() ? (
                  <pre
                    className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 font-mono text-xs leading-relaxed text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    {borradorTexto}
                  </pre>
                ) : (
                  <div
                    className="mt-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--status-warning)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <p>
                      No hay texto de convocatoria preparado.
                      {effectiveBorradorTemplate?.capa1_inmutable
                        ? " Pulsa «Generar ahora» para componerlo desde la plantilla, o vuelve al Paso 7 para revisarlo."
                        : " No hay plantilla de convocatoria disponible para este órgano/jurisdicción; escribe el texto en el Paso 7."}
                    </p>
                    {effectiveBorradorTemplate?.capa1_inmutable ? (
                      <button
                        type="button"
                        onClick={regenerateBorrador}
                        disabled={borradorRenderPending}
                        aria-busy={borradorRenderPending}
                        className="mt-2 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-1.5 font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        Generar ahora
                      </button>
                    ) : null}
                  </div>
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
                    ? "El registro DEMO no queda condicionado por canales de publicación o notificación."
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
                <span className="font-semibold">{Math.max(activeRecipients.length - excludedPersonIds.size, 0)}</span> destinatario(s)
                {adjuntos.length > 0 && (
                  <> · <span className="font-semibold">{adjuntos.length}</span> adjunto(s)</>
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
                key="register-convocation"
                type="button"
                disabled={
                  createConvocatoria.isPending ||
                  isPreparingAttachmentIntents ||
                  uploadStatus.inFlight > 0 ||
                  !selectedBodyId ||
                  !fechaReunion ||
                  borradorIsStale ||
                  borradorRenderPending ||
                  borradorCapa3HasMissing ||
                  !convocationAuthorityReady ||
                  !representationAgendaReady ||
                  !annualAccountsAgendaReady ||
                  Boolean(segundaConvocatoriaGapWarning)
                }
                onClick={handleEmitir}
                aria-busy={
                  createConvocatoria.isPending ||
                  isPreparingAttachmentIntents ||
                  uploadStatus.inFlight > 0 ||
                  borradorRenderPending
                }
                title={
                  !selectedBodyId
                    ? "Selecciona el órgano convocante en el Paso 1."
                    : !fechaReunion
                    ? "Indica la fecha de la reunión en el Paso 2."
                    : borradorIsStale
                    ? "El borrador del Paso 7 está desactualizado por cambio de contexto. Regenerar o confirmar antes de registrarlo."
                    : borradorRenderPending
                    ? "El motor de plantillas aún no terminó de renderizar. Espera unos segundos."
                    : borradorCapa3HasMissing
                    ? `Faltan campos obligatorios de capa 3 en Paso 7: ${Object.keys(borradorCapa3MissingRequired).join(", ")}.`
                    : !convocationAuthorityReady
                    ? "No hay titular del cargo de Presidente acreditado como referencia para el registro DEMO."
                    : !representationAgendaReady
                    ? "Falta completar la filial, el registro del representante o las condiciones de poder público, capital y ausencia de administrador persona jurídica."
                    : !annualAccountsAgendaReady
                    ? annualAccountsAgendaIssues[0]?.result.message ?? "La formulación extemporánea requiere condición expresa de regularización."
                    : undefined
                }
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <ShieldCheck className="h-4 w-4" />
                {borradorIsStale
                  ? "Borrador stale — resolver Paso 7"
                  : borradorRenderPending
                  ? "Renderizando borrador…"
                  : borradorCapa3HasMissing
                  ? "Capa 3 incompleta — Paso 7"
                  : !convocationAuthorityReady
                  ? "Autoridad convocante pendiente"
                  : !representationAgendaReady
                  ? "Representación pendiente — Paso 3"
                  : !annualAccountsAgendaReady
                  ? "Regularización de cuentas pendiente — Paso 3"
                  : isPreparingAttachmentIntents
                  ? "Calculando huellas de anexos…"
                  : uploadStatus.inFlight > 0
                  ? `Subiendo ${uploadStatus.inFlight} adjunto(s)…`
                  : createConvocatoria.isPending
                  ? "Registrando simulación…"
                  : "Registrar simulación DEMO"}
              </button>
            ) : (
              <button
                key="advance-step"
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
