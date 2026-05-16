-- MODELO_ACUERDO rows 3-6: NOMBRAMIENTO_CONSEJERO x2 + CESE_CONSEJERO x2

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'NOMBRAMIENTO_CONSEJERO', 'NOMBRAMIENTO_CONSEJERO',
  'ES', '1.0.0', 'REVISADA', 'JUNTA_GENERAL', 'MEETING',
  'Modelo de acuerdo de nombramiento de consejero — por JGA',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Nombrar a {{nombre_candidato}}, con D.N.I./N.I.E. número {{dni_candidato}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con la categoría de consejero {{categoria_consejero}}, por el plazo estatutario de {{plazo_mandato}} años, con efectos desde la fecha del presente acuerdo.

SEGUNDO.- El Sr./Sra. {{nombre_candidato}} acepta el nombramiento, declara no estar incurso en ninguna causa de incompatibilidad o prohibición para el ejercicio del cargo, y manifiesta reunir los requisitos de idoneidad, honorabilidad y experiencia exigidos por la normativa aplicable.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil, subsanando cuantos defectos formales pudieran observarse.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"nombre_candidato","fuente":"persons.nombre_completo","condicion":"SIEMPRE"},{"variable":"dni_candidato","fuente":"persons.nif","condicion":"SIEMPRE"},{"variable":"cargo_denominacion","fuente":"agreement.cargo_denominacion","condicion":"SIEMPRE"},{"variable":"categoria_consejero","fuente":"agreement.categoria_consejero","condicion":"SIEMPRE"},{"variable":"plazo_mandato","fuente":"entities.plazo_mandato_estatutos","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"nombre_candidato","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre y apellidos completos del candidato"},{"campo":"dni_candidato","obligatoriedad":"OBLIGATORIO","descripcion":"DNI, NIE o pasaporte del candidato"},{"campo":"cargo_denominacion","obligatoriedad":"OBLIGATORIO","descripcion":"Denominación del cargo"},{"campo":"categoria_consejero","obligatoriedad":"OBLIGATORIO","descripcion":"Categoría del consejero"},{"campo":"plazo_mandato","obligatoriedad":"OBLIGATORIO","descripcion":"Duración del mandato en años"}]'::jsonb,
  'Arts. 214, 217-219 LSC; art. 94 RRM',
  'Oleada 2 — Modelo nombramiento de consejero por JGA. Inscribible en RM. Requiere escritura pública.'
);

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'NOMBRAMIENTO_CONSEJERO', 'NOMBRAMIENTO_CONSEJERO',
  'ES', '1.0.0', 'REVISADA', 'CONSEJO_ADMINISTRACION', 'MEETING',
  'Modelo de acuerdo de nombramiento de consejero — por cooptación',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Al amparo de lo previsto en el artículo 244 de la Ley de Sociedades de Capital y el artículo {{articulo_estatutos}} de los Estatutos Sociales, designar por cooptación a {{nombre_candidato}}, con D.N.I./N.I.E. número {{dni_candidato}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con la categoría de consejero {{categoria_consejero}}, para cubrir la vacante producida por {{motivo_vacante}}, hasta que la primera Junta General de Accionistas ratifique o revoque el nombramiento.

SEGUNDO.- El Sr./Sra. {{nombre_candidato}} acepta el nombramiento, declara no estar incurso en ninguna causa de incompatibilidad o prohibición para el ejercicio del cargo, y manifiesta reunir los requisitos de idoneidad, honorabilidad y experiencia exigidos por la normativa aplicable.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"nombre_candidato","fuente":"persons.nombre_completo","condicion":"SIEMPRE"},{"variable":"dni_candidato","fuente":"persons.nif","condicion":"SIEMPRE"},{"variable":"cargo_denominacion","fuente":"agreement.cargo_denominacion","condicion":"SIEMPRE"},{"variable":"categoria_consejero","fuente":"agreement.categoria_consejero","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"nombre_candidato","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre del candidato"},{"campo":"dni_candidato","obligatoriedad":"OBLIGATORIO","descripcion":"DNI/NIE"},{"campo":"cargo_denominacion","obligatoriedad":"OBLIGATORIO","descripcion":"Denominación del cargo"},{"campo":"categoria_consejero","obligatoriedad":"OBLIGATORIO","descripcion":"Categoría del consejero"},{"campo":"articulo_estatutos","obligatoriedad":"OBLIGATORIO","descripcion":"Artículo de los estatutos que regula la cooptación"},{"campo":"motivo_vacante","obligatoriedad":"OBLIGATORIO","descripcion":"Causa de la vacante"}]'::jsonb,
  'Art. 244 LSC; art. 94 RRM',
  'Oleada 2 — Modelo nombramiento por cooptación (art. 244 LSC). Solo válido para SA. Temporal hasta JGA de ratificación.'
);

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'CESE_CONSEJERO', 'CESE_CONSEJERO',
  'ES', '1.0.0', 'REVISADA', 'JUNTA_GENERAL', 'MEETING',
  'Modelo de acuerdo de cese de consejero — por JGA',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Cesar a {{nombre_consejero}}, con D.N.I./N.I.E. número {{dni_consejero}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con efectos desde la fecha del presente acuerdo, {{motivo_cese}}.

SEGUNDO.- Agradecer a {{nombre_consejero}} los servicios prestados durante su mandato como consejero de la Sociedad.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil, cancelando la inscripción del cargo del cesado.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"nombre_consejero","fuente":"persons.nombre_completo","condicion":"SIEMPRE"},{"variable":"dni_consejero","fuente":"persons.nif","condicion":"SIEMPRE"},{"variable":"cargo_denominacion","fuente":"mandate.cargo_denominacion","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"nombre_consejero","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre y apellidos completos del consejero que cesa"},{"campo":"dni_consejero","obligatoriedad":"OBLIGATORIO","descripcion":"DNI/NIE del consejero"},{"campo":"cargo_denominacion","obligatoriedad":"OBLIGATORIO","descripcion":"Denominación del cargo"},{"campo":"motivo_cese","obligatoriedad":"OBLIGATORIO","descripcion":"Motivo del cese"}]'::jsonb,
  'Arts. 223, 225 LSC; art. 94 RRM',
  'Oleada 2 — Modelo cese de consejero por JGA. La Junta puede cesar en cualquier momento (art. 223.1 LSC). Inscribible en RM.'
);

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'CESE_CONSEJERO', 'CESE_CONSEJERO',
  'ES', '1.0.0', 'REVISADA', 'CONSEJO_ADMINISTRACION', 'MEETING',
  'Modelo de acuerdo de cese de consejero — por renuncia',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Aceptar la renuncia presentada con fecha {{fecha_renuncia}} por {{nombre_consejero}}, con D.N.I./N.I.E. número {{dni_consejero}}, a su cargo de {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con efectos desde la fecha del presente acuerdo.

SEGUNDO.- Agradecer a {{nombre_consejero}} los servicios prestados durante su mandato como consejero de la Sociedad.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"nombre_consejero","fuente":"persons.nombre_completo","condicion":"SIEMPRE"},{"variable":"dni_consejero","fuente":"persons.nif","condicion":"SIEMPRE"},{"variable":"cargo_denominacion","fuente":"mandate.cargo_denominacion","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"nombre_consejero","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre del consejero renunciante"},{"campo":"dni_consejero","obligatoriedad":"OBLIGATORIO","descripcion":"DNI/NIE"},{"campo":"cargo_denominacion","obligatoriedad":"OBLIGATORIO","descripcion":"Denominación del cargo"},{"campo":"fecha_renuncia","obligatoriedad":"OBLIGATORIO","descripcion":"Fecha en que se presentó la renuncia"}]'::jsonb,
  'Arts. 223.1, 225 LSC; art. 94 RRM',
  'Oleada 2 — Modelo aceptación de renuncia de consejero. El Consejo acepta la dimisión. Inscribible en RM.'
);
