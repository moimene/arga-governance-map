# 2026-04-27 — Secretaría Societaria: estado del refactor UX y próximas fases

## Propósito

Este documento consolida el estado actual del refactor de Secretaría Societaria tras los trabajos de UX Grupo/Sociedad, fidelidad legal de procesos, trazabilidad de reglas y gestor documental.

Debe servir como punto de arranque para la siguiente tanda de desarrollo. No sustituye a los planes históricos; resume qué está avanzado, qué se ha decidido y qué queda por cerrar.

## Contexto operativo

- Repo de código: `arga-governance-map`.
- Supabase objetivo: `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- Antes de cualquier operación de BD debe pasar `bun run db:check-target`.
- El plan rector de integración Supabase es `docs/superpowers/plans/2026-04-27-ruflo-supabase-architecture-mission.md`.
- Hasta cerrar paridad Supabase, cualquier avance funcional debe declarar qué tablas usa y si depende de schema Cloud, local o tipos generados.
- El módulo Secretaría funciona en doble ámbito:
  - **Modo Grupo**: campañas, coordinación, reporting y procesos multi-sociedad.
  - **Modo Sociedad**: trabajo operativo filtrado por sociedad concreta.
- ARGA es el nombre demo; no usar MAPFRE en código, datos ni commits.
- EAD Trust es el QTSP único para firma QES, sello, timestamp y ERDS.

## Estado ejecutivo

| Bloque | Estado | Resultado |
|---|---:|---|
| Shell Grupo/Sociedad | Avanzado | Selector de ámbito, menú lateral contextual y propagación de `scope/entity` en navegación Secretaría. |
| Modo Sociedad | Avanzado | Listas y vistas principales empiezan a filtrar por sociedad; el usuario ve el contexto de sociedad seleccionada. |
| Modo Grupo / Campañas | MVP funcional | War Room de campañas y modelo inicial de campañas de grupo, con Cuentas Anuales como caso rector. |
| Convocatorias | Avanzado | Stepper con requisitos legales, documentales, canales y plazos en modo recordatorio no bloqueante. |
| Reuniones | Avanzado | Asistentes, representantes, quórum, votación por punto y snapshot legal con separación societaria/contractual. |
| Reglas | Avanzado | Rule packs, lifecycle, resolución de reglas y explicación mejoradas; pendiente consolidar paridad Cloud/local y UI de gobierno de reglas. |
| Gestor documental | Avanzado | Plantillas protegidas, generación DOCX, preflight de variables, archivo con evidence bundle y metadatos QES. |
| QA | Parcial | `tsc`, tests focalizados, build y smokes de navegador ejecutados en tandas críticas. Falta suite e2e completa verde para todos los caminos nuevos. |
| Hito humano | Preparado | Guía de prueba legal creada para revisión con usuarios reales del departamento legal. |

## Decisiones consolidadas

1. **Convocatoria no bloquea por requisitos materiales.**
   Si una convocatoria se ejecuta fuera del sistema, la plataforma debe alertar y dejar traza, no impedir la acción. Los bloqueos fuertes se reservan para constitución, proclamación, autoridad, firma, certificación, evidencia y archivo.

2. **Los procesos no se pueden aplanar.**
   Cada stepper debe respetar órgano competente, materia, tipo social, forma de administración, estatutos, pactos, quórum, mayoría, capital, derechos de voto, conflictos, vetos, plazos y documentos obligatorios.

3. **Sociedad y Grupo son experiencias distintas.**
   En modo Sociedad, el menú y los datos deben estar vinculados a la sociedad elegida: órganos, personas, plantillas, libros, convocatorias, reuniones, actas, acuerdos y reglas. En modo Grupo, el usuario debe lanzar y monitorizar campañas coordinadas.

4. **El gestor documental es infraestructura crítica.**
   Convocatorias, actas, certificaciones, informes preceptivos y documentos de expediente deben generarse desde plantillas protegidas, con variables resueltas, preflight, hash, evidence bundle y trazabilidad QTSP.

5. **La BD está en fase sensible.**
   Hay que mantener cautela con migraciones porque existe riesgo de divergencia Cloud/local. No aplicar cambios destructivos; primero paridad, luego migración.

6. **No hay avances funcionales mudos contra Supabase.**
   Si una pantalla o hook usa columnas nuevas, debe nombrar su migración requerida y dejar claro si la dependencia ya existe en Cloud, en migración local y en tipos generados.

7. **GRC y AIMS no deben duplicar modelos.**
   Cualquier trabajo en esos módulos debe indicar si consume legacy (`ai_*`, tablas operativas históricas) o backbone nuevo (`aims_*`, `grc_*`) hasta que Track D/E decidan adopción definitiva.

## Avances recientes

### 1. Refactor UX Grupo/Sociedad

- Se reorganizó la navegación para separar el trabajo de grupo y el trabajo de sociedad.
- El selector de ámbito se propaga por query params (`scope=sociedad&entity=...`).
- Se redujo la ambigüedad del menú: las opciones se entienden mejor según contexto.
- Se añadió smoke e2e para navegación Secretaría y War Room.

Pendiente:

- Revisar naming final de cada entrada del menú en modo Sociedad.
- Asegurar que todos los steppers consumen la sociedad de la URL al crear registros.
- Evitar acciones que puedan crear expedientes fuera de la sociedad seleccionada.

### 2. Campañas de grupo

Se adoptó el concepto de **Campaña de grupo -> expedientes por sociedad** como valor operativo principal.

Caso rector:

- Campaña de Cuentas Anuales.
- Fases: formulación, convocatoria JGA, aprobación JGA/socio único, depósito.
- Descomposición por sociedad según `AdoptionMode`, tipo social, forma de administración y datos maestros.

Otros casos definidos:

- Renovación de cargos.
- Presupuesto anual / plan de negocio.
- Garantías intragrupo.
- Dividendos.
- Modificación estatutaria coordinada.
- Auditor.
- Operaciones estructurales.
- Compliance anual.
- Sucursales.

Pendiente:

- Pasar de War Room demo a generación real de expedientes por sociedad.
- Parametrizar campañas desde UI.
- Persistir dependencias temporales y tareas POST.
- Enlazar cada línea de campaña con convocatoria, reunión, acta, certificación y registro.

### 3. Fidelidad legal de convocatorias y reuniones

Convocatorias:

- Se añadieron requisitos de canal, plazo, documento, órgano y materia como recordatorios.
- Se acepta la decisión de no bloquear emisión por advertencias de convocatoria.
- Se conserva traza de reglas y advertencias aceptadas.

Reuniones:

- Se avanzó en asistentes, representación y capital/voto.
- El stepper empieza a trabajar con datos más fieles a junta/consejo.
- Se mantiene la necesidad de distinguir derechos económicos y derechos de voto cuando el acuerdo lo exige.

Pendiente crítico:

- Excluir conflictuados del denominador cuando proceda.
- Separar validez societaria de cumplimiento contractual de pactos.
- Aplicar vetos y mayorías pactadas sin confundirlos con mayoría legal.
- Persistir snapshot de constitución, votación y proclamación por punto del orden del día.

### 4. Gobierno y mantenimiento de reglas

Se avanzó hacia un modelo de reglas mantenible:

- Rule packs versionados.
- Lifecycle jurídico.
- Resolución de regla efectiva.
- Overrides por contexto.
- Tests focalizados de resolución.

Pendiente:

- UI mínima para catálogo de reglas, versión activa, hash, vigencia y overrides.
- Matriz de control legal que conecte requisito -> fuente -> regla -> pantalla -> test.
- Paridad completa Cloud/local/tipos generados.
- Auditoría de consumidores legacy para usar el adaptador canónico.
- Confirmar Cloud/local/types para `rule_pack_versions` lifecycle antes de ampliar UI dependiente.

### 5. Gestor documental

Avances implementados:

- `template-renderer` analiza Handlebars con AST para detectar variables reales.
- `findMissingVariables()` permite preflight antes de generar.
- `process-documents` bloquea variables obligatorias no resueltas.
- `ProcessDocxButton` muestra error útil cuando faltan variables obligatorias.
- `GenerarDocumentoStepper` valida variables requeridas, integra QES y archiva con metadatos.
- `archiveDocxToStorage` exige evidence bundle creado; si falla, no declara éxito falso.
- QES ya no se presenta como binario firmado archivado si EAD Trust no devuelve `signedDocumentData`.
- `template-routing` dirige cada plantilla al flujo correcto:
  - modelos de acuerdo -> tramitador,
  - convocatorias -> convocatoria,
  - actas/certificaciones -> actas,
  - informes PRE -> convocatoria/expediente.
- `GestorPlantillas` tolera JSON parcial en Capa 2/Capa 3 sin romper la pantalla.

Pendiente:

- Completar captura guiada de Capa 3 en flujos rápidos, no solo en el generador completo.
- Añadir descarga/archivo observable en e2e para DOCX.
- Completar cobertura de plantillas por jurisdicción y tipo documental.
- Confirmar en Cloud la disponibilidad de plantillas PRE (`INFORME_PRECEPTIVO`, `INFORME_DOCUMENTAL_PRE`) antes de hacerlas obligatorias en flujos.

### 6. Consumo contextual de plantillas en flujos destino

Tanda 2026-04-27:

- `process-documents` acepta `preferredTemplateId` y lo usa solo si la plantilla es compatible, usable y coincide con los criterios del proceso. Si no aplica, mantiene el fallback anterior.
- `ConvocatoriasStepper` lee `?plantilla=...`, precarga materia/canal cuando la plantilla es compatible y deja referencia en `rule_trace.context.selected_template` y `reminders_trace.documents.selected_template`.
- `ConvocatoriasList` y `ConvocatoriaDetalle` preservan `?plantilla/tipo` y generan convocatoria o informe PRE con la plantilla preferida cuando corresponde.
- `ActasLista` y `ActaDetalle` preservan `?plantilla/tipo` para generación de acta o certificación.
- `GenerarDocumentoStepper` lee `?plantilla=...` y autoselecciona la plantilla compatible en el paso documental.
- Se añadieron tests unitarios para selección preferente y fallback de plantilla incompatible.

Contrato de datos de la tanda:

- Tablas usadas: `plantillas_protegidas`, `convocatorias`, `attachments`, `minutes`, `certifications`, `meeting_resolutions`, `agreements`, `registry_filings`.
- Fuente de verdad: Cloud runtime con paridad local pendiente en columnas documentadas por el plan rector.
- Migración requerida: ninguna nueva en esta tanda. Depende de migraciones existentes para `plantillas_protegidas`, `attachments` y trazas de `convocatorias`.
- Tipos afectados: interfaces TypeScript locales de generación documental; no se regeneraron tipos Supabase.
- Contratos cross-module: `attachments` y `evidence_bundles` siguen siendo el canal de archivo/evidencia; no se introduce contrato nuevo.
- Riesgo de paridad: medio por drift conocido en `convocatorias.rule_trace`, `convocatorias.reminders_trace`, `convocatorias.accepted_warnings` y plantillas PRE.

### 7. Preparación de hito humano legal

Tanda 2026-04-27:

- Creada la guía `docs/superpowers/plans/2026-04-27-secretaria-human-milestone-test-guide.md`.
- La guía convierte la matriz legal en un guion de prueba para usuarios reales de Secretaría.
- Incluye criterios de aceptación, rutas, preguntas de validación legal, cobertura documental, plantilla de feedback y contrato de datos.
- No toca código ni Supabase; sirve para ordenar la sesión de revisión y capturar hallazgos UX/legal con estructura.

### 8. Reuniones v2 — snapshot de adopción por punto

Tanda 2026-04-27:

- Creado `meeting-adoption-snapshot`, helper puro para evaluar cada punto del orden del día antes de persistir resoluciones.
- `VotacionesStep` deja de decidir por `favor > contra` plano y usa snapshot por punto con:
  - mayoría según rule pack aplicable;
  - denominador computable;
  - exclusión de conflictuados del voto;
  - veto estatutario como bloqueo societario cuando aparece en overrides;
  - pacto parasocial como pista contractual separada;
  - estado `ADOPTED/REJECTED` derivado de validez societaria, no de cumplimiento contractual.
- Los snapshots se guardan sin migración en `meetings.quorum_data.point_snapshots`.
- El acta generada incorpora resumen del snapshot: validez societaria, votos computables y advertencias de pactos.
- `evaluarVotacion` corrige la prioridad de mayoría: Consejo/Comisión usa `mayoria.CONSEJO` antes que mayoría SA/SL de la sociedad titular.

Contrato de datos de la tanda:

- Tablas usadas: `meetings`, `meeting_attendees`, `meeting_resolutions`, `meeting_votes`, `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `pactos_parasociales`.
- Fuente de verdad: Cloud runtime, usando `meetings.quorum_data` como contenedor JSON existente.
- Migración requerida: ninguna nueva.
- Tipos afectados: helper TypeScript puro y tipos locales de `ReunionStepper`; no se regeneraron tipos Supabase.
- Contratos cross-module: snapshots alimentan acta/certificación y evidencia posterior a través del flujo existente `minutes`/`certifications`/`evidence_bundles`.
- Riesgo de paridad: medio por lifecycle de `rule_pack_versions` y disponibilidad real de rule packs activos en Cloud.

### 9. Actas y certificaciones v2 — certificación desde snapshot legal

Tanda 2026-04-27:

- Creado `certification-snapshot`, helper puro para construir el plan de certificación de un acta desde `meetings.quorum_data.point_snapshots`.
- `ActaDetalle` deja de usar solo `meeting_resolutions.agreement_id` como fuente plana y muestra una revisión legal por punto:
  - punto del orden del día;
  - materia y clase;
  - votos a favor, en contra, base computable y votos excluidos por conflicto;
  - incidencias societarias;
  - alertas contractuales por pacto parasocial.
- El botón "Emitir certificación" solo se habilita cuando hay snapshots y al menos un punto `ADOPTED` con `societary_validity.ok = true`.
- Si existe `agreement_id`, se certifica esa referencia. Si la resolución todavía no tiene expediente desacoplado, se usa una referencia estable `meeting:<meetingId>:point:<n>` para no perder trazabilidad.
- Pactos parasociales incumplidos se muestran como advertencia contractual, pero no impiden emitir la certificación si la validez societaria es correcta.
- Puntos rechazados, no proclamables, bloqueados por mayoría/quórum/veto estatutario o sin snapshot quedan excluidos del array `agreements_certified`.
- `EmitirCertificacionButton` recibe `disabledReason` y refresca las queries correctas tras emitir.

Contrato de datos de la tanda:

- Tablas usadas: `minutes`, `meetings`, `meeting_resolutions`, `certifications`, `authority_evidence`, `capability_matrix`.
- Fuente de verdad: Cloud runtime, usando `meetings.quorum_data.point_snapshots` como snapshot legal operativo existente.
- Migración requerida: ninguna nueva.
- Tipos afectados: helper TypeScript puro `CertificationPlan`; no se regeneraron tipos Supabase.
- Contratos cross-module: mantiene el pipeline existente `fn_generar_certificacion` -> `fn_firmar_certificacion` -> `fn_emitir_certificacion`; el array `agreements_certified` pasa a representar referencias certificables derivadas del snapshot.
- Riesgo de paridad: bajo-medio. No añade columnas, pero depende de que las reuniones nuevas escriban `point_snapshots`; actas legacy sin snapshot quedan en modo alerta y no certifican automáticamente.

### 10. Tramitador registral — entrada desde certificación

Tanda 2026-04-27:

- El detalle de acta añade "Abrir en tramitador" en cada certificación emitida/listada.
- La ruta destino usa `certificacion=<id>` y, cuando el acta tiene `entity_id`, fuerza contexto de sociedad para evitar tramitaciones registrales sin sociedad explícita.
- Creado `certification-registry-intake`, helper puro que separa:
  - referencias UUID enlazables a `agreements`;
  - referencias operativas por punto `meeting:<meetingId>:point:<n>`.
- `TramitadorStepper` lee la certificación, muestra panel de entrada, estado de firma, evidencia vinculada y número de referencias certificadas.
- Si la certificación contiene exactamente un acuerdo registrable visible, el tramitador lo preselecciona automáticamente.
- Si la entrada viene desde certificación, el selector solo muestra acuerdos incluidos en esa certificación. No permite escoger acuerdos ajenos al certificado.
- Si la certificación solo contiene referencias por punto `meeting:<meetingId>:point:<n>`, el tramitador no simula una FK registral; muestra alerta de que falta expediente inscribible enlazable.
- Si la certificación está firmada pero sin `evidence_id`, la pantalla de acta lo muestra como "Evidencia pendiente" y el tramitador no permite registrar la escritura hasta archivar la certificación DOCX.
- Creado `registry-certification-link`, helper puro para generar payload canónico y hash SHA-256 del vínculo certificación -> tramitación.
- Al registrar escritura desde certificación, el sistema persiste un evento `REGISTRY_FILING_CERTIFICATION_LINKED` en `audit_log`.
- Si la certificación ya tiene `evidence_id`, añade además un artifact WORM en `evidence_bundle_artifacts` con `artifact_type = COMPLIANCE_SNAPSHOT`.
- Se elimina dependencia funcional de `upsert(... onConflict: "tenant_id,agreement_id")`, porque no hay constraint única visible en migraciones/tipos. Ahora se busca la tramitación activa por acuerdo y se actualiza por `registry_filings.id`.
- Los documentos registrales y subsanaciones reciben variables documentales de certificación:
  - `certificacion_id`;
  - `certificacion_minute_id`;
  - `certificacion_estado_firma`;
  - `certificacion_referencias`;
  - `certificacion_acuerdos_enlazables`;
  - `certificacion_referencias_punto`;
  - `certificacion_evidence_id`;
  - `certificacion_gate_hash`.
- `process-documents` filtra referencias no UUID al archivar documentos ligados a acuerdos. Esto evita tratar referencias `meeting:*:point:*` como IDs de `agreements`.

Contrato de datos de la tanda:

- Tablas usadas: `certifications`, `minutes`, `agreements`, `registry_filings`, `audit_log`, `evidence_bundle_artifacts`.
- Fuente de verdad: Cloud runtime; `certifications.agreements_certified` contiene referencias certificadas, no necesariamente todas FK a `agreements`.
- Migración requerida: ninguna nueva.
- Tipos afectados: helpers TypeScript puros `CertificationRegistryIntake` y `RegistryFilingCertificationLink`; no se regeneraron tipos Supabase.
- Contratos cross-module: se usa el backbone probatorio existente `audit_log` + `evidence_bundle_artifacts`; no se crea contrato nuevo ni se muta el manifest WORM del bundle.
- Riesgo de paridad: medio-bajo. Depende de `certifications.gate_hash` existente en Cloud; si tipos generados no lo reflejan, se mantiene como lectura runtime hasta regeneración.

### 11. Agreement 360 multi-origen — acuerdos nacidos en reunión

Tanda 2026-04-27:

- Confirmado con revisión Ruflo que el schema existente ya soporta el modelo 360 sin migración:
  - `agreements.parent_meeting_id` enlaza el acuerdo efectivo con la sesión.
  - `meeting_resolutions.agreement_id` enlaza la resolución del acta con el expediente de acuerdo.
  - `agreements.execution_mode`, `compliance_snapshot` y `compliance_explain` trazan origen, punto y snapshot legal.
- Creado `agreement-360`, helper puro que decide si un punto de reunión puede materializar un acuerdo efectivo.
- `useSaveMeetingResolutions` ahora:
  - conserva la resolución como resultado de votación;
  - si el snapshot es `ADOPTED` y societariamente proclamable, crea o actualiza el `agreement` efectivo;
  - escribe `meeting_resolutions.agreement_id` para que acta, certificación y tramitador trabajen con UUID real;
  - usa idempotencia sin migración leyendo `execution_mode.agenda_item_index`;
  - si un punto previamente adoptado deja de ser proclamable, degrada el agreement vinculado a `DRAFT` sin borrarlo.
- `ReunionStepper` distingue en UI resolución registrada, acuerdo 360 materializado y punto no proclamable por quórum/mayoría/veto estatutario.
- El acta generada lista “Resoluciones y acuerdos 360” e incluye el UUID del acuerdo cuando existe.
- El flujo sin sesión también rellena `proposal_text`, `decision_text` y `execution_mode.agreement_360`, evitando expedientes vacíos.
- `useOpenMeeting` deja de escribir `OPEN` y usa `CELEBRADA`, estado aceptado por el modelo Cloud actual.

Contrato de datos de la tanda:

- Tablas usadas: `meetings`, `meeting_resolutions`, `meeting_votes`, `agreements`, `no_session_resolutions`.
- Fuente de verdad: Cloud runtime. Se reutilizan columnas existentes en Cloud y migraciones locales previas; no se añaden columnas.
- Migración requerida: ninguna nueva.
- Tipos afectados: helper TypeScript `agreement-360`, `SaveMeetingResolutionInput` y UI de `ReunionStepper`; no se regeneraron tipos Supabase.
- Contratos cross-module: `agreements.id` vuelve a ser la referencia 360 para acta, certificación, gestor documental, tramitador registral, evidencia y auditoría.
- Riesgo de paridad: medio. Los tipos generados siguen desfasados en algunas extensiones, pero el cliente Supabase de la app no está tipado y el build valida el consumo actual.

### 12. Agenda real/preparada en reuniones

Tanda 2026-04-27:

- Creado `meeting-agenda`, helper puro para fusionar fuentes de agenda sin migración.
- `ReunionStepper` paso 4 pasa de “Debates” a “Agenda y debate”.
- La agenda de reunión se construye desde cuatro orígenes trazables:
  - `agenda_items` de la reunión;
  - `convocatorias.agenda_items` localizada por `body_id + fecha_1`;
  - `agreements` preparados (`DRAFT/PROPOSED`) con `parent_meeting_id`;
  - puntos añadidos durante la sesión.
- Cada punto guardado en `meetings.quorum_data.debates` conserva:
  - `origin`;
  - `source_table`;
  - `source_id`;
  - `source_index`;
  - `agreement_id` si parte de una propuesta preparada.
- `VotacionesStep` usa esos orígenes para decidir cómo materializar el acuerdo:
  - propuesta preparada -> actualiza el `agreement` existente;
  - agenda/convocatoria -> crea acuerdo como `AGENDA_ITEM`;
  - punto nacido en sesión -> crea acuerdo como `MEETING_FLOOR`.
- El acta incorpora el origen del punto y el ID de propuesta preparada cuando existe.

Contrato de datos de la tanda:

- Tablas usadas: `meetings`, `agenda_items`, `convocatorias`, `agreements`, `meeting_resolutions`, `meeting_votes`.
- Fuente de verdad: Cloud runtime con JSON existente en `meetings.quorum_data`.
- Migración requerida: ninguna nueva.
- Tipos afectados: helper TypeScript `meeting-agenda`, `useMeetingAgendaSources`, tipos locales de `ConvocatoriaRow` y `ReunionStepper`; no se regeneraron tipos Supabase.
- Contratos cross-module: mantiene `agreements.id` como objeto 360; `convocatorias.agenda_items` alimenta la agenda de sesión y documenta origen de punto.
- Riesgo de paridad: medio. `agenda_items` existe en tipos generados, pero su migración base no está representada en las migraciones locales actuales; queda como punto de paridad a cerrar.

### 13. Vínculo explícito convocatoria/campaña -> reunión

Tanda 2026-04-27:

- Creado `meeting-links`, helper puro para leer y escribir vínculos explícitos en `meetings.quorum_data.source_links`.
- El vínculo explícito soporta:
  - `convocatoria_id`;
  - `convocatoria_ids`;
  - `group_campaign_id`;
  - `group_campaign_ids`;
  - `agreement_ids`.
- `useMeetingAgendaSources` ahora prioriza `quorum_data.source_links.convocatoria_id` para cargar la agenda de convocatoria.
- El match legacy `body_id + fecha_1` se conserva solo como fallback si no hay vínculo explícito.
- `useMeetingAgendaSources` también lee `agreement_ids` explícitos para recuperar propuestas preparadas aunque todavía no tengan `parent_meeting_id`.
- `DebatesStep` y `VotacionesStep` actualizan `source_links` cuando guardan agenda/snapshots.
- `useAgreementCompliance` usa primero `source_links.convocatoria_id` antes de recurrir al match por fecha. Esto evita que el compliance de un acuerdo tome una convocatoria equivocada si hay varias reuniones del mismo órgano en el mismo día.
- Los puntos de agenda derivados de acuerdos de campaña arrastran `group_campaign_id` desde `agreements.compliance_snapshot.campaign_id`.

Contrato de datos de la tanda:

- Tablas usadas: `meetings`, `convocatorias`, `agreements`, `agenda_items`, `meeting_resolutions`, `meeting_votes`.
- Fuente de verdad: Cloud runtime con `meetings.quorum_data.source_links` como contrato JSON aplicativo.
- Migración requerida: ninguna nueva.
- Tipos afectados: helper TypeScript `meeting-links`, `useMeetingAgendaSources`, `useAgreementCompliance` y `ReunionStepper`; no se regeneraron tipos Supabase.
- Contratos cross-module: `source_links` conecta convocatoria, campaña, acuerdos preparados, reunión, acta y tramitador sin crear FK nueva.
- Riesgo de paridad: bajo-medio. No añade columnas, pero `source_links` debe documentarse como contrato JSON estable hasta que se decida FK formal en paridad Supabase.

### 14. Trazabilidad documental del Acuerdo 360

Tanda 2026-04-27:

- Creado `agreement-document-contract`, helper puro para clasificar documentos como:
  - `AGREEMENT_LINKED`;
  - `PRE_AGREEMENT_ALLOWED`;
  - `PENDING_AGREEMENT_LINK`;
  - `NOT_AGREEMENT_DOCUMENT`.
- `process-documents` incorpora esa clasificacion al pie de trazabilidad del DOCX:
  - documentos PRE como convocatoria o informe PRE pueden existir sin `agreement_id`;
  - documentos dispositivos/finales como acta, certificacion, acuerdo sin sesion, decision unipersonal o documento registral quedan marcados como pendientes de enlace si no llevan `agreement_id`;
  - si el flujo aporta `archive.agreementId`, `archive.agreementIds` o variables de acuerdo, el footer muestra el acuerdo canonico enlazado.
- Esto refuerza que la matriz de plantillas y materias no crea un catalogo paralelo de acuerdos. El ciclo de vida canonico sigue siendo `agreements.id`.
- El test de `process-documents` ahora prepara `localStorage` en entorno Bun antes de importar el cliente Supabase, evitando fallo de entorno en tests focalizados.

Contrato de datos de la tanda:

- Tablas usadas: ninguna nueva. El runtime existente de `process-documents` puede leer/escribir las tablas ya documentadas si se ejecuta archivo, pero esta tanda no introduce nueva dependencia de schema.
- Fuente de verdad: runtime UI/documental existente; `agreements.id` sigue siendo el identificador canonico.
- Migracion requerida: ninguna nueva.
- Tipos afectados: helper TypeScript puro `agreement-document-contract`; no se regeneraron tipos Supabase.
- RLS/RPC/storage afectados: no.
- Contratos cross-module: ninguno nuevo; se refuerza el contrato de Secretaria `Agreement 360`.
- Riesgo de paridad: bajo. No añade columnas, tablas ni constraints.

### 15. Normalizador legal de plantillas

Tanda 2026-04-28:

- Creado `legal-template-normalizer`, helper puro para absorber modelos Word del equipo legal sin cargar plantillas en Supabase durante el freeze.
- El normalizador convierte placeholders tipo `[NOMBRE DE LA SOCIEDAD]`, `[Fecha de emisión]`, `[Punto 1 del orden del día]`, `[Redacción del acuerdo X]` y `[Relación de asistentes]` a variables Handlebars canonicas.
- Se distinguen placeholders manuales (`[detalle]`, `[persona/s]`, `[condiciones]`) como pendientes editables, sin inventar datos ni resolverlos contra schema inexistente.
- Se incorporan alias entre variables canonicas y legacy: `denominacion_social/empresa_nombre`, `porcentaje_capital_presente/quorum_observado`, `miembros_presentes/asistentes_lista`, etc.
- `process-documents` expande alias legales antes de renderizar, de forma que una plantilla pueda venir con nombres legacy y el proceso siga usando el contrato canonico.
- Se añaden equivalencias legales criticas sin aplanar reglas:
  - `J-01` se descompone en `J1/J2`.
  - `J-04` incluye `J9` solo si hay supresion de preferencia.
  - `J-07` incluye `J14` para cesion global de activo.
  - `J-08` apunta a `J21` solo cuando supera el umbral de activo esencial.
  - `CA-03`, `CA-05`, `CA-08` y `CA-09` se tratan como rutas condicionales, no como mapeos planos.
- Se exponen bloques Handlebars para listas dinamicas (`orden_dia`, `acuerdos`, `miembros_presentes`) sin exigir campos internos como variables raiz en preflight.

Contrato de datos de la tanda:

- Tablas usadas: ninguna nueva. El runtime de generacion documental conserva las tablas existentes ya documentadas si el usuario genera/archiva un DOCX.
- Fuente de verdad: documentos legales locales + helper TypeScript puro; no Cloud.
- Migracion requerida: ninguna.
- Tipos afectados: helper TypeScript `legal-template-normalizer`; no se regeneraron tipos Supabase.
- RLS/RPC/storage afectados: no.
- Contratos cross-module: refuerza el contrato documental de Secretaría y mantiene `agreements.id` como eje canonico Agreement 360.
- Riesgo de paridad: bajo-medio. No hay schema nuevo, pero falta validar carga real de plantillas PRE y modelos aprobados cuando se levante el freeze.

### 16. Fixtures legales y Capa 3 en flujos rapidos

Tanda 2026-04-28:

- Creado `legal-template-fixtures`, catalogo local no persistido con los cinco modelos Word base entregados por Legal:
  - convocatoria de Junta;
  - convocatoria de Consejo;
  - acta de Junta;
  - acta de Consejo;
  - certificacion de acuerdos.
- Los fixtures usan Handlebars y los bloques dinamicos del normalizador para `orden_dia`, `acuerdos` y `miembros_presentes`.
- `process-documents` transforma campos Capa 3 multilinea (`orden_dia_texto`, `acuerdos_texto`, `miembros_presentes_texto`) a listas estructuradas antes de renderizar.
- La seleccion de plantilla reconoce familias de organo (`CDA`/`CONSEJO`, `JUNTA_GENERAL`/`JUNTA`) para que el fallback legal no mezcle Junta y Consejo.
- `ProcessDocxButton` fusiona plantillas Cloud runtime con fixtures locales, priorizando Cloud si existe.
- Los flujos rapidos que ya usan `ProcessDocxButton` muestran ahora una captura guiada Capa 3 antes de generar DOCX cuando la plantilla seleccionada lo requiere:
  - convocatoria;
  - informe PRE;
  - acta;
  - certificacion;
  - acuerdo sin sesion;
  - decision unipersonal;
  - documento registral/subsanacion.
- No se insertan plantillas en `plantillas_protegidas`; los fixtures quedan como puente de UX/demo hasta que se cierre paridad Supabase y carga legal aprobada.

Contrato de datos de la tanda:

- Tablas usadas: ninguna nueva. Runtime documental puede leer `plantillas_protegidas`; si se genera/archiva DOCX, mantiene el uso existente de `attachments`, `agreements`, `certifications`, `minutes`, `meeting_resolutions`, `evidence_bundles` y storage.
- Fuente de verdad: fixtures locales derivados del cuadro legal, con prioridad de plantillas Cloud si existen.
- Migracion requerida: ninguna.
- Tipos afectados: TypeScript local (`legal-template-fixtures`, `legal-template-normalizer`, `ProcessDocxButton`, `process-documents`); no se regeneraron tipos Supabase.
- RLS/RPC/storage afectados: no.
- Contratos cross-module: no se crea contrato nuevo; el documento generado sigue trazando Agreement 360 cuando existe.
- Riesgo de paridad: medio. Los fixtures son intencionalmente temporales y deben reemplazarse por plantillas aprobadas Cloud cuando se levante el freeze.

### 17. Cobertura legal en Gestor Plantillas

Tanda 2026-04-29:

- Creado `legal-template-coverage`, helper puro que calcula cobertura documental por familia critica:
  - convocatoria Junta;
  - convocatoria Consejo;
  - acta Junta;
  - acta Consejo;
  - certificacion;
  - acta de consignacion;
  - acta sin sesion;
  - informe preceptivo;
  - informe documental PRE;
  - modelo de acuerdo.
- La cobertura distingue cuatro estados:
  - Cloud activa;
  - Cloud pendiente;
  - fixture local pendiente de carga;
  - sin cobertura.
- El match por organo usa familias (`CDA`/`CONSEJO`, `JUNTA_GENERAL`/`JUNTA`) para evitar falsos huecos.
- En modo Sociedad, la cobertura respeta jurisdiccion aplicable igual que el listado de plantillas.
- `GestorPlantillas` incorpora un panel operativo de cobertura legal con contadores por fuente y filas por familia documental.
- Los KPIs de huecos pasan a representar familias sin Cloud activa, no simples tipos agregados.
- Los fixtures siguen siendo puente temporal: el panel los etiqueta como carga pendiente, no como plantilla aprobada.

Contrato de datos de la tanda:

- Tablas usadas: ninguna nueva. La UI lee `plantillas_protegidas` via hook existente.
- Fuente de verdad: Cloud runtime para plantillas reales; fixtures locales solo como fallback visual/demo.
- Migracion requerida: ninguna.
- Tipos afectados: TypeScript local `legal-template-coverage` y UI `GestorPlantillas`; no se regeneraron tipos Supabase.
- RLS/RPC/storage afectados: no.
- Contratos cross-module: no se crea contrato nuevo.
- Riesgo de paridad: medio. El panel hace visible el drift entre cobertura local provisional y plantillas Cloud aprobadas.

## Verificaciones recientes

Última tanda cobertura legal en Gestor Plantillas:

- `bun test src/lib/secretaria/__tests__/legal-template-coverage.test.ts src/lib/secretaria/__tests__/legal-template-fixtures.test.ts src/lib/secretaria/__tests__/legal-template-normalizer.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 23/23.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- `bun run db:check-target` — no ejecutado; no se toco Supabase.

Última tanda fixtures legales + Capa 3 rapida:

- `bun test src/lib/secretaria/__tests__/legal-template-normalizer.test.ts src/lib/secretaria/__tests__/legal-template-fixtures.test.ts src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts src/lib/doc-gen/__tests__/template-renderer.test.ts` — OK, 26/26.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- `bun run db:check-target` — no ejecutado; no se toco Supabase.

Última tanda normalizador legal de plantillas:

- `bun test src/lib/secretaria/__tests__/legal-template-normalizer.test.ts src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 19/19.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run db:check-target` — no ejecutado; no se toco Supabase.

Última tanda Agreement 360 documental:

- `bun test src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 12/12.
- `bunx tsc --noEmit --pretty false` — OK.

Última tanda crítica documental:

- `bunx tsc --noEmit --pretty false` — OK.
- `bun run test src/lib/doc-gen/__tests__/process-documents.test.ts src/lib/doc-gen/__tests__/template-renderer.test.ts` — OK, 9/9.
- `bun run build` — OK.
- `bun run db:check-target` — OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- Smoke en navegador:
  - `/secretaria/gestor-plantillas` — carga sin error boundary.
  - `/secretaria/tramitador/nuevo?scope=sociedad&entity=...` — carga en modo Sociedad sin error boundary.
  - `/secretaria/convocatorias?plantilla=...&tipo=INFORME_PRECEPTIVO` — carga sin error boundary, muestra banner de plantilla y conserva query al entrar al detalle.
  - `/secretaria/actas?plantilla=...&tipo=CERTIFICACION` — carga sin error boundary, muestra banner de plantilla y conserva query al entrar al detalle.

Observación:

- Para la entidad alemana seleccionada en el smoke no había plantillas aplicables. Eso es hueco de cobertura de datos/jurisdicción, no bug de UI.

Última tanda Reuniones/Actas v2:

- `bun run db:check-target` — OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `bun run test src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts` — OK, 7/7.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- Smoke navegador `/secretaria/actas` -> primera acta -> detalle — OK: aparece `Contenido del acta`, aparece `Revisión legal para certificación` y no hay error boundary.

Última tanda Tramitador desde certificación:

- `bun run db:check-target` — OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `bun run test src/lib/secretaria/__tests__/registry-certification-link.test.ts src/lib/secretaria/__tests__/certification-registry-intake.test.ts src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 16/16.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- Smoke navegador `/secretaria/tramitador/nuevo?certificacion=...&scope=sociedad&entity=...` — OK: aparece el asistente, aparece panel "Entrada desde certificación" y no hay error boundary.

Última tanda Agreement 360 multi-origen:

- `bun run db:check-target` — OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `bun test src/lib/secretaria/__tests__/agreement-360.test.ts src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts` — OK, 11/11.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/05-secretaria-reuniones.spec.ts --project=chromium` — OK, 5/5.

Última tanda Agenda real/preparada:

- `bun run db:check-target` — OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `bun test src/lib/secretaria/__tests__/meeting-agenda.test.ts src/lib/secretaria/__tests__/agreement-360.test.ts src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts` — OK, 15/15.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/05-secretaria-reuniones.spec.ts --project=chromium` — OK, 5/5.

Última tanda Vínculo explícito convocatoria/campaña -> reunión:

- `bun run db:check-target` — OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- `bun test src/lib/secretaria/__tests__/meeting-links.test.ts src/lib/secretaria/__tests__/meeting-agenda.test.ts src/lib/secretaria/__tests__/agreement-360.test.ts src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts` — OK, 18/18.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/05-secretaria-reuniones.spec.ts --project=chromium` — OK, 5/5.

Última tanda Cobertura documental ampliada Legal 2026-04-29:

- Se amplian los fixtures locales de plantillas Word sin tocar Supabase: acta de consignacion para socio unico, acta de consignacion para administrador unico, acuerdo escrito sin sesion, informe preceptivo, informe documental PRE, documento registral y subsanacion registral.
- La cobertura documental distingue `UNIPERSONAL_SOCIO`, `UNIPERSONAL_ADMIN` y `NO_SESSION`; ya no trata las actas no reunidas como una familia plana.
- `template-routing` dirige cada plantilla al flujo natural: decisiones unipersonales, acuerdos sin sesion o tramitador registral.
- `DecisionDetalle`, `AcuerdoSinSesionDetalle` y `TramitadorStepper` rellenan variables canonicas de Capa 3 para generar DOCX coherentes, manteniendo `agreement_id` como referencia canonica cuando ya existe.
- `process-documents` admite `INFORME_DOCUMENTAL_PRE` como kind documental y conserva el archivo de informes PRE en el canal existente de convocatoria cuando aplique.
- No se crean tablas, columnas, RLS, RPC, storage ni tipos Supabase.

Contrato de datos de la tanda:

- Tablas usadas: ninguna nueva. Runtime existente puede leer `plantillas_protegidas`; generación/archivo documental mantiene los contratos existentes `agreements`, `convocatorias`, `attachments`, `minutes`, `certifications`, `meeting_resolutions`, `registry_filings`, `evidence_bundles`.
- Fuente de verdad: fixtures locales + documentos del equipo legal. Cloud no se modifica; las plantillas Cloud activas seguirán teniendo prioridad cuando existan.
- Migración requerida: ninguna.
- Tipos afectados: TypeScript local en normalizador, fixtures, coverage, routing, generador documental y tres pantallas Secretaría. No se regeneran tipos Supabase.
- Contratos cross-module: `agreement_id` / Agreement 360 se mantiene como vínculo canónico hacia certificación, tramitador, evidencia y auditoría.
- Riesgo de paridad: bajo-medio. No hay schema nuevo, pero la carga definitiva de plantillas aprobadas queda pendiente de paridad Cloud/local/types.

Verificación de la tanda:

- `db:check-target`: no ejecutado; no se tocó Supabase.
- `bun test src/lib/secretaria/__tests__/legal-template-normalizer.test.ts src/lib/secretaria/__tests__/legal-template-fixtures.test.ts src/lib/secretaria/__tests__/legal-template-coverage.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 29/29.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK.

Última tanda Gestor de plantillas con fixtures navegables 2026-04-29:

- `GestorPlantillas` incorpora fixtures locales del equipo legal al listado operativo, no solo al panel de cobertura.
- Los fixtures se marcan expresamente como "Fixture local" y muestran aviso "Fixture local no persistido", para que Legal pueda probarlos sin confundirlos con plantillas Cloud aprobadas.
- Las transiciones de workflow se desactivan para fixtures locales; se pueden usar/navegar, pero no archivar ni mutar en Supabase.
- La cobertura legal sigue calculándose contra plantillas Cloud runtime y distingue correctamente Cloud activa, Cloud pendiente, fixture local y hueco real.
- Añadido e2e focalizado: gestor -> buscar "Documento registral" -> abrir fixture -> usar plantilla -> tramitador con `plantilla=legal-fixture-documento-registral-es`.

Contrato de datos de la tanda:

- Tablas usadas: lectura runtime existente de `plantillas_protegidas` mediante hook actual; no escrituras.
- Fuente de verdad: Cloud runtime para plantillas reales; fixtures locales solo como fallback UI durante freeze.
- Migración requerida: ninguna.
- Tipos afectados: UI TypeScript local de `GestorPlantillas`; test e2e documental. No se regeneran tipos Supabase.
- Contratos cross-module: `template-routing` conserva la navegación hacia tramitador/decisiones/acuerdos sin sesión; no se introduce contrato nuevo.
- Riesgo de paridad: bajo. La UI declara visualmente qué es fixture local para no falsear cobertura Cloud.

Verificación de la tanda:

- `db:check-target`: no ejecutado; no hubo operación Supabase.
- `bunx tsc --noEmit --pretty false` — OK.
- `bunx playwright test e2e/14-secretaria-documentos.spec.ts --project=chromium -g "gestor permite"` — OK, 2/2 incluyendo setup.
- `bun run build` — OK.

Última tanda Sanitización por flujo Secretaría 2026-04-29:

- Baseline ejecutado: `bun run db:check-target` OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- Creado `src/lib/secretaria/sanitized-flow-contracts.ts`, matriz pura sin Supabase que declara los ocho flujos exigidos: Acuerdo 360, Convocatorias, Reuniones, Actas, Certificaciones, Gestor documental, Plantillas PRE y Board Pack.
- Cada flujo declara tablas owner, tablas compartidas, fuente de verdad, nivel de evidencia, riesgo de paridad, hooks/paginas y bloqueos no destructivos.
- `Dashboard` de Secretaría muestra un panel "Sanitización Supabase" con contratos por flujo, estado demo/parcial, evidencia real y riesgo de paridad.
- Board Pack queda expresamente como lectura compuesta, sin ownership de GRC/AIMS y con riesgo de paridad alto hasta mapear legacy/backbone.
- Actualizado el contrato vivo `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md` con la matriz sanitizada.

Contrato de datos de la tanda:

- Tablas usadas: ninguna tabla nueva; solo inventario de tablas confirmadas ya consumidas por hooks/paginas.
- Fuente de verdad: Cloud.
- Migración requerida: no.
- Tipos afectados: TypeScript local puro y Dashboard; no tipos Supabase.
- RLS/RPC/storage afectados: no.
- Contratos cross-module: Board Pack se declara lectura compuesta; no escribe `governance_module_events` ni `governance_module_links`.
- Riesgo de paridad: bajo para la tanda; medio/alto documentado por flujo.

Verificación de la tanda:

- `bun run db:check-target` — OK.
- `bun test src/lib/secretaria/__tests__/sanitized-flow-contracts.test.ts` — OK, 4/4.
- `bunx tsc --noEmit --pretty false` — OK.
- `bunx playwright test e2e/12-secretaria-navigation.spec.ts --project=chromium -g "dashboard expone"` — OK, 2/2 incluyendo setup.
- `bun run build` — OK, con avisos habituales de Browserslist/chunks.

Tanda Ruflo orquestada — cierre seguro Fase 1 2026-04-29:

- Ruflo route ejecutado para las fases restantes bajo sanitización Supabase; enrutó a carril Tester, por lo que la tanda se centra en pruebas/contratos sin tocar schema.
- Se mantiene el límite operativo: no `db push`, no migraciones, no tipos Supabase, no RLS/RPC/storage.
- Añadido test puro `src/lib/secretaria/__tests__/template-routing.test.ts` para fijar el contrato "Usar plantilla" -> flujo destino.
- El test cubre modelos de acuerdo, convocatorias, actas por modo de adopción, informes PRE y documentos registrales.
- Extraída la captura guiada Capa 3 a `src/components/secretaria/Capa3CaptureDialog.tsx`.
- Añadida utilidad pura `src/lib/secretaria/capa3-fields.ts` para normalizar campos Cloud/modelos legacy y precargar valores directos/alias legales.
- `ProcessDocxButton` reutiliza el diálogo Capa 3 sin cambiar su contrato documental ni tocar storage/RPC.
- `ConvocatoriasStepper` acepta plantillas Cloud o fixtures locales no persistidos, permite captura Capa 3 en el asistente y guarda los valores dentro de las trazas JSON existentes de la convocatoria.
- `TramitadorStepper` permite captura Capa 3 del modelo de acuerdo seleccionado y respeta `preferredTemplateId` para documentos registrales/subsanaciones cuando viene de `?plantilla=...&tipo=...`.
- Añadido e2e `e2e/17-secretaria-template-context.spec.ts` para gestor -> usar plantilla -> flujo con contexto.

Contrato de datos de la tanda Ruflo:

- Tablas usadas: ninguna nueva; lectura existente de `plantillas_protegidas` y escritura existente de `convocatorias.rule_trace`/`convocatorias.reminders_trace` mediante `useCreateConvocatoria`.
- Fuente de verdad: Cloud para datos reales; fixtures locales solo puente no persistido.
- Migración requerida: no.
- Tipos afectados: no Supabase; solo TypeScript local.
- RLS/RPC/storage afectados: no.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: bajo; el routing se apoya en `tipo`, `materia_acuerdo` y `adoption_mode`, ya existentes en contrato confirmado.

Verificación de la tanda Ruflo:

- `bun run db:check-target` — OK.
- `bun test src/lib/secretaria/__tests__/capa3-fields.test.ts src/lib/secretaria/__tests__/template-routing.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 16/16.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run e2e e2e/17-secretaria-template-context.spec.ts --project=chromium` — OK, 2/2 incluyendo setup.
- `bun run build` — OK, con avisos habituales de Browserslist/chunks.

Tanda Ruflo orquestada — Fase 2 matriz plantilla/proceso 2026-04-29:

- Ruflo route ejecutado para implementar Fase 2 bajo sanitización Supabase; se abrieron carriles de diseño de matriz, resolución de variables, integración UI y testing.
- Creado `src/lib/secretaria/template-process-matrix.ts`, motor puro que resuelve `templateId -> proceso -> variables -> fuentes` para plantillas Cloud y fixtures locales.
- La matriz declara procesos de convocatoria, tramitador de acuerdo, acta, certificación, decisión unipersonal, acuerdo sin sesión, tramitador registral e informes PRE.
- Cada resolución devuelve fuente por variable (`capa3`, `template`, `derived`), valores iniciales Capa 3, variables resueltas y faltantes obligatorios.
- `template-routing.ts` usa la matriz para decidir el flujo owner; se elimina el routing paralelo por tipo documental.
- `ProcessDocxButton` usa la matriz para que el Capa 3 mostrado antes de generar sea coherente con la selección real de plantilla.
- `ConvocatoriasStepper` usa la matriz para compatibilidad de plantilla, captura Capa 3 y trazabilidad `selected_template` en `rule_trace`/`reminders_trace`.
- `TramitadorStepper` usa la matriz para modelos de acuerdo y para validar `preferredTemplateId` registral/subsanación.
- Añadido `src/lib/secretaria/__tests__/template-process-matrix.test.ts`.

Diseño de la matriz:

- Fuente `template`: metadatos de `plantillas_protegidas` o fixture local (`id`, `tipo`, `version`, `estado`, `jurisdiccion`, `materia_acuerdo`, `adoption_mode`, `organo_tipo`).
- Fuente `derived`: contexto del proceso ya disponible en UI/hook, sin nuevas lecturas Supabase.
- Fuente `capa3`: campos editables normalizados y validados por `Capa3CaptureDialog`.
- Fallback: si no hay entrada compatible, no se fuerza la plantilla; el flujo mantiene su comportamiento estándar y el documento no se declara evidencia final sin archive/hash/bundle/audit.

Contrato de datos de la tanda Fase 2:

- Tablas usadas: ninguna nueva. Lectura existente de `plantillas_protegidas`; escritura existente de `convocatorias.rule_trace` y `convocatorias.reminders_trace`.
- Fuente de verdad: Cloud para plantillas reales; fixtures locales siguen siendo puente no persistido.
- Migración requerida: no.
- Tipos afectados: no Supabase; solo TypeScript local.
- RLS/RPC/storage afectados: no.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: medio para PRE reales hasta validar IDs Cloud; bajo para matriz local/fixtures.

Verificación de la tanda Fase 2:

- `bun run db:check-target` — OK.
- `bun test src/lib/secretaria/__tests__/template-process-matrix.test.ts src/lib/secretaria/__tests__/template-routing.test.ts src/lib/secretaria/__tests__/capa3-fields.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 20/20.
- `bunx tsc --noEmit --pretty false` — OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5180 bun run e2e e2e/17-secretaria-template-context.spec.ts --project=chromium` — OK, 2/2. Nota: `localhost:5173` estaba ocupado por otra app, se usó Vite aislado en 5180.
- `bun run build` — OK, con avisos habituales de Browserslist/chunks.

Tanda Ruflo orquestada — Fase 3 documental PRE parity y trace evidence 2026-04-29:

- Ruflo route ejecutado bajo sanitizacion Supabase para cerrar paridad PRE, evidencia trazable y hardening de borradores Capa 3.
- Confirmados en Cloud, en lectura, los IDs PRE activos del tenant demo:
  - `INFORME_PRECEPTIVO`: `b2b3b741-d2d6-4c8a-bb00-7b519854d39e`.
  - `INFORME_DOCUMENTAL_PRE`: `d6c6fa3e-8c5c-417a-8cbb-0f5b681375d3`.
- `template-process-matrix.ts` declara `CLOUD_PRE_TEMPLATE_IDS`, valida paridad PRE (`CLOUD_ACTIVE`, `CLOUD_ACTIVE_WITH_WARNINGS`, `INPUTS_INCOMPLETE`, `FIXTURE_ONLY`, etc.) y genera `TemplateTraceEvidence`.
- La traza determinista incluye plantilla, fuente de verdad, proceso resuelto, variables, fuentes por variable, valores Capa 3 normalizados, estado de fallback fixture y postura probatoria `GENERATED_TRACE_ONLY`.
- `ConvocatoriasStepper` persiste esa traza solo dentro de los JSON existentes `convocatorias.rule_trace.context.selected_template.trace_evidence` y `convocatorias.reminders_trace.documents.selected_template.trace_evidence`.
- `capa3-fields.ts` endurece normalizacion de borradores parciales, vacios, legacy keys, claves inesperadas, `null`, arrays y objetos no seguros.
- `Capa3CaptureDialog`, `ProcessDocxButton` y `GenerarDocumentoStepper` normalizan Capa 3 antes de renderizar o generar DOCX.
- `TramitadorStepper` deja de mezclar PRE como fallback de documento registral; PRE se mantiene en su flujo owner de convocatoria/expediente.

Contrato de datos de la tanda Fase 3 documental:

- Tablas usadas: ninguna nueva. Lectura existente de `plantillas_protegidas`; escritura existente de `convocatorias.rule_trace` y `convocatorias.reminders_trace`.
- Fuente de verdad: Cloud para plantillas PRE reales; fixtures locales siguen siendo fallback no persistente y no se persisten como fuente de verdad.
- Migracion requerida: no.
- Tipos afectados: no Supabase; solo TypeScript local.
- RLS/RPC/storage/policies afectados: no.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: bajo-medio. IDs PRE Cloud confirmados; queda validar cobertura real por todas las materias cuando termine el saneamiento global de Supabase.

Verificacion de la tanda Fase 3 documental:

- `bun run db:check-target` — OK, `governance_OS (hzqwefkwsxopwrmtksbg)`.
- `bun test src/lib/secretaria/__tests__/capa3-fields.test.ts src/lib/secretaria/__tests__/template-process-matrix.test.ts src/lib/secretaria/__tests__/template-routing.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` — OK, 26/26.
- `bunx tsc --noEmit --pretty false` — OK.
- `bun run build` — OK, con avisos habituales de Browserslist/chunks.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5180 bun run e2e e2e/17-secretaria-template-context.spec.ts --project=chromium` — OK, 2/2 incluyendo setup.

Tanda Ruflo orquestada — Reuniones v2 adopcion por punto 2026-04-29:

- Ruflo route ejecutado para motor de constitucion/votacion/snapshot bajo sanitizacion Supabase; carriles de motor y UI confirmaron que el contrato seguro es `meetings.quorum_data.point_snapshots`.
- Añadido `meeting-vote-completeness.ts`, helper puro que exige voto expreso de cada votante elegible, exige motivo en conflictos y declara votos de conflictuados como ignorados del denominador.
- `meeting-adoption-snapshot.ts` sube a `schema_version = "meeting-adoption-snapshot.v2"` e incorpora `voting_context` y `vote_completeness`.
- El snapshot ahora bloquea la proclamacion con `votes_incomplete_for_point` si faltan votos o motivos de conflicto.
- Corregido `votacion-engine.ts`: cuando el voto de calidad resuelve un empate se elimina `majority_not_achieved`, dejando el acuerdo proclamable si no hay otros bloqueos.
- Corregido `majority-evaluator.ts`: `mayoria_consejeros` evalua votos favorables frente a total de miembros, no mera presencia.
- `ReunionStepper` usa la completitud de voto para bloquear el guardado de resoluciones incompletas, muestra avisos por punto y deja constancia en el acta textual.
- `ReunionStepper` deriva el voto de calidad desde `governing_bodies.quorum_rule.voto_calidad_presidente` y lo deshabilita para `COMISION_DELEGADA`.
- `useReunionSecretaria` solo amplia lectura existente de `governing_bodies.quorum_rule`; no introduce writes ni schema nuevo.

Contrato de datos de la tanda Reuniones v2:

- Tablas usadas: lectura `meetings`, `governing_bodies`, `meeting_attendees`, `pactos_parasociales`/hooks existentes; escritura existente `meetings.quorum_data`, `meeting_resolutions`, `meeting_votes`, `agreements`.
- Fuente de verdad: Cloud para registros reales; `meetings.quorum_data.point_snapshots` como puente JSON explicable hasta cierre de paridad.
- Migracion requerida: no.
- Tipos afectados: no Supabase; solo TypeScript local.
- RLS/RPC/storage/policies afectados: no.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: medio por uso de JSON puente y escrituras cliente no transaccionales.

Verificacion de la tanda Reuniones v2:

- `bun test src/lib/rules-engine/__tests__/meeting-vote-completeness.test.ts src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts src/lib/rules-engine/__tests__/votacion-engine.test.ts src/lib/secretaria/__tests__/agreement-360.test.ts` — OK, 38/38.
- `bunx tsc --noEmit --pretty false` — OK.

## Próximas fases previstas

### Fase 1 — Cierre de consumo contextual de plantillas

Objetivo: que el botón "Usar plantilla" no solo navegue bien, sino que el flujo destino aplique la plantilla.

Estado: avanzado en las tandas 2026-04-27 y 2026-04-29. La captura guiada Capa 3 ya está disponible en generación rápida DOCX, convocatorias y modelos de tramitador sin schema nuevo.

Entregables cerrados:

- `ConvocatoriasStepper` lee `?plantilla=...` y precarga tipo/documentos/capa documental.
- `TramitadorStepper` lee `?plantilla=...` y fija materia/modelo.
- `ActasLista` / `ActaDetalle` leen `?plantilla=...` para generar acta/certificación con contexto.
- Mensajes claros si la plantilla no aplica a la sociedad/jurisdicción.

Pendiente:

- e2e gestor -> usar plantilla -> generación real DOCX observable con plantilla Cloud real.
- Verificación con IDs reales de plantillas PRE en Cloud tras cierre de paridad.
- Persistencia normalizada de borradores Capa 3 si Legal exige recuperar capturas antes de emitir; requiere propuesta schema posterior, no en freeze.

Gate:

- `tsc`.
- Tests focalizados de routing de plantillas.
- Smoke navegador en gestor -> usar plantilla -> destino correcto.

### Fase 2 — Cobertura documental por proceso

Objetivo: que cada proceso crítico tenga plantilla, variables y documento final.

Prioridad documental:

1. Convocatoria de Junta SA.
2. Convocatoria de Junta SL con notificación individual.
3. Acta de sesión.
4. Acta de consignación unipersonal.
5. Certificación de acuerdos.
6. Informe PRE de convocatoria.
7. Informe de administradores cuando proceda.
8. Certificación registral / instrumento para tramitador.

Gate:

- Matriz plantilla -> proceso -> variables -> fuentes -> test.
- No hay variables obligatorias sin fuente o captura.

### Fase 3 — Reuniones v2 con motor de constitución y votación

Objetivo: cerrar el punto que más preocupa al equipo legal: que la plataforma no simplifique quórum, mayorías, capital, voto, conflictos y pactos.

Entregables:

- Lista de asistentes con rol, representación, capital económico, derechos de voto y restricciones.
- Votación por punto del orden del día.
- Conflictos con exclusión del denominador cuando aplique.
- Pactos/vetos como compliance contractual separado.
- Snapshot de constitución y resultado por acuerdo.
- Acta generada desde snapshot.

Gate:

- Tests de motor para SA, SL, SLU, consejo, admin único, mancomunados y solidarios.
- Smoke reunión -> votación -> acta.

### Fase 4 — Campañas de grupo ejecutables

Objetivo: convertir el War Room de campañas en generación real de expedientes.

Entregables:

- Parametrización de campaña.
- Selección de sociedades en alcance.
- Motor de descomposición por sociedad.
- Expedientes por sociedad con `AdoptionMode`.
- Tareas dependientes y POST.
- Dashboard por fase, bloqueo, recordatorio y vencimiento.

Gate:

- Campaña Cuentas Anuales demo crea expedientes navegables.
- No se mezclan sociedades en modo Sociedad.
- Cada expediente explica por qué usa su modo y rule pack.

### Fase 5 — Gobierno de reglas y paridad Supabase

Objetivo: que reglas, plantillas y evidencia sean mantenibles y auditables.

Entregables:

- Catálogo UI de reglas.
- Versiones activas y superseded.
- Hash y aprobación legal.
- Overrides por sociedad.
- Paridad Cloud/local/tipos.
- Probes de schema para tablas/RPC críticas.

Gate:

- `bun run db:check-target`.
- Schema registry actualizado.
- Tipos Supabase regenerados tras paridad.

### Fase 6 — QA integral y revisión legal

Objetivo: congelar un corte revisable con usuarios reales del departamento legal.

Entregables:

- Suite e2e Secretaría en modo Grupo y modo Sociedad.
- Guía de pruebas para usuarios legales.
- Matriz de hallazgos UX.
- Matriz de requisitos legales por proceso.
- Checklist Garrigues tokens/WCAG.

Gate:

- Build limpio.
- Smokes de navegador sin error boundary.
- Tests focalizados verdes o expected-fail documentado con causa.

## Riesgos abiertos

| Riesgo | Impacto | Mitigación |
|---|---:|---|
| Divergencia Cloud/local Supabase | Alto | No migrar sin `db:check-target`; crear schema registry y probes. |
| Plantillas incompletas por jurisdicción | Medio | Matriz de cobertura y estados vacíos explicables. |
| Reglas legales simplificadas | Alto | Tests por escenario legal y explicación por stepper. |
| QES no devuelve binario firmado | Medio | Archivar metadatos QES y buffer firmado solo cuando el proveedor lo entregue. |
| Steppers crean registros fuera de sociedad | Alto | Preselección por `scope/entity` y tests e2e. |
| Worktree muy amplio | Medio | Mantener scopes de escritura pequeños y documentar cada tanda. |

## Cómo continuar

Orden recomendado para la próxima tanda:

1. Crear UX/acción “crear reunión desde convocatoria” para escribir `source_links` desde el nacimiento de la reunión.
2. Completar matriz de cobertura documental y captura guiada de Capa 3.
3. Volver a Campañas para generar expedientes reales.
4. Cerrar reglas y Supabase parity.
5. Preparar guía de prueba humana y suite e2e de hito.

Comandos base de verificación:

```bash
bun run db:check-target
bunx tsc --noEmit --pretty false
bun test src/lib/secretaria/__tests__/meeting-links.test.ts
bun test src/lib/secretaria/__tests__/meeting-agenda.test.ts
bun test src/lib/secretaria/__tests__/agreement-360.test.ts src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts
bun run test src/lib/doc-gen/__tests__/process-documents.test.ts src/lib/doc-gen/__tests__/template-renderer.test.ts
bun run build
```

## Documentos relacionados

- `docs/superpowers/plans/2026-04-26-secretaria-autonomous-ruflo-execution.md`
- `docs/superpowers/plans/2026-04-26-secretaria-ui-refactor-ruflo.md`
- `docs/superpowers/plans/2026-04-26-secretaria-legal-requirements-control-matrix.md`
- `docs/superpowers/plans/2026-04-26-secretaria-db-safe-closure.md`
- `docs/superpowers/plans/2026-04-27-ruflo-supabase-architecture-mission.md`
- `docs/superpowers/plans/2026-04-27-secretaria-legal-template-docs-review.md`
- `docs/superpowers/plans/2026-04-27-secretaria-template-coverage-matrix.md`
- `docs/superpowers/plans/2026-04-27-secretaria-human-milestone-test-guide.md`
- `docs/superpowers/specs/2026-04-19-document-generation-pipeline-design.md`
- `docs/superpowers/specs/2026-04-21-certificacion-autoridad-design.md`
