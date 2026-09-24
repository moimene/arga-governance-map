-- MOI-205: Revocación de privilegios residuales TRUNCATE, TRIGGER y REFERENCES
-- sobre todas las tablas del esquema public para los roles anon y authenticated,
-- y actualización de privilegios por defecto para tablas futuras del rol postgres.
--
-- MOTIVACIÓN:
-- TRUNCATE no pasa por RLS ni por triggers de fila. Aunque PostgREST no lo expone
-- y hoy no es alcanzable desde la interfaz de usuario, los roles de conexión
-- (anon y authenticated) conservaban este privilegio heredado del ALTER DEFAULT PRIVILEGES
-- original de Supabase sobre 127/128 tablas de public.
--
-- Asimismo, TRIGGER y REFERENCES son privilegios de DDL que no corresponden a roles
-- de aplicación cliente.
--
-- NOTA SOBRE TABLAS FUTURAS:
-- Se actualizan los privilegios por defecto para el rol `postgres` en `public`.
-- El rol `supabase_admin` no permite modificar sus privilegios por defecto desde
-- `postgres` (permission denied 42501, documentado en 20260516120004_f2_g2_g19_revoke_public_execute.sql:122-148).
-- Toda tabla creada en migraciones ejecutadas por `postgres` nace blindada sin TRUNCATE, TRIGGER ni REFERENCES.

-- 1. Revocación en todas las tablas existentes en public
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2. Alteración de privilegios por defecto para el rol postgres en public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- 3. Bloque de verificación y controles positivos
DO $verificacion$
declare
  v_residuales int;
  v_default_residuales int;
  v_control_select_agreements int;
  v_control_insert_convocatorias int;
  v_control_select_entities int;
  v_probe_residuales int;
begin
  -- Verificación 1: Ninguna tabla existente en public conserva TRUNCATE, TRIGGER ni REFERENCES
  select count(*) into v_residuales
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  if v_residuales <> 0 then
    raise exception 'VERIFICACION MOI-205: quedan % privilegios residuales de TRUNCATE/TRIGGER/REFERENCES en public', v_residuales;
  end if;

  -- Verificación 2: pg_default_acl para postgres no incluye TRUNCATE, TRIGGER ni REFERENCES para anon ni authenticated
  select count(*) into v_default_residuales
  from pg_default_acl a,
       aclexplode(a.defaclacl) x
  where a.defaclnamespace = 'public'::regnamespace
    and a.defaclrole = 'postgres'::regrole
    and a.defaclobjtype = 'r'
    and x.grantee = any (array['anon'::regrole, 'authenticated'::regrole])
    and x.privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  if v_default_residuales <> 0 then
    raise exception 'VERIFICACION MOI-205: pg_default_acl para postgres sigue conteniendo % privilegios residuales', v_default_residuales;
  end if;

  -- Verificación 3: Ensayo con tabla nueva creada por postgres en public
  execute 'create table public.__test_probe_moi205 (id int)';
  
  select count(*) into v_probe_residuales
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = '__test_probe_moi205'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');

  execute 'drop table public.__test_probe_moi205';

  if v_probe_residuales <> 0 then
    raise exception 'VERIFICACION MOI-205: una tabla nueva heredó % privilegios de TRUNCATE/TRIGGER/REFERENCES', v_probe_residuales;
  end if;

  -- Verificación 4: Controles positivos de SELECT e INSERT de authenticated
  select count(*) into v_control_select_agreements
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'agreements'
    and grantee = 'authenticated' and privilege_type = 'SELECT';

  if v_control_select_agreements < 1 then
    raise exception 'VERIFICACION MOI-205: authenticated perdió SELECT sobre agreements';
  end if;

  select count(*) into v_control_insert_convocatorias
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'convocatorias'
    and grantee = 'authenticated' and privilege_type = 'INSERT';

  if v_control_insert_convocatorias < 1 then
    raise exception 'VERIFICACION MOI-205: authenticated perdió INSERT sobre convocatorias';
  end if;

  select count(*) into v_control_select_entities
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'entities'
    and grantee = 'authenticated' and privilege_type = 'SELECT';

  if v_control_select_entities < 1 then
    raise exception 'VERIFICACION MOI-205: authenticated perdió SELECT sobre entities';
  end if;

  raise notice 'VERIFICACION MOI-205 OK: 0 residuales, default privileges blindados y probados, controles positivos confirmados';
end;
$verificacion$;
