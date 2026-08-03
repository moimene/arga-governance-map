-- JGA end-to-end consistency:
--   1) attendees persist represented capital as a percentage, but titles and
--      voting rights as numeric counts (never reuse the decimal percentage);
--   2) the active Junta convocatoria template distinguishes meeting type from
--      legal form when selecting the SA/SL notice-period paragraph.

BEGIN;

ALTER TABLE public.meeting_attendees
  ALTER COLUMN shares_represented TYPE numeric
    USING shares_represented::numeric,
  ALTER COLUMN voting_rights TYPE numeric
    USING voting_rights::numeric;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.meeting_attendees'::regclass
       AND conname = 'meeting_attendees_shares_nonnegative'
  ) THEN
    ALTER TABLE public.meeting_attendees
      ADD CONSTRAINT meeting_attendees_shares_nonnegative
      CHECK (shares_represented IS NULL OR shares_represented >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.meeting_attendees'::regclass
       AND conname = 'meeting_attendees_voting_rights_nonnegative'
  ) THEN
    ALTER TABLE public.meeting_attendees
      ADD CONSTRAINT meeting_attendees_voting_rights_nonnegative
      CHECK (voting_rights IS NULL OR voting_rights >= 0);
  END IF;
END
$constraints$;

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = replace(
         replace(
           capa1_inmutable,
           '(eq meetings.junta.tipo_junta "SA")',
           '(eq meetings.junta.forma_social "SA")'
         ),
         '(eq meetings.junta.tipo_junta "SL")',
         '(eq meetings.junta.forma_social "SL")'
       ),
       capa2_variables = CASE
         WHEN NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(COALESCE(capa2_variables, '[]'::jsonb)) AS item
            WHERE item->>'variable' = 'meetings.junta.forma_social'
         )
         THEN COALESCE(capa2_variables, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'fuente', 'entities.legal_form',
             'variable', 'meetings.junta.forma_social',
             'condicion', 'siempre'
           )
         )
         ELSE capa2_variables
       END,
       version = '1.2.2',
       notas_legal = concat_ws(
         E'\n',
         NULLIF(notas_legal, ''),
         'v1.2.2: el plazo SA/SL se resuelve por forma social; tipo_junta queda reservado para ordinaria/extraordinaria.'
       )
 WHERE id = '8dcfc85c-9422-4456-aa31-ceea5da6d64d'
   AND tipo = 'CONVOCATORIA'
   AND organo_tipo = 'JUNTA_GENERAL'
   AND estado = 'ACTIVA'
   AND version = '1.2.1';

DO $verify$
DECLARE
  v_bad_columns integer;
  v_bad_template integer;
BEGIN
  SELECT count(*) INTO v_bad_columns
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'meeting_attendees'
     AND column_name IN ('shares_represented', 'voting_rights')
     AND data_type <> 'numeric';

  IF v_bad_columns <> 0 THEN
    RAISE EXCEPTION 'meeting_attendees title/vote columns must be numeric';
  END IF;

  SELECT count(*) INTO v_bad_template
    FROM public.plantillas_protegidas
   WHERE id = '8dcfc85c-9422-4456-aa31-ceea5da6d64d'
     AND (
       version <> '1.2.2'
       OR capa1_inmutable LIKE '%(eq meetings.junta.tipo_junta "SA")%'
       OR capa1_inmutable LIKE '%(eq meetings.junta.tipo_junta "SL")%'
       OR capa1_inmutable NOT LIKE '%(eq meetings.junta.forma_social "SA")%'
       OR capa1_inmutable NOT LIKE '%(eq meetings.junta.forma_social "SL")%'
     );

  IF v_bad_template <> 0 THEN
    RAISE EXCEPTION 'active Junta convocatoria template still mixes meeting type and legal form';
  END IF;
END
$verify$;

COMMIT;
