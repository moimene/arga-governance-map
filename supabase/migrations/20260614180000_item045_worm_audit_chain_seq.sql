-- ITEM-045 — Cadena WORM robusta: orden monótono (seq) + writer centralizado.
--
-- Causa raíz (verificada: chain_valid=false sobre 3282 filas): el escritor
-- fn_audit_worm elegía `prev` por (created_at DESC, id DESC) y el verificador
-- recorría (created_at ASC, id ASC). Pero created_at=now() NO es único (varias
-- filas por ms/transacción) e id es uuid aleatorio → con empates de created_at el
-- `prev` del escritor y el orden del verificador divergen y la cadena rompe.
-- Además inserts directos (sin pasar por el trigger) dejaban hash NULL, y cada
-- re-anclaje de una sola vez se volvía a romper con los inserts siguientes.
--
-- Fix:
--   1) columna `seq` monótona (orden de inserción estricto, sin empates).
--   2) writer centralizado BEFORE INSERT en audit_log que computa el hash
--      encadenado por seq → cubre TODO insert (incl. directos, fin de los NULL),
--      con advisory lock por tenant para no bifurcar la cadena bajo concurrencia.
--   3) verificador recorre por seq ASC (misma receta).
--   4) re-anclaje único por seq + backfill de hashes históricos.
-- La receta del hash (prev|action|table_name|record_id|delta) NO cambia; solo el
-- orden de encadenado. Es corrección de un campo derivado (hash_sha512), no del
-- contenido auditado. Forward-only. El self-verify aborta la migración si la
-- cadena no queda válida.

SET LOCAL session_replication_role = replica;

-- 1) Columna seq monótona + secuencia
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS seq bigint;
CREATE SEQUENCE IF NOT EXISTS public.audit_log_seq OWNED BY public.audit_log.seq;

WITH ord AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.audit_log
)
UPDATE public.audit_log a SET seq = ord.rn FROM ord WHERE a.id = ord.id AND a.seq IS NULL;

SELECT setval('public.audit_log_seq', COALESCE((SELECT max(seq) FROM public.audit_log), 0), true);
ALTER TABLE public.audit_log ALTER COLUMN seq SET DEFAULT nextval('public.audit_log_seq');
ALTER TABLE public.audit_log ALTER COLUMN seq SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_log_seq ON public.audit_log (seq);

-- 2) Writer centralizado: BEFORE INSERT en audit_log (cubre todos los caminos)
CREATE OR REPLACE FUNCTION public.fn_audit_log_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_prev text;
BEGIN
  -- Serializa por tenant: evita que dos transacciones concurrentes tomen el mismo
  -- prev y bifurquen la cadena. Liberado al fin de la transacción.
  PERFORM pg_advisory_xact_lock(hashtext('audit_worm:' || COALESCE(NEW.tenant_id::text, ''))::bigint);

  SELECT hash_sha512 INTO v_prev
  FROM public.audit_log
  WHERE tenant_id = NEW.tenant_id
    AND seq < NEW.seq
    AND hash_sha512 IS NOT NULL
  ORDER BY seq DESC
  LIMIT 1;

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
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_log_chain ON public.audit_log;
CREATE TRIGGER trg_audit_log_chain
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_chain();

-- 3) Verificador por seq
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

-- 4) Re-anclaje único por seq (recomputa TODOS los hashes, incl. los NULL)
DO $$
DECLARE
  v_tenant uuid;
  v_row    record;
  v_prev   text;
  v_hash   text;
BEGIN
  FOR v_tenant IN SELECT DISTINCT tenant_id FROM public.audit_log LOOP
    v_prev := 'GENESIS';
    FOR v_row IN
      SELECT id, action, table_name, record_id, delta
      FROM public.audit_log
      WHERE tenant_id = v_tenant
      ORDER BY seq ASC
    LOOP
      v_hash := encode(extensions.digest(
        COALESCE(v_prev, 'GENESIS') || '|' ||
        COALESCE(v_row.action, '') || '|' ||
        COALESCE(v_row.table_name, '') || '|' ||
        COALESCE(v_row.record_id::text, '') || '|' ||
        COALESCE(v_row.delta::text, '{}'),
        'sha512'), 'hex');
      UPDATE public.audit_log SET hash_sha512 = v_hash WHERE id = v_row.id;
      v_prev := v_hash;
    END LOOP;
  END LOOP;
END $$;

-- 5) Self-verify: aborta la migración si la cadena no queda válida y sin NULLs
DO $$
DECLARE v_valid boolean; v_nulls integer;
BEGIN
  SELECT chain_valid INTO v_valid FROM public.fn_verify_audit_chain('00000000-0000-0000-0000-000000000001');
  SELECT count(*) INTO v_nulls FROM public.audit_log WHERE hash_sha512 IS NULL;
  IF v_valid IS NOT TRUE OR v_nulls <> 0 THEN
    RAISE EXCEPTION 'ITEM-045: verificación fallida (chain_valid=%, hashes_null=%)', v_valid, v_nulls;
  END IF;
END $$;
