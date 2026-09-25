# Governance OS · explicaciones para personas (copia de referencia, 24-09-2026)

Copia local de la descripción del proyecto y de la explicación «Para entenderlo sin ser técnico» de cada issue, tal como se publicaron en Linear el 24-09-2026 (proyecto «Governance OS · Secretaría y AIMS»). La fuente viva es Linear: si difieren, manda Linear.

# Descripción del proyecto

## Para entenderlo sin ser técnico

**Qué problema hay.** Governance OS es un prototipo operativo avanzado de gestión de la gobernanza de un grupo: Secretaría societaria, gobierno de la inteligencia artificial (AIMS) y cumplimiento (GRC). Hasta el 24-09-2026 su trabajo pendiente estaba repartido entre conversaciones, documentos del repositorio e informes de agentes. Solo siete tareas estaban en Linear. Además, parte del trabajo hecho no ha llegado a la versión principal: el programa RIA vive en una rama que solo existe en este ordenador y el grupo nuevo de prueba está sin guardar en git, aunque los dos ya cambiaron la base de datos de producción.

**A quién afecta y qué pasa si no se hace.** Afecta a Moisés, que dirige el proyecto, y a quien ejecute (Codex, agentes de programación o personas). Sin un plan único se repiten trabajos, se pierden decisiones pendientes y se corre el riesgo de perder trabajo que no está a salvo. También hay fechas del RIA: un tope interno del programa, el 13-11-2026 (cuestionario v2), y un plazo regulatorio, el 2-12-2026 (clasificación real y obligaciones de transparencia).

**Qué resultado buscamos.** Un único plan en Linear, en cinco hitos, con todo el trabajo pendiente comprobado, sus dependencias y las decisiones que corresponden a Moisés o a los comités. El objetivo de producto no cambia: Secretaría y AIMS maduros, utilizables por un grupo que empieza desde cero, con ARGA y Garrigues como entornos de simulación y prueba.

**Cómo sabremos que está resuelto.** Cada hito se cierra cuando sus tareas cumplen sus criterios de hecho. La entrega del producto se acredita con el acta de aceptación de Moisés en MOI-57: un tercer grupo recorre Secretaría y AIMS desde cero sin heredar datos de ARGA ni de Garrigues. Esa entrega no cierra el proyecto: el programa RIA (M3 y M4) y la deuda conocida (M4) siguen su curso después.

**Qué le toca a Moisés.** Las decisiones y autorizaciones de la tabla de hitos, en su orden, y lo que diga el apartado «Qué te toca a ti» de cada tarea. Las primeras son las de M0: poner a salvo la rama RIA y decidir cómo llega a la versión principal. Además tiene que designar a varias personas que hoy no constan y de las que dependen tareas: la persona responsable de cumplimiento de Garrigues (MOI-159 a MOI-156, MOI-177 y MOI-191), una segunda persona de Garrigues que revise lo que otra congela (MOI-155 y MOI-177), el DPO que tenga designado el despacho (MOI-156), la persona del CATIT a la que se enlaza la cuenta de cumplimiento de ARGA (MOI-153) y quien concilie los módulos de GRC de ARGA (MOI-189); y obtener de EAD Trust la confirmación de lo que cubre su contrato (MOI-216).

## Cómo se trabaja

**Orden de los hitos.** M0 va primero: pone a salvo el trabajo y hace que el código guardado, la base de datos y la versión publicada coincidan. M1 y M2 siguen el orden que ya tenían: primero el grupo nuevo y Secretaría, después AIMS y la aceptación integral. M3 avanza en paralelo desde hoy porque tiene fechas del RIA y del programa en 2026 (13-11, 14 a 27-11, 30-11, 2-12 y 18-12), pero algunas piezas de M2 tienen que llegar antes de esas fechas: la cuenta de cumplimiento de ARGA (MOI-153), la decisión sobre el plan de acción (MOI-162) y la designación de las personas de Garrigues (MOI-159 y MOI-155). M4 recoge lo que no tiene fecha ni bloquea la entrega; sus tareas pueden adelantarse cuando haya capacidad, en especial la de la auditoría (MOI-204).

**Regla general de autorizaciones.** Fuente: el documento de instrucciones del repositorio (CLAUDE.md) y la práctica autorizada del proyecto.
- No necesitan autorización caso a caso: leer y medir en solo lectura, preparar modificaciones del programa en ramas, ejecutar pruebas automáticas que no escriben en la base de datos, ensayar un cambio de base de datos dentro de una operación que se deshace al final, redactar documentos y consultar a Harvey para validar criterios (autorizado el 19-09-2026).
- Necesitan autorización escrita de Moisés, en un comentario del issue: subir una rama a GitHub (la autorización de incorporar una tarea a la versión principal incluye subir su rama); incorporar código a la versión principal, porque eso publica automáticamente en producción; cualquier cambio en la base de datos de producción, incluidas las sondas que escriben; borrar datos, ficheros o copias de trabajo; y toda decisión de producto, alcance o aceptación.
- No las hace nunca un agente: crear cuentas o manejar contraseñas (las crea Moisés), afirmar firma, envío, entrega o interacción real con EAD Trust sin prueba contractual y técnica separada, usar el nombre real del cliente asegurador, cambiar el dato de ARGA sin cambio declarado y autorizado, o borrar, pisar o duplicar el dato sembrado de Garrigues.

**Cómo leer una tarea.** Empieza por «Para entenderlo sin ser técnico», en cinco apartados. El último, «Qué te toca a ti», dice lo que decide, autoriza o hace Moisés, o «Nada». Debajo va el detalle técnico para quien ejecuta: contexto comprobado con fecha, pasos, criterios de hecho, puerta humana, dependencias y referencias. Las etiquetas «Decisión» y «Ventana» señalan, respectivamente, una decisión reservada y un cambio en producción que requiere autorización escrita; «Comités» señala que el criterio lo da alguien ajeno al equipo técnico. Los criterios de hecho de cada tarea, en su detalle técnico, dicen el nivel exigido para cerrarla: preparado, probado, publicado o aceptado (ver glosario). Quien modifique una tarea mantiene al día su explicación.

**Fechas.** Solo el 2-12-2026 es una fecha regulatoria (Reglamento Ómnibus 2026/1744). El 13-11-2026 es un tope interno del programa. El 14 al 27-11, el 30-11 y el 18-12-2026 son del calendario orientativo del programa, y algunas fechas de los comités son propuestas pendientes de confirmar. Cada tarea dice de qué tipo es su fecha.

**Mapa del programa RIA.** Las fases del programa (F0 a F11) se reparten así: F2 en MOI-170, salvo las tareas T13 y T14, que van en MOI-158; F3 en MOI-171; F4 en MOI-173; F5 en MOI-175, con la decisión previa de MOI-162 y MOI-174; F6 en MOI-176 (carril rápido) y MOI-212 (resto); F7 en MOI-213; F8 en MOI-164 (tareas T1 y T3) y MOI-180 (resto); F9 y F10 en MOI-180; F11 en MOI-177 (T1 y T2), MOI-217 (T3, reclasificación de ARGA) y MOI-180 (resto). Los lotes de Harvey los envía MOI-169, salvo los que su tabla asigna a otras tareas.

**Criterio de arquitectura.** Se mantiene el de la sección «Arquitectura», que se conserva más abajo en esta descripción: maximizar lo común dentro del mismo producto, separar la configuración de cada grupo de sus datos, y no exigir servicios separados ni completar todos los módulos. Las preguntas jurídicas no las decide el equipo técnico: van al Comité Legal, al Comité de IA o al equipo legal, y mientras tanto la pantalla lo declara.

## Hitos

| Hito | Para qué sirve | Trabajo, en orden | Lo que decide o autoriza Moisés |
| --- | --- | --- | --- |
| M0 · Base gobernada: código guardado, base de datos y versión publicada casan | Que nada se pierda y que lo publicado funcione con la base de datos actual | Poner a salvo la rama RIA; comprobar hoy la versión publicada; decidir la integración de la rama y ejecutarla, publicarla y comprobarla; guardar el trabajo del grupo nuevo; quitar el permiso de vaciar tablas; rescatar el arreglo de los escenarios; cuadrar la numeración de junio; limpiar copias; actualizar las instrucciones | Autorizar la subida de la rama RIA; autorizar las sondas que escriben (MOI-211, MOI-125, MOI-126); elegir cómo se integra la rama y autorizar su publicación; autorizar guardar el grupo nuevo y decidir si las instrucciones para agentes llevan una sección suya; autorizar el cambio de permisos de la base de datos; elegir cómo se cuadran los cambios de junio; decidir qué copias y ramas se descartan y dónde se guardan sus cambios; borrar o autorizar a borrar la carpeta de restos; autorizar la incorporación de los arreglos (MOI-127, MOI-130) |
| M1 · Grupo desde cero y Secretaría operativa | Que un grupo nuevo, sin datos de demostración, tenga Secretaría utilizable | Confirmar nombre y dónde verlo; recorrer el alta, las sociedades y el ciclo societario (MOI-53, MOI-15); enlazar cuentas y personas; publicar el grupo nuevo; que las plantillas no afirmen aprobaciones ni citas que no tienen; Juntas; comisiones delegadas; decidir la custodia final; verificar comunicaciones y custodia (MOI-16) | Confirmar o cambiar el nombre; elegir local o publicado; hacer los recorridos por pantalla (MOI-53, MOI-15) y entrar en el grupo nuevo una vez publicado; confirmar qué persona va con cada cuenta (MOI-133); copiar la contraseña del grupo nuevo a las copias de trabajo vivas (MOI-135); decidir el alcance del informe del Comité Legal del 01-05 y autorizar el cambio visible en ARGA (MOI-137); llevar al Comité Legal las citas desfasadas y las comisiones delegadas; elegir si la convocatoria de Junta se prueba con la Junta de Garrigues del 06-05-2026 o con una Junta de prueba (MOI-142) y, en ese caso, confirmar su base de cómputo (MOI-143); elegir si el alta de grupos deja de copiar las plantillas defectuosas o las copia marcadas (MOI-139); decidir si se construye la custodia final y si se hace una prueba real con EAD Trust (MOI-144); obtener de EAD Trust la confirmación de lo que cubre su contrato (MOI-216); autorizar la publicación, los cambios de base de datos y las incorporaciones |
| M2 · AIMS y gobernanza transversal operativos | Que AIMS funcione en el grupo nuevo y se conecte con Secretaría y GRC | Recorrer AIMS (MOI-55), GRC y el canal (MOI-146) en el grupo nuevo; decidir alta por pantalla o kit y construir lo decidido; decidir antes si se pueden seguir borrando sistemas de IA; clasificar y evaluar los sistemas de Garrigues con dos personas; cuenta de cumplimiento de ARGA; que GRC y Secretaría lean el caso que les llega de AIMS (MOI-158); conectar AIMS con Secretaría de forma persistente (MOI-56); ordenar criterios comunes de AIMS y GRC (MOI-160 a MOI-164 y MOI-215); aceptación integral (MOI-57) | Hacer o encargar los recorridos y aceptar el bloque de AIMS (MOI-55); designar a la persona responsable de cumplimiento de Garrigues, a la segunda persona revisora y al DPO; crear la cuenta de cumplimiento de ARGA y elegir su persona del CATIT; decidir con qué cuenta entran la persona responsable y la revisora de Garrigues y, si es propia, crearla (MOI-159, MOI-155); decidir alta o kit, borrado de sistemas de IA, órgano de IA y canal como dato del grupo (MOI-150, MOI-151), criterio de «cubierto», vocabulario de estados y plan de acción único (oyendo al Comité de IA y al CATIT); si el grupo nuevo nace con el módulo de IA de GRC (MOI-152); aprobar el diseño de MOI-56 y de MOI-148; llevar al equipo legal el plazo DORA (MOI-163) y el riesgo de ARGA (MOI-164) y decidir sobre ese dato de ARGA; confirmar el cálculo único de plazos (MOI-215); autorizar los cambios de base de datos y las incorporaciones; registrar el acta de aceptación (MOI-57) |
| M3 · RIA: obligaciones y decisiones con fecha en 2026 | Cubrir lo del RIA que vence en 2026: 13-11, 14 a 27-11, 30-11, 2-12 y 18-12 | Archivar Harvey y lotes pendientes; fases F2 a F7 del programa; preguntas al equipo legal y a los comités; sesión con el experto; clasificación real antes del 2-12 | Enviar el documento al experto y citarlo; entrar en la consola de Harvey si la sesión ha caducado (MOI-165, MOI-169); llevar las preguntas al equipo legal, al Comité de IA de Garrigues, al CATIT de ARGA y al Comité Legal, incluida la pregunta previa de quién fija la posición sobre secreto profesional (MOI-178); decidir cómo se muestra el control del art. 4; crear la cuenta de ARGA antes del 27-11 (MOI-153), elegir cómo contesta la persona responsable en la clasificación definitiva y aceptar su resultado (MOI-177); autorizar cada cambio de base de datos de las fases, las filas nuevas y los cambios en el dato de ARGA (MOI-170, MOI-175, MOI-177, MOI-213, MOI-217) y las incorporaciones |
| M4 · Resto del programa RIA, criterios jurídicos pendientes y deuda conocida | Cerrar lo que no tiene fecha ni bloquea la entrega | Fases F8 a F10 (2027); preguntas pendientes al Comité Legal y al Comité de IA; mejoras de Secretaría; orden del dato de GRC; protecciones de la base de datos | Llevar las preguntas a los comités y encargar al equipo legal la nueva convocatoria de comisión delegada y decidir a qué grupos se aplica (MOI-201); convocar la sesión de modelo con el Comité de IA (MOI-183); decisiones sobre tablas, pruebas, restos (y borrar él mismo la cuenta sin perfil si así decide, MOI-188), inventario de IA, editor de preguntas (MOI-187) y dato de ARGA; hacer llegar al despacho las preguntas del ENS (MOI-191); validar los ámbitos de Garrigues (MOI-193); fijar la prioridad del tipado (MOI-194); confirmar el nombre del índice de expedientes en el menú; decidir la forma de convocar al Comité Legal (MOI-202); autorizar el expediente de prueba permanente (MOI-203), elegir cómo entra el autor en la huella de la auditoría (MOI-204), la prueba automática que escribe (MOI-214), los cambios declarados en ARGA (MOI-206 a MOI-209) y los cambios de base de datos e incorporaciones |

## Palabras que se usan en los issues

**Personas y herramientas**
- **Moisés:** dirige el proyecto y decide producto, alcance, prioridades, aceptación y autorizaciones de producción.
- **Codex:** asistente de programación de OpenAI que ejecuta tareas en el repositorio.
- **Asistente:** según el contexto, un asistente de IA (Codex, Harvey, los agentes) o una pantalla guiada por pasos de la aplicación (por ejemplo, el asistente de certificaciones autónomas).
- **Agentes de programación o agente:** asistentes que modifican el programa y hacen comprobaciones por encargo; no deciden lo reservado a Moisés.
- **Quien ejecuta:** la persona o el agente asignado a una tarea.
- **Comité Legal:** órgano que fija los criterios jurídicos reservados del producto: los del motor societario y las plantillas, y los puntos del RIA que el programa le atribuye.
- **Comité de IA o Comité de Gobernanza de la IA:** órgano de Garrigues que decide sobre sus sistemas de IA; en ARGA hace ese papel el CATIT. Cuando una tarea dice «Comité de IA» sin más, se refiere al de Garrigues; si el asunto afecta también a ARGA, lo dice y lo lleva además al CATIT.
- **CATIT:** Comité Asesor de Tecnología e Innovación de ARGA, su órgano de IA desde la decisión del 20-09-2026.
- **Equipo legal:** abogados que revisan textos y dan criterio sin ser un comité.
- **Persona responsable de cumplimiento de Garrigues:** quien contesta los cuestionarios y evaluaciones de IA del despacho; hoy no consta nombrada.
- **DPO:** delegado de protección de datos.
- **Experto RIA:** especialista externo que revisa el catálogo de obligaciones del RIA.
- **Harvey:** asistente jurídico de IA que se consulta para validar criterios; no sustituye la revisión del equipo legal.
- **EAD Trust:** prestador de servicios de confianza del proyecto. En el alcance vigente solo hace interposición, mensajería básica y custodia; no se afirma firma, envío ni entrega.
- **GitHub:** servicio donde se guarda la copia compartida del repositorio.

**El sistema y cómo se cambia**
- **Repositorio:** el código del producto y sus documentos.
- **Versión principal (main):** la rama de referencia; lo que se incorpora a ella se publica automáticamente en producción.
- **Rama:** copia paralela del código para trabajar sin tocar la versión principal.
- **Fusionar o incorporar:** llevar una rama a la versión principal.
- **Guardar en git o subir a GitHub:** registrar los cambios y copiarlos al servicio compartido para que no se pierdan.
- **Copia de trabajo:** carpeta del ordenador con una rama abierta para trabajar.
- **Producción o versión publicada:** la aplicación en su dirección pública, que usa la base de datos de producción.
- **Publicar:** hacer que una versión llegue a producción.
- **Base de datos de producción o Cloud:** la única base de datos del proyecto (governance_OS); la usan la versión publicada y las pruebas.
- **Cambio de base de datos:** modificación versionada de la estructura o del dato; se ensaya antes y se guarda también en el repositorio.
- **Prueba automática:** comprobación que ejecuta el programa sin intervención humana.
- **Sonda:** prueba automática que consulta la base de datos real con un acceso de demostración.
- **Recorrido:** prueba manual por pantalla siguiendo un guion, anotando lo que falla.
- **Huella:** valor que identifica un contenido exacto; si el contenido cambia, la huella cambia.
- **PR:** propuesta de incorporación de cambios en GitHub; se cita «PR nº 123».
- **Entorno o grupo:** cada organización con sus datos separados dentro del mismo producto (ARGA, Garrigues y Grupo Nuevo).
- **Kit de arranque:** carga inicial de datos de un grupo hecha por el equipo, en vez de por pantalla.
- **Ventana:** tarea cuyo objeto es cambiar la base de datos de producción o publicar una integración de alcance especial, y que solo se ejecuta con autorización escrita de Moisés. Las incorporaciones ordinarias de código a la versión principal también necesitan su autorización, según la regla general, aunque no lleven esta etiqueta.
- **Decisión:** tarea cuyo objeto actual es una decisión reservada; se asigna a quien decide o la tramita.
- **Comités (etiqueta):** tarea cuyo criterio lo da alguien ajeno al equipo técnico: el Comité Legal, el Comité de IA, el CATIT, el equipo legal, el DPO, la persona responsable de cumplimiento o el experto RIA. Moisés lleva la pregunta y trae la respuesta.
- **Nivel exigido:** grado de cierre que pide cada tarea: preparado (hecho y listo, sin probar), probado (comprobado con pruebas o un ensayo), publicado (ya en producción) o aceptado (Moisés, o quien corresponda, lo da por bueno).
- **Propuesta:** lo que sugiere el agente que redacta cuando la fuente no lo fija (por ejemplo, qué pasa si no se decide); Moisés puede cambiarlo.
- **Ensayo:** ejecución de un cambio de base de datos dentro de una operación que se deshace al final, para ver su efecto sin dejarlo aplicado.
- **Cuenta:** usuario de acceso a la aplicación. Las de demostración de ARGA (solo demo@) y de Garrigues (demo@ y admin@) están enlazadas a una persona del censo, que es quien figura como autor de lo que se hace con ellas; las dos del grupo nuevo se enlazan en MOI-133.
- **Registro del programa:** documento donde cada programa (RIA, reorganización de AIMS, cierre de huecos del 05-09-2026) anota decisiones, tareas y deudas con su fecha. El registro de consultas a Harvey es la lista de lotes enviados con su huella. No confundir con la lista de copias de trabajo que lleva git.

**El contenido del producto**
- **ARGA:** grupo asegurador ficticio que sirve de demostración principal; su dato no se cambia sin autorización expresa.
- **Garrigues:** segundo entorno, con datos simulados basados en la realidad que deben conservarse.
- **Grupo Nuevo:** tercer entorno, creado el 19-09-2026 sin datos de demostración para probar el alta desde cero.
- **Secretaría:** módulo de gestión societaria: órganos, convocatorias, reuniones, acuerdos, actas, certificaciones y libros.
- **AIMS:** módulo de gobierno de la IA: inventario de sistemas, clasificación, evaluaciones e incidentes.
- **GRC:** módulo de riesgos, controles, obligaciones, incidentes y cumplimiento.
- **Canal interno de información:** módulo para recibir y tramitar comunicaciones internas (SII).
- **Consola:** pantalla general que resume el estado de todos los módulos.
- **Plantilla:** modelo de documento societario (convocatoria, acta, certificación…).
- **Reglas o pack de reglas:** configuración que dice qué plazos, quórums y mayorías aplica cada materia y órgano.
- **Materia:** tipo de acuerdo (por ejemplo, aprobación de cuentas o nombramiento de consejero).
- **Junta, Consejo y comisión delegada:** órganos de una sociedad: los socios, el órgano de administración y una comisión con facultades del Consejo.
- **Custodia final:** registro en servidor de la versión definitiva de un acta, necesario para poder certificarla.
- **Cuestionario guiado:** preguntas que clasifican un sistema de IA según el RIA.
- **Catálogo de medidas:** lista de obligaciones o buenas prácticas contra la que se evalúa un sistema.
- **Responsable del despliegue:** quien usa un sistema de IA bajo su autoridad; distinto del proveedor, que lo desarrolla o comercializa.
- **Congelar y revisar a cuatro ojos:** cerrar una evaluación y que la apruebe otra persona distinta de quien la congeló.
- **Derivación:** aviso que un módulo envía a otro para que actúe, sin crear nada automáticamente.
- **Rótulo provisional:** marca en pantalla que avisa de que un contenido está pendiente de validación.
- **Programa RIA:** plan de trabajo, por fases de F0 a F11, para cubrir en AIMS las obligaciones del Reglamento de IA.
- **Lote de Harvey:** consulta numerada a Harvey (H-01, H-02…) cuyo resultado se archiva con su huella.

**Recorridos del grupo nuevo**
- **Guion del recorrido:** documento del 19-09-2026 que dice qué probar en el grupo nuevo, dividido en bloques numerados (0 a 8) y puntos (por ejemplo, 2.7). Sus sociedades de prueba son 2.1 (matriz SA con Consejo y comisiones), 2.2 (filial A, SL unipersonal) y 2.3 (filial B, SL con administradores solidarios o mancomunados y un socio externo).
- **Tabla de hallazgos:** lista, dentro del guion, donde se anota cada fallo encontrado en un recorrido, con su gravedad.
- **Gravedad:** escala del guion: B bloquea el recorrido; A falta una capacidad; M defecto menor; C confirma algo ya conocido. Un defecto bloqueante es uno de gravedad B.
- **Documento de arranque del grupo nuevo:** el que explica cómo se creó el grupo nuevo y qué decisiones quedan (docs/context/06).
- **Pack base de reglas y plantillas:** copia de las reglas y plantillas societarias comunes con la que nace un grupo nuevo; es la misma pieza que algunos textos llaman paquete base o suelo común.
- **Prueba de aislamiento:** prueba automática que comprueba que cada grupo solo ve sus propios datos.
- **Marca:** colores, nombre y logotipo con que se presenta cada entorno.
- **Ámbitos:** agrupaciones de sociedades que el selector de alcance de la consola usa para filtrar.
- **Procedencia:** anotación que dice de dónde sale un dato (fuente real, simulado o por confirmar).
- **Escenarios de demostración:** casos preparados que simulan un recorrido completo sin escribir datos.
- **Sociedad matriz:** la sociedad que controla a las demás de un grupo. En otros contextos, «matriz» es una tabla de doble entrada (por ejemplo, la matriz de obligaciones del experto).

**Programa RIA y AIMS**
- **Rol regulatorio:** papel de una organización ante un sistema de IA según el RIA (proveedor, responsable del despliegue, importador, distribuidor).
- **Nivel de riesgo:** clasificación del sistema según el RIA (inaceptable, alto, limitado o mínimo).
- **Perfil de aplicabilidad:** combinación de rol y nivel que decide contra qué catálogo de medidas se mide un sistema.
- **Obligación y marco operativo:** una obligación es un deber jurídico; un marco operativo es una buena práctica o una norma técnica que se sigue sin ser obligación autónoma.
- **Cobertura provisional:** aviso de que un catálogo de medidas está pendiente de validación por el Comité de IA. No es lo mismo que el rótulo provisional de las ayudas del cuestionario, que retira el equipo legal.
- **Proveedor posterior:** proveedor de un sistema de IA que integra un modelo de IA, propio o de otra entidad (art. 3.68 del RIA). Si el art. 4 le alcanza lo confirma el equipo legal (MOI-166).
- **Modelo de uso general:** modelo de IA de propósito amplio (capítulo V del RIA) sobre el que se construyen otros sistemas.
- **Obligación de organización:** deber que recae sobre la organización en su conjunto, no sobre un sistema concreto (por ejemplo, la alfabetización en IA del art. 4).
- **Brecha:** medida del catálogo que una evaluación da por no cumplida.
- **Plan de adaptación:** acciones que propone una evaluación para cerrar sus brechas.
- **Expediente técnico:** documentación de un sistema de IA que el RIA exige al proveedor de alto riesgo.
- **Convergencia AIMS–GRC:** análisis del 20-09-2026 que ordena en pasos numerados lo que AIMS y GRC deben compartir.
- **Carril rápido:** parte de la fase F6 que el calendario orientativo sitúa entre el 14 y el 27-11-2026 para llegar al plazo regulatorio del 2-12-2026.
- **Bandeja de alarmas:** pantalla donde AIMS muestra las obligaciones que vencen o ya son exigibles.
- **Sesión de modelo:** sesión que la visión del programa RIA del 19-09-2026 prevé para fijar catálogos de medidas pendientes; ninguna tarea la ha convocado todavía.
- **Documento de verificación del Ómnibus:** cotejo del 19-09-2026 de los puntos del Reglamento Ómnibus con su texto oficial.
- **Códigos del programa:** F2.T13 significa fase F2, tarea 13; H-14 es el lote 14 de Harvey; D-U5 es la decisión 5 del 20-09-2026 del programa RIA; CP-1 a CP-3 son los puntos para el Comité de IA. Otras especificaciones numeran sus decisiones como D-n (por ejemplo, D-5 del diseño del entorno Garrigues del 03-08-2026).
- **Tablas sin uso:** tablas de la base de datos que ninguna pantalla escribe; «reabrir» una es volver a darle camino de escritura.

**Secretaría**
- **Tramitador registral:** pantalla que lleva un acuerdo inscribible hasta el Registro Mercantil.
- **Certificación autónoma:** certificación que no nace de un acta concreta (por ejemplo, de un cargo vigente).
- **Informe preceptivo:** informe que un órgano debe emitir antes de que otro adopte un acuerdo.
- **Co-aprobación y administradores solidarios:** formas de adoptar decisiones con varios administradores (conjuntamente o cualquiera de ellos).
- **Aprobación nominativa:** aprobación de una plantilla que identifica a la persona que la aprueba.
- **Volver a sellar:** recalcular la huella de una plantilla después de que cambie su texto.
- **Preguntas L1 a L12:** preguntas al Comité Legal del plan de cierre de la versión española, del 19-07-2026.
- **Mapa de gobierno:** pantalla que dibuja la estructura del grupo y sus órganos.

**Nombres propios y normas**
- **ARGA Assist, ARGA Score:** sistemas de IA de demostración del grupo ARGA.
- **ARGA Digital:** sociedad de demostración del grupo ARGA.
- **Herramienta de IA propia de Garrigues (GA_IA) y NewLaw:** sistema de IA desarrollado dentro del grupo Garrigues; NewLaw es la sociedad del grupo que lo desarrolla por encargo, según la decisión del 20-09-2026.
- **Copilot:** asistente de IA de un tercero que usa el despacho.
- **Senior Partner, Comité de Práctica Profesional, Código Ético y PI-30:** cargo, órgano y normas internas del despacho que citan sus documentos; PI-30 es su política de uso de la IA.
- **Instructor del canal:** persona que tramita una comunicación del canal interno de información.
- **Ley 2/2023:** ley española de protección de quienes informan sobre infracciones.
- **Solvencia II:** normativa europea de supervisión de las aseguradoras.
- **NIS2:** directiva europea de ciberseguridad.
- **ISO 42001:** norma de sistemas de gestión de la IA.
- **ESG:** información ambiental, social y de gobierno.
- **Política de EAD Trust del 21-07-2026:** regla vigente que limita EAD Trust a interposición, mensajería básica y custodia.

**Siglas**
- **RIA:** Reglamento (UE) 2024/1689 de inteligencia artificial, modificado por el Reglamento Ómnibus 2026/1744.
- **RGPD:** Reglamento General de Protección de Datos.
- **EIPD:** evaluación de impacto relativa a la protección de datos (art. 35 RGPD).
- **DORA:** Reglamento (UE) 2022/2554 de resiliencia operativa digital del sector financiero.
- **ENS:** Esquema Nacional de Seguridad (RD 311/2022).
- **LSC:** Ley de Sociedades de Capital.
- **RRM:** Reglamento del Registro Mercantil.
- **M0 a M4:** hitos de este proyecto.
- **F0 a F11:** fases del programa RIA.

## Estado verificado al corte

Comprobado el 24-09-2026 hacia las 15:45 UTC, en solo lectura. No lo asumas: compruébalo antes de actuar.
- La versión principal y su copia en GitHub están en el mismo punto, el del 14-09-2026 (b1721a5), y esa es la versión publicada en producción (despliegue del 14-09, listo).
- La base de datos de producción va por delante del código publicado: tiene cuatro cambios del 19 y 20-09 (hasta 20260920140000) que solo existen en la rama del programa RIA, sin fusionar y sin copia en GitHub. Por eso dos pruebas automáticas de la versión principal fallan hoy.
- El grupo nuevo existe en la base de datos desde el 19-09 (tres entornos en total), pero su código está sin guardar en git y ninguna de sus pantallas se ha visto todavía.
- Hay 37 copias de trabajo registradas; varias ya no tienen trabajo propio.
- En toda la base de datos hay 0 cuestionarios de clasificación de IA y ninguna evaluación congelada ni revisada.
- Ninguna acta tiene custodia final, así que no se ha emitido ninguna certificación desde la aplicación.


# Issues por hito

## M0 · Base gobernada: código guardado, base de datos y versión publicada casan

### MOI-123 · Repositorio · Poner a salvo en GitHub el programa RIA, que hoy solo existe en este ordenador

Etiquetas: GOS · Plataforma, GOS · Gobierno, GOS · Decisión · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El trabajo del programa RIA hecho el 19 y el 20-09-2026, 41 cambios guardados en git, solo existe en una rama de este ordenador: GitHub no tiene ninguna copia. Cuatro de esos cambios son cambios de base de datos que ya están aplicados en la base de datos de producción, y esa rama es el único sitio donde está escrito su texto. La copia de trabajo temporal donde se hizo ese trabajo quedó rota al limpiarse las carpetas temporales del ordenador; según el inventario del 24-09, lo que queda en ella ya está en la rama, pero nadie lo ha comparado fichero a fichero.

**A quién afecta y qué pasa si no se hace.** Afecta al programa RIA y a quien trabaje después con la base de datos. Si se pierde el disco o alguien borra la rama, se pierden esos 41 cambios y la base de datos de producción queda con una estructura que no está escrita en ningún repositorio. No depende de nada. Bloquea MOI-125 (llevar ese trabajo a la versión principal) y MOI-129 (retirar las copias de trabajo y ramas que sobran), y también MOI-165, MOI-169, MOI-170 y MOI-171, que siguen el programa RIA en esa rama: no deben añadirle trabajo mientras no tenga copia en GitHub.

**Qué resultado buscamos.** La rama del programa RIA copiada en GitHub, idéntica a la de este ordenador, y la copia de trabajo rota quitada de la lista de copias de trabajo de git, después de comparar sus ficheros con la rama. Subir la rama no cambia la versión publicada ni la base de datos.

**Cómo sabremos que está resuelto.** Cualquiera puede consultar la rama en GitHub y comprobar que su último cambio es el mismo que el de este ordenador, del 20-09-2026 a las 11:33. La lista de copias de trabajo de git ya no muestra la temporal rota, y hay un comentario con el resultado de la comparación.

**Qué te toca a ti.** Autorizar, en un comentario de este issue, que el agente suba la rama a GitHub y quite de la lista de copias de trabajo de git la que está rota. Recomendación: autorizarlo ya, porque es la única copia de un trabajo que la base de datos de producción ya usa (criterio técnico del agente). Quitarla de esa lista no borra la carpeta, y el agente se detendrá y te avisará si la comparación encuentra algo que no esté en la rama. Si no autorizas, el trabajo sigue expuesto a perderse y los seis issues que bloquea siguen parados.

### MOI-124 · Repositorio · Decidir cómo llega a la versión principal el trabajo RIA que ya está en la base de datos

Etiquetas: GOS · Plataforma, GOS · RIA, GOS · Decisión · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** La base de datos de producción tiene desde el 19-09-2026 cuatro cambios del programa RIA que solo están en una rama. La versión principal, que es la publicada, es del 14-09-2026 y no los tiene. Por eso fallan dos de sus pruebas sin error real: una espera cinco obligaciones en ARGA y hay seis; la otra, que ninguna obligación de ARGA tenga un comité como responsable. Ambas fallan por el alta de la obligación del art. 4 del RIA.

**A quién afecta y qué pasa si no se hace.** Afecta a quien trabaje desde la versión principal, que no refleja la base de datos, y al programa RIA: publicar el cuestionario v2 (MOI-173, tope 13-11-2026) exige ese trabajo en la versión principal. Las pruebas en rojo empujan a deshacer un alta aplicada en producción. No depende de nada. Bloquea MOI-125, que ejecuta lo que decidas.

**Qué resultado buscamos.** Tu decisión escrita aquí y en el registro del programa RIA, y MOI-125 ajustado a ella. En cualquier opción, las dos pruebas quedan en verde.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con la opción, y el registro del programa RIA y MOI-125 la recogen.

**Qué te toca a ti.** Elegir cómo llega este trabajo a la versión principal; te corresponde porque incorporarlo publica en producción. Los análisis discrepan: el inventario del programa RIA y el de AIMS piden a); el del repositorio, c); el de GRC, a) o b).
- a) Incorporar la rama entera: código, base de datos y versión publicada vuelven a coincidir. Cambian a la vista las pantallas de AIMS de la fase F1, con el rótulo provisional que solo retira el equipo legal.
- b) Llevar solo lo de GRC (tres cambios de base de datos y sus pruebas). Nada cambia a la vista y corrige en la versión principal la copia de la función que reparte las obligaciones entre módulos.
- c) Llevar solo los tres ficheros de prueba corregidos que trae la rama y que resuelven los dos fallos. Es lo más barato, pero, hasta que llegue la rama, quien rehaga la base de datos desde la versión principal clasificará mal 21 obligaciones de Garrigues.
Con b) o c), MOI-125 incorpora el resto de la rama antes del 13-11-2026 y no se cierra hasta entonces.
Recomendación: a), porque publica código ya probado contra la base de datos actual y no deja otra incorporación pendiente (criterio técnico del agente). Si pesa más que la demostración no cambie antes de la revisión del equipo legal, b). Si no decides, no se ejecuta nada (propuesta del agente). La incorporación la autorizas en MOI-125.

### MOI-125 · Repositorio · Incorporar el trabajo RIA a la versión principal, publicarlo y comprobarlo con las cuentas de ARGA y Garrigues

Etiquetas: GOS · Plataforma, GOS · RIA, GOS · Ventana · Asignado: sin asignar · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El trabajo del programa RIA está en una rama. La base de datos de producción ya tiene sus cuatro cambios, pero la versión principal y la publicada, del 14-09-2026, no. Por eso dos pruebas automáticas de la versión principal fallan sin error real, y el repositorio no permite rehacer la base de datos tal como está: volvería a clasificar mal las 21 obligaciones de Garrigues contra el blanqueo. En MOI-124 decides cómo se resuelve; este issue lo ejecuta.

**A quién afecta y qué pasa si no se hace.** Afecta a quien trabaje desde la versión principal y a quien use la demostración: las pruebas en rojo empujan a deshacer altas ya aplicadas en producción. Necesita antes MOI-123 y MOI-124. Bloquea MOI-128, MOI-130, MOI-136, MOI-159, MOI-164, MOI-173, MOI-194 y MOI-55, entre ellos publicar el grupo nuevo (MOI-136) y el cuestionario v2 de la fase F4, con tope el 13-11-2026 (MOI-173). También esperan, sin bloqueo formal, aplicar lo que se decida en MOI-160 y MOI-161, la opción a) de MOI-184 y retirar el aviso de cobertura provisional de MOI-167, que exige el trabajo RIA en la versión principal. Las fases F2, F3 y F5 (MOI-170, MOI-171, MOI-175) siguen en la rama en paralelo y no esperan.

**Qué resultado buscamos.** La opción de MOI-124 probada y publicada: las dos pruebas en verde, sus cambios de base de datos guardados en la versión principal y producción comprobada con las cuentas de ARGA y de Garrigues. Con b) o c), incluye incorporar el resto de la rama antes del 13-11-2026, y no se cierra hasta entonces.

**Cómo sabremos que está resuelto.** Producción sirve la nueva versión y su comprobación, que solo lee, pasa con las dos cuentas; las pruebas automáticas dan cero fallos y las que escriben no dejan restos.

**Qué te toca a ti.** Dos autorizaciones, en comentarios de este issue; con b) o c) se te pedirán otra vez para el resto de la rama:
- Tras ver el ensayo, autorizar dos sondas que crean en Garrigues sistemas de IA de prueba, con una marca que los identifica, y los borran al terminar, y una tercera que solo intenta operaciones que deben rechazarse. Si no, no se ejecutan y la prueba queda declarada incompleta.
- Cuando el agente te enseñe todo en verde, autorizar que incorpore el trabajo a la versión principal y lo suba a GitHub, lo que lo publica. Con a), cubre también el cambio en las pantallas de AIMS de ARGA que declara el registro del programa RIA. Si no, producción sigue con el código del 14-09-2026.

### MOI-126 · Repositorio · Guardar en GitHub el trabajo del grupo nuevo tras pasar todas las pruebas

Etiquetas: GOS · Plataforma, GOS · Grupo nuevo, GOS · Decisión, GOS · Ventana · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El grupo nuevo existe en la base de datos de producción desde el 19-09-2026, pero su código y sus documentos siguen sin guardar en git en la copia de trabajo principal, que comparten varias sesiones: ocho ficheros modificados y trece ficheros o carpetas nuevos, entre ellos el programa que crea un grupo y el pack base de reglas y plantillas del que salió su dato. Desde que existe el tercer grupo nadie ha compilado la aplicación ni ha pasado todas las pruebas. En la misma copia hay material ajeno que no debe guardarse nunca.

**A quién afecta y qué pasa si no se hace.** Si alguien limpia o cambia esa copia, se pierde el único código que sabe crear y comprobar un grupo que ya está en producción; si se guarda sin pasar las pruebas, un fallo entraría sin que nadie lo sepa. No depende de nada. Bloquea MOI-136, que lo incorpora a la versión principal y lo publica, y MOI-130, MOI-133, MOI-134, MOI-135, MOI-139, MOI-141, MOI-152 y MOI-54, que parten de este código.

**Qué resultado buscamos.** El trabajo del grupo nuevo guardado en una rama de GitHub, solo con sus propios ficheros, después de pasar las pruebas completas. La versión principal no se toca: publicarlo es MOI-136.

**Cómo sabremos que está resuelto.** La rama aparece en GitHub con ese trabajo y ningún fichero ajeno, y el documento de arranque del grupo nuevo anota las cifras: compilación correcta; cero fallos, salvo los dos ya conocidos de la versión principal (los resuelve MOI-125), declarados; y la prueba de aislamiento entre los tres grupos en verde.

**Qué te toca a ti.** Tres cosas, en comentarios de este issue:
- Tras ver el ensayo (compilación y pruebas que solo leen, en verde), autorizar que la batería completa ejecute las sondas que crean datos de prueba en la base de datos de producción y los borran después. Si no, no se ejecutan y la prueba queda declarada incompleta.
- Decidir si el documento de instrucciones para agentes lleva una sección propia del grupo nuevo. Recomendación: sí, breve y en un guardado aparte, porque es lo primero que lee cada sesión y hoy no menciona el tercer grupo (criterio técnico del agente). Si no decides, basta la entrada de estado de MOI-130 (propuesta).
- Autorizar que el agente guarde el trabajo en git y suba la rama a GitHub cuando te enseñe las pruebas en verde.
El nombre «Grupo Nuevo» se guarda como provisional; se decide en MOI-131, que no frena este guardado.

### MOI-127 · Repositorio · Rescatar el arreglo que evita que los escenarios de demostración se atribuyan siempre a ARGA

Etiquetas: GOS · Plataforma, GOS · Gobierno · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Los escenarios de demostración son casos preparados que se lanzan desde la consola y simulan un recorrido completo sin escribir datos. Llevan escrito en el programa el identificador de ARGA, así que cualquier grupo que los ejecute los ve atribuidos a ARGA. El arreglo se hizo el 03-08-2026, con su prueba automática, pero quedó en una rama de este ordenador que nunca se incorporó. Además, el panel de la consola solo se muestra en ARGA, pero cada escenario tiene su propia página y nada comprueba el grupo si alguien escribe su dirección en el navegador: así, una persona de Garrigues o del grupo nuevo puede ver un escenario de ARGA como si fuera suyo.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues y al grupo nuevo, que verían como propio contenido de ARGA. Como los escenarios no escriben en la base de datos, no alteran el dato de ARGA. No depende de nada. Bloquea MOI-129: la limpieza de ramas no puede retirar la rama del arreglo hasta que este esté en la versión principal.

**Qué resultado buscamos.** Que los escenarios tomen el grupo de la sesión y no uno fijo; que un grupo distinto de ARGA no pueda abrirlos escribiendo su dirección, porque su contenido es de ARGA; y pruebas automáticas que fallen si vuelve cualquiera de los dos fallos. Todo probado y publicado.

**Cómo sabremos que está resuelto.** Con la cuenta de Garrigues, escribir la dirección de un escenario ya no muestra el de ARGA; el programa publicado ya no contiene el identificador fijo; y las pruebas de los escenarios pasan.

**Qué te toca a ti.** Autorizar, en un comentario, que el arreglo se incorpore a la versión principal cuando el agente te enseñe las pruebas en verde; incorporarlo lo publica en producción. Si el agente detecta que algo de lo que se ve en ARGA cambiaría, te lo dirá antes y tu autorización tendrá que cubrirlo. Si no autorizas, el arreglo queda preparado en una rama y el fallo sigue publicado.

### MOI-128 · Repositorio · Hacer que el repositorio y la base de datos numeren igual los 26 cambios de junio

Etiquetas: GOS · Plataforma, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Veintiséis cambios de base de datos de junio de 2026 figuran con un número en el repositorio y con otro en la base de datos de producción; los nombres coinciden uno a uno, así que son los mismos cambios. Por esa diferencia no se puede usar la herramienta estándar, el programa que compara el repositorio con la base de datos y aplica lo que falta, y cada cambio va por el canal manual: se ejecuta a mano con un acceso directo y se anota a mano en la lista de cambios aplicados. Además, esa herramienta propone una reparación que volvería a ejecutar dos limpiezas de datos de junio sobre una base de datos que ya tiene sembrado el dato de Garrigues, que debe conservarse.

**A quién afecta y qué pasa si no se hace.** Afecta a quien aplique cambios de base de datos: el canal manual es más lento y deja más margen de error. El riesgo grave es que alguien siga esa reparación y borre dato de Garrigues; la política del proyecto la prohíbe, y ninguna salida de este issue la usa. Necesita antes MOI-125, porque la comprobación final exige que la versión principal tenga también los cuatro cambios del programa RIA. No bloquea a otros issues.

**Qué resultado buscamos.** Tu decisión registrada y, si eliges renombrar, el repositorio con los números de producción y la herramienta estándar otra vez utilizable, sin tocar la base de datos.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con la opción. Si es a), el ensayo de la herramienta, que no aplica nada, termina sin echar en falta números y sin proponer ningún cambio que aplicar.

**Qué te toca a ti.** Elegir cómo se cuadra la numeración; te corresponde porque a) cambia la versión principal, y eso se publica, aunque no cambie nada de lo que se ve ni la base de datos.
- a) Renombrar en el repositorio los 26 ficheros al número de producción. Solo toca el repositorio, no arriesga el dato, se puede deshacer y devuelve el uso de la herramienta estándar. Coste: un trabajo pequeño del agente.
- b) Dejarlo como está y seguir con el canal manual. No cuesta nada ahora; cada cambio futuro sigue exigiendo registro a mano.
Recomendación: a), porque solo toca el repositorio y es reversible (criterio técnico del agente que analizó el pendiente). Mientras decides, se sigue con el canal manual y nadie usa la herramienta estándar salvo en modo ensayo. Si no decides, rige b) (propuesta). Si eliges a), autoriza en el mismo comentario incorporar el cambio a la versión principal.

### MOI-129 · Repositorio · Retirar las copias de trabajo, ramas y restos que ya no se usan

Etiquetas: GOS · Plataforma, GOS · Gobierno, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Hay 37 copias de trabajo registradas, cuando la regla es trabajar en una: 30 de agentes (28 de un trabajo de junio, con 1 a 5 ficheros cambiados, y dos con 45 y 48 cambios sin guardar), 4 de Codex ya incorporadas, la temporal rota del programa RIA, la principal y la archivada de mayo. De 53 ramas locales, 44 ya están incorporadas y 9 no: la del programa RIA y sus 6 ramas auxiliares, contenidas en ella; la del arreglo de MOI-127; y una de informes que ya entró con otro nombre. GitHub tiene dos ramas ya incorporadas. Quedan 8 conjuntos de cambios apartados en mayo que las instrucciones declaran superados, y una carpeta de restos del 19-09-2026.

**A quién afecta y qué pasa si no se hace.** Afecta a quien trabaje en el repositorio: el ruido esconde lo importante, los cambios sin guardar de junio no tienen dueño y la carpeta de restos puede colarse al guardar. Necesita antes MOI-123 y MOI-127. No bloquea otros issues.

**Qué resultado buscamos.** Tu decisión registrada y, ejecutada, solo la copia principal, la archivada y las que decidas conservar; solo ramas vivas; y sin la carpeta de restos.

**Cómo sabremos que está resuelto.** Un comentario tuyo recoge la decisión, y los listados de copias y ramas, aquí y en GitHub, muestran solo lo que decidiste conservar.

**Qué te toca a ti.** Decidir qué se descarta y autorizar el borrado; nada se descarta sin tu decisión expresa.
- a) Retirar las copias de agentes y de Codex tras guardar sus cambios, borrar las ramas incorporadas y conservar los 8 conjuntos apartados.
- b) Lo mismo y borrar esos 8 conjuntos: más limpio, pero pierde un histórico que las instrucciones conservan a propósito.
- c) No tocar nada: coste cero y el ruido sigue.
En a) y b) se borran también la rama de informes y, cuando la rama RIA esté en GitHub (MOI-123), sus 6 auxiliares; en c) siguen.
Recomendación: a), porque, hecho MOI-127, todo lo guardado en git estará en la versión principal o en la rama RIA, y lo no guardado quedará copiado (criterio técnico del agente). Si no decides, rige c) (propuesta).
Sobre los 45 y 48 cambios, propuesta: el agente los guarda y resume, y tú decides si alguno vale. Dónde guardarlos: una carpeta junto al repositorio; una rama de archivo aquí, que vuelve a sumar ramas; o GitHub, con tu autorización. Recomendación: la carpeta, como la copia archivada de mayo, porque no se limpia sola ni añade ramas (criterio técnico del agente). La carpeta de restos la borras tú o autorizas borrarla.

### MOI-130 · Repositorio · Poner al día el documento de instrucciones para agentes con el estado real de hoy

Etiquetas: GOS · Plataforma, GOS · Gobierno · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El documento de instrucciones que leen los agentes al empezar, en la versión principal, describe un estado antiguo. Da como último cambio de base de datos uno del 14-09-2026, cuando producción ya va por el del 20-09. Dice que la herramienta de la base de datos no funciona por un acceso caducado, cuando hoy al menos la consulta de la lista de cambios responde. Dice que falta cerrar en el panel el alta libre de usuarios, que se cerró el 05-09-2026. Su apartado de última verificación es del 07-09-2026, y no menciona los cuatro cambios del 19 y 20-09, la rama RIA ni el grupo nuevo.

**A quién afecta y qué pasa si no se hace.** Afecta a la próxima sesión de cualquier agente o de Codex: arrancará con premisas falsas, buscará un acceso que ya no hace falta y creerá que la versión principal coincide con la base de datos. Necesita antes MOI-125 y MOI-126, para que el documento recoja el estado que dejan la incorporación del trabajo RIA y el guardado del grupo nuevo, y no uno que caducaría en días. No bloquea a otros issues.

**Qué resultado buscamos.** El documento corregido en esos puntos, con una entrada fechada el día en que se haga que describa el estado medido entonces: último cambio de base de datos, cómo llegó el trabajo RIA a la versión principal y qué quedó fuera, dónde está guardado el grupo nuevo y el resultado de las pruebas. Si en MOI-126 decides que el grupo nuevo no lleve sección propia, esta entrada lo cubre. Todo probado y publicado.

**Cómo sabremos que está resuelto.** Una búsqueda en el documento de la versión principal ya no presenta esos datos antiguos como vigentes, y hay una entrada fechada con el estado posterior a MOI-125 y MOI-126.

**Qué te toca a ti.** Autorizar, en un comentario, que el agente incorpore el cambio a la versión principal cuando te enseñe el texto. Incorporarlo publica automáticamente en producción, aunque este documento no cambia nada de lo que se ve en la aplicación.

### MOI-205 · Plataforma · Quitar a los usuarios el permiso de vaciar tablas enteras

Etiquetas: GOS · Plataforma, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** En la base de datos de producción, los usuarios sin sesión conservan el permiso de vaciar de golpe 127 tablas, y los usuarios con sesión, 128. Entre ellas están las de acuerdos, reuniones, actas, convocatorias, certificaciones y la foto inmutable del censo de socios. Vaciar una tabla entera no pasa por las reglas que separan los datos de cada grupo ni por las protecciones que actúan fila a fila.

**A quién afecta y qué pasa si no se hace.** Afecta a los tres entornos a la vez, porque esas tablas guardan el dato de ARGA, de Garrigues y del Grupo Nuevo. Hoy la aplicación no ofrece ningún camino para usar ese permiso, pero es la única defensa que falta: si alguno se abriera, se podría borrar de una vez el dato de todos los grupos. Es la misma trampa que ya se quitó en AIMS y en los expedientes registrales. Como es un hueco de seguridad que no depende de nada, se adelanta al hito M0; no bloquea otras tareas.

**Qué resultado buscamos.** Que ninguno de los dos tipos de usuario pueda vaciar esas tablas ni crear sobre ellas automatismos o referencias. Los permisos de leer y escribir fila a fila quedan como están, y el ensayo lo comprobará. Si el agente puede evitar también que las tablas que se creen en el futuro nazcan con ese permiso, lo incluye en este mismo cambio, y lo cubre la misma autorización.

**Cómo sabremos que está resuelto.** La lista de permisos de la base de datos ya no muestra el de vaciar para ninguno de los dos tipos de usuario en esas tablas, y una prueba de control confirma que leer y añadir filas sigue funcionando como antes. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, aplicar el cambio de base de datos, incluido lo de las tablas futuras si es posible, cuando el agente te enseñe el ensayo hecho en una operación que se deshace al final, y después su incorporación a la versión principal, para que el código guardado y la base de datos coincidan. Sin tu autorización no se aplica.

### MOI-211 · Repositorio · Comprobar hoy que la versión publicada funciona con la base de datos actual

Etiquetas: GOS · Plataforma, GOS · Gobierno, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** La versión publicada es la del 14-09-2026, comprobada por última vez ese día. El 19 y el 20-09 la base de datos de producción recibió cuatro cambios del programa RIA: reglas sobre el autor de cada comprobación de una evaluación de IA; las obligaciones de prevención del blanqueo de Garrigues pasan a su propio módulo de GRC; aparece un módulo de IA en GRC de ARGA y de Garrigues; y la obligación del art. 4 se añade en los dos entornos, con lo que ARGA pasa de 5 a 6 obligaciones, con una sección nueva, y Garrigues queda en 29. El código parece compatible, pero nadie lo ha visto en producción.

**A quién afecta y qué pasa si no se hace.** Afecta a quien entre hoy en ARGA o en Garrigues, que ya ve esos cambios sin comprobar. Si guardar una evaluación de IA fallara en producción no lo sabríamos, y la reevaluación de Harvey (MOI-154, relacionada) usará este código. En el grupo nuevo fallaría, porque sus cuentas no están enlazadas a personas (lo resuelve MOI-133). No bloquea ni espera a otro issue; sirve de dato para MOI-124.

**Qué resultado buscamos.** Saberlo con pruebas en dos partes. Primero, en solo lectura: la comprobación automática con los accesos de ARGA y de Garrigues, una revisión de las pantallas de obligaciones y GRC y un ensayo, que se deshace solo, del guardado de una evaluación. Después, las sondas de AIMS que crean sistemas de prueba en ARGA y en Garrigues y los borran; por esta parte lleva la etiqueta Ventana.

**Cómo sabremos que está resuelto.** La comprobación pasa en los dos entornos sin errores, hay capturas, el ensayo guarda la evaluación como la versión publicada y las sondas no dejan filas de prueba. Todo consta en un comentario antes de MOI-154. Nivel exigido: probado.

**Qué te toca a ti.** La primera parte no necesita nada de ti. Para la segunda, autorizar en un comentario, después de ver el ensayo, que las sondas escriban y borren esos sistemas de prueba en producción. Conviene hacerla antes de aplicar lo que decidas en MOI-210.

## M1 · Grupo desde cero y Secretaría operativa

### MOI-131 · Grupo nuevo · Confirmar o cambiar el nombre «Grupo Nuevo» del tercer entorno

Etiquetas: GOS · Grupo nuevo, GOS · Decisión · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El tercer entorno se llama «Grupo Nuevo» porque el asistente de IA que creó el grupo el 19-09-2026 eligió ese nombre por defecto, y nadie lo ha confirmado. El nombre ya está escrito en la base de datos de producción, los identificadores de sus 58 packs de reglas empiezan por «GN» y las direcciones de correo de sus dos cuentas también lo llevan.

**A quién afecta y qué pasa si no se hace.** Te afecta a ti y a quien vea el entorno: el nombre sale en la pantalla de acceso, en la cabecera y en los rótulos del grupo. Cuanto más dato se cree en el recorrido, más caro será cambiarlo, porque el prefijo «GN» de las reglas y los correos no se renombran repitiendo la carga inicial. Bloquea MOI-53.

**Qué resultado buscamos.** Tu decisión registrada antes de que empiece el recorrido, y el nombre definitivo anotado en el documento de arranque del grupo nuevo, ya sin la nota de «pendiente».

**Cómo sabremos que está resuelto.** Hay un comentario tuyo en este issue con la decisión, y el documento de arranque recoge el nombre sin decir que está pendiente de confirmar. Si lo cambias, la pantalla de acceso y la cabecera muestran el nombre nuevo, y ARGA y Garrigues quedan igual.

**Qué te toca a ti.** Decidir el nombre del entorno, porque es identidad del producto y te corresponde. Opciones:
- A) Confirmar «Grupo Nuevo». Coste cero y el recorrido de MOI-53 puede empezar ya. Un nombre neutro sirve para un grupo que es plantilla de alta y no cliente.
- B) Cambiarlo. El agente toca dos piezas del programa y vuelve a cargar la marca del grupo (nombre y rótulos) en la base de datos de producción, con tu autorización escrita después de ver el ensayo. Los correos y el prefijo «GN» seguirían con el nombre antiguo salvo que decidas expresamente cambiarlos; ese coste no está estimado.

Recomendación: A, porque el grupo es una plantilla de alta y no un cliente (criterio técnico y de coste del agente que preparó el inventario). Si pesa más un criterio comercial, por ejemplo enseñarlo a un cliente con un nombre concreto, elegiría B. Mientras no decidas rige, como propuesta, el nombre ya escrito, «Grupo Nuevo»; MOI-53 espera y conviene no crear datos en el entorno.

### MOI-132 · Grupo nuevo · Decidir si el primer recorrido del grupo nuevo se hace en local o en la versión publicada

Etiquetas: GOS · Grupo nuevo, GOS · Decisión · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Nadie ha visto todavía ninguna pantalla del grupo nuevo. La versión publicada en producción es la del 14-09-2026 y no conoce el tercer entorno: quien entra por su enlace ve la pantalla de acceso de ARGA y, según el código, su cuenta sería rechazada. La cuenta de administración del grupo nuevo no ha iniciado sesión nunca, y la de secretario solo lo hizo una vez, el 19-09-2026, durante una prueba automática.

**A quién afecta y qué pasa si no se hace.** Te afecta a ti, que harás el recorrido. Mientras no se decida dónde se abre el entorno, el recorrido por pantalla no puede empezar. Bloquea MOI-53.

**Qué resultado buscamos.** Tu decisión registrada sobre dónde se hace el primer recorrido, y el entorno abierto en ese sitio con su pantalla de acceso funcionando.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con la decisión, y en el sitio elegido el enlace del grupo nuevo muestra la tarjeta «Grupo Nuevo» y la cuenta de secretario entra en su propio entorno.

**Qué te toca a ti.** Elegir dónde se abre el entorno por primera vez; te corresponde porque una de las opciones publica en producción. Opciones:
- A) En local, en este ordenador. El agente arranca la aplicación desde la copia de trabajo y tú entras por el enlace del grupo nuevo. Es inmediato, no expone nada y no exige guardar antes el trabajo en git.
- B) En la versión publicada. Exige antes guardar el trabajo con las pruebas pasadas (MOI-126), resolver las contraseñas (MOI-135), incorporar el trabajo RIA (MOI-125) y publicarlo con tu autorización (MOI-136). Producción quedaría con el tercer entorno, oculto salvo para quien tenga el enlace. Al registrar tu decisión, el agente retira el bloqueo de MOI-53 sobre MOI-136 para que MOI-136 vaya primero.

En los dos casos, lo que crees en el recorrido queda en la base de datos de producción, que es la única del proyecto. Recomendación: A para el primer recorrido y B cuando las pruebas estén en verde, por rapidez y por no exponer nada (criterio técnico del agente que preparó el inventario). Si pesa más enseñarlo desde la dirección pública, elegiría B. Si no decides, el plan sigue con A (propuesta).

### MOI-53 · Gobernanza · Dar de alta un grupo desde cero sin datos demo

Etiquetas: GOS · Grupo nuevo · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El grupo nuevo existe en la base de datos desde el 19-09-2026: el equipo lo creó por carga automática, con sus dos cuentas y el pack base de reglas y plantillas. Nadie lo ha recorrido por pantalla: no tiene sociedades, personas ni órganos. Crear grupo y administrador desde la aplicación no es posible; se decide en MOI-147.

**A quién afecta y qué pasa si no se hace.** Te afecta a ti, que haces el recorrido. Sin personas ni sociedades no se prueba el ciclo societario ni AIMS, y un rótulo de ARGA que asome un instante al cargar solo se ve en el navegador. Antes tienen que estar resueltas MOI-131 y MOI-132. Bloquea MOI-15, MOI-133, MOI-134, MOI-136, MOI-55, MOI-57, MOI-146 y MOI-147.

**Qué resultado buscamos.** Las personas ficticias y las tres sociedades del guion del recorrido, creadas solo por pantalla y con los hallazgos anotados: la matriz anónima (2.1), la filial A unipersonal (2.2) y la filial B (2.3), limitada con administradores solidarios o mancomunados y un socio externo.

**Cómo sabremos que está resuelto.** La tabla de hallazgos del guion tiene rellenos los puntos de los bloques 0, 1, 2 y 8, con captura o texto literal de cada anomalía o «sin hallazgos». Hay tres sociedades con su estado anotado, y el punto 2.7 tiene el resultado de sus dos huecos.

**Qué te toca a ti.** Hacer el recorrido en el navegador según el guion, sin cargas automáticas ni retoques en la base de datos. Usa un perfil de navegador por entorno (las pestañas comparten sesión) y entra también como ARGA y Garrigues para comprobar que no ven nada del grupo nuevo. El punto 2.7 prueba dos huecos: crear una comisión en 2.1 tras el alta, con «Crear órgano» del catálogo de órganos (existe según el código, aunque el guion espera que no), y cambiar la matriz o el porcentaje de 2.3. No uses nombres de sociedad o persona que la aplicación toma por datos de prueba, como los que empiezan por «Prueba» (lista en el detalle técnico): los oculta y la sociedad no podría convocar.

### MOI-54 · Gobernanza · Separar núcleo común, configuración de grupo y simulaciones

Etiquetas: GOS · Grupo nuevo, GOS · Plataforma · Asignado: sin asignar · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El producto todavía mezcla lo común a todos los grupos con lo propio de ARGA, que es el valor por defecto: un grupo sin marca propia recibe los rótulos y los ámbitos de ARGA, y uno con marca pero sin ámbitos, como el grupo nuevo, recibe un único ámbito general. Si un grupo no declara sus módulos, se le abren todos, y la aplicación no distingue «aún cargando», «sin configurar» y «lista vacía a propósito». El órgano de gobierno de la IA y los responsables del canal interno están escritos dentro del programa, no como datos de cada grupo. Las instrucciones del repositorio anotan correos de ejemplo de ARGA en varios asistentes; hoy solo se localiza uno, de reserva, en el menú de usuario. El 19-09-2026 el equipo resolvió una parte, solo en la copia de trabajo (la guarda MOI-126 y la publica MOI-136): los datos de ejemplo de ARGA dejan de verse en el inicio, ESG y notificaciones de un grupo que lo declara; la pantalla de conflictos y la ficha de órgano, todavía no.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que empiece desde cero y a la aceptación final: cada grupo nuevo exigiría tocar el programa y podría heredar rótulos o reglas de ARGA. Necesita antes MOI-126, porque parte de ese código sin guardar. Bloquea MOI-57. MOI-15 y MOI-55 pasan a relacionadas: sus recorridos no necesitan la separación completa.

**Qué resultado buscamos.** Que marca, módulos activos, ámbitos, órgano de IA y responsables del canal sean configuración de cada grupo, con su procedencia, sin heredar nada de ARGA ni de Garrigues y sin cambiar lo que ve ARGA. Esta tarea fija dónde y cómo se guarda esa configuración; los valores concretos van en MOI-150, MOI-151 y MOI-193, relacionadas y no absorbidas, donde decides o validas tú a propuesta del agente.

**Cómo sabremos que está resuelto.** Unas pruebas automáticas comprueban que un grupo sin configuración propia no muestra rótulos ni correos de ARGA, que se distinguen los tres estados de los módulos y que ARGA y Garrigues ven lo mismo que antes.

**Qué te toca a ti.** Nada mientras sea trabajo en una rama. Autorizarás por escrito, después de ver el ensayo, cualquier cambio del dato o de las pantallas de ARGA (por ejemplo, declarar su marca en la base de datos para que deje de ser el valor por defecto) y cualquier cambio de base de datos en producción; y, con las pruebas en verde, la incorporación a la versión principal, que lo publica.

### MOI-15 · Secretaría · Validar el ciclo societario y documental en un grupo nuevo

Etiquetas: GOS · Secretaría, GOS · Grupo nuevo · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El grupo nuevo tiene cargado desde el 19-09-2026 el pack base de reglas y plantillas: 5 conjuntos de reglas generales de España (antelación, quórum y mayorías por defecto), 58 packs de reglas por materia y 72 plantillas vigentes. Nadie ha resuelto aún una materia desde pantalla; hay 0 reuniones y los acuerdos no se han contado. Tampoco sabemos si un grupo desde cero puede convocar, adoptar acuerdos y sacar su acta.

**A quién afecta y qué pasa si no se hace.** Te afecta a ti, que lo aceptas. Es la prueba completa de Secretaría en el grupo nuevo. Bloquea MOI-16, MOI-56, MOI-57 y MOI-147, y también MOI-32, del proyecto «Common AI Platform», que espera de aquí el mapa documental (identidad, versión y procedencia de cada documento). Antes tiene que estar hecho MOI-53, que crea las personas y las sociedades; ya no espera a MOI-54.

**Qué resultado buscamos.** El marco normativo activado en la sociedad matriz y los diez caminos del ciclo societario recorridos y anotados: Consejo hasta el acta, Junta de cuentas, acuerdo sin sesión, socio único, administradores solidarios y co-aprobación, tramitador registral, certificación, libros, comunicaciones y calendario, e informe ejecutivo. Como mínimo, un acta del Consejo descargable o el error literal que lo impide.

**Cómo sabremos que está resuelto.** La tabla de hallazgos tiene anotados los bloques 3 y 4 del guion, con el resultado o el error literal de cada camino, y el agente declara qué criterios previos quedan cubiertos.

**Qué te toca a ti.** Hacer el recorrido en el navegador con las dos cuentas del grupo nuevo, donde decidas en MOI-132, y convocar el Consejo para una hora del mismo día, porque la reunión no se abre antes. Anota como ya conocido, no como nuevo: que la Junta aún no emite convocatoria ni genera acta (MOI-142 y MOI-143); que la certificación queda bloqueada sin custodia final (MOI-144); y los restos de MOI-54: rótulos y un correo de ARGA que salen por defecto, y todos los módulos abiertos.

### MOI-16 · Gobernanza · Verificar comunicaciones y custodia en el alcance del prototipo

Etiquetas: GOS · Secretaría, GOS · Plataforma · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Secretaría tiene piezas de comunicación y custodia con EAD Trust: la programación de comunicaciones (una cola que su código atiende cada minuto), el registro en servidor de la convocatoria final y sus anexos, y un paso de custodia de actas. Nadie ha comprobado por operación y entorno qué hace cada una. Hoy ninguna acta tiene custodia final ni hay certificaciones emitidas desde la aplicación.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría y a quien presente el producto: sin este inventario, una pantalla o un informe puede sugerir firmas, envíos o entregas que no han ocurrido. Bloquea MOI-57 y también MOI-34, del proyecto «Common AI Platform», que espera de aquí los contratos técnicos comunes de comunicaciones y confianza. Antes tiene que estar hecho MOI-15: la comprobación se repite sobre su expediente del grupo nuevo.

**Qué resultado buscamos.** Una tabla con cada operación de comunicación y custodia: su contrato técnico (qué recibe y qué devuelve), su entorno, el resultado real y su justificante, dentro de la política de EAD Trust del 21-07-2026. Además, la propuesta, sin construir, de cómo conectar desde el servidor con el proveedor, y la prueba de que el grupo nuevo no afirma nada más.

**Cómo sabremos que está resuelto.** La tabla dice, para ARGA, Garrigues y el grupo nuevo, qué hace cada operación y con qué justificante; ninguna pantalla del grupo nuevo dice que algo se firmó, se envió o se entregó; y la certificación aparece bloqueada con su motivo.

**Qué te toca a ti.** Autorizar, cuando se te pida, incorporar la tabla a la versión principal, que publica. La comprobación es de solo lectura: si hace falta escribir en la base de datos de producción o llamar de verdad a EAD Trust, quien ejecuta se detiene; la llamada exige antes la confirmación de MOI-216 y tu decisión en MOI-144, donde decides la custodia final y apruebas la propuesta de conexión. Retirar los tipos de certificación que afirman envío o firma va en MOI-145.

### MOI-133 · Grupo nuevo · Enlazar las dos cuentas del grupo nuevo a personas de su censo

Etiquetas: GOS · Grupo nuevo, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Las dos cuentas del grupo nuevo no están enlazadas a ninguna persona de su censo, y la aplicación no tiene ninguna pantalla para hacerlo. Desde el 19-09-2026 la base de datos de producción exige que quien guarda una comprobación de IA sea una persona identificada: si la cuenta no tiene persona, rechaza la escritura. En ARGA y Garrigues todas las cuentas tienen persona; en Garrigues se enlazaron con un cambio de base de datos el 14-09-2026.

**A quién afecta y qué pasa si no se hace.** Afecta a quien recorra AIMS en el grupo nuevo: guardar una evaluación de IA fallará, y parecerá un error del producto cuando lo que falta es un dato previo. Revisar a cuatro ojos necesita además dos personas distintas, y el saludo y la autoría se quedan genéricos. Antes tienen que estar hechas MOI-53, porque el grupo tiene hoy cero personas y se crean en ese recorrido, y MOI-126, porque el cambio se guarda en la rama del grupo nuevo. Bloquea MOI-55.

**Qué resultado buscamos.** Cada cuenta enlazada a una persona distinta del censo del grupo nuevo, sin que eso permita cambiar de grupo ni de rol, y el guion del recorrido avisando de que este paso va antes de AIMS. Si además se construye una pantalla para enlazarlas, se decide en MOI-147.

**Cómo sabremos que está resuelto.** Ninguna cuenta del grupo nuevo queda sin persona, y una prueba que se deshace al final comprueba que el grupo nuevo ya puede guardar comprobaciones de IA sin error. ARGA y Garrigues no cambian.

**Qué te toca a ti.** Cuando existan las personas, confirmar qué persona corresponde a cada cuenta y autorizar en un comentario el cambio de base de datos, después de que el agente te enseñe el ensayo. Su texto se guarda en la rama del grupo nuevo y llega a la versión principal con MOI-136; si MOI-136 ya se hizo, autorizas también esa incorporación, que publica. Si no autorizas el cambio, AIMS no se podrá probar en el grupo nuevo.

### MOI-134 · Grupo nuevo · Que el menú de usuario no mande a otro entorno ni impida volver al propio

Etiquetas: GOS · Grupo nuevo · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** El menú de usuario ofrece siempre saltar a otro entorno. En las pantallas generales propone «Cambiar a Entorno Garrigues»; en las de Secretaría, GRC y AIMS propone «Cambiar a Entorno Corporativo», que lleva al acceso de ARGA. Para alguien del grupo nuevo, ninguna de las dos le devuelve a su propio entorno, y como la pantalla de acceso sin enlace no muestra el grupo nuevo, una vez fuera tiene que volver a escribir su enlace.

**A quién afecta y qué pasa si no se hace.** Afecta a los usuarios del grupo nuevo y a cualquier grupo futuro que entre por su propio enlace. Es un defecto menor y ya conocido: estorba y enseña a un usuario del grupo nuevo que existen otros entornos. Antes tienen que estar hechas MOI-53, donde se anota si molesta en el recorrido, y MOI-126, porque el arreglo parte del código del grupo nuevo, hoy sin guardar. No bloquea ninguna otra tarea.

**Qué resultado buscamos.** Que el menú de un usuario del grupo nuevo no le lleve a otro entorno, mientras ARGA y Garrigues conservan su menú tal como está. Propuesta, por criterio técnico del agente: fuera de ARGA y Garrigues, el menú deja de ofrecer el cambio de entorno, que es el arreglo más pequeño y encaja con que el grupo nuevo solo se vea por su enlace. La alternativa es sustituirlo por una entrada para volver al propio entorno.

**Cómo sabremos que está resuelto.** Una prueba automática del menú, con una cuenta del grupo nuevo, comprueba que no aparece ningún destino que no le devuelva a su entorno, y otra comprueba que los menús de ARGA y Garrigues no cambian.

**Qué te toca a ti.** Autorizar, en un comentario, que el arreglo se incorpore a la versión principal cuando el agente te enseñe las pruebas en verde; incorporarlo lo publica, y puede ir junto a MOI-136. Si prefieres la alternativa a la propuesta, dilo en ese comentario. Lo que observes del menú durante el recorrido lo anotas en MOI-53, punto 0.6.

### MOI-135 · Grupo nuevo · Incluir las cuentas del grupo nuevo en la gestión de contraseñas de demostración

Etiquetas: GOS · Grupo nuevo, GOS · Plataforma · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Las contraseñas de demostración no están en el repositorio: cada copia de trabajo las guarda en un fichero local que no se sube a GitHub. Las dos cuentas del grupo nuevo comparten una contraseña, en una sola variable que solo está en la copia de trabajo principal, de 37 registradas. El cambio de contraseñas solo cubre las cuentas de ARGA y Garrigues, y las pruebas automáticas de pantalla solo saben entrar en esos dos entornos.

**A quién afecta y qué pasa si no se hace.** Afecta a quien ejecute pruebas en otra copia de trabajo: cuando el trabajo del grupo nuevo llegue a la versión principal, su prueba de aislamiento se pondrá en rojo allí por falta de la contraseña, y la salida fácil sería desactivarla. Un cambio de contraseñas dejaría la del grupo nuevo sin cambiar, en silencio. Antes tiene que estar hecha MOI-126, porque estos cambios parten del código sin guardar del grupo nuevo. Bloquea MOI-136. Relacionada con MOI-153, que añadirá al cambio de contraseñas la cuenta de cumplimiento de ARGA.

**Qué resultado buscamos.** La variable del grupo nuevo documentada por su nombre, sin su valor, junto a las otras; presente en las copias de trabajo que sigan vivas; y las dos cuentas del grupo nuevo incluidas en el cambio de contraseñas y en las pruebas automáticas.

**Cómo sabremos que está resuelto.** En una copia de trabajo distinta de la principal, la prueba de aislamiento del grupo nuevo pasa en verde. El ensayo del cambio de contraseñas, sin cambiar nada, lista las tres cuentas de ARGA y Garrigues y las dos del grupo nuevo.

**Qué te toca a ti.** Copiar tú la contraseña del grupo nuevo a las copias de trabajo vivas, o decidir en MOI-129 cuáles se retiran; el agente no puede leer ni mostrar contraseñas. Los cambios del agente llegan a la versión principal con MOI-136, donde autorizas esa incorporación. Si quieres cambiar de verdad las contraseñas, pones tú los valores nuevos en el fichero local y autorizas por escrito el cambio después de ver el ensayo.

### MOI-136 · Grupo nuevo · Incorporar a la versión principal y publicar el trabajo del grupo nuevo

Etiquetas: GOS · Grupo nuevo, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El código del grupo nuevo no está en la versión principal: vive solo en la copia de trabajo de este ordenador, aunque el grupo existe en la base de datos de producción desde el 19-09-2026. La versión publicada no conoce el tercer entorno: quien entra por su enlace ve la pantalla de acceso de ARGA en vez de la del grupo nuevo.

**A quién afecta y qué pasa si no se hace.** Afecta a la aceptación final: sin esto, el grupo nuevo solo se puede usar en local, y producción y la base de datos siguen sin coincidir. Antes tienen que estar hechas MOI-126 (el trabajo guardado en una rama de GitHub con las pruebas pasadas), MOI-135 (las contraseñas del grupo nuevo en pruebas y copias de trabajo), MOI-53 (el primer recorrido por pantalla) y MOI-125 (el trabajo RIA incorporado, porque hasta entonces la versión principal tiene dos pruebas en rojo). Bloquea MOI-57.

**Qué resultado buscamos.** El trabajo del grupo nuevo incorporado a la versión principal y publicado, sin arrastrar material ajeno, con el tercer entorno accesible solo por su enlace y con ARGA y Garrigues exactamente como estaban.

**Cómo sabremos que está resuelto.** Producción sirve la versión incorporada y se entra en los tres entornos: la comprobación automática de solo lectura entra con ARGA y Garrigues y sale en verde, y tú entras por el enlace del grupo nuevo, ves su tarjeta y llegas a su entorno con la cuenta de secretario. Sin enlace, la pantalla de acceso sigue mostrando solo ARGA y Garrigues.

**Qué te toca a ti.** Autorizar por escrito, en un comentario, la incorporación de la rama del grupo nuevo a la versión principal, que la publica. El agente te lo pedirá cuando MOI-125, MOI-126, MOI-135 y MOI-53 estén hechas, enseñándote qué ficheros entran. Después, entrar tú con la cuenta de secretario del grupo nuevo para confirmarlo. Si en MOI-132 eliges abrir el primer recorrido en la versión publicada, esta tarea pasa por delante de MOI-53. Si no autorizas, el grupo nuevo solo se usará en local.

### MOI-137 · Secretaría · Dejar de presentar como «aprobadas legalmente» plantillas aprobadas con un marcador de demostración

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Las pantallas Plantillas y Gobierno de plantillas rotulan «Aprobada legalmente» toda plantilla vigente que tenga algo escrito en el campo de quién la aprobó, sin mirar qué dice, salvo que tenga otro defecto marcado (versión provisional, falta de referencia legal o de órgano, o duplicidad). De las 150 plantillas vigentes (72 de ARGA, 6 de Garrigues y 72 del grupo nuevo), 118 llevan en ese campo la marca «demo»: declaran ellas mismas que su aprobación es de demostración. El control al activar una plantilla solo rechaza textos que empiezan por «falta» o «pendiente». Hay otro camino al mismo rótulo: un informe del Comité Legal del 01-05-2026 que se aplica por tipo de plantilla en cualquier entorno.

**A quién afecta y qué pasa si no se hace.** Afecta a quien use o enseñe Secretaría en los tres entornos: la aplicación afirma una aprobación jurídica formal que la propia plantilla desmiente, y el grupo nuevo lo hereda. No depende de otra tarea. Bloquea MOI-200, que ata cada plantilla a la huella del texto aprobado. Se coordina con MOI-139 y MOI-141, cuyas versiones nuevas pasarán por esta regla; qué acredita una aprobación es MOI-199 y no bloquea este cambio.

**Qué resultado buscamos.** Que ninguna plantilla con marca de demostración se presente como «Aprobada legalmente»: pasará a rotularse «Vigente sin aprobación nominativa». La misma regla se aplicará al activar plantillas y en el servidor.

**Cómo sabremos que está resuelto.** Un tercero abre las dos pantallas en los tres entornos y no ve ninguna plantilla con marca de demostración rotulada como aprobada, y una prueba automática se pone en rojo si alguna vuelve a concederlo. Queda probado y publicado.

**Qué te toca a ti.** Decidir si el informe del 01-05-2026 sigue bastando para el rótulo y dónde. Recomendación: que valga solo en ARGA, donde se emitió (criterio técnico del agente); si vale en todos, las copias del grupo nuevo seguirán rotuladas como aprobadas por un informe de ARGA. Mientras decides, ese camino queda como hoy (propuesta). Y autorizar en comentarios, cuando el agente te lo pida: el cambio de base de datos de la función que activa plantillas, tras ver su ensayo; el cambio visible en ARGA, donde las plantillas con la marca dejarán de decir «Aprobada legalmente»; y la incorporación a la versión principal, que lo publica.

### MOI-138 · Comité Legal · Fijar las citas y los regímenes legales correctos en plantillas y reglas

Etiquetas: GOS · Comités, GOS · Secretaría · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Varias plantillas y reglas vigentes llevan citas o regímenes legales dudosos que llegan al papel. En ARGA, 4 plantillas citan el Real Decreto 84/2015 como desarrollo de la Ley 20/2015 de aseguradoras; 8 ponen variables de EAD Trust en sus rótulos de firma o sello; y 1 cita el art. 14 de esa ley, que la revisión del 05-09-2026 marcó como dudosa sin decir por qué. 9 versiones vigentes de packs de reglas fundan plazos en el art. 17 RRM, que trata de competencia territorial, y 7 en el art. 19 RRM (por ejemplo, 60 días en modificación de estatutos), que esa revisión reservó al Comité sin detallar el fallo; 3 materias nombran la Ley de Modificaciones Estructurales, derogada. Las plantillas de fusión reconocen un «derecho de oposición» de los acreedores que el Real Decreto-ley 5/2023 sustituyó por «garantías adecuadas»: 4 en ARGA y 4 copiadas al grupo nuevo, que heredó también el art. 17 RRM en 4 packs.

**A quién afecta y qué pasa si no se hace.** Afecta a quien genere documentos en ARGA y en el grupo nuevo: el texto puede tener una base legal incorrecta o describir un régimen derogado, y cada grupo nuevo lo copia. Bloquea MOI-139, que hace la corrección y la lleva a las copias.

**Qué resultado buscamos.** El criterio escrito del Comité Legal sobre citas y plazos, régimen de los acreedores en fusiones y variables de firma o sello, registrado aquí y en el repositorio.

**Cómo sabremos que está resuelto.** Hay un comentario con la respuesta fechada del Comité a esas tres preguntas, y MOI-139 puede empezar.

**Qué te toca a ti.** Llevar las preguntas al Comité Legal y trasladar aquí su respuesta. Mientras no responda, los documentos de ARGA y del grupo nuevo siguen saliendo con esas citas. Lo que tiene delante el Comité:
- Citas y plazos: corregir con versión nueva de cada plantilla y regla, o retirar de uso las afectadas hasta revisarlas (rápido, pero deja materias sin plantilla).
- Fusiones: reescribir al régimen de garantías o mantener el texto con una nota de revisión.
- Variables de firma o sello: retirarlas, sustituirlas por rótulos de interposición o custodia, o mantenerlas con una nota.
Recomendación técnica del agente: corregir por versión nueva y retirar solo si un plazo es materialmente erróneo; reescribir las fusiones, porque es el texto que llega al documento; y sustituir las variables, porque encaja con la política de EAD Trust del 21-07-2026 (lo que cubre su contrato lo confirma MOI-216). El criterio jurídico es del Comité.

### MOI-139 · Secretaría · Corregir las citas desfasadas en ARGA y evitar que el grupo nuevo las herede

Etiquetas: GOS · Secretaría, GOS · Grupo nuevo, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Las citas y regímenes que fije el Comité Legal en MOI-138 hay que aplicarlos en ARGA y en el grupo nuevo, que recibió copias de sus plantillas y reglas. Hoy el grupo nuevo tiene 4 plantillas con el Real Decreto 84/2015, 8 con variables de firma o sello de EAD Trust, 4 de fusión con el régimen derogado de oposición de acreedores y 4 packs con el art. 17 RRM. El pack base de reglas y plantillas lleva los mismos defectos, y corregir ARGA no corrige las copias: el alta de grupos no toca a propósito lo ya sembrado.

**A quién afecta y qué pasa si no se hace.** Afecta a ARGA, al grupo nuevo y a cada grupo que se cree después, que heredaría los defectos. Antes tienen que estar hechos MOI-138, que fija el criterio, y MOI-126, que guarda en git el pack base y el programa de alta de grupos, hoy sin guardar. Se coordina con MOI-137, que cambia el rótulo de las plantillas con marca de demostración.

**Qué resultado buscamos.** Las correcciones del Comité aplicadas en ARGA y en el grupo nuevo, cada una como versión nueva, sin sobrescribir la vigente; el pack base regenerado desde ARGA ya corregido; el alta de grupos protegida según tu elección; y escrita la regla de que toda corrección de origen se lleva por versión nueva a cada grupo copiado.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura da, en ARGA y en el grupo nuevo, 0 plantillas vigentes con esas citas o variables y 0 packs con el art. 17 RRM, salvo lo que el Comité mantenga; cada cambio tiene versión nueva e historial; y una prueba automática del alta de grupos se pone en rojo si esos patrones vuelven. Queda probado y publicado.

**Qué te toca a ti.** Elegir, cuando el agente lo proponga, si el alta de grupos deja de copiar las plantillas defectuosas o las copia marcadas «pendiente de revisión». Recomendación: copiarlas marcadas (criterio técnico del agente), porque los defectos están también en las únicas actas de acuerdos sin sesión, socio único, administradores solidarios y co-aprobación, y excluirlas dejaría a un grupo nuevo sin ellas. Mientras no decidas, la propuesta es no dar de alta ningún grupo más. Autorizar en un comentario, tras ver el ensayo, la escritura en la base de datos de producción de las versiones nuevas en ARGA y en el grupo nuevo; en ARGA es un cambio declarado de su dato. Después, autorizar que los cambios del repositorio (alta de grupos, pack base y registro del cambio de base de datos) se incorporen a la versión principal, que los publica.

### MOI-140 · Comité Legal · Definir las reglas de las comisiones delegadas y el alcance de su plantilla de acta

Etiquetas: GOS · Comités, GOS · Secretaría · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Ningún grupo tiene reglas propias para las comisiones delegadas del Consejo: hay packs de reglas para Junta, Consejo, socio único y soporte interno (una tramitación interna que no es órgano social: la toma de razón de la separación de un socio), pero ninguno de comisión. Por eso los acuerdos de una comisión se evalúan con la regla de otro órgano, con un aviso. Además, la plantilla de acta de comisión delegada que el grupo nuevo copió de ARGA dice en sus notas que el voto de calidad no rige en comisiones porque así lo establece el Reglamento del Consejo de ARGA: puede ser una regla de ARGA y no derecho común.

**A quién afecta y qué pasa si no se hace.** Afecta a ARGA, cuyo Consejo tiene comisiones, y a cualquier grupo nuevo que las cree: sus acuerdos se evalúan con plazos, quórums y mayorías de otro órgano, y el grupo nuevo heredaría como ley una regla de otro grupo. Bloquea MOI-141, que carga las reglas, y MOI-201, la nueva versión de la convocatoria de comisión delegada. Se relaciona con MOI-198 (cómo lee las normas el motor de reglas).

**Qué resultado buscamos.** El criterio escrito del Comité Legal sobre dos preguntas. Primera: qué materias son delegables según el art. 249 bis LSC, de dónde salen el quórum y la mayoría de una comisión y si la discrepancia de órgano debe bloquear la elevación a escritura o basta avisar. Segunda: si el voto de calidad de esa plantilla es derecho común, regla de ARGA o algo configurable por grupo.

**Cómo sabremos que está resuelto.** Hay un comentario con la respuesta fechada del Comité a las dos preguntas, y MOI-141 y MOI-201 pueden empezar.

**Qué te toca a ti.** Llevar las dos preguntas al Comité Legal y trasladar aquí su respuesta. Mientras tanto, los acuerdos de comisión siguen con la regla de otro órgano y aviso, y la plantilla sigue vigente en el grupo nuevo; el programa de alta de grupos imprime un aviso sobre ella cada vez que se ejecuta. Opciones del Comité:
- Reglas: packs propios por comisión (exacto, más trabajo) o el régimen general del Consejo declarado supletorio (rápido, pero es criterio jurídico).
- Voto de calidad: derecho común (se retira el aviso), regla de ARGA (sale del pack base y se archiva la copia del grupo nuevo, que se queda sin esa plantilla) o configurable por grupo (más trabajo).
No hay base para recomendar: las dos son criterio jurídico del Comité y el agente no lo fabrica. El coste de cada opción no está estimado.

### MOI-141 · Secretaría · Cargar las reglas de las comisiones delegadas según el criterio del Comité Legal

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Cuando el Comité Legal responda en MOI-140, hay que cargar su criterio: crear las reglas de las comisiones delegadas, que hoy no existen en ningún grupo, y tratar la plantilla de acta de comisión delegada que el grupo nuevo copió de ARGA. Mientras no exista, un acuerdo de comisión se evalúa con la regla de otro órgano: el 19-07-2026 eran 2 de los 37 acuerdos revisados.

**A quién afecta y qué pasa si no se hace.** Afecta a ARGA y al grupo nuevo: los acuerdos de sus comisiones seguirían evaluándose con plazos, quórums y mayorías que no les corresponden, y el criterio del Comité quedaría escrito pero sin efecto. Antes tienen que estar hechos MOI-140, que fija el criterio, y MOI-126, que guarda en git el pack base y el programa de alta del grupo nuevo, hoy sin guardar.

**Qué resultado buscamos.** Reglas de comisión vigentes en ARGA, cada una con su procedencia anotada (qué decisión del Comité la sostiene), y también en el pack base de reglas y plantillas y en el grupo nuevo; ningún acuerdo de comisión evaluado con la regla de otro órgano; y la plantilla de acta tratada según lo decidido: se mantiene sin aviso, se archiva la copia del grupo nuevo (nunca se borra) o se hace configurable por grupo.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra las reglas de comisión vigentes con su procedencia y 0 acuerdos de comisión con regla de otro órgano; repetir la carga no crea duplicados; y el pack base refleja la decisión sobre la plantilla. Queda probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario, cuando el agente te enseñe el ensayo, la escritura en la base de datos de producción: las reglas nuevas en ARGA (un cambio declarado de su dato) y en el grupo nuevo, y, si el Comité decide que el voto de calidad es regla de ARGA, el archivo de la copia de la plantilla en el grupo nuevo. Después, autorizar que los cambios guardados en el repositorio (el registro del cambio de base de datos, el pack base regenerado y, si cambia, el alta de grupos) se incorporen a la versión principal, que los publica.

### MOI-142 · Secretaría · Permitir emitir la convocatoria de una Junta, no solo la de un Consejo

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** La aplicación solo emite la convocatoria de un Consejo de Administración: si el órgano es una Junta de socios, el servidor la rechaza. Por eso la única convocatoria de Garrigues, la de su Junta de Socios de 06-05-2026, sigue en borrador y su reunión, sin convocar. Al grupo nuevo le pasará lo mismo con sus Juntas.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría de Garrigues y de cualquier grupo con Juntas. Sin una convocatoria emitida y ya inalterable no se puede generar el acta de una sesión que no sea universal, así que la Junta de Garrigues se queda en «acuerdos adoptados». Bloquea MOI-143. No depende formalmente de ningún issue; se relaciona con MOI-15, que anota este límite como frontera conocida.

**Qué resultado buscamos.** Que el servidor emita la convocatoria de una Junta con la plantilla de convocatoria de Junta del grupo y su plazo estatutario (en Garrigues, 15 días, ya decidido), y que quede emitida, sin duplicar el dato sembrado, la Junta que elijas: la de Garrigues del 06-05-2026 o una Junta futura de prueba en el grupo nuevo.

**Cómo sabremos que está resuelto.** En la base de datos de producción la convocatoria de la Junta elegida aparece emitida; la de Garrigues sigue siendo una sola (emitida o, si eliges la de prueba, intacta en borrador); ARGA no cambia; y el cambio queda probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, el cambio de base de datos en producción cuando el agente te enseñe el ensayo deshecho, y después la incorporación a la versión principal, que lo publica. Y elegir la Junta si el ensayo confirma que la de Garrigues quedaría fechada después de celebrarse (el servidor fecha la emisión el día en que emite): emitirla así, declarándolo, o probar con una Junta futura. Recomendación, criterio técnico del agente: la Junta futura, en el grupo nuevo, porque una convocatoria posterior a su propia reunión es incoherente y el servidor, al crear una reunión desde una convocatoria, exige fecha futura; y en el grupo nuevo no deja dato permanente en Garrigues, cuyo dato se conserva (en ARGA sería un cambio de su dato). A cambio, hay que convocarla con su plazo (15 días o un mes, según la sociedad), esperar a su fecha y fijar en MOI-143 una base de cómputo propia; si el grupo nuevo aún no tiene una sociedad con Junta, espera a MOI-53. Su convocatoria y su acta quedarán para siempre en producción: al elegirla, lo autorizas. Mientras no elijas, la de Garrigues sigue en borrador.

### MOI-143 · Secretaría · Poder generar el acta de una Junta computando por capital

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El servidor se niega a generar el acta de cualquier Junta, y lo hace a propósito: todavía no existe la pieza que calcula el quórum y las mayorías por capital, es decir, por participaciones y no por personas. De su Junta de Socios de 06-05-2026, Garrigues tiene diez acuerdos adoptados, diez resultados de votación y un censo de socios congelado, pero ninguna acta.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría de Garrigues y de cualquier grupo que celebre Juntas: el caso de Garrigues termina en «acuerdos adoptados», sin acta. Antes tiene que estar hecho MOI-142, porque el acta de una sesión que no es universal exige una convocatoria emitida. No bloquea otros issues; se relaciona con MOI-15, que anota este límite como frontera conocida.

**Qué resultado buscamos.** Que el servidor calcule quórum y mayoría por capital con la base de cómputo declarada para cada Junta, compruebe cada resultado de votación contra el censo de socios y, solo entonces, permita generar el acta. El acta seguirá sin poder certificarse hasta que se decida la custodia final (MOI-144).

**Cómo sabremos que está resuelto.** Existe al menos un acta, generada por la vía oficial del servidor, de la Junta elegida en MOI-142 (la de Garrigues del 06-05-2026 o la de prueba del grupo nuevo); una sonda demuestra que se rechaza un resultado que no cuadra con el censo; ARGA no cambia; y queda probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario y tras ver el ensayo deshecho: el cambio de base de datos en producción, que habilita también las actas de Junta en ARGA y en el grupo nuevo, cada una con su base declarada (cuántas Juntas de ARGA quedarían habilitadas está sin medir); la generación del acta; y la sonda que intenta registrar un resultado incoherente. Después, la incorporación a la versión principal, que lo publica. La base de la Junta de Garrigues ya la confirmaste el 29-08-2026 (16.900 votos, los de la clase A sin autocartera) y solo vale para esa Junta. Si en MOI-142 eliges la Junta de prueba del grupo nuevo, te toca además confirmar su base de cómputo antes de que se genere su acta.

### MOI-144 · Secretaría · Decidir si se construye la custodia final de actas con EAD Trust, sin la cual no se pueden emitir certificaciones

Etiquetas: GOS · Secretaría, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Para certificar un acuerdo, su acta necesita custodia final: la versión definitiva registrada en el servidor. Hoy nada puede producirla, a propósito: el botón está desactivado, el servidor corta el paso y la base de datos no deja registrarla. Ninguna de las 13 actas la tiene. Tampoco se ha probado nunca la integración real con EAD Trust.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría en los tres grupos: la demostración acaba en «acta descargada, certificación bloqueada y la pantalla dice por qué». No bloquea ni espera a otro issue. Se relaciona con MOI-216, que obtiene de EAD Trust la confirmación contractual y técnica de lo que cubre su servicio, y con MOI-16, que comprueba la custodia actual.

**Qué resultado buscamos.** Tu decisión, con fecha, sobre dos preguntas: si se construye la custodia final de actas y si se prueba una vez la integración real con EAD Trust sobre un expediente desechable.

**Cómo sabremos que está resuelto.** Un comentario con la decisión y su fecha. Si se construye, un acta tendrá su versión definitiva hecha en el servidor y la prueba automática que hoy vigila el bloqueo, ampliada, estará en verde; si se hace la prueba real, un informe fechado con la solicitud, su estado final y su cancelación.

**Qué te toca a ti.** Decidir, porque abre una fase de producto y compromete a EAD Trust. Las dos opciones A exigen antes la confirmación de MOI-216.
Custodia final:
- A) Construirla: permite certificar en la demostración; exige una fase de producto y que autorices los cambios de base de datos, tras ver su ensayo, y la incorporación a la versión principal. Coste y plazo sin estimar.
- B) Mantenerla cerrada y declarada: sin coste; la certificación sigue bloqueada.
Prueba real:
- A) Hacerla: da una prueba viva, pero crea invitaciones a personas reales y es una excepción a la política del 21-07-2026, que excluye la firma; solo tú puedes decidirla, con esa confirmación, eligiendo expediente y firmantes y confirmando después la recepción.
- B) Aplazarla hasta decidir la custodia; la integración sigue cubierta solo por pruebas automáticas.
Recomendación: B en las dos hasta tener esa confirmación (criterio técnico del agente): abrir el permiso sin la pieza que produce el documento solo permitiría fabricar justificantes. Si pesa más enseñar certificaciones, A en la custodia. Mientras decides, rige B. Aquí apruebas además la conexión propuesta en MOI-16. El coste de la fase no está estimado.

### MOI-145 · Secretaría · Desactivar los tipos de certificación que afirman envío, entrega o firma cualificada

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** En el catálogo de tipos de certificación de ARGA siguen activos tres tipos que afirman cosas que el producto no hace: un certificado de entrega electrónica certificada y otro de comunicaciones regulatorias, los dos marcados como si exigieran firma electrónica cualificada, y un certificado de emisión y envío de convocatoria. La pantalla ya no los ofrece porque el programa los filtra, pero en el dato siguen activos.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría de ARGA. Si mañana otra pantalla lee el catálogo sin ese filtro, volvería a ofrecer envío, entrega o firma cualificada, que la política vigente con EAD Trust no permite afirmar: solo interposición, mensajería básica y custodia. No depende de otros issues ni bloquea ninguno; MOI-16 comprueba que ninguna pantalla del grupo nuevo los ofrece.

**Qué resultado buscamos.** Que esos tres tipos queden desactivados en el dato, sin borrarlos, y que una sonda avise si alguien los vuelve a activar.

**Cómo sabremos que está resuelto.** Una consulta del catálogo devuelve cero tipos activos que exijan firma cualificada o hablen de entrega o envío, las tres filas siguen existiendo desactivadas y la sonda está en verde. El cambio queda probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, este cambio en el dato de ARGA y su aplicación en la base de datos de producción, cuando el agente te enseñe el ensayo deshecho. Es un cambio declarado del dato de ARGA; lo que ARGA ve en pantalla no cambia, porque esos tipos ya estaban ocultos. Después, autorizar la incorporación del cambio a la versión principal, que lo publica.

### MOI-216 · Secretaría · Obtener de EAD Trust la confirmación contractual y técnica de lo que cubre el servicio contratado

Etiquetas: GOS · Secretaría, GOS · Gobierno · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Tres tareas necesitan saber qué cubre realmente el contrato del proyecto con EAD Trust, y nadie tenía encargado averiguarlo. La política del 21-07-2026 limita a EAD Trust a interposición, mensajería básica y custodia, y bloquea firma, envío y entrega mientras no haya un justificante contractual y técnico aparte. Ese justificante no está en el repositorio: la lista oficial de prestadores cualificados no dice qué se ha contratado, y la prueba técnica de julio no es un documento del contrato.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría y al Comité Legal. No depende de nada. No bloquea formalmente ningún issue, pero las opciones A de MOI-144 y la pregunta L10 de MOI-202 esperan a esta confirmación: sin ella no se puede construir la custodia final de actas ni hacer una prueba real con EAD Trust, y el Comité Legal no puede decir qué justificante suyo bastaría para la custodia definitiva. MOI-203 espera esa respuesta del Comité y MOI-16 podrá citarla.

**Qué resultado buscamos.** La respuesta escrita de EAD Trust, con su documento de respaldo, a una lista cerrada de preguntas (qué cubre el contrato, qué justificante produce cada servicio, si la cuenta es de pruebas o de uso real, si admite una prueba sobre un expediente desechable), registrada aquí pregunta por pregunta.

**Cómo sabremos que está resuelto.** Este issue tiene la lista enviada, con su fecha, y un comentario con cada respuesta, que cita el documento que la respalda o la marca «no acreditado»; MOI-144, MOI-202 y MOI-203 lo enlazan.

**Qué te toca a ti.** Hacer llegar a EAD Trust las preguntas que prepare el agente, traer su respuesta con el documento de respaldo y confirmar que la anotación refleja lo acreditado; ningún agente contacta con EAD Trust ni interpreta el contrato. Mientras tanto rige la política del 21-07-2026. Si la respuesta acredita algo más, la excepción la decides en MOI-144, y lo que vale ante el Registro Mercantil lo dice el Comité Legal en MOI-202.

## M2 · AIMS y gobernanza transversal operativos

### MOI-55 · AIMS · Completar un recorrido operativo en un grupo nuevo

Etiquetas: GOS · AIMS, GOS · Grupo nuevo · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** Nadie ha usado todavía AIMS en un grupo que empieza desde cero. El grupo nuevo no tiene ningún sistema de IA (medido el 24-09-2026). En toda la base de datos hay ocho evaluaciones de IA y ninguna se ha congelado ni revisado, así que la revisión a cuatro ojos nunca se ha visto funcionar con dos personas.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que quiera usar AIMS sin datos de demostración y a la entrega: sin este recorrido no sabemos si AIMS sirve desde cero. Bloquea MOI-56, MOI-57, MOI-147 y MOI-150. Antes tienen que estar hechos MOI-53 (el alta, donde nacen las personas del grupo), MOI-133 (enlazar las dos cuentas a esas personas; sin ello, guardar una evaluación falla) y MOI-125 (publicar el trabajo RIA, para recorrer la versión que corresponde a la base de datos).

**Qué resultado buscamos.** El bloque 5 del guion recorrido: un sistema de IA dado de alta con el cuestionario guiado, una evaluación congelada con una cuenta y revisada con la otra y un incidente registrado, con cada fallo en la tabla de hallazgos y su gravedad (de B, que bloquea el recorrido, a C, que confirma algo ya conocido). Lo creado queda en el grupo nuevo a propósito. Los restos de ARGA que ya recoge MOI-54 se anotan como hallazgo conocido. Los bloques 6 y 7 van en MOI-146.

**Cómo sabremos que está resuelto.** La tabla de hallazgos tiene el bloque 5 completo, con el resultado explícito de la revisión a cuatro ojos. El agente confirma con una consulta de solo lectura que el grupo nuevo tiene un sistema clasificado, una evaluación congelada y un incidente, y que ARGA y Garrigues no han cambiado.

**Qué te toca a ti.** Hacer el recorrido por pantalla con las dos cuentas del grupo nuevo, cada una en una ventana privada distinta (dos pestañas del mismo navegador comparten la sesión), anotar lo que falle y dar por aceptado el bloque en un comentario.

### MOI-56 · Gobernanza · Conectar AIMS y Secretaría mediante trabajo y evidencia persistentes

Etiquetas: GOS · AIMS, GOS · Secretaría · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Cuando AIMS detecta algo que necesita la decisión de un órgano, como un incidente de IA relevante, hoy solo ofrece un enlace que lleva a la pantalla de Secretaría. No queda guardado nada: ni la petición, ni quién debe actuar, ni qué reunión o acuerdo la resolvió. Incluso la referencia del incidente, que viaja en el enlace, se pierde al llegar.

**A quién afecta y qué pasa si no se hace.** Afecta a quien gestiona la IA del grupo y a la Secretaría: sin esta conexión no se puede acreditar que un órgano decidió sobre una alerta de IA, caso que exige la aceptación final. Bloquea MOI-57. Antes tienen que estar hechos MOI-158 (primer paso: que el destino lea qué caso le llega), MOI-55 (AIMS recorrido en el grupo nuevo) y MOI-15 (ciclo societario recorrido en el grupo nuevo).

**Qué resultado buscamos.** Que una alerta de AIMS que requiera decisión quede registrada en Secretaría como un seguimiento con responsable y estado, relacionada con la reunión y el acuerdo que la resuelvan, y que desde AIMS se puedan consultar ese acuerdo y su justificante sin copiar ni modificar el acta cerrada, siempre dentro de cada grupo. GRC queda fuera: solo recibe la referencia del caso (MOI-158).

**Cómo sabremos que está resuelto.** Un ensayo que se deshace al final demuestra que la relación se crea y se consulta dentro del grupo y que otro grupo no la ve, y una prueba automática falla si la relación se pierde. El caso real, con un incidente del grupo nuevo, se comprueba en MOI-57.

**Qué te toca a ti.** Aprobar en un comentario el diseño de la conexión antes de que se construya; autorizar el cambio de base de datos cuando veas el ensayo; y autorizar la incorporación a la versión principal. Al aprobar el diseño eliges también dónde se guarda. El producto ya tiene dos registros pensados para unir módulos, uno de avisos entre módulos y otro de relaciones entre registros, pero una regla vigente prohíbe escribir en ellos sin contrato, pruebas y tu aprobación expresa:
- a) Estructura propia: respeta la regla; exige un cambio de base de datos nuevo y deja sin usar los registros comunes.
- b) Usar los registros comunes: aprovecha lo que ya existe, como pide el texto actual, pero es una excepción a esa regla que autorizas tú.
Recomendación: b) solo si el agente demuestra al presentar el diseño que esos registros cubren lo que hay que guardar; si no, a). Es criterio técnico del agente: respeta la regla y aprovecha lo común cuando sirve. Si no decides, rige a).

### MOI-57 · Gobernanza · Acreditar Secretaría y AIMS sobre un tercer grupo desde cero

Etiquetas: GOS · Grupo nuevo, GOS · Gobierno · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El producto se da por entregado cuando un tercer grupo recorre Secretaría y AIMS desde cero, sin heredar datos de ARGA ni de Garrigues, y tú lo aceptas por escrito. Hoy eso no es posible: el grupo nuevo existe en la base de datos desde el 19-09-2026, pero su trabajo no está guardado en git ni publicado, ninguna de sus pantallas se ha visto y no tiene sistemas de IA.

**A quién afecta y qué pasa si no se hace.** Afecta a la entrega del producto: sin tu acta no se da por entregado. No bloquea a ninguna tarea. Antes tienen que estar hechas MOI-53, MOI-15, MOI-16, MOI-54, MOI-55 y MOI-56 (recorridos, separación de la configuración de cada grupo y conexión entre AIMS y Secretaría), MOI-136 (publicar el grupo nuevo) y MOI-147 (qué se da de alta por pantalla y qué con un kit de arranque), que a su vez espera al recorrido de GRC y del canal de MOI-146.

**Qué resultado buscamos.** Tu acta de aceptación registrada en este issue. Identifica la versión y la configuración probadas, enlaza el resultado de cada recorrido (también el de MOI-146), confirma que ARGA y Garrigues no se han contaminado, declara cero defectos bloqueantes (ningún hallazgo de gravedad B abierto) y deja a la vista lo pendiente. Mientras MOI-144 no decida construir la custodia final, la certificación de actas figura como límite conocido, no como defecto. Esta entrega no cierra el proyecto: el programa RIA (M3 y M4) y la deuda conocida (M4) siguen después.

**Cómo sabremos que está resuelto.** Existe un comentario tuyo con el acta, y cada punto de aceptación de este issue remite a su prueba o a su recorrido.

**Qué te toca a ti.** Revisar el borrador de acta que prepara el agente y registrar el acta de aceptación en un comentario, o rechazarla indicando los defectos. La aceptación no se presume por pruebas automáticas. Si quieres, fija también la fecha de entrega, que el texto actual deja pendiente, y autoriza guardar el acta en el repositorio, lo que la incorpora a la versión principal.

### MOI-146 · Grupo nuevo · Recorrer GRC y el canal interno de información en el grupo nuevo

Etiquetas: GOS · Grupo nuevo, GOS · GRC · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Nadie ha visto todavía en pantalla cómo funcionan GRC y el canal interno de información en un grupo que empieza desde cero. El guion del grupo nuevo lo prevé en sus bloques 6 y 7, que están sin hacer. Ya se sabe que las pantallas de políticas, obligaciones, hallazgos, delegaciones y conflictos no tienen forma de dar de alta nada y que el instructor (la persona que tramita cada comunicación) y los órganos del canal salen como «Pendiente de designación»; falta confirmarlo y anotar todo lo demás.

**A quién afecta y qué pasa si no se hace.** Afecta a la prueba del grupo nuevo y a quien tenga que decidir qué se construye. Sin este recorrido no se puede decidir módulo a módulo si lo que falta se da de alta por pantalla o con un kit de arranque, ni cómo designa cada grupo a los responsables de su canal. Bloquea MOI-147 y MOI-151. Antes tiene que estar hecho MOI-53, el recorrido de alta del grupo y sus sociedades.

**Qué resultado buscamos.** La tabla de hallazgos del guion rellena para los bloques 6 y 7: en cada pantalla, lo que pasó, lo que se esperaba, la gravedad y una captura o el error literal.

**Cómo sabremos que está resuelto.** Cualquiera puede leer en el issue, pantalla por pantalla de los bloques 6 y 7, si funcionó, si quedó vacía sin forma de alta o si mostró datos de otro grupo.

**Qué te toca a ti.** Hacer el recorrido o encargarlo. Se hace donde decidas en MOI-132: en local o, una vez publicado el grupo nuevo (MOI-136), en la versión publicada. Si se lo encargas a un agente, autorízale en un comentario a registrar datos de prueba en el grupo nuevo por pantalla, porque eso escribe en la base de datos de producción.

### MOI-147 · Grupo nuevo · Decidir, módulo a módulo, si lo que falta se da de alta por pantalla o con un kit de arranque

Etiquetas: GOS · Grupo nuevo, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El grupo nuevo sirve para saber qué puede hacer un cliente el primer día sin ayuda del equipo. Ya se sabe que varias cosas no tienen pantalla: dar de alta políticas, obligaciones, controles, hallazgos, planes de acción, delegaciones, conflictos y notificaciones regulatorias; cambiar la sociedad matriz o el porcentaje; dar de alta varias sociedades a la vez; dar de alta el propio grupo y su administrador, que hoy crea el equipo desde fuera de la aplicación; y enlazar cada cuenta con su persona. Crear una comisión después del alta de la sociedad está por confirmar: el catálogo de órganos tiene un botón «Crear órgano» y el punto 2.7 del guion lo comprobará.

**A quién afecta y qué pasa si no se hace.** Afecta al grupo nuevo, a cualquier cliente futuro y al procedimiento reutilizable de alta de grupos. Sin esta decisión los recorridos acaban en una lista de hallazgos y no en trabajo priorizado. Antes tienen que estar hechos los recorridos MOI-53, MOI-15, MOI-55 y MOI-146. Bloquea MOI-57, MOI-148 y MOI-149.

**Qué resultado buscamos.** Una decisión escrita para cada hueco de la tabla de hallazgos, agrupada por módulo, llevada al documento de arranque del grupo nuevo, y una tarea por cada decisión.

**Cómo sabremos que está resuelto.** Un comentario tuyo con la decisión hueco por hueco, el documento de arranque actualizado, MOI-148 y MOI-149 ajustados y una tarea nueva por cada otra decisión de construir.

**Qué te toca a ti.** Decidir, porque es alcance de producto: qué debe poder hacer un cliente por sí mismo el primer día. Opciones para cada hueco:
- A) Alta por pantalla: el cliente puede hacerlo el primer día; cuesta desarrollo en cada módulo.
- B) Kit de arranque genérico: rápido, pero es dato cargado por el equipo, hay que etiquetarlo como simulado y no demuestra que un cliente pueda hacerlo.
- C) Mixto: alta por pantalla donde el cliente la necesita el primer día y kit para los catálogos.
No hay base para recomendar A, B o C antes de tener la tabla de hallazgos y el coste de cada alta, que no está estimado. Recomendación: decidir hueco por hueco sobre esa tabla, empezando por los de gravedad B, los que bloquean el recorrido; es criterio técnico del agente. Si pesa más demostrar que un cliente arranca solo, lo coherente es A o C; si pesa más el plazo, B. Mientras no decidas, esas pantallas quedan vacías y sin forma de alta, y MOI-57 no puede cerrarse.

### MOI-148 · Grupo nuevo · Poder cambiar la sociedad matriz o el porcentaje de participación después del alta

Etiquetas: GOS · Grupo nuevo, GOS · Secretaría · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** La sociedad matriz de cada filial y su porcentaje de participación solo se fijan al dar de alta la sociedad. Después no hay pantalla ni función para cambiarlos: registrar una transmisión mueve el libro de socios, pero no cambia la matriz que usa el mapa de gobierno. Tampoco existe el alta de varias sociedades a la vez; ese hueco se decide también en MOI-147.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que se equivoque en el alta o que se reestructure: el mapa de gobierno y las demás pantallas que muestran la estructura del grupo enseñarían una estructura desfasada, sin forma de corregirla por pantalla. Antes tiene que estar hecho MOI-147, donde decides si esto se construye.

**Qué resultado buscamos.** Si decides que entra, una forma de cambiar la matriz o el porcentaje desde la aplicación que guarde el histórico y no sobrescriba el valor anterior.

**Cómo sabremos que está resuelto.** La decisión queda escrita en el documento de arranque del grupo nuevo. Si se construye, alguien cambia por pantalla la matriz o el porcentaje de una filial del grupo nuevo, el cambio se ve en el mapa de gobierno, el valor anterior queda en el histórico y el cambio queda probado y publicado.

**Qué te toca a ti.** Confirmar en el recorrido de MOI-53 que no hay forma de hacerlo: el punto 2.7 del guion prueba justo eso, cambiar la matriz o el porcentaje después del alta. Y decidir en MOI-147 si entra en el trabajo pendiente, porque el diseño inicial del grupo nuevo lo dejó fuera de alcance. Si entra, aprobar primero el diseño que te proponga el agente; después, autorizar el cambio de base de datos en producción tras ver su ensayo, y la incorporación a la versión principal, que lo publica.

### MOI-149 · Grupo nuevo · Dar camino de alta a políticas, obligaciones, controles y demás registros que hoy solo existen sembrados

Etiquetas: GOS · Grupo nuevo, GOS · GRC · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Ocho tipos de registro que se consultan desde la consola solo muestran datos cargados por el equipo: políticas, obligaciones, controles, hallazgos, planes de acción, delegaciones, conflictos y notificaciones regulatorias. La aplicación no tiene ninguna forma de darlos de alta. En el grupo nuevo hay cero políticas y cero obligaciones.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que empiece desde cero: esas pantallas de registro quedan vacías para siempre si el equipo no carga los datos desde fuera de la aplicación. Antes tiene que estar hecho MOI-147, donde decides tabla por tabla si se construye el alta por pantalla o un kit de arranque.

**Qué resultado buscamos.** Que cada uno de esos registros tenga el camino que decidas, alta por pantalla o kit de arranque etiquetado como simulado, y que al menos uno funcione ya en el grupo nuevo.

**Cómo sabremos que está resuelto.** Queda escrita la decisión tabla por tabla y, en el grupo nuevo, hay al menos un registro dado de alta por pantalla o cargado con el kit y etiquetado, con una prueba automática que falla si la pantalla deja de leerlo; el cambio queda probado y publicado.

**Qué te toca a ti.** Confirmar en el recorrido de GRC (MOI-146, punto 6.4) que esas pantallas quedan vacías y sin alta, y decidir tabla por tabla en MOI-147. Después, autorizar por escrito, tras ver su ensayo, la carga del kit o los cambios de base de datos que haya que aplicar en producción, y la incorporación del resultado a la versión principal, que lo publica.

### MOI-150 · Grupo nuevo · Que cada grupo declare su órgano de gobierno de la IA sin tocar el programa

Etiquetas: GOS · Grupo nuevo, GOS · AIMS · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El programa decide qué órgano gobierna la IA de cada grupo con una lista escrita dentro del propio programa, y esa lista solo contiene a Garrigues, con su Comité de Gobernanza de la IA. En el grupo nuevo el panel de ese órgano no aparece en AIMS, y la única forma de que aparezca es modificar el programa y publicar una versión nueva.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que empiece desde cero: cada cliente necesitaría un cambio del programa para declarar su comité de IA, lo contrario de un alta sin intervención técnica. No frena a otras tareas. Antes tiene que estar hecho MOI-55, cuyo recorrido confirma el hueco (punto 5.4 del guion).

**Qué resultado buscamos.** Que cada grupo pueda declarar su órgano de gobierno de la IA como dato propio, sin tocar el programa. Si un grupo no lo declara, el panel sigue sin mostrarse y nadie inventa un órgano. Garrigues conserva su comité. ARGA sigue sin panel aunque su órgano de IA es el CATIT desde el 20-09-2026: mostrarlo sería un cambio visible en ARGA que tendrías que autorizar aparte.

**Cómo sabremos que está resuelto.** Alguien declara un órgano de IA para el grupo nuevo sin modificar el programa y el panel aparece en su pantalla de AIMS; Garrigues sigue mostrando su comité, ARGA sigue sin panel, y una prueba automática falla si la declaración deja de leerse.

**Qué te toca a ti.** Decidir aquí, como recoge la tabla de hitos de M2, que la declaración pase de la lista del programa a dato de cada grupo, y elegir qué órgano del grupo nuevo se declara en la demostración (en un cliente real lo decidiría su propio comité de IA). Ese órgano tiene que existir: se crea al dar de alta la sociedad o después, con el botón «Crear órgano» del catálogo de órganos de Secretaría, que MOI-53 comprueba en el grupo nuevo. Si hace falta un cambio de base de datos, lo autorizas cuando el agente te enseñe el ensayo, y después autorizas la incorporación a la versión principal.

### MOI-151 · Grupo nuevo · Que cada grupo designe al instructor y los órganos de su canal interno

Etiquetas: GOS · Grupo nuevo, GOS · GRC, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** En el canal interno de información, quién instruye cada comunicación y qué órganos intervienen está escrito dentro del propio programa, y solo para ARGA y para Garrigues. Cualquier otro grupo, como el grupo nuevo, ve «Pendiente de designación» y no puede designarlos por pantalla.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que empiece desde cero y a quien gestione su canal. Según el diagnóstico previo, el canal debería poder usarse para registrar, acusar recibo y cerrar comunicaciones, pero está sin confirmar en pantalla; en todo caso funcionaría sin responsable designado, que según la fuente es lo que da validez a un sistema interno de información de la Ley 2/2023 (la ley española que protege a quienes informan sobre infracciones). No frena a otras tareas. Antes tiene que estar hecho MOI-146, cuyo recorrido del canal (punto 7.3 del guion) confirma el hueco.

**Qué resultado buscamos.** Tu decisión registrada y, si es que sí, construida en este mismo issue: el grupo nuevo designa por pantalla, ARGA y Garrigues ven lo mismo que hoy y nadie aparece designado si no consta.

**Cómo sabremos que está resuelto.** Un comentario con tu decisión y el documento de arranque del grupo nuevo actualizado. Si se construye, en el grupo nuevo alguien designa un instructor desde la pantalla y aparece en sus comunicaciones, y un grupo sin designación sigue viendo «Pendiente de designación».

**Qué te toca a ti.** Decidir si la designación del instructor y de los órganos del canal pasa a ser dato de cada grupo. Es alcance de producto.
- a) Sí: cada grupo designa por pantalla. Exige un cambio de base de datos, que autorizarías tras ver el ensayo, y la incorporación a la versión principal, que también autorizas. Coste sin estimar.
- b) No: el grupo nuevo sigue con «Pendiente de designación» y cada grupo que se añada necesitaría un cambio del programa, en contra del criterio de arquitectura del proyecto, que separa la configuración de cada grupo del programa común.
Recomendación: a), por criterio técnico del agente, apoyado en ese criterio de arquitectura y en que la designación es lo que da validez al canal. Si pesa más no ampliar alcance antes de la entrega, b) sirve para la demostración. Mientras decides rige lo actual; si no decides, la propuesta es que siga así (b). Quién puede nombrar al responsable según la Ley 2/2023 no se decide aquí: si hace falta, va al equipo legal.

### MOI-152 · Grupo nuevo · Decidir si el grupo nuevo nace con el módulo de IA de GRC

Etiquetas: GOS · Grupo nuevo, GOS · GRC, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** GRC ordena las obligaciones por módulos. El 20-09-2026 un cambio de base de datos del programa RIA creó el módulo de IA en ARGA y en Garrigues y dejó fuera a propósito al grupo nuevo. El grupo nuevo tiene seis módulos (riesgos, terceros, ciberseguridad, protección de datos, ética y canal interno, y auditoría interna), ninguno de IA, y su configuración de arranque, sin guardar en git, tampoco lo incluye.

**A quién afecta y qué pasa si no se hace.** Afecta a quien registre obligaciones del RIA en el grupo nuevo: sin módulo de IA, el sistema las archiva sin avisar en el de riesgos. Hoy no hay pantalla para registrarlas en ese grupo; llegarían con un kit de arranque o con MOI-176, la parte del programa RIA que prevé crearlas al clasificar un sistema. También afecta a la prueba automática que vigila esa clasificación, que solo mira ARGA y Garrigues. Antes tiene que estar hecho MOI-126, que guarda en GitHub esa configuración. No frena a otras tareas.

**Qué resultado buscamos.** Tu decisión registrada y, si incluyes la IA, el grupo nuevo con su módulo de IA y la prueba ampliada a los tres grupos.

**Cómo sabremos que está resuelto.** Un comentario con tu decisión. Si incluyes la IA, una consulta de solo lectura muestra el módulo de IA en el grupo nuevo; si no, la prueba declara el vacío del tercer grupo con su motivo.

**Qué te toca a ti.** Decidir con qué módulos de GRC nace un grupo desde cero: es alcance de producto.
- a) Incluir el módulo de IA: las obligaciones del RIA del grupo nuevo quedan en su sitio. Exige añadirlo a la configuración de arranque, ampliar la prueba y un cambio de base de datos en el grupo nuevo, que autorizarías tras ver el ensayo. Coste sin estimar.
- b) Dejarlo sin IA: sin cambio de base de datos; la prueba declara el vacío y nadie registra obligaciones del RIA en ese grupo.
En los dos casos autorizas la incorporación a la versión principal de la prueba ajustada.
Recomendación: a), por criterio técnico del agente: un grupo creado para probar AIMS desde cero debe tener dónde colocar sus obligaciones de organización del RIA. Si pesa más medir el alta sin añadidos, b), revisable en MOI-147. Mientras decides, nadie registra obligaciones del RIA en el grupo nuevo; si no decides, la propuesta es b), la situación actual. Falta un dato: si el grupo nuevo tendrá obligaciones del RIA antes de la aceptación final (MOI-57). El agente lo mide mirando cuándo llega MOI-176 y, con ese dato, decides tú en este issue.

### MOI-153 · AIMS · Crear la cuenta de cumplimiento de ARGA para poder revisar a cuatro ojos

Etiquetas: GOS · AIMS, GOS · Ventana · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El 20-09-2026 aceptaste crear una segunda cuenta de ARGA, con rol de cumplimiento, para que una evaluación de IA de ARGA la pueda revisar una persona distinta de quien la cerró. La cuenta no existe: medido el 24-09, ARGA solo tiene la cuenta de demostración, con rol de secretario. Por eso en ARGA la revisión a cuatro ojos solo se comprueba por el lado negativo: que nadie pueda revisar lo suyo.

**A quién afecta y qué pasa si no se hace.** Afecta a la demostración de ARGA y al programa RIA. No depende de ninguna tarea y bloquea MOI-217, la reclasificación de los sistemas de ARGA. Está relacionada, sin bloquearlas, con MOI-170 (fase F2), que la nombra en el CATIT, el órgano de IA de ARGA; con MOI-177, que la usa para revisar la clasificación de ARGA Assist antes del 2-12-2026; con MOI-155, para repetir en ARGA la revisión a cuatro ojos; y con MOI-135, que toca la misma gestión de contraseñas de demostración. Si no existe antes del 27-11-2026, fecha orientativa del calendario del programa, rige el plan B: la clasificación de ARGA Assist se queda en propuesta, sin revisar y con un aviso en la bandeja de alarmas.

**Qué resultado buscamos.** La cuenta creada, con rol de cumplimiento y enlazada a una persona del censo de ARGA que sea miembro vigente del CATIT, y las pruebas automáticas capaces de entrar con ella sin mostrar su contraseña.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra la cuenta enlazada a ARGA, con rol de cumplimiento y persona asignada; el cambio consta en la base de datos y en el repositorio; la cuenta de demostración de ARGA no ha cambiado; y la prueba de la revisión a cuatro ojos entra con las dos cuentas.

**Qué te toca a ti.** Cuatro cosas, en orden. Crear tú la cuenta en el panel de usuarios de la base de datos, con el correo que figura en el registro del programa RIA, marcado como confirmado, y guardar la contraseña solo en tu fichero local: el agente no crea cuentas ni maneja contraseñas. Elegir la persona entre los miembros del CATIT que el agente te proponga a partir del dato. Autorizar, tras ver el ensayo, el cambio de base de datos que enlaza cuenta y persona: es un cambio declarado del dato de ARGA, que añade la cuenta y, solo si esa persona no tiene cargo en el CATIT, su nombramiento. Y autorizar la incorporación a la versión principal de los ajustes en las pruebas.

### MOI-159 · AIMS · Clasificar los seis sistemas de IA de Garrigues con el cuestionario guiado

Etiquetas: GOS · AIMS · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Los seis sistemas de IA del entorno Garrigues, entre ellos Harvey, el asistente jurídico que usa el despacho, no tienen rol regulatorio ni perfil de aplicabilidad, que es lo que rellena el cuestionario guiado, y cinco tampoco tienen nivel de riesgo. En toda la base de datos de producción no hay ni un cuestionario contestado, así que nadie ha visto AIMS con un sistema clasificado. Mientras tanto, cada sistema se mide contra las 84 medidas del proveedor de un sistema de alto riesgo.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues y a la madurez de AIMS: las correcciones del 14-09-2026 que dependen de un sistema clasificado siguen sin probarse con dato real. Antes tienen que estar hechos MOI-125, para clasificar sobre la versión que incluye el programa RIA, y MOI-210, que decide si se pueden seguir borrando sistemas de IA: hoy, al borrar uno, desaparece su cuestionario sellado. Bloquea MOI-154.

**Qué resultado buscamos.** Los seis sistemas clasificados desde su ficha por la persona responsable de cumplimiento de Garrigues, cada uno con su cuestionario, la huella que calcula el servidor y un responsable asignado. Es una clasificación de prueba con el cuestionario vigente; la definitiva es MOI-177, que la sustituirá sin borrarla.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra seis cuestionarios completados en Garrigues, uno por sistema y con su huella, y el rol regulatorio y el responsable rellenos en los seis. ARGA sigue con 8 sistemas y ningún cuestionario.

**Qué te toca a ti.** Designar a la persona responsable de cumplimiento de Garrigues, que hoy no consta nombrada, y entregarle las instrucciones de prueba del apartado 5 del análisis de AIMS del 14-09-2026. Ella contesta; ningún agente lo hace por ella. Y decidir con qué cuenta entra, porque lo hecho con una cuenta queda a nombre de la persona del censo enlazada a ella:
- a) Cuenta propia: la creas tú y el agente la enlaza a esa persona con un cambio de base de datos que autorizas tras ver el ensayo. La autoría es fiel; tarda más.
- b) Cuenta de demostración del despacho: empieza ya, pero cada cuestionario, que no se puede modificar, queda a nombre de otra persona; la limitación se declara.
Recomendación: a), por criterio técnico del agente: la huella acredita la autoría, y la misma cuenta servirá en MOI-154, MOI-155 y MOI-177. Si pesa más empezar cuanto antes, b). Si no decides, la propuesta es b), con la limitación declarada.

### MOI-154 · AIMS · Volver a evaluar Harvey con el catálogo del responsable del despliegue

Etiquetas: GOS · AIMS · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** La única evaluación de Harvey, del 07-09-2026, da un 49 % de cumplimiento, pero se hizo contra el catálogo del proveedor de un sistema de alto riesgo: 10 de sus 12 comprobaciones salen no conformes con obligaciones que previsiblemente no vinculan a un despacho que solo usa la herramienta. No hay ninguna evaluación de Harvey contra las medidas del responsable del despliegue, que son 43 hoy y serán 44 cuando se incorpore el programa RIA.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues: ni la cifra de cumplimiento de Harvey ni su plan de adaptación (las acciones que propone para cerrar lo que falta) se pueden enseñar mientras midan contra otro catálogo. Antes tiene que estar hecho MOI-159, porque sin Harvey clasificado el módulo no sabe qué catálogo aplicar. Bloquea MOI-155. Conviene tener antes MOI-211, que comprueba que la versión publicada guarda bien las evaluaciones, aunque no la bloquea. Está relacionada con MOI-156: si ya se sabe si Harvey necesita una EIPD, se registra aquí.

**Qué resultado buscamos.** Una segunda evaluación de Harvey, contestada por la persona responsable de cumplimiento de Garrigues contra el catálogo del responsable del despliegue, con motivo en cada medida que marque como no aplicable, al menos un justificante subido y contestada la medida sobre la EIPD. La evaluación del 49 % se conserva intacta y avisa de que se hizo contra otro catálogo. La evaluación definitiva de Harvey llega con MOI-177.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra la evaluación nueva con respuestas del catálogo del responsable del despliegue y la antigua sin cambios, y la pantalla de inicio de AIMS de Garrigues deja de contar las 12 comprobaciones del proveedor como incumplimientos.

**Qué te toca a ti.** Nada nuevo: la contesta la persona responsable que designes en MOI-159, con la cuenta que decidas allí, no un agente. Si MOI-156 ya tiene respuesta sobre la EIPD, trasládasela para que la registre aquí.

### MOI-155 · AIMS · Recorrer por primera vez con dos personas la congelación y revisión de una evaluación

Etiquetas: GOS · AIMS · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Una evaluación de IA se cierra («congelar») y después la aprueba una persona distinta («revisar»): es la regla de cuatro ojos. Ninguna de las 8 evaluaciones de la base de datos de producción se ha congelado ni revisado, ni tiene la huella de integridad que calcula el servidor al congelar. El 14-09-2026 el tramo solo se probó con una sonda que se deshizo al terminar; no puede quedar como prueba permanente porque dejaría un registro imposible de borrar.

**A quién afecta y qué pasa si no se hace.** Afecta a AIMS y a quien deba fiarse de una evaluación cerrada: la regla y la huella nunca se han visto guardadas de verdad. Ya pasó en Secretaría: nadie había recorrido la certificación de actas y el 06-09-2026 se descubrió que ese tramo no estaba construido. Antes tiene que estar hecho MOI-154, porque lo que se congela es la evaluación nueva de Harvey. Repetirlo en ARGA exige la cuenta de MOI-153, sin frenar esta tarea.

**Qué resultado buscamos.** La evaluación nueva de Harvey congelada por una persona de Garrigues y revisada por otra distinta, habiendo comprobado que quien congela no puede aprobar.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra esa evaluación con fecha de congelación y de revisión, una huella de 128 caracteres y cuentas distintas en congelar y revisar, sin restos de sondas.

**Qué te toca a ti.** Designar a la segunda persona de Garrigues, la que revisa; congela la persona responsable de cumplimiento, con la cuenta decidida en MOI-159. Hacen falta dos personas distintas, cada una con su cuenta: dos sesiones de la misma persona no cumplen la regla. Y decidir con qué cuenta entra la revisora: como en MOI-159, lo que haga queda a nombre de la persona del censo enlazada a esa cuenta.
- a) Cuenta propia: la creas tú y el agente la enlaza a esa persona con un cambio de base de datos que autorizas tras ver el ensayo. La autoría es fiel; tarda más.
- b) Una cuenta de demostración del despacho distinta de la de quien congela: empieza ya, pero la revisión queda a nombre de otra persona, y eso se declara en un comentario.
Recomendación: a), por criterio técnico del agente: la revisión existe para acreditar quién aprueba, y con b) el registro nombra a otra persona. Si pesa más empezar cuanto antes, b), que es también la propuesta si no decides.
Lo congelado y revisado queda para siempre en producción, sin poder editarse ni borrarse: al designar a las dos personas autorizas esa escritura permanente.

### MOI-156 · AIMS · Determinar si Harvey necesita evaluación de impacto de protección de datos

Etiquetas: GOS · AIMS, GOS · Comités · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** No consta en ningún sitio si el uso de Harvey por el despacho requiere una evaluación de impacto relativa a la protección de datos (EIPD, art. 35 RGPD). La única evaluación de Harvey no contesta la medida que lo pregunta y no hay ninguna EIPD registrada. El programa RIA consultó a Harvey como asistente jurídico, y Harvey validó el 19-09-2026 este criterio: el riesgo limitado del RIA no exime de EIPD; depende del tratamiento de datos que se haga.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues y, si Harvey trata datos de clientes en el despacho, algo hoy sin medir, a ese tratamiento. Mientras no haya respuesta, la necesidad sigue pendiente y la pantalla no puede decir que no hace falta por ser riesgo limitado. No depende de ninguna tarea ni frena a otras. Está relacionada con MOI-154: la determinación puede hacerse ya; solo su registro en la evaluación nueva de Harvey espera a MOI-154.

**Qué resultado buscamos.** Una determinación motivada del DPO de Garrigues, registrada por la persona responsable de cumplimiento en la evaluación nueva de Harvey y acompañada, si la EIPD procede, de su referencia como justificante.

**Cómo sabremos que está resuelto.** Hay un comentario con la determinación, quién la tomó y su motivo. Cuando exista la evaluación de MOI-154, una consulta de solo lectura muestra en ella la medida sobre la EIPD contestada con su motivo y, si procede, con su justificante.

**Qué te toca a ti.** No lo decides tú: lo determina el DPO de Garrigues y lo registra la persona responsable de cumplimiento; ninguno consta en el dato. A la persona responsable la designas tú, en MOI-159. Al DPO lo designa el despacho como responsable del tratamiento: identificas al que tenga designado o pides que lo designe. Luego les llevas la pregunta, sin esperar a MOI-154, y trasladas la respuesta aquí. El DPO tiene dos respuestas posibles:
- a) Se requiere EIPD: se hace antes de seguir usando Harvey con datos de clientes y se cita en la evaluación.
- b) No se requiere: se motiva por escrito en la evaluación.
Recomendación: que lo determine antes de la evaluación de MOI-154 y se registre en ella, que es donde el módulo lo guarda (criterio de la fuente); el sentido de la respuesta es suyo.

### MOI-157 · Transversal · Llamar «derivación» a los casos que llegan de AIMS a GRC y Secretaría

Etiquetas: GOS · AIMS, GOS · GRC, GOS · Secretaría · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Cuando AIMS avisa a GRC o a Secretaría para que actúen, AIMS lo llama «derivación», pero las pantallas que lo reciben siguen mostrando jerga técnica en inglés y códigos internos. En GRC aparecen «intake GRC», «Handoffs de solo lectura», «Sin handoff», el código del aviso sin traducir y una etiqueta técnica sobre el modo de escritura; en Secretaría, «Handoff read-only desde AIMS 360» o «desde GRC Compass». Dos pruebas automáticas exigen precisamente esos textos, así que quitarlos las pone en rojo.

**A quién afecta y qué pasa si no se hace.** Afecta a los abogados y responsables que usan GRC y Secretaría: ven dos nombres para el mismo aviso y códigos que no entienden. No bloquea otras tareas ni depende de ninguna.

**Qué resultado buscamos.** Las pantallas de GRC y de Secretaría que reciben el aviso usan «derivación» y un nombre legible del caso, sin códigos internos, en los tres grupos (también en ARGA), y las pruebas automáticas vigilan que la jerga no vuelva en lugar de exigirla.

**Cómo sabremos que está resuelto.** Una búsqueda en el código muestra que ningún texto visible contiene esas expresiones, y las pruebas automáticas de GRC y de las derivaciones entre módulos pasan con la comprobación nueva. Tras tu autorización, la versión publicada ya dice «derivación».

**Qué te toca a ti.** Autorizar en un comentario la incorporación a la versión principal cuando el agente te enseñe las pruebas en verde, porque eso publica el cambio en producción. Los rótulos cambian también en las pantallas de ARGA: es un cambio visible de ARGA, declarado aquí, que autorizas con esa misma incorporación. No hay nada que decidir.

### MOI-158 · Transversal · Que GRC y Secretaría lean qué caso de AIMS les llega

Etiquetas: GOS · AIMS, GOS · GRC, GOS · Secretaría · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Cuando AIMS deriva un incidente de IA a GRC o a Secretaría, el enlace lleva el identificador del incidente, pero el destino no lo aprovecha: GRC lo descarta, y Secretaría lo muestra como un código largo sin comprobar a qué incidente corresponde ni si es del mismo grupo. Lo mismo ocurre cuando AIMS deriva una evaluación a la pantalla de riesgos de GRC. Quien recibe la derivación tiene que buscar a mano qué caso la motiva.

**A quién afecta y qué pasa si no se hace.** Afecta a los responsables de GRC y de Secretaría, que reciben avisos sin saber de qué caso vienen. Son las tareas F2.T13 y F2.T14 de la fase F2 del programa RIA, sacadas aparte para no esperar a MOI-170, que lleva el resto de esa fase; lo que se hace aquí no depende de la rama del programa RIA. Bloquea MOI-56, que conecta AIMS y Secretaría con trabajo y justificantes que se guardan: sin saber qué caso llega, no hay nada que conectar.

**Qué resultado buscamos.** GRC y Secretaría leen el identificador del caso de AIMS y muestran su referencia y su título, en solo lectura y solo si pertenece al grupo de quien entra; si es de otro grupo, no muestran nada.

**Cómo sabremos que está resuelto.** Al abrir las pantallas de destino con un incidente real se ve su referencia; con uno de otro grupo no aparece nada; y una prueba automática falla si el identificador deja de leerse.

**Qué te toca a ti.** Autorizar en un comentario la incorporación a la versión principal cuando el agente te enseñe las pruebas en verde, porque eso publica el cambio en producción. El aviso cambia también en ARGA: es un cambio visible de ARGA, declarado aquí, que autorizas con esa incorporación. No lleva cambios de base de datos.

### MOI-160 · Transversal · Decidir si «cubierto» significa lo mismo en AIMS y en GRC

Etiquetas: GOS · AIMS, GOS · GRC, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS y GRC contestan de forma distinta a la misma pregunta: «¿esta obligación está cubierta?». AIMS mira el nivel de madurez de cada medida: cuenta la que se declara implantada, salvo que conste sin justificante, y la que se declara no aplicable con su motivo. GRC mira los controles: una obligación sale «cubierta» solo si todos sus controles son efectivos, y «sin control» si no tiene ninguno. Ninguno consulta al otro. Desde el 20-09-2026, GRC tiene en ARGA y en Garrigues la obligación de alfabetización en IA del art. 4 del RIA y hoy la muestra sin control.

**A quién afecta y qué pasa si no se hace.** Afecta a quien use AIMS y GRC a la vez, en ARGA y en Garrigues: la misma obligación puede salir cubierta en un módulo y sin control en el otro, sin que ninguna pantalla lo explique. Decidir no espera a nada; aplicarlo espera a MOI-125, porque la rama del programa RIA endurece el criterio de AIMS: tampoco cuenta la medida implantada cuyo justificante nunca se registró.

**Qué resultado buscamos.** Tu decisión registrada y, después, pantallas que usen un único criterio o dos nombres distintos, con una prueba automática que falle si una pantalla decide por su cuenta.

**Cómo sabremos que está resuelto.** Tu comentario con la decisión en este issue, anotada en el registro del programa RIA; y, cuando se incorpore, las pantallas de AIMS y de GRC con los nombres o el criterio decididos.

**Qué te toca a ti.** Decidir si «cubierto» es un criterio o dos. Te corresponde porque es una decisión de producto: cambia lo que lee quien usa los dos módulos.
- (a) Dos medidas distintas, madurez en AIMS y efectividad del control en GRC, con nombres diferentes en pantalla. No cambia la base de datos y sigue un precedente: desde el 07-09-2026, si un riesgo de GRC trae dos evaluaciones que no se concilian, la pantalla muestra las dos y dice que son dos.
- (b) Un solo criterio. Exige fijar equivalencias, como «madurez implantada = control efectivo», que nadie ha validado.
Recomendación: (a), la que hace el análisis del 20-09-2026, porque las dos cosas miden hechos distintos; el motivo es de producto, no jurídico. Mientras decides, y si no decides, cada módulo sigue con su criterio y nada garantiza que las pantallas coincidan. No se ha medido cuántas obligaciones difieren hoy. Después, el agente te pedirá autorizar la incorporación a la versión principal y te declarará antes cualquier cambio de nombre en pantallas de ARGA.

### MOI-161 · Transversal · Decidir un único vocabulario de estados para AIMS, GRC y Secretaría

Etiquetas: GOS · AIMS, GOS · GRC, GOS · Secretaría, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Cada módulo tiene su propia lista de estados y su forma de leerlos. AIMS los lee en mayúsculas y sin tildes; GRC los compara tal cual, con mayúscula inicial y tilde. Un incidente tiene tres estados en AIMS (abierto, en investigación y cerrado) y cinco en GRC, que añade en contención y resuelto. Contando Secretaría, el expediente técnico de AIMS y los justificantes de GRC, hay cinco listas o más.

**A quién afecta y qué pasa si no se hace.** Afecta a quien vea en un módulo un dato que viene de otro. Si un estado pasa de un módulo a otro, la pantalla lo pinta con la etiqueta gris neutra, sin avisar, y parece un dato sin estado. Decidir no espera a nada; aplicarlo espera a MOI-125, porque la rama del programa RIA modifica una de las pruebas del vocabulario de AIMS. Está relacionado con MOI-185: si allí se elige su opción b), la base de datos exigirá al inventario de IA los estados del vocabulario de AIMS, y conviene que sea el que salga de aquí.

**Qué resultado buscamos.** Tu decisión registrada y, después, que ningún estado conocido de los tres módulos acabe en la etiqueta neutra, vigilado por una prueba automática.

**Cómo sabremos que está resuelto.** Tu comentario con la decisión en este issue, anotada en el registro del programa RIA, y una prueba automática que falla si un estado conocido cae en la etiqueta neutra.

**Qué te toca a ti.** Decidir cómo se ordenan los estados. Te corresponde porque es una decisión de producto que afecta a los tres módulos.
- (a) Un vocabulario común que cada módulo traduce a sus rótulos. Da coherencia a largo plazo y sirve mejor a un grupo que empieza desde cero, pero toca las listas de los tres módulos y puede cambiar rótulos en pantallas de ARGA, que se te declararían antes.
- (b) Cada módulo conserva su lista y se añade una traducción en los puntos donde un dato pasa de uno a otro. Es un cambio menor y no toca ARGA, pero cada conexión nueva necesitará su traducción.
El análisis del 20-09-2026 no recomienda ninguna. Recomendación: (b), por criterio técnico del agente redactor, porque hoy los módulos apenas intercambian datos y así no se toca ARGA; elige (a) si pesa más la coherencia para un grupo nuevo. Mientras decides, y si no decides, cada módulo sigue con su lista. No se ha medido qué estados hay hoy guardados en cada grupo. Después, el agente te pedirá autorizar la incorporación a la versión principal.

### MOI-162 · Transversal · Decidir cómo cuelga un plan de acción de una obligación o de una brecha de IA

Etiquetas: GOS · AIMS, GOS · GRC, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS y GRC guardan los planes de acción en sitios que no se hablan. AIMS guarda el plan de cada evaluación de IA dentro de la propia evaluación. GRC tiene un registro de planes de acción, pero cada acción tiene que colgar obligatoriamente de un hallazgo: no puede colgar de una obligación ni de un sistema de IA. El experto RIA pide un único plan de acción, el de GRC. ARGA tiene 8 planes en GRC y Garrigues ninguno.

**A quién afecta y qué pasa si no se hace.** Afecta a quien siga en AIMS y en GRC las acciones de corrección de un sistema de IA. Mientras no se decida, hay dos planes de acción para el mismo sistema y no puede darse el paso 5 de la convergencia AIMS–GRC, el del plan de acción único. Bloquea MOI-175, que construye esta parte en la fase F5 del programa RIA.

**Qué resultado buscamos.** Tu decisión sobre el modelo de datos registrada y MOI-175 ajustado a ella, para que allí una acción pueda crearse contra una obligación del RIA sin inventar un hallazgo y sin alterar los 8 planes de ARGA.

**Cómo sabremos que está resuelto.** Tu comentario con la decisión en este issue, anotada en el registro del programa RIA, con la opinión de los órganos de IA sobre el contenido del plan, y la tarea correspondiente de MOI-175 actualizada.

**Qué te toca a ti.** Llevar al Comité de IA de Garrigues y, como el registro de planes es común y ARGA ya tiene 8, también al CATIT, la pregunta de qué debe contener el plan; oída su respuesta, decidir cómo cuelga una acción de una obligación. Te corresponde porque el modelo de datos es de producto.
- (a) Permitir acciones sin hallazgo y darles un enlace a la obligación y al sistema. Toca un registro que comparte ARGA, pero no cambia sus 8 planes. Es lo que ya prevé el diseño de la fase F5.
- (b) Crear un hallazgo automático por cada brecha. No cambia la estructura, pero llena la lista de hallazgos con filas que nadie ha encontrado y obliga a rehacer el diseño de la fase F5.
Recomendación: (a), por criterio técnico del agente, porque (b) fabrica hallazgos; el motivo es la fiabilidad del dato, no jurídico. El análisis del 20-09-2026 no recomienda ninguna. Mientras decides, el plan de AIMS sigue donde está y la pantalla no lo presenta como plan de GRC; si no decides, MOI-175 no puede hacer esta parte. Falta la opinión de los órganos de IA; no está estimado el coste de rehacer la fase F5 con (b). El cambio de base de datos se te pedirá autorizar en MOI-175, tras el ensayo.

### MOI-163 · Equipo legal · Decidir la lectura del plazo inicial DORA sin clasificación y cotejar la cita del Reglamento Delegado 2025/301

Etiquetas: GOS · GRC, GOS · Comités · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS y GRC calculan por separado el plazo de la notificación inicial de un incidente según DORA, y no coinciden cuando el incidente aún no está clasificado: el cálculo de AIMS la fija a las 4 horas desde que se conoce, y el de GRC pone un tope de 24 horas y solo aplica las 4 horas desde que se clasifica. Son 20 horas de diferencia en un aviso a la autoridad. Cuál es la correcta es una lectura jurídica del art. 19 de DORA y del Reglamento Delegado (UE) 2025/301. Además, la ficha de incidente de GRC afirma, sin citar artículo ni cotejo con el texto oficial, que ese Reglamento Delegado obliga a una notificación motivada si un informe no llega en plazo.

**A quién afecta y qué pasa si no se hace.** Afecta a quien gestione un incidente tecnológico en ARGA o en Garrigues: una de las dos fechas está mal, y la pantalla atribuye a una norma un deber no comprobado. Bloquea MOI-215, que deja un solo cálculo para AIMS y GRC y necesita saber qué lectura aplicar.

**Qué resultado buscamos.** El criterio del equipo legal registrado en este issue: qué plazo manda cuando aún no hay clasificación, y en qué artículo y apartado del Reglamento Delegado está la notificación motivada de retraso, o que no está.

**Cómo sabremos que está resuelto.** Un comentario recoge las dos respuestas del equipo legal, con la fecha de la versión consultada, y MOI-215 las enlaza.

**Qué te toca a ti.** Llevar las dos preguntas al equipo legal y trasladar su respuesta a este issue; decide el equipo legal. En la primera hay dos lecturas: 4 horas desde que se conoce el incidente, más conservadora, pero que adelanta un plazo que la norma liga a la clasificación; o tope de 24 horas y 4 horas desde la clasificación, más pegada a la letra. Por criterio técnico, el agente que preparó la tarea prefiere la segunda, avisando en pantalla de que clasificar activa las 4 horas; el análisis del 20-09-2026 no elige. Mientras no responda, cada pantalla da su fecha y la ficha conserva la frase sin cita.

### MOI-164 · Transversal · Enlazar los riesgos de IA de GRC con su sistema y corregir el riesgo mal calificado de ARGA

Etiquetas: GOS · AIMS, GOS · GRC, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** En GRC, un riesgo no puede apuntar a un sistema de IA: el registro de riesgos no tiene ese enlace. ARGA tiene tres riesgos de IA sueltos: sin sistema, sin obligación, sin responsable y sin riesgo residual calculado; la relación con AIMS solo está escrita a mano en una descripción. Además, uno contiene un error de derecho: dice que el cálculo automático de precios del seguro de automóvil es de alto riesgo según el RIA, pero el anexo III, punto 5 c), solo alcanza a los seguros de vida y de salud.

**A quién afecta y qué pasa si no se hace.** Afecta a AIMS, que no puede leer el riesgo de un sistema aunque, según el experto RIA, ese riesgo lo lleva GRC, y a quien vea el dato de demostración de ARGA, porque todo informe que pinte ese riesgo repite el error. Sin el enlace no puede darse el paso 4 de la convergencia AIMS–GRC: que GRC escriba el riesgo de cada sistema de IA y AIMS lo lea. Necesita antes MOI-125. Bloquea MOI-180, que en 2027 usará este enlace en el resto de la fase F8.

**Qué resultado buscamos.** Que un riesgo de GRC pueda enlazarse con su sistema de IA, separado por grupo; que los riesgos de ARGA que describen un sistema inventariado queden enlazados; que la ficha del sistema en AIMS muestre ese riesgo sin poder cambiarlo; y que el riesgo de automóvil quede tratado como decidas.

**Cómo sabremos que está resuelto.** La ficha de un sistema de ARGA en AIMS muestra su riesgo enlazado; una sonda comprueba que Garrigues no ve ese enlace; y el riesgo de automóvil queda como hayas decidido.

**Qué te toca a ti.**
- Llevar al equipo legal la confirmación del alcance del anexo III, punto 5 c), y trasladar su respuesta.
- Decidir qué se hace con el riesgo de automóvil, porque es una excepción a la regla de no cambiar el dato de ARGA. Hay dos criterios: corregir la descripción, un cambio mínimo con precedentes; o, como prevé el diseño del programa RIA, no reescribir el texto y añadir al lado una nota de corrección. Cabe también dejarlo y declararlo como error conocido. Recomendación: corregir la descripción, por criterio técnico del agente, porque es la única vía con la que ningún informe repite el error; el análisis del 20-09-2026 lo confirma, pero no dice cómo tratarlo. Mientras tanto, la pantalla sigue afirmándolo.
- Autorizar en un comentario, cuando el agente te enseñe el ensayo, el cambio de base de datos y el cambio del dato de ARGA que suponen los enlaces.
- Autorizar después la incorporación a la versión principal.

### MOI-210 · AIMS · Decidir, antes de clasificar, si los usuarios pueden seguir borrando sistemas de IA

Etiquetas: GOS · AIMS, GOS · Decisión · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Hoy cualquier usuario puede borrar un sistema de IA de su grupo; es el único registro del módulo con ese permiso. Con él se borran, sin aviso, cuatro registros con valor probatorio: su cuestionario de clasificación sellado, sus versiones, su expediente técnico y sus indicadores. No se puede borrar un sistema con evaluaciones, comprobaciones, incidentes o documentos de soporte, pero, medido el 24-09-2026, 5 de los 6 sistemas de Garrigues y 3 de los 8 de ARGA no tienen ninguno. El permiso se mantuvo porque dos sondas lo usan para borrar sus sistemas de prueba.

**A quién afecta y qué pasa si no se hace.** Afecta a todos los grupos, y a Garrigues en cuanto clasifique sus sistemas: un usuario podría borrar uno clasificado y su cuestionario sellado, siempre dentro de su propio grupo. Bloquea MOI-159 y condiciona la limpieza de MOI-214.

**Qué resultado buscamos.** Tu decisión registrada y, si cambia algo, el cambio aplicado y las dos sondas adaptadas, antes de clasificar los sistemas de Garrigues.

**Cómo sabremos que está resuelto.** Hay un comentario con tu decisión. Si cambia algo, una consulta muestra el permiso retirado o los registros protegidos, y las sondas no dejan filas de prueba. Nivel exigido: aceptado; con a) o b), también probado y publicado.

**Qué te toca a ti.** Decidir la protección:
- a) Retirar el permiso de borrar sistemas. Nadie podrá borrarlos desde la aplicación. Las sondas pasarán a ensayos que se deshacen solos o limpiarán con el acceso de administración, que se salta todas las protecciones y que el proyecto evita en pruebas desde que una borró datos reales.
- b) Mantener el permiso e impedir borrar un sistema con cuestionario, versiones, expediente o indicadores. Esos registros dejan de desaparecer; las sondas pasarán a ensayos que se deshacen solos, y MOI-214 no podrá borrar su sistema de prueba, que los lleva.
- c) Dejarlo declarado. La protección de b) llegaría con el programa RIA: MOI-173 tendría que impedir borrar un sistema con cuestionario antes del 13-11-2026, y MOI-180, el resto en 2027.
Recomendación: b), por criterio técnico del agente: es la regla del programa RIA y la adelanta, aunque obliga a cambiar las sondas y MOI-214. Si pesa más que ningún sistema pueda desaparecer, elige a). Mientras no decidas, MOI-159 espera; c) permite clasificar con el riesgo declarado. Con a) o b) autorizarás, tras ver el ensayo, el cambio de base de datos y la incorporación de las sondas adaptadas a la versión principal.

### MOI-215 · Transversal · Un solo cálculo de los plazos DORA y RGPD para AIMS y GRC

Etiquetas: GOS · AIMS, GOS · GRC · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Los plazos para notificar un incidente según DORA y el RGPD se calculan dos veces, una en AIMS y otra en GRC, con dos piezas del programa que no se conocen entre sí, y ya no dan lo mismo. Si el incidente aún no está clasificado como grave, AIMS fija la notificación inicial a las 4 horas desde que se conoce y GRC a las 24 horas. El informe final suma un mes con relojes distintos, así que cerca de medianoche o de fin de mes puede cambiar el día. Además, la ficha de incidente de GRC usa la fecha de contención como si fuera la de clasificación.

**A quién afecta y qué pasa si no se hace.** Afecta a quien gestione un incidente tecnológico o una brecha de datos personales en ARGA o en Garrigues: dos pantallas pueden dar dos fechas distintas para la misma notificación a la autoridad. Esta tarea espera a MOI-163, donde el equipo legal decide qué plazo manda cuando aún no hay clasificación y coteja la cita del Reglamento Delegado 2025/301. No bloquea ninguna otra.

**Qué resultado buscamos.** Un solo cálculo de los plazos DORA y RGPD, con la lectura que fije MOI-163, que usen las pantallas de AIMS y de GRC. La ficha de GRC calcula con la fecha de clasificación, no con la de contención, y la frase sobre el aviso de retraso queda como diga MOI-163: con su artículo o retirada.

**Cómo sabremos que está resuelto.** Una prueba automática compara los casos difíciles (sin clasificación, medianoche y fin de mes) y otra falla si alguien vuelve a escribir un segundo cálculo. Las pantallas de AIMS y de GRC dan la misma fecha para el mismo caso. Nivel exigido: probado y publicado, es decir, comprobado con esas pruebas e incorporado a la versión principal con tu autorización.

**Qué te toca a ti.** Dos cosas, en comentarios de este issue. Primero, confirmar que se deja un solo cálculo, que el análisis del 20-09-2026 considera barato y sin obstáculos. Después, autorizar la incorporación a la versión principal, que la publica, cuando el agente te declare qué fechas cambian en las pantallas de ARGA y de Garrigues. Si guardar la fecha de clasificación de GRC exigiera un cambio de base de datos, el agente te lo pedirá aparte y lo autorizarás después de ver el ensayo. Mientras tanto, cada pantalla sigue dando su fecha.

## M3 · RIA: obligaciones y decisiones con fecha en 2026

### MOI-165 · RIA · Archivar la respuesta de Harvey H-02A sin retirar antes de tiempo el rótulo provisional

Etiquetas: GOS · RIA · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Harvey respondió el 19-09-2026 al lote H-02A, sobre las ayudas del cuestionario guiado para prácticas prohibidas (art. 5 del RIA) y cuatro medidas del catálogo; de ahí salieron la versión 1.1.2 del cuestionario y una medida nueva. Pero esa respuesta solo está en la consola de Harvey: el registro de consultas del repositorio solo recoge el lote H-01, y a H-01 le falta la huella de la pregunta enviada. Además hay una trampa: dos pruebas automáticas exigen que, en cuanto H-02A conste como respondido, desaparezca el rótulo provisional, que solo puede retirar el equipo legal.

**A quién afecta y qué pasa si no se hace.** Afecta a quien valida los criterios del programa RIA: el criterio ya aplicado no tiene el justificante que el programa exige. Si alguien anota H-02A como respondido sin cambiar antes esas pruebas, fallan, y la salida fácil sería quitar el rótulo antes de la revisión del equipo legal. Necesita antes MOI-123, que pone a salvo la rama del programa RIA. Bloquea MOI-166.

**Qué resultado buscamos.** La pregunta y la respuesta de H-02A copiadas literalmente del hilo de Harvey al repositorio, con su huella; la que le falta a H-01; y unas pruebas automáticas que mantienen el rótulo hasta que conste la revisión del equipo legal.

**Cómo sabremos que está resuelto.** El registro de consultas a Harvey muestra H-02A como respondido, con sus documentos; el rótulo «Provisional, pendiente de validación» sigue en la pregunta del art. 5 y en las cuatro medidas; las pruebas pasan; y una prueba nueva falla si alguien retira el rótulo sin esa revisión.

**Qué te toca a ti.** La consulta a Harvey ya la autorizaste el 19-09-2026; si la sesión de su consola ha caducado, entrarás tú, porque los agentes no manejan contraseñas. Al final autorizarás subir este trabajo a GitHub e incorporarlo a la versión principal, lo que lo publica en producción: si viaja con la rama del programa RIA, es la autorización de MOI-123 y MOI-125; si no, el agente te la pedirá aquí.

### MOI-166 · Equipo legal · Revisar las ayudas del cuestionario y quién entra en el art. 4, para retirar el rótulo provisional

Etiquetas: GOS · RIA, GOS · Comités · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** En la rama del programa RIA, el cuestionario guiado muestra «Provisional, pendiente de validación» en la pregunta sobre prácticas prohibidas (art. 5) y en cuatro medidas del catálogo. Harvey validó el criterio el 19-09-2026 (lote H-02A), pero el registro del programa exige además que el equipo legal revise el texto de las ayudas de dos preguntas: la del art. 5 y la de la excepción motivada del art. 6.3. Falta también confirmar una desviación: el programa aplica el art. 4 (alfabetización en IA) también al proveedor posterior, porque el art. 3.68 lo define como proveedor de un sistema.

**A quién afecta y qué pasa si no se hace.** Quien conteste el cuestionario en Garrigues o en ARGA seguirá viendo el aviso, y a un proveedor posterior se le exigirá el art. 4 sin confirmación jurídica. Espera a MOI-165, que archiva la respuesta de Harvey. Bloquea MOI-167, porque el Comité de IA valida el catálogo de medidas después de que el equipo legal revise estas ayudas.

**Qué resultado buscamos.** Un dictamen del equipo legal, con fecha, que apruebe o corrija las ayudas y confirme o rechace al proveedor posterior en el art. 4; y, según diga, el rótulo retirado o la corrección aplicada.

**Cómo sabremos que está resuelto.** El registro del programa RIA recoge el dictamen con su fecha, el cuestionario ya no muestra el rótulo o muestra el texto corregido, y una prueba automática lo comprueba.

**Qué te toca a ti.** Enviar al equipo legal el texto que te preparará el agente, con el documento de verificación del Ómnibus, y trasladar su respuesta a este issue. Decide el equipo legal; Harvey no sustituye su revisión. Mientras no conteste, el rótulo sigue. Sobre el art. 4, puede mantener al proveedor posterior, como hoy, porque quitarlo escondería una obligación (criterio técnico del agente que lo implementó), o quitarlo, que es un cambio pequeño. Después autorizarás, cuando se te pida, incorporar el resultado a la versión principal, lo que lo publica en producción.

### MOI-167 · Comité de IA · Validar el catálogo de medidas del responsable del despliegue

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Comités · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS mide a quien usa un sistema de IA de riesgo limitado o mínimo (el responsable del despliegue, como Garrigues con Harvey) contra un catálogo de medidas propio que la pantalla presenta con cobertura provisional, porque el Comité de Gobernanza de la IA no lo ha validado. La versión principal tiene 43 medidas; la rama del programa RIA, aún sin incorporar, sube a 44 al añadir la obligación del art. 50.3 del RIA (reconocimiento de emociones o categorización biométrica) y pasa cuatro medidas a marco operativo.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues y a su persona responsable de cumplimiento: toda cifra de cumplimiento medida contra ese catálogo es provisional hasta que el Comité lo valide. Espera a MOI-166, porque el Comité necesita las ayudas del cuestionario ya revisadas por el equipo legal.

**Qué resultado buscamos.** Un dictamen fechado del Comité de IA sobre la composición del catálogo, anotado en el registro del programa, y el aviso retirado tras aplicar los cambios que pida: en Garrigues, con el dictamen; en ARGA, cuando el CATIT adopte el catálogo.

**Cómo sabremos que está resuelto.** Un comentario recoge el dictamen, que consta en el registro del programa; una prueba automática comprueba que el aviso desaparece en Garrigues y sigue en ARGA hasta que el CATIT adopte el catálogo.

**Qué te toca a ti.** Decide el Comité de IA de Garrigues, no tú. Te toca llevar el catálogo a su orden del día, con el paso de 43 a 44 medidas, y trasladar el dictamen a este issue y al CATIT. El Comité puede validar las 44 tal cual, validarlas con cambios, que se aplican antes de retirar el aviso, o no validar aún; el agente propone, por criterio técnico, validar las 44, que ya incluyen el art. 50.3. Propuesta del agente, porque la fuente no fija el papel del CATIT: el dictamen de Garrigues vale para el producto y el CATIT decide si lo adopta para ARGA. Hasta entonces la pantalla sigue diciendo «cobertura provisional». Retirar el aviso en la versión principal exige antes MOI-125 y tu autorización para incorporarlo.

### MOI-168 · RIA · Enviar al experto el documento de incidencias y celebrar la sesión

Etiquetas: GOS · RIA, GOS · Comités · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El programa RIA convierte la matriz de obligaciones del experto RIA en el catálogo de AIMS. Para eso se preparó el 19-09-2026 un documento de incidencias con 31 preguntas numeradas, de P-00 a P-30, dirigido al experto. P-00 pregunta si su matriz es para el cumplimiento interno del despacho, para clientes o para las dos cosas. P-08 le pide el texto íntegro de siete celdas de su hoja de cálculo que llegan cortadas a 180 caracteres, entre ellas la de la obligación OB-48. No consta que el documento se haya enviado ni que haya respuestas.

**A quién afecta y qué pasa si no se hace.** Afecta al catálogo de obligaciones de la fase F3 (MOI-171): mientras el experto no responda, el catálogo aplica el texto de la norma de forma provisional, marca esas filas «a validar por el experto», y las siete celdas cortadas no se pueden completar. La sesión no bloquea ninguna tarea, pero en el programa manda el criterio del experto. Si el experto corrige algo ya publicado en la versión 1.0 del catálogo (MOI-171), esa versión no se reescribe: el cambio entra en la versión 1.1, que publica MOI-213, y queda anotado con su motivo.

**Qué resultado buscamos.** La sesión celebrada y su acta archivada, con cada pregunta aceptada, rechazada o respondida, y el catálogo y el documento actualizados con esas respuestas.

**Cómo sabremos que está resuelto.** El acta está en el repositorio y el registro del programa RIA recoge el resultado de cada una de las 31 preguntas.

**Qué te toca a ti.** Enviar el documento al experto y citarlo a la sesión; conviene empezar por P-00 y P-08. El documento está hoy solo en la rama del programa RIA: el agente te preparará una copia para enviar, sin el anexo interno que el propio documento excluye. Tras la sesión, el agente vuelca el acta y regenera el documento desde el catálogo; autorizarás, cuando se te pida, subir el acta a GitHub e incorporarla a la versión principal, lo que la publica en producción.

### MOI-169 · RIA · Enviar a Harvey los lotes pendientes, primero los que vencen antes del 13-11

Etiquetas: GOS · RIA · Asignado: sin asignar · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El programa RIA no fija ningún criterio en el servidor sin el veredicto de Harvey archivado. Hoy el registro de consultas solo recoge el lote H-01. H-05 ya no hay que enviarlo: H-01 contestó sus dos preguntas (cuándo hace falta la EIPD y qué exige el art. 4). H-02A está respondido pero sin archivar (MOI-165). Faltan H-02, H-03, H-04 y H-06 a H-17. H-14 debe salir antes del 13-11-2026, tope interno del programa, y H-02 antes de que la fase F4 fije en el servidor la clasificación. Y falta la herramienta que, según la especificación, genera cada pregunta desde el catálogo.

**A quién afecta y qué pasa si no se hace.** Afecta a las fases de 2026 del programa. Necesita antes MOI-123, que pone a salvo la rama. Bloquea MOI-171, que envía H-03 con esta herramienta, y MOI-173, que usa las respuestas a H-02 y H-17 en el cuestionario v2, del que depende la clasificación real antes del 2-12-2026. MOI-176 (relacionada) usa la de H-14; si falta el 14-11, su catálogo sale como cobertura provisional y sigue.

**Qué resultado buscamos.** La herramienta, y H-02, H-09, H-14 y H-17 respondidos y archivados antes del 13-11-2026 (fecha propuesta para H-09 y H-17), porque los usan tareas de 2026 que no los envían, como MOI-170 con H-09. Los demás los envía con esta herramienta la tarea que los usa: por ejemplo, H-16 MOI-178 y H-08 MOI-179.

**Cómo sabremos que está resuelto.** El registro de consultas muestra esos cuatro lotes respondidos, con su pregunta, su respuesta y su huella, y el registro del programa lleva cada veredicto a su tarea y cada lote pendiente a quien lo envía.

**Qué te toca a ti.** La consulta a Harvey ya la autorizaste el 19-09-2026; si la sesión de su consola ha caducado, entrarás tú, porque los agentes no manejan contraseñas. Al final autorizarás subir este trabajo a GitHub e incorporarlo a la versión principal, que lo publica en producción: si viaja con la rama del programa RIA, es la autorización de MOI-123 y MOI-125; si no, te la pedirá el agente aquí.

### MOI-170 · RIA · Sujeto jurídico, permisos y autoría de cada evaluación (fase F2)

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS todavía no sabe qué sociedad del grupo responde de cada sistema de IA y con qué papel (su sujeto jurídico), no distingue por rol quién puede clasificar, evaluar o revisar, y no guarda quién redactó cada evaluación (vacío en las 8 que hay). De la fase F2 del programa RIA solo está hecha la primera tarea: la regla de qué sociedades pueden responder de un sistema. Seis sociedades del despacho sin personalidad acreditada esperan la respuesta de Harvey al lote H-09, que envía MOI-169.

**A quién afecta y qué pasa si no se hace.** Afecta a quien clasifica y revisa sistemas en Garrigues y en ARGA. Sin autor guardado, la revisión a cuatro ojos compara al revisor con quien congeló la evaluación, no con quien la redactó. Está bloqueado por MOI-123, que pone a salvo en GitHub la rama del programa RIA. Bloquea MOI-173 (tope interno el 13-11-2026), MOI-175, MOI-181 y MOI-217 (reclasificación de los sistemas de ARGA).

**Qué resultado buscamos.** Que cada sistema tenga su sociedad responsable, su papel y su responsable interno; que los permisos por rol se apliquen en la base de datos y en pantalla; que cada evaluación nueva guarde quién la redactó; y que la revisión exija cuatro ojos reales, con un revisor miembro del órgano de IA. En ARGA, el agente propone qué sociedad responde de cada sistema según la decisión D-U1 que aceptaste el 20-09-2026, como dato simulado a validar por el equipo legal. Calendario orientativo: del 29-09 al 24-10-2026.

**Cómo sabremos que está resuelto.** Los cambios de base de datos de la fase constan en producción y en el repositorio; las pruebas de aislamiento pasan con los accesos de ARGA y de Garrigues; y un ensayo crea una evaluación con una cuenta de Garrigues y deja anotado quién la redactó. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario, tras ver su ensayo, cada cambio de base de datos de la fase (unos siete) y, tras ver el de las cargas, las filas de ARGA que tocan: país y sector de sus sociedades (solo donde están vacíos), las direcciones de las sociedades candidatas, el órgano de su política de IA, la asignación de esa política a sus 8 sistemas y las hipótesis de qué sociedad responde de cada uno. Llevar al equipo legal esas hipótesis, cuando el agente las tenga listas, y traer aquí su validación. Autorizar la incorporación del trabajo a la versión principal, que lo publica. Y crear la cuenta de cumplimiento de ARGA (MOI-153), sin la cual ARGA no tiene revisor.

### MOI-171 · RIA · Publicar la versión 1.0 del catálogo de obligaciones del experto (fase F3)

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS mide hoy los sistemas de IA con catálogos de medidas de madurez, no contra la lista de 65 obligaciones del RIA que preparó el experto. Esa lista todavía no está dentro del producto: falta convertirla en un catálogo que diga, para cada obligación, a quién obliga, desde cuándo es exigible, qué artículo la funda y qué documento la acredita. La fase F3 del programa RIA no ha empezado.

**A quién afecta y qué pasa si no se hace.** Afecta a cumplimiento en Garrigues y en ARGA, y al experto RIA, cuyo criterio manda. Bloquea MOI-173, el cuestionario v2, con tope interno el 13-11-2026. Está bloqueado por MOI-123, porque se trabaja sobre la rama del programa RIA, y por MOI-169, que prepara la herramienta de envío a Harvey. El lote H-03, sobre las reglas de aplicación del catálogo, lo envía este issue con la herramienta de MOI-169 cuando las obligaciones estén depuradas; la versión 1.0 no se publica sin su respuesta.

**Qué resultado buscamos.** Un catálogo publicado como versión 1.0 en la base de datos, con cada obligación citada contra el texto oficial consolidado del RIA, las filas añadidas por el equipo marcadas como pendientes de validar por el experto y las discrepancias con su material señaladas. El calendario del programa propone hacer la fase entre el 29-09 y el 17-10-2026. La sesión con el experto va en MOI-168 y no frena esta tarea: si cambia algo, la versión 1.0 no se reescribe y la corrección se añade en la versión 1.1, que publica la fase F7 (MOI-213).

**Cómo sabremos que está resuelto.** El cambio de base de datos que publica el catálogo consta en producción y en el repositorio, y la copia del programa y la de la base de datos coinciden. Una prueba automática falla si una obligación queda sin regla de aplicación, sin destinatarios o sin fase, o si cita un artículo que no existe. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Hacer llegar al equipo legal el primer bloque de obligaciones ya depuradas por el agente (16 de las 65: inventario, prohibiciones, clasificación, roles regulatorios e importadores), cuya revisión legal exige el plan del programa, y dejar su respuesta en un comentario. Autorizar en un comentario, después de ver su ensayo, el cambio de base de datos que publica la versión 1.0, y autorizar la incorporación del trabajo a la versión principal, que lo publica.

### MOI-172 · Equipo legal · Validar las preguntas nuevas del cuestionario v2 y el alcance de los arts. 27 y 51 a 56

Etiquetas: GOS · RIA, GOS · Comités · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El cuestionario guiado tiene cuatro puntos pendientes del equipo legal. Uno: solo califica como proveedor o responsable del despliegue; no pregunta si la sociedad importa o distribuye un sistema (arts. 3.6 y 3.7). Dos: una sola pregunta junta la modificación sustancial (art. 3.23) y el cambio de finalidad (art. 25.1), así que no se sabe por qué vía alguien pasa a ser proveedor. Tres: no dice a quién alcanza la evaluación de impacto en derechos fundamentales (art. 27). Cuatro: asigna el capítulo de modelos de uso general (arts. 51 a 56) también a quien solo usa el sistema, con la nota «el alcance lo decide el equipo legal», y este punto falta en la lista de deudas del registro de la reorganización de AIMS.

**A quién afecta y qué pasa si no se hace.** Afecta a quien clasifica sistemas en Garrigues y ARGA: el producto no puede calificar a un importador o distribuidor, ni afirmar o negar que ARGA Score necesite la evaluación del art. 27, y Harvey y Copilot aparecerán con ese capítulo sin criterio fijado. Bloquea MOI-173, el cuestionario v2, con tope interno el 13-11-2026.

**Qué resultado buscamos.** El criterio del equipo legal sobre los cuatro puntos, anotado en ese registro y listo para que MOI-173 lo aplique.

**Cómo sabremos que está resuelto.** Un comentario recoge, con fecha, cada respuesta, y el registro de AIMS la anota.

**Qué te toca a ti.** Llevar las cuatro preguntas al equipo legal y trasladar sus respuestas aquí; decide el equipo legal. Opciones, con la recomendación técnica del agente:
- Importador y distribuidor: aprobar las dos preguntas que ya prevé el cuestionario v2 (recomendado) o declarar el límite; según la revisión previa, sin comprobarlo, hoy ningún sistema de los dos grupos lo necesita.
- Modificación y finalidad: separarlas, como el cuestionario v2 (recomendado), o mantener una.
- Art. 27: aplicarlo a ARGA por el anexo III 5 c) (seguros de vida y salud) y no a Garrigues, u otra delimitación; sin recomendación técnica. Harvey validó el 19-09-2026 que el art. 27.1 alcanza a ese tipo de aseguradora.
- Modelos de uso general: para quien solo usa el sistema, marco operativo de trazabilidad (recomendado, como la rama del programa RIA) o no asignarlo.
Mientras tanto, la pantalla avisa de que no califica al importador ni al distribuidor, la pregunta sigue conjunta y los arts. 27 y 51 a 56 salen con su nota. Después autorizarás, cuando se te pida, incorporar a la versión principal las anotaciones del registro.

### MOI-173 · RIA · Cuestionario v2 y aplicabilidad única antes del 13-11-2026 (fase F4)

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** El cuestionario guiado que clasifica los sistemas de IA no basta para el RIA modificado: no filtra antes si el programa es de verdad un sistema de IA, no reparte los papeles por sociedad y no cubre con detalle el art. 50 ni los modelos de uso general. En toda la base de datos hay 0 cuestionarios hechos. La fase F4 del programa RIA no ha empezado.

**A quién afecta y qué pasa si no se hace.** Afecta a quien clasifica sistemas en Garrigues y en ARGA. Sin la versión 2 antes del 13-11-2026, tope interno, no se pueden clasificar la herramienta de IA propia de Garrigues (GA_IA) ni ARGA Assist antes del 2-12-2026, cuando empiezan a aplicarse el art. 5.1 b bis) y b ter) y el art. 50.2. Antes tienen que estar MOI-170, MOI-171 y MOI-172; MOI-169, que envía a Harvey los lotes H-02 y H-17 cuyas respuestas usa esta tarea; y MOI-125, porque publicar la versión 2 exige que el trabajo RIA esté en la versión principal. Bloquea MOI-176 y MOI-177. Está relacionado con MOI-210. También bloquea MOI-217.

**Qué resultado buscamos.** Un cuestionario v2 de diez secciones, con un filtro previo de «¿es un sistema de IA?»; una sola regla de qué obligaciones aplican a cada sociedad, que la base de datos recalcula por su cuenta a partir de las respuestas; un diario que no se puede reescribir, donde quedan con fecha los hechos del RIA (una práctica prohibida detectada, un requerimiento de la autoridad, una solicitud de explicación); y un registro de los modelos de IA en que se apoya cada sistema, de quién son y con qué contrato o acuerdo. Además, un sistema con cuestionario ya no se podrá borrar: es la protección que MOI-210 cita en su opción c). La pregunta de «cambio significativo» queda bloqueada, y lo dice, hasta que el Comité de IA fije su procedimiento en MOI-182.

**Cómo sabremos que está resuelto.** Una prueba compara, regla por regla, el cálculo del programa y el de la base de datos con un caso que aplica y otro que no; y el alta de un sistema con el cuestionario v2 funciona con los accesos de ARGA y de Garrigues. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario cada uno de los cinco cambios de base de datos de la fase después de ver su ensayo. Después, autorizar que el cuestionario v2 se incorpore a la versión principal y se publique; solo entonces se retira el cuestionario antiguo, con un sexto cambio que también autorizas tras ver su ensayo, para que el alta no se rompa en producción mientras tanto.

### MOI-174 · RIA · Decidir cómo se muestra un control del art. 4 declarado pero sin efectividad medida

Etiquetas: GOS · RIA, GOS · GRC, GOS · Decisión · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** En GRC, un control solo puede estar efectivo, parcial o ineficaz; no hay forma de decir «existe, pero aún no se ha probado». Por eso, el 20-09-2026 no se creó el control de la obligación de alfabetización en IA del art. 4 del RIA: crearlo obligaba a afirmar una efectividad que nadie ha medido. Hoy esa obligación aparece sin control en ARGA y en Garrigues, lo cual es cierto.

**A quién afecta y qué pasa si no se hace.** Afecta a ARGA y a Garrigues, que tienen esa obligación, y a cualquier control nuevo de IA, que tendrá el mismo problema. La lista de estados es común a todos los grupos, ARGA incluido. Bloquea MOI-175, la fase F5 del programa RIA, que el calendario orientativo sitúa entre el 20-10 y el 14-11-2026 (propuesta).

**Qué resultado buscamos.** Tu decisión registrada y, cuando se cree el control, que ninguna pantalla pinte una efectividad que no se ha medido.

**Cómo sabremos que está resuelto.** Tu comentario con la decisión en este issue, anotada en el registro del programa RIA, y una prueba automática que falla si la pantalla muestra una efectividad no medida.

**Qué te toca a ti.** Decidir cómo se muestra ese control. Te corresponde porque la lista de estados la comparte ARGA.
- (a) Esperar al registro de formación de la fase F5 (MOI-175) y evaluar el control con esos registros. Es lo que prevé hoy el programa. No cambia la base de datos ni ARGA; hasta entonces la obligación sigue sin control.
- (b) Añadir el estado «sin probar» y ajustar la pantalla para que no lo muestre como «en proceso». Permite declarar ya este control y los demás de IA, pero cambia la lista de estados que usa ARGA y la regla que calcula la cobertura, y exige un cambio de base de datos.
La fuente no recomienda ninguna. Recomendación: (a), por criterio técnico del agente redactor, porque no toca lo que comparte ARGA y la pantalla ya dice la verdad; elige (b) si pesa más que se vea el control antes de medirlo. Mientras decides, la obligación aparece sin control. Si no decides, rige de hecho (a), que es lo que ya prevé el programa (propuesta del agente), pero MOI-175 no cierra esta parte sin tu comentario. No se ha medido cuántos controles de IA quedarían en la misma situación. Si eliges (b), el agente te pedirá autorizar el cambio de base de datos tras el ensayo y, después, la incorporación a la versión principal.

### MOI-175 · RIA · Completar la integración con GRC y Secretaría (fase F5)

Etiquetas: GOS · RIA, GOS · GRC, GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS, GRC y Secretaría todavía no están cosidos para el RIA. De la fase F5 ya están hechos tres pasos: la corrección que mandaba 21 obligaciones de prevención del blanqueo de Garrigues al módulo equivocado, el módulo de IA en GRC y la obligación del art. 4 en los dos entornos. Falta el resto: la segunda obligación de organización (la del art. 5, prácticas prohibidas), los controles, el registro de formación, las acciones que nacen de una brecha de IA, los hallazgos y proveedores de IA, la EIPD y el registro inmutable de los dictámenes del Comité en Secretaría.

**A quién afecta y qué pasa si no se hace.** Afecta a cumplimiento en GRC, a Secretaría y al Comité de IA. Hoy la obligación del art. 4 figura sin cobertura, y es correcto porque no hay control. Antes tienen que estar MOI-170 y tus decisiones de MOI-174 y MOI-162; para MOI-162 tienes que oír al Comité de IA, así que el Comité queda en el camino hacia el 2-12-2026: esta tarea bloquea MOI-176, el carril rápido, y este bloquea la clasificación de MOI-177. También bloquea MOI-180. Está relacionado con MOI-178 y MOI-182: sus dictámenes no tienen dónde registrarse hasta que exista la pieza de Secretaría.

**Qué resultado buscamos.** Que cada obligación de organización del RIA tenga en GRC su órgano, su política y sus controles; que la formación del art. 4 se registre por persona y sistema; que un caso grave de IA cree un hallazgo y su acción en GRC; y que un dictamen del Comité quede en Secretaría enlazado al sistema, sin poder editarse ni borrarse una vez aprobado. El calendario del programa propone hacer la fase entre el 20-10 y el 14-11-2026.

**Cómo sabremos que está resuelto.** Las pruebas de reparto de obligaciones por módulo y de la carga de Garrigues salen en verde; la página del módulo de IA de GRC lleva al programa de AIMS en los dos entornos; y un dictamen aprobado no se puede modificar. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Decidir antes MOI-174 y MOI-162. Autorizar en un comentario, después de ver su ensayo, cada cambio de base de datos y que se toquen las piezas que comparten todos los entornos, ARGA incluida: las obligaciones, controles y planes de acción de GRC, su menú y el registro de documentos de Secretaría. Autorizar también, tras ver su ensayo, las filas nuevas de ARGA: la obligación del art. 5 con su órgano de IA y tres proveedores de IA. Y autorizar la incorporación del trabajo a la versión principal, que lo publica.

### MOI-176 · RIA · Carril rápido antes del 2-12-2026: registro, catálogo del proveedor sin alto riesgo y art. 50 (fase F6)

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** Para llegar al 2-12-2026 con los sistemas clasificados, AIMS necesita antes cuatro piezas que no existen: un registro de qué obligaciones tiene cada sociedad y en qué estado están; un catálogo para el proveedor de un sistema que no es de alto riesgo; los modelos de documento del art. 50, que regula la transparencia; y avisos de lo que vence. Es el carril rápido de la fase F6 y ninguna de sus tareas ha empezado.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues y a ARGA, sobre todo a ARGA Assist y a la herramienta de IA propia de Garrigues, que tienen obligaciones del art. 50 y del art. 5 desde el 2-12-2026. Sin este carril, MOI-177 no puede clasificar con registro, catálogo y avisos antes de esa fecha. Antes tienen que estar MOI-173 y MOI-175, porque el registro usa el alta de obligaciones de organización que construye esa tarea. MOI-169 (relacionada) envía a Harvey el lote H-14: el catálogo nuevo lo necesita para quedar validado, pero si no llega antes del 14-11 sale como cobertura provisional y el carril sigue. Bloquea MOI-177, MOI-212 y MOI-213.

**Qué resultado buscamos.** En la ventana orientativa del programa, del 14-11 al 27-11-2026: el registro de cumplimiento por obligación y sociedad, que se rellena solo al completar un cuestionario; el catálogo del proveedor sin alto riesgo; los modelos de documento del art. 50, que solo aprueba una persona distinta de su autor; y una bandeja de alarmas que distingue lo exigible de lo exigible a partir de una fecha.

**Cómo sabremos que está resuelto.** Una prueba automática manda al proveedor de un sistema de riesgo limitado al catálogo nuevo y no al de alto riesgo, y el cambio de base de datos del registro consta en producción antes del 27-11-2026, fecha orientativa para llegar al plazo regulatorio del 2-12-2026. Las alarmas con datos reales se comprueban después, en MOI-177, cuando haya cuestionarios completados. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario, tras ver su ensayo, los cuatro cambios de base de datos del carril: el registro, que debe estar aplicado antes de esa fecha orientativa; su rellenado automático; la aprobación de documentos; y la ficha mínima de cada uno de los 76 tipos de documento con que el experto acredita las obligaciones (qué campos debe tener según el artículo que cita), sin la cual no se puede aprobar ningún documento de ese tipo. Autorizar también su incorporación a la versión principal, que lo publica.

### MOI-177 · RIA · Clasificar de verdad los sistemas de Garrigues y ARGA Assist antes del 2-12-2026

Etiquetas: GOS · RIA, GOS · AIMS · Asignado: Moisés · Prioridad: Urgent

## Para entenderlo sin ser técnico

**Qué problema hay.** Hay 14 sistemas de IA, 8 de ARGA y 6 de Garrigues, sin cuestionario de clasificación. Ninguna de las 8 evaluaciones está congelada ni revisada, y la de Harvey se midió con el catálogo del proveedor de alto riesgo, que no le corresponde.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues y a ARGA: el 2-12-2026 empiezan a aplicarse el art. 5.1 b bis) y b ter) y el 50.2, y sin clasificación los indicadores dicen «no medido». Antes tienen que estar MOI-173, MOI-176 y MOI-182, cuyo dictamen hace falta para clasificar la herramienta de IA propia de Garrigues. Bloquea MOI-217, que reclasifica los otros siete sistemas de ARGA.

**Qué resultado buscamos.** Antes del 2-12-2026, con el cuestionario v2: 12 de los 14 sistemas cribados; cuestionario de la herramienta propia, Copilot, Harvey y ARGA Assist, contrastado con Harvey (lote H-04), congelado por una persona y revisado por otra; y Harvey reevaluado con el catálogo del responsable del despliegue, sin borrar la previa. ARGA Assist lo contesta demo@ de ARGA y lo revisa la cuenta de cumplimiento; si el 27-11 falta esta (MOI-153) o su designación en el CATIT (MOI-170), queda propuesto, con aviso, y la revisión pasa a MOI-217.

**Cómo sabremos que está resuelto.** Antes del 2-12-2026, producción tiene esos cuestionarios completados y revisados por alguien distinto de quien los congeló, ningún sistema con dos clasificaciones vigentes, y repetir la carga no cambia nada. Nivel exigido: probado, publicado y aceptado.

**Qué te toca a ti.** Designar a la persona responsable de cumplimiento de Garrigues, que hoy no consta, y a una segunda que revise lo que ella congele. Decidir cómo contesta ella:
- a) El agente prepara una carga con cada respuesta y su fuente (la ficha del sistema y las hipótesis del programa, basadas en decisiones que aceptaste el 20-09-2026); ella revisa cada una en la ficha y la confirma o cambia: sigue siendo quien contesta.
- b) Contesta por pantalla sin carga: nadie le propone nada, pero tarda más y falta la fuente de cada respuesta que pide el programa.
Recomendación: a) (criterio técnico del agente): es la carga que prevé la tarea F11.T1 y llega mejor al 2-12-2026; si pesa más que nadie le proponga respuestas, b). Si no decides, a). Además: crear la cuenta de cumplimiento de ARGA (MOI-153) antes del 27-11; autorizar, tras el ensayo, lo que se escriba en producción, filas nuevas de ARGA incluidas, y la incorporación a la versión principal; y aceptar el resultado.

### MOI-178 · Comité de IA · Fijar la posición del despacho sobre el secreto profesional ante la autoridad

Etiquetas: GOS · RIA, GOS · Comités · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** El RIA obliga a cooperar con la autoridad y a darle acceso a registros, documentación y, previa solicitud motivada, al código (arts. 21, 26.12 y 74), sin excepción expresa para el secreto profesional. Garrigues es responsable del despliegue de Harvey y de Copilot y proveedor de su herramienta de IA propia, y esos registros pueden contener información de clientes. Nadie ha fijado la posición del despacho, ni siquiera qué órgano debe fijarla.

**A quién afecta y qué pasa si no se hace.** Afecta a Garrigues; a ARGA no, porque nace del secreto del abogado frente a sus clientes. No bloquea ni espera a ninguna tarea: el órgano puede decidir ya. Lo que espera es registrar el dictamen, que necesita la pieza de Secretaría que construye MOI-175 (relacionado). También se relaciona con MOI-212, cuyo registro de requerimientos, sin posición, solo dirá «posición pendiente del Comité», y con MOI-169: el lote H-16 de Harvey, material de partida, lo envía este issue con la herramienta de MOI-169.

**Qué resultado buscamos.** Una posición aprobada y registrada en Secretaría como dictamen: si el despacho puede limitar o condicionar el acceso y con qué base, quién evalúa cada requerimiento y en qué plazo, y qué se documenta. Fechas propuestas por el programa RIA, a confirmar por el Comité: H-16 enviado antes del 30-11-2026 y posición aprobada antes del 18-12-2026.

**Cómo sabremos que está resuelto.** El dictamen consta en Secretaría y el registro del programa RIA marca este punto como resuelto. Nivel exigido: aceptado.

**Qué te toca a ti.** No decides tú: decide el Comité de Gobernanza de la IA de Garrigues, o el órgano al que lo reencamine, con el contraste del equipo legal. Te toca llevarle antes la pregunta previa, quién fija la posición, y trasladar su respuesta aquí. Opciones que tiene delante:
- a) la fija el Comité de IA con un dictamen y decide el Senior Partner;
- b) es materia deontológica: decide el Senior Partner, con informe previo del Comité de Práctica Profesional (art. 43.1 del Código Ético);
- c) se sigue el circuito de la PI-30, su política de uso de la IA.
No hay base para recomendar: la fuente no recomienda ninguna y es criterio del órgano. Después autorizarás, tras ver su ensayo, que el agente registre el dictamen en la base de datos de producción, y la incorporación a la versión principal si el cambio llega a ella. Mientras tanto, cada requerimiento se analiza caso por caso fuera de la herramienta.

### MOI-179 · Comité Legal · Fijar desde cuándo se aplica la sección 5 del capítulo III del RIA

Etiquetas: GOS · RIA, GOS · Comités · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** De los nueve puntos del Reglamento Ómnibus que se cotejaron en el texto oficial el 19-09-2026, ocho quedaron verificados y uno sigue pendiente de criterio jurídico: desde cuándo se aplica la sección 5 del capítulo III del RIA (arts. 40 a 49: evaluación de la conformidad, declaración UE, marcado CE y registro). La letra c) del art. 113, que aplaza el alto riesgo, no la menciona, así que formalmente se aplica desde la fecha general, el 2-8-2026. Pero sus obligaciones solo se activan sobre sistemas clasificados como de alto riesgo, y esa clasificación sí está aplazada.

**A quién afecta y qué pasa si no se hace.** Afecta a AIMS en ARGA y en Garrigues. Mientras no haya criterio, el cálculo de exigibilidad que prepara la fase F3 del programa RIA (MOI-171) no puede fijar desde cuándo son exigibles los arts. 43, 47, 48 y 49, y los trata como latentes. No bloquea ni espera a ninguna tarea, y la fuente no le pone fecha límite. Está relacionado con MOI-169: el lote H-08 de Harvey, material de apoyo, lo envía este issue con la herramienta de MOI-169.

**Qué resultado buscamos.** Una decisión fechada del Comité Legal, o el punto verificado, anotada por el agente en el documento de verificación del Ómnibus.

**Cómo sabremos que está resuelto.** El documento de verificación del Ómnibus deja este punto como verificado o con la decisión fechada del Comité Legal, y ya no figura como pendiente. Nivel exigido: aceptado.

**Qué te toca a ti.** No decides tú: decide el Comité Legal, porque el programa RIA le reserva este punto: el documento de verificación lo deja pendiente de su criterio. Te toca llevarle la pregunta, con la respuesta de Harvey cuando llegue, y trasladar su decisión a este issue. Si la anotación del agente se incorpora a la versión principal, autorizarás esa incorporación en un comentario. Opciones que tiene delante:
- a) se aplica desde la fecha general, pero solo se activa con la clasificación aplazada, así que queda latente; es la lectura provisional del programa RIA;
- b) sigue las fechas de la letra c) del art. 113: 2-12-2027 para los sistemas del anexo III y 2-8-2028 para los del anexo I.
No hay base para recomendar: la fuente solo anota a) como lectura provisional y la pregunta es jurídica. Mientras tanto se trata como latente.

### MOI-182 · Comité de IA · Procedimiento de «cambio significativo» y acuerdo intragrupo de la herramienta de IA propia

Etiquetas: GOS · RIA, GOS · Comités · Asignado: Moisés · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Hay dos puntos abiertos. Primero: falta fijar cómo se decide si un sistema en servicio antes del régimen de alto riesgo sufrió un «cambio significativo» (art. 111.2 del RIA). De ello depende que el alto riesgo de ARGA Score y de otros sistemas «Alto» anteriores al 2-12-2027 siga latente o se active. El considerando 177 lo equipara a la modificación sustancial; Harvey dijo lo contrario. Segundo: la matriz de Garrigues es la proveedora de su herramienta de IA propia y NewLaw la desarrolla por encargo, sin acuerdo intragrupo que lo documente. En ARGA pasa lo mismo con ARGA Digital.

**A quién afecta y qué pasa si no se hace.** En Garrigues y en ARGA, sin el primero, el cuestionario no admite contestar que hubo cambio significativo; sin el segundo, la herramienta propia se clasifica con una hipótesis. Bloquea MOI-177. Los comités pueden decidir ya; registrar sus dictámenes espera a MOI-175 (relacionado), cuya ventana orientativa acaba el 14-11-2026.

**Qué resultado buscamos.** Dictámenes de Garrigues y de ARGA sobre los dos puntos, registrados en Secretaría. Fecha propuesta por el programa, que confirman los comités: 13-11-2026.

**Cómo sabremos que está resuelto.** Los dictámenes constan en Secretaría y el registro del programa los da por resueltos. Nivel exigido: aceptado.

**Qué te toca a ti.** Deciden el Comité de IA de Garrigues y el CATIT de ARGA, no tú: les llevas los dos puntos y traes aquí sus respuestas. Sobre el cambio significativo:
- a) seguir el considerando 177;
- b) tratarlos como distintos, como dijo Harvey, justificándolo.
Sobre el acuerdo, los comités informan y deciden si existe o existirá y su contenido mínimo; lo suscriben las sociedades (la matriz y NewLaw; en ARGA, ARGA Digital y las que los ponen en servicio, si procede) por sus órganos de administración o apoderados; la fuente no concreta qué persona firma:
- a) formalizarlo con la lista de contenido mínimo del registro del programa;
- b) dejar el reparto como hipótesis, porque el art. 25.4 solo obliga en alto riesgo;
- c) si una sociedad comercializa la herramienta, esa es la proveedora.
Recomendación: a) en los dos: en el primero, por motivo jurídico (criterio del legislador); en el segundo, porque lo recomienda Harvey y documenta el reparto. Después autorizarás, tras ver su ensayo, registrar los dictámenes en producción y, si la hay, la incorporación a la versión principal. Mientras, ARGA Score figura latente con aviso y la herramienta propia, como hipótesis.

### MOI-212 · RIA · Resto de la fase F6 antes del 18-12-2026: pantallas, cuadro de mando, reapertura, art. 4 por sistema y requerimientos

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** La fase F6 del programa RIA tiene dos partes. La rápida, prevista del 14 al 27-11-2026 en el calendario orientativo del programa, va en MOI-176 y crea el registro de obligaciones. El resto no ha empezado y es lo que hace ese registro utilizable: las pantallas de obligaciones y documentos exigidos, el cuadro de mando por fases, la reapertura de una clasificación cuando cambia algo del sistema, las acciones que nacen al congelar una evaluación, la alfabetización en IA del art. 4 en cada sistema, el sistema de gestión de la calidad (arts. 16 y 17) y el registro de requerimientos de la autoridad.

**A quién afecta y qué pasa si no se hace.** Afecta a quien gestione el cumplimiento del RIA en ARGA y en Garrigues: sin estas piezas el registro existe, pero no se puede consultar, filtrar ni exportar, y nadie sabe qué clasificación hay que revisar. Antes tiene que estar MOI-176, que a su vez espera a MOI-175, del que salen piezas que usan tres de estas tareas. Bloquea MOI-180.

**Qué resultado buscamos.** Las siete tareas (F6.T6, T7 y T9 a T13) terminadas hasta el 18-12-2026, fecha orientativa del calendario del programa, no regulatoria. Donde falte un criterio, la pantalla lo dice y no decide: el registro de requerimientos avisará de que la posición del despacho está pendiente mientras no se resuelva MOI-178, y un «cambio significativo» solo reabrirá una clasificación con el dictamen que prepara MOI-182.

**Cómo sabremos que está resuelto.** El registro del programa marca estas tareas como hechas, con sus pruebas automáticas en verde; los tres cambios de base de datos constan en producción; y cualquiera puede ver en la versión publicada, en los dos entornos, la pestaña de obligaciones con su exportación y el cuadro de mando. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario, cuando el agente te enseñe su ensayo, tres cambios de base de datos: la cadencia de revisión (cada cuánto fija el órgano que se revise la clasificación de un sistema; al vencer, queda «a revisar»), la creación de acciones al congelar una evaluación y la designación de personas por sistema. También autorizarás la incorporación a la versión principal, con la lista de pantallas de ARGA que cambian. Los criterios de fondo no son tuyos: dependen de MOI-178 y MOI-182.

### MOI-213 · RIA · Fase F7 del programa entre el 30-11 y el 18-12-2026

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** La fase F7 del programa RIA corrige los catálogos de medidas contra los que AIMS evalúa cada sistema, y no ha empezado. Falta el catálogo del responsable del despliegue de un sistema de alto riesgo; faltan las cláusulas que el RIA reserva a las entidades financieras, como las aseguradoras de ARGA; falta recoger el art. 4 bis, que permite tratar datos especialmente protegidos para corregir sesgos y rige desde el 27-7-2026; y Harvey no ha revisado esos catálogos ni dos dudas que tocan a los dos entornos: si la revisión editorial de un abogado exime de avisar de que un texto lo generó la IA, y si el régimen de incidentes de DORA o de Solvencia II (la normativa europea de supervisión de las aseguradoras) equivale al del RIA (lote H-06).

**A quién afecta y qué pasa si no se hace.** Afecta sobre todo a ARGA, cuyas aseguradoras se evaluarían sin las cláusulas financieras, y a quien use un sistema de alto riesgo sin ser su proveedor: hoy se le mide con el catálogo del proveedor, y la pantalla lo avisa. Antes tiene que estar MOI-176, porque F7 parte del catálogo del proveedor que construye esa tarea. No bloquea ningún otro issue.

**Qué resultado buscamos.** Entre el 30-11 y el 18-12-2026, según el calendario orientativo del programa: el lote H-06 enviado por el agente de esta tarea, con la herramienta que prepara MOI-169, y archivado; el catálogo nuevo, con el rótulo de cobertura provisional hasta que el Comité de IA lo valide en MOI-183; las cláusulas financieras y el art. 4 bis incorporados; y la versión 1.1 del catálogo publicada, con el registro de obligaciones de los dos entornos puesto al día.

**Cómo sabremos que está resuelto.** El registro del programa marca F7 como hecha, con sus pruebas en verde; una prueba automática muestra que una aseguradora de ARGA recibe las cláusulas financieras y una sociedad de Garrigues no; y la versión 1.1 consta en la base de datos de producción. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario, cuando el agente te enseñe su ensayo, el cambio de base de datos que publica la versión 1.1 y la puesta al día que escribe en el registro de ARGA y de Garrigues; antes recibirás la lista de lo que cambia en ARGA. También autorizarás la incorporación a la versión principal. Validar el catálogo nuevo corresponde al Comité de IA, en MOI-183.

### MOI-217 · RIA · Reclasificar los otros siete sistemas de IA de ARGA con el cuestionario v2 (tarea F11.T3, calendario orientativo del 16 al 27-11-2026)

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: High

## Para entenderlo sin ser técnico

**Qué problema hay.** Los ocho sistemas de IA de ARGA muestran el nivel de riesgo escrito a mano en su ficha (seis «Alto», uno «Limitado» y uno «Mínimo»). Medido el 24-09-2026, ninguno tiene cuestionario de clasificación ni persona de ARGA que responda de él, que el cuestionario v2 exige. ARGA Assist se clasifica en MOI-177, que hace el cribado previo de los ocho (comprobar que cada uno es un sistema de IA); aquí van los otros siete, sin repetir nada de eso.

**A quién afecta y qué pasa si no se hace.** Sin ella, siete sistemas de ARGA seguirían sin clasificar ni revisar a cuatro ojos. Antes tienen que estar MOI-173 (cuestionario v2), MOI-177, MOI-153 (cuenta de cumplimiento de ARGA) y MOI-170, que nombra esa cuenta en el CATIT; si se retrasan, esta tarea espera, porque el plan B de la especificación solo cubre a ARGA Assist. El calendario orientativo, no regulatorio, da a esta tarea y a MOI-177 la misma ventana, del 16 al 27-11-2026, pero en la práctica esta empieza cuando MOI-177 tenga la carga y el cribado. No bloquea ninguna tarea.

**Qué resultado buscamos.** Los otros siete con cuestionario congelado por la cuenta demo@ de ARGA y revisado por la de cumplimiento, más la revisión de ARGA Assist solo si MOI-177 la deja pendiente; ninguno con dos clasificaciones vigentes; el nivel anterior guardado; el resultado contrastado con Harvey (lote H-04) antes de revisar; cada fila de ARGA que cambie, anotada con su antes y su después en el registro del programa; y las pruebas automáticas de pantalla de ARGA reescritas para no depender del nivel.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra los siete cuestionarios, y el de ARGA Assist si se revisó aquí, revisados por una cuenta distinta de la que congeló, y el nivel anterior de cada sistema; repetir la carga no cambia nada; la lista de filas de ARGA coincide con lo autorizado; y las pruebas reescritas pasan en los dos entornos. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Esta tarea cambia el dato de ARGA: pueden variar los niveles y aparecer obligaciones nuevas. Autorizar, en un comentario y tras ver el ensayo y la respuesta de Harvey, que la carga escriba en la base de datos de producción, incluida la persona que responde de cada sistema, que propondrá el agente. Autorizar la incorporación a la versión principal de las respuestas y las pruebas. Si Harvey discrepa en algún sistema, llevar la pregunta al equipo legal. La cuenta de cumplimiento la creas en MOI-153.

## M4 · Resto del programa RIA, criterios jurídicos pendientes y deuda conocida

### MOI-180 · RIA · Fases de 2027 del programa (F8 a F10 y el resto de F11)

Etiquetas: GOS · RIA, GOS · AIMS, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Del programa RIA no han empezado las fases F8, F9 y F10 ni las tareas F11.T4 a F11.T7; las dos primeras de F11, clasificar los sistemas con fecha del 2-12 y reevaluar Harvey, van en MOI-177, y la tercera, reclasificar los sistemas de ARGA, en MOI-217, relacionada. Aquí están la evaluación de impacto en los derechos fundamentales del art. 27, los plazos de incidentes según el papel de cada sociedad, la vigilancia con umbrales, el expediente técnico por versión, los casos que solo se activan en supuestos concretos (proveedor de un modelo, importador, distribuidor, autoridad pública), el simulacro de incidente de ARGA Score y la verificación final. Varias tareas vuelven a abrir tablas sin uso, que hoy ninguna pantalla escribe. Las piezas de F8 que enlazan cada riesgo de GRC con su sistema, incluidos los riesgos de ARGA, van en MOI-164.

**A quién afecta y qué pasa si no se hace.** Afecta a AIMS y GRC en ARGA y en Garrigues. Sin estas fases siguen abiertos la evaluación del art. 27, los plazos de incidentes por papel, la vigilancia con umbral y el expediente por versión. Antes tienen que estar hechas MOI-175 (fase F5), MOI-212 (resto de F6) y MOI-164, que crea la pieza de F8 de la que depende el editor de riesgos de esta tarea. Bloquea MOI-181.

**Qué resultado buscamos.** Cada fase terminada y marcada como hecha en el registro del programa. Calendario orientativo de la especificación: F8 del 11-01 al 12-02-2027, F9 del 15-02 al 26-03-2027 y F10 del 29-03 al 16-04-2027; el resto de F11, escalonado.

**Cómo sabremos que está resuelto.** El registro del programa marca cada fase como hecha, con sus pruebas en verde: la de cambios de base de datos, la de aislamiento entre entornos y la sonda con acceso real. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, cada cambio de base de datos de producción después de ver su ensayo: hay siete previstos entre F8 y F9. También autorizarás, después de ver su ensayo, los cambios declarados en el dato de ARGA (por ejemplo, el simulacro de incidente de ARGA Score), y cada incorporación a la versión principal. El enlace de los riesgos de ARGA con sus sistemas lo autorizas en MOI-164, y la reclasificación de sus sistemas, en MOI-217. La reapertura de tablas la aceptaste el 20-09-2026 con condiciones que el agente no puede saltarse: corregir cada tabla antes de reabrirla y que la única fila de ARGA afectada, su plan de vigilancia poscomercialización, solo se pueda leer.

### MOI-181 · RIA · Cerrar las deudas técnicas anotadas en el registro del programa

Etiquetas: GOS · RIA, GOS · AIMS · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** El registro del programa RIA anota siete deudas técnicas: el indicador de vigilancia puede marcar «OK» sin compararlo con su umbral; una sección cerrada del expediente técnico no está protegida en el servidor; al devolver una sección a trabajo queda una fecha de revisión huérfana; falta el resumen de cumplimiento en la ficha de cada sistema; las 61 comprobaciones antiguas no están enlazadas a su evaluación; no se guarda la versión del catálogo con cada respuesta; y el lote H-11 de Harvey debe incluir unas correcciones literales.

**A quién afecta y qué pasa si no se hace.** Afecta a quien use AIMS en ARGA y en Garrigues. Hoy no alteran ningún dato: son marcas en pantalla sin apoyo en el dato o casos que aún no se dan. Si no se cierran, aflorarán al avanzar el programa. Antes tienen que estar hechas MOI-170 y MOI-180. No bloquea ninguna tarea.

**Qué resultado buscamos.** Cada deuda cerrada y vigilada por una prueba automática. Este issue arregla las tres que no caen en otra tarea abierta: el resumen en la ficha de cada sistema, el enlace de las comprobaciones antiguas y las correcciones de H-11. Ese lote lo envía este issue con la herramienta de MOI-169. Las otras cuatro se cierran en su tarea (la versión del catálogo en MOI-170; el indicador y las dos del expediente técnico en MOI-180), y aquí se comprueba que quedaron cerradas.

**Cómo sabremos que está resuelto.** Cada deuda figura como hecha en el registro del programa, con una prueba que se pone en rojo si alguien retira la corrección. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar en un comentario, cuando el agente te lo pida, la incorporación de las correcciones a la versión principal, que las publica. Los cambios de base de datos que necesiten se autorizan en MOI-170 y MOI-180. Si enlazar las 61 comprobaciones antiguas exigiera escribir en filas ya existentes de ARGA o de Garrigues, el agente no lo hará: te lo planteará aquí para que decidas.

### MOI-183 · Comité de IA · Definir el catálogo del responsable del despliegue de un sistema de alto riesgo

Etiquetas: GOS · AIMS, GOS · Comités · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** AIMS no tiene catálogo de medidas para el responsable del despliegue de un sistema de alto riesgo: quien usa bajo su autoridad un sistema de alto riesgo, con deberes propios en los arts. 26 y 27 del RIA y en el RGPD. Cuando un sistema se clasifica así, AIMS lo mide contra las medidas del proveedor, que son deberes de otro, y la pantalla avisa de ello.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier grupo que use un sistema de alto riesgo sin ser su proveedor. Su evaluación mezclaría deberes del proveedor con los suyos y no mediría los propios. No bloquea ni espera a ninguna tarea. Está relacionado con MOI-213, donde la fase F7 del programa RIA prepara este catálogo, apoyado en el lote H-06 de Harvey y marcado como pendiente del Comité de IA.

**Qué resultado buscamos.** Un dictamen del Comité de IA con la lista de medidas de este perfil, cada una con su norma y su carácter (obligación o marco operativo), y AIMS aplicando ese catálogo a los sistemas clasificados así.

**Cómo sabremos que está resuelto.** El dictamen consta en este issue y una prueba automática comprueba que un sistema de alto riesgo en el que el grupo es responsable del despliegue se mide con ese catálogo y no con el del proveedor. Nivel exigido: aceptado, probado y publicado.

**Qué te toca a ti.** No decides tú: decide el Comité de IA de Garrigues. Propuesta del agente, igual que en MOI-167: su dictamen fija el catálogo para el producto y el CATIT decide si lo adopta para ARGA; mientras no lo haga, en ARGA el catálogo sigue marcado con cobertura provisional. Te toca convocar la sesión de modelo con el Comité, el equipo legal y el experto (ninguna tarea la ha convocado aún), llevar allí la petición y trasladar el dictamen a este issue y al CATIT. Al final autorizarás en un comentario la incorporación del catálogo a la versión principal. Opciones que tienen delante:
- a) un catálogo propio para este perfil;
- b) seguir con las medidas del proveedor y el aviso.
Recomendación: a), la que propone la fuente para la sesión de modelo, porque mide los deberes propios del perfil y no los del proveedor. Mientras tanto se mide de más y se dice, que es la postura conservadora.

### MOI-184 · AIMS · Decidir qué hacer con los títulos de requisitos guardados con la numeración antigua

Etiquetas: GOS · AIMS, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Cada comprobación de una evaluación de IA guarda el título que tenía el requisito el día en que se hizo, y el informe para el Consejo (Board Pack) lo muestra tal cual. En ARGA, seis comprobaciones de la norma ISO 42001 salen con la numeración antigua, desplazada: por ejemplo, «Política de IA (A.5)». En Garrigues, una comprobación de Harvey conserva un título anterior sobre transparencia. El catálogo corregido del programa RIA ya usa la numeración buena.

**A quién afecta y qué pasa si no se hace.** Afecta a quien lea el informe para el Consejo de ARGA: cita la ISO 42001 con una numeración que no coincide con el catálogo vigente. No bloquea ninguna tarea. Está relacionado con MOI-125, que lleva el trabajo RIA a la versión principal.

**Qué resultado buscamos.** Tu decisión registrada y aplicada: el informe deja de mostrar la numeración desplazada o avisa de ella, con una prueba automática que lo vigile.

**Cómo sabremos que está resuelto.** Tu decisión consta en un comentario y en el registro del programa RIA, y el informe de ARGA ya no muestra «Política de IA (A.5)» sin corregir ni avisar. Nivel exigido: aceptado, probado y publicado.

**Qué te toca a ti.** Decidir cómo se corrige. Te corresponde porque una de las opciones cambia dato de ARGA.
- a) Corregir el título al mostrarlo, a partir del código del catálogo vigente. No toca el dato y es lo más barato. Dos de las seis (Recursos de IA y Gestión de datos) no tienen requisito vigente equivalente, así que ahí el informe avisaría en vez de corregir. Necesita que el trabajo RIA esté en la versión principal (MOI-125), porque la tabla de equivalencias solo existe en su rama.
- b) Corregir el dato en la base de datos de producción, declarando las seis filas de ARGA. Necesita además que autorices ese cambio después de ver su ensayo. La fila de Garrigues quedaría igual, porque su dato no se pisa.
En los dos casos autorizarás la incorporación del arreglo a la versión principal. Recomendación: a), porque no toca dato de ningún entorno y cuesta menos; es criterio técnico del agente, y si pesa más que el dato quede limpio para cualquier otra pantalla, b). No hay estimación de esfuerzo de ninguna de las dos. Mientras decides, el informe sigue con la numeración antigua; propuesta: si no decides, se queda así.

### MOI-185 · AIMS · Decidir si el inventario de sistemas de IA exige grupo válido y estados del vocabulario

Etiquetas: GOS · AIMS, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** La base de datos no impide que un sistema del inventario de IA quede asignado a un grupo que no existe, ni que lleve un estado fuera del vocabulario del producto. Hoy los 14 sistemas pertenecen a grupos existentes, pero tres de los ocho de ARGA ya tienen estados escritos a mano («Conforme», «Pendiente» y «En revision»). El 14-09 aplazaste la regla de estados para no cambiar el dato de ARGA, y el programa RIA tampoco la añade.

**A quién afecta y qué pasa si no se hace.** Afecta al inventario de AIMS en los tres grupos. Solo la pantalla vigila hoy el vocabulario: una siembra o una escritura directa en la base de datos puede dejar un sistema sin grupo válido o con un estado libre. No depende de nada ni frena otras tareas. Está relacionado con MOI-161, que decide un vocabulario único de estados para AIMS, GRC y Secretaría: una regla de estados en la base de datos tendría que usar ese vocabulario. El borrado de sistemas de IA se decide aparte, en MOI-210.

**Qué resultado buscamos.** Tu decisión registrada y, si eliges alguna regla, el cambio de base de datos ensayado y aplicado con tu autorización.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con la decisión; si se aplica algo, una consulta de solo lectura muestra la regla elegida, una sonda que se deshace comprueba que se rechaza un grupo inexistente y ARGA conserva sus 8 sistemas y, salvo la normalización que autorices, sus estados.

**Qué te toca a ti.** Decidir qué reglas se ponen. Te toca porque es una decisión de producto y una de las opciones cambia dato de ARGA.
- a) Exigir solo que el grupo exista: lo cumplen los 14 sistemas y no cambia ningún dato.
- b) Exigir también estados del vocabulario: antes hay que corregir las tres grafías de ARGA, un cambio de su dato que autorizarías expresamente.
- c) Seguir aplazándolo, como decidiste el 14-09.
Recomendación: a) ahora, porque no cambia nada y cierra la puerta al grupo inexistente, y b) cuando decidas qué hacer con los estados de ARGA (criterio técnico del agente). Si para ti pesa más no tocar la base de datos, c). Mientras decides, el vocabulario solo lo garantiza la pantalla; propuesta: si no decides, todo sigue como está. No falta ningún dato para decidir. Después, autoriza en un comentario aplicar el cambio cuando el agente te enseñe el ensayo, y que el cambio guardado se incorpore a la versión principal.

### MOI-186 · AIMS · Cerrar dos cabos pendientes: las tablas sin uso y el «documento de continuidad de AIMS» que falta

Etiquetas: GOS · AIMS, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Quedan dos cabos de la reorganización de AIMS de septiembre. Primero: de las 26 tablas de AIMS en la base de datos, solo en 6 se puede escribir desde la aplicación. El 20-09 aceptaste reabrir 8 dentro del programa RIA, pero quedan 12 sin destino decidido, y tres de ellas guardan 10 filas de ARGA (la 11.ª está en una de las 8 reabiertas). Segundo: una valoración del 08-09 cita un «documento de continuidad de AIMS», con un orden de fases y un indicador doble, que no está en el repositorio.

**A quién afecta y qué pasa si no se hace.** Afecta al orden de la base de datos y a la planificación de AIMS. Borrar esas tablas en bloque, como proponía la valoración, perdería 11 filas de ARGA y rompería la regla de no tocar su dato. Sin el documento, sus fases (C4, C1, M1 y M2, que no son los hitos de este proyecto) no se pueden planificar, y no se sabe si el programa RIA las sustituye. No depende de nada ni frena otras tareas.

**Qué resultado buscamos.** Tus dos decisiones anotadas en el registro de la reorganización de AIMS (el documento donde ese trabajo apunta sus decisiones y deudas), con las 11 filas de ARGA intactas.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con las dos decisiones, el registro las recoge en sus dos filas pendientes y una consulta de solo lectura muestra que las 11 filas de ARGA siguen ahí.

**Qué te toca a ti.** Te toca porque son decisiones de alcance y una toca dato de ARGA.
Las 12 tablas sin destino:
- a) Conservarlas en solo lectura: no cuesta nada y protege el dato de ARGA.
- b) Borrar solo las vacías, una a una, cada una con su cambio de base de datos y tu autorización.
- c) Borrarlas en bloque: descartado, porque borra dato de ARGA.
Recomendación: a), porque protege el dato de ARGA sin coste (criterio técnico del agente). Mientras decides, siguen legibles y la aplicación no puede escribir en ellas.
El documento de continuidad de AIMS:
- a) Aportarlo, si tienes una copia.
- b) Declararlo sustituido por el programa RIA del 19-09.
Recomendación: b) si no hay copia, porque el programa RIA ya cubre el catálogo de medidas y el indicador (criterio técnico del agente). Mientras decides, esas fases no se planifican. Propuesta: si no decides, las tablas siguen en solo lectura y el documento queda pendiente. Un borrado exigiría además tu autorización sobre la base de datos de producción tras ver el ensayo, y la anotación en el registro, tu autorización para incorporarla a la versión principal.

### MOI-187 · AIMS · Decidir si el equipo legal necesita editar las preguntas del cuestionario sin publicar una versión nueva

Etiquetas: GOS · AIMS, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Las preguntas del cuestionario guiado que clasifica los sistemas de IA, su ayuda y sus reglas están escritas dentro del programa, con número de versión. Cada cuestionario contestado guarda la versión con la que se hizo, así que los antiguos siguen siendo legibles. Pero para cambiar una sola frase hay que modificar el programa y publicarlo: no hay un editor en pantalla con permisos por rol. Hoy hay textos de ayuda del programa RIA pendientes de revisión del equipo legal.

**A quién afecta y qué pasa si no se hace.** Afecta al equipo legal, que depende de un programador para cada cambio de texto, y a quien tenga que hacerlo. No es urgente: no depende de nada ni frena otras tareas. Mientras tanto, el equipo legal manda el texto y un agente lo incorpora como versión nueva del cuestionario.

**Qué resultado buscamos.** Tu decisión registrada: o se cierra el pendiente sin editor, o se encarga un plan de editor para más adelante, sin fecha fijada.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con la decisión y el registro de la reorganización de AIMS la anota en su fila pendiente; si eliges el editor, además existe su plan en el repositorio.

**Qué te toca a ti.** Decidir si hace falta el editor. Te toca porque es una decisión de producto.
- a) No hacer editor: los cambios siguen pasando por el programa, con rastro completo en git y una versión nueva del cuestionario cada vez. Sin coste ahora.
- b) Encargar un editor con permisos por rol para más adelante: el equipo legal gana autonomía, pero se abre una vía de escritura nueva que hay que proteger y probar.
Recomendación: a) mientras haya pocos cambios, porque un editor abre una superficie de escritura nueva (criterio técnico del agente). Si para ti pesa más la autonomía del equipo legal, b). Propuesta: si no decides, se sigue como hasta ahora. Para decidir no falta ningún dato, salvo que no está estimado cuántos cambios de texto habrá. Después, autoriza que la anotación o el plan se incorporen a la versión principal.

### MOI-188 · Base de datos · Decidir qué hacer con tres restos sin dueño

Etiquetas: GOS · Plataforma, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** La base de datos de producción guarda tres restos sin uso: dos ficheros de una sonda del 07-09 en el almacén de justificantes de AIMS (uno de ARGA y otro de Garrigues), que la aplicación no puede borrar; un expediente del canal interno de información de un grupo inexistente, que nadie ve; y una cuenta de acceso creada por autoalta antes de cerrar el registro público, sin perfil en el producto y con un correo real ajeno a la demostración.

**A quién afecta y qué pasa si no se hace.** Con el primer justificante real de AIMS, el almacén mezclará restos y justificantes. El expediente sin grupo ensucia los recuentos del canal. La cuenta no puede entrar, pero el proyecto retiene un dato personal ajeno. No depende de nada ni frena otras tareas.

**Qué resultado buscamos.** Tus tres decisiones registradas y, si eliges borrar, los restos retirados sin tocar nada más.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con las tres decisiones y una consulta de solo lectura muestra que no queda ninguno de los tres, o cada resto conservado queda declarado con su motivo.

**Qué te toca a ti.** Te toca porque son borrados de datos o ficheros, que solo tú autorizas.
Ficheros de sonda:
- a) Borrarlos con un acceso de administración, cambiando antes la sonda, que los recrea en cada ejecución de las pruebas.
- b) Dejarlos declarados: están en una carpeta de sonda y ninguna pantalla los muestra.
Recomendación: b), porque borrarlos no dura mientras la sonda los recree (criterio técnico del agente; la fuente proponía a) sin saberlo).
Expediente sin grupo:
- a) Borrarlo con un cambio de base de datos limitado a ese expediente, sin permitir borrar desde la aplicación.
- b) Conservarlo como histórico, declarado en una prueba automática, como decidió el cambio del 07-09: es el único rastro de la siembra original.
Recomendación: b), porque no escribe en producción (criterio técnico del agente).
Cuenta sin perfil:
- a) Borrarla tú desde el panel de la base de datos: deja de retenerse un dato personal ajeno.
- b) Conservarla inerte: sin riesgo operativo, pero con el dato retenido.
Recomendación: a), por minimización de datos (motivo jurídico; criterio del agente).
Mientras decides, nada afecta a las pantallas; propuesta: si no decides, todo sigue igual. Si eliges borrar los ficheros o el expediente, lo autorizas por escrito después de ver el ensayo, y lo preparado necesitará tu autorización para incorporarse a la versión principal.

### MOI-189 · GRC · Decidir cómo se ordena el dato de riesgos y obligaciones de ARGA que no casa con los módulos

Etiquetas: GOS · GRC, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** En GRC, el dato de ARGA tiene dos desajustes. Primero: 122 de sus 167 riesgos están asignados a módulos (cumplimiento, fraude, solvencia, penal…) que no figuran en su lista de módulos, y la base de datos no lo impide. Segundo: la base de datos mantiene sola una copia de las obligaciones para ordenarlas por módulos de GRC; de sus 14 filas de ARGA, 8 no corresponden a ninguna obligación: se sembraron a mano y nadie las actualiza.

**A quién afecta y qué pasa si no se hace.** Afecta a GRC de ARGA. Conviven dos listas de módulos: la pantalla de alta marca esos riesgos como «no declarado para este grupo», y añadir módulos, como el de IA el 20-09, amplía una lista que no gobierna la mayoría de los riesgos. Quien lea la copia como reflejo fiel se equivoca en 8 filas. No bloquea ni espera a otras tareas; la prueba que cuenta esas 8 filas y su análisis llegan a la versión principal con la rama del programa RIA (MOI-125).

**Qué resultado buscamos.** Tus dos decisiones registradas, con la persona que se encarga de conciliar los módulos, y aplicadas sin cambiar el dato de ARGA salvo que lo autorices expresamente.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con las dos decisiones, anotadas en el registro del cierre de huecos del 05-09; una prueba automática vigila que los riesgos sin módulo y las 8 filas estén declarados, o una consulta muestra que no queda ninguno.

**Qué te toca a ti.** Te toca porque es dato de ARGA, que no cambia sin tu autorización. También designas a quien concilia sus módulos de GRC.
Módulos de los riesgos:
- a) Añadir a la lista de ARGA los módulos que faltan: cambia el menú de ARGA.
- b) Una tabla de equivalencias en el programa, sin tocar la base de datos: ARGA no cambia, pero siguen dos vocabularios.
- c) Reclasificar los 122 riesgos: cambia dato de ARGA y exige criterio.
Recomendación: b) como paso inmediato, porque ARGA no cambia (criterio técnico del agente). Antes, el agente te propone el mapa, aún inexistente.
Filas sin obligación:
- a) Declararlas históricas, con una prueba que vigile que no aumentan: ARGA no cambia.
- b) Crear sus obligaciones de origen: cambia la pantalla de obligaciones de ARGA.
- c) Borrarlas: se pierde dato y va contra la regla de conservarlo.
Recomendación: a), porque ARGA no cambia (criterio técnico del agente).
Mientras decides, todo sigue así. Lo que escriba en la base de datos lo autorizas aparte tras el ensayo, y lo preparado, su incorporación a la versión principal.

### MOI-190 · GRC · Hacer únicos dentro de cada grupo los códigos de riesgos y hallazgos

Etiquetas: GOS · GRC, GOS · Ventana · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** En GRC, los códigos de riesgos y de hallazgos no están bien protegidos contra repeticiones. El código de un hallazgo no puede repetirse en toda la base de datos, aunque sea de otro grupo. El código de un riesgo puede repetirse sin límite, incluso dentro del mismo grupo. Obligaciones, controles y políticas ya exigen un código único dentro de cada grupo.

**A quién afecta y qué pasa si no se hace.** Afecta a la siembra progresiva de Garrigues y a cualquier grupo nuevo. Si un grupo siembra un hallazgo con el mismo código que uno de ARGA, la carga falla. Si una carga de riesgos se ejecuta dos veces, duplica los riesgos sin avisar, y la orden vigente desde el 07-09-2026, que manda sembrar Garrigues de forma progresiva y conservar lo sembrado, trata eso como un defecto. No depende de nada ni frena otras tareas.

**Qué resultado buscamos.** Que riesgos y hallazgos exijan un código único dentro de cada grupo, y que dos grupos distintos puedan usar el mismo código.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura muestra la regla de código único por grupo en riesgos y en hallazgos, ya no existe la regla global de hallazgos y el cambio de base de datos está guardado en el repositorio. Las cargas de Garrigues se pueden repetir sin duplicar ni fallar.

**Qué te toca a ti.** Autorizar en un comentario aplicar el cambio en la base de datos de producción cuando el agente te enseñe el ensayo y el recuento de códigos repetidos medido justo antes. Si ese recuento encuentra códigos repetidos en ARGA, el agente se para y te lo trae, porque arreglarlos cambiaría dato de ARGA y eso lo decides tú. Después, autorizar que el cambio guardado se incorpore a la versión principal.

### MOI-191 · GRC · Obtener del despacho su categoría ENS, si trabaja para el sector público y su participación en EAD Trust

Etiquetas: GOS · GRC, GOS · Comités · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Garrigues tiene sembradas obligaciones de ciberseguridad que citan el Esquema Nacional de Seguridad (ENS). Faltan tres respuestas que solo puede dar el despacho y que plantea el diseño de la fase G6 (ciberseguridad) del entorno Garrigues en su apartado 5, preguntas 3, 4 y 1: la categoría de su sistema en el ENS, si tiene declaración o certificación de conformidad y si hace la auditoría bienal del art. 31 del RD 311/2022; si presta servicios al sector público bajo contrato; y si se confirma su participación del 51,001 % en EAD Trust, que hoy figura «a confirmar».

**A quién afecta y qué pasa si no se hace.** Afecta a GRC de Garrigues. Si el despacho no trabaja para el sector público, el ENS es un marco voluntario y no una obligación legal, y las fichas presentarían como deber legal lo que es una decisión de gestión. Según ese mismo diseño, de la participación en EAD Trust depende que el grupo incluya una sociedad sujeta a las obligaciones reforzadas de la directiva europea de ciberseguridad. No depende de nada ni frena otras tareas.

**Qué resultado buscamos.** Las respuestas del despacho registradas y las fichas ajustadas: cada obligación del ENS dice si es obligación legal o marco voluntario, y la participación en EAD Trust queda confirmada o sigue «a confirmar» con su motivo.

**Cómo sabremos que está resuelto.** Las respuestas constan en un documento de la carpeta legal del repositorio y en un comentario, y las fichas muestran la naturaleza de cada obligación del ENS y la procedencia de la participación.

**Qué te toca a ti.** No decides tú: contesta la persona responsable de cumplimiento de Garrigues, que hoy no consta nombrada. Te toca designarla o, si no la designas, hacer llegar las tres preguntas al despacho por otra vía, y trasladar la respuesta a este issue. Mientras tanto, las fichas siguen como están. Después, autoriza que el ajuste se incorpore a la versión principal y, si hay que corregir dato ya sembrado en la base de datos de producción, que se aplique allí cuando veas el ensayo.

### MOI-192 · Pruebas · Decidir sobre dos pruebas automáticas que no miden lo que deberían

Etiquetas: GOS · Plataforma, GOS · Decisión · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Una sonda comprueba que Garrigues no tenga el módulo DORA; la prueba lo justifica con la decisión D-5 del diseño del entorno Garrigues del 03-08-2026, que deja DORA fuera del perfil de despacho, pero las instrucciones del repositorio la cuentan entre las comprobaciones heredadas de la orden, derogada el 07-09-2026, de no sembrar datos en Garrigues, y piden darle la vuelta. Y tres pruebas de plantillas nunca se ejecutan: según anotaron ellas mismas el 05-09, buscan un acceso de administración con un nombre distinto del configurado (no se ha vuelto a comprobar: el fichero de secretos no se lee). Figuran como pendientes.

**A quién afecta y qué pasa si no se hace.** Mientras código e instrucciones digan cosas distintas, quien active DORA para Garrigues no sabrá si el rojo señala un error o una comprobación derogada. Las pruebas de plantillas no vigilan que las plantillas vigentes de ARGA sigan en su recuento de referencia de mayo (su «línea base»). No depende de nada ni frena otras tareas.

**Qué resultado buscamos.** Tus dos decisiones registradas y aplicadas: código e instrucciones dicen lo mismo sobre DORA, y las tres pruebas se ejecutan o se retiran con motivo.

**Cómo sabremos que está resuelto.** Hay un comentario tuyo con las dos decisiones; la sonda de DORA pasa con los accesos de ARGA y Garrigues y coincide con las instrucciones; y las tres pruebas ya no figuran como pendientes.

**Qué te toca a ti.** Te toca porque decides qué vigila el producto.
DORA en Garrigues:
- a) Regla del producto: la prueba se queda, citando D-5, y se corrigen las instrucciones. Activar DORA para Garrigues exigiría cambiar la prueba a propósito.
- b) Resto de la orden antigua: la prueba solo vigila que la lista de módulos no se pierda ni se aparte de la base de datos; activar DORA dejaría de dar rojo.
Recomendación: a), porque la exclusión viene de una decisión de producto y no de la falta de dato (criterio técnico del agente).
Pruebas de plantillas:
- a) Reescribirlas como sondas de solo lectura con el acceso de demostración: vigilan sin riesgo.
- b) Retirarlas: menos ruido y menos vigilancia.
- c) Darles el acceso de administración: se ejecutan, pero contradice la regla de no usarlo contra producción.
Recomendación: a), porque vigilan sin riesgo (criterio técnico del agente).
Mientras decides, y si no decides (propuesta), todo sigue igual. Después, autoriza que el cambio se incorpore a la versión principal.

### MOI-193 · Consola · Dar a Garrigues sus ámbitos reales en el selector de alcance

Etiquetas: GOS · GRC, GOS · Ventana · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** El selector de ámbito de la consola, del inicio y de Secretaría sirve para acotar la vista, por ejemplo por país o jurisdicción. ARGA, que no tiene marca propia configurada, usa una lista fija de ámbitos escrita en el programa. Garrigues y el grupo nuevo sí tienen marca, pero ningún ámbito configurado, así que solo reciben un único ámbito «(Global)» y el selector no filtra nada. Las instrucciones del repositorio hablan de ocho ámbitos para Garrigues, pero esa lista no existe todavía.

**A quién afecta y qué pasa si no se hace.** Afecta a quien use el entorno de Garrigues, que no puede acotar la vista por país ni por jurisdicción. ARGA no se ve afectada: conserva su lista fija. No depende de nada ni frena otras tareas.

**Qué resultado buscamos.** Que el selector de Garrigues ofrezca sus ámbitos reales, sacados del catálogo comprobado de sus sociedades y sin inventar ninguno, y que ARGA quede idéntica. Qué filtra cada pantalla al elegir un ámbito no está medido; en AIMS ese filtro está desactivado a propósito.

**Cómo sabremos que está resuelto.** Una consulta de solo lectura devuelve la lista de ámbitos de Garrigues y, en la versión publicada, el selector de Garrigues la muestra mientras el de ARGA sigue igual.

**Qué te toca a ti.** Dos cosas, cuando el agente te las pida. Primero, validar la lista de ámbitos que proponga, si quieres con el equipo legal. Después, autorizar en un comentario escribirla en la base de datos de producción, solo en Garrigues, cuando el agente te enseñe el ensayo, y que el cambio guardado se incorpore a la versión principal.

### MOI-194 · Plataforma · Que la comprobación automática del código conozca la estructura real de la base de datos

Etiquetas: GOS · Plataforma · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** La conexión del programa con la base de datos no usa la descripción generada de sus tablas y columnas. Por eso la comprobación automática de tipos, que revisa el código antes de publicarlo, no detecta columnas mal escritas o que no existen: el error solo aparece cuando alguien usa la pantalla. Así estuvo el indicador de incidentes DORA de la consola, que contaba sobre una columna inexistente. El 06-09 se midió que activar esa comprobación daba 183 errores en 48 ficheros.

**A quién afecta y qué pasa si no se hace.** Afecta a quien programa y, al final, a quien usa las pantallas: los errores de este tipo llegan a producción sin aviso. Esta tarea espera a MOI-125, que incorpora el programa RIA a la versión principal y trae la descripción de tablas actualizada; medir antes sería medir contra una descripción vieja. No frena otras tareas.

**Qué resultado buscamos.** Que el programa compruebe cada consulta contra la estructura real de la base de datos y que esa comprobación termine sin errores.

**Cómo sabremos que está resuelto.** La conexión usa la descripción generada y la comprobación de tipos del proyecto, junto con el resto de pruebas automáticas, termina sin errores.

**Qué te toca a ti.** Nada que decidir: solo fijar su prioridad frente a las demás tareas de M4. Hoy es baja; si quieres adelantarla, súbela en el propio issue o dilo en un comentario. Como con cualquier cambio, cuando el agente termine te pedirá autorización para subir la rama a GitHub e incorporarla a la versión principal.

### MOI-195 · Secretaría · Que el asistente de certificaciones autónomas deje de pedir identificadores a mano

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** La pantalla de certificaciones autónomas de Secretaría (las que no nacen de un acta concreta, por ejemplo la de un cargo vigente) pide siete referencias (órgano, persona, cargo, libro, movimiento del libro de socios, acuerdo y decisión) en cajas de texto libre que invitan a escribir un identificador interno de la base de datos. Un secretario no conoce esos identificadores. El defecto se anotó el 06-07-2026 como pendiente de la revisión de experiencia de uso de Secretaría y sigue igual en la versión principal.

**A quién afecta y qué pasa si no se hace.** Afecta a quien prepare certificaciones en cualquiera de los tres entornos: sin copiar identificadores internos no puede usar esa pantalla. No depende de otros issues ni frena ninguno.

**Qué resultado buscamos.** Que cada referencia se elija en una lista con los órganos, personas, cargos vigentes, libros, movimientos, acuerdos y decisiones del propio grupo, y que al llegar desde un libro, una persona, el expediente de un acuerdo o un acta los campos vengan ya rellenos.

**Cómo sabremos que está resuelto.** La pantalla ya no muestra ninguna caja que pida un identificador, una prueba automática falla si vuelve a aparecer, y otra prueba automática de pantalla elige un acuerdo en la lista y prepara la certificación sin escribir en la base de datos de producción.

**Qué te toca a ti.** Nada para dejarlo probado: es una mejora de pantalla sin criterio jurídico. Solo te pedirán autorización, en un comentario, si la prueba tuviera que crear o emitir una certificación en la base de datos de producción, después de ver el ensayo, y para incorporar el cambio a la versión principal, que publica en producción.

### MOI-196 · Secretaría · Vincular cada informe preceptivo a su documento fuente y no a un texto libre

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** En la pantalla de informes preceptivos de Secretaría, cuando el informe no nace de un acuerdo, la referencia al documento fuente se escribe en un campo de texto libre. Lo que se escribe ahí se guarda como si fuera la huella del documento, y la tabla de informes lo enseña después en la columna «Huella». Cualquiera puede escribir un valor que no corresponde a ningún documento.

**A quién afecta y qué pasa si no se hace.** Afecta a quien consulte o use esos informes: la pantalla presenta como huella comprobable algo que nadie ha comprobado, y eso resta valor a las huellas verdaderas. Es un pendiente anotado el 06-07-2026 en la revisión de experiencia de uso de Secretaría. No depende de otros issues ni frena ninguno.

**Qué resultado buscamos.** Que el informe se vincule a un documento del propio grupo elegido en una lista y, cuando ese documento no exista en el sistema, que la referencia se guarde como «referencia declarada, sin huella» y nunca como huella.

**Cómo sabremos que está resuelto.** La pantalla ya no guarda como huella nada escrito a mano, una prueba automática falla si alguien vuelve a permitirlo, y queda anotado cuántos informes antiguos tenían una huella escrita a mano.

**Qué te toca a ti.** Nada para dejarlo probado. Si la medición encuentra informes antiguos de ARGA con una huella escrita a mano, cambiar cómo se muestran es un cambio de pantalla de ARGA y te pedirán autorización en un comentario; también para incorporarlo a la versión principal.

### MOI-197 · Secretaría · Dar un índice navegable a los expedientes de acuerdo

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Secretaría no tiene una lista de expedientes de acuerdo. Cada acuerdo tiene su ficha completa, pero solo se llega a ella desde la reunión, el acta o el tramitador registral. El 24-09-2026 había 52 acuerdos en ARGA y 10 en Garrigues sin un sitio donde verlos juntos.

**A quién afecta y qué pasa si no se hace.** Afecta a secretarios y abogados: para encontrar un acuerdo tienen que recordar en qué reunión o acta se adoptó. Es un pendiente anotado el 06-07-2026 en la revisión de experiencia de uso de Secretaría. No depende de otros issues ni frena ninguno.

**Qué resultado buscamos.** Una página nueva con todos los acuerdos del grupo, filtrable por estado, órgano y materia, desde la que se abra la ficha de cada uno, y un acceso a ella en el menú lateral de Secretaría con el nombre y el lugar que tú confirmes.

**Cómo sabremos que está resuelto.** En producción, la lista de cada grupo muestra el mismo número de acuerdos que la base de datos (52 en ARGA y 10 en Garrigues el 24-09-2026), y una prueba automática de solo lectura lo comprueba en ARGA y en Garrigues. El grupo nuevo queda fuera por ahora: el 24-09-2026 no tenía ningún acuerdo.

**Qué te toca a ti.** Confirmar el nombre y la posición del acceso en el menú, porque la organización del menú es decisión tuya. La propuesta del agente es «Expedientes de acuerdo», dentro de la sección «Adopción», junto a Convocatorias y Reuniones. Después, autorizar en un comentario la incorporación a la versión principal, que la publica en producción.

### MOI-198 · Comité Legal · Criterios sobre cómo el motor de reglas lee y aplica las normas

Etiquetas: GOS · Secretaría, GOS · Comités · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Secretaría aplica cuatro soluciones conservadoras mientras el Comité Legal no decide: su motor no lee la mayoría que guardan las reglas y muestra una deducida, marcada como tal; si falta regla del órgano que adopta, el tramitador registral usa la de otro órgano y solo avisa (el 19-07-2026, en 8 de 37 acuerdos); siguen abiertos tres criterios de fondo (supresión frente a exclusión del derecho de preferencia, art. 308 LSC; si una plantilla sin órgano, forma de adopción o tipo social vale para cualquiera; y si el socio único equivale a la Junta, art. 15 LSC); y nada distingue una norma imperativa de una dispositiva.

**A quién afecta y qué pasa si no se hace.** Afecta a los abogados de Secretaría: pueden llevar al Registro un acuerdo con plazo e instrumento de la regla de otro órgano, y no saben qué reglas pueden cambiar por estatutos o pacto. No depende de otros issues ni frena ninguno. Reparto: MOI-140 fija las reglas de las comisiones delegadas; aquí se decide si usar la regla de otro órgano bloquea o avisa; MOI-207 arregla, sin criterio jurídico, que el control de validez elija la regla solo por materia.

**Qué resultado buscamos.** Las cuatro respuestas del Comité por escrito y una tarea técnica por cada respuesta que cambie algo.

**Cómo sabremos que está resuelto.** Un documento fechado del Comité en la carpeta jurídica del repositorio responde a las cuatro y un comentario aquí enlaza las tareas.

**Qué te toca a ti.** Llevar las cuatro preguntas al Comité Legal y traer su respuesta; el criterio es suyo. Mientras, todo sigue igual. Después, autoriza incorporar el documento a la versión principal. Opciones del Comité (recomendaciones: criterio técnico del agente):
- Mayoría: leerla de las reglas o mantener la deducida. Recomendación: leerla cuando el Comité ratifique (pregunta L6, en MOI-202) las correcciones de quórum y mayoría hechas en junio de 2026 sin su firma.
- Regla de otro órgano: bloquear, avisar o solo informar. Recomendación: avisar hasta que haya reglas de comisión delegada (pregunta L4, en MOI-140), porque bloquear dejaría sin asistencia a las comisiones.
- Criterios de fondo: decisión expresa o mantener lo conservador. Recomendación: empezar por el art. 308, del que depende un aumento de capital adoptado en Garrigues (dato simulado).
- Imperativa o dispositiva: matriz completa, o de las 14 materias principales con el resto «sin clasificar». Recomendación: la parcial, que desbloquea la pantalla sin inventar criterio.

### MOI-199 · Comité Legal · Decidir qué acredita que una plantilla está aprobada

Etiquetas: GOS · Secretaría, GOS · Comités · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Las plantillas vigentes de Secretaría figuran como aprobadas, pero el campo de quién las aprobó no identifica a ninguna persona y en la mayoría declara ser un marcador de demostración. De las 72 vigentes de ARGA, solo 31 cuadran con la huella guardada al aprobarlas: en 26 el texto no coincide y 15 no tienen huella. El Comité Legal no ha respondido dos preguntas del plan del 19-07-2026 para cerrar la versión española (el producto para sociedades españolas): L1, qué acredita que una plantilla está aprobada y qué se hace con las 72 vigentes; y L2, qué se hace con las que cambiaron de texto después de aprobarse y si todo cambio de texto obliga a una versión nueva.

**A quién afecta y qué pasa si no se hace.** Sin respuesta, las plantillas de ARGA no pueden sanearse ni presentarse como aprobadas y la versión española no se puede cerrar. Bloquea MOI-201. Está relacionado con MOI-200, que ata la huella hacia delante; lo que se haga con las que no cuadran espera a esta respuesta.

**Qué resultado buscamos.** La respuesta del Comité a L1 y L2, registrada y lista para aplicarse al inventario.

**Cómo sabremos que está resuelto.** Un acta o documento del Comité en la carpeta jurídica del repositorio responde a L1 y L2, con fecha y autor identificado.

**Qué te toca a ti.** Llevar L1 y L2 al Comité Legal y traer su respuesta: es criterio jurídico. Dile que un cambio de base de datos del 20-07-2026 mandó volver a sellar 20 plantillas vigentes tras retocarlas, sin decisión suya (no comprobado plantilla a plantilla). Opciones del Comité:
Quién aprueba (L1): un órgano colegiado o una persona identificada, y si se exige colegiación y firma electrónica cualificada. No hay base para recomendar: es criterio jurídico sin propuesta en la fuente.
Las plantillas actuales (L1 y L2):
- Volver a aprobarlas con persona identificada: cierre limpio, pero exige tiempo del Comité.
- Archivarlas y emitir versión nueva: trazable, con más volumen.
- Vigencia condicionada y marcada en pantalla hasta revisarlas: rápida y honesta, pero no cierra la versión española.
- Volver a sellar las que cambiaron: rápido, pero equivale a declarar aprobado el texto actual.
Recomendación: la tercera ya y la primera por lotes de materias principales, porque no frena la demostración ni afirma lo que no hay (criterio técnico del agente). Mientras, MOI-137 evita que la pantalla diga «aprobada legalmente» sobre un marcador. Después, autoriza incorporar el documento a la versión principal.

### MOI-200 · Secretaría · Atar cada plantilla vigente a la huella del texto que se aprobó

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Cada plantilla vigente guarda una huella de su texto para demostrar que lo que se usa es lo que se aprobó, pero nada la mantiene al día. De las 72 plantillas vigentes de ARGA, el 24-09-2026 solo 31 tenían una huella que coincide con su texto; 26 tenían una que ya no corresponde y 15 no tenían ninguna. Un cambio de base de datos puede reescribir el texto de una plantilla vigente sin que nada lo detecte: uno del 20-07-2026 mandó recalcular la huella de 20 plantillas vigentes tras retocarlas, sin decisión del Comité Legal (no comprobado plantilla a plantilla).

**A quién afecta y qué pasa si no se hace.** Afecta a la fiabilidad de todas las plantillas de Secretaría, porque su aprobación no queda atada al texto aprobado. Antes tiene que estar hecho MOI-137, que cambia la misma función del servidor y va primero. No frena otras tareas. Está relacionado con MOI-199: la parte hacia delante no espera al Comité Legal, pero qué hacer con las plantillas que ya no cuadran lo decide el Comité en su pregunta L2.

**Qué resultado buscamos.** Que a partir de ahora la huella se recalcule sola cada vez que cambie el texto de una plantilla, que ese cambio deje sin efecto la aprobación anterior y que ninguna plantilla pueda pasar a vigente sin una huella que coincida. Las 26 que no cuadran y las 15 sin huella no se tocan hasta que el Comité responda.

**Cómo sabremos que está resuelto.** Con el cambio ya aplicado, una sonda en una operación que se deshace al final modifica el texto de una plantilla y comprueba que su aprobación queda anulada, intenta activar una plantilla sin huella y comprueba que se rechaza, y el recuento de ARGA (31, 26 y 15) sigue igual.

**Qué te toca a ti.** Autorizar en un comentario el cambio de base de datos cuando el agente te enseñe el ensayo y, después, que el cambio guardado se incorpore a la versión principal. No hace falta esperar al Comité Legal, solo a MOI-137: hasta que el Comité responda la pregunta L2 en MOI-199, las plantillas que no cuadran se quedan como están.

### MOI-201 · Equipo legal · Nueva versión revisada de la convocatoria de comisión delegada e historial de cambios de las plantillas

Etiquetas: GOS · Secretaría, GOS · Comités · Asignado: Moisés · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Sigue pendiente la última parte del trabajo de plantillas de Secretaría previsto en julio de 2026. La plantilla de convocatoria de comisión delegada no tiene la versión 1.2.0 revisada que se previó: existen la 1.1.0, vigente en ARGA y en el grupo nuevo, y la 1.0.0 archivada. Faltan además las notas y variables de la 1.1.0 y un historial de cambios retrospectivo del resto de plantillas.

**A quién afecta y qué pasa si no se hace.** Afecta a quien convoque una comisión delegada, que usa una plantilla sin la revisión legal prevista, y a quien quiera saber cómo ha cambiado cada plantilla. Antes tienen que estar hechos MOI-199, porque la versión nueva debe llevar la aprobación que el Comité Legal diga que vale, y MOI-140, porque las reglas de las comisiones delegadas que fije el Comité pueden cambiar lo que cite la convocatoria. No frena otras tareas.

**Qué resultado buscamos.** La 1.2.0 redactada y revisada por el equipo legal y vigente con la aprobación que exija MOI-199; la 1.1.0 archivada por el procedimiento controlado del servidor, que activa la versión nueva y archiva la anterior en un solo paso y deja registro de los dos; y el historial de cambios del inventario escrito.

**Cómo sabremos que está resuelto.** En la base de datos, esa plantilla solo tiene vigente la 1.2.0 en cada grupo al que se aplique y la 1.1.0 figura archivada; el historial está guardado en el repositorio.

**Qué te toca a ti.** Encargar al equipo legal la redacción y revisión de la 1.2.0 y trasladar aquí su texto. Decidir a qué se aplica: la 1.1.0 está hoy en ARGA, en el grupo nuevo y en el pack base de reglas y plantillas con el que nacen los grupos nuevos. Recomendación: a los tres, para que ninguno se quede con un texto que el equipo legal ha superado (criterio técnico del agente). Propuesta por defecto: si no dices nada, solo el grupo nuevo y el pack base, y ARGA sigue con la 1.1.0, porque cambiarla en ARGA es un cambio declarado de su dato. Después, autorizar en un comentario el cambio de base de datos que carga la 1.2.0 y archiva la anterior, cuando el agente te enseñe el ensayo, y la incorporación a la versión principal del cambio guardado y del historial.

### MOI-202 · Comité Legal · Responder las preguntas pendientes del cierre de la versión española

Etiquetas: GOS · Secretaría, GOS · Comités · Asignado: Moisés · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El plan de cierre de la versión española del 19-07-2026 dejó doce preguntas para el Comité Legal. L1 y L2 van en MOI-199 y L4 en MOI-140. Las nueve restantes siguen sin respuesta: L3, subtipos de cese, disolución y modificación estructural; L5, si cinco materias del Consejo necesitan reglas propias; L6, ratificar las correcciones de junio a los quórums y mayorías de las reglas; L7, disolución y liquidación; L8, clases de calificación del Registro y efectos de la inscripción; L9, si la interposición del prestador vale ante el Registro Mercantil para actas y certificaciones y qué nombre mostrar; L10, qué justificante de EAD Trust bastaría para dar por definitiva la custodia; L11, si un cargo con mandato vencido sigue vigente hasta la siguiente Junta; y L12, qué acredita la legalización de los libros.

**A quién afecta y qué pasa si no se hace.** No depende de otros issues. Según el plan, la versión española no puede presentarse como cerrada sin un acta del Comité que responda de L1 a L12. Bloquea MOI-203, que necesita L8 y L10 para hacer alcanzables la inscripción, el depósito y la legalización. Está relacionado con MOI-198, cuya lectura de mayorías depende de L6, y con MOI-216, donde obtienes de EAD Trust la confirmación de lo que cubre su contrato, que L10 necesita antes.

**Qué resultado buscamos.** Un documento del Comité que responda a cada una de las nueve preguntas y cada respuesta convertida en tarea técnica.

**Cómo sabremos que está resuelto.** Un documento del Comité Legal en la carpeta jurídica del repositorio, fechado y con autor identificado, responde a cada pregunta, y un comentario aquí enlaza las tareas abiertas.

**Qué te toca a ti.** Convocar al Comité Legal con el texto de las preguntas y traer su respuesta; el criterio es del Comité. Te toca elegir cómo convocarlo:
- Una sola sesión con las nueve: cierra de una vez, pero exige más tiempo del Comité.
- Priorizar L8, L10 y L6.
Recomendación: la segunda, porque desbloquea antes MOI-203 (L8 y L10) y la lectura de mayorías de MOI-198 (L6) (criterio técnico del agente). Mientras, el ciclo registral y las mayorías siguen igual. L9 y L10 conviene plantearlas conforme a la política vigente desde el 21-07-2026 (EAD Trust solo hace interposición, mensajería básica y custodia), y L10, con la confirmación de MOI-216; sin ella, L10 espera. Después, autoriza que el documento se incorpore a la versión principal.

### MOI-203 · Secretaría · Hacer alcanzable desde la aplicación la inscripción, el depósito y la legalización

Etiquetas: GOS · Secretaría, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El ciclo registral de Secretaría termina en tres estados de éxito: inscrita, depositada (depósito de cuentas) o legalizada (legalización de libros). Para llegar a cualquiera de ellos, la aplicación exige un justificante marcado como verificado, y hoy ningún proceso del producto pone esa marca. Los 15 documentos que podrían servir están en ARGA: 3 son anexos externos adjuntados que siguen pendientes de verificar y 12 están marcados como de demostración. Las 5 inscripciones que hay proceden de la carga de datos de demostración, con fechas del 18-04-2026 y del 30-08-2026; ninguna salió de alguien operando la aplicación.

**A quién afecta y qué pasa si no se hace.** Afecta a quien tramite expedientes ante el Registro Mercantil y a las demostraciones de Secretaría: el recorrido completo de un acuerdo español, desde la reunión hasta su inscripción, no se puede hacer usando el producto. Antes tiene que estar MOI-202: el Comité Legal debe responder qué basta para dar un justificante por verificado (pregunta L10) y cómo se clasifica la calificación del registrador (L8). Está relacionada con MOI-216: según el plan del 19-07-2026, responder L10 exige antes que EAD Trust confirme lo que cubre su contrato. No bloquea ninguna otra tarea.

**Qué resultado buscamos.** Un proceso en el servidor que compruebe el documento base del expediente y lo marque como verificado, dejando constancia de cómo y contra qué, sin atribuir ninguna firma a EAD Trust. Con él, un expediente pasa de elevado a presentado y a inscrito desde las pantallas; el depósito y la legalización usan la misma comprobación.

**Cómo sabremos que está resuelto.** Hay al menos una inscripción producida operando la aplicación, con fecha posterior al último cambio de base de datos que cargó datos de demostración, y su justificante verificado dice de dónde procede. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Lo del Comité Legal lo tramitas en MOI-202. Aquí autorizas, en comentarios de este issue: aplicar el cambio de base de datos, después de ver el ensayo; el expediente de prueba etiquetado del recorrido, cuyo historial no se podrá borrar; e incorporar el código a la versión principal, que lo publica. El agente lo hará en el grupo nuevo, para no dejar una fila permanente en ARGA, si para entonces tiene una sociedad con un acuerdo inscribible (hoy no tiene ninguna); si no, en ARGA, que hoy tiene todos los documentos, y tu autorización cubrirá ese dato nuevo de ARGA.

### MOI-204 · Plataforma · Registrar en la auditoría quién hace cada cambio y cubrir actas y expedientes registrales

Etiquetas: GOS · Secretaría, GOS · Plataforma, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El producto lleva un registro de auditoría encadenado: cada cambio en las tablas vigiladas deja una entrada con una huella que enlaza con la anterior, de modo que cualquier manipulación se nota. Pero ninguna de sus 4.228 entradas guarda el identificador de la persona que hizo el cambio; el sistema anota el correo de la sesión cuando lo hay, aunque no se ha medido en cuántas entradas consta y ese dato no entra en la huella. Además, las actas y los expedientes registrales no escriben en ese registro: el acta solo tiene seis protecciones que impiden ciertos cambios y el expediente registral no tiene ninguna, aunque sus eventos sí quedan registrados.

**A quién afecta y qué pasa si no se hace.** Afecta a Secretaría y a cualquier revisión posterior de lo ocurrido. Hoy el registro prueba que algo cambió, pero no quién lo cambió, y el acta, que es el documento central para probar lo acordado, queda fuera. No depende de otra tarea ni bloquea ninguna.

**Qué resultado buscamos.** Que cada entrada nueva guarde quién hizo el cambio y que ese dato forme parte de la huella, y que los cambios de actas y de expedientes registrales entren en el registro. La cadena tiene que seguir siendo válida.

**Cómo sabremos que está resuelto.** Después del cambio, las entradas nuevas hechas con una sesión de usuario tienen autor identificado, el registro contiene entradas de actas y de expedientes registrales, y la comprobación de la cadena la da por válida en cada entorno. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, aplicar el cambio de base de datos cuando el agente te enseñe el ensayo, y después su incorporación a la versión principal. Antes eliges cómo entra el autor en la huella:
- a) Una receta nueva solo para las entradas que se escriban desde el cambio. Las antiguas conservan su huella y siguen sin autor; la comprobación de la cadena reconoce las dos recetas.
- b) Recalcular todas las huellas con la receta nueva. La cadena entera usa una sola receta, pero se reescribe la historia del registro; ya se hizo una vez, en junio de 2026.
Recomendación: a), por criterio técnico del agente: no reescribe lo ya registrado, que las instrucciones del proyecto piden no tocar, y las entradas antiguas no tienen autor que añadir. Si no dices nada, el agente sigue a); b) solo se hace con tu autorización expresa.

### MOI-206 · Secretaría · Capturar los campos sí/no y numéricos de las plantillas con controles propios

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Las plantillas societarias tienen campos que el usuario rellena al preparar un documento. Hoy la pantalla solo ofrece una lista cerrada cuando el campo trae sus valores posibles; todo lo demás se escribe como texto libre. En las plantillas activas de ARGA hay 41 campos de tipo sí/no y 48 numéricos, y ninguno trae esa lista, así que todos se escriben a mano.

**A quién afecta y qué pasa si no se hace.** Afecta a quien prepara convocatorias, actas y certificaciones. El motor que rellena las plantillas trata cualquier texto como «sí», también la palabra «No»: si alguien escribe «No» en un campo sí/no, el documento puede imprimir la cláusula contraria, que cita una base legal distinta (por ejemplo, el régimen de sociedad cotizada en lugar del artículo 217 de la LSC). No depende de otra tarea ni bloquea ninguna.

**Qué resultado buscamos.** Que los campos sí/no se contesten con un control de tres posiciones (sí, no, sin contestar) y los numéricos con un campo de número que admita mínimo y máximo, y que el valor se guarde con su tipo real en lugar de como texto. Antes de cambiarlo, el agente comprobará cómo usa cada plantilla esos campos, para no romper las que comparan con un texto concreto.

**Cómo sabremos que está resuelto.** Una prueba automática recorre los tipos de campo y falla si un campo sí/no o numérico vuelve a aparecer como texto libre. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, la incorporación a la versión principal cuando el agente te la pida, porque eso la publica en producción. El cambio se verá en los formularios de plantillas de ARGA y queda declarado aquí. Además, los borradores ya guardados que tengan «No» o «false» escrito como texto pasarán a leerse como «no»; no se ha medido cuántos hay, y el agente te lo dirá al pedirte la autorización. Para dejarlo probado en una rama no necesitas hacer nada.

### MOI-207 · Secretaría · Que el control de validez de un acuerdo use la regla del órgano correcto

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** El expediente de cada acuerdo muestra un dictamen de validez calculado con las reglas de su materia: plazos, quórums y mayorías. Para elegir esas reglas, el programa busca solo por materia y se queda con la primera que encuentra, sin mirar qué órgano adopta el acuerdo. Si para una misma materia hay reglas de la Junta y del Consejo, puede aplicar en silencio las del Consejo a un acuerdo de Junta, o al revés.

**A quién afecta y qué pasa si no se hace.** Afecta a quien use el expediente para comprobar si un acuerdo es válido: el dictamen puede basarse en las reglas de otro órgano sin avisar. El tramitador registral ya elige por órgano y avisa cuando no encuentra la regla del órgano que adopta; el expediente no. No depende de otra tarea ni bloquea ninguna. Está relacionada con MOI-198, donde el Comité Legal decide si usar la regla de otro órgano debe bloquear, avisar o solo informar; esta tarea solo lleva al expediente el aviso de hoy.

**Qué resultado buscamos.** Que el dictamen de validez use el mismo criterio que el tramitador: primero la regla del órgano que adopta y, si no la hay, la que exista, pero diciéndolo en pantalla. El aviso describe de dónde sale la regla y no bloquea mientras el Comité Legal no decida otra cosa en MOI-198.

**Cómo sabremos que está resuelto.** Una prueba automática con dos reglas de la misma materia y órganos distintos falla si el programa vuelve a elegir solo por materia, y el aviso de procedencia se ve en el expediente. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, la incorporación a la versión principal, porque eso la publica en producción. Antes de pedírtela, el agente te enseñará qué acuerdos de ARGA cambian de dictamen o pasan a mostrar el aviso, y tu autorización cubrirá también ese cambio declarado. Para dejarlo probado en una rama no necesitas hacer nada.

### MOI-208 · Secretaría · Que el cómputo de notificaciones no dé todas por buenas cuando falta el número de miembros

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** En los acuerdos sin sesión, el expediente comprueba que conste la recepción de la propuesta por cada destinatario. Cuando no se sabe cuántos miembros tiene el órgano, el programa toma como total el número de votos registrados, y como mínimo uno. Así, las constancias que haya cubren siempre el total: con un solo voto y una sola constancia, el expediente da la notificación por completa.

**A quién afecta y qué pasa si no se hace.** Afecta a quien revise un acuerdo sin sesión: el expediente puede afirmar que la notificación está completa cuando el órgano tiene más destinatarios de los que constan. No depende de otra tarea ni bloquea ninguna.

**Qué resultado buscamos.** Que, si falta el número de miembros, el expediente diga «No medido» en lugar de inventar un total, y que esa comprobación no se dé por cumplida. Para ello hay que corregir tanto el cálculo del expediente como la regla que valora las notificaciones, que hoy también convierte el dato que falta en un cero.

**Cómo sabremos que está resuelto.** Una prueba automática del caso sin número de miembros falla si vuelve a calcularse un total inventado, y la pantalla muestra «No medido» en ese caso. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, la incorporación a la versión principal cuando el agente te la pida, porque eso la publica en producción. Si algún acuerdo sin sesión de ARGA no tiene ese número, su expediente dejará de decir que la notificación está completa; el agente lo medirá y te dirá cuáles cambian al pedirte la autorización. Para dejarlo probado en una rama no necesitas hacer nada.

### MOI-209 · Secretaría · Quitar código duplicado o sin uso

Etiquetas: GOS · Secretaría · Asignado: sin asignar · Prioridad: Low

## Para entenderlo sin ser técnico

**Qué problema hay.** Secretaría arrastra dos restos de código. Uno: una función para publicar excepciones a las reglas normativas se quedó sin pantalla que la use al retirarse la antigua gestión de reglas, y sigue ahí, capaz de escribir. Dos: la conversión de la forma societaria (SA, SAU, SL, SLU y SLP) está copiada en tres sitios. La convocatoria y la reunión tienen dos copias idénticas de una regla que distingue las cinco formas y lee SLP antes que SL. El control de validez de los acuerdos tiene la tercera, con otra regla a propósito: trata como SL todo lo que no sea SA, incluidas SAU, SLU y SLP, para no cambiar los resultados de ARGA.

**A quién afecta y qué pasa si no se hace.** La función huérfana podría reconectarse a una pantalla sin revisión y escribir excepciones normativas. Con copias sueltas, un cambio hecho en una y no en su gemela hará que la convocatoria y la reunión traten distinto a la misma sociedad, por ejemplo a una limitada profesional. No depende de otra tarea ni bloquea ninguna.

**Qué resultado buscamos.** Que la función huérfana desaparezca y que las tres copias pasen a un solo módulo con dos funciones con nombre propio: la regla común, que usarán la convocatoria y la reunión, y la regla del control de validez, que agrupa como hoy. Se unifica el sitio y cada pantalla conserva su resultado actual; una prueba por forma lo fija y otra impide volver a copiar la conversión.

**Cómo sabremos que está resuelto.** Una búsqueda en el código no encuentra la función huérfana ni copias locales de la conversión, y las pruebas automáticas, también las del control de validez, dan los resultados de antes. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Autorizar, en un comentario, la incorporación a la versión principal, que la publica en producción. Si el agente propone que el control de validez distinga también las SAU, SLU o SLP, tendrá que pedírtelo aparte, porque cambia lo que ve ARGA. Dejarlo probado en una rama no requiere nada de ti.

### MOI-214 · AIMS · Prueba automática de extremo a extremo del recorrido de AIMS como Garrigues

Etiquetas: GOS · AIMS, GOS · Plataforma, GOS · Ventana · Asignado: sin asignar · Prioridad: Medium

## Para entenderlo sin ser técnico

**Qué problema hay.** Ninguna prueba automática recorre por pantalla lo que AIMS permite escribir desde el 08-09-2026: el alta de un sistema con el cuestionario guiado, su reclasificación, las secciones del expediente técnico y los indicadores de vigilancia. Las pruebas actuales de AIMS solo leen y bloquean cualquier escritura: abren la ficha de un sistema para comprobar un enlace y su clasificación, pero no la de una evaluación ni la de un incidente. Esos caminos solo los vigilan pruebas que revisan el código o hablan directamente con la base de datos, sin pasar por las pantallas.

**A quién afecta y qué pasa si no se hace.** Afecta a quien use o pruebe AIMS en Garrigues y a recorridos como el de MOI-55: si un cambio rompe esas pantallas, ninguna prueba lo detecta y se descubre a mano. No depende de otra tarea ni bloquea ninguna. Está relacionada con MOI-210: si allí se decide quitar el permiso de borrar sistemas (a) o proteger sus registros (b, la recomendada), esta prueba no podrá borrar su sistema de prueba, que lleva cuestionario, expediente e indicador, y habrá que rehacer su limpieza antes de ejecutarla.

**Qué resultado buscamos.** Una prueba que, como Garrigues, dé de alta por el cuestionario un sistema con nombre marcado de prueba, vea su clasificación en la ficha, lo reclasifique con la motivación del art. 6.3 del RIA, añada una sección del expediente y un indicador, y abra en lectura una evaluación y un incidente existentes. Al empezar y al terminar borra solo lo que lleva su marca. No crea incidentes ni evaluaciones, que la base de datos no deja borrar, y solo corre si alguien la activa expresamente. Como escribe en producción, lleva la etiqueta Ventana.

**Cómo sabremos que está resuelto.** La prueba pasa en Garrigues, se pone en rojo si una pantalla del recorrido se rompe y, al terminar, no queda ninguna fila con su marca. Nivel exigido: probado y publicado.

**Qué te toca a ti.** Dos autorizaciones, en comentarios de este issue. Primero, que la prueba escriba en el entorno de Garrigues, después de ver el ensayo: el agente te enseña qué crea, cómo lo borra y una limpieza de prueba que solo cuenta lo que borraría. Recomendación: que valga también para las ejecuciones posteriores mientras no cambie lo que crea ni cómo lo borra y cada una termine sin filas de prueba (criterio técnico del agente); si cambia, se vuelve a pedir. Después, la incorporación del código a la versión principal, que lo publica.
