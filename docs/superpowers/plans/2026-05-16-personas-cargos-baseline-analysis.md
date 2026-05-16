# Personas y cargos baseline analysis

Fecha: 2026-05-16

Rama: `codex/platform-personas-cargos-baseline`

## Alcance

Cluster Supabase historico `personas-cargos-baseline`.

No se han ejecutado escrituras Cloud, `db push`, `db pull`, `repair`, renombres ni cambios funcionales.

Este informe depende del export read-only abierto en PR #29.

## Conclusion

Este es el cluster mas saneable del bloque mayo 9-13:

- 5 migraciones tienen SHA exacto entre Cloud y local.
- 2 migraciones difieren solo por comentarios segun revision read-only, pero no reproducen el hash Cloud si se renombra el fichero local tal cual.

La remediacion Git-only futura recomendada es remote-first para las 2 comment-only y rename directo para las 5 SHA exactas.

## Tabla de decision

| Remote version | Remote name | Local candidate | Evidence | Decision |
|---|---|---|---|---|
| `20260512112159` | `condiciones_persona_vicesecretario` | `20260513_000065_condiciones_persona_vicesecretario.sql` | SHA exacto | Rename Git-only seguro. |
| `20260512112218` | `persons_tax_id_unique` | `20260513_000063_persons_tax_id_unique.sql` | SQL ejecutable equivalente; comentarios distintos | Recuperar remoto exacto y retirar local legacy. |
| `20260512112258` | `authority_evidence_trigger_rm_fields` | `20260513_000064_authority_evidence_trigger_rm_fields.sql` | SQL ejecutable equivalente; comentarios distintos | Recuperar remoto exacto y retirar local legacy. |
| `20260512171059` | `personas_cargos_sprint2_core` | `20260513_000066_personas_cargos_sprint2_core.sql` | SHA exacto | Rename Git-only seguro. |
| `20260512183903` | `personas_cargos_vacancia_scan_filters` | `20260513_000067_personas_cargos_vacancia_scan_filters.sql` | SHA exacto | Rename Git-only seguro. |
| `20260512185033` | `personas_cargos_vacancia_notification_tones` | `20260513_000068_vacancia_notification_tones.sql` | SHA exacto | Rename Git-only seguro. |
| `20260512190500` | `personas_cargos_security_followups` | `20260513_000069_personas_cargos_security_followups.sql` | SHA exacto | Rename Git-only seguro. |

## Correccion adversarial

La premisa inicial de tres pre-core mismatches era demasiado amplia. `condiciones_persona_vicesecretario` es SHA exacto. Los dos mismatches reales son:

- `persons_tax_id_unique`
- `authority_evidence_trigger_rm_fields`

Ambos se deben representar con SQL remoto exacto si se quiere que Git reproduzca la historia Cloud.

## PR Git-only posterior propuesto

Nombre sugerido:

`codex/platform-personas-cargos-baseline-git`

Cambios permitidos:

- `git mv` de los 5 SHA exactos a timestamps remotos;
- copiar los 2 SQL remotos exactos de PR #29 a `supabase/migrations`;
- mover los 2 locales comment-only a `docs/superpowers/retired-migrations`;
- actualizar cross-reference documental.

Bloqueos:

- no Cloud writes;
- no `repair`;
- no `db push`;
- no `db pull`;
- no tocar otros clusters.
