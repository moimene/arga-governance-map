# Secretaria Societaria - decisiones de consolidacion semantica

**Fecha:** 2026-05-14
**Tenant:** `00000000-0000-0000-0000-000000000001`
**Proyecto Supabase:** `governance_OS` / `hzqwefkwsxopwrmtksbg`
**Decision operativa:** no aplicar consolidaciones sin aprobacion explicita por par.

## Resumen ejecutivo

La herramienta segura de inventario (`scripts/consolidate-duplicate-persons.ts --dry-run`) no detecta ningun par Type A aplicable automaticamente. Detecta un unico par Type B heuristico, `Cartera ARGA S.L.U.` frente a `Cartera ARGA`, pero el preflight falla porque ambas filas de persona estan vinculadas a entidades activas distintas. Por tanto, la deuda critica queda formalizada como decision de data-owner/legal, no como tarea automatizable.

No se ha ejecutado `--apply`. No se han modificado `persons`, `entities`, WORM, `audit_log`, `no_session_*`, `censo_snapshot` ni `capital_movements`.

## Evidencia de inventario

Comando ejecutado en modo lectura:

```bash
set -a
source docs/superpowers/plans/.env
set +a
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_SECRET" SUPABASE_URL="$URL" \
  bun run scripts/consolidate-duplicate-persons.ts --dry-run
```

Resultado:

```text
Detected 1 candidate duplicate pair(s):

[Type B (heuristic - requires --pair to apply)]
Canonical: Cartera ARGA S.L.U. [tax=B-99999902] id=b50fad18-ca71-41bb-a940-45d43f4fcdb7
Duplicate: Cartera ARGA [tax=PENDIENTE-517522ab-60bf-4c41-9376-09c2948ca056] id=17aa1e03-769b-49ad-9296-d41a8f3cbc51
Preflight: FAIL
entities.person_id ambiguity: duplicate has entities [Cartera ARGA, S.A.], canonical has [Cartera ARGA S.L.U.]

Summary:
0 pair(s) ready to consolidate
0 Type A
1 pair(s) blocked by preflight conflicts
```

Inventario adicional Cloud:

- Hay 27 PJs con identificacion pendiente o nula: 24 `PENDIENTE-*` y 3 `NULL`.
- La entidad canonica ARGA Seguros S.A. es `6d7ed736-f263-4531-a59d-c6ca0cd41602` y apunta a la persona PJ `15fab4ff-2a1f-59c1-b2fd-e849cb4cf936`.
- La persona `ARGA Seguros, S.A.` con `tax_id=A-99999903` no tiene referencias en las tablas criticas revisadas; no la detecta el script porque no comparte `tax_id` ni entra en Type B seguro.
- Existen dos PF "Antonio Rios" semanticamente parecidas, pero con identificadores distintos y referencias vivas. No son Type A ni Type B seguro.

## Fichas por par

### P1 - Cartera ARGA S.L.U. vs Cartera ARGA

| Campo | Canonical propuesto por script | Duplicate propuesto por script |
|---|---|---|
| `person_id` | `b50fad18-ca71-41bb-a940-45d43f4fcdb7` | `17aa1e03-769b-49ad-9296-d41a8f3cbc51` |
| Nombre | Cartera ARGA S.L.U. | Cartera ARGA |
| `tax_id` | `B-99999902` | `PENDIENTE-517522ab-60bf-4c41-9376-09c2948ca056` |
| Tipo | PJ | PJ |
| Entidad vinculada | `00000000-0000-0000-0000-000000000020`, Cartera ARGA S.L.U., SLU, Active | `517522ab-60bf-4c41-9376-09c2948ca056`, Cartera ARGA, S.A., SA, Active |
| Referencias criticas | `entities`, `mandates`, `meeting_attendees`, `condiciones_persona`, `capital_holdings`, `no_session_notificaciones`, `representaciones` | `entities` |
| Preflight | FAIL | FAIL |
| Decision | Bloqueado | Bloqueado |

Motivo: no es una consolidacion de dos filas que representen claramente el mismo sujeto. El sistema ve dos entidades activas, con formas sociales distintas (`SLU` y `SA`). La decision no puede tomarse por nombre corto.

Opciones de decision:

1. **Son la misma sociedad:** aprobar archivo/cierre de una de las entidades activas, definir entidad superviviente y luego autorizar consolidacion por par.
2. **Son sociedades distintas:** corregir el `tax_id` pendiente de `Cartera ARGA, S.A.` y mantener dos personas PJ distintas.
3. **No concluyente:** mantener bloqueo y excluir de consolidaciones automaticas.

Siguiente accion segura: data-owner/legal debe elegir una opcion y dejar evidencia de aprobacion antes de cualquier `--apply --pair`.

### P2 - ARGA Seguros S.A. vs ARGA Seguros, S.A.

| Campo | Canonica Cloud | Sospechosa |
|---|---|---|
| `person_id` | `15fab4ff-2a1f-59c1-b2fd-e849cb4cf936` | `2faafc8d-e4ad-41e6-a51b-b1e73ebb0f3c` |
| Nombre | ARGA Seguros S.A. | ARGA Seguros, S.A. |
| `tax_id` | `A-00001001` | `A-99999903` |
| Entidad vinculada | Entidad canonica ARGA `6d7ed736-f263-4531-a59d-c6ca0cd41602` | Sin entidad vinculada en el probe critico |
| Referencias criticas revisadas | `entities`, `meeting_attendees`, `capital_holdings` | Sin referencias en `entities`, `condiciones_persona`, `mandates`, `authority_evidence`, `capital_holdings`, `meeting_attendees`, `representaciones`, `no_session_notificaciones`, `capital_movements` |
| Detectada por script | No | No |
| Decision | No consolidar sin validacion de `tax_id` | No consolidar sin validacion de `tax_id` |

Motivo: el parecido de nombre no basta. Los `tax_id` son distintos y la fila sospechosa podria ser fixture o sociedad distinta. Si se confirma que es fixture huerfano, la accion correcta no es `fn_consolidate_person` sino una politica de saneamiento de datos demo con aprobacion explicita.

### P3 - Antonio Rios vs D. Antonio Rios Valverde

| Campo | Persona 1 | Persona 2 |
|---|---|---|
| `person_id` | `00000000-0000-0000-0000-000000000102` | `12ab13c3-0a0e-4ab6-a17a-902a3eaeddf8` |
| Nombre | Antonio Rios | D. Antonio Rios Valverde |
| `tax_id` | `12345679B` | `NIF-DEMO-01-89B557` |
| Tipo | PF | PF |
| Referencias criticas | `authority_evidence`, `capital_holdings`, `no_session_notificaciones` | `mandates`, `meeting_attendees`, `authority_evidence`, `condiciones_persona` |
| Detectada por script | No | No |
| Decision | No consolidar | No consolidar |

Motivo: hay referencias vivas de autoridad, capital, reuniones y cargos. Sin identificador fiscal comun y sin aprobacion legal, cualquier merge seria inferencial.

## Runbook de consolidacion futura

1. Ejecutar `bun run db:check-target` y verificar `governance_OS / hzqwefkwsxopwrmtksbg`.
2. Ejecutar siempre `scripts/consolidate-duplicate-persons.ts --dry-run`.
3. Preparar ficha por par con `person_id`, `tax_id`, entidades, referencias y preflight.
4. Obtener aprobacion explicita por par. La aprobacion debe indicar canonical, duplicate y tratamiento de entidad si existe `entities.person_id` en ambos lados.
5. Aplicar solo el par aprobado:

```bash
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_SECRET" SUPABASE_URL="$URL" \
  bun run scripts/consolidate-duplicate-persons.ts \
  --apply --pair=<canonical_person_id>:<duplicate_person_id>
```

6. Repetir dry-run y probes de referencias.
7. Documentar resultado en `docs/superpowers/plans/`.

## Estado de cierre

**Riesgo cerrado funcionalmente:** no quedan consolidaciones automaticas seguras pendientes.
**Decision residual formal:** Cartera ARGA y cualquier otro par semantico requieren aprobacion legal/data-owner.
**Accion prohibida:** no ejecutar `--apply --auto-detect` ni `--apply --pair` sin ficha aprobada.
