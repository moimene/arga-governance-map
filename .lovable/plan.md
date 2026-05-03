## Plan final aprobado — TGMS Console UX (con 3 ajustes finos)

### 1. `src/components/shell/sidebar-nav-items.ts` (NUEVO)
Extraer `top`, `modules`, `sii`, `adminItems`, `helpItems` y la interfaz `Item` desde `Sidebar.tsx`. Tanto el aside desktop como el `Sheet` mobile importan de aquí — sin duplicación.

### 2. `src/components/shell/Sidebar.tsx` — sidebar dual
- `aside` desktop con `hidden lg:flex` + `aria-label="Navegación principal"` + `data-testid="desktop-sidebar"` (ajuste #3 — evita ambigüedad de `aside` en e2e).
- Nuevo `<MobileSidebar />` que renderiza `Sheet` con los **mismos `ItemRow`** importados de `sidebar-nav-items.ts`.
- Estado abierto/cerrado en `SidebarMobileContext` para que `Header` dispare el toggle.
- Auto-cierre al cambiar `pathname`.

### 3. `src/components/shell/Header.tsx`
- Botón hamburguesa visible solo `<lg`, `aria-label="Abrir menú de navegación"`, antes del logo.
- `GlobalSearch` oculto `<md` (sigue accesible vía Cmd+K).
- Gaps reducidos en mobile.

### 4. `src/components/shell/AppLayout.tsx`
Envolver con `<SidebarMobileProvider>`.

### 5. `src/components/shell/GlobalSearch.tsx` — Búsqueda rápida + Cmd+K (ajustes #1 y #2)
- Título visual sobre el input o como label oculto: **"Búsqueda rápida"**.
- `placeholder="Buscar rápido (Cmd+K)"` — contiene literalmente "Buscar" para preservar el regex `/buscar|search/i` del e2e 11.
- Badge visual `⌘K` a la derecha del input.
- Listener global `keydown` para `Cmd/Ctrl+K`: enfoca el input **y** abre el popover.
- **Cambio de control de apertura** (ajuste #2 — opción recomendada): `open={open}` (no `open && q.length > 0`). Cuando `q === ""`, mostrar todos los grupos completos como sugerencias por defecto. Cuando `q !== ""`, filtrar items por `label.toLowerCase().includes(q.toLowerCase())`.
- `Escape` cierra el popover.
- Export `GlobalSearch` se mantiene (no romper imports).

### 6. `src/components/arga-console/ReadinessHeader.tsx` (NUEVO)
- Consume `platformReadinessLanes` de `@/lib/arga-console/platform-readiness` (no contrato hardcodeado).
- Título de sección: **"Postura de plataforma"** (preserva e2e 15).
- Subtítulo destacado: **"TGMS Console no muta owners — composición, búsqueda y readiness"**.
- Grid: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-5`.
- Cada tile usa `lane.label`, `lane.status` (pill con `laneStatusLabel` castellano), `lane.summary` (clamp 2 líneas), `lane.nextAction`, link a `lane.route`.
- Carril `evidence`: forzar literal **"000049 en HOLD"** en cuerpo (preserva e2e 15).
- Carril `secretaria`: link con texto/aria que incluye "Operativo Secretaría Societaria" (preserva e2e 15).

### 7. `src/components/arga-console/ErpConsolePanel.tsx` — adelgazar
- Eliminar bloque interno "Postura de plataforma" (ahora vive en `ReadinessHeader`).
- Mantener Work queue + Contratos de datos.
- Contratos en `<details>` collapsible.
- Grid: `grid-cols-1 lg:grid-cols-12`, work `lg:col-span-8`, contratos `lg:col-span-4`.

### 8. `src/pages/Dashboard.tsx` — reorganización ejecutiva
Orden vertical:
1. Header ejecutivo (saludo, scope, fecha, Tour) — `flex-col sm:flex-row`.
2. **Banner persistente arriba**: chips "TGMS Console no muta owners" + "Evidencia / Legal hold — HOLD" siempre visibles.
3. `<ReadinessHeader />` — primer viewport.
4. `<ErpConsolePanel />`.
5. KPIs — `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
6. Alertas + Próximas reuniones — `lg:grid-cols-12` (8/4).
7. Handoffs cross-module + Governance Map + Actividad — `lg:grid-cols-12` con `<details>` "Ver todos los handoffs" tras los 3 primeros.
8. Estado de Módulos.
9. `<DemoOperablePanel />`.
10. ESG mini.

Quitar `max-w-[1440px]` rígido → `max-w-screen-2xl px-4 sm:px-6`.

### 9. `e2e/20-console-responsive.spec.ts` (NUEVO) — ajuste #3
Smoke responsive 390×844:
- `await page.setViewportSize({ width: 390, height: 844 })`.
- `/` carga sin overflow horizontal: `expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)`.
- Hamburguesa visible: `await expect(page.getByRole('button', { name: /Abrir menú de navegación/i })).toBeVisible()`.
- Aside desktop oculto: `await expect(page.locator('aside[data-testid="desktop-sidebar"]')).toBeHidden()`.
- Literal "TGMS Console no muta owners" visible.
- Literal "000049 en HOLD" visible.

### 10. Tests preservados (sin tocar)
- `e2e/11-global-search.spec.ts`: Cmd+K abre popover (cumplido por `open={open}`); `getByPlaceholder(/buscar|search/i)` matchea "Buscar rápido (Cmd+K)".
- `e2e/15-demo-operable.spec.ts`: literales "Postura de plataforma", "Operativo Secretaría Societaria", "000049 en HOLD" emitidos por `ReadinessHeader`.
- `src/lib/arga-console/__tests__/platform-readiness.test.ts`: contratos intactos.

## Validación final

```bash
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5193 bunx playwright test e2e/11-global-search.spec.ts e2e/15-demo-operable.spec.ts e2e/20-console-responsive.spec.ts --project=chromium --reporter=list
```

Tras ejecutar: `git diff --name-only` debe mostrar solo archivos en `src/components/shell/**`, `src/components/arga-console/**`, `src/pages/Dashboard.tsx` y `e2e/20-console-responsive.spec.ts`.

## Fuera de scope (confirmado)
No se toca: Supabase, owners, `/secretaria`, `/grc`, `/ai-governance`, migrations, RLS, hooks de escritura, `governance_module_*`, worktree AIMS360.
