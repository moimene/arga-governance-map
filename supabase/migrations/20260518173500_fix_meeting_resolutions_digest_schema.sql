-- T2 Arga test A, SL — Consejo meeting resolutions.
--
-- Supabase Cloud exposes pgcrypto from the `extensions` schema. The transactional
-- meeting resolutions RPC runs with search_path=public, so the rule evaluation
-- hash must call extensions.digest explicitly.

DO $$
DECLARE
  v_fn regprocedure := 'public.fn_save_meeting_resolutions(uuid,uuid,jsonb)'::regprocedure;
  v_sql text;
  v_fixed text;
BEGIN
  SELECT pg_get_functiondef(v_fn) INTO v_sql;

  IF v_sql LIKE '%extensions.digest(v_eval_without_hash::text%' THEN
    RETURN;
  END IF;

  v_fixed := replace(
    v_sql,
    'digest(v_eval_without_hash::text, ''sha256'')',
    'extensions.digest(v_eval_without_hash::text, ''sha256'')'
  );

  IF v_fixed = v_sql THEN
    RAISE EXCEPTION 'fn_save_meeting_resolutions digest call was not found for patching';
  END IF;

  EXECUTE v_fixed;
END $$;
