-- =============================================================
-- B3: Audit Trail WORM — hash-chained SHA-512 triggers
-- Append-only audit_log with Merkle-style chain
-- =============================================================

-- Enable pgcrypto for SHA-512
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function: compute chained hash and insert into audit_log
CREATE OR REPLACE FUNCTION fn_audit_worm()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash text;
  v_payload   jsonb;
  v_new_hash  text;
  v_action    text;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  -- Get previous hash for chain
  SELECT hash_sha512 INTO v_prev_hash
  FROM audit_log
  WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
  ORDER BY created_at DESC
  LIMIT 1;

  -- Compute chained hash: SHA-512(prev_hash || action || table || record_id || delta)
  v_new_hash := encode(
    digest(
      COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_action || '|' ||
      TG_TABLE_NAME || '|' ||
      COALESCE(NEW.id, OLD.id)::text || '|' ||
      v_payload::text,
      'sha512'
    ),
    'hex'
  );

  -- Insert into audit_log (append-only, WORM)
  INSERT INTO audit_log (
    tenant_id, table_name, record_id, action,
    actor_email, delta, hash_sha512, created_at
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    v_payload,
    v_new_hash,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add table_name column if missing (ETD stubs may have used different name)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS table_name text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS record_id uuid;

-- Deny UPDATE and DELETE on audit_log (WORM)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='audit_log_deny_update') THEN
    CREATE POLICY audit_log_deny_update ON audit_log FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_log' AND policyname='audit_log_deny_delete') THEN
    CREATE POLICY audit_log_deny_delete ON audit_log FOR DELETE USING (false);
  END IF;
END $$;

-- Create triggers on critical domain tables
-- agreements
CREATE OR REPLACE TRIGGER trg_audit_worm_agreements
  AFTER INSERT OR UPDATE OR DELETE ON agreements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- certifications
CREATE OR REPLACE TRIGGER trg_audit_worm_certifications
  AFTER INSERT OR UPDATE OR DELETE ON certifications
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- meetings
CREATE OR REPLACE TRIGGER trg_audit_worm_meetings
  AFTER INSERT OR UPDATE OR DELETE ON meetings
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- incidents
CREATE OR REPLACE TRIGGER trg_audit_worm_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- findings
CREATE OR REPLACE TRIGGER trg_audit_worm_findings
  AFTER INSERT OR UPDATE OR DELETE ON findings
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- policies
CREATE OR REPLACE TRIGGER trg_audit_worm_policies
  AFTER INSERT OR UPDATE OR DELETE ON policies
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- entities
CREATE OR REPLACE TRIGGER trg_audit_worm_entities
  AFTER INSERT OR UPDATE OR DELETE ON entities
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- governing_bodies
CREATE OR REPLACE TRIGGER trg_audit_worm_governing_bodies
  AFTER INSERT OR UPDATE OR DELETE ON governing_bodies
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- delegations
CREATE OR REPLACE TRIGGER trg_audit_worm_delegations
  AFTER INSERT OR UPDATE OR DELETE ON delegations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- evidence_bundles
CREATE OR REPLACE TRIGGER trg_audit_worm_evidence_bundles
  AFTER INSERT OR UPDATE OR DELETE ON evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_worm();

-- Verification function: check audit chain integrity
CREATE OR REPLACE FUNCTION fn_verify_audit_chain(p_tenant_id uuid)
RETURNS TABLE(
  total_entries bigint,
  chain_valid boolean,
  first_entry_at timestamptz,
  last_entry_at timestamptz
) AS $$
DECLARE
  v_prev_hash text := 'GENESIS';
  v_computed  text;
  v_row       record;
  v_valid     boolean := true;
BEGIN
  FOR v_row IN
    SELECT * FROM audit_log
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at ASC
  LOOP
    v_computed := encode(
      digest(
        v_prev_hash || '|' ||
        v_row.action || '|' ||
        v_row.table_name || '|' ||
        v_row.record_id::text || '|' ||
        v_row.delta::text,
        'sha512'
      ),
      'hex'
    );
    IF v_computed != v_row.hash_sha512 THEN
      v_valid := false;
      EXIT;
    END IF;
    v_prev_hash := v_row.hash_sha512;
  END LOOP;

  RETURN QUERY
  SELECT
    count(*)::bigint,
    v_valid,
    min(audit_log.created_at),
    max(audit_log.created_at)
  FROM audit_log
  WHERE audit_log.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON FUNCTION fn_audit_worm() IS 'WORM audit trigger: hash-chained SHA-512 append-only log. Covers agreements, certifications, meetings, incidents, findings, policies, entities, governing_bodies, delegations, evidence_bundles.';
COMMENT ON FUNCTION fn_verify_audit_chain(uuid) IS 'Verifies integrity of the hash-chained audit trail for a given tenant. Returns chain_valid=true if no tampering detected.';
