-- Contrato único de salida documental externa.
--
-- Los identificadores, hashes, snapshots y referencias de auditoría siguen
-- disponibles en metadata/evidence_bundles, pero no se imprimen en los
-- documentos que recibe un usuario o un tercero. Las actas se proyectan desde
-- el modelo RRM canónico y las certificaciones transcriben el texto resolutivo
-- adoptado, nunca el título del punto del orden del día.

BEGIN;

UPDATE public.plantillas_protegidas
SET version = '1.3.0',
    capa1_inmutable = $template${{acta_rrm_texto_completo}}$template$,
    capa2_variables = jsonb_build_array(
      jsonb_build_object(
        'variable', 'acta_rrm_texto_completo',
        'fuente', 'EXPEDIENTE',
        'condicion', 'OBLIGATORIO',
        'descripcion', 'Proyección canónica completa del acta conforme al contrato RRM.'
      )
    ),
    capa3_editables = '[]'::jsonb,
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.3.0: el cuerpo visible se proyecta desde acta_rrm_texto_completo; IDs, hashes y snapshots quedan exclusivamente en metadata.'
    )
WHERE id IN (
  'b9c17ef0-cf3d-4ba8-a753-7f4dafc2793e',
  '77191407-4d5b-4279-b09e-041985026aa4'
)
  AND tipo = 'ACTA_SESION'
  AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.4.0',
    capa1_inmutable = $template$CERTIFICACIÓN DE ACUERDOS

{{nombre_certificante}}, en calidad de {{cargo_certificante}} de {{denominacion_social}}, certifica:

Que en la reunión celebrada el día {{fecha}} se adoptaron válidamente los siguientes acuerdos:

{{transcripcion_acuerdos}}

La presente certificación se expide sobre la base del acta aprobada y recoge exclusivamente el texto resolutivo de los acuerdos adoptados.

Y para que así conste, se expide en {{ciudad_emision}}, a {{fecha_emision}}.

Firma de la Secretaría: {{nombre_certificante}}.
Visto bueno de la Presidencia: {{presidente}}.

Documento demo/operativo. No constituye evidencia final productiva ni sustituye la firma y el sellado cualificados que resulten exigibles.$template$,
    capa2_variables = jsonb_build_array(
      jsonb_build_object('variable', 'denominacion_social', 'fuente', 'ENTIDAD', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'nombre_certificante', 'fuente', 'ORGANO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'cargo_certificante', 'fuente', 'ORGANO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'presidente', 'fuente', 'ORGANO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'transcripcion_acuerdos', 'fuente', 'EXPEDIENTE', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'ciudad_emision', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha_emision', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO')
    ),
    capa3_editables = jsonb_build_array(
      jsonb_build_object('campo', 'ciudad_emision', 'tipo', 'text', 'obligatoriedad', 'OBLIGATORIO', 'descripcion', 'Ciudad de expedición.'),
      jsonb_build_object('campo', 'fecha_emision', 'tipo', 'date', 'obligatoriedad', 'OBLIGATORIO', 'descripcion', 'Fecha de expedición.' )
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.4.0: certificación multipunto con ordinal jurídico, cargo coherente, firmas y sin trazabilidad técnica visible.'
    )
WHERE id = '79bc76c7-512e-4734-9849-31cdc73b0e84'
  AND tipo = 'CERTIFICACION'
  AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.3.0',
    capa1_inmutable = $template$CONVOCATORIA DE JUNTA GENERAL DE {{denominacion_social}}

Por acuerdo del órgano de administración de la Sociedad, se convoca a los accionistas a la Junta General {{tipo_junta_texto}}, que se celebrará el día {{fecha_primera_convocatoria}} a las {{hora_primera_convocatoria}}, en {{lugar}}, en modalidad {{modalidad_sesion}}.

{{#if hay_segunda_convocatoria}}SEGUNDA CONVOCATORIA
De no alcanzarse el quórum necesario en primera convocatoria, la Junta se celebrará en segunda convocatoria el día {{fecha_segunda_convocatoria}} a las {{hora_segunda_convocatoria}}, en el mismo lugar, conforme al régimen legal y estatutario aplicable.
{{/if}}

ORDEN DEL DÍA
{{orden_dia_texto}}

DERECHO DE INFORMACIÓN Y DOCUMENTACIÓN DISPONIBLE
Los accionistas podrán ejercitar los derechos de información que les correspondan conforme a la Ley de Sociedades de Capital. La documentación de soporte estará disponible mediante {{canal_documentacion}}.

CANAL DE CONVOCATORIA Y PUBLICACIÓN
La convocatoria se comunicará o publicará por {{canal_convocatoria}}. Referencia visible de publicación o envío: {{publicacion_ref}}.

La Sociedad es una sociedad anónima; la convocatoria deberá respetar el plazo mínimo de un mes y las especialidades aplicables a sociedades cotizadas.

En {{lugar_emision}}, a {{fecha_emision}}.

Firma del órgano convocante: {{firma_convocante_ref}}.
Sello de tiempo, si aplica: {{sello_tiempo_ref}}.

Documento demo/operativo. No constituye evidencia final productiva.$template$,
    capa2_variables = jsonb_build_array(
      jsonb_build_object('variable', 'denominacion_social', 'fuente', 'ENTIDAD', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'tipo_junta_texto', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha_primera_convocatoria', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'hora_primera_convocatoria', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'lugar', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'modalidad_sesion', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'orden_dia_texto', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'canal_documentacion', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'canal_convocatoria', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'publicacion_ref', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'lugar_emision', 'fuente', 'SISTEMA', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha_emision', 'fuente', 'SISTEMA', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'firma_convocante_ref', 'fuente', 'QTSP', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'sello_tiempo_ref', 'fuente', 'QTSP', 'condicion', 'OPCIONAL')
    ),
    capa3_editables = jsonb_build_array(
      jsonb_build_object('campo', 'canal_documentacion', 'tipo', 'text', 'obligatoriedad', 'OBLIGATORIO', 'descripcion', 'Canal de acceso a la documentación.'),
      jsonb_build_object('campo', 'publicacion_ref', 'tipo', 'text', 'obligatoriedad', 'OBLIGATORIO', 'descripcion', 'Referencia visible de publicación o envío.'),
      jsonb_build_object('campo', 'hay_segunda_convocatoria', 'tipo', 'boolean', 'obligatoriedad', 'OBLIGATORIO', 'descripcion', 'Indica si se prevé segunda convocatoria.')
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.3.0: claves técnicas e identificadores retirados del cuerpo; publicación visible y plazos SA/cotizada explicitados.'
    )
WHERE id = '8dcfc85c-9422-4456-aa31-ceea5da6d64d'
  AND tipo = 'CONVOCATORIA'
  AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.2.0',
    capa1_inmutable = replace(
      capa1_inmutable,
      E'\nTrazabilidad: agreement_id = {{DELEGACION.agreement_id}}. Carácter demo/operativo.',
      ''
    ),
    capa2_variables = COALESCE(
      (
        SELECT jsonb_agg(item)
        FROM jsonb_array_elements(capa2_variables) AS item
        WHERE item->>'variable' <> 'DELEGACION.agreement_id'
      ),
      '[]'::jsonb
    ),
    notas_legal = concat_ws(E'\n', nullif(notas_legal, ''), 'v1.2.0: identificador interno retirado del cuerpo visible; se conserva en metadata del artefacto.')
WHERE id = 'd3e08b42-a67e-4b33-9bbb-2689b5d8d4cf'
  AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.0',
    notas_legal = concat_ws(E'\n', nullif(notas_legal, ''), 'v1.1.0: fecha visible normalizada por el contrato de salida y versión externa unificada.')
WHERE id = '60251fcd-9450-4812-8bbb-2946581d6d19'
  AND estado = 'ACTIVA';

-- Saneamiento de plantillas activas de otras familias. Solo se sustituyen
-- frases técnicas delimitadas; el contenido jurídico permanece intacto.
UPDATE public.plantillas_protegidas
SET version = '1.2.2',
    capa1_inmutable = replace(
      replace(
        capa1_inmutable,
        E'\nTrazabilidad del acto: agreement_id = {{DECISION.agreement_id}}.\n',
        E'\n'
      ),
      'La presente decisión se consigna en el libro de actas / expediente del prototipo bajo el identificador {{EXPEDIENTE.expediente_id}}.',
      'La presente decisión se consigna en el libro de actas y en el expediente interno correspondiente.'
    )
WHERE id = '2d9134d5-7935-4f3c-a6de-de1c6fc35227' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.2.2',
    capa1_inmutable = replace(
      replace(
        capa1_inmutable,
        E'\nTrazabilidad del acto: agreement_id = {{DECISION.agreement_id}}.\n',
        E'\n'
      ),
      'La presente decisión se consigna en el expediente {{EXPEDIENTE.expediente_id}}.',
      'La presente decisión se consigna en el expediente interno correspondiente.'
    )
WHERE id = '383d7f4c-1df6-42a2-bc5c-df3a4e1685fe' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.2',
    capa1_inmutable = replace(
      replace(
        capa1_inmutable,
        'En el expediente {{EXPEDIENTE.expediente_id}}, y conforme al régimen de actuación conjunta / coaprobación aplicable a la administración de la Sociedad, se documenta la adopción de la decisión identificada por agreement_id {{COAP.agreement_id}}.',
        'Conforme al régimen de actuación conjunta o coaprobación aplicable a la administración de la Sociedad, se documenta la adopción de la siguiente decisión.'
      ),
      E'\nTrazabilidad del acto: agreement_id = {{COAP.agreement_id}}.\n\nV. Snapshot del motor y trazabilidad técnica-jurídica\n\nSe incorpora al expediente el snapshot de evaluación del motor en los siguientes términos: hash {{MOTOR.snapshot_hash}}, versión de reglas {{MOTOR.ruleset_version}}, y resultado {{MOTOR.resultado_resumen}}, sin perjuicio de los anexos técnicos del expediente.\n',
      E'\n'
    )
WHERE id = 'ae44ec3b-ba47-4fd7-a119-5ac70346fdc0' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.2.2',
    capa1_inmutable = replace(
      capa1_inmutable,
      'Por acuerdo del órgano de administración de la Sociedad adoptado en fecha {{agreements.convocatoria.fecha_adopcion}} y trazado bajo agreements.id {{agreements.convocatoria.id}},',
      'Por acuerdo del órgano de administración de la Sociedad,'
    )
WHERE id = '1d7d5671-2588-4071-a9f6-e9b377d337bc' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.1',
    capa1_inmutable = replace(capa1_inmutable, E'\nTrazabilidad: agreement_id = {{OV.agreement_id}}. Carácter demo/operativo.', '')
WHERE id = '64fa1683-8cb8-4c4c-b8d6-e09f91cafa59' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.1',
    capa1_inmutable = replace(
      replace(
        capa1_inmutable,
        'INFORME DOCUMENTAL PREVIO — {{ENTIDAD.denominacion_social}} — Expediente {{EXPEDIENTE.expediente_id}}',
        'INFORME DOCUMENTAL PREVIO — {{ENTIDAD.denominacion_social}}'
      ),
      'III. Trazabilidad de reglas y alertas. Versión de reglas: {{MOTOR.ruleset_version}}. Snapshot: {{MOTOR.snapshot_hash}}. Resultado: {{MOTOR.resultado_resumen}}. Alertas activas: {{MOTOR.alertas_resumen}}.',
      'III. Resultado de las comprobaciones. {{MOTOR.resultado_resumen}}. Alertas activas: {{MOTOR.alertas_resumen}}.'
    )
WHERE id = '62da5ae6-1cff-4a7c-8032-29e489d3e877' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.1',
    capa1_inmutable = replace(
      capa1_inmutable,
      'INFORME PRECEPTIVO INTERNO PARA CONVOCATORIA — {{ENTIDAD.denominacion_social}} — Expediente {{EXPEDIENTE.expediente_id}}',
      'INFORME PRECEPTIVO INTERNO PARA CONVOCATORIA — {{ENTIDAD.denominacion_social}}'
    )
WHERE id = '24e1b9cb-9c4c-49a2-9259-d49b5b6647a1' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.3.1',
    capa1_inmutable = replace(
      replace(
        capa1_inmutable,
        'En el marco del expediente {{EXPEDIENTE.expediente_id}}, se documenta la adopción por escrito y sin sesión del acuerdo identificado por agreement_id {{ACUERDO.agreement_id}}, conforme al carril {{ACUERDO.carril_tipo}} y al régimen interno aplicable.',
        'Se documenta la adopción por escrito y sin sesión del siguiente acuerdo, conforme al carril {{ACUERDO.carril_tipo}} y al régimen interno aplicable.'
      ),
      E'\nTrazabilidad del acto: agreement_id = {{ACUERDO.agreement_id}}.\n',
      E'\n'
    )
WHERE id = '2c15640c-de2f-41ea-aa8d-304147124a6e' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.2',
    capa1_inmutable = replace(capa1_inmutable, E'\nTrazabilidad del acto: agreement_id = {{ACTO.agreement_id}}.\n', E'\n')
WHERE id = 'b5f436c9-e8e6-4a01-92e7-25fe51ed83f3' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.1',
    capa1_inmutable = replace(capa1_inmutable, E'\nTrazabilidad del acuerdo: agreement_id = {{CUENTAS.agreement_id}}. Carácter demo/operativo (no evidencia final productiva).', '')
WHERE id = 'c8da1e61-ef2a-4a5c-895b-a5d100916ecf' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.1',
    capa1_inmutable = replace(
      capa1_inmutable,
      'CUARTO.- Autorizar la documentacion complementaria necesaria para dejar trazabilidad del acuerdo, incluyendo agreement_id, snapshot del motor y soporte documental del expediente.',
      'CUARTO.- Autorizar la documentación complementaria necesaria para la ejecución, archivo y soporte del acuerdo.'
    )
WHERE id = 'edd5c389-0187-476c-9592-c020058fdc69' AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET content_hash_sha256 = encode(digest(convert_to(capa1_inmutable, 'UTF8'), 'sha256'), 'hex')
WHERE id IN (
  'b9c17ef0-cf3d-4ba8-a753-7f4dafc2793e',
  '77191407-4d5b-4279-b09e-041985026aa4',
  '79bc76c7-512e-4734-9849-31cdc73b0e84',
  '8dcfc85c-9422-4456-aa31-ceea5da6d64d',
  'd3e08b42-a67e-4b33-9bbb-2689b5d8d4cf',
  '60251fcd-9450-4812-8bbb-2946581d6d19',
  '2d9134d5-7935-4f3c-a6de-de1c6fc35227',
  '383d7f4c-1df6-42a2-bc5c-df3a4e1685fe',
  'ae44ec3b-ba47-4fd7-a119-5ac70346fdc0',
  '1d7d5671-2588-4071-a9f6-e9b377d337bc',
  '64fa1683-8cb8-4c4c-b8d6-e09f91cafa59',
  '62da5ae6-1cff-4a7c-8032-29e489d3e877',
  '24e1b9cb-9c4c-49a2-9259-d49b5b6647a1',
  '2c15640c-de2f-41ea-aa8d-304147124a6e',
  'b5f436c9-e8e6-4a01-92e7-25fe51ed83f3',
  'c8da1e61-ef2a-4a5c-895b-a5d100916ecf',
  'edd5c389-0187-476c-9592-c020058fdc69'
)
  AND estado IN ('ACTIVA', 'APROBADA');

DO $verify$
DECLARE
  v_core_count integer;
  v_visible_trace_count integer;
BEGIN
  SELECT count(*) INTO v_core_count
  FROM public.plantillas_protegidas
  WHERE (id, version) IN (
    ('b9c17ef0-cf3d-4ba8-a753-7f4dafc2793e'::uuid, '1.3.0'),
    ('77191407-4d5b-4279-b09e-041985026aa4'::uuid, '1.3.0'),
    ('79bc76c7-512e-4734-9849-31cdc73b0e84'::uuid, '1.4.0'),
    ('8dcfc85c-9422-4456-aa31-ceea5da6d64d'::uuid, '1.3.0'),
    ('d3e08b42-a67e-4b33-9bbb-2689b5d8d4cf'::uuid, '1.2.0'),
    ('60251fcd-9450-4812-8bbb-2946581d6d19'::uuid, '1.1.0')
  )
    AND estado = 'ACTIVA';

  IF v_core_count <> 6 THEN
    RAISE EXCEPTION 'Expected six active reviewed templates, found %', v_core_count;
  END IF;

  SELECT count(*) INTO v_visible_trace_count
  FROM public.plantillas_protegidas
  WHERE estado IN ('ACTIVA', 'APROBADA')
    AND capa1_inmutable ~* '(agreement_id|agreements\.id|snapshot_hash|EXPEDIENTE\.expediente_id|MOTOR\.ruleset_version|trazabilidad (del acto|del acuerdo|técnica))';

  IF v_visible_trace_count <> 0 THEN
    RAISE EXCEPTION 'Active visible templates still expose % internal trace markers', v_visible_trace_count;
  END IF;
END
$verify$;

COMMIT;
