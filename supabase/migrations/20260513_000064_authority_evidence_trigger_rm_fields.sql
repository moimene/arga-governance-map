-- 20260513_000064_authority_evidence_trigger_rm_fields.sql
-- Spec L17, L23: trigger fn_sync_authority_evidence ahora propaga
-- inscripcion_rm_referencia + inscripcion_rm_fecha + incluye VICESECRETARIO.
-- Backfill correctivo: 10 PRESIDENTEs y otros cargos vigentes sin AE.

BEGIN;

CREATE OR REPLACE FUNCTION fn_sync_authority_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cargos_certificantes text[] := ARRAY[
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
    'CONSEJERO_COORDINADOR'
  ];
BEGIN
  IF TG_OP = 'INSERT' AND NEW.tipo_condicion = ANY (v_cargos_certificantes) THEN
    INSERT INTO authority_evidence (
      tenant_id, entity_id, body_id, person_id, cargo,
      fecha_inicio, fecha_fin,
      fuente_designacion, inscripcion_rm_referencia, inscripcion_rm_fecha,
      estado
    ) VALUES (
      NEW.tenant_id, NEW.entity_id, NEW.body_id, NEW.person_id, NEW.tipo_condicion,
      NEW.fecha_inicio, NEW.fecha_fin,
      COALESCE(NEW.fuente_designacion, 'BOOTSTRAP'),
      NEW.inscripcion_rm_referencia,
      NEW.inscripcion_rm_fecha,
      NEW.estado
    )
    ON CONFLICT (tenant_id, entity_id,
      (COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      person_id, cargo)
    WHERE estado = 'VIGENTE'
    DO NOTHING;

  ELSIF TG_OP = 'UPDATE' AND NEW.tipo_condicion = ANY (v_cargos_certificantes) THEN
    IF NEW.estado = 'CESADO' AND OLD.estado = 'VIGENTE' THEN
      UPDATE authority_evidence
      SET estado = 'CESADO',
          fecha_fin = COALESCE(NEW.fecha_fin, CURRENT_DATE),
          updated_at = now()
      WHERE tenant_id = NEW.tenant_id
        AND entity_id = NEW.entity_id
        AND COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE(NEW.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND person_id = NEW.person_id
        AND cargo = NEW.tipo_condicion
        AND estado = 'VIGENTE';
    ELSIF NEW.estado = 'VIGENTE' AND (
      NEW.inscripcion_rm_referencia IS DISTINCT FROM OLD.inscripcion_rm_referencia
      OR NEW.inscripcion_rm_fecha IS DISTINCT FROM OLD.inscripcion_rm_fecha
    ) THEN
      UPDATE authority_evidence
      SET inscripcion_rm_referencia = NEW.inscripcion_rm_referencia,
          inscripcion_rm_fecha = NEW.inscripcion_rm_fecha,
          updated_at = now()
      WHERE tenant_id = NEW.tenant_id
        AND entity_id = NEW.entity_id
        AND COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE(NEW.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND person_id = NEW.person_id
        AND cargo = NEW.tipo_condicion
        AND estado = 'VIGENTE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill A: rellenar campos RM en AEs vigentes con valores actuales de condiciones_persona
UPDATE authority_evidence ae
SET inscripcion_rm_referencia = cp.inscripcion_rm_referencia,
    inscripcion_rm_fecha = cp.inscripcion_rm_fecha,
    updated_at = now()
FROM condiciones_persona cp
WHERE cp.tenant_id = ae.tenant_id
  AND cp.person_id = ae.person_id
  AND cp.entity_id = ae.entity_id
  AND COALESCE(cp.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(ae.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
  AND cp.tipo_condicion = ae.cargo
  AND cp.estado = 'VIGENTE'
  AND ae.estado = 'VIGENTE'
  AND (ae.inscripcion_rm_referencia IS NULL OR ae.inscripcion_rm_referencia = '')
  AND cp.inscripcion_rm_referencia IS NOT NULL;

-- Backfill B: crear AE para cargos certificantes vigentes sin AE correspondiente
INSERT INTO authority_evidence (
  tenant_id, entity_id, body_id, person_id, cargo,
  fecha_inicio, fecha_fin,
  fuente_designacion, inscripcion_rm_referencia, inscripcion_rm_fecha,
  estado
)
SELECT cp.tenant_id, cp.entity_id, cp.body_id, cp.person_id, cp.tipo_condicion,
       cp.fecha_inicio, cp.fecha_fin,
       COALESCE(cp.fuente_designacion, 'BOOTSTRAP'),
       cp.inscripcion_rm_referencia,
       cp.inscripcion_rm_fecha,
       cp.estado
FROM condiciones_persona cp
WHERE cp.estado = 'VIGENTE'
  AND cp.tipo_condicion IN (
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
    'CONSEJERO_COORDINADOR'
  )
  AND NOT EXISTS (
    SELECT 1 FROM authority_evidence ae
    WHERE ae.tenant_id = cp.tenant_id
      AND ae.person_id = cp.person_id
      AND ae.entity_id = cp.entity_id
      AND COALESCE(ae.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(cp.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ae.cargo = cp.tipo_condicion
      AND ae.estado = 'VIGENTE'
  )
ON CONFLICT (tenant_id, entity_id,
  (COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  person_id, cargo)
WHERE estado = 'VIGENTE'
DO NOTHING;

COMMIT;
