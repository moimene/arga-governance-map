CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_tenant_id UUID REFERENCES tenants(id),
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('group','country','entity')),
  country_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  slug TEXT UNIQUE NOT NULL,
  legal_name TEXT NOT NULL,
  common_name TEXT,
  jurisdiction TEXT,
  legal_form TEXT,
  registration_number TEXT,
  parent_entity_id UUID REFERENCES entities(id),
  ownership_percentage NUMERIC,
  entity_status TEXT DEFAULT 'Active' CHECK (entity_status IN ('Active','Inactive','Liquidated')),
  materiality TEXT CHECK (materiality IN ('Low','Medium','High','Critical')),
  secretary_owner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE governing_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_id UUID REFERENCES entities(id),
  name TEXT NOT NULL,
  body_type TEXT CHECK (body_type IN ('CDA','COMISION','COMITE','JUNTA')),
  quorum_rule JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  full_name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  person_type TEXT DEFAULT 'PF' CHECK (person_type IN ('PF','PJ')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  person_id UUID NOT NULL REFERENCES persons(id),
  body_id UUID NOT NULL REFERENCES governing_bodies(id),
  role TEXT NOT NULL,
  director_type TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo','Caducado','Revocado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  body_id UUID NOT NULL REFERENCES governing_bodies(id),
  meeting_type TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONVOCADA','CELEBRADA','CANCELADA')),
  president_id UUID REFERENCES persons(id),
  secretary_id UUID REFERENCES persons(id),
  quorum_data JSONB,
  location TEXT,
  confidentiality_level TEXT DEFAULT 'Confidencial',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  order_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id),
  agenda_item_id UUID REFERENCES agenda_items(id),
  title TEXT NOT NULL,
  decision_type TEXT,
  approved BOOLEAN,
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  abstentions INTEGER DEFAULT 0,
  effective_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  policy_code TEXT NOT NULL,
  title TEXT NOT NULL,
  policy_type TEXT,
  scope_level TEXT CHECK (scope_level IN ('Corporate','Country','Entity')),
  owner_function TEXT,
  approval_body_id UUID REFERENCES governing_bodies(id),
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft','In Review','Legal Review','Approval Pending','Approved','Published','Superseded','Archived')),
  effective_date DATE,
  next_review_date DATE,
  mandatory BOOLEAN DEFAULT true,
  classification TEXT DEFAULT 'Confidencial',
  current_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  criticality TEXT CHECK (criticality IN ('Crítico','Alto','Medio','Bajo')),
  policy_id UUID REFERENCES policies(id),
  country_scope TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Parcial' CHECK (status IN ('Efectivo','Parcial','Inefectivo')),
  owner_id UUID REFERENCES persons(id),
  obligation_id UUID REFERENCES obligations(id),
  last_test_date DATE,
  next_test_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID NOT NULL REFERENCES controls(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  ev_type TEXT,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Aprobada','Rechazada','Pendiente')),
  owner_id UUID REFERENCES persons(id),
  rejection_reason TEXT,
  file_url TEXT,
  legal_hold BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('Crítico','Alto','Medio','Bajo')),
  status TEXT DEFAULT 'Abierto' CHECK (status IN ('Abierto','En remediación','Cerrado')),
  origin TEXT,
  entity_id UUID REFERENCES entities(id),
  obligation_id UUID REFERENCES obligations(id),
  owner_id UUID REFERENCES persons(id),
  due_date DATE,
  opened_at DATE DEFAULT CURRENT_DATE,
  closed_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES findings(id),
  title TEXT NOT NULL,
  responsible_id UUID REFERENCES persons(id),
  due_date DATE,
  status TEXT DEFAULT 'Pendiente',
  progress_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE,
  delegation_type TEXT,
  entity_id UUID REFERENCES entities(id),
  grantor_id UUID REFERENCES persons(id),
  delegate_id UUID REFERENCES persons(id),
  scope TEXT,
  limits TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'Vigente' CHECK (status IN ('Vigente','Caducada','Revocada')),
  alert_t90 BOOLEAN DEFAULT false,
  alert_t60 BOOLEAN DEFAULT false,
  alert_t30 BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conflicts_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT,
  person_id UUID REFERENCES persons(id),
  conflict_type TEXT CHECK (conflict_type IN ('Permanente','Situacional')),
  description TEXT,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Declarado','Pendiente','Resuelto')),
  related_meeting_id UUID REFERENCES meetings(id),
  related_agenda_item_id UUID REFERENCES agenda_items(id),
  related_finding_id UUID REFERENCES findings(id),
  declared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  person_id UUID REFERENCES persons(id),
  campaign TEXT,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Completada','Pendiente')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  body TEXT,
  route TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','warning','error','success')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role TEXT NOT NULL,
  scope_entity_id UUID REFERENCES entities(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id UUID,
  previous_hash TEXT,
  current_hash TEXT,
  legal_hold BOOLEAN DEFAULT false,
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE RULE no_update_audit_log AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_log AS ON DELETE TO audit_log DO INSTEAD NOTHING;

CREATE SCHEMA IF NOT EXISTS sii;

CREATE TABLE sii.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  case_ref TEXT NOT NULL UNIQUE,
  channel TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  country TEXT,
  classification TEXT,
  status TEXT DEFAULT 'Abierto',
  investigator_id UUID,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  resolution TEXT
);

CREATE TABLE sii.evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES sii.cases(id),
  title TEXT,
  file_url TEXT,
  is_encrypted BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sii.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES sii.cases(id),
  actor_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  previous_hash TEXT,
  current_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE RULE no_update_sii_audit AS ON UPDATE TO sii.audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_sii_audit AS ON DELETE TO sii.audit_log DO INSTEAD NOTHING;

-- Disable RLS for demo
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE governing_bodies DISABLE ROW LEVEL SECURITY;
ALTER TABLE persons DISABLE ROW LEVEL SECURITY;
ALTER TABLE mandates DISABLE ROW LEVEL SECURITY;
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE policies DISABLE ROW LEVEL SECURITY;
ALTER TABLE obligations DISABLE ROW LEVEL SECURITY;
ALTER TABLE controls DISABLE ROW LEVEL SECURITY;
ALTER TABLE evidences DISABLE ROW LEVEL SECURITY;
ALTER TABLE findings DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE delegations DISABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts_of_interest DISABLE ROW LEVEL SECURITY;
ALTER TABLE attestations DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
