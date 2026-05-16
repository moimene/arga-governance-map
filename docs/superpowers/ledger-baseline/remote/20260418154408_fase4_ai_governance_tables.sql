-- Sistemas IA
CREATE TABLE IF NOT EXISTS ai_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  system_type text,
  risk_level text,
  vendor text,
  deployment_date date,
  owner_id uuid REFERENCES persons(id),
  status text DEFAULT 'ACTIVO',
  description text,
  use_case text,
  created_at timestamptz DEFAULT now()
);

-- Evaluaciones de riesgo IA
CREATE TABLE IF NOT EXISTS ai_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid REFERENCES ai_systems(id),
  framework text,
  score numeric,
  assessment_date date,
  assessor_id uuid REFERENCES persons(id),
  findings jsonb DEFAULT '[]',
  status text DEFAULT 'BORRADOR',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Controles e implementación
CREATE TABLE IF NOT EXISTS ai_compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id uuid REFERENCES ai_systems(id),
  requirement_code text NOT NULL,
  requirement_title text,
  description text,
  status text DEFAULT 'PENDIENTE',
  evidence_url text,
  checked_at date,
  checked_by_id uuid REFERENCES persons(id),
  created_at timestamptz DEFAULT now()
);

-- Incidentes IA
CREATE TABLE IF NOT EXISTS ai_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  system_id uuid REFERENCES ai_systems(id),
  title text NOT NULL,
  severity text,
  description text,
  status text DEFAULT 'ABIERTO',
  reported_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  root_cause text,
  corrective_action text
);

-- RLS básico
ALTER TABLE ai_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON ai_systems FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001');
CREATE POLICY "tenant_isolation" ON ai_incidents FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001');
