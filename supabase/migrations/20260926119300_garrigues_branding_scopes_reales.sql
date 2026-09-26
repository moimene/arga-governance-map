-- MOI-193: siembra `tenants.branding->scopes` del tenant Garrigues (…0002)
-- con sus jurisdicciones reales, derivadas de la única fuente de verdad del
-- perímetro societario (`scripts/garrigues/entities-catalog.ts`, G1).
--
-- POR QUÉ. `scopesForTenant` (`src/lib/tenant-scopes.ts:10-19`) usa
-- `branding.scopes` cuando existe; sin esa clave, Garrigues solo ve un ámbito
-- "(Global)" y el selector no filtra nada. `branding` de Garrigues nunca ha
-- tenido la clave `scopes` (comprobado 2026-09-26).
--
-- LISTA Y PROCEDENCIA (2026-09-26, `scripts/garrigues/entities-catalog.ts`,
-- 33 entidades, campo `jurisdiction`; recuento exacto, sin inventar ningún
-- ámbito). Cada jurisdicción distinta presente en el catálogo, ordenada por
-- número de entidades (desc.) y luego alfabéticamente; "(Global)" antepuesto
-- siguiendo el patrón de `src/data/scopes.ts` para ARGA:
--   España         16   ES
--   México          3   MX
--   Chile           3   CL
--   Portugal        2   PT
--   Colombia        2   CO
--   Reino Unido     1   UK
--   Estados Unidos  1   US
--   Marruecos       1   MA
--   Polonia         1   PL
--   Perú            1   PE
--   Bélgica         1   BE
--   China           1   CN
-- Total 33 = suma de entidades del catálogo (control de cuadre externo, no
-- verificable desde SQL: ver `arga_visible_changes`/`open_points` del agente).
--
-- ⚠️ DISCREPANCIA DECLARADA Y SIN RESOLVER (issue MOI-193, puerta humana
-- pendiente): CLAUDE.md (§G1) habla de "8 ámbitos" para Garrigues, pero el
-- catálogo tiene 12 jurisdicciones distintas. Esta lista es la PROPUESTA
-- del agente derivada mecánicamente del catálogo (un ámbito = una
-- jurisdicción con al menos una entidad, sin agrupar por región como hace
-- ARGA con "LATAM"/"Europa" porque agrupar sería inventar un criterio no
-- verificado). Moisés debe validarla (con el equipo legal si lo desea) antes
-- de autorizar la aplicación en producción — ver Puerta humana del issue.
--
-- CÓMO. `jsonb_set` aditivo sobre la clave `scopes` únicamente: no toca
-- `modules`, `nombre`, `scope_label`, `shell_label`, `sii_org_label` ni
-- `tokens`, que ya existen en `branding` de Garrigues. Idempotente (el WHERE
-- evita reescrituras si ya vale lo mismo) y acotada al tenant …0002. ARGA
-- (`branding` NULL en …0001) no se toca.

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

  -- Control positivo del propio instrumento: las otras 5 claves de branding
  -- siguen presentes e intactas — jsonb_set aditivo, no reemplazo del objeto.
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

  -- Control ARGA: cero cambio. branding sigue NULL.
  select branding into v_arga_branding from public.tenants where id = v_arga;
  if v_arga_branding is not null then
    raise exception 'VERIFICACION: branding de ARGA dejó de ser NULL: cero-cambio ARGA roto (%)', v_arga_branding;
  end if;

  raise notice 'VERIFICACION OK: Garrigues tiene 13 ámbitos reales en branding.scopes, las otras 6 claves de branding intactas, ARGA sigue con branding NULL';
end;
$verificacion$;
