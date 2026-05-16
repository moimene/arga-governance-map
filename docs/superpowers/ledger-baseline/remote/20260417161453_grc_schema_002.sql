-- Packs por País
CREATE TABLE country_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  country_code TEXT NOT NULL,
  pack_name TEXT NOT NULL,
  active_modules TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_country_packs_tenant ON country_packs(tenant_id, country_code);

CREATE TABLE pack_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES country_packs(id) ON DELETE CASCADE,
  framework_code TEXT NOT NULL,
  effective_date DATE,
  local_adaptations JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  probability INTEGER CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER CHECK (impact BETWEEN 1 AND 5),
  inherent_score INTEGER GENERATED ALWAYS AS (probability * impact) STORED,
  residual_score NUMERIC,
  module_id TEXT,
  owner_id UUID REFERENCES persons(id),
  obligation_id UUID REFERENCES obligations(id),
  finding_id UUID REFERENCES findings(id),
  entity_id UUID REFERENCES entities(id),
  status TEXT DEFAULT 'Abierto' CHECK (status IN ('Abierto','En tratamiento','Mitigado','Cerrado')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_risks_tenant_module ON risks(tenant_id, module_id);
CREATE INDEX idx_risks_obligation ON risks(obligation_id);
CREATE INDEX idx_risks_finding ON risks(finding_id);

CREATE SEQUENCE IF NOT EXISTS incidents_code_seq START 100;

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL UNIQUE DEFAULT ('INC-' || EXTRACT(YEAR FROM now())::int || '-' || lpad(nextval('incidents_code_seq')::text, 4, '0')),
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('Crítico','Alto','Medio','Bajo')),
  incident_type TEXT,
  is_major_incident BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Abierto' CHECK (status IN ('Abierto','En contención','En investigación','Resuelto','Cerrado')),
  reported_by UUID REFERENCES persons(id),
  assigned_to UUID REFERENCES persons(id),
  obligation_id UUID REFERENCES obligations(id),
  entity_id UUID REFERENCES entities(id),
  country_code TEXT,
  detection_date TIMESTAMPTZ DEFAULT now(),
  containment_date TIMESTAMPTZ,
  resolution_date TIMESTAMPTZ,
  root_cause TEXT,
  lessons_learned TEXT,
  regulatory_notification_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_incidents_tenant_type ON incidents(tenant_id, incident_type);
CREATE INDEX idx_incidents_obligation ON incidents(obligation_id);
CREATE INDEX idx_incidents_country ON incidents(country_code);

CREATE TABLE vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cve_id TEXT,
  title TEXT NOT NULL,
  cvss_score NUMERIC,
  severity TEXT CHECK (severity IN ('Crítico','Alto','Medio','Bajo')),
  asset_name TEXT,
  status TEXT DEFAULT 'Abierta' CHECK (status IN ('Abierta','En mitigación','Parcheada','Aceptada')),
  remediation_due DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vulns_tenant ON vulnerabilities(tenant_id);

CREATE TABLE bcm_bia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  function_name TEXT NOT NULL,
  is_critical BOOLEAN DEFAULT false,
  rto_objective INTEGER,
  rpo_objective INTEGER,
  mtd_objective INTEGER,
  entity_id UUID REFERENCES entities(id),
  approved_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bcm_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  plan_code TEXT NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('BCP','DRP')),
  bia_id UUID REFERENCES bcm_bia(id),
  last_test_date DATE,
  next_test_date DATE,
  test_result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL UNIQUE,
  obligation_id UUID REFERENCES obligations(id),
  requester_id UUID REFERENCES persons(id),
  approver_id UUID REFERENCES persons(id),
  justification TEXT,
  compensatory_controls TEXT,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Aprobada','Rechazada','Expirada')),
  requested_at DATE DEFAULT CURRENT_DATE,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE regulatory_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  authority TEXT NOT NULL,
  notification_type TEXT,
  notification_deadline TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','Enviada','Aceptada','Rechazada')),
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_regnot_incident ON regulatory_notifications(incident_id);

CREATE TABLE grc_module_nav (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  module_id TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('operate','governance','config')),
  view_key TEXT NOT NULL,
  label TEXT NOT NULL,
  route TEXT NOT NULL,
  icon TEXT,
  required_roles TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_modnav ON grc_module_nav(tenant_id, module_id, section);

ALTER TABLE country_packs DISABLE ROW LEVEL SECURITY;
ALTER TABLE pack_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE risks DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcm_bia DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcm_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE grc_module_nav DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fn_auto_regulatory_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_authority TEXT;
  v_type TEXT;
BEGIN
  IF NEW.is_major_incident IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM regulatory_notifications WHERE incident_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  CASE NEW.incident_type
    WHEN 'DORA' THEN v_authority := 'BdE';  v_type := 'DORA Major ICT Incident Final';
    WHEN 'GDPR' THEN v_authority := 'AEPD'; v_type := 'GDPR Art. 33 Data Breach';
    ELSE RETURN NEW;
  END CASE;
  INSERT INTO regulatory_notifications (
    tenant_id, incident_id, authority, notification_type,
    notification_deadline, status
  ) VALUES (
    NEW.tenant_id, NEW.id, v_authority, v_type,
    COALESCE(NEW.detection_date, now()) + interval '72 hours',
    'Pendiente'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidents_auto_regnot
AFTER INSERT OR UPDATE OF is_major_incident ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_auto_regulatory_notification();

CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_incidents_touch
BEFORE UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
