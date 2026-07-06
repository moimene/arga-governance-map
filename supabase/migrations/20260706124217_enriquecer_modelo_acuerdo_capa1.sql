-- Coherencia Secretaría fase 2 (2026-07-03): enriquecimiento de contenido legal
-- de los 14 MODELO_ACUERDO ACTIVA más pobres (capa1 < 850 chars) + binding de
-- materia para 4 plantillas ACTIVA huérfanas sin conflicto.
--
-- Reglas seguidas:
--  * Cada capa1 reutiliza EXCLUSIVAMENTE los placeholders ya existentes en la
--    plantilla (capa3_editables + contexto común), sin variables nuevas.
--  * Redacción LSC estándar con cita de artículos; disclaimer demo homogéneo
--    (mismo patrón que las plantillas ricas ya existentes).
--  * capa2/capa3 intactas; estado/versión intactos (contenido demo, precedente
--    H1c). Pendiente de revisión por el Comité Legal antes de uso productivo.
-- Diagnóstico: docs/superpowers/reviews/2026-07-03-coherencia-secretaria.md

-- 1. ACUERDO_CONVOCATORIA_JUNTA ------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE CONVOCATORIA DE JUNTA GENERAL

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada del órgano.

PRIMERO.- Convocatoria. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, acuerda, en ejercicio de la competencia que le atribuye el artículo 166 de la Ley de Sociedades de Capital, convocar Junta General de socios o accionistas.

SEGUNDO.- Fecha, lugar y modalidad. La Junta se celebrará el {{fecha_junta_convocada}}, a las {{hora_junta_convocada}}, en {{lugar_junta_convocada}}, bajo la modalidad {{modalidad_junta}}. Salvo disposición estatutaria en contrario, la Junta se celebrará en el término municipal del domicilio social (artículo 175 LSC). Si la modalidad incluye asistencia telemática, se garantizarán la identidad de los asistentes y los derechos de intervención y voto conforme al artículo 182 LSC.

TERCERO.- Orden del día. La Junta deliberará y resolverá sobre los asuntos comprendidos en el siguiente orden del día, redactado con la claridad exigida por el artículo 174 LSC: {{orden_dia}}.

CUARTO.- Forma y plazo de la convocatoria. Se ordena difundir la convocatoria por los canales legales, estatutarios y, en su caso, electrónicos aplicables al tipo social (artículo 173 LSC), respetando el plazo mínimo que corresponda: un mes en la sociedad anónima y quince días en la sociedad de responsabilidad limitada (artículo 176 LSC), y computando el plazo conforme a la fecha de publicación o de remisión del anuncio al último de los socios.

QUINTO.- Derecho de información y complemento. Desde la publicación de la convocatoria se pondrá a disposición de socios o accionistas la documentación exigible en función de los asuntos del orden del día, y se atenderán, cuando procedan, las solicitudes de complemento de convocatoria (artículo 172 LSC, sociedades anónimas) y de información (artículos 196 y 197 LSC).

SEXTO.- Ejecución. Se faculta al Presidente y al Secretario del Consejo, indistintamente, para completar los detalles no sustanciales de la convocatoria, firmarla, remitirla a los destinatarios, acreditar su difusión e incorporar la evidencia al expediente societario.$capa1$
WHERE id = 'd0beadd2-21e8-4f1d-ae23-eed1bd7c2ce9';

-- 2. APROBACION_PRESUPUESTO ----------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE APROBACIÓN DEL PRESUPUESTO ANUAL

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada del órgano.

PRIMERO.- Aprobación. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, aprueba el presupuesto anual correspondiente al ejercicio {{ejercicio_presupuestario}}, en el marco de su función general de gestión y supervisión (artículos 209 y 249 bis LSC) y, tratándose de sociedad cotizada, como facultad indelegable del Consejo conforme al artículo 529 ter.1.a) LSC.

SEGUNDO.- Contenido. El presupuesto aprobado comprende las previsiones de ingresos, gastos, inversiones y financiación, así como las principales hipótesis de gestión, conforme al resumen incorporado al expediente: {{presupuesto_resumen}}.

TERCERO.- Ejecución y límites. Se autoriza a {{directivo_ejecutor}} para ejecutar el presupuesto dentro de los límites aprobados, con sujeción a las políticas corporativas y al sistema de control interno de la Sociedad. Cualquier desviación superior a {{umbral_reformulacion}} deberá someterse nuevamente al Consejo con carácter previo a su ejecución.

CUARTO.- Seguimiento. La dirección financiera informará periódicamente al Consejo del grado de ejecución presupuestaria y de las desviaciones relevantes, sin perjuicio de las competencias de la comisión de auditoría cuando exista.

QUINTO.- Certificación. Se faculta al Secretario del Consejo para expedir certificaciones de este acuerdo y realizar las comunicaciones internas necesarias para la implementación del presupuesto.$capa1$
WHERE id = '3dde14f1-a6a1-4604-9026-d0083ee15dee';

-- 3. APROBACION_REGLAMENTO_CONSEJO ----------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} SOBRE EL REGLAMENTO DEL CONSEJO

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada del órgano.

PRIMERO.- Aprobación o modificación. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, acuerda aprobar la actuación consistente en {{tipo_actuacion_reglamento}} respecto del Reglamento del Consejo, conforme al texto incorporado al expediente bajo la referencia {{texto_reglamento_ref}}.

SEGUNDO.- Alcance de los cambios. El resumen de los cambios aprobados es el siguiente: {{resumen_cambios}}. El Reglamento respeta en todo caso la ley y los estatutos sociales, y regula la organización y funcionamiento internos del Consejo con arreglo a la jerarquía normativa aplicable (ley, estatutos, reglamento).

TERCERO.- Régimen de sociedad cotizada. Si la Sociedad tiene la condición de cotizada, el Reglamento del Consejo es preceptivo conforme al artículo 528 de la Ley de Sociedades de Capital; se ordena su comunicación a la Comisión Nacional del Mercado de Valores, su inscripción en el Registro Mercantil conforme al artículo 529 LSC y, una vez inscrito, su publicación por la CNMV, así como su difusión en la página web corporativa.

CUARTO.- Información a la Junta. Cuando resulte aplicable, se informará a la Junta General de la aprobación o modificación del Reglamento en la primera sesión que se celebre.

QUINTO.- Ejecución. Se faculta al Secretario del Consejo para expedir certificaciones, gestionar el depósito y las comunicaciones exigibles y actualizar la normativa interna de la Sociedad.$capa1$
WHERE id = '0eefc6df-1317-4e68-b87b-be2602479f8a';

-- 4. CONTRATOS_SOCIO_UNICO_SOCIEDAD ---------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$CONSTANCIA DE CONTRATO ENTRE EL SOCIO ÚNICO Y {{denominacion_social}} (ARTÍCULO 16 LSC)

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye a la documentación contractual formalizada.

PRIMERO.- Constancia. El socio único de {{denominacion_social}} deja constancia de la celebración, formalización o toma de razón del contrato entre el socio único y la Sociedad identificado como {{contrato_ref}}, conforme al régimen de las sociedades unipersonales de los artículos 12 y siguientes de la Ley de Sociedades de Capital.

SEGUNDO.- Objeto y condiciones. El contrato tiene por objeto {{objeto_contrato}}, con contraprestación o valor económico de {{valor_contrato}} y las siguientes condiciones principales: {{condiciones_principales}}. El contrato consta por escrito o en la forma documental exigida conforme a su naturaleza.

TERCERO.- Libro-registro y memoria. De conformidad con el artículo 16.1 LSC, el contrato se transcribirá al libro-registro de contratos entre el socio único y la Sociedad, que será legalizado conforme a lo dispuesto para los libros de actas, y se hará referencia expresa e individualizada al mismo en la memoria anual, con indicación de su naturaleza y condiciones.

CUARTO.- Advertencia de eficacia y responsabilidad. Se deja constancia de que, en caso de concurso del socio único o de la Sociedad, no serán oponibles a la masa los contratos que no hayan sido transcritos al libro-registro y no se hallen referenciados en la memoria o lo hayan sido en memoria no depositada con arreglo a la ley (artículo 16.2 LSC), y de que durante el plazo de dos años el socio único responderá de las ventajas que directa o indirectamente haya obtenido en perjuicio de la Sociedad (artículo 16.3 LSC).

QUINTO.- Ejecución. Se faculta a {{persona_ejecucion}} para formalizar, transcribir, custodiar y comunicar el contrato cuando proceda, e incorporar la evidencia documental al expediente.$capa1$
WHERE id = '64fd400f-0b35-4b4c-8078-80d4c41985da';

-- 5. CUENTAS_CONSOLIDADAS --------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE FORMULACIÓN DE CUENTAS ANUALES CONSOLIDADAS

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada del órgano.

PRIMERO.- Formulación. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, en su condición de sociedad dominante obligada a consolidar conforme a los artículos 42 y siguientes del Código de Comercio, acuerda formular las cuentas anuales consolidadas del grupo correspondientes al ejercicio {{ejercicio}}, dentro del plazo legal de tres meses desde el cierre del ejercicio (artículo 253 LSC en relación con el artículo 44 CCom).

SEGUNDO.- Contenido y perímetro. Las cuentas consolidadas comprenden el balance, la cuenta de pérdidas y ganancias, el estado de cambios en el patrimonio neto, el estado de flujos de efectivo y la memoria consolidados, formulados con claridad y reflejando la imagen fiel del patrimonio, de la situación financiera y de los resultados del conjunto consolidable. El perímetro de consolidación es el descrito en {{perimetro_consolidacion}}.

TERCERO.- Informe de gestión consolidado y auditoría. Se formula igualmente el informe de gestión consolidado y se acuerda remitir la documentación al auditor de cuentas del grupo {{auditor_grupo}} a efectos de la verificación exigida por el artículo 42.4 CCom.

CUARTO.- Sometimiento a la Junta. Las cuentas consolidadas se someterán a la aprobación de la Junta General de la sociedad dominante junto con las cuentas anuales individuales (artículo 42.5 CCom), y se procederá a su depósito conforme a la normativa registral aplicable.

QUINTO.- Firmas y certificación. Las cuentas serán firmadas por todos los administradores; si faltare la firma de alguno se señalará en los documentos con expresa indicación de la causa. Se faculta al Secretario del Consejo para certificar el acuerdo e incorporar la documentación al expediente digital.$capa1$
WHERE id = 'fb568f11-52a7-4dd2-82b6-141710a0b9aa';

-- 6. DIVIDENDO_A_CUENTA ----------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE DISTRIBUCIÓN DE DIVIDENDO A CUENTA

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada del órgano.

PRIMERO.- Distribución. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, acuerda distribuir un dividendo a cuenta de los resultados del ejercicio {{ejercicio}} por importe total de {{importe_dividendo}} euros, al amparo del artículo 277 de la Ley de Sociedades de Capital.

SEGUNDO.- Estado contable. Conforme al artículo 277.a) LSC, los administradores han formulado un estado contable, incorporado al expediente bajo la referencia {{estado_contable_ref}}, en el que se pone de manifiesto que existe liquidez suficiente para la distribución acordada; dicho estado se incluirá posteriormente en la memoria.

TERCERO.- Límite legal. La cantidad a distribuir no excede de los resultados obtenidos desde el fin del último ejercicio, deducidas las pérdidas procedentes de ejercicios anteriores, las cantidades con que deban dotarse las reservas obligatorias por ley o por disposición estatutaria y la estimación del impuesto a pagar sobre dichos resultados (artículo 277.b) LSC).

CUARTO.- Pago. El pago se realizará el {{fecha_pago}}, conforme al detalle de beneficiarios y reglas de reparto incorporados al expediente, practicándose las retenciones fiscales procedentes.

QUINTO.- Ejecución. Se faculta a {{persona_ejecucion}} para ejecutar el pago, practicar las retenciones, conservar el estado contable en el expediente y realizar las comunicaciones o depósitos que procedan.$capa1$
WHERE id = '66d771b9-29a1-4980-a6aa-bb2a8fd78901';

-- 7. EJECUCION_AUMENTO_DELEGADO --------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE EJECUCIÓN DE AUMENTO DE CAPITAL DELEGADO

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada ni a la escritura pública de ejecución.

PRIMERO.- Ejecución de la delegación. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, acuerda ejecutar la delegación conferida por la Junta General mediante el acuerdo identificado como {{acuerdo_junta_delegacion_ref}}, al amparo del artículo 297.1 de la Ley de Sociedades de Capital.

SEGUNDO.- Términos del aumento. El aumento de capital se ejecuta por importe nominal de {{importe_aumento}} euros, mediante la modalidad {{modalidad_aumento}}, con las condiciones de suscripción y desembolso siguientes: {{condiciones_suscripcion}}.

TERCERO.- Vigencia y límites de la delegación. Se deja constancia de que la delegación de la Junta se encuentra vigente e inscrita cuando procede, no está agotada por ejecuciones anteriores y respeta los límites del artículo 297.1.b) LSC cuando se trate de capital autorizado: importe máximo de la mitad del capital social en el momento de la autorización y plazo máximo de cinco años, con desembolso mediante aportaciones dinerarias.

CUARTO.- Derechos de los socios y nueva redacción estatutaria. La ejecución respeta el derecho de suscripción o asunción preferente en los términos legal y estatutariamente aplicables, y comprende la nueva redacción del artículo estatutario relativo al capital social una vez ejecutado y cerrado el aumento (artículo 313 LSC).

QUINTO.- Formalización e inscripción. Se faculta a las personas designadas para otorgar la escritura de ejecución del aumento, declarar su suscripción y desembolso, y gestionar su inscripción en el Registro Mercantil conforme a los artículos 313 a 316 LSC.$capa1$
WHERE id = 'd082aee7-e5b6-4a02-8ee4-d539730d84e6';

-- 8. EXCLUSION_SOCIO --------------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DE LA JUNTA GENERAL DE {{denominacion_social}} DE EXCLUSIÓN DE SOCIO

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada ni, en su caso, a la resolución judicial firme exigible.

PRIMERO.- Exclusión. La Junta General de {{denominacion_social}}, válidamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda la exclusión del socio {{socio_afectado_nombre}} por concurrir la causa {{causa_exclusion}}, conforme a los artículos 350 y 351 de la Ley de Sociedades de Capital y, en su caso, a las causas estatutarias de exclusión válidamente incorporadas con el consentimiento de todos los socios.

SEGUNDO.- Procedimiento y mayoría. El acuerdo se adopta con la mayoría reforzada y la constancia en acta exigidas por el artículo 352 LSC en relación con el artículo 199 LSC, dejando constancia de la identidad de los socios que han votado a favor. Se advierte de que, cuando la exclusión afecte a un socio con participación igual o superior al veinticinco por ciento del capital social, requerirá, además del acuerdo de la Junta, resolución judicial firme si el socio no se conforma con la exclusión acordada (artículo 352.2 y 352.3 LSC).

TERCERO.- Documentación de la causa. Se deja constancia de la documentación que acredita la causa de exclusión y de la observancia de las cautelas legales, estatutarias y pactadas aplicables, incluida la abstención del socio afectado en la votación conforme al artículo 190 LSC cuando proceda.

CUARTO.- Valoración y reembolso. Se reconoce el derecho del socio excluido a la valoración y reembolso de sus participaciones o acciones conforme a los artículos 353 a 359 LSC, mediante el procedimiento {{procedimiento_valoracion}}; a falta de acuerdo sobre el valor razonable, este será determinado por un experto independiente designado por el Registro Mercantil.

QUINTO.- Ejecución. Se faculta a las personas designadas para formalizar el acuerdo, otorgar en su caso la escritura de reducción de capital o adquisición de las participaciones afectadas, inscribir cuando proceda y ejecutar las actuaciones necesarias.$capa1$
WHERE id = '206eae8c-51d2-4ab6-b4d4-2183b6cab519';

-- 9. PODER_REPRESENTACION ----------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE OTORGAMIENTO DE PODER DE REPRESENTACIÓN

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye a la escritura pública de apoderamiento.

PRIMERO.- Otorgamiento. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, acuerda otorgar poder de representación a favor de {{apoderado_nombre}}, en el marco del poder de representación de la Sociedad que corresponde al órgano de administración conforme a los artículos 233 y 234 de la Ley de Sociedades de Capital.

SEGUNDO.- Facultades. El poder comprenderá las siguientes facultades: {{facultades_poder}}. El apoderamiento voluntario no constituye delegación orgánica de facultades del Consejo (artículo 249 LSC) ni comprende facultades que por ley o estatutos resulten indelegables.

TERCERO.- Límites internos. El ejercicio del poder queda sujeto a las siguientes restricciones internas: {{limitaciones_poder}}. Se advierte de que, frente a terceros de buena fe y sin culpa grave, la Sociedad quedará obligada incluso por actos comprendidos en el objeto social aunque excedan de las limitaciones internas (artículo 234 LSC), sin perjuicio de la responsabilidad interna del apoderado.

CUARTO.- Formalización e inscripción. Se acuerda elevar a público el poder ante Notario y, cuando se trate de apoderamiento general, inscribirlo en el Registro Mercantil conforme a los artículos 22 del Código de Comercio y 94 del Reglamento del Registro Mercantil.

QUINTO.- Ejecución. Se faculta a las personas designadas para otorgar la escritura, subsanar y ejecutar cuantos actos resulten necesarios para la plena eficacia del poder, así como para su revocación cuando lo acuerde el órgano competente.$capa1$
WHERE id = '60251fcd-9450-4812-8bbb-2946581d6d19';

-- 10. PRESTACIONES_ACCESORIAS --------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DE LA JUNTA GENERAL DE {{denominacion_social}} SOBRE PRESTACIONES ACCESORIAS

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada ni a la escritura de modificación estatutaria.

PRIMERO.- Actuación. La Junta General de {{denominacion_social}}, válidamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda {{tipo_actuacion}} las prestaciones accesorias reguladas en los Estatutos Sociales, conforme al régimen de los artículos 86 a 89 de la Ley de Sociedades de Capital.

SEGUNDO.- Contenido estatutario. La regulación estatutaria aprobada expresa el contenido concreto y determinado de la prestación, su carácter gratuito o retribuido y, en su caso, las cláusulas penales inherentes a su incumplimiento, así como la vinculación a la titularidad de participaciones o acciones concretas cuando proceda (artículos 86 y 87 LSC). La redacción aprobada es la siguiente: {{redaccion_prestacion_accesoria}}.

TERCERO.- Retribución. Si la prestación es retribuida, los estatutos determinan la compensación, que no podrá exceder en ningún caso del valor que corresponda a la prestación (artículo 87 LSC).

CUARTO.- Consentimiento individual. De conformidad con el artículo 89 LSC, la creación, la modificación y la extinción anticipada de la obligación de realizar prestaciones accesorias requieren el consentimiento individual de los obligados, que consta por escrito conforme a las referencias incorporadas al expediente: {{consentimientos_ref}}. Se deja igualmente constancia de que la transmisión voluntaria de participaciones o acciones con prestación accesoria vinculada queda sujeta a autorización de la Sociedad (artículo 88 LSC).

QUINTO.- Formalización. Tratándose de modificación estatutaria, el acuerdo se elevará a público y se inscribirá en el Registro Mercantil conforme a los artículos 285 y siguientes LSC. Se faculta a las personas designadas para su ejecución y las comunicaciones necesarias.$capa1$
WHERE id = 'd1b87e5a-57b3-4a7b-a2ed-ccf6cc472957';

-- 11. SEPARACION_SOCIO ----------------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$CONSTANCIA DEL EJERCICIO DEL DERECHO DE SEPARACIÓN DE SOCIO EN {{denominacion_social}}

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye a la documentación formal del procedimiento de separación.

PRIMERO.- Constancia. Se deja constancia en el expediente de que el socio {{socio_afectado_nombre}} ha ejercitado el derecho de separación respecto de {{denominacion_social}} por la causa {{causa_separacion}}, conforme a las causas legales del artículo 346 de la Ley de Sociedades de Capital, a las causas estatutarias válidamente establecidas (artículo 347 LSC) o, en su caso, al supuesto de falta de distribución de dividendos del artículo 348 bis LSC.

SEGUNDO.- Verificación. La Sociedad toma razón de la comunicación recibida y verifica la legitimación del socio (no haber votado a favor del acuerdo que origina la causa, cuando así se exige), la concurrencia de la causa alegada y el ejercicio del derecho por escrito dentro del plazo de un mes desde la publicación del acuerdo o desde la recepción de la comunicación (artículo 348 LSC).

TERCERO.- Valoración y reembolso. Se activa el procedimiento de valoración y reembolso de las participaciones o acciones afectadas conforme a los artículos 353 a 359 LSC, mediante el método {{metodo_valoracion}}; a falta de acuerdo sobre el valor razonable, será determinado por un experto independiente designado por el Registro Mercantil, con devengo del reembolso en los términos legales.

CUARTO.- Efectos societarios. La efectividad de la separación comportará, según proceda, la reducción del capital social o la adquisición por la Sociedad de las participaciones o acciones del socio separado, con observancia del régimen de autocartera y de protección de acreedores aplicable.

QUINTO.- Ejecución. Se faculta a las personas designadas para documentar, custodiar y formalizar las actuaciones societarias derivadas, incluidas las escrituras e inscripciones que procedan.$capa1$
WHERE id = '01618e42-4929-46ad-9b65-e0b094468b81';

-- 12. SUPRESION_PREFERENTE --------------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DE LA JUNTA GENERAL DE {{denominacion_social}} DE EXCLUSIÓN DEL DERECHO DE SUSCRIPCIÓN PREFERENTE

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada ni a la escritura del aumento de capital.

PRIMERO.- Exclusión. La Junta General de {{denominacion_social}}, válidamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda excluir total o parcialmente el derecho de preferencia en relación con el aumento de capital identificado como {{aumento_capital_ref}}, al amparo del artículo 308 de la Ley de Sociedades de Capital.

SEGUNDO.- Interés social. La exclusión se justifica por así exigirlo el interés social, en los términos expuestos en el informe de los administradores incorporado al expediente: {{justificacion_interes_social}}.

TERCERO.- Requisitos del artículo 308 LSC. Se deja constancia de que: (i) los administradores han elaborado el informe que especifica el valor de las participaciones o acciones y justifica detalladamente la propuesta y la contraprestación, con referencia {{informe_admin_ref}}; (ii) en la sociedad anónima, un experto independiente distinto del auditor de cuentas, nombrado por el Registro Mercantil, ha elaborado el informe sobre el valor razonable, el valor teórico del derecho y la razonabilidad de los datos del informe de los administradores, cuando resulta exigible; (iii) la convocatoria ha hecho constar la propuesta de exclusión y el derecho de los socios a examinar los informes; y (iv) el valor nominal más, en su caso, la prima de emisión se corresponde con el valor razonable resultante.

CUARTO.- Régimen de cotizadas. Tratándose de sociedad cotizada, resultan de aplicación las especialidades de los artículos 504 a 506 LSC, incluida, cuando proceda, la delegación en los administradores de la facultad de excluir el derecho de preferencia con los límites legales.

QUINTO.- Vinculación y formalización. El acuerdo queda vinculado al aumento de capital correspondiente y deberá formalizarse, elevarse a público e inscribirse conjuntamente con aquel cuando proceda. Se faculta a las personas designadas para su ejecución.$capa1$
WHERE id = '94087463-1c88-4f39-a1aa-064ff2f88571';

-- 13. TRANSMISION_PARTICIPACIONES ----------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DE LA JUNTA GENERAL DE {{denominacion_social}} DE AUTORIZACIÓN DE TRANSMISIÓN DE PARTICIPACIONES SOCIALES

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al documento público de transmisión.

PRIMERO.- Autorización. La Junta General de {{denominacion_social}}, válidamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda autorizar la transmisión voluntaria por actos inter vivos de participaciones sociales comunicada por {{socio_transmitente}} a favor de {{adquirente}}, conforme al régimen de los artículos 106 a 112 de la Ley de Sociedades de Capital y al régimen estatutario aplicable.

SEGUNDO.- Términos de la transmisión. La transmisión se proyecta sobre {{numero_participaciones}} participaciones, por precio o contraprestación de {{precio_transmision}}, y queda sujeta a las restricciones legales, estatutarias y pactadas incorporadas al expediente.

TERCERO.- Régimen de restricciones. Se deja constancia de la verificación del régimen de transmisión aplicable, incluido, en su caso, el régimen supletorio del artículo 107 LSC (comunicación a la Sociedad, consentimiento por la Junta y derecho de adquisición preferente de socios o, en su defecto, de la propia Sociedad) y las restricciones estatutarias siguientes: {{restricciones_estatutarias}}. Serán nulas las cláusulas que hagan prácticamente libre la transmisión cuando la ley exija restricción, así como la transmisión que no se ajuste al régimen legal o estatutario (artículo 112 LSC).

CUARTO.- Formalización. La transmisión deberá constar en documento público conforme al artículo 106 LSC, y el adquirente podrá ejercer los derechos de socio desde que la Sociedad tenga conocimiento de la transmisión.

QUINTO.- Libro registro. Se faculta al órgano de administración para practicar las anotaciones procedentes en el libro registro de socios (artículo 104 LSC) y emitir las comunicaciones y certificaciones necesarias.$capa1$
WHERE id = 'b6df4e34-3bc9-4885-b4f2-e2569a43c6cb';

-- 14. TRASLADO_DOMICILIO_NACIONAL --------------------------------------------------------
UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}} DE TRASLADO DE DOMICILIO SOCIAL EN TERRITORIO NACIONAL

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye a la escritura pública de modificación estatutaria.

PRIMERO.- Traslado. El Consejo de Administración de {{denominacion_social}}, reunido el {{fecha_consejo}} y válidamente constituido como {{organo_nombre}}, acuerda trasladar el domicilio social, dentro del territorio nacional, a {{nuevo_domicilio}}, con efectos desde {{fecha_efectos}}.

SEGUNDO.- Competencia. La competencia del órgano de administración para acordar el traslado del domicilio dentro del territorio nacional resulta del artículo 285.2 de la Ley de Sociedades de Capital, al no existir disposición estatutaria en contrario que la reserve expresamente a la Junta General, extremo verificado conforme a la referencia {{traslado_domicilio_reservado_junta}}.

TERCERO.- Modificación estatutaria. Se aprueba la nueva redacción del artículo estatutario relativo al domicilio social para reflejar la dirección indicada, verificando que el nuevo domicilio radica en el lugar del centro de efectiva administración y dirección de la Sociedad o de su principal establecimiento o explotación (artículo 9 LSC).

CUARTO.- Formalización e inscripción. El acuerdo se elevará a escritura pública y se inscribirá en el Registro Mercantil, con la publicación que proceda conforme a la normativa registral; cuando el traslado implique cambio de provincia, se solicitarán las publicaciones y traslados de hoja registral aplicables. Referencia de certificación: {{certificacion_domicilio_ref}}.

QUINTO.- Ejecución. Se faculta a las personas designadas para otorgar la escritura, gestionar la inscripción y publicaciones, actualizar los registros administrativos y comunicar el cambio a las autoridades, entidades y contrapartes que corresponda.$capa1$
WHERE id = '1c7fd0e8-2b97-4501-ad09-b9d35a23de6b';

-- 15-18. Binding de materia para plantillas ACTIVA huérfanas (sin conflicto:
-- verificado 2026-07-03 que ninguna otra ACTIVA tiene estas materias).
UPDATE plantillas_protegidas SET materia_acuerdo = 'DELEGACION_FACULTADES'
WHERE id = 'd3e08b42-a67e-4b33-9bbb-2689b5d8d4cf' AND materia_acuerdo IS NULL;
UPDATE plantillas_protegidas SET materia_acuerdo = 'OPERACION_VINCULADA'
WHERE id = '64fa1683-8cb8-4c4c-b8d6-e09f91cafa59' AND materia_acuerdo IS NULL;
UPDATE plantillas_protegidas SET materia_acuerdo = 'APROBACION_CUENTAS'
WHERE id = 'c8da1e61-ef2a-4a5c-895b-a5d100916ecf' AND materia_acuerdo IS NULL;
UPDATE plantillas_protegidas SET materia_acuerdo = 'TRANSFORMACION'
WHERE id = '5f8212a8-3d37-4504-b066-dc06fe995dce' AND materia_acuerdo IS NULL;

-- NO tocadas a propósito:
--  * c90edc8c (formulación de cuentas v1.1.0 sin materia): ya existe una ACTIVA
--    dedicada v1.2.0 para FORMULACION_CUENTAS; bindearla duplicaría.
--  * f698a2f2 (acción social de responsabilidad, contenido rico): no existe
--    materia canónica ACCION_SOCIAL_RESPONSABILIDAD en el catálogo; pendiente
--    de alta de materia antes de bindear.
