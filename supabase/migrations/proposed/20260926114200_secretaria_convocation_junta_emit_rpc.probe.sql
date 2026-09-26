-- MOI-142 — ensayo revertido (NO ejecutar fuera del orquestador autorizado).
--
-- Aplica la migración 20260926114200 y, dentro de la MISMA transacción que
-- termina siempre en rollback:
--   1) emite la convocatoria de la Junta futura de prueba del grupo nuevo
--      (tenant …0003, "Junta General de Accionistas" de Corporación Nueva,
--      S.A.) por la vía gobernada (fn_emit_convocatoria_junta), con sesión
--      simulada del SECRETARIO de ese tenant, y comprueba que el manifiesto
--      congelado trae como destinatarios a sus 2 socios con participación
--      vigente (capital_holdings, no condiciones_persona) — la rama JUNTA
--      nueva de fn_convocation_manifest_enrich_recipients;
--   2) comprueba que para (tenant …0003, ese órgano, esa fecha_1) queda
--      exactamente una fila;
--   3) reemite — solo como smoke test, no es el cambio real — un Consejo de
--      ARGA reutilizando el texto, la agenda y el reminders_trace YA
--      VALIDADOS de una convocatoria CDA existente, para probar que
--      fn_emit_convocatoria (Consejo) Y la rama CDA del mismo trigger de
--      destinatarios siguen funcionando exactamente igual (mismo origen
--      condiciones_persona, mismo recuento);
--   4) cuenta convocatorias de ARGA (…0001) antes de tocar nada y después de
--      la emisión de la Junta (deben coincidir: la Junta es de otro tenant) y
--      por separado tras el smoke test del Consejo (ahí sí sube +1, y es lo
--      esperado: prueba que el RPC de Consejo admite una nueva emisión);
--   5) confirma que Garrigues (…0002) no se toca: su única convocatoria sigue
--      en BORRADOR.
-- Nada de esto persiste: la transacción entera se deshace al final.
--
-- CORRECCIÓN (revisión, P0): la migración 20260926114200 trae su propio
-- BEGIN;/COMMIT; (es una migración normal, pensada para aplicarse sola). Un
-- `\i` de ese fichero DENTRO de un `begin;` exterior no anida transacciones
-- -Postgres no las anida de verdad-: el BEGIN; interior es un no-op con aviso
-- y el COMMIT; interior CIERRA la transacción exterior, dejando el DDL y todo
-- lo que sigue (la emisión real de la Junta, el smoke test del Consejo)
-- comprometido en cuanto se ejecuta, con el `rollback;` final deshaciendo
-- nada. Por eso aquí no se hace `\i` directo del fichero de migración: se
-- genera antes, con `sed`, una copia local SIN esas dos líneas de control de
-- transacción (son las únicas líneas `BEGIN;`/`COMMIT;` a nivel de sentencia
-- en el fichero; los `BEGIN`/`END` de los bloques PL/pgSQL no llevan `;` en
-- esa posición y no los toca este sed), y es esa copia la que se incluye
-- dentro del `begin;` exterior. Así el `begin;`/`rollback;` de este ensayo
-- gobierna de verdad todo el bloque, incluida la migración.

\! sed -e '/^BEGIN;$/d' -e '/^COMMIT;$/d' supabase/migrations/20260926114200_secretaria_convocation_junta_emit_rpc.sql > /tmp/moi142_junta_emit_no_txn.sql

begin;

\i /tmp/moi142_junta_emit_no_txn.sql

create temporary table probe_results (etiqueta text, valor jsonb) on commit drop;
-- El bloque de ensayo corre como authenticated: necesita poder escribir aquí.
grant all on probe_results to authenticated;

do $probe$
DECLARE
  v_secretario_nuevo uuid := '6452252f-3214-4c9a-857b-b439626d215e'; -- SECRETARIO activo de …0003
  v_secretario_arga uuid := '85e24c66-02c7-4175-b260-1330930ad49f'; -- demo@ de …0001 (perfil SECRETARIO; el 1c05411b tiene rol pero no perfil)
  v_junta_body_id uuid := 'ceee9767-0bbf-4bf7-a2a9-6a812414e4bb'; -- Junta General de Accionistas, Corporación Nueva, S.A. (…0003)
  v_cda_reference_convocatoria_id uuid := '28bc0b69-200c-4616-97ea-393a629050fa'; -- convocatoria de Consejo ya EMITIDA del grupo nuevo, sin anexos ni materias heredadas (orquestador, 26-09: la de ARGA cce1d2ae trae una materia legacy que el motor actual rechaza con REPRESENTATION_LEGACY_MATTER_FORBIDDEN)
  v_fecha_1 timestamptz;
  v_meses text[] := ARRAY[
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];
  v_fecha_texto text;
  v_lugar text := 'Sede social de Corporación Nueva, S.A., Madrid';
  v_titulo text := 'Aprobación de las cuentas anuales del ejercicio 2026';
  v_texto text;
  v_payload jsonb;
  v_result jsonb;
  v_cda_row public.convocatorias%ROWTYPE;
  v_cda_payload jsonb;
  v_cda_result jsonb;
  v_arga_count_antes bigint;
  v_arga_count_tras_junta bigint;
  v_arga_count_tras_cda bigint;
BEGIN
  -- fecha_1 muy por encima del plazo estatutario de 30 días de una SA
  -- (art. 176.1 LSC), para que el ensayo sea válido corra cuando corra.
  v_fecha_1 := (date_trunc('day', now() AT TIME ZONE 'Europe/Madrid')
    + interval '45 days' + interval '10 hours') AT TIME ZONE 'Europe/Madrid';

  v_fecha_texto := concat(
    extract(day FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer,
    ' de ',
    v_meses[extract(month FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer],
    ' de ',
    extract(year FROM (v_fecha_1 AT TIME ZONE 'Europe/Madrid'))::integer
  );

  v_texto := concat(
    'CONVOCATORIA DE JUNTA GENERAL DE Corporación Nueva, S.A.', E'\n\n',
    'Por acuerdo del órgano de administración de la Sociedad, se convoca a los ',
    'accionistas a la Junta General Ordinaria, que se celebrará el día ',
    v_fecha_texto, ' a las ',
    to_char(v_fecha_1 AT TIME ZONE 'Europe/Madrid', 'HH24:MI'),
    ', en ', v_lugar, ', en modalidad presencial.', E'\n\n',
    'ORDEN DEL DÍA', E'\n',
    '1. ', v_titulo, E'\n\n',
    'DERECHO DE INFORMACIÓN Y DOCUMENTACIÓN DISPONIBLE', E'\n',
    'Los accionistas podrán ejercitar los derechos de información que les ',
    'correspondan conforme a la Ley de Sociedades de Capital. La documentación ',
    'de soporte estará disponible mediante el portal societario del expediente demo.',
    E'\n\n',
    'Documento demo/operativo. No constituye evidencia final productiva.'
  );

  -- 2 socios con voto y sin autocartera en capital_holdings para esta entidad
  -- (Carlos Mendoza Ruiz 60%, Elena Gómez Blanco 40%; medido 2026-09-26): el
  -- trace declarado por el cliente debe coincidir con lo que la rama JUNTA
  -- del trigger va a recalcular, o falla CENSUS_MISMATCH a propósito.
  v_payload := jsonb_build_object(
    'body_id', v_junta_body_id,
    'fecha_1', v_fecha_1,
    'lugar', v_lugar,
    'modalidad', 'PRESENCIAL',
    'tipo_convocatoria', 'ORDINARIA',
    'agenda_items', jsonb_build_array(
      jsonb_build_object('titulo', v_titulo, 'kind', 'DECISORIO')
    ),
    'publication_channels', jsonb_build_array('EMAIL_SIMPLE'),
    'convocatoria_text', v_texto,
    'statutory_basis', 'Arts. 166, 173 y 176.1 LSC',
    'reminders_trace', jsonb_build_object(
      'recipients', jsonb_build_object(
        'source', 'capital_holdings',
        'total_active', 2,
        'selected_count', 2,
        'excluded_person_ids', '[]'::jsonb
      ),
      -- Sin anexos: la lista de intenciones de anexo debe existir aunque esté
      -- vacía (trg_01_convocation_manifest_enrich_supporting_intents).
      'documents', jsonb_build_object('uploaded_references', '[]'::jsonb)
    )
  );

  SELECT count(*) INTO v_arga_count_antes
    FROM public.convocatorias c
    JOIN public.governing_bodies gb ON gb.id = c.body_id
   WHERE gb.tenant_id = '00000000-0000-0000-0000-000000000001';

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  v_result := public.fn_emit_convocatoria_junta(v_payload);
  INSERT INTO probe_results VALUES ('JUNTA_GRUPO_NUEVO_RESULT', v_result);

  -- (1) La Junta emite con destinatarios SOCIOS (rama nueva del trigger
  -- compartido): fuente capital_holdings, 2 de 2 seleccionados, y los dos
  -- holders reales de Corporación Nueva presentes por email.
  INSERT INTO probe_results VALUES (
    'JUNTA_RECIPIENTS_CHECK',
    jsonb_build_object(
      'source', v_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' ->> 'source',
      'seat_roles', v_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' -> 'seat_roles',
      'total_active', v_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' ->> 'total_active',
      'selected_count', v_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' ->> 'selected_count',
      'recipients_count', jsonb_array_length(v_result -> 'manifest' -> 'manifest_json' -> 'recipients'),
      'recipient_emails', (
        SELECT jsonb_agg(recipient ->> 'email' ORDER BY recipient ->> 'email')
          FROM jsonb_array_elements(v_result -> 'manifest' -> 'manifest_json' -> 'recipients') recipient
      )
    )
  );

  RESET ROLE;

  SELECT count(*) INTO v_arga_count_tras_junta
    FROM public.convocatorias c
    JOIN public.governing_bodies gb ON gb.id = c.body_id
   WHERE gb.tenant_id = '00000000-0000-0000-0000-000000000001';

  -- Smoke test únicamente: reemite (con los mismos textos ya validados) un
  -- Consejo de ARGA para comprobar que fn_emit_convocatoria (la RPC de
  -- Consejo, que esta migración NO toca) sigue admitiendo una emisión.
  SELECT * INTO v_cda_row
    FROM public.convocatorias
   WHERE id = v_cda_reference_convocatoria_id;

  v_cda_payload := jsonb_build_object(
    'body_id', v_cda_row.body_id,
    'fecha_1', v_cda_row.fecha_1,
    'fecha_2', v_cda_row.fecha_2,
    'lugar', v_cda_row.lugar,
    'modalidad', v_cda_row.modalidad,
    'tipo_convocatoria', v_cda_row.tipo_convocatoria,
    'junta_universal', v_cda_row.junta_universal,
    'is_second_call', v_cda_row.is_second_call,
    'urgente', v_cda_row.urgente,
    'agenda_items', v_cda_row.agenda_items,
    'publication_channels', to_jsonb(v_cda_row.publication_channels),
    'convocatoria_text', v_cda_row.convocatoria_text,
    'statutory_basis', v_cda_row.statutory_basis,
    -- Mismo trace ya validado de la convocatoria CDA original: el recuento
    -- de condiciones_persona vigentes para este órgano no ha cambiado desde
    -- que se emitió (16/16, sin exclusiones); si hubiera cambiado, la rama
    -- CDA (sin tocar) lo detectaría con CENSUS_MISMATCH, que es lo correcto.
    'reminders_trace', v_cda_row.reminders_trace
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_secretario_nuevo, 'role', 'authenticated')::text,
    true
  );
  SET LOCAL ROLE authenticated;

  v_cda_result := public.fn_emit_convocatoria(v_cda_payload);
  INSERT INTO probe_results VALUES ('CDA_ARGA_REPLAY_SMOKE_TEST_RESULT', v_cda_result);

  -- (2) El Consejo de ARGA sigue enriqueciéndose EXACTAMENTE igual (rama CDA
  -- sin tocar): misma fuente condiciones_persona, mismo recuento que el
  -- reminders_trace ya validado que se reutilizó (16/16).
  INSERT INTO probe_results VALUES (
    'CDA_RECIPIENTS_CHECK',
    jsonb_build_object(
      'source', v_cda_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' ->> 'source',
      'total_active', v_cda_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' ->> 'total_active',
      'selected_count', v_cda_result -> 'manifest' -> 'manifest_json' -> 'recipient_selection' ->> 'selected_count',
      'recipients_count', jsonb_array_length(v_cda_result -> 'manifest' -> 'manifest_json' -> 'recipients')
    )
  );

  RESET ROLE;

  SELECT count(*) INTO v_arga_count_tras_cda
    FROM public.convocatorias c
    JOIN public.governing_bodies gb ON gb.id = c.body_id
   WHERE gb.tenant_id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO probe_results VALUES (
    'ARGA_CONVOCATORIAS_COUNT',
    jsonb_build_object(
      'antes', v_arga_count_antes,
      'tras_emitir_junta_grupo_nuevo', v_arga_count_tras_junta,
      'tras_smoke_test_cda', v_arga_count_tras_cda,
      'junta_no_afecta_arga', v_arga_count_antes = v_arga_count_tras_junta,
      'smoke_test_cda_no_afecta_arga', v_arga_count_tras_cda = v_arga_count_tras_junta
    )
  );
END
$probe$;

-- Resultado completo de la emisión de la Junta (estado, fecha_emision,
-- immutable_at del manifiesto, id de la convocatoria).
select
  etiqueta,
  valor -> 'convocatoria' ->> 'estado' as estado,
  valor -> 'convocatoria' ->> 'fecha_emision' as fecha_emision,
  valor -> 'convocatoria' ->> 'fecha_1' as fecha_1,
  valor -> 'convocatoria' ->> 'convocation_authority_route' as authority_route,
  valor -> 'manifest' ->> 'immutable_at' as manifest_immutable_at,
  valor -> 'convocatoria' ->> 'id' as convocatoria_id
from probe_results
where etiqueta in ('JUNTA_GRUPO_NUEVO_RESULT', 'CDA_ARGA_REPLAY_SMOKE_TEST_RESULT');

-- Recuentos de ARGA (antes / tras Junta / tras smoke test de Consejo).
select etiqueta, valor from probe_results where etiqueta = 'ARGA_CONVOCATORIAS_COUNT';

-- (1) y (2): destinatarios derivados por la rama JUNTA nueva vs. la rama CDA
-- sin tocar, en el MISMO trigger compartido.
select etiqueta, valor from probe_results
where etiqueta in ('JUNTA_RECIPIENTS_CHECK', 'CDA_RECIPIENTS_CHECK');

-- Debe ser exactamente 1: (tenant …0003, ese órgano, esa fecha_1) — no se
-- duplica ninguna fila sembrada (no había ninguna previa para esta Junta).
select 'JUNTA_0003_UNICA_PARA_TENANT_ORGANO_FECHA' as etiqueta, count(*) as filas
from public.convocatorias c
where c.tenant_id = '00000000-0000-0000-0000-000000000003'
  and c.body_id = 'ceee9767-0bbf-4bf7-a2a9-6a812414e4bb'
  and c.fecha_1 = (
    select (valor -> 'convocatoria' ->> 'fecha_1')::timestamptz
      from probe_results
     where etiqueta = 'JUNTA_GRUPO_NUEVO_RESULT'
  );

-- Garrigues (…0002) no se toca en absoluto por este ensayo: su única
-- convocatoria sigue en BORRADOR, ni pisada ni duplicada.
select 'GARRIGUES_UNICA_CONVOCATORIA_SIGUE_BORRADOR' as etiqueta, count(*) as filas
from public.convocatorias
where tenant_id = '00000000-0000-0000-0000-000000000002'
  and estado = 'BORRADOR';

rollback;
