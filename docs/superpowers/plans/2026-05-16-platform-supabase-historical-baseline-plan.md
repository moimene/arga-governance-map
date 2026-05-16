# Supabase historical baseline plan — mayo 9-13 y drift previo

Fecha: 2026-05-16

Rama: `codex/platform-supabase-historical-baseline-plan`

## Restricciones aplicadas

- No `supabase db push`.
- No `supabase db pull`.
- No `supabase migration repair`.
- No SQL de escritura.
- No renombres ni retirada de migraciones.
- No cambios funcionales.

## Resultado ejecutivo

El tramo reciente de Secretaria 360 permanece alineado desde `20260514174503` hasta `20260515183150`.

El drift antiguo de mayo 9-13 no es un caso de rename simple. Hay 19 migraciones locales activas con versiones cortas (`20260509`, `20260511`, `20260512`, `20260513`) y 24 versiones remotas timestamp completas. Varias migraciones remotas son hotfixes que no existen como fichero local activo.

Ademas, `supabase migration list` muestra drift historico anterior a mayo 9. Por tanto, si el objetivo es volver a poder usar `supabase db push` con seguridad, la tarea debe tratarse como baseline plataforma completo, no como parche aislado de Secretaria 360.

## Metodologia read-only

- `git status --short --branch`
- `supabase migration list`
- inventario local con `find supabase/migrations`
- hashes locales con `shasum -a 256`
- lectura remota read-only de `supabase_migrations.schema_migrations` mediante MCP `execute_sql`
- busqueda local de hotfixes remotos con `rg`

No se ha materializado ningun cambio en Cloud.

## Inventario por fecha antes de 2026-05-14

| Dia | Local activo | Remoto ledger | Lectura |
|---|---:|---:|---|
| 20260417 | 0 | 4 | remoto sin representacion local activa |
| 20260418 | 0 | 10 | remoto sin representacion local activa |
| 20260419 | 11 | 10 | versiones locales cortas vs remotas timestamp |
| 20260420 | 6 | 16 | remoto mas granular que local |
| 20260421 | 10 | 27 | remoto mucho mas granular que local |
| 20260423 | 2 | 2 | mismo dia, no necesariamente mismas versiones |
| 20260424 | 10 | 10 | mismo volumen, requiere equivalencia por hash/nombre |
| 20260426 | 0 | 4 | remoto sin representacion local activa |
| 20260427 | 0 | 2 | remoto sin representacion local activa |
| 20260503 | 1 | 1 | alineado |
| 20260504 | 5 | 5 | mezcla de versiones cortas y completas |
| 20260505 | 1 | 0 | local-only |
| 20260509 | 1 | 1 | mismo objetivo aparente, versiones distintas |
| 20260511 | 5 | 16 | remoto tiene hotfixes sin fichero local activo |
| 20260512 | 6 | 7 | remoto incluye personas/cargos y hotfixes agenda |
| 20260513 | 7 | 0 | locales corresponden parcialmente a remoto 20260512 |

## Foco mayo 9-13

### Versiones locales activas

```text
20260509_000057_extend_agreements_adoption_mode_solidario_co_aprobacion.sql
20260511_000058_v2_plantillas_overrides.sql
20260511_000059_v2_plantillas_overrides_worm_hardening.sql
20260511_000060_v2_plantillas_overrides_null_capa3.sql
20260511_000061_plantillas_protegidas_capa3_immutable_with_overrides.sql
20260511_000062_plantillas_capa3_immutable_null_safe.sql
20260512_000059_agenda_item_kind.sql
20260512_000060_agenda_item_kind_backfill.sql
20260512_000061_agenda_item_kind_status_espanol.sql
20260512_000062_agenda_item_kind_p7_enforcement.sql
20260512_000064_agenda_item_kind_backfill_draft_resolutions.sql
20260512_000066_agenda_items_unique_meeting_order.sql
20260513_000063_persons_tax_id_unique.sql
20260513_000064_authority_evidence_trigger_rm_fields.sql
20260513_000065_condiciones_persona_vicesecretario.sql
20260513_000066_personas_cargos_sprint2_core.sql
20260513_000067_personas_cargos_vacancia_scan_filters.sql
20260513_000068_vacancia_notification_tones.sql
20260513_000069_personas_cargos_security_followups.sql
```

### Versiones remotas 2026-05-09 a 2026-05-12

```text
20260509153319 extend_agreements_adoption_mode_solidario_co_aprobacion
20260511044356 v2_plantillas_overrides
20260511094753 v2_plantillas_overrides_capa3_deny_list
20260511133029 agenda_item_kind
20260511152255 agenda_item_kind_codex_fixes
20260511153417 agenda_kind_rpc_security_hardening
20260511163855 v2_plantillas_overrides_worm_hardening
20260511172359 agenda_item_kind_status_espanol
20260511174743 20260511_000060_v2_plantillas_overrides_null_capa3
20260511174751 agenda_item_kind_p7_enforcement
20260511175723 20260512_000063_reclassify_noop_guard
20260511175907 20260511_000061_plantillas_protegidas_capa3_immutable_with_overrides
20260511183128 20260511_000062_plantillas_capa3_immutable_null_safe
20260511192325 20260512_000064_agenda_item_kind_backfill_draft_resolutions
20260511193831 20260512_000065_rpc_clear_decision_subtype_on_downgrade
20260511195348 20260512_000066_agenda_items_unique_meeting_order
20260511200532 20260512_000067_rpc_noop_check_after_authz
20260512112159 condiciones_persona_vicesecretario
20260512112218 persons_tax_id_unique
20260512112258 authority_evidence_trigger_rm_fields
20260512171059 personas_cargos_sprint2_core
20260512183903 personas_cargos_vacancia_scan_filters
20260512185033 personas_cargos_vacancia_notification_tones
20260512190500 personas_cargos_security_followups
```

## Clasificacion inicial

| Bloque | Local | Remoto | Evidencia | Riesgo | Accion propuesta |
|---|---|---|---|---|---|
| Adoption mode avanzado | `20260509_000057` | `20260509153319` | nombre/objetivo alineado; hash local distinto del remoto | medio | comparar statements remotos antes de cualquier rename |
| Plantillas overrides core | `20260511_000058` | `20260511044356` | nombre alineado; hash distinto | medio | comparar contenido y decidir re-timestamp o retirada local |
| Plantillas deny-list | sin fichero local activo | `20260511094753` | `rg` no encontro fichero local/docs | alto | recuperar SQL remoto como fichero local o documentar no-op si esta plegado en otra migracion |
| Plantillas hardening | `20260511_000059..000062` | `20260511163855`, `11174743`, `11175907`, `11183128` | nombres alineados; hashes distintos | medio | comparar por contenido; no rename ciego |
| Agenda kind base | `20260512_000059` | `20260511133029` | nombre alineado; remoto tiene hotfixes posteriores | alto | tratar como secuencia completa, no como rename unitario |
| Agenda hotfixes remotos | sin fichero local activo claro | `20260511152255`, `11153417`, `11175723`, `11193831`, `11200532` | `rg` no encontro ficheros locales/docs | alto | recuperar desde ledger remoto o crear plan de representacion local |
| Agenda fixes locales | `20260512_000061`, `000062`, `000064`, `000066` | `20260511172359`, `11174751`, `11192325`, `11195348` | nombres alineados; no todos exactos por hash | medio | comparar contenido remoto vs local antes de mover |
| Personas pre-core | `20260513_000063..000065` | `20260512112218`, `112258`, `112159` | nombres alineados; hashes distintos | medio | comparar contenido; no rename ciego |
| Personas core/followups | `20260513_000066..000069` | `20260512171059`, `12183903`, `12185033`, `12190500` | SHA-256 coincide exactamente con remote statements | bajo | candidatos a Git-only rename, pero dentro del baseline completo |

## Hotfixes remotos sin fichero local activo encontrado

Estos nombres no aparecen en `supabase/migrations`, `docs/superpowers/retired-migrations` ni historial local buscable con `rg`/`git log --all --name-only`:

```text
v2_plantillas_overrides_capa3_deny_list
agenda_item_kind_codex_fixes
agenda_kind_rpc_security_hardening
20260512_000063_reclassify_noop_guard
20260512_000065_rpc_clear_decision_subtype_on_downgrade
20260512_000067_rpc_noop_check_after_authz
```

Esto bloquea una solucion mecanica de renombrar migraciones locales. Si se quiere que Git vuelva a representar fielmente el ledger Cloud, hay que recuperar esos statements remotos y revisarlos.

## Opciones de saneamiento

### Opcion A — baseline documental, sin habilitar `db push`

Mantener el estado actual como deuda plataforma conocida y prohibir `supabase db push` general. Permite seguir trabajando con aplicaciones SQL puntuales y PRs funcionales controlados, pero no resuelve la operativa de migraciones.

Uso recomendado: corto plazo.

### Opcion B — reconstruir ledger Cloud en Git

1. Extraer statements remotos desde `supabase_migrations.schema_migrations` para todas las versiones remote-only hasta `20260513`.
2. Crear ficheros locales con timestamp remoto exacto.
3. Mover a `docs/superpowers/retired-migrations/` las versiones locales cortas cuando haya equivalencia material demostrada.
4. Hacer renames Git-only solo donde el hash o comparacion de contenido sea concluyente.
5. Ejecutar `supabase migration list` tras cada bloque.

Uso recomendado: si el objetivo es recuperar `supabase db push` en este proyecto.

### Opcion C — repair de ledger

No recomendada como primera linea para este tramo. Hay multiples remote-only sin fichero local y multiples local-only con versiones cortas. Un `repair` sin reconstruccion previa puede ocultar el problema en vez de resolverlo.

## Orden recomendado

1. PR documental de este inventario.
2. Carril `platform-baseline-remote-ledger-export`:
   - read-only;
   - exportar statements remotos a ficheros de trabajo;
   - sin tocar `supabase/migrations` todavia.
3. Carril por cluster:
   - `plantillas-overrides-baseline`;
   - `agenda-kind-baseline`;
   - `personas-cargos-baseline`;
   - `pre-may09-baseline`.
4. Solo despues, si `supabase migration list` queda sin drifts no explicados, evaluar desbloquear `supabase db push`.

## Criterios de go/no-go

Go:

- equivalencia por SHA o diff revisado;
- PR aislado por cluster;
- `supabase migration list` mejora sin introducir nuevos drifts;
- no hay SQL de escritura ni `repair` salvo autorizacion explicita.

No-go:

- hotfix remoto ausente sin representacion local;
- hash distinto sin diff revisado;
- intentar arreglar mayo 9-13 ignorando drift abril/mayo 4-5;
- mezclar baseline con bloques funcionales.

## Estado final de esta fase

- Inventario abierto.
- Sin cambios en Cloud.
- Sin cambios en migraciones activas.
- Siguiente paso seguro: PR documental de este plan o export read-only de statements remotos, segun se autorice.
