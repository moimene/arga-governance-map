# Secretaria Societaria - memoria de avances del carril critico

Fecha: 2026-05-07  
Repositorio: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Rama operativa: `main`  
Modulo prioritario: Secretaria Societaria  
Entidad golden path: ARGA Seguros S.A.  
Source of truth: Supabase Cloud `governance_OS`

## Objetivo de esta memoria

Dejar una memoria compacta y retomable del carril critico ejecutado para llevar Secretaria Societaria al estado mas avanzado posible de demo operativa. Este documento consolida los avances de datos, codigo, UI, pruebas, despliegue y riesgos residuales, para que cualquier carril posterior no vuelva a diagnosticar desde cero.

## Commits relevantes del carril

| Commit | Alcance |
|---|---|
| `e004009` | Seed societario demo completo. Base de sociedades, personas, organos, capital, reuniones y acuerdos. |
| `95f89d7` | Consolidacion avanzada del golden path Secretaria sobre ARGA Seguros S.A. |
| `ec4e96e` | Hardening de ficha societaria ARGA: datos maestros, capital, organos, administradores, representaciones, autoridad y marco normativo. |
| `0340d4b` | Preservacion de scope GRC y documentacion de triage repo, sin afectar el carril Secretaria. |

Estado Git al cierre documentado: `main` sincronizada con `origin/main`, salvo el plan nuevo `2026-05-06-secretaria-gestor-reglas-acuerdo360-plan.md` que queda como documento de memoria pendiente de stage/commit si se decide incorporarlo.

## Avances funcionales cerrados

### 1. ARGA Seguros como golden path operativo

ARGA Seguros S.A. quedo convertida en la entidad principal para demo real de Secretaria:

- Readiness de ARGA: `Completa`, 0 bloqueos, 0 warnings.
- Acuerdos legacy de filiales retirados del golden path ARGA.
- Organos residuales/E2E ocultados de flujos operativos.
- Censos snapshot completados cuando habia fuente canonica.
- Certificacion legacy vinculada a autoridad vigente.
- Reuniones, acuerdos y evidencias quedan scopeados a la sociedad seleccionada.

Documento fuente: `docs/superpowers/plans/2026-05-06-arga-seguros-golden-path-consolidation.md`.

### 2. Ficha societaria endurecida

La ficha societaria de ARGA se ajusto para alimentar flujos reales y no solo mostrar datos planos:

- Perfil: muestra NIF/CIF demo, domicilio social y LEI como campos funcionales, y evita exponer `PJ (PERSONS)` como dato de negocio.
- Capital: capital desembolsado igual al capital escriturado en ARGA Seguros; clases de acciones movidas dentro de la pestana Capital.
- Clases: se elimino como pestana separada para evitar una navegacion artificial.
- Socios: cap table operativo con Cartera ARGA S.L.U. y free float.
- Organos: se muestra una unica Junta General y un unico Consejo de Administracion operativo, junto a comisiones/comites filtrados.
- Administradores: se carga desde composicion vigente del Consejo, no desde "administradores no colegiados".
- Representaciones: se aclara como representacion permanente de persona juridica, con vigencia y evidencia EAD Trust.
- Autoridad: se separa de la lista completa de miembros; representa cargos certificantes/firmantes.
- Marco normativo: muestra que Acuerdo360 es expediente trazable y que las reglas viven en rule packs, overrides, pactos y snapshots.

Test asociado: `e2e/34-secretaria-sociedad-ficha.spec.ts`.

### 3. Scope y coherencia de datos

Se corrigieron las causas que mezclaban datos entre sociedades:

- Filtro comun de organos operativos en `src/lib/secretaria/operational-bodies.ts`.
- Hooks y pantallas dejan fuera organos `reference_only` y residuos E2E.
- `DesignarAdminStepper` no permite seleccionar organos no operativos.
- `meeting-census.ts` no usa holdings de capital/voto cero como censo funcional.
- El carril global de reparacion queda limitado a reparaciones seguras; no hay reparacion destructiva global.

Documentos fuente:

- `docs/superpowers/plans/2026-05-06-secretaria-global-safe-repair-closeout.md`
- `docs/superpowers/plans/2026-05-06-arga-seguros-golden-path-consolidation.md`

### 4. Gestor de reglas Acuerdo360

Se dejo planificado el carril del Gestor de Reglas Acuerdo360 como experiencia legal read-only:

- Separar validez societaria, cumplimiento contractual y hold operativo.
- Mostrar ley, estatutos/overrides, reglamento, pactos, documentacion, formalizacion, registro y publicacion.
- Tratar veto de pacto parasocial como incumplimiento contractual/hold operativo si no esta estatutarizado.
- No escribir reglas ni snapshots en el primer corte.
- No crear migracion inicial.

Documento fuente: `docs/superpowers/plans/2026-05-06-secretaria-gestor-reglas-acuerdo360-plan.md`.

## Avances tecnicos cerrados

Archivos principales tocados en el carril:

- `scripts/secretaria-consolidate-arga-golden-path.ts`
- `scripts/secretaria-repair-demo-entity-coherence.ts`
- `src/lib/secretaria/operational-bodies.ts`
- `src/lib/secretaria/meeting-census.ts`
- `src/hooks/useBodies.ts`
- `src/hooks/useEntities.ts`
- `src/lib/secretaria/scope-filters.ts`
- `src/pages/secretaria/SociedadDetalle.tsx`
- `src/pages/secretaria/DesignarAdminStepper.tsx`
- `e2e/33-secretaria-entity-scope.spec.ts`
- `e2e/34-secretaria-sociedad-ficha.spec.ts`

## Verificacion registrada

Comandos verificados durante el carril:

```bash
bun run db:check-target
bun scripts/secretaria-consolidate-arga-golden-path.ts
bun scripts/secretaria-consolidate-arga-golden-path.ts --apply
bun scripts/secretaria-repair-demo-entity-coherence.ts --entity 6d7ed736-f263-4531-a59d-c6ca0cd41602 --json
bunx --bun tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5204 bunx playwright test e2e/33-secretaria-entity-scope.spec.ts --project=chromium --reporter=list
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5201 bunx playwright test e2e/34-secretaria-sociedad-ficha.spec.ts --project=chromium --reporter=list
vercel deploy . -y
```

Resultado consolidado:

- `db:check-target`: pass.
- Readiness ARGA: `Completa`, 0 bloqueos, 0 warnings.
- Typecheck: pass.
- Lint: pass.
- Build local: pass.
- E2E scope ARGA: pass.
- E2E ficha societaria ARGA: pass.
- Deploy preview Vercel: READY.

Preview desplegado:

- `https://arga-governance-qg7m7hd6i-moises-menendezs-projects.vercel.app`

Nota operativa: si una web sigue mostrando la pestana antigua `Clases` o el texto `Sin administradores no colegiados`, esta sirviendo un bundle anterior. El codigo actual y el build verificado ya no contienen esa UI.

## Diagnostico de consola navegador

Los errores vistos durante la revision no proceden del modulo Secretaria:

- `Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.`: error de mensajeria de extension Chrome.
- `MetaMask extension not found`: extension/script web3 inyectado, ajeno a TGMS.
- `[LaunchDarkly] LaunchDarkly client initialized`: log informativo externo, no bloqueante.

No se ha identificado relacion entre esos mensajes y la ausencia visual de administradores; el problema observado era de bundle/despliegue cacheado o no actualizado.

## Riesgos residuales

### P0 funcional

- Promover a produccion Vercel solo cuando se confirme que el preview es el estado que se quiere exponer como URL principal.
- Consolidar la experiencia del Gestor de Reglas Acuerdo360 para que Legal vea regla efectiva por materia, no solo marco normativo agregado.

### P1 datos/demo

- Las sociedades fuera del golden path siguen necesitando saneamiento sociedad a sociedad si se quieren usar en demo, no mediante repair global destructivo.
- Los datos de estatutos/reglamentos siguen proyectados por overrides/perfil normativo; no existe repositorio estructurado versionado en este corte.

### P2 producto

- Reducir dependencia de preview/manual deploy y dejar documentada la ruta exacta de despliegue prod cuando el entorno objetivo quede fijado.
- Seguir migrando fixtures residuales a Cloud solo cuando exista sustituto firmado, activo y verificado por probe.

## Criterio para carriles futuros

1. No reabrir saneamiento global destructivo.
2. Consolidar sociedad por sociedad con plan/apply idempotente.
3. ARGA Seguros S.A. es el golden path, y cualquier cambio debe mantener readiness 0/0.
4. Ficha societaria debe mostrar datos de negocio, no codigos internos salvo en contexto tecnico.
5. Administradores de una SA con Consejo son miembros vigentes del Consejo; no deben depender de una tabla de administradores unipersonales/mancomunados.
6. Acuerdo360 no es el motor de reglas: es expediente/snapshot. La regla efectiva vive en rule packs, overrides, pactos y marco normativo.
7. Si la UI online no refleja cambios locales verificados, comprobar primero bundle/despliegue/cache antes de reabrir datos.

## No secretos

Este documento no contiene credenciales, tokens, claves de Supabase ni secretos. La ruta `docs/superpowers/plans/.env` existe en el repo local, pero no se ha copiado ningun valor en esta memoria.
