# **Diseño funcional de un canal de denuncias integrado en GRC Compass y AIMS 360**

A 28 de agosto de 2026, **GRC Compass dispone de una base reutilizable sólida en riesgos, controles, incidentes, auditoría, planes de acción, privacidad, terceros, evidencias y gobierno, pero no acredita todavía un canal de denuncias completo comparable con las soluciones líderes**. El propio dictamen del módulo califica como brecha bloqueante, o P0, la incorporación del ciclo completo de la Ley 2/2023, incluidos acuse, investigación, respuesta, prórroga, independencia, anonimato o confidencialidad, protección frente a represalias y gestión de conflictos. La solución recomendada no es un buzón añadido al GRC, sino un **servicio transversal de recepción, investigación y prueba**, conectado con los objetos ya existentes de riesgo, control, incidente, hallazgo, acción correctora, política, tercero y escalado al órgano de administración. Su arquitectura debe basarse en una denuncia raíz y en subexpedientes autónomos por entidad, materia y régimen regulatorio, con relojes independientes, segregación técnica, evidencias versionadas y cierres separados. La implementación debe priorizar primero cumplimiento legal, anonimato, trazabilidad, retención y gobierno; después, omnicanalidad avanzada, integraciones y analítica; y finalmente, inteligencia artificial sujeta a revisión humana y gobernanza específica.

## **1\. Alcance, premisas y criterio de diseño**

### **Base documental y limitaciones**

El análisis parte del dictamen de auditoría de GRC Compass y del estudio comparativo de plataformas RegTech para canales de denuncias. El primer documento describe GRC Compass como un sistema de gobierno, riesgo y cumplimiento para grupos aseguradores, con dominios de riesgos, controles, incidentes, terceros, compliance penal, privacidad, resiliencia, auditoría y excepciones. El segundo traduce la Directiva (UE) 2019/1937 y la Ley 2/2023 a requisitos funcionales y compara soluciones como EQS IntegrityLine, NAVEX WhistleB, SpeakUp, FaceUp, Whispli, Formalize, Ithikios, Complylaw y LexCanal. La comparación de NAVEX se apoya principalmente en WhistleB, por lo que no debe atribuirse automáticamente a EthicsPoint cada funcionalidad concreta sin una validación adicional del producto y paquete contratados.

El documento del vault desarrolla también **AIMS 360** como módulo especializado de gobierno de inteligencia artificial integrado en una plataforma de gobierno corporativo. AIMS 360 comprende inventario y clasificación de sistemas de inteligencia artificial, autodiagnóstico, expediente técnico, registros de modelos y datos, vigilancia poscomercialización, gestión de incidentes graves de IA y custodia probatoria. No se ha identificado, sin embargo, una definición autónoma de “AMS” que permita distinguirlo de AIMS 360 o de la plataforma corporativa matriz. En consecuencia, esta propuesta emplea AIMS 360 para la integración de hechos relacionados con sistemas de IA y deja pendiente de confirmación la correspondencia técnica entre “AMS”, AIMS 360 y el resto de la arquitectura.

### **Principio rector**

El canal debe diseñarse como parte del **Sistema interno de información**, no como una aplicación aislada. La Ley 2/2023 exige una combinación de tecnología, política, procedimiento, Responsable del Sistema, recursos, formación, consulta con la representación legal de las personas trabajadoras y controles de protección de datos. La entidad conserva la responsabilidad de implantación y actúa como responsable del tratamiento, aunque encargue a un tercero la operación tecnológica o parte de la gestión. Por ello, el diseño funcional debe ir acompañado de decisiones organizativas, jurídicas y contractuales que no pueden ser sustituidas por el software.

La integración debe mantener una separación deliberada entre el **expediente confidencial de denuncia** y los objetos ordinarios del GRC. No todos los usuarios con acceso a riesgos, auditoría o acciones correctoras deben conocer la identidad del informante, las personas afectadas o el contenido íntegro de la investigación. La conexión con otros módulos debe realizarse mediante referencias controladas, extractos minimizados y subexpedientes derivados, en vez de replicar indiscriminadamente el contenido de la denuncia. Este enfoque permite aprovechar el ecosistema GRC sin degradar la confidencialidad exigida para el canal.

## **2\. Diagnóstico de las capacidades actuales**

### **Capacidades reutilizables**

GRC Compass ya contempla una matriz de riesgos inherentes y residuales, un catálogo de controles, asignación a las tres líneas de defensa, vinculación con obligaciones y políticas, conexión con el apetito de riesgo y monitorización de indicadores clave de riesgo o KRIs. Estas capacidades permiten transformar hechos confirmados en nuevos riesgos, recalibrar riesgos existentes, revisar la eficacia de controles y elevar tendencias al órgano de gobierno. El módulo de compliance penal añade un mapa de tipologías como corrupción, fraude, blanqueo y delitos contra la intimidad, junto con vínculos a regalos, hospitalidades y diligencia de socios. Esta estructura constituye una base adecuada para clasificar denuncias y relacionarlas con el modelo de prevención penal.

El módulo también dispone de gestión de incidentes y notificaciones regulatorias, con clasificación de severidad, plazos, fases de reporte y autoridades destinatarias en DORA, RGPD y NIS2. La auditoría interna permite clasificar hallazgos, asociar planes de remediación y gestionar el plan anual de auditoría. Las excepciones y desviaciones siguen un ciclo de solicitud, justificación, controles compensatorios, caducidad y escalado al Consejo cuando se supera el umbral de tolerancia. Estas piezas pueden reutilizarse para investigar denuncias, ordenar medidas correctoras y verificar su ejecución.

**Tabla 1: Diagnóstico de capacidades actuales y reutilización propuesta**

| Dominio | Capacidad acreditada | Aplicación al canal | Estado |
| ----- | ----- | ----- | ----- |
| Riesgos y controles | Riesgo inherente y residual, catálogo de controles, tres líneas de defensa, obligaciones, políticas y KRIs. | Crear o actualizar riesgos, controles y KRIs a partir de hechos confirmados, sin exponer información confidencial innecesaria. | Base existente con integración por desarrollar. |
| Compliance penal | Mapa de riesgos penales, anticorrupción, diligencia de socios y referencia al canal ético. | Clasificación por tipología, activación de investigación penal interna y demostración de eficacia del modelo. | Cobertura parcial; el canal completo es P0. |
| Incidentes regulatorios | Incidentes DORA, RGPD y NIS2, severidad y notificaciones. | Generar subexpedientes regulatorios cuando una denuncia revele una brecha de datos, un incidente TIC o una infracción sectorial. | Base existente, pero con relojes y decisiones de perímetro incompletos. |
| Auditoría y remediación | Hallazgos por severidad, planes de remediación y programación de auditoría. | Convertir conclusiones en hallazgos y acciones con validación independiente. | Reutilizable con segregación reforzada. |
| Privacidad | Registro de tratamientos, evaluaciones de impacto, derechos y oficina del DPO. | Gobernar minimización, acceso, retención, ejercicio de derechos y evaluaciones de impacto del canal. | Base existente; faltan reglas específicas del canal. |
| Terceros | Inventario, due diligence, concentración, subcontratación, salida y legal hold. | Investigar denuncias sobre proveedores y controlar al eventual proveedor tecnológico del canal. | Base reutilizable, con due diligence técnica y contractual adicional. |
| Evidencias | Hash SHA-512 y custodia de declaraciones e informes. | Preservar documentos, grabaciones, transcripciones, entrevistas, decisiones y exportaciones. | Insuficiente sin WORM, sellado temporal y cadena de custodia completa. |

**Notas:** “Base existente” significa que el dominio aparece descrito en el mapa funcional, no que estén implementadas todas las interfaces necesarias para whistleblowing. La documentación no acredita una API específica del canal, telefonía integrada, buzón anónimo, deduplicación, conectores de RR. HH. o cadena de custodia especializada para audio.

### **Capacidades parciales o no acreditadas**

La presencia de una referencia al canal ético dentro de compliance penal no equivale a un sistema completo de denuncias. El propio dictamen exige incorporar acuse, investigación, respuesta, prórroga, medidas contra represalias, conflicto de interés, independencia del gestor, anonimato o confidencialidad y conservación limitada. Además, sitúa el canal interno de la Ley 2/2023 entre las funcionalidades P0 que deben completarse antes de activar el módulo de compliance penal. Debe concluirse, por tanto, que el canal está contemplado conceptualmente, pero no demostrado como capacidad operativa completa.

La cadena de custodia actual también es parcial. El hash prueba que un contenido no ha cambiado cuando se conserva el original y puede recomputarse, pero no prueba por sí solo autoría, contexto, integridad previa o custodia entre sistemas. El expediente debe añadir almacenamiento WORM o equivalente, sello temporal, identidad del actor, control de versiones, acceso de solo lectura tras el cierre y registro de cada creación, descarga, exportación, bloqueo, restauración o transferencia. Esta mejora es crítica para grabaciones, transcripciones, documentos obtenidos durante la investigación y decisiones que puedan utilizarse en procedimientos laborales, penales o supervisores.

## **3\. Benchmark funcional de las soluciones líderes**

### **Estándar mínimo de mercado**

Las soluciones líderes convergen en un conjunto funcional más amplio que el de un formulario web. El estándar comprende recepción escrita y verbal, anonimato técnico, diálogo bidireccional, gestión de expedientes, tareas, vencimientos, investigación, auditoría, reporting, multientidad, multilingüismo y exportación. Las plataformas enterprise añaden reglas multinivel, administración central y local, voz, traducción, API, webhooks, inteligencia de patrones y conectores con sistemas corporativos. La amplitud funcional, sin embargo, no sustituye la comprobación de que los plazos, retenciones, roles y decisiones están configurados conforme a la jurisdicción aplicable.

**Tabla 2: Benchmark funcional por categoría**

| Categoría | Cobertura líder | Referencias funcionales | Nivel objetivo para el producto |
| ----- | ----- | ----- | ----- |
| Recepción | Formulario web, móvil, teléfono, IVR, voz, correo postal y reunión presencial incorporados a un expediente único. | NAVEX permite registrar comunicaciones telefónicas o presenciales; FaceUp ofrece mensajes de voz y líneas telefónicas; SpeakUp combina web, aplicación y teléfono. | Recepción omnicanal con normalización y deduplicación, incluida alta manual controlada. |
| Anonimato | Ausencia de IP, huella de dispositivo y metadatos identificativos, junto con credencial segura y diálogo posterior. | EQS, FaceUp y Whispli declaran controles contra IP o identificación de dispositivo; Formalize añade eliminación de metadatos y arquitectura zero-knowledge. | Anonimato por diseño y separación entre identidad, contenido y telemetría técnica. |
| Comunicación | Buzón seguro bidireccional, preguntas, carga documental, traducción y notificaciones sin contenido sensible. | EQS, Formalize, NAVEX, SpeakUp y Whispli acreditan diálogo o buzón anónimo. | Buzón anónimo obligatorio con credencial recuperable mediante procedimiento seguro. |
| Gestión del caso | Triage, enrutamiento, responsables, hitos, tareas, fechas límite, investigación y resolución. | EQS incorpora flujos e hitos; SpeakUp añade reglas multinivel y tareas; Whispli cubre desde admisión hasta resolución. | Workflow configurable con estados bloqueantes y decisiones motivadas. |
| Trazabilidad | Cronología inalterable, auditoría de accesos y cambios, cadena de custodia y exportación completa. | Formalize, EQS, FaceUp y Whispli acreditan trazabilidad o auditoría del expediente. | WORM o append-only, hashes encadenados, sellado temporal y paquete probatorio exportable. |
| Reporting | KPIs, estadísticas, vencimientos, tendencias, multiempresa y conectores de inteligencia empresarial. | FaceUp publica integraciones con Power BI y Tableau; SpeakUp ofrece integración con Power BI; Formalize dispone de estadísticas agregadas multi-cliente. | Reporting operativo, de gobierno y regulatorio con agregación anonimizada. |
| Internacionalización | Administración multi-entidad, reglas locales, traducción y decenas de idiomas. | EQS supera 80 idiomas, NAVEX 60 en web y 40 en IVR, SpeakUp 100, FaceUp 113 y Whispli 70\. | Configuración por entidad, país, idioma, calendario, autoridad y residencia de datos. |
| Integraciones | SSO, SAML, API, webhooks, BI, RR. HH., SharePoint y plataformas de automatización. | FaceUp presenta la cobertura pública más amplia; SpeakUp integra SharePoint y Power BI; Whispli publica API e integraciones con BI y RR. HH. | API y eventos internos desacoplados, con controles de minimización antes de transferir datos. |
| Inteligencia artificial | Transcripción, traducción, resumen, categorización, priorización, enrutamiento y detección de patrones. | EQS, SpeakUp, FaceUp y Whispli publican funciones de IA, pero la gobernanza, residencia y entrenamiento requieren validación contractual. | IA opcional, desactivable y sometida a revisión humana, evaluación de impacto y trazabilidad. |

**Notas:** El nivel objetivo representa una propuesta de producto basada en la cobertura conjunta del mercado, no una afirmación de que una sola plataforma reúna todas las funciones en su paquete básico. Los módulos de voz, SSO, inteligencia artificial o multi-entidad suelen contratarse separadamente y deben evaluarse por coste total y alcance.

### **Posicionamiento de las referencias líderes**

EQS IntegrityLine destaca por su combinación de anonimato, cifrado de extremo a extremo, workflows, monitorización de plazos, auditoría, traducción y más de 80 idiomas. SpeakUp aporta enrutamiento multinivel, tareas, estructuras multi-entidad, supervisión centralizada, más de 100 idiomas e inteligencia artificial para traducción, transcripción, categorización y patrones. NAVEX WhistleB sobresale en recepción multilingüe, IVR, anonimización de voz, acuses y recordatorios. FaceUp presenta una combinación especialmente amplia de voz, idiomas, API, webhooks e integraciones de negocio.

Formalize constituye una referencia útil para anonimato técnico, cifrado zero-knowledge, permisos por caso, segregación multi-cliente, voz distorsionada y certificaciones de seguridad. Whispli aporta anonimato por diseño, Safe Inbox, workflows configurables, residencia regional, API y Voice AI. Complylaw y LexCanal ofrecen una capa jurídica española y funciones de gestión, aunque su documentación pública proporciona menos detalle técnico sobre arquitectura, hosting, integraciones y automatización. Convercent no debe tratarse como proveedor independiente de OneTrust, pues su negocio de Ethics & Compliance fue transferido a EQS en diciembre de 2024\.

## **4\. Gaps y oportunidades de integración**

### **Brechas prioritarias**

La principal brecha es la ausencia de evidencia de un canal omnicanal operativo. GRC Compass contempla incidentes y menciona el canal ético, pero no acredita formulario anónimo especializado, teléfono, voz, reunión presencial, buzón del informante o deduplicación entre canales. Esta brecha es material porque la normativa exige recepción escrita y verbal, y la comunicación verbal debe documentarse mediante grabación o transcripción con consentimiento y posibilidad de revisión. El producto puede cerrar el mínimo legal inicialmente mediante alta manual controlada de llamadas y reuniones, sin esperar a desplegar un IVR global.

La segunda brecha es el anonimato técnico. Los documentos no acreditan que GRC Compass evite registrar IP, huella del dispositivo o metadatos de adjuntos, ni que proporcione una credencial anónima para comunicaciones posteriores. El benchmark exige precisamente esos controles y una prueba de reidentificación para comprobar que el proveedor y la entidad no pueden reconstruir indebidamente la identidad. La resolución requiere una capa de entrada separada del IAM corporativo, con telemetría reducida, saneamiento de metadatos y buzón anónimo.

La tercera brecha afecta al workflow jurídico. El motor debe controlar el acuse en siete días naturales y las actuaciones de investigación y respuesta en un plazo ordinario de tres meses, ampliable hasta otros tres meses por especial complejidad. La referencia a siete días hábiles que aparece en el planteamiento inicial del dictamen queda corregida en el análisis posterior, que exige siete días naturales salvo validación nacional distinta. Cada prórroga, retraso o excepción debe quedar motivada, aprobada y congelada como evidencia.

**Tabla 3: Mapa de gaps e integración recomendada**

| Gap | Situación actual | Impacto | Integración propuesta |
| ----- | ----- | ----- | ----- |
| Recepción omnicanal | El canal ético aparece referido, pero no se acreditan web anónima, voz, teléfono o reunión integrados. | Brecha legal y funcional alta por falta de recepción escrita y verbal unificada. | Capa de intake común que cree una denuncia raíz y normalice todos los orígenes. |
| Buzón anónimo | No se acredita mensajería bidireccional ni credencial segura. | Impide pedir aclaraciones y mantener informado al denunciante sin revelar su identidad. | Safe Inbox con token, notificaciones neutras y recuperación controlada. |
| Triage e investigación | Existen incidentes, severidad, auditoría y acciones, pero no un workflow especializado de denuncias. | Riesgo de decisiones inconsistentes, conflictos y falta de trazabilidad. | Motor de admisibilidad, jurisdicción, conflicto, asignación y plan de investigación. |
| Relojes legales | El canal completo y sus plazos están identificados como P0 pendiente. | Riesgo de acuse o respuesta fuera de plazo y de ausencia de prueba. | Extender `regulatory_clock` con recepción, acuse, respuesta, prórroga y retención. |
| Conflictos e independencia | La segregación está definida como requisito, pero debe convertirse en bloqueo técnico. | Riesgo de acceso indebido, autoaprobación o investigación por una persona afectada. | Motor de recusación con sustituto, abstención, fundamento y ruta especial para alta dirección. |
| Evidencia | Existe hash SHA-512, pero no acredita por sí solo la cadena probatoria completa. | Debilita investigaciones, procedimientos y defensa del modelo de compliance. | WORM, sello temporal, versión, actor, cadena de custodia y exportación firmada. |
| Retención | Existe legal hold general, pero no se acredita separación entre entrada, investigación y libro-registro. | Riesgo de conservación excesiva, destrucción indebida o aplicación incorrecta del límite de diez años. | Repositorios lógicos separados, borrado selectivo, anonimización y bloqueo por investigación o litigio. |
| Integración regulatoria | Existen objetos DORA, RGPD y NIS2, pero no se acredita la derivación desde una denuncia. | Un hecho denunciado puede activar obligaciones paralelas y autoridades distintas. | Crear subexpedientes por entidad y régimen sin cerrar automáticamente los demás. |
| Analítica | Existen KRIs y reporting GRC, pero no un dashboard específico del canal. | Se pierden tendencias, reincidencias y señales de cultura de cumplimiento. | Métricas agregadas y anonimizadas, con umbrales de privacidad y escalado al Consejo. |

### **Integración con los módulos de cumplimiento**

La integración más inmediata es con Risk 360 y ERM. Una denuncia admitida debe poder asociarse a riesgos y controles existentes, pero solo una conclusión suficientemente contrastada debería alterar el riesgo residual o generar un hallazgo definitivo. Los casos confirmados pueden incrementar KRIs, revelar concentraciones de incidentes y activar una revisión del apetito o tolerancia. El expediente de riesgo debe recibir una referencia minimizada al caso, mientras el detalle confidencial permanece en el dominio del canal.

La integración con auditoría interna y planes de acción debe producirse al cerrar la fase de investigación o cuando sea necesaria una revisión independiente. Los hallazgos derivados deben conservar su origen, pero no exponer automáticamente al informante ni las declaraciones protegidas. El cierre de la acción correctora debe requerir evidencia y validación por una función distinta del owner operativo. Auditoría interna debe poder acceder a evidencia suficiente para verificar la eficacia del proceso, mediante un permiso especial sujeto a registro.

La integración con políticas debe permitir relacionar la denuncia con la versión de la política vigente en la fecha de los hechos. Los metadatos probatorios recomendados incluyen versión normativa, versión de política, fuente, decisión, aprobador y evidencia adjunta. Un patrón de denuncias puede activar revisión de políticas, formación, controles de aceptación o campañas de comunicación. Esta integración convierte el canal en una fuente de mejora del programa, no solo en un repositorio de casos.

Los conflictos de interés deben gestionarse en dos niveles. El primer nivel afecta al equipo que recibe, investiga o aprueba el caso; el segundo afecta al conflicto sustantivo denunciado, que puede enlazarse con el registro corporativo de conflictos. El sistema debe bloquear al responsable o investigador cuando pertenezca a la unidad investigada, tenga relación jerárquica con la persona afectada, haya intervenido en la operación o resulte beneficiario. La abstención, el sustituto y el fundamento deben quedar registrados como evidencia.

AIMS 360 debe recibir un subexpediente cuando la denuncia se refiera a un sistema de IA, sus datos, resultados, sesgos, seguridad o vigilancia poscomercialización. AIMS 360 ya contempla incidentes graves de IA, investigación, análisis de causa raíz, medidas correctoras y handoff a GRC y Secretaría Societaria. Una misma denuncia puede generar simultáneamente un caso ético, una evaluación RGPD, un incidente DORA y un incidente de IA, cada uno con hechos generadores y cierres propios. Las evidencias comunes deben reutilizarse mediante referencias versionadas, sin duplicación ni cierre cruzado.

## **5\. Arquitectura funcional propuesta**

### **Capas de la solución**

La solución debe componerse de una capa de experiencia del informante, una capa de privacidad, un núcleo de casos, un motor regulatorio, un repositorio probatorio, un hub de integración y una capa de reporting. La separación responde a la necesidad de mantener anonimato y confidencialidad mientras se reutilizan las capacidades corporativas de riesgos, auditoría y gobierno. El núcleo no debe depender de una única interfaz de entrada, porque la ley y el benchmark exigen consolidar web, voz, reunión y otros orígenes. Tampoco debe confundirse el expediente operativo con el libro-registro o con el expediente laboral, penal o regulatorio posterior.

**Tabla 4: Arquitectura funcional objetivo**

| Capa | Componentes | Responsabilidad principal |
| ----- | ----- | ----- |
| Experiencia del informante | Portal web responsive, accesibilidad, multidioma, voz, teléfono, reunión presencial y buzón seguro. | Recibir comunicaciones identificadas, confidenciales o anónimas y mantener diálogo posterior. |
| Privacidad y anonimato | Saneamiento de metadatos, separación de identidad, cifrado, credencial anónima y reglas de minimización. | Evitar reidentificación indebida y limitar el acceso a datos personales y categorías especiales. |
| Núcleo de casos | Triage, workflow, asignaciones, tareas, entrevistas, decisiones, comunicaciones, medidas y cierre. | Gestionar el ciclo completo con decisiones motivadas y estados bloqueantes. |
| Motor de reglas | Relojes, jurisdicción, entidad, conflicto, severidad, prórrogas, escalados y retención. | Activar obligaciones, avisos y subexpedientes sin confundir regímenes. |
| Evidencia | Artefactos versionados, WORM, hashes, sellos temporales, legal hold y logs append-only. | Preservar integridad, origen, acceso, exportación, retención y cadena de custodia. |
| Integración GRC/AIMS | API interna, bus de eventos, enlaces a riesgos, controles, auditoría, terceros, políticas, RGPD, DORA, NIS2 y AIMS 360\. | Crear objetos derivados minimizados y mantener sincronización de estados sin revelar datos innecesarios. |
| Gobierno y reporting | Panel operativo, métricas agregadas, board packs, libro-registro y exportación regulatoria. | Supervisar plazos, reincidencias, remediación, cultura y cumplimiento del sistema. |

### **Modelo de datos**

El objeto principal debe ser `whistleblowing_report`, equivalente funcional a un incidente raíz. Debe contener identificador, canal, fecha y hora de recepción, entidad afectada, jurisdicción, categoría, estado de anonimato, idioma, severidad preliminar y referencia a las evidencias iniciales. Esta propuesta adapta el patrón `incident_root`, que conserva una narrativa fáctica común y relaciona el hecho con múltiples entidades, evidencias y subexpedientes. La identidad del informante, cuando exista, debe almacenarse en un objeto separado y cifrado, con permisos y registros de acceso más restrictivos que los del resto del caso.

El segundo objeto debe ser `whistleblowing_case`, que materialice la combinación entre denuncia, entidad, jurisdicción y ámbito de investigación. Debe registrar aplicabilidad, fundamento de admisión o archivo, Responsable del Sistema, investigador, conflicto, estado, autoridad potencial y evidencia de cierre. El patrón se apoya en `incident_regime_case`, que crea expedientes autónomos para cada combinación de entidad, incidente y régimen. Una denuncia que afecte a varias sociedades debe generar casos separados cuando cambien la autoridad, el responsable, el acceso o la ley aplicable.

Los relojes deben almacenarse como objetos, no como fechas incrustadas en el caso. Cada reloj debe registrar hecho generador, inicio, calendario, vencimiento, alertas, estado, suspensión, prórroga y justificación del retraso. El mismo caso puede tener un reloj de acuse, otro de investigación, otro de prórroga, otro de reunión presencial y varios de retención. Los casos regulatorios derivados deben mantener relojes DORA, RGPD, NIS2 o de IA completamente separados.

Las evidencias deben modelarse como artefactos reutilizables y versionados. Los campos mínimos incluyen tipo, origen, autor, versión, hash, ubicación WORM, sello temporal, clasificación de confidencialidad, retención, legal hold y cadena de custodia. Los logs deben registrar actor, rol, entidad, acción, objeto, valor anterior y nuevo, timestamp, justificación y resultado. En la interfaz anónima, la trazabilidad técnica debe evitar recopilar IP o dispositivo del informante, aunque sí debe registrar las actuaciones de los usuarios internos y administradores.

## **6\. Flujos, roles y segregación de funciones**

### **Flujo de extremo a extremo**

El workflow debe estar gobernado por hitos verificables y no por un estado libremente editable. Cada transición crítica debe exigir los campos, aprobaciones y evidencias correspondientes. Los cambios de estado deben ser append-only o producir una versión congelada del expediente. El cierre solo debe permitirse cuando se hayan resuelto los relojes, las comunicaciones, la retención y las acciones obligatorias.

**Tabla 5: Flujo funcional propuesto**

| Fase | Actividades y controles | Salida o integración |
| ----- | ----- | ----- |
| Recepción | Captura web o manual de voz, teléfono, reunión o correo; consentimiento para grabación o transcripción; saneamiento de metadatos. | Denuncia raíz, credencial de buzón y evidencia inicial sellada. |
| Normalización | Detección de duplicados, idioma, entidad, jurisdicción, categoría y posibles riesgos inmediatos. | Caso o casos por entidad, sin fusionar indebidamente obligaciones. |
| Conflicto y asignación | Comprobación automática del Responsable, investigador, unidad, jerarquía, participación previa y alta dirección. | Asignación ordinaria o ruta sustitutiva con abstención documentada. |
| Acuse | Comunicación dentro de siete días naturales, salvo riesgo para la confidencialidad; registro de excepción y evidencia del envío. | Cierre del reloj de acuse y apertura del buzón de seguimiento. |
| Triage | Evaluación de ámbito, credibilidad inicial, urgencia, medidas de protección, competencia y necesidad de remisión. | Archivo motivado, investigación, derivación o subexpediente regulatorio. |
| Investigación | Plan, tareas, entrevistas, solicitudes al informante, evidencias, audiencia de la persona afectada y revisiones legales. | Informe de hechos y conclusiones, con versiones y cadena de custodia. |
| Escalado | Activación por delito, alta dirección, riesgo grave, datos personales, clientes, función esencial, reincidencia o impacto transfronterizo. | Subexpediente penal, laboral, RGPD, DORA, NIS2, AIMS, auditoría o Consejo. |
| Decisión y remediación | Archivo, confirmación, medidas disciplinarias, controles, revisión de políticas, recuperación de activos y acciones correctoras. | Riesgo o control actualizado, hallazgo y plan de acción con owner y plazo. |
| Respuesta y cierre | Respuesta al informante, comunicaciones permitidas a la persona afectada, cierre de relojes y justificación de limitaciones. | Expediente congelado, seguimiento de acciones y reglas de conservación. |
| Retención o reapertura | Supresión, anonimización, transferencia a expediente posterior, legal hold o reapertura por nueva evidencia. | Libro-registro actualizado y log inmutable de conservación o destrucción. |

### **Roles y permisos**

El Responsable del Sistema debe actuar con independencia, autonomía y medios suficientes. Debe controlar la admisibilidad, la asignación, los conflictos, las decisiones esenciales y el cumplimiento de plazos, aunque determinadas tareas estén delegadas. Un tercero puede gestionar técnicamente el canal como encargado del tratamiento, pero no desplaza la responsabilidad ni la función decisoria interna. El sistema debe reflejar expresamente esta diferencia entre operación delegada y responsabilidad legal.

**Tabla 6: Matriz funcional de roles**

| Rol | Permisos principales | Restricciones |
| ----- | ----- | ----- |
| Informante | Presentar información, adjuntar evidencias, revisar transcripción, responder preguntas y recibir comunicaciones. | No necesita autenticación corporativa y no debe quedar expuesto a rastreo identificativo indebido. |
| Responsable del Sistema | Supervisar el sistema, admitir, asignar, aprobar decisiones críticas y controlar plazos. | Debe ser independiente y quedar sustituido cuando exista conflicto. |
| Equipo de intake | Normalizar entradas, registrar comunicaciones verbales y verificar campos mínimos. | Acceso limitado a la información necesaria y sin potestad de cierre. |
| Investigador | Planificar actuaciones, recoger evidencia, entrevistar y documentar conclusiones. | No puede investigar si pertenece a la unidad afectada o mantiene una relación relevante. |
| Legal y Compliance | Validar ámbito, remisiones, privilegio, riesgos penales y decisiones de escalado. | No deben sustituir automáticamente al Responsable ni aprobar actuaciones propias sin control. |
| DPO | Asesorar sobre acceso, minimización, conservación, derechos y evaluación de impacto. | Acceso al contenido solo dentro de sus competencias y bajo necesidad de conocer. |
| Recursos Humanos | Gestionar medidas laborales, protección y actuaciones disciplinarias cuando proceda. | No debe recibir automáticamente todas las denuncias ni conocer la identidad sin necesidad funcional. |
| Auditoría Interna | Revisar independencia, proceso, evidencias, remediación y eficacia de controles. | No debe depender del área investigada ni modificar el expediente operativo. |
| Secretaría del Consejo | Gestionar board packs, abstenciones, decisiones y seguimiento del órgano. | Recibe información proporcionada y minimizada según materialidad y confidencialidad. |
| Administrador técnico | Configurar plataforma, disponibilidad, integraciones y soporte. | No puede leer casos por defecto, alterar logs ni modificar evidencias congeladas. |

La segregación debe implantarse como control técnico. Quien solicita o ejecuta una medida no debe aprobar su suficiencia; el dueño operativo no debe cerrar su propio hallazgo; y el administrador no debe poder modificar registros probatorios. La elevación temporal de privilegios debe exigir justificación, aprobación, caducidad y revisión posterior. Los accesos delegados o por suplantación también deben quedar expresamente trazados.

## **7\. Anonimato, confidencialidad y cobertura regulatoria**

### **Protección del informante y de las personas afectadas**

El anonimato debe ser una modalidad técnica real y no una mera etiqueta. El canal no debe registrar IP, huella de dispositivo, cookies identificativas o metadatos innecesarios, y debe ofrecer una credencial segura para continuar la conversación. Las notificaciones externas al informante deben limitarse a avisar de que existe un mensaje, sin revelar contenido sensible en correo o SMS. Los archivos adjuntos deben sanearse antes de ponerse a disposición de los investigadores cuando sus metadatos puedan revelar involuntariamente la identidad.

La confidencialidad exige RBAC a nivel de caso, categoría y entidad, junto con MFA, SSO para usuarios internos, privilegio mínimo y logs. La identidad conocida debe mantenerse en una zona especialmente restringida y revelarse solo mediante una acción autorizada y trazada. La persona afectada conserva derechos de información, audiencia, presunción de inocencia y protección del honor, que deben implementarse mediante fases y plantillas separadas. El workflow no debe revelar prematuramente la identidad del informante ni destruir pruebas al comunicar la existencia de la investigación.

La protección frente a represalias debe ser un subproceso y no un campo de sí o no. El sistema debe registrar factores de riesgo, medidas preventivas, incidentes posteriores, owner, revisiones y resultados. Cuando el informante sea conocido, pueden monitorizarse cambios laborales relevantes con acceso restringido y base jurídica validada. Cuando sea anónimo, el buzón debe permitir que la persona comunique represalias sin perder la protección de su identidad.

### **Matriz regulatoria**

La Directiva (UE) 2019/1937 establece el marco europeo mínimo de canales internos y externos y de protección del informante. La Ley 2/2023 amplía en España el ámbito a determinadas infracciones del Derecho de la Unión, infracciones penales y administrativas graves o muy graves y determinadas conductas que causen perjuicio económico a Hacienda o Seguridad Social. Con carácter general, están obligadas las entidades privadas con cincuenta o más trabajadores, además de determinadas entidades reguladas con independencia de plantilla y gran parte del sector público. La política del producto debe permitir adaptar el ámbito por entidad y país.

El sistema debe recibir comunicaciones escritas y verbales, posibilitar reuniones presenciales, emitir acuse en siete días naturales y controlar un periodo ordinario de investigación y respuesta de tres meses. La ampliación de hasta tres meses adicionales debe reservarse a asuntos de especial complejidad y quedar motivada. Los indicios de delito deben activar la remisión inmediata al Ministerio Fiscal y, cuando se afecten intereses financieros de la Unión, a la Fiscalía Europea. El producto debe generar una exportación íntegra con cadena de custodia y constancia de remisión.

La conservación exige más granularidad que una regla general de diez años. Los datos deben permanecer en el sistema interno solo durante el tiempo imprescindible para decidir si se inicia una investigación; transcurridos tres meses deben suprimirse de ese repositorio, salvo conservación anonimizada para demostrar el funcionamiento. Cuando exista investigación, el expediente puede continuar en un repositorio separado sujeto a una retención justificada. El libro-registro no puede conservar datos personales durante más de diez años y debe coexistir con borrado selectivo, anonimización y legal hold.

El RGPD debe funcionar como capa transversal. La entidad es normalmente responsable del tratamiento y el proveedor SaaS actúa como encargado, con contrato conforme al artículo 28, subencargados identificados y controles sobre localización y transferencias. La solución debe aplicar privacidad desde el diseño, minimización, deber de información, seguridad y acceso restringido. Las certificaciones ISO 27001, SOC 2 o ENS aportan evidencia, pero no sustituyen el análisis de riesgos, la evaluación de impacto o las obligaciones contractuales.

La cobertura multisector debe implantarse mediante subexpedientes. Una denuncia puede revelar una brecha RGPD, un incidente TIC sujeto a DORA o NIS2, un incumplimiento prudencial, una conducta penal o un incidente de IA. Cada régimen tiene su propio hecho generador, autoridad, reloj, informe y acto de cierre. La clausura del caso interno no debe cerrar automáticamente una notificación regulatoria, un procedimiento laboral o un plan de acción pendiente.

## **8\. Reporting, alertas y automatización**

### **Reporting operativo y de gobierno**

El panel operativo debe mostrar casos por estado, categoría, entidad y jurisdicción, junto con acuses pendientes, investigaciones próximas al vencimiento, prórrogas, conflictos y acciones retrasadas. Estas métricas deben construirse sobre relojes y eventos estructurados, no sobre búsquedas de texto libre. El acceso a datos nominativos debe quedar restringido al equipo del caso. Los usuarios de gobierno deben recibir información agregada o anonimizada cuando el detalle no sea necesario.

El reporting para el órgano de administración debe integrarse con el Board Escalation Engine propuesto en el dictamen. Este motor debe elevar hechos que excedan tolerancias, afecten a funciones esenciales, impliquen datos personales de alto riesgo, requieran comunicación a clientes, tengan repercusión transfronteriza o sean reincidentes. Cada escalado debe incluir norma, plazo, owner, recomendación, abstenciones, medidas, fecha de revisión y decisión del órgano. En denuncias, deben añadirse como disparadores la afectación a administradores, alta dirección, Responsable del Sistema, fraude material, corrupción, represalias y posible delito.

El producto debe distinguir métricas de volumen de indicadores de eficacia. Un aumento de denuncias no implica por sí mismo un deterioro de cumplimiento, pues también puede reflejar mayor confianza en el canal. La evaluación debe combinar tiempos de acuse, duración, sustanciación, reincidencia, ejecución de acciones, satisfacción del informante cuando sea medible y distribución por canal. Los indicadores de madurez, heatmaps de reincidencia y score de cultura ya se contemplan como capacidades P2 del GRC.

### **Automatización e inteligencia artificial**

La automatización determinista debe preceder a la inteligencia artificial. Los relojes, conflictos, permisos, retención, escalados y requisitos de cierre se basan en reglas jurídicas que deben ser configurables, versionadas y auditables. Ningún modelo debe decidir autónomamente que una denuncia es falsa, inadmisible o carente de credibilidad. El Responsable del Sistema y el investigador deben conservar la decisión y dejar constancia de sus fundamentos.

En una fase posterior, la IA puede asistir en transcripción, traducción, resumen, categorización, priorización y detección de patrones, como ya hacen EQS, SpeakUp, FaceUp y Whispli. Antes de activarla deben definirse proveedor, modelo, residencia, retención, entrenamiento, precisión, revisión humana, posibilidad de desactivación y trazabilidad. AIMS 360 puede gobernar estas funciones como sistemas o componentes de IA, conectando inventario, evaluación, monitorización e incidentes. Los datos de denuncias no deben utilizarse para entrenamiento o analítica agregada externa sin autorización específica y base jurídica suficiente.

## **9\. Recomendaciones de implementación**

### **Priorización por valor y complejidad**

La prioridad debe medirse por riesgo legal, dependencia arquitectónica y capacidad de desbloquear funciones posteriores. El canal mínimo viable debe incluir todo lo necesario para cumplir la Ley 2/2023, aunque algunas capacidades avanzadas se presten inicialmente mediante operación manual. No sería adecuado lanzar únicamente un formulario web sin diálogo, vencimientos, exportación y gobierno. Tampoco debe añadirse inteligencia artificial antes de cerrar anonimato, trazabilidad, retención y segregación.

**Tabla 7: Roadmap priorizado**

| Prioridad | Funcionalidad | Complejidad estimada | Valor aportado |
| ----- | ----- | ----- | ----- |
| P0 | Modelo de denuncia y caso, estados, decisiones y libro-registro. | Alta, porque condiciona relojes, integraciones, evidencia y retención. | Crítico: constituye el núcleo jurídico y operativo del canal. |
| P0 | Portal anónimo, buzón bidireccional, saneamiento de metadatos y credencial segura. | Alta por la separación de identidad, telemetría, notificaciones y recuperación de acceso. | Crítico: habilita anonimato real y seguimiento del caso. |
| P0 | Recepción verbal y presencial, inicialmente con alta manual y transcripción controlada. | Media en modalidad manual; alta si incluye IVR global y anonimización de voz. | Crítico para cobertura legal; alto para accesibilidad. |
| P0 | Relojes de siete días, tres meses, prórroga, reunión y retención. | Media si reutiliza `regulatory_clock`, aunque exige calendarios y excepciones. | Crítico para prevenir incumplimientos y acreditar diligencia. |
| P0 | RBAC por caso, segregación, recusación y rutas de sustitución. | Alta por la interacción entre organigrama, entidad, unidad y jerarquía. | Crítico para independencia, confidencialidad y validez de la investigación. |
| P0 | Repositorio WORM, sellos, hashes, legal hold, logs y exportación íntegra. | Alta por sus dependencias de archivo, identidad, claves y servicios de confianza. | Crítico para prueba, auditoría, remisión a autoridades y defensa procesal. |
| P0 | Retención diferenciada entre entrada, investigación, expediente posterior, anonimizado y libro-registro. | Alta por el borrado selectivo, las transferencias y el legal hold. | Crítico para cumplimiento RGPD y Ley 2/2023. |
| P1 | Integración con riesgos, controles, auditoría, acciones, políticas, terceros y AIMS 360\. | Alta por el desacoplamiento, la minimización y los estados independientes. | Muy alto: convierte el canal en parte del sistema GRC y evita silos. |
| P1 | Multi-entidad, multijurisdicción, multidioma y residencia regional. | Alta por reglas locales, autoridades, calendarios, accesos y transferencias. | Muy alto para grupos internacionales y entidades reguladas. |
| P1 | API, webhooks, SSO, SCIM, BI, RR. HH., SIEM y archivo. | Media-alta según madurez de la plataforma y conectores disponibles. | Alto para automatización, adopción y continuidad operativa. |
| P1 | Board Escalation Engine y reporting agregado. | Media si reutiliza reglas y reporting del GRC. | Alto para supervisión, diligencia del órgano y seguimiento de reincidencias. |
| P2 | IA para traducción, transcripción, resumen, categorización y patrones. | Alta por privacidad, calidad, sesgos, proveedores y gobernanza del modelo. | Medio-alto cuando exista suficiente volumen y diversidad lingüística. |
| P2 | Analítica de cultura, heatmaps, benchmarking y simulación de inspección. | Media una vez estructurados casos, riesgos y acciones. | Alto para madurez, pero no compensa ausencias P0. |

**Notas:** La complejidad es una estimación cualitativa de producto. Debe revisarse tras confirmar la arquitectura tecnológica, el significado de AMS, los servicios de identidad, el repositorio documental y la estrategia de construir o integrar una plataforma externa.

### **Estrategia de construcción e integración**

La primera liberación debe centrarse en un núcleo propio de gobierno y casos que preserve la integración profunda con GRC Compass. El producto puede integrar inicialmente servicios externos para formulario seguro, voz o telefonía, siempre que conserve el control sobre el modelo de caso, los relojes, las decisiones, la evidencia y la portabilidad. La contratación debe exigir ubicación de datos, subencargados, cifrado, claves, incidentes, continuidad, recuperación, reversibilidad y exportación no propietaria. La selección no debe basarse en el número de funciones, sino en pruebas de escenarios de anonimato, conflicto, plazos, retención, remisión y exportación.

La prueba de aceptación debe cubrir al menos una denuncia anónima, diálogo posterior, pérdida de credencial, comunicación verbal, revisión de transcripción, conflicto del Responsable, caso multientidad, acuse próximo a vencimiento, prórroga, remisión a Fiscalía, ejercicio de derechos y supresión. También debe comprobarse que el administrador no puede leer el caso ni alterar evidencias congeladas. La exportación debe incluir mensajes, adjuntos, audio, transcripciones, decisiones, logs, hashes, sellos y acuses. Cada escenario debe producir un paquete probatorio revisable por Legal, DPO, Compliance, Auditoría Interna y Seguridad.

## **Conclusión**

La oportunidad de producto consiste en transformar el canal de denuncias en la **puerta de entrada confidencial de señales de cumplimiento** para todo el ecosistema GRC. GRC Compass ya ofrece los objetos de destino necesarios —riesgos, controles, incidentes, auditoría, acciones, políticas, terceros y gobierno—, pero debe añadir una capa especializada de intake, anonimato, case management, investigación, relojes, segregación, retención y evidencia. El benchmark indica que la cobertura competitiva requiere diálogo anónimo, omnicanalidad, voz, multilingüismo, multi-entidad, auditoría, integraciones y analítica, aunque no todas estas capacidades necesitan entrar simultáneamente en la primera versión.

El criterio de lanzamiento debe ser inequívoco: no debe ponerse en producción como canal conforme a la Ley 2/2023 mientras no estén cerrados los elementos P0. El propio dictamen exige completar el canal interno, el expediente probatorio WORM, la segregación funcional y los controles de conflicto antes de utilizar el módulo como infraestructura de compliance. Tras ese cierre, la prioridad debe pasar a integración con GRC y AIMS 360, multi-entidad, voz avanzada, API y reporting de gobierno. La inteligencia artificial debe reservarse para una fase de madurez, con revisión humana, evaluación de impacto, trazabilidad y prohibición de entrenamiento no autorizado con datos de denuncias.

La decisión arquitectónica más importante es conservar un expediente confidencial raíz y generar subexpedientes autónomos por entidad, investigación y régimen. Este patrón permite reutilizar evidencias, pero evita que el cierre de una investigación interna o de una notificación arrastre obligaciones todavía abiertas. También permite que una misma denuncia alimente, de forma controlada, el mapa de riesgos, auditoría, acciones, terceros, RGPD, DORA, NIS2, compliance penal o AIMS 360\. Con este diseño, el canal deja de ser un buzón periférico y pasa a ser una infraestructura probatoria, regulatoria y de aprendizaje organizativo plenamente integrada.

# **Respuestas técnico-jurídicas sobre el canal de denuncias integrado en GRC Compass y AIMS 360**

La respuesta a las cinco preguntas es afirmativa con matices importantes: el diseño permite que una denuncia origine varios subexpedientes regulatorios autónomos; incorpora controles de anonimato por diseño; exige cerrar los controles legales y probatorios P0 antes de introducir inteligencia artificial; concluye que GRC Compass todavía no acredita cobertura íntegra de la Ley 2/2023 ni paridad con las mejores plataformas; y concibe los servicios de un Prestador Cualificado de Servicios de Confianza, o QTSP, como una capa probatoria transversal durante todo el ciclo de vida. No obstante, algunas conclusiones son propuestas de arquitectura y no funcionalidades actualmente acreditadas. También será necesaria una validación final frente al texto oficial español de la Ley 2/2023, el artículo 31 bis del Código Penal, la política corporativa del Sistema interno de información y las condiciones técnicas y contractuales de los proveedores seleccionados.

## **1\. Subexpedientes autónomos por régimen regulatorio**

### **Respuesta y alcance del modelo**

**Sí.** El diseño permite que una única denuncia o comunicación actúe como hecho raíz y genere simultáneamente varios subexpedientes jurídicos. El patrón expresamente documentado para AIMS 360 utiliza un `incident_root` y una tabla puente `incident_regime_case`, que materializa la tupla formada por entidad jurídica, incidente y régimen regulatorio. La finalidad no es duplicar el hecho, sino mantener una narración fáctica común y separar las obligaciones que nacen bajo el Reglamento de Inteligencia Artificial, el Reglamento General de Protección de Datos, DORA y, cuando proceda, NIS2.

El patrón es directamente aplicable al canal de denuncias. Una comunicación sobre una filtración producida por un sistema de IA que soporte una función financiera esencial podría abrir el expediente interno de whistleblowing, un subexpediente RGPD, un subexpediente DORA y un subexpediente del Reglamento de Inteligencia Artificial gestionado en AIMS 360\. Si los hechos sugieren una infracción penal, también debería abrirse un subexpediente de compliance penal con su propia decisión de investigación, remisión, archivo y seguimiento. Esta extensión a compliance penal es coherente con el diseño, aunque la especificación relacional detallada del documento se desarrolla expresamente para RIA, RGPD y DORA y no proporciona una tabla técnica completa para el expediente penal.

NIS2 requiere un tratamiento especialmente cuidadoso. DORA desplaza las disposiciones equivalentes de NIS2 respecto de las entidades financieras cubiertas por su ámbito, pero un mismo grupo puede incluir sociedades tecnológicas, holdings, centros de servicios compartidos u otras entidades sujetas a NIS2 y no a DORA. El motor debe decidir el perímetro por sociedad, actividad y servicio, no por la matriz del grupo, y debe documentar tanto la activación como la exclusión de cada régimen. En caso de duda inicial, el diseño debería mantener activos los relojes potencialmente aplicables hasta que Legal, CISO y las funciones competentes documenten la decisión de perímetro.

### **Autonomía de relojes y hechos generadores**

Cada subexpediente debe disponer de uno o varios objetos `regulatory_clock`. Este objeto registra el hecho generador, timestamp inicial, plazo legal, calendario, vencimiento, alertas, retrasos, excepciones y evidencia de cierre. El reloj se vincula exclusivamente al `case_id` del subexpediente y a la correspondiente notificación o decisión motivada de no notificar. Esta vinculación impide que una actuación realizada bajo un régimen cierre accidentalmente un plazo perteneciente a otro.

Los relojes son materialmente distintos. Bajo DORA, la notificación inicial debe presentarse dentro de cuatro horas desde la clasificación como incidente TIC grave y, como límite exterior, dentro de veinticuatro horas desde el conocimiento; después siguen un informe intermedio en setenta y dos horas y un informe final en un mes. Bajo el RGPD, la notificación a la autoridad de control debe realizarse, cuando sea posible, dentro de setenta y dos horas desde que el responsable tenga conocimiento de una violación de seguridad que entrañe riesgo, y la comunicación a los interesados se activa separadamente cuando existe alto riesgo. Bajo el Reglamento de Inteligencia Artificial, el plazo general del artículo 73 se vincula al establecimiento de causalidad o probabilidad razonable de causalidad y puede ser de quince días, dos días o diez días según la categoría de incidente.

NIS2 añade, para las entidades sujetas, una alerta temprana dentro de veinticuatro horas, una notificación dentro de setenta y dos horas, un informe intermedio a petición y un informe final en un mes. El expediente interno de la Ley 2/2023 mantiene a su vez sus propios relojes: acuse dentro de siete días naturales y plazo ordinario máximo de tres meses para las actuaciones y respuesta, con eventual ampliación por especial complejidad. El plazo del canal no sustituye ni suspende automáticamente los plazos regulatorios más breves que puedan nacer de los hechos denunciados.

### **Autoridades, responsables y acceso**

Cada `incident_regime_case` debe identificar la autoridad, el owner jurídico, la prioridad, el estado y el acto de cierre. El subexpediente RGPD se dirige a la autoridad de protección de datos competente y, cuando exista alto riesgo, puede generar comunicación a los interesados. El subexpediente DORA se dirige a la autoridad financiera sectorial y puede generar una comunicación lateral a clientes cuyos intereses financieros estén afectados. El subexpediente del Reglamento de Inteligencia Artificial se dirige a la autoridad de vigilancia del mercado del Estado miembro donde ocurrió el incidente.

La autonomía también debe alcanzar a los permisos. El modelo debe diferenciar lectura, escritura, investigación, aprobación, cierre, congelación y exportación según función, entidad y régimen. El DPO puede necesitar acceso al subexpediente RGPD sin convertirse por ello en investigador general de la denuncia; el CISO puede gestionar el incidente DORA sin acceder a la identidad del informante; y AIMS 360 puede recibir la evidencia necesaria sobre el sistema de IA sin replicar datos personales irrelevantes del expediente interno. Esta separación aplica los principios de necesidad de conocer, minimización, independencia y segregación funcional.

### **Evidencias comunes y cierres independientes**

Un artefacto probatorio puede alimentar varios subexpedientes sin duplicarse físicamente. Cada referencia debe conservar el alcance, la versión, el hash, la clasificación de confidencialidad y el uso concreto del artefacto en cada régimen. Una nueva versión de un informe forense no debe sobrescribir la versión que sirvió para una notificación anterior; la versión precedente debe permanecer en modo de solo lectura y conservar su sello temporal.

El cierre debe producirse exclusivamente mediante actos definidos para cada régimen. Un caso RGPD solo puede cerrarse cuando se ha notificado, se ha justificado el retraso o se ha documentado la ausencia de riesgo y, si existe alto riesgo, cuando se ha gestionado la comunicación a interesados o su excepción. Un caso DORA exige completar la secuencia inicial, intermedia y final, junto con cualquier retraso y comunicación a clientes aplicable. Un caso RIA exige el informe correspondiente o una decisión motivada de no aplicabilidad sustentada en el análisis causal.

La base de datos debe prohibir el cierre automático cruzado. El expediente raíz solo debe poder cerrarse cuando todos los subexpedientes asociados se encuentren cerrados, excluidos mediante decisión motivada o transferidos a remediación con responsable y plazo. La pantalla de cierre global puede consolidar estados, pero no sustituir ni modificar los expedientes regulatorios individuales. El mecanismo debe complementarse con reglas de integridad referencial, validaciones de transición, permisos específicos de cierre y una comprobación transaccional que rechace el cierre del raíz cuando exista cualquier obligación pendiente.

### **Límite de la conclusión**

La capacidad de generar subexpedientes es una **arquitectura propuesta**, no una funcionalidad demostrada como plenamente operativa en la versión auditada. El documento acredita el patrón con especial detalle para RIA, RGPD y DORA, mientras que su extensión a Ley 2/2023, NIS2 y compliance penal requiere completar reglas, autoridades, plantillas y actos de cierre específicos. La configuración española del canal debe validarse contra el Boletín Oficial del Estado y la política corporativa antes del despliegue.

## **2\. Anonimato técnico y prevención de reidentificación**

### **Controles incluidos en la arquitectura propuesta**

**Sí.** La arquitectura propuesta incorpora anonimato por diseño mediante saneamiento de metadatos, separación de identidad, reducción de telemetría, diálogo anónimo y credencial segura. No obstante, la documentación no acredita que GRC Compass tenga actualmente implementados todos esos controles. Deben considerarse requisitos P0 del canal, sometidos a pruebas técnicas de reidentificación y a due diligence del proveedor.

El primer control es la **no recopilación de identificadores técnicos innecesarios**. El frontend del informante no debe registrar IP, huella del dispositivo, geolocalización, cookies identificativas o analítica de terceros que permita enlazar la denuncia con una persona. Los logs de seguridad del portal anónimo deben configurarse de modo que no reconstruyan indirectamente aquello que la capa funcional declara anónimo. Esta regla debe coexistir con logs detallados para usuarios internos, pues la auditoría exige registrar actor, rol, entidad, acción, objeto, timestamp y justificación respecto de quienes gestionan el expediente. La separación entre ambos dominios evita aplicar al informante la telemetría que sí resulta necesaria para controlar a gestores y administradores.

El segundo control es el **saneamiento de metadatos**. Los documentos, imágenes, audio y transcripciones deben pasar por un proceso de limpieza que elimine autor, nombre de usuario, rutas locales, historial de edición, identificadores del dispositivo y otros metadatos no necesarios. Debe conservarse el original solo cuando exista una necesidad jurídica o probatoria documentada, en una zona de acceso reforzado y con cadena de custodia. Esta distinción es importante porque la eliminación indiscriminada podría destruir evidencia relevante, mientras que la conservación indiscriminada podría facilitar la reidentificación.

El tercer control es la **separación lógica y criptográfica de identidad, contenido y telemetría**. Cuando el informante se identifica, sus datos deben residir en un objeto o repositorio separado del relato, las evidencias y el expediente de investigación. La vinculación debería realizarse mediante un identificador seudónimo y no mediante campos nominativos replicados en cada módulo. La arquitectura general exige cifrado en tránsito y reposo, gestión separada y rotación de claves, separación entre custodio de claves y administrador y revisión posterior de accesos de emergencia. El acceso al objeto de identidad debe requerir un permiso más restrictivo que el acceso al contenido ordinario del caso.

El cuarto control es un **buzón anónimo bidireccional**. El informante debe poder recibir preguntas, presentar documentos y conocer el seguimiento sin revelar su identidad. El acceso debe realizarse mediante una credencial aleatoria de alta entropía que no dependa de correo corporativo, teléfono o autenticación empresarial. La recuperación de una credencial perdida constituye un punto de riesgo y debe diseñarse de forma que ni el proveedor ni el equipo interno puedan recuperar la identidad o apropiarse del buzón sin controles. La fuente trata precisamente la pérdida de credencial y su recuperación como una pregunta eliminatoria de RFP, lo que confirma que no existe una única solución técnica presumida.

El quinto control es el uso de **notificaciones neutras**. Cuando el informante facilite un correo o teléfono de aviso, la notificación no debe incluir el contenido del mensaje, la categoría del caso, el nombre de las personas afectadas ni enlaces que revelen información sensible. El contenido debe consultarse exclusivamente dentro del buzón seguro. Este enfoque reduce la exposición en servidores de correo, pantallas bloqueadas, registros de mensajería y dispositivos compartidos.

El sexto control es la **segregación interna por caso, categoría y entidad**. La fuente exige RBAC granular, MFA o SSO para usuarios internos, logs, necesidad de conocer y recusación por conflicto. La auditoría añade permisos separados de lectura, escritura, aprobación, cierre, congelación y exportación. También exige bloquear automáticamente a quienes pertenezcan a la unidad investigada, mantengan una relación jerárquica con el denunciado, hayan participado en la operación o resulten beneficiarios. Cada abstención, sustitución y override debe quedar registrado de forma inmutable.

El séptimo control afecta al **proveedor y sus subencargados**. El contrato debe definir qué datos puede conocer el proveedor, dónde residen datos, copias, logs y claves, qué accesos remotos existen y qué subencargados participan. Deben exigirse pruebas de penetración, respuesta a incidentes, RTO y RPO, exportación, reversibilidad, control de cuentas privilegiadas y trazabilidad de accesos delegados. Una arquitectura zero-knowledge o con cifrado controlado por el cliente reduce el riesgo de lectura por el proveedor, pero debe verificarse técnicamente y no aceptarse solo como declaración comercial.

### **Comparación con las soluciones líderes**

EQS IntegrityLine declara buzón seguro, ausencia de registro de IP, localización o datos de dispositivo y cifrado de extremo a extremo. Formalize declara una arquitectura zero-knowledge en la que los datos se cifran con una clave de la empresa y se descifran en el navegador, junto con eliminación de metadatos, MFA, permisos por caso y diálogo anónimo. Whispli declara Safe Inbox, ausencia de IP y device ID, borrado de metadatos y comunicación bidireccional cifrada. FaceUp declara no registrar IP, eliminar metadatos y proporcionar chat anónimo con cifrado de extremo a extremo.

NAVEX WhistleB aporta denuncia anónima, diálogo posterior y anonimización de voz en su IVR multilingüe. SpeakUp ofrece denuncia anónima bidireccional por web, aplicación y teléfono, junto con enrutamiento multinivel y estructuras multi-entidad. Estas referencias muestran que el estándar de mercado no se limita al formulario anónimo, sino que incorpora continuidad de comunicación, voz, segregación y controles sobre la información técnica.

Las principales brechas de GRC Compass son la falta de evidencia actual sobre ausencia de IP y fingerprint, limpieza automática de metadatos, separación de identidad, arquitectura zero-knowledge, buzón anónimo, recuperación segura de credenciales y anonimización de voz. Tampoco se acredita una prueba sistemática de reidentificación ni una restricción técnica que impida al proveedor acceder al contenido. GRC Compass sí dispone o proyecta capacidades generales útiles —cifrado, RBAC, logs, segregación, cadena de custodia y control de administradores—, pero deben especializarse y demostrarse para el contexto del canal.

### **Brechas y validaciones pendientes**

El término “anonimato” debe reservarse para los casos en los que la arquitectura evita razonablemente la identificación por la entidad y el proveedor. Cuando la identidad sea conocida por un grupo limitado, el diseño debe describirse como confidencialidad reforzada y no como anonimato. La evaluación final debe incluir una prueba adversarial de reidentificación a partir de IP, tiempos de acceso, idioma, voz, metadatos, organigrama, contenido y correlación con sistemas corporativos. La documentación no proporciona el resultado de esa prueba para GRC Compass, por lo que no permite concluir que el anonimato técnico esté actualmente garantizado.

## **3\. Cumplimiento legal y segregación funcional antes que inteligencia artificial**

### **Justificación jurídica**

La prioridad P0 responde a que el canal debe cumplir obligaciones jurídicas deterministas antes de añadir automatización probabilística. La auditoría exige completar el canal de la Ley 2/2023 con acuse, plazo de respuesta, prórroga, independencia, confidencialidad, anonimato, medidas frente a represalias y conflictos antes de activar el módulo de compliance penal. También exige un expediente WORM con identidad, versión, sello temporal, conflicto, legal hold y cadena de custodia antes de utilizar el módulo como evidencia de compliance defense. El lanzamiento sin estos controles puede producir incumplimiento directo aunque el sistema disponga de funciones avanzadas de clasificación o resumen.

La IA no puede corregir retroactivamente un acuse fuera de plazo, una identidad revelada, una evidencia sobrescrita o una investigación gestionada por una persona en conflicto. Los plazos, permisos, actos de cierre y reglas de retención deben estar codificados como controles verificables y versionados. Solo después de asegurar esa base puede la IA asistir sin convertirse en el mecanismo del que dependa el cumplimiento.

La Ley 2/2023 también exige gobierno humano. El Responsable del Sistema debe actuar con independencia y autonomía, y la externalización tecnológica no desplaza sus funciones decisorias. En el benchmark, SpeakUp mantiene expresamente la decisión investigadora en manos humanas aunque su IA traduzca, transcriba, categorice, enrute y detecte patrones. La automatización puede asistir al triage, pero no debería decidir por sí sola la falsedad, inadmisibilidad, credibilidad o archivo de una denuncia.

### **Justificación técnica**

El anonimato y la retención deben definirse antes de conectar un modelo de IA porque el modelo introduce nuevos flujos de datos, proveedores, logs, prompts, copias y posibles usos de entrenamiento. La fuente exige cerrar contractualmente el modelo, proveedor, residencia, retención y uso de datos para entrenamiento en soluciones como Sienna AI. Sin una arquitectura previa de minimización y separación, el modelo podría recibir identidades, categorías especiales o detalles innecesarios. También podría replicar esa información en telemetría o servicios de terceros fuera del repositorio controlado.

La trazabilidad debe preceder a la IA porque los resultados de un modelo solo son auditables si se registran versión, prompt o configuración, proveedor, inputs, output, validación humana y decisión final. El diseño de AIMS 360 exige identificar versión del modelo, API, datos, métricas, tests, límites de uso, aprobaciones, cambios, rollback, incidentes y acciones correctoras. Sin esos metadatos, el sistema podría almacenar resultados, pero no demostrar diligencia ni control durante el ciclo de vida. Un resumen o categoría generados por IA tampoco deben sobrescribir el relato original ni convertirse en la única versión disponible.

La segregación debe preceder a la IA porque una integración puede ampliar silenciosamente el perímetro de acceso. El sistema debe separar custodio de claves, administrador, investigador, aprobador y auditor, y debe impedir que administradores modifiquen evidencias congeladas. Si un asistente de IA opera con permisos excesivos, podría exponer datos entre casos, entidades o clientes. Esta consecuencia sería especialmente grave en una arquitectura multiempresa o en investigaciones sobre alta dirección.

### **Justificación de gobierno y riesgos de invertir la secuencia**

Invertir el orden generaría riesgo de **filtración y reidentificación**. El documento de AIMS 360 trata las fugas de información personal en modelos de lenguaje como incidentes de datos y potencialmente como incidentes TIC, capaces de activar el análisis RGPD y una eventual notificación en setenta y dos horas. En el contexto de denuncias, una fuga puede revelar la identidad del informante, las personas afectadas, la estrategia de investigación o evidencia penal. El perjuicio no se limita a privacidad, pues también puede frustrar la investigación y aumentar el riesgo de represalias.

También surgiría riesgo de **clasificación errónea o alucinación**. La documentación contempla que una recomendación errónea de un modelo puede producir impacto financiero y activar análisis bajo RIA, DORA, riesgo conductual o reclamaciones. En whistleblowing, un error de clasificación podría enviar el caso a la unidad investigada, desactivar un reloj, omitir una autoridad o reducir indebidamente la severidad. Sin revisión humana y trazabilidad, el error sería difícil de detectar y explicar.

Un tercer riesgo es la **discriminación o sesgo**. AIMS 360 exige conservar hipótesis, datos, variables proxy, métricas de equidad, decisiones de mitigación y aceptación de riesgo residual cuando se detecten desviaciones significativas. Un sistema de priorización entrenado sobre casos históricos podría infravalorar denuncias formuladas en determinados idiomas, por ciertos colectivos o sobre materias poco frecuentes. La gobernanza de IA debe, por tanto, incorporarse antes de usar puntuaciones para priorizar investigaciones.

Un cuarto riesgo es la **pérdida de integridad probatoria**. Si el sistema permite que una categoría o resumen generado por IA reemplace el contenido original, no podrá reconstruirse qué información recibió la organización, qué sabía en cada momento y quién adoptó la decisión. El modelo append-only, el versionado y el sellado temporal deben existir antes de introducir transformaciones automáticas.

Un quinto riesgo es la **dependencia contractual no controlada**. Un proveedor de IA puede constituir simultáneamente parte de la cadena de suministro de IA y proveedor tercero TIC sujeto al registro DORA, análisis de concentración, subcontratación, recuperación y salida. La organización debe conocer ubicación, subencargados, acceso a datos, transferibilidad e impacto de insolvencia antes de procesar denuncias. Introducir IA sin esa diligencia convertiría una mejora funcional en un nuevo riesgo regulatorio y operacional.

### **Secuencia recomendada**

La secuencia correcta es cerrar primero el intake legal, anonimato, buzón, relojes, permisos, conflictos, retención, evidencia y exportación. Después deben implantarse integraciones multi-entidad, API, BI y automatización determinista. Solo entonces debe añadirse IA para transcripción, traducción, resumen, categorización o detección de patrones, con revisión humana, desactivación, evaluación de impacto y trazabilidad de modelo.

La documentación no afirma que toda IA sea jurídicamente incompatible con una fase inicial. Sí sostiene que no debe utilizarse para compensar brechas P0 ni desplegarse sin gobernanza, privacidad, seguridad y control humano. Una función aislada de transcripción podría pilotarse antes, pero únicamente si opera dentro del perímetro aprobado, no entrena con los datos, conserva el audio original y queda sometida a validación humana.

## **4\. Brechas de GRC Compass respecto de la Ley 2/2023 y del mercado**

### **Evaluación de suficiencia**

Los documentos **sí evalúan la suficiencia y concluyen que las capacidades actuales no permiten acreditar cumplimiento íntegro**. GRC Compass cubre los grandes dominios de un sistema moderno de gobierno, riesgo y cumplimiento, pero mantiene brechas P0 en plazos, comunicaciones, perímetros regulatorios, gobierno, prueba del modelo de compliance y canal interno. La mención al canal ético dentro del mapa de compliance penal no equivale a una implementación completa de la Ley 2/2023.

Las capacidades existentes son aprovechables. GRC Compass dispone de matrices de riesgos y controles, tres líneas de defensa, obligaciones y políticas, KRIs, incidentes regulatorios, auditoría, planes de remediación, privacidad, terceros, excepciones y una cadena de custodia basada en SHA-512. Estas piezas reducen el esfuerzo de integración, pero no cubren por sí solas intake anónimo, diálogo con el informante, voz, triage, investigación especializada, protección frente a represalias o reglas de retención del canal.

### **Brechas P0 bajo la Ley 2/2023**

La primera brecha P0 es el **ciclo jurídico completo del canal**. Deben incorporarse acuse en siete días naturales, plazo ordinario de tres meses, eventual prórroga, gestor independiente, conflicto de interés, protección frente a represalias, anonimato o confidencialidad, acceso restringido y decisión motivada de archivo, investigación o escalado. La auditoría indica que esta configuración debe cerrarse antes de activar el módulo de compliance penal. También advierte que el cómputo de siete días naturales debe validarse contra el derecho nacional y la política corporativa antes del despliegue.

La segunda brecha es la **recepción escrita y verbal integrada**. La cobertura mínima requiere formulario web y capacidad para incorporar teléfono, voz y reunión presencial al mismo expediente, con consentimiento, transcripción o grabación y custodia. No se acredita que GRC Compass disponga actualmente de telefonía, IVR, voz anonimizada o alta manual específica para reuniones. La carencia lo sitúa por debajo de NAVEX, SpeakUp, FaceUp, Whispli y Formalize en omnicanalidad.

La tercera brecha es el **anonimato técnico y diálogo bidireccional**. El estándar funcional exige no registrar IP o huella del dispositivo, eliminar metadatos, proporcionar credencial segura y mantener un buzón para preguntas y documentos. La documentación de GRC Compass no acredita esas capacidades. EQS, Formalize, FaceUp y Whispli sí publican controles específicos de no registro de identificadores, eliminación de metadatos, Safe Inbox o cifrado de extremo a extremo.

La cuarta brecha es la **segregación funcional bloqueante**. No basta disponer de perfiles generales; el sistema debe impedir técnicamente que quien solicita, ejecuta o gestiona una actuación apruebe o cierre su propio trabajo. También debe bloquear conflictos por unidad, jerarquía, participación previa o beneficio. Las plataformas líderes incluyen permisos por caso, reglas de enrutamiento, jerarquías y administración multi-entidad, aunque su correspondencia exacta con el modelo español debe verificarse en una prueba de escenarios.

La quinta brecha es la **cadena probatoria**. El hash SHA-512 constituye un control de integridad, pero no acredita por sí solo autoría, fecha, contexto, versión ni custodia entre sistemas. La auditoría exige WORM o append-only, sello temporal, identificación del actor, firmas o sellos cuando proceda, legal hold, control de acceso y registro de creación, descarga, exportación, restauración y transferencia. Esta brecha está calificada como P0 antes de utilizar el módulo como defensa probatoria de compliance.

La sexta brecha es la **retención diferenciada**. La Ley 2/2023 exige distinguir entre el buzón de entrada, la investigación, el expediente laboral o jurídico, la evidencia anonimizada y el libro-registro. Los datos deben suprimirse del sistema de entrada después de tres meses en los términos legales, salvo conservación anonimizada, mientras que el expediente de investigación puede continuar en otro repositorio y el libro-registro tiene un límite máximo de diez años para datos personales. GRC Compass dispone de conceptos generales de retención y legal hold, pero no acredita la separación completa de estos repositorios específicos del canal.

La séptima brecha es la **exportación íntegra y portabilidad**. El estándar exige exportar mensajes, adjuntos, grabaciones, transcripciones, logs, hashes, decisiones y cronología en formato legible y reutilizable. Esta función es necesaria para remisión a Fiscalía, inspecciones, cambios de proveedor y ejercicio de derechos. La documentación no acredita una exportación específica del libro-registro y del expediente de denuncia con ese alcance.

### **Diferencias frente a las plataformas líderes**

EQS presenta buzón seguro, no registro de IP, localización o dispositivo, cifrado de extremo a extremo, workflows, hitos, auditoría, monitorización de plazos, traducción y más de ochenta idiomas. GRC Compass no acredita actualmente buzón, anonimato técnico, traducción o un case management especializado equivalente. El canal telefónico y SSO de EQS pueden ser módulos adicionales, por lo que la comparación debe realizarse contra el paquete concreto y no contra la marca en abstracto.

NAVEX WhistleB incorpora anonimato, diálogo, acuse automático, recordatorios, pasos de workflow y registro de comunicaciones telefónicas o presenciales. Su oferta añade portales en más de sesenta idiomas, IVR en cuarenta y anonimización de voz. GRC Compass no acredita voz, IVR, anonimización de voz o esa escala multilingüe. Los costes y el alcance de los módulos de telefonía deben validarse contractualmente.

SpeakUp ofrece denuncia bidireccional, workflows de investigación, enrutamiento multinivel, tareas, vencimientos, multi-entidad y supervisión centralizada. También dispone de web, aplicación, teléfono, más de cien idiomas e integraciones con SharePoint, Power BI y SSO/SAML. GRC Compass dispone de piezas generales de auditoría y acciones, pero no acredita estas interfaces y workflows específicos del informante. La IA de SpeakUp requiere cerrar contractualmente modelo, residencia, entrenamiento y controles de revisión.

Formalize ofrece cifrado extremo a extremo, arquitectura declarada zero-knowledge, eliminación de metadatos, MFA, permisos por caso, trazabilidad y diálogo bidireccional. También incorpora voz con distorsión y una consola multi-cliente. Estas capacidades superan la evidencia disponible sobre el anonimato técnico de GRC Compass, aunque Formalize debe demostrar la automatización exacta de plazos, retención y custodia de claves.

Whispli aporta Safe Inbox, ausencia de IP y device ID, borrado de metadatos, comunicación bidireccional, workflows configurables, más de setenta idiomas, Voice AI, API y hosting regional. FaceUp añade ciento trece idiomas, voz, líneas telefónicas, transcripción, investigación, fechas límite, API, webhooks e integraciones con herramientas de BI, RR. HH. y colaboración. GRC Compass no acredita actualmente una cobertura comparable en voz, idiomas, integraciones o experiencia del informante.

### **Conclusión sobre suficiencia**

GRC Compass ofrece una base GRC más profunda que muchas soluciones independientes de canal, pero no alcanza todavía su especialización en experiencia del informante, anonimato, recepción verbal, case management, idiomas e integraciones. La estrategia adecuada consiste en conservar el núcleo corporativo de riesgos, evidencias y gobierno y añadir o integrar una capa especializada de whistleblowing. La aceptación debe basarse en escenarios reales de anonimato, diálogo, conflicto, vencimientos, multientidad, retención, Fiscalía, derechos y exportación. Ninguna funcionalidad debe darse por existente por aparecer en material comercial o en una descripción de alto nivel.

## **5\. Integración de servicios QTSP durante el ciclo de vida**

### **Función jurídica de la capa QTSP**

Los servicios QTSP deben implantarse como una **capa transversal de evidencia**, no como una función aislada utilizada únicamente al firmar el cierre. El marco eIDAS consolidado, formado por el Reglamento (UE) 910/2014 modificado por el Reglamento (UE) 2024/1183, reconoce servicios cualificados con efectos probatorios reforzados. Las firmas, sellos, sellos de tiempo, servicios de entrega electrónica certificada y documentos electrónicos no pueden ser discriminados en cuanto a efectos jurídicos o admisibilidad por estar en formato electrónico. Estos servicios refuerzan la prueba, pero no sustituyen el cumplimiento material de la Ley 2/2023, RGPD, DORA, NIS2, Solvencia II o el Reglamento de Inteligencia Artificial.

### **Recepción y apertura**

En la recepción debe generarse un hash sobre la comunicación y sus metadatos esenciales y debe registrarse de forma inmutable la fecha de entrada, canal, entidad, tipo de comunicación y evidencia de apertura. El sello de tiempo cualificado debe aplicarse cuando sea necesario probar de forma reforzada el momento exacto en que la organización recibió o conoció los hechos. Este sello disfruta de presunción de exactitud de fecha y hora y de integridad de los datos vinculados. Debe basarse en una fuente temporal vinculada al Tiempo Universal Coordinado y estar firmado o sellado por el prestador cualificado o mediante un método equivalente.

No es necesario remitir cada interacción ordinaria al QTSP en tiempo real. Deben sellarse, como mínimo, los hitos que activan obligaciones o que puedan ser controvertidos: recepción, conocimiento por la entidad, clasificación, cambio de severidad, apertura de investigación y creación de un subexpediente regulatorio. En una denuncia que revele un incidente DORA, resulta esencial distinguir y sellar separadamente la hora de conocimiento y la hora de clasificación.

### **Investigación y versionado**

Durante la investigación debe distinguirse entre evidencia viva y evidencia congelada. La evidencia viva comprende borradores, comunicaciones internas, workpapers y estados sujetos a cambio; la congelada comprende decisiones, informes forenses, matrices de clasificación, notificaciones, acuses y cierres. Los borradores no necesitan necesariamente una firma cualificada, pero todos sus cambios relevantes deben quedar registrados. Cada hito probatorio debe producir una versión de solo lectura, vinculada a su fuente, autor, fecha, política, obligación, hash y sello temporal.

El sello de tiempo cualificado debe aplicarse a la clasificación, congelación de evidencia forense, informe intermedio, informe final y decisión de comunicar o no a interesados. El sello electrónico cualificado debe utilizarse cuando el artefacto sea emitido por la persona jurídica o por el sistema corporativo, como un snapshot del expediente, un paquete probatorio, un informe institucional o un registro exportado. Este sello disfruta de presunción de integridad y de corrección del origen de los datos vinculados.

La firma electrónica cualificada debe reservarse para decisiones personales que requieran atribución fuerte. Tiene efecto jurídico equivalente a una firma manuscrita y puede ser adecuada para la aprobación de un informe final, una decisión de cierre de investigación, una aceptación de riesgo residual o un sign-off del DPO. La firma debe vincularse a la versión concreta, el rol corporativo, la delegación vigente y el reloj activo; de otro modo, una firma técnicamente válida podría quedar desconectada del contexto jurídico de la decisión. El sello de entidad no debe sustituir la firma personal cuando una norma o política interna exija responsabilidad individual.

### **Notificaciones y entrega certificada**

La entrega electrónica certificada cualificada debe utilizarse cuando resulte importante probar remitente, destinatario, contenido, envío, recepción y momento. Los datos enviados y recibidos mediante este servicio disfrutan de presunción de integridad, envío por remitente identificado, recepción por destinatario identificado y exactitud de las fechas y horas de envío y recepción. Su uso es especialmente adecuado para comunicaciones P0 a autoridades, clientes, interesados, órganos de gobierno, proveedores críticos, auditores o asesores.

En el canal de denuncias, la entrega certificada no debe utilizarse de forma que comprometa el anonimato. La comunicación ordinaria con un informante anónimo debe permanecer dentro del buzón seguro. Cuando exista una dirección de contacto, cualquier canal certificado debe evaluarse frente al riesgo de revelar identidad, contenido o participación en el proceso. Esta cautela deriva del deber de confidencialidad y de la excepción al acuse cuando este pueda ponerla en peligro. Por ello, la entrega certificada debe aplicarse principalmente a comunicaciones institucionales o a informantes identificados cuando sea legalmente apropiado y seguro.

### **Decisión, cierre y cierre coordinado**

En el cierre debe generarse un paquete probatorio con el relato de hechos, actuaciones, evidencias, decisiones, comunicaciones, reloj, justificación, aprobaciones, conflictos y resultado. El paquete debe recibir hash sobre contenido y metadatos, sello de tiempo cualificado, sello de entidad y, cuando corresponda, firma cualificada del responsable de la decisión. Debe almacenarse en WORM o repositorio append-only y quedar sujeto a permisos de solo lectura.

El uso de QTSP no modifica la autonomía de los subexpedientes. Cada notificación, acuse y cierre debe quedar sellado o archivado dentro del subexpediente correspondiente. Un sello sobre el informe final DORA no prueba el cierre del subexpediente RGPD ni del caso interno de la Ley 2/2023. El cierre global solo debe sellarse cuando el sistema haya comprobado que todos los expedientes asociados están cerrados, excluidos motivadamente o transferidos a remediación.

### **Retención, archivo y exportación**

El archivo electrónico cualificado debe actuar como repositorio probatorio de largo plazo para evidencias cerradas, no como repositorio de trabajo de los borradores activos. Los datos y documentos conservados mediante un servicio cualificado disfrutan de presunción de integridad y origen durante el período de conservación por el prestador. Esta función resulta adecuada para expedientes cerrados de compliance penal, brechas RGPD, incidentes graves, decisiones de órganos, legal holds y paquetes regulatorios.

El archivo cualificado debe garantizar durabilidad, legibilidad, protección contra pérdida o alteración e informes automatizados de integridad para las partes autorizadas. El informe de recuperación debe llevar firma o sello cualificado del prestador. Si el expediente contiene firmas o sellos cualificados previos, el servicio debe extender su fiabilidad durante el período de conservación mediante procedimientos adecuados de preservación o re-sellado. El Reglamento de Ejecución (UE) 2025/2532 proporciona las especificaciones que deben comprobarse para la presunción de conformidad del servicio de archivo.

La exportación debe conservar documentos, metadatos, manifiesto de hashes, sellos, certificados, acuses y cadena de custodia. El sistema debe poder verificar el paquete fuera de la plataforma y producir evidencia legible para autoridad, auditor o tribunal. Esta capacidad es coherente con la exigencia de exportar adjuntos, audio, transcripciones, mensajes, logs y hashes en formato reutilizable. También debe existir un procedimiento de migración que mantenga la validez de firmas, sellos y archivo cuando se cambie de proveedor.

### **Límites probatorios**

El QTSP refuerza integridad, origen, fecha, envío, recepción y conservación, pero no prueba la veracidad material de una denuncia ni la corrección jurídica de la decisión adoptada. La presunción de archivo es de integridad y origen, no de completitud, exactitud factual o actualización. Un expediente puede estar íntegro y, aun así, ser incompleto, contener una clasificación errónea o reflejar una versión obsoleta.

La presunción comienza cuando los datos se depositan en el archivo cualificado, no cuando se generaron. El intervalo anterior debe cubrirse con sellos de tiempo cualificados y logs inmutables. La presunción también depende de la continuidad y cualificación del prestador y del período contratado. El contrato debe prever pérdida de cualificación, cese, migración, exportación y preservación de la verificabilidad.

### **Requisitos contractuales y validación pendiente**

El contrato debe identificar la cualificación vigente del prestador, alcance de cada servicio, ubicaciones, subcontratistas, acceso remoto, medidas de seguridad y tratamiento de datos. También debe cubrir niveles de servicio, notificación de incidentes, continuidad, recuperación, reversibilidad, formatos de devolución, auditoría, cooperación supervisora y estrategia de salida. Para servicios que sustenten funciones esenciales o importantes, la ausencia de garantías adecuadas debe tratarse como P0.

La documentación no proporciona un clausulado contractual autónomo y exhaustivo específicamente diseñado para QTSP. Los requisitos anteriores se derivan de las secciones sobre eIDAS, archivo cualificado, DORA, Solvencia II y contratación de terceros TIC. En consecuencia, antes del despliegue debe prepararse una matriz contractual específica que cubra responsabilidad, cualificación, conservación, re-sellado, insolvencia, subcontratación, localización, acceso de autoridades, portabilidad y terminación. La suficiencia final dependerá del servicio concreto y de que su alcance figure efectivamente en las listas de confianza aplicables.

## **Conclusión**

El diseño propuesto es jurídicamente coherente porque separa el hecho común de las obligaciones que ese hecho puede activar. El expediente raíz conserva una narración y un índice de evidencias comunes, mientras cada subexpediente mantiene su propia entidad, autoridad, owner, acceso, reloj, notificación y cierre. La prohibición de cierre cruzado, el versionado de evidencias y la comprobación previa al cierre global son controles centrales, no detalles de implementación.

El anonimato exige controles técnicos verificables y no una simple clasificación del caso como “anónimo”. La arquitectura debe evitar identificadores técnicos, sanear metadatos, separar identidad y contenido, limitar al proveedor, ofrecer un buzón seguro y aplicar permisos granulares con recusación. Estas capacidades están presentes en diverso grado en EQS, Formalize, Whispli, FaceUp, NAVEX y SpeakUp, pero no se encuentran plenamente acreditadas en GRC Compass.

El orden P0 antes que IA es necesario porque la automatización no puede remediar plazos incumplidos, conflictos, reidentificación, conservación indebida o pérdida de evidencia. La IA solo debe incorporarse después como capacidad asistencial, bajo inventario, evaluación, supervisión humana, trazabilidad y control contractual.

Finalmente, la capa QTSP debe comenzar en los hitos iniciales de recepción y conocimiento, acompañar las decisiones y comunicaciones críticas, consolidarse en cada cierre y continuar durante la retención y exportación. Su valor reside en reforzar fecha, integridad, origen, envío, recepción y preservación, pero no sustituye el juicio jurídico, la investigación, la completitud documental ni el cumplimiento material. El lanzamiento debería condicionarse a una validación española final, pruebas de reidentificación y cierre, y una due diligence técnica y contractual de los proveedores RegTech y QTSP.

La arquitectura propuesta es conceptualmente sólida: separa el hecho denunciado de las obligaciones jurídicas que este puede activar, incorpora anonimato por diseño, condiciona el uso de inteligencia artificial al cierre previo de los controles P0 y utiliza los servicios QTSP como una capa transversal de refuerzo probatorio. Sin embargo, buena parte de esas capacidades representan todavía el **estado objetivo del diseño**, no funcionalidades plenamente acreditadas en la versión actual de GRC Compass.

## **1\. Autonomía de los subexpedientes regulatorios**

### **Mecanismo arquitectónico**

La autonomía se articula mediante un **expediente raíz único** —`incident_root`— y una tabla puente —`incident_regime_case`— que crea una instancia independiente para cada combinación de entidad jurídica, incidente y régimen regulatorio. El expediente raíz conserva la narración fáctica común, la fecha de detección, el conocimiento por cada entidad, los sistemas y datos afectados, la severidad inicial y las evidencias compartidas. Cada subexpediente conserva separadamente el fundamento de activación o exclusión, owner jurídico, autoridad, prioridad, estado y evidencia de cierre.

Este modelo permite que una denuncia genere simultáneamente:

* un expediente interno sujeto a la Ley 2/2023;  
* un subexpediente RGPD si revela una violación de seguridad de datos personales;  
* un subexpediente DORA si afecta a sistemas o servicios TIC de una entidad financiera;  
* un subexpediente NIS2 si afecta a una entidad o actividad comprendida en esa Directiva y no desplazada por DORA;  
* un expediente de compliance penal si existen indicios de infracción penal; y  
* un subexpediente en AIMS 360 si los hechos afectan a un sistema de inteligencia artificial.

### **Relojes y hechos generadores independientes**

Cada subexpediente tiene uno o varios objetos `regulatory_clock`, asociados exclusivamente a su `case_id`. Cada reloj registra hecho generador, inicio, plazo, calendario, vencimiento, alertas, retrasos, excepciones y acto de cierre. Esto evita utilizar una fecha genérica del incidente para obligaciones cuyo cómputo comienza en momentos jurídicamente distintos.

Así, DORA distingue el conocimiento del incidente de su clasificación como grave y exige una notificación inicial dentro de cuatro horas desde la clasificación y, como máximo, veinticuatro horas desde el conocimiento; después siguen el informe intermedio y el final. El RGPD activa su plazo de setenta y dos horas cuando el responsable conoce una brecha de datos personales que entraña riesgo. El Reglamento de Inteligencia Artificial vincula la notificación al establecimiento del nexo causal o de una probabilidad razonable de causalidad y establece plazos propios. NIS2 contempla una alerta temprana en veinticuatro horas, notificación en setenta y dos horas e informe final posterior para las entidades sujetas.

El expediente de la Ley 2/2023 conserva, por su parte, el reloj de acuse de siete días naturales y el plazo ordinario de tres meses para las actuaciones y la respuesta, sin que esos plazos desactiven obligaciones regulatorias más breves.

### **Autoridades, accesos y cierres**

Cada subexpediente identifica inequívocamente su autoridad y sus destinatarios. El expediente RGPD se relaciona con la autoridad de control y, si existe alto riesgo, con los interesados; DORA se relaciona con la autoridad financiera y, en ciertos supuestos, con los clientes afectados; el expediente de IA se dirige a la autoridad de vigilancia del mercado. Un acuse de la autoridad financiera no puede considerarse prueba de cumplimiento ante la autoridad de protección de datos.

Los accesos deben segregarse por entidad, caso, dato, función y régimen. El DPO puede intervenir en el subexpediente RGPD sin acceder automáticamente a todo el contenido laboral o penal; el CISO puede gestionar DORA sin conocer la identidad del informante; y AIMS 360 debe recibir únicamente la información necesaria sobre el sistema de IA. Los permisos de lectura, edición, aprobación, cierre, congelación y exportación deben asignarse separadamente.

El cierre se produce mediante un acto específico para cada régimen. El expediente RGPD exige notificación, decisión motivada de no notificar y, cuando corresponda, comunicación a interesados; el expediente DORA requiere completar sus informes y comunicaciones; y el expediente RIA exige el informe aplicable o una decisión motivada de no aplicabilidad. La base de datos debe impedir expresamente que el cierre de un subexpediente arrastre a los demás.

El incidente raíz solo puede cerrarse cuando todos los subexpedientes estén cerrados, excluidos mediante decisión motivada o transferidos a remediación con owner y plazo. El cierre global es una vista consolidada y no sustituye los actos de cierre individuales.

### **Evidencia compartida sin pérdida de autonomía**

Un informe forense puede relacionarse con varios subexpedientes sin duplicación física, pero cada referencia debe conservar alcance, versión, hash, confidencialidad y finalidad propias. Las actualizaciones deben generar nuevas versiones; las anteriores permanecen en solo lectura, preservando la “fotografía” de la información disponible cuando se tomó cada decisión o se remitió cada notificación.

### **Limitaciones actuales**

La principal limitación es que este modelo constituye una **arquitectura recomendada**, no una implementación completamente demostrada. La documentación desarrolla con precisión RIA, RGPD y DORA, pero no proporciona el mismo nivel de detalle para el expediente de la Ley 2/2023, compliance penal o NIS2. Para estos últimos deben completarse catálogos de estados, autoridades, plantillas, roles y actos de cierre.

Tampoco está acreditado que GRC Compass disponga actualmente de:

* reglas de integridad referencial que prohíban el cierre cruzado;  
* una comprobación transaccional previa al cierre global;  
* permisos plenamente segregados por subexpediente;  
* una interfaz consolidada de relojes paralelos;  
* versionado inmutable de todas las referencias cruzadas; o  
* un motor completo de perímetro DORA/NIS2 por entidad, actividad y servicio.

El motor DORA/NIS2 es especialmente crítico porque un grupo puede contener simultáneamente entidades sujetas a DORA, entidades sujetas a NIS2 y entidades fuera de ambos regímenes. Mientras ese motor no se complete, la autonomía formal de los expedientes no garantiza por sí sola que se abra el subexpediente correcto.

## **2\. Anonimato técnico propuesto frente a las capacidades acreditadas**

### **Controles previstos en la arquitectura objetivo**

La arquitectura propuesta no trata el anonimato como un simple campo del caso, sino como una propiedad técnica del canal. El estándar objetivo incluye ausencia de registro de IP, huella del dispositivo y cookies identificativas; saneamiento de metadatos; credencial segura; diálogo bidireccional; y pruebas de reidentificación.

Los controles recomendados son los siguientes:

1. **Portal separado del IAM corporativo.** El informante anónimo no debe autenticarse mediante credenciales de empleado ni quedar correlacionado con directorios, SSO o registros internos.

2. **Minimización de telemetría.** La interfaz no debe recopilar IP, geolocalización, device fingerprint, identificadores publicitarios ni analítica de terceros.

3. **Saneamiento de adjuntos.** Deben eliminarse autor, usuario, rutas locales, dispositivo, historial de edición y otros metadatos capaces de revelar la identidad.

4. **Separación de identidad y contenido.** Cuando el informante decida identificarse, sus datos deben almacenarse en un objeto cifrado distinto del relato y de la investigación, vinculado mediante un identificador seudónimo.

5. **Buzón bidireccional anónimo.** El informante debe poder responder preguntas, aportar documentos y recibir información sin facilitar correo, teléfono o nombre.

6. **Credencial segura.** El acceso al buzón debe emplear un token aleatorio independiente de la identidad. La recuperación por pérdida de credencial debe diseñarse sin permitir al proveedor o a usuarios internos apropiarse del buzón o deducir la identidad.

7. **Notificaciones neutras.** Cuando exista un correo o teléfono voluntario, los avisos no deben incluir contenido, categoría, personas afectadas ni otra información sensible.

8. **Cifrado y separación de claves.** Deben existir cifrado en tránsito y reposo, rotación de claves y separación entre custodio de claves y administrador de plataforma.

9. **Acceso interno granular.** El RBAC debe operar por caso, entidad, categoría y dato, con MFA, privilegio mínimo, revisiones periódicas y logs inmutables.

10. **Recusación y prevención de conflictos.** El sistema debe bloquear al investigador o aprobador relacionado con la unidad, persona u operación investigada y registrar abstención, sustitución y fundamento.

11. **Restricción de acceso del proveedor.** El contrato debe definir qué puede conocer el proveedor, quién custodia las claves, qué subencargados participan, dónde residen los datos y cómo se trazan los accesos privilegiados.

12. **Pruebas adversariales de reidentificación.** Debe intentarse correlacionar horarios, contenido, idioma, voz, organigrama, metadatos y telemetría para verificar que el anonimato no sea meramente formal.

### **Capacidades actualmente acreditadas en GRC Compass**

GRC Compass acredita o proyecta controles generales de RBAC, MFA, privilegio mínimo, gestión de cuentas privilegiadas, cifrado, segregación de claves, logs y cadena de custodia. También establece que los administradores no deben alterar evidencias congeladas y que deben registrarse accesos delegados o por suplantación. Estas capacidades son necesarias, pero se centran principalmente en controlar a los usuarios internos y administradores, no en impedir la identificación técnica del informante.

La documentación no acredita actualmente que GRC Compass disponga de:

* portal anónimo separado;  
* ausencia de registro de IP o dispositivo;  
* eliminación automática de cookies o telemetría;  
* limpieza de metadatos;  
* repositorio separado de identidad;  
* buzón anónimo bidireccional;  
* credencial segura y mecanismo de recuperación;  
* arquitectura zero-knowledge;  
* anonimización de voz;  
* pruebas de reidentificación; o  
* imposibilidad técnica de lectura por el proveedor.

Por tanto, existe una diferencia esencial entre **controles internos de acceso** y **anonimato técnico frente a la plataforma**. GRC Compass dispone de una base relevante para lo primero, pero no demuestra todavía lo segundo.

### **Distancia respecto del mercado**

EQS declara buzón seguro, ausencia de IP, localización y datos de dispositivo, además de cifrado de extremo a extremo. Formalize declara zero-knowledge, cifrado con clave de la empresa, descifrado en navegador, eliminación de metadatos y permisos por caso. Whispli declara Safe Inbox, ausencia de IP y device ID y borrado de metadatos. FaceUp declara chat anónimo, no registro de IP, eliminación de metadatos y cifrado de extremo a extremo. NAVEX añade anonimización de voz en el IVR.

GRC Compass se encuentra, por tanto, por debajo del estándar público de esos proveedores en anonimato del frontend y comunicación protegida. La afirmación debe matizarse: las capacidades de los proveedores son declaraciones públicas que necesitan validación mediante arquitectura, contrato, pruebas de penetración y escenarios de reidentificación. Tampoco debe presumirse que todas estén incluidas en los paquetes básicos.

## **3\. Necesidad de cerrar los controles P0 antes de introducir IA**

### **Razón jurídica**

Los controles P0 materializan obligaciones legales directas: recepción adecuada, acuse, investigación, independencia, protección frente a represalias, confidencialidad, retención, trazabilidad y gestión de conflictos. La auditoría recomienda no activar el módulo de compliance penal sin completar el canal de la Ley 2/2023 y no utilizarlo como evidencia de compliance defense sin un expediente WORM completo. También desaconseja el lanzamiento para entidades aseguradoras supervisadas mientras permanezcan abiertas las brechas P0.

La IA no puede subsanar retroactivamente:

* un acuse enviado fuera de plazo;  
* una identidad indebidamente revelada;  
* un expediente cerrado por una persona en conflicto;  
* una evidencia sobrescrita;  
* una retención excesiva;  
* una comunicación remitida a la autoridad equivocada; o  
* una decisión no documentada.

Por eso, las reglas jurídicas deterministas deben codificarse y probarse antes de introducir componentes probabilísticos.

### **Razón técnica**

La IA amplía el perímetro de tratamiento. Puede introducir nuevos proveedores, APIs, logs, prompts, copias de datos, subencargados, ubicaciones y usos de entrenamiento. La fuente comparativa exige determinar modelo, proveedor, residencia, base jurídica, retención, entrenamiento, revisión humana, desactivación y trazabilidad antes de activar estas funciones.

Sin anonimato y minimización previamente implantados, el modelo podría recibir o memorizar la identidad del informante, categorías especiales, datos laborales o información penal innecesaria. Las fugas de información personal en modelos de lenguaje pueden constituir incidentes de datos y, potencialmente, incidentes TIC. El uso de IA antes de definir la separación de repositorios también podría replicar datos que legalmente deberían suprimirse del sistema de entrada o trasladarse a otro expediente.

Sin versionado e inmutabilidad, un resumen, traducción o clasificación automática podría reemplazar el relato original y destruir la posibilidad de reconstruir qué información recibió la entidad. La arquitectura exige conservar versión del modelo, API, prompt o sistema, input, output, validación y decisión humana. Sin esos metadatos, el resultado automatizado no es adecuadamente auditable.

### **Razón de gobierno**

El Responsable del Sistema debe conservar independencia y capacidad decisoria, aunque existan proveedores externos o automatización. El benchmark de SpeakUp mantiene expresamente la decisión investigadora en manos humanas aunque la IA traduzca, transcriba, categorice y enrute. La IA debe asistir, no decidir autónomamente la admisibilidad, falsedad, credibilidad, archivo o escalado.

La segregación también debe preceder a la IA. Si un asistente tiene permisos transversales, puede revelar información entre casos, entidades o clientes y eludir las barreras aplicadas a los usuarios humanos. El sistema debe separar administradores, custodios de claves, investigadores, aprobadores y auditores antes de conceder acceso a un componente automatizado.

### **Riesgos concretos de invertir el orden**

| Riesgo | Consecuencia |
| ----- | ----- |
| Reidentificación | El modelo o proveedor podría inferir o exponer la identidad a partir de texto, metadatos, voz, horarios o telemetría. |
| Clasificación jurídica incorrecta | Una categorización errónea podría desactivar relojes, omitir una autoridad o enviar el caso a la unidad investigada. |
| Alucinación | Un resumen podría incorporar hechos inexistentes o desfigurar el relato, afectando al triage y a la investigación. |
| Sesgo | La priorización podría infravalorar determinados idiomas, colectivos, materias o estilos narrativos. |
| Pérdida probatoria | La sobrescritura de versiones impediría demostrar qué se conocía y cuándo se tomó cada decisión. |
| Retención y entrenamiento ilícitos | Los datos podrían mantenerse en logs o utilizarse para entrenamiento después de que procediera su supresión. |
| Transferencias no controladas | Una API podría procesar datos en países o subencargados no aprobados. |
| Dependencia del proveedor | La organización podría carecer de exportación, recuperación o alternativa operativa. |

La secuencia adecuada es: controles legales y de anonimato; modelo de caso, relojes y segregación; evidencia y retención; integraciones deterministas; y, finalmente, IA asistencial gobernada por AIMS 360\. La IA puede pilotarse antes únicamente en funciones limitadas, como transcripción, si no entrena con los datos, conserva el original, opera en un perímetro aprobado y exige validación humana.

## **4\. Función transversal de los servicios QTSP y límites probatorios**

### **Naturaleza transversal**

Los servicios QTSP no deben aparecer únicamente al final para “firmar” el expediente. Deben operar como una capa probatoria que acompaña los hitos jurídicamente relevantes desde la recepción hasta la exportación y conservación. Su función es reforzar la prueba de fecha, integridad, origen, autoría, envío, recepción y preservación, según el servicio utilizado.

### **Aplicación durante el ciclo de vida**

| Fase | Servicio y función recomendados |
| ----- | ----- |
| Recepción | Hash del contenido y metadatos esenciales, más sello de tiempo cualificado sobre la recepción o conocimiento inicial cuando el momento tenga valor probatorio. |
| Clasificación | Sello de tiempo sobre el cambio de estado, criterios utilizados y aprobador, especialmente cuando activa un reloj DORA, RGPD, NIS2 o RIA. |
| Investigación | Versionado append-only de evidencias y workpapers; congelación con hash y sello temporal en los hitos relevantes. |
| Decisiones | Firma electrónica cualificada para decisiones personales de alto impacto y sello electrónico cualificado para artefactos emitidos por la entidad. |
| Comunicaciones | Entrega electrónica certificada cualificada cuando sea necesario probar remitente, destinatario, integridad, envío, recepción y momento. |
| Cierre | Paquete probatorio con hash, sello temporal, sello de entidad y, si procede, firma personal del responsable. |
| Retención | Archivo electrónico cualificado para expedientes cerrados, decisiones, notificaciones, legal holds y paquetes regulatorios de alto valor. |
| Exportación | Manifiesto verificable de documentos, versiones, hashes, sellos, certificados, acuses y cadena de custodia. |

El **sello de tiempo cualificado** presume la exactitud de la fecha y hora y la integridad de los datos vinculados. Debe utilizar una fuente temporal vinculada al Tiempo Universal Coordinado y estar firmado o sellado por el prestador cualificado. Es especialmente relevante en recepción, clasificación, notificación, acuse, informes intermedios y finales y congelación de evidencia forense.

La **firma electrónica cualificada** atribuye una decisión a una persona física y produce efecto equivalente al de una firma manuscrita. Debe reservarse para aprobaciones personales que requieran atribución fuerte, como el cierre de una investigación, el sign-off de una función de control o la aceptación de riesgo residual. Debe vincularse a la versión, rol, delegación y contexto regulatorio concretos.

El **sello electrónico cualificado** sirve para acreditar integridad y origen corporativo de snapshots, expedientes cerrados, paquetes probatorios o comunicaciones emitidas por la entidad. No sustituye la firma personal cuando la norma o la política requieran responsabilidad individual.

La **entrega electrónica certificada cualificada** aporta presunciones sobre integridad, remitente, destinatario y fechas de envío y recepción. Resulta adecuada para comunicaciones P0 a autoridades, clientes, interesados, órganos de gobierno, proveedores, auditores o asesores. No debe utilizarse de forma que comprometa el anonimato del informante; la comunicación ordinaria con un informante anónimo debe mantenerse dentro del buzón seguro.

El **archivo electrónico cualificado** conserva expedientes cerrados con presunción de integridad y origen durante el período de preservación. Debe garantizar durabilidad, legibilidad, protección frente a pérdida y alteración y la emisión de informes automatizados de integridad firmados o sellados por el prestador. También debe prolongar la fiabilidad de firmas y sellos previos mediante procedimientos de preservación o re-sellado.

### **Límites probatorios**

El principal límite es que las presunciones QTSP protegen el **continente**, no necesariamente el **contenido**. El archivo cualificado puede probar que un expediente no ha sido alterado y procede de determinado origen, pero no que la denuncia sea verdadera, que la investigación esté completa o que la decisión jurídica sea correcta. Tampoco prueba que la versión archivada sea la más reciente ni que se hayan cumplido todas las obligaciones de actualización.

La presunción de archivo comienza en el momento del depósito en el servicio cualificado, no en la creación originaria del documento. El intervalo anterior debe cubrirse mediante logs inmutables y sellos de tiempo cualificados independientes. Además, la presunción depende de que el prestador conserve su cualificación y de que continúe vigente el período contratado.

El uso de QTSP tampoco sustituye:

* el cumplimiento de plazos;  
* la identificación de la autoridad correcta;  
* la minimización y protección de datos;  
* la independencia del Responsable del Sistema;  
* la investigación sustantiva;  
* la segregación de funciones; ni  
* los requisitos materiales de DORA, RGPD, NIS2, Solvencia II o el Reglamento de Inteligencia Artificial.

### **Limitaciones actuales de implementación**

GRC Compass contempla hash SHA-512, WORM, cadena de custodia y una arquitectura de evidencias, pero el propio dictamen exige completar esos elementos con sellado temporal cualificado, firmas o sellos adecuados, versionado, retención, segregación y exportación. La integración QTSP completa debe considerarse recomendada, no plenamente acreditada.

La documentación tampoco contiene un clausulado contractual autónomo y exhaustivo para QTSP. El contrato debe verificar cualificación y alcance del servicio, ubicaciones, subcontratación, confidencialidad, SLA, incidentes, continuidad, recuperación, auditoría, portabilidad, re-sellado, pérdida de cualificación, insolvencia y salida. Para el archivo electrónico cualificado debe comprobarse además la adecuación al Reglamento de Ejecución (UE) 2025/2532.

En conclusión, la capa QTSP fortalece sustancialmente la cadena de custodia, pero solo cuando se combina con metadatos completos, logs append-only, versionado, controles de acceso, retención diferenciada y una investigación jurídicamente correcta. Su función es aportar presunciones probatorias reforzadas, no certificar por sí sola el cumplimiento material del canal.

Las tres medidas deben funcionar de forma coordinada: la integridad referencial protege la autonomía jurídica de los subexpedientes; las pruebas adversariales verifican que el anonimato resiste correlaciones técnicas y organizativas; y la combinación de WORM, hashes y sellos de tiempo cualificados preserva qué evidencia existía en cada hito y cuándo. Los documentos describen los principios y componentes, pero parte de la implementación detallada que sigue constituye una especificación técnica propuesta, no una capacidad actualmente acreditada en GRC Compass.

## **1\. Reglas de integridad referencial contra el cierre cruzado**

### **Separación entre hecho, obligación y cierre**

El punto de partida es que `incident_root` representa el hecho común, mientras que cada registro `incident_regime_case` representa una obligación jurídica autónoma para una combinación de entidad, incidente y régimen. El subexpediente debe tener su propio `case_id`, fundamento de activación o exclusión, owner, autoridad, prioridad, estado y evidencia de cierre. Sus relojes, notificaciones, informes, aprobaciones, evidencias y logs se relacionan con ese `case_id`, no directamente con el expediente raíz.

La regla esencial es:

> **Una actuación solo puede modificar el subexpediente al que está jurídicamente vinculada.**

Por ejemplo, un informe final DORA debe cerrar exclusivamente el reloj DORA correspondiente. No puede cambiar el estado del subexpediente RGPD, del expediente de la Ley 2/2023 o del caso de AIMS 360, aunque todos procedan de la misma denuncia. Cada régimen tiene un hecho generador, autoridad, contenido, plazo y acto de cierre distinto.

### **Modelo relacional mínimo**

La base de datos debería aplicar, como mínimo, las siguientes relaciones:

incident\_root  
  └── incident\_regime\_case  
        ├── regulatory\_clock  
        ├── notification\_report  
        ├── case\_decision  
        ├── case\_approval  
        ├── evidence\_link  
        └── audit\_log

`regulatory_clock.case_id`, `notification_report.case_id`, `case_decision.case_id` y `case_approval.case_id` deben ser claves foráneas obligatorias hacia `incident_regime_case`. No debería permitirse que una notificación se vincule únicamente al `incident_root`, porque se perdería la identificación inequívoca del régimen al que satisface. Esta regla responde al diseño documental según el cual cada informe y acuse debe vincularse a su subexpediente, autoridad, plantilla y contenido.

Un artefacto común —por ejemplo, un informe forense— puede relacionarse con varios subexpedientes mediante una tabla de enlace, pero cada relación debe registrar versión, alcance, finalidad, confidencialidad y régimen. El artefacto no debe llevar un único atributo global de “cumplido” o “cerrado”, porque su suficiencia puede variar por régimen.

### **Catálogos de estado separados**

No debería existir un único campo genérico `incident_status` que controle simultáneamente todos los expedientes. El estado operativo del hecho raíz y el estado jurídico de cada subexpediente deben ser diferentes:

* `incident_root.operational_status`: detectado, contenido, investigándose, remediándose o resuelto.  
* `incident_regime_case.legal_status`: pendiente de aplicabilidad, abierto, notificable, notificado parcialmente, pendiente de comunicación, cerrado o excluido motivadamente.  
* `regulatory_clock.status`: no iniciado, activo, próximo a vencer, suspendido jurídicamente, vencido o satisfecho.  
* `notification_report.status`: borrador, aprobado, enviado, acusado, rectificado o completado.

Esta separación evita que marcar el hecho como “operativamente resuelto” cierre obligaciones de notificación todavía pendientes. DORA, RGPD y RIA pueden requerir informes o comunicaciones después de que la incidencia técnica esté contenida.

### **Reglas de transición y precondiciones**

Cada transición a `cerrado` debe ejecutarse mediante un comando específico del régimen, no mediante una actualización directa del estado. Por ejemplo:

| Subexpediente | Precondiciones mínimas de cierre |
| ----- | ----- |
| RGPD | Evaluación de riesgo finalizada; notificación a la autoridad, decisión motivada de no notificar o justificación del retraso; y, si existe alto riesgo, comunicación a interesados o excepción motivada. |
| DORA | Notificación inicial, informe intermedio e informe final completados según corresponda; retrasos gestionados; y comunicación a clientes cuando proceda. |
| RIA/AIMS 360 | Análisis causal terminado; informe exigible presentado o decisión motivada de no aplicabilidad; versión y evidencia de cierre preservadas. |
| Ley 2/2023 | Investigación o decisión de archivo documentada; respuesta o actuación de seguimiento completada; conflictos y medidas anti-represalias gestionados; reglas de conservación asignadas. |
| Compliance penal | Decisión motivada de archivo, investigación o remisión; opinión de las funciones competentes; conflictos documentados; acciones y riesgo residual asignados. |

Estas precondiciones deben aplicarse en la capa de dominio y en la base de datos. No basta con deshabilitar un botón en la interfaz, ya que una API, proceso batch o administrador podría eludir el control visual.

### **Restricciones de base de datos**

Las reglas técnicas recomendadas serían:

1. **Claves foráneas no anulables.** Todo reloj, notificación, decisión o evidencia de cierre debe pertenecer a un subexpediente válido.

2. **Restricción de unicidad contextual.** La combinación `entity_id + incident_id + regime_id + obligation_type` debe ser única, salvo que la regulación permita varias instancias expresamente diferenciadas.

3. **Prohibición de actualización en cascada del estado.** Las relaciones pueden propagar identificadores o restricciones de borrado, pero nunca un cambio de estado jurídico.

4. **Borrado restringido.** Un `incident_root` no puede eliminarse mientras existan subexpedientes, relojes, legal holds o evidencias vinculadas.

5. **Cierre condicionado.** Una restricción o procedimiento almacenado debe rechazar el cierre si existen relojes activos, informes pendientes, comunicaciones obligatorias o aprobaciones no completadas.

6. **Exclusión motivada obligatoria.** Un régimen no aplicable no se elimina; se conserva como subexpediente excluido con fundamento, aprobador, fecha y evidencia.

7. **Inmutabilidad tras el cierre.** Una vez cerrado, el subexpediente pasa a solo lectura. Cualquier corrección exige una nueva versión o reapertura formal, nunca una edición silenciosa.

8. **Control de concurrencia.** Debe evitarse que dos usuarios cierren o modifiquen simultáneamente un expediente sobre versiones diferentes. El comando de cierre debe comprobar el número de versión y fallar si el estado cambió desde la última lectura.

### **Cierre global como operación de agregación**

El “cierre global” del incidente raíz no debe propagar cierres. Debe limitarse a comprobar el estado de todos los subexpedientes:

Puede cerrarse el expediente raíz únicamente si, para todo subexpediente:  
\- está cerrado con evidencia; o  
\- está excluido mediante decisión motivada; o  
\- está transferido a remediación con owner, plazo y seguimiento activo.

Este cierre global debe ser una operación transaccional: si una sola comprobación falla, no se modifica el estado del expediente raíz. El resultado debe mostrar qué subexpediente, reloj o comunicación impide el cierre. El diseño documental contempla precisamente una pantalla consolidada que no sustituye los expedientes individuales.

### **Autorización y segregación**

La integridad referencial debe complementarse con autorización. Solo el owner o aprobador autorizado para un régimen puede solicitar su cierre; y quien investigó o ejecutó una medida no debe ser necesariamente quien valide su suficiencia. Un administrador técnico no debe poder modificar el estado directamente ni alterar logs o evidencias congeladas.

Cada intento rechazado de cierre debe generar un evento de auditoría con actor, rol, entidad, versión, motivo y regla incumplida. La auditoría exige que accesos, cambios, aprobaciones, recusaciones, delegaciones y overrides se registren de forma inmutable.

### **Pruebas de aceptación**

Las reglas deberían validarse con, al menos, estos escenarios:

* cerrar DORA mientras RGPD permanece pendiente;  
* cerrar la investigación interna con una comunicación a interesados todavía pendiente;  
* excluir NIS2 sin fundamento o aprobación;  
* intentar cerrar el raíz con un reloj vencido;  
* modificar una evidencia compartida después del cierre de uno de los subexpedientes;  
* reabrir un subexpediente cerrado sin afectar a los demás;  
* cerrar mediante API con un usuario sin permiso;  
* cierre concurrente sobre dos versiones distintas; y  
* eliminación del incidente raíz mientras existe un legal hold.

La aceptación exige que cada intento indebido sea rechazado, quede registrado y no provoque cambios parciales.

## **2\. Pruebas adversariales de reidentificación**

### **Objetivo y enfoque**

Las pruebas adversariales no se limitan a comprobar que el formulario permite seleccionar “anónimo”. Su objetivo es determinar si un proveedor, administrador, investigador o usuario interno razonablemente capaz puede inferir la identidad mediante datos técnicos, contenido, contexto o correlaciones externas. La fuente exige no registrar IP o device fingerprint, eliminar metadatos, disponer de credencial segura y efectuar una prueba de reidentificación. También trata como criterios eliminatorios las cookies identificativas, los metadatos de adjuntos, lo que conoce el proveedor y la recuperación de credenciales.

Las pruebas deben realizarse antes de producción, después de cambios relevantes en frontend, analítica, telefonía, hosting o identidad, y periódicamente como parte de las pruebas de seguridad. Deben utilizar datos sintéticos y escenarios controlados para no exponer denunciantes reales.

### **Modelo de amenazas**

El ejercicio debe considerar distintos adversarios:

| Adversario | Acceso que debe simularse |
| ----- | ----- |
| Investigador ordinario | Contenido del caso y adjuntos saneados, pero no identidad ni telemetría. |
| Responsable del Sistema | Acceso amplio al expediente, sujeto a necesidad de conocer. |
| Administrador funcional | Configuración y soporte, pero sin acceso por defecto al contenido. |
| Administrador de infraestructura | Logs, redes, bases de datos, backups y observabilidad. |
| Proveedor SaaS | Soporte, telemetría, subencargados y datos técnicamente accesibles. |
| Usuario de la unidad investigada | Organigrama, horarios, hechos internos y conocimiento contextual. |
| Atacante externo | Portal público, mecanismos de recuperación, notificaciones y endpoints. |
| Analista con acceso a varios módulos | Datos del canal más RR. HH., IAM, correo, SIEM o GRC. |

El resultado debe diferenciar anonimato frente al investigador, frente a la entidad y frente al proveedor. Una arquitectura puede ocultar la identidad al investigador y, sin embargo, permitir que infraestructura o el proveedor la reconstruyan.

### **Familia 1: telemetría y red**

Debe verificarse si el portal o sus componentes recopilan:

* IP de origen;  
* cabeceras reenviadas por proxy o CDN;  
* identificadores de sesión persistentes;  
* device fingerprint;  
* geolocalización;  
* identificadores publicitarios;  
* cookies de analítica;  
* identificadores de crash reporting;  
* DNS o logs de firewall correlacionables;  
* timestamps con precisión innecesaria; y  
* parámetros incrustados en enlaces.

El tester presenta varias denuncias desde redes, navegadores y dispositivos controlados e intenta reconstruir la correspondencia utilizando logs de aplicación, CDN, WAF, infraestructura, SIEM y soporte. La prueba falla si un usuario no autorizado o el proveedor puede vincular de forma fiable un caso con un origen técnico.

No siempre es posible eliminar toda telemetría de seguridad. Cuando deba conservarse información para prevenir ataques, debe separarse del expediente, reducirse o anonimizarse, aplicarse una retención corta y prohibirse su consulta por investigadores. La finalidad es evitar que los logs de seguridad neutralicen el anonimato funcional.

### **Familia 2: metadatos de archivos**

Deben subirse documentos Word, PDF, imágenes, audio y vídeo con metadatos intencionadamente identificativos:

* autor y organización;  
* nombre de usuario;  
* ruta local;  
* dispositivo y número de serie;  
* coordenadas GPS;  
* fecha y zona horaria;  
* historial de revisión;  
* miniaturas;  
* comentarios;  
* nombres de capas;  
* nombre original del archivo; y  
* propiedades de códecs o aplicaciones.

La prueba debe comprobar qué recibe el investigador, qué conserva el repositorio original y qué puede ver el proveedor. El sistema debe sanear la copia de trabajo y restringir el original cuando su conservación sea necesaria para integridad o investigación. Formalize y FaceUp publican eliminación de metadatos, mientras Whispli declara borrado de metadatos; estas capacidades sirven de referencia comparativa.

### **Familia 3: identidad y separación de datos**

Se debe intentar acceder a la identidad mediante:

* consultas directas a base de datos;  
* APIs internas;  
* exportaciones;  
* búsqueda global;  
* backups;  
* paneles administrativos;  
* herramientas de soporte;  
* informes BI;  
* cachés; y  
* logs de auditoría.

El ensayo debe confirmar que la identidad reside separada del contenido y que la vinculación se realiza mediante un identificador seudónimo. Un investigador sin permiso no debe poder resolver esa vinculación. El acceso excepcional debe exigir autorización, justificación y registro inmutable.

También debe comprobarse que la identidad no se replique al crear un riesgo, hallazgo, caso DORA, expediente RGPD o acción correctora. Los objetos derivados deberían recibir únicamente los datos necesarios para su finalidad.

### **Familia 4: credenciales y buzón anónimo**

Las pruebas deben cubrir:

* entropía y no predictibilidad de la credencial;  
* enumeración de buzones;  
* fuerza bruta;  
* reutilización de tokens;  
* caducidad de sesiones;  
* protección contra secuestro de sesión;  
* fugas del token en URL, historial, logs o referrer;  
* restablecimiento de credenciales;  
* soporte al usuario;  
* recuperación mediante ingeniería social; y  
* notificaciones a correo o teléfono.

El proveedor y el equipo interno no deberían poder recuperar la identidad a partir del token. La recuperación de una credencial perdida debe equilibrar acceso y anonimato; si una recuperación segura no es posible, el producto debe comunicar esa limitación claramente y permitir códigos de recuperación generados al alta. La fuente identifica esta cuestión como una prueba eliminatoria de RFP.

### **Familia 5: correlación temporal y organizativa**

Un adversario interno puede combinar la hora exacta de envío con registros de acceso al edificio, VPN, proxy, turnos, vacaciones o presencia en oficinas. La prueba debe crear denuncias en momentos conocidos y comprobar si los usuarios del caso reciben precisión temporal superior a la necesaria. Debe valorarse:

* redondear o limitar timestamps mostrados a usuarios ordinarios;  
* separar el timestamp probatorio exacto del timestamp visible;  
* restringir el acceso a logs de red y presencia;  
* introducir retrasos aleatorios únicamente en notificaciones no regulatorias, sin alterar la fecha jurídica real; y  
* prohibir consultas cruzadas con IAM o SIEM salvo incidente de seguridad autorizado.

El timestamp exacto debe conservarse en el repositorio probatorio para los relojes legales, pero no necesariamente mostrarse a todos los investigadores.

### **Familia 6: análisis lingüístico y contextual**

Aunque se elimine la telemetría, el relato puede revelar identidad mediante estilo, expresiones, errores, idioma, hechos conocidos o acceso exclusivo a determinada información. Las pruebas deberían intentar reidentificar al informante usando:

* estilometría;  
* vocabulario y firmas lingüísticas;  
* referencias a reuniones;  
* funciones o turnos;  
* conocimiento exclusivo;  
* fechas y lugares;  
* cargos o relaciones jerárquicas; y  
* combinación con datos de RR. HH.

No siempre es posible impedir esta inferencia sin alterar sustancialmente la denuncia. Los controles deben centrarse en advertir al informante, ofrecer herramientas de redacción segura y limitar quién ve el texto íntegro. Cualquier asistente de reescritura debe ser opcional y no transmitir el contenido a un modelo no aprobado.

### **Familia 7: voz y transcripción**

Para canales telefónicos o mensajes de voz deben evaluarse:

* conservación del número llamante;  
* identificadores de operador;  
* grabaciones de red;  
* biometría o reconocimiento de voz;  
* acento y características personales;  
* metadatos del audio;  
* eficacia de la distorsión;  
* posibilidad de revertir la distorsión; y  
* exposición en transcripciones.

NAVEX publica anonimización de voz, Formalize voz con distorsión y Whispli Voice AI. La prueba debe comprobar que la distorsión no es meramente perceptiva y que el audio original, si se conserva, queda en una zona especialmente restringida.

### **Familia 8: proveedor, backups y subencargados**

Debe simularse una solicitud de soporte y comprobar qué puede ver el proveedor sin autorización del cliente. También deben revisarse:

* accesos “break glass”;  
* datos en backups;  
* restauraciones;  
* herramientas de observabilidad;  
* soporte de segundo nivel;  
* subencargados;  
* residencia de datos;  
* claves;  
* datos empleados en entrenamiento; y  
* exportación tras terminación.

Formalize declara que el proveedor no puede leer los casos mediante su arquitectura zero-knowledge; EQS declara cifrado de extremo a extremo y ausencia de IP o dispositivo. GRC Compass debe demostrar técnicamente cualquier afirmación equivalente y no limitarse a incorporarla al contrato.

### **Criterios de aceptación**

No debe exigirse un riesgo absoluto de reidentificación igual a cero, porque el propio contenido puede revelar al autor. El criterio razonable es que:

* no se recojan identificadores técnicos salvo necesidad documentada;  
* los investigadores no puedan acceder a telemetría o identidad;  
* los administradores no puedan leer casos por defecto;  
* todo acceso excepcional sea aprobado y auditado;  
* el proveedor no pueda acceder al contenido sin una base técnica y procedimental explícita;  
* los adjuntos se saneen correctamente;  
* la credencial no sea enumerable ni recuperable de forma insegura;  
* las exportaciones no reintroduzcan metadatos eliminados; y  
* el riesgo residual contextual se documente y comunique.

Cada hallazgo debe clasificarse por probabilidad, impacto, actor capaz de explotarlo y facilidad de correlación. Los defectos que permitan vincular sistemáticamente un caso con IP, dispositivo, cuenta o identidad deben bloquear la producción.

## **3\. Integración práctica de sellos de tiempo cualificados y WORM**

### **Funciones diferentes y complementarias**

WORM, hash y sello de tiempo no son sustitutos:

* **WORM o append-only** evita o hace detectable la modificación o supresión dentro del repositorio.  
* **El hash** representa criptográficamente el contenido y los metadatos de una versión.  
* **El sello de tiempo cualificado** vincula ese hash a una fecha y hora fiables, con presunción de exactitud temporal e integridad de los datos vinculados.  
* **El archivo electrónico cualificado** preserva a largo plazo integridad y origen durante el período contratado.

El hash aislado no acredita fecha, autoría, contexto, versión ni custodia entre sistemas. WORM prueba que el repositorio no debería permitir alteraciones ordinarias, pero no demuestra por sí solo cuándo existía el contenido frente a un tercero independiente. El sello de tiempo cualificado añade precisamente esa prueba temporal externa.

### **Secuencia de creación de una versión**

Cada hito probatorio debería seguir esta secuencia:

1. **Cerrar la versión lógica.** El sistema recopila el contenido y los metadatos esenciales: `case_id`, régimen, entidad, actor, rol, estado, reloj, política, fuentes y referencias a adjuntos.

2. **Canonicalizar.** Los datos se transforman a una representación estable para evitar que cambios irrelevantes de formato produzcan hashes distintos.

3. **Generar hashes.** Se calcula un hash para cada artefacto y un hash raíz del manifiesto completo. El hash debe cubrir contenido y metadatos relevantes, no solo el documento visible.

4. **Persistir en WORM.** La versión, el manifiesto y los artefactos se escriben en almacenamiento inmutable o append-only.

5. **Solicitar el sello.** El sistema envía al QTSP el hash raíz, no necesariamente todo el contenido confidencial. El QTSP devuelve un token de sello de tiempo cualificado vinculado a una fuente temporal relacionada con UTC.

6. **Persistir el token.** El sello, certificado, política del servicio, identificador de transacción y respuesta de verificación se almacenan junto a la versión en WORM.

7. **Registrar el evento.** El log append-only registra actor, versión, hash, momento de solicitud, resultado, QTSP utilizado y cualquier error.

8. **Bloquear la versión.** La versión queda en solo lectura. Las modificaciones posteriores crean una nueva versión; nunca reemplazan la anterior.

### **Uso de manifiestos y árboles de hashes**

En expedientes con múltiples archivos resulta preferible sellar un manifiesto o raíz Merkle en vez de solicitar un sello independiente para cada elemento. El manifiesto debe enumerar:

* identificador del artefacto;  
* nombre lógico;  
* tipo;  
* versión;  
* hash;  
* tamaño;  
* clasificación de confidencialidad;  
* origen;  
* relación con el subexpediente;  
* fecha de creación; y  
* estado de conservación.

El hash raíz permite demostrar que el conjunto existía en un momento determinado. Si cambia un solo archivo, se genera una nueva raíz y una nueva versión sellada. Los sellos por lote reducen coste y latencia, pero los hitos especialmente críticos pueden recibir además un sello individual.

### **Evidencia viva y evidencia congelada**

Los workpapers y borradores siguen siendo evidencia viva y pueden evolucionar. Sus modificaciones deben quedar en logs y versiones intermedias según el riesgo, pero no es necesario solicitar un sello cualificado por cada pulsación o guardado. El sello debe aplicarse cuando la evidencia se utiliza para una decisión, notificación, cambio de clasificación, cierre o entrega.

La evidencia congelada —informe forense, decisión, notificación, acuse, matriz de clasificación o cierre de plan— debe recibir automáticamente hash, escritura WORM y sello temporal. Esta política conserva la “fotografía” de lo que se sabía en cada hito y evita que una actualización posterior reescriba el pasado regulatorio.

### **Estados de sellado y tolerancia a fallos**

La integración necesita estados explícitos:

* `pending_seal`;  
* `sealed`;  
* `seal_failed`;  
* `verification_failed`;  
* `renewal_due`;  
* `archived`;  
* `archive_verification_failed`.

Una versión crítica no debería considerarse formalmente congelada hasta que:

1. haya sido escrita en WORM;  
2. se haya calculado y verificado su hash; y  
3. el sello cualificado haya sido recibido y validado.

Si el QTSP no está disponible, el sistema debe conservar inmediatamente la versión en WORM con timestamp interno fiable, registrar el fallo y reintentar el sellado. No debe inventarse una fecha posterior como fecha de creación; deben conservarse tanto el momento interno del evento como el momento del sello obtenido. La diferencia debe quedar visible en el expediente.

Para plazos regulatorios, la indisponibilidad del QTSP no puede bloquear el envío de una notificación. El sistema debe priorizar el cumplimiento material del plazo, conservar la evidencia local y completar el refuerzo probatorio tan pronto como sea posible. El QTSP no sustituye las obligaciones sustantivas.

### **Verificación y exportación**

La verificación debe poder ejecutarse:

* al recuperar una versión;  
* antes de una exportación;  
* al cerrar un subexpediente;  
* durante una auditoría periódica;  
* después de una migración; y  
* antes de transferir el archivo a otro prestador.

El proceso recalcula los hashes, comprueba el manifiesto, valida la firma o sello del QTSP, su cadena de confianza, la política aplicable y el estado de cualificación correspondiente. El resultado debe generar un informe de verificación conservado también en WORM.

La exportación debe incluir el contenido, manifiesto, hashes, tokens de sello, certificados necesarios, evidencias de validación y una guía de verificación independiente. La fuente exige que la exportación cubra adjuntos, audio, transcripciones, mensajes, logs y hashes en formato legible y reutilizable.

### **Preservación a largo plazo**

Los algoritmos, certificados y formatos pueden quedar obsoletos. Por eso, el archivo electrónico cualificado debe permitir re-sellado y extensión de la fiabilidad de firmas y sellos durante el período de conservación. El prestador debe poder emitir un informe automatizado que confirme la integridad desde el inicio de la preservación hasta la recuperación.

El contrato debe regular:

* conservación y renovación de sellos;  
* migración entre algoritmos;  
* pérdida de cualificación;  
* cese o insolvencia del QTSP;  
* exportación de tokens y evidencias;  
* continuidad;  
* formatos abiertos;  
* recuperación;  
* auditoría; y  
* transición a otro prestador.

### **Resultado probatorio y límite**

La combinación aporta una cadena especialmente robusta:

Contenido y metadatos  
→ hash verificable  
→ almacenamiento WORM  
→ sello de tiempo cualificado  
→ versiones posteriores enlazadas  
→ archivo cualificado de largo plazo

Esto permite acreditar que una versión determinada existía en un momento concreto y que no fue modificada sin detección razonable. No demuestra, sin embargo, que el contenido sea verdadero, completo, jurídicamente correcto o la versión más reciente. El valor probatorio depende también de que los metadatos, permisos, decisiones, investigación y cadena de custodia sean correctos.

En síntesis, la integridad referencial evita que una obligación jurídica se cierre por actuaciones pertenecientes a otra; las pruebas adversariales comprueban que el anonimato subsiste frente a correlaciones técnicas y humanas; y WORM más sellado temporal conserva una secuencia verificable de versiones. Los tres controles deben completarse y probarse antes de considerar el canal apto para producción o para servir como evidencia de eficacia del sistema de compliance.

