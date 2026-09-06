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
| DA-14 | `grc_modules` de Garrigues sin fila `esg` | sembrada con la misma forma que sus cuatro hermanas (`state='Planificado'`, contadores a 0) y `owner` acreditado: «Comité de Sostenibilidad» existe como órgano del tenant. Además tiene item de navegación, gateado por `esgVisibleParaTenant` — que falla CERRADO, al contrario que `isModuleEnabled` |
| DA-17 | 4 evaluaciones de ARGA con nota fabricada por un e2e que afirmaba «cumplimiento estricto de todos los artículos» del Reglamento de IA | nota sustituida por su procedencia real; 0 restantes |

Las cuatro se aplicaron primero con `execute_sql` y **sin espejo en el repo** —una
infracción de la regla de reproducibilidad que cometí yo y que cazó la review
adversarial—. Corregido: la migración idempotente
`20260906090729_correcciones_dato_cierre_2026_09_06` las recoge y está
registrada en `schema_migrations`.

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

---

## 5. Carriles de corrección

Diez commits en `feature/cierre-gaps-2026-09-06`. Lo que cada uno cerró está en su mensaje; aquí
solo lo que conviene no perder.

### 5.1 El defecto más caro, y no venía del informe

**El acta era inalcanzable en el camino que nace de una convocatoria.** Lo encontró el carril del
golden path, que se paró en vez de tapar el fallo con un `catch`: su `expect` era correcto y chocaba
con un defecto real.

`fn_secretaria_guard_meeting_open_transition` declara inmutable la atadura de una reunión a su
convocatoria EMITIDA y lo comprueba comparando el objeto ENTERO
(`NEW.quorum_data #> '{source_links}' IS DISTINCT FROM OLD…`). `handleSaveResolutions` lo reescribía
con `source: "derived"` + `agreement_ids`: dos diferencias, el UPDATE entero rechazado, y
`point_snapshots` sin llegar nunca. Sin snapshots, «Confirmar cierre y generar acta» queda
deshabilitado **para siempre**.

Verificado en vivo sobre un espécimen limpio (`b1fccfb0`, vínculo `explicit`): `point_snapshots`
**0 → 3** con el `source_links` **idéntico**. Global ARGA: 6 → 7 reuniones con snapshots.

No bastaba: `loadActaAgendaContract` leía el resultado de la votación solo del espejo cliente. Ahora
completa desde `agreements.compliance_snapshot`, que escribe la misma RPC en la misma transacción —
el espejo manda si existe, y solo se recupera lo que pasa el mismo validador. Radio medido: la única
reunión de ARGA que cambia es `ac961a00`.

### 5.2 Dos defectos de servidor, CERRADOS

Ambos exigían migración. Se aplicaron con espejo en el repo:

1. **`fn_save_meeting_resolutions` hacía `DELETE FROM rule_evaluation_results`, que es WORM**
   (`P0001 WORM protection`). Ninguna reunión podía recalcular su votación tras emitir la evaluación
   `V2_CLOUD`. Cerrado en `20260906101026_save_meeting_resolutions_append_only_worm.sql`, por
   sustitución anclada sobre el cuerpo vivo (tres anclas, cada una exactamente una vez o aborta), no
   por reescritura de la función.
2. **`fn_aims_close_technical_file` sin aserción de tenant**: cerrado en
   `20260906101036_aims_close_technical_file_tenant_assert.sql`.

### 5.3 `e2e/18` VERDE, y la frontera que destapó

El gate de cuentas anuales que lo bloqueaba se cerró sembrando el conjunto de las sesiones demo de
CdA (`20260906101102`). Después apareció un segundo bloqueo —la presidencia del CdA era la única
fila de todo el tenant con secretaría inscrita y presidencia sin inscribir— cerrado en
`20260906133000_seed_cda_presidente_inscripcion_rm.sql`, **por la RPC autoritativa**
`fn_registrar_inscripcion_rm_cargo` y no por `UPDATE`: el guard
`trg_00_authoritative_writer_guard` rechaza con `42501` cualquier escritura directa sobre
`authority_evidence`, y la RPC además deja evento en `cargo_rm_registration_events` y evidencia WORM
en `audit_log`. La referencia no se inventó: se copió el asiento de la secretaría hermana, que es la
convención medida en los 14 órganos que sí lo tienen.

Con eso el camino llega hasta el acta y el acta se descarga. **Y ahí termina el producto**, que es
el hallazgo de más peso del día y no venía de ningún informe:

- Certificar exige un acta en `APPROVED_SIGNED`, que exige **artefacto final registrado en servidor**
  más **dos verificaciones EAD diferenciadas** (consentimiento de Presidencia + constancia de
  Secretaría).
- El único control de custodia de la aplicación, `EADInterpositionControl`, está **cableado a
  `disabled` sin handler** y lo declara en pantalla: «Pendiente de renderer autoritativo».
- Las verificaciones EAD sólo las escribe la Edge Function de reconciliación tras una interacción
  REAL con el proveedor, prohibida adrede bajo `VITE_E2E` por `isRealQTSPForbidden`.

Contraste en Cloud (ambos tenants, todo el histórico): **13 actas, 0 en `APPROVED_SIGNED`, 0 con
artefacto final, 0 con consentimiento o constancia; y 0 de las 9 certificaciones emitidas**. Nadie ha
recorrido nunca ese tramo porque no existe.

El spec ya no lo exige: fija la postura honesta —el botón de certificación se ofrece, está
deshabilitado, y dice por qué— con cuatro controles anti-vacuidad (el acta se **descarga**, el botón
de certificación **existe**, la custodia declara su bloqueo, y no aparece «Certificación emitida» en
ninguna parte). **Arnés de mutación**: quitando `disabled` del botón de custodia el spec se pone rojo
en la aserción exacta (`e2e/18:281`); restaurado desde `/tmp`, verde. El día que aterrice el renderer
autoritativo este test se pondrá rojo y habrá que extenderlo a propósito — que es lo que debe pasar,
y lo contrario de dejar un verde que se satisfaga falsificando evidencia de EAD Trust.

La cobertura del stepper del tramitador que el spec dejó de recorrer no se pierde: vive en `e2e/06`,
`e2e/13` y `e2e/54`.

---

## 6. Review adversarial de la rama (criterio nº6)

Cuatro lentes disjuntas sobre `main...HEAD`, cada hallazgo refutado por un agente independiente
antes de aceptarse: **19 hallazgos, 8 refutados, 11 sobreviven — todos P2, ninguno P0 ni P1.**

Dos refutaciones que merecen registro porque evitaron un daño:

- Un hallazgo proponía revocar `EXECUTE` de `fn_matter_document_tenant` a `authenticated`. Aplicarlo
  **habría reabierto el P0** que la migración cierra: la política lo invoca como el usuario.
- Otro atribuía a esta rama una escalada de privilegio que ya estaba cerrada por una migración de
  mayo.

Los 11 que sobreviven son otra vez la misma forma, y de ellos se cerraron los de producto: el modal
del acuse afirmaba «el inicio de las diligencias previas» (ni ocurre, ni lo dice el art. 9.2.c, y
contradecía al panel que esta misma rama añadió cuatro líneas más arriba); «Transmitir Notificación
de Retraso» contradecía a su propio handler; y al escribir el guard apareció un tercero que nadie
había visto, «Transmitir Propuesta», cuyo handler solo navega.

**El gate prohibía el participio y dejaba pasar el imperativo.** Ahora prohíbe la orden.

Dos gates se derrotaban y se repararon con su mutación: el barrido de fixtures eximía a una pantalla
por MENCIONAR `supabase` (un import sin usar bastaba) y aceptaba `<DemoFixtureNoticeX`; y el gate de
enlaces muertos comprobaba la función sin comprobar que las cinco listas la apliquen.

**Infracción propia, registrada:** apliqué las cuatro correcciones de dato con `execute_sql` y sin
espejo en el repo. La cazó la review, no yo. Corregida con migración idempotente registrada.

---

## 7. Gates finales

| Gate | Resultado |
|---|---|
| `bun run db:check-target` | pass contra `governance_OS` |
| `bun test` | **4184 pass / 151 skip / 3 todo / 0 fail** (23 398 aserciones, 473 ficheros) — línea base 4020 pass / 152 skip: **+164 y un skip MENOS**. El criterio pedía no bajar de 3870 sin skips nuevos |
| `bun run typecheck` | limpio |
| `bun run lint` | limpio |
| e2e lote 1 (`01`, `05`, `10`, `11`, `12`) | 33 pass / 2 fail — **los dos pasan en aislamiento**: flakes de orden, no regresiones |
| e2e lote 2 (`14`, `16`, `17`, `19`) | **19 / 19** |
| e2e `18` golden path | **verde**, con arnés de mutación (§5.3) |
| Aislamiento cross-tenant (logins reales) | storage 5/5, dominio 47/47, Secretaría 13/13 |

Los dos rojos del lote 1 se verificaron uno a uno: `05` solo → 5/5; `12` solo → 6/6. Es la
dependencia de orden ya documentada en `CLAUDE.md`, no un efecto de esta rama.

---

## 8. Criterios de salida

| # | Criterio | Estado |
|---|---|---|
| 1 | Superficie → REAL / HONESTO / RETIRADO con evidencia | **Cumplido** para los 257 hallazgos listados: §1.2 y los mensajes de commit |
| 2 | Todos los hallazgos con estado final | **Cumplido** — 257 juzgados, **0 sin juzgar**, 16 veredictos corregidos por el refutador. *Los 139 P1/P2 de la segunda pasada que el informe NO lista siguen sin poder juzgarse: no están escritos en ninguna parte salvo el journal del workflow original* |
| 3 | Gates verdes; `bun test` sin bajar de 3870 ni añadir skips; e2e del cierre | **Cumplido, `e2e/18` incluido** (§5.3): verde y con arnés de mutación. Cifra final en §7 |
| 4 | Aislamiento cross-tenant con logins reales, sin aserción vacua | **Cumplido** — storage nuevo, `meetings` añadida, 9 tablas `ai_*`/`aims_*` con su dirección vacua DECLARADA |
| 5 | Arnés de mutación en cada corrección release-crítica | **Cumplido** — todas las de esta pasada con el rojo pegado, más 29 de las 34 correcciones de la tercera tanda y la frontera de `e2e/18` |
| 6 | Review adversarial ≥3 lentes, 0 P0 abiertos | **Cumplido** — 4 lentes, 0 P0 / 0 P1 |
| 7 | Verificación viva en producción | **Cumplido en la parte que puedo hacer** — §9. La comprobación CON SESIÓN sigue sin poder hacerla yo (no introduzco contraseñas) |
| 8 | `CLAUDE.md` actualizado y ledger | **Cumplido** — este fichero |

### 8.1 Lo que queda abierto, sin adornos

- **La custodia final de EAD Trust no existe** (§5.3). No es deuda de esta pasada ni defecto que
  corregir aquí: exige un renderer autoritativo en servidor y evidencia contractual y técnica
  separada, que la política vigente de EAD Trust en `CLAUDE.md` reserva expresamente. Mientras no
  esté, **ninguna certificación puede emitirse**, y el producto lo dice en pantalla en vez de
  fingirlo.
- **91 de los 127 hallazgos no listados recibieron juez pero no refutador**, porque dos corridas
  toparon con el límite de sesión. Sus veredictos valen menos que los 257 listados, que sí llevan
  las dos vueltas, y se dice aquí en lugar de contarlos como equivalentes.
- **6 hallazgos de la tercera tanda quedaron NO_TOCADOS con motivo**: 3 por caer fuera del perímetro
  de ficheros de su carril (`n=1004`, `n=1028`, `n=1092`), 1 porque su corrección estaba prohibida
  en ese carril (`n=1002`), 1 duplicado, y **`n=1100` (CTR-008) por decisión expresa del usuario**
  ya registrada en `CLAUDE.md`.
- **1 deuda Cloud** (`n=1005`): `20260418154408_fase4_ai_governance_tables.sql` conserva una política
  `tenant_isolation` con ARGA cableada.
- **`controls.code` sin unicidad por tenant**: cerrado el 2026-09-06 renombrando el segundo `CTR-004`
  a `CTR-009` y creando `ux_controls_tenant_code` (`20260906101109`). Se deja anotado aquí porque el
  ledger lo daba por abierto.
- Los criterios **reservados al Comité Legal** siguen intactos, y esta pasada no tocó ninguno.


---

## 9. Verificación viva en producción

Despliegue `dpl_AZGex7aCF3LNJMsRyYbvfXuXCc63` → commit `4df54bb`, **READY** y aliasado a
`arga-governance-map.vercel.app`. La integración GitHub→Vercel disparó sola.

Método: se descargó el `index.html`, su entry y **los 251 chunks** que referencia (7,7 MB), y se
barrió el código realmente servido. No es un grep del repo: es lo que llega al navegador.

**La trampa de método del cierre anterior sigue viva y se descontó**: Vercel inlinea
`VITE_VERCEL_GIT_COMMIT_MESSAGE` y Vite lo mete en el bundle — el mensaje de este merge aparece en
tres chunks, y contiene «QSeal», «WORM», «Transmitir»… o sea, palabras prohibidas. Se retiró el
literal antes de barrer: **juzgar la propia prosa de commit como si fuera pantalla daría un falso
positivo por cada frase escrita**.

| Comprobación | Resultado |
|---|---|
| Afirmaciones retiradas, AUSENTES | **26 / 26** |
| Postura honesta, PRESENTE | **12 / 12** |

Las 26 incluyen las diez del cierre anterior (QSeal Custodia, Verificar QSeal, EAD Trust Custody ID,
bundle WORM cualificado, Cumple RGPD, Remitido formalmente a DGSFP, Firmar y Registrar, buzón
cifrado, log de auditoría independiente, admitido a trámite…) y las nuevas de esta pasada:
«Comunicación a Clientes Enviada», «Transmitir Notificación de Retraso», «Transmitir Propuesta»,
«Transmitir Alerta Urgente», «Credencial Segura», «diligencias previas», «emitido en plazo legal»,
«AESIA GUÍA 16 / RIA», «Madurez (AESIA)» y «Preservación absoluta».

Y las 12 presentes son la postura que las sustituye: «no medido», «sin dato», «Simulado», «solo en
este navegador», «Incidentes mayores abiertos», «sin envío», «Abrir intake en Secretaría»,
«Registrar justificación del retraso», «no la modela», «REGLAMENTO (UE) 2024/1689».

**Lo que sigue sin verificarse, y es del usuario:** entrar en producción con cada tenant y mirar el
Dashboard, `/grc`, `/sii` y `/secretaria`. El bundle desplegado está barrido; lo que falta es la
sesión, y no introduzco contraseñas.
