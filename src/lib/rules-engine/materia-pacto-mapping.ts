// ============================================================
// ITEM-113 — Normalización de materias para pactos parasociales
// ============================================================
//
// Problema (ITEM-113): los pactos parasociales nunca disparan porque el
// vocabulario de materias de las cláusulas Cloud es disjunto del vocabulario
// operativo de los flujos (AGENDA_MATERIAS, agreement_kind, etc.):
//
//   - Cloud cláusulas: AMPLIACION_CAPITAL, VENTA_ACTIVOS_SUSTANCIALES,
//                      DISOLUCION, FUSION, ESCISION, TRANSFORMACION, ...
//   - Flujo operativo:  AUMENTO_CAPITAL, VENTA_ACTIVOS_ESENCIALES,
//                      LIQUIDACION, OPERACION_ESTRUCTURAL, ...
//
// El matching directo `materias_aplicables.includes(materia)` devolvía siempre
// 'no aplica' aunque jurídicamente fueran la misma materia.
//
// Este módulo define una tabla de normalización canónica que colapsa los
// sinónimos a una clave única, de modo que el matching pueda compararse en el
// espacio normalizado. No muta los datos de origen — solo normaliza para el
// criterio de coincidencia.
// ============================================================

/**
 * ITEM-113 — Materia canónica de cláusula de pacto.
 *
 * Es la clave a la que se colapsan todos los sinónimos operativos y de Cloud.
 * Se eligen las grafías estructurales más estables del dominio LSC.
 */
export type MateriaPactoCanonica =
  | 'AMPLIACION_CAPITAL'
  | 'REDUCCION_CAPITAL'
  | 'FUSION'
  | 'ESCISION'
  | 'LIQUIDACION'
  | 'TRANSFORMACION'
  | 'VENTA_ACTIVOS_ESENCIALES'
  | 'OPERACION_VINCULADA'
  | 'EMISION_CONVERTIBLES'
  | 'EXCLUSION_PREFERENTE';

// ITEM-113 — Tabla de sinónimos → materia canónica de cláusula de pacto.
// Las claves se comparan tras normalizar (UPPER + trim + colapso de separadores).
const MATERIA_PACTO_SYNONYMS: Record<string, MateriaPactoCanonica> = {
  // — Ampliación / aumento de capital —
  AMPLIACION_CAPITAL: 'AMPLIACION_CAPITAL',
  AUMENTO_CAPITAL: 'AMPLIACION_CAPITAL',
  AUMENTO_DE_CAPITAL: 'AMPLIACION_CAPITAL',
  AMPLIACION_DE_CAPITAL: 'AMPLIACION_CAPITAL',

  // — Reducción de capital —
  REDUCCION_CAPITAL: 'REDUCCION_CAPITAL',
  REDUCCION_DE_CAPITAL: 'REDUCCION_CAPITAL',

  // — Disolución / liquidación —
  // El pacto demo usa DISOLUCION; el catálogo operativo usa LIQUIDACION.
  DISOLUCION: 'LIQUIDACION',
  LIQUIDACION: 'LIQUIDACION',
  DISOLUCION_LIQUIDACION: 'LIQUIDACION',

  // — Operaciones estructurales puras —
  FUSION: 'FUSION',
  ESCISION: 'ESCISION',
  TRANSFORMACION: 'TRANSFORMACION',

  // — Venta de activos esenciales / sustanciales —
  VENTA_ACTIVOS_ESENCIALES: 'VENTA_ACTIVOS_ESENCIALES',
  VENTA_ACTIVOS_SUSTANCIALES: 'VENTA_ACTIVOS_ESENCIALES',
  VENTA_ACTIVOS: 'VENTA_ACTIVOS_ESENCIALES',
  VENTA_DE_ACTIVOS_ESENCIALES: 'VENTA_ACTIVOS_ESENCIALES',
  ENAJENACION_ACTIVOS_ESENCIALES: 'VENTA_ACTIVOS_ESENCIALES',

  // — Operaciones vinculadas —
  OPERACION_VINCULADA: 'OPERACION_VINCULADA',
  OPERACIONES_VINCULADAS: 'OPERACION_VINCULADA',

  // — Emisión de convertibles —
  EMISION_CONVERTIBLES: 'EMISION_CONVERTIBLES',
  EMISION_DEUDA_CONVERTIBLE: 'EMISION_CONVERTIBLES',
  EMISION_OBLIGACIONES_CONVERTIBLES: 'EMISION_CONVERTIBLES',

  // — Exclusión del derecho de suscripción preferente —
  EXCLUSION_PREFERENTE: 'EXCLUSION_PREFERENTE',
  EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE: 'EXCLUSION_PREFERENTE',
  EXCLUSION_SUSCRIPCION_PREFERENTE: 'EXCLUSION_PREFERENTE',
};

// ITEM-113 — Materias "paraguas" que expanden a un conjunto de materias
// canónicas estructurales. P.ej. CoAprobacionStepper ofrece la materia
// agregada OPERACION_ESTRUCTURAL sin distinguir el subtipo; debe disparar el
// veto de Fundación ARGA sobre cualquier operación estructural.
const MATERIA_PACTO_UMBRELLAS: Record<string, MateriaPactoCanonica[]> = {
  OPERACION_ESTRUCTURAL: [
    'FUSION',
    'ESCISION',
    'LIQUIDACION',
    'TRANSFORMACION',
    'VENTA_ACTIVOS_ESENCIALES',
  ],
  OPERACIONES_ESTRUCTURALES: [
    'FUSION',
    'ESCISION',
    'LIQUIDACION',
    'TRANSFORMACION',
    'VENTA_ACTIVOS_ESENCIALES',
  ],
  AUTORIZACION_OPERACION_ESTRUCTURAL: [
    'FUSION',
    'ESCISION',
    'LIQUIDACION',
    'TRANSFORMACION',
    'VENTA_ACTIVOS_ESENCIALES',
  ],
};

// ITEM-113 — Normaliza la grafía cruda a la forma canónica de comparación
// (UPPER, sin acentos, separadores colapsados a '_').
function normalizeKey(materia: string): string {
  return materia
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (tildes)
    .trim()
    .toUpperCase()
    .replace(/[\s\-./]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * ITEM-113 — Normaliza una materia operativa al conjunto de materias canónicas
 * de cláusula de pacto a las que equivale.
 *
 * - Devuelve un array porque una materia paraguas (OPERACION_ESTRUCTURAL)
 *   expande a varias canónicas.
 * - Si la materia no tiene mapeo conocido, devuelve su propia forma normalizada
 *   (sin expandir) para no perder coincidencias literales.
 */
export function normalizeMateriaPacto(materia: string): string[] {
  if (!materia) return [];
  const key = normalizeKey(materia);
  if (!key) return [];

  const umbrella = MATERIA_PACTO_UMBRELLAS[key];
  if (umbrella) return [...umbrella];

  const canonical = MATERIA_PACTO_SYNONYMS[key];
  if (canonical) return [canonical];

  // Sin mapeo conocido: devolver la forma normalizada literal.
  return [key];
}

/**
 * ITEM-113 — Determina si una materia de acuerdo coincide (tras normalización)
 * con alguna de las materias aplicables de un pacto.
 *
 * Compara en el espacio normalizado: expande ambos lados con
 * `normalizeMateriaPacto` y comprueba intersección.
 */
export function materiaPactoCoincide(
  materiaAcuerdo: string,
  materiasPacto: string[],
): boolean {
  const acuerdoNorm = new Set(normalizeMateriaPacto(materiaAcuerdo));
  if (acuerdoNorm.size === 0) return false;
  for (const mp of materiasPacto) {
    for (const norm of normalizeMateriaPacto(mp)) {
      if (acuerdoNorm.has(norm)) return true;
    }
  }
  return false;
}

/**
 * ITEM-113 — Devuelve las materias del acuerdo que coinciden (tras
 * normalización) con las materias aplicables del pacto. Conserva la grafía
 * original de las materias del acuerdo para los mensajes de explain.
 */
export function materiasPactoCoincidentes(
  materiasAcuerdo: string[],
  materiasPacto: string[],
): string[] {
  return materiasAcuerdo.filter((m) => materiaPactoCoincide(m, materiasPacto));
}
