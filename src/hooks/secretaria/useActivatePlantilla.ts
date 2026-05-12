/**
 * Helper hook para activar una plantilla (transición → ACTIVA).
 *
 * Envuelve `useTransitionPlantillaState` y expone un método `activate`
 * con firma ergonómica para el caso más frecuente: la consola del Gestor
 * llama `activate(id, actor, motivo, ackWarnings?)` cuando el usuario
 * pulsa "Activar" en una plantilla APROBADA. El servicio ejecutará Gate
 * PRE automáticamente.
 *
 * Sprint 1 — Spec §7.
 */
import { useTransitionPlantillaState } from "./useTransitionPlantillaState";

export function useActivatePlantilla() {
  const mut = useTransitionPlantillaState();
  return {
    ...mut,
    activate: (plantillaId: string, actor: string, motivo: string, ackWarnings?: boolean) =>
      mut.mutateAsync({ plantillaId, to: "ACTIVA", motivo, actor, ackWarnings }),
  };
}
