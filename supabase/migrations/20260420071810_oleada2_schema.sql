-- Migration 000012 Part 1 — Schema changes for Oleada 2

ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS materia_acuerdo TEXT;

ALTER TABLE plantillas_protegidas
  DROP CONSTRAINT IF EXISTS plantillas_protegidas_tipo_check;

ALTER TABLE plantillas_protegidas
  ADD CONSTRAINT plantillas_protegidas_tipo_check
  CHECK (tipo IN (
    'ACTA_SESION', 'ACTA_CONSIGNACION', 'ACTA_ACUERDO_ESCRITO',
    'CERTIFICACION', 'CONVOCATORIA', 'CONVOCATORIA_SL_NOTIFICACION',
    'COMISION_DELEGADA', 'MODELO_ACUERDO'
  ));

CREATE INDEX IF NOT EXISTS idx_plantillas_materia
  ON plantillas_protegidas(tenant_id, materia_acuerdo, organo_tipo, estado)
  WHERE materia_acuerdo IS NOT NULL;
