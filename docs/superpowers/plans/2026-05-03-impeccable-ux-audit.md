# Impeccable UX Audit - TGMS / ARGA Governance Map

Fecha: 2026-05-03  
Repositorio: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Modo: auditoria completa sin cambios funcionales de UI  
Skill: `impeccable`

## Alcance auditado

Rutas muestreadas con Playwright en 390x844, 768x1024 y 1440x1000:

- `/`
- `/governance-map`
- `/secretaria`
- `/secretaria/sociedades`
- `/secretaria/acuerdos/ARGA-DEMO-AC-001`
- `/secretaria/documentos/pendientes-revision`
- `/grc`
- `/grc/risk-360`
- `/ai-governance`
- `/ai-governance/sistemas`
- `/sii`
- `/documentacion`

Tambien se revisaron los layouts principales, shell, sidebars, patrones de color, accesibilidad estatica, estado e2e y salida de build.

Capturas y JSON de auditoria local:

- `/tmp/tgms-ux-audit/audit-results.json`
- `/tmp/tgms-ux-audit/mobile-console.png`
- `/tmp/tgms-ux-audit/mobile-secretaria.png`
- `/tmp/tgms-ux-audit/mobile-grc.png`
- `/tmp/tgms-ux-audit/mobile-aims.png`
- `/tmp/tgms-ux-audit/mobile-sii.png`

## Resultado ejecutivo

La UX no esta rota globalmente: la consola TGMS principal ya es escaneable, responsive y honesta sobre readiness, ownership y evidence HOLD. Secretaria esta madura funcionalmente y el flujo documental tiene profundidad real. El problema principal no es de producto, sino de coherencia responsive y tokenizacion entre el shell y los modulos Garrigues.

La deuda critica se concentra en cuatro zonas:

1. Layout movil de Secretaria, GRC y AIMS: los sidebars Garrigues son fijos y estrangulan el contenido en 390px.
2. GRC y AIMS no heredan correctamente el contexto visual Garrigues y muestran sidebar rojo TGMS en vez de verde Garrigues.
3. Algunos componentes legacy mantienen patrones no aceptados por la guia `impeccable`: side stripes, colores Tailwind/raw y dialogos/anclajes con semantica incompleta.
4. La suite e2e esta casi limpia, pero quedan dos fallos: uno de harness por URL hardcodeada y otro que revela ambiguedad real de CTA en Convocatorias.

## Score

| Dimension | Score | Lectura |
|---|---:|---|
| Accessibility | 3/4 | Base correcta en rutas muestreadas; quedan icon-only/DialogTitle/CTA duplicada |
| Performance | 2/4 | Build funcional, pero chunks grandes: `index` >1.5MB y `ModuleShell` >700KB |
| Theming | 2/4 | Console bien; GRC/AIMS pierden tokens Garrigues; quedan colores raw/Tailwind |
| Responsive | 2/4 | Console pasa; modulos Garrigues fallan en mobile por sidebar fijo |
| Anti-patterns | 3/4 | No hay slop visual grave; si hay exceso de side stripes y cards repetitivas |

Total: 12/20 - aceptable para demo desktop, no cerrado para auditoria UX completa.

## Hallazgos P1

### P1-01 - Sidebars fijos rompen Secretaria, GRC y AIMS en mobile

Archivos:

- `src/pages/secretaria/SecretariaLayout.tsx`
- `src/components/secretaria/shell/SecretariaSidebar.tsx`
- `src/pages/grc/GrcLayout.tsx`
- `src/pages/ai-governance/AiLayout.tsx`
- `src/components/grc/ModuleSidebar.tsx`

En 390px, los sidebars de modulos se mantienen como columnas fijas (`w-[var(--sidebar-width)]`, `w-[220px]`, `w-[200px]`). El contenido queda comprimido en una franja derecha. Es visible en `mobile-secretaria.png`, `mobile-grc.png` y `mobile-aims.png`.

Correccion recomendada:

- Replicar el patron ya validado en `src/components/shell/Sidebar.tsx`: `hidden lg:flex` en desktop y `Sheet` mobile.
- Extraer nav items por modulo para no duplicar aside y drawer.
- Garantizar `min-w-0` en columnas de contenido.

### P1-02 - GRC y AIMS muestran sidebar rojo TGMS, no Garrigues

Archivos:

- `src/pages/grc/GrcLayout.tsx`
- `src/pages/ai-governance/AiLayout.tsx`

Las capturas de mobile muestran sidebar rojo en GRC/AIMS. El layout usa tokens `--sidebar-*`, pero no monta el scope `.garrigues-module`; por tanto hereda tokens del shell TGMS.

Correccion recomendada:

- Añadir `garrigues-module` al contenedor raiz de `GrcLayout` y `AiLayout`.
- Confirmar que las rutas `/grc/*` y `/ai-governance/*` usan `--g-*`, `--status-*` y `--sidebar-*` Garrigues.

### P1-03 - Dialogo SII con ancho fijo desborda en mobile

Archivo:

- `src/pages/sii/SiiLayout.tsx`

El acceso SII usa `DialogContent className="w-[480px]..."`. En 390px, el modal excede el viewport y se corta visualmente.

Correccion recomendada:

- Cambiar a `w-[min(480px,calc(100vw-2rem))]` o `w-[calc(100vw-2rem)] max-w-[480px]`.
- Usar `DialogTitle` y `DialogDescription` reales de shadcn/Radix en vez de solo `<h2>`.

### P1-04 - CTA duplicada "Abrir reunion" en ConvocatoriaDetalle

Archivo:

- `src/pages/secretaria/ConvocatoriaDetalle.tsx`
- Test afectado: `e2e/04-secretaria-convocatorias.spec.ts`

Playwright falla por strict mode: hay dos botones con nombre accesible "Abrir reunion". Esto no es solo deuda de test; tambien crea ambiguedad para usuarios y tecnologia asistiva.

Correccion recomendada:

- Diferenciar el CTA primario de la accion secundaria con texto o `aria-label` especifico.
- Actualizar el test para apuntar al CTA correcto por rol/nombre.

## Hallazgos P2

### P2-01 - Test auth acoplado a puerto local fijo

Archivo:

- `e2e/01-auth.spec.ts`

El test espera `localhost:5173`, pero la suite se ejecuto en `127.0.0.1:5194`. Resultado: fallo de harness, no fallo de UX.

Correccion recomendada:

- Comprobar pathname o usar `baseURL`, no host/puerto literal.

### P2-02 - Documentacion usa grid desktop de 12 columnas sin variante mobile

Archivo:

- `src/pages/Documentacion.tsx`

La pagina usa `grid-cols-12`, `col-span-3` y `col-span-9` sin breakpoints responsive claros.

Correccion recomendada:

- `grid-cols-1 lg:grid-cols-12`, con indice superior o drawer en mobile.

### P2-03 - ReactFlow / Governance Map mantiene colores raw y Tailwind nativos

Archivo:

- `src/components/governance-map/GovNode.tsx`

Se detectan clases como `bg-[#fef3c7]`, `border-amber-300`, `text-amber-700`, `bg-red-100`, `text-green-700`. Rompe la disciplina de tokens del proyecto.

Correccion recomendada:

- Mapear tonos a `--t-*` para shell o `--status-*` cuando representen estados.

### P2-04 - Side stripes como patron visual repetido

Archivos representativos:

- `src/components/arga-console/ReadinessHeader.tsx`
- `src/components/arga-console/DemoOperablePanel.tsx`
- Varias paginas de Secretaria, GRC, AIMS y alertas core

El patron `border-l-4` aparece como decoracion recurrente. `impeccable` lo marca como anti-patron por parecer plantilla/generic SaaS cuando se usa en exceso.

Correccion recomendada:

- Mantener side stripe solo para alertas legales/estado de riesgo donde aporte significado.
- Para readiness/cards normales, usar jerarquia por titulo, badge y densidad, sin franja lateral.

### P2-05 - Botones icon-only con semantica a revisar

Archivos a revisar:

- `src/components/tour/TourPanel.tsx`
- `src/components/shell/Header.tsx`
- `src/components/shell/NotificationsBell.tsx`
- `src/components/shell/UserMenu.tsx`
- `src/pages/PoliticaDetalle.tsx`

La auditoria dinamica no encontro botones sin nombre en rutas muestreadas, pero el scan estatico detecta varios icon buttons donde conviene confirmar `aria-label` explicito.

Correccion recomendada:

- Añadir `aria-label` a cada `Button size="icon"` o boton sin texto visible.

### P2-06 - Chunks de build grandes

Salida observada en build previo:

- `index` superior a 1.5MB
- `ModuleShell` superior a 700KB
- `handlebars` superior a 450KB

Correccion recomendada:

- Separar motor documental, Handlebars y pantallas pesadas en imports lazy por ruta/accion.
- Revisar que el composer no cargue en el shell inicial si solo se usa en Secretaria/documentos.

### P2-07 - Tablas densas dependen de scroll horizontal

Rutas afectadas:

- `/secretaria/sociedades`
- `/grc/*`
- `/ai-governance/sistemas`

El scroll horizontal esta controlado y no crea overflow de documento, pero en mobile reduce mucho la legibilidad.

Correccion recomendada:

- Mantener tabla en desktop.
- En mobile, usar lista densa por entidad con campos clave y CTA.

## Lo que esta bien

- `/` ya no presenta overflow horizontal en 390px.
- La consola TGMS muestra readiness y disclaimers clave: "TGMS Console no muta owners" y "000049 en HOLD".
- La auditoria dinamica no detecto overflow de documento, botones sin nombre o inputs sin nombre en las rutas muestreadas.
- No se observaron blobs, gradientes hero, glassmorphism ni decoracion generica dominante.
- Secretaria tiene profundidad funcional real; el problema mobile viene de layout, no de falta de producto.
- La suite Playwright esta cerca de verde: 87/89 tests pasan.

## Verificacion ejecutada

```bash
node /Users/moisesmenendez/.agents/skills/impeccable/scripts/load-context.mjs
PLAYWRIGHT_PORT=5194 bunx playwright test --project=chromium --reporter=list
bunx vite --host 127.0.0.1 --port 5195 --strictPort
```

Resultado Playwright completo:

- 87 passed
- 2 failed

Fallos:

- `e2e/01-auth.spec.ts` - espera `localhost:5173`; suite corre en `127.0.0.1:5194`
- `e2e/04-secretaria-convocatorias.spec.ts` - dos botones con nombre "Abrir reunion"

## Plan de cierre recomendado

1. Responsive Garrigues shell:
   - SecretariaSidebar mobile drawer
   - GRC/AIMS drawer mobile
   - `.garrigues-module` en GRC/AIMS

2. Reparacion e2e y accesibilidad:
   - CTA duplicada "Abrir reunion"
   - Auth test sin puerto fijo
   - Icon-only `aria-label`
   - DialogTitle/DialogDescription en SII

3. Theming cleanup:
   - Governance Map sin colores raw
   - Side stripes reducidas
   - Modulos Garrigues sin Tailwind native colors

4. Responsive data surfaces:
   - Documentacion mobile stack
   - Sociedades/GRC/AIMS mobile list alternatives

5. Performance:
   - Lazy load de motor documental/Handlebars
   - Revisar chunks `index` y `ModuleShell`

## Comandos sugeridos para el proximo pase

```bash
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5196 bunx playwright test e2e/01-auth.spec.ts e2e/04-secretaria-convocatorias.spec.ts e2e/20-console-responsive.spec.ts --project=chromium --reporter=list
```

Despues de aplicar responsive drawers:

```bash
PLAYWRIGHT_PORT=5197 bunx playwright test --project=chromium --reporter=list
```
