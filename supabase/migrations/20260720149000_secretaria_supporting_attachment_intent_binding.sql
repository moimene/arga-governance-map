-- Secretaría — binding WORM de anexos previstos y cierre exacto del paquete.
--
-- La emisión crea el manifiesto antes de subir binarios. Este pase hace
-- explícito ese protocolo: el navegador precompromete identidad/tamaño/MIME y
-- SHA-256/SHA-512; un trigger incorpora la proyección canónica al manifiesto
-- antes de su sello WORM; solo esos binarios pueden registrarse después. El
-- DOCX final exige el set completo y exacto.

BEGIN;

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS supporting_attachment_intent_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_attachments_one_supporting_intent
  ON public.attachments (
    tenant_id,
    convocatoria_id,
    supporting_attachment_intent_id
  )
  WHERE artifact_kind = 'SUPPORTING_DOCUMENT'
    AND supporting_attachment_intent_id IS NOT NULL;

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_verified_supporting_intent_ck;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_verified_supporting_intent_ck CHECK (
    (
      artifact_kind = 'SUPPORTING_DOCUMENT'
      AND artifact_verified_by_service IS TRUE
      AND supporting_attachment_intent_id IS NOT NULL
    )
    OR (
      artifact_kind = 'CONVOCATORIA_FINAL'
      AND supporting_attachment_intent_id IS NULL
    )
    OR artifact_kind IS NULL
    OR artifact_verified_by_service IS NOT TRUE
  ) NOT VALID;

COMMENT ON COLUMN public.attachments.supporting_attachment_intent_id IS
  'UUID server-bound de la intención precomprometida en el manifiesto WORM; NULL para artefacto final e históricos anteriores al contrato 2026-07-21.1.';

-- Las trazas son evidencia de entrada. Aunque el binding autoritativo se copia
-- al manifiesto, tampoco deben reescribirse después del sello de emisión.
CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_trace_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF OLD.immutable_at IS NOT NULL
     AND (
       NEW.rule_trace IS DISTINCT FROM OLD.rule_trace
       OR NEW.reminders_trace IS DISTINCT FROM OLD.reminders_trace
       OR NEW.accepted_warnings IS DISTINCT FROM OLD.accepted_warnings
     ) THEN
    RAISE EXCEPTION 'IMMUTABLE_CONVOCATION_TRACE_MUTATION_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_trace_immutable_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_convocation_trace_immutable
  ON public.convocatorias;
CREATE TRIGGER trg_00_convocation_trace_immutable
  BEFORE UPDATE OF rule_trace, reminders_trace, accepted_warnings
  ON public.convocatorias
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocation_trace_immutable_guard();

-- Se ejecuta después del enriquecimiento de destinatarios (trg_00...) y antes
-- del guard WORM (trg_convocation_manifest_worm), por orden alfabético.
CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_manifest_enrich_supporting_intents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_references jsonb;
  v_intents jsonb := '[]'::jsonb;
  v_reference jsonb;
  v_ordinal bigint;
  v_intent_id uuid;
  v_file_name text;
  v_display_name text;
  v_description text;
  v_size_bytes bigint;
  v_mime_type text;
  v_hash_sha256 text;
  v_hash_sha512 text;
  v_agenda_item_index integer;
BEGIN
  IF COALESCE(pg_catalog.current_setting('app.secretaria_emit_convocatoria_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENTS_REQUIRE_EMISSION_RPC'
      USING ERRCODE = '42501';
  END IF;

  SELECT convocatoria.*
    INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENTS_CONVOCATION_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  v_references := v_convocatoria.reminders_trace #> '{documents,uploaded_references}';
  IF pg_catalog.jsonb_typeof(v_references) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENTS_ARRAY_REQUIRED'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.jsonb_array_length(v_references) > 100 THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENTS_LIMIT_EXCEEDED'
      USING ERRCODE = '22023';
  END IF;

  FOR v_reference, v_ordinal IN
    SELECT reference.value, reference.ordinality
      FROM pg_catalog.jsonb_array_elements(v_references)
        WITH ORDINALITY AS reference(value, ordinality)
     ORDER BY reference.ordinality
  LOOP
    IF pg_catalog.jsonb_typeof(v_reference) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1
           FROM pg_catalog.jsonb_object_keys(v_reference) AS field(key)
          WHERE field.key <> ALL (ARRAY[
            'id','nombre','descripcion','file_name','size_bytes','mime',
            'hash_sha256','hash_sha512','agenda_item_index','upload_status'
          ]::text[])
       ) THEN
      RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_SHAPE_INVALID_AT_%', v_ordinal
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_intent_id := NULLIF(v_reference ->> 'id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_UUID_INVALID_AT_%', v_ordinal
        USING ERRCODE = '22023';
    END;
    v_file_name := pg_catalog.btrim(COALESCE(v_reference ->> 'file_name', ''));
    v_display_name := pg_catalog.btrim(COALESCE(v_reference ->> 'nombre', v_file_name));
    v_description := pg_catalog.btrim(COALESCE(v_reference ->> 'descripcion', ''));
    v_mime_type := pg_catalog.lower(pg_catalog.btrim(COALESCE(v_reference ->> 'mime', '')));
    v_hash_sha256 := pg_catalog.lower(COALESCE(v_reference ->> 'hash_sha256', ''));
    v_hash_sha512 := pg_catalog.lower(COALESCE(v_reference ->> 'hash_sha512', ''));

    IF v_intent_id IS NULL
       OR pg_catalog.length(v_file_name) = 0
       OR pg_catalog.length(v_file_name) > 240
       OR v_file_name ~ '[/\\]'
       OR pg_catalog.jsonb_typeof(v_reference -> 'size_bytes') IS DISTINCT FROM 'number'
       OR COALESCE(v_reference ->> 'size_bytes', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_IDENTITY_INVALID_AT_%', v_ordinal
        USING ERRCODE = '22023';
    END IF;
    v_size_bytes := (v_reference ->> 'size_bytes')::bigint;
    IF v_size_bytes < 1 OR v_size_bytes > 26214400 THEN
      RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_SIZE_INVALID_AT_%', v_ordinal
        USING ERRCODE = '22023';
    END IF;
    IF v_mime_type NOT IN (
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       )
       OR (v_mime_type = 'application/pdf' AND v_file_name !~* '\.pdf$')
       OR (
         v_mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         AND v_file_name !~* '\.docx$'
       ) THEN
      RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_MIME_INVALID_AT_%', v_ordinal
        USING ERRCODE = '22023';
    END IF;
    IF v_hash_sha256 !~ '^[0-9a-f]{64}$'
       OR v_hash_sha512 !~ '^[0-9a-f]{128}$'
       OR v_reference ->> 'upload_status' IS DISTINCT FROM 'intended' THEN
      RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_HASH_OR_STATE_INVALID_AT_%', v_ordinal
        USING ERRCODE = '22023';
    END IF;

    IF v_reference ? 'agenda_item_index'
       AND pg_catalog.jsonb_typeof(v_reference -> 'agenda_item_index') <> 'null' THEN
      IF pg_catalog.jsonb_typeof(v_reference -> 'agenda_item_index') IS DISTINCT FROM 'number'
         OR COALESCE(v_reference ->> 'agenda_item_index', '') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_AGENDA_INDEX_INVALID_AT_%', v_ordinal
          USING ERRCODE = '22023';
      END IF;
      v_agenda_item_index := (v_reference ->> 'agenda_item_index')::integer;
    ELSE
      v_agenda_item_index := NULL;
    END IF;

    v_intents := v_intents || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'intent_id', v_intent_id,
        'ordinal', v_ordinal,
        'display_name', v_display_name,
        'description', v_description,
        'file_name', v_file_name,
        'size_bytes', v_size_bytes,
        'mime_type', v_mime_type,
        'hash_sha256', v_hash_sha256,
        'hash_sha512', v_hash_sha512,
        'agenda_item_index', v_agenda_item_index,
        'intent_state', 'COMMITTED_BEFORE_EMISSION'
      )
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_intents) AS item(value)
     GROUP BY item.value ->> 'intent_id'
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_ID_DUPLICATE'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_intents) AS item(value)
     GROUP BY
       item.value ->> 'file_name',
       item.value ->> 'size_bytes',
       item.value ->> 'mime_type',
       item.value ->> 'hash_sha256',
       item.value ->> 'hash_sha512',
       item.value ->> 'agenda_item_index'
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_BINARY_IDENTITY_DUPLICATE'
      USING ERRCODE = '23505';
  END IF;

  NEW.manifest_json := pg_catalog.jsonb_set(
    pg_catalog.jsonb_set(
      NEW.manifest_json,
      '{renderer_contract_version}',
      pg_catalog.to_jsonb('2026-07-21.1'::text),
      true
    ),
    '{supporting_documents}',
    pg_catalog.jsonb_build_object(
      'schema_version', 'secretaria.convocation-supporting-intents.v1',
      'expected_count', pg_catalog.jsonb_array_length(v_intents),
      'completion_policy', 'EXACT_SET_REQUIRED_BEFORE_FINAL',
      'intents', v_intents
    ),
    true
  );
  NEW.manifest_hash_sha512 := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(NEW.manifest_json::text, 'UTF8'),
      'sha512'
    ),
    'hex'
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_manifest_enrich_supporting_intents()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_01_convocation_manifest_enrich_supporting_intents
  ON public.convocation_manifests;
CREATE TRIGGER trg_01_convocation_manifest_enrich_supporting_intents
  BEFORE INSERT ON public.convocation_manifests
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_convocation_manifest_enrich_supporting_intents();

COMMENT ON FUNCTION secretaria_private.fn_convocation_manifest_enrich_supporting_intents() IS
  'Valida y canoniza en el manifiesto WORM el set exacto de anexos precomprometidos; fija renderer contract 2026-07-21.1 y recalcula SHA-512.';

-- Supersede 147: el manifiesto ya no bloquea los anexos que él mismo prevé.
-- Solo acepta una coincidencia exacta y asigna el intent UUID en servidor.
CREATE OR REPLACE FUNCTION secretaria_private.fn_supporting_attachment_open_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_convocatoria_state text;
  v_supporting_documents jsonb;
  v_match_count bigint;
  v_intent_id uuid;
BEGIN
  IF NEW.convocatoria_id IS NULL
     OR NEW.artifact_kind IS DISTINCT FROM 'SUPPORTING_DOCUMENT' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'COMMUNICATION:CONVOCATORIA:'
        || NEW.tenant_id::text || ':' || NEW.convocatoria_id::text,
      0
    )
  );

  SELECT convocatoria.estado, manifest.manifest_json -> 'supporting_documents'
    INTO v_convocatoria_state, v_supporting_documents
    FROM public.convocatorias convocatoria
    JOIN public.convocation_manifests manifest
      ON manifest.tenant_id = convocatoria.tenant_id
     AND manifest.convocatoria_id = convocatoria.id
     AND manifest.data_class = 'DEMO'
     AND manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id
   FOR UPDATE OF convocatoria;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_CANONICAL_MANIFEST_REQUIRED'
      USING ERRCODE = '23514';
  END IF;
  IF v_convocatoria_state <> 'EMITIDA' THEN
    RAISE EXCEPTION 'TERMINAL_CONVOCATION_SUPPORTING_ATTACHMENTS_ARE_IMMUTABLE'
      USING ERRCODE = '55000';
  END IF;
  IF pg_catalog.jsonb_typeof(v_supporting_documents) IS DISTINCT FROM 'object'
     OR v_supporting_documents ->> 'schema_version'
          IS DISTINCT FROM 'secretaria.convocation-supporting-intents.v1'
     OR v_supporting_documents ->> 'completion_policy'
          IS DISTINCT FROM 'EXACT_SET_REQUIRED_BEFORE_FINAL'
     OR pg_catalog.jsonb_typeof(v_supporting_documents -> 'intents') IS DISTINCT FROM 'array'
     OR COALESCE(v_supporting_documents ->> 'expected_count', '') !~ '^[0-9]+$'
     OR (v_supporting_documents ->> 'expected_count')::integer
          IS DISTINCT FROM pg_catalog.jsonb_array_length(v_supporting_documents -> 'intents') THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_CONTRACT_REQUIRED'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.attachments attachment
     WHERE attachment.tenant_id = NEW.tenant_id
       AND attachment.convocatoria_id = NEW.convocatoria_id
       AND attachment.artifact_kind = 'CONVOCATORIA_FINAL'
  ) THEN
    RAISE EXCEPTION 'FINAL_CONVOCATION_ARTIFACT_FREEZES_SUPPORTING_ATTACHMENTS'
      USING ERRCODE = '55000';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.tenant_id = NEW.tenant_id
       AND communication.convocatoria_id = NEW.convocatoria_id
       AND communication.tipo_comunicacion = 'CONVOCATORIA'
  ) THEN
    RAISE EXCEPTION 'ASSEMBLED_CONVOCATION_PACKAGE_FREEZES_SUPPORTING_ATTACHMENTS'
      USING ERRCODE = '55000';
  END IF;

  SELECT pg_catalog.count(*),
         NULLIF(pg_catalog.min(intent.value ->> 'intent_id'), '')::uuid
    INTO v_match_count, v_intent_id
    FROM pg_catalog.jsonb_array_elements(v_supporting_documents -> 'intents') AS intent(value)
   WHERE intent.value ->> 'file_name' IS NOT DISTINCT FROM NEW.file_name
     AND NULLIF(intent.value ->> 'size_bytes', '')::bigint
          IS NOT DISTINCT FROM NEW.artifact_verified_size_bytes
     AND intent.value ->> 'mime_type'
          IS NOT DISTINCT FROM NEW.artifact_verified_mime_type
     AND intent.value ->> 'hash_sha256'
          IS NOT DISTINCT FROM pg_catalog.lower(NEW.file_hash)
     AND intent.value ->> 'hash_sha512'
          IS NOT DISTINCT FROM pg_catalog.lower(NEW.file_hash_sha512)
     AND NULLIF(intent.value ->> 'agenda_item_index', '')::integer
          IS NOT DISTINCT FROM NEW.agenda_item_index;
  IF v_match_count <> 1 OR v_intent_id IS NULL THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_DOES_NOT_MATCH_EXACT_WORM_INTENT'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.supporting_attachment_intent_id IS NOT NULL
     AND NEW.supporting_attachment_intent_id IS DISTINCT FROM v_intent_id THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_ID_MISMATCH'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.supporting_attachment_intent_id IS NOT NULL
     AND OLD.supporting_attachment_intent_id IS DISTINCT FROM v_intent_id THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_INTENT_IS_IMMUTABLE'
      USING ERRCODE = '42501';
  END IF;
  NEW.supporting_attachment_intent_id := v_intent_id;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_supporting_attachment_open_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_supporting_attachment_open_insert_guard
  ON public.attachments;
DROP TRIGGER IF EXISTS trg_00_supporting_attachment_open_rebind_guard
  ON public.attachments;
DROP TRIGGER IF EXISTS trg_00_supporting_attachment_open_guard
  ON public.attachments;
CREATE TRIGGER trg_00_supporting_attachment_open_guard
  BEFORE INSERT OR UPDATE ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_supporting_attachment_open_guard();

COMMENT ON FUNCTION secretaria_private.fn_supporting_attachment_open_guard() IS
  'Acepta únicamente anexos verificados que coinciden de forma exacta y unívoca con el set WORM; bloquea terminal, final y cualquier paquete de comunicación.';

CREATE OR REPLACE FUNCTION secretaria_private.fn_convocation_supporting_set_valid(
  p_tenant_id uuid,
  p_convocatoria_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_supporting_documents jsonb;
  v_expected_count integer;
  v_actual_count integer;
BEGIN
  SELECT manifest.manifest_json -> 'supporting_documents'
    INTO v_supporting_documents
    FROM public.convocation_manifests manifest
   WHERE manifest.tenant_id = p_tenant_id
     AND manifest.convocatoria_id = p_convocatoria_id
     AND manifest.data_class = 'DEMO'
     AND manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT';
  IF NOT FOUND
     OR pg_catalog.jsonb_typeof(v_supporting_documents) IS DISTINCT FROM 'object'
     OR v_supporting_documents ->> 'schema_version'
          IS DISTINCT FROM 'secretaria.convocation-supporting-intents.v1'
     OR v_supporting_documents ->> 'completion_policy'
          IS DISTINCT FROM 'EXACT_SET_REQUIRED_BEFORE_FINAL'
     OR pg_catalog.jsonb_typeof(v_supporting_documents -> 'intents') IS DISTINCT FROM 'array'
     OR COALESCE(v_supporting_documents ->> 'expected_count', '') !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;
  v_expected_count := (v_supporting_documents ->> 'expected_count')::integer;
  IF v_expected_count IS DISTINCT FROM
       pg_catalog.jsonb_array_length(v_supporting_documents -> 'intents') THEN
    RETURN false;
  END IF;

  SELECT pg_catalog.count(*)::integer
    INTO v_actual_count
    FROM public.attachments attachment
   WHERE attachment.tenant_id = p_tenant_id
     AND attachment.convocatoria_id = p_convocatoria_id
     AND attachment.artifact_kind = 'SUPPORTING_DOCUMENT';
  IF v_actual_count IS DISTINCT FROM v_expected_count THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_supporting_documents -> 'intents') AS intent(value)
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.attachments attachment
        WHERE attachment.tenant_id = p_tenant_id
          AND attachment.convocatoria_id = p_convocatoria_id
          AND attachment.artifact_kind = 'SUPPORTING_DOCUMENT'
          AND attachment.supporting_attachment_intent_id =
              NULLIF(intent.value ->> 'intent_id', '')::uuid
          AND attachment.file_name IS NOT DISTINCT FROM intent.value ->> 'file_name'
          AND attachment.artifact_verified_size_bytes IS NOT DISTINCT FROM
              NULLIF(intent.value ->> 'size_bytes', '')::bigint
          AND attachment.artifact_verified_mime_type IS NOT DISTINCT FROM
              intent.value ->> 'mime_type'
          AND pg_catalog.lower(attachment.file_hash) IS NOT DISTINCT FROM
              intent.value ->> 'hash_sha256'
          AND pg_catalog.lower(attachment.file_hash_sha512) IS NOT DISTINCT FROM
              intent.value ->> 'hash_sha512'
          AND attachment.agenda_item_index IS NOT DISTINCT FROM
              NULLIF(intent.value ->> 'agenda_item_index', '')::integer
          AND attachment.artifact_verified_by_service IS TRUE
          AND attachment.artifact_verified_at IS NOT NULL
     )
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_convocation_supporting_set_valid(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION secretaria_private.fn_final_attachment_supporting_set_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.convocatoria_id IS NULL
     OR NEW.artifact_kind IS DISTINCT FROM 'CONVOCATORIA_FINAL' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'COMMUNICATION:CONVOCATORIA:'
        || NEW.tenant_id::text || ':' || NEW.convocatoria_id::text,
      0
    )
  );
  IF secretaria_private.fn_convocation_supporting_set_valid(
       NEW.tenant_id,
       NEW.convocatoria_id
     ) IS NOT TRUE THEN
    RAISE EXCEPTION 'FINAL_CONVOCATION_REQUIRES_COMPLETE_EXACT_SUPPORTING_SET'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.tenant_id = NEW.tenant_id
       AND communication.convocatoria_id = NEW.convocatoria_id
       AND communication.tipo_comunicacion = 'CONVOCATORIA'
  ) THEN
    RAISE EXCEPTION 'ASSEMBLED_CONVOCATION_PACKAGE_FREEZES_FINAL_ARTIFACT'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_final_attachment_supporting_set_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_01_final_attachment_supporting_set_guard
  ON public.attachments;
CREATE TRIGGER trg_01_final_attachment_supporting_set_guard
  BEFORE INSERT ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_final_attachment_supporting_set_guard();

COMMIT;
