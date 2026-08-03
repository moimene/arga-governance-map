-- Secretaría — cimientos persistentes de actas y libros societarios.
--
-- Este lote introduce el destino explícito de cada acta, asientos WORM y
-- cierres con manifiesto hash. No migra actas legacy, no altera
-- fn_generar_acta/fn_aprobar_acta y no participa en el lifecycle registral.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Secciones configuradas dentro de un volumen físico
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.societary_book_sections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  book_id             uuid NOT NULL REFERENCES public.mandatory_books(id) ON DELETE RESTRICT,
  body_id             uuid REFERENCES public.governing_bodies(id) ON DELETE RESTRICT,
  section_code        text NOT NULL,
  section_label       text NOT NULL,
  section_kind        text NOT NULL DEFAULT 'MINUTES'
    CHECK (section_kind IN ('MINUTES')),
  routing_status      text NOT NULL DEFAULT 'ACTIVE'
    CHECK (routing_status IN ('ACTIVE', 'PENDING_LEGAL_CRITERIA', 'RETIRED')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (book_id, section_code)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_societary_book_sections_active_body
  ON public.societary_book_sections(book_id, body_id)
  WHERE body_id IS NOT NULL AND routing_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS ix_societary_book_sections_route
  ON public.societary_book_sections(tenant_id, body_id, routing_status);

-- ---------------------------------------------------------------------------
-- 2. Asientos inmutables e idempotentes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.societary_book_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  book_id             uuid NOT NULL REFERENCES public.mandatory_books(id) ON DELETE RESTRICT,
  section_id          uuid NOT NULL REFERENCES public.societary_book_sections(id) ON DELETE RESTRICT,
  ordinal_number      bigint NOT NULL CHECK (ordinal_number > 0),
  entry_type          text NOT NULL CHECK (entry_type IN ('MINUTE')),
  source_domain       text NOT NULL CHECK (source_domain IN ('MINUTE')),
  source_id           uuid NOT NULL,
  source_hash         text NOT NULL CHECK (length(btrim(source_hash)) >= 32),
  operation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  occurred_at         timestamptz NOT NULL,
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  recorded_by         uuid,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (book_id, ordinal_number),
  UNIQUE (tenant_id, source_domain, source_id),
  UNIQUE (tenant_id, operation_id)
);

CREATE INDEX IF NOT EXISTS ix_societary_book_entries_section
  ON public.societary_book_entries(section_id, ordinal_number);

-- ---------------------------------------------------------------------------
-- 3. Cierre inmutable del volumen y manifiesto determinista
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.societary_book_closures (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  book_id             uuid NOT NULL REFERENCES public.mandatory_books(id) ON DELETE RESTRICT,
  operation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  closed_at           timestamptz NOT NULL,
  first_ordinal       bigint,
  last_ordinal        bigint,
  entries_count       integer NOT NULL CHECK (entries_count >= 0),
  manifest_algorithm  text NOT NULL DEFAULT 'SHA-256'
    CHECK (manifest_algorithm = 'SHA-256'),
  manifest_hash       text NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  closed_by           uuid,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (book_id),
  UNIQUE (tenant_id, operation_id),
  CHECK (
    (entries_count = 0 AND first_ordinal IS NULL AND last_ordinal IS NULL)
    OR
    (entries_count > 0 AND first_ordinal IS NOT NULL AND last_ordinal IS NOT NULL
      AND first_ordinal <= last_ordinal)
  )
);

CREATE INDEX IF NOT EXISTS ix_societary_book_closures_tenant_closed
  ON public.societary_book_closures(tenant_id, closed_at DESC);

-- Incidencias durables del routing. Son hechos append-only: una configuración
-- posterior no reescribe el intento fallido que ya ocurrió.
CREATE TABLE IF NOT EXISTS public.societary_book_routing_incidents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  minute_id             uuid NOT NULL REFERENCES public.minutes(id) ON DELETE RESTRICT,
  body_id               uuid NOT NULL REFERENCES public.governing_bodies(id) ON DELETE RESTRICT,
  entity_id             uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  period                integer NOT NULL CHECK (period BETWEEN 1900 AND 9999),
  incident_type         text NOT NULL
    CHECK (incident_type IN ('NO_CANDIDATE', 'AMBIGUOUS')),
  candidate_section_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  candidate_fingerprint text NOT NULL CHECK (candidate_fingerprint ~ '^[0-9a-f]{64}$'),
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  recorded_by           uuid,
  context               jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, minute_id, incident_type, candidate_fingerprint)
);

CREATE INDEX IF NOT EXISTS ix_societary_book_routing_incidents_minute
  ON public.societary_book_routing_incidents(tenant_id, minute_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Vínculo compatible desde minutes. Sin UPDATE/backfill de filas existentes.
-- ---------------------------------------------------------------------------

ALTER TABLE public.minutes
  ADD COLUMN IF NOT EXISTS book_section_id uuid
    REFERENCES public.societary_book_sections(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS book_entry_id uuid
    REFERENCES public.societary_book_entries(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS book_destination_status text NOT NULL DEFAULT 'UNRESOLVED'
    CHECK (book_destination_status IN ('UNRESOLVED', 'RESOLVED', 'POSTED', 'LEGACY_REVIEW')),
  ADD COLUMN IF NOT EXISTS book_destination_resolved_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ux_minutes_book_entry
  ON public.minutes(book_entry_id)
  WHERE book_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_minutes_book_destination
  ON public.minutes(tenant_id, book_destination_status, book_section_id);

-- ---------------------------------------------------------------------------
-- 5. Integridad de scope y protecciones append-only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_book_section_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_book public.mandatory_books%ROWTYPE;
  v_body public.governing_bodies%ROWTYPE;
BEGIN
  IF COALESCE(current_setting('app.secretaria_book_section_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'book section: la escritura solo se permite mediante RPC gobernada'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_book
    FROM public.mandatory_books
   WHERE id = NEW.book_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'book section: libro % no encontrado', NEW.book_id;
  END IF;

  IF NEW.tenant_id <> v_book.tenant_id THEN
    RAISE EXCEPTION 'book section: tenant mismatch con libro %', NEW.book_id
      USING ERRCODE = '42501';
  END IF;

  IF NEW.body_id IS NOT NULL THEN
    SELECT * INTO v_body
      FROM public.governing_bodies
     WHERE id = NEW.body_id;
    IF NOT FOUND
       OR v_body.tenant_id <> NEW.tenant_id
       OR v_body.entity_id IS DISTINCT FROM v_book.entity_id THEN
      RAISE EXCEPTION 'book section: órgano % fuera del scope del libro %',
        NEW.body_id, NEW.book_id USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_book.body_id IS NOT NULL
     AND NEW.body_id IS DISTINCT FROM v_book.body_id THEN
    RAISE EXCEPTION 'book section: el libro dedicado % exige el órgano %',
      NEW.book_id, v_book.body_id;
  END IF;

  IF TG_OP = 'UPDATE'
     AND EXISTS (
       SELECT 1
         FROM public.societary_book_entries e
        WHERE e.section_id = OLD.id
     )
     AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.book_id IS DISTINCT FROM OLD.book_id
       OR NEW.body_id IS DISTINCT FROM OLD.body_id
       OR NEW.section_code IS DISTINCT FROM OLD.section_code
       OR NEW.section_kind IS DISTINCT FROM OLD.section_kind
     ) THEN
    RAISE EXCEPTION 'book section: no se puede cambiar el scope tras registrar asientos';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_book_incident_integrity_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_scope record;
  v_sorted_candidates uuid[];
  v_expected_fingerprint text;
BEGIN
  IF COALESCE(current_setting('app.secretaria_book_incident_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'book routing incident: la inserción solo se permite mediante RPC gobernada'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    m.tenant_id,
    COALESCE(m.body_id, mt.body_id) AS body_id,
    COALESCE(m.entity_id, gb.entity_id) AS entity_id,
    EXTRACT(YEAR FROM COALESCE(mt.scheduled_start, m.created_at))::integer AS period
  INTO v_scope
  FROM public.minutes m
  LEFT JOIN public.meetings mt ON mt.id = m.meeting_id
  LEFT JOIN public.governing_bodies gb ON gb.id = COALESCE(m.body_id, mt.body_id)
  WHERE m.id = NEW.minute_id;
  IF NOT FOUND
     OR NEW.tenant_id IS DISTINCT FROM v_scope.tenant_id
     OR NEW.body_id IS DISTINCT FROM v_scope.body_id
     OR NEW.entity_id IS DISTINCT FROM v_scope.entity_id
     OR NEW.period IS DISTINCT FROM v_scope.period THEN
    RAISE EXCEPTION 'book routing incident: contexto de acta incoherente'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(candidate ORDER BY candidate), '{}'::uuid[])
    INTO v_sorted_candidates
    FROM unnest(NEW.candidate_section_ids) AS candidate;
  IF NEW.candidate_section_ids IS DISTINCT FROM v_sorted_candidates THEN
    RAISE EXCEPTION 'book routing incident: candidatos no normalizados';
  END IF;

  IF NEW.incident_type = 'NO_CANDIDATE'
     AND cardinality(NEW.candidate_section_ids) <> 0 THEN
    RAISE EXCEPTION 'book routing incident: NO_CANDIDATE exige cero candidatos';
  ELSIF NEW.incident_type = 'AMBIGUOUS'
     AND cardinality(NEW.candidate_section_ids) < 2 THEN
    RAISE EXCEPTION 'book routing incident: AMBIGUOUS exige al menos dos candidatos';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(NEW.candidate_section_ids) AS candidate(section_id)
      LEFT JOIN public.societary_book_sections s ON s.id = candidate.section_id
      LEFT JOIN public.mandatory_books b ON b.id = s.book_id
     WHERE s.id IS NULL
        OR s.tenant_id <> NEW.tenant_id
        OR s.body_id <> NEW.body_id
        OR s.section_kind <> 'MINUTES'
        OR s.routing_status <> 'ACTIVE'
        OR b.tenant_id <> NEW.tenant_id
        OR b.entity_id <> NEW.entity_id
        OR b.period <> NEW.period
        OR b.status <> 'OPEN'
        OR b.closed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'book routing incident: candidato fuera de scope';
  END IF;

  v_expected_fingerprint := encode(
    digest(
      concat_ws(
        '|',
        NEW.minute_id::text,
        NEW.body_id::text,
        NEW.entity_id::text,
        NEW.period::text,
        NEW.incident_type,
        array_to_string(NEW.candidate_section_ids, ',')
      ),
      'sha256'
    ),
    'hex'
  );
  IF NEW.candidate_fingerprint <> v_expected_fingerprint THEN
    RAISE EXCEPTION 'book routing incident: fingerprint inválido';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_book_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION '% es append-only: registre un nuevo asiento o cierre correctivo', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_book_entry_integrity_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_scope record;
  v_expected_hash text;
  v_expected_ordinal bigint;
BEGIN
  IF COALESCE(current_setting('app.secretaria_book_entries_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'book entry: la inserción solo se permite mediante RPC gobernada'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    s.tenant_id AS section_tenant_id,
    s.book_id AS section_book_id,
    s.routing_status,
    s.section_kind,
    b.tenant_id AS book_tenant_id,
    b.status AS book_status,
    b.closed_at AS book_closed_at,
    m.tenant_id AS minute_tenant_id,
    m.book_section_id AS minute_section_id,
    m.book_entry_id AS minute_entry_id,
    m.book_destination_status,
    m.signed_at,
    m.is_locked,
    m.signed_by_president_id,
    m.signed_by_secretary_id,
    m.canonical_minutes_hash,
    m.content_hash
  INTO v_scope
  FROM public.societary_book_sections s
  JOIN public.mandatory_books b ON b.id = s.book_id
  JOIN public.minutes m
    ON NEW.source_domain = 'MINUTE'
   AND m.id = NEW.source_id
  WHERE s.id = NEW.section_id
    AND b.id = NEW.book_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'book entry: fuente, sección o libro inexistente/incoherente';
  END IF;

  IF NEW.tenant_id <> v_scope.section_tenant_id
     OR NEW.tenant_id <> v_scope.book_tenant_id
     OR NEW.tenant_id <> v_scope.minute_tenant_id
     OR NEW.book_id <> v_scope.section_book_id THEN
    RAISE EXCEPTION 'book entry: tenant o scope inconsistente'
      USING ERRCODE = '42501';
  END IF;
  IF v_scope.routing_status <> 'ACTIVE'
     OR v_scope.section_kind <> 'MINUTES'
     OR v_scope.book_status <> 'OPEN'
     OR v_scope.book_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'book entry: el destino no está activo y abierto';
  END IF;
  IF v_scope.minute_section_id IS DISTINCT FROM NEW.section_id
     OR v_scope.book_destination_status <> 'RESOLVED'
     OR v_scope.minute_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'book entry: el acta no está preparada para este destino';
  END IF;
  IF v_scope.signed_at IS NULL
     OR v_scope.is_locked IS NOT TRUE
     OR v_scope.signed_by_president_id IS NULL
     OR v_scope.signed_by_secretary_id IS NULL THEN
    RAISE EXCEPTION 'book entry: el acta no está firmada, bloqueada y atribuida';
  END IF;
  IF NEW.occurred_at IS DISTINCT FROM v_scope.signed_at THEN
    RAISE EXCEPTION 'book entry: occurred_at debe coincidir con signed_at';
  END IF;

  v_expected_hash := COALESCE(
    NULLIF(btrim(v_scope.canonical_minutes_hash), ''),
    NULLIF(btrim(v_scope.content_hash), '')
  );
  IF v_expected_hash IS NULL OR NEW.source_hash <> v_expected_hash THEN
    RAISE EXCEPTION 'book entry: source_hash no coincide con el acta canónica';
  END IF;

  SELECT COALESCE(MAX(e.ordinal_number), 0) + 1
    INTO v_expected_ordinal
    FROM public.societary_book_entries e
   WHERE e.book_id = NEW.book_id;
  IF NEW.ordinal_number <> v_expected_ordinal THEN
    RAISE EXCEPTION 'book entry: ordinal esperado %, recibido %',
      v_expected_ordinal, NEW.ordinal_number;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_book_closure_integrity_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_book public.mandatory_books%ROWTYPE;
  v_entries_count integer;
  v_first_ordinal bigint;
  v_last_ordinal bigint;
  v_manifest_entries text;
  v_expected_hash text;
BEGIN
  IF COALESCE(current_setting('app.secretaria_book_entries_rpc', true), '') <> '1' THEN
    RAISE EXCEPTION 'book closure: la inserción solo se permite mediante RPC gobernada'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_book
    FROM public.mandatory_books
   WHERE id = NEW.book_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'book closure: libro % no encontrado', NEW.book_id;
  END IF;
  IF NEW.tenant_id <> v_book.tenant_id THEN
    RAISE EXCEPTION 'book closure: tenant mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_book.status = 'CERRADO' OR v_book.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'book closure: el volumen ya figura cerrado';
  END IF;

  SELECT
    count(*)::integer,
    min(e.ordinal_number),
    max(e.ordinal_number),
    COALESCE(
      string_agg(
        concat_ws(
          '|',
          lpad(e.ordinal_number::text, 20, '0'),
          e.entry_type,
          e.source_domain,
          e.source_id::text,
          e.source_hash
        ),
        E'\n' ORDER BY e.ordinal_number
      ),
      ''
    )
  INTO v_entries_count, v_first_ordinal, v_last_ordinal, v_manifest_entries
  FROM public.societary_book_entries e
  WHERE e.book_id = NEW.book_id;

  v_expected_hash := encode(
    digest(
      format(
        'book_id=%s%stenant_id=%s%sentries_count=%s%s%s',
        NEW.book_id,
        E'\n',
        NEW.tenant_id,
        E'\n',
        v_entries_count,
        E'\n',
        v_manifest_entries
      ),
      'sha256'
    ),
    'hex'
  );

  IF NEW.entries_count <> v_entries_count
     OR NEW.first_ordinal IS DISTINCT FROM v_first_ordinal
     OR NEW.last_ordinal IS DISTINCT FROM v_last_ordinal
     OR NEW.manifest_hash <> v_expected_hash THEN
    RAISE EXCEPTION 'book closure: manifiesto o rango no coincide con los asientos persistidos';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_minutes_book_link_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.fn_secretaria_is_service_role() IS TRUE
     OR COALESCE(current_setting('app.secretaria_book_entries_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.book_section_id IS DISTINCT FROM OLD.book_section_id
     OR NEW.book_entry_id IS DISTINCT FROM OLD.book_entry_id
     OR NEW.book_destination_status IS DISTINCT FROM OLD.book_destination_status
     OR NEW.book_destination_resolved_at IS DISTINCT FROM OLD.book_destination_resolved_at THEN
    RAISE EXCEPTION 'minutes: el destino de libro solo se modifica mediante RPC gobernada'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_mandatory_books_entry_projection_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.fn_secretaria_is_service_role() IS TRUE
     OR COALESCE(current_setting('app.secretaria_book_entries_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.entries_count IS DISTINCT FROM OLD.entries_count
     OR NEW.last_entry_at IS DISTINCT FROM OLD.last_entry_at THEN
    RAISE EXCEPTION 'mandatory_books: el contador de asientos solo se modifica mediante RPC gobernada'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_societary_book_section_scope
  ON public.societary_book_sections;
CREATE TRIGGER trg_societary_book_section_scope
  BEFORE INSERT OR UPDATE ON public.societary_book_sections
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_section_scope_guard();

DROP TRIGGER IF EXISTS trg_societary_book_sections_append_only_delete
  ON public.societary_book_sections;
CREATE TRIGGER trg_societary_book_sections_append_only_delete
  BEFORE DELETE ON public.societary_book_sections
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_append_only_guard();

DROP TRIGGER IF EXISTS trg_societary_book_routing_incident_integrity
  ON public.societary_book_routing_incidents;
CREATE TRIGGER trg_societary_book_routing_incident_integrity
  BEFORE INSERT ON public.societary_book_routing_incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_incident_integrity_guard();

DROP TRIGGER IF EXISTS trg_societary_book_entry_integrity
  ON public.societary_book_entries;
CREATE TRIGGER trg_societary_book_entry_integrity
  BEFORE INSERT ON public.societary_book_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_entry_integrity_guard();

DROP TRIGGER IF EXISTS trg_societary_book_entries_append_only
  ON public.societary_book_entries;
CREATE TRIGGER trg_societary_book_entries_append_only
  BEFORE UPDATE OR DELETE ON public.societary_book_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_append_only_guard();

DROP TRIGGER IF EXISTS trg_societary_book_closures_append_only
  ON public.societary_book_closures;
CREATE TRIGGER trg_societary_book_closures_append_only
  BEFORE UPDATE OR DELETE ON public.societary_book_closures
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_append_only_guard();

DROP TRIGGER IF EXISTS trg_societary_book_routing_incidents_append_only
  ON public.societary_book_routing_incidents;
CREATE TRIGGER trg_societary_book_routing_incidents_append_only
  BEFORE UPDATE OR DELETE ON public.societary_book_routing_incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_append_only_guard();

DROP TRIGGER IF EXISTS trg_societary_book_closure_integrity
  ON public.societary_book_closures;
CREATE TRIGGER trg_societary_book_closure_integrity
  BEFORE INSERT ON public.societary_book_closures
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_book_closure_integrity_guard();

DROP TRIGGER IF EXISTS trg_minutes_book_link_guard ON public.minutes;
CREATE TRIGGER trg_minutes_book_link_guard
  BEFORE UPDATE ON public.minutes
  FOR EACH ROW EXECUTE FUNCTION public.fn_minutes_book_link_guard();

DROP TRIGGER IF EXISTS trg_mandatory_books_entry_projection_guard
  ON public.mandatory_books;
CREATE TRIGGER trg_mandatory_books_entry_projection_guard
  BEFORE UPDATE ON public.mandatory_books
  FOR EACH ROW EXECUTE FUNCTION public.fn_mandatory_books_entry_projection_guard();

DROP TRIGGER IF EXISTS trg_societary_book_entries_audit_worm
  ON public.societary_book_entries;
CREATE TRIGGER trg_societary_book_entries_audit_worm
  AFTER INSERT ON public.societary_book_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

DROP TRIGGER IF EXISTS trg_societary_book_closures_audit_worm
  ON public.societary_book_closures;
CREATE TRIGGER trg_societary_book_closures_audit_worm
  AFTER INSERT ON public.societary_book_closures
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

DROP TRIGGER IF EXISTS trg_societary_book_routing_incidents_audit_worm
  ON public.societary_book_routing_incidents;
CREATE TRIGGER trg_societary_book_routing_incidents_audit_worm
  AFTER INSERT ON public.societary_book_routing_incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_worm();

-- ---------------------------------------------------------------------------
-- 6. RLS: lectura tenant-scoped; toda escritura funcional pasa por RPC.
-- ---------------------------------------------------------------------------

ALTER TABLE public.societary_book_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societary_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societary_book_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societary_book_routing_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS societary_book_sections_select_tenant
  ON public.societary_book_sections;
CREATE POLICY societary_book_sections_select_tenant
  ON public.societary_book_sections FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS societary_book_entries_select_tenant
  ON public.societary_book_entries;
CREATE POLICY societary_book_entries_select_tenant
  ON public.societary_book_entries FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS societary_book_closures_select_tenant
  ON public.societary_book_closures;
CREATE POLICY societary_book_closures_select_tenant
  ON public.societary_book_closures FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS societary_book_routing_incidents_select_tenant
  ON public.societary_book_routing_incidents;
CREATE POLICY societary_book_routing_incidents_select_tenant
  ON public.societary_book_routing_incidents FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());

REVOKE ALL ON TABLE public.societary_book_sections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.societary_book_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.societary_book_closures FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.societary_book_routing_incidents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.societary_book_sections TO authenticated;
GRANT SELECT ON TABLE public.societary_book_entries TO authenticated;
GRANT SELECT ON TABLE public.societary_book_closures TO authenticated;
GRANT SELECT ON TABLE public.societary_book_routing_incidents TO authenticated;
GRANT ALL ON TABLE public.societary_book_sections TO service_role;
GRANT ALL ON TABLE public.societary_book_entries TO service_role;
GRANT ALL ON TABLE public.societary_book_closures TO service_role;
GRANT ALL ON TABLE public.societary_book_routing_incidents TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Configuración explícita: exactamente una sección MINUTES por book/body.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_configure_minute_book_section(
  p_book_id uuid,
  p_body_id uuid,
  p_section_code text,
  p_section_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_book public.mandatory_books%ROWTYPE;
  v_body public.governing_bodies%ROWTYPE;
  v_section public.societary_book_sections%ROWTYPE;
  v_section_code text := btrim(COALESCE(p_section_code, ''));
  v_section_label text := btrim(COALESCE(p_section_label, ''));
BEGIN
  SELECT * INTO v_book
    FROM public.mandatory_books
   WHERE id = p_book_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'libro % no encontrado', p_book_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_book.tenant_id THEN
      RAISE EXCEPTION 'libro tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_book.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_book.status <> 'OPEN' OR v_book.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'libro % cerrado: no admite configurar secciones', p_book_id;
  END IF;
  IF v_section_code = ''
     OR v_section_code <> upper(v_section_code)
     OR v_section_code !~ '^[A-Z0-9_:-]+$' THEN
    RAISE EXCEPTION 'section_code requerido en mayúsculas y formato estable';
  END IF;
  IF v_section_label = '' THEN
    RAISE EXCEPTION 'section_label requerido';
  END IF;

  SELECT * INTO v_body
    FROM public.governing_bodies
   WHERE id = p_body_id;
  IF NOT FOUND
     OR v_body.tenant_id <> v_book.tenant_id
     OR v_body.entity_id IS DISTINCT FROM v_book.entity_id THEN
    RAISE EXCEPTION 'órgano % fuera del scope del libro %', p_body_id, p_book_id
      USING ERRCODE = '42501';
  END IF;
  IF v_book.body_id IS NOT NULL AND v_book.body_id <> p_body_id THEN
    RAISE EXCEPTION 'libro dedicado % no corresponde al órgano %', p_book_id, p_body_id;
  END IF;

  SELECT * INTO v_section
    FROM public.societary_book_sections
   WHERE book_id = p_book_id
     AND section_code = v_section_code;
  IF FOUND THEN
    IF v_section.tenant_id = v_book.tenant_id
       AND v_section.body_id = p_body_id
       AND v_section.section_label = v_section_label
       AND v_section.section_kind = 'MINUTES'
       AND v_section.routing_status = 'ACTIVE' THEN
      RETURN jsonb_build_object(
        'section_id', v_section.id,
        'book_id', p_book_id,
        'body_id', p_body_id,
        'already_configured', true
      );
    END IF;
    RAISE EXCEPTION 'section_code % ya existe con otra configuración', v_section_code;
  END IF;

  SELECT * INTO v_section
    FROM public.societary_book_sections
   WHERE book_id = p_book_id
     AND body_id = p_body_id
     AND routing_status = 'ACTIVE';
  IF FOUND THEN
    RAISE EXCEPTION 'órgano % ya tiene la sección activa % en el libro %',
      p_body_id, v_section.section_code, p_book_id;
  END IF;

  PERFORM set_config('app.secretaria_book_section_rpc', '1', true);
  INSERT INTO public.societary_book_sections (
    tenant_id,
    book_id,
    body_id,
    section_code,
    section_label,
    section_kind,
    routing_status,
    created_by
  ) VALUES (
    v_book.tenant_id,
    p_book_id,
    p_body_id,
    v_section_code,
    v_section_label,
    'MINUTES',
    'ACTIVE',
    auth.uid()
  )
  RETURNING * INTO v_section;

  RETURN jsonb_build_object(
    'section_id', v_section.id,
    'book_id', p_book_id,
    'body_id', p_body_id,
    'already_configured', false
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Resolver destino: las incidencias de negocio se devuelven, no se lanzan,
-- para que sobrevivan al COMMIT de la llamada RPC.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_resolve_minute_book_destination(
  p_minute_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute record;
  v_period integer;
  v_candidate_count integer;
  v_section_id uuid;
  v_book_id uuid;
  v_candidate_section_ids uuid[];
  v_candidate_book_ids uuid[];
  v_incident_type text;
  v_incident_fingerprint text;
  v_incident_id uuid;
  v_affected integer;
BEGIN
  SELECT
    m.id,
    m.tenant_id,
    m.signed_at,
    m.is_locked,
    m.created_at,
    m.book_section_id,
    m.book_destination_status,
    COALESCE(m.body_id, mt.body_id) AS resolved_body_id,
    COALESCE(m.entity_id, gb.entity_id) AS resolved_entity_id,
    mt.scheduled_start,
    mt.tenant_id AS meeting_tenant_id,
    gb.tenant_id AS body_tenant_id
  INTO v_minute
  FROM public.minutes m
  LEFT JOIN public.meetings mt ON mt.id = m.meeting_id
  LEFT JOIN public.governing_bodies gb ON gb.id = COALESCE(m.body_id, mt.body_id)
  WHERE m.id = p_minute_id
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % no encontrada', p_minute_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'acta tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_minute.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_minute.meeting_tenant_id IS DISTINCT FROM v_minute.tenant_id
     OR v_minute.body_tenant_id IS DISTINCT FROM v_minute.tenant_id
     OR v_minute.resolved_body_id IS NULL
     OR v_minute.resolved_entity_id IS NULL THEN
    RAISE EXCEPTION 'acta % sin contexto coherente de tenant, entidad y órgano', p_minute_id;
  END IF;

  -- Las actas legacy firmadas no se enrutan automáticamente en esta migración.
  IF v_minute.signed_at IS NOT NULL OR v_minute.is_locked IS TRUE THEN
    RAISE EXCEPTION 'acta % ya firmada/bloqueada: requiere remediación legacy gobernada', p_minute_id;
  END IF;

  v_period := EXTRACT(
    YEAR FROM COALESCE(v_minute.scheduled_start, v_minute.created_at)
  )::integer;

  IF v_minute.book_section_id IS NOT NULL THEN
    SELECT s.id, s.book_id
      INTO v_section_id, v_book_id
      FROM public.societary_book_sections s
      JOIN public.mandatory_books b ON b.id = s.book_id
     WHERE s.id = v_minute.book_section_id
       AND s.tenant_id = v_minute.tenant_id
       AND s.body_id = v_minute.resolved_body_id
       AND s.section_kind = 'MINUTES'
       AND s.routing_status = 'ACTIVE'
       AND b.tenant_id = v_minute.tenant_id
       AND b.entity_id = v_minute.resolved_entity_id
       AND b.period = v_period
       AND b.status = 'OPEN'
       AND b.closed_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'acta % tiene un destino de libro inválido o cerrado', p_minute_id;
    END IF;

    RETURN jsonb_build_object(
      'minute_id', p_minute_id,
      'book_id', v_book_id,
      'section_id', v_section_id,
      'status', 'RESOLVED',
      'resolved', true,
      'already_resolved', true
    );
  END IF;

  SELECT
    count(*)::integer,
    (array_agg(s.id ORDER BY s.id))[1],
    (array_agg(b.id ORDER BY s.id))[1],
    COALESCE(array_agg(s.id ORDER BY s.id), '{}'::uuid[]),
    COALESCE(array_agg(b.id ORDER BY s.id), '{}'::uuid[])
  INTO
    v_candidate_count,
    v_section_id,
    v_book_id,
    v_candidate_section_ids,
    v_candidate_book_ids
  FROM public.societary_book_sections s
  JOIN public.mandatory_books b ON b.id = s.book_id
  WHERE s.tenant_id = v_minute.tenant_id
    AND s.body_id = v_minute.resolved_body_id
    AND s.section_kind = 'MINUTES'
    AND s.routing_status = 'ACTIVE'
    AND b.tenant_id = v_minute.tenant_id
    AND b.entity_id = v_minute.resolved_entity_id
    AND b.period = v_period
    AND b.status = 'OPEN'
    AND b.closed_at IS NULL;

  IF v_candidate_count = 0 OR v_candidate_count > 1 THEN
    v_incident_type := CASE
      WHEN v_candidate_count = 0 THEN 'NO_CANDIDATE'
      ELSE 'AMBIGUOUS'
    END;
    v_incident_fingerprint := encode(
      digest(
        concat_ws(
          '|',
          p_minute_id::text,
          v_minute.resolved_body_id::text,
          v_minute.resolved_entity_id::text,
          v_period::text,
          v_incident_type,
          array_to_string(v_candidate_section_ids, ',')
        ),
        'sha256'
      ),
      'hex'
    );

    PERFORM set_config('app.secretaria_book_incident_rpc', '1', true);
    INSERT INTO public.societary_book_routing_incidents (
      tenant_id,
      minute_id,
      body_id,
      entity_id,
      period,
      incident_type,
      candidate_section_ids,
      candidate_fingerprint,
      recorded_by,
      context
    ) VALUES (
      v_minute.tenant_id,
      p_minute_id,
      v_minute.resolved_body_id,
      v_minute.resolved_entity_id,
      v_period,
      v_incident_type,
      v_candidate_section_ids,
      v_incident_fingerprint,
      auth.uid(),
      jsonb_build_object(
        'candidate_count', v_candidate_count,
        'candidate_book_ids', v_candidate_book_ids
      )
    )
    ON CONFLICT (tenant_id, minute_id, incident_type, candidate_fingerprint)
    DO NOTHING
    RETURNING id INTO v_incident_id;

    IF v_incident_id IS NULL THEN
      SELECT id INTO v_incident_id
        FROM public.societary_book_routing_incidents
       WHERE tenant_id = v_minute.tenant_id
         AND minute_id = p_minute_id
         AND incident_type = v_incident_type
         AND candidate_fingerprint = v_incident_fingerprint;
    END IF;

    RETURN jsonb_build_object(
      'minute_id', p_minute_id,
      'resolved', false,
      'reason', v_incident_type,
      'candidate_count', v_candidate_count,
      'candidate_section_ids', v_candidate_section_ids,
      'incident_id', v_incident_id
    );
  END IF;

  PERFORM set_config('app.secretaria_book_entries_rpc', '1', true);
  UPDATE public.minutes
     SET book_section_id = v_section_id,
         book_destination_status = 'RESOLVED',
         book_destination_resolved_at = now()
   WHERE id = p_minute_id;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'acta % no pudo fijar su destino de libro', p_minute_id;
  END IF;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'book_id', v_book_id,
    'section_id', v_section_id,
    'status', 'RESOLVED',
    'resolved', true,
    'already_resolved', false
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Registrar asiento: idempotente, firmado, atribuido y transaccional.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_minute_book_entry(
  p_minute_id uuid,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_entry public.societary_book_entries%ROWTYPE;
  v_destination record;
  v_source_hash text;
  v_operation_id uuid := COALESCE(p_operation_id, gen_random_uuid());
  v_ordinal bigint;
  v_recorded_at timestamptz := now();
  v_affected integer;
BEGIN
  SELECT * INTO v_minute
    FROM public.minutes
   WHERE id = p_minute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % no encontrada', p_minute_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_minute.tenant_id THEN
      RAISE EXCEPTION 'acta tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_minute.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  IF v_minute.book_entry_id IS NOT NULL THEN
    SELECT * INTO v_entry
      FROM public.societary_book_entries
     WHERE id = v_minute.book_entry_id
       AND tenant_id = v_minute.tenant_id
       AND source_domain = 'MINUTE'
       AND source_id = v_minute.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'acta % referencia un asiento inconsistente', p_minute_id;
    END IF;
    RETURN jsonb_build_object(
      'minute_id', p_minute_id,
      'entry_id', v_entry.id,
      'book_id', v_entry.book_id,
      'section_id', v_entry.section_id,
      'ordinal_number', v_entry.ordinal_number,
      'already_recorded', true
    );
  END IF;

  IF v_minute.book_section_id IS NULL
     OR v_minute.book_destination_status <> 'RESOLVED' THEN
    RAISE EXCEPTION 'acta % sin destino de libro resuelto', p_minute_id;
  END IF;
  IF v_minute.signed_at IS NULL OR v_minute.is_locked IS NOT TRUE THEN
    RAISE EXCEPTION 'acta % debe estar firmada y bloqueada antes del asiento', p_minute_id;
  END IF;
  IF v_minute.signed_by_president_id IS NULL
     OR v_minute.signed_by_secretary_id IS NULL THEN
    RAISE EXCEPTION 'acta % sin atribución completa de presidente y secretario', p_minute_id;
  END IF;

  v_source_hash := COALESCE(
    NULLIF(btrim(v_minute.canonical_minutes_hash), ''),
    NULLIF(btrim(v_minute.content_hash), '')
  );
  IF v_source_hash IS NULL OR length(v_source_hash) < 32 THEN
    RAISE EXCEPTION 'acta % sin hash canónico persistido', p_minute_id;
  END IF;

  SELECT
    s.id AS section_id,
    s.body_id,
    b.id AS book_id,
    b.tenant_id,
    b.entity_id,
    b.status,
    b.closed_at
  INTO v_destination
  FROM public.societary_book_sections s
  JOIN public.mandatory_books b ON b.id = s.book_id
  WHERE s.id = v_minute.book_section_id
    AND s.tenant_id = v_minute.tenant_id
    AND s.routing_status = 'ACTIVE'
    AND s.section_kind = 'MINUTES'
    AND b.tenant_id = v_minute.tenant_id
    AND b.entity_id = v_minute.entity_id
    AND s.body_id = v_minute.body_id
  FOR UPDATE OF b;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % tiene un destino fuera de scope', p_minute_id;
  END IF;
  IF v_destination.status <> 'OPEN' OR v_destination.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'libro % cerrado: no admite nuevos asientos', v_destination.book_id;
  END IF;

  SELECT COALESCE(MAX(e.ordinal_number), 0) + 1
    INTO v_ordinal
    FROM public.societary_book_entries e
   WHERE e.book_id = v_destination.book_id;

  PERFORM set_config('app.secretaria_book_entries_rpc', '1', true);
  INSERT INTO public.societary_book_entries (
    tenant_id,
    book_id,
    section_id,
    ordinal_number,
    entry_type,
    source_domain,
    source_id,
    source_hash,
    operation_id,
    occurred_at,
    recorded_at,
    recorded_by,
    metadata
  ) VALUES (
    v_minute.tenant_id,
    v_destination.book_id,
    v_destination.section_id,
    v_ordinal,
    'MINUTE',
    'MINUTE',
    v_minute.id,
    v_source_hash,
    v_operation_id,
    v_minute.signed_at,
    v_recorded_at,
    auth.uid(),
    jsonb_build_object(
      'meeting_id', v_minute.meeting_id,
      'signed_by_president_id', v_minute.signed_by_president_id,
      'signed_by_secretary_id', v_minute.signed_by_secretary_id
    )
  )
  RETURNING * INTO v_entry;

  UPDATE public.mandatory_books
     SET entries_count = entries_count + 1,
         last_entry_at = v_recorded_at
   WHERE id = v_destination.book_id;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'libro % no pudo actualizar su proyección', v_destination.book_id;
  END IF;

  UPDATE public.minutes
     SET book_entry_id = v_entry.id,
         book_destination_status = 'POSTED',
         registered_at = COALESCE(registered_at, v_recorded_at)
   WHERE id = p_minute_id;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'acta % no pudo vincular su asiento', p_minute_id;
  END IF;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'entry_id', v_entry.id,
    'book_id', v_entry.book_id,
    'section_id', v_entry.section_id,
    'ordinal_number', v_entry.ordinal_number,
    'already_recorded', false
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Cerrar volumen: persiste un manifiesto, sin legalización ni evidencia fake.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_close_book_volume(
  p_book_id uuid,
  p_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_book public.mandatory_books%ROWTYPE;
  v_closure public.societary_book_closures%ROWTYPE;
  v_operation_id uuid := COALESCE(p_operation_id, gen_random_uuid());
  v_entries_count integer;
  v_first_ordinal bigint;
  v_last_ordinal bigint;
  v_manifest_entries text;
  v_manifest_hash text;
  v_closed_at timestamptz := now();
  v_affected integer;
BEGIN
  SELECT * INTO v_book
    FROM public.mandatory_books
   WHERE id = p_book_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'libro % no encontrado', p_book_id;
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_book.tenant_id THEN
      RAISE EXCEPTION 'libro tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_book.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  SELECT * INTO v_closure
    FROM public.societary_book_closures
   WHERE book_id = p_book_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'book_id', p_book_id,
      'closure_id', v_closure.id,
      'entries_count', v_closure.entries_count,
      'manifest_hash', v_closure.manifest_hash,
      'already_closed', true
    );
  END IF;

  -- No se sintetiza un cierre para volúmenes legacy cerrados sin manifiesto.
  IF v_book.status = 'CERRADO' OR v_book.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'libro % cerrado sin manifiesto: requiere remediación legacy gobernada', p_book_id;
  END IF;

  SELECT
    count(*)::integer,
    min(e.ordinal_number),
    max(e.ordinal_number),
    COALESCE(
      string_agg(
        concat_ws(
          '|',
          lpad(e.ordinal_number::text, 20, '0'),
          e.entry_type,
          e.source_domain,
          e.source_id::text,
          e.source_hash
        ),
        E'\n' ORDER BY e.ordinal_number
      ),
      ''
    )
  INTO v_entries_count, v_first_ordinal, v_last_ordinal, v_manifest_entries
  FROM public.societary_book_entries e
  WHERE e.book_id = p_book_id;

  IF v_book.entries_count <> v_entries_count THEN
    RAISE EXCEPTION 'libro % con proyección inconsistente: contador %, asientos %',
      p_book_id, v_book.entries_count, v_entries_count;
  END IF;

  v_manifest_hash := encode(
    digest(
      format(
        'book_id=%s%stenant_id=%s%sentries_count=%s%s%s',
        p_book_id,
        E'\n',
        v_book.tenant_id,
        E'\n',
        v_entries_count,
        E'\n',
        v_manifest_entries
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM set_config('app.secretaria_book_entries_rpc', '1', true);
  INSERT INTO public.societary_book_closures (
    tenant_id,
    book_id,
    operation_id,
    closed_at,
    first_ordinal,
    last_ordinal,
    entries_count,
    manifest_hash,
    closed_by
  ) VALUES (
    v_book.tenant_id,
    p_book_id,
    v_operation_id,
    v_closed_at,
    v_first_ordinal,
    v_last_ordinal,
    v_entries_count,
    v_manifest_hash,
    auth.uid()
  )
  RETURNING * INTO v_closure;

  PERFORM set_config('app.libro_lifecycle_rpc', '1', true);
  UPDATE public.mandatory_books
     SET status = 'CERRADO',
         closed_at = v_closed_at::date
   WHERE id = p_book_id;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 1 THEN
    RAISE EXCEPTION 'libro % no pudo cerrar su volumen', p_book_id;
  END IF;

  RETURN jsonb_build_object(
    'book_id', p_book_id,
    'closure_id', v_closure.id,
    'entries_count', v_closure.entries_count,
    'manifest_hash', v_closure.manifest_hash,
    'already_closed', false
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 11. Superficie ejecutable mínima
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.fn_secretaria_book_section_scope_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_secretaria_book_append_only_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_secretaria_book_entry_integrity_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_secretaria_book_closure_integrity_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_secretaria_book_incident_integrity_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_minutes_book_link_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_mandatory_books_entry_projection_guard()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fn_secretaria_configure_minute_book_section(uuid, uuid, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_resolve_minute_book_destination(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_register_minute_book_entry(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_close_book_volume(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_configure_minute_book_section(uuid, uuid, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_resolve_minute_book_destination(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_minute_book_entry(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_close_book_volume(uuid, uuid)
  TO authenticated, service_role;

-- Retira los writers legacy que cerraban o declaraban la legalización sin
-- asiento, manifiesto ni evidencia registral tipada. Se conservan únicamente
-- para remediación administrativa explícita mediante service_role.
REVOKE ALL ON FUNCTION public.fn_libro_cerrar_volumen(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_libro_cerrar_volumen(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_libro_legalizacion_transicion(uuid, text, text)
  TO service_role;

COMMENT ON TABLE public.societary_book_sections IS
  'Configuración explícita de secciones por órgano dentro de un volumen físico. No se deriva por heurística en runtime.';
COMMENT ON TABLE public.societary_book_entries IS
  'Asientos societarios append-only. La unicidad por fuente hace idempotente el registro de cada acta.';
COMMENT ON TABLE public.societary_book_closures IS
  'Cierres append-only de volumen con manifiesto SHA-256. No representa presentación ni legalización registral.';
COMMENT ON TABLE public.societary_book_routing_incidents IS
  'Incidencias append-only de resolución de destino. NO_CANDIDATE y AMBIGUOUS se persisten sin abortar la transacción RPC.';

COMMIT;
