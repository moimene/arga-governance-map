import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

async function triggerDispatcher(): Promise<void> {
  if (!SUPABASE_URL) return;
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/comms-dispatcher`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Dispatcher trigger failed:', err);
  }
}

export function useCancelCommunication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('communications')
        .update({ estado: 'CANCELADA', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('estado', 'PROGRAMADA');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communications'] }),
  });
}

export function useRetryRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase
        .from('communication_recipients')
        .update({
          estado_entrega: 'PENDIENTE',
          intento_reenvio_n: 0,
          ultimo_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipientId)
        .in('estado_entrega', ['ERROR', 'REBOTADO']);
      if (error) throw error;
      await triggerDispatcher();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communications'] }),
  });
}

export function useProgramCommunication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('communications')
        .update({ estado: 'PROGRAMADA', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      await triggerDispatcher();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communications'] }),
  });
}
