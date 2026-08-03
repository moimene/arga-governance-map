-- Cierre de EXECUTE implícito en helpers internos de los gates autoritativos.
--
-- PostgreSQL concede EXECUTE a PUBLIC al crear una función. Estas seis
-- funciones son exclusivamente triggers internos; no son RPC de producto y
-- nunca deben poder invocarse desde PostgREST, ni siquiera autenticado.

BEGIN;

REVOKE ALL ON FUNCTION public.fn_secretaria_qtsp_request_source_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_secretaria_evidence_bundle_insert_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_secretaria_freeze_minute_source_facts()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_secretaria_annual_accounts_append_only_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_secretaria_annual_accounts_minute_gate()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_secretaria_guard_convocation_agenda_binding()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_qtsp_request_source_guard()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_evidence_bundle_insert_guard()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_freeze_minute_source_facts()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_annual_accounts_append_only_guard()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_annual_accounts_minute_gate()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_convocation_agenda_binding()
  TO service_role;

DO $assert$
DECLARE
  v_function regprocedure;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.fn_secretaria_qtsp_request_source_guard()'::regprocedure,
    'public.fn_secretaria_evidence_bundle_insert_guard()'::regprocedure,
    'public.fn_secretaria_freeze_minute_source_facts()'::regprocedure,
    'public.fn_secretaria_annual_accounts_append_only_guard()'::regprocedure,
    'public.fn_secretaria_annual_accounts_minute_gate()'::regprocedure,
    'public.fn_secretaria_guard_convocation_agenda_binding()'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'authoritative helper EXECUTE lockdown failed for %', v_function;
    END IF;
  END LOOP;
END;
$assert$;

COMMIT;
