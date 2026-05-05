import { resolverReglaEfectiva } from "./jerarquia-normativa";
import type { EvalSeverity, ExplainNode, RuleParamOverride, TipoSocial } from "./types";

export interface DeadlineEvaluation {
  ok: boolean;
  severity: EvalSeverity;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

export interface NoticePublication {
  canal: string;
  fecha: string;
}

export interface NoticePeriodInput {
  tipoSocial: TipoSocial;
  esCotizada?: boolean;
  fechaConvocatoria: string;
  fechaJunta: string;
  fechaPrimeraConvocatoria?: string;
  fechaSegundaConvocatoria?: string | null;
  publicaciones?: NoticePublication[];
  plazoEstatutarioDias?: number | null;
  overrides?: RuleParamOverride[];
}

export interface NoticePeriodOutput extends DeadlineEvaluation {
  antelacionDiasRequerida: number;
  antelacionDiasComputada: number;
  fechaComputo: string;
  canalesRequeridos: string[];
  canalesFaltantes: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

export function daysBetween(start: string, end: string) {
  return Math.floor((utcDate(end) - utcDate(start)) / DAY_MS);
}

export function addDays(value: string, days: number) {
  const date = new Date(utcDate(value));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requiredNoticeDays(input: NoticePeriodInput) {
  const legalMinimum = input.tipoSocial === "SL" || input.tipoSocial === "SLU" ? 15 : 30;
  const base = {
    valor: Math.max(legalMinimum, input.plazoEstatutarioDias ?? legalMinimum),
    fuente: input.plazoEstatutarioDias && input.plazoEstatutarioDias > legalMinimum ? "ESTATUTOS" as const : "LEY" as const,
    referencia: input.tipoSocial === "SL" || input.tipoSocial === "SLU" ? "art. 176 LSC (SL)" : "art. 176 LSC (SA)",
  };
  const resolved = resolverReglaEfectiva(base, input.overrides ?? [], "mayor");
  return Math.max(legalMinimum, Number(resolved.valor) || legalMinimum);
}

export function evaluateNoticePeriod(input: NoticePeriodInput): NoticePeriodOutput {
  const blocking_issues: string[] = [];
  const warnings: string[] = [];
  const explain: ExplainNode[] = [];
  const required = requiredNoticeDays(input);
  const requiredChannels = input.esCotizada ? ["CNMV", "BORME", "WEB_SOCIEDAD"] : [];
  const publicationDates = input.publicaciones?.map((publication) => publication.fecha) ?? [];
  const fechaComputo = input.esCotizada && publicationDates.length > 0
    ? publicationDates.reduce((latest, current) => daysBetween(latest, current) > 0 ? current : latest)
    : input.fechaConvocatoria;
  const actualDays = daysBetween(fechaComputo, input.fechaJunta);

  if (actualDays < required) {
    blocking_issues.push("notice_period_insufficient");
  }

  const publishedChannels = new Set(input.publicaciones?.map((publication) => publication.canal) ?? []);
  const missingChannels = requiredChannels.filter((channel) => !publishedChannels.has(channel));
  if (missingChannels.length > 0) {
    blocking_issues.push("listed_company_publication_channels_missing");
  }

  if (input.fechaSegundaConvocatoria) {
    const first = input.fechaPrimeraConvocatoria ?? input.fechaJunta;
    const gap = daysBetween(first, input.fechaSegundaConvocatoria);
    if (gap < 1) {
      blocking_issues.push("second_call_gap_less_than_24h");
    }
  }

  explain.push({
    regla: "Plazo de convocatoria",
    fuente: "LEY",
    referencia: input.esCotizada ? "arts. 176 y 517 LSC" : "art. 176 LSC",
    umbral: required,
    valor: actualDays,
    resultado: actualDays >= required ? "OK" : "BLOCKING",
    mensaje: `Antelacion computada ${actualDays} dias; requerida ${required} dias.`,
  });

  if (requiredChannels.length > 0) {
    explain.push({
      regla: "Canales cotizada",
      fuente: "LEY",
      referencia: "art. 517 LSC",
      resultado: missingChannels.length === 0 ? "OK" : "BLOCKING",
      mensaje: missingChannels.length === 0
        ? "Publicaciones cotizada completas."
        : `Faltan canales de publicacion: ${missingChannels.join(", ")}.`,
    });
  }

  const ok = blocking_issues.length === 0;
  return {
    ok,
    severity: ok ? "OK" : "BLOCKING",
    explain,
    blocking_issues,
    warnings,
    antelacionDiasRequerida: required,
    antelacionDiasComputada: actualDays,
    fechaComputo,
    canalesRequeridos: requiredChannels,
    canalesFaltantes: missingChannels,
  };
}

export function evaluateConvocationExpiry(input: {
  fechaJunta: string;
  fechaSegundaConvocatoria?: string | null;
  fechaCelebracion?: string | null;
  ahora: string;
}): DeadlineEvaluation & { estado: "VIGENTE" | "CADUCADO"; canGenerateMinute: boolean } {
  const lastMeetingDate = input.fechaSegundaConvocatoria ?? input.fechaJunta;
  const expired = !input.fechaCelebracion && daysBetween(lastMeetingDate, input.ahora) > 0;
  return {
    ok: !expired,
    severity: expired ? "BLOCKING" : "OK",
    explain: [{
      regla: "Caducidad convocatoria",
      fuente: "SISTEMA",
      resultado: expired ? "BLOCKING" : "OK",
      mensaje: expired
        ? "La junta no consta celebrada en primera ni segunda convocatoria; el expediente caduca y no permite generar acta."
        : "La convocatoria sigue habilitada para documentar la celebracion.",
    }],
    blocking_issues: expired ? ["convocation_expired_no_minute_allowed"] : [],
    warnings: [],
    estado: expired ? "CADUCADO" : "VIGENTE",
    canGenerateMinute: !expired,
  };
}

export function evaluateInformationRequestWindow(input: {
  fechaConvocatoria: string;
  fechaJunta: string;
  fechaSolicitud: string;
}): DeadlineEvaluation & { extemporanea: boolean } {
  const fromNotice = daysBetween(input.fechaConvocatoria, input.fechaSolicitud) >= 0;
  const untilFiveDaysBefore = daysBetween(input.fechaSolicitud, input.fechaJunta) >= 5;
  const ok = fromNotice && untilFiveDaysBefore;
  return {
    ok,
    severity: ok ? "OK" : "WARNING",
    explain: [{
      regla: "Derecho de informacion",
      fuente: "LEY",
      referencia: "art. 197 LSC",
      resultado: ok ? "OK" : "WARNING",
      mensaje: ok
        ? "Solicitud dentro de plazo."
        : "Solicitud de informacion extemporanea respecto de la ventana legal.",
    }],
    blocking_issues: [],
    warnings: ok ? [] : ["information_request_extemporaneous"],
    extemporanea: !ok,
  };
}

export function evaluateChallengeDeadline(input: {
  fechaAcuerdo: string;
  ahora: string;
  tipo: "ANULABLE" | "ORDEN_PUBLICO";
  warningDays?: number;
}): DeadlineEvaluation & { deadline?: string; daysRemaining?: number; noCaducidad: boolean } {
  if (input.tipo === "ORDEN_PUBLICO") {
    return {
      ok: true,
      severity: "OK",
      explain: [{
        regla: "Impugnacion orden publico",
        fuente: "LEY",
        referencia: "art. 205 LSC",
        resultado: "OK",
        mensaje: "Acuerdo potencialmente nulo por orden publico: no se aplica plazo de caducidad.",
      }],
      blocking_issues: [],
      warnings: [],
      noCaducidad: true,
    };
  }

  const deadline = addDays(input.fechaAcuerdo, 365);
  const daysRemaining = daysBetween(input.ahora, deadline);
  const warningDays = input.warningDays ?? 30;
  const closeToExpiry = daysRemaining >= 0 && daysRemaining <= warningDays;
  const expired = daysRemaining < 0;
  return {
    ok: !expired,
    severity: expired ? "WARNING" : closeToExpiry ? "WARNING" : "OK",
    explain: [{
      regla: "Plazo impugnacion",
      fuente: "LEY",
      referencia: "art. 205 LSC",
      resultado: expired || closeToExpiry ? "WARNING" : "OK",
      mensaje: `Plazo de impugnacion hasta ${deadline}. Dias restantes: ${daysRemaining}.`,
    }],
    blocking_issues: [],
    warnings: [
      ...(closeToExpiry ? ["challenge_deadline_near_expiry"] : []),
      ...(expired ? ["challenge_deadline_expired"] : []),
    ],
    deadline,
    daysRemaining,
    noCaducidad: false,
  };
}

export function evaluateSeparationRight(input: {
  materia: string;
  fechaPublicacion?: string;
  separationNoticeDocumented?: boolean;
}): DeadlineEvaluation & { deadline?: string } {
  const materias = new Set(["MODIFICACION_OBJETO_SOCIAL", "TRASLADO_DOMICILIO_EXTRANJERO", "TRANSFORMACION"]);
  if (!materias.has(input.materia)) {
    return { ok: true, severity: "OK", explain: [], blocking_issues: [], warnings: [] };
  }
  const documented = input.separationNoticeDocumented === true;
  return {
    ok: documented,
    severity: documented ? "OK" : "BLOCKING",
    explain: [{
      regla: "Derecho de separacion",
      fuente: "LEY",
      referencia: "arts. 346-348 LSC",
      resultado: documented ? "OK" : "BLOCKING",
      mensaje: "Materia con derecho de separacion: debe documentarse plazo de un mes desde publicacion.",
    }],
    blocking_issues: documented ? [] : ["separation_right_notice_missing"],
    warnings: [],
    deadline: input.fechaPublicacion ? addDays(input.fechaPublicacion, 30) : undefined,
  };
}

export function evaluateDividendSeparationWarning(input: {
  rejectedMinimumDividend: boolean;
  consecutiveProfitableYears: number;
}): DeadlineEvaluation {
  const warning = input.rejectedMinimumDividend && input.consecutiveProfitableYears >= 3;
  return {
    ok: true,
    severity: warning ? "WARNING" : "OK",
    explain: [{
      regla: "Separacion por no reparto",
      fuente: "LEY",
      referencia: "art. 348 bis LSC",
      resultado: warning ? "WARNING" : "OK",
      mensaje: warning
        ? "Potencial derecho de separacion por falta de reparto de dividendos."
        : "No se activa warning de separacion por dividendos.",
    }],
    blocking_issues: [],
    warnings: warning ? ["dividend_separation_right_risk"] : [],
  };
}

export function evaluateCreditorOpposition(input: {
  materia: "REDUCCION_CAPITAL" | "FUSION";
  causa?: "PERDIDAS" | "RESERVA_LEGAL" | "DEVOLUCION_APORTACIONES";
  fechaPublicacion: string;
  ahora: string;
  oppositionRenounced?: boolean;
}): DeadlineEvaluation & { deadline: string; waitingElapsed: boolean } {
  const exemptReduction = input.materia === "REDUCCION_CAPITAL" && (input.causa === "PERDIDAS" || input.causa === "RESERVA_LEGAL");
  const deadline = addDays(input.fechaPublicacion, 30);
  const waitingElapsed = daysBetween(deadline, input.ahora) >= 0;
  const ok = exemptReduction || input.oppositionRenounced === true || waitingElapsed;
  return {
    ok,
    severity: ok ? "OK" : "BLOCKING",
    explain: [{
      regla: "Oposicion acreedores",
      fuente: "LEY",
      referencia: input.materia === "FUSION" ? "art. 44 RDL 5/2023" : "art. 334 LSC",
      resultado: ok ? "OK" : "BLOCKING",
      mensaje: exemptReduction
        ? "Reduccion exenta de derecho de oposicion por causa legal."
        : `Debe transcurrir o renunciarse el plazo de oposicion hasta ${deadline}.`,
    }],
    blocking_issues: ok ? [] : ["creditor_opposition_period_open"],
    warnings: [],
    deadline,
    waitingElapsed,
  };
}

export function evaluateAnnualAccountsDeadlines(input: {
  fiscalYearEnd: string;
  formulationDate: string;
  ordinaryMeetingDate: string;
  approvalDate?: string;
  depositDate?: string;
  now?: string;
}): DeadlineEvaluation & { depositDeadline?: string; ordinaryMeetingDeadline: string; formulationDeadline: string } {
  const formulationDeadline = addDays(input.fiscalYearEnd, 90);
  const ordinaryMeetingDeadline = addDays(input.fiscalYearEnd, 181);
  const depositDeadline = input.approvalDate ? addDays(input.approvalDate, 30) : undefined;
  const warnings: string[] = [];

  if (daysBetween(formulationDeadline, input.formulationDate) > 0) warnings.push("accounts_formulation_late");
  if (daysBetween(ordinaryMeetingDeadline, input.ordinaryMeetingDate) > 0) warnings.push("ordinary_meeting_after_six_months");
  if (depositDeadline && input.now && !input.depositDate && daysBetween(depositDeadline, input.now) > 0) {
    warnings.push("accounts_deposit_overdue");
  }
  if (depositDeadline && input.depositDate && daysBetween(depositDeadline, input.depositDate) > 0) {
    warnings.push("accounts_deposit_late");
  }

  return {
    ok: true,
    severity: warnings.length > 0 ? "WARNING" : "OK",
    explain: [{
      regla: "Cuentas anuales",
      fuente: "LEY",
      referencia: "arts. 164, 253 y 279 LSC",
      resultado: warnings.length > 0 ? "WARNING" : "OK",
      mensaje: "Control de formulacion, junta ordinaria y deposito de cuentas.",
    }],
    blocking_issues: [],
    warnings,
    depositDeadline,
    ordinaryMeetingDeadline,
    formulationDeadline,
  };
}

export function evaluateAuditorOpinion(input: {
  opinion: "LIMPIA" | "SALVEDADES" | "DENEGADA" | "DESFAVORABLE";
}): DeadlineEvaluation {
  const reinforced = input.opinion === "DENEGADA" || input.opinion === "DESFAVORABLE";
  const withQualifications = input.opinion === "SALVEDADES";
  return {
    ok: !reinforced,
    severity: reinforced ? "BLOCKING" : withQualifications ? "WARNING" : "OK",
    explain: [{
      regla: "Informe auditor",
      fuente: "LEY",
      resultado: reinforced ? "BLOCKING" : withQualifications ? "WARNING" : "OK",
      mensaje: reinforced
        ? "Opinion denegada/desfavorable: gate de atencion reforzada."
        : withQualifications
        ? "Informe con salvedades: debe reflejarse en convocatoria y aprobacion."
        : "Informe sin salvedades relevantes.",
    }],
    blocking_issues: reinforced ? ["auditor_opinion_reinforced_attention"] : [],
    warnings: withQualifications ? ["auditor_qualifications_warning"] : [],
  };
}

export function evaluateRegistryDeadline(input: {
  materia: "NOMBRAMIENTO_CONSEJERO" | "CESE_CONSEJERO" | "MODIFICACION_ESTATUTOS" | "AUMENTO_CAPITAL" | "REDUCCION_CAPITAL" | "DEPOSITO_CUENTAS";
  fechaBase: string;
  ahora: string;
  oppositionRenounced?: boolean;
  oppositionDeadlineElapsed?: boolean;
}): DeadlineEvaluation & { deadline: string; status: "PENDIENTE" | "VENCIDO" | "BLOQUEADO" } {
  const days = input.materia === "NOMBRAMIENTO_CONSEJERO" || input.materia === "CESE_CONSEJERO" ? 10 : 30;
  const deadline = addDays(input.fechaBase, days);
  const overdue = daysBetween(deadline, input.ahora) > 0;
  const capitalReductionBlocked = input.materia === "REDUCCION_CAPITAL" && input.oppositionRenounced !== true && input.oppositionDeadlineElapsed !== true;
  const oneYearDepositRisk = input.materia === "DEPOSITO_CUENTAS" && daysBetween(input.fechaBase, input.ahora) > 365;
  const warnings = [
    ...(overdue ? ["registry_deadline_overdue"] : []),
    ...(oneYearDepositRisk ? ["registry_closure_risk_art_282_lsc"] : []),
    ...(input.materia === "MODIFICACION_ESTATUTOS" ? ["borme_publication_reminder"] : []),
  ];

  return {
    ok: !capitalReductionBlocked,
    severity: capitalReductionBlocked ? "BLOCKING" : warnings.length > 0 ? "WARNING" : "OK",
    explain: [{
      regla: "Plazo registral demo",
      fuente: "LEY",
      referencia: input.materia === "DEPOSITO_CUENTAS" ? "arts. 279 y 282 LSC" : "RRM/LSC",
      resultado: capitalReductionBlocked ? "BLOCKING" : warnings.length > 0 ? "WARNING" : "OK",
      mensaje: "Recordatorio demo de preparacion registral; no implica envio al Registro Mercantil.",
    }],
    blocking_issues: capitalReductionBlocked ? ["capital_reduction_opposition_gate_open"] : [],
    warnings,
    deadline,
    status: capitalReductionBlocked ? "BLOQUEADO" : overdue ? "VENCIDO" : "PENDIENTE",
  };
}
