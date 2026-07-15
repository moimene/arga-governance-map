/**
 * Hook delgado para transicionar una plantilla a otro estado.
 *
 * Delega íntegramente en `transitionTemplateState`, exponiendo la
 * superficie de TanStack Mutation (mutate, mutateAsync, isPending, etc.).
 * Resuelve `tenantId` desde el contexto e invalida las cachés relevantes
 * tras éxito.
 *
 * Sprint 1 — Spec §7.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import {
  transitionTemplateState,
  type TransitionInput,
} from "@/lib/secretaria/template-admin/template-admin-service";

export function useTransitionPlantillaState() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (input: TransitionInput) => {
      if (!tenantId) throw new Error("tenantId requerido");
      const result = await transitionTemplateState(input, { tenantId });
      if (result.ok === false) {
        const error = new Error(`Transición rechazada: ${result.reason}`);
        (error as Error & { result?: typeof result }).result = result;
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      qc.invalidateQueries({ queryKey: ["plantilla_changelog"] });
      qc.invalidateQueries({ queryKey: ["materia_template_binding"] });
    },
    onError: async (error) => {
      const result =
        error && typeof error === "object" && "result" in error
          ? (error as { result?: { reason?: string } }).result
          : undefined;
      if (result?.reason !== "STALE_STATE" && result?.reason !== "STALE_PREDECESSOR") return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["plantillas_protegidas"] }),
        qc.invalidateQueries({ queryKey: ["plantilla_changelog"] }),
        qc.invalidateQueries({ queryKey: ["materia_template_binding"] }),
      ]);
    },
  });
}
