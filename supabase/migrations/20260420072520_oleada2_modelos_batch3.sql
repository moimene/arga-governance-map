-- MODELO_ACUERDO rows 7-8: DELEGACION_FACULTADES (permanente + puntual)

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'DELEGACION_FACULTADES', 'DELEGACION_FACULTADES',
  'ES', '1.0.0', 'REVISADA', 'CONSEJO_ADMINISTRACION', 'MEETING',
  'Modelo de acuerdo de delegación de facultades — permanente',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Delegar en la Comisión Delegada / Consejero Delegado Sr./Sra. {{nombre_delegado}}, con carácter permanente, las facultades de gestión y representación de {{nombre_entidad}} que a continuación se detallan:

{{listado_facultades}}

SEGUNDO.- La presente delegación se otorga con facultades de sustitución / sin facultades de sustitución, de conformidad con el artículo {{articulo_estatutos}} de los Estatutos Sociales y el artículo 249 de la Ley de Sociedades de Capital.

TERCERO.- La delegación acordada queda sin efecto en caso de revocación expresa por parte del Consejo de Administración.

CUARTO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"nombre_delegado","fuente":"persons.nombre_completo","condicion":"SIEMPRE"},{"variable":"articulo_estatutos","fuente":"entities.estatutos.articulo_delegacion","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"nombre_delegado","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre del consejero delegado o comisión delegada"},{"campo":"listado_facultades","obligatoriedad":"OBLIGATORIO","descripcion":"Enumeración detallada de las facultades delegadas"},{"campo":"articulo_estatutos","obligatoriedad":"OBLIGATORIO","descripcion":"Artículo estatutario que regula la delegación"}]'::jsonb,
  'Arts. 249, 249 bis LSC; art. 94 RRM',
  'Oleada 2 — Modelo delegación permanente (art. 249 LSC). Inscribible en RM. Excluye materias indelegables art. 249 bis LSC.'
);

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO', 'DELEGACION_FACULTADES', 'DELEGACION_FACULTADES',
  'ES', '1.0.0', 'REVISADA', 'CONSEJO_ADMINISTRACION', 'MEETING',
  'Modelo de acuerdo de delegación de facultades — puntual',
  '[]'::jsonb, '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$PRIMERO.- Autorizar al Sr./Sra. {{nombre_delegado}}, {{cargo_delegado}}, para realizar la siguiente operación concreta en nombre y representación de {{nombre_entidad}}: {{descripcion_operacion}}.

SEGUNDO.- La presente delegación queda limitada a la operación descrita y tendrá vigencia hasta {{fecha_limite_delegacion}}.

TERCERO.- El delegado deberá informar al Consejo de Administración de las actuaciones realizadas en ejercicio de la presente delegación.$$,
  '[{"variable":"nombre_entidad","fuente":"entities.name","condicion":"SIEMPRE"},{"variable":"nombre_delegado","fuente":"persons.nombre_completo","condicion":"SIEMPRE"},{"variable":"cargo_delegado","fuente":"mandate.cargo_denominacion","condicion":"SIEMPRE"}]'::jsonb,
  '[{"campo":"nombre_delegado","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre del apoderado o delegado"},{"campo":"cargo_delegado","obligatoriedad":"OBLIGATORIO","descripcion":"Cargo del delegado en la sociedad"},{"campo":"descripcion_operacion","obligatoriedad":"OBLIGATORIO","descripcion":"Descripción precisa de la operación"},{"campo":"fecha_limite_delegacion","obligatoriedad":"OBLIGATORIO","descripcion":"Fecha hasta la que es válida la delegación"}]'::jsonb,
  'Art. 249 LSC',
  'Oleada 2 — Modelo delegación puntual para operación concreta. No inscribible salvo apoderamiento general.'
);
