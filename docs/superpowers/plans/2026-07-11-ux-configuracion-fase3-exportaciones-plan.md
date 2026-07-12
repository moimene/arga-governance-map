# UX Configuración Secretaría — Fase 3 selectiva: exportaciones trazables

> Plan detallado de fase. Debe ejecutarse después de la Fase 2C y antes del cierre global de la Oleada 2.

**Objetivo:** añadir exportaciones CSV locales y honestas de la matriz visible de materias y del estado de auditoría de plantillas, sin presentar como métricas fiables los datos históricos o de uso que Cloud no permite sostener.

**Ámbito:** `/secretaria/catalogo-materias` y la pestaña estable `?tab=auditoria` de `/secretaria/gestor-plantillas`.

**Fuera de ámbito:** escrituras Cloud, cambios de esquema, reconstrucción retrospectiva del changelog, responsables de incidencias, panel de estancamiento y analítica de uso.

## 1. Auditoría previa obligatoria

La auditoría se realizó en tres carriles independientes — código, Cloud y UX/accesibilidad — y se contrastaron sus conclusiones antes de elegir el alcance.

### 1.1 Estado real del Workstream C

- El workflow de promoción ya existe y está cubierto; no hay brecha que justifique otra implementación.
- La comparación de versiones de Capa 1 ya existe con pruebas unitarias, contratos UI y E2E; no se duplica.
- No existe exportación de auditoría ni de la matriz de materias; es una brecha real, acotada y reversible.
- El changelog retrospectivo no se puede reconstruir de forma probatoria con los datos actuales.
- El panel de estancamiento `>60 días` produciría falsos positivos: los timestamps de creación, aprobación y activación son legacy e incoherentes en una parte material del conjunto.
- No hay modelo de asignación de responsables por incidencia; añadirlo exigiría schema y una decisión operativa fuera de esta fase.
- Las señales de uso son demasiado escasas y no tienen denominador canónico; no soportan analítica de adopción.

### 1.2 Evidencia Cloud leída, sin escrituras

- 110 plantillas: 74 activas y 36 archivadas; no hay estados intermedios vivos en el snapshot auditado.
- `plantilla_changelog` contiene 1 fila para 1 plantilla; 109 de 110 no tienen changelog y no existe otra fuente auditada que permita reconstruirlo.
- Solo 48 de 74 activas tienen una última entrada de historial coherente; incluso combinando `activated_at` quedan 6 activas sin fecha fiable.
- Existen aprobaciones anteriores a la creación y duraciones negativas o nulas, por lo que la velocidad de ciclo actual no es defendible.
- Las señales de uso identificables se limitan a 7 borradores para 2 plantillas y muy pocos expedientes/artefactos vinculables.
- Hay 49 filas de `materia_catalog`, 57 rule packs activos para 56 materias y 49 bindings activos sobre 43 materias; 9 materias de packs no tienen coincidencia literal en el catálogo. La exportación debe conservar el código raw y describirse como matriz visible, no como universo completo de reglas.

### 1.3 Decisión de alcance

Se ejecutan solo tres descargas locales:

1. **Exportar matriz CSV**: exactamente las materias visibles tras los filtros actuales y en el ámbito seleccionado.
2. **Exportar changelog filtrado**: exactamente las filas cargadas y visibles tras los filtros; el hook limita la consulta a las 200 entradas más recientes.
3. **Exportar plantillas sin changelog**: exactamente las plantillas en estado vivo devueltas por el detector canónico.

Se difieren el resto de propuestas hasta disponer de datos y decisiones capaces de sostenerlas.

## 2. Contrato funcional y de datos

### 2.1 CSV común

- Descarga generada en cliente; ninguna llamada de escritura ni mutación Cloud.
- UTF-8 con BOM para apertura correcta en Excel.
- Delimitador `;`, compatible con configuración regional española.
- Escapado RFC 4180 de comillas, delimitadores y saltos de línea.
- Protección contra inyección de fórmulas para celdas cuyo primer carácter efectivo sea `=`, `+`, `-`, `@`, tabulador o retorno de carro.
- Fecha estable `YYYY-MM-DD` en nombre de fichero; el ámbito se normaliza a un fragmento seguro cuando aplica.
- IDs y códigos raw se conservan completos; los labels jurídicos se exportan en columnas separadas.

### 2.2 Matriz visible de materias

La descarga usa `filteredCatalogItems`, no una consulta paralela. Debe incluir:

- código raw de materia;
- nombre mostrado;
- grupo funcional;
- ámbito y sociedad seleccionada;
- órgano u órganos aplicables;
- mayoría o mayorías;
- formalización completa;
- documentos completos, sin el truncado visual de tabla;
- estado mostrado y referencia legal;
- fecha de generación.

El CTA se llama **Exportar matriz CSV**, queda deshabilitado si no hay filas visibles y anuncia el resultado mediante una región `aria-live`.

### 2.3 Auditoría de plantillas

Dos descargas separadas evitan mezclar datasets heterogéneos:

- **Exportar changelog filtrado**: ID completo, tipo de cambio raw y label, versión anterior, versión lógica nueva, autor, motivo y timestamp ISO.
- **Exportar plantillas sin changelog**: ID completo, tipo raw y label, materia raw y label, versión, estado raw y label.

La interfaz debe advertir: **CSV de trabajo; el historial disponible es incompleto.** El changelog debe describirse como vista cargada de hasta 200 entradas recientes, nunca como histórico completo.

Los botones quedan deshabilitados durante carga, error o dataset vacío y mantienen objetivo táctil mínimo de 44 px, foco visible y nombre accesible.

## 3. Implementación por tareas

### T1 — Utilidad CSV pura y defensiva

- Crear una utilidad compartida bajo `src/lib/secretaria/` para serializar y descargar CSV.
- Separar la serialización pura del efecto de navegador.
- Añadir pruebas para BOM, delimitador, comillas, multilínea, `null`/`undefined`, nombres de fichero y todos los prefijos de fórmula.

### T2 — Exportación de la matriz visible

- Construir filas desde los mismos candidatos y resolutores que alimentan la tabla comparativa.
- Añadir el CTA a `MateriaCatalogControls` sin introducir colores Tailwind nativos, hex ni estilos inline de color.
- Conservar `?materia=`, `?vista=`, `scope`, `entity` y filtros; la descarga no altera la URL.
- Añadir contrato UI y prueba E2E afectada en `e2e/08` para filtros + contenido descargado.

### T3 — Exportaciones de auditoría

- Reutilizar `filteredChangelog` y `orphanRows`; no hacer una segunda consulta ni eludir el límite de 200.
- Añadir los dos CTAs y la nota de alcance en `AuditoriaTab`.
- Añadir pruebas unitarias/contrato para columnas, labels y versión lógica.
- Extender el E2E de tabs/responsive afectado para comprobar nombre, estado, descarga y ausencia de overflow a 390 px.

### T4 — Coherencia y accesibilidad

- Labels jurídicos y raw en columnas distintas.
- Objetivos táctiles de 44 px, foco visible, `aria-busy` cuando corresponda y feedback `aria-live`.
- Cero cambio en IDs estables de tab/vista.
- Cero nuevas incidencias del contrato Garrigues.

## 4. Gates de fase

Ejecutar, tras la implementación y tras cualquier fix de review:

1. pruebas unitarias dirigidas de CSV, Materias y Auditoría;
2. `bun test` completo;
3. `bun run typecheck`;
4. ESLint de todos los TS/TSX tocados;
5. `git diff --check`;
6. escaneo Garrigues de colores nativos, hex e inline colors;
7. `bun run build`;
8. E2E afectados de Materias y Gestor, incluidos contratos pinados relevantes.

## 5. Verificación en vivo

Con login demo y datos Cloud reales:

- aplicar filtros en Materias, descargar y comprobar que el número y contenido de filas coincide exactamente con la vista;
- comprobar código raw, label, ámbito, documentos completos y fecha;
- descargar el changelog filtrado y confirmar que solo contiene la fila cargada/visible actual;
- descargar las plantillas sin changelog y contrastar el recuento con la pantalla;
- abrir los tres CSV y verificar BOM, caracteres con tilde, separador, multilinea y protección de fórmulas;
- comprobar a 390 px que no aparece overflow global y que los botones conservan foco/objetivo táctil;
- confirmar en logs/red que no se produjo ninguna escritura Cloud.

## 6. Review adversarial y criterio de cierre

Solicitar tres revisiones independientes del diff:

1. corrección de datos y honestidad del alcance;
2. seguridad CSV, accesibilidad y responsive;
3. contratos, regresiones y adecuación al plan marco.

Aplicar todos los hallazgos válidos y repetir gates afectados. La fase solo cierra cuando:

- las tres descargas reflejan exactamente sus datasets visibles/canónicos;
- ninguna se presenta como histórico o universo completo cuando no lo es;
- no existe escritura Cloud;
- gates, verificación en vivo y reviews quedan en verde;
- se documentan los diferidos con su razón probatoria.

## 7. Registro de ejecución

### 7.1 Implementación cerrada

- Se creó `src/lib/secretaria/csv-export.ts` con serialización UTF-8+BOM, delimitador `;`, CRLF, escapado RFC4180, neutralización de fórmulas, fecha civil local, filename seguro y descarga mediante `Blob` local.
- Materias exporta exactamente `filteredCatalogItems`, con código y label, grupo funcional, ámbito/sociedad, órgano, mayoría, formalización y su base, documentos completos, estado, referencia y fecha. En ámbito Grupo deja Sociedad/ID vacíos para no presentar una base normativa como entidad.
- Auditoría ofrece dos datasets separados: `filteredChangelog` y `orphanRows.data`. El filtrado se extrajo a una función pura; respeta ID, actor, tipo de cambio y fecha civil local.
- `created_at = NULL` queda vacío/no disponible: nunca se convierte en 1970 ni rompe el filtro.
- Los tres CTAs capturan fallos de descarga, reanuncian intentos repetidos y usan live regions atómicas. Carga, error, vacío y datos son estados distintos.
- Changelog, huérfanas y ajustes de Capa 3 muestran `no disponible` ante error, con alerta visible y reintento; no convierten un fallo de consulta en un falso cero.
- Los controles superiores de Materias y los nuevos CTAs cumplen 44 px y foco Garrigues; el contrato responsive los mide a 390 px.
- No se añadieron queries, mutaciones, schema ni migraciones Cloud en esta fase.

### 7.2 Verificación en vivo con Cloud/demo

- Login demo real y `governance_OS`:
  - Materias: filtro `estado contable + SIMPLE + ARCHIVO_INTERNO + lista` dejó 1 de 48 filas y el CSV contenía solo `DIVIDENDO_A_CUENTA`, con UUID completo de ARGA Seguros, tildes y columnas completas.
  - Auditoría: `Plantillas sin changelog (73)`, `Changelog reciente (1 de 1)` y `Ajustes de Capa 3 activos (0)`.
  - El filtro por ID parcial del changelog se aplicó antes de descargar y el UUID completo exportado coincidió con la fila visible.
  - Los recuentos se comprobaron por registros CSV, sin asumir que un salto de línea equivale a una fila.
  - Los listeners E2E registraron cero requests no lectoras a `/rest/v1/`, incluidos RPC POST, durante las descargas de Materias y Auditoría.
  - A 390 px no hubo overflow global y selector, filtros, limpiar y CTAs conservaron al menos 44 px.
- Una corrida E2E ejecutada a la vez que toda la suite y el build saturó temporalmente las lecturas Cloud y dejó varias pantallas en carga. La misma batería, aislada inmediatamente después, cerró limpia; no se clasificó como regresión del producto.

### 7.3 Review adversarial

Tres revisores independientes cubrieron datos/seguridad CSV, UX/accesibilidad y regresiones/contratos. Se aplicaron y revalidaron todos sus hallazgos:

- fecha UTC vs civil local;
- `created_at` nullable y falso 1970;
- errores de queries presentados como cero/empty;
- fallo o repetición de descarga sin anuncio;
- ámbito Grupo presentado erróneamente como sociedad;
- targets inferiores a 44 px;
- gate E2E que excluía RPC;
- E2E que no aplicaba un filtro real y contaba CRLF físicos.

Los tres revisores reexaminaron el snapshot corregido y cerraron sin pendientes accionables.

### 7.4 Gates finales post-fix

- `bun test`: **2350 pass, 152 skip, 0 fail**; 2502 tests, 269 archivos, 1 snapshot.
- `bun run typecheck`: limpio.
- ESLint de todos los TS/TSX tocados en Fase 3: limpio.
- `git diff --check`: limpio.
- Escaneo Garrigues: cero Tailwind de color nativo, hex o inline colors indebidos en los archivos de fase.
- `bun run build`: limpio; solo permanecen los warnings conocidos de chunks >500 kB.
- E2E final aislado:
  - `e2e/08-secretaria-plantillas.spec.ts`: **17 passed** (incluye setup de auth).
  - `e2e/21-secretaria-gestor-plantillas-tabs.spec.ts` + `e2e/21-secretaria-responsive.spec.ts`: **14 passed** (incluye setup de auth).

### 7.5 Diferidos probatorios

Se mantienen fuera de alcance hasta disponer de datos/modelo fiables:

- changelog retrospectivo reconstruido;
- estancamiento `>60 días`;
- responsables de incidencias;
- analítica de uso/adopción.

La Fase 3 selectiva queda cerrada.
