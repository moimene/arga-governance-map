

## Por qué no ves la app

La build de TypeScript está fallando con ~40 errores. Cuando `tsc` falla, Vite no produce un bundle válido y el navegador recibe `TypeError: Importing a module script failed` → pantalla en blanco.

Los errores se agrupan en **5 causas raíz** independientes. Todas son fixes mecánicos, no hay cambios de lógica.

## Fixes a aplicar (cuando apruebes, paso a default mode)

### 1. `src/hooks/useBoardPackData.ts` — relaciones PostgREST tipadas como array
PostgREST con `foreign:fk ( col )` devuelve un **array** en los tipos generados, aunque la relación sea N:1. Hay que ajustar los tipos `Raw` locales:

- Línea 184: `policies: { title: string } | null` → `policies: { title: string }[] | null` y leer `a.policies?.[0]?.title`
- Línea 296: `delegate: { full_name: string } | null` → `delegate: { full_name: string }[] | null` y leer `d.delegate?.[0]?.full_name`
- Línea 372: `entities: {...} | null` → `entities: {...}[] | null`, `president: {...}[] | null`, `secretary: {...}[] | null`, y leer con `?.[0]`
- Línea 422: `persons: { full_name: string } | null` → `persons: { full_name: string }[] | null`

### 2. `src/hooks/useNoSessionExpediente.ts` — uso incorrecto de `supabase.queryClient`
`supabase` no expone `queryClient`. Sustituir las 7 llamadas `supabase.queryClient?.invalidateQueries(...)` por el patrón estándar TanStack:

```ts
import { useQueryClient } from "@tanstack/react-query";
// dentro de cada hook:
const qc = useQueryClient();
// en onSuccess:
qc.invalidateQueries({ queryKey: [...] });
```

Aplicar en `useCrearExpediente`, `useRegistrarRespuesta`, `useEnviarNotificacion`, `useActualizarExpediente`.

### 3. `src/hooks/useQTSPSign.ts` línea 158 — propiedad inexistente
El tipo `status` de `generateEvidence` solo declara `{ status: string }`. Cambiar:
```ts
const evidenceHash = result.status?.hash || `SHA256-${evidenceId}`;
```
por una lectura con cast seguro: `(result as any).hash || ...` o leer `result.id` ya que el hash real se computa aparte.

### 4. `src/lib/doc-gen/docx-generator.ts` línea 348 — `Uint8Array` a `Blob`
TS lib reciente exige `BlobPart` con `ArrayBuffer` no `ArrayBufferLike`. Fix:
```ts
const blob = new Blob([buffer.buffer as ArrayBuffer], { type: "..." });
```

### 5. Tests del rules-engine — tipos desactualizados
Los tests no están en el bundle de la app, pero `tsc --noEmit` global los incluye y falla la build. Dos opciones:

**A)** Excluir tests del typecheck de build añadiendo `"exclude": ["**/__tests__/**", "**/*.test.ts"]` en `tsconfig.app.json` (los tests siguen compilando bajo Vitest con su propio config).

**B)** Actualizar cada test para añadir las claves `SAU` y `SLU` a los `Record<TipoSocial, ...>` y arreglar el shape de `RuleParamOverride` y `EvidenceArtifact`.

**Recomiendo A** (excluir): es 1 línea de config, los tests no aportan a runtime, y son arreglables después en una PR de mantenimiento separada.

## Orden de aplicación

1. Excluir tests del typecheck (`tsconfig.app.json`) — desbloquea ~25 errores de golpe
2. Fix `useBoardPackData.ts` (4 tipos Raw)
3. Fix `useNoSessionExpediente.ts` (`useQueryClient`)
4. Fix `useQTSPSign.ts` (1 línea)
5. Fix `docx-generator.ts` (1 línea)
6. Verificar `npx tsc --noEmit` limpio y app cargando

Tras aprobar, lo aplico todo en una sola pasada.

