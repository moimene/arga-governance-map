
# Cuaderno de preguntas — Comité Legal y equipo legal
## Proyecto «Governance OS · Secretaría y AIMS»

Este cuaderno reúne todas las preguntas que el proyecto tiene pendientes de un
criterio jurídico del Comité Legal o del equipo legal, tal y como constan hoy
(26-09-2026) en los issues MOI-138, MOI-139, MOI-140, MOI-141, MOI-163,
MOI-166, MOI-172, MOI-179, MOI-198, MOI-199, MOI-201, MOI-202, MOI-203 y
MOI-219 del proyecto interno de gestión.

Puede enviarse tal cual. Cada pregunta indica su contexto, sus opciones con la
consecuencia de cada una, si el equipo técnico ya propone algo (dejando claro
que es una recomendación técnica, no jurídica) y qué se desbloquea con la
respuesta.

**Nota sobre el cliente asegurador:** «ARGA» es el nombre interno de trabajo
del grupo asegurador piloto del proyecto, no su nombre real.

**Nota sobre EAD Trust:** EAD Trust es el proveedor tecnológico contratado
para hacer de intermediario en el envío de documentos y para su custodia
(archivo a prueba de manipulación). El proyecto **no afirma en ningún caso
que EAD Trust firme, envíe ni entregue** documentos con validez de firma
electrónica cualificada; las preguntas de este cuaderno sobre EAD Trust son
para aclarar, con el propio proveedor y con criterio jurídico, qué cubre
exactamente el contrato y qué puede o no acreditarse con lo que hoy hace.

---

## Índice por prioridad

Primero lo que tiene fecha en 2026 o bloquea más issues; después el resto por
bloque temático.

| # | Pregunta | Issue | Por qué va primero |
|---|---|---|---|
| 1-4 | Cuestionario de calificación IA v2 (importador/distribuidor, modificación/finalidad, art. 27, capítulo V) | MOI-172 | Fecha límite interna **13-11-2026**; bloquea el cuestionario v2 completo |
| 5-6 | Ayudas del cuestionario IA y proveedor posterior | MOI-166 | Alta prioridad; bloquea la validación del catálogo de medidas por el Comité de IA |
| 7-9 | Citas legales y régimen de fusiones en plantillas | MOI-138 | Alta prioridad; bloquea que se corrijan las plantillas de ARGA y del grupo nuevo |
| 10 | Umbrales de cargos por forma de administración | MOI-219 | Alta prioridad; el cambio **ya está en producción** a la espera de ratificación |
| 11-12 | Comisiones delegadas | MOI-140 | Bloquea 2 issues (reglas de comisión y nueva convocatoria) |
| 13-14 | Qué acredita que una plantilla esté aprobada | MOI-199 | Bloquea la nueva versión de la convocatoria de comisión delegada |
| 15-23 | Nueve preguntas del cierre de la versión española (L3, L5-L12) | MOI-202 | Bloquea que se pueda inscribir, depositar y legalizar desde la aplicación |
| 24-27 | Cómo lee las normas el motor de reglas | MOI-198 | Afecta a la fiabilidad de todos los acuerdos que pasan por el motor |
| 28-29 | Plazo de notificación DORA sin clasificar | MOI-163 | Bloquea que AIMS y GRC usen un único cálculo de plazos |
| 30 | Fecha de aplicación de la sección 5 del capítulo III del RIA | MOI-179 | Sin bloqueo directo, pero afecta al calendario de exigibilidad de varias obligaciones |
| 31 | Encargo de redacción de la nueva convocatoria de comisión delegada | MOI-201 | Bloqueada por las preguntas 11-14; se puede encargar en paralelo |

---

## 1-4. MOI-172 — Cuatro preguntas para calificar sistemas de IA

**Contexto.** El cuestionario que hoy usa la aplicación para calificar un
sistema de inteligencia artificial (si la sociedad es «proveedor» o «responsable
del despliegue») no distingue si la sociedad importa o distribuye un sistema
ajeno, junta en una sola pregunta dos supuestos legales distintos, no dice a
quién alcanza la evaluación de impacto en derechos fundamentales, y asigna un
capítulo del Reglamento europeo de IA (modelos de uso general) también a quien
solo usa el sistema, con una nota de «pendiente del equipo legal». Hay ya una
versión mejorada del cuestionario preparada en una rama de trabajo separada,
a falta de que el equipo legal valide estos cuatro puntos. El plazo interno
para tener listo el cuestionario nuevo es el **13 de noviembre de 2026**.

### Pregunta 1. ¿Debe el cuestionario preguntar si la sociedad importa o distribuye un sistema de IA ajeno?

Hoy el cuestionario solo puede calificar a alguien como «proveedor» o
«responsable del despliegue»; si la sociedad en realidad importa o distribuye
un sistema de un tercero (arts. 3.6 y 3.7 del Reglamento de IA), el
cuestionario lo avisa en pantalla pero no lo califica.

- **Opción A — Añadir las dos preguntas ya preparadas.** Se podría calificar
  correctamente a un importador o distribuidor. Consecuencia: hay que revisar
  el texto legal exacto de esas dos preguntas antes de activarlas.
- **Opción B — Declarar el límite y no añadir las preguntas.** Es más rápido,
  pero el cuestionario seguirá sin poder calificar a un importador o
  distribuidor; seguiría con el aviso en pantalla.

**Recomendación técnica del agente que redactó el issue:** la opción A.
Según la información revisada hasta ahora, ningún sistema de los dos grupos
piloto (ARGA, el despacho profesional) necesita hoy esta calificación, pero
conviene tenerla lista.

**Se desbloquea:** que el cuestionario v2 pueda calificar correctamente a
importadores y distribuidores (parte del cierre de MOI-172, que bloquea
MOI-173). **Fecha límite:** interna, 13-11-2026 (no viene impuesta por una
norma, la fija el propio plan del proyecto). **Mientras no se responda:** el
cuestionario sigue sin poder calificar a un importador o distribuidor y solo
muestra un aviso.

### Pregunta 2. ¿Deben separarse en dos preguntas distintas la «modificación sustancial» de un sistema y el «cambio de finalidad»?

Hoy una sola pregunta del cuestionario junta dos supuestos legales distintos
del Reglamento de IA (art. 3.23, modificación sustancial; art. 25.1, cambio de
finalidad), de modo que no queda constancia de por qué vía exacta una sociedad
pasa a tener las obligaciones de un proveedor.

- **Opción A — Separarlas en dos preguntas**, como ya prevé la versión nueva
  del cuestionario. Consecuencia: queda constancia exacta de la vía jurídica
  aplicada.
- **Opción B — Mantener una sola pregunta.** Es lo que hay hoy; se sigue sin
  distinguir la vía exacta.

**Recomendación técnica del agente:** la opción A (separarlas).

**Se desbloquea:** igual que la pregunta 1, parte de MOI-172. **Fecha
límite:** interna, 13-11-2026. **Mientras no se responda:** la pregunta
sigue conjunta.

### Pregunta 3. ¿A quién alcanza la obligación de evaluar el impacto en derechos fundamentales (art. 27 del Reglamento de IA)?

El Reglamento de IA exige, en su art. 27, que ciertos responsables del
despliegue de un sistema de alto riesgo evalúen antes su impacto en derechos
fundamentales. Harvey (el asistente jurídico externo consultado por el
proyecto) ya confirmó el 19-09-2026 que el art. 27.1 alcanza al tipo de
aseguradora que representa ARGA en el proyecto (por el anexo III, apartado
5.c: seguros de vida y salud). Falta decidir si también alcanza al despacho
profesional (Garrigues, nombre de trabajo interno) o a otros perfiles.

- **Opción A — Aplicarlo a ARGA por el anexo III 5.c) y no al despacho
  profesional.** Sigue la lectura ya validada por Harvey para el caso ARGA.
- **Opción B — Otra delimitación distinta**, a definir por el Comité.

El issue no trae recomendación técnica para esta pregunta: es una decisión
puramente jurídica.

**Se desbloquea:** parte de MOI-172. **Fecha límite:** interna, 13-11-2026.
**Mientras no se responda:** el cuestionario sigue con la nota «a quién
alcanza lo decide el equipo legal».

### Pregunta 4. ¿A quién alcanza el capítulo de modelos de uso general (arts. 51 a 56)?

El cuestionario asigna hoy ese capítulo del Reglamento de IA también a quien
solo usa el sistema (responsable del despliegue), con una nota de «el alcance
lo decide el equipo legal».

- **Opción A — Marco operativo de trazabilidad para quien solo usa el
  sistema** (recomendado, como ya hace la rama de trabajo del programa RIA).
  Consecuencia: quien solo usa el sistema queda con una obligación de
  seguimiento, no con las obligaciones plenas de un proveedor de modelo.
- **Opción B — No asignar ese capítulo a quien solo usa el sistema.**
  Consecuencia: se retira esa nota y esa obligación de la pantalla de quien
  solo usa el sistema.

**Recomendación técnica del agente:** la opción A.

**Se desbloquea:** parte de MOI-172. **Fecha límite:** interna, 13-11-2026.
**Mientras no se responda:** la nota «el alcance lo decide el equipo legal»
sigue en pantalla.

---

## 5-6. MOI-166 — Ayudas del cuestionario de IA y quién entra en el art. 4

**Contexto.** La rama de trabajo del programa RIA (Reglamento europeo de
Inteligencia Artificial) muestra hoy un aviso de «Provisional, pendiente de
validación» en la pregunta sobre prácticas prohibidas (art. 5) y en cuatro
medidas del catálogo de obligaciones. Harvey ya validó el criterio técnico el
19-09-2026, pero el propio diseño del programa exige, además, que el equipo
legal revise el texto de ayuda de dos preguntas concretas del cuestionario, y
que confirme si un «proveedor posterior» (alguien que modifica sustancialmente
un sistema ajeno y pasa a tener las obligaciones de proveedor) también debe
recibir la obligación de alfabetización en IA del art. 4. **Esta pregunta
está a la espera de que se archive primero, en el repositorio, el dictamen ya
emitido por Harvey (issue MOI-165, aún sin hacer)**; en cuanto esté
archivado, se puede enviar ya el documento a legal.

### Pregunta 5. ¿Son correctos los textos de ayuda de las preguntas sobre prácticas prohibidas (art. 5) y sobre la excepción motivada (art. 6.3)?

Estas dos ayudas explican al usuario, dentro del cuestionario, qué significa
cada pregunta. Harvey ya dio por bueno el criterio de fondo el 19-09-2026,
pero el registro del proyecto exige la revisión final del texto por el equipo
legal antes de retirar el aviso de «provisional».

- **Opción A — Aprobar el texto tal cual está.** Se retira el aviso de
  «provisional» en cuanto se documente la aprobación.
- **Opción B — Corregir el texto.** Se aplica la corrección y se prueba de
  nuevo antes de retirar el aviso.

El issue no trae una recomendación técnica sobre el contenido del texto en
sí (es jurídico); sí dice que Harvey «valida criterio, no sustituye esa
revisión».

**Se desbloquea:** que se pueda retirar el aviso de «provisional» de la
pregunta de prácticas prohibidas y de cuatro medidas del catálogo; y que
MOI-167 (el Comité de IA valida el catálogo completo de medidas) pueda
empezar. **Fecha límite:** no tiene fecha propia; depende del ritmo del
programa RIA (hito M3, con otras fechas de 2026 dentro del mismo programa).
**Mientras no se responda:** el aviso de «provisional» sigue en pantalla.

### Pregunta 6. ¿Debe el «proveedor posterior» recibir también la obligación de alfabetización en IA (art. 4)?

El art. 3.68 del Reglamento de IA define al proveedor posterior (quien
modifica sustancialmente un sistema ajeno) como proveedor de un sistema, y el
art. 4 vincula a los proveedores de sistemas. El equipo que preparó el
programa aplicó esa lectura por defecto, pero pide que el equipo legal la
confirme antes de darla por buena.

- **Opción A — Mantener al proveedor posterior dentro de la obligación del
  art. 4**, como está hoy. Consecuencia: se sigue la lectura literal del art.
  3.68; es la opción que ya aplica el sistema.
- **Opción B — Retirar al proveedor posterior de esa obligación.**
  Consecuencia: es un cambio pequeño en el código, pero podría dejar sin
  cubrir una obligación real si la lectura de la opción A es la correcta.

**Recomendación técnica del agente:** mantenerlo (opción A), «porque
quitarlo escondería una obligación si la lectura es correcta (el módulo
falla abierto, es decir, prefiere pedir de más a esconder una obligación)».

**Se desbloquea:** junto con la pregunta 5, permite cerrar MOI-166 y avanzar
a MOI-167. **Fecha límite:** igual que la pregunta 5, ligada al ritmo del
programa RIA. **Mientras no se responda:** el sistema sigue tratando al
proveedor posterior como sujeto al art. 4, sin confirmación jurídica.

---

## 7-9. MOI-138 — Citas y regímenes legales en plantillas y reglas

**Contexto.** Varias plantillas de documentos y reglas vigentes del motor
societario citan normas que pueden estar mal aplicadas o derogadas. En ARGA,
4 plantillas citan un reglamento de seguros (RD 84/2015) como si desarrollara
la Ley 20/2015 de aseguradoras, cuando no es así; 8 plantillas llevan en su
pie de firma variables técnicas de EAD Trust que sugieren una firma o sello
que el proyecto no afirma tener; 9 packs de reglas fijan plazos citando un
artículo del Reglamento del Registro Mercantil que en realidad regula la
competencia territorial de los registradores (no plazos), y 7 citan otro
artículo del mismo reglamento de forma también dudosa; 3 materias siguen
nombrando una ley ya derogada. Además, las plantillas de fusión reconocen a
los acreedores un «derecho de oposición» que una norma de 2023 sustituyó por
«garantías adecuadas». Estos mismos defectos se copiaron ya al grupo de
prueba nuevo que se está montando desde cero, y seguirán copiándose a
cualquier grupo nuevo que se cree después mientras no haya un criterio fijado.

### Pregunta 7. ¿Cuál es la cita y el plazo correctos en cada plantilla y regla afectada, y hay alguna tan errónea que deba retirarse de uso mientras se corrige?

Afecta a: 4 plantillas con la cita al reglamento de seguros de 2015; 1
plantilla con una cita dudosa de la ley de aseguradoras (art. 14); 9 versiones
de reglas con un artículo del Reglamento del Registro Mercantil que en
realidad no regula plazos, sino competencia territorial; 7 con otro artículo
del mismo reglamento también puesto en duda; y 3 materias que nombran una ley
derogada.

- **Opción A — Corregir cada una con una versión nueva de la plantilla o
  regla**, sin tocar la que está en uso hasta que la nueva esté lista.
  Consecuencia: es el camino más ordenado, pero exige revisar cada una.
- **Opción B — Retirar de uso las afectadas hasta que se revisen.**
  Consecuencia: es más rápido de aplicar, pero deja esas materias sin
  plantilla disponible mientras tanto.

**Recomendación técnica del agente:** corregir con versión nueva, y retirar
de uso solo la que tenga un plazo materialmente erróneo (es decir, no todas
por igual).

**Se desbloquea:** que MOI-139 pueda corregir las citas en ARGA y evitar que
el grupo nuevo las siga heredando. **Fecha límite:** no tiene fecha propia
en el issue. **Mientras no se responda:** los documentos de ARGA y del grupo
nuevo siguen saliendo con esas citas.

### Pregunta 8. ¿Qué se hace con las variables de firma o sello de EAD Trust que aparecen en el pie de 8 plantillas?

Esas variables, cuando se rellenan, dejan en el documento un texto que puede
sugerir que EAD Trust ha firmado o sellado el documento, lo cual excede lo que
el contrato vigente con EAD Trust cubre hoy (interposición, mensajería básica
y custodia — nunca firma).

- **Opción A — Retirarlas sin más.** Consecuencia: esas actas (entre ellas,
  las únicas plantillas de acta de acuerdo sin reunión, de socio único, de
  administradores solidarios y de co-aprobación) se quedan sin ningún bloque
  de firma o cierre.
- **Opción B — Sustituirlas por un texto de interposición o custodia** que
  no sugiera firma. Consecuencia: las actas conservan un cierre, pero con un
  texto ajustado a lo que el contrato realmente cubre.
- **Opción C — Mantenerlas con una nota aclaratoria.** Consecuencia: es la
  más rápida, pero deja el texto original con una advertencia añadida, no
  corregido.

**Recomendación técnica del agente:** la opción B (sustituirlas), porque
encaja con la política ya fijada sobre EAD Trust y evita dejar esas actas
sin ningún bloque de cierre.

**Se desbloquea:** igual que la pregunta 7, permite a MOI-139 corregir ARGA y
el grupo nuevo. **Fecha límite:** no tiene fecha propia. **Mientras no se
responda:** las 8 plantillas de ARGA (y sus copias en el grupo nuevo) siguen
con esas variables.

### Pregunta 9. ¿Cómo debe quedar redactado el régimen de garantías de los acreedores en las plantillas de fusión?

Las plantillas de fusión reconocen hoy a los acreedores un «derecho de
oposición», régimen que una norma de 2023 (Real Decreto-ley 5/2023) sustituyó
por un régimen de «garantías adecuadas». Afecta a 4 plantillas de ARGA y a 4
copiadas al grupo nuevo.

- **Opción A — Reescribir el texto al régimen de garantías vigente.**
  Consecuencia: el texto queda alineado con la norma actual; es el texto que
  llega literalmente al documento final.
- **Opción B — Mantener el texto actual con una nota de revisión.**
  Consecuencia: más rápido, pero el documento sigue citando un régimen ya
  sustituido.

**Recomendación técnica del agente:** la opción A (reescribir), «porque es
el texto que llega al documento».

**Se desbloquea:** igual que las preguntas 7 y 8. **Fecha límite:** no
tiene fecha propia. **Mientras no se responda:** las plantillas de fusión de
ARGA y del grupo nuevo siguen citando el régimen derogado.

---

## 10. MOI-219 — Umbrales de cargos por forma de administración (cambio ya aplicado en producción)

**Contexto.** El pasado 25-09-2026 se desplegó ya en producción un cambio que
permite dar por completa la constitución de una sociedad según su forma de
administración: Administrador Único (exige 1 cargo activo), Administradores
Solidarios o Mancomunados (exigen 2 o más cargos activos cada uno) y Consejo
de Administración (exige 2 o más cargos, incluyendo presidente y secretario).
Antes, cualquier sociedad sin Consejo quedaba bloqueada aunque tuviera
correctamente nombrados sus cargos. El cambio ya se probó con dos filiales
reales del grupo de prueba y funciona técnicamente, pero una revisión
independiente detectó que **los umbrales concretos los fijó el equipo técnico
con el respaldo de una herramienta de revisión automática (no del Comité
Legal)**, y que el umbral del Consejo (2 cargos) no sigue el umbral general de
3 miembros del art. 242 de la Ley de Sociedades de Capital para los órganos
colegiados.

### Pregunta 10. ¿Son correctos los umbrales mínimos de cargos por cada forma de administración, incluyendo el del Consejo?

Los umbrales aplicados hoy en producción son: Administrador Único = 1 cargo;
Administradores Solidarios = 2 o más; Administradores Mancomunados = 2 o más;
Consejo de Administración = 2 o más (no 3, que es el umbral general del art.
242 LSC para que un órgano se considere colegiado). Además, un mismo tipo de
cargo («Administrador persona jurídica») cuenta para cualquiera de las cuatro
formas.

- **Opción A — Ratificar los umbrales tal como están aplicados.**
  Consecuencia: no hay que tocar nada más; el criterio queda confirmado con
  efecto retroactivo sobre lo ya aplicado.
- **Opción B — Corregir alguno de los umbrales** (por ejemplo, exigir 3
  cargos para el Consejo, como marca el art. 242 LSC). Consecuencia: haría
  falta una nueva versión del cambio técnico y volver a revisar qué
  sociedades cumplen o no con el umbral corregido.

El issue no trae una recomendación jurídica propia: el respaldo que tiene hoy
es el de una herramienta de revisión automática, no un criterio del Comité
Legal, y la propia auditoría interna señala expresamente que «esto lo decide
el Comité Legal».

**Se desbloquea:** la ratificación (o corrección) formal de un cambio que
ya está funcionando en producción, y que hoy carece de autorización expresa
y de esta ratificación jurídica pendiente. **Fecha límite:** no tiene fecha
propia, pero el cambio ya está en vivo, por lo que conviene resolverlo
pronto. **Mientras no se responda:** el sistema sigue aplicando estos
umbrales sin ratificación jurídica expresa; no hay ninguna pantalla en la
aplicación para volver a comprobar una sociedad que quedase incompleta
antes de este cambio (solo se hizo por script en las dos sociedades de
prueba).

---

## 11-12. MOI-140 — Comisiones delegadas del Consejo

**Contexto.** El motor de reglas del proyecto tiene hoy reglas propias para
la Junta General, el Consejo de Administración, el socio único y una
tramitación interna sin órgano, pero **ninguna regla propia para las
comisiones delegadas** del Consejo (auditoría, riesgos, nombramientos,
retribuciones, etc.). Cuando una comisión delegada adopta un acuerdo, el
sistema le aplica hoy la regla de otro órgano y solo avisa de ello (así
ocurrió en 2 de 37 acuerdos revisados en julio de 2026). Además, la plantilla
de acta de comisión delegada que se copió al grupo de prueba nuevo dice en su
propio texto que el voto de calidad no rige en las comisiones porque así lo
establece el Reglamento del Consejo de ARGA — lo cual podría ser una norma
interna de ARGA, no una regla de aplicación general.

### Pregunta 11. ¿Qué materias son delegables a una comisión (art. 249 bis LSC), de dónde salen su quórum y su mayoría, y una discrepancia de órgano debe bloquear o solo avisar?

- **Opción A — Reglas propias por cada comisión.** Consecuencia: exacto,
  pero exige más trabajo de redacción.
- **Opción B — Declarar supletorio el régimen general del Consejo.**
  Consecuencia: más rápido de aplicar, pero es en sí mismo un criterio
  jurídico (no una solución técnica neutra).

El issue no trae recomendación técnica: «las dos son criterio jurídico del
Comité y el agente no lo fabrica».

**Se desbloquea:** MOI-141 (cargar las reglas de comisión) y MOI-201 (la
nueva versión de la convocatoria de comisión delegada). **Fecha límite:** no
tiene fecha propia. **Mientras no se responda:** los acuerdos de comisión
delegada se siguen evaluando con la regla de otro órgano, con un aviso.

### Pregunta 12. ¿El voto de calidad de la plantilla de acta de comisión delegada es derecho común, una regla propia de ARGA, o algo configurable por cada grupo?

- **Opción A — Derecho común.** Consecuencia: se retira el aviso de la
  plantilla; se aplica igual a todos los grupos.
- **Opción B — Regla propia de ARGA.** Consecuencia: esa plantilla sale del
  paquete base con el que nacen los grupos nuevos, y la copia que ya tiene el
  grupo de prueba se archiva (nunca se borra).
- **Opción C — Configurable por cada grupo.** Consecuencia: exige más
  trabajo técnico, pero cada grupo puede fijar su propia regla.

El issue no trae recomendación técnica: «no hay base para recomendar […] es
criterio jurídico del Comité».

**Se desbloquea:** igual que la pregunta 11. **Fecha límite:** no tiene
fecha propia; el programa de alta de nuevos grupos imprime un aviso sobre
esta plantilla cada vez que se ejecuta, mientras no se decida. **Mientras no
se responda:** la plantilla sigue vigente en el grupo de prueba con el
aviso.

---

## 13-14. MOI-199 — Qué acredita que una plantilla de documento esté aprobada

**Contexto.** De las 72 plantillas de documentos hoy vigentes en ARGA, solo
31 coinciden con el texto que se selló en el momento de aprobarlas: en 26 el
texto no coincide con lo sellado y 15 no tienen ningún sello de aprobación.
Además, el campo que debería decir quién aprobó cada plantilla no identifica
a ninguna persona real en la mayoría de los casos: en su lugar figura un
marcador de demostración. Un cambio de base de datos del 20 de julio de 2026
volvió a sellar 20 plantillas tras retocar su texto, sin que mediara ninguna
decisión del Comité Legal sobre si eso era correcto.

### Pregunta 13. ¿Qué debe acreditar que una plantilla de documento está aprobada, y qué se hace con las 72 vigentes hoy?

- **Sobre quién aprueba:** ¿un órgano colegiado o una persona identificada?,
  ¿se exige que además firme con firma electrónica cualificada? El issue no
  trae propuesta: es criterio jurídico sin recomendación en la fuente.
- **Sobre las 72 vigentes:**
  - **Opción A — Volver a aprobarlas con una persona identificada.**
    Consecuencia: cierre limpio, pero exige tiempo del Comité.
  - **Opción B — Archivarlas y emitir una versión nueva de cada una.**
    Consecuencia: trazable, pero con más volumen de trabajo.
  - **Opción C — Vigencia condicionada, marcada en pantalla hasta que se
    revisen.** Consecuencia: rápida y honesta con el usuario, pero no cierra
    formalmente el expediente.
  - **Opción D — Volver a sellar solo las que cambiaron de texto.**
    Consecuencia: rápido, pero equivale a dar por aprobado el texto actual
    sin que nadie lo haya revisado de nuevo.

**Recomendación técnica del agente:** aplicar ya la opción C (vigencia
condicionada y marcada) y, en paralelo, ir haciendo la opción A por lotes de
materias principales, «porque no frena la demostración ni afirma lo que no
hay».

**Se desbloquea:** MOI-201 (nueva versión de la convocatoria de comisión
delegada, que necesita saber qué aprobación vale). **Fecha límite:** no
tiene fecha propia. **Mientras no se responda:** las plantillas de ARGA no
pueden sanearse ni presentarse como aprobadas de forma fiable.

### Pregunta 14. ¿Qué se hace con las plantillas cuyo texto cambió después de aprobarse, y todo cambio de texto obliga a una versión nueva?

Un cambio de base de datos de julio de 2026 modificó el texto de 20
plantillas ya aprobadas y volvió a sellarlas automáticamente, sin que el
Comité decidiera si eso era correcto.

- **Opción A — Volver a sellar** el hash con el texto actual. Consecuencia:
  rápido, pero equivale a declarar aprobado el texto de hoy sin revisión.
- **Opción B — Volver a aprobar** formalmente cada una. Consecuencia: más
  lento, pero con respaldo jurídico real.
- **Opción C — Archivarlas** y emitir una nueva versión revisada.
  Consecuencia: más trazable, más trabajo.

El issue no trae recomendación específica para esta sub-pregunta más allá de
lo ya dicho en la pregunta 13.

**Se desbloquea:** igual que la pregunta 13. **Fecha límite:** no tiene
fecha propia. **Mientras no se responda:** el re-sellado de julio de 2026
queda sin ratificar.

---

## 15-23. MOI-202 — Nueve preguntas pendientes del cierre de la versión española

**Contexto.** El plan de cierre del producto para sociedades españolas, de
julio de 2026, dejó doce preguntas abiertas para el Comité Legal. Las
preguntas L1, L2 (aprobación de plantillas) van en MOI-199, y la L4
(comisiones delegadas) va en MOI-140. Las nueve restantes —L3, L5 a L12— no
tienen respuesta todavía y bloquean, entre otras cosas, que se pueda inscribir
un acuerdo, depositar cuentas o legalizar libros desde la propia aplicación.
Algunas de estas preguntas (L9 y L10) deben plantearse ya conforme a la
política vigente desde julio de 2026 sobre EAD Trust: el proveedor solo hace
de intermediario, mensajería básica y custodia — nunca firma.

### Pregunta 15 (L3). ¿Cuáles son los subtipos de cese de administrador, de disolución y de modificación estructural, quién los declara y en qué momento del proceso?

Contexto: el catálogo de materias societarias necesita distinguir, por
ejemplo, los distintos motivos de disolución (arts. 368, 363.1.e y 363.1.f de
la Ley de Sociedades de Capital) para aplicar la regla correcta a cada uno.

El issue no detalla opciones concretas para esta pregunta; el equipo legal
decide libremente sobre los subtipos y quién los declara.

**Se desbloquea:** parte del cierre legal de MOI-202, que a su vez desbloquea
MOI-203. **Fecha límite:** no tiene fecha propia. **Mientras no se
responda:** el catálogo de materias sigue sin estos subtipos diferenciados.

### Pregunta 16 (L5). ¿Necesitan reglas propias, o basta el régimen general del Consejo (arts. 247.2 y 248 LSC), las materias de Financiación, Contratación relevante, Comités internos, Políticas corporativas y Seguros de responsabilidad?

- **Opción A — Pack de reglas propio para cada una.** Más preciso, más
  trabajo.
- **Opción B — Régimen general del Consejo, declarado supletorio.** Más
  rápido, pero es en sí mismo un criterio jurídico.

El issue no trae recomendación técnica.

**Se desbloquea:** igual que la pregunta 15. **Fecha límite:** no tiene
fecha propia. **Mientras no se responda:** estas cinco materias siguen sin
regla propia asignada.

### Pregunta 17 (L6). ¿Se ratifican las correcciones de quórum y mayoría aplicadas en junio de 2026 sin firma del Comité?

En junio de 2026 se corrigieron, como corrección de un error de hecho
contrastado directamente contra el BOE (sin pasar por el Comité Legal): el
quórum de la Sociedad Limitada, la mayoría reforzada de la Sociedad Anónima
(art. 201.2 LSC), la mayoría del Consejo (arts. 248.1 y 249.3 LSC), la
mayoría de la Sociedad Limitada (art. 198 LSC), y el criterio del «borde» del
50% en el art. 201.2.

- **Opción A — Ratificar las correcciones tal como se aplicaron.**
  Consecuencia: queda cerrado el expediente y el motor puede empezar a leer
  la mayoría directamente de las reglas guardadas (ver pregunta 24, en
  MOI-198) en lugar de deducirla.
- **Opción B — Corregir de nuevo alguna de ellas.** Consecuencia: haría
  falta una nueva revisión técnica de esa regla concreta.

El issue no trae recomendación jurídica propia sobre el contenido; sí señala
que la lectura de mayoría del motor (pregunta 24, MOI-198) depende de esta
ratificación.

**Se desbloquea:** que el motor de reglas pueda leer la mayoría directamente
de las reglas guardadas en vez de deducirla (condiciona la pregunta 24 de
MOI-198). **Fecha límite:** no tiene fecha propia. **Mientras no se
responda:** el motor sigue mostrando una mayoría deducida, marcada como tal.

### Pregunta 18 (L7). Disolución y liquidación: ¿perfil de materia propio o flujo posterior al acuerdo? ¿Cómo se resuelve la contradicción entre el catálogo (que exige unanimidad, art. 374 LSC) y la regla activa (que aplica el art. 199.a)?

El catálogo de materias del sistema dice que la disolución exige unanimidad
(art. 374 LSC), pero la regla que hoy está activa en la práctica aplica el
art. 199.a (una mayoría distinta). Es una contradicción interna que necesita
un criterio del Comité para resolverse.

El issue no detalla opciones concretas más allá de señalar la contradicción;
corresponde al Comité decidir cuál de las dos lecturas es la correcta, o si
disolución y liquidación necesitan un perfil de materia propio en el
catálogo.

**Se desbloquea:** igual que las anteriores de MOI-202. **Fecha límite:** no
tiene fecha propia. **Mientras no se responda:** la contradicción entre el
catálogo y la regla activa sigue sin resolver.

### Pregunta 19 (L8). En la calificación de un expediente por el Registro Mercantil: ¿cómo se distingue una denegación de una suspensión por defectos subsanables?, ¿qué familia de códigos de defecto debe usarse?, ¿la inscripción debe hacer avanzar automáticamente el acuerdo a «registrado»?

Dos códigos de defecto que usa hoy el sistema (identificados como «RRM-58» y
«RM-201») fueron creados por una migración técnica interna, sin que conste
que correspondan a una clasificación oficial del Registro Mercantil.

El issue no detalla opciones concretas; es una pregunta de clasificación
técnico-jurídica que el Comité debe fijar desde cero.

**Se desbloquea:** MOI-203 (que un expediente pueda llegar a «inscrito» desde
la propia aplicación) necesita específicamente esta respuesta (junto con la
pregunta 21, L10). **Fecha límite:** no tiene fecha propia, pero es una de
las dos preguntas de las que depende directamente MOI-203. **Mientras no se
responda:** el sistema mantiene, por precaución, la regla de no generar
automáticamente la fila «denegada» con el código RRM-58 inventado.

### Pregunta 20 (L9). ¿Es oponible ante el Registro Mercantil, para actas y certificaciones, la interposición del proveedor tecnológico (EAD Trust), y qué denominación debe mostrarse?

**Precisión importante:** esta pregunta no da por hecho que EAD Trust firme
nada. Pregunta si el hecho de que EAD Trust actúe como intermediario técnico
en el envío o custodia de un documento es, de cara al Registro Mercantil,
compatible con que ese documento sirva como acta o certificación, y con qué
nombre debe presentarse esa intermediación en el propio documento.

El issue no detalla opciones concretas; es puramente jurídico y debe
plantearse conforme a la política vigente desde julio de 2026 (EAD Trust
solo hace interposición, mensajería básica y custodia).

**Se desbloquea:** igual que la pregunta 19, contribuye al cierre general de
MOI-202. **Fecha límite:** no tiene fecha propia. **Mientras no se
responda:** no se afirma nada sobre la validez de la interposición ante el
Registro Mercantil.

### Pregunta 21 (L10). ¿Qué justificante de EAD Trust basta para dar por definitivamente custodiado (no solo de prueba) un documento?

**Precisión importante:** esta pregunta tampoco da por hecho que EAD Trust
firme. Pregunta qué tipo de comprobante o certificado, de los que emite EAD
Trust por su labor de custodia, sería suficiente para que el sistema deje de
mostrar el aviso de «entorno de validación funcional, sin eficacia jurídica
cualificada productiva» sobre un documento concreto. **Esta pregunta necesita
antes la confirmación contractual y técnica que se pide por separado a EAD
Trust** (en el issue relacionado MOI-216, no incluido en este cuaderno);
mientras esa confirmación no llegue, esta pregunta debe esperar.

El issue no detalla opciones concretas: depende de lo que EAD Trust confirme
que puede certificar contractualmente.

**Se desbloquea:** MOI-203 (junto con la pregunta 19, L8) necesita esta
respuesta para que un expediente pueda llegar a «inscrito», «depositado» o
«legalizado» operando la propia aplicación. **Fecha límite:** no tiene fecha
propia; está encadenada a la respuesta de EAD Trust (MOI-216). **Mientras no
se responda:** ningún documento puede marcarse como definitivamente
custodiado, y por tanto ningún expediente puede avanzar a esos tres estados
finales desde la aplicación.

### Pregunta 22 (L11). ¿Sigue vigente un cargo (por ejemplo, un consejero) cuyo mandato ya venció, hasta la siguiente Junta, y computa ese cargo caducado en el quórum?

Se trata de aplicar los arts. 222 de la Ley de Sociedades de Capital y 145
del Reglamento del Registro Mercantil.

- **Opción A — El cargo sigue vigente hasta la siguiente Junta.**
  Consecuencia: computa en el quórum mientras tanto.
- **Opción B — El cargo se extingue automáticamente al vencer el mandato.**
  Consecuencia: no computa en el quórum desde ese momento.

El issue no trae recomendación técnica; sí indica que, mientras no haya
respuesta, el sistema **no** cierra automáticamente ningún cargo por fecha de
fin (precaución ya aplicada).

**Se desbloquea:** una señal en pantalla para cargos caducados, y evita el
riesgo de contar mal el quórum de un órgano con cargos vencidos. **Fecha
límite:** no tiene fecha propia. **Mientras no se responda:** ningún cargo se
cierra automáticamente por vencimiento; el sistema no toma partido.

### Pregunta 23 (L12). ¿Qué acredita la legalización de los libros societarios y qué constituye un «asiento» en cada libro?

Contexto: el módulo de libros obligatorios necesita saber, para cada tipo de
libro, qué se considera prueba de legalización y qué cuenta exactamente como
un asiento registrado.

El issue no detalla opciones; es una definición técnico-jurídica de base que
el Comité debe fijar.

**Se desbloquea:** una tarea técnica de libros y su legalización (a definir
tras la respuesta). **Fecha límite:** no tiene fecha propia. **Mientras no
se responda:** el módulo de libros sigue con su criterio actual, sin
confirmación jurídica de qué es un asiento válido.

---

## 24-27. MOI-198 — Cómo debe leer y aplicar las normas el motor de reglas

**Contexto.** Mientras el Comité Legal no decide, el motor de reglas de
Secretaría aplica hoy cuatro soluciones deliberadamente prudentes: (1)
**no** lee la mayoría que ya está guardada dentro de cada regla, y en su
lugar la deduce y la marca en pantalla como «deducida»; (2) si falta la
regla del órgano exacto que adopta un acuerdo, usa la de otro órgano y solo
avisa (ocurrió en 8 de 37 acuerdos revisados en julio de 2026); (3) quedan
abiertos tres criterios de fondo sobre cómo leer ciertas reglas (ver pregunta
26); y (4) nada distingue hoy si una norma es imperativa (no se puede
cambiar por estatutos o pacto) o dispositiva (sí se puede cambiar).

### Pregunta 24. ¿Debe el motor leer la mayoría directamente de la regla guardada, o seguir mostrando la deducida?

- **Opción A — Leerla de la regla.** Más preciso; requiere corregir primero
  la forma en que el sistema busca ese dato dentro de la regla (hoy no lo
  encuentra porque está guardado en un nivel más profundo del que el sistema
  consulta).
- **Opción B — Mantener la deducida**, marcada como tal. Es lo que hay hoy.

**Recomendación técnica del agente:** leerla de la regla, pero solo cuando
el Comité ratifique primero las correcciones de mayoría de junio de 2026
(pregunta 17, MOI-202, L6), porque de esa ratificación depende que la
mayoría guardada sea la correcta.

**Se desbloquea:** que los abogados que usan Secretaría vean la mayoría real
en lugar de una deducida. **Fecha límite:** no tiene fecha propia; depende
de la respuesta a la pregunta 17. **Mientras no se responda:** el sistema
sigue mostrando una mayoría deducida, marcada como tal.

### Pregunta 25. Cuando falta la regla del órgano exacto y se usa la de otro órgano, ¿debe eso bloquear la tramitación, solo avisar, o solo informar sin más?

- **Opción A — Bloquear.** Más seguro, pero dejaría hoy sin ninguna
  asistencia a las comisiones delegadas, que no tienen reglas propias (ver
  MOI-140).
- **Opción B — Avisar** (como ahora), con un mensaje visible en dos puntos
  del proceso. Permite seguir tramitando, con constancia del aviso.
- **Opción C — Solo informar**, sin destacarlo especialmente.

**Recomendación técnica del agente:** mantener el aviso (opción B) «hasta que
haya reglas de comisión delegada» (es decir, hasta que se resuelva la
pregunta 11, MOI-140), porque bloquear dejaría sin asistencia a las
comisiones.

**Se desbloquea:** una decisión estable sobre este punto, hoy dejado
deliberadamente abierto por diseño. **Fecha límite:** no tiene fecha propia.
**Mientras no se responda:** el sistema sigue avisando, sin bloquear.

### Pregunta 26. Tres criterios de fondo pendientes:

1. **Art. 308 LSC** — ¿la supresión y la exclusión del derecho de
   preferencia en una ampliación de capital son la misma materia o dos
   materias jurídicas distintas? (Hoy el sistema las trata como distintas,
   como medida de prudencia.) De esto depende, en concreto, un aumento de
   capital ya adoptado en el despacho profesional con datos simulados.
2. **Plantillas sin órgano, forma de adopción o tipo social especificado**
   — ¿vale una plantilla así para cualquier órgano, forma o tipo social, o
   solo para uno concreto que haya que identificar caso por caso?
3. **Socio único (art. 15 LSC)** — ¿equivale exactamente a la Junta General
   a todos los efectos, o hay diferencias de tratamiento?

**Recomendación técnica del agente:** empezar por el art. 308, porque de él
depende un caso real ya adoptado.

El issue no ofrece opciones cerradas para estas tres: pide un criterio
expreso del Comité en cada una, o la constancia de que se mantiene el
tratamiento actual (más prudente) mientras no haya criterio.

**Se desbloquea:** certeza jurídica sobre tres puntos hoy resueltos de forma
deliberadamente conservadora en el código. **Fecha límite:** no tiene fecha
propia. **Mientras no se responda:** el sistema mantiene el tratamiento
actual (las tres materias distintas, sin equiparaciones automáticas).

### Pregunta 27. ¿Se elabora una matriz completa de qué normas son imperativas y cuáles dispositivas, o se empieza solo por las 14 materias principales, dejando el resto «sin clasificar»?

- **Opción A — Matriz completa.** Más trabajo de análisis normativo previo.
- **Opción B — Matriz parcial de las 14 materias principales**, con el
  resto explícitamente «sin clasificar» en pantalla.

**Recomendación técnica del agente:** la opción B (parcial), porque
desbloquea ya una funcionalidad de la interfaz pendiente desde julio de 2026
sin necesidad de inventar un criterio para el resto.

**Se desbloquea:** una funcionalidad de la interfaz (un indicador visual)
que lleva bloqueada desde julio de 2026 a la espera exactamente de esta
matriz. **Fecha límite:** no tiene fecha propia. **Mientras no se responda:**
esa funcionalidad sigue sin activarse.

---

## 28-29. MOI-163 — Plazo de notificación DORA cuando el incidente aún no está clasificado

**Contexto.** El módulo de gobernanza de IA y el módulo de riesgos y
cumplimiento (GRC) calculan cada uno, por separado, el plazo para notificar a
la autoridad un incidente tecnológico según el Reglamento DORA, y no
coinciden cuando el incidente todavía no tiene clasificación de gravedad: uno
fija el plazo a las 4 horas desde que se conoce el incidente; el otro pone un
tope de 24 horas y solo cuenta las 4 horas desde que el incidente se
clasifica. La diferencia entre ambos criterios es de 20 horas en un aviso
que va a una autoridad supervisora. Además, la ficha de incidente del módulo
GRC afirma, sin citar el artículo exacto, que el Reglamento Delegado (UE)
2025/301 obliga a presentar una notificación motivada si el informe
intermedio o final no llega a tiempo.

### Pregunta 28. Cuando un incidente todavía no está clasificado, ¿el plazo de notificación inicial son 4 horas desde que se conoce el incidente, o un tope de 24 horas con 4 horas desde que se clasifica?

- **Opción A — 4 horas desde que se conoce el incidente.** Lectura más
  conservadora, pero adelanta un plazo que la norma liga expresamente a la
  clasificación.
- **Opción B — Tope de 24 horas, y 4 horas desde que se clasifica.** Lectura
  más pegada a la letra de la norma.

**Recomendación técnica del agente:** la opción B, avisando en pantalla de
que clasificar el incidente activa entonces las 4 horas.

**Se desbloquea:** MOI-215, que unifica en un solo cálculo el plazo que
hoy dan por separado el módulo de IA y el de riesgos. **Fecha límite:**
regulatoria en su origen (art. 19 del Reglamento DORA y su Reglamento
Delegado), pero sin plazo interno fijado para responder. **Mientras no se
responda:** cada pantalla sigue dando su propia fecha, con 20 horas de
diferencia entre ambas.

### Pregunta 29. ¿En qué artículo y apartado del Reglamento Delegado (UE) 2025/301 consta —si consta— la obligación de presentar una notificación motivada cuando el informe de un incidente no llega a tiempo, cotejado en el texto oficial vigente?

La ficha de incidente del módulo GRC afirma hoy esta obligación sin citar
artículo, cotejada contra el texto oficial de la norma consolidada
(EUR-Lex).

El issue no da opciones: pide el cotejo exacto (el artículo y apartado, o la
constancia de que esa obligación no figura en el reglamento) con la fecha de
la versión consolidada que se haya consultado.

**Se desbloquea:** igual que la pregunta 28, permite corregir la frase de la
ficha de incidente con su cita exacta o retirarla si no procede. **Fecha
límite:** no tiene fecha propia. **Mientras no se responda:** la ficha sigue
con la frase sin cita.

---

## 30. MOI-179 — Desde cuándo se aplica la sección 5 del capítulo III del Reglamento de IA

**Contexto.** De nueve puntos del Reglamento «Ómnibus» de la UE (que aplazó
varias fechas del Reglamento de IA) que se cotejaron uno por uno contra el
texto oficial el 19-09-2026, ocho quedaron verificados y uno sigue
pendiente. La letra c) del art. 113 del Reglamento de IA aplaza la aplicación
del capítulo sobre sistemas de alto riesgo, pero no menciona expresamente la
sección 5 de ese capítulo (arts. 40 a 49: evaluación de la conformidad,
declaración UE, marcado CE y registro). Formalmente, por tanto, esa sección 5
seguiría aplicándose desde la fecha general (2 de agosto de 2026); pero sus
obligaciones solo tienen sentido práctico sobre sistemas ya clasificados como
de alto riesgo, y esa clasificación sí está aplazada.

### Pregunta 30. ¿Desde cuándo se aplica la sección 5 del capítulo III (arts. 40 a 49) del Reglamento de IA?

- **Opción A — Se aplica desde la fecha general (2-8-2026), pero queda
  «latente»** porque solo se activa cuando hay clasificación de alto riesgo,
  y esa clasificación está aplazada. Es la lectura provisional que aplica
  hoy el programa, sin que nadie la haya validado formalmente.
- **Opción B — Sigue las fechas aplazadas de la letra c) del art. 113**: 2 de
  diciembre de 2027 para los sistemas del anexo III, y 2 de agosto de 2028
  para los del anexo I.

El issue no trae recomendación: «no hay base para recomendar: la fuente solo
anota la opción A como lectura provisional y la pregunta es jurídica».

**Se desbloquea:** que el catálogo de obligaciones del programa RIA (MOI-171)
pueda fijar con certeza desde cuándo son exigibles los arts. 43, 47, 48 y 49.
No bloquea formalmente a ningún otro issue del proyecto ni tiene fecha límite
propia impuesta por la fuente. **Mientras no se responda:** esas obligaciones
se siguen tratando como «latentes» (aplicables en teoría, pero sin exigencia
práctica).

---

## 31. MOI-201 — Encargo de redacción de la nueva versión de la convocatoria de comisión delegada

**Contexto.** Desde julio de 2026 sigue pendiente redactar una versión
revisada (la 1.2.0) de la plantilla de convocatoria de comisión delegada. Hoy
está vigente la versión 1.1.0 (en ARGA y en el grupo de prueba nuevo) y
archivada la 1.0.0, que se retiró por llevar citas legales incorrectas.
Faltan también las notas y variables explicativas de la 1.1.0, y un historial
de cambios de todo el resto del inventario de plantillas. **Este encargo solo
puede completarse después de que se respondan las preguntas 11-14 de MOI-140
y MOI-199**, porque la nueva versión debe llevar la aprobación que el Comité
diga que vale y las reglas de comisión delegada que fije el Comité pueden
cambiar lo que la convocatoria cite (por ejemplo, plazos y mayorías).

### No es exactamente una pregunta con opciones: es un encargo de redacción.

**Lo que se pide:** que el equipo legal redacte y revise el texto completo
de la versión 1.2.0 de la convocatoria de comisión delegada, incorporando el
criterio que resulte de las preguntas 11 y 12 (MOI-140) y de las preguntas 13
y 14 (MOI-199), y que redacte también las notas y variables explicativas que
faltan de la versión 1.1.0 vigente.

El issue no trae recomendación jurídica (es un encargo de redacción, no una
decisión con opciones); sí incluye una decisión de alcance que corresponde a
Moisés, no al equipo legal: a qué grupos se aplica la nueva versión (ARGA, el
grupo nuevo, o solo el paquete base con el que nacen los grupos futuros).

**Se desbloquea:** que la plantilla de convocatoria de comisión delegada
quede al día con el criterio legal completo. **Fecha límite:** no tiene
fecha propia; depende de que antes se respondan las preguntas 11-14.
**Mientras no se responda (o no se redacte):** la versión 1.1.0 sigue en uso
sin las notas y variables completas, y sin el criterio de comisión delegada
que puedan cambiar plazos o mayorías.

---

## Personas y cuentas

Ninguno de los catorce issues revisados pide designar a una persona concreta
por su nombre real ni crear una cuenta de usuario o de sistema. Donde se
habla de «quién aprueba una plantilla» (pregunta 13, MOI-199) o de «qué
persona certifica» se trata de un criterio general (persona identificada
frente a órgano colegiado), no de nombrar a alguien en concreto. Si en algún
momento el proyecto necesitara crear una cuenta de un tercero (por ejemplo,
para un sistema de firma o de mensajería), esa cuenta tendría que crearla
Moisés o quien tenga el poder para contratar dicho servicio en su nombre —
un agente automático no puede crear cuentas ni contratar servicios por
cuenta del cliente.

---

## Tabla resumen

| Issue | Pregunta (resumen) | Fecha límite | Qué se desbloquea |
|---|---|---|---|
| MOI-172 | 1. Preguntas de importador/distribuidor | Interna, 13-11-2026 | Cuestionario v2 de calificación IA (MOI-173) |
| MOI-172 | 2. Separar modificación sustancial y cambio de finalidad | Interna, 13-11-2026 | Cuestionario v2 |
| MOI-172 | 3. Alcance del art. 27 (impacto en derechos fundamentales) | Interna, 13-11-2026 | Cuestionario v2 |
| MOI-172 | 4. Alcance del capítulo V (modelos de uso general) | Interna, 13-11-2026 | Cuestionario v2 |
| MOI-166 | 5. Ayudas del cuestionario (art. 5 y art. 6.3) | Ligada al programa RIA (M3) | Retirar el rótulo «provisional»; desbloquea MOI-167 (Comité de IA) |
| MOI-166 | 6. Proveedor posterior y art. 4 | Ligada al programa RIA (M3) | Igual que la 5 |
| MOI-138 | 7. Citas y plazos erróneos (RD 84/2015, arts. 17/19 RRM, LME) | Sin fecha propia | Corrección en ARGA y grupo nuevo (MOI-139) |
| MOI-138 | 8. Variables de firma/sello EAD Trust en rótulos | Sin fecha propia | Igual que la 7 |
| MOI-138 | 9. Régimen de garantías del RDLey 5/2023 en fusiones | Sin fecha propia | Igual que la 7 |
| MOI-219 | 10. Umbrales de cargos por forma de administración (ya en producción) | Sin fecha propia, pero urgente por estar ya en vivo | Ratificación de un cambio ya desplegado |
| MOI-140 | 11. Reglas de comisiones delegadas (art. 249 bis LSC) | Sin fecha propia | MOI-141 y MOI-201 |
| MOI-140 | 12. Voto de calidad en la plantilla de acta de comisión | Sin fecha propia | MOI-141 y MOI-201 |
| MOI-199 | 13. Qué acredita la aprobación de una plantilla + qué hacer con las 72 vigentes | Sin fecha propia | MOI-201 |
| MOI-199 | 14. Plantillas cuyo texto cambió tras aprobarse | Sin fecha propia | MOI-201 |
| MOI-202 | 15. Subtipos de cese/disolución/modificación estructural (L3) | Sin fecha propia | Cierre de MOI-202 → MOI-203 |
| MOI-202 | 16. Cinco materias del Consejo: ¿pack propio? (L5) | Sin fecha propia | Igual |
| MOI-202 | 17. Ratificar correcciones de mayoría de junio de 2026 (L6) | Sin fecha propia | Lectura de mayoría del motor (pregunta 24) |
| MOI-202 | 18. Disolución/liquidación: contradicción unanimidad vs. mayoría (L7) | Sin fecha propia | Igual |
| MOI-202 | 19. Calificación registral: denegación vs. suspensión, códigos de defecto (L8) | Sin fecha propia | MOI-203 (inscripción desde la aplicación) |
| MOI-202 | 20. Interposición EAD Trust ante el Registro Mercantil (L9) | Sin fecha propia | Igual |
| MOI-202 | 21. Justificante de EAD Trust para custodia definitiva (L10) | Sin fecha propia; espera confirmación de EAD Trust | MOI-203 |
| MOI-202 | 22. Vigencia de un cargo con mandato vencido (L11) | Sin fecha propia | Señal en pantalla, cómputo correcto del quórum |
| MOI-202 | 23. Qué acredita la legalización de libros (L12) | Sin fecha propia | Tarea técnica de libros |
| MOI-198 | 24. Leer la mayoría de la regla o mantener la deducida | Sin fecha propia; depende de la pregunta 17 | Precisión de la mayoría mostrada |
| MOI-198 | 25. Regla de otro órgano: ¿bloquear, avisar o informar? | Sin fecha propia; depende de la pregunta 11 | Criterio estable del motor |
| MOI-198 | 26. Tres criterios de fondo (art. 308, plantillas sin especificar, socio único) | Sin fecha propia | Certeza jurídica en tres puntos del motor |
| MOI-198 | 27. Matriz de normas imperativas/dispositivas | Sin fecha propia | Activar un indicador visual pendiente desde julio de 2026 |
| MOI-163 | 28. Plazo inicial DORA sin clasificación (4h vs. 24h) | Sin fecha propia; origen regulatorio | MOI-215 (cálculo único) |
| MOI-163 | 29. Cita exacta del Reglamento Delegado 2025/301 | Sin fecha propia | Corregir la ficha de incidente |
| MOI-179 | 30. Fecha de aplicación de la sección 5, cap. III RIA | Sin fecha propia; origen regulatorio | Catálogo de obligaciones del programa RIA (MOI-171) |
| MOI-201 | 31. Encargo: redactar la v1.2.0 de la convocatoria de comisión delegada | Sin fecha propia; espera las preguntas 11-14 | Plantilla al día con el criterio legal completo |
