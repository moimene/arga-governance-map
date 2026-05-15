# Secretaria 360 - Reemision D6 000067 con timestamp valido

Fecha: 2026-05-15
Rama: `codex/secretaria360-d6-000067-reissue-plan`
Modo: Git-only. No se ha aplicado Cloud, no se ha ejecutado `db push`, `repair` ni SQL de escritura.

## Objetivo

Preparar la reemision de la migracion D6 `fn_crear_sociedad_legal_y_capital` con un timestamp valido generado por Supabase CLI, dejando el contenido listo para revision sin tocar Cloud.

## Nueva migracion propuesta

Fichero creado con:

```bash
supabase migration new secretaria_d6_crear_sociedad_legal_y_capital
```

Resultado:

```text
supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql
```

## Origen del SQL

Origen:

```text
supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
```

El contenido fue portado de forma materialmente identica. Ajuste realizado:

- solo cabecera del fichero nuevo, para indicar:
  - nombre nuevo con timestamp valido;
  - origen legacy `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`;
  - prohibicion de aplicar a Cloud sin autorizacion explicita.

Comprobacion:

```bash
diff -u \
  <(tail -n +4 supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql) \
  <(tail -n +2 supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql)
```

Resultado: sin diferencias. Es decir, salvo la cabecera nueva, el SQL portado coincide con el legacy.

## Estado del fichero legacy

El fichero legacy queda **sin tocar** en este carril:

```text
supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
```

Motivo:

- el usuario autorizo preparar el plan de retirada/movimiento, no ejecutarlo;
- retirar o mover el legacy afecta al ledger local y debe revisarse como paso separado;
- mientras ambos ficheros convivan, `supabase migration list` mostrara tanto `20260514` como `20260515183150` como local-only.

Recomendacion para el siguiente carril:

1. Si se aprueba la nueva migracion, mover el legacy fuera de `supabase/migrations`.
2. Ruta sugerida:

   ```text
   docs/superpowers/proposed-migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
   ```

3. Alternativa: eliminarlo si el equipo acepta que la reemision nueva sustituye plenamente el artefacto legacy.

No ejecutar ninguna de esas acciones sin autorizacion explicita.

## Que define la migracion reemitida

La migracion reemitida mantiene el alcance D6:

- ampliacion de `entities` con campos legales, registrales, domicilio, sector, grupo, soporte documental y `onboarding_status`;
- constraint `chk_entities_onboarding_status`;
- RPC `fn_crear_sociedad_legal_y_capital(uuid, jsonb)`;
- `GRANT EXECUTE` a `authenticated`;
- comentario de funcion;
- inserciones atomicas en:
  - `persons`;
  - `entities`;
  - `entity_capital_profile`;
  - `share_classes`;
  - `capital_holdings`;
  - `governing_bodies`;
  - `entity_settings`;
  - `rule_param_overrides`.

## Verificaciones ejecutadas

```bash
supabase migration new secretaria_d6_crear_sociedad_legal_y_capital
diff -u <nuevo-sin-cabecera> <legacy-sin-primera-linea>
wc -l -c supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql \
  supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
md5 -q supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql \
  supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
supabase migration list
```

Resultado de `supabase migration list` en el tramo relevante:

```text
20260514174503 | 20260514174503
20260514181001 |
20260514       |
20260515183150 |
```

Lectura:

- `20260514174503` queda alineada local/remoto tras PR #14.
- `20260514` sigue local-only por el fichero legacy D6.
- `20260515183150` es la nueva migracion reemitida local-only.
- `20260514181001` sigue fuera de alcance.

## Riesgos antes de aplicacion futura

Antes de aplicar esta migracion a Cloud debe revisarse:

- `SECURITY DEFINER` en schema `public`.
- `GRANT EXECUTE` a `authenticated`.
- Compatibilidad de columnas nuevas en `entities` con hooks/UI existentes.
- Impacto de `onboarding_status NOT NULL` sobre filas legacy.
- RLS y exposicion Data API para tablas afectadas.
- Pruebas focalizadas de alta sociedad D6.

## Estado final del carril

- Nueva migracion propuesta creada localmente.
- SQL portado con ajuste solo de cabecera.
- Fichero legacy no tocado.
- No Cloud.
- No `db push`.
- No `repair`.
- No aplicacion de migraciones.
- No cambios funcionales.
- No `persona_alta_integral`.
- No `20260514181001_secretaria_production_sprint_closeout`.
