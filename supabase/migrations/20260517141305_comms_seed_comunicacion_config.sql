-- Opt-out: socio único decide consigo mismo
UPDATE plantillas_protegidas SET requiere_comunicacion = false WHERE materia = 'DECISION_SOCIO_UNICO';

-- DECISION_ADMIN_UNICO: condicional (comunicación interna detalle)
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('TERCERO_EXTERNO'),
  'tipo_comunicacion_default', 'CONSIGNACION', 'tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO'),
  'plazo_legal_dias', null, 'condicional', true,
  'condicion_expresion', 'DECISION.comunicacion_interna_detalle IS NOT NULL',
  'referencia_legal', 'Art. 233.1 LSC'
) WHERE materia = 'DECISION_ADMIN_UNICO';

-- CONVOCATORIAS
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'CONVOCATORIA','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'),
  'plazo_legal_dias', 30, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 176.1 LSC'
) WHERE materia IN ('CONVOCATORIA_JUNTA','CONVOCATORIAS_JUNTAS');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_INDIVIDUAL','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 173 LSC'
) WHERE materia = 'NOTIFICACION_CONVOCATORIA_SL';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'CONVOCATORIA','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 246 LSC'
) WHERE materia = 'CONVOCATORIA_CDA';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'CONVOCATORIA','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 249 LSC + Reglamento Consejo'
) WHERE materia = 'CONVOCATORIA_COMISION_DELEGADA';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'PUESTA_DISPOSICION','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 196-197 LSC / 245.3 LSC'
) WHERE materia IN ('CONVOCATORIA_PRE','EXPEDIENTE_PRE');

-- ACTAS Y SESIONES (notificación de acuerdos adoptados)
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 202 LSC'
) WHERE materia IN ('JUNTA_GENERAL','CONSEJO_ADMIN','ACTA_COMISION_DELEGADA','ACTAS_ORGANOS_DELEGADOS');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'CIRCULAR_SIN_SESION','tipo_respuesta_esperada', 'VOTO',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS','EMAIL_CERTIFICADO'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 100 RRM'
) WHERE materia = 'ACUERDO_SIN_SESION';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'SOLICITUD_DECLARACION','tipo_respuesta_esperada', 'VOTO',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 233.2.b LSC'
) WHERE materia = 'CO_APROBACION';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'COMUNICACION_INTER_ORGANO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 227 LSC'
) WHERE materia = 'ADMIN_SOLIDARIO';

-- CERTIFICACION
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('TERCERO_EXTERNO'),
  'tipo_comunicacion_default', 'CERTIFICACION','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 108-109 RRM'
) WHERE materia = 'CERTIFICACION_ACUERDOS';

-- CARGOS (nombramiento/cese requieren aceptación)
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_CARGO','tipo_respuesta_esperada', 'ACEPTACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 214, 217-219, 244 LSC'
) WHERE materia = 'NOMBRAMIENTO_CONSEJERO';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_CARGO','tipo_respuesta_esperada', 'ACEPTACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 263-271 LSC'
) WHERE materia = 'NOMBRAMIENTO_AUDITOR';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_CARGO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 223 LSC'
) WHERE materia = 'CESE_CONSEJERO';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_CARGO','tipo_respuesta_esperada', 'ACEPTACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 245.2 LSC'
) WHERE materia = 'DISTRIBUCION_CARGOS';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_CARGO','tipo_respuesta_esperada', 'ACEPTACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 249 LSC'
) WHERE materia IN ('DELEGACION_FACULTADES','DELEGACION_CAPITAL');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_CARGO','tipo_respuesta_esperada', 'ACEPTACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'),
  'plazo_legal_dias', 15, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 529 terdecies+ LSC'
) WHERE materia = 'COMITES_INTERNOS';

-- ACUERDOS PATRIMONIALES (NOTIFICACION_ACUERDO con plazos legales)
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','AUDITOR','REGISTRO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 272-273 LSC'
) WHERE materia = 'APROBACION_CUENTAS';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','AUDITOR'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 253 LSC'
) WHERE materia = 'FORMULACION_CUENTAS';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 273, 348 LSC'
) WHERE materia = 'DISTRIBUCION_DIVIDENDOS';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'DECLARACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', 30, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 295-310 LSC'
) WHERE materia = 'AUMENTO_CAPITAL';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','TERCERO_EXTERNO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'DECLARACION',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS'),
  'plazo_legal_dias', 30, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 317-337 LSC'
) WHERE materia = 'REDUCCION_CAPITAL';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 285-290 LSC'
) WHERE materia = 'MODIFICACION_ESTATUTOS';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA','MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'SOLICITUD_DECLARACION','tipo_respuesta_esperada', 'DECLARACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 229-230 LSC'
) WHERE materia = 'OPERACION_VINCULADA';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'PUESTA_DISPOSICION','tipo_respuesta_esperada', 'VOTO',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 160.f LSC'
) WHERE materia = 'ACTIVOS_ESENCIALES';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 162 LSC'
) WHERE materia = 'AUTORIZACION_GARANTIA';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Gobierno corporativo (S/N legal específico)'
) WHERE materia IN ('APROBACION_PLAN_NEGOCIO','APROBACION_PRESUPUESTOS','CONTRATACION_RELEVANTE','FINANCIACION');

-- FUSIONES, ESCISIONES, TRANSFORMACION, DISOLUCION (oposición acreedores)
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','TERCERO_EXTERNO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'DECLARACION',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS'),
  'plazo_legal_dias', 30, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'RDL 5/2023'
) WHERE materia IN ('FUSION','ESCISION','FUSION_ESCISION','TRANSFORMACION');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','TERCERO_EXTERNO','REGISTRO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS','EMAIL_CERTIFICADO'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 360-400 LSC'
) WHERE materia IN ('DISOLUCION','LIQUIDACION');

-- POLITICAS
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'VOTO',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 217-219, 529 novodecies LSC'
) WHERE materia = 'POLITICA_REMUNERACION';

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 529 ter LSC'
) WHERE materia = 'POLITICAS_CORPORATIVAS';

-- ACCION SOCIAL DE RESPONSABILIDAD
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 238.3 LSC'
) WHERE materia = 'ACCION_SOCIAL_RESPONSABILIDAD';

-- INFORME GESTION
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 253, 262 LSC'
) WHERE materia = 'GESTION_SOCIEDAD';

-- RATIFICACION
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 234-235 LSC'
) WHERE materia = 'RATIFICACION_ACTOS';

-- SEGUROS RESPONSABILIDAD
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'DECLARACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 14 LOSSEAR'
) WHERE materia = 'SEGUROS_RESPONSABILIDAD';

-- PACTO PARASOCIAL
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'COMUNICACION_INTER_ORGANO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Art. 530 LSC'
) WHERE materia = 'PACTO_PARASOCIAL';

-- ESTRUCTURALES + ADQUISICION PROPIA + EMISIONES + EXCLUSION/SEPARACION SOCIO
UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 285-290 LSC'
) WHERE materia IN ('CAMBIO_DENOMINACION_SOCIAL','CAMBIO_DOMICILIO_SOCIAL','AMPLIACION_OBJETO_SOCIAL','PRORROGA_SOCIEDAD');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO','TERCERO_EXTERNO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'DECLARACION',
  'nivel_certificacion_minimo', 'EMAIL_CERTIFICADO',
  'canales_permitidos', jsonb_build_array('EMAIL_CERTIFICADO','BUROFAX_ERDS'),
  'plazo_legal_dias', 30, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 401-417 LSC'
) WHERE materia IN ('EMISION_OBLIGACIONES','EMISION_DEUDA_CONVERTIBLE');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('PERSONA_AFECTADA'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'ACUSE',
  'nivel_certificacion_minimo', 'BUROFAX_ERDS',
  'canales_permitidos', jsonb_build_array('BUROFAX_ERDS'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 350-359 LSC'
) WHERE materia IN ('EXCLUSION_SOCIO','SEPARACION_SOCIO');

UPDATE plantillas_protegidas SET comunicacion_config = jsonb_build_object(
  'destinatarios_tipo', jsonb_build_array('MIEMBROS_ORGANO'),
  'tipo_comunicacion_default', 'NOTIFICACION_ACUERDO','tipo_respuesta_esperada', 'INFORMATIVA',
  'nivel_certificacion_minimo', 'EMAIL_NORMAL',
  'canales_permitidos', jsonb_build_array('EMAIL_NORMAL','EMAIL_CERTIFICADO','PORTAL_PUSH'),
  'plazo_legal_dias', null, 'condicional', false, 'condicion_expresion', null,
  'referencia_legal', 'Arts. 144-148 LSC'
) WHERE materia = 'ADQUISICION_PROPIA';
