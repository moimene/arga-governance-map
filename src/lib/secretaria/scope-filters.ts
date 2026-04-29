import { supabase } from "@/integrations/supabase/client";

export interface SecretariaScopedIds {
  bodyIds: string[] | null;
  agreementIds: string[] | null;
}

export async function getSecretariaScopedIds(
  tenantId: string,
  entityId?: string | null,
): Promise<SecretariaScopedIds> {
  if (!entityId) {
    return { bodyIds: null, agreementIds: null };
  }

  const [bodiesResult, agreementsResult] = await Promise.all([
    supabase
      .from("governing_bodies")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entity_id", entityId),
    supabase
      .from("agreements")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entity_id", entityId),
  ]);

  if (bodiesResult.error) throw bodiesResult.error;
  if (agreementsResult.error) throw agreementsResult.error;

  return {
    bodyIds: (bodiesResult.data ?? []).map((body) => body.id),
    agreementIds: (agreementsResult.data ?? []).map((agreement) => agreement.id),
  };
}
