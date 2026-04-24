-- supabase/migrations/20260423_000030_user_profiles.sql
-- Sprint G1: tabla user_profiles — mapeo 1:1 auth.users → contexto de aplicación
-- tenant_id, entity_id, person_id resueltos una sola vez al autenticar.

-- ============================================================================
-- 1. Tabla user_profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID UNIQUE NOT NULL,            -- auth.users.id
  tenant_id    UUID NOT NULL,                   -- tenant al que pertenece el usuario
  entity_id    UUID REFERENCES entities(id),    -- entidad por defecto del usuario
  person_id    UUID REFERENCES persons(id),     -- registro persons asociado
  role_code    TEXT NOT NULL DEFAULT 'SECRETARIO',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'Contexto de aplicación por usuario: tenant, entidad por defecto, persona. Leído una vez al autenticar y cacheado en TenantContext.';

-- Índice para lookup por user_id (el más frecuente)
CREATE INDEX IF NOT EXISTS ix_user_profiles_user_id ON user_profiles(user_id);

-- RLS: cada usuario solo puede leer su propio perfil
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_self_read"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_self_update"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role puede insertar (usado en signup Edge Function y seeds)
CREATE POLICY "user_profiles_service_insert"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 2. Seed: demo user demo@arga-seguros.com
-- Tenant: 00000000-0000-0000-0000-000000000001
-- Entidad: ARGA Seguros S.A. (la principal del demo)
-- ============================================================================

INSERT INTO user_profiles (user_id, tenant_id, entity_id, person_id, role_code)
SELECT
  au.id                                          AS user_id,
  '00000000-0000-0000-0000-000000000001'::UUID   AS tenant_id,
  e.id                                           AS entity_id,
  p.id                                           AS person_id,
  'SECRETARIO'                                   AS role_code
FROM auth.users au
-- Entidad principal: ARGA Seguros S.A. (tax_id A-99999903 o el primer entity del tenant)
CROSS JOIN LATERAL (
  SELECT id FROM entities
  WHERE id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'  -- ARGA Seguros S.A.
  LIMIT 1
) e
-- Persona: Lucía Martín (secretaria del CdA, si existe) o primera persona del tenant
CROSS JOIN LATERAL (
  SELECT id FROM persons
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY created_at ASC
  LIMIT 1
) p
WHERE au.email = 'demo@arga-seguros.com'
ON CONFLICT (user_id) DO NOTHING;
