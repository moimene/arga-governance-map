-- MOI-148 · Decisión D-21 (por delegación): alta por pantalla de la edición
-- de matriz y porcentaje de participación DESPUÉS del alta, por el camino
-- autoritativo. Hoy `entities.parent_entity_id`/`ownership_percentage` solo
-- se escriben en `fn_crear_sociedad_legal_y_capital` (paso de alta); no hay
-- ninguna RPC ni escritura directa desde `src` para corregirlos más tarde.
--
-- No crea tabla de histórico nueva: `entities` ya lleva el trigger WORM
-- `trg_audit_worm_entities` (hash-chained, append-only en `audit_log`), así
-- que un UPDATE de esta RPC queda con el valor anterior conservado sin
-- sobrescribirlo, igual que cualquier otro UPDATE de `entities`.
--
-- Guard: run `bun run db:check-target` before applying to any environment.
-- No aplicar a Cloud sin autorización escrita expresa (issue, paso 6).

CREATE OR REPLACE FUNCTION fn_secretaria_actualizar_estructura_grupo(
  p_tenant_id uuid,
  p_entity_id uuid,
  p_parent_entity_id uuid,
  p_ownership_percentage numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity entities%ROWTYPE;
  v_parent entities%ROWTYPE;
  v_walk uuid;
  v_depth int := 0;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);

  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'p_entity_id is required';
  END IF;

  SELECT * INTO v_entity
    FROM entities
   WHERE id = p_entity_id
     AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity % not found for tenant %', p_entity_id, p_tenant_id;
  END IF;

  IF p_ownership_percentage IS NOT NULL
     AND (p_ownership_percentage < 0 OR p_ownership_percentage > 100) THEN
    RAISE EXCEPTION 'p_ownership_percentage must be between 0 and 100';
  END IF;

  IF p_parent_entity_id IS NOT NULL THEN
    IF p_parent_entity_id = p_entity_id THEN
      RAISE EXCEPTION 'an entity cannot be its own parent';
    END IF;

    SELECT * INTO v_parent
      FROM entities
     WHERE id = p_parent_entity_id
       AND tenant_id = p_tenant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent entity % not found for tenant %', p_parent_entity_id, p_tenant_id;
    END IF;

    -- Evita crear un ciclo: recorre la cadena de matrices del nuevo padre y
    -- comprueba que la entidad que se edita no aparece en ella. Límite de
    -- profundidad como cinturón de seguridad frente a un ciclo ya existente.
    v_walk := v_parent.parent_entity_id;
    WHILE v_walk IS NOT NULL AND v_depth < 50 LOOP
      IF v_walk = p_entity_id THEN
        RAISE EXCEPTION 'assigning parent % would create a cycle in the group structure', p_parent_entity_id;
      END IF;
      SELECT parent_entity_id INTO v_walk FROM entities WHERE id = v_walk AND tenant_id = p_tenant_id;
      v_depth := v_depth + 1;
    END LOOP;
    IF v_depth >= 50 THEN
      RAISE EXCEPTION 'group structure chain exceeds max depth while validating parent %', p_parent_entity_id;
    END IF;
  END IF;

  UPDATE entities
     SET parent_entity_id = p_parent_entity_id,
         ownership_percentage = p_ownership_percentage
   WHERE id = p_entity_id
     AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'status', 'OK',
    'entity_id', p_entity_id,
    'previous_parent_entity_id', v_entity.parent_entity_id,
    'previous_ownership_percentage', v_entity.ownership_percentage,
    'parent_entity_id', p_parent_entity_id,
    'ownership_percentage', p_ownership_percentage
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric)
  TO authenticated, service_role;

COMMENT ON FUNCTION fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric) IS
  'MOI-148 (D-21): edición autoritativa post-alta de entities.parent_entity_id y ownership_percentage. Tenant y rol de la sesión via fn_secretaria_assert_tenant_access/fn_secretaria_assert_role_allowed; histórico via trg_audit_worm_entities (audit_log, WORM). No usar para el alta inicial (fn_crear_sociedad_legal_y_capital).';

-- Verificación final: aborta si el instrumento no quedó como se espera.
DO $verificacion$
DECLARE
  v_exists boolean;
  v_grants_authenticated boolean;
  v_grants_anon boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_secretaria_actualizar_estructura_grupo'
      AND p.prosecdef = true
  ) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_actualizar_estructura_grupo no existe o no es SECURITY DEFINER';
  END IF;

  SELECT has_function_privilege('authenticated', 'fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric)', 'EXECUTE')
    INTO v_grants_authenticated;
  IF NOT v_grants_authenticated THEN
    RAISE EXCEPTION 'VERIFICACION: authenticated no puede ejecutar fn_secretaria_actualizar_estructura_grupo';
  END IF;

  SELECT has_function_privilege('anon', 'fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric)', 'EXECUTE')
    INTO v_grants_anon;
  IF v_grants_anon THEN
    RAISE EXCEPTION 'VERIFICACION: anon puede ejecutar fn_secretaria_actualizar_estructura_grupo y no debería';
  END IF;

  -- Control positivo del propio instrumento: el trigger WORM que provee el
  -- histórico sigue existiendo sobre entities (si no, esta comprobación
  -- fallaría igual que si de verdad hubiera desaparecido).
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'entities'
      AND t.tgname = 'trg_audit_worm_entities'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'VERIFICACION: trg_audit_worm_entities no existe; el histórico de esta RPC no quedaría cubierto';
  END IF;

  RAISE NOTICE 'VERIFICACION OK: fn_secretaria_actualizar_estructura_grupo lista, tenant/rol exigidos, histórico cubierto por trg_audit_worm_entities';
END;
$verificacion$;
