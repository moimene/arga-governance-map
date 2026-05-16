-- Secretaría 360 v3.1 — agenda_item_constancias multi-tenant RLS.
--
-- Cloud already contains the agenda_item_constancias table from the agenda
-- item v3.1 cut, but the first deployed policy kept the demo tenant literal.
-- This follow-up keeps the table/API grants intact and replaces only the RLS
-- predicates with the tenant helper used by the rest of Secretaría.

BEGIN;

ALTER TABLE agenda_item_constancias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_item_constancias_tenant_read ON agenda_item_constancias;
CREATE POLICY agenda_item_constancias_tenant_read ON agenda_item_constancias FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS agenda_item_constancias_tenant_write ON agenda_item_constancias;
CREATE POLICY agenda_item_constancias_tenant_write ON agenda_item_constancias FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON agenda_item_constancias TO authenticated, service_role;

COMMIT;
