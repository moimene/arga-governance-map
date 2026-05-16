-- 20260513_000068_vacancia_notification_tones.sql
-- Sprint 2 Personas/Cargos follow-up: keep notification.type aligned with
-- the existing UI contract (info/warning/error/success) while preserving
-- L13-B D+0/D+60/D+90 codes in title/body semantics.

BEGIN;

CREATE OR REPLACE FUNCTION fn_scan_vacancias_presidencia(
  p_tenant_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inserted integer;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);

  WITH vacant_bodies AS (
    SELECT
      gb.id AS body_id,
      gb.entity_id,
      gb.name AS body_name,
      e.legal_name AS entity_name,
      COALESCE(
        (
          SELECT max(cp.fecha_fin)
            FROM condiciones_persona cp
           WHERE cp.tenant_id = p_tenant_id
             AND cp.entity_id = gb.entity_id
             AND cp.body_id = gb.id
             AND cp.tipo_condicion = 'PRESIDENTE'
             AND cp.estado = 'CESADO'
        ),
        (
          SELECT min(n.created_at::date)
            FROM notifications n
           WHERE n.tenant_id = p_tenant_id
             AND n.title ILIKE '[D+0] Vacancia de Presidencia%'
             AND n.route = '/secretaria/organos/' || gb.id::text
        ),
        gb.created_at::date,
        CURRENT_DATE
      ) AS vacancy_start
    FROM governing_bodies gb
    JOIN entities e
      ON e.id = gb.entity_id
     AND e.tenant_id = gb.tenant_id
    LEFT JOIN persons ep
      ON ep.id = e.person_id
     AND ep.tenant_id = e.tenant_id
    WHERE gb.tenant_id = p_tenant_id
      AND (
        upper(coalesce(gb.body_type, '')) IN ('CDA', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION')
        OR upper(coalesce(gb.body_type, '')) LIKE '%CONSEJO%'
      )
      AND coalesce(gb.name, '') NOT ILIKE '[E2E REAL]%'
      AND coalesce(gb.name, '') NOT ILIKE 'PRUEBA%'
      AND coalesce(e.legal_name, '') NOT ILIKE '[E2E REAL]%'
      AND coalesce(e.legal_name, '') NOT ILIKE 'PRUEBA%'
      AND coalesce(ep.full_name, '') NOT ILIKE '[E2E REAL]%'
      AND coalesce(ep.full_name, '') NOT ILIKE '[ARCHIVED]%'
      AND coalesce(ep.full_name, '') NOT ILIKE 'PRUEBA%'
      AND coalesce(ep.tax_id, '') NOT ILIKE 'E2E-%'
      AND coalesce(ep.tax_id, '') NOT ILIKE 'ARCHIVED-%'
      AND NOT EXISTS (
        SELECT 1
          FROM condiciones_persona cp
         WHERE cp.tenant_id = p_tenant_id
           AND cp.entity_id = gb.entity_id
           AND cp.body_id = gb.id
           AND cp.tipo_condicion = 'PRESIDENTE'
           AND cp.estado = 'VIGENTE'
      )
  ),
  thresholds AS (
    SELECT 0 AS day_threshold, 'info' AS ui_type, '[D+0] Vacancia de Presidencia' AS title_prefix,
           'Vacancia de Presidencia del CdA. Preside el Vicepresidente o suplente estatutario.' AS body_text
    UNION ALL
    SELECT 60, 'warning',
           '[D+60] Aviso de vacancia de Presidencia',
           'Han transcurrido 60 días sin Presidente del CdA. Se recomienda convocar distribución de cargos.'
    UNION ALL
    SELECT 90, 'error',
           '[D+90] Alerta crítica de vacancia de Presidencia',
           'Vacancia presidencial excede los 90 días razonables. Riesgo de cuestionamiento registral o societario.'
  ),
  pending AS (
    SELECT
      p_tenant_id AS tenant_id,
      t.ui_type AS type,
      t.title_prefix || ' - ' || vb.entity_name AS title,
      t.body_text || ' Owner operativo: Secretario del CdA o Vicesecretario en suplencia.' AS body,
      '/secretaria/organos/' || vb.body_id::text AS route
    FROM vacant_bodies vb
    CROSS JOIN thresholds t
    WHERE (CURRENT_DATE - vb.vacancy_start) >= t.day_threshold
      AND NOT EXISTS (
        SELECT 1
          FROM notifications n
         WHERE n.tenant_id = p_tenant_id
           AND n.title ILIKE t.title_prefix || '%'
           AND n.route = '/secretaria/organos/' || vb.body_id::text
      )
  )
  INSERT INTO notifications (tenant_id, type, title, body, route, is_read)
  SELECT tenant_id, type, title, body, route, false
    FROM pending;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'inserted_notifications', v_inserted,
    'blocking', false,
    'thresholds', jsonb_build_array('D+0', 'D+60', 'D+90'),
    'owner', 'SECRETARIO_OR_VICESECRETARIO',
    'excludes_test_data', true,
    'notification_type_contract', 'info_warning_error'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_scan_vacancias_presidencia(uuid)
  TO authenticated, service_role;

COMMIT;
