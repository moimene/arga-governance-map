import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/context/TenantContext';

export interface CommunicationsFilters {
  estado?: string[];
  entity_id?: string;
  organo_tipo?: string;
  tipo_comunicacion?: string;
  tiene_rebotes?: boolean;
  comunicacion_libre?: boolean;
  from_date?: string;
  to_date?: string;
}

export function useCommunicationsList(filters: CommunicationsFilters = {}) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ['communications', 'list', tenantId, filters],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from('communications')
        .select(
          'id, asunto, estado, organo_tipo, tipo_comunicacion, tipo_respuesta_esperada, tiene_rebotes, comunicacion_libre, fecha_programada, fecha_envio_efectiva, entity_id, body_id, meeting_id, agreement_id, created_at',
        )
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      if (filters.estado?.length) q = q.in('estado', filters.estado);
      if (filters.entity_id) q = q.eq('entity_id', filters.entity_id);
      if (filters.organo_tipo) q = q.eq('organo_tipo', filters.organo_tipo);
      if (filters.tipo_comunicacion) q = q.eq('tipo_comunicacion', filters.tipo_comunicacion);
      if (typeof filters.tiene_rebotes === 'boolean') q = q.eq('tiene_rebotes', filters.tiene_rebotes);
      if (typeof filters.comunicacion_libre === 'boolean') q = q.eq('comunicacion_libre', filters.comunicacion_libre);
      if (filters.from_date) q = q.gte('created_at', filters.from_date);
      if (filters.to_date) q = q.lte('created_at', filters.to_date);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}
