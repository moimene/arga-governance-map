-- Postflight Lote 1 - Correccion core Secretaria 360.
-- Ejecutar despues de 02_patch.sql y antes de reconstruir artefactos Fase 1.

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL statement_timeout = '45s';

CREATE TEMP TABLE tgms_lote1_expected (
  pack_id text PRIMARY KEY,
  rule_pack_version_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO tgms_lote1_expected (pack_id, rule_pack_version_id)
VALUES
  ('AUMENTO_CAPITAL', '64f4de9c-bb3f-47db-8f79-87bd49b694ed'::uuid),
  ('CESE_CONSEJERO', '4a97f0a9-b5e3-4e85-9829-d2fde0348483'::uuid),
  ('ESCISION', '77177821-9ed8-49bf-b7a1-087939530639'::uuid),
  ('EXCLUSION_SOCIO', 'e0418837-6f71-434e-bda8-98b809f1cd93'::uuid),
  ('FUSION', 'f274e1db-3a26-485b-b3a7-20fd0a2a0fb7'::uuid),
  ('MOD_ESTATUTOS', 'd8ac0b64-d438-48d2-b688-13b601902f5b'::uuid),
  ('MODIFICACION_ESTATUTOS', '966d65d0-4b83-4773-9101-4e8b5fe7dbf3'::uuid),
  ('NOMBRAMIENTO_AUDITOR', 'c74c3374-0f6a-4009-9724-95634bfe4678'::uuid),
  ('REDUCCION_CAPITAL', '99c1196a-babc-4249-ac55-86af43a02516'::uuid),
  ('SUPRESION_PREFERENTE', 'a2f842ae-ba87-4293-9742-bd3ba95ad5b7'::uuid);

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

SELECT
  'lote1_fixed_versions' AS metric,
  count(*) AS value
FROM tgms_lote1_expected e
JOIN public.rule_pack_versions rpv ON rpv.id = e.rule_pack_version_id
WHERE pg_temp.tgms_lote1_is_fixed(rpv.pack_id, rpv.payload);

SELECT
  'lote1_unfixed_versions' AS metric,
  count(*) AS value
FROM tgms_lote1_expected e
JOIN public.rule_pack_versions rpv ON rpv.id = e.rule_pack_version_id
WHERE NOT pg_temp.tgms_lote1_is_fixed(rpv.pack_id, rpv.payload);

SELECT
  'active_duplicate_targets' AS metric,
  count(*) AS value
FROM (
  SELECT rpv.pack_id
  FROM public.rule_pack_versions rpv
  JOIN tgms_lote1_expected e ON e.pack_id = rpv.pack_id
  WHERE rpv.is_active = true
  GROUP BY rpv.pack_id
  HAVING count(*) > 1
) duplicates;

SELECT
  'audit_entries_lote1' AS metric,
  count(*) AS value
FROM public.audit_log
WHERE action = 'SECRETARIA_RULEPACK_LOTE1_CORE_FIX'
  AND delta ->> 'migration' = '20260521101500_secretaria_rulepacks_lote1_core_fix';

SELECT
  rpv.pack_id,
  rpv.version,
  rpv.id AS rule_pack_version_id,
  rpv.payload_hash AS db_payload_hash
FROM public.rule_pack_versions rpv
JOIN tgms_lote1_expected e ON e.rule_pack_version_id = rpv.id
ORDER BY rpv.pack_id;

ROLLBACK;
