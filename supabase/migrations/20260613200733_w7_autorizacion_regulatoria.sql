-- W7 — autorizaciones regulatorias sectoriales (G13) (2026-06-13).
-- ============================================================================
-- Tabla de autorizaciones previas de supervisores sectoriales (DGSFP/SUSEP/
-- CNSF/BdP/CNMV/BdE) que ciertas materias estructurales exigen en filiales
-- reguladas. El evaluador puro (autorizaciones-regulatorias.ts) surface el
-- estado required/missing/expired; el enforcement como hard-block en el flujo
-- es trabajo futuro. RLS por tenant. Forward-only, idempotente.

CREATE TABLE IF NOT EXISTS autorizacion_regulatoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sociedad_id uuid NOT NULL,
  organismo text NOT NULL CHECK (organismo IN ('DGSFP','SUSEP','CNSF','BDP','CNMV','BDE','OTRO')),
  materia text,
  referencia text NOT NULL,
  fecha_emision date,
  fecha_vigencia_hasta date,
  estado text NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE','EXPIRADA','REVOCADA')),
  documento_evidencia_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autorizacion_regulatoria_sociedad
  ON autorizacion_regulatoria (tenant_id, sociedad_id);

ALTER TABLE autorizacion_regulatoria ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename='autorizacion_regulatoria' AND policyname='autorizacion_regulatoria_tenant_isolation'
  ) THEN
    CREATE POLICY autorizacion_regulatoria_tenant_isolation
      ON autorizacion_regulatoria FOR ALL TO authenticated
      USING (tenant_id = fn_current_tenant_id());
  END IF;
END $$;

-- Seed demo: ARGA Seguros S.A. con autorización DGSFP vigente.
INSERT INTO autorizacion_regulatoria
  (tenant_id, sociedad_id, organismo, materia, referencia, fecha_emision, fecha_vigencia_hasta, estado)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'DGSFP', 'OPERACION_ESTRUCTURAL', 'DGSFP-AUT-2026-ARGA-0001',
  '2026-01-15', '2027-01-15', 'VIGENTE'
WHERE NOT EXISTS (
  SELECT 1 FROM autorizacion_regulatoria
   WHERE sociedad_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND organismo='DGSFP'
);
