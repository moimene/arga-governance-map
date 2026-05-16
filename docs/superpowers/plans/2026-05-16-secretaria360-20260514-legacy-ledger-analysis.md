# Secretaria 360 - Analisis legacy local-only 20260514

Fecha: 2026-05-16
Rama: `codex/secretaria360-20260514-legacy-ledger-analysis`
Modo: analisis read-only. No se ha ejecutado `repair`, `db push`, `db pull`, SQL de escritura, renombres ni borrados.

## Objetivo

Analizar que fichero local produce la version truncada `20260514` en `supabase migration list`, confirmar si su contenido esta o no materializado en Cloud y decidir si corresponde retirar, reemitir, reparar o dejar bloqueado.

## Fichero responsable

La version local-only `20260514` la produce:

`supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql`

Este nombre no sigue el formato de timestamp Supabase usado por el resto del tramo reciente. La CLI toma como version el prefijo anterior al primer `_`, por eso aparece como `20260514` y no como `20260514_000067`.

## Inventario local

Ficheros locales que empiezan por `20260514`:

| Fichero | Estado ledger |
|---|---|
| `20260514174503_no_session_source_of_truth_close.sql` | local/remoto alineado |
| `20260514181001_secretaria_production_sprint_closeout.sql` | local/remoto alineado tras repair |
| `20260514_000067_fn_crear_sociedad_legal_y_capital.sql` | local-only legacy |

`supabase migration list` muestra:

```text
20260514174503 | 20260514174503
20260514181001 | 20260514181001
20260514       |
20260515183150 | 20260515183150
```

## Identificacion del fichero legacy

- Fichero: `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`
- Lineas: 573
- Bytes: 20463
- SHA-256: `7686c0b7df0d81397641045d640ddc4b45bfa089d0d8323001976721f912cbac`
- Tracked por Git: si

## Relacion con la reemision D6

La migracion reemitida y ya cerrada es:

`supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql`

- SHA-256: `84fad0d2f7ca91be56a35ac435e91992bb80eeae2f932ba92fdc54888dc911e9`
- Ledger Cloud: registrado como `secretaria_d6_crear_sociedad_legal_y_capital`

Los ficheros no son byte-equivalentes porque la reemision anade cabecera documental, pero el contenido material coincide:

```bash
diff -u \
  <(tail -n +2 supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql) \
  <(tail -n +4 supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql)
```

Resultado: sin diferencias.

## Objetos que crea/modifica

El fichero legacy D6:

1. Instala `pgcrypto` si falta.
2. Anade 27 columnas legales/onboarding a `entities`.
3. Backfill de `entities.onboarding_status = OPERATIVA` para legacy.
4. Define constraint `chk_entities_onboarding_status`.
5. Crea/reemplaza RPC `fn_crear_sociedad_legal_y_capital(uuid,jsonb)`.
6. Concede `EXECUTE` sobre la RPC a `authenticated` y `service_role`.
7. Anade comentario funcional a la RPC.

## Estado Cloud read-only

Probes ejecutados por MCP Supabase con SELECT read-only:

| Probe | Resultado |
|---|---:|
| Columnas D6 en `entities` | 27/27 |
| Columnas D6 faltantes | ninguna |
| Constraint `chk_entities_onboarding_status` | existe |
| RPC `fn_crear_sociedad_legal_y_capital(uuid,jsonb)` | existe |
| RPC `SECURITY DEFINER` | si |
| `authenticated` tiene `EXECUTE` sobre RPC | si |
| Ledger `20260515183150` | existe |
| Ledger `20260514` | no existe |

## Clasificacion

**Duplicado/obsoleto por reemision valida.**

La migracion legacy `20260514_000067...` no debe aplicarse ni repararse:

- su contenido ya fue reemitido como `20260515183150...`;
- la reemision ya fue aplicada por SQL puntual;
- el ledger remoto ya registra `20260515183150`;
- registrar `20260514` en el ledger preservaria una version truncada/no canonica y no representa una migracion que deba existir en Cloud.

## Recomendacion

No ejecutar `supabase migration repair 20260514 --status applied --linked`.

No aplicar SQL.

No usar `db push`.

El siguiente carril recomendado debe ser Git-only:

`codex/secretaria360-20260514-legacy-retire`

Objetivo:

- retirar `supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql` del directorio de migraciones activas;
- preservar trazabilidad del legacy si se considera necesario, por ejemplo moviendolo a:
  `docs/superpowers/proposed-migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql`
  o documentando su eliminacion en el PR;
- verificar que `supabase migration list` ya no muestra `20260514` local-only;
- no tocar Cloud.

Comando potencial, no ejecutado:

```bash
mkdir -p docs/superpowers/proposed-migrations
git mv supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql \
  docs/superpowers/proposed-migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
supabase migration list | rg '20260514|20260515183150|Local|Remote'
```

Decision abierta para el revisor:

- **Mover a `docs/superpowers/proposed-migrations/`** si se quiere conservar el artefacto historico.
- **Eliminar** si basta con la reemision `20260515183150` y el plan de PR #16.

Mi recomendacion operativa es moverlo, no eliminarlo, para mantener trazabilidad sin contaminar `supabase/migrations`.

## Riesgos

- Mientras el fichero legacy siga en `supabase/migrations`, cualquier `supabase db push` desde un entorno que lo contenga seguira viendo `20260514` como pendiente.
- Reparar `20260514` ocultaria el warning local, pero introduciria en Cloud una version no canonica e innecesaria.
- El movimiento debe revisarse en PR Git-only separado para no mezclarlo con `persona_alta_integral` ni bloques funcionales.

## Estado de cierre del carril

- No `repair`.
- No `db push`.
- No `db pull`.
- No SQL de escritura.
- No renombres ni borrados.
- No cambios funcionales.
