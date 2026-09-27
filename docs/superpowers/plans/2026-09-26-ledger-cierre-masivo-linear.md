# Ledger — cierre masivo de issues de Linear (P-MOI-5), 26-09-2026

Nota de continuidad del cierre masivo encargado el 26-09-2026. Proyecto de Linear:
«Governance OS · Secretaría y AIMS» (P-MOI-5). Ejecuta: Claude Code (Opus 5.5) como
orquestador, con agentes Sonnet/Haiku por tarea. Sesión `ea9dc902`.

## 1. Mandato

Transcripción literal de la instrucción de Moisés (chat de Claude Code, 26-09-2026 hacia las
18:00 CEST), publicada también como comentario del proyecto en Linear (`f9bc253e`):

> Utiliza la skill /gobernanza-repo-linear revisa el estado del proyecto y lanza un proceso
> masivo en modo /goal para cerrar todos los issues pendiente, tanto in review como backlog, doy
> por buenas tus recomendaciones, por tanto elimino la puerta de decisión humana y toma tu la
> decisión, orquesta tareas en modelos menores y de menor coste para racionalizar el coste de
> tokens trabaja en modo /loop hasta completar el goal si es necesario

Cómo se aplica:

- **Cubre**: las decisiones de producto, alcance y prioridad reservadas a Moisés en los issues;
  la elección entre opciones; las autorizaciones de incorporar a `main` (que publica) y de
  cambiar la base de datos de producción; y la aceptación de entregas. Toda decisión o
  aceptación tomada así se escribe como **«por delegación de Moisés»**, nunca como suya.
- **No cubre** (no es de Moisés o está prohibido a un agente): el criterio del Comité Legal, del
  Comité de IA, del CATIT, del equipo legal, del DPO y del experto RIA (regla 9 del protocolo);
  la confirmación contractual de EAD Trust; designar personas reales; crear cuentas o manejar
  contraseñas (regla 8); borrar cuentas de usuario. Esos issues se preparan y quedan abiertos,
  diciendo qué falta.
- **Reglas duras que siguen vigentes**: ensayo revertido antes de todo cambio de base de datos y
  espejo en `supabase/migrations/`; ARGA sin cambios no declarados; dato de Garrigues intacto;
  nada de firma, envío o entrega atribuidos a EAD Trust; distinción preparado / probado /
  publicado / aceptado; comentarios de agente con su línea de identificación.
- **Lecciones de la auditoría del 25-09** (`docs/superpowers/reviews/2026-09-25-auditoria-acta-cierre-governance-os.md`):
  no cerrar sin cumplir los criterios de hecho; no cargar datos por script donde el guion pide
  pantalla; no fusionar sin gates verdes; balance completo, no parcial.

## 2. Línea base medida (26-09-2026, 16:30 UTC)

- `main` = `origin/main` = `5aa91278`; producción READY en ese commit (Vercel).
- Cloud `governance_OS`: 359 versiones, cabecera `20260925130000`; repo: 359 ficheros. Paridad.
- `bun test`: 4 944 pass / 156 skip / 3 todo / 0 fail (5 103 tests, 535 ficheros).
- `bun run typecheck`: 0 errores. `bun run lint`: 0 errores, 2 avisos.
- Linear P-MOI-5: 87 issues pendientes (5 In Review, 82 Backlog); triage completo en solo
  lectura con un agente Sonnet por issue.

## 3. Decisiones tomadas por delegación de Moisés

Cada una con la opción elegida y su motivo. «Recomendación del issue» = la que el propio issue
ya traía; donde coincide, se adopta.

| # | Issue | Decisión | Motivo |
|---|---|---|---|
| D-01 | MOI-144 | Custodia final: **B** (no construir todavía). Prueba real con EAD Trust: **B** (aplazar). | Técnico y contractual: sin la confirmación de EAD Trust (MOI-216) construir o probar comprometería producto y la política del 21-07-2026. Recomendación del issue. |
| D-02 | MOI-160 | **a**: dos medidas distintas (madurez en AIMS, efectividad del control en GRC), con nombres distintos en pantalla. | Producto: miden hechos distintos; mismo patrón que la doble lectura de riesgo. Recomendación del issue. |
| D-03 | MOI-161 | **b**: cada módulo conserva su lista; traducción solo en los puntos de intercambio. | Técnico: hoy no hay intercambio real de estados; no toca ARGA. Recomendación del issue. |
| D-04 | MOI-162 | **a**: acciones sin hallazgo (`finding_id` anulable + CHECK de origen) con enlace a obligación / sistema de IA. El contenido del plan lo validan el Comité de IA y el CATIT al ejecutar F5 (MOI-175). | Fiabilidad del dato: (b) fabrica hallazgos. Recomendación del issue. |
| D-05 | MOI-174 | **a**: esperar al registro de formación de F5.T6 (MOI-175). | No toca pieza compartida con ARGA; «sin control» es un hecho. Recomendación del issue. |
| D-06 | MOI-185 | **a**: FK `ai_systems.tenant_id → tenants` ahora; el CHECK de estados se aplaza con MOI-161 (D-03). | No cambia ningún dato; cierra el hueco del grupo inexistente. Recomendación del issue. |
| D-07 | MOI-186 | Tablas: **a** (las 12 en solo lectura). Documento: **b** (sustituido por el programa RIA). | Protege las filas de ARGA; el documento no existe en el repo. Recomendación del issue. |
| D-08 | MOI-187 | **a**: sin editor; los cambios de texto siguen por el programa con versión nueva. | Coste sin volumen que lo justifique. Recomendación del issue. |
| D-09 | MOI-188 | Ficheros de sonda y expediente huérfano: **declarar** (con prueba que vigile). Cuenta sin perfil: la borra Moisés (no delegable a un agente). | Recomendación del issue; borrar cuentas está fuera del alcance de un agente. |
| D-10 | MOI-189 | Riesgos: **b** (tabla de equivalencias en código, vigilada por prueba). Obligaciones: **a** (históricas, ya vigilado). | ARGA no cambia. Recomendación del issue. |
| D-11 | MOI-192 | DORA: **a** (regla de producto D-5; alinear CLAUDE.md). Plantillas: **A** (sondas de solo lectura). | Recomendación del issue. |
| D-12 | MOI-210 | **b**: las 4 FK de `ai_systems` pasan de CASCADE a RESTRICT; las sondas pasan a ensayos revertidos. | Adelanta la regla del programa RIA antes de clasificar. Recomendación del issue. |
| D-13 | MOI-152 | **a**: el grupo nuevo nace con el módulo `ai` de GRC (migración aditiva + configuración de arranque). | El grupo nuevo existe para probar AIMS desde cero. Recomendación del triage. |
| D-14 | MOI-151 | **b** por ahora: la designación del instructor y órganos del canal sigue en el programa; la configuración por grupo queda como deuda declarada en el contrato de MOI-54. | No ampliar alcance antes de la entrega; el issue admite b) para la demostración. |
| D-15 | MOI-164 | **a**: corregir en Cloud la descripción de RSK-STRA-005 de ARGA (cambio declarado de ARGA) y enlazar los riesgos de IA con su sistema. | Evita que un informe repita una afirmación jurídica falsa (anexo III 5.c solo cubre vida y salud). Recomendación del issue. |
| D-16 | MOI-204 | **a**: receta versionada desde un corte de `seq`; no se reescribe la historia de la cadena. | Regla de no reescribir trazas. Recomendación del issue. |
| D-17 | MOI-215 | Unificar ya el cálculo con la lectura técnica **(b)** de MOI-163 (tope de 24 h desde el conocimiento y 4 h desde la clasificación), marcada en código y pantalla como provisional hasta que responda el equipo legal. | Cierra la discrepancia de 20 h sin fabricar el criterio: MOI-163 sigue abierto para el equipo legal. |
| D-18 | MOI-56 | **a**: estructura propia; no se usan `governance_module_events/links` (regla 10). | Recomendación por defecto del issue. |
| D-19 | MOI-139 | **Copiar marcadas** «pendiente de revisión» las plantillas afectadas al dar de alta un grupo. La corrección de las citas en ARGA espera al Comité Legal (MOI-138). | Excluirlas dejaría sin acta cinco modos societarios. Recomendación del issue. |
| D-20 | MOI-137 | El informe del Comité Legal del 01-05-2026 se aplica **solo a ARGA**. Autorizados el guard de servidor, el cambio visible en ARGA y la incorporación. | Recomendación del issue. |
| D-21 | MOI-148 | Alta por pantalla (**A**) de la edición de matriz y porcentaje después del alta. | Es operación recurrente del cliente, no catálogo. |
| D-22 | MOI-217 | Esperar a sus bloqueadores (no se adelanta un ensayo sobre un esquema que va a cambiar). | Recomendación del triage. |

| D-23 | MOI-147/149 | Las ocho tablas de la consola sin alta van por **alta por pantalla**; el alta de grupo y el enlace cuenta-persona siguen por script. Detalle hueco a hueco en `docs/context/06-TENANT-CERO-ONBOARDING.md` §5. | Operación recurrente del cliente; el script queda para lo que se hace una vez. |
| D-24 | MOI-214 | El golden path del cuestionario se escribe contra el **grupo nuevo**, desactivado por defecto y con tope de residuo (10 sistemas `PROBE-E2E`). | Con D-12 (FK RESTRICT) una prueba que da de alta un sistema ya no puede limpiarlo; Garrigues no se ensucia. |
| D-25 | F2 (MOI-170) | La revisión v2 (`fn_aims_review_assessment` con decisión) queda **sin valores por defecto**; la pantalla sigue en la v1 hasta que haya sujetos con órgano (siembra del carril C). | Con DEFAULT, PostgREST no elegía sobrecarga y la revisión fallaba en producción. |
| D-26 | Recorrido MOI-15 | Los hallazgos del recorrido se numeran **H-32…H-36** (H-27…H-31 ya eran del bloque 5, MOI-55). H-33 (acta bloqueada sin `registration_number`) y H-32 (punto nacido en sesión) se corrigen antes de cerrar MOI-15. | El acta es el entregable del recorrido; con H-33 abierto no se genera en ninguna sociedad dada de alta por el asistente. |
| D-27 | MOI-150 | Se ejecuta con F2.T9 en el mismo cambio (el mapa fijo del órgano de IA pasa a dato). | Mismo fichero y misma solución; dos cambios separados dejarían una pantalla por dato y otra por constante. |
| D-28 | MOI-150 | El órgano de gobierno de la IA del grupo nuevo es el **Consejo de Administración de su matriz** (Corporación Nueva, S.A.), declarado por la vía de dato del producto como hipótesis a validar. | El grupo nuevo no tiene comité especializado; sin declaración, el panel falla cerrado. |
| D-29 | MOI-143 | Base de cómputo de la Junta de prueba del grupo nuevo = capital con voto de `capital_holdings` vigente (60 % / 40 %, una acción un voto). El acta real se genera el día de la Junta (12-11-2026). | Es la base legal por defecto de una SA sin estatutos especiales; la fecha no se puede adelantar (un mes de antelación) y las universales siguen cerradas. |
| D-30 | H-50 (MOI-15) | **Fallo cerrado**: ningún selector ofrece una materia decisoria sin fila en `materia_catalog`, con nota visible de las pendientes; la emisión lo bloquea. Clasificar las 14 es del Comité Legal. | Hoy se emiten convocatorias cuyas actas el servidor no deja levantar. |

## 4. Lo que queda fuera del mandato (se prepara y se deja abierto)

- Comité Legal / equipo legal: MOI-138, 140, 141 (tras 140), 163, 166, 172, 179, 198, 199, 201,
  202, 203 (tras 202), y la ratificación de umbrales de MOI-219.
- Comité de IA / CATIT: MOI-167, 178, 182, 183.
- DPO: MOI-156. Experto RIA: MOI-168. Despacho (ENS): MOI-191. EAD Trust: MOI-216.
- Personas y cuentas: MOI-153, 154, 155, 159 (y lo que dependa de ellas: 177, 217).
- Cuenta sin perfil de MOI-188.

## 5. Ejecución

Se irá anotando por oleada: ramas, commits, migraciones aplicadas (con su ensayo), pruebas y
estado de cada issue en Linear.

### 5.1 Oleadas 1 y 2 (26-09-2026 tarde – 27-09-2026 madrugada)

- Ola 1 publicada en `main` con `2a84fc18`; ola 2 con `bbd4008a`. Cada rama: implementación
  (Sonnet, worktree aislado) → revisión adversarial → corrección; ensayo revertido de cada
  migración con `/tmp/probe_rollback.py` antes de aplicarla; aplicación por el orquestador con
  registro en `schema_migrations`.
- Migraciones aplicadas: `20260926113700` (MOI-137), `114200` (MOI-142), `114800` (MOI-148),
  `115200` (MOI-152), `116400/116401` (MOI-164), `118500` (MOI-185), `119000` (MOI-190),
  `119300` (MOI-193), `120400` (MOI-204), `121000` (MOI-210), `20260927105600` (MOI-56),
  `120000` (MOI-200). Ensayos en `docs/superpowers/reviews/2026-09-26-ensayos-cloud/`.
- Pruebas al cerrar la ola 2: `bun test` 5267 / 159 skip / 0 fail; typecheck, lint y build
  limpios; arnés de producción 3/3 con los dos grupos.
- Verificación por pantalla (Playwright local contra Cloud): MOI-137, 134, 193, 195, 197, 158,
  157, 148 correctos; MOI-142 falló (UI sin cablear) → rama de corrección; bloque 5 del guion
  (MOI-55) recorrido por pantalla, con 4 sistemas de residuo declarados en el grupo nuevo.

### 5.2 Ola 3 (27-09-2026, mañana)

- F2 carril A (MOI-170) aplicado: `20260927130000…135000` (sujetos y especialidades, columnas de
  sujeto y disparador de `assessor_id`, 45 capacidades AIMS, RPC de sujetos, cuatro ojos v2,
  especialidad).
- Regresión encontrada y corregida: la v2 de la revisión con DEFAULT hacía ambigua la llamada de
  la pantalla → `20260927136000` (D-25), `aims-revisar-live` 4/4. `20260927137000` renombra
  `aims_secretaria_derivations.created_by` → `created_by_user_id` (E-01, tabla vacía).
- Gate del grupo nuevo invertido: el recorrido de MOI-146 dio de alta 2 obligaciones `OBL-GN-*`
  por pantalla; el gate vigila ahora la ausencia de RIA, no de obligaciones.
- Publicado en `main`: `a1489dee` (Vercel READY, arnés de producción 3/3) y `4cdf5802`
  (recorrido MOI-15 integrado, D-26). `bun test` 5306 pass / 159 skip, con el único rojo
  restante corregido en `a1489dee`; `e2e/10-grc` 14/14.
- Recorrido MOI-15 (4.1/4.5/4.6 por pantalla en el grupo nuevo): 4.5 y 4.6 correctos; 4.1 bloqueado
  por H-33. 9 convocatorias emitidas de residuo declaradas (no hay pantalla para retirarlas).

### 5.3 Olas 3b, 3c y 4 y cierre de MOI-142 (27-09-2026, mañana)

- MOI-142: Edge Function `convocation-artifact-register` v7 (fuente `capital_holdings`) y
  `20260927138000` (postura legal del manifiesto de Junta en la raíz: toda Junta recibía 409 al
  generar su documento). Junta `575bd05c…` del grupo nuevo emitida con documento final. La firma
  del convocante sale vacía por la variable legacy `firma_convocante_ref` (fuente QTSP) de la
  plantilla de Junta: pertenece a MOI-139/MOI-138.
- Ola 3b aplicada: `20260928100000…140000` tras ensayo encadenado revertido; siembras de terceros
  de IA (7) y aristas GRC↔IA (7). Colisión de numeración: MOI-146 pasa a H-37…H-49 (§6.8).
- Ola 3c aplicada: `20260928150000` (H-33) y `20260928151000` (H-32). Destapa H-50 (D-30).
- Ola 4 integrada: F2.T6/T8/T9/T11/T12/T13/T14/T17 y siembras T10/T15/T16 (13 sujetos de ARGA y 5
  de Garrigues, «a validar por Legal»). ARGA pasa a mostrar el CATIT como órgano de IA.
- Publicado: `4149a104` y `751db789`; `bun test` 5450 / 163 skip / 0 fail; producción 3/3.
- Ejecutor de ensayos: ahora restaura el rol y los claims entre ficheros (una sonda dejaba la
  sesión como `authenticated` y la migración siguiente no podía crear tablas).
- Pendiente: ola 5 (H-50, MOI-150 grupo nuevo, MOI-15 4.1 por pantalla, MOI-16, MOI-143).

### 5.4 Ola 5 y suspensión del carril (27-09-2026, 08:30 CEST)

- Ola 5 integrada y publicada (`548a2537`; `bun test` 5483 / 163 skip / 0 fail; producción 3/3):
  H-50 con fallo cerrado en convocatoria, punto nacido en sesión y acuerdo sin sesión (D-30; 19
  materias pendientes en MOI-319); MOI-16 (tabla de comunicaciones y custodia en
  `docs/superpowers/reviews/2026-09-27-moi16-comunicaciones-custodia.md`); MOI-143 aplicado
  (`20260928160000`, evaluador de Junta por capital; el acta real espera a la Junta del 12-11-2026,
  D-29); script y e2e de MOI-150 (solo ensayo).
- Recorrido 4.1 de MOI-15 (reunión `81a4de74…` del grupo nuevo): el punto nacido en sesión se añade
  por pantalla (`dc938c06…`), pero el acta no se genera. Hallazgos nuevos: H-51 (botón de votación),
  H-52 (la RPC del punto nacido en sesión no acepta materia) y H-53 (el manifiesto del acta exige que
  la agenda coincida exactamente con la convocatoria y rechaza los puntos nacidos en sesión).
- MOI-150: la RPC de sujetos no escribe `governing_body_id`; decisión D-28 bis, completar la RPC con
  `p_governing_body_id` en vez de fabricar una política de IA.
- **Carril suspendido por el usuario** («hasta renovación de créditos»). La ola 6 se detuvo a medias:
  `agent/moi-150rpc-ola6` tiene 1 commit sin revisar; `agent/moi-15h53-ola6`, ninguno. Nada de la
  ola 6 está aplicado en Cloud (cabecera `20260928160000`, 392 versiones).

**Para retomar:** relanzar la ola 6 con `Workflow({scriptPath: <scratchpad>/ola6.js, resumeFromRunId:
"wf_502bbd6c-fe8", args: {base: "548a2537fa06e66a86592616c86d6ef6449272b1"}})` (reutiliza lo ya hecho
por los agentes); integrar, ensayar y aplicar `20260928170000/171000/172000`; ejecutar
`scripts/aims/seed-organo-ia-grupo-nuevo.ts --commit`; recorrer por pantalla el acta de `81a4de74…`
y el panel de IA del grupo nuevo (`e2e/72-verif-moi150-organo-ia.spec.ts`); redactar y publicar los
cierres de MOI-15, MOI-16, MOI-143 y MOI-150 (comprobando después el estado real en Linear: el
publicador informó mal dos estados el 27-09); y pasar el comprobador de la skill al final.

Issues abiertos al suspender, con su motivo: MOI-15 (acta 4.1, H-51/H-52/H-53) y MOI-16 (en
revisión; falta su comentario de cierre); MOI-143 (acta real el 12-11-2026); MOI-150 (declaración
del grupo nuevo); MOI-170, MOI-175 y MOI-181 (en revisión para Moisés o terceros); y los de comités,
personas y proveedor que quedan fuera del mandato (§4), más MOI-319.

### 5.5 Conversaciones derivadas: análisis y cierres (27-09-2026, 20:30 CEST)

Encargo del usuario: analizar las conversaciones basadas en esta y cerrar issues conforme a la skill.
Son tres conversaciones hermanas, abiertas el 26-09 entre las 16:27 y las 16:46 UTC con la misma
instrucción de delegación: Suite Tax IS (P-MOI-4, archivada, con una hija del PR #172), CLM · NDA
(P-MOI-6) y PersonaTax (P-MOI-3, con dos hijas).

- Análisis con revisión adversarial de los 10 issues abiertos (Suite Tax 84/88/316/317/320,
  PersonaTax 313, Governance OS 16/143/150/15) y auditoría de coherencia (estado pretendido frente a
  estado real) de las tres conversaciones hermanas. Ningún issue abierto cumple sus criterios de
  cierre: los de Suite Tax y PersonaTax esperan un acto de Moisés (secretos en Devin, migraciones de
  producción, decisión de lectura de cuentas anuales), salvo MOI-320, técnico y sin ejecutar.
- CLM y PersonaTax **no se tocan**: sus sesiones están en marcha (CLM retomó a las 18:03 UTC;
  PersonaTax empuja arreglos de CI al PR #4) y ellas mismas corrigen sus estados. Hallazgos
  entregados al usuario: en CLM, MOI-103 está en Done con «dos de tres protecciones publicadas» y la
  protección `strict` de la rama principal de su repositorio sigue desactivada; en PersonaTax, el PR
  #4 que sostiene MOI-76/80 tenía la CI en rojo (su sesión la está arreglando) y quedan un arreglo
  sin commit (worktree `busy-joliot`) y el PR #5 sin issue.
- Escrito en Linear: MOI-16 (sigue en revisión, bloqueado por MOI-15; entregable publicado), MOI-144
  (enlace a la propuesta de adaptador), MOI-143 y MOI-150 a In Progress con comentario de avance,
  MOI-15 (avance); en Suite Tax, MOI-87 (descripción al día: decisión B por delegación), MOI-328 y
  MOI-309 (creados por la integración con GitHub sin trazabilidad: explicación en cinco apartados y
  comentario). Estados releídos en Linear después de escribir.
- MOI-61 (Suite Tax) no se reabre: su sesión dejó escrito que la puerta humana quedaba cubierta por
  la delegación y que no hubo distribución externa, el mismo criterio aplicado aquí.
- Los revisores adversariales sostienen que, según la skill, un mandato genérico no cubre cambios de
  base de datos de producción ni fusiones a `main`. Aquí se aplicó la interpretación publicada el 26-09
  (comentario del proyecto `f9bc253e`). Se deja al usuario la ratificación expresa, en un único
  comentario del proyecto.
