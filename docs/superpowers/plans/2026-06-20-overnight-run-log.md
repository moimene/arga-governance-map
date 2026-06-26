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
| **T1 · UX-0.D** renombrados sidebar (8/9) | HECHA | `1f4d0ae` | tc=0 · test 2100/0 · lint=baseline(15) · build=0 | Codex ✓ (NO-APTO → corregido) | §5.2 (8 labels literales) | 8 renames en **ambas** taxonomías. E2E actualizados: `e2e/12` (4 labels NAV_ITEMS), `e2e/33` (Certificaciones de acuerdos ×2, Presentaciones registrales). **🟡 DEFERIDO:** "Tramitador registral"→"Registro" — conflicto directo con CLAUDE.md 2026-05-12 ("no usar 'Registro' en código/copies para el Registro Mercantil"). Requiere decisión humana. H1 de páginas intacto. |
| **T2 · UX-0.E** términos transversales | HECHA | `479f89c` | tc=0 · test 2100/0 · lint=baseline(15) | Codex ✓ (NO-APTO → corregido) | §7.1 (artefacto→Documento; Pendiente de referencia registral), §6.7 (tooltip) | `RmStatusChip`: chip "Pendiente RM"→"Pendiente de referencia registral" + tooltip `title` con aviso §6.7 (split por límite visual del chip 11px). `artefacto(s)`→`documento(s)` en `DocumentosPendientesRevision` (×3) e `InformesPreceptivos` (subcopy). Contrato `personas-cargos-sprint2-ui-contract.test.ts` actualizado a copy aprobado **y reforzado** (`not.toMatch /Pendiente RM/` + `toMatch /Puede limitar.../`). "Artefacto DOCX" técnico en otros archivos NO tocado (§7.1 permite contexto técnico). |
| **T3 · UX-0.F** evidencia GenerarDocumentoStepper | HECHA | `772f198` | tc=0 · test 2100/0 · lint=baseline(15) · build=0 | Codex ✓ (NO-APTO → corregido en `17ec3b7`) | §7.3 (Entorno de validación funcional), §8.3 (archivado con trazabilidad) | Local `evidenceStatusLabel` delega a `evidenceStatusDescriptor(...).label` (mata "Evidencia operativa"/"Evidencia no informada"). Banner de archivado → §8.3 "Documento archivado con trazabilidad. Conservamos su huella y versión." Chip verde engañoso "Evidencia demo" → `<EvidenceStatusBadge>` (tono warning + disclaimer §7.3). Contrato `mesa-control-ui-contract.test.ts:~162`: `toContain("Evidencia operativa")` → **`not.toContain("Evidencia operativa")` + `not.toMatch(/evidencia demo operativa/i)` + `toContain("EvidenceStatusBadge")`** (negativa conservada y reforzada, nueva positiva). |
| **T5 · UX-2.B** Mesa copy (H1/subcopy/empty) | HECHA | `5cc1ac3` | tc=0 · test 2100/0 · lint=baseline(15) | Codex ✓ (NO-APTO → corregido) | §9.2 (H1 "Mesa de Secretaría", subcopy), §6.1 (empty "No hay acciones urgentes…"), §5.2 (sidebar "Mesa") | H1 "Mesa de trabajo del secretario"→"Mesa de Secretaría"; subcopy §9.2; "Prioridad ahora"→"Requiere tu atención" (§6.1); `attentionHeadline(0)`→"No hay acciones urgentes para esta sociedad." (§9.2); sidebar "Dashboard"→"Mesa" (ambas taxonomías) [resuelve Codex #3]. E2E: `e2e/12` (label+heading+sección), `e2e/30:5`, `e2e/21:44`. **Nota humano:** la subcopy §9.2 dice "de esta sociedad"; en modo grupo el `scopeLine` aclara "Vista de grupo", pero la frase asume sociedad (matiz aceptado, copy aprobado literal). |
| **T4 · UX-2.A** bloque "Documentos pendientes" + CTA | HECHA | `6bb9f13` | tc=0 · test 2100/0 · lint=baseline(17) · build=0 | Codex ✓ (NO-APTO → corregido) | §6.1 (bloque), §9.2 (CTA "Revisar documentos"), §8.1 (loading), §6.5 (empty + helper) | Nueva sección Mesa que lista documentos en revisión (reusa `useSecretariaDocumentArtifacts` + `REVIEWABLE_STATUSES`/`KIND_LABEL`); CTA "Revisar documentos" en accesos y en el header del bloque → `/secretaria/documentos/pendientes-revision`. **Refactor:** `REVIEWABLE_STATUSES`+`KIND_LABEL` movidos de la página a `lib/secretaria/document-artifact-labels.ts` (evita warning `react-refresh/only-export-components` y acoplamiento de chunks). |

### Codex — revisión adversarial clúster UX-0 (T1+T2+T3)

`codex exec -s read-only` (codex-cli 0.130.0) sobre `git diff 060fe9b..HEAD`. Veredicto inicial: **NO-APTO**, 8 hallazgos. Resolución (Claude aplica, única fuente de edición):

| # | Sev | Hallazgo | Resolución |
|---|---|---|---|
| 1 | BLOQUEANTE | `e2e/33:95` esperaba botón "Presentaciones registrales" pero la pestaña-filtro de `TramitadorLista` (no sidebar) sigue siendo "Presentaciones" → rompía E2E | **CORREGIDO**: revertido a "Presentaciones" (la pestaña-filtro de página no se renombra; §5.2 solo renombra el item de sidebar, que queda en `:93`). Bug real introducido por mí. |
| 2 | BLOQUEANTE | Contrato `mesa-control-ui-contract` solo asertaba el string "EvidenceStatusBadge", no que el usuario vea el copy §7.3 | **CORREGIDO/REFORZADO**: añadidas aserciones sobre `evidence-status-labels.ts` ("Entorno de validación funcional" + "sin eficacia jurídica cualificada productiva"); la cadena stepper→badge→descriptor→copy queda verificada. |
| 4 | MAYOR | `DocumentosPendientesRevision:114` copy no literal | **CORREGIDO**: → §8.2 literal "Esta función requiere la migración documental de informes y certificaciones." |
| 7 | MAYOR | `InformesPreceptivos:80` subcopy no literal | **CORREGIDO**: → §6.3 literal "Prepara o anexa documentos exigibles por materia y vínculos al expediente correspondiente." |
| 8 | MAYOR | Aviso §6.7 solo en `title` (a11y débil teclado/táctil) | **CORREGIDO**: chip = solo el término aprobado §7.1 (texto visible accesible); el aviso §6.7 se difiere a **T8 (UX-6.A)** como elemento **visible** en la sección de autoridad. Test ajustado. |
| 3 | MAYOR | Faltan "Dashboard"→"Mesa" y "Procesos"→"Calendario societario" (§5.2) | **JUSTIFICADO/DIFERIDO**: no son los 9 de UX-0.D. "Dashboard"→"Mesa" se hará en **T5 (UX-2.B)** junto al H1 §9.2. "Procesos"→"Calendario societario" es **🟡 UX-1.A** (validación legal pendiente + deuda de selector estable `[data-sidebar-item="Procesos"]`). |
| 5 | MAYOR | "Total documentos" no literal | **JUSTIFICADO/MANTENIDO**: es un label de conteo neutro (no copy legal/efecto); §7.1 autoriza "documento"; el informe no prescribe labels de métrica. |
| 6 | MAYOR | Permiso "consultar documentos y hashes…" no literal + "hashes" visible | **DIFERIDO a T6 (UX-3.B)**: la copy de Revisión documental se alinea allí con §6.5/§8.2 ("Huella de fuente" §7.1, mensaje de permisos §8.2). |

Gates tras fixes: tc=0 · contract 21/0 · test 2100/0 · lint=baseline(15). Commit de fixes: _este commit_.

| **T6 · UX-3.B** Revisión documental copy | HECHA | `fba44e4` (+fixes _este commit_) | tc=0 · test 2100/0 · lint=baseline(17) | Codex ✓ (NO-APTO → corregido) | §8.3 (toasts), §9.5 (H1 "Revisión documental"), §6.5 (subcopy/secciones/tooltip), §8.5 (empties 3-partes) | Toasts de trazabilidad por acción (§8.3 APPROVED/ARCHIVED/SUPERSEDED, const `REVIEW_SUCCESS_TOAST`); H1→"Revisión documental"; subcopy §6.5 (contrato `mesa-control-ui-contract:160` actualizado); secciones "Pendientes de revisión"/"Documentos cerrados" (§6.5); empties 3-partes §8.5; tooltip §6.5 en botón "Marcar sustituido" (nuevo prop `title` en `ActionButton`). **Auto-gate cazó regresión**: cambiar la copy de permisos a §8.2 rompió `keeps auditor/compliance flows read-only` (aserta "puede consultar documentos y hashes", con par en la página de certs) → **revertido**; alineación §8.2 de permisos diferida a follow-up consistente (ambas páginas + ambos tests). |

### Codex — revisión adversarial clúster Mesa (T5+T4)

`codex exec -s read-only` sobre `git diff 17ec3b7..HEAD`. Veredicto inicial: **NO-APTO**, 7 hallazgos. Resolución:

| # | Sev | Hallazgo | Resolución |
|---|---|---|---|
| 1 | BLOQUEANTE | El bloque "Documentos pendientes" usa `useSecretariaDocumentArtifacts()` sin scope de sociedad → en modo sociedad podría listar documentos de otras sociedades | **JUSTIFICADO + 🟡**: la cola documental es **tenant-wide por diseño existente** (la página `DocumentosPendientesRevision` también es tenant-wide; los `secretaria_document_artifacts` **no tienen `entity_id`**). El bloque refleja fielmente esa cola y enlaza a ella; su copy no afirma scope de sociedad. Filtrar por entidad exige cambio de esquema/joins = 🔴 (no permitido). Documentado como gap de modelo de datos para el humano. |
| 2 | MAYOR | Copy "de/para esta sociedad" también en modo grupo | **CORREGIDO**: subcopy y `attentionHeadline` ahora son scope-aware (sociedad → §9.2 literal; grupo → variante neutra "del grupo"/"en el grupo", copy de guía no jurídica). |
| 3 | MAYOR | El bloque quedó **debajo** del panel técnico plegado; §6.1 lo pone antes | **CORREGIDO**: bloque movido **encima** del `<details>` técnico (operativo sobre lo avanzado). |
| 4 | MAYOR | Si el fetch documental falla, el bloque oculta el error y muestra empty | **CORREGIDO**: se destructura `error: docsError` y se muestra el mensaje §8.2 de migración pendiente, no el empty. |
| 5 | MENOR | `KIND_LABEL[kind] ?? kind` expone claves técnicas crudas | **CORREGIDO**: helper central `artifactKindLabel()` con fallback no técnico ("Documento"); usado en Mesa **y** en la página. |
| 6 | MENOR | Botones nuevos sin foco Garrigues | **CORREGIDO**: `focus-visible:ring-2 ring-[var(--g-brand-3308)]` en CTA y filas. |
| 7 | MENOR | Literalidad de tildes (informe sin tildes) | **DESESTIMADO/JUSTIFICADO**: el informe está sin tildes por artefacto de codificación; todo el módulo usa ortografía correcta. Igualar la falta de tildes haría la UI agramatical. |

Gates tras fixes: tc=0 · test 2100/0 · lint=baseline(17) · build=0.

| **T7 · UX-5.A** Expediente empties + tecnicismos | HECHA | _este commit_ | tc=0 · test 2100/0 · lint=baseline(17) | Codex pendiente (clúster Expediente/Datos) | §9.6 (empty certificaciones) | Card "Certificaciones" ya **no se oculta** cuando vacía → empty state §9.6 "Todavía no se han generado certificaciones para este expediente." `profile_hash`/`snapshot_id` crudos del card "Marco normativo del acuerdo" relegados a `<details> Detalle avanzado` (criterio 7). Documentos ya tenían empty (`AgreementDocumentRequirementsPanel:251`). H1 dinámico (proposal_text) conservado; sin label de negocio aprobado para `agreement_kind` → kicker intacto. |

| **T8 · UX-6.A** avisos sociedades/personas | HECHA | _este commit_ | tc=0 · test 2100/0 · lint=baseline(17) | Codex pendiente (clúster Expediente/Datos) | §6.7 ("Participación registrada sin derechos de voto computables", "Cargo vigente pendiente de referencia registral. Puede limitar certificaciones frente a terceros.") | `SociedadDetalle`: aviso bajo la tabla de capital cuando hay holdings `!voting_rights && !is_treasury`; aviso §6.7 bajo la tabla de cargos cuando hay cargo de autoridad sin ref. RM (**resuelve Codex UX-0 #8**: el aviso de `RmStatusChip` ahora es visible). `isAuthorityRole` importado. **Diferido:** CTA "Revisar autoridad certificante" (requiere estructura del tab Autoridad); aviso "censo pendiente" (concepto de expediente, no ficha). |

### Codex — revisión adversarial T6 (UX-3.B)

`codex exec -s read-only` sobre `git diff 172fad9..HEAD`. Veredicto inicial: **NO-APTO**, 4 hallazgos. Resolución:

| # | Sev | Hallazgo | Resolución |
|---|---|---|---|
| 1 | BLOQUEANTE | CTAs no literales: "En revisión"/"Aprobar"/"Marcar sustituido" vs §6.5/§9.5 | **CORREGIDO**: "Revisar", "Aprobar documento", "Marcar como sustituido" (literal §6.5). "Archivar" ya coincidía. |
| 2 | BLOQUEANTE | Toast `IN_REVIEW: "Documento en revisión."` inventado (no en §8.3) | **CORREGIDO**: eliminado del mapa; `IN_REVIEW` cae al toast neutro preexistente "Estado actualizado" (no se inventa copy). |
| 3 | MAYOR | Contrato poco estricto (solo cambia un substring) | **CORREGIDO/REFORZADO**: el contrato ahora asierta el subcopy completo §6.5 + H1 + secciones + CTAs + toast §8.3 + tooltip §6.5 (7 aserciones nuevas). |
| 4 | MENOR | `title` nativo no es tooltip ARIA fiable | **JUSTIFICADO-MENOR**: el botón tiene label visible (nombre accesible intacto) y es operable por teclado; §6.5 pide "tooltip" y `title` es el tooltip mínimo convencional. Un tooltip ARIA completo es sobre-ingeniería para una pista supletoria en un botón ya etiquetado. |

Gates tras fixes: tc=0 · test 2100/0 (+7 expects) · lint=baseline(17).

### 🟡 Decisiones para el humano (acumulado)

- **UX-0.D / "Registro":** §5.2 aprueba renombrar el ítem de sidebar "Tramitador registral"→"Registro", pero CLAUDE.md (decisión 2026-05-12) prohíbe usar "Registro" en copies para referirse al Registro Mercantil. Conflicto entre dos fuentes de verdad. Implementados los otros 8 renames; este queda pendiente de que decidas cuál prevalece. Si se aprueba, el cambio es trivial (2 ítems en `navigation.ts` + `e2e/03:26`, `e2e/12:22`, `e2e/33:61`).
- **UX-1.A / "Procesos"→"Calendario societario" y "Reuniones"→"Sesiones":** §5.2 los aprueba pero el plan los marca 🟡 (validación legal + deuda de selector estable `[data-sidebar-item="Procesos"]` y desalineación label/icono/página). No codificados; requieren tu validación legal antes de tocar.
- **UX-1.A / "Dashboard"→"Mesa":** HECHO en T5 (sidebar + H1 §9.2).
- **Cola documental sin scope de entidad (gap de modelo):** `secretaria_document_artifacts` no tiene `entity_id`; la cola de revisión (página y bloque Mesa) es tenant-wide. Para scope por sociedad haría falta añadir `entity_id` o resolver `source_id`→entidad (cambio de esquema/joins = 🔴). Decisión tuya si se prioriza.

## Resumen del run

**Cierre 2026-06-25.** Rama `feature/ux-refactor-secretaria-overnight`, 11 commits, **sin push** (revisión humana). Todas las tareas en verde; 0 bloqueadas; 3 rondas Codex adversarial (todas NO-APTO inicial → corregidas).

### HECHAS (6)
| Tarea | Commit(s) | Resumen |
|---|---|---|
| T1 · UX-0.D | `1f4d0ae` | 8/9 renombrados sidebar (ambas taxonomías) |
| T2 · UX-0.E | `479f89c` | artefacto→Documento + RmStatusChip §7.1 |
| T3 · UX-0.F | `772f198` | evidencia GenerarDocumentoStepper vía EvidenceStatusBadge |
| Codex UX-0 fixes | `17ec3b7` | 5 hallazgos válidos corregidos |
| T5 · UX-2.B | `5cc1ac3` | Mesa copy H1/subcopy/empty + sidebar Dashboard→Mesa |
| T4 · UX-2.A | `6bb9f13` | bloque "Documentos pendientes" + CTA + refactor labels |
| Codex Mesa fixes | `172fad9` | 5 hallazgos válidos (scope copy, error, helper, foco, reubicación) |
| T6 · UX-3.B | `fba44e4` | Revisión documental copy (toasts/H1/secciones/empties/tooltip) |
| Codex T6 fixes | `bbc9594` | CTAs literales §6.5, toast inventado fuera, contrato reforzado |

### Gates en el último commit (`bbc9594`)
`tsc -b` = 0 · `bun test` = 2100 pass / 0 fail · `bun run lint` = 15 errores (== baseline, 0 nuevos) · `bun run build` = 0.

### PENDIENTES 🟢 (no ejecutadas — siguiente sesión)
- **T7 · UX-5.A** Expediente: empty states (§9.6) + relegar tecnicismos (`profile_hash`, `snapshot_id`, `agreement_kind`) a detalle avanzado + tarjetas móviles M1.
- **T8 · UX-6.A** Sociedades/personas: avisos "censo pendiente"/"sin voto computable" + CTA "Revisar autoridad certificante" + **aviso §6.7 visible** (heredado de Codex UX-0 #8: el aviso de RmStatusChip debe surfacearse aquí como elemento visible).
- **T9 · UX-7.C** Gobierno: avisos "plantilla sin regla"/"decisión legal pendiente" + sub-área nominal "Parámetros normativos".
- **T10 · UX-7.B** Plantillas: cohortes + "activa con metadatos incompletos" + filtros (datos ya presentes).
- **T11 · UX-7.A (parcial)** aviso de snapshot normativo desfasado (`profile_hash` congelado vs vigente) — **solo** la parte 🟢; el chip imperativa/dispositiva es 🟡 (campo nuevo = criterio legal).
- **Follow-up copy permisos §8.2**: alinear "Tu rol puede consultar esta información, pero no ejecutar esta acción." en `DocumentosPendientesRevision` **y** `CertificacionesAutonomas` a la vez, actualizando ambos asserts del contrato `keeps auditor/compliance flows read-only`.

### Cómo revisar
- **Ver todo el diff:** `git diff main...feature/ux-refactor-secretaria-overnight`
- **Por commit:** `git log --oneline main..feature/ux-refactor-secretaria-overnight` y `git show --stat <hash>`
- **Abrir PR:** `gh pr create --base main --head feature/ux-refactor-secretaria-overnight --fill`
- **Revertir todo el run (sin push):** `git switch main && git branch -D feature/ux-refactor-secretaria-overnight`
- **Criterios NO verificables automáticamente (validación humana / navegador):** apariencia visual del bloque "Documentos pendientes" y de los empties; comportamiento del tooltip `title` en hover; coherencia de la copy scope-aware sociedad/grupo en la Mesa; render de `EvidenceStatusBadge` en el paso de archivado de `GenerarDocumentoStepper`. **E2E no ejecutados** en este run (sin navegador): specs actualizados a los nuevos selectores/labels — `e2e/12`, `e2e/21`, `e2e/30`, `e2e/33` — deben correrse antes de mergear.
