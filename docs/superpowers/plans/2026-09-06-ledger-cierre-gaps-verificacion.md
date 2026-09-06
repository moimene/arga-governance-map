# Ledger — segunda pasada del cierre de gaps: verificación y cierre real (2026-09-06)

Continuación de `2026-09-05-ledger-cierre-gaps.md`, que declaró los ocho criterios de salida
cumplidos con tres excepciones. Esta pasada **no da por bueno ese ledger**: vuelve a medir, y donde
no coincide, manda la medición.

---

## 0. Estado de partida, medido por el orquestador

| Gate | Resultado | Cuándo |
|---|---|---|
| `bun run db:check-target` | pass contra `governance_OS` (`hzqwefkwsxopwrmtksbg`) | 2026-09-06 |
| `bun test` | **4020 pass / 152 skip / 3 todo / 0 fail** (22 654 aserciones, 4175 tests, 460 ficheros) | antes de tocar nada |
| `bun run typecheck` | limpio | ídem |
| `bun run lint` | limpio | ídem |
| `main` vs `origin/main` | sincronizados en `2b8612d` | ídem |

Coincide con lo que decía el ledger anterior. Lo que no coincide es lo de abajo.

---

## 1. Dos criterios de salida que NO estaban cumplidos

| Criterio | El ledger del 05 decía | Medido el 06 |
|---|---|---|
| nº2 — todos los hallazgos con estado final | «123 hallazgos juzgados… ninguno queda sin veredicto» | El informe lista **257** hallazgos (215 en §2 + 42 P0 en §6). Faltaban ~134 por juzgar. |
| nº3 — e2e del cierre en verde | «tres e2e siguen rojos y son pre-existentes» | **4 rojos estables**, más 10 fallos que son *flakes* por pérdida de sesión al correr un lote largo. |

### 1.1 Cómo se contó

Los 257 hallazgos se extrajeron del informe con un script determinista (`sev`, `carril`, `bloque`,
`fichero:línea`, título), no a ojo. El desglose del informe: 56 confirmados, 13 parciales, 2
refutados y **144 sin juzgar** en §2; los 42 de §6 son todos sin juzgar. Los 139 restantes de la
segunda pasada (P1/P2) **no están listados en el informe**: solo existen en el journal del workflow
original, y el propio §6 dice que se listan «solo los P0 para que no se pierdan».

### 1.2 Re-juicio con refutación adversarial

Cuatro workflows, uno por carril, **62 agentes, 0 errores**: por cada hallazgo un juez que lo mide
contra el código de HOY (obligado a citar literal; un veredicto sin cita no vale) y un refutador
independiente que intenta romperlo, con instrucción explícita de buscar los dos errores caros: un
`YA_CORREGIDO` falso (el defecto sigue por otro camino) y un `ABIERTO` falso (hay guard superior o
la superficie está muerta).

| Estado final | Nº |
|---|---|
| YA_CORREGIDO | 155 |
| ABIERTO | 41 |
| DEUDA_CLOUD | 29 |
| DUPLICADO | 23 |
| DEUDA_LEGAL | 7 |
| REFUTADO | 2 |
| **SIN JUZGAR** | **0** |

**El refutador corrigió 16 veredictos.** Esa cifra es la que justifica la fase.

---

## 2. Lo que el refutador encontró y el cierre anterior había dado por cerrado

Todos comparten forma: **se corrigió la superficie que se estaba mirando y la misma afirmación
sobrevivió por otro camino.**

| # | Qué | Dónde |
|---|---|---|
| R-1 | TPRM dejó de **pintar** la conformidad DORA fabricada, pero su **escritura** seguía partiendo de un objeto con las seis cláusulas a `true`: marcar una persistía en Cloud cinco conformidades que nadie declaró. Peor que el defecto retirado, porque queda escrito. | `src/pages/grc/TPRM.tsx:152` |
| R-2 | Los **toasts** de incidentes dejaron de afirmar transmisión a la autoridad y a clientes; el rótulo **persistente** del botón seguía diciendo «Comunicación a Clientes Enviada». Un toast se desvanece; el rótulo se queda. | `src/pages/grc/IncidenteDetalle.tsx:438` |
| R-3 | La atribución a la guía numerada de la Agencia se retiró «del módulo entero»… salvo de `EvaluacionNueva`, que la renderiza en **siete** superficies — incluida la nota por defecto que se **persiste** en `ai_risk_assessments.notes`. Su propio e2e la prohibía y por eso no podía pasar. | `src/pages/ai-governance/EvaluacionNueva.tsx` |
| R-4 | El dashboard de GRC vació la **constante** de readiness y dio la arista por corregida: la misma afirmación sobre TPRM sigue en pantalla en prosa fija. | `src/pages/grc/Dashboard.tsx:258` |
| R-5 | La marca «Simulado» de los casos demo estaba bien puesta y bien pintada, pero no llegaba: `getStoredReports` solo sembraba si la clave de localStorage no existía, así que un navegador con la clave vieja devolvía JSON sin `firmeza`. Arista rota por **caché**, no por criterio. | `src/hooks/useWhistleblowing.ts:396` |
| R-6 | El vocabulario de estado de sistemas se unificó en dos de los tres ficheros que el hallazgo nombraba. | `src/pages/ai-governance/SistemaDetalle.tsx:422` |

---

## 3. Carril CLOUD — el P0 cerrado (autorizado por el usuario el 2026-09-06)

### 3.1 DA-1, bucket `matter-documents`

**Medido en vivo ANTES de tocar nada**, con los dos logins reales: la sesión de Garrigues
**descargaba y listaba** los justificantes registrales de ARGA. La sonda nueva
`src/test/schema/storage-tenant-isolation.test.ts` quedó en **2 fail / 2 pass** (los dos controles
positivos, verdes). Ese rojo es la prueba de que la exposición era real; no se dedujo de la política.

Por qué no se normalizan las rutas: el bucket tiene **cuatro convenciones** y solo una lleva el
tenant delante — `convocatorias/<id>` (285), `<tenant>/…` (70), `agreements/<id>` (31, legado sin
escritor vivo) y `registry/<entity>` (3). Mover 319 objetos obligaría a reescribir los
`document_url` ya persistidos y las URLs firmadas. Se resuelve el tenant dueño desde la ruta, una
rama por convención: **371 de 389 resuelven**; los 18 cuya fila dueña ya no existe dejan de ser
legibles, que es lo correcto para un huérfano.

Migración `20260906072222_matter_documents_tenant_scoped_policies`. Tras aplicarla: **4 pass / 0 fail**.

### 3.2 Un defecto peor de lo registrado

El ledger del 05 anotó que el usuario podía reescribir su `person_id`. La medición de hoy: el grant
de UPDATE por columna de `user_profiles` incluía **`tenant_id` y `role_code`**, y
`user_profiles_self_update` no tenía `WITH CHECK`. Comprobado en vivo con la sesión de Garrigues
(escritura no destructiva, el mismo valor): ambas columnas aceptan el UPDATE, 1 fila, sin error.
Como `fn_current_tenant_id()` deriva el tenant de esa misma columna cuando el JWT no trae claim, un
usuario podía **cambiarse de tenant y de rol**. Ninguna superficie de cliente escribe la tabla.

### 3.3 Resto de la migración de endurecimiento

`20260906072910_rls_grants_hardening` y `20260906074106_user_profiles_revoke_residual_grants`
cierran DA-2, DA-3, DA-4, DA-5, DA-6, DA-7 y DA-22:

- `rule_pack_versions` y `pack_rules`: la lectura pública `USING (true)` pasa a resolverse por el
  pack padre (`rule_packs` / `country_packs`, que sí tienen tenant). Además tenían concedido
  DELETE/INSERT/UPDATE/**TRUNCATE** a `anon`: la RLS bloqueaba las escrituras, pero **TRUNCATE no
  pasa por RLS** y el grant era la única defensa.
- `jurisdiction_rule_sets`: la permisiva pública se OR-eaba con la de tenant y anulaba el
  aislamiento. Retirada; quedan 16 filas, 0 con tenant NULL, así que nadie pierde lo suyo.
- `reclassify_agenda_item_kind`: `EXECUTE` revocado a `anon` (drift respecto al repo).
- `registry_filings` / `registry_filing_events`: TRUNCATE, REFERENCES y TRIGGER revocados.
- **10 columnas** con `tenant_id DEFAULT '…0001'`: default retirado. Verificado antes que las 8
  funciones que insertan en esas tablas nombran `tenant_id` explícitamente en su lista de columnas,
  así que sin default un olvido futuro falla en voz alta en vez de aterrizar en ARGA en silencio.

**No se tocó** el `COALESCE(NEW.tenant_id, ARGA)` de `fn_audit_worm`: medido que las 18 tablas que
audita tienen `tenant_id NOT NULL`, así que ese fallback es **inalcanzable**. Reescribir el trigger
de la cadena WORM para cambiar código muerto no compensa el riesgo.

### 3.4 Correcciones de dato (autorizadas, con SELECT previo mostrado)

| # | Qué | Resultado |
|---|---|---|
| DA-12 | `opened_at = 2026-08-29` (fecha del seed) en los 8 `FND-GARR-PEN-*` | 8 filas a NULL |
| DA-13 | `RSK-GARR-PEN-069` decía «Artículos del Código Penal: Ley de represión del contrabando». El contrabando se tipifica en la LO 12/1995. Es el **único riesgo rojo** del tenant | ahora «Ley de represión del contrabando», idéntico a lo que produce hoy `descripcionArticulo()` |
| DA-14 | `grc_modules` de Garrigues sin fila `esg` | sembrada con la misma forma que sus cuatro hermanas (`state='Planificado'`, contadores a 0) y `owner` acreditado: «Comité de Sostenibilidad» existe como órgano del tenant |
| DA-17 | 4 evaluaciones de ARGA con nota fabricada por un e2e que afirmaba «cumplimiento estricto de todos los artículos» del Reglamento de IA | nota sustituida por su procedencia real; 0 restantes |

---

## 4. Los e2e: 4 rojos, y son pre-existentes — medido, no inferido

Control discriminante: worktree en `45809dd` (commit anterior al cierre del 05) con **la
configuración de Playwright de hoy** — sin `channel: 'chrome'` el baseline no arrancaría y la
comparación no valdría nada.

| Ejecución | Resultado |
|---|---|
| Pre-cierre (`45809dd`, config nueva) | **5 failed / 16 passed** |
| Hoy, antes de arreglar | **4 failed / 20 passed** |

Ninguno es regresión del cierre del 05; ese cierre arregló uno. Siguen siendo trabajo pendiente
porque están en la lista del §Testing.

Y el hallazgo de método: correr los 10 specs del cierre en un solo lote da **14 fallos**; correr los
mismos en lotes pequeños da **4**. Los otros 10 son pérdida de sesión de Playwright, ya documentada
en CLAUDE.md. Un conteo de rojos sin decir en qué tamaño de lote se midió no significa nada.

---

*(Secciones 5–8 — carriles de corrección, gates finales, review adversarial y criterios de salida —
se completan al cerrar la rama.)*
