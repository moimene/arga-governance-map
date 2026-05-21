-- Preflight Lote 1 - Correccion core Secretaria 360.
-- No ejecuta escrituras permanentes. Aborta si hay drift sobre las 10 versiones objetivo.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

CREATE TEMP TABLE tgms_lote1_expected (
  pack_id text PRIMARY KEY,
  rule_pack_version_id uuid NOT NULL,
  version text NOT NULL,
  expected_db_payload_hash text NOT NULL,
  expected_findings integer NOT NULL
) ON COMMIT DROP;

INSERT INTO tgms_lote1_expected (pack_id, rule_pack_version_id, version, expected_db_payload_hash, expected_findings)
VALUES
  ('AUMENTO_CAPITAL', '64f4de9c-bb3f-47db-8f79-87bd49b694ed'::uuid, '1.0.1', '8550ed8855e30c1d74d246c3d76bba6ddfab0a8fa183e9460f86c8b9ee8a9ff5', 2),
  ('CESE_CONSEJERO', '4a97f0a9-b5e3-4e85-9829-d2fde0348483'::uuid, '1.0.1', '7610b59461570a6ab2afb49b5af579b1c221b6c3f23e9db1b26cc485795ceee6', 2),
  ('ESCISION', '77177821-9ed8-49bf-b7a1-087939530639'::uuid, 'v1.0.0', '4f0d3425ae001db38b919810536174ab1000f61cadcc4a7066127eeb0e847844', 2),
  ('EXCLUSION_SOCIO', 'e0418837-6f71-434e-bda8-98b809f1cd93'::uuid, '1.0.0', 'b0341d37ff36602b9795a3990461b859e26ccb87507dad76dcedf3ad7d3491b0', 4),
  ('FUSION', 'f274e1db-3a26-485b-b3a7-20fd0a2a0fb7'::uuid, 'v1.0.0', '7fe66174fa50728fed64d9ea2deb7ff634a6983a20eb1b3dd7974f37c3729e70', 1),
  ('MOD_ESTATUTOS', 'd8ac0b64-d438-48d2-b688-13b601902f5b'::uuid, 'v1.0.0', '4967b437bd9acaf2734fdf0cf71c26a1ba15126e3a9ca508f6c421b820bc33a6', 1),
  ('MODIFICACION_ESTATUTOS', '966d65d0-4b83-4773-9101-4e8b5fe7dbf3'::uuid, '1.0.1', '8f04caab4bab3ff95cfc5fce30c00fa5f3fd1ec85d006b724afa7fd2b1a7ca46', 2),
  ('NOMBRAMIENTO_AUDITOR', 'c74c3374-0f6a-4009-9724-95634bfe4678'::uuid, '1.1.1', '5d354e2acd99bf8900b58381f4e5509ffb0699353ea7915173c6097938873d74', 2),
  ('REDUCCION_CAPITAL', '99c1196a-babc-4249-ac55-86af43a02516'::uuid, '1.0.1', '77051be446d6d56196e512a89db42d313382aade6b8ccd767ae78c46da5a8ff3', 3),
  ('SUPRESION_PREFERENTE', 'a2f842ae-ba87-4293-9742-bd3ba95ad5b7'::uuid, 'v1.0.0', '86833269b115f6fde2724cd5cb35b5ceff4304e0b31679f4ddac07a38a88349f', 1);

CREATE OR REPLACE FUNCTION pg_temp.tgms_rulepack_docs_have(
  p_payload jsonb,
  p_doc_ids text[]
)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(p_doc_ids) AS expected(doc_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_payload #> '{documentacion,obligatoria}', '[]'::jsonb)) AS existing(doc)
      WHERE existing.doc ->> 'id' = expected.doc_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote1_is_fixed(
  p_pack_id text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT CASE p_pack_id
    WHEN 'AUMENTO_CAPITAL' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['informe_admin', 'texto_acuerdo'])
    WHEN 'CESE_CONSEJERO' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['identificacion_cargo', 'causa_o_subtipo'])
    WHEN 'ESCISION' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['balance', 'informe_admin'])
    WHEN 'FUSION' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['balance'])
    WHEN 'MOD_ESTATUTOS' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['derecho_informacion_287'])
    WHEN 'MODIFICACION_ESTATUTOS' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['texto_integro', 'derecho_informacion_287'])
    WHEN 'NOMBRAMIENTO_AUDITOR' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['aceptacion_auditor', 'duracion_3_9'])
    WHEN 'REDUCCION_CAPITAL' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['informe_admin', 'balance_si_procede', 'oposicion_acreedores_si_procede'])
    WHEN 'SUPRESION_PREFERENTE' THEN pg_temp.tgms_rulepack_docs_have(p_payload, ARRAY['informe_auditor_si_procede'])
    WHEN 'EXCLUSION_SOCIO' THEN
      COALESCE(NULLIF(p_payload #>> '{constitucion,quorum,SA_1a,valor}', '')::numeric, -1) = 0.5
      AND COALESCE(NULLIF(p_payload #>> '{constitucion,quorum,SA_2a,valor}', '')::numeric, -1) = 0.25
      AND p_payload #>> '{votacion,mayoria,SA,formula}' = '> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a'
      AND p_payload #>> '{votacion,mayoria,SL,formula}' = 'favor >= 2/3 capital'
    ELSE false
  END;
$$;

DO $$
DECLARE
  v_count integer;
  v_bad text;
BEGIN
  SELECT count(*)
    INTO v_count
  FROM tgms_lote1_expected;

  IF v_count <> 10 THEN
    RAISE EXCEPTION 'Preflight Lote 1: expected 10 target versions, got %', v_count;
  END IF;

  SELECT string_agg(e.pack_id || ':' || e.version, ', ' ORDER BY e.pack_id) INTO v_bad
  FROM tgms_lote1_expected e
  LEFT JOIN public.rule_pack_versions rpv
    ON rpv.id = e.rule_pack_version_id
   AND rpv.pack_id = e.pack_id
   AND rpv.version = e.version
   AND rpv.is_active = true
  WHERE rpv.id IS NULL;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight Lote 1: missing/inactive target rows: %', v_bad;
  END IF;

  SELECT string_agg(e.pack_id || ':' || rpv.payload_hash, ', ' ORDER BY e.pack_id) INTO v_bad
  FROM tgms_lote1_expected e
  JOIN public.rule_pack_versions rpv ON rpv.id = e.rule_pack_version_id
  WHERE rpv.payload_hash <> e.expected_db_payload_hash
    AND NOT pg_temp.tgms_lote1_is_fixed(rpv.pack_id, rpv.payload);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight Lote 1: payload drift detected: %', v_bad;
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT rpv.pack_id
    FROM public.rule_pack_versions rpv
    JOIN tgms_lote1_expected e ON e.pack_id = rpv.pack_id
    WHERE rpv.is_active = true
    GROUP BY rpv.pack_id
    HAVING count(*) > 1
  ) duplicates;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Preflight Lote 1: active duplicate targets detected: %', v_count;
  END IF;
END $$;

SELECT
  'preflight_ok' AS check_name,
  count(*) AS target_versions,
  sum(e.expected_findings) AS expected_probable_error_findings,
  count(*) FILTER (WHERE pg_temp.tgms_lote1_is_fixed(rpv.pack_id, rpv.payload)) AS already_fixed_versions,
  count(*) FILTER (WHERE rpv.payload_hash = e.expected_db_payload_hash) AS exact_hash_matches
FROM tgms_lote1_expected e
JOIN public.rule_pack_versions rpv ON rpv.id = e.rule_pack_version_id;

ROLLBACK;
