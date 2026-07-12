# UX Configuración Secretaría — Fase 2A: Materias y reglas

> Plan de pantalla derivado de `2026-07-11-ux-configuracion-oleada2-coherencia-plan.md`. Se ejecuta después del cierre verificado de Fase 1 y antes de Plantillas.

**Objetivo:** convertir `/secretaria/catalogo-materias` en un catálogo jurídico operativo: localizable, comparable y explicable; con una regla aplicable trazable, documentación real del rule pack y un gate coherente con la naturaleza de cada materia.

**Método:** auditoría adversarial de código + contratos + Cloud → este plan → tests de dominio → implementación → gates completos → verificación en vivo Cloud → review adversarial → fixes → cierre.

## 1. Evidencia de auditoría

### 1.1 Cloud real

- `materia_catalog`: 49 filas; 45 materias tras colapsar cuatro alias; la UI añade tres informativas locales y muestra 48 materias.
- 49/49 filas Cloud tienen referencia legal y mayoría. Distribución: SIMPLE 26, REFORZADA_2_3 16, REFORZADA_1_2 2, UNANIMIDAD 3 y NO_APLICA 2.
- Formalización de catálogo: 28 notaría, 34 registro/inscribible, 10 publicación y 14 sin esas tres exigencias.
- Rule packs: 57 activos para 56 materias crudas, con 205 requisitos documentales. La búsqueda documental debe leer `documentacion.obligatoria` y `convocatoria.documentosObligatorios`, no limitarse a Acta/Escritura/Certificación.
- Los packs activos distribuyen órgano: Junta 36, Consejo 18, socio único 2 y soporte interno 1. El helper heurístico actual solo acierta dos de las trece materias canónicas de Consejo; `AUTORIZACION_GARANTIA` tiene dos variantes legítimas Consejo/Junta.
- 14 materias canónicas discrepan entre catálogo y pack en notaría, registro o publicación. La UI no fusionará silenciosamente ambos orígenes: mostrará la regla aplicable y el mínimo de catálogo con procedencia.
- Para ARGA no existen overrides publicados; sí hay tres pactos vigentes. Los pactos se presentan como fuente contractual revisada, no como regla societaria determinante salvo validación explícita.
- `secretaria_effective_rule_matrix` no es evidencia suficiente para explicar la regla: ARGA tiene 48/49 filas `REQUIERE_REVISION`, 48 órganos genéricos y ninguna fila `OK`. No se usará como fuente determinante en esta fase.
- `tipo_social` es NULL en 110/110 plantillas y significa todos los tipos; los bindings especializan. Adoption NULL activa solo aparece en tres documentos de soporte y significa No aplica.

### 1.2 Código

Brechas P1 verificadas:

1. `buildNormativeMatrixRows` calcula órgano/mayoría/quórum por heurística de catálogo y concatena todas las fuentes bajo el label falso `Fuente determinante`.
2. `MINIMUM_TEMPLATE_STAGES` exige siempre Modelo + Acta + Certificación; una candidata REVISADA/APROBADA no bloquea y las informativas pueden decir a la vez `Materia informativa` y `Bloqueado`.
3. Búsqueda, filtros y tabla comparativa no existen.
4. La ayuda actual depende de `title`, no funciona bien con teclado/táctil y no ofrece definición + consecuencia + acción.
5. Las notas de uso para pares ambiguos no existen.
6. El checklist ya tiene seis fases y versiones, pero no es matriz, carece de criticidad/consecuencia y llama `campos editables pendientes` al número de campos obligatorios al generar.
7. Las tarjetas carecen de `aria-pressed` y focus ring; tabs sin `aria-controls/tabpanel`; `min-w-[280px]` y `KeyValue` fijo a 150 px arriesgan 320/390 px.

Brechas sobreestimadas:

- Ya existen grupos, contadores, estados globales, seis fases documentales, versiones actuales/históricas, detección de duplicidad, deep-links y un tab Fuentes. Se evolucionan; no se reconstruyen.
- `SociedadDetalle` ya contiene una tabla parecida, pero su proyección comparte la heurística; solo se reutiliza el patrón visual, no se la toma como regla efectiva.

### 1.3 Contratos

- `vista` está reservado y debe permanecer estable: `resumen|regla|plantillas|fuentes|simular`.
- La presentación del catálogo usará otro parámetro: `presentacion=tarjetas|tabla`.
- Los filtros usarán parámetros estables: `q`, `mayoria`, `formalizacion`, `estado`. Selección y cambios de tab preservarán `scope`, `entity`, `materia` y esos filtros.
- El H1 canónico pasa a `Materias y reglas`; el descriptor `Materias, requisitos y documentos` deja de ser el nombre principal y se actualiza en el mismo cambio de contrato.
- Se mantienen los negativos de jargon y los viajes de Fase 1.

## 2. Decisiones de diseño y dominio

### 2.1 Regla aplicable

- El catálogo Cloud aporta el **mínimo de referencia**.
- Los rule packs activos aportan la **regla aplicable versionada** y sus variantes por órgano. Se agrupan por materia canónica + órgano; si dos packs aplican a órganos distintos, ambos se conservan.
- En ámbito sociedad se resuelve la rama SA/SL/Consejo del payload para mayoría y quórum. En ámbito grupo se muestra que la rama depende del tipo social, sin inventar una sociedad por defecto.
- Cada variante expone: órgano, modos de adopción, mayoría, quórum, documentos reales, formalización y versión del pack.
- `¿Por qué se aplica esta regla?` separa:
  - determinante por requisito: pack/rama y referencia concreta;
  - fuentes revisadas: referencia de catálogo, overrides aplicables, pactos y discrepancias;
  - ausencia de evidencia: fallback explícito `mínimo de catálogo; falta pack activo`.
- La matriz materializada puede mencionarse como estado operativo futuro, pero no decidir ni rotular la fuente.

### 2.2 Búsqueda y filtros

- Búsqueda diacrítico-insensible por label, código/alias, artículo/referencia, documentos del pack, documentos derivados y tipos de plantilla asociados.
- Mayoría filtra por los cinco códigos reales Cloud, con labels jurídicos.
- Formalización es multivalor. Un filtro selecciona pertenencia a Escritura, Registro, Publicación, Archivo interno o Constancia en acta. En sociedad usa la formalización del pack; en grupo usa el mínimo de catálogo. Si difieren, la procedencia queda visible.
- Estado usa exclusivamente `lista|advertencia|revision_legal|bloqueada` de la UI, no el estado homogéneo de la matriz Cloud.
- Contador visible `N de 48`; vacío con acción `Limpiar filtros`.

### 2.3 Gate documental por naturaleza

- Solo una plantilla `ACTIVA` satisface una fase crítica; BORRADOR/REVISADA/APROBADA queda pendiente y bloquea si la fase es de apertura.
- Materias decisorias:
  - Modelo de acuerdo y Acta: criticidad de apertura.
  - Certificación: apertura si la formalización efectiva exige escritura/registro; en las demás, criticidad de cierre.
  - Convocatoria, pre y post-acuerdo: soporte o cierre, salvo regla específica futura; no se inventan bloqueos nuevos.
- Materias informativas:
  - no abren expediente decisorio;
  - Acta/constancia es obligación de cierre, no bloqueo de apertura;
  - Resumen, detalle, checklist, verificación y CTA mostrarán el mismo resultado `No aplica abrir expediente · dejar constancia en acta`.
- El resultado del helper añade estado de apertura (`ready|blocked|not_applicable`), criticidad por fase y consecuencia; `canStartCase` queda verdadero solo para `ready`.

### 2.4 Ayuda y notas de uso

- Patrón accesible común basado en `<details>/<summary>`, activable con teclado y táctil; nunca un botón dentro de la tarjeta-button.
- Cada ayuda contiene labels estables: `Definición`, `Consecuencia`, `Qué hacer`.
- Registro de presentación, sin mutar Cloud, para seis familias ambiguas:
  - modificación estatutaria genérica vs objeto/domicilio/denominación/prórroga;
  - dividendo ordinario vs a cuenta;
  - obligaciones simples vs convertibles;
  - informe de gestión vs formulación/aprobación de cuentas;
  - operación vinculada vs contrato socio único/contratación relevante;
  - Reglamento del Consejo vs modificación estatutaria.
- Cada nota dice usar cuando, no usar cuando y enlaza materias relacionadas preservando contexto.

## 3. Implementación

### T1 — Modelo puro de catálogo y tests

**Nuevo:** `src/lib/secretaria/materia-catalog-ux.ts` y su test.

1. Normalización de búsqueda y alias.
2. Extracción defensiva de documentación real de los dos nodos de payload.
3. Selección de packs por materia canónica y agrupación de variantes por órgano.
4. Resolución de rama de mayoría/quórum por órgano y tipo social, con referencia.
5. Formalización efectiva, discrepancia frente al mínimo y procedencia.
6. Filtros, contador y presentación.
7. Explicación determinante/revisadas.
8. Registro de notas de uso.

### T2 — Política documental y gate coherente

**Archivos:** `mesa-control-societaria.ts`, tests de mesa/status, `ActivarMarcoNormativo.tsx`.

1. Introducir política por materia/formalización y estado `ready|blocked|not_applicable`.
2. Hacer bloqueante una fase crítica sin ACTIVA, incluida candidata pendiente.
3. Modelar constancia informativa como cierre.
4. Añadir criticidad, consecuencia y acción a cada fase.
5. Pasar la materia explícita en todos los consumidores; preservar el comportamiento crítico del wizard de activación.

### T3 — Datos de pantalla y estado URL

**Archivos:** `useRulePacks.ts`, `CatalogoMaterias.tsx`, helper de routing si procede.

1. Cargar rule packs activos también en grupo y overrides solo en sociedad, sin duplicar la misma consulta.
2. Construir por materia la proyección de regla/variantes/documentos/readiness/status.
3. Sincronizar `q`, `mayoria`, `formalizacion`, `estado`, `presentacion`; no tocar IDs de `vista`.
4. Mantener deep-links de alias y materia inexistente.

### T4 — Buscador, filtros y dos presentaciones

1. H1 `Materias y reglas` y barra de búsqueda con label visible.
2. Tres selects visibles y botón limpiar; contador total/filtrado.
3. Toggle accesible Tarjetas/Tabla.
4. Cards con `aria-pressed` y double ring.
5. Tabla comparativa con órgano(s) del pack, mayoría, formalización con procedencia, documentos y estado; acción de detalle con `aria-label`.
6. Scroll horizontal solo interno a 390 px.

### T5 — Regla, fuentes, ayuda y notas

1. Sustituir la heurística visible por variantes de rule pack.
2. Panel `¿Por qué se aplica esta regla?`: determinante por requisito, revisadas y discrepancias.
3. No afirmar Estatutos/Reglamento validados si no hay override publicado.
4. Ayuda estable definición/consecuencia/acción.
5. Notas de uso y navegación a relacionadas sin perder filtros/scope.

### T6 — Checklist documental

1. Reemplazar cards verticales por matriz de seis fases.
2. Columnas: Fase, Criticidad, Estado, Consecuencia, Plantilla vigente/candidata y Acción.
3. Conservar detalle de versiones, duplicidad exacta y enlaces Plantillas/Gestor.
4. Cambiar copy a `Campos obligatorios al generar`.
5. Resultado consistente en Resumen y Verificación, incluida materia informativa.

### T7 — Accesibilidad, contratos y responsive

1. Tabs completos: `aria-controls`, `tabpanel` y navegación de flechas si se mantiene role tab.
2. Reflow de selector y key/value a 320/390 px; double ring en controles nuevos.
3. Actualizar `mesa-control-ui-contract.test.ts` y e2e 08, 12, 21; e2e 34 si cambia la proyección compartida. Revisar 14/16/17/22/24/25 y ejecutar los afectados.
4. Tests de URL para los cinco IDs `vista` y ambos valores `presentacion`.

## 4. Gates y cierre

### 4.1 Gates

1. Tests dirigidos de modelo, readiness, routing y contrato.
2. `bun test` completo.
3. `bun run typecheck`.
4. ESLint de todos los TS/TSX tocados con rutas explícitas.
5. Auditoría Garrigues: cero Tailwind nativo de color, hex o inline colors; a11y de icon-only/ref/focus.
6. `bun run build`.
7. E2E: 08 + navegación 12 + responsive 21 + cualquier contrato tocado; escenario dedicado de Materias si el tamaño aconseja separar.

### 4.2 Verificación en vivo Cloud

Con login demo y ARGA:

- 48 materias visibles antes de filtrar; búsqueda por `308`, `auditoría` y `estado contable` devuelve resultados correctos.
- Filtros combinados y reset; URLs preservadas.
- `AUTORIZACION_GARANTIA` muestra Consejo + Junta, no duplicado.
- `FORMULACION_CUENTAS` muestra Consejo y art. 248.1; `APROBACION_CUENTAS`, Junta y rama SA.
- `DIVIDENDO_A_CUENTA` evidencia la discrepancia Catálogo Registro vs pack sin inscripción.
- Panel distingue determinante y revisadas; pacto ARGA se muestra como contractual.
- Informativa coherente en tarjeta, Resumen, checklist, Verificación y CTA.
- Una candidata no activa no supera un gate crítico.
- Escritorio y 390 px sin overflow global; tabla con scroller interno; ayuda y selección navegables por teclado.

### 4.3 Review adversarial

- Revisor 1: lógica de packs, aliases, variantes, gate y procedencia.
- Revisor 2: UX jurídica, accesibilidad, responsive y tokens.
- Revisor 3: contratos, URL, E2E y contraste con datos Cloud.
- Aplicar P0/P1 y P2 pertinentes; repetir gates afectados. Solo entonces cerrar esta pantalla y auditar Plantillas.

## 5. Escrituras y fuera de alcance

- La auditoría inicial no preveía escritura Cloud. La verificación en vivo descubrió dos entidades españolas con `legal_form=S.L.` y `tipo_social=SA`; el subcarril se detuvo, se creó la migración espejo `20260711154500_secretaria_entity_social_type_coherence.sql` y solo entonces se corrigieron ambos campos por el canal permitido.
- No se corrige aquí la matriz materializada de 31 sociedades.
- No se modifica ni elimina ninguna fila de `materia_catalog`, rule packs o plantillas.
- No se añaden filtros de órgano/adopción fuera del backlog; sí se muestran como atributos multivalor para evitar información falsa.
- No se crea commit ni se prepara el index sin confirmación del usuario.

## 6. Registro de ejecución

**Estado: CERRADA el 2026-07-11.** No se ha creado commit ni se ha preparado el index.

### 6.1 Implementación consolidada

- `CatalogoMaterias` pasa a ser **Materias y reglas**: buscador diacrítico-insensible, filtros URL de mayoría/formalización/estado, contador, tarjetas y tabla comparativa full-width. `vista=resumen|regla|plantillas|fuentes|simular` permanece estable; `presentacion=tabla` es independiente y todos los saltos conservan contexto.
- La regla visible procede de los rule packs activos por materia canónica y órgano. Se preservan variantes Consejo/Junta, ramas SA/SL, ambas convocatorias de quórum y referencias determinantes. Los fallbacks de catálogo se rotulan como mínimos y nunca como fuente versionada.
- Restricciones `restriccionTipoSocial` se interpretan en array/string/JSON: SA/SAU y SL/SRL/SLU se colapsan por familia. Una incompatibilidad real produce `No aplica a esta sociedad`; ausencia o incoherencia del tipo produce revisión legal y bloquea el inicio.
- El gate documental distingue apertura, soporte y cierre. Solo `ACTIVA` satisface una fase crítica; las informativas exigen constancia sin abrir expediente. Certificación se exige en apertura cuando la formalización efectiva es notarial/registral.
- Meta-órganos documentales saneados: informes `SOPORTE_INTERNO` y certificación `DERIVADO_DEL_ACTO` son transversales solo si el tipo no adopta el acuerdo; `CONVOCATORIA/ORGANO_ADMIN` puede cubrir Junta, pero no Consejo; un acta adoptable derivada conserva matching estricto.
- Checklist de seis fases con criticidad, estado, consecuencia, versión vigente/candidata, duplicidad exacta y acciones contextuales. El copy usa `Campos obligatorios al generar`.
- Ayuda accesible con definición/consecuencia/acción y notas de uso para pares ambiguos. Tabs con `aria-controls/tabpanel`, selección con foco al detalle y orden DOM/visual coherente.

### 6.2 Cloud y migración espejo

- `bun run db:check-target` confirmó `governance_OS` (`hzqwefkwsxopwrmtksbg`) antes de escribir.
- La auditoría de 31 sociedades encontró exactamente dos conflictos españoles de familia social: ARGA Digital y ARGA LATAM tenían denominación/`legal_form` S.L., pero `tipo_social=SA`.
- Migración espejo `supabase/migrations/20260711154500_secretaria_entity_social_type_coherence.sql`: DML idempotente acotado por tenant + dos UUID + ES + `legal_form` S.L. + valor previo SA; solo muta `entities`, sin borrar ni renombrar filas.
- El MCP `execute_sql` confirmó modo read-only. Se aplicó el SQL espejo mediante Management API con token del keychain y se registró `20260711154500`, `created_by=codex_management_api`, en `supabase_migrations.schema_migrations`.
- Probes posteriores: 2/2 entidades en ES/S.L./SL; 0 conflictos SA↔SL en el tenant; una sola fila de ledger. Contrato estructural en `secretaria-entity-social-type-coherence-migration.test.ts`.

### 6.3 Gates finales

- `bun test`: **2258 pass, 152 skip, 0 fail**, 258 archivos.
- `bun run typecheck`: limpio.
- ESLint de todos los TS/TSX tocados: 0 errores.
- Auditoría Garrigues de TSX tocados: 0 hex, 0 colores Tailwind nativos y 0 colores inline.
- `bun run build`: limpio; solo avisos conocidos de caniuse/chunks.
- `git diff --check`: limpio.
- E2E afectados 08 + 12 + 21: **23/23 pass**, incluido login demo, contexto URL, meta-órganos Cloud, SA/SL, foco, scroller móvil y ancho de escritorio.

### 6.4 Verificación en vivo con datos Cloud

- 48/48 materias en ARGA; alias art. 308 y Reglamento recuperables; deep-link inexistente conservado y recuperable.
- `FORMULACION_CUENTAS`: Consejo, mayoría del art. 248.1 LSC y cobertura activa; `AUTORIZACION_GARANTIA`: Consejo + Junta.
- `APROBACION_CUENTAS`: lista e iniciable con certificación derivada; `ACCION_SOCIAL_RESPONSABILIDAD` sin pack: revisión legal y 0 CTA de inicio.
- `PRESTACIONES_ACCESORIAS`: ARGA Seguros S.A. muestra `No aplica`, 0 CTA y formalización no aplicable; ARGA Digital S.L. muestra `Aplica a S.L.`, estado lista y CTA operativo.
- `AUMENTO_CAPITAL`: Pre-acuerdo y Certificación transversales aparecen activas; convocatoria de Junta no contamina Consejo.
- Materia informativa coherente como `Solo constancia` en tarjeta, resumen, checklist y verificación.
- 390 px: página sin overflow, tabla con scroller interno y selección que enfoca el detalle; 1440 px: tabla ocupa el ancho sin scroll propio innecesario.

### 6.5 Review adversarial y fixes

Tres revisores cubrieron lógica/Cloud, UX/a11y y datos/migración. No quedaron P0/P1. Se aplicaron todos los P1 confirmados:

1. certificación `DERIVADO_DEL_ACTO` falsamente excluida;
2. Verificación permitía iniciar cuando el estado global exigía revisión legal;
3. `restriccionTipoSocial` se ignoraba;
4. orden visual distinto del orden DOM/foco a 390 px;
5. incoherencia Cloud SA/SL en dos entidades y ausencia de guard defensivo;
6. meta-órganos `SOPORTE_INTERNO`/`ORGANO_ADMIN` excluidos;
7. primera excepción de convocatoria demasiado amplia y contaminante de Consejo.

Cada fix quedó cubierto por test unitario o E2E Cloud y los gates completos se repitieron después del último cambio.
