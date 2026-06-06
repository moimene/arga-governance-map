-- Rollback Lote 2 - revierte solo filas con audit_log exacto y hash actual coincidente.
-- Ejecutar solo si postflight/delta fallan y antes de nuevas escrituras sobre los mismos rows.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

CREATE TEMP TABLE tgms_lote2_rollback ON COMMIT DROP AS
WITH latest_audit AS (
  SELECT DISTINCT ON (object_id)
    id as audit_id,
    object_id::uuid as rule_pack_version_id,
    previous_hash,
    current_hash,
    delta -> 'before_payload' as before_payload,
    delta ->> 'pack_id' as pack_id
  FROM public.audit_log
  WHERE action = 'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX'
  ORDER BY object_id, created_at DESC, id DESC
)
SELECT
  rpv.id,
  rpv.pack_id,
  rpv.payload_hash as current_db_hash,
  la.previous_hash,
  la.current_hash,
  la.before_payload
FROM latest_audit la
JOIN public.rule_pack_versions rpv
  ON rpv.id = la.rule_pack_version_id
WHERE rpv.payload_hash = la.current_hash;

DO $$
DECLARE
  v_audit_count integer;
  v_rollback_count integer;
  v_bad text;
BEGIN
  SELECT count(distinct object_id) INTO v_audit_count
  FROM public.audit_log
  WHERE action = 'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX';

  SELECT count(*) INTO v_rollback_count
  FROM tgms_lote2_rollback;

  IF v_audit_count = 0 THEN
    RAISE EXCEPTION 'Lote 2 rollback aborted: no audit entries found';
  END IF;

  IF v_rollback_count <> v_audit_count THEN
    SELECT string_agg(rpv.pack_id || ':' || rpv.payload_hash, ', ' ORDER BY rpv.pack_id) INTO v_bad
    FROM public.audit_log al
    JOIN public.rule_pack_versions rpv
      ON rpv.id = al.object_id::uuid
    WHERE al.action = 'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX'
      AND rpv.payload_hash <> al.current_hash;

    RAISE EXCEPTION 'Lote 2 rollback aborted: current hash mismatch for %', v_bad;
  END IF;
END $$;

INSERT INTO public.audit_log (
  tenant_id,
  action,
  object_type,
  object_id,
  previous_hash,
  current_hash,
  delta
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX_ROLLBACK',
  'rule_pack_versions',
  rb.id,
  rb.current_hash,
  rb.previous_hash,
  jsonb_build_object(
    'migration', '20260521102000_secretaria_rulepacks_lote2_schema_fix',
    'pack_id', rb.pack_id,
    'reason', 'Rollback controlado Lote 2 por fallo postflight/delta',
    'restored_payload', rb.before_payload
  )
FROM tgms_lote2_rollback rb;

UPDATE public.rule_pack_versions rpv
SET
  payload = rb.before_payload,
  payload_hash = rb.previous_hash
FROM tgms_lote2_rollback rb
WHERE rpv.id = rb.id
  AND rpv.payload_hash = rb.current_hash;

COMMIT;
