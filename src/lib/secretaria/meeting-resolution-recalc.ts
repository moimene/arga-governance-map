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
};

export function haySnapshotCertificable(
  snapshots: readonly MeetingAdoptionSnapshot[] | null | undefined,
): boolean {
  return (snapshots ?? []).some(
    (snapshot) => snapshot?.societary_validity?.ok === true && snapshot?.status_resolucion === "ADOPTED",
  );
}

/**
 * `true` mientras la votación registrada no sostenga por sí sola el cierre del
 * acta. Devuelve `false` solo cuando las resoluciones están completas: todas
 * adoptadas, todas con su Acuerdo 360 y con al menos un snapshot certificable.
 */
export function puedeRecalcularResoluciones(params: {
  readonly resoluciones: readonly ResolucionExistente[];
  readonly snapshots: readonly MeetingAdoptionSnapshot[] | null | undefined;
}): boolean {
  const { resoluciones, snapshots } = params;
  if (resoluciones.length === 0) return false;

  const sinAcuerdoVinculado = resoluciones.every((r) => !r.agreement_id);
  const algunaNoAdoptada = resoluciones.some((r) => r.status !== "ADOPTED");
  // Sin `length > 0`: cero snapshots NO es «no bloqueado», es «nada que
  // certificar». Ese matiz es el defecto entero.
  const sinSnapshotCertificable = !haySnapshotCertificable(snapshots);

  return sinAcuerdoVinculado || algunaNoAdoptada || sinSnapshotCertificable;
}
