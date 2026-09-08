-- Privilegios heredados del backbone de IA: `anon` fuera, TRUNCATE fuera, y
-- sin escritura de `authenticated` donde el producto no escribe.
--
-- MEDIDO el 2026-09-08 (information_schema.role_table_grants): `anon` tenía
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE y UPDATE sobre las
-- cuatro tablas `ai_*` y sobre 24 de las 25 `aims_*` (todas menos
-- `aims_evidence_items`, que nació con revoke explícito el 2026-09-07); y
-- `authenticated` tenía TRUNCATE, REFERENCES y TRIGGER sobre las mismas 28.
--
-- Vienen del ALTER DEFAULT PRIVILEGES del esquema `public` de Supabase. Un
-- `grant` es aditivo y no quita nada. Las políticas son `TO authenticated`,
-- así que `anon` no ve filas por RLS — pero TRUNCATE NO PASA POR RLS: con el
-- privilegio puesto, una sentencia vacía la tabla de todos los tenants. No es
-- alcanzable vía PostgREST (trampa cargada, no fuga abierta), y es la misma que
-- el proyecto ya retiró el 06 y el 07 de otras seis tablas.
--
-- La frontera legacy/backbone del refactor (ledger 2026-09-08, D-1) deja 20
-- tablas `aims_*` sin ningún camino de lectura ni escritura en el producto:
-- se les retira la escritura de `authenticated`. El dato que tienen (ARGA:
-- requirement_catalog 4, requirement_checks 4, control_catalog 2,
-- post_market_plans 1) queda intacto y legible. Las tablas con camino de
-- escritura (ai_*, technical_file_sections, system_versions,
-- monitoring_indicators, incident_regimes) conservan INSERT/UPDATE/DELETE
-- —DELETE lo usa la sonda de owner-write sobre `ai_systems`—.
--
-- `fn_aims_close_technical_file` es SECURITY DEFINER e inalcanzable para
-- `authenticated` (el guard de `evidence_bundles` lo corta) y su botón se
-- retira de la ficha en este mismo refactor: se le quita el EXECUTE.
--
-- Lista ENUMERADA, no LIKE: un patrón adivina el universo, una lista lo fija.

-- anon: fuera de las 28.
revoke all on table public.ai_systems from anon;
revoke all on table public.ai_incidents from anon;
revoke all on table public.ai_risk_assessments from anon;
revoke all on table public.ai_compliance_checks from anon;
revoke all on table public.aims_change_requests from anon;
revoke all on table public.aims_component_inventory from anon;
revoke all on table public.aims_control_catalog from anon;
revoke all on table public.aims_control_tests from anon;
revoke all on table public.aims_dataset_registry from anon;
revoke all on table public.aims_evidence_packs from anon;
revoke all on table public.aims_fria_affected_groups from anon;
revoke all on table public.aims_fria_assessments from anon;
revoke all on table public.aims_fria_dpia_cross_references from anon;
revoke all on table public.aims_fria_fundamental_rights_risks from anon;
revoke all on table public.aims_fria_process_map from anon;
revoke all on table public.aims_fria_remediation_governance from anon;
revoke all on table public.aims_fria_use_profile from anon;
revoke all on table public.aims_incident_evidence_packs from anon;
revoke all on table public.aims_incident_regimes from anon;
revoke all on table public.aims_incident_reports from anon;
revoke all on table public.aims_model_registry from anon;
revoke all on table public.aims_monitoring_indicators from anon;
revoke all on table public.aims_post_market_plans from anon;
revoke all on table public.aims_regulatory_clocks from anon;
revoke all on table public.aims_requirement_catalog from anon;
revoke all on table public.aims_requirement_checks from anon;
revoke all on table public.aims_system_versions from anon;
revoke all on table public.aims_technical_file_sections from anon;

-- authenticated: lo que no pasa por RLS, fuera de las 28.
revoke truncate, references, trigger on table public.ai_systems from authenticated;
revoke truncate, references, trigger on table public.ai_incidents from authenticated;
revoke truncate, references, trigger on table public.ai_risk_assessments from authenticated;
revoke truncate, references, trigger on table public.ai_compliance_checks from authenticated;
revoke truncate, references, trigger on table public.aims_change_requests from authenticated;
revoke truncate, references, trigger on table public.aims_component_inventory from authenticated;
revoke truncate, references, trigger on table public.aims_control_catalog from authenticated;
revoke truncate, references, trigger on table public.aims_control_tests from authenticated;
revoke truncate, references, trigger on table public.aims_dataset_registry from authenticated;
revoke truncate, references, trigger on table public.aims_evidence_packs from authenticated;
revoke truncate, references, trigger on table public.aims_fria_affected_groups from authenticated;
revoke truncate, references, trigger on table public.aims_fria_assessments from authenticated;
revoke truncate, references, trigger on table public.aims_fria_dpia_cross_references from authenticated;
revoke truncate, references, trigger on table public.aims_fria_fundamental_rights_risks from authenticated;
revoke truncate, references, trigger on table public.aims_fria_process_map from authenticated;
revoke truncate, references, trigger on table public.aims_fria_remediation_governance from authenticated;
revoke truncate, references, trigger on table public.aims_fria_use_profile from authenticated;
revoke truncate, references, trigger on table public.aims_incident_evidence_packs from authenticated;
revoke truncate, references, trigger on table public.aims_incident_regimes from authenticated;
revoke truncate, references, trigger on table public.aims_incident_reports from authenticated;
revoke truncate, references, trigger on table public.aims_model_registry from authenticated;
revoke truncate, references, trigger on table public.aims_monitoring_indicators from authenticated;
revoke truncate, references, trigger on table public.aims_post_market_plans from authenticated;
revoke truncate, references, trigger on table public.aims_regulatory_clocks from authenticated;
revoke truncate, references, trigger on table public.aims_requirement_catalog from authenticated;
revoke truncate, references, trigger on table public.aims_requirement_checks from authenticated;
revoke truncate, references, trigger on table public.aims_system_versions from authenticated;
revoke truncate, references, trigger on table public.aims_technical_file_sections from authenticated;

-- authenticated: sin escritura en las 20 tablas sin camino en el producto
-- (destino (b) de la frontera). Siguen legibles.
revoke insert, update, delete on table public.aims_change_requests from authenticated;
revoke insert, update, delete on table public.aims_component_inventory from authenticated;
revoke insert, update, delete on table public.aims_control_catalog from authenticated;
revoke insert, update, delete on table public.aims_control_tests from authenticated;
revoke insert, update, delete on table public.aims_dataset_registry from authenticated;
revoke insert, update, delete on table public.aims_evidence_packs from authenticated;
revoke insert, update, delete on table public.aims_fria_affected_groups from authenticated;
revoke insert, update, delete on table public.aims_fria_assessments from authenticated;
revoke insert, update, delete on table public.aims_fria_dpia_cross_references from authenticated;
revoke insert, update, delete on table public.aims_fria_fundamental_rights_risks from authenticated;
revoke insert, update, delete on table public.aims_fria_process_map from authenticated;
revoke insert, update, delete on table public.aims_fria_remediation_governance from authenticated;
revoke insert, update, delete on table public.aims_fria_use_profile from authenticated;
revoke insert, update, delete on table public.aims_incident_evidence_packs from authenticated;
revoke insert, update, delete on table public.aims_incident_reports from authenticated;
revoke insert, update, delete on table public.aims_model_registry from authenticated;
revoke insert, update, delete on table public.aims_post_market_plans from authenticated;
revoke insert, update, delete on table public.aims_regulatory_clocks from authenticated;
revoke insert, update, delete on table public.aims_requirement_catalog from authenticated;
revoke insert, update, delete on table public.aims_requirement_checks from authenticated;

-- La RPC de cierre del expediente: inalcanzable, sin botón, sin EXECUTE.
revoke execute on function public.fn_aims_close_technical_file(uuid, text, text, text) from authenticated;

do $verificacion$
declare
  v_tablas text[] := array[
    'ai_systems', 'ai_incidents', 'ai_risk_assessments', 'ai_compliance_checks',
    'aims_change_requests', 'aims_component_inventory', 'aims_control_catalog', 'aims_control_tests',
    'aims_dataset_registry', 'aims_evidence_packs', 'aims_fria_affected_groups', 'aims_fria_assessments',
    'aims_fria_dpia_cross_references', 'aims_fria_fundamental_rights_risks', 'aims_fria_process_map',
    'aims_fria_remediation_governance', 'aims_fria_use_profile', 'aims_incident_evidence_packs',
    'aims_incident_regimes', 'aims_incident_reports', 'aims_model_registry', 'aims_monitoring_indicators',
    'aims_post_market_plans', 'aims_regulatory_clocks', 'aims_requirement_catalog', 'aims_requirement_checks',
    'aims_system_versions', 'aims_technical_file_sections'];
  v_muertas text[] := array[
    'aims_change_requests', 'aims_component_inventory', 'aims_control_catalog', 'aims_control_tests',
    'aims_dataset_registry', 'aims_evidence_packs', 'aims_fria_affected_groups', 'aims_fria_assessments',
    'aims_fria_dpia_cross_references', 'aims_fria_fundamental_rights_risks', 'aims_fria_process_map',
    'aims_fria_remediation_governance', 'aims_fria_use_profile', 'aims_incident_evidence_packs',
    'aims_incident_reports', 'aims_model_registry', 'aims_post_market_plans', 'aims_regulatory_clocks',
    'aims_requirement_catalog', 'aims_requirement_checks'];
  v_existentes int;
  v_anon int;
  v_truncate int;
  v_escritura_muerta int;
  v_control int;
  v_execute int;
begin
  -- El universo tiene que ser el esperado: si una tabla desapareció, la
  -- verificación no debe pasar por silencio.
  select count(*) into v_existentes from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE' and table_name = any(v_tablas);
  if v_existentes <> 28 then
    raise exception 'VERIFICACION: se esperaban 28 tablas, existen %', v_existentes;
  end if;

  select count(*) into v_anon from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon' and table_name = any(v_tablas);
  if v_anon <> 0 then
    raise exception 'VERIFICACION: anon conserva % privilegios sobre el backbone de IA', v_anon;
  end if;

  select count(*) into v_truncate from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER') and table_name = any(v_tablas);
  if v_truncate <> 0 then
    raise exception 'VERIFICACION: authenticated conserva % privilegios que no pasan por RLS', v_truncate;
  end if;

  select count(*) into v_escritura_muerta from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE') and table_name = any(v_muertas);
  if v_escritura_muerta <> 0 then
    raise exception 'VERIFICACION: authenticated conserva escritura (%) sobre tablas sin camino en el producto', v_escritura_muerta;
  end if;

  select count(*) into v_execute from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'fn_aims_close_technical_file' and grantee = 'authenticated';
  if v_execute <> 0 then
    raise exception 'VERIFICACION: authenticated conserva EXECUTE sobre fn_aims_close_technical_file';
  end if;

  -- Control positivo de verdad: lo que DEBE quedar sigue estando. Sin esto, un
  -- revoke de más (que rompiera el alta) pasaría la verificación igual.
  select count(*) into v_control from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name = 'ai_systems' and privilege_type = 'INSERT';
  if v_control <> 1 then
    raise exception 'VERIFICACION: el instrumento no ve el INSERT de authenticated sobre ai_systems, que debe quedar';
  end if;

  raise notice 'VERIFICACION OK: 28 tablas, anon fuera, sin TRUNCATE/REFERENCES/TRIGGER, 20 tablas sin escritura, RPC de cierre sin EXECUTE';
end;
$verificacion$;
