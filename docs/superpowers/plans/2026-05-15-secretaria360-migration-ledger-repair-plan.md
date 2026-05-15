# Secretaria 360 - Propuesta ejecutable de reconciliacion del ledger reciente

Fecha: 2026-05-15  
Rama: `codex/secretaria360-migration-ledger-repair-plan`  
Base: `origin/main` en `5547827` (`PR #11` mergeado)  
Tipo de bloque: propuesta ejecutable. No ejecuta renombres, `repair`, SQL Cloud ni `db push`.

## Alcance

Convertir el plan aprobado en PR #11 en una propuesta operativa para reconciliar el tramo reciente del ledger de migraciones, separando:

- acciones Git/local;
- posibles `supabase migration repair`;
- comprobaciones read-only;
- criterios de rollback/no-op;
- criterio de go/no-go antes de autorizar cualquier repair real.

Este documento no autoriza por si solo ejecutar el repair. La ejecucion requiere una aprobacion posterior explicita.

## Restricciones vigentes

- No SQL Cloud.
- No `supabase db push`.
- No `supabase migration repair`.
- No renombres ejecutados.
- No agenda/minutas, normativa, doc-gen/copilot ni persona alta integral.
- No commits funcionales.

## Estado de partida confirmado

- `PR #11` esta mergeado.
- `main` local y `origin/main` apuntan a `5547827`.
- El diff funcional grande sigue sin commit y no forma parte de este bloque.
- El `pull --rebase` no se ha podido ejecutar por cambios funcionales unstaged, y no se ha hecho `stash`, `reset` ni `checkout --`.

## Mismatches a resolver

| Mismatch | Estado Cloud | Estado local | Decision propuesta | Repair Cloud | Repair local |
|---|---|---|---|---|---|
| `no_session_source_of_truth_close` | Aplicada como `20260514174503` | Fichero equivalente como `20260514_000068...` | Canonizar nombre local a `20260514174503_no_session_source_of_truth_close.sql` | No | Solo si una DB local tiene registrada `20260514` como aplicada |
| `persona_alta_integral` | Aplicada como `20260515032449` | Fichero probable/equivalente como `20260515022621...` | Comparar cuerpo remoto/local; si equivalente, canonizar a `20260515032449_persona_alta_integral.sql` | No | Solo si una DB local tiene registrada `20260515022621` como aplicada |
| `20260514_000067_fn_crear_sociedad_legal_y_capital` | No aplicada y objetos no existen | Pendiente local | No tocar en reconciliacion; decidir en PR funcional de alta sociedad | No | No |
| `20260514181001_secretaria_production_sprint_closeout` | No aplicada | Pendiente local | No tocar en reconciliacion; decidir en PR funcional/security hardening | No | No |
| Seis migraciones recientes aplicadas en Cloud pero no commiteadas | Aplicadas con version correcta | Ficheros locales untracked | Commitear en PRs funcionales separados, no en repair ledger | No | No |

## Acciones Git/local propuestas

Estas acciones se ejecutarian en un PR tecnico posterior, con arbol de trabajo preparado para no mezclar el diff funcional.

### 1. Preflight Git

```bash
git status --short --branch
git diff --name-status origin/main...HEAD
git diff --check
```

Criterio: el PR tecnico de ledger solo puede contener renombres/recuperacion de ficheros de migracion recientes y su documento de control. No puede contener codigo, UI, tests funcionales ni SQL nuevo no aplicado.

### 2. Canonizar `no_session_source_of_truth_close`

Si el cuerpo remoto/local sigue siendo equivalente:

```bash
git mv supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql \
  supabase/migrations/20260514174503_no_session_source_of_truth_close.sql
```

No se debe crear una migracion nueva. Es una normalizacion del fichero local para representar la version ya aplicada en Cloud.

### 3. Canonizar `persona_alta_integral`

Primero comparar SQL remoto/local:

```sql
select array_to_string(statements, E'\n') as sql_body
from supabase_migrations.schema_migrations
where version = '20260515032449';
```

Si equivalente:

```bash
git mv supabase/migrations/20260515022621_persona_alta_integral.sql \
  supabase/migrations/20260515032449_persona_alta_integral.sql
```

Si no equivalente:

- no hacer `git mv`;
- reconstruir `20260515032449_persona_alta_integral.sql` desde el cuerpo remoto aplicado;
- dejar `20260515022621_persona_alta_integral.sql` marcado como pendiente funcional o retirarlo solo con decision explicita en PR.

## Comprobaciones read-only propuestas

### Cloud ledger

```bash
supabase migration list
```

```sql
select version, name, coalesce(array_length(statements, 1), 0) as statement_count,
       md5(coalesce(array_to_string(statements, E'\n'), '')) as statements_md5
from supabase_migrations.schema_migrations
where version in (
  '20260514174503',
  '20260515032449',
  '20260515045355',
  '20260515070446',
  '20260515070447',
  '20260515132026',
  '20260515153057',
  '20260515160345'
)
order by version;
```

### Cloud objects

```sql
select key, exists_flag
from (
  values
    ('fn_no_session_cast_response', to_regprocedure('public.fn_no_session_cast_response(uuid,uuid,uuid,text,text,text,text)') is not null),
    ('persona_profiles', to_regclass('public.persona_profiles') is not null),
    ('fn_create_persona_completa', to_regprocedure('public.fn_create_persona_completa(uuid,jsonb,text)') is not null),
    ('agenda_items', to_regclass('public.agenda_items') is not null),
    ('agenda_item_constancias', to_regclass('public.agenda_item_constancias') is not null),
    ('canonical_minutes_hash', exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'minutes'
        and column_name = 'canonical_minutes_hash'
    )),
    ('secretaria_normative_framework_status', to_regclass('public.secretaria_normative_framework_status') is not null),
    ('secretaria_organ_rules', to_regclass('public.secretaria_organ_rules') is not null),
    ('secretaria_statute_versions', to_regclass('public.secretaria_statute_versions') is not null),
    ('secretaria_normative_overrides', to_regclass('public.secretaria_normative_overrides') is not null),
    ('materia_template_binding', to_regclass('public.materia_template_binding') is not null),
    ('secretaria_effective_rule_matrix', to_regclass('public.secretaria_effective_rule_matrix') is not null)
) as t(key, exists_flag)
order by key;
```

## Posibles `supabase migration repair`

### Principio

No hay repair Cloud propuesto para los dos mismatches principales porque Cloud ya tiene las versiones canonicas aplicadas:

- `20260514174503`
- `20260515032449`

El repair solo podria ser necesario en bases locales si el CLI registro las versiones antiguas por haber ejecutado antes los ficheros locales con timestamp viejo.

### Repair local condicional para `no_session_source_of_truth_close`

Ejecutar solo si `supabase migration list --local` muestra `20260514` como aplicada y no muestra `20260514174503` como aplicada:

```bash
supabase migration repair --local 20260514 --status reverted
supabase migration repair --local 20260514174503 --status applied
```

### Repair local condicional para `persona_alta_integral`

Ejecutar solo si `supabase migration list --local` muestra `20260515022621` como aplicada y no muestra `20260515032449` como aplicada:

```bash
supabase migration repair --local 20260515022621 --status reverted
supabase migration repair --local 20260515032449 --status applied
```

### Repair Cloud

No-op por defecto. Solo se consideraria si una lectura posterior contradice el estado actual y Cloud deja de mostrar las versiones canonicas aplicadas. En ese caso, no ejecutar directamente: abrir decision separada con captura de `supabase migration list --linked`.

## Rollback/no-op

### Si solo hay renombres Git

Antes de commit:

```bash
git mv supabase/migrations/20260514174503_no_session_source_of_truth_close.sql \
  supabase/migrations/20260514_000068_no_session_source_of_truth_close.sql

git mv supabase/migrations/20260515032449_persona_alta_integral.sql \
  supabase/migrations/20260515022621_persona_alta_integral.sql
```

Despues de commit, revertir el commit del PR tecnico:

```bash
git revert <commit_ledger_repair>
```

### Si se ejecuto repair local

Invertir solo el ledger local, sin tocar datos:

```bash
supabase migration repair --local 20260514174503 --status reverted
supabase migration repair --local 20260514 --status applied

supabase migration repair --local 20260515032449 --status reverted
supabase migration repair --local 20260515022621 --status applied
```

### Si el preflight no cumple

No-op. No renombrar, no repair, no PR tecnico. Documentar el bloqueo.

## Tabla de riesgos

| Riesgo | Severidad | Mitigacion |
|---|---:|---|
| Doble aplicacion de una migracion ya presente en Cloud | Alta | No ejecutar `db push`; canonizar filenames; no Cloud repair si version canonica existe |
| Reparar Cloud por error cuando no hace falta | Alta | Prohibir repair Cloud salvo decision separada y evidencia de ledger contradictorio |
| Mezclar diff funcional con PR de ledger | Alta | `git diff --name-status origin/main...HEAD` debe contener solo ficheros permitidos |
| Persona alta integral no equivalente entre local y remoto | Alta | Comparar cuerpo SQL completo antes de `git mv`; si difiere, reconstruir remoto o pausar |
| Bases locales con ledger antiguo | Media | Repair local condicional y reversible; nunca ejecutar sin `supabase migration list --local` |
| Migraciones pendientes `000067` y `14181001` bloquean futuros `db push` | Alta | Mantenerlas fuera del repair; decidir en PR funcional antes de cualquier push |
| Registros remotos con marcador manual en `statements` | Media | Validar por presencia de objetos y tests schema, no por hash del registro manual |

## Criterio de go/no-go para autorizar repair real

### GO

- PR #11 mergeado.
- Rama tecnica parte de `origin/main` actualizado.
- `git diff --name-status origin/main...HEAD` contiene solo cambios de ledger aprobados.
- Cloud muestra aplicadas `20260514174503` y `20260515032449`.
- Comparacion SQL remoto/local confirma equivalencia o documenta reconstruccion.
- `supabase migration list --local` justifica cualquier repair local propuesto.
- No hay secretos ni cambios funcionales en staging.

### NO-GO

- Cualquier cambio funcional aparece en el PR tecnico.
- Cloud no muestra las versiones canonicas esperadas.
- El cuerpo remoto/local de `persona_alta_integral` difiere y no hay decision explicita.
- Alguien propone `db push` antes de resolver `000067` y `14181001`.
- Se requiere repair Cloud sin decision separada.
- Falla `git diff --check`.

## Entrega posterior esperada

El siguiente PR tecnico, si se aprueba esta propuesta, debe contener unicamente:

- renombre/recuperacion de ficheros locales para representar versiones ya aplicadas en Cloud;
- documento de ejecucion o actualizacion de este plan;
- ninguna aplicacion SQL;
- ningun `db push`;
- ningun repair Cloud;
- repair local solo si se autoriza de forma separada y se reporta con comandos y salida.
