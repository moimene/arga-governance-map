import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  ExternalLink,
  FileText,
  GitBranch,
  ListChecks,
  Play,
  Repeat2,
  Route,
  Scale,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { formatJurisdiction } from "@/hooks/useEntities";
import {
  useGroupCampaignWarRoom,
  useLaunchGroupCampaign,
  type GroupCampaignLiveRecord,
  type GroupCampaignWarRoomCampaign,
  type GroupCampaignWarRoomExpediente,
  type GroupCampaignWarRoomStep,
  type LaunchGroupCampaignInput,
} from "@/hooks/useGroupCampaigns";
import { useSociedades, type SociedadRow } from "@/hooks/useSociedades";
import { statusLabel } from "@/lib/secretaria/status-labels";

type CampaignType =
  | "CUENTAS_ANUALES"
  | "RENOVACION_CARGOS"
  | "PRESUPUESTO"
  | "GARANTIAS_INTRAGRUPO"
  | "DIVIDENDOS"
  | "MOD_ESTATUTOS"
  | "AUDITOR"
  | "FUSION"
  | "COMPLIANCE_ANUAL"
  | "SUCURSALES";

type CampaignOrgan = "ADMIN" | "JUNTA" | "POST" | "COMPLIANCE";

type AdoptionMode =
  | "MEETING"
  | "NO_SESSION"
  | "UNIPERSONAL_ADMIN"
  | "UNIPERSONAL_SOCIO"
  | "CO_APROBACION"
  | "SOLIDARIO"
  | "POST_TASK";

type CampaignStatus = "PENDIENTE" | "EN_CURSO" | "COMPLETADO" | "BLOQUEADO";

interface CampaignAgreement {
  code: string;
  label: string;
  organ: CampaignOrgan;
  dependency: string | null;
  deadlineDays: number;
}

interface CampaignTemplate {
  type: CampaignType;
  name: string;
  summary: string;
  legalAnchor: string;
  cadence: string;
  agreements: CampaignAgreement[];
}

interface CampaignParams {
  type: CampaignType;
  ejercicio: string;
  fechaCierre: string;
  fechaLanzamiento: string;
  selectedJurisdictions: string[];
  includeCotizada: boolean;
  preferNoSession: boolean;
}

interface CampaignExpediente {
  id: string;
  sociedadId: string;
  sociedad: string;
  jurisdiction: string;
  formaSocial: string;
  formaAdministracion: string;
  faseActual: string;
  estado: CampaignStatus;
  adoptionMode: AdoptionMode;
  rulePack: string;
  deadline: string;
  responsable: string;
  alertas: string[];
  explain: string[];
}

const DEFAULT_JURISDICTIONS = ["ES", "PT", "BR", "MX"];

const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    type: "CUENTAS_ANUALES",
    name: "Ciclo anual de cuentas",
    summary: "Formulación, convocatoria, aprobación y depósito coordinado para todas las sociedades del grupo.",
    legalAnchor: "art. 253 LSC, art. 42 C.Comercio y reglas locales equivalentes",
    cadence: "Anual",
    agreements: [
      { code: "FORMULACION_CUENTAS", label: "A. Formulación de cuentas", organ: "ADMIN", dependency: null, deadlineDays: 90 },
      { code: "CONVOCATORIA_JGA", label: "B. Convocatoria de JGA", organ: "ADMIN", dependency: "FORMULACION_CUENTAS", deadlineDays: 120 },
      { code: "APROBACION_CUENTAS", label: "C. Aprobación cuentas y resultado", organ: "JUNTA", dependency: "CONVOCATORIA_JGA", deadlineDays: 180 },
      { code: "DEPOSITO_CUENTAS", label: "D. Depósito Registro Mercantil", organ: "POST", dependency: "APROBACION_CUENTAS", deadlineDays: 210 },
    ],
  },
  {
    type: "RENOVACION_CARGOS",
    name: "Renovación de cargos",
    summary: "Cese por expiración, nombramiento, aceptación, inscripción y cargos internos del consejo.",
    legalAnchor: "LSC, RRM y estatutos sociales",
    cadence: "Por vencimiento",
    agreements: [
      { code: "CESE_CARGO", label: "Cese por expiración", organ: "JUNTA", dependency: null, deadlineDays: 15 },
      { code: "NOMBRAMIENTO_CARGO", label: "Nombramiento o reelección", organ: "JUNTA", dependency: "CESE_CARGO", deadlineDays: 30 },
      { code: "CONSTITUCION_CONSEJO", label: "Constitución de cargos del consejo", organ: "ADMIN", dependency: "NOMBRAMIENTO_CARGO", deadlineDays: 45 },
      { code: "PODERES", label: "Renovación de poderes", organ: "POST", dependency: "CONSTITUCION_CONSEJO", deadlineDays: 60 },
    ],
  },
  {
    type: "PRESUPUESTO",
    name: "Presupuesto anual / plan de negocio",
    summary: "Aprobación coordinada del presupuesto y verificación de pactos de control presupuestario.",
    legalAnchor: "Estatutos, pactos P6 y normativa interna de grupo",
    cadence: "Anual",
    agreements: [
      { code: "APROBACION_PRESUPUESTO", label: "Aprobación presupuesto", organ: "ADMIN", dependency: null, deadlineDays: 45 },
      { code: "PACTOS_CONTROL", label: "Verificación de pactos", organ: "COMPLIANCE", dependency: "APROBACION_PRESUPUESTO", deadlineDays: 50 },
    ],
  },
  {
    type: "GARANTIAS_INTRAGRUPO",
    name: "Garantías intragrupo",
    summary: "Determina órgano competente por umbral de materialidad y genera autorizaciones por sociedad garante.",
    legalAnchor: "art. 160.f LSC, operaciones vinculadas y estatutos",
    cadence: "Por operación",
    agreements: [
      { code: "AUTORIZACION_GARANTIA", label: "Autorización de garantía", organ: "ADMIN", dependency: null, deadlineDays: 20 },
      { code: "OPERACION_VINCULADA", label: "Control operación vinculada", organ: "COMPLIANCE", dependency: "AUTORIZACION_GARANTIA", deadlineDays: 25 },
    ],
  },
  {
    type: "DIVIDENDOS",
    name: "Dividendo a cuenta / distribución",
    summary: "Flujo ascendente: filiales aprueban reparto, pagan a matriz y la matriz decide su distribución.",
    legalAnchor: "arts. 273, 277 y 326 LSC; reglas de liquidez",
    cadence: "Por cierre o reparto",
    agreements: [
      { code: "DIVIDENDO_FILIAL", label: "Dividendo a cuenta filial", organ: "ADMIN", dependency: null, deadlineDays: 30 },
      { code: "PAGO_MATRIZ", label: "Pago a matriz", organ: "POST", dependency: "DIVIDENDO_FILIAL", deadlineDays: 45 },
      { code: "APLICACION_RESULTADO", label: "Aplicación resultado matriz", organ: "JUNTA", dependency: "PAGO_MATRIZ", deadlineDays: 75 },
    ],
  },
  {
    type: "MOD_ESTATUTOS",
    name: "Modificación de estatutos coordinada",
    summary: "Homogeneiza estatutos, detecta competencia del órgano y prepara escritura e inscripción.",
    legalAnchor: "arts. 285, 286 y 287 LSC; estatutos",
    cadence: "Por proyecto",
    agreements: [
      { code: "MODIFICACION_ESTATUTOS", label: "Aprobación modificación", organ: "JUNTA", dependency: null, deadlineDays: 45 },
      { code: "ESCRITURA_INSCRIPCION", label: "Escritura e inscripción", organ: "POST", dependency: "MODIFICACION_ESTATUTOS", deadlineDays: 75 },
    ],
  },
  {
    type: "AUDITOR",
    name: "Nombramiento / renovación auditor",
    summary: "Coordina nombramiento obligatorio o voluntario y registro ROAC por sociedad.",
    legalAnchor: "arts. 263 y 264 LSC; RRM",
    cadence: "3-9 años",
    agreements: [
      { code: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento auditor", organ: "JUNTA", dependency: null, deadlineDays: 120 },
      { code: "INSCRIPCION_AUDITOR", label: "Inscripción RM", organ: "POST", dependency: "NOMBRAMIENTO_AUDITOR", deadlineDays: 150 },
    ],
  },
  {
    type: "FUSION",
    name: "Operación estructural de grupo",
    summary: "Coordina proyecto, convocatorias, juntas, publicación, escritura e inscripción cruzada.",
    legalAnchor: "LME, LSC y plazos de oposición de acreedores",
    cadence: "Por operación",
    agreements: [
      { code: "PROYECTO_FUSION", label: "Proyecto común de fusión", organ: "ADMIN", dependency: null, deadlineDays: 30 },
      { code: "CONVOCATORIA_FUSION", label: "Convocatoria JGA", organ: "ADMIN", dependency: "PROYECTO_FUSION", deadlineDays: 60 },
      { code: "APROBACION_FUSION", label: "Aprobación JGA", organ: "JUNTA", dependency: "CONVOCATORIA_FUSION", deadlineDays: 90 },
      { code: "OPOSICION_INSCRIPCION", label: "Oposición, escritura e inscripción", organ: "POST", dependency: "APROBACION_FUSION", deadlineDays: 135 },
    ],
  },
  {
    type: "COMPLIANCE_ANUAL",
    name: "Compliance anual societario",
    summary: "Dispensas, conflictos, vinculadas y pactos activos revisados de forma coordinada.",
    legalAnchor: "arts. 229-230 LSC, pactos parasociales y política interna",
    cadence: "Anual",
    agreements: [
      { code: "DECLARACION_CONFLICTOS", label: "Declaración de conflictos", organ: "COMPLIANCE", dependency: null, deadlineDays: 30 },
      { code: "DISPENSAS_VINCULADAS", label: "Dispensas y vinculadas", organ: "ADMIN", dependency: "DECLARACION_CONFLICTOS", deadlineDays: 60 },
      { code: "PACTOS", label: "Evaluación de pactos", organ: "COMPLIANCE", dependency: "DISPENSAS_VINCULADAS", deadlineDays: 75 },
    ],
  },
  {
    type: "SUCURSALES",
    name: "Cierre y apertura de sucursales",
    summary: "Lanza decisiones de apertura o cierre y tareas de inscripción por territorio.",
    legalAnchor: "RRM, estatutos y normativa local",
    cadence: "Por reestructuración",
    agreements: [
      { code: "APERTURA_CIERRE_SUCURSAL", label: "Acuerdo apertura/cierre", organ: "ADMIN", dependency: null, deadlineDays: 30 },
      { code: "INSCRIPCION_SUCURSAL", label: "Inscripción sucursal", organ: "POST", dependency: "APERTURA_CIERRE_SUCURSAL", deadlineDays: 60 },
    ],
  },
];

function makeDefaultParams(): CampaignParams {
  const ejercicio = String(new Date().getFullYear() - 1);
  return {
    type: "CUENTAS_ANUALES",
    ejercicio,
    fechaCierre: `${ejercicio}-12-31`,
    fechaLanzamiento: new Date().toISOString().slice(0, 10),
    selectedJurisdictions: DEFAULT_JURISDICTIONS,
    includeCotizada: true,
    preferNoSession: false,
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeAdminForm(sociedad: SociedadRow) {
  const value = `${sociedad.tipo_organo_admin ?? ""} ${sociedad.forma_administracion ?? ""}`.toUpperCase();
  if (value.includes("MANCOMUN")) return "ADM_MANCOMUNADOS";
  if (value.includes("SOLIDAR")) return "ADM_SOLIDARIOS";
  if (value.includes("UNICO") || value.includes("ÚNICO")) return "ADMINISTRADOR_UNICO";
  if (value.includes("CONSEJO")) return "CONSEJO";
  return sociedad.es_unipersonal ? "ADMINISTRADOR_UNICO" : "CONSEJO";
}

function determineAdoptionMode(sociedad: SociedadRow, organ: CampaignOrgan, preferNoSession: boolean): AdoptionMode {
  if (organ === "POST" || organ === "COMPLIANCE") return "POST_TASK";
  if (organ === "JUNTA" && sociedad.es_unipersonal) return "UNIPERSONAL_SOCIO";

  const adminForm = normalizeAdminForm(sociedad);
  if (adminForm === "ADMINISTRADOR_UNICO") return "UNIPERSONAL_ADMIN";
  if (adminForm === "ADM_MANCOMUNADOS") return "CO_APROBACION";
  if (adminForm === "ADM_SOLIDARIOS") return "SOLIDARIO";
  return preferNoSession ? "NO_SESSION" : "MEETING";
}

function statusFor(index: number, template: CampaignTemplate): CampaignStatus {
  if (template.type !== "CUENTAS_ANUALES") {
    return index % 5 === 0 ? "PENDIENTE" : index % 4 === 0 ? "BLOQUEADO" : "EN_CURSO";
  }
  const sequence: CampaignStatus[] = ["COMPLETADO", "EN_CURSO", "PENDIENTE", "BLOQUEADO", "COMPLETADO"];
  return sequence[index % sequence.length];
}

function phaseFor(status: CampaignStatus, template: CampaignTemplate, index: number) {
  if (status === "COMPLETADO") return template.agreements[template.agreements.length - 1];
  if (status === "BLOQUEADO") return template.agreements[Math.min(1, template.agreements.length - 1)];
  return template.agreements[Math.min(index % template.agreements.length, template.agreements.length - 1)];
}

function makeRulePack(sociedad: SociedadRow, phase: CampaignAgreement) {
  const jurisdiction = sociedad.jurisdiction ?? "ES";
  const social = sociedad.tipo_social ?? sociedad.legal_form ?? "SOCIEDAD";
  return `${jurisdiction}-${social}-${phase.code}`;
}

function explainFor(sociedad: SociedadRow, phase: CampaignAgreement, mode: AdoptionMode) {
  const adminForm = normalizeAdminForm(sociedad);
  const items = [
    `forma_social=${sociedad.tipo_social ?? sociedad.legal_form ?? "N/D"}`,
    `forma_administracion=${adminForm}`,
    `organo=${phase.organ}`,
    `adoption_mode=${mode}`,
  ];
  if (sociedad.es_unipersonal) items.push("unipersonal=true");
  if (sociedad.es_cotizada) items.push("cotizada=true");
  return items;
}

function explainRecordFor(sociedad: SociedadRow, phase: CampaignAgreement, mode: AdoptionMode) {
  return {
    forma_social: sociedad.tipo_social ?? sociedad.legal_form ?? "N/D",
    forma_administracion: normalizeAdminForm(sociedad),
    organo: phase.organ,
    adoption_mode: mode,
    unipersonal: Boolean(sociedad.es_unipersonal),
    cotizada: Boolean(sociedad.es_cotizada),
  };
}

function alertsFor(sociedad: SociedadRow, phase: CampaignAgreement, mode: AdoptionMode, status: CampaignStatus) {
  const alerts: string[] = [];
  if (status === "BLOQUEADO") alerts.push(mode === "CO_APROBACION" ? "Co-firmas incompletas" : "Bloqueo documental");
  if (phase.code === "FORMULACION_CUENTAS" && mode === "CO_APROBACION") alerts.push("Gate: k=2 firmas mancomunadas");
  if (phase.code === "CONVOCATORIA_JGA" && sociedad.tipo_social === "SA") alerts.push("Antelación SA: 1 mes calendario");
  if (phase.code === "CONVOCATORIA_JGA" && ["SL", "SLU"].includes(sociedad.tipo_social ?? "")) alerts.push("Canal individual con evidencia ERDS");
  if (phase.organ === "JUNTA" && sociedad.es_unipersonal) alerts.push("Sin convocatoria: decisión de socio único");
  if (sociedad.es_cotizada) alerts.push("Advertencias LMV activas");
  return alerts;
}

function statusForStep(
  expedienteStatus: CampaignStatus,
  agreements: CampaignAgreement[],
  currentPhase: CampaignAgreement,
  stepIndex: number,
) {
  const currentIndex = agreements.findIndex((agreement) => agreement.code === currentPhase.code);
  if (expedienteStatus === "BLOQUEADO" && stepIndex === currentIndex) return "BLOQUEADO";
  if (expedienteStatus === "COMPLETADO") return "COMPLETADO";
  if (stepIndex < currentIndex) return "COMPLETADO";
  if (stepIndex === currentIndex) return expedienteStatus === "PENDIENTE" ? "PENDIENTE" : "EN_CURSO";
  return "PENDIENTE";
}

function buildExpedientes(
  sociedades: SociedadRow[],
  template: CampaignTemplate,
  params: CampaignParams,
): CampaignExpediente[] {
  return sociedades.map((sociedad, index) => {
    const estado = statusFor(index, template);
    const phase = phaseFor(estado, template, index);
    const adoptionMode = determineAdoptionMode(sociedad, phase.organ, params.preferNoSession);
    return {
      id: `${params.type}-${sociedad.id}`,
      sociedadId: sociedad.id,
      sociedad: sociedad.common_name ?? sociedad.legal_name,
      jurisdiction: sociedad.jurisdiction ?? "N/D",
      formaSocial: sociedad.tipo_social ?? sociedad.legal_form ?? "Sociedad",
      formaAdministracion: normalizeAdminForm(sociedad),
      faseActual: phase.label,
      estado,
      adoptionMode,
      rulePack: makeRulePack(sociedad, phase),
      deadline: addDays(params.fechaCierre, phase.deadlineDays),
      responsable: "Secretaría de la sociedad",
      alertas: alertsFor(sociedad, phase, adoptionMode, estado),
      explain: explainFor(sociedad, phase, adoptionMode),
    };
  });
}

function buildLaunchInput(
  params: CampaignParams,
  template: CampaignTemplate,
  sociedades: SociedadRow[],
  expedientes: CampaignExpediente[],
): LaunchGroupCampaignInput {
  const plazoLimite = template.agreements
    .map((agreement) => addDays(params.fechaCierre, agreement.deadlineDays))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    campaignType: params.type,
    name: `${template.name} ${params.ejercicio}`,
    ejercicio: params.ejercicio,
    fechaLanzamiento: params.fechaLanzamiento,
    fechaCierre: params.fechaCierre,
    plazoLimite,
    params: {
      include_cotizada: params.includeCotizada,
      prefer_no_session: params.preferNoSession,
      selected_jurisdictions: params.selectedJurisdictions,
      legal_anchor: template.legalAnchor,
    },
    acuerdosCadena: template.agreements,
    expedientes: expedientes.map((expediente) => {
      const sociedad = sociedades.find((item) => item.id === expediente.sociedadId);
      const currentPhase = template.agreements.find((agreement) => agreement.label === expediente.faseActual) ?? template.agreements[0];
      const steps = template.agreements.map((agreement, index) => {
        const mode = sociedad
          ? determineAdoptionMode(sociedad, agreement.organ, params.preferNoSession)
          : expediente.adoptionMode;
        const status = statusForStep(expediente.estado, template.agreements, currentPhase, index);
        return {
          materia: agreement.code,
          label: agreement.label,
          organ: agreement.organ,
          dependency: agreement.dependency,
          stepOrder: index + 1,
          status,
          adoptionMode: mode,
          rulePackCode: sociedad ? makeRulePack(sociedad, agreement) : expediente.rulePack,
          deadline: addDays(params.fechaCierre, agreement.deadlineDays),
          alertas: sociedad ? alertsFor(sociedad, agreement, mode, status as CampaignStatus) : expediente.alertas,
          explain: sociedad ? explainRecordFor(sociedad, agreement, mode) : { explain: expediente.explain },
        };
      });

      return {
        entityId: expediente.sociedadId,
        societyName: expediente.sociedad,
        jurisdiction: expediente.jurisdiction,
        formaSocial: expediente.formaSocial,
        formaAdministracion: expediente.formaAdministracion,
        status: expediente.estado,
        faseActual: expediente.faseActual,
        adoptionMode: expediente.adoptionMode,
        deadline: expediente.deadline,
        rulePackCode: expediente.rulePack,
        responsable: expediente.responsable,
        alertas: expediente.alertas,
        explain: sociedad ? explainRecordFor(sociedad, currentPhase, expediente.adoptionMode) : { explain: expediente.explain },
        steps,
      };
    }),
  };
}

function uniqueJurisdictions(sociedades: SociedadRow[]) {
  const values = sociedades
    .map((sociedad) => sociedad.jurisdiction)
    .filter((jurisdiction): jurisdiction is string => Boolean(jurisdiction));
  return Array.from(new Set([...DEFAULT_JURISDICTIONS, ...values])).sort();
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<T, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function statusTone(status: CampaignStatus) {
  if (status === "COMPLETADO") return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (status === "BLOQUEADO") return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (status === "EN_CURSO") return "bg-[var(--status-info)] text-[var(--g-text-inverse)]";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
}

function modeTone(mode: AdoptionMode) {
  if (mode === "MEETING" || mode === "NO_SESSION") return "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]";
  if (mode === "CO_APROBACION" || mode === "SOLIDARIO") return "bg-[var(--status-info)] text-[var(--g-text-inverse)]";
  if (mode === "POST_TASK") return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
  return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  LANZADA: "Lanzada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  BLOQUEADA: "Bloqueada",
  CANCELADA: "Cancelada",
};

function displayStatus(status: string | null | undefined) {
  if (!status) return "—";
  return CAMPAIGN_STATUS_LABEL[status] ?? statusLabel(status).replace(/_/g, " ");
}

function recordStatusTone(status: string | null | undefined) {
  const value = normalize(status);
  if (["COMPLET", "ADOPTED", "CERTIFIED", "REGISTERED", "LEGALIZADO", "CONFIRMADA"].some((token) => value.includes(token))) {
    return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  }
  if (["BLOQUE", "ERROR", "RECHAZ", "DENEG", "FAIL", "CANCEL"].some((token) => value.includes(token))) {
    return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  }
  if (["EN_CURSO", "LANZADA", "OPEN", "ABIERTO", "VOTING", "ENVIADA", "PROPOSED"].some((token) => value.includes(token))) {
    return "bg-[var(--status-info)] text-[var(--g-text-inverse)]";
  }
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
}

function formatOptionalDate(date: string | null | undefined) {
  if (!date) return "—";
  const dateOnly = date.slice(0, 10);
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function campaignTemplateName(campaignType: string) {
  return CAMPAIGN_TEMPLATES.find((template) => template.type === campaignType)?.name ?? campaignType.replace(/_/g, " ");
}

function liveTableLabel(table: string | null | undefined) {
  if (table === "agreements") return "Expediente acuerdo";
  if (table === "convocatorias") return "Convocatoria";
  if (table === "no_session_expedientes") return "Acuerdo sin sesión";
  if (table === "unipersonal_decisions") return "Decisión unipersonal";
  if (table === "group_campaign_post_tasks") return "Tarea post";
  return "Registro";
}

function shortRef(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "—";
}

export default function ProcesosGrupo() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data: sociedades = [], isLoading } = useSociedades();
  const launchMutation = useLaunchGroupCampaign();
  const {
    data: launchedCampaigns = [],
    error: warRoomError,
    isLoading: isWarRoomLoading,
  } = useGroupCampaignWarRoom();
  const [params, setParams] = useState<CampaignParams>(() => makeDefaultParams());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const template = CAMPAIGN_TEMPLATES.find((item) => item.type === params.type) ?? CAMPAIGN_TEMPLATES[0];
  const jurisdictions = useMemo(() => uniqueJurisdictions(sociedades), [sociedades]);

  const sociedadesScope = useMemo(
    () =>
      sociedades.filter((sociedad) => {
        if (sociedad.entity_status && !["Active", "Activa"].includes(sociedad.entity_status)) return false;
        if (sociedad.jurisdiction && !params.selectedJurisdictions.includes(sociedad.jurisdiction)) return false;
        if (!params.includeCotizada && sociedad.es_cotizada) return false;
        return true;
      }),
    [params.includeCotizada, params.selectedJurisdictions, sociedades],
  );

  const expedientes = useMemo(
    () => buildExpedientes(sociedadesScope, template, params),
    [params, sociedadesScope, template],
  );
  const selectedCampaign = useMemo(
    () => launchedCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? launchedCampaigns[0] ?? null,
    [launchedCampaigns, selectedCampaignId],
  );
  const warRoomErrorMessage = warRoomError
    ? warRoomError instanceof Error
      ? warRoomError.message
      : String(warRoomError)
    : null;

  const statusCounts = useMemo(() => countBy(expedientes.map((item) => item.estado)), [expedientes]);
  const modeCounts = useMemo(() => countBy(expedientes.map((item) => item.adoptionMode)), [expedientes]);
  const earliestDeadline = expedientes
    .map((item) => item.deadline)
    .sort((a, b) => a.localeCompare(b))[0];

  useEffect(() => {
    if (launchedCampaigns.length === 0) {
      if (selectedCampaignId) setSelectedCampaignId(null);
      return;
    }

    if (!selectedCampaignId || !launchedCampaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(launchedCampaigns[0].id);
    }
  }, [launchedCampaigns, selectedCampaignId]);

  const updateParam = <Key extends keyof CampaignParams>(key: Key, value: CampaignParams[Key]) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  const toggleJurisdiction = (jurisdiction: string) => {
    setParams((current) => {
      const exists = current.selectedJurisdictions.includes(jurisdiction);
      return {
        ...current,
        selectedJurisdictions: exists
          ? current.selectedJurisdictions.filter((item) => item !== jurisdiction)
          : [...current.selectedJurisdictions, jurisdiction],
      };
    });
  };

  const launchCampaign = async () => {
    try {
      const payload = buildLaunchInput(params, template, sociedadesScope, expedientes);
      const result = await launchMutation.mutateAsync(payload);
      setSelectedCampaignId(result.id);
      toast.success("Campaña lanzada", {
        description: `${payload.expedientes.length} expediente(s) generados y vinculados.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("No se pudo lanzar la campaña", { description: message });
    }
  };

  if (scope.mode !== "grupo") {
    return (
      <div className="mx-auto max-w-[960px] p-6">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-[var(--status-warning)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Campañas de grupo</h1>
              <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                Las campañas operan sobre un perímetro multi-sociedad. Cambia a modo Grupo para lanzar y monitorizar expedientes coordinados.
              </p>
              <button
                type="button"
                onClick={() => {
                  scope.setMode("grupo");
                  navigate("/secretaria/procesos-grupo?scope=grupo");
                }}
                className="mt-4 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cambiar a modo Grupo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <GitBranch className="h-3.5 w-3.5" />
            Secretaría · War Room de grupo
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Campañas de grupo
          </h1>
          <p className="mt-1 max-w-4xl text-sm text-[var(--g-text-secondary)]">
            Lanza una instrucción única y descompón automáticamente expedientes por sociedad según tipo social, forma de administración, unipersonalidad y reglas aplicables.
          </p>
        </div>

        <button
          type="button"
          onClick={launchCampaign}
          disabled={expedientes.length === 0 || launchMutation.isPending}
          aria-busy={launchMutation.isPending}
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Play className="h-4 w-4" />
          {launchMutation.isPending ? "Lanzando..." : "Lanzar campaña"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard icon={Building2} label="Sociedades" value={expedientes.length} />
        <MetricCard icon={CheckCircle2} label="Completadas" value={statusCounts.COMPLETADO ?? 0} />
        <MetricCard icon={Repeat2} label="En curso" value={statusCounts.EN_CURSO ?? 0} />
        <MetricCard icon={AlertTriangle} label="Bloqueadas" value={statusCounts.BLOQUEADO ?? 0} tone="warning" />
        <MetricCard icon={CalendarDays} label="Primer plazo" value={earliestDeadline ? formatDate(earliestDeadline) : "—"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
              <Settings2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
              Lanzamiento
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="campaign-type" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                Tipo de campaña
              </label>
              <select
                id="campaign-type"
                value={params.type}
                onChange={(event) => updateParam("type", event.target.value as CampaignType)}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {CAMPAIGN_TEMPLATES.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[var(--g-text-secondary)]">{template.summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="campaign-ejercicio" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                  Ejercicio
                </label>
                <input
                  id="campaign-ejercicio"
                  type="number"
                  min="2020"
                  max="2035"
                  value={params.ejercicio}
                  onChange={(event) => updateParam("ejercicio", event.target.value)}
                  className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label htmlFor="campaign-cierre" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                  Cierre
                </label>
                <input
                  id="campaign-cierre"
                  type="date"
                  value={params.fechaCierre}
                  onChange={(event) => updateParam("fechaCierre", event.target.value)}
                  className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="campaign-launch" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                Fecha de lanzamiento
              </label>
              <input
                id="campaign-launch"
                type="date"
                value={params.fechaLanzamiento}
                onChange={(event) => updateParam("fechaLanzamiento", event.target.value)}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[var(--g-text-primary)]">
                <input
                  type="checkbox"
                  checked={params.includeCotizada}
                  onChange={(event) => updateParam("includeCotizada", event.target.checked)}
                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                />
                Incluir dominante cotizada
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--g-text-primary)]">
                <input
                  type="checkbox"
                  checked={params.preferNoSession}
                  onChange={(event) => updateParam("preferNoSession", event.target.checked)}
                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                />
                Preferir acuerdos sin sesión cuando sea posible
              </label>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                Jurisdicciones
              </div>
              <div className="flex flex-wrap gap-2">
                {jurisdictions.map((jurisdiction) => {
                  const active = params.selectedJurisdictions.includes(jurisdiction);
                  return (
                    <button
                      key={jurisdiction}
                      type="button"
                      onClick={() => toggleJurisdiction(jurisdiction)}
                      className={cn(
                        "border px-3 py-1.5 text-xs font-semibold transition-colors",
                        active
                          ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                          : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]",
                      )}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {formatJurisdiction(jurisdiction)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
                <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
                Cadena de acuerdos
              </div>
              <span className="text-xs text-[var(--g-text-secondary)]">{template.legalAnchor}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-4">
              {template.agreements.map((agreement, index) => (
                <div
                  key={agreement.code}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--g-brand-3308)]">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-[11px] text-[var(--g-text-secondary)]">{agreement.organ}</span>
                  </div>
                  <h2 className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">{agreement.label}</h2>
                  <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                    {agreement.dependency ? `Depende de ${agreement.dependency}` : "Primer hito de campaña"}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[var(--g-text-primary)]">
                    Plazo: {formatDate(addDays(params.fechaCierre, agreement.deadlineDays))}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
                <ClipboardList className="h-4 w-4 text-[var(--g-brand-3308)]" />
                Expedientes derivados
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-[var(--g-text-secondary)]">
                {Object.entries(modeCounts).map(([mode, count]) => (
                  <span key={mode} className="border border-[var(--g-border-subtle)] px-2 py-1" style={{ borderRadius: "var(--g-radius-sm)" }}>
                    {mode}: {count}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Sociedad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Fase</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Modo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Rule pack</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Plazo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                        Cargando sociedades...
                      </td>
                    </tr>
                  ) : expedientes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                        No hay sociedades en el alcance seleccionado.
                      </td>
                    </tr>
                  ) : (
                    expedientes.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold text-[var(--g-text-primary)]">{item.sociedad}</div>
                          <div className="text-xs text-[var(--g-text-secondary)]">
                            {formatJurisdiction(item.jurisdiction)} · {item.formaSocial} · {item.formaAdministracion}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{item.faseActual}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={cn("inline-flex px-2 py-1 text-[11px] font-semibold", statusTone(item.estado))} style={{ borderRadius: "var(--g-radius-sm)" }}>
                            {item.estado.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={cn("inline-flex px-2 py-1 text-[11px] font-semibold", modeTone(item.adoptionMode))} style={{ borderRadius: "var(--g-radius-sm)" }}>
                            {item.adoptionMode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">{item.rulePack}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--g-text-primary)]">{formatDate(item.deadline)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                          {item.alertas.length > 0 ? item.alertas.join(" · ") : "Sin alertas"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <WarRoomSection
        campaigns={launchedCampaigns}
        selectedCampaign={selectedCampaign}
        selectedCampaignId={selectedCampaignId}
        onSelectCampaign={setSelectedCampaignId}
        isLoading={isWarRoomLoading}
        errorMessage={warRoomErrorMessage}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <InfoPanel
          icon={ShieldCheck}
          title="Motor de enrutamiento"
          body="Cada expediente lee forma social, forma de administración y unipersonalidad para asignar el AdoptionMode y el rule pack aplicable."
        />
        <InfoPanel
          icon={Scale}
          title="Expedientes diferenciados"
          body="La campaña es única, pero el resultado no lo es: consejo, admin único, mancomunados, solidarios y socio único generan flujos distintos."
        />
        <InfoPanel
          icon={ListChecks}
          title="Dependencias y POST"
          body="La cadena conserva dependencias temporales y tareas posteriores como firma, inscripción, depósito y evidencias."
        />
      </div>
    </div>
  );
}

function WarRoomSection({
  campaigns,
  selectedCampaign,
  selectedCampaignId,
  onSelectCampaign,
  isLoading,
  errorMessage,
}: {
  campaigns: GroupCampaignWarRoomCampaign[];
  selectedCampaign: GroupCampaignWarRoomCampaign | null;
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  return (
    <section
      className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
            <ClipboardList className="h-4 w-4 text-[var(--g-brand-3308)]" />
            War Room de campañas lanzadas
          </div>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Seguimiento real de campañas persistidas, sociedades afectadas, fases, tareas y enlaces operativos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
          <WarRoomMetric label="Campañas" value={campaigns.length} />
          <WarRoomMetric label="Sociedades" value={selectedCampaign?.expedientes_count ?? 0} />
          <WarRoomMetric label="Tareas" value={selectedCampaign?.steps_count ?? 0} />
          <WarRoomMetric label="Live records" value={selectedCampaign?.live_links_count ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr]">
        <div className="border-b border-[var(--g-border-subtle)] xl:border-b-0 xl:border-r">
          <div className="max-h-[560px] space-y-2 overflow-y-auto p-4">
            {isLoading ? (
              <WarRoomState title="Cargando campañas..." body="Consultando campañas, expedientes y tareas generadas." />
            ) : campaigns.length === 0 ? (
              <WarRoomState title="Sin campañas lanzadas" body="Lanza una campaña para activar el seguimiento por sociedad." />
            ) : (
              campaigns.map((campaign) => {
                const active = campaign.id === selectedCampaignId || (!selectedCampaignId && campaign.id === selectedCampaign?.id);
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => onSelectCampaign(campaign.id)}
                    className={cn(
                      "w-full border p-3 text-left transition-colors",
                      active
                        ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                        : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)]",
                    )}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[var(--g-text-primary)]">{campaign.name}</div>
                        <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                          {campaignTemplateName(campaign.campaign_type)} · {campaign.expedientes_count} sociedades
                        </div>
                      </div>
                      <StatusChip status={campaign.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--g-text-secondary)]">
                      <span>Ejercicio {campaign.ejercicio ?? "N/D"}</span>
                      <span>{formatOptionalDate(campaign.fecha_lanzamiento)}</span>
                      <span>Plazo {formatOptionalDate(campaign.first_deadline ?? campaign.plazo_limite)}</span>
                      <span>{campaign.live_links_count} enlaces</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="min-w-0 p-4">
          {errorMessage ? (
            <WarRoomState title="No se pudo cargar el War Room" body={errorMessage} tone="error" />
          ) : selectedCampaign ? (
            <WarRoomCampaignDetail campaign={selectedCampaign} />
          ) : (
            <WarRoomState title="Campaña no seleccionada" body="Selecciona una campaña lanzada para ver sociedades, fases y tareas." />
          )}
        </div>
      </div>
    </section>
  );
}

function WarRoomCampaignDetail({ campaign }: { campaign: GroupCampaignWarRoomCampaign }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">{campaign.name}</h2>
            <StatusChip status={campaign.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {campaignTemplateName(campaign.campaign_type)} · lanzada el {formatOptionalDate(campaign.fecha_lanzamiento)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
          <WarRoomMetric label="Primer plazo" value={formatOptionalDate(campaign.first_deadline ?? campaign.plazo_limite)} />
          <WarRoomMetric label="Completadas" value={campaign.completed_steps} />
          <WarRoomMetric label="Bloqueadas" value={campaign.blocked_steps} />
        </div>
      </div>

      {campaign.expedientes.length === 0 ? (
        <WarRoomState title="Sin expedientes derivados" body="La campaña existe, pero todavía no hay sociedades vinculadas." />
      ) : (
        <div className="space-y-3">
          {campaign.expedientes.map((expediente) => (
            <WarRoomExpediente key={expediente.id} expediente={expediente} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarRoomExpediente({ expediente }: { expediente: GroupCampaignWarRoomExpediente }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{expediente.society_name}</h3>
            <StatusChip status={expediente.status} />
          </div>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {formatJurisdiction(expediente.jurisdiction ?? "N/D")} · {expediente.forma_social ?? "N/D"} · {expediente.forma_administracion ?? "N/D"}
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Fase actual: {expediente.fase_actual ?? "Sin fase"} · responsable: {expediente.responsable_label ?? "Secretaría de la sociedad"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
          <WarRoomMetric label="Plazo" value={formatOptionalDate(expediente.deadline)} />
          <WarRoomMetric label="Modo" value={expediente.adoption_mode ?? "N/D"} />
          <WarRoomMetric label="Live" value={expediente.live_links_count} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Fase / tarea</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Live record</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Expediente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {expediente.steps.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin fases generadas para esta sociedad.
                </td>
              </tr>
            ) : (
              expediente.steps.map((step) => <WarRoomStepRow key={step.id} step={step} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarRoomStepRow({ step }: { step: GroupCampaignWarRoomStep }) {
  const deadline = step.live_record?.deadline ?? step.deadline;
  return (
    <tr className="hover:bg-[var(--g-surface-subtle)]/50">
      <td className="px-4 py-3 text-sm">
        <div className="font-semibold text-[var(--g-text-primary)]">{step.step_order}. {step.label}</div>
        <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
          {step.materia} · {step.organ} · {step.adoption_mode}
        </div>
        {step.dependency ? (
          <div className="mt-1 text-xs text-[var(--g-text-secondary)]">Depende de {step.dependency}</div>
        ) : null}
        {step.alertas.length > 0 ? (
          <div className="mt-2 text-xs text-[var(--status-warning)]">{step.alertas.join(" · ")}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm">
        <StatusChip status={step.status} />
      </td>
      <td className="px-4 py-3 text-sm">
        {step.live_record ? (
          <div className="space-y-1">
            <StatusChip status={step.live_record.status ?? step.status} />
            <div className="text-xs text-[var(--g-text-secondary)]">
              {liveTableLabel(step.live_record.table)} · {step.live_record.label ?? step.live_record.logicalRef}
            </div>
          </div>
        ) : (
          <span className="text-xs text-[var(--g-text-secondary)]">Pendiente de vinculación</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
          {formatOptionalDate(deadline)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <LiveRecordLink liveRecord={step.live_record} table={step.live_table} id={step.live_record_id} />
      </td>
    </tr>
  );
}

function LiveRecordLink({
  liveRecord,
  table,
  id,
}: {
  liveRecord: GroupCampaignLiveRecord | null;
  table: string | null;
  id: string | null;
}) {
  if (liveRecord?.href) {
    return (
      <Link
        to={liveRecord.href}
        className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--g-brand-3308)] transition-colors hover:bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir
      </Link>
    );
  }

  if (liveRecord?.logicalRef || (table && id)) {
    return (
      <span
        className="inline-flex border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        {liveTableLabel(liveRecord?.table ?? table)} · {shortRef(liveRecord?.id ?? id)}
      </span>
    );
  }

  return <span className="text-xs text-[var(--g-text-secondary)]">Sin expediente</span>;
}

function StatusChip({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={cn("inline-flex px-2 py-1 text-[11px] font-semibold", recordStatusTone(status))}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {displayStatus(status)}
    </span>
  );
}

function WarRoomMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <span
      className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1"
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      <span className="font-semibold text-[var(--g-text-primary)]">{value}</span>
      <span className="text-[var(--g-text-secondary)]">{label}</span>
    </span>
  );
}

function WarRoomState({
  title,
  body,
  tone = "default",
}: {
  title: string;
  body: string;
  tone?: "default" | "error";
}) {
  const Icon = tone === "error" ? AlertTriangle : FileText;
  const iconClass = tone === "error" ? "text-[var(--status-error)]" : "text-[var(--g-brand-3308)]";
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} />
        <div>
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  tone?: "primary" | "warning";
}) {
  const iconClass = tone === "warning" ? "text-[var(--status-warning)]" : "text-[var(--g-brand-3308)]";
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconClass)} />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
}) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
        <div>
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{body}</p>
        </div>
      </div>
    </section>
  );
}
