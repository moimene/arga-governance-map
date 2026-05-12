# Personas y Cargos Sprint 2 — execution log

**Fecha:** 2026-05-12  
**Worktree:** `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
**Rama:** `main`  
**Cliente demo:** Grupo ARGA Seguros (pseudonimo)  

## Estado

Sprint 2 core aplicado y saneado con revision adversarial. No se han ejecutado
consolidaciones semanticas de personas porque requieren decision legal/data-owner
por par concreto.

## Migraciones Cloud aplicadas

| Version Cloud | Nombre | Resultado |
|---|---|---|
| `20260512171059` | `personas_cargos_sprint2_core` | OK |
| `20260512183903` | `personas_cargos_vacancia_scan_filters` | OK |
| `20260512185033` | `personas_cargos_vacancia_notification_tones` | OK |
| `20260512190500` | `personas_cargos_security_followups` | OK |

Checks previos: `bun run db:check-target` OK contra `governance_OS`
(`hzqwefkwsxopwrmtksbg`).

## Hallazgos adversariales y cierre

| Hallazgo | Decision/cierre |
|---|---|
| `fn_scan_vacancias_presidencia` intentaba escribir tipos de notificacion fuera del CHECK existente | `000068` mantiene los codigos L13-B D+0/D+60/D+90 en titulo/body y usa `type in ('info','warning','error')`. Runtime smoke OK: 8 avisos D+0 insertados y segunda ejecucion idempotente 0. |
| Scan de vacancias podia tocar datos E2E/PRUEBA | `000067` excluye cuerpos/entidades/personas sinteticas y archivadas. |
| `representaciones` tenia conflict target sin `tenant_id` | `000069` recrea `ux_representaciones_vigente` con `tenant_id` y actualiza los `ON CONFLICT` de `fn_designar_cargo` y `fn_upsert_representante_admin_pj`. |
| `fn_consolidate_person` era invocable por `authenticated` | `000069` revoca `PUBLIC` y `authenticated`; queda solo `service_role`. |
| `fn_update_persona` podia cambiar identidad legal con referencias societarias/evidenciarias | `000069` congela `full_name`, `tax_id` y `denomination` si la persona ya tiene referencias; `email` sigue editable. |
| Cese singleton retroactivo podia crear rangos historicos invalidos | `000069` rechaza reemplazos cuya `fecha_inicio` cierre el cargo vigente antes de su propia `fecha_inicio`. |
| Link `Asignar cargo` desde ficha de persona perdia scope de sociedad | UI usa `useSecretariaScope().createScopedTo(...)`; el wizard sincroniza `entityId` si el scope llega despues. |
| Selector de representante PF podia guardar un id oculto tras cambiar busqueda | `DesignarAdminStepper` y `RepresentanteAdminPJStepper` conservan snapshot/byId de la seleccion vigente y renderizan la opcion seleccionada aunque salga del resultado actual. |
| Scan de notificaciones invalidaba su propia query | `useAutoScanVacanciasPresidencia` usa key separada `["vacancia-presidencia-scan", tenantId]` e invalida solo queries exactas de notificaciones. |

## Verificaciones Cloud

- `ux_representaciones_vigente` en Cloud:
  `(tenant_id, entity_id, represented_person_id, scope, COALESCE(meeting_id, zero_uuid))`
  `WHERE effective_to IS NULL`.
- Privilegios efectivos:
  - `fn_designar_cargo`: `PUBLIC=false`, `authenticated=true`.
  - `fn_consolidate_person`: `PUBLIC=false`, `authenticated=false`,
    `service_role=true`.
- RPCs revisadas siguen con `SECURITY DEFINER` y
  `search_path=public, extensions`.
- Vacancia presidencial:
  - primera ejecucion tras `000068`: `inserted_notifications=8`;
  - segunda ejecucion: `inserted_notifications=0`;
  - tipos persistidos: `info=8`, sin `VACANCIA_*`.

## Gates ejecutados

- `bun test src/test/schema/personas-cargos-vacancia-scan-filters.test.ts src/test/schema/personas-cargos-sprint2-core.test.ts`
- `bun test src/test/secretaria/personas-cargos-sprint2-ui-contract.test.ts src/test/schema/personas-cargos-security-followups.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun test src/test/secretaria src/test/schema` → 93 pass / 0 fail / 142 skip.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 bunx playwright test e2e/44-personas-cargos-flow.spec.ts --project=chromium --reporter=list` → 9 pass.

`bun run build` mantiene solo warnings de tamaño de chunks/Browserslist, sin
fallos.

## Riesgo pendiente

La limpieza de duplicados semanticos ARGA/PF queda bloqueada hasta ficha por par
con decision legal/data-owner. No se debe ejecutar `--apply` ni la RPC de
consolidacion para pares semanticos sin esa decision concreta.
