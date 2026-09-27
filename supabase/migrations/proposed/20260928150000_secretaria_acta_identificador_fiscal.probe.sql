-- Ensayo revertido de
-- supabase/migrations/20260928150000_secretaria_acta_identificador_fiscal.sql
-- (H-28, MOI-15). Corre como `authenticated` real
-- (demo@grupo-nuevo-demo.dev, SECRETARIO, tenant …0003), sobre la reunión
-- real ffd71122… (Consejo de Corporación Nueva, S.A.). Todo dentro del
-- BEGIN … ROLLBACK del ejecutor: nada de esto queda en Cloud.
--
-- 1) Control negativo: con la entidad sin registration_number (ya lo está)
--    Y sin el tax_id de su persona jurídica (se le quita aquí, temporal),
--    cerrar la reunión y generar el acta sigue fallando con el MISMO
--    mensaje que reportó el issue.
-- 2) Se restaura el tax_id (nada de esto sale del ROLLBACK del ejecutor,
--    pero así el paso 3 lee el dato real, no el corrompido por el paso 1).
-- 3) Con dato REAL sin tocar (sin corromper nada), la misma reunión ya NO
--    falla en el gate del identificador fiscal (H-28 queda probado): el
--    error, si lo hay, es otro, distinto y posterior en la cadena de
--    validación. No se fabrica ni se corrige aquí ningún otro dato — ver
--    GOTCHA abajo.
--
-- GOTCHA medido en este ensayo, FUERA de alcance de H-28: el punto del
-- orden del día de esta reunión trae matter_code='APROBACION_PLAN_NEGOCIO',
-- que no existe en materia_catalog (el código real es
-- 'APROBACION_PRESUPUESTO') — un defecto de dato distinto, no relacionado
-- con el identificador fiscal, que hace fallar el gate "every point needs a
-- catalogued matter" una vez superado el de H-28. No se toca agenda_items,
-- materia_catalog ni la convocatoria inmutable en este ensayo ni en la
-- migración real: se deja anotado en open_points para su propio issue, y la
-- prueba de que H-28 en sí queda resuelto se apoya en el bloque de
-- verificación de la propia migración (SELECT directo sobre dato real) más
-- el control negativo/positivo de este fichero sobre el mensaje exacto.
do $probe_h28$
declare
  v_secretario uuid := '6452252f-3214-4c9a-857b-b439626d215e'; -- demo@grupo-nuevo-demo.dev
  v_meeting_id uuid := 'ffd71122-0dfa-43d0-8238-ddd8e78dec73';
  v_entity_id uuid := '45c8df67-64c9-42a3-abff-8047dd23748b';
  v_owner_person_id uuid := 'c7a2b49c-3c04-41a8-a83e-76d2dd882fd9';
  v_original_tax_id text;
  v_err text;
  v_minute_id uuid;
  v_status text;
  v_manifest_tax_id text;
  v_manifest_legal_name text;
  v_registration_number text;
begin
  select tax_id into v_original_tax_id from public.persons where id = v_owner_person_id;
  if v_original_tax_id is distinct from 'A98765432' then
    raise exception 'PROBE H-28: dato de partida inesperado, persons.tax_id=% (se esperaba A98765432)', v_original_tax_id;
  end if;

  select status into v_status from public.meetings where id = v_meeting_id and tenant_id = '00000000-0000-0000-0000-000000000003';
  if v_status is distinct from 'EN_CURSO' then
    raise exception 'PROBE H-28: la reunión ffd71122 no está EN_CURSO (status=%); no se puede ensayar el cierre', v_status;
  end if;

  select registration_number into v_registration_number from public.entities where id = v_entity_id;
  if v_registration_number is not null then
    raise exception 'PROBE H-28: dato de partida inesperado, entities.registration_number=% (se esperaba NULL)', v_registration_number;
  end if;

  if exists (select 1 from public.minutes where meeting_id = v_meeting_id) then
    raise exception 'PROBE H-28: ya existe un acta para ffd71122; el ensayo asume que aún no hay ninguna';
  end if;

  -- ── 1) CONTROL NEGATIVO ──────────────────────────────────────────────
  -- Entidad sin registration_number (real) y sin tax_id de su persona
  -- jurídica (corrompido aquí, temporal): el gate debe seguir fallando con
  -- el mismo mensaje literal que reportó el issue.
  update public.persons set tax_id = null where id = v_owner_person_id;

  perform set_config('request.jwt.claims', json_build_object('sub', v_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    perform public.fn_secretaria_close_meeting_and_generate_minute(v_meeting_id, null, null);
    v_err := 'NO_FALLO';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if v_err = 'NO_FALLO' then
    raise exception 'PROBE H-28: el control negativo generó acta sin ningún identificador fiscal (debía fallar)';
  end if;
  if v_err !~ 'entity, tax id, body and meeting officers require identified legal names' then
    raise exception 'PROBE H-28: el control negativo falló con un mensaje distinto al esperado: %', v_err;
  end if;

  -- La reunión sigue EN_CURSO: la excepción dentro de fn_generar_acta
  -- deshace, vía el savepoint implícito de este BEGIN/EXCEPTION, el UPDATE a
  -- CELEBRADA que hace fn_secretaria_close_meeting_and_generate_minute antes
  -- de invocar el motor de manifiesto.
  select status into v_status from public.meetings where id = v_meeting_id;
  if v_status is distinct from 'EN_CURSO' then
    raise exception 'PROBE H-28: la reunión quedó en estado % tras el control negativo fallido; se esperaba que siguiera EN_CURSO', v_status;
  end if;
  if exists (select 1 from public.minutes where meeting_id = v_meeting_id) then
    raise exception 'PROBE H-28: el control negativo dejó residuo en minutes';
  end if;

  -- ── 2) Restaura el dato real (nada sale de aquí: lo deshace el ROLLBACK
  --    del ejecutor de todas formas, pero así el paso 3 usa el NIF real). ──
  update public.persons set tax_id = v_original_tax_id where id = v_owner_person_id;

  -- ── 3) Con dato real, sin tocar nada más: el gate de H-28 ya no bloquea.
  --    (ver GOTCHA en la cabecera: esta reunión concreta sigue bloqueada
  --    después, por un defecto de catálogo de materia ajeno a H-28). ──
  perform set_config('request.jwt.claims', json_build_object('sub', v_secretario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_err := null;
  begin
    v_minute_id := public.fn_secretaria_close_meeting_and_generate_minute(v_meeting_id, null, null);
    v_err := 'OK';
  exception when others then
    v_err := sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  if v_err = 'OK' then
    -- Si algún día el catálogo de materia se corrige (fuera de H-28), la
    -- reunión pasará a generar acta de verdad: entonces sí procede
    -- comprobar el NIF del manifiesto igual que abajo.
    select authoritative_manifest #>> '{entity,tax_id}', authoritative_manifest #>> '{entity,legal_name}'
      into v_manifest_tax_id, v_manifest_legal_name
      from public.minutes
     where id = v_minute_id;
    if v_manifest_tax_id is distinct from 'A98765432' then
      raise exception 'PROBE H-28: el acta generada no lleva el NIF de la persona jurídica; manifest.entity.tax_id=%', v_manifest_tax_id;
    end if;
    raise notice 'PROBE H-28 OK (extremo a extremo): acta % generada para ffd71122 con NIF % de la persona jurídica', v_minute_id, v_manifest_tax_id;
  else
    if v_err ~ 'entity, tax id, body and meeting officers require identified legal names' then
      raise exception 'PROBE H-28: con dato REAL sin corromper, el gate del identificador fiscal SIGUE bloqueando: %', v_err;
    end if;
    if v_err !~ 'catalogued matter' then
      raise exception 'PROBE H-28: se esperaba que el único bloqueo restante fuera el defecto de catálogo de materia (ajeno a H-28); salió: %', v_err;
    end if;
    raise notice 'PROBE H-28 OK: el gate del identificador fiscal ya NO bloquea (control negativo con el mismo mensaje exacto arriba; con dato real el error pasó a ser otro, ajeno a H-28: %)', v_err;
  end if;

  -- registration_number sigue sin inventarse: el fix no lo rellenó, pase lo
  -- que pase con el resto de la cadena de validación.
  select registration_number into v_registration_number from public.entities where id = v_entity_id;
  if v_registration_number is not null then
    raise exception 'PROBE H-28: entities.registration_number dejó de ser NULL (%): no debía escribirse ningún dato', v_registration_number;
  end if;
end;
$probe_h28$;
