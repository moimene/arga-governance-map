# motor-plantillas@1.0.0-beta

Fachada estable para composicion documental de Secretaria Societaria.

## Public API

Importar siempre desde `@/lib/motor-plantillas`:

- `MOTOR_PLANTILLAS_VERSION`
- `prepareDocumentComposition(req, capa3Values, options)`
- `composeDocument(req, capa3Values, options)`
- `suggestCapa3Draft(input)`
- `buildCapa3AiAllowedFields(fields)`
- `generateProcessDocxWithMotor(input)`
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

`generateProcessDocxWithMotor()` es el adaptador de compatibilidad para botones
rapidos existentes (`ProcessDocxButton`). Construye el request boundary,
compone con `composeDocument()`, descarga el DOCX como antes y reutiliza el
archivado heredado de `doc-gen`. Los documentos registrales y subsanaciones
permanecen en fallback legacy hasta que entren en scope.

## Draft Assistant Capa 3

`suggestCapa3Draft()` propone valores para campos editables con whitelist
`capa3.<campo>`. No altera Capa 1, no inventa una plantilla y siempre marca las
sugerencias como pendientes de revision humana. En ausencia de proveedor de
modelo configurado usa `capa3-local-demo-assistant@0.1.0`, un fallback local
determinista para demo. Un proveedor IA real debe vivir server-side y devolver
solo los campos permitidos.

## No-schema posture

El motor no escribe `review_state` en ninguna tabla existente. La revision se
modela con state machine pura y schema gate. Hasta aplicar una migracion
aprobada, la UI debe mostrar la revision como bloqueada.

## Template operability

La carga de plantillas acepta `ACTIVA` y `APROBADA`. Para el carril demo del
paquete legal 2026-05-02 tambien acepta `BORRADOR` solo si trae
`aprobada_por`, `fecha_aprobacion` y Capa 1. Esto permite consumir nuevas
versiones revisadas sin promoverlas destructivamente a `ACTIVA`.

## Template inventory — 2026-05-03

Fuente: `plantillas_protegidas` en Cloud Supabase `governance_OS`
(`hzqwefkwsxopwrmtksbg`), leido en modo read-only tras `bun run db:check-target`.
El `id` mostrado es el prefijo de 8 caracteres del UUID. El estado legal refleja
metadatos Cloud (`aprobada_por` + `fecha_aprobacion`), no la decision de negocio
de avanzar con el carril demo. Los paquetes `sql-drafts/2026-05-02-*` siguen
como PROPUESTO/NO APLICADO salvo que se indique lo contrario.

Resumen Cloud actual:

- Total filas: 55.
- `ACTIVA`: 37.
- `ARCHIVADA`: 18.
- `BORRADOR` / `APROBADA` en Cloud: 0.
- Activas con firma legal formal en metadata: 20.
- Activas pendientes de firma legal formal en metadata: 17.
- Motor operable hoy: 37 `ACTIVA` con Capa 1.

| # | id | tipo | materia | organo | modo | version | estado Cloud | estado legal | carril motor |
|---:|---|---|---|---|---|---:|---|---|---|
| 1 | `1b1118a6` | `ACTA_ACUERDO_ESCRITO` | `ACUERDO_SIN_SESION` | `JUNTA_GENERAL_O_CONSEJO` | `NO_SESSION` | 1.2.0 | `ACTIVA` | firmada | operativa |
| 2 | `56bcbb33` | `ACTA_CONSIGNACION` | `DECISION_ADMIN_UNICO` | `ADMIN_UNICO` | `UNIPERSONAL_ADMIN` | 1.1.0 | `ACTIVA` | firmada | operativa |
| 3 | `6f43fcce` | `ACTA_CONSIGNACION` | `DECISION_SOCIO_UNICO` | `SOCIO_UNICO` | `UNIPERSONAL_SOCIO` | 1.1.0 | `ACTIVA` | firmada | operativa |
| 4 | `1e3b82a7` | `ACTA_DECISION_CONJUNTA` | `CO_APROBACION` | `ADMIN_CONJUNTA_O_COAPROBADORES` | `CO_APROBACION` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 5 | `b2409fb5` | `ACTA_ORGANO_ADMIN` | `ADMIN_SOLIDARIO` | `ADMIN_SOLIDARIOS` | `SOLIDARIO` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 6 | `36c28a8c` | `ACTA_SESION` | `CONSEJO_ADMIN` | `CONSEJO_ADMIN` | `MEETING` | 1.1.0 | `ACTIVA` | firmada | operativa |
| 7 | `53b34d3e` | `ACTA_SESION` | `JUNTA_GENERAL` | `JUNTA_GENERAL` | `MEETING` | 1.1.0 | `ACTIVA` | firmada | operativa |
| 8 | `ca3df363` | `CERTIFICACION` | `CERTIFICACION_ACUERDOS` | `DERIVADO_DEL_ACTO` | `-` | 1.2.0 | `ACTIVA` | firmada | operativa |
| 9 | `a242e29e` | `COMISION_DELEGADA` | `ACTAS_ORGANOS_DELEGADOS` | `COMISION_DELEGADA` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 10 | `76c3260e` | `CONVOCATORIA` | `CONVOCATORIA_JUNTA` | `ORGANO_ADMIN` | `MEETING` | 1.1.0 | `ACTIVA` | firmada | operativa |
| 11 | `1e1a7755` | `CONVOCATORIA_SL_NOTIFICACION` | `NOTIFICACION_CONVOCATORIA_SL` | `ORGANO_ADMIN` | `MEETING` | 1.1.0 | `ACTIVA` | firmada | operativa |
| 12 | `438fa893` | `INFORME_DOCUMENTAL_PRE` | `EXPEDIENTE_PRE` | `SOPORTE_INTERNO` | `-` | 1.0.1 | `ACTIVA` | firmada | operativa |
| 13 | `944ff8d4` | `INFORME_GESTION` | `GESTION_SOCIEDAD` | `-` | `-` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 14 | `4c2644ec` | `INFORME_PRECEPTIVO` | `CONVOCATORIA_PRE` | `SOPORTE_INTERNO` | `-` | 1.0.1 | `ACTIVA` | firmada | operativa |
| 15 | `0f724a0d` | `MODELO_ACUERDO` | `ACTIVOS_ESENCIALES` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 16 | `affa4219` | `MODELO_ACUERDO` | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 17 | `68da89bc` | `MODELO_ACUERDO` | `APROBACION_PLAN_NEGOCIO` | `CONSEJO_ADMINISTRACION` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 18 | `2d814072` | `MODELO_ACUERDO` | `AUMENTO_CAPITAL` | `JUNTA_GENERAL` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 19 | `f5b08793` | `MODELO_ACUERDO` | `AUTORIZACION_GARANTIA` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 20 | `ba214d42` | `MODELO_ACUERDO` | `CESE_CONSEJERO` | `CONSEJO_ADMINISTRACION` | `MEETING` | 1.0.0 | `ACTIVA` | pendiente firma legal | operativa |
| 21 | `433da411` | `MODELO_ACUERDO` | `CESE_CONSEJERO` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ACTIVA` | pendiente firma legal | operativa |
| 22 | `313e7609` | `MODELO_ACUERDO` | `COMITES_INTERNOS` | `-` | `-` | 1 | `ACTIVA` | pendiente firma legal | operativa |
| 23 | `0b1beb86` | `MODELO_ACUERDO` | `DELEGACION_FACULTADES` | `CONSEJO_ADMIN` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 24 | `a09cc4bf` | `MODELO_ACUERDO` | `DISTRIBUCION_CARGOS` | `-` | `-` | 1 | `ACTIVA` | pendiente firma legal | operativa |
| 25 | `395ca996` | `MODELO_ACUERDO` | `DISTRIBUCION_DIVIDENDOS` | `JUNTA_GENERAL` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 26 | `389b0205` | `MODELO_ACUERDO` | `FORMULACION_CUENTAS` | `ORGANO_ADMIN` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 27 | `e3697ad9` | `MODELO_ACUERDO` | `FUSION_ESCISION` | `-` | `-` | 1 | `ACTIVA` | pendiente firma legal | operativa |
| 28 | `29739424` | `MODELO_ACUERDO` | `MODIFICACION_ESTATUTOS` | `JUNTA_GENERAL` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 29 | `e64ce755` | `MODELO_ACUERDO` | `NOMBRAMIENTO_AUDITOR` | `JUNTA_GENERAL` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 30 | `27be9063` | `MODELO_ACUERDO` | `NOMBRAMIENTO_CONSEJERO` | `CONSEJO_ADMINISTRACION` | `MEETING` | 1.0.0 | `ACTIVA` | pendiente firma legal | operativa |
| 31 | `10f90d59` | `MODELO_ACUERDO` | `NOMBRAMIENTO_CONSEJERO` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ACTIVA` | pendiente firma legal | operativa |
| 32 | `73669c41` | `MODELO_ACUERDO` | `OPERACION_VINCULADA` | `CONSEJO_ADMIN` | `MEETING` | 1.0.0 | `ACTIVA` | firmada | operativa |
| 33 | `ee72efde` | `MODELO_ACUERDO` | `POLITICA_REMUNERACION` | `-` | `-` | 1 | `ACTIVA` | pendiente firma legal | operativa |
| 34 | `b846bb03` | `MODELO_ACUERDO` | `POLITICAS_CORPORATIVAS` | `-` | `-` | 1 | `ACTIVA` | pendiente firma legal | operativa |
| 35 | `edd5c389` | `MODELO_ACUERDO` | `RATIFICACION_ACTOS` | `CONSEJO_ADMINISTRACION` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 36 | `c06957aa` | `MODELO_ACUERDO` | `REDUCCION_CAPITAL` | `JUNTA_GENERAL` | `MEETING` | 0.1.0 | `ACTIVA` | pendiente firma legal | operativa |
| 37 | `df75cda9` | `MODELO_ACUERDO` | `SEGUROS_RESPONSABILIDAD` | `-` | `-` | 1 | `ACTIVA` | pendiente firma legal | operativa |
| 38 | `2bcf1d46` | `ACTA_ACUERDO_ESCRITO` | `-` | `-` | `NO_SESSION` | 1.0.1 | `ARCHIVADA` | firmada | historica |
| 39 | `f7900c00` | `ACTA_CONSIGNACION` | `-` | `-` | `UNIPERSONAL_ADMIN` | 1.0.0 | `ARCHIVADA` | firmada | historica |
| 40 | `1155d4eb` | `ACTA_CONSIGNACION` | `-` | `-` | `UNIPERSONAL_SOCIO` | 1.0.0 | `ARCHIVADA` | firmada | historica |
| 41 | `b927e80c` | `ACTA_SESION` | `-` | `CONSEJO` | `MEETING` | 1.0.1 | `ARCHIVADA` | firmada | historica |
| 42 | `e6efcb64` | `ACTA_SESION` | `-` | `JUNTA_GENERAL` | `MEETING` | 1.0.1 | `ARCHIVADA` | firmada | historica |
| 43 | `04cedf42` | `CERTIFICACION` | `-` | `-` | `-` | 1.0.1 | `ARCHIVADA` | firmada | historica |
| 44 | `02f56ea2` | `CONVOCATORIA` | `-` | `-` | `MEETING` | 1.0.1 | `ARCHIVADA` | firmada | historica |
| 45 | `c7fd647b` | `CONVOCATORIA_SL_NOTIFICACION` | `CONVOCATORIAS_JUNTAS` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ARCHIVADA` | firmada | historica |
| 46 | `d6c6fa3e` | `INFORME_DOCUMENTAL_PRE` | `EXPEDIENTE_PRE` | `-` | `-` | 1.0.0 | `ARCHIVADA` | firmada | historica |
| 47 | `b2b3b741` | `INFORME_PRECEPTIVO` | `CONVOCATORIA_PRE` | `-` | `MEETING` | 1.0.0 | `ARCHIVADA` | firmada | historica |
| 48 | `4511327a` | `MODELO_ACUERDO` | `ACTIVOS_ESENCIALES` | `-` | `-` | 1 | `ARCHIVADA` | pendiente firma legal | historica |
| 49 | `989acf93` | `MODELO_ACUERDO` | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ARCHIVADA` | pendiente firma legal | historica |
| 50 | `03681acc` | `MODELO_ACUERDO` | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `MEETING` | 1.0.0 | `ARCHIVADA` | pendiente firma legal | historica |
| 51 | `209caf42` | `MODELO_ACUERDO` | `AUTORIZACION_GARANTIA` | `JUNTA_GENERAL` | `MEETING` | 0.1.0 | `ARCHIVADA` | pendiente firma legal | historica |
| 52 | `af3e9227` | `MODELO_ACUERDO` | `DELEGACION_FACULTADES` | `CONSEJO_ADMINISTRACION` | `MEETING` | 1.0.0 | `ARCHIVADA` | pendiente firma legal | historica |
| 53 | `065da99d` | `MODELO_ACUERDO` | `DELEGACION_FACULTADES` | `CONSEJO_ADMINISTRACION` | `MEETING` | 1.0.0 | `ARCHIVADA` | pendiente firma legal | historica |
| 54 | `3554d7b7` | `MODELO_ACUERDO` | `FORMULACION_CUENTAS` | `-` | `-` | 1 | `ARCHIVADA` | pendiente firma legal | historica |
| 55 | `3f2d3603` | `MODELO_ACUERDO` | `OPERACION_VINCULADA` | `CONSEJO_ADMINISTRACION` | `MEETING` | 0.1.0 | `ARCHIVADA` | pendiente firma legal | historica |

## Evidence posture

`evidence_status` sigue siendo siempre `DEMO_OPERATIVA`. El motor no emite ni
promociona evidencia final productiva.
