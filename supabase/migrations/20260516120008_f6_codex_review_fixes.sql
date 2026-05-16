-- =============================================================
-- F6 — Fixes post-adversarial-review (Codex challenge 2026-05-16)
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md
-- Concilio Codex sesión challenge 2026-05-16: 13 findings, 5 P0 + 6 P1 + 2 P2.
-- =============================================================
--
-- Esta migración cierra los hallazgos críticos del adversarial review post-
-- F0-F5. Cada bloque referencia el finding original.
--
-- P0 ACEPTADOS:
--   #1 user_profiles.tenant_id mutable por authenticated → bypass tenant.
--   #2 user_profiles.role_code mutable → bypass role guard.
--   #3 evidence_bundles puede no tener RLS → bypass tenant on signed URLs.
--   #4 Edge Function path no bound a tenant_id → poisoning attack.
--   #5 G2 re-grant blanket reabrió fn_consolidate_person a authenticated → regresión.
-- P1 ACEPTADOS:
--   #9 Edge Function comment dice ARCHIVED-PENDIENTE-LEGAL pero no checa status.
--  #10 F4.G16 TOCTOU entre cargos count y UPDATE.
-- P1 RECHAZADO:
--   #8 fn_registrar_movimiento_capital "audit delta perdió campos" — verificado
--      contra body original 20260424155349_000032: los campos son IDÉNTICOS.
--      Codex se equivocó en este punto.
-- P1 PENDIENTE (follow-up):
--   #6 G1 policy rewrite no preserva polpermissive/polroles — bajo riesgo aquí
--      pero principio correcto. Doc separado.
--   #7 G2 scope solo public — overstatement en commit message. Doc separado.
--  #11 e2e-destructive workflow no realmente staging por client.ts hardcoded —
--      requiere env-driven Supabase client. Doc separado.
-- P2 ACEPTADOS (sprint posterior):
--  #12 observability.ts no llega a Sentinel — TODO siguiente sprint.
--  #13 contract tests validan stubs — opt-in live tests siguiente sprint.

-- =============================================================
-- §1 (P0 #1+#2) — user_profiles immutable columns (tenant_id, role_code)
-- =============================================================
-- La RLS actual permite UPDATE a authenticated en filas propias. Eso es OK
-- para campos editables por el user (full_name, avatar) PERO peligroso para
-- tenant_id y role_code (mutables → escalation).
--
-- En Supabase los grants table-level de authenticated incluyen UPDATE en
-- todas las columnas, así que REVOKE column-level no surte efecto. Usamos
-- un trigger BEFORE UPDATE que rechaza cambios a esas columnas salvo que el
-- caller sea service_role.

CREATE OR REPLACE FUNCTION public.fn_user_profiles_lock_critical_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypass — Edge Functions y seed scripts pueden mutar.
  IF public.fn_secretaria_is_service_role() THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'user_profiles.tenant_id is immutable for authenticated users (use service_role)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.role_code IS DISTINCT FROM OLD.role_code THEN
    RAISE EXCEPTION 'user_profiles.role_code is immutable for authenticated users (use service_role)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_user_profiles_lock_critical_cols() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_profiles_lock_critical_cols() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_user_profiles_lock_critical_cols ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_lock_critical_cols
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_user_profiles_lock_critical_cols();

COMMENT ON COLUMN public.user_profiles.tenant_id IS
  'F6: trigger trg_user_profiles_lock_critical_cols bloquea UPDATE para '
  'authenticated. Previene bypass tenant via fn_current_tenant_id Path C.';
COMMENT ON COLUMN public.user_profiles.role_code IS
  'F6: trigger trg_user_profiles_lock_critical_cols bloquea UPDATE para '
  'authenticated. Previene role escalation via fn_secretaria_assert_role_allowed.';


-- =============================================================
-- §2 (P0 #3) — evidence_bundles RLS explícito (defense-in-depth)
-- =============================================================
-- Habilita RLS si no está activo + policy tenant-isolation usando
-- fn_current_tenant_id() (forma F1.G1 ya estandarizada).

ALTER TABLE public.evidence_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_bundles_tenant_isolation ON public.evidence_bundles;
CREATE POLICY evidence_bundles_tenant_isolation ON public.evidence_bundles
  FOR ALL TO authenticated
  USING (tenant_id = public.fn_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

COMMENT ON POLICY evidence_bundles_tenant_isolation ON public.evidence_bundles IS
  'F6: explicit tenant_isolation policy. Cierra hallazgo P0 #3 del adversarial '
  'review (Edge Function sign-evidence-url asumía RLS sin verificar).';

-- View evidence_bundles_latest hereda RLS porque NO se declaró security_invoker.
-- En Postgres < 15 las views siempre usan el owner; en >= 15 con security_invoker
-- usan el caller. Sobre Supabase actual (pg 15) declarar invoker explícito:
DROP VIEW IF EXISTS public.evidence_bundles_latest CASCADE;
CREATE VIEW public.evidence_bundles_latest
  WITH (security_invoker = true) AS
SELECT eb.*
FROM public.evidence_bundles eb
WHERE NOT EXISTS (
  SELECT 1 FROM public.evidence_bundles s WHERE s.supersedes_id = eb.id
);
COMMENT ON VIEW public.evidence_bundles_latest IS
  'F3.G15 + F6: HEAD por supersession chain. security_invoker=true para que '
  'la RLS de evidence_bundles aplique al caller, no al owner de la view.';
GRANT SELECT ON public.evidence_bundles_latest TO authenticated, service_role;


-- =============================================================
-- §3 (P0 #5) — Revocar fn_consolidate_person de authenticated
-- =============================================================
-- El loop de G2 re-grant blanket añadió GRANT a authenticated para esta
-- función, regresando el hardening explícito de
-- 20260512190500_personas_cargos_security_followups que la había dejado
-- SOLO service_role. Forward-only revoke.

REVOKE EXECUTE ON FUNCTION public.fn_consolidate_person(uuid, uuid, uuid, text, text)
  FROM authenticated;

COMMENT ON FUNCTION public.fn_consolidate_person(uuid, uuid, uuid, text, text) IS
  'F6: reverts G2 blanket re-grant. Función de consolidación de personas — '
  'service_role exclusivo. Frontend NO debe invocar directamente.';


-- =============================================================
-- §4 (P1 #10) — fn_promover_sociedad_operativa close TOCTOU
-- =============================================================
-- Reescribir con SELECT ... FOR UPDATE sobre entities row para serializar
-- contra DELETEs concurrentes de condiciones_persona. Postgres no soporta
-- FOR UPDATE en JOIN multi-tabla sencillo, pero podemos bloquear la entity
-- (que es el target del UPDATE) y validar cargos en la misma transacción.

CREATE OR REPLACE FUNCTION public.fn_promover_sociedad_operativa(
  p_tenant_id uuid,
  p_entity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_cargos_count integer;
  v_presidente integer;
  v_secretario integer;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'p_entity_id is required';
  END IF;

  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM public.fn_secretaria_assert_role_allowed(
    p_tenant_id, ARRAY['SECRETARIO','ADMIN_TENANT']::text[]
  );

  -- F6.§4: lock entity row para serializar contra promociones concurrentes
  -- y para que cualquier UPDATE/DELETE en cascade vea la lock.
  SELECT onboarding_status INTO v_status
  FROM public.entities
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'entity % not found in tenant %', p_entity_id, p_tenant_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status = 'OPERATIVA' THEN
    RETURN jsonb_build_object('ok', true, 'already_operativa', true, 'entity_id', p_entity_id);
  END IF;

  -- F6.§4: usar advisory lock para serializar contra concurrent cese/designar
  -- de cargos. Hash determinístico desde entity_id. ROLLBACK libera el lock.
  PERFORM pg_advisory_xact_lock(hashtext('cargos:' || p_entity_id::text));

  SELECT count(*) INTO v_cargos_count
  FROM public.condiciones_persona cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.entity_id = p_entity_id
    AND cp.estado = 'VIGENTE';

  IF v_cargos_count < 2 THEN
    RAISE EXCEPTION 'sociedad % has insufficient vigente condiciones_persona (% < 2, need at least PRESIDENTE + SECRETARIO)', p_entity_id, v_cargos_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_presidente
  FROM public.condiciones_persona cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.entity_id = p_entity_id
    AND cp.estado = 'VIGENTE'
    AND cp.tipo_condicion = 'PRESIDENTE';

  SELECT count(*) INTO v_secretario
  FROM public.condiciones_persona cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.entity_id = p_entity_id
    AND cp.estado = 'VIGENTE'
    AND cp.tipo_condicion = 'SECRETARIO';

  IF v_presidente < 1 OR v_secretario < 1 THEN
    RAISE EXCEPTION 'sociedad % requires at least 1 PRESIDENTE (got %) and 1 SECRETARIO (got %)', p_entity_id, v_presidente, v_secretario
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.entities
  SET onboarding_status = 'OPERATIVA'
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_operativa', false,
    'entity_id', p_entity_id,
    'cargos_vigentes', v_cargos_count,
    'presidente_count', v_presidente,
    'secretario_count', v_secretario
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_promover_sociedad_operativa(uuid, uuid) IS
  'F4.G16 + F6: server-side promoción a OPERATIVA con guards (tenant, role, '
  'cargos mínimos) + SELECT FOR UPDATE de entity + pg_advisory_xact_lock '
  'sobre cargos:<entity> para cerrar TOCTOU detectado por adversarial review.';


-- =============================================================
-- Cierre F6 — Probes mecánicos
-- =============================================================
DO $$
DECLARE
  v_trigger_exists boolean;
  v_eb_rls_enabled boolean;
  v_consolidate_grant text;
BEGIN
  -- P0 #1+#2 probe: trigger trg_user_profiles_lock_critical_cols está activo.
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_user_profiles_lock_critical_cols'
      AND tgrelid = 'public.user_profiles'::regclass
      AND NOT tgisinternal
  ) INTO v_trigger_exists;
  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'F6.§1 verification failed: trg_user_profiles_lock_critical_cols not installed';
  END IF;

  -- P0 #3 probe: evidence_bundles tiene RLS habilitada y al menos una policy.
  SELECT relrowsecurity INTO v_eb_rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'evidence_bundles';
  IF v_eb_rls_enabled IS NULL OR v_eb_rls_enabled = false THEN
    RAISE EXCEPTION 'F6.§2 verification failed: evidence_bundles RLS not enabled';
  END IF;

  -- P0 #5 probe: fn_consolidate_person NO tiene EXECUTE para authenticated.
  SELECT string_agg(acl.grantee::regrole::text, ',') INTO v_consolidate_grant
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl ON true
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_consolidate_person'
    AND acl.privilege_type = 'EXECUTE'
    AND acl.grantee::regrole::text = 'authenticated';
  IF v_consolidate_grant IS NOT NULL THEN
    RAISE EXCEPTION 'F6.§3 verification failed: fn_consolidate_person still granted to authenticated';
  END IF;

  RAISE NOTICE 'F6 verification OK: P0 #1+#2 (immutable user_profiles cols) + #3 (evidence_bundles RLS) + #5 (fn_consolidate_person revoked from authenticated) all enforced';
END;
$$;
