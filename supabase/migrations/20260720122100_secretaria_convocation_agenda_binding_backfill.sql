-- Secretaría — binding autoritativo convocatoria -> agenda de reunión.
--
-- La convocatoria EMITIDA es la fuente jurídica congelada del orden del día.
-- Este cambio materializa cada punto de forma determinista, conserva un hash
-- canónico por punto y evita que una reconciliación automática pise una
-- reclasificación WORM o un acta ya finalizada.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS source_convocatoria_id uuid
    REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_convocatoria_item_index integer,
  ADD COLUMN IF NOT EXISTS source_item_hash_sha256 text;

ALTER TABLE public.agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_convocation_source_binding_complete;

ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_convocation_source_binding_complete
  CHECK (
    (
      source_convocatoria_id IS NULL
      AND source_convocatoria_item_index IS NULL
      AND source_item_hash_sha256 IS NULL
    )
    OR
    (
      source_convocatoria_id IS NOT NULL
      AND source_convocatoria_item_index > 0
      AND source_item_hash_sha256 ~ '^[0-9a-f]{64}$'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_agenda_items_convocation_source_item
  ON public.agenda_items(tenant_id, source_convocatoria_id, source_convocatoria_item_index)
  WHERE source_convocatoria_id IS NOT NULL;

COMMENT ON COLUMN public.agenda_items.source_convocatoria_id IS
  'Convocatoria EMITIDA e inmutable de la que procede el punto materializado.';
COMMENT ON COLUMN public.agenda_items.source_convocatoria_item_index IS
  'Ordinal 1-based del punto dentro de convocatorias.agenda_items.';
COMMENT ON COLUMN public.agenda_items.source_item_hash_sha256 IS
  'SHA-256 server-side del JSON canónico title/matter/kind/subtype/proposal/attachments.';

-- Una única normalización compartida por trigger, RPC, backfill y self-check.
CREATE OR REPLACE FUNCTION public.fn_secretaria_convocation_agenda_item_canonical(
  p_item jsonb,
  p_order_number integer
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'order_number', p_order_number,
    'title', btrim(p_item ->> 'titulo'),
    'matter_code', NULLIF(btrim(p_item ->> 'materia'), ''),
    'kind', upper(COALESCE(NULLIF(btrim(p_item ->> 'kind'), ''), 'DELIBERATIVO')),
    'decision_subtype', NULLIF(btrim(p_item ->> 'decision_subtype'), ''),
    'proposal_text', NULLIF(btrim(p_item ->> 'propuesta_acuerdo'), ''),
    'requires_attachments', CASE
      WHEN upper(COALESCE(p_item ->> 'materia', '')) = 'FORMULACION_CUENTAS'
        THEN true
      ELSE COALESCE(NULLIF(p_item ->> 'requires_attachments', '')::boolean, false)
    END
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_secretaria_convocation_agenda_item_canonical(jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_convocation_agenda_item_canonical(jsonb, integer)
  TO service_role;

-- El sello anterior solo congelaba fecha/órgano/canales. La agenda y el texto
-- seguían siendo mutables aunque immutable_at estuviera informado. Se amplía
-- el mismo guard sin bloquear los campos de trazas/evidencias que se completan
-- después del INSERT de la convocatoria.
CREATE OR REPLACE FUNCTION public.fn_convocatoria_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado = 'EMITIDA' OR OLD.immutable_at IS NOT NULL THEN
      RAISE EXCEPTION
        'CONVOCATORIA_EMITIDA_DELETE_FORBIDDEN: use Cancelar/Rectificar; la fuente jurídica se conserva'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.immutable_at IS NOT NULL
       AND NEW.estado IS DISTINCT FROM OLD.estado
       AND NEW.estado NOT IN ('CANCELADA', 'RECTIFICADA') THEN
      RAISE EXCEPTION
        'CONVOCATORIA_EMITIDA_STATUS_TRANSITION_FORBIDDEN: solo Cancelar/Rectificar conserva la fuente original'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.immutable_at IS NOT NULL AND (
      NEW.id IS DISTINCT FROM OLD.id OR
      NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR
      NEW.body_id IS DISTINCT FROM OLD.body_id OR
      NEW.tipo_convocatoria IS DISTINCT FROM OLD.tipo_convocatoria OR
      NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision OR
      NEW.fecha_1 IS DISTINCT FROM OLD.fecha_1 OR
      NEW.fecha_2 IS DISTINCT FROM OLD.fecha_2 OR
      NEW.is_second_call IS DISTINCT FROM OLD.is_second_call OR
      NEW.modalidad IS DISTINCT FROM OLD.modalidad OR
      NEW.lugar IS DISTINCT FROM OLD.lugar OR
      NEW.junta_universal IS DISTINCT FROM OLD.junta_universal OR
      NEW.urgente IS DISTINCT FROM OLD.urgente OR
      NEW.publication_channels IS DISTINCT FROM OLD.publication_channels OR
      NEW.statutory_basis IS DISTINCT FROM OLD.statutory_basis OR
      NEW.agenda_items IS DISTINCT FROM OLD.agenda_items OR
      NEW.convocatoria_text IS DISTINCT FROM OLD.convocatoria_text OR
      NEW.immutable_at IS DISTINCT FROM OLD.immutable_at OR
      NEW.created_at IS DISTINCT FROM OLD.created_at
    ) THEN
      RAISE EXCEPTION
        'Convocatoria emitida: orden del día y contenido estructural inmutables. Use Cancelar/Rectificar.';
    END IF;
  END IF;

  -- El sello siempre lo fija el servidor: ni INSERT ni transición desde
  -- borrador pueden inyectar una fecha de inmutabilidad controlada por cliente.
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado = 'EMITIDA' THEN
      NEW.immutable_at := now();
    ELSIF NEW.immutable_at IS NOT NULL THEN
      RAISE EXCEPTION 'CONVOCATORIA_IMMUTABLE_SEAL_SERVER_ASSIGNED'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.immutable_at IS NULL THEN
    IF NEW.estado = 'EMITIDA' THEN
      NEW.immutable_at := now();
    ELSIF NEW.immutable_at IS NOT NULL THEN
      RAISE EXCEPTION 'CONVOCATORIA_IMMUTABLE_SEAL_SERVER_ASSIGNED'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Un único trigger cubre creación, transición, actualización y borrado. Se
-- eliminan las dos versiones históricas para evitar una doble ejecución en
-- INSERT y, sobre todo, para que DELETE nunca quede fuera del guard.
DROP TRIGGER IF EXISTS trg_convocatoria_immutable_insert ON public.convocatorias;
DROP TRIGGER IF EXISTS trg_convocatoria_immutable ON public.convocatorias;
CREATE TRIGGER trg_convocatoria_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.convocatorias
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_convocatoria_immutable_guard();

-- La agenda de una convocatoria ya emitida solo puede nacer o reconciliarse
-- dentro de fn_secretaria_materialize_convocation_agenda. El trigger es
-- SECURITY INVOKER a propósito: dentro de la RPC SECURITY DEFINER hereda su
-- propietario efectivo; un INSERT/UPDATE directo de anon/authenticated (o de
-- service_role) no lo hace. DELETE físico queda prohibido incluso al owner: la
-- rectificación se expresa por un nuevo artefacto, nunca destruyendo la fuente.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_emitted_agenda_dml()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_meeting_id uuid;
  v_tenant_id uuid;
  v_source_ref text;
  v_rpc_owner name;
  v_bound_to_immutable_convocation boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_meeting_id := OLD.meeting_id;
    v_tenant_id := OLD.tenant_id;
    v_source_ref := OLD.source_convocatoria_id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_meeting_id := COALESCE(OLD.meeting_id, NEW.meeting_id);
    v_tenant_id := COALESCE(OLD.tenant_id, NEW.tenant_id);
    -- OLD first prevents a caller from evading the guard by clearing the link.
    v_source_ref := COALESCE(
      OLD.source_convocatoria_id::text,
      NEW.source_convocatoria_id::text
    );
  ELSE
    v_meeting_id := NEW.meeting_id;
    v_tenant_id := NEW.tenant_id;
    v_source_ref := NEW.source_convocatoria_id::text;
  END IF;

  SELECT COALESCE(
           v_source_ref,
           NULLIF(meeting.quorum_data #>> '{agenda_binding,convocatoria_id}', ''),
           NULLIF(meeting.quorum_data #>> '{source_links,convocatoria_id}', ''),
           NULLIF(meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '')
         )
    INTO v_source_ref
    FROM public.meetings meeting
   WHERE meeting.id = v_meeting_id
     AND meeting.tenant_id = v_tenant_id;

  IF v_source_ref IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.convocatorias convocatoria
       WHERE convocatoria.id::text = v_source_ref
         AND convocatoria.tenant_id = v_tenant_id
         AND convocatoria.immutable_at IS NOT NULL
    ) INTO v_bound_to_immutable_convocation;
  END IF;

  IF v_bound_to_immutable_convocation IS NOT TRUE THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'AGENDA_EMITIDA_DELETE_FORBIDDEN: la agenda vinculada es fuente jurídica inmutable'
      USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(proc.proowner)
    INTO v_rpc_owner
    FROM pg_catalog.pg_proc proc
   WHERE proc.oid = pg_catalog.to_regprocedure(
     'public.fn_secretaria_materialize_convocation_agenda(uuid,uuid)'
   );

  IF v_rpc_owner IS NULL OR current_user IS DISTINCT FROM v_rpc_owner THEN
    RAISE EXCEPTION
      'AGENDA_EMITIDA_RPC_REQUIRED: use fn_secretaria_materialize_convocation_agenda'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_00_guard_emitted_agenda_dml
  ON public.agenda_items;
CREATE TRIGGER trg_secretaria_00_guard_emitted_agenda_dml
  BEFORE INSERT OR UPDATE OR DELETE ON public.agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_emitted_agenda_dml();

-- Un punto ya vinculado no puede divergir después de la materialización. El
-- trigger también impide fabricar un source id/hash desde el cliente.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_convocation_agenda_binding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_item jsonb;
  v_canonical jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.source_convocatoria_id IS NOT NULL
     AND (
       NEW.source_convocatoria_id IS DISTINCT FROM OLD.source_convocatoria_id
       OR NEW.source_convocatoria_item_index IS DISTINCT FROM OLD.source_convocatoria_item_index
     ) THEN
    RAISE EXCEPTION 'agenda binding: el vínculo a la convocatoria inmutable no puede cambiarse ni eliminarse';
  END IF;

  IF NEW.source_convocatoria_id IS NULL THEN
    IF NEW.source_convocatoria_item_index IS NOT NULL
       OR NEW.source_item_hash_sha256 IS NOT NULL THEN
      RAISE EXCEPTION 'agenda binding: source id, ordinal y hash deben informarse conjuntamente';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.source_convocatoria_item_index IS NULL
     OR NEW.source_convocatoria_item_index <= 0 THEN
    RAISE EXCEPTION 'agenda binding: ordinal de convocatoria inválido';
  END IF;

  SELECT * INTO v_meeting
  FROM public.meetings
  WHERE id = NEW.meeting_id
    AND tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda binding: reunión fuera del tenant del punto';
  END IF;

  SELECT * INTO v_convocatoria
  FROM public.convocatorias
  WHERE id = NEW.source_convocatoria_id
    AND tenant_id = NEW.tenant_id
    AND body_id = v_meeting.body_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda binding: convocatoria fuera del órgano o tenant de la reunión';
  END IF;

  IF v_convocatoria.estado <> 'EMITIDA'
     OR v_convocatoria.immutable_at IS NULL
     OR v_convocatoria.fecha_1 IS NULL
     OR v_meeting.scheduled_start IS NULL
     OR v_convocatoria.fecha_1::date <> v_meeting.scheduled_start::date
     OR jsonb_typeof(v_convocatoria.agenda_items) <> 'array' THEN
    RAISE EXCEPTION 'agenda binding: la convocatoria debe estar emitida, inmutable, fechada y en el mismo ámbito';
  END IF;

  v_item := v_convocatoria.agenda_items -> (NEW.source_convocatoria_item_index - 1);
  IF v_item IS NULL OR jsonb_typeof(v_item) <> 'object' THEN
    RAISE EXCEPTION 'agenda binding: el ordinal % no existe en la convocatoria %',
      NEW.source_convocatoria_item_index, NEW.source_convocatoria_id;
  END IF;

  v_canonical := public.fn_secretaria_convocation_agenda_item_canonical(
    v_item,
    NEW.source_convocatoria_item_index
  );

  IF COALESCE(btrim(v_canonical ->> 'title'), '') = ''
     OR COALESCE(btrim(v_canonical ->> 'matter_code'), '') = ''
     OR (
       v_canonical ->> 'kind' = 'DECISORIO'
       AND COALESCE(btrim(v_canonical ->> 'proposal_text'), '') = ''
     )
     OR (
       v_canonical ->> 'kind' <> 'DECISORIO'
       AND v_canonical ->> 'decision_subtype' IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'agenda binding: punto de convocatoria incompleto o incoherente en ordinal %',
      NEW.source_convocatoria_item_index;
  END IF;

  IF NEW.order_number IS DISTINCT FROM (v_canonical ->> 'order_number')::integer
     OR btrim(NEW.title) IS DISTINCT FROM v_canonical ->> 'title'
     OR NULLIF(btrim(NEW.matter_code), '') IS DISTINCT FROM v_canonical ->> 'matter_code'
     OR upper(NEW.kind) IS DISTINCT FROM v_canonical ->> 'kind'
     OR NULLIF(btrim(NEW.decision_subtype), '') IS DISTINCT FROM v_canonical ->> 'decision_subtype'
     OR NULLIF(btrim(NEW.proposal_text), '') IS DISTINCT FROM v_canonical ->> 'proposal_text'
     OR COALESCE(NEW.requires_attachments, false)
        IS DISTINCT FROM (v_canonical ->> 'requires_attachments')::boolean THEN
    RAISE EXCEPTION 'agenda binding: el punto celebrado diverge de la convocatoria inmutable (ordinal %)',
      NEW.source_convocatoria_item_index;
  END IF;

  NEW.source_item_hash_sha256 := encode(
    extensions.digest(v_canonical::text, 'sha256'),
    'hex'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_secretaria_guard_convocation_agenda_binding
  ON public.agenda_items;
CREATE TRIGGER trg_secretaria_guard_convocation_agenda_binding
  BEFORE INSERT OR UPDATE OF
    meeting_id,
    tenant_id,
    order_number,
    title,
    matter_code,
    kind,
    decision_subtype,
    proposal_text,
    requires_attachments,
    source_convocatoria_id,
    source_convocatoria_item_index,
    source_item_hash_sha256
  ON public.agenda_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_convocation_agenda_binding();

CREATE OR REPLACE FUNCTION public.fn_secretaria_materialize_convocation_agenda(
  p_meeting_id uuid,
  p_convocatoria_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_agenda_item public.agenda_items%ROWTYPE;
  v_item jsonb;
  v_canonical jsonb;
  v_index integer;
  v_item_count integer;
  v_changed integer := 0;
  v_has_changelog boolean;
  v_has_final_minute boolean;
  v_needs_source_link boolean;
  v_source_link text;
  v_scheduled_link text;
  v_quorum jsonb;
  v_source_links jsonb;
  v_scheduled_from jsonb;
  v_canonical_agenda jsonb := '[]'::jsonb;
  v_agenda_hash text;
  v_expected_item_hash text;
  v_existing_agenda_binding jsonb;
  v_needs_reconcile boolean;
BEGIN
  IF p_meeting_id IS NULL OR p_convocatoria_id IS NULL THEN
    RAISE EXCEPTION 'agenda materialization: meeting_id y convocatoria_id son obligatorios';
  END IF;

  SELECT * INTO v_meeting
  FROM public.meetings
  WHERE id = p_meeting_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda materialization: reunión no encontrada';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_meeting.tenant_id THEN
      RAISE EXCEPTION 'agenda materialization: tenant no autorizado';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  SELECT * INTO v_convocatoria
  FROM public.convocatorias
  WHERE id = p_convocatoria_id
    AND tenant_id = v_meeting.tenant_id
    AND body_id = v_meeting.body_id
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda materialization: convocatoria fuera del órgano o tenant de la reunión';
  END IF;

  IF v_convocatoria.estado <> 'EMITIDA'
     OR v_convocatoria.immutable_at IS NULL
     OR v_convocatoria.fecha_1 IS NULL
     OR v_meeting.scheduled_start IS NULL
     OR v_convocatoria.fecha_1::date <> v_meeting.scheduled_start::date
     OR jsonb_typeof(v_convocatoria.agenda_items) <> 'array'
     OR jsonb_array_length(v_convocatoria.agenda_items) = 0 THEN
    RAISE EXCEPTION 'agenda materialization: convocatoria no emitida, mutable, incompleta o fuera de fecha';
  END IF;

  v_source_link := NULLIF(v_meeting.quorum_data #>> '{source_links,convocatoria_id}', '');
  v_scheduled_link := NULLIF(v_meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '');
  IF (v_source_link IS NOT NULL AND v_source_link <> p_convocatoria_id::text)
     OR (v_scheduled_link IS NOT NULL AND v_scheduled_link <> p_convocatoria_id::text)
     OR (
       jsonb_typeof(v_meeting.quorum_data #> '{source_links,convocatoria_ids}') = 'array'
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements_text(v_meeting.quorum_data #> '{source_links,convocatoria_ids}') AS linked(value)
         WHERE linked.value <> p_convocatoria_id::text
       )
     ) THEN
    RAISE EXCEPTION 'agenda materialization: la reunión ya apunta a otra convocatoria';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.agenda_item_kind_changelog changelog
    JOIN public.agenda_items item ON item.id = changelog.agenda_item_id
    WHERE item.meeting_id = p_meeting_id
  ) INTO v_has_changelog;

  SELECT EXISTS (
    SELECT 1
    FROM public.minutes minute
    WHERE minute.meeting_id = p_meeting_id
      AND (
        minute.is_locked IS TRUE
        OR minute.signed_at IS NOT NULL
        OR minute.final_legal_artifact_id IS NOT NULL
        OR minute.legal_gate_status NOT IN ('DRAFT', 'MANIFEST_READY')
      )
  ) INTO v_has_final_minute;

  v_needs_source_link := v_source_link IS NULL
    OR v_scheduled_link IS NULL
    OR jsonb_typeof(v_meeting.quorum_data #> '{source_links,convocatoria_ids}') IS DISTINCT FROM 'array';

  IF v_needs_source_link
     AND (v_has_changelog OR v_has_final_minute OR v_meeting.status NOT IN ('DRAFT', 'CONVOCADA')) THEN
    RAISE EXCEPTION 'agenda materialization: no se puede añadir el vínculo tras reclasificación, inicio de sesión o acta final';
  END IF;

  v_item_count := jsonb_array_length(v_convocatoria.agenda_items);
  IF EXISTS (
    SELECT 1
    FROM public.agenda_items item
    WHERE item.meeting_id = p_meeting_id
      AND item.tenant_id = v_meeting.tenant_id
      AND (item.order_number < 1 OR item.order_number > v_item_count)
  ) THEN
    RAISE EXCEPTION 'agenda materialization: existen puntos fuera del orden del día inmutable; revisión manual obligatoria';
  END IF;

  -- El motivo queda en el WORM si una fila legacy cambia de kind. No se usa un
  -- UPDATE silencioso que parezca una reclasificación humana.
  PERFORM set_config(
    'app.kind_change_motivo',
    'RECONCILIACION_CONVOCATORIA_INMUTABLE',
    true
  );

  FOR v_item, v_index IN
    SELECT agenda.value, agenda.ordinality::integer
    FROM jsonb_array_elements(v_convocatoria.agenda_items)
      WITH ORDINALITY AS agenda(value, ordinality)
    ORDER BY agenda.ordinality
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'agenda materialization: punto % no es un objeto JSON', v_index;
    END IF;

    v_canonical := public.fn_secretaria_convocation_agenda_item_canonical(v_item, v_index);
    IF COALESCE(btrim(v_canonical ->> 'title'), '') = ''
       OR COALESCE(btrim(v_canonical ->> 'matter_code'), '') = ''
       OR (
         v_canonical ->> 'kind' = 'DECISORIO'
         AND COALESCE(btrim(v_canonical ->> 'proposal_text'), '') = ''
       )
       OR (
         v_canonical ->> 'kind' <> 'DECISORIO'
         AND v_canonical ->> 'decision_subtype' IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'agenda materialization: punto % incompleto o incoherente', v_index;
    END IF;

    v_expected_item_hash := encode(extensions.digest(v_canonical::text, 'sha256'), 'hex');
    v_canonical_agenda := v_canonical_agenda || jsonb_build_array(v_canonical);

    SELECT * INTO v_agenda_item
    FROM public.agenda_items item
    WHERE item.meeting_id = p_meeting_id
      AND item.tenant_id = v_meeting.tenant_id
      AND item.order_number = v_index
    FOR UPDATE;

    IF FOUND THEN
      IF v_agenda_item.source_convocatoria_id IS NOT NULL
         AND v_agenda_item.source_convocatoria_id <> p_convocatoria_id THEN
        RAISE EXCEPTION 'agenda materialization: punto % ya vinculado a otra convocatoria', v_index;
      END IF;
      IF v_agenda_item.source_convocatoria_item_index IS NOT NULL
         AND v_agenda_item.source_convocatoria_item_index <> v_index THEN
        RAISE EXCEPTION 'agenda materialization: punto % tiene un ordinal de origen incompatible', v_index;
      END IF;

      v_needs_reconcile :=
        btrim(v_agenda_item.title) IS DISTINCT FROM v_canonical ->> 'title'
        OR NULLIF(btrim(v_agenda_item.matter_code), '') IS DISTINCT FROM v_canonical ->> 'matter_code'
        OR upper(v_agenda_item.kind) IS DISTINCT FROM v_canonical ->> 'kind'
        OR NULLIF(btrim(v_agenda_item.decision_subtype), '') IS DISTINCT FROM v_canonical ->> 'decision_subtype'
        OR NULLIF(btrim(v_agenda_item.proposal_text), '') IS DISTINCT FROM v_canonical ->> 'proposal_text'
        OR COALESCE(v_agenda_item.requires_attachments, false)
           IS DISTINCT FROM (v_canonical ->> 'requires_attachments')::boolean
        OR v_agenda_item.source_convocatoria_id IS DISTINCT FROM p_convocatoria_id
        OR v_agenda_item.source_convocatoria_item_index IS DISTINCT FROM v_index
        OR v_agenda_item.source_item_hash_sha256 IS DISTINCT FROM v_expected_item_hash;

      IF v_needs_reconcile THEN
        IF v_has_changelog OR v_has_final_minute
           OR v_meeting.status NOT IN ('DRAFT', 'CONVOCADA') THEN
          RAISE EXCEPTION
            'agenda materialization: punto % diverge y ya existe changelog, sesión iniciada o acta final',
            v_index;
        END IF;

        UPDATE public.agenda_items
        SET title = v_canonical ->> 'title',
            matter_code = v_canonical ->> 'matter_code',
            kind = v_canonical ->> 'kind',
            decision_subtype = v_canonical ->> 'decision_subtype',
            proposal_text = v_canonical ->> 'proposal_text',
            requires_attachments = (v_canonical ->> 'requires_attachments')::boolean,
            source_convocatoria_id = p_convocatoria_id,
            source_convocatoria_item_index = v_index,
            source_item_hash_sha256 = v_expected_item_hash,
            updated_at = now()
        WHERE id = v_agenda_item.id;
        v_changed := v_changed + 1;
      END IF;
    ELSE
      IF v_has_changelog OR v_has_final_minute
         OR v_meeting.status NOT IN ('DRAFT', 'CONVOCADA') THEN
        RAISE EXCEPTION
          'agenda materialization: falta el punto % y la reunión ya no admite materialización',
          v_index;
      END IF;

      INSERT INTO public.agenda_items (
        tenant_id,
        meeting_id,
        order_number,
        title,
        matter_code,
        kind,
        decision_subtype,
        proposal_text,
        requires_attachments,
        source_convocatoria_id,
        source_convocatoria_item_index,
        source_item_hash_sha256
      ) VALUES (
        v_meeting.tenant_id,
        p_meeting_id,
        v_index,
        v_canonical ->> 'title',
        v_canonical ->> 'matter_code',
        v_canonical ->> 'kind',
        v_canonical ->> 'decision_subtype',
        v_canonical ->> 'proposal_text',
        (v_canonical ->> 'requires_attachments')::boolean,
        p_convocatoria_id,
        v_index,
        v_expected_item_hash
      );
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  v_agenda_hash := encode(extensions.digest(v_canonical_agenda::text, 'sha256'), 'hex');
  v_existing_agenda_binding := v_meeting.quorum_data -> 'agenda_binding';

  IF v_needs_source_link
     OR v_existing_agenda_binding IS DISTINCT FROM jsonb_build_object(
       'version', 1,
       'convocatoria_id', p_convocatoria_id,
       'canonical_agenda_hash_sha256', v_agenda_hash
     ) THEN
    IF v_has_changelog OR v_has_final_minute
       OR v_meeting.status NOT IN ('DRAFT', 'CONVOCADA') THEN
      RAISE EXCEPTION 'agenda materialization: metadatos de origen divergentes tras cierre jurídico';
    END IF;

    v_quorum := COALESCE(v_meeting.quorum_data, '{}'::jsonb);
    v_source_links := CASE
      WHEN jsonb_typeof(v_quorum -> 'source_links') = 'object'
        THEN v_quorum -> 'source_links'
      ELSE '{}'::jsonb
    END;
    v_scheduled_from := CASE
      WHEN jsonb_typeof(v_quorum -> 'scheduled_from') = 'object'
        THEN v_quorum -> 'scheduled_from'
      ELSE '{}'::jsonb
    END;
    v_source_links := v_source_links || jsonb_build_object(
      'convocatoria_id', p_convocatoria_id,
      'convocatoria_ids', jsonb_build_array(p_convocatoria_id),
      'source', 'explicit'
    );
    v_scheduled_from := v_scheduled_from || jsonb_build_object(
      'source', 'convocatoria',
      'convocatoria_id', p_convocatoria_id
    );
    v_quorum := jsonb_set(v_quorum, '{source_links}', v_source_links, true);
    v_quorum := jsonb_set(v_quorum, '{scheduled_from}', v_scheduled_from, true);
    v_quorum := jsonb_set(
      v_quorum,
      '{agenda_binding}',
      jsonb_build_object(
        'version', 1,
        'convocatoria_id', p_convocatoria_id,
        'canonical_agenda_hash_sha256', v_agenda_hash
      ),
      true
    );

    UPDATE public.meetings
    SET quorum_data = v_quorum
    WHERE id = p_meeting_id
      AND tenant_id = v_meeting.tenant_id;
  END IF;

  IF (
    SELECT count(*)
    FROM public.agenda_items item
    WHERE item.meeting_id = p_meeting_id
      AND item.tenant_id = v_meeting.tenant_id
      AND item.source_convocatoria_id = p_convocatoria_id
  ) <> v_item_count THEN
    RAISE EXCEPTION 'agenda materialization: cardinalidad final distinta de la convocatoria';
  END IF;

  RETURN jsonb_build_object(
    'meeting_id', p_meeting_id,
    'convocatoria_id', p_convocatoria_id,
    'materialized_items', v_item_count,
    'changed_items', v_changed,
    'canonical_agenda_hash_sha256', v_agenda_hash
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_secretaria_materialize_convocation_agenda(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_materialize_convocation_agenda(uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_secretaria_materialize_convocation_agenda(uuid, uuid) IS
  'Materializa/reconcilia atómicamente agenda_items desde una convocatoria EMITIDA e inmutable; falla cerrado ante changelog WORM, sesión iniciada, acta final o fuentes divergentes.';

-- Backfill conservador: solo entra una reunión cuando el vínculo es unívoco,
-- no hay acta final ni changelog y cualquier dato ya informado coincide con la
-- convocatoria. Los NULL/default legacy se rellenan; una divergencia real se
-- deja intacta para revisión manual.
DO $backfill$
DECLARE
  v_candidate record;
  v_previous_claim_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- La propia migración no llega por PostgREST y, por tanto, no trae JWT.
  -- Se habilita el bypass ya reservado a service_role únicamente durante este
  -- backfill acotado; la RPC pública conserva intactos sus gates de tenant y
  -- rol para todas las llamadas autenticadas posteriores.
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

  FOR v_candidate IN
    WITH refs AS (
      SELECT
        meeting.id AS meeting_id,
        meeting.tenant_id,
        NULLIF(meeting.quorum_data #>> '{source_links,convocatoria_id}', '') AS source_ref,
        NULLIF(meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '') AS scheduled_ref
      FROM public.meetings meeting
    ), univocal AS (
      SELECT
        refs.*,
        CASE
          WHEN source_ref IS NULL THEN scheduled_ref
          WHEN scheduled_ref IS NULL THEN source_ref
          WHEN source_ref = scheduled_ref THEN source_ref
          ELSE NULL
        END AS convocatoria_ref
      FROM refs
      WHERE source_ref IS NOT NULL OR scheduled_ref IS NOT NULL
    )
    SELECT meeting.id AS meeting_id, convocatoria.id AS convocatoria_id
    FROM univocal link
    JOIN public.meetings meeting ON meeting.id = link.meeting_id
    JOIN public.convocatorias convocatoria
      ON convocatoria.id = CASE
        WHEN link.convocatoria_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN link.convocatoria_ref::uuid
        ELSE NULL
      END
     AND convocatoria.tenant_id = meeting.tenant_id
     AND convocatoria.body_id = meeting.body_id
     AND convocatoria.estado = 'EMITIDA'
     AND convocatoria.immutable_at IS NOT NULL
     AND convocatoria.fecha_1::date = meeting.scheduled_start::date
     AND jsonb_typeof(convocatoria.agenda_items) = 'array'
     AND jsonb_array_length(convocatoria.agenda_items) > 0
    WHERE meeting.status IN ('DRAFT', 'CONVOCADA')
      AND NOT EXISTS (
        SELECT 1
        FROM public.minutes minute
        WHERE minute.meeting_id = meeting.id
          AND (
            minute.is_locked IS TRUE
            OR minute.signed_at IS NOT NULL
            OR minute.final_legal_artifact_id IS NOT NULL
            OR minute.legal_gate_status NOT IN ('DRAFT', 'MANIFEST_READY')
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.agenda_item_kind_changelog changelog
        JOIN public.agenda_items item ON item.id = changelog.agenda_item_id
        WHERE item.meeting_id = meeting.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(convocatoria.agenda_items)
          WITH ORDINALITY AS agenda(value, ordinality)
        CROSS JOIN LATERAL (
          SELECT public.fn_secretaria_convocation_agenda_item_canonical(
            agenda.value,
            agenda.ordinality::integer
          ) AS canonical
        ) desired
        WHERE jsonb_typeof(agenda.value) <> 'object'
           OR COALESCE(btrim(desired.canonical ->> 'title'), '') = ''
           OR COALESCE(btrim(desired.canonical ->> 'matter_code'), '') = ''
           OR (
             desired.canonical ->> 'kind' = 'DECISORIO'
             AND COALESCE(btrim(desired.canonical ->> 'proposal_text'), '') = ''
           )
           OR (
             desired.canonical ->> 'kind' <> 'DECISORIO'
             AND desired.canonical ->> 'decision_subtype' IS NOT NULL
           )
      )
      AND NOT EXISTS (
        WITH desired AS (
          SELECT
            agenda.ordinality::integer AS order_number,
            public.fn_secretaria_convocation_agenda_item_canonical(
              agenda.value,
              agenda.ordinality::integer
            ) AS canonical
          FROM jsonb_array_elements(convocatoria.agenda_items)
            WITH ORDINALITY AS agenda(value, ordinality)
        )
        SELECT 1
        FROM public.agenda_items item
        LEFT JOIN desired ON desired.order_number = item.order_number
        WHERE item.meeting_id = meeting.id
          AND (
            desired.order_number IS NULL
            OR btrim(item.title) IS DISTINCT FROM desired.canonical ->> 'title'
            OR upper(item.kind) IS DISTINCT FROM desired.canonical ->> 'kind'
            OR NULLIF(btrim(item.decision_subtype), '')
               IS DISTINCT FROM desired.canonical ->> 'decision_subtype'
            OR (
              NULLIF(btrim(item.matter_code), '') IS NOT NULL
              AND NULLIF(btrim(item.matter_code), '')
                  IS DISTINCT FROM desired.canonical ->> 'matter_code'
            )
            OR (
              NULLIF(btrim(item.proposal_text), '') IS NOT NULL
              AND NULLIF(btrim(item.proposal_text), '')
                  IS DISTINCT FROM desired.canonical ->> 'proposal_text'
            )
            OR (
              item.requires_attachments IS TRUE
              AND (desired.canonical ->> 'requires_attachments')::boolean IS FALSE
            )
            OR (
              item.source_convocatoria_id IS NOT NULL
              AND item.source_convocatoria_id <> convocatoria.id
            )
            OR (
              item.source_convocatoria_item_index IS NOT NULL
              AND item.source_convocatoria_item_index <> item.order_number
            )
            OR (
              item.source_item_hash_sha256 IS NOT NULL
              AND item.source_item_hash_sha256 <> encode(extensions.digest(desired.canonical::text, 'sha256'), 'hex')
            )
          )
      )
  LOOP
    PERFORM public.fn_secretaria_materialize_convocation_agenda(
      v_candidate.meeting_id,
      v_candidate.convocatoria_id
    );
  END LOOP;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.role',
    COALESCE(v_previous_claim_role, ''),
    true
  );
END;
$backfill$;

-- Self-check 1: un vínculo parcial o un hash que no describe exactamente el
-- JSON inmutable aborta la migración.
DO $self_check$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.agenda_items item
    JOIN public.convocatorias convocatoria
      ON convocatoria.id = item.source_convocatoria_id
     AND convocatoria.tenant_id = item.tenant_id
    CROSS JOIN LATERAL (
      SELECT public.fn_secretaria_convocation_agenda_item_canonical(
        convocatoria.agenda_items -> (item.source_convocatoria_item_index - 1),
        item.source_convocatoria_item_index
      ) AS canonical
    ) expected
    WHERE item.source_convocatoria_id IS NOT NULL
      AND (
        jsonb_typeof(convocatoria.agenda_items -> (item.source_convocatoria_item_index - 1)) <> 'object'
        OR btrim(item.title) IS DISTINCT FROM expected.canonical ->> 'title'
        OR NULLIF(btrim(item.matter_code), '') IS DISTINCT FROM expected.canonical ->> 'matter_code'
        OR upper(item.kind) IS DISTINCT FROM expected.canonical ->> 'kind'
        OR NULLIF(btrim(item.decision_subtype), '') IS DISTINCT FROM expected.canonical ->> 'decision_subtype'
        OR NULLIF(btrim(item.proposal_text), '') IS DISTINCT FROM expected.canonical ->> 'proposal_text'
        OR COALESCE(item.requires_attachments, false)
           IS DISTINCT FROM (expected.canonical ->> 'requires_attachments')::boolean
        OR item.source_item_hash_sha256
           IS DISTINCT FROM encode(extensions.digest(expected.canonical::text, 'sha256'), 'hex')
      )
  ) THEN
    RAISE EXCEPTION 'agenda binding self-check: existe un punto vinculado que diverge de su convocatoria';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agenda_items item
    JOIN public.meetings meeting ON meeting.id = item.meeting_id
    WHERE item.source_convocatoria_id IS NOT NULL
      AND (
        NULLIF(meeting.quorum_data #>> '{source_links,convocatoria_id}', '')
          IS DISTINCT FROM item.source_convocatoria_id::text
        OR NULLIF(meeting.quorum_data #>> '{scheduled_from,convocatoria_id}', '')
          IS DISTINCT FROM item.source_convocatoria_id::text
      )
  ) THEN
    RAISE EXCEPTION 'agenda binding self-check: reunión vinculada sin referencia unívoca a convocatoria';
  END IF;
END;
$self_check$;

COMMIT;
