# 02 · Instrucciones de trabajo

> **Cabecera viva.** Última revisión: 2026-06-13. Estas son las instrucciones **estratégicas** de trabajo. Las instrucciones **operativas exhaustivas** (entorno Supabase, comandos, esquema, sprints) viven en `/CLAUDE.md` y `/AGENTS.md` y prevalecen sobre cualquier resumen de aquí en caso de conflicto técnico.
> Relacionados: `→ 00` índice, `→ 03` estrategia, `→ 04` charter legal.

---

## Principios rectores (en orden de prioridad)

1. **Rigor legal por encima de la velocidad.** Es una herramienta de procesos corporativos críticos y legales. Ante la duda entre «rápido» y «jurídicamente correcto», gana lo correcto. No inventar normativa, plazos, mayorías ni efectos. Lo volátil se marca como tal (`→ 04`).
2. **Honestidad de estado.** Demo, prototipo, conectado, read-only, HOLD y productivo **nunca** se difuminan. Si algo no está conectado o no es evidencia final, decirlo explícitamente en UI, copy y respuesta.
3. **Composición, no absorción.** Cada módulo es dueño de sus escrituras. La consola compone, enruta y muestra readiness; no muta verdad ajena. Respetar la tabla de ownership (`→ 03`).
4. **Trazabilidad.** Toda cifra, regla o estado cita su fuente. La evidencia es trazable (audit WORM, hash encadenado, QTSP). No declarar finalidad probatoria sin gate aprobado.
5. **Continuidad.** Las decisiones estratégicas se graban en `docs/context/`; las operativas en `CLAUDE.md`/`specs`/`plans`. No dejar conocimiento crítico solo en el chat.

---

## Cómo arrancar una conversación nueva

1. Leer `docs/context/` en el orden de `→ 00`.
2. Si vas a tocar **código**: leer la sección relevante de `/CLAUDE.md` (ownership del carril, reglas UX Garrigues, estado de sprints) **antes** de editar.
3. Si vas a tocar **Supabase**: ejecutar `bun run db:check-target` y confirmar `governance_OS` **antes** de nada. Sin esa confirmación, no se toca la base de datos.
4. Si la tarea es de **negocio/mercado/producto**: usar `→ 05` como base y citar fuentes web actuales (el mercado cambia; verificar fechas).
5. Si la tarea es **jurídica**: usar `→ 04`; marcar lo que requiera verificación de vigencia y, cuando proceda, escalar a criterio del despacho en lugar de improvisar derecho.

---

## Guardrails no negociables (resumen — detalle en `/CLAUDE.md`)

**Datos y cliente**
- Nunca usar el nombre real del cliente. Todo es **Grupo ARGA Seguros** (pseudónimo) y coherente con su estructura corporativa demo.
- Datos demo plausibles y consistentes; nada de cifras inventadas presentadas como reales.

**Supabase / datos**
- `bun run db:check-target` → `governance_OS` antes de cualquier trabajo de BD.
- Cambios forward-only, con espejo en `supabase/migrations/` y verificación.
- No escribir en `governance_module_events` ni `governance_module_links` (los cross-module son handoffs read-only por navegación).
- No declarar evidence/legal hold como productivo mientras la migración correspondiente esté en HOLD.
- No mezclar `ai_*` legacy con `aims_*`, ni GRC legacy con `grc_*`, sin contrato aprobado.

**UX Garrigues (módulos `/secretaria/*`, `/grc/*`, `/ai-governance/*`)**
- Solo tokens `var(--g-*)`, `var(--status-*)` y sidebar HSL. Prohibido hex directo, colores Tailwind nativos (`text-white`, `bg-gray-*`, `bg-amber-*`, `bg-green-*`) y nombres CSS de color.
- Accesibilidad WCAG 2.1 AA: `aria-label` en botones icon-only, labels visibles, focus visible.

**TypeScript**
- Proyecto en modo relajado (`noImplicitAny: false`, `strictNullChecks: false`). No endurecer tipos donde no existían. Gate real de tipos: `bun run typecheck` (`tsc -b`).

**Gestor de paquetes:** `bun` (no npm/yarn).

---

## Definición de «hecho» (Definition of Done)

Una tarea de código no está hecha hasta que:

- `bun run db:check-target` pasa contra `governance_OS` (si tocó BD).
- `bun test` en verde (sin romper el baseline conocido).
- `bun run typecheck` en verde (`tsc -b`).
- `bun run lint` sin errores nuevos (warnings conocidos tolerados).
- `bun run build` en verde.
- Cambio de BD reflejado en `supabase/migrations/` y verificado.
- Decisión relevante registrada en el doc adecuado (`docs/context/` si es estratégica; `CLAUDE.md`/`specs`/`plans` si es operativa).

Para trabajo de alto riesgo (esquema, motor de reglas, evidencia), añadir verificación adversarial (revisión por subagente, probes de RPC, e2e golden-path).

---

## Cómo decidir entre velocidad y profundidad

- **Secretaría** (camino a producto real, `→ 03`): subir el listón. Profundidad jurídica, flujos reales, evidencia de verdad. Aquí el rigor manda.
- **AIMS 360 y GRC Compass** (prototipos): conectados y navegables, pero **no** sobre-ingeniería. No invertir en profundidad productiva hasta que haya paquete product-complete aprobado.
- **Consola TGMS:** componer y enrutar; no construir lógica de dominio que pertenezca a un módulo.

Regla práctica: **si la decisión afecta a validez jurídica o a evidencia, ve despacio y cita fuente. Si es UX o demo de un prototipo, ve ágil pero honesto de estado.**

---

## Antipatrones (no hacer)

- Presentar un prototipo como funcionalidad productiva.
- Codificar derecho «de memoria» sin marcar incertidumbre ni citar norma.
- Crear helpers/abstracciones para un único caso de uso.
- Abrir worktrees o repos paralelos sin autorización (worktree único operativo).
- Mover lógica de dominio de un módulo a la consola o a otro módulo.
- Dejar una decisión estratégica solo en el chat sin grabarla en `docs/context/`.
