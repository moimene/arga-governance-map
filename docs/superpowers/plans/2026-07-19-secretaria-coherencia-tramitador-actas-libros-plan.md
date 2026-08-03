# Secretaría — plan de coherencia registral, actas/libros y materias

**Fecha:** 2026-07-19  
**Estado:** aprobado para ejecución; sin autorización de commit  
**Worktree:** `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` (`main`)  
**Cloud activo:** `governance_OS` (`hzqwefkwsxopwrmtksbg`)

## 1. Objetivo

Cerrar, con evidencia verificable, tres frentes conectados del módulo Secretaría:

1. convertir el Tramitador registral en un expediente multisoporte que admita escritura, instancia y certificación sin afirmar efectos jurídicos no acreditados;
2. conectar actas, libros, certificaciones, legalización de libros y depósito de cuentas mediante artefactos y eventos persistidos;
3. eliminar incoherencias funcionales entre materias, rule packs y plantillas sin alterar destructivamente el catálogo histórico.

El cierre exige, por fase: pruebas de contrato, implementación, gates completos, comprobación Cloud, prueba en la app viva y revisión adversarial del diff.

## 2. Decisiones ratificadas

### D1-B — Tramitador multisoporte por fases

El agregado `registry_filing` representa el expediente de presentación, no una escritura. Su documento de base puede ser:

- `ESCRITURA`;
- `INSTANCIA`;
- `CERTIFICACION`.

La primera vertical operativa será la presentación registral con artefacto de base y asiento real. Después se conectarán certificaciones, legalización de libros y depósito de cuentas. No se modelará una lista legal cerrada de actos admitidos por instancia sin validación del Comité Legal.

### D2-B — Expediente + eventos append-only + calificación tipada

`registry_filings` mantiene la identidad y proyección actual del expediente. Una nueva bitácora append-only registra los hechos de tramitación. La calificación distingue:

- `POSITIVA`;
- `SUSPENSION_SUBSANABLE`;
- `DENEGACION`.

Los códigos de defecto serán opcionales y solo podrán proceder de un catálogo aprobado. No se reintroducen `RRM-58`, `RM-201` ni otros códigos inventados. Mientras no exista catálogo jurídico aprobado se persisten descripción libre, documento de calificación y resultado tipado.

### D3-B — Proyección basada en evidencia

Los hechos registrales no mutan automáticamente `agreements` a `REGISTERED`, `REJECTED_REGISTRY` o `PUBLISHED`. Esas proyecciones quedan bloqueadas hasta que:

- exista evidencia registral auténtica;
- los identificadores obligatorios estén presentes;
- el Comité Legal haya validado la semántica y el disparador.

En esta fase el expediente muestra el hecho y su evidencia sin afirmar oponibilidad `erga omnes`.

### D4-B — Regla del acto + requisitos posteriores + perfil procedimental

El rule pack determina la procedencia y los requisitos jurídicos del acto. De él se derivan requisitos posteriores al acuerdo. Un perfil registral separado determina documento de base, destino, datos de presentación y pasos procedimentales. El perfil registral no duplica ni reemplaza la fuente jurídica del rule pack, y no extiende el fail-closed por órgano a trámites masivos como depósito de cuentas o legalización de libros.

### D5-A corregida — identidad funcional y semántica NULL/ANY

- Código operativo: `SUPRESION_PREFERENTE`.
- Etiqueta jurídica: `Exclusión del derecho de preferencia —supresión total o parcial—`.
- La fila Cloud `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE` se conserva, sin borrar ni renombrar.
- Si es necesario, la fila histórica se gobierna con metadatos explícitos como legacy/no operativa.
- El alias es solo de presentación. No participa en identidad funcional, unicidad, bindings ni activación.
- La equivalencia funcional introducida en TypeScript y en Cloud se retira mediante una migración forward-only.

Semántica asimétrica:

| Eje | `NULL` | `ANY` |
|---|---|---|
| `tipo_social` en plantilla | todos los tipos sociales | valor explícito equivalente a todos |
| `organo` | dato ausente/incompleto | comodín explícito |
| `adoption_mode` | dato ausente o no aplicable según el artefacto | comodín explícito |
| binding normalizado | no permitido | comodín explícito |

## 3. Línea base verificada en Fase 0

### Código real

- La app escribe `ELEVADA` al registrar escritura y `PRESENTADA` al responder una subsanación.
- No existe escritor operativo de presentación inicial, `SUBSANACION`, `DENEGADA` ni `INSCRITA`.
- La lista no ofrece vistas propias para `ELEVADA` y `DENEGADA`; sus deep links caen en “Todas”.
- El formulario de subsanación descarta motivo y documentos y solo cambia el estado.
- El flujo presupone escritura en la acción terminal, aunque el esquema legado permite varios campos nulos.
- Las actas no generan una entrada persistida y trazable en un libro; la interfaz mezcla filas Cloud con proyecciones virtuales.
- La acción demo de legalización puede usar una referencia `CSV-DEMO-*` y no crea expediente registral.
- La identidad funcional de materias colapsa actualmente `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE` en `SUPRESION_PREFERENTE`; ese comportamiento contradice D5.

### Datos Cloud/demo

- `registry_filings`: 5 filas; estados `EN_TRAMITE` 1, `PRESENTADA` 1, `SUBSANACION` 1 e `INSCRITA` 2; `filing_type` nulo en las cinco.
- No hay filas `ELEVADA` ni `DENEGADA` en la instantánea auditada.
- Las cinco filas proceden de seeds/demo y no acreditan presentaciones reales.
- Existen 7 certificaciones firmadas y ninguna tiene `evidence_id`; por tanto, el gate de entrada al tramitador está bloqueado de forma correcta.
- Existen 355 libros persistidos en Cloud frente a 366 elementos mostrados por la UI auditada.
- Hay 47 tareas posteriores de campañas de depósito y ninguna está completada; no son expedientes registrales.

### Pendiente de decisión jurídica

- lista cerrada de actos admisibles por instancia;
- catálogo y códigos normalizados de defectos;
- disparadores exactos de `REGISTERED`, `REJECTED_REGISTRY` y `PUBLISHED`;
- efectos de cada forma de firma y legitimación más allá de lo acreditado por el documento oficial.

## 4. Contrato de dominio objetivo

### 4.1 Agregado registral

`registry_filings` conservará compatibilidad con sus identificadores y rutas actuales y añadirá, como mínimo:

- sociedad (`entity_id`);
- origen trazable (`source_domain`, `source_id`);
- familia del documento de base (`base_document_type`);
- artefacto de base (`base_document_artifact_id`);
- perfil procedimental aplicado, si existe;
- resultado de calificación actual como proyección derivada;
- marcas temporales derivadas del último evento válido.

Los vínculos a acuerdos, escrituras, certificaciones, libros o tareas de depósito serán explícitos cuando la tabla origen sea estable. No se fabricarán FKs contra tablas que no existan de forma reproducible en las migraciones.

### 4.2 Bitácora registral

La bitácora `registry_filing_events` será append-only y tenant-scoped. Tipos mínimos:

- `EXPEDIENTE_PREPARADO`;
- `DOCUMENTO_BASE_VINCULADO`;
- `PRESENTACION_ASENTADA`;
- `CALIFICACION_REGISTRADA`;
- `SUBSANACION_PREPARADA`;
- `SUBSANACION_PRESENTADA`;
- `INSCRIPCION_ACREDITADA`;
- `PUBLICACION_ACREDITADA`.

Cada hecho llevará fecha efectiva, actor, artefacto probatorio opcional/obligatorio según el evento y payload estructurado. `UPDATE` y `DELETE` directos quedan revocados; la escritura se realiza mediante RPCs `SECURITY DEFINER` con `search_path` fijo, comprobación de tenant, rol/capability y precondiciones fail-closed.

### 4.3 Evidencia y estados

| Hecho | Datos mínimos | Proyección permitida |
|---|---|---|
| Documento base vinculado | tipo + artefacto | `ELEVADA` solo si el hecho representa elevación acreditada; en otro caso `EN_TRAMITE` |
| Presentación | número/asiento + fecha + evidencia | `PRESENTADA` |
| Suspensión subsanable | resultado + motivo + documento | `SUBSANACION` |
| Denegación | resultado + motivo + documento | `DENEGADA` |
| Subsanación presentada | motivo original + respuesta + anexos + evidencia | `PRESENTADA` |
| Inscripción | número de inscripción + fecha + evidencia | `INSCRITA` |
| Publicación | referencia oficial + fecha + evidencia | visualización del hecho; no `agreements.PUBLISHED` automática |

Una RPC debe devolver la fila afectada o un resultado con `affected_count = 1`. La UI rechazará éxito aparente si el recuento no es exactamente uno; esto evita confundir un `UPDATE` filtrado por RLS con una transición aplicada.

## 5. Plan de ejecución

### Fase 1 — Contratos visibles y navegación de estados

**Objetivo:** eliminar la ocultación antes de habilitar escritores nuevos.

1. Escribir primero pruebas para `?estado=ELEVADA` y `?estado=DENEGADA`.
2. Añadir vistas estables “Elevadas” y “Denegadas” sin cambiar el id `estado`.
3. Mantener filtros existentes `EN_TRAMITE`, `SUBSANACION`, `PRESENTADA`, `INSCRITA`.
4. Alinear labels y tonos desde una única fuente compartida.
5. Corregir copy que presupone que toda tramitación se inicia con escritura.
6. Actualizar en el mismo cambio los contratos pinados que correspondan.

**Aceptación:** el deep link conserva el valor exacto, selecciona la vista correcta y solo muestra filas con ese estado; los estados desconocidos no se silencian como una vista válida.

### Fase 2 — Fundación registral segura

**Objetivo:** introducir el agregado multisoporte y la bitácora sin activar efectos jurídicos.

1. Crear migración espejo forward-only con columnas, checks, índices y eventos.
2. Reutilizar `secretaria_document_artifacts` como artefacto documental; no duplicar storage.
3. Crear RPCs atómicas para:
   - preparar expediente;
   - vincular documento base;
   - asentar presentación;
   - registrar calificación;
   - presentar subsanación;
   - acreditar inscripción/publicación.
4. Prohibir modificación directa de eventos y endurecer escrituras directas de la proyección.
5. Añadir audit trail/WORM de cada transición.
6. Mantener las cinco filas demo como legacy no acreditado; no rellenar evidencias falsas.
7. Desplegar en dos tiempos: la migración expansiva crea columnas/eventos/RPCs sin revocar los writers antiguos; el lockdown de DML se aplica únicamente después de desplegar y verificar el cliente RPC.

**Aceptación de seguridad:** usuario sin tenant/capability falla; actor del mismo tenant puede ejecutar solo transiciones permitidas; no se puede editar/borrar un evento; una transición inválida no modifica ni proyección ni bitácora.

### Fase 3 — Vertical registral multisoporte

**Objetivo:** hacer operable el recorrido documento → presentación → calificación → subsanación.

1. Sustituir “Registrar escritura” por selección visible de documento base.
2. Exigir un artefacto archivado/evidenciado para presentar; no basta un nombre de fichero escrito a mano.
3. Separar preparación del documento de presentación registral.
4. La presentación inicial exige fecha y número/asiento; muestra el origen y la evidencia.
5. La subsanación persiste motivo de la calificación, respuesta, anexos y artefacto.
6. Añadir detalle del expediente con timeline append-only y acciones gateadas por estado.
7. Usar los modelos oficiales solo como ayuda de preparación cuando su XFA fue extraído y verificado.

**Matriz oficial inicialmente verificada:** conservar el índice de 39 PDFs extraídos por XFA y publicar únicamente filas cuyo acto, denominación y requisitos consten en el propio formulario. Los modelos 05 y 34 no se presentan como existentes. La matriz parcial 15–23 y 33 debe citar el formulario, no inferencias del informe.

### Fase 4 — Actas, libros y certificaciones

**Objetivo:** materializar la cadena documental sin proyecciones virtuales engañosas.

1. Mantener `mandatory_books` como volumen físico y crear secciones por órgano, asientos append-only y cierres inmutables con manifiesto/hash.
2. Resolver explícitamente libro y sección destino por sociedad, órgano, clase y periodo. Si falta o hay ambigüedad, registrar incidencia y no inventar destino.
3. Hacer que la aprobación del acta —no su mero borrador— cree la entrada persistida de forma atómica o mediante RPC idempotente.
4. Mostrar en ActaDetalle libro, sección, tomo/periodo y asiento persistido; `registered_at` se presenta como “Asentada en libro”, no como inscripción registral.
5. Persistir atribuciones append-only de presidente y secretario para nuevas aprobaciones; los legacy incompletos se etiquetan, no se falsean.
6. Conectar una certificación al tramitador solo cuando tenga artefacto y evidencia propia auténtica; las siete certificaciones demo sin `evidence_id` siguen bloqueadas.
7. Separar volumen físico, sección/órgano, cierre y lote de legalización. La unidad exacta que se presenta se explicita en el expediente.

**Aceptación:** una acta nueva aparece una sola vez en su libro; los contadores proceden de filas persistidas; reintentos son idempotentes; un libro ambiguo no recibe una entrada arbitraria.

### Fase 5 — Legalización de libros y depósito de cuentas

**Objetivo:** conectar trámites recurrentes por instancia con el Tramitador.

1. “Preparar legalización” crea o vincula una `INSTANCIA` y su artefacto, no marca el libro como legalizado.
2. “Presentar” exige asiento/fecha/evidencia y genera `PRESENTACION_ASENTADA`.
3. `LEGALIZADO` solo procede de evidencia positiva; retirar el éxito demo basado en `CSV-DEMO-*`.
4. La campaña de depósito crea un expediente `CERTIFICACION` o `INSTANCIA` según el documento realmente aportado.
5. La tarea de campaña conserva su identidad y enlaza el expediente; no se convierte en sustituto de `registry_filings`.
6. Reintentos no duplican expedientes para el mismo origen y ciclo.

**Aceptación:** libro/tarea → expediente → timeline → evidencia es navegable en ambos sentidos; no hay “legalizado”, “depositado” o “publicado” sin hecho probatorio.

### Fase 6 — Materias, reglas y plantillas

**Objetivo:** aplicar D5 y unificar la mesa de control.

1. Dividir alias de presentación e identidad funcional.
2. Retirar la canonicalización funcional art. 308 en TypeScript y en una migración Cloud forward-only.
3. Conservar la fila histórica de exclusión y marcarla como legacy/no operativa mediante metadata si el modelo ya lo permite.
4. Aplicar la semántica NULL/ANY asimétrica en normalización, detección de incidencias, activación y bindings.
5. Unificar labels de materia, órgano, adopción y estado.
6. Sustituir lenguaje técnico para abogado, incluido el copy pinado “Configuración del motor… alimenta Gate PRE”.
7. Mostrar como incidencias los 9 bindings fuera de catálogo y los 2 conflictos de rule pack auditados; no normalizarlos silenciosamente.
8. Conservar contexto en viajes entre pantallas con los ids `?tab`, `?vista` y `?estado` existentes.

**Aceptación:** round-trip materia → rule pack → plantilla → materia conserva la clave operativa; la fila legacy nunca satisface una unicidad/activación de `SUPRESION_PREFERENTE`; NULL ausente no se confunde con ANY explícito.

### Fase 7 — Saneamiento demo honesto

1. Clasificar filas legacy/demo mediante metadata verificable.
2. No completar `filing_type`, evidencias, atribuciones o referencias con valores inventados.
3. Crear datos de demostración nuevos solo mediante los mismos RPCs de producto y con etiqueta demo inequívoca.
4. Verificar que cualquier UPDATE devuelve exactamente una fila.

### Fase 8 — Cierre integral

Por cada lote y al final:

```bash
bun run typecheck
bun test
bunx eslint <rutas-tocadas>
bun run build
```

Además:

- ejecutar E2E afectados en lotes pequeños, incluyendo los contratos 08, 12, 14, 16, 17, 21, 22, 24 y 25 cuando cambien sus superficies;
- ejecutar `bun run db:check-target` antes de cada escritura Cloud;
- aplicar cada migración con MCP sobre `governance_OS` y comprobar versión + esquema + probes de datos;
- probar en vivo con el usuario demo los tres recorridos y sus deep links;
- realizar review adversarial del diff, seguridad tenant/RLS/RPC, accesibilidad y afirmaciones jurídicas;
- corregir los hallazgos antes de declarar cierre.

## 6. Secuencia de entregas y rollback

| Lote | Contenido | Activación | Recuperación |
|---|---|---|---|
| L1 | vistas y contratos de estado | inmediata | revertir solo UI/contratos |
| L2 | esquema/RPC/eventos | sin efectos automáticos | dejar tablas sin escritores; migración correctiva forward-only |
| L3 | vertical registral | por acciones gateadas | desactivar acciones, conservar eventos |
| L4 | entradas de libro/certificaciones | idempotente | detener materialización, no borrar historia |
| L5 | legalización/depósito | por origen | desactivar creación, conservar vínculos |
| L6 | D5 y mesa de control | tras probes de paridad | migración correctiva; nunca renombrar/borrar catálogo |

No se usa `db push --linked`, migration repair ni worktree alternativo. No se hará commit ni staging hasta autorización explícita; llegado el momento, `git add` usará rutas concretas.

## 7. Definition of Done

- existen vistas y deep links correctos para todos los estados operativos;
- escritura, instancia y certificación comparten el mismo agregado sin campos ficticios;
- presentación, calificación, subsanación, inscripción y publicación son hechos trazables y no sobreescribibles;
- no se propaga un efecto societario sin evidencia y decisión jurídica;
- actas nuevas alimentan un libro persistido e idempotente;
- legalización y depósito crean expedientes registrales navegables;
- `SUPRESION_PREFERENTE` y la fila legacy de exclusión no colisionan funcionalmente;
- NULL/ANY conserva la semántica ratificada;
- tests, lint, build y E2E afectados están verdes;
- Cloud y app viva coinciden con el repo;
- la revisión adversarial final no deja P0/P1 abiertos;
- el usuario ha revisado el diff antes de cualquier commit.
