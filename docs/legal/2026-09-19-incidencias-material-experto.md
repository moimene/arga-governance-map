# Material RIA: incidencias y preguntas para nuestra sesión

*Primera versión, 19-09-2026. Para el autor de la matriz RIA. Preparado por el equipo de AIMS 360.*

Vamos a convertir tu matriz en el catálogo de obligaciones de AIMS 360. Para prepararlo la hemos leído entera, celda a celda, y la hemos cotejado con el Reglamento en su versión consolidada. Este documento recoge lo que encontramos y lo que necesitamos que nos decidas tú. En el programa **tu criterio manda**. Cuando el texto parezca decir otra cosa, el catálogo aplicará el texto de forma provisional y lo marcará «a validar por el experto», y te lo traemos aquí. Ninguna de esas marcas será definitiva hasta que la veamos contigo.

**Qué hemos revisado:**
- **El Excel**, con sus hojas Dashboard, Obligaciones, Fases y Leyenda. Lo citamos como `Hoja!celda`.
- **El cuadro de mando digital**: `cuadro_de_mando.html` y sus 76 entregables, d1 a d76. Lo citamos por línea del HTML o por identificador de entregable.
- **La presentación de 15 diapositivas.** La citamos como «diap. N», donde N es su orden en la presentación, no el número impreso en la diapositiva, que va desplazado (la diap. 5 lleva «03» y la diap. 9, «06»).

**Qué no juzgamos.** Los estados, los porcentajes, los responsables y las fechas de cada fila. La propia Leyenda C8 los declara ilustrativos. Solo señalamos lo estructural: lo que seguiría mal aunque se rellenara con el dato real.

**Texto de referencia.** Reglamento (UE) 2024/1689 consolidado a 27-07-2026 (CELEX 02024R1689-20260727), que ya incorpora el Reglamento (UE) 2026/1744. Algunos criterios los hemos contrastado además con Harvey (fuentes de EUR-Lex). Lo indicamos en cada caso: un contraste de Harvey no sustituye tu criterio, solo nos dice que el texto va en esa dirección.

**Esta versión se regenerará** desde el catálogo cuando esté curado. Los identificadores (I-nn, P-nn) se mantendrán para que el acta de la sesión pueda remitirse a ellos.

---

## 1. Antes de nada: lo que tu material hace mejor que nuestra herramienta

No es cortesía. Son cambios que vamos a hacer en AIMS 360 porque tu enfoque es el correcto:

- **Rol por sistema, y múltiple** (Fases C7: «Determinar el rol de la entidad para cada sistema (puede ser varios)»). Hoy derivamos un único rol excluyente, así que un sistema desarrollado y usado en casa pierde los arts. 26 y 27.
- **El art. 50 como obligación que se suma a cualquier nivel de riesgo**: «No necesariamente alto riesgo» en OB-42 a OB-46. Respeta el art. 50.6; hoy nosotros lo tratamos como un nivel.
- **El método de riesgos** de la diap. 12 (riesgo inherente, medidas, residual), que encaja con los arts. 3.2, 9.2, 9.5 y 27.1 d)-f).
- **Las obligaciones de organización como un único entregable.** OB-09 (art. 4) y OB-19 (art. 17) no se miden sistema a sistema.
- **Entregables que son documentos** (protocolos, modelos, políticas) y **una capa de gestión**: fases con plazo, alarmas y avance por fase, rol y especialidad.
- **Un catálogo amplio**: importador, distribuidor, registro, espacio controlado de pruebas y los arts. 21, 22, 25.4, 74 y 86.

---

## 2. Una pregunta previa: ¿para quién es el proyecto?

El panel de la diap. 8 y la cabecera del cuadro de mando digital (`cuadro_de_mando.html:78`) llevan la marca GARRIGUES.

- **Si es el cumplimiento interno del despacho**, buena parte del régimen de alto riesgo no le aplica hoy.
- **Si es la metodología que el despacho ofrece a clientes**, la herramienta tiene que trabajar con varios clientes y con varios encargos por cliente.

Para el demostrador hemos tomado tu matriz como el programa interno de cumplimiento de cada entorno (el del despacho y el de un grupo asegurador ficticio, ARGA). Nos ayuda mucho saber cuál era tu intención.

> **P-00.** ¿La matriz está pensada para el cumplimiento interno del despacho, como metodología para clientes o para las dos cosas?

---

## 3. El texto cambió el 27-7-2026

El Reglamento (UE) 2026/1744, el «Ómnibus digital sobre IA», se publicó en el DOUE el 24-7-2026 y está en vigor desde el 27-7-2026. Suponemos que tu matriz es anterior a esa fecha: no lo recoge, y es lo lógico. Las consecuencias para el catálogo son estas:

- **Art. 4.** Pasa a decir que proveedores y responsables del despliegue «adoptarán medidas» para apoyar la alfabetización, y dice expresamente que no exige garantizar un nivel específico. OB-09 se acredita con las medidas adoptadas, no con un resultado.
- **Art. 10.5.** Queda suprimido. Su contenido está ahora en el nuevo art. 4 bis, que el apartado 2 extiende a los responsables del despliegue. Esto afecta a OB-12 (ver P-10).
- **Art. 5.1.** Tiene dos letras nuevas, b bis) y b ter), aplicables desde el 2-12-2026, acotadas por el nuevo art. 5.1 bis.
- **Calendario del capítulo III, secciones 1 a 3.** Se aplica al anexo III desde el 2-12-2027 y al anexo I desde el 2-8-2028. El art. 111.2 deja fuera a los sistemas ya en servicio antes de esas fechas, salvo que sufran un cambio significativo de diseño.
- **Art. 111.4.** El marcado del art. 50.2 tiene hasta el 2-12-2026 para los sistemas introducidos antes del 2-8-2026.

> **P-01.** ¿Nos confirmas que la matriz es anterior al 2026/1744 y que prefieres que el catálogo cite la numeración y el calendario vigentes, conservando tu cita original en una columna aparte?

---

## 4. Incidencias de integridad del material

Son problemas de las piezas, no de derecho. Casi todos se arreglan con poco trabajo y ninguno invalida el método. En la herramienta, lo que tu Excel teclea (recuentos, avance) pasará a calcularse desde el dato.

| # | Qué vimos | Prueba | Propuesta o pregunta |
|---|---|---|---|
| I-01 | El bloque «Por origen» del Dashboard está roto. | `Dashboard!G25` = `=COUNTIF(Obligaciones!#REF!,$F25)` y `G26` igual. La columna «Origen» que define la Leyenda C7 ya no existe. Reapuntarla a Notas (columna O) no basta, porque sus valores son vacío o «Incorporado para pleno cumplimiento», no «Excel base» ni «Añadido (completitud)». | Arreglo mínimo: `G25 = COUNTBLANK(Obligaciones!O2:O66)`, que da **59**, y `G26 = COUNTIF(Obligaciones!O2:O66,"Incorporado*")`, que da **6**. Cuadra con tus 59 + 6 = 65. |
| I-02 | El estado y el % son independientes: nada impide un «Completado» al 50 %. | OB-02: `J3 = Completado`, `K3 = 0,5`, cuando la Leyenda C6 define Completado como 100 %. La validación de `K2:K66` admite un decimal entre 0 y 1, pero nada liga esa columna con J. Además, la columna F (Rol principal) no tiene validación y es texto libre, aunque de su literal dependen los `COUNTIF` del bloque por rol (hoy cuadran: suman 65). | El dato es ilustrativo. El problema es que el libro no impide la incoherencia. En la herramienta, el estado y el avance se derivarán uno del otro. |
| I-03 | Textos repetidos que inflan el denominador del avance. | El HTML tiene 76 entregables con 69 textos distintos. Cuatro de las parejas repetidas **no** inflan nada, porque son sujetos distintos: d34/d39, d36/d40 y d38/d41 (art. 23 importador frente a art. 24 distribuidor) y d32/d47 (art. 19 proveedor frente a art. 26.6 responsable del despliegue). Sí inflan: **d42, d43 y d44**, tres «Protocolo de despliegue de sistema de IA.» idénticos, y **d59 y d60**, que dicen «forma parte del entregable del punto 39». Hay además fragmentación: d13 es un encabezado («Debe incluir:»), la frase del art. 13 se parte en d22-d26, y también se parten d49/d50 y d66/d67. El avance es completados/76 (`cuadro_de_mando.html:128`). | Para d42-d44, ver P-22; para d59/d60, P-02. Para la fragmentación, proponemos agrupar cada frase en un solo entregable con sus apartados como puntos internos. |
| I-04 | «Punto 39» no se resuelve. | `Obligaciones!I46` e `I47` (OB-45, OB-46) y d59/d60 remiten al «entregable del punto 39». Con 65 filas, OB-39 es el art. 43. En el HTML, d39 es el checklist del distribuidor. Con la numeración base de 59, el nº 39 sería OB-43 (art. 50.2), aunque OB-42 (50.1, «Protocolo interno de información») encaja igual de bien. | **P-02.** ¿A qué entregable querías remitir? |
| I-05 | 78 entregables en la presentación, 76 en el HTML, sin reconciliar. | Diap. 5: «59 obligaciones y 78 entregables». Panel de la diap. 8, por fase: 1·1, 4·7, 3·3, 44·60 y 7·7. HTML: 1/7/3/58/7 = 76. La diferencia está solo en la fase de Obligaciones (60 frente a 58). | Nuestra hipótesis, no demostrada: son las dos filas cuyo «entregable» es un marcador, OB-11 (`I12 = x`) y OB-52 (`I53 = N/A`). **P-03.** ¿Es así? |
| I-06 | Las 6 obligaciones del bloque «Añadido (completitud)» no llegan al cuadro digital. | Excel: `O39`-`O42`, `O51` y `O52` dicen «Incorporado para pleno cumplimiento»: EIPD (art. 35 RGPD) y arts. 43, 47, 48, 53.1 c) y 55. Ningún entregable del HTML cita esos artículos ni el RGPD. Del art. 53 solo hay d61-d63 (letras a, b y d). Sin embargo, la diap. 14 presenta entre los «entregables clave» la «declaración UE de conformidad y CE» y el «puente RGPD (EIPD)». Tampoco tienen entregable OB-11 ni OB-52. | En el catálogo les daremos entregables propios (D-A1 a D-A6). **P-04.** ¿Te parece bien, o preferías dejarlas fuera del cuadro digital a propósito? |
| I-07 | Dos cronogramas: el del Excel y el de la presentación. | Excel, columna M: Inventario T2 2025, Clasificación y Roles T3 2025, Obligaciones T4 2025, Gobernanza T1 2026. Diap. 7 y HTML: T3 2026, T4 2026, T4 2026, T1 2027 y T2 2027. Todas las fases están desplazadas **exactamente 5 trimestres**. Además, OB-58 (26.5) y OB-59 (26.8) están en la fase 5 del Excel y en la fase de Obligaciones del HTML (d45, d46 y d52). | Es el mismo plan con otra fecha de arranque, y la Leyenda C8 lo declara ilustrativo. **P-05.** ¿Qué cronograma y qué fase de OB-58/59 tomamos como referencia? En la herramienta, las fechas de fase las fijará cada órgano. |
| I-08 | Hay cuatro taxonomías de especialidad y no casan entre sí. | (1) Excel: `Naturaleza` da Jurídico 26, Técnico 3 y Mixto 36. `Responsable` da Equipo Jurídico 26, Jurídico + Ingeniería IA 36 e Ingeniería IA 3. (2) Diap. 9: Ingeniería de IA «36 puntos» y Evaluación de riesgos «10 puntos». (3) Leyenda de las diap. 5 a 8: Jurídico 59·78, Técnico 42·58, Riesgos 21·30, Ciberseguridad 2·2 y Datos 3·3. (4) HTML, una sola etiqueta por entregable: Jurídico 34, Riesgos 22, Técnico 17, Ciberseguridad 2 y Datos 1. El panel «Avance por especialidad» (`:171`) mostrará Jurídico 34, frente al 59·78 de la presentación. | **P-06.** ¿Qué taxonomía quieres que use la herramienta? Proponemos la de la presentación, con varias etiquetas por entregable, que es la que describe tu método. |
| I-09 | La especialidad de d36 y d40 cambia según la pieza. | Almacenamiento y transporte (OB-25, art. 23.4; OB-30, art. 24.3): «Jurídico + Ingeniería IA» en el Excel (`L26`, `L31`) y «Riesgos» en el HTML (d36, d40). | Cae dentro de P-06. |
| I-10 | «Riesgos 10 puntos» (diap. 9) se reproduce, pero con otra base de recuento. | Los 10 salen de los entregables del HTML para los artículos que la propia diapositiva enumera (arts. 9, 27, 72 y 73): d14-d18 (sin el encabezado d13), d51, d71, d72, d73 y d74. En cambio, «Ingeniería de IA 36» coincide con más de una columna del Excel (Mixto de las 65; Mixto + Técnico de las 59 base; «Jurídico + Ingeniería IA» en la columna L), así que no sabemos de cuál sale. La diap. 7 los rotula «volumen de trabajo», no recuento de filas. | No es un error. Pedimos solo la regla, para que la herramienta la reproduzca. **P-07.** ¿Cómo se cuentan los «puntos» de la diap. 9? |
| I-11 | Siete celdas de entregable llegan cortadas en el propio libro, entre ellas la de OB-48. | Medido en el fichero original, uniendo todos los fragmentos de texto de cada celda: `I11`, `I16`, `I43`, `I49`, `I54`, `I56` e `I65` (OB-10, 15, 42, 48, 53, 55 y 64) miden exactamente 180 caracteres, que es además la longitud máxima de toda la columna I. OB-48 acaba en «…cumplir sus obligaciones en virtud del pres». El corte está en el libro, no en nuestra lectura; seguramente viene del programa que generó el libro. El HTML no lo suple en todos los casos: d62 sí trae OB-48 hasta «…los elementos previstos en el anexo XII», pero d15 (OB-10) acaba en el mismo punto que la celda, y d53 (OB-42), con 177 caracteres, es más corto que `I43`, que en el libro sigue con «…usuarios, etc. Po». | Para OB-48 tomaremos el texto de d62. Para las otras seis, el libro no trae más texto que recuperar, y la capa literal del catálogo tiene que guardar tu texto íntegro. **P-08.** ¿Nos pasas el texto completo de esas siete celdas? |
| I-12 | El cuadro digital no admite «no aplica». | Estados del HTML: pendiente, en curso, completado e incidencia (`:107`). El Excel sí lo tenía: la Leyenda C4 incluye «N/A (no aplica)» y la C5 dice que el panel promedia solo las obligaciones aplicables («excluye N/A»). A un responsable del despliegue puro no le aplican unos 21 entregables: d3-d5 (art. 5.2), d8 y d61-d63 (uso general), d34-d41 (importador y distribuidor), d52 y d69 (autoridades públicas) y d64-d67 (pruebas en condiciones reales). O nunca llega al 100 %, o tiene que marcar «Hecho» lo que no le toca. «Acciones requeridas» propone además «Iniciar» sobre entregables que no aplican (`:185-189`). | En la herramienta, «no aplica» se derivará del rol y los hechos de cada sociedad y sistema, siempre con motivo. |
| I-13 | La fecha de cada entregable no alimenta ninguna alarma. | El campo fecha se guarda y se vuelve a pintar (`:209`) y viaja en la exportación (`:216`), pero `alarms()` solo mira la fecha de la fase (`:178`). | En la herramienta, las alarmas mirarán la fecha de cada entregable y, además, la fecha de aplicación de cada obligación. |
| I-14 | La fase continua acabará marcada como VENCIDA. | Gobernanza lleva `cont: true` y fecha 2027-06-30. `alarms()` (`:178`) no comprueba `cont`, así que desde el 1-7-2027 saldrá VENCIDA. Además, la diap. 10 dice que las fases 2 a 5 «giran en ciclo y se reevalúan de forma continua», pero el HTML marca Clasificación, Roles y Obligaciones con `cont: false`, fecha de cierre y alarma de vencimiento. | Ver P-29, sobre las fases en ciclo. |
| I-15 | La nota se inserta en la página sin escapar. | `cuadro_de_mando.html:181` concatena `state[…].note` dentro de `innerHTML`. La importación de JSON (`:217`) lo mezcla con el estado sin validar (`Object.assign`), así que un fichero importado podría inyectar HTML. | Es menor y de herramienta, pero fácil de cerrar: pintar la nota con `textContent`. |
| I-16 | Erratas. | «alfebitización» (`I10`, d12); «Participación en Sanbox» (`C53`); «No necesariamento» (`E46`, `E47`); «en el mercados» (`G2`); «medias adoptadas» por «medidas» (d18); «hardware generados» (d25), donde el art. 13.3 e) dice «necesarios». | Las corregiremos en la capa canónica y dejaremos intacta tu capa literal. |

---

## 5. Discrepancias de cita, de sujeto o de alcance

En cada fila, la cita, el sujeto o el alcance que recoge la matriz no casan del todo con el texto. En P-19 la etiqueta sí incluye el supuesto: lo que falta es un apartado (el 5.3) y el carácter policial del uso. El catálogo aplicará el texto de forma provisional y lo marcará. Para cada una necesitamos que la **aceptes** (se queda la cita del texto) o la **rechaces** (se queda tu criterio y Legal documenta por qué).

| # | Fila | Tu matriz | Lo que dice el texto | Contraste | Pregunta |
|---|---|---|---|---|---|
| P-09 | OB-43 | Art. 50.2 con rol principal «Distribuidor» (`F44`); `G44` = «Resp. Despliegue (creador/distribuidor contenido)». | El 50.2 obliga a «los proveedores de sistemas de IA… que generen contenido sintético». El distribuidor del art. 3.7 no tiene deberes en el art. 50. Falta además una fila para el deber del responsable del despliegue sobre ultrasuplantaciones (50.4, párrafo primero). El paréntesis «(deepfake)» es defendible: también el proveedor debe marcarlas. | Harvey: CORRECTO (C1). | ¿Aceptas pasar OB-43 al proveedor y añadir la fila del 50.4, párrafo primero? En tu mapa por rol quedaría Proveedor 28 y Distribuidor 3 (los del art. 24). |
| P-10 | OB-12 | «Art. 10.4.f)» (`H13`); entregable «Actualización de RAT». | El 10.4 no tiene letras. Lo que describes es el 10.5 f) del texto de 2024. Tras el 2026/1744 está en el art. 4 bis.1 f), que el 4 bis.2 extiende a los responsables del despliegue. Es un régimen habilitante («podrán tratar excepcionalmente»): obliga a documentar las razones de la necesidad estricta en el registro de **ese** tratamiento, pero no impone un deber general de actualizar el registro del art. 30 RGPD. | Harvey: CORRECTO CON MATIZ (C2). El matiz es el de la frase anterior y lo aplicaremos. | ¿Aceptas citar el art. 4 bis.1 f) y formular el entregable como «documentar en el registro de ese tratamiento las razones de necesidad estricta»? |
| P-11 | OB-56 | Tipo «Alto riesgo y sistemas del Anexo III no considerados de alto riesgo» (`E57`, igual que OB-55). | El art. 49.3 y la sección C del anexo VIII solo se refieren a sistemas de alto riesgo del anexo III, salvo el punto 2. Registrar un sistema rebajado por el 6.3 corresponde al proveedor (49.2, sección B). | Harvey: CORRECTO (C3). | ¿Aceptas acotar OB-56 al alto riesgo del anexo III, salvo el punto 2? |
| P-12 | OB-22 | Art. 20 con rol principal «Proveedor / Despliegue» (`F23`). | El 20.1 obliga a «los proveedores». El responsable del despliegue es destinatario de la información y colabora (20.2). Su deber propio es el 26.5, que ya recoges en OB-58. «Roles implicados» está bien. | Harvey: CORRECTO (C4). | ¿Aceptas «Proveedor» como rol principal y remitir al responsable del despliegue a OB-58? |
| P-13 | OB-27 | Cooperación del importador: «Art. 23.6» (`H28`). | La cooperación literal está en el 23.7; el 23.6 es la entrega de información previa solicitud. En OB-28 citas los dos apartados paralelos (24.5 y 24.6). | Pendiente de Harvey. | ¿Citamos 23.6 y 23.7, en paralelo con OB-28? |
| P-14 | OB-24 | Entregable «Modelo etiqueta proveedores» (`I25`). | El 23.3 exige al importador indicar **su propio** nombre, nombre comercial o marca y dirección de contacto. | Pendiente de Harvey. | ¿Reformulamos el entregable como «identificación del importador»? |
| P-15 | OB-64 | «Art. 74.12, 91 y 92», tipo «Todos», rol «Proveedor» (`H65`). | Los arts. 91 y 92 son facultades de la Comisión y de la Oficina de IA sobre proveedores de modelos de uso general. El deber del proveedor del modelo está en el 91.5 y el 92.5. El deber del proveedor de un sistema está en los arts. 21 y 74.12-14. Tu entregable (d75) ya prevé analizar cada requerimiento por separado, y nos parece exactamente lo correcto. | Harvey validó el 74.6 (autoridad financiera, C16); el resto está pendiente. | ¿Separamos el 74.12-14 (proveedor del sistema) del 91.5 y el 92.5 (proveedor del modelo)? |
| P-16 | OB-55 y OB-56 | «Art. 71.2» y «Art. 71.3». | El art. 71 regula la base de datos y quién introduce cada sección. La obligación de registrar está en el art. 49 (con los arts. 6.4, 16 i) y 26.8). En tu matriz, el registro aparece en cinco filas: OB-03 (d4), OB-04 (d7), OB-55, OB-56 y OB-59. | Pendiente de Harvey. | ¿Añadimos el art. 49 conservando tu cita del 71, y agrupamos las cinco filas bajo el art. 49 y el anexo VIII? |
| P-17 | Fases E6 | «Documentación de no-alto-riesgo (Art. 6.3)». | El deber de documentar la evaluación está en el 6.4. | Pendiente de Harvey. | ¿Citamos el 6.4? |
| P-18 | OB-01 | «Art. 2 RIA». | El cribado del art. 3.1 (¿es un sistema de IA?) está en tu hoja Fases (B5, C5, D5), pero no tiene fila, y es el grueso de la fase 1. | Pendiente de Harvey. | ¿Citamos los arts. 2 y 3.1 en OB-01? |
| P-19 | OB-03 | «Art. 5.2 RIA (excepción)», rol «Proveedor / Despliegue». En el HTML se convierte en tres «Art. 5» genéricos (d3, d4 y d5), dentro de Clasificación. | El 5.2 obliga a la autoridad garante del cumplimiento del Derecho que despliega el sistema. Tu etiqueta la incluye, y los entregables, formulados como «asistencia», encajan con un proveedor que la asiste. Faltan la autorización previa del 5.3 y el carácter policial del uso, que se pierde en el HTML. | Pendiente de Harvey. | ¿Aceptas que OB-03 salga «no aplica» por defecto, salvo que la sociedad sea autoridad garante, y que añadamos el 5.3? |

---

## 6. Decisiones de modelado que conviene alinear

No son errores. Son decisiones tuyas que, al pasar la matriz a un catálogo que se evalúa por sociedad y sistema, cambian el resultado.

| # | Qué vimos | Prueba | Propuesta y pregunta |
|---|---|---|---|
| P-20 | **El uso general tratado como tipo de sistema.** | OB-47 a OB-51 tienen tipo «Uso general (foundation models)», que es terminología del texto del Parlamento. Los arts. 53 y 55 se activan por ser **proveedor del modelo** (art. 3.63), no por usar un sistema de uso general (art. 3.66). El considerando 97 dice que los modelos «no constituyen por sí mismos sistemas de IA». Filtrar por tipo cargaría OB-47 a 51 sobre cualquier sistema que integre GPT o Claude. Harvey: CORRECTO (C17). | Proponemos que OB-47 a 51 se activen por el rol «proveedor de modelo de uso general». ¿De acuerdo? |
| P-21 | **Art. 25 marcado solo «Alto riesgo».** | OB-07 (`E8`): «Alto riesgo». Pero el 25.1 c) parte precisamente de un sistema que **no** es de alto riesgo, incluidos los de uso general, que se usa para una finalidad de alto riesgo. Ahí está la conversión real: una herramienta generativa usada, por ejemplo, para evaluar el rendimiento de profesionales (anexo III, 4 b). | Proponemos que el protocolo de cambio de rol vigile también los sistemas de uso general y los de riesgo limitado. ¿De acuerdo? |
| P-22 | **d42, d43 y d44: ¿un único protocolo?** | Los tres llevan el mismo título, «Protocolo de despliegue de sistema de IA.», en OB-31 (26.1), OB-32 (26.2) y OB-33 (26.4). También en el Excel (`I32`-`I34`). | Proponemos un único documento con secciones por apartado: d42 como principal, y d43 y d44 como secciones suyas que no cuentan aparte en el avance. ¿Es lo que querías? Si eran tres documentos, ¿qué distingue a cada uno? |
| P-23 | **OB-18 (art. 16) como una sola fila.** | OB-18: «Checklist de cumplimiento» (`I19`). El art. 16 tiene letras a) a l). | Proponemos mantenerla como **una fila**, con una marca de estado por letra. Así no cambia tu denominador y una obligación con letras pendientes no puede cerrarse. Solo necesitamos tu conformidad. |
| P-24 | **Avance documental frente a cumplimiento material, en las obligaciones continuas.** | Tu «% avance» es una sola métrica. En las obligaciones que se cumplen de forma continuada (art. 4; logs de los arts. 12, 19 y 26.6; arts. 14, 26.5, 72 y 73; cooperación de los arts. 21 y 26.12), un protocolo aprobado no prueba que se cumpla. En el art. 4, además, el Ómnibus pasó de exigir un resultado a exigir medidas (Harvey: CORRECTO, C14). | Proponemos rotular el entregable aprobado como «avance documental» y medir el cumplimiento material con los registros del periodo (formaciones impartidas, logs conservados, incidentes notificados). Es una reinterpretación de tu métrica y por eso te la consultamos: ¿la aceptas? |
| P-25 | **OB-37 (EIDF): «sector público, Anexo III.5(b)(c)».** | `E38`. Se puede leer como si el anexo III 5 b) y c) fueran sector público, y no lo son: son crédito y seguros de vida y salud. El art. 27.1 alcanza también al privado que despliega esos sistemas, y el considerando 96 cita bancos y aseguradoras. Es la fila que decide si una aseguradora necesita EIDF, y en el HTML (d51, «Art. 27») se pierde incluso ese matiz. Harvey: CORRECTO (C6). | Proponemos leerlo como una disyunción: organismo de Derecho público **o** entidad privada que presta servicios públicos **o** responsable del despliegue del anexo III 5 b) o c). ¿Era tu intención? |
| P-26 | **OB-38 (EIPD): una fila o dos.** | Tipo «Alto riesgo (datos personales)» (`E39`). El puente del art. 26.9 solo existe en alto riesgo RIA. En cambio, la EIPD del art. 35 RGPD depende del riesgo del tratamiento y puede ser exigible hoy a un sistema que no es de alto riesgo RIA. Harvey: CORRECTO (C5). | Proponemos partirla en OB-38a (art. 35 RGPD, para cualquier tratamiento de alto riesgo) y OB-38b (puente del 26.9, solo alto riesgo RIA). ¿De acuerdo? Proponemos también añadir la consulta al DPO (art. 35.2 RGPD) como paso documentado. |
| P-27 | **El art. 50.5 como apéndice del 50.4.** | OB-46 (50.5) cuelga de OB-45 (50.4) y remite al mismo «punto 39». Pero el 50.5 regula la forma y el momento de la información de los apartados 1 a 4, es decir, de todo el art. 50. | Proponemos tratar el 50.5 como transversal a OB-42 a OB-45. ¿De acuerdo? |
| P-28 | **El orden de las fases frente a la fecha de aplicación.** | La diap. 6 dice que los bloques «se apilan en orden: no se sube de planta sin cerrar la anterior». Con las fechas de la diap. 7, el art. 4 (OB-09, fase 4) se cerraría el T1 2027, cuando se aplica desde el 2-2-2025. El art. 50 (fase 4) se aplica desde el 2-8-2026, y el capítulo V desde el 2-8-2025. OB-02 (art. 5) sí está donde el método lo permite, justo después del inventario. | Proponemos tratar los arts. 4 y 5 como regularización inmediata, fuera de la secuencia, y que cada obligación lleve su fecha de aplicación para que las alarmas distingan «ya exigible» de «exigible desde…». ¿Te encaja con tu método? |
| P-29 | **Fases 2 a 5 en ciclo.** | Diap. 10: «el inventario abre el proceso; las fases 2–5 giran en ciclo». El HTML solo marca Gobernanza como continua (I-14). La diap. 14 dice que los cambios de finalidad, de rol o del sistema «reabren el ciclo». | Proponemos que la herramienta reabra la clasificación cuando cambien la finalidad, la versión, el modelo, el estado o la norma, y que la fase 1 también se repita cuando entre un sistema nuevo. ¿De acuerdo? |

---

## 7. Filas que proponemos añadir a tu catálogo

Echamos de menos estas obligaciones. Van marcadas como añadidas por nosotros y pendientes de tu validación. Si alguna la dejaste fuera a propósito, basta con decírnoslo.

- **Art. 26.12:** cooperación del responsable del despliegue con las autoridades. Todas tus filas de cooperación son del proveedor.
- **Art. 26.10:** autorización previa para la identificación biométrica remota en diferido en una investigación penal. Solo aplica a quien despliega con ese fin, pero completa el art. 26.
- **Art. 54:** representante autorizado del proveedor de un modelo de uso general establecido en un tercer país.
- **Art. 111.2:** un sistema de alto riesgo introducido o puesto en servicio antes de la fecha de aplicación queda fuera del régimen hasta que sufre «cambios significativos en sus diseños». Ese cambio no reabre el ciclo: lo abre. El 111.2 no define la expresión, así que la herramienta no la deduce: la decide una consulta interna del órgano de IA.
- **Art. 43.4:** es otro supuesto. Una «modificación sustancial» (art. 3.23) de un sistema de alto riesgo que ya pasó la evaluación de la conformidad obliga a una nueva evaluación de la conformidad. No equiparamos sin más este supuesto con el «cambio significativo» del 111.2.
- **Art. 27.2:** actualizar la EIDF cuando cambie alguno de sus elementos.
- **Cláusulas para entidades financieras**, decisivas para una aseguradora: arts. 9.10, 17.4 (salvo las letras g, h e i del 17.1, que siguen exigiéndose), 18.3, 19.2, 26.5 (párrafos segundo y tercero), 26.6 (párrafo segundo) y 72.4 (párrafo segundo), y el art. 74.6 para la autoridad.
- **Arts. 5.3, 25.2, 53.2, 53.3, 53.4, 55.2 y 56.**
- **Art. 53.1 b) desde el otro lado:** el proveedor posterior que integra un modelo de un tercero tiene derecho a esa información.
- **Art. 35.2 RGPD** (consulta al DPO), **50.4 párrafo primero** (ultrasuplantación, P-09), **50.5 transversal** (P-27), **6.4** (P-17) y **5.1 bis**.
- **Art. 5 por usos posibles también para el proveedor que no es de alto riesgo.** Tu OB-02 ya lo plantea así para el proveedor: lo extendemos.
- **Cambio normativo como disparador de reevaluación.**
- **Plazo de respuesta a la solicitud de explicación del art. 86.** El RIA no lo fija. Proponemos, por analogía, el mes prorrogable del art. 12.3 RGPD.
- **Exigibilidad heredada de los arts. 71, 72, 73, 74 y 86.** Es un criterio nuestro, pendiente también del contraste con Harvey. Cuando la fila exige nivel alto, hereda la fecha de aplicación del anexo que clasifica el sistema (III o I) y la exclusión del art. 111.2, aunque esté fuera del capítulo III. Sin esta regla, la fecha general del art. 113 haría exigibles desde el 2-8-2026 deberes de un sistema de alto riesgo al que el régimen todavía no se aplica. Cambia la fecha de filas tuyas: OB-60 a OB-63 (arts. 72 y 73), OB-65 (art. 86.1) y, en lo que exijan nivel alto, OB-55 y OB-56 (art. 71) y OB-64 (art. 74).

> **P-30.** ¿Validas estas filas? ¿Alguna la dejaste fuera a propósito?

---

## 8. Índice de preguntas, para el acta de la sesión

Para las discrepancias del §5 la respuesta es ACEPTADA o RECHAZADA. Si la rechazas, Legal documenta la justificación.

| ID | Tema | Respuesta que necesitamos |
|---|---|---|
| P-00 | Para quién es el proyecto | Dato |
| P-01 | Anterior al Ómnibus; cita vigente y cita original | Confirmación |
| P-02 | Destino del «punto 39» | Dato |
| P-03 | 78 frente a 76 | Confirmación |
| P-04 | Entregables de las 6 añadidas | Confirmación |
| P-05 | Cronograma de referencia; fase de OB-58/59 | Dato |
| P-06 | Taxonomía de especialidades (incluye d36/d40) | Decisión |
| P-07 | Regla de los «puntos» de la diap. 9 | Dato |
| P-08 | Texto íntegro de 7 celdas (OB-48 y otras) | Dato |
| P-09 | OB-43 → proveedor; fila del 50.4 p. 1 | Aceptada / rechazada |
| P-10 | OB-12 → art. 4 bis.1 f) | Aceptada / rechazada |
| P-11 | OB-56 → alto riesgo anexo III, salvo punto 2 | Aceptada / rechazada |
| P-12 | OB-22 → proveedor | Aceptada / rechazada |
| P-13 | OB-27 → 23.6 y 23.7 | Aceptada / rechazada |
| P-14 | OB-24 → identificación del importador | Aceptada / rechazada |
| P-15 | OB-64 → 74.12-14 y 91.5/92.5 | Aceptada / rechazada |
| P-16 | OB-55/56 → art. 49 | Aceptada / rechazada |
| P-17 | Fases E6 → 6.4 | Aceptada / rechazada |
| P-18 | OB-01 → arts. 2 y 3.1 | Aceptada / rechazada |
| P-19 | OB-03 → «no aplica» por defecto; 5.3 | Aceptada / rechazada |
| P-20 | Uso general por rol, no por tipo | Aceptada / rechazada |
| P-21 | Art. 25 también en uso general y riesgo limitado | Aceptada / rechazada |
| P-22 | d42-d44 como un único protocolo | Confirmación |
| P-23 | OB-18 como una fila con marca por letra | Conformidad |
| P-24 | Avance documental frente a cumplimiento material | Aceptada / rechazada |
| P-25 | OB-37 como disyunción | Aceptada / rechazada |
| P-26 | OB-38 en 38a y 38b; consulta al DPO | Aceptada / rechazada |
| P-27 | 50.5 transversal | Aceptada / rechazada |
| P-28 | Arts. 4 y 5 como regularización; fecha de aplicación por fila | Aceptada / rechazada |
| P-29 | Reapertura del ciclo | Aceptada / rechazada |
| P-30 | Filas añadidas | Validación fila a fila |

---

## Anexo interno: trazabilidad

No hace falta enviar este anexo al experto.

- **Gaps que cierra:** GC-134 (§5), GC-136 (§6) y GC-137 (§4), especificación `docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md`, tarea F0.T4.
- **Fuentes:** material del experto en la copia de trabajo del análisis (`dashboard_xlsx.txt`, `obligaciones.json`, `entregables_html.json`, `cuadro_de_mando.html`, `vision_deck.txt` y las capturas de las diap. 3, 5-8 y 10), la dimensión «coherencia interna del material del experto» del análisis (17 puntos, cada uno con su verificación) y `docs/superpowers/reviews/2026-09-19-vision-ria-experto-vs-aims.md`, §6.
- **Correcciones de la verificación que se han respetado:**
  - I-03 no cuenta como inflación las cuatro parejas que son sujetos distintos.
  - I-05 es una hipótesis, no un hecho.
  - I-10 reconoce que «Riesgos 10» sí se reproduce.
  - P-19 trata OB-03 como nota y no como error.
- **Corrección posterior a la verificación.** La verificación suponía que el corte de I-11 venía de nuestra extracción («lo más probable», sin abrir el original). Medido después en `Dashboard_control_RIA.xlsx` (`xl/sharedStrings.xml` y `xl/worksheets/sheet2.xml`, uniendo todos los `<t>` de cada `<si>`): las siete celdas miden 180 en el propio libro. Reextraer el Excel no recupera nada (ver el ledger). En la misma medición, la validación de `K2:K66` es `decimal` con `formula1` 0 y `formula2` 1, sin `operator` (por defecto, «between»): nuestro volcado solo imprimía `formula1` (I-02).
- **Tabla de la especificación:** P-09 a P-22 y P-24 a P-26 son las filas de la tabla del §4.5. P-20, P-21, P-25, P-27, P-28 y P-29 son el GC-136. P-22, P-23 y P-24 son las tres preguntas añadidas por F0.T4.
- **Siguientes pasos:**
  - F3.T9 regenera este documento desde el catálogo curado.
  - F3.T11 registra la respuesta a cada pregunta en `discrepancia.estado` y levanta el acta de la sesión.
