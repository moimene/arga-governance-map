-- MOI-142 — El manifiesto de convocatoria de Junta lleva
-- `president_action_not_asserted` también en la RAÍZ, como el de Consejo
-- (20260720138000). `fn_emit_convocatoria_junta` (20260926114200) solo lo ponía
-- dentro de `authority` —lo que exige el guard WORM—, y la Edge Function
-- `convocation-artifact-register` exige la clave en la raíz como parte de la
-- postura legal del manifiesto: toda Junta emitida recibía 409 «Manifest
-- identity or legal posture is inconsistent» al generar su documento final.
-- Medido el 27-09-2026 sobre la Junta f93e2f43… del grupo nuevo: única clave de
-- raíz que falta frente a un manifiesto de Consejo.
--
-- No se relaja la Edge Function: la postura legal sigue exigida en la raíz.
-- Los manifiestos ya emitidos son inmutables y no se tocan; se corrigen con
-- una captura nueva.
--
-- Sustitución anclada sobre el cuerpo vivo: el ancla debe aparecer exactamente
-- una vez o la migración aborta.

do $migracion$
declare
  v_def text := pg_get_functiondef('public.fn_emit_convocatoria_junta'::regproc);
  v_ancla constant text := '''not_a_legal_convocation'', true,';
  v_n int;
begin
  if position('''president_action_not_asserted'', true,' || E'\n' || '    ''recorded_at''' in v_def) > 0 then
    raise notice 'MOI-142: la raíz ya lleva president_action_not_asserted; nada que hacer';
    return;
  end if;
  select count(*) into v_n from regexp_matches(v_def, '''not_a_legal_convocation'', true,', 'g');
  if v_n <> 1 then
    raise exception 'MOI-142: ancla esperada 1 vez en fn_emit_convocatoria_junta, encontrada %', v_n;
  end if;
  v_def := replace(v_def, v_ancla, v_ancla || E'\n    ''president_action_not_asserted'', true,');
  execute v_def;
end;
$migracion$;

do $verificacion$
declare
  v_def text := pg_get_functiondef('public.fn_emit_convocatoria_junta'::regproc);
  v_n int;
begin
  -- Como clave con valor (no el comentario que la cita): raíz + authority.
  select count(*) into v_n from regexp_matches(v_def, '''president_action_not_asserted'', true', 'g');
  if v_n <> 2 then
    raise exception 'VERIFICACION MOI-142: clave president_action_not_asserted esperada 2 veces (raíz y authority), encontrada %', v_n;
  end if;
  if position('''not_a_legal_convocation'', true,' || E'\n' || '    ''president_action_not_asserted'', true,' in v_def) = 0 then
    raise exception 'VERIFICACION MOI-142: la clave no quedó en la raíz del manifiesto';
  end if;
  if has_function_privilege('anon', 'public.fn_emit_convocatoria_junta(jsonb)', 'execute') then
    raise exception 'VERIFICACION MOI-142: anon conserva EXECUTE';
  end if;
  raise notice 'VERIFICACION MOI-142: OK';
end;
$verificacion$;
