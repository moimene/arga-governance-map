-- Rollback Lote 1 - Correccion core Secretaria 360.
-- Requiere que 02_patch.sql haya insertado 10 entradas WORM en audit_log.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

CREATE TEMP TABLE tgms_lote1_rollback ON COMMIT DROP AS
WITH audit_rows AS (
  SELECT DISTINCT ON (object_id)
    object_id AS rule_pack_version_id,
    previous_hash,
    current_hash,
    delta ->> 'pack_id' AS pack_id,
    delta ->> 'version' AS version,
    delta -> 'before_payload' AS before_payload
  FROM public.audit_log
  WHERE action = 'SECRETARIA_RULEPACK_LOTE1_CORE_FIX'
    AND object_type = 'rule_pack_versions'
    AND delta ->> 'migration' = '20260521101500_secretaria_rulepacks_lote1_core_fix'
  ORDER BY object_id, created_at DESC
)
SELECT *
FROM audit_rows
WHERE before_payload IS NOT NULL
  AND previous_hash IS NOT NULL
  AND current_hash IS NOT NULL;

DO $$
DECLARE
  v_count integer;
  v_bad text;
BEGIN
  SELECT count(*) INTO v_count FROM tgms_lote1_rollback;
  IF v_count <> 10 THEN
    RAISE EXCEPTION 'Rollback Lote 1: expected 10 audit rows, got %', v_count;
  END IF;

  SELECT string_agg(r.pack_id || ':' || r.current_hash, ', ' ORDER BY r.pack_id) INTO v_bad
  FROM tgms_lote1_rollback r
  JOIN public.rule_pack_versions rpv ON rpv.id = r.rule_pack_version_id
  WHERE rpv.payload_hash <> r.current_hash;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback Lote 1: current hash does not match audit current_hash: %', v_bad;
  END IF;

  PERFORM rpv.id
  FROM public.rule_pack_versions rpv
  JOIN tgms_lote1_rollback r ON r.rule_pack_version_id = rpv.id
  FOR UPDATE OF rpv;
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
  'SECRETARIA_RULEPACK_LOTE1_CORE_FIX_ROLLBACK',
  'rule_pack_versions',
  r.rule_pack_version_id,
  r.current_hash,
  r.previous_hash,
  jsonb_build_object(
    'migration', '20260521101500_secretaria_rulepacks_lote1_core_fix',
    'pack_id', r.pack_id,
    'version', r.version,
    'rollback_to_payload', r.before_payload,
    'reason', 'Rollback controlado Lote 1'
  )
FROM tgms_lote1_rollback r;

UPDATE public.rule_pack_versions rpv
SET
  payload = r.before_payload,
  payload_hash = r.previous_hash,
  status = 'ACTIVE',
  is_active = true,
  approved_at = COALESCE(rpv.approved_at, now())
FROM tgms_lote1_rollback r
WHERE rpv.id = r.rule_pack_version_id
  AND rpv.payload_hash = r.current_hash;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM tgms_lote1_rollback r
  JOIN public.rule_pack_versions rpv ON rpv.id = r.rule_pack_version_id
  WHERE rpv.payload_hash = r.previous_hash;

  IF v_count <> 10 THEN
    RAISE EXCEPTION 'Rollback Lote 1: restored rows mismatch, got %', v_count;
  END IF;
END $$;

COMMIT;
