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

Citas de Harvey que NO resisten el literal (lote H-01): el art. 73.4 en C15 y el considerando 25 en C8 (el apoyo correcto del doble rol es el considerando 83). Los criterios siguen siendo correctos; las citas no. Ver `docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md`.

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

## Estado por fase

| Fase | Estado | Notas |
|---|---|---|
| F0 | EN CURSO | T3 (H-01) hecha · T2 hecha (7 VERIFICADOS, 1 PENDIENTE_LEGAL: fecha de la sección 5) · T1 propuestas presentadas al usuario · T4 y T5 en la cadena F de la fase 1 |
| F1 | EN CURSO | Seis cadenas en worktrees aislados (A monitores, B sistema, C cuestionario, D catálogo, E migración M01, F documentos de F0) |
| F2-F11 | PENDIENTE | |

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
| M · Gobierno del dato | **gap** «4/6 conformes» | **watch** «0/3 acreditadas · 3 de legado, no acredita» |
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

**Los tres cambios de gap a vigilancia, con su causa** (ninguno es una mejora de cumplimiento; los
tres dejan de afirmar algo que la base no sostenía):

- **Gobierno del dato.** Lo ponía en gap el `EU_AI_ACT_ART_10` NO_CONFORME de FraudGuard (18-04).
  Traducido el legado, él y el `AIA-10` «Conforme» de FraudGuard (19-04) son el mismo requisito,
  `DATA_GOVERNANCE`, del mismo sistema, y **manda el más reciente**: la no conformidad declarada
  queda desplazada por una conformidad de legado que no acredita. El monitor queda en vigilancia,
  nunca en Listo. Efecto de la regla de F1.T4, declarado aquí para que el controlador decida si una
  no conformidad de legado debe prevalecer sobre una conformidad de legado posterior.
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
- **Comprobación ↔ evaluación sin enlace.** Mientras M01 (F1.T14) no dé `assessment_id` a
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

- **Defecto vivo detectado en el diseño:** `fn_sync_obligation_to_backbone` manda al `ELSE 'risk'`
  24 obligaciones: las 21 de PBC/FT de Garrigues (el patrón espera `OBL-GARR-PBC-%` y están
  sembradas como `OBL-PBC-%`), que hoy se sincronizan al módulo de riesgos penales en vez de al de
  PBC/FT, y 3 de ARGA. Tarea en F5 (sin convertir el ELSE en RAISE).
