# Cuaderno de preguntas — Governance OS · Secretaría y AIMS

**Para:** DPO del despacho, Dirección del despacho, y para la propia gestión interna de personas y cuentas del proyecto.

**Cómo usar este cuaderno:** cada bloque trae el contexto necesario, la pregunta exacta y las opciones que ya plantea el issue de origen, con la consecuencia de cada una. Ninguna pregunta lleva una respuesta sugerida de criterio jurídico: donde el issue trae una recomendación, se cita como "recomendación técnica del agente que redactó el issue", que no sustituye el criterio del DPO, de la dirección ni del Comité correspondiente. Puede devolverse tal cual, con las respuestas escritas junto a cada pregunta.

Nota de terminología: "ARGA" es el nombre ficticio (pseudónimo) usado en el proyecto para el grupo asegurador cliente; no es el nombre real de ninguna entidad. Las referencias a EAD Trust se limitan aquí a preguntas contractuales y de dato — este cuaderno no afirma que EAD Trust firme, envíe ni entregue nada.

---

## Índice, por prioridad

Se ordena primero lo que tiene fecha regulatoria en 2026, luego lo que bloquea más issues, y al final lo que no tiene fecha ni bloquea nada.

| # | Bloque | Issue(s) | Motivo de prioridad |
|---|---|---|---|
| 1 | Designación de personas y cuentas — cadena de clasificación RIA | MOI-177 | Prioridad Urgent; fecha **regulatoria** 2-12-2026 (empiezan a aplicar el art. 5.1 b bis/b ter y el art. 50.2); bloquea MOI-217 |
| 2 | Designación de personas y cuentas — cuenta de cumplimiento de ARGA | MOI-153 | Prioridad High; fecha **orientativa** 27-11-2026 (si no existe, entra el "plan B"); bloquea MOI-217; la necesitan además MOI-155 y MOI-177 |
| 3 | Designación de personas y cuentas — persona responsable de cumplimiento de Garrigues | MOI-159 | Prioridad High; bloquea MOI-154; la necesitan además MOI-155 y MOI-177 |
| 4 | Designación de personas y cuentas — segunda persona revisora de Garrigues | MOI-155 | Prioridad High; depende de que MOI-154 esté hecho, que a su vez depende de MOI-159 |
| 5 | (Sin pregunta nueva, ejecución) — reevaluación de Harvey | MOI-154 | Prioridad High; usa las designaciones de MOI-159; bloquea MOI-155 |
| 6 | Designación de personas y cuentas — reclasificación de ARGA | MOI-217 | Prioridad High; depende en cascada de MOI-153, MOI-170, MOI-173 y MOI-177; ventana orientativa 16 al 27-11-2026 |
| 7 | DPO del despacho — EIPD de Harvey | MOI-156 | Prioridad Medium; sin fecha propia, pero condiciona el registro de MOI-154 |
| 8 | Dirección del despacho — ENS, sector público y participación en EAD Trust | MOI-191 | Prioridad Low; sin fecha; no bloquea nada |
| 9 | Decisión interna — tres restos sin dueño en la base de datos | MOI-188 | Prioridad Low; sin fecha; no bloquea nada; incluye un dato personal ajeno retenido |

---

## Sección A — DPO del despacho

### A.1 — MOI-156: ¿Necesita Harvey una evaluación de impacto de protección de datos (EIPD)?

**Contexto.** Harvey es el asistente jurídico de IA que usa el despacho. Hoy existe una sola evaluación de riesgo de Harvey en el sistema, hecha con un catálogo que no le corresponde (el de un proveedor de IA de alto riesgo, no el de quien simplemente usa la herramienta). Esa evaluación no contesta la pregunta sobre si hace falta una EIPD (art. 35 RGPD), y en todo el proyecto no hay ninguna EIPD registrada. Nadie ha medido todavía qué datos personales trata Harvey en el despacho ni con qué alcance. Por ley, esta determinación le corresponde al DPO del despacho como responsable del tratamiento (art. 37 RGPD); el proyecto no puede decidirlo ni suponerlo.

**Pregunta 1.** ¿El uso de Harvey por el despacho requiere una evaluación de impacto relativa a la protección de datos (EIPD), conforme al art. 35.1 y 35.3 RGPD y a la lista de tratamientos que la requieren publicada por la AEPD?

**Opciones que plantea el issue:**
- **a) Sí, se requiere EIPD.** Consecuencia: se hace la EIPD antes de seguir usando Harvey con datos de clientes, y se cita su referencia en la evaluación de Harvey como justificante.
- **b) No se requiere.** Consecuencia: se motiva por escrito esa conclusión, y esa motivación queda registrada en la evaluación de Harvey.

**Recomendación:** el issue no trae una recomendación sobre el sentido de la respuesta (es la decisión propia del DPO); sí recoge que el criterio de que "el riesgo limitado del RIA no exime de EIPD" fue validado por Harvey, consultado como asistente jurídico el 19-09-2026 (recomendación técnica del agente que redactó el issue, apoyada en ese criterio — Harvey valida criterios pero no sustituye la revisión del equipo legal).

**Qué se desbloquea con la respuesta.** El registro de esta determinación (con su motivo, y su justificante si aplica la EIPD) en la evaluación nueva de Harvey, que depende también de que exista esa evaluación (issue MOI-154, bloqueado a su vez por la designación de personas de MOI-159). La determinación del DPO, en cambio, puede darse ya, sin esperar a que esa evaluación exista.

**Fecha límite.** No hay fecha propia (orientativa ni regulatoria) en este issue. Sí condiciona, indirectamente, la cadena MOI-159 → MOI-154 → MOI-155, cuyo resultado final se enmarca en la ventana orientativa de noviembre de 2026 del programa RIA (ver bloques de la Sección C).

**Qué pasa mientras no respondan.** La necesidad de EIPD sigue "pendiente" y la pantalla del producto no puede presentar el tratamiento de Harvey como exento de EIPD "por ser riesgo limitado" — esa afirmación sería incorrecta según el propio criterio validado. Nada más se bloquea ni cambia.

**Quién traslada la pregunta y quién recoge la respuesta:** Moisés identifica al DPO que tenga designado el despacho (o pide que se designe uno si no lo hay) y le lleva la pregunta; la persona responsable de cumplimiento de Garrigues (a designar en MOI-159) registra la respuesta en el sistema cuando llegue.

---

## Sección B — Dirección del despacho (ENS, sector público y participación en EAD Trust)

### B.1 — MOI-191: Categoría ENS, actividad para el sector público y participación en EAD Trust

**Contexto.** El proyecto tiene sembradas, para el entorno del despacho, varias obligaciones de ciberseguridad que citan el Esquema Nacional de Seguridad (ENS). Ninguna de esas fichas dice hoy si el ENS es, para el despacho, una obligación legal o un marco de adopción voluntaria — eso depende de si el despacho presta servicios al sector público bajo contrato (RD 311/2022, art. 2.3). Además, el catálogo de entidades del grupo tiene registrada la participación del despacho en EAD Trust como "51,001 %", con la fuente marcada como "a confirmar"; de esa cifra depende si el grupo incluye una entidad sujeta a las obligaciones reforzadas de la directiva europea de ciberseguridad (NIS2). Estas tres preguntas las plantea, literalmente, el diseño de la fase de ciberseguridad de Garrigues (documento interno §5, preguntas 1, 3 y 4) y solo puede contestarlas el despacho.

**Pregunta 1.** ¿El despacho presta servicios al sector público bajo contrato?

**Pregunta 2.** ¿Cuál es la categoría del sistema del despacho en el ENS (básica, media o alta), tiene declaración o certificación de conformidad, y realiza la auditoría bienal que exige el art. 31 del RD 311/2022?

**Pregunta 3.** ¿Se confirma que la participación del despacho en EAD Trust es del 51,001 %? (La ficha registrada trae dos variantes numéricas, "51,00 %" y "51,001 %", que también convendría aclarar.)

**Opciones y consecuencias:**
- Si el despacho **no** trabaja para el sector público: el ENS es, para él, un marco voluntario, no una obligación legal — y las fichas actuales, que no distinguen esto, estarían presentando como deber legal lo que es una decisión de gestión propia.
- Si el despacho **sí** trabaja para el sector público bajo contrato: el ENS es obligación legal (RD 311/2022, art. 2.3), y las fichas deben decirlo así.
- Si se **confirma** el 51,001 % en EAD Trust: el grupo incluye una sociedad sujeta a las obligaciones reforzadas de NIS2, según el mismo diseño técnico.
- Si **no se confirma**, o se corrige la cifra: la ficha se ajusta al dato correcto o se mantiene "a confirmar" con su motivo.

**Recomendación:** el issue no trae una recomendación de fondo sobre estas tres preguntas — son datos de hecho que solo puede aportar el despacho. El propio issue advierte que la Trusted List de EAD Trust solo acredita la cualificación de EAD Trust como proveedor, no el porcentaje de participación del despacho en su capital, que sigue sin confirmar.

**Qué se desbloquea con la respuesta.** El ajuste de las fichas de obligaciones ENS del catálogo (para que cada una diga si es obligación legal o marco voluntario) y de la ficha de EAD Trust en el catálogo de entidades (para que la participación deje de figurar "a confirmar" o quede así con su motivo declarado). Estos ajustes ya están sembrados en la base de datos de producción y, si hay que corregir algo allí, el cambio se prepara, se ensaya y espera la autorización de Moisés antes de aplicarse.

**Fecha límite.** No hay fecha regulatoria ni orientativa asociada a este issue (hito M4, prioridad Low).

**Qué pasa mientras no respondan.** Las fichas actuales siguen tal cual están: citando el ENS sin distinguir obligación legal de marco voluntario, y la participación en EAD Trust sigue marcada "a confirmar". No se bloquea ningún otro issue.

**Quién traslada la pregunta y quién recoge la respuesta:** Moisés designa a la persona responsable de cumplimiento de Garrigues (hoy no consta nombrada; es la misma designación que pide MOI-159, ver Sección C) y le hace llegar estas tres preguntas, o bien las traslada él mismo al despacho por otra vía si no hace esa designación. La respuesta se registra en un documento de la carpeta legal del repositorio y en un comentario del issue.

---

## Sección C — Designación de personas y cuentas

Esta sección no son preguntas para un tercero externo, sino un mapa exacto de qué persona hay que nombrar, qué cuenta hay que crear (o reutilizar) y dónde, para que el módulo AIMS y el programa RIA puedan avanzar. **Ningún agente crea cuentas ni maneja contraseñas**: eso lo hace Moisés, en el panel de Supabase (Authentication → Users → Add user, proyecto `governance_OS`), guardando cada contraseña solo en el fichero local `.env`.

### C.1 — MOI-159: Persona responsable de cumplimiento de Garrigues (clasificar los 6 sistemas de IA)

**Contexto.** Los seis sistemas de IA del entorno del despacho (entre ellos Harvey) no tienen rol regulatorio ni perfil de aplicabilidad asignado, porque nadie ha rellenado nunca el cuestionario guiado de clasificación. Esa persona hoy "no consta nombrada" en el sistema.

**Pregunta 1.** ¿Quién es la persona responsable de cumplimiento de Garrigues que va a clasificar los seis sistemas, contestando ella misma el cuestionario guiado (nueve preguntas) en la ficha de cada uno?

**Pregunta 2.** ¿Con qué cuenta entra esa persona?

**Opciones de cuenta, con su consecuencia:**
- **a) Cuenta propia de esa persona.** Moisés la crea en Supabase Auth (con el correo real de la persona, marcada como confirmada) y guarda la contraseña solo en `.env`. El agente prepara después un cambio de base de datos —que Moisés autoriza tras ver el ensayo— para enlazar esa cuenta a la persona en el tenant de Garrigues (`…0002`). *Consecuencia:* la autoría de la clasificación queda registrada a nombre de quien realmente la hizo; tarda algo más en arrancar. Esta misma cuenta serviría también en MOI-154, MOI-155 y MOI-177.
- **b) Cuenta de demostración `demo@garrigues-demo.dev`** (ya existe, enlazada por una migración anterior a una persona del censo, miembro vigente del Comité de Gobernanza de la IA). *Consecuencia:* se puede empezar de inmediato, pero cada cuestionario —que después no se puede modificar— queda registrado a nombre de esa otra persona, no de quien realmente lo contestó; esta limitación debe declararse por escrito.

**Recomendación técnica del agente que redactó el issue:** opción a), porque la huella que calcula el servidor acredita la autoría y la misma cuenta valdría para las tareas siguientes (MOI-154, MOI-155, MOI-177). Si pesa más empezar cuanto antes, opción b). *Si Moisés no decide, el issue fija b) como valor por defecto.*

**Qué se desbloquea con la respuesta.** MOI-154 (reevaluar a Harvey con el catálogo correcto), que a su vez desbloquea MOI-155 (recorrido de congelar/revisar). También alimenta, más adelante, la clasificación definitiva de MOI-177.

**Fecha límite.** No tiene fecha propia. Bloquea la cadena hacia MOI-177, cuya fecha regulatoria es el 2-12-2026 (ver C.5).

**Qué pasa mientras no respondan.** Los seis sistemas siguen sin clasificar, midiéndose contra un catálogo de obligaciones de proveedor de alto riesgo que no les corresponde. MOI-159 sigue además bloqueado por otro issue de decisión (MOI-210, sobre si se puede seguir borrando sistemas de IA), que Moisés tampoco ha resuelto todavía.

---

### C.2 — MOI-153: Cuenta de cumplimiento de ARGA (revisión a cuatro ojos)

**Contexto.** El 20-09-2026 se aceptó crear una segunda cuenta del entorno ARGA, con rol de cumplimiento, para que una persona distinta de quien cierra una evaluación de IA pueda revisarla (regla de "cuatro ojos"). Esa cuenta todavía no existe: ARGA solo tiene hoy la cuenta de demostración, con rol de secretario.

**Qué persona hay que designar.** Alguien del censo de personas de ARGA que ya sea miembro vigente del CATIT (el órgano de gobierno de IA de ARGA). El agente puede proponer candidatos leyendo el censo; **Moisés elige** entre ellos.

**Qué cuenta hay que crear y dónde.** Una cuenta nueva en Supabase Auth (panel del proyecto `governance_OS`, Authentication → Users → Add user), con el correo indicado en el registro interno del programa RIA (dominio de la cuenta de demostración de ARGA), marcada como confirmada. La contraseña se guarda **solo** en el fichero local `.env`, con el nombre `DEMO_PASSWORD_ARGA_COMPLIANCE`. El agente no crea la cuenta ni ve ni maneja la contraseña.

**Qué pasa después de crearla (no requiere otra decisión de fondo, solo autorizaciones sucesivas):** el agente comprueba que la cuenta existe sin perfil, propone candidatos del CATIT, Moisés elige la persona, el agente prepara (sin aplicar) el cambio de base de datos que enlaza cuenta y persona, lo ensaya, y Moisés autoriza por escrito antes de que se aplique en producción.

**Recomendación técnica del agente que redactó el issue:** ninguna alternativa distinta a la propia decisión ya aceptada el 20-09-2026; lo que falta es exclusivamente el acto material de crear la cuenta.

**Qué se desbloquea con la respuesta.** MOI-217 (reclasificación de los otros siete sistemas de ARGA), que queda bloqueado mientras esta cuenta no exista. También la necesitan MOI-155 (para repetir en ARGA el recorrido de congelar/revisar) y MOI-177 (para que la revisión de ARGA Assist pueda completarse).

**Fecha límite:** **orientativa**, 27-11-2026. Si la cuenta y su designación en el CATIT no están antes de esa fecha, el "plan B" del programa deja la clasificación de ARGA Assist en estado "propuesto", sin revisar, con un aviso en la bandeja de alarmas.

**Qué pasa mientras no se cree.** La revisión a cuatro ojos en ARGA solo puede comprobarse "por el lado negativo" (que nadie pueda revisar lo suyo), nunca ejecutarse de verdad. MOI-217 queda bloqueado.

---

### C.3 — MOI-155: Segunda persona de Garrigues que revisa (recorrido de congelar y revisar)

**Contexto.** Ninguna de las 8 evaluaciones de IA de la base de datos de producción se ha congelado ni revisado nunca; la regla de cuatro ojos (quien congela no puede revisar) nunca se ha ejecutado de verdad, solo se probó una vez con una operación que se deshizo al terminar. Lo que se congele y revise aquí queda para siempre en producción, sin poder editarse ni borrarse.

**Pregunta 1.** ¿Quién es la segunda persona de Garrigues, distinta de la persona responsable de cumplimiento (la designada en C.1), que va a revisar lo que esta congele?

**Pregunta 2.** ¿Con qué cuenta entra esa segunda persona?

**Opciones de cuenta, con su consecuencia:**
- **a) Cuenta propia de esa persona.** Moisés la crea en Supabase Auth y guarda la contraseña solo en `.env`; el agente prepara el enlace a la persona en el tenant `…0002` (de forma aditiva, si la persona no está en el censo de Garrigues), lo ensaya y Moisés autoriza. *Consecuencia:* la autoría de la revisión es fiel a quien la hizo de verdad; tarda más.
- **b) Cuenta de demostración `admin@garrigues-demo.dev`** (u otra cuenta de demostración distinta de la que usó quien congeló). *Consecuencia:* se puede empezar ya, sin cambio de base de datos, pero la revisión queda registrada a nombre de la persona enlazada a esa cuenta, no de quien realmente revisó; se declara esta limitación por escrito. Esta es la opción por defecto si Moisés no decide.

**Recomendación técnica del agente que redactó el issue:** opción a), porque la revisión existe precisamente para acreditar quién aprueba, y con la opción b) el registro nombra a otra persona. Si pesa más empezar cuanto antes, opción b).

**Qué se desbloquea con la respuesta.** Que la evaluación nueva de Harvey (de MOI-154) quede congelada y revisada de verdad por primera vez, con su huella de integridad de 128 caracteres. No bloquea ningún otro issue.

**Fecha límite.** No tiene fecha propia. Está bloqueado por MOI-154, que a su vez depende de C.1.

**Qué pasa mientras no se designe.** El recorrido de congelar y revisar sigue sin haberse hecho nunca en el sistema — el mismo riesgo que ya se materializó una vez en el módulo de Secretaría, donde se descubrió tarde que ese tramo no estaba construido.

---

### C.4 — MOI-217: Personas responsables internas de los 7 sistemas de ARGA (reclasificación)

**Contexto.** Los 8 sistemas de IA de ARGA no tienen ninguno un responsable interno asignado (`owner_id` vacío en los 8), y el motor de clasificación exige uno para completar el cuestionario de cada sistema. ARGA Assist se resuelve aparte, en MOI-177; aquí van los otros siete.

**Qué persona hay que designar.** Un responsable interno por cada uno de los siete sistemas restantes de ARGA, a partir de una propuesta que hará el agente leyendo el censo de personas de ARGA — Moisés autoriza esa propuesta, no la inventa el agente sin revisión.

**Qué cuenta se usa (ninguna cuenta nueva aquí).** Las cuentas ya designadas en C.1/C.2: `demo@` de ARGA redacta y congela los siete cuestionarios; la cuenta de cumplimiento de ARGA (creada en C.2) los revisa.

**Recomendación técnica del agente que redactó el issue:** proponer un responsable por sistema a partir del censo de ARGA, rellenando solo donde el campo está vacío, e incluir esa propuesta en la lista de cambios que Moisés autoriza.

**Qué se desbloquea con la respuesta.** Nada aguas abajo (este issue no bloquea a ningún otro), pero es el cierre de la clasificación de los 8 sistemas de IA de ARGA.

**Fecha límite.** **Orientativa**, ventana del 16 al 27-11-2026, compartida con MOI-177; en la práctica, esta tarea no puede empezar hasta que MOI-177 haya hecho su cribado y su carga de datos.

**Qué pasa mientras no se resuelve.** Los siete sistemas de ARGA siguen con su nivel de riesgo escrito a mano en la ficha, sin cuestionario ni revisión a cuatro ojos.

---

### C.5 — MOI-177: Cómo contesta la persona de Garrigues y designación de la persona de ARGA (clasificación real antes del 2-12-2026)

**Contexto.** Esta es la tarea que clasifica de verdad, con el cuestionario definitivo (v2, todavía no construido), los sistemas de Garrigues y ARGA Assist. Usa las mismas designaciones de personas de C.1 y C.3, y añade una decisión adicional: cómo contesta la persona responsable de cumplimiento de Garrigues.

**Pregunta 1.** ¿Confirma Moisés que la persona responsable de cumplimiento de Garrigues es la misma designada en MOI-159 (C.1), y quién es la segunda persona que revisa (puede ser la misma de MOI-155, C.3)?

**Pregunta 2.** ¿Cómo contesta la persona responsable de cumplimiento el cuestionario de cada sistema de Garrigues?

**Opciones, con su consecuencia:**
- **a) El agente prepara una carga con cada respuesta y su fuente** (a partir de la ficha del sistema y de hipótesis de trabajo ya aceptadas), dejándola como borrador; la persona la revisa en la ficha de cada sistema, la confirma o la cambia, y completa el cuestionario con su propia sesión. *Consecuencia:* la persona sigue siendo quien contesta (confirma cada respuesta), y cada respuesta llega con su fuente documentada, que es lo que exige la especificación del programa.
- **b) La persona contesta por pantalla, sin ninguna carga previa.** *Consecuencia:* tarda más y las respuestas de Garrigues no llevan la fuente por respuesta que pide el programa.

**Recomendación técnica del agente que redactó el issue:** opción a), porque es la que prevé la propia tarea del programa y llega mejor a la fecha del 2-12-2026; si pesa más que nadie le proponga respuestas, opción b). *Si Moisés no decide, el issue fija a) como valor por defecto.*

**Sobre ARGA Assist (no requiere designación nueva):** lo contesta y congela la cuenta `demo@` de ARGA; lo revisa la cuenta de cumplimiento de ARGA de C.2, siempre que esta y su designación en el CATIT (otro issue, MOI-170) estén listas antes del 27-11-2026. Si no lo están, ARGA Assist queda "propuesto", con aviso, y su revisión pasa a completarse en MOI-217.

**Qué se desbloquea con la respuesta.** MOI-217 (reclasificación de los otros siete sistemas de ARGA), que reutiliza el cribado y la carga de esta tarea sin repetirlos.

**Fecha límite.** **Regulatoria**: el 2-12-2026 empiezan a aplicarse el art. 5.1 b bis) y b ter) y el art. 50.2 del Reglamento (UE) 2024/1689, modificado por el Ómnibus 2026/1744. La ventana de trabajo orientativa es del 16 al 27-11-2026.

**Qué pasa mientras no respondan.** Los indicadores de cumplimiento de esos sistemas seguirán mostrando "no medido" a partir del 2-12-2026, y la tarea de reclasificación de ARGA (MOI-217) sigue bloqueada.

---

## Sección D — Decisión interna (no es una pregunta al despacho, pero implica un dato personal)

### D.1 — MOI-188: Tres restos sin dueño en la base de datos de producción

**Contexto.** La base de datos de producción conserva tres restos: dos ficheros de una prueba técnica del 07-09-2026 en el almacén de justificantes de AIMS (uno de ARGA, otro de Garrigues), que la aplicación no puede borrar por sí sola; un expediente del canal interno de información con un grupo (tenant) inexistente, que ninguna pantalla muestra; y una cuenta de acceso creada por autorregistro antes de cerrarse esa vía, sin perfil en el producto y con un correo electrónico real ajeno a la demostración (no se transcribe en ningún sitio, por minimización de datos). Esta última es la que tiene relevancia de protección de datos: el proyecto retiene un dato personal de un tercero sin usarlo ni poder darle acceso.

**Pregunta 1 (ficheros de sonda).** ¿Se borran o se dejan declarados?
- a) Borrarlos con acceso de administración. *Consecuencia:* no dura — la prueba automática que verifica el aislamiento entre entornos los vuelve a crear en cada ejecución, salvo que se cambie antes esa prueba.
- b) Dejarlos declarados como residuo conocido. *Consecuencia:* ninguna pantalla los muestra ni los mezcla con justificantes reales; sí se mezclarán en cuanto exista el primer justificante real de AIMS si no se marca la diferencia.
- **Recomendación técnica del agente que redactó el issue:** b), porque borrarlos no tiene efecto duradero mientras la prueba los recree.

**Pregunta 2 (expediente del canal sin grupo).** ¿Se borra o se conserva como histórico?
- a) Borrarlo con un cambio de base de datos limitado a ese expediente, sin abrir la posibilidad de borrar desde la aplicación.
- b) Conservarlo como histórico, declarado en una prueba automática — es el único rastro de la siembra original del canal.
- **Recomendación técnica del agente que redactó el issue:** b), porque no implica ninguna escritura en producción.

**Pregunta 3 (cuenta de acceso sin perfil, con correo real de un tercero).** ¿Se borra o se conserva inerte?
- a) Borrarla desde el panel de la base de datos (Moisés, directamente — ningún agente toca cuentas). *Consecuencia:* deja de retenerse ese dato personal ajeno.
- b) Conservarla inerte. *Consecuencia:* sin riesgo operativo (la cuenta no puede entrar, porque no tiene entorno asignado), pero el dato personal sigue retenido sin causa de uso.
- **Recomendación técnica del agente que redactó el issue:** a), por minimización de datos.

**Qué se desbloquea con la respuesta.** Nada aguas abajo (el issue no bloquea a ningún otro); es una decisión de higiene de datos, no una dependencia de otra tarea.

**Fecha límite.** No tiene fecha propia (hito M4, prioridad Low).

**Qué pasa mientras no decidan.** Todo sigue exactamente igual: nada afecta a las pantallas del producto. Si en algún momento se decide borrar algo, hace falta la autorización escrita de Moisés después de ver el ensayo del cambio, antes de que se aplique en producción.

---

## Tabla resumen

| Issue | Pregunta (resumen) | Fecha límite | Tipo de fecha | Qué se desbloquea |
|---|---|---|---|---|
| MOI-177 | Confirmar personas de Garrigues (C.1/C.3) + decidir cómo contesta la persona de Garrigues (carga a / pantalla b) | 2-12-2026 | Regulatoria | Reclasificación real de Garrigues y ARGA Assist; desbloquea MOI-217 |
| MOI-153 | Crear la cuenta de cumplimiento de ARGA (Supabase Auth) y elegir la persona del CATIT | 27-11-2026 | Orientativa (activa el "plan B" si no llega a tiempo) | MOI-217; ayuda a MOI-155 y MOI-177 |
| MOI-159 | Designar a la persona responsable de cumplimiento de Garrigues y decidir su cuenta (propia a / demo b) | Sin fecha propia | — | MOI-154 → MOI-155 |
| MOI-155 | Designar a la segunda persona de Garrigues que revisa y decidir su cuenta (propia a / demo b) | Sin fecha propia | — | Primer recorrido real de congelar/revisar en AIMS |
| MOI-154 | (Ejecución, sin pregunta nueva: usa la persona de MOI-159) | Sin fecha propia | — | MOI-155 |
| MOI-217 | Autorizar la propuesta de responsables internos de los 7 sistemas de ARGA | 16 al 27-11-2026 | Orientativa | Cierre de la clasificación de los 8 sistemas de ARGA |
| MOI-156 | ¿Requiere Harvey una EIPD? (DPO del despacho) | Sin fecha propia | — | Registro de la respuesta en la evaluación de Harvey (MOI-154) |
| MOI-191 | Categoría ENS, sector público y % de participación en EAD Trust (dirección del despacho) | Sin fecha | — | Ajuste de fichas de obligaciones ENS y de la ficha de EAD Trust |
| MOI-188 | Qué hacer con los tres restos sin dueño (ficheros de sonda, expediente sin grupo, cuenta sin perfil) | Sin fecha | — | Ninguno (higiene de datos) |
