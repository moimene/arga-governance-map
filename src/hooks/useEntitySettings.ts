import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useCurrentUser } from "./useCurrentUser";
import type { EntitySettingsCatalogRow } from "./useEntitySettingsCatalog";

export interface EntitySettingRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface EntitySettingValueInput {
  entityId: string;
  key: string;
  value: unknown;
}

export function entitySettingsQueryKey(tenantId?: string | null, entityId?: string | null) {
  return ["entity-settings", tenantId ?? "no-tenant", entityId ?? "no-entity"] as const;
}

export function parseEntitySettingInput(
  catalog: Pick<EntitySettingsCatalogRow, "key" | "value_type" | "allowed_values">,
  rawValue: string | boolean,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (catalog.value_type === "boolean") {
    if (typeof rawValue === "boolean") return { ok: true, value: rawValue };
    if (rawValue === "true") return { ok: true, value: true };
    if (rawValue === "false") return { ok: true, value: false };
    return { ok: false, message: "Selecciona Sí o No." };
  }

  if (catalog.value_type === "number") {
    if (typeof rawValue === "string" && rawValue.trim() === "") {
      return { ok: false, message: "Introduce un número válido." };
    }
    const n = Number(rawValue);
    if (!Number.isFinite(n)) return { ok: false, message: "Introduce un número válido." };
    return { ok: true, value: n };
  }

  if (catalog.value_type === "enum") {
    const allowed = Array.isArray(catalog.allowed_values)
      ? catalog.allowed_values.map((value) => String(value))
      : [];
    const value = String(rawValue);
    if (!allowed.includes(value)) {
      return { ok: false, message: "El valor no está permitido por el catálogo." };
    }
    return { ok: true, value };
  }

  return { ok: true, value: String(rawValue) };
}

export function settingValueToDraft(value: unknown, catalog: Pick<EntitySettingsCatalogRow, "value_type">) {
  if (catalog.value_type === "boolean") return value === true ? "true" : value === false ? "false" : "";
  if (value === null || value === undefined) return "";
  return String(value);
}

export function useEntitySettings(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  const query = useQuery({
    queryKey: entitySettingsQueryKey(tenantId, entityId),
    enabled: !!tenantId && !!entityId,
    queryFn: async (): Promise<EntitySettingRow[]> => {
      const { data, error } = await supabase
        .from("entity_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EntitySettingRow[];
    },
  });

  const byKey = useMemo(() => {
    const map = new Map<string, EntitySettingRow>();
    for (const row of query.data ?? []) {
      map.set(row.key, row);
    }
    return map;
  }, [query.data]);

  return { ...query, byKey };
}

export function useUpsertEntitySetting() {
  const { tenantId } = useTenantContext();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityId, key, value }: EntitySettingValueInput) => {
      if (!tenantId) throw new Error("Tenant no disponible");
      const { data, error } = await supabase
        .from("entity_settings")
        .upsert(
          {
            tenant_id: tenantId,
            entity_id: entityId,
            key,
            value,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
          },
          { onConflict: "entity_id,key" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as EntitySettingRow;
    },
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({ queryKey: entitySettingsQueryKey(tenantId, variables.entityId) });
      queryClient.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
    },
  });
}

export function useDeleteEntitySetting() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityId, key }: Pick<EntitySettingValueInput, "entityId" | "key">) => {
      if (!tenantId) throw new Error("Tenant no disponible");
      const { error } = await supabase
        .from("entity_settings")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("entity_id", entityId)
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: (_row, variables) => {
      queryClient.invalidateQueries({ queryKey: entitySettingsQueryKey(tenantId, variables.entityId) });
      queryClient.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
    },
  });
}
