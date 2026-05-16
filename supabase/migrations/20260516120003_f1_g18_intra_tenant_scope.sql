-- =============================================================
-- F1.G18 — Intra-tenant authorization (body-level scope)
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §3
-- Precondición: F1.G1 aplicado.
-- =============================================================
--
-- Extiende `user_profiles` con `scope_body_ids uuid[]` para modelar acceso
-- intra-tenant (un usuario asignado solo al CdA no ve Comisión Auditoría).
--
-- NULL = sin restricción (ve todos los bodies del tenant).
-- Array vacío {}  = sin acceso a ningún body (efectivo para auditores
--                   que ven cross-tenant via service_role pero no body-level).
-- Array con UUIDs = restringe a esos bodies específicos.
--
-- Helper `fn_user_has_body_access(p_body_id)` para reuso en policies.
-- Solo se aplica a tablas que tienen `body_id` (meetings, agreements,
-- convocatorias, minutes, certifications, agenda_items, meeting_attendees,
-- meeting_resolutions, meeting_votes).
--
-- IMPORTANTE: por defecto NO añadimos check de body_id a tablas existentes;
-- el flag se activa con `set local fn_intra_tenant_scope_enabled = on` por
-- conexión. Esto evita lockout demo. Para producción se cambia el default.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS scope_body_ids uuid[];

COMMENT ON COLUMN public.user_profiles.scope_body_ids IS
  'F1.G18: array de body_ids accesibles. NULL = sin restricción (default), '
  '{} = ningún body, [uuid,…] = restricción explícita.';


CREATE OR REPLACE FUNCTION public.fn_user_has_body_access(p_body_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = auth.uid()
      AND (
        up.scope_body_ids IS NULL  -- sin restricción → acceso a todos
        OR p_body_id = ANY(up.scope_body_ids)
      )
  )
  -- Service role siempre tiene acceso (bypass para edge functions).
  OR current_setting('request.jwt.claim.role', true) = 'service_role';
$$;

REVOKE EXECUTE ON FUNCTION public.fn_user_has_body_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_has_body_access(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_user_has_body_access(uuid) IS
  'F1.G18: helper para policies intra-tenant. Devuelve true si el caller '
  'puede acceder al body_id dado según user_profiles.scope_body_ids.';


-- =============================================================
-- Activación condicional intra-tenant: feature flag por tenant
-- =============================================================
-- En lugar de mutar todas las policies de meetings/agreements/etc. (riesgo
-- de regresión demo), se introduce una tabla `tenant_features` que controla
-- por tenant si el intra-tenant scope está activo. Las policies futuras
-- pueden consultar `fn_intra_tenant_scope_enabled()` para decidir.

CREATE TABLE IF NOT EXISTS public.tenant_features (
  tenant_id uuid PRIMARY KEY,
  intra_tenant_scope_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_features_self ON public.tenant_features;
CREATE POLICY tenant_features_self ON public.tenant_features
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

COMMENT ON TABLE public.tenant_features IS
  'F1.G18: feature flags por tenant. intra_tenant_scope_enabled controla si '
  'fn_user_has_body_access() filtra meetings/agreements/etc. Por defecto off '
  'para no romper demo single-tenant.';


CREATE OR REPLACE FUNCTION public.fn_intra_tenant_scope_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT intra_tenant_scope_enabled FROM public.tenant_features
       WHERE tenant_id = public.fn_current_tenant_id() LIMIT 1),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.fn_intra_tenant_scope_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_intra_tenant_scope_enabled() TO authenticated, service_role;


-- =============================================================
-- Cierre G18 — Probe mecánico
-- =============================================================
-- Ejecutar en Cloud post-apply:
--   SELECT to_regprocedure('public.fn_user_has_body_access(uuid)') IS NOT NULL;
--   SELECT to_regprocedure('public.fn_intra_tenant_scope_enabled()') IS NOT NULL;
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='user_profiles' AND column_name='scope_body_ids';
--   -- Esperado: tres existen, scope_body_ids type 'ARRAY' subtype uuid.
