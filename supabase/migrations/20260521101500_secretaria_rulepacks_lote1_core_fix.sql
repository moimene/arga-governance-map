-- Lote 1 - Correccion core Secretaria 360 rule packs.
-- Alcance: resolver solo los PROBABLE_ERROR_RULE_PACK de Fase 1
-- sin modificar materias fuera del patch plan.

CREATE OR REPLACE FUNCTION pg_temp.tgms_rulepack_append_doc(
  p_payload jsonb,
  p_doc jsonb
)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_payload #> '{documentacion,obligatoria}', '[]'::jsonb)) AS existing(doc)
      WHERE existing.doc ->> 'id' = p_doc ->> 'id'
    )
      THEN p_payload
    ELSE jsonb_set(
      p_payload,
      '{documentacion,obligatoria}',
      COALESCE(p_payload #> '{documentacion,obligatoria}', '[]'::jsonb) || jsonb_build_array(p_doc),
      true
    )
  END;
$$;

WITH patched AS (
  SELECT
    rpv.id,
    CASE rpv.pack_id
      WHEN 'AUMENTO_CAPITAL' THEN
        pg_temp.tgms_rulepack_append_doc(
          pg_temp.tgms_rulepack_append_doc(
            rpv.payload,
            '{"id":"informe_admin","nombre":"Informe del organo de administracion","condicion":"SIEMPRE"}'::jsonb
          ),
          '{"id":"texto_acuerdo","nombre":"Texto del acuerdo de aumento de capital","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'CESE_CONSEJERO' THEN
        pg_temp.tgms_rulepack_append_doc(
          pg_temp.tgms_rulepack_append_doc(
            rpv.payload,
            '{"id":"identificacion_cargo","nombre":"Identificacion del cargo afectado","condicion":"SIEMPRE"}'::jsonb
          ),
          '{"id":"causa_o_subtipo","nombre":"Causa o subtipo del cese","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'ESCISION' THEN
        pg_temp.tgms_rulepack_append_doc(
          pg_temp.tgms_rulepack_append_doc(
            rpv.payload,
            '{"id":"balance","nombre":"Balance de escision","condicion":"SIEMPRE"}'::jsonb
          ),
          '{"id":"informe_admin","nombre":"Informe de administradores","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'FUSION' THEN
        pg_temp.tgms_rulepack_append_doc(
          rpv.payload,
          '{"id":"balance","nombre":"Balance de fusion","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'MOD_ESTATUTOS' THEN
        pg_temp.tgms_rulepack_append_doc(
          rpv.payload,
          '{"id":"derecho_informacion_287","nombre":"Derecho de informacion art. 287 LSC","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'MODIFICACION_ESTATUTOS' THEN
        pg_temp.tgms_rulepack_append_doc(
          pg_temp.tgms_rulepack_append_doc(
            rpv.payload,
            '{"id":"texto_integro","nombre":"Texto integro de la modificacion estatutaria","condicion":"SIEMPRE"}'::jsonb
          ),
          '{"id":"derecho_informacion_287","nombre":"Derecho de informacion art. 287 LSC","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'NOMBRAMIENTO_AUDITOR' THEN
        pg_temp.tgms_rulepack_append_doc(
          pg_temp.tgms_rulepack_append_doc(
            rpv.payload,
            '{"id":"aceptacion_auditor","nombre":"Aceptacion del auditor","condicion":"SIEMPRE"}'::jsonb
          ),
          '{"id":"duracion_3_9","nombre":"Duracion legal entre 3 y 9 anos","condicion":"SIEMPRE"}'::jsonb
        )
      WHEN 'REDUCCION_CAPITAL' THEN
        pg_temp.tgms_rulepack_append_doc(
          pg_temp.tgms_rulepack_append_doc(
            pg_temp.tgms_rulepack_append_doc(
              rpv.payload,
              '{"id":"informe_admin","nombre":"Informe del organo de administracion","condicion":"SIEMPRE"}'::jsonb
            ),
            '{"id":"balance_si_procede","nombre":"Balance cuando proceda","condicion":"SI_PROCEDE"}'::jsonb
          ),
          '{"id":"oposicion_acreedores_si_procede","nombre":"Oposicion de acreedores cuando proceda","condicion":"SI_PROCEDE"}'::jsonb
        )
      WHEN 'SUPRESION_PREFERENTE' THEN
        pg_temp.tgms_rulepack_append_doc(
          rpv.payload,
          '{"id":"informe_auditor_si_procede","nombre":"Informe de auditor cuando proceda","condicion":"SI_PROCEDE"}'::jsonb
        )
      WHEN 'EXCLUSION_SOCIO' THEN
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                rpv.payload,
                '{constitucion,quorum,SA_1a}',
                '{"valor":0.5,"fuente":"LEY","referencia":"arts. 194 y 201.2 LSC"}'::jsonb,
                true
              ),
              '{constitucion,quorum,SA_2a}',
              '{"valor":0.25,"fuente":"LEY","referencia":"arts. 194 y 201.2 LSC"}'::jsonb,
              true
            ),
            '{votacion,mayoria,SA}',
            '{"formula":"> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a","fuente":"LEY","referencia":"art. 201.2 LSC"}'::jsonb,
            true
          ),
          '{votacion,mayoria,SL}',
          '{"formula":"favor >= 2/3 capital","fuente":"LEY","referencia":"art. 199.b LSC"}'::jsonb,
          true
        )
      ELSE rpv.payload
    END AS payload
  FROM public.rule_pack_versions rpv
  WHERE rpv.is_active = true
    AND rpv.pack_id IN (
      'AUMENTO_CAPITAL',
      'CESE_CONSEJERO',
      'ESCISION',
      'EXCLUSION_SOCIO',
      'FUSION',
      'MOD_ESTATUTOS',
      'MODIFICACION_ESTATUTOS',
      'NOMBRAMIENTO_AUDITOR',
      'REDUCCION_CAPITAL',
      'SUPRESION_PREFERENTE'
    )
)
UPDATE public.rule_pack_versions rpv
SET
  payload = patched.payload,
  payload_hash = encode(extensions.digest(patched.payload::text, 'sha256'), 'hex'),
  status = 'ACTIVE',
  is_active = true,
  approved_at = COALESCE(rpv.approved_at, now())
FROM patched
WHERE rpv.id = patched.id
  AND rpv.payload IS DISTINCT FROM patched.payload;
