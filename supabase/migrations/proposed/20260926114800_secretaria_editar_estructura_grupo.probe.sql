-- Ensayo revertido de
-- supabase/migrations/20260926114800_secretaria_editar_estructura_grupo.sql
-- (MOI-148, decisión D-21). NO ejecutar fuera de una revisión deliberada:
-- aplica la migración, prueba el camino positivo y cinco rechazos sobre dato
-- REAL del tenant "Grupo Nuevo" (`00000000-0000-0000-0000-000000000003`),
-- y deshace todo al final.

begin;

-- 1) Aplica la migración (idéntica a la del fichero real).
CREATE OR REPLACE FUNCTION fn_secretaria_actualizar_estructura_grupo(
  p_tenant_id uuid,
  p_entity_id uuid,
  p_parent_entity_id uuid,
  p_ownership_percentage numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_secretaria_actualizar_estructura_grupo(uuid, uuid, uuid, numeric)
  TO authenticated, service_role;

-- 2) Dato real de partida (Grupo Nuevo, medido en solo lectura el 2026-09-26):
--    Corporación Nueva (raíz, 45c8df67-64c9-42a3-abff-8047dd23748b)
--      └─ Servicios Nuevos Integrales, S.L.U. (7ea1d208-6c67-4021-baf4-ecb9de2abacd), 100%
--      └─ Tecnología e Innovación Nueva, S.L.  (9d209ef6-ca87-44d4-a12c-86f12a0ea368), 70% — filial 2.3 del guion.
do $control_dato_inicial$
declare
  v_parent uuid;
  v_pct numeric;
begin
  select parent_entity_id, ownership_percentage into v_parent, v_pct
    from public.entities
   where id = '9d209ef6-ca87-44d4-a12c-86f12a0ea368';
  if v_parent is distinct from '45c8df67-64c9-42a3-abff-8047dd23748b'::uuid or v_pct is distinct from 70 then
    raise exception 'PROBE: dato de partida distinto al medido (matriz=%, pct=%)', v_parent, v_pct;
  end if;
  raise notice 'PROBE OK: dato de partida coincide con lo medido (matriz=Corporación Nueva, 70%%)';
end;
$control_dato_inicial$;

-- 3) Sesión SECRETARIO del tenant Grupo Nuevo (mismo mecanismo que el resto
--    de sondas del repo: request.jwt.claims local a esta transacción).
select set_config(
  'request.jwt.claims',
  json_build_object('tenant_id', '00000000-0000-0000-0000-000000000003', 'role_code', 'SECRETARIO')::text,
  true
);

-- 4) Positivo: reaparenta la filial 2.3 bajo Servicios Nuevos Integrales y
--    cambia el porcentaje de 70 a 45. No es un ciclo (Servicios no depende
--    de Tecnología). Verifica el UPDATE y que audit_log conserva el valor
--    anterior (histórico WORM, sin tabla nueva).
do $positivo$
declare
  v_result jsonb;
  v_new_parent uuid;
  v_new_pct numeric;
  v_delta jsonb;
begin
  select fn_secretaria_actualizar_estructura_grupo(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '9d209ef6-ca87-44d4-a12c-86f12a0ea368'::uuid,
    '7ea1d208-6c67-4021-baf4-ecb9de2abacd'::uuid,
    45
  ) into v_result;

  if (v_result->>'previous_ownership_percentage')::numeric is distinct from 70 then
    raise exception 'PROBE: la RPC no devolvió el valor anterior correcto (%)', v_result;
  end if;

  select parent_entity_id, ownership_percentage into v_new_parent, v_new_pct
    from public.entities where id = '9d209ef6-ca87-44d4-a12c-86f12a0ea368';
  if v_new_parent is distinct from '7ea1d208-6c67-4021-baf4-ecb9de2abacd'::uuid or v_new_pct is distinct from 45 then
    raise exception 'PROBE: entities no quedó actualizada (matriz=%, pct=%)', v_new_parent, v_new_pct;
  end if;

  select delta into v_delta
    from public.audit_log
   where table_name = 'entities'
     and record_id = '9d209ef6-ca87-44d4-a12c-86f12a0ea368'
     and action = 'UPDATE'
   order by created_at desc
   limit 1;
  if v_delta is null then
    raise exception 'PROBE: no se generó fila de audit_log para el UPDATE (histórico ausente)';
  end if;
  if (v_delta->'old'->>'ownership_percentage')::numeric is distinct from 70 then
    raise exception 'PROBE: audit_log no conservó el porcentaje anterior (delta=%)', v_delta;
  end if;
  if (v_delta->'old'->>'parent_entity_id')::uuid is distinct from '45c8df67-64c9-42a3-abff-8047dd23748b'::uuid then
    raise exception 'PROBE: audit_log no conservó la matriz anterior (delta=%)', v_delta;
  end if;

  raise notice 'PROBE OK: filial 2.3 reaparentada (45%%%%->%%, 70->45) e histórico WORM con el valor anterior intacto';
end;
$positivo$;

-- 5) Negativo: una entidad no puede ser su propia matriz.
savepoint sp_auto_referencia;
do $sonda_auto$
begin
  perform fn_secretaria_actualizar_estructura_grupo(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '9d209ef6-ca87-44d4-a12c-86f12a0ea368'::uuid,
    '9d209ef6-ca87-44d4-a12c-86f12a0ea368'::uuid,
    50
  );
  raise exception 'PROBE: la auto-referencia debería haberse rechazado y no se rechazó';
exception
  when others then
    if sqlerrm not like '%cannot be its own parent%' then
      raise exception 'PROBE: rechazo inesperado en auto-referencia: %', sqlerrm;
    end if;
    raise notice 'PROBE OK: auto-referencia rechazada (%)', sqlerrm;
end;
$sonda_auto$;
rollback to savepoint sp_auto_referencia;

-- 6) Negativo: ciclo. Tras el paso 4, la cadena es
--    Tecnología -> Servicios -> Corporación. Poner la matriz de Corporación
--    Nueva a Tecnología cerraría el ciclo.
savepoint sp_ciclo;
do $sonda_ciclo$
begin
  perform fn_secretaria_actualizar_estructura_grupo(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '45c8df67-64c9-42a3-abff-8047dd23748b'::uuid,
    '9d209ef6-ca87-44d4-a12c-86f12a0ea368'::uuid,
    10
  );
  raise exception 'PROBE: el ciclo debería haberse rechazado y no se rechazó';
exception
  when others then
    if sqlerrm not like '%would create a cycle%' then
      raise exception 'PROBE: rechazo inesperado en ciclo: %', sqlerrm;
    end if;
    raise notice 'PROBE OK: ciclo rechazado (%)', sqlerrm;
end;
$sonda_ciclo$;
rollback to savepoint sp_ciclo;

-- 7) Negativo: porcentaje fuera de rango.
savepoint sp_rango;
do $sonda_rango$
begin
  perform fn_secretaria_actualizar_estructura_grupo(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '9d209ef6-ca87-44d4-a12c-86f12a0ea368'::uuid,
    '45c8df67-64c9-42a3-abff-8047dd23748b'::uuid,
    150
  );
  raise exception 'PROBE: el porcentaje fuera de rango debería haberse rechazado y no se rechazó';
exception
  when others then
    if sqlerrm not like '%between 0 and 100%' then
      raise exception 'PROBE: rechazo inesperado en rango: %', sqlerrm;
    end if;
    raise notice 'PROBE OK: porcentaje fuera de rango rechazado (%)', sqlerrm;
end;
$sonda_rango$;
rollback to savepoint sp_rango;

-- 8) Negativo: un rol sin permiso (CONSEJERO) no puede editar la estructura.
savepoint sp_rol;
select set_config(
  'request.jwt.claims',
  json_build_object('tenant_id', '00000000-0000-0000-0000-000000000003', 'role_code', 'CONSEJERO')::text,
  true
);
do $sonda_rol$
begin
  perform fn_secretaria_actualizar_estructura_grupo(
    '00000000-0000-0000-0000-000000000003'::uuid,
    '9d209ef6-ca87-44d4-a12c-86f12a0ea368'::uuid,
    '45c8df67-64c9-42a3-abff-8047dd23748b'::uuid,
    70
  );
  raise exception 'PROBE: CONSEJERO debería haber sido rechazado y no lo fue';
exception
  when others then
    if sqlerrm not like '%not allowed for this Secretaria action%' then
      raise exception 'PROBE: rechazo inesperado por rol: %', sqlerrm;
    end if;
    raise notice 'PROBE OK: rol sin permiso rechazado (%)', sqlerrm;
end;
$sonda_rol$;
rollback to savepoint sp_rol;
select set_config(
  'request.jwt.claims',
  json_build_object('tenant_id', '00000000-0000-0000-0000-000000000003', 'role_code', 'SECRETARIO')::text,
  true
);

-- 9) Negativo: aislamiento de tenant. La sesión es Grupo Nuevo; pedir el
--    cambio pasando el tenant de ARGA se rechaza antes de tocar ninguna fila.
savepoint sp_tenant_cruzado;
do $sonda_tenant$
begin
  perform fn_secretaria_actualizar_estructura_grupo(
    '00000000-0000-0000-0000-000000000001'::uuid,
    '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid,
    null,
    null
  );
  raise exception 'PROBE: el tenant cruzado debería haberse rechazado y no se rechazó';
exception
  when others then
    if sqlerrm not like '%tenant access denied%' then
      raise exception 'PROBE: rechazo inesperado por tenant cruzado: %', sqlerrm;
    end if;
    raise notice 'PROBE OK: tenant cruzado rechazado (%)', sqlerrm;
end;
$sonda_tenant$;
rollback to savepoint sp_tenant_cruzado;

-- 10) Control positivo del dato: ARGA no se ha tocado en ningún momento de
--     este ensayo (ni por el positivo ni por los cinco rechazos).
do $control_arga$
declare
  v_parent uuid;
  v_pct numeric;
begin
  select parent_entity_id, ownership_percentage into v_parent, v_pct
    from public.entities where id = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
  if v_parent is not null or v_pct is not null then
    raise exception 'PROBE: ARGA Seguros cambió de matriz/porcentaje durante el ensayo (matriz=%, pct=%)', v_parent, v_pct;
  end if;
  raise notice 'PROBE OK: ARGA Seguros S.A. conserva parent_entity_id/ownership_percentage a NULL (cadena de capital vive fuera de entities)';
end;
$control_arga$;

-- 11) Deshace todo: la migración, el reaparentado positivo, y cualquier otro
--     efecto de este ensayo (los rechazos ya se deshicieron por savepoint).
rollback;
