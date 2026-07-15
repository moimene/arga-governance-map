-- Probe transaccional post-despliegue para
-- 20260712124000_secretaria_template_activation_integrity.sql.
--
-- Precondiciones:
--   * ejecutar con un rol de mantenimiento que pueda SET ROLE a
--     authenticated/service_role y crear fixtures en public;
--   * la migración 20260712124000 debe estar aplicada;
--   * ejecutar el fichero completo. BEGIN + ROLLBACK son parte del contrato.
--
-- El probe no borra ni renombra datos reales. Copia una plantilla canónica
-- mediante jsonb_populate_record, trabaja solo con UUID/tenants reservados para
-- esta prueba y revierte todos los efectos al terminar.

BEGIN;

-- Se crean con nombres exclusivos dentro de la transacción. Management API no
-- materializa pg_temp de forma fiable; ROLLBACK elimina estas funciones.
CREATE FUNCTION public.fn_secretaria_3a_probe_assert(
  p_condition boolean,
  p_message text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Oleada 3A probe assertion failed: %', p_message
      USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

CREATE FUNCTION public.fn_secretaria_3a_probe_expect_error(
  p_sql text,
  p_expected_sqlstate text,
  p_message_fragment text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_sqlstate text;
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_sqlstate = RETURNED_SQLSTATE,
      v_message = MESSAGE_TEXT;

    IF v_sqlstate IS DISTINCT FROM p_expected_sqlstate THEN
      RAISE EXCEPTION
        'Oleada 3A probe expected SQLSTATE %, got % (%). SQL: %',
        p_expected_sqlstate,
        v_sqlstate,
        v_message,
        p_sql
        USING ERRCODE = 'P0001';
    END IF;

    IF p_message_fragment IS NOT NULL
       AND position(lower(p_message_fragment) IN lower(COALESCE(v_message, ''))) = 0 THEN
      RAISE EXCEPTION
        'Oleada 3A probe expected error containing "%", got "%". SQL: %',
        p_message_fragment,
        v_message,
        p_sql
        USING ERRCODE = 'P0001';
    END IF;

    RETURN;
  END;

  RAISE EXCEPTION 'Oleada 3A probe expected an error, but SQL succeeded: %', p_sql
    USING ERRCODE = 'P0001';
END;
$function$;

-- El ledger no concede SELECT a authenticated por diseño. Este helper efímero
-- expone únicamente el cardinal de un operation_id durante el probe y se
-- elimina con el ROLLBACK final, sin tocar ACL ni policies del ledger real.
CREATE FUNCTION public.fn_secretaria_3a_probe_operation_count(
  p_operation_id uuid
) RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT count(*)
    FROM public.secretaria_template_transition_operations operations
   WHERE operations.operation_id = p_operation_id
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_3a_probe_assert(boolean, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_secretaria_3a_probe_expect_error(text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_secretaria_3a_probe_operation_count(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_3a_probe_assert(boolean, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_3a_probe_expect_error(text, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_3a_probe_operation_count(uuid)
  TO authenticated, service_role;

-- -------------------------------------------------------------------------
-- 0. Precondiciones fail-closed y colisiones de fixtures
-- -------------------------------------------------------------------------

DO $preconditions$
DECLARE
  v_fixture_tenants constant uuid[] := ARRAY[
    '3a000000-0000-4000-8000-000000000001'::uuid,
    '3a000000-0000-4000-8000-000000000002'::uuid
  ];
  v_fixture_templates constant uuid[] := ARRAY[
    '3a000000-0000-4000-8000-200000000001'::uuid,
    '3a000000-0000-4000-8000-200000000002'::uuid,
    '3a000000-0000-4000-8000-200000000003'::uuid
  ];
BEGIN
  PERFORM public.fn_secretaria_3a_probe_assert(
    to_regprocedure(
      'public.fn_secretaria_transition_template_state(uuid,text,text,text,uuid,uuid,text,timestamp with time zone,boolean)'
    ) IS NOT NULL,
    'falta la RPC exacta de transición'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    to_regprocedure('public.fn_secretaria_assign_template_binding(jsonb)') IS NOT NULL,
    'falta la RPC gobernada de binding'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    to_regclass('public.secretaria_template_transition_operations') IS NOT NULL,
    'falta el ledger de operaciones'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    to_regclass('public.ux_plantillas_active_functional_identity') IS NOT NULL,
    'falta el índice único de identidad funcional activa'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    EXISTS (
      SELECT 1
        FROM public.plantillas_protegidas
       WHERE id = '52e7f727-125b-4d26-a46f-bf9a912df56e'::uuid
         AND tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    ),
    'falta la plantilla real canónica usada como origen de copia'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (SELECT count(*) FROM public.rbac_roles WHERE role_code = 'ADMIN_TENANT') = 1,
    'ADMIN_TENANT debe existir una sola vez'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = ANY(v_fixture_tenants)),
    'colisión en UUID de tenant fixture'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    NOT EXISTS (
      SELECT 1 FROM public.plantillas_protegidas WHERE id = ANY(v_fixture_templates)
    ),
    'colisión en UUID de plantilla fixture'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    NOT EXISTS (
      SELECT 1
        FROM public.secretaria_template_transition_operations
       WHERE operation_id::text LIKE '3a000000-0000-4000-8000-3%'
    ),
    'colisión en UUID de operación fixture'
  );
END;
$preconditions$;

-- -------------------------------------------------------------------------
-- 1. Dos tenants propios y tres clones de una plantilla real
-- -------------------------------------------------------------------------

INSERT INTO public.tenants (id, name, tenant_type, country_code, is_active)
VALUES
  (
    '3a000000-0000-4000-8000-000000000001'::uuid,
    'Oleada 3A transactional probe A',
    'entity',
    'ZZ',
    true
  ),
  (
    '3a000000-0000-4000-8000-000000000002'::uuid,
    'Oleada 3A transactional probe B',
    'entity',
    'ZZ',
    true
  );

WITH source_template AS (
  SELECT p.*
    FROM public.plantillas_protegidas p
   WHERE p.id = '52e7f727-125b-4d26-a46f-bf9a912df56e'::uuid
), fixture_payloads AS (
  SELECT to_jsonb(s) || jsonb_build_object(
    'id', '3a000000-0000-4000-8000-200000000001',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'version', '3A.PROBE.PREDECESSOR',
    'estado', 'BORRADOR',
    'materia', 'AMPLIACION_CAPITAL',
    'materia_acuerdo', 'AMPLIACION_CAPITAL',
    'organo_tipo', 'CONSEJO',
    'adoption_mode', 'MEETING',
    'tipo_social', NULL,
    'aprobada_por', NULL,
    'fecha_aprobacion', NULL,
    'reviewed_by', NULL,
    'review_date', NULL,
    'review_notes', NULL,
    'approved_by_role', NULL,
    'approval_checklist', '[]'::jsonb,
    'version_history', '[]'::jsonb,
    'content_hash_sha256', NULL,
    'activated_at', NULL,
    'created_at', now()
  ) AS payload
  FROM source_template s

  UNION ALL

  SELECT to_jsonb(s) || jsonb_build_object(
    'id', '3a000000-0000-4000-8000-200000000002',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'version', '3A.PROBE.TARGET',
    'estado', 'BORRADOR',
    'materia', 'AUMENTO_CAPITAL',
    'materia_acuerdo', 'AUMENTO_CAPITAL',
    'organo_tipo', 'CONSEJO_ADMIN',
    'adoption_mode', 'MEETING',
    'tipo_social', 'ANY',
    'aprobada_por', NULL,
    'fecha_aprobacion', NULL,
    'reviewed_by', NULL,
    'review_date', NULL,
    'review_notes', NULL,
    'approved_by_role', NULL,
    'approval_checklist', '[]'::jsonb,
    'version_history', '[]'::jsonb,
    'content_hash_sha256', NULL,
    'activated_at', NULL,
    'created_at', now()
  ) AS payload
  FROM source_template s

  UNION ALL

  SELECT to_jsonb(s) || jsonb_build_object(
    'id', '3a000000-0000-4000-8000-200000000003',
    'tenant_id', '3a000000-0000-4000-8000-000000000002',
    'version', '3A.PROBE.CROSS_TENANT',
    'estado', 'BORRADOR',
    'materia', 'PROBE_CROSS_TENANT',
    'materia_acuerdo', 'PROBE_CROSS_TENANT',
    'organo_tipo', 'CONSEJO_ADMIN',
    'adoption_mode', 'MEETING',
    'tipo_social', 'ANY',
    'aprobada_por', NULL,
    'fecha_aprobacion', NULL,
    'reviewed_by', NULL,
    'review_date', NULL,
    'review_notes', NULL,
    'approved_by_role', NULL,
    'approval_checklist', '[]'::jsonb,
    'version_history', '[]'::jsonb,
    'content_hash_sha256', NULL,
    'activated_at', NULL,
    'created_at', now()
  ) AS payload
  FROM source_template s
), fixture_rows AS (
  SELECT jsonb_populate_record(
    NULL::public.plantillas_protegidas,
    payload
  ) AS fixture_row
  FROM fixture_payloads
)
INSERT INTO public.plantillas_protegidas
SELECT (fixture_row).*
FROM fixture_rows;

SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT COALESCE(length(COALESCE(p.capa1_inmutable, p.contenido_template)), 0) > 0
      FROM public.plantillas_protegidas p
     WHERE p.id = '3a000000-0000-4000-8000-200000000002'::uuid
  ),
  'el clone target no conservó contenido real'
);

SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT clone.capa1_inmutable IS NOT DISTINCT FROM source.capa1_inmutable
       AND clone.capa2_variables IS NOT DISTINCT FROM source.capa2_variables
       AND clone.capa3_editables IS NOT DISTINCT FROM source.capa3_editables
      FROM public.plantillas_protegidas clone
      CROSS JOIN public.plantillas_protegidas source
     WHERE clone.id = '3a000000-0000-4000-8000-200000000002'::uuid
       AND source.id = '52e7f727-125b-4d26-a46f-bf9a912df56e'::uuid
  ),
  'el clone target alteró las tres capas de contenido'
);

INSERT INTO public.rbac_user_roles (
  tenant_id,
  user_id,
  role_id,
  assigned_by,
  is_active,
  expires_at
)
SELECT
  fixture.tenant_id,
  fixture.user_id,
  r.id,
  fixture.assigned_by,
  true,
  fixture.expires_at
FROM (
  VALUES
    (
      '3a000000-0000-4000-8000-000000000001'::uuid,
      '3a000000-0000-4000-8000-100000000001'::uuid,
      'ADMIN_TENANT'::text,
      '3a000000-0000-4000-8000-100000000001'::uuid,
      now() + interval '1 hour'
    ),
    (
      '3a000000-0000-4000-8000-000000000001'::uuid,
      '3a000000-0000-4000-8000-100000000002'::uuid,
      'SECRETARIO'::text,
      '3a000000-0000-4000-8000-100000000001'::uuid,
      now() + interval '1 hour'
    ),
    (
      '3a000000-0000-4000-8000-000000000001'::uuid,
      '3a000000-0000-4000-8000-100000000003'::uuid,
      'ADMIN_TENANT'::text,
      '3a000000-0000-4000-8000-100000000001'::uuid,
      now() - interval '1 hour'
    )
) AS fixture(tenant_id, user_id, role_code, assigned_by, expires_at)
JOIN public.rbac_roles r ON r.role_code = fixture.role_code;

-- Claims PostgREST equivalentes a una sesión humana autenticada.
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '3a000000-0000-4000-8000-100000000001',
    'role', 'authenticated',
    'email', 'oleada3a-admin-probe@arga.invalid',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'app_metadata', jsonb_build_object(
      'tenant_id', '3a000000-0000-4000-8000-000000000001'
    )
  )::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT public.fn_secretaria_3a_probe_assert(
  public.fn_current_tenant_id()
    = '3a000000-0000-4000-8000-000000000001'::uuid,
  'claims no resuelven el tenant fixture A'
);
SELECT public.fn_secretaria_3a_probe_assert(
  public.fn_secretaria_is_active_template_admin(
    '3a000000-0000-4000-8000-000000000001'::uuid
  ),
  'la asignación RBAC temporal no autoriza ADMIN_TENANT'
);

-- El trigger debe bloquear el cambio directo también a un ADMIN_TENANT.
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.plantillas_protegidas
       SET estado = 'REVISADA'
     WHERE id = '3a000000-0000-4000-8000-200000000002'::uuid
  $sql$,
  '42501',
  'direct template state transition forbidden'
);

-- -------------------------------------------------------------------------
-- 2. Preparar predecessor ACTIVA (tipo_social NULL) y target APROBADA (ANY)
-- -------------------------------------------------------------------------

DO $prepare_lifecycle$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000001'::uuid,
    'BORRADOR',
    'REVISADA',
    'Probe review predecessor',
    '3a000000-0000-4000-8000-300000000101'::uuid,
    NULL,
    NULL,
    NULL,
    false
  );
  PERFORM public.fn_secretaria_3a_probe_assert(v_result ->> 'to' = 'REVISADA', 'falló review predecessor');
  PERFORM set_config('app.secretaria_template_state_transition', '', true);

  v_result := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000001'::uuid,
    'REVISADA',
    'APROBADA',
    'Probe approval predecessor',
    '3a000000-0000-4000-8000-300000000102'::uuid,
    NULL,
    'Equipo legal probe',
    '2026-07-12T12:40:00Z'::timestamptz,
    false
  );
  PERFORM public.fn_secretaria_3a_probe_assert(v_result ->> 'to' = 'APROBADA', 'falló approval predecessor');
  PERFORM set_config('app.secretaria_template_state_transition', '', true);

  v_result := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000001'::uuid,
    'APROBADA',
    'ACTIVA',
    'Probe first activation without predecessor',
    '3a000000-0000-4000-8000-300000000103'::uuid,
    NULL,
    NULL,
    NULL,
    false
  );
  PERFORM public.fn_secretaria_3a_probe_assert(v_result ->> 'to' = 'ACTIVA', 'falló activation predecessor');
  PERFORM public.fn_secretaria_3a_probe_assert(
    v_result ->> 'archived_template_id' IS NULL,
    'la primera activación no debía tener predecessor'
  );
  PERFORM set_config('app.secretaria_template_state_transition', '', true);

  v_result := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000002'::uuid,
    'BORRADOR',
    'REVISADA',
    'Probe review replacement target',
    '3a000000-0000-4000-8000-300000000111'::uuid,
    NULL,
    NULL,
    NULL,
    false
  );
  PERFORM public.fn_secretaria_3a_probe_assert(v_result ->> 'to' = 'REVISADA', 'falló review target');
  PERFORM set_config('app.secretaria_template_state_transition', '', true);

  v_result := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000002'::uuid,
    'REVISADA',
    'APROBADA',
    'Probe approval replacement target',
    '3a000000-0000-4000-8000-300000000112'::uuid,
    NULL,
    'Equipo legal probe',
    '2026-07-12T12:41:00Z'::timestamptz,
    false
  );
  PERFORM public.fn_secretaria_3a_probe_assert(v_result ->> 'to' = 'APROBADA', 'falló approval target');
  PERFORM set_config('app.secretaria_template_state_transition', '', true);
END;
$prepare_lifecycle$;

SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT p.tipo_social IS NULL
      FROM public.plantillas_protegidas p
     WHERE p.id = '3a000000-0000-4000-8000-200000000001'::uuid
  ),
  'predecessor debe conservar tipo_social NULL'
);
SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT p.tipo_social = 'ANY'
      FROM public.plantillas_protegidas p
     WHERE p.id = '3a000000-0000-4000-8000-200000000002'::uuid
  ),
  'target debe conservar tipo_social ANY'
);
SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT public.fn_secretaria_template_functional_key(
             predecessor.tipo,
             predecessor.jurisdiccion,
             COALESCE(NULLIF(btrim(predecessor.materia_acuerdo), ''), predecessor.materia),
             predecessor.organo_tipo,
             predecessor.adoption_mode,
             predecessor.tipo_social
           ) = public.fn_secretaria_template_functional_key(
             target.tipo,
             target.jurisdiccion,
             COALESCE(NULLIF(btrim(target.materia_acuerdo), ''), target.materia),
             target.organo_tipo,
             target.adoption_mode,
             target.tipo_social
           )
      FROM public.plantillas_protegidas predecessor
      CROSS JOIN public.plantillas_protegidas target
     WHERE predecessor.id = '3a000000-0000-4000-8000-200000000001'::uuid
       AND target.id = '3a000000-0000-4000-8000-200000000002'::uuid
  ),
  'aliases de materia/órgano y NULL=ANY no colapsan a la misma identidad'
);

-- assign_template_binding: razón jurídica obligatoria incluso para admin.
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_assign_template_binding(
      '{
        "tenant_id":"3a000000-0000-4000-8000-000000000001",
        "template_id":"3a000000-0000-4000-8000-200000000001",
        "materia":"AMPLIACION_CAPITAL",
        "selection_reason":""
      }'::jsonb
    )
  $sql$,
  '23514',
  'razón jurídica'
);

-- El mismo RPC debe rechazar un usuario del tenant sin ADMIN_TENANT.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '3a000000-0000-4000-8000-100000000002',
    'role', 'authenticated',
    'email', 'oleada3a-nonadmin-probe@arga.invalid',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'app_metadata', jsonb_build_object(
      'tenant_id', '3a000000-0000-4000-8000-000000000001'
    )
  )::text,
  true
);

SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT count(*) = 1
      FROM public.rbac_user_roles rur
      JOIN public.rbac_roles rr ON rr.id = rur.role_id
     WHERE rur.tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND rur.user_id = '3a000000-0000-4000-8000-100000000002'::uuid
       AND rr.role_code = 'SECRETARIO'
  ),
  'authenticated perdió la lectura RBAC necesaria en su tenant'
);

-- La propia fuente de autorización no puede ser automutable por authenticated.
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    INSERT INTO public.rbac_user_roles (
      tenant_id, user_id, role_id, assigned_by, is_active
    )
    SELECT
      '3a000000-0000-4000-8000-000000000001'::uuid,
      '3a000000-0000-4000-8000-100000000002'::uuid,
      id,
      '3a000000-0000-4000-8000-100000000002'::uuid,
      true
      FROM public.rbac_roles
     WHERE role_code = 'ADMIN_TENANT'
  $sql$,
  '42501',
  'permission denied for table rbac_user_roles'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.rbac_user_roles
       SET role_id = (SELECT id FROM public.rbac_roles WHERE role_code = 'ADMIN_TENANT')
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND user_id = '3a000000-0000-4000-8000-100000000002'::uuid
  $sql$,
  '42501',
  'permission denied for table rbac_user_roles'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    DELETE FROM public.rbac_user_roles
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND user_id = '3a000000-0000-4000-8000-100000000002'::uuid
  $sql$,
  '42501',
  'permission denied for table rbac_user_roles'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    INSERT INTO public.rbac_user_roles (
      tenant_id, user_id, role_id, assigned_by, is_active
    )
    SELECT
      '3a000000-0000-4000-8000-000000000002'::uuid,
      '3a000000-0000-4000-8000-100000000002'::uuid,
      id,
      '3a000000-0000-4000-8000-100000000002'::uuid,
      true
      FROM public.rbac_roles
     WHERE role_code = 'ADMIN_TENANT'
  $sql$,
  '42501',
  'permission denied for table rbac_user_roles'
);
SELECT public.fn_secretaria_3a_probe_assert(
  NOT public.fn_secretaria_is_active_template_admin(
    '3a000000-0000-4000-8000-000000000001'::uuid
  ),
  'SECRETARIO pudo autoasignarse ADMIN_TENANT'
);
SELECT public.fn_secretaria_3a_probe_assert(
  EXISTS (
    SELECT 1
      FROM public.fn_check_sod_violations(
        '3a000000-0000-4000-8000-000000000001'::uuid,
        '3a000000-0000-4000-8000-100000000002'::uuid,
        'AUDITOR'
      )
     WHERE conflicting_role = 'SECRETARIO'
       AND severity = 'BLOCK'
  ),
  'SECRETARIO no pudo consultar su propio conflicto SoD'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT *
      FROM public.fn_check_sod_violations(
        '3a000000-0000-4000-8000-000000000001'::uuid,
        '3a000000-0000-4000-8000-100000000001'::uuid,
        'AUDITOR'
      )
  $sql$,
  '42501',
  'ADMIN_TENANT active role required'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT *
      FROM public.fn_check_sod_violations(
        '3a000000-0000-4000-8000-000000000002'::uuid,
        '3a000000-0000-4000-8000-100000000002'::uuid,
        'AUDITOR'
      )
  $sql$,
  '42501',
  'cross-tenant SoD lookup forbidden'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_assign_template_binding(
      '{
        "tenant_id":"3a000000-0000-4000-8000-000000000001",
        "template_id":"3a000000-0000-4000-8000-200000000001",
        "materia":"AMPLIACION_CAPITAL",
        "selection_reason":"Probe legal reason with enough detail"
      }'::jsonb
    )
  $sql$,
  '42501',
  'ADMIN_TENANT active role required'
);

-- Un ADMIN_TENANT expirado tampoco puede reactivarse a sí mismo ni usar la RPC.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '3a000000-0000-4000-8000-100000000003',
    'role', 'authenticated',
    'email', 'oleada3a-expired-admin-probe@arga.invalid',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'app_metadata', jsonb_build_object(
      'tenant_id', '3a000000-0000-4000-8000-000000000001'
    )
  )::text,
  true
);
SELECT public.fn_secretaria_3a_probe_assert(
  NOT public.fn_secretaria_is_active_template_admin(
    '3a000000-0000-4000-8000-000000000001'::uuid
  ),
  'ADMIN_TENANT expirado fue tratado como activo'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.rbac_user_roles
       SET is_active = true,
           expires_at = NULL
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND user_id = '3a000000-0000-4000-8000-100000000003'::uuid
  $sql$,
  '42501',
  'permission denied for table rbac_user_roles'
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_transition_template_state(
      '3a000000-0000-4000-8000-200000000002'::uuid,
      'APROBADA',
      'ACTIVA',
      'Probe de admin expirado sin privilegios',
      '3a000000-0000-4000-8000-300000000104'::uuid,
      NULL,
      NULL,
      NULL,
      false
    )
  $sql$,
  '42501',
  'ADMIN_TENANT active role required'
);

-- Restaurar el admin fixture.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '3a000000-0000-4000-8000-100000000001',
    'role', 'authenticated',
    'email', 'oleada3a-admin-probe@arga.invalid',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'app_metadata', jsonb_build_object(
      'tenant_id', '3a000000-0000-4000-8000-000000000001'
    )
  )::text,
  true
);
SELECT public.fn_secretaria_3a_probe_assert(
  EXISTS (
    SELECT 1
      FROM public.fn_check_sod_violations(
        '3a000000-0000-4000-8000-000000000001'::uuid,
        '3a000000-0000-4000-8000-100000000002'::uuid,
        'AUDITOR'
      )
     WHERE conflicting_role = 'SECRETARIO'
       AND severity = 'BLOCK'
  ),
  'ADMIN_TENANT no pudo revisar el SoD de un tercero del tenant'
);

DO $create_binding$
DECLARE
  v_binding_id uuid;
BEGIN
  v_binding_id := public.fn_secretaria_assign_template_binding(
    jsonb_build_object(
      'tenant_id', '3a000000-0000-4000-8000-000000000001',
      'template_id', '3a000000-0000-4000-8000-200000000001',
      'materia', 'AMPLIACION_CAPITAL',
      'organo_tipo', 'CONSEJO',
      'tipo_social', 'ANY',
      'jurisdiccion', 'ES',
      'adoption_mode', 'MEETING',
      'doc_type', 'CONVOCATORIA',
      'priority', 731,
      'active', true,
      'selection_reason', 'Probe de sustitución atómica con trazabilidad jurídica'
    )
  );
  PERFORM public.fn_secretaria_3a_probe_assert(v_binding_id IS NOT NULL, 'assign gobernado no devolvió binding');
END;
$create_binding$;

-- -------------------------------------------------------------------------
-- 3. Negativos de concurrencia/CAS antes del reemplazo
-- -------------------------------------------------------------------------

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_transition_template_state(
      '3a000000-0000-4000-8000-200000000002'::uuid,
      'REVISADA', 'ACTIVA', 'Probe stale state rejection',
      '3a000000-0000-4000-8000-300000000201'::uuid,
      '3a000000-0000-4000-8000-200000000001'::uuid,
      NULL, NULL, true
    )
  $sql$,
  '40001',
  'STALE_STATE'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_transition_template_state(
      '3a000000-0000-4000-8000-200000000002'::uuid,
      'APROBADA', 'ACTIVA', 'Probe stale predecessor rejection',
      '3a000000-0000-4000-8000-300000000202'::uuid,
      '3a000000-0000-4000-8000-2deadbeef001'::uuid,
      NULL, NULL, true
    )
  $sql$,
  '40001',
  'STALE_PREDECESSOR'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_transition_template_state(
      '3a000000-0000-4000-8000-200000000002'::uuid,
      'APROBADA', 'ACTIVA', 'Probe missing warning acknowledgement',
      '3a000000-0000-4000-8000-300000000203'::uuid,
      '3a000000-0000-4000-8000-200000000001'::uuid,
      NULL, NULL, false
    )
  $sql$,
  '23514',
  'warning must be acknowledged'
);

-- El guard de estado también cubre service_role; la RPC es la única vía.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '3a000000-0000-4000-8000-100000000001',
    'role', 'service_role',
    'email', 'oleada3a-service-probe@arga.invalid',
    'tenant_id', '3a000000-0000-4000-8000-000000000001'
  )::text,
  true
);
SET LOCAL ROLE service_role;
SELECT set_config('app.secretaria_template_state_transition', '', true);

-- El canal de servicio conserva CRUD (sin TRUNCATE/TRIGGER) para seeds y
-- administración backend. Todo queda dentro del ROLLBACK del probe.
INSERT INTO public.rbac_user_roles (
  tenant_id, user_id, role_id, assigned_by, is_active, expires_at
)
SELECT
  '3a000000-0000-4000-8000-000000000001'::uuid,
  '3a000000-0000-4000-8000-100000000004'::uuid,
  id,
  NULL,
  true,
  now() + interval '1 hour'
  FROM public.rbac_roles
 WHERE role_code = 'SECRETARIO';
UPDATE public.rbac_user_roles
   SET is_active = false
 WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
   AND user_id = '3a000000-0000-4000-8000-100000000004'::uuid;
SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT is_active = false
      FROM public.rbac_user_roles
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND user_id = '3a000000-0000-4000-8000-100000000004'::uuid
  ),
  'service_role no pudo actualizar la asignación fixture'
);
DELETE FROM public.rbac_user_roles
 WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
   AND user_id = '3a000000-0000-4000-8000-100000000004'::uuid;
SELECT public.fn_secretaria_3a_probe_assert(
  NOT EXISTS (
    SELECT 1
      FROM public.rbac_user_roles
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND user_id = '3a000000-0000-4000-8000-100000000004'::uuid
  ),
  'service_role no pudo eliminar la asignación fixture'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.plantillas_protegidas
       SET estado = 'ACTIVA'
     WHERE id = '3a000000-0000-4000-8000-200000000002'::uuid
  $sql$,
  '42501',
  'direct template state transition forbidden'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '3a000000-0000-4000-8000-100000000001',
    'role', 'authenticated',
    'email', 'oleada3a-admin-probe@arga.invalid',
    'tenant_id', '3a000000-0000-4000-8000-000000000001',
    'app_metadata', jsonb_build_object(
      'tenant_id', '3a000000-0000-4000-8000-000000000001'
    )
  )::text,
  true
);

-- Forzar únicamente el bypass interno del trigger como owner permite probar
-- que el índice, por sí mismo, colapsa aliases y NULL=ANY. La violación se
-- captura en subtransacción y el target permanece APROBADA.
RESET ROLE;
SELECT set_config(
  'app.secretaria_template_state_transition',
  '3a-index-invariant-probe',
  true
);
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.plantillas_protegidas
       SET estado = 'ACTIVA'
     WHERE id = '3a000000-0000-4000-8000-200000000002'::uuid
  $sql$,
  '23505',
  'ux_plantillas_active_functional_identity'
);
SELECT set_config('app.secretaria_template_state_transition', '', true);
SELECT public.fn_secretaria_3a_probe_assert(
  (
    SELECT estado = 'APROBADA'
      FROM public.plantillas_protegidas
     WHERE id = '3a000000-0000-4000-8000-200000000002'::uuid
  ),
  'el intento de índice no revirtió atómicamente'
);

SET LOCAL ROLE authenticated;

-- -------------------------------------------------------------------------
-- 4. Reemplazo exacto, movimiento de binding e idempotencia
-- -------------------------------------------------------------------------

DO $activate_and_replay$
DECLARE
  v_result jsonb;
  v_replay jsonb;
  v_final_operation constant uuid := '3a000000-0000-4000-8000-300000000120'::uuid;
BEGIN
  v_result := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000002'::uuid,
    'APROBADA',
    'ACTIVA',
    'Probe exact atomic replacement activation',
    v_final_operation,
    '3a000000-0000-4000-8000-200000000001'::uuid,
    NULL,
    NULL,
    true
  );

  PERFORM public.fn_secretaria_3a_probe_assert((v_result ->> 'ok')::boolean, 'RPC no devolvió ok=true');
  PERFORM public.fn_secretaria_3a_probe_assert(
    (v_result ->> 'replayed')::boolean = false,
    'primera llamada marcada como replay'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (v_result ->> 'archived_template_id')::uuid
      = '3a000000-0000-4000-8000-200000000001'::uuid,
    'RPC no archivó el predecessor exacto'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (v_result ->> 'bindings_moved')::integer = 1,
    'RPC no movió exactamente un binding'
  );
  PERFORM set_config('app.secretaria_template_state_transition', '', true);

  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT estado = 'ARCHIVADA'
        FROM public.plantillas_protegidas
       WHERE id = '3a000000-0000-4000-8000-200000000001'::uuid
    ),
    'predecessor no terminó ARCHIVADA'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT estado = 'ACTIVA'
        FROM public.plantillas_protegidas
       WHERE id = '3a000000-0000-4000-8000-200000000002'::uuid
    ),
    'target no terminó ACTIVA'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT count(*) = 1
        FROM public.materia_template_binding
       WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
         AND template_id = '3a000000-0000-4000-8000-200000000002'::uuid
         AND active = true
         AND priority = 731
    ),
    'binding activo no quedó en target'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT count(*) = 2
        FROM public.plantilla_changelog
       WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
         AND (diff_summary::jsonb ->> 'operation_id')::uuid = v_final_operation
    ),
    'reemplazo debe generar exactamente dos changelogs'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    public.fn_secretaria_3a_probe_operation_count(v_final_operation) = 1,
    'primera ejecución debe generar exactamente un ledger'
  );

  v_replay := public.fn_secretaria_transition_template_state(
    '3a000000-0000-4000-8000-200000000002'::uuid,
    'APROBADA',
    'ACTIVA',
    'Probe exact atomic replacement activation',
    v_final_operation,
    '3a000000-0000-4000-8000-200000000001'::uuid,
    NULL,
    NULL,
    true
  );

  PERFORM public.fn_secretaria_3a_probe_assert(
    (v_replay ->> 'replayed')::boolean,
    'replay exacto no fue reconocido'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    public.fn_secretaria_3a_probe_operation_count(v_final_operation) = 1,
    'replay duplicó el ledger'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT count(*) = 2
        FROM public.plantilla_changelog
       WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
         AND (diff_summary::jsonb ->> 'operation_id')::uuid = v_final_operation
    ),
    'replay duplicó changelogs'
  );
END;
$activate_and_replay$;

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    SELECT public.fn_secretaria_transition_template_state(
      '3a000000-0000-4000-8000-200000000002'::uuid,
      'APROBADA', 'ACTIVA', 'Probe DIFFERENT request with reused operation id',
      '3a000000-0000-4000-8000-300000000120'::uuid,
      '3a000000-0000-4000-8000-200000000001'::uuid,
      NULL, NULL, true
    )
  $sql$,
  '22023',
  'operation_id reuse with a different request'
);

-- No puede crearse binding activo a una plantilla histórica.
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    INSERT INTO public.materia_template_binding (
      id, tenant_id, materia, organo_tipo, tipo_social, jurisdiccion,
      adoption_mode, doc_type, template_id, priority, active, selection_reason
    ) VALUES (
      '3a000000-0000-4000-8000-400000000001'::uuid,
      '3a000000-0000-4000-8000-000000000001'::uuid,
      'PROBE_ARCHIVED', 'CONSEJO_ADMIN', 'ANY', 'ES',
      'MEETING', 'CONVOCATORIA',
      '3a000000-0000-4000-8000-200000000001'::uuid,
      741, true, 'Probe binding histórico que debe rechazarse'
    )
  $sql$,
  '23514',
  'active binding requires an ACTIVA template'
);

-- Tampoco puede apuntar a una plantilla de otro tenant.
SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    INSERT INTO public.materia_template_binding (
      id, tenant_id, materia, organo_tipo, tipo_social, jurisdiccion,
      adoption_mode, doc_type, template_id, priority, active, selection_reason
    ) VALUES (
      '3a000000-0000-4000-8000-400000000002'::uuid,
      '3a000000-0000-4000-8000-000000000001'::uuid,
      'PROBE_CROSS_TENANT', 'CONSEJO_ADMIN', 'ANY', 'ES',
      'MEETING', 'CONVOCATORIA',
      '3a000000-0000-4000-8000-200000000003'::uuid,
      742, true, 'Probe binding cross tenant que debe rechazarse'
    )
  $sql$,
  '23514',
  'same tenant'
);

-- -------------------------------------------------------------------------
-- 5. WORM: probar los triggers como owner, no solo denegación por privilegios
-- -------------------------------------------------------------------------

RESET ROLE;
SELECT set_config('app.secretaria_template_state_transition', '', true);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.plantilla_changelog
       SET motivo = motivo || ' tamper'
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND (diff_summary::jsonb ->> 'operation_id')::uuid
         = '3a000000-0000-4000-8000-300000000120'::uuid
  $sql$,
  'P0001',
  'WORM protection'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    DELETE FROM public.plantilla_changelog
     WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
       AND (diff_summary::jsonb ->> 'operation_id')::uuid
         = '3a000000-0000-4000-8000-300000000120'::uuid
  $sql$,
  'P0001',
  'WORM protection'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    UPDATE public.secretaria_template_transition_operations
       SET result = result || '{"tampered":true}'::jsonb
     WHERE operation_id = '3a000000-0000-4000-8000-300000000120'::uuid
  $sql$,
  'P0001',
  'WORM protection'
);

SELECT public.fn_secretaria_3a_probe_expect_error(
  $sql$
    DELETE FROM public.secretaria_template_transition_operations
     WHERE operation_id = '3a000000-0000-4000-8000-300000000120'::uuid
  $sql$,
  'P0001',
  'WORM protection'
);

DO $final_assertions$
DECLARE
  v_duplicate_groups integer;
BEGIN
  SELECT count(*)
    INTO v_duplicate_groups
    FROM (
      SELECT public.fn_secretaria_template_functional_key(
               p.tipo,
               p.jurisdiccion,
               COALESCE(NULLIF(btrim(p.materia_acuerdo), ''), p.materia),
               p.organo_tipo,
               p.adoption_mode,
               p.tipo_social
             ) AS functional_key
        FROM public.plantillas_protegidas p
       WHERE p.tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
         AND p.estado = 'ACTIVA'
       GROUP BY functional_key
      HAVING count(*) > 1
    ) duplicates;

  PERFORM public.fn_secretaria_3a_probe_assert(v_duplicate_groups = 0, 'quedó un duplicado activo fixture');
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT count(*) = 2
        FROM public.plantilla_changelog
       WHERE tenant_id = '3a000000-0000-4000-8000-000000000001'::uuid
         AND (diff_summary::jsonb ->> 'operation_id')::uuid
           = '3a000000-0000-4000-8000-300000000120'::uuid
    ),
    'los intentos WORM alteraron changelog'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT count(*) = 1
        FROM public.secretaria_template_transition_operations
       WHERE operation_id = '3a000000-0000-4000-8000-300000000120'::uuid
         AND NOT (result ? 'tampered')
    ),
    'los intentos WORM alteraron ledger'
  );
  PERFORM public.fn_secretaria_3a_probe_assert(
    (
      SELECT estado = 'ACTIVA'
        FROM public.plantillas_protegidas
       WHERE id = '52e7f727-125b-4d26-a46f-bf9a912df56e'::uuid
         AND tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    ),
    'el probe tocó la plantilla real usada como fuente'
  );
END;
$final_assertions$;

ROLLBACK;
