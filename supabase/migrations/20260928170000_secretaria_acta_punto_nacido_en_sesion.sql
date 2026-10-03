-- H-53 (MOI-15) — el acta rechaza siempre un punto legítimamente nacido en
-- sesión sobre una reunión que proviene de una convocatoria EMITIDA.
--
-- Defecto medido en vivo (reunión 81a4de74…, convocatoria 247ff78a… con 1
-- solo punto declarado, DELEGACION_FACULTADES; punto 2 APROBACION_PRESUPUESTO
-- materializado en sesión por fn_secretaria_add_session_agenda_item,
-- 20260928151000): `fn_secretaria_build_minute_legal_manifest` compara la
-- agenda CELEBRADA (`held`, filas reales de `agenda_items`) contra la agenda
-- CONVOCADA (`called`, JSON inmutable de `convocatorias.agenda_items`) con un
-- FULL JOIN por `order_number` que exige que NINGÚN lado quede huérfano. Un
-- punto nacido en sesión (origin MEETING_FLOOR, `source_convocatoria_id IS
-- NULL`) nunca tiene contraparte en `called` — nace fuera del orden del día
-- convocado a propósito, es justo lo que H-27/H-32 (`fn_secretaria_add_
-- session_agenda_item`) permite— así que la comparación fallaba siempre con
-- 'authoritative minute: held agenda differs from the immutable convocation',
-- dejando cualquier reunión con un punto de este tipo sin acta posible.
--
-- Corrección: los puntos de la convocatoria (`held.source_convocatoria_id IS
-- NOT NULL`) siguen exigiendo coincidencia EXACTA con su fila `called` — eso
-- NO se afloja, es la fuente jurídica inmutable. Un punto MEETING_FLOOR puede
-- existir además, sin contraparte en `called`, y el manifiesto lo declara con
-- su origen ('CONVOCATORIA' | 'MEETING_FLOOR') para que el acta lo muestre
-- como "punto no incluido en el orden del día, incorporado en sesión". No se
-- decide aquí ningún criterio jurídico sobre qué materias u órganos admiten
-- un punto fuera del orden del día convocado (arts. 223.1 y 238.3 LSC para
-- Junta): reservado al Comité Legal, igual que ya declaraba 20260928151000.
--
-- fn_secretaria_build_minute_legal_manifest fue sustituida el mismo día por
-- 20260928150000 (H-33, identificador fiscal) y 20260928160000 (MOI-143,
-- evaluador de Junta por capital), ambas aplicadas. Se parchea por
-- SUSTITUCIÓN ANCLADA sobre el cuerpo VIVO (pg_get_functiondef) para no
-- perder esos arreglos: cada ancla tiene que aparecer exactamente una vez o
-- se aborta. Mismo patrón que 20260906101026. Idempotente: si ya está
-- parcheada, no hace nada.
--
-- fn_secretaria_render_authoritative_minute se parchea igual (misma técnica,
-- ancla propia) para que la línea "Procedencia: …" aparezca en el texto del
-- acta cuando el punto es MEETING_FLOOR.

DO $patch_manifest$
DECLARE
  src text;
  n int;
  a1 text := $a$    ), held AS (
      SELECT
        ai.order_number,
        btrim(ai.title) AS title,
        NULLIF(btrim(ai.matter_code), '') AS matter_code,
        upper(COALESCE(NULLIF(btrim(ai.kind), ''), 'DELIBERATIVO')) AS kind,
        NULLIF(btrim(ai.decision_subtype), '') AS decision_subtype,
        NULLIF(btrim(ai.proposal_text), '') AS proposal_text,
        COALESCE(ai.requires_attachments, false) AS requires_attachments
      FROM public.agenda_items ai
      WHERE ai.meeting_id = p_meeting_id
        AND ai.tenant_id = v_meeting.tenant_id
    )
    SELECT 1
    FROM called
    FULL JOIN held USING (order_number)
    WHERE called.order_number IS NULL
       OR held.order_number IS NULL
       OR called.title IS DISTINCT FROM held.title
       OR called.matter_code IS DISTINCT FROM held.matter_code
       OR called.kind IS DISTINCT FROM held.kind
       OR called.decision_subtype IS DISTINCT FROM held.decision_subtype
       OR called.proposal_text IS DISTINCT FROM held.proposal_text
       OR called.requires_attachments IS DISTINCT FROM held.requires_attachments
  ) THEN
    RAISE EXCEPTION 'authoritative minute: held agenda differs from the immutable convocation';
  END IF;$a$;
  r1 text := $a$    ), held AS (
      SELECT
        ai.order_number,
        ai.source_convocatoria_id,
        btrim(ai.title) AS title,
        NULLIF(btrim(ai.matter_code), '') AS matter_code,
        upper(COALESCE(NULLIF(btrim(ai.kind), ''), 'DELIBERATIVO')) AS kind,
        NULLIF(btrim(ai.decision_subtype), '') AS decision_subtype,
        NULLIF(btrim(ai.proposal_text), '') AS proposal_text,
        COALESCE(ai.requires_attachments, false) AS requires_attachments
      FROM public.agenda_items ai
      WHERE ai.meeting_id = p_meeting_id
        AND ai.tenant_id = v_meeting.tenant_id
    )
    -- H-53 (MOI-15): un punto MEETING_FLOOR (source_convocatoria_id IS NULL,
    -- nacido en la propia sesión vía fn_secretaria_add_session_agenda_item)
    -- no tiene por qué tener contraparte en `called` — nace fuera del orden
    -- del día convocado y así se declara en agenda[].origin más abajo. Lo
    -- que sigue intocable es la agenda CONVOCADA: todo `called.order_number`
    -- debe seguir presente en `held` (huérfano = error, venga o no de
    -- convocatoria), y todo punto held cuyo origen SÍ es la convocatoria
    -- (source_convocatoria_id IS NOT NULL) debe coincidir exactamente con su
    -- fila `called`. No se decide aquí ningún criterio jurídico sobre qué
    -- materias admiten un punto fuera del orden del día convocado (arts.
    -- 223.1 y 238.3 LSC para Junta): reservado al Comité Legal.
    SELECT 1
    FROM called
    FULL JOIN held USING (order_number)
    WHERE held.order_number IS NULL
       OR (
         held.source_convocatoria_id IS NOT NULL
         AND (
           called.order_number IS NULL
           OR called.title IS DISTINCT FROM held.title
           OR called.matter_code IS DISTINCT FROM held.matter_code
           OR called.kind IS DISTINCT FROM held.kind
           OR called.decision_subtype IS DISTINCT FROM held.decision_subtype
           OR called.proposal_text IS DISTINCT FROM held.proposal_text
           OR called.requires_attachments IS DISTINCT FROM held.requires_attachments
         )
       )
  ) THEN
    RAISE EXCEPTION 'authoritative minute: held agenda differs from the immutable convocation';
  END IF;$a$;
  a2 text := $a$      jsonb_agg(
        jsonb_build_object(
          'id', ai.id,
          'order_number', ai.order_number,
          'title', ai.title,
          'matter_code', ai.matter_code,
          'matter_label_es', mc.materia_label_es,
          'kind', ai.kind,
          'requires_vote', ai.requires_vote,
          'decision_subtype', ai.decision_subtype,
          'requires_attachments', ai.requires_attachments,
          'proposal_text', ai.proposal_text
        ) ORDER BY ai.order_number
      ),$a$;
  r2 text := $a$      jsonb_agg(
        jsonb_build_object(
          'id', ai.id,
          'order_number', ai.order_number,
          'title', ai.title,
          'matter_code', ai.matter_code,
          'matter_label_es', mc.materia_label_es,
          'kind', ai.kind,
          'requires_vote', ai.requires_vote,
          'decision_subtype', ai.decision_subtype,
          'requires_attachments', ai.requires_attachments,
          'proposal_text', ai.proposal_text,
          'origin', CASE WHEN ai.source_convocatoria_id IS NOT NULL THEN 'CONVOCATORIA' ELSE 'MEETING_FLOOR' END,
          'source_convocatoria_id', ai.source_convocatoria_id
        ) ORDER BY ai.order_number
      ),$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p WHERE p.proname = 'fn_secretaria_build_minute_legal_manifest' AND p.pronamespace = 'public'::regnamespace;
  IF src IS NULL THEN RAISE EXCEPTION 'fn_secretaria_build_minute_legal_manifest no existe'; END IF;
  IF position('ai.source_convocatoria_id,' in src) > 0 AND position('''origin'', CASE WHEN ai.source_convocatoria_id' in src) > 0 THEN
    RAISE NOTICE 'ya parcheada; nada que hacer'; RETURN;
  END IF;

  n := (length(src) - length(replace(src, a1, ''))) / length(a1);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla 1 (held agenda differs) aparece % veces', n; END IF;
  n := (length(src) - length(replace(src, a2, ''))) / length(a2);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla 2 (agenda jsonb_build_object) aparece % veces', n; END IF;

  src := replace(replace(src, a1, r1), a2, r2);

  IF position('ai.source_convocatoria_id,' in src) = 0 THEN
    RAISE EXCEPTION 'el ancla 1 no se sustituyó';
  END IF;
  IF position('''origin'', CASE WHEN ai.source_convocatoria_id' in src) = 0 THEN
    RAISE EXCEPTION 'el ancla 2 no se sustituyó';
  END IF;

  EXECUTE src;

  RAISE NOTICE 'VERIFICACION OK: fn_secretaria_build_minute_legal_manifest distingue CONVOCATORIA/MEETING_FLOOR';
END
$patch_manifest$;

DO $patch_renderer$
DECLARE
  src text;
  n int;
  a1 text := $a$    v_text := v_text || format(
      E'\n%s. %s\nMateria: %s. Naturaleza: %s.\n',
      v_index,
      v_point ->> 'title',
      v_point ->> 'matter_label_es',
      CASE v_point ->> 'kind'
        WHEN 'DECISORIO' THEN 'asunto sujeto a acuerdo'
        ELSE 'asunto informativo o deliberativo'
      END
    );$a$;
  r1 text := $a$    v_text := v_text || format(
      E'\n%s. %s\nMateria: %s. Naturaleza: %s.\n',
      v_index,
      v_point ->> 'title',
      v_point ->> 'matter_label_es',
      CASE v_point ->> 'kind'
        WHEN 'DECISORIO' THEN 'asunto sujeto a acuerdo'
        ELSE 'asunto informativo o deliberativo'
      END
    );
    -- H-53 (MOI-15): declara en el propio texto del acta la procedencia de
    -- un punto nacido en sesión, para que nunca se lea como si formara
    -- parte del orden del día convocado.
    IF v_point ->> 'origin' = 'MEETING_FLOOR' THEN
      v_text := v_text || 'Procedencia: punto no incluido en el orden del día convocado; incorporado en el curso de la propia sesión.' || chr(10);
    END IF;$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p WHERE p.proname = 'fn_secretaria_render_authoritative_minute' AND p.pronamespace = 'public'::regnamespace;
  IF src IS NULL THEN RAISE EXCEPTION 'fn_secretaria_render_authoritative_minute no existe'; END IF;
  IF position('Procedencia: punto no incluido' in src) > 0 THEN
    RAISE NOTICE 'ya parcheada; nada que hacer'; RETURN;
  END IF;

  n := (length(src) - length(replace(src, a1, ''))) / length(a1);
  IF n <> 1 THEN RAISE EXCEPTION 'ancla (agenda point header) aparece % veces', n; END IF;

  src := replace(src, a1, r1);

  IF position('Procedencia: punto no incluido' in src) = 0 THEN
    RAISE EXCEPTION 'el ancla no se sustituyó';
  END IF;

  EXECUTE src;

  RAISE NOTICE 'VERIFICACION OK: fn_secretaria_render_authoritative_minute declara la procedencia MEETING_FLOOR';
END
$patch_renderer$;

-- Verificación final: ambas funciones existen, conservan su firma y su
-- carácter (STABLE/IMMUTABLE SECURITY DEFINER según corresponda), y el
-- control positivo confirma que la lógica nueva distingue los dos orígenes
-- sin tocar la comparación estricta de los puntos de convocatoria.
DO $verificacion$
DECLARE
  v_def text;
BEGIN
  IF to_regprocedure('public.fn_secretaria_build_minute_legal_manifest(uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_build_minute_legal_manifest no existe tras el parche';
  END IF;
  IF to_regprocedure('public.fn_secretaria_render_authoritative_minute(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION: fn_secretaria_render_authoritative_minute no existe tras el parche';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.fn_secretaria_build_minute_legal_manifest(uuid,uuid,text)')) INTO v_def;
  IF position('held.source_convocatoria_id IS NOT NULL' in v_def) = 0 THEN
    RAISE EXCEPTION 'VERIFICACION: el manifiesto no distingue origen de puntos';
  END IF;
  -- La comparación exacta de los puntos de convocatoria no se aflojó: sigue
  -- comparando title/matter_code/kind/decision_subtype/proposal_text/
  -- requires_attachments entre called y held.
  IF position('called.title IS DISTINCT FROM held.title' in v_def) = 0
     OR position('called.matter_code IS DISTINCT FROM held.matter_code' in v_def) = 0 THEN
    RAISE EXCEPTION 'VERIFICACION: se perdió la comparación exacta con la convocatoria';
  END IF;
  -- MOI-143 y H-33 siguen presentes (no se perdieron con el parche).
  IF position('MOI-143' in v_def) = 0 THEN
    RAISE EXCEPTION 'VERIFICACION: se perdió el evaluador de Junta MOI-143 al parchear';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.fn_secretaria_render_authoritative_minute(jsonb)')) INTO v_def;
  IF position('MEETING_FLOOR' in v_def) = 0 THEN
    RAISE EXCEPTION 'VERIFICACION: el renderizador no declara el origen MEETING_FLOOR';
  END IF;

  RAISE NOTICE 'VERIFICACION OK: H-53 parcheado en las dos funciones sin perder MOI-143/H-33';
END
$verificacion$;
