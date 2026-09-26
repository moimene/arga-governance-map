begin;

-- ============================================================================
-- Ensayo revertido MOI-204 — aplica la migración y prueba escrituras reales en
-- minutes y registry_filings dentro de la misma transacción; termina en
-- rollback. No modifica nada de forma permanente.
-- ============================================================================

-- MOI-204 — Autor en la cadena WORM (receta versionada) + cobertura de actas
-- y expedientes registrales
-- ============================================================================
-- Decisión D-16 (por delegación de Moisés, opción a — receta versionada desde
-- un corte, NO re-anclaje): las filas ya escritas conservan su huella con la
-- receta antigua (prev|action|table_name|record_id|delta); solo las filas que
-- se inserten a partir de esta migración incluyen el actor en la huella
-- (prev|action|table_name|record_id|actor_id|delta). Ninguna fila existente
-- de audit_log se reescribe: el propio bloque de verificación de abajo lo
-- comprueba comparando cada hash_sha512 antes/después de la migración.
--
-- Alcance:
--   1) audit_log.hash_recipe_version (smallint, CHECK IN (1,2)): 1 para todo
--      lo insertado hasta hoy (backfill de METADATO, no de hash), 2 en
--      adelante (DEFAULT). Es el "corte de seq" del issue expresado como
--      versión por fila en vez de una constante de corte aparte: toda fila
--      con seq <= al máximo actual queda en 1; toda fila nueva nace en 2.
--   2) fn_audit_worm (escritor, BEFORE INSERT/UPDATE/DELETE en las tablas de
--      dominio) añade actor_id = (request.jwt.claims->>'sub')::uuid. Queda
--      NULL en escrituras sin sesión de usuario (service_role, seeds, Edge
--      Functions) — es el comportamiento correcto, no una carencia.
--   3) fn_audit_log_chain (BEFORE INSERT en audit_log; calcula el hash real
--      por seq) usa la receta v2 (con actor_id) para toda fila nueva.
--   4) fn_verify_audit_chain reproduce, fila a fila, la receta que le
--      corresponde según su propio hash_recipe_version — reconoce las DOS
--      recetas, no solo la nueva.
--   5) Triggers de auditoría nuevos AFTER INSERT OR UPDATE OR DELETE →
--      fn_audit_worm en `minutes` (conviviendo con sus 6 guards BEFORE
--      existentes, que no se tocan) y en `registry_filings` (que hoy no
--      tiene ningún trigger).
--   6) Verificación final: aborta la migración si (a) alguna huella
--      histórica cambió, o (b) fn_verify_audit_chain no da chain_valid=true
--      para cada tenant con filas en audit_log.

-- 0) Control positivo: snapshot de huellas ANTES de tocar nada -------------
CREATE TEMP TABLE _moi204_pre_hashes ON COMMIT DROP AS
SELECT id, hash_sha512 FROM public.audit_log;

-- 1) Columna de versión de receta -------------------------------------------
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS hash_recipe_version smallint;

-- Sin backfill: NULL = receta v1 (ningún UPDATE sobre audit_log).
ALTER TABLE public.audit_log ALTER COLUMN hash_recipe_version SET DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.audit_log'::regclass
      AND conname = 'audit_log_hash_recipe_version_check'
  ) THEN
    ALTER TABLE public.audit_log
      ADD CONSTRAINT audit_log_hash_recipe_version_check
      CHECK (hash_recipe_version IN (1, 2));
  END IF;
END $$;

-- 2) Escritor: añade actor_id desde el JWT de sesión -------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_worm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_prev_hash text;
  v_payload   jsonb;
  v_new_hash  text;
  v_action    text;
  v_actor_id  uuid;
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

  BEGIN
    v_actor_id := NULLIF(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      ''
    )::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  SELECT hash_sha512 INTO v_prev_hash
  FROM public.audit_log
  WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
    AND hash_sha512 IS NOT NULL
  ORDER BY created_at DESC, id DESC
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
    actor_email, actor_id, delta, hash_sha512, created_at
  ) VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
    v_actor_id,
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
$function$;

-- 3) Encadenado real: receta v2 (con actor_id) para toda fila nueva ---------
CREATE OR REPLACE FUNCTION public.fn_audit_log_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_worm:' || COALESCE(NEW.tenant_id::text, ''))::bigint);

  SELECT hash_sha512 INTO v_prev
  FROM public.audit_log
  WHERE tenant_id = NEW.tenant_id
    AND seq < NEW.seq
    AND hash_sha512 IS NOT NULL
  ORDER BY seq DESC
  LIMIT 1;

  IF NEW.hash_recipe_version IS NULL THEN
    NEW.hash_recipe_version := 2;
  END IF;

  IF NEW.hash_recipe_version >= 2 THEN
    NEW.hash_sha512 := encode(
      extensions.digest(
        COALESCE(v_prev, 'GENESIS') || '|' ||
        COALESCE(NEW.action, '') || '|' ||
        COALESCE(NEW.table_name, '') || '|' ||
        COALESCE(NEW.record_id::text, '') || '|' ||
        COALESCE(NEW.actor_id::text, '') || '|' ||
        COALESCE(NEW.delta::text, '{}'),
        'sha512'
      ),
      'hex'
    );
  ELSE
    NEW.hash_sha512 := encode(
      extensions.digest(
        COALESCE(v_prev, 'GENESIS') || '|' ||
        COALESCE(NEW.action, '') || '|' ||
        COALESCE(NEW.table_name, '') || '|' ||
        COALESCE(NEW.record_id::text, '') || '|' ||
        COALESCE(NEW.delta::text, '{}'),
        'sha512'
      ),
      'hex'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) Verificador: reconoce las DOS recetas, una por fila según su versión --
CREATE OR REPLACE FUNCTION public.fn_verify_audit_chain(p_tenant_id uuid)
RETURNS TABLE(total_entries bigint, chain_valid boolean, first_entry_at timestamptz, last_entry_at timestamptz)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_prev text := 'GENESIS';
  v_computed text;
  v_row record;
  v_valid boolean := true;
BEGIN
  FOR v_row IN
    SELECT * FROM public.audit_log
    WHERE tenant_id = p_tenant_id AND hash_sha512 IS NOT NULL
    ORDER BY seq ASC
  LOOP
    IF COALESCE(v_row.hash_recipe_version, 1) >= 2 THEN
      v_computed := encode(
        extensions.digest(
          COALESCE(v_prev, 'GENESIS') || '|' ||
          COALESCE(v_row.action, '') || '|' ||
          COALESCE(v_row.table_name, '') || '|' ||
          COALESCE(v_row.record_id::text, '') || '|' ||
          COALESCE(v_row.actor_id::text, '') || '|' ||
          COALESCE(v_row.delta::text, '{}'),
          'sha512'
        ),
        'hex'
      );
    ELSE
      v_computed := encode(
        extensions.digest(
          COALESCE(v_prev, 'GENESIS') || '|' ||
          COALESCE(v_row.action, '') || '|' ||
          COALESCE(v_row.table_name, '') || '|' ||
          COALESCE(v_row.record_id::text, '') || '|' ||
          COALESCE(v_row.delta::text, '{}'),
          'sha512'
        ),
        'hex'
      );
    END IF;
    IF v_computed IS DISTINCT FROM v_row.hash_sha512 THEN
      v_valid := false;
      EXIT;
    END IF;
    v_prev := v_row.hash_sha512;
  END LOOP;

  RETURN QUERY
  SELECT count(*)::bigint, v_valid, min(a.created_at), max(a.created_at)
  FROM public.audit_log a WHERE a.tenant_id = p_tenant_id;
END;
$function$;

-- 5) Cobertura de auditoría: actas y expedientes registrales ---------------
CREATE OR REPLACE TRIGGER trg_audit_worm_minutes
  AFTER INSERT OR UPDATE OR DELETE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

CREATE OR REPLACE TRIGGER trg_audit_worm_registry_filings
  AFTER INSERT OR UPDATE OR DELETE ON public.registry_filings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

-- 6) Verificación final: aborta si algo no queda como se espera ------------
DO $$
DECLARE
  v_reescritas integer;
BEGIN
  SELECT count(*) INTO v_reescritas
  FROM public.audit_log a
  JOIN _moi204_pre_hashes p ON p.id = a.id
  WHERE a.hash_sha512 IS DISTINCT FROM p.hash_sha512;

  IF v_reescritas <> 0 THEN
    RAISE EXCEPTION 'MOI-204: % huellas históricas de audit_log fueron reescritas (prohibido)', v_reescritas;
  END IF;
END $$;

DO $$
DECLARE
  v_tenant uuid;
  v_valid  boolean;
  v_total  bigint;
  v_tenants_checked integer := 0;
BEGIN
  FOR v_tenant IN SELECT DISTINCT tenant_id FROM public.audit_log LOOP
    SELECT chain_valid, total_entries INTO v_valid, v_total
    FROM public.fn_verify_audit_chain(v_tenant);

    IF v_valid IS NOT TRUE THEN
      RAISE EXCEPTION 'MOI-204: fn_verify_audit_chain no da chain_valid=true para tenant % (total=%)', v_tenant, v_total;
    END IF;

    v_tenants_checked := v_tenants_checked + 1;
  END LOOP;

  IF v_tenants_checked = 0 THEN
    RAISE EXCEPTION 'MOI-204: verificación vacua — ningún tenant con audit_log encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'MOI-204: control positivo fallido — tenant …0001 sin filas en audit_log';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log WHERE tenant_id = '00000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'MOI-204: control positivo fallido — tenant …0002 sin filas en audit_log';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_log WHERE tenant_id = '00000000-0000-0000-0000-000000000003'
  ) THEN
    RAISE EXCEPTION 'MOI-204: control positivo fallido — tenant …0003 sin filas en audit_log';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PROBE: escritura real en un acta y en un expediente registral, con sesión
-- de usuario simulada, verificando que audit_log recoge actor_id + receta v2
-- y que la cadena sigue siendo válida después. Ids fijos y locales al ensayo
-- (nunca llegan a persistir: todo el bloque termina en rollback).
-- ---------------------------------------------------------------------------

-- Simula una sesión de usuario autenticado (sub del JWT).
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"probe-moi204@example.test"}',
  true
);

-- Acta: el guard autoritativo de INSERT exige la marca de RPC gobernada.
SELECT set_config('app.secretaria_authoritative_rpc', '1', true);
INSERT INTO public.minutes (id, tenant_id)
VALUES ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001');
SELECT set_config('app.secretaria_authoritative_rpc', '', true);

-- Expediente registral: hoy sin ningún guard de inserción.
INSERT INTO public.registry_filings (id, tenant_id)
VALUES ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001');

-- Comprobación positiva: las dos escrituras quedaron en audit_log con el
-- actor de la sesión y la receta v2 (con actor en la huella).
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE record_id IN (
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  )
    AND table_name IN ('minutes', 'registry_filings')
    AND actor_id = '11111111-1111-1111-1111-111111111111'
    AND hash_recipe_version = 2
    AND hash_sha512 IS NOT NULL;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'PROBE MOI-204: esperaba 2 filas de audit_log (minutes + registry_filings) con actor_id de sesión y hash_recipe_version=2, encontré %', v_count;
  END IF;
END $$;

-- Comprobación negativa: sin sesión (actor_id NULL), la escritura sigue
-- auditándose y sigue naciendo en receta v2 (v2 no depende de que haya actor).
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('app.secretaria_authoritative_rpc', '1', true);
INSERT INTO public.minutes (id, tenant_id)
VALUES ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001');
SELECT set_config('app.secretaria_authoritative_rpc', '', true);

DO $$
DECLARE
  v_actor uuid;
  v_version smallint;
BEGIN
  SELECT actor_id, hash_recipe_version INTO v_actor, v_version
  FROM public.audit_log
  WHERE record_id = '44444444-4444-4444-4444-444444444444' AND table_name = 'minutes';

  IF v_actor IS NOT NULL THEN
    RAISE EXCEPTION 'PROBE MOI-204: escritura sin sesión no debería tener actor_id (encontrado %)', v_actor;
  END IF;
  IF v_version IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'PROBE MOI-204: escritura sin sesión debería seguir en receta v2, encontré %', v_version;
  END IF;
END $$;

-- La cadena WORM sigue siendo válida tras las tres escrituras de prueba, para
-- los tres tenants nombrados en el issue.
DO $$
DECLARE
  v_valid boolean;
  v_tenant uuid;
BEGIN
  FOR v_tenant IN SELECT unnest(ARRAY[
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid
  ]) LOOP
    SELECT chain_valid INTO v_valid FROM public.fn_verify_audit_chain(v_tenant);
    IF v_valid IS NOT TRUE THEN
      RAISE EXCEPTION 'PROBE MOI-204: fn_verify_audit_chain no válida para tenant % tras el ensayo', v_tenant;
    END IF;
  END LOOP;
END $$;

rollback;
