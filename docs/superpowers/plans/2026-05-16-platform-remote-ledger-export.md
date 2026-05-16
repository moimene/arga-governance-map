# Platform remote ledger export — Supabase baseline

Fecha: 2026-05-16

Rama: `codex/platform-supabase-remote-ledger-export`

## Restricciones aplicadas

- No `supabase db push`.
- No `supabase db pull`.
- No `supabase migration repair`.
- No SQL de escritura.
- No cambios en `supabase/migrations`.
- No cambios funcionales.

## Punto de partida

PR #28 fue mergeado antes de este carril.

- PR: <https://github.com/moimene/arga-governance-map/pull/28>
- Merge commit: `7fcc2949d8183948ee88dd607971a377fc36ef82`
- Base local: `origin/main`

El tramo reciente Secretaria 360 permanece alineado desde `20260514174503` hasta `20260515183150`.

## Export generado

Destino:

```text
docs/superpowers/ledger-baseline/remote/
docs/superpowers/ledger-baseline/remote-ledger-manifest.json
docs/superpowers/ledger-baseline/local-ledger-manifest.json
```

Contenido:

- 115 ficheros SQL remotos previos a `20260514000000`.
- Manifest remoto enriquecido con comparacion local.
- Manifest local con hashes de las migraciones activas previas a `20260514`.

La extraccion se hizo mediante lectura remota de `supabase_migrations.schema_migrations` usando `supabase db dump --linked --schema supabase_migrations --data-only`. El dump crudo no se conserva en el PR; se normalizo en ficheros SQL individuales de trabajo.

Nota de integridad: en `remote-ledger-manifest.json`, `remote_statement_len` representa la longitud de la cadena SQL reconstruida desde el ledger remoto. `remote_statement_sha256` conserva el hash del statement original; `file_sha256` y `file_len` describen el fichero exportado normalizado para revision Git. La categoria `name_candidate_diff_content` solo indica candidato por nombre normalizado; no implica equivalencia semantica.

## Resumen cuantitativo

| Metrica | Valor |
|---|---:|
| Remote migrations pre-20260514 exportadas | 115 |
| Local migrations activas pre-20260514 | 65 |
| Remote exact SHA match contra local | 6 |
| Remote name candidate / diff content | 34 |
| Remote-only sin local activo | 75 |
| Local exact SHA match contra remote | 6 |
| Local name candidate / diff content | 34 |
| Local-only legacy sin candidato remoto por nombre/hash | 25 |

Por cluster remoto:

| Cluster | Remotas |
|---|---:|
| `pre-may09-baseline` | 91 |
| `agenda-kind-baseline` | 10 |
| `plantillas-overrides-baseline` | 6 |
| `personas-cargos-baseline` | 7 |
| `other-historical-baseline` | 1 |

## Exact SHA matches detectados

Estas son candidatas tecnicas para rename/retire Git-only, pero no deben ejecutarse en este PR:

| Remote version | Remote name | Local candidate |
|---|---|---|
| `20260424182718` | `000040_no_session_resolutions_matter_class` | `supabase/migrations/20260424_000040_no_session_resolutions_matter_class.sql` |
| `20260512112159` | `condiciones_persona_vicesecretario` | `supabase/migrations/20260513_000065_condiciones_persona_vicesecretario.sql` |
| `20260512171059` | `personas_cargos_sprint2_core` | `supabase/migrations/20260513_000066_personas_cargos_sprint2_core.sql` |
| `20260512183903` | `personas_cargos_vacancia_scan_filters` | `supabase/migrations/20260513_000067_personas_cargos_vacancia_scan_filters.sql` |
| `20260512185033` | `personas_cargos_vacancia_notification_tones` | `supabase/migrations/20260513_000068_vacancia_notification_tones.sql` |
| `20260512190500` | `personas_cargos_security_followups` | `supabase/migrations/20260513_000069_personas_cargos_security_followups.sql` |

## Remote-only relevantes mayo 9-13

Estos remotos no tienen fichero local activo encontrado por normalizacion de nombre/hash. Deben recuperarse o documentarse antes de cualquier intento de saneamiento del cluster:

| Cluster | Remote version | Remote name |
|---|---|---|
| `plantillas-overrides-baseline` | `20260511094753` | `v2_plantillas_overrides_capa3_deny_list` |
| `agenda-kind-baseline` | `20260511152255` | `agenda_item_kind_codex_fixes` |
| `agenda-kind-baseline` | `20260511153417` | `agenda_kind_rpc_security_hardening` |
| `agenda-kind-baseline` | `20260511175723` | `20260512_000063_reclassify_noop_guard` |
| `agenda-kind-baseline` | `20260511193831` | `20260512_000065_rpc_clear_decision_subtype_on_downgrade` |
| `agenda-kind-baseline` | `20260511200532` | `20260512_000067_rpc_noop_check_after_authz` |

## Local-only relevantes mayo 9-13

| Cluster | Local file | Comparison |
|---|---|---|
| `other-historical-baseline` | `20260509_000057_extend_agreements_adoption_mode_solidario_co_aprobacion.sql` | name candidate / diff content |
| `plantillas-overrides-baseline` | `20260511_000058_v2_plantillas_overrides.sql` | name candidate / diff content |
| `plantillas-overrides-baseline` | `20260511_000059_v2_plantillas_overrides_worm_hardening.sql` | name candidate / diff content |
| `plantillas-overrides-baseline` | `20260511_000060_v2_plantillas_overrides_null_capa3.sql` | name candidate / diff content |
| `plantillas-overrides-baseline` | `20260511_000061_plantillas_protegidas_capa3_immutable_with_overrides.sql` | name candidate / diff content |
| `plantillas-overrides-baseline` | `20260511_000062_plantillas_capa3_immutable_null_safe.sql` | name candidate / diff content |
| `agenda-kind-baseline` | `20260512_000059_agenda_item_kind.sql` | name candidate / diff content |
| `agenda-kind-baseline` | `20260512_000060_agenda_item_kind_backfill.sql` | local-only legacy |
| `agenda-kind-baseline` | `20260512_000061_agenda_item_kind_status_espanol.sql` | name candidate / diff content |
| `agenda-kind-baseline` | `20260512_000062_agenda_item_kind_p7_enforcement.sql` | name candidate / diff content |
| `agenda-kind-baseline` | `20260512_000064_agenda_item_kind_backfill_draft_resolutions.sql` | name candidate / diff content |
| `agenda-kind-baseline` | `20260512_000066_agenda_items_unique_meeting_order.sql` | name candidate / diff content |
| `personas-cargos-baseline` | `20260513_000063_persons_tax_id_unique.sql` | name candidate / diff content |
| `personas-cargos-baseline` | `20260513_000064_authority_evidence_trigger_rm_fields.sql` | name candidate / diff content |

## Hallazgos de subagentes read-only

- Plantillas: no hay ningun rename puro seguro. La remediacion Git-only recomendada es recuperar los 6 SQL remotos exactos y retirar los 5 locales legacy tras informe del cluster.
- Agenda: no hay SHA exacto en el cluster; faltan 5 hotfixes remotos locales. `20260512_000060_agenda_item_kind_backfill.sql` queda como local-only legacy sin equivalente claro.
- Personas/cargos: hay 5 SHA exactos en el cluster. Los dos `name_candidate_diff_content` (`persons_tax_id_unique` y `authority_evidence_trigger_rm_fields`) parecen diferir solo por comentarios, pero deben representarse con SQL remoto exacto si se quiere reproducir el hash Cloud.
- Pre-may09: no es un problema de timestamps. Hay bifurcacion real entre historia Cloud granular y migraciones locales consolidadas. La estrategia recomendada es reconstruccion Git desde ledger remoto y retirada documental de legacy, por tandas.
- Adversarial: no se detectaron secretos obvios en el export con patrones de DB URLs, JWTs, `sk-*`, API keys, private keys o Supabase keys. Los hits de `service_role`, `p_qtsp_token` y `demo@arga-seguros.com` son nombres de rol, parametros o datos demo.

## Adversarial notes

- No se debe inferir equivalencia por nombre. Solo 6 relaciones tienen SHA exacto.
- El cluster `agenda-kind-baseline` no puede arreglarse con renames: faltan cinco hotfixes remotos.
- `pre-may09-baseline` domina el problema: 91 remotas antes de mayo 9. Resolver solo mayo 9-13 no desbloquea `supabase db push`.
- Existe una excepcion legacy de formato remoto: `20260504_000051_secretaria_p0_transactional_rpcs.sql` conserva version remota corta en el ledger Cloud y por tanto no cumple `YYYYMMDDHHMMSS_name.sql`.
- Este PR no debe tocar `supabase/migrations`; los SQL exportados son evidencia de ledger remoto y viven bajo `docs/superpowers/ledger-baseline`.

## Siguiente paso recomendado

Abrir carriles por cluster en este orden:

1. `plantillas-overrides-baseline`
2. `agenda-kind-baseline`
3. `personas-cargos-baseline`
4. `pre-may09-baseline`

Cada cluster debe producir primero un informe Git-only. Solo despues de mergear el informe se podran proponer renames, recuperaciones o retiradas de migraciones activas.

`supabase db push` sigue bloqueado.
