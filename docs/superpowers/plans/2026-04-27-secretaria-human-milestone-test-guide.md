# 2026-04-27 — Secretaría Societaria: guía de prueba de hito humano

## Propósito

Preparar una sesión de revisión con usuarios reales del departamento legal. La prueba no busca demostrar que todo está terminado, sino comprobar si la plataforma ya es entendible, jurídicamente explicable y útil para trabajo real de Secretaría.

La persona usuaria debe poder responder:

- qué sociedad o grupo está revisando;
- qué órgano adopta cada decisión;
- qué regla, plantilla y evidencia se aplican;
- qué advertencias son recordatorios y qué gates bloquean;
- qué documento se genera y dónde queda archivado;
- qué puntos aún requieren criterio legal humano.

## Preparación

- URL local: `http://127.0.0.1:5174/`.
- Acceso: usar el botón de acceso demo de la pantalla de login.
- Ámbito inicial recomendado: modo Sociedad, ARGA Seguros S.A.
- No modificar Supabase durante la sesión.
- No aplicar migraciones.
- Registrar observaciones con esta estructura: pantalla, acción, expectativa, resultado, severidad, comentario legal.

## Criterios de aceptación de hito

| Área | Criterio mínimo para pasar hito humano |
|---|---|
| Navegación | La persona distingue modo Grupo de modo Sociedad y entiende qué datos pertenecen a la sociedad seleccionada. |
| Explicabilidad | Cada flujo crítico muestra órgano, materia, modo de adopción, regla/pack, plantilla y trazabilidad suficiente. |
| Convocatoria | Los requisitos de plazo, canal y documentación aparecen como recordatorios no bloqueantes cuando proceda. |
| Reunión | El usuario identifica lista de asistentes, capital/voto, quórum, mayoría, conflictos y resultado por punto, aunque haya deuda pendiente. |
| Documentos | La plantilla elegida se conserva al navegar y el documento se genera desde el proceso correcto. |
| Certificación | Se entiende la cadena acta -> certificación -> firma/QTSP -> archivo/evidencia. |
| Campañas | En modo Grupo se entiende el concepto campaña -> expedientes por sociedad. |
| Riesgos | Las limitaciones aparecen como huecos conocidos, no como comportamiento silencioso. |

## Guion de prueba

### 1. Entrada y contexto Sociedad

Ruta sugerida: `/secretaria?scope=sociedad&entity=6d7ed736-f263-4531-a59d-c6ca0cd41602`

Validar:

- Se ve claramente la sociedad activa.
- El menú lateral no mezcla acciones de grupo con acciones de sociedad.
- Las pantallas principales explican si están filtradas por sociedad.
- Al navegar a convocatorias, reuniones, actas, plantillas y libros, el contexto se conserva.

Preguntas al usuario legal:

- ¿Entiendes sobre qué sociedad estás trabajando?
- ¿Hay alguna opción de menú que te parezca duplicada o ambigua?
- ¿Echarías en falta ver órganos/personas/libros desde otro orden?

### 2. Convocatoria con recordatorios jurídicos

Ruta sugerida: `/secretaria/convocatorias`

Validar:

- La lista permite entrar a una convocatoria sin perder el contexto de sociedad.
- El detalle muestra tipo, órgano, fecha, modalidad, canales, orden del día y adjuntos.
- Si hay `rule_trace` o `reminders_trace`, se entiende como trazabilidad.
- Las advertencias de convocatoria no bloquean: actúan como recordatorio de revisión.
- El botón documental genera convocatoria o informe PRE según el tipo de plantilla.

Prueba de plantilla:

1. Entrar en plantillas.
2. Usar una plantilla de convocatoria o informe PRE.
3. Confirmar que el destino conserva `?plantilla=...`.
4. Entrar en una convocatoria.
5. Confirmar que se ofrece generar con la plantilla seleccionada.

Preguntas al usuario legal:

- ¿Queda claro qué requisitos son legales, estatutarios o de evidencia?
- ¿Te parece correcto que convocatoria alerte sin bloquear?
- ¿Qué advertencia debería ser más visible para evitar errores reales?

### 3. Gestor documental

Rutas sugeridas:

- `/secretaria/gestor-plantillas`
- `/secretaria/plantillas`
- `/secretaria/acuerdos/:id/generar`

Validar:

- Las plantillas muestran tipo, estado, jurisdicción, materia y versión.
- Solo plantillas aprobadas/activas deberían usarse para documento final.
- La capa 1 se entiende como texto protegido.
- La capa 2/capa 3 diferencia variables automáticas y variables de usuario.
- Si faltan variables obligatorias, la UI lo explica antes de generar.
- Si se activa QES, se entiende que EAD Trust es el QTSP.
- El archivo queda asociado a expediente/evidencia cuando procede.

Preguntas al usuario legal:

- ¿El modelo de capas protege suficiente el texto jurídico?
- ¿Qué variables deberían capturarse siempre guiadas y no en texto libre?
- ¿Qué plantillas faltan para revisar Cuentas Anuales end-to-end?

### 4. Reunión y acta

Rutas sugeridas:

- `/secretaria/reuniones`
- `/secretaria/reuniones/:id`
- `/secretaria/actas`
- `/secretaria/actas/:id`

Validar:

- La reunión distingue apertura, asistentes, quórum, debates, votación y cierre.
- La lista de asistentes permite entender presencia, representación y ausencias.
- Para juntas, debe ser evidente la diferencia entre capital económico y derechos de voto.
- Por punto del orden del día, deben verse resultado, mayoría y estado.
- El acta se genera desde el cierre de la reunión y luego permite certificación.
- `ActasLista` conserva `?plantilla/tipo` cuando se entra desde una plantilla.

Puntos de revisión legal crítica:

- Persona jurídica asistente sin representante.
- Conflicto de interés y exclusión del denominador.
- Voto de calidad en consejo cuando aplique.
- Veto parasocial separado de validez societaria.
- Mayoría estatutaria más exigente que la legal.

### 5. Certificación y evidencia

Ruta sugerida: `/secretaria/actas/:id`

Validar:

- El usuario entiende cuándo puede emitir certificación.
- Se muestra autoridad del certificante y, si procede, Visto Bueno.
- Se entiende la diferencia entre generar acta DOCX y certificación DOCX.
- La plantilla de certificación seleccionada desde URL se aplica solo a certificación.
- La cadena QES/evidence bundle queda explicada sin prometer firma real si no hay binario firmado.

Preguntas al usuario legal:

- ¿Qué dato falta para que tú firmaras esta certificación en un caso real?
- ¿Dónde esperarías ver el hash, sello, timestamp y justificante de archivo?

### 6. Modo Grupo y campañas

Ruta sugerida: `/secretaria/procesos-grupo`

Validar:

- El usuario entiende que una campaña de grupo genera expedientes por sociedad.
- La campaña de Cuentas Anuales se lee como flujo secuencial: formulación, convocatoria, aprobación, depósito.
- Cada sociedad debería explicar su `AdoptionMode` y rule pack.
- Los estados por sociedad permiten distinguir completado, pendiente, bloqueado o con recordatorio.

Preguntas al usuario legal:

- ¿Este War Room permite coordinar el trabajo real del grupo?
- ¿Qué columnas faltan para decidir prioridades de Secretaría?
- ¿Qué campaña debería probarse después de Cuentas Anuales?

## Matriz de cobertura documental para hito

| Proceso | Documento | Estado esperado para hito | Fuente de datos | Riesgo |
|---|---|---|---|---|
| Convocatoria JGA SA | Convocatoria | Generable con plantilla activa y recordatorios PRE | `convocatorias`, `plantillas_protegidas`, `attachments` | Medio: canales/publicación requieren evidencia real. |
| Convocatoria SL | Notificación individual | Generable con ERDS como canal sugerido | `convocatorias`, `plantillas_protegidas` | Medio: destinatarios/socios deben venir de maestro fiable. |
| Informe PRE | Informe preceptivo/documental | Generable desde detalle de convocatoria | `convocatorias.rule_trace`, `convocatorias.reminders_trace` | Alto: drift Cloud/local en trazas y plantillas PRE. |
| Acta de sesión | Acta | Generable desde cierre de reunión y desde detalle de acta | `meetings`, `meeting_resolutions`, `minutes` | Medio: snapshot por punto aún debe reforzarse. |
| Certificación | Certificación de acuerdos | Generable desde acta/certificación con autoridad vigente | `minutes`, `certifications`, `authority_evidence` | Medio: QES/evidence aún parcialmente stub/demo. |
| Acuerdo escrito | Acta acuerdo escrito | Navegable, con modos sin sesión/co-aprobación/solidario | `agreements`, `meeting_resolutions` o equivalentes | Medio: denominadores y conflictos necesitan v2. |
| Decisión socio único | Acta de consignación | Navegable y explicable para SLU | `agreements`, `minutes`, `entities` | Medio: contratos socio único/libros requieren más enlace. |
| Tramitador registral | Certificación/escritura/POST | Expediente y tareas visibles | `registry_filings`, `attachments`, `evidence_bundles` | Alto: cierre registral real pendiente. |

## Plantilla de recogida de feedback

| Campo | Valor |
|---|---|
| Usuario legal |  |
| Rol | Secretaría / Societario / Registral / Compliance / Otro |
| Sociedad revisada |  |
| Flujo | Convocatoria / Reunión / Acta / Certificación / Campaña / Plantilla |
| Acción realizada |  |
| Resultado esperado |  |
| Resultado observado |  |
| ¿Se entendió la regla aplicada? | Sí / Parcial / No |
| ¿La UI generó confianza jurídica? | Sí / Parcial / No |
| Severidad | Alta / Media / Baja |
| Recomendación legal |  |

## Data contract

- Tablas usadas en la prueba: `entities`, `governing_bodies`, `personas`, `condiciones_persona`, `convocatorias`, `meetings`, `meeting_attendees`, `meeting_resolutions`, `minutes`, `certifications`, `agreements`, `plantillas_protegidas`, `attachments`, `evidence_bundles`, `registry_filings`, `rule_packs`, `rule_pack_versions`, `rule_param_overrides`.
- Fuente de verdad: Cloud para runtime de demo; local y tipos generados siguen bajo paridad.
- Migración requerida para esta guía: ninguna.
- Tipos afectados: ninguno.
- Contratos cross-module: `governance_module_links`, `governance_module_events`, `attachments`, `evidence_bundles`, `audit_log`.
- Riesgo de paridad: medio/alto en trazas de convocatoria, lifecycle de reglas, plantillas PRE y tipos generados.

## Cierre de sesión

Antes de declarar listo para hito humano:

- `bun run db:check-target` debe apuntar a `governance_OS`.
- `bunx tsc --noEmit --pretty false` debe pasar.
- Tests documentales focalizados deben pasar.
- Build debe pasar.
- Smokes de navegador no deben mostrar error boundary.
- Las limitaciones conocidas deben explicarse en la sesión, no ocultarse.
