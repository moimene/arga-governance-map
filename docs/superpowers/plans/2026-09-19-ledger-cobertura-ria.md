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
ejecuta lo que depende de ella («falla cerrado»).

| # | Decisión | Propuesta | Estado |
|---|---|---|---|
| D-U1 | Proveedora de AIS-ARGA-001/002/003 («ARGA Analytics» no existe) | ARGA Digital, S.L. desarrolla por encargo; proveedoras las sociedades que ponen en servicio con su nombre: ARGA Seguros (triaje auto, suscripción empresas), ARGA Salud (fraude reembolsos salud), ARGA Vida (ARGA Score). Acumulan proveedor + responsable del despliegue (Harvey C8, C11) | PROPUESTA |
| D-U2 | Órgano de IA de ARGA y decisor del residual | Órgano de IA: Comité Asesor de Tecnología e Innovación (CATIT), dueño también de la PR-024. Residual: Comité de Riesgos; escalado a la Comisión de Riesgos Regulada en alto riesgo | PROPUESTA |
| D-U3 | Proveedora de GA_IA | Garrigues (matriz), SLP: lo pone en servicio con su marca; NewLaw, desarrolladora por encargo; g-digital no puede (división) (Harvey C11) | PROPUESTA |
| D-U4 | Fundaciones, institutos e integraciones como sujeto | Fundación Garrigues sí (persona jurídica). Centro de Estudios y BSVV no, hasta acreditar personalidad | PROPUESTA |
| D-U5 | Segunda cuenta ARGA con rol COMPLIANCE (cuatro ojos) | La crea el usuario en Supabase Auth (el controlador no da de alta cuentas). Después, migración de perfil y persona con el patrón de `20260914121000` (enmienda E-06) | PENDIENTE (acción del usuario) |
| D-U6 | Especialidad → órgano en ARGA | Jurídico → Comité de Cumplimiento · Técnico y Ciberseguridad → CATIT · Riesgos → Comité de Riesgos · Datos → Comisión de Auditoría y Cumplimiento Normativo | PROPUESTA |
| D-U7 | Reabrir la escritura de las 8 tablas muertas (EIDF, modelos, componentes, datasets, vigilancia poscomercialización, relojes, informes de incidente, remisiones EIDF-EIPD), derogando en ese punto DA-9 y la frontera D-1 del 08-09 | Sí, con RESTRICT en las FK, el dato de ARGA (`aims_post_market_plans`, 1 fila) solo de lectura, y la corrección previa de cada tabla del §2.2 | PENDIENTE (revierte una decisión expresa del usuario) |
| D-U8 | Excepción de redacción RGPD sobre el diario de solo anexión `aims_ria_records` | Sí, gobernada: capacidad AIMS_GOBIERNO, motivo, fuera de legal hold, y anotación nueva que referencia el registro redactado (enmienda E-12) | PENDIENTE (excepción a un invariante WORM) |

## Validación con Harvey

| Lote | Tema | Estado | Resultado |
|---|---|---|---|
| H-01 | 17 criterios de aplicabilidad, correcciones a la matriz, calendario del Ómnibus | RESPONDIDO 19-09 | 16 correctos + C2 con matiz útil. El matiz de Harvey en C15 (art. 73.4) **no está en el texto consolidado**: C15 queda correcto. 8 consideraciones → requisitos RH-1…RH-8. Archivo: `docs/legal/harvey/2026-09-19-H-01-*` |

Regla: la respuesta de Harvey es dato; toda afirmación suya que cambie un criterio se contrasta
con el literal (EUR-Lex consolidado 27-07-2026) antes de usarla.

## Puntos del Comité (F0.T5)

Orden del día para el **Comité de Gobernanza de la IA** de Garrigues. Legal aporta el contraste
jurídico. En ARGA, los puntos que le afectan van a su órgano de IA cuando se confirme D-U2
(propuesta: CATIT).

Cómo se resuelve cada punto: el Comité emite un dictamen, que se registra en Secretaría con el
asunto indicado (F5.T13) y queda enlazado al sistema, sin posibilidad de edición una vez
aprobado.

Las fechas límite son **propuestas del controlador**, calculadas desde la tarea que consume
cada punto. Las confirma el Comité.

Mientras no haya dictamen, el punto sigue PENDIENTE y **la herramienta falla cerrado y lo dice**
en la pantalla afectada. En ningún caso deduce ella la respuesta.

| # | Punto | Tenant | Responsable del dictamen | Aporta Legal | Fecha límite propuesta | Lo consume | Mientras no haya dictamen | Estado |
|---|---|---|---|---|---|---|---|---|
| CP-1 | Secreto profesional frente a la cooperación (arts. 21 y 26.12) y al acceso a documentación y código (art. 74) | Garrigues | Comité de Gobernanza de la IA (ver la pregunta previa de CP-1) | Contraste H-16 (§9 de la especificación); base del art. 78, del Derecho nacional sobre secreto profesional y de la Carta | H-16 enviado antes del 30-11-2026. Posición aprobada antes del 18-12-2026 | F6.T13 (registro de requerimientos); dictamen SECRETO_PROFESIONAL (F5.T13) | Requerimientos: «posición del despacho sobre secreto profesional pendiente del Comité de IA». La herramienta no decide si se entrega | PENDIENTE |
| CP-2 | Procedimiento de consulta interna para decidir un «cambio significativo» del art. 111.2 | Garrigues y ARGA | Garrigues: Comité de Gobernanza de la IA. ARGA: órgano de D-U2 | Criterios de apoyo de H-02 P9 (§9); redacción de la ayuda (111.2 no es el 3.23) | 13-11-2026 (tope del cuestionario v2) | Pregunta S10 F_2 del cuestionario v2 (F4); F9.T1 (versiones); dictamen CAMBIO_SIGNIFICATIVO_111_2 (F5.T13) | Cuestionario: F_2 = SÍ no se admite sin la referencia del dictamen. Versiones: SIGNIFICATIVO_111_2 se rechaza sin dictamen | PENDIENTE |
| CP-3 | Acuerdos intragrupo entre proveedor y responsable del despliegue: GA_IA entre la matriz y NewLaw, y contenido mínimo del acuerdo | Garrigues (y su correlato en ARGA, D-U1) | Garrigues: Comité de Gobernanza de la IA. ARGA: órgano de D-U2 | Cotejo con los arts. 3.3, 3.4, 3.11 y 25; guion del contenido mínimo | 13-11-2026 (antes de M10 y de clasificar GA_IA antes del 2-12-2026) | D-U3; F4.T15 (ACUERDO_INTRAGRUPO); F9.T8; F11.T3; dictamen ACUERDO_INTRAGRUPO (F5.T13) | Ficha del sujeto: «reparto intragrupo no documentado». El sujeto de GA_IA sigue como hipótesis | PENDIENTE |

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
  en su diseño», y no define la expresión. El art. 3.23 define «modificación sustancial», que es
  otro concepto (Harvey H-01, consideración 2). El considerando 39 computa por tipo y modelo
  (Harvey, C7).
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

(ninguna todavía)

## Estado por fase

| Fase | Estado | Notas |
|---|---|---|
| F0 | EN CURSO | T3 (H-01) hecha; T1 propuestas presentadas al usuario |
| F1 | PENDIENTE | Siguiente |
| F2-F11 | PENDIENTE | |

## Deudas y hallazgos durante la ejecución

- **Defecto vivo detectado en el diseño:** `fn_sync_obligation_to_backbone` manda al `ELSE 'risk'`
  24 obligaciones: las 21 de PBC/FT de Garrigues (el patrón espera `OBL-GARR-PBC-%` y están
  sembradas como `OBL-PBC-%`), que hoy se sincronizan al módulo de riesgos penales en vez de al de
  PBC/FT, y 3 de ARGA. Tarea en F5 (sin convertir el ELSE en RAISE).
