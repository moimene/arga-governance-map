-- ============================================================
-- SECRETARÍA SOCIETARIA — 15 TABLES + 2 TRIGGERS
-- ============================================================

-- 1. Convocatorias
CREATE TABLE IF NOT EXISTS public.convocatorias (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  body_id                 uuid REFERENCES public.governing_bodies(id),
  estado                  text NOT NULL DEFAULT 'BORRADOR',
  fecha_emision           date,
  fecha_1                 timestamptz,
  fecha_2                 timestamptz,
  is_second_call          boolean NOT NULL DEFAULT false,
  modalidad               text NOT NULL DEFAULT 'PRESENCIAL',
  junta_universal         boolean NOT NULL DEFAULT false,
  urgente                 boolean NOT NULL DEFAULT false,
  publication_channels    text[] DEFAULT '{}',
  publication_evidence_url text,
  statutory_basis         text,
  immutable_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 2. Attachments
CREATE TABLE IF NOT EXISTS public.attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  convocatoria_id     uuid REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  agenda_item_index   integer,
  file_name           text NOT NULL,
  file_url            text NOT NULL,
  file_hash           text,
  uploaded_at         timestamptz NOT NULL DEFAULT now()
);

-- 3. Meeting attendees
CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id          uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  person_id           uuid REFERENCES public.persons(id),
  attendance_type     text NOT NULL DEFAULT 'PRESENTE',
  represented_by_id   uuid REFERENCES public.persons(id),
  shares_represented  integer DEFAULT 0,
  voting_rights       integer DEFAULT 1
);

-- 4. Minutes
CREATE TABLE IF NOT EXISTS public.minutes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL,
  meeting_id                  uuid UNIQUE REFERENCES public.meetings(id),
  content                     text,
  signed_at                   timestamptz,
  signed_by_secretary_id      uuid REFERENCES public.persons(id),
  signed_by_president_id      uuid REFERENCES public.persons(id),
  registered_at               timestamptz,
  is_locked                   boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- 5. Meeting resolutions
CREATE TABLE IF NOT EXISTS public.meeting_resolutions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL,
  meeting_id            uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  agenda_item_index     integer NOT NULL,
  resolution_text       text,
  resolution_type       text DEFAULT 'ORDINARY',
  required_majority_code text DEFAULT 'SIMPLE',
  status                text DEFAULT 'APPROVED'
);

-- 6. Meeting votes
CREATE TABLE IF NOT EXISTS public.meeting_votes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id   uuid REFERENCES public.meeting_resolutions(id) ON DELETE CASCADE,
  attendee_id     uuid REFERENCES public.meeting_attendees(id),
  vote_value      text NOT NULL DEFAULT 'FOR',
  conflict_flag   boolean NOT NULL DEFAULT false,
  reason          text
);

-- 7. Certifications
CREATE TABLE IF NOT EXISTS public.certifications (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid NOT NULL,
  minute_id                     uuid REFERENCES public.minutes(id),
  content                       text,
  agreements_certified          text[] DEFAULT '{}',
  certifier_id                  uuid REFERENCES public.persons(id),
  requires_qualified_signature  boolean DEFAULT false,
  signature_status              text DEFAULT 'PENDING',
  jurisdictional_requirements   jsonb DEFAULT '{}',
  created_at                    timestamptz NOT NULL DEFAULT now()
);

-- 8. Deeds
CREATE TABLE IF NOT EXISTS public.deeds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  certification_id  uuid REFERENCES public.certifications(id),
  content           text,
  notary            text,
  deed_date         date,
  status            text DEFAULT 'DRAFT',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 9. Registry filings
CREATE TABLE IF NOT EXISTS public.registry_filings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL,
  deed_id                 uuid REFERENCES public.deeds(id),
  filing_via              text NOT NULL DEFAULT 'NOTARIAL',
  filing_number           text,
  presentation_date       date,
  status                  text NOT NULL DEFAULT 'PREPARACION',
  estimated_resolution    date,
  inscription_number      text,
  borme_ref               text,
  psm_ref                 text,
  siger_ref               text,
  conservatoria_ref       text,
  jucerja_ref             text,
  diario_oficial_ref      text,
  defect_details          jsonb DEFAULT '{}',
  resolution_document_url text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 10. No-session resolutions
CREATE TABLE IF NOT EXISTS public.no_session_resolutions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  body_id             uuid REFERENCES public.governing_bodies(id),
  title               text NOT NULL,
  status              text NOT NULL DEFAULT 'DRAFT',
  proposal_text       text,
  voting_deadline     timestamptz,
  votes_for           integer NOT NULL DEFAULT 0,
  votes_against       integer NOT NULL DEFAULT 0,
  abstentions         integer NOT NULL DEFAULT 0,
  requires_unanimity  boolean NOT NULL DEFAULT false,
  opened_at           timestamptz,
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 11. Unipersonal decisions
CREATE TABLE IF NOT EXISTS public.unipersonal_decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  entity_id           uuid REFERENCES public.entities(id),
  decision_type       text NOT NULL,
  title               text NOT NULL,
  content             text,
  decision_date       date,
  decided_by_id       uuid REFERENCES public.persons(id),
  status              text NOT NULL DEFAULT 'BORRADOR',
  requires_registry   boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 12. Mandatory books
CREATE TABLE IF NOT EXISTS public.mandatory_books (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  entity_id                 uuid REFERENCES public.entities(id),
  book_kind                 text NOT NULL,
  volume_number             integer NOT NULL DEFAULT 1,
  period                    integer NOT NULL,
  status                    text NOT NULL DEFAULT 'OPEN',
  opened_at                 date,
  closed_at                 date,
  legalization_deadline     date,
  legalization_status       text NOT NULL DEFAULT 'PENDIENTE',
  legalization_evidence_url text,
  UNIQUE (entity_id, book_kind, period, volume_number)
);

-- 13. Jurisdiction rule sets
CREATE TABLE IF NOT EXISTS public.jurisdiction_rule_sets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id             uuid,
  jurisdiction        text NOT NULL,
  company_form        text NOT NULL,
  typology_code       text NOT NULL,
  statutory_override  boolean NOT NULL DEFAULT false,
  rule_config         jsonb,
  is_active           boolean NOT NULL DEFAULT true
);

-- 14. Document templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  template_code     text NOT NULL,
  title             text NOT NULL,
  typology          text,
  body_type         text[] DEFAULT '{}',
  content_template  text,
  version           text NOT NULL DEFAULT '1.0',
  locale            text NOT NULL DEFAULT 'es-ES',
  is_active         boolean NOT NULL DEFAULT true
);

-- 15. Audit log
CREATE TABLE IF NOT EXISTS public.secretaria_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  event         text NOT NULL,
  actor_id      uuid,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  payload       jsonb DEFAULT '{}',
  prev_hash     text,
  hash          text
);

-- TRIGGER: minutes lock guard
CREATE OR REPLACE FUNCTION public.fn_minutes_lock_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_locked = true AND (
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.signed_by_secretary_id IS DISTINCT FROM OLD.signed_by_secretary_id OR
    NEW.signed_by_president_id IS DISTINCT FROM OLD.signed_by_president_id OR
    NEW.signed_at IS DISTINCT FROM OLD.signed_at
  ) THEN
    RAISE EXCEPTION 'Acta bloqueada — no se puede modificar content ni firmantes una vez bloqueada.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_minutes_lock_guard ON public.minutes;
CREATE TRIGGER trg_minutes_lock_guard
  BEFORE UPDATE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_minutes_lock_guard();

-- TRIGGER: convocatoria immutable guard
CREATE OR REPLACE FUNCTION public.fn_convocatoria_immutable_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.immutable_at IS NOT NULL AND (
    NEW.body_id IS DISTINCT FROM OLD.body_id OR
    NEW.fecha_1 IS DISTINCT FROM OLD.fecha_1 OR
    NEW.fecha_2 IS DISTINCT FROM OLD.fecha_2 OR
    NEW.publication_channels IS DISTINCT FROM OLD.publication_channels
  ) THEN
    RAISE EXCEPTION 'Convocatoria emitida — los campos estructurales son inmutables. Use Cancelar/Rectificar.';
  END IF;
  IF NEW.estado = 'EMITIDA' AND OLD.estado <> 'EMITIDA' THEN
    NEW.immutable_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convocatoria_immutable ON public.convocatorias;
CREATE TRIGGER trg_convocatoria_immutable
  BEFORE UPDATE ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.fn_convocatoria_immutable_guard();
