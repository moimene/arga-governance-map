import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Check, ChevronDown, ChevronRight,
  AlertTriangle, FileText, Globe, Plus, Send, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { evaluarConvocatoria } from "@/lib/rules-engine";
import type { ConvocatoriaInput, RulePack, RuleParamOverride, RuleResolution, TipoSocial } from "@/lib/rules-engine";
import { resolveOrganoTipo } from "@/lib/secretaria/organo-resolver";
import { checkNoticePeriodByType, useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useBodyMandates } from "@/hooks/useBodies";
import { useCreateConvocatoria, useUploadConvocatoriaAttachment, type AgendaItem } from "@/hooks/useConvocatorias";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { Capa3Form } from "@/components/secretaria/Capa3Form";
import { selectProcessTemplate } from "@/lib/doc-gen/process-documents";
import { supabase } from "@/integrations/supabase/client";
import type { AgendaItemKind, AgendaDecisionSubtype } from "@/lib/secretaria/agenda-kind";
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
  { n: 6, label: "Adjuntos",                hint: "Documentos de referencia y propuestas que se adjuntan" },
  { n: 7, label: "Borrador documento",      hint: "Plantilla + capa 3 editable + borrador final del texto" },
  { n: 8, label: "Revisión y emisión",      hint: "Verificación de compliance y emisión definitiva" },
];

const JURIS_FLAGS: Record<string, string> = { ES: "🇪🇸", PT: "🇵🇹", BR: "🇧🇷", MX: "🇲🇽" };

const CHANNEL_OPTIONS: Record<string, { value: string; label: string; recommended?: boolean }[]> = {
  ES: [
    { value: "WEB_CORPORATIVA",    label: "Web corporativa (art. 173 LSC)", recommended: true },
    { value: "BORME",              label: "BORME" },
    { value: "ERDS",               label: "Notificación ERDS (EAD Trust)", recommended: true },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado" },
    { value: "BUROFAX",            label: "Burofax" },
    { value: "EMAIL_SIMPLE",       label: "Email simple a los miembros del órgano" },
  ],
  PT: [
    { value: "JORNAL_OFICIAL",  label: "Diário da República", recommended: true },
    { value: "JORNAL_DIARIO",   label: "Jornal diário de grande circulação" },
    { value: "WEB_CORPORATIVA", label: "Site corporativo" },
    { value: "ERDS",            label: "Notificação ERDS certificada (EAD Trust)" },
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
    { value: "ERDS",               label: "Notificación ERDS (EAD Trust)" },
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
//   JUNTA → todos los canales (publicidad oficial art. 173 LSC + ERDS)
//   CDA / COMISION / COMITE / COMISION_DELEGADA → notificación directa
//     al miembro (email, correo certificado, ERDS, burofax)
const CHANNELS_RELEVANT_BY_BODY_TYPE: Record<string, Set<string>> = {
  JUNTA: new Set([]),  // empty = no filter, mostrar todos
  CDA: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", "ERDS", "BUROFAX"]),
  COMISION: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", "ERDS", "BUROFAX"]),
  COMISION_DELEGADA: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", "ERDS", "BUROFAX"]),
  COMITE: new Set(["EMAIL_SIMPLE", "CORREO_CERTIFICADO", "ERDS", "BUROFAX"]),
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

// agenda_item.kind v1.3: naturaleza del punto del orden del día.
// Solo los puntos DECISORIO (label visible: "Acuerdo") se someten a votación
// y materializan como acuerdo registrable. INFORMATIVO y DELIBERATIVO no
// producen acuerdo y por tanto no exigen materia / mayoría / propuesta de
// acuerdo. El enum DB mantiene "DECISORIO"; solo la etiqueta de UI cambia.
const KIND_OPTIONS: { value: AgendaItemKind; label: string; helper: string }[] = [
  {
    value: "INFORMATIVO",
    label: "Informativo",
    helper: "Solo informe, sin decisión ni debate formal.",
  },
  {
    value: "DELIBERATIVO",
    label: "Deliberativo",
    helper: "Debate y conclusiones, sin votación formal.",
  },
  {
    value: "DECISORIO",
    label: "Acuerdo",
    helper: "Propuesta concreta sometible a votación y materializable como acuerdo registrable.",
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

// `lmvCotizada=true` marca materias con especialidades aplicables a SA
// cotizadas (LMV / Código de Buen Gobierno CNMV). NO cambia la clase de
// materia (sigue siendo ORDINARIA/ESTATUTARIA/ESTRUCTURAL para el motor),
// pero activa advertencias en la UI si la entidad es cotizada:
//   - OPERACION_VINCULADA: art. 529 ter.h + 530 LSC → comisión auditoría
//     + aprobación CdA + comunicación CNMV (>5% balance) o folleto si afecta
//     al mercado.
//   - PROGRAMA_RECOMPRA: art. 277 LSC + Reglamento UE 596/2014 (abuso de
//     mercado) → autorización JGA + notificación CNMV + ventanas trading.
//   - REMUNERACION_CONSEJEROS: art. 529 novodecies LSC → informe anual
//     vinculante + voto consultivo cotizadas.
const AGENDA_MATERIAS = [
  // Ordinarias (gestión recurrente del órgano)
  { value: "APROBACION_CUENTAS", label: "Aprobación de cuentas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "APLICACION_RESULTADO", label: "Aplicación del resultado", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "DISTRIBUCION_DIVIDENDOS", label: "Distribución de dividendos", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "DISTRIBUCION_RESERVAS", label: "Distribución de reservas / dividendo a cuenta", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "REELECCION_CONSEJERO", label: "Reelección de consejero", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "CESE_CONSEJERO", label: "Cese / separación de consejero", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento / reelección de auditor", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  // Canonical id `REMUNERACION_CONSEJEROS` (materia_catalog 20260424_000033).
  { value: "REMUNERACION_CONSEJEROS", label: "Política / informe de remuneración de consejeros", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "DELEGACION_FACULTADES", label: "Delegación de facultades", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  // Codex P2 round 9 PR #3: id canonical singular `OPERACION_VINCULADA`
  // (verificado en supabase/migrations/20260420_000017_seed_rule_packs_v2.sql).
  // El plural ("OPERACIONES_VINCULADAS") rompía el match con el rule_pack
  // aprobado → convocatoria perdía payload LMV (comisión auditoría +
  // CNMV) y caía a warning genérico. Label visible plural por UX.
  { value: "OPERACION_VINCULADA", label: "Operaciones con partes vinculadas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "PROGRAMA_RECOMPRA", label: "Programa de recompra de acciones / autocartera", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "AUTORIZACION_GARANTIA", label: "Garantía / aval intragrupo", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },

  // Estatutarias (mayoría reforzada art. 199/201 LSC)
  { value: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  // MODIFICACION_REGLAMENTO es ORDINARIA: reglamento del consejo/junta NO
  // es estatutos (jerarquía LEY → ESTATUTOS → REGLAMENTO). Art. 285-290 LSC
  // aplica sólo a modificación estatutaria; el reglamento se aprueba por
  // mayoría legal del órgano competente.
  { value: "MODIFICACION_REGLAMENTO", label: "Modificación de reglamento del consejo / junta", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "AUMENTO_CAPITAL", label: "Aumento de capital", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  { value: "REDUCCION_CAPITAL", label: "Reducción de capital", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  { value: "EMISION_OBLIGACIONES", label: "Emisión de obligaciones / convertibles", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: true },
  // Canonical ids con sufijo `_SOCIAL` (materia_catalog 20260424_000033).
  { value: "CAMBIO_DENOMINACION_SOCIAL", label: "Cambio de denominación social", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },
  { value: "CAMBIO_DOMICILIO_SOCIAL", label: "Cambio de domicilio social", tipo: "ESTATUTARIA", inscribible: true, lmvCotizada: false },

  // Estructurales (escritura pública + RM)
  { value: "TRANSFORMACION", label: "Transformación social", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: false },
  { value: "FUSION", label: "Fusión", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: true },
  { value: "ESCISION", label: "Escisión", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: true },
  { value: "DISOLUCION", label: "Disolución", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: false },
  { value: "CESION_GLOBAL", label: "Cesión global de activo y pasivo", tipo: "ESTRUCTURAL", inscribible: true, lmvCotizada: true },
  { value: "AUTORIZACION_OPERACION_ESTRUCTURAL", label: "Autorización operación estructural intragrupo", tipo: "ESTRUCTURAL", inscribible: false, lmvCotizada: true },

  // BATCH 8.3 (ronda 2 U-A): opción "OTROS — acuerdo libre" para puntos
  // que no encajan en el catálogo predefinido. NO dispara motor V2 (se
  // filtra en agendaRuleSpecs) — es responsabilidad del secretario indicar
  // tipo correcto y aceptar que no hay rule pack aplicable.
  { value: "OTROS_LIBRE", label: "Otros — acuerdo libre (sin regla aplicable)", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
] as const;

// LMV cotizada advertencias específicas por materia. Texto enseña al
// secretario qué especialidad cotizada aplica y dónde está la referencia.
const LMV_COTIZADA_ADVERTENCIAS: Record<string, string> = {
  OPERACION_VINCULADA:
    "SA cotizada: requiere informe de la Comisión de Auditoría (art. 529 ter.h LSC) + aprobación del Consejo. Si la operación supera el 5% del balance debe comunicarse a CNMV (art. 530 LSC).",
  PROGRAMA_RECOMPRA:
    "SA cotizada: autorización JGA (art. 277 LSC) + notificación CNMV + cumplimiento de ventanas de trading (Reglamento UE 596/2014 sobre abuso de mercado).",
  REMUNERACION_CONSEJEROS:
    "SA cotizada: informe anual de remuneraciones vinculante + voto consultivo de la JGA sobre la política de retribución (art. 529 novodecies LSC).",
  EMISION_OBLIGACIONES:
    "SA cotizada: posible obligación de folleto informativo CNMV (Reglamento UE 2017/1129) cuando la emisión se ofrezca al público.",
  FUSION: "SA cotizada: documento de fusión + informe del consejo + posible folleto CNMV si afecta a accionistas minoritarios.",
  ESCISION: "SA cotizada: documento de escisión + posible folleto CNMV.",
  CESION_GLOBAL:
    "SA cotizada: posible hecho relevante a CNMV si afecta a porción significativa del patrimonio social.",
  AUTORIZACION_OPERACION_ESTRUCTURAL:
    "SA cotizada: revisar especialidades LMV (informe a CNMV, autorización de la JGA si supera umbrales).",
};

// Materias que NO se envían al motor V2 (puntos libres sin regla).
const MATERIAS_LIBRES = new Set<string>(["OTROS_LIBRE"]);

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
  EMAIL_SIMPLE: "Email simple",
};

function newAgendaItem(): AgendaItem {
  return {
    id: crypto.randomUUID(),
    titulo: "",
    materia: "APROBACION_CUENTAS",
    tipo: "ORDINARIA",
    inscribible: false,
    // agenda_item.kind v1.3: default DELIBERATIVO (coincide con BD default).
    kind: "DELIBERATIVO",
    decision_subtype: null,
    propuesta_acuerdo: null,
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
  const bodiesPending = Boolean(selectedEntityId && (entitiesLoading || bodiesLoading || bodiesFetching));
  const jurisdiction = selectedEntity?.jurisdiction ?? "ES";
  const tipoSocial = toTipoSocial(selectedEntity?.tipo_social ?? selectedEntity?.legal_form);
  const organoTipo = resolveOrganoTipo(selectedBody);
  const { data: readiness } = useEntityDemoReadiness(selectedEntityId);
  const readinessBlocked = readiness?.status === "reference_only";

  // ── Step 3 ──
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([newAgendaItem()]);
  const agendaRuleSpecs = agendaItems
    // agenda_item.kind v1.3: solo DECISORIO produce acuerdo y exige reglas LSC.
    // INFORMATIVO / DELIBERATIVO no se someten a votación → no aplica motor V2.
    .filter((item) => (item.kind ?? "DELIBERATIVO") === "DECISORIO")
    // BATCH 8.3 (ronda 2 U-A): filtrar materias libres antes del motor.
    // OTROS_LIBRE indica intencionalmente que el secretario asume el punto
    // como informativo / sin reglas LSC aplicables — no es bug, es diseño.
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
    // agenda_item.kind v1.3: motor V2 solo recibe materias DECISORIO.
    materias: agendaItems
      .filter((i) => (i.kind ?? "DELIBERATIVO") === "DECISORIO")
      .map((i) => i.materia),
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
  // BATCH 8.4 (ronda 2 U-B): los destinatarios ahora se ordenan con
  // PRESIDENTE primero, SECRETARIO segundo, después órdenes de prioridad
  // estándar y resto alfabético. Antes aparecían en orden de inserción
  // (alfabético por tipo_condicion) lo cual ponía CONSEJERO antes que
  // PRESIDENTE — inverso al uso operativo.
  const ROLE_PRIORITY: Record<string, number> = {
    PRESIDENTE: 1,
    SECRETARIO: 2,
    VICEPRESIDENTE: 3,
    CONSEJERO_COORDINADOR: 4,
    CONSEJERO: 5,
  };
  const activeMandates = mandates
    .filter((m) => m.status === "Activo")
    .sort((a, b) => {
      const pa = ROLE_PRIORITY[a.role ?? ""] ?? 99;
      const pb = ROLE_PRIORITY[b.role ?? ""] ?? 99;
      if (pa !== pb) return pa - pb;
      // Mismo rol: orden alfabético por nombre
      return (a.full_name ?? "").localeCompare(b.full_name ?? "", "es");
    });
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
  // → solo notificación directa (email/correo certificado/ERDS/burofax).
  // Sin este filtro, el secretario ve toda la lista cuando convoca CdA y
  // genera ruido innecesario.
  const channelOptsBase = CHANNEL_OPTIONS[jurisdiction] ?? CHANNEL_OPTIONS["ES"];
  const bodyTypeForChannels = selectedBody?.body_type?.toUpperCase() ?? "JUNTA";
  const relevantChannelSet = CHANNELS_RELEVANT_BY_BODY_TYPE[bodyTypeForChannels];
  const channelOpts =
    relevantChannelSet && relevantChannelSet.size > 0
      ? channelOptsBase.filter((ch) => relevantChannelSet.has(ch.value))
      : channelOptsBase;
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
            // agenda_item.kind v1.3: si llega una plantilla MODELO_ACUERDO,
            // el punto se trata como DECISORIO (se va a votar). Las plantillas
            // de convocatoria sin materia conservan el kind por defecto.
            kind: "DECISORIO",
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
  // ── Step 7: Borrador documento ────────────────────────────────────────────
  // Carga plantillas tipo CONVOCATORIA, selecciona la mejor candidata por
  // organoTipo + jurisdiction, expone capa3 editable y un textarea con el
  // borrador renderizado (capa1 con variables sustituidas). El secretario
  // puede editar el texto antes de emitir; se persiste en
  // `convocatorias.convocatoria_text`.
  const { data: plantillasProtegidas = [] } = usePlantillasProtegidas();
  const convocatoriaTemplateTypes = useMemo(
    () =>
      tipoSocial === "SL" || tipoSocial === "SLU"
        ? ["CONVOCATORIA_SL_NOTIFICACION", "CONVOCATORIA"]
        : ["CONVOCATORIA", "CONVOCATORIA_SL_NOTIFICACION"],
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

  const borradorCapa3Fields = useMemo(
    () =>
      (effectiveBorradorTemplate?.capa3_editables ?? []).map((f) => ({
        campo: f.campo,
        obligatoriedad: f.obligatoriedad ?? "OPCIONAL",
        descripcion: f.descripcion ?? "",
      })),
    [effectiveBorradorTemplate],
  );
  const [borradorCapa3Values, setBorradorCapa3Values] = useState<Record<string, string>>({});

  // Reset capa3 cuando cambia la plantilla efectiva
  useEffect(() => {
    setBorradorCapa3Values({});
  }, [effectiveBorradorTemplate?.id]);

  const borradorVariables = useMemo<Record<string, unknown>>(() => {
    const memberNames = activeMandates
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

    return {
      denominacion_social: selectedEntity?.legal_name ?? selectedEntity?.common_name ?? "",
      // Codex P2 PR #3: `registration_number` es el código del Registro
      // Mercantil (en SA: CIF). NO es domicilio. Mi fix anterior mezclaba
      // ambos campos rellenando `domicilio_social` con `legal_name` —
      // semánticamente incorrecto. Ahora:
      //   - `cif` = registration_number (alias canonical de plantilla)
      //   - `domicilio_social` queda vacío hasta que se modele como
      //     columna canonical en `entities` (no hay fuente real hoy).
      //     El renderTemplate marca `domicilio_social` en
      //     unresolvedVariables y el usuario lo ve en el callout amarillo.
      cif: selectedEntity?.registration_number ?? "",
      domicilio_social: "",
      // Codex P2 PR #3 round 6: la plantilla CONVOCATORIA (migration
      // 20260419_000008_ajustes_revision_legal) usa `{{#if forma_social == 'SA'}}`
      // mientras nosotros exponíamos solo `tipo_social`. Sin el alias
      // canonical, SA caía al rama else y el texto emitía "socios" en
      // vez de "accionistas" + párrafo de derecho-de-información SL.
      tipo_social: tipoSocial,
      forma_social: tipoSocial,
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

      // Fecha / hora primera convocatoria. Codex P2 round 10 PR #3:
      // la plantilla CONVOCATORIA usa `{{fecha_primera_convocatoria}}` y
      // `{{hora_primera_convocatoria}}` (aliases canonical largos),
      // mientras nosotros exponíamos solo `fecha_junta` / `hora_junta`.
      // Sin aliases largos, el render del Paso 7 dejaba en blanco la
      // hora de primera convocatoria aunque el usuario la hubiera
      // rellenado en Paso 2.
      fecha_junta: fechaReunion,
      hora_junta: horaReunion,
      fecha_primera_convocatoria: fechaReunion,
      hora_primera_convocatoria: horaReunion,
      fecha_emision: new Date().toISOString().slice(0, 10),

      formato_reunion: formatoReunion,

      // Segunda convocatoria — boolean + aliases canonical + cortos.
      segunda_convocatoria: habilitarSegunda,
      fecha_segunda: habilitarSegunda ? fechaReunion2 : "",
      hora_segunda: habilitarSegunda ? horaReunion2 : "",
      fecha_segunda_convocatoria: habilitarSegunda ? fechaReunion2 : "",
      hora_segunda_convocatoria: habilitarSegunda ? horaReunion2 : "",

      antelacion_dias_requerida: evaluacionV2.antelacionDiasRequerida,
      fecha_limite_publicacion: evaluacionV2.fechaLimitePublicacion,
      canales: channels.map((c) => channelLabel(c, channelOpts)).join(", "),
      // Codex P1 PR #3: las plantillas reales (verificado en migration
      // 20260419_000009) hacen `{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}{{/each}}`.
      // Con un string newline-delimited, Handlebars itera caracter por caracter
      // y produce bloque vacío. Pasamos array de objetos con el shape
      // exacto que el template espera (contrato variables-plantillas v1.1).
      orden_dia: agendaItems
        .filter((i) => i.titulo.trim())
        .map((i, idx) => ({
          ordinal: idx + 1,
          descripcion_punto: i.titulo,
          kind: i.kind ?? "DELIBERATIVO",
          materia: i.kind === "DECISORIO" ? i.materia : null,
          materia_label: i.kind === "DECISORIO" ? labelMateria(i.materia) : null,
          tipo: i.tipo,
          inscribible: i.inscribible,
          propuesta_acuerdo: i.kind === "DECISORIO" ? (i.propuesta_acuerdo ?? null) : null,
        })),
      // Plain-text fallback para plantillas legacy que esperaban string
      // newline-delimited (compatibilidad backwards).
      orden_dia_texto: agendaItems
        .filter((i) => i.titulo.trim())
        .map((i, idx) => `${idx + 1}. ${i.titulo}${i.kind === "DECISORIO" ? ` (Acuerdo · ${labelMateria(i.materia)})` : ""}`)
        .join("\n"),
      destinatarios: memberNames.join(", "),
      // Misma protección para `destinatarios`: si la plantilla espera
      // `{{#each destinatarios_lista}}{{nombre}}{{/each}}`, le damos array;
      // si espera string concatenado, usa `destinatarios`.
      destinatarios_lista: activeMandates
        .filter((m) => !excludedPersonIds.has(m.person_id) && m.full_name)
        .map((m) => ({
          nombre: m.full_name,
          email: m.email ?? null,
          rol: m.role ?? null,
        })),
    };
  }, [
    activeMandates, excludedPersonIds, selectedEntity, tipoSocial, selectedBody, organoTipo,
    jurisdiction, tipoConvocatoria, fechaReunion, horaReunion, lugar, formatoReunion,
    habilitarSegunda, fechaReunion2, horaReunion2, evaluacionV2.antelacionDiasRequerida,
    evaluacionV2.fechaLimitePublicacion, channels, channelOpts, agendaItems,
  ]);

  const [borradorTexto, setBorradorTexto] = useState<string>("");
  const [borradorDirty, setBorradorDirty] = useState(false);
  const [renderUnresolved, setRenderUnresolved] = useState<string[]>([]);

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
      .map((i) => `${i.titulo}|${i.materia}|${i.tipo}|${i.kind ?? ""}|${i.propuesta_acuerdo ?? ""}`)
      .join("");
    const capa3Signature = Object.entries(borradorCapa3Values)
      .map(([k, v]) => `${k}=${v}`)
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
      borradorLastRenderHashRef.current = borradorContextHash;
      return;
    }
    // Cada llamada incrementa el token; sólo el último vuelve a setState.
    const token = ++regenerateTokenRef.current;
    void import("@/lib/doc-gen/template-renderer").then(({ renderTemplate }) => {
      // Cancelado si: componente desmontado o llegó una regeneración nueva
      // (la `onChange` del textarea también incrementa el token — Codex
      // P2 round 10 PR #3). El check de token cubre el caso edit-during-
      // import, este guard es defensa en profundidad para imports muy
      // lentos donde el render rezagado de otra plantilla no debe pisar
      // un texto que el usuario ya empezó a editar.
      if (!isMountedRef.current || token !== regenerateTokenRef.current) return;
      const merged = { ...borradorVariables, ...borradorCapa3Values };
      const result = renderTemplate({
        template: effectiveBorradorTemplate.capa1_inmutable!,
        variables: merged,
      });
      setBorradorTexto(result.text);
      setRenderUnresolved(result.unresolvedVariables);
      setBorradorDirty(false);
      // Tras render limpio el hash queda alineado con el contexto actual.
      borradorLastRenderHashRef.current = borradorContextHash;
    });
  }, [effectiveBorradorTemplate, borradorVariables, borradorCapa3Values, borradorContextHash]);

  // Auto-regenerar cuando cambian plantilla / variables / capa3 — solo si:
  //   1. usuario está actualmente en Paso 7 (evita imports dinámicos y
  //      setStates durante Paso 1-6 que cambian fecha/orden/etc.); cuando
  //      el usuario llega al Paso 7 el effect dispara una sola vez.
  //   2. no está "dirty" (no sobreescribir edits manuales del usuario).
  useEffect(() => {
    if (current === 7 && !borradorDirty) {
      regenerateBorrador();
    }
  }, [current, regenerateBorrador, borradorDirty]);

  // Codex P2 round 8 PR #3: detectar stale draft. Si el usuario editó el
  // textarea (dirty) y luego cambió el contexto upstream (entidad / órgano
  // / agenda / etc.), `borradorTexto` ya no refleja la metadata persistida.
  // No descartamos el texto del usuario (puede ser intencional) — el flag
  // alimenta un callout visual + bloquea emisión hasta resolución
  // explícita.
  const borradorIsStale = borradorDirty && borradorLastRenderHashRef.current !== "" &&
    borradorLastRenderHashRef.current !== borradorContextHash;

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
  // Cada adjunto mantiene el File en memoria; el upload a Storage + INSERT
  // en `attachments` se ejecuta tras crear la convocatoria (handleEmitir).
  // Si el usuario abandona antes de emitir no quedan huérfanos en Storage.
  const [adjuntos, setAdjuntos] = useState<{
    id: string;
    file: File;
    alias: string;
    descripcion: string;
    error?: string;
  }[]>([]);
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
          // Codex P2 round 8 PR #3: marcamos los adjuntos como `intended`
          // en el trace inicial (antes de los uploads). Tras los uploads,
          // `handleEmitir` hace UPDATE de `reminders_trace` con el status
          // real de cada archivo (`uploaded` / `failed` + error_message).
          // Sin este patch, el trace mentía afirmando upload exitoso de
          // archivos que en realidad fallaron en Storage o INSERT.
          uploaded_references: adjuntos.map((adjunto) => ({
            id: adjunto.id,
            nombre: adjunto.alias || adjunto.file.name,
            descripcion: adjunto.descripcion,
            file_name: adjunto.file.name,
            size_bytes: adjunto.file.size,
            mime: adjunto.file.type || null,
            upload_status: "intended" as const,
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
          .map(({ titulo, materia, tipo, inscribible, kind, decision_subtype, propuesta_acuerdo }) => {
            const effectiveKind: AgendaItemKind = kind ?? "DELIBERATIVO";
            return {
              titulo,
              materia,
              tipo,
              inscribible,
              // agenda_item.kind v1.3: persistir naturaleza del punto.
              // Solo DECISORIO admite decision_subtype; INFO / DELIB → null.
              kind: effectiveKind,
              decision_subtype:
                effectiveKind === "DECISORIO" ? (decision_subtype ?? null) : null,
              // BATCH 3: persistir propuesta concreta del acuerdo en JSONB.
              // Backward-compat: convocatorias antiguas leen null.
              // Para INFO / DELIB no hay propuesta de acuerdo posible.
              propuesta_acuerdo:
                effectiveKind === "DECISORIO" ? (propuesta_acuerdo ?? null) : null,
            };
          }),
        statutory_basis: activeRuleSet?.legal_reference ?? null,
        convocatoria_text: borradorTexto.trim() ? borradorTexto : null,
        ...buildConvocatoriaTrace(),
      });

      // Upload de adjuntos paralelo con Promise.allSettled — la convocatoria
      // ya está creada en DB (rollback no es viable sin DELETE), así que
      // ejecutamos uploads en paralelo y reportamos fallos parciales. El
      // usuario podrá reintentar adjuntos fallidos desde el detalle.
      // Indicador "Subiendo X de N" gracias a un counter que se incrementa
      // cuando cada promesa termina (no estrictamente ordenado pero útil).
      let okCount = 0;
      let failCount = 0;
      const failMessages: string[] = [];
      // Por adjunto: registra el outcome (ok | failed + msg) — usado luego
      // para parchear `reminders_trace.documents.uploaded_references` con
      // el status real (Codex P2 round 8 PR #3).
      const outcomesById = new Map<string, { ok: true } | { ok: false; msg: string }>();
      if (adjuntos.length > 0) {
        setUploadStatus({ ok: 0, failed: 0, messages: [], inFlight: adjuntos.length });
        type UploadOutcome =
          | { adjunto: typeof adjuntos[number]; ok: true }
          | { adjunto: typeof adjuntos[number]; ok: false; msg: string };
        const results = await Promise.allSettled(
          adjuntos.map<Promise<UploadOutcome>>((adjunto) =>
            uploadAttachment
              .mutateAsync({ convocatoriaId: created.id, file: adjunto.file })
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
            outcomesById.set(outcome.adjunto.id, { ok: true });
            continue;
          }
          // outcome.ok === false aquí → TS estrecha a la variante con msg.
          failCount += 1;
          const failedAdjunto = outcome.adjunto;
          const failedMsg = outcome.msg;
          failMessages.push(`${failedAdjunto.file.name}: ${failedMsg}`);
          outcomesById.set(failedAdjunto.id, { ok: false, msg: failedMsg });
          setAdjuntos((prev) =>
            prev.map((a) => (a.id === failedAdjunto.id ? { ...a, error: failedMsg } : a)),
          );
        }
        setUploadStatus({ ok: okCount, failed: failCount, messages: failMessages, inFlight: 0 });

        // PATCH reminders_trace para reflejar status real de cada adjunto.
        // Sin esto, el trace original decía `upload_status: 'intended'`
        // para todos, escondiendo los fallos del audit.
        const existingTrace = (created.reminders_trace ?? {}) as Record<string, unknown>;
        const existingDocuments = (existingTrace.documents ?? {}) as Record<string, unknown>;
        const existingUploaded = (existingDocuments.uploaded_references ?? []) as Array<Record<string, unknown>>;
        const patchedUploaded = existingUploaded.map((entry) => {
          const id = typeof entry.id === "string" ? entry.id : null;
          const outcome = id ? outcomesById.get(id) : undefined;
          if (!outcome) {
            return { ...entry, upload_status: "unknown" };
          }
          if (outcome.ok === true) {
            return { ...entry, upload_status: "uploaded", upload_error: null };
          }
          // outcome.ok === false aquí — extraemos msg de forma narrowing-
          // friendly para evitar problemas de control-flow en map callbacks.
          const failureMsg = outcome.msg;
          return { ...entry, upload_status: "failed", upload_error: failureMsg };
        });
        const patchedTrace = {
          ...existingTrace,
          documents: {
            ...existingDocuments,
            uploaded_references: patchedUploaded,
            uploaded_summary: { ok: okCount, failed: failCount },
          },
        };
        const { error: patchError } = await supabase
          .from("convocatorias")
          .update({ reminders_trace: patchedTrace } as never)
          .eq("id", created.id);
        if (patchError) {
          // No bloqueamos la emisión — solo log para que un futuro audit
          // detecte que el patch del trace falló y el shape original
          // permanece (con `upload_status: 'intended'`).
          // eslint-disable-next-line no-console
          console.warn("[convocatorias] reminders_trace patch skipped", {
            convocatoriaId: created.id,
            message: patchError.message,
          });
        }
      }

      setEmitidoId(created.id);
      if (failCount === 0) {
        toast.success(
          adjuntos.length > 0
            ? `Convocatoria emitida con ${okCount} adjunto(s)`
            : "Convocatoria emitida correctamente",
        );
      } else {
        toast.warning(
          `Convocatoria emitida; ${okCount} adjunto(s) subidos, ${failCount} fallaron`,
          { description: failMessages[0] },
        );
      }
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

                  {ruleResolutions.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      <MiniFact label="Rule packs" value={String(ruleResolutions.filter((r) => r.rulePack).length)} />
                      <MiniFact label="Antelación" value={`${evaluacionV2.antelacionDiasRequerida} días`} />
                      <MiniFact label="Overrides" value={String(agendaApplicableOverrides.length)} />
                      <MiniFact
                        label="Doble eval."
                        value={noticeDoubleEvaluation.converged ? "Convergente" : "Divergente"}
                      />
                    </div>
                  ) : (
                    /* B1 — sin items DECISORIO en el orden del día, el
                       motor V2 corre con 0 rule packs y cae a defaults por
                       organoTipo (LSC art. 176 para juntas, art. 246.2 +
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
                  const kindHelper =
                    KIND_OPTIONS.find((k) => k.value === itemKind)?.helper ?? "";
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

                    {/* agenda_item.kind v1.3: selector de naturaleza del punto.
                        Determina si exige materia / mayoría / propuesta de
                        acuerdo (DECISORIO) o solo es informe / debate
                        (INFORMATIVO / DELIBERATIVO). */}
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
                                // Al cambiar a INFORMATIVO / DELIBERATIVO,
                                // limpiar decision_subtype (solo aplica a DECISORIO).
                                const patch: Partial<AgendaItem> = { kind: opt.value };
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
                        puntos DECISORIO. Para INFO / DELIB no hay acuerdo. */}
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
                              });
                            }}
                            aria-label="Materia del acuerdo"
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
                    No hay adjuntos añadidos. Los archivos se subirán al emitir la convocatoria
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
                Añadir adjuntos (PDF / DOCX / XLSX / PPT / CSV / TXT / PNG / JPG, ≤25 MB)
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain,image/png,image/jpeg"
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
                persistido en <code>convocatoria_text</code> al emitir.
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
                            convocatoria emitida queda como evidencia{" "}
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
                    onChange={setBorradorCapa3Values}
                    telematicaEnabled={formatoReunion !== "PRESENCIAL"}
                  />
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
                    regenerateTokenRef.current += 1;
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
                    cambió tras el último render limpio. Bloquea la emisión
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
                        // Confirmación explícita: el usuario asume el texto
                        // como válido y lo desbloquea — actualizamos el hash
                        // de referencia al contexto actual.
                        borradorLastRenderHashRef.current = borradorContextHash;
                        // Forzamos re-render quitando el estado stale.
                        // (borradorDirty se mantiene true como evidencia.)
                        setBorradorTexto((prev) => prev);
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

          {/* ── PASO 8: Revisión y emisión ── */}
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
                type="button"
                disabled={createConvocatoria.isPending || uploadStatus.inFlight > 0 || borradorIsStale}
                onClick={handleEmitir}
                aria-busy={createConvocatoria.isPending || uploadStatus.inFlight > 0}
                title={borradorIsStale ? "El borrador del Paso 7 está desactualizado por cambio de contexto. Regenerar o confirmar antes de emitir." : undefined}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Send className="h-4 w-4" />
                {borradorIsStale
                  ? "Borrador stale — resolver Paso 7"
                  : uploadStatus.inFlight > 0
                  ? `Subiendo ${uploadStatus.inFlight} adjunto(s)…`
                  : createConvocatoria.isPending
                  ? "Emitiendo…"
                  : "Emitir convocatoria"}
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
