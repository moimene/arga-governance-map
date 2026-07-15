-- Oleada 3A — integridad de activación de plantillas protegidas.
--
-- Objetivos:
--   * archivar la v1.0.0 no canónica de CONVOCATORIA_COMISION_DELEGADA;
--   * conservar intacta la v1.1.0 aprobada por Garrigues / Comité Legal;
--   * impedir más de una ACTIVA por identidad funcional completa;
--   * ejecutar todo cambio de estado + changelog dentro de una sola RPC;
--   * aplicar autorización ADMIN_TENANT real en servidor.
--
-- Forward-only. No borra ni renombra filas de plantillas o materias.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Identidad funcional canónica, alineada con functional-key.ts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_template_functional_key(
  p_tipo text,
  p_jurisdiccion text,
  p_materia text,
  p_organo_tipo text,
  p_adoption_mode text,
  p_tipo_social text
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT
    jsonb_build_array(
      upper(btrim(COALESCE(p_tipo, ''))),
      upper(btrim(COALESCE(p_jurisdiccion, ''))),
      CASE upper(btrim(COALESCE(p_materia, '')))
        WHEN 'AMPLIACION_CAPITAL' THEN 'AUMENTO_CAPITAL'
        WHEN 'MOD_ESTATUTOS' THEN 'MODIFICACION_ESTATUTOS'
        WHEN 'NOMBRAMIENTO_CESE' THEN 'NOMBRAMIENTO_CONSEJERO'
        WHEN 'EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE' THEN 'SUPRESION_PREFERENTE'
        ELSE upper(btrim(COALESCE(p_materia, '')))
      END,
      CASE upper(btrim(COALESCE(p_organo_tipo, '')))
        WHEN 'JUNTA' THEN 'JUNTA_GENERAL'
        WHEN 'CONSEJO_ADMINISTRACION' THEN 'CONSEJO_ADMIN'
        WHEN 'CONSEJO' THEN 'CONSEJO_ADMIN'
        WHEN 'ADMIN_CONJUNTA' THEN 'ADMIN_CONJUNTA_O_COAPROBADORES'
        WHEN 'ADMIN_SOLIDARIO' THEN 'ADMIN_SOLIDARIOS'
        ELSE upper(btrim(COALESCE(p_organo_tipo, '')))
      END,
      upper(btrim(COALESCE(p_adoption_mode, ''))),
      CASE upper(btrim(COALESCE(p_tipo_social, '')))
        WHEN '' THEN 'ANY'
        WHEN 'ANY' THEN 'ANY'
        ELSE upper(btrim(p_tipo_social))
      END
    )::text
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_template_functional_key(text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_template_functional_key(text, text, text, text, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Saneamiento fail-closed del único duplicado activo observado
-- ---------------------------------------------------------------------------

DO $sanitize_convocatoria_comision$
DECLARE
  v_tenant_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_legacy_id constant uuid := '92ee684b-8a34-4e8c-b3ca-c1827f7fa05f'::uuid;
  v_canonical_id constant uuid := '52e7f727-125b-4d26-a46f-bf9a912df56e'::uuid;
  v_log_to_version constant text := '1.0.0#op:20260712124000-archive-v1.0.0';
  v_legacy public.plantillas_protegidas%ROWTYPE;
  v_canonical public.plantillas_protegidas%ROWTYPE;
  v_legacy_after public.plantillas_protegidas%ROWTYPE;
  v_legacy_payload jsonb;
  v_dependency_count integer;
  v_expected_log_count integer;
  v_active_count integer;
  v_was_active boolean;
BEGIN
  SELECT *
    INTO v_legacy
    FROM public.plantillas_protegidas
   WHERE id = v_legacy_id
     AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oleada 3A: plantilla legacy % no encontrada en tenant esperado', v_legacy_id;
  END IF;

  SELECT *
    INTO v_canonical
    FROM public.plantillas_protegidas
   WHERE id = v_canonical_id
     AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oleada 3A: plantilla canónica % no encontrada en tenant esperado', v_canonical_id;
  END IF;

  IF v_legacy.tipo IS DISTINCT FROM 'CONVOCATORIA'
     OR v_legacy.materia IS DISTINCT FROM 'CONVOCATORIA_COMISION_DELEGADA'
     OR v_legacy.version IS DISTINCT FROM '1.0.0'
     OR v_legacy.jurisdiccion IS DISTINCT FROM 'ES'
     OR v_legacy.organo_tipo IS DISTINCT FROM 'COMISION_DELEGADA'
     OR v_legacy.adoption_mode IS DISTINCT FROM 'MEETING'
     OR v_legacy.estado IS NULL
     OR v_legacy.estado NOT IN ('ACTIVA', 'ARCHIVADA') THEN
    RAISE EXCEPTION 'Oleada 3A: drift en la plantilla legacy %', v_legacy_id;
  END IF;

  IF v_canonical.tipo IS DISTINCT FROM 'CONVOCATORIA'
     OR v_canonical.materia IS DISTINCT FROM 'CONVOCATORIA_COMISION_DELEGADA'
     OR v_canonical.version IS DISTINCT FROM '1.1.0'
     OR v_canonical.jurisdiccion IS DISTINCT FROM 'ES'
     OR v_canonical.organo_tipo IS DISTINCT FROM 'COMISION_DELEGADA'
     OR v_canonical.adoption_mode IS DISTINCT FROM 'MEETING' THEN
    RAISE EXCEPTION 'Oleada 3A: drift en la plantilla canónica %', v_canonical_id;
  END IF;

  v_was_active := v_legacy.estado = 'ACTIVA';

  IF public.fn_secretaria_template_functional_key(
       v_legacy.tipo,
       v_legacy.jurisdiccion,
       COALESCE(NULLIF(btrim(v_legacy.materia_acuerdo), ''), v_legacy.materia),
       v_legacy.organo_tipo,
       v_legacy.adoption_mode,
       v_legacy.tipo_social
     ) IS DISTINCT FROM public.fn_secretaria_template_functional_key(
       v_canonical.tipo,
       v_canonical.jurisdiccion,
       COALESCE(NULLIF(btrim(v_canonical.materia_acuerdo), ''), v_canonical.materia),
       v_canonical.organo_tipo,
       v_canonical.adoption_mode,
       v_canonical.tipo_social
     ) THEN
    RAISE EXCEPTION 'Oleada 3A: las dos filas ya no comparten identidad funcional';
  END IF;

  IF v_was_active THEN
    IF v_canonical.estado IS DISTINCT FROM 'ACTIVA'
       OR v_canonical.aprobada_por IS DISTINCT FROM 'Garrigues / Comité Legal'
       OR v_canonical.fecha_aprobacion IS NULL
       OR v_canonical.activated_at IS NULL
       OR COALESCE(jsonb_typeof(v_canonical.version_history), '') IS DISTINCT FROM 'array'
       OR jsonb_array_length(
         CASE
           WHEN jsonb_typeof(v_canonical.version_history) = 'array'
             THEN v_canonical.version_history
           ELSE '[]'::jsonb
         END
       ) = 0
       OR v_canonical.contrato_variables_version IS DISTINCT FROM 'variables-plantillas-v1.1' THEN
      RAISE EXCEPTION 'Oleada 3A: drift de gobierno en la canónica del saneamiento inicial';
    END IF;

    SELECT COALESCE(sum(dependency_count), 0)::integer
      INTO v_dependency_count
      FROM (
        SELECT count(*) dependency_count FROM public.communications
         WHERE template_id IN (v_legacy_id, v_canonical_id)
        UNION ALL
        SELECT count(*) FROM public.materia_template_binding
         WHERE template_id IN (v_legacy_id, v_canonical_id)
        UNION ALL
        SELECT count(*) FROM public.no_session_expedientes
         WHERE selected_template_id IN (v_legacy_id, v_canonical_id)
        UNION ALL
        SELECT count(*) FROM public.no_session_resolutions
         WHERE selected_template_id IN (v_legacy_id, v_canonical_id)
        UNION ALL
        SELECT count(*) FROM public.plantilla_capa3_overrides_por_entidad
         WHERE plantilla_id IN (v_legacy_id, v_canonical_id)
        UNION ALL
        SELECT count(*) FROM public.secretaria_document_artifacts
         WHERE template_id IN (v_legacy_id, v_canonical_id)
        UNION ALL
        SELECT count(*) FROM public.secretaria_document_drafts
         WHERE template_id IN (v_legacy_id, v_canonical_id)
      ) dependencies;

    IF v_dependency_count <> 0 THEN
      RAISE EXCEPTION
        'Oleada 3A: las plantillas de la familia tienen % dependencias; abortando sin remapear',
        v_dependency_count;
    END IF;
  END IF;

  SELECT count(*)
    INTO v_expected_log_count
    FROM public.plantilla_changelog
   WHERE plantilla_id = v_legacy_id
     AND to_version = v_log_to_version;

  v_legacy_payload := to_jsonb(v_legacy) - 'estado' - 'version_history';

  IF v_legacy.estado = 'ACTIVA' THEN
    IF EXISTS (
      SELECT 1 FROM public.plantilla_changelog
       WHERE plantilla_id IN (v_legacy_id, v_canonical_id)
    ) THEN
      RAISE EXCEPTION 'Oleada 3A: apareció changelog previo no observado para la familia';
    END IF;

    UPDATE public.plantillas_protegidas
       SET estado = 'ARCHIVADA'
     WHERE id = v_legacy_id
       AND tenant_id = v_tenant_id
       AND estado = 'ACTIVA';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Oleada 3A: no se pudo archivar la plantilla legacy %', v_legacy_id;
    END IF;

    INSERT INTO public.plantilla_changelog (
      tenant_id,
      plantilla_id,
      from_version,
      to_version,
      bump_type,
      motivo,
      autor,
      diff_summary
    ) VALUES (
      v_tenant_id,
      v_legacy_id,
      '1.0.0',
      v_log_to_version,
      'PATCH',
      'STATE:ACTIVA->ARCHIVADA | Oleada 3A: se conserva v1.1.0 como canónica [op:20260712124000-archive-v1.0.0]',
      'Sistema de gobierno de plantillas (Oleada 3A)',
      jsonb_build_object(
        'action', 'STATE_CHANGE',
        'from_state', 'ACTIVA',
        'to_state', 'ARCHIVADA',
        'logical_to_version', '1.0.0',
        'operation_id', '20260712124000-archive-v1.0.0',
        'canonical_template_id', v_canonical_id,
        'reconstructed', false
      )::text
    );
  ELSIF v_expected_log_count <> 1 THEN
    RAISE EXCEPTION
      'Oleada 3A: reejecución inconsistente; legacy archivada pero changelog esperado=%',
      v_expected_log_count;
  END IF;

  SELECT *
    INTO v_legacy_after
    FROM public.plantillas_protegidas
   WHERE id = v_legacy_id;

  IF (to_jsonb(v_legacy_after) - 'estado' - 'version_history') IS DISTINCT FROM v_legacy_payload THEN
    RAISE EXCEPTION 'Oleada 3A: el saneamiento alteró contenido o metadatos de v1.0.0';
  END IF;

  SELECT count(*)
    INTO v_active_count
    FROM public.plantillas_protegidas p
   WHERE p.tenant_id = v_tenant_id
     AND p.estado = 'ACTIVA'
     AND public.fn_secretaria_template_functional_key(
       p.tipo,
       p.jurisdiccion,
       COALESCE(NULLIF(btrim(p.materia_acuerdo), ''), p.materia),
       p.organo_tipo,
       p.adoption_mode,
       p.tipo_social
     ) = public.fn_secretaria_template_functional_key(
       v_canonical.tipo,
       v_canonical.jurisdiccion,
       COALESCE(NULLIF(btrim(v_canonical.materia_acuerdo), ''), v_canonical.materia),
       v_canonical.organo_tipo,
       v_canonical.adoption_mode,
       v_canonical.tipo_social
     );

  IF v_legacy_after.estado <> 'ARCHIVADA'
     OR (v_was_active AND v_active_count <> 1) THEN
    RAISE EXCEPTION 'Oleada 3A: se esperaba legacy archivada y una única activa en el saneamiento inicial';
  END IF;
END;
$sanitize_convocatoria_comision$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_plantillas_active_functional_identity
  ON public.plantillas_protegidas (
    tenant_id,
    (public.fn_secretaria_template_functional_key(
      tipo,
      jurisdiccion,
      COALESCE(NULLIF(btrim(materia_acuerdo), ''), materia),
      organo_tipo,
      adoption_mode,
      tipo_social
    ))
  )
  WHERE estado = 'ACTIVA';

-- ---------------------------------------------------------------------------
-- 3. Autorización ADMIN_TENANT real
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_is_active_template_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN false;
  END IF;
  IF COALESCE(public.fn_secretaria_is_service_role(), false) THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL
     OR public.fn_current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
      FROM public.rbac_user_roles rur
      JOIN public.rbac_roles rr ON rr.id = rur.role_id
     WHERE rur.tenant_id = p_tenant_id
       AND rur.user_id = auth.uid()
       AND rur.is_active = true
       AND (rur.expires_at IS NULL OR rur.expires_at > now())
       AND rr.role_code = 'ADMIN_TENANT'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_assert_active_template_admin(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT public.fn_secretaria_is_active_template_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'ADMIN_TENANT active role required for template governance'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_is_active_template_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_secretaria_assert_active_template_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_is_active_template_admin(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_assert_active_template_admin(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Ledger WORM de idempotencia de la RPC
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.secretaria_template_transition_operations (
  operation_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  template_id uuid NOT NULL REFERENCES public.plantillas_protegidas(id) ON DELETE RESTRICT,
  request_hash_sha256 text NOT NULL CHECK (request_hash_sha256 ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_transition_operations_tenant_template
  ON public.secretaria_template_transition_operations(tenant_id, template_id, created_at DESC);

DROP TRIGGER IF EXISTS tr_worm_template_transition_operations_update
  ON public.secretaria_template_transition_operations;
CREATE TRIGGER tr_worm_template_transition_operations_update
  BEFORE UPDATE ON public.secretaria_template_transition_operations
  FOR EACH ROW EXECUTE FUNCTION public.worm_guard();

DROP TRIGGER IF EXISTS tr_worm_template_transition_operations_delete
  ON public.secretaria_template_transition_operations;
CREATE TRIGGER tr_worm_template_transition_operations_delete
  BEFORE DELETE ON public.secretaria_template_transition_operations
  FOR EACH ROW EXECUTE FUNCTION public.worm_guard();

ALTER TABLE public.secretaria_template_transition_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.secretaria_template_transition_operations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.secretaria_template_transition_operations TO service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC transaccional de todo el ciclo de estados
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_transition_template_state(
  p_template_id uuid,
  p_expected_from text,
  p_to_state text,
  p_motivo text,
  p_operation_id uuid,
  p_expected_predecessor_id uuid DEFAULT NULL,
  p_aprobada_por text DEFAULT NULL,
  p_fecha_aprobacion timestamptz DEFAULT NULL,
  p_ack_warnings boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  -- El helper legacy devuelve NULL cuando no existe claim de rol. La RPC debe
  -- interpretar cualquier valor distinto de TRUE como sesión humana/no service.
  v_is_service boolean := COALESCE(public.fn_secretaria_is_service_role(), false);
  v_tenant_id uuid;
  v_actor_id uuid := auth.uid();
  v_actor text;
  v_from text := upper(btrim(COALESCE(p_expected_from, '')));
  v_to text := upper(btrim(COALESCE(p_to_state, '')));
  v_target_initial public.plantillas_protegidas%ROWTYPE;
  v_target public.plantillas_protegidas%ROWTYPE;
  v_predecessor public.plantillas_protegidas%ROWTYPE;
  v_candidate public.plantillas_protegidas%ROWTYPE;
  v_initial_key text;
  v_key text;
  v_request_hash text;
  v_existing_operation public.secretaria_template_transition_operations%ROWTYPE;
  v_next_aprobada_por text;
  v_next_fecha_aprobacion timestamptz;
  v_predecessor_count integer := 0;
  v_bindings_moved integer := 0;
  v_target_log_id uuid;
  v_archived_log_id uuid;
  v_result jsonb;
  v_target_event_version text;
  v_archived_event_version text;
BEGIN
  IF p_template_id IS NULL
     OR p_operation_id IS NULL
     OR v_from = ''
     OR v_to = ''
     OR length(btrim(COALESCE(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'template, states, operation_id and motivo (>=10 chars) are required'
      USING ERRCODE = '22023';
  END IF;

  IF v_from NOT IN ('BORRADOR', 'REVISADA', 'APROBADA', 'ACTIVA', 'ARCHIVADA')
     OR v_to NOT IN ('BORRADOR', 'REVISADA', 'APROBADA', 'ACTIVA', 'ARCHIVADA') THEN
    RAISE EXCEPTION 'invalid template state % -> %', v_from, v_to
      USING ERRCODE = '22023';
  END IF;

  -- Para usuarios humanos, la autorización se resuelve antes de consultar el
  -- UUID objetivo: evita filtrar si una plantilla cruzada existe o no.
  IF NOT v_is_service THEN
    v_tenant_id := public.fn_current_tenant_id();
    PERFORM public.fn_secretaria_assert_active_template_admin(v_tenant_id);
    SELECT *
      INTO v_target_initial
      FROM public.plantillas_protegidas
     WHERE id = p_template_id
       AND tenant_id = v_tenant_id;
  ELSE
    SELECT *
      INTO v_target_initial
      FROM public.plantillas_protegidas
     WHERE id = p_template_id;
    IF FOUND THEN
      v_tenant_id := v_target_initial.tenant_id;
    END IF;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'template % not found in caller tenant', p_template_id
      USING ERRCODE = 'P0002';
  END IF;

  v_actor := COALESCE(
    NULLIF(auth.jwt() ->> 'email', ''),
    v_actor_id::text,
    CASE WHEN v_is_service THEN 'service_role' ELSE NULL END,
    'authenticated-user'
  );

  v_initial_key := public.fn_secretaria_template_functional_key(
    v_target_initial.tipo,
    v_target_initial.jurisdiccion,
    COALESCE(NULLIF(btrim(v_target_initial.materia_acuerdo), ''), v_target_initial.materia),
    v_target_initial.organo_tipo,
    v_target_initial.adoption_mode,
    v_target_initial.tipo_social
  );

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_array(
          v_tenant_id::text,
          p_template_id::text,
          v_from,
          v_to,
          btrim(p_motivo),
          COALESCE(p_expected_predecessor_id::text, ''),
          COALESCE(p_aprobada_por, ''),
          COALESCE(
            to_char(
              p_fecha_aprobacion AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ),
            ''
          ),
          COALESCE(p_ack_warnings, false)::text
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(
    hashtextextended('template-transition-operation:' || p_operation_id::text, 0)
  );

  SELECT *
    INTO v_existing_operation
    FROM public.secretaria_template_transition_operations
   WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_operation.tenant_id IS DISTINCT FROM v_tenant_id
       OR v_existing_operation.template_id IS DISTINCT FROM p_template_id
       OR v_existing_operation.request_hash_sha256 IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION 'operation_id reuse with a different request'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing_operation.result || jsonb_build_object('replayed', true);
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('template-functional-identity:' || v_tenant_id::text || ':' || v_initial_key, 0)
  );

  SELECT *
    INTO v_target
    FROM public.plantillas_protegidas
   WHERE id = p_template_id
     AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template % disappeared during transition', p_template_id
      USING ERRCODE = '40001';
  END IF;

  v_key := public.fn_secretaria_template_functional_key(
    v_target.tipo,
    v_target.jurisdiccion,
    COALESCE(NULLIF(btrim(v_target.materia_acuerdo), ''), v_target.materia),
    v_target.organo_tipo,
    v_target.adoption_mode,
    v_target.tipo_social
  );
  IF v_key IS DISTINCT FROM v_initial_key THEN
    RAISE EXCEPTION 'template identity changed during transition'
      USING ERRCODE = '40001';
  END IF;
  IF v_target.estado IS DISTINCT FROM v_from THEN
    RAISE EXCEPTION 'STALE_STATE expected %, found %', v_from, v_target.estado
      USING ERRCODE = '40001';
  END IF;

  IF NOT (
    (v_from = 'BORRADOR' AND v_to IN ('REVISADA', 'ARCHIVADA'))
    OR (v_from = 'REVISADA' AND v_to IN ('APROBADA', 'BORRADOR', 'ARCHIVADA'))
    OR (v_from = 'APROBADA' AND v_to IN ('ACTIVA', 'BORRADOR', 'ARCHIVADA'))
    OR (v_from = 'ACTIVA' AND v_to = 'ARCHIVADA')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION % -> %', v_from, v_to
      USING ERRCODE = '23514';
  END IF;

  IF v_from = 'ACTIVA'
     AND v_to = 'ARCHIVADA'
     AND EXISTS (
       SELECT 1
         FROM public.materia_template_binding b
        WHERE b.tenant_id = v_tenant_id
          AND b.template_id = p_template_id
          AND b.active = true
     ) THEN
    RAISE EXCEPTION 'ACTIVE_BINDINGS_REQUIRE_REPLACEMENT: active bindings must move through atomic replacement'
      USING ERRCODE = '23514';
  END IF;

  v_next_aprobada_por := COALESCE(NULLIF(btrim(p_aprobada_por), ''), v_target.aprobada_por);
  v_next_fecha_aprobacion := COALESCE(p_fecha_aprobacion, v_target.fecha_aprobacion);
  IF v_to = 'APROBADA'
     AND (
       NULLIF(btrim(p_aprobada_por), '') IS NULL
       OR p_fecha_aprobacion IS NULL
     ) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: nueva aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;
  IF v_to IN ('APROBADA', 'ACTIVA')
     AND (v_next_aprobada_por IS NULL OR v_next_fecha_aprobacion IS NULL) THEN
    RAISE EXCEPTION 'MISSING_APPROVAL_DATA: aprobación formal requerida'
      USING ERRCODE = '23514';
  END IF;

  IF v_to <> 'ACTIVA' AND p_expected_predecessor_id IS NOT NULL THEN
    RAISE EXCEPTION 'predecessor is only valid for activation'
      USING ERRCODE = '22023';
  END IF;

  IF v_to = 'ACTIVA' THEN
    FOR v_candidate IN
      SELECT p.*
        FROM public.plantillas_protegidas p
       WHERE p.tenant_id = v_tenant_id
         AND p.estado = 'ACTIVA'
         AND p.id <> p_template_id
         AND public.fn_secretaria_template_functional_key(
           p.tipo,
           p.jurisdiccion,
           COALESCE(NULLIF(btrim(p.materia_acuerdo), ''), p.materia),
           p.organo_tipo,
           p.adoption_mode,
           p.tipo_social
         ) = v_key
       FOR UPDATE
    LOOP
      v_predecessor_count := v_predecessor_count + 1;
      v_predecessor := v_candidate;
    END LOOP;

    IF v_predecessor_count > 1 THEN
      RAISE EXCEPTION 'multiple active predecessors for functional identity'
        USING ERRCODE = '23505';
    END IF;
    IF v_predecessor_count = 0 AND p_expected_predecessor_id IS NOT NULL THEN
      RAISE EXCEPTION 'STALE_PREDECESSOR expected %, found none', p_expected_predecessor_id
        USING ERRCODE = '40001';
    END IF;
    IF v_predecessor_count = 1
       AND p_expected_predecessor_id IS DISTINCT FROM v_predecessor.id THEN
      RAISE EXCEPTION 'STALE_PREDECESSOR expected %, found %', p_expected_predecessor_id, v_predecessor.id
        USING ERRCODE = '40001';
    END IF;
    IF v_predecessor_count = 1 AND NOT COALESCE(p_ack_warnings, false) THEN
      RAISE EXCEPTION 'atomic replacement warning must be acknowledged'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM set_config('app.secretaria_template_state_transition', p_operation_id::text, true);

  IF v_predecessor_count = 1 THEN
    UPDATE public.plantillas_protegidas
       SET estado = 'ARCHIVADA'
     WHERE id = v_predecessor.id
       AND tenant_id = v_tenant_id
       AND estado = 'ACTIVA';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'STALE_PREDECESSOR changed before archive'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  UPDATE public.plantillas_protegidas
     SET estado = v_to,
         aprobada_por = CASE
           WHEN v_to IN ('APROBADA', 'ACTIVA') THEN v_next_aprobada_por
           WHEN v_to = 'BORRADOR' THEN NULL
           ELSE aprobada_por
         END,
         fecha_aprobacion = CASE
           WHEN v_to IN ('APROBADA', 'ACTIVA') THEN v_next_fecha_aprobacion
           WHEN v_to = 'BORRADOR' THEN NULL
           ELSE fecha_aprobacion
         END,
         approved_by_role = CASE WHEN v_to = 'BORRADOR' THEN NULL ELSE approved_by_role END,
         approval_checklist = CASE WHEN v_to = 'BORRADOR' THEN '[]'::jsonb ELSE approval_checklist END,
         content_hash_sha256 = CASE WHEN v_to = 'BORRADOR' THEN NULL ELSE content_hash_sha256 END
   WHERE id = p_template_id
     AND tenant_id = v_tenant_id
     AND estado = v_from;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STALE_STATE changed before update'
      USING ERRCODE = '40001';
  END IF;

  IF v_predecessor_count = 1 THEN
    UPDATE public.materia_template_binding
       SET template_id = p_template_id,
           selection_reason = concat(
             selection_reason,
             ' Sustituida atómicamente por plantilla ',
             p_template_id,
             ' (operación ',
             p_operation_id,
             ').'
           )
     WHERE tenant_id = v_tenant_id
       AND template_id = v_predecessor.id
       AND active = true;
    GET DIAGNOSTICS v_bindings_moved = ROW_COUNT;

    v_archived_event_version := concat(
      v_predecessor.version,
      '#op:',
      p_operation_id,
      ':archive'
    );
    INSERT INTO public.plantilla_changelog (
      tenant_id,
      plantilla_id,
      from_version,
      to_version,
      bump_type,
      motivo,
      autor,
      diff_summary
    ) VALUES (
      v_tenant_id,
      v_predecessor.id,
      v_predecessor.version,
      v_archived_event_version,
      'PATCH',
      concat(
        'STATE:ACTIVA->ARCHIVADA | Sustitución atómica: ',
        btrim(p_motivo),
        ' [op:',
        p_operation_id,
        ']'
      ),
      v_actor,
      jsonb_build_object(
        'action', 'STATE_CHANGE',
        'from_state', 'ACTIVA',
        'to_state', 'ARCHIVADA',
        'logical_to_version', v_predecessor.version,
        'operation_id', p_operation_id,
        'request_hash_sha256', v_request_hash,
        'replacement_template_id', p_template_id,
        'bindings_moved', v_bindings_moved,
        'reconstructed', false
      )::text
    ) RETURNING id INTO v_archived_log_id;
  END IF;

  v_target_event_version := concat(v_target.version, '#op:', p_operation_id, ':state');
  INSERT INTO public.plantilla_changelog (
    tenant_id,
    plantilla_id,
    from_version,
    to_version,
    bump_type,
    motivo,
    autor,
    diff_summary
  ) VALUES (
    v_tenant_id,
    p_template_id,
    v_target.version,
    v_target_event_version,
    'PATCH',
    concat('STATE:', v_from, '->', v_to, ' | ', btrim(p_motivo), ' [op:', p_operation_id, ']'),
    v_actor,
    jsonb_build_object(
      'action', 'STATE_CHANGE',
      'from_state', v_from,
      'to_state', v_to,
      'logical_to_version', v_target.version,
      'operation_id', p_operation_id,
      'request_hash_sha256', v_request_hash,
      'ack_warnings', COALESCE(p_ack_warnings, false),
      'archived_template_id', CASE WHEN v_predecessor_count = 1 THEN v_predecessor.id END,
      'bindings_moved', v_bindings_moved,
      'reconstructed', false
    )::text
  ) RETURNING id INTO v_target_log_id;

  v_result := jsonb_build_object(
    'ok', true,
    'plantilla_id', p_template_id,
    'from', v_from,
    'to', v_to,
    'changelog_id', v_target_log_id,
    'archived_template_id', CASE WHEN v_predecessor_count = 1 THEN v_predecessor.id END,
    'archived_changelog_id', v_archived_log_id,
    'operation_id', p_operation_id,
    'replayed', false,
    'bindings_moved', v_bindings_moved
  );

  INSERT INTO public.secretaria_template_transition_operations (
    operation_id,
    tenant_id,
    template_id,
    request_hash_sha256,
    result,
    created_by
  ) VALUES (
    p_operation_id,
    v_tenant_id,
    p_template_id,
    v_request_hash,
    v_result,
    v_actor_id
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_transition_template_state(
  uuid, text, text, text, uuid, uuid, text, timestamptz, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_transition_template_state(
  uuid, text, text, text, uuid, uuid, text, timestamptz, boolean
) TO authenticated, service_role;

-- Solo la RPC puede cambiar estado, también cuando la invoca service_role. El
-- GUC es LOCAL a la transacción y no existe una RPC pública que permita
-- configurarlo.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_template_state_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'BORRADOR'
       AND COALESCE(current_setting('app.secretaria_template_state_transition', true), '') = '' THEN
      RAISE EXCEPTION 'template state must be initialized through governed workflow'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'template tenant_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.estado IS DISTINCT FROM NEW.estado
     AND COALESCE(current_setting('app.secretaria_template_state_transition', true), '') = '' THEN
    RAISE EXCEPTION 'direct template state transition forbidden; use governed RPC'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_guard_template_state_transition ON public.plantillas_protegidas;
CREATE TRIGGER tr_guard_template_state_transition
  BEFORE INSERT OR UPDATE ON public.plantillas_protegidas
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_guard_template_state_transition();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_template_state_transition()
  FROM PUBLIC, anon, authenticated, service_role;

-- Un binding activo nunca puede apuntar a una plantilla histórica o cruzada.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_active_template_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_template_estado text;
BEGIN
  -- El lock evita la carrera validar-ACTIVA / archivar: si el binding gana,
  -- la transición esperará y lo moverá; si la transición gana, revalidamos
  -- tras su commit y rechazamos la plantilla ya histórica.
  SELECT p.estado
    INTO v_template_estado
    FROM public.plantillas_protegidas p
   WHERE p.id = NEW.template_id
     AND p.tenant_id = NEW.tenant_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'binding requires a template in the same tenant'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.active AND v_template_estado IS DISTINCT FROM 'ACTIVA' THEN
    RAISE EXCEPTION 'active binding requires an ACTIVA template in the same tenant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_guard_active_template_binding ON public.materia_template_binding;
CREATE TRIGGER tr_guard_active_template_binding
  BEFORE INSERT OR UPDATE OF template_id, active, tenant_id ON public.materia_template_binding
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_guard_active_template_binding();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_active_template_binding()
  FROM PUBLIC, anon, authenticated, service_role;

-- Un evento WORM solo puede referir una plantilla del mismo tenant.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_template_changelog_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM 1
    FROM public.plantillas_protegidas p
   WHERE p.id = NEW.plantilla_id
     AND p.tenant_id = NEW.tenant_id
   FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template changelog requires a template in the same tenant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_guard_template_changelog_tenant ON public.plantilla_changelog;
CREATE TRIGGER tr_guard_template_changelog_tenant
  BEFORE INSERT ON public.plantilla_changelog
  FOR EACH ROW EXECUTE FUNCTION public.fn_secretaria_guard_template_changelog_tenant();

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_template_changelog_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS y privilegios: lectura tenant; escritura ADMIN_TENANT
-- ---------------------------------------------------------------------------

ALTER TABLE public.plantillas_protegidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_plantillas_protegidas ON public.plantillas_protegidas;
DROP POLICY IF EXISTS plantillas_tenant_select ON public.plantillas_protegidas;
DROP POLICY IF EXISTS plantillas_admin_insert ON public.plantillas_protegidas;
DROP POLICY IF EXISTS plantillas_admin_update ON public.plantillas_protegidas;
DROP POLICY IF EXISTS plantillas_admin_delete_draft ON public.plantillas_protegidas;

CREATE POLICY plantillas_tenant_select ON public.plantillas_protegidas
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());
CREATE POLICY plantillas_admin_insert ON public.plantillas_protegidas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND estado = 'BORRADOR'
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  );
CREATE POLICY plantillas_admin_update ON public.plantillas_protegidas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND estado = 'BORRADOR'
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND estado = 'BORRADOR'
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  );
CREATE POLICY plantillas_admin_delete_draft ON public.plantillas_protegidas
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND estado = 'BORRADOR'
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  );

REVOKE ALL ON public.plantillas_protegidas FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantillas_protegidas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantillas_protegidas TO service_role;

ALTER TABLE public.plantilla_changelog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS changelog_tenant_read ON public.plantilla_changelog;
DROP POLICY IF EXISTS changelog_tenant_insert ON public.plantilla_changelog;
DROP POLICY IF EXISTS changelog_admin_insert ON public.plantilla_changelog;

CREATE POLICY changelog_tenant_read ON public.plantilla_changelog
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());
CREATE POLICY changelog_admin_insert ON public.plantilla_changelog
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
    AND EXISTS (
      SELECT 1
       FROM public.plantillas_protegidas p
       WHERE p.id = public.plantilla_changelog.plantilla_id
         AND p.tenant_id = public.plantilla_changelog.tenant_id
    )
  );

REVOKE ALL ON public.plantilla_changelog FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.plantilla_changelog TO authenticated;
GRANT SELECT, INSERT ON public.plantilla_changelog TO service_role;

ALTER TABLE public.materia_template_binding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS materia_template_binding_select ON public.materia_template_binding;
DROP POLICY IF EXISTS materia_template_binding_write ON public.materia_template_binding;
DROP POLICY IF EXISTS materia_template_binding_admin_insert ON public.materia_template_binding;
DROP POLICY IF EXISTS materia_template_binding_admin_update ON public.materia_template_binding;
DROP POLICY IF EXISTS materia_template_binding_admin_delete ON public.materia_template_binding;

CREATE POLICY materia_template_binding_select ON public.materia_template_binding
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());
CREATE POLICY materia_template_binding_admin_insert ON public.materia_template_binding
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  );
CREATE POLICY materia_template_binding_admin_update ON public.materia_template_binding
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  );
CREATE POLICY materia_template_binding_admin_delete ON public.materia_template_binding
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND public.fn_secretaria_is_active_template_admin(tenant_id)
  );

REVOKE ALL ON public.materia_template_binding FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materia_template_binding
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materia_template_binding
  TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Endurecer la RPC de bindings existente con el mismo RBAC servidor
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_assign_template_binding(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_tenant_id uuid := COALESCE(
    NULLIF(p_payload ->> 'tenant_id', '')::uuid,
    public.fn_current_tenant_id()
  );
  v_template_id uuid := NULLIF(p_payload ->> 'template_id', '')::uuid;
  v_template record;
  v_binding_id uuid;
  v_materia text;
  v_doc_type text;
  v_selection_reason text := btrim(COALESCE(p_payload ->> 'selection_reason', ''));
BEGIN
  PERFORM public.fn_secretaria_assert_active_template_admin(v_tenant_id);

  SELECT tenant_id, estado, materia_acuerdo, materia, tipo, jurisdiccion, organo_tipo, adoption_mode
    INTO v_template
    FROM public.plantillas_protegidas
   WHERE id = v_template_id
     AND tenant_id = v_tenant_id
   FOR KEY SHARE;

  IF NOT FOUND OR v_template.estado <> 'ACTIVA' THEN
    RAISE EXCEPTION 'template % is not ACTIVA in tenant %', v_template_id, v_tenant_id
      USING ERRCODE = '23514';
  END IF;

  IF v_selection_reason = '' THEN
    RAISE EXCEPTION 'La asignación exige razón jurídica de selección.'
      USING ERRCODE = '23514';
  END IF;

  v_materia := COALESCE(
    NULLIF(btrim(p_payload ->> 'materia'), ''),
    NULLIF(btrim(v_template.materia_acuerdo), ''),
    v_template.materia,
    'GENERAL'
  );
  v_doc_type := COALESCE(
    NULLIF(btrim(p_payload ->> 'doc_type'), ''),
    v_template.tipo,
    'MODELO_ACUERDO'
  );

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
  ) VALUES (
    v_tenant_id,
    v_materia,
    COALESCE(NULLIF(btrim(p_payload ->> 'organo_tipo'), ''), v_template.organo_tipo, 'ANY'),
    COALESCE(NULLIF(btrim(p_payload ->> 'tipo_social'), ''), 'ANY'),
    COALESCE(NULLIF(btrim(p_payload ->> 'jurisdiccion'), ''), v_template.jurisdiccion, 'ES'),
    COALESCE(NULLIF(btrim(p_payload ->> 'adoption_mode'), ''), v_template.adoption_mode, 'ANY'),
    v_doc_type,
    v_template_id,
    COALESCE(NULLIF(p_payload ->> 'priority', '')::integer, 100),
    COALESCE((p_payload ->> 'active')::boolean, true),
    v_selection_reason
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
    'user_role', 'admin',
    'after_state', jsonb_build_object(
      'binding_id', v_binding_id,
      'template_id', v_template_id,
      'doc_type', v_doc_type,
      'selection_reason', v_selection_reason
    ),
    'event_dedupe_key', concat('template:', v_binding_id)
  ));

  RETURN v_binding_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_assign_template_binding(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_assign_template_binding(jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Verificación transaccional
-- ---------------------------------------------------------------------------

DO $verify_template_activation_integrity$
DECLARE
  v_duplicate_groups integer;
BEGIN
  SELECT count(*)
    INTO v_duplicate_groups
    FROM (
      SELECT
        p.tenant_id,
        public.fn_secretaria_template_functional_key(
          p.tipo,
          p.jurisdiccion,
          COALESCE(NULLIF(btrim(p.materia_acuerdo), ''), p.materia),
          p.organo_tipo,
          p.adoption_mode,
          p.tipo_social
        ) AS functional_key
      FROM public.plantillas_protegidas p
      WHERE p.estado = 'ACTIVA'
      GROUP BY p.tenant_id, functional_key
      HAVING count(*) > 1
    ) duplicates;

  IF v_duplicate_groups <> 0 THEN
    RAISE EXCEPTION 'Oleada 3A: persisten % identidades activas duplicadas', v_duplicate_groups;
  END IF;
  IF to_regprocedure(
       'public.fn_secretaria_transition_template_state(uuid,text,text,text,uuid,uuid,text,timestamp with time zone,boolean)'
     ) IS NULL THEN
    RAISE EXCEPTION 'Oleada 3A: RPC de transición no registrada';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = idx.relnamespace
     WHERE n.nspname = 'public'
       AND idx.relname = 'ux_plantillas_active_functional_identity'
       AND i.indisunique
       AND i.indisvalid
       AND i.indisready
       AND pg_get_indexdef(i.indexrelid) ILIKE '%tenant_id%'
       AND pg_get_indexdef(i.indexrelid) ILIKE '%fn_secretaria_template_functional_key%'
       AND COALESCE(pg_get_expr(i.indpred, i.indrelid), '') ILIKE '%estado%ACTIVA%'
  ) THEN
    RAISE EXCEPTION 'Oleada 3A: índice de unicidad activa ausente, inválido o con definición inesperada';
  END IF;
END;
$verify_template_activation_integrity$;

COMMIT;
