# /goal — Run nocturno autónomo y adversarial: refactorización UX Secretaría (v2, red-teameado)

> **Esto es un GOAL SPEC, no un comando.** En este setup NO existe `/goal` ni `/codex`; el mecanismo autónomo real es **`/multiagent`** (orquestación) + **Codex CLI** (`codex --approval-mode full-auto` vía `/dispatch`) en git worktrees + **`/sync`** (merge) + **ralph-loop** (iterar hasta condición de parada).
>
> **Lanzamiento (Claude Code como orquestador):**
> 1. Abre Claude Code en el repo y dile: *"Lee y ejecuta `docs/superpowers/plans/2026-06-20-goal-ux-overnight-adversarial.md` como goal del run nocturno. Tú implementas y haces el auto-review; el segundo revisor por tarea se despacha a Codex (`/dispatch`). ultrathink."*
> 2. El loop de "iterar tareas hasta parar" lo conduce la **ralph-loop** (o Claude Code repitiendo §4 hasta §5).
> 3. **Pensar en profundidad (ultrathink)** en la planificación de cada tarea y en cada revisión adversarial.
>
> **Estos guardarraíles obligan a TODOS los agentes**, incluido cualquier worker de Codex CLI: al despachar una tarea a Codex, **pega §3 (semáforo), la Regla de tests y §4.5 en su prompt**. Codex en `full-auto` puede hacer cualquier cosa: nunca lo despaches sin estos límites.
>
> Esta v2 incorpora un red-team del propio prompt (Codex no era invocable como `/codex`; conflicto con `mesa-control-ui-contract.test.ts:162`; blast radius con 34 worktrees; copy legal inventado; verificación visual ausente).

---

## 0. Misión y filosofía

Avanzar de forma autónoma la **refactorización UX del módulo Secretaría** (plan UX-0…UX-7), con **auto-verificación adversarial** y un **segundo ciclo de revisión independiente** por cada tarea, dejando el repositorio **siempre en verde** y un rastro auditable para revisión humana por la mañana.

**Expectativa realista (aceptar antes de empezar):** NO se espera "terminar toda la refactorización". Se espera **completar lo que es seguro automatizar sin supervisión** y **detenerse limpio** en los límites. **Calidad y seguridad > cantidad.** Mejor 6 tareas impecables + el resto documentado como bloqueado/diferido que 12 a medias o un árbol roto. Ante CUALQUIER duda: **para y documenta.**

## 1. Fuentes de verdad (leer antes de empezar, ultrathink)

1. `docs/superpowers/plans/2026-06-20-ux-redesign-secretaria-plan.md` — backlog UX-0…UX-7 (P0→P3). **Orden de trabajo.**
2. `docs/superpowers/reviews/2026-06-20-auditoria-brechas-ux-secretaria.md` — evidencia archivo:línea.
3. `docs/superpowers/reviews/2026-06-20-informe-ux-redesign-copy-legal.md` — **único copy legal aprobado**.
4. `CLAUDE.md` — reglas no negociables (tokens Garrigues, Supabase, ownership, HOLD, sección "No hacer").

UX-0.A–C ya está en `main` (commit `8a03486`). No rehacerlo.

## 2. Setup (una sola vez)

```bash
git fetch origin
git rev-parse --show-toplevel        # debe ser el repo principal, NO .claude/worktrees/* ni .codex/worktrees/*
git rev-parse HEAD; git rev-parse origin/main
```

- **Si `HEAD` ≠ `origin/main`:** registra ambos SHA en el log y **para** con aviso (no hagas merge/rebase automático). Si coinciden, **registra el SHA de partida** en el log.
- Crear rama: `git switch -c feature/ux-refactor-secretaria-overnight`.
- **Baseline de lint:** `bun run lint 2>&1 | tee /tmp/lint-baseline.txt`; anota el recuento de errores/warnings en el log (referencia conocida: ~15 errores `no-explicit-any` en GRC/AIMS, ajenos a Secretaría).
- **Pre-flight del segundo revisor (Codex):** comprueba si **Codex CLI** (`command -v codex`) y `/dispatch` están disponibles. **Si NO lo están, no simules la revisión**: usa el fallback de §4.5 y registra `Codex: N/D` en el log para todo el run.
- Crear el log `docs/superpowers/plans/2026-06-20-overnight-run-log.md` (tabla: Tarea | Estado | Commit | Gates | Codex/Revisor | Strings legales | Notas/decisión) y commitearlo como primer commit.
- **NUNCA `git push`.** **NUNCA trabajar sobre `main`.** El humano revisa y abre PR.

## 3. Alcance — semáforo (no desviarse)

### 🟢 VERDE — automatizable de noche (en este orden)
1. **UX-0.D** renombrados de sidebar (`navigation.ts`, ambas taxonomías) — copy. **Antes de renombrar, `grep -rn "<texto viejo>" e2e/`**; si un spec lo matchea por texto, actualízalo en el mismo commit a `[data-sidebar-item]`/nuevo texto y lístalo (ver I-E2E).
2. **UX-0.E** términos transversales ("artefacto"→"Documento"; `RmStatusChip` "Pendiente RM"→"Pendiente de referencia registral…") — copy.
3. **UX-0.F** alinear evidencia en `GenerarDocumentoStepper` con `EvidenceStatusBadge`/disclaimer. **⚠️ Romperá `src/test/secretaria/mesa-control-ui-contract.test.ts` en la aserción `expect(generar).toContain("Evidencia operativa")` (línea ~162, NO 157-158).** Actualízala para expresar la NUEVA intención (el stepper usa el descriptor de `EvidenceStatusBadge`/disclaimer "Entorno de validación funcional"), **conservando o reforzando** la aserción negativa que impide rotular evidencia demo como cualificada. **Prohibido borrar la aserción sin sustituirla por checks equivalentes o más estrictos.** Si no puedes, la tarea es 🟡.
4. **UX-2.B / UX-3.B / UX-5.A / UX-6.A / UX-7.C** copy, empty states (patrón "qué pasa + por qué importa + qué puedo hacer"), avisos y CTAs marcados como superficie/copy. Reutiliza `statusLabel`, `legalEffectLabel`, `EvidenceStatusBadge`.
5. **UX-2.A** bloque "Documentos pendientes" + CTA "Revisar documentos" en la Mesa (reusar query de `DocumentosPendientesRevision`).
6. **UX-7.B** cohortes/estado "activa con metadatos incompletos"/filtros en `Plantillas.tsx` (datos ya presentes).
7. **UX-7.A — SOLO la parte de UI** (chip imperativa/dispositiva, "¿Por qué esta regla?", aviso de snapshot desfasado) **y solo si** el valor imperativa/dispositiva **ya existe** en una fuente verificable (rule pack sembrado o constante ya presente en `normative-framework.ts`). **Determinar si una norma es imperativa o dispositiva es criterio legal: si el campo no existe ya con valor verificado, NO lo inventes en TS → 🟡.** El aviso de `profile_hash` desfasado (comparar dos valores ya presentes) sí es 🟢.

### 🟡 ÁMBAR — NO codificar de noche; abrir entrada en el log con la pregunta/criterio concreto
- **UX-4.A–C (wizard de certificaciones) y UX-3.A (informes por fuente canónica).** Son `estructural` mayor, **requieren verificación visual (no hay navegador) y probable copy nuevo**. De noche, permitido **solo andamiaje no destructivo**: extraer subcomponentes, preparar esqueleto de pasos **detrás de un flag o ruta no enlazada**, y **tests de render** — **sin** sustituir el flujo existente, sin cambiar RPCs, sin tocar `source_ref`. La conversión real se hace con humano presente.
- **UX-1.A** "Reuniones"→"Sesiones", "Procesos"→"Calendario societario" (validación legal pendiente).
- **UX-1.B** crear área de navegación "Expedientes" (decisión de IA).
- Unir "Registro público" + "Libros y registros sociales" (choca con decisión 2026-05-12).
- **Cualquier nuevo string de copy legal/efecto jurídico/evidencia** (incluidos labels de pasos de wizard, avisos de censo/voto, textos de confirmación) que NO esté **literalmente** en el informe aprobado.

### 🔴 ROJO — prohibido sin supervisión (diferir y documentar)
- **Cualquier cambio de BD/esquema/RLS/RPC/storage/seed/SQL.** No `supabase db push`, no `apply_migration`, no escribir SQL. `db:check-target` aquí solo se usaría para **abortar**, nunca para habilitar escrituras.
- Escrituras en `governance_module_events`/`governance_module_links`; promover evidence/legal-hold (`000049` HOLD); mezclar `ai_*`/`aims_*`/`grc_*`.
- **No instalar/actualizar/eliminar dependencias** ni editar `package.json`, `bun.lockb`/`bun.lock`. Si una tarea "necesita" una librería → 🟡.
- **No modificar configuración** de build/test/lint/types: `vite.config.*`, `tsconfig*.json`, `eslint.config.js`, setup de vitest, `tailwind.config.*`, `postcss.config.*`, `components.json`. Ajustarlas para pasar un gate es **gaming**.
- **No tocar `playwright.config.ts` ni `e2e/*`** salvo actualizar un **selector estable** que renombres en esta tarea; jamás `.skip`/timeouts/baseURL.
- **No leer, mover, copiar, imprimir en logs ni commitear `.env`/`.env.*`/`supabase/.temp/*` ni secreto alguno** (`OPENAI_API_KEY`, anon keys, tokens). El `.env` de la raíz contiene claves reales.
- **No comandos destructivos:** `rm -rf`, `git clean -fdx`, `git restore .`/`git checkout .` global, `git stash drop` de stashes ajenos, `git push`, `git rebase`/`reset --hard` sobre `main`, force-push, borrado de ramas ajenas. **Worktrees:** puedes crear los del propio run (p. ej. para despachar a Codex) y limpiarlos al terminar; **nunca** `git worktree remove`/`prune` de los ~34 worktrees ajenos ya existentes.
- Tocar el nombre real del cliente; colores Tailwind nativos o hex; `var(--g-status-*)`/`--g-brand` mal escritos.

## 4. Bucle por tarea (repetir hasta agotar 🟢 o condición de parada)

**4.1 Plan (ultrathink).** Lee la tarea (plan + auditoría). Escribe en el log: (a) **lista exacta de archivos** a tocar — trabajarás SOLO en esos; (b) enfoque y criterios de aceptación; (c) **enumera los strings visibles** que necesitarás y **localiza cada uno en el informe legal aprobado** (cita §/línea). **Si algún string necesario no está literalmente en el informe → la parte sin copy aprobado es 🟡** (placeholder neutro NO jurídico o difiere). **Prohibido redactar/parafrasear/"mejorar" microcopy legal o disclaimers.** Si al planificar la tarea resulta 🟡/🔴 → regístrala y pasa a la siguiente.

**4.2 Implementar** respetando tokens Garrigues (`var(--g-*)`/`var(--status-*)`, nunca Tailwind nativo/hex) y reutilizando componentes existentes (`EvidenceStatusBadge`, `statusLabel`, `legalEffectLabel`, `Capa3Form`). Para UI nueva, **añade un test de render** (React Testing Library) que monte el componente y asierte los textos/CTA clave del criterio de aceptación.

**4.3 Auto-review adversarial (ultrathink).** Relee tu diff como revisor hostil:
- ¿Color Tailwind nativo/hex/`style` de color con clase equivalente? ¿token mal escrito?
- ¿Estado técnico crudo (usar `statusLabel`)? ¿Evidencia demo presentada como cualificada en alguna superficie nueva?
- ¿Copy fuera del informe legal? ¿Términos a evitar (§7.1)?
- ¿Accesibilidad: `aria-label` en botones icono, `forwardRef`, focus visible, labels?
- ¿Renombré nav? → `grep -rn "<texto>" e2e/` y actualiza/lista specs afectados.
- ¿Rompí un contrato `src/test/secretaria/*` o un selector E2E? (ver Regla de tests).
- ¿Introduje `any`, helper de un solo uso, toqué Fase 1/`sii.*`?
Corrige todo antes de seguir.

**4.4 Gates (verdes obligatorio).**
```bash
bun run typecheck && bun run build && bun run test
bun run lint   # comparar contra /tmp/lint-baseline.txt: 0 errores NUEVOS. Los preexistentes ajenos a tu diff NO te bloquean ni los arregles.
```
Máximo **3 intentos** de arreglo **del código** (no del test, ver Regla de tests). Si no quedan verdes → **revierte solo esta tarea** así: como ya commiteaste la anterior, el working tree solo tiene los cambios de ESTA tarea → `git stash --include-untracked` y luego `git stash drop` tras confirmar con `git status` que el árbol coincide con el último commit verde y **no quedan archivos nuevos huérfanos**. **Nunca `git restore .`/`git checkout .`/`git clean`.** Marca la tarea `BLOQUEADA` con el error en el log y continúa. La rama SIEMPRE queda verde.

**4.5 Segundo revisor independiente (Codex CLI o fallback).** Con Codex disponible (pre-flight §2): **despacha el diff de la tarea a Codex como REVISIÓN, no como edición** — vía `/dispatch` (o `codex` en un worktree del run) con un prompt hostil de solo-lectura (corrección, fidelidad de copy legal, tokens, accesibilidad, regresiones, seguridad) **pegando §3 + la Regla de tests**. Codex **reporta**; **las correcciones las aplica Claude Code en la rama feature** (una sola fuente de edición — no dejes a Codex editar en paralelo de noche). **Si Codex NO está disponible:** lanza un **subagente revisor** (`Agent`/`Task`) hostil sobre el diff; si tampoco, haz un **segundo auto-review desde cero** releyendo el diff sin tu razonamiento previo. **Nunca escribas que Codex revisó si no se ejecutó** — registra el revisor real usado. Hallazgos = **bloqueantes**: corrige los válidos y re-corre gates; si discrepas, justifícalo en el log.

**4.6 Commit** (solo si gates verdes y revisión resuelta): `git commit -m "feat(secretaria): <UX-x.y descripción> (run nocturno)"`. Una tarea = un commit, descriptivo.

**4.7 Log:** fila con tarea, estado (HECHA/PARCIAL/BLOQUEADA/DIFERIDA), hash, gates, revisor usado + hallazgos y resolución, strings legales verificados, criterios de aceptación **no** verificables automáticamente (para validación visual humana), y decisiones pendientes. Commitea el log. Siguiente tarea.

## Regla de tests (no negociable)
- Solo se permite **modificar** un test para reflejar **copy aprobado por Legal** o un **selector estable** renombrado en esta misma tarea.
- **Prohibido:** borrar/relajar aserciones, `toContain`→`toMatch` laxo, añadir `.skip`/`.only`, comentar bloques, o cambiar el valor esperado para "ponerte en verde" sin entender por qué cambió.
- Si un test falla y **no** es por copy/selector de esta tarea → **es regresión de tu código**: arregla el código, no el test.
- Cada test tocado debe seguir expresando la intención original **o una más estricta**; anota línea y porqué.
- **Nunca** debilites `mesa-control-ui-contract.test.ts`, `src/test/secretaria/*` ni `src/test/schema/*`.

## 5. Condiciones de parada (para y entrega; no fuerces)
Detente cuando ocurra lo primero de: se agotan las 🟢; **2 tareas 🟢 bloqueadas seguidas** por gates; **≥3 bloqueadas en total** (aunque no consecutivas); **tasa de éxito < ~50%** tras 4+ intentadas; una tarea exigiría algo 🔴; ambigüedad de copy legal/criterio irresoluble desde las fuentes; vas corto de contexto o repites errores. **Prefiere parar con la rama verde** a degradar. En toda parada: rama **verde y commiteada**, escribe el handoff, **no push**.

## 6. Entregables matutinos
1. Rama `feature/ux-refactor-secretaria-overnight` con **commits por tarea**, sin push.
2. Log completo + sección final "Resumen del run" (HECHAS / PARCIALES / BLOQUEADAS / DECISIONES PENDIENTES) y, por tarea, `git show --stat <hash>` (archivos ±líneas) + criterios no verificados automáticamente.
3. **Gates verdes** en el último commit (typecheck+build+test; lint sin errores nuevos).
4. Lista priorizada de **decisiones que el humano debe tomar** (los 🟡) para desbloquear.
5. Sección "Cómo revisar": ver todo el diff `git diff main...feature/ux-refactor-secretaria-overnight`; abrir PR `gh pr create --base main --head feature/ux-refactor-secretaria-overnight --fill` (o desde web); **revertir todo el run** `git switch main && git branch -D feature/ux-refactor-secretaria-overnight` (sin push, descartar la rama elimina el run).

## 7. Definición de "hecho" por tarea
- [ ] Cumple el criterio de aceptación del plan.
- [ ] 0 violaciones de tokens Garrigues; copy exclusivamente del informe legal aprobado (strings localizados en §4.1).
- [ ] UI nueva con **test de render** que asierta los textos/CTA clave; criterios no verificables anotados para validación humana.
- [ ] `typecheck`+`build`+`test` verdes; `lint` sin errores nuevos vs baseline.
- [ ] Auto-review adversarial + segundo revisor (Codex o fallback) pasados; hallazgos resueltos/justificados.
- [ ] Tests/selectores afectados actualizados (sin debilitar); specs E2E afectados listados para el humano.
- [ ] Commit atómico + fila en el log.

## 8. Tono y límites
Eres un ingeniero senior trabajando solo de madrugada sobre un prototipo real en demo. Conservador: ante la duda, **para y documenta**. No inventes datos, copy legal ni esquema. No declares cualificada la evidencia de entorno de validación funcional. No toques lo que no entiendas. Objetivo: por la mañana, **avance real, verde y revisable** — nunca un árbol roto ni cambios que haya que deshacer.
