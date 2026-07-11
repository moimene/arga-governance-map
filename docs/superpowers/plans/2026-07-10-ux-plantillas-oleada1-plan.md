# UX Plantillas — Oleada 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/secretaria/plantillas` de inventario histórico en herramienta operativa: vigentes separadas del histórico, variantes jurídicas visibles a nivel de fila, panel de salud documental con lectura ejecutiva e incidencias accionables.

**Architecture:** Un solo componente (`src/pages/secretaria/Plantillas.tsx`) + REUTILIZACIÓN estricta de los 4 sistemas de calidad existentes: cohortes UX-7.B (`plantilla-cohorte.ts`), operabilidad (`doc-gen/template-operability.ts`), revisión legal (`legal-template-review.ts`: `isDraftVersion`, `duplicateMatter`, `summarizeLegalTemplateReview` — hoy sin consumidor en esta página) y Gate PRE. **No se crea un quinto sistema de clasificación.**

**Tech Stack:** Igual que la página (React + TS relajado, tokens Garrigues, TanStack Query).

## Global Constraints

- Tokens Garrigues; no Tailwind nativo de color ni hex.
- e2e/08 usa `page.locator('select').first()` posicional (= select de materia en tab modelos): la segmentación de ciclo debe ser de **botones**, no `<select>`.
- e2e/21 fija `data-testid="plantillas-mobile-list"` / `"plantillas-desktop-table"`: conservar.
- Contract test (mesa-control-ui-contract) fija: `useAssignTemplateBinding`, `useSearchParams`, `(p.materia_acuerdo ?? p.materia) === filterMateria`, `templateEngineSort`, `Configuración del motor`, `Vincular como plantilla activa`, `templateSelectionReason`, `Plantilla vinculada a la regla efectiva`: conservar.
- Política vigente "todas visibles + avisar" (decisión 2026-06-26, `template-operability.ts`): el histórico NO se oculta del producto, se segmenta con acceso a un clic.
- `tipo_social` está 100% NULL en Cloud (74/74 ACTIVAs) y ausente de los tipos generados: **NO** añadir columna de tipo social (quedaría vacía). Documentado como diferido hasta que el dato exista.

## Evidencia de auditoría (wf_e3b6c920-08e, 9 agentes + probes Cloud)

| Afirmación del informe | Veredicto | Matiz |
|---|---|---|
| Vigentes y archivadas mezcladas; la vista no responde "qué puedo usar ahora" | PARCIAL→núcleo cierto | Cloud: 74 ACTIVA + 36 ARCHIVADA mezcladas; ARCHIVADA se hunde al final por sort y lleva badge, pero no hay segmentación |
| Filas duplicadas por falta de columnas órgano/tipo social/adopción | PARCIAL | Los pares NOMBRAMIENTO/CESE ×2 son **variantes legítimas** Junta (art. 214) vs Consejo-cooptación (art. 244), capa1 distinta; solo el ÓRGANO desambigua (adopción es MEETING en ambos; tipo_social 100% NULL). No hay duplicados exactos entre ACTIVAs |
| "Jurisdicción 110" ambigua; métricas sin salud | CONFIRMADO | Además degenerada (110/110 ES, siempre = total) e inconsistente con el scoping de la lista |
| ACTIVAs v0.1.0 como "Lista para usar" sin advertencia | CONFIRMADO | 14 ACTIVAs v0.1.0; además reciben badge VERDE "Activa · lista para uso". El detector ya existe: `isDraftVersion` (legal-template-review), solo lo consume el gestor |
| Metadatos incompletos no visibles/accionables | PARCIAL | Cohortes UX-7.B ya marcan y filtran "Activa · metadatos incompletos" (26/74 sin contrato); residual: adoption_mode (3) y tipo_social no señalizados — pero NULL=ANY es semántica documentada; decisión de Comité Legal, no de UI |
| Incidencias dispersas sin vista agrupada | PARCIAL | Cierto en esta página; el gestor ya agrupa por 10 clases. `summarizeLegalTemplateReview` existe y NO tiene consumidor UI |

Regresión propia detectada: `templateBindingDisplayLabel` (ola Materias de hoy) discrimina por adopción antes que por órgano → los pares Junta/Consejo salían como "posible duplicidad". Corregir el discriminador.

---

### Task P1: Segmentación de ciclo (Vigentes por defecto / En preparación / Histórico / Todas)

**Files:** Modify `src/pages/secretaria/Plantillas.tsx`

- Estado local `filterCiclo` con default `"vigentes"`; segmented control de **botones** con contadores.
- vigentes = ACTIVA · preparacion = BORRADOR/REVISADA/APROBADA · historico = ARCHIVADA/DEPRECADA.
- Detalle de una histórica: lookup "Sustituida por" (misma identidad funcional tipo+materia efectiva+órgano+adopción+jurisdicción, ACTIVA de mayor versión) con botón que cambia a Vigentes y la selecciona.

### Task P2: Columnas Órgano y Adopción en Modelos de acuerdo

**Files:** Modify `src/pages/secretaria/Plantillas.tsx`

- Tab modelos (desktop): sustituir columna "Jurisdicción" (constante ES, sigue en el detalle) por "Órgano" y "Adopción" (`organoTipoLabel`/`adoptionModeLabel`). Mobile: línea adicional órgano · adopción.
- Tab proceso: sin cambios de columnas (limitar blast radius).

### Task P3: Panel de salud documental + lectura ejecutiva

**Files:** Modify `src/pages/secretaria/Plantillas.tsx`

- `buildLegalTemplateReviewRows(vigentes)` + `summarizeLegalTemplateReview` → métricas: Vigentes / Modelos / Histórico / Incidencias (= `needsReview` sobre vigentes). Eliminar métrica "Jurisdicción".
- Línea ejecutiva: "Biblioteca operativa[, con advertencias]: N vigentes, M archivadas y K con incidencias de calidad documental."

### Task P4: Chips de incidencias accionables

**Files:** Modify `src/pages/secretaria/Plantillas.tsx`

- Strip de chips (si count>0): "Versión provisional (n)" [DRAFT_VERSION], "Variantes por confirmar (n)" [DUPLICATE_MATTER], "Sin órgano o adopción (n)" [MISSING_OWNER], "Sin referencia legal (n)" [MISSING_REFERENCE]. Click = toggle de filtro vía `matchesLegalTemplateReviewFilter` (reutiliza `LegalTemplateReviewFilter`), forzando segmento Vigentes.

### Task P5: Advertencia de madurez (versión 0.x vigente)

**Files:** Modify `src/pages/secretaria/Plantillas.tsx`

- Fila (ambas vistas): chip "Versión provisional" (tono warning) cuando ACTIVA + `flags.draftVersion`.
- Detalle: aviso "Vigente con advertencia de madurez…" (informativo; el ciclo de vida sigue gateado a ADMIN_TENANT).

### Task P6: Fix discriminador de etiqueta en mesa-control (regresión ola Materias)

**Files:** Modify `src/lib/secretaria/mesa-control-societaria.ts` + `src/lib/secretaria/__tests__/mesa-control-materias-status.test.ts`

- `templateBindingDisplayLabel`: elegir el PRIMER atributo que realmente difiera entre siblings ambiguos (órgano → adopción → materia), con labels de negocio de órgano (Junta General / Consejo de Administración / Socio único / Administrador único). Así los pares Junta/Consejo dejan de parecer duplicidad visible en CatalogoMaterias.
- Tests: caso junta/consejo (organo discrimina, no se flagea) + caso socio/admin único (sigue discriminando) + duplicado real (sigue flageándose).

### Task P7: Tests + gates + verificación en vivo + review adversarial

- Contract test: nuevo item con pins ("Vigentes", "Histórico", "Biblioteca operativa", "Versión provisional", "buildLegalTemplateReviewRows") y negativos (métrica "Jurisdicción" fuera del panel).
- `bun test` · `typecheck` · `lint` (tocados) · `build` · e2e/08 + e2e/21 · recorrido en vivo · workflow de review adversarial del diff.

## Post-review adversarial (2026-07-10, 19 agentes) — fixes aplicados

- **P1 tabla recortada en silencio**: el wrapper `overflow-hidden` ocultaba el chevron y parte de Estado con 7 columnas a 1440px → `overflow-x-auto` (scroll en su propio contenedor).
- **P1 filtros sin reconciliar**: cambiar de segmento resetea cohorte y revisión; el select de cohorte solo ofrece cohortes compatibles con el segmento; "Ver versión vigente" limpia también cohorte.
- **P2 chips por pestaña**: los contadores/filtro de incidencias se calculan sobre las vigentes de la pestaña activa (missingOwner/missingReference solo existen en modelos; un chip global daba vacíos garantizados en proceso).
- **P2 contraste AA**: chip activo con borde warning + superficie sutil (no fondo #878989 con texto blanco, 3.52:1); aviso de madurez en texto secundario con icono warning.
- **P2 semántica NULL**: en columnas de modelos, órgano/adopción NULL se muestran "No informado/a" (coherente con la incidencia "Sin órgano o adopción"); "Cualquier órgano" queda para el valor explícito ANY.
- **P2 copy madurez**: tooltip y sr-only aclaran "0.x o sin formato de versión final" (isDraftVersion también dispara con "1"); tooltip en la métrica Incidencias explica que agrega revisión legal completa.
- **P2 discriminador por unicidad** (lib): `templateBindingDisplayLabel` acumula órgano → adopción → materia hasta que la etiqueta es única (ambigüedad a 3 bandas cubierta con test).
- Refutados: cruce SA↔SL en "Sustituida por" (tipo_social 100% NULL, imposible con datos reales), deep-link a materia archivada (escenario no materializable), nit de conteo de variantes.

## Diferido (decisión usuario/Comité Legal)

- Columna/criterio de `tipo_social` (dato 100% NULL; NULL=ANY documentado).
- Señalizar `adoption_mode` NULL como incidencia (¿es ANY válido o debe ser explícito? criterio legal).
- "Comparar con vigente" para históricas (Oleada 2), analítica de uso y exportación (Oleada 3 del informe).
