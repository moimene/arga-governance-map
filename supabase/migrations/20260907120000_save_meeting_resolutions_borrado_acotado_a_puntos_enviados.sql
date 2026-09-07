-- fn_save_meeting_resolutions borraba TODAS las resoluciones de la reunión y
-- TODOS sus votos, y reinsertaba únicamente lo que trajera el cliente. Lo que
-- la pantalla no enviaba desaparecía con su `agreement_id` dentro, así que un
-- guardado desde el stepper podía dejar acuerdos huérfanos sin que nadie lo
-- viera. Medido 2026-09-07 en governance_OS: la Junta de socios de Garrigues
-- (e0beed92-60f0-49e7-81c3-0ae5a54c9d56, DRAFT) tiene 10 meeting_resolutions
-- sembradas, todas con `agreement_id` y con `required_majority_code` NULL a
-- propósito, en los índices 1,2,3,4,5,7,8,11,12,13.
--
-- Pasa a sustitución ACOTADA: el borrado sólo alcanza los `agenda_item_index`
-- que vienen en p_rows, que son exactamente los que se van a reinsertar. Un
-- punto que el cliente no envía conserva su resolución, sus votos y su enlace
-- al acuerdo.
--
-- Techo declarado: si un punto deja de ser decisorio, su resolución sobrevive
-- hasta que alguien la retire de forma explícita — hoy no hay ese camino. Se
-- prefiere una fila de más, visible y corregible, a un borrado silencioso que
-- no se puede deshacer.
--
-- Se parchea por SUSTITUCIÓN ANCLADA sobre el cuerpo vivo, igual que
-- 20260906101026, para no retranscribir ~300 líneas ni pisar aquel parche: el
-- ancla tiene que aparecer exactamente una vez o se aborta. Idempotente.
DO $patch$
DECLARE
  src text;
  n int;
  a1 text := $a$  DELETE FROM meeting_votes mv
   WHERE mv.resolution_id IN (
     SELECT mr.id
       FROM meeting_resolutions mr
      WHERE mr.tenant_id = p_tenant_id
        AND mr.meeting_id = p_meeting_id
   );

  DELETE FROM meeting_resolutions mr
   WHERE mr.tenant_id = p_tenant_id
     AND mr.meeting_id = p_meeting_id;$a$;
  r1 text := $a$  -- Sustitución ACOTADA (2026-09-07): el borrado alcanza SÓLO los puntos
  -- que vienen en p_rows, que son los que se reinsertan justo debajo. Antes
  -- barría la reunión entera y se llevaba por delante las resoluciones que la
  -- pantalla no había cargado, con su agreement_id dentro.
  DELETE FROM meeting_votes mv
   WHERE mv.resolution_id IN (
     SELECT mr.id
       FROM meeting_resolutions mr
      WHERE mr.tenant_id = p_tenant_id
        AND mr.meeting_id = p_meeting_id
        AND mr.agenda_item_index IN (
          SELECT (value ->> 'agenda_item_index')::integer
            FROM jsonb_array_elements(v_prepared)
        )
   );

  DELETE FROM meeting_resolutions mr
   WHERE mr.tenant_id = p_tenant_id
     AND mr.meeting_id = p_meeting_id
     AND mr.agenda_item_index IN (
       SELECT (value ->> 'agenda_item_index')::integer
         FROM jsonb_array_elements(v_prepared)
     );$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p
   WHERE p.proname = 'fn_save_meeting_resolutions'
     AND p.pronamespace = 'public'::regnamespace;
  IF src IS NULL THEN RAISE EXCEPTION 'fn_save_meeting_resolutions no existe'; END IF;

  IF position('AND mr.agenda_item_index IN (' in src) > 0 THEN
    RAISE NOTICE 'ya acotada; nada que hacer'; RETURN;
  END IF;

  n := (length(src) - length(replace(src, a1, ''))) / length(a1);
  IF n <> 1 THEN RAISE EXCEPTION 'el ancla del borrado aparece % veces, no 1', n; END IF;

  src := replace(src, a1, r1);

  -- Verificación del parche: los dos DELETE tienen que haber quedado acotados.
  n := (length(src) - length(replace(src, 'AND mr.agenda_item_index IN (', '')))
       / length('AND mr.agenda_item_index IN (');
  IF n <> 2 THEN RAISE EXCEPTION 'tras el parche hay % borrados acotados, no 2', n; END IF;

  EXECUTE src;
END
$patch$;
