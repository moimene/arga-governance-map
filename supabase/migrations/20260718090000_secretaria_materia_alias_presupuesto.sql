-- Lote 3 coherencia (B7) — alias de materia APROBACION_PRESUPUESTOS → APROBACION_PRESUPUESTO
--
-- Espeja en la identidad funcional server-side el alias que el cliente añade a
-- MATERIA_CANONICAL_ALIAS (agenda-materias.ts): ambos códigos nombran la misma
-- materia (Aprobación del presupuesto anual) y el filtro de Plantillas devolvía
-- 0 resultados para la opción bien etiquetada.
--
-- Forward-only. No borra ni renombra filas. Archiva el duplicado funcional
-- plural (MODELO_ACUERDO v0.1.0, provisional) conservando v1.0.0 singular como
-- canónica — mismo patrón que el saneamiento de Oleada 3A (20260712124000).
-- El cambio de estado usa el GUC transaccional que el guard de 3A reconoce.

DO $sanitize_presupuesto$
DECLARE
  v_tenant_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_plural_id constant uuid := 'b8e88780-342b-487e-b546-7fef68b86a4e'::uuid;
  v_singular_id constant uuid := '3dde14f1-a6a1-4604-9026-d0083ee15dee'::uuid;
  v_log_to_version constant text := '0.1.0#op:20260718090000-archive-presupuestos-plural';
  v_plural public.plantillas_protegidas%ROWTYPE;
  v_singular public.plantillas_protegidas%ROWTYPE;
  v_dependency_count integer;
  v_expected_log_count integer;
BEGIN
  PERFORM set_config(
    'app.secretaria_template_state_transition',
    '20260718090000-archive-presupuestos-plural',
    true
  );

  SELECT * INTO v_plural
    FROM public.plantillas_protegidas
   WHERE id = v_plural_id AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'B7: plantilla plural % no encontrada en tenant esperado', v_plural_id;
  END IF;

  SELECT * INTO v_singular
    FROM public.plantillas_protegidas
   WHERE id = v_singular_id AND tenant_id = v_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'B7: plantilla singular % no encontrada en tenant esperado', v_singular_id;
  END IF;

  IF v_plural.tipo IS DISTINCT FROM 'MODELO_ACUERDO'
     OR COALESCE(NULLIF(btrim(v_plural.materia_acuerdo), ''), v_plural.materia)
        IS DISTINCT FROM 'APROBACION_PRESUPUESTOS'
     OR v_plural.version IS DISTINCT FROM '0.1.0'
     OR v_plural.jurisdiccion IS DISTINCT FROM 'ES'
     OR v_plural.organo_tipo IS DISTINCT FROM 'CONSEJO_ADMIN'
     OR v_plural.adoption_mode IS DISTINCT FROM 'MEETING'
     OR v_plural.estado IS NULL
     OR v_plural.estado NOT IN ('ACTIVA', 'ARCHIVADA') THEN
    RAISE EXCEPTION 'B7: drift en la plantilla plural %', v_plural_id;
  END IF;

  IF v_singular.tipo IS DISTINCT FROM 'MODELO_ACUERDO'
     OR COALESCE(NULLIF(btrim(v_singular.materia_acuerdo), ''), v_singular.materia)
        IS DISTINCT FROM 'APROBACION_PRESUPUESTO'
     OR v_singular.jurisdiccion IS DISTINCT FROM 'ES'
     OR v_singular.organo_tipo IS DISTINCT FROM 'CONSEJO_ADMIN'
     OR v_singular.adoption_mode IS DISTINCT FROM 'MEETING'
     OR v_singular.estado IS DISTINCT FROM 'ACTIVA' THEN
    RAISE EXCEPTION 'B7: drift en la plantilla singular %', v_singular_id;
  END IF;

  IF v_plural.estado = 'ACTIVA' THEN
    SELECT COALESCE(sum(dependency_count), 0)::integer
      INTO v_dependency_count
      FROM (
        SELECT count(*) dependency_count FROM public.communications
         WHERE template_id = v_plural_id
        UNION ALL
        SELECT count(*) FROM public.materia_template_binding
         WHERE template_id = v_plural_id
        UNION ALL
        SELECT count(*) FROM public.no_session_expedientes
         WHERE selected_template_id = v_plural_id
        UNION ALL
        SELECT count(*) FROM public.no_session_resolutions
         WHERE selected_template_id = v_plural_id
        UNION ALL
        SELECT count(*) FROM public.plantilla_capa3_overrides_por_entidad
         WHERE plantilla_id = v_plural_id
        UNION ALL
        SELECT count(*) FROM public.secretaria_document_artifacts
         WHERE template_id = v_plural_id
        UNION ALL
        SELECT count(*) FROM public.secretaria_document_drafts
         WHERE template_id = v_plural_id
      ) dependencies;

    IF v_dependency_count <> 0 THEN
      RAISE EXCEPTION
        'B7: la plantilla plural tiene % dependencias; abortando sin remapear',
        v_dependency_count;
    END IF;

    UPDATE public.plantillas_protegidas
       SET estado = 'ARCHIVADA'
     WHERE id = v_plural_id
       AND tenant_id = v_tenant_id
       AND estado = 'ACTIVA';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'B7: no se pudo archivar la plantilla plural %', v_plural_id;
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
      v_plural_id,
      '0.1.0',
      v_log_to_version,
      'PATCH',
      'STATE:ACTIVA->ARCHIVADA | B7 Lote 3: APROBACION_PRESUPUESTOS es alias de APROBACION_PRESUPUESTO; se conserva la v1.0.0 singular como canónica [op:20260718090000-archive-presupuestos-plural]',
      'Sistema de gobierno de plantillas (coherencia Lote 3)',
      jsonb_build_object(
        'action', 'STATE_CHANGE',
        'from_state', 'ACTIVA',
        'to_state', 'ARCHIVADA',
        'logical_to_version', '0.1.0',
        'operation_id', '20260718090000-archive-presupuestos-plural',
        'canonical_template_id', v_singular_id,
        'reconstructed', false
      )::text
    );
  ELSE
    SELECT count(*)
      INTO v_expected_log_count
      FROM public.plantilla_changelog
     WHERE plantilla_id = v_plural_id
       AND to_version = v_log_to_version;
    IF v_expected_log_count <> 1 THEN
      RAISE EXCEPTION
        'B7: reejecución inconsistente; plural archivada pero changelog esperado=%',
        v_expected_log_count;
    END IF;
  END IF;
END
$sanitize_presupuesto$;

-- ---------------------------------------------------------------------------
-- 2. Alias en la identidad funcional server-side (espejo de MATERIA_CANONICAL_ALIAS)
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
        WHEN 'APROBACION_PRESUPUESTOS' THEN 'APROBACION_PRESUPUESTO'
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

-- ---------------------------------------------------------------------------
-- 3. Reconstruir el índice único con la nueva semántica de la función
-- ---------------------------------------------------------------------------

REINDEX INDEX public.ux_plantillas_active_functional_identity;

-- ---------------------------------------------------------------------------
-- 4. Verificación: una sola ACTIVA por identidad funcional y estado esperado
-- ---------------------------------------------------------------------------

DO $verify_presupuesto$
DECLARE
  v_dup_count integer;
  v_plural_estado text;
  v_singular_estado text;
BEGIN
  SELECT count(*) INTO v_dup_count
    FROM (
      SELECT tenant_id,
             public.fn_secretaria_template_functional_key(
               tipo,
               jurisdiccion,
               COALESCE(NULLIF(btrim(materia_acuerdo), ''), materia),
               organo_tipo,
               adoption_mode,
               tipo_social
             ) AS fkey,
             count(*) AS n
        FROM public.plantillas_protegidas
       WHERE estado = 'ACTIVA'
       GROUP BY 1, 2
      HAVING count(*) > 1
    ) dup;
  IF v_dup_count <> 0 THEN
    RAISE EXCEPTION 'B7: quedan % identidades funcionales con más de una ACTIVA', v_dup_count;
  END IF;

  SELECT estado INTO v_plural_estado
    FROM public.plantillas_protegidas
   WHERE id = 'b8e88780-342b-487e-b546-7fef68b86a4e';
  SELECT estado INTO v_singular_estado
    FROM public.plantillas_protegidas
   WHERE id = '3dde14f1-a6a1-4604-9026-d0083ee15dee';
  IF v_plural_estado IS DISTINCT FROM 'ARCHIVADA'
     OR v_singular_estado IS DISTINCT FROM 'ACTIVA' THEN
    RAISE EXCEPTION 'B7: estados finales inesperados (plural=%, singular=%)',
      v_plural_estado, v_singular_estado;
  END IF;
END
$verify_presupuesto$;
