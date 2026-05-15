# Secretaria 360 - Analisis ledger D6 000067

Fecha: 2026-05-15  
Rama: `codex/secretaria360-d6-000067-ledger-analysis`  
Fichero analizado: `supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql`  
Modo: read-only. No se ha ejecutado `repair`, `db push`, SQL Cloud, migracion, renombre ni cambio funcional.

## Restricciones respetadas

- No `supabase migration repair`.
- No `supabase db push`.
- No SQL Cloud de escritura.
- No aplicar migraciones.
- No renombrar.
- No tocar `20260514181001_secretaria_production_sprint_closeout`.
- No tocar `persona_alta_integral`.
- No tocar agenda/minutas, normativa ni doc-gen.

## Estado ledger

### Local

El fichero existe localmente:

```text
supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql
```

Metadatos locales:

- lineas: `573`
- bytes: `20463`
- md5 local: `eeeb6211db146620b8929fd0c7f7c799`

La version efectiva para Supabase CLI aparece como `20260514`, porque el nombre usa el patron legacy `20260514_000067...`.

### Remote

`supabase migration list` muestra:

```text
20260514174503 | 20260514174503
20260514181001 |
20260514       |
```

Interpretacion:

- `20260514174503` ya esta alineada por el PR #14 (`no_session_source_of_truth_close`).
- `20260514` sigue local-only y ahora corresponde a `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`.
- No hay version remota ni nombre remoto equivalente para `fn_crear_sociedad_legal_y_capital`.

Consulta read-only a `supabase_migrations.schema_migrations` por versiones/nombres relacionados solo devuelve `20260514174503 no_session_source_of_truth_close`. No existe registro remoto para `20260514_000067` ni para un nombre `crear_sociedad_legal_y_capital`.

## Que define la migracion

La migracion D6 `000067` hace tres cosas principales:

1. Extiende `entities` con campos legales y operativos de alta de sociedad:
   - fechas: `constitution_date`, `registration_date`;
   - datos registrales: `registry_location`, `registry_volume`, `registry_folio`, `registry_sheet`, `registry_inscription`;
   - identificadores/actividad: `lei_code`, `cnae_primary`, `cnae_secondary`;
   - datos societarios/descriptivos: `corporate_purpose`, `duration`, `fiscal_year_close`;
   - domicilio/contacto: `address`, `address_street`, `address_number`, `address_floor`, `postal_code`, `city`, `province`, `country`, `website`, `corporate_email`;
   - clasificacion interna: `regulated_sector`, `group_role`;
   - soporte documental: `support_docs_metadata`;
   - estado de onboarding: `onboarding_status`.

2. Crea/ajusta constraint:
   - `chk_entities_onboarding_status` con valores `OPERATIVA`, `INCOMPLETA_CARGOS`, `INCOMPLETA_DATOS`, `BORRADOR`.

3. Crea la RPC transaccional D6:
   - `fn_crear_sociedad_legal_y_capital(uuid, jsonb)`.

La RPC:

- valida acceso tenant y rol `SECRETARIO`/`ADMIN_TENANT`;
- valida payload root requerido (`sociedad_pj`, `entity`, `capital_profile`, `share_classes`, `socios`, `capital_holdings`, `governing_bodies`);
- crea o reutiliza `persons` para la sociedad PJ y socios;
- inserta `entities`;
- inserta `entity_capital_profile`;
- inserta `share_classes`;
- inserta `capital_holdings`;
- inserta `governing_bodies`;
- opcionalmente inserta `entity_settings`;
- opcionalmente inserta `rule_param_overrides`;
- devuelve ids creados (`entity_id`, `person_id`, `body_ids`, `share_class_ids`, `holding_ids`, `settings_skipped`);
- concede `GRANT EXECUTE` a `authenticated`;
- documenta la funcion con `COMMENT ON FUNCTION`.

## Estado Cloud de los objetos

Consulta read-only en Cloud:

| Objeto | Existe en Cloud |
|---|---:|
| `fn_crear_sociedad_legal_y_capital(uuid,jsonb)` | No |
| `entities.constitution_date` | No |
| `entities.registration_date` | No |
| `entities.registry_location` | No |
| `entities.registry_volume` | No |
| `entities.registry_folio` | No |
| `entities.registry_sheet` | No |
| `entities.registry_inscription` | No |
| `entities.lei_code` | No |
| `entities.cnae_primary` | No |
| `entities.cnae_secondary` | No |
| `entities.corporate_purpose` | No |
| `entities.duration` | No |
| `entities.fiscal_year_close` | No |
| `entities.address` | No |
| `entities.address_street` | No |
| `entities.address_number` | No |
| `entities.address_floor` | No |
| `entities.postal_code` | No |
| `entities.city` | No |
| `entities.province` | No |
| `entities.country` | No |
| `entities.website` | No |
| `entities.corporate_email` | No |
| `entities.regulated_sector` | No |
| `entities.group_role` | No |
| `entities.support_docs_metadata` | No |
| `entities.onboarding_status` | No |
| `chk_entities_onboarding_status` | No |
| `entity_capital_profile` | Si |
| `share_classes` | Si |
| `capital_holdings` | Si |
| `entity_settings_catalog` | Si |
| `entity_settings` | Si |
| `rule_param_overrides` | Si |

Conclusion: Cloud tiene varias tablas base que la RPC usa, pero no tiene la ampliacion de `entities`, el constraint ni la RPC principal de esta migracion.

## Clasificacion

Clasificacion: **pendiente real local-only**.

No parece:

- **ya aplicado fuera de ledger**: los objetos principales no existen en Cloud;
- **obsoleto demostrado**: el flujo D6 todavia depende conceptualmente de alta legal/capital;
- **parcial aplicado**: solo existen tablas base previas, no los cambios propios de la migracion.

Matiz: el filename `20260514_000067...` es problematico porque Supabase CLI lo presenta como version `20260514`, una version truncada y no granular. Eso debe corregirse antes de cualquier aplicacion futura.

## Recomendacion

Recomendacion: **no aplicar ahora y no repair**.

Separar en un PR tecnico/funcional especifico:

1. Crear una migracion nueva con timestamp valido mediante CLI:

   ```bash
   supabase migration new secretaria_d6_crear_sociedad_legal_y_capital
   ```

2. Copiar/adaptar el contenido de `20260514_000067_fn_crear_sociedad_legal_y_capital.sql` al nuevo fichero generado.

3. Retirar o mover el fichero legacy `20260514_000067...` fuera de `supabase/migrations` solo con decision explicita. Opciones:
   - `docs/superpowers/proposed-migrations/` si se quiere conservar como propuesta historica;
   - eliminarlo si el nuevo fichero lo sustituye completamente y el contenido queda trazado en Git.

4. Antes de aplicar:
   - revisar compatibilidad con schema Cloud actual;
   - revisar `SECURITY DEFINER` en schema `public`;
   - revisar grants/RLS/API exposure;
   - ejecutar tests focalizados de alta sociedad D6;
   - verificar si `entities` admite todas las columnas en UI/hook actual.

5. Aplicar solo tras autorizacion separada.

No se recomienda:

- `supabase migration repair`: no hay version remota que reparar y Cloud no tiene los objetos;
- renombrar directamente `20260514_000067...` a un timestamp inventado: para migraciones nuevas debe usarse `supabase migration new` y revisar contenido;
- `db push`: esta migracion local-only y `20260514181001` siguen bloqueando un push seguro.

## Riesgos

| Riesgo | Severidad | Comentario |
|---|---:|---|
| Aplicar via `db push` con version truncada `20260514` | Alta | Puede contaminar ledger remoto con version no granular y chocar con historico. |
| Ejecutar `repair` | Alta | No hay objetos en Cloud; repair ocultaria una migracion no aplicada. |
| Aplicar sin revisar `SECURITY DEFINER` | Alta | La RPC esta en `public`, con `GRANT EXECUTE authenticated`; requiere revision de seguridad. |
| Aplicar sin revisar columnas `entities` | Media/Alta | Añade muchas columnas a tabla central y `onboarding_status NOT NULL` con default. |
| Mantener el fichero en `supabase/migrations` sin resolver | Media | Seguiria apareciendo como local-only `20260514` en `supabase migration list`. |

## Proximo paso sugerido

Si se aprueba esta clasificacion, abrir un carril separado:

```text
codex/secretaria360-d6-000067-proposed-migration
```

Objetivo:

- crear una migracion nueva con timestamp valido usando `supabase migration new`;
- portar/revisar el contenido D6;
- mover/retirar el fichero legacy;
- no aplicar Cloud hasta autorizacion explicita.

Comando sensible que deberia pedirse antes de ejecutar:

```bash
supabase migration new secretaria_d6_crear_sociedad_legal_y_capital
```

Este comando solo crea un fichero local; no aplica Cloud. Aun asi, debe autorizarse porque altera `supabase/migrations`.
