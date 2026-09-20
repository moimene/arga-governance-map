# Ledger — programa de cobertura RIA de AIMS 360 (Garrigues y ARGA, demostrador interno)

- **Encargo del usuario (19-09-2026):** cubrir todos los gaps del análisis de la visión del experto
  RIA (`docs/superpowers/reviews/2026-09-19-vision-ria-experto-vs-aims.md`); sistemas internos de
  Garrigues y ARGA en modo demostrador; integrar sistemas y módulos todo lo posible; **el experto
  manda en criterios**; **Harvey valida** los criterios del demostrador (consulta por consola
  autorizada por el usuario).
- **Especificación:** `docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md`
  (v2 + 14 enmiendas vinculantes del §14). 140 gaps canónicos (GC-01…GC-140), 130 tareas en
  12 fases (F0-F11), matriz de trazabilidad completa.
- **Rama:** `aims/cobertura-ria-2026-09-19`, en el worktree `/private/tmp/aims-cobertura`
  (el árbol compartido queda en `main`: otra sesión trabaja en `docs/context/`).
- **Línea base del worktree (b1721a5):** typecheck limpio · `bun test` **4 547 pass / 156 skip /
  3 todo / 0 fail**.

## Trazabilidad del inventario

- 314 entradas en bruto del análisis (`gaps.json`) → 137 canónicos (consolidador + comprobación
  mecánica: 0 sin asignar) → 140 tras medir Cloud en la v2 (GC-138…GC-140).
- Comprobación mecánica en cada versión: todo GC con al menos una tarea que declara «Cierra».

## Decisiones del usuario (F0.T1)

Estado: **PROPUESTA** = valor propuesto por el controlador a partir del dato, adoptado como
«Simulado — pendiente de confirmar» mientras el usuario no lo corrija. **PENDIENTE** = no se
ejecuta lo que depende de ella («falla cerrado»). **ACEPTADA** = el usuario ha respondido y la
propuesta pasa a ser la decisión.

**Respuesta del usuario (20-09-2026), literal: «sí a todo».** Se le habían enumerado antes las
tres consecuencias fuertes —D-U5 exige un acto material suyo, D-U7 deroga una decisión expresa
suya del 08-09 y D-U8 es una excepción a un invariante WORM—, así que el sí se toma como
informado y las ocho pasan a ACEPTADA. Lo que cada sí NO cambia:

- **D-U1…D-U4 y D-U6** siguen siendo **dato simulado**, ahora confirmado como criterio: el
  etiquetado de procedencia (`DEMO_PILOTO`, «Simulado») se mantiene. Lo que decae es el rótulo
  «pendiente de confirmar», no la marca de simulación.
- **D-U5** no queda hecha con el sí: **la cuenta no existe todavía**. Todo lo que depende de los
  cuatro ojos en ARGA sigue fallando cerrado hasta que el usuario la cree (receta en §D-U5 abajo).
- **D-U7 y D-U8** se ejecutan **con sus condiciones**, no en bloque: cada tabla se reabre después
  de su corrección del §2.2, y la redacción RGPD solo por el camino gobernado de la enmienda E-12.
  Reabrir sin la corrección previa, o redactar sin capacidad y sin anotación nueva, sigue
  prohibido: eso no lo autoriza el sí.

| # | Decisión | Valor adoptado | Estado |
|---|---|---|---|
| D-U1 | Proveedora de AIS-ARGA-001/002/003 («ARGA Analytics» no existe) | ARGA Digital, S.L. desarrolla por encargo; proveedoras las sociedades que ponen en servicio con su nombre: ARGA Seguros (triaje auto, suscripción empresas), ARGA Salud (fraude reembolsos salud), ARGA Vida (ARGA Score). Acumulan proveedor + responsable del despliegue (Harvey C8, C11) | **ACEPTADA** 20-09 |
| D-U2 | Órgano de IA de ARGA y decisor del residual | Órgano de IA: Comité Asesor de Tecnología e Innovación (CATIT), dueño también de la PR-024. Residual: Comité de Riesgos; escalado a la Comisión de Riesgos Regulada en alto riesgo | **ACEPTADA** 20-09 |
| D-U3 | Proveedora de GA_IA | Garrigues (matriz), SLP: lo pone en servicio con su marca; NewLaw, desarrolladora por encargo; g-digital no puede (división) (Harvey C11) | **ACEPTADA** 20-09 |
| D-U4 | Fundaciones, institutos e integraciones como sujeto | Fundación Garrigues sí (persona jurídica). Centro de Estudios y BSVV no, hasta acreditar personalidad | **ACEPTADA** 20-09 |
| D-U5 | Segunda cuenta ARGA con rol COMPLIANCE (cuatro ojos) | La crea el usuario en Supabase Auth (el controlador no da de alta cuentas). Después, migración de perfil y persona con el patrón de `20260914121000` (enmienda E-06) | **ACEPTADA** 20-09 — **falta el acto material del usuario** |
| D-U6 | Especialidad → órgano en ARGA | Jurídico → Comité de Cumplimiento · Técnico y Ciberseguridad → CATIT · Riesgos → Comité de Riesgos · Datos → Comisión de Auditoría y Cumplimiento Normativo | **ACEPTADA** 20-09 |
| D-U7 | Reabrir la escritura de las 8 tablas muertas (EIDF, modelos, componentes, datasets, vigilancia poscomercialización, relojes, informes de incidente, remisiones EIDF-EIPD), derogando en ese punto DA-9 y la frontera D-1 del 08-09 | Sí, con RESTRICT en las FK, el dato de ARGA (`aims_post_market_plans`, 1 fila) solo de lectura, y la corrección previa de cada tabla del §2.2 | **ACEPTADA** 20-09, con condiciones |
| D-U8 | Excepción de redacción RGPD sobre el diario de solo anexión `aims_ria_records` | Sí, gobernada: capacidad AIMS_GOBIERNO, motivo, fuera de legal hold, y anotación nueva que referencia el registro redactado (enmienda E-12) | **ACEPTADA** 20-09, con condiciones |

### D-U5 — lo que falta y quién lo hace

El controlador no da de alta cuentas ni maneja contraseñas: la crea el usuario. Receta mínima,
en el panel de Supabase Auth del proyecto `hzqwefkwsxopwrmtksbg` (Authentication → Users → Add
user), coherente con las cuentas que ya existen:

- Correo: `compliance@arga-seguros.com` (dominio de la cuenta demo de ARGA ya sembrada).
- Contraseña: la que el usuario decida; **no se comparte por aquí**. Va a `.env` como
  `DEMO_PASSWORD_ARGA_COMPLIANCE`, igual que las otras dos, y los tests la leen por
  `demoPassword()`.
- Marcar el correo como confirmado (si no, el login demo no entra).

Con la cuenta creada, el controlador hace el resto sin tocar Auth: migración con el patrón de
`20260914121000` que enlaza el `user_profiles` al tenant de ARGA, le pone `role_code` COMPLIANCE
y lo ata a una persona del censo de ARGA. Hasta entonces, la revisión a cuatro ojos de ARGA
sigue midiéndose solo por el camino negativo (`MISMO_EVALUADOR`), como hoy.

## Validación con Harvey

| Lote | Tema | Estado | Resultado |
|---|---|---|---|
| H-01 | 17 criterios de aplicabilidad, correcciones a la matriz, calendario del Ómnibus | RESPONDIDO 19-09 | 16 correctos + C2 con matiz útil. El matiz de Harvey en C15 (art. 73.4) **no está en el texto consolidado**: C15 queda correcto. 8 consideraciones → requisitos RH-1…RH-8. Archivo: `docs/legal/harvey/2026-09-19-H-01-*` |

Citas de Harvey que NO resisten el literal (lote H-01): el art. 73.4 en C15 y el considerando 25 en C8 (el apoyo correcto del doble rol es el considerando 83). Los criterios siguen siendo correctos; las citas no. Ver `docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md`.

Regla: la respuesta de Harvey es dato; toda afirmación suya que cambie un criterio se contrasta
con el literal (EUR-Lex consolidado 27-07-2026) antes de usarla.

### Cambios provisionales a la espera de H-02A (F1.T10 y F1.T11)

Rotulados «Provisional, pendiente de validación» (`ROTULO_PROVISIONAL`,
`src/lib/aims/cuestionario-calificacion.ts`). Los tests leen el estado del lote en
`docs/legal/harvey/registro.json`: mientras H-02A no esté RESPONDIDA, el rótulo es
obligatorio. Con CORRECTO, F1.T15 retira el rótulo; con INCORRECTO, se revierte a lo
que dice la columna «Antes» y se anota aquí.

| Tarea | Qué | Antes | Ahora (provisional) |
|---|---|---|---|
| F1.T10 | Ayuda de Q2_1 (art. 5) | «Marque Sí SOLO si…» con cuatro prácticas; «si tiene dudas, la respuesta casi seguro es No» | Diez letras enumeradas (a-h, b bis, b ter; b bis y b ter cotejadas, ver abajo) y el 5.1 bis; c) sin intención; ejemplo de que la d) no alcanza a la puntuación de siniestros por indicios objetivos de fraude; f) a cualquier empleador; h) solo con fines de garantía del cumplimiento del Derecho y la biometría con otros fines al anexo III 1 a) |
| F1.T11 | MD_TRA_01 (catálogo del desplegador) | `OBLIGACION`, norma «Art. 50.1» | `MARCO_OPERATIVO`, «Art. 50.1 (obliga al proveedor)» |
| F1.T11 | MD_CS_01 | `OBLIGACION`, «Cap. V» | `MARCO_OPERATIVO`, «Cap. V (obliga al proveedor del modelo)» |
| F1.T11 | MD_CS_02 | `OBLIGACION`, «Cap. V y anexo XII» | `MARCO_OPERATIVO`, «Cap. V y anexo XII (obligan al proveedor del modelo)» |
| F1.T11 | MD_CS_05 | `OBLIGACION`, «Art. 25.1» | `MARCO_OPERATIVO`, «Art. 25.1 (califica al sujeto)» |

**Veredicto de H-02A (respondida 19-09, contrastada con el literal el mismo día).** Las cinco
afirmaciones salen CORRECTO o CORRECTO CON MATIZ: los cinco cambios de arriba se **mantienen**,
ninguno se revierte. Los matices sí obligaban a tocar tres sitios, hecho el 20-09 (versión del
cuestionario **1.1.2**):

| Qué | Cambio aplicado |
|---|---|
| Ayuda de Q2_1, letra d) | El literal del art. 5.1 d) exceptúa expresamente los sistemas que apoyan la valoración humana sobre hechos objetivos y verificables ligados a una actividad delictiva: está ahora en la letra. Y el ejemplo del fraude de siniestros añade sus dos límites — sí entra si las variables combinadas equivalen de hecho a un perfil, y quedar fuera del art. 5 no saca del anexo III ni de los arts. 22 y 9 del RGPD |
| Ayuda de Q2_1, letra h) | Separada en los tres escenarios: tiempo real + fines policiales = prohibida; **diferido** + fines policiales = alto riesgo con las condiciones del **art. 26.10**; cualquier otra finalidad = anexo III 1 a) y art. 9 RGPD. Se excluye la verificación de identidad uno contra uno, que no es identificación remota |
| Catálogo del responsable del despliegue | Faltaba el **art. 50.3**, la otra obligación que el art. 50 pone directamente sobre este rol: nueva medida `MD_TRA_06` (subparte `TRA.EMOCIONES`), con carácter `OBLIGACION` y **condicional en su texto** al tipo de sistema (reconocimiento de emociones o categorización biométrica). El catálogo pasa de 43 a **44** medidas |

**Cuarta cita de Harvey que no resiste el literal:** en el matiz de P4 cita el «art. 29» para las
condiciones de la biometría en diferido. El art. 29 es la notificación de los organismos de
evaluación de la conformidad; las condiciones están en el **art. 26.10**. El criterio de Harvey
era correcto; la cita, no. Detalle en `docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md`.

**El rótulo provisional NO se retira todavía.** El gate solo exige el rótulo mientras H-02A no
esté respondida, así que mantenerlo no rompe nada; retirarlo es F1.T15 y depende de la revisión
de Legal de los textos de ayuda (F1.T10) y de que Legal confirme la desviación de `ROLES_ART_4`
(F1.T11). Harvey valida criterio, no sustituye esa revisión.

No provisionales, por estar ya validados: la retirada del ejemplo del scoring y el aviso de
perfilado de Q2_3 (C10 y último párrafo del 6.3 cotejado; el resto de Q2_3 vuelve al texto de la
spec del equipo legal: quién documenta la excepción —art. 6.4—, el desarrollo de las letras a) a d)
del 6.3 y el ejemplo de la tarea procedimental se retiraron hasta que H-02 los valide), el rótulo «Art. 6.2 y anexo III» de Q2_2 (F1.T9) y la redacción
del art. 4 (C14) con MD_ALF_05 como marco operativo (ya lo era). Tampoco la cautela del
cap. V en la rama del proveedor, ni «divulgar» en MD_TRA_02 (literal del 50.4).

**Desviación declarada (F1.T11):** la tarea dice «el art. 4 solo se asigna a PROVEEDOR y
RESPONSABLE_DESPLIEGUE». `derivarMarcos` lo asigna también a `PROVEEDOR_POSTERIOR`, porque el
art. 3.68 lo define como proveedor de un **sistema** de IA y el art. 4 vincula a los proveedores
de sistemas; quitárselo escondería una obligación (el módulo falla abierto). Quedan fuera
`PROVEEDOR_GPAI` (proveedor de un modelo, no de un sistema), `IMPORTADOR` y `DISTRIBUIDOR`. A
confirmar por Legal; revertir es quitar un elemento de `ROLES_ART_4`. **Texto de las ayudas pendiente de revisión por Legal** (F1.T10 lo exige y
no lo puede cerrar un implementador).

**Coherencia del art. 4 entre marcos y catálogo (corrección de la revisión):** `perfilAplicable`
servía el catálogo del desplegador (MD_ALF_01 a 04, OBLIGACION «Art. 4») a IMPORTADOR y
DISTRIBUIDOR de riesgo limitado o mínimo, a los que `derivarMarcos` ya no asigna el art. 4. Ahora
caen al catálogo completo con el motivo dicho (falla abierto, como en alto riesgo). Gate:
`perfil-aplicabilidad.test.ts` recorre roles × niveles y cae si el catálogo mide el art. 4 como
obligación de un rol sin ese marco. Medido: 0 sistemas con `regulatory_role` en los dos tenants,
sin cambio visible.

**Estado de las tareas de esta cadena:**

| Tarea | Estado | Pendiente |
|---|---|---|
| F1.T9 | HECHA | — |
| F1.T10 | HECHA, **no cerrada** | Revisión del texto de las ayudas por Legal (criterio de aceptación) y veredicto de H-02A (F1.T15) |
| F1.T11 | HECHA, **no cerrada** | Veredicto de H-02A (F1.T15) y confirmación por Legal de la desviación de `ROLES_ART_4` |

**Cotejo literal de esta cadena:** trasladado a `docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md`, sección «Cotejo de F1.T10 y F1.T11».

**No cotejado, y por eso retirado del producto:** el número del artículo del Reglamento
2026/1744 que modifica el art. 4 (la spec cita «art. 1.5»; Harvey citó «4.1 (mod.), cdo. 8»). La
nota dice ahora «Art. 4.1 en la redacción del Reglamento (UE) 2026/1744», que sí está cotejado.

## Puntos del Comité (F0.T5)

Orden del día para el **Comité de Gobernanza de la IA** de Garrigues. Legal aporta el contraste
jurídico. En ARGA, los puntos que le afectan van a su órgano de IA cuando se confirme D-U2
(propuesta: CATIT).

Cómo se resuelve cada punto: el Comité emite un dictamen, que se registra en Secretaría con el
asunto indicado (F5.T13) y queda enlazado al sistema, sin posibilidad de edición una vez
aprobado.

Las fechas límite son **propuesta del implementador de F0.T5, a confirmar por el Comité**,
calculadas desde la tarea que consume cada punto.

Mientras no haya dictamen, el punto sigue PENDIENTE. **Requisito** para las pantallas afectadas,
que hoy no existen: fallar cerrado y decirlo, sin deducir nunca la respuesta. Lo implementan
F6.T13 (requerimientos, CP-1), F4 (pregunta S10 F_2 del cuestionario v2) y F9.T1 (versiones con
`change_class`, CP-2), y F9.T8 (ficha del sujeto, CP-3), todas sobre el dictamen de F5.T13.

| # | Punto | Tenant | Responsable del dictamen | Aporta Legal | Fecha límite propuesta | Lo consume | Requisito mientras no haya dictamen (tarea) | Estado |
|---|---|---|---|---|---|---|---|---|
| CP-1 | Secreto profesional frente a la cooperación (arts. 21 y 26.12) y al acceso a documentación y código (art. 74) | Garrigues | Comité de Gobernanza de la IA (ver la pregunta previa de CP-1) | Contraste H-16 (§9 de la especificación); base del art. 78, del Derecho nacional sobre secreto profesional y de la Carta | H-16 enviado antes del 30-11-2026. Posición aprobada antes del 18-12-2026 | F6.T13 (registro de requerimientos); dictamen SECRETO_PROFESIONAL (F5.T13) | Requerimientos (F6.T13): «posición del despacho sobre secreto profesional pendiente del Comité de IA». La herramienta no decide si se entrega | PENDIENTE |
| CP-2 | Procedimiento de consulta interna para decidir un «cambio significativo» del art. 111.2 | Garrigues y ARGA | Garrigues: Comité de Gobernanza de la IA. ARGA: órgano de D-U2 | Criterios de apoyo de H-02 P9 (§9); redacción de la ayuda (cdo. 177: «equivalente en sustancia» a la modificación sustancial del 3.23) | 13-11-2026 (tope del cuestionario v2) | Pregunta S10 F_2 del cuestionario v2 (F4); F9.T1 (versiones); dictamen CAMBIO_SIGNIFICATIVO_111_2 (F5.T13) | Cuestionario (F4): F_2 = SÍ no se admite sin la referencia del dictamen. Versiones (F9.T1): SIGNIFICATIVO_111_2 se rechaza sin dictamen | PENDIENTE |
| CP-3 | Acuerdos intragrupo entre proveedor y responsable del despliegue: GA_IA entre la matriz y NewLaw, y contenido mínimo del acuerdo | Garrigues (y su correlato en ARGA, D-U1) | Garrigues: Comité de Gobernanza de la IA. ARGA: órgano de D-U2 | Cotejo con los arts. 3.3, 3.4, 3.11 y 25; guion del contenido mínimo | 13-11-2026 (antes de M10 y de clasificar GA_IA antes del 2-12-2026) | D-U3; F4.T15 (ACUERDO_INTRAGRUPO); F9.T8; F11.T1 (clasificación de GA_IA); F11.T3 (correlato en ARGA); dictamen ACUERDO_INTRAGRUPO (F5.T13) | Ficha del sujeto (F9.T8): «reparto intragrupo no documentado». El sujeto de GA_IA sigue como hipótesis | PENDIENTE |

### CP-1 Secreto profesional frente a los arts. 21 y 74 (RH-8, DS-40, GC-111)

**Qué se decide.** La posición documentada del despacho ante un requerimiento de una autoridad
que alcance información amparada por el secreto profesional. Tres preguntas:
- si puede limitar o condicionar el acceso, y con qué base;
- quién evalúa cada requerimiento y en qué plazo interno;
- qué se documenta en cada caso.

**Pregunta previa: quién fija la posición.** Hay tres referencias en el dato sembrado, y ninguna
resuelve la pregunta:
- la PI-30 §3.2 d) exige, para el uso extraordinario, un informe al Departamento de Intangibles,
  la autorización del Comité de IA y, después, la del Senior Partner (informe del 19-09, §4.2);
- el Código Ético hace responsable al Senior Partner y prevé un informe previo del Comité de
  Práctica Profesional (art. 43.1, catálogo normativo de G4);
- el patrón previsto en F5.T13 es un dictamen del Comité más la decisión del Senior Partner.

Si el Comité de IA entiende que la materia es deontológica y corresponde a otro órgano, que lo
diga, y el punto se reencamina. La herramienta no presupone el órgano.

**Prueba.**
- **Literal.** Ninguno de estos preceptos excepciona el secreto profesional:
  - art. 21.1-21.2: información y documentación previa solicitud motivada, y acceso a los
    archivos de registro bajo control del proveedor;
  - art. 21.3 y art. 78: confidencialidad de lo que obtengan las autoridades;
  - art. 26.12: cooperación del responsable del despliegue;
  - art. 74.12: acceso completo a la documentación y a los conjuntos de datos, también por API;
  - art. 74.13: acceso al código fuente previa solicitud motivada;
  - art. 74.14.
- **Harvey, H-01, consideración 8.** El RIA no tiene una excepción expresa y hay una posible
  colisión con la cooperación y el acceso a registros. Recomienda someterlo al Comité y
  documentar la posición del despacho (`docs/legal/harvey/2026-09-19-H-01-respuesta.md`).
- **Hecho del tenant.** El despacho es responsable del despliegue de Harvey y de Copilot. Según
  D-U3 (propuesta), es además proveedor de GA_IA. Sus entradas y registros pueden contener
  información de clientes. CTR-GARR-33 (prohibición de volcar información confidencial en IA
  generativa de terceros) protege la entrada, pero no resuelve el requerimiento.
- **El experto ya lo anticipa.** Su entregable de OB-64 (d75) dice: «sin perjuicio de que cada
  requerimiento deberá ser analizado en detalle y por separado».

**No aplica a ARGA.** La colisión nace del secreto del abogado frente a sus clientes.

### CP-2 Consulta interna del «cambio significativo» (RH-2, DS-38, GC-72)

**Qué se decide.** El procedimiento: quién propone, quién decide, qué se documenta y cuándo.
Propuesta para el debate, no criterio:
- **Propone** el responsable interno del sujeto al registrar una versión.
- **Decide** el órgano de IA, mediante dictamen.
- **Se documenta:**
  - la versión de referencia y la nueva;
  - qué cambia en el diseño (arquitectura, modelo, datos, finalidad);
  - por qué el cambio es o no «significativo»;
  - por qué es o no, además, una modificación sustancial del art. 3.23;
  - los criterios de apoyo utilizados.
- **Cuándo:** antes de poner en servicio la versión.

**Prueba.**
- **Literal.** El art. 111.2, en la redacción del 2026/1744, solo sujeta a los sistemas puestos
  en servicio antes de la fecha de aplicación del capítulo III si sufren «cambios significativos
  en sus diseños», y no define la expresión. El art. 3.23 define «modificación sustancial». Harvey
  (H-01, consideración 2) sostiene que son conceptos distintos, pero **el considerando 177 del
  Reglamento 2024/1689 dice lo contrario**, cotejado literal el 19-09-2026 (CELEX 32024R1689): «el
  concepto de "cambio significativo" debe entenderse como equivalente en sustancia al de
  "modificación sustancial", que se utiliza únicamente con respecto a los sistemas de IA de alto
  riesgo». El 2026/1744 modifica el art. 111.2 y no revisa ese considerando (buscado en su texto
  oficial: ninguna mención). El considerando no vincula, pero es el criterio interpretativo que
  da el propio legislador: el dictamen debe partir de él y, si se aparta, justificarlo. Tercera cita
  de Harvey que no resiste el literal (`docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md`,
  clave `cdo-177`). El considerando 39 del 2026/1744 computa por tipo y modelo (Harvey, C7).
- **Consecuencia medida.** Todo el régimen de alto riesgo de ARGA Score (anexo III 5 c), en
  servicio desde el 1-3-2024 según el dato demo) está latente, y ese estado depende de esta
  decisión (informe del 19-09, §1). Lo mismo vale para cualquier sistema «Alto» puesto en servicio
  antes del 2-12-2027 (GC-72).
- **Diseño.** La herramienta no lo deriva (DS-38), así que sin este procedimiento la pregunta
  S10 F_2 del cuestionario no puede contestarse con un SÍ.

**ARGA.** Mismo punto para su órgano de IA (D-U2). Hasta que se confirme, falla cerrado.

### CP-3 Acuerdos intragrupo entre proveedor y responsable del despliegue (RH-1, DS-39, GC-115)

**Qué se decide.**
- (a) Si existe, o existirá, un acuerdo intragrupo que documente el reparto de GA_IA entre la
  matriz, que es la proveedora propuesta en D-U3, y NewLaw, desarrolladora por encargo.
- (b) Su contenido mínimo.
- (c) Confirmar que ninguna sociedad del grupo comercializa GA_IA como producto propio. Si lo
  hiciera, esa sociedad sería la proveedora y la matriz solo responsable del despliegue.

Guion del contenido mínimo, como propuesta para el debate y no como criterio:
- partes y sistema;
- quién lo pone en servicio con su nombre o marca (arts. 3.3 y 3.11);
- deberes de proveedor que asume la matriz (arts. 4, 5 por usos posibles, 50.1 y 50.2 si
  concurren);
- información técnica que NewLaw entrega a la matriz;
- comunicación de versiones y de cambios de modelo, que alimenta CP-2 y la reapertura del ciclo;
- incidentes: a quién se informa y en qué plazo;
- cooperación con autoridades y acceso a registros, que enlaza con CP-1;
- vigencia y terminación.

**Prueba.**
- **Literal.** El art. 3.3 hace proveedora a la persona que desarrolla un sistema **o para la que
  se desarrolla**, y lo pone en servicio con su nombre o marca, incluido el uso propio (art.
  3.11). Si además lo usa bajo su autoridad, es también responsable del despliegue (art. 3.4).
- **Harvey, H-01.** C11 (validado): una división sin personalidad no puede ser proveedora, así
  que g-digital queda fuera. C8: el uso propio acumula los dos roles. Consideración 1:
  formalizar el reparto en acuerdos intragrupo.
- **Dato.** El tenant tiene 33 entidades, dos tecnológicas con personalidad (EAD Trust y NewLaw)
  y la división g-digital. GA_IA figura con proveedor «Garrigues» en texto libre y sin sociedad
  (informe del 19-09, §4.2).
- **Precisión.** El art. 25.4 solo rige para sistemas de alto riesgo y para el suministro de
  componentes (GC-115). GA_IA no consta hoy como alto riesgo. Para GA_IA, el acuerdo es la
  formalización que recomienda RH-1, no el deber del 25.4.

**ARGA.** Correlato de D-U1 (propuesta): ARGA Digital desarrolla por encargo, y ARGA Seguros,
ARGA Salud y ARGA Vida ponen en servicio y acumulan los dos roles. La misma pregunta va a su
órgano de IA (D-U2).

## Reglas de ejecución

- Una fase por vez en la rama; dentro de la fase, cadenas de tareas sobre ficheros disjuntos en
  paralelo (worktree aislado por cadena), cada cadena con revisión adversarial.
- TDD; gates por tarea y gates completos (typecheck, `bun test`, lint, build) antes de cada merge.
- Mutación sobre cada gate nuevo, **después** de arreglar: commitear antes de mutar, restaurar solo
  el fichero mutado, comprobar que la mutación entró.
- Cloud: el controlador aplica las migraciones, con `db:check-target`, transacción con bloque de
  verificación que aborta y control positivo, registro en `schema_migrations`, verificación
  posterior independiente y sonda de comportamiento con fila sembrada y limpieza.
- Nada destructivo sobre dato sembrado; tenant_id explícito; ARGA solo aditivo y declarado (lista
  de filas de ARGA tocadas abajo).

## Filas de ARGA tocadas

(ninguna todavía: M01 es solo esquema — 0 filas tocadas, medido)

### Pantallas de ARGA que cambian sin tocar filas (F1.T12/T13 + corrector D-catalogo, 19-09)

Medido en Cloud (SELECT): ARGA tiene 7 evaluaciones y ninguna usa códigos del catálogo — 6 `EU_AI_ACT`
con `VAL-*`/`ART_*` y 1 `ISO_42001` (`132042ee…`, BORRADOR) con `ISO-05`…`ISO-10`. Sin acierto,
`EvaluacionDetalle` cae al primer catálogo candidato y el desglose pinta el catálogo entero como
«Pendiente» (con el aviso, que ya existía, de que no corresponde a la evaluación). El cambio es del
catálogo, no del dato:

| Pantalla | Antes | Después |
|---|---|---|
| Informe de las 6 evaluaciones `EU_AI_ACT` | «12 áreas normativas (0 medidas evaluadas)», 84 medidas pendientes | 12 áreas, **99** medidas pendientes, con los textos corregidos |
| Informe de la evaluación ISO `132042ee…` | «4 áreas normativas», 8 medidas, numeración A.5/A.6/A.8/A.9 | **10** áreas, **16** medidas, numeración A.2…A.10 y 6.1, y en cada fila «Marco operativo · ISO/IEC 42001, anexo A, A.x» |
| Aviso «Respondida con una versión anterior del catálogo» y marca de fila | — | No aparece en ARGA: sin códigos del catálogo no se afirma nada (probado con `ISO-05` y fecha antigua) |
| Monitores de readiness del Dashboard | — | Sin cambio: los checks de ARGA llevan códigos de legado y siguen por palabras clave |
| Asistente de evaluación nueva | 84 medidas RIA / 8 ISO | 99 RIA / 16 ISO (el catálogo recotejado) |

En Garrigues, el informe de Harvey (`fdcccf9e…`, 07-09) pasa a decir que 32 medidas respondidas
cambiaron de texto (marcadas fila a fila) y que entraron 15 nuevas sin evaluar. Nada se escribe.

## Estado por fase

| Fase | Estado | Notas |
|---|---|---|
| F0 | HECHA | T2 hecha (8 VERIFICADOS —incluido el cdo. 177, que corrige a Harvey—, 1 PENDIENTE_LEGAL) · T3 (H-01) hecha · T4 y T5 hechas (cadena F) · **T1 cerrada el 20-09: D-U1…D-U8 ACEPTADAS («sí a todo»)**; queda el acto material de D-U5 (cuenta en Auth), que no bloquea F2-F11 salvo lo que exige cuatro ojos en ARGA |
| F1 | INTEGRADA, no cerrada | Seis cadenas fusionadas en la rama (19-09): T1-T9, T12-T14 hechas; **T10 y T11 cerradas por el veredicto de H-02A el 20-09** (los cinco cambios provisionales se mantienen; sus matices llegan a las ayudas d) y h) y añaden el art. 50.3 al catálogo del desplegador, que pasa de 43 a 44 medidas; cuestionario **1.1.2**). **T15 sigue abierta**: el rótulo provisional lo retira Legal, no Harvey; T1-bis a F8. **M01 aplicada en Cloud** (`20260919100000`, Management API desde el fichero: ensayo revertido, transacción con verificación que aborta y 14 sondas revertidas, registro en `schema_migrations`, `notify pgrst`; sonda P1-P9 revertida OK; sonda viva 5 rojos → 16/16; 0 filas tocadas, 61 comprobaciones y 8 evaluaciones sin enlace). Gates: typecheck, lint y build limpios; `bun test` 4 772 pass / 156 skip / 0 fail (base 4 547) |
| F2 | EN CURSO | **T1 hecha (20-09)**: `src/lib/aims/sujeto-juridico.ts`, criterio único y fail-closed de quién puede ser sujeto. Medido en Cloud con los dos logins: ARGA 31 entidades / **16** formas jurídicas (la spec decía 17 — manda el dato), Garrigues 33 / 18; las 34 clasificadas, normalizando («S.L.» y «SL» son la misma clave). D-U4 aplicada: Fundación elegible, Centro de Estudios y BSVV no. Las 3 SC, 2 LLP y la SPK quedan `PERSONALIDAD_NO_ACREDITADA` (H-09), que el «sí a todo» no resolvió. Dos gates: unidad (17 tests, catálogo real) y **sonda viva** `aims-sujeto-juridico-live` (6 tests, logins reales, solo lectura) que coteja en las dos direcciones la copia declarada de ARGA. Arnés de mutación pasado: quitar `SICAV` pone en rojo los dos gates; quitar el override de INTEGRACION rompe el caso de BSVV. Gates: typecheck y lint limpios; `bun test` **4 795 pass / 156 skip / 3 todo / 0 fail**. **T2-T18 pendientes**; T18 necesita además el acto material de D-U5 |
| F3-F11 | PENDIENTE | |

## F1 — cadena A-monitores: cambios visibles medidos (corrector, 19-09)

Medido con `buildAimsReadiness` sobre el dato vivo de los dos tenants, leído con login real (solo
SELECT) y con la entrada exacta del Dashboard: `checksVigentes` sobre `ai_compliance_checks`
ordenadas por `created_at`, evaluaciones con su sistema embebido, secciones e indicadores del tenant.
**Base** = `5e66496` (librería de `b1721a5`), **después** = `84d91e5` (F1.T1–T8 más las correcciones
de la revisión adversarial). Esta lista **sustituye** a la que acompañaba al informe de F1: tres
«antes» no eran los que pinta la base (expediente, precisión, proveedor), el «0/5 secciones con
revisor» del expediente no llegaba a pintarse, y faltaban siete cambios de monitor.

Reglas que mueven las cifras: asignación por código (F1.T1); cierre = CERRADO con fecha (F1.T2);
cada monitor lee su objeto (F1.T3); solo acredita lo congelado y revisado, manda lo más reciente y
el legado se lee traducido y no acredita (F1.T4); L5 sin recuento no acredita (F1.T5); y, de la
revisión: **una comprobación solo acredita si la evaluación vigente de su sistema es firme**, en los
monitores con objeto propio el estado es **el peor de comprobaciones y objeto**, y el alto riesgo
se cuenta **solo entre sistemas con cuestionario**. En las métricas, «conformes» pasa a «acreditadas».

### ARGA (…0001) — 8 sistemas, 0 con cuestionario, 6 «Alto» declarados en ficha

| Superficie | Base | Después |
|---|---|---|
| D · Inventario | watch «4/8 activos» | gap «0/8 con clasificación guiada» |
| D · Autodiagnóstico · alto riesgo | gap «2/6 alto riesgo» | **no medido** «8 sistemas sin cuestionario» |
| D · Incidentes | watch «1 abiertos» | igual |
| D · Controles | Listo «35/38 cerrados» | watch «8/11 cerrados · 11 sin congelar y revisar» |
| D · Evidencias operativas | gap «0/1 con cierre» | gap «0/1 cerrados · 1 en investigación» |
| M · Gobierno, roles | Listo «3/3 conformes» | watch «0/1 acreditadas · 1 de legado, no acredita» |
| M · Inventario y clasificación | watch «4/8 activos» | gap «0/8 con clasificación guiada» |
| M · Prácticas prohibidas | watch «0 inaceptables» | no medido «Sin análisis del art. 5» |
| M · Obligaciones alto riesgo | watch «4/6 conformes» | watch «0/4 acreditadas · 4 de legado, no acredita» |
| M · Expediente técnico | gap «1/2 conformes» | gap «0/2 acreditadas · 2 de legado, no acredita · 0/5 secciones con revisor» |
| M · Gobierno del dato | **gap** «4/6 conformes» | **gap** «0/3 acreditadas · 3 de legado, no acredita» (tras la decisión de precedencia al integrar F1; en la cadena A salía watch) |
| M · Transparencia | gap «2/5 conformes» | gap «0/3 acreditadas · 3 de legado, no acredita» |
| M · Supervisión humana | watch «3/4 conformes» | watch «0/4 acreditadas · 4 de legado, no acredita · 0/1 secciones con revisor» |
| M · Precisión, robustez y ciberseguridad | Listo «1/1 conformes» | watch «0/1 acreditadas · 1 de legado, no acredita · 0/1 secciones con revisor» |
| M · Proveedor y terceros | gap «0/1 conformes» | no medido «Sin comprobaciones del área» |
| M · Post-market | **gap** «0/1 con cierre» | **watch** «1/1 indicadores con medición» |
| M · Reporting de incidentes | watch «1 materiales» | igual |
| M · Derechos fundamentales / DPIA | Listo «1/1 conformes» | watch «0/1 acreditadas · 1 de legado, no acredita» |
| M · Sistema de gestión ISO 42001 | watch «4/5 conformes» | watch «0/2 acreditadas · 2 de legado, no acredita» |
| M · Evidencia y recordkeeping | **gap** «3/4 conformes» | **watch** «0/1 acreditadas · 1 de legado, no acredita · Sin protocolo de registro» |
| Pasos | lista fija | 5 derivados: 8 sin clasificación guiada · 3 autodiagnósticos sin firmar · **«6 declarados Alto en ficha, sin cuestionario»** (antes «6 sistemas de alto riesgo sin autodiagnóstico acreditado») · 1 incidente · 2 con brechas a GRC |
| Consola TGMS «IA alto riesgo sin evaluar» (`useModuleStatus`) | 4 | **6** (APROBADO sin firmar de Motor de triaje y ARGA Score ya no cuentan) |
| Chips «Aprobada (legado)» (5 filas) en lista e informe | verde | aviso (`--status-warning`) |
| Chip del BORRADOR ISO en la pestaña del sistema | aviso | neutro (el del vocabulario, como en la lista) |

**Los cambios de gap a vigilancia, con su causa** (eran tres en la cadena A; tras integrar F1 quedan dos: Gobierno del dato vuelve a gap) (ninguno es una mejora de cumplimiento; los
tres dejan de afirmar algo que la base no sostenía):

- **Gobierno del dato.** Lo ponía en gap el `EU_AI_ACT_ART_10` NO_CONFORME de FraudGuard (18-04).
  Traducido el legado, él y el `AIA-10` «Conforme» de FraudGuard (19-04) son el mismo requisito,
  `DATA_GOVERNANCE`, del mismo sistema, y **manda el más reciente**: la no conformidad declarada
  queda desplazada por una conformidad de legado que no acredita. El monitor queda en vigilancia,
  nunca en Listo. Efecto de la regla de F1.T4, declarado aquí para que el controlador decida si una
  no conformidad de legado debe prevalecer sobre una conformidad de legado posterior.
  **Decidido al integrar F1 (19-09):** sí. Entre las comprobaciones que no acreditan (legado y
  borrador), una no conformidad solo la desplaza otra no conformidad; una evaluación cerrada
  sigue mandando sobre las dos (`checks-vigentes.ts`, `esNoConforme`). Medido con login real:
  Gobierno del dato de ARGA vuelve a **gap** «0/3 acreditadas · 3 de legado, no acredita».
- **Evidencia y recordkeeping.** El gap de la base salía de comprobaciones que la subcadena le
  atribuía y que no son del art. 12 (entre ellas el `AIA-13` «No conforme» de FraudGuard, que ahora
  cuenta en Transparencia). Por código solo le corresponde `VAL-04` → `LOGGING`, de legado.
- **Post-market.** Leía el cierre de incidentes (0/1); ahora lee su objeto, los indicadores de
  vigilancia (F1.T3): 1 con medición y sin umbral evaluado, vigilancia.

### Garrigues (…0002) — 6 sistemas, 0 con cuestionario, Harvey «Limitado» declarado

| Superficie | Base | Después |
|---|---|---|
| D · Inventario | watch «4/6 activos» | gap «0/6 con clasificación guiada» |
| D · Autodiagnóstico · alto riesgo | gap «Sin alto riesgo» | **no medido** «6 sistemas sin cuestionario» |
| D · Controles | watch «40/84 cerrados» | gap «0/84 cerrados · 84 sin congelar y revisar» (F1.T5: 40 L5 sin recuento) |
| D · Evidencias operativas | **Listo** «1/1 con cierre» | **gap** «0/1 cerrados · 1 en investigación» |
| M · Gobierno, roles | gap «0/2 conformes» | no medido «Sin comprobaciones del área» |
| M · Inventario y clasificación | watch «4/6 activos» | gap «0/6 con clasificación guiada» |
| M · Prácticas prohibidas | watch «0 inaceptables» | no medido «Sin análisis del art. 5» |
| M · Obligaciones alto riesgo | gap «0/1 conformes» | gap «0/2 acreditadas» |
| M · Expediente técnico | gap «0/1 conformes» | gap «0/1 acreditadas · Sin expediente técnico» |
| M · Gobierno del dato | gap «2/5 conformes» | gap «0/1 acreditadas» |
| M · Supervisión humana | gap «0/1 conformes» | gap «0/1 acreditadas · Sin sección del anexo IV.3» |
| M · Precisión, robustez y ciberseguridad | gap «2/3 conformes» | gap «0/3 acreditadas · 2 declaradas conformes sin congelar y revisar · Sin sección del anexo IV.4» |
| M · Proveedor y terceros | **Listo** «5/6 con vendor» | no medido «Sin comprobaciones del área» |
| M · Post-market | **Listo** «1/1 con cierre» | **gap** «0/1 acreditadas · Sin indicadores de vigilancia» |
| M · Reporting de incidentes | gap «0/1 conformes» | gap «0/1 acreditadas» |
| M · Derechos fundamentales / DPIA | gap «0/1 conformes» | no medido «Sin comprobaciones del área» |
| M · Sistema de gestión ISO 42001 | gap «0/2 conformes» | no medido «Sin evaluaciones ISO 42001» |
| M · Evidencia y recordkeeping | gap «0/1 conformes» | gap «0/1 acreditadas · Sin protocolo de registro» |
| Consola TGMS «IA alto riesgo sin evaluar» | 0 | 0 |

### Retirado y pendiente

- **Monitor por sistema** (`buildAimsComplianceMonitorsPorSistema`): se retira. Estaba exportado y
  con test, pero ninguna superficie lo montaba (código sin arista). La parte «por sistema» de F1.T1
  queda **PENDIENTE**: montarlo en la ficha del sistema con su test de render. Tarea a asignar por el
  controlador (propuesta: F1.T1-bis). El monitor por tenant sigue en el Dashboard.
  **Decidido al integrar F1:** se monta en **F8**, en la ficha del sistema, junto a la vista
  `v_aims_indicator_status` (F8.T10), que es la que da estado derivado a los indicadores; montarlo
  antes pintaría un monitor por sistema sin su objeto de vigilancia.
- **Comprobación ↔ evaluación sin enlace.** (M01 aplicada el 19-09: el enlace existe; las 61
  legacy siguen NULL. Atar la acreditación a la evaluación propia queda para F2.) Mientras M01 (F1.T14) no dé `assessment_id` a
  `ai_compliance_checks`, `sistemasConEvaluacionFirme` exige que **todas** las evaluaciones vigentes
  del sistema estén congeladas y revisadas: una ISO sin firmar impide acreditar las comprobaciones
  RIA del mismo sistema. Es conservador (nunca acredita de más); con M01, atar cada comprobación a
  la suya.

### Corrección de la especificación

- **F1.T5 decía «los trece L5 de Harvey»; son 40.** Medido el 19-09-2026 con el login de Garrigues
  (solo SELECT): `ai_risk_assessments` `fdcccf9e-fff0-4346-a2f2-17e610981be3` (Harvey, EU_AI_ACT,
  CON_GAPS, score 49, sin congelar ni revisar) tiene 84 findings, **40 en L5** y **0 con
  `evidenceCount`**. Consulta: `select findings from ai_risk_assessments where id = 'fdcccf9e…'`,
  contando `status = 'L5'` y `typeof evidenceCount = 'number'`. Corregido también en la
  especificación (F1.T5).

## Deudas y hallazgos durante la ejecución

- **[DECIDIDO al integrar F1: sube a «1.1.1»; 0 cuestionarios en Cloud]** **`CUESTIONARIO_VERSION` seguía en «1.1»** aunque F1.T10 cambia la ayuda de Q2_1 (y con ella qué
  significa responder «No») y F1.T11 los `applicable_frameworks` que se sellan para unas mismas
  respuestas. Hoy no hay ambigüedad (0 filas en `aims_classification_questionnaires`, medido). La
  decisión es del controlador: subir a «1.1.1» (el servidor no valida el valor, solo lo sella y
  pone «1.1» por defecto en `fn_aims_registrar_sistema`) o declarar que la v1.1 abarca las dos
  ayudas con corte en el despliegue, comprobando antes que siguen sin existir cuestionarios.
- **[HECHO al integrar F1: chip neutro sin cuestionario, gate en `no-fabricated-claims` con mutación comprobada; cambio visible en ARGA: 6 chips rojos «Alto» pasan a neutros con el `title` «nivel declarado en ficha, sin cuestionario»]** **`EntidadDetalle`, columna «Riesgo EU AI Act»** (preexistente, fuera de F1.T9): pinta
  `risk_level` en rojo o aviso sin mirar `tieneClasificacionGuiada`. ARGA: 8 sistemas, 6 «Alto», 0
  cuestionarios → 6 chips rojos que afirman una clasificación sin medir. Tarea pendiente: chip
  neutro «nivel declarado en ficha, sin cuestionario», como el resto del módulo, con gate de arista.
  Cambio visible en ARGA (declararlo).
- **Títulos persistidos con la numeración o el destinatario anteriores (corrector D-catalogo).**
  `ai_compliance_checks.requirement_title` guarda el título del día de la evaluación y el Board Pack
  (`BPSistemasIA.tsx:135`) lo pinta tal cual: ARGA conserva «Política de IA (A.5)», «Organización
  interna (A.6)», «Recursos de IA (A.7)», «Evaluación de impacto… (A.8)», «(A.9)» y «Gestión de datos
  para IA (A.10)» (códigos `ISO-05`…`ISO-10`, numeración desplazada ya antes de esta rama), y el
  check `TRANSPARENCY` de Harvey dice «Transparencia e información a usuarios». No se corrige sin
  escribir en Cloud o sin resolver el título en la presentación. Dueño: producto (presentación) o
  usuario (corrección de dato).
- **Monitores de readiness: dos criterios por código, uno queda (integración de F1).** Las cadenas A
  (`mapa-monitores.ts`, un monitor por requisito) y D (`MONITORES_POR_REQUISITO`, que congelaba el
  reparto que salía de las palabras clave, con sus artefactos: «rol» casaba con «control»,
  `POST_MARKET` no llegaba a su monitor) resolvieron el mismo defecto por separado. Queda el de A,
  que ya medía y declaraba sus cambios en los dos tenants; los seis códigos ISO nuevos de D entran
  en su mapa (universo cerrado contra los catálogos, test en `mapa-monitores.test.ts`). Ningún check
  persistido lleva esos seis códigos: su entrada no cambia ninguna pantalla hoy.
- **Lote H-11 (Harvey), añadir:** las correcciones literales de la revisión — MG_INCI_01 «grave e
  irreversible de la gestión o el funcionamiento» (art. 3.49.b), 10.4 «entorno geográfico,
  contextual, conductual o funcional» (MG_DATA_09 y su bloque), salvedad del 73.6 párrafo segundo en
  MG_INCI_02, y MG_ISO_IMP_02 reubicada en su sentido (A.5.3, documentar la evaluación de impacto).
  Y la clasificación de las 33 medidas cuyo texto cambió (18 de sentido, 13 de alcance, 2 de
  terminología; lista en la cabecera de `catalog-aesia.ts`).
- **`catalog_version` (F2.T3).** Sin versión en la fila, la detección de «versión anterior» usa el
  texto y la fecha de la evaluación contra `desde`; con varias subidas de versión en el mismo día o
  sin fecha, hará falta la columna.

- **Defecto vivo detectado en el diseño:** `fn_sync_obligation_to_backbone` manda al `ELSE 'risk'`
  24 obligaciones: las 21 de PBC/FT de Garrigues (el patrón espera `OBL-GARR-PBC-%` y están
  sembradas como `OBL-PBC-%`), que hoy se sincronizan al módulo de riesgos penales en vez de al de
  PBC/FT, y 3 de ARGA. Tarea en F5 (sin convertir el ELSE en RAISE).
- **F1.T6 cierra GC-50 solo para «sin medición»** (revisión adversarial de la cadena B-sistema).
  Con valor medido, el chip pinta `status` tal cual (DEFAULT 'OK') sin compararlo con
  `threshold_config`: un indicador por encima del umbral crítico se pintaría «OK». Hoy es cierto de
  hecho para el único indicador de Cloud (ARGA, 6,4 frente a aviso 8), pero es un rótulo sin arista.
  **F8.T10** (`v_aims_indicator_status`) debe derivar DENTRO_UMBRAL / UMBRAL_SUPERADO y reproducir el
  criterio de `tieneMedicion` (falla cerrado: solo un número finito o una cadena no vacía, suelto o
  en `value`). No se compara en cliente: el dato no declara si el umbral se supera por arriba o por
  abajo.
- **F1.T7 — sección «Cerrada» (SEALED):** la pestaña ya no ofrece «Editar», pero el guard del hook
  mira el estado de DESTINO, no el de origen; la inmutabilidad en servidor llega con **F9.T2**
  (trigger de guardia de `status`). Latente: 0 filas SEALED en Cloud (medido 2026-09-19).
- **[DECIDIDO al integrar F1: lo cierra F9.T2 — `fn_aims_revisar_seccion` limpia `reviewed_at` al devolver una sección a estado de trabajo; F1.T4 no toca dato]** **F1.T7 — `reviewed_at` huérfano (decisión del controlador):** guardar una sección «Conforme» la
  deja en un estado de trabajo y no toca `reviewed_at`, que queda sin revisión a la que corresponder.
  La pestaña avisa antes de guardar y ya no pinta «Revisada» junto a un estado de trabajo (hoy ninguna
  fila de ARGA está en ese caso: la única «Pendiente» tiene `reviewed_at` NULL), pero el dato conserva
  la fecha. Qué cadena lo cierra —F1.T4 (legado) o F9.T2 (`fn_aims_revisar_seccion`)— está sin decidir.
- **Siete celdas del Excel del experto vienen cortadas en el propio libro (I-11 del documento de
  incidencias, P-08).** Medido en el original `Dashboard_control_RIA.xlsx`, uniendo todos los
  `<t>` de cada `<si>`: `Obligaciones!I11`, `I16`, `I43`, `I49`, `I54`, `I56` e `I65` miden
  exactamente 180 caracteres, el máximo de la columna. **F3 no puede recuperarlas reextrayendo el
  Excel**: el texto no está en el fichero. OB-48 toma el de d62 del HTML; las otras seis esperan a
  P-08, y el HTML no es un sustituto general (d15 acaba donde `I11`; d53 es más corto que
  `I43`).
