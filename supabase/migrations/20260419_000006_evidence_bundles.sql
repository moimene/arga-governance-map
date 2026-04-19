-- Migration: Evidence Bundles ASiC-E (Evidence Bundle System)
-- Created: 2026-04-19
-- Purpose: WORM evidence bundles for Motor de Reglas LSC with cryptographic integrity
-- Tenant: TGMS (arga-governance-map)

-- ============================================================================
-- 1. EVIDENCE_BUNDLES TABLE — Immutable, append-only bundles per agreement
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

  -- Manifest: canonical JSON (artifacts sorted by timestamp)
  manifest JSONB NOT NULL,

  -- SHA-256 hash of canonical manifest JSON (immutable after creation)
  manifest_hash TEXT NOT NULL,

  -- QTSP sealing artifacts (applied later, optional)
  qseal_token TEXT,
  tsq_token TEXT,

  -- Status: OPEN (collecting artifacts) → SEALED (manifest finalized) → VERIFIED (checksums validated)
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'SEALED', 'VERIFIED')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WORM protection: prevent UPDATE/DELETE on evidence_bundles
CREATE TRIGGER evidence_bundles_worm_guard
  BEFORE UPDATE OR DELETE ON evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

-- RLS policies
ALTER TABLE evidence_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_bundles_select_tenant" ON evidence_bundles
  FOR SELECT USING (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "evidence_bundles_insert_tenant" ON evidence_bundles
  FOR INSERT WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Indexes
CREATE INDEX idx_evidence_bundles_agreement ON evidence_bundles(agreement_id);
CREATE INDEX idx_evidence_bundles_tenant_status ON evidence_bundles(tenant_id, status);
CREATE INDEX idx_evidence_bundles_created ON evidence_bundles(created_at DESC);

-- ============================================================================
-- 2. EVIDENCE_BUNDLE_ARTIFACTS TABLE — Immutable artifact catalog per bundle
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_bundle_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES evidence_bundles(id) ON DELETE CASCADE,

  -- Artifact type: classification for retrieval
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN (
      'RULE_EVALUATION',
      'GATE_HASH',
      'ACTA',
      'CERTIFICACION',
      'NOTIFICACION',
      'PLANTILLA_SNAPSHOT',
      'RESPUESTA_WORM',
      'COMPLIANCE_SNAPSHOT'
    )),

  -- Reference: artifact identifier or path
  artifact_ref TEXT NOT NULL,

  -- SHA-256 hash of artifact content
  artifact_hash TEXT NOT NULL,

  -- ISO 8601 timestamp (frozen at artifact creation)
  timestamp_iso TEXT NOT NULL,

  -- Metadata: optional JSON blob for artifact-specific fields
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WORM protection
CREATE TRIGGER evidence_bundle_artifacts_worm_guard
  BEFORE UPDATE OR DELETE ON evidence_bundle_artifacts
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

-- RLS
ALTER TABLE evidence_bundle_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_bundle_artifacts_select" ON evidence_bundle_artifacts
  FOR SELECT USING (
    bundle_id IN (
      SELECT id FROM evidence_bundles
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "evidence_bundle_artifacts_insert" ON evidence_bundle_artifacts
  FOR INSERT WITH CHECK (
    bundle_id IN (
      SELECT id FROM evidence_bundles
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Indexes
CREATE INDEX idx_evidence_bundle_artifacts_bundle ON evidence_bundle_artifacts(bundle_id);
CREATE INDEX idx_evidence_bundle_artifacts_type ON evidence_bundle_artifacts(artifact_type);
CREATE INDEX idx_evidence_bundle_artifacts_ref ON evidence_bundle_artifacts(artifact_ref);

-- ============================================================================
-- 3. EVIDENCE_VERIFICATION_LOG TABLE — Audit trail for verification operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS evidence_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES evidence_bundles(id) ON DELETE CASCADE,

  -- Operation type: SEAL, VERIFY, EXPORT
  operation TEXT NOT NULL CHECK (operation IN ('SEAL', 'VERIFY', 'EXPORT')),

  -- Verification result: OK or error message
  result TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),

  -- QTSP response data (if applicable)
  qtsp_response JSONB,

  -- User who initiated the operation
  performed_by UUID REFERENCES public.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE evidence_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_verification_log_select" ON evidence_verification_log
  FOR SELECT USING (
    bundle_id IN (
      SELECT id FROM evidence_bundles
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    )
  );

CREATE POLICY "evidence_verification_log_insert" ON evidence_verification_log
  FOR INSERT WITH CHECK (
    bundle_id IN (
      SELECT id FROM evidence_bundles
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    )
  );

-- Indexes
CREATE INDEX idx_evidence_verification_log_bundle ON evidence_verification_log(bundle_id);
CREATE INDEX idx_evidence_verification_log_operation ON evidence_verification_log(operation);
CREATE INDEX idx_evidence_verification_log_created ON evidence_verification_log(created_at DESC);

-- ============================================================================
-- 4. GRANT PERMISSIONS — PostgreSQL object-level grants
-- ============================================================================

-- Allow service role (and future app role) to read/insert/delete
GRANT SELECT, INSERT, DELETE ON evidence_bundles TO authenticated;
GRANT SELECT, INSERT, DELETE ON evidence_bundle_artifacts TO authenticated;
GRANT SELECT, INSERT ON evidence_verification_log TO authenticated;

-- Allow anon to read (for public verification links, future feature)
GRANT SELECT ON evidence_bundles TO anon;
GRANT SELECT ON evidence_bundle_artifacts TO anon;
