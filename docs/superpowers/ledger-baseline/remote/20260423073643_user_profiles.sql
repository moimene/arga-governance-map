CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID UNIQUE NOT NULL,
  tenant_id    UUID NOT NULL,
  entity_id    UUID REFERENCES entities(id),
  person_id    UUID REFERENCES persons(id),
  role_code    TEXT NOT NULL DEFAULT 'SECRETARIO',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'Contexto de aplicación por usuario: tenant, entidad por defecto, persona. Leído una vez al autenticar y cacheado en TenantContext.';

CREATE INDEX IF NOT EXISTS ix_user_profiles_user_id ON user_profiles(user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_self_read"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_self_update"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_service_insert"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

INSERT INTO user_profiles (user_id, tenant_id, entity_id, person_id, role_code)
SELECT
  au.id                                          AS user_id,
  '00000000-0000-0000-0000-000000000001'::UUID   AS tenant_id,
  e.id                                           AS entity_id,
  p.id                                           AS person_id,
  'SECRETARIO'                                   AS role_code
FROM auth.users au
CROSS JOIN LATERAL (
  SELECT id FROM entities
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY created_at ASC
  LIMIT 1
) e
CROSS JOIN LATERAL (
  SELECT id FROM persons
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY created_at ASC
  LIMIT 1
) p
WHERE au.email = 'demo@arga-seguros.com'
ON CONFLICT (user_id) DO NOTHING;
