# UX Materias y Reglas — Oleada 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ejecutar la Oleada 1 (alto impacto / bajo coste) del informe de rediseño UX legal de `/secretaria/catalogo-materias`: lenguaje jurídico, ortografía, leyenda de badges, estados globales por materia, CTA contextual, vigente vs histórica y duplicidades.

**Architecture:** Toda la superficie viva es `CatalogoMaterias.tsx` (RuleManagerPage.tsx y ReglasAplicables.tsx están huérfanas, sin ruta). La lógica derivable va a `src/lib/secretaria/mesa-control-societaria.ts` como helpers puros con tests; el copy va en la página; la ortografía de materias es un fix de DATOS en `materia_catalog` (Supabase) vía migración forward-only.

**Tech Stack:** React 18 + TS relajado, TanStack Query, Supabase (governance_OS `hzqwefkwsxopwrmtksbg`), bun test/vitest, Playwright.

## Global Constraints

- Tokens Garrigues obligatorios: solo `var(--g-*)` / `var(--status-*)`; nunca Tailwind nativo de color ni hex (CLAUDE.md).
- TS relajado: no añadir anotaciones donde no existían; no `strictNullChecks`.
- NO borrar ni renombrar filas de `materia_catalog` (memoria: cambios de alias hacen spiral). El dedupe de aliases es de presentación, con mapa explícito.
- `buildTemplateDocumentBindings` lo consume también `ActivarMarcoNormativo.tsx`: no cambiar su firma ni su comportamiento; los helpers de display son aditivos.
- Antes de tocar Supabase: `bun run db:check-target` (ya verificado pass). Todo cambio Cloud con espejo en `supabase/migrations/`.
- Los ids de tab (`?vista=resumen|regla|plantillas|fuentes|simular`) NO cambian (deep links y e2e); solo cambian labels visibles.
- Tests de contrato a actualizar en el mismo cambio: `src/test/secretaria/mesa-control-ui-contract.test.ts` y `e2e/08-secretaria-plantillas.spec.ts`.

---

## Evidencia de auditoría (workflow wf_b3e63416-6ee, 14 agentes + probe Cloud)

| Afirmación del informe | Veredicto | Matiz clave |
|---|---|---|
| "motor/Gate PRE/preflight" en vista abogado | CONFIRMADO | Todo en CatalogoMaterias.tsx |
| Bloque superior compite y se muestra siempre | CONFIRMADO | `EngineConfigSummary` sin condicional (:251) |
| Sin búsqueda/filtros/contadores | CONFIRMADO | Nada implementado (→ Oleada 2) |
| Chips con falso affordance | PARCIAL | Son `<span>` dentro de una card `<button>` |
| Badges sin leyenda ni tooltip | CONFIRMADO | `<span>` plano :292-297 |
| Todas las versiones con badge "Usada por el motor" | PARCIAL | Hasta 3 activas con el mismo badge (slice(0,3)) |
| Duplicidades visibles de plantillas | CONFIRMADO con matiz | "Acta de consignación v1.2.1" ×2 NO son datos duplicados: son 2 plantillas distintas (socio único vs admin único) con label infra-especificado. Duplicados de datos REALES: MODELO_ACUERDO v1.1.1 ES ×2 (NOMBRAMIENTO_CONSEJERO) y ×2 (CESE_CONSEJERO). Latente: 2× ACTA_SESION v1.2.1 |
| "Estatutos no modelados" ambiguo | CONFIRMADO | El componente tiene los overrides de la entidad y puede distinguir "sin regla especial" de "sin estatutos estructurados". El string de la lib (:805-811) está ligado a flag correcto y lo usan StepReglas/StepRevisionCreacion: NO tocar lib, corregir solo el JSX local |
| CTA principal = Simular preflight | CONFIRMADO | El CTA contextual YA existe en tab simular (:1019-1035): es problema de jerarquía |
| Tildes en nombres de materias | CONFIRMADO | Datos: `materia_catalog.materia_label_es`, sembrado sin tildes por migración `20260518070443` (que además machacó labels correctos del seed 000033 vía ON CONFLICT DO UPDATE) |

Hallazgos adicionales del probe Cloud (49 filas en `materia_catalog`):

- 3 pares de alias legacy con label duplicado: `AMPLIACION_CAPITAL`≈`AUMENTO_CAPITAL`, `MOD_ESTATUTOS`≈`MODIFICACION_ESTATUTOS`, `NOMBRAMIENTO_CESE`≈`NOMBRAMIENTO_CONSEJERO` → tarjetas duplicadas visibles.
- 8 materias sin entrada en `MATTER_GROUP_BY_MATERIA` caen por fallback silencioso en "Gobierno corporativo y órganos": ACCION_SOCIAL_RESPONSABILIDAD, AMPLIACION_CAPITAL, AUTORIZACION_GARANTIA, DISTRIBUCION_CARGOS, EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE, MOD_ESTATUTOS, NOMBRAMIENTO_CESE, TRASLADO_DOMICILIO_NACIONAL.
- 18 labels + 1 referencia_legal con ortografía incorrecta (lista exacta en Task 2).

---

### Task 1: Helpers de dominio en mesa-control-societaria.ts + tests

**Files:**
- Modify: `src/lib/secretaria/mesa-control-societaria.ts`
- Test: `src/lib/secretaria/__tests__/mesa-control-materias-status.test.ts` (nuevo)

**Interfaces (Produces):**
- `MATERIA_CANONICAL_ALIAS: Record<string,string>` — `{ AMPLIACION_CAPITAL: "AUMENTO_CAPITAL", MOD_ESTATUTOS: "MODIFICACION_ESTATUTOS", NOMBRAMIENTO_CESE: "NOMBRAMIENTO_CONSEJERO" }`
- `resolveMateriaAlias(code: string): string`
- `buildMateriaCatalogRows` colapsa filas alias cuando existe la canónica (y las remapea si la canónica falta).
- 8 entradas nuevas en `MATTER_GROUP_BY_MATERIA` (grupo correcto por materia; aliases al grupo de su canónica).
- `evaluateMateriaGlobalStatus(input: { templateReadiness; conflictOfLaws?; legalReference?; applicablePactosCount? }): { status: "lista"|"advertencia"|"revision_legal"|"bloqueada"; label; explanation; ctaLabel }` con precedencia bloqueada > revision_legal > advertencia > lista. Labels: "Lista para iniciar expediente" / "Advertencia no bloqueante" / "Requiere revisión legal" / "Bloqueada por falta de plantilla mínima". CTAs: "Iniciar expediente" / "Iniciar expediente" / "Revisar fuentes" / "Resolver bloqueo".
- `documentTypeLabel(tipo: string): string` (mueve DOCUMENT_TYPE_LABEL de la página a la lib).
- `compareTemplateVersions(a,b): number` (numérico por segmentos: "1.10.0" > "1.9.0").
- `templateBindingDisplayLabel(binding, siblings): string` — añade discriminador (`adoptionModeBusinessLabel` u órgano o materia) cuando otro binding visible comparte tipo+versión.
- `groupStageBindingsForDisplay(bindings): Array<{ current: TemplateDocumentBinding; older: TemplateDocumentBinding[] }>` — agrupa ACTIVAS por tipo, vigente = mayor versión.
- `detectTemplateDataDuplicates(bindings): Array<{ tipo; version; ids: string[] }>` — mismo tipo+versión+jurisdicción+materia efectiva+órgano+forma de adopción (indistinguibles) → incidencia de datos.

- [ ] Escribir tests (alias collapse, deep-link alias resuelto, grupos de las 8 materias, precedencia de estados, vigente por versión numérica, discriminador de label, duplicados de datos vs plantillas distinguibles)
- [ ] Implementar helpers
- [ ] `bun test src/lib/secretaria/__tests__/mesa-control-materias-status.test.ts` verde

### Task 2: Migración ortografía materia_catalog + aplicar a Cloud

**Files:**
- Create: `supabase/migrations/20260710<hhmmss>_materia_catalog_orthography_fix.sql`

UPDATEs (label exacto nuevo por materia):

| materia | materia_label_es corregido |
|---|---|
| ACUERDO_CONVOCATORIA_JUNTA | Acuerdo del órgano de administración convocando Junta |
| APLICACION_RESULTADO | Aplicación del resultado |
| APROBACION_PRESUPUESTO | Aprobación del presupuesto anual |
| APROBACION_REGLAMENTO_CONSEJO | Aprobación o modificación del Reglamento del Consejo |
| AUTORIZACION_GARANTIA | Autorización de garantía o aval |
| TRANSMISION_PARTICIPACIONES | Autorización de transmisión de participaciones sociales |
| CONTRATOS_SOCIO_UNICO_SOCIEDAD | Contratos entre socio único y sociedad |
| PRESTACIONES_ACCESORIAS | Creación, modificación o supresión de prestaciones accesorias |
| DISTRIBUCION_CARGOS | Distribución de cargos del Consejo |
| DIVIDENDO_A_CUENTA | Distribución de dividendo a cuenta |
| EJECUCION_AUMENTO_DELEGADO | Ejecución de aumento de capital delegado |
| SEPARACION_SOCIO | Ejercicio del derecho de separación de socio |
| EXCLUSION_SOCIO | Exclusión de socio |
| EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE | Exclusión del derecho de suscripción preferente |
| CUENTAS_CONSOLIDADAS | Formulación de cuentas consolidadas |
| PODER_REPRESENTACION | Otorgamiento o modificación de poderes de representación |
| SUPRESION_PREFERENTE | Supresión del derecho de suscripción preferente |
| TRASLADO_DOMICILIO_NACIONAL | Traslado de domicilio social dentro de España |

Más: `UPDATE materia_catalog SET referencia_legal = 'art. 107.2 LSC (mayoría ordinaria, art. 198 LSC)' WHERE materia = 'TRANSMISION_PARTICIPACIONES';`

- [ ] `bun run db:check-target` (guardrail)
- [ ] Escribir migración
- [ ] `supabase db push --linked --dry-run` → solo la nueva
- [ ] `supabase db push --linked`
- [ ] Re-ejecutar probe read-only → 0 sospechas de tildes

### Task 3: Microcopy jurídico en CatalogoMaterias.tsx

**Files:** Modify: `src/pages/secretaria/CatalogoMaterias.tsx`

Tabla exacta viejo→nuevo (líneas de referencia previas al cambio):

| Viejo (línea) | Nuevo |
|---|---|
| "Configuración del motor de reglas" (:1144 aria-label, :1150) | "Reglas aplicables y requisitos para tramitar" |
| "La materia seleccionada resuelve órgano, quórum, mayoría, fuentes jurídicas y plantillas mínimas antes de permitir iniciar un expediente." (:1153) | "La materia seleccionada determina el órgano competente, la mayoría, el quórum, las fuentes aplicables y los documentos mínimos necesarios para iniciar el expediente." |
| steps `["Materia","Regla efectiva","Plantillas","Preflight","Expediente"]` (:1166) | `["Materia","Regla aplicable","Documentos","Verificación previa","Expediente"]` |
| métrica "Regla efectiva" (:1186) | "Regla aplicable" |
| métrica detail "Gate PRE con plantillas mínimas disponibles" (:1194) | "Comprobación documental previa superada" |
| métrica "Resultado del motor" (:1198) | "Resultado de la verificación" |
| "Expediente habilitado" / "No inicia" (:1199) | "Listo para iniciar expediente" / "Bloqueado" |
| detail "La configuración gobierna el motor antes del flujo operativo" (:1200) | "La verificación se realiza antes de abrir el flujo operativo" |
| tab label "Regla efectiva" (:83) | "Regla aplicable" |
| tab description "Gate PRE documental" (:84) | "Comprobación documental previa" |
| tab "Simular · Resultado antes de iniciar" (:86) | "Verificación · Requisitos antes de iniciar" |
| aria-label "Workspace de configuración del motor" (:482) | "Regla aplicable y documentos de la materia" |
| "Cadena de decisión del motor" (:531) | "Cadena de decisión" |
| paso "Regla efectiva" (:541) | "Regla aplicable" |
| paso "Preflight · Simula el expediente antes de abrir tramitación" (:553-554) | "Verificación previa · Comprueba los requisitos antes de abrir la tramitación" |
| "Estatutos no modelados para esta materia. Aplican reglas legales por defecto." (:587) | ver Task 6 (dos mensajes según señal) |
| "Ver plantillas vinculadas" (:611, :1162) | "Ver documentos y plantillas de esta materia" |
| "Simular preflight" (:619) | "Verificar requisitos antes de iniciar" (pasa a secundario, ver Task 5) |
| "Regla efectiva para esta sociedad" (:645) | "Regla aplicable para esta sociedad" |
| "Esta es la decisión que usa el motor cuando…" (:646) | "Esta es la regla que se aplica cuando una convocatoria, acuerdo o expediente declara esta materia." |
| KeyValue "Fuentes aplicadas" (:668) | "Fuente determinante" |
| "Plantillas vinculadas al motor" (:697) | "Documentos y plantillas de esta materia" |
| "El Gate PRE comprueba que las fases mínimas…" (:698) | "La comprobación documental previa verifica que las fases mínimas tengan plantilla activa antes de habilitar el expediente." |
| "Administrar en Plantillas" (:721) | "Ver en catálogo de plantillas" |
| "Abrir gestor avanzado" (:728) | "Administrar plantillas" |
| "Usada por el motor" (:772) | "Vigente para nuevos expedientes" (solo la vigente; históricas "Versión anterior") |
| "Probar fusión" (:852) | "Vista previa del documento" |
| "Fuentes aplicadas" título tab fuentes (:874) | "Fuente determinante y fuentes revisadas" |
| "El motor no decide por una única tabla: compone ley…" (:875) | "La regla aplicable se compone de ley, estatutos, reglamento, pactos y overrides documentales." |
| "Simular preflight del motor" (:956) | "Verificación previa del expediente" |
| "Resultado del motor" (:964) | "Resultado de la verificación" |
| outcome "Expediente habilitado · La configuración permite pasar del motor al flujo operativo." (:949-950) | "Listo para iniciar expediente · Los requisitos y documentos mínimos están cubiertos." |
| PreflightRow "Regla efectiva resuelta" (:980) | "Regla aplicable resuelta" |
| "Regla efectiva para X." subtítulo detalle (:405) | "Regla aplicable para X." |
| "Salida habilitada por configuración" (:560) | "Listo para iniciar expediente" |
| línea (:624) "El resumen se evalúa para X; cambia de sociedad para recalcular órgano, fuentes y salida." | "El resumen se evalúa para X; cambia de sociedad para recalcular órgano, fuentes y requisitos." |

- [ ] Aplicar reemplazos
- [ ] `grep -n "Gate PRE\|[Pp]reflight\|motor" src/pages/secretaria/CatalogoMaterias.tsx` → 0 apariciones visibles al usuario

### Task 4: Leyenda de badges + tooltips de chips

**Files:** Modify: `src/pages/secretaria/CatalogoMaterias.tsx`

- Componente local `NatureLegend` bajo el encabezado del catálogo con los 5 tipos (punto de color + término + consecuencia en una línea): Ordinaria ("Mayoría ordinaria del órgano competente"), Reforzada ("Exige mayoría o quórum reforzado por ley o estatutos"), Estructural ("Operación estructural: escritura, inscripción y en su caso publicación"), Especial ("Régimen específico: socios, pactos u operaciones vinculadas"), Informativa ("No se somete a votación separada; requiere constancia en acta").
- `title` en el badge de cada tarjeta con la misma explicación.
- `title` en `Chip` de formalización: Escritura pública → "Requiere elevación a público ante notario"; Inscripción → "Debe presentarse al Registro Mercantil"; Publicación → "Requiere publicación legal (BORME u otro medio)"; Archivo interno → "Sin inscripción registral; exige conservación documental interna"; Constancia → "Debe quedar constancia en acta; sin expediente registral propio".

- [ ] Implementar y verificar con lint

### Task 5: Estado global por materia + CTA contextual

**Files:** Modify: `src/pages/secretaria/CatalogoMaterias.tsx`

- Panel de estado en la cabecera del detalle (`MateriaDetail`): pill de estado (`evaluateMateriaGlobalStatus`) + explicación + CTA primario contextual: lista/advertencia → Link "Iniciar expediente" a `/secretaria/tramitador/nuevo?materia=…&entity=…`; bloqueada → botón "Resolver bloqueo" (onTabChange("plantillas")); revisión legal → botón "Revisar fuentes" (onTabChange("fuentes")).
- En Resumen: primario contextual (mismo criterio), secundario "Verificar requisitos antes de iniciar" (onTabChange("simular")).
- Indicador de estado en cada tarjeta del catálogo (punto de color + texto corto "Lista"/"Advertencia"/"Revisión legal"/"Bloqueada"), calculado con memo por materia (readiness por materia = bindings de MODELO_ACUERDO específicos + fases transversales compartidas).
- `EngineConfigSummary` pasa a panel de estado de la materia seleccionada (título Task 3) con el mismo CTA contextual.

- [ ] Implementar
- [ ] Verificar los 4 estados con datos reales (CESE_CONSEJERO=lista; materia sin modelo → bloqueada)

### Task 6: Vigente vs histórica, duplicados y estatutos sin ambigüedad

**Files:** Modify: `src/pages/secretaria/CatalogoMaterias.tsx`

- `TemplateStageCard` usa `groupStageBindingsForDisplay`: por tipo, la vigente con badge "Vigente para nuevos expedientes"; anteriores dentro de `<details>` "Ver versiones anteriores (n)" con badge "Versión anterior".
- Labels con `templateBindingDisplayLabel` (discriminador socio único / admin único etc.).
- `detectTemplateDataDuplicates` → banner de incidencia en la fase: "Posible duplicidad de plantilla (tipo · versión). Revisar antes de activar nuevos expedientes." (tono `--status-warning`, sin bloquear).
- Sección "Qué añaden los estatutos": si hay overrides ESTATUTOS de la entidad en otras materias → "Los estatutos estructurados no añaden regla especial para esta materia. Se aplica la regla legal por defecto."; si no hay ninguno → "Estatutos no estructurados en el sistema para esta sociedad. Se aplica la regla legal por defecto hasta cargar la fuente documental." (el string de la lib ligado al flag `estatutosModelados` NO se toca).

- [ ] Implementar
- [ ] Duplicados reales (MODELO_ACUERDO v1.1.1) visibles como incidencia; actas socio/admin único ya no parecen duplicadas

### Task 7: Actualizar contratos de test

**Files:**
- Modify: `src/test/secretaria/mesa-control-ui-contract.test.ts`
- Modify: `e2e/08-secretaria-plantillas.spec.ts`

- Contrato UI: sustituir pins antiguos por el copy nuevo (p.ej. "Reglas aplicables y requisitos para tramitar", "Cadena de decisión", "Comprobación documental previa", "Resultado de la verificación", "Vigente para nuevos expedientes", "Regla aplicable para esta sociedad", "Verificación previa del expediente", "Iniciar expediente bloqueado" se mantiene, "Solicitar edición" se mantiene, "Trazabilidad preparada para el bloqueo del expediente" se mantiene).
- e2e 08: tabs `'Plantillas Comprobación documental previa'`, `'Verificación Requisitos antes de iniciar'`; textos `'Cadena de decisión'`, `'Documentos y plantillas de esta materia'`, `'Vigente para nuevos expedientes'`, `'Resultado de la verificación'`; el link "Iniciar expediente" puede aparecer ×2 (panel de estado + tab) → `.first()`.

- [ ] Actualizar y correr `bun test src/test/secretaria/mesa-control-ui-contract.test.ts`

### Task 8: Gates + review adversarial

- [ ] `bun run typecheck` · `bun run lint` · `bun test` · `bun run build`
- [ ] Workflow de review adversarial del diff (correctness + tokens Garrigues + contratos)
- [ ] Commit por tarea lógica (a petición del usuario)

---

## Post-review adversarial (2026-07-10, 22 agentes) — fixes aplicados

- **P1 real cazado y corregido**: el colapso de aliases ocultaba el pacto demo CONSENTIMIENTO_INVERSOR (usa código legacy `AMPLIACION_CAPITAL` en `materias_aplicables`). Fix: matching pacto↔materia vía `materiaPactoCoincide` (ITEM-113) con `pactoApplicaAMateria`/`overrideApplicaAMateria`; verificado en vivo (AUMENTO_CAPITAL vuelve a mostrar advertencia + chip de pacto).
- Conflicto de ley evaluado POR MATERIA en `statusByMateria` (antes contaminaba todo el grid con el flag de la materia seleccionada en sociedades no-ES).
- Materias informativas exentas del gate de plantillas mínimas en el estado global (label "Materia informativa", CTA "Ver regla aplicable") — coherente con `documentRequirements`/`formalizationLabel` que ya las tratan como constancia en acta.
- Leyendas suavizadas (Reforzada "puede exigir…", Informativa sin afirmar no-votación, Inscripción/Publicación "cuando proceda"), copy de estatutos sin sobrepasar la señal de datos, gerundio "convocando Junta" → "por el que se convoca la Junta" (overlay + migración), `actionLabel` "Probar fusión" → "Vista previa del documento" (también corrige ActivarMarcoNormativo), tie-break de versiones con sufijos (beta/rc no son duplicados), `role="note"` en banner de duplicidad, focus ring en `<summary>`, tono `info` para revisión legal.
- **Diferido a decisión del Comité Legal**: SUPRESION_PREFERENTE vs EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE son la misma institución (art. 308 LSC) con dos tarjetas casi idénticas — posible alias, pero es decisión de taxonomía legal, no se fabrica criterio.

## Backlog Oleada 2 (siguiente sprint)

Búsqueda de materias (nombre/artículo/documento), filtros (mayoría, formalización, estado documental), contadores por categoría, vista tabla comparativa, tooltips ricos (sistema de ayudas estable), panel "¿Por qué esta regla?", notas de uso por materia ambigua (§13 del informe), checklist documental como matriz (§12).

## Backlog Oleada 3

Vista abogado/técnica (toggle), comparación de versiones de plantilla, detección automática de duplicidades server-side, edición avanzada de fuentes, analítica de uso, exportación de matriz. Pendiente de decisión: saneamiento de datos de los 2 pares MODELO_ACUERDO v1.1.1 duplicados (archivar una de cada par exige decisión sobre cuál conserva bindings) y limpieza de tildes en `rule_packs.nombre` + cuerpos capa1 (requiere pasada de revisión legal del contenido).
