// src/lib/secretaria/meeting-resolution-recalc.ts
//
// Cuándo el paso de Votaciones debe seguir ofreciendo «Recalcular votación del
// acuerdo y crear expediente Acuerdo 360» sobre una reunión que YA tiene
// resoluciones guardadas.
//
// Vive fuera de la pantalla porque el defecto que cierra no era de render: el
// predicado estaba escrito de forma que se apagaba justo en el estado que hay
// que reparar.
//
// EL DEFECTO (medido 2026-09-06 sobre la reunión canónica `ac961a00`): tenía 3
// resoluciones ADOPTED con sus 3 acuerdos vinculados, **0 votos** en
// `meeting_votes` y **0** `point_snapshots`. El servidor rechaza cerrar el acta
// —`SERVER_VOTE_EXACTLY_ONE_VOTE_REQUIRED: attendee=… count=0`, porque
// recompone el resultado legal desde asistencia y votos individuales— y la
// pantalla NO ofrecía forma de rehacer la votación, porque la condición de
// «snapshot bloqueado» exigía `point_snapshots.length > 0`. Con cero snapshots
// leía «no bloqueado», daba el paso por terminado y retiraba el único control
// capaz de generarlos: un callejón sin salida.
//
// La ausencia de snapshot certificable bloquea igual que un snapshot no
// certificable. Lo que habilita el paso es tener uno bueno, no tener alguno.
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine/meeting-adoption-snapshot";

export type ResolucionExistente = {
  readonly agreement_id?: string | null;
  readonly status?: string | null;
  readonly agenda_item_index?: number | null;
};

export function haySnapshotCertificable(
  snapshots: readonly MeetingAdoptionSnapshot[] | null | undefined,
): boolean {
  return (snapshots ?? []).some(
    (snapshot) => snapshot?.societary_validity?.ok === true && snapshot?.status_resolucion === "ADOPTED",
  );
}

/**
 * Índices de agenda (base 1, como `meeting_resolutions.agenda_item_index`) de
 * los puntos votables que todavía no tienen resolución guardada.
 *
 * H-51 (medido 2026-09-27, reunión `81a4de74` del grupo nuevo): el punto 1 ya
 * estaba completo y el punto 2 había nacido en sesión. Con una sola resolución
 * guardada y completa, el predicado de abajo devolvía `false` y la pantalla
 * retiraba el botón de registrar: el punto 2 no podía votarse nunca.
 */
export function puntosVotablesSinResolucion(params: {
  readonly resoluciones: readonly ResolucionExistente[];
  readonly puntosVotables: readonly number[];
}): number[] {
  const conResolucion = new Set(
    params.resoluciones
      .map((r) => r.agenda_item_index)
      .filter((i): i is number => typeof i === "number"),
  );
  return params.puntosVotables.filter((i) => !conResolucion.has(i));
}

/**
 * `true` mientras la votación registrada no sostenga por sí sola el cierre del
 * acta. Devuelve `false` solo cuando las resoluciones están completas: todas
 * adoptadas, todas con su Acuerdo 360, con al menos un snapshot certificable y
 * —si se informan los puntos votables— una resolución para cada uno de ellos.
 */
export function puedeRecalcularResoluciones(params: {
  readonly resoluciones: readonly ResolucionExistente[];
  readonly snapshots: readonly MeetingAdoptionSnapshot[] | null | undefined;
  /** Índices base 1 de los puntos DECISORIO de la agenda. */
  readonly puntosVotables?: readonly number[];
}): boolean {
  const { resoluciones, snapshots, puntosVotables } = params;
  if (resoluciones.length === 0) return false;

  if (
    puntosVotables &&
    puntosVotablesSinResolucion({ resoluciones, puntosVotables }).length > 0
  ) {
    return true;
  }

  const sinAcuerdoVinculado = resoluciones.every((r) => !r.agreement_id);
  const algunaNoAdoptada = resoluciones.some((r) => r.status !== "ADOPTED");
  // Sin `length > 0`: cero snapshots NO es «no bloqueado», es «nada que
  // certificar». Ese matiz es el defecto entero.
  const sinSnapshotCertificable = !haySnapshotCertificable(snapshots);

  return sinAcuerdoVinculado || algunaNoAdoptada || sinSnapshotCertificable;
}
