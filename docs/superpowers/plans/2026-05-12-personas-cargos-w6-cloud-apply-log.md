# Wave 6 — Cloud Apply Log (personas-cargos refactor sprint)

**Fecha de ejecución:** 2026-05-12
**Coordinador:** Claude orquestando Ruflo swarm + MCP Supabase
**Aprobaciones:** equipo legal Garrigues (3 decisiones validadas: B88888888 opción B, orden inverso riesgo, post-probes legales)
**Cloud project:** `hzqwefkwsxopwrmtksbg` (governance_OS)
**Tenant:** `00000000-0000-0000-0000-000000000001` (ARGA demo)

---

## Resumen ejecutivo

Wave 6 aplicó 3 migraciones de schema + 1 consolidación de datos + 1 UPDATE correctivo a Cloud demo, en orden inverso de riesgo (validado por equipo legal). Resultado: **todos los post-probes pasan**, demo Garrigues (semana 19-23 mayo) BD-ready.

| Métrica | Pre-W6 | Post-W6 |
|---|---|---|
| Duplicados tax_id reales | 1 (B88888888 × 2) | 0 |
| Cargos certificantes VIGENTES sin authority_evidence | 11 (10 PRESIDENTE + 1 SECRETARIO) | 0 |
| `usePresidenteVigente` ARGA Seguros CdA `has_rm` | false | true (RM-DEMO-ARGA-CDA-2026) |
| VICESECRETARIO en CHECK constraint | NO | SI |
| UNIQUE constraint en persons.tax_id | NO | SI (parcial, excluye placeholders) |
| Trigger fn_sync_authority_evidence propaga RM | NO | SI |
| Trigger incluye VICESECRETARIO en certificantes | NO | SI |
| Trigger incluye CONSEJERO_COORDINADOR | SI (bug heredado) | NO (L15-L16 RRM 109) |

---

## Pre-flight probes (read-only)

### Probe 1 — Duplicados tax_id reales

```sql
SELECT tax_id, COUNT(*) AS dupes, ARRAY_AGG(full_name)
FROM persons WHERE tenant_id = '...' AND tax_id NOT IN excluded_prefixes
GROUP BY tax_id HAVING COUNT(*) > 1;
```

Resultado:
```
tax_id        | dupes | names
B88888888     |   2   | [PRUEBA 1 (2026-05-10), SEGUROS TEST A, SL (2026-05-12)]
```

**Decisión legal (Garrigues 2026-05-12):** opción B — renombrar PRUEBA 1 a `E2E-B88888888-PRUEBA-1` para liberar el conflict sin destruir datos test.

### Probe 2 — Cargos certificantes sin AE

| Cargo | Total VIGENTES | Con AE | Sin AE |
|---|---|---|---|
| PRESIDENTE | 20 | 10 | **10** |
| SECRETARIO | 20 | 19 | **1** |
| ADMIN_UNICO | 1 | 1 | 0 |
| ADMIN_SOLIDARIO | 2 | 2 | 0 |
| ADMIN_MANCOMUNADO | 4 | 4 | 0 |

**Diagnóstico:** 11 huecos heredados de inserciones pre-trigger o sin propagar.

### Probe 3 (legal post-probe b) — ARGA Seguros CdA certificantes

| Cargo | Persona | has_ae | has_rm |
|---|---|---|---|
| PRESIDENTE Antonio Ríos | Consejo de Administración | **false** | n/a |
| SECRETARIO Lucía Paredes | Consejo de Administración | **false** | n/a |
| (otros PRESIDENTE en comisiones × 9) | varias | varios estados | varios |

**Hallazgo crítico:** los 2 cargos clave del CdA principal de ARGA Seguros no tenían AE + `inscripcion_rm_referencia` era NULL. Sin fix, demo bloquearía al primer certificado del CdA.

---

## Ejecución de Wave 6

Orden inverso de riesgo (validado legal): 000065 → 000063 → 000064 → UPDATE.

### Step 2 — Resolver B88888888 (decisión legal opción B)

```sql
UPDATE persons
SET tax_id = 'E2E-B88888888-PRUEBA-1',
    full_name = '[ARCHIVED-LEGAL] PRUEBA 1'
WHERE id = 'e82cf750-214d-4a90-8acb-49344c390ce9';
```

Resultado: 1 row updated. SEGUROS TEST A, SL (`38f1a494-...`) ahora único con `tax_id=B88888888`.

### Step 4 — apply_migration `000065` (VICESECRETARIO CHECK)

Vía MCP `apply_migration` con name `condiciones_persona_vicesecretario`.

- `chk_condiciones_persona_tipo_condicion` ampliado para incluir VICESECRETARIO
- `chk_condicion_body_coherente`: VICESECRETARIO en grupo `body_id IS NOT NULL`

Resultado: success. Riesgo nulo: superset del CHECK anterior, no rompe rows existentes.

### Step 5 — apply_migration `000063` (UNIQUE tax_id)

Vía MCP `apply_migration` con name `persons_tax_id_unique`.

```sql
CREATE UNIQUE INDEX ux_persons_tax_id_real
  ON persons (tenant_id, tax_id)
  WHERE tax_id NOT LIKE 'PENDIENTE-%' AND tax_id NOT LIKE 'E2E-%'
    AND tax_id NOT LIKE 'FREE-FLOAT-%' AND tax_id NOT LIKE 'ARCHIVED-%';
```

Resultado: success. Pre-cond cumplida en Step 2.

### Step 6 — apply_migration `000064` (trigger + backfill)

Vía MCP `apply_migration` con name `authority_evidence_trigger_rm_fields`.

- `fn_sync_authority_evidence` reescrito con `SET search_path TO 'public', 'extensions'` preservado
- Array `v_cargos_certificantes`: incluye VICESECRETARIO, excluye CONSEJERO_COORDINADOR
- Backfill A: UPDATEs RM en AEs vigentes con datos de condiciones_persona
- Backfill B: INSERT AEs faltantes para cargos certificantes VIGENTES

Resultado: success. Backfill cerró los 11 huecos heredados (10 PRESIDENTE + 1 SECRETARIO).

### Step 3.5 — UPDATE RM en CdA ARGA Seguros (validado legal)

```sql
UPDATE condiciones_persona
SET inscripcion_rm_referencia = 'RM-DEMO-ARGA-CDA-2026',
    inscripcion_rm_fecha = '2025-01-01'
WHERE entity_id = '6d7ed736-...' AND body_id = 'fe05ddd9-...'
  AND tipo_condicion IN ('PRESIDENTE', 'SECRETARIO')
  AND estado = 'VIGENTE' AND inscripcion_rm_referencia IS NULL;
```

Resultado: 2 rows updated. Trigger UPDATE branch propagó automáticamente a `authority_evidence`.

---

## Post-probes (criterio §8 spec)

### Probe 1 — Duplicados restantes

```sql
SELECT tax_id, COUNT(*) FROM persons WHERE tenant_id='...' AND tax_id NOT IN excluded GROUP BY tax_id HAVING COUNT(*) > 1;
```

Resultado: **0 filas** ✅

### Probe 2 — Cargos certificantes sin AE post-backfill

```sql
SELECT cp.tipo_condicion, COUNT(*) FROM condiciones_persona cp WHERE estado='VIGENTE'
  AND tipo_condicion IN (certificantes) AND NOT EXISTS (AE matching) GROUP BY cp.tipo_condicion;
```

Resultado: **0 filas** ✅

### Probe 3 (legal post-probe a + b) — ARGA Seguros CdA

| Cargo | Persona | has_ae | has_rm | RM ref |
|---|---|---|---|---|
| PRESIDENTE | D. Antonio Ríos Valverde | **true** | **true** | RM-DEMO-ARGA-CDA-2026 |
| SECRETARIO | Dña. Lucía Paredes Vega | **true** | **true** | RM-DEMO-ARGA-CDA-2026 |

✅ `usePresidenteVigente('6d7ed736-...')` resolverá con `has_rm=true`.
✅ `EmitirCertificacionButton` con doble verificación RM (W5 D5.5) no bloqueará en CdA.

ARGA Seguros **no tiene VICEPRESIDENTE ni VICESECRETARIO** (consistente con LSC — cargos facultativos según estatutos). Pestaña Autoridad mostrará 2 cargos certificantes, no 4. Garrigues podrá preguntar por suplencia y la respuesta correcta es "no hay vicecargo designado actualmente — vacancia de suplencia" (legal-confirmed).

### Probe 4 — CHECK constraints definitivos

`chk_condiciones_persona_tipo_condicion`:
```
CHECK (tipo_condicion = ANY (ARRAY[
  'SOCIO', 'ADMIN_UNICO', 'ADMIN_SOLIDARIO', 'ADMIN_MANCOMUNADO', 'ADMIN_PJ',
  'CONSEJERO', 'PRESIDENTE', 'SECRETARIO', 'VICEPRESIDENTE', 'VICESECRETARIO',
  'CONSEJERO_COORDINADOR'
]))
```

`chk_condicion_body_coherente`:
```
CHECK (
  (tipo_condicion IN ('SOCIO','ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ') AND body_id IS NULL)
  OR
  (tipo_condicion IN ('CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','VICESECRETARIO','CONSEJERO_COORDINADOR') AND body_id IS NOT NULL)
)
```

✅ VICESECRETARIO incluido en ambos. ADMIN_PJ en grupo NULL (no es órgano colegiado).

---

## Trazabilidad legal-operativa para Garrigues

Si Garrigues pregunta durante demo:

| Pregunta esperada | Respuesta documentada |
|---|---|
| "¿Por qué Antonio Ríos tiene RM ref `RM-DEMO-ARGA-CDA-2026`?" | Dato demo coherente con encargo: "evidencia demo/operativa, no constituye evidencia final productiva" (encargo Comité Legal 2026-05-02). Fecha 2025-01-01 refleja constitución demo CdA. |
| "¿Por qué hay 2 cargos certificantes y no 4?" | LSC art. 210 + 529: VICEPRESIDENTE y VICESECRETARIO son cargos facultativos según estatutos. ARGA Seguros no los designa actualmente — vacancia de suplencia legal. |
| "¿Por qué dos sociedades pueden tener mismo CIF?" | YA NO PUEDEN tras este sprint (W6 step 5: UNIQUE constraint). Resolución del único caso histórico ("PRUEBA 1" + "SEGUROS TEST A, SL" compartiendo B88888888) vía renombrado a placeholder E2E (test data). |
| "¿Y si quieren añadir VICESECRETARIO?" | Cargo aceptado en BD (W6 step 4: CHECK ampliado). Designable vía `/secretaria/cargos/nuevo` (D5.2 stepper actualizado). Trigger sync incluye VICESECRETARIO (W6 step 6). |
| "¿Y si un cargo es Consejero Coordinador?" | Cargo sigue siendo válido en `condiciones_persona`, pero NO certifica (RRM art. 109, decisión legal L15-L16). Excluido de `authority_evidence` y del array certificantes del trigger (W1 fix #6 + W6 step 6). |

---

## Estado branch + próximos pasos

- **Branch:** `feature/personas-cargos-refactor` (40+ commits ahead de main)
- **Code-level:** Wave 5 PASS. Wave 6 modifica solo Cloud, no añade commits.
- **Próximos:**
  - Wave 7: este log + run del script `demo-readiness-personas-cargos.ts` automatizado + E2E `20-personas-cargos-flow.spec.ts`
  - Wave 8: smoke manual + PR + merge tras CI green

---

## Verificación última conocida (2026-05-12 post-W6)

| Check | Estado |
|---|---|
| `bun run typecheck` | ✅ 0 errors (modulo demo-backup/reducer.ts pre-existente untracked) |
| `bun run lint` | ✅ 0 errors, 3 warnings pre-existentes |
| `bun run build` | ✅ 5.32s |
| Cloud `hzqwefkwsxopwrmtksbg` post-W6 probes | ✅ 4/4 PASS |

**Wave 6 cierra el sprint inmediato a nivel BD + código. Demo readiness GO.**
