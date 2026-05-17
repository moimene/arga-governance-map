-- Secretaria 360 - plantillas de Consejo de Administracion agrupadas por familias.
--
-- Objetivo: incorporar 5 borradores para poblar el circuito de Consejo y
-- comisiones delegadas, sin activar ni reemplazar las plantillas firmadas
-- existentes. FORMULACION_CUENTAS y CONVOCATORIA_COMISION_DELEGADA ya tienen
-- versiones ACTIVAS; aqui se incorporan variantes BORRADOR para revision legal.
--
-- Familias:
-- - CUENTAS_RESULTADO_AUDITORIA: formulacion de cuentas.
-- - INFORMACION_SEGUIMIENTO_CONTROL: presupuestos y planificacion anual.
-- - CAPITAL_FINANCIACION: financiacion societaria.
-- - OPERACIONES_ESPECIALES_VINCULADAS: contratacion relevante con escalado.
-- - GOBIERNO_ORGANOS: convocatoria de comision delegada.
--
-- Normalizacion:
-- - Placeholders planos, sin sociedad.*, reunion.*, acuerdo.* ni comision.*.
-- - Fuentes Capa 2 reconocibles por el resolver: entities.*, meetings.* y
--   governing_bodies.*.
-- - Datos no deducibles del expediente en Capa 3.
-- - Guardarrailes juridicos en notas_legal y, cuando procede, en Capa 1.

BEGIN;

WITH templates (
  id,
  tipo,
  materia,
  titulo,
  referencia_legal,
  organo_tipo,
  adoption_mode,
  version,
  familia_materia,
  familia_titulo,
  capa1_inmutable,
  capa2_variables,
  capa3_editables,
  notas_legal
) AS (
  VALUES
    (
      'bc49965f-2c0b-4778-9751-163f87fcbff6'::uuid,
      'MODELO_ACUERDO',
      'FORMULACION_CUENTAS',
      'Modelo de acuerdo - formulacion de cuentas por el Consejo',
      'Arts. 253, 262 y concordantes LSC; art. 247 LSC sobre constitucion del Consejo',
      'CONSEJO_ADMIN',
      'MEETING',
      '1.2.0',
      'CUENTAS_RESULTADO_AUDITORIA',
      'Cuentas anuales, resultado y auditoria',
      $capa1_FORMULACION_CUENTAS$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda formular las cuentas anuales correspondientes al ejercicio {{ejercicio}}, integradas por balance, cuenta de perdidas y ganancias, estado de cambios en el patrimonio neto, estado de flujos de efectivo cuando proceda y memoria.

SEGUNDO.- Asimismo, el Consejo formula el informe de gestion del ejercicio, cuyo resumen operativo es {{informe_gestion_resumen}}, y adopta la propuesta de aplicacion del resultado siguiente: {{propuesta_aplicacion_resultado}}, para su sometimiento a la Junta General.

TERCERO.- Se acuerda poner a disposicion de los socios o accionistas la documentacion formulada en los plazos y terminos legales y, en su caso, remitirla al auditor designado para verificacion conforme al regimen aplicable.

CUARTO.- Se faculta al Secretario del Consejo para expedir certificaciones del presente acuerdo, incorporar la documentacion al expediente y realizar las comunicaciones internas necesarias para su inclusion en el orden del dia de la Junta que corresponda.$capa1_FORMULACION_CUENTAS$,
      $capa2_FORMULACION_CUENTAS$[
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},
        {"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}
      ]$capa2_FORMULACION_CUENTAS$::jsonb,
      $capa3_FORMULACION_CUENTAS$[
        {"campo":"ejercicio","obligatoriedad":"OBLIGATORIO","descripcion":"Ejercicio social al que se refieren las cuentas anuales formuladas.","tipo":"text","label":"Ejercicio de las cuentas"},
        {"campo":"informe_gestion_resumen","obligatoriedad":"OBLIGATORIO","descripcion":"Resumen del informe de gestion formulado por el Consejo.","tipo":"textarea","label":"Resumen del informe de gestion"},
        {"campo":"propuesta_aplicacion_resultado","obligatoriedad":"OBLIGATORIO","descripcion":"Propuesta de aplicacion del resultado para someter a la Junta General.","tipo":"textarea","label":"Propuesta de aplicacion del resultado"},
        {"campo":"auditor_designado","obligatoriedad":"OPCIONAL","descripcion":"Auditor o firma auditora designada, si procede conforme al expediente.","tipo":"text","label":"Auditor designado"}
      ]$capa3_FORMULACION_CUENTAS$::jsonb,
      'Borrador de variante especifica Consejo. Mantener separacion funcional frente a APROBACION_CUENTAS de Junta. Verificar plazo de formulacion, quorum, mayoria, estados financieros, informe de gestion y propuesta de resultado antes de activar.'
    ),
    (
      'b8e88780-342b-487e-b546-7fef68b86a4e'::uuid,
      'MODELO_ACUERDO',
      'APROBACION_PRESUPUESTOS',
      'Modelo de acuerdo - aprobacion de presupuesto anual por el Consejo',
      'Regimen general del Consejo; arts. 225, 245 y 247 LSC; coordinacion con APROBACION_PLAN_NEGOCIO',
      'CONSEJO_ADMIN',
      'MEETING',
      '0.1.0',
      'INFORMACION_SEGUIMIENTO_CONTROL',
      'Informacion, seguimiento y control',
      $capa1_APROBACION_PRESUPUESTOS$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, aprueba el presupuesto correspondiente al ejercicio {{ejercicio_presupuestario}}, incluyendo previsiones de ingresos, gastos, inversiones y financiacion interna, conforme al resumen incorporado al expediente: {{presupuesto_resumen}}.

SEGUNDO.- El presupuesto aprobado contempla ingresos previstos por importe de {{total_ingresos}} euros, gastos previstos por importe de {{total_gastos}} euros y, en su caso, inversiones previstas por importe de {{total_inversiones}} euros.

TERCERO.- Se autoriza a {{directivo_ejecutor}} para ejecutar el presupuesto aprobado y realizar ajustes dentro del umbral de {{umbral_reformulacion}} sobre las partidas inicialmente previstas, debiendo informar al Consejo en la siguiente sesion de cualquier ajuste significativo.

CUARTO.- Se faculta al Secretario del Consejo para expedir certificaciones y realizar las comunicaciones internas necesarias para la implementacion del presupuesto.$capa1_APROBACION_PRESUPUESTOS$,
      $capa2_APROBACION_PRESUPUESTOS$[
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},
        {"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}
      ]$capa2_APROBACION_PRESUPUESTOS$::jsonb,
      $capa3_APROBACION_PRESUPUESTOS$[
        {"campo":"ejercicio_presupuestario","obligatoriedad":"OBLIGATORIO","descripcion":"Ejercicio presupuestario aprobado por el Consejo.","tipo":"text","label":"Ejercicio presupuestario"},
        {"campo":"presupuesto_resumen","obligatoriedad":"OBLIGATORIO","descripcion":"Resumen ejecutivo del presupuesto aprobado.","tipo":"textarea","label":"Resumen del presupuesto"},
        {"campo":"total_ingresos","obligatoriedad":"OBLIGATORIO","descripcion":"Importe total de ingresos previstos en euros.","tipo":"number","label":"Total ingresos"},
        {"campo":"total_gastos","obligatoriedad":"OBLIGATORIO","descripcion":"Importe total de gastos previstos en euros.","tipo":"number","label":"Total gastos"},
        {"campo":"total_inversiones","obligatoriedad":"OPCIONAL","descripcion":"Importe total de inversiones previstas, si aplica.","tipo":"number","label":"Total inversiones"},
        {"campo":"directivo_ejecutor","obligatoriedad":"OBLIGATORIO","descripcion":"Directivo o cargo autorizado para la ejecucion ordinaria del presupuesto.","tipo":"text","label":"Directivo ejecutor"},
        {"campo":"umbral_reformulacion","obligatoriedad":"OBLIGATORIO","descripcion":"Umbral porcentual o cuantitativo de ajustes permitidos sin nueva aprobacion.","tipo":"text","label":"Umbral de ajustes"}
      ]$capa3_APROBACION_PRESUPUESTOS$::jsonb,
      'Evitar duplicidad con APROBACION_PLAN_NEGOCIO si el plan ya incluye presupuesto anual. Escalar a Junta si la ejecucion implica activos esenciales, garantias o operaciones reservadas.'
    ),
    (
      'ee9c68f4-96dc-495e-be59-3d830d79a3ae'::uuid,
      'MODELO_ACUERDO',
      'FINANCIACION',
      'Modelo de acuerdo - aprobacion de operacion de financiacion por el Consejo',
      'Regimen general del organo de administracion; arts. 160.f, 162, 225, 245 y 247 LSC segun el caso',
      'CONSEJO_ADMIN',
      'MEETING',
      '0.1.0',
      'CAPITAL_FINANCIACION',
      'Capital y financiacion',
      $capa1_FINANCIACION$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, aprueba la operacion de financiacion consistente en {{tipo_financiacion}} con {{entidad_financiera}}, por un importe de {{importe_financiacion}} euros, con vencimiento {{plazo}} y condiciones financieras esenciales {{condiciones_financieras_resumen}}.

SEGUNDO.- Se autoriza la formalizacion de la operacion y, en su caso, de las garantias accesorias descritas en el expediente, designando a {{persona_firmante}} para su otorgamiento y firma en nombre de la Sociedad, con facultades para negociar y fijar condiciones no sustanciales dentro de los parametros aprobados.

TERCERO.- El presente acuerdo se adopta sin perjuicio de que, si la operacion afecta a activos esenciales o comporta concesion de garantias o creditos a administradores o personas vinculadas, deba obtenerse la autorizacion de la Junta General conforme al regimen legal aplicable, quedando su eficacia condicionada a dicha aprobacion cuando proceda.

CUARTO.- Se faculta al Secretario del Consejo para expedir certificaciones y realizar cuantas actuaciones sean precisas para la correcta ejecucion interna de este acuerdo.$capa1_FINANCIACION$,
      $capa2_FINANCIACION$[
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},
        {"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}
      ]$capa2_FINANCIACION$::jsonb,
      $capa3_FINANCIACION$[
        {"campo":"tipo_financiacion","obligatoriedad":"OBLIGATORIO","descripcion":"Tipo de financiacion: prestamo, credito, sindicada u otra modalidad.","tipo":"text","label":"Tipo de financiacion"},
        {"campo":"entidad_financiera","obligatoriedad":"OBLIGATORIO","descripcion":"Entidad financiera o contraparte financiadora.","tipo":"text","label":"Entidad financiera"},
        {"campo":"importe_financiacion","obligatoriedad":"OBLIGATORIO","descripcion":"Importe principal de la financiacion en euros.","tipo":"number","label":"Importe de financiacion"},
        {"campo":"plazo","obligatoriedad":"OBLIGATORIO","descripcion":"Plazo, vencimiento o calendario de amortizacion.","tipo":"text","label":"Plazo y vencimiento"},
        {"campo":"condiciones_financieras_resumen","obligatoriedad":"OBLIGATORIO","descripcion":"Resumen de tipo de interes, comisiones, amortizacion, covenants y condiciones relevantes.","tipo":"textarea","label":"Condiciones financieras"},
        {"campo":"garantias","obligatoriedad":"OPCIONAL","descripcion":"Garantias reales o personales asociadas, si aplica.","tipo":"textarea","label":"Garantias"},
        {"campo":"persona_firmante","obligatoriedad":"OBLIGATORIO","descripcion":"Persona o personas designadas para firmar la financiacion.","tipo":"text","label":"Firmante autorizado"}
      ]$capa3_FINANCIACION$::jsonb,
      'Documento previo necesario: term sheet o propuesta de financiacion. Verificar activos esenciales, garantias a administradores y vinculadas significativas antes de activar.'
    ),
    (
      'c2dcd1d4-a482-4186-9e20-1019ba4d281c'::uuid,
      'MODELO_ACUERDO',
      'CONTRATACION_RELEVANTE',
      'Modelo de acuerdo - aprobacion y adjudicacion de contrato relevante',
      'Regimen general del Consejo; arts. 160.f, 162, 225, 245 y 247 LSC; regimen de vinculadas si aplica',
      'CONSEJO_ADMIN',
      'MEETING',
      '0.1.0',
      'OPERACIONES_ESPECIALES_VINCULADAS',
      'Operaciones especiales y vinculadas',
      $capa1_CONTRATACION_RELEVANTE$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda aprobar y adjudicar a {{contraparte}} el contrato consistente en {{objeto_contrato}}, por un precio total de {{precio_total}} euros, con un plazo de {{plazo_contrato}} y las condiciones esenciales que se incorporan al expediente.

SEGUNDO.- Se faculta a {{persona_firmante}} para formalizar y ejecutar el contrato en nombre de la Sociedad, con facultades para negociar y fijar condiciones no sustanciales dentro de los parametros aprobados por el Consejo.

TERCERO.- El presente acuerdo se adopta sin perjuicio de que, si la operacion afectase a activos esenciales en los terminos del articulo 160.f de la Ley de Sociedades de Capital, implicase creditos o garantias a administradores o personas vinculadas, o quedase sujeta al regimen de operaciones vinculadas significativas en sociedades cotizadas, deba obtenerse la autorizacion del organo competente conforme a derecho, quedando condicionado en tal caso a dicha aprobacion.

CUARTO.- Se faculta al Secretario del Consejo para expedir las certificaciones oportunas y realizar cuantas actuaciones sean necesarias para la correcta ejecucion interna del acuerdo.$capa1_CONTRATACION_RELEVANTE$,
      $capa2_CONTRATACION_RELEVANTE$[
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},
        {"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}
      ]$capa2_CONTRATACION_RELEVANTE$::jsonb,
      $capa3_CONTRATACION_RELEVANTE$[
        {"campo":"contraparte","obligatoriedad":"OBLIGATORIO","descripcion":"Contraparte contratista o adjudicataria.","tipo":"text","label":"Contraparte"},
        {"campo":"objeto_contrato","obligatoriedad":"OBLIGATORIO","descripcion":"Objeto juridico y operativo del contrato.","tipo":"textarea","label":"Objeto del contrato"},
        {"campo":"precio_total","obligatoriedad":"OBLIGATORIO","descripcion":"Precio total o valor maximo del contrato en euros.","tipo":"number","label":"Precio total"},
        {"campo":"plazo_contrato","obligatoriedad":"OBLIGATORIO","descripcion":"Plazo, duracion o vencimiento del contrato.","tipo":"text","label":"Plazo del contrato"},
        {"campo":"condiciones_esenciales","obligatoriedad":"OBLIGATORIO","descripcion":"Entregables, SLA, penalizaciones, hitos y condiciones principales.","tipo":"textarea","label":"Condiciones esenciales"},
        {"campo":"persona_firmante","obligatoriedad":"OBLIGATORIO","descripcion":"Persona o personas designadas para firmar el contrato.","tipo":"text","label":"Firmante autorizado"},
        {"campo":"afecta_activos_esenciales","obligatoriedad":"OBLIGATORIO","descripcion":"Indica si la operacion afecta a activos esenciales por cuantia o relevancia funcional.","tipo":"boolean","label":"Afecta a activos esenciales"},
        {"campo":"es_parte_vinculada","obligatoriedad":"OBLIGATORIO","descripcion":"Indica si la contraparte es parte vinculada.","tipo":"boolean","label":"Parte vinculada"},
        {"campo":"incluye_garantias_a_administradores","obligatoriedad":"OBLIGATORIO","descripcion":"Indica si la operacion incluye creditos o garantias a administradores o vinculados.","tipo":"boolean","label":"Garantias a administradores"}
      ]$capa3_CONTRATACION_RELEVANTE$::jsonb,
      'Materia de Consejo para contratos relevantes ordinarios. Si aplica art. 160.f LSC, art. 162 LSC o vinculadas significativas en cotizadas, escalar a Junta o al circuito especifico.'
    ),
    (
      '52e7f727-125b-4d26-a46f-bf9a912df56e'::uuid,
      'CONVOCATORIA',
      'CONVOCATORIA_COMISION_DELEGADA',
      'Convocatoria - comision delegada del Consejo',
      'Arts. 249 y 249 bis LSC; arts. 529 quaterdecies, quindecies y sexdecies LSC si aplica cotizada',
      'COMISION_DELEGADA',
      'MEETING',
      '1.1.0',
      'GOBIERNO_ORGANOS',
      'Gobierno corporativo y organos',
      $capa1_CONVOCATORIA_COMISION_DELEGADA$Por medio de la presente se convoca a la {{comision_nombre}} de {{denominacion_social}} para celebrar sesion el dia {{fecha_sesion}} a las {{hora_sesion}}, en {{lugar_sesion}}, bajo modalidad {{modalidad_sesion}}, con el siguiente orden del dia: {{orden_dia}}.

La convocatoria se realiza por {{convocante_nombre}}, en su condicion de {{convocante_cargo}}, conforme al regimen de funcionamiento de la comision, al acuerdo de delegacion del Consejo y a las reglas internas aplicables.

La documentacion preparatoria queda a disposicion de los miembros de la comision en el expediente. Se solicita confirmacion de asistencia y, en su caso, indicacion de conexion, delegacion o representacion conforme a las normas internas del organo.$capa1_CONVOCATORIA_COMISION_DELEGADA$,
      $capa2_CONVOCATORIA_COMISION_DELEGADA$[
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},
        {"variable":"fecha_sesion","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"hora_sesion","fuente":"meetings.start_time","condicion":"SIEMPRE"},
        {"variable":"lugar_sesion","fuente":"meetings.location","condicion":"SIEMPRE"}
      ]$capa2_CONVOCATORIA_COMISION_DELEGADA$::jsonb,
      $capa3_CONVOCATORIA_COMISION_DELEGADA$[
        {"campo":"comision_nombre","obligatoriedad":"OBLIGATORIO","descripcion":"Denominacion de la comision delegada convocada.","tipo":"text","label":"Comision"},
        {"campo":"modalidad_sesion","obligatoriedad":"OBLIGATORIO","descripcion":"Modalidad de celebracion de la sesion: presencial, telematica o mixta.","tipo":"text","label":"Modalidad de la sesion"},
        {"campo":"orden_dia","obligatoriedad":"OBLIGATORIO","descripcion":"Orden del dia de la sesion de la comision.","tipo":"textarea","label":"Orden del dia"},
        {"campo":"convocante_nombre","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre de la persona que convoca la comision.","tipo":"text","label":"Convocante"},
        {"campo":"convocante_cargo","obligatoriedad":"OBLIGATORIO","descripcion":"Cargo o titulo habilitante de la persona convocante.","tipo":"text","label":"Cargo del convocante"}
      ]$capa3_CONVOCATORIA_COMISION_DELEGADA$::jsonb,
      'Borrador de nueva version de convocatoria de comision. Verificar reglamento de la comision, competencia del convocante y especialidades 529 LSC para cotizadas antes de activar.'
    )
)
INSERT INTO public.plantillas_protegidas (
  id,
  tenant_id,
  tipo,
  materia_acuerdo,
  materia,
  jurisdiccion,
  version,
  estado,
  organo_tipo,
  adoption_mode,
  contenido_template,
  variables,
  protecciones,
  snapshot_rule_pack_required,
  contrato_variables_version,
  capa1_inmutable,
  capa2_variables,
  capa3_editables,
  referencia_legal,
  notas_legal,
  created_at
)
SELECT
  id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  tipo,
  CASE WHEN tipo = 'MODELO_ACUERDO' THEN materia ELSE NULL END,
  materia,
  'ES',
  version,
  'BORRADOR',
  organo_tipo,
  adoption_mode,
  titulo,
  '[]'::jsonb,
  jsonb_build_object(
    'secciones_inmutables', jsonb_build_array('CAPA1_DISPOSITIVA'),
    'capa1_inmutable', true,
    'capa2_auto', true,
    'capa3_editable', true,
    'normalizacion', '2026-05-17',
    'paquete', 'consejo_administracion',
    'familia_materia', familia_materia,
    'familia_materia_label', familia_titulo
  ),
  true,
  'variables-plantillas-v1.1',
  capa1_inmutable,
  capa2_variables,
  capa3_editables,
  referencia_legal,
  notas_legal,
  now()
FROM templates
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  tipo = EXCLUDED.tipo,
  materia_acuerdo = EXCLUDED.materia_acuerdo,
  materia = EXCLUDED.materia,
  jurisdiccion = EXCLUDED.jurisdiccion,
  version = EXCLUDED.version,
  estado = EXCLUDED.estado,
  organo_tipo = EXCLUDED.organo_tipo,
  adoption_mode = EXCLUDED.adoption_mode,
  contenido_template = EXCLUDED.contenido_template,
  variables = EXCLUDED.variables,
  protecciones = EXCLUDED.protecciones,
  snapshot_rule_pack_required = EXCLUDED.snapshot_rule_pack_required,
  contrato_variables_version = EXCLUDED.contrato_variables_version,
  capa1_inmutable = EXCLUDED.capa1_inmutable,
  capa2_variables = EXCLUDED.capa2_variables,
  capa3_editables = EXCLUDED.capa3_editables,
  referencia_legal = EXCLUDED.referencia_legal,
  notas_legal = EXCLUDED.notas_legal;

COMMIT;
