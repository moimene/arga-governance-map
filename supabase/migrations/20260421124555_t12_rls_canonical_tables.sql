-- T12: RLS + tenant_isolation policies for the 7 new canonical tables.
-- Matches the app-wide pattern (hardcoded DEMO_TENANT UUID, single FOR ALL
-- policy, no WITH CHECK, no RBAC-role differentiation).

ALTER TABLE entity_capital_profile  ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_classes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE condiciones_persona     ENABLE ROW LEVEL SECURITY;
ALTER TABLE capital_holdings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE representaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE parte_votante_current   ENABLE ROW LEVEL SECURITY;
ALTER TABLE censo_snapshot          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_capital_profile_tenant_isolation ON entity_capital_profile;
CREATE POLICY entity_capital_profile_tenant_isolation ON entity_capital_profile
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS share_classes_tenant_isolation ON share_classes;
CREATE POLICY share_classes_tenant_isolation ON share_classes
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS condiciones_persona_tenant_isolation ON condiciones_persona;
CREATE POLICY condiciones_persona_tenant_isolation ON condiciones_persona
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS capital_holdings_tenant_isolation ON capital_holdings;
CREATE POLICY capital_holdings_tenant_isolation ON capital_holdings
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS representaciones_tenant_isolation ON representaciones;
CREATE POLICY representaciones_tenant_isolation ON representaciones
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS parte_votante_current_tenant_isolation ON parte_votante_current;
CREATE POLICY parte_votante_current_tenant_isolation ON parte_votante_current
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS censo_snapshot_tenant_isolation ON censo_snapshot;
CREATE POLICY censo_snapshot_tenant_isolation ON censo_snapshot
  FOR ALL USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
