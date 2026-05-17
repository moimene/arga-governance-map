CREATE TABLE portal_memberships (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id                uuid NOT NULL REFERENCES persons(id),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  entity_id                uuid REFERENCES entities(id),
  rol_portal               text NOT NULL CHECK (rol_portal IN (
                             'MIEMBRO_ORGANO','ASESOR_EXTERNO','OBSERVADOR_AUDITOR')),
  estado                   text NOT NULL DEFAULT 'INVITADO' CHECK (estado IN (
                             'INVITADO','ACTIVO','SUSPENDIDO','BAJA')),
  invited_at               timestamptz NOT NULL DEFAULT now(),
  activated_at             timestamptz,
  last_access_at           timestamptz,
  mfa_enrolled             boolean NOT NULL DEFAULT false,
  mfa_enrolled_at          timestamptz,
  preferences              jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, person_id, tenant_id)
);

CREATE INDEX ix_portal_memberships_user   ON portal_memberships(user_id);
CREATE INDEX ix_portal_memberships_person ON portal_memberships(person_id);

COMMENT ON COLUMN portal_memberships.entity_id IS
  'NULL = acceso a todas las entidades del tenant donde la persona figure en condiciones_persona vigente. NOT NULL = acceso restringido a esa entidad.';

CREATE SCHEMA IF NOT EXISTS portal;
GRANT USAGE ON SCHEMA portal TO authenticated;
GRANT USAGE ON SCHEMA portal TO service_role;

CREATE TABLE portal.access_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id),
  person_id                uuid NOT NULL REFERENCES persons(id),
  rpc_name                 text NOT NULL,
  params_hash              text,
  result_rows              integer,
  ip_hash                  text,
  user_agent_class         text,
  duration_ms              integer,
  ocurrido_en              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_portal_access_log_user_time ON portal.access_log(user_id, ocurrido_en DESC);

COMMENT ON TABLE portal.access_log IS 'Audit trail row-level de accesos del portal. Cada RPC SECURITY DEFINER inserta una fila al final.';
