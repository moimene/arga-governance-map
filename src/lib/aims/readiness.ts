import { AESIA_RIA_REQUIREMENTS } from "./catalog-aesia";
import { checksVigentes, evaluacionesVigentes } from "./checks-vigentes";
import { acreditaConformidad } from "./conformidad";
import { tieneClasificacionGuiada } from "./cuestionario-calificacion";
import { ANEXO_IV_SECCIONES, normalizarEstadoSeccion } from "./expediente-tecnico";
import { evaluacionAcredita, evaluacionFirme, seccionAcredita, sistemasCubiertos, traducirLegado } from "./legado";
import { monitorDeCodigo } from "./mapa-monitores";
import { DESPLIEGUE_REQUIREMENTS, codigosDelPerfil } from "./perfil-aplicabilidad";
import { etiqueta, isMaterialSeverity, normalizeAimsStatus } from "./vocabulario";

export type AimsSourcePosture = "legacy-ai" | "aims-ready" | "local-derived";
/**
 * `unmeasured`: no hay ningún dato del objeto que el monitor lee — no se
 * afirma nada. `na`: la población es vacía por hecho (0/0, p. ej. ningún
 * sistema de alto riesgo) y se pinta gris, no en rojo.
 */
export type AimsReadinessStatus = "ready" | "watch" | "gap" | "unmeasured" | "na";

export interface AimsSystemLike {
  id: string;
  risk_level?: string | null;
  status?: string | null;
  vendor?: string | null;
  regulatory_role?: string | null;
  regulatory_profile?: Record<string, unknown> | null;
}

export interface AimsAssessmentLike {
  id: string;
  system_id?: string | null;
  status?: string | null;
  score?: number | null;
  findings?: { code?: string | null; status?: string | null; justification?: string | null; evidenceCount?: number | null }[] | null;
  assessment_date?: string | null;
  framework?: string | null;
  created_at?: string | null;
  frozen_at?: string | null;
  reviewed_at?: string | null;
}

export interface AimsIncidentLike {
  id: string;
  system_id?: string | null;
  status?: string | null;
  severity?: string | null;
  root_cause?: string | null;
  corrective_action?: string | null;
  closed_at?: string | null;
}

export interface AimsComplianceCheckLike {
  id: string;
  system_id?: string | null;
  requirement_code?: string | null;
  requirement_title?: string | null;
  description?: string | null;
  status?: string | null;
  evidence_url?: string | null;
  created_at?: string | null;
  /** Código original si se leyó como legado (`traducirLegado`): no acredita. */
  codigo_legado?: string;
}

/** Sección del expediente técnico (`aims_technical_file_sections`). */
export interface AimsSectionLike {
  system_id?: string | null;
  section_code?: string | null;
  status?: string | null;
  reviewed_by_id?: string | null;
}

/** Indicador de vigilancia (`aims_monitoring_indicators`). `status` no se lee: nace «OK» sin medir. */
export interface AimsIndicatorLike {
  system_id?: string | null;
  current_value?: unknown;
}

export interface AimsReadinessDomain {
  id: string;
  label: string;
  status: AimsReadinessStatus;
  metric: string;
  detail: string;
  route: string;
  /**
   * Si el dominio se apoya en algún dato. Un dominio sin dato no puede
   * contribuir a declarar el sistema operable: la ausencia no acredita.
   */
  hasData: boolean;
}

export interface AimsComplianceMonitorDomain {
  id: string;
  label: string;
  area: "EU AI Act" | "ISO 42001" | "Operativo AIMS" | "Cross-module";
  status: AimsReadinessStatus;
  metric: string;
  detail: string;
  route: string;
  /**
   * El objeto del que sale la métrica. Si no hay comprobaciones con el código
   * del área, es el objeto propio del monitor —nunca `ai_compliance_checks`—,
   * y `ninguna` cuando no hay nada que leer.
   */
  source:
    | "ai_systems"
    | "ai_risk_assessments"
    | "ai_compliance_checks"
    | "ai_incidents"
    | "aims_technical_file_sections"
    | "aims_monitoring_indicators"
    | "derived"
    | "ninguna";
  handoff?: string;
  /** Comprobaciones del área medidas contra un catálogo que no es el del sistema: ni conformes ni brechas. */
  otroCatalogo: number;
}

export interface AimsReadinessInput {
  systems: AimsSystemLike[];
  assessments: AimsAssessmentLike[];
  incidents: AimsIncidentLike[];
  complianceChecks?: AimsComplianceCheckLike[];
  technicalFileSections?: AimsSectionLike[];
  monitoringIndicators?: AimsIndicatorLike[];
}

export interface AimsReadinessSummary {
  sourcePosture: AimsSourcePosture;
  contractId: "aims-p0-readiness";
  sourceTables: string[];
  migrationPath: string;
  standaloneReady: boolean;
  domains: AimsReadinessDomain[];
  complianceMonitors: AimsComplianceMonitorDomain[];
  /** Pasos derivados del dato: qué falta, cuánto y dónde se hace. Nunca una lista fija. */
  nextSteps: AimsPaso[];
}

export interface AimsPaso {
  label: string;
  detalle: string;
  to: string;
}

// Aquí vivían `aimsScreenPostures` y `aimsReadOnlyHandoffs`. El primero era una
// descripción EN PROSA de lo que hacen las pantallas, mantenida aparte de las
// pantallas: derivaba en cuanto alguien tocaba una, y llegó a afirmar por las
// diez filas lo que sólo valía para ocho. Se retira (D-10). Los handoffs, que
// son dato de navegación y no prosa, se mudan a `./handoffs`.

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function domainStatus(value: number, watchAt: number, readyAt: number): AimsReadinessStatus {
  if (value >= readyAt) return "ready";
  if (value >= watchAt) return "watch";
  return "gap";
}

/**
 * El vocabulario (valores, etiquetas, chips y los dos predicados de estado)
 * vive en `./vocabulario`, un módulo HOJA que también importan las pantallas.
 * Se re-exporta con los nombres de siempre para no partir a los llamadores.
 */
export {
  normalizeAimsStatus,
  isMaterialSeverity,
  chipClaseEstadoSistema as systemStatusChipClass,
} from "./vocabulario";

/** Sin estado no se pinta un literal vacío: se dice que falta. */
export function systemStatusLabel(status: string | null | undefined): string {
  return status ? etiqueta("estadoSistema", status) : "Sin estado";
}

/**
 * Estados de evaluación que ACREDITAN conformidad.
 *
 * El vocabulario está partido entre escritura y lectura: el producto escribe
 * `CONFORME | CON_GAPS | BORRADOR` (`evaluacion-payload.ts`) y la lectura sólo
 * contaba `APROBADO`, un valor que NINGÚN camino del producto escribe — sólo
 * está en las filas antiguas de Cloud. Consecuencia: una evaluación conforme
 * recién creada no cubría a su sistema y el KPI seguía diciendo «alto riesgo
 * sin evaluación aprobada». Se acepta el vocabulario que se escribe Y el
 * legado, en un solo sitio, para que no vuelvan a divergir.
 */
const ASSESSMENT_COMPLIANT_STATUSES = new Set(["APROBADO", "CONFORME"]);

export function assessmentAcreditaConformidad(status: string | null | undefined): boolean {
  return ASSESSMENT_COMPLIANT_STATUSES.has(normalizeAimsStatus(status));
}

export function isAimsTechnicalFileGapCandidate(assessment: AimsAssessmentLike) {
  // Un borrador es «no medido», no un gap: su score 0 y sus findings PENDIENTE
  // son artefactos del autoguardado, no una evaluación con brechas.
  if (normalizeAimsStatus(assessment.status) === "BORRADOR") return false;
  const status = assessment.status ?? "";
  const hasUnapprovedStatus = status !== "" && !assessmentAcreditaConformidad(status);
  const hasWeakScore = typeof assessment.score === "number" && assessment.score < 80;
  const hasOpenFinding = (assessment.findings ?? []).some((finding) =>
    ["NO_CONFORME", "PENDIENTE", "EN_CURSO", "ABIERTO"].includes(finding.status ?? ""),
  );

  return hasUnapprovedStatus || hasWeakScore || hasOpenFinding;
}

/**
 * Un incidente está cerrado SÓLO con estado CERRADO y fecha de cierre. Tener
 * escritas la causa raíz o la acción correctiva no lo cierra: medido en
 * Garrigues el 2026-09-19, el incidente de Harvey en investigación salía
 * «1/1 con cierre» por eso.
 */
export function incidenteCerrado(incident: AimsIncidentLike): boolean {
  return normalizeAimsStatus(incident.status) === "CERRADO" && Boolean(incident.closed_at);
}

/** «0/1 cerrados · 1 en investigación»: lo que no está cerrado se dice qué es. */
function metricaCierre(incidents: AimsIncidentLike[]): string {
  const cerrados = incidents.filter(incidenteCerrado).length;
  const enInvestigacion = incidents.filter((i) => normalizeAimsStatus(i.status) === "EN_INVESTIGACION").length;
  return `${cerrados}/${incidents.length} cerrados${enInvestigacion > 0 ? ` · ${enInvestigacion} en investigación` : ""}`;
}

export function isAimsMaterialIncidentCandidate(incident: AimsIncidentLike) {
  const severity = incident.severity ?? "";
  const status = incident.status ?? "";
  const materialSeverity = isMaterialSeverity(severity);
  const openStatus = ["ABIERTO", "EN_INVESTIGACION"].includes(normalizeAimsStatus(status));

  return materialSeverity && openStatus;
}

const COMPLIANT_STATUSES = new Set(["CONFORME", "APROBADO", "OK", "CERRADO", "COMPLETO"]);
// Los estados llegan por `normalizeAimsStatus`, así que estos conjuntos van en
// la forma canónica (mayúsculas, sin tildes, con guion bajo): «En revisión» y
// «EN_REVISION» son la misma clave, y no hace falta enumerar las dos.
const WATCH_STATUSES = new Set(["EN_CURSO", "EN_REVISION", "PENDIENTE", "PARCIAL", "BORRADOR"]);
const GAP_STATUSES = new Set(["NO_CONFORME", "ABIERTO", "BLOQUEADO", "VENCIDO", "CRITICO"]);

type MonitorDefinition = Omit<AimsComplianceMonitorDomain, "status" | "metric" | "otroCatalogo">;

const complianceMonitorDefinitions: MonitorDefinition[] = [
  {
    id: "governance-accountability",
    label: "Gobierno, roles y accountability",
    area: "ISO 42001",
    detail: "Responsables, aprobación, segregación y gobernanza del sistema de gestión IA.",
    route: "/ai-governance/sistemas",
    source: "ninguna",
  },
  {
    id: "inventory-classification",
    label: "Inventario y clasificación de riesgo",
    area: "EU AI Act",
    detail: "Registro completo, estado operativo, riesgo AI Act y uso previsto.",
    route: "/ai-governance/sistemas",
    source: "ai_systems",
  },
  {
    id: "prohibited-practices",
    label: "Prácticas prohibidas",
    area: "EU AI Act",
    detail: "Detección temprana de usos inaceptables o prácticas no permitidas.",
    route: "/ai-governance/sistemas",
    source: "ninguna",
  },
  {
    id: "high-risk-obligations",
    label: "Obligaciones alto riesgo",
    area: "EU AI Act",
    detail: "Gestión de riesgos (art. 9), sistema de gestión de la calidad (art. 17) y cobertura de evaluación de los sistemas de alto riesgo.",
    route: "/ai-governance/evaluaciones",
    source: "ai_risk_assessments",
  },
  {
    id: "technical-documentation",
    label: "Expediente técnico",
    area: "EU AI Act",
    detail: "Documentación técnica, trazabilidad y gaps derivables a GRC como intake.",
    route: "/ai-governance/evaluaciones",
    source: "aims_technical_file_sections",
    handoff: "AIMS_TECHNICAL_FILE_GAP",
  },
  {
    id: "data-governance",
    label: "Gobierno del dato",
    area: "EU AI Act",
    detail: "Calidad, linaje, sesgo, representatividad y control de datasets.",
    route: "/ai-governance/evaluaciones",
    source: "ninguna",
  },
  {
    id: "transparency-user-information",
    label: "Transparencia e información al usuario",
    area: "EU AI Act",
    detail: "Información a usuarios, instrucciones de uso, explicación y avisos.",
    route: "/ai-governance/evaluaciones",
    source: "ninguna",
  },
  {
    id: "human-oversight",
    label: "Supervisión humana",
    area: "EU AI Act",
    detail: "Human-in-the-loop, intervención, override y responsabilidades operativas.",
    route: "/ai-governance/evaluaciones",
    source: "aims_technical_file_sections",
  },
  {
    id: "accuracy-robustness-cybersecurity",
    label: "Precisión, robustez y ciberseguridad",
    area: "EU AI Act",
    detail: "Rendimiento, resiliencia, drift, seguridad y fallos materiales.",
    route: "/ai-governance/incidentes",
    source: "aims_technical_file_sections",
  },
  {
    id: "provider-vendor-third-party",
    label: "Proveedor y terceros",
    area: "Operativo AIMS",
    detail: "Evaluación del proveedor y de la cadena de suministro; el nombre del proveedor en la ficha no la acredita.",
    route: "/ai-governance/sistemas",
    source: "ninguna",
    handoff: "AIMS_VENDOR_CONTEXT",
  },
  {
    id: "post-market-monitoring",
    label: "Post-market monitoring",
    area: "EU AI Act",
    detail: "Seguimiento operativo, causa raíz, acciones correctivas e incidentes recurrentes.",
    route: "/ai-governance/incidentes",
    source: "aims_monitoring_indicators",
  },
  {
    id: "incident-reporting-escalation",
    label: "Reporting de incidentes y escalado",
    area: "Cross-module",
    detail: "Incidentes materiales con posible derivación a GRC o escalado formal a Secretaría.",
    route: "/ai-governance/incidentes",
    source: "ai_incidents",
    handoff: "AIMS_INCIDENT_MATERIAL",
  },
  {
    id: "fundamental-rights-dpia",
    label: "Derechos fundamentales / DPIA",
    area: "Cross-module",
    detail: "Impacto sobre personas, privacidad, no discriminación y enlace con GDPR cuando proceda.",
    route: "/ai-governance/evaluaciones",
    source: "ninguna",
    handoff: "AIMS_GDPR_CONTEXT",
  },
  {
    id: "iso-42001-management-system",
    label: "Sistema de gestión ISO 42001",
    area: "ISO 42001",
    detail: "Políticas, objetivos, mejora continua, auditoría interna y revisión de dirección.",
    route: "/ai-governance/evaluaciones",
    source: "ai_risk_assessments",
  },
  {
    id: "evidence-recordkeeping",
    label: "Evidencia y recordkeeping",
    area: "Operativo AIMS",
    detail: "Referencias, evidencias operativas y límites probatorios explícitos.",
    route: "/ai-governance/evaluaciones",
    source: "ninguna",
  },
];

/** Comprobaciones del monitor, por el código del requisito (`mapa-monitores`), nunca por el texto. */
function checksForDefinition(checks: AimsComplianceCheckLike[], definition: MonitorDefinition) {
  return checks.filter((check) => monitorDeCodigo(check.requirement_code) === definition.id);
}

/** Conforme Y no de legado: una comprobación de legado se cuenta, pero no acredita. */
function checkAcredita(check: AimsComplianceCheckLike): boolean {
  return !check.codigo_legado && COMPLIANT_STATUSES.has(normalizeAimsStatus(check.status));
}

function statusFromChecks(checks: AimsComplianceCheckLike[]): AimsReadinessStatus | null {
  if (checks.length === 0) return null;
  const statuses = checks.map((check) => (check.codigo_legado && !GAP_STATUSES.has(normalizeAimsStatus(check.status)) ? "PENDIENTE" : normalizeAimsStatus(check.status)));
  if (statuses.some((status) => GAP_STATUSES.has(status))) return "gap";
  if (statuses.every((status) => COMPLIANT_STATUSES.has(status))) return "ready";
  if (statuses.some((status) => WATCH_STATUSES.has(status))) return "watch";
  return "watch";
}

/**
 * Lectura de secciones. `anexoCompleto`: sólo es Listo si cada sistema con
 * expediente tiene las nueve secciones del anexo IV acreditadas — cuatro de
 * nueve, aunque las cuatro acrediten, no son un expediente.
 */
function medirSecciones(
  secciones: AimsSectionLike[],
  anexoCompleto: boolean,
): { status: AimsReadinessStatus; metric: string } | null {
  if (secciones.length === 0) return null;
  const acreditadas = secciones.filter(seccionAcredita);
  const metric = `${acreditadas.length}/${secciones.length} secciones con revisor`;
  if (secciones.some((s) => normalizarEstadoSeccion(s.status) === "NON_CONFORMING")) return { status: "gap", metric };
  const completo =
    !anexoCompleto ||
    [...new Set(secciones.map((s) => s.system_id))].every((id) =>
      ANEXO_IV_SECCIONES.every((a) => acreditadas.some((s) => s.system_id === id && s.section_code === a.code)),
    );
  return { status: acreditadas.length === secciones.length && completo ? "ready" : "watch", metric };
}

function fallbackMonitorStatus(
  definition: MonitorDefinition,
  input: AimsReadinessInput,
): { status: AimsReadinessStatus; metric: string } {
  const { systems, assessments, incidents } = input;
  // Cada monitor lee su objeto, y sólo el de los sistemas que se están mirando.
  const ids = new Set(systems.map((system) => system.id));
  const secciones = (input.technicalFileSections ?? []).filter((s) => s.system_id && ids.has(s.system_id));
  const indicadores = (input.monitoringIndicators ?? []).filter((i) => i.system_id && ids.has(i.system_id));
  const seccion = (code: string) => secciones.filter((s) => s.section_code === code);
  const totalSystems = systems.length;
  const highRiskSystems = systems.filter((system) => system.risk_level === "Alto");
  // Cubierto = su evaluación vigente (la más reciente no borrador) acredita.
  const cubiertos = sistemasCubiertos(assessments);
  const highRiskAssessed = highRiskSystems.filter((system) => cubiertos.has(system.id)).length;
  const materialIncidents = incidents.filter(isAimsMaterialIncidentCandidate).length;
  const conClasificacionGuiada = systems.filter(tieneClasificacionGuiada).length;
  const isoAssessments = evaluacionesVigentes(assessments).filter((assessment) => assessment.framework === "ISO_42001");
  const approvedIsoAssessments = isoAssessments.filter(evaluacionAcredita).length;

  switch (definition.id) {
    case "inventory-classification":
      return {
        status: domainStatus(pct(conClasificacionGuiada, totalSystems), 50, 80),
        metric: totalSystems === 0 ? "0 sistemas" : `${conClasificacionGuiada}/${totalSystems} con clasificación guiada`,
      };
    // El nivel «Inaceptable» de la ficha no es un análisis del art. 5, y ese
    // valor ya no lo escribe ningún camino. Hasta que el análisis exista, no se
    // afirma nada.
    case "prohibited-practices":
      return { status: "unmeasured", metric: "Sin análisis del art. 5" };
    case "high-risk-obligations":
      return {
        status: highRiskSystems.length === 0 ? "na" : domainStatus(pct(highRiskAssessed, highRiskSystems.length), 50, 100),
        metric: highRiskSystems.length === 0 ? "Sin sistemas de alto riesgo" : `${highRiskAssessed}/${highRiskSystems.length} alto riesgo`,
      };
    // Expediente: sus secciones. Precisión: la del anexo IV.4 (métricas de
    // rendimiento). Supervisión: la del anexo IV.3 (supervisión, funcionamiento
    // y control). Sin la sección, «no medido»: ya no se cae a incidentes.
    case "technical-documentation":
      return medirSecciones(secciones, true) ?? { status: "unmeasured", metric: "Sin expediente técnico" };
    case "accuracy-robustness-cybersecurity":
      return medirSecciones(seccion("AIV-04"), false) ?? { status: "unmeasured", metric: "Sin sección del anexo IV.4" };
    case "human-oversight":
      return medirSecciones(seccion("AIV-03"), false) ?? { status: "unmeasured", metric: "Sin sección del anexo IV.3" };
    case "incident-reporting-escalation":
      return {
        status: incidents.length === 0 ? "unmeasured" : materialIncidents === 0 ? "ready" : materialIncidents <= 2 ? "watch" : "gap",
        metric: incidents.length === 0 ? "Sin incidentes registrados" : `${materialIncidents} materiales`,
      };
    // Indicadores. `status` no se lee (nace «OK» sin medir): mide quien tiene
    // valor. Con valor y sin umbral evaluado, vigilancia — nunca Listo.
    case "post-market-monitoring": {
      if (indicadores.length === 0) return { status: "unmeasured", metric: "Sin indicadores de vigilancia" };
      const medidos = indicadores.filter((i) => i.current_value !== null && i.current_value !== undefined).length;
      return medidos === 0
        ? { status: "unmeasured", metric: `${indicadores.length} indicadores sin medición` }
        : { status: "watch", metric: `${medidos}/${indicadores.length} indicadores con medición` };
    }
    // Registro: su objeto es el protocolo de conservación de registros, que
    // todavía no existe como dato. Sin él, «no medido».
    case "evidence-recordkeeping":
      return { status: "unmeasured", metric: "Sin protocolo de registro" };
    case "iso-42001-management-system":
      return {
        status: isoAssessments.length === 0 ? "unmeasured" : domainStatus(pct(approvedIsoAssessments, isoAssessments.length), 50, 80),
        metric: isoAssessments.length === 0 ? "Sin evaluaciones ISO 42001" : `${approvedIsoAssessments}/${isoAssessments.length} acreditadas`,
      };
    // Sin comprobaciones con el código del área no hay nada medido: que exista
    // alguna evaluación del sistema no dice nada de ESTA área. Terceros entra
    // aquí: tener el proveedor escrito en la ficha no es haber evaluado al
    // tercero.
    case "provider-vendor-third-party":
    default:
      return { status: "unmeasured", metric: "Sin comprobaciones del área" };
  }
}

/** Códigos de los catálogos RIA (proveedor y desplegador): fuera de ellos no hay «otro catálogo RIA». */
const CODIGOS_RIA = new Set([...AESIA_RIA_REQUIREMENTS, ...DESPLIEGUE_REQUIREMENTS].map((r) => r.code));

/**
 * Aparta las comprobaciones medidas contra un catálogo RIA que no es el del
 * sistema. Sólo se aparta con clasificación guiada (`tieneClasificacionGuiada`):
 * sin cuestionario no se sabe cuál es su catálogo y todo cuenta (fail-open).
 * Un código de otro marco (ISO 42001) no se midió contra ningún catálogo RIA
 * y sigue contando: mismo criterio que `evaluadaContraOtroCatalogo`.
 */
export function apartarChecksDeOtroCatalogo(systems: AimsSystemLike[], checks: AimsComplianceCheckLike[]) {
  const codigosPorSistema = new Map<string, Set<string>>();
  for (const system of systems) {
    if (tieneClasificacionGuiada(system)) codigosPorSistema.set(system.id, codigosDelPerfil(system, AESIA_RIA_REQUIREMENTS));
  }
  const medibles: AimsComplianceCheckLike[] = [];
  const otroCatalogo: AimsComplianceCheckLike[] = [];
  for (const check of checks) {
    const code = check.requirement_code ?? "";
    const codigos = check.system_id ? codigosPorSistema.get(check.system_id) : undefined;
    (codigos && CODIGOS_RIA.has(code) && !codigos.has(code) ? otroCatalogo : medibles).push(check);
  }
  return { medibles, otroCatalogo };
}

export function buildAimsComplianceMonitors(input: AimsReadinessInput): AimsComplianceMonitorDomain[] {
  // El legado se LEE con su código vigente (sin tocar la fila) y, tras
  // traducirlo, manda la comprobación más reciente de cada requisito.
  const traducidas = checksVigentes((input.complianceChecks ?? []).map(traducirLegado));
  const { medibles: checks, otroCatalogo } = apartarChecksDeOtroCatalogo(input.systems, traducidas);
  return complianceMonitorDefinitions.map((definition) => {
    const matchingChecks = checksForDefinition(checks, definition);
    const checkedStatus = statusFromChecks(matchingChecks);
    const fallback = fallbackMonitorStatus(definition, input);
    const status = checkedStatus ?? fallback.status;
    const legado = matchingChecks.filter((check) => check.codigo_legado).length;
    const metric = matchingChecks.length > 0
      ? `${matchingChecks.filter(checkAcredita).length}/${matchingChecks.length} conformes${legado > 0 ? ` · ${legado} de legado, no acredita` : ""}`
      : fallback.metric;

    return {
      id: definition.id,
      label: definition.label,
      area: definition.area,
      status,
      metric,
      detail: definition.detail,
      route: definition.route,
      source: matchingChecks.length > 0 ? "ai_compliance_checks" : definition.source,
      handoff: definition.handoff,
      otroCatalogo: checksForDefinition(otroCatalogo, definition).length,
    };
  });
}

/** El mismo monitor, sistema a sistema: cada uno sólo con sus comprobaciones, evaluaciones e incidentes. */
export function buildAimsComplianceMonitorsPorSistema(
  input: AimsReadinessInput,
): Record<string, AimsComplianceMonitorDomain[]> {
  const delSistema = <T extends { system_id?: string | null }>(rows: T[] | undefined, id: string) =>
    (rows ?? []).filter((row) => row.system_id === id);
  return Object.fromEntries(
    input.systems.map((system) => [
      system.id,
      buildAimsComplianceMonitors({
        systems: [system],
        assessments: delSistema(input.assessments, system.id),
        incidents: delSistema(input.incidents, system.id),
        complianceChecks: delSistema(input.complianceChecks, system.id),
        technicalFileSections: delSistema(input.technicalFileSections, system.id),
        monitoringIndicators: delSistema(input.monitoringIndicators, system.id),
      }),
    ]),
  );
}

/**
 * Siguientes pasos, derivados del dato disponible (F1.T8). Sustituye a la lista
 * fija que decía lo mismo con cualquier inventario. Sólo aparece lo que el dato
 * señala, con su cuenta y su pantalla.
 */
function pasosDelDato(n: {
  totalSystems: number;
  sinClasificar: number;
  sinFirmar: number;
  altoSinAcreditar: number;
  abiertos: number;
  conBrechas: number;
}): AimsPaso[] {
  if (n.totalSystems === 0) {
    return [{ label: "Dar de alta un sistema IA", detalle: "Sin sistemas en el inventario.", to: "/ai-governance/sistemas/nuevo" }];
  }
  const pasos: Array<AimsPaso | false> = [
    n.sinClasificar > 0 && {
      label: "Clasificar con el cuestionario guiado",
      detalle: `${n.sinClasificar} sistemas sin clasificación guiada completada.`,
      to: "/ai-governance/sistemas",
    },
    n.sinFirmar > 0 && {
      label: "Congelar y revisar autodiagnósticos",
      detalle: `${n.sinFirmar} autodiagnósticos vigentes sin congelar y revisar: no acreditan.`,
      to: "/ai-governance/evaluaciones",
    },
    n.altoSinAcreditar > 0 && {
      label: "Acreditar los sistemas de alto riesgo",
      detalle: `${n.altoSinAcreditar} sistemas de alto riesgo sin autodiagnóstico acreditado.`,
      to: "/ai-governance/evaluaciones",
    },
    n.abiertos > 0 && {
      label: "Seguir los incidentes",
      detalle: `${n.abiertos} incidentes abiertos o en investigación.`,
      to: "/ai-governance/incidentes",
    },
    n.conBrechas > 0 && {
      label: "Proponer riesgo a GRC",
      detalle: `${n.conBrechas} autodiagnósticos con brechas que pueden derivarse a GRC (solo lectura).`,
      to: "/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP",
    },
  ];
  return pasos.filter((paso): paso is AimsPaso => Boolean(paso));
}

export function buildAimsReadiness(input: AimsReadinessInput): AimsReadinessSummary {
  const { systems, assessments, incidents } = input;
  const totalSystems = systems.length;
  const cubiertos = sistemasCubiertos(assessments);
  const highRiskSystems = systems.filter((system) => system.risk_level === "Alto");
  const highRiskAssessed = highRiskSystems.filter((system) => cubiertos.has(system.id)).length;
  const openIncidents = incidents.filter((incident) => !incidenteCerrado(incident)).length;
  const incidentesCerrados = incidents.filter(incidenteCerrado).length;
  const conClasificacionGuiada = systems.filter(tieneClasificacionGuiada).length;
  // Sólo la última evaluación no borrador de cada sistema y marco: los
  // borradores y las repeticiones no son hallazgos vigentes.
  const vigentes = evaluacionesVigentes(assessments);
  const findings = vigentes.flatMap((assessment) => assessment.findings ?? []);
  // Hallazgos de evaluaciones sin congelar y revisar: se cuentan, pero no
  // pueden llevar «Controles» a Listo (acredita sólo lo congelado y revisado).
  const sinFirmar = vigentes
    .filter((assessment) => !evaluacionFirme(assessment))
    .flatMap((assessment) => assessment.findings ?? [])
    .filter((finding) => finding.code || finding.status).length;
  const controlFindings = findings.filter((finding) => finding.code || finding.status);
  // El vocabulario que el producto ESCRIBE en `findings[].status` es el nivel
  // de madurez (`L1`…`L8`), no una palabra de estado: `buildEvaluationPayload`
  // guarda `estado.maturity` tal cual. Con la lista literal de abajo, una
  // evaluación contestada entera en L5 daba «0 cerrados» y arrastraba el
  // dominio «Controles» a demo-con-gaps para siempre. Los niveles que acreditan
  // conformidad se traen del propio camino de escritura, no se recopian aquí.
  const closedControlFindings = controlFindings.filter((finding) => {
    const st = normalizeAimsStatus(finding.status);
    if (["CERRADO", "APROBADO", "CONFORME", "OK"].includes(st)) return true;
    // Mismo criterio que el wizard y que el payload: `L8` sin justificación no
    // cierra nada, ni `L5` sin evidencia (F1.T5). Se pasan la justificación y
    // el recuento de evidencia, que la regla necesita.
    return acreditaConformidad({ status: st, justification: finding.justification, evidenceCount: finding.evidenceCount });
  }).length;

  const inventoryCoverage = pct(conClasificacionGuiada, totalSystems);
  const assessmentCoverage = pct(highRiskAssessed, highRiskSystems.length);
  const incidentClosureCoverage = pct(incidentesCerrados, incidents.length);
  const controlCoverage = pct(closedControlFindings, controlFindings.length);

  const domains: AimsReadinessDomain[] = [
    {
      id: "inventory",
      hasData: systems.length > 0,
      label: "Inventario",
      status: domainStatus(inventoryCoverage, 50, 80),
      metric: totalSystems === 0 ? "0 sistemas" : `${conClasificacionGuiada}/${totalSystems} con clasificación guiada`,
      detail: "Registro operativo de sistemas IA, clasificados por cuestionario guiado completado.",
      route: "/ai-governance/sistemas",
    },
    {
      id: "ai-act-assessments",
      hasData: assessments.length > 0,
      label: "Autodiagnóstico de madurez · alto riesgo",
      status: highRiskSystems.length === 0 ? "na" : domainStatus(assessmentCoverage, 50, 100),
      metric: highRiskSystems.length === 0 ? "Sin sistemas de alto riesgo" : `${highRiskAssessed}/${highRiskSystems.length} alto riesgo`,
      detail: "Sistemas de alto riesgo cuyo autodiagnóstico vigente está congelado, revisado y conforme.",
      route: "/ai-governance/evaluaciones",
    },
    {
      id: "incidents",
      hasData: incidents.length > 0,
      label: "Incidentes",
      // Sin un solo incidente registrado no se sabe si hay incidencias: es
      // ausencia de dato, no conformidad.
      status: incidents.length === 0 ? "unmeasured" : openIncidents === 0 ? "ready" : openIncidents <= 2 ? "watch" : "gap",
      metric: incidents.length === 0 ? "Sin incidentes registrados" : `${openIncidents} abiertos`,
      detail: "Registro de severidad, investigación, causa raíz y acción correctiva.",
      route: "/ai-governance/incidentes",
    },
    {
      id: "controls",
      hasData: controlFindings.length > 0,
      label: "Controles",
      status:
        controlFindings.length === 0
          ? "unmeasured"
          : domainStatus(controlCoverage, 40, 75) === "ready" && sinFirmar > 0
            ? "watch"
            : domainStatus(controlCoverage, 40, 75),
      metric:
        controlFindings.length === 0
          ? "Sin hallazgos de evaluación"
          : `${closedControlFindings}/${controlFindings.length} cerrados${sinFirmar > 0 ? ` · ${sinFirmar} sin congelar y revisar` : ""}`,
      detail: "Hallazgos de la última evaluación no borrador de cada sistema; no crea controles paralelos.",
      route: "/ai-governance/evaluaciones",
    },
    {
      id: "operational-evidence",
      hasData: incidents.length > 0,
      label: "Evidencias operativas",
      // 0/0: sin incidentes no hay nada que cerrar — gris, no brecha.
      status: incidents.length === 0 ? "na" : domainStatus(incidentClosureCoverage, 50, 80),
      metric: incidents.length === 0 ? "Sin incidentes que cerrar" : metricaCierre(incidents),
      detail: "Evidencia funcional para demo; no se presenta como evidencia probatoria final.",
      route: "/ai-governance/incidentes",
    },
    {
      id: "migration",
      hasData: false,
      label: "Backbone técnico",
      status: "watch",
      // No se mide desde aquí: `buildAimsReadiness` sólo recibe `ai_*`.
      // Antes afirmaba "Sin schema nuevo", que además era falso — las tablas
      // `aims_*` del backbone existen desde abril.
      metric: "No medido",
      detail: "Postura sobre el inventario legado; el estado del backbone técnico no se mide en este resumen.",
      route: "/ai-governance",
    },
  ];
  const complianceMonitors = buildAimsComplianceMonitors(input);

  return {
    sourcePosture: "legacy-ai",
    contractId: "aims-p0-readiness",
    sourceTables: ["ai_systems", "ai_risk_assessments", "ai_incidents"],
    migrationPath: "Read model ai_* en este resumen; el expediente técnico ya lee y escribe aims_* fuera de él.",
    // No se declara operable sobre la ausencia de dato: además de no tener
    // brechas, todo dominio tiene que apoyarse en algún dato. Antes bastaba
    // con que ninguno fuera "gap", y "watch" es justo el marcador de
    // "no tengo dato" — cuatro dominios diciendo eso se compactaban en un
    // tick verde de "Demo operable".
    // `migration` queda fuera del cómputo: es una nota de postura sobre el
    // backbone, no un dominio de cumplimiento con dato propio, y por eso su
    // `hasData` es false por definición.
    standaloneReady: domains
      .filter((domain) => domain.id !== "migration")
      .every((domain) => domain.status !== "gap" && domain.hasData),
    domains,
    complianceMonitors,
    nextSteps: pasosDelDato({
      totalSystems,
      sinClasificar: totalSystems - conClasificacionGuiada,
      sinFirmar: vigentes.filter((assessment) => !evaluacionFirme(assessment)).length,
      altoSinAcreditar: highRiskSystems.length - highRiskAssessed,
      abiertos: openIncidents,
      conBrechas: vigentes.filter(isAimsTechnicalFileGapCandidate).length,
    }),
  };
}

export function filterSystemsByScope<T extends { name: string; description?: string | null }>(
  systems: T[],
  _scope: string,
): T[] {
  // MINA DESACTIVADA (A5, 2026-08-29): esta función recortaba el inventario
  // buscando `auto`, `siniestros`, `salud`, `fraude`, `motor`, `suscripción` y
  // `patrimonial` en el nombre y la descripción. Con un inventario que no fuera
  // asegurador devolvía cero sistemas — medido: 3 de 3 sistemas de despacho
  // desaparecían en el ámbito "España".
  //
  // CORRECCIÓN (review A5): NO era una mina latente, estaba ARMADA. Se creyó
  // inofensiva porque `branding.scopes` es NULL en los dos tenants, pero
  // `scopesForTenant` (`src/lib/tenant-scopes.ts:14`) devuelve `ARGA_SCOPES`
  // justamente cuando el branding es NULL, y `src/data/scopes.ts` incluye
  // "España", "LATAM", "Europa", "Brasil" y "México". Es decir: en ARGA el
  // recorte por vocabulario se disparaba de verdad y ocultaba EN SILENCIO
  // cualquier sistema cuyo nombre no contuviera esas palabras.
  //
  // `ai_systems` no tiene columna de jurisdicción ni de ámbito: no hay nada por
  // lo que filtrar. Cuando la haya, se filtra por el dato declarado, nunca por
  // palabras del nombre.
  return systems;
}

