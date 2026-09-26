-- Ensayo revertido de 20260926119300_garrigues_branding_scopes_reales.sql
-- (MOI-193). Aplica la migración dentro de una transacción, comprueba el
-- resultado y deshace todo con rollback. No debe ejecutarse fuera de un
-- ensayo autorizado por el orquestador.

begin;

update public.tenants
   set branding = jsonb_set(
         branding,
         '{scopes}',
         '["Grupo Garrigues (Global)", "España", "México", "Chile", "Portugal", "Colombia", "Reino Unido", "Estados Unidos", "Marruecos", "Polonia", "Perú", "Bélgica", "China"]'::jsonb,
         true
       )
 where id = '00000000-0000-0000-0000-000000000002'
   and branding->'scopes' is distinct from
       '["Grupo Garrigues (Global)", "España", "México", "Chile", "Portugal", "Colombia", "Reino Unido", "Estados Unidos", "Marruecos", "Polonia", "Perú", "Bélgica", "China"]'::jsonb;

do $verificacion$
declare
  v_garr uuid := '00000000-0000-0000-0000-000000000002';
  v_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_scopes jsonb;
  v_modules jsonb;
  v_nombre jsonb;
  v_scope_label jsonb;
  v_shell_label jsonb;
  v_sii_org_label jsonb;
  v_tokens jsonb;
  v_arga_branding jsonb;
  v_claves int;
begin
  select branding->'scopes', branding->'modules', branding->'nombre',
         branding->'scope_label', branding->'shell_label',
         branding->'sii_org_label', branding->'tokens'
    into v_scopes, v_modules, v_nombre, v_scope_label, v_shell_label,
         v_sii_org_label, v_tokens
    from public.tenants where id = v_garr;

  if v_scopes is null or jsonb_array_length(v_scopes) <> 13 then
    raise exception 'VERIFICACION: branding.scopes de Garrigues debe tener 13 elementos (12 jurisdicciones + Global); tiene %', coalesce(jsonb_array_length(v_scopes), -1);
  end if;
  if v_scopes->0 <> '"Grupo Garrigues (Global)"'::jsonb then
    raise exception 'VERIFICACION: el primer ámbito debe ser "Grupo Garrigues (Global)"; es %', v_scopes->0;
  end if;
  if not (v_scopes @> '["España"]'::jsonb) then
    raise exception 'VERIFICACION: España debe estar en los ámbitos de Garrigues (16 entidades del catálogo)';
  end if;

  if v_modules is null or v_nombre is null or v_scope_label is null
     or v_shell_label is null or v_sii_org_label is null or v_tokens is null then
    raise exception 'VERIFICACION: jsonb_set pisó otras claves de branding de Garrigues (modules/nombre/scope_label/shell_label/sii_org_label/tokens)';
  end if;
  if v_nombre <> '"Garrigues"'::jsonb or v_scope_label <> '"Grupo Garrigues"'::jsonb then
    raise exception 'VERIFICACION: nombre/scope_label de Garrigues cambiaron de valor (nombre=%, scope_label=%)', v_nombre, v_scope_label;
  end if;

  select count(*) into v_claves from jsonb_object_keys(
    (select branding from public.tenants where id = v_garr)
  ) k;
  if v_claves <> 7 then
    raise exception 'VERIFICACION: branding de Garrigues debe tener 7 claves (6 previas + scopes); tiene %', v_claves;
  end if;

  select branding into v_arga_branding from public.tenants where id = v_arga;
  if v_arga_branding is not null then
    raise exception 'VERIFICACION: branding de ARGA dejó de ser NULL: cero-cambio ARGA roto (%)', v_arga_branding;
  end if;

  raise notice 'VERIFICACION OK: Garrigues tiene 13 ámbitos reales en branding.scopes, las otras 6 claves de branding intactas, ARGA sigue con branding NULL';
end;
$verificacion$;

-- Comprobación de lectura adicional para el orquestador (visible en el output
-- del ensayo antes del rollback):
select id, branding->'scopes' as scopes_propuestos, jsonb_object_keys(branding) as claves_branding
  from public.tenants
 where id = '00000000-0000-0000-0000-000000000002';

rollback;
