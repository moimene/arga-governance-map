import { supabase } from "@/integrations/supabase/client";

export function filterSettingsByCatalog<T extends { key: string }>(settings: T[], catalogKeys: Set<string>) {
  return settings.filter((setting) => catalogKeys.has(setting.key));
}

export async function loadEntitySettingsCatalogKeys() {
  const { data, error } = await supabase
    .from("entity_settings_catalog")
    .select("key")
    .eq("estado_catalog", "ACTIVA");

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.key as string));
}
