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

**Cotejo literal (19-09-2026, navegador, consolidado CELEX 02024R1689-20260727; ▼M1 = Reglamento
(UE) 2026/1744).** Para llevar a la tabla de F0.T2 al integrar:

| Punto | Texto oficial (extracto literal) | Uso en el producto |
|---|---|---|
| Art. 4.1 (▼M1) | «Los proveedores y responsables del despliegue de sistemas de IA adoptarán medidas para apoyar la promoción de la alfabetización en materia de IA de su personal y demás personas que se encarguen en su nombre del funcionamiento y la utilización de sistemas de IA […]. Esta obligación no exige que los proveedores o los responsables del despliegue garanticen un nivel específico de alfabetización en materia de IA de ninguna persona en particular.» | Nota de RIA_ART_4 y descripción de ALFABETIZACION. Destinatarios «de sistemas de IA»: apoya dejar fuera al proveedor de un modelo |
| Art. 5.1 b bis) (▼M1) | «[…] un sistema de IA que genere o manipule imágenes, vídeos o audios realistas o material similar de las partes íntimas de una persona física identificable, o de una persona física identificable que participe en actividades sexualmente explícitas, sin el consentimiento libre, específico, informado e inequívoco y explícito de dicha persona […]» | Ayuda de Q2_1 (reescrita: decía «imágenes íntimas… sin su consentimiento») |
| Art. 5.1 b ter) (▼M1) | «[…] un sistema de IA que genere o manipule material o espectáculos en el sentido del artículo 2, letras c) y e), de la Directiva 2011/93/UE, excepto cuando se aplique una defensa de «forma ilícita» en virtud del Derecho nacional» | Ayuda de Q2_1 (añade la Directiva) |
| Art. 5.1 bis a) y b) (▼M1) | a) al mercado o en servicio «solo estará prohibida cuando: i) dicha generación o manipulación sea la finalidad prevista […], o ii) […] un resultado razonablemente previsible y reproducible […] y el sistema no disponga de medidas técnicas de seguridad razonables […]»; b) la utilización «solo está prohibida cuando el responsable del despliegue utilice el sistema con el fin de generar o manipular dicho material» | Ayuda de Q2_1, sin cambio |
| Art. 113, párr. 3, a) (▼M1) | «[…] a excepción del artículo 5, apartado 1, párrafo primero, letras b bis) y b ter), y el artículo 5, apartado 1 bis, y apartado 1 ter, que serán aplicables a partir del 2 de diciembre de 2026» | Fecha de Q2_1, sin cambio |
| Art. 6.3, último párrafo (▼B) | «[…] los sistemas de IA a que se refiere el anexo III siempre se considerarán de alto riesgo cuando el sistema de IA efectúe la elaboración de perfiles de personas físicas.» | Aviso de perfilado de Q2_3 (C10) |
| Art. 3.52 (▼B) | «“elaboración de perfiles”: la elaboración de perfiles tal como se define en el artículo 4, punto 4, del Reglamento (UE) 2016/679» | Ejemplo de Q2_3 |

**No cotejado, y por eso retirado del producto:** el número del artículo del Reglamento
2026/1744 que modifica el art. 4 (la spec cita «art. 1.5»; Harvey citó «4.1 (mod.), cdo. 8»). La
nota dice ahora «Art. 4.1 en la redacción del Reglamento (UE) 2026/1744», que sí está cotejado.

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

- **`CUESTIONARIO_VERSION` sigue en «1.1»** aunque F1.T10 cambia la ayuda de Q2_1 (y con ella qué
  significa responder «No») y F1.T11 los `applicable_frameworks` que se sellan para unas mismas
  respuestas. Hoy no hay ambigüedad (0 filas en `aims_classification_questionnaires`, medido). La
  decisión es del controlador: subir a «1.1.1» (el servidor no valida el valor, solo lo sella y
  pone «1.1» por defecto en `fn_aims_registrar_sistema`) o declarar que la v1.1 abarca las dos
  ayudas con corte en el despliegue, comprobando antes que siguen sin existir cuestionarios.
- **`EntidadDetalle`, columna «Riesgo EU AI Act»** (preexistente, fuera de F1.T9): pinta
  `risk_level` en rojo o aviso sin mirar `tieneClasificacionGuiada`. ARGA: 8 sistemas, 6 «Alto», 0
  cuestionarios → 6 chips rojos que afirman una clasificación sin medir. Tarea pendiente: chip
  neutro «nivel declarado en ficha, sin cuestionario», como el resto del módulo, con gate de arista.
  Cambio visible en ARGA (declararlo).

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
- **F1.T7 — `reviewed_at` huérfano (decisión del controlador):** guardar una sección «Conforme» la
  deja en un estado de trabajo y no toca `reviewed_at`, que queda sin revisión a la que corresponder.
  La pestaña avisa antes de guardar y ya no pinta «Revisada» junto a un estado de trabajo (hoy ninguna
  fila de ARGA está en ese caso: la única «Pendiente» tiene `reviewed_at` NULL), pero el dato conserva
  la fecha. Qué cadena lo cierra —F1.T4 (legado) o F9.T2 (`fn_aims_revisar_seccion`)— está sin decidir.
