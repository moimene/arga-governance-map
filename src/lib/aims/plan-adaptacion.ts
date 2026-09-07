/**
 * El Plan de Adaptación como ACCIONES, no como prosa.
 *
 * En el primer piloto real el PDA vive entero dentro de `notes`: seis acciones
 * con responsable, prioridad y fecha escritas a mano en un párrafo. Así no se
 * puede filtrar, ni ordenar, ni saber cuántas vencen este mes, ni llevar el
 * seguimiento que la propia auditoría exige («cada plan de acción con owner,
 * evidencia, plazo y prueba de funcionamiento»).
 *
 * Módulo hoja salvo por el tipo del catálogo: lo usan el wizard y el informe.
 */

export type PrioridadAccion = "ALTA" | "MEDIA" | "BAJA";

export type AccionPDA = {
  /** Código de la medida que la origina. Es la clave: una acción por medida. */
  measureCode: string;
  titulo: string;
  requirementCode: string;
  /** Nivel de madurez que la motivó, para no perder de dónde sale. */
  nivel: string;
  planCode: string;
  prioridad: PrioridadAccion;
  /** FK a `persons`. Vacío hasta que alguien lo asigne. */
  owner_id: string | null;
  /** ISO date. */
  vence_el: string | null;
  estado: "PENDIENTE" | "EN_CURSO" | "CERRADA";
  notas: string;
};

/**
 * De qué niveles nace una acción.
 *
 * `L5` y `L8` no: la una está hecha y la otra no aplica. El resto —L1 a L4, L6
 * y L7— tiene algo pendiente según el título de la propia escala, y por eso
 * `calculateAdaptationPlan` les asigna un plan distinto de «adaptación
 * completa» o «ninguna acción».
 */
const PLANES_QUE_EXIGEN_ACCION = new Set(["01", "02", "04"]);

/**
 * Prioridad derivada del plan y de la dificultad, no inventada:
 *
 *   - Plan 01 («documentar e implementar»): no existe nada. ALTA.
 *   - Plan 02 («implementar») y 04 («documentar»): existe media medida. MEDIA,
 *     y sube a ALTA si además se graduó como de alta dificultad, porque una
 *     tarea difícil a medio hacer es la que más tarde en cerrar.
 *   - Lo demás, BAJA.
 *
 * La dificultad `"00"` es ALTA — el código va al revés de la intuición porque
 * lo hereda del cuadro de origen; por eso en pantalla no se pinta el número.
 */
export function prioridadDe(planCode: string, difficulty: string | null | undefined): PrioridadAccion {
  if (planCode === "01") return "ALTA";
  if (planCode === "02" || planCode === "04") {
    return difficulty === "00" ? "ALTA" : "MEDIA";
  }
  return "BAJA";
}

/** Horizonte propuesto, en días. Editable: es una propuesta, no un plazo legal. */
const HORIZONTE: Record<PrioridadAccion, number> = { ALTA: 60, MEDIA: 120, BAJA: 180 };

export function vencimientoPropuesto(prioridad: PrioridadAccion, desde: Date): string {
  const d = new Date(desde.getTime());
  d.setDate(d.getDate() + HORIZONTE[prioridad]);
  return d.toISOString().slice(0, 10);
}

type FindingParaPlan = {
  code: string;
  title?: string;
  status?: string;
  planCode?: string;
  difficulty?: string | null;
  requirementCode?: string;
};

/**
 * Genera el plan a partir de los findings, CONSERVANDO lo que ya se editó.
 *
 * Es la propiedad que importa: quien asignó un responsable y una fecha a una
 * acción no puede perderlos porque alguien vuelva a tocar una medida. Sólo se
 * añaden las que faltan y se retiran las que ya no tienen medida con brecha.
 */
export function generarPlanDeAdaptacion(
  findings: FindingParaPlan[] | null | undefined,
  previas: AccionPDA[] | null | undefined,
  hoy: Date,
): AccionPDA[] {
  const yaEditadas = new Map((previas ?? []).map((a) => [a.measureCode, a]));
  const conBrecha = (findings ?? []).filter((f) => f.code && PLANES_QUE_EXIGEN_ACCION.has(f.planCode ?? ""));

  return conBrecha.map((f) => {
    const previa = yaEditadas.get(f.code);
    const prioridad = prioridadDe(f.planCode ?? "", f.difficulty);
    if (previa) {
      // Se respeta lo editado a mano y sólo se refresca lo que describe la
      // medida: si el nivel bajó, la acción tiene que reflejarlo.
      return { ...previa, nivel: f.status ?? previa.nivel, planCode: f.planCode ?? previa.planCode, titulo: f.title ?? previa.titulo };
    }
    return {
      measureCode: f.code,
      titulo: f.title ?? f.code,
      requirementCode: f.requirementCode ?? "",
      nivel: f.status ?? "",
      planCode: f.planCode ?? "",
      prioridad,
      owner_id: null,
      vence_el: vencimientoPropuesto(prioridad, hoy),
      estado: "PENDIENTE",
      notas: "",
    };
  });
}

/** Resumen para la cabecera del informe. */
export function resumenPlan(acciones: AccionPDA[] | null | undefined, hoy: Date) {
  const items = acciones ?? [];
  const limite = hoy.toISOString().slice(0, 10);
  return {
    total: items.length,
    alta: items.filter((a) => a.prioridad === "ALTA").length,
    sinResponsable: items.filter((a) => !a.owner_id).length,
    vencidas: items.filter((a) => a.estado !== "CERRADA" && a.vence_el && a.vence_el < limite).length,
    cerradas: items.filter((a) => a.estado === "CERRADA").length,
  };
}
