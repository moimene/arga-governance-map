# Iteración 0 — Auditoría integral Secretaría Societaria (2026-06-11)

> Generado por el loop de estabilización (workflow 80 agentes: 13 auditores A1-A13 + verificación adversarial de P0/P1 con contraste BOE).
> Backlog priorizado: docs/superpowers/plans/2026-06-11-secretaria-stabilization-backlog.md
> Totales: 153 hallazgos → 149 activos (1 P0, 50 P1, 62 P2, 36 P3); 4 refutados.


## A1

El motor de materias está en buen estado de salud unitaria (541/541 tests pass en src/lib/rules-engine/__tests__, 35 archivos) y la columna vertebral runtime (rule-resolution → useRuleResolution/useRuleResolutions → convocatoria/constitución/votación → fn_save_meeting_resolutions → rule_evaluation_results) funciona de extremo a extremo, con ExplainNodes legibles en castellano y una fila WORM completa verificada en Cloud. Sin embargo, hay una brecha sistémica entre lo que el motor "declara" y lo que ejecuta: los overrides estatutarios de mayoría (votacion.mayoria) se publican vía Marco Normativo, se muestran como aplicados en secretaria_effective_rule_matrix y se incluyen en el rulesetSnapshotId, pero votacion-engine los ignora explícitamente; el único módulo que los aplicaría (effective-rule.ts) es huérfano. Además, calcularAntelacion aplica overrides numéricos sin filtrar por clave (un override de quórum puede inflar la antelación), y DL-2 en el plano motor es parcialmente letra muerta: esCotizada se acepta como input pero ningún engine cableado lo consume (bordes-no-computables y plazos-engine, que implementan las advertencias LMV/art. 517 LSC, son huérfanos), con hardcodes contradictorios (esCotizada=false en useAgreementCompliance para ARGA cotizada; esCotizada=tipoSocial==='SA' en usePreviewAcuerdo). En cobertura de materias, 14 materias del materia_catalog carecen de pack ACTIVO y existe una familia de alias divergentes UI↔pack (APROBACION_PRESUPUESTOS/O, CESION_GLOBAL/_ACTIVO, REMUNERACION_CONSEJEROS/RETRIBUCION_ADMIN, etc.) que rompe el match silenciosamente. Nota positiva: la lista known-p0 de plantillas está cerrada a cero desde 2026-05-14 (FUSION_ESCISION y RATIFICACION_ACTOS ya corregidas), mejor de lo que documenta CLAUDE.md. Aproximadamente un tercio de los ~27 módulos del motor son dead code sin consumidor runtime.

## A2

Inventario completo verificado en Cloud: 110 plantillas (59 ACTIVA, de ellas 43 MODELO_ACUERDO; 16 BORRADOR; 35 ARCHIVADA), 44 rule packs con versión activa y un binding materia→plantilla (materia_template_binding) que cubre los alias principales. La madurez del catálogo es notablemente mayor que la documentada (las dos P0 históricas FUSION_ESCISION y RATIFICACION_ACTOS están corregidas y known-p0.ts cerrado a cero; cero capa1 vacías o con cabeceras espurias), pero el cableado plantilla↔pack↔resolver tiene tres fallos sistémicos: (1) seis MODELO_ACUERDO ACTIVA —incluido el golden path APROBACION_CUENTAS/FORMULACION_CUENTAS, 116 agreements demo— tienen materia_acuerdo NULL y son invisibles para el selector del Tramitador; (2) useRulePackForMateria resuelve por materia sin órgano y con limit(1), de modo que los nombramientos por Junta reciben el pack de cooptación del Consejo; (3) las plantillas de actas formales (sin sesión, unipersonales, co-aprobación, solidario, certificación, actas de Junta/Consejo) usan familias de variables sin proveedor en el resolver y el post-render solo emite WARNING, generando documentos con fecha, lugar, firmante o NIF en blanco. En lo normativo, los payloads postAcuerdo requieren revisión legal (sin depósito de cuentas arts. 279-280 LSC, plazos/citas RRM dudosos, escritura sobre-exigida en cese). La cobertura es 100% ES (PT/BR/MX inexistentes, Sprint F conocido) y el catálogo carece de eje tipo_social, lo que deja la DL-4 (selección automática SA/SL) sin soporte de datos. El contrato variables-plantillas-v1.1.yaml está desfasado: solo 6 de 49 variables se usan en plantillas vivas.

## A3

El Gestor de Plantillas (8 tabs) consume datos reales de Supabase en todas sus pestañas — no hay mocks salvo los 16 fixtures locales del equipo legal, etiquetados pero inyectados incondicionalmente en el catálogo. El núcleo (state machine BORRADOR→REVISADA→APROBADA→ACTIVA centralizada en template-admin-service, Gate PRE con 16 reglas todas con test unitario, changelog idempotente con rollback compensatorio, functional key anti-duplicados) está bien construido y los dos hooks legacy delegan en el servicio, sin bypass. La salud de datos Cloud es buena: las 59 ACTIVA pasan los checks estructurales del gate, 14/14 cobertura core, 0 duplicados funcionales, 0 helpers prohibidos, 0 variables no catalogadas. Los problemas reales son: (1) el gate semántico marca BLOCKING falso sobre la RATIFICACION_ACTOS ACTIVA corregida porque no reconoce el campo `lista_actos_ratificados`; (2) Plantillas.tsx (catálogo SECRETARIO) expone transiciones de ciclo de vida sin RBAC ni confirmación, contradiciendo el RBAC del gestor (y RLS solo aísla por tenant, verificado); (3) no existe usuario ADMIN_TENANT logueable (el seed apunta a un user_id sin fila en auth.users), por lo que Importar/Validación/Configuración no son demostrables; (4) el changelog tiene 1 sola entrada y 109/110 plantillas huérfanas, dejando la consola de Auditoría vacía y una alerta WARNING permanente en el Dashboard.

## A4

(sin resumen)

## A5

El flujo de convocatoria es el más maduro del módulo: stepper de 8 pasos con estado en memoria que persiste todo en la emisión (INSERT en `convocatorias` con rule_trace/reminders_trace/accepted_warnings + uploads de adjuntos con SHA-512), integración real con doc-gen en Pasos 7-8 (plantillas protegidas, capa 3 validada, render Handlebars con guards anti-race muy trabajados) y ciclo convocatoria→reunión operativo y verificado en Cloud (6 meetings enlazados vía quorum_data.source_links). Sin embargo, la capa normativa tiene grietas serias: el plazo "efectivo" (V1) aplica 30 días a juntas de SL (art. 176 LSC: 15), el rule set de Cloud para junta SA declara 15 días (art. 176: un mes) y se selecciona sin filtrar por órgano, no existe ninguna regla del art. 177 LSC para la segunda convocatoria (ni gap de 24h, ni restricción a SA), y el panel del motor V2 en el Paso 2 siempre muestra "OK" porque el engine jamás puebla blocking_issues/warnings. Además, la inmutabilidad post-emisión está rota de facto: las 11 convocatorias EMITIDA de Cloud tienen immutable_at NULL porque el trigger solo actúa en UPDATE y el hook inserta directamente en EMITIDA. El claim D3 de ERDS para Convocatoria SL no existe como despacho (solo sugerencia de canal) y la pantalla de éxito promete notificaciones que nunca se envían. No se encontró ningún P0: el flujo termina, persiste y enlaza.

## A6

El flujo de reunión (ReunionStepper :id, 6 pasos) está operativo de extremo a extremo: apertura, asistentes persistidos, quórum con motor V2, agenda/debates con materialización de agenda_items, votación con snapshot legal por punto y cierre con censo WORM + fn_generar_acta. El contrato meeting_resolutions ↔ agreements se cumple en Cloud (19/19 resoluciones ADOPTED con agreement_id, y todos los agreements ADOPTED de origen reunión tienen compliance_snapshot; los 6 null detectados son de flujos UNIPERSONAL/NO_SESSION). La junta universal (art. 178) está modelada con flujo UI propio y /secretaria/reuniones/nueva sigue siendo intake read-only para handoffs. Sin embargo, hay incorrecciones normativas relevantes: el evaluador de mayorías colapsa "favor > presentes_mitad" a un denominador en cabezas (resultado proclamable inválido en juntas SA con packs Cloud reales), el secretario no consejero computa en quórum y votación del CdA, la evaluación asume siempre primera convocatoria, el voto de calidad desempata siempre hacia la adopción y está bloqueado por código para el Comité Ejecutivo pese a la config demo (DL-5), y un conflicto de interés activo excluye a la persona de todas las votaciones de la entidad. La exclusión por conflicto sí ajusta numerador Y denominador (art. 190.2 correcto en mecánica), y el RPC fn_save_meeting_resolutions está endurecido (FOR UPDATE, validación de pertenencia, entity/body derivados de la reunión).

## A7

La tramitación del acuerdo está más conectada de lo que aparenta: approval_workflow y document_url persisten de verdad en agreements, las 4 RPCs del pipeline QTSP existen en Cloud y el botón EmitirCertificacionButton ejecuta la cadena generar→firmar→emitir con capability_matrix respetada y rol real del usuario demo (rbac_user_roles tiene fila SECRETARIO activa — la deuda del userRole hardcodeado está de facto resuelta). Sin embargo, el ciclo de 8 estados es operativo solo hasta CERTIFIED y con asimetrías: ningún flujo escribe INSTRUMENTED/FILED/REGISTERED/PUBLISHED, y la certificación vía acta ni siquiera transiciona el agreement a CERTIFIED (solo lo hace la variante sin sesión). El hallazgo más grave es un dead-end del golden path: fn_generar_acta inserta signed_at NULL y no existe ninguna acción UI/RPC para aprobar/firmar el acta, por lo que toda acta creada en la app queda permanentemente bloqueada por el gate RRM 108-109 de certificación. En el tramitador, el stepper escribe estados en inglés (ELEVATED/SUBMITTED) mientras la lista filtra estados en español (EN_TRAMITE/PRESENTADA/SUBSANACION/INSCRITA), la subsanación no es operable end-to-end (el único expediente SUBSANACION del demo tiene agreement_id NULL y el detalle :id es read-only sin CTA), y la cadena acta↔certificación↔expediente↔tramitación solo navega en sentido directo — los retornos son dead-ends. Además, authority_evidence ha re-acumulado duplicados VIGENTE de PRESIDENTE/SECRETARIO (peor que lo documentado como resuelto), lo que hace el dual check RM del botón de certificación no determinista.

## A8

El pipeline de generación documental (plantilla → variables → capa 3 → Handlebars → DOCX → QES → archivado → document_url) está bien construido en sus eslabones de redacción: resolución de 4 fuentes con el fix H1a vigente, overrides de entidad con gates anti-race, render con errores controlados y persistencia de borrador con estados accionables. Sin embargo, toda la capa de confianza/verificación posterior está rota de facto: los bundles del archivador no llevan source_object_* y el enlace de descarga del expediente nunca resuelve (33/33 en Cloud), fn_verify_audit_chain devuelve chain_valid=false con 3001 entradas (escritor y verificador usan recetas asimétricas y hay 95 hashes NULL), el Trust Center muestra "Verificación OK" leyendo columnas inexistentes (siempre 0 checks) y el verificador offline compara SHA-256 contra DJB2, reportando manipulación en todo documento legítimo. El trust boundary sandbox se respeta a nivel de status (nunca SEALED desde el archivador), pero el manifest puede etiquetar un buffer sandbox sin firmar como QTSP_SIGNED_DOCX de "EAD Trust" sin marcador sandbox porque resolveSandboxSafeEvidencePersistence no está cableado en archiveDocxToStorage. El reintento de archivado tiene un dead-end determinista por colisión de path date-only con upsert:false, y el enlace "Descargar desde Storage" apunta al sentinel no navegable evidence-bundle://. No hay rastro de QTSP competidores en src/ (EAD Trust único proveedor, verificado por grep).

## A9

Los modos de adopción no presenciales están ampliamente construidos: NO_SESSION tiene tracker WORM real (no_session_respuestas con trigger worm_guard y RLS solo SELECT/INSERT, votos inmutables e idempotentes vía RPC), la materialización v2 (20260514174503) es fail-closed y recomputa desde WORM, y execution_mode se persiste en agreements para NO_SESSION/CO_APROBACION/SOLIDARIO. Sin embargo, la capa jurídica diverge de la capa operativa en puntos graves: la regla de adopción server-side decide por pluralidad de cabezas ignorando matter_class y capital (con evidencia Cloud de resoluciones 3F/0C/4 cerradas como RECHAZADO al vencer), el consentimiento al procedimiento del art. 248.2 LSC (OBJECION_PROCEDIMIENTO) está modelado en el motor pero es inalcanzable desde la UI y el servidor lo trata como simple voto en contra, y los pactos parasociales (PACTO_FUNDACION_ARGA) no pueden dispararse en ningún flujo operativo porque los vocabularios de materias son disjuntos y los flujos D/E/sin-sesión ni siquiera los evalúan. CO_APROBACION y SOLIDARIO validan la vigencia de administradores contra una lista derivada de las propias firmas tecleadas (tautología), y las decisiones unipersonales nacen FIRMADA sin firmante ni validación de unipersonalidad. El voto de calidad del Comité Ejecutivo es imposible pese a estar habilitado en Cloud, contradiciendo la estructura demo ARGA. Varias citas legales de los árboles explain son erróneas o inexistentes (arts. 625/629 LSC).

## A10

Auditoría jurídica transversal LSC/RRM de src/lib/rules-engine/ + payloads de rule_packs activos en Cloud (44 packs), contrastada artículo por artículo contra el texto consolidado del BOE (API datos abiertos, LSC BOE-A-2010-10544 y RRM BOE-A-1996-17533). La arquitectura del motor (gates, jerarquía normativa que impide rebajar mínimos legales, junta universal 178, quórums SA 193/194, conflictos 190.2 vía denominador) es sólida, pero la capa de FÓRMULAS de mayorías tiene incorrecciones confirmadas que producen tanto falsos positivos (acuerdos proclamados sin mayoría legal: art. 198 SL sin la condición de mayoría de emitidos, voto de calidad auto-aplicado, formulación de cuentas por mayoría simple) como falsos negativos (consejo evaluado sobre miembros totales en vez de concurrentes ex art. 248.1, 2/3 de emitidos plano en materias 201.2, quórum SL del 50% inventado, segunda convocatoria nunca evaluada). Los explain nodes —la justificación jurídica visible del producto— citan sistemáticamente artículos equivocados e incluso inexistentes (arts. 625/629 LSC, que el BOE devuelve como 404). En el plano RRM, fn_generar_certificacion desplegada en Cloud exige el Vº Bº solo para SA (RRM 109.1.a lo exige en todo órgano colegiado), no valida que el VB sea del presidente vigente y permite certificar actas no firmadas/aprobadas (RRM 109.4). Las plantillas P0 toleradas (FUSION_ESCISION, RATIFICACION_ACTOS) ya fueron corregidas el 2026-05-14 (known-p0.ts lista vacía); el CLAUDE.md está desactualizado en ese punto. La corrección de los payloads de packs requiere pase del Comité Legal de Plantillas; las correcciones de evaluador y citas son objetivas contra BOE.

## A11

Inventario reconciliado: existen exactamente 16 archivos *Stepper.tsx en src/pages/secretaria/ y los 16 están montados en rutas válidas de src/App.tsx — cero P0 de cableado ruta↔componente. La discrepancia ExpedienteSinSesionStepper está resuelta en código (el test src/test/secretaria/secretaria-demo-readiness-routes.test.ts afirma explícitamente que ni la ruta ni el archivo deben existir) pero CLAUDE.md sigue documentando la ruta /secretaria/acuerdos-sin-sesion/expediente: es deriva documental, no bug. La salud general es alta en los flujos golden-path endurecidos (Convocatorias, Reunión, Generar Documento, Sociedad Nueva, Acuerdo sin sesión, Designar cargo), con escritura real a Supabase vía hooks/RPC, errores accionables y tokens Garrigues sin violaciones (0 hex/Tailwind nativo en los 16). Los problemas jurídicos se concentran en los modos de adopción avanzados (Co-aprobación y Solidario evalúan el motor sobre un censo de administradores tecleado a mano, circular y con hash documental sintético, y persisten agreements en ADOPTED), en validaciones de capital (Añadir socio permite sobre-asignar >100% sin guard UI ni trigger DB, verificado en Cloud) y en representaciones (sin restricciones art. 183/184 LSC ni pertenencia al órgano). Reanudación es el punto débil transversal: StepperShell siempre arranca en paso 1 y los wizards largos (Sociedad Nueva 11 pasos) pierden el draft al refrescar. Cobertura e2e: 11/16 steppers cubiertos; faltan AnadirSocio, PersonasImport, RepresentanteAdminPJ, RepresentacionPuntual y la ruta /sociedades/:id/admin/nuevo de DesignarAdmin.

## A12

El módulo de comunicaciones (P1 2026-05-17) tiene una arquitectura de backend sólida sobre el papel: tabla communications + recipients/attachments/delivery_events WORM con hash chain, RLS por tenant verificada en pg_policies, RPCs de cola con FOR UPDATE SKIP LOCKED bloqueadas a service_role, webhooks con verificación de firma y un motor de plazos compartido. Pero en el entorno activo governance_OS el pipeline está muerto: las 4 Edge Functions del módulo (comms-dispatcher, validate-comm-plazo, webhook-resend, webhook-ead-trust) NO están desplegadas, el job pg_cron está inactive y la tabla communications tiene 0 filas — cualquier envío programado queda en PROGRAMADA/PENDIENTE para siempre. La consolidación a "una sola vía de envío" no se ha completado: conviven 3 caminos (dispatcher real, useERDSNotification D3 browser-side que siempre falla por trust boundary, y useEnviarNotificacion que marca ENVIADA sin enviar), y el único flujo emisor montado es el Board Pack — el stepper de convocatorias promete notificaciones que nunca despacha. La página /secretaria/comunicaciones es huérfana (sin entrada de sidebar, solo enlazada desde un libro auxiliar semánticamente incompatible) y la trazabilidad bidireccional existe en datos pero no se afloró en UI. Hay además una incorrección normativa replicada en 3 copias del motor de plazos (cita art. 173 LSC para el plazo SL y computa "un mes" SA como 30 días) y una RPC SECURITY DEFINER que confía el tenant_id del caller (misma clase de forja cross-tenant que el [critical] ya corregido en evidence bundles).

## A13

El golden path convocatoria→reunión→acta→certificación→tramitación está mayoritariamente bien enlazado: ConvocatoriaDetalle crea/abre la reunión, el cierre de reunión navega al acta, el acta emite certificación y ofrece "Abrir en tramitador" con la certificación precargada. Los dos puntos débiles reales son los extremos: el stepper de convocatoria termina en listas genéricas (no en la convocatoria creada, que es donde vive el CTA "Programar reunión") y el tramitador es un dead-end sin navegación terminal al expediente registral creado. En estados, STATUS_LABEL tiene huecos confirmados contra datos Cloud reales (SIGNED, PENDING, NO_APLICA con 276 filas, APPROVED) y cuatro páginas muestran entity_status "Active" crudo. Hay una incorrección normativa en el selector de canales registrales (BORME como canal de presentación, JUCERJA y PSM mal glosados, sin filtro por jurisdicción). Tokens Garrigues: 0 violaciones de hex/Tailwind nativo (solo 10 inline-style menores). Las plantillas P0 conocidas (FUSION_ESCISION, RATIFICACION_ACTOS) ya fueron corregidas — known-p0.ts está vacío desde 2026-05-14, lo que deja CLAUDE.md desactualizado.

---

# Anexos por área (inventarios y matrices)

## Anexo A1

# A1 — Material de soporte

## Inventario completo de engines (src/lib/rules-engine/)

Tests: `bun test src/lib/rules-engine/__tests__` → **541 pass / 0 fail** (35 archivos, 2026-06-11).

| Engine | Tests | Consumidores runtime | Estado |
|---|---|---|---|
| agenda-item-engine.ts | sí | compliance-gates (int); agenda-kind.ts; evaluarPuntoOrdenDia ← useAgreementCompliance, usePreviewAcuerdo, ReunionStepper | CABLEADO |
| agreement-dependency-validator.ts | sí | ninguno | **HUÉRFANO** |
| bordes-no-computables.ts | sí | ninguno (solo barrel) | **HUÉRFANO** (DL-2 muerta en motor; códigos de materia internos además no canónicos) |
| capital-voting.ts | sí | ninguno | **HUÉRFANO** |
| comms-plazo-engine.ts | sí | useCommsPlazoCheck + copia en supabase/functions/_shared (duplicación intencional edge; riesgo de drift) | CABLEADO |
| compliance-gates.ts | sí | buildCompliancePanelResult ← useAgreementCompliance; evaluateAgendaItemComplianceGate sin uso | CABLEADO (parcial) |
| constitucion-engine.ts | sí | ReunionStepper, useJurisdiccionRules, orquestador; calcularDenominadorAjustado/validarCapitalUniversal sin uso | CABLEADO (filtra overrides por clave correctamente) |
| convocatoria-engine.ts | sí | ConvocatoriasStepper, useJurisdiccionRules, orquestador | CABLEADO (bug: overrides sin filtro de clave en antelación; ignora esCotizada) |
| documentacion-engine.ts | sí | orquestador (flujos A–E) → useAgreementCompliance/usePreviewAcuerdo | CABLEADO (transitivo) |
| effective-rule.ts | sí | ninguno | **HUÉRFANO** (superseded por fn_secretaria_materialize_effective_rule_matrix server-side; único sitio que aplicaría votacion.mayoria) |
| evidence-bundle.ts | sí | generarVerificadorOffline ← GenerarDocumentoStepper; generarEvidenceBundle/empaquetarASiCE sin uso | PARCIAL |
| jerarquia-normativa.ts | sí | convocatoria/constitucion/effective-rule | CABLEADO (la variante con trazabilidad y suelo legal solo via effective-rule huérfano) |
| majority-evaluator.ts | sí | AcuerdoSinSesionStepper; votacion-engine | CABLEADO |
| meeting-adoption-snapshot.ts | sí | ReunionStepper (buildMeetingAdoptionSnapshot); usa overrides solo para veto estatutario (clave *veto*) | CABLEADO |
| meeting-vote-completeness.ts | sí | ReunionStepper; meeting-adoption-snapshot | CABLEADO |
| no-session-engine.ts | sí | transitivo vía votacion-engine (flujo C en panel compliance); el stepper sin sesión usa solo evaluarMayoria | CABLEADO (transitivo) |
| orquestador.ts | sí | evaluarAcuerdoCompleto ← useAgreementCompliance, usePreviewAcuerdo; determinarAdoptionMode/componerPerfilSesion sin uso (y con claves de override que no existen en Cloud) | CABLEADO (parcial) |
| pactos-engine.ts | sí | usePactosParasociales, useRuleManager, ExpedienteAcuerdo, CatalogoMaterias, RuleManagerPage, meeting-adoption-snapshot, orquestador | CABLEADO |
| plantillas-engine.ts | sí | calcularRulesetSnapshotId ← rule-resolution (cableado); evaluarPlantillaProtegida/GO_LIVE_CONFIG/resolverPlantillaConvocatoria (DL-4) sin uso | PARCIAL (Gate PRE real vive en template-admin/gate-pre.ts) |
| plantillas-gate-config.ts | no | ninguno | **HUÉRFANO** (121 bytes) |
| plazos-engine.ts | sí | ninguno | **HUÉRFANO** (canales cotizada CNMV/BORME/WEB, art. 517 LSC) |
| qtsp-integration.ts | sí (×2) | validarPreFirma ← useQTSPSign; verificarIntegridad ← useQTSPVerification; firmarDocumentoQES/notificarCertificado superseded por lib/qtsp/ead-trust-client | PARCIAL |
| related-party-engine.ts | sí | ninguno | **HUÉRFANO** (art. 231 LSC) |
| rule-evaluation-persistence.ts | sí | ninguno | **HUÉRFANO** (superseded por RPC fn_save_meeting_resolutions, que sí inserta en rule_evaluation_results) |
| rule-resolution.ts | sí | useRuleResolution/useRuleResolutions ← ConvocatoriasStepper, ReunionStepper; p0-controlled-thaw | CABLEADO |
| types.ts | n/a | todos | CABLEADO |
| votacion-engine.ts | sí | CoAprobacionStepper, SolidarioStepper, meeting-adoption-snapshot, orquestador | CABLEADO (acepta overrides pero no los aplica a mayoría) |

Hooks relacionados huérfanos: `useMatterRegistry` (resolución materia_template_binding) sin consumidores.

## Cruce materia ↔ rule pack (Cloud, 2026-06-11)

**Packs con versión ACTIVA (43+):** ACUERDO_CONVOCATORIA_JUNTA, APLICACION_RESULTADO, APROBACION_CUENTAS, APROBACION_PLAN_NEGOCIO, APROBACION_PRESUPUESTO, APROBACION_REGLAMENTO_CONSEJO, AUMENTO_CAPITAL, AUMENTO_CAPITAL_NO_DINERARIO, AUTORIZACION_GARANTIA (JG+CONSEJO), CESE_CONSEJERO, CESION_GLOBAL_ACTIVO, CONTRATOS_SOCIO_UNICO_SOCIEDAD, COOPTACION, CUENTAS_CONSOLIDADAS, DELEGACION_FACULTADES, DISOLUCION, DISTRIBUCION_CARGOS, DISTRIBUCION_DIVIDENDOS, DIVIDENDO_A_CUENTA, EJECUCION_AUMENTO_DELEGADO, EMISION_OBLIGACIONES, ESCISION, EXCLUSION_SOCIO, FORMULACION_CUENTAS, FUSION, INFORME_GESTION, MOD_ESTATUTOS, MODIFICACION_ESTATUTOS, NOMBRAMIENTO (pack id NOMBRAMIENTO_CONSEJERO), NOMBRAMIENTO_AUDITOR, NOMBRAMIENTO_CONSEJERO (pack id ..._COOPTACION_CONSEJO, **status NULL**), OPERACION_VINCULADA, PODER_REPRESENTACION, PRESTACIONES_ACCESORIAS, RATIFICACION_ACTOS, REDUCCION_CAPITAL, RETRIBUCION_ADMIN, SEPARACION_SOCIO, SOCIEDAD_UNIPERSONAL, SUPRESION_PREFERENTE, TRANSFORMACION, TRANSMISION_PARTICIPACIONES, TRASLADO_DOMICILIO_NACIONAL.

**materia_catalog sin pack ACTIVO (14):** ADQUISICION_PROPIA, AMPLIACION_CAPITAL*, AMPLIACION_OBJETO_SOCIAL, CAMBIO_DENOMINACION_SOCIAL, CAMBIO_DOMICILIO_SOCIAL*, DELEGACION_CAPITAL, EMISION_DEUDA_CONVERTIBLE, EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE*, LIQUIDACION, NOMBRAMIENTO_CESE (pack RETIRED + 1 agreement CERTIFIED), PACTO_PARASOCIAL, PRORROGA_SOCIEDAD, REMUNERACION_CONSEJEROS*, VENTA_ACTIVOS_ESENCIALES. (* = existe pack semánticamente equivalente con otro id: AUMENTO_CAPITAL, TRASLADO_DOMICILIO_NACIONAL, SUPRESION_PREFERENTE, RETRIBUCION_ADMIN — alias divergente, no gap legal.)

**Materias UI (AGENDA_MATERIAS) sin pack ni alias:** FINANCIACION, CONTRATACION_RELEVANTE, COMITES_INTERNOS, POLITICAS_CORPORATIVAS (10 agreements en Cloud), SEGUROS_RESPONSABILIDAD, REELECCION_CONSEJERO, PROGRAMA_RECOMPRA, AUTORIZACION_OPERACION_ESTRUCTURAL. **Materias UI con alias roto:** APROBACION_PRESUPUESTOS (vs APROBACION_PRESUPUESTO; 1 agreement ADOPTED con la grafía plural y plantillas con ambas grafías), CESION_GLOBAL (vs CESION_GLOBAL_ACTIVO), DISTRIBUCION_RESERVAS (vs DIVIDENDO_A_CUENTA), MODIFICACION_REGLAMENTO (vs APROBACION_REGLAMENTO_CONSEJO), REMUNERACION_CONSEJEROS, CAMBIO_DOMICILIO_SOCIAL.

**agreement_kind en Cloud sin pack:** POLITICAS_CORPORATIVAS, POLITICA_REMUNERACION, NOMBRAMIENTO_ADMINISTRADOR, NOMBRAMIENTO_DIRECTOR, APROBACION_PRESUPUESTOS, NOMBRAMIENTO_CESE (retirado).

## Respuestas puntuales del encargo

- **Jerarquía (Q3):** modos correctos en lo cableado: 'mayor' eleva números, 'union' acumula arrays, 'override' aplica configuración expresa. El suelo legal (isBelowLegalMinimum/isBooleanLegalDowngrade) solo existe en `resolverReglaEfectivaConTrazabilidad`, que no se ejecuta en runtime; la variante simple usada por los engines permite en modo 'override' que una fuente de menor rango sustituya el valor — latente, porque ningún engine cableado usa 'override' hoy. Los overrides SÍ llegan al motor (useRuleResolution/useAgreementCompliance los cargan de rule_param_overrides y los pasan), pero solo antelación (sin filtro de clave — bug) y quórum (con filtro) los aplican; mayoría los ignora; veto estatutario se detecta en meeting-adoption-snapshot (clave *veto*).
- **useRulePackForMateria sin pack (Q5):** devuelve null sin crash; TramitadorStepper muestra banner explícito ('Tramitación con criterio conservador de prototipo...') y aplica fallback etiquetado (prototype_fallback:true). Comportamiento correcto. Mejorable: toma versions[0] sin ordenar y matchea solo por rule_packs.materia (el pack NOMBRAMIENTO con id NOMBRAMIENTO_CONSEJERO es inalcanzable por este hook).
- **Trazabilidad (Q6):** ExplainNode legible y en castellano (regla/fuente/referencia/mensaje) en todos los gates; surfaced en ReunionStepper (quórum y validez societaria) y panel de reglas de ConvocatoriasStepper. La persistencia ya NO usa rule-evaluation-persistence.ts cliente: la hace fn_save_meeting_resolutions (migración 20260521130000) con DELETE+INSERT en rule_evaluation_results y hash sha256. Cloud: 1 fila completa (DELEGACION_FACULTADES 1.1.0, ok=true, version_id/snapshot/payload_hash poblados) — funciona pero apenas se ha ejercitado; consultable desde Dashboard.tsx:243 y ExpedienteAcuerdo.tsx:210.
- **Plantillas P0 conocidas:** ya corregidas — known-p0.ts cerró la lista a cero el 2026-05-14 (RATIFICACION_ACTOS corregida; FUSION_ESCISION con condicional requiere_experto). CLAUDE.md está desfasado en este punto.
- **Limitaciones:** no se ejecutó la UI en navegador (auditoría estática + SQL read-only). El payload concreto del pack MOD_ESTATUTOS (valor exacto de antelación SA) no se inspeccionó campo a campo; la evidencia del hallazgo 2 se apoya en el default LSC (SA=30) del engine y los valores reales de overrides en Cloud.
## Anexo A2

# A2 — Matriz de cobertura: acuerdos y plantillas (Cloud `governance_OS`, 2026-06-11)

**Leyenda:** ✅ operativo end-to-end · ⚠️ existe pero con defecto (ver nota) · ❌ no existe · — no aplica jurídicamente.
**Columnas:** Plantilla = MODELO_ACUERDO (u otro tipo) ACTIVA; Pack = rule_pack con versión `is_active`; Vars = variables resolubles end-to-end; Post = postAcuerdo (inscribable/instrumento) plausible.
**Jurisdicción:** las 110 plantillas y todos los packs son ES. PT/BR/MX: ❌ en todas las celdas (Sprint F futuro, no se repite por fila). Tipo social: sin eje propio en catálogo (ver hallazgo DL-4); se anota solo donde la materia es específica de SA o SL.

## 1. JUNTA GENERAL — adoption_mode MEETING (y UNIVERSAL por equivalencia)

| Materia | Plantilla | Pack | Vars | Post | Nota |
|---|---|---|---|---|---|
| APROBACION_CUENTAS | ⚠️ | ✅ 1.0.1 | ⚠️ | ⚠️ | `materia_acuerdo` NULL → invisible en Tramitador; payload sin depósito arts. 279-280 LSC; capa2 con fuentes pseudo (`CERTIFICACION.*`) |
| APLICACION_RESULTADO | ✅ | ✅ 1.0.1 | ✅ | ✅ | |
| DISTRIBUCION_DIVIDENDOS | ✅ | ✅ 1.0.1 | ✅ | ✅ | |
| NOMBRAMIENTO_CONSEJERO | ✅ | ⚠️ | ✅ | ⚠️ | Lookup por materia devuelve el pack de **cooptación del Consejo**; pack de Junta huérfano bajo materia `NOMBRAMIENTO` |
| CESE_CONSEJERO (separación, art. 223) | ✅ | ✅ 1.0.1 | ✅ | ⚠️ | instrumento ESCRITURA sobre-exigido (arts. 142/109 RRM); plazo cita 'art. 17 RRM' dudosa |
| MODIFICACION_ESTATUTOS | ✅ | ⚠️ | ✅ | ✅ | Pack legacy `MOD_ESTATUTOS` también activo (clave duplicada, 1 agreement demo lo usa) |
| AUMENTO_CAPITAL | ✅ | ✅ 1.0.1 | ✅ | ⚠️ | plazoInscripcion 60d citando art. 19 RRM (fija 1 mes) |
| AUMENTO_CAPITAL_NO_DINERARIO | ✅ (binding→AUMENTO_CAPITAL) | ✅ v1.0.0 | ✅ | ✅ | |
| REDUCCION_CAPITAL | ✅ | ✅ 1.0.1 | ✅ | ✅ | |
| SUPRESION_PREFERENTE | ✅ | ✅ v1.0.0 | ✅ | ✅ | |
| DELEGACION_CAPITAL (art. 297, clave en cotizada) | ❌ (BORRADOR 0.1.0) | ❌ | — | — | Gap relevante para ARGA cotizada |
| EMISION_OBLIGACIONES | ✅ | ✅ v1.0.0 | ✅ | ✅ | |
| EMISION_DEUDA_CONVERTIBLE | ❌ (BORRADOR 0.1.0) | ❌ | — | — | |
| NOMBRAMIENTO_AUDITOR | ✅ | ✅ 1.1.1 | ✅ | ✅ | |
| POLITICA_REMUNERACION (529 novodecies) | ✅ | ⚠️ | ✅ | ⚠️ | Pack existe como `RETRIBUCION_ADMIN` (clave distinta) → `useRulePackForMateria` falla, cae a fallback prototype; binding sí mapea plantilla |
| ACCION_SOCIAL_RESPONSABILIDAD (art. 239) | ⚠️ | ❌ | ✅ | — | `materia_acuerdo` NULL; sin pack |
| ACTIVOS_ESENCIALES (art. 160 f) | ✅ | ❌ | ✅ | — | Plantilla sólida (4.113 chars); pack ausente |
| AUTORIZACION_GARANTIA | ✅ | ⚠️ | ✅ | ✅ | 2 packs activos misma materia (JUNTA/CONSEJO) + `limit(1)` no determinista |
| TRANSFORMACION | ⚠️ | ✅ v1.0.0 | ✅ | ✅ | `materia_acuerdo` NULL |
| FUSION | ✅ (binding→FUSION_ESCISION v2.0.0) | ✅ v1.0.0 | ⚠️ | ✅ | Borrador FUSION solapado muerto; lookup pack por materia FUSION_ESCISION→null |
| ESCISION | ✅ (binding→FUSION_ESCISION) | ✅ v1.0.0 | ⚠️ | ✅ | Ídem |
| CESION_GLOBAL_ACTIVO | ✅ (binding→FUSION_ESCISION) | ✅ v1.0.0 | ⚠️ | ✅ | |
| DISOLUCION | ✅ | ✅ v1.0.0 | ✅ | ✅ | |
| LIQUIDACION | ❌ (BORRADOR 0.1.0) | ❌ | — | — | |
| PRORROGA_SOCIEDAD | ❌ (BORRADOR 0.1.0) | ❌ | — | — | |
| CAMBIO_DENOMINACION / CAMBIO_DOMICILIO / AMPLIACION_OBJETO | ❌ (BORRADOR 0.1.0) | ❌ | — | — | Cubribles vía MODIFICACION_ESTATUTOS; decidir si se archivan |
| ADQUISICION_PROPIA (arts. 144 ss) | ❌ (BORRADOR 0.1.0) | ❌ | — | — | |
| PACTO_PARASOCIAL | ❌ (BORRADOR 0.1.0) | ❌ | — | — | Motor de pactos vive aparte (pactos-engine) |
| TRANSMISION_PARTICIPACIONES (SL) | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| EXCLUSION_SOCIO (SL, art. 350) | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| PRESTACIONES_ACCESORIAS (SL) | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| RETRIBUCION_ADMIN (art. 217) | ✅ (binding→POLITICA_REMUNERACION) | ✅ v1.0.0 | ✅ | ✅ | Alias solo funciona vía binding, no vía hook |

## 2. CONSEJO DE ADMINISTRACIÓN — MEETING

| Materia | Plantilla | Pack | Vars | Post | Nota |
|---|---|---|---|---|---|
| ACUERDO_CONVOCATORIA_JUNTA | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| FORMULACION_CUENTAS | ⚠️ | ✅ v1.0.0 | ✅ | ✅ | `materia_acuerdo` NULL (52 agreements demo); BORRADOR v1.2.0 > ACTIVA v1.1.0; órgano plantilla ORGANO_ADMIN vs pack CONSEJO |
| CUENTAS_CONSOLIDADAS | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| INFORME_GESTION | ✅ (tipo INFORME_GESTION) | ✅ 1.0.0 | ✅ | ✅ | |
| DISTRIBUCION_CARGOS | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| DELEGACION_FACULTADES (art. 249) | ⚠️ | ✅ 1.1.0 | ✅ | ✅ | `materia_acuerdo` NULL; payload usa clave `plazoInscripcionDias` (shape distinto) |
| NOMBRAMIENTO_CONSEJERO — cooptación (art. 244, solo SA) | ✅ | ⚠️ | ✅ | ✅ | DOS packs activos (COOPTACION + NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO, este con status NULL) |
| CESE_CONSEJERO — aceptación renuncia | ✅ | ⚠️ | ✅ | ⚠️ | Plantilla bien acotada (excluye ad nutum); lookup devuelve pack de Junta (órgano-blind) |
| DIVIDENDO_A_CUENTA (art. 277) | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| EJECUCION_AUMENTO_DELEGADO | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| OPERACION_VINCULADA | ⚠️ | ⚠️ 1.0.0 | ✅ | ✅ | `materia_acuerdo` NULL; versión 1.1.0 RETIRED por encima de la activa 1.0.0 |
| POLITICAS_CORPORATIVAS | ✅ | ❌ | ✅ | — | 10 agreements demo; cae a fallback prototype |
| APROBACION_REGLAMENTO_CONSEJO | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| APROBACION_PLAN_NEGOCIO | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| APROBACION_PRESUPUESTO | ✅ | ✅ 1.0.0 | ✅ | ✅ | ⚠️ duplicado plural APROBACION_PRESUPUESTOS (BORRADOR + 1 agreement demo huérfano) |
| COMITES_INTERNOS | ✅ | ❌ | ✅ | — | |
| SEGUROS_RESPONSABILIDAD (D&O) | ✅ | ❌ | ✅ | — | |
| PODER_REPRESENTACION | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| TRASLADO_DOMICILIO_NACIONAL (art. 285.2) | ✅ | ✅ 1.0.0 | ✅ | ✅ | |
| RATIFICACION_ACTOS | ✅ v1.1.0 | ✅ 1.1.0 | ✅ | ✅ | Ex-P0, corregida (actos individualizados, art. 1261 CC) |
| CONTRATACION_RELEVANTE / FINANCIACION | ❌ (BORRADOR 0.1.0) | ❌ | — | — | |

## 3. COMISIONES DELEGADAS — MEETING

| Pieza | Estado | Nota |
|---|---|---|
| CONVOCATORIA_COMISION_DELEGADA | ✅ ACTIVA v1.0.0 | Hay BORRADOR v1.1.0 pendiente de promoción |
| ACTA_COMISION_DELEGADA (ACTA_SESION) | ✅ ACTIVA v1.0.0 | Vars `this.*` dentro de `{{#each}}` correctas |
| Packs específicos de comisión | ❌ | Aceptable: las comisiones operan bajo reglamento del Consejo; sin pack propio |

## 4. Marco documental por adoption_mode (plantillas de acta/soporte)

| Adoption mode | Plantilla marco | Estado | Vars | Pack | Nota |
|---|---|---|---|---|---|
| MEETING (Junta) | ACTA_SESION `JUNTA_GENERAL` v1.2.1 + CONVOCATORIA_JUNTA v1.2.1 | ✅ | ❌ | — | capa1 usa `meetings.junta.*` (sin namespace en resolver → blancos) |
| MEETING (Consejo) | ACTA_SESION `CONSEJO_ADMIN` v1.2.1 + CONVOCATORIA_CDA | ✅ | ⚠️ | — | `REGISTRO.*`, `REUNION.punto_1.*`, `REUNION.hora_cierre` sin proveedor |
| MEETING (SL, notificación) | CONVOCATORIA_SL_NOTIFICACION v1.2.1 | ✅ | ❌ | — | `meetings.junta_sl.*` sin proveedor |
| UNIVERSAL | (usa plantillas MEETING) | ✅ | ⚠️ | — | Sin pieza específica; aceptable (junta universal, art. 178 LSC) |
| NO_SESSION | ACTA_ACUERDO_ESCRITO `ACUERDO_SIN_SESION` v1.3.0 | ✅ | ❌ | — | Namespace `ACUERDO.*` sin proveedor |
| UNIPERSONAL_SOCIO | ACTA_CONSIGNACION `DECISION_SOCIO_UNICO` v1.2.1 + MODELO `CONTRATOS_SOCIO_UNICO_SOCIEDAD` | ✅ | ❌ | ✅ SOCIEDAD_UNIPERSONAL + CONTRATOS_SOCIO_UNICO | `SOCIO_UNICO.*`/`DECISION.*` sin proveedor |
| UNIPERSONAL_ADMIN | ACTA_CONSIGNACION `DECISION_ADMIN_UNICO` v1.2.1 | ✅ | ❌ | ❌ | Sin pack para decisión de admin único; `ADMIN.*` sin proveedor |
| CO_APROBACION | ACTA_DECISION_CONJUNTA `CO_APROBACION` v1.1.1 | ✅ | ❌ | ❌ | `COAP.*` sin proveedor; motor evalúa vía evaluarCoAprobacion (código, no pack) |
| SOLIDARIO | ACTA_ORGANO_ADMIN `ADMIN_SOLIDARIO` v1.1.1 | ✅ | ❌ | ❌ | `ACTO.*`/`ADMIN_SOLIDARIO.*` sin proveedor |
| Certificación | CERTIFICACION `CERTIFICACION_ACUERDOS` v1.3.0 | ✅ | ❌ | — | `CERTIFICACION.*` sin proveedor (el pipeline RPC fn_generar_certificacion va aparte) |
| Soporte pre-sesión | INFORME_PRECEPTIVO `CONVOCATORIA_PRE` + INFORME_DOCUMENTAL_PRE `EXPEDIENTE_PRE` v1.1.0 | ✅ | ⚠️ | — | `USUARIO.*` dotted no se nutre de capa3 plana |
| Toma de razón separación socio | MODELO `SEPARACION_SOCIO` (SOPORTE_INTERNO/NO_SESSION) | ✅ | ✅ | ✅ 1.0.0 | Diseño correcto: toma de razón, no acuerdo |

## 5. Cruces pack ↔ plantilla (huérfanos)

**Packs activos sin plantilla propia pero cubiertos por `materia_template_binding`:** AUMENTO_CAPITAL_NO_DINERARIO→AUMENTO_CAPITAL · CESION_GLOBAL_ACTIVO→FUSION_ESCISION · COOPTACION→NOMBRAMIENTO_CONSEJERO(CONSEJO) · RETRIBUCION_ADMIN→POLITICA_REMUNERACION · SOCIEDAD_UNIPERSONAL→DECISION_SOCIO_UNICO · INFORME_GESTION→GESTION_SOCIEDAD · FUSION/ESCISION→FUSION_ESCISION · MOD_ESTATUTOS→MODIFICACION_ESTATUTOS · NOMBRAMIENTO→NOMBRAMIENTO_CONSEJERO(JUNTA). *El binding solo cubre la selección de plantilla; `useRulePackForMateria` no lo usa.*

**Plantillas ACTIVA sin pack (motor cae a fallback prototype):** ACCION_SOCIAL_RESPONSABILIDAD · ACTIVOS_ESENCIALES · COMITES_INTERNOS · POLITICAS_CORPORATIVAS · SEGUROS_RESPONSABILIDAD · FUSION_ESCISION (como materia propia; los packs van por FUSION/ESCISION).

**agreement_kinds demo sin cobertura alguna:** NOMBRAMIENTO_ADMINISTRADOR · NOMBRAMIENTO_DIRECTOR · NOMBRAMIENTO_CESE (pack retirado a propósito; el agreement persiste) · APROBACION_PRESUPUESTOS (plural).

**Binding con filas duplicadas:** CONTRATOS_SOCIO_UNICO_SOCIEDAD ×2 · EXCLUSION_SOCIO ×2 · PRESTACIONES_ACCESORIAS ×2 · TRANSMISION_PARTICIPACIONES ×2 · MODIFICACION_ESTATUTOS ×3 (priority 0/0/10).

## 6. Variables: huérfanas en ambas direcciones

**Contrato v1.1 → catálogo:** usadas en alguna ACTIVA solo 6/49 (`abstenciones`, `hora_fin`, `hora_inicio`, `organo_nombre`, `votos_contra`, `votos_favor`). Las 43 restantes (empresa_*, qes_*, erds_*, numero_acta, texto_propuesta, admins_firmantes_co_aprobacion…) no aparecen en ninguna capa1 operativa.

**Catálogo → resolver (no resolubles, P1):** namespaces sin proveedor `ACUERDO.*`, `ACTO.*`, `ADMIN.*`, `ADMIN_SOLIDARIO.*`, `SOCIO_UNICO.*`, `DECISION.*`, `COAP.*`, `CERTIFICACION.*`, `REGISTRO.*`, `OV.*`, `USUARIO.*` (dotted), rutas crudas `meetings.junta.*`, `meetings.junta_sl.*`; claves inexistentes dentro de namespaces soportados: `REUNION.hora_cierre` (existe `hora_fin`), `REUNION.medio_convocatoria` (existe `medio_publicacion`), `REUNION.orden_del_dia_resumen`, `REUNION.asistentes_*_resumen`, `REUNION.punto_1.*`, `REUNION.voto_calidad_detalle`, `ENTIDAD.nif` (existe `cif`), `ENTIDAD.tipo_sociedad` (existe `tipo_social`), `ENTIDAD.tipo_sociedad_unipersonal`. `QTSP.*` renderiza en blanco pero está declarado framework-prefix (parcialmente by-design).

**Higiene capa2:** las plantillas de acta declaran pseudo-variables documentales no procesables (`'REUNION.fecha / hora_inicio / hora_cierre / lugar'`, `'QTSP.*'`, fuentes compuestas `'REUNION + MOTOR'`) — sirven como documentación pero el resolver las cuenta siempre como unresolved.

## 7. Estado P0 históricas (ítem 4 del encargo)

| Plantilla | Estado Cloud | Veredicto |
|---|---|---|
| FUSION_ESCISION (e3697ad9) | ACTIVA v2.0.0; capa1 9.099 chars; contiene condicional `requiere_experto` y régimen RDL 5/2023 | **Corregida** — no requiere legal |
| RATIFICACION_ACTOS (edd5c389) | ACTIVA v1.1.0; exige lista de actos individualizados con fundamento art. 1261 CC y arts. 234-235 LSC | **Corregida** — no requiere legal |

`known-p0.ts` = lista vacía desde 2026-05-14. **CLAUDE.md está desactualizado** al seguir declarándolas toleradas (hallazgo P3).
## Anexo A3

## Matriz de tabs — fuente de datos y escritura

| Tab | Componente | Fuente de datos | ¿Datos reales? | Escritura |
|---|---|---|---|---|
| dashboard | DashboardTab | usePlantillasProtegidas + computeCoreCoverage + countOrphanTemplates + usePlantillaChangelog (Supabase) | Sí | No |
| catalogo | CatalogoTab | usePlantillasProtegidas + **16 fixtures locales inyectados** (withLegalTeamTemplateFixtures) | Sí + fixtures etiquetados | Sí: transiciones vía useUpdateEstadoPlantilla→transitionTemplateState; edición tri-capa vía useUpdateContenidoPlantilla (solo BORRADOR, gated por canAccess('validacion')) |
| cobertura | CoberturaLegalTab | computeCoreCoverage (Cloud) + buildLegalTemplateCoverage (Cloud + fixtures) | Sí | No |
| importar | ImportarTab → TemplateImportWizard | parseImport (local) + runTemplateImportPreflight (Cloud) + createDraftFromImport (insert + changelog con rollback) | Sí | Sí (BORRADOR + changelog IMPORT) |
| metricas | MetricasTab | usePlantillasMetrics (select Cloud + computePlantillasMetrics puro) | Sí | No |
| auditoria | AuditoriaTab | plantilla_capa3_overrides_por_entidad + plantilla_changelog + countOrphanTemplates (Cloud) | Sí (pero changelog ≈ vacío: 1 fila) | No |
| validacion | ValidacionTab | loadAllActiveTemplates (Cloud) + validateTemplateForActivation (headless, read-only) | Sí | No |
| configuracion | ConfiguracionSociedadTab | useEntitySettingsCatalog + useEntitySettings + Capa3OverridesPanel (Cloud) | Sí | Sí (upsert/delete entity settings) |

## Verificaciones Cloud (governance_OS, tenant demo) — todas SELECT

- Plantillas: 59 ACTIVA / 16 BORRADOR / 35 ARCHIVADA (110 total).
- **Checks estructurales del Gate PRE sobre las 59 ACTIVA: 0 fallos** (capa1≥100 chars, semver, organo canónico, referencia legal con patrón, aprobada_por/fecha_aprobacion poblados).
- **Duplicados por clave funcional entre ACTIVA: 0.**
- **Cobertura core v1.0: 14/14** combinaciones órgano·materia cubiertas con MODELO_ACUERDO ACTIVA.
- **Helpers Handlebars fuera de allowlist en capa1 ACTIVA: 0.**
- **Variables dotted usadas en capa1 y no catalogadas en capa2 (excluyendo namespaces framework): 0.**
- **Gate PRE global produciría exactamente 1 BLOCKING hoy: SEM_RATIFICACION_IDENTIFICACION sobre edd5c389 (falso positivo, ver hallazgo P1).**
- changelog: 1 entrada total → 109/110 huérfanas.
- rbac_user_roles: ADMIN_TENANT solo para user_id 00000000-...-099 (sin fila en auth.users → no logueable). Demo user = SECRETARIO.
- RLS: plantillas_protegidas y plantilla_capa3_overrides → policy ALL por tenant (sin rol); plantilla_changelog → SELECT/INSERT por tenant (sin UPDATE/DELETE: log efectivamente append-only a nivel policy).
- Plantillas con referencia legal que dependa de la divergencia CNMV/CC entre gate y schema de importación: 0 (divergencia latente).
- BORRADOR con metadatos inválidos (dead-end TriCapaEditor): 0 (latente).
- BORRADOR/REVISADA/APROBADA que dispararían warnings (GEN_IF_COUNT>3 o fuente ENTIDAD) y caerían en el dead-end WARNINGS_NEED_ACK: 0 (latente).

## Salud del núcleo (positivo)

- `transitionTemplateState` es el único punto de mutación de estado: state machine (TRANSITION_MATRIX correcto, ARCHIVADA terminal, retrocesos REVISADA/APROBADA→BORRADOR permitidos), Gate PRE solo al activar, changelog con rollback compensatorio del estado si el log falla, y `createDraftFromImport` borra el borrador si el changelog falla (anti-huérfanos para inserts nuevos).
- Ambos hooks legacy (`useUpdateEstadoPlantilla`, vía Plantillas.tsx y CatalogoTab) delegan en el servicio — **no hay bypass del gate desde UI**, solo pérdida de detalle en los errores.
- Changelog idempotente (FNV-1a bucket 5s) con workaround documentado del UNIQUE(plantilla_id, to_version) de Cloud (token #idemp en to_version + versión lógica en diff_summary, decodificada por AuditoriaTab.logicalToVersion).
- Las 16 reglas del Gate PRE (estructurales + semánticas + INFO) tienen test unitario (verificado por grep en __tests__: 16/16 códigos cubiertos).
- El asset del wizard `public/templates/secretaria/plantilla-base-importacion.v1.json` existe (el link de descarga del paso 1 no es un 404).
- El importador normaliza aliases de órgano antes de Zod, el schema es .strict() (rechaza metadata de fila Cloud filtrada), y el batch FIRMA_LEGAL_BATCH tiene schema propio con aprobador y fecha obligatorios.
## Anexo A4

# A4 — Material de soporte

## 1. Matriz fuente de verdad: qué lee cada hook hoy

| Hook / componente | Tabla(s) | Modelo | Afecta a |
|---|---|---|---|
| `useReunionSecretaria.useBodyMembers` | `condiciones_persona` | canónico | censo, asistencia, **quórum**, votación |
| `useCapitalHoldings` (censo junta + LibroSocios + Transmisión) | `capital_holdings` (+ `share_classes`) | canónico | quórum de junta por capital |
| `useAuthorityEvidence` / `usePresidenteVigente` | `authority_evidence` | canónico (derivado) | **certificación** (certificante + Vº Bº) |
| `useAgreementCompliance` (L:872) | `authority_evidence` | canónico | motor de validez |
| `useCargos`, `usePersonasCanonical`, `usePersonasExtended`, `useBodies` (139, 238), `useLibros` (251) | `condiciones_persona`, `representaciones` | canónico | fichas, composición |
| `useCondicionesPersonaMutations` (alta/cese cargo) | RPC `fn_designar_cargo` / `fn_cesar_cargo` → `condiciones_persona` | canónico | escritura owner |
| `variable-resolver.ts` (317, 575, 600) | `condiciones_persona`, `capital_holdings`, `parte_votante_current` | canónico | generación documental |
| **`Calendario.tsx` (Secretaría, L:128)** | **`mandates`** | **legacy** | vencimientos de mandatos |
| `useDashboardData` (L:22), `useConflicts` (L:77) | `mandates` | legacy | KPIs shell / conflictos |

Sin trigger de sync mandates↔condiciones (pg_trigger: solo `trg_sync_authority_evidence` en condiciones_persona). Sincronía actual 100% por seeds; divergencia garantizada al primer alta/cese vía UI.

## 2. Reglas de oro — verificación Cloud 2026-06-11

| Regla | Resultado |
|---|---|
| ≤1 `entity_capital_profile` VIGENTE por entidad | PASS — `GROUP BY ... HAVING count>1` → 0 filas |
| `ux_condicion_vigente` con sentinel COALESCE | PASS — índice `(person_id, entity_id, COALESCE(body_id, '0000...'), tipo_condicion) WHERE estado='VIGENTE'`; además singletons `ux_condicion_singleton_body_vigente_l12c` (PRESIDENTE/SECRETARIO/CONSEJERO_COORDINADOR por body) y `ux_condicion_admin_unico_entity_vigente_l12c` |
| Autocartera pesa 0 en `parte_votante_current` | PASS (vacuo) — 0 holdings `is_treasury` en Cloud; 0 filas de proyección con peso sobre treasury; cliente filtra además en `selectVotingCapitalHoldings` (meeting-census.ts:58-68) |
| `censo_snapshot` inmutable + `audit_worm_id` | PASS — 28/28 snapshots con worm id; triggers `trg_block_censo_snapshot_update/delete` + `trg_censo_snapshot_worm` presentes |

## 3. Reconciliación CdA (body canónico `fe05ddd9-ce3e-47b0-8948-5b975c79ab59`)

Composición real (condiciones VIGENTES): 15 CONSEJERO (incluye 1 PJ: ARGA Capital Inversiones SL, sin representante) + 1 PRESIDENTE (D. Antonio Ríos Valverde, **sin** condición CONSEJERO paralela) + 1 SECRETARIO (Dña. Lucía Paredes Vega, no consejera) = 17. `mandates` espejo exacto (15+1+1 'Activo').

Contra estructura declarada (15 = 9 IND + 5 EJE + 1 DOM, presidente + 2 VP + coordinador independiente):
- 0 condiciones VICEPRESIDENTE; 0 CONSEJERO_COORDINADOR
- metadata sin `categoria` en las 17 filas → composición IND/EJE/DOM no representable
- Base de vocales propuesta: **16** (15 consejeros + presidente-consejero) o **15** si el presidente es uno de los 5 ejecutivos ya contados — decisión de seed pendiente; en ningún caso 17 (la secretaria no consejera no es vocal, art. 247.2 LSC)

## 4. authority_evidence fantasma (entidad canónica)

10 filas VIGENTES sin condición vigente de respaldo (9 PRESIDENTE): 1 PRESIDENTE + 1 SECRETARIO dummy en el CdA (persons `00000000-...-0102` / `-0101`, creadas 2026-04-21, sobrevivieron a la limpieza 2026-04-25 que solo purgó condiciones_persona) y ~8 PRESIDENTE duplicados repartidos por las 9 comisiones/comités (todas muestran n=2 PRESIDENTE VIGENTE). `usePresidenteVigente` = `.limit(1).maybeSingle()` sin ORDER BY → selección no determinista del Vº Bº.

## 5. Flujos sociedades/personas — estado e2e

| Flujo | Persistencia | Estado |
|---|---|---|
| SociedadNuevaStepper | RPC `fn_crear_sociedad_legal_y_capital` (TX1) + adapters TX2 (`condiciones_persona`, `representaciones`) + RPC `fn_promover_sociedad_operativa` | Real e2e, con manejo de fallos parciales TX2 |
| DesignarAdminStepper | RPC `fn_designar_cargo` (idempotency key, singleton close, L2 PJ→representante, trigger AE) | Real e2e, bien diseñado |
| AnadirSocioStepper | INSERT directo `capital_holdings` | Real pero sin validación de suma de capital ni RPC |
| TransmisionStepper | RPC `fn_registrar_transmision_capital` (atómica) con fallback client no transaccional | Real e2e; **sin gates LSC 106-112** |
| ReglasAplicables | `useReglasAplicables` (read-only sobre packs) | Read-only OK |
| PersonaNuevaStepper / PersonasImportStepper | `persons` (+dedup por tax_id en import) | Real e2e |
| LibroSocios | `capital_holdings` vigentes + movimientos (delta_shares) | Coherente con cap table |

## 6. Limitaciones de la auditoría

- No se ejecutó UI en vivo; el comportamiento de steppers se infiere de código + datos Cloud.
- `fn_registrar_movimiento_capital` y el refresco de `parte_votante_current` tras escrituras directas (AnadirSocio) no se trazaron a fondo; el censo de junta lee `capital_holdings` directamente, así que el impacto es menor, pero la proyección podría quedar desfasada tras altas manuales (pendiente de verificar).\n- Las categorías IND/EJE/DOM podrían residir en alguna tabla no inspeccionada (se revisó `condiciones_persona.metadata` y `mandates.role`); no se encontró candidato en el schema.
## Anexo A5

# A5 — Matriz de trazado del flujo de convocatoria

## 1. Stepper de 8 pasos (`src/pages/secretaria/ConvocatoriasStepper.tsx`, 4.211 líneas)

| Paso | Contenido | Persistencia | Validación viva | Gate de avance (`canAdvance`) |
|---|---|---|---|---|
| 1 Sociedad y órgano | entidad (sociedadesOnly), órgano, tipo (ORD/EXT/UNIVERSAL→redirige a `/secretaria/reuniones/nueva?flow=junta-universal`), clonado de convocatoria anterior | ninguna (useState) | EntityReadinessNotice (reference_only bloquea), badge preaviso desde `jurisdiction_rule_sets` (**sin filtro typology — P1**) | entidad+órgano+!readinessBlocked |
| 2 Fecha y plazo | fecha/hora 1ª, lugar (autofill domicilio social), formato, 2ª convocatoria | ninguna | `checkNoticePeriodByType` (V1) + `evaluarConvocatoria` (V2) + doble evaluación — **panel siempre OK (P1), sin regla art. 177 (P1)** | fecha + lugar si presencial |
| 3 Orden del día | items con kind v3.1 (solo DECISORIO activa motor), materia/clase/inscribible/propuesta (art. 197.1/287 anotado), advertencias LMV cotizada (DL-2: advierte, no bloquea — correcto) | ninguna | `useRuleResolutions` por materia DECISORIO; compatibilidad materia-órgano con warning | ≥1 título no vacío |
| 4 Destinatarios | JUNTA→capital_holdings (excluye autocartera y sin voto); resto→mandates ordenados por cargo | ninguna | — | libre |
| 5 Canales | filtrados por body_type y jurisdicción; recordatorios del motor (canalesExigidos) no bloqueantes | ninguna | `channelSatisfiesReminder` con clases de equivalencia | libre |
| 6 Adjuntos | ficheros en memoria; MIME allowlist + sniff por extensión, ≤25MB | upload diferido a emisión | recordatorio PRE documental (documentosObligatorios del pack) | libre |
| 7 Borrador documento | plantilla protegida (auto `selectProcessTemplate` o manual filtrado por jurisdicción/órgano/estado), Capa3Form validada, render Handlebars con ~50 aliases de variables, guards anti-race/stale muy elaborados (tokens, hash de contexto, ack explícito) | ninguna | badge BORRADOR/REVISADA 'no apta para producción'; variables sin resolver listadas | !renderPending && !capa3Missing |
| 8 Revisión y emisión | resumen, preview del texto, 3 badges de compliance (plazo/canales/documentos) | **única escritura**: INSERT `convocatorias` (estado EMITIDA) → UPDATE trace → uploads paralelos allSettled → PATCH reminders_trace con status real de uploads | emitir bloqueado por stale/renderPending/capa3 — el plazo incumplido NO bloquea (decisión `CONVOCATORIA_WARNINGS_NON_BLOCKING` registrada en trace) | — |

Volver atrás: el rail permite click en pasos anteriores y el estado se conserva (render condicional). Refresh o "Cancelar y volver" pierden todo (P2).

## 2. Motor → stepper
`evaluarConvocatoria` corre en el cuerpo del render con packs de `useRuleResolutions` (solo materias DECISORIO no-libres). Gates 1-2 (unipersonal/universal) cortocircuitan OK. Reglas: antelación (dispatch junta 30/15 vs consejo 5 vs comisión 3 + máximo entre packs + override `resolverReglaEfectiva`), canales (filtro abstractos non-junta + fallback por jurisdicción, BORME/web art. 179 para SA junta), documentos y contenido mínimo (unión de packs + 'Orden del día' fijo art. 182). **El engine no compara la fecha elegida contra la antelación ni emite nunca blocking/warnings** — eso vive en V1+dual-evaluation con effective_source=V1_LEGACY.

## 3. Ciclo convocatoria→reunión (verificado en Cloud)
- Emisión NO crea meeting. ConvocatoriaDetalle → "Programar reunión" → `useCreateMeetingFromConvocatoria`: busca meeting enlazado (`quorum_data.source_links.convocatoria_id`) o heurística body+fecha (riesgo de mis-link si dos convocatorias del mismo órgano caen el mismo día), si no INSERT `meetings` (status CONVOCADA, slug, agenda_preview) + materialización idempotente de `agenda_items` con respeto al changelog de reclasificación humana. Errores abortan con mensaje claro (bien).
- Cloud: 6 meetings con source_links.convocatoria_id; 0 body_id huérfanos; 15 convocatorias con body_id NULL (drafts de campaña) muestran '—' en lista y el botón Programar queda deshabilitado con razones legibles (`scheduleReasonLabel`).
- Vuelta: card "Reunión operativa" en el detalle con estado traducido (`statusLabel`) y "Abrir reunión".

## 4. Estados en español
`statusLabel` central usado en lista y detalle (EMITIDA→'Emitida' existe). El gap es del filtro/tonos de la lista (P2), no de la traducción. El stepper tiene un `statusLabel` local distinto para lifecycle de rule packs (DRAFT/ACTIVE…) — duplicación menor de nombre, no de función.

## 5. Cloud snapshot (tenant demo, 2026-06-11)
- convocatorias: 38 BORRADOR / 11 EMITIDA / 3 CELEBRADA; EMITIDA: 10/11 con rule_trace, 6/11 con convocatoria_text; immutable_at = 0 en todas (P1).
- fecha_2: dos EMITIDA con gap 24h exacto; una CELEBRADA seed con gap 2h (incompatible art. 177.2).
- attachments de convocatoria: 16 `evidence-bundle://` + 91 `https` (bucket ya privado).
- jurisdiction_rule_sets ES: SA/JUNTA_GENERAL=15 (incorrecto, art. 176→un mes), SA/CDA=3, SA/CONSEJO_ADMINISTRACION=3, SL y SRL JUNTA=15.

## 6. No reportado por ser deuda conocida/by-design
- Warnings de plazo no bloqueantes en la emisión: decisión documentada en rule_trace (`legal_decision: CONVOCATORIA_WARNINGS_NON_BLOCKING`) — solo se reporta la incoherencia del panel Paso 2, no la política.
- QTSP/QSeal en borrador etiquetado 'demo/operativo pendiente de emisión' — etiquetado correcto, sin SEALED falso.
- Junta universal redirigida al intake de reuniones — coherente con el contrato 2026-05 de `/secretaria/reuniones/nueva`.
## Anexo A6

## A6 — Material de verificación

### 1. Cobertura de los 6 puntos del encargo

| Punto del encargo | Resultado |
|---|---|
| 1. Stepper 6 pasos sobre :id | OK estructural (`buildSteps`, ReunionStepper.tsx:3983-4022). Representaciones NO validadas legalmente (hallazgo P2). Quórum consejo usa mayoría de miembros vía `evaluarConstitucion` (art. 247 correcto en umbral, pero censo contaminado por SECRETARIO — P1). |
| 2. Votaciones | Conflicto art. 190: excluye voto Y ajusta denominador (meeting-adoption-snapshot.ts:262-291) — mecánica correcta, pero alcance entity-wide forzado (P1). Voto de calidad: deshabilitado en comisiones delegadas ✓, pero también en Comité Ejecutivo pese a quorum_rule explícito (P1) y desempata sin mirar el voto del presidente (P1). Mayorías: ver hallazgos de fórmulas canónicas (2× P1). |
| 3. Cierre | `useSaveMeetingResolutions` → RPC `fn_save_meeting_resolutions` (SECURITY DEFINER, FOR UPDATE, asserts de pertenencia, entity/body derivados de la reunión — reconcile_drifts.sql:22-190) → `fn_crear_censo_snapshot` + `fn_generar_acta` → navega a /secretaria/actas/:id. Contrato verificado en Cloud (abajo). |
| 4. Junta universal art. 178 | MODELADA: `UniversalMeetingIntake` (?flow=junta-universal), `useCreateUniversalMeeting`, gates 100% concurrencia + aceptación unánime (constitucion-engine.ts:119-155, validarCapitalUniversal). Sin gap. |
| 5. quorum_data JSONB | No se pierde quórum/debates al reabrir: cada paso hace spread del JSONB previo y DebatesStep re-lee fresco. Riesgo residual de carrera en QuorumStep/VotacionesStep (P3). Nota: re-guardar asistencia purga meeting_votes (FK), comportamiento documentado en código. |
| 6. Contrato /reuniones/nueva | SE MANTIENE read-only para handoffs: `ReunionIntake` solo renderiza banner + links (ReunionStepper.tsx:4369-4504), `readMeetingHandoff` no escribe nada. La vía universal es alta owner-write de Secretaría (no handoff), coherente con el contrato. |

### 2. Verificación Cloud (SELECTs, governance_OS)

- **meeting_resolutions**: ADOPTED 19 (0 sin agreement_id) · REJECTED 1 (sin agreement, by design). Contrato resolución→Acuerdo 360 íntegro.
- **agreements con parent_meeting_id, status ADOPTED**: todos con compliance_snapshot (`meeting-adoption-snapshot.v2` con societary_validity.ok=true, o `agreement-compliance-snapshot.seed.v1` para seeds). Los 6 ADOPTED/CERTIFIED con snapshot NULL del tenant son TODOS de adoption_mode UNIPERSONAL_SOCIO/UNIPERSONAL_ADMIN/NO_SESSION (fuera del flujo de reunión; relevante para las áreas de acuerdos sin sesión/decisiones unipersonales): e63b416e (FORMULACION_CUENTAS), be0d8a4a, bdd49f12, …-054, …-053 (CERTIFIED), 3c217750 (CERTIFIED NO_SESSION).
- **CdA ARGA (fe05ddd9)**: condiciones_persona VIGENTE = 1 PRESIDENTE + 15 CONSEJERO + 1 SECRETARIO (17). El secretario computa en quórum/votos (P1). Nota de coherencia demo: 16 vocales vs los 15 declarados en la estructura ARGA.
- **Comité Ejecutivo (4d9e6026)**: body_type=COMITE, quorum_rule={mayoria_simple:0.5, quorum_asistencia:0.5, voto_calidad_presidente:true} → flag ignorado por código.
- **Cuerpos QA**: 8 '[E2E REAL] Consejo QA…' (filtrados por nombre) + 11 'Consejo QA arga-real-…' con slug 'qa-no-session-arga-real-…' que ESCAPAN al filtro. Junta General duplicada neutralizada con reference_only=true.
- **entities**: 0 sociedades sin tipo_social → el fallback laxo de `toTipoSocial` (no reconoce 'Sociedad Limitada' en legal_form) es hoy riesgo teórico, no incidencia.

### 3. Matriz de fórmulas de mayoría observadas en packs Cloud activos (extracto)

| Materia | CONSEJO | SA | Riesgo |
|---|---|---|---|
| APROBACION_CUENTAS | favor > presentes_mitad | favor > contra | CONSEJO → canónica 'mayoria_consejeros' (cabezas vs presentes, ver P1) |
| NOMBRAMIENTO_CONSEJERO | favor > presentes_mitad | **favor > presentes_mitad** | SA: unit mismatch capital/cabezas (P1) |
| APROBACION_PLAN_NEGOCIO | favor > presentes_mitad | **favor > presentes_mitad** | ídem |
| DELEGACION_FACULTADES | **favor > total_miembros / 2** | favor > total_miembros / 2 | art. 249.3 exige 2/3 de componentes (P1) |
| FORMULACION_CUENTAS | **'Mayoría'** → favor > contra | NA | más débil que art. 248.1 (P1) |
| MODIFICACION_ESTATUTOS / AUMENTO_CAPITAL | favor > presentes_mitad | favor >= 2/3_emitidos | SA 2/3 emitidos razonable como aproximación 201.2 |
| MOD_ESTATUTOS / EMISION_OBLIGACIONES | null | '> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a' | canónica 'lsc_201_2_reforzada' correcta por ratio de capital |
| OPERACION_VINCULADA | favor > presentes_mitad_no_vinculados | ídem | → 'favor > 1/2_capital_presente' (coherente con exclusión de conflictos) |

### 4. Limitaciones de la auditoría

- No se ejecutó la UI en navegador; el análisis de pasos es estático sobre código + datos Cloud.
- No se auditó `fn_crear_censo_snapshot` en profundidad (área evidencia/WORM) ni `useActaAgendaContract` (contrato de acta, área actas); se asumió su semántica declarada.
- La afirmación sobre 529 quáter (delegación no-ejecutivo→no-ejecutivo en cotizadas) aplica a ARGA por es_cotizada=true; no se localizó ningún gate al respecto vía grep, pero no se descarta validación en otra capa no revisada.
## Anexo A7

## Matriz de navegabilidad de la cadena (acta ↔ certificación ↔ expediente ↔ tramitación)

| Desde → Hacia | Estado | Evidencia |
|---|---|---|
| Acta → Expediente (Acuerdo 360) | OK — botón "Abrir acuerdo" por punto materializado | ActaDetalle.tsx:687-696 |
| Acta → Certificación | OK — lista en la propia página + EmitirCertificacionButton | ActaDetalle.tsx:757-890 |
| Certificación → Tramitación | OK — "Abrir en tramitador" con ?certificacion=&agreement= | ActaDetalle.tsx:862-878 |
| Expediente → Reunión origen | OK | ExpedienteAcuerdo.tsx:360-370 |
| Expediente → Acta | FALTA (solo enlaza la reunión, no el minute) | ExpedienteAcuerdo.tsx:360-399 |
| Expediente → Certificación | FALTA (sin card de certificaciones; cert minute-based además tiene agreement_id NULL) | fn_generar_certificacion inserta agreement_id NULL |
| Expediente → Tramitación (filing) | FALTA (card Instrumentación sin links; "Volver" genérico a lista) | ExpedienteAcuerdo.tsx:237,411-434 |
| Tramitación :id → Expediente/Cert/Acta | FALTA (dead-end: solo "← Volver al tramitador") | TramitadorStepper.tsx:240-360 |
| Tramitación :id → Subsanar | FALTA (read-only; sin link al stepper con ?agreement=) | TramitadorStepper.tsx:260-263 |

## Inventario de vocabulario de estados registry_filings

| Estado | Quién lo escribe | Visible en pestaña | STATUS_TONE | statusLabel |
|---|---|---|---|---|
| DRAFT | estado inicial del stepper (no persistido) | — | — | — |
| ELEVATED | TramitadorStepper:865 (registrar escritura) | solo "Todas" | NO (gris default) | "Elevada a público" |
| SUBMITTED | TramitadorStepper:963 (respuesta subsanación) | solo "Todas" | NO | "Preparada para tramitación" (colisiona con PRESENTADA) |
| INSCRIBED | nadie (solo en check de hidratación :576) | — | NO | — |
| PREPARADA | seed (2 filas) | solo "Todas" | sí | — |
| EN_TRAMITE | seed (1 fila, agreement_id NULL) | "En trámite" | sí | "En trámite" |
| PRESENTADA | seed (1 fila) | "Presentaciones" | sí | "Preparada para tramitación" |
| SUBSANACION | seed (1 fila, agreement_id NULL → irrecuperable en stepper) | "Subsanaciones" | sí | "Subsanación" |
| INSCRITA | nadie | "Inscritas" (siempre vacía) | sí | "Inscrita" |

## Verificaciones positivas (Cloud governance_OS, solo SELECT)

- RPCs existentes: fn_generar_acta (2 overloads), fn_generar_certificacion, fn_firmar_certificacion, fn_emitir_certificacion, fn_generar_certificacion_acuerdo_sin_sesion (pg_proc).
- registry_filings tiene todas las columnas que el stepper escribe (deed_reference, deed_date, notary_name, protocol_number, elevated_at, filing_type, filing_via) — el insert/update de escritura funciona; verificado además 1 filing ELEVATED real creado vía stepper (7ef71e4c, SIGER, protocolo 2026/5432-ARGA-TEST-A).
- agreements.approval_workflow y document_url existen; document_url poblado en 6 agreements (pipeline C5 + persistProcessArchiveLink operativo, que también enlaza certifications.evidence_id al archivar el DOCX de certificación — process-documents.ts:792-797).
- capability_matrix: 5 roles × 7 acciones; CERTIFICATION=true solo para SECRETARIO y ADMIN_TENANT; el botón se oculta correctamente para roles sin capability.
- RLS agreements: agreements_tenant_isolation (ALL, tenant_id = fn_current_tenant_id()) — el update de approval_workflow no está bloqueado por policy.
- gate_hash presente (has_gate=true) en todas las certificaciones del pipeline F8.1+ (la única sin gate es la seed CERT-001 de 2026-04-18, anterior al pipeline).
- Demo user 85e24c66: rbac_user_roles activo SECRETARIO + user_profiles.role_code SECRETARIO → useCurrentUserRole resuelve el rol real sin fallback.

## Limitaciones de la auditoría

- No se ejecutó la UI en navegador: el no-determinismo de usePresidenteVigente con duplicados se deduce de la ausencia de ORDER BY + datos duplicados confirmados; no se observó el bloqueo en vivo.
- No se probó el pipeline RPC end-to-end con sesión authenticated (las RPC son SECURITY DEFINER; los probes del repo solo verifican existencia).
- with_workflow=0 en Cloud es compatible tanto con "feature sin ejercitar" como con fallos silenciosos históricos del update (saveWorkflow no comprueba error); no distinguible vía SQL.
## Anexo A8

## A8 — Traza del pipeline GenerarDocumentoStepper (eslabón a eslabón)

| # | Eslabón | Implementación | Estado | Nota |
|---|---|---|---|---|
| 1 | Selección plantilla | `templateTypesForAgreementAdoptionMode` + `templateCompatibleWithAgreement` (GenerarDocumentoStepper.tsx:213-220, agreement-template-compatibility.ts) | OK | Filtra adoption_mode/jurisdicción/materia/órgano. **Sin dimensión tipo social (DL-4)** — ver hallazgo |
| 2 | Resolución variables (4 fuentes) | `resolveVariables` + `buildAgreementResolverContext` (variable-resolver.ts, fix H1a `normalizeFuente` vigente líneas 649-669) | OK | Variables no resueltas se muestran con warning accionable en Paso 1 |
| 3 | Capa 3 + overrides entidad | `usePlantillaWithOverrides` con gate `hasLoadedOverrides` (líneas 296-372) | OK | Hardening Codex rounds 5/8/9/16 visible y coherente |
| 4 | Render Handlebars | `prepareDocumentComposition` → `renderTemplate` (template-renderer.ts:206-239, instancia aislada, strict:false, catch limpio) | OK | Errores devueltos como `{ok:false,error}`, no crash |
| 5 | Borrador editable + persistencia Cloud | `saveEditableDocumentDraft` con schema-gate y estados saving/saved/dirty/blocked/error (líneas 393-447) | OK | Mensajes accionables; generar queda bloqueado si el draft no persiste |
| 6 | DOCX | `finalizeEditableDocumentDraft` → docx-generator.ts (`generateDocx`, `downloadDocx`, `printRenderedDocument`) | OK | Branding Garrigues, hash en footer |
| 7 | Firma QES EAD Trust | `useQTSPSign.signMutation` → `executeQESSignFlow`; fallback sandbox fail-closed en prod (`VITE_QTSP_ALLOW_SANDBOX`/DEV) | PARCIAL | Real vía proxy; sandbox correcto a nivel mutación pero **el stepper no propaga `sandbox` al manifest ni a la UI** |
| 8 | Archivado Storage + SHA-512 + bundle | `archiveDocxToStorage` (bucket privado matter-documents, dedupe por contentHash, bundle status OPEN) | PARCIAL | **Sin source_object_*** → retrieval roto; **path date-only + upsert:false** → dead-end en reintento parcial/regeneración mismo día |
| 9 | document_url al expediente | `agreements.update({document_url})` + invalidateQueries (líneas 666-680) | OK | Error de vinculación recuperable vía dedupe en retry |
| 10 | Recuperación documento | `AgreementArchivedDocLink` → `useAgreementSignedDocumentUrl` → Edge `sign-evidence-url` | ROTO | 0 filas matchean el filtro AGREEMENT en Cloud (33 NULL + 6 lowercase) |
| 11 | Verificador offline | `generarVerificadorOffline` (manifest hand-rolled en stepper) | ROTO | SHA-256 vs DJB2 → siempre "Error de integridad" |
| 12 | Trust Center expediente | `useQTSPVerification` → `verificarIntegridad` | VACUO | Lee columnas inexistentes → siempre "Verificación OK" con 0 checks |
| 13 | Cadena WORM | `fn_verify_audit_chain` (Cloud) + `EvidenceForenseSection` | ROTO + HUÉRFANO | chain_valid=false (3001 entradas); UI no montada en ninguna ruta |

## Verificaciones Cloud ejecutadas (read-only, governance_OS hzqwefkwsxopwrmtksbg)

1. `evidence_bundles` agrupado por source_object_type/módulo/status → 33 OPEN (agreement_id NOT NULL, source_object_id NULL), 6 SEALED secretaria 'agreement' (seed 2026-05-05), 4 SEALED GRC_PENAL/RISK, 2 SEALED GRC/THIRD_PARTY.
2. Triggers en evidence_bundles → `evidence_bundles_worm_guard` + `trg_audit_worm_evidence_bundles` (no existe trigger que backfillee source_object_*).
3. `SELECT * FROM fn_verify_audit_chain('00000000-0000-0000-0000-000000000001')` → `{total_entries: 3001, chain_valid: false, first: 2026-04-20, last: 2026-06-11}` (prosrc revisado antes de invocar: función read-only).
4. Probes de causa: 95 filas audit_log con hash_sha512 NULL; 163 grupos de created_at duplicado entre filas hasheadas; prosrc de fn_audit_worm vs fn_verify_audit_chain con recetas de orden/prev-hash asimétricas.
5. `rule_evaluation_results` → columna `explain` (no `explain_json`), 1 fila total; `evidence_bundles` sin columna `artifacts`.
6. `plantillas_protegidas` → sin columna `tipo_social`.
7. Bundles OPEN: metadata agrupada → ningún QTSP_SIGNED_DOCX/SR-SANDBOX persistido aún (el mislabel sandbox es latente, no materializado).

## Grep proveedores competidores (ask #5)

`grep -riE "docusign|signaturit|uanataca|adobe sign|hellosign|validated id|vidsigner|firmaprofesional|logalty|onespan|yousign|pandadoc" src/` → **0 resultados**. EAD Trust es el único QTSP referenciado en el código fuente del repo. (Los conectores DocuSign visibles en el entorno MCP del workspace no forman parte del repo.)

## Limitaciones

- No se ejecutó el flujo en navegador (auditoría estática + SQL read-only); los dead-ends de reintento son deterministas por código pero no reproducidos en runtime.
- No se localizó el punto exacto de la primera rotura de la cadena WORM (requeriría recomputar 3001 hashes en SQL); las causas estructurales aportadas (NULLs + orden no determinista) bastan para explicar el fallo.
- La Edge Function `sign-evidence-url` existe en `supabase/functions/` pero no se probó su despliegue/respuesta — irrelevante mientras el lookup de bundle (eslabón previo) devuelva 0 filas.
- Nota de proceso: hubo una primera llamada a StructuredOutput con summary placeholder; esta llamada la reemplaza y es la válida.
## Anexo A9

## Matriz A9 — cobertura por modo de adopción

| Modo | Stepper/UI | Motor invocado en flujo operativo | Persistencia | execution_mode | Pactos evaluados | Gaps clave |
|---|---|---|---|---|---|---|
| NO_SESSION (junta/consejo) | AcuerdoSinSesionStepper + AcuerdoSinSesionDetalle (tracker) | NO (evaluarProcesoSinSesion solo en read-model useAgreementCompliance) | RPCs fn_no_session_cast_response / fn_no_session_close_and_materialize (WORM, fail-closed v2) | Sí (RPC, mode NO_SESSION + agreement_360) | NO | 248.2 inaccesible; adopción por pluralidad de cabezas; cierre por vencimiento = RECHAZADO incondicional |
| CO_APROBACION (mancomunados k de n) | CoAprobacionStepper (5 pasos) | evaluarCoAprobacion directo (no orquestador) | INSERT cliente en agreements, status ADOPTED si motor ok | Sí (tipo CO_APROBACION + config + firmas) | NO | adminVigentes circular; k=1 permitido; sin regla SA n≤2 (art. 210.2) ni SL k≥2 (art. 233.2.c) |
| SOLIDARIO | SolidarioStepper (4 pasos) | evaluarSolidario directo | INSERT cliente en agreements | Sí (tipo SOLIDARIO + config) | NO | vigencia circular ([adminId]); admin de texto libre |
| UNIPERSONAL_SOCIO / ADMIN | DecisionUnipersonalStepper (3 pasos) | PreviewGatePanel (gate de materia; tipoSocial hardcodeado 'SL') | unipersonal_decisions + agreements ADOPTED | No (no aplica config) | NO | FIRMADA sin firmante; sin check de unipersonalidad; checklist OCSP/SHA-512 ficticio |
| MEETING/UNIVERSAL (referencia) | ReunionStepper | meeting-adoption-snapshot (evaluarVotacion + pactos + vetoActivo) | RPC fn_save_meeting_resolutions etc. | n/a | SÍ (pero materias nunca solapan con las cláusulas Cloud) | voto de calidad Comité Ejecutivo imposible |

## Inmutabilidad de votos (pregunta 1) — VERIFICADO OK
- `no_session_respuestas`: trigger `worm_no_session_respuestas` (worm_guard) + RLS solo SELECT/INSERT + UNIQUE (expediente_id, person_id) con ON CONFLICT DO NOTHING en la RPC → un voto por persona, inmutable, replays idempotentes.
- Punto débil: la cabecera `no_session_resolutions` (contadores denormalizados y status) sí es mutable por cualquier authenticated del tenant (policy ALL). La materialización es fail-closed, pero el display es manipulable.

## Evaluadores no-session-engine (pregunta 2) — lectura completa
- Gate 0 habilitación: exige `habilitado_por_reglamento` para CONSEJO como BLOCKING. Para SA el art. 248.2 admite el voto escrito sin previsión reglamentaria si nadie se opone — el gate es más estricto que la ley (deuda menor, no reportada como finding separado al ser conservadora).
- Gate 4: la condición `UNANIMIDAD_CONSEJEROS` mapea a `evaluarCirculacionConsejo` (mayoría de consentimientos entre respondientes + quórum 50% solo WARNING), no a unanimidad — el nombre miente; la unanimidad de consejo real solo la garantiza el servidor cuando requires_unanimity=true.
- `evaluarUnanimidadCapitalSL` exige consentimiento del 100% del capital con tolerancia 0,01 — correcto para el caso unanimidad.

## Datos Cloud relevantes
- Pactos vigentes (3): VETO {FUSION, ESCISION, DISOLUCION, VENTA_ACTIVOS_SUSTANCIALES, TRANSFORMACION} titular Fundación ARGA; MAYORIA_REFORZADA_PACTADA {OPERACION_VINCULADA} 0.75; CONSENTIMIENTO_INVERSOR {AMPLIACION_CAPITAL, EMISION_CONVERTIBLES, EXCLUSION_PREFERENTE}.
- Comité Ejecutivo: body_type COMITE, quorum_rule.voto_calidad_presidente=true (ignorado por código).
- Resoluciones sin sesión: 3 filas con 3F/0C/0A de 4 cerradas RECHAZADO 2026-06-02 08:55:11 (cierre masivo por vencimiento pese a mayoría a favor).
- cron.job: solo comms-dispatch-tick; sin job para fn_cerrar_votaciones_vencidas.

## Deuda conocida no re-reportada
- userRole hardcodeado en EmitirCertificacionButton: no afecta a A9 directamente; la conexión con useUserRole es viable (el hook existe y la RPC v2 de cast ya asierta capability VOTE_EMISSION server-side, patrón replicable).
- Actas legacy NO_SNAPSHOT_HASH: sin novedades peores en este área.
## Anexo A10

# A10 — Material de soporte

## 1. Metodología
- Lectura completa de: convocatoria-engine, constitucion-engine, majority-evaluator, votacion-engine, no-session-engine, documentacion-engine, orquestador, bordes-no-computables, jerarquia-normativa, meeting-adoption-snapshot, types; callers vivos (ReunionStepper pasos de quórum/votación) y RPC de certificación (migración F8.1 + definición viva en Cloud vía pg_get_functiondef).
- Contraste literal contra BOE (API datos abiertos `legislacion-consolidada`, LSC BOE-A-2010-10544, RRM BOE-A-1996-17533): arts. 15, 16, 107, 173, 174, 176, 178, 179, 182, 187, 188, 190, 193, 194, 196, 197, 198, 199, 200, 201, 202, 203, 208, 210, 233, 244, 245, 246, 247, 248, 249, 277, 293, 305, 352 LSC; 109 y 111 RRM. Probes negativos: a625/a629 → 404.
- Inventario completo de los 44 rule_pack_versions ACTIVE en Cloud (mayoría/quórum/antelación/abstenciones), guardado en sesión.

## 2. Tabla de citas erróneas confirmadas (fix de string, sin lógica)

| Archivo:línea | Cita actual | Contenido real del artículo citado | Cita correcta |
|---|---|---|---|
| convocatoria-engine.ts:222,239 | art. 179 LSC (canales SA) | Derecho de asistencia | art. 173 LSC |
| convocatoria-engine.ts:268 | art. 180-181 LSC (documentos) | Deber de asistencia admins / otras personas | arts. 196/197 + 272/287 según materia |
| convocatoria-engine.ts:283,460 | art. 182 LSC (contenido mínimo / orden del día) | Asistencia telemática | art. 174 LSC |
| convocatoria-engine.ts:303 | art. 180 LSC (ventana disponibilidad) | Deber asistencia admins | art. 272.2 (cuentas) / 287 (estatutos) |
| constitucion-engine.ts:199 | art. 187 LSC (conflictos) | Inaplicabilidad restricciones de representación | art. 190 LSC |
| constitucion-engine.ts:243 | art. 188 LSC (default quórum) | Derecho de voto | art. 193 LSC |
| constitucion-engine.ts:253 | art. 247.1 para CONSEJO en SA | 247.1 es SL | art. 247.2 LSC (SA) |
| constitucion-engine.ts:289 | art. 201 LSC (SL quórum) | Mayorías SA | «sin quórum legal SL (arts. 198-199)» |
| votacion-engine.ts:292 | art. 187 LSC (Gate 1 elegibilidad) | Representación | art. 190.2 LSC |
| documentacion-engine.ts:101 | art. 188 LSC (completitud docs) | Derecho de voto | arts. 196/197 LSC |
| documentacion-engine.ts:203 | art. 208 LSC (transcripción libro) | Sentencia estimatoria impugnación | art. 202 LSC + art. 26 CCom |
| orquestador.ts:295,310 | art. 201-202 LSC (flujo unipersonal) | Mayorías SA / acta | arts. 15-17 y 210 LSC |
| orquestador.ts:383,397 | art. 197 LSC (flujo sin sesión) | Derecho información SA | art. 248.2 LSC / art. 100 RRM / estatutos |
| bordes-no-computables.ts:143 | art. 305 LSC (consentimiento clase) | Plazo derecho preferencia | art. 293 LSC |
| bordes-no-computables.ts:255 | art. 224 LSC (publicación BORME SA) | Cese de administradores SA | art. 173 LSC |
| bordes-no-computables.ts:283 | art. 213 LSC (notificación SL) | Prohibiciones para ser administrador | art. 173.2 LSC |
| bordes-no-computables.ts:65 | art. 228 LMV (hecho relevante) | Norma derogada (Ley 6/2023) | OIR Ley 6/2023 / art. 17 MAR |
| no-session-engine.ts:277,287,485,497,507,606,629 | arts. 625/629 LSC | NO EXISTEN (LSC acaba en 541) | 248.2 LSC, 100 RRM, 15 LSC, estatutos |
| payloads packs (varios) | art. 190 LSC como fuente de quórum SA 25% | Conflicto de intereses | art. 193 LSC |
| payloads packs (varios) | arts. 196/197 LSC como fuente de quórum SL 50% | Derecho de información | eliminar quórum SL |
| payload MODIFICACION_ESTATUTOS | art. 194.1 como fuente de mayoría | 194 es quórum | art. 201.2 LSC |
| payload DELEGACION_FACULTADES | art. 247.2 como fuente de mayoría | 247 es constitución | art. 249.3 LSC |

## 3. Inventario de fórmulas problemáticas en packs ACTIVE (Cloud, 44 filas)

- **Familia '2/3 emitidos plano' (SA reforzada, debería ser 201.2 con dobleCondicional):** AUMENTO_CAPITAL, MODIFICACION_ESTATUTOS, REDUCCION_CAPITAL ('favor >= 2/3_emitidos'); FUSION, ESCISION, TRANSFORMACION, DISOLUCION, CESION_GLOBAL_ACTIVO, SUPRESION_PREFERENTE ('>= 2/3 emitidos SIEMPRE'). Correctos en estructura: MOD_ESTATUTOS, AUMENTO_CAPITAL_NO_DINERARIO, EMISION_OBLIGACIONES, EXCLUSION_SOCIO (formula 201.2), PRESTACIONES_ACCESORIAS ('reforzada art. 201.2 LSC').
- **Familia 'consejo sobre total_miembros' ('favor > total_miembros / 2', vs 248.1 concurrentes):** ACUERDO_CONVOCATORIA_JUNTA, APROBACION_PRESUPUESTO, APROBACION_REGLAMENTO_CONSEJO, AUTORIZACION_GARANTIA(CONSEJO), COOPTACION, CUENTAS_CONSOLIDADAS, DELEGACION_FACULTADES, DISTRIBUCION_CARGOS, DIVIDENDO_A_CUENTA, EJECUCION_AUMENTO_DELEGADO, INFORME_GESTION, PODER_REPRESENTACION, RATIFICACION_ACTOS, TRASLADO_DOMICILIO_NACIONAL. (DELEGACION_FACULTADES además debería ser 2/3 de componentes ex 249.3 — única donde el total sí es el denominador correcto pero con umbral equivocado.)
- **Familia 'presentes_mitad remapeada a total' (cita 248.1 correcta, evaluador la rompe):** APROBACION_CUENTAS(CONSEJO), APROBACION_PLAN_NEGOCIO, NOMBRAMIENTO_CONSEJERO, OPERACION_VINCULADA ('presentes_mitad_no_vinculados' → remapeada a 1/2_capital_presente), MODIFICACION_ESTATUTOS(CONSEJO), NOMBRAMIENTO(CONSEJO).
- **SL sin suelo/mayoría 198:** ver hallazgos 1 y 8.
- **Quórum SL 50 inventado:** APLICACION_RESULTADO, RETRIBUCION_ADMIN, MOD_ESTATUTOS, FUSION, ESCISION, TRANSFORMACION, DISOLUCION, CESION_GLOBAL_ACTIVO, SUPRESION_PREFERENTE, EMISION_OBLIGACIONES, AUMENTO_CAPITAL_NO_DINERARIO.
- **Escalas mixtas** (0.25 vs 25): manejadas por normalizeQuorumFraction — OK, sin hallazgo.

## 4. Verificaciones que salieron LIMPIAS (no reportar como problema)
- Quórums SA 193/194 en constitucion-engine: 25/0 y 50/25 correctos; junta universal 178 exige 100% + aceptación unánime ✓; censo vacío bloquea ✓.
- Jerarquía normativa: el comparador 'mayor' impide que un override de fuente inferior rebaje el mínimo legal ✓ (art. 200: solo elevar).
- Conflictos de interés en el flujo vivo: meeting-adoption-snapshot construye solo EXCLUIR_VOTO con deducción del denominador ✓ conforme a 190.2. El tipo EXCLUIR_QUORUM existe en types.ts pero no se usa en ningún caller vivo; carece de base en 190 (los conflictuados sí computan para quórum) — vigilar que nadie lo active sin revisión legal.
- Gate de competencia órgano-materia en votacion-engine ✓; DL-2 cotizadas solo WARNING ✓ (bordes 1 no bloquea y continúa evaluando 2-7 ✓).
- OBJECION_PROCEDIMIENTO bloquea la circulación del consejo ✓ (248.2).
- Pactos parasociales: incumplimientos no voltean la validez societaria (plano contractual) ✓ — coherente con art. 29 LSC.
- abstenciones 'no_cuentan' y exclusión de votos en blanco ✓ coherente con 198 y 201.1.
- evaluarSolidario/evaluarCoAprobacion: cita 233.1 correcta para representación de solidarios; ventana de consenso y cofirmas razonables (régimen estatutario, no legal).
- fn_generar_certificacion SÍ exige Vº Bº para SA salvo ADMIN_UNICO y autoridad vigente del certificante (parcialmente alineado con RRM 109.1.b/109.2; los gaps están en el hallazgo 9).

## 5. Notas menores no elevadas a hallazgo
- Art. 202.2 (aprobación del acta por la junta o presidente+2 interventores en 15 días) y art. 203 (acta notarial, obligatoria a petición del 1% SA / 5% SL, sin trámite de aprobación) no están modelados en TipoActa ni en el cierre de reunión; hoy queda absorbido por la firma presidente/secretario de minutes. Si se aborda, es trabajo de producto, no fix puntual.
- Art. 173 para SL sin web: el motor solo fuerza BORME+diario en SA; para SL el default legal es el mismo (salvo sustitución estatutaria ex 173.2). Los packs cubren parcialmente vía canales; revisar al corregir el hallazgo de citas.
- 'DIARIO_OFICIAL' como etiqueta de canal es impreciso: art. 173 habla de «uno de los diarios de mayor circulación en la provincia», no de un diario oficial.
- Art. 194.1 tras RDL 5/2023 ya no incluye el traslado de domicilio al extranjero (movido a la Ley de Modificaciones Estructurales); ningún pack lo referencia mal hoy, pero TRANSFORMACION/FUSION/ESCISION deberían citar también el RDL 5/2023 cuando se retoquen.
- BORDE_LIQUIDEZ cita art. 273 para 'suficiencia de liquidez': el test de liquidez es del art. 277 (dividendos a cuenta); para dividendo ordinario el límite es patrimonial (273.2). Afinar al tocar bordes.
- Pack NOMBRAMIENTO_CONSEJERO con órgano CONSEJO: el nombramiento de consejeros es competencia de la junta (art. 214) salvo cooptación (244, que tiene pack propio). Verificar si se usa para designación de cargos internos; si no, es una asignación de competencia dudosa.
- Limitación: no se auditaron en profundidad plazos-engine, comms-plazo-engine, capital-voting, pactos-engine ni los libros (104-105) por presupuesto de sesión; los artículos núcleo del encargo quedaron cubiertos.
## Anexo A11

# A11 — Matriz de salud de steppers (16/16 ruteados, 0 P0 de inventario)

## Inventario reconciliado

| # | Archivo | Ruta(s) App.tsx | Estado |
|---|---|---|---|
| 1 | ConvocatoriasStepper | /secretaria/convocatorias/nueva | ✅ |
| 2 | ReunionStepper | /secretaria/reuniones/nueva (intake) + /:id (stepper 6 pasos) | ✅ |
| 3 | GenerarDocumentoStepper | /secretaria/acuerdos/:id/generar | ✅ |
| 4 | TramitadorStepper | /secretaria/tramitador/nuevo + /:id (detalle read-only) | ✅ |
| 5 | AcuerdoSinSesionStepper | /secretaria/acuerdos-sin-sesion/nuevo | ✅ |
| 6 | CoAprobacionStepper | /secretaria/acuerdos-sin-sesion/co-aprobacion | ✅ |
| 7 | SolidarioStepper | /secretaria/acuerdos-sin-sesion/solidario | ✅ |
| 8 | DecisionUnipersonalStepper | /secretaria/decisiones-unipersonales/nueva | ✅ |
| 9 | SociedadNuevaStepper | /secretaria/sociedades/nueva | ✅ |
| 10 | AnadirSocioStepper | /secretaria/sociedades/:id/socio/nuevo | ✅ |
| 11 | TransmisionStepper | /secretaria/sociedades/:id/transmision | ✅ |
| 12 | DesignarAdminStepper | /secretaria/sociedades/:id/admin/nuevo + /secretaria/cargos/nuevo | ✅ |
| 13 | PersonaNuevaStepper | /secretaria/personas/nueva | ✅ |
| 14 | PersonasImportStepper | /secretaria/personas/importar | ✅ |
| 15 | RepresentanteAdminPJStepper | /secretaria/personas/:id/representante/nuevo | ✅ |
| 16 | RepresentacionPuntualStepper | /secretaria/representaciones/nueva | ✅ |

**ExpedienteSinSesionStepper**: no existe ni como archivo ni como ruta — eliminación deliberada blindada por test (`src/test/secretaria/secretaria-demo-readiness-routes.test.ts:11-12`). CLAUDE.md sigue documentándolo (deriva documental, hallazgo P3). CLAUDE.md tampoco documenta las rutas 12b/14/15/16.

## Matriz checklist (a Cableado · b Reanudación · c Salida · d Motor · e Errores · f UX · g e2e · h Duplicación)

| Stepper | a | b | c | d | e | f | g | h | Nota clave |
|---|---|---|---|---|---|---|---|---|---|
| Convocatorias | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ | Motor en vivo (evaluarConvocatoria + doble evaluación); adjuntos Promise.allSettled con patch de trace; éxito navega a lista, no al detalle creado; draft 8 pasos se pierde al refrescar |
| Reunion (:id) | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Datos restaurados por paso pero StepperShell siempre abre en paso 1 y sin canAdvance (salto libre); CierreStep con guards fuertes (acta gateada por contrato agenda + censo WORM) |
| GenerarDocumento | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | Borrador Cloud recuperable; document_url + invalidate; estados de error por fase (render/firma/archivo); evidencia etiquetada DEMO_OPERATIVA; e2e solo indirecto (14/18/55) |
| Tramitador | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | Upsert registry_filings + vínculo certificación con degradación avisada; sin CTA al expediente creado; aria:0; rule pack con fallback prototipo declarado |
| AcuerdoSinSesion | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | Censo real (useBodyMandates dedupe) + votos RPC WORM; reanudación delegada a Detalle (vota/cierra VOTING_OPEN); doble 'Iniciar votación' posible vía rail (P2) |
| CoAprobacion | ⚠️ | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | Motor circular con censo manual + hash sintético persistido como ADOPTED (P1); cita art. 160 LSC errónea (P1); savedId previene doble insert |
| Solidario | ⚠️ | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | Mismo patrón circular: adminId texto libre = único 'vigente' (P1) |
| DecisionUnipersonal | ✅ | ❌ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | Gate con tipoSocial 'SL' fijo + sin check de unipersonalidad + checklist OCSP/SHA-512 fake pre-firma (P1/P2); aria:0 |
| SociedadNueva | ✅ | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | TX1 RPC + TX2 adapters + fn_promover con degradación avisada y 10 invalidaciones; draft 11 pasos solo-local (P2); píldoras saltan validación; aria:0 |
| AnadirSocio | ⚠️ | n/a | ✅ | ❌ | ✅ | ✅ | ❌ | ⚠️ | Insert directo sin guard de sobre-asignación ni trigger DB (P1); sin invalidate (mitigado por staleTime 0); sin e2e |
| Transmision | ✅ | n/a | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | RPC transaccional verificada en Cloud; fallback cliente no transaccional muerto (P3); valida títulos disponibles |
| DesignarAdmin | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | fn_designar_cargo con guards 212 bis endurecidos (iteraciones Codex); ruta /sociedades/:id/admin/nuevo sin spec propia |
| PersonaNueva | ✅ | ❌ | ✅ | n/a | ✅ | ✅ | ✅ | ⚠️ | Dedupe tax_id debounced con AbortController; validación por paso con issues; navega al detalle creado |
| PersonasImport | ✅ | ⚠️ | ✅ | n/a | ✅ | ⚠️ | ❌ | ✅ | Idempotencia por row_key; aplicación parcial visible y re-ejecutable; sin e2e |
| RepresentanteAdminPJ | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | Cierra rep. previa + crea nueva en transacción de hook; filtro requiresRepresentative; sin e2e |
| RepresentacionPuntual | ✅ | n/a | ✅ | ❌ | ✅ | ⚠️ | ❌ | ⚠️ | Sin restricciones art. 183/184 LSC ni pertenencia al órgano (P1); sin e2e |

**Leyenda f (UX):** 0 violaciones de tokens Garrigues en los 16 archivos (sin hex ni Tailwind nativo de color, verificado por grep); estados en español vía statusLabel donde aplica; ⚠️ = aria escaso o nulo (Tramitador 0, DecisionUnipersonal 0, SociedadNueva 0).

**Leyenda h:** tres familias de shell (StepperShell compartido / rail lateral copiado ×3 / píldoras copiadas ×5) + Input/Field/Checkbox duplicados ×3 + PersonSelector duplicado ×2 — detalle en hallazgo P3.

## Verificaciones Cloud realizadas (solo SELECT, proyecto hzqwefkwsxopwrmtksbg)
- pg_proc: existen fn_registrar_transmision_capital, fn_crear_sociedad_legal_y_capital, fn_promover_sociedad_operativa, fn_no_session_cast_response, fn_no_session_close_and_materialize_agreement, fn_generar_acta (×2 firmas), fn_designar_cargo — todas las RPC que consumen los steppers están desplegadas.
- pg_trigger sobre capital_holdings: 0 triggers no internos → confirma que la sobre-asignación de AnadirSocio no tiene guard server-side.
## Anexo A12

## A12 — Material de soporte

### Matriz de vías de envío (item 2 del encargo: "una sola vía")

| # | Vía | Escribe en | Llama proveedor | Estados | Plazo gate | Idempotencia | Estado real |
|---|-----|-----------|-----------------|---------|-----------|--------------|-------------|
| 1 | `fn_create_communication_atomic` → cola `communication_recipients` → Edge Fn `comms-dispatcher` | `communications`, `communication_recipients`, `communication_delivery_events` (WORM hash-chain) | Resend / EAD Trust (server-side, secrets en env de la función) | `EstadoComunicacion` + `EstadoEntrega` (modelo canónico, recompute por trigger) | Sí (useCommsPlazoCheck cliente + trigger `tg_communications_validate_plazo` server) | Sí (Idempotency-Key Resend; ERDS degenerada — ver hallazgo P3) | **No operativa en Cloud**: Edge Fn sin desplegar, pg_cron inactive, 0 filas |
| 2 | `useERDSNotification` (D3) | `no_session_notificaciones` (solo si se llamara `updateNotificationStatus`; hoy nadie lo hace) | EAD Trust **desde el browser** | `erds_status` PENDING/PROCESSING/COMPLETED/ERROR (modelo paralelo) | No | No | **Siempre falla** (`QTSP_SERVER_PROXY_REQUIRED`, clientSecret='' hardcodeado); refs solo en useState |
| 3 | `useEnviarNotificacion` (useNoSessionExpediente.ts:377) | `no_session_notificaciones` con `estado='ENVIADA'` + expediente→`NOTIFICADO` | **Ninguno** (marca enviado sin enviar) | propio | No | No | Export sin callers UI (dead code peligroso) |

Puntos de inserción en `communications` (trace exhaustivo): solo `fn_create_communication_atomic` (RPC), invocada únicamente desde `PasoEnvioMiembros.tsx:146`. Updates: `useCancelCommunication`/`useProgramCommunication` (estado), trigger `tg_communications_recompute_estado` (derivado de recipients), Edge Fn vía RPCs service_role. Llamadas a adapter: solo `comms-dispatcher/index.ts` (server) y `useERDSNotification` (browser, vía 2).

### Matriz de integración con flujos emisores (item 3)

| Flujo emisor | Esperado | Real |
|---|---|---|
| Convocatoria (ConvocatoriasStepper) | PasoEnvioMiembros montado, tipo CONVOCATORIA | **No montado**; canales Paso 5 = metadata inerte; copy promete envíos (hallazgo P1) |
| Board Pack | Distribución pack | **Sí** — único emisor montado: `DistribuirPackButton` (BoardPack.tsx:561), tipo PUESTA_DISPOSICION, modo LINK_FIRMADO (pero el dispatcher descarta LINK_FIRMADO — ver P3 duplicación) |
| Acuerdos sin sesión — solicitud de voto | CIRCULAR_SIN_SESION vía dispatcher | No existe; el panel ERDS de AcuerdoSinSesionDetalle usa la vía 2 (siempre falla) |
| Acuerdos sin sesión — recordatorios vencimiento | RECORDATORIO | No implementado (tipo existe solo en types.ts) |
| ERDS SL (D3 legacy) | Migrado a dispatcher | No migrado (consolidación diferida a P2 por review M1, documentado en 20260517141038:1-6) |
| Recordatorios de plazos ↔ Calendario | comms-plazo-engine cableado a Calendario | **No**: Calendario.tsx sin referencias a comms; el motor solo se usa en PasoEnvioMiembros (cliente) y validate-comm-plazo (sin desplegar). ALERTA_VENCIMIENTO sin productor |

### Verificación Cloud (governance_OS, solo SELECT)

- `cron.job`: `comms-dispatch-tick` jobid=1, `* * * * *`, **active=false**.
- `communications`: **0 filas** (GROUP BY estado vacío).
- `list_edge_functions`: solo `openai-capa3-document-copilot` y `sign-evidence-url` — faltan `comms-dispatcher`, `validate-comm-plazo`, `webhook-resend`, `webhook-ead-trust`.
- `pg_policies`: 13 policies presentes en las 4 tablas comms (staff select/insert/update + service_all), coherentes con la migración 20260517141522; tenant scoping vía `fn_current_tenant_id()` correcto.
- `pg_get_functiondef(fn_create_communication_atomic)`: versión desplegada = migración local, **sin aserción de tenant del caller**.

### Trust boundary (item 6) — sin hallazgo adicional

- Browser fail-closed correcto: `ead-trust-client.ts` lanza `QTSP_SERVER_PROXY_REQUIRED` (el secret nunca vive en el cliente) — es lo que rompe el botón ERDS, pero la dirección del diseño es la correcta.
- Webhooks con verificación de firma: Resend (svix HMAC, multi-key, ventana de timestamp) y EAD Trust (HMAC `x-eadtrust-signature` + timingSafeEqual, esquema marcado como OQ contractual). Rechazan sin firma.
- Evidencia de notificación: se guarda `acuse_evidence_hash` en el recipient y eventos WORM; ningún camino comms escribe `evidence_bundles` como SEALED final — coherente con HOLD 000049.
- El selector de canal etiqueta honestamente: "Email normal (sin valor probatorio)".

### Estado de cobertura (item 8)

Unit: 11 archivos de test (dispatcher, retry-policy, types, 6 adapters, comms-plazo-engine ×7 its, useCommsPlazoCheck ×3 its). E2E: **0**. Los unit tests del dispatcher validan la librería TS que NO se ejecuta en producción (la Edge Fn es una reimplementación inline) — cobertura nominal, no efectiva.
## Anexo A13

## Matriz golden path — convocatoria → reunión → acta → certificación → tramitación

| # | Salto | Estado | Evidencia |
|---|---|---|---|
| 1 | Stepper convocatoria → convocatoria emitida | ⚠️ fricción | Pantalla de éxito solo ofrece listas ('Ver convocatorias', 'Ir a reuniones'); no enlaza a `/secretaria/convocatorias/${emitidoId}` — ConvocatoriasStepper.tsx:2176-2193 |
| 2 | ConvocatoriaDetalle → reunión | ✅ fluido | Card 'Reunión operativa': 'Abrir reunión' si existe, o crea con `createMeetingFromConvocatoria` conservando origen y orden del día — ConvocatoriaDetalle.tsx:324-340, 565-585 |
| 3 | ReunionStepper (cierre) → acta | ✅ fluido | `navigate(\`/secretaria/actas/${minuteId}\`)` tras `fn_generar_acta`; si ya hay acta, botón directo — ReunionStepper.tsx:3658, 3822 |
| 4 | Acta → certificación | ✅ fluido | EmitirCertificacionButton/EmitirCertificacionAcuerdoButton en ActaDetalle; certificaciones listadas en la misma página tras invalidación |
| 5 | Certificación → tramitación | ✅ fluido | Botón 'Abrir en tramitador' con `?certificacion=&agreement=&scope=sociedad&entity=` — ActaDetalle.tsx:862-878; TramitadorStepper hidrata el intake |
| 6 | TramitadorStepper → expediente registral | ❌ roto (dead-end) | 0 `navigate()` en el archivo; `registryFilingId` persistido pero nunca usado para navegar; último paso con 'Siguiente' deshabilitado y única salida 'Cancelar y volver' — TramitadorStepper.tsx + StepperShell.tsx:47,54-61,151-161 |
| 7 | Acta → reunión (backlink) | ❌ roto | Sin Link a `/secretaria/reuniones/:id`; convocatoria referenciada como UUID crudo en texto — ActaDetalle.tsx:258-261 |
| 8 | Acuerdo sin sesión (3 steppers) → expediente Acuerdo 360 | ✅ fluido | 'Ver expediente' + 'Generar documento' — AcuerdoSinSesionStepper.tsx:405-413, CoAprobacionStepper.tsx:596-603, SolidarioStepper.tsx:535-542 |
| 9 | AcuerdoSinSesionDetalle → expediente | ✅ fluido | navigate a `/secretaria/acuerdos/${linkedAgreement.id}` — AcuerdoSinSesionDetalle.tsx:236 |
| 10 | DecisionUnipersonalStepper → detalle | ✅ fluido | navigate al detalle creado — DecisionUnipersonalStepper.tsx:237 |
| 11 | DecisionDetalle → expediente Acuerdo 360 | ⚠️ fricción | linkedAgreement disponible solo para doc-gen; sin navegación — DecisionDetalle.tsx:109,141-144 |
| 12 | ExpedienteAcuerdo → reunión / decisión / sin-sesión / generar / tramitador | ✅ fluido | Links completos — ExpedienteAcuerdo.tsx:243,277,364-389 |
| 13 | GenerarDocumentoStepper → expediente | ✅ fluido | navigate(expedientePath) — GenerarDocumentoStepper.tsx:794,1678 |
| 14 | ReunionStepper /nueva (intake) → reunión creada | ✅ fluido | navigate a la reunión con scope — ReunionStepper.tsx:4132 |

## Inventario de estados crudos detectados (cruce STATUS_LABEL vs Cloud)

| Valor DB | Tabla.columna | Filas Cloud (tenant demo) | Dónde se muestra crudo |
|---|---|---|---|
| SIGNED | certifications.signature_status | 6 | ActaDetalle.tsx:815 ('Firma: SIGNED') |
| PENDING | certifications.signature_status (DEFAULT) | 0 actuales, default schema | mismo render |
| NO_APLICA | mandatory_books.legalization_status | 276 | LibrosObligatorios.tsx:356,541 |
| APPROVED | no_session_resolutions.status | 1 (+ DEFAULT schema) | AcuerdosSinSesion.tsx:262 badge + escapa al filtro 'Aprobado' (:79,:171) |
| Active | entities.entity_status | 46 | LibroSocios.tsx:95, LibrosObligatorios.tsx:196, Plantillas.tsx:393, BoardPack.tsx:583 (sin pasar por statusLabel, que sí lo mapea) |
| (varios) | normative source.status | n/a | SociedadDetalle.tsx:435, RuleManagerPage.tsx:593 (sin verificar valores Cloud — limitación) |

## Verificaciones limpias (sin hallazgo)

- Tokens Garrigues: 0 hex en className/style (los 2 matches `#eac` son `{{#each}}` Handlebars en comentarios), 0 clases Tailwind nativas de color, 0 `var(--g-brand)` sin -3308, 0 `var(--g-status-*)`, 0 `var(--g-surface-secondary)`, 0 double-nested `var(var(...))`.
- Empty states: listas principales (Convocatorias, Actas, Decisiones, Tramitador, Acuerdos sin sesión) con icono + mensaje contextual por vista/filtros; el CTA de creación vive en el header de página (aceptable, aunque el empty state dice 'Crea una nueva convocatoria' sin botón inline).
- Loading: spinners Loader2 consistentes en todas las listas.
- Aria: 63 aria-label, 54 aria-busy, aria-invalid/describedby presentes en los formularios críticos (Capa3Form, ArrayField, ReunionStepper, GenerarDocumentoStepper); labels visibles en formularios muestreados.
- Query params de sidebar honrados: `?estado=SUBSANACION|PRESENTADA` en TramitadorLista (VISTA_CONFIG) y `?vista=pendientes|certificaciones` en ActasLista.
- Estados de meetings en Cloud ya en español (CELEBRADA 17, CONVOCADA 9) — coherentes con STATUS_LABEL y STATUS_TONE.

## Limitaciones

- No se verificaron los valores reales de `status` de fuentes normativas (SociedadDetalle:435 / RuleManagerPage) en Cloud — el shape vive en perfiles JSONB de rule manager y no localicé la tabla sin ampliar el presupuesto de consultas.
- Auditoría estática + datos Cloud; no se ejecutó la app en navegador, por lo que el comportamiento de doble-activación del NavLink duplicado se infiere del código (mismo `to`), no de captura.