-- Secretaria — autorización fail-closed de borradores documentales.
--
-- Cierra la policy legacy que trataba una sesión sin tenant como el tenant demo
-- y permitía SELECT/INSERT/UPDATE a `anon`. Desde esta migración:
--   * anon no tiene privilegios de tabla ni de RPC;
--   * authenticated solo puede leer borradores del tenant resuelto por la cadena
--     canónica JWT/app_metadata/user_profiles y con un rol activo
--     SECRETARIO/ADMIN_TENANT;
--   * las escrituras de borrador pasan por una RPC estrecha;
--   * APPROVED/PROMOTED y el resto del ciclo pasan por una RPC de transición con
--     compare-and-swap y autorización de servidor;
--   * service_role conserva acceso administrativo directo.
--
-- Forward-only: no reescribe la migración histórica ya aplicada ni modifica
-- filas existentes.

BEGIN;

-- Validador autoritativo de la salida visible. El resultado que envía el
-- navegador es solo diagnóstico de UX: no puede habilitar una aprobación. Esta
-- función vuelve a evaluar el texto persistido y liga el resultado al SHA-256
-- calculado por PostgreSQL sobre exactamente ese texto UTF-8.
CREATE OR REPLACE FUNCTION public.fn_secretaria_validate_document_draft_body(
  p_document_type text,
  p_rendered_body_text text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_document_type text := upper(btrim(COALESCE(p_document_type, '')));
  v_body text := btrim(COALESCE(p_rendered_body_text, ''));
  v_normalized text;
  v_hash text;
  v_issues jsonb := '[]'::jsonb;
  v_required_markers text[] := ARRAY[]::text[];
  v_marker text;
BEGIN
  v_normalized := upper(translate(
    v_body,
    'ÁÉÍÓÚÜÑáéíóúüñ',
    'AEIOUUNAEIOUUN'
  ));
  v_hash := encode(
    extensions.digest(convert_to(v_body, 'UTF8'), 'sha256'),
    'hex'
  );

  IF v_body = '' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'RENDERED_TEXT_EMPTY',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El render final está vacío.'
    ));
  ELSIF char_length(v_body) < 80 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'RENDERED_TEXT_TOO_SHORT',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El render final no contiene texto jurídico sustantivo suficiente.'
    ));
  END IF;

  IF v_document_type NOT IN (
    'CONVOCATORIA',
    'ACTA',
    'CERTIFICACION',
    'INFORME_PRECEPTIVO',
    'INFORME_DOCUMENTAL_PRE',
    'INFORME_GESTION',
    'MODELO_ACUERDO',
    'ACUERDO_SIN_SESION',
    'DECISION_UNIPERSONAL',
    'DOCUMENTO_REGISTRAL',
    'SUBSANACION_REGISTRAL'
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'UNSUPPORTED_DOCUMENT_TYPE',
      'severity', 'BLOCKING',
      'field_path', 'document_type',
      'message', 'El tipo documental no pertenece al contrato de Secretaría.'
    ));
  END IF;

  IF v_body ~ '\{\{[^}]+\}\}' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'ORPHAN_TEMPLATE_VARIABLES',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'Quedan variables de plantilla sin resolver.'
    ));
  END IF;

  IF v_normalized ~ '\[(DATO|CAMPO)[^]]*PENDIENTE[^]]*\]'
     OR v_normalized ~ 'ACTA EN BORRADOR'
     OR v_normalized ~ 'NO ACREDITA TODAVIA LA APROBACION' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'DRAFT_PLACEHOLDER_REMAINS',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El documento conserva avisos o datos pendientes propios de un borrador.'
    ));
  END IF;

  IF v_body ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'VISIBLE_INTERNAL_UUID',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El documento visible contiene un UUID interno.'
    ));
  END IF;

  IF v_normalized ~ '(AGREEMENT(S)?\.ID|AGREEMENT ID|CERTIFICACION ID|REQUEST ID|SNAPSHOT( DE)? REGLAS|TRAZA REGISTRAL|TRAZABILIDAD DOCUMENTAL|TRAZABILIDAD DEL ACTO)' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'VISIBLE_INTERNAL_TRACE',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El documento visible contiene trazabilidad técnica reservada.'
    ));
  END IF;

  IF v_body ~* 'D\./D\.ª' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'UNRESOLVED_PERSON_TREATMENT',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'Queda un tratamiento genérico D./D.ª sin resolver.'
    ));
  END IF;

  IF v_body ~ '(^|[^0-9])[0-9]{4}-[0-9]{2}-[0-9]{2}([^0-9]|$)' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'VISIBLE_ISO_DATE',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'Queda una fecha ISO en el cuerpo visible.'
    ));
  END IF;

  IF v_normalized ~ '[A-Z][A-Z0-9]*_[A-Z0-9_]+' OR v_body ~ '\m[a-z][a-z0-9]*_[a-z0-9_]+\M' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'VISIBLE_MACHINE_VALUE',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El documento visible contiene una clave técnica sin humanizar.'
    ));
  END IF;

  IF v_normalized ~ '(A FAVOR DE|EN LA FIGURA DE|SE DELEGAN? EN)[[:space:]]*([.,(]|$)' THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'REQUIRED_RECIPIENT_BLANK',
      'severity', 'BLOCKING',
      'field_path', 'rendered_body_text',
      'message', 'El destinatario obligatorio del poder o delegación está vacío.'
    ));
  END IF;

  v_required_markers := CASE v_document_type
    WHEN 'CONVOCATORIA' THEN ARRAY['CONVOCATORIA', 'ORDEN DEL DIA']::text[]
    WHEN 'ACTA' THEN ARRAY[
      'ACTA',
      'ENCABEZADO',
      'CONSTITUCION DE LA REUNION',
      'ORDEN DEL DIA',
      'DESARROLLO DE LA SESION',
      'ACUERDOS Y VOTACIONES',
      'APROBACION DEL ACTA',
      'FIRMAS'
    ]::text[]
    WHEN 'CERTIFICACION' THEN ARRAY['CERTIF']::text[]
    WHEN 'INFORME_PRECEPTIVO' THEN ARRAY['INFORME']::text[]
    WHEN 'INFORME_DOCUMENTAL_PRE' THEN ARRAY['INFORME', 'DOCUMENT']::text[]
    WHEN 'INFORME_GESTION' THEN ARRAY['INFORME']::text[]
    WHEN 'MODELO_ACUERDO' THEN ARRAY['ACUERDO']::text[]
    WHEN 'ACUERDO_SIN_SESION' THEN ARRAY['ACUERDO']::text[]
    WHEN 'DECISION_UNIPERSONAL' THEN ARRAY['DECISION']::text[]
    WHEN 'DOCUMENTO_REGISTRAL' THEN ARRAY['REGISTR']::text[]
    WHEN 'SUBSANACION_REGISTRAL' THEN ARRAY['SUBSAN']::text[]
    ELSE ARRAY[]::text[]
  END;

  FOREACH v_marker IN ARRAY v_required_markers LOOP
    IF strpos(v_normalized, v_marker) = 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'REQUIRED_SECTION_MISSING',
        'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', format('No se detecta la sección obligatoria %s para %s.', v_marker, v_document_type)
      ));
    END IF;
  END LOOP;

  IF v_document_type = 'CERTIFICACION' THEN
    IF v_normalized !~ 'FIRMA (DE LA SECRETARIA|DEL CERTIFICANTE)' THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'CERTIFICATION_SIGNATURE_BLOCK_MISSING', 'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', 'La certificación no contiene firma del certificante.'
      ));
    END IF;
    IF strpos(v_normalized, 'VISTO BUENO') = 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'CERTIFICATION_APPROVAL_SIGNATURE_MISSING', 'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', 'La certificación no contiene visto bueno de la Presidencia.'
      ));
    END IF;
    IF strpos(v_normalized, 'CARGO VIGENTE Y EN EJERCICIO') = 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'CERTIFICATION_CURRENT_ROLE_MISSING', 'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', 'La certificación no declara la vigencia del cargo certificante.'
      ));
    END IF;
    IF v_normalized !~ 'EL ACTA (FUE|HA SIDO) APROBADA' THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'CERTIFICATION_MINUTE_APPROVAL_MISSING', 'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', 'La certificación no indica la aprobación del acta.'
      ));
    END IF;
  END IF;

  IF v_document_type IN ('DOCUMENTO_REGISTRAL', 'SUBSANACION_REGISTRAL') THEN
    IF v_normalized !~ '(DEMO|NO OFICIAL)' THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'REGISTRY_DEMO_MARKER_MISSING', 'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', 'El documento registral simulado debe identificarse como DEMO o NO OFICIAL.'
      ));
    END IF;
    IF strpos(v_normalized, 'NO ACREDITA POR SI SOLO') = 0 THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'REGISTRY_SCOPE_NOTICE_MISSING', 'severity', 'BLOCKING',
        'field_path', 'rendered_body_text',
        'message', 'Falta el aviso de alcance registral.'
      ));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_issues) = 0,
    'issues', v_issues,
    'validator', 'SERVER_RENDERED_BODY_V1',
    'validated_hash_sha256', v_hash
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_validate_document_draft_body(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_validate_document_draft_body(text, text)
  TO service_role;

-- Defensa en profundidad: incluso si una migración futura reintrodujese grants
-- de escritura, una operación de cliente no puede saltarse las RPCs gobernadas.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_document_draft_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lane text := NULLIF(current_setting('app.secretaria_document_draft_write_lane', true), '');
BEGIN
  IF public.fn_secretaria_is_service_role() IS TRUE THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     AND current_user = 'postgres'
     AND v_lane = 'SAVE_DRAFT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND current_user = 'postgres'
     AND v_lane IN ('SAVE_DRAFT', 'TRANSITION_DRAFT') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'direct document draft write forbidden; use the governed RPC'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_document_draft_write()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_document_draft_write()
  TO service_role;

DROP TRIGGER IF EXISTS tr_secretaria_document_draft_write_guard
  ON public.secretaria_document_drafts;
CREATE TRIGGER tr_secretaria_document_draft_write_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.secretaria_document_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_document_draft_write();

-- Guarda exclusivamente los dos estados editables usados por el Composer. La
-- RPC deriva actor y tiempo; ignora cualquier created_by/updated_by/updated_at
-- recibido y no permite elevar el estado a revisión, aprobación o promoción.
CREATE OR REPLACE FUNCTION public.fn_secretaria_save_document_draft(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_current_tenant_id uuid;
  v_actor_id uuid := auth.uid();
  v_document_request_id text;
  v_draft_key_sha256 text;
  v_request_hash_sha256 text;
  v_document_type text;
  v_agreement_id uuid;
  v_template_id uuid;
  v_template_tipo text;
  v_template_version text;
  v_version integer;
  v_draft_state text;
  v_rendered_body_text text;
  v_system_trace_text text;
  v_capa3_values jsonb;
  v_post_render_validation jsonb;
  v_content_hash_sha256 text;
  v_metadata jsonb;
  v_existing public.secretaria_document_drafts%ROWTYPE;
  v_saved public.secretaria_document_drafts%ROWTYPE;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'document draft payload must be a JSON object';
  END IF;

  BEGIN
    v_tenant_id := NULLIF(p_payload ->> 'tenant_id', '')::uuid;
    v_agreement_id := NULLIF(p_payload ->> 'agreement_id', '')::uuid;
    v_template_id := NULLIF(p_payload ->> 'template_id', '')::uuid;
    v_version := COALESCE(NULLIF(p_payload ->> 'version', '')::integer, 1);
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'document draft payload contains an invalid uuid or version';
  END;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'document draft tenant_id is required';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'document draft requires an authenticated actor'
        USING ERRCODE = '42501';
    END IF;
    v_current_tenant_id := public.fn_assert_current_tenant_id();
    IF v_current_tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'document draft tenant does not match the active tenant'
        USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  v_document_request_id := btrim(COALESCE(p_payload ->> 'document_request_id', ''));
  v_draft_key_sha256 := lower(btrim(COALESCE(p_payload ->> 'draft_key_sha256', '')));
  v_request_hash_sha256 := lower(btrim(COALESCE(p_payload ->> 'request_hash_sha256', '')));
  v_document_type := upper(btrim(COALESCE(p_payload ->> 'document_type', '')));
  v_template_tipo := NULLIF(btrim(p_payload ->> 'template_tipo'), '');
  v_template_version := NULLIF(btrim(p_payload ->> 'template_version'), '');
  v_draft_state := upper(btrim(COALESCE(p_payload ->> 'draft_state', 'EDITABLE_DRAFT')));
  v_rendered_body_text := btrim(COALESCE(p_payload ->> 'rendered_body_text', ''));
  v_system_trace_text := COALESCE(p_payload ->> 'system_trace_text', '');
  v_capa3_values := COALESCE(p_payload -> 'capa3_values', '{}'::jsonb);
  v_metadata := COALESCE(p_payload -> 'metadata', '{}'::jsonb) - 'server_state_history';

  IF v_document_request_id = '' OR length(v_document_request_id) > 512 THEN
    RAISE EXCEPTION 'document_request_id is required and must not exceed 512 characters';
  END IF;
  IF v_draft_key_sha256 !~ '^[0-9a-f]{64}$'
     OR v_request_hash_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'document draft identity hashes must be lowercase SHA-256';
  END IF;
  IF v_document_type = '' OR length(v_document_type) > 80 THEN
    RAISE EXCEPTION 'document_type is required and must not exceed 80 characters';
  END IF;
  IF v_document_type NOT IN (
    'CONVOCATORIA',
    'ACTA',
    'CERTIFICACION',
    'INFORME_PRECEPTIVO',
    'INFORME_DOCUMENTAL_PRE',
    'INFORME_GESTION',
    'MODELO_ACUERDO',
    'ACUERDO_SIN_SESION',
    'DECISION_UNIPERSONAL',
    'DOCUMENTO_REGISTRAL',
    'SUBSANACION_REGISTRAL'
  ) THEN
    RAISE EXCEPTION 'unsupported document_type: %', v_document_type;
  END IF;
  IF v_version IS NULL OR v_version <= 0 THEN
    RAISE EXCEPTION 'document draft version must be a positive integer';
  END IF;
  IF v_draft_state NOT IN ('EDITABLE_DRAFT', 'DRAFT_CONFIGURED') THEN
    RAISE EXCEPTION 'save RPC only accepts EDITABLE_DRAFT or DRAFT_CONFIGURED';
  END IF;
  IF v_rendered_body_text = '' THEN
    RAISE EXCEPTION 'rendered_body_text must not be empty';
  END IF;
  IF jsonb_typeof(v_capa3_values) <> 'object'
     OR jsonb_typeof(v_metadata) <> 'object' THEN
    RAISE EXCEPTION 'capa3_values and metadata must be JSON objects';
  END IF;

  -- Nunca se usa `post_render_validation` ni `content_hash_sha256` del JSON
  -- como verdad. Ambos se derivan del cuerpo exacto que se va a persistir.
  v_post_render_validation := public.fn_secretaria_validate_document_draft_body(
    v_document_type,
    v_rendered_body_text
  );
  v_content_hash_sha256 := v_post_render_validation ->> 'validated_hash_sha256';
  IF v_content_hash_sha256 IS NULL
     OR v_content_hash_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'server document draft SHA-256 calculation failed';
  END IF;

  IF v_agreement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.agreements agreement
     WHERE agreement.id = v_agreement_id
       AND agreement.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'document draft agreement is outside payload tenant'
      USING ERRCODE = '42501';
  END IF;

  IF v_template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.plantillas_protegidas template
     WHERE template.id = v_template_id
       AND template.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'document draft template is outside payload tenant'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'SECRETARIA:DOCUMENT_DRAFT:' || v_tenant_id::text || ':' || v_draft_key_sha256 || ':' || v_version::text,
    0
  ));

  SELECT *
    INTO v_existing
    FROM public.secretaria_document_drafts draft
   WHERE draft.tenant_id = v_tenant_id
     AND draft.draft_key_sha256 = v_draft_key_sha256
     AND draft.version = v_version
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.draft_state NOT IN ('EDITABLE_DRAFT', 'DRAFT_CONFIGURED') THEN
      RAISE EXCEPTION 'document draft content is immutable after submission to review'
        USING ERRCODE = '42501';
    END IF;
    IF v_existing.request_hash_sha256 IS DISTINCT FROM v_request_hash_sha256
       OR v_existing.document_type IS DISTINCT FROM v_document_type
       OR v_existing.agreement_id IS DISTINCT FROM v_agreement_id
       OR v_existing.template_id IS DISTINCT FROM v_template_id THEN
      RAISE EXCEPTION 'document draft immutable identity differs from existing row';
    END IF;
  END IF;

  PERFORM set_config('app.secretaria_document_draft_write_lane', 'SAVE_DRAFT', true);

  IF v_existing.id IS NULL THEN
    INSERT INTO public.secretaria_document_drafts (
      tenant_id,
      document_request_id,
      draft_key_sha256,
      request_hash_sha256,
      document_type,
      agreement_id,
      template_id,
      template_tipo,
      template_version,
      version,
      draft_state,
      rendered_body_text,
      system_trace_text,
      capa3_values,
      post_render_validation,
      content_hash_sha256,
      configured_at,
      created_by,
      updated_by,
      metadata
    ) VALUES (
      v_tenant_id,
      v_document_request_id,
      v_draft_key_sha256,
      v_request_hash_sha256,
      v_document_type,
      v_agreement_id,
      v_template_id,
      v_template_tipo,
      v_template_version,
      v_version,
      v_draft_state,
      v_rendered_body_text,
      v_system_trace_text,
      v_capa3_values,
      v_post_render_validation,
      v_content_hash_sha256,
      CASE WHEN v_draft_state = 'DRAFT_CONFIGURED' THEN clock_timestamp() ELSE NULL END,
      v_actor_id,
      v_actor_id,
      v_metadata || jsonb_build_object('server_state_history', '[]'::jsonb)
    )
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.secretaria_document_drafts draft
       SET document_request_id = v_document_request_id,
           template_tipo = v_template_tipo,
           template_version = v_template_version,
           draft_state = v_draft_state,
           rendered_body_text = v_rendered_body_text,
           system_trace_text = v_system_trace_text,
           capa3_values = v_capa3_values,
           post_render_validation = v_post_render_validation,
           content_hash_sha256 = v_content_hash_sha256,
           configured_at = CASE
             WHEN v_draft_state = 'DRAFT_CONFIGURED' THEN clock_timestamp()
             ELSE NULL
           END,
           updated_by = v_actor_id,
           metadata = v_metadata || jsonb_build_object(
             'server_state_history',
             COALESCE(v_existing.metadata -> 'server_state_history', '[]'::jsonb)
           )
     WHERE draft.id = v_existing.id
     RETURNING * INTO v_saved;
  END IF;

  RETURN to_jsonb(v_saved);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_save_document_draft(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_save_document_draft(jsonb)
  TO authenticated, service_role;

-- Ciclo autoritativo. `p_expected_state` actúa como CAS para que una pestaña
-- obsoleta no pueda aprobar o promover una revisión distinta.
CREATE OR REPLACE FUNCTION public.fn_secretaria_transition_document_draft(
  p_draft_id uuid,
  p_expected_state text,
  p_to_state text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_draft public.secretaria_document_drafts%ROWTYPE;
  v_actor_id uuid := auth.uid();
  v_current_tenant_id uuid;
  v_from text := upper(btrim(COALESCE(p_expected_state, '')));
  v_to text := upper(btrim(COALESCE(p_to_state, '')));
  v_reason text := NULLIF(btrim(p_reason), '');
  v_allowed boolean := false;
  v_server_validation jsonb;
  v_server_content_hash_sha256 text;
  v_saved public.secretaria_document_drafts%ROWTYPE;
BEGIN
  IF p_draft_id IS NULL OR v_from = '' OR v_to = '' THEN
    RAISE EXCEPTION 'draft id, expected state and target state are required';
  END IF;

  SELECT *
    INTO v_draft
    FROM public.secretaria_document_drafts draft
   WHERE draft.id = p_draft_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document draft not found';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'document draft transition requires an authenticated actor'
        USING ERRCODE = '42501';
    END IF;
    v_current_tenant_id := public.fn_assert_current_tenant_id();
    IF v_current_tenant_id IS DISTINCT FROM v_draft.tenant_id THEN
      RAISE EXCEPTION 'document draft tenant does not match the active tenant'
        USING ERRCODE = '42501';
    END IF;

    -- La reserva de aprobación no termina al alcanzar el estado: también
    -- protege cualquier degradación, rechazo o archivo posterior. Se usa el
    -- estado real bloqueado de la fila, nunca solo el `expected_state` cliente.
    IF v_draft.draft_state IN ('APPROVED', 'PROMOTED')
       OR v_to IN ('APPROVED', 'PROMOTED') THEN
      PERFORM public.fn_secretaria_assert_role_allowed(
        v_draft.tenant_id,
        ARRAY['ADMIN_TENANT']::text[]
      );
    ELSE
      PERFORM public.fn_secretaria_assert_role_allowed(
        v_draft.tenant_id,
        ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
      );
    END IF;
  END IF;

  IF v_draft.draft_state IS DISTINCT FROM v_from THEN
    RAISE EXCEPTION 'document draft state changed: expected %, found %',
      v_from, v_draft.draft_state
      USING ERRCODE = '40001';
  END IF;

  v_allowed := CASE v_from
    WHEN 'EDITABLE_DRAFT' THEN v_to IN ('DRAFT_CONFIGURED', 'PENDING_REVIEW', 'ARCHIVED')
    WHEN 'DRAFT_CONFIGURED' THEN v_to IN ('EDITABLE_DRAFT', 'PENDING_REVIEW', 'ARCHIVED')
    WHEN 'PENDING_REVIEW' THEN v_to IN ('IN_REVIEW', 'REJECTED', 'ARCHIVED')
    WHEN 'IN_REVIEW' THEN v_to IN ('APPROVED', 'REJECTED', 'PENDING_REVIEW', 'ARCHIVED')
    WHEN 'APPROVED' THEN v_to IN ('PROMOTED', 'REJECTED', 'ARCHIVED')
    WHEN 'PROMOTED' THEN v_to = 'ARCHIVED'
    WHEN 'REJECTED' THEN v_to IN ('REGENERATION_NEEDED', 'ARCHIVED')
    WHEN 'REGENERATION_NEEDED' THEN v_to IN ('EDITABLE_DRAFT', 'ARCHIVED')
    WHEN 'ARCHIVED' THEN false
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'document draft transition not allowed: % -> %', v_from, v_to;
  END IF;

  IF v_to IN ('REJECTED', 'REGENERATION_NEEDED', 'ARCHIVED') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'document draft transition to % requires a reason', v_to;
  END IF;

  IF v_to IN ('APPROVED', 'PROMOTED') THEN
    v_server_validation := public.fn_secretaria_validate_document_draft_body(
      v_draft.document_type,
      v_draft.rendered_body_text
    );
    v_server_content_hash_sha256 := v_server_validation ->> 'validated_hash_sha256';

    IF COALESCE((v_server_validation ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION
        'document draft % requires server-validated rendered content: %',
        lower(v_to),
        COALESCE(v_server_validation -> 'issues', '[]'::jsonb)::text;
    END IF;

    IF v_server_content_hash_sha256 IS NULL
       OR v_server_content_hash_sha256 !~ '^[0-9a-f]{64}$'
       OR v_draft.content_hash_sha256 IS DISTINCT FROM v_server_content_hash_sha256 THEN
      RAISE EXCEPTION
        'document draft % requires an unchanged server-derived SHA-256 hash',
        lower(v_to);
    END IF;
  END IF;

  PERFORM set_config('app.secretaria_document_draft_write_lane', 'TRANSITION_DRAFT', true);

  UPDATE public.secretaria_document_drafts draft
     SET draft_state = v_to,
         configured_at = CASE
           WHEN v_to = 'EDITABLE_DRAFT' THEN NULL
           ELSE draft.configured_at
         END,
         post_render_validation = CASE
           WHEN v_to IN ('APPROVED', 'PROMOTED') THEN v_server_validation
           ELSE draft.post_render_validation
         END,
         updated_by = v_actor_id,
         metadata = jsonb_set(
           COALESCE(draft.metadata, '{}'::jsonb),
           '{server_state_history}',
           COALESCE(draft.metadata -> 'server_state_history', '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object(
               'from', v_from,
               'to', v_to,
               'actor_id', v_actor_id,
               'reason', v_reason,
               'at', clock_timestamp()
             )),
           true
         )
   WHERE draft.id = p_draft_id
     AND draft.draft_state = v_from
   RETURNING * INTO v_saved;

  IF v_saved.id IS NULL THEN
    RAISE EXCEPTION 'document draft transition lost compare-and-swap race'
      USING ERRCODE = '40001';
  END IF;

  RETURN to_jsonb(v_saved);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_transition_document_draft(uuid, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_transition_document_draft(uuid, text, text, text)
  TO authenticated, service_role;

-- Sustituye todas las policies legacy. No existen policies INSERT/UPDATE/DELETE
-- para authenticated; service_role conserva BYPASSRLS y privilegios explícitos.
ALTER TABLE public.secretaria_document_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secretaria_document_drafts_select_tenant
  ON public.secretaria_document_drafts;
DROP POLICY IF EXISTS secretaria_document_drafts_insert_tenant
  ON public.secretaria_document_drafts;
DROP POLICY IF EXISTS secretaria_document_drafts_update_tenant
  ON public.secretaria_document_drafts;
DROP POLICY IF EXISTS secretaria_document_drafts_authenticated_select
  ON public.secretaria_document_drafts;

CREATE POLICY secretaria_document_drafts_authenticated_select
  ON public.secretaria_document_drafts
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND tenant_id = public.fn_current_tenant_id()
    AND public.fn_secretaria_has_active_role(
      tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    )
  );

REVOKE ALL ON TABLE public.secretaria_document_drafts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.secretaria_document_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.secretaria_document_drafts
  TO service_role;

COMMENT ON FUNCTION public.fn_secretaria_save_document_draft(jsonb) IS
  'Persiste contenido solo en estados editables; tenant/actor/rol, validación visible y SHA-256 se derivan y validan en servidor.';
COMMENT ON FUNCTION public.fn_secretaria_transition_document_draft(uuid, text, text, text) IS
  'Transición CAS del ciclo de borradores; APPROVED/PROMOTED requieren ADMIN_TENANT, validación server-side y hash autoritativo inalterado.';

COMMIT;
