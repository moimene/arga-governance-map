# Personas y Cargos Sprint 2 — plan implementable por waves

**Fecha:** 2026-05-12  
**Estado:** PLAN PARA APROBACION. No autoriza implementacion.  
**Spec fuente:** `docs/superpowers/specs/2026-05-12-personas-cargos-completitud-design.md`  
**Firma legal:** L12-C, L13-B, L20-A firmadas el 2026-05-12.  
**Baseline esperado para ejecutar:** `main` en `e350774` o posterior, worktree limpio.  

---

## 0. Guardrails de ejecucion

Este plan no permite empezar a programar hasta que el usuario lo apruebe
explicitamente.

Reglas no negociables:

- Ejecutar siempre sobre el worktree canonico:
  `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`.
- Antes de implementar, el repo debe estar en `main`, sincronizado con
  `origin/main`, y sin WIP de DemoBackup/Harvey/B9 aplicado.
- No aplicar migraciones Cloud sin confirmacion explicita del usuario por cada
  `apply_migration`.
- No ejecutar consolidaciones Cloud sin confirmacion explicita por cada par.
- No tocar WORM tables (`audit_log`, `censo_snapshot`, `no_session_*`,
  `capital_movements`, auditorias) salvo por APIs auditadas; en consolidacion se
  preservan referencias historicas.
- No borrar cargos historicos: usar `estado='CESADO'` y `fecha_fin`.
- No usar nombre real del cliente.
- UX Garrigues estricta en `/secretaria/*`: tokens `--g-*` y `--status-*`, sin
  Tailwind color nativo ni hex literales.

---

## 1. Estado actual y precondicion critica

El baseline verificado tras PR #5 fue:

- `main` en `e350774`.
- `db:check-target`, `typecheck`, `lint`, `build` y tests secretaria/schema green.
- WIP DemoBackup/Harvey/B9 preservado en stash/rama separada.

Antes de arrancar Wave 0, verificar:

```bash
git status --short --branch
git log --oneline -1
git stash list | head -5
```

Si el worktree no esta en `main` limpio, parar y pedir autorizacion para aislar
WIP. No resolver conflictos ni dropear stash sin confirmacion.

---

## 2. Estrategia de waves

La ejecucion se divide en nueve waves. Cada wave tiene builder + reviewer
adversarial, commits pequenos y gates propios. Si se usa Ruflo, arrancar swarm
hierarchical-mesh con dos roles por wave:

- **builder:** implementa solo el alcance de la wave.
- **reviewer:** valida legal/schema/security/tests y bloquea si contradice L1-L23
  o la firma L12/L13/L20.

No avanzar de wave si:

- hay tests rotos no explicados;
- hay cambios Cloud pendientes de aprobacion;
- se detecta contradiccion legal;
- quedan conflictos git o WIP ajeno mezclado.

---

## Wave 0 — Normalizacion, inventario y preflights

**Objetivo:** dejar base limpia y producir inventario factual antes de tocar
schema o UI.

### Tareas

1. Volver a `main` limpio.
2. Confirmar target Supabase:

```bash
bun run db:check-target
```

3. Ejecutar baseline:

```bash
bun run typecheck
bun run lint
bun run build
bun test src/test/secretaria src/test/schema
```

4. Inventariar datos demo:
   - duplicados semanticos ARGA Seguros;
   - duplicados PF Antonio Rios;
   - filiales `PENDIENTE-*`;
   - singleton collisions actuales;
   - admin solidario/mancomunado con menos de 2;
   - CdA sin Presidente;
   - cargos certificantes sin RM.
5. Inventariar dependencias de representante PJ:
   - reads de `persons.representative_person_id`;
   - writes duales;
   - queries actuales a `representaciones`.
6. Inventariar superficies de notifications/capability:
   - tabla `notifications`;
   - `capability_matrix`;
   - helpers `fn_secretaria_assert_*`.

### Artefactos

- `docs/superpowers/plans/2026-05-12-personas-cargos-sprint2-wave0-inventory.md`
- SQL snippets de preflight guardados en el doc, no aplicados.

### Gates

```bash
git status --short --branch
bun run db:check-target
bun run typecheck
bun run lint
bun run build
bun test src/test/secretaria src/test/schema
```

### Commit esperado

`docs(secretaria/cargos): inventario Sprint 2 personas-cargos`

---

## Wave 1 — Tests de contrato SQL y hardening skeleton

**Objetivo:** escribir primero los tests que fallaran hasta implementar RPCs,
indices y capabilities.

### Tareas

1. Crear tests de contrato para:
   - indices singleton L12-C;
   - `fn_designar_cargo`;
   - `fn_consolidate_person`;
   - metadata de functions: `SECURITY DEFINER`, `search_path`, grants;
   - nuevas actions en `capability_matrix`.
2. Crear tests RLS denial:
   - tenant incorrecto;
   - falta de `CARGO_MANAGEMENT`;
   - falta de `PERSON_CONSOLIDATE`.
3. Crear tests de race condition a nivel schema/RPC cuando el harness lo permita.
4. Crear tests de `DesignarAdminStepper` para `personaFinal.id` mismatch.

### Archivos probables

- `src/test/schema/personas-cargos-sprint2-rpc-hardening.test.ts`
- `src/test/schema/personas-cargos-singletons.test.ts`
- `src/test/schema/personas-cargos-rls-denial.test.ts`
- `src/test/secretaria/designar-admin-stepper-identity.test.ts`

### Gates

```bash
bun test src/test/schema/personas-cargos-sprint2-rpc-hardening.test.ts
bun test src/test/schema/personas-cargos-singletons.test.ts
bun test src/test/schema/personas-cargos-rls-denial.test.ts
bun test src/test/secretaria/designar-admin-stepper-identity.test.ts
```

Es aceptable que fallen inicialmente si el commit se marca como test-first y el
fallo queda documentado. No mergear wave incompleta a `main`.

### Commit esperado

`test(secretaria/cargos): contratos Sprint 2 RPC singleton y RLS`

---

## Wave 2 — Migracion SQL base: capabilities, singleton indexes, RPC skeleton

**Objetivo:** introducir schema local/migration file sin aplicar Cloud.

### Tareas

1. Nueva migracion local, nombre tentativo:
   `supabase/migrations/20260512_000066_personas_cargos_sprint2_core.sql`.
2. Insertar/actualizar `capability_matrix`:
   - `PERSON_WRITE`
   - `CARGO_MANAGEMENT`
   - `PERSON_CONSOLIDATE`
   - `REPRESENTATION_MANAGEMENT`
3. Crear indices L12-C:
   - `ux_condicion_singleton_body_vigente` para `PRESIDENTE`,
     `SECRETARIO`, `CONSEJERO_COORDINADOR`;
   - `ux_condicion_admin_unico_entity_vigente` para `ADMIN_UNICO`.
4. No incluir `VICESECRETARIO` ni `VICEPRESIDENTE`.
5. Crear skeletons RPC con hardening completo:
   - `fn_designar_cargo`;
   - `fn_consolidate_person`;
   - helper de idempotencia si se decide usar tabla auxiliar.
6. Resolver punto CONSEJERO_COORDINADOR:
   - para Sprint 2, usar UNIQUE simple si el preflight confirma que el piloto
     ARGA es cotizado y no hay no-cotizadas usando el cargo;
   - documentar en comentario SQL que el perfil normativo futuro puede mover el
     enforce adicional a RPC parametrizada.

### Preflight antes de aplicar Cloud

Debe existir query que devuelva 0:

```sql
-- duplicados singleton body
SELECT tenant_id, entity_id, body_id, tipo_condicion, COUNT(*)
FROM condiciones_persona
WHERE estado = 'VIGENTE'
  AND tipo_condicion IN ('PRESIDENTE','SECRETARIO','CONSEJERO_COORDINADOR')
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;

-- duplicados ADMIN_UNICO
SELECT tenant_id, entity_id, tipo_condicion, COUNT(*)
FROM condiciones_persona
WHERE estado = 'VIGENTE'
  AND tipo_condicion = 'ADMIN_UNICO'
GROUP BY 1,2,3
HAVING COUNT(*) > 1;
```

Si devuelve filas, parar y pedir decision de cese.

### Gates

```bash
bun run typecheck
bun test src/test/schema/personas-cargos-sprint2-rpc-hardening.test.ts
bun test src/test/schema/personas-cargos-singletons.test.ts
```

### Commit esperado

`feat(db): contratos core Sprint 2 personas-cargos`

---

## Wave 3 — `fn_designar_cargo` funcional + migracion UI

**Objetivo:** reemplazar el alta/cese multi-step cliente por RPC atomica.

### Tareas SQL

1. Implementar `fn_designar_cargo` completo:
   - tenant/capability guard;
   - validation de person/entity/body tenant;
   - representative validation L2;
   - singleton lock;
   - cese atomico de singleton previo si `p_cesar_singleton_previo=true`;
   - warnings para `VICESECRETARIO`, `VICEPRESIDENTE`,
     `ADMIN_SOLIDARIO`, `ADMIN_MANCOMUNADO`;
   - idempotency key opcional;
   - return de `condiciones_persona.id`.
2. No tocar WORM.

### Tareas frontend

1. Crear hook `useDesignarCargoRpc` o migrar `useAsignarCargo`.
2. Actualizar `DesignarAdminStepper` para usar RPC.
3. Corregir defecto `personaFinal`:
   - abortar si `personaFinal.id !== draft.person_id`;
   - abortar si `personIdFromUrl && personaFinal.id !== personIdFromUrl`.
4. Mantener mensajes legales L2/L12/L13 con tokens Garrigues.

### Tests

- Unit `personaFinal` mismatch.
- Schema/RPC happy path.
- Race: dos PRESIDENTEs concurrentes.
- UI mutation no usa insert directo multi-step.

### Gates

```bash
bun test src/test/secretaria/designar-admin-stepper-identity.test.ts
bun test src/test/schema/personas-cargos-sprint2-rpc-hardening.test.ts
bun run typecheck
bun run lint
```

### Commit esperado

`feat(secretaria/cargos): designacion atomica via RPC`

---

## Wave 4 — `fn_consolidate_person` y script bridge

**Objetivo:** convertir la consolidacion en transaccional y mantener el script
como CLI seguro.

### Tareas SQL

1. Implementar `fn_consolidate_person`.
2. Preflight dentro de la transaccion:
   - `ux_condicion_vigente`;
   - `ux_representaciones_vigente`;
   - `ux_authority_vigente`;
   - entity person linkage;
   - duplicate already archived;
   - WORM refs.
3. WORM skip:
   - no update sobre `no_session_*`;
   - no update sobre `capital_movements`;
   - preservar duplicado archived como target historico vivo.
4. Return JSON con conteos.

### Tareas script

1. `scripts/consolidate-duplicate-persons.ts` debe:
   - mantener `--dry-run`;
   - usar RPC para `--apply`;
   - imprimir preflight RPC;
   - seguir exigiendo `--pair` para semanticos.
2. No ejecutar `--apply` Cloud en esta wave sin confirmacion.

### Tests

- RPC function metadata.
- Idempotency.
- WORM skip.
- Collision abort.
- Script dry-run no muta.

### Gates

```bash
bun test src/test/schema/personas-cargos-consolidate-rpc.test.ts
bun run typecheck
bun run lint
```

### Commit esperado

`feat(secretaria/personas): consolidacion atomica por RPC`

---

## Wave 5 — Higiene de datos demo con confirmacion humana

**Objetivo:** aplicar limpieza demo solo despues de tener RPC y con aprobacion.

### Tareas

1. Ejecutar solo preflight/dry-run:

```bash
bun run db:check-target
bun scripts/consolidate-duplicate-persons.ts --dry-run
```

2. Para cada par semantico, producir ficha:
   - canonical;
   - duplicate;
   - FKs;
   - WORM refs;
   - cargos vigentes;
   - capital;
   - recommendation.
3. Pedir confirmacion usuario por par.
4. Si confirma, ejecutar `--pair ... --apply` usando RPC.
5. Verificar post-probes.

### Pares iniciales

- ARGA Seguros `A-00001001` vs `A-99999903`.
- Antonio Rios `12345679B` vs `NIF-DEMO-01-89B557`.
- Filiales `PENDIENTE-*`: clasificacion, no necesariamente consolidacion.

### Gates

```bash
bun run db:check-target
bun test src/test/schema/personas-cargos-consolidate-rpc.test.ts
bun test src/test/secretaria/persona-filters.test.ts
```

### Commit esperado

`docs(secretaria/personas): log limpieza demo Sprint 2`

Si hay cambios de datos Cloud, documentarlos en:

`docs/superpowers/plans/2026-05-12-personas-cargos-sprint2-cloud-apply-log.md`

---

## Wave 6 — Vacancia presidencial L13-B

**Objetivo:** crear detector y notificaciones persistentes D+0/D+60/D+90.

### Tareas SQL/backend

1. Decidir implementacion:
   - RPC `fn_scan_vacancias_presidencia(p_tenant_id uuid) returns jsonb`;
   - o Edge/client-triggered scan si no requiere DB write central.
2. Usar tabla `notifications` existente.
3. Garantizar idempotencia por `tenant_id/body_id/threshold`.
   - Si falta campo metadata, usar `route` estable y `type` por threshold.
   - Si no alcanza, proponer migracion minima; no aplicarla sin aprobacion.
4. Owner funcional en texto: Secretario/Vicesecretario.
5. No bloquear operaciones.

### Tareas UI

1. Mostrar badges/alerts en:
   - `SociedadDetalle` autoridad;
   - `PersonaDetalle` cargos;
   - dashboard Secretaria si existe superficie adecuada.
2. Tokens `--status-warning`, `--status-error`, `--status-info`.

### Tests

- D+0 crea info.
- D+60 crea warning.
- D+90 crea critical.
- Re-run no duplica.
- No bloqueo de operacion.

### Gates

```bash
bun test src/test/schema/personas-cargos-vacancia-presidencia.test.ts
bun test src/test/secretaria/cargo-validation.test.ts
bun run typecheck
bun run lint
```

### Commit esperado

`feat(secretaria/cargos): notificaciones vacancia presidencia`

---

## Wave 7 — Deprecar dual-write como fuente de lectura + historico representantes

**Objetivo:** convertir `representaciones` en fuente canonica UI.

### Tareas

1. Inventario de reads `representative_person_id`.
2. Migrar hooks:
   - `useRepresentanteAdminPJ`;
   - `useRepresentantesAdminPJByPerson`;
   - `usePersonaCanonical` / enriquecida si aplica.
3. Mantener dual-write legacy solo como compatibilidad transitoria.
4. PersonaDetalle muestra:
   - representante vigente desde `representaciones`;
   - timeline historico;
   - source/evidence RM.
5. No DROP de columna.

### Tests

- UI/hook no depende de `persons.representative_person_id`.
- Timeline muestra historico.
- Upsert cierra vigente anterior con `effective_to`, no DELETE.

### Gates

```bash
bun test src/test/secretaria
bun run typecheck
bun run lint
```

### Commit esperado

`refactor(secretaria/personas): representaciones como fuente canonica`

---

## Wave 8 — UX cliente: editar, search, paginacion, chips

**Objetivo:** cubrir productividad cliente real sin bloquear integridad core.

### Tareas

1. `useUpdatePersona` + UI editable en `PersonaDetalle`.
2. Search server-side:
   - por nombre;
   - tax_id;
   - email si existe.
3. Paginacion o virtualizacion en `PersonasList`.
4. Selectores PF sin cap fijo de 2000.
5. Chips `Inscrito` / `Pendiente RM` en autoridad.
6. No introducir colores fuera de tokens Garrigues.

### Tests

- Update persona bloquea tax_id duplicado.
- Search server-side busca por nombre/NIF.
- Listado no carga todo el tenant.
- Chips usan `--status-success` / `--status-warning`.

### Gates

```bash
bun test src/test/secretaria
bun run typecheck
bun run lint
bun run build
```

### Commit esperado

`feat(secretaria/personas): edicion search paginacion y chips RM`

---

## Wave 9 — Representaciones secundarias LSC

**Objetivo:** UI de `JUNTA_PROXY` y `CONSEJO_DELEGACION`.

### Tareas

1. Crear componentes/wizards:
   - proxy socio para Junta;
   - delegacion consejero para Consejo.
2. Usar `representaciones.scope`.
3. Exigir `meeting_id`.
4. Cerrar/cancelar con `effective_to`, no DELETE.
5. Integrar en:
   - ficha persona;
   - detalle reunion si corresponde.

### Tests

- `JUNTA_PROXY` sin `meeting_id` falla.
- `CONSEJO_DELEGACION` sin `meeting_id` falla.
- Alta/cancelacion preserva historico.

### Gates

```bash
bun test src/test/secretaria
bun test src/test/schema/canonical-model.test.ts
bun run typecheck
bun run lint
```

### Commit esperado

`feat(secretaria/representaciones): proxy junta y delegacion consejo`

---

## Wave 10 — Importacion bulk + readiness + E2E cierre

**Objetivo:** cerrar el sprint con flujo productivo completo y readiness CI.

### Tareas

1. Import CSV/Excel:
   - parse;
   - dry-run;
   - preview;
   - apply via RPCs.
2. Crear/extender `scripts/demo-readiness-personas-cargos.ts`:
   - duplicados reales;
   - singleton collisions;
   - admins <2;
   - cargos sin RM;
   - vacancias;
   - representante PJ faltante;
   - representaciones secundarias invalidas.
3. Integrar readiness en CI si existe workflow adecuado.
4. E2E:
   - submit real de cese;
   - alta cargo PJ admin + representante PF + RM ref;
   - representante PJ 3 pasos;
   - certificacion bloqueada por falta RM;
   - `DISTRIBUCION_CARGOS` end-to-end.

### Gates finales

```bash
bun run db:check-target
bun run typecheck
bun run lint
bun run build
bun test src/test/secretaria src/test/schema
bun run test:e2e -- e2e/44-personas-cargos-flow.spec.ts
bun scripts/demo-readiness-personas-cargos.ts
```

Si el script/e2e requieren nombres de comandos distintos, el plan de wave debe
ajustarlos antes de ejecutar.

### Commit esperado

`test(secretaria/cargos): readiness y e2e Sprint 2`

---

## 3. Cloud apply protocol

Ninguna migracion se aplica a Cloud durante escritura del plan.

Cuando una wave requiera Cloud:

1. Ejecutar:

```bash
bun run db:check-target
git status --short --branch
```

2. Mostrar al usuario:
   - migration file exacto;
   - SQL summary;
   - preflight results;
   - rollback strategy;
   - post-probes.
3. Pedir confirmacion explicita.
4. Aplicar una migracion cada vez.
5. Ejecutar post-probes y documentar en cloud apply log.

Rollback:

- No `reset --hard`.
- No force-push.
- No revert Cloud sin diagnostico y confirmacion.
- Preferir fix-forward SQL si la migracion ya aplico y hay datos nuevos.

---

## 4. Commits y PR

Commits sugeridos:

1. `docs(secretaria/cargos): inventario Sprint 2 personas-cargos`
2. `test(secretaria/cargos): contratos Sprint 2 RPC singleton y RLS`
3. `feat(db): contratos core Sprint 2 personas-cargos`
4. `feat(secretaria/cargos): designacion atomica via RPC`
5. `feat(secretaria/personas): consolidacion atomica por RPC`
6. `docs(secretaria/personas): log limpieza demo Sprint 2`
7. `feat(secretaria/cargos): notificaciones vacancia presidencia`
8. `refactor(secretaria/personas): representaciones como fuente canonica`
9. `feat(secretaria/personas): edicion search paginacion y chips RM`
10. `feat(secretaria/representaciones): proxy junta y delegacion consejo`
11. `test(secretaria/cargos): readiness y e2e Sprint 2`

PR final:

- incluir checklist L12/L13/L20;
- adjuntar cloud apply logs;
- adjuntar E2E/readiness output;
- listar cualquier deferred item.

---

## 5. Definicion de done

Sprint 2 esta cerrado solo si:

- los cambios corren desde `main` limpio o rama feature nacida de `main`;
- no quedan WIP DemoBackup/Harvey/B9 mezclados;
- las migrations necesarias tienen confirmacion y logs;
- no hay WORM rewrites;
- `fn_designar_cargo` y `fn_consolidate_person` pasan tests de hardening;
- singletons L12-C no admiten duplicados;
- `VICESECRETARIO` no esta en singleton hard;
- L13-B crea notificaciones idempotentes;
- L20 sigue fuera de implementacion;
- UI lee representante PJ desde `representaciones`;
- `personaFinal` valida identidad;
- `DISTRIBUCION_CARGOS` E2E pasa;
- `bun run typecheck`, `bun run lint`, `bun run build`, tests secretaria/schema,
  E2E y readiness pasan.

---

## 6. Decision requerida antes de programar

Para levantar el NO-GO de implementacion, el usuario debe confirmar:

1. Que aprueba este plan por waves.
2. Que autoriza normalizar el worktree actual a `main` limpio, preservando WIP.
3. Que se creara una rama feature nueva desde `main` para Sprint 2.
4. Que cada Cloud apply y cada consolidacion demo requerira confirmacion
   individual.
