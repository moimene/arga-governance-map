-- =============================================================
-- Migration 000010: DL Resolutions Seed Data
-- 2026-04-19
-- =============================================================
-- Covers 4 resolved legal decisions:
--   DL-5: Voto de calidad config per governing body
--   DL-6: Retribución consejeros (Rule Pack params + consejero_retribucion table)
--   DL-3: Pacto parasocial Fundación ARGA
--   DL-1: Portugal (CSC) jurisdiction overrides
--
-- DL-2 and DL-4 were implemented as code changes in:
--   - bordes-no-computables.ts (DL-2)
--   - plantillas-engine.ts (DL-4)
-- =============================================================

-- Fixed UUIDs for demo
-- DEMO_TENANT  = '00000000-0000-0000-0000-000000000001'
-- DEMO_ENTITY  = '00000000-0000-0000-0000-000000000010' (ARGA Seguros SA)
-- CDA_BODY     = '00000000-0000-0000-0000-000000000020' (Consejo de Administración)

-- =============================================================
-- DL-5: Voto de calidad del presidente — config per órgano
-- =============================================================

-- Step 1: Add config JSONB column to governing_bodies (if not exists)
ALTER TABLE governing_bodies ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Step 2: Create additional governing bodies for ARGA Seguros SA
-- Per CLAUDE.md: CdA 15 members, Comité Ejecutivo, 4 Comisiones delegadas

INSERT INTO governing_bodies (id, tenant_id, entity_id, tipo_organo, denominacion, activo, config)
VALUES
  -- Comité Ejecutivo (voto calidad: SÍ)
  ('00000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'COMISION_DELEGADA', 'Comité Ejecutivo', true,
   '{"voto_calidad_presidente": true, "es_comite_ejecutivo": true}'::jsonb),

  -- Comisión de Auditoría (voto calidad: NO)
  ('00000000-0000-0000-0000-000000000022',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'COMISION_DELEGADA', 'Comisión de Auditoría', true,
   '{"voto_calidad_presidente": false}'::jsonb),

  -- Comisión de Riesgos (voto calidad: NO)
  ('00000000-0000-0000-0000-000000000023',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'COMISION_DELEGADA', 'Comisión de Riesgos', true,
   '{"voto_calidad_presidente": false}'::jsonb),

  -- Comisión de Nombramientos (voto calidad: NO)
  ('00000000-0000-0000-0000-000000000024',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'COMISION_DELEGADA', 'Comisión de Nombramientos', true,
   '{"voto_calidad_presidente": false}'::jsonb),

  -- Comisión de Retribuciones (voto calidad: NO)
  ('00000000-0000-0000-0000-000000000025',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   'COMISION_DELEGADA', 'Comisión de Retribuciones', true,
   '{"voto_calidad_presidente": false}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  config = EXCLUDED.config,
  activo = EXCLUDED.activo;

-- Step 3: Update CdA config (voto calidad: SÍ)
UPDATE governing_bodies
SET config = '{"voto_calidad_presidente": true}'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000020';

-- =============================================================
-- DL-6: Retribución consejeros — valores derivados del IAR 2025
-- =============================================================

-- Create retribution configuration table
CREATE TABLE IF NOT EXISTS consejero_retribucion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  body_id uuid NOT NULL REFERENCES governing_bodies(id),
  ejercicio integer NOT NULL DEFAULT 2026,

  -- Retribución fija no ejecutivos
  rf_vicepresidente_cda numeric(12,2) DEFAULT 220000,
  rf_coordinador_independiente numeric(12,2) DEFAULT 220000,
  rf_vocal_cda numeric(12,2) DEFAULT 115000,
  rf_presidente_comision_auditoria numeric(12,2) DEFAULT 52000,
  rf_vocal_comision_auditoria numeric(12,2) DEFAULT 36000,
  rf_presidente_comision_nombramientos numeric(12,2) DEFAULT 45000,
  rf_vocal_comision_nombramientos numeric(12,2) DEFAULT 32000,
  rf_presidente_comision_retribuciones numeric(12,2) DEFAULT 45000,
  rf_vocal_comision_retribuciones numeric(12,2) DEFAULT 32000,
  rf_presidente_comision_riesgos numeric(12,2) DEFAULT 52000,
  rf_vocal_comision_riesgos numeric(12,2) DEFAULT 36000,

  -- Retribución fija ejecutivos
  rf_presidente numeric(12,2) DEFAULT 1091400,
  rf_vicepresidente_1 numeric(12,2) DEFAULT 534529,
  rf_consejero_director_general numeric(12,2) DEFAULT 534529,
  rf_director_general_adjunto numeric(12,2) DEFAULT 456022,

  -- Retribución variable anual (RVA)
  rva_metrica_principal text DEFAULT 'BN_CONSOLIDADO_ROE',
  rva_ajuste_roe_pct numeric(5,2) DEFAULT 5.0,
  rva_pct_inmediato numeric(5,2) DEFAULT 70.0,
  rva_pct_diferido numeric(5,2) DEFAULT 30.0,
  rva_diferido_anos integer DEFAULT 3,
  rva_techo_individual text DEFAULT 'NO_SUPERAR_RF',

  -- ILP 2026-2028
  ilp_instrumento text DEFAULT '50_EFECTIVO_50_ACCIONES',
  ilp_tsr_peso_pct numeric(5,2) DEFAULT 30.0,
  ilp_roe_peso_pct numeric(5,2) DEFAULT 25.0,
  ilp_rcgnv_peso_pct numeric(5,2) DEFAULT 25.0,
  ilp_csm_peso_pct numeric(5,2) DEFAULT 5.0,
  ilp_esg_peso_pct numeric(5,2) DEFAULT 15.0,
  ilp_periodo_devengo_anos integer DEFAULT 3,
  ilp_pct_inmediato numeric(5,2) DEFAULT 40.0,
  ilp_pct_diferido numeric(5,2) DEFAULT 60.0,
  ilp_diferido_anos_adicionales integer DEFAULT 3,

  -- Previsión social
  prevision_seguro_vida_pct numeric(5,2) DEFAULT 20.0,
  prevision_presidente_adicional_pct numeric(5,2) DEFAULT 35.0,

  -- Techo JGA
  techo_jga_no_ejecutivos numeric(12,2) DEFAULT 4000000,

  created_at timestamptz DEFAULT now()
);

-- Seed retribution for ARGA Seguros CdA 2026
INSERT INTO consejero_retribucion (
  id, tenant_id, entity_id, body_id, ejercicio
) VALUES (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020',
  2026
) ON CONFLICT (id) DO NOTHING;

-- Also update the RETRIBUCION_ADMIN rule pack params with IAR 2025 values
UPDATE rule_packs
SET payload = jsonb_set(
  payload,
  '{parametros_retribucion}',
  '{
    "fuente": "IAR 2025 ARGA Seguros (adaptado)",
    "ejercicio": 2026,
    "techo_jga_no_ejecutivos": 4000000,
    "rf_vocal_cda": 115000,
    "rf_presidente": 1091400,
    "rva_metrica": "BN_CONSOLIDADO_ROE",
    "ilp_periodo": "2026-2028",
    "ilp_instrumento": "50% efectivo + 50% acciones"
  }'::jsonb
)
WHERE id = 'RETRIBUCION_ADMIN';

-- =============================================================
-- DL-3: Pacto parasocial Fundación ARGA
-- =============================================================

-- Create pactos_parasociales table
CREATE TABLE IF NOT EXISTS pactos_parasociales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  nombre text NOT NULL,
  firmante_principal text NOT NULL,
  participacion_pct numeric(8,4),
  tipo_pacto text NOT NULL DEFAULT 'VETO',
  ambito_materias text[] NOT NULL DEFAULT '{}',
  condicion_activacion text,
  vigente_desde date,
  vigente_hasta date,
  activo boolean DEFAULT true,
  notas text,
  created_at timestamptz DEFAULT now()
);

-- Seed: Fundación ARGA 69.69% — veto on structural operations
INSERT INTO pactos_parasociales (
  id, tenant_id, entity_id, nombre, firmante_principal, participacion_pct,
  tipo_pacto, ambito_materias, condicion_activacion, vigente_desde, activo, notas
) VALUES (
  '00000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'Pacto de Sindicación Fundación ARGA',
  'Fundación ARGA (vía Cartera ARGA S.L.U.)',
  69.69,
  'VETO',
  ARRAY['FUSION_SOCIEDAD', 'ESCISION_SOCIEDAD', 'DISOLUCION', 'TRANSFORMACION_SOCIEDAD', 'VENTA_ACTIVOS_SIGNIFICATIVOS'],
  'Voto favorable de Fundación ARGA requerido para operaciones estructurales y venta de activos >15% del patrimonio neto',
  '2020-01-01',
  true,
  'Pacto demo derivado de la estructura accionarial ARGA. Fundación ARGA → Cartera ARGA S.L.U. (100%) → 69.69% ARGA Seguros S.A. El pacto concede derecho de veto en operaciones que puedan alterar sustancialmente la estructura del grupo.'
) ON CONFLICT (id) DO NOTHING;

-- RLS for pactos_parasociales (tenant isolation)
ALTER TABLE pactos_parasociales ENABLE ROW LEVEL SECURITY;

CREATE POLICY pactos_parasociales_tenant_isolation ON pactos_parasociales
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

-- RLS for consejero_retribucion (tenant isolation)
ALTER TABLE consejero_retribucion ENABLE ROW LEVEL SECURITY;

CREATE POLICY consejero_retribucion_tenant_isolation ON consejero_retribucion
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);

-- =============================================================
-- DL-1: Portugal (CSC) jurisdiction overrides
-- =============================================================

-- Preview overrides for 3 common materias under Portuguese CSC
-- These use rule_param_overrides with jurisdiction = 'PT'

INSERT INTO rule_param_overrides (
  id, tenant_id, entity_id, body_id,
  materia, clase,
  convocatoria_antelacion_dias, convocatoria_fuente,
  constitucion_quorum_pct, constitucion_quorum_fuente,
  vigente_desde, descripcion
) VALUES
  -- PT — APROBACION_CUENTAS (CSC art. 376)
  ('00000000-0000-0000-0000-000000000801',
   '00000000-0000-0000-0000-000000000001',
   NULL, NULL,
   'APROBACION_CUENTAS', 'ORDINARIA',
   15, 'CSC art. 377.º — convocatória com antecedência mínima de 15 dias',
   0, 'CSC art. 383.º — sem quórum constitutivo para SA em 1.ª convocatória',
   '2026-01-01',
   '[PT/CSC] Override para aprovação de contas — Portugal (preview jurisdiccional DL-1)'),

  -- PT — NOMBRAMIENTO_CESE_ADMIN (CSC art. 391)
  ('00000000-0000-0000-0000-000000000802',
   '00000000-0000-0000-0000-000000000001',
   NULL, NULL,
   'NOMBRAMIENTO_CESE_ADMIN', 'ORDINARIA',
   15, 'CSC art. 377.º — convocatória com antecedência mínima de 15 dias',
   0, 'CSC art. 383.º — sem quórum constitutivo em 1.ª convocatória',
   '2026-01-01',
   '[PT/CSC] Override para nomeação/destituição de administradores — Portugal (preview jurisdiccional DL-1)'),

  -- PT — MOD_ESTATUTOS (CSC art. 85 + 383)
  ('00000000-0000-0000-0000-000000000803',
   '00000000-0000-0000-0000-000000000001',
   NULL, NULL,
   'MOD_ESTATUTOS', 'ESTATUTARIA',
   15, 'CSC art. 377.º — convocatória com antecedência mínima de 15 dias',
   33, 'CSC art. 383.º n.º 2 — quórum constitutivo de 1/3 capital para alteração de estatutos',
   '2026-01-01',
   '[PT/CSC] Override para alteração de estatutos — Portugal. Quórum 1/3 capital en 1.ª conv (preview jurisdiccional DL-1)')

ON CONFLICT (id) DO UPDATE SET
  convocatoria_antelacion_dias = EXCLUDED.convocatoria_antelacion_dias,
  convocatoria_fuente = EXCLUDED.convocatoria_fuente,
  constitucion_quorum_pct = EXCLUDED.constitucion_quorum_pct,
  constitucion_quorum_fuente = EXCLUDED.constitucion_quorum_fuente,
  descripcion = EXCLUDED.descripcion;
