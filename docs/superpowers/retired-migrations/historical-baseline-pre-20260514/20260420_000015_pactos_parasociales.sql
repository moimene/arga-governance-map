-- ============================================================
-- Migration 000015 — Pactos Parasociales (MVP)
-- ============================================================

-- Table: pactos_parasociales
CREATE TABLE IF NOT EXISTS pactos_parasociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES entities(id),
  pacto_ref TEXT NOT NULL,
  fecha_pacto TIMESTAMPTZ NOT NULL,
  partes JSONB NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL CHECK (estado IN ('VIGENTE', 'RESUELTO', 'SUSPENDIDO')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: pacto_clausulas
CREATE TABLE IF NOT EXISTS pacto_clausulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pacto_id UUID NOT NULL REFERENCES pactos_parasociales(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'VETO', 'MAYORIA_REFORZADA_PACTADA', 'CONSENTIMIENTO_INVERSOR',
    'TAG_ALONG', 'DRAG_ALONG', 'ROFR', 'LOCK_UP',
    'CAPEX_THRESHOLD', 'DEBT_LIMIT', 'RESERVED_MATTERS',
    'BUDGET_CONTROL', 'RPT_CONTROL', 'DIVIDEND_POLICY', 'COC',
    'SINDICACION_VOTO'
  )),
  materia_ambito JSONB NOT NULL DEFAULT '[]',
  titulares JSONB NOT NULL DEFAULT '[]',
  umbral_activacion NUMERIC,
  capital_minimo_pct NUMERIC,
  titular_veto TEXT,
  condicion_detallada TEXT,
  ventana_respuesta_dias INT,
  estatutarizada BOOLEAN DEFAULT false,
  efecto_incumplimiento TEXT CHECK (efecto_incumplimiento IN (
    'ALERTA', 'BLOQUEO_PACTO', 'MEDIACION', 'ARBITRAJE'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: pacto_evaluacion_results (WORM — no UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS pacto_evaluacion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  pacto_id UUID NOT NULL REFERENCES pactos_parasociales(id),
  pacto_ok BOOLEAN NOT NULL,
  explain JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- WORM guard function
CREATE OR REPLACE FUNCTION worm_guard_pacto_eval() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'WORM violation: % on % is prohibited', TG_OP, TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_worm_pacto_eval
  BEFORE UPDATE OR DELETE ON pacto_evaluacion_results
  FOR EACH ROW EXECUTE FUNCTION worm_guard_pacto_eval();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pactos_entity ON pactos_parasociales(entity_id);
CREATE INDEX IF NOT EXISTS idx_pactos_tenant ON pactos_parasociales(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_clausulas_pacto ON pacto_clausulas(pacto_id);
CREATE INDEX IF NOT EXISTS idx_eval_agreement ON pacto_evaluacion_results(agreement_id);

-- RLS
ALTER TABLE pactos_parasociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacto_clausulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacto_evaluacion_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_pactos ON pactos_parasociales
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE POLICY tenant_isolation_clausulas ON pacto_clausulas
  USING (
    pacto_id IN (
      SELECT id FROM pactos_parasociales
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    )
  );

CREATE POLICY tenant_isolation_eval_results ON pacto_evaluacion_results
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
