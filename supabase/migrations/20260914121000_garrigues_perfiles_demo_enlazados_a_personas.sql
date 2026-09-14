-- Las dos cuentas demo del tenant Garrigues pasan a estar enlazadas a una
-- persona del censo (`user_profiles.person_id`).
--
-- POR QUÉ. Congelar y revisar una evaluación de IA exige dos personas distintas
-- (`fn_aims_review_assessment` rechaza MISMO_EVALUADOR) y la custodia del
-- informe muestra quién congeló y quién revisó. MEDIDO el 2026-09-14: los dos
-- perfiles de Garrigues tenían `person_id` NULL, así que la custodia sólo podía
-- pintar identificadores. El usuario decidió el 2026-09-14 enlazarlos «por
-- usabilidad y máxima apariencia de realismo».
--
-- QUIÉN. Dos miembros VIGENTES del Comité de Gobernanza de la Inteligencia
-- Artificial (`garrigues-comite-gobernanza-ia`, el órgano que la G4 acreditó
-- como responsable de PI-30), elegidos por orden alfabético y sin atribuirles
-- ningún cargo:
--   admin@garrigues-demo.dev (ADMIN_TENANT) → Alejandro Padín Vidal
--   demo@garrigues-demo.dev  (SECRETARIO)   → Isabel Redel
-- Los datos de personas vienen de fuente pública (G2); la cuenta demo es
-- ficticia. Es dato DEMO y no afirma que esas personas usen la aplicación.
--
-- Idempotente y acotada: sólo escribe donde `person_id` es NULL, sólo en el
-- tenant …0002, y aborta si el perfil de ARGA se mueve un milímetro.

update public.user_profiles p
   set person_id = 'b46860a9-04ce-4f51-ac38-fb6b33ac0912'
  from auth.users u
 where u.id = p.user_id
   and u.email = 'admin@garrigues-demo.dev'
   and p.tenant_id = '00000000-0000-0000-0000-000000000002'
   and p.person_id is null;

update public.user_profiles p
   set person_id = '60fc2337-d6cc-4ea5-8e6c-a23d8e5b09cc'
  from auth.users u
 where u.id = p.user_id
   and u.email = 'demo@garrigues-demo.dev'
   and p.tenant_id = '00000000-0000-0000-0000-000000000002'
   and p.person_id is null;

do $verificacion$
declare
  v_garr uuid := '00000000-0000-0000-0000-000000000002';
  v_comite uuid := '432e420b-4db1-44f1-81da-e3575b1d3dec';
  v_personas uuid[] := array['b46860a9-04ce-4f51-ac38-fb6b33ac0912', '60fc2337-d6cc-4ea5-8e6c-a23d8e5b09cc'];
  v_enlazados int;
  v_distintos int;
  v_del_tenant int;
  v_vigentes int;
  v_arga uuid;
begin
  select count(*), count(distinct p.person_id) into v_enlazados, v_distintos
    from public.user_profiles p join auth.users u on u.id = p.user_id
   where p.tenant_id = v_garr
     and u.email in ('admin@garrigues-demo.dev', 'demo@garrigues-demo.dev')
     and p.person_id = any(v_personas);
  if v_enlazados <> 2 or v_distintos <> 2 then
    raise exception 'VERIFICACION: se esperaban 2 perfiles de Garrigues enlazados a 2 personas distintas; hay % / %', v_enlazados, v_distintos;
  end if;

  select count(*) into v_del_tenant from public.persons
   where id = any(v_personas) and tenant_id = v_garr and person_type = 'PF';
  if v_del_tenant <> 2 then
    raise exception 'VERIFICACION: las 2 personas deben ser PF del tenant Garrigues; el instrumento ve %', v_del_tenant;
  end if;

  select count(*) into v_vigentes from public.condiciones_persona
   where body_id = v_comite and estado = 'VIGENTE' and person_id = any(v_personas);
  if v_vigentes <> 2 then
    raise exception 'VERIFICACION: las 2 personas deben ser miembros vigentes del Comité de Gobernanza de la IA; hay %', v_vigentes;
  end if;

  -- Control ARGA: cero cambio. El único perfil de ARGA sigue enlazado a la
  -- misma persona que el 2026-09-14.
  select p.person_id into v_arga from public.user_profiles p
   where p.tenant_id = '00000000-0000-0000-0000-000000000001';
  if v_arga is distinct from 'f8b64324-a19d-4050-98c2-8e34cff52087'::uuid then
    raise exception 'VERIFICACION: el perfil de ARGA cambió (%): cero-cambio ARGA roto', v_arga;
  end if;

  raise notice 'VERIFICACION OK: 2 perfiles demo de Garrigues enlazados a 2 miembros del Comité de Gobernanza de la IA; ARGA intacta';
end;
$verificacion$;
