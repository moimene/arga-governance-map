# Cuaderno de preguntas — Comité de Gobernanza de la IA de Garrigues y CATIT de ARGA

**Proyecto:** Governance OS · Secretaría y AIMS
**Preparado para:** Moisés Menéndez, para llevar tal cual a ambos órganos y traer las respuestas
**Fecha de preparación:** 26-09-2026
**Fuente:** issues de Linear MOI-162, MOI-167, MOI-178, MOI-182, MOI-183 y MOI-175 (volcados íntegros), contrastados contra el repositorio de código el 26-09-2026

**Cómo usar este cuaderno.** Cada bloque es una pregunta que un órgano de gobernanza tiene que decidir; ningún agente de software puede decidirla por vosotros. Las opciones y la "recomendación" que aparecen son las que ya traía el issue redactado por el agente técnico — se citan tal cual, atribuidas, y no sustituyen ni anticipan el criterio jurídico o de negocio del Comité ni del CATIT. Devolved las respuestas anotando el número de pregunta.

**Nota sobre EAD Trust.** Ninguno de los seis issues de origen plantea preguntas dirigidas a EAD Trust; no se incluye ninguna sección al respecto. Por la política vigente del proyecto, EAD Trust actúa hoy sólo como capa de interposición, mensajería básica y custodia/archivado — no firma, no envía ni entrega, y ninguna pregunta de este cuaderno debe leerse como si lo hiciera.

**Nota sobre personas y cuentas.** Ninguno de los seis issues fuente pide designar una persona nueva ni crear una cuenta de usuario. Si en el futuro un issue relacionado (por ejemplo el que crea la "cuenta de cumplimiento" de ARGA) llega a este cuaderno, se indicará ahí, de forma expresa, qué persona hay que nombrar y en qué sistema hay que dar de alta la cuenta — los agentes de software no pueden crear cuentas por su cuenta.

---

## Índice de prioridad

Ordenado primero por lo que tiene fecha en 2026, después por cuántos issues bloquea.

| # | Pregunta | Issue | Fecha | Por qué va primero |
|---|---|---|---|---|
| 1 | ¿"Cambio significativo" del art. 111.2: seguir el considerando 177 o tratarlo distinto? | MOI-182 (CP-2) | 13-11-2026 (orientativa) | Bloquea la clasificación de sistemas de alto riesgo antes del 2-12-2026 (fecha regulatoria) |
| 2 | ¿Existe o existirá el acuerdo intragrupo de la herramienta de IA propia (GA_IA) y con qué contenido? | MOI-182 (CP-3) | 13-11-2026 (orientativa) | Misma cadena que la pregunta 1: bloquea la clasificación antes del 2-12-2026 |
| 3 | ¿Qué debe contener un plan de acción de IA (responsable, fecha, estado, % u otros campos)? | MOI-162 | Sin fecha propia, pero encadena hacia el 2-12-2026 | Bloquea la integración GRC/Secretaría (MOI-175), que a su vez bloquea el carril rápido (hasta 27-11) y la clasificación (2-12-2026) |
| 4 | ¿Quién fija la posición del despacho sobre el secreto profesional, y cuál es esa posición? | MOI-178 | H-16 antes del 30-11-2026; posición antes del 18-12-2026 (ambas orientativas, a confirmar por el Comité) | Fechas propias en 2026; no bloquea otros issues pero condiciona MOI-212 y el registro en Secretaría |
| 5 | ¿Se valida el catálogo de 44 medidas del responsable del despliegue de riesgo limitado/mínimo (perfil C)? | MOI-167 | Sin fecha propia; bloqueada por la revisión legal de MOI-166 (abierta) | Retira el aviso de "cobertura provisional" en pantalla; no bloquea otros issues |
| 6 | ¿Se define un catálogo propio para el responsable del despliegue de un sistema de alto riesgo (perfil B)? | MOI-183 | Sin fecha; prioridad Baja, hito M4 (deuda conocida, no 2026 urgente) | No bloquea nada; es la de menor urgencia del lote |

---

## MOI-182 — Comité de IA · Procedimiento de "cambio significativo" y acuerdo intragrupo de la herramienta de IA propia

**Título llano:** Dos decisiones separadas: (1) cuándo se considera que un sistema de IA que ya funcionaba antes de la nueva ley sufrió un "cambio significativo" que activa las obligaciones de alto riesgo; (2) si existe o debe existir un acuerdo escrito entre las sociedades del grupo que reparte quién es "proveedor" y quién "desarrollador" de la herramienta de IA propia del despacho (GA_IA).

**Contexto.** El Reglamento europeo de IA (RIA) exige activar el régimen de alto riesgo para sistemas ya en servicio si sufren un "cambio significativo" en su diseño (art. 111.2); el considerando 177 del propio Reglamento dice que eso equivale a lo que otras normas llaman "modificación sustancial", pero un análisis previo con la herramienta de IA jurídica Harvey sostuvo lo contrario. Aparte, Garrigues tiene una herramienta de IA propia (GA_IA) que la matriz "vende" o pone a disposición y que NewLaw desarrolla por encargo, sin que exista hoy ningún acuerdo escrito que documente ese reparto de papeles; en ARGA pasa lo mismo entre ARGA Digital (desarrolladora) y las aseguradoras del grupo que la usan. Ninguna de las dos decisiones se ha registrado nunca en Secretaría. Datos verificados el 24-09-2026 y contrastados contra el repositorio el 26-09-2026: ambos puntos siguen "PENDIENTE" en el registro del programa, sin ningún commit ni comentario que los mueva.

### Pregunta 1 — "Cambio significativo" (art. 111.2)

**¿Debe el Comité seguir el criterio del considerando 177 (equiparar "cambio significativo" a "modificación sustancial"), o apartarse de él como hizo el análisis de Harvey, justificando por qué?**

- **Opción a — Seguir el considerando 177.** Consecuencia: un sistema en servicio desde antes del régimen de alto riesgo (por ejemplo, ARGA Score, en servicio desde el 1-3-2024) activa el régimen de alto riesgo en cuanto sufra una modificación equivalente a una "modificación sustancial" en el sentido ya conocido de otras normas. Es el criterio que da el propio texto del Reglamento.
- **Opción b — Tratarlos como conceptos distintos (postura de Harvey).** Consecuencia: haría falta justificar por qué se aparta del considerando 177; sin esa justificación documentada, la decisión queda expuesta ante una inspección.

**Recomendación técnica del agente que redactó el issue:** opción (a), "por ser el criterio del propio legislador" (cita literal). El análisis jurídico de fondo (comparación entre el considerando 177 y la respuesta de Harvey) no lo hace el agente: sólo indica que el Reglamento Ómnibus 2026/1744 modificó el art. 111.2 pero no tocó ese considerando.

**Qué se desbloquea con la respuesta.** El sistema ARGA Score y otros sistemas "Alto" anteriores a la nueva regulación dejan de estar en un limbo ("alto riesgo latente") y se puede decidir si su régimen se activa o no. Bloquea directamente MOI-177 (clasificar de verdad los sistemas de Garrigues y ARGA Assist), que tiene fecha límite regulatoria el **2-12-2026**.

**Fecha límite.** 13-11-2026, propuesta por el programa interno como orientativa para que el Comité y el CATIT la confirmen — no es una fecha que imponga el Reglamento, es la fecha que el equipo técnico se ha dado para no llegar tarde al 2-12-2026, que esa sí es regulatoria.

**Qué pasa mientras no respondan.** El cuestionario de clasificación no admite responder "hubo cambio significativo" sin la referencia de este dictamen; el sistema sigue en estado "alto riesgo latente" con aviso en pantalla, y no se puede completar la clasificación de ARGA Score antes del plazo legal del 2-12-2026.

---

### Pregunta 2 — Acuerdo intragrupo de la herramienta de IA propia (GA_IA)

**¿Existe o debe existir un acuerdo escrito entre las sociedades del grupo que documente el reparto de papeles (quién es proveedor, quién desarrolladora) de GA_IA, y qué debe contener como mínimo?**

- **Opción a — Formalizarlo, con la lista de contenido mínimo que propone el registro del programa** (a título de propuesta para el debate, no como criterio cerrado): partes y sistema; quién lo pone en servicio y con qué nombre; qué deberes de proveedor asume la matriz (arts. 4, 5, 50.1 y 50.2 si concurren); qué información técnica aporta NewLaw; cómo se comunican las nuevas versiones; cómo se gestionan incidentes; cómo se coopera con las autoridades; vigencia del acuerdo. Consecuencia: deja el reparto de responsabilidades por escrito y localizable; lo firmarían las sociedades afectadas —en Garrigues, la matriz y NewLaw; en ARGA, si procede, ARGA Digital y las aseguradoras que ponen los sistemas en servicio— por sus órganos de administración o apoderados (la fuente no dice qué persona concreta debe firmar).
- **Opción b — Dejar el reparto como hipótesis de trabajo**, porque el art. 25.4 del RIA sólo obliga a este tipo de acuerdo cuando el sistema es de alto riesgo, y GA_IA no está clasificada como tal. Consecuencia: la ficha del sistema sigue diciendo "reparto intragrupo no documentado" indefinidamente.
- **Opción c — Si alguna sociedad del grupo comercializa la herramienta**, esa sociedad concreta pasa a ser la proveedora (Harvey señaló que la matriz, al no tener personalidad jurídica propia en algunos esquemas de holding tipo "g-digital", no podría ser proveedora ella misma). Consecuencia: exige aclarar primero si hay comercialización real y por parte de quién.

**Recomendación técnica del agente que redactó el issue:** opción (a), citando el análisis de Harvey (consideración 1 / RH-1: "formalizar en acuerdos intragrupo") como motivo — es decir, el agente traslada la recomendación de la herramienta jurídica externa, no un criterio propio.

**Qué se desbloquea con la respuesta.** Permite clasificar GA_IA como sistema de IA antes del **2-12-2026** (fecha regulatoria) y da apoyo documental a la clasificación de otros sistemas que dependen de la misma cadena de responsabilidad.

**Fecha límite.** 13-11-2026, orientativa, misma lógica que la pregunta 1 (autoimpuesta para no llegar tarde al plazo legal del 2-12-2026).

**Qué pasa mientras no respondan.** GA_IA sigue figurando con "proveedor: Garrigues" en texto libre, sin sociedad concreta asignada, y su clasificación se sostiene sólo sobre una hipótesis de trabajo, no sobre un hecho documentado.

**Quién decide en cada grupo.** En Garrigues, el Comité de Gobernanza de la IA. En ARGA, el CATIT (Comité Asesor de Tecnología e Innovación), que es el órgano equivalente allí, sobre el correlato ARGA Digital / aseguradoras del grupo.

---

## MOI-162 — Transversal · Decidir cómo cuelga un plan de acción de una obligación o de una brecha de IA

**Título llano:** Hoy AIMS (el módulo de gobernanza de IA) y GRC (el módulo de cumplimiento) guardan sus planes de corrección en dos sitios que no se comunican entre sí; hay que decidir qué debe llevar un plan de acción único antes de unificarlos.

**Contexto.** Cuando el módulo de IA detecta que falta cumplir algo, hoy genera su propio "plan de adaptación" guardado dentro de la propia evaluación de IA. El módulo de cumplimiento (GRC) tiene, por su parte, un registro de planes de acción, pero cada uno de esos planes tiene que colgar obligatoriamente de un "hallazgo" (una incidencia detectada) — no puede colgar directamente de una obligación legal ni de un sistema de IA. Un análisis jurídico externo (el "experto RIA") pide que exista un único plan de acción, el de GRC, no dos. A día de hoy ARGA tiene 8 planes de acción en GRC y Garrigues no tiene ninguno; verificado en el código el 26-09-2026, ambos hechos siguen siendo así.

### Pregunta 3 — ¿Qué debe contener un plan de acción de IA?

**Antes de decidir cómo se conecta una acción con una obligación o un sistema de IA, ¿qué campos debe recoger obligatoriamente un plan de acción — responsable, fecha límite, estado, porcentaje de avance, u otros que el Comité y el CATIT consideren necesarios?**

Esta primera pregunta sobre el *contenido* del plan es la que el issue pide llevar expresamente a ambos órganos, antes de que Moisés tome la decisión técnica de cómo se conecta un plan de acción con su origen (esa segunda decisión, sobre el modelo de datos, es de Moisés como responsable de producto, no del Comité ni del CATIT — se explica más abajo sólo como contexto).

*(Decisión técnica de Moisés, para contexto — no es pregunta al Comité/CATIT):* una vez conocido lo que el Comité y el CATIT digan sobre el contenido, Moisés debe decidir entre (a) permitir que una acción cuelgue directamente de una obligación o de un sistema de IA sin necesidad de inventar un hallazgo — es la opción que ya está diseñada en la especificación técnica y no toca los 8 planes existentes de ARGA — o (b) crear automáticamente un "hallazgo" falso por cada brecha detectada, lo que llenaría el listado de hallazgos de GRC con incidencias que nadie ha encontrado realmente y obligaría a rediseñar buena parte del trabajo ya hecho. El análisis jurídico original no recomienda ninguna de las dos; la recomendación de (a) que aparece en la documentación es, literalmente, "criterio técnico del agente [de software], porque (b) fabrica hallazgos; el motivo es la fiabilidad del dato, no jurídico" — no es un criterio legal.

**Qué se desbloquea con la respuesta.** Permite avanzar en la integración de AIMS con GRC y Secretaría (MOI-175), que a su vez desbloquea el carril rápido de clasificación (fecha interna: 27-11-2026) y, con él, la clasificación de sistemas antes del **2-12-2026** (fecha regulatoria).

**Fecha límite.** No tiene fecha propia asignada, pero al encadenar con MOI-175 → MOI-176 (27-11-2026) → MOI-177 (2-12-2026, regulatoria), retrasarla retrasa toda la cadena.

**Qué pasa mientras no respondan.** El plan de acción de IA sigue guardado donde está hoy (dentro de la evaluación de IA), la pantalla no lo presenta como si fuera un plan de GRC, y la parte del programa que unifica ambos módulos (MOI-175) no puede avanzar en esta pieza concreta.

**Quién pregunta a quién.** Por la regla del proyecto de que un dato o modelo común a los tres grupos (ARGA, Garrigues y el tenant nuevo) se lleva a los dos comités, esta pregunta va tanto al Comité de Gobernanza de la IA de Garrigues como al CATIT de ARGA, porque ARGA ya tiene 8 planes de acción reales y el registro es compartido por los dos tenants.

---

## MOI-178 — Comité de IA · Fijar la posición del despacho sobre el secreto profesional ante la autoridad

**Título llano:** El Reglamento europeo de IA obliga a cooperar con la autoridad supervisora y a darle acceso a registros, documentación e incluso al código fuente si lo pide de forma motivada, sin que la norma prevea una excepción expresa para el secreto profesional del abogado. Garrigues, como despacho que usa Harvey y Copilot y que además desarrolla su propia herramienta de IA, tiene que decidir su postura.

**Contexto.** Los artículos 21, 26.12 y 74 del Reglamento obligan a cooperar con la autoridad y a facilitar acceso a documentación y, previa solicitud motivada, al código; ninguno excepciona el secreto profesional. Esos registros pueden contener información de clientes del despacho. Un análisis previo con Harvey (herramienta de IA jurídica) confirmó que no existe una excepción expresa en el texto y recomendó someter la cuestión a un comité y documentar la posición del despacho por escrito. Hoy nadie ha fijado esa posición, y ni siquiera está decidido qué órgano interno debe hacerlo. Esto sólo afecta a Garrigues, no a ARGA, porque nace del secreto profesional del abogado frente a sus clientes.

### Pregunta 4a — ¿Qué órgano debe fijar la posición?

**¿Corresponde fijar la posición al Comité de Gobernanza de la IA con un dictamen que después ratifica el Senior Partner, es una cuestión deontológica que decide directamente el Senior Partner con informe previo del Comité de Práctica Profesional, o debe seguirse el circuito ya previsto en la política interna de uso de la IA (PI-30)?**

- **Opción a.** La fija el Comité de IA mediante dictamen, y decide finalmente el Senior Partner.
- **Opción b.** Es materia deontológica: decide el Senior Partner, con informe previo obligatorio del Comité de Práctica Profesional (art. 43.1 del Código Ético).
- **Opción c.** Se sigue el circuito ya existente de la política PI-30 de uso de la IA (informe al Departamento de Intangibles, autorización del Comité de IA y decisión final del Senior Partner).

**Recomendación:** el issue no recomienda ninguna — dice expresamente que "no hay base para recomendar: la fuente no recomienda ninguna y es criterio del órgano".

### Pregunta 4b — Una vez decidido el órgano competente: ¿cuál es la posición del despacho?

Tres preguntas de fondo que quedan pendientes de la respuesta a la 4a:
1. ¿Puede el despacho limitar o condicionar el acceso de la autoridad, y con qué base jurídica?
2. ¿Quién evalúa cada requerimiento de la autoridad y en qué plazo interno?
3. ¿Qué debe quedar documentado de cada decisión?

**Recomendación:** ninguna — de nuevo, el issue remite el criterio íntegramente al órgano competente, con el apoyo previo del equipo legal (que debe contrastar la respuesta de Harvey con el art. 78 del Reglamento, el Derecho español sobre secreto profesional y la Carta de Derechos Fundamentales antes de que el Comité decida).

**Qué se desbloquea con la respuesta.** El dictamen se registra de forma inmutable en Secretaría (una vez aprobado, no se puede editar ni borrar) y sirve de base para dos piezas del programa: el resto de la fase F6 (MOI-212, que sin esta posición sólo podrá mostrar "posición pendiente del Comité") y la integración con GRC y Secretaría (MOI-175, pieza F5.T13, que es donde técnicamente se guarda el dictamen).

**Fecha límite.** Propuestas por el programa técnico, a confirmar por el Comité — ambas orientativas, no impuestas por el Reglamento: envío del cuestionario a Harvey (lote H-16) antes del **30-11-2026**; posición aprobada antes del **18-12-2026**.

**Qué pasa mientras no respondan.** Cada requerimiento de la autoridad se sigue analizando caso por caso fuera de la herramienta, sin criterio unificado ni documentado; la pantalla de requerimientos (cuando exista) dirá "posición del despacho sobre secreto profesional pendiente del Comité de IA" y no decidirá por sí sola si algo se entrega o no.

---

## MOI-167 — Comité de IA · Validar el catálogo de medidas del responsable del despliegue (riesgo limitado o mínimo)

**Título llano:** Garrigues usa sistemas de IA de riesgo limitado o mínimo (como Harvey) sin ser su fabricante, sólo su usuario bajo autoridad propia ("responsable del despliegue"). El sistema mide hoy su cumplimiento contra una lista de 43 medidas que la propia pantalla avisa que es "provisional" porque el Comité de Gobernanza de la IA todavía no la ha validado.

**Contexto.** La versión ya incorporada al código principal del proyecto tiene 43 medidas en ese catálogo; una revisión posterior añadió una medida más (la obligación del artículo 50.3 del Reglamento, sobre reconocimiento de emociones o categorización biométrica) y reclasificó cuatro medidas como "marco operativo" en vez de "obligación", quedando en 44. Comprobado en el código el 26-09-2026: esas 44 medidas ya están incorporadas al repositorio principal, pero el aviso de "cobertura provisional" sigue activo en pantalla, sin distinguir entre Garrigues y ARGA. Esta pregunta está a la espera de que el equipo legal (issue MOI-166, todavía abierto) revise antes las ayudas de texto del cuestionario.

### Pregunta 5 — ¿Se valida el catálogo de 44 medidas?

**¿Valida el Comité de Gobernanza de la IA de Garrigues las 44 medidas tal como están (con su norma y su carácter de obligación o marco operativo), las valida con cambios, o decide no validarlas todavía?**

- **Validar las 44 tal cual.** Consecuencia: se retira el aviso "cobertura provisional" en Garrigues en cuanto conste el dictamen con fecha.
- **Validar con cambios.** Consecuencia: los cambios que pida el Comité se aplican antes de retirar el aviso.
- **No validar todavía.** Consecuencia: el aviso permanece indefinidamente en Garrigues.

**Recomendación técnica del agente que redactó el issue:** validar la versión de 44 medidas, "que ya incluye la obligación del art. 50.3 que faltaba" — recomendación de un documento de trabajo interno redactado por un agente de software, no del Comité ni de ningún criterio jurídico externo.

**Qué se desbloquea con la respuesta.** En Garrigues: se retira el aviso de cobertura provisional en cuanto exista el dictamen con fecha. En ARGA: el aviso no se retira automáticamente — hace falta además que el CATIT decida si adopta ese mismo catálogo para ARGA; mientras no lo haga, ARGA sigue viendo "cobertura provisional" (esto es una propuesta del agente redactor sobre cómo repartir la decisión entre los dos órganos, no algo que fije la fuente original).

**Fecha límite.** No tiene fecha propia; depende de que se cierre antes MOI-166 (revisión legal de las ayudas de texto), que sigue abierto a día de hoy.

**Qué pasa mientras no respondan.** Toda cifra de cumplimiento de Garrigues medida contra este catálogo sigue siendo provisional; la pantalla lo advierte expresamente.

---

## MOI-183 — Comité de IA · Definir el catálogo del responsable del despliegue de un sistema de alto riesgo

**Título llano:** El módulo de IA no tiene todavía ninguna lista de medidas propia para quien usa —sin fabricarlo— un sistema de IA de alto riesgo. Mientras tanto, mide a ese usuario contra las obligaciones que en realidad son del fabricante.

**Contexto.** Cuando un sistema se clasifica como "alto riesgo" y el grupo (Garrigues o ARGA) es sólo quien lo usa bajo su autoridad, no quien lo fabrica, el sistema le aplica hoy el catálogo completo de deberes del fabricante (84 medidas), que no son exactamente los suyos, y la pantalla lo advierte. El grupo tiene deberes propios en los artículos 26 y 27 del Reglamento y en el RGPD que hoy no se miden nunca. No hay todavía ningún caso real de esto en la base de datos de producción; es una pieza pendiente de una fase posterior del programa (F7, issue MOI-213), de prioridad baja y sin fecha para 2026. Comprobado en el código el 26-09-2026: la situación descrita sigue siendo exacta, letra por letra.

### Pregunta 6 — ¿Se crea un catálogo propio para este perfil?

**¿Debe existir un catálogo de medidas propio para el responsable del despliegue de un sistema de alto riesgo, distinto del catálogo del fabricante, o se mantiene la situación actual (medir contra el catálogo del fabricante, con el aviso correspondiente)?**

- **Opción a — Catálogo propio.** Cada medida con su norma y su carácter (obligación o marco operativo), basado en los artículos 26 y 27 del Reglamento, el RGPD y la evaluación de impacto de protección de datos. Consecuencia: mide de verdad los deberes propios del perfil, no los del fabricante.
- **Opción b — Seguir con el catálogo del fabricante y el aviso.** Consecuencia: se sigue midiendo de más (deberes que no son propios) y se sigue advirtiendo en pantalla; es la postura conservadora pero no resuelve el problema de fondo.

**Recomendación técnica del agente que redactó el issue:** opción (a), la misma que propone un análisis jurídico previo para la sesión de trabajo conjunta, "porque mide los deberes propios del perfil y no los del proveedor".

**Qué se desbloquea con la respuesta.** Permite que AIMS mida correctamente a cualquier sistema de alto riesgo donde el grupo sea sólo responsable del despliegue (por ejemplo, un sistema como "FraudGuard" si resultase de alto riesgo y ARGA fuera sólo su usuaria). Como en MOI-167, el dictamen de Garrigues fijaría el catálogo para el producto y el CATIT decidiría después si lo adopta para ARGA (propuesta del agente, no un criterio ya fijado).

**Fecha límite.** Ninguna. Prioridad Baja, hito M4 ("resto del programa, criterios jurídicos pendientes y deuda conocida") — es la pregunta menos urgente del lote.

**Qué pasa mientras no respondan.** Se sigue midiendo de más (contra el catálogo del fabricante) y diciéndolo en pantalla; no hay ningún caso real afectado todavía. Antes de nada, hace falta que Moisés convoque una sesión de trabajo conjunta con el Comité, el equipo legal y el despacho externo que asesora en la materia — esa convocatoria todavía no se ha hecho.

---

## MOI-175 — Nota de contexto (no trae preguntas propias al Comité o al CATIT)

MOI-175 es la pieza técnica que cose AIMS, GRC y Secretaría entre sí. No formula ninguna pregunta directa al Comité de IA ni al CATIT, pero **es donde se registran los dictámenes** que resulten de las preguntas 1, 2, 3 y 4 de este cuaderno (los dictámenes de MOI-162, MOI-178 y MOI-182 se guardan ahí, de forma inmutable, en cuanto los órganos respondan). Además, MOI-175 está bloqueada hasta que Moisés tome dos decisiones que no son de este cuaderno (una sobre cómo mostrar un control sin efectividad medida, otra sobre una tercera fase del programa) y hasta que se resuelva la pregunta 3 (MOI-162). Se incluye aquí sólo para que quede claro por qué las respuestas de este cuaderno son condición para que el resto del programa avance.

---

## Tabla resumen

| Issue | Pregunta (resumen) | Fecha | Tipo de fecha | Qué desbloquea |
|---|---|---|---|---|
| MOI-182 (CP-2) | ¿Seguir el considerando 177 para "cambio significativo" (art. 111.2), o apartarse como Harvey? | 13-11-2026 | Orientativa (interna, a confirmar) | Clasificación de sistemas alto riesgo antes del 2-12-2026 (regulatoria) — bloquea MOI-177 |
| MOI-182 (CP-3) | ¿Existe/existirá el acuerdo intragrupo de GA_IA y con qué contenido mínimo? | 13-11-2026 | Orientativa (interna, a confirmar) | Clasificación de GA_IA antes del 2-12-2026 (regulatoria) — bloquea MOI-177 |
| MOI-162 | ¿Qué debe contener un plan de acción de IA (responsable, fecha, estado, %...)? | Sin fecha propia | — | MOI-175 → MOI-176 (27-11-2026, interna) → MOI-177 (2-12-2026, regulatoria) |
| MOI-178 | ¿Qué órgano fija la posición sobre secreto profesional, y cuál es esa posición? | H-16: 30-11-2026 · Posición: 18-12-2026 | Orientativas (a confirmar por el Comité) | Registro del dictamen en Secretaría (MOI-175/F5.T13) y pieza de requerimientos (MOI-212) |
| MOI-167 | ¿Se valida el catálogo de 44 medidas del perfil C (riesgo limitado/mínimo)? | Sin fecha propia | Bloqueada por MOI-166 (legal), abierta | Retira "cobertura provisional" en Garrigues; el CATIT decide después para ARGA |
| MOI-183 | ¿Se crea un catálogo propio para el responsable del despliegue de alto riesgo (perfil B)? | Sin fecha | Prioridad Baja, hito M4 | Mide correctamente futuros sistemas de alto riesgo donde el grupo sólo despliega, no fabrica |
