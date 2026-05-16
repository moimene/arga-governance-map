-- ============================================================
-- Migration 20260426_000044 — AIMS 360 ARGA demo seed
-- ============================================================
-- Idempotent seed for the first persisted AIMS slice.

INSERT INTO ai_systems (
  id, tenant_id, aims_reference_code, name, description, risk_level, status,
  system_type, vendor, deployment_date, use_case
) VALUES
  (
    '90000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'AIS-ARGA-001',
    'Motor de triaje de siniestros auto',
    'Clasifica declaraciones de siniestro, prioriza expedientes y propone ruta de gestion con revision humana.',
    'Alto',
    'En revision',
    'Gradient boosting + reglas expertas',
    'ARGA Analytics',
    '2025-10-14',
    'Siniestros Auto'
  ),
  (
    '90000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'AIS-ARGA-002',
    'Asistente de suscripcion patrimonial',
    'Apoya al equipo tecnico en seleccion de coberturas, exclusiones y alertas de riesgo en productos patrimoniales.',
    'Alto',
    'Pendiente',
    'LLM con RAG documental y scoring actuarial',
    'ARGA Analytics',
    '2026-02-03',
    'Suscripcion Empresas'
  ),
  (
    '90000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'AIS-ARGA-003',
    'Detector de fraude en reembolsos salud',
    'Identifica patrones anomalos en facturas, proveedores y frecuencia de reembolso para investigacion antifraude.',
    'Alto',
    'Conforme',
    'Red de grafos + deteccion de anomalias',
    'ARGA Analytics',
    '2025-06-19',
    'Salud'
  )
ON CONFLICT (id) DO UPDATE SET
  aims_reference_code = EXCLUDED.aims_reference_code,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  status = EXCLUDED.status,
  system_type = EXCLUDED.system_type,
  vendor = EXCLUDED.vendor,
  deployment_date = EXCLUDED.deployment_date,
  use_case = EXCLUDED.use_case

INSERT INTO aims_system_versions (
  id, tenant_id, system_id, version_label, release_stage, status, effective_from,
  change_summary, model_snapshot, dataset_snapshot, control_snapshot,
  technical_file_status, retention_until
) VALUES
  (
    '91000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    'v3.4.2',
    'PRODUCTION',
    'ACTIVE',
    '2025-10-14',
    'Release productiva con reglas de supervision humana y umbrales antifraude actualizados.',
    '{"model_type":"Gradient boosting","validation_auc":0.91,"bias_review":"completed"}'::jsonb,
    '{"training_window":"2024-01/2025-08","pii_categories":["claims","vehicle","injury"],"lawful_basis":"contract/legal obligation"}'::jsonb,
    '{"guardrails":9,"human_oversight":"mandatory for rejection, fraud or bodily injury"}'::jsonb,
    'READY_TO_SEAL',
    '2036-04-26'
  ),
  (
    '91000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000002',
    'v1.8.0-rc',
    'VALIDATION',
    'ACTIVE',
    '2026-02-03',
    'Release candidate pendiente de DPIA y validacion de controles de salida.',
    '{"model_type":"LLM RAG","eval_set":"patrimonial underwriting","hallucination_rate":"1.8%"}'::jsonb,
    '{"sources":["manuales tecnicos","historico polizas","scoring actuarial"],"lawful_basis":"contract"}'::jsonb,
    '{"guardrails":11,"human_oversight":"dual technical validation before proposal"}'::jsonb,
    'PENDING',
    '2036-04-26'
  ),
  (
    '91000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000003',
    'v2.7.5',
    'PRODUCTION',
    'ACTIVE',
    '2025-06-19',
    'Release estable con evidencias antifraude revisadas por Cumplimiento.',
    '{"model_type":"Graph analytics","precision_at_k":0.84,"bias_review":"completed"}'::jsonb,
    '{"sources":["claims","providers","billing"],"lawful_basis":"fraud prevention"}'::jsonb,
    '{"guardrails":8,"human_oversight":"fraud investigator validates operational block"}'::jsonb,
    'READY_TO_SEAL',
    '2036-04-26'
  )
ON CONFLICT (tenant_id, system_id, version_label) DO UPDATE SET
  release_stage = EXCLUDED.release_stage,
  status = EXCLUDED.status,
  effective_from = EXCLUDED.effective_from,
  change_summary = EXCLUDED.change_summary,
  model_snapshot = EXCLUDED.model_snapshot,
  dataset_snapshot = EXCLUDED.dataset_snapshot,
  control_snapshot = EXCLUDED.control_snapshot,
  technical_file_status = EXCLUDED.technical_file_status,
  retention_until = EXCLUDED.retention_until,
  updated_at = now()

INSERT INTO aims_requirement_catalog (
  id, tenant_id, framework, requirement_code, article_ref, title, description,
  applicability, payload, status
) VALUES
  (
    '92000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'AI Act',
    'REQ-AIA-009',
    'Art. 9',
    'Sistema iterativo de gestion de riesgos',
    'Proceso continuo para identificar, analizar, evaluar y tratar riesgos de IA.',
    '{"risk_levels":["Alto","Inaceptable"]}'::jsonb,
    '{"evidence":["risk register","treatment decision","residual risk approval"]}'::jsonb,
    'ACTIVE'
  ),
  (
    '92000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'AI Act',
    'REQ-AIA-011',
    'Art. 11 + Anexo IV',
    'Documentacion tecnica por version',
    'Expediente tecnico vivo y reconstruible por version del sistema.',
    '{"risk_levels":["Alto"]}'::jsonb,
    '{"evidence":["technical file","model card","dataset lineage","validation report"]}'::jsonb,
    'ACTIVE'
  ),
  (
    '92000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'AI Act',
    'REQ-AIA-014',
    'Art. 14',
    'Supervision humana efectiva',
    'Controles para que personas autorizadas supervisen decisiones relevantes.',
    '{"risk_levels":["Alto","Limitado"]}'::jsonb,
    '{"evidence":["oversight procedure","exception logs","training records"]}'::jsonb,
    'ACTIVE'
  ),
  (
    '92000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'ISO 42001',
    'REQ-ISO-9',
    'Clausula 9',
    'Evaluacion de desempeno y auditoria interna',
    'Medicion, analisis, auditoria y revision del sistema de gestion de IA.',
    '{"all_systems":true}'::jsonb,
    '{"evidence":["internal audit","management review","corrective actions"]}'::jsonb,
    'ACTIVE'
  )
ON CONFLICT (tenant_id, framework, requirement_code) DO UPDATE SET
  article_ref = EXCLUDED.article_ref,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  applicability = EXCLUDED.applicability,
  payload = EXCLUDED.payload,
  status = EXCLUDED.status,
  updated_at = now()

INSERT INTO aims_control_catalog (
  id, tenant_id, control_code, name, domain, description, owner_role, payload, status
) VALUES
  (
    '93000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'AIMS-CTRL-001',
    'Gate de aprobacion de version',
    'Governance',
    'Valida riesgo, expediente tecnico y supervision humana antes de produccion.',
    'Comite de Gobernanza IA',
    '{"frequency":"per release"}'::jsonb,
    'ACTIVE'
  ),
  (
    '93000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'AIMS-CTRL-002',
    'Monitorizacion de drift y umbrales',
    'Post-market',
    'Supervisa drift, rendimiento y alertas de deterioro post-market.',
    'Owner tecnico IA',
    '{"frequency":"monthly"}'::jsonb,
    'ACTIVE'
  )
ON CONFLICT (tenant_id, control_code) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description,
  owner_role = EXCLUDED.owner_role,
  payload = EXCLUDED.payload,
  status = EXCLUDED.status,
  updated_at = now()

INSERT INTO aims_requirement_checks (
  id, tenant_id, system_id, version_id, requirement_id, status, result,
  checked_at, due_at, evidence_refs, payload, retention_until
) VALUES
  ('95000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','Conforme','Riesgo residual validado por Risk Manager IA.','2026-04-24','2026-05-21','["risk-register:AIS-ARGA-001:v3.4.2"]'::jsonb,'{"score":"accepted"}'::jsonb,'2036-04-26'),
  ('95000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000002','Conforme','Expediente tecnico listo para sellado.','2026-04-24','2026-05-21','["technical-file:AIS-ARGA-001:v3.4.2"]'::jsonb,'{"annex_iv":"complete"}'::jsonb,'2036-04-26'),
  ('95000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000003','Conforme','Revision humana obligatoria documentada.','2026-04-24','2026-05-21','["oversight:AIS-ARGA-001:v3.4.2"]'::jsonb,'{"oversight":"mandatory"}'::jsonb,'2036-04-26'),
  ('95000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','Pendiente','Pendiente cierre de DPIA y validacion de hallucination controls.','2026-04-24','2026-05-03','[]'::jsonb,'{"blocker":"DPIA"}'::jsonb,'2036-04-26')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  result = EXCLUDED.result,
  checked_at = EXCLUDED.checked_at,
  due_at = EXCLUDED.due_at,
  evidence_refs = EXCLUDED.evidence_refs,
  payload = EXCLUDED.payload,
  retention_until = EXCLUDED.retention_until,
  updated_at = now()

INSERT INTO aims_technical_file_sections (
  id, tenant_id, system_id, version_id, section_code, title, status,
  content, evidence_refs, reviewed_at, retention_until
) VALUES
  ('94000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','AIV-01','Descripcion general del sistema','Conforme','{"annex":"Anexo IV.1","summary":"Sistema de triaje auto con supervision humana"}'::jsonb,'["architecture:AIS-ARGA-001:v3.4.2"]'::jsonb,'2026-04-24','2036-04-26'),
  ('94000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','AIV-02','Datos, entrenamiento y validacion','Conforme','{"annex":"Anexo IV.2","lineage":"claims 2024-2025"}'::jsonb,'["dataset-lineage:AIS-ARGA-001:v3.4.2"]'::jsonb,'2026-04-24','2036-04-26'),
  ('94000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','AIV-03','Gestion de riesgos y controles','Conforme','{"annex":"Anexo IV.3","residualRisk":"Medio aceptado"}'::jsonb,'["risk-control:AIS-ARGA-001:v3.4.2"]'::jsonb,'2026-04-24','2036-04-26'),
  ('94000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','AIV-04','Supervision humana y logging','Conforme','{"annex":"Anexo IV.4","oversight":"mandatory review for rejection/fraud/injury"}'::jsonb,'["oversight-log:AIS-ARGA-001:v3.4.2"]'::jsonb,'2026-04-24','2036-04-26'),
  ('94000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','AIV-01','Descripcion general del sistema','Pendiente','{"annex":"Anexo IV.1","summary":"Asistente patrimonial en validacion"}'::jsonb,'[]'::jsonb,NULL,'2036-04-26')
ON CONFLICT (tenant_id, system_id, version_id, section_code) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  content = EXCLUDED.content,
  evidence_refs = EXCLUDED.evidence_refs,
  reviewed_at = EXCLUDED.reviewed_at,
  retention_until = EXCLUDED.retention_until,
  updated_at = now()

INSERT INTO aims_post_market_plans (
  id, tenant_id, system_id, version_id, plan_name, cadence, monitoring_scope,
  escalation_rules, status, approved_at, retention_until
) VALUES
  (
    '96000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    'Plan post-market triaje auto v3.4.2',
    'Mensual',
    '{"metrics":["drift","false_rejection","human_override"],"population":"claims auto"}'::jsonb,
    '{"critical":"notify AI Governance Committee within 5 business days"}'::jsonb,
    'APPROVED',
    '2026-04-24',
    '2036-04-26'
  )
ON CONFLICT (id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  cadence = EXCLUDED.cadence,
  monitoring_scope = EXCLUDED.monitoring_scope,
  escalation_rules = EXCLUDED.escalation_rules,
  status = EXCLUDED.status,
  approved_at = EXCLUDED.approved_at,
  retention_until = EXCLUDED.retention_until,
  updated_at = now()

INSERT INTO aims_monitoring_indicators (
  id, tenant_id, system_id, version_id, plan_id, indicator_name, metric_key,
  threshold_config, current_value, status, last_observed_at, evidence_refs,
  retention_until
) VALUES
  (
    '97000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000001',
    '96000000-0000-0000-0000-000000000001',
    'Override humano en rechazos',
    'human_override_rejection_pct',
    '{"warning":8,"critical":12,"unit":"%"}'::jsonb,
    '{"value":6.4,"unit":"%"}'::jsonb,
    'OK',
    '2026-04-24',
    '["monitoring:AIS-ARGA-001:2026-04"]'::jsonb,
    '2036-04-26'
  )
ON CONFLICT (id) DO UPDATE SET
  indicator_name = EXCLUDED.indicator_name,
  metric_key = EXCLUDED.metric_key,
  threshold_config = EXCLUDED.threshold_config,
  current_value = EXCLUDED.current_value,
  status = EXCLUDED.status,
  last_observed_at = EXCLUDED.last_observed_at,
  evidence_refs = EXCLUDED.evidence_refs,
  retention_until = EXCLUDED.retention_until,
  updated_at = now()
