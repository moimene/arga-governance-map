# UX Configuración Secretaría — Oleada 2 + Coherencia transversal (plan de arranque)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Este documento es el plan MARCO de la conversación dedicada; cada fase produce su propio plan detallado antes de tocar código (mismo playbook que las Oleadas 1).

**Goal:** Completar el backlog de las tres pantallas de configuración de Secretaría (Materias y reglas · Plantillas · Gobierno de plantillas) y darles una pasada profunda de coherencia: mismo lenguaje, mismos estados, mismos criterios de advertencia/bloqueo y viajes entre pantallas sin costuras (§19 del informe UX).

**Contexto — de dónde partimos (2026-07-11):**
- Oleada 1 de las tres pantallas COMPLETADA en el working tree (ver estado de commit al arrancar): planes con evidencia y secciones post-review en
  `docs/superpowers/plans/2026-07-10-ux-materias-reglas-oleada1-plan.md`,
  `2026-07-10-ux-plantillas-oleada1-plan.md`,
  `2026-07-11-ux-gestor-plantillas-oleada1-plan.md`.
- Método validado 3 veces: **auditoría de brechas contra código+Cloud (agentes con verificación adversarial) → plan por fases → implementación → gates → verificación en vivo → review adversarial del diff → fixes**. Los informes UX sobreestiman unas brechas y subestiman otras: nunca implementar sin auditar antes.
- Guardarraíles vigentes: memoria del proyecto (MEMORY.md) + CLAUDE.md; tokens Garrigues no negociables; TS relajado; strings pinados en `src/test/secretaria/mesa-control-ui-contract.test.ts` y en e2e (08, 12, 14, 16, 17, 21, 22, 24, 25) — actualizar contratos en el mismo cambio; canal de escritura Cloud = MCP execute_sql o Management API con token del keychain (db push bloqueado por drift de junio); no borrar/renombrar filas de catálogos (spiral de alias).
- Tareas en curso en sesiones aparte (comprobar su resultado al arrancar): resolución ITEM-089 vs e2e/14:147+e2e/17:4 (CTA de fixtures) y el chip de migración de tildes (ya aplicada y verificada; overlay retirado).

## Workstream A — Coherencia transversal (hacer PRIMERO)

Auditoría cruzada de las tres pantallas + `/secretaria/plantillas` como bisagra, con fixes:

1. **Lenguaje único**: residuo confirmado — `Plantillas.tsx:647` sigue mostrando al abogado "Configuración del motor: cada plantilla activa alimenta Gate PRE…" (y los diálogos ITEM-087 de esa página hablan de "Gate PRE" sin la traducción "comprobación documental previa" que ya usan Materias y el Gestor). Unificar glosario: regla aplicable, comprobación documental previa, vigente para nuevos expedientes, cobertura provisional, versión provisional. OJO: "Configuración del motor" está pinado en el contract test (item "conecta bindings…").
2. **Estados y semántica de color únicos**: hoy conviven lista/advertencia/revisión legal/bloqueada (Materias), Vigentes/En preparación/Histórico + chips de incidencia (Plantillas), Operativo/Con advertencias/Con incidencias (Gestor). Definir un vocabulario de estados común (y mapa de tonos success/warning/info/error) documentado y aplicado a pills, dots y leyendas de las tres pantallas.
3. **Labels compartidos**: consolidar los ≥3 sistemas paralelos (organoTipoLabel/adoptionModeLabel locales de Plantillas, organoTipoBusinessLabel/adoptionModeBusinessLabel de mesa-control, labels.ts de template-admin) en el módulo canónico (template-admin/labels o mesa-control) sin romper consumidores; un solo origen para órgano/adopción/estado/materia (labelMateria).
4. **Viajes entre pantallas**: Materias ("Ver en catálogo de plantillas"/"Administrar plantillas") → Plantillas/Gestor deben conservar contexto (materia, plantilla, estado del filtro) con deep-links que ya no se pisan (fix del clobber hecho en Gestor; revisar equivalentes en Plantillas). Añadir el viaje inverso donde falte (desde una plantilla, "ver materias que la usan").
5. **Incidencias con criterio único**: el mismo problema debe llamarse igual y contar igual en las tres superficies (duplicidad visible, versión provisional, sin órgano/adopción, sin referencia, sin changelog, cobertura provisional). Hoy Plantillas usa legal-template-review, Materias usa detectTemplateDataDuplicates y el Gestor ambos + gate-pre: mapear solapes y decidir el detector canónico por concepto (integrar, no crear otro).

## Workstream B — Backlog Oleada 2 por pantalla

**Materias y reglas** (informe §14-O2): búsqueda por nombre/artículo/documento; filtros por mayoría/formalización/estado; vista tabla comparativa (§9); sistema de ayudas estable (definición + consecuencia + acción, §6); panel "¿Por qué esta regla?" (fuente determinante vs revisadas, §11); notas de uso por materia ambigua (§13: estatutos genérica vs específicas, dividendos vs a cuenta, obligaciones vs convertibles, informe de gestión vs cuentas, vinculadas, Reglamento Consejo); checklist documental como matriz por fases con criticidad (§12); refinar el gate de plantillas mínimas por naturaleza (informativas ya exentas; revisar constancia).

**Plantillas**: "Comparar con vigente" desde una histórica; acciones por estado (histórico: ver histórico/sustituta; ya hecho parcial); columna tipo_social cuando el dato exista (hoy 100% NULL — antes exige decisión/backfill); traducción del bloque "Configuración del motor" del detalle a lenguaje jurídico (workstream A.1).

**Gobierno de plantillas** (informe §18-O2): renombrar labels de tabs a los del informe (Salud documental, Catálogo gobernado, Cobertura por materia y órgano, Indicadores de ciclo de vida, Auditoría y changelog) CON actualización coordinada de e2e 14/17/21/22/24/25; cola de incidencias unificada (tab o sección propia agregando los detectores por severidad con consecuencia+acción, §4.2/§10); agrupación del catálogo por tipo/materia con versiones colapsadas (§6); rediseño del editor tri-capa (Capa 2 como tabla variable→fuente→uso→obligatoriedad, resaltado por namespace en Capa 1, Capa 3 con validación visible, §9); vista Legal/Técnica (§15).

## Workstream C — Oleada 3 / gobierno avanzado (si hay recorrido)

Changelog retrospectivo guiado por lotes (marcado "reconstruido"); workflow de promoción; comparación de versiones (diff capa1); panel de estancamiento (>60 días en estado); exportación de auditoría y de la matriz de materias; asignación de responsables por incidencia; analítica de uso.

## Workstream D — Decisiones a resolver CON el usuario (bloquean partes de B)

1. SUPRESION_PREFERENTE vs EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE: misma institución (art. 308 LSC), dos tarjetas casi idénticas — ¿alias, nota de uso, o consolidación? (tocar datos = spiral: decisión Comité Legal).
2. Gap core FORMULACION_CUENTAS: ¿tipificación ORGANO_ADMIN vs CONSEJO_ADMIN del modelo activo, reactivación de contenido archivado vía nueva versión, o nueva plantilla?
3. Semántica NULL en organo_tipo/adoption_mode/tipo_social: ¿ANY válido o metadato obligatorio? (afecta a incidencia "Sin órgano o adopción" y a la columna tipo_social).
4. Saneamiento de duplicados de datos reales: MODELO_ACUERDO v1.1.1 ×2 (NOMBRAMIENTO_CONSEJERO y CESE_CONSEJERO idénticos) y ACTA_SESION v1.2.1 ×2 — archivar una copia exige decidir cuál conserva bindings.
5. Tildes en `rule_packs.nombre` y cuerpos capa1 (pendiente de revisión legal del contenido).
6. Resultado de la sesión ITEM-089 (CTA de fixtures vs e2e) — integrar lo que se decida.

## Orden recomendado y criterios de cierre

Fase 0: recoger decisiones D + verificar estado del working tree/commits y de las 2 sesiones paralelas. Fase 1: Workstream A completo (auditoría cruzada → fixes) — criterio: glosario/estados/labels únicos documentados en el plan y aplicados; cero "Gate PRE"/"motor" sin traducción en vista abogado; viajes con contexto verificados en vivo. Fase 2: B por pantalla en olas con el playbook completo. Fase 3: C selectivo. Cada fase: gates (bun test, typecheck, lint tocados, build, e2e afectados) + verificación en vivo + review adversarial del diff con fixes antes de cerrar.

## Prompt de arranque (copiar en la conversación nueva)

Ver el prompt canónico al final de este documento; mantenerlo sincronizado si el plan cambia.

```
Vamos a completar la refactorización UX del bloque de configuración del módulo Secretaría (tres pantallas: /secretaria/catalogo-materias "Materias y reglas", /secretaria/plantillas "Plantillas" y /secretaria/gestor-plantillas "Gobierno de plantillas") ejecutando la Oleada 2 + una pasada profunda de coherencia transversal.

Plan marco de esta conversación: docs/superpowers/plans/2026-07-11-ux-configuracion-oleada2-coherencia-plan.md — léelo entero antes de nada y síguelo (workstreams A-D, orden recomendado y criterios de cierre). Las Oleadas 1 ya están hechas; su evidencia, matices y secciones post-review están en los tres planes 2026-07-10/11-ux-*-oleada1-plan.md y en la memoria del proyecto.

Método obligatorio (validado en las tres Oleadas 1): para cada fase, primero auditoría de brechas contra el código y los datos reales de Cloud con agentes en paralelo y verificación adversarial de cada afirmación (los informes UX sobreestiman unas brechas y subestiman otras); después plan de fase; después implementación; después gates completos (bun test, bun run typecheck, lint de lo tocado, build, e2e afectados), verificación EN VIVO con datos Cloud (login demo) y review adversarial del diff con fixes aplicados antes de cerrar la fase.

Empieza por la Fase 0: (1) comprueba el estado del working tree y de los commits de las Oleadas 1; (2) revisa el resultado de las dos sesiones paralelas (resolución ITEM-089 de fixtures/e2e y el chip de migración de tildes); (3) plantéame de una vez, con opciones y tu recomendación, las decisiones del Workstream D que bloquean trabajo (art. 308 duplicada, gap FORMULACION_CUENTAS, semántica NULL=ANY, saneamiento de duplicados v1.1.1, tabs del Gestor). Con mis respuestas, ejecuta la Fase 1 (coherencia transversal) completa y sigue con la Fase 2 por pantalla.

Restricciones no negociables: tokens Garrigues (nunca Tailwind de color nativo ni hex); TS relajado; los strings de estas pantallas están pinados en src/test/secretaria/mesa-control-ui-contract.test.ts y en e2e/08,12,14,16,17,21,22,24,25 — actualiza los contratos en el mismo cambio; ids de tab (?tab=, ?vista=) estables; NO borrar ni renombrar filas de materia_catalog/plantillas (los alias se colapsan solo en presentación); escritura a Cloud solo vía MCP execute_sql o Management API con token del keychain (db push --linked está bloqueado por drift de junio — no intentes repair) y siempre con migración espejo + verificación; e2e/14:147 y e2e/17:4 estaban rotos en HEAD por ITEM-089 (no lo reintroduzcas como "regresión tuya"). Commits: pide confirmación antes de commitear y usa rutas específicas en git add.
```

## Criterios de aceptación globales de la conversación

Un abogado puede: buscar y comparar materias, entender por qué aplica una regla y qué falta; encontrar la plantilla vigente con sus variantes explicadas; y en el Gestor leer la salud en un minuto y trabajar por incidencias — con el MISMO vocabulario, los mismos estados y los mismos colores en las tres pantallas, y viajes entre ellas que conservan contexto. Todo verificado en vivo y con reviews adversariales en verde.
