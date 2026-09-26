-- 20260926115200_grc_modulo_ia_grupo_nuevo.sql
--
-- MOI-152 — Decisión D-13 (por delegación, autorizada por Moisés): el grupo
-- nuevo (`…0003`) nace con el módulo de IA de GRC, mismo patrón que ARGA y
-- Garrigues (`20260920130000_grc_modulo_ia_y_rama_ria.sql`, que creó `ai` en
-- `…0001`/`…0002` y abortaba EXPLÍCITAMENTE si alguien lo creaba en `…0003`
-- porque en ese momento era "de otra sesión"). Esa condición ya no aplica:
-- el trabajo del grupo nuevo está guardado en git (MOI-126, Done) y esta
-- migración es la decisión explícita, no un descuido.
--
-- QUÉ HACE, Y QUÉ NO
-- ------------------
--   * Crea `grc_modules(tenant_id='…0003', id='ai')`, aditivo e idempotente
--     (`on conflict do nothing`), con `tenant_id` EXPLÍCITO — el grupo nuevo
--     no tiene DEFAULT de tenant y un INSERT sin él contaminaría ARGA.
--   * `owner = 'Pendiente de designación'`, igual que los otros 6 módulos
--     genéricos del grupo (medido: `audit`, `cyber`, `ethics`, `gdpr`, `risk`,
--     `tprm`, los 6 con ese mismo owner). Si MOI-150 llega a declarar un
--     órgano de gobierno de la IA propio del grupo, ese dato lo actualiza él,
--     no esta migración.
--   * `name`/`description` iguales a los de `scripts/tenants/tenant-spec.ts`
--     (`GRC_MODULES_GENERICOS`), para que un futuro `tenant-bootstrap --commit`
--     de un cuarto grupo no diverja del dato ya sembrado aquí a mano.
--   * `state`/`route`/`regulations` se dejan en su DEFAULT de tabla
--     ('Planificado', NULL, '[]'), igual que los 6 módulos ya existentes del
--     grupo: el bootstrap tampoco los fija (medido en `scripts/tenant-bootstrap.ts`).
--   * NO toca `fn_sync_obligation_to_backbone` (ya tiene la rama `OBL-RIA-%`
--     -> 'ai' desde `20260920130000`; el fallback a `risk` para tenants sin el
--     módulo sigue vivo para el resto de códigos que `…0003` no cubre).
--   * NO siembra ninguna obligación `OBL-RIA-*`: eso es MOI-176 (F6.T2), que
--     no ha empezado. El grupo nuevo queda con el módulo listo y 0 filas en
--     él, igual que sus otros 6 módulos genéricos.
--   * NO toca ARGA (`…0001`) ni Garrigues (`…0002`): verificado abajo.
--
-- Ensayo previo: sonda revertida en `supabase/migrations/proposed/` con
-- control positivo (INSERT + ROLLBACK) antes de aplicar.

begin;

insert into public.grc_modules (tenant_id, id, name, description, owner)
values (
  '00000000-0000-0000-0000-000000000003',
  'ai',
  'Gobernanza de la IA',
  'Obligaciones de organización del Reglamento (UE) 2024/1689 (RIA): alfabetización, gestión de la calidad y protocolos de uso. El inventario de sistemas y su clasificación viven en el módulo de IA.',
  'Pendiente de designación'
)
on conflict (tenant_id, id) do nothing;

-- Verificación que ABORTA, con control positivo del propio instrumento.
do $verificacion$
declare
  v_total_nuevo int;
  v_ai_nuevo int;
  v_ai_otros int;
  v_owner text;
  v_modulo text;
begin
  -- V1: el módulo existe en el grupo nuevo.
  select count(*) into v_ai_nuevo from public.grc_modules
   where tenant_id = '00000000-0000-0000-0000-000000000003' and id = 'ai';
  if v_ai_nuevo <> 1 then
    raise exception 'V1: se esperaba 1 fila del módulo ai en …0003 y hay %', v_ai_nuevo;
  end if;

  select owner into v_owner from public.grc_modules
   where tenant_id = '00000000-0000-0000-0000-000000000003' and id = 'ai';
  if v_owner <> 'Pendiente de designación' then
    raise exception 'V2: owner inesperado en …0003/ai: %', v_owner;
  end if;

  -- V3: el grupo nuevo sigue teniendo exactamente sus 6 módulos previos + ai = 7.
  select count(*) into v_total_nuevo from public.grc_modules
   where tenant_id = '00000000-0000-0000-0000-000000000003';
  if v_total_nuevo <> 7 then
    raise exception 'V3: se esperaban 7 módulos en …0003 (6 previos + ai) y hay %', v_total_nuevo;
  end if;

  -- V4: ARGA y Garrigues intactos — esta migración no los toca.
  select count(*) into v_ai_otros from public.grc_modules
   where id = 'ai' and tenant_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
  if v_ai_otros <> 2 then
    raise exception 'V4: ARGA/Garrigues deberían seguir con 2 filas de ai (una cada uno) y hay %', v_ai_otros;
  end if;

  -- V5, control positivo REVERTIDO: una OBL-RIA-* en …0003 ya resuelve a
  -- 'ai' (no cae a 'risk'), gracias al módulo recién creado. Se prueba y se
  -- deshace en la misma transacción con el truco de excepción-como-savepoint
  -- (mismo patrón que 20260920130000): el INSERT dispara el trigger, se lee
  -- el resultado, y se relanza para forzar el rollback de ese INSERT sin
  -- abortar la migración.
  begin
    insert into public.obligations (tenant_id, code, title)
    values ('00000000-0000-0000-0000-000000000003', 'OBL-RIA-VERIF', 'control positivo de la migración (MOI-152)');
    select module_id into v_modulo from public.grc_obligations
     where tenant_id = '00000000-0000-0000-0000-000000000003' and reference = 'OBL-RIA-VERIF';
    raise exception 'REVERTIR:%', coalesce(v_modulo, '(sin fila)');
  exception when others then
    if sqlerrm <> 'REVERTIR:ai' then
      raise exception 'V5: en …0003 la obligación del RIA no cayó en ai -> %', sqlerrm;
    end if;
  end;

  -- V6: el control positivo de verdad se deshizo (no queda residuo).
  if exists (select 1 from public.obligations where tenant_id = '00000000-0000-0000-0000-000000000003' and code = 'OBL-RIA-VERIF') then
    raise exception 'V6: quedó residuo del control positivo en obligations';
  end if;

  raise notice 'MOI-152 OK: módulo ai en …0003 (7 módulos), ARGA/Garrigues intactos, OBL-RIA-%% -> ai verificado y revertido';
end $verificacion$;

commit;
