# Lint scope audit

Fecha: 2026-05-08
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
Rama: `main`

## Objetivo

Auditar si `bun run lint` tiene un falso verde por scope, tras descubrir que el antiguo typecheck raíz era un falso verde.

Comando auditado:

```bash
bun run lint
```

que ejecuta:

```bash
eslint .
```

## Configuración actual

`eslint.config.js` usa flat config:

- Ignore explícito: `dist`, `.claude`, `.claude/**`.
- Scope de reglas TypeScript/React: `**/*.{ts,tsx}`.
- Extends: `@eslint/js` recommended + `typescript-eslint` recommended.
- Reglas relevantes:
  - React hooks recommended activo.
  - `react-refresh/only-export-components` como warning.
  - `@typescript-eslint/no-unused-vars` desactivado.

No hay `.eslintignore`.

## Método

Se usó la API de ESLint para obtener el listado real de archivos que `eslint .` procesa:

```bash
bun -e 'import { ESLint } from "eslint"; const eslint = new ESLint({}); const results = await eslint.lintFiles(["."]); ...'
```

Después se comparó contra:

```bash
git ls-files
```

para separar archivos versionados de archivos ignorados/no versionados.

## Resultado

### Cobertura de archivos versionados

```md
- Archivos linted por ESLint: 644
- TS/TSX versionados: 576
- TS/TSX versionados no linted: 0
- JS/TS lintables versionados: 578
- JS/TS lintables versionados no linted: 0
```

Conclusión: **no hay falso verde de cobertura sobre archivos versionados TS/TSX**. `eslint .` cubre más superficie que `tsc -b`, no menos.

Superficie que ESLint cubre y `tsc -b` no cubre de forma equivalente:

- `e2e/**/*.ts`
- tests unitarios `__tests__` y `*.test.ts(x)`
- `scripts/*.ts`
- `supabase/functions/**/*.ts`
- configs (`eslint.config.js`, `postcss.config.js`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`)

### Ruido no versionado / false-red risk

`eslint .` también procesa 66 archivos ignorados/no versionados:

| Grupo | Cantidad | Ejemplo |
|---|---:|---|
| Vite timestamp mjs | 14 | `vite.config.ts.timestamp-*.mjs` |
| Vitest timestamp mjs | 42 | `vitest.config.ts.timestamp-*.mjs` |
| Directorio externo ignorado | 10 | `skill y MCP EAD TRUST/**` |

Estos archivos aparecen como `!!` en `git status --ignored --short`, pero ESLint no lee `.gitignore` automáticamente en esta configuración flat config.

Conclusión: el riesgo de `bun run lint` no es falso verde, sino **falso rojo local** si un archivo generado/externo ignorado queda con una infracción.

## Conclusión

**A.2 no detecta un falso verde de lint.** El gate actual cubre todos los archivos TS/TSX versionados y además cubre tests, e2e, scripts y functions.

Deuda menor recomendada, no urgente:

1. Ajustar `eslint.config.js` para ignorar explícitamente:
   - `**/*.timestamp-*.mjs`
   - `*.tsbuildinfo`
   - `skill y MCP EAD TRUST/**`
2. Mantener `eslint .` como comando de gate si se quiere preservar cobertura amplia.
3. No restringir a `src` porque perdería cobertura útil de `e2e`, scripts y Supabase functions.

## Verificación

```md
- API ESLint `lintFiles(["."])`: 644 archivos procesados.
- `git ls-files` comparison: 0 TS/TSX versionados omitidos.
- `bun run db:check-target`: pass — governance_OS (`hzqwefkwsxopwrmtksbg`).
- `bun run typecheck`: pass.
- `bun run lint`: pass.
- `bun run build`: pass — warnings esperados de chunk size.
- `bun test`: 898 pass / 66 skip / 0 fail.
- Memoria persistente Ruflo: `patterns/contextual_audit_before_backlog_debt_2026_05_08`.
- No source code changed: yes
- No secrets stored: yes
- No Cloud writes: yes
```
