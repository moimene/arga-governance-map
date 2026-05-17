import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
