export type CampaignType =
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

export type CampaignOrgan = "ADMIN" | "JUNTA" | "POST" | "COMPLIANCE";

export type CampaignAdoptionMode =
  | "MEETING"
  | "NO_SESSION"
  | "UNIPERSONAL_ADMIN"
  | "UNIPERSONAL_SOCIO"
  | "CO_APROBACION"
  | "SOLIDARIO"
  | "POST_TASK";

export type CampaignStatus = "PENDIENTE" | "EN_CURSO" | "COMPLETADO" | "BLOQUEADO";

export interface CampaignAgreement {
  code: string;
  label: string;
  organ: CampaignOrgan;
  dependency: string | null;
  deadlineDays: number;
}

export interface CampaignTemplate {
  type: CampaignType;
  name: string;
  summary: string;
  legalAnchor: string;
  cadence: string;
  agreements: CampaignAgreement[];
}

export interface CampaignParams {
  type: CampaignType;
  ejercicio: string;
  fechaCierre: string;
  fechaLanzamiento: string;
  selectedJurisdictions: string[];
  includeCotizada: boolean;
  preferNoSession: boolean;
}

export interface CampaignSocietyInput {
  id: string;
  legal_name: string;
  common_name: string | null;
  jurisdiction: string | null;
  legal_form: string | null;
  tipo_social: string | null;
  entity_status?: string | null;
  forma_administracion: string | null;
  tipo_organo_admin: string | null;
  es_unipersonal: boolean | null;
  es_cotizada: boolean | null;
}

export interface CampaignExpediente {
  id: string;
  sociedadId: string;
  sociedad: string;
  jurisdiction: string;
  formaSocial: string;
  formaAdministracion: string;
  faseActual: string;
  estado: CampaignStatus;
  adoptionMode: CampaignAdoptionMode;
  rulePack: string;
  deadline: string;
  responsable: string;
  alertas: string[];
  explain: string[];
}

export const DEFAULT_CAMPAIGN_JURISDICTIONS = ["ES", "PT", "BR", "MX"];

export const GROUP_CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
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

export function makeDefaultCampaignParams(now = new Date()): CampaignParams {
  const ejercicio = String(now.getFullYear() - 1);
  return {
    type: "CUENTAS_ANUALES",
    ejercicio,
    fechaCierre: `${ejercicio}-12-31`,
    fechaLanzamiento: now.toISOString().slice(0, 10),
    selectedJurisdictions: DEFAULT_CAMPAIGN_JURISDICTIONS,
    includeCotizada: true,
    preferNoSession: false,
  };
}

export function addCampaignDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toUpperCase();
}

export function normalizeCampaignAdminForm(sociedad: CampaignSocietyInput) {
  const value = `${sociedad.tipo_organo_admin ?? ""} ${sociedad.forma_administracion ?? ""}`.toUpperCase();
  if (value.includes("MANCOMUN")) return "ADM_MANCOMUNADOS";
  if (value.includes("SOLIDAR")) return "ADM_SOLIDARIOS";
  if (value.includes("UNICO") || value.includes("ÚNICO")) return "ADMINISTRADOR_UNICO";
  if (value.includes("CONSEJO")) return "CONSEJO";
  return sociedad.es_unipersonal ? "ADMINISTRADOR_UNICO" : "CONSEJO";
}

export function determineCampaignAdoptionMode(
  sociedad: CampaignSocietyInput,
  organ: CampaignOrgan,
  preferNoSession: boolean,
): CampaignAdoptionMode {
  if (organ === "POST" || organ === "COMPLIANCE") return "POST_TASK";
  if (organ === "JUNTA" && sociedad.es_unipersonal) return "UNIPERSONAL_SOCIO";

  const adminForm = normalizeCampaignAdminForm(sociedad);
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

function makeRulePack(sociedad: CampaignSocietyInput, phase: CampaignAgreement) {
  const jurisdiction = sociedad.jurisdiction ?? "ES";
  const social = sociedad.tipo_social ?? sociedad.legal_form ?? "SOCIEDAD";
  return `${jurisdiction}-${social}-${phase.code}`;
}

function explainFor(sociedad: CampaignSocietyInput, phase: CampaignAgreement, mode: CampaignAdoptionMode) {
  const adminForm = normalizeCampaignAdminForm(sociedad);
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

function explainRecordFor(sociedad: CampaignSocietyInput, phase: CampaignAgreement, mode: CampaignAdoptionMode) {
  return {
    forma_social: sociedad.tipo_social ?? sociedad.legal_form ?? "N/D",
    forma_administracion: normalizeCampaignAdminForm(sociedad),
    organo: phase.organ,
    adoption_mode: mode,
    unipersonal: Boolean(sociedad.es_unipersonal),
    cotizada: Boolean(sociedad.es_cotizada),
  };
}

function alertsFor(
  sociedad: CampaignSocietyInput,
  phase: CampaignAgreement,
  mode: CampaignAdoptionMode,
  status: CampaignStatus,
) {
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

export function buildGroupCampaignExpedientes(
  sociedades: CampaignSocietyInput[],
  template: CampaignTemplate,
  params: CampaignParams,
): CampaignExpediente[] {
  return sociedades.map((sociedad, index) => {
    const estado = statusFor(index, template);
    const phase = phaseFor(estado, template, index);
    const adoptionMode = determineCampaignAdoptionMode(sociedad, phase.organ, params.preferNoSession);
    return {
      id: `${params.type}-${sociedad.id}`,
      sociedadId: sociedad.id,
      sociedad: sociedad.common_name ?? sociedad.legal_name,
      jurisdiction: sociedad.jurisdiction ?? "N/D",
      formaSocial: sociedad.tipo_social ?? sociedad.legal_form ?? "Sociedad",
      formaAdministracion: normalizeCampaignAdminForm(sociedad),
      faseActual: phase.label,
      estado,
      adoptionMode,
      rulePack: makeRulePack(sociedad, phase),
      deadline: addCampaignDays(params.fechaCierre, phase.deadlineDays),
      responsable: "Secretaría de la sociedad",
      alertas: alertsFor(sociedad, phase, adoptionMode, estado),
      explain: explainFor(sociedad, phase, adoptionMode),
    };
  });
}

export function buildGroupCampaignLaunchInput(
  params: CampaignParams,
  template: CampaignTemplate,
  sociedades: CampaignSocietyInput[],
  expedientes: CampaignExpediente[],
) {
  const plazoLimite = template.agreements
    .map((agreement) => addCampaignDays(params.fechaCierre, agreement.deadlineDays))
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
          ? determineCampaignAdoptionMode(sociedad, agreement.organ, params.preferNoSession)
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
          deadline: addCampaignDays(params.fechaCierre, agreement.deadlineDays),
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

export function uniqueCampaignJurisdictions(sociedades: CampaignSocietyInput[]) {
  const values = sociedades
    .map((sociedad) => sociedad.jurisdiction)
    .filter((jurisdiction): jurisdiction is string => Boolean(jurisdiction));
  return Array.from(new Set([...DEFAULT_CAMPAIGN_JURISDICTIONS, ...values])).sort();
}
