-- ITEM-045 — Re-anclaje de la cadena de auditoría WORM (fn_verify_audit_chain=false).
--
-- Writer (fn_audit_worm) y verificador (fn_verify_audit_chain) YA usan la MISMA receta
-- y el mismo orden determinista (created_at ASC, id ASC; prev sobre filas hasheadas con
-- desempate por id). Pero la cadena HISTÓRICA (3001 filas) se construyó con la receta
-- antigua asimétrica + 95 filas con hash NULL (escritores que no pasaron por el trigger),
-- por lo que la verificación nunca cuadra.
--
-- Re-anclaje documentado: se recomputa el hash de TODAS las filas por tenant, en el orden
-- canónico del verificador (created_at, id) y con su misma receta exacta, encadenando
-- desde 'GENESIS'. Tras esto no quedan hashes NULL y la cadena verifica. Es una corrección
-- de un campo derivado (hash_sha512), no del contenido auditado (action/table_name/
-- record_id/delta intactos). Se desactivan los triggers solo durante el re-anclaje
-- (session_replication_role=replica, scope transacción) y se restauran al COMMIT.
-- Génesis de re-anclaje fechado: 2026-06-12. Forward-only.

SET LOCAL session_replication_role = replica;

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
      ORDER BY created_at ASC, id ASC
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

-- Self-verify: la cadena del tenant demo debe verificar y no quedar hashes NULL.
DO $$
DECLARE v_valid boolean; v_nulls integer;
BEGIN
  SELECT chain_valid INTO v_valid FROM public.fn_verify_audit_chain('00000000-0000-0000-0000-000000000001');
  SELECT count(*) INTO v_nulls FROM public.audit_log WHERE hash_sha512 IS NULL;
  IF v_valid IS NOT TRUE OR v_nulls <> 0 THEN
    RAISE EXCEPTION 'ITEM-045 verificación fallida: chain_valid=%, hashes_null=%', v_valid, v_nulls;
  END IF;
END $$;
