# Wave 4 Adversarial Review — UI PersonaDetalle

**Reviewer:** Adversarial Reviewer Wave 4
**Date:** 2026-05-12
**Branch:** `feature/personas-cargos-refactor`
**Commits under review:** `ec932d4`, `8f7338a`, `e8da1bd`, `6ba2c3f` (all pushed to origin)
**Single file:** `src/pages/secretaria/PersonaDetalle.tsx` (236 → 561 líneas; +325)

---

## Verdict

**APPROVE**

El builder cumple los 4 D4.X con calidad alta: separación vigentes/histórico, botones con tipografía y tokens correctos, modal accesible con focus management + Escape + overlay-click + 3 bonus, y banner PJ con detección precisa subconjunto-de-vigentes que respeta L1 (SOCIO PJ no requiere rep). Verificación independiente de tokens Garrigues confirma 0 violaciones en el código nuevo. `useCesarCargo` y `requiresRepresentative` se invocan con la firma exacta. Cobertura legal L2 + L14 + L15-16 + L17 verificada cruzando con `cargo-validation.ts` y `useCargos.ts`. Una observación menor sobre `rounded-full` pre-existente (no introducido por Wave 4) y una recomendación de polish para banner.

---

## Critical findings

(Ninguno crítico. Lista de findings ordenados por severidad.)

- **[L] `rounded-full` Tailwind nativo línea 130** — Pre-existente en el archivo desde antes de la Wave 4 (`git show ec932d4^:...` lo contiene). Ninguno de los 4 commits lo introduce. El skill Garrigues prescribe `style={{ borderRadius: 'var(--g-radius-full)' }}` para avatares. No bloquea el merge; conviene flagged como `tech-debt` separado.
- **[L] Banner usa `bg-[var(--status-warning)]/10` con texto `text-[var(--g-text-secondary)]`** (líneas 173, 185) — El token `--status-warning = #878989` es gris. El banner queda visualmente neutro en lugar de "warning amarillento". Coincide con el sistema (el skill define `--status-warning` como gris para "advertencia/en revisión") así que es correcto por política, pero el contraste sensorial es bajo. Si se quisiera reforzar, mover a un patrón distinto (ej. borde más fuerte). No es un fallo del builder — es coherente con el sistema.
- **[L] `aria-describedby="cesar-cargo-desc"` apunta al `<p>` con id correcto** — Bien implementado, pero el `<p>` describe solo "Se cerrará la vigencia. El histórico se conserva", no menciona los campos editables. Suficiente para WCAG AA. Sin acción.

---

## Garrigues tokens audit (verified independently)

| Check | Builder claim | Reviewer verification | Result |
|---|---|---|---|
| Native Tailwind colors (`text-white`, `bg-gray-*`, etc.) | 0 | 0 hits con grep `(text\|bg\|border\|ring\|fill\|stroke\|...)-(white\|black\|gray\|red\|...\|rose)` | ✓ |
| Hex literals (`#RRGGBB`) | 0 | 0 hits con grep `#[0-9a-fA-F]{3,8}` | ✓ |
| CSS color names en `style` (`'white'`, `'green'`, etc.) | 0 | 0 hits con grep `style.*=.*(color\|background\|borderColor).*['"](white\|black\|red\|green\|...)['"]` | ✓ |
| Token inválido `--g-status-*` | 0 | 0 hits con grep `var\(--g-status-` | ✓ |
| Token inválido `--g-brand` sin `-3308` | 0 | 0 hits con grep `var\(--g-brand\b\)` | ✓ |
| Token inválido `--g-surface-secondary` | 0 | 0 hits con grep `var\(--g-surface-secondary\b\)` | ✓ |
| Double-nested `var(var(...))` | 0 | 0 hits con grep `var\(var\(` | ✓ |
| Tailwind `rounded-*` / `shadow-*` native | (no reclamado) | 1 hit línea 130 (`rounded-full`) — **PRE-EXISTENTE**, no introducido por Wave 4 | ⚠️ pre-existing |

**Resultado:** los 4 commits introducen 0 nuevas violaciones de tokens. El único hallazgo es `rounded-full` en línea 130, presente en el archivo desde antes de la Wave 4 (verificado con `git show ec932d4^`). Builder claim "0 violaciones" se confirma para el código que Wave 4 añade.

---

## D4.X feature audit

| D4.X | Status | Notes |
|---|---|---|
| **D4.1 — Separación vigentes/histórico** | ✓ | Dos `<section>` (líneas 228 + 309). Filter `c.estado === "VIGENTE"` (línea 36) y `=== "CESADO"` (línea 39) sobre `cargos ?? []`. Empty states: "Sin cargos vigentes." (252) / "Sin cargos cesados todavía." (333). Histórico sin columna Acciones — correcto. Encabezados con `bg-[var(--g-surface-subtle)]` + `text-[var(--g-text-primary)]`. Mantiene G3 "Es socio en" intacto. |
| **D4.2 — Botones** | ✓ | "Asignar cargo" siempre visible (línea 145, URL `/secretaria/cargos/nuevo?personId=${p.id}` exacta). "Asignar/Editar representante" solo si `p.person_type === "PJ"` (153, URL `/secretaria/personas/${p.id}/representante/nuevo` exacta). Texto dinámico "Editar representante" cuando `p.representative?.full_name`, "Asignar representante" si no (160). Iconos `Plus` + `UserCheck` con `aria-hidden="true"`. Estilos: primario verde + outline diferenciado. |
| **D4.3 — Modal cesar accesible** | ✓ | `role="dialog"` (459), `aria-modal="true"` (460), `aria-labelledby="cesar-cargo-title"` apunta a `h2` id correcto (461 → 477), `aria-describedby="cesar-cargo-desc"` apunta a `p` id correcto (462 → 494). Labels visibles "Fecha de cese *" y "Razón (opcional)". `useCesarCargo.mutateAsync({condicion_id, fecha_fin, razon})` con firma exacta (líneas 73-78). `aria-busy={cesarMutation.isPending}` (540). `disabled={cesarMutation.isPending \|\| !fechaFin}` (539). Toast success/error (79, 83). Modal cierra en success (`closeCesarModal()` línea 80), permanece tras error. Reset razon en `closeCesarModal` (56). **BONUS verificados:** Escape key cierra (líneas 64-66), focus inicial al primer field via `fechaFinInputRef.current?.focus()` (63), overlay click cierra (464-466). |
| **D4.4 — Banner PJ administradora sin rep** | ✓ | Condición triple AND: `p.person_type === "PJ"` && `cargosAdminSinRep.length > 0` && `!p.representative` (línea 116). Subconjunto vigentes filtrado por `requiresRepresentative({person_type: p.person_type}, c.tipo_condicion)` (109-114) — invoca con firma exacta y excluye SOCIO PJ (L1). Importa `requiresRepresentative` + `TipoCondicionCargo` desde `@/lib/secretaria/cargo-validation` (22-24). Token `border-[var(--status-warning)]/40` + `bg-[var(--status-warning)]/10` (173). Icono `AlertTriangle` (176). Cita "LSC art. 212 bis" textual (183). Lista cargos afectados con `CARGO_LABELS[c.tipo_condicion]` (188). CTA "Asignar representante" navegando a URL correcta (192-199). `role="alert"` (172). |

---

## Confirmation matrix

| Item | Status |
|---|---|
| 4 commits present + pushed (`ec932d4`, `8f7338a`, `e8da1bd`, `6ba2c3f`) | ✓ |
| Garrigues tokens compliance (en código nuevo) | ✓ |
| D4.1 separación vigentes/histórico | ✓ |
| D4.2 botones URLs exactas | ✓ |
| D4.3 modal accesibilidad completa (dialog/modal/labelledby/describedby/focus/Escape/overlay) | ✓ |
| D4.4 banner 3-condition AND logic | ✓ |
| `useCesarCargo` invocación correcta (`condicion_id`, `fecha_fin`, `razon`) | ✓ |
| `requiresRepresentative` invocación correcta (`{person_type}`, `tipo`) | ✓ |
| typecheck green (modulo demo-backup pre-existing TS2322) | ✓ |
| lint 0 errors (3 warnings preexistentes en otros archivos) | ✓ |
| L2 (PJ admin requiere rep, LSC 212 bis) | ✓ |
| L14 (cese conserva histórico, UPDATE no DELETE) | ✓ |
| L15-16 (CONSEJERO_COORDINADOR excluido de banner) | ✓ |
| L17 (VICESECRETARIO en CARGO_LABELS + CARGOS_CERTIFICANTES) | ✓ |
| `cargos_vigentes` / `cargos_cesados` cobertura tabla | ✓ |
| No `console.*` residuales | ✓ |
| No `any` types nuevos | ✓ |
| Imports todos utilizados | ✓ |
| Solo 1 fichero modificado (PersonaDetalle.tsx) | ✓ |

---

## Cross-verifications adicionales

### Firmas hooks/helpers (verificadas en `useCondicionesPersonaMutations.ts` y `cargo-validation.ts`)

- `CesarCargoInput` (líneas 98-102 de `useCondicionesPersonaMutations.ts`): `{ condicion_id: string; fecha_fin: string; razon?: string | null }` — el builder invoca con `condicion_id: cargoToCesar.id, fecha_fin: fechaFin, razon: razon || null` (línea 75-77). Coincide.
- `requiresRepresentative(person, tipo)` (líneas 130-136): firma `({ person_type: "PF" | "PJ" | null }, TipoCondicionCargo) => boolean` — builder invoca con `{ person_type: p.person_type }` y `c.tipo_condicion as TipoCondicionCargo`. Coincide.
- `CARGOS_PJ_REQUIERE_REPRESENTANTE` contiene `ADMIN_UNICO / ADMIN_SOLIDARIO / ADMIN_MANCOMUNADO / ADMIN_PJ / CONSEJERO`. SOCIO PJ NO está → banner correctamente NO se dispara para socios PJ (L1).
- `CARGOS_CERTIFICANTES` excluye `CONSEJERO_COORDINADOR` explícitamente (L15, fix `63a8639`).

### Modal a11y — verificación exhaustiva

| Atributo | Línea | Notas |
|---|---|---|
| `role="dialog"` | 459 | ✓ |
| `aria-modal="true"` | 460 | ✓ |
| `aria-labelledby="cesar-cargo-title"` | 461 | apunta a `<h2 id="cesar-cargo-title">` (477) — válido |
| `aria-describedby="cesar-cargo-desc"` | 462 | apunta a `<p id="cesar-cargo-desc">` (494) — válido |
| Escape cierra | 65 | `if (e.key === "Escape") closeCesarModal()` con cleanup en unmount |
| Overlay click cierra | 464-466 | `if (e.target === e.currentTarget) closeCesarModal()` — patrón correcto |
| Focus inicial | 63 | `fechaFinInputRef.current?.focus()` en `useEffect` |
| Botón "Cerrar" X | 489 | con `aria-label="Cerrar"` (icon-only) |
| Botón "Cesar" en filas | 294 | con `aria-label={`Cesar cargo ${cargoLabel}`}` |
| `aria-busy` en confirm | 540 | sincronizado con `cesarMutation.isPending` |
| `disabled` en confirm | 539 | bloquea durante isPending o fecha vacía |
| Reset estado tras close | 56 | `setRazon("")` (fechaFin se mantiene a hoy — aceptable) |

**Una observación:** el botón "Confirmar cese" valida `!fechaFin` pero permite vaciar la fecha si el usuario lo hace (en `<input type="date">` el navegador puede aceptar vacío). El builder dejó `disabled` controlado por ese estado. Correcto.

### Pruebas de lógica banner

Tres casos de prueba mentales:

1. **PF (Lucía Paredes), cargo SECRETARIO vigente** → `p.person_type === "PJ"` es `false` → banner no se muestra. ✓
2. **PJ (Cartera ARGA SLU) con cargo SOCIO, sin representante** → `requiresRepresentative({person_type:"PJ"}, "SOCIO")` → `CARGOS_PJ_REQUIERE_REPRESENTANTE.includes("SOCIO")` es `false` → `cargosAdminSinRep.length === 0` → banner no se muestra. ✓ (cubre L1)
3. **PJ con cargo ADMIN_UNICO vigente, sin representante** → `requiresRepresentative` devuelve `true` → `cargosAdminSinRep.length > 0` && `!p.representative` → banner se muestra con texto "LSC art. 212 bis" + lista cargos. ✓ (cubre L2)
4. **PJ con cargo CONSEJERO_COORDINADOR vigente, sin representante** → `CARGOS_PJ_REQUIERE_REPRESENTANTE.includes("CONSEJERO_COORDINADOR")` es `false` → banner no se muestra. ✓ (cubre L15)

---

## Recomendaciones (no bloqueantes)

1. **Tech-debt aparte:** flagged el `rounded-full` línea 130 (pre-existente) en un spawn-task para migrar a `style={{ borderRadius: 'var(--g-radius-full)' }}`. No es bloqueante; coherente con el resto del archivo migrar el avatar.
2. **Polish opcional:** el banner usa `--status-warning` que es gris. El skill define este token así por política, pero si LegalTech UX quiere reforzar visualmente que es bloqueante de cara a certificación, podría considerarse usar `--status-error` (rojo) en su lugar, ya que el banner indica que "no se podrá emitir certificación". No es necesario para aprobar.
3. **Bonus opcional Wave 5:** focus trap dentro del modal (Tab no debería salir del diálogo). Hoy no está implementado, pero no es requisito explícito del plan §D4.3 ni del checklist adversarial. Aceptable como mejora futura.

---

## Resumen ejecutivo

Wave 4 entrega los 4 D4.X con calidad de producción:
- 0 violaciones de tokens Garrigues introducidas (1 pre-existente, no del builder).
- Modal cumple WCAG 2.1 AA con 3 features bonus (Escape, focus inicial, overlay click).
- Banner aplica filtro subconjunto-de-vigentes correcto (no abusa de OR ni mezcla con SOCIO PJ).
- Cobertura legal L1/L2/L14/L15-16/L17 verificada cruzando con `cargo-validation.ts`.
- Typecheck verde (modulo error pre-existente en `demo-backup/reducer.ts` documentado).
- Lint 0 errors (3 warnings preexistentes ajenos).
- Builder respetó los hard guardrails: solo un archivo modificado, sin migraciones, sin schema.

**Listo para merge a `feature/personas-cargos-refactor`** y posterior consolidación a `main` en Wave 5.
