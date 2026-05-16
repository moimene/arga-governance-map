# Agenda kind baseline analysis

Fecha: 2026-05-16

Rama: `codex/platform-agenda-kind-baseline`

## Alcance

Cluster Supabase historico `agenda-kind-baseline`.

No se han ejecutado escrituras Cloud, `db push`, `db pull`, `repair`, renombres ni cambios funcionales.

Este informe depende del export read-only abierto en PR #29.

## Conclusion

No hay ningun rename directo seguro. El cluster no puede sanearse con `repair` ni con renombres mecanicos, porque Cloud aplico una secuencia granular de 10 migraciones y el repo local conserva 6 ficheros, algunos consolidados.

La remediacion Git-only futura debe ser remote-first:

1. Recuperar los 10 SQL remotos exactos como migraciones activas.
2. Retirar o archivar los locales consolidados tras revisar cada delta.
3. Documentar expresamente el destino de `20260512_000060_agenda_item_kind_backfill.sql`, que no tiene remoto equivalente claro.

## Secuencia real Cloud

| Orden | Remote version | Remote name | Local candidate |
|---:|---|---|---|
| 1 | `20260511133029` | `agenda_item_kind` | `20260512_000059_agenda_item_kind.sql` |
| 2 | `20260511152255` | `agenda_item_kind_codex_fixes` | ninguno |
| 3 | `20260511153417` | `agenda_kind_rpc_security_hardening` | ninguno |
| 4 | `20260511172359` | `agenda_item_kind_status_espanol` | `20260512_000061_agenda_item_kind_status_espanol.sql` |
| 5 | `20260511174751` | `agenda_item_kind_p7_enforcement` | `20260512_000062_agenda_item_kind_p7_enforcement.sql` |
| 6 | `20260511175723` | `20260512_000063_reclassify_noop_guard` | ninguno |
| 7 | `20260511192325` | `20260512_000064_agenda_item_kind_backfill_draft_resolutions` | `20260512_000064_agenda_item_kind_backfill_draft_resolutions.sql` |
| 8 | `20260511193831` | `20260512_000065_rpc_clear_decision_subtype_on_downgrade` | ninguno |
| 9 | `20260511195348` | `20260512_000066_agenda_items_unique_meeting_order` | `20260512_000066_agenda_items_unique_meeting_order.sql` |
| 10 | `20260511200532` | `20260512_000067_rpc_noop_check_after_authz` | ninguno |

## Locales activos

```text
20260512_000059_agenda_item_kind.sql
20260512_000060_agenda_item_kind_backfill.sql
20260512_000061_agenda_item_kind_status_espanol.sql
20260512_000062_agenda_item_kind_p7_enforcement.sql
20260512_000064_agenda_item_kind_backfill_draft_resolutions.sql
20260512_000066_agenda_items_unique_meeting_order.sql
```

## Hotfixes remotos sin fichero local activo

```text
20260511152255_agenda_item_kind_codex_fixes.sql
20260511153417_agenda_kind_rpc_security_hardening.sql
20260511175723_20260512_000063_reclassify_noop_guard.sql
20260511193831_20260512_000065_rpc_clear_decision_subtype_on_downgrade.sql
20260511200532_20260512_000067_rpc_noop_check_after_authz.sql
```

## Riesgos adversariales

- `20260512_000059 -> 20260511133029` es unsafe: el local es mas grande y parece consolidar correcciones posteriores.
- `20260512_000062 -> 20260511174751` es unsafe: el local incluye logica que Cloud repartio en hotfixes posteriores.
- `20260512_000060_agenda_item_kind_backfill.sql` queda como local-only legacy sin equivalente remoto claro.
- No hay SHA exacto en este cluster.

## PR Git-only posterior propuesto

Nombre sugerido:

`codex/platform-agenda-kind-baseline-git`

Cambios permitidos en ese PR futuro:

- copiar desde el export remoto de PR #29 a `supabase/migrations`;
- mover locales consolidados a `docs/superpowers/retired-migrations`;
- incluir cross-reference que explique por que `000060` se retira, reemite o se mantiene bloqueado.

Bloqueos:

- no Cloud writes;
- no `repair`;
- no `db push`;
- no `db pull`;
- no tocar otros clusters.
