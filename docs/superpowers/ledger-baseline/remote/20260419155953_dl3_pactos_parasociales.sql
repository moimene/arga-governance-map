-- DL-3: Pacto parasocial Fundación ARGA
CREATE TABLE IF NOT EXISTS pactos_parasociales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  nombre text NOT NULL,
  firmante_principal text NOT NULL,
  participacion_pct numeric(8,4),
  tipo_pacto text NOT NULL DEFAULT 'VETO',
  ambito_materias text[] NOT NULL DEFAULT '{}',
  condicion_activacion text,
  vigente_desde date,
  vigente_hasta date,
  activo boolean DEFAULT true,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- Seed: Fundación ARGA 69.69% — veto on structural operations
INSERT INTO pactos_parasociales (
  tenant_id, entity_id, nombre, firmante_principal, participacion_pct,
  tipo_pacto, ambito_materias, condicion_activacion, vigente_desde, activo, notas
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'Pacto de Sindicación Fundación ARGA',
  'Fundación ARGA (vía Cartera ARGA S.L.U.)',
  69.69,
  'VETO',
  ARRAY['FUSION_SOCIEDAD', 'ESCISION_SOCIEDAD', 'DISOLUCION', 'TRANSFORMACION_SOCIEDAD', 'VENTA_ACTIVOS_SIGNIFICATIVOS'],
  'Voto favorable de Fundación ARGA requerido para operaciones estructurales y venta de activos >15% del patrimonio neto',
  '2020-01-01',
  true,
  'Pacto demo derivado de la estructura accionarial ARGA. Fundación ARGA → Cartera ARGA S.L.U. (100%) → 69.69% ARGA Seguros S.A. El pacto concede derecho de veto en operaciones que puedan alterar sustancialmente la estructura del grupo.'
);

-- RLS
ALTER TABLE pactos_parasociales ENABLE ROW LEVEL SECURITY;

CREATE POLICY pactos_parasociales_tenant_isolation ON pactos_parasociales
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);
