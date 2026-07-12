# UX Configuración Secretaría — Fase 2B · Plantillas

> **Estado:** plan de ejecución aprobado por el plan marco. Se redacta después de la auditoría adversarial y antes de editar la pantalla, conforme al método de esta conversación.

## 1. Objetivo y alcance

Completar `/secretaria/plantillas` como biblioteca jurídica operativa:

- comparar una versión histórica con su vigente cuando el linaje sea seguro;
- explicar qué acción corresponde en cada estado sin confundir `ACTIVA` con versiones de preparación utilizables por la política transitoria;
- cerrar los defectos de aprobación, auditoría y binding descubiertos contra el código real;
- hacer persistentes y accesibles las pestañas, y llevar la selección móvil al detalle;
- presentar correctamente `tipo_social NULL` y los dos contratos Cloud de checklist;
- mantener los viajes y parámetros ya resueltos en Fase 1.

No se borran, renombran, archivan ni retipan filas Cloud. Esta fase no necesita escritura de datos: si la verificación en vivo descubre lo contrario, se detendrá el subcarril y se aplicará el protocolo migración espejo + canal permitido + verificación.

## 2. Guardarraíles

- Tokens Garrigues exclusivamente; cero colores Tailwind nativos, hex o estilos inline de color.
- TypeScript relajado: tipar boundaries y helpers, no anotar por inercia.
- Mantener `?tab=`/`?vista=` existentes. En esta página se reutiliza el parámetro ya contratado `tipo=MODELO_ACUERDO` para persistir la pestaña Modelos; Proceso es el estado por defecto y elimina `tipo`.
- Actualizar `src/test/secretaria/mesa-control-ui-contract.test.ts` y los e2e afectados en el mismo cambio.
- Conservar `data-testid="plantillas-mobile-list"` y `plantillas-desktop-table`.
- No modificar la política 2026-06-26 de `isOperationalTemplate`: ACTIVA, APROBADA y ciertas candidatas revisadas pueden ser utilizables. La UI debe distinguirlas; no equipararlas verbalmente.
- `tipo_social NULL` en una plantilla significa `Todos los tipos sociales`. `ANY` explícito queda reservado a bindings.
- No inferir linaje histórico desde texto libre ni elegir una candidata ambigua como si fuera sustituta autoritativa.
- Sin `git add` ni commit hasta nueva confirmación del usuario.

## 3. Auditoría adversarial

### 3.1 Evidencia Cloud real

Consultas read-only contra `governance_OS` (`hzqwefkwsxopwrmtksbg`):

| Evidencia | Resultado |
|---|---:|
| Plantillas | 110 |
| `ACTIVA` | 74 |
| `ARCHIVADA` | 36 |
| En preparación | 0 |
| `MODELO_ACUERDO` | 70 total / 57 activas |
| Jurisdicción ES | 110/110 |
| `tipo_social NULL` | 110/110 |
| `tipo_social ANY` o concreto | 0 |
| Históricas con sustituta exacta por identidad funcional canónica | 19/36 |
| Históricas sin sustituta exacta | 17/36 |
| Sustituciones exactas ambiguas | 0 |
| Duplicados activos exactos por identidad + versión | 0 |

Matices de calidad:

- Las 74 activas tienen órgano; las tres adopciones NULL pertenecen a certificación/informes no adoptables.
- Las 74 activas tienen referencia y capas no vacías; 26 carecen de `contrato_variables_version`.
- `approval_checklist` usa dos shapes: 19 plantillas activas con objetos `{check, passed}` y 18 con arrays de strings. La UI actual trata los strings como objetos y pinta checks rojos sin texto.
- La regex de notas busca `PENDIENTE` sin límites de palabra y marca falsamente `independiente`.
- ARGA Seguros tiene `legal_form='S.A.'` y `tipo_social='SA'`. Los bindings Cloud válidos usan `ANY/SA/SAU/SL/SLU`; no existe contaminación con `S.A.`.
- El claim e2e de “17 modelos LSC” está obsoleto: hay 57 modelos vigentes.

### 3.2 Brechas confirmadas

#### P1

1. **Comparación ausente.** La histórica exacta solo permite `Ver versión vigente`; no existe `Comparar con vigente` ni diff.
2. **Aprobación imposible.** `REVISADA → APROBADA` llama la mutación sin `aprobadaPor` ni `fechaAprobacion`, aunque el servicio exige ambos.
3. **Auditoría falsa.** La confirmación promete traza, pero la pantalla no envía `actor` y el hook registra `system`.
4. **Binding inválido.** El CTA envía `selectedEntity.legalForm` (`S.A.`) como `tipoSocial`, en lugar de `selectedEntity.tipoSocial` (`SA`). El binding creado no resolvería para la sociedad.
5. **Detalle móvil inalcanzable.** Seleccionar una tarjeta no enfoca ni desplaza el detalle; con 17 tarjetas queda miles de píxeles fuera del viewport.
6. **Pestañas no persistentes ni accesibles.** El estado activo depende del color, no hay semántica tab/teclado y Modelos se pierde al recargar porque la URL no conserva `tipo=MODELO_ACUERDO`.

#### P2 pertinentes

- Las 17 históricas sin sustituta exacta no reciben explicación ni siguiente paso.
- `Activa`, `Vigente · lista para usar` y `Lista para usar` se solapan sin distinguir ciclo de vida y disponibilidad transitoria.
- El CTA de binding no reconoce una vinculación ya efectiva y permite una mutación redundante.
- El error secundario de `useTemplateBindings` se ignora y la UI aparenta una carga completa.
- Los segmentos de ciclo miden 28 px en móvil; deben alcanzar 44 px.
- `tipo_social NULL` no se expresa en el detalle.
- `approval_checklist` legacy se representa incorrectamente.
- La regex de notas genera el falso positivo `independiente`.
- `ciclo` inválido cae visualmente a Vigentes pero no normaliza la URL.

### 3.3 Brechas sobreestimadas o ya resueltas

- No procede una columna/filtro de tipo social mientras 110/110 filas sean NULL. Se mostrará la semántica en el detalle y se mantendrá preparada la etiqueta canónica; la columna queda condicionada a que exista al menos una fila tipada en Cloud.
- Ya funcionan la segmentación de ciclo, salud documental, órgano/adopción, carga/error principal, responsive tabla/tarjetas, alias de materia, deep-link de plantilla, recuperación de target inválido y el viaje Materias → Plantillas → Gestor → Materias.
- No hay duplicados exactos activos que sanear. Las variantes CESE/NOMBRAMIENTO/ACTA_SESION se conservan.
- La traducción jurídica de `Configuración de uso` y comprobación documental se completó en Fase 1.
- `isOperationalTemplate` amplio es una política deliberada y testeada, no un bug. La corrección es de presentación y acciones por estado.

## 4. Diseño de la solución

### 4.1 Linaje y comparación segura

La comparación automática solo se habilita si existe exactamente una `ACTIVA` con la misma identidad funcional canónica:

`tenant + tipo + jurisdicción + materia canónica + órgano canónico + adopción + tipo social`.

No se usarán `notas_legal` ni coincidencias laxas como autoridad. Si no hay exacta:

- mostrar `Sin versión vigente comparable`;
- explicar que pudo cambiar la identidad documental y que no se inferirá una sustituta;
- conservar el acceso a Gobierno de plantillas para investigación.

El comparador será un helper puro que normaliza ambos shapes legacy antes de enfrentar:

- texto literal protegido (diff por líneas, con altas/bajas y textos completos bajo detalle);
- referencia legal;
- variables automáticas por nombre/fuente/condición;
- campos editables por campo/obligatoriedad;
- metadatos de uso relevantes;
- checklist normalizado.

La UI será una sección de ancho completo debajo del master-detail, no un modal estrecho: encabezado Histórica vX ↔ Vigente vY, resumen de cambios, diff accesible, textos completos plegables y botón cerrar. Al abrir, la sección recibe foco y scroll; en móvil apila ambas versiones.

### 4.2 Matriz de presentación y acciones por estado

| Estado/condición | Disponibilidad visible | Acción de uso |
|---|---|---|
| `ACTIVA` y operativa | `Vigente para nuevos expedientes` | CTA primario de uso; binding en sociedad |
| `APROBADA` operativa | `Aprobada · utilizable en preparación` | CTA secundario con aviso de que aún no es vigente |
| `BORRADOR/REVISADA` con aprobación transitoria | `Versión de preparación con validación legal` | CTA secundario con explicación de política transitoria |
| `BORRADOR/REVISADA` no operativa | `Pendiente de completar el ciclo` | Administrar/continuar gobierno |
| `ARCHIVADA/DEPRECADA` | `Solo consulta histórica` | comparar/ver sustituta o estado explícito sin comparable |

Se mantiene el estado técnico (`Activa`, `Aprobada`, etc.) como dato de ciclo, pero no se reutiliza como descripción de disponibilidad.

### 4.3 Aprobación y actor

- `REVISADA → APROBADA` abre un diálogo con labels visibles `Aprobada por` y `Fecha de aprobación`, ambos obligatorios.
- La fecha se inicializa al día actual; el aprobador requiere confirmación explícita.
- Todas las transiciones envían `actor = user.email ?? displayName`; nunca usan el aprobador como actor ni caen a `system` desde una sesión humana.
- El diálogo de advertencias conserva actor y metadatos pendientes al reintentar.
- Se mantiene una sola confirmación final y `aria-busy` durante la mutación.

### 4.4 Binding correcto e idempotente en UI

- Resolver el valor desde `selectedEntity.tipoSocial`; fallback defensivo a `ANY` solo si no existe un valor canónico.
- Nunca enviar `legalForm` al campo `tipo_social`.
- Calcular si ya existe un binding efectivo de esa plantilla para materia, jurisdicción, tipo social, órgano y adopción. En tal caso mostrar `Ya vinculada a esta regla` y deshabilitar la mutación.
- Mantener `templateSelectionReason` y la auditoría del RPC para una vinculación nueva.

### 4.5 Tabs, URL, foco y tactilidad

- `role=tablist`, `role=tab`, `aria-selected`, `aria-controls` y panel enlazado.
- Teclado: flechas izquierda/derecha y Home/End, con activación y foco coherentes.
- Modelos escribe `tipo=MODELO_ACUERDO`; Proceso elimina `tipo`. Seleccionar una plantilla mantiene el valor coherente con su tipo.
- Normalizar `ciclo` inválido a `vigentes` también en URL.
- En móvil, seleccionar tarjeta enfoca y desplaza el panel de detalle; en escritorio conserva el flujo actual.
- Segmentos e incidencias accionables: `min-h-11` en móvil y foco doble visible.

### 4.6 Normalización de datos de lectura

- Ampliar el tipo `approval_checklist` a unión de string/objeto.
- Normalizar string a label humanizado y estado completado, sin convertirlo en fallo.
- Normalizar campos legacy de Capa 2 (`variable|name`, `fuente|source`) y Capa 3 (`campo|name`, `obligatoriedad|required`) dentro del comparador, sin escribir Cloud.
- Cambiar la regex a tokens con límites de palabra para que `independiente` no active `PENDIENTE`.
- Tratar el fallo de bindings como error de configuración recuperable; no presentar una biblioteca supuestamente completa con links parciales.

## 5. Tareas de implementación

### T1 — Helpers puros y contratos de datos

**Archivos:**

- Crear `src/lib/secretaria/template-library-ux.ts`.
- Crear `src/lib/secretaria/__tests__/template-library-ux.test.ts`.
- Modificar `src/hooks/usePlantillasProtegidas.ts`.
- Modificar `src/lib/secretaria/legal-template-review.ts` y su test.

Cobertura mínima:

- matriz de disponibilidad por estado;
- comparación idéntica y modificada;
- diff con líneas añadidas/eliminadas;
- normalización Capa 2/3 y checklist de ambos shapes;
- histórica con/sin sustituta exacta;
- binding efectivo por `SA|ANY` y rechazo de `S.A.` como payload;
- `independiente` no dispara revisión; `pendiente` sí.

### T2 — Comparación y acciones por estado

**Archivo:** `src/pages/secretaria/Plantillas.tsx`.

- Integrar helper y sección de comparación.
- Añadir `Comparar con vigente`, `Ver versión vigente` y estado sin comparable.
- Mostrar `Tipo social: Todos los tipos sociales` en detalle/configuración.
- Sustituir el copy genérico de disponibilidad por la matriz.
- Mantener CTA transitorio solo con copy/tono/explicación distintos del vigente.
- Normalizar checklist antes de renderizar.

### T3 — Ciclo de aprobación, auditoría y binding

**Archivos:** `Plantillas.tsx` y tests dirigidos.

- Diálogo de aprobación formal.
- Actor autenticado en todas las transiciones y reintentos.
- `tipoSocial` canónico en binding.
- Estado `Ya vinculada` sin mutación redundante.
- Error de bindings recuperable.

### T4 — Tabs, URL, foco y responsive

**Archivo:** `Plantillas.tsx`.

- Tabs ARIA/teclado y persistencia `tipo`.
- Canonicalización de `ciclo` inválido.
- Foco/scroll al detalle móvil y a la comparación.
- Targets táctiles de 44 px.
- Cero overflow a 390/768/1440 px.

### T5 — Contratos y e2e

**Archivos:**

- `src/test/secretaria/mesa-control-ui-contract.test.ts`.
- `e2e/08-secretaria-plantillas.spec.ts`.
- `e2e/17-secretaria-template-context.spec.ts` si cambia el deep-link contratado.
- `e2e/21-secretaria-responsive.spec.ts`.

Casos:

1. tabs ARIA, teclado y persistencia tras reload;
2. inventario sin claim obsoleto de 17 modelos;
3. histórica exacta abre comparación, muestra resumen/diff y permite ir a vigente;
4. histórica sin exacta explica que no hay comparable;
5. selección móvil lleva foco y viewport al detalle;
6. targets táctiles ≥44 px;
7. `tipo_social NULL` se presenta como todos;
8. viajes y parámetros F1 siguen intactos.

Los tests de mutación de aprobación/binding serán unitarios/mockeados; la verificación en vivo no ejecutará transiciones ni bindings destructivos sobre Cloud.

## 6. Gates y cierre

1. Tests dirigidos de helpers, revisión legal, hooks/servicio y contrato UI.
2. `bun test` completo.
3. `bun run typecheck`.
4. ESLint de todos los TS/TSX tocados.
5. Scan Garrigues de colores prohibidos/inline colors.
6. `bun run build`.
7. E2E afectados con login demo: 08, 17 si procede y 21.
8. Verificación en vivo, con datos Cloud reales y sin mutaciones:
   - 74 vigentes / 36 históricas;
   - histórica con sustituta exacta y comparación;
   - histórica sin comparable;
   - Modelos persiste en URL/reload;
   - tipo social se lee como todos;
   - móvil enfoca detalle y no desborda.
9. Tres reviews adversariales paralelas:
   - lógica/linaje/datos y mutaciones;
   - UX/copy/a11y/tokens/responsive;
   - contratos/e2e/URL/regresiones transversales.
10. Aplicar P0/P1 y P2 pertinentes, repetir gates afectados y documentar evidencia post-review.

Solo después se marcará Fase 2B cerrada y comenzará la auditoría previa de Fase 2C.

## 7. Ejecución y cierre — 2026-07-11

> **Estado final: CERRADA.** Auditoría, implementación, verificación Cloud/demo y revisión adversarial completadas. No quedan P0, P1 ni P2 accionables del alcance revisado.

### 7.1 Implementación realizada

- Comparador seguro histórica ↔ vigente por identidad funcional exacta, con diff por líneas, resumen por sección, textos completos y estado explícito cuando no existe sustituta inequívoca.
- Matriz de disponibilidad separada del estado técnico; checklist y capas legacy normalizados para los shapes reales de Cloud, incluidos `name/source/display` y `field/hint`.
- Aprobación formal con aprobador y fecha no futura; actor autenticado independiente; diálogo de warnings con foco, trap, Escape, busy y retorno estable tras éxito.
- Builders puros y testeados para transición y binding. El binding usa `tipoSocial` canónico, devuelve `null` si ya es efectivo y nunca persiste una materia compuesta que no exista en el catálogo.
- Handoff multi-materia endurecido: el modelo `e3697ad9-e0c2-4baf-9144-c80a11808c07` conserva `FUSION`, reconoce también `ESCISION` y no ofrece `CESION_GLOBAL_ACTIVO` como fila canónica inexistente.
- Tabs persistentes y accesibles sobre panel ARIA estable; foco/scroll de selección móvil, comparación y salto a vigente; scroll interno accesible y targets de 44 px.
- Labels jurídicos de presentación completados para los códigos de proceso reales, sin renombrar ni borrar filas Cloud. El filtro `Cohorte` se presenta como `Calidad documental`.
- Errores de plantillas, bindings y catálogo canónico se muestran como carga incompleta recuperable.

### 7.2 Evidencia de datos y verificación viva

- `governance_OS`: 110 plantillas, 74 `ACTIVA`, 36 `ARCHIVADA`, 57 modelos vigentes y 110/110 con `tipo_social NULL` (presentado como `Todos los tipos sociales`).
- Linaje exacto: 19/36 históricas con una vigente exacta, 17/36 sin exacta y 0 ambiguas.
- Casos vivos verificados: histórica `1b1118a6…` → vigente `2c15640c…`; histórica `4511327a…` sin sustituta; handoff multi-materia `e3697ad9…` con `FUSION`.
- Responsive vivo a 390/768/1440 px: sin overflow, targets ≥44 px y foco íntegro.
- Esta fase no ejecutó mutaciones Cloud ni modificó filas de `plantillas`/`materia_catalog`.

### 7.3 Gates finales

- `bun test`: **2283 pass, 152 skip, 0 fail**; 1 snapshot; 261 archivos.
- `bun run typecheck`: limpio.
- ESLint de todos los TS/TSX y e2e tocados: limpio.
- Scan Garrigues: 0 colores Tailwind nativos, 0 hex y 0 inline colors prohibidos.
- `bun run build`: limpio; solo warnings preexistentes de Browserslist/chunks.
- `git diff --check`: limpio.
- Playwright con login demo y datos Cloud, en ejecuciones aisladas con autenticación fresca:
  - `e2e/08-secretaria-plantillas.spec.ts`: **17/17** incluyendo setup;
  - `e2e/17-secretaria-template-context.spec.ts`: **4/4** incluyendo setup;
  - `e2e/21-secretaria-responsive.spec.ts`: **8/8** incluyendo setup.

Una ejecución combinada larga rotó/perdió la sesión demo después de los primeros casos y redirigió a `/login`; los tres ficheros repetidos de forma aislada con autenticación nueva quedaron íntegramente verdes. No se clasificó esa caída de sesión como regresión funcional de esta fase.

### 7.4 Review adversarial post-fix

Tres carriles revisaron linaje/datos/mutaciones, UX/a11y/responsive/tokens y contratos/Cloud. Sus hallazgos se aplicaron y revalidaron: foco desktop al sustituir histórica, binding multi-materia seguro, alias `JUNTA`, payloads testeados, capas legacy completas, diálogos accesibles, diff no dependiente solo del color, regiones scrollables, IDREF de tabs estable, copy jurídico y tactilidad. Resultado final consolidado: **0 P0, 0 P1 y 0 P2 accionables**.
