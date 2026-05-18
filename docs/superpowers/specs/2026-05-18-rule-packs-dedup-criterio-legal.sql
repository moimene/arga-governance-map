-- Rule packs duplicados — aplicacion del criterio legal recibido (2026-05-18)
--
-- NO ejecutar sin antes:
-- 1. bun run db:check-target y confirmar governance_OS (hzqwefkwsxopwrmtksbg).
-- 2. Revisar APROBACION_CUENTAS: migrar documentacion util desde 937f... a b785...
--    antes de archivar la version con plazo SA=15.
-- 3. Resolver AUTORIZACION_GARANTIA como split por organo_tipo / es_activo_esencial.
-- 4. Inspeccionar RATIFICACION_ACTOS 1.1.0 vs 1.0.0 antes de archivar.

BEGIN;

-- Versiones cuya desactivacion queda confirmada por criterio legal.
WITH archive_targets(id, materia, motivo) AS (
  VALUES
    (
      '38eae4fc-586d-4747-a3a1-e5b6eb0217ee'::uuid,
      'AUMENTO_CAPITAL',
      'Archivar v1.0.0 corta sin convocatoria; mantener 8e07a7fa completa'
    ),
    (
      '15d35f5d-0986-47c5-88b0-6e5ce773c09c'::uuid,
      'REDUCCION_CAPITAL',
      'Archivar v1.0.0 corta sin convocatoria; mantener 4f4df151 completa'
    ),
    (
      '77260d09-ae92-491a-a31d-f240a7179be0'::uuid,
      'DELEGACION_FACULTADES',
      'Archivar 1.0.0; mantener 36a3b08c 1.1.0 con verificacion art. 249 bis'
    ),
    (
      '1d65d252-944f-4b7d-8056-e3a6b1e5e278'::uuid,
      'NOMBRAMIENTO_AUDITOR',
      'Archivar 1.0.0; mantener cc38f0b4 1.1.0 con independencia y propuesta'
    ),
    (
      'c7000f00-7eec-4d57-bc05-3b9dae610ec5'::uuid,
      'OPERACION_VINCULADA',
      'Archivar 1.1.0; mantener 05fd0c53 con presentes_mitad_no_vinculados'
    )
)
UPDATE rule_pack_versions rpv
SET is_active = false
FROM archive_targets target
WHERE rpv.id = target.id
  AND rpv.is_active = true
RETURNING rpv.id, target.materia, rpv.version, target.motivo;

-- APROBACION_CUENTAS:
-- Criterio: mantener b7852567-e781-41ad-aea1-48c750882853 (SA=30).
-- Archivar despues de migrar documentacion: 937f4156-d67b-4855-b2aa-5fbe71a93864.
--
-- UPDATE rule_pack_versions
-- SET is_active = false
-- WHERE id = '937f4156-d67b-4855-b2aa-5fbe71a93864'
--   AND is_active = true;

-- AUTORIZACION_GARANTIA:
-- No archivar todavia. Separar en dos rule packs:
-- - Consejo / no activo esencial: 32d9f964-d6eb-42c0-935a-2bfaece1aec1
-- - Junta / activo esencial art. 160.f: ad81c829-0b8f-4992-b43b-64caf222083e

-- RATIFICACION_ACTOS:
-- Criterio preliminar: mantener 8476e78f-ac8b-437f-81a6-d9bb46793ea4 (1.1.0).
-- Archivar adab8a7f-9557-468a-a100-664188930ab7 solo tras inspeccion detallada.

-- Verificacion: no deben quedar duplicados activos salvo los expresamente aplazados.
SELECT
  rp.materia,
  rp.organo_tipo,
  COUNT(*) AS active_versions,
  array_agg(rpv.id ORDER BY rpv.version DESC) AS active_version_ids,
  array_agg(rpv.version ORDER BY rpv.version DESC) AS active_versions_labels
FROM rule_packs rp
JOIN rule_pack_versions rpv ON rpv.pack_id = rp.id
WHERE rpv.is_active = true
GROUP BY rp.materia, rp.organo_tipo
HAVING COUNT(*) > 1
ORDER BY rp.materia, rp.organo_tipo;

-- Revisar el resultado antes de COMMIT.
-- COMMIT;
ROLLBACK;
