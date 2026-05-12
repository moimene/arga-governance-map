/**
 * Helper hook para archivar una plantilla (transición → ARCHIVADA).
 *
 * Envuelve `useTransitionPlantillaState` y expone `archive(id, actor, motivo)`.
 * El estado ARCHIVADA es terminal: la matriz no permite salir de él. Esta es
 * la única forma de "retirar" una plantilla del catálogo activo.
 *
 * Sprint 1 — Spec §7.
 */
import { useTransitionPlantillaState } from "./useTransitionPlantillaState";

export function useArchivePlantilla() {
  const mut = useTransitionPlantillaState();
  return {
    ...mut,
    archive: (plantillaId: string, actor: string, motivo: string) =>
      mut.mutateAsync({ plantillaId, to: "ARCHIVADA", motivo, actor }),
  };
}
