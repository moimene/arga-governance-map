# Fase 2C — Gobierno de plantillas · Oleada 2 y cierre de coherencia

**Estado inicial:** auditoría de código, Cloud y uso en vivo completada el 2026-07-11.
**Estado de ejecución:** plan aprobado por las decisiones previas del usuario; implementación pendiente.
**Ámbito:** `/secretaria/gestor-plantillas` y sus ocho pestañas existentes.
**Restricción de datos:** esta fase es de presentación y lectura. No requiere ni autoriza escritura Cloud, borrado, archivado o renombre de filas.

## 1. Objetivo y decisiones ya confirmadas

Un perfil jurídico debe poder leer la salud documental en menos de un minuto, abrir una incidencia con su consecuencia y acción, recorrer un catálogo agrupado sin confundir variantes societarias, y revisar las tres capas en lenguaje legal o técnico sin perder datos al editar.

Se mantienen exactamente estos IDs y permisos:

| ID estable | Label visible confirmado |
| --- | --- |
| `dashboard` | Salud documental |
| `catalogo` | Catálogo gobernado |
| `cobertura` | Cobertura por materia y órgano |
| `metricas` | Indicadores de ciclo de vida |
| `auditoria` | Auditoría y changelog |
| `importar` | Importar |
| `validacion` | Comprobación documental |
| `configuracion` | Configuración por sociedad |

La cola de incidencias será una sección de `dashboard`; no se crea una novena pestaña. Los parámetros `?tab=` actuales y el redirect legacy `?tab=metricas` permanecen estables. La vista de las capas usará un parámetro adicional, no destructivo, `modo=legal|tecnica`, con `legal` por defecto.

## 2. Auditoría adversarial previa

### 2.1 Código real

Brechas confirmadas:

1. `TAB_LABELS` conserva los labels antiguos aunque los ocho IDs, el orden y RBAC ya son correctos.
2. `DashboardTab` solo agrega huérfanas, P0 conocidos y gaps core. Puede declarar la biblioteca operativa ignorando revisión legal, cobertura provisional e incidencias de capas.
3. `CatalogoTab` renderiza un `filtered.map` plano. No agrupa por tipo/materia ni colapsa versiones.
4. `TriCapaEditor` no tiene vista Legal/Técnica; Capa 1 es textarea plano, Capa 2 muestra condición en lugar de uso/obligatoriedad y Capa 3 solo presenta el diagnóstico global.
5. El patrón de tabs carece de roving `tabIndex`, flechas/Home/End y altura táctil de 44 px.
6. Durante la carga RBAC, el shell usa la pestaña solicitada como activa y puede montar contenido protegido antes de resolver permisos.

Brechas refutadas:

- No faltan pestañas y no hay que reconstruir rutas o permisos.
- La salud ya tiene resumen, KPIs, error honesto y CTAs; debe ampliarse, no sustituirse.
- El catálogo ya tiene filtros, scope, selección exacta, detalle y handoffs.
- El editor ya es estructurado, auditado y explica el modo solo lectura; no es JSON crudo.
- ITEM-089 y los handoffs de fixtures ya están integrados; no se reabre esa decisión.

### 2.2 Cloud real · `governance_OS`

Probes de solo lectura, proyecto `hzqwefkwsxopwrmtksbg`, tenant demo:

- 110 plantillas: 74 `ACTIVA`, 36 `ARCHIVADA`; 110 ES; 110 con `tipo_social = NULL` (`ANY` según la decisión de Fase 0).
- Cobertura core vigente: 14/14.
- Comprobación documental sobre las 74 activas: 2 bloqueantes, 27 advertencias y 62 informativas; 48 plantillas sin incidencias.
- Única familia funcional activa duplicada real: `CONVOCATORIA_COMISION_DELEGADA` v1.0.0 + v1.1.0. No se archiva en esta fase: queda como incidencia de gobierno.
- Revisión legal activa: 58 aprobadas y 16 que requieren revisión; 14 son versiones 0.x y las otras dos pertenecen a la familia duplicada.
- Trazabilidad formal: una sola fila en `plantilla_changelog`; 73/74 activas y 109/110 totales sin changelog. `audit_log` no contiene eventos identificables del dominio. Cualquier reconstrucción futura deberá marcarse como reconstruida.
- Capa 2: 638 elementos y seis shapes. Capa 3: 535 elementos y diecinueve shapes. El editor actual serializa Capa 2 a tres claves y puede perder extensiones; dos filas legacy de Capa 3 usan `field/hint` y no se reconocen bien.
- Agrupación: 77 grupos `tipo × materia`, pero 89 identidades funcionales exactas. Once grupos contienen varias variantes jurídicas. De 36 históricas, solo 19 tienen vigente exacta; no se inventará sustituta para las otras 17.
- 49 bindings activos y válidos; cero bindings a plantillas ausentes/archivadas. Cero overrides de Capa 3 por sociedad.

Refutación crítica de la hipótesis de duplicados inicial:

- Las v1.1.1 de `NOMBRAMIENTO_CONSEJERO` y `CESE_CONSEJERO` son variantes legítimas Junta/Consejo con contenido distinto.
- Las dos `ACTA_SESION` v1.2.1 son variantes Junta/Consejo distintas.
- No se sanea ni colapsa ninguna de esas filas. Solo se agrupan versiones dentro de la identidad funcional completa.

### 2.3 Verificación viva previa · demo Cloud

Probado a 390, 768 y 1440 px y con teclado:

1. Carrera fixtures/Cloud: el catálogo puede seleccionar una fixture antes de acabar la query; al llegar Cloud, lista y detalle muestran objetos distintos y la fila seleccionada queda miles de píxeles fuera del viewport interno.
2. Los deep-links conservan el UUID, pero no desplazan el scroller hasta la fila exacta.
3. El catálogo activo llega a 88 filas y ~10.000 px internos; decenas se llaman solo “Modelo de acuerdo”.
4. A 1440 px el buscador queda reducido a ~62 px por la densidad de filtros.
5. Las tabs miden 38 px, todas tienen `tabIndex=0` y no responden a flechas. El CTA “Ver” mide ~23 × 20 px.
6. Un `SECRETARIO` que abre `?tab=validacion` ve durante ~0,8 s el panel protegido antes del redirect.
7. En solo lectura el editor añade 51 controles al recorrido de teclado.
8. En Auditoría el changelog empieza tras miles de píxeles de evidencia forense global; `focus=sin-changelog` abre una tabla de 73 filas sin límite vertical.
9. Indicadores renderiza las 110 filas en una tabla de ~8.400 px.
10. Materias → Gestor conserva contexto, pero presenta el código raw (`DISOLUCION`) dentro del buscador en vez de un chip jurídico.

El scan previo del Gestor dio cero hex, colores Tailwind nativos o estilos inline de color.

## 3. Diseño de solución

### 3.1 Navegación y RBAC

- Centralizar orden y labels en `tab-guards.ts`; no derivar el orden de un objeto accidental.
- Mientras identidad/tenant/roles cargan, montar solo un estado neutro. Nunca montar el componente de `requestedTab`.
- Canonicalizar tab inválida a `?tab=dashboard` una vez resuelto RBAC.
- Implementar patrón ARIA completo: una tab en el orden de foco, flechas izquierda/derecha, Home/End, paneles con IDs existentes, foco visible, `min-h-11` y scroll horizontal local sin wrap destructivo.
- Todo cambio de tab preservará `scope`, `entity`, `materia`, `plantilla`, `estado`, `focus`, `q` y `modo` salvo el parámetro incompatible que ya limpia el helper canónico.

### 3.2 Cola unificada de incidencias

Crear un builder puro con este contrato conceptual:

`id · concepto · severidad · afectados · consecuencia · acción · destino · códigos técnicos`

Fuentes canónicas, sin crear un detector paralelo:

- `buildLegalTemplateReviewRows` para versión provisional, aprobación, referencia, órgano/adopción y equivalencia activa;
- `buildLegalTemplateCoverage` y `computeCoreCoverage` para cobertura vigente, en preparación, provisional y ausente;
- `validateTemplateForActivation` para incidencias de capas;
- `list/countOrphanTemplates` para changelog;
- `KNOWN_P0_TEMPLATE_IDS` para P0 tolerados si reaparecen.

Reglas de agregación:

- Solo las activas afectan a la salud vigente; históricos incompletos no se convierten en bloqueos actuales.
- Deduplicar por `plantilla + concepto`; una equivalencia activa se cuenta por clave funcional, no por cada fila ni de nuevo como issue de metadatos.
- Los `META_*` ya expresados por revisión legal no se vuelven a sumar desde la comprobación documental.
- Orden: bloqueos/incidencias → advertencias → informativas.
- Cada fila mostrará título jurídico, número de afectados, consecuencia y acción. Los códigos técnicos solo serán detalle secundario en modo técnico.
- Los destinos respetarán RBAC. Un `SECRETARIO` irá al Catálogo/Cobertura/Auditoría, nunca a una tab de Validación que no puede abrir.

La línea ejecutiva solo dirá “Operativo” si no hay errores ni advertencias. La ausencia masiva de changelog se describirá como trazabilidad pendiente, nunca como historial completo.

### 3.3 Catálogo agrupado sin ocultar variantes

Jerarquía:

`tipo documental → materia canónica → identidad funcional completa → versiones`

La identidad funcional reutiliza `buildFunctionalKey`:

`tenant + tipo + jurisdicción + materia canónica + órgano canónico + adopción + tipo social`.

- Las versiones se colapsan solo dentro de esa identidad.
- La cabecera de familia muestra órgano, adopción, jurisdicción y tipo social para distinguir variantes.
- La versión vigente será cabeza cuando exista; una serie solo histórica se rotula “Sin versión vigente comparable”.
- Una versión histórica deep-linked expande su familia, mantiene el UUID exacto en `?plantilla=` y desplaza solo el scroller interno hasta su fila.
- La selección por defecto esperará a que termine la query Cloud antes de mezclar fixtures, eliminando la carrera observada.
- `materia` será contexto exacto y visible como chip con `labelMateria`; la búsqueda libre usará `q`, sin convertir códigos internos en copy visible.
- La barra de búsqueda y filtros se dividirá en una grid que preserve un ancho útil del buscador. Todos los controles tendrán `min-h-11` y ring Garrigues.

### 3.4 Editor tri-capa lossless y Legal/Técnica

Crear adaptadores puros que:

- acepten aliases `variable/name`, `fuente/source`, `condicion/condition`, `campo/name/field`, `descripcion/description/hint` y los shapes reales;
- conserven todas las claves adicionales y el estilo de claves original al serializar;
- construyan una vista canónica para validación sin reescribir Cloud por leer;
- preserven `default`, `opciones`, labels, tipos, validaciones y metadatos jurídicos desconocidos.

**Vista Legal (por defecto):**

- Capa 1 renderizada como texto escapado en React, sin `dangerouslySetInnerHTML`, con tokens de variable resaltados por namespace y una etiqueta textual que no dependa solo del color.
- Capa 2 como tabla `Variable → Fuente → Uso en el texto → Obligatoriedad`. El uso soportará exactos y wildcards. La obligatoriedad usará el dato explícito cuando exista y, si no, distinguirá “Siempre/Condicional/No informada” sin inventar un campo Cloud.
- Capa 3 como fichas/tabla con label jurídico, tipo, obligatoriedad, descripción y validación junto al campo.
- Notas legales legibles, UUIDs/códigos relegados.

**Vista Técnica:**

- Mantener el editor estructurado de borradores, fuente/condición raw, identificadores y códigos de comprobación.
- Validación por fila con `aria-invalid` y `aria-describedby`.
- En solo lectura, inputs/textareas técnicos no formarán parte del recorrido normal de Tab.
- Guardado solo si no hay bloqueos de capas; la serialización será lossless y mantendrá changelog.

El selector `modo=legal|tecnica` vivirá en el contexto del contenido del catálogo y persistirá al cambiar de pestaña.

### 3.5 Auditoría e indicadores

- En Auditoría, poner primero la trazabilidad específica de plantillas: huérfanas con scroller vertical limitado y changelog inmediatamente después.
- Eliminar el resumen huérfano duplicado.
- Mover la evidencia forense global a un disclosure cerrado y montarla solo bajo demanda, evitando cargar enlaces firmados antes de que el usuario la solicite.
- Presentar el empty state real de overrides (Cloud tiene 0), sin insinuar actividad.
- En Indicadores, declarar que “días en estado/última actualización” son estimaciones con los timestamps disponibles mientras el changelog histórico esté incompleto.
- Limitar la tabla a un scroll region con header sticky para evitar una página de 8.400 px; conservar el drill-down completo sin fingir paginación o datos inexistentes.

## 4. Plan de implementación

### T1 — Helpers puros y tests de caracterización

**Nuevos:**

- `src/lib/secretaria/template-governance-ux.ts`
- `src/lib/secretaria/template-layer-ux.ts`
- tests unitarios homónimos bajo `src/lib/secretaria/__tests__/`

Cubrir:

1. agregación, severidad y deduplicación de incidencias;
2. variante Junta/Consejo preservada y versiones colapsadas solo por identidad exacta;
3. histórica sin vigente y selección exacta;
4. normalización/serialización lossless de los shapes legacy/reales;
5. tokens de namespace, referencias exactas/wildcard y obligatoriedad;
6. validación contextual de Capa 3.

### T2 — Shell, labels, teclado y guard RBAC

**Archivos:**

- `src/pages/secretaria/GestorPlantillas.tsx`
- `src/components/secretaria/gestor/tab-guards.ts`
- test nuevo de tabs/shell si el harness lo permite

Aplicar labels confirmados, orden explícito, estado neutro de carga, canonicalización de URL, roving focus y targets de 44 px.

### T3 — Salud e incidencias

**Archivos:**

- `src/components/secretaria/gestor/DashboardTab.tsx`
- `src/components/secretaria/gestor/AlertBanner.tsx`
- test nuevo de componente/builder

Sustituir alertas parciales por cola priorizada, mantener KPIs útiles y corregir la frase de salud. Los CTAs tendrán consecuencia/acción y tamaño táctil.

### T4 — Catálogo gobernado

**Archivos:**

- `src/components/secretaria/gestor/CatalogoTab.tsx`
- helper de agrupación de T1
- tests de componente o helper

Separar contexto `materia` de `q`, eliminar carrera de carga, agrupar, colapsar versiones, expandir deep-link histórico, revelar la selección y rehacer la grid de filtros.

### T5 — Editor tri-capa

**Archivos:**

- `src/components/secretaria/gestor/TriCapaEditor.tsx`
- `src/components/secretaria/gestor/__tests__/TriCapaEditor.test.tsx`
- helpers lossless de T1

Implementar vistas Legal/Técnica, preview segura por namespace, tabla Capa 2, validación Capa 3, ARIA y preservación de todas las formas JSON.

### T6 — Auditoría, indicadores y densidad

**Archivos:**

- `src/components/secretaria/gestor/AuditoriaTab.tsx`
- `src/components/secretaria/gestor/MetricasTab.tsx`

Reordenar trazabilidad, diferir evidencia forense, limitar tablas y corregir copy de precisión.

### T7 — Contratos coordinados

**Archivos mínimos:**

- `src/test/secretaria/mesa-control-ui-contract.test.ts`
- `e2e/14-secretaria-documentos.spec.ts`
- `e2e/17-secretaria-template-context.spec.ts`
- `e2e/21-secretaria-gestor-plantillas-tabs.spec.ts`
- `e2e/22-secretaria-gestor-import-wizard.spec.ts`
- `e2e/24-secretaria-gestor-rbac.spec.ts`
- `e2e/25-secretaria-tracker-redirect.spec.ts`
- 08/12/16/21-responsive/25-journeys solo donde el contrato compartido cambie

Fijar labels nuevos, IDs estables, teclado, no-FOUC, agrupación, deep-link exacto, chip de materia, modo Legal/Técnica, cola y vista a 390 px. No reinterpretar los fallos históricos de e2e/14 y e2e/17 como regresión de esta fase.

## 5. Gates y cierre

### 5.1 Gates locales

1. Tests dirigidos de helpers/componentes durante T1–T6.
2. `bun test` completo.
3. `bun run typecheck`.
4. ESLint de cada `.ts/.tsx` tocado, con rutas explícitas.
5. Scan Garrigues de lo tocado: cero hex, Tailwind de color nativo, nombres de color o inline color; focus visible, icon-only con `aria-label`, campos inválidos con ARIA.
6. `git diff --check`.
7. `bun run build`.
8. E2E afectados, al menos 14, 17, 21-tabs, 21-responsive, 22, 24 y 25-tracker; regresión 08, 12, 16 y 25-journeys si los contratos compartidos lo exigen.

### 5.2 Verificación en vivo

Con `demo@arga-seguros.com` y datos Cloud:

- cinco tabs de lectura con labels nuevos; tres de escritura siguen ocultas para `SECRETARIO`;
- deep-link protegido nunca muestra contenido antes del redirect;
- flechas/Home/End y foco cumplen el patrón de tabs;
- salud cuenta la familia activa duplicada una vez, muestra trazabilidad pendiente y separa advertencias/informativas;
- Catálogo muestra tipo → materia → variante → versiones, preserva Junta/Consejo y revela el UUID deep-linked;
- `materia=DISOLUCION` se ve como “Materia: Disolución”, no como texto raw del buscador;
- Legal/Técnica persiste en URL; Capa 1 tiene namespaces, Capa 2 uso/obligatoriedad y Capa 3 validación visible;
- Auditoría muestra changelog antes de evidencia global; la evidencia no carga hasta abrirla;
- 390, 768 y 1440 px sin overflow global, buscador colapsado, fila seleccionada invisible o targets menores de 44 px.

Guardar datos observados, URLs y resultados en el registro de ejecución de este plan.

### 5.3 Review adversarial

Después de gates y vivo:

- revisor 1: identidad funcional, agrupación, incidencias y preservación JSON;
- revisor 2: UX/copy/accesibilidad/tokens y móvil;
- revisor 3: navegación, RBAC, contratos/E2E y ausencia de mutaciones Cloud.

Aplicar P0/P1 y P2 pertinentes, repetir gates afectados y solo entonces cerrar Fase 2C.

## 6. Fuera de alcance

- Archivar la duplicada activa de `CONVOCATORIA_COMISION_DELEGADA` o cambiar sus bindings.
- Reconstruir changelog retrospectivo, aunque la UI explique cómo debe marcarse.
- Workflow avanzado de promoción, responsables, exportación de auditoría o analítica de uso (Workstream C).
- Cambiar IDs de tabs, permisos, filas de catálogo o schema Cloud.
- Commit, stage o push sin confirmación expresa del usuario.

## 7. Registro de ejecución y cierre — 2026-07-11

### 7.1 Resultado implementado

- Shell con los ocho IDs estables y labels jurídicos acordados; cinco tabs de lectura para `SECRETARIO`, tres tabs de escritura solo para `ADMIN_TENANT`.
- Tabs accesibles con roving focus, flechas, Home/End, targets de 44 px, overflow local y canonicalización de `?tab=` inválida.
- Estado neutro durante resolución de identidad/tenant/RBAC: ningún componente protegido se monta antes de conocer los permisos.
- Salud documental y cola única de incidencias con consecuencia, acción, severidad y deep-link exacto, sin declarar “Operativo” cuando existen advertencias.
- Catálogo agrupado por tipo → materia → identidad funcional → versiones; preserva variantes jurídicas, expande una histórica deep-linked y desplaza únicamente el scroller interno hasta la fila exacta.
- Contexto `materia` separado de la búsqueda `q`; navegación interna conserva `scope`, `entity`, `materia`, `plantilla`, `estado`, `q` y `modo`.
- Editor tri-capa Legal/Técnica con preview React segura, fuentes y tipos humanizados, uso/obligatoriedad, validación contextual, serialización lossless y protección frente a guardados concurrentes.
- Auditoría reordenada (huérfanas → changelog → ajustes → evidencia general), evidencia forense diferida, tablas limitadas con región accesible y jerga de versiones traducida.
- Indicadores declaran la naturaleza estimada de los timestamps y limitan la tabla con header sticky.

### 7.2 Hallazgos adversariales aplicados

Los tres revisores cerraron sin hallazgos pendientes después de aplicar:

1. preservación de contexto en Dashboard/Auditoría/Importar y apertura del borrador recién creado mediante su UUID;
2. CTA de importación oculto en estado vacío sin permiso;
3. contraste AA de severidades, copy Legal sin códigos raw, targets/foco de tabs ADMIN y regiones de scroll nombradas;
4. validación `aria-invalid` por fila para variables duplicadas y explicación de solo lectura según rol/estado/fixture;
5. parser compartido de expresiones para Unicode, argumentos `#if/#each` y declaraciones wildcard, eliminando falsos positivos reales del Gate;
6. Capa 3 protegida case-insensitive, requisitos legacy booleano+texto preservados y defaults/opciones no textuales en solo lectura para evitar coerción silenciosa;
7. guardado dirty-only con CAS `estado=BORRADOR`, comprobación de fila actualizada y rollback condicionado;
8. espera conjunta de tenant, entidades, query Cloud y RBAC antes de fixtures, filtros o estados vacíos;
9. remount del detalle por UUID para que incidencias/ack de una plantilla no sobrevivan a otra selección;
10. E2E anti-FOUC determinista retrasando `rbac_user_roles` y deep-link real a una histórica no-head.

### 7.3 Evidencia Cloud y vivo

- Inventario observado: 110 plantillas (74 activas, 36 archivadas), cobertura obligatoria 14/14, una familia activa duplicada y 73 activas sin changelog.
- Salud en vivo tras calibrar el Gate: `Con incidencias`, 1 incidencia y 7 advertencias; los casos informativos de variable declarada/no usada bajaron de 20 a 16 al retirar falsos positivos Unicode/helper/wildcard.
- `FORMULACION_CUENTAS` (`bc49965f-2c0b-4778-9751-163f87fcbff6`): `año_ejercicio` aparece usada, `secretario_manual` se presenta como “Introducción manual”, y los tipos se muestran como “Número”, “Texto largo” y “Sí / No”.
- Histórica `1b1118a6-577d-45ed-96ee-77be89358aa0`: familia expandida, fila `Versión 1.2.0 · Archivada` visible dentro del scroller y UUID preservado.
- Auditoría a 390 px: orden correcto, ancho `390/390`, `EvidenceForenseSection` ausente antes de abrir el disclosure y montado después.
- Dashboard/Catálogo a 390 y 1440 px: sin overflow global; tablist, filtros y CTAs visibles con 44 px.
- No hubo escrituras Cloud en Fase 2C.

### 7.4 Gates finales

- `bun test`: **2327 pass, 152 skip, 0 fail** (2479 tests; skips condicionados de probes/destructivos).
- `bun run typecheck`: limpio.
- ESLint de todos los `.ts/.tsx` modificados o nuevos: limpio.
- Scan Garrigues: cero colores Tailwind nativos, hex o inline color en el ámbito tocado.
- `git diff --check`: limpio.
- `bun run build`: limpio; solo avisos preexistentes de `caniuse-lite` y tamaño de chunks.
- E2E coordinados 08, 12, 14, 16, 17, 21-tabs, 21-responsive, 22, 24 y 25: **57 pass, 1 skip ADMIN esperado, 0 fail**.

**Estado:** Fase 2C cerrada; criterios de aceptación del Workstream B completos.
