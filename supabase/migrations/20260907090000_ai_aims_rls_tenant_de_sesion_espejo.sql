-- ============================================================================
-- Espejo en repo de las 16 políticas RLS de ai_*/aims_* que ya resuelven el
-- tenant de la SESIÓN en Cloud.  (n=1005)
--
-- POR QUÉ EXISTE
-- --------------
-- El repo decía una cosa y Cloud otra. Estas 16 políticas nacieron cableando el
-- tenant de ARGA:
--   * 20260418154408_fase4_ai_governance_tables.sql:66-67  (2 políticas)
--   * 20260426151000_000043_aims360_core.sql:438-518       (14 políticas)
-- En Cloud se corrigieron a `fn_current_tenant_id()` sin dejar migración, así
-- que quien leyera el historial concluiría que el segundo tenant está fuera de
-- sus propias tablas de IA. Con las políticas originales lo estaría: el tenant
-- Garrigues no podría ni leer ni escribir su inventario.
--
-- MEDIDO EN CLOUD ANTES DE ESCRIBIR (2026-09-07, `pg_policies`, solo lectura):
-- las 16 existen, todas `PERMISSIVE`, `FOR ALL`, `TO authenticated`, y todas
-- con `USING (tenant_id = fn_current_tenant_id())`. Las 14 `aims_*` llevan
-- además `WITH CHECK` explícito; `ai_systems` y `ai_incidents` NO lo llevan
-- —para una política `FOR ALL` sin WITH CHECK, Postgres usa el USING también
-- como comprobación de escritura, así que la semántica es la misma—. Se copia
-- lo que Cloud dice, no lo que quedaría más bonito: el objetivo es que el
-- historial deje de mentir, no cambiar el comportamiento.
--
-- Es idempotente (DROP IF EXISTS + CREATE) y forward-only: los dos ficheros
-- históricos NO se reescriben.
--
-- Vigilado por `src/test/schema/aims-migration-shape.test.ts`, bloque
-- «el repo dice de las RLS de IA lo que dice Cloud»: recorre TODO el historial,
-- se queda con la última definición de cada política ai_*/aims_* y se pone rojo
-- si alguna cablea un tenant o deja de resolver el de la sesión.
-- ============================================================================

-- ── Legacy ai_* (fase 4) ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenant_isolation" ON ai_systems;
CREATE POLICY "tenant_isolation" ON ai_systems
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation" ON ai_incidents;
CREATE POLICY "tenant_isolation" ON ai_incidents
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id());

-- ── Backbone aims_* (000043) ────────────────────────────────────────────────
-- Escritas una a una y no en un bucle DO: en este repo los gates LEEN el SQL,
-- y una política construida con `format()` no la encuentra ningún grep de la
-- política. Aburrido y greppable gana a corto y opaco.

DROP POLICY IF EXISTS aims_system_versions_tenant_isolation ON aims_system_versions;
CREATE POLICY aims_system_versions_tenant_isolation ON aims_system_versions
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_component_inventory_tenant_isolation ON aims_component_inventory;
CREATE POLICY aims_component_inventory_tenant_isolation ON aims_component_inventory
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_dataset_registry_tenant_isolation ON aims_dataset_registry;
CREATE POLICY aims_dataset_registry_tenant_isolation ON aims_dataset_registry
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_model_registry_tenant_isolation ON aims_model_registry;
CREATE POLICY aims_model_registry_tenant_isolation ON aims_model_registry
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_requirement_catalog_tenant_isolation ON aims_requirement_catalog;
CREATE POLICY aims_requirement_catalog_tenant_isolation ON aims_requirement_catalog
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_requirement_checks_tenant_isolation ON aims_requirement_checks;
CREATE POLICY aims_requirement_checks_tenant_isolation ON aims_requirement_checks
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_control_catalog_tenant_isolation ON aims_control_catalog;
CREATE POLICY aims_control_catalog_tenant_isolation ON aims_control_catalog
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_control_tests_tenant_isolation ON aims_control_tests;
CREATE POLICY aims_control_tests_tenant_isolation ON aims_control_tests
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_post_market_plans_tenant_isolation ON aims_post_market_plans;
CREATE POLICY aims_post_market_plans_tenant_isolation ON aims_post_market_plans
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_monitoring_indicators_tenant_isolation ON aims_monitoring_indicators;
CREATE POLICY aims_monitoring_indicators_tenant_isolation ON aims_monitoring_indicators
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_change_requests_tenant_isolation ON aims_change_requests;
CREATE POLICY aims_change_requests_tenant_isolation ON aims_change_requests
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_technical_file_sections_tenant_isolation ON aims_technical_file_sections;
CREATE POLICY aims_technical_file_sections_tenant_isolation ON aims_technical_file_sections
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_evidence_packs_tenant_isolation ON aims_evidence_packs;
CREATE POLICY aims_evidence_packs_tenant_isolation ON aims_evidence_packs
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

DROP POLICY IF EXISTS aims_incident_evidence_packs_tenant_isolation ON aims_incident_evidence_packs;
CREATE POLICY aims_incident_evidence_packs_tenant_isolation ON aims_incident_evidence_packs
  FOR ALL TO authenticated
  USING (tenant_id = fn_current_tenant_id())
  WITH CHECK (tenant_id = fn_current_tenant_id());

-- Comprobación en la propia migración: si alguna de las 16 quedara sin resolver
-- el tenant de la sesión, aquí se ve, no en la demo.
DO $verificacion$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (tablename LIKE 'ai\_%' OR tablename LIKE 'aims\_%')
    AND qual LIKE '%fn_current_tenant_id()%';
  IF n < 16 THEN
    RAISE EXCEPTION 'espejo RLS ai_*/aims_*: sólo % políticas resuelven el tenant de sesión', n;
  END IF;
END
$verificacion$;
