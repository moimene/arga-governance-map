# Secretaría 360 P2 — Inventario de restauración y plan de merge

**Fecha:** 2026-05-17  
**Prioridad:** Básica / crítica para crecimiento del sistema  
**Worktree operativo:** `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
**Rama observada:** `codex/secretaria-d6-e2e-debt`  
**Base remota:** `main` y `origin/main` en `7876ba3`  
**HEAD local observado:** `99b0522 fix(secretaria): route rules entry to materia catalog`  
**PR relacionado:** `#36` (`codex/secretaria-d6-e2e-debt` → `main`)  

---

## 1. Veredicto ejecutivo

El trabajo de Secretaría 360 P1/P2 no está perdido: el schema, las RPCs y la navegación principal existen. La regresión real está en la capa operativa de producto: P2 quedó parcialmente convertido en contrato/demo, con CTAs sin acción real, tablas de mantenimiento vacías y tests que validan presencia de piezas, pero no ejecución end-to-end.

**Decisión recomendada:** mergear el carril como baseline cuanto antes, pero con dos condiciones:

1. No vender P2 como cerrado funcionalmente en demo hasta restaurar los flujos operativos.
2. Abrir inmediatamente un carril de restauración P2 con criterios de cierre basados en datos Cloud y eventos auditados, no solo tests estáticos.

El coste de no mergear es alto: la rama contiene el punto de entrada de Mesa de control jurídico-societaria, migraciones P1/P2 ya registradas en Cloud, hooks y rutas que el resto del sistema necesita para crecer.

---

## 2. Estado observado

### 2.1 Rama y repo

- `main` / `origin/main`: `7876ba3`.
- Rama activa: `codex/secretaria-d6-e2e-debt`.
- La rama está por delante de `main` con el tramo F0-F6 y el commit local `99b0522`.
- `origin/codex/secretaria-d6-e2e-debt` está en `c94855a`; el commit `99b0522` todavía no está en origin.
- Hay cambios sin commit en docs, workflow E2E, cliente Supabase env-driven, observability y tests F4/F6. Deben aislarse antes del merge final.

### 2.2 Cloud `governance_OS`

Verificado contra `governance_OS` (`hzqwefkwsxopwrmtksbg`):

- `bun run db:check-target`: OK.
- `supabase migration list --linked`: P1/P2 registradas.
- MCP Supabase read-only: tablas y RPCs P1/P2 existen, RLS activo, `SECURITY DEFINER` con `search_path=public, extensions`.

Migraciones P1/P2 registradas:

| Versión | Nombre | Estado |
|---|---|---|
| `20260515153057` | `secretaria_normative_maintenance_cloud` | Aplicada, marcador manual en ledger remoto |
| `20260515160345` | `secretaria_p2_normative_governance` | Aplicada, marcador manual en ledger remoto |

### 2.3 Datos Cloud P1/P2

Conteos observados por MCP read-only:

| Tabla | Filas | Lectura |
|---|---:|---|
| `secretaria_normative_framework_status` | 34 | P1 aplicado y usado |
| `secretaria_normative_backfill_runs` | 2 | 1 dry-run + 1 apply |
| `secretaria_normative_event_log` | 10 | Eventos P1, enlazados a `audit_log` |
| `secretaria_effective_rule_matrix` | 1054 | Matriz materializada |
| `secretaria_organ_rules` | 0 | P2 no usado operativamente |
| `secretaria_organ_source_links` | 0 | Fuentes documentales no persistidas |
| `secretaria_statute_versions` | 0 | Estatutos no versionados operativamente |
| `secretaria_statute_clause_mappings` | 0 | Cláusulas no mapeadas |
| `secretaria_normative_overrides` | 0 | Overrides P2 no usados |
| `secretaria_pacto_clause_mappings` | 0 | Pactos P2 no usados |
| `materia_template_binding` | 0 | Binding de plantillas no usado |

Eventos observados:

| Evento | Filas |
|---|---:|
| `effective_rule_viewed` | 8 |
| `normative_backfill_dry_run` | 1 |
| `normative_backfill_applied` | 1 |
| `organ_changed` | 0 |
| `statute_version_published` | 0 |
| `clause_mapped` | 0 |
| `template_assigned` | 0 |
| `expediente_blocked` | 0 |

**Conclusión:** P1 Cloud quedó cerrado en términos mínimos. P2 schema existe, pero el producto no lo alimenta todavía.

---

## 3. Inventario de regresión funcional P2

### R1 — CTAs resolutivos sin ejecución real

**Impacto:** alto. El usuario ve acciones críticas pero no siempre ejecutan mutaciones.

Casos observados:

- Diagnóstico en `ActivarMarcoNormativo`: botón CTA sin navegación ni `onClick`.
- “Activar regla legal base”: `GovernedButton` sin acción de activación.
- “Publicar marco normativo”: botón visible sin `onClick`.
- Texto residual: “contrato de auditoría sin escritura Cloud”, obsoleto tras P1/P2 Cloud.

**Cierre esperado:**

- Cada alerta tiene CTA real o botón deshabilitado con “Solicitar edición”.
- Ningún CTA crítico queda decorativo.
- Cada acción escribe evento normativo o navega a pantalla resolutiva.

### R2 — Versionado de estatutos no operativo

**Impacto:** alto. P2 exige versionar estatutos con documento, publicación inmutable y mapeo de cláusulas.

Estado actual:

- RPC `fn_secretaria_publish_statute_version` existe.
- UI publica un payload demo con `documentUri = secretaria://estatutos/version-demo`.
- Tabla `secretaria_statute_versions` está vacía.
- El SQL permite `ON CONFLICT ... DO UPDATE` sobre versión existente, lo que contradice “versión publicada inmutable”.

**Cierre esperado:**

- Crear versión BORRADOR con referencia documental real.
- Mapear cláusulas a materias/requisitos.
- Publicar solo si cobertura crítica supera umbral.
- Publicada queda inmutable; nuevas versiones archivan sin sobrescribir contenido anterior.
- Evento `statute_version_published` real en Cloud.

### R3 — Catálogo de órganos incompleto

**Impacto:** alto. La matriz efectiva depende de órganos y competencias.

Estado actual:

- `CatalogoOrganos` lee órganos existentes y puede publicar una competencia base si viene con `matter` en query.
- No crea órgano.
- No edita nombre/tipo/estado.
- No vincula reglamento de forma estructurada.
- No crea filas en `secretaria_organ_source_links`.
- Cloud tiene `secretaria_organ_rules = 0`.

**Cierre esperado:**

- Crear/editar órgano o enlazar claramente al flujo que lo haga.
- Publicar competencia por materia con fuente obligatoria.
- Escribir `secretaria_organ_rules` y `secretaria_organ_source_links`.
- Evento `organ_changed`.
- Recalcular matriz efectiva tras cambio.

### R4 — Overrides estatutarios/reglamentarios sin UI conectada

**Impacto:** alto. Es una pieza central del mantenimiento gobernado.

Estado actual:

- Hook `usePublishNormativeOverride` existe.
- RPC `fn_secretaria_publish_normative_override` existe.
- No hay pantalla resolutiva conectada a ese hook.
- Cloud tiene `secretaria_normative_overrides = 0`.

**Cierre esperado:**

- Formulario real: sociedad, materia, fuente, requisito, valor, referencia documental, justificación, vigencia.
- Validación antes/después.
- Bloqueo de rebaja de mínimo legal.
- Inserción en `rule_param_overrides` y `secretaria_normative_overrides`.
- Evento normativo y refresh de matriz efectiva.

### R5 — Pactos parasociales en mantenimiento no persistidos

**Impacto:** medio/alto. Pactos ya afectan simulación, pero no mantenimiento P2.

Estado actual:

- UI permite marcar hipótesis locales de estatutarización, waiver o consentimiento en `RuleManagerPage`.
- No persiste `secretaria_pacto_clause_mappings`.
- Cloud tiene `secretaria_pacto_clause_mappings = 0`.

**Cierre esperado:**

- Mostrar pactos vigentes.
- Mapear cláusulas a materias con efecto jurídico.
- Registrar waiver/cumplimiento/incumplimiento.
- Distinguir bloqueo societario solo si pacto está estatutarizado.

### R6 — Binding de plantillas no operativo

**Impacto:** alto. Sin bindings, el selector automático no es fuente de verdad.

Estado actual:

- RPC `fn_secretaria_assign_template_binding` existe.
- UI puede intentar asignar plantilla sugerida desde wizard.
- Cloud tiene `materia_template_binding = 0`.
- El selector de expedientes sigue dependiendo en gran parte de `plantillas_protegidas` y heurísticas.

**Cierre esperado:**

- `materia + órgano + tipo social + jurisdicción + forma de adopción → plantilla activa`.
- Colisiones visibles con razón jurídica.
- Falta de plantillas mínimas bloquea iniciar expediente.
- Evento `template_assigned`.

### R7 — Matriz efectiva materializada demasiado estrecha

**Impacto:** medio/alto. Hay 1054 filas, pero el cálculo no consolida todo P2.

Estado actual:

- `fn_secretaria_materialize_effective_rule_matrix` cruza `entities × materia_catalog`.
- Solo mira `secretaria_organ_rules` como override estructurado.
- No incorpora estatutos publicados, `secretaria_normative_overrides`, pactos ni bindings.

**Cierre esperado:**

- Fuente ley.
- Fuente estatutos.
- Fuente reglamento.
- Fuente pacto.
- Overrides publicados.
- Documentos requeridos y binding de plantilla.
- Estado operativo/confianza con explicación.

### R8 — Tests insuficientes para detectar esta regresión

**Impacto:** alto. La suite completa está verde pero P2 está vacío.

Verificado:

- `bunx vitest run`: 1714 passed, 134 skipped.
- `bunx tsc -b --pretty false`: OK.
- `bun run build`: OK.
- `git diff --check`: OK.
- `supabase db lint --local --schema public --fail-on error`: OK.

**Problema:** los tests P2 actuales validan presencia de SQL, hooks y textos, no ejecución funcional contra estado persistente.

**Cierre esperado:**

- Tests de UI que fallen si un CTA crítico no tiene acción.
- Tests RPC/Cloud opt-in que verifiquen eventos y filas.
- Tests de selector de plantilla basados en `materia_template_binding`.
- Test de matriz efectiva que falle si ignora overrides/pactos/estatutos publicados.

---

## 4. Plan de merge prioritario

### M0 — Congelar superficie antes de merge

**Objetivo:** evitar que el merge mezcle restauración P2 con higiene no relacionada.

Acciones:

1. Confirmar `git status --short`.
2. Clasificar cambios sin commit actuales:
   - Docs/política `governance_OS`.
   - E2E destructive / staging.
   - Cliente Supabase env-driven.
   - Observability.
   - Tests F4/F6.
3. Decidir si esos cambios entran en PR #36 o van en commit separado previo.
4. No tocar migraciones P1/P2 salvo documentación.

Salida:

- Una rama limpia o con commits temáticos pequeños.
- Commit local `99b0522` empujado o integrado en PR si se mantiene como fix de routing.

### M1 — Mergear baseline crítico a `main`

**Objetivo:** incorporar la Mesa de control y el schema P1/P2 al tronco para que el sistema siga creciendo.

Condiciones mínimas:

- `bun run db:check-target`
- `bunx vitest run`
- `bunx tsc -b --pretty false`
- `bun run build`
- `git diff --check`
- `supabase db lint --local --schema public --fail-on error`
- `supabase migration list --linked` confirma que `20260515153057` y `20260515160345` están aplicadas.

Condiciones de comunicación:

- Marcar P1 Cloud como cerrado.
- Marcar P2 como “baseline schema + UI parcial, restauración funcional pendiente”.
- No declarar “P2 completo” hasta cerrar R1-R8.

Merge recomendado:

1. Push de `codex/secretaria-d6-e2e-debt`.
2. Actualizar PR #36.
3. Revisar que no entra worktree legacy ni cambios temporales.
4. Squash/merge a `main` si CI está verde.
5. Volver al worktree principal en `main`.

### M2 — Crear carril inmediato de restauración P2

**Objetivo:** cerrar regresión sin bloquear el merge del baseline.

Branch sugerida si se permite rama temporal:

- `codex/secretaria360-p2-restauracion`

Si se exige trabajar directamente en `main`, aplicar commits pequeños secuenciales en `main` con push tras cada bloque verde.

Orden de restauración:

1. R1 CTAs reales y mensajes obsoletos.
2. R3 órganos + fuentes + evento `organ_changed`.
3. R2 estatutos + mapeo + publicación inmutable.
4. R4 overrides + validación no rebaja ley.
5. R6 binding de plantillas y selector determinista.
6. R7 matriz efectiva consolidada.
7. R5 pactos persistidos.
8. R8 tests de regresión end-to-end.

---

## 5. Criterios de cierre P2 restaurado

P2 no se considera restaurado hasta que Cloud muestre actividad real:

| Criterio | Mínimo para cierre |
|---|---|
| `secretaria_organ_rules` | > 0 filas demo coherentes |
| `secretaria_organ_source_links` | >= filas de reglas críticas |
| `secretaria_statute_versions` | >= 1 versión publicada ARGA |
| `secretaria_statute_clause_mappings` | >= cláusulas críticas mapeadas |
| `secretaria_normative_overrides` | >= 1 override que eleva requisito |
| `materia_template_binding` | bindings mínimos para expediente demo |
| `secretaria_pacto_clause_mappings` | >= 1 pacto contractual y 1 estatutarizado demo si procede |
| `secretaria_normative_event_log` | eventos `organ_changed`, `statute_version_published`, `clause_mapped`, `template_assigned` |
| `audit_log` | cada evento normativo enlazado |
| UI | ningún CTA resolutivo crítico sin acción |

---

## 6. Tests nuevos obligatorios

Añadir tests que fallen con el estado actual:

1. `ActivarMarcoNormativo` no puede contener CTAs críticos sin `onClick` o `to`.
2. Publicar estatutos exige documento no-demo y escribe evento.
3. Publicar estatutos con cobertura insuficiente falla.
4. Publicar competencia de órgano exige fuente y crea `secretaria_organ_source_links`.
5. `usePublishNormativeOverride` tiene consumidor UI real.
6. Override que eleva mayoría se acepta.
7. Override que rebaja mínimo legal se bloquea.
8. Binding de plantilla escribe `template_assigned`.
9. Expediente bloquea inicio si falta binding mínimo.
10. Matriz efectiva cambia tras publicar órgano/override/estatuto.
11. Pacto contractual no bloquea validez societaria.
12. Pacto estatutarizado sí puede generar bloqueo.
13. UI no muestra `rule pack`, `matter_class`, `adoption_mode`, `gate`, `agenda_item` en pantallas de negocio, salvo módulos técnicos de gestor si se decide mantenerlo explícitamente.

---

## 7. Riesgos de merge

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---:|---:|---|
| Se mergea y alguien interpreta P2 como cerrado | Alta | Alto | Documentar estado en PR y README/handoff |
| PR #36 no incluye `99b0522` | Media | Medio | Push explícito o cherry-pick antes de merge |
| Dirty worktree mezcla staging/observability con P2 | Alta | Medio | Commit temático o sacar a PR separado |
| P2 vacío genera demo débil | Alta | Alto | Restauración inmediata M2 |
| Tests verdes dan falsa confianza | Alta | Alto | Añadir tests de comportamiento antes de declarar cierre |
| `supabase db push` reacciona mal por ledger histórico | Media | Alto | No usar `db push`; P1/P2 ya están aplicadas |

---

## 8. Orden recomendado de ejecución

### Paso 1 — Preparar PR #36

```bash
git status --short
git log --oneline main..HEAD
bun run db:check-target
bunx vitest run
bunx tsc -b --pretty false
bun run build
git diff --check
supabase db lint --local --schema public --fail-on error
```

### Paso 2 — Push/merge baseline

```bash
git push origin codex/secretaria-d6-e2e-debt
```

Actualizar PR #36 con esta nota:

> P1 Cloud cerrado y P2 schema/UI baseline integrado. P2 mantenimiento operativo queda en carril inmediato de restauración: órganos, estatutos, overrides, pactos, bindings y eventos Cloud.

### Paso 3 — Restauración P2 inmediata

Crear carril/restauración y cerrar R1-R8 en commits pequeños. Cada commit debe dejar:

- Tests nuevos o actualizados.
- UI usable.
- Evento normativo cuando aplique.
- Verificación Cloud read-only o local equivalente.

### Paso 4 — Cierre demo-ready

Ejecutar smoke manual demo:

1. Abrir sociedad ARGA.
2. Ver marco normativo.
3. Publicar estatutos con documento.
4. Mapear cláusula.
5. Asignar competencia de órgano con fuente.
6. Publicar override elevando mayoría.
7. Asignar plantilla.
8. Recalcular matriz.
9. Iniciar expediente.
10. Confirmar eventos Cloud y `audit_log`.

---

## 9. No hacer

- No abrir worktrees nuevos.
- No aplicar `supabase db push`.
- No usar `migration repair` en Cloud.
- No mezclar restauración P2 con limpieza cosmética.
- No hardcodear tenant demo en policies nuevas.
- No presentar `governance_OS` como producción congelada.
- No declarar P2 completo si las tablas operativas siguen a 0.

---

## 10. Estado final esperado

Tras merge baseline:

- `main` contiene la Mesa de control y migraciones P1/P2.
- El sistema vuelve a tener una ruta canónica para crecer funcionalmente.
- La deuda P2 está documentada y priorizada.

Tras restauración P2:

- La mesa de control deja de ser solo lectura/contrato.
- Órganos, estatutos, overrides, pactos y plantillas son mantenibles desde UI.
- La matriz efectiva refleja fuentes publicadas reales.
- Los eventos normativos y `audit_log` prueban trazabilidad.
- Tests fallan si se vuelve a una capa decorativa.
