-- Migration: 20260420_000012_oleada2_modelos_acuerdo.sql
-- Purpose: Oleada 2 — content models (MODELO_ACUERDO) + rule pack payloads LSC
-- Date: 2026-04-20
-- Tenant: 00000000-0000-0000-0000-000000000001

-- ============================================================================
-- PART 1: Schema changes
-- ============================================================================

-- 1. Add materia_acuerdo column
ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS materia_acuerdo TEXT;

-- 2. Drop existing tipo CHECK and add MODELO_ACUERDO
ALTER TABLE plantillas_protegidas
  DROP CONSTRAINT IF EXISTS plantillas_protegidas_tipo_check;

ALTER TABLE plantillas_protegidas
  ADD CONSTRAINT plantillas_protegidas_tipo_check
  CHECK (tipo IN (
    'ACTA_SESION', 'ACTA_CONSIGNACION', 'ACTA_ACUERDO_ESCRITO',
    'CERTIFICACION', 'CONVOCATORIA', 'CONVOCATORIA_SL_NOTIFICACION',
    'MODELO_ACUERDO'
  ));

-- 3. Index for efficient lookup by materia
CREATE INDEX IF NOT EXISTS idx_plantillas_materia
  ON plantillas_protegidas(tenant_id, materia_acuerdo, organo_tipo, estado)
  WHERE materia_acuerdo IS NOT NULL;

-- ============================================================================
-- PART 2: MODELO_ACUERDO inserts — 13 materias
-- 4 high-priority with real legal text + 9 stubs
-- ============================================================================

-- ─── 2.1 APROBACION_CUENTAS — Con auditor (SA cotizada) ────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'APROBACION_CUENTAS',
  'APROBACION_CUENTAS',
  'ES',
  '1.0.0',
  'REVISADA',
  'JUNTA_GENERAL',
  'MEETING',
  'Modelo de acuerdo de aprobación de cuentas anuales — con auditor',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Aprobar las Cuentas Anuales de {{nombre_entidad}} correspondientes al ejercicio social cerrado el {{fecha_cierre_ejercicio}}, integradas por el Balance de Situación, la Cuenta de Pérdidas y Ganancias, el Estado de Cambios en el Patrimonio Neto, el Estado de Flujos de Efectivo y la Memoria, que arrojan un resultado del ejercicio de {{resultado_ejercicio}} euros.

SEGUNDO.- Aprobar la Gestión Social llevada a cabo por los administradores durante el ejercicio {{año_ejercicio}}, de conformidad con lo dispuesto en el artículo 164 de la Ley de Sociedades de Capital.

TERCERO.- Aprobar la propuesta de aplicación del resultado del ejercicio que ha sido presentada por los administradores, que consiste en: {{aplicacion_resultado}}.

CUARTO.- Aprobar el Informe de Auditoría emitido por {{nombre_auditor}}, inscrito en el Registro Oficial de Auditores de Cuentas con el número {{numero_roac}}, que ha auditado las cuentas del ejercicio {{año_ejercicio}}.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "fecha_cierre_ejercicio", "fuente": "agreement.ejercicio_cierre", "condicion": "SIEMPRE"},
    {"variable": "año_ejercicio", "fuente": "agreement.ejercicio_año", "condicion": "SIEMPRE"},
    {"variable": "nombre_auditor", "fuente": "entities.auditor_nombre", "condicion": "CON_AUDITOR"},
    {"variable": "numero_roac", "fuente": "entities.auditor_roac", "condicion": "CON_AUDITOR"}
  ]'::jsonb,
  '[
    {"campo": "resultado_ejercicio", "obligatoriedad": "OBLIGATORIO", "descripcion": "Resultado del ejercicio en euros (puede ser positivo o negativo)"},
    {"campo": "aplicacion_resultado", "obligatoriedad": "OBLIGATORIO", "descripcion": "Descripción de la propuesta de aplicación del resultado (dividendo, reservas, compensación de pérdidas)"},
    {"campo": "nombre_auditor", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre completo del auditor o firma auditora"},
    {"campo": "numero_roac", "obligatoriedad": "OBLIGATORIO", "descripcion": "Número de inscripción en el ROAC"}
  ]'::jsonb,
  'Arts. 253, 257, 272-279 LSC; Cuarto punto del orden del día JGA ordinaria',
  'Oleada 2 — Modelo dispositiva aprobación de cuentas con auditor. Aplicable a SA cotizada (ARGA Seguros S.A.). Gate DL-2: evalúa LSC + advertencias LMV, no bloquea.'
);

-- ─── 2.2 APROBACION_CUENTAS — Sin auditor (SL / SA no obligada) ────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'APROBACION_CUENTAS',
  'APROBACION_CUENTAS',
  'ES',
  '1.0.0',
  'REVISADA',
  'JUNTA_GENERAL',
  'MEETING',
  'Modelo de acuerdo de aprobación de cuentas anuales — sin auditor',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Aprobar las Cuentas Anuales de {{nombre_entidad}} correspondientes al ejercicio social cerrado el {{fecha_cierre_ejercicio}}, integradas por el Balance de Situación, la Cuenta de Pérdidas y Ganancias, el Estado de Cambios en el Patrimonio Neto y la Memoria, que arrojan un resultado del ejercicio de {{resultado_ejercicio}} euros.

SEGUNDO.- Aprobar la Gestión Social llevada a cabo por los administradores durante el ejercicio {{año_ejercicio}}, de conformidad con lo dispuesto en el artículo 164 de la Ley de Sociedades de Capital.

TERCERO.- Aprobar la propuesta de aplicación del resultado del ejercicio que ha sido presentada por los administradores, que consiste en: {{aplicacion_resultado}}.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "fecha_cierre_ejercicio", "fuente": "agreement.ejercicio_cierre", "condicion": "SIEMPRE"},
    {"variable": "año_ejercicio", "fuente": "agreement.ejercicio_año", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "resultado_ejercicio", "obligatoriedad": "OBLIGATORIO", "descripcion": "Resultado del ejercicio en euros"},
    {"campo": "aplicacion_resultado", "obligatoriedad": "OBLIGATORIO", "descripcion": "Descripción de la propuesta de aplicación del resultado"}
  ]'::jsonb,
  'Arts. 253, 257, 272-279 LSC',
  'Oleada 2 — Modelo dispositiva aprobación de cuentas sin auditor. Aplicable a SL o SA no obligada a auditoría (art. 263.2 LSC).'
);

-- ─── 2.3 NOMBRAMIENTO_CONSEJERO — Por JGA ──────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'NOMBRAMIENTO_CONSEJERO',
  'NOMBRAMIENTO_CONSEJERO',
  'ES',
  '1.0.0',
  'REVISADA',
  'JUNTA_GENERAL',
  'MEETING',
  'Modelo de acuerdo de nombramiento de consejero — por JGA',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Nombrar a {{nombre_candidato}}, con D.N.I./N.I.E. número {{dni_candidato}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con la categoría de consejero {{categoria_consejero}} (independiente / dominical / ejecutivo / otro externo), por el plazo estatutario de {{plazo_mandato}} años, con efectos desde la fecha del presente acuerdo.

SEGUNDO.- El Sr./Sra. {{nombre_candidato}} acepta el nombramiento, declara no estar incurso en ninguna causa de incompatibilidad o prohibición para el ejercicio del cargo, y manifiesta reunir los requisitos de idoneidad, honorabilidad y experiencia exigidos por la normativa aplicable.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil, subsanando cuantos defectos formales pudieran observarse.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "nombre_candidato", "fuente": "persons.nombre_completo", "condicion": "SIEMPRE"},
    {"variable": "dni_candidato", "fuente": "persons.nif", "condicion": "SIEMPRE"},
    {"variable": "cargo_denominacion", "fuente": "agreement.cargo_denominacion", "condicion": "SIEMPRE"},
    {"variable": "categoria_consejero", "fuente": "agreement.categoria_consejero", "condicion": "SIEMPRE"},
    {"variable": "plazo_mandato", "fuente": "entities.plazo_mandato_estatutos", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "nombre_candidato", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre y apellidos completos del candidato"},
    {"campo": "dni_candidato", "obligatoriedad": "OBLIGATORIO", "descripcion": "DNI, NIE o pasaporte del candidato"},
    {"campo": "cargo_denominacion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Denominación del cargo (Vocal, Consejero, Vicepresidente, etc.)"},
    {"campo": "categoria_consejero", "obligatoriedad": "OBLIGATORIO", "descripcion": "Categoría del consejero (independiente, dominical, ejecutivo, otro externo)"},
    {"campo": "plazo_mandato", "obligatoriedad": "OBLIGATORIO", "descripcion": "Duración del mandato en años conforme a estatutos"}
  ]'::jsonb,
  'Arts. 214, 217-219 LSC; art. 94 RRM',
  'Oleada 2 — Modelo nombramiento de consejero por JGA. Inscribible en RM. Plazo máximo 6 años (SA) o estatutos (SL). Requiere escritura pública.'
);

-- ─── 2.4 NOMBRAMIENTO_CONSEJERO — Por cooptación (CdA) ─────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'NOMBRAMIENTO_CONSEJERO',
  'NOMBRAMIENTO_CONSEJERO',
  'ES',
  '1.0.0',
  'REVISADA',
  'CONSEJO_ADMINISTRACION',
  'MEETING',
  'Modelo de acuerdo de nombramiento de consejero — por cooptación',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Al amparo de lo previsto en el artículo 244 de la Ley de Sociedades de Capital y el artículo {{articulo_estatutos}} de los Estatutos Sociales, designar por cooptación a {{nombre_candidato}}, con D.N.I./N.I.E. número {{dni_candidato}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con la categoría de consejero {{categoria_consejero}}, para cubrir la vacante producida por {{motivo_vacante}}, hasta que la primera Junta General de Accionistas ratifique o revoque el nombramiento.

SEGUNDO.- El Sr./Sra. {{nombre_candidato}} acepta el nombramiento, declara no estar incurso en ninguna causa de incompatibilidad o prohibición para el ejercicio del cargo, y manifiesta reunir los requisitos de idoneidad, honorabilidad y experiencia exigidos por la normativa aplicable.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "nombre_candidato", "fuente": "persons.nombre_completo", "condicion": "SIEMPRE"},
    {"variable": "dni_candidato", "fuente": "persons.nif", "condicion": "SIEMPRE"},
    {"variable": "cargo_denominacion", "fuente": "agreement.cargo_denominacion", "condicion": "SIEMPRE"},
    {"variable": "categoria_consejero", "fuente": "agreement.categoria_consejero", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "nombre_candidato", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre y apellidos completos del candidato"},
    {"campo": "dni_candidato", "obligatoriedad": "OBLIGATORIO", "descripcion": "DNI, NIE o pasaporte del candidato"},
    {"campo": "cargo_denominacion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Denominación del cargo"},
    {"campo": "categoria_consejero", "obligatoriedad": "OBLIGATORIO", "descripcion": "Categoría del consejero"},
    {"campo": "articulo_estatutos", "obligatoriedad": "OBLIGATORIO", "descripcion": "Artículo de los estatutos que regula la cooptación"},
    {"campo": "motivo_vacante", "obligatoriedad": "OBLIGATORIO", "descripcion": "Causa de la vacante (fallecimiento, renuncia, cese, etc.)"}
  ]'::jsonb,
  'Art. 244 LSC; art. 94 RRM',
  'Oleada 2 — Modelo nombramiento por cooptación (art. 244 LSC). Solo válido para SA. Temporal hasta JGA de ratificación.'
);

-- ─── 2.5 CESE_CONSEJERO — Por JGA ──────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'CESE_CONSEJERO',
  'CESE_CONSEJERO',
  'ES',
  '1.0.0',
  'REVISADA',
  'JUNTA_GENERAL',
  'MEETING',
  'Modelo de acuerdo de cese de consejero — por JGA',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Cesar a {{nombre_consejero}}, con D.N.I./N.I.E. número {{dni_consejero}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con efectos desde la fecha del presente acuerdo, {{motivo_cese}}.

SEGUNDO.- Agradecer a {{nombre_consejero}} los servicios prestados durante su mandato como consejero de la Sociedad.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil, cancelando la inscripción del cargo del cesado.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "nombre_consejero", "fuente": "persons.nombre_completo", "condicion": "SIEMPRE"},
    {"variable": "dni_consejero", "fuente": "persons.nif", "condicion": "SIEMPRE"},
    {"variable": "cargo_denominacion", "fuente": "mandate.cargo_denominacion", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "nombre_consejero", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre y apellidos completos del consejero que cesa"},
    {"campo": "dni_consejero", "obligatoriedad": "OBLIGATORIO", "descripcion": "DNI, NIE o pasaporte del consejero"},
    {"campo": "cargo_denominacion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Denominación del cargo del consejero"},
    {"campo": "motivo_cese", "obligatoriedad": "OBLIGATORIO", "descripcion": "Motivo del cese (por expiración de mandato, a petición propia, por acuerdo de la Junta, etc.)"}
  ]'::jsonb,
  'Arts. 223, 225 LSC; art. 94 RRM',
  'Oleada 2 — Modelo cese de consejero por JGA. La Junta puede cesar a cualquier consejero en cualquier momento (art. 223.1 LSC). Inscribible en RM.'
);

-- ─── 2.6 CESE_CONSEJERO — Por renuncia ─────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'CESE_CONSEJERO',
  'CESE_CONSEJERO',
  'ES',
  '1.0.0',
  'REVISADA',
  'CONSEJO_ADMINISTRACION',
  'MEETING',
  'Modelo de acuerdo de cese de consejero — por renuncia',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Aceptar la renuncia presentada con fecha {{fecha_renuncia}} por {{nombre_consejero}}, con D.N.I./N.I.E. número {{dni_consejero}}, a su cargo de {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con efectos desde la fecha del presente acuerdo.

SEGUNDO.- Agradecer a {{nombre_consejero}} los servicios prestados durante su mandato como consejero de la Sociedad.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "nombre_consejero", "fuente": "persons.nombre_completo", "condicion": "SIEMPRE"},
    {"variable": "dni_consejero", "fuente": "persons.nif", "condicion": "SIEMPRE"},
    {"variable": "cargo_denominacion", "fuente": "mandate.cargo_denominacion", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "nombre_consejero", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre y apellidos completos del consejero renunciante"},
    {"campo": "dni_consejero", "obligatoriedad": "OBLIGATORIO", "descripcion": "DNI, NIE o pasaporte del consejero"},
    {"campo": "cargo_denominacion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Denominación del cargo"},
    {"campo": "fecha_renuncia", "obligatoriedad": "OBLIGATORIO", "descripcion": "Fecha en que se presentó la renuncia"}
  ]'::jsonb,
  'Arts. 223.1, 225 LSC; art. 94 RRM',
  'Oleada 2 — Modelo aceptación de renuncia de consejero. El Consejo acepta la dimisión. Inscribible en RM.'
);

-- ─── 2.7 DELEGACION_FACULTADES — Permanente (Comisión Delegada / Consejero Delegado) ──

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'DELEGACION_FACULTADES',
  'DELEGACION_FACULTADES',
  'ES',
  '1.0.0',
  'REVISADA',
  'CONSEJO_ADMINISTRACION',
  'MEETING',
  'Modelo de acuerdo de delegación de facultades — permanente',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Delegar en la Comisión Delegada / Consejero Delegado Sr./Sra. {{nombre_delegado}}, con carácter permanente, las facultades de gestión y representación de {{nombre_entidad}} que a continuación se detallan, con las facultades de sustitución que se indican:

{{listado_facultades}}

SEGUNDO.- La presente delegación se otorga con facultades de sustitución / sin facultades de sustitución (táchese lo que no proceda), de conformidad con el artículo {{articulo_estatutos}} de los Estatutos Sociales y el artículo 249 de la Ley de Sociedades de Capital.

TERCERO.- La delegación acordada queda sin efecto en caso de revocación expresa por parte del Consejo de Administración.

CUARTO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "nombre_delegado", "fuente": "persons.nombre_completo", "condicion": "SIEMPRE"},
    {"variable": "articulo_estatutos", "fuente": "entities.estatutos.articulo_delegacion", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "nombre_delegado", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre del consejero delegado o comisión delegada"},
    {"campo": "listado_facultades", "obligatoriedad": "OBLIGATORIO", "descripcion": "Enumeración detallada de las facultades delegadas"},
    {"campo": "articulo_estatutos", "obligatoriedad": "OBLIGATORIO", "descripcion": "Artículo estatutario que regula la delegación"},
    {"campo": "facultades_sustitucion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Indicar si se otorgan o no facultades de sustitución"}
  ]'::jsonb,
  'Arts. 249, 249 bis LSC; art. 94 RRM',
  'Oleada 2 — Modelo delegación permanente de facultades (art. 249 LSC). Inscribible en RM. Excluye materias indelegables del art. 249 bis LSC.'
);

-- ─── 2.8 DELEGACION_FACULTADES — Puntual ───────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'DELEGACION_FACULTADES',
  'DELEGACION_FACULTADES',
  'ES',
  '1.0.0',
  'REVISADA',
  'CONSEJO_ADMINISTRACION',
  'MEETING',
  'Modelo de acuerdo de delegación de facultades — puntual',
  '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb,
  true,
  '1.0.0',
  $$PRIMERO.- Autorizar al Sr./Sra. {{nombre_delegado}}, {{cargo_delegado}}, para realizar la siguiente operación concreta en nombre y representación de {{nombre_entidad}}: {{descripcion_operacion}}.

SEGUNDO.- La presente delegación queda limitada a la operación descrita y tendrá vigencia hasta {{fecha_limite_delegacion}}.

TERCERO.- El delegado deberá informar al Consejo de Administración de las actuaciones realizadas en ejercicio de la presente delegación.$$,
  '[
    {"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"},
    {"variable": "nombre_delegado", "fuente": "persons.nombre_completo", "condicion": "SIEMPRE"},
    {"variable": "cargo_delegado", "fuente": "mandate.cargo_denominacion", "condicion": "SIEMPRE"}
  ]'::jsonb,
  '[
    {"campo": "nombre_delegado", "obligatoriedad": "OBLIGATORIO", "descripcion": "Nombre del apoderado o delegado"},
    {"campo": "cargo_delegado", "obligatoriedad": "OBLIGATORIO", "descripcion": "Cargo del delegado en la sociedad"},
    {"campo": "descripcion_operacion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Descripción precisa de la operación para la que se concede la delegación"},
    {"campo": "fecha_limite_delegacion", "obligatoriedad": "OBLIGATORIO", "descripcion": "Fecha hasta la que es válida la delegación"}
  ]'::jsonb,
  'Art. 249 LSC',
  'Oleada 2 — Modelo delegación puntual de facultades para operación concreta. No inscribible salvo que sea apoderamiento general.'
);

-- ============================================================================
-- STUBS — 9 materias pendientes de entrega por equipo legal
-- ============================================================================

-- ─── 2.9 DISTRIBUCION_DIVIDENDOS ────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'DISTRIBUCION_DIVIDENDOS', 'DISTRIBUCION_DIVIDENDOS', 'ES', '0.1.0', 'BORRADOR',
  'JUNTA_GENERAL', 'MEETING', 'Stub — modelo distribución de dividendos', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 273, 348 LSC',
  'Oleada 2 STUB — Distribución de dividendos. Pendiente revisión legal.'
);

-- ─── 2.10 MODIFICACION_ESTATUTOS ────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'MODIFICACION_ESTATUTOS', 'MODIFICACION_ESTATUTOS', 'ES', '0.1.0', 'BORRADOR',
  'JUNTA_GENERAL', 'MEETING', 'Stub — modelo modificación de estatutos', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 285-290 LSC',
  'Oleada 2 STUB — Modificación de estatutos sociales. Requiere mayoría reforzada (art. 194 LSC). Pendiente revisión legal.'
);

-- ─── 2.11 AUMENTO_CAPITAL ───────────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'AUMENTO_CAPITAL', 'AUMENTO_CAPITAL', 'ES', '0.1.0', 'BORRADOR',
  'JUNTA_GENERAL', 'MEETING', 'Stub — modelo aumento de capital', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 295-310 LSC',
  'Oleada 2 STUB — Aumento de capital. Pendiente revisión legal.'
);

-- ─── 2.12 REDUCCION_CAPITAL ─────────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'REDUCCION_CAPITAL', 'REDUCCION_CAPITAL', 'ES', '0.1.0', 'BORRADOR',
  'JUNTA_GENERAL', 'MEETING', 'Stub — modelo reducción de capital', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 317-342 LSC',
  'Oleada 2 STUB — Reducción de capital (art. 319 LSC — oposición acreedores). Pendiente revisión legal.'
);

-- ─── 2.13 OPERACION_VINCULADA ───────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'OPERACION_VINCULADA', 'OPERACION_VINCULADA', 'ES', '0.1.0', 'BORRADOR',
  'CONSEJO_ADMINISTRACION', 'MEETING', 'Stub — modelo operación con parte vinculada', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 228-231 LSC; art. 529 ter.1.h LSC (cotizadas)',
  'Oleada 2 STUB — Operación con parte vinculada. Art. 228 LSC: vinculado no puede votar. Pendiente revisión legal.'
);

-- ─── 2.14 NOMBRAMIENTO_AUDITOR ──────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'NOMBRAMIENTO_AUDITOR', 'NOMBRAMIENTO_AUDITOR', 'ES', '0.1.0', 'BORRADOR',
  'JUNTA_GENERAL', 'MEETING', 'Stub — modelo nombramiento de auditor', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 263-271 LSC; LAC',
  'Oleada 2 STUB — Nombramiento de auditor. Pendiente revisión legal.'
);

-- ─── 2.15 APROBACION_PLAN_NEGOCIO ───────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'APROBACION_PLAN_NEGOCIO', 'APROBACION_PLAN_NEGOCIO', 'ES', '0.1.0', 'BORRADOR',
  'CONSEJO_ADMINISTRACION', 'MEETING', 'Stub — modelo aprobación plan de negocio', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Art. 225 LSC — deber de diligencia del Consejo',
  'Oleada 2 STUB — Aprobación plan de negocio por el Consejo. Pendiente revisión legal.'
);

-- ─── 2.16 AUTORIZACION_GARANTIA ─────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'AUTORIZACION_GARANTIA', 'AUTORIZACION_GARANTIA', 'ES', '0.1.0', 'BORRADOR',
  'JUNTA_GENERAL', 'MEETING', 'Stub — modelo autorización de garantía', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Art. 160.f LSC (activos >25% activo)',
  'Oleada 2 STUB — Autorización de garantías significativas. Si >25% activo: competencia JGA (art. 160.f LSC). Pendiente revisión legal.'
);

-- ─── 2.17 RATIFICACION_ACTOS ────────────────────────────────────────────────

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, materia, jurisdiccion, version, estado,
  organo_tipo, adoption_mode, contenido_template, variables, protecciones,
  snapshot_rule_pack_required, contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables, referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001', 'MODELO_ACUERDO',
  'RATIFICACION_ACTOS', 'RATIFICACION_ACTOS', 'ES', '0.1.0', 'BORRADOR',
  'CONSEJO_ADMINISTRACION', 'MEETING', 'Stub — modelo ratificación de actos', '[]'::jsonb,
  '{"secciones_inmutables": ["DISPOSITIVA"]}'::jsonb, true, '1.0.0',
  $$[MODELO PENDIENTE DE ENTREGA POR EQUIPO LEGAL — Oleada 2, prioridad media. Fecha estimada: 30/04/2026]

PRIMERO.- {{texto_acuerdo_pendiente}}$$,
  '[{"variable": "nombre_entidad", "fuente": "entities.name", "condicion": "SIEMPRE"}]'::jsonb,
  '[{"campo": "texto_acuerdo_pendiente", "obligatoriedad": "OBLIGATORIO", "descripcion": "Texto del acuerdo (pendiente modelo legal)"}]'::jsonb,
  'Arts. 234-235 LSC',
  'Oleada 2 STUB — Ratificación de actos previos al nombramiento o realizados fuera del ámbito del poder. Pendiente revisión legal.'
);

-- ============================================================================
-- PART 3: Rule pack payloads — UPDATE existing + INSERT new packs
-- All payloads match the RulePack TypeScript interface
-- ============================================================================

-- ─── HELPER: ensure all 13 rule_packs exist ─────────────────────────────────

INSERT INTO rule_packs (id, tenant_id, descripcion, materia, organo_tipo)
VALUES
  ('APROBACION_CUENTAS',    '00000000-0000-0000-0000-000000000001', 'Aprobación de Cuentas Anuales',        'APROBACION_CUENTAS',    'JUNTA_GENERAL'),
  ('DISTRIBUCION_DIVIDENDOS','00000000-0000-0000-0000-000000000001', 'Distribución de Dividendos',          'DISTRIBUCION_DIVIDENDOS','JUNTA_GENERAL'),
  ('NOMBRAMIENTO_CONSEJERO', '00000000-0000-0000-0000-000000000001', 'Nombramiento de Consejero',           'NOMBRAMIENTO_CONSEJERO', 'JUNTA_GENERAL'),
  ('CESE_CONSEJERO',         '00000000-0000-0000-0000-000000000001', 'Cese de Consejero',                   'CESE_CONSEJERO',         'JUNTA_GENERAL'),
  ('DELEGACION_FACULTADES',  '00000000-0000-0000-0000-000000000001', 'Delegación de Facultades',            'DELEGACION_FACULTADES',  'CONSEJO'),
  ('MODIFICACION_ESTATUTOS', '00000000-0000-0000-0000-000000000001', 'Modificación de Estatutos Sociales',  'MODIFICACION_ESTATUTOS', 'JUNTA_GENERAL'),
  ('AUMENTO_CAPITAL',        '00000000-0000-0000-0000-000000000001', 'Aumento de Capital Social',           'AUMENTO_CAPITAL',        'JUNTA_GENERAL'),
  ('REDUCCION_CAPITAL',      '00000000-0000-0000-0000-000000000001', 'Reducción de Capital Social',         'REDUCCION_CAPITAL',      'JUNTA_GENERAL'),
  ('OPERACION_VINCULADA',    '00000000-0000-0000-0000-000000000001', 'Operación con Parte Vinculada',       'OPERACION_VINCULADA',    'CONSEJO'),
  ('NOMBRAMIENTO_AUDITOR',   '00000000-0000-0000-0000-000000000001', 'Nombramiento de Auditor de Cuentas',  'NOMBRAMIENTO_AUDITOR',   'JUNTA_GENERAL'),
  ('APROBACION_PLAN_NEGOCIO','00000000-0000-0000-0000-000000000001', 'Aprobación del Plan de Negocio',      'APROBACION_PLAN_NEGOCIO','CONSEJO'),
  ('AUTORIZACION_GARANTIA',  '00000000-0000-0000-0000-000000000001', 'Autorización de Garantía Significativa','AUTORIZACION_GARANTIA','JUNTA_GENERAL'),
  ('RATIFICACION_ACTOS',     '00000000-0000-0000-0000-000000000001', 'Ratificación de Actos y Contratos',   'RATIFICACION_ACTOS',     'CONSEJO')
ON CONFLICT (id) DO NOTHING;

-- ─── UPSERT rule_pack_versions with real payloads ───────────────────────────
-- Strategy: INSERT ... ON CONFLICT DO UPDATE payload
-- This replaces the stub payloads from migration 000001

-- 1. APROBACION_CUENTAS
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'APROBACION_CUENTAS',
  '1.0.0',
  '{
    "id": "APROBACION_CUENTAS",
    "materia": "APROBACION_CUENTAS",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA", "PUBLICACION_ESTATUTOS"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar de la reunión",
        "Orden del día con indicación de los asuntos a tratar",
        "Cargo o nombre de quien realiza la convocatoria"
      ],
      "documentosObligatorios": [
        {"id": "cuentas_anuales", "nombre": "Cuentas anuales formuladas", "condicion": "SIEMPRE"},
        {"id": "informe_gestion", "nombre": "Informe de gestión", "condicion": "SIEMPRE"},
        {"id": "informe_auditoria", "nombre": "Informe de auditoría", "condicion": "SI_AUDITORIA_OBLIGATORIA"},
        {"id": "propuesta_aplicacion_resultado", "nombre": "Propuesta de aplicación del resultado", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC — sin mínimo en 2ª conv."},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC — sin quórum legal"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > contra", "fuente": "LEY", "referencia": "art. 201.1 LSC"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 248.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "cuentas_anuales", "nombre": "Cuentas anuales firmadas por todos los administradores"},
        {"id": "informe_gestion", "nombre": "Informe de gestión del ejercicio"},
        {"id": "informe_auditoria", "nombre": "Informe de auditoría (si obligatoria)", "condicion": "SI_AUDITORIA"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_JUNTA",
        "UNIVERSAL": "ACTA_JUNTA"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Lista de asistentes", "Orden del día", "Votaciones y resultados", "Acuerdos adoptados"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": null,
      "publicacion": [],
      "oposicion_acreedores": null
    },
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 2. DISTRIBUCION_DIVIDENDOS
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'DISTRIBUCION_DIVIDENDOS',
  '1.0.0',
  '{
    "id": "DISTRIBUCION_DIVIDENDOS",
    "materia": "DISTRIBUCION_DIVIDENDOS",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA", "PUBLICACION_ESTATUTOS"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Orden del día",
        "Propuesta de distribución de resultado"
      ],
      "documentosObligatorios": [
        {"id": "propuesta_distribucion", "nombre": "Propuesta de distribución de dividendos", "condicion": "SIEMPRE"},
        {"id": "informe_liquidez", "nombre": "Informe de liquidez (art. 348 LSC)", "condicion": "SI_SL"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > contra", "fuente": "LEY", "referencia": "art. 201.1 LSC"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 248.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "propuesta_distribucion", "nombre": "Propuesta de distribución de dividendos"},
        {"id": "cuentas_aprobadas", "nombre": "Cuentas anuales ya aprobadas (condición previa)"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Asistentes", "Votaciones", "Acuerdos"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 3. NOMBRAMIENTO_CONSEJERO
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'NOMBRAMIENTO_CONSEJERO',
  '1.0.0',
  '{
    "id": "NOMBRAMIENTO_CONSEJERO",
    "materia": "NOMBRAMIENTO_CONSEJERO",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA", "PUBLICACION_ESTATUTOS"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Orden del día con identificación del candidato",
        "Categoría propuesta del consejero"
      ],
      "documentosObligatorios": [
        {"id": "cv_candidato", "nombre": "Currículum vitae del candidato", "condicion": "SIEMPRE"},
        {"id": "informe_comision_nombramientos", "nombre": "Informe de la Comisión de Nombramientos", "condicion": "SI_COTIZADA"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC — cooptación"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > contra", "fuente": "LEY", "referencia": "art. 201.1 LSC"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC — cooptación"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "cv_candidato", "nombre": "CV del candidato"},
        {"id": "declaracion_idoneidad", "nombre": "Declaración de idoneidad y aceptación del cargo"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Asistentes", "Votación por candidato", "Proclamación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM — 30 días desde adopción del acuerdo"
      }
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "publicacionRequerida": false,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 4. CESE_CONSEJERO
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'CESE_CONSEJERO',
  '1.0.0',
  '{
    "id": "CESE_CONSEJERO",
    "materia": "CESE_CONSEJERO",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA", "PUBLICACION_ESTATUTOS"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": ["Fecha, hora y lugar", "Orden del día identificando al consejero afectado"],
      "documentosObligatorios": []
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > contra", "fuente": "LEY", "referencia": "art. 223.1 LSC — libre separación"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 223.1 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Asistentes", "Votación de cese", "Proclamación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM"
      }
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "publicacionRequerida": false,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM — cancelación del cargo cesado"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 5. DELEGACION_FACULTADES
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'DELEGACION_FACULTADES',
  '1.0.0',
  '{
    "id": "DELEGACION_FACULTADES",
    "materia": "DELEGACION_FACULTADES",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "art. 246.1 LSC — Consejo: según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "art. 246.1 LSC"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": ["Fecha, hora y lugar", "Materias a deliberar"],
      "documentosObligatorios": [
        {"id": "borrador_delegacion", "nombre": "Borrador del acuerdo de delegación con listado de facultades", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0,    "fuente": "LEY", "referencia": "no aplica — es acuerdo del Consejo"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "no aplica"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "no aplica"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC — mayoría consejeros asistentes"},
        "SL":     {"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "listado_facultades", "nombre": "Listado completo de facultades delegadas"},
        {"id": "exclusion_249bis", "nombre": "Verificación de exclusión de materias indelegables art. 249 bis LSC"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_CONSEJO"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Votación", "Acuerdo"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM — delegación permanente"
      }
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "publicacionRequerida": false,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 249.3 LSC — inscripción delegación permanente"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 6. MODIFICACION_ESTATUTOS
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'MODIFICACION_ESTATUTOS',
  '1.0.0',
  '{
    "id": "MODIFICACION_ESTATUTOS",
    "materia": "MODIFICACION_ESTATUTOS",
    "clase": "ESTATUTARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC — mínimo un mes para cotizadas"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Propuesta de texto íntegro de la modificación estatutaria",
        "Texto actual y texto propuesto de los artículos a modificar"
      ],
      "documentosObligatorios": [
        {"id": "propuesta_modificacion", "nombre": "Texto íntegro de la propuesta de modificación estatutaria", "condicion": "SIEMPRE"},
        {"id": "informe_admin", "nombre": "Informe del órgano de administración sobre la modificación", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.50, "fuente": "LEY", "referencia": "art. 194.1 LSC — 50% capital con voto en 1ª conv."},
        "SA_2a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 194.1 LSC — 25% en 2ª conv."},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC — sin quórum legal"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {
          "formula": "favor >= 2/3_emitidos",
          "fuente": "LEY",
          "referencia": "art. 194.1 LSC — 2/3 votos emitidos si 50% capital; mayoría simple si 2/3 capital presentes en 1ª conv.",
          "dobleCondicional": {
            "umbral": 0.50,
            "mayoriaAlternativa": "favor >= 2/3_emitidos"
          }
        },
        "SL":     {"formula": "favor >= 2/3_capital_con_voto", "fuente": "LEY", "referencia": "art. 199 LSC — más de 2/3 participaciones con voto"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "propuesta_modificacion", "nombre": "Propuesta íntegra de modificación"},
        {"id": "informe_admin_justificacion", "nombre": "Informe justificativo de la modificación"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Asistentes y capital presente", "Texto íntegro del acuerdo de modificación", "Resultado de votación con detalle de mayoría"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 60,
        "fuente": "LEY",
        "referencia": "art. 19 RRM"
      },
      "publicacion": ["BORME"]
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "publicacionRequerida": true,
      "plazoInscripcion": {
        "dias": 60,
        "fuente": "LEY",
        "referencia": "art. 19 RRM — modificación estatutaria"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 7. AUMENTO_CAPITAL
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'AUMENTO_CAPITAL',
  '1.0.0',
  '{
    "id": "AUMENTO_CAPITAL",
    "materia": "AUMENTO_CAPITAL",
    "clase": "ESTATUTARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Importe del aumento, forma de realización",
        "Información sobre derecho de suscripción preferente"
      ],
      "documentosObligatorios": [
        {"id": "propuesta_aumento", "nombre": "Propuesta de acuerdo de aumento de capital", "condicion": "SIEMPRE"},
        {"id": "informe_admin", "nombre": "Informe del órgano de administración (art. 296 LSC)", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.50, "fuente": "LEY", "referencia": "art. 194.1 LSC — modificación estatutaria"},
        "SA_2a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 194.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor >= 2/3_emitidos", "fuente": "LEY", "referencia": "art. 194.1 LSC — mayoría reforzada"},
        "SL":     {"formula": "favor >= 2/3_capital_con_voto", "fuente": "LEY", "referencia": "art. 199 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "propuesta_aumento", "nombre": "Propuesta íntegra de aumento de capital"},
        {"id": "informe_auditoria_aportaciones", "nombre": "Informe de auditor si aportación no dineraria", "condicion": "SI_NO_DINERARIO"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Capital presente", "Texto del acuerdo", "Resultado de votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {"plazo_dias": 60, "fuente": "LEY", "referencia": "art. 19 RRM"},
      "publicacion": ["BORME"]
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "publicacionRequerida": true,
      "plazoInscripcion": {"dias": 60, "fuente": "LEY", "referencia": "art. 19 RRM — aumento de capital"}
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 8. REDUCCION_CAPITAL
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'REDUCCION_CAPITAL',
  '1.0.0',
  '{
    "id": "REDUCCION_CAPITAL",
    "materia": "REDUCCION_CAPITAL",
    "clase": "ESTATUTARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Finalidad de la reducción",
        "Procedimiento de reducción y efectos para socios y acreedores"
      ],
      "documentosObligatorios": [
        {"id": "propuesta_reduccion", "nombre": "Propuesta de acuerdo de reducción de capital", "condicion": "SIEMPRE"},
        {"id": "balance_intermediario", "nombre": "Balance intermedio si no hay cuentas recientes", "condicion": "SEGÚN_CASO"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.50, "fuente": "LEY", "referencia": "art. 194.1 LSC"},
        "SA_2a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 194.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor >= 2/3_emitidos", "fuente": "LEY", "referencia": "art. 194.1 LSC"},
        "SL":     {"formula": "favor >= 2/3_capital_con_voto", "fuente": "LEY", "referencia": "art. 199 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "propuesta_reduccion", "nombre": "Propuesta íntegra de reducción de capital"},
        {"id": "informe_oposicion_acreedores", "nombre": "Publicación BORME para oposición acreedores (art. 319 LSC)", "condicion": "SI_DEVOLUCION_APORTACIONES"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Capital presente", "Texto del acuerdo con finalidad y procedimiento", "Resultado de votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {"plazo_dias": 60, "fuente": "LEY", "referencia": "art. 19 RRM"},
      "publicacion": ["BORME"],
      "oposicion_acreedores": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 319 LSC — plazo oposición acreedores si hay devolución de aportaciones"
      }
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "publicacionRequerida": true,
      "plazoInscripcion": {"dias": 60, "fuente": "LEY", "referencia": "art. 19 RRM — reducción de capital"}
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 9. OPERACION_VINCULADA
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'OPERACION_VINCULADA',
  '1.0.0',
  '{
    "id": "OPERACION_VINCULADA",
    "materia": "OPERACION_VINCULADA",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Identificación de la parte vinculada",
        "Naturaleza y condiciones económicas de la operación",
        "Beneficios y riesgos para la sociedad"
      ],
      "documentosObligatorios": [
        {"id": "informe_condiciones_mercado", "nombre": "Informe de condiciones de mercado o valoración independiente", "condicion": "SIEMPRE"},
        {"id": "informe_comision_auditoria", "nombre": "Informe favorable de Comisión de Auditoría (cotizadas)", "condicion": "SI_COTIZADA"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0, "fuente": "LEY", "referencia": "no aplica — decisión del Consejo"},
        "SA_2a": {"valor": 0, "fuente": "LEY", "referencia": "no aplica"},
        "SL":    {"valor": 0, "fuente": "LEY", "referencia": "no aplica"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > presentes_mitad_no_vinculados", "fuente": "LEY", "referencia": "art. 228.e LSC — vinculado excluido del voto"},
        "SL":     {"formula": "favor > presentes_mitad_no_vinculados", "fuente": "LEY", "referencia": "art. 228.e LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad_no_vinculados", "fuente": "LEY", "referencia": "art. 228.e LSC — consejero vinculado se abstiene"}
      },
      "abstenciones": "cuentan_como_contra",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "informe_valoracion", "nombre": "Informe de valoración o condiciones de mercado"},
        {"id": "declaracion_vinculacion", "nombre": "Declaración de la parte vinculada y naturaleza del vínculo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_CONSEJO"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Identificación parte vinculada", "Naturaleza y condiciones operación", "Abstenciones por conflicto", "Resultado votación sin vinculados"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 10. NOMBRAMIENTO_AUDITOR
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'NOMBRAMIENTO_AUDITOR',
  '1.0.0',
  '{
    "id": "NOMBRAMIENTO_AUDITOR",
    "materia": "NOMBRAMIENTO_AUDITOR",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Identificación del auditor o firma auditora propuesta",
        "Duración del contrato"
      ],
      "documentosObligatorios": [
        {"id": "propuesta_auditoria", "nombre": "Propuesta de la Comisión de Auditoría (cotizadas)", "condicion": "SI_COTIZADA"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > contra", "fuente": "LEY", "referencia": "art. 201.1 LSC"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "propuesta_nombramiento", "nombre": "Propuesta de nombramiento con duración y condiciones del contrato"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Asistentes", "Auditor nombrado con número ROAC", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {"plazo_dias": 30, "fuente": "LEY", "referencia": "art. 17 RRM"}
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false,
      "plazoInscripcion": {"dias": 30, "fuente": "LEY", "referencia": "art. 17 RRM — nombramiento auditor"}
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 11. APROBACION_PLAN_NEGOCIO
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'APROBACION_PLAN_NEGOCIO',
  '1.0.0',
  '{
    "id": "APROBACION_PLAN_NEGOCIO",
    "materia": "APROBACION_PLAN_NEGOCIO",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": ["Fecha, hora y lugar", "Presentación del plan de negocio"],
      "documentosObligatorios": [
        {"id": "plan_negocio", "nombre": "Plan de negocio o estratégico del ejercicio", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0, "fuente": "LEY", "referencia": "no aplica — decisión del Consejo"},
        "SA_2a": {"valor": 0, "fuente": "LEY", "referencia": "no aplica"},
        "SL":    {"valor": 0, "fuente": "LEY", "referencia": "no aplica"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"},
        "SL":     {"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "plan_negocio_doc", "nombre": "Documento del plan de negocio aprobado"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_CONSEJO"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Aprobación del plan de negocio", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 12. AUTORIZACION_GARANTIA
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'AUTORIZACION_GARANTIA',
  '1.0.0',
  '{
    "id": "AUTORIZACION_GARANTIA",
    "materia": "AUTORIZACION_GARANTIA",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC — si >25% activo: competencia JGA art. 160.f LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Naturaleza y cuantía de la garantía",
        "Beneficiario y operación garantizada"
      ],
      "documentosObligatorios": [
        {"id": "descripcion_garantia", "nombre": "Descripción de la garantía y evaluación del riesgo", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC"},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > contra", "fuente": "LEY", "referencia": "art. 201.1 LSC"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "descripcion_garantia", "nombre": "Descripción de la garantía y análisis de riesgo"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Descripción de la garantía", "Beneficiario", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- 13. RATIFICACION_ACTOS
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'RATIFICACION_ACTOS',
  '1.0.0',
  '{
    "id": "RATIFICACION_ACTOS",
    "materia": "RATIFICACION_ACTOS",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Descripción de los actos o contratos a ratificar",
        "Justificación de la urgencia que motivó la actuación previa"
      ],
      "documentosObligatorios": [
        {"id": "copia_acto_contrato", "nombre": "Copia del acto o contrato a ratificar", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0, "fuente": "LEY", "referencia": "no aplica — decisión del Consejo"},
        "SA_2a": {"valor": 0, "fuente": "LEY", "referencia": "no aplica"},
        "SL":    {"valor": 0, "fuente": "LEY", "referencia": "no aplica"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"},
        "SL":     {"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "copia_acto", "nombre": "Copia del acto o contrato ratificado"},
        {"id": "informe_justificacion", "nombre": "Informe sobre la urgencia y circunstancias del acto previo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {"MEETING": "ACTA_CONSEJO"},
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Descripción del acto ratificado", "Justificación", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_modelos_count INT;
  v_high_priority INT;
  v_stubs INT;
  v_packs_count INT;
  v_versions_with_payload INT;
BEGIN
  SELECT COUNT(*) INTO v_modelos_count
  FROM plantillas_protegidas
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND tipo = 'MODELO_ACUERDO';

  SELECT COUNT(*) INTO v_high_priority
  FROM plantillas_protegidas
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND tipo = 'MODELO_ACUERDO'
    AND estado = 'REVISADA';

  SELECT COUNT(*) INTO v_stubs
  FROM plantillas_protegidas
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND tipo = 'MODELO_ACUERDO'
    AND estado = 'BORRADOR';

  SELECT COUNT(*) INTO v_packs_count
  FROM rule_packs
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

  SELECT COUNT(*) INTO v_versions_with_payload
  FROM rule_pack_versions rpv
  JOIN rule_packs rp ON rp.id = rpv.pack_id
  WHERE rp.tenant_id = '00000000-0000-0000-0000-000000000001'
    AND rpv.payload ? 'clase'  -- real payload has 'clase' key
    AND rpv.is_active = true;

  RAISE NOTICE '=== Migration 000012 Verification ===';
  RAISE NOTICE 'MODELO_ACUERDO rows: % (expected: 13)', v_modelos_count;
  RAISE NOTICE '  High-priority (REVISADA): % (expected: 8)', v_high_priority;
  RAISE NOTICE '  Stubs (BORRADOR): % (expected: 9)', v_stubs;
  RAISE NOTICE 'Rule packs: % (expected: >=13)', v_packs_count;
  RAISE NOTICE 'Rule pack versions with real payload: % (expected: 13)', v_versions_with_payload;

  IF v_modelos_count < 13 THEN
    RAISE WARNING 'Expected at least 13 MODELO_ACUERDO rows, got %', v_modelos_count;
  END IF;

  IF v_versions_with_payload < 13 THEN
    RAISE WARNING 'Expected 13 rule_pack_versions with real payload, got %', v_versions_with_payload;
  END IF;

  RAISE NOTICE '=== End verification ===';
END $$;
