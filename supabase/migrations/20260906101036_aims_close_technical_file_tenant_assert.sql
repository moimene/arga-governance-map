-- fn_aims_close_technical_file es SECURITY DEFINER, ejecutable por
-- authenticated, y cargaba la versión por id sin comparar su tenant con el del
-- caller: un usuario de un tenant podía intentar sellar el expediente técnico
-- de otro (hallazgos #118/#149/#239, 2026-09-06). Hoy lo frenaba de rebote el
-- guard de evidence_bundles; esto es la defensa que faltaba, con el mismo
-- patrón que 20260606165443. service_role queda exento como en el resto.
-- Sustitución anclada e idempotente.
DO $patch$
DECLARE
  src text; n int;
  a1 text := $a$  SELECT * INTO v_version FROM aims_system_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIMS version not found: %', p_version_id;
  END IF;$a$;
  r1 text := $a$  SELECT * INTO v_version FROM aims_system_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AIMS version not found: %', p_version_id;
  END IF;

  -- Aserción de tenant (2026-09-06): SECURITY DEFINER sin ella dejaba que un
  -- authenticated de un tenant sellara el expediente técnico de otro.
  IF public.fn_secretaria_is_service_role() IS NOT TRUE
     AND public.fn_current_tenant_id() IS DISTINCT FROM v_version.tenant_id THEN
    RAISE EXCEPTION 'AIMS technical file tenant mismatch: caller tenant % no puede sellar la versión %',
      public.fn_current_tenant_id(), p_version_id
      USING ERRCODE = '42501';
  END IF;$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p WHERE p.proname = 'fn_aims_close_technical_file' AND p.pronamespace = 'public'::regnamespace;
  IF src IS NULL THEN RAISE EXCEPTION 'fn_aims_close_technical_file no existe'; END IF;
  IF position('AIMS technical file tenant mismatch' in src) > 0 THEN
    RAISE NOTICE 'ya parcheada; nada que hacer'; RETURN;
  END IF;
  n := (length(src) - length(replace(src, a1, ''))) / length(a1);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla aparece % veces', n; END IF;
  EXECUTE replace(src, a1, r1);
END
$patch$;
