-- Migration 000037: Sprint F — jurisdiction_rule_sets schema fix + ES/PT/BR/MX seed
-- Adds missing columns and seeds rule sets for all ARGA jurisdictions.

-- ── 1. Extend schema ─────────────────────────────────────────────────────────

ALTER TABLE jurisdiction_rule_sets
  ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS rule_set_version TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS legal_reference TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT;

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE jurisdiction_rule_sets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jurisdiction_rule_sets'
      AND policyname = 'jurisdiction_rule_sets_tenant_isolation'
  ) THEN
    CREATE POLICY jurisdiction_rule_sets_tenant_isolation
      ON jurisdiction_rule_sets FOR ALL
      USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
  END IF;
END $$;

-- ── 3. Seed: España — LSC ─────────────────────────────────────────────────────

-- ES × SA — Junta General
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'ES', 'SA', 'JUNTA_GENERAL',
  '1.0', 'RD Leg. 1/2010 (LSC) — art. 176, 193, 194', 'España SA — Junta General',
  false, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 30,
    "notice_min_days_second_call": 10,
    "second_call_gap_min_hours": 24,
    "publication_channels": ["BORME"],
    "quorum": {
      "first_call_pct": 25,
      "second_call_pct": null,
      "art194_applies": true
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds",
      "second_call_between_25_50": "two_thirds"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": true,
      "scope": ["board", "shareholders"]
    },
    "registry_submission": {
      "requires_notarial": "conditional",
      "deadline_days_from_deed": 30
    },
    "books": {
      "legalization_deadline_days_after_year_end": 120,
      "legalization_channel": "TELEMATICA"
    }
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'ES' AND company_form = 'SA' AND typology_code = 'JUNTA_GENERAL'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- ES × SA — Consejo de Administración
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'ES', 'SA', 'CONSEJO_ADMINISTRACION',
  '1.0', 'RD Leg. 1/2010 (LSC) — art. 247', 'España SA — Consejo de Administración',
  false, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 3,
    "notice_min_days_second_call": null,
    "second_call_gap_min_hours": null,
    "publication_channels": [],
    "quorum": {
      "first_call_pct": 50,
      "second_call_pct": null,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "absolute"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": false,
      "scope": ["board"]
    },
    "registry_submission": {
      "requires_notarial": "conditional",
      "deadline_days_from_deed": 30
    },
    "books": {
      "legalization_deadline_days_after_year_end": 120,
      "legalization_channel": "TELEMATICA"
    }
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'ES' AND company_form = 'SA' AND typology_code = 'CONSEJO_ADMINISTRACION'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- ES × SL — Junta General
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'ES', 'SL', 'JUNTA_GENERAL',
  '1.0', 'RD Leg. 1/2010 (LSC) — art. 166, 179, 198', 'España SL — Junta General',
  false, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 15,
    "notice_min_days_second_call": 5,
    "second_call_gap_min_hours": 1,
    "publication_channels": [],
    "quorum": {
      "first_call_pct": 0,
      "second_call_pct": null,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": false,
      "scope": ["board", "shareholders"]
    },
    "registry_submission": {
      "requires_notarial": "conditional",
      "deadline_days_from_deed": 30
    },
    "books": {
      "legalization_deadline_days_after_year_end": 120,
      "legalization_channel": "TELEMATICA"
    }
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'ES' AND company_form = 'SL' AND typology_code = 'JUNTA_GENERAL'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- ── 4. Seed: Portugal — CSC ──────────────────────────────────────────────────

-- PT × SA — Assembleia Geral
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'PT', 'SA', 'ASSEMBLEIA_GERAL',
  '1.0', 'DL 262/86 (CSC) — art. 376, 383, 386', 'Portugal SA — Assembleia Geral',
  true, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 21,
    "notice_min_days_second_call": 14,
    "second_call_gap_min_hours": 24,
    "publication_channels": ["JORNAL_OFICIAL"],
    "quorum": {
      "first_call_pct": 33,
      "second_call_pct": 0,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": true,
      "scope": ["board", "shareholders"]
    },
    "registry_submission": {
      "requires_notarial": "conditional",
      "deadline_days_from_deed": 60
    },
    "books": {
      "legalization_deadline_days_after_year_end": 180,
      "legalization_channel": "PRESENCIAL"
    },
    "statutory_note": "Plazos confirmar con estatutos de la entidad (statutory_override=true)"
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'PT' AND company_form = 'SA' AND typology_code = 'ASSEMBLEIA_GERAL'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- PT × LDA — Assembleia de Sócios
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'PT', 'LDA', 'ASSEMBLEIA_SOCIOS',
  '1.0', 'DL 262/86 (CSC) — art. 248, 265, 270-G', 'Portugal Lda — Assembleia de Sócios',
  true, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 15,
    "notice_min_days_second_call": 8,
    "second_call_gap_min_hours": 24,
    "publication_channels": [],
    "quorum": {
      "first_call_pct": 50,
      "second_call_pct": 0,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": true,
      "scope": ["shareholders"]
    },
    "registry_submission": {
      "requires_notarial": false,
      "deadline_days_from_deed": 60
    },
    "books": {
      "legalization_deadline_days_after_year_end": 180,
      "legalization_channel": "PRESENCIAL"
    },
    "statutory_note": "Plazos confirmar con estatutos (statutory_override=true). Sócio único: decisão escrita basta (CSC art. 270-G)."
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'PT' AND company_form = 'LDA' AND typology_code = 'ASSEMBLEIA_SOCIOS'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- ── 5. Seed: Brasil — Lei das SA / Código Civil ──────────────────────────────

-- BR × SA — Assembleia Geral
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'BR', 'SA', 'ASSEMBLEIA_GERAL',
  '1.0', 'Lei 6.404/1976 (Lei das SA) — art. 121, 135, 136', 'Brasil SA — Assembleia Geral',
  true, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 8,
    "notice_min_days_second_call": 5,
    "second_call_gap_min_hours": 24,
    "publication_channels": ["DIARIO_OFICIAL", "JORNAL"],
    "quorum": {
      "first_call_pct": 25,
      "second_call_pct": 0,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds"
    },
    "allows_universal": false,
    "allows_written_resolution": {
      "enabled": false,
      "requires_unanimity": false,
      "scope": []
    },
    "registry_submission": {
      "requires_notarial": true,
      "deadline_days_from_deed": 30
    },
    "books": {
      "legalization_deadline_days_after_year_end": 120,
      "legalization_channel": "PRESENCIAL"
    },
    "statutory_note": "Seguradoras: SUSEP pode exigir comunicação prévia. statutory_override=true."
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'BR' AND company_form = 'SA' AND typology_code = 'ASSEMBLEIA_GERAL'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- BR × LTDA — Reunião de Sócios
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'BR', 'LTDA', 'REUNIAO_SOCIOS',
  '1.0', 'Lei 10.406/2002 (Código Civil) — art. 1.072, 1.076', 'Brasil Ltda — Reunião de Sócios',
  true, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 8,
    "notice_min_days_second_call": 5,
    "second_call_gap_min_hours": 0,
    "publication_channels": [],
    "quorum": {
      "first_call_pct": 75,
      "second_call_pct": 0,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "three_quarters"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": true,
      "scope": ["shareholders"]
    },
    "registry_submission": {
      "requires_notarial": false,
      "deadline_days_from_deed": 30
    },
    "books": {
      "legalization_deadline_days_after_year_end": 90,
      "legalization_channel": "PRESENCIAL"
    },
    "statutory_note": "SLU: sócio único pode decidir por escrito sem reunião (CC art. 1.072 §1)."
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'BR' AND company_form = 'LTDA' AND typology_code = 'REUNIAO_SOCIOS'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- ── 6. Seed: México — LGSM ───────────────────────────────────────────────────

-- MX × SA_CV — Asamblea General
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'MX', 'SA_CV', 'ASAMBLEA_GENERAL',
  '1.0', 'LGSM — DOF 1934 (reforma 2016) art. 178, 189, 190', 'México SA de CV — Asamblea General',
  false, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 15,
    "notice_min_days_second_call": 8,
    "second_call_gap_min_hours": 24,
    "publication_channels": ["PSM"],
    "quorum": {
      "first_call_pct": 50,
      "second_call_pct": 0,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds",
      "extraordinary_first_call": 75,
      "extraordinary_second_call": 50
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": false,
      "requires_unanimity": false,
      "scope": []
    },
    "registry_submission": {
      "requires_notarial": true,
      "deadline_days_from_deed": 15
    },
    "books": {
      "legalization_deadline_days_after_year_end": 90,
      "legalization_channel": "PRESENCIAL"
    },
    "statutory_note": "Escritura notarial obligatoria para toda inscripción RPC. CNSF puede requerir autorización previa."
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'MX' AND company_form = 'SA_CV' AND typology_code = 'ASAMBLEA_GENERAL'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- MX × SRL_CV — Junta de Socios
INSERT INTO jurisdiction_rule_sets (
  tenant_id, jurisdiction, company_form, typology_code,
  rule_set_version, legal_reference, name,
  statutory_override, is_active, pack_id, rule_config
)
SELECT
  '00000000-0000-0000-0000-000000000001', 'MX', 'SRL_CV', 'JUNTA_SOCIOS',
  '1.0', 'LGSM — art. 79 ss.', 'México S. de RL de CV — Junta de Socios',
  false, true, NULL,
  '{
    "version": "1.0",
    "notice_min_days_first_call": 8,
    "notice_min_days_second_call": 5,
    "second_call_gap_min_hours": 24,
    "publication_channels": [],
    "quorum": {
      "first_call_pct": 50,
      "second_call_pct": 0,
      "art194_applies": false
    },
    "majority": {
      "ordinary": "simple",
      "structural": "two_thirds"
    },
    "allows_universal": true,
    "allows_written_resolution": {
      "enabled": true,
      "requires_unanimity": true,
      "scope": ["shareholders"]
    },
    "registry_submission": {
      "requires_notarial": false,
      "deadline_days_from_deed": 30
    },
    "books": {
      "legalization_deadline_days_after_year_end": 90,
      "legalization_channel": "PRESENCIAL"
    }
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jurisdiction_rule_sets
  WHERE jurisdiction = 'MX' AND company_form = 'SRL_CV' AND typology_code = 'JUNTA_SOCIOS'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
);

-- ── Verify ───────────────────────────────────────────────────────────────────
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM jurisdiction_rule_sets
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
  IF cnt < 7 THEN
    RAISE WARNING 'jurisdiction_rule_sets seed: expected at least 7 rows, got %', cnt;
  END IF;
END $$;
