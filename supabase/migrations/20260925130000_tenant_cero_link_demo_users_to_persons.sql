-- Las dos cuentas demo del tenant Grupo Nuevo (tenant-cero) pasan a estar
-- enlazadas a una persona del censo (`user_profiles.person_id`).
--
-- POR QUÉ (MOI-133). Congelar y revisar una evaluación de IA exige dos personas
-- distintas (`fn_aims_review_assessment` rechaza MISMO_EVALUADOR) y la custodia
-- del informe muestra quién congeló y quién revisó. Además, el saludo del shell
-- corporativo muestra el nombre real de la persona física.
--
-- QUIÉN:
--   admin@grupo-nuevo-demo.dev (ADMIN_TENANT) → Carlos Mendoza Ruiz (Presidente del Consejo)
--   demo@grupo-nuevo-demo.dev  (SECRETARIO)   → Elena Gómez Blanco (Secretaria no consejera)
--
-- Idempotente y acotada: sólo escribe donde `person_id` es NULL, sólo en el
-- tenant …0003, y verifica que ARGA y Garrigues permanecen 100% intactos.

update public.user_profiles p
   set person_id = '608f8eaf-6335-4102-96f4-a412974d5079'
  from auth.users u
 where u.id = p.user_id
   and u.email = 'admin@grupo-nuevo-demo.dev'
   and p.tenant_id = '00000000-0000-0000-0000-000000000003'
   and p.person_id is null;

update public.user_profiles p
   set person_id = '0ed63079-0422-4cb1-b50a-bb38fa5da725'
  from auth.users u
 where u.id = p.user_id
   and u.email = 'demo@grupo-nuevo-demo.dev'
   and p.tenant_id = '00000000-0000-0000-0000-000000000003'
   and p.person_id is null;

do $verificacion$
declare
  v_tenant uuid := '00000000-0000-0000-0000-000000000003';
  v_personas uuid[] := array['608f8eaf-6335-4102-96f4-a412974d5079'::uuid, '0ed63079-0422-4cb1-b50a-bb38fa5da725'::uuid];
  v_enlazados int;
  v_distintos int;
  v_del_tenant int;
  v_arga uuid;
  v_garr_enlazados int;
begin
  select count(*), count(distinct p.person_id) into v_enlazados, v_distintos
    from public.user_profiles p join auth.users u on u.id = p.user_id
   where p.tenant_id = v_tenant
     and u.email in ('admin@grupo-nuevo-demo.dev', 'demo@grupo-nuevo-demo.dev')
     and p.person_id = any(v_personas);
  if v_enlazados <> 2 or v_distintos <> 2 then
    raise exception 'VERIFICACION: se esperaban 2 perfiles de Grupo Nuevo enlazados a 2 personas distintas; hay % / %', v_enlazados, v_distintos;
  end if;

  select count(*) into v_del_tenant from public.persons
   where id = any(v_personas) and tenant_id = v_tenant and person_type = 'PF';
  if v_del_tenant <> 2 then
    raise exception 'VERIFICACION: las 2 personas deben ser PF del tenant Grupo Nuevo; el instrumento ve %', v_del_tenant;
  end if;

  -- Control ARGA: cero cambio. El único perfil de ARGA sigue enlazado a la
  -- misma persona que el 2026-09-14.
  select p.person_id into v_arga from public.user_profiles p
   where p.tenant_id = '00000000-0000-0000-0000-000000000001';
  if v_arga is distinct from 'f8b64324-a19d-4050-98c2-8e34cff52087'::uuid then
    raise exception 'VERIFICACION: el perfil de ARGA cambió (%): cero-cambio ARGA roto', v_arga;
  end if;

  -- Control Garrigues: dos perfiles intactos.
  select count(*) into v_garr_enlazados
    from public.user_profiles p
   where p.tenant_id = '00000000-0000-0000-0000-000000000002'
     and p.person_id in ('b46860a9-04ce-4f51-ac38-fb6b33ac0912'::uuid, '60fc2337-d6cc-4ea5-8e6c-a23d8e5b09cc'::uuid);
  if v_garr_enlazados <> 2 then
    raise exception 'VERIFICACION: los perfiles de Garrigues cambiaron: cero-cambio Garrigues roto';
  end if;

  raise notice 'VERIFICACION OK: 2 perfiles demo de Grupo Nuevo enlazados a Carlos Mendoza Ruiz y Elena Gómez Blanco; ARGA y Garrigues intactos';
end;
$verificacion$;
