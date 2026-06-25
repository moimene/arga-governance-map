# Run log — Refactorización UX Secretaría (adversarial)

**Goal spec:** `docs/superpowers/plans/2026-06-20-goal-ux-overnight-adversarial.md`
**Plan backlog:** `docs/superpowers/plans/2026-06-20-ux-redesign-secretaria-plan.md`
**Copy aprobado (única fuente):** `docs/superpowers/reviews/2026-06-20-informe-ux-redesign-copy-legal.md`
**Auditoría (evidencia archivo:línea):** `docs/superpowers/reviews/2026-06-20-auditoria-brechas-ux-secretaria.md`

## Contexto del run

- **Fecha de ejecución:** 2026-06-25
- **Modo:** interactivo (orquestador = Claude Code), no nocturno autónomo. Adaptación: el humano está presente; se surfacean los 🟡 al final en vez de solo loggearlos. Se conservan los guardarraíles del spec (rama feature, sin push, gates verdes, copy solo del informe).
- **Rama:** `feature/ux-refactor-secretaria-overnight`
- **SHA de partida (HEAD):** `060fe9b3e7457ba4ae8665cc6f142eabce220695`
- **origin/main:** `9d7480ad969db14e358e1e94ae3e7f84dd774bf8` — local `main` está **3 commits por delante** (ancestro limpio, no divergencia). No es el escenario de "árbol obsoleto → abortar"; se registra y se continúa.
- **Baseline de lint:** `/tmp/lint-baseline.txt` → **15 errores** (`@typescript-eslint/no-explicit-any`, cluster GRC/AIMS ajeno a Secretaría) + 2 warnings. Gate: **0 errores nuevos**; los preexistentes no bloquean ni se arreglan.
- **Segundo revisor (Codex CLI):** **disponible** (`~/.nvm/versions/node/v22.22.2/bin/codex`). Revisión adversarial real, no fallback. Codex **reporta**; Claude Code **aplica** (única fuente de edición). Se ejecuta por clúster + revisión final de todo el diff.

## Semáforo de alcance (resumen)

- **🟢 (este run):** UX-0.D, UX-0.E, UX-0.F, UX-2.A, UX-2.B, UX-3.B, UX-5.A, UX-6.A, UX-7.C, UX-7.B, UX-7.A (solo aviso de snapshot desfasado).
- **🟡 (decisión humana, documentado, NO codificado):** chip imperativa/dispositiva (UX-7.A: campo nuevo = criterio legal), UX-4.A–C (wizard certs), UX-3.A (informes por fuente canónica), UX-1.A/B (marca/Expedientes), unir Registro+Libros.
- **🔴 (prohibido):** BD/esquema/RLS/RPC/storage/seed/SQL, deps/`package.json`, config build/test/lint, `e2e/*` salvo selector estable renombrado, `.env`/secretos.

## Tabla de tareas

| Tarea | Estado | Commit | Gates | Revisor / hallazgos | Strings legales (§ informe) | Notas / decisión |
|---|---|---|---|---|---|---|
| Setup (run-log) | HECHA | `b073a36` | n/a | n/a | n/a | Rama + baseline + log |
| **T1 · UX-0.D** renombrados sidebar (8/9) | HECHA | `1f4d0ae` | tc=0 · test 2100/0 · lint=baseline(15) · build=0 | Codex pendiente (clúster UX-0) | §5.2 (8 labels literales) | 8 renames en **ambas** taxonomías. E2E actualizados: `e2e/12` (4 labels NAV_ITEMS), `e2e/33` (Certificaciones de acuerdos ×2, Presentaciones registrales). **🟡 DEFERIDO:** "Tramitador registral"→"Registro" — conflicto directo con CLAUDE.md 2026-05-12 ("no usar 'Registro' en código/copies para el Registro Mercantil"). Requiere decisión humana. H1 de páginas intacto. |
| **T2 · UX-0.E** términos transversales | HECHA | `479f89c` | tc=0 · test 2100/0 · lint=baseline(15) | Codex pendiente (clúster UX-0) | §7.1 (artefacto→Documento; Pendiente de referencia registral), §6.7 (tooltip) | `RmStatusChip`: chip "Pendiente RM"→"Pendiente de referencia registral" + tooltip `title` con aviso §6.7 (split por límite visual del chip 11px). `artefacto(s)`→`documento(s)` en `DocumentosPendientesRevision` (×3) e `InformesPreceptivos` (subcopy). Contrato `personas-cargos-sprint2-ui-contract.test.ts` actualizado a copy aprobado **y reforzado** (`not.toMatch /Pendiente RM/` + `toMatch /Puede limitar.../`). "Artefacto DOCX" técnico en otros archivos NO tocado (§7.1 permite contexto técnico). |
| **T3 · UX-0.F** evidencia GenerarDocumentoStepper | HECHA | _este commit_ | tc=0 · test 2100/0 · lint=baseline(15) · build=0 | Codex pendiente (clúster UX-0) | §7.3 (Entorno de validación funcional), §8.3 (archivado con trazabilidad) | Local `evidenceStatusLabel` delega a `evidenceStatusDescriptor(...).label` (mata "Evidencia operativa"/"Evidencia no informada"). Banner de archivado → §8.3 "Documento archivado con trazabilidad. Conservamos su huella y versión." Chip verde engañoso "Evidencia demo" → `<EvidenceStatusBadge>` (tono warning + disclaimer §7.3). Contrato `mesa-control-ui-contract.test.ts:~162`: `toContain("Evidencia operativa")` → **`not.toContain("Evidencia operativa")` + `not.toMatch(/evidencia demo operativa/i)` + `toContain("EvidenceStatusBadge")`** (negativa conservada y reforzada, nueva positiva). |

### 🟡 Decisiones para el humano (acumulado)

- **UX-0.D / "Registro":** §5.2 aprueba renombrar el ítem de sidebar "Tramitador registral"→"Registro", pero CLAUDE.md (decisión 2026-05-12) prohíbe usar "Registro" en copies para referirse al Registro Mercantil. Conflicto entre dos fuentes de verdad. Implementados los otros 8 renames; este queda pendiente de que decidas cuál prevalece. Si se aprueba, el cambio es trivial (2 ítems en `navigation.ts` + `e2e/03:26`, `e2e/12:22`, `e2e/33:61`).

## Resumen del run

_(se completa al cerrar)_
