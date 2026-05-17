import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  resolveMatterEntry,
  type MatterRegistryResolveQuery,
} from "@/lib/secretaria/matter-registry";

export function useMatterRegistry(
  input: Omit<MatterRegistryResolveQuery, "tenantId"> | null | undefined,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: [
      "matter-registry",
      tenantId,
      input?.entityId ?? "no-entity",
      input?.materia ?? "no-materia",
      input?.organoTipo ?? "any-organo",
      input?.adoptionMode ?? "any-adoption",
      input?.docType ?? "MODELO_ACUERDO",
      input?.jurisdiccion ?? "any-jurisdiction",
      input?.tipoSocial ?? "any-tipo-social",
      input?.subtipo ?? "any-subtipo",
    ],
    enabled: !!tenantId && !!input?.materia,
    staleTime: 5 * 60 * 1000,
    queryFn: () => {
      if (!tenantId || !input?.materia) {
        throw new Error("tenantId y materia son requeridos para Matter Registry");
      }
      return resolveMatterEntry(supabase, {
        ...input,
        tenantId,
      });
    },
  });
}
