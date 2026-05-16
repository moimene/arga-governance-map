-- MODELO_ACUERDO rows 1-2: APROBACION_CUENTAS (con auditor + sin auditor)

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'APROBACION_CUENTAS', 'APROBACION_CUENTAS',
  'ES', '1.0.0', 'REVISADA', 'JUNTA_GENERAL', 'MEETING',
  'Modelo de acuerdo de aprobación de cuentas anuales — con auditor',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Aprobar las Cuentas Anuales de {{nombre_entidad}} correspondientes al ejercicio social cerrado el {{fecha_cierre_ejercicio}}, integradas por el Balance de Situación, la Cuenta de Pérdidas y Ganancias, el Estado de Cambios en el Patrimonio Neto, el Estado de Flujos de Efectivo y la Memoria, que arrojan un resultado del ejercicio de {{resultado_ejercicio}} euros.

SEGUNDO.- Aprobar la Gestión Social llevada a cabo por los administradores durante el ejercicio {{año_ejercicio}}, de conformidad con lo dispuesto en el artículo 164 de la Ley de Sociedades de Capital.

TERCERO.- Aprobar la propuesta de aplicación del resultado del ejercicio: {{aplicacion_resultado}}.

CUARTO.- Aprobar el Informe de Auditoría emitido por {{nombre_auditor}}, inscrito en el ROAC con el número {{numero_roac}}, que ha auditado las cuentas del ejercicio {{año_ejercicio}}.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"fecha_cierre_ejercicio","fuente":"agreement.ejercicio_cierre","condicion":"SIEMPRE"},{"variable":"año_ejercicio","fuente":"agreement.ejercicio_año","condicion":"SIEMPRE"},{"variable":"nombre_auditor","fuente":"entities.auditor_nombre","condicion":"CON_AUDITOR"},{"variable":"numero_roac","fuente":"entities.auditor_roac","condicion":"CON_AUDITOR"}]'::jsonb,
  '[{"campo":"resultado_ejercicio","obligatoriedad":"OBLIGATORIO","descripcion":"Resultado del ejercicio en euros"},{"campo":"aplicacion_resultado","obligatoriedad":"OBLIGATORIO","descripcion":"Propuesta de aplicación del resultado"},{"campo":"nombre_auditor","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre del auditor o firma auditora"},{"campo":"numero_roac","obligatoriedad":"OBLIGATORIO","descripcion":"Número de inscripción en el ROAC"}]'::jsonb,
  'Arts. 253, 257, 272-279 LSC; Cuarto punto del orden del día JGA ordinaria',
  'Oleada 2 — Modelo dispositiva aprobación de cuentas con auditor. SA cotizada (ARGA Seguros S.A.). Gate DL-2.'
);

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'APROBACION_CUENTAS', 'APROBACION_CUENTAS',
  'ES', '1.0.0', 'REVISADA', 'JUNTA_GENERAL', 'MEETING',
  'Modelo de acuerdo de aprobación de cuentas anuales — sin auditor',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Aprobar las Cuentas Anuales de {{nombre_entidad}} correspondientes al ejercicio social cerrado el {{fecha_cierre_ejercicio}}, integradas por el Balance de Situación, la Cuenta de Pérdidas y Ganancias, el Estado de Cambios en el Patrimonio Neto y la Memoria, que arrojan un resultado del ejercicio de {{resultado_ejercicio}} euros.

SEGUNDO.- Aprobar la Gestión Social llevada a cabo por los administradores durante el ejercicio {{año_ejercicio}}, de conformidad con lo dispuesto en el artículo 164 de la Ley de Sociedades de Capital.

TERCERO.- Aprobar la propuesta de aplicación del resultado del ejercicio: {{aplicacion_resultado}}.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"fecha_cierre_ejercicio","fuente":"agreement.ejercicio_cierre","condicion":"SIEMPRE"},{"variable":"año_ejercicio","fuente":"agreement.ejercicio_año","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"resultado_ejercicio","obligatoriedad":"OBLIGATORIO","descripcion":"Resultado del ejercicio en euros"},{"campo":"aplicacion_resultado","obligatoriedad":"OBLIGATORIO","descripcion":"Propuesta de aplicación del resultado"}]'::jsonb,
  'Arts. 253, 257, 272-279 LSC',
  'Oleada 2 — Modelo dispositiva aprobación de cuentas sin auditor. SL o SA no obligada a auditoría (art. 263.2 LSC).'
);
