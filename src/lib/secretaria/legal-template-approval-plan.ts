import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

export type LegalTemplateApprovalDecision = "APROBADA" | "APROBADA_CON_VARIANTES";

export interface LegalTemplateApprovalPlanItem {
  key: string;
  decision: LegalTemplateApprovalDecision;
  label: string;
  proposedVersion: string;
  summary: string;
  variantRequired?: string;
  variablesToAdd?: string[];
  capa3ToChange?: string[];
  notes?: string;
  matcher: {
    tipo: string | string[];
    materia?: string | string[];
    adoptionMode?: string | string[];
    organo?: string | string[];
  };
}

export interface LegalTemplateApprovalReportSummary {
  source: string;
  date: string;
  approvedBy: string;
  matrixRows: number;
  approved: number;
  approvedWithVariants: number;
  supportDocumentsApproved: number;
  supersedes: string;
}

export const LEGAL_TEMPLATE_APPROVAL_REPORT_SUMMARY: LegalTemplateApprovalReportSummary = {
  source: "/Users/moisesmenendez/Downloads/Legal_Review_of_Corporate_Templates (1).docx",
  date: "2026-05-01",
  approvedBy: "Comite Legal ARGA",
  matrixRows: 33,
  approved: 10,
  approvedWithVariants: 23,
  supportDocumentsApproved: 2,
  supersedes: "/Users/moisesmenendez/Downloads/Legal_Review_of_Corporate_Templates.docx",
};

const agreementTraceVariables = ["agreement_id", "snapshot_hash", "resultado_gate"];

function item(
  key: string,
  decision: LegalTemplateApprovalDecision,
  proposedVersion: string,
  summary: string,
  matcher: LegalTemplateApprovalPlanItem["matcher"],
  extra: Partial<Omit<LegalTemplateApprovalPlanItem, "key" | "decision" | "label" | "proposedVersion" | "summary" | "matcher">> = {},
): LegalTemplateApprovalPlanItem {
  return {
    key,
    decision,
    label: decision === "APROBADA" ? "Aprobada legal" : "Aprobada con variantes",
    proposedVersion,
    summary,
    matcher,
    ...extra,
  };
}

export const LEGAL_TEMPLATE_APPROVAL_PLAN: LegalTemplateApprovalPlanItem[] = [
  item(
    "informe-documental-pre",
    "APROBADA",
    "1.0.1",
    "Informe PRE cerrado como documento de apoyo demo-operativo; no es acta, certificacion, documento registral ni evidencia final productiva.",
    { tipo: "INFORME_DOCUMENTAL_PRE", materia: "EXPEDIENTE_PRE" },
    {
      variablesToAdd: ["EXPEDIENTE.expediente_id", "EXPEDIENTE.checklist_estado_resumen", "MOTOR.snapshot_hash"],
      capa3ToChange: ["checklist_detalle", "alertas_detalle", "observaciones_operativas"],
    },
  ),
  item(
    "informe-preceptivo",
    "APROBADA",
    "1.0.1",
    "Informe preceptivo interno cerrado como apoyo a convocatoria; no sustituye la revision legal real ni acredita publicacion productiva.",
    { tipo: "INFORME_PRECEPTIVO", materia: "CONVOCATORIA_PRE" },
    {
      variablesToAdd: ["REUNION.orden_del_dia_resumen", "MOTOR.verificacion_convocatoria_resumen", "MOTOR.verificacion_info_resumen"],
      capa3ToChange: ["evidencias_convocatoria", "incidencias_previas", "recomendaciones"],
    },
  ),
  item(
    "acta-sesion-junta",
    "APROBADA_CON_VARIANTES",
    "1.1.0",
    "Acta de Junta General aprobada para el prototipo con convocatoria/universalidad, asistentes, quorum, mayorias, proclamacion por punto, pactos y conflictos.",
    { tipo: "ACTA_SESION", adoptionMode: "MEETING", organo: "JUNTA_GENERAL" },
    {
      variantRequired: "Universal / primera-segunda convocatoria / telematica / cotizada.",
      variablesToAdd: ["orden_dia", "lista_asistentes", "capital_presente", "derechos_voto", ...agreementTraceVariables],
      capa3ToChange: ["deliberaciones", "proclamacion_por_punto", "conflictos", "pactos"],
    },
  ),
  item(
    "acta-sesion-consejo",
    "APROBADA_CON_VARIANTES",
    "1.1.0",
    "Acta de Consejo aprobada para el prototipo con quorum, mayoria, voto de calidad si aplica, representacion, indelegables, pactos y conflictos.",
    { tipo: "ACTA_SESION", adoptionMode: "MEETING", organo: "CONSEJO_ADMIN" },
    {
      variantRequired: "Voto de calidad / telefonica / mixta / cotizada.",
      variablesToAdd: ["lista_consejeros", "quorum_consejo", "mayoria_requerida", ...agreementTraceVariables],
      capa3ToChange: ["asistentes", "constitucion", "votacion", "acuerdos"],
    },
  ),
  item(
    "certificacion",
    "APROBADA_CON_VARIANTES",
    "1.2.0",
    "Certificacion transversal aprobada con base documental, modo de adopcion, organo certificante y acuerdo certificado enlazado a agreements.id.",
    { tipo: "CERTIFICACION" },
    {
      variantRequired: "Base documental acta ordinaria o acta notarial; salida inscribible cuando proceda.",
      variablesToAdd: ["modo_adopcion", "texto_acuerdo_certificado", "fecha_adopcion", "firma_qes_ref", "tsq_token", "agreement_id"],
      capa3ToChange: ["transcripcion_acuerdo", "datos_certificante", "manifestacion_vigencia"],
    },
  ),
  item(
    "convocatoria-general",
    "APROBADA_CON_VARIANTES",
    "1.1.0",
    "Convocatoria aprobada con organo convocante, orden del dia, derecho de informacion, documentacion disponible y carril cotizada.",
    { tipo: "CONVOCATORIA" },
    {
      variantRequired: "SA / SL / cotizada.",
      variablesToAdd: ["organo_convocante", "fecha_hora", "lugar", "orden_dia", "texto_derecho_informacion", "canal_convocatoria"],
    },
  ),
  item(
    "convocatoria-sl-notificacion",
    "APROBADA_CON_VARIANTES",
    "1.1.0",
    "Notificacion individual de convocatoria SL aprobada con canal, envio, acuse y trazabilidad; incompatible con carril cotizada.",
    { tipo: "CONVOCATORIA_SL_NOTIFICACION", materia: ["NOTIFICACION_CONVOCATORIA_SL", "CONVOCATORIAS_JUNTAS"] },
    {
      variantRequired: "Canal / envio / acuse.",
      variablesToAdd: ["lista_socios_notificados", "canal_notificacion", "acuse_recibo_ref", "fecha_envio"],
    },
  ),
  item(
    "acta-consignacion-socio-unico",
    "APROBADA_CON_VARIANTES",
    "1.1.0",
    "Decision de socio unico aprobada con constancia de consignacion, diferenciacion SLU/SAU y salida a certificacion si procede.",
    { tipo: "ACTA_CONSIGNACION", adoptionMode: "UNIPERSONAL_SOCIO" },
    {
      variantRequired: "SLU / SAU.",
      variablesToAdd: ["identidad_decisor", "porcentaje_capital", ...agreementTraceVariables],
      capa3ToChange: ["texto_decision", "manifestacion_socio_unico"],
    },
  ),
  item(
    "acta-consignacion-admin-unico",
    "APROBADA_CON_VARIANTES",
    "1.1.0",
    "Decision de administrador unico aprobada sin invadir competencias de junta, con competencia, conflictos y salida a certificacion si procede.",
    { tipo: "ACTA_CONSIGNACION", adoptionMode: "UNIPERSONAL_ADMIN" },
    {
      variablesToAdd: ["identidad_decisor", "cargo_decisor", ...agreementTraceVariables],
      capa3ToChange: ["texto_decision", "fundamentos", "conflictos"],
    },
  ),
  item(
    "acta-acuerdo-escrito",
    "APROBADA_CON_VARIANTES",
    "1.2.0",
    "Acuerdo sin sesion aprobado para unanimidad de socios y circulacion escrita de consejo; la oposicion bloquea el cierre.",
    { tipo: "ACTA_ACUERDO_ESCRITO", adoptionMode: "NO_SESSION" },
    {
      variantRequired: "Consejo por escrito / socios unanimidad.",
      variablesToAdd: ["fecha_cierre", "relacion_respuestas", "firma_qes_ref", ...agreementTraceVariables],
      capa3ToChange: ["propuesta", "sentido_voto", "fechas", "anexos", "conflictos"],
    },
  ),
  item(
    "acta-decision-conjunta",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Decision conjunta aprobada para coaprobacion con coaprobadores, regla de actuacion conjunta, cierre, snapshot del motor y agreements.id.",
    { tipo: "ACTA_DECISION_CONJUNTA", adoptionMode: "CO_APROBACION" },
    {
      variantRequired: "Regla conjunta segun fuente estatutaria o interna.",
      variablesToAdd: ["administradores_intervinientes", "regla_actuacion", "fecha_cierre", ...agreementTraceVariables],
      capa3ToChange: ["acuerdos", "conflictos", "firmas", "expediente_electronico"],
    },
  ),
  item(
    "acta-organo-admin-solidario",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Decision de administrador solidario aprobada con administrador actuante, base de facultad, comunicacion interna, conflictos, snapshot y agreements.id.",
    { tipo: "ACTA_ORGANO_ADMIN", adoptionMode: "SOLIDARIO" },
    {
      variantRequired: "Comunicacion interna.",
      variablesToAdd: ["administrador_actuante", "facultad_actuacion", ...agreementTraceVariables],
      capa3ToChange: ["decision", "comunicaciones", "conflictos", "expediente_electronico"],
    },
  ),
  item(
    "modelo-aprobacion-cuentas",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Aprobacion de cuentas, gestion social y aplicacion de resultado aprobada para Junta General, con soporte de deposito y carril cotizada.",
    { tipo: "MODELO_ACUERDO", materia: "APROBACION_CUENTAS", adoptionMode: "MEETING", organo: "JUNTA_GENERAL" },
    {
      variantRequired: "SA / SL / cotizada.",
      variablesToAdd: ["ejercicio", "resultado", "propuesta_aplicacion", "estado_auditoria", "auditor"],
      capa3ToChange: ["anexo_cuentas", "informe_auditor", "aplicacion_resultado_texto"],
    },
  ),
  item(
    "modelo-formulacion-cuentas",
    "APROBADA",
    "1.0.0",
    "Formulacion de cuentas aprobada como competencia del organo de administracion, separada de la aprobacion por Junta.",
    { tipo: "MODELO_ACUERDO", materia: "FORMULACION_CUENTAS" },
  ),
  item(
    "modelo-distribucion-dividendos",
    "APROBADA",
    "1.0.0",
    "Distribucion de dividendos aprobada con limites de patrimonio neto, reserva legal, importe, fecha de pago y conflictos.",
    { tipo: "MODELO_ACUERDO", materia: "DISTRIBUCION_DIVIDENDOS", organo: "JUNTA_GENERAL" },
  ),
  item(
    "modelo-delegacion-facultades",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Delegacion de facultades aprobada para Consejo, con consejero delegado/comision ejecutiva, limites indelegables, quorum reforzado e inscripcion.",
    { tipo: "MODELO_ACUERDO", materia: "DELEGACION_FACULTADES", organo: "CONSEJO_ADMIN" },
    {
      variantRequired: "Consejero delegado / comision ejecutiva.",
      variablesToAdd: ["alcance_delegacion", "facultades_indelegables", "quorum_2_3", "inscripcion_RM"],
      capa3ToChange: ["facultades", "regimen_actuacion"],
    },
  ),
  item(
    "modelo-autorizacion-garantia",
    "APROBADA",
    "1.0.0",
    "Autorizacion de garantia aprobada como nomenclatura canonica; GARANTIA_PRESTAMO queda solo como alias legacy con warning.",
    { tipo: "MODELO_ACUERDO", materia: "AUTORIZACION_GARANTIA" },
    {
      variablesToAdd: ["beneficiario", "importe", "contrato_principal", "interes_social", "conflictos"],
      notes: "GARANTIA_PRESTAMO no debe promocionarse como materia canonica.",
    },
  ),
  item(
    "modelo-operacion-vinculada",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Operacion vinculada aprobada con identificacion de parte vinculada, abstencion, soporte de mercado, informe y derivacion a Junta por umbral.",
    { tipo: "MODELO_ACUERDO", materia: "OPERACION_VINCULADA" },
    {
      variantRequired: "Cotizada / no cotizada / derivacion a Junta por umbral.",
      variablesToAdd: ["parte_vinculada", "naturaleza_vinculacion", "soporte_mercado", "abstencion_afectado"],
      capa3ToChange: ["anexo_valoracion", "informe_interno", "conflictos"],
    },
  ),
  item(
    "modelo-aumento-capital",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Aumento de capital aprobado con modalidades, derecho preferente, tipo de aumento, ejecucion, texto integro y salida registral.",
    { tipo: "MODELO_ACUERDO", materia: "AUMENTO_CAPITAL", organo: "JUNTA_GENERAL" },
    { variantRequired: "Modalidades y delegacion." },
  ),
  item(
    "modelo-reduccion-capital",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Reduccion de capital aprobada con finalidad, procedimiento, proteccion de acreedores, publicidad y datos registrales minimos.",
    { tipo: "MODELO_ACUERDO", materia: "REDUCCION_CAPITAL", organo: "JUNTA_GENERAL" },
    { variantRequired: "Finalidad / procedimiento." },
  ),
  item(
    "modelo-modificacion-estatutos",
    "APROBADA",
    "1.0.0",
    "Modificacion de estatutos aprobada con texto integro, derecho de examen, mayorias, escritura e inscripcion.",
    { tipo: "MODELO_ACUERDO", materia: "MODIFICACION_ESTATUTOS", organo: "JUNTA_GENERAL" },
  ),
  item(
    "modelo-nombramiento-auditor",
    "APROBADA",
    "1.0.0",
    "Nombramiento de auditor aprobado con plazo, aceptacion, suplente y salida registral.",
    { tipo: "MODELO_ACUERDO", materia: "NOMBRAMIENTO_AUDITOR", organo: "JUNTA_GENERAL" },
  ),
  item(
    "modelo-nombramiento-administrador-junta",
    "APROBADA",
    "1.0.0",
    "Nombramiento de administrador por Junta aprobado con aceptacion, duracion, manifestaciones de incompatibilidad e inscripcion.",
    { tipo: "MODELO_ACUERDO", materia: ["NOMBRAMIENTO_ADMINISTRADOR_JUNTA", "NOMBRAMIENTO_CONSEJERO"], organo: "JUNTA_GENERAL" },
    { notes: "La materia canonica final es NOMBRAMIENTO_ADMINISTRADOR_JUNTA." },
  ),
  item(
    "modelo-cooptacion-consejo",
    "APROBADA",
    "1.0.0",
    "Cooptacion por Consejo aprobada como carril separado del nombramiento ordinario por Junta y sujeta a ratificacion.",
    { tipo: "MODELO_ACUERDO", materia: ["COOPTACION_CONSEJO", "NOMBRAMIENTO_CONSEJERO"], organo: "CONSEJO_ADMIN" },
    { notes: "La materia canonica final es COOPTACION_CONSEJO para el carril Consejo." },
  ),
  item(
    "modelo-separacion-administrador-junta",
    "APROBADA",
    "1.0.0",
    "Separacion de administrador por Junta aprobada con efectos, posible nombramiento simultaneo e inscripcion.",
    { tipo: "MODELO_ACUERDO", materia: ["SEPARACION_ADMINISTRADOR_JUNTA", "CESE_CONSEJERO"], organo: "JUNTA_GENERAL" },
    { notes: "La materia canonica final es SEPARACION_ADMINISTRADOR_JUNTA." },
  ),
  item(
    "modelo-cese-cargo-delegado-consejo",
    "APROBADA",
    "1.0.0",
    "Cese de cargo delegado por Consejo aprobado como carril separado de la separacion de administrador por Junta.",
    { tipo: "MODELO_ACUERDO", materia: ["CESE_CARGO_DELEGADO_CONSEJO", "CESE_CONSEJERO"], organo: "CONSEJO_ADMIN" },
    { notes: "La materia canonica final es CESE_CARGO_DELEGADO_CONSEJO para el carril Consejo." },
  ),
  item(
    "modelo-activos-esenciales",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Activos esenciales aprobado con valoracion, calculo de umbral, organo competente, conflictos y pactos.",
    { tipo: "MODELO_ACUERDO", materia: "ACTIVOS_ESENCIALES" },
    { variantRequired: "Umbral y valoracion." },
  ),
  item(
    "modelo-aprobacion-plan-negocio",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Aprobacion de plan de negocio aprobada para Consejo con plan integro, version, hipotesis, riesgos, pactos y carril indelegables.",
    { tipo: "MODELO_ACUERDO", materia: "APROBACION_PLAN_NEGOCIO", organo: "CONSEJO_ADMIN" },
    { variantRequired: "Carril indelegables en cotizadas." },
  ),
  item(
    "modelo-comites-internos",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Comites internos aprobado distinguiendo comision del consejo frente a comite interno, con base de creacion, composicion y funciones.",
    { tipo: "MODELO_ACUERDO", materia: "COMITES_INTERNOS" },
    { variantRequired: "Comision del consejo / comite interno." },
  ),
  item(
    "modelo-distribucion-cargos-consejo",
    "APROBADA",
    "1.0.0",
    "Distribucion de cargos del Consejo aprobada para presidente, secretario y otros cargos internos, sin confundir con apoderamientos.",
    { tipo: "MODELO_ACUERDO", materia: ["DISTRIBUCION_CARGOS_CONSEJO", "DISTRIBUCION_CARGOS"], organo: "CONSEJO_ADMIN" },
  ),
  item(
    "modelo-fusion-escision",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Fusion y escision aprobadas como materia de modificaciones estructurales bajo carril interno especifico.",
    { tipo: "MODELO_ACUERDO", materia: "FUSION_ESCISION", organo: "JUNTA_GENERAL" },
    { variantRequired: "Fusion / escision / regimen ME." },
  ),
  item(
    "modelo-politica-remuneracion",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Politica de remuneracion aprobada con anexo integro, periodo de vigencia, conflictos y variante cotizada.",
    { tipo: "MODELO_ACUERDO", materia: "POLITICA_REMUNERACION", organo: "JUNTA_GENERAL" },
    { variantRequired: "No cotizada / cotizada." },
  ),
  item(
    "modelo-politicas-corporativas",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Politicas corporativas aprobadas para Consejo con identificacion de politica, version, alcance y controles de conflicto.",
    { tipo: "MODELO_ACUERDO", materia: "POLITICAS_CORPORATIVAS", organo: "CONSEJO_ADMIN" },
    { variantRequired: "Tipos de politica." },
  ),
  item(
    "modelo-ratificacion-actos",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Ratificacion de actos aprobada con alcance, conflictos, pactos y derivacion a Junta segun el acto.",
    { tipo: "MODELO_ACUERDO", materia: "RATIFICACION_ACTOS" },
    { variantRequired: "Derivacion a Junta segun acto." },
  ),
  item(
    "modelo-seguros-responsabilidad",
    "APROBADA_CON_VARIANTES",
    "1.0.0",
    "Seguros de responsabilidad aprobados con terminos D&O, coberturas, beneficiarios, condiciones, conflictos y pactos.",
    { tipo: "MODELO_ACUERDO", materia: "SEGUROS_RESPONSABILIDAD", organo: "CONSEJO_ADMIN" },
    { variantRequired: "D&O y coberturas." },
  ),
];

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function normalizeMateria(value?: string | null) {
  const code = normalizeCode(value);
  if (code === "GARANTIA_PRESTAMO") return "AUTORIZACION_GARANTIA";
  if (code === "DISTRIBUCION_CARGOS") return "DISTRIBUCION_CARGOS_CONSEJO";
  return code;
}

function normalizeOrgano(value?: string | null) {
  const code = normalizeCode(value);
  if (!code) return "";
  if (code.includes("JUNTA")) return "JUNTA_GENERAL";
  if (code.includes("CONSEJO") || code === "CDA") return "CONSEJO_ADMIN";
  if (code.includes("COMISION") || code.includes("COMIT")) return "COMISION_DELEGADA";
  if (code.includes("SOCIO_UNICO")) return "SOCIO_UNICO";
  if (code.includes("ADMIN")) return code === "ORGANO_ADMIN" ? "ORGANO_ADMIN" : "ADMIN";
  return code;
}

function valueMatches(actual: string, expected?: string | string[], normalize = normalizeCode) {
  if (!expected) return true;
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  return expectedValues.some((value) => normalize(actual) === normalize(value));
}

export function resolveLegalTemplateApprovalPlan(
  template: PlantillaProtegidaRow,
): LegalTemplateApprovalPlanItem | null {
  const tipo = normalizeCode(template.tipo);
  const materia = normalizeCode(template.materia_acuerdo ?? template.materia);
  const adoptionMode = normalizeCode(template.adoption_mode);
  const organo = normalizeOrgano(template.organo_tipo);

  return LEGAL_TEMPLATE_APPROVAL_PLAN.find((approvalItem) => (
    valueMatches(tipo, approvalItem.matcher.tipo) &&
    valueMatches(materia, approvalItem.matcher.materia, normalizeMateria) &&
    valueMatches(adoptionMode, approvalItem.matcher.adoptionMode) &&
    valueMatches(organo, approvalItem.matcher.organo, normalizeOrgano)
  )) ?? null;
}
