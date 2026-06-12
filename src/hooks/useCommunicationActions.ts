import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

/**
 * triggerDispatcher: invokes the comms-dispatcher Edge Function using the
 * CURRENT USER's JWT (not the anon key). The dispatcher itself enforces that
 * the caller is either:
 *  - service_role (pg_cron tick), or
 *  - an authenticated user with SECRETARIO or ADMIN_TENANT role.
 * Anon callers are rejected with 401/403.
 */
async function triggerDispatcher(): Promise<void> {
  if (!SUPABASE_URL) return;
  const { data: sessionResult } = await supabase.auth.getSession();
  const token = sessionResult.session?.access_token;
  if (!token) {
    console.warn('triggerDispatcher: no active session; pg_cron tick will pick up the comm on next minute.');
    return;
  }
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/comms-dispatcher`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.warn(`Dispatcher returned ${resp.status}: ${body}. pg_cron tick will retry.`);
    }
  } catch (err) {
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
      // ITEM-127: NO resetear intento_reenvio_n a 0. La clave de idempotencia del
      // dispatcher (Resend Idempotency-Key y discriminador ERDS) deriva de
      // `${recipientId}-${cuerpo_hash}-${intento_reenvio_n}`; resetear a 0 regenera
      // la clave del intento original, que puede caer en la ventana de deduplicación
      // de Resend (~24h) y suprimir silenciosamente un reenvío legítimo. Conservamos
      // el contador y lo incrementamos para que la clave cambie en cada reenvío manual.
      const { data: current, error: readError } = await supabase
        .from('communication_recipients')
        .select('intento_reenvio_n')
        .eq('id', recipientId)
        .in('estado_entrega', ['ERROR', 'REBOTADO'])
        .maybeSingle();
      if (readError) throw readError;
      if (!current) return; // ya no está en ERROR/REBOTADO: nada que reenviar
      const { error } = await supabase
        .from('communication_recipients')
        .update({
          estado_entrega: 'PENDIENTE',
          intento_reenvio_n: (current.intento_reenvio_n ?? 0) + 1,
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
