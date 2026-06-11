-- ITEM-045 [P1] (parte forward-only) — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- fn_verify_audit_chain devuelve chain_valid=false para el tenant demo.
-- Causa estructural (verificada en prosrc de Cloud): el ESCRITOR fn_audit_worm
-- seleccionaba el prev_hash con `ORDER BY created_at DESC LIMIT 1` SIN excluir
-- filas con hash_sha512 NULL (95 filas insertadas por escritores que no pasan
-- por el trigger) y SIN tiebreaker por id (163 grupos de created_at duplicado
-- → orden no determinista con uuid aleatorio), mientras el VERIFICADOR ordena
-- `created_at ASC, id ASC` y excluye NULLs. Recetas de encadenado asimétricas:
-- la cadena no puede verificar.
--
-- Esta migración alinea el escritor con el verificador (forward-only):
--   * prev = última fila HASHEADA por (created_at, id) — el mismo "última"
--     que el verificador reconstruye en orden ascendente.
-- La cadena HISTÓRICA no es reparable sin re-anclaje (nuevo génesis con corte
-- fechado): esa decisión forense queda documentada en el backlog del loop como
-- BLOQUEADO-HUMANO (ITEM-045). Las entradas nuevas encadenan correctamente a
-- partir de ahora.

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

  -- ITEM-045: misma receta de "última entrada" que fn_verify_audit_chain
  -- (solo filas hasheadas; desempate determinista por id).
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
$function$;
