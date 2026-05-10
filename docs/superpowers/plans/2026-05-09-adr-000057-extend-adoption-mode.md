# ADR — Migración 000057: extend `agreements_adoption_mode_check`

**Estado:** Aplicada en Cloud (governance_OS, ref `hzqwefkwsxopwrmtksbg`).
**Fecha aplicación:** 2026-05-09 (commit `d71f504`).
**Migración SQL:** `supabase/migrations/20260509_000057_extend_agreements_adoption_mode_solidario_co_aprobacion.sql`.
**Categoría:** Migración de producto (NO side-effect de tests). Cierra deuda
de paridad entre el motor V2 (`AdoptionMode` TS enum) y el schema de
`agreements`.

---

## Qué rompía antes

La tabla `agreements` tenía un CHECK constraint:

```sql
agreements_adoption_mode_check
CHECK (adoption_mode IN ('MEETING','UNIVERSAL','NO_SESSION',
                         'UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN'))
```

Pero el motor V2 (`src/lib/rules-engine/types.ts`) define el enum
`AdoptionMode` con **7 valores**:

```ts
type AdoptionMode =
  | 'MEETING'
  | 'UNIVERSAL'
  | 'NO_SESSION'
  | 'UNIPERSONAL_SOCIO'
  | 'UNIPERSONAL_ADMIN'
  | 'SOLIDARIO'        // ← faltaba en CHECK
  | 'CO_APROBACION';   // ← faltaba en CHECK
```

Los steppers `CoAprobacionStepper.tsx` y `SolidarioStepper.tsx` (que existen
en producción desde Sprint G, abril 2026, commit `9d7d7d7`) emiten
INSERT directo en `agreements` con esos modos. Los tests cloud-real de Phase B1 v3
(commit `5d8f7a9`) detectaron el gap: el INSERT fallaba con error
`23514 — new row for relation "agreements" violates check constraint
"agreements_adoption_mode_check"`.

Resultado pre-migración: cualquier flujo de adopción `SOLIDARIO` o
`CO_APROBACION` desde la UI **fallaba silenciosamente con HTTP 400**, dejando
al usuario sin acuerdo registrado y sin feedback claro (la mutación caía a
`onError` con un mensaje técnico de Supabase).

## Por qué SOLIDARIO y CO_APROBACION son válidos

Ambos son modos de adopción legalmente reconocidos en la **Ley de Sociedades
de Capital española** y en jurisdicciones equivalentes (BR/MX/PT):

| Modo | Referencia legal ES | Características |
|---|---|---|
| `SOLIDARIO` | art. 233 LSC + estatutos | Un único administrador solidario adopta el acuerdo; vinculante para la sociedad sin necesidad de cofirma. Estatutos pueden restringir materias estructurales. |
| `CO_APROBACION` | art. 248 LSC + estatutos / art. 245 LSC para mancomunados | k de n administradores (típicamente mancomunados parciales) firman el acuerdo. Configurable: k=2 de n=3, ventana temporal, materias permitidas. |

Implementación motor V2:
- `src/lib/rules-engine/votacion-engine.ts` — funciones `evaluarSolidario()`
  + `evaluarCoAprobacion()` que validan condiciones formales (admin
  vigente, k≥1, k≤n, materia compatible).
- `src/pages/secretaria/SolidarioStepper.tsx` (4 pasos UI)
- `src/pages/secretaria/CoAprobacionStepper.tsx` (5 pasos UI)
- Cobertura UI driving: `e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts`
  (tests B6.1 + B6.2, post-migración 000057).

## Cambio aplicado

```sql
ALTER TABLE agreements DROP CONSTRAINT IF EXISTS agreements_adoption_mode_check;
ALTER TABLE agreements ADD CONSTRAINT agreements_adoption_mode_check
  CHECK (adoption_mode IN (
    'MEETING','UNIVERSAL','NO_SESSION',
    'UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN',
    'SOLIDARIO','CO_APROBACION'   -- ← añadidos
  ));
```

Sin cambio de columna ni de datos. Sin reescritura de filas existentes.
Operación O(1) sobre el catálogo. No requiere downtime.

## Cobertura y tests

Post-migración, los tests cloud-real reactivados:
- `e2e/38-secretaria-phase-b1v3-adoption-modes.spec.ts` — 7/7 modos pasan
  cloud-real con fixtures sintéticas (commit `d71f504`)
- `e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts` — UI
  driving destructive de los 3 modos (CO+SOL+UNI) verifica que `agreements`
  acepta los inserts (commit `0ac8eea`)

## Rollback plan

**Pre-condición:** No hay agreements con `adoption_mode IN ('SOLIDARIO',
'CO_APROBACION')` en producción operativa (solo demos sintéticos limpiados
por afterAll).

```sql
-- 1. Verificar que no hay datos con los modos nuevos
SELECT adoption_mode, COUNT(*)
FROM agreements
WHERE adoption_mode IN ('SOLIDARIO', 'CO_APROBACION')
GROUP BY adoption_mode;
-- esperado: 0 filas

-- 2. Si hay, decidir migración (lossy):
--    - SOLIDARIO       → NO_SESSION (cierra el modelo de adopción solidaria
--                        como genérica sin sesión, pierde ejecución_mode.adminActuante)
--    - CO_APROBACION   → NO_SESSION (pierde k/n + firmas)
--    Backup recomendado:
-- COPY (SELECT * FROM agreements WHERE adoption_mode IN ('SOLIDARIO','CO_APROBACION'))
--   TO '/tmp/agreements_solidario_co_aprobacion_backup.csv' CSV HEADER;

-- 3. Aplicar el rollback
ALTER TABLE agreements DROP CONSTRAINT agreements_adoption_mode_check;
ALTER TABLE agreements ADD CONSTRAINT agreements_adoption_mode_check
  CHECK (adoption_mode IN (
    'MEETING','UNIVERSAL','NO_SESSION',
    'UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN'
  ));

-- 4. UI: eliminar rutas /secretaria/acuerdos-sin-sesion/co-aprobacion
--    y /solidario, deshabilitar botones CTA en AcuerdosSinSesion.tsx
-- 5. Tests: revertir e2e/42 + e2e/38 (mode skips)
```

Este rollback **no se anticipa necesario** — los modos son legalmente
sólidos y el motor V2 los soporta. El plan existe por completitud DRP.

## Decisiones documentadas

1. **Aplicación atomic en Cloud vía MCP**: el commit `d71f504` aplicó la
   migración 000057 en governance_OS antes de hacer push porque la guarda
   `db:check-target` pasa contra Cloud — sin migración aplicada, los tests
   B1 v3 + B6 fallarían con 23514. Se documenta aquí como "migración de
   producto" (no side-effect) porque cierra una incoherencia real entre
   motor V2 y schema, no fue añadida solo para destrabar un test.

2. **Coverage en tests destructivos opt-in (Phase B)**: post-migración, la
   ejecución `SECRETARIA_E2E_PHASE_B1=1` cubre los 7 modos cloud-real y
   los 3 modos vía UI driving. Sin migración, e2e/38 + e2e/42 quedan
   bloqueados.

3. **Sin fallback cliente**: la mutación `useCreateNoSessionResolution` y
   los handlers `handleRegistrar` de Co/Solidario steppers NO tienen
   fallback al insert simple — confían en el CHECK ampliado. Este es un
   contract assumption documentado aquí.

## Files relacionados

- `supabase/migrations/20260509_000057_extend_agreements_adoption_mode_solidario_co_aprobacion.sql`
- `src/lib/rules-engine/types.ts` (definición `AdoptionMode`)
- `src/lib/rules-engine/votacion-engine.ts` (`evaluarSolidario`, `evaluarCoAprobacion`)
- `src/pages/secretaria/SolidarioStepper.tsx`
- `src/pages/secretaria/CoAprobacionStepper.tsx`
- `e2e/38-secretaria-phase-b1v3-adoption-modes.spec.ts`
- `e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts`
- Commit `d71f504` (aplicación)

## Ownership

- Schema: SECRETARIA carril (Motor V2 LSC).
- Validation: hace falta tests motor V2 (cubierto en
  `src/lib/rules-engine/__tests__/votacion-engine.test.ts` SO/CO suite).
- DRP: rollback sobre 000057 requiere backup previo + downgrade UI.
