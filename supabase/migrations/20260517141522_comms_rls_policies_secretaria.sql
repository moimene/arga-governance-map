ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY communications_staff_select ON communications
  FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND tenant_id = fn_current_tenant_id()
    AND auth.uid() IN (
      SELECT rur.user_id FROM rbac_user_roles rur
      JOIN rbac_roles r ON r.id = rur.role_id
      WHERE r.role_code IN ('SECRETARIO','COMPLIANCE','ADMIN_TENANT','AUDITOR')
        AND COALESCE(rur.is_active, true) = true
    )
  );

CREATE POLICY communications_staff_insert ON communications
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND tenant_id = fn_current_tenant_id()
    AND auth.uid() IN (
      SELECT rur.user_id FROM rbac_user_roles rur
      JOIN rbac_roles r ON r.id = rur.role_id
      WHERE r.role_code IN ('SECRETARIO','ADMIN_TENANT')
        AND COALESCE(rur.is_active, true) = true
    )
  );

CREATE POLICY communications_staff_update ON communications
  FOR UPDATE TO authenticated
  USING (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND tenant_id = fn_current_tenant_id()
    AND auth.uid() IN (
      SELECT rur.user_id FROM rbac_user_roles rur
      JOIN rbac_roles r ON r.id = rur.role_id
      WHERE r.role_code IN ('SECRETARIO','ADMIN_TENANT')
        AND COALESCE(rur.is_active, true) = true
    )
  );

CREATE POLICY communications_service_all ON communications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY recipients_staff_select ON communication_recipients
  FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND EXISTS (
      SELECT 1 FROM communications c
      WHERE c.id = communication_recipients.communication_id
        AND c.tenant_id = fn_current_tenant_id()
    )
  );

CREATE POLICY recipients_staff_insert ON communication_recipients
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND EXISTS (
      SELECT 1 FROM communications c
      WHERE c.id = communication_id AND c.tenant_id = fn_current_tenant_id()
    )
  );

CREATE POLICY recipients_staff_update ON communication_recipients
  FOR UPDATE TO authenticated
  USING (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND EXISTS (
      SELECT 1 FROM communications c
      WHERE c.id = communication_recipients.communication_id
        AND c.tenant_id = fn_current_tenant_id()
    )
  );

CREATE POLICY recipients_service_all ON communication_recipients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY attachments_staff_select ON communication_attachments
  FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND EXISTS (
      SELECT 1 FROM communications c
      WHERE c.id = communication_attachments.communication_id
        AND c.tenant_id = fn_current_tenant_id()
    )
  );

CREATE POLICY attachments_staff_insert ON communication_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND EXISTS (
      SELECT 1 FROM communications c
      WHERE c.id = communication_id AND c.tenant_id = fn_current_tenant_id()
    )
  );

CREATE POLICY attachments_service_all ON communication_attachments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY delivery_events_staff_select ON communication_delivery_events
  FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt()->'app_metadata'->>'scope','staff') IN ('staff','both')
    AND EXISTS (
      SELECT 1 FROM communication_recipients cr
      JOIN communications c ON c.id = cr.communication_id
      WHERE cr.id = communication_delivery_events.recipient_id
        AND c.tenant_id = fn_current_tenant_id()
    )
  );

CREATE POLICY delivery_events_service_all ON communication_delivery_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY portal_memberships_self_select ON portal_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY portal_memberships_admin_all ON portal_memberships
  FOR ALL TO authenticated
  USING (
    tenant_id = fn_current_tenant_id()
    AND auth.uid() IN (
      SELECT rur.user_id FROM rbac_user_roles rur
      JOIN rbac_roles r ON r.id = rur.role_id
      WHERE r.role_code = 'ADMIN_TENANT'
        AND COALESCE(rur.is_active, true) = true
    )
  );

CREATE POLICY portal_memberships_service_all ON portal_memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);
