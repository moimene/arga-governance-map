-- Secretaria 360 - paquete de modelos de acuerdo pendientes.
--
-- Objetivo: crear 15 MODELO_ACUERDO en BORRADOR para materias del catalogo
-- que no tienen modelo activo especifico. No promueve a ACTIVA ni firma
-- contenido legal.
--
-- Inventario y normalizacion del borrador legal:
-- - Se sustituyen placeholders no operativos tipo sociedad.*, acuerdo.*,
--   persona.*, registro.* y reunion.* por variables planas.
-- - Las variables automaticas usan fuentes reconocidas por el resolver:
--   entities.*, governing_bodies.*, meetings.* y rule_pack.* cuando aplica.
-- - Los datos no deducibles del expediente pasan a capa3_editables.
-- - Las referencias LME de fusion/escision se llevan a notas_legal y el
--   texto cita RDL 5/2023.
-- - Cuando inscripcion/publicacion depende del caso, Capa 1 usa "cuando
--   proceda" y el detalle queda en notas_legal.

BEGIN;

WITH templates (
  id,
  materia,
  titulo,
  referencia_legal,
  capa1_inmutable,
  capa2_variables,
  capa3_editables,
  notas_legal
) AS (
  VALUES
    (
      '062d5e89-dc9b-421c-b491-7f6d9be2bde8'::uuid,
      'ADQUISICION_PROPIA',
      'Modelo de acuerdo - adquisicion derivativa de acciones o participaciones propias',
      'Arts. 144, 146 y 148 LSC; normativa de mercado aplicable si la sociedad es cotizada',
      $capa1_ADQUISICION_PROPIA$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda autorizar a {{denominacion_social}}, atendiendo a su tipo social {{tipo_social}}, para adquirir de forma derivativa acciones o participaciones propias, directamente o a traves de sociedades dependientes, dentro de los limites legales, estatutarios y de mercado que resulten aplicables.

SEGUNDO.- La autorizacion queda limitada a un porcentaje maximo del capital social de {{max_porcentaje_capital}}, dentro del rango de precio {{rango_precio}}, y tendra una vigencia maxima de {{vigencia_meses}} meses desde la fecha de adopcion del acuerdo.

TERCERO.- La finalidad de la operacion sera {{finalidad_operacion}}, sin perjuicio de que cada adquisicion concreta deba respetar las restricciones legales, financieras, sectoriales y de gobierno corporativo aplicables.

CUARTO.- Se faculta al organo de administracion para ejecutar la autorizacion, decidir el momento, condiciones y medios de realizacion, y para enajenar, amortizar o conservar los titulos adquiridos cuando proceda.

QUINTO.- Se faculta a las personas designadas en el expediente para formalizar el acuerdo y realizar las comunicaciones, inscripciones o publicaciones que procedan segun el caso.$capa1_ADQUISICION_PROPIA$,
      $capa2_ADQUISICION_PROPIA$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},
        {"variable":"tipo_social","fuente":"entities.entity_type_detail","condicion":"SIEMPRE"}
      ]$capa2_ADQUISICION_PROPIA$::jsonb,
      $capa3_ADQUISICION_PROPIA$[
        {"campo":"max_porcentaje_capital","obligatoriedad":"OBLIGATORIO","descripcion":"Porcentaje maximo del capital social autorizado para adquisicion propia.","tipo":"number","label":"Porcentaje maximo sobre capital"},
        {"campo":"rango_precio","obligatoriedad":"OBLIGATORIO","descripcion":"Precio minimo y maximo o formula de determinacion del precio.","tipo":"text","label":"Rango de precio"},
        {"campo":"vigencia_meses","obligatoriedad":"OBLIGATORIO","descripcion":"Duracion de la autorizacion en meses.","tipo":"number","label":"Vigencia de la autorizacion"},
        {"campo":"finalidad_operacion","obligatoriedad":"OBLIGATORIO","descripcion":"Finalidad societaria o de mercado que justifica la adquisicion.","tipo":"textarea","label":"Finalidad de la operacion"}
      ]$capa3_ADQUISICION_PROPIA$::jsonb,
      'Borrador legal normalizado. Requiere bifurcacion SA/SL y, si la sociedad es cotizada, validacion LMV/MAR y limites de autocartera antes de activar.'
    ),
    (
      'bc63c7f5-607c-491e-826e-ae8b54070810'::uuid,
      'AMPLIACION_OBJETO_SOCIAL',
      'Modelo de acuerdo - ampliacion del objeto social',
      'Arts. 285, 287 y 290 LSC',
      $capa1_AMPLIACION_OBJETO_SOCIAL$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda modificar el articulo de los Estatutos Sociales relativo al objeto social de {{denominacion_social}}, que quedara redactado en los siguientes terminos: {{nueva_redaccion_objeto}}.

SEGUNDO.- Se deja constancia de que la propuesta de modificacion y el texto integro de la nueva redaccion han estado a disposicion de los socios o accionistas en los terminos previstos en la Ley de Sociedades de Capital y en los Estatutos Sociales.

TERCERO.- Se faculta al organo de administracion y a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion y realizar las publicaciones o comunicaciones que procedan.

CUARTO.- El acuerdo se adopta con las mayorias legales, estatutarias y, en su caso, pactadas que resulten exigibles, quedando su verificacion incorporada al expediente.$capa1_AMPLIACION_OBJETO_SOCIAL$,
      $capa2_AMPLIACION_OBJETO_SOCIAL$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_AMPLIACION_OBJETO_SOCIAL$::jsonb,
      $capa3_AMPLIACION_OBJETO_SOCIAL$[
        {"campo":"nueva_redaccion_objeto","obligatoriedad":"OBLIGATORIO","descripcion":"Texto integro del nuevo articulo estatutario de objeto social.","tipo":"textarea","label":"Nueva redaccion del objeto social"}
      ]$capa3_AMPLIACION_OBJETO_SOCIAL$::jsonb,
      'La convocatoria debe incluir los extremos a modificar y el derecho de informacion del art. 287 LSC. Verificar mayoria reforzada por tipo social antes de activar.'
    ),
    (
      '0d6d8934-f99c-4f77-aa3b-49384c5900ec'::uuid,
      'CAMBIO_DENOMINACION_SOCIAL',
      'Modelo de acuerdo - cambio de denominacion social',
      'Arts. 285, 287 y 290 LSC; normativa registral sobre denominacion social',
      $capa1_CAMBIO_DENOMINACION_SOCIAL$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda modificar el articulo de los Estatutos Sociales relativo a la denominacion social de {{denominacion_social}}, que pasara a ser {{nueva_denominacion}} desde la eficacia del acuerdo conforme a la normativa aplicable.

SEGUNDO.- La nueva denominacion sustituira a la anterior en cuantos documentos, libros, registros, comunicaciones y relaciones juridicas de la sociedad sea necesario actualizar.

TERCERO.- Se faculta al organo de administracion y a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion y realizar las publicaciones o comunicaciones que procedan.

CUARTO.- Se deja constancia de que se han observado las exigencias de informacion previa y las mayorias requeridas por la Ley, los Estatutos y, en su caso, pactos vigentes.$capa1_CAMBIO_DENOMINACION_SOCIAL$,
      $capa2_CAMBIO_DENOMINACION_SOCIAL$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_CAMBIO_DENOMINACION_SOCIAL$::jsonb,
      $capa3_CAMBIO_DENOMINACION_SOCIAL$[
        {"campo":"nueva_denominacion","obligatoriedad":"OBLIGATORIO","descripcion":"Nueva denominacion social aprobada por el organo competente.","tipo":"text","label":"Nueva denominacion social"}
      ]$capa3_CAMBIO_DENOMINACION_SOCIAL$::jsonb,
      'Debe verificarse certificacion negativa o disponibilidad de denominacion cuando proceda, y cumplimiento del art. 287 LSC.'
    ),
    (
      '3f7ff8b6-8561-43e6-945a-527dfd51083f'::uuid,
      'CAMBIO_DOMICILIO_SOCIAL',
      'Modelo de acuerdo - cambio de domicilio social',
      'Arts. 285, 287 y 290 LSC; reglas estatutarias de competencia',
      $capa1_CAMBIO_DOMICILIO_SOCIAL$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda modificar el articulo estatutario relativo al domicilio social de {{denominacion_social}}, que pasara a estar situado en {{nuevo_domicilio_completo}}.

SEGUNDO.- La nueva redaccion estatutaria surtira efecto conforme a la normativa aplicable y se incorporara a los libros, registros internos, comunicaciones y documentos societarios que proceda actualizar.

TERCERO.- Se faculta al organo de administracion y a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion y realizar las publicaciones o comunicaciones que procedan.

CUARTO.- Se deja constancia de que la competencia del organo que adopta el acuerdo y los requisitos de convocatoria, informacion y mayoria han sido verificados en el expediente.$capa1_CAMBIO_DOMICILIO_SOCIAL$,
      $capa2_CAMBIO_DOMICILIO_SOCIAL$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_CAMBIO_DOMICILIO_SOCIAL$::jsonb,
      $capa3_CAMBIO_DOMICILIO_SOCIAL$[
        {"campo":"nuevo_domicilio_completo","obligatoriedad":"OBLIGATORIO","descripcion":"Direccion completa del nuevo domicilio social.","tipo":"textarea","label":"Nuevo domicilio social"}
      ]$capa3_CAMBIO_DOMICILIO_SOCIAL$::jsonb,
      'Comprobar si los Estatutos atribuyen competencia al organo de administracion para cambios dentro del territorio nacional; si aplica, usar variante de Consejo antes de activar.'
    ),
    (
      '5461dc99-6b5f-4132-b5c7-af623e6145b5'::uuid,
      'DELEGACION_CAPITAL',
      'Modelo de acuerdo - delegacion para aumentar capital',
      'Art. 297 LSC y concordantes sobre aumentos de capital y derechos preferentes',
      $capa1_DELEGACION_CAPITAL$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda delegar en el organo de administracion de {{denominacion_social}} la facultad de acordar, en una o varias veces, el aumento del capital social hasta el limite maximo conjunto de {{importe_maximo_delegado}} euros, dentro del plazo maximo de {{plazo_delegacion_meses}} meses desde la fecha de adopcion del presente acuerdo.

SEGUNDO.- La delegacion comprendera la facultad de fijar la cuantia, el momento de ejecucion, el procedimiento de desembolso, la clase o serie de titulos o participaciones y las restantes condiciones que sean necesarias dentro del marco aprobado por la Junta General.

TERCERO.- Cualquier exclusion o limitacion del derecho de suscripcion o asuncion preferente solo podra acordarse si resulta legalmente admisible, esta debidamente justificada por el interes social y cuenta con los informes o cautelas exigibles.

CUARTO.- Se faculta al organo de administracion y a las personas designadas en el expediente para formalizar, ejecutar, elevar a publico e inscribir los acuerdos de aumento que se adopten al amparo de la delegacion cuando proceda.$capa1_DELEGACION_CAPITAL$,
      $capa2_DELEGACION_CAPITAL$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_DELEGACION_CAPITAL$::jsonb,
      $capa3_DELEGACION_CAPITAL$[
        {"campo":"importe_maximo_delegado","obligatoriedad":"OBLIGATORIO","descripcion":"Importe maximo agregado de capital cuya ejecucion se delega.","tipo":"number","label":"Importe maximo delegado"},
        {"campo":"plazo_delegacion_meses","obligatoriedad":"OBLIGATORIO","descripcion":"Plazo maximo de vigencia de la delegacion en meses.","tipo":"number","label":"Plazo de delegacion"}
      ]$capa3_DELEGACION_CAPITAL$::jsonb,
      'Coordinar con AUMENTO_CAPITAL. La eventual exclusion de derechos preferentes exige informe y validacion especifica; no queda preaprobada por este texto.'
    ),
    (
      'b1a526d7-a251-4bb3-ba01-c96dc2cecfb2'::uuid,
      'DISOLUCION',
      'Modelo de acuerdo - disolucion de la sociedad',
      'Arts. 360 a 378 LSC, especialmente art. 368 LSC',
      $capa1_DISOLUCION$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda declarar la disolucion de {{denominacion_social}} por concurrir la siguiente causa: {{causa_disolucion}}.

SEGUNDO.- Desde la eficacia del acuerdo se abre el periodo de liquidacion de la sociedad, con los efectos legales y estatutarios inherentes, sin perjuicio de las actuaciones de formalizacion, inscripcion y publicidad que procedan.

TERCERO.- Quedaran cesados los administradores en su funcion de administracion ordinaria y seran sustituidos por los liquidadores que resulten designados en acuerdo especifico o por los que correspondan conforme a la Ley y los Estatutos.

CUARTO.- Se faculta a las personas designadas en el expediente para elevar a publico el acuerdo, solicitar las inscripciones que procedan y realizar las comunicaciones necesarias para su plena ejecucion.$capa1_DISOLUCION$,
      $capa2_DISOLUCION$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_DISOLUCION$::jsonb,
      $capa3_DISOLUCION$[
        {"campo":"causa_disolucion","obligatoriedad":"OBLIGATORIO","descripcion":"Causa legal, estatutaria o voluntaria que justifica la disolucion.","tipo":"textarea","label":"Causa de disolucion"}
      ]$capa3_DISOLUCION$::jsonb,
      'Coordinar con LIQUIDACION para nombramiento de liquidadores. Verificar causa, mayoria y, si aplica, derechos de veto o mayorias pactadas.'
    ),
    (
      'ab84d68f-2762-4372-b9aa-d374ca19838d'::uuid,
      'EMISION_DEUDA_CONVERTIBLE',
      'Modelo de acuerdo - emision de deuda convertible',
      'Art. 414 LSC y concordantes sobre obligaciones convertibles y derechos preferentes',
      $capa1_EMISION_DEUDA_CONVERTIBLE$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda aprobar la emision por {{denominacion_social}} de obligaciones, bonos u otros valores convertibles por un importe nominal maximo de {{importe_maximo_emision}} euros.

SEGUNDO.- La emision tendra el plazo o vencimiento {{plazo_emision}}, devengara el tipo de interes {{tipo_interes}} y se regira por las condiciones financieras y de amortizacion que consten en el expediente y en la documentacion de emision.

TERCERO.- Se aprueban las bases y modalidades de conversion siguientes: {{bases_conversion}}.

CUARTO.- Se faculta al organo de administracion para completar las condiciones de la emision dentro de las bases aprobadas, otorgar los documentos necesarios, elevar a publico el acuerdo y gestionar las inscripciones, comunicaciones o publicaciones que procedan.

QUINTO.- Cualquier exclusion o limitacion de derechos preferentes solo sera eficaz si se documenta la justificacion del interes social y se cumplen los informes y requisitos legales aplicables.$capa1_EMISION_DEUDA_CONVERTIBLE$,
      $capa2_EMISION_DEUDA_CONVERTIBLE$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_EMISION_DEUDA_CONVERTIBLE$::jsonb,
      $capa3_EMISION_DEUDA_CONVERTIBLE$[
        {"campo":"importe_maximo_emision","obligatoriedad":"OBLIGATORIO","descripcion":"Importe nominal maximo de la emision convertible.","tipo":"number","label":"Importe maximo de emision"},
        {"campo":"plazo_emision","obligatoriedad":"OBLIGATORIO","descripcion":"Plazo, vencimiento o calendario de amortizacion/conversion.","tipo":"text","label":"Plazo de emision"},
        {"campo":"tipo_interes","obligatoriedad":"OBLIGATORIO","descripcion":"Tipo de interes o formula de remuneracion de la deuda convertible.","tipo":"text","label":"Tipo de interes"},
        {"campo":"bases_conversion","obligatoriedad":"OBLIGATORIO","descripcion":"Relacion de canje, ventanas de conversion, ajustes y reglas de redondeo.","tipo":"textarea","label":"Bases de conversion"}
      ]$capa3_EMISION_DEUDA_CONVERTIBLE$::jsonb,
      'Materia con alta dependencia del tipo social y del instrumento. Verificar informes, derechos preferentes, limites estatutarios y normativa de mercado antes de activar.'
    ),
    (
      '31f1d0a7-23be-43c1-9a91-a6896baefc58'::uuid,
      'EMISION_OBLIGACIONES',
      'Modelo de acuerdo - emision de obligaciones o instrumentos de deuda',
      'Art. 401 LSC y concordantes sobre emision de obligaciones',
      $capa1_EMISION_OBLIGACIONES$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda aprobar la emision por {{denominacion_social}} de obligaciones, bonos u otros instrumentos de deuda no convertibles por un importe nominal maximo de {{importe_maximo_emision}} euros.

SEGUNDO.- La emision se regira por las siguientes condiciones financieras principales: {{condiciones_financieras}}.

TERCERO.- Se faculta al organo de administracion para completar, dentro del marco aprobado, los terminos de la emision, instrumentarla, otorgar la escritura o documentos necesarios y realizar las actuaciones de inscripcion, colocacion, comunicacion o publicacion que procedan.

CUARTO.- El expediente debera incorporar la documentacion financiera, societaria y regulatoria necesaria para acreditar competencia, limites, condiciones de mercado y cumplimiento de las formalidades aplicables.$capa1_EMISION_OBLIGACIONES$,
      $capa2_EMISION_OBLIGACIONES$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_EMISION_OBLIGACIONES$::jsonb,
      $capa3_EMISION_OBLIGACIONES$[
        {"campo":"importe_maximo_emision","obligatoriedad":"OBLIGATORIO","descripcion":"Importe nominal maximo de la emision de deuda.","tipo":"number","label":"Importe maximo de emision"},
        {"campo":"condiciones_financieras","obligatoriedad":"OBLIGATORIO","descripcion":"Vencimiento, interes, amortizacion, garantias y restantes condiciones financieras.","tipo":"textarea","label":"Condiciones financieras"}
      ]$capa3_EMISION_OBLIGACIONES$::jsonb,
      'Verificar competencia de Junta u organo de administracion segun estatutos, tipo de instrumento y regimen aplicable.'
    ),
    (
      '1c67c4e3-6978-4965-a69e-ec934c58bdbe'::uuid,
      'ESCISION',
      'Modelo de acuerdo - escision, escision parcial o segregacion',
      'RDL 5/2023, arts. 60 a 67 y regimen general de modificaciones estructurales',
      $capa1_ESCISION$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda aprobar la modificacion estructural consistente en {{tipo_escision}} de {{denominacion_social}}, conforme al Real Decreto-ley 5/2023, con transmision en bloque por sucesion universal de los patrimonios afectados a favor de las sociedades beneficiarias identificadas como {{sociedades_beneficiarias}}.

SEGUNDO.- Se aprueba el proyecto comun de escision incorporado al expediente, asi como la relacion de canje y, en su caso, la compensacion dineraria descrita en {{relacion_canje}}, tomando como referencia el balance de escision de fecha {{fecha_balance_escision}}.

TERCERO.- El expediente incorporara las publicaciones, comunicaciones, informes y, cuando proceda, el tratamiento de oposicion de acreedores, socios, trabajadores y demas interesados exigible por el Real Decreto-ley 5/2023.

CUARTO.- Se faculta a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion y realizar las publicaciones o comunicaciones complementarias que procedan.

QUINTO.- La eficacia del acuerdo queda sujeta al cumplimiento de las condiciones, autorizaciones, informes y calificaciones que resulten aplicables al subtipo de escision seleccionado.$capa1_ESCISION$,
      $capa2_ESCISION$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_ESCISION$::jsonb,
      $capa3_ESCISION$[
        {"campo":"tipo_escision","obligatoriedad":"OBLIGATORIO","descripcion":"Tipo de operacion: ESCISION_TOTAL, ESCISION_PARCIAL o SEGREGACION.","tipo":"select","label":"Tipo de escision"},
        {"campo":"sociedades_beneficiarias","obligatoriedad":"OBLIGATORIO","descripcion":"Identidad de las sociedades beneficiarias o referencias del proyecto comun.","tipo":"textarea","label":"Sociedades beneficiarias"},
        {"campo":"relacion_canje","obligatoriedad":"OBLIGATORIO","descripcion":"Relacion de canje y compensacion dineraria, si procede.","tipo":"textarea","label":"Relacion de canje"},
        {"campo":"fecha_balance_escision","obligatoriedad":"OBLIGATORIO","descripcion":"Fecha del balance de escision usado en el proyecto.","tipo":"date","label":"Fecha balance de escision"}
      ]$capa3_ESCISION$::jsonb,
      'El borrador original citaba art. 68 LME; se normaliza a RDL 5/2023. Verificar si aplica regimen abreviado/simplificado e informe de experto.'
    ),
    (
      '206eae8c-51d2-4ab6-b4d4-2183b6cab519'::uuid,
      'EXCLUSION_SOCIO',
      'Modelo de acuerdo - exclusion de socio',
      'Art. 351 LSC y concordantes sobre exclusion, valoracion y reembolso',
      $capa1_EXCLUSION_SOCIO$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda la exclusion del socio {{socio_afectado_nombre}} de {{denominacion_social}} por concurrir la siguiente causa legal o estatutaria: {{causa_exclusion}}.

SEGUNDO.- Se reconoce el derecho del socio excluido a la valoracion y reembolso del valor razonable de sus acciones o participaciones conforme al procedimiento previsto en la Ley, los Estatutos y, en su caso, pactos aplicables.

TERCERO.- El procedimiento de valoracion y reembolso que se seguira sera el siguiente: {{procedimiento_valoracion}}.

CUARTO.- Se faculta a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion cuando proceda y ejecutar las actuaciones necesarias para la liquidacion de la participacion del socio excluido.

QUINTO.- La eficacia del acuerdo queda sujeta a la acreditacion suficiente de la causa de exclusion, la regularidad de la convocatoria y la observancia de las mayorias exigibles.$capa1_EXCLUSION_SOCIO$,
      $capa2_EXCLUSION_SOCIO$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_EXCLUSION_SOCIO$::jsonb,
      $capa3_EXCLUSION_SOCIO$[
        {"campo":"socio_afectado_nombre","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre completo o denominacion del socio afectado.","tipo":"text","label":"Socio afectado"},
        {"campo":"causa_exclusion","obligatoriedad":"OBLIGATORIO","descripcion":"Causa legal o estatutaria de exclusion y hechos que la sustentan.","tipo":"textarea","label":"Causa de exclusion"},
        {"campo":"procedimiento_valoracion","obligatoriedad":"OBLIGATORIO","descripcion":"Metodo y procedimiento de valoracion y reembolso.","tipo":"textarea","label":"Procedimiento de valoracion"}
      ]$capa3_EXCLUSION_SOCIO$::jsonb,
      'La identidad del socio se mueve a Capa 3 porque el resolver no identifica automaticamente al socio afectado por expediente. Requiere prueba de causa y cautelas de audiencia/impugnacion.'
    ),
    (
      '8f3bb188-14ca-4536-8c1e-eed863fd2634'::uuid,
      'FUSION',
      'Modelo de acuerdo - fusion por absorcion o nueva creacion',
      'RDL 5/2023, arts. 35 a 52 y regimen general de modificaciones estructurales',
      $capa1_FUSION$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda aprobar la modificacion estructural consistente en {{tipo_fusion}} de {{denominacion_social}} con las sociedades participantes identificadas en el proyecto comun como {{sociedades_participantes}}, conforme al Real Decreto-ley 5/2023.

SEGUNDO.- Se aprueba el proyecto comun de fusion incorporado al expediente, asi como la relacion de canje y, en su caso, la compensacion dineraria descrita en {{relacion_canje}}, tomando como referencia el balance de fusion de fecha {{fecha_balance_fusion}}.

TERCERO.- El expediente incorporara las publicaciones, comunicaciones, informes y, cuando proceda, el tratamiento de oposicion de acreedores, socios, trabajadores y demas interesados exigible por la normativa aplicable.

CUARTO.- Se faculta a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion y realizar las publicaciones o comunicaciones complementarias que procedan.

QUINTO.- La eficacia del acuerdo queda sujeta al cumplimiento de las condiciones, autorizaciones, informes y calificaciones que resulten aplicables al subtipo de fusion seleccionado.$capa1_FUSION$,
      $capa2_FUSION$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_FUSION$::jsonb,
      $capa3_FUSION$[
        {"campo":"tipo_fusion","obligatoriedad":"OBLIGATORIO","descripcion":"Tipo de fusion: FUSION_ABSORCION o FUSION_NUEVA_CREACION.","tipo":"select","label":"Tipo de fusion"},
        {"campo":"sociedades_participantes","obligatoriedad":"OBLIGATORIO","descripcion":"Identidad de sociedades participantes o referencia del proyecto comun.","tipo":"textarea","label":"Sociedades participantes"},
        {"campo":"relacion_canje","obligatoriedad":"OBLIGATORIO","descripcion":"Relacion de canje y compensacion dineraria, si procede.","tipo":"textarea","label":"Relacion de canje"},
        {"campo":"fecha_balance_fusion","obligatoriedad":"OBLIGATORIO","descripcion":"Fecha del balance de fusion usado en el proyecto.","tipo":"date","label":"Fecha balance de fusion"}
      ]$capa3_FUSION$::jsonb,
      'El borrador original citaba art. 40 LME; se normaliza a RDL 5/2023. Verificar si aplica regimen simplificado, informe de experto, especialidades de cotizadas y derechos de oposicion.'
    ),
    (
      '1ab35703-4c08-4b1a-b5e4-85dd06a68021'::uuid,
      'LIQUIDACION',
      'Modelo de acuerdo - nombramiento de liquidadores y reglas de liquidacion',
      'Arts. 374 y concordantes LSC',
      $capa1_LIQUIDACION$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda nombrar como liquidadores de {{denominacion_social}} a {{identidad_liquidadores}}, quienes aceptaran el cargo y ejerceran sus funciones con las facultades legales, estatutarias y las que resulten del presente acuerdo.

SEGUNDO.- Los liquidadores iniciaran las operaciones de liquidacion, inventario y balance inicial, actuando en interes de la sociedad, socios y acreedores, y conforme a las siguientes reglas basicas: {{reglas_liquidacion}}.

TERCERO.- Se faculta a los liquidadores para otorgar los documentos necesarios, gestionar las inscripciones o comunicaciones que procedan y realizar los actos de conservacion, realizacion de activos, pago de pasivos y distribucion del haber social que resulten necesarios.

CUARTO.- Los liquidadores rendiran cuentas cuando corresponda y someteran a la aprobacion del organo competente el balance final, el informe completo de operaciones y el proyecto de division del haber social.$capa1_LIQUIDACION$,
      $capa2_LIQUIDACION$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_LIQUIDACION$::jsonb,
      $capa3_LIQUIDACION$[
        {"campo":"identidad_liquidadores","obligatoriedad":"OBLIGATORIO","descripcion":"Identidad completa de liquidadores designados y, si procede, regimen de actuacion.","tipo":"textarea","label":"Identidad de liquidadores"},
        {"campo":"reglas_liquidacion","obligatoriedad":"OBLIGATORIO","descripcion":"Reglas basicas de actuacion durante el periodo de liquidacion.","tipo":"textarea","label":"Reglas de liquidacion"}
      ]$capa3_LIQUIDACION$::jsonb,
      'Debe coordinarse con DISOLUCION y con la aceptacion e inscripcion de liquidadores. No activar sin validacion de causa previa y regimen de liquidadores.'
    ),
    (
      '19010cbc-d27e-4321-bfe0-e46d961efbe8'::uuid,
      'PACTO_PARASOCIAL',
      'Modelo de acuerdo - toma de razon, adhesion o modificacion de pacto parasocial',
      'Art. 29 LSC; Estatutos y pactos parasociales aplicables',
      $capa1_PACTO_PARASOCIAL$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, toma razon y aprueba, en lo que proceda y sea de su competencia, la {{naturaleza_modificacion}} del pacto parasocial denominado {{nombre_pacto}}, relativo a {{denominacion_social}} y suscrito o a suscribir por los socios identificados en el expediente.

SEGUNDO.- La sociedad deja constancia de que la eficacia propia del pacto parasocial es inter partes, sin perjuicio de los efectos societarios, estatutarios o contractuales que puedan resultar de su contenido y de los acuerdos que, dentro de la competencia social, se adopten.

TERCERO.- Se faculta a {{representante_sociedad}} para realizar las actuaciones necesarias para la suscripcion, adhesion, modificacion, toma de razon o ejecucion documental del pacto, dentro de los limites legales, estatutarios y de gobierno corporativo aplicables.

CUARTO.- El expediente incorporara la version integra del pacto o de la modificacion, la identificacion de los firmantes y la valoracion de sus efectos sobre organos sociales, mayorias, vetos, transmisiones y conflictos de interes.$capa1_PACTO_PARASOCIAL$,
      $capa2_PACTO_PARASOCIAL$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_PACTO_PARASOCIAL$::jsonb,
      $capa3_PACTO_PARASOCIAL$[
        {"campo":"naturaleza_modificacion","obligatoriedad":"OBLIGATORIO","descripcion":"Suscripcion, adhesion, modificacion, toma de razon u otra naturaleza del acto.","tipo":"select","label":"Naturaleza del pacto"},
        {"campo":"nombre_pacto","obligatoriedad":"OBLIGATORIO","descripcion":"Denominacion o referencia del pacto parasocial.","tipo":"text","label":"Nombre del pacto"},
        {"campo":"representante_sociedad","obligatoriedad":"OBLIGATORIO","descripcion":"Persona facultada para actuar en nombre de la sociedad.","tipo":"text","label":"Representante de la sociedad"}
      ]$capa3_PACTO_PARASOCIAL$::jsonb,
      'Evitar presentar el pacto como oponible erga omnes salvo estatutarizacion o publicidad especifica. Revisar efectos de art. 29 LSC y matriz de pactos vigente.'
    ),
    (
      '5d3558e7-675b-46a0-80f1-0164e0d04977'::uuid,
      'PRORROGA_SOCIEDAD',
      'Modelo de acuerdo - prorroga de la duracion de la sociedad',
      'Arts. 285, 287 y 290 LSC',
      $capa1_PRORROGA_SOCIEDAD$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, acuerda modificar el articulo estatutario relativo a la duracion de {{denominacion_social}}, que pasara a ser {{nueva_duracion}} desde la eficacia del acuerdo conforme a la normativa aplicable.

SEGUNDO.- La nueva duracion sustituira a la redaccion anterior de los Estatutos Sociales y se incorporara a cuantos documentos societarios, libros y registros internos proceda actualizar.

TERCERO.- Se faculta al organo de administracion y a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion y realizar las publicaciones o comunicaciones que procedan.

CUARTO.- Se deja constancia de que el texto integro de la modificacion, la competencia del organo y las mayorias requeridas han sido verificados en el expediente.$capa1_PRORROGA_SOCIEDAD$,
      $capa2_PRORROGA_SOCIEDAD$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_PRORROGA_SOCIEDAD$::jsonb,
      $capa3_PRORROGA_SOCIEDAD$[
        {"campo":"nueva_duracion","obligatoriedad":"OBLIGATORIO","descripcion":"Nueva duracion estatutaria: indefinida o fecha/plazo concreto.","tipo":"text","label":"Nueva duracion"}
      ]$capa3_PRORROGA_SOCIEDAD$::jsonb,
      'Verificar convocatoria con texto integro, mayoria reforzada y posible derecho de separacion si resultase aplicable por configuracion estatutaria.'
    ),
    (
      '01618e42-4929-46ad-9b65-e0b094468b81'::uuid,
      'SEPARACION_SOCIO',
      'Modelo de acuerdo - reconocimiento de separacion de socio',
      'Art. 346 LSC y concordantes sobre derecho de separacion, valoracion y reembolso',
      $capa1_SEPARACION_SOCIO$PRIMERO.- El organo competente {{organo_nombre}}, reunido el {{fecha_junta}}, toma razon del ejercicio del derecho de separacion por el socio {{socio_afectado_nombre}} de {{denominacion_social}}, por la siguiente causa legal o estatutaria: {{causa_separacion}}.

SEGUNDO.- Se acuerda reconocer la efectividad del derecho de separacion en los terminos previstos por la Ley y los Estatutos, iniciandose el procedimiento de valoracion y reembolso del valor razonable de sus acciones o participaciones.

TERCERO.- El metodo y procedimiento de valoracion que se seguira sera el siguiente: {{metodo_valoracion}}.

CUARTO.- Se faculta a las personas designadas en el expediente para ejecutar las actuaciones necesarias, incluida la formalizacion documental, inscripcion o comunicacion que proceda segun el caso.

QUINTO.- La eficacia del acuerdo queda sujeta a la verificacion de la causa, los plazos de ejercicio, la legitimacion del socio y las cautelas de valoracion y reembolso aplicables.$capa1_SEPARACION_SOCIO$,
      $capa2_SEPARACION_SOCIO$[
        {"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},
        {"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"},
        {"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}
      ]$capa2_SEPARACION_SOCIO$::jsonb,
      $capa3_SEPARACION_SOCIO$[
        {"campo":"socio_afectado_nombre","obligatoriedad":"OBLIGATORIO","descripcion":"Nombre completo o denominacion del socio que ejercita la separacion.","tipo":"text","label":"Socio separado"},
        {"campo":"causa_separacion","obligatoriedad":"OBLIGATORIO","descripcion":"Causa legal o estatutaria alegada para la separacion.","tipo":"textarea","label":"Causa de separacion"},
        {"campo":"metodo_valoracion","obligatoriedad":"OBLIGATORIO","descripcion":"Metodo y procedimiento de valoracion y reembolso.","tipo":"textarea","label":"Metodo de valoracion"}
      ]$capa3_SEPARACION_SOCIO$::jsonb,
      'La identidad del socio se mueve a Capa 3 porque el resolver no identifica automaticamente al socio separado por expediente. Verificar plazos y causa antes de activar.'
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
  'MODELO_ACUERDO',
  materia,
  materia,
  'ES',
  '0.1.0',
  'BORRADOR',
  'JUNTA_GENERAL',
  'MEETING',
  titulo,
  '[]'::jsonb,
  '{
    "secciones_inmutables": ["CAPA1_DISPOSITIVA"],
    "capa1_inmutable": true,
    "capa2_auto": true,
    "capa3_editable": true,
    "normalizacion": "2026-05-17"
  }'::jsonb,
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
