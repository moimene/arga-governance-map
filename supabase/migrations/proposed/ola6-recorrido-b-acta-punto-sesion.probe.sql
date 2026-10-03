-- Ola 6 (MOI-15, objetivo 4.1) — recorrido simulado, PARTE B.
--
-- Corre dentro del ensayo revertido, DESPUÉS de la parte A y de
-- 20260928170000 (H-53). Con la misma sesión real del SECRETARIO del grupo
-- nuevo llama a `fn_secretaria_close_meeting_and_generate_minute` (lo que
-- hace "Confirmar cierre y generar acta") y comprueba:
--   - que se genera el acta (fila en `minutes` con manifiesto autoritativo y
--     `legal_gate_status` MANIFEST_READY) y la reunión pasa a CELEBRADA;
--   - que el manifiesto declara el origen de cada punto (CONVOCATORIA /
--     MEETING_FLOOR) y el texto del acta la procedencia del punto 2;
--   - que ARGA y Garrigues no cambian (recuentos antes/después).
-- Todo se revierte al final del ensayo.

do $parte_b$
declare
  v_user uuid := '6452252f-3214-4c9a-857b-b439626d215e';
  v_tenant uuid := '00000000-0000-0000-0000-000000000003';
  v_meeting uuid := '81a4de74-2bc4-4f99-8a98-12bfc038a630';
  v_minute_id uuid;
  v_minute public.minutes%rowtype;
  v_err text;
  v_sqlstate text;
  v_agenda jsonb;
  v_arga_minutes_before int := (select count(*) from public.minutes where tenant_id = '00000000-0000-0000-0000-000000000001');
  v_arga_agreements_before int := (select count(*) from public.agreements where tenant_id = '00000000-0000-0000-0000-000000000001');
  v_garr_minutes_before int := (select count(*) from public.minutes where tenant_id = '00000000-0000-0000-0000-000000000002');
  v_garr_agreements_before int := (select count(*) from public.agreements where tenant_id = '00000000-0000-0000-0000-000000000002');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_minute_id := public.fn_secretaria_close_meeting_and_generate_minute(
      v_meeting, 'Acta del Consejo de Administración (ensayo ola 6, revertido)', null
    );
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
    v_sqlstate := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if v_err <> 'OK' or v_minute_id is null then
    raise exception 'PARTE B: el acta NO se generó con H-52 y H-53 aplicadas (hallazgo nuevo): % %', v_sqlstate, v_err;
  end if;

  select * into v_minute from public.minutes where id = v_minute_id;
  if not found or v_minute.meeting_id <> v_meeting or v_minute.tenant_id <> v_tenant then
    raise exception 'PARTE B: la fila de minutes no corresponde a la reunión';
  end if;
  if v_minute.authoritative_manifest is null or v_minute.authoritative_manifest_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'PARTE B: el acta no trae manifiesto autoritativo con hash';
  end if;
  if v_minute.legal_gate_status not in ('MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED') then
    raise exception 'PARTE B: legal_gate_status inesperado: %', v_minute.legal_gate_status;
  end if;
  if (select status from public.meetings where id = v_meeting) <> 'CELEBRADA' then
    raise exception 'PARTE B: la reunión no quedó CELEBRADA';
  end if;

  v_agenda := v_minute.authoritative_manifest -> 'agenda';
  if v_agenda is null or jsonb_array_length(v_agenda) <> 2 then
    raise exception 'PARTE B: el manifiesto no trae los 2 puntos de la agenda (%)', v_agenda;
  end if;
  if v_agenda -> 0 ->> 'origin' is distinct from 'CONVOCATORIA' or v_agenda -> 1 ->> 'origin' is distinct from 'MEETING_FLOOR' then
    raise exception 'PARTE B: el manifiesto no declara el origen de los puntos (% / %)', v_agenda -> 0 ->> 'origin', v_agenda -> 1 ->> 'origin';
  end if;
  if v_agenda -> 1 ->> 'matter_code' is distinct from 'APROBACION_PRESUPUESTO' then
    raise exception 'PARTE B: el punto 2 del manifiesto no lleva la materia (%)', v_agenda -> 1 ->> 'matter_code';
  end if;
  if position('Procedencia: punto no incluido en el orden del día convocado' in coalesce(v_minute.content, '')) = 0 then
    raise exception 'PARTE B: el texto del acta no declara la procedencia del punto nacido en sesión';
  end if;

  if (select count(*) from public.minutes where tenant_id = '00000000-0000-0000-0000-000000000001') <> v_arga_minutes_before
     or (select count(*) from public.agreements where tenant_id = '00000000-0000-0000-0000-000000000001') <> v_arga_agreements_before
     or (select count(*) from public.minutes where tenant_id = '00000000-0000-0000-0000-000000000002') <> v_garr_minutes_before
     or (select count(*) from public.agreements where tenant_id = '00000000-0000-0000-0000-000000000002') <> v_garr_agreements_before then
    raise exception 'PARTE B: ARGA o Garrigues cambiaron durante el ensayo';
  end if;

  raise notice 'PARTE B OK: acta % generada (legal_gate_status=%, hash=%); reunión CELEBRADA; manifiesto agenda[0].origin=CONVOCATORIA, agenda[1].origin=MEETING_FLOOR con materia APROBACION_PRESUPUESTO; el acta declara la procedencia del punto 2; ARGA (minutes=%, agreements=%) y Garrigues (minutes=%, agreements=%) sin cambios. TODO SE REVIERTE.',
    v_minute_id, v_minute.legal_gate_status, left(v_minute.authoritative_manifest_hash, 12),
    v_arga_minutes_before, v_arga_agreements_before, v_garr_minutes_before, v_garr_agreements_before;
end
$parte_b$;
