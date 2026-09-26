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
--   1) audit_log.hash_recipe_version (smallint, CHECK IN (1,2), NULL = 1):
--      NULL para todo lo insertado hasta hoy (sin backfill), 2 en
--      adelante (DEFAULT). Es el "corte de seq" del issue expresado como
--      versión por fila en vez de una constante de corte aparte: toda fila
--      ya escrita queda en NULL (= receta 1); toda fila nueva nace en 2.
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
--
-- Precedente de sustitución anclada sobre el cuerpo vivo: se parte del cuerpo
-- verificado en Cloud el 2026-09-26 (idéntico byte a byte a
-- 20260611190000_align_audit_worm_prev_hash_selection.sql para fn_audit_worm
-- y a 20260614110904_item045_worm_audit_chain_seq.sql para
-- fn_audit_log_chain/fn_verify_audit_chain — sin drift, sin el
-- COALESCE(NEW.tenant_id, ARGA) que CLAUDE.md señalaba como no verificado).

-- 0) Control positivo: snapshot de huellas ANTES de tocar nada -------------
CREATE TEMP TABLE _moi204_pre_hashes ON COMMIT DROP AS
SELECT id, hash_sha512 FROM public.audit_log;

-- 1) Columna de versión de receta -------------------------------------------
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS hash_recipe_version smallint;

-- Sin backfill: las filas ya escritas quedan con hash_recipe_version NULL,
-- que significa receta v1 (sin actor). Así no se ejecuta ningún UPDATE sobre
-- audit_log, que es de solo anexión (decisión del orquestador al revisar la
-- migración, 26-09-2026). El CHECK admite NULL; el verificador trata NULL
-- como 1 y el trigger de encadenado pone 2 en toda fila nueva.
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

  -- MOI-204: autor de sesión (NULL sin sesión de usuario — service_role,
  -- seeds, Edge Functions con service role — correcto). Defensivo ante un
  -- 'sub' que no sea un uuid válido: no debe tumbar la escritura auditada.
  BEGIN
    v_actor_id := NULLIF(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      ''
    )::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  -- ITEM-045: misma receta de "última entrada" que fn_verify_audit_chain
  -- (solo filas hasheadas; desempate determinista por id). El hash real de
  -- la fila lo recalcula fn_audit_log_chain (trigger BEFORE INSERT sobre
  -- audit_log, por seq); v_new_hash aquí es un valor provisional que ese
  -- trigger sobrescribe, igual que antes de MOI-204.
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
  -- Serializa por tenant: evita que dos transacciones concurrentes tomen el
  -- mismo prev y bifurquen la cadena. Liberado al fin de la transacción.
  PERFORM pg_advisory_xact_lock(hashtext('audit_worm:' || COALESCE(NEW.tenant_id::text, ''))::bigint);

  SELECT hash_sha512 INTO v_prev
  FROM public.audit_log
  WHERE tenant_id = NEW.tenant_id
    AND seq < NEW.seq
    AND hash_sha512 IS NOT NULL
  ORDER BY seq DESC
  LIMIT 1;

  -- MOI-204: toda fila que pasa por este trigger es nueva → receta v2.
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
    -- Camino defensivo únicamente: nunca se ejercita en escritura real
    -- (ninguna vía de INSERT deja hash_recipe_version en 1), pero mantiene
    -- el trigger correcto si alguna vez un backfill insertara con esa
    -- versión explícita.
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
-- minutes: convive con sus 6 guards BEFORE existentes (lock_guard,
-- book_link_guard, authoritative_domain_guard, authoritative_insert_guard,
-- annual_accounts_gate, interposition_domain_guard) — un AFTER trigger solo
-- se dispara si esos guards dejan pasar la escritura.
CREATE OR REPLACE TRIGGER trg_audit_worm_minutes
  AFTER INSERT OR UPDATE OR DELETE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

-- registry_filings: hoy sin ningún trigger (0 medido en el issue).
CREATE OR REPLACE TRIGGER trg_audit_worm_registry_filings
  AFTER INSERT OR UPDATE OR DELETE ON public.registry_filings
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

-- 6) Verificación final: aborta si algo no queda como se espera ------------
DO $$
DECLARE
  v_reescritas integer;
BEGIN
  -- (a) Ninguna huella histórica cambió (regla de CLAUDE.md: no reescribir
  -- trazas). Compara contra el snapshot tomado ANTES de cualquier cambio.
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

  -- Control positivo explícito de los tres tenants nombrados en el issue.
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
