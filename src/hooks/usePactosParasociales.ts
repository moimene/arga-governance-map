import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PactoParasocial } from '@/lib/rules-engine/pactos-engine';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

/**
 * Fetch all pactos parasociales vigentes (VIGENTE state) for an entity.
 * Returns empty array if entity_id is null or undefined.
 */
export function usePactosVigentes(entity_id?: string) {
  return useQuery({
    queryKey: ['pactos_vigentes', entity_id],
    queryFn: async () => {
      if (!entity_id) return [];

      const { data, error } = await supabase
        .from('pactos_parasociales')
        .select('*')
        .eq('tenant_id', DEMO_TENANT)
        .eq('entity_id', entity_id)
        .eq('estado', 'VIGENTE');

      if (error) throw error;

      return (data ?? []) as PactoParasocial[];
    },
    enabled: !!entity_id,
  });
}

/**
 * Fetch all pactos parasociales for an entity (any state).
 */
export function usePactosParasociales(entity_id?: string) {
  return useQuery({
    queryKey: ['pactos_parasociales', entity_id],
    queryFn: async () => {
      if (!entity_id) return [];

      const { data, error } = await supabase
        .from('pactos_parasociales')
        .select('*')
        .eq('tenant_id', DEMO_TENANT)
        .eq('entity_id', entity_id);

      if (error) throw error;

      return (data ?? []) as PactoParasocial[];
    },
    enabled: !!entity_id,
  });
}
