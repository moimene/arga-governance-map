-- Oleada 3A — cierre de advisors sobre el ledger de transiciones.
--
-- La tabla es deliberadamente inaccesible para clientes autenticados: las
-- escrituras ocurren solo dentro de la RPC SECURITY DEFINER y service_role
-- conserva únicamente lectura operativa. La policy restrictiva hace explícito
-- el deny-all y el índice cubre la FK template_id para borrados/referencias.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_template_transition_operations_template
  ON public.secretaria_template_transition_operations(template_id, tenant_id);

DROP POLICY IF EXISTS template_transition_operations_deny_authenticated
  ON public.secretaria_template_transition_operations;
CREATE POLICY template_transition_operations_deny_authenticated
  ON public.secretaria_template_transition_operations
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DO $verify_advisor_followup$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = idx.relnamespace
     WHERE n.nspname = 'public'
       AND idx.relname = 'idx_template_transition_operations_template'
       AND i.indisvalid
       AND i.indisready
       AND pg_get_indexdef(i.indexrelid) ILIKE '%(template_id, tenant_id)%'
  ) THEN
    RAISE EXCEPTION 'Oleada 3A follow-up: índice de FK ausente o inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'secretaria_template_transition_operations'
       AND pol.polname = 'template_transition_operations_deny_authenticated'
       AND pol.polpermissive = false
  ) THEN
    RAISE EXCEPTION 'Oleada 3A follow-up: policy restrictiva deny-all ausente';
  END IF;
END;
$verify_advisor_followup$;

COMMIT;
