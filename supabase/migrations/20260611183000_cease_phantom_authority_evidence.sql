-- ITEM-029 / ITEM-043 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- authority_evidence arrastraba 12 cargos fantasma VIGENTES en la entidad
-- ARGA (6d7ed736): AE cuyo person_id NO tiene una condiciones_persona VIGENTE
-- con tipo_condicion = cargo en el mismo órgano. Origen: el seed 2026-04-21
-- creó AE para personas dummy; la limpieza 2026-04-24/25 purgó las condiciones
-- pero dejó las AE huérfanas, y oleadas posteriores añadieron presidentes de
-- comisión sin condición de respaldo. Consecuencia: 2 PRESIDENTE y 2
-- SECRETARIO VIGENTES en el CdA canónico y presidentes duplicados en las 9
-- comisiones; usePresidenteVigente (limit(1) sin ORDER BY) precargaba el Vº Bº
-- de forma no determinista, pudiendo atribuirlo a quien no es presidente
-- (arts. 109-111 RRM).
--
-- Fix en dos capas:
--   1. Data: cesar las AE VIGENTES de la entidad ARGA sin condición de
--      respaldo cargo-a-cargo (regla verificada órgano a órgano: deja
--      exactamente 1 PRESIDENTE + 1 SECRETario por órgano operativo).
--   2. Integridad: índice único parcial — un órgano no puede tener dos
--      PRESIDENTE ni dos SECRETARIO VIGENTES (verificado: 0 colisiones
--      globales post-fix). No se restringen otros cargos (la estructura ARGA
--      declara 2 VICEPRESIDENTES).
-- Forward-only. La purga es de datos demo incoherentes, no de historial WORM.

UPDATE authority_evidence ae
SET estado = 'CESADO',
    fecha_fin = COALESCE(ae.fecha_fin, CURRENT_DATE),
    metadata = COALESCE(ae.metadata, '{}'::jsonb) || jsonb_build_object(
      'cese_motivo', 'ITEM-029: cargo fantasma sin condiciones_persona VIGENTE de respaldo (loop estabilización 2026-06-11)'
    )
WHERE ae.estado = 'VIGENTE'
  AND ae.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
  AND NOT EXISTS (
    SELECT 1 FROM condiciones_persona cp
    WHERE cp.person_id = ae.person_id
      AND cp.entity_id = ae.entity_id
      AND cp.body_id IS NOT DISTINCT FROM ae.body_id
      AND cp.estado = 'VIGENTE'
      AND cp.tipo_condicion = ae.cargo
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_authority_evidence_pres_sec_vigente
ON authority_evidence (
  tenant_id,
  entity_id,
  COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid),
  cargo
)
WHERE estado = 'VIGENTE' AND cargo IN ('PRESIDENTE', 'SECRETARIO');
