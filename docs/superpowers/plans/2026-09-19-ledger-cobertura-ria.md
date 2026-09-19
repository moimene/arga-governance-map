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
| F0 | EN CURSO | T3 (H-01) hecha; T1 propuestas presentadas al usuario |
| F1 | PENDIENTE | Siguiente |
| F2-F11 | PENDIENTE | |

## Deudas y hallazgos durante la ejecución

- **Títulos persistidos con la numeración o el destinatario anteriores (corrector D-catalogo).**
  `ai_compliance_checks.requirement_title` guarda el título del día de la evaluación y el Board Pack
  (`BPSistemasIA.tsx:135`) lo pinta tal cual: ARGA conserva «Política de IA (A.5)», «Organización
  interna (A.6)», «Recursos de IA (A.7)», «Evaluación de impacto… (A.8)», «(A.9)» y «Gestión de datos
  para IA (A.10)» (códigos `ISO-05`…`ISO-10`, numeración desplazada ya antes de esta rama), y el
  check `TRANSPARENCY` de Harvey dice «Transparencia e información a usuarios». No se corrige sin
  escribir en Cloud o sin resolver el título en la presentación. Dueño: producto (presentación) o
  usuario (corrección de dato).
- **Monitores de readiness congelados por código (corrector D-catalogo).** `MONITORES_POR_REQUISITO`
  (`readiness.ts`) conserva para los requisitos existentes lo que medía la base por palabras clave,
  con sus artefactos: `POST_MARKET` no alimenta «Post-market monitoring», `ISO_POLICIES` e
  `ISO_RESOURCES` no alimentan ninguno, y «rol» casa con «control». Corregirlo mueve el Dashboard de
  Garrigues (checks de Harvey). Dueño: producto.
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
