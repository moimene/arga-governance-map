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
 * agrupación, NO una cita del apartado y la letra del artículo: su desglose no
 * se ha cotejado contra el texto del Reglamento. Por eso NO se pinta como
 * referencia legal en ninguna pantalla — se muestra `titleShort`, que es la
 * descripción del bloque, y para eso está `subpartTitle()`.
 */

export interface RequirementDef {
  code: string;
  title: string;
  articleRef: string;
  description: string;
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

export const DIFFICULTY_LEVELS: Record<string, DifficultyLevelDef> = {
  "00": { code: "00", label: "Alta dificultad", tone: "error" },
  "01": { code: "01", label: "Media dificultad", tone: "warning" },
  "02": { code: "02", label: "Baja dificultad", tone: "success" },
};

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
 * Catálogo Maestro de los 12 Requisitos Oficiales del RIA con sus 84 Medidas Guía (MG)
 */
export const AESIA_RIA_REQUIREMENTS: RequirementDef[] = [
  {
    code: "QUALITY_MGMT",
    title: "Sistema de gestión de la calidad",
    articleRef: "Art. 17",
    description: "Establecer, documentar y mantener un sistema de gestión de calidad que asegure el cumplimiento continuado del Reglamento de IA a lo largo de todo el ciclo de vida del sistema.",
    subparts: [
      { subpartId: "17.1.a", articleNumber: "Art. 17", titleShort: "Estrategia de cumplimiento normativo", orderIndex: 1 },
      { subpartId: "17.1.b", articleNumber: "Art. 17", titleShort: "Técnicas, procedimientos y acciones sistemáticas", orderIndex: 2 },
      { subpartId: "17.1.c", articleNumber: "Art. 17", titleShort: "Técnicas para diseño, control y verificación", orderIndex: 3 },
      { subpartId: "17.1.d", articleNumber: "Art. 17", titleShort: "Procedimientos para gestión de datos", orderIndex: 4 },
      { subpartId: "17.1.e", articleNumber: "Art. 17", titleShort: "Sistema de gestión de riesgos documentado", orderIndex: 5 },
      { subpartId: "17.1.f", articleNumber: "Art. 17", titleShort: "Vigilancia poscomercialización", orderIndex: 6 },
      { subpartId: "17.1.g", articleNumber: "Art. 17", titleShort: "Procedimientos de notificación", orderIndex: 7 },
      { subpartId: "17.1.h", articleNumber: "Art. 17", titleShort: "Comunicación con autoridades", orderIndex: 8 },
      { subpartId: "17.1.i", articleNumber: "Art. 17", titleShort: "Documentación y mantenimiento de información", orderIndex: 9 },
      { subpartId: "17.1.j", articleNumber: "Art. 17", titleShort: "Gestión de recursos y personal cualificado", orderIndex: 10 },
      { subpartId: "17.1.k", articleNumber: "Art. 17", titleShort: "Marco de responsabilidad de la dirección", orderIndex: 11 },
    ],
    measures: [
      { id: "MG_QUAL_01", code: "MG_QUAL_01", description: "Establecer una estrategia de cumplimiento normativo formal aprobada por la dirección", subpartId: "17.1.a" },
      { id: "MG_QUAL_02", code: "MG_QUAL_02", description: "Implementar técnicas y procedimientos sistemáticos para garantizar la calidad", subpartId: "17.1.b" },
      { id: "MG_QUAL_03", code: "MG_QUAL_03", description: "Aplicar técnicas de diseño, control de cambios y verificación formal", subpartId: "17.1.c" },
      { id: "MG_QUAL_04", code: "MG_QUAL_04", description: "Establecer procedimientos rigurosos para la gestión de datos en el SGC", subpartId: "17.1.d" },
      { id: "MG_QUAL_05", code: "MG_QUAL_05", description: "Documentar el sistema de gestión de riesgos integrado en el SGC", subpartId: "17.1.e" },
      { id: "MG_QUAL_06", code: "MG_QUAL_06", description: "Implementar un protocolo de vigilancia poscomercialización continuo", subpartId: "17.1.f" },
      { id: "MG_QUAL_07", code: "MG_QUAL_07", description: "Establecer procedimientos de notificación interna y externa de incidentes", subpartId: "17.1.g" },
      { id: "MG_QUAL_08", code: "MG_QUAL_08", description: "Definir los canales y responsables de comunicación con autoridades supervisoras", subpartId: "17.1.h" },
      { id: "MG_QUAL_09", code: "MG_QUAL_09", description: "Mantener la documentación e información técnica actualizada y custodiada", subpartId: "17.1.i" },
      { id: "MG_QUAL_10", code: "MG_QUAL_10", description: "Gestionar los recursos computacionales y competencias del personal", subpartId: "17.1.j" },
      { id: "MG_QUAL_11", code: "MG_QUAL_11", description: "Establecer un marco claro de rendición de cuentas de la alta dirección", subpartId: "17.1.k" },
    ],
  },
  {
    code: "RISK_MGMT",
    title: "Sistema de gestión de riesgos",
    articleRef: "Art. 9",
    description: "Establecer, aplicar, documentar y mantener un sistema de gestión de riesgos continuo y sistemático que identifique, evalúe y mitigue los riesgos conocidos y previsibles para la salud, la seguridad y los derechos fundamentales.",
    subparts: [
      { subpartId: "9.2.a", articleNumber: "Art. 9", titleShort: "Identificación y análisis de riesgos previsibles", orderIndex: 1 },
      { subpartId: "9.2.b", articleNumber: "Art. 9", titleShort: "Estimación y evaluación de riesgos sistemática", orderIndex: 2 },
      { subpartId: "9.2.c", articleNumber: "Art. 9", titleShort: "Evaluación de riesgos por uso previsto e indebido", orderIndex: 3 },
      { subpartId: "9.2.d", articleNumber: "Art. 9", titleShort: "Adopción de medidas adecuadas de gestión de riesgos", orderIndex: 4 },
      { subpartId: "9.4", articleNumber: "Art. 9", titleShort: "Pruebas y validación de medidas de gestión", orderIndex: 5 },
      { subpartId: "9.5", articleNumber: "Art. 9", titleShort: "Consideración de efectos acumulativos e interacciones", orderIndex: 6 },
      { subpartId: "9.6", articleNumber: "Art. 9", titleShort: "Diseño del sistema con nivel de riesgo residual aceptable", orderIndex: 7 },
      { subpartId: "9.7", articleNumber: "Art. 9", titleShort: "Pruebas para encontrar soluciones de mitigación más apropiadas", orderIndex: 8 },
      { subpartId: "9.8", articleNumber: "Art. 9", titleShort: "Medidas de gestión que no creen riesgos secundarios nuevos", orderIndex: 9 },
    ],
    measures: [
      { id: "MG_RISK_01", code: "MG_RISK_01", description: "Identificar y analizar los riesgos conocidos y previsibles para personas afectadas", subpartId: "9.2.a" },
      { id: "MG_RISK_02", code: "MG_RISK_02", description: "Estimar y evaluar los riesgos que puedan surgir durante el funcionamiento", subpartId: "9.2.b" },
      { id: "MG_RISK_03", code: "MG_RISK_03", description: "Evaluar los riesgos derivados del uso previsto y del uso indebido razonablemente previsible", subpartId: "9.2.c" },
      { id: "MG_RISK_04", code: "MG_RISK_04", description: "Adoptar medidas de gestión de riesgos eficaces y proporcionadas", subpartId: "9.2.d" },
      { id: "MG_RISK_05", code: "MG_RISK_05", description: "Realizar pruebas para verificar que las medidas de gestión cumplen sus objetivos", subpartId: "9.4" },
      { id: "MG_RISK_06", code: "MG_RISK_06", description: "Considerar los efectos sobre grupos vulnerables e interacciones entre sistemas", subpartId: "9.5" },
      { id: "MG_RISK_07", code: "MG_RISK_07", description: "Diseñar el sistema para asegurar que el riesgo residual resulte aceptable", subpartId: "9.6" },
      { id: "MG_RISK_08", code: "MG_RISK_08", description: "Ejecutar pruebas iterativas para seleccionar las mejores soluciones técnicas de mitigación", subpartId: "9.7" },
      { id: "MG_RISK_09", code: "MG_RISK_09", description: "Asegurar que las medidas de mitigación no introducen riesgos nuevos o desproporcionados", subpartId: "9.8" },
    ],
  },
  {
    code: "HUMAN_OVERSIGHT",
    title: "Supervisión humana",
    articleRef: "Art. 14",
    description: "Diseñar y desarrollar los sistemas de IA de alto riesgo de modo que puedan ser supervisados eficazmente por personas físicas durante su uso para prevenir o minimizar riesgos.",
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
    ],
  },
  {
    code: "DATA_GOVERNANCE",
    title: "Datos y gobernanza de datos",
    articleRef: "Art. 10",
    description: "Aplicar prácticas adecuadas de gobernanza y gestión de datos a los conjuntos de entrenamiento, validación y prueba para asegurar calidad, representatividad y mitigación de sesgos.",
    subparts: [
      { subpartId: "10.2.a", articleNumber: "Art. 10", titleShort: "Decisiones de diseño de datos pertinentes", orderIndex: 1 },
      { subpartId: "10.2.b", articleNumber: "Art. 10", titleShort: "Procesos de recogida de datos y origen", orderIndex: 2 },
      { subpartId: "10.2.c", articleNumber: "Art. 10", titleShort: "Operaciones de tratamiento y preparación", orderIndex: 3 },
      { subpartId: "10.2.d", articleNumber: "Art. 10", titleShort: "Formulación de supuestos sobre la información", orderIndex: 4 },
      { subpartId: "10.2.e", articleNumber: "Art. 10", titleShort: "Evaluación de disponibilidad, cantidad y adecuación", orderIndex: 5 },
      { subpartId: "10.2.f", articleNumber: "Art. 10", titleShort: "Examen de posibles sesgos en los datos", orderIndex: 6 },
      { subpartId: "10.2.g", articleNumber: "Art. 10", titleShort: "Identificación de lagunas o deficiencias de datos", orderIndex: 7 },
      { subpartId: "10.3", articleNumber: "Art. 10", titleShort: "Conjuntos pertinentes, representativos y libres de errores", orderIndex: 8 },
      { subpartId: "10.4", articleNumber: "Art. 10", titleShort: "Consideración de características contextuales geográficas y de población", orderIndex: 9 },
      { subpartId: "10.5", articleNumber: "Art. 10", titleShort: "Tratamiento de categorías especiales de datos personales", orderIndex: 10 },
    ],
    measures: [
      { id: "MG_DATA_01", code: "MG_DATA_01", description: "Documentar las decisiones de diseño y arquitectura de los conjuntos de datos", subpartId: "10.2.a" },
      { id: "MG_DATA_02", code: "MG_DATA_02", description: "Establecer procesos formales de recolección y trazabilidad del origen de los datos", subpartId: "10.2.b" },
      { id: "MG_DATA_03", code: "MG_DATA_03", description: "Definir operaciones estandarizadas de limpieza, transformación y etiquetado", subpartId: "10.2.c" },
      { id: "MG_DATA_04", code: "MG_DATA_04", description: "Formular y validar supuestos de representatividad sobre los datos usados", subpartId: "10.2.d" },
      { id: "MG_DATA_05", code: "MG_DATA_05", description: "Evaluar la disponibilidad, volumen y suficiencia estadística de las muestras", subpartId: "10.2.e" },
      { id: "MG_DATA_06", code: "MG_DATA_06", description: "Examinar la presencia de sesgos históricos o de muestreo que afecten a derechos", subpartId: "10.2.f" },
      { id: "MG_DATA_07", code: "MG_DATA_07", description: "Identificar lagunas informativas y aplicar medidas correctivas de enriquecimiento", subpartId: "10.2.g" },
      { id: "MG_DATA_08", code: "MG_DATA_08", description: "Asegurar que los datasets de validación y test sean estadísticamente representativos", subpartId: "10.3" },
      { id: "MG_DATA_09", code: "MG_DATA_09", description: "Considerar las características contextuales y demográficas del entorno de despliegue", subpartId: "10.4" },
      { id: "MG_DATA_10", code: "MG_DATA_10", description: "Garantizar las salvaguardas estrictas si se tratan categorías especiales bajo RGPD", subpartId: "10.5" },
    ],
  },
  {
    code: "TRANSPARENCY",
    title: "Transparencia e información a usuarios",
    articleRef: "Art. 13",
    description: "Diseñar los sistemas de modo que su funcionamiento sea transparente para que los usuarios puedan interpretar los resultados y utilizarlos de manera adecuada.",
    subparts: [
      { subpartId: "13.1", articleNumber: "Art. 13", titleShort: "Transparencia suficiente e interpretación de resultados", orderIndex: 1 },
      { subpartId: "13.3.a", articleNumber: "Art. 13", titleShort: "Identidad y datos de contacto del proveedor", orderIndex: 2 },
      { subpartId: "13.3.b.i", articleNumber: "Art. 13", titleShort: "Características, capacidades y límites de rendimiento", orderIndex: 3 },
      { subpartId: "13.3.b.ii", articleNumber: "Art. 13", titleShort: "Nivel de precisión y métricas de rendimiento pertinentes", orderIndex: 4 },
      { subpartId: "13.3.b.iii", articleNumber: "Art. 13", titleShort: "Circunstancias previsibles de uso indebido o anomalías", orderIndex: 5 },
      { subpartId: "13.3.b.iv", articleNumber: "Art. 13", titleShort: "Especificaciones de datos de entrada y requisitos técnicos", orderIndex: 6 },
      { subpartId: "13.3.b.v", articleNumber: "Art. 13", titleShort: "Información sobre datos de entrenamiento utilizados", orderIndex: 7 },
      { subpartId: "13.3.c", articleNumber: "Art. 13", titleShort: "Cambios previstos durante el ciclo de vida del sistema", orderIndex: 8 },
      { subpartId: "13.3.d", articleNumber: "Art. 13", titleShort: "Medidas de supervisión humana y recomendaciones de uso", orderIndex: 9 },
      { subpartId: "13.3.e", articleNumber: "Art. 13", titleShort: "Recursos computacionales y vida útil prevista", orderIndex: 10 },
      { subpartId: "13.3.f", articleNumber: "Art. 13", titleShort: "Mecanismos de registro de decisiones y trazabilidad", orderIndex: 11 },
    ],
    measures: [
      { id: "MG_TRANS_01", code: "MG_TRANS_01", description: "Diseñar el sistema para que su funcionamiento sea transparente para el usuario final", subpartId: "13.1" },
      { id: "MG_TRANS_02", code: "MG_TRANS_02", description: "Proporcionar de forma visible la identidad y datos de contacto del proveedor", subpartId: "13.3.a" },
      { id: "MG_TRANS_03", code: "MG_TRANS_03", description: "Documentar con claridad las características, capacidades y limitaciones del modelo", subpartId: "13.3.b.i" },
      { id: "MG_TRANS_04", code: "MG_TRANS_04", description: "Declarar de forma explícita el nivel de precisión y las métricas evaluadas", subpartId: "13.3.b.ii" },
      { id: "MG_TRANS_05", code: "MG_TRANS_05", description: "Describir las circunstancias en que el sistema puede degradar su rendimiento o fallar", subpartId: "13.3.b.iii" },
      { id: "MG_TRANS_06", code: "MG_TRANS_06", description: "Especificar los requisitos de formato y calidad exigidos a los datos de entrada", subpartId: "13.3.b.iv" },
      { id: "MG_TRANS_07", code: "MG_TRANS_07", description: "Informar sobre el tipo y alcance de los datos de entrenamiento empleados", subpartId: "13.3.b.v" },
      { id: "MG_TRANS_08", code: "MG_TRANS_08", description: "Documentar la política de actualizaciones y cambios continuos del sistema", subpartId: "13.3.c" },
      { id: "MG_TRANS_09", code: "MG_TRANS_09", description: "Describir las medidas de supervisión humana requeridas al usuario", subpartId: "13.3.d" },
      { id: "MG_TRANS_10", code: "MG_TRANS_10", description: "Especificar los recursos de hardware y software requeridos para la ejecución", subpartId: "13.3.e" },
      { id: "MG_TRANS_11", code: "MG_TRANS_11", description: "Proporcionar a los usuarios acceso al historial de decisiones y registro automático", subpartId: "13.3.f" },
    ],
  },
  {
    code: "ACCURACY",
    title: "Precisión",
    articleRef: "Art. 15",
    description: "Alcanzar un nivel adecuado de precisión y declarar las métricas de rendimiento alcanzadas a lo largo de todo el ciclo de vida del sistema de IA.",
    subparts: [
      { subpartId: "15.1.prec", articleNumber: "Art. 15", titleShort: "Nivel adecuado de precisión según finalidad prevista", orderIndex: 1 },
      { subpartId: "15.2.prec", articleNumber: "Art. 15", titleShort: "Declaración y comunicación de métricas de precisión", orderIndex: 2 },
      { subpartId: "15.3.prec", articleNumber: "Art. 15", titleShort: "Resiliencia de la precisión frente a variaciones de datos", orderIndex: 3 },
    ],
    measures: [
      { id: "MG_ACCU_01", code: "MG_ACCU_01", description: "Alcanzar un nivel de precisión adecuado validado en entornos reales de uso", subpartId: "15.1.prec" },
      { id: "MG_ACCU_02", code: "MG_ACCU_02", description: "Declarar formalmente las métricas de precisión alcanzadas (F1, AUC, precisión, recall)", subpartId: "15.2.prec" },
      { id: "MG_ACCU_03", code: "MG_ACCU_03", description: "Implementar mecanismos para asegurar la estabilidad de la precisión ante drift", subpartId: "15.3.prec" },
    ],
  },
  {
    code: "ROBUSTNESS",
    title: "Solidez y robustez",
    articleRef: "Art. 15",
    description: "Asegurar que el sistema de IA sea resistente frente a errores, fallos técnicos, anomalías en los datos de entrada o intentos maliciosos de alteración.",
    subparts: [
      { subpartId: "15.4.a", articleNumber: "Art. 15", titleShort: "Resistencia técnica frente a errores e imprevistos", orderIndex: 1 },
      { subpartId: "15.4.b", articleNumber: "Art. 15", titleShort: "Soluciones de redundancia y tolerancia a fallos", orderIndex: 2 },
      { subpartId: "15.5", articleNumber: "Art. 15", titleShort: "Robustez en modelos con aprendizaje continuo autónomo", orderIndex: 3 },
    ],
    measures: [
      { id: "MG_ROBU_01", code: "MG_ROBU_01", description: "Resistir intentos de alteración y variaciones imprevistas en los datos de entrada", subpartId: "15.4.a" },
      { id: "MG_ROBU_02", code: "MG_ROBU_02", description: "Aplicar soluciones técnicas de redundancia y mitigación ante fallos del modelo", subpartId: "15.4.b" },
      { id: "MG_ROBU_03", code: "MG_ROBU_03", description: "Asegurar que los modelos que aprenden tras el despliegue no degradan su comportamiento", subpartId: "15.5" },
    ],
  },
  {
    code: "CYBERSECURITY",
    title: "Ciberseguridad",
    articleRef: "Art. 15",
    description: "Proteger el sistema de IA contra accesos no autorizados, ataques adversarios, envenenamiento de datos y manipulación maliciosa.",
    subparts: [
      { subpartId: "15.4.ciber.a", articleNumber: "Art. 15", titleShort: "Protección contra accesos no autorizados e intrusiones", orderIndex: 1 },
      { subpartId: "15.4.ciber.b", articleNumber: "Art. 15", titleShort: "Prevención de envenenamiento de datos de entrenamiento", orderIndex: 2 },
      { subpartId: "15.4.ciber.c", articleNumber: "Art. 15", titleShort: "Prevención de manipulación de pesos y arquitectura", orderIndex: 3 },
      { subpartId: "15.4.ciber.d", articleNumber: "Art. 15", titleShort: "Mitigación de ataques de inyección y entradas adversarias", orderIndex: 4 },
    ],
    measures: [
      { id: "MG_CIBE_01", code: "MG_CIBE_01", description: "Proteger la infraestructura contra accesos no autorizados y fugas de datos", subpartId: "15.4.ciber.a" },
      { id: "MG_CIBE_02", code: "MG_CIBE_02", description: "Implementar controles para prevenir el envenenamiento de datos (Data Poisoning)", subpartId: "15.4.ciber.b" },
      { id: "MG_CIBE_03", code: "MG_CIBE_03", description: "Prevenir la manipulación no autorizada de modelos (Model Poisoning / Backdoors)", subpartId: "15.4.ciber.c" },
      { id: "MG_CIBE_04", code: "MG_CIBE_04", description: "Mitigar ataques de inyección de prompts, entradas adversarias y extracción de datos", subpartId: "15.4.ciber.d" },
    ],
  },
  {
    code: "LOGGING",
    title: "Conservación de registros / Trazabilidad",
    articleRef: "Art. 12",
    description: "Habilitar el registro automático de eventos (logs) a lo largo del ciclo de vida del sistema para garantizar la trazabilidad de su funcionamiento.",
    subparts: [
      { subpartId: "12.1", articleNumber: "Art. 12", titleShort: "Capacidad de registro automático continuo de eventos", orderIndex: 1 },
      { subpartId: "12.2.a", articleNumber: "Art. 12", titleShort: "Registro de períodos de uso y sesiones de ejecución", orderIndex: 2 },
      { subpartId: "12.2.b", articleNumber: "Art. 12", titleShort: "Mantenimiento de bases de datos de referencia consultadas", orderIndex: 3 },
      { subpartId: "12.2.c", articleNumber: "Art. 12", titleShort: "Registro de datos de entrada y consultas formuladas", orderIndex: 4 },
      { subpartId: "12.2.d", articleNumber: "Art. 12", titleShort: "Identificación de personas físicas implicadas en la supervisión", orderIndex: 5 },
      { subpartId: "12.3", articleNumber: "Art. 12", titleShort: "Adecuación y proporcionalidad de los registros a la finalidad", orderIndex: 6 },
      { subpartId: "12.4", articleNumber: "Art. 12", titleShort: "Requisitos reforzados para sistemas de identificación biométrica", orderIndex: 7 },
    ],
    measures: [
      { id: "MG_LOGG_01", code: "MG_LOGG_01", description: "Habilitar capacidades de registro automático de eventos técnicos y funcionales", subpartId: "12.1" },
      { id: "MG_LOGG_02", code: "MG_LOGG_02", description: "Registrar con marca de tiempo precisa cada período de uso y ejecución del sistema", subpartId: "12.2.a" },
      { id: "MG_LOGG_03", code: "MG_LOGG_03", description: "Mantener registro de las bases de datos externas consultadas para cada inferencia", subpartId: "12.2.b" },
      { id: "MG_LOGG_04", code: "MG_LOGG_04", description: "Registrar los datos de entrada clave asociados a cada resultado o recomendación", subpartId: "12.2.c" },
      { id: "MG_LOGG_05", code: "MG_LOGG_05", description: "Identificar inequívocamente a los operadores o supervisores involucrados", subpartId: "12.2.d" },
      { id: "MG_LOGG_06", code: "MG_LOGG_06", description: "Adecuar los períodos de retención y custodia de logs a las obligaciones legales", subpartId: "12.3" },
      { id: "MG_LOGG_07", code: "MG_LOGG_07", description: "Cumplir requisitos reforzados de trazabilidad en sistemas biométricos de alto riesgo", subpartId: "12.4" },
    ],
  },
  {
    code: "TECHNICAL_DOC",
    title: "Documentación técnica",
    articleRef: "Art. 11",
    description: "Elaborar y mantener la documentación técnica completa del sistema antes de su introducción en el mercado o puesta en servicio con arreglo al Anexo IV.",
    subparts: [
      { subpartId: "11.1", articleNumber: "Art. 11", titleShort: "Elaboración de documentación técnica previa", orderIndex: 1 },
      { subpartId: "11.2", articleNumber: "Art. 11", titleShort: "Mantenimiento y actualización continua del expediente", orderIndex: 2 },
      { subpartId: "AnexoIV.1.a", articleNumber: "Anexo IV", titleShort: "Descripción general del sistema y uso previsto", orderIndex: 3 },
      { subpartId: "AnexoIV.1.b", articleNumber: "Anexo IV", titleShort: "Descripción de elementos e instrucciones de uso", orderIndex: 4 },
      { subpartId: "AnexoIV.2.a", articleNumber: "Anexo IV", titleShort: "Métodos de desarrollo y lógica del modelo", orderIndex: 5 },
      { subpartId: "AnexoIV.2.b", articleNumber: "Anexo IV", titleShort: "Procedimientos de diseño y especificaciones de datos", orderIndex: 6 },
      { subpartId: "AnexoIV.2.c", articleNumber: "Anexo IV", titleShort: "Resultados del sistema de pruebas y validación", orderIndex: 7 },
    ],
    measures: [
      { id: "MG_TDOC_01", code: "MG_TDOC_01", description: "Elaborar el expediente técnico antes de la puesta en servicio del sistema", subpartId: "11.1" },
      { id: "MG_TDOC_02", code: "MG_TDOC_02", description: "Actualizar la documentación técnica ante cualquier cambio sustancial del modelo", subpartId: "11.2" },
      { id: "MG_TDOC_03", code: "MG_TDOC_03", description: "Documentar la descripción general, versiones y casos de uso previstos y no previstos", subpartId: "AnexoIV.1.a" },
      { id: "MG_TDOC_04", code: "MG_TDOC_04", description: "Redactar manuales claros de instrucciones de uso dirigidos a los desplegadores", subpartId: "AnexoIV.1.b" },
      { id: "MG_TDOC_05", code: "MG_TDOC_05", description: "Documentar la arquitectura técnica, algoritmos y decisiones de diseño del modelo", subpartId: "AnexoIV.2.a" },
      { id: "MG_TDOC_06", code: "MG_TDOC_06", description: "Documentar el origen, preprocesamiento y linaje de los conjuntos de datos", subpartId: "AnexoIV.2.b" },
      { id: "MG_TDOC_07", code: "MG_TDOC_07", description: "Adjuntar los informes detallados de pruebas, validaciones y métricas de error", subpartId: "AnexoIV.2.c" },
    ],
  },
  {
    code: "POST_MARKET",
    title: "Vigilancia poscomercialización",
    articleRef: "Art. 72",
    description: "Establecer y documentar un sistema de vigilancia poscomercialización continuo para recopilar, analizar y evaluar datos sobre el rendimiento del sistema en producción.",
    subparts: [
      { subpartId: "72.1", articleNumber: "Art. 72", titleShort: "Establecimiento del sistema de vigilancia poscomercialización", orderIndex: 1 },
      { subpartId: "72.2", articleNumber: "Art. 72", titleShort: "Recogida, documentación y análisis activo de datos de uso", orderIndex: 2 },
      { subpartId: "72.3", articleNumber: "Art. 72", titleShort: "Plan de vigilancia poscomercialización proporcionado", orderIndex: 3 },
      { subpartId: "72.4", articleNumber: "Art. 72", titleShort: "Evaluación continua de la conformidad del sistema", orderIndex: 4 },
      { subpartId: "72.5", articleNumber: "Art. 72", titleShort: "Cooperación y retroalimentación con los responsables de despliegue", orderIndex: 5 },
    ],
    measures: [
      { id: "MG_POST_01", code: "MG_POST_01", description: "Establecer un sistema estructurado de vigilancia operativa poscomercialización", subpartId: "72.1" },
      { id: "MG_POST_02", code: "MG_POST_02", description: "Recoger, documentar y analizar activamente los datos de funcionamiento real", subpartId: "72.2" },
      { id: "MG_POST_03", code: "MG_POST_03", description: "Elaborar un plan formal de vigilancia con métricas, umbrales y revisiones periódicas", subpartId: "72.3" },
      { id: "MG_POST_04", code: "MG_POST_04", description: "Evaluar periódicamente la conformidad y adoptar medidas de reentrenamiento", subpartId: "72.4" },
      { id: "MG_POST_05", code: "MG_POST_05", description: "Establecer canales de cooperación y reporte con los usuarios del sistema", subpartId: "72.5" },
    ],
  },
  {
    code: "INCIDENT_MGMT",
    title: "Gestión de incidentes graves",
    articleRef: "Art. 73",
    description: "Notificar a las autoridades competentes y a los afectados cualquier incidente grave o mal funcionamiento del sistema en los plazos reglamentarios y adoptar medidas correctoras.",
    subparts: [
      { subpartId: "73.1", articleNumber: "Art. 73", titleShort: "Notificación de incidentes graves en un plazo máximo de 15 días", orderIndex: 1 },
      { subpartId: "73.2", articleNumber: "Art. 73", titleShort: "Adopción de medidas correctoras inmediatas", orderIndex: 2 },
      { subpartId: "73.3", articleNumber: "Art. 73", titleShort: "Investigación rigurosa de causas y evaluación de riesgos", orderIndex: 3 },
      { subpartId: "73.4", articleNumber: "Art. 73", titleShort: "Cooperación plena con la AESIA y autoridades supervisoras", orderIndex: 4 },
      { subpartId: "73.5", articleNumber: "Art. 73", titleShort: "Registro y custodia de expedientes de incidentes e investigaciones", orderIndex: 5 },
    ],
    measures: [
      { id: "MG_INCI_01", code: "MG_INCI_01", description: "Protocolo para notificar a la AESIA incidentes graves en un plazo máximo de 15 días", subpartId: "73.1" },
      { id: "MG_INCI_02", code: "MG_INCI_02", description: "Adoptar medidas de contención y remediación inmediata ante fallos críticos", subpartId: "73.2" },
      { id: "MG_INCI_03", code: "MG_INCI_03", description: "Investigar la causa raíz técnica y documentar las medidas correctoras", subpartId: "73.3" },
      { id: "MG_INCI_04", code: "MG_INCI_04", description: "Proporcionar a las autoridades toda la información técnica requerida sobre el incidente", subpartId: "73.4" },
      { id: "MG_INCI_05", code: "MG_INCI_05", description: "Custodiar el registro histórico de incidentes y lecciones aprendidas", subpartId: "73.5" },
    ],
  },
];

/**
 * Catálogo complementario ISO/IEC 42001 (Sistema de Gestión de Inteligencia Artificial)
 */
export const ISO_42001_REQUIREMENTS: RequirementDef[] = [
  {
    code: "ISO_POLICIES",
    title: "Políticas relativas a la IA (A.5)",
    articleRef: "ISO 42001 A.5",
    description: "Establecer, aprobar y comunicar directrices de gobernanza y políticas éticas para el uso de la IA en la organización.",
    subparts: [
      { subpartId: "A.5.1", articleNumber: "A.5", titleShort: "Política de IA alineada con la estrategia corporativa", orderIndex: 1 },
      { subpartId: "A.5.2", articleNumber: "A.5", titleShort: "Revisión periódica y actualización de directrices de IA", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ISO_POL_01", code: "MG_ISO_POL_01", description: "Aprobar la política corporativa de IA por el Consejo o Comité de Dirección", subpartId: "A.5.1" },
      { id: "MG_ISO_POL_02", code: "MG_ISO_POL_02", description: "Establecer calendario de revisión anual de la política de IA", subpartId: "A.5.2" },
    ],
  },
  {
    code: "ISO_ORG_ROLES",
    title: "Organización interna y roles (A.6)",
    articleRef: "ISO 42001 A.6",
    description: "Asignación clara de responsabilidades, roles de supervisión técnica y segregación de funciones.",
    subparts: [
      { subpartId: "A.6.1", articleNumber: "A.6", titleShort: "Definición y asignación de roles y responsabilidades de IA", orderIndex: 1 },
      { subpartId: "A.6.2", articleNumber: "A.6", titleShort: "Segregación de funciones y comités de supervisión", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ISO_ORG_01", code: "MG_ISO_ORG_01", description: "Designar al responsable de gobernanza de IA (AI Officer) y equipos técnicos", subpartId: "A.6.1" },
      { id: "MG_ISO_ORG_02", code: "MG_ISO_ORG_02", description: "Constituir un Comité de Ética y Gobernanza de IA con reuniones periódicas", subpartId: "A.6.2" },
    ],
  },
  {
    code: "ISO_IMPACT_ASSESS",
    title: "Evaluación del impacto de sistemas de IA (A.8)",
    articleRef: "ISO 42001 A.8",
    description: "Evaluar el impacto ético, social y sobre derechos fundamentales de cada sistema antes de su despliegue.",
    subparts: [
      { subpartId: "A.8.1", articleNumber: "A.8", titleShort: "Metodología formal de evaluación de impacto de IA", orderIndex: 1 },
      { subpartId: "A.8.2", articleNumber: "A.8", titleShort: "Documentación y mitigación de impactos negativos", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ISO_IMP_01", code: "MG_ISO_IMP_01", description: "Ejecutar evaluación de impacto ético y de derechos fundamentales previa", subpartId: "A.8.1" },
      { id: "MG_ISO_IMP_02", code: "MG_ISO_IMP_02", description: "Establecer planes de mitigación para los riesgos éticos identificados", subpartId: "A.8.2" },
    ],
  },
  {
    code: "ISO_LIFECYCLE",
    title: "Ciclo de vida del sistema de IA (A.9)",
    articleRef: "ISO 42001 A.9",
    description: "Aplicar salvaguardas operativas y controles de calidad en cada fase del ciclo de vida del sistema.",
    subparts: [
      { subpartId: "A.9.1", articleNumber: "A.9", titleShort: "Gestión de cambios y control de versiones del modelo", orderIndex: 1 },
      { subpartId: "A.9.2", articleNumber: "A.9", titleShort: "Criterios formales de retirada segura y obsolescencia", orderIndex: 2 },
    ],
    measures: [
      { id: "MG_ISO_LIF_01", code: "MG_ISO_LIF_01", description: "Documentar el control de versiones y auditoría de cambios en producción", subpartId: "A.9.1" },
      { id: "MG_ISO_LIF_02", code: "MG_ISO_LIF_02", description: "Definir protocolo de apagado y retirada segura de sistemas obsoletos", subpartId: "A.9.2" },
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
  measures: (MeasureGuideDef & { requirementCode: string })[],
  assessmentsMap: Record<string, { maturity?: string | null; difficulty?: string | null }>
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
      // Consideramos conformes L5 (Adaptación completa) y L8 (No necesaria justificada)
      if (maturity === "L5" || maturity === "L8") {
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
