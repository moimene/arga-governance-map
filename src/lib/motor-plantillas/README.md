# motor-plantillas@1.0.0-beta

Fachada estable para composicion documental de Secretaria Societaria.

## Public API

Importar siempre desde `@/lib/motor-plantillas`:

- `MOTOR_PLANTILLAS_VERSION`
- `prepareDocumentComposition(req, capa3Values, options)`
- `composeDocument(req, capa3Values, options)`
- `validatePostRenderDocument(input)`
- `transitionReviewState(input)`
- `probeReviewStateSchema()`

## Contract

`composeDocument()` acepta un `SecretariaDocumentGenerationRequest` ya construido por
`document-generation-boundary.ts`. Ese request es la frontera estable entre
Secretaria y el motor documental.

Orden de ejecucion:

1. valida boundary V1;
2. carga plantilla operativa;
3. construye contexto resolver;
4. resuelve Capa 2;
5. normaliza y valida Capa 3;
6. fusiona variables;
7. renderiza Handlebars;
8. valida post-render;
9. genera artefacto documental DOCX tipado;
10. archiva borrador demo/operativo solo si `archiveDraft: true`.

El resultado incluye `document`, que representa el documento generado con
`filename`, `mimeType`, `buffer`, `renderedText`, `contentHash`, plantilla y
`evidenceStatus`. La descarga, impresion y firma son acciones posteriores
sobre ese artefacto; generar no implica descargar automaticamente.

## No-schema posture

El motor no escribe `review_state` en ninguna tabla existente. La revision se
modela con state machine pura y schema gate. Hasta aplicar una migracion
aprobada, la UI debe mostrar la revision como bloqueada.

## Template operability

La carga de plantillas acepta `ACTIVA` y `APROBADA`. Para el carril demo del
paquete legal 2026-05-02 tambien acepta `BORRADOR` solo si trae
`aprobada_por`, `fecha_aprobacion` y Capa 1. Esto permite consumir nuevas
versiones revisadas sin promoverlas destructivamente a `ACTIVA`.

## Evidence posture

`evidence_status` sigue siendo siempre `DEMO_OPERATIVA`. El motor no emite ni
promociona evidencia final productiva.
