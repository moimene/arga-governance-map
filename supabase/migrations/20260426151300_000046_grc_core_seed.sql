-- ============================================================
-- Migration 20260426_000046 — GRC Core ARGA demo seed
-- ============================================================
-- Idempotent demo seed for the persistent GRC backbone. It mirrors the
-- read-only GRC Core UI slice and keeps future modules on the same contracts.

DO $$
DECLARE
  v_tenant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  INSERT INTO grc_modules (
    tenant_id, id, name, description, state, route, regulations, owner,
    open_issues, critical_risks, control_coverage, evidence_count, next_milestone
  ) VALUES
    (v_tenant, 'gdpr', 'GDPR y privacidad', 'RoPA, DPIAs, DSARs, brechas, transferencias y retencion de datos personales.', 'Activo', '/grc/m/gdpr', '["RGPD","LOPDGDD","ePrivacy"]'::jsonb, 'DPO Grupo ARGA', 7, 2, 82, 31, 'Revision RoPA trimestral'),
    (v_tenant, 'cyber', 'Ciberseguridad', 'Incidentes, vulnerabilidades, SOC, activos criticos y controles de seguridad.', 'Activo', '/grc/m/cyber', '["NIS2","ISO 27001","ENS"]'::jsonb, 'CISO ARGA', 9, 3, 76, 44, 'Cierre CVE criticas abril'),
    (v_tenant, 'risk', 'Riesgos operacionales', 'ERM, KRIs, mapa de calor, controles compensatorios y planes de tratamiento.', 'Activo', '/grc/risk-360', '["ISO 31000","COSO ERM"]'::jsonb, 'CRO Grupo ARGA', 12, 5, 71, 27, 'Comite mensual de riesgos'),
    (v_tenant, 'audit', 'Auditoria interna', 'Programa anual, hallazgos, planes de accion y evidencia de cierre.', 'Activo', '/grc/m/audit', '["IIA 2024","QAIP","ISO 19011"]'::jsonb, 'Auditoria Interna', 11, 1, 79, 38, 'Seguimiento hallazgos Q2'),
    (v_tenant, 'dora', 'DORA y resiliencia ICT', 'Incidentes ICT, BCM, RTO/RPO, proveedores criticos y notificacion supervisora.', 'MVP', '/grc/m/dora', '["DORA","NIS2","ISO 22301"]'::jsonb, 'Resiliencia Operacional', 8, 2, 68, 24, 'Simulacro de incidente ICT'),
    (v_tenant, 'tprm', 'Riesgo de terceros', 'Due diligence, proveedores ICT, concentracion, subcontratacion y exit plans.', 'MVP', '/grc/tprm', '["DORA Arts. 28-30","EIOPA cloud"]'::jsonb, 'Compras y Riesgo Proveedor', 4, 1, 41, 9, 'Decision CIFA para proveedores cloud'),
    (v_tenant, 'ethics', 'Etica y canal interno', 'Canal de denuncias, investigaciones, medidas correctivas y no represalia.', 'MVP', '/grc/workflows', '["Directiva Whistleblowing","Ley 2/2023"]'::jsonb, 'Etica Corporativa', 5, 2, 58, 14, 'Acuse 7 dias y resolucion 3 meses'),
    (v_tenant, 'aml', 'AML/CFT', 'Diligencia debida, alertas, screening, operaciones sospechosas y reporting.', 'Planificado', NULL, '["6AMLD","FATF","Ley 10/2010"]'::jsonb, 'Cumplimiento Penal', 0, 0, 0, 0, 'Definir matriz de riesgo cliente'),
    (v_tenant, 'abc', 'Anticorrupcion', 'Regalos, hospitalidad, terceros, controles FCPA/UKBA e investigacion interna.', 'Planificado', NULL, '["FCPA","UK Bribery Act","ISO 37001"]'::jsonb, 'Compliance Corporativo', 0, 0, 0, 0, 'Taxonomia de controles ABC'),
    (v_tenant, 'esg', 'ESG y CSRD', 'ESRS, doble materialidad, controles de reporting y trazabilidad probatoria.', 'Planificado', NULL, '["CSRD","ESRS","Taxonomia UE"]'::jsonb, 'Sostenibilidad', 0, 0, 0, 0, 'Mapa ESRS material'),
    (v_tenant, 'competition', 'Competencia', 'Riesgos antitrust, controles de reuniones, dawn raids y formacion critica.', 'Planificado', NULL, '["TFUE 101-102","LDC"]'::jsonb, 'Legal Competencia', 0, 0, 0, 0, 'Mapa de reuniones sensibles'),
    (v_tenant, 'sanctions', 'Sanciones y export control', 'Screening, listas restrictivas, alertas geograficas y evidencias de bloqueo.', 'Planificado', NULL, '["EU Sanctions","OFAC","EAR"]'::jsonb, 'Cumplimiento Internacional', 0, 0, 0, 0, 'Diseno screening centralizado'),
    (v_tenant, 'hs', 'SST y PRL', 'Prevencion, incidentes laborales, auditorias, formacion y planes correctivos.', 'Planificado', NULL, '["Ley PRL 31/1995","ISO 45001"]'::jsonb, 'Personas y PRL', 0, 0, 0, 0, 'Catalogo minimo PRL')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    state = EXCLUDED.state,
    route = EXCLUDED.route,
    regulations = EXCLUDED.regulations,
    owner = EXCLUDED.owner,
    open_issues = EXCLUDED.open_issues,
    critical_risks = EXCLUDED.critical_risks,
    control_coverage = EXCLUDED.control_coverage,
    evidence_count = EXCLUDED.evidence_count,
    next_milestone = EXCLUDED.next_milestone,
    updated_at = now();

  INSERT INTO grc_obligations (
    tenant_id, id, module_id, framework, reference, obligation, owner, status, severity, authority, payload
  ) VALUES
    (v_tenant, 'OBL-GDPR-033', 'gdpr', 'RGPD', 'Art. 33', 'Notificar brechas de datos personales a la autoridad competente en plazo operativo.', 'DPO Grupo ARGA', 'En revision', 'Alto', 'AEPD', '{"risk":"Incumplimiento de plazo por informacion incompleta del incidente.","control":"Playbook de brecha con reloj 72h, owner DPO y evidencia minima.","evidence":"Paquete de notificacion AEPD y timeline WORM"}'::jsonb),
    (v_tenant, 'OBL-GDPR-012', 'gdpr', 'RGPD', 'Arts. 12-15', 'Responder solicitudes de derechos de interesados dentro del plazo operativo de un mes.', 'DPO Grupo ARGA', 'En revision', 'Alto', 'AEPD', '{"risk":"DSAR vencido sin respuesta completa o sin justificacion documentada.","control":"Workflow DSAR con reloj mensual, owner DPO y retencion 3/5 anos segun controversia.","evidence":"Solicitud, verificacion de identidad, respuesta y prueba de envio"}'::jsonb),
    (v_tenant, 'OBL-DORA-017', 'dora', 'DORA', 'Art. 17', 'Gestionar incidentes relacionados con ICT y clasificar severidad material.', 'Resiliencia Operacional', 'Pendiente', 'Critico', 'Supervisor financiero', '{"risk":"Clasificacion tardia de incidente ICT con impacto en continuidad.","control":"Arbol de decision de incidente grave y comite de crisis ICT.","evidence":"Registro de incidente, decision de severidad y comunicaciones"}'::jsonb),
    (v_tenant, 'OBL-LEY2-009', 'ethics', 'Ley 2/2023', 'Arts. 7-9', 'Gestionar canal interno con anonimato, acuse en 7 dias y resolucion en 3 meses.', 'Responsable del Sistema Interno', 'Pendiente', 'Critico', 'Autoridad Independiente', '{"risk":"Acuse fuera de plazo o acceso indebido a identidad protegida.","control":"Expediente segregado con logs de acceso y reloj 7d/3m.","evidence":"Acuse, actuaciones, resolucion motivada y logs"}'::jsonb),
    (v_tenant, 'OBL-NIS2-021', 'cyber', 'NIS2', 'Art. 21', 'Aplicar medidas tecnicas y organizativas de ciberseguridad proporcionales.', 'CISO ARGA', 'En revision', 'Alto', 'Autoridad sectorial', '{"risk":"Vulnerabilidad critica sin remediacion dentro de SLA.","control":"SLA CVSS, excepciones aprobadas y evidencia de parcheo.","evidence":"Reporte CVE, ticket de remediacion y prueba de cierre"}'::jsonb),
    (v_tenant, 'OBL-EIOPA-CLOUD', 'tprm', 'EIOPA cloud', 'Outsourcing cloud', 'Mantener registro y decision CIFA para proveedores cloud de funciones criticas o importantes.', 'Compras y Riesgo Proveedor', 'En revision', 'Alto', 'Supervisor financiero', '{"risk":"Proveedor cloud asociado a funcion critica sin exit plan viable.","control":"Gate CIFA con due diligence, clausulas contractuales y exit plan.","evidence":"Ficha CIFA, contrato, due diligence, notificacion y exit plan"}'::jsonb),
    (v_tenant, 'OBL-ERM-APPETITE', 'risk', 'COSO ERM', 'Risk appetite', 'Mantener apetito de riesgo aprobado por el Consejo y trazado a decisiones, KRIs y controles.', 'CRO Grupo ARGA', 'En revision', 'Medio', 'Consejo / Comite de Riesgos', '{"risk":"Decisiones operativas fuera de apetito sin escalado ni evidencia de aprobacion.","control":"Mapa de apetito versionado, aprobado y enlazado a comites.","evidence":"Acta de aprobacion, matriz de apetito y reporte KRI"}'::jsonb),
    (v_tenant, 'OBL-IIA-2024-QAIP', 'audit', 'IIA 2024', 'QAIP / EQA', 'Actualizar metodologia de auditoria interna a IIA 2024, con QAIP y evaluacion externa quinquenal.', 'Auditoria Interna', 'Pendiente', 'Alto', 'Comite de Auditoria', '{"risk":"Evaluacion de calidad sin evidencia de conformidad con el nuevo IPPF.","control":"Catalogo IIA 2024, mapping 2017-2024, QAIP y evidencias por principio.","evidence":"Mapa de estandares, plan QAIP, papeles de trabajo y conclusion del encargo"}'::jsonb)
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    framework = EXCLUDED.framework,
    reference = EXCLUDED.reference,
    obligation = EXCLUDED.obligation,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    authority = EXCLUDED.authority,
    payload = EXCLUDED.payload,
    updated_at = now();

  INSERT INTO grc_risks (
    tenant_id, id, module_id, obligation_id, title, description, inherent_severity, residual_severity, owner, status
  ) VALUES
    (v_tenant, 'RSK-GDPR-033', 'gdpr', 'OBL-GDPR-033', 'Brecha sin decision DPO dentro de 72h', 'Incumplimiento de plazo por informacion incompleta del incidente.', 'Alto', 'Medio', 'DPO Grupo ARGA', 'En revision'),
    (v_tenant, 'RSK-DORA-017', 'dora', 'OBL-DORA-017', 'Clasificacion tardia de incidente ICT', 'Incidente ICT con impacto operacional sin materialidad decidida.', 'Critico', 'Alto', 'Resiliencia Operacional', 'Pendiente'),
    (v_tenant, 'RSK-LEY2-009', 'ethics', 'OBL-LEY2-009', 'Canal interno sin segregacion de identidad', 'Acceso indebido a identidad o falta de acuse en plazo.', 'Critico', 'Alto', 'Responsable del Sistema Interno', 'Pendiente'),
    (v_tenant, 'RSK-EIOPA-CLOUD', 'tprm', 'OBL-EIOPA-CLOUD', 'Proveedor cloud CIFA sin exit plan', 'Proveedor asociado a funcion critica sin salida viable documentada.', 'Alto', 'Alto', 'Compras y Riesgo Proveedor', 'En revision')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    obligation_id = EXCLUDED.obligation_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    inherent_severity = EXCLUDED.inherent_severity,
    residual_severity = EXCLUDED.residual_severity,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_controls (
    tenant_id, id, module_id, obligation_id, risk_id, name, description, owner, frequency, status, evidence_required
  ) VALUES
    (v_tenant, 'CTRL-GDPR-BREACH', 'gdpr', 'OBL-GDPR-033', 'RSK-GDPR-033', 'Playbook brecha 72h', 'Reloj, owner DPO y decision formal notificar/no notificar.', 'DPO Grupo ARGA', 'Por evento', 'En revision', '["Timeline","Analisis DPO","Decision formal"]'::jsonb),
    (v_tenant, 'CTRL-DORA-MAJOR', 'dora', 'OBL-DORA-017', 'RSK-DORA-017', 'Arbol de decision incidente mayor', 'Clasifica materialidad y prepara reportes DORA.', 'Resiliencia Operacional', 'Por evento', 'Pendiente', '["Clasificacion","Reporte inicial","Reporte final"]'::jsonb),
    (v_tenant, 'CTRL-LEY2-CANAL', 'ethics', 'OBL-LEY2-009', 'RSK-LEY2-009', 'Gestion expediente canal interno', 'Acuse 7 dias, identidad segregada y logs de acceso.', 'Responsable del Sistema Interno', 'Por caso', 'Pendiente', '["Acuse","Logs","Resolucion motivada"]'::jsonb),
    (v_tenant, 'CTRL-CIFA-CLOUD', 'tprm', 'OBL-EIOPA-CLOUD', 'RSK-EIOPA-CLOUD', 'Gate CIFA proveedor cloud', 'Due diligence, clausulas contractuales y exit plan.', 'Compras y Riesgo Proveedor', 'Anual y por alta', 'En revision', '["Ficha CIFA","Contrato","Exit plan"]'::jsonb)
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    obligation_id = EXCLUDED.obligation_id,
    risk_id = EXCLUDED.risk_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    owner = EXCLUDED.owner,
    frequency = EXCLUDED.frequency,
    status = EXCLUDED.status,
    evidence_required = EXCLUDED.evidence_required,
    updated_at = now();

  INSERT INTO grc_control_tests (
    tenant_id, id, control_id, module_id, status, result, executed_by, executed_at, next_test_at, evidence_refs, retention_until
  ) VALUES
    (v_tenant, 'TEST-GDPR-BREACH-2026Q2', 'CTRL-GDPR-BREACH', 'gdpr', 'En revision', 'Prueba parcial: decision DPO pendiente de evidencia WORM.', 'DPO Grupo ARGA', '2026-04-24T10:00:00+02', '2026-07-24T10:00:00+02', '["EVD-GRC-001","EVD-GRC-005"]'::jsonb, '2032-04-26'),
    (v_tenant, 'TEST-DORA-MAJOR-2026Q2', 'CTRL-DORA-MAJOR', 'dora', 'Pendiente', 'Simulacro ICT mayor pendiente de reporte final.', 'Resiliencia Operacional', '2026-04-22T12:00:00+02', '2026-06-22T12:00:00+02', '["EVD-GRC-002"]'::jsonb, '2036-04-26'),
    (v_tenant, 'TEST-CIFA-CLOUD-2026Q2', 'CTRL-CIFA-CLOUD', 'tprm', 'En revision', 'Primer proveedor con CIFA probable sin exit plan aprobado.', 'Compras y Riesgo Proveedor', '2026-04-24T09:00:00+02', '2026-06-15T09:00:00+02', '["EVD-GRC-007"]'::jsonb, '2032-04-26')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    status = EXCLUDED.status,
    result = EXCLUDED.result,
    executed_by = EXCLUDED.executed_by,
    executed_at = EXCLUDED.executed_at,
    next_test_at = EXCLUDED.next_test_at,
    evidence_refs = EXCLUDED.evidence_refs,
    retention_until = EXCLUDED.retention_until,
    updated_at = now();

  INSERT INTO grc_evidence_links (
    tenant_id, id, module_id, title, object_type, linked_object, hash_sha512, retention, legal_hold, owner, status, created_at
  ) VALUES
    (v_tenant, 'EVD-GRC-001', 'gdpr', 'Paquete brecha privacidad marzo', 'Regulatory notification', 'OBL-GDPR-033', 'sha512:8e17...ac42', '6 anos', false, 'DPO Grupo ARGA', 'En revision', '2026-04-18T00:00:00+02'),
    (v_tenant, 'EVD-GRC-002', 'dora', 'Cadena WORM incidente ICT material', 'Incident evidence pack', 'OBL-DORA-017', 'sha512:21fd...910b', '10 anos', true, 'Resiliencia Operacional', 'Pendiente', '2026-04-22T00:00:00+02'),
    (v_tenant, 'EVD-GRC-003', 'cyber', 'Recertificacion de accesos Q2', 'Access review', 'OBL-ISO27001-A515', 'sha512:7b90...f18d', '6 anos', false, 'IAM Governance', 'Conforme', '2026-04-15T00:00:00+02'),
    (v_tenant, 'EVD-GRC-006', 'ethics', 'Expediente canal interno con identidad segregada', 'Whistleblowing case file', 'OBL-LEY2-009', 'sha512:0a91...7cc8', '10 anos o hold activo', true, 'Responsable del Sistema Interno', 'Pendiente', '2026-04-23T00:00:00+02'),
    (v_tenant, 'EVD-GRC-007', 'tprm', 'Registro minimo proveedor cloud critico', 'TPRM CIFA record', 'OBL-EIOPA-CLOUD', 'sha512:f1c4...aa09', 'Durante contrato + 6 anos', false, 'Compras y Riesgo Proveedor', 'En revision', '2026-04-24T00:00:00+02')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    title = EXCLUDED.title,
    object_type = EXCLUDED.object_type,
    linked_object = EXCLUDED.linked_object,
    hash_sha512 = EXCLUDED.hash_sha512,
    retention = EXCLUDED.retention,
    legal_hold = EXCLUDED.legal_hold,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_access_controls (
    tenant_id, id, role, scope, permissions, incompatible_with, evidence, status
  ) VALUES
    (v_tenant, 'RBAC-GRC-001', 'TENANT_ADMIN', 'Tenant completo', 'Gestionar usuarios, modulos, configuracion, roles y parametros globales.', 'Auditoria Interna operativa', 'Admin role assignment + aprobacion CIO/CRO', 'Conforme'),
    (v_tenant, 'RBAC-GRC-003', 'CONTROL_OWNER', 'Control y evidencia', 'Ejecutar control, adjuntar evidencia y proponer cierre de acciones.', 'CONTROL_VALIDATOR', 'Control execution trail', 'En revision'),
    (v_tenant, 'RBAC-GRC-004', 'CONTROL_VALIDATOR', 'Verificacion independiente', 'Validar efectividad, rechazar evidencia y cerrar acciones correctivas.', 'CONTROL_OWNER', 'SoD validation record', 'Pendiente'),
    (v_tenant, 'RBAC-GRC-005', 'AUDITOR', 'Cross-module read-only', 'Leer audit_log, evidencias, configuracion y trazas sin capacidad de modificacion.', 'Roles operativos de creacion', 'Audit scope assignment', 'Conforme'),
    (v_tenant, 'RBAC-GRC-007', 'DPO_PRIVACY', 'GDPR, DPIA, DSAR y brechas', 'Emitir dictamen DPO, validar notificacion/no notificacion y aprobar retencion.', 'Owner tecnico del tratamiento evaluado', 'Dictamen DPO y trazas de aprobacion', 'Conforme')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    role = EXCLUDED.role,
    scope = EXCLUDED.scope,
    permissions = EXCLUDED.permissions,
    incompatible_with = EXCLUDED.incompatible_with,
    evidence = EXCLUDED.evidence,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_retention_policies (
    tenant_id, id, object_type, regulatory_basis, retention, legal_hold_rule, purge_mode, next_run, status
  ) VALUES
    (v_tenant, 'RET-GDPR-DSAR', 'DSAR y comunicaciones de interesado', 'RGPD accountability + defensa juridica', '3 anos general / hasta 5 anos si hay reclamacion o controversia', 'Suspender purga si existe reclamacion, requerimiento AEPD o riesgo contencioso', 'Dry-run', '2026-05-01', 'En revision'),
    (v_tenant, 'RET-DORA-INC', 'Incidentes ICT y notificaciones', 'DORA + resiliencia operacional', '10 anos desde cierre', 'Legal hold automatico en incidente material', 'Manual', '2026-06-01', 'Pendiente'),
    (v_tenant, 'RET-LEY2-CANAL', 'Expedientes canal interno Ley 2/2023', 'Ley 2/2023 + confidencialidad reforzada', '10 anos o periodo inferior si Legal/DPO lo aprueba', 'Hold automatico por elevacion a autoridad, demanda, indicio grave o investigacion significativa', 'Manual', '2026-06-15', 'Pendiente'),
    (v_tenant, 'RET-CIFA-CLOUD', 'Registro outsourcing cloud CIFA', 'EIOPA cloud + DORA terceros ICT', 'Durante vigencia contractual + 6 anos', 'Bloqueo por requerimiento supervisor, auditoria, salida o incidente ICT material', 'Dry-run', '2026-07-01', 'En revision'),
    (v_tenant, 'RET-GOV-PERM', 'Actas, politicas, apetito de riesgo y marcos aprobados', 'Gobierno corporativo y defensa probatoria', 'Permanente', 'No purgar sin revision Legal, DPO y Secretaria General', 'Manual', '2026-12-31', 'Conforme')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    object_type = EXCLUDED.object_type,
    regulatory_basis = EXCLUDED.regulatory_basis,
    retention = EXCLUDED.retention,
    legal_hold_rule = EXCLUDED.legal_hold_rule,
    purge_mode = EXCLUDED.purge_mode,
    next_run = EXCLUDED.next_run,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_workflows (
    tenant_id, id, module_id, title, legal_basis, "trigger", clock, due_at, owner,
    decision_gate, legal_hold_trigger, evidence_required, stages, progress,
    severity, status, secretary_output
  ) VALUES
    (v_tenant, 'WF-GDPR-BREACH-72H', 'gdpr', 'Brecha GDPR 72h', 'RGPD art. 33', 'Deteccion de violacion de datos personales', '72 horas desde conocimiento', '2026-04-29T09:00:00+02', 'DPO Grupo ARGA', 'Notificar / no notificar con analisis DPO obligatorio', 'Requerimiento AEPD, reclamacion de interesado o brecha de alto impacto', '["Timeline de deteccion y contencion","Analisis de riesgo DPO","Decision formal notificar/no notificar"]'::jsonb, '[{"label":"Triage y contencion","due":"T+12h","evidence":"Registro de incidente y medidas iniciales","status":"Conforme"},{"label":"Analisis DPO","due":"T+36h","evidence":"Informe de riesgo","status":"En revision"},{"label":"Decision formal","due":"T+48h","evidence":"Resolucion notificar/no notificar","status":"Pendiente"}]'::jsonb, 48, 'Alto', 'En revision', NULL),
    (v_tenant, 'WF-GDPR-DSAR-1M', 'gdpr', 'DSAR 1 mes', 'RGPD arts. 12-15', 'Solicitud de ejercicio de derechos', '1 mes desde recepcion', '2026-05-20T18:00:00+02', 'DPO Grupo ARGA', 'Responder, ampliar plazo o denegar motivadamente', 'Reclamacion, controversia o requerimiento AEPD', '["Solicitud recibida","Verificacion de identidad","Respuesta y prueba de envio"]'::jsonb, '[{"label":"Recepcion y registro","due":"Dia 0","evidence":"Entrada DSAR","status":"Conforme"},{"label":"Respuesta formal","due":"Dia 30","evidence":"Comunicacion enviada","status":"Pendiente"}]'::jsonb, 63, 'Alto', 'En revision', NULL),
    (v_tenant, 'WF-GDPR-DPIA-GATE', 'gdpr', 'DPIA gate go/no-go', 'RGPD art. 35', 'Tratamiento de alto riesgo antes de iniciar operacion', 'Antes de puesta en produccion', '2026-05-08T12:00:00+02', 'DPO Grupo ARGA', 'Go / no-go con dictamen DPO', 'Consulta previa, reclamacion o riesgo residual alto aceptado', '["Descripcion del tratamiento","Riesgos y medidas mitigadoras","Dictamen DPO"]'::jsonb, '[{"label":"Ficha del tratamiento","due":"Antes de diseno final","evidence":"Contexto y finalidad","status":"Conforme"},{"label":"Dictamen DPO","due":"Antes de lanzamiento","evidence":"Aprobacion o bloqueo","status":"Pendiente"}]'::jsonb, 45, 'Critico', 'Pendiente', NULL),
    (v_tenant, 'WF-DORA-MAJOR-ICT', 'dora', 'Incidente ICT mayor DORA', 'DORA arts. 17-19', 'Incidente ICT con potencial materialidad', 'Hitos inicial/intermedio/final parametrizables por RTS', '2026-04-28T17:00:00+02', 'Resiliencia Operacional', 'Clasificar como mayor y activar reporting supervisor', 'Incidente material, requerimiento supervisor o afectacion de continuidad', '["Clasificacion de severidad","Reporte inicial","Reporte intermedio","Reporte final y lecciones aprendidas"]'::jsonb, '[{"label":"Clasificacion","due":"Parametro RTS inicial","evidence":"Decision de materialidad","status":"En revision"},{"label":"Reporte inicial","due":"Parametro RTS inicial","evidence":"Borrador y justificante","status":"Pendiente"},{"label":"Reporte intermedio","due":"Parametro RTS intermedio","evidence":"Actualizacion impacto","status":"Pendiente"},{"label":"Reporte final","due":"Parametro RTS final","evidence":"Causa raiz y remediacion","status":"Pendiente"}]'::jsonb, 31, 'Critico', 'Pendiente', 'Reporte a Comite de Riesgos cuando requiera toma de razon'),
    (v_tenant, 'WF-LEY2-CANAL', 'ethics', 'Canal interno Ley 2/2023', 'Ley 2/2023 arts. 7-9', 'Comunicacion interna anonima o nominativa', 'Acuse 7 dias / resolucion 3 meses prorrogables', '2026-05-02T18:00:00+02', 'Responsable del Sistema Interno', 'Admitir, investigar, archivar o elevar a autoridad', 'Elevacion a autoridad, demanda, indicio grave o investigacion significativa', '["Acuse en 7 dias","Registro de anonimato o identidad segregada","Resolucion motivada","Logs de acceso"]'::jsonb, '[{"label":"Recepcion protegida","due":"Dia 0","evidence":"Canal anonimo habilitado","status":"Conforme"},{"label":"Acuse","due":"Dia 7","evidence":"Prueba de comunicacion","status":"Pendiente"},{"label":"Resolucion","due":"Dia 90","evidence":"Informe final y no represalia","status":"Pendiente"}]'::jsonb, 22, 'Critico', 'Pendiente', NULL),
    (v_tenant, 'WF-CYBER-CVE-SLA', 'cyber', 'Vulnerabilidad critica', 'NIS2 residual / ISO 27001 / ENS condicional', 'CVE critica en activo relevante', 'SLA interno por criticidad y exposicion', '2026-04-30T18:00:00+02', 'CISO ARGA', 'Remediar, mitigar o aprobar excepcion compensada', 'Explotacion confirmada, incidente ICT o requerimiento', '["Reporte de escaneo","Ticket de remediacion","Prueba de cierre"]'::jsonb, '[{"label":"Deteccion","due":"Dia 0","evidence":"Scanner y clasificacion","status":"Conforme"},{"label":"Remediacion","due":"Segun SLA","evidence":"Ticket y parche","status":"En revision"},{"label":"Verificacion","due":"Tras cierre","evidence":"Rescan limpio","status":"Pendiente"}]'::jsonb, 67, 'Alto', 'En revision', NULL)
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    title = EXCLUDED.title,
    legal_basis = EXCLUDED.legal_basis,
    "trigger" = EXCLUDED."trigger",
    clock = EXCLUDED.clock,
    due_at = EXCLUDED.due_at,
    owner = EXCLUDED.owner,
    decision_gate = EXCLUDED.decision_gate,
    legal_hold_trigger = EXCLUDED.legal_hold_trigger,
    evidence_required = EXCLUDED.evidence_required,
    stages = EXCLUDED.stages,
    progress = EXCLUDED.progress,
    severity = EXCLUDED.severity,
    status = EXCLUDED.status,
    secretary_output = EXCLUDED.secretary_output,
    updated_at = now();

  INSERT INTO grc_third_parties (
    tenant_id, id, provider, service, criticality, cloud_exposure, regulatory_basis,
    due_diligence, contract_clauses, exit_plan, next_review, legal_hold, owner
  ) VALUES
    (v_tenant, 'TPRM-ARGA-001', 'Proveedor Cloud Europeo A', 'Plataforma de analitica operacional', 'CIFA probable', 'Procesamiento de datos operativos y continuidad de reporting', 'EIOPA cloud + DORA terceros ICT', 'En revision', 'Pendiente', 'Pendiente', '2026-05-15', false, 'Compras y Riesgo Proveedor'),
    (v_tenant, 'TPRM-ARGA-002', 'Proveedor SaaS Siniestros', 'Gestion documental de expedientes de siniestro', 'Importante', 'Disponibilidad de expedientes y datos personales', 'DORA supply chain + RGPD encargado', 'Conforme', 'En revision', 'En revision', '2026-06-01', true, 'Resiliencia Operacional'),
    (v_tenant, 'TPRM-ARGA-003', 'Proveedor Monitorizacion SOC', 'Telemetria y alerta de seguridad', 'Importante', 'Logs tecnicos y senales de seguridad', 'NIS2 residual + ISO 27001', 'Conforme', 'Conforme', 'En revision', '2026-06-20', false, 'CISO ARGA')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    provider = EXCLUDED.provider,
    service = EXCLUDED.service,
    criticality = EXCLUDED.criticality,
    cloud_exposure = EXCLUDED.cloud_exposure,
    regulatory_basis = EXCLUDED.regulatory_basis,
    due_diligence = EXCLUDED.due_diligence,
    contract_clauses = EXCLUDED.contract_clauses,
    exit_plan = EXCLUDED.exit_plan,
    next_review = EXCLUDED.next_review,
    legal_hold = EXCLUDED.legal_hold,
    owner = EXCLUDED.owner,
    updated_at = now();

  INSERT INTO grc_audit_standards (
    tenant_id, id, domain, principle, standard_ref, evidence, mapping_2017, owner, status
  ) VALUES
    (v_tenant, 'IIA24-D1-P1', 'Proposito de auditoria interna', 'Demostrar integridad y proposito', 'Dominio I / Principio 1', 'Carta de auditoria, mandato aprobado y declaracion de independencia', 'Mision + Principios fundamentales', 'Auditoria Interna', 'En revision'),
    (v_tenant, 'IIA24-D3-P8', 'Gobierno de la funcion', 'Supervision por el Consejo', 'Dominio III / Principio 8', 'Aprobacion de plan anual, presupuesto y reporting al Comite de Auditoria', 'Normas 1000 y 2000', 'Comite de Auditoria', 'Pendiente'),
    (v_tenant, 'IIA24-D5-P13', 'Desempeno de servicios', 'Planificar y ejecutar encargos', 'Dominio V / Principio 13', 'Papeles de trabajo, conclusion del encargo y priorizacion de hallazgos', 'Normas 2200-2400', 'Auditoria Interna', 'En revision')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    domain = EXCLUDED.domain,
    principle = EXCLUDED.principle,
    standard_ref = EXCLUDED.standard_ref,
    evidence = EXCLUDED.evidence,
    mapping_2017 = EXCLUDED.mapping_2017,
    owner = EXCLUDED.owner,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_risk_appetite (
    tenant_id, id, risk_category, appetite, metric, threshold, approval, linked_committee, status
  ) VALUES
    (v_tenant, 'RAS-ICT-001', 'Resiliencia ICT', 'Bajo apetito a interrupciones de servicios criticos', 'Disponibilidad de plataforma de siniestros', 'RTO maximo 4h / RPO maximo 1h', 'Pendiente de proxima sesion del Consejo', 'Comite de Riesgos', 'En revision'),
    (v_tenant, 'RAS-PRIV-001', 'Privacidad', 'Cero tolerancia a brechas no evaluadas en 72h', 'Brechas con decision DPO dentro de plazo', '100% dentro de 72h', 'Marco DPO aprobado, actualizacion en revision', 'Comite de Cumplimiento', 'En revision'),
    (v_tenant, 'RAS-ETH-001', 'Etica y canal interno', 'Cero tolerancia a represalias y accesos no autorizados', 'Expedientes con acuse 7 dias y logs completos', '100% acuses / 0 accesos indebidos', 'Pendiente toma de razon', 'Comite de Auditoria', 'Pendiente')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    risk_category = EXCLUDED.risk_category,
    appetite = EXCLUDED.appetite,
    metric = EXCLUDED.metric,
    threshold = EXCLUDED.threshold,
    approval = EXCLUDED.approval,
    linked_committee = EXCLUDED.linked_committee,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_alerts (
    tenant_id, id, module_id, title, "trigger", due_at, severity, status
  ) VALUES
    (v_tenant, 'ALT-GRC-001', 'dora', 'Clasificacion de incidente ICT pendiente', 'Reloj de evaluacion material abierto', '2026-04-28', 'Critico', 'Pendiente'),
    (v_tenant, 'ALT-GRC-002', 'gdpr', 'Paquete de brecha pendiente de validacion DPO', 'Evidencia incompleta para Art. 33', '2026-04-29', 'Alto', 'En revision'),
    (v_tenant, 'ALT-GRC-006', 'tprm', 'Proveedor cloud pendiente de decision CIFA', 'Servicio con posible criticidad sin exit plan', '2026-05-15', 'Alto', 'En revision')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    title = EXCLUDED.title,
    "trigger" = EXCLUDED."trigger",
    due_at = EXCLUDED.due_at,
    severity = EXCLUDED.severity,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO grc_work_items (
    tenant_id, id, module_id, title, assignee, due_at, status, severity
  ) VALUES
    (v_tenant, 'WRK-GRC-001', 'cyber', 'Cerrar evidencia de parcheo CVE critica', 'CISO ARGA', '2026-04-30', 'En revision', 'Alto'),
    (v_tenant, 'WRK-GRC-002', 'dora', 'Validar controles compensatorios de excepcion DORA', 'Resiliencia Operacional', '2026-05-03', 'Pendiente', 'Critico'),
    (v_tenant, 'WRK-GRC-005', 'tprm', 'Completar registro minimo EIOPA cloud', 'Compras y Riesgo Proveedor', '2026-05-15', 'Pendiente', 'Alto')
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    title = EXCLUDED.title,
    assignee = EXCLUDED.assignee,
    due_at = EXCLUDED.due_at,
    status = EXCLUDED.status,
    severity = EXCLUDED.severity,
    updated_at = now();

  INSERT INTO governance_module_links (
    tenant_id, source_module, source_object_type, source_object_id,
    target_module, target_object_type, target_object_id, relation_type, status, payload
  ) VALUES
    (v_tenant, 'AIMS', 'aims_system_versions', '91000000-0000-0000-0000-000000000001', 'GRC', 'grc_evidence_links', 'EVD-GRC-AIMS-001', 'EVIDENCE_FEED', 'PROPOSED', '{"description":"AIMS technical file can feed GRC evidence ledger"}'::jsonb),
    (v_tenant, 'GRC', 'grc_workflows', 'WF-DORA-MAJOR-ICT', 'SECRETARIA', 'agenda_item', NULL, 'SECRETARY_REPORT_PROPOSAL', 'PROPOSED', '{"reportType":"Comite de Riesgos","secretaryAction":"toma_razon"}'::jsonb),
    (v_tenant, 'GRC', 'grc_risk_appetite', 'RAS-ICT-001', 'SECRETARIA', 'agenda_item', NULL, 'SECRETARY_APPROVAL_PROPOSAL', 'PROPOSED', '{"reportType":"Consejo","secretaryAction":"aprobacion_apetito"}'::jsonb)
  ON CONFLICT (tenant_id, source_module, source_object_type, source_object_id, target_module, relation_type) DO UPDATE SET
    target_object_type = EXCLUDED.target_object_type,
    target_object_id = EXCLUDED.target_object_id,
    status = EXCLUDED.status,
    payload = EXCLUDED.payload,
    updated_at = now();

  INSERT INTO governance_module_events (
    tenant_id, source_module, event_type, event_status, target_module,
    source_object_type, source_object_id, payload
  ) VALUES
    (v_tenant, 'GRC', 'SECRETARIA_AGENDA_PROPOSAL', 'OPEN', 'SECRETARIA', 'grc_workflows', 'WF-DORA-MAJOR-ICT', '{"title":"Toma de razon incidente ICT mayor","body":"Comite de Riesgos"}'::jsonb),
    (v_tenant, 'AIMS', 'GRC_EVIDENCE_READY', 'OPEN', 'GRC', 'aims_system_versions', '91000000-0000-0000-0000-000000000001', '{"title":"Expediente tecnico listo para ledger GRC"}'::jsonb)
  ON CONFLICT DO NOTHING;
END $$
