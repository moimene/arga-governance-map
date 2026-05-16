# Plantillas overrides baseline analysis

Fecha: 2026-05-16

Rama: `codex/platform-plantillas-overrides-baseline`

## Alcance

Cluster Supabase historico `plantillas-overrides-baseline`.

No se han ejecutado escrituras Cloud, `db push`, `db pull`, `repair`, renombres ni cambios funcionales.

Este informe depende del export read-only abierto en PR #29:

- `docs/superpowers/ledger-baseline/remote-ledger-manifest.json`
- `docs/superpowers/ledger-baseline/remote/*.sql`

## Conclusion

No hay ningun rename puro seguro en este cluster. Todas las relaciones locales/remotas son como maximo candidatas por nombre, no equivalencias por SHA.

La remediacion Git-only recomendada, despues de mergear PR #29, es:

1. Recuperar como migraciones activas los 6 SQL remotos exactos con timestamps Cloud.
2. Mover los 5 ficheros locales legacy a `docs/superpowers/retired-migrations/`.
3. No ejecutar `repair`, `db push`, `db pull` ni SQL Cloud.

## Tabla de decision

| Remote version | Remote name | Local candidate | Decision |
|---|---|---|---|
| `20260511044356` | `v2_plantillas_overrides` | `20260511_000058_v2_plantillas_overrides.sql` | Recuperar remoto exacto; retirar local legacy. El local ya incorpora logica que Cloud separo en hotfix posterior. |
| `20260511094753` | `v2_plantillas_overrides_capa3_deny_list` | ninguno | Recuperar remoto exacto. Es hotfix remote-only. |
| `20260511163855` | `v2_plantillas_overrides_worm_hardening` | `20260511_000059_v2_plantillas_overrides_worm_hardening.sql` | Recuperar remoto exacto; retirar local legacy. |
| `20260511174743` | `20260511_000060_v2_plantillas_overrides_null_capa3` | `20260511_000060_v2_plantillas_overrides_null_capa3.sql` | Recuperar remoto exacto; retirar local legacy. |
| `20260511175907` | `20260511_000061_plantillas_protegidas_capa3_immutable_with_overrides` | `20260511_000061_plantillas_protegidas_capa3_immutable_with_overrides.sql` | Recuperar remoto exacto; retirar local legacy. |
| `20260511183128` | `20260511_000062_plantillas_capa3_immutable_null_safe` | `20260511_000062_plantillas_capa3_immutable_null_safe.sql` | Recuperar remoto exacto; retirar local legacy. |

## Riesgos

- Renombrar locales cortos ocultaria que Cloud aplico una secuencia distinta y mas granular.
- El hotfix `20260511094753` no existe en `supabase/migrations`; si no se recupera, Git no representara el ledger Cloud.
- `supabase db push` sigue bloqueado aunque este cluster se sanee, porque quedan `agenda-kind`, `personas-cargos` y `pre-may09`.

## PR Git-only posterior propuesto

Nombre sugerido:

`codex/platform-plantillas-overrides-baseline-git`

Cambios permitidos en ese PR futuro:

- copiar desde el export remoto de PR #29 a `supabase/migrations`;
- mover legacy locales a `docs/superpowers/retired-migrations`;
- actualizar un documento de cross-reference.

Bloqueos:

- no Cloud writes;
- no `repair`;
- no `db push`;
- no `db pull`;
- no tocar otros clusters.
