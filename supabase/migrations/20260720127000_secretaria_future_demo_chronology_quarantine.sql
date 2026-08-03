-- Secretaría — cuarentena forward-only de cronologías demo futuras imposibles.
--
-- Fecha de control del saneamiento: 20-07-2026 (Europe/Madrid). Este lote se
-- limita al tenant demo, a ARGA Seguros S.A. canónica y a filas creadas antes
-- del inicio de esa fecha. El doble corte impide que una restauración o una
-- reaplicación alcance reuniones futuras legítimas creadas con posterioridad.
-- No borra hechos ni
-- inventa convocatoria, entrega, firma o archivo EAD: conserva primero un
-- testigo WORM de los datos históricos, los clasifica sin efecto jurídico y
-- neutraliza sus proyecciones signed_at/is_locked/signature_status para que una
-- sesión futura no figure como celebrada, aprobada, firmada o certificada.

BEGIN;

CREATE TABLE IF NOT EXISTS public.secretaria_demo_simulation_quarantine (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  entity_id                  uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  meeting_id                 uuid NOT NULL REFERENCES public.meetings(id) ON DELETE RESTRICT,
  control_date               date NOT NULL,
  scheduled_start            timestamptz NOT NULL,
  reason_code                text NOT NULL
    CHECK (reason_code = 'FUTURE_EVENT_IMPOSSIBLE_CHRONOLOGY'),
  legal_effect               text NOT NULL
    CHECK (legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'),
  original_meeting_status    text NOT NULL,
  remediated_meeting_status  text NOT NULL
    CHECK (remediated_meeting_status IN ('DRAFT', 'CONVOCADA', 'CANCELADA')),
  original_minutes           jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_certifications    jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_resolutions       jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_agreements        jsonb NOT NULL DEFAULT '[]'::jsonb,
  immutable_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_id, meeting_id, control_date, reason_code)
);

COMMENT ON TABLE public.secretaria_demo_simulation_quarantine IS
  'Registro WORM de cronologías demo futuras reclasificadas sin efecto jurídico; conserva los estados originales y no acredita actos, entregas ni servicios EAD.';

ALTER TABLE public.secretaria_demo_simulation_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_demo_simulation_quarantine_read
  ON public.secretaria_demo_simulation_quarantine;
CREATE POLICY secretaria_demo_simulation_quarantine_read
  ON public.secretaria_demo_simulation_quarantine FOR SELECT
  USING (
    public.fn_secretaria_is_service_role() IS TRUE
    OR tenant_id = public.fn_secretaria_current_tenant_id()
  );

REVOKE ALL ON TABLE public.secretaria_demo_simulation_quarantine
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.secretaria_demo_simulation_quarantine
  TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_secretaria_demo_simulation_quarantine_append_only
  ON public.secretaria_demo_simulation_quarantine;
CREATE TRIGGER trg_secretaria_demo_simulation_quarantine_append_only
  BEFORE UPDATE OR DELETE ON public.secretaria_demo_simulation_quarantine
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_authoritative_append_only_guard();

DROP TRIGGER IF EXISTS trg_audit_worm_secretaria_demo_simulation_quarantine
  ON public.secretaria_demo_simulation_quarantine;
CREATE TRIGGER trg_audit_worm_secretaria_demo_simulation_quarantine
  AFTER INSERT ON public.secretaria_demo_simulation_quarantine
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

-- La referencia a convocatoria solo se considera si ya estaba enlazada en la
-- reunión y resuelve exactamente a una convocatoria EMITIDA e inmutable del
-- mismo tenant, órgano y fecha. No se busca una coincidencia aproximada ni se
-- crea un enlace nuevo.
CREATE TEMP TABLE future_demo_chronology_targets ON COMMIT DROP AS
WITH scoped AS (
  SELECT
    meeting.id AS meeting_id,
    meeting.tenant_id,
    body.entity_id,
    meeting.scheduled_start,
    meeting.status AS original_meeting_status,
    COALESCE(
      NULLIF(meeting.quorum_data #>> '{source_links,convocatoria_id}', ''),
      NULLIF(meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '')
    ) AS linked_convocation_ref
  FROM public.meetings meeting
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE meeting.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
), classified AS (
  SELECT
    scoped.*,
    CASE
      WHEN scoped.original_meeting_status NOT IN ('EN_CURSO', 'CELEBRADA')
        THEN scoped.original_meeting_status
      WHEN scoped.linked_convocation_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND EXISTS (
         SELECT 1
         FROM public.convocatorias convocation
         JOIN public.meetings meeting_scope
           ON meeting_scope.id = scoped.meeting_id
          AND meeting_scope.tenant_id = scoped.tenant_id
         WHERE convocation.id = scoped.linked_convocation_ref::uuid
           AND convocation.tenant_id = scoped.tenant_id
           AND convocation.body_id = meeting_scope.body_id
           AND convocation.estado = 'EMITIDA'
           AND convocation.immutable_at IS NOT NULL
           AND timezone('Europe/Madrid', convocation.fecha_1)::date
               = timezone('Europe/Madrid', scoped.scheduled_start)::date
       ) THEN 'CONVOCADA'
      ELSE 'DRAFT'
    END AS remediated_meeting_status
  FROM scoped
)
SELECT
  classified.*,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', minute.id,
        'legal_gate_status', minute.legal_gate_status,
        'signed_at', minute.signed_at,
        'is_locked', minute.is_locked,
        'book_destination_status', minute.book_destination_status,
        'book_entry_id', minute.book_entry_id
      ) ORDER BY minute.id
    )
    FROM public.minutes minute
    WHERE minute.tenant_id = classified.tenant_id
      AND minute.meeting_id = classified.meeting_id
  ), '[]'::jsonb) AS original_minutes,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', certification.id,
        'minute_id', certification.minute_id,
        'legal_gate_status', certification.legal_gate_status,
        'signature_status', certification.signature_status,
        'emitted_at', certification.emitted_at
      ) ORDER BY certification.id
    )
    FROM public.certifications certification
    JOIN public.minutes minute
      ON minute.id = certification.minute_id
     AND minute.tenant_id = certification.tenant_id
    WHERE certification.tenant_id = classified.tenant_id
      AND minute.meeting_id = classified.meeting_id
  ), '[]'::jsonb) AS original_certifications,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', resolution.id,
        'status', resolution.status,
        'agreement_id', resolution.agreement_id
      ) ORDER BY resolution.id
    )
    FROM public.meeting_resolutions resolution
    WHERE resolution.tenant_id = classified.tenant_id
      AND resolution.meeting_id = classified.meeting_id
  ), '[]'::jsonb) AS original_resolutions,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', agreement.id,
        'status', agreement.status,
        'decision_date', agreement.decision_date,
        'effective_date', agreement.effective_date
      ) ORDER BY agreement.id
    )
    FROM public.agreements agreement
    WHERE agreement.tenant_id = classified.tenant_id
      AND agreement.entity_id = classified.entity_id
      AND agreement.parent_meeting_id = classified.meeting_id
  ), '[]'::jsonb) AS original_agreements
FROM classified
WHERE classified.original_meeting_status IN ('EN_CURSO', 'CELEBRADA')
   OR EXISTS (
     SELECT 1 FROM public.minutes minute
     WHERE minute.tenant_id = classified.tenant_id
       AND minute.meeting_id = classified.meeting_id
       AND minute.legal_gate_status <> 'DEMO_SIMULATION'
   )
   OR EXISTS (
     SELECT 1
     FROM public.certifications certification
     JOIN public.minutes minute
       ON minute.id = certification.minute_id
      AND minute.tenant_id = certification.tenant_id
     WHERE certification.tenant_id = classified.tenant_id
       AND minute.meeting_id = classified.meeting_id
       AND certification.legal_gate_status <> 'DEMO_SIMULATION'
   )
   OR EXISTS (
     SELECT 1 FROM public.meeting_resolutions resolution
     WHERE resolution.tenant_id = classified.tenant_id
       AND resolution.meeting_id = classified.meeting_id
       AND upper(COALESCE(resolution.status, '')) IN ('APPROVED', 'ADOPTED')
   )
   OR EXISTS (
     SELECT 1 FROM public.agreements agreement
     WHERE agreement.tenant_id = classified.tenant_id
       AND agreement.entity_id = classified.entity_id
       AND agreement.parent_meeting_id = classified.meeting_id
       AND agreement.status IN (
         'ADOPTED', 'CERTIFIED', 'INSTRUMENTED', 'FILED',
         'REGISTERED', 'REJECTED_REGISTRY', 'PUBLISHED'
       )
   );

-- Primero se conserva un testigo WORM de los estados originales. El conflicto
-- único hace que una reaplicación sea no-op y nunca reescriba el testigo.
INSERT INTO public.secretaria_demo_simulation_quarantine (
  tenant_id,
  entity_id,
  meeting_id,
  control_date,
  scheduled_start,
  reason_code,
  legal_effect,
  original_meeting_status,
  remediated_meeting_status,
  original_minutes,
  original_certifications,
  original_resolutions,
  original_agreements
)
SELECT
  target.tenant_id,
  target.entity_id,
  target.meeting_id,
  DATE '2026-07-20',
  target.scheduled_start,
  'FUTURE_EVENT_IMPOSSIBLE_CHRONOLOGY',
  'DEMO_SIMULATION_NO_LEGAL_EFFECT',
  target.original_meeting_status,
  target.remediated_meeting_status,
  target.original_minutes,
  target.original_certifications,
  target.original_resolutions,
  target.original_agreements
FROM pg_temp.future_demo_chronology_targets target
ON CONFLICT (tenant_id, entity_id, meeting_id, control_date, reason_code)
DO NOTHING;

-- Las dos guardas de dominio impiden correctamente degradar un artefacto final.
-- Para este saneamiento extraordinario se suspenden solo esas guardas, bajo el
-- lock DDL de la misma transacción, y se reactivan inmediatamente. No se toca
-- ningún contenido, hash, firmante, sello, referencia de proveedor ni asiento
-- WORM. Después se aplica DEMO_SIMULATION y se neutralizan las proyecciones de
-- firma/emisión; el testigo inmutable anterior conserva sus valores originales.
ALTER TABLE public.certifications
  DISABLE TRIGGER trg_certifications_authoritative_domain_guard;

UPDATE public.certifications certification
   SET legal_gate_status = 'DEMO_SIMULATION',
       signature_status = 'PENDING',
       emitted_at = NULL
  FROM public.minutes minute,
       pg_temp.future_demo_chronology_targets target
 WHERE certification.minute_id = minute.id
   AND certification.tenant_id = minute.tenant_id
   AND minute.meeting_id = target.meeting_id
   AND minute.tenant_id = target.tenant_id
   AND target.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND target.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
   AND (
     certification.legal_gate_status <> 'DEMO_SIMULATION'
     OR certification.signature_status IS DISTINCT FROM 'PENDING'
     OR certification.emitted_at IS NOT NULL
   );

ALTER TABLE public.certifications
  ENABLE TRIGGER trg_certifications_authoritative_domain_guard;

ALTER TABLE public.minutes
  DISABLE TRIGGER trg_minutes_authoritative_domain_guard;

-- El guard legacy impediría limpiar signed_at sobre una fila previamente
-- bloqueada. Se suspende únicamente dentro de esta transacción y después de
-- haber preservado signed_at/is_locked en la tabla WORM de cuarentena.
ALTER TABLE public.minutes
  DISABLE TRIGGER trg_minutes_lock_guard;

SELECT pg_catalog.set_config('app.secretaria_book_entries_rpc', '1', true);

UPDATE public.minutes minute
   SET legal_gate_status = 'DEMO_SIMULATION',
       signed_at = NULL,
       is_locked = false,
       approval_effective_at = NULL,
       book_destination_status = CASE
         WHEN minute.book_destination_status IN ('RESOLVED', 'POSTED')
           THEN 'LEGACY_REVIEW'
         ELSE minute.book_destination_status
       END
  FROM pg_temp.future_demo_chronology_targets target
 WHERE minute.meeting_id = target.meeting_id
   AND minute.tenant_id = target.tenant_id
   AND target.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND target.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
   AND (
     minute.legal_gate_status <> 'DEMO_SIMULATION'
     OR minute.signed_at IS NOT NULL
     OR minute.is_locked IS TRUE
     OR minute.approval_effective_at IS NOT NULL
     OR minute.book_destination_status IN ('RESOLVED', 'POSTED')
   );

SELECT pg_catalog.set_config('app.secretaria_book_entries_rpc', '', true);

ALTER TABLE public.minutes
  ENABLE TRIGGER trg_minutes_lock_guard;

ALTER TABLE public.minutes
  ENABLE TRIGGER trg_minutes_authoritative_domain_guard;

-- Una resolución o un Agreement 360 conservan su literal y su snapshot como
-- historia demo, pero dejan de proyectar adopción/certificación jurídica.
UPDATE public.meeting_resolutions resolution
   SET status = 'DRAFT'
  FROM pg_temp.future_demo_chronology_targets target
 WHERE resolution.meeting_id = target.meeting_id
   AND resolution.tenant_id = target.tenant_id
   AND target.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND target.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
   AND upper(COALESCE(resolution.status, '')) IN ('APPROVED', 'ADOPTED');

UPDATE public.agreements agreement
   SET status = 'PROPOSED'
  FROM pg_temp.future_demo_chronology_targets target
 WHERE agreement.parent_meeting_id = target.meeting_id
   AND agreement.tenant_id = target.tenant_id
   AND agreement.entity_id = target.entity_id
   AND target.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND target.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
   AND agreement.status IN (
     'ADOPTED', 'CERTIFIED', 'INSTRUMENTED', 'FILED',
     'REGISTERED', 'REJECTED_REGISTRY', 'PUBLISHED'
   );

-- Al estar ya las actas fuera de los estados autoritativos, la guarda de
-- congelación permite corregir la proyección de reunión sin tocar agenda,
-- asistentes, votos o constancias. CONVOCADA solo se usa con enlace previo y
-- convocatoria EMITIDA; en cualquier otro caso se vuelve al estado DRAFT.
UPDATE public.meetings meeting
   SET status = target.remediated_meeting_status
  FROM pg_temp.future_demo_chronology_targets target
 WHERE meeting.id = target.meeting_id
   AND meeting.tenant_id = target.tenant_id
   AND target.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND target.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
   AND meeting.status IN ('EN_CURSO', 'CELEBRADA')
   AND meeting.status IS DISTINCT FROM target.remediated_meeting_status;

-- Self-check fail-closed sobre todo el perímetro futuro, no solo sobre las
-- cuatro filas observadas. Si reaparece una proyección jurídica imposible la
-- migración aborta y ninguna corrección parcial queda aplicada.
DO $function$
DECLARE
  v_illegal_meetings integer;
  v_non_demo_minutes integer;
  v_non_demo_certifications integer;
  v_projected_signed_minutes integer;
  v_projected_signed_certifications integer;
  v_adopted_resolutions integer;
  v_adopted_agreements integer;
  v_missing_worm_markers integer;
BEGIN
  SELECT count(*) INTO v_illegal_meetings
  FROM public.meetings meeting
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE meeting.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND meeting.status IN ('EN_CURSO', 'CELEBRADA');

  SELECT count(*) INTO v_non_demo_minutes
  FROM public.minutes minute
  JOIN public.meetings meeting
    ON meeting.id = minute.meeting_id
   AND meeting.tenant_id = minute.tenant_id
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE minute.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND minute.legal_gate_status <> 'DEMO_SIMULATION';

  SELECT count(*) INTO v_non_demo_certifications
  FROM public.certifications certification
  JOIN public.minutes minute
    ON minute.id = certification.minute_id
   AND minute.tenant_id = certification.tenant_id
  JOIN public.meetings meeting
    ON meeting.id = minute.meeting_id
   AND meeting.tenant_id = minute.tenant_id
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE certification.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND certification.legal_gate_status <> 'DEMO_SIMULATION';

  SELECT count(*) INTO v_projected_signed_minutes
  FROM public.minutes minute
  JOIN public.meetings meeting
    ON meeting.id = minute.meeting_id
   AND meeting.tenant_id = minute.tenant_id
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE minute.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND minute.legal_gate_status = 'DEMO_SIMULATION'
    AND (
      minute.signed_at IS NOT NULL
      OR minute.is_locked IS TRUE
      OR minute.approval_effective_at IS NOT NULL
    );

  SELECT count(*) INTO v_projected_signed_certifications
  FROM public.certifications certification
  JOIN public.minutes minute
    ON minute.id = certification.minute_id
   AND minute.tenant_id = certification.tenant_id
  JOIN public.meetings meeting
    ON meeting.id = minute.meeting_id
   AND meeting.tenant_id = minute.tenant_id
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE certification.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND certification.legal_gate_status = 'DEMO_SIMULATION'
    AND (
      certification.signature_status IS DISTINCT FROM 'PENDING'
      OR certification.emitted_at IS NOT NULL
    );

  SELECT count(*) INTO v_adopted_resolutions
  FROM public.meeting_resolutions resolution
  JOIN public.meetings meeting
    ON meeting.id = resolution.meeting_id
   AND meeting.tenant_id = resolution.tenant_id
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE resolution.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND body.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND upper(COALESCE(resolution.status, '')) IN ('APPROVED', 'ADOPTED');

  SELECT count(*) INTO v_adopted_agreements
  FROM public.agreements agreement
  JOIN public.meetings meeting
    ON meeting.id = agreement.parent_meeting_id
   AND meeting.tenant_id = agreement.tenant_id
  JOIN public.governing_bodies body
    ON body.id = meeting.body_id
   AND body.tenant_id = meeting.tenant_id
  WHERE agreement.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND agreement.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND body.entity_id = agreement.entity_id
    AND meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'
    AND timezone('Europe/Madrid', meeting.scheduled_start)::date > DATE '2026-07-20'
    AND agreement.status IN (
      'ADOPTED', 'CERTIFIED', 'INSTRUMENTED', 'FILED',
      'REGISTERED', 'REJECTED_REGISTRY', 'PUBLISHED'
    );

  SELECT count(*) INTO v_missing_worm_markers
  FROM public.secretaria_demo_simulation_quarantine quarantine
  WHERE quarantine.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND quarantine.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid
    AND quarantine.control_date = DATE '2026-07-20'
    AND quarantine.reason_code = 'FUTURE_EVENT_IMPOSSIBLE_CHRONOLOGY'
    AND NOT EXISTS (
      SELECT 1
      FROM public.audit_log audit
      WHERE audit.tenant_id = quarantine.tenant_id
        AND audit.table_name = 'secretaria_demo_simulation_quarantine'
        AND audit.record_id = quarantine.id
        AND audit.hash_sha512 ~ '^[0-9a-f]{128}$'
    );

  IF v_illegal_meetings <> 0
     OR v_non_demo_minutes <> 0
     OR v_non_demo_certifications <> 0
     OR v_projected_signed_minutes <> 0
     OR v_projected_signed_certifications <> 0
     OR v_adopted_resolutions <> 0
     OR v_adopted_agreements <> 0
     OR v_missing_worm_markers <> 0 THEN
    RAISE EXCEPTION
      'future demo chronology quarantine failed: meetings=%, minutes=%, certifications=%, minute_signatures=%, certification_signatures=%, resolutions=%, agreements=%, worm=%',
      v_illegal_meetings,
      v_non_demo_minutes,
      v_non_demo_certifications,
      v_projected_signed_minutes,
      v_projected_signed_certifications,
      v_adopted_resolutions,
      v_adopted_agreements,
      v_missing_worm_markers;
  END IF;
END;
$function$;

COMMIT;
