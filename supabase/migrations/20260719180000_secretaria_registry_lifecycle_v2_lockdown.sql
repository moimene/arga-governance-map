-- Frente A (lockdown) — writers registrales v2 como unica via de mutacion para
-- clientes autenticados. Aplicar solo despues del corte del frontend a RPC.

BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.registry_filings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.registry_filing_events FROM anon, authenticated;

GRANT SELECT ON TABLE public.registry_filings TO authenticated;
GRANT SELECT ON TABLE public.registry_filing_events TO authenticated;
GRANT ALL ON TABLE public.registry_filings TO service_role;
GRANT ALL ON TABLE public.registry_filing_events TO service_role;

-- Sustituye la policy ALL legacy por lectura tenant-scoped. Los writers
-- SECURITY DEFINER conservan sus propios guards de tenant y rol.
DROP POLICY IF EXISTS registry_filings_tenant_isolation
  ON public.registry_filings;
DROP POLICY IF EXISTS registry_filings_tenant_all
  ON public.registry_filings;
DROP POLICY IF EXISTS tenant_isolation_registry_filings
  ON public.registry_filings;
DROP POLICY IF EXISTS tenant_isolation
  ON public.registry_filings;
DROP POLICY IF EXISTS registry_filings_tenant_read
  ON public.registry_filings;

CREATE POLICY registry_filings_tenant_read
  ON public.registry_filings
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

REVOKE ALL ON FUNCTION public.fn_registry_prepare_filing(
  uuid, uuid, uuid, text, uuid, text, uuid, text, uuid, uuid, text, jsonb,
  date, text, text, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_presentation(
  uuid, uuid, uuid, text, date, text, uuid, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_qualification(
  uuid, uuid, uuid, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_submit_remedy(
  uuid, uuid, uuid, text, uuid, timestamptz
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_inscription(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_registry_record_publication(
  uuid, uuid, uuid, text, timestamptz, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_registry_prepare_filing(
  uuid, uuid, uuid, text, uuid, text, uuid, text, uuid, uuid, text, jsonb,
  date, text, text, uuid
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_presentation(
  uuid, uuid, uuid, text, date, text, uuid, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_qualification(
  uuid, uuid, uuid, text, timestamptz, uuid, text
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_submit_remedy(
  uuid, uuid, uuid, text, uuid, timestamptz
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_inscription(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registry_record_publication(
  uuid, uuid, uuid, text, timestamptz, uuid
) TO authenticated, service_role;

-- Las helpers son internas: una llamada directa no debe sustituir al writer.
REVOKE ALL ON FUNCTION public.fn_registry_assert_writer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_assert_artifact(
  uuid, uuid, uuid, boolean, boolean
)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_request_fingerprint(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_existing_operation(
  uuid, uuid, text, uuid, text
)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_registry_emit_event(
  uuid, uuid, uuid, text, text, text, bigint, timestamptz, uuid, text, jsonb
) FROM PUBLIC, anon, authenticated;

COMMIT;
