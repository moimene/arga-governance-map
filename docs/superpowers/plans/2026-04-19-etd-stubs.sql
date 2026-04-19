-- =============================================================
-- TGMS Platform — ETD Enterprise Stubs Migration
-- 2026-04-19
-- =============================================================
-- Propósito: Añadir campos nullable obligatorios según ETD a
-- las tablas de dominio existentes. Sin lógica activa, sin
-- rotura de código demo. Contrato del modelo de datos para
-- el desarrollo enterprise real (Task 0).
--
-- SAFE TO RUN: todos los campos son nullable o tienen DEFAULT.
-- No rompe ninguna query existente.
-- =============================================================

-- -------------------------------------------------------------
-- 1. TABLA DE RETENCIÓN (stub)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_policies (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  name            text NOT NULL,
  retention_days  integer NOT NULL DEFAULT 2555, -- 7 años por defecto
  legal_basis     text,  -- 'GDPR Art 17', 'LOPD', 'LSC', etc.
  applies_to      text,  -- tabla o categoría de datos
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant
  ON retention_policies (tenant_id);

-- -------------------------------------------------------------
-- 2. TABLA AUDIT LOG (stub — sin triggers WORM activos)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid NOT NULL,
  table_name   text NOT NULL,
  record_id    uuid NOT NULL,
  action       text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','VIEW')),
  actor_id     uuid,            -- FK a auth.users cuando RLS esté activo
  actor_email  text,
  delta        jsonb,           -- {old: {...}, new: {...}}
  ip_address   inet,
  hash_sha512  text,            -- hash encadenado (WORM — activo en Task 0)
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_table
  ON audit_log (tenant_id, table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record
  ON audit_log (record_id);

-- NOTA Task 0: añadir trigger en cada tabla de hechos que
-- inserte en audit_log con hash_sha512 encadenado al registro
-- previo (Merkle-style). Activar WORM con Supabase Vault o
-- extensión pg_audit.

-- -------------------------------------------------------------
-- 3. TABLA EVIDENCE BUNDLES (stub)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_bundles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  reference_code  text UNIQUE,          -- EVI-2026-001
  document_url    text,
  hash_sha512     text,                 -- hash del documento
  signed_by       text,                 -- QTSP / QES provider
  signature_date  timestamptz,
  chain_of_custody jsonb,               -- array de custodians con timestamps
  legal_hold      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_tenant
  ON evidence_bundles (tenant_id);

-- -------------------------------------------------------------
-- 4. CAMPOS ETD EN TABLAS DE DOMINIO EXISTENTES
-- Todos los campos son nullable. No rompe queries actuales.
-- -------------------------------------------------------------

-- entities
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id);

-- policies
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id),
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid;

-- obligations
ALTER TABLE obligations
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id);

-- incidents (GRC)
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id),
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id);

-- agreements (Secretaría)
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retention_policy_id  uuid REFERENCES retention_policies(id),
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid,
  ADD COLUMN IF NOT EXISTS verified_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id);

-- meetings (Secretaría)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS approved_by          uuid;

-- certifications (Secretaría)
ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS verified_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id),
  ADD COLUMN IF NOT EXISTS hash_sha512          text;

-- hallazgos / findings
ALTER TABLE hallazgos
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS verified_by          uuid,
  ADD COLUMN IF NOT EXISTS evidence_id          uuid REFERENCES evidence_bundles(id);

-- regulatory_notifications (GRC)
ALTER TABLE regulatory_notifications
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by           uuid,
  ADD COLUMN IF NOT EXISTS ack_evidence_id      uuid REFERENCES evidence_bundles(id),
  ADD COLUMN IF NOT EXISTS hash_sha512          text;

-- governing_bodies
ALTER TABLE governing_bodies
  ADD COLUMN IF NOT EXISTS legal_hold           boolean DEFAULT false;

-- -------------------------------------------------------------
-- 5. ÍNDICES COMPUESTOS CON tenant_id LEADING (ETD NFR)
-- -------------------------------------------------------------
-- audit_log ya tiene idx_audit_log_tenant_table

-- Índices compuestos adicionales en tablas frecuentes
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status
  ON incidents (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_agreements_tenant_status
  ON agreements (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_meetings_tenant_entity
  ON meetings (tenant_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_certifications_tenant_agreement
  ON certifications (tenant_id, agreement_id);

-- -------------------------------------------------------------
-- 6. COMENTARIOS DE DOCUMENTACIÓN (pg_description)
-- -------------------------------------------------------------
COMMENT ON TABLE retention_policies IS
  'ETD stub: catálogo de políticas de retención por tenant. Activar purge job en Task 0.';

COMMENT ON TABLE audit_log IS
  'ETD stub: log inmutable de cambios. Activar triggers WORM + hash encadenado en Task 0.';

COMMENT ON TABLE evidence_bundles IS
  'ETD stub: evidencias con hash SHA-512 y cadena de custodia. Integrar QTSP/QES en Task 0.';

COMMENT ON COLUMN incidents.legal_hold IS
  'ETD: cuando true, el registro no puede ser purgado por el job de retención.';

COMMENT ON COLUMN agreements.legal_hold IS
  'ETD: cuando true, el registro no puede ser purgado por el job de retención.';

-- =============================================================
-- FIN DE MIGRACIÓN
-- Siguiente paso: ejecutar en Supabase SQL Editor del proyecto
-- hzqwefkwsxopwrmtksbg (governance_OS, eu-central-1)
-- =============================================================
