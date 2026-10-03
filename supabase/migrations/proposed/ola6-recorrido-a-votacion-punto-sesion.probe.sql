-- Ola 6 (MOI-15, objetivo 4.1) — recorrido simulado, PARTE A.
--
-- Corre dentro del ensayo revertido (`scripts/db/ensayo-rollback.sh`),
-- DESPUÉS de 20260928171000 (H-52) y de su sonda, y ANTES de 20260928170000
-- (H-53). Reproduce en SQL, con la sesión real del SECRETARIO del grupo nuevo
-- y las MISMAS RPC que llama la pantalla, lo que el paso 5 (Votaciones) hace
-- cuando el botón que H-51 devuelve se pulsa, y comprueba que el cierre
-- sigue bloqueado EXACTAMENTE por H-53 (y ya no por H-52):
--
--   1. el punto 2 nacido en sesión (`dc938c06…`) ya tiene materia y propuesta
--      (lo deja así la sonda de 171000; si no, se sincroniza aquí);
--   2. `fn_save_meeting_resolutions` con las dos filas que construiría
--      `handleSaveResolutions`: punto 1 (convocatoria, acuerdo existente,
--      votos ya registrados) y punto 2 (nacido en sesión, acuerdo nuevo por
--      UPSERT, votos FAVOR de los tres consejeros presentes);
--   3. `fn_secretaria_close_meeting_and_generate_minute` → debe fallar con
--      'held agenda differs from the immutable convocation' (H-53), y la
--      reunión seguir EN_CURSO sin acta.
--
-- Lo que es SIMULACIÓN y se declara: el sentido del voto del punto 2 y el
-- snapshot de adopción (clonado del punto 1 con la materia del presupuesto,
-- sin rule_trace) los pondría el secretario por pantalla. Nada de esto queda
-- en Cloud: todo se revierte.

do $parte_a$
declare
  v_user uuid := '6452252f-3214-4c9a-857b-b439626d215e'; -- demo@grupo-nuevo-demo.dev, SECRETARIO …0003
  v_tenant uuid := '00000000-0000-0000-0000-000000000003';
  v_meeting uuid := '81a4de74-2bc4-4f99-8a98-12bfc038a630';
  v_punto2 uuid := 'dc938c06-1334-4936-a84b-02297336f7fb';
  v_titulo2 text := 'Aprobación del presupuesto anual 2027 de Corporación Nueva, S.A.';
  v_propuesta2 text := 'Se acuerda aprobar el presupuesto anual del ejercicio 2027 de Corporación Nueva, S.A. presentado por la Presidencia al Consejo, con dotación de partidas de gestión ordinaria y facultad de ejecución conforme al art. 249 LSC.';
  v_m public.meetings%rowtype;
  v_ai2 public.agenda_items%rowtype;
  v_res1 public.meeting_resolutions%rowtype;
  v_snap1 jsonb;
  v_snap2 jsonb;
  v_votes1 jsonb;
  v_votes2 jsonb;
  v_rows jsonb;
  v_saved jsonb;
  v_err text;
  v_n int;
  v_agreement2 uuid;
  v_ai_of_agreement2 uuid;
  v_sqlstate text;
begin
  select * into v_m from public.meetings where id = v_meeting and tenant_id = v_tenant;
  if not found or v_m.status <> 'EN_CURSO' then
    raise exception 'PARTE A: la reunión % no está EN_CURSO (precondición)', v_meeting;
  end if;
  if v_m.scheduled_end > now() then
    raise exception 'PARTE A: scheduled_end (%) aún no ha pasado; el cierre no puede ensayarse', v_m.scheduled_end;
  end if;

  -- 1. Punto 2 con materia y propuesta (H-52). Si la sonda de 171000 no corrió
  --    antes, se sincroniza aquí por la misma RPC.
  select * into v_ai2 from public.agenda_items where id = v_punto2 and meeting_id = v_meeting;
  if not found then
    raise exception 'PARTE A: el punto nacido en sesión % no existe', v_punto2;
  end if;
  if v_ai2.matter_code is distinct from 'APROBACION_PRESUPUESTO' or coalesce(btrim(v_ai2.proposal_text), '') = '' then
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.fn_secretaria_add_session_agenda_item(v_meeting, 2, v_titulo2, 'DECISORIO', null, 'APROBACION_PRESUPUESTO', v_propuesta2);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    select * into v_ai2 from public.agenda_items where id = v_punto2;
  end if;
  if v_ai2.matter_code is distinct from 'APROBACION_PRESUPUESTO' or coalesce(btrim(v_ai2.proposal_text), '') = '' then
    raise exception 'PARTE A: el punto 2 sigue sin materia/propuesta (H-52 no resuelto)';
  end if;

  -- 2. Filas de fn_save_meeting_resolutions.
  select * into v_res1 from public.meeting_resolutions where meeting_id = v_meeting and agenda_item_index = 1;
  if not found or v_res1.agreement_id is null then
    raise exception 'PARTE A: el punto 1 no tiene resolución con acuerdo (precondición del caso)';
  end if;
  v_snap1 := v_m.quorum_data -> 'point_snapshots' -> 0;
  if v_snap1 is null or (v_snap1 ->> 'agenda_item_index')::int <> 1 then
    raise exception 'PARTE A: no hay snapshot del punto 1 en quorum_data';
  end if;

  -- Votos tal como los envía la pantalla tras H-54: una fila por asiento
  -- concurrente con derecho de voto. La presidencia (608f8eaf…) tiene un
  -- conflicto ACTIVO registrado en el tenant (alta de prueba MOI-149), así
  -- que el paso 5 la marca excluida en TODOS los puntos (`forcedConflict`):
  -- viaja con conflict_flag=true, motivo y ABSTENCION, y el servidor la
  -- cuenta como asiento excluido, no como voto. Los otros dos consejeros
  -- votan FAVOR (punto 1: los mismos votos ya registrados; punto 2: igual).
  select coalesce(jsonb_agg(
           case when ma.person_id = v_m.president_id then
             jsonb_build_object('attendee_id', ma.id, 'vote_value', 'ABSTENCION', 'conflict_flag', true,
                                'reason', 'Conflicto activo registrado en el expediente — revisar si afecta a este punto (arts. 190 y 228.c LSC)')
           else
             jsonb_build_object('attendee_id', ma.id, 'vote_value', coalesce(mv.vote_value, 'FAVOR'), 'conflict_flag', false, 'reason', null)
           end), '[]'::jsonb)
    into v_votes1
    from public.meeting_attendees ma
    left join public.meeting_votes mv on mv.attendee_id = ma.id and mv.resolution_id = v_res1.id
   where ma.meeting_id = v_meeting
     and ma.person_id <> v_m.secretary_id;

  select coalesce(jsonb_agg(
           case when ma.person_id = v_m.president_id then
             jsonb_build_object('attendee_id', ma.id, 'vote_value', 'ABSTENCION', 'conflict_flag', true,
                                'reason', 'Conflicto activo registrado en el expediente — revisar si afecta a este punto (arts. 190 y 228.c LSC)')
           else
             jsonb_build_object('attendee_id', ma.id, 'vote_value', 'FAVOR', 'conflict_flag', false, 'reason', null)
           end), '[]'::jsonb)
    into v_votes2
    from public.meeting_attendees ma
   where ma.meeting_id = v_meeting
     and ma.person_id <> v_m.secretary_id;

  v_snap2 := (v_snap1 - 'agreement_id' - 'resolution_id' - 'rule_trace')
             || jsonb_build_object(
                  'agenda_item_index', 2,
                  'materia', 'APROBACION_PRESUPUESTO',
                  'materia_clase', 'ORDINARIA',
                  'resolution_text', v_titulo2,
                  'status_resolucion', 'ADOPTED',
                  'evaluated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                  'vote_summary', jsonb_build_object('favor', jsonb_array_length(v_votes2) - 1, 'contra', 0, 'abstenciones', 0),
                  'voters', v_votes2
                );

  v_rows := jsonb_build_array(
    jsonb_build_object(
      'agenda_item_index', 1,
      'resolution_text', v_res1.resolution_text,
      'resolution_type', coalesce(v_res1.resolution_type, 'ORDINARIA'),
      'status', 'ADOPTED',
      'required_majority_code', v_res1.required_majority_code,
      'agreement_id', v_res1.agreement_id,
      'agreement_origin', 'CONVOCATORIA',
      'agreement_action', 'NONE',
      'adoption_snapshot', v_snap1,
      'votes', v_votes1
    ),
    jsonb_build_object(
      'agenda_item_index', 2,
      'resolution_text', v_propuesta2,
      'resolution_type', 'ORDINARIA',
      'status', 'ADOPTED',
      'required_majority_code', 'APROBACION_PRESUPUESTO:ORDINARIA',
      'agreement_id', null,
      'agreement_origin', 'MEETING_FLOOR',
      'agreement_action', 'UPSERT',
      'agreement_payload', jsonb_build_object(
        'tenant_id', v_tenant,
        'agreement_kind', 'APROBACION_PRESUPUESTO',
        'matter_class', 'ORDINARIA',
        'inscribable', false,
        'adoption_mode', 'MEETING',
        'status', 'ADOPTED',
        'parent_meeting_id', v_meeting,
        'agenda_item_id', v_punto2,
        'proposal_text', v_propuesta2,
        'decision_text', v_propuesta2,
        'decision_date', to_char(v_m.scheduled_start at time zone 'utc', 'YYYY-MM-DD'),
        -- El acuerdo lleva el código normalizado (ORDINARIA → SIMPLE), igual
        -- que hace `normalizeRequiredMajorityCode` en el cliente: el trigger
        -- fn_agreements_majority_check solo entiende SIMPLE/REFORZADA_2_3/UNANIMIDAD.
        'required_majority_code', 'SIMPLE',
        'compliance_snapshot', v_snap2,
        'compliance_explain', jsonb_build_object(
          'agreement_360', jsonb_build_object('version', 'agreement-360.v1', 'origin', 'MEETING_FLOOR', 'source', 'meeting_resolutions', 'meeting_id', v_meeting, 'agenda_item_index', 2, 'materialized', true),
          'societary_validity', v_snap2 -> 'societary_validity',
          'pacto_compliance', v_snap2 -> 'pacto_compliance'
        ),
        'execution_mode', jsonb_build_object(
          'mode', 'MEETING', 'agenda_item_index', 2,
          'agreement_360', jsonb_build_object('version', 'agreement-360.v1', 'origin', 'MEETING_FLOOR', 'source', 'meeting_resolutions', 'meeting_id', v_meeting, 'agenda_item_index', 2, 'materialized', true)
        ),
        'updated_at', now()
      ),
      'adoption_snapshot', v_snap2,
      'votes', v_votes2
    )
  );

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_saved := public.fn_save_meeting_resolutions(v_tenant, v_meeting, v_rows);
    v_err := 'OK';
  exception when others then
    v_err := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  if v_err <> 'OK' then
    raise exception 'PARTE A: fn_save_meeting_resolutions rechazó la votación (%)', v_err;
  end if;

  select count(*) into v_n from public.meeting_resolutions where meeting_id = v_meeting;
  if v_n <> 2 then
    raise exception 'PARTE A: se esperaban 2 resoluciones y hay %', v_n;
  end if;
  select agreement_id into v_agreement2 from public.meeting_resolutions where meeting_id = v_meeting and agenda_item_index = 2 and status = 'ADOPTED';
  if v_agreement2 is null then
    raise exception 'PARTE A: el punto 2 no quedó ADOPTED con acuerdo';
  end if;
  select agenda_item_id into v_ai_of_agreement2 from public.agreements where id = v_agreement2;
  if v_ai_of_agreement2 is distinct from v_punto2 then
    raise exception 'PARTE A: el acuerdo del punto 2 no quedó anclado al agenda_item % (tiene %)', v_punto2, v_ai_of_agreement2;
  end if;
  if (select agreement_id from public.meeting_resolutions where meeting_id = v_meeting and agenda_item_index = 1) is distinct from v_res1.agreement_id then
    raise exception 'PARTE A: el recálculo perdió el acuerdo del punto 1';
  end if;

  -- 3. Cierre: con H-52 resuelto y la votación completa, el único bloqueo
  --    restante tiene que ser H-53. La subtransacción se deshace sola.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_close_meeting_and_generate_minute(
      v_meeting, 'Acta del Consejo de Administración (ensayo ola 6, revertido)', null
    );
    v_err := 'ACTA_GENERADA';
  exception when others then
    v_err := sqlerrm;
    v_sqlstate := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if v_err = 'ACTA_GENERADA' then
    raise exception 'PARTE A: el acta se generó SIN la migración H-53: el gate de agenda ya no bloquea, revisar la premisa';
  end if;
  if v_err not like '%held agenda differs from the immutable convocation%' then
    raise exception 'PARTE A: el cierre falló por un motivo DISTINTO de H-53 (hallazgo nuevo): % %', v_sqlstate, v_err;
  end if;
  if (select status from public.meetings where id = v_meeting) <> 'EN_CURSO'
     or exists (select 1 from public.minutes where meeting_id = v_meeting) then
    raise exception 'PARTE A: el cierre fallido dejó estado sucio';
  end if;

  raise notice 'PARTE A OK: punto 2 con materia APROBACION_PRESUPUESTO y propuesta (H-52); fn_save_meeting_resolutions registró 2 resoluciones ADOPTED (acuerdo del punto 1 conservado %, acuerdo nuevo del punto 2 % anclado a %); el cierre sigue bloqueado SOLO por H-53: "%"',
    v_res1.agreement_id, v_agreement2, v_punto2, v_err;
end
$parte_a$;
