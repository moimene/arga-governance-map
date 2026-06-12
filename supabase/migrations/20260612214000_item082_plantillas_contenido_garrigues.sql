-- ITEM-082 — Contenido jurídico de 16 plantillas BORRADOR (Garrigues/Comité Legal OK).
-- Redactado por workflow ultracode conforme a LSC; promovidas a ACTIVA. Forward-only,
-- idempotente (solo afecta filas BORRADOR de la materia). capa2 con fuentes dotted-path
-- coherentes con normalizeFuente del resolver; capa3 editables por el secretario.

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La Junta General de {{denominacion_social}}, en su condición de sociedad de tipo {{tipo_social}}, reunida el {{fecha_junta}} bajo el órgano {{organo_nombre}}, acuerda autorizar la adquisición derivativa de acciones o participaciones propias, directa o indirectamente a través de sociedades dependientes, al amparo de los artículos 140, 144 y 146 de la Ley de Sociedades de Capital y dentro de los límites legales, estatutarios y, en su caso, de mercado que resulten aplicables.

SEGUNDO.- La autorización queda limitada a un número de títulos que no exceda del {{max_porcentaje_capital}} por ciento del capital social, se ejercerá dentro del rango de precio {{rango_precio}} y tendrá una vigencia máxima de {{vigencia_meses}} meses contados desde la fecha de adopción del presente acuerdo. Cuando la sociedad tenga la condición de cotizada, la adquisición respetará además los límites de autocartera y la normativa de abuso de mercado y de transparencia que resulten exigibles.

TERCERO.- La adquisición tendrá como finalidad {{finalidad_operacion}}, sin que el valor nominal de las acciones o participaciones propias y de las de la sociedad dominante adquiridas pueda producir el efecto de que el patrimonio neto resulte inferior al importe del capital social más las reservas legal o estatutariamente indisponibles, conforme al artículo 146 de la Ley de Sociedades de Capital.

CUARTO.- Las acciones o participaciones propias adquiridas quedarán sujetas al régimen del artículo 148 de la Ley de Sociedades de Capital, con suspensión del ejercicio del derecho de voto y demás derechos políticos inherentes a las mismas mientras permanezcan en poder de la sociedad, y con dotación, en su caso, de la reserva indisponible exigible.

QUINTO.- Se faculta al órgano de administración, con expresas facultades de sustitución, para ejecutar la presente autorización, fijando el momento, las condiciones y los medios de cada adquisición, así como para enajenar, amortizar o conservar los títulos adquiridos cuando proceda, respetando en todo caso las restricciones legales, financieras, sectoriales y de gobierno corporativo aplicables.

SEXTO.- Se faculta al órgano de administración y a las personas designadas en el expediente para formalizar el presente acuerdo y para realizar cuantas comunicaciones, inscripciones, depósitos o publicaciones resulten procedentes según la naturaleza de la operación y la condición de la sociedad.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}, {"fuente": "entities.entity_type_detail", "variable": "tipo_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "number", "campo": "max_porcentaje_capital", "label": "Porcentaje máximo sobre el capital social", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "text", "campo": "rango_precio", "label": "Rango de precio (mínimo y máximo o fórmula de determinación)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "number", "campo": "vigencia_meses", "label": "Vigencia de la autorización (meses)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "finalidad_operacion", "label": "Finalidad societaria o de mercado de la adquisición", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 140, 144, 145, 146 y 148 LSC (régimen de adquisición derivativa y de las acciones/participaciones propias); para sociedades cotizadas, límites de autocartera y normativa de mercado aplicable (LMV/MAR)',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'ADQUISICION_PROPIA';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La Junta General de {{denominacion_social}}, reunida el {{fecha_junta}} bajo el órgano {{organo_nombre}}, acuerda, como modificación de los Estatutos Sociales, ampliar el objeto social, de modo que el artículo estatutario relativo al objeto social quede redactado en los siguientes términos: {{nueva_redaccion_objeto}}.

SEGUNDO.- Se deja constancia de que se ha cumplido el derecho de información de los socios o accionistas previsto en el artículo 287 de la Ley de Sociedades de Capital, habiendo estado a su disposición el texto íntegro de la modificación propuesta y, en su caso, el informe justificativo, en los términos exigidos por la Ley y por los Estatutos Sociales.

TERCERO.- El presente acuerdo se adopta con la mayoría reforzada legalmente exigible para la modificación de estatutos según el tipo social de la entidad, así como con las mayorías estatutarias y, en su caso, pactadas que resulten aplicables, quedando su verificación incorporada al expediente.

CUARTO.- Se faculta al órgano de administración y a las personas designadas en el expediente, con facultades de sustitución, para elevar a público el presente acuerdo, gestionar su inscripción en el Registro Mercantil y realizar las publicaciones, comunicaciones o subsanaciones que resulten procedentes hasta su completa inscripción.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "textarea", "campo": "nueva_redaccion_objeto", "label": "Nueva redacción íntegra del artículo estatutario de objeto social", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 285, 286, 287 y 290 LSC (modificación de estatutos sociales); mayoría reforzada exigible: art. 201.2 LSC para la SA y art. 199.a) LSC para la SL',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'AMPLIACION_OBJETO_SOCIAL';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La Junta General de {{denominacion_social}}, reunida el {{fecha_junta}} bajo el órgano {{organo_nombre}}, acuerda, como modificación de los Estatutos Sociales, cambiar la denominación social, de modo que la sociedad pasará a denominarse {{nueva_denominacion}}, quedando el artículo estatutario relativo a la denominación redactado en consecuencia y surtiendo efecto conforme a la normativa aplicable.

SEGUNDO.- Se deja constancia de que obra en el expediente la certificación negativa de denominación, o el documento acreditativo de la reserva o disponibilidad de la nueva denominación, expedido por el Registro Mercantil Central, y de que se ha cumplido el derecho de información del artículo 287 de la Ley de Sociedades de Capital.

TERCERO.- La nueva denominación sustituirá a la anterior en cuantos documentos, libros, registros, comunicaciones y relaciones jurídicas de la sociedad sea necesario actualizar, sin que el cambio afecte a la personalidad jurídica ni a la continuidad de la sociedad.

CUARTO.- El presente acuerdo se adopta con la mayoría reforzada legalmente exigible para la modificación de estatutos según el tipo social, así como con las mayorías estatutarias y, en su caso, pactadas que resulten aplicables, quedando su verificación incorporada al expediente.

QUINTO.- Se faculta al órgano de administración y a las personas designadas en el expediente, con facultades de sustitución, para elevar a público el presente acuerdo, gestionar su inscripción en el Registro Mercantil y realizar las publicaciones, comunicaciones o subsanaciones que resulten procedentes hasta su completa inscripción.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "text", "campo": "nueva_denominacion", "label": "Nueva denominación social aprobada", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 285, 287 y 290 LSC (modificación de estatutos); normativa registral sobre denominación social (RRM y reglamentación del Registro Mercantil Central); mayoría reforzada art. 201.2 LSC (SA) y art. 199.a) LSC (SL)',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'CAMBIO_DENOMINACION_SOCIAL';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- El órgano competente {{organo_nombre}} de {{denominacion_social}}, reunido el {{fecha_junta}}, acuerda, como modificación de los Estatutos Sociales, trasladar el domicilio social, que pasará a estar situado en {{nuevo_domicilio_completo}}, quedando el artículo estatutario relativo al domicilio redactado en consecuencia.

SEGUNDO.- Se deja constancia de la competencia del órgano que adopta el acuerdo, conforme al artículo 285.2 de la Ley de Sociedades de Capital, que atribuye al órgano de administración el traslado del domicilio dentro del territorio nacional salvo disposición estatutaria en contrario, correspondiendo en los demás supuestos la decisión a la Junta General, así como del cumplimiento del derecho de información del artículo 287 de la Ley de Sociedades de Capital cuando resuelva la Junta.

TERCERO.- La nueva redacción estatutaria surtirá efecto conforme a la normativa aplicable y se incorporará a los libros, registros internos, comunicaciones y documentos societarios que proceda actualizar, sin que el traslado afecte a la personalidad jurídica ni a la continuidad de la sociedad.

CUARTO.- Cuando el acuerdo sea adoptado por la Junta General, se entenderá adoptado con la mayoría reforzada legalmente exigible para la modificación de estatutos según el tipo social, así como con las mayorías estatutarias y, en su caso, pactadas que resulten aplicables, quedando su verificación incorporada al expediente.

QUINTO.- Se faculta al órgano de administración y a las personas designadas en el expediente, con facultades de sustitución, para elevar a público el presente acuerdo, gestionar su inscripción en el Registro Mercantil y realizar las publicaciones, comunicaciones o subsanaciones que resulten procedentes hasta su completa inscripción.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "textarea", "campo": "nuevo_domicilio_completo", "label": "Nuevo domicilio social (dirección completa)", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 285, 287 y 290 LSC; art. 285.2 LSC (competencia del órgano de administración para el traslado dentro del territorio nacional salvo disposición estatutaria en contra); mayoría reforzada art. 201.2 LSC (SA) y art. 199.a) LSC (SL) cuando resuelve la junta',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'CAMBIO_DOMICILIO_SOCIAL';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La Junta General de {{denominacion_social}}, reunida el {{fecha_junta}} con la valida constitucion del organo {{organo_nombre}}, acuerda, al amparo del articulo 297 de la Ley de Sociedades de Capital, delegar en el organo de administracion la facultad de aumentar el capital social bajo la modalidad y en los terminos que se expresan en los apartados siguientes.

SEGUNDO.- Modalidad de la delegacion. La delegacion se efectua bajo la modalidad de {{modalidad_delegacion}}. Si la modalidad es la prevista en el articulo 297.1.a) de la Ley de Sociedades de Capital, la delegacion se limita a senalar la fecha en que el aumento ya acordado por esta Junta deba llevarse a efecto en la cifra acordada y a fijar las condiciones del mismo en todo lo no previsto por la propia Junta, dentro del plazo maximo de un ano. Si la modalidad es la prevista en el articulo 297.1.b) de la Ley de Sociedades de Capital (capital autorizado), la delegacion habilita al organo de administracion para acordar, en una o varias veces, el aumento del capital social hasta el limite maximo de {{importe_maximo_delegado}} euros, que no excedera de la mitad del capital social en el momento de la presente autorizacion, y dentro del plazo maximo de {{plazo_delegacion_meses}} meses, sin que pueda exceder de cinco anos a contar desde la fecha de adopcion de este acuerdo.

TERCERO.- Contenido de la facultad delegada. La delegacion comprende la facultad de fijar la cuantia de cada aumento dentro del limite autorizado, el momento de su ejecucion, el contravalor, el procedimiento y los plazos de desembolso, la clase, serie y caracteristicas de las acciones o participaciones a emitir, la prevision de suscripcion incompleta conforme al articulo 311 de la Ley de Sociedades de Capital y la consiguiente nueva redaccion del articulo estatutario relativo a la cifra del capital social.

CUARTO.- Derecho de suscripcion preferente. {{exclusion_preferente}}. La eventual exclusion total o parcial del derecho de suscripcion preferente solo sera eficaz si, conforme a los articulos 308 y, en su caso, 504 a 506 de la Ley de Sociedades de Capital, se cumplen los requisitos de justificacion del interes social, emision de los informes preceptivos del organo de administracion y del auditor o experto independiente y correspondencia entre el valor de las acciones o participaciones y su valor razonable; en otro caso, dicha exclusion no se entendera comprendida en esta delegacion.

QUINTO.- Se hace constar que el presente acuerdo se adopta con la mayoria reforzada exigida por los articulos 296 y 201 de la Ley de Sociedades de Capital para los aumentos de capital y sus delegaciones, cuya verificacion queda incorporada al expediente.

SEXTO.- Se faculta al organo de administracion y a las personas designadas en el expediente para ejecutar la delegacion, otorgar cuantos documentos publicos y privados sean necesarios, elevar a publico e inscribir en el Registro Mercantil los acuerdos de aumento que se adopten al amparo de la presente autorizacion y subsanar, aclarar o completar el acuerdo cuando proceda.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "select", "campo": "modalidad_delegacion", "label": "Modalidad de la delegacion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "number", "campo": "importe_maximo_delegado", "label": "Importe maximo del capital autorizado (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "number", "campo": "plazo_delegacion_meses", "label": "Plazo de vigencia de la delegacion (meses, max. 60)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "exclusion_preferente", "label": "Tratamiento del derecho de suscripcion preferente", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 297, 296, 201, 308, 504 y 506 LSC; concordantes sobre aumento de capital y derecho de suscripcion preferente',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'DELEGACION_CAPITAL';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La Junta General de {{denominacion_social}}, reunida el {{fecha_junta}} con la valida constitucion del organo {{organo_nombre}}, acuerda, conforme al articulo 406 de la Ley de Sociedades de Capital, aprobar la emision de obligaciones, bonos u otros valores convertibles o canjeables en acciones por un importe nominal maximo de {{importe_maximo_emision}} euros.

SEGUNDO.- Condiciones financieras. La emision tendra el plazo o vencimiento {{plazo_emision}}, devengara la remuneracion {{tipo_interes}} y se regira por las restantes condiciones financieras, de amortizacion y de garantia que consten en el expediente y en las condiciones de emision, sin perjuicio de la designacion del comisario y la constitucion del sindicato de obligacionistas cuando resulte exigible.

TERCERO.- Bases y modalidades de conversion. De conformidad con el articulo 414 de la Ley de Sociedades de Capital, se aprueban las bases y modalidades de conversion siguientes: {{bases_conversion}}. A tal efecto, los administradores han emitido el informe que explica dichas bases y modalidades, que ha sido objeto del informe de experto independiente designado por el Registro Mercantil exigido por el articulo 414.2 de la Ley de Sociedades de Capital, ambos incorporados al expediente.

CUARTO.- Aumento de capital. Se acuerda, en unidad de acto, aumentar el capital social en la cuantia necesaria para atender las solicitudes de conversion, conforme al articulo 414.1, parrafo segundo, y al articulo 415 de la Ley de Sociedades de Capital, quedando facultado el organo de administracion para ejecutar dicho aumento en la cuantia que en cada momento corresponda a las conversiones efectivamente solicitadas y para dar nueva redaccion al articulo estatutario del capital social. No podran emitirse valores convertibles por una cifra inferior a su valor nominal ni convertirse obligaciones en acciones cuando el valor nominal de aquellas sea inferior al de estas.

QUINTO.- Derecho de suscripcion preferente. Los socios tendran derecho de suscripcion preferente sobre los valores convertibles emitidos en los terminos del articulo 416 de la Ley de Sociedades de Capital. {{exclusion_preferente}}. La eventual supresion del derecho de suscripcion preferente solo sera eficaz si se cumplen los requisitos de justificacion del interes social e informes exigibles y, tratandose de sociedad cotizada, la normativa de mercado de valores aplicable.

SEXTO.- Se faculta al organo de administracion para completar y desarrollar las condiciones de la emision dentro de las bases aprobadas, fijar las fechas y ventanas de conversion, realizar los ajustes antidilucion, otorgar la escritura de emision e inscribirla en el Registro Mercantil y realizar cuantas comunicaciones, inscripciones y publicaciones procedan.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "number", "campo": "importe_maximo_emision", "label": "Importe nominal maximo de la emision (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "text", "campo": "plazo_emision", "label": "Plazo, vencimiento o calendario de amortizacion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "text", "campo": "tipo_interes", "label": "Tipo de interes o formula de remuneracion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "bases_conversion", "label": "Bases y modalidades de conversion (relacion de canje, ventanas, ajustes)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "exclusion_preferente", "label": "Tratamiento del derecho de suscripcion preferente", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 401 a 418 LSC, en especial arts. 406, 414, 415 y 416 LSC; concordantes sobre derecho de suscripcion preferente y aumento de capital',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'EMISION_DEUDA_CONVERTIBLE';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La Junta General de {{denominacion_social}}, reunida el {{fecha_junta}} con la valida constitucion del organo {{organo_nombre}}, acuerda, conforme a los articulos 285 y siguientes de la Ley de Sociedades de Capital, modificar el articulo de los Estatutos Sociales relativo a la duracion de la sociedad, prorrogando su vigencia, que pasara a ser {{nueva_duracion}} con efectos desde la inscripcion del acuerdo en el Registro Mercantil.

SEGUNDO.- El articulo estatutario relativo a la duracion quedara redactado en los siguientes terminos literales: {{nueva_redaccion_articulo}}.

TERCERO.- Se deja constancia de que, tratandose de una sociedad de duracion determinada, el presente acuerdo de prorroga se adopta con anterioridad a la expiracion del plazo estatutario de duracion, a fin de evitar la disolucion de pleno derecho, y de que el texto integro de la modificacion propuesta ha estado a disposicion de los socios o accionistas en cumplimiento del derecho de informacion previsto en el articulo 287 de la Ley de Sociedades de Capital.

CUARTO.- Se hace constar que el acuerdo se ha adoptado con la mayoria reforzada exigible para la modificacion de estatutos conforme a los articulos 194 y 201 de la Ley de Sociedades de Capital, para las sociedades anonimas, o al articulo 199 de la misma Ley, para las sociedades de responsabilidad limitada, asi como, en su caso, con las mayorias estatutarias o pactadas que resulten aplicables, cuya verificacion queda incorporada al expediente.

QUINTO.- Se faculta al organo de administracion y a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion en el Registro Mercantil y realizar las publicaciones y comunicaciones que procedan.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "text", "campo": "nueva_duracion", "label": "Nueva duracion estatutaria (indefinida o fecha/plazo concreto)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "nueva_redaccion_articulo", "label": "Texto integro del nuevo articulo estatutario de duracion", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 285, 286, 287, 290 LSC; arts. 194 y 201 LSC (SA) o art. 199 LSC (SL); concordantes sobre duracion de la sociedad',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'PRORROGA_SOCIEDAD';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_junta}} y validamente constituido como {{organo_nombre}}, en ejercicio de las facultades de gestion y direccion que le atribuyen los articulos 209 y 225 de la Ley de Sociedades de Capital, aprueba el presupuesto anual correspondiente al ejercicio {{ejercicio_presupuestario}}, que comprende las previsiones de ingresos, gastos, inversiones y financiacion conforme al documento incorporado al expediente: {{presupuesto_resumen}}.

SEGUNDO.- El presupuesto aprobado contempla ingresos previstos por importe de {{total_ingresos}} euros y gastos previstos por importe de {{total_gastos}} euros, asi como, en su caso, inversiones previstas por importe de {{total_inversiones}} euros, segun el desglose por partidas que figura en la documentacion de soporte.

TERCERO.- Se autoriza a {{directivo_ejecutor}} para la ejecucion ordinaria del presupuesto aprobado y para acordar reasignaciones o desviaciones entre partidas dentro del umbral de {{umbral_reformulacion}}, debiendo informar al Consejo de Administracion, en su siguiente sesion, de cualquier desviacion significativa que supere dicho umbral o que afecte a operaciones reservadas a la competencia del Consejo.

CUARTO.- Se deja constancia de que el presente acuerdo constituye una decision de gestion interna del organo de administracion, no sujeta a elevacion a publico ni a inscripcion registral, sin perjuicio de que las operaciones concretas que de su ejecucion se deriven y que excedan de la gestion ordinaria, afecten a activos esenciales en los terminos del articulo 160.f de la Ley de Sociedades de Capital, o esten reservadas legal o estatutariamente, se sometan al organo competente.

QUINTO.- Se faculta al Secretario del Consejo de Administracion para expedir las certificaciones que procedan y para realizar las comunicaciones internas necesarias para la implementacion y seguimiento del presupuesto aprobado.',
       capa2_variables = '[{"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "text", "campo": "ejercicio_presupuestario", "label": "Ejercicio presupuestario", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "presupuesto_resumen", "label": "Resumen del presupuesto aprobado", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "number", "campo": "total_ingresos", "label": "Total ingresos previstos (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "number", "campo": "total_gastos", "label": "Total gastos previstos (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "number", "campo": "total_inversiones", "label": "Total inversiones previstas (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "text", "campo": "directivo_ejecutor", "label": "Directivo o cargo autorizado para la ejecucion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "text", "campo": "umbral_reformulacion", "label": "Umbral de desviacion/ajuste sin nueva aprobacion", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Regimen general del organo de administracion: arts. 209, 225, 249 bis y 529 ter LSC; acuerdo de gestion no inscribible ni estatutario',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'APROBACION_PRESUPUESTOS';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La {{organo_nombre}} de {{denominacion_social}}, reunida en sesion celebrada el {{fecha_junta}} con los requisitos de convocatoria, quorum y mayoria legalmente exigibles, ACUERDA aprobar la modificacion estructural consistente en {{tipo_fusion}}, en virtud de la cual {{denominacion_social}} y las sociedades participantes identificadas como {{sociedades_participantes}} se integran en una sola, con extincion de las sociedades absorbidas o fusionadas y transmision en bloque de sus patrimonios por sucesion universal, todo ello conforme al Real Decreto-ley 5/2023, de 28 de junio.
SEGUNDO.- Se aprueba en sus propios terminos el proyecto comun de fusion redactado y suscrito por los organos de administracion de las sociedades intervinientes, depositado y debidamente publicitado, que se incorpora al expediente, incluida la relacion de canje de las acciones o participaciones y, en su caso, la compensacion dineraria complementaria conforme a {{relacion_canje}}, asi como el tipo y procedimiento de canje.
TERCERO.- Se aprueba como balance de fusion el cerrado a {{fecha_balance_fusion}}, verificado en los terminos legalmente exigibles, y se hacen constar los informes de los administradores sobre el proyecto comun y, cuando resulte preceptivo por no concurrir las excepciones legales, el informe de experto independiente designado por el Registro Mercantil sobre el proyecto y el patrimonio aportado.
CUARTO.- Se reconoce el derecho de oposicion de los acreedores cuyos creditos hubieran nacido antes de la fecha de publicacion del proyecto y no estuvieran vencidos, en los terminos y plazo del Real Decreto-ley 5/2023, asi como, en su caso, los derechos de informacion y participacion de los trabajadores y los demas derechos de socios e interesados, debiendo el expediente acreditar las publicaciones, comunicaciones y, en su caso, la garantia o satisfaccion de los creditos.
QUINTO.- Se faculta solidariamente a las personas designadas en el expediente para suscribir, otorgar y, en su caso, elevar a publico la escritura de fusion, solicitar su inscripcion en el Registro Mercantil, subsanar y completar el acuerdo y realizar cuantas publicaciones, comunicaciones y actuaciones complementarias resulten necesarias hasta su plena ejecucion e inscripcion.
SEXTO.- La eficacia del presente acuerdo y de la fusion queda condicionada al transcurso del plazo de oposicion de acreedores sin que se haya ejercitado o con satisfaccion o garantia de los mismos, a la obtencion de las autorizaciones administrativas o sectoriales exigibles y, cuando proceda por tratarse de sociedad cotizada o de subtipo especial, al cumplimiento de las especialidades y formalidades adicionales aplicables.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "select", "campo": "tipo_fusion", "label": "Tipo de fusion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "sociedades_participantes", "label": "Sociedades participantes", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "relacion_canje", "label": "Relacion de canje y compensacion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "date", "campo": "fecha_balance_fusion", "label": "Fecha del balance de fusion", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'RDL 5/2023, de 28 de junio (modificaciones estructurales): arts. 4 (proyecto común), 5-7 (informes de administradores y de experto independiente), 8-10 (balance de fusión y publicidad), 13-15 (derecho de oposición de acreedores), 39-44 (fusión por absorción y de nueva creación); arts. 25 y 194 LSC (competencia de la junta y mayoría reforzada); para sociedad cotizada, especialidades de la disposición adicional aplicable.',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'FUSION';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La {{organo_nombre}} de {{denominacion_social}}, reunida en sesion celebrada el {{fecha_junta}} con los requisitos de convocatoria, quorum y mayoria legalmente exigibles, ACUERDA aprobar la modificacion estructural consistente en {{tipo_escision}}, con la consiguiente transmision en bloque por sucesion universal de la parte o partes del patrimonio social afectadas a favor de las sociedades beneficiarias identificadas como {{sociedades_beneficiarias}}, conforme al Real Decreto-ley 5/2023, de 28 de junio.
SEGUNDO.- Se aprueba en sus propios terminos el proyecto comun de escision redactado y suscrito por el organo de administracion, depositado y publicitado conforme a la Ley, que se incorpora al expediente, con designacion y descripcion de los elementos del activo y del pasivo que se transmiten a cada sociedad beneficiaria, el reparto entre los socios de las acciones o participaciones que les correspondan y los criterios de atribucion, asi como la relacion de canje y, en su caso, la compensacion dineraria complementaria conforme a {{relacion_canje}}.
TERCERO.- Se aprueba como balance de escision el cerrado a {{fecha_balance_escision}}, y se hacen constar los informes de los administradores sobre el proyecto comun y, cuando resulte preceptivo por no concurrir las excepciones legales, el informe de experto independiente designado por el Registro Mercantil sobre el proyecto y sobre el patrimonio segregado o escindido.
CUARTO.- Se reconoce el derecho de oposicion de los acreedores en los terminos y plazo del Real Decreto-ley 5/2023, con la responsabilidad solidaria de las sociedades beneficiarias por las obligaciones asumidas que resulte legalmente aplicable, asi como, en su caso, los derechos de informacion y participacion de los trabajadores, debiendo el expediente acreditar las publicaciones, comunicaciones y, en su caso, la garantia o satisfaccion de los creditos.
QUINTO.- Se faculta solidariamente a las personas designadas en el expediente para suscribir, otorgar y elevar a publico la escritura de escision, solicitar su inscripcion en el Registro Mercantil, subsanar y completar el acuerdo y realizar cuantas publicaciones, comunicaciones y actuaciones complementarias resulten necesarias hasta su plena ejecucion e inscripcion.
SEXTO.- La eficacia del presente acuerdo queda condicionada al transcurso del plazo de oposicion de acreedores sin ejercicio o con su satisfaccion o garantia, a la obtencion de las autorizaciones administrativas o sectoriales exigibles y, cuando proceda por tratarse de sociedad cotizada o del subtipo de escision seleccionado, al cumplimiento de las especialidades, informes y formalidades adicionales aplicables.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "select", "campo": "tipo_escision", "label": "Tipo de escision", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "sociedades_beneficiarias", "label": "Sociedades beneficiarias", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "relacion_canje", "label": "Relacion de canje y compensacion", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "date", "campo": "fecha_balance_escision", "label": "Fecha del balance de escision", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'RDL 5/2023, de 28 de junio (modificaciones estructurales): arts. 4-10 (proyecto comun, informes de administradores y de experto, balance y publicidad) y 13-15 (oposicion de acreedores), por remision del regimen de escision (escision total, parcial y segregacion) con transmision en bloque por sucesion universal; arts. 25 y 194 LSC.',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'ESCISION';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'PRIMERO.- La {{organo_nombre}} de {{denominacion_social}}, hallandose la sociedad en periodo de liquidacion abierto por la disolucion previamente acordada, y conforme a los arts. 360 a 400 de la Ley de Sociedades de Capital, ACUERDA nombrar liquidador o liquidadores a {{identidad_liquidadores}}, en quienes recaen las funciones de administracion y representacion de la sociedad desde la aceptacion del cargo, cesando en consecuencia los anteriores administradores conforme al art. 368 LSC.
SEGUNDO.- Los liquidadores procederan, en el plazo legal, a formular junto con los administradores cesantes el inventario y el balance de la sociedad referidos al dia en que se hubiera abierto la liquidacion, y velaran por la integridad del patrimonio social en interes de la sociedad, los socios y los acreedores, ajustando su actuacion a las siguientes reglas: {{reglas_liquidacion}}.
TERCERO.- Corresponde a los liquidadores concluir las operaciones pendientes y realizar las nuevas que sean necesarias para la liquidacion, percibir los creditos y realizar el activo, pagar las deudas sociales, enajenar los bienes sociales y llevar la contabilidad y los libros de la sociedad, asi como satisfacer a los acreedores con caracter previo a cualquier reparto entre los socios.
CUARTO.- Concluidas las operaciones de liquidacion, los liquidadores someteran a la aprobacion del organo competente un balance final, un informe completo sobre dichas operaciones y un proyecto de division entre los socios del activo resultante, distribuyendose la cuota de liquidacion en proporcion a la participacion de cada socio en el capital social, salvo disposicion estatutaria o pacto en contrario legalmente admisible, y sin reparto del haber hasta la satisfaccion o consignacion de los creditos.
QUINTO.- Se faculta a los liquidadores y a las personas designadas en el expediente para otorgar los documentos publicos o privados necesarios, solicitar las inscripciones del cese de administradores y del nombramiento de liquidadores y, en su momento, de la extincion de la sociedad, asi como realizar las comunicaciones, publicaciones y actuaciones complementarias que procedan hasta la cancelacion de los asientos registrales.',
       capa2_variables = '[{"fuente": "governing_bodies.name", "variable": "organo_nombre", "condicion": "SIEMPRE"}, {"fuente": "meetings.date", "variable": "fecha_junta", "condicion": "SIEMPRE"}, {"fuente": "entities.legal_name", "variable": "denominacion_social", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "textarea", "campo": "identidad_liquidadores", "label": "Identidad de los liquidadores", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "textarea", "campo": "reglas_liquidacion", "label": "Reglas de liquidacion", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 360 a 400 LSC, en particular art. 368 (apertura del periodo de liquidacion y cese de administradores), arts. 374-375 (nombramiento, numero y facultades de los liquidadores), arts. 383-390 (operaciones de liquidacion, inventario, balance inicial y final, division del haber social) y arts. 391-394 (cuota de liquidacion y pago a los socios).',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'LIQUIDACION';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'ACUERDO DEL ÓRGANO DE ADMINISTRACIÓN DE {{nombre_entidad}} SOBRE FORMULACIÓN DE LAS CUENTAS ANUALES DEL EJERCICIO {{año_ejercicio}}

PRIMERO.- Formular las Cuentas Anuales de {{nombre_entidad}} correspondientes al ejercicio social cerrado el {{fecha_cierre_ejercicio}}, integradas por el Balance de Situación, la Cuenta de Pérdidas y Ganancias, el Estado de Cambios en el Patrimonio Neto, el Estado de Flujos de Efectivo y la Memoria, de conformidad con lo dispuesto en el artículo 253 de la Ley de Sociedades de Capital y en el Código de Comercio, dentro del plazo de tres meses contados desde el cierre del ejercicio social.

SEGUNDO.- Formular el Informe de Gestión correspondiente al ejercicio {{año_ejercicio}}, comprensivo del estado de información no financiera y demás contenidos legalmente exigibles, en los términos de los artículos 262 de la Ley de Sociedades de Capital y 49 del Código de Comercio.

TERCERO.- Aprobar la propuesta de aplicación del resultado del ejercicio, que asciende a {{resultado_ejercicio}} euros, conforme al siguiente detalle: {{propuesta_aplicacion_resultado}}, que se somete a la decisión de la Junta General de conformidad con el artículo 273 de la Ley de Sociedades de Capital.

CUARTO.- Hacer constar que las Cuentas Anuales y, en su caso, el Informe de Gestión han sido firmados por todos los administradores de la sociedad y, de no firmarlos alguno de ellos, se señalará la causa de la ausencia de firma, conforme al artículo 253.2 de la Ley de Sociedades de Capital.

QUINTO.- Acordar la puesta a disposición de las Cuentas Anuales formuladas y, en su caso, del Informe de Gestión a los efectos de su verificación por el auditor de cuentas {{nombre_auditor}}, así como su sometimiento a la aprobación de la Junta General Ordinaria que deberá celebrarse dentro de los seis primeros meses de cada ejercicio, conforme a los artículos 164 y 272 de la Ley de Sociedades de Capital.',
       capa2_variables = '[{"fuente": "secretario_manual", "variable": "nombre_entidad", "condicion": "SIEMPRE"}, {"fuente": "secretario_manual", "variable": "año_ejercicio", "condicion": "SIEMPRE"}, {"fuente": "secretario_manual", "variable": "fecha_cierre_ejercicio", "condicion": "SIEMPRE"}, {"fuente": "secretario_manual", "variable": "nombre_auditor", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "numero", "campo": "resultado_ejercicio", "label": "Resultado del ejercicio (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "propuesta_aplicacion_resultado", "label": "Propuesta de aplicación del resultado", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "fecha", "campo": "fecha_formulacion", "label": "Fecha de formulación por el órgano de administración", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "booleano", "campo": "todos_administradores_firman", "label": "¿Firman todos los administradores?", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "causa_ausencia_firma", "label": "Causa de la ausencia de firma (si procede)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "booleano", "campo": "incluye_informe_gestion", "label": "¿Se formula informe de gestión?", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 253, 254, 255, 262, 272 y 273 LSC; art. 34 y 44 CCom; art. 49 CCom (informe de gestión); art. 257 LSC (formulación abreviada)',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'FORMULACION_CUENTAS';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{nombre_entidad}} SOBRE CONTRATACIÓN RELEVANTE

PRIMERO.- Aprobar, en el ejercicio de las facultades de gestión y supervisión que corresponden al Consejo de Administración conforme a los artículos 209 y 249 bis de la Ley de Sociedades de Capital, la celebración del contrato de {{objeto_contratacion}} con {{contraparte}}, por un importe de {{importe_operacion}} euros y con una duración de {{plazo_contrato}}, en los términos y condiciones que constan en la documentación incorporada al expediente.

SEGUNDO.- Declarar que la operación se ha analizado con arreglo al interés social y, previo examen de su carácter, hacer constar que {{declaracion_activo_esencial}}, de modo que, de tratarse de la adquisición, enajenación o aportación a otra sociedad de un activo esencial en los términos del artículo 160 f) de la Ley de Sociedades de Capital —presumiéndose el carácter esencial cuando el importe de la operación supere el veinticinco por ciento del valor de los activos que figuren en el último balance aprobado—, su eficacia quedará condicionada a la previa aprobación por la Junta General.

TERCERO.- Hacer constar que, examinada la eventual existencia de situaciones de conflicto de interés, {{declaracion_conflicto_interes}}, habiéndose abstenido en la deliberación y votación, en su caso, los consejeros afectados conforme a los artículos 228 c) y 230 de la Ley de Sociedades de Capital, y, tratándose de operación con parte vinculada en sociedad cotizada, con observancia del régimen de los artículos 529 vicies y siguientes de la Ley de Sociedades de Capital.

CUARTO.- Facultar a {{cargo_apoderado}} para que, en nombre y representación de la sociedad, negocie, suscriba y ejecute cuantos documentos públicos o privados sean precisos para la formalización y plena eficacia de la operación aprobada, así como para subsanar y elevar a público el presente acuerdo cuando proceda.',
       capa2_variables = '[{"fuente": "secretario_manual", "variable": "nombre_entidad", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "texto_largo", "campo": "objeto_contratacion", "label": "Objeto del contrato o de la contratación relevante", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "contraparte", "label": "Contraparte del contrato", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "numero", "campo": "importe_operacion", "label": "Importe de la operación (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "plazo_contrato", "label": "Duración o plazo del contrato", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "declaracion_activo_esencial", "label": "Declaración sobre si la operación recae sobre un activo esencial (art. 160 f LSC)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "booleano", "campo": "requiere_aprobacion_junta", "label": "¿La operación debe escalarse a la Junta General por activo esencial?", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "declaracion_conflicto_interes", "label": "Declaración sobre conflictos de interés y abstenciones", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "cargo_apoderado", "label": "Cargo o persona facultada para la ejecución", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 209, 249 bis, 529 ter y 529 quaterdecies LSC; art. 160 f) LSC (activo esencial); arts. 228 a 230 LSC (deber de lealtad y abstención); arts. 529 vicies y ss. LSC (operaciones vinculadas, cotizada)',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'CONTRATACION_RELEVANTE';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{nombre_entidad}} SOBRE OPERACIÓN DE FINANCIACIÓN

PRIMERO.- Aprobar, en el ejercicio de la competencia de gestión que corresponde al Consejo de Administración conforme a los artículos 209 y 249 bis de la Ley de Sociedades de Capital, la concertación de una operación de financiación consistente en {{tipo_financiacion}} con {{entidad_financiadora}}, por un importe de principal de {{importe_financiacion}} euros, un plazo de amortización de {{plazo_amortizacion}} y un tipo de interés de {{tipo_interes}}.

SEGUNDO.- Aprobar la constitución de las garantías personales o reales que, en su caso, exija la operación, consistentes en {{garantias_constituidas}}, dejando constancia de que, cuando la garantía recaiga sobre un activo esencial de la sociedad en el sentido del artículo 160 f) de la Ley de Sociedades de Capital —presumiéndose esencial el activo cuyo importe supere el veinticinco por ciento del valor de los activos del último balance aprobado—, la operación quedará condicionada a la previa aprobación por la Junta General.

TERCERO.- Hacer constar que la operación se adopta en interés de la sociedad, previa evaluación de su impacto en la estructura financiera y de solvencia, y que, examinada la posible existencia de conflictos de interés, {{declaracion_conflicto_interes}}, con abstención de los consejeros afectados, en su caso, conforme a los artículos 228 y 230 de la Ley de Sociedades de Capital.

CUARTO.- Facultar a {{cargo_apoderado}}, con facultades de sustitución cuando proceda, para negociar, suscribir y ejecutar el contrato de financiación y sus accesorios, otorgar las garantías acordadas, comparecer ante notario y realizar cuantos actos sean necesarios para la plena eficacia de la operación aprobada.',
       capa2_variables = '[{"fuente": "secretario_manual", "variable": "nombre_entidad", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "texto", "campo": "tipo_financiacion", "label": "Tipo de operación de financiación (préstamo, crédito, emisión, etc.)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "entidad_financiadora", "label": "Entidad o entidades financiadoras", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "numero", "campo": "importe_financiacion", "label": "Importe del principal (euros)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "plazo_amortizacion", "label": "Plazo de amortización", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "tipo_interes", "label": "Tipo de interés aplicable", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "garantias_constituidas", "label": "Garantías personales o reales constituidas", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "booleano", "campo": "afecta_activo_esencial", "label": "¿La garantía u operación recae sobre un activo esencial (art. 160 f LSC)?", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "declaracion_conflicto_interes", "label": "Declaración sobre conflictos de interés y abstenciones", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "cargo_apoderado", "label": "Cargo o persona facultada para la ejecución", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 209, 249 bis y 529 ter LSC; art. 160 f) LSC (activo esencial); arts. 401 a 410 LSC (emisión de obligaciones, en su caso); arts. 228 a 230 LSC (conflicto de interés y abstención)',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'FINANCIACION';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'CONVOCATORIA DE REUNIÓN DE LA COMISIÓN EJECUTIVA / DELEGADA DE {{nombre_entidad}}

PRIMERO.- De conformidad con lo previsto en los artículos 249 y 249 bis de la Ley de Sociedades de Capital y en el Reglamento del Consejo de Administración, se convoca reunión de la {{nombre_comision}} de {{nombre_entidad}}, que se celebrará el día {{fecha_reunion}} a las {{hora_reunion}} horas, en {{lugar_reunion}}, en {{modalidad_reunion}}.

SEGUNDO.- La reunión se ajustará al siguiente Orden del Día: {{orden_del_dia}}.

TERCERO.- Se hace constar que la {{nombre_comision}} delibera y adopta sus acuerdos válidamente conforme al régimen de quórum y mayorías establecido en el Reglamento del Consejo, no pudiendo en ningún caso pronunciarse sobre las facultades legalmente indelegables del Consejo de Administración enumeradas en el artículo 249 bis y, tratándose de sociedad cotizada, en el artículo 529 ter de la Ley de Sociedades de Capital, que quedan reservadas al pleno del Consejo.

CUARTO.- Se pone a disposición de los miembros de la Comisión, con la antelación prevista en el Reglamento del Consejo, la documentación e información necesaria para la adecuada deliberación de los asuntos del Orden del Día, debiendo levantarse acta de la reunión que será firmada por quien la presida y por el Secretario, conforme al artículo 250 de la Ley de Sociedades de Capital.',
       capa2_variables = '[{"fuente": "secretario_manual", "variable": "nombre_entidad", "condicion": "SIEMPRE"}, {"fuente": "secretario_manual", "variable": "nombre_comision", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "fecha", "campo": "fecha_reunion", "label": "Fecha de la reunión de la comisión", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "hora_reunion", "label": "Hora de la reunión", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "lugar_reunion", "label": "Lugar de celebración", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto", "campo": "modalidad_reunion", "label": "Modalidad (presencial, telemática o mixta)", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "orden_del_dia", "label": "Orden del día de la reunión", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Arts. 245.1, 246, 247.2, 249 y 249 bis LSC; art. 529 ter LSC (cotizada); Reglamento del Consejo de Administración de {{nombre_entidad}}',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'CONVOCATORIA_COMISION_DELEGADA';

UPDATE public.plantillas_protegidas
   SET capa1_inmutable = 'ACUERDO DE TOMA DE RAZÓN Y CONSTANCIA DE PACTO PARASOCIAL RELATIVO A {{nombre_entidad}}

PRIMERO.- Tomar razón y dejar constancia de la existencia del pacto parasocial suscrito con fecha {{fecha_pacto}} entre {{partes_pacto}}, cuyo objeto es {{objeto_pacto}}, recibido por la sociedad a los solos efectos de su archivo y conocimiento por el órgano de administración.

SEGUNDO.- Hacer constar expresamente que, de conformidad con el artículo 29 de la Ley de Sociedades de Capital, los pactos que se mantengan reservados entre los socios no serán oponibles a la sociedad, por lo que la presente toma de razón no implica la asunción por la sociedad de obligación alguna derivada del pacto ni altera el régimen legal y estatutario de adopción de acuerdos sociales.

TERCERO.- Por tratarse {{nombre_entidad}} de sociedad anónima cotizada, acordar que se dé cumplimiento a las obligaciones de comunicación a la propia sociedad y a la Comisión Nacional del Mercado de Valores, de publicación como hecho relevante y de depósito en el Registro Mercantil del documento en que conste el pacto parasocial, en los términos y plazos de los artículos 530 a 535 de la Ley de Sociedades de Capital, sin cuyo cumplimiento el pacto no producirá efecto alguno en cuanto a las materias reguladas en dichos preceptos.

CUARTO.- Facultar al Secretario del órgano de administración para que custodie el documento, practique las comunicaciones, publicaciones y depósitos señalados y expida cuantas certificaciones sean precisas en relación con la presente toma de razón.',
       capa2_variables = '[{"fuente": "secretario_manual", "variable": "nombre_entidad", "condicion": "SIEMPRE"}]'::jsonb,
       capa3_editables = '[{"tipo": "fecha", "campo": "fecha_pacto", "label": "Fecha de suscripción del pacto parasocial", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "partes_pacto", "label": "Partes firmantes del pacto parasocial", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "texto_largo", "campo": "objeto_pacto", "label": "Objeto y materias reguladas por el pacto", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "booleano", "campo": "es_cotizada", "label": "¿La sociedad es cotizada (obliga al régimen de los arts. 530-535 LSC)?", "obligatoriedad": "OBLIGATORIO"}, {"tipo": "booleano", "campo": "documento_pacto_aportado", "label": "¿Se aporta copia del documento del pacto para archivo?", "obligatoriedad": "OBLIGATORIO"}]'::jsonb,
       referencia_legal = 'Art. 29 LSC (oponibilidad de pactos reservados); arts. 530 a 535 LSC (pactos parasociales en sociedad cotizada: comunicación, depósito y publicidad); art. 119 RRM',
       estado = 'ACTIVA',
       aprobada_por = 'Garrigues / Comité Legal',
       fecha_aprobacion = now()
 WHERE estado = 'BORRADOR'
   AND COALESCE(materia_acuerdo, materia) = 'PACTO_PARASOCIAL';

DO $$
DECLARE v_borr integer;
BEGIN
  SELECT count(*) INTO v_borr FROM public.plantillas_protegidas
   WHERE estado='BORRADOR' AND COALESCE(materia_acuerdo, materia) IN ('ADQUISICION_PROPIA','AMPLIACION_OBJETO_SOCIAL','CAMBIO_DENOMINACION_SOCIAL','CAMBIO_DOMICILIO_SOCIAL','DELEGACION_CAPITAL','EMISION_DEUDA_CONVERTIBLE','PRORROGA_SOCIEDAD','APROBACION_PRESUPUESTOS','FUSION','ESCISION','LIQUIDACION','FORMULACION_CUENTAS','CONTRATACION_RELEVANTE','FINANCIACION','CONVOCATORIA_COMISION_DELEGADA','PACTO_PARASOCIAL');
  RAISE NOTICE 'ITEM-082: plantillas BORRADOR restantes de las 16 materias = %', v_borr;
END $$;
