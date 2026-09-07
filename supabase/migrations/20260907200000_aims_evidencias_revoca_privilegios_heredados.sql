-- Retira de `aims_evidence_items` los privilegios que NO se concedieron.
--
-- LO MEDIDO
-- ---------
-- La migración `20260907190000` concedió `select, insert, update` a
-- `authenticated` y no creó política de DELETE, a propósito: una evidencia
-- registrada no se borra desde la aplicación (se desvincula de la medida, que
-- es distinto y ya está soportado). Pero el `ALTER DEFAULT PRIVILEGES` del
-- esquema `public` de Supabase le había dado ya **DELETE, TRUNCATE, REFERENCES
-- y TRIGGER**, y un `grant` es aditivo: no quita nada.
--
-- Lo cazó la sonda de aislamiento intentando borrar y no recibiendo error.
--
-- POR QUÉ IMPORTA AUNQUE LA RLS BLOQUEE EL DELETE
-- -----------------------------------------------
-- El DELETE sí lo filtra la RLS (a cero filas, sin error). **TRUNCATE NO PASA
-- POR RLS**: con el privilegio puesto, una sola sentencia vacía la tabla de
-- TODOS los tenants. No es alcanzable vía PostgREST, así que no es una fuga
-- abierta — es una trampa cargada, exactamente la misma que se retiró el
-- 2026-09-06 de `rule_pack_versions`, `pack_rules`, `jurisdiction_rule_sets`,
-- `registry_filings` y `user_profiles`.

revoke delete, truncate, references, trigger on public.aims_evidence_items from authenticated;
revoke all on public.aims_evidence_items from anon;

do $verificacion$
declare
  v_sobrantes text;
  v_necesarios int;
  v_anon int;
  v_instrumento int;
begin
  select string_agg(privilege_type, ', ' order by privilege_type) into v_sobrantes
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_evidence_items'
     and grantee = 'authenticated'
     and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if v_sobrantes is not null then
    raise exception 'VERIFICACION: authenticated conserva %', v_sobrantes;
  end if;

  -- Y lo que SÍ hace falta sigue ahí: revocar de más dejaría el módulo mudo.
  select count(*) into v_necesarios
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_evidence_items'
     and grantee = 'authenticated'
     and privilege_type in ('SELECT', 'INSERT', 'UPDATE');
  if v_necesarios <> 3 then
    raise exception 'VERIFICACION: authenticated ha perdido privilegios necesarios (% de 3)', v_necesarios;
  end if;

  select count(*) into v_anon
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_evidence_items' and grantee = 'anon';
  if v_anon <> 0 then
    raise exception 'VERIFICACION: anon conserva % privilegios', v_anon;
  end if;

  -- Control positivo del instrumento.
  select count(*) into v_instrumento
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'tabla_que_no_existe_jamas';
  if v_instrumento <> 0 then
    raise exception 'VERIFICACION: el instrumento encuentra lo que no existe';
  end if;

  raise notice 'VERIFICACION OK: authenticated con SELECT/INSERT/UPDATE y sin DELETE/TRUNCATE; anon sin nada';
end;
$verificacion$;
