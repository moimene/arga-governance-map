-- Auditoria SL + Consejo de Administracion para rule packs
--
-- Uso previsto:
-- 1. Ejecutar solo tras `bun run db:check-target` confirmando governance_OS.
-- 2. Revisar resultados antes de cualquier UPDATE de payload.
-- 3. Esta query es solo lectura.

WITH active_packs AS (
  SELECT
    rp.id AS rule_pack_id,
    rp.materia,
    rp.organo_tipo,
    rpv.id AS rule_pack_version_id,
    rpv.version,
    rpv.payload,
    rpv.payload->'votacion'->'mayoria'->>'SL' AS mayoria_sl_raw,
    rpv.payload->'votacion'->'mayoria'->'SL'->>'formula' AS mayoria_sl_formula,
    rpv.payload->'convocatoria'->'antelacionDias'->'SA'->>'valor' AS plazo_sa,
    rpv.payload->'convocatoria'->'antelacionDias'->'SL'->>'valor' AS plazo_sl
  FROM rule_packs rp
  JOIN rule_pack_versions rpv ON rpv.pack_id = rp.id
  WHERE rpv.is_active = true
),
classified AS (
  SELECT
    *,
    CASE
      WHEN materia IN (
        'APROBACION_CUENTAS',
        'APLICACION_RESULTADO',
        'DISTRIBUCION_DIVIDENDOS',
        'NOMBRAMIENTO_CONSEJERO',
        'CESE_CONSEJERO',
        'NOMBRAMIENTO_AUDITOR',
        'RATIFICACION_ACTOS',
        'APROBACION_PLAN_NEGOCIO'
      ) THEN 'SL_SIMPLE_ART_198_GT_1_3'
      WHEN materia IN (
        'AUMENTO_CAPITAL',
        'REDUCCION_CAPITAL',
        'MODIFICACION_ESTATUTOS',
        'MOD_ESTATUTOS',
        'CAMBIO_DENOMINACION',
        'TRASLADO_DOMICILIO_NACIONAL',
        'PRESTACIONES_ACCESORIAS'
      ) THEN 'SL_REFORZADA_ART_199A_GT_1_2'
      WHEN materia IN (
        'TRANSFORMACION',
        'FUSION',
        'ESCISION',
        'FUSION_ESCISION',
        'CESION_GLOBAL_ACTIVO',
        'EXCLUSION_DERECHO_SUSCRIPCION',
        'AUTORIZACION_COMPETENCIA',
        'EXCLUSION_SOCIO',
        'TRASLADO_DOMICILIO_EXTRANJERO'
      ) THEN 'SL_REFORZADA_ART_199B_2_3'
      ELSE 'SL_REVIEW_MANUAL'
    END AS sl_expected_bucket
  FROM active_packs
)
SELECT
  materia,
  organo_tipo,
  version,
  rule_pack_version_id,
  sl_expected_bucket,
  mayoria_sl_formula,
  plazo_sa,
  plazo_sl,
  CASE
    WHEN plazo_sa::numeric < 30 THEN 'ERROR_PLAZO_SA_LT_30'
    WHEN sl_expected_bucket = 'SL_SIMPLE_ART_198_GT_1_3'
      AND mayoria_sl_formula !~* '(1/3|tercio)' THEN 'REVIEW_SL_SIMPLE_NOT_1_3'
    WHEN sl_expected_bucket = 'SL_REFORZADA_ART_199A_GT_1_2'
      AND mayoria_sl_formula !~* '(1/2|mitad|0\.5)' THEN 'REVIEW_SL_HALF_NOT_1_2'
    WHEN sl_expected_bucket = 'SL_REFORZADA_ART_199B_2_3'
      AND mayoria_sl_formula !~* '(2/3|dos|0\.66)' THEN 'REVIEW_SL_TWO_THIRDS_NOT_2_3'
    WHEN organo_tipo IN ('COMISION_DELEGADA', 'CONSEJERO_DELEGADO')
      AND materia IN (
        'FORMULACION_CUENTAS',
        'CUENTAS_CONSOLIDADAS',
        'MODIFICACION_ESTATUTOS',
        'CONVOCATORIA_JUNTA',
        'POLITICA_REMUNERACION',
        'POLITICAS_CORPORATIVAS',
        'APROBACION_PLAN_NEGOCIO',
        'APROBACION_PRESUPUESTO',
        'DISTRIBUCION_CARGOS',
        'COMITES_INTERNOS',
        'DELEGACION_FACULTADES',
        'OPERACION_VINCULADA'
      ) THEN 'REVIEW_ART_249_BIS_INDELEGABLE'
    ELSE 'OK_OR_MANUAL'
  END AS audit_result
FROM classified
WHERE
  plazo_sa::numeric < 30
  OR sl_expected_bucket = 'SL_REVIEW_MANUAL'
  OR (
    sl_expected_bucket = 'SL_SIMPLE_ART_198_GT_1_3'
    AND mayoria_sl_formula !~* '(1/3|tercio)'
  )
  OR (
    sl_expected_bucket = 'SL_REFORZADA_ART_199A_GT_1_2'
    AND mayoria_sl_formula !~* '(1/2|mitad|0\.5)'
  )
  OR (
    sl_expected_bucket = 'SL_REFORZADA_ART_199B_2_3'
    AND mayoria_sl_formula !~* '(2/3|dos|0\.66)'
  )
ORDER BY audit_result, materia, organo_tipo, version;
