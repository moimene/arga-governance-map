import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/context/TenantContext';

export function useCommunication(id: string | undefined) {
  return useQuery({
    queryKey: ['communication', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*, communication_attachments(*), communication_recipients(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCommunicationForConvocatoria(convocatoriaId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ['communications', tenantId, 'convocatoria', convocatoriaId],
    enabled: !!tenantId && !!convocatoriaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('id, convocatoria_id, meeting_id, estado, nivel_certificacion_minimo, fecha_programada, fecha_envio_efectiva, created_at')
        .eq('tenant_id', tenantId!)
        .eq('convocatoria_id', convocatoriaId!)
        .eq('tipo_comunicacion', 'CONVOCATORIA')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
