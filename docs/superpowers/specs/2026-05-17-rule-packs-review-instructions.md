# Instrucciones para extraccion de rule packs - Revision legal

Fecha: 2026-05-17
Archivo SQL: `docs/superpowers/specs/2026-05-17-rule-packs-review-extraction.sql`
Proposito: extraer los payloads de los rule packs vigentes de las materias prioritarias para que Legal pueda contrastarlos con LSC, RRM y RDL 5/2023.

## 1. Antes de ejecutar

### 1.1. Verificar el target

Desde el repo:

```bash
cd /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map
bun run db:check-target
```

Confirmar que el output muestra:

- proyecto: `governance_OS`;
- id: `hzqwefkwsxopwrmtksbg`.

No ejecutar el SQL si el target no coincide.

### 1.2. Confirmar rama y limpieza local

```bash
git status --short --branch
```

Debe mostrar `## main...origin/main` sin archivos pendientes antes de guardar resultados derivados.

## 2. Ejecutar el SQL

### Opcion A - Supabase SQL Editor

1. Abrir el SQL Editor del proyecto `governance_OS` en Supabase Dashboard.
2. Copiar el contenido integro de `2026-05-17-rule-packs-review-extraction.sql`.
3. Ejecutar.
4. Exportar el resultado como CSV o copiarlo como tabla.

### Opcion B - CLI con `psql`

Usar solo si el entorno local ya tiene una URL de base de datos disponible sin imprimir secretos:

```bash
psql "$DATABASE_URL" \
  -f docs/superpowers/specs/2026-05-17-rule-packs-review-extraction.sql \
  --csv > docs/superpowers/specs/2026-05-17-rule-packs-review-prioritarios.csv
```

No imprimir `DATABASE_URL` ni contenido de `.env`.

## 3. Si el schema no coincide

Si las columnas se llaman diferente:

1. Descomentar la seccion 4 del SQL (`schema discovery`).
2. Ejecutar solo esas queries de lectura.
3. Adaptar los nombres de columna en la query principal.

Si las claves JSON del payload difieren:

1. Ejecutar la query de inspeccion de claves JSON.
2. Mapear las claves reales contra gates del dossier:
   - convocatoria;
   - constitucion / quorum;
   - votacion / mayoria;
   - documentacion;
   - post-acuerdo / inscripcion.

## 4. Formatear el resultado para Legal

Crear `docs/superpowers/specs/2026-05-17-rule-packs-review-prioritarios.md` con una tabla por materia. Formato recomendado:

```markdown
### MODIFICACION_ESTATUTOS

rule_pack_id: xxx
rule_pack_version_id: xxx
version: 1.1.0
organo_tipo: JUNTA_GENERAL

| Gate | Valor en rule pack | Regla LSC base | Coincide |
|---|---|---|---|
| Quorum primera SA | 50% | Art. 194.1 LSC: >=50% | Pendiente Legal |
| Quorum segunda SA | 25% | Art. 194.1 LSC: >=25% | Pendiente Legal |
| Mayoria SA | 2/3 capital presente | Art. 201.2 LSC | Pendiente Legal |
| Inscripcion | true | RRM + BORME art. 290 | Pendiente Legal |
```

Si el payload JSON es demasiado complejo, incluir:

- resumen por gate;
- referencia al `rule_pack_version_id`;
- extracto JSON minimo solo de las claves necesarias.

## 5. Materias de prioridad absoluta

| Materia | Gates criticos | Tipo social | Motivo |
|---|---|---|---|
| `MODIFICACION_ESTATUTOS` | Quorum, mayoria, documentacion | SA y SL | Inscribible; arts. 194, 201, 285-290 LSC |
| `AUMENTO_CAPITAL` | Quorum, mayoria | SA y SL | Inscribible; art. 194 LSC |
| `REDUCCION_CAPITAL` | Quorum, mayoria, oposicion acreedores | SA y SL | Inscribible; arts. 334-337 LSC |
| `FUSION_ESCISION` / `FUSION` / `ESCISION` | Quorum, mayoria, documentacion | SA y SL | Inscribible; RDL 5/2023 |
| `NOMBRAMIENTO_CONSEJERO` | Mayoria, documentacion, subtipo | SA y SL | Inscribible; cooptacion solo SA |
| `DELEGACION_FACULTADES` | Mayoria especial de dos tercios | SA y SL | Inscribible; art. 249.2 LSC |
| `NOMBRAMIENTO_AUDITOR` | Duracion 3-9 anos | SA y SL | Inscribible; art. 264.1 LSC |

## 6. Que no hacer

- No modificar ningun dato en Cloud.
- No imprimir secretos ni contenido de `.env`.
- No ejecutar `INSERT`, `UPDATE`, `DELETE` ni DDL.
- No abrir worktrees ni ramas paralelas.
- No tratar este SQL como migracion.

## 7. Resultado esperado

El resultado final para Legal debe ser:

- el dossier principal;
- esta nota de instrucciones;
- la nota de envio;
- el SQL read-only;
- opcionalmente, `2026-05-17-rule-packs-review-prioritarios.md` si ingenieria ya ha extraido y formateado la tabla.
