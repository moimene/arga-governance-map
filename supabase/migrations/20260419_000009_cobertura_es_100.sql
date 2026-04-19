-- Migration: 20260419_000009_cobertura_es_100.sql
-- Purpose: Complete 100% Spanish jurisdiction coverage with 2 new plantillas
-- Date: 2026-04-19
-- Author: Legal Team + Development

-- ============================================================================
-- STEP 0: Extend CHECK constraint on tipo to include new types
-- ============================================================================

ALTER TABLE plantillas_protegidas DROP CONSTRAINT IF EXISTS plantillas_protegidas_tipo_check;
ALTER TABLE plantillas_protegidas ADD CONSTRAINT plantillas_protegidas_tipo_check
  CHECK (tipo IN (
    'ACTA_SESION',
    'ACTA_CONSIGNACION',
    'ACTA_ACUERDO_ESCRITO',
    'CERTIFICACION',
    'CONVOCATORIA',
    'CONVOCATORIA_SL_NOTIFICACION'
  ));

-- ============================================================================
-- PLANTILLA 8: Acta de Comisión Delegada
-- tipo=ACTA_SESION, adoption_mode=MEETING, organo_tipo=COMISION_DELEGADA
-- Covers: art. 249 LSC — delegación de facultades del Consejo
-- ============================================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, version, estado,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, adoption_mode, organo_tipo,
  contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_SESION',
  'GENERAL',
  'ES',
  '1.0.0',
  'REVISADA',
  'Acta de Comisión Delegada — template protegido',
  '[{"key":"snapshot_hash","source":"MOTOR_REGLAS","required":true},{"key":"resultado_gate","source":"MOTOR_REGLAS","required":true}]'::jsonb,
  '{"secciones_inmutables":["ENCABEZAMIENTO","CONSTITUCION","DELEGACION","DELIBERACIONES","CIERRE","TRAZABILIDAD"]}'::jsonb,
  true,
  'MEETING',
  'COMISION_DELEGADA',
  '1.0.0',

  -- capa1_inmutable
  $$ACTA DE LA COMISIÓN {{nombre_comision}} DE {{denominacion_social}}

En {{lugar}}, siendo las {{hora_inicio}} horas del día {{fecha}}, se reúne la {{nombre_comision}} del Consejo de Administración de {{denominacion_social}}, con C.I.F. {{cif}}, (en adelante, la "Sociedad"), en su domicilio social sito en {{domicilio_social}}.

CONSTITUCIÓN

La Comisión fue constituida por acuerdo del Consejo de Administración de fecha {{fecha_constitucion_comision}}, de conformidad con el artículo 249 de la Ley de Sociedades de Capital (en adelante, "LSC") y el artículo {{articulo_estatutos_comision}} de los Estatutos Sociales, con las facultades delegadas que constan en dicho acuerdo.

Actúa como Presidente D./Dña. {{presidente}}, y como Secretario D./Dña. {{secretario}}.

Se encuentran presentes los siguientes miembros de la Comisión:

{{#each miembros_presentes}}
- D./Dña. {{nombre}} ({{cargo}})
{{/each}}

{{#if miembros_ausentes}}
Miembros ausentes:
{{#each miembros_ausentes}}
- D./Dña. {{nombre}} ({{cargo}}){{#if justificacion}} — {{justificacion}}{{/if}}
{{/each}}
{{/if}}

Con la asistencia de {{miembros_presentes_count}} de los {{miembros_totales}} miembros que integran la Comisión, se declara válidamente constituida la sesión de conformidad con lo establecido en el Reglamento del Consejo y/o los Estatutos Sociales.

ÁMBITO DE DELEGACIÓN

De conformidad con el artículo 249.2 LSC, la Comisión ejerce las facultades delegadas por el Consejo, con exclusión de las materias indelegables previstas en el artículo 249 bis LSC. Las materias objeto de la presente sesión se encuentran dentro del ámbito de delegación aprobado.

{{#if materias_indelegables_warning}}
NOTA: Se hace constar que ninguna de las materias del orden del día corresponde a las facultades indelegables del artículo 249 bis LSC. En caso de duda, la decisión deberá elevarse al Consejo de Administración en pleno.
{{/if}}

ORDEN DEL DÍA

{{#each orden_dia}}
{{ordinal}}. {{descripcion_punto}}
{{/each}}

DELIBERACIONES Y ACUERDOS

{{#each puntos_votacion}}
{{ordinal}}. {{materia}}

{{#if proclamable}}
Sometida a votación la propuesta, el acuerdo queda APROBADO por {{tipo_mayoria_texto}}, con {{votos_favor}} votos a favor{{#if votos_contra}}, {{votos_contra}} en contra{{/if}}{{#if abstenciones}} y {{abstenciones}} abstenciones{{/if}}.
{{else}}
Sometida a votación, la propuesta NO RESULTA APROBADA, al no haberse alcanzado la mayoría requerida. Votos a favor: {{votos_favor}}, en contra: {{votos_contra}}, abstenciones: {{abstenciones}}.
{{/if}}
{{/each}}

INFORMACIÓN AL CONSEJO

De conformidad con el artículo 249.3 LSC, el Presidente de la Comisión informará al Consejo de Administración en pleno de los acuerdos adoptados en la presente sesión, en la primera reunión del Consejo que se celebre.

{{#if requiere_ratificacion}}
Los siguientes acuerdos requieren ratificación por el Consejo de Administración:
{{#each acuerdos_ratificacion}}
- {{descripcion}}
{{/each}}
{{/if}}

TRAZABILIDAD

La evaluación ha sido realizada mediante el Motor de Reglas LSC:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash del Ruleset (SHA-256): {{snapshot_hash}}
- Sello de tiempo (TSQ): {{tsq_token}}
- Resultado Gate: {{resultado_gate}}

No habiendo más asuntos que tratar, se levanta la sesión siendo las {{hora_fin}} horas.

El Secretario de la Comisión:
Fdo.: {{secretario}}
Firma electrónica cualificada: {{firma_qes_ref}}
Validación OCSP: {{ocsp_status}} a {{firma_qes_timestamp}}$$,

  -- capa2_variables
  '[
    {"variable":"denominacion_social","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"cif","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"domicilio_social","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"nombre_comision","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"fecha","fuente":"REUNION","condicion":"siempre"},
    {"variable":"hora_inicio","fuente":"REUNION","condicion":"siempre"},
    {"variable":"hora_fin","fuente":"REUNION","condicion":"siempre"},
    {"variable":"lugar","fuente":"REUNION","condicion":"siempre"},
    {"variable":"presidente","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"secretario","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"miembros_presentes","fuente":"REUNION","condicion":"siempre"},
    {"variable":"miembros_ausentes","fuente":"REUNION","condicion":"si hay ausentes"},
    {"variable":"miembros_presentes_count","fuente":"REUNION","condicion":"siempre"},
    {"variable":"miembros_totales","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"fecha_constitucion_comision","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"articulo_estatutos_comision","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"orden_dia","fuente":"REUNION","condicion":"siempre"},
    {"variable":"puntos_votacion","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"materias_indelegables_warning","fuente":"MOTOR","condicion":"si materia bordea art.249bis"},
    {"variable":"requiere_ratificacion","fuente":"MOTOR","condicion":"si hay acuerdos que requieren ratificacion"},
    {"variable":"acuerdos_ratificacion","fuente":"MOTOR","condicion":"si requiere_ratificacion"},
    {"variable":"snapshot_rule_pack_id","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"snapshot_rule_pack_version","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"snapshot_hash","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"tsq_token","fuente":"SISTEMA","condicion":"siempre"},
    {"variable":"resultado_gate","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"firma_qes_ref","fuente":"SISTEMA","condicion":"siempre"},
    {"variable":"ocsp_status","fuente":"SISTEMA","condicion":"siempre"},
    {"variable":"firma_qes_timestamp","fuente":"SISTEMA","condicion":"siempre"}
  ]'::jsonb,

  -- capa3_editables
  '[
    {"campo":"observaciones_sesion","obligatoriedad":"OPCIONAL","descripcion":"Observaciones adicionales sobre el desarrollo de la sesión"},
    {"campo":"aclaracion_delegacion","obligatoriedad":"OPCIONAL","descripcion":"Aclaraciones sobre el ámbito de delegación si procede"},
    {"campo":"notas_informacion_consejo","obligatoriedad":"RECOMENDADO","descripcion":"Notas adicionales para el informe al Consejo pleno"}
  ]'::jsonb,

  -- referencia_legal
  'Art. 249, 249 bis LSC; Reglamento del Consejo de Administración',

  -- notas_legal
  'Oleada 1.1 — Cobertura ES 100%. Comisiones delegadas con control de materias indelegables (art. 249 bis LSC) e información obligatoria al Consejo (art. 249.3 LSC).'
);

-- ============================================================================
-- PLANTILLA 9: Convocatoria SL — Notificación Individual
-- tipo=CONVOCATORIA_SL_NOTIFICACION, adoption_mode=MEETING
-- Covers: art. 173.2 LSC — convocatoria SL por comunicación individual
-- ============================================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, version, estado,
  contenido_template, variables, protecciones,
  snapshot_rule_pack_required, adoption_mode, organo_tipo,
  contrato_variables_version,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'CONVOCATORIA_SL_NOTIFICACION',
  'GENERAL',
  'ES',
  '1.0.0',
  'REVISADA',
  'Convocatoria SL por notificación individual — template protegido',
  '[{"key":"snapshot_hash","source":"MOTOR_REGLAS","required":true},{"key":"resultado_gate","source":"MOTOR_REGLAS","required":true}]'::jsonb,
  '{"secciones_inmutables":["ENCABEZAMIENTO","CONVOCATORIA","ORDEN_DIA","INFORMACION_DERECHO","TRAZABILIDAD"]}'::jsonb,
  true,
  'MEETING',
  NULL,
  '1.0.0',

  -- capa1_inmutable
  $$NOTIFICACIÓN DE CONVOCATORIA DE JUNTA GENERAL {{tipo_junta}} DE {{denominacion_social}}

{{lugar}}, {{fecha_emision}}

D./Dña. {{destinatario_nombre}}
{{destinatario_domicilio}}

Estimado/a socio/a:

Por la presente, y en mi condición de {{cargo_convocante}} de {{denominacion_social}}, con C.I.F. {{cif}} y domicilio social en {{domicilio_social}} (en adelante, la "Sociedad"), le NOTIFICO la convocatoria de Junta General {{tipo_junta_texto}} de la Sociedad, de conformidad con lo establecido en el artículo 173 de la Ley de Sociedades de Capital (en adelante, "LSC").

DATOS DE LA REUNIÓN

Fecha: {{fecha_junta}}
Hora: {{hora_junta}}
Lugar: {{lugar_junta}}
{{#if segunda_convocatoria}}
La Junta General se celebrará en segunda convocatoria el día {{fecha_segunda_convocatoria}} a las {{hora_segunda_convocatoria}} horas, en el mismo lugar.
{{/if}}

ORDEN DEL DÍA

{{#each orden_dia}}
{{ordinal}}. {{descripcion_punto}}
{{/each}}

DERECHO DE INFORMACIÓN (Art. 196 LSC)

De conformidad con el artículo 196 LSC, se le informa de su derecho a examinar en el domicilio social la siguiente documentación relativa a los asuntos comprendidos en el orden del día:

{{#each documentos_disponibles}}
- {{nombre}}
{{/each}}

Asimismo, tiene derecho a solicitar por escrito, antes de la Junta o verbalmente durante la misma, los informes o aclaraciones que estime precisos acerca de los asuntos comprendidos en el orden del día, conforme al artículo 197 LSC.

{{#if derecho_representacion}}
DERECHO DE REPRESENTACIÓN

Todo socio que tenga derecho de asistencia podrá hacerse representar en la Junta General por medio de otro socio o de persona ajena a la Sociedad. La representación deberá conferirse por escrito y con carácter especial para cada Junta, de conformidad con el artículo 183 LSC.
{{/if}}

{{#if complemento_convocatoria}}
COMPLEMENTO DE CONVOCATORIA

Se adjunta como Anexo la siguiente documentación complementaria:
{{#each documentos_adjuntos}}
- {{nombre}} ({{descripcion}})
{{/each}}
{{/if}}

CANAL DE NOTIFICACIÓN

La presente notificación se remite mediante {{canal_notificacion}} de conformidad con el artículo 173.2 LSC, que establece que en las sociedades de responsabilidad limitada la convocatoria se realizará mediante comunicación individual y escrita a cada uno de los socios.

{{#if acuse_electronico}}
Se solicita acuse de recibo de la presente comunicación.
{{/if}}

TRAZABILIDAD

Evaluación Motor de Reglas LSC:
- Rule Pack: {{snapshot_rule_pack_id}} v{{snapshot_rule_pack_version}}
- Hash (SHA-256): {{snapshot_hash}}
- Sello de tiempo (TSQ): {{tsq_token}}
- Resultado Gate: {{resultado_gate}}

Le saluda atentamente,

{{cargo_convocante}}:
Fdo.: {{convocante_nombre}}
{{#if firma_qes_ref}}
Firma electrónica cualificada: {{firma_qes_ref}}
Validación OCSP: {{ocsp_status}} a {{firma_qes_timestamp}}
{{/if}}$$,

  -- capa2_variables
  '[
    {"variable":"denominacion_social","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"cif","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"domicilio_social","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"tipo_junta","fuente":"EXPEDIENTE","condicion":"siempre"},
    {"variable":"tipo_junta_texto","fuente":"EXPEDIENTE","condicion":"siempre"},
    {"variable":"destinatario_nombre","fuente":"USUARIO","condicion":"por cada socio (iteración)"},
    {"variable":"destinatario_domicilio","fuente":"USUARIO","condicion":"por cada socio (iteración)"},
    {"variable":"cargo_convocante","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"convocante_nombre","fuente":"ORGANO","condicion":"siempre"},
    {"variable":"fecha_emision","fuente":"SISTEMA","condicion":"siempre"},
    {"variable":"lugar","fuente":"ENTIDAD","condicion":"siempre"},
    {"variable":"fecha_junta","fuente":"REUNION","condicion":"siempre"},
    {"variable":"hora_junta","fuente":"REUNION","condicion":"siempre"},
    {"variable":"lugar_junta","fuente":"REUNION","condicion":"siempre"},
    {"variable":"segunda_convocatoria","fuente":"REUNION","condicion":"si SA o estatutos prevén"},
    {"variable":"fecha_segunda_convocatoria","fuente":"REUNION","condicion":"si segunda_convocatoria"},
    {"variable":"hora_segunda_convocatoria","fuente":"REUNION","condicion":"si segunda_convocatoria"},
    {"variable":"orden_dia","fuente":"REUNION","condicion":"siempre"},
    {"variable":"documentos_disponibles","fuente":"EXPEDIENTE","condicion":"siempre"},
    {"variable":"derecho_representacion","fuente":"MOTOR","condicion":"si aplica representación"},
    {"variable":"complemento_convocatoria","fuente":"EXPEDIENTE","condicion":"si hay adjuntos"},
    {"variable":"documentos_adjuntos","fuente":"EXPEDIENTE","condicion":"si complemento_convocatoria"},
    {"variable":"canal_notificacion","fuente":"SISTEMA","condicion":"siempre"},
    {"variable":"acuse_electronico","fuente":"SISTEMA","condicion":"si canal es email"},
    {"variable":"snapshot_rule_pack_id","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"snapshot_rule_pack_version","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"snapshot_hash","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"tsq_token","fuente":"SISTEMA","condicion":"siempre"},
    {"variable":"resultado_gate","fuente":"MOTOR","condicion":"siempre"},
    {"variable":"firma_qes_ref","fuente":"SISTEMA","condicion":"si firma QES"},
    {"variable":"ocsp_status","fuente":"SISTEMA","condicion":"si firma QES"},
    {"variable":"firma_qes_timestamp","fuente":"SISTEMA","condicion":"si firma QES"}
  ]'::jsonb,

  -- capa3_editables
  '[
    {"campo":"nota_adicional_socio","obligatoriedad":"OPCIONAL","descripcion":"Nota personalizada para el socio destinatario"},
    {"campo":"instrucciones_representacion","obligatoriedad":"RECOMENDADO","descripcion":"Instrucciones adicionales sobre el ejercicio del derecho de representación"},
    {"campo":"documentacion_complementaria","obligatoriedad":"OPCIONAL","descripcion":"Descripción de documentación complementaria adjunta"}
  ]'::jsonb,

  -- referencia_legal
  'Art. 173.2, 176, 183, 196, 197 LSC',

  -- notas_legal
  'Oleada 1.1 — Cobertura ES 100%. Notificación individual para SL (art. 173.2 LSC). Diferente de CONVOCATORIA que es para SA (anuncio público). Incluye derecho de información (art. 196) y representación (art. 183).'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  total_count integer;
  new_count integer;
BEGIN
  SELECT count(*) INTO total_count
  FROM plantillas_protegidas
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

  SELECT count(*) INTO new_count
  FROM plantillas_protegidas
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND notas_legal LIKE '%Cobertura ES 100%';

  RAISE NOTICE '✓ Total plantillas: % (expected: 9)', total_count;
  RAISE NOTICE '✓ New plantillas (ES 100%%): % (expected: 2)', new_count;

  IF new_count != 2 THEN
    RAISE EXCEPTION 'Expected 2 new plantillas, got %', new_count;
  END IF;
END $$;
