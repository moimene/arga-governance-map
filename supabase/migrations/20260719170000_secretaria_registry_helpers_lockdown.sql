-- Frente A — cierre inmediato de helpers internos tras la fase expansiva.
--
-- Mantiene el DML legacy hasta el corte del frontend (19180000), pero evita
-- que un cliente autenticado invoque directamente las piezas internas de los
-- writers registrales v2. Las RPC públicas conservan sus grants.

BEGIN;

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
)
  FROM PUBLIC, anon, authenticated;

COMMIT;
