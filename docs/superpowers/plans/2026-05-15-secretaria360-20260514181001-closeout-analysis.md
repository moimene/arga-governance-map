# Secretaria 360 - Analisis ledger 20260514181001 closeout

Fecha: 2026-05-15
Rama: `codex/secretaria360-20260514181001-closeout-analysis`
Modo: analisis read-only. No se ha ejecutado `db push`, `repair`, `db pull`, SQL de escritura ni migraciones.

## Objetivo

Analizar la migracion local:

`supabase/migrations/20260514181001_secretaria_production_sprint_closeout.sql`

para decidir si es obsoleta, pendiente real, ya aplicada fuera de ledger o si debe retirarse/moverse antes de reabrir bloques funcionales.

## Identificacion local

- Fichero: `20260514181001_secretaria_production_sprint_closeout.sql`
- Lineas: 555
- Bytes: 18761
- SHA-256: `f8e2ad7e692a5dc668e7f6d7ecdbfbe89a0fe6374f84241687f55209099d6459`

## Alcance de la migracion

La migracion contiene tres bloques funcionales:

1. Endurecimiento de superficie RPC:
   - revoca `PUBLIC` y `anon`;
   - concede `EXECUTE` a `authenticated` y `service_role`;
   - reserva `fn_consolidate_person` a `service_role`.

2. Nuevas RPCs:
   - `fn_import_persona_row(uuid,text,text,text,text,text,text)`;
   - `fn_upsert_representacion_puntual(uuid,uuid,uuid,uuid,uuid,text,numeric,date,jsonb,text)`;
   - `fn_close_representacion_puntual(uuid,uuid,date,text,text)`.

3. Closeout plantilla `FUSION_ESCISION`:
   - inserta el condicional `{{#if requiere_experto}}`;
   - anade el campo editable `requiere_experto`;
   - deja nota `SEM_FUSION_EXPERTO_CONDICIONAL`.

## Estado ledger

`supabase migration list` muestra:

```text
20260514174503 | 20260514174503
20260514181001 |
20260514       |
20260515183150 | 20260515183150
```

Lectura directa de `supabase_migrations.schema_migrations` confirma:

- `20260515183150` esta registrado como `secretaria_d6_crear_sociedad_legal_y_capital`.
- `20260514181001` no esta registrado.

## Probes read-only Cloud

Se ejecutaron consultas `SELECT` read-only por MCP Supabase. No se ejecuto SQL de escritura.

### RPCs y grants

Todas las funciones esperadas existen y presentan el estado de grants esperado:

| Funcion | Existe | Security definer | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE |
|---|---:|---:|---:|---:|---:|
| `fn_import_persona_row` | si | si | no | si | si |
| `fn_upsert_representacion_puntual` | si | si | no | si | si |
| `fn_close_representacion_puntual` | si | si | no | si | si |
| `fn_designar_cargo` | si | si | no | si | si |
| `fn_update_persona` | si | si | no | si | si |
| `fn_cesar_cargo` | si | si | no | si | si |
| `fn_upsert_representante_admin_pj` | si | si | no | si | si |
| `fn_scan_vacancias_presidencia` | si | si | no | si | si |
| `fn_secretaria_assert_caller_authority_rm` | si | si | no | si | si |
| `fn_consolidate_person` | si | si | no | no | si |

### Plantilla `FUSION_ESCISION`

Para `plantillas_protegidas.id = e3697ad9-e0c2-4baf-9144-c80a11808c07`:

| Probe | Resultado |
|---|---:|
| `materia_acuerdo = FUSION_ESCISION` | si |
| `capa1_inmutable` contiene `{{#if requiere_experto}}` | si |
| `capa3_editables` contiene campo `requiere_experto` | si |
| `review_notes` contiene `SEM_FUSION_EXPERTO_CONDICIONAL` | si |

## Clasificacion

**Ya aplicado fuera de ledger / ledger drift controlado.**

El contenido operacional que define `20260514181001` ya esta presente en Cloud:

- funciones creadas;
- grants endurecidos;
- plantilla cerrada.

La migracion no debe reaplicarse por SQL salvo que se detecte drift material posterior. Reaplicarla actualizaria al menos `review_date` y reescribiria objetos `CREATE OR REPLACE`, sin aportar funcionalidad nueva.

## Recomendacion

No aplicar SQL.

Preparar un carril separado de ejecucion controlada de ledger para marcar la version como aplicada:

```bash
supabase migration repair 20260514181001 --status applied --linked
```

Condiciones antes de ejecutar:

- PR documental de este analisis revisado y mergeado.
- Confirmar de nuevo `supabase migration list`.
- No ejecutar `db push`.
- No ejecutar `db pull`.
- No tocar `20260514`.
- No tocar `persona_alta_integral`.
- No tocar bloques funcionales.

Verificacion posterior propuesta:

```bash
supabase migration list | rg '20260514181001|20260515183150|20260514174503|20260514'
```

Resultado esperado:

```text
20260514181001 | 20260514181001 | 2026-05-14 18:10:01
```

Ademas, repetir probes read-only de:

- existencia y grants de las tres RPCs nuevas;
- `anon_execute=false` en funciones endurecidas;
- `fn_consolidate_person` solo para `service_role`;
- plantilla `FUSION_ESCISION` con condicional y campo `requiere_experto`.

## Riesgos

- `repair` solo corrige ledger; no cambia schema. En este caso es correcto porque los probes muestran que Cloud ya contiene el estado esperado.
- Si se ejecuta `db push` antes del repair, Supabase seguira considerando `20260514181001` pendiente y podria intentar reaplicar una migracion que ya esta materializada.
- `20260514` sigue pendiente como caso separado; no debe mezclarse con este repair.
- `persona_alta_integral` sigue pendiente de analisis especifico porque no es byte-equivalente con la version remota.

## Estado de cierre del carril

- No Cloud write.
- No `db push`.
- No `db pull`.
- No `repair`.
- No cambios SQL.
- No cambios funcionales.
