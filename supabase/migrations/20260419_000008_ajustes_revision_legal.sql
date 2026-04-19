-- Migration: 20260419_000008_ajustes_revision_legal.sql
-- Purpose: Apply 5 adjustments from legal committee review of Oleada 1 plantillas
-- Date: 2026-04-19
-- Source: Revisión detallada de las siete plantillas integradas (Legal Committee)
-- Status: PRODUCTION-READY
--
-- Adjustments:
--   1. Plantilla 1 (Junta General): Rama reforzada SA con detalle 1ª/2ª convocatoria
--   2. Plantilla 2 (Consejo): Variable representado_por en capa2 + consejeros_representados
--   3. Plantilla 5 (Sin Sesión): Evidencias de notificación fehaciente + WARNING
--   4. Plantilla 6 (Certificación): forma_aprobacion_acta + motivo_conformidad mejorado
--   5. Plantilla 7 (Convocatoria): Asistencia telemática condicional

-- ============================================================================
-- AJUSTE 1: Plantilla Junta General — rama reforzada SA con detalle convocatoria
-- Adds: conditional block after proclamación REFORZADA_LEGAL showing quórum+mayoría
--        combination with 1ª/2ª convocatoria detail
-- New capa2 variables: quorum_rama, convocatoria_ordinal_detalle
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
{{#if quorum_rama}}
A estos efectos, se hace constar que la Junta fue constituida en {{convocatoria_ordinal_detalle}} convocatoria con un quórum del {{quorum_observado}}%, aplicándose en consecuencia la combinación de quórum de asistencia del {{quorum_rama}}% y mayoría reforzada del {{umbral_reforzado}}% prevista en el artículo {{articulo_mayoria}} LSC para materias del artículo 194 LSC en {{convocatoria_ordinal_detalle}} convocatoria.
{{/if}}
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
  {"variable": "quorum_rama", "fuente": "evaluarConstitucion().quorum_rama_pct", "condicion": "REFORZADA_LEGAL"},
  {"variable": "convocatoria_ordinal_detalle", "fuente": "evaluarConstitucion().convocatoria_ordinal", "condicion": "REFORZADA_LEGAL"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate", "fuente": "evaluarAcuerdoCompleto().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  notas_legal = 'Oleada 1 (rev. legal 19/04/2026): Añadido bloque condicional de rama reforzada SA con detalle de quórum+mayoría por convocatoria (1ª/2ª). Variables quorum_rama y convocatoria_ordinal_detalle derivadas del explain de constitución.'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_SESION'
  AND adoption_mode = 'MEETING'
  AND organo_tipo = 'JUNTA_GENERAL';

-- ============================================================================
-- AJUSTE 2: Plantilla Consejo — representación entre consejeros en capa2
-- The capa1 already has {{#if representado_por}} in the consejeros list.
-- We add the missing variable to capa2 and a new consejeros_representados count.
-- ============================================================================

UPDATE plantillas_protegidas
SET
  capa2_variables = $$[
  {"variable": "denominacion_social", "fuente": "entities.name", "condicion": "SIEMPRE"},
  {"variable": "cif", "fuente": "entities.cif", "condicion": "SIEMPRE"},
  {"variable": "registro_mercantil", "fuente": "entities.datos_registrales", "condicion": "SIEMPRE"},
  {"variable": "fecha", "fuente": "meeting.fecha", "condicion": "MEETING"},
  {"variable": "lugar", "fuente": "meeting.lugar", "condicion": "MEETING"},
  {"variable": "presidente", "fuente": "meeting.mesa.presidente", "condicion": "SIEMPRE"},
  {"variable": "secretario", "fuente": "meeting.mesa.secretario", "condicion": "SIEMPRE"},
  {"variable": "lista_consejeros", "fuente": "consejeros.miembros", "condicion": "SIEMPRE"},
  {"variable": "representado_por", "fuente": "consejeros.miembros[].representado_por", "condicion": "SI_REPRESENTACION"},
  {"variable": "consejeros_presentes", "fuente": "evaluarConstitucion().consejeros_presentes", "condicion": "SIEMPRE"},
  {"variable": "consejeros_representados", "fuente": "evaluarConstitucion().consejeros_representados", "condicion": "SI_REPRESENTACION"},
  {"variable": "consejeros_totales", "fuente": "consejeros.total", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate", "fuente": "evaluarAcuerdoCompleto().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  notas_legal = 'Oleada 1 (rev. legal 19/04/2026): Añadidas variables representado_por (por consejero) y consejeros_representados (count) para coordinar con explain de constitución. La capa1 ya incluía el condicional {{#if representado_por}}.'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_SESION'
  AND adoption_mode = 'MEETING'
  AND organo_tipo = 'CONSEJO';

-- ============================================================================
-- AJUSTE 3: Plantilla Sin Sesión — evidencias de notificación fehaciente
-- Adds: notification summary block before response list with totals + WARNING
-- New capa2 variables: total_notificados, entregas_acreditadas, warning_entregas
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

Notificación fehaciente:
- Total destinatarios notificados: {{total_notificados}}
- Entregas acreditadas con evidencia: {{entregas_acreditadas}}
{{#if warning_entregas}}
⚠ ADVERTENCIA: Existen {{entregas_pendientes}} destinatarios sin acuse de entrega acreditado a la fecha de apertura de la ventana de consentimiento. El Gate PRE ha registrado esta incidencia.
{{/if}}

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
  {"variable": "total_notificados", "fuente": "no_session_resolution.notificaciones.total", "condicion": "SIEMPRE"},
  {"variable": "entregas_acreditadas", "fuente": "no_session_resolution.notificaciones.entregas_ok", "condicion": "SIEMPRE"},
  {"variable": "warning_entregas", "fuente": "no_session_resolution.notificaciones.hay_pendientes", "condicion": "SIEMPRE"},
  {"variable": "entregas_pendientes", "fuente": "no_session_resolution.notificaciones.pendientes_count", "condicion": "SI_WARNING"},
  {"variable": "proclamable", "fuente": "evaluarAcuerdoCompleto().proclamable", "condicion": "SIEMPRE"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "evidence_bundle_hash", "fuente": "createEvidenceBundle().hash", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  notas_legal = 'Oleada 1 (rev. legal 19/04/2026): Añadida sección "Notificación fehaciente" con totales de destinatarios, entregas acreditadas y WARNING si faltan entregas antes de apertura de ventana. Variables: total_notificados, entregas_acreditadas, warning_entregas, entregas_pendientes.'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'ACTA_ACUERDO_ESCRITO'
  AND adoption_mode = 'NO_SESSION';

-- ============================================================================
-- AJUSTE 4: Certificación — forma_aprobacion_acta + motivo_conformidad
-- Adds: derived variable for acta approval state, improved conditional
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
Que el acta se encuentra pendiente de aprobación conforme al artículo 202 LSC (art. 112 RRM). {{#if forma_aprobacion_prevista}}Se prevé su aprobación {{forma_aprobacion_prevista}}.{{/if}}
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
  {"variable": "forma_aprobacion_acta", "fuente": "meeting.forma_aprobacion", "condicion": "SI_APROBADA"},
  {"variable": "forma_aprobacion_prevista", "fuente": "meeting.forma_aprobacion_prevista", "condicion": "SI_NO_APROBADA"},
  {"variable": "requiere_conformidad_conjunta", "fuente": "certification.requiere_conformidad()", "condicion": "SIEMPRE"},
  {"variable": "motivo_conformidad_conjunta", "fuente": "certification.motivo_conformidad", "condicion": "SI_CONFORMIDAD"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  notas_legal = 'Oleada 1 (rev. legal 19/04/2026): Añadida variable forma_aprobacion_acta (en sesión, diferida, sesión siguiente) y forma_aprobacion_prevista cuando acta pendiente. Gate documental fuerza inclusión cuando estado != APROBADA. Mejorado bloque de acta pendiente con referencia a art. 202 LSC.'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'CERTIFICACION'
  AND adoption_mode IS NULL;

-- ============================================================================
-- AJUSTE 5: Convocatoria — asistencia telemática condicional
-- Adds: conditional block for telematic attendance, only when Gate PRE confirms
-- New capa2 variables: telematica_habilitada, checklist_telematica_ok
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

{{#if telematica_habilitada}}
{{#if checklist_telematica_ok}}
Asistencia telemática: De conformidad con lo previsto en {{base_telematica}} de los Estatutos Sociales, se habilita la posibilidad de asistir a la Junta por medios telemáticos. Los socios/accionistas que deseen asistir telemáticamente deberán seguir las instrucciones indicadas a continuación:
{{instrucciones_telematica}}
El sistema telemático garantiza la identidad del sujeto, la transmisión bidireccional en tiempo real y la posibilidad de intervenir y ejercer el derecho de voto, conforme al artículo 182 LSC.
{{else}}
Nota interna: La habilitación estatutaria de asistencia telemática consta, pero el checklist técnico-jurídico no ha sido cumplimentado. Gate PRE ha bloqueado la inclusión de la sección de asistencia telemática.
{{/if}}
{{/if}}

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
  {"variable": "telematica_habilitada", "fuente": "entities.estatutos.telematica_habilitada", "condicion": "SIEMPRE"},
  {"variable": "checklist_telematica_ok", "fuente": "evaluarConvocatoria().checklist_telematica", "condicion": "SI_TELEMATICA"},
  {"variable": "base_telematica", "fuente": "entities.estatutos.articulo_telematica", "condicion": "SI_TELEMATICA"},
  {"variable": "instrucciones_telematica", "fuente": "convocatoria.instrucciones_telematica", "condicion": "SI_TELEMATICA"},
  {"variable": "snapshot_hash", "fuente": "calcularRulesetSnapshotHash()", "condicion": "SIEMPRE"},
  {"variable": "resultado_gate_convocatoria", "fuente": "evaluarConvocatoria().resultado", "condicion": "SIEMPRE"},
  {"variable": "tsq_token", "fuente": "QTSP", "condicion": "SIEMPRE"},
  {"variable": "firma_qes_ref", "fuente": "QTSP.signature_reference", "condicion": "SIEMPRE"}
]$$::jsonb,

  capa3_editables = $$[
  {"campo": "orden_dia_puntos", "obligatoriedad": "OBLIGATORIO", "descripcion": "Puntos específicos del orden del día"},
  {"campo": "documentacion_referencia", "obligatoriedad": "OBLIGATORIO", "descripcion": "Documentación que va a disposición de socios"},
  {"campo": "instrucciones_telematica", "obligatoriedad": "OBLIGATORIO_SI_TELEMATICA", "descripcion": "Instrucciones para participación telemática (URL, credenciales, procedimiento de identificación)"},
  {"campo": "instrucciones_acceso", "obligatoriedad": "OPCIONAL", "descripcion": "Instrucciones para participación presencial o voto electrónico"},
  {"campo": "observaciones", "obligatoriedad": "OPCIONAL", "descripcion": "Cualquier aclaración adicional relevante"}
]$$::jsonb,

  notas_legal = 'Oleada 1 (rev. legal 19/04/2026): Añadida sección condicional de asistencia telemática. Solo se activa si: (a) habilitación estatutaria consta, y (b) checklist técnico-jurídico cumplido en Gate PRE. Variables: telematica_habilitada, checklist_telematica_ok, base_telematica, instrucciones_telematica. Campo instrucciones_telematica pasa a OBLIGATORIO_SI_TELEMATICA en capa3.'
WHERE
  tenant_id = '00000000-0000-0000-0000-000000000001'
  AND tipo = 'CONVOCATORIA'
  AND adoption_mode = 'MEETING';

-- ============================================================================
-- Final verification
-- ============================================================================

DO $$
DECLARE
  adjusted INT;
BEGIN
  SELECT COUNT(*) INTO adjusted
  FROM plantillas_protegidas
  WHERE
    tenant_id = '00000000-0000-0000-0000-000000000001'
    AND estado = 'REVISADA'
    AND version = '1.0.0'
    AND notas_legal LIKE '%rev. legal 19/04/2026%';

  IF adjusted = 5 THEN
    RAISE NOTICE 'MIGRATION SUCCESSFUL: All 5 legal review adjustments applied (plantillas 1,2,5,6,7)';
  ELSE
    RAISE WARNING 'MIGRATION PARTIAL: Only % of 5 plantillas adjusted', adjusted;
  END IF;
END $$;

-- ============================================================================
-- End of migration
-- ============================================================================
