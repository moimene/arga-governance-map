# Tenant cero — bootstrap genérico y pack base LSC — Plan de implementación

**Goal:** Dar de alta en `governance_OS` un tenant en blanco («Grupo Nuevo», `…0003`) con marca propia, usuarios demo y suelo jurídico LSC, sin una sola sociedad sembrada, con ARGA y Garrigues intactos y el aislamiento probado a tres tenants.

**Spec:** `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md`.

**Tech stack:** React 18 + TS relajado, Supabase JS v2, bun (`bun test` con imports de `vitest`).

## Restricciones globales

- **Cloud se escribe solo con autorización expresa del usuario.** Todo lo de este plan hasta la Tarea 7 es código, snapshot y lecturas.
- Guard de target: los dos scripts abortan si la URL no es `hzqwefkwsxopwrmtksbg.supabase.co` (comparación de hostname, no de subcadena).
- Service-role key solo por entorno (en este repo, `SERVICE_ROLE_SECRET`; la URL, `PROJECT_URL`). Nunca se imprime.
- **ARGA (`…0001`) y Garrigues (`…0002`) intactos**, en dato y en pantalla. Todo INSERT nombra `tenant_id`.
- Seeds idempotentes y aditivos: nunca `DELETE`, nunca mutar una versión ya escrita.
- Emails demo en dominio ficticio `*-demo.dev`. La contraseña vive solo en `.env` (`DEMO_PASSWORD_NUEVO`).
- `git add` por rutas específicas: el árbol es compartido. **Este plan no hace commits.**
- No se editan `CLAUDE.md` ni `AGENTS.md`.

## Tareas

### Tarea 1 — Catálogo de tenants en blanco ✅
- [x] `scripts/tenants/tenant-spec.ts`: tipo `TenantSpec`, spec `nuevo`, `tenantSpec()` con guard `hasOwnProperty`, `validarTenantSpec()`.
- [x] `src/test/tenants/tenant-spec.test.ts`: cada regla del validador se prueba rompiéndola (tenant reservado, rótulo vacío, `modules: []`, dominio real, falta de `risk`, prefijo `GARR`, contraseña literal).

### Tarea 2 — Lógica pura del pack base ✅
- [x] `scripts/tenants/bootstrap-lib.ts`: `uuidV5`, `canonicalJson`, `mencionaArga`, `neutralizarAvisoPrototipo`, `seleccionar{RulePacks,RuleSets,Plantillas}`, `clonar{RulePack,RuleSet,Plantilla}`, `cargarPackBase` con verificación de hashes, `resolverEntorno`, `targetEsGovernanceOs`.
- [x] `src/test/tenants/bootstrap-lib.test.ts`: vector RFC 4122 de UUID v5, falso positivo «encargando», exclusiones fail-closed, materia canónica, `tenant_id` explícito, plantilla en `BORRADOR` con hash recalculado.

### Tarea 3 — Snapshot del pack base ✅
- [x] `scripts/export-pack-base-lsc.ts` (solo lee de Cloud) y `--write`.
- [x] Snapshot 2026-09-19 en `scripts/tenants/pack-base-lsc/`: 58 rule packs, 5 rule sets ES, 72 plantillas, `MANIFEST.json`.
- [x] `src/test/tenants/pack-base-lsc.test.ts`: integridad con control positivo (un fichero editado deja de cargar), materias mínimas, ninguna mención a ARGA en campos renderizables, hash = sha256(capa1), identidad funcional única, `CONVOCATORIA_CDA 1.1.0` presente.

### Tarea 4 — Orquestador ✅
- [x] `scripts/tenant-bootstrap.ts`: fases `fundacion` y `pack-base`, dry-run por defecto, Gate PRE local a las 72 plantillas, recuento de tenants reservados antes y después, informe de verificación.
- [x] Dry-run contra Cloud ejecutado: plan correcto, Gate PRE sin bloqueos, ARGA y Garrigues con recuento idéntico.

### Tarea 5 — Aplicación ✅
- [x] `src/lib/login-brands.ts`: entorno `nuevo`, `ENTORNOS_BASE`, `entornosVisibles()`. `src/pages/Login.tsx`: selector por entorno de llegada, última tarjeta a fila completa, botón con `ctaBg`.
- [x] `src/lib/tenant-fixtures.ts`, `src/components/fixtures-guard.tsx`, rutas `/esg` y `/notificaciones` en `src/App.tsx`, dos tarjetas de `src/pages/Dashboard.tsx`, clave `fixtures` en `TenantBranding`.
- [x] Tests: `login-brands.test.ts` (ampliado), `tenant-fixtures.test.ts`, `fixtures-guard.test.tsx`.

### Tarea 6 — Gate de aislamiento a tres tenants ✅ (en `todo` hasta la Tarea 7)
- [x] `src/test/helpers/supabase-test-client.ts`: cuenta `NUEVO`.
- [x] `src/test/schema/tenant-cero-isolation.test.ts`: estado declarado; `todo` visible mientras `cloud: "PENDIENTE"`.

### Tarea 7 — Escritura en Cloud ✅ (2026-09-19, autorizada expresamente por el usuario)
- [x] `DEMO_PASSWORD_NUEVO` generada al azar y añadida al `.env` local (ignorado por git; el valor no se mostró ni se registró).
- [x] `--fase fundacion --commit`: fila `tenants` + branding, 2 usuarios Auth con perfil y rol, 6 `grc_modules`.
- [x] `--fase pack-base --commit`: 58 rule packs con su versión `ACTIVE`, 5 rule sets ES, 72 plantillas llevadas a `ACTIVA` por la RPC. Una sola pasada, sin cortes.
- [x] En las dos ejecuciones, recuento de ARGA y Garrigues idéntico antes y después en las seis tablas tocadas.
- [x] Re-ejecución en dry-run: 0 por crear en las tres tablas (idempotencia comprobada).
- [x] `cloud: "PROVISIONADO"` en `scripts/tenants/tenant-spec.ts`.
- [x] `bun test src/test/schema/tenant-cero-isolation.test.ts` con los tres logins reales: **25 pass, 0 fail, sin `todo`**.
- [x] `bun test src/test/schema/tenant-isolation.test.ts` (gate bilateral ARGA ⇄ Garrigues) y `tenant-cero-isolation.test.ts` (gate tri-tenant): **88 pass, 0 fail (317 expect() calls)** medido el 2026-09-24 en sesión MOI-126.

### Tarea 8 — Recorrido por pantalla ⏳
- [ ] Entrar por `/login?tenant=nuevo` y seguir `2026-09-19-tenant-cero-guion-recorrido.md`.
- [ ] Registrar hallazgos en la tabla del guion.

## Verificación ejecutada el 2026-09-19 / 2026-09-24 (MOI-126)

| Gate | Resultado |
|---|---|
| `tsc -b --pretty false` (src + scripts + tests) | 0 errores |
| `eslint .` sobre el repositorio completo | limpio |
| `bun run build` en árbol con grupo nuevo | éxito (7.62s) |
| `tenant-cero-isolation.test.ts` + `tenant-isolation.test.ts` | 88 pass, 0 fail (317 expects, logins reales) |
| `src/test/garrigues/` en bloque | 98 pass, 0 fail (835 expects) |
| `src/test/tenants/` (bootstrap-lib, pack-base-lsc, tenant-spec) | 44 pass, 0 fail (1250 expects) |
| `bun test` completo en el árbol con grupo nuevo | 4890 pass, 151 skip, 3 todo, 0 fail (33126 expects) |
| Sondas de limpieza Cloud (`PROBE-%`) | 0 filas residuales verificadas en SQL |
| `tenant-bootstrap --tenant nuevo` en dry-run contra Cloud | plan correcto; ARGA y Garrigues intactos |

**Medido el 2026-09-24:** Las 46 sondas de `src/test/schema/` y `src/test/garrigues/` se ejecutaron en bloque con 0 fail (los 2 rojos previos de main quedaron resueltos por la integración de RIA en MOI-125); `bun run build` completado en 7.62s. Siguiente paso: recorrido en pantalla por `/login?tenant=nuevo` (Tarea 8).

## Reversión

Los scripts no borran. Retirar el tenant exige, por este orden y con service-role, borrar sus filas de `plantillas_protegidas` (pasando antes por `ARCHIVADA` vía RPC), `rule_pack_versions`, `rule_packs`, `jurisdiction_rule_sets`, `grc_modules`, `rbac_user_roles`, `user_profiles`, los dos usuarios Auth y la fila de `tenants`. Todas se identifican por `tenant_id = …0003` o por el prefijo `GN_`.
