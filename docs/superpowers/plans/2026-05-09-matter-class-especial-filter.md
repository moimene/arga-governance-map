# Plan — Fix `matter_class='ESPECIAL'` HTTP 400 silent failure

**Estado:** Aplicado.
**Fecha:** 2026-05-09.
**Origen:** Hallazgo adversarial durante carril B6.3 (e2e/42 UI driving
DecisionUnipersonalStepper). El INSERT en `agreements` falla con HTTP 400
silencioso si el usuario selecciona una materia con `matter_class='ESPECIAL'`
(PACTO_PARASOCIAL, EXCLUSION_SOCIO, SEPARACION_SOCIO) en steppers que
persisten agreements directamente.

---

## Problema

Tabla `agreements` tiene CHECK:

```sql
CHECK (matter_class IN ('ORDINARIA', 'ESTATUTARIA', 'ESTRUCTURAL'))
```

Catálogo `materia_catalog` tiene 3 rows con `matter_class='ESPECIAL'`:

| materia | label | matter_class | comentario |
|---|---|---|---|
| PACTO_PARASOCIAL | Adhesión o modificación de pacto parasocial | ESPECIAL | Pertenece a `pactos_parasociales`, no a `agreements` |
| EXCLUSION_SOCIO | Exclusión de socio | ESPECIAL | Operación judicial sobre `capital_holdings` |
| SEPARACION_SOCIO | Separación de socio | ESPECIAL | Art. 346 LSC, flujo dedicado |

Resultado pre-fix: `DecisionUnipersonalStepper` mostraba esas materias en
el dropdown. Si el usuario seleccionaba una, el INSERT en `agreements`
fallaba con `23514 — agreements_matter_class_check`. Toast.error con
mensaje técnico Supabase, sin guidance de recuperación.

Test B6.3 inicialmente falló por este bug — workaround temporal: forzar
selección de `APROBACION_CUENTAS` (ORDINARIA). Documentado inline pero
NO bloqueante por scope del carril.

## Decisión: Opción A — filtrar a nivel hook (`useMateriaCatalog`)

**Por qué A y no B (extender CHECK):**

1. **Routing semántico**: PACTO_PARASOCIAL ya tiene tabla dedicada
   `pactos_parasociales`. EXCLUSION/SEPARACION_SOCIO son operaciones
   judiciales sobre `capital_holdings`. Persistirlas como agreements
   genéricos contaminaría el modelo de adopción societaria (que asume
   ordinaria/estatutaria/estructural por mayoría/quórum LSC).
2. **Costo schema**: extender el CHECK sin clarificar el dominio downstream
   (compliance_snapshot, evidence_bundles, certifications.gate_hash)
   crearía deuda mayor que la del fix actual.
3. **Reversibilidad**: si en el futuro decidimos que ESPECIAL debe
   persistir en agreements, basta añadir un `useMateriaCatalogIncludingSpecial`
   y revisar el CHECK. La opción A no cierra puertas.

**Implementación:**

1. **Constante y helpers centralizados**: `src/lib/secretaria/matter-class.ts`
   exporta `AGREEMENT_COMPATIBLE_MATTER_CLASSES = ['ORDINARIA', 'ESTATUTARIA',
   'ESTRUCTURAL']` + `isAgreementCompatibleMatterClass()` + `filterAgreementCompatibleMaterias()`.
   Fuente de verdad: el CHECK SQL `agreements_matter_class_check`.

2. **Filtro en hook**: `src/hooks/useMateriaConfig.ts` `useMateriaCatalog()`
   aplica `filterAgreementCompatibleMaterias()` sobre el `data` retornado
   por PostgREST. queryKey ahora es `["materia_catalog", "agreement_compatible"]`
   para evitar caché cruzado con un (futuro) hook full.

3. **Alcance**: `useMateriaCatalog` está usado solo en
   `DecisionUnipersonalStepper.tsx` (verificado vía grep). Otros steppers
   (Convocatoria, Co-aprobación, Solidario) usan listas hardcoded de
   materias o acceden a `materia_catalog` con filtros propios
   (`useRulePackForMateria`, etc.) — el fix no afecta esos paths.

4. **Test unitario**: `src/lib/secretaria/__tests__/matter-class.test.ts`
   verifica:
   - `AGREEMENT_COMPATIBLE_MATTER_CLASSES` matches el CHECK SQL exacto
   - `isAgreementCompatibleMatterClass()` devuelve true para los 3 valores
     y false para 'ESPECIAL', null, undefined, ""
   - `filterAgreementCompatibleMaterias()` excluye 'ESPECIAL' y mantiene
     los 3 válidos

5. **Test e2e**: B6.3 ahora puede seleccionar la primera opción del
   dropdown sin error (porque ya no hay ESPECIAL en la lista). Se
   simplifica el test removiendo el workaround `APROBACION_CUENTAS` explícito.

## Files modificados

- `src/lib/secretaria/matter-class.ts` (nuevo) — constantes + helpers
- `src/hooks/useMateriaConfig.ts` — aplica filtro en `useMateriaCatalog`
- `src/lib/secretaria/__tests__/matter-class.test.ts` (nuevo) — unit tests
- `e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts` — simplifica
  selección de materia (saca workaround temporal)

## Verificación

```bash
bun run typecheck   # 0 errores
bun run lint        # 0 errores
bun test src/lib/secretaria/__tests__/matter-class.test.ts   # filtro
bun test            # full suite — confirmar no regresión

# Smoke e2e cloud-real (requiere SECRETARIA_E2E_PHASE_B1=1):
SECRETARIA_E2E_PHASE_B1=1 PLAYWRIGHT_PORT=5191 bunx playwright test \
  e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts \
  --project=chromium --reporter=list
```

## Si en el futuro hace falta ESPECIAL en agreements

Pasos a seguir:

1. Decidir si las 3 materias ESPECIAL deben persistir en `agreements` o
   en una tabla dedicada (preferible).
2. Si en `agreements`: nueva migración `ALTER agreements_matter_class_check`
   añadiendo `'ESPECIAL'` al ENUM. Plus: clarificar `compliance_snapshot`
   para esos casos.
3. Actualizar `AGREEMENT_COMPATIBLE_MATTER_CLASSES` en
   `matter-class.ts` para incluir ESPECIAL.
4. Tests: ampliar `matter-class.test.ts` y revalidar B6.3 cloud-real.

## Alternative considerada (rejected)

**Opción B — extender CHECK SQL**: Rechazada por:
- Sin claridad sobre dominio downstream (compliance, evidence, certifications)
- Deuda mayor que la opción A
- Reversible vía nueva migración si cambia la decisión

## Ownership

- UI/UX: Carril Secretaría (DecisionUnipersonalStepper).
- Schema invariant: docs/superpowers/plans/2026-05-09-adr-000057-extend-adoption-mode.md
  documenta el modelo de modos de adopción; este fix complementa con la
  paridad de matter_class.
