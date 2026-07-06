import type { TipoOrgano } from "@/lib/rules-engine";

/**
 * Catálogo canónico de materias del orden del día y su mapeo materia × órgano.
 *
 * Extraído de `ConvocatoriasStepper.tsx` (coherencia del módulo, 2026-07-03)
 * para que la estructura "materias propias del órgano / transversales / punto
 * libre" sea un modelo testable y reutilizable, no una lista plana embebida
 * en la página. El contenido de AGENDA_MATERIAS y MATERIA_ORGANOS es el
 * catálogo previo verbatim (ids canónicos de materia_catalog 20260424_000033).
 */

export interface AgendaMateriaDef {
  value: string;
  label: string;
  tipo: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribible: boolean;
  /** Especialidades LMV/CNMV aplicables si la entidad es SA cotizada. */
  lmvCotizada: boolean;
}

export const ALL_ORGANOS: TipoOrgano[] = ["JUNTA_GENERAL", "CONSEJO", "COMISION_DELEGADA"];
export const JUNTA_ONLY: TipoOrgano[] = ["JUNTA_GENERAL"];
export const CONSEJO_SCOPE: TipoOrgano[] = ["CONSEJO", "COMISION_DELEGADA"];
export const JUNTA_AND_CONSEJO: TipoOrgano[] = ["JUNTA_GENERAL", "CONSEJO", "COMISION_DELEGADA"];

// `lmvCotizada=true` marca materias con especialidades aplicables a SA
// cotizadas (LMV / Código de Buen Gobierno CNMV). NO cambia la clase de
// materia (sigue siendo ORDINARIA/ESTATUTARIA/ESTRUCTURAL para el motor),
// pero activa advertencias en la UI si la entidad es cotizada.
export const AGENDA_MATERIAS: readonly AgendaMateriaDef[] = [
  // Consejo / órgano de administración
  { value: "APROBACION_PLAN_NEGOCIO", label: "Aprobación del plan de negocio", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "APROBACION_PRESUPUESTOS", label: "Aprobación del presupuesto anual", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "FORMULACION_CUENTAS", label: "Formulación de cuentas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "FINANCIACION", label: "Aprobación de financiación", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "CONTRATACION_RELEVANTE", label: "Contratación relevante", tipo: "ORDINARIA", inscribible: false, lmvCotizada: true },
  { value: "COMITES_INTERNOS", label: "Constitución o modificación de comités internos", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "DISTRIBUCION_CARGOS", label: "Distribución de cargos del consejo", tipo: "ORDINARIA", inscribible: true, lmvCotizada: false },
  { value: "POLITICAS_CORPORATIVAS", label: "Aprobación de políticas corporativas", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "RATIFICACION_ACTOS", label: "Ratificación de actos previos", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
  { value: "SEGUROS_RESPONSABILIDAD", label: "Seguro de responsabilidad de administradores", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },

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
  // Alta 2026-07-03 (coherencia fase 3): materia de Junta del art. 238 LSC,
  // registrada también en materia_catalog (migración 20260706131043).
  { value: "ACCION_SOCIAL_RESPONSABILIDAD", label: "Acción social de responsabilidad", tipo: "ORDINARIA", inscribible: false, lmvCotizada: false },
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
];

export const MATERIA_ORGANOS: Record<string, TipoOrgano[]> = {
  APROBACION_PLAN_NEGOCIO: CONSEJO_SCOPE,
  APROBACION_PRESUPUESTOS: CONSEJO_SCOPE,
  FORMULACION_CUENTAS: CONSEJO_SCOPE,
  FINANCIACION: CONSEJO_SCOPE,
  CONTRATACION_RELEVANTE: CONSEJO_SCOPE,
  COMITES_INTERNOS: CONSEJO_SCOPE,
  DISTRIBUCION_CARGOS: CONSEJO_SCOPE,
  POLITICAS_CORPORATIVAS: CONSEJO_SCOPE,
  RATIFICACION_ACTOS: CONSEJO_SCOPE,
  SEGUROS_RESPONSABILIDAD: CONSEJO_SCOPE,
  APROBACION_CUENTAS: JUNTA_ONLY,
  APLICACION_RESULTADO: JUNTA_ONLY,
  DISTRIBUCION_DIVIDENDOS: JUNTA_ONLY,
  DISTRIBUCION_RESERVAS: JUNTA_ONLY,
  NOMBRAMIENTO_CONSEJERO: JUNTA_AND_CONSEJO,
  REELECCION_CONSEJERO: JUNTA_ONLY,
  CESE_CONSEJERO: JUNTA_AND_CONSEJO,
  NOMBRAMIENTO_AUDITOR: JUNTA_ONLY,
  REMUNERACION_CONSEJEROS: JUNTA_ONLY,
  DELEGACION_FACULTADES: CONSEJO_SCOPE,
  OPERACION_VINCULADA: CONSEJO_SCOPE,
  PROGRAMA_RECOMPRA: JUNTA_ONLY,
  ACCION_SOCIAL_RESPONSABILIDAD: JUNTA_ONLY,
  AUTORIZACION_GARANTIA: CONSEJO_SCOPE,
  MODIFICACION_ESTATUTOS: JUNTA_ONLY,
  MODIFICACION_REGLAMENTO: JUNTA_AND_CONSEJO,
  AUMENTO_CAPITAL: JUNTA_ONLY,
  REDUCCION_CAPITAL: JUNTA_ONLY,
  EMISION_OBLIGACIONES: JUNTA_ONLY,
  CAMBIO_DENOMINACION_SOCIAL: JUNTA_ONLY,
  CAMBIO_DOMICILIO_SOCIAL: JUNTA_ONLY,
  TRANSFORMACION: JUNTA_ONLY,
  FUSION: JUNTA_ONLY,
  ESCISION: JUNTA_ONLY,
  DISOLUCION: JUNTA_ONLY,
  CESION_GLOBAL: JUNTA_ONLY,
  AUTORIZACION_OPERACION_ESTRUCTURAL: JUNTA_ONLY,
  OTROS_LIBRE: ALL_ORGANOS,
};

// Materias que NO se envían al motor V2 (puntos libres sin regla).
export const MATERIAS_LIBRES = new Set<string>(["OTROS_LIBRE"]);

// LMV cotizada advertencias específicas por materia. Texto enseña al
// secretario qué especialidad cotizada aplica y dónde está la referencia.
export const LMV_COTIZADA_ADVERTENCIAS: Record<string, string> = {
  OPERACION_VINCULADA:
    "SA cotizada: requiere informe de la Comisión de Auditoría (art. 529 ter.h LSC) + aprobación del Consejo. Si la operación supera el 5% del balance debe comunicarse a CNMV (art. 530 LSC).",
  CONTRATACION_RELEVANTE:
    "SA cotizada: revisar si el contrato es operación vinculada significativa, afecta a activos esenciales o exige comunicación al mercado por su impacto.",
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

export function isMateriaCompatibleWithOrgano(materia: string, organoTipo: TipoOrgano) {
  const organos = MATERIA_ORGANOS[materia] ?? ALL_ORGANOS;
  return organos.includes(organoTipo);
}

export function materiaDefaultForOrgano(organoTipo: TipoOrgano) {
  return AGENDA_MATERIAS.find((materia) => isMateriaCompatibleWithOrgano(materia.value, organoTipo)) ?? AGENDA_MATERIAS[0];
}

export function labelMateria(materia: string) {
  return AGENDA_MATERIAS.find((m) => m.value === materia)?.label ?? materia;
}

export interface AgendaMateriaGroup {
  key: "propias" | "transversales" | "libre";
  label: string;
  materias: AgendaMateriaDef[];
}

const PROPIAS_LABEL: Record<TipoOrgano, string> = {
  JUNTA_GENERAL: "Propias de la Junta General",
  CONSEJO: "Propias del órgano de administración",
  COMISION_DELEGADA: "Del ámbito del consejo (delegables a la comisión)",
};

/**
 * Estructura el catálogo de materias compatibles con un órgano en tres grupos
 * para el orden del día: propias del órgano convocante, transversales a
 * cualquier órgano y el punto libre. La partición es exhaustiva y disjunta
 * sobre las materias compatibles con el órgano.
 */
export function agendaMateriaGroups(organoTipo: TipoOrgano): AgendaMateriaGroup[] {
  const compatibles = AGENDA_MATERIAS.filter((m) => isMateriaCompatibleWithOrgano(m.value, organoTipo));
  const esTransversal = (value: string) => (MATERIA_ORGANOS[value] ?? ALL_ORGANOS).length >= ALL_ORGANOS.length;

  const groups: AgendaMateriaGroup[] = [
    {
      key: "propias",
      label: PROPIAS_LABEL[organoTipo],
      materias: compatibles.filter((m) => !MATERIAS_LIBRES.has(m.value) && !esTransversal(m.value)),
    },
    {
      key: "transversales",
      label: "Transversales (cualquier órgano)",
      materias: compatibles.filter((m) => !MATERIAS_LIBRES.has(m.value) && esTransversal(m.value)),
    },
    {
      key: "libre",
      label: "Punto libre",
      materias: compatibles.filter((m) => MATERIAS_LIBRES.has(m.value)),
    },
  ];

  return groups.filter((group) => group.materias.length > 0);
}
