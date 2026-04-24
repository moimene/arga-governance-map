import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export interface CapitalHoldingRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  holder_person_id: string;
  share_class_id: string | null;
  numero_titulos: number;
  porcentaje_capital: number | null;
  voting_rights: boolean;
  is_treasury: boolean;
  effective_from: string;
  effective_to: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CapitalHoldingDetailRow extends CapitalHoldingRow {
  holder?: {
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
    denomination: string | null;
  } | null;
  share_class?: {
    id: string;
    class_code: string;
    name: string;
    votes_per_title: number;
    voting_rights: boolean;
  } | null;
}

/**
 * Libro de socios VIGENTE (capital_holdings sin effective_to) con join
 * a persons y share_classes.
 * Incluye autocartera (is_treasury=true) — filtrar en UI si hace falta.
 */
export function useCapitalHoldings(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["capital_holdings", tenantId, "vigente", entityId],
    queryFn: async (): Promise<CapitalHoldingDetailRow[]> => {
      const { data, error } = await supabase
        .from("capital_holdings")
        .select(`
          *,
          holder:holder_person_id(id, full_name, tax_id, person_type, denomination),
          share_class:share_class_id(id, class_code, name, votes_per_title, voting_rights)
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .is("effective_to", null)
        .order("porcentaje_capital", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CapitalHoldingDetailRow[];
    },
  });
}

/**
 * G3: reverse lookup — todas las sociedades donde una persona es socio
 * (capital_holdings con holder_person_id = personId y effective_to NULL).
 * Incluye join a entity y share_class para mostrar clase + % en la ficha.
 */
export interface PersonaHoldingDetailRow extends CapitalHoldingRow {
  entity?: {
    id: string;
    common_name: string | null;
    legal_name: string;
  } | null;
  share_class?: {
    id: string;
    class_code: string;
    name: string;
  } | null;
}

export function useHoldingsPersona(personId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!personId && !!tenantId,
    queryKey: ["capital_holdings", tenantId, "byPerson", personId],
    queryFn: async (): Promise<PersonaHoldingDetailRow[]> => {
      const { data, error } = await supabase
        .from("capital_holdings")
        .select(`
          *,
          entity:entity_id(id, common_name, legal_name),
          share_class:share_class_id(id, class_code, name)
        `)
        .eq("tenant_id", tenantId!)
        .eq("holder_person_id", personId!)
        .is("effective_to", null)
        .order("porcentaje_capital", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PersonaHoldingDetailRow[];
    },
  });
}

/** Todas las posiciones (incluye históricas) para trazabilidad. */
export function useCapitalHoldingsHistory(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["capital_holdings", tenantId, "history", entityId],
    queryFn: async (): Promise<CapitalHoldingDetailRow[]> => {
      const { data, error } = await supabase
        .from("capital_holdings")
        .select(`
          *,
          holder:holder_person_id(id, full_name, tax_id, person_type, denomination),
          share_class:share_class_id(id, class_code, name, votes_per_title, voting_rights)
        `)
        .eq("tenant_id", tenantId!)
        .eq("entity_id", entityId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CapitalHoldingDetailRow[];
    },
  });
}
