-- Migration 000038: Sprint F — Filial entities BR/MX/PT + governing bodies
-- Seeds ARGA Seguros subsidiaries in Brazil, Mexico, and Portugal.
-- Parent: ARGA Seguros S.A. (6d7ed736-f263-4531-a59d-c6ca0cd41602)

-- ── 0. Person records (PJ) for filiales ──────────────────────────────────────
-- entities.person_id is NOT NULL; create PJ persons first.

INSERT INTO persons (id, tenant_id, full_name, denomination, person_type)
VALUES
  (
    '00000000-0000-0000-0000-000000000060',
    '00000000-0000-0000-0000-000000000001',
    'ARGA Seguros Brasil Ltda.',
    'ARGA Seguros Brasil Ltda.',
    'PJ'
  ),
  (
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000001',
    'ARGA Seguros México S.A. de C.V.',
    'ARGA Seguros México S.A. de C.V.',
    'PJ'
  ),
  (
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000001',
    'ARGA Seguros Portugal, Unipessoal Lda.',
    'ARGA Seguros Portugal, Unipessoal Lda.',
    'PJ'
  )
ON CONFLICT (id) DO NOTHING;

-- ── 1. Filial entities ────────────────────────────────────────────────────────

INSERT INTO entities (
  id, tenant_id, slug, legal_name, common_name,
  jurisdiction, legal_form, entity_status, materiality,
  es_unipersonal, es_cotizada, tipo_social, ownership_percentage,
  parent_entity_id, person_id
)
VALUES
  -- Brasil
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000001',
    'arga-brasil-seguros',
    'ARGA Seguros Brasil Ltda.',
    'ARGA Brasil',
    'BR', 'SOCIEDADE LIMITADA UNIPESSOAL', 'Active', 'High',
    true, false, 'LTDA', 100.0,
    '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    '00000000-0000-0000-0000-000000000060'
  ),
  -- México
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000001',
    'arga-mexico-seguros',
    'ARGA Seguros México S.A. de C.V.',
    'ARGA México',
    'MX', 'SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE', 'Active', 'High',
    true, false, 'SA_CV', 100.0,
    '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    '00000000-0000-0000-0000-000000000061'
  ),
  -- Portugal
  (
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000001',
    'arga-portugal-seguros',
    'ARGA Seguros Portugal, Unipessoal Lda.',
    'ARGA Portugal',
    'PT', 'SOCIEDADE POR QUOTAS UNIPESSOAL', 'Active', 'High',
    true, false, 'LDA', 100.0,
    '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    '00000000-0000-0000-0000-000000000062'
  )
ON CONFLICT (id) DO NOTHING;

-- ── 2. Governing bodies ───────────────────────────────────────────────────────

INSERT INTO governing_bodies (
  id, tenant_id, entity_id, slug, name, body_type, config, quorum_rule
)
VALUES
  -- Brasil: Reunião de Sócios (Ltda.)
  (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030',
    'reuniao-socios-arga-brasil',
    'Reunião de Sócios ARGA Brasil',
    'JUNTA',
    '{"jurisdiction":"BR","company_form":"LTDA","typology":"REUNIAO_SOCIOS"}'::jsonb,
    '{"quorum_pct":75,"second_call_pct":0}'::jsonb
  ),
  -- México: Asamblea General de Accionistas
  (
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000031',
    'asamblea-general-arga-mexico',
    'Asamblea General ARGA México',
    'JUNTA',
    '{"jurisdiction":"MX","company_form":"SA_CV","typology":"ASAMBLEA_GENERAL"}'::jsonb,
    '{"quorum_pct":50,"second_call_pct":0}'::jsonb
  ),
  -- Portugal: Assembleia de Sócios (Lda.)
  (
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000032',
    'assembleia-socios-arga-portugal',
    'Assembleia de Sócios ARGA Portugal',
    'JUNTA',
    '{"jurisdiction":"PT","company_form":"LDA","typology":"ASSEMBLEIA_SOCIOS"}'::jsonb,
    '{"quorum_pct":50,"second_call_pct":0}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- ── 3. Demo agreements (pending) for filiales ─────────────────────────────────
-- Creates demo DRAFT agreements per filial so acuerdos_pendientes > 0

INSERT INTO agreements (
  id, tenant_id, entity_id, agreement_kind, matter_class,
  adoption_mode, status, decision_date
)
VALUES
  -- Brasil: nombramiento director + aprobación cuentas
  (
    '00000000-0000-0000-0000-000000000050',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030',
    'NOMBRAMIENTO_DIRECTOR', 'ORDINARIA',
    'UNIPERSONAL_SOCIO', 'DRAFT', CURRENT_DATE
  ),
  (
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030',
    'APROBACION_CUENTAS', 'ORDINARIA',
    'UNIPERSONAL_SOCIO', 'DRAFT', CURRENT_DATE
  ),
  -- México: aprobación cuentas + nombramiento consejero
  (
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000031',
    'APROBACION_CUENTAS', 'ORDINARIA',
    'UNIPERSONAL_SOCIO', 'DRAFT', CURRENT_DATE
  ),
  (
    '00000000-0000-0000-0000-000000000053',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000031',
    'NOMBRAMIENTO_CONSEJERO', 'ORDINARIA',
    'UNIPERSONAL_SOCIO', 'CERTIFIED', CURRENT_DATE
  ),
  -- Portugal: nombramiento administrador único
  (
    '00000000-0000-0000-0000-000000000054',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000032',
    'NOMBRAMIENTO_ADMINISTRADOR', 'ORDINARIA',
    'UNIPERSONAL_SOCIO', 'ADOPTED', CURRENT_DATE
  )
ON CONFLICT (id) DO NOTHING;

-- ── Verify ────────────────────────────────────────────────────────────────────
DO $$
DECLARE cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM entities
  WHERE id IN (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000032'
  );
  IF cnt < 3 THEN
    RAISE WARNING 'Filial entities seed: expected 3, got %', cnt;
  END IF;
END $$;
