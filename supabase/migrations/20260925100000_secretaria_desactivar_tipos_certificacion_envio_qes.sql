-- Migración: 20260925100000_secretaria_desactivar_tipos_certificacion_envio_qes.sql
-- Descripción: Desactiva en standalone_certification_kinds (tenant ARGA ...0001) los tipos
-- que afirman envío, entrega o firma cualificada (CERT_ENVIO_CONVOCATORIA, CERT_ERDS_ENTREGA,
-- CERT_COMUNICACIONES_REGULATORIAS), conforme a la política vigente de interposición EAD Trust
-- (AGENTS.md) y la resolución de MOI-145. Las filas se preservan para integridad y trazabilidad.

DO $$
DECLARE
  v_tenant_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_updated_count integer;
  v_active_excluded_count integer;
  v_active_legit_count integer;
  v_total_tenant_count integer;
BEGIN
  -- 1. Verificar existencia total de filas para el tenant ARGA
  SELECT count(*) INTO v_total_tenant_count
  FROM standalone_certification_kinds
  WHERE tenant_id = v_tenant_id;

  IF v_total_tenant_count < 41 THEN
    RAISE EXCEPTION 'Aserción fallida: catálogo de certificaciones incompleto para tenant %, encontradas % filas', v_tenant_id, v_total_tenant_count;
  END IF;

  -- 2. Desactivar quirúrgicamente los 3 tipos identificados
  UPDATE standalone_certification_kinds
  SET is_active = false,
      updated_at = now()
  WHERE tenant_id = v_tenant_id
    AND kind_code IN ('CERT_ENVIO_CONVOCATORIA', 'CERT_ERDS_ENTREGA', 'CERT_COMUNICACIONES_REGULATORIAS');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Si ya estaban desactivadas previamente en re-ejecución idempotente, comprobamos que no haya activas
  RAISE NOTICE 'Filas actualizadas a is_active=false: %', v_updated_count;

  -- 3. Aserción de seguridad: 0 tipos activos que exijan QES o afirmen envío/entrega
  SELECT count(*) INTO v_active_excluded_count
  FROM standalone_certification_kinds
  WHERE tenant_id = v_tenant_id
    AND is_active = true
    AND (
      requires_qes = true
      OR kind_code IN ('CERT_ENVIO_CONVOCATORIA', 'CERT_ERDS_ENTREGA', 'CERT_COMUNICACIONES_REGULATORIAS')
    );

  IF v_active_excluded_count <> 0 THEN
    RAISE EXCEPTION 'Aserción fallida: existen % tipos de certificación activos con requires_qes=true o semántica excluida', v_active_excluded_count;
  END IF;

  -- 4. Aserción de integridad: los tipos legítimos (p. ej. CERT_ACUERDO_360) siguen activos
  SELECT count(*) INTO v_active_legit_count
  FROM standalone_certification_kinds
  WHERE tenant_id = v_tenant_id
    AND is_active = true;

  IF v_active_legit_count <> 38 THEN
    RAISE EXCEPTION 'Aserción fallida: se esperaban exactamente 38 tipos activos legítimos para tenant %, encontrados %', v_tenant_id, v_active_legit_count;
  END IF;

  RAISE NOTICE 'Verificación superada con éxito: 3 tipos desactivados, 38 tipos legítimos activos.';
END $$;
