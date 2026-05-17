-- =============================================================
-- F2.G14 — SECURITY DEFINER hardening (P0+P1 fixes)
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §4
-- Threat model: docs/superpowers/specs/2026-05-16-definer-threat-model.md
-- =============================================================
--
-- Closes 3 P0/P1 issues surfaced by the threat model (§4):
--   - handle_new_user()              — missing SET search_path  (P0)
--   - fn_audit_worm()                — missing SET search_path  (P0)
--   - fn_registrar_movimiento_capital — missing search_path + tenant guard (P0)
--
-- Strategy: CREATE OR REPLACE the full function body, preserving semantics
-- and adding the missing hardening. No DROP needed; CREATE OR REPLACE
-- mutates the function definition in place. Triggers that reference each
-- function stay bound (they reference by name, not by definition).

-- =============================================================
-- §1 handle_new_user() — P0 schema-injection defense
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public        -- G14 hardening: defend against schema hijack
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'F2.G14: hardened with SET search_path = public to prevent schema injection on auth trigger.';


-- =============================================================
-- §2 fn_audit_worm() — P0 schema-injection defense
-- =============================================================
-- Uses pgcrypto.digest() so search_path must include extensions.
CREATE OR REPLACE FUNCTION public.fn_audit_worm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions  -- G14 hardening
AS $$
DECLARE
  v_prev_hash text;
  v_payload   jsonb;
  v_new_hash  text;
  v_action    text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_payload := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_payload := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  SELECT hash_sha512 INTO v_prev_hash
  FROM public.audit_log
  WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
  ORDER BY created_at DESC
  LIMIT 1;

  v_new_hash := encode(
    digest(
      COALESCE(v_prev_hash, 'GENESIS') || '|' ||
      v_action || '|' ||
      TG_TABLE_NAME || '|' ||
      COALESCE(NEW.id, OLD.id)::text || '|' ||
      v_payload::text,
      'sha512'
    ),
    'hex'
  );

  INSERT INTO public.audit_log (
    tenant_id, table_name, record_id, action,
    actor_email, delta, hash_sha512, created_at
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    v_payload,
    v_new_hash,
    now()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_audit_worm() IS
  'F2.G14: hardened with SET search_path = public, extensions. WORM hash-chain trigger; all schema refs now qualified.';


-- =============================================================
-- §3 fn_registrar_movimiento_capital — P0 search_path + tenant guard
-- =============================================================
CREATE OR REPLACE FUNCTION public.fn_registrar_movimiento_capital(
  p_tenant_id                uuid,
  p_entity_id                uuid,
  p_agreement_id             uuid,
  p_person_id                uuid,
  p_share_class_id           uuid,
  p_delta_shares             numeric,
  p_delta_voting_weight      numeric,
  p_delta_denominator_weight numeric,
  p_movement_type            text,
  p_effective_date           date,
  p_notas                    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions  -- G14 hardening
AS $$
DECLARE
  v_movement_id uuid;
  v_audit_id    uuid;
  v_prev_hash   text;
BEGIN
  -- G14: explicit tenant guard (was missing).
  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);

  SELECT hash_sha512 INTO v_prev_hash
    FROM public.audit_log
   ORDER BY created_at DESC
   LIMIT 1;

  INSERT INTO public.audit_log (
    tenant_id, object_type, object_id, action, delta,
    previous_hash, hash_sha512, created_at
  ) VALUES (
    p_tenant_id,
    'capital_movement',
    p_agreement_id::text,
    'INSERT',
    jsonb_build_object(
      'person_id', p_person_id,
      'delta_shares', p_delta_shares,
      'movement_type', p_movement_type,
      'effective_date', p_effective_date
    ),
    COALESCE(v_prev_hash, 'GENESIS'),
    encode(sha256(
      (COALESCE(v_prev_hash, 'GENESIS') ||
       p_movement_type || p_delta_shares::text ||
       now()::text)::bytea
    ), 'hex'),
    now()
  ) RETURNING id INTO v_audit_id;

  INSERT INTO public.capital_movements (
    tenant_id, entity_id, agreement_id, person_id, share_class_id,
    delta_shares, delta_voting_weight, delta_denominator_weight,
    movement_type, effective_date, notas, audit_worm_id
  ) VALUES (
    p_tenant_id, p_entity_id, p_agreement_id, p_person_id, p_share_class_id,
    p_delta_shares, p_delta_voting_weight, p_delta_denominator_weight,
    p_movement_type, p_effective_date, p_notas, v_audit_id
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

COMMENT ON FUNCTION public.fn_registrar_movimiento_capital(uuid, uuid, uuid, uuid, uuid, numeric, numeric, numeric, text, date, text) IS
  'F2.G14: hardened with SET search_path = public, extensions + explicit fn_secretaria_assert_tenant_access guard.';


-- =============================================================
-- Cierre G14 — Probe mecánico
-- =============================================================
DO $$
DECLARE
  v_missing integer;
BEGIN
  -- Verify the 3 hardened functions all have proconfig containing search_path.
  SELECT count(*) INTO v_missing
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('handle_new_user', 'fn_audit_worm', 'fn_registrar_movimiento_capital')
    AND p.prosecdef = true
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg
        WHERE cfg ILIKE 'search_path=%'
      )
    );
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'F2.G14 verification failed: % of 3 hardened fns still missing SET search_path', v_missing;
  END IF;
  RAISE NOTICE 'F2.G14 verification OK: 3 hardened fns all carry SET search_path';
END;
$$;
