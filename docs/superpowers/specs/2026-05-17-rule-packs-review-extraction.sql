-- =============================================================================
-- Rule Packs Review Extraction - MatterExecutionProfile
-- Fecha: 2026-05-17
-- Proposito: extraer payloads de rule packs vigentes para materias prioritarias.
-- Uso: READ-ONLY. No modifica datos. Ejecutar solo tras bun run db:check-target.
-- Target esperado: governance_OS / hzqwefkwsxopwrmtksbg
-- =============================================================================

-- IMPORTANTE: Este SQL es solo SELECT.
-- No contiene INSERT, UPDATE, DELETE ni DDL.

-- 1. Inventario de rule packs vigentes con materias prioritarias.

SELECT
  rp.id AS rule_pack_id,
  rp.tenant_id,
  rp.materia,
  rp.organo_tipo,
  rp.descripcion,
  rpv.id AS rule_pack_version_id,
  rpv.pack_id,
  rpv.version,
  rpv.is_active,
  rpv.status,
  rpv.created_at,
  rpv.approved_at,
  rpv.approved_by,
  rpv.payload_hash,
  rpv.payload -> 'convocatoria' AS payload_convocatoria,
  rpv.payload -> 'constitucion' AS payload_constitucion,
  rpv.payload -> 'quorum' AS payload_quorum,
  rpv.payload -> 'votacion' AS payload_votacion,
  rpv.payload -> 'mayoria' AS payload_mayoria,
  rpv.payload -> 'documentacion' AS payload_documentacion,
  rpv.payload -> 'postAcuerdo' AS payload_post_acuerdo,
  rpv.payload -> 'inscripcion' AS payload_inscripcion,
  length(rpv.payload::text) AS payload_chars
FROM rule_packs rp
JOIN rule_pack_versions rpv ON rpv.pack_id = rp.id
WHERE rpv.is_active = true
  AND rp.materia IN (
    'MODIFICACION_ESTATUTOS', 'MOD_ESTATUTOS',
    'AUMENTO_CAPITAL', 'REDUCCION_CAPITAL',
    'FUSION_ESCISION', 'FUSION', 'ESCISION',
    'NOMBRAMIENTO_CONSEJERO', 'NOMBRAMIENTO', 'COOPTACION',
    'DELEGACION_FACULTADES', 'NOMBRAMIENTO_AUDITOR',
    'APROBACION_CUENTAS', 'FORMULACION_CUENTAS',
    'DISTRIBUCION_DIVIDENDOS', 'APLICACION_RESULTADO',
    'OPERACION_VINCULADA', 'CESE_CONSEJERO',
    'TRANSFORMACION', 'CESION_GLOBAL', 'CESION_GLOBAL_ACTIVO',
    'DISOLUCION', 'ACTIVOS_ESENCIALES',
    'AUTORIZACION_GARANTIA', 'EMISION_OBLIGACIONES'
  )
ORDER BY
  CASE
    WHEN rp.materia IN (
      'MODIFICACION_ESTATUTOS', 'MOD_ESTATUTOS',
      'AUMENTO_CAPITAL', 'REDUCCION_CAPITAL',
      'FUSION_ESCISION', 'FUSION', 'ESCISION',
      'NOMBRAMIENTO_CONSEJERO', 'NOMBRAMIENTO',
      'COOPTACION', 'DELEGACION_FACULTADES',
      'NOMBRAMIENTO_AUDITOR'
    ) THEN 1
    WHEN rp.materia IN (
      'APROBACION_CUENTAS', 'FORMULACION_CUENTAS',
      'DISTRIBUCION_DIVIDENDOS'
    ) THEN 2
    ELSE 3
  END,
  rp.materia,
  rpv.version DESC;

-- 2. Conteo total de rule packs activos.

SELECT
  COUNT(*) AS total_rule_pack_versions_activas,
  COUNT(DISTINCT rp.materia) AS materias_distintas,
  COUNT(DISTINCT rp.organo_tipo) AS organos_distintos
FROM rule_packs rp
JOIN rule_pack_versions rpv ON rpv.pack_id = rp.id
WHERE rpv.is_active = true;

-- 3. Materias con mas de una version activa para el mismo organo.
-- Estas filas requieren revision tecnica porque pueden producir ambiguedad.

SELECT
  rp.materia,
  rp.organo_tipo,
  COUNT(*) AS versiones_activas,
  array_agg(rpv.version ORDER BY rpv.version DESC) AS versiones,
  array_agg(rpv.id ORDER BY rpv.version DESC) AS rule_pack_version_ids
FROM rule_packs rp
JOIN rule_pack_versions rpv ON rpv.pack_id = rp.id
WHERE rpv.is_active = true
GROUP BY rp.materia, rp.organo_tipo
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, rp.materia, rp.organo_tipo;

-- 4. Schema discovery.
-- Descomentar solo si el schema Cloud no coincide con el contrato local.

-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'rule_packs'
-- ORDER BY ordinal_position;
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'rule_pack_versions'
-- ORDER BY ordinal_position;
--
-- SELECT DISTINCT jsonb_object_keys(rpv.payload) AS payload_key
-- FROM rule_pack_versions rpv
-- WHERE rpv.is_active = true
-- ORDER BY payload_key
-- LIMIT 100;
