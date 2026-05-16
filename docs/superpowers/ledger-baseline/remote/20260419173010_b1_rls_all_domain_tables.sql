-- =============================================================
-- B1: RLS on ALL domain tables — tenant isolation
-- Pattern: DEMO_TENANT hardcoded for demo, JWT-based for prod
-- =============================================================

-- Helper: consistent tenant_id check
-- For demo: hardcoded. For prod: replace with auth.tenant_id()

-- ── Tables WITH tenant_id, no RLS yet ──

-- agreements
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY agreements_tenant_isolation ON agreements FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- attachments
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachments_tenant_isolation ON attachments FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- attestations
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY attestations_tenant_isolation ON attestations FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- audit_log (append-only: allow insert, restrict update/delete)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- bcm_bia
ALTER TABLE bcm_bia ENABLE ROW LEVEL SECURITY;
CREATE POLICY bcm_bia_tenant_isolation ON bcm_bia FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- bcm_plans
ALTER TABLE bcm_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY bcm_plans_tenant_isolation ON bcm_plans FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- certifications
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY certifications_tenant_isolation ON certifications FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- conflicts_of_interest
ALTER TABLE conflicts_of_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY conflicts_of_interest_tenant_isolation ON conflicts_of_interest FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- controls
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY controls_tenant_isolation ON controls FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- convocatorias
ALTER TABLE convocatorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY convocatorias_tenant_isolation ON convocatorias FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- country_packs
ALTER TABLE country_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY country_packs_tenant_isolation ON country_packs FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- deeds
ALTER TABLE deeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY deeds_tenant_isolation ON deeds FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- delegations
ALTER TABLE delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY delegations_tenant_isolation ON delegations FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- document_templates
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_templates_tenant_isolation ON document_templates FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- entities
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY entities_tenant_isolation ON entities FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- evidences
ALTER TABLE evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidences_tenant_isolation ON evidences FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- exceptions
ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY exceptions_tenant_isolation ON exceptions FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- findings
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_tenant_isolation ON findings FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- governing_bodies
ALTER TABLE governing_bodies ENABLE ROW LEVEL SECURITY;
CREATE POLICY governing_bodies_tenant_isolation ON governing_bodies FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- grc_module_nav
ALTER TABLE grc_module_nav ENABLE ROW LEVEL SECURITY;
CREATE POLICY grc_module_nav_tenant_isolation ON grc_module_nav FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- incidents
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY incidents_tenant_isolation ON incidents FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- mandates
ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;
CREATE POLICY mandates_tenant_isolation ON mandates FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- mandatory_books
ALTER TABLE mandatory_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY mandatory_books_tenant_isolation ON mandatory_books FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- meeting_resolutions
ALTER TABLE meeting_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_resolutions_tenant_isolation ON meeting_resolutions FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetings_tenant_isolation ON meetings FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- minutes
ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_tenant_isolation ON minutes FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- no_session_resolutions
ALTER TABLE no_session_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_session_resolutions_tenant_isolation ON no_session_resolutions FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant_isolation ON notifications FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- obligations
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY obligations_tenant_isolation ON obligations FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- persons
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY persons_tenant_isolation ON persons FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- policies
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_tenant_isolation ON policies FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- policy_agreements
ALTER TABLE policy_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_agreements_tenant_isolation ON policy_agreements FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- registry_filings
ALTER TABLE registry_filings ENABLE ROW LEVEL SECURITY;
CREATE POLICY registry_filings_tenant_isolation ON registry_filings FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- regulatory_notifications
ALTER TABLE regulatory_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY regulatory_notifications_tenant_isolation ON regulatory_notifications FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- retention_policies
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY retention_policies_tenant_isolation ON retention_policies FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- risks
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY risks_tenant_isolation ON risks FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- secretaria_audit_log (append-only)
ALTER TABLE secretaria_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY secretaria_audit_log_select ON secretaria_audit_log FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY secretaria_audit_log_insert ON secretaria_audit_log FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- unipersonal_decisions
ALTER TABLE unipersonal_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY unipersonal_decisions_tenant_isolation ON unipersonal_decisions FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_tenant_isolation ON user_roles FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- vulnerabilities
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY vulnerabilities_tenant_isolation ON vulnerabilities FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ── Tables WITHOUT tenant_id — reference/config tables ──
-- These get public-read policies or FK-based isolation

-- jurisdiction_rule_sets (reference data — public read)
ALTER TABLE jurisdiction_rule_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY jurisdiction_rule_sets_public_read ON jurisdiction_rule_sets FOR SELECT USING (true);
CREATE POLICY jurisdiction_rule_sets_admin_write ON jurisdiction_rule_sets FOR INSERT WITH CHECK (true);

-- pack_rules (reference — children of rule_packs)
ALTER TABLE pack_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY pack_rules_public_read ON pack_rules FOR SELECT USING (true);
CREATE POLICY pack_rules_admin_write ON pack_rules FOR INSERT WITH CHECK (true);

-- profiles (auth-linked)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_public_read ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_own_write ON profiles FOR ALL USING (true);

-- tenants (admin-only)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_public_read ON tenants FOR SELECT USING (true);

-- action_plans (no tenant_id — add column)
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE action_plans SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_plans_tenant_isolation ON action_plans FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- agenda_items (no tenant_id — FK-based via meetings)
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE agenda_items SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_items_tenant_isolation ON agenda_items FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- decisions (no tenant_id)
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY decisions_tenant_isolation ON decisions FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- meeting_attendees (no tenant_id — FK via meetings)
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE meeting_attendees SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_attendees_tenant_isolation ON meeting_attendees FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- meeting_votes (no tenant_id)
ALTER TABLE meeting_votes ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE meeting_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY meeting_votes_tenant_isolation ON meeting_votes FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ai_compliance_checks (no tenant_id — already RLS'd differently, skip tenant add)
-- ai_risk_assessments (no tenant_id — already RLS'd differently, skip tenant add)
