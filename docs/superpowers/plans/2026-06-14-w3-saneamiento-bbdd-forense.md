# W3 — Saneamiento BBDD demo `governance_OS` — Informe forense y plan

**Fecha:** 2026-06-14 · **Carril:** W3-saneamiento (autónomo) · **Objetivo:** dejar `governance_OS`
(hzqwefkwsxopwrmtksbg) coherente, completa y navegable de extremo a extremo para PRUEBAS CON HUMANOS,
y cerrar W3 (filtrado `data_class` consistente en todos los read-paths).

Todo lo de este informe está **verificado en vivo por SQL** contra Cloud (no asumido). El workflow forense
F0 (6 dominios + síntesis) produjo 84 hallazgos; sus 14 verificadores adversariales fallaron por rate-limit,
así que **cada hallazgo destructivo se re-verificó manualmente** (sección "Verificación"). Se cazó **un falso
positivo peligroso** del workflow (ver §2.3).

---

## 1. Baseline verificado (2026-06-14)

| Métrica | Valor |
|---|---|
| `db:check-target` | ✅ governance_OS (hzqwefkwsxopwrmtksbg) |
| Tenant único | `00000000-0000-0000-0000-000000000001` |
| 6 paridades modelo canónico | 5 VERDE · **#3 FALLA: 20 entities sin `entity_capital_profile` VIGENTE** |
| `data_class` | entities 32 DEMO / 18 TEST · persons 100 DEMO / 35 TEST (única tabla con la columna) |
| Readiness (repair script) | 50 sociedades → Completa **4** · Parcial 6 · Rota 13 · No usable 27 |
| ⚠️ ARGA Seguros (golden path) | **Rota** — 1 BLOCKING + 4 WARNING (reparable; ver §3) |

Conteos exactos relevantes: agreements **145**, meetings 24, minutes 11, certifications 7, convocatorias 51,
condiciones_persona 106, capital_holdings 52, censo_snapshot 27, mandatory_books 552, governing_bodies 57.

`mandates` es **VIEW** (no tabla) sobre `condiciones_persona`. `mandates_legacy_backup` (25) es tabla de backup
de la migración mandates→VIEW.

---

## 2. Inventario de contaminación (verificado)

### 2.1 CONTAMINACIÓN_TEST — eliminar

**18 entities `data_class=TEST`** (todas con tax_id de test inequívoco; ninguna es golden path):

| Grupo | n | tax_id pattern | Cascada |
|---|---|---|---|
| `PHASE-B-DEMO-PB-*` (S.A.) | 11 | `Z-PB-*` | 1 body + 11 books c/u; 1 tiene 1 meeting |
| `PHASE-B6-AS-AS-*` (S.L.) | 4 | `Z-AS-*` | 2 bodies + 12 books c/u |
| `Arga test A, SL` (16b28a35) | 1 | `B01888818` | **8 agreements, 4 meetings, 3 minutes, 1 cert, 4 holdings, 4 cond, 2 bodies, 12 books, 6 entity_settings** (cascada pesada) |
| `PRUEBA 1` (SAU) | 1 | `E2E-B88888888-PRUEBA-1` | 2 bodies, 13 books, 1 cprof |
| `SEGUROS TEST A, SL` (SLU) | 1 | `B88888888` | 2 bodies, 13 books, 1 cprof |

**Persons (disposición por FK, no por heurística de nombre):**

| class | rol | n | acción |
|---|---|---|---|
| DEMO | not_entity_PJ | 51 | KEEP (personas demo reales) |
| DEMO | PJ_of_DEMO | 32 | KEEP (+ backfill 24 tax_id `PENDIENTE-*` en F2) |
| DEMO | **PJ_of_TEST** | **17** | re-tag TEST + borrar con cascada (0 refs externas) |
| TEST | not_entity_PJ | 34 | borrar (E2E/QA transaction persons) |
| TEST | PJ_of_TEST | 1 | borrar (PJ de Arga test A) |

18 entities TEST ↔ 18 PJ (17 DEMO-tagged + 1 TEST). Set de borrado de persons ≈ **52** (+ orphans, §2.2).

**29 capital_holdings TEST en ARGA (6d7ed736)** — holders `[E2E REAL] Transmitente/Adquirente`, `QA Adquirente`,
`QA Diag Buyer` (tax_id `E2E-*`/`QA-*`), todos pct ≈ 0.000000. **Preservar las 2 holdings DEMO actuales**:
Cartera ARGA S.L.U. 69,69 % + Mercado libre 30,31 % = 100 %. Borrar las 29 TEST **no mueve** el 100 %
(parity #6 sigue verde). Hay además 9 holdings DEMO **históricas** (effective_to ≠ null: Antonio Ríos 15 %…)
— DEMO_OK, se dejan.

**16 condiciones_persona en ARGA referenciando persons TEST** — todas `tipo_condicion=SOCIO`, `body_id=null`
(**no contaminan la composición del CdA**). 14 CESADO + **2 VIGENTE** (E2E transmitente+adquirente) que inflan
ARGA a "4 socios". Se borran con la cascada de persons TEST → ARGA vuelve a 2 socios / 2 holdings.

### 2.2 DEMO orphans (10 persons sin refs)

- KEEP: `Administrador Sistema` (…099, usuario sistema/auth).
- Borrar (ruido): `PEDRO PRUEBA PRUEBA` (4804ac5d).
- Gobierno/reconciliar: `2faafc8d` (PJ ARGA Seguros duplicada, tax_id A-99999903), `6f4b0d26` (ARGA RE shadow PJ).
- **Reutilizables en F3** (personas demo realistas, 0 refs): Carlos Eduardo Vaz, Daniel Prado Estévez,
  Elena Navarro Pons, Marta León Salgado, Sofía Ibarra Gil, Isabel Moreno → asignar a órganos DEMO sin miembros.

### 2.3 Falso positivo del workflow (cazado) — CRÍTICO

La síntesis F0 propuso "re-tag DEMO→TEST y borrar 17 PJ shadows + ~24 con tax_id `PENDIENTE-*`". **Los 24
`ARGA/PENDIENTE-<uuid>` son las PJ de entities DEMO legítimas** (el uuid del placeholder = el `entity_id`,
p.ej. 054d1ddb = filial DEMO real). Borrarlas habría dejado huérfano el `person_id` (NOT NULL) de ~24 entities
DEMO → catástrofe. **Solo los 17 PJ_of_TEST son borrables.** Los `PENDIENTE-*` de entities DEMO se **backfillean**
(F2), no se borran. (Confirma la regla del carril: no aceptar hallazgo sin verificar.)

### 2.4 DEMO_INCOMPLETE — reparar/completar

| Hallazgo | n | Acción |
|---|---|---|
| entities DEMO sin `capital_profile` VIGENTE | **5** | F2: crear perfil VIGENTE (→ parity #3 = 0 tras borrar 15 TEST) |
| governing_bodies DEMO sin miembros VIGENTE | **12** | F3: poblar cargos |
| agreements MEETING parentless **no-DRAFT** (DEMO) | **10** (6 ADOPTED+1 CERTIFIED+3 PROPOSED) | F2/F3: crear/enlazar reunión (rompen coherencia: acuerdo adoptado sin sesión) |
| agreements MEETING parentless **DRAFT** (DEMO) | **88** | F2: el lote-ruido 2026-04-26 (6/entidad). Sin hijos → **podar** (resuelve el síntoma 145 vs 24) |
| persons PJ DEMO con tax_id `PENDIENTE-*` | 24 | F2: backfill tax_id real coherente ARGA |
| ARGA: agreement be0d8a4a sin body_id + 4 meetings sin censo (2 test) | — | F2: reparar body_id + limpiar meetings test → ARGA 0/0 |

### 2.5 WORM_PROTECTED

- **13 `censo_snapshot` sobre entities TEST** (de 27 totales) — append-only (trigger bloquea DELETE) y FK NO ACTION
  que bloquea el borrado de la entity. Requiere el escape sancionado (guardrail #4):
  `SET LOCAL session_replication_role=replica;` en sesión admin, **solo para purgar esas 13 filas test**, documentado.
- `parte_votante_current`: regenerar vía `fn_refresh` para ARGA tras limpiar holdings (no borrar a mano).
- `audit_log` (3157): intocable, append-only; no FK-bloquea.

### 2.6 UNKNOWN — decisión de gobierno (no auto-acción en F1)

- **evidence_bundles: 6 SEALED con qtsp sandbox + tokens NULL** (sandbox promovido a final). Trust-boundary;
  cross-módulo. NO tocar en saneamiento de datos demo; anotar para W1.
- `Cartera ARGA, S.A.` legacy (517522ab, DEMO): duplicado de la canónica SLU; tiene la arista Fundación→Cartera.
  Reconciliar parent edge antes de retirar (F2/gobierno).
- PJ ARGA Seguros duplicada (2faafc8d, A-99999903 vs A-00001001 en la entity): decidir canónico.
- `mandates_legacy_backup` (25): retención (es el artefacto de rollback de mandates→VIEW). Dejar.
- Vocabularios `meeting_type` (14) / `decision_type` (16): normalización con sign-off (no bloqueante).

---

## 3. Por qué ARGA está "Rota" y cómo vuelve a 0/0

1 BLOCKING: agreement `be0d8a4a` (APROBACION_CUENTAS) sin `body_id` → reparar body_id (Junta/CdA por kind).
4 WARNING `MEETING_WITHOUT_CENSUS`: 2 convocatorias DEMO reales (2026-05-30, 2026-05-26, aún CONVOCADAS, sin
censo todavía — aceptable o generar censo) + 2 meetings `test-062-rpc-2-*` (TEST → eliminar). Limpiar las 29
holdings TEST + 16 condiciones SOCIO TEST + be0d8a4a + meetings test ⇒ ARGA: 2 socios, 2 holdings, CdA intacto
(17), pacto y voto de calidad intactos ⇒ **readiness 0/0**. El golden path se **completa/limpia**, nunca se rompe.

---

## 4. Plan de saneamiento (fases)

### GATE DE BACKUP (antes de cualquier DELETE/UPDATE masivo)

Branch de Supabase **no** sirve para ensayar borrados de datos (se siembra desde migraciones, no trae las filas
contaminadas). Rollback garantizado = **backup lógico in-DB** (equivale a "pg_dump lógico de tablas afectadas",
aceptado por el gate): schema `w3_backup_20260614` con copia completa (`CREATE TABLE … AS SELECT *`) de **todas**
las tablas a mutar. Runbook de rollback: `INSERT INTO <tabla> SELECT * FROM w3_backup_20260614.<tabla>` (en orden
de FK) para las que se vacíen, o restore puntual por id. Documentado en este archivo y en migración.

### F1 — Cuarentena/eliminación TEST (FK-ordenado)

Orden de borrado (hijos→padres), por migración con `apply_migration` + espejo en `supabase/migrations/`:
1. Limpiar refs TEST en filas KEPT: 16 condiciones SOCIO TEST en ARGA; 29 holdings TEST en ARGA; 2 representaciones/parte_votante de ARGA se regeneran (F2).
2. Cascada por entity TEST: `no_session_respuestas`→`no_session_resolutions`→`no_session_expedientes`; `meeting_votes`→`meeting_resolutions`→`meeting_attendees`→`agenda_item_constancias`→`agenda_items`; `certifications`→`minutes`; `registry_filings`; `meetings`; `agreements` (y sus CASCADE: evidence_bundles/policy_agreements/rule_evaluation_results/conflicto_interes); `unipersonal_decisions`; `representaciones`; `parte_votante_current`; `capital_movements`.
3. **WORM**: en sesión admin `SET LOCAL session_replication_role=replica;` borrar las 13 `censo_snapshot` de entities TEST (justificado: artefactos test).
4. Borrar `governing_bodies` TEST (CASCADE: authority_evidence, condiciones, etc.), `mandatory_books` TEST, `entity_settings`, `share_classes`/`entity_capital_profile` (CASCADE por entity), y finalmente `entities` TEST (18) y `persons` TEST (52: 34 not_PJ + 1 PJ + 17 re-tagged + PEDRO PRUEBA).

### F2 — Saneamiento DEMO

- Crear 5 `entity_capital_profile` VIGENTE (filiales DEMO sin perfil) → parity #3 = 0.
- Backfill 24 tax_id `PENDIENTE-*` de PJ DEMO con NIF/CIF coherentes ARGA.
- Reparar 10 agreements no-DRAFT parentless (enlazar/crear reunión) + `be0d8a4a` body_id.
- Podar 88 agreements DRAFT parentless (lote-ruido, sin hijos) — resuelve el síntoma 145.
- `fn_refresh` parte_votante_current ARGA. 6 paridades → verde. ARGA → 0/0.
- Usar `secretaria-repair-demo-entity-coherence.ts --apply-safe` donde aplique (idempotente).

### F3 — Completar dataset navegable

- Poblar 12 órganos DEMO sin miembros (reutilizar orphans demo + nuevos).
- Extender `secretaria-seed-societario-demo.ts` (idempotente) para que ≥3-4 sociedades además de ARGA estén
  "Completa" con cada flujo end-to-end (convocatoria→reunión→acta→certificación→tramitador; sin sesión;
  co-aprobación; solidario; unipersonal; libros; board pack) + handoffs GRC/AIMS.
- **TDD**: validador de COMPLETITUD por flujo (`flow-completeness.ts` + test), reutilizando `entity-demo-readiness.ts`.

### F4 — Cerrar W3 (filtrado data_class consistente)

- Helper central `data_class` (excluir TEST por defecto) aplicado a TODOS los read-paths de entities/persons
  (useEntities, useSociedades, useFilialEntities, useDashboardData, useGovernanceMapData/Nodes, useLibros,
  usePreviewAcuerdo, useAgreementCompliance, variable-resolver, usePersonasCanonical, wizards).
- Tagging del harness E2E: builders setean `data_class='TEST'` en lo que crean (defensa en profundidad).

### F5 — Verificación final

6 paridades verde; ARGA 0/0; `bun test`/typecheck/lint/build/e2e verde; recorrido por flujo; informe
antes/después; fila W3 → ✅ en `docs/legal/2026-06-13-referencia-modulo-secretaria.md`.

---

## 5. Cifras objetivo (antes → después esperado)

| | Antes | Después (esperado) |
|---|---|---|
| entities | 50 (32D/18T) | 32 DEMO (0 TEST) |
| persons | 135 (100D/35T) | ~83 DEMO (0 TEST), orphans reasignados |
| agreements | 145 | ~57 (todos con flujo coherente) |
| parity #3 (sin cprof VIGENTE) | 20 | 0 |
| readiness Completa | 4/50 | ≥ varias (ARGA + cadena + 3-4 filiales) |
| ARGA readiness | Rota (1B/4W) | 0/0 |

---

## 6. RESULTADOS DEL SANEAMIENTO (ejecutado 2026-06-14, F1-F5)

### Antes → Después (verificado en Cloud)

| Métrica | Antes | Después |
|---|---|---|
| entities | 50 (32 DEMO / 18 TEST) | **32** (32 DEMO / 0 TEST) |
| persons | 135 (100 DEMO / 35 TEST) | **82** (82 DEMO / 0 TEST) |
| agreements | 145 (101 DRAFT, ratio incoherente) | **42** (todos con padre/scope coherente) |
| acuerdos no-DRAFT sin padre | 16 + be0d8a4a | **0** |
| drafts con artefactos terminales | (varios) | **0** |
| meetings / censo_snapshot | 24 / 27 | 17 / 18 |
| mandatory_books | 552 | 345 |
| parity #3 (sin capital_profile VIGENTE) | 20 | **0** |
| 6 paridades modelo canónico | 5/6 (#3 falla) | **6/6 VERDE** ("All checks passed") |
| readiness (repair script) | Completa 4 · Rota 13 · No usable 27 · 37 BLOCKING | **Completa 5 · Rota 0 · 0 blocking · 0 warnings** |
| ARGA Seguros (golden path) | **Rota** (1 BLOCKING + 4 WARNING) | **Completa (0/0)** |

### Migraciones aplicadas (Cloud + espejo repo)

`w3_f1_purge_test_contamination`, `w3_f2_demo_saneamiento`, `w3_f3a_agreement_coherence`,
`w3_f3b_agreement_scope_cleanup`, `w3_f3c_filial_censos`, `w3_f4_autotag_test_data_class`,
`w3_f5_remediation_codex`, `w3_f5_recover_test_run_pollution`. Registradas en
`supabase_migrations.schema_migrations` (versiones apply-time vía MCP) y espejadas en
`supabase/migrations/20260614*.sql`.

### Backup / rollback

`w3_backup_20260614` (schema): snapshot lógico de las 153 tablas base de `public`
tomado antes de F1. Rollback puntual: `INSERT INTO public.<t> SELECT * FROM
w3_backup_20260614.<t> WHERE id IN (...)` bajo `session_replication_role=replica`.
Usado en F5 para restaurar los perfiles de capital de ARGA.

### Lección operativa (registrada)

El gate de tests canónico es `bun test` (runner nativo Bun, credencial anon → SALTA los
tests que mutan Cloud). Ejecutar la suite vitest con `SUPABASE_SERVICE_ROLE_KEY` contra
Cloud **muta datos reales** (un test de `entity_capital_profile` borró los perfiles de
ARGA; otros insertaron fixtures). No correr vitest con admin contra `governance_OS`.

### 5 sociedades demo Completa (cobertura de tipos de flujo)

ARGA Seguros S.A. (SA cotizada, CdA), ARGA Reaseguros S.A. (SA), ARGA Servicios
Corporativos S.L. (SL admin solidarios), ARGA Tecnología Jurídica S.L. (SL admin
mancomunados), Cartera ARGA S.L.U. (SLU unipersonal, admin único). Cubren:
convocatoria→reunión→acta→certificación→tramitador, acuerdos sin sesión, co-aprobación,
solidario, decisión unipersonal, libros, board pack.

### Pendientes de gobierno (no bloqueantes, documentados)

- Divergencia tax_id PJ de ARGA Seguros: `A-00001001` (en la entidad) vs `A-99999903`
  (documentado/duplicado huérfano `2faafc8d`). Reconciliar canónico (decisión Comité).
- Legacy `Cartera ARGA, S.A.` (`517522ab`) duplicado de la SLU canónica; conserva la
  arista Fundación→Cartera. Retirar requiere rewire del parent edge.
- 6 `evidence_bundles` SEALED con qtsp sandbox (W1, cross-módulo) — fuera de W3.
