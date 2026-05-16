-- Ola 3 F3 seed: agreements adicionales (aprobaciones/revisiones de políticas) + bridge policy_agreements
DO $$
DECLARE
  T uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  E uuid := '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid;   -- ARGA Seguros S.A.
  CDA uuid := 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'::uuid; -- Consejo de Administración
  JGA uuid := 'e288fe36-3846-49ba-91d8-89fe35405b50'::uuid; -- Junta General

  -- Holders for new agreement IDs
  a_pr001 uuid; a_pr002 uuid; a_pr005 uuid; a_pr008 uuid;
  a_pr009 uuid; a_pr015 uuid; a_pr018 uuid; a_pr024 uuid; a_pr025 uuid;

  -- Existing agreement
  a_mod_est uuid := 'b7f8cd55-c1c6-4586-a7ec-3be0dce34724'::uuid;
BEGIN
  -- Agreements que aprueban/revisan políticas (adoption_mode=MEETING, ORDINARIA salvo estatutos)
  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Aprobación de la Política General de Gobierno Corporativo (PR-001) versión 2026.',
     'El Consejo aprueba por unanimidad la Política PR-001 v2026, con entrada en vigor 01/05/2026.',
     '2026-03-18','2026-05-01','LSC art.529 bis; Código Buen Gobierno CNMV 2020')
     RETURNING id INTO a_pr001;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Revisión anual de la Política de Gestión de Riesgos (PR-002) conforme Solvencia II.',
     'Se aprueba la nueva versión de PR-002 incorporando apetito actualizado y límites.',
     '2026-02-25','2026-03-01','Solvencia II art.44; PR-025')
     RETURNING id INTO a_pr002;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Aprobación Política de Remuneraciones (PR-005) para consejeros y alta dirección.',
     'Aprobada por el CdA a propuesta de la Comisión de Retribuciones; se somete a Junta.',
     '2026-01-28','2026-04-15','LSC art.529 novodecies')
     RETURNING id INTO a_pr005;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Aprobación marco de Resiliencia Operativa Digital DORA (PR-008) y plan de implantación.',
     'Se aprueba PR-008 v1.0 con KPIs de resiliencia operativa alineados al Reglamento (UE) 2022/2554.',
     '2026-03-04','2026-03-15','Reglamento (UE) 2022/2554 — DORA')
     RETURNING id INTO a_pr008;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'PROPOSED',
     'Revisión bianual Política de Protección de Datos (PR-009) por impacto IA Act.',
     '',
     '2026-04-22',NULL,'RGPD art.24-25; LOPDGDD')
     RETURNING id INTO a_pr009;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Aprobación Política de Sostenibilidad y ESG (PR-015) conforme CSRD.',
     'Aprobada Política PR-015 v2026 alineada con ESRS y expectativas supervisoras.',
     '2026-02-11','2026-03-01','Directiva (UE) 2022/2464 CSRD; ESRS')
     RETURNING id INTO a_pr015;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', true, 'MEETING', 'CERTIFIED',
     'Renovación Norma de Delegación de Poderes (PR-018) y facultades del Consejero Delegado.',
     'Se delegan facultades generales y se revoca delegación anterior conforme PR-018 v2026.',
     '2026-01-14','2026-02-01','LSC art.249')
     RETURNING id INTO a_pr018;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Aprobación Política de IA Responsable (PR-024) frente al Reglamento IA UE.',
     'Aprobada PR-024 v1.0 con inventario de sistemas y gobierno de riesgos IA.',
     '2026-04-01','2026-05-01','Reglamento (UE) 2024/1689 — IA Act')
     RETURNING id INTO a_pr024;

  INSERT INTO agreements (id, tenant_id, entity_id, body_id, agreement_kind, matter_class, inscribable, adoption_mode, status, proposal_text, decision_text, decision_date, effective_date, statutory_basis)
  VALUES
    (gen_random_uuid(), T, E, CDA, 'APROBACION_POLITICA', 'ORDINARIA', false, 'MEETING', 'ADOPTED',
     'Aprobación Marco de Apetito de Riesgo (PR-025) ejercicio 2026.',
     'Se aprueba el RAF 2026 con tolerancias actualizadas y métricas de seguimiento trimestral.',
     '2026-01-28','2026-01-28','Solvencia II art.44; PR-002')
     RETURNING id INTO a_pr025;

  -- Bridge policy_agreements (N:M)
  INSERT INTO policy_agreements (tenant_id, policy_id, agreement_id, relationship_kind, notes) VALUES
    (T, (SELECT id FROM policies WHERE policy_code='PR-001' AND tenant_id=T), a_pr001, 'APPROVES', 'Aprobación v2026'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-002' AND tenant_id=T), a_pr002, 'AMENDS',   'Revisión anual'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-005' AND tenant_id=T), a_pr005, 'APPROVES', 'CdA propone, Junta aprueba'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-008' AND tenant_id=T), a_pr008, 'APPROVES', 'Plan DORA'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-009' AND tenant_id=T), a_pr009, 'AMENDS',   'Revisión bianual por IA Act'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-015' AND tenant_id=T), a_pr015, 'APPROVES', 'Alineación CSRD'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-018' AND tenant_id=T), a_pr018, 'AMENDS',   'Renovación facultades delegadas'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-024' AND tenant_id=T), a_pr024, 'APPROVES', 'Nueva política IA'),
    (T, (SELECT id FROM policies WHERE policy_code='PR-025' AND tenant_id=T), a_pr025, 'APPROVES', 'RAF 2026'),
    -- Existing MOD_ESTATUTOS vincula con PR-001 (gobierno corporativo)
    (T, (SELECT id FROM policies WHERE policy_code='PR-001' AND tenant_id=T), a_mod_est, 'AMENDS', 'Modificación estatutaria coherente con PR-001');
END $$;
