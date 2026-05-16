-- DL-6: Retribución consejeros — tabla + seed IAR 2025
CREATE TABLE IF NOT EXISTS consejero_retribucion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  body_id uuid NOT NULL REFERENCES governing_bodies(id),
  ejercicio integer NOT NULL DEFAULT 2026,
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
  rf_presidente numeric(12,2) DEFAULT 1091400,
  rf_vicepresidente_1 numeric(12,2) DEFAULT 534529,
  rf_consejero_director_general numeric(12,2) DEFAULT 534529,
  rf_director_general_adjunto numeric(12,2) DEFAULT 456022,
  rva_metrica_principal text DEFAULT 'BN_CONSOLIDADO_ROE',
  rva_ajuste_roe_pct numeric(5,2) DEFAULT 5.0,
  rva_pct_inmediato numeric(5,2) DEFAULT 70.0,
  rva_pct_diferido numeric(5,2) DEFAULT 30.0,
  rva_diferido_anos integer DEFAULT 3,
  rva_techo_individual text DEFAULT 'NO_SUPERAR_RF',
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
  prevision_seguro_vida_pct numeric(5,2) DEFAULT 20.0,
  prevision_presidente_adicional_pct numeric(5,2) DEFAULT 35.0,
  techo_jga_no_ejecutivos numeric(12,2) DEFAULT 4000000,
  created_at timestamptz DEFAULT now()
);

-- Seed retribution for ARGA Seguros CdA 2026
INSERT INTO consejero_retribucion (tenant_id, entity_id, body_id, ejercicio)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'fe05ddd9-ce3e-47b0-8948-5b975c79ab59',
  2026
);

-- RLS
ALTER TABLE consejero_retribucion ENABLE ROW LEVEL SECURITY;

CREATE POLICY consejero_retribucion_tenant_isolation ON consejero_retribucion
  USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid);
