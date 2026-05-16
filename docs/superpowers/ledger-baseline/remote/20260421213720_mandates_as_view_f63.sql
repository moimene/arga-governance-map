-- F6.3 — mandates → VIEW derivada de condiciones_persona

-- PASO 1: snapshot a tabla de respaldo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'mandates' AND relkind = 'r'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS mandates_legacy_backup AS SELECT * FROM mandates';
  END IF;
END $$;

-- PASO 2: drop de políticas y tabla
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

-- PASO 3: VIEW derivada
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
  NULL::text                      AS type,
  NULL::numeric                   AS porcentaje_capital,
  NULL::numeric                   AS capital_participacion,
  NULL::boolean                   AS tiene_derecho_voto,
  NULL::text                      AS clase_accion
FROM condiciones_persona cp;

GRANT SELECT ON mandates TO authenticated, anon, service_role;
