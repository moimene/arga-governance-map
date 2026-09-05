# Ledger — cierre integral de gaps por módulo, consola y coherencia (2026-09-05)

Ejecución del prompt `docs/superpowers/prompts/2026-09-05-goal-cierre-gaps-modulos.md` sobre el
informe `docs/superpowers/reviews/2026-09-02-revision-profunda-carriles-garrigues.md`.

Este fichero registra **cada decisión, cada refutación y cada deuda aceptada**. Nada se declara
cerrado sin la evidencia que lo prueba.

---

## 0. Estado de partida (medido, no declarado)

| Gate | Resultado | Cuándo |
|---|---|---|
| `bun run db:check-target` | pass contra `governance_OS` (`hzqwefkwsxopwrmtksbg`) | 2026-09-05 |
| `bun test` | **3871 pass / 152 skip / 0 fail** (21 965 aserciones, 4023 tests, 448 ficheros) | 2026-09-05, antes de tocar nada |
| `main` vs `origin/main` | 0 / 0 (sincronizados, HEAD `45809dd`) | 2026-09-05 |
| Árbol de trabajo | solo material ajeno (`.gitignore`, `README.md`, `package.json` con hunks Archify; `Gobernanza ia/`, `docs/architecture*`, `DOC GRC/`, `pkcs11.txt`, `scripts/*platform-architecture*`) — **no se toca ni se commitea** | 2026-09-05 |

---

## 1. Decisiones del usuario (tomadas antes de abrir carriles)

| # | Decisión | Efecto |
|---|---|---|
| D-1 | **Canal SII → opción (b) HONESTO** | No se hace operable contra Cloud. Persistencia local, pero la pantalla lo dice. Cero migraciones sobre `sii.*`. |
| D-2 | **Fixtures GRC → gatear por tenant + etiquetar demo** (no retirar) | Solvencia II y las vistas de `/grc/m/:moduleId` se ocultan a Garrigues (sidebar **y URL**); ARGA las conserva con marca honesta. Los valores fabricados (LEI, «Cumple RGPD», cláusulas «Conforme», ledger WORM SEALED, scores 6/3) se sustituyen por «sin dato». |
| D-3 | **Cloud → solo código** | Ninguna migración, ninguna escritura en `governance_OS`. **Todo hallazgo que solo se cierra en Cloud pasa a deuda aceptada** con dueño y motivo (§5). Incluye el único P0 unánime del informe. |

Consecuencia declarada de D-3: **el P0 del bucket `matter-documents` queda ABIERTO**. Es una
exposición cross-tenant real, no un defecto cosmético. Ver §5.

---

## 2. Método

- Cinco carriles en paralelo sobre **ficheros disjuntos** (AIMS, GRC, SII, Secretaría) más
  Consola y Coherencia ejecutadas por el hilo principal.
- Desviación declarada respecto al prompt: el prompt pedía una rama `feature/cierre-<carril>` por
  carril. Los carriles paralelos comparten un único árbol de trabajo, así que se usa **una rama con
  un commit por carril** y merge `--no-ff` a `main`. La trazabilidad por carril se conserva en los
  commits; lo que no se conserva es una rama por carril. Decisión del hilo principal, no del usuario.
- Conteo de veredictos en cuatro estados: **confirmado**, **refutado**, **parcial**, **sin_juzgar**.
  Un hallazgo sin voto no se cierra jamás. Cada hallazgo que se toca se verifica primero contra el
  código real; si no se sostiene, se refuta con motivo y evidencia `archivo:línea`.
- Arnés de mutación obligatorio en toda corrección release-crítica: reintroducir el defecto,
  comprobar que el test se pone **ROJO**, restaurar solo el fichero mutado. Un test que no puede
  fallar no cuenta como gate.

---

## 3. Carril CONSOLA — cerrado (hilo principal)

Primer slice del §3 del informe, enfoque ganador **read-model-primero**. Sin tocar Cloud.

### 3.1 El defecto de fondo

`src/hooks/useModuleStatus.ts` filtraba por `incidents.module_id`. **Esa columna no existe en
Cloud** (verificado 2026-09-05: `incidents` tiene `id, tenant_id, code, title, description,
severity, incident_type, is_major_incident, status, …` y ninguna columna de módulo), y los estados
consultados (`OPEN|ABIERTO|IN_PROGRESS`) tampoco son los reales (`Abierto | Cerrado |
En investigación | Resuelto`). El `count ?? 0` del hook se tragaba el error de PostgREST.

**El KPI «Incidentes DORA abiertos» de la consola era un 0 falso desde su creación**, y ningún test
lo veía. La consulta SII, además, iba **sin filtro de tenant**.

### 3.2 Qué cambió

| Superficie | Estado | Evidencia |
|---|---|---|
| Read model de módulos | **REAL** | `src/hooks/useModuleStatus.ts` — cada campo pasa por `measured()`; `error → null`, nunca 0. Tipo `Measured = number \| null`. |
| KPI de incidentes | **REAL** | mismo fichero: `.eq("tenant_id").neq("status", INCIDENT_CLOSED)` + segundo recuento por `is_major_incident`. El rótulo pasa a «Incidentes mayores abiertos»: `incidents` no distingue régimen. |
| Sub-rótulo DORA | **REAL (gateado)** | `src/components/arga-console/ErpConsolePanel.tsx` — `doraEnabled` vía `isModuleEnabled`; `src/pages/Dashboard.tsx` lo cablea. |
| Evaluaciones IA | **REAL** | `AI_ASSESSMENT_RESOLVED = ["APROBADO","CONFORME"]` — el producto persiste `CONFORME`, el dato legacy es `APROBADO`; el contrato de lectura tolera ambos. |
| Card SII de la consola | **REAL** | `.eq("tenant_id")` añadido; antes contaba sin filtro. |
| Alertas / KPIs / próximas reuniones | **REAL** | `src/hooks/useDashboardData.ts` — `tenantId` en la queryKey, `enabled: !!tenantId` y `.eq("tenant_id")` en `entities`, `condiciones_persona`, `policies`, `findings`, `delegations`, `notifications`, `meetings`. |
| Bloque probatorio e integración | **REAL (solo lectura)** | `src/hooks/useConsoleReadModel.ts` (nuevo) — `evidence_bundles` por estado y `governance_module_events`/`links`, tenant-scoped. Cero escrituras. |
| Postura de `governance_module_*` | **HONESTO (corregido)** | `contracts.ts` y `platform-readiness.ts` decían `sourcePosture: "none"` («no visible en migraciones/tipos»). En Cloud **ambas tablas existen** con RLS `*_tenant_isolation` y filas (ARGA 2 eventos / 3 links; Garrigues 0/0). Pasa a `"Cloud"`; el `status` sigue `"pending"` porque lo pendiente son las escrituras. |
| Composición de readiness | **REAL** | `composePlatformReadiness(lanes, measured)` — función pura. **No promociona ni degrada `status`**: la declaración del owner manda; medir 114 bundles no saca del HOLD al bloque probatorio. |
| Presentación de cifras | **HONESTO** | `src/lib/arga-console/measured.ts` (nuevo) — `null` → «no medido» / «—», nunca 0; tono neutro cuando no se ha medido (antes un `null` salía en verde de éxito). |

### 3.3 Gates de este carril

| Gate | Resultado |
|---|---|
| `bun test src/lib/arga-console` | 12 pass / 0 fail / 75 aserciones |
| `bun test src/test/schema/console-read-model.test.ts` (**logins reales ARGA + Garrigues**) | 8 pass / 0 fail / 55 aserciones |
| `tsc -b` sobre los ficheros del carril | 0 errores |

### 3.4 Arnés de mutación — los gates caen

| Mutación | Resultado |
|---|---|
| `measured()` vuelve a `count ?? 0` (traga el error) | **1 fail** ✅ |
| `INCIDENT_CLOSED = "CERRADO"` (vocabulario que no existe en Cloud) | **1 fail** ✅ |
| `formatMeasured(null)` devuelve `"0"` | **2 fail** ✅ |
| restaurado | 20 pass / 0 fail |

La sonda Cloud ata las constantes del hook al vocabulario real de las tablas: no es un rótulo, es
una arista. Y asierta las **dos** mitades — que la consulta vieja **sigue** fallando (lo que prueba
que el 0 era falso) y que la nueva no falla en ninguno de los dos tenants.

### 3.5 Lo que la consola NO hace, a propósito

Ninguna escritura; ninguna migración, vista, RPC ni función nueva; no promociona readiness por
dato; no absorbe `src/lib/grc/dashboard-readiness.ts` ni `src/lib/aims/readiness.ts` (siguen siendo
readiness **declarado** del owner); no lee localStorage, así que el KPI del SII será 0 o «no medido»
mientras `sii.cases` esté vacío; no siembra dato para que la consola «luzca». **Garrigues ve la
verdad de Cloud**, y hay un control discriminante que lo prueba (ARGA >0 eventos, Garrigues 0).

### 3.6 Cambios visibles en ARGA (anunciados, no silenciosos)

1. El KPI de incidentes deja de ser 0 y pasa a mostrar los incidentes abiertos reales.
2. El rótulo «Incidentes DORA abiertos» pasa a «Incidentes mayores abiertos» (`incidents` no
   distingue régimen; el rótulo anterior afirmaba una clasificación inexistente).
3. Donde una consulta falle aparecerá «no medido» / «—» en vez de 0.

---

## 4. Carril COHERENCIA — cerrado (hilo principal)

| # | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| C-1 | `logout()` era solo `signOut()`; **0 llamadas a `queryClient.clear` en todo `src/`**. La caché de TanStack sobrevivía al cambio de sesión. | **CORREGIDO** | `src/context/AuthContext.tsx` — vacía la caché en **todo cambio de identidad** (no solo en logout), que es donde ocurre la fuga. Test de comportamiento en `src/context/__tests__/auth-cache-isolation.test.tsx`. |
| C-2 | `/grc/m/:moduleId` solo gateaba `dora`: Garrigues alcanzaba por URL directa vistas con fixtures de aseguradora. | **CORREGIDO** | Guards extraídos a `src/components/module-guards.tsx`; `RequireGrcModule` gatea por el `moduleId` real. ARGA (branding NULL) no cambia porque `isModuleEnabled` falla ABIERTO. |
| C-3 | El tour escribía `sii_access_confirmed` en `sessionStorage`: **saltaba la puerta de acceso** del módulo con el dato más sensible. | **CORREGIDO** | `src/context/TourContext.tsx` — bypass retirado. |
| C-4 | El tour afirmaba «logs independientes», «cifrado de evidencias», «Log de auditoría independiente: cada acceso queda registrado en un sistema separado» y badge «CASO-SII-001 activo». Nada de eso ocurre. | **CORREGIDO** | mismo fichero: copy honesto, expedientes marcados como simulados y sin persistencia. |
| C-5 | `Documentacion.tsx` enlazaba al SII tres veces sin consultar `isModuleEnabled`; además prometía «revisa casos admitidos» cuando no existe fase de admisión. | **CORREGIDO** | `src/pages/Documentacion.tsx` — entradas gateadas por módulo y copy corregido. |
| C-6 | `useBodyMandates` cacheaba sin `tenantId` y consultaba `condiciones_persona` sin `.eq("tenant_id")`. | **CORREGIDO** | `src/hooks/useBodies.ts`. La tabla sí tiene `tenant_id` (verificado en Cloud). |
| C-7 | `useDelegationsList` / `useDelegationBySlug` sin `tenantId` en la clave, sin `enabled` y sin filtro; `slug` es clave natural. | **CORREGIDO** | `src/hooks/useDelegations.ts`. Cloud tiene delegaciones en **ambos** tenants (ARGA 6 / Garrigues 2): el riesgo era real, no teórico. |
| C-8 | `useCapabilityMatrix` con queryKey sin `tenantId`. | **REFUTADO** | `capability_matrix` **no tiene columna `tenant_id`** en Cloud (columnas: `id, role, action, enabled, reason, created_at`; 40 filas). Es una matriz global del producto —qué puede hacer cada ROL—, no dato de tenant. Añadir el tenant a la clave solo multiplicaría entradas idénticas. Motivo escrito en el propio fichero. |
| C-9 | Handoffs cross-module deben ser read-only por navegación. | **VERIFICADO INTACTO** | 0 escrituras a `governance_module_events` / `governance_module_links` en `src/` (grep de insert/update/upsert/delete). Contrato en `src/lib/secretaria/cross-module-handoff.ts`. |

### 4.1 Gates y arnés de mutación

| Gate | Resultado |
|---|---|
| `bun test src/context/__tests__/auth-cache-isolation.test.tsx` | 4 pass / 0 fail |
| `bun test src/components/__tests__/module-guards.test.tsx` | 5 pass / 0 fail |
| `tsc -b` sobre los ficheros del carril | 0 errores |

| Mutación | Resultado |
|---|---|
| `logout` vuelve a ser solo `signOut()` y se retira el `clear` del listener | **3 fail** ✅ (y el control negativo sigue verde: un refresco de token **no** debe tirar la caché) |
| `RequireGrcModule` vuelve al guard solo-`dora` | **1 fail** ✅ |
| restaurado | 9 pass / 0 fail |

### 4.2 Aislamiento cross-tenant ampliado (criterio de salida nº4)

El read model de la consola pasó a contar tablas que el gate de aislamiento no vigilaba. Una tabla
que la consola cuenta y el gate no mira es exactamente el hueco por el que un número cruza de
tenant, así que `DOMAIN_TABLES` pasa de **9 a 16 tablas**: `delegations`, `notifications`,
`condiciones_persona`, `incidents`, `evidence_bundles`, `governance_module_events` y
`governance_module_links`.

Antes de asertar se midió si cada dirección sería vacua (Cloud, solo SELECT, 2026-09-05):

| Tabla | ARGA | Garrigues | Dirección ARGA→Garrigues |
|---|---|---|---|
| `notifications` | 43 | 1 | real |
| `delegations` | 6 | 2 | real (marcadores `GARR-DEL-2026-01`, `GARR-DEL-EAD-CD`) |
| `condiciones_persona` | 247 | 572 | real |
| `incidents` | 4 | 0 | **vacua → declarada** con motivo y fuente |
| `evidence_bundles` | 114 | 0 | **vacua → declarada** |
| `governance_module_events` | 2 | 0 | **vacua → declarada** |
| `governance_module_links` | 3 | 0 | **vacua → declarada** |

Las cuatro vacuas se declaran en `src/test/garrigues/aislamiento-declarado.ts`, que **no es una
exención**: si una tabla declarada vacía deja de estarlo, el gate rompe igual.

| Gate | Resultado |
|---|---|
| `bun test aislamiento-declarado.test.ts tenant-isolation.test.ts` (logins reales) | **48 pass / 0 fail / 241 aserciones** |

| Mutación | Resultado |
|---|---|
| declarar que Garrigues **sí** tiene incidentes (falso) | **2 fail** ✅ |
| retirar el motivo de una ausencia declarada | **1 fail** ✅ |
| restaurado | 48 pass / 0 fail |

---

## 5. Deuda aceptada (consecuencia directa de D-3: solo código)

Ninguno de estos se cierra sin escribir en `governance_OS`. Todos quedan **abiertos**, con dueño.

| # | Deuda | Severidad | Dueño | Por qué no se cierra hoy |
|---|---|---|---|---|
| DA-1 | **Bucket `matter-documents`: las tres políticas de `storage.objects` discriminan por bucket y no por tenant.** Cualquier usuario autenticado lee y escribe los documentos registrales de cualquier tenant. Único P0 unánime del informe (3/3). | **P0 abierto** | Owner de plataforma / Supabase | Solo se cierra con migración de políticas de storage. D-3 lo excluye. |

**DA-1 — medición propia, 2026-09-05** (no se toma del informe; `pg_policies`, solo SELECT):

| Política | cmd | roles | USING | WITH CHECK |
|---|---|---|---|---|
| `matter_documents_authenticated_select` | SELECT | `{authenticated}` | `bucket_id = 'matter-documents'` | — |
| `matter_documents_authenticated_insert` | INSERT | `{authenticated}` | — | `bucket_id = 'matter-documents'` |
| `matter_documents_authenticated_update` | UPDATE | `{authenticated}` | `bucket_id = 'matter-documents'` | `bucket_id = 'matter-documents'` |

No hay ninguna referencia a tenant en las tres expresiones. La exposición es real y sigue abierta.
| DA-2 | `rule_pack_versions_read`: política `USING (true)` para `{public}` sobre una tabla sin `tenant_id`; una sesión `anon` lee las 94 filas con los payloads de mayorías. | P1 | Owner de plataforma | Migración de RLS. |
| DA-3 | `jurisdiction_rule_sets`: coexisten `public_read USING(true)` y `tenant_isolation`; al ser permisivas se OR-ean y la lectura queda pública. | P2 | Owner de plataforma | Migración de RLS. |
| DA-4 | `reclassify_agenda_item_kind` con `EXECUTE` concedido a `anon` en Cloud (drift respecto al repo, que solo concede a `authenticated, service_role`). | P2 | Owner de plataforma | `REVOKE` en migración. |
| DA-5 | `pack_rules`: política `public_read` con `qual = true` sobre una tabla sin `tenant_id`. | P2 | Owner de plataforma | Migración de RLS. |
| DA-6 | `user_profiles_self_update` sin `WITH CHECK` + grant de UPDATE por columna sobre `person_id`: un usuario puede reescribir su propia identidad de persona. | P1 | Owner de plataforma | Migración de política. |
| DA-7 | **10 columnas** con `tenant_id DEFAULT '…0001'` (ARGA) y un trigger `SECURITY DEFINER` con `COALESCE(NEW.tenant_id, '…0001')`: un INSERT de service_role sin tenant aterriza en ARGA en silencio. | P2 | Owner de plataforma | Migración. |
| DA-8 | Contenido legal en dato Cloud: RD 84/2015 citado como desarrollo de la Ley 20/2015 en **4 plantillas ACTIVAS de ARGA**; «60 días / art. 19 RRM» en los packs ACTIVOS `MODIFICACION_ESTATUTOS` y `REDUCCION_CAPITAL`; art. 14 LOSSEAR en `SEGUROS_RESPONSABILIDAD`; LME derogada en `materia_catalog`; rótulos de firma/sello con variables `QTSP.*` en 12 plantillas ACTIVAS. | P1 | Comité Legal + Secretaría | Requiere el ciclo de estado de plantillas (archivar + nueva versión) y criterio legal. Varias tocan además criterios reservados. |
| DA-9 | Datos ya sembrados en Cloud con defecto de origen: descripción del riesgo ROJO de Garrigues («Artículos del Código Penal: Ley de represión del contrabando» — el contrabando es LO 12/1995); `opened_at` de los 8 hallazgos penales = fecha del seed; 4 evaluaciones de ARGA con notas fabricadas por un e2e; fila huérfana `CASO-SII-001` en `sii.cases` con tenant inexistente; fila `esg` de `grc_modules` declarada y nunca escrita. | P2 | Owners de carril | Corrección en el fichero fuente sí; limpieza del dato ya sembrado, no. |
| DA-10 | Criterios reservados al **Comité Legal**, no decididos por el orquestador: plazos art. 17/19 RRM; art. 308 supresión vs exclusión; NULL=ANY en órgano/adopción/tipo social; `SOCIO_UNICO`≈Junta; corrección del extractor de mayoría anidada (`rule-pack-params.ts`, que solo lee claves de primer nivel mientras los 94 packs anidan bajo `votacion.mayoria`); plazo de oposición de acreedores en fusión. | — | Comité Legal | Fuera del alcance del orquestador por instrucción expresa del prompt. |
| DA-11 | El terminal registral exige `evidence_status = 'EVIDENCE_VERIFIED'` y **ningún RPC, hook ni Edge Function escribe ese valor**: INSCRITA/DEPOSITADA/LEGALIZADA son inalcanzables desde la app. | P1 | Secretaría (servidor) | El camino de escritura es server-side; no se inventa desde el cliente. |

---

## 6. Carril GRC Compass — cerrado

**26 hallazgos: 25 CORREGIDOS, 1 corregido con el fichero de origen REFUTADO.** 5 deudas Cloud.

### 6.1 Refutación con evidencia propia

El hallazgo 23 atribuía a `scripts/garrigues/hallazgos/enlazar-hallazgos.ts` la fecha de detección
fabricada de los 8 `FND-GARR-PEN-*`. **Ese fichero no crea findings ni escribe `opened_at`**: solo
renombra y enlaza. El origen real es `scripts/seed-garrigues-penal.ts`, que **omitía** el campo y
dejaba actuar el `DEFAULT CURRENT_DATE`. Corregido ahí (`opened_at: null`). El informe señalaba el
fichero equivocado.

### 6.2 Qué se cerró (resumen; detalle en el informe del carril)

| Bloque | Estado |
|---|---|
| KPIs de Penal (`\|\| 9`, `\|\| 12`) | **REAL** — `esRiesgoPenal` reconoce `module_id='penal'` **o** `-PEN-` en el código: cubre los 18 de ARGA y los 82 de Garrigues. Error → «sin dato». |
| Fixtures de aseguradora en las 5 categorías penales | **RETIRADOS** — ~40 líneas de pólizas y primas; el chip deja de decir CONFORME sobre fixtures. |
| Score inherente/residual fabricado (6/3) | **REAL** — `nivelRiesgo()` nunca devuelve un número ausente de la fila; banda ordinal donde la hay. |
| Claims de sello y custodia en Penal | **RETIRADOS** — «QSeal Custodia», «Prueba forense inmutable», «Verificar QSeal», «EAD Trust Custody ID», «bundle WORM cualificado», `custody_provider: "EAD Trust Qualified TSP"`, responsable inventado. |
| TPRM: LEI, país «Cumple RGPD», subcontratistas, 6 cláusulas «Conforme», ledger WORM SEALED | **REAL / RETIRADO** — `SIN_DATO`; el plan de salida consulta `evidence_bundles` de verdad. |
| TPRM: el alta escribía conformidad no declarada | **CORREGIDO** — valores «Pendiente». |
| Solvencia II (SCR 214 %, «Remitido a DGSFP», «Acreditado y Vigente») | **HONESTO + gateada** — `moduleKey:"solvencia-ii"`. |
| 7 pantallas de módulo con fixtures de aseguradora | **HONESTO** — `DemoFixtureNotice` en todas. |
| Toasts «transmitida formalmente a la autoridad» / «remitida a clientes» | **CORREGIDO**; solo se pinta el reloj que se calcula. |
| `Findings` sin tenant en clave/`enabled`/filtro; `useControlByCode` ídem | **REAL** |
| `Sostenibilidad` con `tenantId === null` | **REAL (falla cerrado)** |
| Gates vacuos ESG / g5-mapa-penal / obligaciones-seed | **ANCLADOS** |

### 6.3 Gates del carril

`tsc -b` exit 0 (`tsconfig.app.json`: 0 errores) · `eslint` sin salida · `bun run build` exit 0
(47,83 s) · `bun test` del carril **125 pass / 0 fail / 1024 aserciones** · sondas Cloud
`g5-mapa-penal` 16 pass / 1813 aserciones y `garrigues-obligaciones-seed` 10 pass / 178 aserciones.

**Arnés de mutación: 6 mutaciones, 6 rojos** (`esRiesgoPenal` restringido → 1 fail; `nivelRiesgo`
de vuelta a `|| 6` + `ceil(inh/2)` → 4 fail; plantilla CP siempre → 1 fail; sin `moduleKey` → 1
fail; guard ESG con `null` → 1 fail; TPRM de vuelta al backlog → 2 fail). Restaurado: 84 pass / 0 fail.

### 6.4 Qué ve ARGA distinto (5 cambios, todos corrección de defecto probado)

1. Penal: «Obligaciones jurídicas» pasa de **12 inventado a 0 real** — ARGA no tiene ninguna
   obligación penal en Cloud. Sus 18 riesgos dejan de repetirse en los 5 acordeones. El residual
   deja de mostrarse: los 18 lo tienen NULL.
2. TPRM: los 5 proveedores muestran «sin dato» donde el `payload` no trae el campo.
3. Solvencia II: etiquetada demo, KPIs «sin dato». Sigue visible.
4. Dashboard: «Riesgos críticos» declara que 159 de 167 no tienen residual; desaparece el chip
   «No conectado ahora: TPRM», que era falso.
5. Las 7 pantallas de módulo muestran el aviso de demo (decisión D-2: se etiquetan, no se retiran).

El gateo por módulo falla ABIERTO con `branding` NULL, así que ARGA conserva menú y rutas.

### 6.5 Deudas Cloud añadidas por este carril

| # | Deuda | Cierre |
|---|---|---|
| DA-12 | `findings.opened_at = 2026-08-29` en los 8 `FND-GARR-PEN-*` (el script ya no lo fabrica; el dato sembrado sigue). | `UPDATE findings SET opened_at = NULL` sobre esas 8 filas. |
| DA-13 | `risks.description` de `RSK-GARR-PEN-069` dice «Artículos del Código Penal: Ley de represión del contrabando» (el contrabando es LO 12/1995). Es el **único riesgo ROJO** del tenant. | Re-ejecutar `seed-garrigues-penal.ts --apply`. |
| DA-14 | `grc_modules` de Garrigues sin fila `esg`; `/grc/sostenibilidad` sigue siendo ruta huérfana. | Migración. |
| DA-15 | ARGA tiene 18 riesgos con `module_id='penal'` pero `penal` no está en su `grc_modules`. El selector lo marca «no declarado para este grupo» en vez de perderlo. | Migración o limpieza de dato. |
| DA-16 | `controls.code` sin índice único por tenant (el hook ya filtra; el índice no existe). | Migración. |

---

## 7. Carril SII / canal interno — cerrado (opción **b**, honesto)

**22 hallazgos: 22 CORREGIDOS, 0 refutados**, y el carril encontró **2 defectos más de la misma
clase** que el informe no traía.

### 7.1 Lo sustantivo

| Superficie | Estado | Evidencia |
|---|---|---|
| Identidad del circuito (instructora, owner, órgano aprobador, causa de recusación) | **REAL, resuelta por tenant** | `src/lib/sii/roles-por-tenant.ts`. ARGA conserva la suya; Garrigues usa `SII_ROLES`; **cualquier otro tenant recibe «Pendiente de designación»**, nunca una persona prestada. |
| Plazo del art. 9.2.d | **REAL** | `whistleblowing-engine.ts:270` — base = **recepción**; el día 7 solo si no hubo acuse. Texto transcrito del consolidado del BOE. |
| Puntualidad del acuse | **REAL** | `ackSentOnTime` + KPI en `SiiDashboard.tsx` — antes contaba presencia, no puntualidad. |
| Cita del libro-registro | **REAL** | art. **26.1/26.2**, cotejado contra BOE-A-2023-4513 con `pdftotext -layout`. |
| Persistencia | **HONESTO** | `SII_AVISO_PERSISTENCIA_LOCAL` pintado en las 5 pantallas. |
| Expedientes sembrados (3 ARGA + 3 Garrigues) | **HONESTO** | `firmeza` propagada y **pintada** en lista y detalle. |
| Asientos del libro-registro | **HONESTO** | badge «Generado al vuelo / Incorporado al cierre». |
| Firma, sello EAD, cifrado, «log de auditoría independiente», exportación «Certificada (WORM)» | **RETIRADOS** | `SiiPortalIntake.tsx:585`, `SiiLayout.tsx:56-61,111-113`, `SiiSafeInbox.tsx:64,101-109,142`, `SiiLibroRegistro.tsx:65-71`. |
| Código de seguimiento | **REAL** | `crypto.getRandomValues` en vez de `Math.random()`; retirado el prefijo `SHA256:` que fingía un hash. |
| `RETENCION_3M_NO_INVESTIGACION` (tipo muerto) y badge «2» del sidebar | **RETIRADOS** | |

### 7.2 Los dos defectos añadidos

1. El caso demo `SII-GARR-2026-003` no solo traía `status: "ADMITIDA"` fuera del union: también
   `WEB_IDENTIFICADO` y `CONFIDENCIAL`, **tampoco en sus uniones**. Causa raíz: `casosDemoGarrigues()`
   no estaba tipada y el consumidor la casteaba. Tipada + cast retirado ⇒ ahora los caza `tsc`.
2. Los tres `resolutionDeadline` de los fixtures de ARGA mostraban en pantalla una fecha **por
   encima del máximo legal** del art. 9.2.d, consecuencia del mismo error de base de cómputo.

### 7.3 Gates y arnés

`typecheck` exit 0 · `eslint` limpio · `bun run build` exit 0 (1 m 11 s) · suite SII **91 pass /
0 fail / 269 aserciones** (antes 61 tests).

| Mutación | Resultado |
|---|---|
| revertir las 9 superficies al código anterior | **16 fail / 13 pass** — los 11 patrones nuevos del guard disparan (sellado EAD, «Firmar», SHA256, WORM, «cifrado», alta entropía, «admitido a trámite», log independiente, EXIF, «Artículo 34») |
| `initialReportsFor` devuelve siempre ARGA; un tenant sin designación hereda la instructora | **6 fail** |
| `firmeza` descartada; `sanitizeMetadata` vuelve a empujar constantes; base de 3 meses al acuse | **5 fail** |

Señuelos retirados y verificado (`grep -rn "SEÑUELO"` vacío).

### 7.4 Qué ve ARGA distinto

Banner «3 de 3 expedientes están simulados» + badge «Simulado» por fila; avisos de persistencia
local; el badge de cabecera pasa de «Entorno segregado · Log independiente» a «Zona separada ·
Datos solo en este navegador»; se retira la cita «PI-31 §4» (política de Garrigues); **tres fechas
de vencimiento corregidas** por defecto probado. Instructora, órgano aprobador y causa de
recusación de ARGA quedan **literalmente idénticos**.

### 7.5 Aviso de método (registrado, no minimizado)

El carril usó `git checkout HEAD -- <sus rutas>` para probar que sus guards caen, **sobre un árbol
compartido con tres carriles escribiendo**. Restauró de inmediato y el hilo principal verificó
después, fichero a fichero, que ni sus cambios ni los de consola, coherencia y GRC se habían
perdido. Salió bien, pero es un atajo peligroso: la mutación debe hacerse sobre copia.

---

## 8. Correcciones del hilo principal sobre lo entregado

No todo lo que entrega un carril está cerrado: se juzga.

| # | Qué | Dónde |
|---|---|---|
| I-1 | GRC dejó **dos residuos de la clase que estaba retirando**: la pestaña rotulada «Evidencias **Forenses**» sobre bundles sin sello ni firma, y `evidence.reference_code \|\| \`WORM-${id}\`` , que **fabricaba una referencia de custodia WORM** para toda evidencia sin código. Corregidos por el hilo principal. | `src/pages/grc/PenalAnticorrupcion.tsx:453,672` |
| I-2 | `e2e/grc-dora.spec.ts` **no era un guard: era el contrario**. Asertaba como comportamiento esperado «Sellar Evidencia QSeal», «Certificación Forense QSeal (EAD Trust)», «QSeal Custodia», «PLAN DE SALIDA SELLADO EN LEDGER WORM» y «Evidencias Forenses» — o sea, retirar las mentiras ponía el e2e en rojo y daba un motivo para reintroducirlas. Reescrito como guard de ausencia **con control positivo** en cada test (una página en blanco no lo satisface). | `e2e/grc-dora.spec.ts` |
| I-3 | Ese mismo e2e **creaba un proveedor nuevo en Cloud en cada ejecución** (`'Proveedor Test E2E - ' + Date.now()`), sembrando `grc_third_parties` con basura de test — el mismo vicio que dejó 4 evaluaciones fabricadas en `ai_risk_assessments`. Ahora es de solo lectura. | ídem |
| I-4 | Verificado por el hilo principal el criterio de pertenencia penal que eligió GRC: `module_id='penal' OR code ~ '-PEN-'` da **18 en ARGA y 82 en Garrigues**, sin falsos positivos (medido en Cloud). | `src/lib/grc/penal-scope.ts` |

---

## 9. Carril AIMS / AI Governance — cerrado

**29 hallazgos: 26 CORREGIDOS, 1 REFUTADO, 2 corregidos con la mitad refutada.**
**21 mutaciones, 21 en ROJO**, ejecutadas *después* de arreglar.

### 9.1 Refutaciones con evidencia

| # | Veredicto | Motivo |
|---|---|---|
| 10 | **REFUTADO** | El hallazgo describía `src/pages/grc/IncidenteDetalle.tsx` (carril GRC), no el de AI Governance. En `src/pages/ai-governance/IncidenteDetalle.tsx:179-181` cada countdown usa su propio reloj y **no existen** `nis2Clocks`/`gdprClocks`. |
| 4 | mitad refutada | `IncidenteNuevo.tsx:44` **ya** respetaba `?system_id=`. Lo roto eran las 3 rutas `/nueva` → `/nuevo`. |
| 14 | mitad refutada | `Sistemas.tsx` **ya** pintaba el literal crudo con chip neutro. El defecto real era el **filtro**: 3 de 8 sistemas (`En revision`/`Pendiente`/`Conforme`) no eran alcanzables. |

### 9.2 Tres gates ciegos cazados por la propia batería de mutación

Esto es lo más valioso del carril, porque son fallos que la verificación normal no ve:

- **M15** — el gate del régimen DORA pedía «existe un guard»; con dos superficies DORA en el mismo
  fichero, desgatear una quedaba satisfecha por la otra. Ahora cuenta usos de la puerta contra
  menciones del régimen.
- **M17** — `/regimenesEnCurso/.test(src)` lo satisfacía **su propia declaración** con el banner ya
  muerto. Ahora exige el cálculo **y** el uso en el texto.
- **M18** — el comentario que explicaba la corrección contenía las palabras que el gate buscaba.
  Se añadió un filtro de comentarios y se comprueba el texto de pantalla, no la prosa que lo justifica.

### 9.3 Lo sustantivo

`guideRef` **retirado del módulo entero** (tipos + 12 requisitos + 84 medidas), no solo de pantalla:
10 de 12 atribuciones de Guía AESIA eran incorrectas y lo que no existe no se puede re-renderizar.
`subpartId` deja de pintarse como cita de apartado y letra; se conserva el artículo del Reglamento,
que sí es correcto. Tri-estado real de alto riesgo (`undefined ≠ false`), así que con `risk_level`
NULL la ficha ya no afirma que el sistema «consta clasificado fuera del alto riesgo». Predicado
único que acepta el `CONFORME` que el producto escribe **y** el `APROBADO` legado, con test que
cruza escritura→lectura derivando los casos del camino real. Retirados los claims de precinto y de
hash SHA-512 (ninguna tabla del expediente tiene columna de hash), `qseal_token`/`tsq_token` de los
tipos, y el código muerto (`AiLayout.tsx` sin importadores, `useUpdateAssessment` —que **mutaba por
id sin ninguna condición de tenant**—, `RegulatoryClock`, `CHECK_STATUS_CHIP`).

### 9.4 Gates

`typecheck` limpio · `lint` limpio · carril **167 pass / 0 fail / 914 aserciones** (línea base 144)
· `build` pass.

### 9.5 Qué ve ARGA distinto

Desaparece la atribución de Guía AESIA por requisito (10 de 12 estaban mal) y el rótulo
«Subapartado: 17.1.a»; la nota de las 4 evaluaciones «APROBADO» sigue visible pero **rotulada como
nota libre, no como conclusión de auditoría**; los chips y filtros toleran las grafías reales que
ARGA ya tiene en Cloud (antes 3 de sus 8 sistemas no eran alcanzables por el filtro); tres botones
que llevaban a rutas inexistentes funcionan. La tarjeta DORA sigue visible para ARGA
(`branding` NULL → falla abierto).

### 9.6 Deudas añadidas

| # | Deuda | Cierre |
|---|---|---|
| DA-17 | 4 filas de `ai_risk_assessments` de ARGA (`137610a4`, `f26e844b`, `802d9278`, `68f23d26`) siguen con `status='APROBADO'`, `score=100` y la nota fabricada que escribió un e2e el 2026-07-19. El spec ya no puede volver a crearlas. | Limpieza de dato, decisión del dueño. |
| DA-18 | «AESIA Guía 16» sigue como encuadre del módulo (H1, badge). No era el defecto medido —que era la atribución *por requisito*— y retirarlo es decisión de producto. Su verificación contra publicación oficial sigue abierta. | Producto. |
| DA-19 | `aims_regulatory_clocks` sigue en Cloud sin lector ni escritor: los relojes se calculan en cliente y no se persisten. | Owner AIMS. |
| DA-20 | El e2e reescrito **no se ha ejecutado**: su cortafuegos anti-escritura está verificado *por construcción, no medido*. | Ejecución con servidor. |

---

## 10. Correcciones del hilo principal, 2ª tanda

La suite completa quedó en 3 fallos tras GRC + AIMS. **Ninguno era de los carriles: los tres eran
gates que fijaban lo que había que retirar, o su propia justificación.**

| # | Qué | Dónde |
|---|---|---|
| I-5 | `ead-interposition-product-policy.test.ts` — un test de **política de producto** exigía `toContain("PLAN DE SALIDA CUSTODIADO EN LEDGER WORM")`, `toContain("QSeal no personal")` y `toContain("Custodia documental (EAD Trust)")`. Es decir: **retirar las afirmaciones sin respaldo ponía el gate en rojo**, premiando conservarlas. Es la misma forma que tenía el e2e (I-2). Las positivas pasan a negativas y se añade control positivo de que los fuentes se leyeron. | `src/test/secretaria/ead-interposition-product-policy.test.ts:70` |
| I-6 | `empirical-challenger-m1.test.ts` — dos tests de neutralidad de identidad exigían la **presencia** de un nombre por defecto («Auditor de Cumplimiento») que GRC retiró justamente para no prefabricar un responsable. La invariante real es «cero identidad fabricada»: se conserva y se comprueba directamente, con control positivo. | `src/test/empirical-challenger-m1.test.ts:162` |
| I-7 | **El mismo gotcha, tres veces en un día**: el comentario que EXPLICA una retirada contiene la frase que el gate prohíbe, así que el gate se dispara contra su propia justificación — y la salida fácil sería borrar el comentario. Extraído `src/test/helpers/sin-comentarios.ts` y aplicado en los dos ficheros. AIMS lo cazó por su cuenta en su mutación M18. | `src/test/helpers/sin-comentarios.ts` |
| I-8 | `empirical-challenger-m2.test.tsx` y `m2-empirical-challenger.test.tsx` mockeaban `@/context/AuthContext` **sin la restauración** que el resto del repo usa. Como `mock.module` de bun es global al proceso, su stub se fugaba y tumbaba el test de aislamiento de caché. Añadida la restauración a ambos. | los dos ficheros |

---

## 11. Carril Secretaría Societaria — cerrado

**26 hallazgos: 20 CORREGIDOS, 3 PARCIALMENTE REFUTADOS con evidencia, 3 con la cifra corregida.**

### 11.1 Refutaciones con evidencia propia

| # | Qué decía el informe | Qué se midió |
|---|---|---|
| 13 | Rótulos «Firma del Administrador Único: {{QTSP.firma_admin_ref}}» y «Sello de tiempo» en `legal-template-fixtures.ts:506`. | **No están ahí.** Viven en un test de renderizado y en el *normalizador que los borra*. Lo que sí había en :506 era «Referencia ERDS», corregido. |
| 24 | «Gate de texto sobre un hecho falso»: Cloud seguiría concediendo DML a `anon`. | **La premisa es falsa**: `INSERT/UPDATE/DELETE` ya están revocados (medido en `role_table_grants`). El defecto real era que el gate fuese textual; ahora es sonda de comportamiento contra Cloud (`42501` verificado en vivo, no destructivo). Sí es cierto que TRUNCATE/TRIGGER/REFERENCES siguen concedidos → deuda. |
| 26 | El test «pasa vacío» en un árbol limpio. | **No pasa: lanza.** El defecto real era la fragilidad de la ruta fija; ahora resuelve la última migración que define la RPC y falla si no hay ninguna. |

Y dos cifras corregidas: no son 31 sondas con verde mudo sino **33 `it` en 8 ficheros**; y
`known-p0.test.ts` está en otro directorio del que decía el informe.

### 11.2 Lo sustantivo

«Convocatorias con plazo · OK · Todas cumplen plazos legales» era un literal JSX sin consulta
detrás. El gate del art. 100 RRM se alimentaba de **notificaciones ENTREGADA fabricadas** por el
propio hook, así que no podía caer nunca; ahora lee `communication_recipients` y falla cerrado ante
estados desconocidos. El expediente decía «Inscripción registral pendiente» sobre acuerdos cuyo
expediente registral está INSCRITA. Se filtran los tipos de certificación que afirman ERDS, envío o
QES. El terminal registral explica su bloqueo en vez de ofrecer una acción imposible.

### 11.3 Gates y arnés

`typecheck` 0 errores · `eslint` 0 problemas · **suite completa 4019 pass / 152 skip / 0 fail**
(línea base 3871; **sin skips nuevos**) · `build` verde.

**Siete mutaciones, siete rojos.** La más significativa: con `DEMO_PASSWORD_*` incorrecta, las
sondas Cloud pasan de **verde mudo a 7 fail**.

### 11.4 Qué ve ARGA distinto

«Convocatorias con plazo» de check verde a **«No medido»**; actas pendientes **4 → 12** (las 8
`DEMO_SIMULATION`/`LEGACY_REVIEW` dejan de contar como aprobadas); libros en alerta **3 → 2**
(coincide ya con `/secretaria/libros`); tres tipos de certificación menos, con nota; «Entregada» en
Comunicaciones pasa de verde de éxito a informativo; `EVIDENCE_SEALED` deja de decir «sellada con
QTSP productivo».

### 11.5 Deudas añadidas

| # | Deuda | Dueño |
|---|---|---|
| DA-21 | 3 filas ACTIVAS de `standalone_certification_kinds` afirman capacidad no vigente (ERDS, `requires_qes`, envío). Filtradas en código; retirarlas del dato sigue pendiente. | Secretaría + Comité Legal |
| DA-22 | `registry_filings` / `registry_filing_events` conceden **TRUNCATE, TRIGGER y REFERENCES a `anon` y `authenticated`** (medido). | Servidor |
| DA-23 | `usePublishNormativeOverride` queda huérfano tras retirar `RuleManagerPage`. | Secretaría |
| DA-24 | 6 ficheros de sondas Cloud de otros carriles con el mismo verde mudo por login fallido. | Owners respectivos |
| DA-25 | **Nuevo, señalado con evidencia:** el RDL 5/2023 sustituyó el derecho de oposición por un régimen de «garantías adecuadas» (arts. 13 y 14), y `evaluateCreditorOpposition` sigue computando 30 días de plazo de oposición. Solo se corrigió la **cita**; régimen y cómputo son criterio jurídico. *Nota del hilo principal: la caracterización que el carril hace del art. 44 difiere de la del informe de revisión; ambas coinciden en que no es protección de acreedores, pero el contenido exacto del art. 44 queda sin cotejar por el orquestador.* | Comité Legal |

---

## 12. Integración: defecto propio y e2e

### 12.1 Defecto del hilo principal, corregido

Al commitear el carril de consola, el índice ya tenía *staged* el `git rm` de dos páginas de
Secretaría hecho por otro carril, así que se fueron en un commit **sin el test que las lee**. Lo
detectó el propio carril de Secretaría en su informe. La historia se rehízo (`git reset` a `main` y
seis commits limpios) para que **cada commit sea coherente por sí solo**. Verificado: ningún borrado
de Secretaría aparece ya en los cinco commits previos.

### 12.2 La suite e2e no podía correr

Playwright fallaba con «Executable doesn't exist … chrome-headless-shell» y, como el proyecto
`setup` no declaraba navegador, **ni un solo spec llegaba a ejecutarse**. Con `channel: 'chrome'` en
los dos proyectos, la suite arranca.

Y entonces aparecieron **tres specs rojos desde antes de este cierre**, con la misma patología que
ya se había corregido dos veces: fijaban afirmaciones que el producto había retirado.

| Spec | Literal que exigía | Realidad medida |
|---|---|---|
| `15-demo-operable` | `QES_SANDBOX` | El modo real es `INTERPOSITION_SANDBOX`; el contrato de producto **prohíbe** el QES. El literal no existe en `src/` ni existía en `main`. |
| `15-demo-operable` | «Firma no procede por gate bloqueante» | El producto dice «**Custodia** no procede…», cambiado cuando el alcance pasó de firma a custodia. |
| `15-demo-operable` | `/api/v1/private/signature-requests` | Retirado con la firma genérica; el contrato que se enseña es el de evidencias. |
| `16-sanitization-smoke` | «Convocatoria DOCX» | El botón se llama «Borrador DEMO …»: lo que genera es un borrador, no la convocatoria emitida. |

Además, la lista de lecturas exentas de `15-demo-operable` no incluía `tenants` ni
`rbac_user_roles` —identidad y branding del shell, no dato del escenario—, así que el spec se ponía
rojo sin que ningún dato de demo saliera del navegador.

**Medición que descarta regresión propia:** con `AuthContext` revertido a `main`, ese spec falla con
**8** llamadas de shell en vez de 4. El vaciado de caché al cambiar de identidad no las introduce:
las reduce a la mitad.

| e2e | Resultado |
|---|---|
| `01-auth` | **7 / 7 pass** (incluye «una cuenta ARGA no entra por el entorno Garrigues») |
| `15-demo-operable` + `20-console-responsive` + `grc-dora` | **14 / 14 pass** |
| `16-sanitization-smoke` | **4 / 4 pass** |

---

## 13. Review adversarial de rama (criterio de salida nº6)

Tres lentes disjuntas sobre `git diff main..HEAD`: **afirmaciones y citas legales**, **gates vacuos
con mutación real**, y **regresión / aislamiento**. Ninguna en modelo pequeño.

Encontraron **seis defectos de producto** y **cuatro gates que se derrotaban con mutación**. Todos
cerrados antes del merge; los gates, verificados con la mutación exacta con la que la review los
derrotó.

### 13.1 Defectos de producto

| # | Qué | Cómo se detectó |
|---|---|---|
| R-1 | **`Resuelto` contaba como incidente abierto.** El read model excluía solo `Cerrado` con `.neq()`. ARGA tiene un incidente por estado (medido), así que el KPI decía **3 donde son 2**. Además `.neq()` descarta las filas con `status IS NULL` y la columna es nullable. Corregido a lista **positiva** de abiertos. | lente de regresión |
| R-2 | **Cita nueva incorrecta en el mismo commit que retiró las Guías AESIA**: el rótulo fijaba «Reglamento (UE) 2024/1689» junto a `articleRef`, que para ISO 42001 vale «ISO 42001 A.5» → renderizaba **«ISO 42001 A.5 Reglamento (UE) 2024/1689»**. | lente de afirmaciones (ejecutando el render) |
| R-3 | **SOC se contradecía en la misma pantalla**: 54 líneas debajo del aviso «no hay ninguna integración activa con Microsoft Sentinel», anunciaba «Feed OTel / SIEM Microsoft Sentinel **Activo**» con punto verde parpadeante, «retención inmutable WORM», «180 ms» y «240 reglas activas» como medición en vivo. | lente de afirmaciones |
| R-4 | Chip **«Firmado»** sobre la misma evidencia que la pantalla describe 80 líneas más abajo como «archivada con hash — **sin sello ni firma atribuidos**». | lente de afirmaciones |
| R-5 | `Documentacion` seguía afirmando «Todo cambio queda registrado de forma **inmutable**» y «El canal interno tiene su propio **entorno técnico**» — la segunda es literalmente la frase que esta rama retiró del propio SII. | lente de afirmaciones |
| R-6 | **art. 100 RRM**: el adjetivo «fehaciente» no aparece en el artículo ni es su estándar, y el gate nuevo lo usaba en el mensaje que ve el usuario. Ahora describe lo que se comprueba: hay constancia de recepción, o no la hay. | lente de afirmaciones (cotejo BOE) |

### 13.2 Gates derrotados y reparados

| Gate | Mutación que lo derrotaba | Tras el arreglo |
|---|---|---|
| Sonda Cloud de la consola | **Reimplementaba** la consulta del hook: reintroducir `.ilike("module_id", …)` en `useModuleStatus.ts` la dejaba en verde. Ahora lee las columnas que el hook filtra de verdad y las comprueba contra Cloud. | **1 fail** ✅ |
| Contador de actas del panel | Una llamada de señuelo a `minuteHasLegalSignature` + el criterio legacy en JS (`filter(row => !!row.signed_at)`). | **1 fail** ✅ |
| Aviso de persistencia del SII | El `import` bastaba: borrar el `{SII_AVISO_PERSISTENCIA_LOCAL}` renderizado dejaba el test verde. Ahora exige la aparición dentro de JSX. | **1 fail** ✅ |
| Tono neutro de las KPI de AIMS | Comprobaba que la clave `neutral:` existiera, no qué pinta: mapearla a `--status-success` devolvía el cero sin dato al verde. | **1 fail** ✅ |
| Guard de afirmaciones del e2e | Sensible a mayúsculas, sobre pantallas con 21 clases `uppercase`: `innerText` devuelve el texto ya transformado por CSS (gotcha nº11). Ahora compara en minúsculas y también contra `textContent` crudo. | — (no mutable sin servidor) |

### 13.3 Precisión de la traza

El motivo escrito para retirar las Guías AESIA decía que no se habían podido cotejar «contra
publicación oficial». **Es falso**: AESIA publica un catálogo numerado 01–16. El defecto era la
ATRIBUCIÓN (10 de 12 mal) y que una guía no vinculante no es la fuente de un requisito del
Reglamento — la fuente es el artículo. En este repo los comentarios son traza de auditoría, así que
el motivo se corrigió.

### 13.4 Lo que las lentes confirmaron limpio

Cero apariciones del nombre real del cliente en fichero versionado. Cero claims nuevos: el diff de
las 88 superficies de producto tocadas, con los comentarios eliminados, muestra que **todas** las
líneas añadidas con vocabulario de afirmación son negaciones. Las citas de Ley 2/2023 (9.2.c, 9.2.d,
26.1, 26.2, 32.4, 33, 34, 36), RDL 5/2023 (13, 14, 44), AI Act (11, 27, 73), Reglamento Delegado (UE)
2025/301, LSC 173 y CP 31 bis, **cotejadas artículo por artículo contra BOE y EUR-Lex: correctas**.
Lo retirado no lo usa nadie. Los nuevos `.eq("tenant_id")` no mueven ninguna cifra de ARGA (0 filas
con `tenant_id IS NULL` en las ocho tablas medidas). `esRiesgoPenal` da 18 → 18 en ARGA. El gateo por
módulo falla ABIERTO con `branding` NULL, con lista vacía y con lista malformada.

### 13.5 Deuda que la review deja anotada

| # | Deuda | Dueño |
|---|---|---|
| DA-26 | Tres tarjetas de `/grc` («GDPR / Datos», «Ciberseguridad», «Auditoría Interna») siguen enlazando a rutas que, en Garrigues, redirigen a `/` sin mensaje: el guard de ruta se generalizó y el filtro del dashboard no acompañó. No es una fuga —el guard cumple— sino un enlace muerto. | GRC |
| DA-27 | `useAgreementCompliance:526`: con `total_members` NULL el denominador cae a 1, y una sola constancia real deja pasar «Todas (1) notificaciones». Preexistente; la rama eliminó el numerador fabricado, no el denominador. | Secretaría |
| DA-28 | `evaluateCreditorOpposition` no tiene ningún llamador fuera de su test: el arreglo de la cita corrige código muerto. La instancia VIVA del mismo error está en el contenido de una plantilla (`20260612214000_…sql:166`), que sí llega al papel. | Comité Legal + Secretaría |
| DA-29 | `IncidenteDetalle.tsx:564` afirma una obligación concreta del Reglamento Delegado (UE) 2025/301 que **no se cotejó** en esta pasada. No verificada ≠ correcta. | GRC |
| DA-30 | Tres `it.todo` nuevos sustituyen skips permanentes: son honestos (declaran que no corren) pero no ejercitan nada. Requieren `SUPABASE_SERVICE_ROLE_KEY` en `.env`. | Secretaría |

---

## 14. Verificación viva en producción (criterio de salida nº7)

Despliegue `dpl_6MPxnRtMVnBi3aSrBPN5z5UR1hBx` → commit `2bab128`, y después `ac87e37`, ambos
**READY** y aliasados a `arga-governance-map.vercel.app`. La integración GitHub→Vercel disparó sola.

**Método:** se descargó el `index.html` de producción, su bundle principal y **los 249 chunks
diferidos** que referencia, y se barrieron las afirmaciones retiradas sobre el código realmente
servido. No es un grep del repo: es lo que llega al navegador.

### 14.1 Lo que la verificación viva encontró — y la suite no

`src/pages/GovernanceMap.tsx:380` seguía diciendo **«Al acceder se registrará en el log de auditoría
independiente»**, la misma frase que este cierre retiró de `SiiLayout` y del tour, sobre una puerta
que solo escribe un flag en `sessionStorage`.

Sobrevivió a los seis carriles, a los gates y a las tres lentes adversariales por un motivo
instructivo: **el guard de afirmaciones del SII escanea el módulo, y esta era una puerta de al
lado**. La superficie del guard se amplía a `GovernanceMap`, `TourContext` y `Documentacion`, que
son los tres sitios desde los que se entra al canal. Verificado con mutación: reintroducir la frase
lo pone en rojo.

Y al ampliarla apareció **por cuarta vez el mismo gotcha**: la única coincidencia restante era el
comentario que explica la retirada. El guard aplica ya `sinComentarios`.

### 14.2 Barrido final sobre producción

**22 de 22 afirmaciones retiradas: AUSENTES.** QSeal Custodia · Verificar QSeal · EAD Trust Custody
ID · Prueba forense inmutable · bundle WORM cualificado · Evidencias Forenses · CUSTODIADO EN LEDGER
WORM · qualified timestamping · EAD Trust Qualified TSP · Cumple RGPD · Remitido formalmente a
DGSFP · Registrando con sellado EAD · Firmar y Registrar · buzón cifrado · zona encriptada · log de
auditoría independiente · Artículo 34 de la Ley 2/2023 · admitido a trámite · Guardar y Precintar ·
ha sido precintada · Todas cumplen plazos legales · Microsoft Sentinel Activo.

**Y la postura honesta que las sustituye, PRESENTE:** «no medido» · «No medido» · «sin dato» ·
«Simulado» · «solo en este navegador» · «Custodia (no conectada)» · «Incidentes mayores abiertos».
La fila del panel viaja literalmente como
`{label:"Convocatorias con plazo", status:"UNKNOWN", note:"No medido en este panel…"}`.

### 14.3 Trampa de método, para la próxima vez

En el primer barrido saltaron cinco literales. **Cuatro de los cinco eran mi propio mensaje de
commit**: Vercel inyecta `VITE_VERCEL_GIT_COMMIT_MESSAGE` y Vite lo inlinea en `import.meta.env`, así
que el mensaje entero viaja en el bundle y un grep encuentra cualquier frase escrita en un commit.
Solo el quinto —`GovernanceMap`— era una afirmación de pantalla. Hay que descontar ese campo antes
de concluir nada de un barrido del bundle.

### 14.4 Lo que NO se verificó, y por qué

**No inicié sesión en producción.** Introducir contraseñas para autenticarme queda fuera de lo que
puedo hacer, incluso con las credenciales a mano. La comprobación autenticada con los **dos**
tenants sí se ejecutó, pero contra el servidor local: `e2e/01-auth` (7/7, incluido «una cuenta ARGA
no entra por el entorno Garrigues») y las sondas Cloud con logins reales de ARGA y Garrigues.

Queda por hacer, y es del usuario: entrar en producción con cada tenant y mirar el Dashboard, `/grc`
y `/sii`. El bundle desplegado ya está verificado; lo que falta es la sesión.

---

## 15. Criterios de salida

| # | Criterio | Estado |
|---|---|---|
| 1 | Tabla por módulo: superficie → REAL / HONESTO / RETIRADO con evidencia, ninguna «no verificada» | **Cumplido** — §3, §4, §6, §7, §9, §11 |
| 2 | Todos los hallazgos con estado final; los 23 P0 sin juzgar, primero | **Cumplido** — 123 hallazgos juzgados en los seis carriles: corregidos, refutados con evidencia, o deuda aceptada con dueño (DA-1…DA-30). Ninguno queda sin veredicto. |
| 3 | Gates verdes en `main`; `bun test` sin bajar de 3870 ni añadir skips; e2e `01-auth` y los del cierre | **Cumplido con una excepción declarada** — 4020 pass / 152 skip / 0 fail (línea base 3871, **skips idénticos**); typecheck, lint y build verdes; `01-auth` 7/7. **Excepción:** tres e2e siguen rojos y son **pre-existentes, medido** (el literal que piden no existía tampoco en `main`): descarga DOCX de convocatoria, preservación de scope en GRC y pipeline de certificación en el detalle de acta. Ningún fichero de esas rutas cambió en este cierre. |
| 4 | Aislamiento cross-tenant con logins reales en cada tabla nueva o tocada, en ambas direcciones y sin aserción vacua | **Cumplido** — de 9 a 16 tablas, 48 pass / 241 aserciones; las cuatro direcciones vacuas, declaradas con motivo y fuente. |
| 5 | Arnés de mutación en cada corrección release-crítica | **Cumplido** — 21 mutaciones en AIMS, 7 en Secretaría, 6 en GRC, 3 en SII, 5 en consola/coherencia, más las 5 de la review y las 2 de la verificación viva. Todas en rojo; todas restauradas. |
| 6 | Review adversarial de ≥3 lentes, 0 P0 abiertos antes de mergear | **Cumplido** — tres lentes; 6 defectos de producto y 4 gates derrotados por mutación, **todos cerrados antes del merge**. |
| 7 | Verificación viva en producción tras el push | **Cumplido en la parte que puedo hacer** — 22/22 afirmaciones ausentes y la postura honesta presente en el bundle servido, con los 249 chunks diferidos incluidos. La comprobación **con sesión iniciada** queda para el usuario (§14.4). |
| 8 | `CLAUDE.md` actualizado y ledger con cada decisión, refutación y deuda | **Cumplido** — este fichero y la sección nueva de `CLAUDE.md`. |
