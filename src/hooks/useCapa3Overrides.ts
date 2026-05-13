import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useCurrentUser } from "./useCurrentUser";

export type ObligatoriedadOverride = "OBLIGATORIO" | "RECOMENDADO" | "OPCIONAL";

export interface Capa3OverrideAdminRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  plantilla_id: string;
  campo: string;
  default_value_override: unknown | null;
  opciones_override: unknown[] | null;
  obligatoriedad_override: ObligatoriedadOverride | null;
  compatible_with_canonical_version: string;
  motivo: string;
  created_at: string;
  created_by: string | null;
}

export interface Capa3OverrideDraft {
  defaultValue: string;
  opciones: string;
  obligatoriedad: ObligatoriedadOverride | "";
  motivo: string;
}

export interface UpsertCapa3OverrideInput {
  entityId: string;
  plantillaId: string;
  campo: string;
  canonicalVersion: string;
  defaultValueOverride: unknown | null;
  opcionesOverride: unknown[] | null;
  obligatoriedadOverride: ObligatoriedadOverride | null;
  motivo: string;
}

export function capa3OverridesQueryKey(
  tenantId?: string | null,
  entityId?: string | null,
  plantillaId?: string | null,
) {
  return ["capa3-overrides-admin", tenantId ?? "no-tenant", entityId ?? "no-entity", plantillaId ?? "no-template"] as const;
}

function parseOptions(value: string) {
  const options = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return options.length > 0 ? options : null;
}

export function buildCapa3OverridePayload(
  draft: Capa3OverrideDraft,
): { ok: true; payload: Pick<UpsertCapa3OverrideInput, "defaultValueOverride" | "opcionesOverride" | "obligatoriedadOverride" | "motivo"> } | { ok: false; message: string } {
  const motivo = draft.motivo.trim();
  if (motivo.length < 10) {
    return { ok: false, message: "El motivo debe tener al menos 10 caracteres." };
  }

  const defaultValueOverride = draft.defaultValue.trim() === "" ? null : draft.defaultValue.trim();
  const opcionesOverride = parseOptions(draft.opciones);
  const obligatoriedadOverride = draft.obligatoriedad || null;

  if (defaultValueOverride !== null && opcionesOverride !== null && !opcionesOverride.includes(String(defaultValueOverride))) {
    return { ok: false, message: "El default debe estar incluido en las opciones." };
  }

  if (defaultValueOverride === null && opcionesOverride === null && obligatoriedadOverride === null) {
    return { ok: false, message: "Define al menos un override o elimina la fila existente." };
  }

  return {
    ok: true,
    payload: {
      defaultValueOverride,
      opcionesOverride,
      obligatoriedadOverride,
      motivo,
    },
  };
}

export function useCapa3Overrides(entityId?: string | null, plantillaId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: capa3OverridesQueryKey(tenantId, entityId, plantillaId),
    enabled: !!tenantId && !!entityId && !!plantillaId,
    queryFn: async (): Promise<Capa3OverrideAdminRow[]> => {
      const { data, error } = await supabase
        .from("plantilla_capa3_overrides_por_entidad")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .eq("plantilla_id", plantillaId!)
        .order("campo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Capa3OverrideAdminRow[];
    },
  });
}

export function useUpsertCapa3Override() {
  const { tenantId } = useTenantContext();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertCapa3OverrideInput) => {
      if (!tenantId) throw new Error("Tenant no disponible");
      const { data, error } = await supabase
        .from("plantilla_capa3_overrides_por_entidad")
        .upsert(
          {
            tenant_id: tenantId,
            entity_id: input.entityId,
            plantilla_id: input.plantillaId,
            campo: input.campo,
            default_value_override: input.defaultValueOverride,
            opciones_override: input.opcionesOverride,
            obligatoriedad_override: input.obligatoriedadOverride,
            compatible_with_canonical_version: input.canonicalVersion,
            motivo: input.motivo,
            created_by: user?.id ?? null,
          },
          { onConflict: "entity_id,plantilla_id,campo" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as Capa3OverrideAdminRow;
    },
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({
        queryKey: capa3OverridesQueryKey(tenantId, variables.entityId, variables.plantillaId),
      });
      queryClient.invalidateQueries({
        queryKey: ["capa3_overrides", tenantId, variables.entityId, variables.plantillaId],
      });
    },
  });
}

export function useDeleteCapa3Override() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      plantillaId,
      campo,
    }: Pick<UpsertCapa3OverrideInput, "entityId" | "plantillaId" | "campo">) => {
      if (!tenantId) throw new Error("Tenant no disponible");
      const { error } = await supabase
        .from("plantilla_capa3_overrides_por_entidad")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("entity_id", entityId)
        .eq("plantilla_id", plantillaId)
        .eq("campo", campo);
      if (error) throw error;
    },
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({
        queryKey: capa3OverridesQueryKey(tenantId, variables.entityId, variables.plantillaId),
      });
      queryClient.invalidateQueries({
        queryKey: ["capa3_overrides", tenantId, variables.entityId, variables.plantillaId],
      });
    },
  });
}
