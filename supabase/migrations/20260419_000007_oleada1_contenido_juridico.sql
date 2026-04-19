-- Migration: 20260419_000007_oleada1_contenido_juridico.sql
-- Purpose: Update plantillas_protegidas with Oleada 1 legal content (3-layer template model)
-- Date: 2026-04-19
-- Author: Legal Team + Development
-- Status: PRODUCTION-READY

-- ============================================================================
-- STEP 1: Add columns for 3-layer template model
-- ============================================================================

ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS capa1_inmutable TEXT,
  ADD COLUMN IF NOT EXISTS capa2_variables JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS capa3_editables JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS referencia_legal TEXT,
  ADD COLUMN IF NOT EXISTS notas_legal TEXT;

-- ============================================================================
-- STEP 2: Verify CHECK constraint on tipo column
-- ============================================================================
-- The existing CHECK constraint should already include ACTA_SESION
-- No change needed — ACTA_JUNTA and ACTA_CONSEJO are differentiated by organo_tipo

-- ============================================================================
-- PLANTILLA 1: Acta Junta General
-- Matches: tipo=ACTA_SESION, adoption_mode=MEETING, organo_tipo=JUNTA_GENERAL
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$ACTA DE LA JUNTA GENERAL {{tipo_junta}} DE {{denominacion_social}}

En {{lugar}}, siendo las {{hora_inicio}} horas del día {{fecha}}, se reúnen en el domicilio social sito en {{domicilio_social}}, los socios de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, inscrita en el Registro Mercantil de {{registro_mercantil}}, al Tomo {{tomo}}, Folio {{folio}}, Hoja {{hoja}}, Inscripción {{inscripcion}} (en adelante, la "Sociedad"), al efecto de celebrar Junta General {{tipo_junta_texto}}.

{{#if modo_adopcion == 'UNIVERSAL'}}
Hallándose presentes o representados los socios que representan la totalidad del capital social, se constituye la Junta con carácter de universal de conformidad con el artículo 178 de la Ley de Sociedades de Capital (en adelante, "LSC"), aceptando por unanimidad todos los asistentes la celebración de la reunión y el orden del día que a continuación se expresa.
{{else}}
La Junta ha sido convocada por {{organo_convocante}} con fecha {{fecha_convocatoria}}, habiéndose publicado el anuncio de convocatoria en {{medio_publicacion}} con fecha {{fecha_publicacion_convocatoria}}, con una antelación de {{dias_antelacion}} días respecto de la fecha prevista para la reunión, cumpliéndose el plazo mínimo establecido en el artículo 176 LSC.
{{/if}}

Actúa como Presidente D./Dña. {{presidente}}, y como Secretario D./Dña. {{secretario}}, quienes ostentan dichos cargos conforme a {{base_cargo_mesa}}.

Conforme a la lista de asistentes que se incorpora como Anexo I de la presente acta, se encuentran presentes o representados socios titulares de participaciones/acciones que representan el {{quorum_observado}}% del capital social.

{{#if quorum_primera_convocatoria}}
Siendo dicho porcentaje igual o superior al {{quorum_requerido}}% exigido en {{quorum_fuente}} ({{quorum_referencia_legal}}) para la válida constitución de la Junta en {{convocatoria_ordinal}} convocatoria, queda válidamente constituida la Junta General {{tipo_junta_texto}} para deliberar y resolver sobre los asuntos comprendidos en el orden del día.
{{/if}}

{{#if modo_adopcion == 'UNIVERSAL'}}
Al hallarse presente o representada la totalidad del capital social y haberse aceptado unánimemente la celebración de la Junta, esta queda válidamente constituida con carácter de universal conforme al artículo 178 LSC, sin necesidad de previa convocatoria.
{{/if}}

El orden del día de la presente Junta es el siguiente:

{{#each orden_dia}}
{{ordinal}}. {{descripcion_punto}}
{{/each}}

{{#each puntos_votacion}}
{{ordinal}}. {{materia}}

{{#if proclamable}}
{{#if tipo_mayoria == 'SIMPLE'}}
Sometida a votación la propuesta relativa al punto {{ordinal}} del orden del día, el acuerdo queda APROBADO por mayoría simple, con {{votos_favor}} votos a favor, {{votos_contra}} votos en contra y {{abstenciones}} abstenciones, de conformidad con el artículo 201.1 LSC.
{{/if}}
{{#if tipo_mayoria == 'REFORZADA_LEGAL'}}
Sometida a votación la propuesta, el acuerdo queda APROBADO por mayoría reforzada, habiendo votado a favor socios representantes del {{porcentaje_favor}}% del capital presente con derecho a voto, superando el umbral del {{umbral_reforzado}}% exigido por el artículo {{articulo_mayoria}} LSC.
{{/if}}
{{#if tipo_mayoria == 'REFORZADA_ESTATUTARIA'}}
Sometida a votación la propuesta, el acuerdo queda APROBADO por mayoría reforzada estatutaria, superando el umbral del {{umbral_reforzado}}% establecido en el artículo {{articulo_estatutos}} de los Estatutos Sociales.
{{/if}}
{{#if tipo_mayoria == 'UNANIMIDAD'}}
Sometida a votación la propuesta, el acuerdo queda APROBADO por unanimidad de todos los socios con derecho a voto presentes o representados.
{{/if}}
{{else}}
Sometida a votación la propuesta, el acuerdo NO RESULTA APROBADO, al no haberse alcanzado la mayoría requerida de conformidad con {{mayoria_referencia_legal}}. Han votado a favor {{votos_favor}} votos, en contra {{votos_contra}} votos, con {{abstenciones}} abstenciones.
{{/if}}

{{#if conflictos_interes_punto}}
Nota sobre conflicto de interés: De conformidad con el artículo 190 LSC, {{#each socios_conflictuados}}D./Dña. {{nombre}}, titular del {{porcentaje_capital}}% del capital social, ha sido excluido/a del {{exclusion_tipo}} por concurrir situación de conflicto de interés ({{motivo_conflicto}}). El denominador para el cómputo de la mayoría ha sido ajustado a {{denominador_ajustado}} votos.{{/each}}
{{/if}}
{{/each}}

Se hace constar a los efectos oportunos:
(i) Que la presente acta, una vez aprobada, tiene la fuerza probatoria prevista en los artículos 97 y siguientes del Reglamento del Registro Mercantil.
(ii) Que los acuerdos adoptados son impugnables en los términos y plazos establecidos en los artículos 204 y siguientes LSC.
(iii) Que aquellos acuerdos inscribibles deberán ser objeto de la correspondiente escritura pública e inscripción registral para su plena eficacia frente a terceros.

La evaluación de la válida constitución de la Junta, del cómputo de mayorías y de la proclamación de acuerdos ha sido realizada mediante el Motor de Reglas LSC, con los siguientes parámetros de trazabilidad:
- Rule Pack aplicado: {{snapshot_rule_pack_id}} versión {{snapshot_rule_pack_version}}
- Hash del Ruleset (SHA-256): {{snapshot_hash}}
- Sello cualificado de tiempo (TSQ): {{tsq_token}}
- Resultado global del Gate: {{resultado_gate}}

No habiendo más asuntos que tratar, el Presidente levanta la sesión siendo las {{hora_fin}} horas del día indicado en el encabezamiento.

El Secretario:
Fdo.: {{secretario}}
Firma electrónica cualificada: {{firma_qes_ref}}
Validación OCSP: {{ocsp_status}} a {{firma_qes_timestamp}}

VºBº El Presidente:
Fdo.: {{presidente}}
Firma electrónica cualificada: {{firma_qes_presidente_ref}}
Validación OCSP: {{ocsp_presidente_status}} a {{firma_qes_presidente_timestamp}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "domicilio_social", "fuente": "entities.domicilio", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "tipo_junta", "fuente": "rule_pack.materia", "condicion": "SIEMPRE"},
  {"variable": "modo_adopcion", "fuente": "agreement.adoption_mode", "condicion": "SIEMPRE"},
  {"variable": "fecha", "fuente": "meeting.fecha", "condicion": "MEETING/UNIVERSAL"},
  {"variable": "lugar", "fuente": "meeting.lugar", "condicion": "MEETING/UNIVERSAL"},
  {"variable": "presidente", "fuente": "meeting.mesa.presidente", "condicion": "SIEMPRE"},
  {"variable": "secretario", "fuente": "meeting.mesa.secretario", "condicion": "SIEMPRE"},
  {"variable": "quorum_observado", "fuente": "evaluarConstitucion().quorum_pct", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate", "fuente": "evaluarAcuerdoCompleto().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "deliberaciones", "obligatoriedad": "OBLIGATORIO", "descripcion": "Resumen de los asuntos debatidos (art. 97.1.6º RRM)"},
  {"campo": "texto_decision", "obligatoriedad": "OBLIGATORIO", "descripcion": "Contenido del acuerdo adoptado"},
  {"campo": "observaciones_presidente", "obligatoriedad": "OPCIONAL", "descripcion": "Observaciones del presidente sobre el desarrollo de la Junta"},
  {"campo": "ruegos_preguntas", "obligatoriedad": "OPCIONAL", "descripcion": "Ruegos y preguntas si el orden del día lo incluye"},
  {"campo": "declaracion_conflictos", "obligatoriedad": "OBLIGATORIO_SI_CONFLICTOS", "descripcion": "Conflictos de interés adicionales no registrados en el sistema"},
  {"campo": "reservas_voto", "obligatoriedad": "OPCIONAL", "descripcion": "Constancia de oposición para impugnación (art. 206.1 LSC)"}
]$$::jsonb,

  referencia_legal = 'Arts. 97-103 RRM, arts. 193-194, 197, 200-202, 204 LSC',
  notas_legal = 'Oleada 1: Plantilla estándar para Juntas Generales de Accionistas conforme a derecho español. Incluye soporte para distintos modos de adopción (MEETING, UNIVERSAL). Gate de validez integrado con rule pack.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_SESION'
  AND adoption_mode = 'MEETING'
  AND organo_tipo = 'JUNTA_GENERAL';

-- ============================================================================
-- PLANTILLA 2: Acta Consejo de Administración
-- Matches: tipo=ACTA_SESION, adoption_mode=MEETING, organo_tipo=CONSEJO
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$ACTA DE LA REUNIÓN DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}}

En {{lugar}}, siendo las {{hora_inicio}} horas del día {{fecha}}, se reúne el Consejo de Administración de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, inscrita en el Registro Mercantil de {{registro_mercantil}}, previa convocatoria realizada por {{convocante_consejo}} con fecha {{fecha_convocatoria_consejo}}.

Actúa como Presidente del Consejo D./Dña. {{presidente}}, y como Secretario D./Dña. {{secretario}}, {{#if secretario_no_consejero}}quien actúa en su condición de Secretario no consejero del Consejo de Administración{{else}}en su condición de consejero-secretario{{/if}}.

Asisten a la reunión los siguientes consejeros:
{{#each lista_consejeros}}
- D./Dña. {{nombre}} — {{tipo_consejero}} {{#if representado_por}}(representado por D./Dña. {{representado_por}}){{/if}}
{{/each}}

Estando presentes o representados {{consejeros_presentes}} de los {{consejeros_totales}} miembros que componen el Consejo de Administración, queda válidamente constituido el órgano de conformidad con el artículo 247 LSC.

{{#each puntos_votacion}}
{{ordinal}}. {{materia}}

{{#if proclamable}}
Sometida a votación la propuesta, el acuerdo queda APROBADO por mayoría absoluta de los consejeros asistentes a la sesión, con {{votos_favor}} votos a favor, {{votos_contra}} votos en contra y {{abstenciones}} abstenciones, de conformidad con el artículo 248.1 LSC.
{{#if voto_calidad_presidente}}El empate ha sido dirimido por el voto de calidad del Presidente.{{/if}}
{{else}}
Sometida a votación la propuesta, el acuerdo NO RESULTA APROBADO, al no haberse alcanzado la mayoría absoluta de los consejeros asistentes requerida por el artículo 248.1 LSC.
{{/if}}

{{#if conflictos_interes_punto}}
Nota sobre conflicto de interés: De conformidad con el artículo 229 LSC, {{#each consejeros_conflictuados}}D./Dña. {{nombre}} se ha abstenido de participar en la deliberación y votación por concurrir situación de conflicto de interés ({{motivo_conflicto}}). Denominador ajustado a {{denominador_ajustado}} consejeros.{{/each}}
{{/if}}
{{/each}}

{{#if formulacion_cuentas}}
El Consejo de Administración, en cumplimiento del artículo 253 LSC, ha procedido a la formulación de las cuentas anuales del ejercicio cerrado a {{fecha_cierre_ejercicio}}.
{{/if}}

Se hace constar:
(i) Que la presente acta tiene la fuerza probatoria prevista en los artículos 97 y ss. RRM.
(ii) Que los acuerdos son impugnables conforme a los artículos 204 y ss. LSC por remisión del artículo 251 LSC.
(iii) Que el deber de secreto del artículo 232 LSC resulta de aplicación.

Trazabilidad:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash SHA-256: {{snapshot_hash}}
- TSQ: {{tsq_token}}
- Gate: {{resultado_gate}}

El Secretario: Fdo.: {{secretario}} — QES: {{firma_qes_ref}} — OCSP: {{ocsp_status}}
VºBº El Presidente: Fdo.: {{presidente}} — QES: {{firma_qes_presidente_ref}} — OCSP: {{ocsp_presidente_status}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "fecha", "fuente": "meeting.fecha", "condicion": "MEETING"},
  {"variable": "lugar", "fuente": "meeting.lugar", "condicion": "MEETING"},
  {"variable": "presidente", "fuente": "meeting.mesa.presidente", "condicion": "SIEMPRE"},
  {"variable": "secretario", "fuente": "meeting.mesa.secretario", "condicion": "SIEMPRE"},
  {"variable": "lista_consejeros", "fuente": "consejeros.miembros", "condicion": "SIEMPRE"},
  {"variable": "consejeros_presentes", "fuente": "evaluarConstitucion().consejeros_presentes", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate", "fuente": "evaluarAcuerdoCompleto().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "deliberaciones", "obligatoriedad": "OBLIGATORIO", "descripcion": "Resumen de asuntos debatidos (art. 97.1.6º RRM)"},
  {"campo": "texto_decision", "obligatoriedad": "OBLIGATORIO", "descripcion": "Contenido del acuerdo"},
  {"campo": "observaciones_presidente", "obligatoriedad": "OPCIONAL", "descripcion": "Observaciones adicionales"},
  {"campo": "declaracion_conflictos", "obligatoriedad": "OBLIGATORIO_SI_CONFLICTOS", "descripcion": "Conflictos de interés adicionales"},
  {"campo": "reservas_voto", "obligatoriedad": "OPCIONAL", "descripcion": "Especialmente relevante para salvar responsabilidad solidaria (art. 237 LSC)"}
]$$::jsonb,

  referencia_legal = 'Arts. 245-250 LSC, arts. 97-103 RRM',
  notas_legal = 'Oleada 1: Plantilla para Consejos de Administración. Incluye mecánica de voto de calidad del Presidente conforme a Estatutos.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_SESION'
  AND adoption_mode = 'MEETING'
  AND organo_tipo = 'CONSEJO';

-- ============================================================================
-- PLANTILLA 3: Consignación Socio Único
-- Matches: tipo=ACTA_CONSIGNACION, adoption_mode=UNIPERSONAL_SOCIO
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$DECISIÓN DEL SOCIO ÚNICO DE {{denominacion_social}}

En {{lugar}}, a {{fecha}}, D./Dña. {{identidad_decisor}}, con {{tipo_documento_identidad}} nº {{numero_documento_identidad}}, en su condición de socio único de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, inscrita en el Registro Mercantil de {{registro_mercantil}}, en ejercicio de las competencias que le atribuye el artículo 15 de la Ley de Sociedades de Capital (en adelante, "LSC"), adopta la(s) siguiente(s) decisión(es):

{{#each decisiones}}
{{ordinal}}. {{materia}}
{{texto_decision}}
La presente decisión queda ADOPTADA por el socio único en ejercicio de las competencias de la Junta General, de conformidad con el artículo 15.1 LSC.
{{/each}}

De conformidad con el artículo 15.2 LSC, las decisiones del socio único serán transcritas en el correspondiente Libro de Actas.

En las relaciones contractuales entre el socio único y la Sociedad, se estará a lo dispuesto en el artículo 16 LSC.

Trazabilidad:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash SHA-256: {{snapshot_hash}}
- TSQ: {{tsq_token}}
- Gate: {{resultado_gate}}

El Socio Único:
Fdo.: {{identidad_decisor}}
QES: {{firma_qes_ref}} — OCSP: {{ocsp_status}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "identidad_decisor", "fuente": "unipersonal_decision.socio_unico", "condicion": "SIEMPRE"},
  {"variable": "fecha", "fuente": "unipersonal_decision.fecha", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate", "fuente": "evaluarAcuerdoCompleto().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "texto_decision", "obligatoriedad": "OBLIGATORIO", "descripcion": "Contenido de la decisión adoptada"},
  {"campo": "observaciones_decisor", "obligatoriedad": "OPCIONAL", "descripcion": "Justificación o motivación de la decisión"},
  {"campo": "documentacion_adjunta", "obligatoriedad": "OPCIONAL", "descripcion": "Referencias a informes, contratos o documentación de soporte"}
]$$::jsonb,

  referencia_legal = 'Art. 15 LSC',
  notas_legal = 'Oleada 1: Decisiones de socio único en SL. No requiere sesión. Transcripción obligatoria en Libro de Actas.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_CONSIGNACION'
  AND adoption_mode = 'UNIPERSONAL_SOCIO';

-- ============================================================================
-- PLANTILLA 4: Acta Consignación Administrador Único
-- Matches: tipo=ACTA_CONSIGNACION, adoption_mode=UNIPERSONAL_ADMIN
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$DECISIÓN DEL ADMINISTRADOR ÚNICO DE {{denominacion_social}}

En {{lugar}}, a {{fecha}}, D./Dña. {{identidad_decisor}}, con {{tipo_documento_identidad}} nº {{numero_documento_identidad}}, en su condición de administrador único de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, inscrita en el Registro Mercantil de {{registro_mercantil}}, en materias de su competencia como órgano de administración, adopta la(s) siguiente(s) decisión(es):

{{#each decisiones}}
{{ordinal}}. {{materia}}
{{texto_decision}}
La presente decisión queda ADOPTADA por el administrador único.
{{/each}}

De conformidad con el artículo 15.2 LSC, las decisiones serán transcritas en el correspondiente Libro de Actas.

Trazabilidad:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash SHA-256: {{snapshot_hash}}
- TSQ: {{tsq_token}}
- Gate: {{resultado_gate}}

El Administrador Único:
Fdo.: {{identidad_decisor}}
QES: {{firma_qes_ref}} — OCSP: {{ocsp_status}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "identidad_decisor", "fuente": "unipersonal_decision.administrador", "condicion": "SIEMPRE"},
  {"variable": "fecha", "fuente": "unipersonal_decision.fecha", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate", "fuente": "evaluarAcuerdoCompleto().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "texto_decision", "obligatoriedad": "OBLIGATORIO", "descripcion": "Contenido de la decisión ejecutoria"},
  {"campo": "observaciones_administrador", "obligatoriedad": "OPCIONAL", "descripcion": "Justificación o contexto de la decisión"},
  {"campo": "documentacion_soporte", "obligatoriedad": "OPCIONAL", "descripcion": "Referencias a documentación de soporte"}
]$$::jsonb,

  referencia_legal = 'Art. 15 LSC',
  notas_legal = 'Oleada 1: Decisiones de administrador único. Capa ejecutoria. Transcripción obligatoria en Libro de Actas.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_CONSIGNACION'
  AND adoption_mode = 'UNIPERSONAL_ADMIN';

-- ============================================================================
-- PLANTILLA 5: Acta Acuerdo Escrito Sin Sesión
-- Matches: tipo=ACTA_ACUERDO_ESCRITO, adoption_mode=NO_SESSION
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $${{#if tipo_proceso == 'UNANIMIDAD_ESCRITA_SL'}}
ACTA DE ACUERDO ADOPTADO SIN CELEBRACIÓN DE SESIÓN — JUNTA GENERAL DE {{denominacion_social}}

De conformidad con el artículo 159.2 de la Ley de Sociedades de Capital (en adelante, "LSC"), que permite que en las sociedades de responsabilidad limitada la junta general se sustituya por el consentimiento escrito de todos los socios sin necesidad de celebrar sesión, se hace constar que los socios de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, inscrita en el Registro Mercantil de {{registro_mercantil}}, han adoptado el/los siguiente/s acuerdo/s por consentimiento escrito y sin celebración de sesión.
{{/if}}

{{#if tipo_proceso == 'CIRCULACION_CONSEJO'}}
ACTA DE ACUERDO DEL CONSEJO DE ADMINISTRACIÓN ADOPTADO POR ESCRITO Y SIN SESIÓN — {{denominacion_social}}

De conformidad con el artículo 248.2 de la Ley de Sociedades de Capital (en adelante, "LSC"), se hace constar que el Consejo ha adoptado el/los siguiente/s acuerdo/s por circulación escrita sin celebración de sesión.
{{/if}}

Con fecha {{fecha_propuesta}}, {{proponente}} remitió a {{#if tipo_proceso == 'UNANIMIDAD_ESCRITA_SL'}}todos los socios{{else}}todos los miembros del Consejo{{/if}} la siguiente propuesta:

Materia: {{materia}}
Texto de la propuesta: {{propuesta_texto}}

La propuesta fue notificada por {{canal_notificacion}} con fecha {{fecha_notificacion}}.

Ventana de consentimiento: desde {{ventana_inicio}} hasta {{ventana_fin}} ({{ventana_dias_habiles}} días hábiles).

{{#if cierre_anticipado}}
La ventana se cerró anticipadamente con fecha {{fecha_cierre}} al haberse cumplido la condición de adopción.
{{/if}}

Relación de respuestas:
{{#each relacion_respuestas}}
D./Dña. {{nombre}} — {{participacion_o_cargo}} — {{sentido}} — {{fecha_respuesta}} — QES: {{firma_qes_ref}} — OCSP: {{ocsp_status}}
{{/each}}

{{#if silencios}}
Destinatarios sin respuesta:
{{#each silencios}}
- D./Dña. {{nombre}} ({{participacion_o_cargo}}) — SILENCIO (no equivale a consentimiento)
{{/each}}
{{/if}}

{{#if tipo_proceso == 'UNANIMIDAD_ESCRITA_SL'}}
{{#if proclamable}}
Habiendo manifestado por escrito su consentimiento la totalidad de los socios (100% del capital), el acuerdo queda ADOPTADO por unanimidad y sin celebración de sesión, de conformidad con el artículo 159.2 LSC.
{{else}}
El acuerdo NO QUEDA ADOPTADO por la vía de consentimiento escrito sin sesión.
{{/if}}
{{/if}}

{{#if tipo_proceso == 'CIRCULACION_CONSEJO'}}
Verificación del procedimiento (art. 248.2 LSC): Ningún consejero se ha opuesto al procedimiento de votación por escrito.
{{#if proclamable}}
Habiendo votado a favor {{votos_favor}} de los {{participantes}} consejeros, el acuerdo queda ADOPTADO por escrito y sin sesión.
{{else}}
El acuerdo NO RESULTA APROBADO al no haberse alcanzado la mayoría requerida.
{{/if}}
{{/if}}

Se hace constar:
(i) Que la presente acta tiene la fuerza probatoria prevista en los artículos 97 y ss. RRM.
(ii) Que los acuerdos sin sesión son impugnables en los mismos términos que los adoptados en sesión.
(iii) Que el expediente electrónico queda archivado como evidence bundle verificable con hash {{evidence_bundle_hash}}.

Trazabilidad:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash SHA-256: {{snapshot_hash}}
- TSQ: {{tsq_token}}
- Gate: {{resultado_gate}}
- Evidence bundle hash: {{evidence_bundle_hash}}

El Secretario: Fdo.: {{secretario}} — QES: {{firma_qes_ref}} — OCSP: {{ocsp_status}}
VºBº El Presidente: Fdo.: {{presidente}} — QES: {{firma_qes_presidente_ref}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "tipo_proceso", "fuente": "no_session_resolution.tipo_proceso", "condicion": "SIEMPRE"},
  {"variable": "proponente", "fuente": "no_session_resolution.proponente", "condicion": "SIEMPRE"},
  {"variable": "fecha_propuesta", "fuente": "no_session_resolution.fecha_propuesta", "condicion": "SIEMPRE"},
  {"variable": "ventana_inicio", "fuente": "no_session_resolution.ventana_inicio", "condicion": "SIEMPRE"},
  {"variable": "ventana_fin", "fuente": "no_session_resolution.ventana_fin", "condicion": "SIEMPRE"},
  {"variable": "relacion_respuestas", "fuente": "no_session_resolution.respuestas", "condicion": "SIEMPRE"},
  {"variable": "proclamable", "fuente": "evaluarAcuerdoCompleto().proclamable", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "evidence_bundle_hash", "fuente": "createEvidenceBundle().hash", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "texto_decision", "obligatoriedad": "OBLIGATORIO", "descripcion": "Contenido íntegro del acuerdo adoptado"},
  {"campo": "observaciones", "obligatoriedad": "OPCIONAL", "descripcion": "Observaciones sobre el proceso de votación"},
  {"campo": "conflictos_procesales", "obligatoriedad": "OPCIONAL", "descripcion": "Indicación de cualquier conflicto de interés o procesual"}
]$$::jsonb,

  referencia_legal = 'Art. 159.2 LSC, art. 248.2 LSC, art. 100 RRM',
  notas_legal = 'Oleada 1: Acuerdos sin sesión (unanimidad en SL y circulación en Consejo). Cierre de ventana manual o por unanimidad. Evidence bundle integrado.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_ACUERDO_ESCRITO'
  AND adoption_mode = 'NO_SESSION';

-- ============================================================================
-- PLANTILLA 6: Certificación
-- Matches: tipo=CERTIFICACION, adoption_mode IS NULL
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$CERTIFICACIÓN DE ACUERDOS

D./Dña. {{secretario}}, en su condición de {{cargo_secretario}} de {{organo_certificado}} de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, inscrita en el Registro Mercantil de {{registro_mercantil}},

CERTIFICO:

{{#if modo_adopcion == 'MEETING'}}
Que en la {{tipo_sesion}} de la {{organo_certificado}} de la Sociedad, celebrada en {{lugar}} el día {{fecha}}, válidamente constituida conforme a los artículos {{articulos_constitucion}} LSC, se adoptó, entre otros, el siguiente acuerdo:
{{/if}}

{{#if modo_adopcion == 'UNIVERSAL'}}
Que en Junta General Universal de la Sociedad, celebrada el día {{fecha}} con la asistencia de la totalidad de los socios, constituida al amparo del artículo 178 LSC, se adoptó el siguiente acuerdo:
{{/if}}

{{#if modo_adopcion == 'NO_SESSION'}}
{{#if tipo_proceso == 'UNANIMIDAD_ESCRITA_SL'}}
Que por acuerdo adoptado sin celebración de sesión, mediante el consentimiento escrito de la totalidad de los socios al amparo del artículo 159.2 LSC, con fecha de cierre {{fecha_cierre}}, se adoptó el siguiente acuerdo:
{{/if}}
{{#if tipo_proceso == 'CIRCULACION_CONSEJO'}}
Que por acuerdo del Consejo adoptado por escrito y sin sesión, al amparo del artículo 248.2 LSC, con fecha de cierre {{fecha_cierre}}, se adoptó el siguiente acuerdo:
{{/if}}
{{/if}}

{{#if modo_adopcion == 'UNIPERSONAL_SOCIO'}}
Que por decisión del socio único, D./Dña. {{identidad_decisor}}, de conformidad con el artículo 15 LSC con fecha {{fecha}}, se adoptó la siguiente decisión:
{{/if}}

{{#if modo_adopcion == 'UNIPERSONAL_ADMIN'}}
Que por decisión del administrador único, D./Dña. {{identidad_decisor}}, con fecha {{fecha}}, se adoptó la siguiente decisión:
{{/if}}

"{{texto_acuerdo_certificado}}"

El citado acuerdo fue adoptado {{resultado_adopcion_texto}}.

{{#if acta_aprobada}}
Que el acta fue aprobada {{forma_aprobacion_acta}}.
{{else}}
Que el acta se encuentra pendiente de aprobación (art. 112 RRM).
{{/if}}

{{#if requiere_conformidad_conjunta}}
La presente certificación se expide con la conformidad conjunta del Presidente, D./Dña. {{presidente}}, de conformidad con el artículo 109.3 RRM, al {{motivo_conformidad_conjunta}}.
{{/if}}

Trazabilidad:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash SHA-256: {{snapshot_hash}}
- TSQ: {{tsq_token}}
- Gate: {{resultado_gate}}

Y para que así conste, expido la presente certificación en {{lugar}}, a {{fecha_certificacion}}.

El Secretario: Fdo.: {{secretario}} — QES: {{firma_qes_ref}} — OCSP: {{ocsp_status}}
{{#if requiere_conformidad_conjunta}}
VºBº El Presidente: Fdo.: {{presidente}} — QES: {{firma_qes_presidente_ref}}
{{/if}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "secretario", "fuente": "certification.expedidor", "condicion": "SIEMPRE"},
  {"variable": "organo_certificado", "fuente": "agreement.adoption_mode", "condicion": "SIEMPRE"},
  {"variable": "modo_adopcion", "fuente": "agreement.adoption_mode", "condicion": "SIEMPRE"},
  {"variable": "texto_acuerdo_certificado", "fuente": "agreement.proposal_text", "condicion": "SIEMPRE"},
  {"variable": "resultado_adopcion_texto", "fuente": "agreement.status", "condicion": "SIEMPRE"},
  {"variable": "acta_aprobada", "fuente": "meeting.status == 'APROBADA'", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "texto_acuerdo_certificado", "obligatoriedad": "OBLIGATORIO", "descripcion": "Reproducción íntegra del acuerdo certificado"},
  {"campo": "aclaraciones", "obligatoriedad": "OPCIONAL", "descripcion": "Aclaraciones o contexto sobre el acuerdo"},
  {"campo": "salvedades", "obligatoriedad": "OPCIONAL", "descripcion": "Salvedades o observaciones relevantes"}
]$$::jsonb,

  referencia_legal = 'Arts. 109-112 RRM',
  notas_legal = 'Oleada 1: Certificaciones de acuerdos en todos los modos de adopción. Conforme a RRM. Requiere conformidad conjunta cuando acta pendiente de aprobación.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'CERTIFICACION'
  AND adoption_mode IS NULL;

-- ============================================================================
-- PLANTILLA 7: Convocatoria
-- Matches: tipo=CONVOCATORIA, adoption_mode=MEETING
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$CONVOCATORIA DE JUNTA GENERAL {{tipo_junta_texto}} DE {{denominacion_social}}

El {{organo_convocante}} de la mercantil {{denominacion_social}}, con C.I.F. {{cif}}, con domicilio social en {{domicilio_social}}, inscrita en el Registro Mercantil de {{registro_mercantil}},

CONVOCA

a los señores {{#if forma_social == 'SA'}}accionistas{{else}}socios{{/if}} de la Sociedad a la Junta General {{tipo_junta_texto}} que se celebrará:

Fecha: {{fecha_junta}}
Hora: {{hora_primera_convocatoria}}
{{#if segunda_convocatoria}}
Hora en segunda convocatoria: {{hora_segunda_convocatoria}} (el día {{fecha_segunda_convocatoria}})
{{/if}}
Lugar: {{lugar_junta}}

Orden del día:
{{#each orden_dia}}
{{ordinal}}. {{descripcion_punto}}
{{/each}}

{{#if forma_social == 'SA'}}
De conformidad con el artículo 197 LSC, se informa a los señores accionistas de su derecho a solicitar por escrito, con anterioridad a la celebración de la Junta, o verbalmente durante la misma, las informaciones o aclaraciones que estimen precisas acerca de los asuntos comprendidos en el orden del día.
{{else}}
De conformidad con el artículo 196 LSC, se informa al socio de su derecho a examinar en el domicilio social la documentación relativa a los asuntos comprendidos en el orden del día.
{{/if}}

{{#if documentacion_disponible}}
Documentación disponible en el domicilio social:
{{#each documentacion}}
- {{descripcion}}
{{/each}}
{{/if}}

{{#if forma_social == 'SA'}}
El presente anuncio se publica en {{medio_publicacion}}, con una antelación mínima de un mes respecto de la fecha de la Junta (art. 176 LSC).
{{else}}
La presente convocatoria se remite individualmente a cada socio mediante {{canal_notificacion}}, con una antelación de {{dias_antelacion}} días (art. 176.1 LSC).
{{/if}}

Trazabilidad:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash SHA-256: {{snapshot_hash}}
- TSQ: {{tsq_token}}
- Gate convocatoria: {{resultado_gate_convocatoria}}

En {{lugar_emision}}, a {{fecha_emision}}.
{{organo_convocante}}
Fdo.: {{firmante_convocatoria}}
QES: {{firma_qes_ref}}$$,

  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "domicilio_social", "fuente": "entities.domicilio", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "forma_social", "fuente": "entities.forma_social", "condicion": "SIEMPRE"},
  {"variable": "tipo_junta_texto", "fuente": "convocatoria.tipo_junta", "condicion": "SIEMPRE"},
  {"variable": "fecha_junta", "fuente": "convocatoria.fecha_junta", "condicion": "SIEMPRE"},
  {"variable": "lugar_junta", "fuente": "convocatoria.lugar_junta", "condicion": "SIEMPRE"},
  {"variable": "orden_dia", "fuente": "convocatoria.orden_dia", "condicion": "SIEMPRE"},
  {"variable": "medio_publicacion", "fuente": "convocatoria.medio_publicacion", "condicion": "SA"},
  {"variable": "canal_notificacion", "fuente": "convocatoria.canal_notificacion", "condicion": "SL"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate_convocatoria", "fuente": "evaluarConvocatoria().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "orden_dia_puntos", "obligatoriedad": "OBLIGATORIO", "descripcion": "Puntos específicos del orden del día"},
  {"campo": "documentacion_referencia", "obligatoriedad": "OBLIGATORIO", "descripcion": "Documentación que va a disposición de socios"},
  {"campo": "instrucciones_acceso", "obligatoriedad": "OPCIONAL", "descripcion": "Instrucciones para participación (voto electrónico, etc.)"},
  {"campo": "observaciones", "obligatoriedad": "OPCIONAL", "descripcion": "Cualquier aclaración adicional relevante"}
]$$::jsonb,

  referencia_legal = 'Arts. 166-177, 196-197 LSC',
  notas_legal = 'Oleada 1: Convocatorias conforme a LSC. Validación de plazo, medio, orden del día. Diferenciación SA/SL. Gate integrado.',
  estado = 'REVISADA',
  version = '1.0.0',
  contrato_variables_version = 'v1.0.0'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'CONVOCATORIA'
  AND adoption_mode = 'MEETING';

-- ============================================================================
-- Final verification: Confirm all 7 plantillas have been updated
-- ============================================================================

DO $$
DECLARE
  total_updated INT;
BEGIN
  SELECT COUNT(*) INTO total_updated
  FROM plantillas_protegidas
  WHERE
    tenant_id = '00000000-0000-0000-0000-000000000001'
    AND estado = 'REVISADA'
    AND version = '1.0.0'
    AND capa1_inmutable IS NOT NULL;

  IF total_updated = 7 THEN
    RAISE NOTICE 'MIGRATION SUCCESSFUL: All 7 Oleada 1 plantillas updated with legal content (capa1_inmutable, capa2_variables, capa3_editables)';
  ELSE
    RAISE WARNING 'MIGRATION PARTIAL: Only % of 7 plantillas updated', total_updated;
  END IF;
END $$;

-- ============================================================================
-- End of migration
-- ============================================================================
