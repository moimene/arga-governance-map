-- ============================================================
-- Secretaría 360 P2 — restauración funcional para demo real
--
-- Esta migración corrige la capa operativa introducida en P2 sin tocar
-- el ledger histórico ni usar db push/repair. Los cambios son
-- idempotentes y refuerzan los RPCs existentes:
--   - mantenimiento real de órgano base en governing_bodies.config;
--   - fuente documental obligatoria para competencias;
--   - estatutos publicados con documento real e inmutabilidad;
--   - overrides que recalculan matriz efectiva;
--   - selector de plantillas solo sobre plantillas activas;
--   - matriz sociedad x materia consolidando ley, estatutos,
--     reglamento/órgano, override, pacto y plantilla.
-- ============================================================

BEGIN;

ALTER TABLE public.governing_bodies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_secretaria_organ_source_links_unique
  ON public.secretaria_organ_source_links(tenant_id, organ_rule_id, source_type, source_ref);

CREATE OR REPLACE FUNCTION public.fn_secretaria_upsert_organ_profile(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, public.fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_body_id uuid := NULLIF(p_payload ->> 'body_id', '')::uuid;
  v_entity_tenant uuid;
  v_body_tenant uuid;
  v_body_entity uuid;
  v_name text := NULLIF(trim(COALESCE(p_payload ->> 'name', '')), '');
  v_body_type text := upper(NULLIF(trim(COALESCE(p_payload ->> 'body_type', '')), ''));
  v_status text := COALESCE(NULLIF(trim(COALESCE(p_payload ->> 'status', '')), ''), 'Activo');
  v_regulation_ref text := NULLIF(trim(COALESCE(p_payload ->> 'regulation_ref', p_payload ->> 'regulation_id', '')), '');
  v_quorum text := NULLIF(trim(COALESCE(p_payload ->> 'quorum_rule', p_payload ->> 'quorum', '')), '');
  v_existing_config jsonb := '{}'::jsonb;
  v_slug text;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id INTO v_entity_tenant
    FROM public.entities
   WHERE id = v_entity_id;
  IF v_entity_tenant IS NULL OR v_entity_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'El órgano exige nombre.' USING ERRCODE = 'P0001';
  END IF;

  IF v_body_type NOT IN ('CDA', 'COMISION', 'COMITE', 'JUNTA') THEN
    RAISE EXCEPTION 'Tipo de órgano no soportado: %', v_body_type USING ERRCODE = 'P0001';
  END IF;

  IF v_body_id IS NOT NULL THEN
    SELECT tenant_id, entity_id, COALESCE(config, '{}'::jsonb)
      INTO v_body_tenant, v_body_entity, v_existing_config
      FROM public.governing_bodies
     WHERE id = v_body_id;
    IF v_body_tenant IS NULL OR v_body_tenant <> v_tenant_id OR v_body_entity <> v_entity_id THEN
      RAISE EXCEPTION 'body % does not belong to the requested society/tenant', v_body_id USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.governing_bodies
       SET name = v_name,
           body_type = v_body_type,
           config = v_existing_config || jsonb_strip_nulls(jsonb_build_object(
             'estado', v_status,
             'status', v_status,
             'reglamento_ref', v_regulation_ref,
             'regulation_id', v_regulation_ref,
             'quorum', v_quorum,
             'quorum_constitution', v_quorum
           )),
           updated_at = now(),
           updated_by = auth.uid()
     WHERE id = v_body_id;
  ELSE
    v_slug := lower(regexp_replace(v_name, '[^[:alnum:]]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    v_slug := concat('secretaria-', left(v_entity_id::text, 8), '-', left(COALESCE(v_slug, 'organo'), 36), '-', left(gen_random_uuid()::text, 8));

    INSERT INTO public.governing_bodies (
      tenant_id,
      entity_id,
      slug,
      name,
      body_type,
      quorum_rule,
      config,
      updated_at,
      updated_by
    )
    VALUES (
      v_tenant_id,
      v_entity_id,
      v_slug,
      v_name,
      v_body_type,
      jsonb_strip_nulls(jsonb_build_object('quorum', v_quorum)),
      jsonb_strip_nulls(jsonb_build_object(
        'estado', v_status,
        'status', v_status,
        'reglamento_ref', v_regulation_ref,
        'regulation_id', v_regulation_ref,
        'quorum', v_quorum,
        'quorum_constitution', v_quorum
      )),
      now(),
      auth.uid()
    )
    RETURNING id INTO v_body_id;
  END IF;

  PERFORM public.fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'organ_changed',
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'body_id', v_body_id,
      'name', v_name,
      'body_type', v_body_type,
      'status', v_status,
      'regulation_ref', v_regulation_ref,
      'quorum_rule', v_quorum
    ),
    'event_dedupe_key', concat('organ-profile:', v_body_id, ':', encode(digest(coalesce(p_payload::text, ''), 'sha256'), 'hex'))
  ));

  RETURN v_body_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_upsert_organ_profile(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_upsert_organ_rule(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, public.fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_body_id uuid := NULLIF(p_payload ->> 'body_id', '')::uuid;
  v_matter text := NULLIF(p_payload ->> 'matter_code', '');
  v_rule_id uuid;
  v_body_tenant uuid;
  v_body_entity uuid;
  v_source_type text := COALESCE(NULLIF(p_payload ->> 'source_type', ''), 'REGLAMENTO');
  v_source_ref text := NULLIF(trim(COALESCE(p_payload ->> 'source_ref', '')), '');
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL OR v_body_id IS NULL OR v_matter IS NULL THEN
    RAISE EXCEPTION 'entity_id, body_id and matter_code are required' USING ERRCODE = 'P0001';
  END IF;

  IF v_source_ref IS NULL THEN
    RAISE EXCEPTION 'Toda competencia exige fuente documental.' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id, entity_id INTO v_body_tenant, v_body_entity
    FROM public.governing_bodies
   WHERE id = v_body_id;

  IF v_body_tenant IS NULL OR v_body_tenant <> v_tenant_id OR v_body_entity <> v_entity_id THEN
    RAISE EXCEPTION 'body % does not belong to the requested society/tenant', v_body_id USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.secretaria_organ_rules (
    tenant_id,
    entity_id,
    body_id,
    matter_code,
    competence_type,
    quorum_rule,
    majority_rule,
    source_type,
    source_ref,
    source_version_id,
    status,
    updated_by
  )
  VALUES (
    v_tenant_id,
    v_entity_id,
    v_body_id,
    v_matter,
    COALESCE(NULLIF(p_payload ->> 'competence_type', ''), 'DECISION'),
    COALESCE(NULLIF(p_payload ->> 'quorum_rule', ''), 'Según fuente documental vigente'),
    COALESCE(NULLIF(p_payload ->> 'majority_rule', ''), 'Según fuente documental vigente'),
    v_source_type,
    v_source_ref,
    NULLIF(p_payload ->> 'source_version_id', '')::uuid,
    COALESCE(NULLIF(p_payload ->> 'status', ''), 'ACTIVA'),
    auth.uid()
  )
  ON CONFLICT (tenant_id, entity_id, body_id, matter_code)
  WHERE status = 'ACTIVA'
  DO UPDATE SET
    competence_type = EXCLUDED.competence_type,
    quorum_rule = EXCLUDED.quorum_rule,
    majority_rule = EXCLUDED.majority_rule,
    source_type = EXCLUDED.source_type,
    source_ref = EXCLUDED.source_ref,
    source_version_id = EXCLUDED.source_version_id,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_rule_id;

  INSERT INTO public.secretaria_organ_source_links (
    tenant_id,
    organ_rule_id,
    source_type,
    source_ref,
    document_uri,
    source_excerpt,
    created_by
  )
  VALUES (
    v_tenant_id,
    v_rule_id,
    v_source_type,
    v_source_ref,
    NULLIF(p_payload ->> 'document_uri', ''),
    NULLIF(p_payload ->> 'source_excerpt', ''),
    auth.uid()
  )
  ON CONFLICT (tenant_id, organ_rule_id, source_type, source_ref)
  DO UPDATE SET
    document_uri = EXCLUDED.document_uri,
    source_excerpt = EXCLUDED.source_excerpt;

  PERFORM public.fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'organ_changed',
    'matter', v_matter,
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', p_payload || jsonb_build_object('organ_rule_id', v_rule_id),
    'event_dedupe_key', concat('organ-rule:', v_rule_id, ':', encode(digest(coalesce(p_payload::text, ''), 'sha256'), 'hex'))
  ));

  PERFORM public.fn_secretaria_materialize_effective_rule_matrix(v_tenant_id, v_entity_id);

  RETURN v_rule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_upsert_organ_rule(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_statute_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.status = 'PUBLICADA' AND OLD.locked_at IS NOT NULL THEN
    IF NEW.status = 'ARCHIVADA'
       AND NEW.version_label IS NOT DISTINCT FROM OLD.version_label
       AND NEW.document_uri IS NOT DISTINCT FROM OLD.document_uri
       AND NEW.document_hash IS NOT DISTINCT FROM OLD.document_hash
       AND NEW.mapping_coverage IS NOT DISTINCT FROM OLD.mapping_coverage
       AND NEW.critical_mappings_complete IS NOT DISTINCT FROM OLD.critical_mappings_complete
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
       AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
       AND NEW.locked_at IS NOT DISTINCT FROM OLD.locked_at THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Una versión publicada de estatutos es inmutable; cree una nueva versión.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_secretaria_statute_versions_immutable
  ON public.secretaria_statute_versions;
CREATE TRIGGER trg_secretaria_statute_versions_immutable
  BEFORE UPDATE ON public.secretaria_statute_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_statute_version_immutability();

CREATE OR REPLACE FUNCTION public.fn_secretaria_publish_statute_version(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, public.fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_entity_tenant uuid;
  v_version_id uuid := COALESCE(NULLIF(p_payload ->> 'id', '')::uuid, gen_random_uuid());
  v_status text := COALESCE(NULLIF(p_payload ->> 'status', ''), 'PUBLICADA');
  v_version_label text := COALESCE(NULLIF(trim(COALESCE(p_payload ->> 'version_label', '')), ''), 'v1');
  v_document_uri text := NULLIF(trim(COALESCE(p_payload ->> 'document_uri', '')), '');
  v_document_hash text := NULLIF(trim(COALESCE(p_payload ->> 'document_hash', '')), '');
  v_mapping_coverage numeric(5, 2) := COALESCE(NULLIF(p_payload ->> 'mapping_coverage', '')::numeric, 0);
  v_critical_complete boolean := COALESCE((p_payload ->> 'critical_mappings_complete')::boolean, v_mapping_coverage >= 80);
  v_mappings jsonb := COALESCE(p_payload -> 'mappings', '[]'::jsonb);
  v_mapping jsonb;
  v_mapping_count integer := 0;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'entity_id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id INTO v_entity_tenant FROM public.entities WHERE id = v_entity_id;
  IF v_entity_tenant IS NULL OR v_entity_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.secretaria_statute_versions
     WHERE tenant_id = v_tenant_id
       AND entity_id = v_entity_id
       AND version_label = v_version_label
  ) THEN
    RAISE EXCEPTION 'La versión % ya existe; cree una nueva etiqueta de versión.', v_version_label USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'PUBLICADA' THEN
    IF v_document_uri IS NULL OR v_document_hash IS NULL THEN
      RAISE EXCEPTION 'Publicar estatutos exige referencia documental y hash.' USING ERRCODE = 'P0001';
    END IF;
    IF v_document_uri LIKE 'secretaria://estatutos/version-demo%' OR v_document_hash LIKE 'demo-%' THEN
      RAISE EXCEPTION 'La referencia documental demo no es publicable.' USING ERRCODE = 'P0001';
    END IF;
    IF v_mapping_coverage < 80 OR NOT v_critical_complete THEN
      RAISE EXCEPTION 'La publicación de estatutos exige cobertura crítica mínima del 80%%.' USING ERRCODE = 'P0001';
    END IF;
    IF jsonb_typeof(v_mappings) <> 'array' OR jsonb_array_length(v_mappings) = 0 THEN
      RAISE EXCEPTION 'Publicar estatutos exige al menos una cláusula mapeada.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.secretaria_statute_versions
     SET status = 'ARCHIVADA'
   WHERE tenant_id = v_tenant_id
     AND entity_id = v_entity_id
     AND status = 'PUBLICADA';

  INSERT INTO public.secretaria_statute_versions (
    id,
    tenant_id,
    entity_id,
    version_label,
    status,
    document_uri,
    document_hash,
    mapping_coverage,
    critical_mappings_complete,
    published_at,
    published_by,
    locked_at,
    created_by
  )
  VALUES (
    v_version_id,
    v_tenant_id,
    v_entity_id,
    v_version_label,
    v_status,
    v_document_uri,
    v_document_hash,
    v_mapping_coverage,
    v_critical_complete,
    CASE WHEN v_status = 'PUBLICADA' THEN now() ELSE NULL END,
    CASE WHEN v_status = 'PUBLICADA' THEN auth.uid() ELSE NULL END,
    CASE WHEN v_status = 'PUBLICADA' THEN now() ELSE NULL END,
    auth.uid()
  );

  IF jsonb_typeof(v_mappings) = 'array' THEN
    FOR v_mapping IN SELECT value FROM jsonb_array_elements(v_mappings) LOOP
      IF length(trim(COALESCE(v_mapping ->> 'clause_ref', ''))) = 0
         OR length(trim(COALESCE(v_mapping ->> 'matter_code', ''))) = 0
         OR length(trim(COALESCE(v_mapping ->> 'requirement_key', ''))) = 0 THEN
        RAISE EXCEPTION 'Cada mapeo exige cláusula, materia y requisito.' USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO public.secretaria_statute_clause_mappings (
        tenant_id,
        entity_id,
        statute_version_id,
        clause_ref,
        matter_code,
        requirement_key,
        requirement_value,
        source_excerpt,
        confidence,
        status,
        created_by
      )
      VALUES (
        v_tenant_id,
        v_entity_id,
        v_version_id,
        v_mapping ->> 'clause_ref',
        v_mapping ->> 'matter_code',
        v_mapping ->> 'requirement_key',
        COALESCE(v_mapping -> 'requirement_value', '{}'::jsonb),
        NULLIF(v_mapping ->> 'source_excerpt', ''),
        COALESCE(NULLIF(v_mapping ->> 'confidence', ''), 'VALIDADO'),
        'ACTIVA',
        auth.uid()
      );

      v_mapping_count := v_mapping_count + 1;

      PERFORM public.fn_secretaria_record_normative_event(jsonb_build_object(
        'tenant_id', v_tenant_id,
        'entity_id', v_entity_id,
        'event_name', 'clause_mapped',
        'matter', v_mapping ->> 'matter_code',
        'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
        'after_state', jsonb_build_object(
          'statute_version_id', v_version_id,
          'clause_ref', v_mapping ->> 'clause_ref',
          'requirement_key', v_mapping ->> 'requirement_key',
          'requires_override_review', (v_mapping ->> 'matter_code') = 'MODIFICACION_ESTATUTOS'
        ),
        'event_dedupe_key', concat(
          'statute-map:',
          v_version_id,
          ':',
          encode(digest((v_mapping ->> 'clause_ref') || ':' || (v_mapping ->> 'matter_code') || ':' || (v_mapping ->> 'requirement_key'), 'sha256'), 'hex')
        )
      ));
    END LOOP;
  END IF;

  PERFORM public.fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'statute_version_published',
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'statute_version_id', v_version_id,
      'version_label', v_version_label,
      'document_uri', v_document_uri,
      'document_hash', v_document_hash,
      'mapping_coverage', v_mapping_coverage,
      'mapping_count', v_mapping_count,
      'status', v_status
    ),
    'event_dedupe_key', concat('statutes:', v_entity_id, ':', v_version_label)
  ));

  PERFORM public.fn_secretaria_materialize_effective_rule_matrix(v_tenant_id, v_entity_id);

  RETURN v_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_publish_statute_version(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_publish_normative_override(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, public.fn_secretaria_current_tenant_id());
  v_entity_id uuid := NULLIF(p_payload ->> 'entity_id', '')::uuid;
  v_entity_tenant uuid;
  v_entity_form text;
  v_matter text := NULLIF(p_payload ->> 'matter_code', '');
  v_requirement_key text := NULLIF(p_payload ->> 'requirement_key', '');
  v_requirement_value jsonb := COALESCE(p_payload -> 'requirement_value', '{}'::jsonb);
  v_source_type text := COALESCE(NULLIF(p_payload ->> 'source_type', ''), 'ESTATUTOS');
  v_majority_code text;
  v_override_id uuid;
  v_rule_param_id uuid;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  IF v_entity_id IS NULL OR v_matter IS NULL OR v_requirement_key IS NULL THEN
    RAISE EXCEPTION 'entity_id, matter_code and requirement_key are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT tenant_id, COALESCE(tipo_social, legal_form, 'SA')
    INTO v_entity_tenant, v_entity_form
    FROM public.entities
   WHERE id = v_entity_id;

  IF v_entity_tenant IS NULL OR v_entity_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'entity % does not belong to tenant %', v_entity_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  IF length(trim(COALESCE(p_payload ->> 'source_ref', ''))) = 0
     OR length(trim(COALESCE(p_payload ->> 'justification', ''))) = 0 THEN
    RAISE EXCEPTION 'Cada override exige referencia documental y justificación.' USING ERRCODE = 'P0001';
  END IF;

  v_majority_code := COALESCE(v_requirement_value ->> 'majority_code', v_requirement_value ->> 'mayoria', NULL);
  IF v_requirement_key IN ('votacion.mayoria', 'majority', 'mayoria') AND v_majority_code IS NOT NULL THEN
    IF NOT public.fn_validar_no_rebaja_ley(v_majority_code, v_matter, v_entity_form) THEN
      RAISE EXCEPTION 'Este requisito no puede rebajar el mínimo legal para %.', v_matter USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.rule_param_overrides (
    tenant_id,
    entity_id,
    materia,
    clave,
    valor,
    fuente,
    referencia
  )
  VALUES (
    v_tenant_id,
    v_entity_id,
    v_matter,
    v_requirement_key,
    v_requirement_value,
    v_source_type,
    p_payload ->> 'source_ref'
  )
  ON CONFLICT (entity_id, materia, clave)
  DO UPDATE SET
    valor = EXCLUDED.valor,
    fuente = EXCLUDED.fuente,
    referencia = EXCLUDED.referencia
  RETURNING id INTO v_rule_param_id;

  INSERT INTO public.secretaria_normative_overrides (
    tenant_id,
    entity_id,
    matter_code,
    requirement_key,
    requirement_value,
    source_type,
    source_ref,
    justification,
    effective_from,
    effective_until,
    status,
    rule_param_override_id,
    published_by,
    published_at
  )
  VALUES (
    v_tenant_id,
    v_entity_id,
    v_matter,
    v_requirement_key,
    v_requirement_value,
    v_source_type,
    p_payload ->> 'source_ref',
    p_payload ->> 'justification',
    COALESCE(NULLIF(p_payload ->> 'effective_from', '')::date, CURRENT_DATE),
    NULLIF(p_payload ->> 'effective_until', '')::date,
    'PUBLICADA',
    v_rule_param_id,
    auth.uid(),
    now()
  )
  ON CONFLICT (tenant_id, entity_id, matter_code, requirement_key)
  WHERE status = 'PUBLICADA'
  DO UPDATE SET
    requirement_value = EXCLUDED.requirement_value,
    source_type = EXCLUDED.source_type,
    source_ref = EXCLUDED.source_ref,
    justification = EXCLUDED.justification,
    effective_from = EXCLUDED.effective_from,
    effective_until = EXCLUDED.effective_until,
    rule_param_override_id = EXCLUDED.rule_param_override_id,
    published_by = auth.uid(),
    published_at = now()
  RETURNING id INTO v_override_id;

  PERFORM public.fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', v_entity_id,
    'event_name', 'clause_mapped',
    'matter', v_matter,
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'override_id', v_override_id,
      'rule_param_override_id', v_rule_param_id,
      'requirement_key', v_requirement_key,
      'source_ref', p_payload ->> 'source_ref',
      'matrix_recalculated', true
    ),
    'event_dedupe_key', concat('override:', v_entity_id, ':', v_matter, ':', v_requirement_key)
  ));

  PERFORM public.fn_secretaria_materialize_effective_rule_matrix(v_tenant_id, v_entity_id);

  RETURN v_override_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_publish_normative_override(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_assign_template_binding(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(NULLIF(p_payload ->> 'tenant_id', '')::uuid, public.fn_secretaria_current_tenant_id());
  v_template_id uuid := NULLIF(p_payload ->> 'template_id', '')::uuid;
  v_template record;
  v_binding_id uuid;
  v_materia text;
  v_doc_type text;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  SELECT tenant_id, estado, materia_acuerdo, materia, tipo, jurisdiccion, organo_tipo, adoption_mode
    INTO v_template
    FROM public.plantillas_protegidas
   WHERE id = v_template_id;

  IF v_template.tenant_id IS NULL OR v_template.tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'template % does not belong to tenant %', v_template_id, v_tenant_id USING ERRCODE = 'P0001';
  END IF;

  IF v_template.estado <> 'ACTIVA' THEN
    RAISE EXCEPTION 'Solo se pueden vincular plantillas activas.' USING ERRCODE = 'P0001';
  END IF;

  IF length(trim(COALESCE(p_payload ->> 'selection_reason', ''))) = 0 THEN
    RAISE EXCEPTION 'La asignación exige razón jurídica de selección.' USING ERRCODE = 'P0001';
  END IF;

  v_materia := COALESCE(NULLIF(p_payload ->> 'materia', ''), v_template.materia_acuerdo, v_template.materia, 'GENERAL');
  v_doc_type := COALESCE(NULLIF(p_payload ->> 'doc_type', ''), v_template.tipo, 'MODELO_ACUERDO');

  INSERT INTO public.materia_template_binding (
    tenant_id,
    materia,
    organo_tipo,
    tipo_social,
    jurisdiccion,
    adoption_mode,
    doc_type,
    template_id,
    priority,
    active,
    selection_reason
  )
  VALUES (
    v_tenant_id,
    v_materia,
    COALESCE(NULLIF(p_payload ->> 'organo_tipo', ''), v_template.organo_tipo, 'ANY'),
    COALESCE(NULLIF(p_payload ->> 'tipo_social', ''), 'ANY'),
    COALESCE(NULLIF(p_payload ->> 'jurisdiccion', ''), v_template.jurisdiccion, 'ES'),
    COALESCE(NULLIF(p_payload ->> 'adoption_mode', ''), v_template.adoption_mode, 'ANY'),
    v_doc_type,
    v_template_id,
    COALESCE(NULLIF(p_payload ->> 'priority', '')::integer, 100),
    COALESCE((p_payload ->> 'active')::boolean, true),
    p_payload ->> 'selection_reason'
  )
  ON CONFLICT (
    tenant_id,
    materia,
    jurisdiccion,
    tipo_social,
    organo_tipo,
    adoption_mode,
    doc_type,
    priority
  )
  WHERE active = true
  DO UPDATE SET
    template_id = EXCLUDED.template_id,
    active = EXCLUDED.active,
    selection_reason = EXCLUDED.selection_reason
  RETURNING id INTO v_binding_id;

  PERFORM public.fn_secretaria_record_normative_event(jsonb_build_object(
    'tenant_id', v_tenant_id,
    'event_name', 'template_assigned',
    'matter', v_materia,
    'user_role', COALESCE(NULLIF(p_payload ->> 'user_role', ''), 'editor'),
    'after_state', jsonb_build_object(
      'binding_id', v_binding_id,
      'template_id', v_template_id,
      'doc_type', v_doc_type,
      'selection_reason', p_payload ->> 'selection_reason'
    ),
    'event_dedupe_key', concat('template:', v_binding_id)
  ));

  RETURN v_binding_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_assign_template_binding(jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_materialize_effective_rule_matrix(
  p_tenant_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid := COALESCE(p_tenant_id, public.fn_secretaria_current_tenant_id());
  v_entity record;
  v_materia record;
  v_org_rule record;
  v_statute record;
  v_template_count integer;
  v_template_docs jsonb;
  v_statute_layers jsonb;
  v_override_layers jsonb;
  v_pacto_layers jsonb;
  v_source_layers jsonb;
  v_majority_override_value jsonb;
  v_quorum_override_value jsonb;
  v_statute_majority_value jsonb;
  v_statute_quorum_value jsonb;
  v_majority_rule text;
  v_quorum_rule text;
  v_status text;
  v_confidence text;
  v_profile_hash text;
  v_rows integer := 0;
  v_is_critical boolean;
  v_has_pacto_block boolean;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(v_tenant_id);

  FOR v_entity IN
    SELECT id, jurisdiction, tipo_social, legal_form
      FROM public.entities
     WHERE tenant_id = v_tenant_id
       AND person_id IS NOT NULL
       AND (p_entity_id IS NULL OR id = p_entity_id)
  LOOP
    FOR v_materia IN
      SELECT materia, materia_label_es, matter_class, min_majority_code, requires_notary, requires_registry,
             inscribable, publication_required, plazo_inscripcion_dias
        FROM public.materia_catalog
       ORDER BY materia
    LOOP
      v_org_rule := NULL;
      v_statute := NULL;
      v_template_count := 0;
      v_template_docs := '[]'::jsonb;
      v_statute_layers := '[]'::jsonb;
      v_override_layers := '[]'::jsonb;
      v_pacto_layers := '[]'::jsonb;
      v_majority_override_value := NULL;
      v_quorum_override_value := NULL;
      v_statute_majority_value := NULL;
      v_statute_quorum_value := NULL;
      v_has_pacto_block := false;

      SELECT r.*, gb.body_type, gb.name AS body_name
        INTO v_org_rule
        FROM public.secretaria_organ_rules r
        JOIN public.governing_bodies gb ON gb.id = r.body_id
       WHERE r.tenant_id = v_tenant_id
         AND r.entity_id = v_entity.id
         AND r.matter_code = v_materia.materia
         AND r.status = 'ACTIVA'
       ORDER BY r.updated_at DESC
       LIMIT 1;

      SELECT *
        INTO v_statute
        FROM public.secretaria_statute_versions sv
       WHERE sv.tenant_id = v_tenant_id
         AND sv.entity_id = v_entity.id
         AND sv.status = 'PUBLICADA'
       ORDER BY sv.published_at DESC NULLS LAST, sv.created_at DESC
       LIMIT 1;

      IF v_statute.id IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'type', 'ESTATUTOS',
          'reference', concat(v_statute.version_label, ' · ', scm.clause_ref),
          'requirement', scm.requirement_key,
          'confidence', scm.confidence
        ) ORDER BY scm.clause_ref), '[]'::jsonb)
          INTO v_statute_layers
          FROM public.secretaria_statute_clause_mappings scm
         WHERE scm.tenant_id = v_tenant_id
           AND scm.entity_id = v_entity.id
           AND scm.statute_version_id = v_statute.id
           AND scm.matter_code = v_materia.materia
           AND scm.status = 'ACTIVA';

        SELECT scm.requirement_value
          INTO v_statute_majority_value
          FROM public.secretaria_statute_clause_mappings scm
         WHERE scm.tenant_id = v_tenant_id
           AND scm.entity_id = v_entity.id
           AND scm.statute_version_id = v_statute.id
           AND scm.matter_code = v_materia.materia
           AND scm.requirement_key IN ('votacion.mayoria', 'majority', 'mayoria')
           AND scm.status = 'ACTIVA'
         ORDER BY scm.created_at DESC
         LIMIT 1;

        SELECT scm.requirement_value
          INTO v_statute_quorum_value
          FROM public.secretaria_statute_clause_mappings scm
         WHERE scm.tenant_id = v_tenant_id
           AND scm.entity_id = v_entity.id
           AND scm.statute_version_id = v_statute.id
           AND scm.matter_code = v_materia.materia
           AND scm.requirement_key IN ('constitucion.quorum', 'quorum')
           AND scm.status = 'ACTIVA'
         ORDER BY scm.created_at DESC
         LIMIT 1;
      END IF;

      SELECT no.requirement_value
        INTO v_majority_override_value
        FROM public.secretaria_normative_overrides no
       WHERE no.tenant_id = v_tenant_id
         AND no.entity_id = v_entity.id
         AND no.matter_code = v_materia.materia
         AND no.requirement_key IN ('votacion.mayoria', 'majority', 'mayoria')
         AND no.status = 'PUBLICADA'
         AND no.effective_from <= CURRENT_DATE
         AND (no.effective_until IS NULL OR no.effective_until >= CURRENT_DATE)
       ORDER BY no.published_at DESC
       LIMIT 1;

      SELECT no.requirement_value
        INTO v_quorum_override_value
        FROM public.secretaria_normative_overrides no
       WHERE no.tenant_id = v_tenant_id
         AND no.entity_id = v_entity.id
         AND no.matter_code = v_materia.materia
         AND no.requirement_key IN ('constitucion.quorum', 'quorum')
         AND no.status = 'PUBLICADA'
         AND no.effective_from <= CURRENT_DATE
         AND (no.effective_until IS NULL OR no.effective_until >= CURRENT_DATE)
       ORDER BY no.published_at DESC
       LIMIT 1;

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', no.source_type,
        'reference', no.source_ref,
        'requirement', no.requirement_key,
        'override_id', no.id
      ) ORDER BY no.published_at DESC), '[]'::jsonb)
        INTO v_override_layers
        FROM public.secretaria_normative_overrides no
       WHERE no.tenant_id = v_tenant_id
         AND no.entity_id = v_entity.id
         AND no.matter_code = v_materia.materia
         AND no.status = 'PUBLICADA'
         AND no.effective_from <= CURRENT_DATE
         AND (no.effective_until IS NULL OR no.effective_until >= CURRENT_DATE);

      SELECT
        count(*)::integer,
        COALESCE(jsonb_agg(DISTINCT b.doc_type), '[]'::jsonb)
        INTO v_template_count, v_template_docs
        FROM public.materia_template_binding b
       WHERE b.tenant_id = v_tenant_id
         AND b.materia = v_materia.materia
         AND b.active = true
         AND b.jurisdiccion IN (COALESCE(v_entity.jurisdiction, 'ES'), 'ANY', 'GLOBAL', 'MULTI')
         AND b.tipo_social IN (COALESCE(v_entity.tipo_social, v_entity.legal_form, 'ANY'), 'ANY');

      SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
          'type', 'PACTO_PARASOCIAL',
          'reference', COALESCE(pm.source_ref, pm.clause_ref),
          'legal_effect', pm.legal_effect,
          'waiver_status', pm.waiver_status
        ) ORDER BY pm.created_at DESC), '[]'::jsonb),
        bool_or(pm.legal_effect IN ('ESTATUTARIZADO', 'VETO') AND pm.waiver_status <> 'OTORGADO')
        INTO v_pacto_layers, v_has_pacto_block
        FROM public.secretaria_pacto_clause_mappings pm
       WHERE pm.tenant_id = v_tenant_id
         AND pm.entity_id = v_entity.id
         AND pm.matter_code = v_materia.materia
         AND pm.status = 'ACTIVA';
      v_has_pacto_block := COALESCE(v_has_pacto_block, false);

      v_majority_rule := COALESCE(
        v_majority_override_value ->> 'majority_code',
        v_majority_override_value ->> 'mayoria',
        v_majority_override_value ->> 'value',
        v_statute_majority_value ->> 'majority_code',
        v_statute_majority_value ->> 'mayoria',
        v_statute_majority_value ->> 'value',
        v_org_rule.majority_rule,
        v_materia.min_majority_code,
        'No requiere mayoría societaria'
      );

      v_quorum_rule := COALESCE(
        v_quorum_override_value ->> 'quorum_code',
        v_quorum_override_value ->> 'quorum',
        v_quorum_override_value ->> 'value',
        v_statute_quorum_value ->> 'quorum_code',
        v_statute_quorum_value ->> 'quorum',
        v_statute_quorum_value ->> 'value',
        v_org_rule.quorum_rule,
        'Según ley aplicable y estatutos'
      );

      v_source_layers :=
        jsonb_build_array(jsonb_build_object('type', 'LEY', 'reference', COALESCE(v_materia.min_majority_code, 'Regla legal base'))) ||
        CASE
          WHEN v_org_rule.id IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(jsonb_build_object(
            'type', v_org_rule.source_type,
            'reference', v_org_rule.source_ref,
            'body_id', v_org_rule.body_id,
            'body_name', v_org_rule.body_name
          ))
        END ||
        COALESCE(v_statute_layers, '[]'::jsonb) ||
        COALESCE(v_override_layers, '[]'::jsonb) ||
        COALESCE(v_pacto_layers, '[]'::jsonb) ||
        CASE
          WHEN v_template_count > 0 THEN jsonb_build_array(jsonb_build_object('type', 'PLANTILLA', 'reference', concat(v_template_count, ' plantilla(s) vinculadas')))
          ELSE '[]'::jsonb
        END;

      v_is_critical := COALESCE(v_materia.matter_class, '') IN ('ESTATUTARIA', 'ESTRUCTURAL')
        OR COALESCE(v_materia.requires_notary, false)
        OR COALESCE(v_materia.requires_registry, false)
        OR COALESCE(v_materia.inscribable, false);

      v_status := CASE
        WHEN v_org_rule.id IS NULL THEN 'REQUIERE_REVISION'
        WHEN v_template_count = 0 THEN 'INCOMPLETO'
        WHEN v_is_critical AND v_statute.id IS NULL THEN 'INCOMPLETO'
        WHEN v_has_pacto_block THEN 'REQUIERE_REVISION'
        ELSE 'OK'
      END;

      v_confidence := CASE
        WHEN v_status = 'OK' THEN 'VALIDADO'
        WHEN v_status = 'INCOMPLETO' THEN 'INCOMPLETO'
        ELSE 'PENDIENTE_REVISION'
      END;

      v_profile_hash := encode(digest(concat_ws(
        '|',
        v_entity.id,
        v_materia.materia,
        COALESCE(v_org_rule.id::text, 'no-organ-rule'),
        COALESCE(v_statute.id::text, 'no-statute'),
        COALESCE(v_majority_rule, ''),
        COALESCE(v_quorum_rule, ''),
        COALESCE(v_template_count::text, '0'),
        COALESCE(v_source_layers::text, '[]')
      ), 'sha256'), 'hex');

      INSERT INTO public.secretaria_effective_rule_matrix (
        tenant_id,
        entity_id,
        matter_code,
        organo_tipo,
        majority_rule,
        quorum_rule,
        documents_required,
        formalization,
        deadlines,
        source_layers,
        operational_status,
        confidence,
        profile_hash,
        generated_at,
        generated_by
      )
      VALUES (
        v_tenant_id,
        v_entity.id,
        v_materia.materia,
        COALESCE(v_org_rule.body_type, 'Órgano competente por ley'),
        v_majority_rule,
        v_quorum_rule,
        jsonb_build_array('Acta') ||
          CASE WHEN COALESCE(v_materia.requires_notary, false) THEN jsonb_build_array('Escritura pública') ELSE '[]'::jsonb END ||
          CASE WHEN COALESCE(v_materia.requires_registry, false) OR COALESCE(v_materia.inscribable, false) THEN jsonb_build_array('Certificación registral') ELSE '[]'::jsonb END ||
          COALESCE(v_template_docs, '[]'::jsonb),
        jsonb_build_object(
          'notary_required', COALESCE(v_materia.requires_notary, false),
          'registry_required', COALESCE(v_materia.requires_registry, false) OR COALESCE(v_materia.inscribable, false),
          'publication_required', COALESCE(v_materia.publication_required, false),
          'template_binding_count', v_template_count
        ),
        jsonb_build_object('registry_days', v_materia.plazo_inscripcion_dias),
        v_source_layers,
        v_status,
        v_confidence,
        v_profile_hash,
        now(),
        auth.uid()
      )
      ON CONFLICT (entity_id, matter_code)
      DO UPDATE SET
        organo_tipo = EXCLUDED.organo_tipo,
        majority_rule = EXCLUDED.majority_rule,
        quorum_rule = EXCLUDED.quorum_rule,
        documents_required = EXCLUDED.documents_required,
        formalization = EXCLUDED.formalization,
        deadlines = EXCLUDED.deadlines,
        source_layers = EXCLUDED.source_layers,
        operational_status = EXCLUDED.operational_status,
        confidence = EXCLUDED.confidence,
        profile_hash = EXCLUDED.profile_hash,
        generated_at = now(),
        generated_by = auth.uid();

      v_rows := v_rows + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'entity_id', p_entity_id,
    'rows_materialized', v_rows,
    'mode', 'P2_EFFECTIVE_RULE_MATRIX_RESTORED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_secretaria_materialize_effective_rule_matrix(uuid, uuid)
  TO authenticated, service_role;

COMMIT;
