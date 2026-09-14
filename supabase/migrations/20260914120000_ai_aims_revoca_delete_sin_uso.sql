-- DELETE fuera de `authenticated` en las siete tablas de IA donde el producto
-- no borra nada.
--
-- MEDIDO el 2026-09-14 (sonda en BEGIN…ROLLBACK como demo@garrigues-demo.dev):
-- tres llamadas PostgREST bastaban para dejar el tenant sin dato de IA
-- (DELETE ai_compliance_checks → 12 filas, ai_risk_assessments → 1,
-- ai_systems → 1), y el borrado del sistema arrastra en cascada el cuestionario
-- «inmutable» (su trigger es sólo BEFORE UPDATE). `authenticated` conservaba
-- DELETE en ocho tablas por los privilegios por defecto del esquema y ninguna
-- pantalla ni hook lo usa (0 `.delete(` en src/hooks, src/pages y
-- src/components del módulo). La orden vigente es que el dato de Garrigues
-- PERSISTE: un camino abierto para borrarlo desde cualquier cliente es un
-- defecto aunque nadie lo pise.
--
-- `ai_systems` CONSERVA DELETE a propósito y se declara: las dos sondas vivas
-- del módulo (aims-cuestionario-live, garrigues-ia-owner-write) crean un
-- sistema PROBE por tenant y lo borran al terminar, y el cascade al
-- cuestionario existe precisamente para eso (ledger 2026-09-08, D-11). La RLS
-- lo acota al tenant y el gate `frontera-backbone` vigila que ningún hook lo
-- llame. Retirarlo obligaría a limpiar con service_role dentro del runner, que
-- este proyecto no hace (memoria: vitest+service_role borró dato real en W3).
--
-- `aims_evidence_items` y `aims_classification_questionnaires` nacieron sin
-- DELETE (20260907190000, 20260908120000): no se tocan, se verifican.
--
-- Lista ENUMERADA, no LIKE.

revoke delete on table public.ai_incidents from authenticated;
revoke delete on table public.ai_risk_assessments from authenticated;
revoke delete on table public.ai_compliance_checks from authenticated;
revoke delete on table public.aims_system_versions from authenticated;
revoke delete on table public.aims_incident_regimes from authenticated;
revoke delete on table public.aims_monitoring_indicators from authenticated;
revoke delete on table public.aims_technical_file_sections from authenticated;

do $verificacion$
declare
  v_sin_delete text[] := array[
    'ai_incidents', 'ai_risk_assessments', 'ai_compliance_checks',
    'aims_system_versions', 'aims_incident_regimes', 'aims_monitoring_indicators',
    'aims_technical_file_sections', 'aims_evidence_items', 'aims_classification_questionnaires'];
  v_existentes int;
  v_delete int;
  v_control_insert int;
  v_control_ai_systems int;
begin
  -- Universo cerrado: si una tabla desapareció, la verificación no pasa por silencio.
  select count(*) into v_existentes from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
     and table_name = any(v_sin_delete || array['ai_systems']);
  if v_existentes <> 10 then
    raise exception 'VERIFICACION: se esperaban 10 tablas, existen %', v_existentes;
  end if;

  select count(*) into v_delete from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type = 'DELETE' and table_name = any(v_sin_delete);
  if v_delete <> 0 then
    raise exception 'VERIFICACION: authenticated conserva DELETE sobre % tablas de IA sin camino de borrado', v_delete;
  end if;

  -- Control positivo 1: lo que DEBE quedar sigue estando. Un revoke de más
  -- (INSERT, por ejemplo) rompería el alta de incidentes y pasaría igual sin esto.
  select count(*) into v_control_insert from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type = 'INSERT' and table_name = any(v_sin_delete[1:7]);
  if v_control_insert <> 7 then
    raise exception 'VERIFICACION: el INSERT de authenticated debe quedar en las 7 tablas y el instrumento ve %', v_control_insert;
  end if;

  -- Control positivo 2: el instrumento ve el DELETE que se conserva a propósito.
  select count(*) into v_control_ai_systems from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type = 'DELETE' and table_name = 'ai_systems';
  if v_control_ai_systems <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve el DELETE de authenticated sobre ai_systems, que se conserva y se declara';
  end if;

  raise notice 'VERIFICACION OK: 7 tablas sin DELETE para authenticated; ai_systems lo conserva (declarado); INSERT intacto';
end;
$verificacion$;
