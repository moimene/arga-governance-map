-- supabase/migrations/20260421_000026_mandates_as_view.sql
-- F6.3 — Convierte `mandates` en VIEW derivada de `condiciones_persona`.
--
-- A partir de F6.1/F6.2 todos los hooks que leían mandates como SSOT
-- (useBodies, usePersonasConCapital) ahora leen de condiciones_persona.
-- Los consumidores legacy que aún mencionan `.from("mandates")`
-- (useDashboardData, useConflicts, Calendario, body_mandates via
-- variable-resolver) siguen funcionando transparentemente porque esta
-- VIEW preserva las columnas legacy {id, role, status, start_date,
-- end_date, person_id, body_id, tenant_id, entity_id}.
--
-- Estrategia:
--   PASO 1: snapshot de la tabla actual a `mandates_legacy_backup`
--           (conservamos el historial por si hace falta auditoría).
--   PASO 2: DROP de políticas RLS sobre mandates + DROP TABLE CASCADE.
--   PASO 3: CREATE OR REPLACE VIEW mandates con el shape legacy.
--   PASO 4: GRANT SELECT a los roles que el app usa.
--
-- Mapeo canónica → legacy:
--   tipo_condicion → role
--   estado='VIGENTE' → status='Activo', estado='CESADO' → status='Cesado'
--   fecha_inicio → start_date
--   fecha_fin → end_date
--
-- Idempotencia: todas las operaciones usan IF EXISTS / OR REPLACE.
-- En un entorno ya-migrado, el DROP no falla si la tabla ya no existe;
-- en un entorno vacío, el CREATE VIEW sigue siendo válido.

-- ============================================================
-- PASO 1: snapshot a tabla de respaldo
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'mandates' AND relkind = 'r'  -- 'r' = table (no VIEW)
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS mandates_legacy_backup AS SELECT * FROM mandates';
  END IF;
END $$;

-- ============================================================
-- PASO 2: drop de políticas y tabla
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'mandates' AND relkind = 'r'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "tenant_read" ON mandates';
    EXECUTE 'DROP POLICY IF EXISTS "tenant_write" ON mandates';
    EXECUTE 'DROP POLICY IF EXISTS mandates_tenant_select ON mandates';
    EXECUTE 'DROP POLICY IF EXISTS mandates_tenant_write  ON mandates';
    EXECUTE 'DROP TABLE IF EXISTS mandates CASCADE';
  END IF;
END $$;

-- ============================================================
-- PASO 3: VIEW derivada
-- ============================================================
CREATE OR REPLACE VIEW mandates AS
SELECT
  cp.id,
  cp.tenant_id,
  cp.entity_id,
  cp.body_id,
  cp.person_id,
  cp.tipo_condicion              AS role,
  cp.fecha_inicio                AS start_date,
  cp.fecha_fin                   AS end_date,
  CASE
    WHEN cp.estado = 'VIGENTE' THEN 'Activo'
    ELSE 'Cesado'
  END                             AS status,
  cp.created_at,
  -- Columnas opcionales que aparecen en queries legacy pero ya no
  -- aplican en el modelo canónico; las devolvemos como NULL para
  -- no romper `.select("*")`.
  NULL::text                      AS type,
  NULL::numeric                   AS porcentaje_capital,
  NULL::numeric                   AS capital_participacion,
  NULL::boolean                   AS tiene_derecho_voto,
  NULL::text                      AS clase_accion
FROM condiciones_persona cp;

-- ============================================================
-- PASO 4: grants
-- ============================================================
GRANT SELECT ON mandates TO authenticated, anon, service_role;
