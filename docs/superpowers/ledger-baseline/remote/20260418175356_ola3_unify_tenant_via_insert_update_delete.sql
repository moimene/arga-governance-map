-- Ola 3 F0: Unifica tenant_id bajo el cero-UUID documentado en CLAUDE.md
-- Estrategia: insertar tenant zero, redirigir FKs, borrar legacy
DO $$
DECLARE
  src uuid := 'eed5e854-0759-4112-985c-585c1715c063'::uuid;
  dst uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  t text;
  tables text[] := ARRAY[
    'agreements','ai_incidents','ai_systems','attachments','attestations','audit_log',
    'bcm_bia','bcm_plans','certifications','conflicts_of_interest','controls','convocatorias',
    'country_packs','deeds','delegations','document_templates','entities','evidences',
    'exceptions','findings','governing_bodies','grc_module_nav','incidents','mandates',
    'mandatory_books','meeting_resolutions','meetings','minutes','no_session_resolutions',
    'notifications','obligations','persons','policies','registry_filings','regulatory_notifications',
    'risks','secretaria_audit_log','unipersonal_decisions','user_roles','vulnerabilities'
  ];
BEGIN
  -- 1) Crear tenant destino si no existe
  INSERT INTO tenants (id, name, tenant_type, country_code, is_active)
  VALUES (dst, 'Grupo ARGA Seguros', 'group', NULL, true)
  ON CONFLICT (id) DO NOTHING;

  -- 2) Redirigir todas las filas
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE %I SET tenant_id = $1 WHERE tenant_id = $2', t) USING dst, src;
  END LOOP;

  -- 3) Redirigir parent_tenant_id dentro de tenants
  UPDATE tenants SET parent_tenant_id = dst WHERE parent_tenant_id = src;

  -- 4) Eliminar tenant legacy (si ya no lo referencia nadie)
  DELETE FROM tenants WHERE id = src;
END $$;
