-- Repara expedientes demo creados antes de separar título de agenda, notas y
-- texto resolutivo. Solo alcanza acuerdos no certificados/no ejecutados y usa
-- la propuesta jurídica ya aprobada en la convocatoria enlazada; no inventa
-- contenido ni reescribe evidencia certificada.

BEGIN;

CREATE TEMP TABLE document_resolution_backfill ON COMMIT DROP AS
SELECT
  meeting.id AS meeting_id,
  resolution.id AS resolution_id,
  resolution.agreement_id,
  resolution.agenda_item_index,
  agenda_point.item->>'propuesta_acuerdo' AS resolution_text
FROM public.meetings AS meeting
JOIN public.convocatorias AS convocatoria
  ON convocatoria.id = nullif(
    meeting.quorum_data #>> '{source_links,convocatoria_id}',
    ''
  )::uuid
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(convocatoria.agenda_items, '[]'::jsonb)
) WITH ORDINALITY AS agenda_point(item, position)
JOIN public.meeting_resolutions AS resolution
  ON resolution.meeting_id = meeting.id
 AND resolution.tenant_id = meeting.tenant_id
 AND resolution.agenda_item_index = agenda_point.position
JOIN public.agreements AS agreement
  ON agreement.id = resolution.agreement_id
 AND agreement.tenant_id = meeting.tenant_id
JOIN public.agenda_items AS agenda_item
  ON agenda_item.meeting_id = meeting.id
 AND agenda_item.tenant_id = meeting.tenant_id
 AND agenda_item.order_number = resolution.agenda_item_index
WHERE agreement.status IN ('DRAFT', 'PROPOSED', 'ADOPTED')
  AND agenda_item.kind = 'DECISORIO'
  AND length(trim(COALESCE(agenda_point.item->>'propuesta_acuerdo', ''))) >= 20
  AND lower(regexp_replace(trim(resolution.resolution_text), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(agenda_item.title), '\s+', ' ', 'g'))
  AND lower(regexp_replace(trim(agenda_point.item->>'propuesta_acuerdo'), '\s+', ' ', 'g'))
      <> lower(regexp_replace(trim(agenda_item.title), '\s+', ' ', 'g'));

UPDATE public.meeting_resolutions AS resolution
SET resolution_text = backfill.resolution_text
FROM document_resolution_backfill AS backfill
WHERE resolution.id = backfill.resolution_id;

UPDATE public.agreements AS agreement
SET proposal_text = backfill.resolution_text,
    decision_text = backfill.resolution_text
FROM document_resolution_backfill AS backfill
WHERE agreement.id = backfill.agreement_id
  AND agreement.status IN ('DRAFT', 'PROPOSED', 'ADOPTED');

UPDATE public.meetings AS meeting
SET quorum_data = jsonb_set(
  meeting.quorum_data,
  '{debates}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN backfill.resolution_text IS NOT NULL
          THEN debate.item || jsonb_build_object('resolution_text', backfill.resolution_text)
        ELSE debate.item
      END
      ORDER BY debate.position
    )
    FROM jsonb_array_elements(
      COALESCE(meeting.quorum_data->'debates', '[]'::jsonb)
    ) WITH ORDINALITY AS debate(item, position)
    LEFT JOIN document_resolution_backfill AS backfill
      ON backfill.meeting_id = meeting.id
     AND backfill.agenda_item_index = COALESCE(
       CASE
         WHEN debate.item->>'source_index' ~ '^[0-9]+$'
           THEN (debate.item->>'source_index')::integer
         ELSE NULL
       END,
       debate.position::integer
     )
  ),
  true
)
WHERE EXISTS (
  SELECT 1
  FROM document_resolution_backfill AS backfill
  WHERE backfill.meeting_id = meeting.id
);

UPDATE public.meetings AS meeting
SET quorum_data = jsonb_set(
  meeting.quorum_data,
  '{point_snapshots}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN backfill.resolution_text IS NOT NULL
          THEN snapshot.item || jsonb_build_object('resolution_text', backfill.resolution_text)
        ELSE snapshot.item
      END
      ORDER BY snapshot.position
    )
    FROM jsonb_array_elements(
      COALESCE(meeting.quorum_data->'point_snapshots', '[]'::jsonb)
    ) WITH ORDINALITY AS snapshot(item, position)
    LEFT JOIN document_resolution_backfill AS backfill
      ON backfill.meeting_id = meeting.id
     AND backfill.agenda_item_index = CASE
       WHEN snapshot.item->>'agenda_item_index' ~ '^[0-9]+$'
         THEN (snapshot.item->>'agenda_item_index')::integer
       ELSE NULL
     END
  ),
  true
)
WHERE EXISTS (
  SELECT 1
  FROM document_resolution_backfill AS backfill
  WHERE backfill.meeting_id = meeting.id
)
  AND jsonb_typeof(meeting.quorum_data->'point_snapshots') = 'array';

-- Las reuniones nacidas antes del alta automática de cargos conservaban
-- president_id/secretary_id nulos. Se completan únicamente en los expedientes
-- reparados y desde authority_evidence vigente del mismo órgano.
WITH target_meetings AS (
  SELECT DISTINCT
    meeting.id AS meeting_id,
    meeting.tenant_id,
    meeting.body_id
  FROM public.meetings AS meeting
  JOIN document_resolution_backfill AS backfill ON backfill.meeting_id = meeting.id
),
officers AS (
  SELECT
    target.meeting_id,
    (
      SELECT evidence.person_id
      FROM public.authority_evidence AS evidence
      WHERE evidence.tenant_id = target.tenant_id
        AND evidence.body_id = target.body_id
        AND evidence.estado = 'VIGENTE'
        AND evidence.cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
      ORDER BY
        CASE evidence.cargo WHEN 'PRESIDENTE' THEN 0 ELSE 1 END,
        evidence.fecha_inicio DESC NULLS LAST,
        evidence.id
      LIMIT 1
    ) AS president_id,
    (
      SELECT evidence.person_id
      FROM public.authority_evidence AS evidence
      WHERE evidence.tenant_id = target.tenant_id
        AND evidence.body_id = target.body_id
        AND evidence.estado = 'VIGENTE'
        AND evidence.cargo IN ('SECRETARIO', 'VICESECRETARIO')
      ORDER BY
        CASE evidence.cargo WHEN 'SECRETARIO' THEN 0 ELSE 1 END,
        evidence.fecha_inicio DESC NULLS LAST,
        evidence.id
      LIMIT 1
    ) AS secretary_id
  FROM target_meetings AS target
)
UPDATE public.meetings AS meeting
SET president_id = COALESCE(meeting.president_id, officers.president_id),
    secretary_id = COALESCE(meeting.secretary_id, officers.secretary_id)
FROM officers
WHERE meeting.id = officers.meeting_id
  AND (meeting.president_id IS NULL OR meeting.secretary_id IS NULL);

DO $verify$
DECLARE
  v_weak integer;
  v_missing_officers integer;
BEGIN
  SELECT count(*) INTO v_weak
  FROM document_resolution_backfill AS backfill
  JOIN public.meeting_resolutions AS resolution ON resolution.id = backfill.resolution_id
  JOIN public.agreements AS agreement ON agreement.id = backfill.agreement_id
  WHERE resolution.resolution_text IS DISTINCT FROM backfill.resolution_text
     OR agreement.decision_text IS DISTINCT FROM backfill.resolution_text;

  IF v_weak <> 0 THEN
    RAISE EXCEPTION 'Resolution backfill left % inconsistent agreement(s)', v_weak;
  END IF;

  SELECT count(*) INTO v_missing_officers
  FROM public.meetings AS meeting
  WHERE EXISTS (
    SELECT 1
    FROM document_resolution_backfill AS backfill
    WHERE backfill.meeting_id = meeting.id
  )
    AND (meeting.president_id IS NULL OR meeting.secretary_id IS NULL);

  IF v_missing_officers <> 0 THEN
    RAISE EXCEPTION 'Resolution backfill left % meeting(s) without officers', v_missing_officers;
  END IF;
END
$verify$;

COMMIT;
