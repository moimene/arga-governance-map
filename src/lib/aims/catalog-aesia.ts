/**
 * Catálogo de requisitos del Reglamento (UE) 2024/1689 usado por el
 * autodiagnóstico de AIMS 360.
 *
 * QUÉ SE CITA Y QUÉ NO
 * --------------------
 * `articleRef` SÍ es una cita: el artículo del Reglamento existe y es el que
 * dice. Se pinta en pantalla.
 *
 * `guideRef` SE HA RETIRADO (2026-09-05). Atribuía a cada requisito un número
 * de Guía AESIA ("Guía 12 AESIA", "Guía 2 AESIA", …) y diez de los doce
 * llevaban una guía distinta de la que les corresponde.
 *
 * PRECISIÓN (review adversarial, 2026-09-05): las guías SÍ existen — AESIA
 * publica un catálogo numerado en aesia.digital.gob.es/es/guias— así que el
 * motivo NO es que la fuente no exista. Son dos motivos distintos:
 *   1. la ATRIBUCIÓN requisito → guía estaba mal en 10 de 12, y
 *   2. una guía de la Agencia no es la fuente de un requisito del Reglamento:
 *      la fuente es el artículo, y la propia AESIA las publica como material
 *      no vinculante.
 * Se retira el campo entero en lugar de sustituirlo por otro número: una
 * atribución equivocada no se corrige adivinando la correcta. El día que haya
 * un cotejo documentado guía a guía, puede volver con su fecha de verificación.
 *
 * `subpartId` ("17.1.a", "9.2.a", "A.5.1"…) ES UNA CLAVE INTERNA de
 * agrupación y NO se pinta en ninguna pantalla — se muestra `titleShort`, que
 * es la descripción del bloque, y para eso está `subpartTitle()`.
 *
 * RECOTEJO CONTRA EL TEXTO CONSOLIDADO (2026-09-19)
 * -------------------------------------------------
 * Cada requisito con `verificadoEl` se cotejó, clave a clave y título a título,
 * contra el texto consolidado del Reglamento a 27-07-2026 (`TEXTO_COTEJADO_RIA`,
 * tras el Reglamento (UE) 2026/1744). En esos requisitos la clave interna SÍ
 * sigue al apartado y la letra del artículo, aunque siga sin pintarse: lo
 * visible son los títulos, y son ellos los que llevan la cita cuando hace falta
 * (p. ej., «solo anexo III, punto 1, letra a)» en los mínimos del art. 12.3).
 *
 * Los códigos MG_* anteriores NO cambian: en Cloud hay respuestas guardadas con
 * ellos. Pero el texto de 33 medidas SÍ cambió, y no siempre conservando lo que
 * se preguntaba (base b1721a5 → versión 2026-09-19):
 *  - Cambian de SENTIDO (una respuesta a la pregunta anterior no contesta la
 *    nueva) — 18: MG_QUAL_10, MG_RISK_06, MG_DATA_08, MG_DATA_09, MG_TRANS_01,
 *    MG_TRANS_05, MG_TRANS_08, MG_TRANS_11, MG_ROBU_01, MG_ROBU_03, MG_LOGG_03,
 *    MG_LOGG_04, MG_LOGG_05, MG_LOGG_06, MG_LOGG_07, MG_INCI_01, MG_INCI_02 y
 *    MG_ISO_IMP_02.
 *  - Cambian de ALCANCE (misma pregunta, acotada o completada con el literal)
 *    — 13: MG_QUAL_02, MG_QUAL_03, MG_QUAL_07, MG_RISK_08, MG_RISK_09,
 *    MG_DATA_02, MG_TRANS_02, MG_TRANS_09, MG_TRANS_10, MG_ACCU_02, MG_LOGG_02,
 *    MG_POST_02 y MG_POST_04.
 *  - Sólo TERMINOLOGÍA («responsables del despliegue») — 2: MG_TDOC_04 y
 *    MG_POST_05.
 * Las medidas que entran nuevas llevan `desde` con la versión del catálogo en
 * que entran (`VERSION_CATALOGO_RIA`). Una evaluación respondida con otra
 * versión la detecta `cambiosDelCatalogoDesde`, y el informe marca en el
 * desglose cada medida cuyo texto cambió desde la respuesta.
 *
 * Segunda lectura pendiente: el lote H-11 de Harvey (§9 de la especificación)
 * no se ha enviado. Hasta su veredicto, el cotejo es de TGMS.
 */

import { acreditaConformidad } from "./conformidad";

/**
 * Versión del catálogo de medidas. Sube cuando entra una medida o cambia el
 * sentido de una existente; las medidas nuevas la llevan en `desde`.
 */
export const VERSION_CATALOGO_RIA = "2026-09-19";

/** Texto contra el que se hizo el recotejo de los requisitos con `verificadoEl`. */
export const TEXTO_COTEJADO_RIA = {
  norma: "Reglamento (UE) 2024/1689, texto consolidado a 27-07-2026 (modificado por el Reglamento (UE) 2026/1744)",
  celex: "02024R1689-20260727",
  url: "https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:02024R1689-20260727",
  /** SHA-256 del HTML descargado el 2026-09-19 (conversor EUR-Lex del 11-08-2026). */
  sha256Html: "ed11ce60514e9030bda35bfc2de78ff83306980ece16b095695d9ff5c93ad904",
  segundaLectura: "Pendiente: lote H-11 de Harvey",
} as const;

export interface RequirementDef {
  code: string;
  title: string;
  articleRef: string;
  description: string;
  /**
   * Fecha del cotejo contra `TEXTO_COTEJADO_RIA` (AAAA-MM-DD). `null` =
   * declarado y todavía sin cotejar. Los catálogos que no son del RIA no lo usan.
   */
  verificadoEl?: string | null;
  /**
   * Carácter del requisito cuando no es una obligación del RIA. ISO/IEC 42001
   * es siempre `MARCO_OPERATIVO`: marco de madurez, no obligación jurídica.
   */
  caracter?: "OBLIGACION" | "MARCO_OPERATIVO";
  subparts: SubpartDef[];
  measures: MeasureGuideDef[];
}

export interface SubpartDef {
  subpartId: string;
  articleNumber: string;
  titleShort: string;
  orderIndex: number;
}

export interface MeasureGuideDef {
  id: string;
  code: string;
  description: string;
  subpartId: string;
  guidanceQuestions?: string[];
  /** Versión del catálogo en que entra la medida. Sin valor: estaba antes del recotejo. */
  desde?: string;
}

export interface MaturityLevelDef {
  level: string; // 'L1' - 'L8'
  title: string;
  description: string;
  planCode: string; // '01' - '05'
  planLabel: string;
  planAction: string;
  requiresJustification: boolean;
}

export interface AdaptationPlanDef {
  code: string;
  label: string;
  action: string;
  description: string;
  tone: "error" | "warning" | "success" | "info";
}

export interface DifficultyLevelDef {
  code: string;
  label: string;
  tone: "error" | "warning" | "success";
}

/**
 * Los códigos van al revés de la intuición (`00` = ALTA dificultad) porque los
 * hereda del cuadro de origen. Se conservan como valor persistido y **no se
 * pintan**: en pantalla va sólo la etiqueta, vía `difficultyLabel`.
 */
export const DIFFICULTY_LEVELS: Record<string, DifficultyLevelDef> = {
  "00": { code: "00", label: "Alta dificultad", tone: "error" },
  "01": { code: "01", label: "Media dificultad", tone: "warning" },
  "02": { code: "02", label: "Baja dificultad", tone: "success" },
};

/**
 * `SIN_EVALUAR` no es un código de la escala: es la ausencia de graduación.
 *
 * El desplegable venía con `"01"` (media) preseleccionado, así que las 84
 * medidas nacían graduadas por nadie y ese dato espurio no se distinguía de una
 * graduación real. Ahora el valor vacío es el inicial y significa lo que dice.
 */
export const DIFICULTAD_SIN_EVALUAR = "";

export function difficultyLabel(code: string | null | undefined): string {
  const c = (code ?? "").trim();
  if (!c) return "Sin evaluar";
  return DIFFICULTY_LEVELS[c]?.label ?? "Sin evaluar";
}

export const ADAPTATION_PLANS: Record<string, AdaptationPlanDef> = {
  "01": {
    code: "01",
    label: "Plan 01 — Documentar e Implementar",
    action: "Documentar e Implementar",
    description: "La medida no existe o está en curso inicial. Requiere diseño documental completo y despliegue operativo.",
    tone: "error",
  },
  "02": {
    code: "02",
    label: "Plan 02 — Implementar",
    action: "Implementar",
    description: "La medida está documentada formalmente pero falta completar su ejecución técnica u operativa.",
    tone: "warning",
  },
  "03": {
    code: "03",
    label: "Plan 03 — Adaptación Completa",
    action: "Adaptación Completa",
    description: "La medida se encuentra documentada e implementada en su totalidad con evidencia de cumplimiento.",
    tone: "success",
  },
  "04": {
    code: "04",
    label: "Plan 04 — Documentar",
    action: "Documentar",
    description: "La medida está operando en la práctica pero carece de la formalización y documentación técnica requerida.",
    tone: "info",
  },
  "05": {
    code: "05",
    label: "Plan 05 — Ninguna acción requerida",
    action: "Ninguna acción requerida",
    description: "La medida no resulta aplicable al sistema evaluado según la justificación técnica aportada.",
    tone: "success",
  },
};

export const MATURITY_LEVELS: Record<string, MaturityLevelDef> = {
  L1: {
    level: "L1",
    title: "No documentada ni implementada",
    description: "No existe documentación técnica ni proceso operativo para la medida.",
    planCode: "01",
    planLabel: "Documentar e Implementar",
    planAction: "01",
    requiresJustification: false,
  },
  L2: {
    level: "L2",
    title: "Documentación en curso, no implementada",
    description: "Se está redactando el procedimiento pero no existe despliegue técnico.",
    planCode: "01",
    planLabel: "Documentar e Implementar",
    planAction: "01",
    requiresJustification: false,
  },
  L3: {
    level: "L3",
    title: "Documentada, no implementada",
    description: "Existe política o especificación aprobada pero no se aplica en producción.",
    planCode: "02",
    planLabel: "Implementar",
    planAction: "02",
    requiresJustification: false,
  },
  L4: {
    level: "L4",
    title: "Documentada, implementación en curso",
    description: "Procedimiento aprobado y despliegue técnico/operativo en fase de desarrollo o pruebas.",
    planCode: "02",
    planLabel: "Implementar",
    planAction: "02",
    requiresJustification: false,
  },
  L5: {
    level: "L5",
    title: "Documentada e implementada",
    description: "Cumplimiento integral operativo con política y evidencias verificables.",
    planCode: "03",
    planLabel: "Adaptación Completa",
    planAction: "03",
    requiresJustification: false,
  },
  L6: {
    level: "L6",
    title: "No documentada e implementada",
    description: "La salvaguarda técnica funciona en el sistema pero no está documentada en el expediente.",
    planCode: "04",
    planLabel: "Documentar",
    planAction: "04",
    requiresJustification: false,
  },
  L7: {
    level: "L7",
    title: "Documentación en curso e implementada",
    description: "La salvaguarda funciona y la documentación técnica está en proceso de cierre.",
    planCode: "04",
    planLabel: "Documentar",
    planAction: "04",
    requiresJustification: false,
  },
  L8: {
    level: "L8",
    title: "Medida no necesaria para el sistema",
    description: "Por diseño, alcance o arquitectura, esta medida no aplica al caso de uso evaluado.",
    planCode: "05",
    planLabel: "Ninguna acción",
    planAction: "05",
    requiresJustification: true,
  },
};

/**
 * Calcula el Plan de Adaptación determinista según la Regla Guía 16 AESIA.
 */
export function calculateAdaptationPlan(maturityLevel: string | null | undefined): AdaptationPlanDef {
  if (!maturityLevel) {
    return {
      code: "00",
      label: "Pendiente de diagnóstico",
      action: "Pendiente",
      description: "Nivel de madurez no asignado todavía.",
      tone: "info",
    };
  }
  const meta = MATURITY_LEVELS[maturityLevel];
  if (!meta) {
    return {
      code: "00",
      label: "Nivel no reconocido",
      action: "Error",
      description: "Nivel de madurez fuera de la escala L1-L8.",
      tone: "error",
    };
  }
  return ADAPTATION_PLANS[meta.planCode];
}

/**
 * Título del bloque al que pertenece una medida.
 *
 * Es lo que se pinta en pantalla en lugar de `subpartId`: el identificador es
 * una clave interna del catálogo y presentarlo con la forma «17.1.a» lo hacía
 * pasar por apartado y letra del artículo, que es una cita no cotejada.
 */
export function subpartTitle(
  requirement: RequirementDef | undefined | null,
  subpartId: string | undefined | null,
): string {
  if (!requirement || !subpartId) return "Bloque no identificado";
  return requirement.subparts.find((s) => s.subpartId === subpartId)?.titleShort
    ?? "Bloque no identificado";
}

/**
 * Devuelve el estado de diagnóstico (00 = Pendiente, 01 = Diagnosticada).
 */
export function deriveDiagnosisStatus(maturityLevel: string | null | undefined): string {
  return maturityLevel && maturityLevel.trim().length > 0 ? "01" : "00";
}

/**
 * Catálogo del proveedor de un sistema de alto riesgo: los 12 requisitos del
 * RIA con sus medidas guía (MG). Lo que es cita se cotejó contra el texto
 * consolidado (ver cabecera); la procedencia AESIA del catálogo, no.
 */
export const AESIA_RIA_REQUIREMENTS: RequirementDef[] = [
  {
    code: "QUALITY_MGMT",
    title: "Sistema de gestión de la calidad",
    articleRef: "Art. 17",
    description: "Establecer, documentar y mantener un sistema de gestión de calidad que asegure el cumplimiento continuado del Reglamento de IA a lo largo de todo el ciclo de vida del sistema.",
    verificadoEl: "2026-09-19",
    // Una clave por letra del 17.1. Antes la «d» llevaba la f), la «e» la g)…
    // hasta la «k», que llevaba la m); la «b» y la «c» estaban cruzadas; y la
    // d) y la e) no tenían medida.
    subparts: [
      { subpartId: "17.1.a", articleNumber: "Art. 17", titleShort: "Estrategia de cumplimiento normativo", orderIndex: 1 },
      { subpartId: "17.1.b", articleNumber: "Art. 17", titleShort: "Diseño, control y verificación del diseño", orderIndex: 2 },
      { subpartId: "17.1.c", articleNumber: "Art. 17", titleShort: "Desarrollo, control y aseguramiento de la calidad", orderIndex: 3 },
      { subpartId: "17.1.d", articleNumber: "Art. 17", titleShort: "Examen, prueba y validación, con su frecuencia", orderIndex: 4 },
      { subpartId: "17.1.e", articleNumber: "Art. 17", titleShort: "Especificaciones técnicas y normas aplicadas", orderIndex: 5 },
      { subpartId: "17.1.f", articleNumber: "Art. 17", titleShort: "Sistemas y procedimientos de gestión de datos", orderIndex: 6 },
      { subpartId: "17.1.g", articleNumber: "Art. 17", titleShort: "Sistema de gestión de riesgos", orderIndex: 7 },
      { subpartId: "17.1.h", articleNumber: "Art. 17", titleShort: "Vigilancia poscomercialización", orderIndex: 8 },
      { subpartId: "17.1.i", articleNumber: "Art. 17", titleShort: "Notificación de incidentes graves", orderIndex: 9 },
      { subpartId: "17.1.j", articleNumber: "Art. 17", titleShort: "Comunicación con autoridades, organismos notificados y otras partes", orderIndex: 10 },
      { subpartId: "17.1.k", articleNumber: "Art. 17", titleShort: "Registro de la documentación y la información", orderIndex: 11 },
      { subpartId: "17.1.l", articleNumber: "Art. 17", titleShort: "Gestión de los recursos y seguridad del suministro", orderIndex: 12 },
      { subpartId: "17.1.m", articleNumber: "Art. 17", titleShort: "Marco de rendición de cuentas", orderIndex: 13 },
    ],
    measures: [
      { id: "MG_QUAL_01", code: "MG_QUAL_01", description: "Establecer una estrategia de cumplimiento normativo formal aprobada por la dirección", subpartId: "17.1.a" },
      { id: "MG_QUAL_03", code: "MG_QUAL_03", description: "Aplicar técnicas y procedimientos sistemáticos de diseño, control y verificación del diseño", subpartId: "17.1.b" },
      { id: "MG_QUAL_02", code: "MG_QUAL_02", description: "Implementar técnicas y procedimientos sistemáticos de desarrollo, control y aseguramiento de la calidad", subpartId: "17.1.c" },
      { id: "MG_QUAL_12", code: "MG_QUAL_12", description: "Definir los procedimientos de examen, prueba y validación antes, durante y después del desarrollo, y su frecuencia", subpartId: "17.1.d", desde: VERSION_CATALOGO_RIA },
      { id: "MG_QUAL_13", code: "MG_QUAL_13", description: "Identificar las especificaciones técnicas y normas aplicadas y, donde las normas armonizadas no cubran todos los requisitos, los medios para cumplirlos", subpartId: "17.1.e", desde: VERSION_CATALOGO_RIA },
      { id: "MG_QUAL_04", code: "MG_QUAL_04", description: "Establecer procedimientos rigurosos para la gestión de datos en el SGC", subpartId: "17.1.f" },
      { id: "MG_QUAL_05", code: "MG_QUAL_05", description: "Documentar el sistema de gestión de riesgos integrado en el SGC", subpartId: "17.1.g" },
      { id: "MG_QUAL_06", code: "MG_QUAL_06", description: "Implementar un protocolo de vigilancia poscomercialización continuo", subpartId: "17.1.h" },
      { id: "MG_QUAL_07", code: "MG_QUAL_07", description: "Establecer los procedimientos de notificación de incidentes graves", subpartId: "17.1.i" },
      { id: "MG_QUAL_08", code: "MG_QUAL_08", description: "Definir los canales y responsables de comunicación con autoridades supervisoras", subpartId: "17.1.j" },
      { id: "MG_QUAL_09", code: "MG_QUAL_09", description: "Mantener la documentación e información técnica actualizada y custodiada", subpartId: "17.1.k" },
      { id: "MG_QUAL_10", code: "MG_QUAL_10", description: "Gestionar los recursos, incluidas las medidas de seguridad del suministro", subpartId: "17.1.l" },
      { id: "MG_QUAL_11", code: "MG_QUAL_11", description: "Establecer un marco claro de rendición de cuentas de la alta dirección", subpartId: "17.1.m" },
    ],
  },
  {
    code: "RISK_MGMT",
    title: "Sistema de gestión de riesgos",
    articleRef: "Art. 9",
    description: "Establecer, aplicar, documentar y mantener un sistema de gestión de riesgos continuo y sistemático que identifique, evalúe y mitigue los riesgos conocidos y previsibles para la salud, la seguridad y los derechos fundamentales.",
    verificadoEl: "2026-09-19",
    // Realineado con el art. 9: el uso indebido razonablemente previsible es de
    // la b), no de la c); la c) —otros riesgos a partir de la vigilancia
    // poscomercialización— no tenía medida; las pruebas son del 9.6 (se
    // pintaban en el 9.4 y el 9.7); el residual aceptable es del 9.5; la
    // aplicación combinada de requisitos, del 9.4; y los menores y colectivos
    // vulnerables, del 9.9.
    subparts: [
      { subpartId: "9.2.a", articleNumber: "Art. 9", titleShort: "Determinación y análisis de los riesgos conocidos y previsibles", orderIndex: 1 },
      { subpartId: "9.2.b", articleNumber: "Art. 9", titleShort: "Estimación y evaluación de riesgos en uso conforme e indebido previsible", orderIndex: 2 },
      { subpartId: "9.2.c", articleNumber: "Art. 9", titleShort: "Otros riesgos a partir de la vigilancia poscomercialización", orderIndex: 3 },
      { subpartId: "9.2.d", articleNumber: "Art. 9", titleShort: "Medidas adecuadas y específicas de gestión de riesgos", orderIndex: 4 },
      { subpartId: "9.4", articleNumber: "Art. 9", titleShort: "Efectos de la aplicación combinada de los requisitos", orderIndex: 5 },
      { subpartId: "9.5", articleNumber: "Art. 9", titleShort: "Riesgo residual aceptable y orden de las medidas", orderIndex: 6 },
      { subpartId: "9.6", articleNumber: "Art. 9", titleShort: "Pruebas para determinar las medidas más adecuadas", orderIndex: 7 },
      { subpartId: "9.7", articleNumber: "Art. 9", titleShort: "Pruebas en condiciones reales (art. 60), si se hacen", orderIndex: 8 },
      { subpartId: "9.8", articleNumber: "Art. 9", titleShort: "Momento de las pruebas, con parámetros y umbrales definidos", orderIndex: 9 },
      { subpartId: "9.9", articleNumber: "Art. 9", titleShort: "Menores de edad y otros colectivos vulnerables", orderIndex: 10 },
    ],
    measures: [
      { id: "MG_RISK_01", code: "MG_RISK_01", description: "Identificar y analizar los riesgos conocidos y previsibles para personas afectadas", subpartId: "9.2.a" },
      { id: "MG_RISK_02", code: "MG_RISK_02", description: "Estimar y evaluar los riesgos que puedan surgir durante el funcionamiento", subpartId: "9.2.b" },
      { id: "MG_RISK_03", code: "MG_RISK_03", description: "Evaluar los riesgos derivados del uso previsto y del uso indebido razonablemente previsible", subpartId: "9.2.b" },
      { id: "MG_RISK_10", code: "MG_RISK_10", description: "Evaluar otros riesgos a partir del análisis de los datos de la vigilancia poscomercialización (art. 72)", subpartId: "9.2.c", desde: VERSION_CATALOGO_RIA },
      { id: "MG_RISK_04", code: "MG_RISK_04", description: "Adoptar medidas de gestión de riesgos eficaces y proporcionadas", subpartId: "9.2.d" },
      { id: "MG_RISK_09", code: "MG_RISK_09", description: "Asegurar que las medidas de mitigación no introducen riesgos nuevos o desproporcionados, teniendo en cuenta la aplicación combinada de los requisitos", subpartId: "9.4" },
      { id: "MG_RISK_07", code: "MG_RISK_07", description: "Diseñar el sistema para asegurar que el riesgo residual resulte aceptable", subpartId: "9.5" },
      { id: "MG_RISK_08", code: "MG_RISK_08", description: "Ejecutar pruebas iterativas para seleccionar las medidas de gestión de riesgos más adecuadas", subpartId: "9.6" },
      { id: "MG_RISK_05", code: "MG_RISK_05", description: "Realizar pruebas para verificar que las medidas de gestión cumplen sus objetivos", subpartId: "9.6" },
      { id: "MG_RISK_11", code: "MG_RISK_11", description: "Si el sistema se prueba en condiciones reales, hacerlo conforme al art. 60", subpartId: "9.7", desde: VERSION_CATALOGO_RIA },
      { id: "MG_RISK_12", code: "MG_RISK_12", description: "Probar el sistema durante el desarrollo y, en todo caso, antes de introducirlo en el mercado o ponerlo en servicio, con parámetros y umbrales de probabilidad definidos previamente", subpartId: "9.8", desde: VERSION_CATALOGO_RIA },
      { id: "MG_RISK_06", code: "MG_RISK_06", description: "Valorar si el sistema puede afectar negativamente a menores de dieciocho años y a otros colectivos vulnerables", subpartId: "9.9" },
    ],
  },
  {
    code: "HUMAN_OVERSIGHT",
    title: "Supervisión humana",
    articleRef: "Art. 14",
    description: "Diseñar y desarrollar los sistemas de IA de alto riesgo de modo que puedan ser supervisados eficazmente por personas físicas durante su uso para prevenir o minimizar riesgos.",
    verificadoEl: "2026-09-19",
    subparts: [
      { subpartId: "14.1", articleNumber: "Art. 14", titleShort: "Diseño para supervisión humana efectiva", orderIndex: 1 },
      { subpartId: "14.2", articleNumber: "Art. 14", titleShort: "Prevención o minimización de riesgos para la salud y derechos", orderIndex: 2 },
      { subpartId: "14.3.a", articleNumber: "Art. 14", titleShort: "Medidas de supervisión incorporadas en el sistema", orderIndex: 3 },
      { subpartId: "14.3.b", articleNumber: "Art. 14", titleShort: "Medidas de supervisión para el responsable de despliegue", orderIndex: 4 },
      { subpartId: "14.4.a", articleNumber: "Art. 14", titleShort: "Comprensión de capacidades, límites y sesgos", orderIndex: 5 },
      { subpartId: "14.4.b", articleNumber: "Art. 14", titleShort: "Mitigación del sesgo de automatización", orderIndex: 6 },
      { subpartId: "14.4.c", articleNumber: "Art. 14", titleShort: "Interpretación correcta de resultados y explicabilidad", orderIndex: 7 },
      { subpartId: "14.4.d", articleNumber: "Art. 14", titleShort: "Capacidad de decidir no utilizar el sistema o anular la salida", orderIndex: 8 },
      { subpartId: "14.4.e", articleNumber: "Art. 14", titleShort: "Capacidad de intervenir en el funcionamiento o pararlo (Kill switch)", orderIndex: 9 },
      { subpartId: "14.5", articleNumber: "Art. 14", titleShort: "Verificación por dos personas: solo anexo III, punto 1, letra a)", orderIndex: 10 },
    ],
    measures: [
      { id: "MG_HUMN_01", code: "MG_HUMN_01", description: "Diseñar la interfaz y flujo del sistema para habilitar supervisión humana efectiva", subpartId: "14.1" },
      { id: "MG_HUMN_02", code: "MG_HUMN_02", description: "Implementar alertas y mecanismos para prevenir o minimizar riesgos a personas", subpartId: "14.2" },
      { id: "MG_HUMN_03", code: "MG_HUMN_03", description: "Incorporar salvaguardas técnicas nativas de supervisión dentro de la aplicación", subpartId: "14.3.a" },
      { id: "MG_HUMN_04", code: "MG_HUMN_04", description: "Definir protocolos operativos para el personal responsable del despliegue", subpartId: "14.3.b" },
      { id: "MG_HUMN_05", code: "MG_HUMN_05", description: "Facilitar a los supervisores la comprensión clara de las capacidades y límites del modelo", subpartId: "14.4.a" },
      { id: "MG_HUMN_06", code: "MG_HUMN_06", description: "Mitigar activamente el sesgo de automatización (exceso de confianza o complacencia)", subpartId: "14.4.b" },
      { id: "MG_HUMN_07", code: "MG_HUMN_07", description: "Proporcionar explicaciones claras de las razones que motivan los resultados del sistema", subpartId: "14.4.c" },
      { id: "MG_HUMN_08", code: "MG_HUMN_08", description: "Habilitar la opción de ignorar, modificar o anular la recomendación de la IA (Override)", subpartId: "14.4.d" },
      { id: "MG_HUMN_09", code: "MG_HUMN_09", description: "Implementar un mecanismo de parada segura e inmediata del sistema (Kill Switch)", subpartId: "14.4.e" },
      { id: "MG_HUMN_10", code: "MG_HUMN_10", description: "No actuar ni decidir sobre una identificación del sistema sin que al menos dos personas competentes la verifiquen y confirmen por separado, salvo las excepciones del art. 14.5", subpartId: "14.5", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "DATA_GOVERNANCE",
    title: "Datos y gobernanza de datos",
    articleRef: "Art. 10",
    description: "Aplicar prácticas adecuadas de gobernanza y gestión de datos a los conjuntos de entrenamiento, validación y prueba para asegurar calidad, representatividad y mitigación de sesgos.",
    verificadoEl: "2026-09-19",
    // El 10.2 tiene ocho letras: la g) (medidas contra los sesgos) no tenía
    // medida y las lagunas son de la h). El 10.5 está SUPRIMIDO por el
    // Reglamento (UE) 2026/1744: el tratamiento de categorías especiales para
    // detectar y corregir sesgos pasa al art. 4 bis. El contenido de MG_DATA_10
    // (disparador y seis condiciones del 4 bis.1) es de F7.T4; aquí solo deja
    // de colgar de un apartado que ya no existe.
    subparts: [
      { subpartId: "10.2.a", articleNumber: "Art. 10", titleShort: "Decisiones de diseño de datos pertinentes", orderIndex: 1 },
      { subpartId: "10.2.b", articleNumber: "Art. 10", titleShort: "Procesos de recogida de datos y origen", orderIndex: 2 },
      { subpartId: "10.2.c", articleNumber: "Art. 10", titleShort: "Operaciones de tratamiento y preparación", orderIndex: 3 },
      { subpartId: "10.2.d", articleNumber: "Art. 10", titleShort: "Formulación de supuestos sobre la información", orderIndex: 4 },
      { subpartId: "10.2.e", articleNumber: "Art. 10", titleShort: "Evaluación de disponibilidad, cantidad y adecuación", orderIndex: 5 },
      { subpartId: "10.2.f", articleNumber: "Art. 10", titleShort: "Examen de posibles sesgos en los datos", orderIndex: 6 },
      { subpartId: "10.2.g", articleNumber: "Art. 10", titleShort: "Medidas para detectar, prevenir y mitigar sesgos", orderIndex: 7 },
      { subpartId: "10.2.h", articleNumber: "Art. 10", titleShort: "Lagunas o deficiencias de los datos y cómo subsanarlas", orderIndex: 8 },
      { subpartId: "10.3", articleNumber: "Art. 10", titleShort: "Conjuntos pertinentes, representativos y libres de errores", orderIndex: 9 },
      { subpartId: "10.4", articleNumber: "Art. 10", titleShort: "Características del entorno geográfico, contextual, conductual o funcional de uso", orderIndex: 10 },
      { subpartId: "4bis.1", articleNumber: "Art. 4 bis", titleShort: "Categorías especiales de datos para detectar y corregir sesgos (art. 4 bis)", orderIndex: 11 },
    ],
    measures: [
      { id: "MG_DATA_01", code: "MG_DATA_01", description: "Documentar las decisiones de diseño y arquitectura de los conjuntos de datos", subpartId: "10.2.a" },
      { id: "MG_DATA_02", code: "MG_DATA_02", description: "Establecer procesos formales de recolección y trazabilidad del origen de los datos y, en los personales, de la finalidad original de su recogida", subpartId: "10.2.b" },
      { id: "MG_DATA_03", code: "MG_DATA_03", description: "Definir operaciones estandarizadas de limpieza, transformación y etiquetado", subpartId: "10.2.c" },
      { id: "MG_DATA_04", code: "MG_DATA_04", description: "Formular y validar supuestos de representatividad sobre los datos usados", subpartId: "10.2.d" },
      { id: "MG_DATA_05", code: "MG_DATA_05", description: "Evaluar la disponibilidad, volumen y suficiencia estadística de las muestras", subpartId: "10.2.e" },
      { id: "MG_DATA_06", code: "MG_DATA_06", description: "Examinar la presencia de sesgos históricos o de muestreo que afecten a derechos", subpartId: "10.2.f" },
      { id: "MG_DATA_11", code: "MG_DATA_11", description: "Adoptar medidas adecuadas para detectar, prevenir y mitigar los posibles sesgos detectados", subpartId: "10.2.g", desde: VERSION_CATALOGO_RIA },
      { id: "MG_DATA_07", code: "MG_DATA_07", description: "Identificar lagunas informativas y aplicar medidas correctivas de enriquecimiento", subpartId: "10.2.h" },
      { id: "MG_DATA_08", code: "MG_DATA_08", description: "Asegurar que los conjuntos de entrenamiento, validación y prueba sean pertinentes, suficientemente representativos y, en la mayor medida posible, sin errores y completos", subpartId: "10.3" },
      { id: "MG_DATA_09", code: "MG_DATA_09", description: "Tener en cuenta en los conjuntos de datos las características del entorno geográfico, contextual, conductual o funcional específico en que está previsto usar el sistema", subpartId: "10.4" },
      { id: "MG_DATA_10", code: "MG_DATA_10", description: "Garantizar las salvaguardas estrictas si se tratan categorías especiales bajo RGPD", subpartId: "4bis.1" },
    ],
  },
  {
    code: "TRANSPARENCY",
    // Título oficial del art. 13 consolidado. El destinatario de la información
    // es el RESPONSABLE DEL DESPLIEGUE, no el «usuario final».
    title: "Transparencia y comunicación de información a los responsables del despliegue",
    articleRef: "Art. 13",
    description: "Diseñar y desarrollar el sistema con un nivel de transparencia suficiente para que los responsables del despliegue interpreten y usen correctamente sus resultados de salida, y acompañarlo de instrucciones de uso con el contenido mínimo del art. 13.3.",
    verificadoEl: "2026-09-19",
    subparts: [
      { subpartId: "13.1", articleNumber: "Art. 13", titleShort: "Transparencia suficiente para interpretar y usar los resultados", orderIndex: 1 },
      { subpartId: "13.3.a", articleNumber: "Art. 13", titleShort: "Identidad y datos de contacto del proveedor", orderIndex: 2 },
      { subpartId: "13.3.b", articleNumber: "Art. 13", titleShort: "Características, capacidades y limitaciones del funcionamiento", orderIndex: 3 },
      { subpartId: "13.3.b.i", articleNumber: "Art. 13", titleShort: "Finalidad prevista", orderIndex: 4 },
      { subpartId: "13.3.b.ii", articleNumber: "Art. 13", titleShort: "Precisión, solidez y ciberseguridad esperables", orderIndex: 5 },
      { subpartId: "13.3.b.iii", articleNumber: "Art. 13", titleShort: "Circunstancias que pueden generar riesgos", orderIndex: 6 },
      { subpartId: "13.3.b.iv", articleNumber: "Art. 13", titleShort: "Capacidades para explicar los resultados", orderIndex: 7 },
      { subpartId: "13.3.b.v", articleNumber: "Art. 13", titleShort: "Funcionamiento respecto de personas o colectivos", orderIndex: 8 },
      { subpartId: "13.3.b.vi", articleNumber: "Art. 13", titleShort: "Datos de entrada y conjuntos de entrenamiento, validación y prueba", orderIndex: 9 },
      { subpartId: "13.3.b.vii", articleNumber: "Art. 13", titleShort: "Información para interpretar y usar los resultados", orderIndex: 10 },
      { subpartId: "13.3.c", articleNumber: "Art. 13", titleShort: "Cambios predeterminados en la evaluación de la conformidad inicial", orderIndex: 11 },
      { subpartId: "13.3.d", articleNumber: "Art. 13", titleShort: "Medidas de supervisión humana", orderIndex: 12 },
      { subpartId: "13.3.e", articleNumber: "Art. 13", titleShort: "Recursos, vida útil y mantenimiento", orderIndex: 13 },
      { subpartId: "13.3.f", articleNumber: "Art. 13", titleShort: "Mecanismos para recabar e interpretar los archivos de registro", orderIndex: 14 },
    ],
    measures: [
      { id: "MG_TRANS_01", code: "MG_TRANS_01", description: "Diseñar el sistema para que su funcionamiento sea transparente para los responsables del despliegue", subpartId: "13.1" },
      { id: "MG_TRANS_02", code: "MG_TRANS_02", description: "Proporcionar en las instrucciones de uso la identidad y datos de contacto del proveedor", subpartId: "13.3.a" },
      { id: "MG_TRANS_03", code: "MG_TRANS_03", description: "Documentar con claridad las características, capacidades y limitaciones del modelo", subpartId: "13.3.b" },
      { id: "MG_TRANS_12", code: "MG_TRANS_12", description: "Indicar en las instrucciones de uso la finalidad prevista del sistema", subpartId: "13.3.b.i", desde: VERSION_CATALOGO_RIA },
      { id: "MG_TRANS_04", code: "MG_TRANS_04", description: "Declarar de forma explícita el nivel de precisión y las métricas evaluadas", subpartId: "13.3.b.ii" },
      { id: "MG_TRANS_05", code: "MG_TRANS_05", description: "Describir las circunstancias, de uso conforme o de uso indebido previsible, en que el sistema puede fallar y generar riesgos para la salud, la seguridad o los derechos fundamentales", subpartId: "13.3.b.iii" },
      { id: "MG_TRANS_13", code: "MG_TRANS_13", description: "Describir, cuando las haya, las capacidades técnicas del sistema para explicar sus resultados de salida", subpartId: "13.3.b.iv", desde: VERSION_CATALOGO_RIA },
      { id: "MG_TRANS_14", code: "MG_TRANS_14", description: "Informar, cuando proceda, del funcionamiento del sistema respecto de las personas o colectivos con los que está previsto utilizarlo", subpartId: "13.3.b.v", desde: VERSION_CATALOGO_RIA },
      { id: "MG_TRANS_06", code: "MG_TRANS_06", description: "Especificar los requisitos de formato y calidad exigidos a los datos de entrada", subpartId: "13.3.b.vi" },
      { id: "MG_TRANS_07", code: "MG_TRANS_07", description: "Informar sobre el tipo y alcance de los datos de entrenamiento empleados", subpartId: "13.3.b.vi" },
      { id: "MG_TRANS_15", code: "MG_TRANS_15", description: "Dar a los responsables del despliegue la información necesaria para interpretar los resultados de salida y usarlos adecuadamente", subpartId: "13.3.b.vii", desde: VERSION_CATALOGO_RIA },
      { id: "MG_TRANS_08", code: "MG_TRANS_08", description: "Documentar los cambios del sistema y de su funcionamiento predeterminados en la evaluación de la conformidad inicial", subpartId: "13.3.c" },
      { id: "MG_TRANS_09", code: "MG_TRANS_09", description: "Describir las medidas de supervisión humana, incluidas las técnicas que facilitan a los responsables del despliegue interpretar los resultados", subpartId: "13.3.d" },
      { id: "MG_TRANS_10", code: "MG_TRANS_10", description: "Especificar los recursos informáticos y de hardware necesarios, la vida útil prevista y las medidas de mantenimiento y cuidado, con su frecuencia, incluidas las actualizaciones del software", subpartId: "13.3.e" },
      { id: "MG_TRANS_11", code: "MG_TRANS_11", description: "Describir los mecanismos que permiten a los responsables del despliegue recabar, almacenar e interpretar los archivos de registro", subpartId: "13.3.f" },
    ],
  },
  {
    code: "ACCURACY",
    title: "Precisión",
    articleRef: "Art. 15",
    description: "Alcanzar un nivel adecuado de precisión y declarar las métricas de rendimiento alcanzadas a lo largo de todo el ciclo de vida del sistema de IA.",
    verificadoEl: "2026-09-19",
    // Art. 15: el nivel y su uniformidad a lo largo del ciclo de vida son del
    // 15.1; las métricas que se declaran, del 15.3 (van en las instrucciones de
    // uso). El 15.2 son parámetros de referencia que fomenta la Comisión: no
    // es un deber del proveedor y no lleva medida.
    subparts: [
      { subpartId: "15.1", articleNumber: "Art. 15", titleShort: "Nivel adecuado de precisión y funcionamiento uniforme durante el ciclo de vida", orderIndex: 1 },
      { subpartId: "15.3", articleNumber: "Art. 15", titleShort: "Niveles de precisión y parámetros en las instrucciones de uso", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ACCU_01", code: "MG_ACCU_01", description: "Alcanzar un nivel de precisión adecuado validado en entornos reales de uso", subpartId: "15.1" },
      { id: "MG_ACCU_02", code: "MG_ACCU_02", description: "Declarar en las instrucciones de uso las métricas de precisión alcanzadas (F1, AUC, precisión, recall)", subpartId: "15.3" },
      { id: "MG_ACCU_03", code: "MG_ACCU_03", description: "Implementar mecanismos para asegurar la estabilidad de la precisión ante drift", subpartId: "15.1" },
    ],
  },
  {
    code: "ROBUSTNESS",
    title: "Solidez y robustez",
    articleRef: "Art. 15",
    description: "Asegurar que el sistema de IA sea lo más resistente posible frente a errores, fallos o incoherencias del propio sistema o de su entorno.",
    verificadoEl: "2026-09-19",
    // La solidez es el 15.4, en sus tres párrafos. Los intentos de alteración
    // por terceros no son solidez sino ciberseguridad (15.5), y el aprendizaje
    // tras la puesta en servicio es el párrafo tercero del 15.4: lo que exige
    // es cortar los bucles de retroalimentación sesgados, no «no degradar».
    subparts: [
      { subpartId: "15.4.p1", articleNumber: "Art. 15", titleShort: "Resistencia a errores, fallos e incoherencias", orderIndex: 1 },
      { subpartId: "15.4.p2", articleNumber: "Art. 15", titleShort: "Redundancia técnica y planes de prevención de fallos", orderIndex: 2 },
      { subpartId: "15.4.p3", articleNumber: "Art. 15", titleShort: "Bucles de retroalimentación en sistemas que siguen aprendiendo", orderIndex: 3 },
    ],
    measures: [
      { id: "MG_ROBU_01", code: "MG_ROBU_01", description: "Hacer el sistema lo más resistente posible a errores, fallos o incoherencias —incluidas las variaciones imprevistas en los datos de entrada— del propio sistema o de su entorno", subpartId: "15.4.p1" },
      { id: "MG_ROBU_02", code: "MG_ROBU_02", description: "Aplicar soluciones técnicas de redundancia y mitigación ante fallos del modelo", subpartId: "15.4.p2" },
      { id: "MG_ROBU_03", code: "MG_ROBU_03", description: "En sistemas que siguen aprendiendo tras su introducción en el mercado o puesta en servicio, eliminar o reducir el riesgo de que resultados sesgados influyan en entradas futuras (bucles de retroalimentación) y subsanarlos con medidas adecuadas", subpartId: "15.4.p3" },
    ],
  },
  {
    code: "CYBERSECURITY",
    title: "Ciberseguridad",
    articleRef: "Art. 15",
    description: "Proteger el sistema de IA contra accesos no autorizados, ataques adversarios, envenenamiento de datos y manipulación maliciosa.",
    verificadoEl: "2026-09-19",
    // La ciberseguridad es el 15.5 (se pintaba como 15.4, que es la solidez).
    subparts: [
      { subpartId: "15.5.terceros", articleNumber: "Art. 15", titleShort: "Resistencia a terceros no autorizados que aprovechen vulnerabilidades", orderIndex: 1 },
      { subpartId: "15.5.datos", articleNumber: "Art. 15", titleShort: "Envenenamiento de datos de entrenamiento", orderIndex: 2 },
      { subpartId: "15.5.modelos", articleNumber: "Art. 15", titleShort: "Envenenamiento de modelos y componentes preentrenados", orderIndex: 3 },
      { subpartId: "15.5.adversarios", articleNumber: "Art. 15", titleShort: "Ejemplos adversarios, ataques a la confidencialidad y defectos del modelo", orderIndex: 4 },
    ],
    measures: [
      { id: "MG_CIBE_01", code: "MG_CIBE_01", description: "Proteger la infraestructura contra accesos no autorizados y fugas de datos", subpartId: "15.5.terceros" },
      { id: "MG_CIBE_02", code: "MG_CIBE_02", description: "Implementar controles para prevenir el envenenamiento de datos (Data Poisoning)", subpartId: "15.5.datos" },
      { id: "MG_CIBE_03", code: "MG_CIBE_03", description: "Prevenir la manipulación no autorizada de modelos (Model Poisoning / Backdoors)", subpartId: "15.5.modelos" },
      { id: "MG_CIBE_04", code: "MG_CIBE_04", description: "Mitigar ataques de inyección de prompts, entradas adversarias y extracción de datos", subpartId: "15.5.adversarios" },
    ],
  },
  {
    code: "LOGGING",
    title: "Conservación de registros / Trazabilidad",
    articleRef: "Art. 12",
    description: "Habilitar el registro automático de acontecimientos (archivos de registro) a lo largo del ciclo de vida del sistema, con la trazabilidad adecuada a su finalidad prevista, y conservarlos el tiempo que exige el Reglamento.",
    verificadoEl: "2026-09-19",
    // El art. 12 tiene tres apartados. Los fines generales están en el 12.2; los
    // mínimos del 12.3 (período de uso, base de datos de referencia, datos con
    // correspondencia, personas que verifican) SOLO rigen para la identificación
    // biométrica remota del anexo III, punto 1, letra a), y antes se pintaban
    // como generales. La conservación de al menos seis meses no es del art. 12:
    // es del 19.1 (proveedor) y del 26.6 (responsable del despliegue).
    subparts: [
      { subpartId: "12.1", articleNumber: "Art. 12", titleShort: "Registro automático de acontecimientos durante todo el ciclo de vida", orderIndex: 1 },
      { subpartId: "12.2.a", articleNumber: "Art. 12", titleShort: "Fin del registro: detectar situaciones de riesgo o de modificación sustancial", orderIndex: 2 },
      { subpartId: "12.2.b", articleNumber: "Art. 12", titleShort: "Fin del registro: facilitar la vigilancia poscomercialización", orderIndex: 3 },
      { subpartId: "12.2.c", articleNumber: "Art. 12", titleShort: "Fin del registro: vigilar el funcionamiento por el responsable del despliegue", orderIndex: 4 },
      { subpartId: "12.3", articleNumber: "Art. 12", titleShort: "Mínimos reforzados: solo sistemas del anexo III, punto 1, letra a)", orderIndex: 5 },
      { subpartId: "12.3.a", articleNumber: "Art. 12", titleShort: "Período de cada uso (solo anexo III, punto 1, letra a))", orderIndex: 6 },
      { subpartId: "12.3.b", articleNumber: "Art. 12", titleShort: "Base de datos de referencia cotejada (solo anexo III, punto 1, letra a))", orderIndex: 7 },
      { subpartId: "12.3.c", articleNumber: "Art. 12", titleShort: "Datos de entrada con correspondencia (solo anexo III, punto 1, letra a))", orderIndex: 8 },
      { subpartId: "12.3.d", articleNumber: "Art. 12", titleShort: "Personas que verifican los resultados (solo anexo III, punto 1, letra a))", orderIndex: 9 },
      { subpartId: "19.1-26.6", articleNumber: "Arts. 19.1 y 26.6", titleShort: "Conservación de los archivos de registro, al menos seis meses (arts. 19 y 26.6)", orderIndex: 10 },
    ],
    measures: [
      { id: "MG_LOGG_01", code: "MG_LOGG_01", description: "Habilitar capacidades de registro automático de eventos técnicos y funcionales", subpartId: "12.1" },
      { id: "MG_LOGG_08", code: "MG_LOGG_08", description: "Registrar los acontecimientos que permitan detectar situaciones en que el sistema pueda presentar un riesgo (art. 79.1) o una modificación sustancial", subpartId: "12.2.a", desde: VERSION_CATALOGO_RIA },
      { id: "MG_LOGG_09", code: "MG_LOGG_09", description: "Registrar los acontecimientos que faciliten la vigilancia poscomercialización del art. 72", subpartId: "12.2.b", desde: VERSION_CATALOGO_RIA },
      { id: "MG_LOGG_10", code: "MG_LOGG_10", description: "Registrar los acontecimientos que permitan al responsable del despliegue vigilar el funcionamiento del sistema (art. 26.5)", subpartId: "12.2.c", desde: VERSION_CATALOGO_RIA },
      { id: "MG_LOGG_07", code: "MG_LOGG_07", description: "Determinar si el sistema es de identificación biométrica remota del anexo III, punto 1, letra a), y, si lo es, cumplir los mínimos reforzados de registro", subpartId: "12.3" },
      { id: "MG_LOGG_02", code: "MG_LOGG_02", description: "Registrar con marca de tiempo precisa el inicio y el fin de cada uso del sistema", subpartId: "12.3.a" },
      { id: "MG_LOGG_03", code: "MG_LOGG_03", description: "Registrar la base de datos de referencia con la que el sistema ha cotejado los datos de entrada", subpartId: "12.3.b" },
      { id: "MG_LOGG_04", code: "MG_LOGG_04", description: "Registrar los datos de entrada con los que la búsqueda ha arrojado una correspondencia", subpartId: "12.3.c" },
      { id: "MG_LOGG_05", code: "MG_LOGG_05", description: "Identificar a las personas físicas que verifican los resultados", subpartId: "12.3.d" },
      { id: "MG_LOGG_06", code: "MG_LOGG_06", description: "Conservar los archivos de registro bajo su control durante un período adecuado a la finalidad, de al menos seis meses, salvo que otra norma disponga otra cosa", subpartId: "19.1-26.6" },
    ],
  },
  {
    code: "TECHNICAL_DOC",
    title: "Documentación técnica",
    articleRef: "Art. 11",
    description: "Elaborar y mantener la documentación técnica completa del sistema antes de su introducción en el mercado o puesta en servicio con arreglo al Anexo IV.",
    verificadoEl: "2026-09-19",
    // Art. 11 y anexo IV: el 11.1 ya exige elaborarla antes y mantenerla
    // actualizada; el 11.2 es el conjunto único de documentos de los productos
    // del anexo I, sección A, así que ninguna de estas medidas es suya. Las
    // instrucciones de uso son el punto 1 h) del anexo IV; los datos, el 2 d);
    // y la validación y las pruebas, el 2 g).
    subparts: [
      { subpartId: "11.1", articleNumber: "Art. 11", titleShort: "Elaborada antes de la puesta en servicio y mantenida actualizada", orderIndex: 1 },
      { subpartId: "AnexoIV.1.a", articleNumber: "Anexo IV", titleShort: "Finalidad prevista, proveedor y versión del sistema", orderIndex: 2 },
      { subpartId: "AnexoIV.1.h", articleNumber: "Anexo IV", titleShort: "Instrucciones de uso para el responsable del despliegue", orderIndex: 3 },
      { subpartId: "AnexoIV.2.b", articleNumber: "Anexo IV", titleShort: "Especificaciones de diseño, algoritmos y arquitectura", orderIndex: 4 },
      { subpartId: "AnexoIV.2.d", articleNumber: "Anexo IV", titleShort: "Requisitos en materia de datos y conjuntos de entrenamiento", orderIndex: 5 },
      { subpartId: "AnexoIV.2.g", articleNumber: "Anexo IV", titleShort: "Procedimientos de validación y prueba, y sus parámetros", orderIndex: 6 },
    ],
    measures: [
      { id: "MG_TDOC_01", code: "MG_TDOC_01", description: "Elaborar el expediente técnico antes de la puesta en servicio del sistema", subpartId: "11.1" },
      { id: "MG_TDOC_02", code: "MG_TDOC_02", description: "Actualizar la documentación técnica ante cualquier cambio sustancial del modelo", subpartId: "11.1" },
      { id: "MG_TDOC_03", code: "MG_TDOC_03", description: "Documentar la descripción general, versiones y casos de uso previstos y no previstos", subpartId: "AnexoIV.1.a" },
      { id: "MG_TDOC_04", code: "MG_TDOC_04", description: "Redactar manuales claros de instrucciones de uso dirigidos a los responsables del despliegue", subpartId: "AnexoIV.1.h" },
      { id: "MG_TDOC_05", code: "MG_TDOC_05", description: "Documentar la arquitectura técnica, algoritmos y decisiones de diseño del modelo", subpartId: "AnexoIV.2.b" },
      { id: "MG_TDOC_06", code: "MG_TDOC_06", description: "Documentar el origen, preprocesamiento y linaje de los conjuntos de datos", subpartId: "AnexoIV.2.d" },
      { id: "MG_TDOC_07", code: "MG_TDOC_07", description: "Adjuntar los informes detallados de pruebas, validaciones y métricas de error", subpartId: "AnexoIV.2.g" },
    ],
  },
  {
    code: "POST_MARKET",
    title: "Vigilancia poscomercialización",
    articleRef: "Art. 72",
    description: "Establecer y documentar un sistema de vigilancia poscomercialización continuo para recopilar, analizar y evaluar datos sobre el rendimiento del sistema en producción.",
    verificadoEl: "2026-09-19",
    // El art. 72 tiene cuatro apartados: no hay 72.5. La evaluación del
    // cumplimiento permanente y los datos que facilitan los responsables del
    // despliegue son del 72.2; el 72.4 es la integración en los sistemas y
    // planes que ya exigen el anexo I, sección A, o el Derecho de servicios
    // financieros (anexo III, punto 5), y no tenía medida.
    subparts: [
      { subpartId: "72.1", articleNumber: "Art. 72", titleShort: "Sistema de vigilancia poscomercialización proporcionado", orderIndex: 1 },
      { subpartId: "72.2", articleNumber: "Art. 72", titleShort: "Recogida y análisis activos de datos durante toda la vida útil", orderIndex: 2 },
      { subpartId: "72.3", articleNumber: "Art. 72", titleShort: "Plan de vigilancia poscomercialización, parte de la documentación técnica", orderIndex: 3 },
      { subpartId: "72.4", articleNumber: "Art. 72", titleShort: "Integración en sistemas ya existentes (anexo I, sección A, o entidades financieras)", orderIndex: 4 },
    ],
    measures: [
      { id: "MG_POST_01", code: "MG_POST_01", description: "Establecer un sistema estructurado de vigilancia operativa poscomercialización", subpartId: "72.1" },
      { id: "MG_POST_02", code: "MG_POST_02", description: "Recoger, documentar y analizar activamente los datos de funcionamiento real, incluida cuando proceda la interacción con otros sistemas de IA", subpartId: "72.2" },
      { id: "MG_POST_04", code: "MG_POST_04", description: "Evaluar el cumplimiento permanente de los requisitos y adoptar las medidas que procedan, incluido el reentrenamiento", subpartId: "72.2" },
      { id: "MG_POST_05", code: "MG_POST_05", description: "Establecer canales de cooperación y reporte con los responsables del despliegue", subpartId: "72.2" },
      { id: "MG_POST_03", code: "MG_POST_03", description: "Elaborar un plan formal de vigilancia con métricas, umbrales y revisiones periódicas", subpartId: "72.3" },
      { id: "MG_POST_06", code: "MG_POST_06", description: "Si el sistema está regulado por el anexo I, sección A, o lo introduce una entidad financiera (anexo III, punto 5), decidir y documentar si la vigilancia se integra en los sistemas y planes ya existentes con un nivel de protección equivalente", subpartId: "72.4", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "INCIDENT_MGMT",
    title: "Gestión de incidentes graves",
    articleRef: "Art. 73",
    description: "Notificar los incidentes graves a las autoridades de vigilancia del mercado de los Estados miembros donde se produzcan, en los plazos del art. 73, investigarlos y adoptar medidas correctoras.",
    verificadoEl: "2026-09-19",
    // El art. 73 no notifica a los «afectados», sino a la autoridad de
    // vigilancia del mercado del Estado miembro donde ocurrió (que para una
    // entidad financiera no es necesariamente la AESIA: art. 74.6). Los plazos
    // son tres: 15 días (73.2), 2 días si hay infracción generalizada o
    // incidente del art. 3, punto 49, letra b) (73.3) y 10 días si hay un
    // fallecimiento (73.4). La investigación y la cooperación son del 73.6. El
    // registro de incidentes no es del art. 73: es del 17.1 k).
    subparts: [
      { subpartId: "73.1", articleNumber: "Art. 73", titleShort: "Notificación de incidentes graves y sus plazos (15, 10 y 2 días)", orderIndex: 1 },
      { subpartId: "73.6.p1", articleNumber: "Art. 73", titleShort: "Investigación, evaluación de riesgos y medidas correctoras", orderIndex: 2 },
      { subpartId: "73.6.p2", articleNumber: "Art. 73", titleShort: "Cooperación con las autoridades durante la investigación", orderIndex: 3 },
      { subpartId: "17.1.k", articleNumber: "Art. 17", titleShort: "Registro de incidentes y lecciones aprendidas", orderIndex: 4 },
    ],
    measures: [
      { id: "MG_INCI_01", code: "MG_INCI_01", description: "Protocolo para notificar los incidentes graves a la autoridad de vigilancia del mercado del Estado miembro donde ocurran: de inmediato y, como máximo, a los 15 días de conocerlos; a los 10 días si hay un fallecimiento; y a los 2 días si hay una infracción generalizada o una alteración grave e irreversible de la gestión o el funcionamiento de infraestructuras críticas. Admite una notificación inicial incompleta", subpartId: "73.1" },
      { id: "MG_INCI_02", code: "MG_INCI_02", description: "Adoptar medidas de contención y remediación ante fallos críticos sin modificar el sistema afectado de un modo que pueda repercutir en la evaluación posterior de las causas sin haber informado antes a las autoridades competentes", subpartId: "73.6.p1" },
      { id: "MG_INCI_03", code: "MG_INCI_03", description: "Investigar la causa raíz técnica y documentar las medidas correctoras", subpartId: "73.6.p1" },
      { id: "MG_INCI_04", code: "MG_INCI_04", description: "Proporcionar a las autoridades toda la información técnica requerida sobre el incidente", subpartId: "73.6.p2" },
      { id: "MG_INCI_05", code: "MG_INCI_05", description: "Custodiar el registro histórico de incidentes y lecciones aprendidas", subpartId: "17.1.k" },
    ],
  },
];

/**
 * Catálogo complementario ISO/IEC 42001 (sistema de gestión de la IA).
 *
 * SIEMPRE MARCO OPERATIVO: la norma es un marco de madurez y documentación, no
 * una obligación jurídica autónoma. `procedenciaDe` lo pinta así en cada medida.
 *
 * Renumerado (2026-09-19): el anexo A se pintaba desplazado («Políticas (A.5)»,
 * «Organización interna (A.6)», «Evaluación de impacto (A.8)», «Ciclo de vida
 * (A.9)»), cuando son A.2, A.3, A.5 y A.6; y cubría 4 de los 9 objetivos de
 * control. Ahora están los 9 (A.2 a A.10) y la planificación de la cláusula 6.1
 * (evaluación y tratamiento de riesgos e impacto: 6.1.2 a 6.1.4). Se cotejó la
 * NUMERACIÓN, no el texto de la norma, que no se ha tenido delante: por eso
 * estos requisitos no llevan `verificadoEl`. Los títulos son descripciones
 * propias, no transcripción de la norma.
 */
export const ISO_42001_REQUIREMENTS: RequirementDef[] = [
  {
    code: "ISO_POLICIES",
    title: "Políticas relativas a la IA (A.2)",
    articleRef: "ISO 42001 A.2",
    description: "Establecer, aprobar y comunicar directrices de gobernanza y políticas éticas para el uso de la IA en la organización.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.2.2", articleNumber: "anexo A, A.2", titleShort: "Política de IA alineada con la estrategia corporativa", orderIndex: 1 },
      { subpartId: "A.2.4", articleNumber: "anexo A, A.2", titleShort: "Revisión periódica de la política de IA", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ISO_POL_01", code: "MG_ISO_POL_01", description: "Aprobar la política corporativa de IA por el Consejo o Comité de Dirección", subpartId: "A.2.2" },
      { id: "MG_ISO_POL_02", code: "MG_ISO_POL_02", description: "Establecer calendario de revisión anual de la política de IA", subpartId: "A.2.4" },
    ],
  },
  {
    code: "ISO_ORG_ROLES",
    title: "Organización interna y roles (A.3)",
    articleRef: "ISO 42001 A.3",
    description: "Asignación clara de roles y responsabilidades sobre los sistemas de IA en la organización.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.3.2", articleNumber: "anexo A, A.3", titleShort: "Roles y responsabilidades sobre la IA", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_ORG_01", code: "MG_ISO_ORG_01", description: "Designar al responsable de gobernanza de IA (AI Officer) y equipos técnicos", subpartId: "A.3.2" },
      { id: "MG_ISO_ORG_02", code: "MG_ISO_ORG_02", description: "Constituir un Comité de Ética y Gobernanza de IA con reuniones periódicas", subpartId: "A.3.2" },
    ],
  },
  {
    code: "ISO_RESOURCES",
    title: "Recursos para los sistemas de IA (A.4)",
    articleRef: "ISO 42001 A.4",
    description: "Identificar y documentar los recursos que necesita cada sistema de IA a lo largo de su ciclo de vida.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.4", articleNumber: "anexo A, A.4", titleShort: "Datos, herramientas, recursos informáticos y personas", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_REC_01", code: "MG_ISO_REC_01", description: "Documentar los recursos del sistema: datos, herramientas, recursos informáticos y personas con las competencias necesarias", subpartId: "A.4", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "ISO_IMPACT_ASSESS",
    title: "Evaluación del impacto de sistemas de IA (A.5)",
    articleRef: "ISO 42001 A.5",
    description: "Evaluar las posibles consecuencias de cada sistema para las personas, los grupos y la sociedad antes de su despliegue.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.5.2", articleNumber: "anexo A, A.5", titleShort: "Proceso de evaluación de impacto del sistema", orderIndex: 1 },
      { subpartId: "A.5.3", articleNumber: "anexo A, A.5", titleShort: "Documentación de las evaluaciones de impacto", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ISO_IMP_01", code: "MG_ISO_IMP_01", description: "Ejecutar evaluación de impacto ético y de derechos fundamentales previa", subpartId: "A.5.2" },
      { id: "MG_ISO_IMP_02", code: "MG_ISO_IMP_02", description: "Documentar los resultados de las evaluaciones de impacto, con los riesgos identificados y su tratamiento, y conservarlos durante un período definido", subpartId: "A.5.3" },
    ],
  },
  {
    code: "ISO_LIFECYCLE",
    title: "Ciclo de vida del sistema de IA (A.6)",
    articleRef: "ISO 42001 A.6",
    description: "Aplicar salvaguardas operativas y controles de calidad en cada fase del ciclo de vida del sistema.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.6.2", articleNumber: "anexo A, A.6", titleShort: "Cambios, versiones y retirada del sistema", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_LIF_01", code: "MG_ISO_LIF_01", description: "Documentar el control de versiones y auditoría de cambios en producción", subpartId: "A.6.2" },
      { id: "MG_ISO_LIF_02", code: "MG_ISO_LIF_02", description: "Definir protocolo de apagado y retirada segura de sistemas obsoletos", subpartId: "A.6.2" },
    ],
  },
  {
    code: "ISO_DATA",
    title: "Datos para los sistemas de IA (A.7)",
    articleRef: "ISO 42001 A.7",
    description: "Gestionar los datos que usa cada sistema de IA: adquisición, calidad, procedencia y preparación.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.7", articleNumber: "anexo A, A.7", titleShort: "Calidad, procedencia y preparación de los datos", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_DAT_01", code: "MG_ISO_DAT_01", description: "Definir y documentar la adquisición, la calidad, la procedencia y la preparación de los datos del sistema", subpartId: "A.7", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "ISO_INFO_PARTIES",
    title: "Información para las partes interesadas (A.8)",
    articleRef: "ISO 42001 A.8",
    description: "Dar a quienes usan el sistema, y a las demás partes interesadas, la información que necesitan sobre él.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.8", articleNumber: "anexo A, A.8", titleShort: "Documentación, comunicación de incidentes e información externa", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_INF_01", code: "MG_ISO_INF_01", description: "Informar a las partes interesadas: documentación para quien usa el sistema, comunicación de incidentes e información externa", subpartId: "A.8", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "ISO_RESPONSIBLE_USE",
    title: "Uso de los sistemas de IA (A.9)",
    articleRef: "ISO 42001 A.9",
    description: "Usar los sistemas de IA de forma responsable y conforme a su uso previsto.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.9", articleNumber: "anexo A, A.9", titleShort: "Procesos, objetivos y uso previsto", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_USO_01", code: "MG_ISO_USO_01", description: "Definir los procesos y objetivos de uso responsable y el uso previsto del sistema", subpartId: "A.9", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "ISO_THIRD_PARTIES",
    title: "Relaciones con terceros y clientes (A.10)",
    articleRef: "ISO 42001 A.10",
    description: "Repartir y gestionar las responsabilidades con proveedores, socios y clientes a lo largo del ciclo de vida.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "A.10", articleNumber: "anexo A, A.10", titleShort: "Reparto de responsabilidades, proveedores y clientes", orderIndex: 1 },
    ],
    measures: [
      { id: "MG_ISO_TER_01", code: "MG_ISO_TER_01", description: "Repartir las responsabilidades con proveedores, socios y clientes a lo largo del ciclo de vida del sistema", subpartId: "A.10", desde: VERSION_CATALOGO_RIA },
    ],
  },
  {
    code: "ISO_RISK_PLANNING",
    title: "Riesgos e impacto de la IA en la planificación (6.1)",
    articleRef: "ISO 42001 6.1",
    description: "Planificar el sistema de gestión de la IA evaluando y tratando sus riesgos y el impacto de los sistemas.",
    caracter: "MARCO_OPERATIVO",
    subparts: [
      { subpartId: "6.1.2", articleNumber: "cláusula 6.1", titleShort: "Evaluación de los riesgos de la IA", orderIndex: 1 },
      { subpartId: "6.1.3", articleNumber: "cláusula 6.1", titleShort: "Tratamiento de los riesgos de la IA", orderIndex: 2 },
      { subpartId: "6.1.4", articleNumber: "cláusula 6.1", titleShort: "Evaluación del impacto de los sistemas de IA", orderIndex: 3 },
    ],
    measures: [
      { id: "MG_ISO_RIE_01", code: "MG_ISO_RIE_01", description: "Definir y aplicar un proceso de evaluación de los riesgos de la IA", subpartId: "6.1.2", desde: VERSION_CATALOGO_RIA },
      { id: "MG_ISO_RIE_02", code: "MG_ISO_RIE_02", description: "Definir y aplicar un proceso de tratamiento de esos riesgos, con los controles que se eligen y por qué", subpartId: "6.1.3", desde: VERSION_CATALOGO_RIA },
      { id: "MG_ISO_RIE_03", code: "MG_ISO_RIE_03", description: "Definir y aplicar un proceso de evaluación del impacto de los sistemas de IA", subpartId: "6.1.4", desde: VERSION_CATALOGO_RIA },
    ],
  },
];

/**
 * Obtiene el catálogo completo según el marco seleccionado
 */
export function getRequirementsForFramework(framework: string): RequirementDef[] {
  if (framework === "ISO_42001") {
    return ISO_42001_REQUIREMENTS;
  }
  return AESIA_RIA_REQUIREMENTS;
}

/**
 * Obtiene una lista plana de todas las medidas de un catálogo
 */
export function getAllMeasuresForFramework(framework: string): (MeasureGuideDef & { requirementCode: string; requirementTitle: string })[] {
  const reqs = getRequirementsForFramework(framework);
  return reqs.flatMap((r) =>
    r.measures.map((m) => ({
      ...m,
      requirementCode: r.code,
      requirementTitle: r.title,
    }))
  );
}

/**
 * Calcula estadísticas y score de una autoevaluación basada en AESIA Guía 16
 */
export interface AssessmentStats {
  totalMeasures: number;
  diagnosedCount: number;
  pendingCount: number;
  maturityScore: number; // 0 - 100
  planCounts: Record<string, number>; // '01' -> count, '02' -> count, etc.
  hasGaps: boolean;
  gapMeasures: { id: string; description: string; planCode: string }[];
}

export function computeAssessmentStats(
  measures: { id: string; description: string; requirementCode: string }[],
  assessmentsMap: Record<string, { maturity?: string | null; difficulty?: string | null; justification?: string | null; evidenceCount?: number | null }>
): AssessmentStats {
  const totalMeasures = measures.length;
  let diagnosedCount = 0;
  let matureConformingCount = 0;
  const planCounts: Record<string, number> = { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 };
  const gapMeasures: { id: string; description: string; planCode: string }[] = [];

  measures.forEach((m) => {
    const entry = assessmentsMap[m.id];
    const maturity = entry?.maturity;
    if (maturity) {
      diagnosedCount++;
      const plan = calculateAdaptationPlan(maturity);
      if (plan.code !== "00") {
        planCounts[plan.code] = (planCounts[plan.code] || 0) + 1;
      }
      // El criterio vive en `./conformidad` y es el mismo que persiste el
      // payload y que lee el KPI del dashboard. `L8` («no aplica») sólo
      // acredita CON su justificación: la escala la declara obligatoria.
      if (
        acreditaConformidad({
          status: maturity,
          justification: entry?.justification,
          evidenceCount: entry?.evidenceCount,
        })
      ) {
        matureConformingCount++;
      } else if (maturity === "L1" || maturity === "L2" || maturity === "L6") {
        gapMeasures.push({ id: m.id, description: m.description, planCode: plan.code });
      }
    }
  });

  const pendingCount = totalMeasures - diagnosedCount;
  const maturityScore = totalMeasures > 0 ? Math.round((matureConformingCount / totalMeasures) * 100) : 0;
  const hasGaps = gapMeasures.length > 0 || planCounts["01"] > 0 || planCounts["04"] > 0 || maturityScore < 80;

  return {
    totalMeasures,
    diagnosedCount,
    pendingCount,
    maturityScore,
    planCounts,
    hasGaps,
    gapMeasures,
  };
}
