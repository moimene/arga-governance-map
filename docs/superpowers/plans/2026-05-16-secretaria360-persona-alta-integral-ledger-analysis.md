# Secretaria 360 - Analisis ledger persona_alta_integral

Fecha: 2026-05-16
Rama: `codex/secretaria360-persona-alta-integral-ledger-analysis`
Modo: analisis read-only/documental. No se ha ejecutado `repair`, `db push`, `db pull`, SQL de escritura, renombres ni cambios funcionales.

## Objetivo

Analizar la divergencia reciente:

- local: `20260515022621_persona_alta_integral.sql`
- remoto: `20260515032449_persona_alta_integral`

y decidir si son equivalentes, divergentes, duplicados/obsoletos o si requieren reemision.

## Estado ledger

`supabase migration list` muestra:

```text
20260514174503 | 20260514174503
20260514181001 | 20260514181001
20260515022621 |
                 | 20260515032449
20260515183150 | 20260515183150
```

Tras el merge de #20 ya no aparece `20260514 |`.

## Fichero local

Fichero:

`supabase/migrations/20260515022621_persona_alta_integral.sql`

Metadatos:

- Lineas: 326
- Bytes: 10958
- SHA-256 completo: `832ca9b3303ca2c1991464d54b83cb324e64b56a8f616af388b9d1da5bb7f7ee`
- Commit de origen local: `a48346a feat(secretaria): add complete persona onboarding`

El fichero local incluye cabecera documental y wrapper:

- comentarios iniciales;
- `BEGIN;`;
- `COMMIT;`.

## Statement remoto aplicado

Lectura read-only de `supabase_migrations.schema_migrations`:

| Campo | Valor |
|---|---|
| version | `20260515032449` |
| name | `persona_alta_integral` |
| statement_count | 1 |
| statements_length | 10603 caracteres |
| statements_sha256 | `5304a4144c689aaba2b0a3010d311f25db850a46bb8fa5ca00c4a03634a14a24` |

El statement remoto empieza directamente en:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_persons_tenant_id_id
  ON public.persons(tenant_id, id);
```

y termina en:

```sql
GRANT EXECUTE ON FUNCTION public.fn_create_persona_completa(uuid, jsonb, text)
  TO authenticated, service_role;
```

No incluye la cabecera local ni `BEGIN/COMMIT`.

## Comparacion material

El hash normalizado del fichero local coincide con el hash del statement remoto cuando se eliminan:

- cabecera documental local;
- `BEGIN;`;
- `COMMIT;`;
- whitespace exterior.

Comando local usado para normalizar:

```bash
sed '1,7d' supabase/migrations/20260515022621_persona_alta_integral.sql \
  | sed '/^BEGIN;$/d;/^COMMIT;$/d' \
  | perl -0pe 's/^\\s+//; s/\\s+\\z//' \
  | shasum -a 256
```

Resultado:

```text
5304a4144c689aaba2b0a3010d311f25db850a46bb8fa5ca00c4a03634a14a24
```

Este hash coincide con `statements_sha256` de `20260515032449`.

## Objetos que crea/modifica

La migracion `persona_alta_integral`:

1. Crea indice unico `ux_persons_tenant_id_id` en `persons(tenant_id, id)`.
2. Crea tabla `persona_profiles`.
3. Crea indices:
   - `idx_persona_profiles_tenant_person`;
   - `idx_persona_profiles_governance_role`.
4. Crea trigger `set_updated_at_persona_profiles`.
5. Habilita RLS en `persona_profiles`.
6. Crea policies tenant-scoped:
   - `persona_profiles_select_tenant`;
   - `persona_profiles_insert_tenant`;
   - `persona_profiles_update_tenant`.
7. Ajusta grants:
   - revoca `PUBLIC`, `anon`, `authenticated`;
   - concede `SELECT` a `authenticated` y `service_role`;
   - concede `SELECT, INSERT, UPDATE` a `service_role`.
8. Crea RPC `fn_create_persona_completa(uuid,jsonb,text)`.
9. Revoca `PUBLIC`/`anon` en la RPC y concede `EXECUTE` a `authenticated`, `service_role`.

## Estado Cloud de objetos

La presencia del statement remoto aplicado y su hash equivalente ya prueban que Cloud contiene el cuerpo material de la migracion.

La comparacion previa del tramo reciente tambien indico presencia de los objetos principales de `persona_alta_integral`. Para este carril no se ejecuto SQL de escritura ni se modifico Cloud.

## Clasificacion

**Equivalente material con timestamp distinto.**

No es byte-equivalente por cabecera/wrapper, pero si es materialmente equivalente respecto al SQL aplicado en Cloud:

- local `20260515022621` contiene el mismo cuerpo material;
- Cloud registra `20260515032449`;
- el hash normalizado local coincide con el hash del statement remoto;
- no hay delta funcional pendiente que aplicar.

## Recomendacion

No ejecutar `repair`.

No aplicar SQL.

No reemitir migracion.

Abrir carril Git-only:

`codex/secretaria360-persona-alta-integral-ledger-align`

Objetivo:

- alinear nombre/timestamp local con Cloud;
- dejar de mostrar `20260515022621 |` y `| 20260515032449` en `supabase migration list`;
- conservar el SQL local materialmente equivalente.

Comando propuesto, no ejecutado en este carril:

```bash
git mv supabase/migrations/20260515022621_persona_alta_integral.sql \
  supabase/migrations/20260515032449_persona_alta_integral.sql
```

Verificacion posterior propuesta:

```bash
supabase migration list | tail -n 40
git diff --name-status origin/main...HEAD
git diff --check origin/main...HEAD
```

Resultado esperado:

```text
20260515032449 | 20260515032449 | 2026-05-15 03:24:49
```

El PR del carril de alineacion debe contener solo el rename.

## Riesgos

- Hacer `repair` sobre `20260515022621` seria incorrecto: Cloud no tiene esa version y la version canonica aplicada es `20260515032449`.
- Retirar el fichero local sin sustituirlo por `20260515032449` dejaria el repo sin representacion local de una migracion remota aplicada.
- Reemitir una nueva migracion crearia duplicidad innecesaria; no hay delta material pendiente.
- No se deben mezclar bloques funcionales con esta alineacion.

## Estado de cierre del carril

- No `repair`.
- No `db push`.
- No `db pull`.
- No SQL de escritura.
- No renombres.
- No cambios funcionales.
