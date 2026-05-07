# ARGA Seguros S.A. golden path consolidation

Fecha: 2026-05-06
Modulo: Secretaria Societaria
Entidad golden path: ARGA Seguros S.A.
Source of truth: Supabase Cloud `governance_OS`

## Objetivo

Consolidar ARGA Seguros S.A. como sociedad operativa principal para demo, con datos suficientes y coherentes para ejecutar los flujos de Secretaria Societaria sin mezclar organos de otras sociedades ni dejar el flujo bloqueado por censo, organo, certificacion o plantilla incompatible.

## Alcance aplicado

Se ejecuto el script idempotente:

```bash
bun scripts/secretaria-consolidate-arga-golden-path.ts --apply
```

El script queda tambien disponible en modo plan:

```bash
bun scripts/secretaria-consolidate-arga-golden-path.ts
```

## Mutaciones principales

- Se normalizo la Junta General canonica y el Consejo de Administracion de ARGA Seguros.
- Se marco como `reference_only` la Junta General duplicada y se trasladaron sus acuerdos borrador a la Junta canonica.
- Se ocultaron organos residuales de E2E para que no aparezcan en flujos operativos de Secretaria.
- Se cerraron residuos E2E en condiciones de persona, authority evidence y holdings de capital sin peso operativo.
- Se poblaron condiciones y authority evidence de Junta General para presidente y secretario.
- Se nutrio la composicion minima de comisiones y comites reales de ARGA.
- Se reubicaron dos acuerdos legacy que estaban colgados indebidamente de ARGA:
  - `00000000-0000-0000-0000-000000000202` a Cartera ARGA S.L.U.
  - `00000000-0000-0000-0000-000000000203` a ARGA Reaseguros S.A.
- Se normalizaron acuerdos ARGA de `APROBACION_POLITICA` a `POLITICAS_CORPORATIVAS`.
- Se completaron censos snapshot faltantes en reuniones ARGA donde habia fuente canonica.
- Se vinculo la certificacion `ff224b50-c2cb-5d5f-ad88-90e7ba6cf98c` con authority evidence vigente.

## Resultado de readiness

Probe ejecutado:

```bash
bun scripts/secretaria-repair-demo-entity-coherence.ts \
  --entity 6d7ed736-f263-4531-a59d-c6ca0cd41602 \
  --json
```

Resultado:

```json
{
  "summary": {
    "Completa": 1,
    "Parcial": 0,
    "Rota": 0,
    "No usable para flujo": 0
  },
  "status": "Completa",
  "blocking": 0,
  "warnings": 0
}
```

## Sanity check Cloud

Estado directo despues de aplicar:

```json
{
  "bodiesTotal": 20,
  "visibleBodies": 12,
  "hiddenBodies": 8,
  "activePositiveHoldings": 2,
  "activeCapital": 100,
  "censoSnapshots": 12
}
```

Organos visibles para ARGA:

- Consejo de Administracion
- Junta General de Accionistas
- Comite Ejecutivo
- Comision de Auditoria y Cumplimiento Normativo
- Comision de Riesgos Regulada
- Comision de Nombramientos
- Comision de Retribuciones
- Comision de Sostenibilidad
- Comite de Direccion
- Comite de Riesgos
- Comite de Cumplimiento
- Comite Asesor de Tecnologia e Innovacion (CATIT)

## Cambios de codigo asociados

- `scripts/secretaria-consolidate-arga-golden-path.ts`: plan/apply idempotente de consolidacion ARGA.
- `src/lib/secretaria/operational-bodies.ts`: filtro comun de organos operativos.
- `src/hooks/useBodies.ts`, `src/hooks/useEntities.ts`, `src/lib/secretaria/scope-filters.ts`: filtrado de organos reference-only/E2E.
- `src/pages/secretaria/DesignarAdminStepper.tsx`: evita seleccionar organos no operativos.
- `src/lib/secretaria/meeting-census.ts`: no considera holdings de voto/capital cero como censo operativo.

## Verificacion

```bash
bun run db:check-target
bun scripts/secretaria-consolidate-arga-golden-path.ts
bun scripts/secretaria-consolidate-arga-golden-path.ts --apply
bun scripts/secretaria-repair-demo-entity-coherence.ts --entity 6d7ed736-f263-4531-a59d-c6ca0cd41602 --json
bunx --bun tsc --noEmit --pretty false
bunx --bun vitest run src/lib/secretaria/__tests__/meeting-census.test.ts src/lib/secretaria/__tests__/entity-demo-readiness.test.ts --reporter=dot
bun run lint
bun run build
PATH="$HOME/.bun/bin:$PATH" PLAYWRIGHT_PORT=5204 bunx playwright test e2e/33-secretaria-entity-scope.spec.ts --project=chromium --reporter=list
```

Resultado:

- `db:check-target`: pass.
- Consolidacion ARGA: pass.
- Readiness ARGA: `Completa`, 0 bloqueos, 0 warnings.
- Typecheck: pass.
- Unit targeted: 10/10 pass.
- Lint: pass.
- Build: pass.
- E2E scope ARGA: 2/2 pass.

## Riesgo residual

El saneamiento global de todas las sociedades demo sigue fuera de este cierre. La decision aplicada es concentrar el golden path en ARGA Seguros S.A. y ocultar residuos no operativos de los flujos de Secretaria, sin destruir trazabilidad historica ni hacer inferencias inseguras sobre sociedades de referencia.

No se aplicaron migraciones ni `bun run db push`.

## Addendum 2026-05-07 - ficha societaria y despliegue

Se completo el hardening visual y funcional de la ficha societaria de ARGA Seguros S.A. en commit `ec4e96e`.

Cambios confirmados:

- La pestana `Clases` deja de existir como seccion independiente; las clases de acciones/participaciones viven dentro de `Capital`.
- `Capital desembolsado` queda nutrido y coherente con el capital escriturado de ARGA Seguros S.A.
- `Administradores` muestra composicion vigente del Consejo de Administracion; ya no depende de la vista de administradores no colegiados.
- `Representaciones` aclara vigencia y evidencia de la representacion permanente de persona juridica.
- `Autoridad` queda separada de miembros del organo y se reserva para cargos certificantes/firmantes.
- `Marco normativo` diferencia Acuerdo360 como expediente/snapshot frente al motor de reglas mantenido por rule packs, overrides y pactos.

Verificacion adicional:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5201 bunx playwright test e2e/34-secretaria-sociedad-ficha.spec.ts --project=chromium --reporter=list
```

Resultado: pass.

Preview Vercel con el bundle actualizado:

- `https://arga-governance-qg7m7hd6i-moises-menendezs-projects.vercel.app`

Nota: si una web muestra todavia `Clases` como pestana separada o el texto `Sin administradores no colegiados`, esta sirviendo un bundle anterior. El codigo fuente y el build actual contienen `Sin administradores vigentes.` solo como empty state defensivo y el E2E verifica que no aparece para ARGA Seguros S.A.
