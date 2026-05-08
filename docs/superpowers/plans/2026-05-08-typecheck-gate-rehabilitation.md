# Typecheck gate rehabilitation

Fecha: 2026-05-08
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
Rama: `main`

## Objetivo

Rehabilitar el gate TypeScript real del repo. El comando usado en cierres anteriores:

```bash
bunx tsc --noEmit --pretty false
```

era un falso verde porque el `tsconfig.json` raíz tiene `files: []` y `references`; sin `--build`, TypeScript sale con código 0 sin chequear la app.

Nuevo gate:

```bash
bun run typecheck
```

que ejecuta:

```bash
bunx tsc -b --pretty false
```

## Decisiones

- Gate objetivo: zero-error.
- No usar `@ts-expect-error` como salida normal.
- Los casts PostgREST deben revisarse caso a caso: `{...}[]` vs `{...}` puede ser un falso positivo de tipos generados o una relación ambigua real.
- `tsc -b` genera `*.tsbuildinfo`; se ignoran en `.gitignore` para que el gate no ensucie el working tree.

## Inventario inicial

`bunx tsc -b --pretty false` y `bunx tsc -p tsconfig.app.json --noEmit --pretty false` devuelven el mismo set operativo de errores.

### C1 — PostgREST joins / tipos generados

Archivos:
- `src/components/secretaria/GlobalSearch.tsx`
- `src/hooks/useAgreementCompliance.ts`
- `src/hooks/useFilialEntities.ts`
- `src/hooks/usePersonasCanonical.ts`
- `src/pages/secretaria/Calendario.tsx`

Patrón: PostgREST tipa relaciones FK como array en selects que la app consume como objeto, o como `GenericStringError[]` en tablas no presentes en tipos generados.

### C2 — Type drift / lógica a revisar

Archivos:
- `src/pages/secretaria/ReunionStepper.tsx`
- `src/pages/secretaria/GenerarDocumentoStepper.tsx`
- `src/pages/secretaria/ExpedienteAcuerdo.tsx`
- `src/lib/doc-gen/variable-resolver.ts`
- `src/lib/demo-operable/trust-sandbox.ts`

Patrón: campos opcionales/ausentes, narrowing de uniones, JSONB genérico o contratos readonly/mutables.

### C3 — Fuente narrowing

Archivo:
- `src/hooks/useAgreementCompliance.ts`

Patrón: `fuente: string` debe convertirse al dominio `Fuente`.

### C4 — Config target

Archivo:
- `src/pages/grc/RiskEditor.tsx`

Patrón: `String.prototype.replaceAll` requiere lib ES2021 o implementación compatible ES2020.

### C5 — `import.meta.env`

Archivo:
- `src/lib/rules-engine/qtsp-integration.ts`

Patrón: casts inseguros de `ImportMeta` y falta de tipos Vite.

## Resultado esperado

- `bun run typecheck`: pass.
- `bunx tsc --noEmit --pretty false`: no vuelve a documentarse como gate válido.
- `bun run lint`, `bun run build`, `bun test`: pass tras los cambios.

## Resultado aplicado

- Script `typecheck` añadido a `package.json`: `bunx tsc -b --pretty false`.
- `*.tsbuildinfo` añadido a `.gitignore`.
- `CLAUDE.md`, `AGENTS.md` y `scripts/secretaria-p0-preflight.sh` actualizados para usar `bun run typecheck`.
- C1 resuelto normalizando joins PostgREST en el borde (`MaybeJoin` + `firstJoin`) o con cast `unknown` cuando el shape lo fija el select.
- C2 revisado:
  - `approval_workflow` se normaliza antes de montar `ApprovalWorkflowCard`.
  - agenda/debates completa `materia` y `tipo` antes de derivar source links.
  - `quorum_rule` queda tipado como JSONB (`Record<string, unknown>`).
  - `variable-resolver` evita `{}` como fallback no tipado.
  - `trust-sandbox` convierte tuples readonly a arrays mutables en el contrato público.
- C3 resuelto con narrowing explícito de `fuente` al dominio `Fuente` en el boundary de query.
- C4 resuelto sustituyendo `replaceAll` por `replace(/.../g)` compatible con ES2020.
- C5 resuelto con helper local `getQTSPEnv()` para `import.meta.env`.

Verificación final ejecutada:

- `bun run db:check-target`: pass contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `bun run typecheck`: pass.
- `bun run lint`: pass.
- `bun run build`: pass, con warnings esperados de Browserslist/chunk size.
- `bun test`: 898 pass / 66 skip / 0 fail.
