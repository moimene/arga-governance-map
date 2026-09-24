# Especificación: programa de cobertura RIA de AIMS 360 con el catálogo del experto (Garrigues y ARGA, demostrador interno)

> **Leer primero el §14.** Las 14 enmiendas vinculantes de la verificación de la v2 prevalecen sobre el texto. La E-01 (ALTA) afecta a F1.T14 (M01): las columnas de autoría apuntan a `persons`, no a `auth.users`.


*Versión 2, 19-09-2026. Redactada sobre `origin/main b1721a5` (instantánea `…/scratchpad/ria/snapshot`) y el dato de Cloud medido hoy con SELECT. Es el documento que ejecutan los implementadores. Gaps canónicos: GC-01 a GC-140 (GC-138 a GC-140 se añaden en esta versión tras medir Cloud). Fuente del diagnóstico: `docs/superpowers/reviews/2026-09-19-vision-ria-experto-vs-aims.md`. La v2 incorpora las 28 observaciones del crítico, cada una verificada antes de aplicarla, y la respuesta de Harvey al lote H-01 (17 criterios validados y 8 consideraciones convertidas en requisitos RH-1 a RH-8). El detalle está en el §13. Copia de trabajo íntegra: `/private/tmp/claude-501/-Users-moisesmenendez-Dropbox-DESARROLLO-arga-governance-map/daad2e6f-46e0-4e63-9af8-a475225c5fe2/scratchpad/ria/spec_v2.md`.*

---

## 1. Objetivo y decisiones

### 1.1 Objetivo

Cubrir los 140 gaps para que AIMS 360 sea, en cada tenant (Garrigues `…0002` y ARGA `…0001`), el programa interno de cumplimiento del RIA que describe el experto: sus 65 obligaciones, sus 76 entregables y sus 5 fases. Cada obligación se imputa a una persona jurídica, sobre un sistema o un modelo, en un rol. Lleva estado, responsable, plazo, evidencia y exigibilidad. Todo se integra con GRC, Secretaría, Entidades, Órganos, Personas y Políticas, y cada módulo escribe solo lo que es suyo.

### 1.2 Decisiones vinculantes del usuario

| # | Decisión | Cómo se aplica en esta especificación |
|---|---|---|
| U-1 | Se cubren todos los gaps. Lo condicional se cubre como capacidad. | Cada GC tiene al menos una tarea (§11). Lo condicional sale como instancia CONDICIONADA u OPCIONAL, y no cuenta en rojo mientras el hecho no conste. |
| U-2 | Sistemas internos de Garrigues y ARGA, modo demostrador. La matriz es el programa interno de cada tenant. | Programa = tenant. No se crea ningún objeto «encargo» ni «cliente». |
| U-3 | Integrar todo lo posible, respetando la propiedad de cada módulo. | Cada objeto vive en su dueño natural (§2.2). La escritura cruzada solo pasa por una lista blanca de RPC del dueño (§2.3). |
| U-4 | El experto manda en criterio. Si el texto le contradice con claridad, se implementa el texto y se marca. | Catálogo con dos capas: la literal del experto, intacta, y la canónica. `discrepancia.estado = A_VALIDAR_EXPERTO` (§4.5). |
| U-5 | Harvey valida los criterios. | H-01 respondido el 19-09-2026: los 17 criterios quedan VALIDADOS (§1.4). Lotes pendientes redactados como prompts listos para encolar (§9). Ningún criterio se fija en el servidor sin veredicto registrado; lo que el cliente adelanta antes del veredicto se rotula «provisional, pendiente de validación» y queda en el ledger. |
| U-6 | Hay migraciones en `governance_OS`, con las reglas del proyecto. | Régimen RS-TABLA (§2.1) y gate G-MIG en cada tarea que migra. |
| U-7 | ARGA recibe cambios aditivos y declarados, nada destructivo. | Ledger de filas de ARGA tocadas. El legado se trata por regla, sin UPDATE sobre filas de ARGA (DS-16). |
| U-8 | Derecho vigente: RIA modificado por el Reglamento (UE) 2026/1744. | Calendario y citas en `exigibilidad.ts` y `textoVerificado` por fila (§4.3). Los puntos sin verificar quedan PENDIENTE_LEGAL. |

### 1.3 Decisiones de diseño tomadas aquí

- **DS-01 Base del diseño.**
  - Arquitectura: la del enfoque «catálogo del experto como columna vertebral», con cada objeto en su dueño natural. Es la que recomienda el juez técnico.
  - Núcleo jurídico de derivación: el del enfoque AIMS-céntrico, que recomienda el juez jurídico: 3.3 conjuntivo, 25.1 solo si el resultado es Alto, la evaluación del 6.3 y el 6.4 la hace el proveedor (el responsable del despliegue se apoya en ella si consta, §3.2), art. 5 por usos posibles, estado por subapartado. Harvey validó el 3.3 y el doble rol por uso propio (C8, C11) y el perfilado del 6.3 (C10).
  - Por qué: la arquitectura C cumple U-3 y U-4 con una sola verdad por objeto. Las derivaciones de A son las únicas correctas en el centro del modelo de sujeto. La derivación de C «B1 ∨ B2 → PROVEEDOR» es errónea y se descarta.
- **DS-02 Sujeto = sistema o modelo × sociedad × rol** (`aims_ria_subjects`), relación N:M con vigencia.
  - Por qué: el RIA imputa roles a personas jurídicas (arts. 3.3, 3.4, 3.6, 3.7), y el ámbito depende de su establecimiento (art. 2.1). Cumple D-1: `ai_systems` sigue siendo el inventario, gana columnas, y lo que no cabe va a `aims_*`.
- **DS-03 Una sola derivación de aplicabilidad.** Hoja `src/lib/aims/aplicabilidad.ts` con espejo SQL. De ella salen a la vez los marcos, el catálogo de medidas medido y las instancias de obligación.
  - Por qué: hoy `derivarMarcos` y `perfilAplicable` divergen (GC-21) y el servidor sella marcos que no ha comprobado (GC-20).
- **DS-04 DSL de predicados trivalente con lógica de Kleene.** Un hecho sin responder da DEPENDE, nunca NO_APLICA.
  - Por qué: es el fail-open correcto. Medir de más y decirlo, sin esconder obligaciones.
- **DS-05 Exigibilidad como estado calculado:** EXIGIBLE, EXIGIBLE_DESDE, LATENTE_111_2, CONDICIONADA, OPCIONAL, PENDIENTE_LEGAL. Los relojes del art. 73 y la cadena del 26.5 pasan por una compuerta de exigibilidad. Si no son exigibles, se pintan como «simulacro — no exigible».
  - Por qué: los tres enfoques presentaban como exigible un régimen latente (cap. III desde el 2-12-2027; art. 111.2).
- **DS-06 Propiedad.**
  - GRC: obligaciones de organización (`obligations`, con estado leído de su control), riesgo (`risks`), acciones (`action_plans`), EIPD (`grc_dpias`, privacidad), formación (`grc_training_records`), terceros (`grc_third_parties`) y aristas GRC↔IA (`grc_ai_links`).
  - Secretaría: dictamen y decisión (`secretaria_document_artifacts`).
  - AIMS: sujeto, cuestionario, instancias de ámbito SISTEMA y MODELO, entregables, registros operativos y operación del sistema.
  - Por qué: U-3, y no duplicar lo que GRC ya tiene. Se descartan `aims_actions`, `aims_risk_register`, `aims_ai_suppliers` y `aims_dpia`.
- **DS-07 La instancia de ORGANIZACIÓN existe en AIMS, pero su estado se calcula con una sola regla.** No admite estado manual en AIMS.
  - Regla única (hoja `src/lib/aims/estado-organizacion.ts` y espejo SQL `fn_aims_estado_organizacion`): la cobertura del control se lee con `obligationCoverage` (`src/lib/grc/obligation-coverage.ts`), nunca con un mapa propio. CUMPLIDA si y solo si la cobertura es CUBIERTA (todos los controles Efectivo) **y** los entregables requeridos están APROBADO. EN_CURSO si la cobertura es CUBIERTA con entregables pendientes, EN REMEDIACIÓN o EN PROCESO. PENDIENTE si es SIN CONTROL. MARCO PROSPECTIVO no computa. El motivo se pinta siempre («control efectivo, falta el programa aprobado»).
  - Deuda heredada y declarada: `obligationCoverage` pinta `Inefectivo` como EN PROCESO (CTR-008, decisión del 16-08). Aquí da EN_CURSO, no PENDIENTE, y se declara en el ledger. No se corrige en este programa.
  - Por qué: una sola verdad (C-03 y el trigger de F6.T1 dan la misma regla) sin perder la vista por sociedad.
- **DS-08 Avance documental frente a cumplimiento material.**
  - En obligaciones de una sola vez, CUMPLIDA exige que estén aprobados todos los entregables requeridos.
  - En las continuas (4, 12/19/26.6, 14, 26.5, 72, 73, 21/26.12), los entregables aprobados se rotulan «avance documental». El cumplimiento material se lee de los registros operativos del periodo de revisión.
  - El art. 4 se acredita con medidas adoptadas (redacción del Ómnibus), no con cobertura ni nivel. Validado por Harvey (C14).
  - Por qué: el protocolo aprobado no prueba que se cumpla. Además, la cobertura reintroduce la lógica de resultado que el Ómnibus suprimió.
  - Es una reinterpretación de la métrica «% avance» del experto: lleva chip A_VALIDAR_EXPERTO y va a sus preguntas (F0.T4, F3.T11).
- **DS-09 Registros operativos en un diario de solo anexión** (`aims_ria_records`), con `kind` cerrado y esquema por tipo. Una corrección es una entrada nueva que referencia a la anterior.
  - Por qué: todos comparten ciclo de vida y aislamiento. Además, es coherente con WORM.
- **DS-10 Estado por subapartado** (`items_estado`) en las obligaciones con letras: 16, 17.1 (incluidas d y e), 23.1, 24.1, 26, 50.5, 60.4, 61.1 y anexo VIII A, B y C. Una instancia con letras pendientes no se cierra. OB-18 (art. 16) sigue siendo **una sola fila** con items a)-l): no se parte, para no cambiar el denominador del experto.
- **DS-11 RBAC.**
  - Capacidades `AIMS_*` en `capability_matrix`, ampliando `capability_matrix_action_check`. Hoy admite 8 acciones (medido).
  - Se reutiliza `fn_secretaria_assert_capability`. Medido: lanza `RAISE EXCEPTION` sin ERRCODE (P0001, «capability % denied for role %») y deja pasar siempre a ADMIN_TENANT. `fn_aims_assert_capacidad` captura esa excepción y la relanza con ERRCODE `42501` y el código `AIMS_CAPACIDAD_DENEGADA`, que `errores-rpc.ts` traduce.
  - SECRETARIO clasifica, evalúa y congela. CONSEJERO y AUDITOR solo leen.
  - Revisar exige capacidad, ser miembro vigente del órgano de IA y ser persona distinta de quien redactó y de quien congeló.
  - En ARGA hace falta una segunda cuenta real (acción de Auth del usuario) enlazada a una persona con cargo vigente en el órgano de IA (F2.T18). No se asigna COMPLIANCE a una cuenta SECRETARIO: SECRETARIO+COMPLIANCE es un par con aviso de SoD en `sod_toxic_pairs` (medido: severity WARN, no BLOCK). La decisión es prudente aunque el par no bloquee.
- **DS-12 Aislamiento de las FK.**
  - Trigger genérico `fn_aims_fk_misma_tenant` para FK hacia tablas sin UNIQUE(tenant_id,id). Medido: `persons` solo tiene PK, `governing_bodies` y `entities` tienen PK más UNIQUE(slug), `policies` igual.
  - FK compuesta nativa donde la PK ya es compuesta: `grc_third_parties` PK (tenant_id,id), medido.
  - Por qué: la RLS filtra a cero filas sin error y una FK simple no impide apuntar a otro tenant.
- **DS-13 Sin CHECK sobre `ai_systems.status`** (DA-13 sigue aplazado; hay valores legado `Conforme`, `En revision`, `Pendiente`). El cribado y la práctica prohibida van en columnas propias con su CHECK.
- **DS-14 Branding.**
  - Nunca se escribe el branding de ARGA: es NULL y falla abierto (medido).
  - No se abren a Garrigues las vistas fixture `gdpr`, `audit` ni `cyber`.
  - La fila `grc_modules.ai` existe para el trigger y para RiskEditor. `/grc/m/ai` redirige de forma explícita a `/ai-governance/programa` y nunca pinta el shell de fixtures.
  - `branding.modules` de Garrigues no cambia. `branding.scopes` de Garrigues solo se siembra cuando exista la arista (GC-09).
- **DS-15 La clasificación de demostración** se hace con un script idempotente, login real y las RPC. No con un e2e que escriba en Cloud ni con service_role. El resultado no se fija en el seed: Harvey (H-04) lo contrasta antes de la revisión del segundo miembro.
- **DS-16 El legado se trata por regla** (`legado.ts`, `v_aims_indicator_status`), sin UPDATE sobre filas de ARGA ni de Garrigues. El nivel previo se guarda en `regulatory_profile.nivel_declarado_previo` cuando la RPC clasifica.
- **DS-17 Harvey es un validador, no un dictamen.** Su respuesta es dato: se archiva con hash, se rotula «Validado por Harvey» y, si discrepa, la fila pasa a la sesión con el experto. Solo se le envían criterios de derecho público, sin datos de clientes (PI-30, CTR-GARR-33). Una afirmación de Harvey que no está en el texto consolidado no se aplica (caso C15, §1.4).
- **DS-18 Los contratos enterprise** (GARR-IA-101/102) pasan a `inventory_kind = CONTRATO_MODELO`, enlazados como título de acceso del art. 3.63 en el registro de modelos. No se tratan como un cribado negativo del art. 3.1. GARR-IA-201 pasa a `HOJA_DE_RUTA`, con motivo del art. 2.8. Validado por Harvey (C17), que confirma además que el despacho es proveedor posterior (3.68) si integra el modelo en un sistema propio y solo responsable del despliegue si usa un sistema ya configurado.
- **DS-19 Elegibilidad como sujeto** = persona jurídica activa. Validado por Harvey (C11 y C12).
  - `entities.legal_form` es texto libre y sin normalizar (medido: 17 formas en ARGA, entre ellas «S.A.», «SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE», «Corporation» e «Inc.», y 18 en Garrigues). `sujeto-juridico.ts` lleva una **tabla de equivalencias** forma → clase (PERSONA_JURIDICA, SIN_PERSONALIDAD, PENDIENTE_LEGAL). Un test sobre las formas reales de los dos tenants falla ante una forma nueva sin clasificar. No hay lista negra: lo no clasificado no es elegible hasta que se clasifique.
  - Se excluyen DIVISION, OFICINA, REP_OFFICE/OFICINA_REPRESENTACION y SUCURSAL, que suben a su titular, y las extintas (`entity_status = Liquidated`).
  - Las fundaciones y las sociedades vehículo sí son elegibles: tienen personalidad y los arts. 3.3 y 3.4 incluyen «otro organismo».
  - Quedan PENDIENTE_LEGAL (D-U4, H-09), por fila y no por una forma inexistente: INSTITUCION (Centro de Estudios), BSVV (integración Chile, LIMITADA, por su estado de integración; en Cloud no existe ninguna forma «INTEGRACION»), SPK (Garrigues Varsovia), LLP (Garrigues UK y Garrigues Nueva York) y SC (G-Advisory México, Garrigues México y Garrigues MX).
- **DS-20** El anexo I cubre las secciones A y B. La B lleva el régimen reducido del art. 2.2.
- **DS-21** Predicado exacto del art. 27.1: RESPONSABLE_DESPLIEGUE ∧ Alto (6.2) ∧ (organismo de Derecho público ∨ entidad privada que presta servicios públicos ∨ anexo III 5 b ∨ 5 c) ∧ ¬ punto 2.
- **DS-22** El art. 74.6 se limita a los sistemas de alto riesgo introducidos o usados por la entidad financiera en conexión directa con sus servicios financieros. Validado por Harvey (C16: para una aseguradora española, DGSFP o EIOPA según corresponda). El art. 73.9 va aparte, como equivalencia a razonar (H-06).
- **DS-23** El incidente de sesgo de ARGA Score se trata como **simulacro no exigible** (arts. 113 y 111.2). Sin subexpediente RGPD, salvo que conste una violación de seguridad (arts. 4.12 y 33 RGPD). Validado por Harvey (C7: el periodo de gracia se computa por tipo y modelo, considerando 39).
- **DS-24** Pantallas y componentes de 400 líneas como máximo. Criterios en módulos hoja sin React. Gates de arista (importa y llama), no de rótulo. Tokens Garrigues.
- **DS-25** La leyenda de la escala de daño a personas la fija el Comité de IA, no el código. Hasta que la fije, la pantalla dice «escala sin leyenda aprobada».
- **DS-26** Las fechas objetivo de las fases se guardan por tenant y las fija el órgano. La siembra inicial usa las fechas del experto marcadas como «Simulado». La fase 1 es de entrada y las fases 2 a 5 son ciclo. Los arts. 4 y 5 van como regularización inmediata.
- **DS-27** Se verifica en el DOUE antes de fijar: art. 2.13, art. 57.1, supervivencia del 49.2 (Harvey, C3, dice que subsiste simplificado; falta el cotejo literal del alcance) y de los puntos 7 y 9 del anexo VIII B, régimen del 111.2 para las autoridades públicas, fecha de la sección 5, aplicación del 4 bis desde el 27-7-2026 (lo afirma Harvey citando el considerando 9: RH-3) y la cita de Harvey al considerando 25 (C8). Mientras no se verifique, el punto queda PENDIENTE_LEGAL y deriva DEPENDE.
- **DS-28** El cuestionario se responde por sujeto (sistema × sociedad). El cribado del art. 3.1 se hace una sola vez por sistema. La UI permite copiar respuestas de otra sociedad como borrador.
- **DS-29** «Registrar» se reserva para el art. 49. El alta pasa a llamarse `fn_aims_alta_sistema`. `fn_aims_registrar_sistema` queda como alias que **solo acepta payload v2**. Las funciones v1 (`fn_aims_completar_cuestionario`, `fn_aims_derivar_rol`, `fn_aims_derivar_nivel`; medido: las tres ejecutables hoy por authenticated) pierden EXECUTE en M08 y, si se las llama por un camino SECURITY DEFINER, rechazan con `CUESTIONARIO_V1_RETIRADO`. El alias deja de valer como camino de limpieza de las sondas (DS-31).
- **DS-30** Fecha tope interna: 13-11-2026 para el cuestionario v2. Antes del 2-12-2026 van el carril rápido del art. 50 (F6.T1, T2, T3, T4, T5, T8 y T14) y la clasificación de ARGA Assist y GA_IA (art. 5.1 b bis/b ter y art. 50.2 por el 111.4, este validado por Harvey como RH-6).
- **DS-31 Sondas vivas en dos variantes.** Las tablas nuevas no admiten DELETE, `aims_ria_subjects` apunta a `ai_systems` con RESTRICT y los sujetos, instancias y entregables van a `fn_audit_worm`. Una sonda que escriba en Cloud no puede limpiarse (precedente: DA-17).
  - **G-VIVO-NEG** (permanente, en `bun test`): solo lecturas, caminos negativos (la escritura prohibida se rechaza y no deja fila) o llamadas a funciones IMMUTABLE de derivación, que no escriben.
  - **G-VIVO-REV** (por tarea, archivada en el ledger): caminos positivos como sonda revertida vía MCP `execute_sql` con `set_config('request.jwt.claims', …, true)`, `set local role authenticated` y ROLLBACK. Se archiva la salida.
  - La sonda actual `aims-cuestionario-live.test.ts` (crea un sistema PROBE, completa y lo borra confiando en el CASCADE, líneas 48-98) se reescribe en F4.T7 y deja de completar contra Cloud.
- **DS-32 Columnas «solo por RPC» en tablas existentes.** Medido: `ai_incidents`, `aims_system_versions`, `aims_technical_file_sections` y `risks` admiten UPDATE directo de authenticated con políticas FOR ALL por tenant; en `ai_risk_assessments` el trigger de congelación deja escribir los campos de revisión; `risks.residual_score` es numérica y no generada (la generada es `inherent_score`). Toda columna declarada «solo por RPC» sobre una tabla existente lleva, en la migración que la crea, un trigger BEFORE INSERT OR UPDATE que rechaza el cambio si falta el flag de la RPC (`coalesce(current_setting('aims.rpc', true), '') = 'on'`), con control positivo en el bloque de verificación y una sonda G-VIVO-NEG por columna.
- **DS-33 Registros operativos con datos personales.** `aims_ria_records` es de solo anexión, pero los kinds SOLICITUD_EXPLICACION_86, RESPUESTA_EXPLICACION_86, INFORMACION_AFECTADOS_26_11, INFORMACION_TRABAJADORES_26_7, CONSENTIMIENTO_61, RETIRADA_CONSENTIMIENTO_60_5 y la contraparte de cualquier kind pueden llevar datos de terceros (arts. 5.1 c y e y 17 RGPD). Minimización: en `payload` y `counterpart` van referencias o seudónimos, no datos directos. Conservación: `retention_until` obligatoria en esos kinds y `legal_hold`. Supresión: RPC gobernada `fn_aims_suprimir_datos_registro`, que redacta `payload` y `counterpart` y conserva kind, fechas y hash del contenido original. Es una **excepción declarada a WORM**. El criterio de plazos lo fija el DPO con H-17.
- **DS-34 Sujetos de hipótesis y cuestionario.** El cuestionario nunca reescribe una fila SIEMBRA_HIPOTESIS: la cierra (`status = CERRADO`, `valid_to`) y crea en la misma transacción la fila CUESTIONARIO con `provenance.sustituye = <id>`. Cerrar no es pisar: las columnas sembradas no cambian y G-PERSIST lo comprueba. Qué cuenta como sistema en cualquier recuento lo decide una sola hoja, `cuentaComoSistema()` (`inventory_kind = SISTEMA_IA` y `ai_definition_result ≠ NO_ES_SISTEMA_IA`), con G-ARISTA en Dashboard, inventario, readiness, programa y vistas.
- **DS-35 Exigibilidad heredada fuera del capítulo III.** Toda obligación cuyo predicado exige nivel Alto hereda la fecha del anexo que clasifica (III o I) y la latencia del 111.2, esté en el capítulo que esté: arts. 71, 72, 73, 74 y 86. Sin esta regla, la fecha general del art. 113 los haría exigibles desde el 2-8-2026 sobre un sujeto que aún no existe. Es criterio TGMS a validar (H-08).
- **DS-36 Autoridad por sociedad (RH-7).** La autoridad se resuelve por entidad del grupo, no por tenant: la entidad financiera del caso DS-22, su supervisor financiero; cualquier otra, la autoridad nacional general de IA de su Estado (en España, previsiblemente AESIA, pendiente de verificar la designación). El despacho no es entidad financiera.
- **DS-37 EIDF ≠ EIPD (RH-5).** Son objetos, pantallas y rótulos distintos. La remisión del 27.4 completa una sección de la EIDF, nunca la cierra por sí sola: igualdad, no discriminación y tutela judicial exceden a la EIPD. H-07 fija qué secciones admiten la remisión.
- **DS-38 Cambio significativo como consulta interna (RH-2; premisa corregida por E-15).** El Ómnibus no define «cambios significativos en el diseño» (111.2); el considerando 177 lo equipara «en sustancia» a la «modificación sustancial» (3.23). La herramienta no lo deriva: la clase SIGNIFICATIVO_111_2 exige un dictamen de consulta interna (Secretaría, asunto CAMBIO_SIGNIFICATIVO_111_2) y el motivo.
- **DS-39 Acuerdos intragrupo (RH-1).** Si una sociedad del grupo desarrolla y otra lo pone en servicio con su nombre, esta acumula los dos roles; si la primera lo comercializa como producto propio, ella es la proveedora y la otra solo responsable del despliegue. El reparto se formaliza en un acuerdo intragrupo que se registra como componente (`relation_kind = ACUERDO_INTRAGRUPO`, `counterpart_entity_id`) y se cita en el sujeto.
- **DS-40 Secreto profesional (RH-8).** El RIA no tiene excepción expresa para el secreto profesional abogado-cliente frente a la cooperación (art. 21) y el acceso a documentación y código (art. 74). La herramienta no decide: cada requerimiento lleva el campo «afecta a información amparada por secreto profesional» y remite a la posición documentada del despacho, que fija el Comité de IA (F0.T5) y contrasta H-16.

### 1.4 Validación de Harvey H-01 (respondida el 19-09-2026)

Hilo `https://eu.app.harvey.ai/assistant/assist/453044984`, 24 fuentes de EUR-Lex (texto consolidado del RIA a 27-07-2026, CELEX 02024R1689-20260727, y Reglamento (UE) 2026/1744). Prompt en `harvey/01-criterios-aplicabilidad.md`; respuesta y contraste en `harvey/01-respuesta.md`. Los 17 criterios quedan **VALIDADOS**:

| Criterio | Veredicto | Dónde se aplica |
|---|---|---|
| C1 50.2 al proveedor; 50.4 p. 1 al responsable del despliegue | CORRECTO | §4.5 OB-43; S7; F3.T6 |
| C2 No hay 10.4.f); hoy 4 bis.1.f) | **CORRECTO CON MATIZ, que se aplica**: el 4 bis.1.f) sí obliga a documentar las razones de necesidad estricta en el registro de **ese** tratamiento concreto; lo que no es, es un deber general de actualizar el registro del art. 30 RGPD | §4.5 OB-12; F7.T4 |
| C3 49.3 y anexo VIII C solo alto riesgo del anexo III salvo punto 2; el 6.3 lo registra el proveedor (49.2) | CORRECTO | §4.5 OB-56; F9.T7; F10.T5 |
| C4 Art. 20 al proveedor; el desplegador, 26.5 | CORRECTO | §4.5 OB-22; F8.T8; F9.T6 |
| C5 EIPD por el riesgo del tratamiento; 26.9 solo alto riesgo | CORRECTO | §4.5 OB-38; §5.4; F5.T11 |
| C6 27.1 para la aseguradora privada del anexo III 5 c) | CORRECTO | DS-21; F8.T5 |
| C7 111.2 y considerando 39 por tipo y modelo | CORRECTO | DS-23; §4.3; F3.T3 |
| C8 Uso propio = proveedor y responsable del despliegue | CORRECTO (su cita al considerando 25, pendiente de cotejo: F0.T2) | §3.2; F4.T4 |
| C9 50.6: acumulación | CORRECTO | §3.2; F4.T4 |
| C10 Perfilado impide el 6.3 | CORRECTO | §3.2; F1.T10; F4.T4; F4.T11 |
| C11 El rol es de la persona jurídica; una división no es proveedora | CORRECTO | DS-19; §7; §8 (hipótesis de ARGA); F2.T1 |
| C12 Oficinas y sucursales, 2.1 b); filial fuera de la UE, 2.1 c) | CORRECTO | S1; F2.T1 |
| C13 5.1 bis b) al desplegador, 5.1 bis a) al proveedor | CORRECTO | S3; F4.T10 |
| C14 Art. 4 de medios | CORRECTO | DS-08; F1.T11; F5.T6; F6.T11 |
| C15 26.5 y el 73 solo si no localiza al proveedor | **CORRECTO tal como se formuló.** Harvey añade un matiz: que el art. 73.4 impone una obligación directa a desplegadores públicos o de ciertos puntos del anexo III. Contrastado con el art. 73.4 consolidado (leído literal): solo regula el plazo en caso de fallecimiento para «el proveedor o el responsable del despliegue»; no contiene esa obligación ni cita puntos del anexo III. El matiz **no se aplica** y así consta | §5.6; F8.T8 |
| C16 74.6: supervisor financiero | CORRECTO | DS-22; §5.7; F7.T3; F8.T6 |
| C17 Contrato enterprise ≠ sistema; proveedor GPAI; proveedor posterior (3.68) si integra | CORRECTO | DS-18; F4.T15 |

Consideraciones adicionales de Harvey convertidas en requisitos (cada una con su tarea):

| Req. | Consideración | Requisito | Tareas |
|---|---|---|---|
| RH-1 | Doble rol intragrupo y acuerdos intragrupo | DS-39: `ACUERDO_INTRAGRUPO` en componentes, citado en el sujeto; D-U1 y D-U3 preguntan por el acuerdo | F0.T1, F0.T5, F4.T15, F9.T8 |
| RH-2 | «Cambio significativo» (111.2) ≠ «modificación sustancial» (3.23) | DS-38: consulta interna obligatoria para SIGNIFICATIVO_111_2 | F0.T5, F5.T13, F9.T1 |
| RH-3 | Art. 4 bis aplicable desde el 27-7-2026 | PENDIENTE de verificar en el literal (F0.T2). Mientras, PENDIENTE_LEGAL con alarma ámbar «posiblemente exigible desde el 27-7-2026» si `H_cat_especiales_sesgo = SI` | F0.T2, F3.T3, F6.T8, F7.T4 |
| RH-4 | Art. 25 y fine-tuning de modelos de terceros | Criterio de la herramienta: la pregunta R_8b nombra el ajuste fino; el ajuste de un modelo de uso general por encima del umbral lleva a G_2; el de un sistema de alto riesgo, a la modificación sustancial del 25.1 b). Pregunta en H-02 | F4.T1, F4.T3, F4.T4 |
| RH-5 | EIDF ≠ EIPD | DS-37 | F5.T12, F8.T4, F8.T5 |
| RH-6 | Art. 111.4 | 50.2 exigible el 2-12-2026 para generativos introducidos antes del 2-8-2026: ya en §4.3, ahora validado | F3.T3, F6.T3, F6.T8 |
| RH-7 | Autoridad por entidad del grupo (el despacho, autoridad general de IA; la aseguradora, DGSFP) | DS-36 | F8.T6 |
| RH-8 | Secreto profesional frente a los arts. 21 y 74 | DS-40: punto para el Comité de IA y lote H-16 | F0.T5, F6.T13 |

---

## 2. Arquitectura

### 2.1 Régimen estándar de tabla nueva o revivida (RS-TABLA)

1. `tenant_id uuid NOT NULL` sin DEFAULT. Las tablas globales del catálogo no llevan tenant y se declaran en `src/test/garrigues/aislamiento-declarado.ts`.
2. RLS activada. SELECT por `tenant_id = fn_current_tenant_id()`. La escritura directa, si la hay, exige también `fn_aims_tiene_capacidad(…)`. No hay política de DELETE.
3. `REVOKE ALL … FROM public, anon`. `GRANT` a `authenticated` solo de lo necesario: SELECT siempre; INSERT y UPDATE solo si no se escribe exclusivamente por RPC. `REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER FROM authenticated`, explícito porque un grant es aditivo y TRUNCATE no pasa por RLS.
4. `fn_aims_fk_misma_tenant` en cada FK hacia `entities`, `persons`, `governing_bodies`, `policies`, `ai_systems`, `obligations`, `controls` y `risks`.
5. Flags de RPC con `coalesce(current_setting('…', true), '') = 'on'`, apagados al terminar.
6. Bloque `DO` de verificación que aborta. Comprueba columnas, índices, políticas, grants y triggers, e incluye un control positivo del instrumento: una inserción prohibida dentro de `EXCEPTION` debe fallar y una permitida debe entrar y revertirse.
7. Espejo en `supabase/migrations/`, aplicación vía MCP `execute_sql` en transacción explícita y registro manual en `supabase_migrations.schema_migrations` (canal vigente; el CLI cuelga).
8. Sin DELETE ni TRUNCATE de dato sembrado. Nada en `governance_module_events` ni en `governance_module_links`.
9. **ON DELETE RESTRICT** en toda FK hacia `ai_systems`, `aims_incident_regimes`, `ai_incidents` y `entities` desde una tabla con valor probatorio, nueva o revivida. Nunca CASCADE: `authenticated` conserva DELETE sobre `ai_systems` (DA-16) y un CASCADE arrastraría EIDF congeladas, datasets o informes de incidente. La verificación comprueba `confdeltype = 'r'` con control positivo. Medido: las 8 tablas que se reviven tienen hoy CASCADE hacia `ai_systems` o `aims_incident_regimes`, y `aims_incident_regimes.entity_id → entities` también.
10. Columna «solo por RPC» sobre una tabla existente: trigger de guardia de DS-32 en la migración que la crea.

### 2.2 Modelo de datos por dueño

**AIMS: tablas nuevas**

| Tabla | Columnas clave | Escritura | Notas |
|---|---|---|---|
| `aims_ria_subjects` | id, tenant_id; `system_id → ai_systems ON DELETE RESTRICT` y `model_id → aims_model_registry`, con CHECK de exactamente uno; `entity_id NOT NULL → entities`; `role` CHECK (PROVEEDOR, RESPONSABLE_DESPLIEGUE, IMPORTADOR, DISTRIBUIDOR, PROVEEDOR_POSTERIOR, PROVEEDOR_GPAI, REPRESENTANTE_AUTORIZADO); `role_basis text[]` ('3.3', '3.3+3.11', '3.4', '25.1.a', '25.1.b', '25.1.c', '3.5', '3.6', '3.7', '3.68', '3.63'); `status` CHECK (PROPUESTO, PENDIENTE_LEGAL, VIGENTE, CERRADO); `derivation` CHECK (CUESTIONARIO, SIEMBRA_HIPOTESIS, LEGAL); `questionnaire_id` (obligatorio si CUESTIONARIO); `scope_result` CHECK (EN_AMBITO, FUERA_DE_AMBITO, PENDIENTE); `scope_basis` ('2.1.a' … '2.1.f', '2.3', '2.4', '2.6', '2.8', '2.10', '2.12', '2.13'); `establishment` (UE, TERCER_PAIS); `output_used_in_eu`; `rationale`; `owner_person_id → persons` (responsable interno); `governing_body_id → governing_bodies`; `review_cadence_months`, `cadence_decision_ref` (artefacto de Secretaría), `next_review_due`; `suspended_at`, `suspension_reason` (26.5); `valid_from NOT NULL`, `valid_to`; `provenance jsonb`; `created_by DEFAULT auth.uid()`; timestamps | Solo por RPC | Índice único parcial (tenant, coalesce(system,model), entity, role) WHERE status <> 'CERRADO'. CHECK (status <> 'VIGENTE' OR owner_person_id IS NOT NULL). Trigger `fn_aims_entidad_puede_ser_sujeto`. Las filas CERRADO son inmutables. `fn_audit_worm`. Una fila SIEMBRA_HIPOTESIS se cierra y se sustituye, nunca se reescribe (DS-34). `role_basis` admite 'ACUERDO_INTRAGRUPO' como referencia al componente que lo acredita (DS-39). |
| `aims_specialty_bodies` | tenant_id, `especialidad` CHECK (JURIDICO, TECNICO, RIESGOS, CIBERSEGURIDAD, DATOS), `governing_body_id`, declared_by, declared_at, provenance. UNIQUE(tenant_id, especialidad) | RPC `fn_aims_declarar_especialidad` (AIMS_GOBIERNO) | ARGA vacía hasta D-U6: falla cerrado. |
| `aims_ria_records` | id, tenant_id, `kind` CHECK con lista cerrada (§5.8), system_id, model_id, entity_id, subject_id, instance_id, version_id, assessment_id, incident_id, person_id, counterpart jsonb (destinatario, autoridad, Estado miembro, lengua; en personas físicas, referencia o seudónimo), occurred_at, due_at, `payload jsonb`, `supersedes_id`, `secretaria_artifact_id`, evidence_item_id, `retention_until`, `legal_hold bool DEFAULT false`, `redacted_at`, `redacted_by`, `original_hash`, `privileged_info bool` (secreto profesional, DS-40), created_by, provenance | RPC `fn_aims_anotar_registro`; supresión solo por `fn_aims_suprimir_datos_registro` | Solo anexión: un trigger bloquea UPDATE y DELETE, salvo la redacción gobernada de DS-33 (excepción declarada a WORM, que conserva kind, fechas y `original_hash`). Otro trigger exige las claves obligatorias de cada `kind` y `retention_until` en los kinds con datos personales. FK con RESTRICT. |
| `aims_ria_obligation_catalog` (global) | PK (catalog_version, code); apartado, cita_experto, cita_texto, origen CHECK (EXPERTO_BASE, EXPERTO_COMPLETITUD, TGMS_AÑADIDO), tema, ambito CHECK (ORGANIZACION, SISTEMA, MODELO), roles text[], predicate jsonb, exigibility jsonb, character CHECK (OBLIGACION, MARCO_OPERATIVO, OPTATIVA), naturaleza, specialties text[], fase 1-5, continua bool, deliverable_codes text[], items jsonb, discrepancy jsonb, validation jsonb, experto_fila jsonb, texto_verificado jsonb NOT NULL | Solo por migración generada desde TS | authenticated tiene solo SELECT; TRUNCATE revocado. |
| `aims_ria_deliverable_catalog` (global) | PK (catalog_version, code); texto, fase, specialty, ambito, schema_key, plantilla_key, consolidado_en, campos_requeridos text[], retencion | Solo por migración | d42 canónico; d43 y d44 son alias: un único «Protocolo de despliegue» con secciones 26.1, 26.2 y 26.4, porque el experto da el mismo título a OB-31, OB-32 y OB-33 (a confirmar con él, F0.T4). d59 y d60 son subentregables. Todo tipo requerido por alguna fila del catálogo tiene `schema_key` y `campos_requeridos` no vacíos (F6.T14); sin ellos `fn_aims_aprobar_entregable` rechaza con TIPO_SIN_ESQUEMA. |
| `aims_ria_obligation_instances` | id, tenant_id, catalog_version, obligation_code, ambito, entity_id NOT NULL, system_id, model_id, subject_id, role; `applicability` CHECK (APLICA, NO_APLICA, DEPENDE), applicability_basis jsonb; `exigibility` y `exigible_from`; `status` CHECK (PENDIENTE, EN_CURSO, CUMPLIDA, NO_APLICA_MOTIVADO, OPCIONAL_NO_ACTIVADA); na_rationale, na_by, na_at; items_estado jsonb; responsible_person_id, owner_body_id, due_date; grc_obligation_id; derivation_hash; timestamps | Solo por RPC | Único por (tenant, code, entity, coalesce(system, model, centinela), coalesce(role, '')). Trigger: CUMPLIDA exige los entregables requeridos APROBADO y los items cerrados; en ORGANIZACION el estado lo pone solo `fn_aims_estado_organizacion` (DS-07), que exige además la cobertura CUBIERTA. Sin DELETE: lo que deja de aplicar pasa a NO_APLICA con base DERIVACION. `fn_audit_worm`. |
| `aims_ria_deliverables` | id, tenant_id, deliverable_code, version, entity_id NOT NULL, system_id, model_id, role, system_version_id; `status` CHECK (PENDIENTE, BORRADOR, EN_REVISION, APROBADO, SUSTITUIDO); content jsonb (esquema del tipo), template_version; responsible_person_id, due_date; approved_by_person_id, approval_body_id, approved_at, `content_hash` (SHA-512 de servidor); policy_id, secretaria_artifact_id, evidence_item_id; retention_until; supersedes_id; created_by | RPC `fn_aims_guardar_entregable` / `fn_aims_aprobar_entregable` | APROBADO y SUSTITUIDO son inmutables. Único por (tenant, code, entity, sistema/modelo, rol, version). Sin firma, QES ni custodia EAD. |
| `aims_ria_deliverable_links` | tenant_id, deliverable_id, instance_id. PK compuesta | RPC | Un entregable puede cubrir varias instancias: logs cubre OB-14, OB-21 y OB-34 y cuenta una vez. |
| `aims_ria_designations` | id, tenant_id, system_id, entity_id, person_id; `function` CHECK (SUPERVISOR_HUMANO_26_2, USUARIO_AUTORIZADO, RESPONSABLE_TECNICO, PUNTO_CONTACTO_AUTORIDAD, EXTERNO_EN_SU_NOMBRE); competence, authority, support, scope; training_record_id → grc_training_records; valid_from, valid_to; designated_by | RPC `fn_aims_designar` | Población obligada del art. 4 y supervisores del 26.2. |
| `aims_ria_program_phases` | tenant_id, phase 1-5, target_date, continuous, set_by_body_id, decision_artifact_id, provenance. PK (tenant_id, phase) | RPC `fn_aims_fijar_programa` (AIMS_GOBIERNO) | Siembra inicial con las fechas del experto, marcada «Simulado». |
| `aims_monitoring_measurements` | id, tenant_id, indicator_id, observed_at, value numeric, value_json, source (MANUAL, DESPLEGADOR_72_2, INTEGRACION), evidence_item_id, recorded_by | RPC `fn_aims_registrar_medicion` | Solo anexión. `indicator_id` con ON DELETE RESTRICT. |
| `aims_technical_file_section_versions` | tenant_id, section_id, system_version_id, content, evidence_refs, reviewed_by_id, reviewed_at, content_hash | Trigger AFTER UPDATE | Historial de cada sección del expediente técnico. `section_id` y `system_version_id` con ON DELETE RESTRICT. |

**AIMS: columnas nuevas**

- `ai_systems`:
  - `inventory_kind` CHECK (SISTEMA_IA, CONTRATO_MODELO, HOJA_DE_RUTA, CANDIDATO), DEFAULT 'SISTEMA_IA';
  - `ai_definition_result` CHECK (ES_SISTEMA_IA, NO_ES_SISTEMA_IA, DUDOSO, PENDIENTE), DEFAULT 'PENDIENTE', con `ai_definition_screening jsonb`, `ai_definition_hash`, `screened_by`, `screened_at`;
  - `prohibited_practice_status` CHECK (SIN_ANALIZAR, SIN_INDICIOS, EN_ANALISIS, CONFIRMADA_CESE, CESADA);
  - `ai_policy_id → policies`;
  - `provider_third_party_id text` con FK compuesta (tenant_id, provider_third_party_id) → grc_third_parties.
  - El trigger `fn_ai_systems_clasificacion_solo_por_cuestionario` se amplía: el cribado y la práctica prohibida solo cambian por RPC.
- `ai_incidents`: `entity_id`, `subject_id`, `occurred_member_state char(2)` CHECK `^[A-Z]{2}$`, `ria_qualification` CHECK (PENDIENTE, NO_ES_GRAVE, GRAVE), `ria_serious_letters text[]`, `ria_qualification_motivation`, `qualified_by`, `qualified_at`. La calificación se escribe solo por RPC, con trigger de guardia (DS-32): hoy la tabla admite UPDATE directo (medido), y sin guardia un cliente marcaría NO_ES_GRAVE y detendría el reloj del art. 73.
- `ai_risk_assessments`: `questionnaire_id`, `subject_id`, `catalog_version`, `created_by DEFAULT auth.uid()`, `review_decision` CHECK (ACEPTA, REQUIERE_MEDIDAS, RECHAZA), `review_motivation`. Trigger BEFORE INSERT: `assessor_id := auth.uid()`, inmutable (cierra DA-15). `review_decision` y `review_motivation` con trigger de guardia (DS-32): el trigger de congelación actual deja escribir los campos de revisión (medido).
- `ai_compliance_checks`: `assessment_id → ai_risk_assessments` (anulable; las filas legacy quedan NULL) y `subject_id`. `checked_by_id` **ya existe** (medido: uuid, sin DEFAULT): M01 solo hace `ALTER COLUMN checked_by_id SET DEFAULT auth.uid()`.
- `aims_classification_questionnaires` (v2): `scope` CHECK (CRIBADO, SUJETO); `entity_id` (obligatorio si SUJETO); `phase0_responses`, `phase3_responses`; `facts jsonb` (re-derivados en servidor); `computed_roles text[]`; `annex_iii_points text[]`; `annex_i jsonb`; `art5_analysis jsonb`; `art63 jsonb`; `art50 jsonb`; `gpai jsonb`; `put_into_service_at`, `type_model_ref`, `significant_change jsonb`; `use_case_snapshot`, `description_snapshot`; `catalog_version`; `review_status` CHECK (PENDIENTE_REVISION, REVISADA, REQUIERE_CAMBIOS), `reviewed_by`, `reviewed_at`, `review_decision`, `review_motivation`. Índices únicos parciales por (system_id) WHERE scope = 'CRIBADO' y por (system_id, entity_id) WHERE scope = 'SUJETO', separados para COMPLETED y DRAFT. Hay 0 COMPLETED, así que el cambio es seguro. La inmutabilidad se amplía: los campos de revisión se escriben una sola vez y solo con el flag de la RPC.
- `aims_system_versions`: `change_class` CHECK (NINGUNO, PREDETERMINADO, SIGNIFICATIVO_111_2, MODIFICACION_SUSTANCIAL_43_4), `change_motivation`, `change_decided_by`, `change_consultation_artifact_id → secretaria_document_artifacts` (obligatorio si SIGNIFICATIVO_111_2, DS-38), `placed_on_market_at`, `put_into_service_at`, `type_model_ref`, `published_at`, `manifest_hash`, `retention_until`. Solo por RPC, con trigger de guardia (DS-32): hoy la UI escribe la tabla directamente (medido), y sin guardia un cliente marcaría NINGUNO y mantendría un sistema en LATENTE_111_2.
- `aims_technical_file_sections`: `subsection_code` (1.a-h, 2.a-h, 3-9), `edited_by DEFAULT auth.uid()`; `version_id` siempre. REVIEWED solo por RPC con revisor distinto del editor. SEALED y APPROVED dejan de ser alcanzables desde el cliente: trigger de guardia sobre `status` (DS-32), que deja pasar los estados de trabajo.
- `aims_monitoring_indicators`: `risk_id → risks` (de ahí sale el umbral). La vista `v_aims_indicator_status` deriva SIN_MEDICION, DENTRO_UMBRAL o UMBRAL_SUPERADO. La columna `status` (DEFAULT 'OK', medido) deja de leerse; las filas no se tocan.
- `aims_evidence_items`: el CHECK de `kind` añade CAPTURA y PRUEBA_ACCESIBILIDAD. Un trigger valida `links` con los tipos INSTANCIA, ENTREGABLE, SECCION, MEDIDA, INCIDENTE, REGISTRO y RIESGO, y referencias del mismo tenant. `evidentiary_posture` sigue siendo REFERENCE.

**AIMS: esquema muerto que se revive (8 tablas, sujeto a la decisión expresa D-U7)**

Reabrir la escritura de estas 8 tablas deroga en parte DA-9 y la frontera D-1 del 08-09, que las revocó a propósito. No se ejecuta sin D-U7 (F0.T1). Si D-U7 se deniega, M10, M15, M16, M17 y M20 se replantean con tablas nuevas y nada se escribe en las 8. En todas, las FK hacia `ai_systems`, `aims_incident_regimes`, `ai_incidents` y `entities` pasan de CASCADE a RESTRICT (RS-TABLA 9; medido CASCADE en todas).

| Tabla | Corrección antes de reabrir | Grants |
|---|---|---|
| `aims_model_registry` | `system_id` pasa a DROP NOT NULL, y la FK de ON DELETE CASCADE a RESTRICT (medido: NOT NULL). Columnas nuevas: `provider_third_party_id` (FK compuesta), `provider_entity_id`, `own_model`, `is_gpai`, `systemic_risk` (NO, PRESUNTO, DESIGNADO), `training_compute_flop`, `modified_fraction`, `open_source`, `placed_on_market_at`, `access_contract_system_id → ai_systems` (fila CONTRATO_MODELO), `annex_xii_received_at`, `annex_xii_evidence_id`, `excluded_by_policy jsonb` (p. ej. Gemini, PI-30 §3.1.1), `last_change_seen_at` | SELECT, INSERT, UPDATE con capacidad |
| `aims_component_inventory` | `system_id` a RESTRICT. `component_type` (MODELO, DATOS, HERRAMIENTA, SERVICIO, PROCESO), `model_id`, `third_party_id` (FK compuesta), `counterpart_entity_id → entities` (otra sociedad del grupo), `relation_kind` (SUMINISTRO_25_4, ENCARGO_RGPD_28, CONDICIONES_USO, ACUERDO_INTRAGRUPO), CHECK de que ACUERDO_INTRAGRUPO lleva `counterpart_entity_id` y no `third_party_id`, `agreement_status`, `agreement_evidence_id`, `agreement_min_content jsonb`, `clausulas_tipo_oficina`, `open_license_exception` (no alcanza a GPAI) | idem |
| `aims_dataset_registry` | `system_id` a RESTRICT. `split` (ENTRENAMIENTO, VALIDACION, PRUEBA, ENTRADA_26_4), `original_purpose` (10.2 b), `bias_examination`, `bias_measures` (10.2 f y g), `gaps` (10.2 h), `statistical_properties` (10.3), `context_characteristics` (10.4), `branch_10_6`, `special_categories_4bis`, `conditions_4bis jsonb`, `rat_ref`, `dpia_id → grc_dpias`; `version_id` siempre | idem |
| `aims_post_market_plans` | `system_id` a RESTRICT. `version`, `approved_body_id`, `deliverable_id`, `implementing_act_ref` (72.3), `next_review_at`. La fila de ARGA se lee sin tocarla | idem |
| `aims_regulatory_clocks` | `incident_regime_id` a RESTRICT. Los persiste `fn_aims_transicion_regimen`: clock_type (RIA_73_2, 73_3, 73_4, RGPD_33, DORA_*, CADENA_26_5), deadline_at, `exigible` bool, delay_justification | Solo por RPC |
| `aims_incident_reports` | `incident_regime_id` a RESTRICT (y, en la misma migración, `aims_incident_regimes.entity_id → entities` y `incident_id → ai_incidents` a RESTRICT). `report_type` (INICIAL_INCOMPLETO_73_5, COMPLETO, SEGUIMIENTO, COMUNICACION_CADENA, CLIENTE), `recipient_kind`, `recipient_ref`, `sent_at`, `canal`, `acknowledgment_ref`, `manifest_hash`. Constancia interna: no afirma envío real | Solo por RPC |
| `aims_fria_assessments` (solo la cabecera) | `system_id` a RESTRICT. `subject_id`, `entity_id`, `applicability_basis`, `template_version` (plantilla del art. 27.5), `sections jsonb` a)-f), incluida la **e)** que faltaba, `provider_fria_ref` (27.2), `dpia_id → grc_dpias` (27.4), `content_hash`, `frozen_at`, `frozen_by`, `reviewed_by` | Solo por RPC |
| `aims_fria_dpia_cross_references` | `fria_id` a RESTRICT. `dpia_id → grc_dpias`; `dpia_ref_id` queda como legado. La referencia marca la sección como «completada por la EIPD», nunca como cerrada (DS-37) | Solo por RPC |

Siguen muertas y sin escritura, con su dato intacto y sin DROP: `aims_fria_affected_groups`, `aims_fria_process_map`, `aims_fria_use_profile`, `aims_fria_fundamental_rights_risks`, `aims_fria_remediation_governance`, `aims_requirement_catalog` (4 filas ARGA), `aims_requirement_checks` (4), `aims_control_catalog` (2), `aims_control_tests`, `aims_evidence_packs`, `aims_incident_evidence_packs` y `aims_change_requests`. `src/test/aims/frontera-backbone.test.ts` pasa las 8 revividas a «vivas», con control positivo (un hook las lee y las escribe), y mantiene la ausencia para las 12.

**GRC (dueño; lo escribe el carril GRC)**

- `grc_modules`: fila `ai` en los dos tenants, con tenant_id explícito, `description` y `owner` NOT NULL y `route = '/ai-governance/programa'`.
- `fn_sync_obligation_to_backbone` (AFTER INSERT OR UPDATE sobre `obligations`). Medido: el `ELSE 'risk'` recibe 24 obligaciones, 21 de Garrigues (OBL-PBC-01 a 20 y OBL-PBC-EX-22: la rama escrita es `OBL-GARR-PBC-%`) y 3 de ARGA (OBL-LGPD-001, OBL-ORSA-001, OBL-SII-001). Las 21 están en `grc_obligations.module_id = 'risk'` en vez de 'aml', que existe en Garrigues: **defecto vivo, GC-138**. Cambios:
  - ramas `OBL-PBC-%` → 'aml' (F5.T14) y `OBL-RIA-%` → 'ai' (F5.T3);
  - el `ELSE 'risk'` **se conserva**: un RAISE haría fallar el UPDATE de las filas que caen ahí o abortaría la migración, contra la persistencia de Garrigues y el cero cambio de ARGA;
  - el segundo fallback (rama con nombre cuyo módulo no existe en el tenant → 'risk' en silencio) pasa a `RAISE` con ERRCODE; medido: ninguna fila lo usa hoy;
  - la verificación **lista** las filas del ELSE (exactamente las 3 de ARGA, deuda declarada del carril GRC) y no exige 0.
- `obligations`: columnas `aims_obligation_code`, `applicable_from date`, `applicability_status` CHECK (HOY, LATENTE, CONDICIONADA), todas anulables. `UNIQUE(tenant_id, code)`, después de medir duplicados: si los hay, la migración aborta y lo informa sin borrar.
- `risks`: columnas `ai_system_id`, `subject_id`, `harm_scale` CHECK (PERSONAS_DERECHOS, ORGANIZACION), `residual_probability`, `residual_impact`, `residual_rationale`, `measure_codes text[]`, `residual_accepted_artifact_id → secretaria_document_artifacts`, `harmonised_standard_ref`. `residual_score` no es generada (medido) y `useRisks.ts:119` hace `update(input)`: trigger de guardia (DS-32) sobre `residual_*`, `measure_codes`, `residual_accepted_artifact_id`, `harm_scale` y `ai_system_id` en las filas con sistema; solo lo escriben las RPC de riesgo IA. Las filas sin sistema (todas las de hoy) no cambian. `lecturaRiesgo` (`src/lib/grc/assessed-band.ts`) sigue siendo la única precedencia.
- `action_plans`:
  - `finding_id` pasa a anulable con `CHECK (finding_id IS NOT NULL OR obligation_id IS NOT NULL OR ai_obligation_instance_id IS NOT NULL)`;
  - columnas `obligation_id`, `ai_obligation_instance_id`, `ai_system_id`, `entity_id`, `source` CHECK (HALLAZGO, OBLIGACION_RIA, BRECHA_AIMS, ART5_CESE), `specialty`, `owner_body_id`;
  - trigger de guardia (DS-32): una fila con `source ≠ HALLAZGO` o con `ai_obligation_instance_id` solo nace o cambia por `fn_grc_crear_acciones_desde_aims` o `fn_grc_actualizar_accion`;
  - `tenant_id SET NOT NULL` (medido: sin DEFAULT y sin nulos).
- Privilegios (GC-140, medido): `authenticated` tiene DELETE, TRUNCATE, TRIGGER y REFERENCES sobre `risks` y `action_plans`; TRUNCATE no pasa por RLS. M14 y la migración de F5.T7 revocan TRUNCATE, TRIGGER y REFERENCES con control positivo. DELETE se declara: la aplicación no borra (medido), pero retirarlo lo decide GRC.
- `findings`: `code` es UNIQUE global (medido). La RPC `fn_grc_registrar_hallazgo_ia` pone delante del código el prefijo del tenant.
- `grc_third_parties`: `legal_entity_name`, `country` (ISO2), `eu_representative`, `is_ai_supplier`, `ai_roles text[]`.
- Tablas nuevas (RS-TABLA):
  - `grc_ai_links`: tenant_id, `grc_kind` (CONTROL, OBLIGATION, RISK, FINDING), `grc_id`, `ai_system_id`, `aims_measure_code`, `ai_incident_id`, `policy_clause`, `relation` (MITIGA, CUMPLE, RESTRINGE, NOTIFICA_SEGUN), `rationale`, `created_by`. Escritura por `fn_grc_vincular_ia`.
  - `grc_training_records`: tenant_id, control_id, person_id, entity_id, system_id, content_version, deliverable_ref, completed_at, evidence_ref. Escritura por `fn_grc_registrar_formacion`.
  - `grc_dpias`: tenant_id, code, `entity_id NOT NULL` (responsable del tratamiento), `controller_role` (RESPONSABLE, CORRESPONSABLE, ENCARGADO), ai_system_id, processing_description, `necessity_criteria jsonb` (35.1, 35.3 a-c, lista AEPD), `necessity_result` (REQUERIDA, NO_REQUERIDA_MOTIVADA, PENDIENTE), `necessity_rationale`, `dpo_person_id`, `dpo_consulted_at`, `dpo_opinion` (35.2), `prior_consultation_required`, `prior_consultation_at` (36), result, residual_high, `instructions_record_id` (26.9), `rat_ref`, status, approved_by_body_id, approved_at, next_review_date, content_hash. Sin DELETE. Escritura por `fn_grc_registrar_eipd`.

**Secretaría (dueño)**

- Sin columnas nuevas. Se reutiliza `artifact_kind = 'INFORME_PRECEPTIVO'`; medido: `source_domain` no tiene CHECK y usa minúsculas (`agreement`, `certification`, `condiciones_persona`, `mandatory_books`, `registry_filing`).
- **Endurecimiento del ancla probatoria (GC-139).** Medido: política de escritura FOR ALL (admite UPDATE y DELETE), solo el trigger `updated_at`, y todos los grants para `anon` y `authenticated`, TRUNCATE incluido. En F5.T13: inmutabilidad y BEFORE DELETE para `source_domain = 'ai_system'` desde APPROVED, SIGNED, ARCHIVED o SUPERSEDED (otros dominios siguen actualizando estado: `useSecretariaDocumentArtifacts.ts:539`, `standalone-certifications/document.ts:247`); `REVOKE ALL FROM anon`; `REVOKE TRUNCATE, TRIGGER, REFERENCES FROM authenticated`; control positivo.
- RPC nueva `fn_secretaria_registrar_dictamen_ia(p_system_id, p_entity_id, p_body_id, p_asunto, p_contenido, p_decisor_person_id)`.
  - Asuntos: CLASIFICACION, ACEPTACION_RESIDUAL, USO_EXTRAORDINARIO_PI30, VALIDACION_CATALOGO, CADENCIA_REVISION, CESE_ART5, ORGANO_IA, CAMBIO_SIGNIFICATIVO_111_2 (DS-38), SECRETO_PROFESIONAL (DS-40) y ACUERDO_INTRAGRUPO (DS-39).
  - `source_domain = 'ai_system'` (convenio en minúsculas de la tabla), `source_id = system_id`.
  - Valida: el órgano es del tenant, el autor es miembro vigente y el decisor tiene un cargo vigente en `condiciones_persona`.
  - Índice nuevo `(tenant_id, source_domain, source_id)`.

**Entidades, Órganos, Personas, Políticas**

- Solo lectura desde AIMS.
- Siembras aditivas de su dueño, que solo rellenan NULL: `entities.address` y los campos de dirección de las sociedades candidatas, `entities.country` de ARGA a partir de `jurisdiction`, `entities.regulated_sector` de las aseguradoras de ARGA (la columna existe, medido) y `policies.owner_body_id` de PR-024 tras D-U2, sin tocar su estado Draft.

**Funciones SQL**

- Transversales:
  - `fn_aims_fk_misma_tenant()` (trigger con TG_ARGV);
  - `fn_aims_entidad_puede_ser_sujeto(entity_id)`, espejo de `sujeto-juridico.ts`;
  - `fn_aims_assert_capacidad(p_action)`, que envuelve `fn_secretaria_assert_capability(fn_current_tenant_id(), p_action)` y relanza su excepción con ERRCODE `42501` y `AIMS_CAPACIDAD_DENEGADA` (DS-11);
  - `fn_aims_estado_organizacion(p_cobertura, p_entregables_completos)` (IMMUTABLE), espejo SQL de `estado-organizacion.ts` (DS-07); la sincronización le pasa la cobertura calculada con la misma regla que `obligationCoverage`;
  - `fn_aims_suprimir_datos_registro(p_record_id, p_motivo)` (DS-33);
  - `fn_aims_tiene_capacidad(p_action)` (STABLE SECURITY DEFINER, para políticas);
  - `fn_aims_es_miembro_organo(p_body_id)`, que comprueba `user_profiles.person_id` ∈ `condiciones_persona` vigentes del órgano.
- Derivación, IMMUTABLE o STABLE y sin SECURITY DEFINER: `fn_aims_eval_predicado(pred, hechos)`, `fn_aims_derivar_hechos_v2`, `fn_aims_derivar_roles_v2`, `fn_aims_derivar_nivel_v2`, `fn_aims_derivar_ambito_v2`, `fn_aims_obligaciones_aplicables(hechos, roles, catalog_version)` y `fn_aims_marcos_desde_catalogo`.
- RPC de AIMS: `fn_aims_cribar_sistema`, `fn_aims_alta_sistema`, `fn_aims_completar_cuestionario_v2`, `fn_aims_revisar_clasificacion`, `fn_aims_proponer_sujeto`, `fn_aims_confirmar_sujeto`, `fn_aims_review_assessment` (v2), `fn_aims_freeze_assessment` (ampliada), `fn_aims_sincronizar_obligaciones`, `fn_aims_actualizar_obligacion`, `fn_aims_guardar_entregable`, `fn_aims_aprobar_entregable`, `fn_aims_anotar_registro`, `fn_aims_designar`, `fn_aims_declarar_especialidad`, `fn_aims_fijar_programa`, `fn_aims_fijar_cadencia`, `fn_aims_calificar_incidente`, `fn_aims_abrir_regimen`, `fn_aims_transicion_regimen`, `fn_aims_registrar_medicion`, `fn_aims_guardar_eidf`, `fn_aims_congelar_eidf`, `fn_aims_registrar_version`, `fn_aims_publicar_version` y `fn_aims_revisar_seccion`. Todas asiertan tenant y capacidad y comprueban que vuelve fila.
- Funciones v1 retiradas (DS-29): `fn_aims_completar_cuestionario(uuid)`, `fn_aims_derivar_rol(jsonb)` y `fn_aims_derivar_nivel(jsonb)` pierden EXECUTE para authenticated en M08; `fn_aims_registrar_sistema` pasa a alias de `fn_aims_alta_sistema` que solo acepta payload v2.
- RPC de GRC: `fn_grc_alta_obligacion_organizacion_ria`, `fn_grc_registrar_formacion`, `fn_grc_crear_acciones_desde_aims`, `fn_grc_actualizar_accion`, `fn_grc_registrar_hallazgo_ia`, `fn_grc_vincular_ia`, `fn_grc_registrar_eipd`, `fn_grc_proponer_riesgo_ia`, `fn_grc_evaluar_riesgo_ia` y `fn_grc_aceptar_residual`.

**Vistas (`security_invoker = on`, solo SELECT para authenticated, anon fuera)**

- `v_aims_sistemas_por_entidad`: la lee EntidadDetalle.
- `v_aims_sistemas_por_organo`: la lee OrganoDetalle.
- `v_aims_registro_cumplimiento`: instancias ⨝ catálogo ⨝ entregables ⨝ sujeto ⨝ entidad. La leen el programa, la exportación y la Consola TGMS.
- `v_aims_indicator_status`.
- Quien la consulte comprueba antes `isModuleEnabled(branding, 'ai-governance')` y, si no está habilitado, degrada a «sin datos de IA».

### 2.3 Fronteras y contratos

Documento `docs/superpowers/specs/2026-09-xx-contrato-aims-grc-secretaria-ria.md` (F5.T2). Cada cláusula tiene su gate.

- **C-01 Lectura hacia fuera.** AIMS tiene FK anulables y lee `entities`, `persons`, `governing_bodies`, `policies`, `obligations`, `controls`, `risks`, `findings`, `action_plans`, `grc_third_parties`, `grc_dpias`, `grc_training_records`, `grc_ai_links` y `secretaria_document_artifacts`. No escribe en ninguna.
- **C-02 Lista blanca de RPC ajenas que AIMS puede llamar (5).** Son las únicas escrituras cruzadas:
  - `fn_grc_alta_obligacion_organizacion_ria`: idempotente por código y falla cerrado si no hay órgano acreditado;
  - `fn_grc_crear_acciones_desde_aims`: al congelar;
  - `fn_grc_actualizar_accion`: desde la pestaña Acciones de la ficha;
  - `fn_grc_registrar_hallazgo_ia`: positivo del art. 5 o no conformidad del art. 20;
  - `fn_grc_proponer_riesgo_ia`: crea el riesgo abierto, que el propietario de GRC evalúa.
- **C-03 Obligaciones de organización.** La fila canónica vive en GRC `obligations` (OBL-RIA-*), con órgano y política. La instancia de AIMS de ámbito ORGANIZACION apunta a ella (`grc_obligation_id`) y su estado sale de la regla única de DS-07: cobertura leída con `obligationCoverage` más entregables aprobados. No hay estado manual en AIMS ni mapa propio de estados de control. Una sonda de paridad pone rojo con el mensaje «re-sincronizar», nunca «borrar».
- **C-04 Riesgo.** El riesgo RIA de un sistema vive en `risks` (`ai_system_id`, `harm_scale = PERSONAS_DERECHOS`). La escala 5×5 de organización se conserva para el resto. Las dos perspectivas se declaran en pantalla y Risk360 no las suma.
- **C-05 Acciones.** Viven en `action_plans`. AIMS las crea y actualiza solo por C-02. El jsonb del plan congelado queda como instantánea.
- **C-06 Dictamen y decisión.** Los escribe Secretaría. AIMS navega a `/secretaria/informes?ai_system=&entity=&body=&asunto=` y referencia el artefacto. La aceptación del residual, el uso extraordinario de PI-30 §3.2 d) y la clase SIGNIFICATIVO_111_2 exigen esa referencia, y el artefacto referenciado es inmutable desde APPROVED (GC-139).
- **C-07 Traspasos.** Rutas de solo lectura con ids: `system`, `subject`, `assessment`, `incident`, `entity`, `body` y `materia`. El destino vuelve a verificar la pertenencia al tenant. Si la URL trae `entity`, nunca se toma la guardada en localStorage. La CTA solo aparece si `isModuleEnabled(destino)`.
- **C-08 Espejo.** GRC y Secretaría no escriben `ai_*` ni `aims_*`. Nadie escribe `governance_module_*`.
- **Gate `src/test/aims/frontera-modulos.test.ts`** (G-FRONTERA). Dos escaneos:
  - TS: falla si `src/lib/aims`, `src/hooks/useAi*`, `src/hooks/useAims*` o `src/components/ai-governance` hacen `.insert/.update/.upsert/.delete` sobre tablas de otro dueño, o llaman a una RPC ajena fuera de la lista;
  - SQL: en `supabase/migrations/*aims*`, dentro de cualquier función `fn_aims_*`, falla un `INSERT`, `UPDATE` o `DELETE` sobre una tabla de otro dueño o una llamada `fn_grc_*`/`fn_secretaria_*` fuera de C-02 (las escrituras cruzadas relevantes ocurren en SQL: `fn_aims_sincronizar_obligaciones` y `fn_aims_freeze_assessment` llaman a GRC). Se toma la última definición de cada función.
  - Control positivo en los dos: un fichero TS señuelo y una migración señuelo en `src/test/aims/fixtures/` que el guard tiene que detectar. Hay un espejo en GRC y en Secretaría para `ai_*` y `aims_*`.

---

## 3. Cuestionario v2

### 3.1 Estructura

- `CUESTIONARIO_VERSION = '2.0'`.
- Hojas: `src/lib/aims/cribado.ts` (S0) y `src/lib/aims/hechos-ria.ts` (S1-S10), sin React. `cuestionario-calificacion.ts` conserva sus exportaciones usadas (`tieneClasificacionGuiada`, `ETIQUETA_PERFIL`) como envolturas.
- Las respuestas son hechos tipados (enumerado, lista, fecha), no booleanos sueltos. Cualquier respuesta admite `NO_DETERMINADO`:
  - en S1-S6 bloquea la confirmación, porque determina rol, nivel o ámbito;
  - en S7-S10 deja DEPENDE las instancias que dependan de ella.
- Las ayudas van revisadas por Legal y validadas por Harvey. No dicen «SOLO si» ni «ante la duda, No».
- Componentes: uno por sección en `src/components/ai-governance/clasificacion/`, de 400 líneas como máximo.

| Sección | Ámbito | Preguntas (código estable) | Hechos que produce |
|---|---|---|---|
| S0 Cribado art. 3.1 | Sistema, una vez | C0_1 sistema basado en máquina con autonomía; C0_2 infiere, a partir de la entrada, cómo generar salidas; C0_3 las salidas influyen en entornos físicos o virtuales; C0_4 exclusiones de las Directrices C(2025) 924 (optimización matemática, tratamiento básico de datos, heurística clásica, predicción simple, regresión sin inferencia adaptativa), con motivo; C0_5 adaptabilidad («puede»: no es condición). No se ofrece a CONTRATO_MODELO ni a HOJA_DE_RUTA | `ai_definition_result` ES, NO_ES (motivo de 40 caracteres o más, autor y fecha, sellado) o DUDOSO (va a Legal). NO_ES conserva la fila y la saca de los recuentos |
| S1 Ámbito art. 2 | Sujeto | A_1 establecimiento del titular, derivado de la persona jurídica (una oficina o sucursal hereda el de su titular) y editable con motivo; A_2 si el titular está fuera de la UE, ¿la salida se usa en la Unión? (2.1 c); A_3 supuestos 2.1 d)-f); A_4 exclusiones 2.3, 2.4, 2.6, 2.8, 2.10, 2.12 y 2.13 (esta, PENDIENTE_LEGAL hasta DS-27), cada una con motivo | `scope_result`, `scope_basis` |
| S2 Roles | Sujeto | R_1 la sociedad desarrolla el sistema o lo hace desarrollar; R_2 lo introduce o lo pone en servicio con su nombre o marca, incluido el uso propio (3.11); R_3 lo usa bajo su autoridad en actividad profesional (3.4); R_4 lo introduce en la UE con nombre o marca de alguien de un tercer país (3.6); R_5 lo comercializa sin ser proveedor ni importador (3.7); R_6 tiene mandato escrito de un proveedor de un tercer país (3.5); R_7 integra un modelo de uso general, propio o ajeno (3.68); R_8a pone su marca en un sistema de alto riesgo ya comercializado, con R_8a_pacto (acuerdo que reparte las obligaciones de otro modo; se anota, no excluye la conversión, §3.2); R_8b modificación sustancial (3.23), con ayuda que nombra el ajuste fino (fine-tuning) de un sistema de un tercero (RH-4); R_8c finalidad que le da la sociedad frente a la prevista por el proveedor, con selector de punto del anexo III (ayuda nueva: «tal como lo entregó» no excluye el cambio de finalidad); R_9 el proveedor inicial excluyó la transformación (25.2) | Conjunto de roles (§3.2) |
| S3 Art. 5 | Sujeto | P5_a, b, bbis, bter, c, d, e, f, g, h: {SI, NO, A_ANALIZAR, motivo, usos excluidos por política (policy_id y apartado), autor}. Al proveedor se le pregunta por los usos posibles razonablemente previsibles (OB-02); al responsable del despliegue, por su uso. b bis y b ter (desde el 2-12-2026) con alcance del 5.1 bis: el proveedor responde si es la finalidad prevista o un resultado previsible y reproducible sin salvaguardias razonables, y las describe; el responsable del despliegue, si lo usa con ese fin. La h) solo cubre fines de garantía del cumplimiento del Derecho; la biometría privada remite al anexo III 1 a). La c) no exige intención. P5_autoridad_garante abre el 5.2-5.4 | `art5_analysis` |
| S4 Anexo I (6.1) | Sujeto | AI_1 sección A o B, legislación, componente de seguridad o producto, evaluación por tercero. Aplicación desde el 2-8-2028. La sección B con el régimen del art. 2.2 | `annex_i` |
| S5 Anexo III | Sujeto | AIII: selector múltiple 1 a/b/c, 2, 3 a-d, 4 a-b, 5 a-d, 6 a-e, 7 a-d, 8 a-b o NINGUNO; AIII_perfilado (art. 4.4 RGPD), obligatorio si hay algún punto | `annex_iii_points`, `profiling` |
| S6 Art. 6.3 | Sujeto | Solo si hay rol PROVEEDOR y algún punto: E63_condicion a)-d) y motivación de 40 caracteres o más. Al RESPONSABLE_DESPLIEGUE se le pide E63_ref_proveedor (clasificación y referencia de registro del proveedor, con evidencia), que **sí alimenta la derivación del nivel** (§3.2). Sin el ejemplo del scoring | `art63` |
| S7 Art. 50 | Sujeto | T50_1 interactúa directamente con personas físicas (superficies: canal, público interno o externo; excepción «resulta evidente», motivada); T50_2 genera audio, imagen, vídeo o texto sintético (tipo; edición estándar o sin alteración sustancial; aportación del modelo; ¿introducido antes del 2-8-2026?); T50_3 reconocimiento de emociones o categorización biométrica; T50_4a ultrasuplantación de imagen, audio o vídeo (excepción creativa o satírica atenuada, o penal); T50_4b texto publicado para informar al público (excepción de revisión humana o control editorial con responsabilidad editorial) | `art50` |
| S8 Hechos de despliegue | Sujeto | H_trabajo y sociedad empleadora (26.7, anexo III 4); H_decisiones (sobre personas físicas, efectos jurídicos o análogos: 26.11, 86); H_autoridad_publica y H_servicio_publico, dos hechos separados (26.8 y 49.3 solo la primera; 27.1 las dos); H_datos_personales y criterios 35.3 / lista AEPD; H_cat_especiales_sesgo (4 bis); H_control_entrada (26.4); H_logs_bajo_control (19, 26.6); H_aprendizaje_continuo (15.4 p. 3); H_consumidores; H_sandbox y H_pruebas_reales (voluntarios). La condición de entidad financiera se deriva de `entities.regulated_sector` y se puede editar con motivo | `facts` |
| S9 Uso general | Sujeto | G_1 integra un modelo de uso general (cuál: fila del registro de modelos); G_2 la sociedad entrena o modifica (incluido el ajuste fino, RH-4) un modelo por encima del umbral indicativo de las directrices de la Comisión (10^23 FLOP; un tercio del cómputo original, pendiente de H-09); si es así, crea un sujeto sobre el MODELO con rol PROVEEDOR_GPAI; G_3 cómputo de 10^25 FLOP o más, o designación (51); G_4 licencia libre (53.2); G_5 introducido antes del 2-8-2025 (111.3); G_6 establecido fuera de la UE (54) | `gpai` |
| S10 Fechas y cambio | Sujeto | F_1 fecha de introducción en el mercado o puesta en servicio del tipo y modelo (considerando 39); F_2 ¿cambio significativo de diseño desde la fecha de aplicación del cap. III? (111.2): la respuesta SI exige la referencia del dictamen de consulta interna (DS-38) y la ayuda advierte que no equivale a la modificación sustancial del 3.23; F_3 versión de referencia | `put_into_service_at`, `significant_change` |

### 3.2 Derivación (hoja y espejo SQL idénticos)

- **Roles.**
  - `PROVEEDOR ⇐ R_1 ∧ R_2` (art. 3.3, conjuntivo; se descarta la disyunción).
  - `RESPONSABLE_DESPLIEGUE ⇐ R_3`, que se acumula con el anterior.
  - `PROVEEDOR_POSTERIOR ⇐ PROVEEDOR ∧ R_7`.
  - `IMPORTADOR ⇐ R_4`, `DISTRIBUIDOR ⇐ R_5` y `REPRESENTANTE_AUTORIZADO ⇐ R_6`: el sujeto queda PENDIENTE_LEGAL y la confirmación se detiene hasta `fn_aims_confirmar_sujeto`.
  - Conversión del art. 25.1: si ¬PROVEEDOR ∧ (R_8a ∨ R_8b ∨ R_8c) ∧ nivel resultante = Alto, entonces PROVEEDOR con base 25.1.x. Si el nivel no es Alto, no convierte.
  - El pacto del 25.1 a) (R_8a_pacto) **no excluye** la conversión: el texto dice «sin perjuicio de los acuerdos contractuales que estipulen que las obligaciones se asignan de otro modo», y es discutible que el pacto evite la condición de proveedor frente a la autoridad y no solo reparta obligaciones entre las partes. Se deriva PROVEEDOR con base 25.1.a y el pacto se anota como reparto de obligaciones (items de la instancia). Es criterio TGMS a validar (H-02).
- **Nivel.** Se calcula antes que la conversión del 25.
  - `Inaceptable` si alguna letra del art. 5 es SI dentro de su alcance por rol.
  - `Alto` si hay anexo I, o algún punto del anexo III sin una excepción 6.3 válida.
  - Excepción 6.3 hecha por el propio sujeto: válida solo si ⇐ PROVEEDOR ∧ condición a)-d) ∧ ¬perfilado ∧ motivación (6.4).
  - Excepción 6.3 hecha por el proveedor, para un sujeto que solo es RESPONSABLE_DESPLIEGUE: si hay E63_ref_proveedor con evidencia y ¬perfilado, el nivel **no es Alto** sin más. Hasta que H-02 lo valide, el sujeto queda PENDIENTE_LEGAL con el nivel rotulado «no alto riesgo según el proveedor (6.3/49.2), pendiente de validación» y las obligaciones del capítulo III en DEPENDE; con veredicto CORRECTO, el nivel se deriva de los demás hechos con base «6.3 según el proveedor». Sin referencia, o con perfilado, Alto.
  - `Limitado` si no es Alto y concurre algún supuesto del art. 50. `Mínimo` en otro caso.
  - Las obligaciones del art. 50 se derivan aparte y se acumulan a Alto (50.6).
- **Ámbito.** EN_AMBITO si el titular está establecido en la UE, o si concurre 2.1 c) o 2.1 d)-f), y no hay ninguna exclusión.
- **Marcos.** Son la proyección, agrupada por artículo, de las obligaciones aplicables del catálogo (`fn_aims_marcos_desde_catalogo`). No hay lista escrita a mano. El capítulo V solo aparece con un sujeto PROVEEDOR_GPAI.

### 3.3 Servidor que re-deriva todo

`fn_aims_completar_cuestionario_v2(p_id)` sigue este orden (la v1 ya no es ejecutable, DS-29):
1. Asierta tenant y `AIMS_CLASIFICAR`.
2. Exige un cribado COMPLETED con resultado ES_SISTEMA_IA y un responsable interno (por defecto, `ai_systems.owner_id`). Si falta, `RESPONSABLE_OBLIGATORIO`.
3. Re-deriva hechos, roles, nivel, ámbito, puntos y marcos desde el catálogo publicado. Si lo que manda el cliente difiere, `CLASIFICACION_INCOHERENTE`. También rechaza `ART63_PERFILADO` y `ART63_NO_PROVEEDOR`.
4. Sella con SHA-512 sobre respuestas, hechos, marcos del servidor, `use_case_snapshot`, `description_snapshot` y `catalog_version`.
5. Alta de `aims_ria_subjects`: una fila por rol en estado PROPUESTO o PENDIENTE_LEGAL. Los roles que dejan de derivarse se cierran con `valid_to`. Si existe una fila SIEMBRA_HIPOTESIS para el mismo (sistema, sociedad, rol), se cierra y la nueva la referencia en `provenance.sustituye` (DS-34); nunca se hace UPDATE de `derivation` ni de `questionnaire_id` sobre la fila sembrada.
6. Actualiza el resumen en `ai_systems`: `regulatory_role` = rol principal (PROVEEDOR > RESPONSABLE_DESPLIEGUE > resto), `risk_level` = nivel máximo, y `regulatory_profile.sujetos[]` con `nivel_declarado_previo` la primera vez.
7. Un positivo del art. 5 no revierte: el nivel queda Inaceptable, `prohibited_practice_status = CONFIRMADA_CESE` y se anota un registro HALLAZGO_ART5 (§5.8).
8. Llama a `fn_aims_sincronizar_obligaciones` (desde F6).

Después, `fn_aims_revisar_clasificacion` aplica el control a cuatro ojos: el revisor es distinto de quien completó, es miembro vigente del órgano de IA y la decisión es explícita. Si la decisión es CONFIRMA, el sujeto pasa de PROPUESTO a VIGENTE.

**Sonda viva** (`src/test/schema/aims-cuestionario-live.test.ts`, reescrita en F4.T7 como G-VIVO-NEG): compara SQL y TS caso a caso, con al menos 30 casos, llamando solo a las funciones IMMUTABLE de derivación (`fn_aims_derivar_*_v2`), que no escriben. Los caminos negativos de la RPC (incoherencia, perfilado, falta de responsable) se prueban sin que aterrice ninguna fila. El camino positivo (completar, sujetos creados, hipótesis cerrada) va en sonda revertida G-VIVO-REV. Casos obligatorios:
- doble rol en uso propio;
- filial tecnológica que solo desarrolla (no es proveedora);
- 25.1 c) solo si el resultado es Alto;
- 25.1 a) con pacto: PROVEEDOR con el pacto anotado;
- 6.3 con perfilado, rechazado;
- responsable del despliegue con E63_ref_proveedor y sin perfilado (PENDIENTE_LEGAL hasta H-02), y sin referencia (Alto);
- art. 50 junto con Alto;
- b bis con salvaguardias, como proveedor y como responsable del despliegue;
- importador en PENDIENTE_LEGAL;
- cribado negativo;
- fuera de ámbito por el 2.8;
- filial fuera de la UE con salida usada en la Unión;
- GPAI proveedor frente a mera dependencia;
- `NO_DETERMINADO` en S5, que bloquea.

---

## 4. Catálogo de obligaciones del experto

### 4.1 Fuente y forma

- Fuente única: `src/lib/aims/ria/obligaciones/*.ts`, un fichero por bloque y cada uno de 400 líneas como máximo. Se completa con `entregables.ts`, `predicados.ts` y `exigibilidad.ts`. `CATALOGO_RIA_VERSION` con formato `2026-10.1`.
- Lo genera un script determinista, `scripts/aims/generar-catalogo-ria.ts`, a partir de `docs/legal/experto-ria/obligaciones.json` y `entregables_html.json`, copiados desde el material del experto. Después, Legal cura a mano, en PR, el predicado, la cita, los roles, el ámbito, la exigibilidad y las discrepancias.
- Se publica en `aims_ria_obligation_catalog` y `aims_ria_deliverable_catalog` mediante una migración generada desde el TS, solo por anexión y versionada. La sonda `src/test/schema/catalogo-ria-cloud.test.ts` compara TS y Cloud en cada corrida. Si difieren, el mensaje pide regenerar la migración, nunca editar Cloud.

### 4.2 Campos por fila

- **Capa experto (literal e intacta):** tema, fase, citaExperto, rolPrincipalExperto, rolesImplicadosExperto, tipoSistemaExperto, naturaleza y entregable.
- **Capa canónica:**
  - `code`: OB-01…OB-65, OB-38a/OB-38b y OB-T01… para las añadidas. OB-18 no se parte (DS-10);
  - `origen`: EXPERTO_BASE (59), EXPERTO_COMPLETITUD (6) o TGMS_AÑADIDO;
  - `citaTexto`, con la numeración final tras el 2026/1744;
  - `ambito`: ORGANIZACION, SISTEMA o MODELO;
  - `rolesObligados` según el texto;
  - `predicado` en DSL, por rol y no por tipo;
  - `exigibilidad`;
  - `caracter` y `especialidades` (Jurídico, Técnico, Riesgos, Ciberseguridad, Datos);
  - `fase` y `continua`;
  - `entregables` (d-ids) e `items` por subapartado;
  - `discrepancia`;
  - `textoVerificado` {version, fecha, fuente EUR-Lex, por}, obligatorio;
  - `validacion` {harvey, experto, legal}.
- `textoVerificado` **no** se comprueba con `src/test/garrigues/cita-verificable.ts`: ese helper solo verifica citas a documentos normativos internos contra `NORMATIVO_CATALOG` y devuelve `null` para cualquier otra («ahí este comprobador no opina», medido), así que el gate solo miraría metadatos. Se congela en el repo el índice de artículo, apartado y letra del RIA consolidado a 27-07-2026 (CELEX 02024R1689-20260727), extraído del texto oficial, y un verificador propio (`src/lib/aims/ria/cita-ria.ts`) falla si `citaTexto` apunta a un apartado o letra inexistente (F3.T8).

### 4.3 Predicados y exigibilidad

- DSL: `{todos:[]} | {alguno:[]} | {no:P} | {hecho:H, en:[…]} | {hecho:H, es:v} | {siempre:true}`, evaluado con lógica de Kleene. El vocabulario de hechos es el de §3.1. Un predicado que usa un hecho inexistente pone el test en rojo.
- Calendario:
  - capítulos I y II: 2-2-2025;
  - art. 5.1 b bis) y b ter), 5.1 bis y 5.1 ter: 2-12-2026;
  - art. 50: 2-8-2026; el 50.2, por el 111.4, 2-12-2026 para lo introducido antes del 2-8-2026 (validado por Harvey, RH-6);
  - capítulo V: 2-8-2025, con el 111.3 para modelos anteriores;
  - capítulo III, secciones 1 a 3: 2-12-2027 (anexo III) y 2-8-2028 (anexo I), con el 111.2;
  - deberes conexos del alto riesgo fuera del capítulo III (arts. 71, 72, 73, 74 y 86): heredan la fecha del anexo que clasifica y la latencia del 111.2 (DS-35, criterio TGMS a validar en H-08). El art. 26.5 ya está en el capítulo III, sección 3, y el 49 en la sección 5;
  - espacios de pruebas: 57.1 pendiente de verificar (DS-27);
  - sección 5: PENDIENTE_LEGAL;
  - art. 4 bis: según Harvey, aplicable desde el 27-7-2026 (considerando 9 del 2026/1744, RH-3). Queda PENDIENTE_LEGAL hasta el cotejo literal de F0.T2, con alarma ámbar si `H_cat_especiales_sesgo = SI`;
  - RGPD: en vigor.
- Estados:
  - EXIGIBLE;
  - EXIGIBLE_DESDE(fecha);
  - LATENTE_111_2: sistema de alto riesgo puesto en servicio antes de la fecha de aplicación del cap. III y sin cambio significativo posterior;
  - CONDICIONADA: el hecho que la activa no consta;
  - OPCIONAL: espacio de pruebas y pruebas reales;
  - PENDIENTE_LEGAL.

### 4.4 Entregables

- Tipos:
  - los 76 del HTML, con fase, cita y especialidad literales;
  - los 6 «Añadido (completitud)» como D-A1…D-A6: EIPD y arts. 43, 47, 48, 53.1 c y 55;
  - los añadidos TGMS (D-T*): 6.4, logs único, recepción del anexo XII, mandato del 22/54, plan de sandbox y de pruebas reales.
- d42 es el canónico y d43 y d44 son alias: el experto da el mismo título («Protocolo de despliegue de sistema de IA») a OB-31 (26.1), OB-32 (26.2) y OB-33 (26.4). Es un único documento con secciones por apartado; las del 26.2 y el 26.4 son secciones de d42, no plantillas distintas (F8.T11). Se confirma con el experto (F0.T4). d59 y d60 son subentregables de su padre. El denominador está deduplicado.
- Cada tipo tiene esquema Zod (`src/lib/aims/ria/entregables-esquemas.ts`), `campos_requeridos` comprobados en servidor al aprobar, y plantilla Handlebars generable con `src/lib/doc-gen`. Para los tipos sin plantilla específica, F6.T14 genera desde `entregables.ts` un esquema mínimo (campos de las letras del precepto) y una plantilla genérica. Un test exige esquema para cada d-id requerido por alguna fila; `fn_aims_aprobar_entregable` rechaza TIPO_SIN_ESQUEMA. Mapeos corregidos: d76 es el entregable del art. 86 (OB-65) y d56 («Información», art. 50) entra en el paquete del art. 50.

### 4.5 Discrepancias con el texto (se implementa el texto; chip A_VALIDAR_EXPERTO)

| Fila | Experto | Implementado conforme al texto | Harvey |
|---|---|---|---|
| OB-43 | 50.2 al distribuidor | Al PROVEEDOR. Se añade una fila del art. 50.4, párrafo primero, para el responsable del despliegue. Recuento: Proveedor 28, Distribuidor 3 | Validado (C1) |
| OB-12 | «Art. 10.4.f)» | Art. 4 bis.1 f), antes 10.5 f). Régimen habilitante que el 4 bis.2 extiende a los responsables del despliegue y que **obliga a documentar las razones de la necesidad estricta en el registro de ese tratamiento**; no es un deber general de actualizar el registro del art. 30 RGPD | Validado con matiz (C2), aplicado |
| OB-56 | Alto riesgo y no alto riesgo | Solo alto riesgo del anexo III, salvo el punto 2 (49.3). Lo rebajado por el 6.3 es del proveedor (49.2) | Validado (C3) |
| OB-22 | Proveedor / Despliegue | Proveedor (20). El responsable del despliegue remite a OB-58 (26.5) | Validado (C4) |
| OB-27 | 23.6 | 23.7 | H-03 |
| OB-24 | Etiqueta del proveedor | Identificación del importador (23.3) | H-03 |
| OB-64 | Arts. 91 y 92, proveedor | 74.12-14 y 21; los 91.5 y 92.5 como deber del proveedor GPAI | 74.6 validado (C16); el resto, H-03 |
| OB-55/56 | 71.2 y 71.3 | Art. 49, además del 71 (se conserva la cita del experto y se añade la del texto) | H-03 |
| Fases E6 | 6.3 | 6.4 | H-03 |
| OB-01 | Art. 2 | Arts. 2 y 3.1 | H-03 |
| OB-03 | Proveedor / Despliegue | NO_APLICA por defecto, salvo H: autoridad garante. Se añade el 5.3 | H-09 |
| OB-37 | «sector público, Anexo III.5(b)(c)» | Predicado DS-21 | Validado (C6) |
| OB-38 | Una fila | OB-38a (art. 35 RGPD, todo tratamiento de alto riesgo, exigible hoy en los dos tenants) y OB-38b (puente del 26.9, solo alto riesgo RIA) | Validado (C5) |
| OB-47 a 51 | Tipo «uso general» | Rol PROVEEDOR_GPAI | Validado (C17) |
| OB-07 | Tipo alto riesgo | Incluye uso general y riesgo limitado como base del 25.1 c) | H-02 |
| «% avance» de las obligaciones continuas | Métrica única de avance | «Avance documental» separado del cumplimiento material (DS-08) | No procede (criterio del experto) |
| d42-d44 | Tres entregables con el mismo título | Un único protocolo con secciones (§4.4) | No procede (criterio del experto) |

Regla: el experto decide cada discrepancia. ACEPTADA mantiene la cita del texto. RECHAZADA exige una justificación escrita de Legal para mantenerla, porque el texto prevalece solo si le contradice con claridad, o bien se adopta su criterio.

### 4.6 Filas añadidas (TGMS_AÑADIDO, a validar por el experto)

- 26.12, 26.10;
- 54;
- 43.4, 27.2 y 111.2 (el cambio significativo abre el ciclo);
- cláusulas de entidades financieras: 9.10, 17.4 (salvo g, h, i), 18.3, 19.2, 26.5 párrafos 2 y 3, 26.6 párrafo 2, 72.4 párrafo 2;
- 74.6 (DS-22);
- 5.3, 25.2, 53.2, 53.3, 53.4/55.2/56;
- 53.1 b) como receptor (proveedor posterior);
- 35.2 RGPD;
- 50.4 párrafo primero;
- 50.5 transversal;
- 6.4;
- 5.1 bis;
- art. 5 por usos posibles para el proveedor no alto riesgo;
- cambio normativo como disparador de reevaluación;
- plazo de respuesta a la solicitud de explicación del art. 86, tomado por analogía del art. 12.3 RGPD: el RIA no lo fija (H-10);
- exigibilidad heredada de los arts. 71, 72, 73, 74 y 86 (DS-35, H-08).

### 4.7 Catálogos de medidas (madurez L1-L8, subordinados y rotulados «Autodiagnóstico de madurez»)

- PROVEEDOR_ALTO_RIESGO: las 84 de AESIA, recotejadas.
- PROVEEDOR_NO_ALTO_RIESGO: nuevo.
- DESPLIEGUE_ALTO_RIESGO: perfil B, nuevo.
- DESPLIEGUE_LIMITADO: las 43, corregidas.
- ORGANIZACION: nuevo.
- ISO 42001: siempre MARCO_OPERATIVO.

Cada medida lleva `obligation_codes`. Los nuevos catálogos y el del responsable del despliegue muestran «Cobertura provisional — Comité de IA» hasta su dictamen (VALIDACION_CATALOGO). Sin rol, el fail-open mide la unión de los candidatos y las brechas de catálogos no confirmados no cuentan en los indicadores (`no_computa`). El contenido y el carácter (OBLIGACION o MARCO_OPERATIVO) de cada medida de los tres catálogos nuevos pasan por Harvey antes de publicarse: PROVEEDOR_NO_ALTO_RIESGO en H-14 (antes de F6.T3), DESPLIEGUE_ALTO_RIESGO y ORGANIZACION en H-06 (antes de F7.T2).

---

## 5. Registro de cumplimiento, riesgo, EIDF, EIPD, incidentes y autoridad

### 5.1 Registro obligación × sujeto

- `fn_aims_sincronizar_obligaciones(entity, system)` evalúa en servidor los predicados sobre los hechos sellados. Hace upsert sin borrar. Deduplica las de ORGANIZACION por sociedad y, si pasan a APLICA, llama a `fn_grc_alta_obligacion_organizacion_ria`.
- Se ejecuta al completar un cuestionario, al confirmar un sujeto, al registrar una versión y al publicar una versión del catálogo (por lotes, con la sesión de un administrador del tenant).
- Responsable por defecto:
  - instancias de sistema: el del sujeto;
  - instancias de organización: el órgano de la especialidad (`aims_specialty_bodies`) y un miembro vigente propuesto.
- `due_date` = la más temprana entre la fecha de exigibilidad y la fecha objetivo de su fase. Editable con motivo.
- `NO_APLICA_MOTIVADO` exige motivo de 40 caracteres o más, autor y fecha.
- Las opcionales nunca cuentan en rojo.

### 5.2 Acreditación

- La madurez alimenta una instancia solo desde una evaluación congelada y revisada por otra persona, y solo la más reciente no borrador. La clave de `checksVigentes` pasa a ser (sociedad, sistema, rol, código).
- Un L5 sin evidencia no acredita. Las filas legacy tampoco (`legado.ts`).
- Las evidencias van en `aims_evidence_items`, sin DELETE y con postura REFERENCE. Una evidencia caducada desacredita el entregable vivo y genera alarma.

### 5.3 Riesgo inherente → medidas → residual (método del experto; arts. 3.2, 9.2-9.9, 27.1 d-f)

- AIMS propone el riesgo del sistema con `fn_grc_proponer_riesgo_ia`: módulo 'ai', `ai_system_id`, `subject_id`, `entity_id`, obligación OB-10.
- El propietario de GRC lo evalúa en RiskEditor sobre personas y derechos afectados, con la escala 5×5 declarada. La leyenda la fija el Comité (DS-25).
- Medidas: se enlazan por `grc_ai_links` (MITIGA) y `measure_codes`. `fn_grc_evaluar_riesgo_ia` rechaza `RESIDUAL_SIN_MEDIDA_ACREDITADA` si la rebaja se apoya en medidas L1-L4 o en L5 sin evidencia; lo comprueba leyendo la conformidad de AIMS.
- Aceptación (9.5): `fn_grc_aceptar_residual` exige el artefacto de Secretaría (dictamen del Comité y decisión del decisor) y un aceptante distinto de quien evaluó.
- Vigilancia: el residual fija el umbral de los indicadores (`aims_monitoring_indicators.risk_id`). Un umbral superado propone reevaluar el riesgo (9.2 c, 9.8).
- La prioridad de las acciones sale del residual cuando existe. La señal a GRC sale de un residual no aceptado; se retira el disparo por puntuación inferior a 80.
- ARGA: el 9.10 permite integrar este riesgo en la gestión de riesgos de Solvencia II. Medido: RSK-TECH-005 («AI Act sistemas no clasificados») y RSK-TECH-006 («Shadow IT uso GenAI») son riesgos transversales, y RSK-STRA-005 describe un modelo de pricing de **automóvil** que no existe en el inventario de ARGA (ARGA Score es scoring de suscripción, no pricing de automóvil). Los tres cuelgan de ARGA Seguros, S.A. (`6d7ed736…`), mientras que el sujeto hipotético de ARGA Score es ARGA Vida. Por eso: RSK-TECH-005/006 se enlazan por `grc_ai_links` a los sistemas que mencionan, sin cambiar su sociedad; RSK-STRA-005 queda **sin sistema** y recibe una nota de corrección aditiva en `assessment_provenance` («no hay sistema de pricing de automóvil inventariado»), salvo que el usuario decida dar de alta un CANDIDATO. La diferencia de sociedad entre riesgo y sujeto se pinta y se declara en el ledger.
- La norma armonizada (40.1) figura como `harmonised_standard_ref`, de carácter MARCO_OPERATIVO.

### 5.4 EIPD (art. 35 RGPD, exigible hoy, en todos los perfiles)

- Criterio validado por Harvey (C5): la EIPD depende del riesgo del tratamiento, no de la clasificación RIA; una herramienta generativa de riesgo limitado con datos de clientes puede requerirla. Por eso la necesidad por defecto es PENDIENTE con motivo, nunca «no requerida por ser riesgo limitado». La determinación de cada caso es del DPO.
- Tabla `grc_dpias`, en GRC privacidad, con la pantalla `/grc/eipd` bajo `RequireModule('grc')`. Sustituye al guion fijo de GDPR, sin abrir `/grc/m/gdpr` a Garrigues. Rótulo, ruta y objeto distintos de la EIDF (DS-37).
- Contenido:
  - necesidad motivada: 35.1, 35.3 a-c y lista de la AEPD;
  - `controller_role`;
  - consulta al DPO (35.2), también anotada como registro CONSULTA_DPO_35_2;
  - consulta previa (36);
  - puente del 26.9 hacia las instrucciones del art. 13;
  - `rat_ref` (4 bis).
- MD_PD_02 lee el objeto. La ficha del sistema enlaza con ids.
- Casos: Harvey, GA_IA y Copilot (J&A Garrigues SLP) y ARGA Score (ARGA Vida, perfilado con efectos, 35.3 a).

### 5.5 EIDF (art. 27 tras el Ómnibus)

- Predicado DS-21. Plantilla del cuestionario de la Oficina de IA (27.5). Secciones a)-f) en `sections`.
- La sección d) referencia ids de `risks`. La sección e) es la de supervisión humana.
- 27.2: aprovecha la EIDF del proveedor y se actualiza con cada cambio significativo.
- 27.3: registro NOTIFICACION_EIDF_27_3.
- 27.4: remite a secciones de la EIPD (`aims_fria_dpia_cross_references` → `grc_dpias`). Por eso la EIPD se construye antes. La remisión completa una sección, nunca la cierra por sí sola: la EIDF cubre derechos más amplios (igualdad, no discriminación, tutela judicial) que la EIPD no evalúa (DS-37, RH-5). H-07 fija qué secciones la admiten.
- Se congela con hash de servidor y la aprueba un miembro del órgano.
- ARGA Score queda LATENTE_111_2 (en servicio desde el 1-3-2024). Se muestra «exigible solo si cambia significativamente», sin rojo.

### 5.6 Incidentes por rol, con compuerta de exigibilidad

- Calificación del art. 3.49 por letras a)-d) o NO_ES_GRAVE, con motivo y autor (`fn_aims_calificar_incidente`). NO_ES_GRAVE detiene el reloj. PENDIENTE se muestra de forma prudente y lo dice.
- `incident-clocks.ts` recibe los roles del sujeto en la sociedad del incidente:
  - PROVEEDOR: art. 73 (15, 10 y 2 días); informe inicial incompleto y completo (73.5) en `aims_incident_reports`; investigación INVESTIGACION_73_6. `fn_aims_registrar_version` bloquea con `VERSION_DURANTE_INVESTIGACION` si hay un incidente grave sin informe enviado.
  - RESPONSABLE_DESPLIEGUE: cadena del 26.5 (primero el proveedor, luego importador o distribuidor y autoridad), con COMUNICACION_26_5; suspensión ante un riesgo del 79.1 (SUSPENSION_USO_26_5 y `subject.suspended_at`); el 73 solo si no localiza al proveedor, con motivo. Validado por Harvey (C15, tal como se formuló; su matiz sobre el 73.4 no está en el texto consolidado y no se aplica). Para ARGA, el 26.5 añade que la obligación de vigilancia del desplegador que es entidad financiera se entiende cumplida con sus normas de gobernanza interna del Derecho de servicios financieros (ya en §4.6).
- **Compuerta:** si la obligación del régimen no es EXIGIBLE (cap. III antes del 2-12-2027, o LATENTE_111_2), el reloj se calcula, se persiste con `exigible = false` y se pinta «simulacro — no exigible». Los relojes del RGPD (33) y de DORA no pasan por esta compuerta.
- Estados de `aims_incident_regimes` por RPC: OPEN → IN_INVESTIGATION → NOTIFIED | NOT_APPLICABLE_JUSTIFIED → CLOSED. NOT_APPLICABLE_JUSTIFIED exige motivo y NOTIFIED exige un informe con `sent_at`. `entity_id` se escribe al abrir el subexpediente.

### 5.7 Autoridad competente (`src/lib/aims/autoridad-competente.ts`)

- La autoridad se resuelve **por entidad del grupo** (DS-36, RH-7), no por tenant.
- RIA: la autoridad de vigilancia del Estado miembro donde ocurre el incidente (73.1). Para una entidad que no es financiera (el despacho y sus sociedades), la autoridad nacional general de IA: en España, previsiblemente AESIA, con la designación pendiente de verificar (H-15). El supervisor financiero (74.6: DGSFP o EIOPA según corresponda, validado por Harvey en C16) solo en el caso de DS-22. El 73.9 queda marcado a razonar (H-06).
- RGPD: la autoridad del establecimiento principal del responsable, con ventanilla única (55-56). Garrigues Varsovia → autoridad polaca. Sucursal de Portugal de la SLP → AEPD. Es criterio TGMS a validar (H-15).
- DORA: el supervisor de la entidad financiera.
- La autoridad se propone y se puede editar con motivo. Se retira el AESIA fijo por defecto para todo el tenant: ahora sale de la entidad.

### 5.8 Registros operativos (`aims_ria_records.kind`)

- Art. 5 y prácticas: HALLAZGO_ART5, CESE_PRACTICA, AUTORIZACION_USO_EXTRAORDINARIO.
- Cooperación y derechos: REQUERIMIENTO_AUTORIDAD, RESPUESTA_REQUERIMIENTO, COOPERACION_GPAI, SOLICITUD_EXPLICACION_86, RESPUESTA_EXPLICACION_86.
- Deberes del responsable del despliegue: COMUNICACION_26_5, SUSPENSION_USO_26_5, INFORMACION_TRABAJADORES_26_7, INFORMACION_AFECTADOS_26_11, NOTIFICACION_EIDF_27_3, VERIFICACION_REGISTRO_26_8.
- Régimen del proveedor: NO_CONFORMIDAD_20, INFORMACION_79_1, EVALUACION_CONFORMIDAD_43, MARCADO_CE_48, REGISTRO_UE_49, INVESTIGACION_73_6, REVISION_VIGILANCIA_72.
- Cadena de suministro: RECEPCION_INSTRUCCIONES_13, RECEPCION_ANEXO_XII, MANDATO_REPRESENTANTE, VERIFICACION_IMPORTADOR_23, VERIFICACION_DISTRIBUIDOR_24, NOTIFICACION_COMISION_52.
- Pruebas: ESPACIO_PRUEBAS_57, PRUEBA_CONDICIONES_REALES_60, CONSENTIMIENTO_61, RETIRADA_CONSENTIMIENTO_60_5, EXCEPCION_POLICIAL_5.
- Otros: CONSULTA_DPO_35_2, DICTAMEN_ORGANO_IA_REF.

La lista va completa desde la migración que crea la tabla, para no tener que ampliarla por fase.

Datos personales (DS-33): los kinds SOLICITUD_EXPLICACION_86, RESPUESTA_EXPLICACION_86, INFORMACION_AFECTADOS_26_11, INFORMACION_TRABAJADORES_26_7, CONSENTIMIENTO_61 y RETIRADA_CONSENTIMIENTO_60_5 exigen `retention_until` y guardan referencias o seudónimos. La retirada del consentimiento (60.5) anota además que hay que dejar de tratar y dispara la supresión gobernada de los registros afectados que no estén en `legal_hold`. Los plazos los fija el DPO (H-17). Requerimientos (REQUERIMIENTO_AUTORIDAD, RESPUESTA_REQUERIMIENTO): campo `privileged_info` y remisión a la posición del despacho sobre secreto profesional (DS-40).

---

## 6. Programa y gestión

### 6.1 Programa por tenant, con las 5 fases del experto calculadas

`src/lib/aims/programa-fases.ts` asigna una fase a cada sistema × sociedad. No hay porcentajes tecleados.
- **F1 Inventario:** fila SISTEMA_IA, cribado ES y al menos un sujeto con ámbito decidido.
- **F2 Clasificación:** cuestionario COMPLETED y revisado, sin revisión pendiente.
- **F3 Roles:** sujetos VIGENTE con responsable interno y órgano.
- **F4 Obligaciones:** instancias EXIGIBLE en CUMPLIDA o NO_APLICA_MOTIVADO, y evaluación congelada y revisada donde el catálogo pide autodiagnóstico.
- **F5 Gobernanza:** indicadores medidos en plazo, incidentes calificados, revisión periódica al día y ninguna clasificación a revisar.

La F1 es de entrada. De la F2 a la F5 es ciclo: una reapertura devuelve el sistema a F2 sin borrar nada y no se marca VENCIDA mientras el ciclo esté al día. Los arts. 4 y 5 salen en una banda propia, «Regularización inmediata (exigible desde el 2-2-2025)».

### 6.2 Cuadro de mando del experto (`/ai-governance/programa`, `cuadro-mando.ts`)

- Avance por fase, rol, carácter, especialidad, naturaleza y exigibilidad, por sistema, sociedad y conjunto.
- Numerador: entregables únicos aprobados. Denominador: los requeridos por las instancias APLICA exigibles. Lo N/A motivado sale del denominador. Lo latente, lo condicionado y lo opcional se muestra aparte. 0/0 se pinta gris «no aplica».
- En las obligaciones continuas, el avance se rotula «avance documental» (DS-08), con chip A_VALIDAR_EXPERTO, y al lado va el indicador operativo de registros del periodo.
- Qué cuenta como sistema en cualquier recuento lo decide `cuentaComoSistema()` (DS-34).
- Exportación CSV/XLSX con las columnas del Excel del experto (ID, fase, tema, naturaleza, tipo, rol, base legal, entregable, estado, % calculado, responsable, fecha objetivo, evidencia, notas), más sociedad, sistema y exigibilidad.

### 6.3 Alarmas (`alarmas.ts`, bandeja en la portada y en el programa)

- Obligación EXIGIBLE no cumplida: rojo.
- EXIGIBLE_DESDE a 60 días o menos: ámbar, con la fecha. Por ejemplo, «art. 5.1 b bis/b ter exigible el 2-12-2026» o «art. 50.2 de ARGA Assist exigible el 2-12-2026 (111.4)».
- Art. 4 bis PENDIENTE_LEGAL con `H_cat_especiales_sesgo = SI`: ámbar «posiblemente exigible desde el 27-7-2026, pendiente de cotejo» (RH-3).
- Fase no continua vencida o a 60 días.
- Relojes de incidente exigibles.
- Acción vencida o sin responsable.
- Revisión periódica vencida.
- Evidencia caducada.
- Clasificación a revisar.
- Plazo del 52.1 (14 días), si llega a existir.

«Acciones requeridas» y «Próximos pasos» se derivan de la bandeja: en curso por terminar y pendientes de iniciar, por fase. Se retiran las constantes iguales para todos los tenants.

### 6.4 Acciones vivas

- Contenedor: GRC `action_plans` (C-05).
- Al congelar una evaluación, `fn_grc_crear_acciones_desde_aims` crea una acción por brecha (BRECHA_AIMS). Las de organización se crean una vez por obligación y sociedad.
- El estado y el porcentaje cambian por `fn_grc_actualizar_accion`.
- El responsable se pinta por nombre y el informe gana la columna Responsable. La especialidad se hereda del catálogo.
- Una reevaluación parte de la última no borrador y muestra las diferencias.

### 6.5 Reapertura del ciclo (`revision-pendiente.ts`, por fila de sujeto)

Cualquiera de estos hechos posteriores a `completed_at` marca «clasificación a revisar»:
- cambian el caso de uso o la descripción respecto a los snapshots, o cambian el proveedor o el estado;
- se registra una versión con `change_class ≠ NINGUNO` (SIGNIFICATIVO_111_2 solo con dictamen de consulta interna, DS-38);
- el sistema pasa de PLANIFICADO a ACTIVO;
- hay un incidente GRAVE;
- cambia el modelo (`last_change_seen_at`);
- la versión del cuestionario o del catálogo queda por detrás de la vigente (cambio normativo);
- hay finalidad del anexo III (25.1 c);
- vence la cadencia.

La ficha, el inventario, el Dashboard y el programa leen el mismo criterio. La cadencia la fija el órgano (`fn_aims_fijar_cadencia`, con referencia de Secretaría). Para el proveedor de alto riesgo, además, la revisión sistemática del 9.2.

---

## 7. Gobierno y cableado del grupo

- **Sujeto jurídico** (`sujeto-juridico.ts` y su espejo SQL):
  - elegibilidad según DS-19, con la tabla de equivalencias de `legal_form`; `titularJuridico` sube por `parent_entity_id`;
  - las oficinas de la matriz fuera de la UE (Shanghái, Bruselas, Bogotá) siguen en el art. 2.1 b); las filiales con personalidad propia se analizan por el 2.1 c) (validado, C12);
  - g-digital no puede ser proveedora (división, C11); NewLaw solo si pone GA_IA en servicio con su marca o lo comercializa como producto propio, con acuerdo intragrupo (D-U3, DS-39);
  - `etiquetaSociedad` desambigua en todos los selectores y fichas de AIMS los tres pares de ARGA con el mismo nombre común (Brasil, México, Portugal), usando denominación y país. No se renombra ninguna fila.
- **Responsables.** «Responsable interno» por sujeto, pintado por nombre, y obligatorio para confirmar. Rótulos separados: «Proveedor (sociedad o tercero)» y «Responsable interno». `vendor` queda como texto de origen sin rótulo de proveedor.
- **Comité de IA en el dato.** `governing-body.ts` resuelve `subject.governing_body_id`, si no `policies.owner_body_id` de `ai_systems.ai_policy_id`, y si no falla cerrado. Se retira el mapa fijo UUID→slug y se enlaza por el slug traído del dato. OrganoDetalle lista sus sistemas.
- **ARGA.** D-U2 (propuesta: CATIT como órgano consultivo de IA y Comisión de Riesgos como decisora del residual, art. 9.10). Hasta entonces fallan cerrado, con `SIN_ORGANO_ACREDITADO` y mensaje en pantalla: la revisión, la aceptación del residual, la aprobación de entregables de organización y las OBL-RIA de ARGA. La instancia de ORGANIZACION de ARGA existe y dice «sin espejo GRC: falta órgano acreditado».
- **Especialidades** (`aims_specialty_bodies`). Garrigues:
  - DATOS → `garrigues-oficina-dpo`;
  - CIBERSEGURIDAD → `garrigues-oficina-tecnica-seguridad` (alternativa: `garrigues-comite-seguridad-privacidad`);
  - TECNICO → `garrigues-comite-innovacion-digitalizacion`;
  - RIESGOS → `garrigues-departamento-compliance` (CACI en lo penal);
  - JURIDICO → `garrigues-comite-gobernanza-ia`.
  - Slugs a confirmar contra Cloud en F2.T10. ARGA queda vacío hasta D-U6.
- **Dictamen y decisor** (C-06). Cadena de PI-30 §3.2 d): informe al Departamento de Intangibles → autorización del Comité → Senior Partner, cargo leído de `condiciones_persona` y no un órgano. El Comité sigue fuera de los selectores de adopción (`isAdoptingBody` no cambia).
- **Políticas.**
  - `ai_systems.ai_policy_id` apunta a PI-30 o a PR-024. PR-024 se pinta como borrador y no acredita MD_GOB_01 mientras no esté publicada.
  - Las restricciones de PI-30 pasan a controles de GRC: §3.1.1 (Gemini excluido de GA_IA, también en `excluded_by_policy`) y §3.2 d) (contenido gráfico o audiovisual). Son CTR-RIA-PI30-01/02, enlazados por `grc_ai_links`.
  - MD_GOB_01 y MD_GOB_02 citan la fila real de la política y la composición vigente del Comité. El §4 de PI-30 es el destino de d53 y d54.
- **Ciberseguridad.**
  - CTR-GARR-33 se enlaza, sin mover su `obligation_id`, a Harvey, Copilot, GA_IA y la OBL-RIA de IA generativa.
  - OBL-GARR-CYBER-02 se enlaza a `ai_incidents`.
  - MG_CIBE se enlaza a los controles del módulo cyber. Reubicar CTR-GARR-33 lo decide GRC.
- **Selector de ámbito.** ScopeSwitcher en AIMS. Medido: en ARGA `branding` es NULL y `scopesForTenant` devuelve `ARGA_SCOPES` geográficos («Grupo ARGA (Global)», «España», «LATAM», «Europa», «Asia-Pacífico», «Brasil», «México», «Turquía», «EE. UU.»); `entities.country` es NULL en ARGA y `jurisdiction` está poblada; en Garrigues el país del Reino Unido figura como «UK», no ISO. Regla en una hoja (`src/lib/aims/ambito-entidades.ts`): etiqueta de ámbito → conjunto de ISO2 sobre `coalesce(country, jurisdiction)` normalizado («UK» → «GB»); «Global» = todas. `filterSystemsByScope` filtra por `subjects.entity_id` dentro de ese conjunto y **falla abierto**: un sistema sin sujeto se muestra siempre con la etiqueta «sin sociedad atribuida» (hoy son los 14). Así no se rearma la mina que `readiness.ts:621-643` desactivó. `branding.scopes` solo en Garrigues y solo cuando cada ámbito tenga al menos un sujeto (gate).
- **Traspasos** (C-07):
  - «Ver planes GRC» lleva a `/grc/mywork`, que es real.
  - EscaladoSecretariaModal: el órgano se pasa por id con `adoptingOnly`, se pinta la sociedad y se precarga según el rol (sin «Expediente Técnico» para un responsable del despliegue).
  - El intake de Secretaría propaga `matter`, `source` y `entity` a ConvocatoriasStepper.
- **RBAC y cuatro ojos** (DS-11). Garrigues: `demo@` (SECRETARIO, Redel) redacta, clasifica y congela; `admin@` (ADMIN_TENANT, Padín) revisa. Los dos son miembros vigentes del Comité. ARGA: `demo@` (Lucía Paredes; medido: SECRETARIO con cargo vigente en 12 órganos, entre ellos el CATIT y la Comisión de Riesgos Regulada) redacta y congela; revisa la segunda cuenta de D-U5, que hay que enlazar a una persona con cargo vigente en el órgano que fije D-U2, mediante `fn_designar_cargo` de Secretaría (F2.T18). Si D-U2 elige un órgano en el que un secretario no consejero no cuente como miembro para revisar, se dice en el ledger.
- **Acuerdos intragrupo** (DS-39). Donde el rol dependa de qué sociedad del grupo comercializa o pone en servicio (GA_IA entre la matriz y NewLaw; los sistemas de «ARGA Analytics» entre ARGA Digital y las aseguradoras), el sujeto cita el acuerdo intragrupo registrado como componente; sin acuerdo, se aplica C11 y se muestra «reparto intragrupo no documentado».

---

## 8. Dato demo

**Reglas.**
- Scripts idempotentes y aditivos en `scripts/aims/*`, `scripts/grc/*` y `scripts/entidades/*` (cada dueño el suyo). Dry-run por defecto, `tenant_id` explícito en cada escritura y sin DELETE, TRUNCATE ni UPDATE de columnas pobladas.
- Procedencia `provenance`/`data_provenance` = `{firmeza:'DEMO_PILOTO', etiqueta:'Simulado', fuente, validar:'Legal'|'Comité de IA'}`, con badge visible.
- Los actos de un responsable (cribar, clasificar, congelar, revisar, aprobar, aceptar) se hacen con sesión real por RPC (`DEMO_PASSWORD_*`, `persistSession:false`), nunca con service_role y nunca con un e2e.
- Garrigues persiste. ARGA: cada fila tocada queda en `docs/superpowers/plans/2026-09-xx-ledger-cobertura-ria.md` con el antes y el después medidos.
- Nunca se escribe el branding de ARGA.

**Garrigues (…0002).**
1. Entidades: dirección de NewLaw, EAD Trust y las filiales candidatas, solo donde es NULL. La matriz ya tiene la suya.
2. Terceros (`grc_third_parties`, IA): Microsoft; Counsel AI Corporation (Harvey, EE. UU., establecimiento en la UE por declarar); OpenAI y Anthropic (PROVEEDOR_MODELO_GPAI).
3. Inventario: GARR-IA-101/102 pasan a CONTRATO_MODELO y GARR-IA-201 a HOJA_DE_RUTA. Solo se escribe la columna nueva y las filas persisten.
4. Modelos: GA_IA → modelos de OpenAI y de Anthropic con `access_contract_system_id` = 101/102. Gemini con `excluded_by_policy` (PI-30 §3.1.1).
5. Sujetos hipótesis (SIEMBRA_HIPOTESIS, PROPUESTO): J&A Garrigues SLP como RESPONSABLE_DESPLIEGUE de Copilot, Harvey y GA_IA, y como PROVEEDOR y PROVEEDOR_POSTERIOR de GA_IA según D-U3. GARR-IA-201 con ámbito FUERA 2.8.
6. Responsables entre los 5 miembros vigentes del Comité: Abad (GA_IA, Copilot, 201) y Redel (Harvey), como propuesta Simulado. Vergara es el DPO en las EIPD y Terrero cubre ciberseguridad. `ai_systems.owner_id` solo se rellena donde es NULL.
7. `ai_policy_id` = PI-30 y órgano = Comité en los 6. Mapa de especialidades.
8. GRC: fila `ai`; OBL-RIA-ORG-04 (art. 4) y ORG-05 (art. 5) con `owner_body` = Comité y política PI-30; CTR-RIA-ALF-01 y CTR-RIA-PI30-01/02; aristas de CTR-GARR-33 y OBL-GARR-CYBER-02; registros de formación simulados de los miembros del Comité. Corrección declarada del defecto vivo GC-138: las 21 OBL-PBC pasan de 'risk' a 'aml' en `grc_obligations` (F5.T14), sin borrar ni recrear filas.
9. EIPD en necesidad PENDIENTE con motivo propuesto para Harvey, GA_IA y Copilot.
10. Clasificación real (F11.T1): cribado de GA_IA, Copilot y Harvey; cuestionarios de los sujetos; revisión cruzada. Harvey se reevalúa contra el catálogo DESPLIEGUE_LIMITADO y el de ORGANIZACION, y se congela y revisa. La evaluación del 49 % se conserva, marcada «evaluada contra otro catálogo».

**ARGA (…0001), aditivo y declarado.**
1. Entidades (dueño): `country` ← `jurisdiction` y `regulated_sector` de las aseguradoras, solo donde son NULL. Dirección de las candidatas. La desambiguación es solo de presentación.
2. Terceros: Palantir (FraudGuard), Bloomberg (InvestmentAdvisor) y Microsoft Azure OpenAI (ARGA Assist).
3. «ARGA Analytics» (`vendor` de AIS-ARGA-001/002/003: Motor de triaje de siniestros auto, Asistente de suscripción patrimonial y Detector de fraude en reembolsos salud) no es una sociedad. La propuesta por defecto sigue C11, validado por Harvey: la proveedora es la sociedad que pone el sistema en servicio con su nombre para uso propio, que a la vez es responsable del despliegue (ARGA España para AIS-001 y AIS-002; ARGA Salud para AIS-003). ARGA Digital (S.L., existe en Cloud) solo es proveedora si D-U1 declara que comercializa el sistema como producto propio, y entonces con acuerdo intragrupo (DS-39). `vendor` no se toca.
4. Sujetos hipótesis:
   - ARGA Vida y Pensiones: PROVEEDOR y RESPONSABLE_DESPLIEGUE de ARGA Score (uso propio).
   - ARGA España Seguros y Reaseguros: ARGA Assist (proveedora y responsable del despliegue), AIS-001 y AIS-002 (proveedora y responsable del despliegue, salvo D-U1) y FraudGuard (responsable del despliegue).
   - ARGA Salud: AIS-003 (proveedora y responsable del despliegue, salvo D-U1).
   - ARGA Servicios Corporativos: DocAnalyzer.
   - ARGA Inversiones SICAV: InvestmentAdvisor, elegible por DS-19.
   - Todos marcados «a validar por Legal».
5. Órgano según D-U2: PR-024 con `owner_body_id` (Draft sin cambio, F2.T15) y `ai_systems.ai_policy_id = PR-024` en los 8 sistemas (F2.T16, columna nueva de M03, con el antes y el después en el ledger). OBL-RIA-ORG-04/05 con ese órgano.
6. Reclasificación de los 8 por cuestionario (F11.T3) con `demo@` y la cuenta de D-U5 designada en el órgano (F2.T18). Plan B si D-U2, D-U5 o la designación no llegan antes del 27-11: ARGA Assist queda PROPUESTO con alarma, sin revisión simulada. **El resultado no se fija en el seed.** Lo contrasta H-04 antes de la revisión. El nivel previo queda en `nivel_declarado_previo`. Hipótesis de trabajo, no prefijadas:
   - ARGA Score: 5 c) con perfilado, Alto, LATENTE_111_2.
   - ARGA Assist: 50.1 y 50.2, con alarma el 2-12-2026.
   - Los otros cinco «Alto»: según el punto del anexo III que resulte. Ojo: la exclusión de fraude del 5 b) es del scoring crediticio, no del fraude asegurador, y AIS-002 (LLM + RAG) puede ser Limitado por el 50.1.
7. Legado sin UPDATE de filas: las 49 comprobaciones se traducen en lectura (`LEGADO_A_VIGENTE`); las evaluaciones APROBADO sin congelar (ARGA Score 72, las cuatro de 100 del Motor de triaje) y las secciones AIV-03/04 sin revisor se rotulan «legado demo, no acredita» por regla; el plan de `aims_post_market_plans` se lee tal cual.
8. Caso guiado del incidente de sesgo de ARGA Score (F11.T5): simulacro no exigible (DS-23). Calificación 3.49 c) motivada, sociedad ARGA Vida, España, autoridad propuesta DGSFP solo como hipótesis (DS-22 y H-06), investigación del 73.6 como registro y acción en GRC. Sin subexpediente RGPD.

**Gates del dato.**
- Trinquete de persistencia de Garrigues (G-PERSIST): pone rojo si se pierde o se duplica algo sembrado. Nunca pone rojo porque se siembre. Cerrar una hipótesis con `valid_to` no es perder dato (DS-34): el trinquete comprueba que la fila sigue y que sus columnas sembradas no cambian.
- Lista declarada de filas de ARGA tocadas.
- El aislamiento no es vacuo: hay filas en los dos tenants en cada tabla nueva.
- Los gates que exigían vacío se invierten sobre la invariante: `hallazgos-planes.test.ts:105`, `plan-accion-siembra-progresiva.test.ts` y `planes-accion-vacio.test.tsx`.

---

## 9. Validación con Harvey

**Mecanismo.**
- Skill `harvey-api`, `POST {BASE}/api/v2/completion`, mode assist, instancia EU si la US devuelve 401/403 (H-01 se envió por la consola EU con la fuente «Unión Europea»). El prompt se construye desde el catálogo TS, con `scripts/aims/harvey/enviar-lote.ts`, nunca a mano. Los prompts de abajo son el texto que ese script tiene que producir para cada lote.
- Cada lote se archiva en `docs/legal/harvey/AAAA-MM-DD-lote-H-nn.md` con el prompt, la respuesta, el modelo, la fecha y el SHA-256 del prompt. `harvey/registro.json` se actualiza.
- El veredicto por criterio (CORRECTO / INCORRECTO / CON MATIZ, fundamento y artículo) se vuelca en `validacion.harvey` de la fila y en el ledger. El controlador contrasta cada matiz con el texto consolidado antes de aplicarlo (DS-17): si el matiz no está en el literal, no se aplica y se anota (caso C15).
- **Ningún criterio se fija en el servidor (predicado publicado, CHECK, RPC) sin su veredicto registrado.** Si Harvey contradice al experto o al texto, la fila pasa a A_VALIDAR_EXPERTO o COMITE_LEGAL y la herramienta aplica el texto y lo dice.
- Solo se envían criterios de derecho público y hechos simulados. Usar Harvey queda como evidencia de uso de GARR-IA-002 por la matriz.
- Encabezado común de todos los prompts: «Responda para cada punto CORRECTO, INCORRECTO o CORRECTO CON MATIZ, con el fundamento en dos o tres líneas y el artículo exacto del Reglamento (UE) 2024/1689 en su versión consolidada tras el Reglamento (UE) 2026/1744 (texto consolidado a 27-07-2026). No resuma ni reformule los puntos: conteste punto por punto.»

**Estado de los lotes.**

| Lote | Estado | Qué cierra |
|---|---|---|
| H-01 | **RESPONDIDA el 19-09-2026.** 17 criterios VALIDADOS (§1.4); 8 consideraciones convertidas en RH-1 a RH-8 | F0.T3 (hecha). Retira de los lotes pendientes: la 3.68 y el 5.1 bis por rol (de H-02), el 74.6 y el carácter habilitante del 4 bis (de H-06), la aplicabilidad del 27.1 a la aseguradora privada (de H-07), la subsistencia del 49.2 (de H-08) y las discrepancias OB-43, OB-12, OB-56, OB-22, OB-37, OB-38 y OB-47 a 51 (de H-03) |
| H-05 | **CERRADO por H-01.** C5 fija el criterio de necesidad de la EIPD (depende del riesgo del tratamiento, no de la clasificación RIA) y C14 el del art. 4 (medidas adoptadas: formación, instrucciones, política de uso). La aplicación al caso concreto es del DPO, no de Harvey | F5.T1 (hecha) |
| H-02A, H-02, H-03, H-04, H-06 a H-17 | Pendientes. Prompts abajo | Ver cada lote |

**Lotes pendientes, listos para encolar.**

**H-02A — Ayudas del art. 5 y carácter de cuatro medidas del desplegador (lote corto, semana 1)**
- Tarea que lo envía y lo usa: F1.T15, antes de cerrar F1.T10 y F1.T11 (que entretanto se rotulan «provisional, pendiente de validación»).
- Criterios que valida: ayudas de la pregunta Q2_1 (letras c, d, f y h del art. 5) y el carácter MARCO_OPERATIVO de MD_TRA_01, MD_CS_01, MD_CS_02 y MD_CS_05. La retirada del ejemplo del scoring y el aviso de perfilado ya están validados (C10), igual que la redacción del art. 4 (C14).
- Prompt:
  > P1. La prohibición del art. 5.1 c) (puntuación social) no exige intención: basta con que el sistema produzca el trato perjudicial o desproporcionado descrito.
  > P2. Un sistema de una aseguradora que puntúa expedientes de siniestro por indicios objetivos de fraude, sin evaluar el riesgo de que una persona física cometa un delito basándose únicamente en su perfil o en rasgos de su personalidad, no entra en el art. 5.1 d).
  > P3. La prohibición del art. 5.1 f) (inferir emociones de una persona física en el lugar de trabajo o en centros educativos) alcanza a cualquier empleador que use el sistema con ese fin, no solo al proveedor.
  > P4. El art. 5.1 h) solo cubre la identificación biométrica remota en tiempo real en espacios de acceso público con fines de garantía del cumplimiento del Derecho; la biometría remota con otros fines se analiza por el anexo III, punto 1 a).
  > P5. Para un responsable del despliegue de un sistema de riesgo limitado, estas medidas no son obligaciones jurídicas autónomas del RIA sino marco operativo: (a) «aviso de interacción con un sistema de IA en las superficies en que atiende a personas físicas» (el art. 50.1 obliga al proveedor); (b) «identificación del proveedor y de los modelos de uso general en que se apoya el sistema» y (c) «documentación recibida del proveedor sobre capacidades, limitaciones y usos excluidos» (el capítulo V obliga al proveedor del modelo); (d) «vigilancia de las tres circunstancias del art. 25.1 que convertirían a la entidad en proveedora».
- Qué se hace: fija el texto de las ayudas y el carácter de las cuatro medidas. Un INCORRECTO revierte el cambio provisional de F1 y se anota en el ledger.

**H-02 — Cribado, perfilado, conversión en proveedor y cambio de diseño**
- Tarea: F4.T1, antes de F4.T7 (espejo SQL).
- Criterios que valida: cribado del 3.1; perfilado en tarificación y scoring; 25.1 a) con pacto (§3.2); 25.1 c) en uso general; art. 25 y ajuste fino (RH-4); 6.3 del proveedor invocado por el desplegador (§3.2); salvaguardias del 5.1 bis a); receptor del 53.1 b); criterio de apoyo para la consulta interna del 111.2 (RH-2); art. 2.13.
- Prompt:
  > P1. Un modelo lineal generalizado o una regresión logística de tarificación, estimados una vez y aplicados con coeficientes fijos, no son un sistema de IA del art. 3.1 según las Directrices de la Comisión C(2025) 924; un motor que combina reglas con gradient boosting reentrenado periódicamente sí lo es.
  > P2. La tarificación individual de un seguro de vida a partir de datos de salud, edad y hábitos de la persona asegurada constituye elaboración de perfiles en el sentido del art. 4.4 del RGPD a efectos del último párrafo del art. 6.3 del RIA.
  > P3. Quien pone su nombre o marca en un sistema de alto riesgo ya comercializado es proveedor por el art. 25.1 a) frente a la autoridad aunque exista un acuerdo contractual que asigne las obligaciones de otro modo; ese acuerdo solo reparte las obligaciones entre las partes.
  > P4. Un despacho que usa una herramienta generativa de uso general para evaluar el rendimiento de sus profesionales, finalidad del anexo III, punto 4 b), pasa a ser proveedor de un sistema de alto riesgo por el art. 25.1 c).
  > P5. El ajuste fino (fine-tuning) que un responsable del despliegue hace sobre un sistema de alto riesgo de un tercero es modificación sustancial del art. 25.1 b) cuando altera el rendimiento o la finalidad evaluados en la conformidad; el ajuste fino de un modelo de uso general de un tercero lo convierte en proveedor de ese modelo modificado solo si supera el umbral indicativo de las directrices de la Comisión.
  > P6. Un responsable del despliegue que no es proveedor puede tratar como no de alto riesgo un sistema del anexo III si el proveedor ha documentado la excepción del art. 6.3 (art. 6.4) y lo ha registrado por el art. 49.2, siempre que el sistema no elabore perfiles de personas físicas.
  > P7. Son salvaguardias razonables a efectos del art. 5.1 bis a), para un proveedor de una plataforma generativa interna, la prohibición contractual y técnica de generar contenido gráfico o audiovisual de personas reales sin consentimiento, junto con los filtros de contenido del proveedor del modelo.
  > P8. Un proveedor que integra en su sistema un modelo de uso general de un tercero es destinatario de la información del art. 53.1 b) y puede exigirla.
  > P9. El Reglamento 2026/1744 no define «cambios significativos en el diseño» del art. 111.2. Indique qué criterios interpretativos (considerandos, directrices, analogía con el art. 3.23) pueden apoyar una decisión interna documentada para un modelo que se reentrena sin cambiar arquitectura ni finalidad.
  > P10. El art. 2.13, en la redacción vigente, excluye del ámbito [texto del apartado tras el cotejo de F0.T2].
- Qué se hace: fija las ayudas y las reglas de derivación. Las discrepancias pasan a PENDIENTE_LEGAL y no derivan. P9 alimenta la ayuda de la consulta interna, no una regla.

**H-03 — Predicados del catálogo y discrepancias pendientes**
- Tarea: F3.T9, antes de publicar el catálogo v1.0 (F3.T10). Unos 20 predicados del experto y las filas TGMS, en bloques de unas 15.
- Criterios que valida: el predicado de cada fila; las discrepancias de §4.5 no validadas en H-01 (OB-27, OB-24, OB-64 salvo el 74.6, OB-55/56, fases E6, OB-01, OB-07).
- Prompt (por fila): «Obligación [código]: [texto del experto]. Cita del texto: [citaTexto]. Obligados: [rolesObligados]. Predicado: [predicado en lenguaje natural generado desde el DSL]. ¿Recoge el predicado exactamente a los sujetos y sistemas a los que obliga el precepto, ni más ni menos? Si no, indique qué sobra o qué falta.» Y por discrepancia: «El experto indica [X]; proponemos [Y] conforme a [artículo]. ¿Es correcta la corrección?».
- Qué se hace: publicación del predicado y material para la sesión con el experto (F3.T11).

**H-04 — Resultado de la clasificación de los 14 sistemas**
- Tareas: F11.T1 y F11.T3, antes de la revisión del segundo miembro.
- Criterio: sujetos, roles, nivel, punto del anexo III, marcos y exigibilidad derivados.
- Prompt (ficha por sistema, sin datos personales): «Con estos hechos [respuestas S0-S10, sin datos de clientes], la herramienta deriva: sujetos [lista], roles [lista], nivel [nivel y base], anexo III [punto], marcos [lista], exigibilidad [estado y fecha]. ¿Es correcta cada derivación? Señale la que no lo sea y por qué.»
- Qué se hace: si discrepa, la clasificación no se confirma: REQUIERE_CAMBIOS y va a Legal.

**H-06 — Excepciones del art. 50.4, 4 bis.2, 73.9 y catálogos de despliegue y de organización**
- Tarea: F7.T1, antes de F7.T2 a F7.T4.
- Criterios: excepción de control editorial; alcance del 4 bis a los responsables del despliegue; equivalencia del 73.9; contenido y carácter de los catálogos DESPLIEGUE_ALTO_RIESGO (perfil B) y ORGANIZACION.
- Prompt:
  > P1. El art. 50.4, párrafo segundo, excepciona la obligación de divulgar que un texto ha sido generado por IA cuando un abogado lo revisa y firma bajo su responsabilidad editorial antes de publicarlo.
  > P2. El art. 4 bis.2 extiende a los responsables del despliegue el régimen del 4 bis.1 para tratar categorías especiales de datos con el fin de detectar y corregir sesgos, con las mismas condiciones a) a f).
  > P3. Para una aseguradora española, el régimen de notificación de incidentes de DORA, o el de Solvencia II, es un «régimen de notificación equivalente» a efectos del art. 73.9.
  > P4. [Por cada medida de los catálogos DESPLIEGUE_ALTO_RIESGO y ORGANIZACION]: «Medida [código]: [texto]. La calificamos como [OBLIGACION del art. X / MARCO_OPERATIVO]. ¿Es correcta la calificación y la cita?».
- Qué se hace: fija las excepciones, el predicado del 4 bis para desplegadores y el carácter de cada medida. El 73.9 queda CONDICIONADA hasta el veredicto.

**H-07 — Contenido de la EIDF y relación con la EIPD**
- Tarea: F8.T4, antes de F8.T5.
- Criterios: contenido mínimo del 27.1 a)-f) frente a la plantilla del 27.5; aprovechamiento de la EIDF del proveedor (27.2); alcance de la remisión a la EIPD (27.4, RH-5).
- Prompt:
  > P1. Enumere el contenido mínimo que exige el art. 27.1 a) a f) y diga si el cuestionario de la Oficina de IA del art. 27.5 lo cubre entero.
  > P2. El responsable del despliegue puede apoyarse en una EIDF realizada por el proveedor (art. 27.2) solo para casos similares y debe actualizarla si cambia algún elemento del 27.1.
  > P3. Por el art. 27.4, la EIPD puede completar la EIDF en lo que coincida, pero no sustituye el análisis de igualdad, no discriminación y tutela judicial efectiva. Indique qué letras del 27.1 pueden completarse con la EIPD.
- Qué se hace: esquema de `sections`, reglas del 27.2 y lista de secciones que admiten la remisión.

**H-08 — Sección 5, registro y exigibilidad de los deberes conexos**
- Tarea: F9.T1, antes de F9.T6 y F9.T7; su P4 se usa ya en F3.T3.
- Criterios: fecha de la sección 5; 49.4 y 49.5; puntos 7 y 9 del anexo VIII B; 43.4; regla DS-35.
- Prompt:
  > P1. La sección 5 del capítulo III (arts. 40 a 49) se aplica desde la fecha general del art. 113 y no desde el 2-12-2027 o el 2-8-2028, pero solo se activa sobre sistemas clasificados como de alto riesgo, cuya clasificación sí está aplazada.
  > P2. Tras el 2026/1744 subsisten los arts. 49.4 y 49.5 y los puntos 7 y 9 de la sección B del anexo VIII.
  > P3. El art. 43.4 exige una nueva evaluación de la conformidad ante cualquier modificación sustancial, salvo los cambios predeterminados documentados.
  > P4. Los deberes de los arts. 71, 72, 73, 74 y 86 respecto de un sistema de alto riesgo solo son exigibles desde que lo es el capítulo III para ese sistema (2-12-2027 anexo III, 2-8-2028 anexo I), y no alcanzan al sistema que, por el art. 111.2, no queda sujeto al capítulo III.
- Qué se hace: exigibilidad de 43, 47, 48 y 49 y confirmación de DS-35. Si hay duda, PENDIENTE_LEGAL.

**H-09 — Umbral del modelo, autoridades públicas y elegibilidad como sujeto**
- Tareas: F10.T1 (umbral y autoridades) y F0.T1/F2.T1 (sujetos, D-U4).
- Criterios: umbral de proveedor de modelo; 26.8 frente a privados; 5.2-5.4 solo para autoridades garantes; elegibilidad de formas dudosas (DS-19).
- Prompt:
  > P1. ¿Cuál es el umbral indicativo vigente, según las directrices de la Comisión, para considerar proveedor de un modelo de uso general a quien lo entrena (10^23 FLOP) o lo modifica (un tercio del cómputo del modelo original)?
  > P2. El art. 26.8 (verificar que el sistema está registrado antes de usarlo) solo obliga a los responsables del despliegue que son autoridades públicas o instituciones de la Unión, no a una aseguradora privada.
  > P3. Las condiciones de los arts. 5.2 a 5.4 solo se dirigen a las autoridades garantes del cumplimiento del Derecho.
  > P4. Pueden ser proveedores o responsables del despliegue, por tener personalidad jurídica o ser «otro organismo» de los arts. 3.3 y 3.4: una fundación; un centro de estudios sin forma mercantil; una SICAV; una spółka komandytowa polaca (capacidad jurídica sin personalidad plena); una LLP inglesa; una LLP de Nueva York; una sociedad civil mexicana; y una sociedad chilena en proceso de integración en el grupo.
- Qué se hace: predicados de las condicionadas y elegibilidad de sujeto.

**H-10 — Plantillas de entregables y plazo del art. 86**
- Tareas: F6.T4, F6.T14, F8.T12 y F9.T4 a F9.T7, antes de marcar cada plantilla como vigente.
- Criterios: contenido mínimo de avisos 50.1-50.5, protocolo del 26, instrucciones del 13.3, respuesta del 86 y declaración del anexo V; plazo de respuesta del 86 (§4.6).
- Prompt: «Plantilla [tipo]: campos [lista de `campos_requeridos`]. ¿Cubre el contenido mínimo que exige [precepto]? Indique lo que falte.» Y: «El RIA no fija plazo para responder a la solicitud de explicación del art. 86. ¿Es razonable aplicar por analogía el plazo de un mes, prorrogable, del art. 12.3 del RGPD?».
- Qué se hace: ajuste de `campos_requeridos` del tipo; el plazo del 86 pasa de TGMS_AÑADIDO a validado o se retira.

**H-11 — Recotejo de citas de AESIA e ISO**
- Tareas: F1.T12 y F1.T13, como segunda lectura de Legal.
- Prompt: «Para cada medida [código, texto y cita], ¿coincide la cita con el texto consolidado tras el 2026/1744? Indique las subpartes desplazadas.»
- Qué se hace: `textoVerificado.por = LEGAL+HARVEY`.

**H-12 — Coherencia al cerrar cada fase**
- Momento: al cerrar F3, F4, F6, F7, F8 y F9.
- Prompt: «Estos son los criterios que esta fase fija [diff]. ¿Contradice alguno a los ya validados [lista con veredicto]?»
- Qué se hace: una contradicción reabre el criterio antes del merge.

**H-13 (recurrente) — Cambio normativo o de directrices**
- Momento: cuando cambie el texto consolidado o las directrices.
- Prompt: se reenvían las filas afectadas con su criterio vigente.
- Qué se hace: sube `catalog_version` y se dispara la reapertura (§6.5).

**H-14 — Catálogo del proveedor que no es de alto riesgo**
- Tarea: se envía antes del 13-11-2026 y lo usa F6.T3 (carril rápido).
- Criterio: contenido y carácter de cada medida de PROVEEDOR_NO_ALTO_RIESGO.
- Prompt: «Un proveedor de un sistema de IA que no es de alto riesgo tiene, a nuestro juicio, estas obligaciones del RIA: [lista generada: arts. 4, 5 por usos posibles, 50.1 y 50.2 cuando concurran, 6.4 y 49.2 si invoca el 6.3, 25.2 si coopera con un proveedor posterior]. Y estas medidas de marco operativo: [lista]. ¿Sobra o falta alguna, y es correcto el carácter de cada una?».
- Qué se hace: publica el catálogo o retira la medida; sin veredicto, «Cobertura provisional».

**H-15 — Autoridad competente por sociedad**
- Tarea: F8.T6, antes de fijar `autoridad-competente.ts`.
- Criterio: DS-36 y §5.7 (RH-7).
- Prompt:
  > P1. Para una sociedad española que no es entidad financiera (un despacho de abogados), la autoridad de vigilancia del mercado del RIA es la autoridad nacional general de IA; indique si España ya ha designado a la AESIA como tal y con qué norma.
  > P2. Para una sucursal en Portugal de una sociedad española, la autoridad de control del RGPD competente es la del establecimiento principal (AEPD) por el mecanismo de ventanilla única, salvo tratamientos que solo afecten a interesados de Portugal.
  > P3. Para una sociedad polaca del grupo con establecimiento propio, la autoridad de control es la polaca.
- Qué se hace: fija la regla por entidad; lo no confirmado queda como «propuesta, editable con motivo».

**H-16 — Secreto profesional frente a los arts. 21 y 74**
- Tarea: F6.T13, con el punto del Comité de IA de F0.T5.
- Criterio: DS-40 (RH-8).
- Prompt: «Un despacho de abogados que es proveedor o responsable del despliegue de un sistema de IA recibe un requerimiento de la autoridad de vigilancia (arts. 21 y 74.12-14) que incluye registros que contienen información de clientes amparada por el secreto profesional. El RIA no prevé una excepción expresa. ¿Qué base tiene el despacho para limitar o condicionar el acceso (art. 78 de confidencialidad, Derecho nacional sobre secreto profesional, Carta de los Derechos Fundamentales)? ¿Qué debe documentar?».
- Qué se hace: material para la posición del despacho, que fija el Comité; la herramienta no decide.

**H-17 — Conservación y supresión de registros con datos de terceros**
- Tarea: F4.T6 (columnas) y F8.T12 (uso), con el DPO.
- Criterio: DS-33.
- Prompt: «Los registros de solicitudes de explicación (art. 86), de información a afectados y trabajadores (arts. 26.11 y 26.7) y de consentimientos en pruebas en condiciones reales (arts. 60 y 61) contienen datos de terceros. ¿Qué plazo de conservación es defendible (arts. 5.1 e) RGPD, 18 y 19 RIA si aplican) y qué exige la retirada del consentimiento del art. 60.5 respecto de los datos ya recogidos?».
- Qué se hace: plazos por kind en `retention_until` y regla de la supresión gobernada.

---

## 10. Programa de ejecución

### 10.1 Gates (abreviaturas usadas en las tareas)

- **G-STD:** `bun test` 0 fail sin skips nuevos; `bun run typecheck`, `bun run lint` (0 warnings nuevos) y `bun run build`.
- **G-MIG:** `bun run db:check-target` antes y después; sonda revertida previa (MCP `execute_sql` con claims, `set local role authenticated` y ROLLBACK); migración con RS-TABLA; espejo en repo y registro en `schema_migrations`; paridad repo/Cloud de las versiones de la tarea.
- **G-ISO:** `src/test/schema/tenant-isolation.test.ts` ampliado con la tabla, con logins reales en las dos direcciones. La vacuidad se declara en `aislamiento-declarado.ts`.
- **G-VIVO** tiene dos variantes (DS-31), y cada tarea dice cuál:
  - **G-VIVO-NEG:** sonda permanente en `bun test` con logins reales y `persistSession:false`; solo lecturas, caminos negativos (la escritura prohibida se rechaza y no deja fila) o funciones IMMUTABLE de derivación. Sin residuo por construcción.
  - **G-VIVO-REV:** camino positivo en sonda revertida (MCP `execute_sql`, claims, `set local role authenticated`, ROLLBACK), con la salida archivada en el ledger. No deja nada en Cloud.
- **G-ARISTA:** gate que exige que las superficies importen y llamen la hoja, y que ninguna la reimplemente, con control positivo.
- **G-400:** `src/test/aims/pantallas-acotadas.test.ts`.
- **G-CLAIMS:** `src/test/aims/no-fabricated-claims.test.ts` (participio, imperativo y estado) más `src/test/helpers/sin-comentarios.ts`.
- **G-E2E2T:** `e2e/23-aims-workbench-responsive.spec.ts` y `e2e/aims-evaluaciones.spec.ts` en los dos tenants, solo lectura, con el tenant en el cable.
- **G-FRONTERA:** `src/test/aims/frontera-modulos.test.ts` (desde F5.T2), con escaneo TS y SQL.
- **G-PERSIST:** trinquete de persistencia de Garrigues más la lista declarada de filas de ARGA.
- **G-HARVEY:** veredicto de Harvey archivado para los criterios que la tarea fija en el servidor.
- **G-SYNC:** `src/test/schema/grc-sync-modulos.test.ts` (desde F5.T14): con logins reales en los dos tenants, cada fila de `obligations` tiene en `grc_obligations.module_id` el módulo que le toca por su código; las filas del ELSE se listan y deben ser exactamente las declaradas; control positivo: un código `OBL-PBC-*` resuelve a 'aml'.
- **Regla de test nombrado:** G-STD por sí solo no verifica una aceptación. Cada tarea nombra al menos un test que falla si su aceptación deja de cumplirse. Para plantillas: los `campos_requeridos` del esquema cubren las letras del precepto, cotejadas contra el índice congelado del RIA (F3.T8). Para predicados: un caso APLICA y uno NO_APLICA en la tabla SQL = TS. Para curación del catálogo: una fila sin predicado, `rolesObligados` o fase pone el test en rojo.

### 10.2 Calendario orientativo

| Fase | Ventana | Dependencias |
|---|---|---|
| F0 | 22-09 a 26-09-2026 (F0.T3 y H-05, hechas el 19-09) | — |
| F1 | 22-09 a 03-10 | — (F1.T15, lote H-02A, en la semana 1; F1.T12-T13 en paralelo con Legal) |
| F2 | 29-09 a 24-10 | F0.T1. F2.T18 depende de D-U2 y D-U5 |
| F3 | 29-09 a 17-10 (T11 sin bloquear) | F0.T4 |
| F4 | 13-10 a **13-11 (tope)** | F2.T2-T5, F3.T10. F4.T15 depende de D-U7 |
| F5 | 20-10 a 14-11. **F5.T14 puede ir en la semana 1**: corrige un defecto vivo y no depende de nada | F2 |
| F6 | Carril rápido del 14-11 al 27-11: T1, T2, T3, T4, T5 (RPC y tipos del art. 50), T8 y T14 (esquemas mínimos de todos los tipos). El resto hasta el 18-12 | F4, F5.T3, F5.T5, H-14 |
| F11.T1 y T3 | 16-11 a 27-11 (ARGA Assist y GA_IA antes del 2-12-2026) | F4 y carril rápido de F6. La revisión de ARGA Assist, además, D-U2, D-U5 y F2.T18 (plan B: PROPUESTO con alarma) |
| F7 | 30-11 a 18-12 | F6.T3 |
| F8 | 11-01 a 12-02-2027 | F5, F6. F8.T4, F8.T7 y F8.T10 dependen de D-U7 |
| F9 | 15-02 a 26-03-2027 | F8. F9.T3 depende de D-U7 |
| F10 | 29-03 a 16-04-2027 | F6, F9 |
| F11 resto | Escalonado. T7 al cierre | Ver cada tarea |

Dependencia entre fases declarada: el registro del positivo del art. 5 (F4.T14) va en F4; su traspaso a GRC (F5.T8) y a Secretaría (F5.T13) va en F5 y se conecta después. F4.T14 no espera a F5.

### F0 — Decisiones y validación previa

**F0.T1 Sesión de decisiones con el usuario (D-U1 a D-U7)**
- Ficheros: crear `docs/superpowers/plans/2026-09-xx-ledger-cobertura-ria.md` (decisiones, deudas y lista de filas de ARGA).
- Decisiones:
  - D-U1: proveedora de AIS-ARGA-001/002/003. Propuesta por defecto conforme a C11: la sociedad que lo pone en servicio con su nombre para uso propio (ARGA España para 001 y 002, ARGA Salud para 003), que acumula el rol de responsable del despliegue. ARGA Digital solo si comercializa el sistema como producto propio, y entonces con acuerdo intragrupo (DS-39).
  - D-U2: órgano de IA de ARGA y decisor del residual.
  - D-U3: proveedora de GA_IA (matriz o NewLaw) y si hay o habrá acuerdo intragrupo que lo documente.
  - D-U4: elegibilidad como sujeto de las filas concretas de DS-19 (Centro de Estudios, BSVV en integración, Garrigues Varsovia SPK, las dos LLP y las tres SC), con H-09.
  - D-U5: segunda cuenta ARGA COMPLIANCE, que crea el usuario en Auth, y la persona a la que se enlaza.
  - D-U6: mapa especialidad → órgano en ARGA.
  - D-U7: reabrir la escritura de las 8 tablas muertas de §2.2 (`aims_model_registry`, `aims_component_inventory`, `aims_dataset_registry`, `aims_post_market_plans`, `aims_regulatory_clocks`, `aims_incident_reports`, `aims_fria_assessments`, `aims_fria_dpia_cross_references`), derogando en ese punto DA-9 y la frontera D-1 del 08-09, con la garantía de que el dato de ARGA (`aims_post_market_plans`, 1 fila) solo se lee. M10, M15, M16, M17 y M20 dependen de ella.
- Migración: no.
- Aceptación: las siete decisiones quedan escritas en el ledger con fecha. Lo que no se decida queda como «falla cerrado», con la tarea afectada nombrada.
- Test: ninguno (decisión); el ledger es la evidencia.
- Gates: ninguno.
- Cierra: GC-03, GC-05, GC-08, GC-80, GC-115.

**F0.T2 Verificación en el DOUE de los puntos abiertos del Ómnibus**
- Ficheros: crear `docs/legal/2026-09-xx-verificacion-omnibus-puntos-abiertos.md`.
- Puntos: art. 2.13, 57.1, supervivencia y alcance del 49.2 (Harvey, C3, dice que subsiste simplificado), anexo VIII B puntos 7 y 9, 111.2 para autoridades públicas, fecha de la sección 5, aplicación del 4 bis desde el 27-7-2026 (RH-3: Harvey cita el considerando 9 del 2026/1744) y la cita de Harvey al considerando 25 (C8).
- Migración: no.
- Aceptación: cada punto queda como VERIFICADO (con texto oficial y CELEX) o PENDIENTE_LEGAL. `exigibilidad.ts` (F3.T3) lo consume. Si el 4 bis se verifica aplicable desde el 27-7-2026, pasa a EXIGIBLE y la alarma ámbar de §6.3 pasa a roja donde `H_cat_especiales_sesgo = SI`.
- Test: `src/lib/aims/ria/__tests__/exigibilidad.test.ts` lee el documento: un punto sin estado pone rojo.
- Gates: ninguno.
- Cierra: GC-12, GC-67, GC-93, GC-106, GC-125, GC-128.

**F0.T3 Respuesta de Harvey H-01 — HECHA (validación, 19-09-2026)**
- Estado: **hecha.** Los 17 criterios quedan VALIDADOS (§1.4): 15 CORRECTO sin más; C2 CORRECTO CON MATIZ (aplicado en F7.T4 y §4.5); y C15, que Harvey marcó con matiz, queda CORRECTO tal como se formuló, porque su matiz sobre el art. 73.4 no está en el texto consolidado. Las 8 consideraciones adicionales son RH-1 a RH-8. H-01 cierra también el lote H-05 (F5.T1).
- Resta, sin criterio pendiente: copiar al repo `harvey/01-criterios-aplicabilidad.md` y `harvey/01-respuesta.md` como `docs/legal/harvey/2026-09-19-lote-H-01.md`, con el SHA-256 del prompt, y `harvey/registro.json` como `docs/legal/harvey/registro.json`; volcar los veredictos en `validacion.harvey` de las filas afectadas cuando exista el catálogo (F3.T1).
- Migración: no.
- Aceptación: archivo en el repo con hash; cada criterio con su tarea anotada en el ledger (tabla de §1.4).
- Test: el test del catálogo (F3.T1) falla si una fila citada en §1.4 no tiene `validacion.harvey`.
- Gates: ninguno.
- Cierra: GC-02, GC-03, GC-12, GC-13, GC-27, GC-31, GC-32, GC-35, GC-41, GC-77, GC-86, GC-90, GC-93, GC-134.

**F0.T4 Incidencias del material del experto (primera versión) y preguntas para su sesión**
- Ficheros: crear `docs/legal/2026-09-xx-incidencias-material-experto.md`.
- Contenido: `#REF!` de G25 y G26 con su arreglo `COUNTBLANK=59` y `COUNTIF=6`; estado frente a %; 7 textos duplicados; 76 frente a 78; fechas; especialidad de d36/d40; OB-48 truncado; «Riesgos 10»; nota sin escapar (`cuadro_de_mando.html:181`); falta de N/A; fase continua que acaba VENCIDA; erratas. Preguntas de §4.5 y de GC-136, y tres más: si d42, d43 y d44 (mismo título en OB-31, OB-32 y OB-33) son un único protocolo; que OB-18 se mantiene como una fila con items por letra del art. 16; y si acepta separar «avance documental» de cumplimiento material en las obligaciones continuas (DS-08).
- Migración: no.
- Aceptación: documento listo para enviar al experto.
- Test: ninguno (documento).
- Gates: ninguno.
- Cierra: GC-134, GC-136, GC-137.

**F0.T5 Puntos para el Comité de IA (Garrigues) y para Legal**
- Ficheros: añadir al ledger `docs/superpowers/plans/2026-09-xx-ledger-cobertura-ria.md` la sección «Puntos del Comité»; el Comité los resuelve por dictamen de Secretaría (F5.T13).
- Contenido:
  - secreto profesional abogado-cliente frente a la cooperación (art. 21) y el acceso a documentación y código (art. 74): posición documentada del despacho (RH-8, con H-16);
  - procedimiento de consulta interna para decidir «cambio significativo» del 111.2 (RH-2): quién lo propone, quién lo decide y qué se documenta;
  - acuerdos intragrupo proveedor/desplegador (RH-1): GA_IA entre la matriz y NewLaw; contenido mínimo del acuerdo.
- Migración: no.
- Aceptación: los tres puntos quedan en el orden del día con responsable y fecha. Mientras no haya dictamen, la herramienta lo dice en la pantalla afectada (requerimientos, versiones, sujetos).
- Test: ninguno (orden del día); la arista se prueba en F5.T13.
- Gates: ninguno.
- Cierra: GC-72, GC-111, GC-115.

### F1 — Dejar de afirmar lo no medido (cliente, más una migración mínima)

**F1.T1 Monitores por código de requisito**
- Ficheros: crear `src/lib/aims/mapa-monitores.ts` (código → área desde el catálogo) y su test; modificar `src/lib/aims/readiness.ts:178-335`.
- Migración: no.
- Aceptación: no queda `includes()` sobre títulos. Hay monitor por sistema y por tenant, y «no medido» cuando no hay comprobaciones. En ARGA, «Derechos fundamentales / DPIA» deja de salir Listo 1/1 y «Gobierno, roles» deja de salir 3/3 (medido con `buildAimsReadiness` sobre el dato vivo).
- Test: `mapa-monitores.test.ts` y `readiness.test.ts` con el dato vivo de ARGA («Derechos fundamentales / DPIA» deja de ser Listo 1/1); el gate G-ARISTA falla si vuelve un `includes()` sobre títulos.
- Gates: G-STD, G-ARISTA (el gate prohíbe la subcadena).
- Cierra: GC-43.

**F1.T2 Cierres, hallazgos y 0/0**
- Ficheros: `readiness.ts:100-103, 363-365, 401-405, 505-547`; `src/lib/aims/checks-vigentes.ts`.
- Migración: no.
- Aceptación:
  - un incidente cuenta como cerrado solo con estado CERRADO y `closed_at`; el de Garrigues en investigación sale «en investigación»;
  - los findings salen solo de la última evaluación no borrador (ARGA: 8/11 y no 35/38);
  - 0/0 se pinta gris «no aplica»;
  - el inventario se mide por cuestionarios COMPLETED;
  - terceros figura «no medido».
- Test: `readiness.test.ts` con el incidente real de Garrigues en investigación como control positivo, y 0/0 pintado gris.
- Gates: G-STD, test con el incidente real como control positivo.
- Cierra: GC-44, GC-46, GC-48.

**F1.T3 Cada monitor lee su objeto**
- Ficheros: `readiness.ts`; `src/components/ai-governance/dashboard/ComplianceMonitorPanel.tsx`.
- Migración: no.
- Aceptación: expediente, precisión, recordkeeping, post-market y supervisión leen secciones, indicadores o protocolos, y sin ellos dicen «no medido» sin caer a incidentes. El monitor de prácticas prohibidas se declara «no medido» sin análisis. `readiness.test.ts:179` se rehace sobre la invariante, con control positivo.
- Test: `readiness.test.ts:179` rehecho sobre la invariante (sin objeto, «no medido»; nunca cae a incidentes), con control positivo.
- Gates: G-STD.
- Cierra: GC-29, GC-45.

**F1.T4 «Manda la más reciente» en evaluaciones y reglas de legado**
- Ficheros: `checks-vigentes.ts`, `readiness.ts:138`; crear `src/lib/aims/legado.ts` (acredita solo lo congelado y revisado; legado demo rotulado; `LEGADO_A_VIGENTE` para AIA-*, EU_AI_ACT_ART_*, ISO-* y VAL-*, solo lectura) y su test.
- Migración: no.
- Aceptación: ARGA Score deja de figurar como cubierto. Las cuatro APROBADO del Motor de triaje, AIV-03/04 y la nota de Harvey se rotulan «legado demo, no acredita». 0 filas actualizadas en Cloud.
- Test: `legado.test.ts` (acredita solo lo congelado y revisado) y G-ARISTA.
- Gates: G-STD, G-ARISTA (readiness, informe y Dashboard importan `legado.ts`), G-PERSIST.
- Cierra: GC-47, GC-55, GC-57.

**F1.T5 Un L5 legacy sin evidencia no acredita**
- Ficheros: `src/lib/aims/conformidad.ts:52-58` y su test; el indicador asociado.
- Migración: no.
- Aceptación: `evidenceCount = null` da «pendiente de evidencia» y no acredita. Los 40 L5 de Harvey (la v2 decía «trece»; corregido el 19-09 contra el dato, ver ledger) dejan de sostener el 49 %, y el indicador los cuenta aparte.
- Test: `conformidad.test.ts`: un L5 con `evidenceCount = null` no acredita.
- Gates: G-STD.
- Cierra: GC-54.

**F1.T6 Indicadores sin medición**
- Ficheros: `src/components/ai-governance/sistema/TabVigilancia.tsx:25-28, 69-74, 170`; `src/hooks/useAimsTechnicalFile.ts:245-274`.
- Migración: no.
- Aceptación: sin `current_value`, el indicador se pinta neutro «sin medición», se lea lo que se lea en `status`. Se retira «monitorización continua».
- Test: `tab-vigilancia.test.tsx`: sin `current_value`, «sin medición» aunque `status = 'OK'`.
- Gates: G-STD, G-CLAIMS.
- Cierra: GC-50.

**F1.T7 Expediente sin estados sin revisor**
- Ficheros: `src/components/ai-governance/sistema/TabExpedienteTecnico.tsx:232-243`, `src/lib/aims/expediente-tecnico.ts:61, 83`, `no-fabricated-claims.test.ts`.
- Migración: no.
- Aceptación: el selector no ofrece SEALED ni APPROVED. El guard cubre verbo y estado, con control positivo.
- Test: `no-fabricated-claims.test.ts` (verbo y estado) y `expediente-tecnico.test.ts` (el selector no ofrece SEALED ni APPROVED).
- Gates: G-STD, G-CLAIMS.
- Cierra: GC-51.

**F1.T8 Rótulos de madurez y portada honesta**
- Ficheros: `src/pages/ai-governance/Evaluaciones.tsx:83` y hermanas; `src/pages/ai-governance/Dashboard.tsx`; `src/components/ai-governance/dashboard/PrioridadAhora.tsx`.
- Migración: no.
- Aceptación:
  - «Autodiagnóstico de madurez» en todas las superficies;
  - gráfico e indicador con nivel neutro sin cuestionario;
  - «Última evaluación» no borrador;
  - desaparecen las constantes «Próximos pasos» y QUICK_ACTIONS, sustituidas por derivación del dato disponible.
- Test: `dashboard-sin-posturas.test.ts` (sin constantes de «Próximos pasos» ni QUICK_ACTIONS).
- Gates: G-STD, G-E2E2T, `dashboard-sin-posturas.test.ts`.
- Cierra: GC-49, GC-52.

**F1.T9 Atribuciones falsas fuera**
- Ficheros: `src/pages/EntidadDetalle.tsx:40, 301`; `src/components/ai-governance/DeclaracionConformidadModal.tsx:38, 118-126`; rótulo de Q2_2 en `cuestionario-calificacion.ts`.
- Migración: no.
- Aceptación: la sección de la entidad se rotula «Sistemas de IA del grupo (sin atribución a esta sociedad)». La declaración no rellena la entidad con `groupFullLabel` y avisa. Q2_2 se rotula «Art. 6.2 y anexo III».
- Test: `no-fabricated-claims.test.ts` (la entidad no se atribuye sistemas; la declaración no usa `groupFullLabel`).
- Gates: G-STD, G-CLAIMS.
- Cierra: GC-10, GC-17, GC-53.

**F1.T10 Ayudas del cuestionario v1.1 (provisional hasta la v2)**
- Ficheros: `cuestionario-calificacion.ts:127-181`.
- Migración: no.
- Aceptación: se retira el ejemplo del scoring y se añade un aviso de perfilado (validado por Harvey, C10). Q2_1 sin «SOLO si» ni «casi seguro es No», con las letras d)-g) nombradas, la h) acotada y la c) sin intención; estas ayudas se rotulan «provisional, pendiente de validación» hasta el veredicto de H-02A (F1.T15) y se anotan en el ledger. Texto revisado por Legal. El hash no cambia (la ayuda no se sella).
- Test: `cuestionario-arista.test.ts` falla si reaparece «SOLO si» o el ejemplo del scoring, y si falta el rótulo provisional mientras H-02A no tenga veredicto.
- Gates: G-STD.
- Cierra: GC-18, GC-26.

**F1.T11 Art. 4 del Ómnibus y carácter de medidas**
- Ficheros: `src/lib/aims/perfil-aplicabilidad.ts:78, 91-92, 139`; `derivarMarcos` en `cuestionario-calificacion.ts:318-373`.
- Migración: no.
- Aceptación:
  - art. 4 con «adoptar medidas para apoyar» (art. 1.5 del 2026/1744; validado por Harvey, C14);
  - MD_ALF_05 pasa a MARCO_OPERATIVO;
  - el art. 4 solo se asigna a PROVEEDOR y RESPONSABLE_DESPLIEGUE;
  - MD_TRA_01, MD_CS_01, MD_CS_02 y MD_CS_05 pasan a MARCO_OPERATIVO, rotuladas «provisional, pendiente de validación» hasta H-02A (F1.T15), con el cambio anotado en el ledger para revertirlo si el veredicto es INCORRECTO;
  - MD_TRA_02 dice «divulgar»;
  - nota de cautela del cap. V también en la rama del proveedor.
- Test: `evaluacion-nueva-perfil.test.ts` falla si alguna de las cuatro medidas vuelve a OBLIGACION sin veredicto registrado o si pierde el rótulo provisional antes del veredicto.
- Gates: G-STD.
- Cierra: GC-31, GC-36, GC-39, GC-117.

**F1.T12 Recotejo AESIA: arts. 12, 13 y 17**
- Ficheros: `src/lib/aims/catalog-aesia.ts:283-290, 393-422, 475-497` y su test; `verificadoEl` por requisito.
- Migración: no.
- Aceptación:
  - art. 12: los mínimos del 12.3 solo para el anexo III 1 a); fines del 12.2; retención de 6 meses (19 y 26.6); sin «12.4» visible;
  - art. 13: título oficial, destinatario el responsable del despliegue, b) i-vii y e);
  - art. 17: claves alineadas con las letras y medidas nuevas para d) y e).
  - Los códigos MG_* existentes no cambian; los nuevos suben la versión del catálogo (`evaluadaContraOtroCatalogo`).
- Test: `catalog-aesia.test.ts`: cada requisito con `verificadoEl`; los MG_* existentes no cambian de código.
- Gates: G-STD, G-HARVEY (H-11 como segunda lectura).
- Cierra: GC-129, GC-130, GC-131.

**F1.T13 Recotejo AESIA: arts. 9, 10, 15, 72 y 73, e ISO 42001**
- Ficheros: `catalog-aesia.ts:306-391, 425-472, 546-613`.
- Migración: no.
- Aceptación:
  - 9.5, 9.6, 9.7 y 9.2 b/c realineados, con medida del 9.2 c);
  - 10.2 g/h;
  - 15.3, 15.4 y 15.5 reubicados, y MG_ROBU_03 corregida;
  - 72.1-72.4;
  - MG_INCI_01 con 2, 10 y 15 días y sin «afectados»;
  - anexo A de ISO renumerado (A.2, A.3, A.5, A.6, A.7…) y completado a 9 objetivos más 6.1.2-6.1.4, como MARCO_OPERATIVO.
- Test: `catalog-aesia.test.ts` (plazos 2, 10 y 15 días en MG_INCI_01; anexo A de ISO con 9 objetivos) y `iso42001.test.ts`.
- Gates: G-STD, G-HARVEY (H-11).
- Cierra: GC-132, GC-133.

**F1.T14 Migración M01: enlaces de comprobaciones y evaluación**
- Ficheros: `src/lib/aims/evaluacion-payload.ts`, `src/hooks/useAiAssessments.ts`.
- Migración: `YYYYMMDDHHMMSS_aims_checks_enlaces_evaluacion.sql`: `ai_compliance_checks.assessment_id` y `ai_risk_assessments.questionnaire_id` (anulables), y `ALTER COLUMN checked_by_id SET DEFAULT auth.uid()` (la columna ya existe, medido; no se añade).
- Aceptación: las comprobaciones nuevas llevan `assessment_id` y `checked_by_id`. Un borrador ya no desplaza a una evaluación revisada. Las legacy quedan NULL y no acreditan.
- Test: `checks-vigentes.test.ts` con un borrador posterior a una revisada (manda la revisada).
- Gates: G-STD, G-MIG, G-VIVO-NEG (`aims-revisar-live.test.ts`, camino negativo).
- Cierra: GC-47, GC-57.

**F1.T15 Harvey H-02A (lote corto de la semana 1)**
- Ficheros: `docs/legal/harvey/…-lote-H-02A.md`; `harvey/registro.json`.
- Migración: no.
- Aceptación: veredictos sobre las ayudas de las letras c), d), f) y h) del art. 5 y sobre el carácter de MD_TRA_01, MD_CS_01, MD_CS_02 y MD_CS_05 (prompt en §9). Con CORRECTO, F1.T10 y F1.T11 retiran el rótulo provisional; con INCORRECTO, se revierte el cambio de F1 y se anota.
- Test: los tests de F1.T10 y F1.T11 leen el estado del lote en `registro.json`.
- Gates: G-HARVEY.
- Cierra: GC-26, GC-39.

### F2 — Sujeto, RBAC y cableado del grupo

**F2.T1 Hoja de sujeto jurídico**
- Ficheros: crear `src/lib/aims/sujeto-juridico.ts` (`esEntidadElegible`, `titularJuridico`, `requiereLegal`, `etiquetaSociedad`) y su test, con los catálogos reales (`scripts/garrigues/entities-catalog.ts` y el de ARGA).
- Migración: no.
- Aceptación:
  - tabla de equivalencias `legal_form` → clase con todas las formas reales de los dos tenants (medido: 17 en ARGA y 18 en Garrigues); una forma nueva sin clasificar no es elegible y pone el test en rojo;
  - Shanghái, Bruselas, Bogotá (oficina), la sucursal de Portugal y g-digital suben a su titular;
  - Sports & Entertainment (Liquidated) se excluye;
  - Fundación y SL vehículo son elegibles;
  - Centro de Estudios (INSTITUCION), BSVV (integración Chile), Garrigues Varsovia (SPK), las dos LLP y las tres SC quedan PENDIENTE_LEGAL hasta D-U4 y H-09;
  - los pares de ARGA reciben etiquetas distintas (el gate falla si dos elegibles comparten etiqueta).
- Test: `src/lib/aims/__tests__/sujeto-juridico.test.ts` con los catálogos reales, incluido el control positivo de una forma inventada que debe quedar sin clasificar.
- Gates: G-STD.
- Cierra: GC-03, GC-04.

**F2.T2 Migración M02: sujetos y especialidades**
- Ficheros: espejo SQL; `src/test/schema/aims-sujetos-shape.test.ts`.
- Migración: `…_aims_sujetos_ria.sql`: `aims_ria_subjects` y `aims_specialty_bodies` (RS-TABLA), `fn_aims_entidad_puede_ser_sujeto`, `fn_aims_fk_misma_tenant`, `fn_audit_worm` en sujetos.
- Aceptación: la verificación aborta ante un INSERT de una OFICINA o de otro tenant (control positivo). No hay políticas de escritura para authenticated (solo RPC). `system_id → ai_systems` con RESTRICT comprobado (`confdeltype = 'r'`).
- Test: `aims-sujetos-shape.test.ts`.
- Gates: G-MIG, G-ISO, G-VIVO-NEG (INSERT directo rechazado sin fila).
- Cierra: GC-01, GC-03.

**F2.T3 Migración M03: columnas de sujeto en `ai_*` y vistas**
- Ficheros: `src/hooks/useAiSystems.ts`, `src/hooks/useAiIncidents.ts`, `src/test/aims/aims-column-contract.test.ts`.
- Migración: `…_ai_columnas_sujeto.sql`:
  - `ai_systems.inventory_kind`, `prohibited_practice_status`, `ai_policy_id`, `provider_third_party_id` (FK compuesta);
  - `ai_incidents.entity_id`, `subject_id`, `occurred_member_state`;
  - `ai_risk_assessments.subject_id`, `catalog_version`, `created_by`, `review_decision`, `review_motivation`, trigger `assessor_id` y trigger de guardia de los campos de revisión (DS-32);
  - `ai_compliance_checks.subject_id`;
  - vistas `v_aims_sistemas_por_entidad` y `v_aims_sistemas_por_organo`.
- Aceptación: el DEFAULT de `inventory_kind` no reescribe ninguna otra columna. `assessor_id` se escribe siempre. Un UPDATE directo de `review_decision` se rechaza (control positivo en la verificación). El formulario de incidente pide sociedad y Estado miembro.
- Test: `aims-column-contract.test.ts`; sonda G-VIVO-NEG del UPDATE de `review_decision`.
- Gates: G-MIG, G-ISO, G-STD, G-VIVO-NEG.
- Cierra: GC-01, GC-13, GC-77.

**F2.T4 RPC de sujetos y hook**
- Ficheros: crear `src/hooks/useAimsSujetos.ts`.
- Migración: `…_aims_rpc_sujetos.sql`: `fn_aims_proponer_sujeto` y `fn_aims_confirmar_sujeto` (esta, con AIMS_GOBIERNO).
- Aceptación: un sujeto solo se crea por RPC. Confirmar PENDIENTE_LEGAL exige capacidad y motivo. El proveedor interno es un sujeto PROVEEDOR con su sociedad.
- Test: sonda G-VIVO-NEG (confirmar sin capacidad o sin motivo se rechaza) y sonda G-VIVO-REV del camino positivo archivada.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV.
- Cierra: GC-01, GC-05.

**F2.T5 Migración M04: RBAC de AIMS**
- Ficheros: `src/test/schema/aims-rbac-live.test.ts` (sonda revertida por rol).
- Migración: `…_aims_rbac_capacidades.sql`:
  - amplía `capability_matrix_action_check` con AIMS_INVENTARIO, AIMS_CLASIFICAR, AIMS_EVALUAR, AIMS_REVISAR, AIMS_OBLIGACIONES, AIMS_ENTREGABLE_APROBAR, AIMS_INCIDENTE, AIMS_REGISTRO y AIMS_GOBIERNO;
  - filas por rol: SECRETARIO todas salvo GOBIERNO; COMPLIANCE y ADMIN_TENANT todas; CONSEJERO y AUDITOR false, con `reason`;
  - `fn_aims_assert_capacidad` (captura la excepción P0001 de `fn_secretaria_assert_capability` y la relanza con ERRCODE `42501` y `AIMS_CAPACIDAD_DENEGADA`), `fn_aims_tiene_capacidad` y `fn_aims_es_miembro_organo`;
  - las políticas de escritura de las tablas `ai_*` y `aims_*` vivas exigen capacidad;
  - las RPC existentes (alta, completar, freeze, review) llaman al assert.
- Aceptación: CONSEJERO y AUDITOR reciben `42501` con el código `AIMS_CAPACIDAD_DENEGADA` en escritura, y `errores-rpc.ts` lo traduce. `demo@` SECRETARIO de los dos tenants sigue clasificando (control positivo). ADMIN_TENANT pasa siempre, porque así lo hace la función reutilizada (medido), y se declara.
- Test: `aims-rbac-live.test.ts` (sonda revertida por rol) y `errores-rpc.test.ts` con el código nuevo.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, G-E2E2T.
- Cierra: GC-79.

**F2.T6 RBAC en la UI**
- Ficheros: `src/hooks/useCapabilityMatrix.ts` (tipo `Capability`); botones de SistemaNuevo, ClasificacionGuiada, EvaluacionNueva, PasoRevision e IncidenteNuevo.
- Migración: no.
- Aceptación: sin capacidad, los botones no aparecen y hay aviso de lectura. Un gate exige `useHasCapability` en cada acción de escritura de AIMS.
- Test: G-ARISTA `src/test/aims/capacidad-en-acciones.test.ts`: cada acción de escritura de AIMS llama `useHasCapability`, con control positivo.
- Gates: G-STD, G-ARISTA.
- Cierra: GC-79.

**F2.T7 Cuatro ojos completo**
- Ficheros: `src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx` (nombre del revisor); `aims-revisar-live.test.ts`.
- Migración: `…_aims_cuatro_ojos_v2.sql`: `fn_aims_review_assessment` v2. Revisor ≠ `assessor_id` ≠ `created_by` ≠ `frozen_by`; miembro vigente del órgano del sujeto; decisión explícita; SIN_ORGANO_ACREDITADO si no hay órgano.
- Aceptación: en Garrigues, `admin@` revisa lo que congela `demo@`; al revés, MISMO_REDACTOR. En ARGA, SIN_ORGANO_ACREDITADO hasta D-U2. El revisor se pinta por nombre.
- Test: `aims-revisar-live.test.ts` (camino negativo) y sonda revertida del camino positivo.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV.
- Cierra: GC-78.

**F2.T8 Responsable interno**
- Ficheros: `src/components/ai-governance/sistema/CabeceraSistema.tsx:161-162`, `Sistemas.tsx`, `Dashboard.tsx`, `CabeceraInforme.tsx`, `readiness.ts` (monitor de accountability), `bloqueosParaConfirmar`.
- Migración: no.
- Aceptación: rótulos separados «Proveedor (sociedad o tercero)» y «Responsable interno», este por nombre. Sin responsable no se confirma la clasificación. El monitor lee los sujetos con responsable.
- Test: `sistema-ficha-coherente.test.ts` y `bloqueos-para-confirmar.test.ts` (sin responsable no se confirma).
- Gates: G-STD, G-ARISTA, `sistema-ficha-coherente.test.ts`.
- Cierra: GC-06.

**F2.T9 Comité de IA desde el dato**
- Ficheros: `src/lib/aims/governing-body.ts`, `src/components/ai-governance/dashboard/OrganoRector.tsx`, `src/pages/OrganoDetalle.tsx`.
- Migración: no; usa la vista de M03.
- Aceptación: se retira `AI_GOVERNANCE_BODY_BY_TENANT`. En Garrigues, el órgano sale de PI-30. En ARGA, «sin órgano acreditado» hasta D-U2. OrganoDetalle del Comité lista sus 6 sistemas. El enlace va por slug.
- Test: `governing-body.test.ts` y el gate G-ARISTA que falla si reaparece `AI_GOVERNANCE_BODY_BY_TENANT`.
- Gates: G-STD, G-ARISTA (el gate falla si reaparece el mapa).
- Cierra: GC-07, GC-08.

**F2.T10 Especialidades cableadas a órganos**
- Ficheros: crear `scripts/aims/seed-especialidades.ts`; `src/components/ai-governance/incidente/SubexpedientesRegimen.tsx` (`lead_role` → órgano).
- Migración: `…_aims_rpc_especialidad.sql` (`fn_aims_declarar_especialidad`).
- Aceptación: Garrigues queda con 5 especialidades, con slugs verificados contra Cloud. Los responsables se proponen entre miembros vigentes. ARGA falla cerrado.
- Test: `seed-especialidades.test.ts` (idempotente; slugs existentes en Cloud) y G-VIVO-NEG de `fn_aims_declarar_especialidad` sin AIMS_GOBIERNO.
- Gates: G-MIG, G-PERSIST.
- Cierra: GC-80.

**F2.T11 Selector de ámbito**
- Ficheros: crear `src/lib/aims/ambito-entidades.ts` (etiqueta de ámbito → ISO2 sobre `coalesce(country, jurisdiction)`, con «UK» → «GB») y su test; `src/lib/aims/readiness.ts:621-643` (`filterSystemsByScope`), `src/lib/tenant-scopes.ts`, montaje del ScopeSwitcher en el layout de AIMS; crear `scripts/aims/seed-scopes-garrigues.ts`.
- Migración: no.
- Aceptación: el filtro va por `subjects.entity_id` dentro del conjunto de la hoja, no por palabras. Falla abierto: un sistema sin sujeto se muestra siempre con «sin sociedad atribuida». Los `ARGA_SCOPES` geográficos resuelven a sociedades por `jurisdiction` (en ARGA `country` es NULL, medido). `branding.scopes` de Garrigues solo con sujetos (gate). El branding de ARGA no se toca (gate).
- Test: `ambito-entidades.test.ts` con el dato vivo de ARGA: en cada ámbito no desaparece ningún sistema sin sujeto (control positivo: con los 14 sin sujeto, todos visibles en todos los ámbitos).
- Gates: G-STD, G-E2E2T, `navegacion-por-tenant.test.ts`.
- Cierra: GC-09.

**F2.T12 Ficha de entidad por sujeto**
- Ficheros: `src/pages/EntidadDetalle.tsx`.
- Migración: no.
- Aceptación: lista los sujetos de esa sociedad con el chip de rol, leídos de `v_aims_sistemas_por_entidad`. Shanghái y EAD Trust muestran 0. El gate falla si vuelve `useAiSystemsList`, con control positivo en la matriz.
- Test: `entidad-detalle-sujetos.test.tsx` (Shanghái y EAD Trust muestran 0) y G-ARISTA que falla si vuelve `useAiSystemsList`.
- Gates: G-STD, G-ARISTA.
- Cierra: GC-10.

**F2.T13 Traspasos AIMS→GRC con ids**
- Ficheros: `src/lib/aims/handoffs.ts`, `src/pages/grc/Risk360.tsx:244-245, 367`, `src/pages/grc/IncidentesList.tsx`, `src/components/ai-governance/dashboard/HandoffAffordances.tsx`.
- Migración: no.
- Aceptación: la URL lleva system, subject, assessment, incident y entity, y Risk360 y IncidentesList precargan sistema y sociedad. «Ver planes GRC» lleva a `/grc/mywork`. La CTA depende de `isModuleEnabled`.
- Test: `handoffs.test.ts` (la URL lleva los cinco ids; sin `isModuleEnabled`, sin CTA).
- Gates: G-STD, G-E2E2T.
- Cierra: GC-81.

**F2.T14 Traspasos AIMS→Secretaría con ids**
- Ficheros: `src/components/ai-governance/sistema/EscaladoSecretariaModal.tsx:97-101`, `src/components/secretaria/shell/useSecretariaScope.ts:83-88`, intake `/secretaria/reuniones/nueva` y ConvocatoriasStepper (propagación de `matter`, `source` y `entity`).
- Migración: no.
- Aceptación: el órgano se pasa por id con `adoptingOnly` y la sociedad se pinta. No se precarga el expediente técnico para un responsable del despliegue. La `entity` de la URL manda sobre localStorage.
- Test: `escalado-secretaria.test.tsx` (la `entity` de la URL manda sobre localStorage) y los e2e de Secretaría 05, 12 y 19.
- Gates: G-STD, e2e de Secretaría 05, 12 y 19.
- Cierra: GC-81.

**F2.T15 Siembras de Entidades y Políticas (sus dueños)**
- Ficheros: crear `scripts/entidades/seed-ria-direcciones-pais-sector.ts` y `scripts/politicas/seed-pr024-owner-body.ts` (este, tras D-U2).
- Migración: no; seeds idempotentes con `data_provenance`.
- Aceptación:
  - `country` de ARGA ← `jurisdiction` y `regulated_sector` de las aseguradoras, solo donde son NULL;
  - direcciones de las candidatas;
  - `PR-024.owner_body_id` sin cambiar Draft;
  - antes y después en el ledger.
- Test: `garrigues-entities-seed.test.ts` y `seed-ria-direcciones.test.ts` (solo rellena NULL; segunda corrida sin cambios).
- Gates: G-PERSIST, `garrigues-entities-seed.test.ts`.
- Cierra: GC-03, GC-04, GC-08, GC-76.

**F2.T16 Siembra de sujetos hipótesis, políticas y responsables**
- Ficheros: crear `scripts/aims/seed-sujetos-ria.ts` (RPC y login real).
- Migración: no.
- Aceptación:
  - sujetos PROPUESTO con SIEMBRA_HIPOTESIS y «Simulado», con la propuesta de ARGA conforme a C11 (§8, ARGA 3 y 4);
  - `ai_policy_id` = PI-30 y órgano en los 6 de Garrigues;
  - en ARGA, tras D-U2, `ai_policy_id` = PR-024 en los 8 sistemas, con el antes y el después en el ledger;
  - `inventory_kind` de 101, 102 y 201;
  - responsables entre los miembros del Comité;
  - una segunda corrida no cambia nada (idempotencia medida);
  - el script no reescribe una hipótesis que ya tenga una fila CUESTIONARIO sucesora (DS-34).
- Test: `scripts/aims/__tests__/seed-sujetos-ria.test.ts` (idempotencia en los dos órdenes: sembrar y luego clasificar, y clasificar y luego sembrar, sin duplicar ni pisar).
- Gates: G-PERSIST.
- Cierra: GC-01, GC-05, GC-06, GC-07, GC-13, GC-42.

**F2.T17 Declaración del art. 47 con la sociedad proveedora**
- Ficheros: `DeclaracionConformidadModal.tsx`.
- Migración: no.
- Aceptación: toma `legal_name` y dirección del sujeto PROVEEDOR. Si no hay sujeto, no se ofrece. El cap. V solo aparece con PROVEEDOR_GPAI.
- Test: `declaracion-conformidad.test.tsx` (sin sujeto no se ofrece; con sujeto, la sociedad y no el grupo).
- Gates: G-STD, G-CLAIMS.
- Cierra: GC-53.

**F2.T18 Designación del revisor de ARGA en el órgano de IA (Secretaría)**
- Ficheros: crear `scripts/secretaria/designar-revisor-ia-arga.ts` (login real, RPC `fn_designar_cargo`, dry-run por defecto); ledger.
- Migración: no.
- Depende de: D-U2 (órgano) y D-U5 (cuenta creada en Auth por el usuario y persona elegida).
- Aceptación: `user_profiles.person_id` de la segunda cuenta apunta a una persona con cargo vigente en el órgano de D-U2, dado de alta por la RPC autoritativa de Secretaría (escritura directa en `condiciones_persona` lanza `AUTHORITATIVE_WRITE_RPC_REQUIRED`). `demo@` ARGA ya tiene cargo vigente en el CATIT y en la Comisión de Riesgos Regulada (medido) y no se toca. Si no llega antes del 27-11, F11.T1 sigue con el plan B.
- Test: `aims-revisar-live.test.ts` comprueba, con los dos logins de ARGA, que `fn_aims_es_miembro_organo` devuelve true para ambos en el órgano de D-U2.
- Gates: G-PERSIST (fila de ARGA declarada en el ledger).
- Cierra: GC-08, GC-78.

### F3 — Catálogo canónico del experto (en paralelo con F2)

**F3.T1 Generador del catálogo**
- Ficheros: crear `docs/legal/experto-ria/{obligaciones,entregables_html}.json`, `scripts/aims/generar-catalogo-ria.ts`, `src/lib/aims/ria/obligaciones/*.ts` (esqueleto), `src/lib/aims/ria/entregables.ts` y `src/lib/aims/ria/__tests__/catalogo.test.ts`.
- Migración: no.
- Aceptación: 65 códigos únicos. Recuentos por rol principal del experto reproducidos. d42-d44 y d59/d60 deduplicados. La capa del experto es literal.
- Test: `catalogo.test.ts`: 65 códigos únicos, recuentos por rol del experto y capa literal intacta.
- Gates: G-STD.
- Cierra: GC-60.

**F3.T2 DSL de predicados**
- Ficheros: crear `src/lib/aims/ria/predicados.ts` y su test.
- Migración: no.
- Aceptación: `todos`, `alguno`, `no`, `hecho/en/es` y `siempre`, con lógica de Kleene. Un hecho desconocido da DEPENDE. Vocabulario cerrado de hechos, con test que falla ante un hecho inexistente.
- Test: `predicados.test.ts`: tabla de Kleene completa y un hecho inexistente pone rojo.
- Gates: G-STD.
- Cierra: GC-21, GC-60.

**F3.T3 Exigibilidad**
- Ficheros: crear `src/lib/aims/ria/exigibilidad.ts` y su test.
- Migración: no.
- Aceptación: el calendario de §4.3 con los estados de DS-05. LATENTE_111_2 por tipo y modelo. Lo no verificado en F0.T2 queda PENDIENTE_LEGAL.
- Test: `exigibilidad.test.ts`: un caso por estado de DS-05, LATENTE_111_2 por tipo y modelo, 111.4 y la herencia de DS-35.
- Gates: G-STD.
- Cierra: GC-67.

**F3.T4 Curación, bloque 1 (OB-01 a 08, 23 a 30)**
- Ficheros: `src/lib/aims/ria/obligaciones/{inventario,prohibiciones,clasificacion,roles,importadores}.ts`.
- Migración: no.
- Aceptación: predicado, cita del texto, roles, ámbito, entregables y discrepancias de OB-01, 03, 07, 24 y 27 según §4.5. Revisado por Legal.
- Test: `src/lib/aims/ria/__tests__/curacion.test.ts`: falla si una fila del bloque no tiene predicado, `rolesObligados` o fase, y si su `citaTexto` no resuelve en el índice congelado (F3.T8); y la tabla SQL = TS tiene un caso APLICA y uno NO_APLICA por predicado.
- Gates: G-STD.
- Cierra: GC-60, GC-134, GC-136.

**F3.T5 Curación, bloque 2 (OB-09 a 22, 39 a 41)**
- Ficheros: `…/{alfabetizacion,riesgos-datos,requisitos-tecnicos,proveedor-conformidad}.ts`.
- Migración: no.
- Aceptación: OB-18 se mantiene como **una sola fila** con items a)-l) del art. 16 (DS-10): no se parte, para no cambiar el denominador del experto. OB-19 con items del 17.1 a)-m). Discrepancias de OB-12 (con el matiz de C2) y OB-22.
- Test: `curacion.test.ts` (mismo contrato que F3.T4) y un caso que falla si aparece un código OB-18a…l.
- Gates: G-STD.
- Cierra: GC-60, GC-99, GC-100, GC-134.

**F3.T6 Curación, bloque 3 (OB-31 a 38, 42 a 65)**
- Ficheros: `…/{despliegue,transparencia,gpai,pruebas-registro,gobernanza}.ts`.
- Migración: no.
- Aceptación: OB-37 con el predicado DS-21. OB-38 partida en 38a y 38b. OB-43, 55, 56 y 64 según §4.5. OB-47 a 51 por rol PROVEEDOR_GPAI. 50.5 transversal. OB-31, 32 y 33 apuntan a d42 (alias d43 y d44) y OB-65 a d76.
- Test: `curacion.test.ts` (mismo contrato que F3.T4).
- Gates: G-STD.
- Cierra: GC-60, GC-134, GC-136.

**F3.T7 Filas añadidas**
- Ficheros: `src/lib/aims/ria/obligaciones/anadidas-tgms.ts`.
- Migración: no.
- Aceptación: todas las filas de §4.6, con origen TGMS_AÑADIDO y `validacion.experto = PENDIENTE`, incluidas el plazo del art. 86 y la exigibilidad heredada de DS-35.
- Test: `curacion.test.ts` falla si una fila TGMS_AÑADIDO no tiene `validacion.experto`.
- Gates: G-STD.
- Cierra: GC-135.

**F3.T8 Texto verificado por fila, con índice congelado del RIA**
- Ficheros: crear `docs/legal/ria/indice-ria-02024R1689-20260727.json` (artículo, apartado, párrafo y letra, extraídos del texto oficial consolidado a 27-07-2026, CELEX 02024R1689-20260727, con la URL y el SHA-256 del HTML fuente) y `scripts/aims/ria/extraer-indice-ria.ts` que lo genera; crear `src/lib/aims/ria/cita-ria.ts` (verificador) y el gate `src/lib/aims/ria/__tests__/texto-verificado.test.ts`. No se usa `src/test/garrigues/cita-verificable.ts`, que devuelve `null` para toda cita que no sea de un documento interno (medido).
- Migración: no.
- Aceptación: el gate falla si una fila no tiene fecha y fuente, **y** si su `citaTexto` apunta a un artículo, apartado o letra que no existe en el índice. Control positivo: la cita inventada «10.4.f)» falla y «4 bis.1.f)» pasa. PENDIENTE se ve en pantalla.
- Test: `texto-verificado.test.ts`.
- Gates: G-STD.
- Cierra: GC-128.

**F3.T9 Harvey H-03 e incidencias generadas desde el catálogo**
- Ficheros: `scripts/aims/harvey/enviar-lote.ts`, `docs/legal/harvey/…-lote-H-03.md`; se regenera `docs/legal/…-incidencias-material-experto.md` desde el catálogo.
- Migración: no.
- Aceptación: veredicto por predicado y por discrepancia volcado en `validacion.harvey`. No se reenvían las discrepancias ya validadas en H-01 (OB-43, OB-12, OB-56, OB-22, OB-37, OB-38, OB-47 a 51). Documento de preguntas para el experto.
- Test: el test del catálogo falla si una fila publicada no tiene veredicto de H-01 o H-03.
- Gates: G-HARVEY.
- Cierra: GC-134, GC-136, GC-137.

**F3.T10 Migración M05: publicación del catálogo v1.0 y evaluador SQL**
- Ficheros: generador `scripts/aims/generar-migracion-catalogo.ts`; `src/test/schema/catalogo-ria-cloud.test.ts` (paridad TS/Cloud); `src/test/schema/aims-predicado-live.test.ts` (SQL = TS en todos los predicados por 40 casos de hechos, llamando a `fn_aims_eval_predicado`, IMMUTABLE y sin escritura).
- Migración: `…_aims_catalogo_ria_v1.sql` (tablas globales, filas y `fn_aims_eval_predicado`).
- Aceptación: paridad TS/Cloud en verde. Las tablas globales se declaran en `aislamiento-declarado.ts`. authenticated solo tiene SELECT.
- Test: `catalogo-ria-cloud.test.ts` y `aims-predicado-live.test.ts`.
- Gates: G-MIG, G-VIVO-NEG, G-HARVEY.
- Cierra: GC-21, GC-60.

**F3.T11 Sesión con el experto (no bloquea)**
- Ficheros: actualizar `discrepancia.estado` en el catálogo; acta en `docs/legal/…-sesion-experto-ria.md`.
- Migración: no; la publicación va en F7.T5.
- Aceptación: cada discrepancia queda ACEPTADA o RECHAZADA con justificación de Legal, incluidas las dos de interpretación añadidas en v2 (DS-08 «avance documental» y d42-d44 como un único protocolo) y la confirmación de OB-18 como una fila. Hay respuesta a «¿para quién es el proyecto?» (U-2 ya fijado).
- Test: `curacion.test.ts` falla si una discrepancia de §4.5 no tiene estado tras la sesión.
- Gates: ninguno.
- Cierra: GC-134, GC-136.

### F4 — Cuestionario v2 y aplicabilidad única (tope 13-11-2026)

**F4.T1 Harvey H-02**
- Ficheros: `docs/legal/harvey/…-lote-H-02.md`.
- Migración: no.
- Aceptación: veredictos de los diez puntos de H-02 (§9): cribado del 3.1, perfilado en tarificación, 25.1 a) con pacto, 25.1 c) en uso general, ajuste fino (RH-4), 6.3 del proveedor invocado por el desplegador, salvaguardias del 5.1 bis a), receptor del 53.1 b), criterio de apoyo del 111.2 (RH-2) y 2.13, anotados antes de F4.T7. Ya no se pregunta por el 3.68 (C17) ni por el 5.1 bis por rol (C13).
- Test: el test de derivación (F4.T4) lee `registro.json`: una regla marcada «a validar por H-02» sin veredicto deriva DEPENDE o PENDIENTE_LEGAL.
- Gates: G-HARVEY.
- Cierra: GC-11, GC-18, GC-25, GC-26, GC-27, GC-72, GC-112, GC-114, GC-116.

**F4.T2 Hoja de cribado y criterio de «qué cuenta como sistema»**
- Ficheros: crear `src/lib/aims/cribado.ts` y su test; crear `cuentaComoSistema()` en `src/lib/aims/vocabulario.ts` (o en una hoja propia) con los resultados del cribado y los estados de práctica prohibida.
- Migración: no.
- Aceptación: C0_1 a C0_5 con exclusiones de las Directrices. CONTRATO_MODELO y HOJA_DE_RUTA no se criban. `cuentaComoSistema()` (`inventory_kind = SISTEMA_IA` y `ai_definition_result ≠ NO_ES_SISTEMA_IA`) es el único criterio de recuento (DS-34).
- Test: `cribado.test.ts`; G-ARISTA `src/test/aims/cuenta-como-sistema.test.ts`: Dashboard, inventario, readiness, programa y vistas importan y llaman la hoja y ninguna la reimplementa, con control positivo.
- Gates: G-STD, G-ARISTA, `vocabulario-unico.test.ts`.
- Cierra: GC-11, GC-13.

**F4.T3 Hoja de hechos: preguntas S1-S10**
- Ficheros: crear `src/lib/aims/hechos-ria.ts` (preguntas, ayudas en tres secciones, `visibleSi`, tipos) y su test.
- Migración: no.
- Aceptación: todas las preguntas de §3.1 con cita final. Anexo I A y B. Anexo III por punto con 1 c). Art. 50 en cinco preguntas. Autoridad pública y servicio público separados. `NO_DETERMINADO` admitido. R_8a_pacto como reparto de obligaciones; R_8b y G_2 con la ayuda del ajuste fino (RH-4); F_2 con la referencia obligatoria a la consulta interna (DS-38).
- Test: `hechos-ria.test.ts` (cada pregunta con cita; ninguna ayuda con «SOLO si»).
- Gates: G-STD.
- Cierra: GC-12, GC-16, GC-17, GC-23, GC-25, GC-33, GC-112, GC-114.

**F4.T4 Derivación en la hoja**
- Ficheros: `hechos-ria.ts` (`derivarRoles`, `derivarNivel`, `derivarAmbito`); tabla de verdad de al menos 30 casos.
- Migración: no.
- Aceptación: derivación de §3.2. 3.3 conjuntivo. 25.1 solo si es Alto; el pacto del 25.1 a) no excluye la conversión. 6.3 del propio sujeto solo para el proveedor y bloqueado por perfilado; el desplegador con E63_ref_proveedor y sin perfilado queda PENDIENTE_LEGAL hasta H-02. Art. 50 acumulable. Importador, distribuidor y representante en PENDIENTE_LEGAL.
- Test: tabla de verdad con los casos obligatorios de §3.3, incluidos el 25.1 a) con pacto y los dos del desplegador con y sin referencia del proveedor.
- Gates: G-STD.
- Cierra: GC-02, GC-18, GC-19, GC-32, GC-112, GC-113, GC-114, GC-122.

**F4.T5 Aplicabilidad única**
- Ficheros: crear `src/lib/aims/aplicabilidad.ts` y su test; `perfil-aplicabilidad.ts` y `derivarMarcos` pasan a ser envolturas; gate `src/test/aims/aplicabilidad-unica.test.ts`.
- Migración: no.
- Aceptación: por sujeto devuelve instancias, marcos (agrupados por artículo, con 16 b-l, 20, 21, 26.12 y 86) y catálogo medido. Sin rol, unión con `no_computa`. El wizard, la ficha, el informe, readiness y la declaración la importan.
- Test: `aplicabilidad.test.ts` y `aplicabilidad-unica.test.ts` (G-ARISTA: wizard, ficha, informe, readiness y declaración la importan).
- Gates: G-STD, G-ARISTA.
- Cierra: GC-21, GC-22, GC-24.

**F4.T6 Migración M06: cuestionario v2 y diario de registros**
- Ficheros: `src/test/schema/aims-cuestionario-migration-shape.test.ts`.
- Migración: `…_aims_cuestionario_v2.sql`:
  - columnas v2 y `scope`, e índices por (system_id, entity_id);
  - `ai_systems.ai_definition_*`;
  - `aims_ria_records`, de solo anexión con la lista completa de `kind` (§5.8), `retention_until`, `legal_hold`, `privileged_info` y las columnas de redacción, y `fn_aims_suprimir_datos_registro` (DS-33);
  - inmutabilidad ampliada.
- Aceptación: aborta si hubiera filas COMPLETED sin clasificar (hay 0, medido). Control positivo: dos COMPLETED por sistema y sociedad fallan. Un registro de un kind con datos personales sin `retention_until` se rechaza. La redacción conserva kind, fechas y `original_hash`; cualquier otro UPDATE o DELETE se rechaza.
- Test: `aims-cuestionario-migration-shape.test.ts`; G-VIVO-NEG del UPDATE directo sobre `aims_ria_records`; G-VIVO-REV de la redacción gobernada.
- Gates: G-MIG, G-ISO, G-VIVO-NEG, G-VIVO-REV.
- Cierra: GC-01, GC-16, GC-28.

**F4.T7 Migración M07: espejo SQL de la derivación**
- Ficheros: `src/test/schema/aims-cuestionario-live.test.ts` **reescrita** (DS-31): deja de crear sistemas PROBE, de completar contra Cloud y de confiar en el CASCADE para limpiar (hoy lo hace en las líneas 48-98, con `fn_aims_registrar_sistema` v1). Compara SQL y TS llamando solo a las funciones IMMUTABLE.
- Migración: `…_aims_derivacion_v2.sql`: `fn_aims_derivar_{hechos,roles,nivel,ambito}_v2`, `fn_aims_obligaciones_aplicables` y `fn_aims_marcos_desde_catalogo`.
- Aceptación: SQL = TS en todos los casos de la tabla de verdad. La sonda no deja ninguna fila en Cloud (control: recuento de `ai_systems` y cuestionarios antes y después, igual).
- Test: `aims-cuestionario-live.test.ts` reescrita.
- Gates: G-MIG, G-VIVO-NEG, G-HARVEY.
- Cierra: GC-02, GC-20.

**F4.T8 Migración M08: completar v2 y cribar**
- Ficheros: `src/hooks/useAimsClasificacion.ts`, `src/lib/aims/errores-rpc.ts`.
- Migración: `…_aims_completar_v2.sql`: `fn_aims_completar_cuestionario_v2` (§3.3) y `fn_aims_cribar_sistema`; `REVOKE EXECUTE` a authenticated de `fn_aims_completar_cuestionario(uuid)`, `fn_aims_derivar_rol(jsonb)` y `fn_aims_derivar_nivel(jsonb)`, y la v1 de completar rechaza con `CUESTIONARIO_V1_RETIRADO` si se la llama por un camino SECURITY DEFINER (DS-29).
- Aceptación:
  - rechaza CLASIFICACION_INCOHERENTE si el cliente manda marcos distintos;
  - rechaza ART63_PERFILADO y RESPONSABLE_OBLIGATORIO;
  - un positivo del art. 5 completa en Inaceptable y anota HALLAZGO_ART5 sin revertir;
  - sujetos creados y cerrados según la derivación; una hipótesis sembrada se cierra y se sustituye, nunca se reescribe (DS-34);
  - la verificación comprueba que la v1 ya no escribe (control positivo) y que convive con el índice por (system_id, entity_id), que no tiene filas v1 COMPLETED (medido: 0).
- Test: G-VIVO-NEG de los rechazos y de la llamada a la v1 (`permission denied` o `CUESTIONARIO_V1_RETIRADO`, sin fila); G-VIVO-REV del camino positivo, con cierre de hipótesis en los dos órdenes.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV.
- Cierra: GC-06, GC-20, GC-28.

**F4.T9 Migración M09: alta y revisión de clasificación**
- Ficheros: `src/pages/ai-governance/SistemaNuevo.tsx`, `errores-rpc.ts`.
- Migración: `…_aims_alta_y_revision_clasificacion.sql`: `fn_aims_alta_sistema` (alta con cribado) y `fn_aims_revisar_clasificacion`. `fn_aims_registrar_sistema` queda como alias que solo acepta payload v2 (rechaza el v1 con `CUESTIONARIO_V1_RETIRADO`) y deja de valer como camino de limpieza de sondas (DS-31).
- Aceptación: la palabra «registrar» ya no aparece para el alta (gate de texto). La revisión exige cuatro ojos y ser miembro del órgano, y pasa el sujeto a VIGENTE.
- Test: `sistema-nuevo-cuestionario.test.ts`; G-VIVO-NEG del alias con payload v1 y de la revisión por el mismo usuario.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV.
- Cierra: GC-78, GC-106.

**F4.T10 UI S1 a S3 (ámbito, roles, art. 5)**
- Ficheros: crear `src/components/ai-governance/clasificacion/{SeccionAmbito,SeccionRoles,SeccionArt5}.tsx`; modificar `ClasificacionGuiada.tsx` (selector de sociedad elegible y «copiar desde otra sociedad»).
- Migración: no.
- Aceptación: diez letras con motivo, usos excluidos enlazados a la política y 5.1 bis según el rol. El ámbito se deriva del titular. 2.13 se muestra «pendiente».
- Test: `seccion-art5.test.tsx` (diez letras con motivo; 5.1 bis según el rol) y G-400.
- Gates: G-STD, G-400, G-E2E2T.
- Cierra: GC-12, GC-25, GC-26, GC-27.

**F4.T11 UI S4 a S6 (anexos y 6.3)**
- Ficheros: crear `…/clasificacion/{SeccionAnexoI,SeccionAnexoIII,SeccionArt63}.tsx`.
- Migración: no.
- Aceptación: el 6.3 solo se ofrece al proveedor con puntos marcados. El perfilado lo rechaza en el cliente. El responsable del despliegue anota la referencia del proveedor. Anexo I A y B.
- Test: `seccion-art63.test.tsx` (el 6.3 solo al proveedor con puntos; perfilado rechazado; el desplegador anota la referencia del proveedor).
- Gates: G-STD, G-400.
- Cierra: GC-16, GC-17, GC-18, GC-19.

**F4.T12 UI S7 a S10 (art. 50, hechos, GPAI, fechas)**
- Ficheros: crear `…/clasificacion/{SeccionArt50,SeccionHechos,SeccionGpai,SeccionFechas}.tsx`.
- Migración: no.
- Aceptación: cinco supuestos del art. 50 con sus excepciones. Hechos de S8. Umbral del modelo. Fecha de puesta en servicio y cambio significativo. Finalidad del anexo III dada por la sociedad.
- Test: `seccion-art50.test.tsx` (cinco supuestos con sus excepciones) y `seccion-fechas.test.tsx` (F_2 exige la referencia de la consulta interna).
- Gates: G-STD, G-400.
- Cierra: GC-23, GC-33, GC-72, GC-112.

**F4.T13 Panel de clasificación vigente**
- Ficheros: `src/components/ai-governance/sistema/ClasificacionVigentePanel.tsx`, `ResumenClasificacionConfirmada.tsx`.
- Migración: no.
- Aceptación: muestra roles por sociedad, análisis del art. 5 por letra y la condición y motivación del 6.3 (exportable en F6.T5), con `tieneClasificacionGuiada` por sujeto.
- Test: `clasificacion-vigente.test.tsx` (roles por sociedad y análisis del art. 5 por letra).
- Gates: G-STD, G-400.
- Cierra: GC-19, GC-25.

**F4.T14 Positivo del art. 5: registro, cese y monitor (lado AIMS)**
- Ficheros: `readiness.ts:354, 380-384`, `vocabulario.ts`, ficha del sistema.
- Migración: no.
- Aceptación: el sistema sigue en el inventario con la práctica en CONFIRMADA_CESE. Hay registros HALLAZGO_ART5 y CESE_PRACTICA con responsable. El monitor lee `art5_analysis` (sistemas analizados sobre el total y positivos). El traspaso a GRC (F5.T8) y el dictamen CESE_ART5 de Secretaría (F5.T13) se conectan en F5 desde el registro HALLAZGO_ART5; esta tarea no depende de ellos.
- Test: `readiness.test.ts` (monitor de prácticas prohibidas con un positivo y sin análisis); G-VIVO-REV del registro HALLAZGO_ART5.
- Gates: G-STD, G-VIVO-REV.
- Cierra: GC-28, GC-29.

**F4.T15 Migración M10: registro de modelos y componentes revividos**
- Depende de: D-U7.
- Ficheros: crear `src/hooks/useAimsModelos.ts` y la pestaña `…/sistema/TabCadenaModelos.tsx`; `frontera-backbone.test.ts` (invertido para 2 tablas, con control positivo).
- Migración: `…_aims_modelos_componentes_revive.sql`: `aims_model_registry` con DROP NOT NULL `system_id`, FK a RESTRICT y columnas; `aims_component_inventory` con `system_id` a RESTRICT, columnas, `counterpart_entity_id` y `relation_kind` ACUERDO_INTRAGRUPO (DS-39); grants mínimos.
- Aceptación: GA_IA → modelos de OpenAI y de Anthropic con contrato de acceso, y Gemini excluido. El marco del cap. V solo aparece con PROVEEDOR_GPAI (re-derivado; la declaración no lo arrastra). Un ACUERDO_INTRAGRUPO exige una sociedad del mismo tenant y no un tercero. La verificación comprueba `confdeltype = 'r'` en las FK hacia `ai_systems`.
- Test: `frontera-backbone.test.ts`; `aims-modelos-shape.test.ts` (RESTRICT y CHECK del acuerdo intragrupo).
- Gates: G-MIG, G-ISO, G-STD.
- Cierra: GC-05, GC-13, GC-115, GC-116, GC-117.

### F5 — Integración con GRC y Secretaría

**F5.T1 Harvey H-05 — HECHA (cerrada por H-01, 19-09-2026)**
- Estado: **hecha.** H-01 validó los dos criterios que este lote iba a preguntar: C5 (la EIPD depende del riesgo del tratamiento, no de la clasificación RIA; una herramienta generativa de riesgo limitado con datos de clientes puede requerirla) y C14 (el art. 4 se acredita con medidas adoptadas: formación, instrucciones, política de uso). No se envía H-05.
- Efecto: la necesidad de EIPD por defecto es PENDIENTE con motivo (F5.T11, §5.4); CTR-RIA-ALF-01 se define por medidas adoptadas (F5.T5, F5.T6). La determinación de cada caso concreto es del DPO. La conservación de registros con datos de terceros va a H-17.
- Migración: no.
- Aceptación: veredictos de C5 y C14 enlazados en el ledger a F5.T5, F5.T6 y F5.T11.
- Test: ninguno propio (los de F5.T6 y F5.T11 citan el veredicto).
- Gates: ninguno.
- Cierra: GC-30, GC-41.

**F5.T2 Contrato y gate de frontera**
- Ficheros: crear `docs/superpowers/specs/2026-09-xx-contrato-aims-grc-secretaria-ria.md` y `src/test/aims/frontera-modulos.test.ts` (con señuelos TS y SQL y espejo GRC/Secretaría).
- Migración: no.
- Aceptación: C-01 a C-08 escritos. El gate escanea el TS y las funciones `fn_aims_*` de `supabase/migrations/*aims*` (última definición de cada una); detecta los dos señuelos y pasa sobre el código real.
- Test: `frontera-modulos.test.ts`.
- Gates: G-FRONTERA.
- Cierra: GC-64.

**F5.T3 Migración M11: módulo GRC de IA y obligaciones**
- Depende de: F5.T14 (misma función; va antes).
- Ficheros: `src/test/schema/grc-modulo-ia.test.ts`.
- Migración: `…_grc_modulo_ia_obligaciones.sql`:
  - `grc_modules.ai` en los dos tenants (route `/ai-governance/programa`);
  - rama `OBL-RIA-%` → 'ai' en `fn_sync_obligation_to_backbone`;
  - el `ELSE 'risk'` **se conserva**; el segundo fallback (rama con nombre cuyo módulo no existe en el tenant) pasa a `RAISE` con ERRCODE (medido: hoy no lo usa ninguna fila);
  - columnas de `obligations`;
  - `UNIQUE(tenant_id, code)` tras medir duplicados.
- Aceptación: control positivo: una OBL-RIA-TEST dentro de un bloque con ROLLBACK cae en 'ai'; otra en un tenant sin fila `ai` (simulado dentro del bloque) lanza el RAISE en vez de ir a 'risk'. La verificación **lista** las filas que caen en el ELSE y aborta si no son exactamente las tres de ARGA declaradas (OBL-LGPD-001, OBL-ORSA-001, OBL-SII-001); no exige 0. Ningún UPDATE de filas existentes. RiskEditor ofrece 'ai'.
- Test: `grc-modulo-ia.test.ts` y G-SYNC.
- Gates: G-MIG, G-STD, G-SYNC.
- Cierra: GC-63, GC-67, GC-138.

**F5.T4 `/grc/m/ai` nunca pinta fixtures**
- Ficheros: `src/App.tsx` (ruta explícita antes de la dinámica), test de rutas.
- Migración: no.
- Aceptación: en los dos tenants, `/grc/m/ai` lleva a `/ai-governance/programa`. El branding no cambia (gate).
- Test: `rutas-grc.test.ts`: `/grc/m/ai` redirige en los dos tenants y el branding no cambia.
- Gates: G-STD, G-E2E2T.
- Cierra: GC-63.

**F5.T5 Obligaciones de organización del RIA en GRC**
- Ficheros: crear `scripts/grc/seed-obligaciones-ria-organizacion.ts`.
- Migración: `…_grc_obligaciones_ria_organizacion.sql` (`fn_grc_alta_obligacion_organizacion_ria`, idempotente por código, que falla cerrado sin órgano).
- Aceptación:
  - Garrigues: OBL-RIA-ORG-04 y ORG-05 con `owner_body` = Comité y PI-30, y CTR-RIA-ALF-01 (definido por medidas adoptadas, C14) y CTR-RIA-PI30-01/02.
  - ARGA: solo tras D-U2.
  - `/obligaciones` las muestra con `obligation-coverage.ts` sin excepción.
  - las OBL-RIA se sincronizan a 'ai' (G-SYNC).
- Test: `garrigues-obligaciones-seed.test.ts` y G-SYNC.
- Gates: G-MIG, G-PERSIST, G-SYNC.
- Cierra: GC-30, GC-42, GC-62.

**F5.T6 Registro de formación (art. 4)**
- Ficheros: `src/pages/ControlDetalle.tsx`, crear `src/hooks/useTrainingRecords.ts`.
- Migración: `…_grc_formacion_registros.sql` (`grc_training_records` y `fn_grc_registrar_formacion`).
- Aceptación: se registran medidas por persona y sistema, con versión de contenido. El control se evalúa por medidas adoptadas, no por nivel (validado por Harvey, C14).
- Test: `training-records.test.ts` (el control no lee ningún nivel ni porcentaje).
- Gates: G-MIG, G-ISO, G-STD.
- Cierra: GC-30.

**F5.T7 Acciones con origen en obligación o brecha**
- Ficheros: todos los lectores de `action_plans` en la instantánea, cada uno con su criterio:
  - LEFT JOIN y pintado del origen (hallazgo, obligación RIA, brecha AIMS, cese del art. 5): `src/hooks/useFindings.ts`, `src/pages/grc/MyWork.tsx`, `src/pages/HallazgoDetalle.tsx` y `src/pages/grc/modules/audit/ActionPlans.tsx` (hoy `findings:finding_id(code,…)`);
  - filtro `source = 'HALLAZGO'` donde la semántica es de auditoría: `src/pages/grc/modules/audit/Findings.tsx`, `src/hooks/useBoardPackData.ts` y `src/components/board-pack/BPHallazgos.tsx` (Board Pack de Secretaría, que ya empareja por `finding_id`, `useBoardPackData.ts:268-273`);
  - `src/lib/grc/dashboard-readiness.ts`: cuenta por origen y lo declara;
  - `src/lib/secretaria/sanitized-flow-contracts.ts`: revisar que su contrato no asuma `finding_id` no nulo;
  - se reescriben `src/test/garrigues/hallazgos-planes.test.ts:105`, `plan-accion-siembra-progresiva.test.ts` y `planes-accion-vacio.test.tsx` sobre la invariante «origen tipado del mismo tenant».
- Migración: `…_grc_action_plans_origen.sql`:
  - `finding_id` anulable con CHECK de origen;
  - columnas nuevas y trigger de guardia de las filas de origen AIMS (DS-32);
  - `tenant_id` SET NOT NULL;
  - `REVOKE TRUNCATE, TRIGGER, REFERENCES ON action_plans FROM authenticated` (GC-140);
  - `fn_grc_crear_acciones_desde_aims` y `fn_grc_actualizar_accion`.
- Aceptación: una acción sin hallazgo ni origen falla (control positivo). Una acción BRECHA_AIMS insertada directamente falla. Los lectores de GRC y el Board Pack siguen verdes en los dos tenants, sin cambio en ARGA (hoy no hay acciones sin hallazgo). El cambio se declara en el ledger.
- Test: los tres tests reescritos; G-VIVO-NEG de la inserción directa.
- Gates: G-MIG, G-ISO, G-STD, G-VIVO-NEG, e2e 10-grc; G-E2E2T ampliado con el Board Pack (`/secretaria/board-pack`) y `/grc/m/audit` de ARGA.
- Cierra: GC-69, GC-140.

**F5.T8 Hallazgo de IA en GRC**
- Ficheros: se conecta desde el registro HALLAZGO_ART5 de F4.T14.
- Migración: `…_grc_hallazgo_ia.sql` (`fn_grc_registrar_hallazgo_ia`, código prefijado por tenant).
- Aceptación: un positivo del art. 5 registrado en AIMS crea un hallazgo Crítico y su acción de cese, sin colisión de código entre tenants.
- Test: G-VIVO-REV del camino positivo; G-VIVO-NEG de la llamada sin capacidad.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, G-FRONTERA.
- Cierra: GC-28.

**F5.T9 Terceros de IA**
- Ficheros: `src/pages/grc/TPRM.tsx`, `src/hooks/useThirdParties.ts`, crear `scripts/grc/seed-terceros-ia.ts`; monitor de terceros en `readiness.ts`.
- Migración: `…_grc_terceros_ia.sql` (columnas de IA).
- Aceptación: siete terceros sembrados con país y representante. La ficha pinta el proveedor desde el tercero o el sujeto. El monitor cuenta la diligencia registrada.
- Test: `terceros-ia-seed.test.ts` (siete terceros, idempotente) y `readiness.test.ts` (monitor de terceros cuenta la diligencia).
- Gates: G-MIG, G-PERSIST, G-STD.
- Cierra: GC-05, GC-48, GC-115, GC-121.

**F5.T10 Aristas GRC↔IA**
- Ficheros: crear `scripts/grc/seed-aristas-ia.ts`; `src/components/ai-governance/evaluacion/ControlesDeMedida.tsx` (MD_GOB_01/02 citan la fila real).
- Migración: `…_grc_aristas_ia.sql` (`grc_ai_links` y `fn_grc_vincular_ia`).
- Aceptación: CTR-GARR-33 enlazado a 3 sistemas y a la OBL-RIA sin mover su FK. OBL-GARR-CYBER-02 enlazada al incidente. MG_CIBE enlazadas a controles cyber. La evaluación de Harvey cita CTR-GARR-33.
- Test: `grc-aristas-ia.test.ts` (CTR-GARR-33 enlazado sin mover su `obligation_id`) y G-VIVO-NEG de `fn_grc_vincular_ia` sin capacidad.
- Gates: G-MIG, G-ISO, G-PERSIST.
- Cierra: GC-42, GC-82.

**F5.T11 EIPD: esquema y RPC**
- Ficheros: crear `src/hooks/useDpias.ts`.
- Migración: `…_grc_eipd.sql` (`grc_dpias` y `fn_grc_registrar_eipd`).
- Aceptación: la necesidad exige motivo y su valor por defecto es PENDIENTE, nunca «no requerida» por el nivel RIA (C5). `controller_role` es obligatorio. Consulta al DPO y consulta previa como campos.
- Test: `grc-eipd-shape.test.ts`; G-VIVO-NEG de una necesidad sin motivo.
- Gates: G-MIG, G-ISO, G-VIVO-NEG.
- Cierra: GC-41.

**F5.T12 EIPD: pantalla**
- Ficheros: crear `src/pages/grc/Eipd.tsx` y `src/components/grc/eipd/*` (400 líneas como máximo cada uno); entrada en la navegación de GRC; enlace desde la ficha del sistema; MD_PD_02 lee el objeto.
- Migración: no.
- Aceptación: visible en los dos tenants sin tocar el branding. Harvey y GA_IA muestran la necesidad PENDIENTE. La pantalla se rotula «EIPD (art. 35 RGPD)» y nunca «EIDF»; si el sistema tiene EIDF, enlaza a ella como objeto distinto (DS-37).
- Test: `eipd-pantalla.test.tsx` (rótulos distintos de EIPD y EIDF, con control positivo).
- Gates: G-STD, G-400, G-E2E2T.
- Cierra: GC-41.

**F5.T13 Dictamen del Comité y decisión en Secretaría, con ancla inmutable**
- Ficheros: `src/pages/secretaria/InformesPreceptivos.tsx` (acepta `?ai_system=&entity=&body=&asunto=` y filtra por origen AIMS); crear `src/hooks/useDictamenesIa.ts` (lectura en AIMS).
- Migración: `…_secretaria_dictamen_ia.sql`:
  - `fn_secretaria_registrar_dictamen_ia` con los asuntos de §2.2, incluidos CESE_ART5 (traspaso desde el registro HALLAZGO_ART5 de F4.T14), CAMBIO_SIGNIFICATIVO_111_2, SECRETO_PROFESIONAL y ACUERDO_INTRAGRUPO;
  - `source_domain = 'ai_system'` (convenio en minúsculas medido en la tabla) e índice `(tenant_id, source_domain, source_id)`;
  - endurecimiento de `secretaria_document_artifacts` (GC-139): trigger de inmutabilidad y BEFORE DELETE para `source_domain = 'ai_system'` desde APPROVED, SIGNED, ARCHIVED o SUPERSEDED; `REVOKE ALL FROM anon`; `REVOKE TRUNCATE, TRIGGER, REFERENCES FROM authenticated`; control positivo en la verificación (un UPDATE de un dictamen aprobado falla; el UPDATE de estado de un artefacto de otro dominio sigue pasando).
- Aceptación: un dictamen del Comité más la decisión del Senior Partner quedan enlazados al sistema y no se pueden editar ni borrar después de aprobados. El Comité no aparece como adoptante. Los flujos existentes de Secretaría que actualizan estado (`useSecretariaDocumentArtifacts.ts:539`, `standalone-certifications/document.ts:247`) no cambian.
- Test: `secretaria-dictamen-ia.test.ts`; G-VIVO-NEG del UPDATE y del DELETE de un dictamen aprobado; G-VIVO-REV del alta.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, e2e de Secretaría 14 y 19.
- Cierra: GC-28, GC-72, GC-75, GC-139.

**F5.T14 Corrección del defecto vivo: sincronización de las obligaciones PBC/FT de Garrigues (carril GRC)**
- Origen: medido el 19-09-2026. `fn_sync_obligation_to_backbone` tiene la rama `OBL-GARR-PBC-%` → 'aml' (`20260820130000_g6_cyber_module_and_sync.sql:48`), pero los códigos reales son `OBL-PBC-%`. Las 21 obligaciones PBC/FT de Garrigues (OBL-PBC-01 a OBL-PBC-20 y OBL-PBC-EX-22) caen en el `ELSE` y están hoy en `grc_obligations.module_id = 'risk'` («Riesgos penales») en vez de 'aml' («PBC/FT», que existe en Garrigues). Ningún test lo vigilaba: `g6-ciberseguridad.test.ts:183-190` solo comprueba las de cyber.
- Ficheros: espejo SQL; crear `src/test/schema/grc-sync-modulos.test.ts` (G-SYNC).
- Migración: `…_grc_sync_obligaciones_pbc_aml.sql`:
  - añade la rama `OBL-PBC-%` → 'aml' (sin retirar la antigua, que no casa con nada) como decisión declarada del carril GRC; **el `ELSE 'risk'` no se toca ni pasa a RAISE**;
  - re-sincronización declarada: `UPDATE grc_obligations SET module_id = 'aml', updated_at = now() WHERE tenant_id = '…0002' AND reference LIKE 'OBL-PBC-%' AND module_id = 'risk'`, que debe afectar exactamente a 21 filas o aborta. No borra, no recrea y no toca `obligations` ni ARGA (ninguna obligación de ARGA empieza por `OBL-PBC-`, medido);
  - bloque de verificación: las 21 en 'aml'; las 3 de ARGA siguen en 'risk'; control positivo con una `OBL-PBC-TEST` dentro de un bloque con ROLLBACK que cae en 'aml'.
- Aceptación: G-SYNC en verde en los dos tenants. Antes y después en el ledger (21 filas de Garrigues con su `module_id`). Si alguna pantalla o KPI de GRC contaba esas obligaciones como riesgos penales, el cambio se declara.
- Test: `grc-sync-modulos.test.ts`.
- Gates: G-MIG, G-SYNC, G-PERSIST.
- Cierra: GC-138.

### F6 — Registro, entregables y gestión (carril rápido antes del 2-12-2026: T1, T2, T3, T4, T5, T8 y T14)

T2 y T5 van en el carril rápido: las alarmas de T8 salen de las instancias de T2, y los entregables del art. 50 de T4 solo se aprueban con las RPC de T5.

**F6.T1 Migración M12: registro de cumplimiento**
- Ficheros: crear `src/lib/aims/estado-organizacion.ts` (DS-07) y su test; `src/test/schema/aims-registro-shape.test.ts`.
- Migración: `…_aims_registro_cumplimiento.sql`: instancias, entregables, links, designaciones y fases (con `fn_aims_fijar_programa`); triggers de CUMPLIDA, ORGANIZACION e inmutabilidad; `fn_aims_estado_organizacion` (espejo SQL de la hoja); `fn_audit_worm`; CHECK de `aims_evidence_items.kind` ampliado.
- Aceptación: CUMPLIDA sin entregables aprobados falla (control positivo). Una ORGANIZACION con estado manual falla. Una ORGANIZACION con el control Efectivo y el programa sin aprobar queda EN_CURSO con el motivo, no CUMPLIDA.
- Test: `estado-organizacion.test.ts` con los estados de control (Efectivo, Parcial, Inefectivo y sin control) y un entregable pendiente, y G-VIVO-NEG de la paridad SQL = TS sobre esos casos (función IMMUTABLE).
- Gates: G-MIG, G-ISO, G-VIVO-NEG.
- Cierra: GC-61, GC-62, GC-65.

**F6.T2 Sincronización de instancias (carril rápido)**
- Ficheros: crear `src/hooks/useAimsObligaciones.ts`.
- Migración: `…_aims_sincronizar_obligaciones.sql` (`fn_aims_sincronizar_obligaciones` y `fn_aims_actualizar_obligacion`, con items y N/A motivado), invocada desde la RPC de completar.
- Aceptación: es idempotente (segunda corrida sin cambios). Lo que deja de aplicar pasa a NO_APLICA sin borrarse. Las de organización llaman a la RPC de GRC. Antes del 27-11 existen las instancias EXIGIBLE_DESDE del 5.1 b bis/b ter y del 50.2 de ARGA Assist y GA_IA de las que salen las alarmas de F6.T8.
- Test: sonda SQL = `aplicabilidad.ts` en G-VIVO-REV; G-VIVO-NEG de la actualización sin capacidad.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, G-FRONTERA.
- Cierra: GC-61, GC-62.

**F6.T3 Catálogo del proveedor no alto riesgo y art. 50 del proveedor**
- Depende de: H-14 (contenido y carácter del catálogo; sin veredicto, «Cobertura provisional»).
- Ficheros: crear `src/lib/aims/catalogos/proveedor-no-alto-riesgo.ts`; medidas del 50.1 y 50.2 en los dos catálogos del proveedor; `aplicabilidad.ts`.
- Migración: no.
- Aceptación: PROVEEDOR Limitado o Mínimo se mide contra el catálogo nuevo y no contra las 84, con su rótulo. ARGA Assist tiene 50.1 y 50.2, con exigibilidad el 2-12-2026 por el 111.4 (validado, RH-6).
- Test: `aplicabilidad.test.ts` (proveedor Limitado → catálogo nuevo; con alto riesgo → las 84) y G-ARISTA.
- Gates: G-STD, G-ARISTA, G-HARVEY (H-14).
- Cierra: GC-34, GC-35, GC-40.

**F6.T4 Entregables del art. 50**
- Ficheros: `src/lib/aims/ria/entregables-esquemas.ts` y plantillas `src/lib/doc-gen/plantillas/ria/{d53,d54,d55,d56,d57,d58,d59}.hbs`; ítems 50.5 transversales.
- Migración: no; el CHECK de `kind` ya se amplió en M12.
- Aceptación:
  - superficies de interacción, excepción «evidente» y texto del aviso;
  - solución de marcado con justificación y aportación del modelo;
  - 50.3;
  - 50.4 con la excepción invocada;
  - d56 («Información», art. 50) dentro del paquete;
  - evidencias CAPTURA y PRUEBA_ACCESIBILIDAD;
  - d60 como subentregable.
- Test: `entregables-esquemas.test.ts`: los `campos_requeridos` de cada tipo cubren los apartados del art. 50 que cita, cotejados contra el índice congelado del RIA (F3.T8).
- Gates: G-STD, G-HARVEY (H-10).
- Cierra: GC-34, GC-35, GC-36, GC-37, GC-38, GC-65.

**F6.T5 Guardar y aprobar entregables, d1, d2 y d6**
- Carril rápido: la migración de las RPC y su uso con los tipos del art. 50. d1, d2 y d6 pueden ir hasta el 18-12.
- Ficheros: crear `src/hooks/useAimsEntregables.ts`; plantillas d1 (aplicabilidad), d2 (art. 5) y d6 (categorización y 6.4).
- Migración: `…_aims_entregables_rpc.sql` (`fn_aims_guardar_entregable` y `fn_aims_aprobar_entregable`, que rechaza TIPO_SIN_ESQUEMA).
- Aceptación: la aprobación la hace un miembro distinto del autor, con SHA-512 de servidor e inmutabilidad, sin firma. Un tipo sin esquema publicado no se aprueba. d1 se genera por sistema y sociedad, d2 desde `art5_analysis` y d6 con la condición y la motivación.
- Test: G-VIVO-NEG (autoaprobación, tipo sin esquema y UPDATE de un APROBADO, rechazados sin fila) y G-VIVO-REV de la aprobación válida.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, G-CLAIMS.
- Cierra: GC-12, GC-19, GC-25, GC-65.

**F6.T6 Pantallas de obligaciones y entregables**
- Ficheros: crear `src/pages/ai-governance/Obligaciones.tsx`, `EntregableDetalle.tsx`, `src/components/ai-governance/registro/*` y la pestaña Obligaciones de la ficha; exportación CSV.
- Migración: no; vista `v_aims_registro_cumplimiento` en M12.
- Aceptación: filtros por fase, rol, especialidad, carácter, sociedad, sistema y exigibilidad. Exportación con las columnas del Excel. N/A motivado editable con capacidad.
- Test: `obligaciones.test.tsx` (filtros y columnas del Excel en la exportación) y G-VIVO-NEG del N/A motivado sin capacidad.
- Gates: G-STD, G-400, G-E2E2T.
- Cierra: GC-61, GC-65.

**F6.T7 Programa y cuadro de mando**
- Ficheros: crear `src/lib/aims/programa-fases.ts`, `src/lib/aims/cuadro-mando.ts`, `src/pages/ai-governance/Programa.tsx` y `src/components/ai-governance/programa/*`.
- Migración: no.
- Aceptación: embudo de 5 fases por sistema y sociedad. Regularización inmediata de los arts. 4 y 5. Avance por rol, carácter y especialidad. «Avance documental» en las continuas. Las fechas de fase las fija el órgano.
- Test: `programa-fases.test.ts` y `cuadro-mando.test.ts` (0/0 gris; lo latente aparte; entregables únicos) y G-ARISTA.
- Gates: G-STD, G-400, G-ARISTA.
- Cierra: GC-66, GC-70.

**F6.T8 Alarmas y acciones requeridas**
- Ficheros: crear `src/lib/aims/alarmas.ts`; bandeja en `Dashboard.tsx` y en el programa.
- Migración: no.
- Aceptación: distingue «ya exigible» de «exigible el…». Con el dato vivo de ARGA Assist y GA_IA, la bandeja muestra antes del 27-11 las alarmas de 5.1 b bis/b ter y de 50.2 para el 2-12-2026. Muestra el ámbar del 4 bis (RH-3) donde proceda. «Próximos pasos» se deriva.
- Test: `alarmas.test.ts` (fechas del 2-12-2026 y del 4 bis) y el e2e de la portada en los dos tenants.
- Gates: G-STD, G-ARISTA, G-E2E2T.
- Cierra: GC-35, GC-49, GC-68, GC-93.

**F6.T9 Reapertura y cadencia**
- Ficheros: crear `src/lib/aims/revision-pendiente.ts`; ficha, inventario, Dashboard y programa.
- Migración: `…_aims_revision_cadencia.sql` (`fn_aims_fijar_cadencia` y `fn_aims_disparadores_revision`).
- Aceptación: cada disparador de §6.5 marca «clasificación a revisar» por sujeto, incluido el cambio significativo solo con dictamen (DS-38). La cadencia la fija el órgano. La reevaluación parte de la anterior con diferencias.
- Test: `revision-pendiente.test.ts` (un caso por disparador) y G-ARISTA.
- Gates: G-MIG, G-STD, G-ARISTA.
- Cierra: GC-71, GC-73.

**F6.T10 Acciones vivas desde AIMS**
- Ficheros: `supabase/…` (`fn_aims_freeze_assessment` ampliada), crear la pestaña `…/sistema/TabAcciones.tsx`; `src/components/ai-governance/evaluacion-detalle/PlanYNotas.tsx` (columna Responsable).
- Migración: `…_aims_freeze_crea_acciones.sql`.
- Aceptación: al congelar se crean acciones BRECHA_AIMS una sola vez. El estado se actualiza desde la ficha por la RPC de GRC. La especialidad se hereda. Una acción de organización es única.
- Test: G-VIVO-REV de congelar con brechas (acciones creadas una vez; segunda congelación no duplica) y G-FRONTERA sobre `fn_aims_freeze_assessment` (solo llama a `fn_grc_crear_acciones_desde_aims`).
- Gates: G-MIG, G-VIVO-REV, G-FRONTERA.
- Cierra: GC-69, GC-70.

**F6.T11 Art. 4 en cada sistema**
- Ficheros: crear `…/sistema/TabAlfabetizacion.tsx`; `src/hooks/useAimsDesignaciones.ts`.
- Migración: `…_aims_designar.sql` (`fn_aims_designar`).
- Aceptación: población designada, medidas adoptadas del periodo y estado de OB-09 leído del control de GRC. Rotulado «el art. 4 no exige un nivel».
- Test: `tab-alfabetizacion.test.tsx` (rótulo «el art. 4 no exige un nivel»; el estado de OB-09 viene del control) y G-VIVO-NEG de `fn_aims_designar` sin capacidad.
- Gates: G-MIG, G-STD, G-CLAIMS.
- Cierra: GC-30.

**F6.T12 SGC y art. 16 por letras**
- Ficheros: instancia de organización del 17 con `items_estado`; checklist del 16 en la ficha; manual del SGC como entregable, que Políticas registra con `policy_id`.
- Migración: no.
- Aceptación: una instancia con letras pendientes no se cierra. El 17.4 se aplica a entidades financieras.
- Test: `sgc-items.test.ts`: una instancia del 17 con letras pendientes no se cierra; el 17.4 solo con `entidad_financiera`.
- Gates: G-STD.
- Cierra: GC-99, GC-100.

**F6.T13 Registro de requerimientos**
- Ficheros: crear `…/sistema/TabRequerimientos.tsx` y un paquete exportable.
- Migración: no; usa `aims_ria_records`.
- Aceptación: REQUERIMIENTO y RESPUESTA con plazo, lengua, entrega, confidencialidad (74.14, 78) y acceso a logs y código (74.13). Incluye 26.12, 91.5 y 92.5. Cada requerimiento lleva `privileged_info` («afecta a información amparada por secreto profesional») y, si es sí, remite a la posición documentada del despacho (dictamen SECRETO_PROFESIONAL de F5.T13, punto del Comité de F0.T5, H-16). Sin esa posición, la pantalla dice «posición del despacho sobre secreto profesional pendiente del Comité de IA». La herramienta no decide si se entrega.
- Test: `requerimientos.test.tsx` (con `privileged_info` y sin dictamen, aviso visible) y G-VIVO-NEG del UPDATE de un registro.
- Gates: G-STD, G-VIVO-NEG, G-HARVEY (H-16).
- Cierra: GC-111.

**F6.T14 Esquema mínimo y plantilla genérica de todos los tipos de entregable (carril rápido)**
- Ficheros: generador `scripts/aims/generar-esquemas-entregables.ts`, que produce desde `src/lib/aims/ria/entregables.ts` un esquema mínimo por tipo (campos de las letras del precepto que cita) y una plantilla genérica en `src/lib/doc-gen/plantillas/ria/generica.hbs`; `entregables-esquemas.ts`. Los tipos con plantilla específica (art. 50, d1, d2, d6 y los de F8 y F9) la sustituyen después sin cambiar el esquema mínimo.
- Migración: `…_aims_catalogo_ria_v1_0_1.sql`, generada: nueva `catalog_version` del catálogo de entregables, solo anexión, con `schema_key` y `campos_requeridos` de todos los tipos. Va antes que F6.T5 para que la aprobación de los del art. 50 no choque con TIPO_SIN_ESQUEMA.
- Aceptación: los 76 tipos del experto, D-A1 a D-A6 y los D-T* tienen esquema. Incluye d7 a d41 (importador y distribuidor, d31 a d41), d56, d64 a d69 y d70 a d76 (arts. 21, 72, 73, 74 y 86). d76 queda mapeado a OB-65 (art. 86) y d56 al art. 50.
- Test: `entregables-esquemas.test.ts` exige un esquema por cada d-id requerido por alguna fila del catálogo y falla ante un d-id requerido sin esquema (control positivo con un d-id inventado); `catalogo-ria-cloud.test.ts` comprueba la paridad TS/Cloud de la versión nueva.
- Gates: G-STD, G-MIG.
- Cierra: GC-65.

### F7 — Catálogos de medidas corregidos

**F7.T1 Harvey H-06**
- Ficheros: `docs/legal/harvey/…-lote-H-06.md`.
- Migración: no.
- Aceptación: veredictos de H-06 (§9): control editorial del 50.4 p. 2, alcance del 4 bis.2 a los responsables del despliegue, 73.9 frente a DORA y Solvencia II, y contenido y carácter de cada medida de DESPLIEGUE_ALTO_RIESGO y ORGANIZACION. Ya no se pregunta por el 74.6 (C16), el carácter habilitante del 4 bis (C2) ni el carácter de las cuatro medidas (H-02A, F1.T15).
- Test: el test de F7.T2 lee `registro.json`: una medida sin veredicto sigue en «Cobertura provisional».
- Gates: G-HARVEY.
- Cierra: GC-36, GC-39, GC-76, GC-83, GC-93.

**F7.T2 Catálogo del perfil B**
- Ficheros: crear `src/lib/aims/catalogos/despliegue-alto-riesgo.ts`.
- Migración: no.
- Depende de: H-06 (contenido y carácter de cada medida).
- Aceptación: una medida por apartado del 26 (1, 2, 4, 5, 6, 7, 8 si procede, 11 y 12), más 27, 26.9, 4, EIPD, MD_PD_05, 25 y 86. Recepción de instrucciones. Rótulo «Cobertura provisional — Comité de IA», que además se mantiene en cada medida sin veredicto de H-06.
- Test: `despliegue-alto-riesgo.test.ts`: cada medida tiene `obligation_codes`, carácter y cita que resuelve en el índice congelado; G-ARISTA.
- Gates: G-STD, G-ARISTA, G-HARVEY (H-06).
- Cierra: GC-83, GC-114.

**F7.T3 Cláusulas de entidades financieras**
- Ficheros: predicados de las filas añadidas; `autoridad-competente.ts`.
- Migración: no.
- Aceptación: `entidad_financiera` activa 9.10, 17.4 (salvo g-i), 18.3, 19.2, 26.5 p. 2-3, 26.6 p. 2 y 72.4 p. 2. 74.6 según DS-22 (validado, C16). EIOPA-BoS-25-360 como MARCO_OPERATIVO.
- Test: tabla SQL = TS con una aseguradora de ARGA (APLICA) y una sociedad del despacho (NO_APLICA) por cláusula.
- Gates: G-STD, G-HARVEY.
- Cierra: GC-76.

**F7.T4 Art. 4 bis**
- Ficheros: `catalog-aesia.ts` (MG_DATA_10), catálogos de despliegue.
- Migración: no.
- Aceptación: cita al 4 bis, disparador, seis condiciones como items y `rat_ref`, también para responsables del despliegue (4 bis.2, H-06). Matiz de C2 aplicado: la condición f) obliga a documentar las razones de la necesidad estricta **en el registro de ese tratamiento** (`rat_ref` del tratamiento concreto); no se presenta como deber general de actualizar el registro del art. 30 RGPD. Exigibilidad: PENDIENTE_LEGAL con alarma ámbar «posiblemente exigible desde el 27-7-2026» (RH-3) hasta el cotejo de F0.T2; si se verifica, EXIGIBLE.
- Test: `catalog-aesia.test.ts` (MG_DATA_10 con las seis condiciones y el texto del matiz de C2).
- Gates: G-STD.
- Cierra: GC-93.

**F7.T5 Migración M13: publicación del catálogo v1.1**
- Ficheros: generador de migración; paridad.
- Migración: `…_aims_catalogo_ria_v1_1.sql` (filas nuevas, solo anexión).
- Aceptación: paridad TS/Cloud. Resincronización por lotes idempotente en los dos tenants. Lo que cambia queda en el ledger.
- Test: `catalogo-ria-cloud.test.ts`; la resincronización va como G-VIVO-REV antes de ejecutarse con la sesión de un administrador de cada tenant.
- Gates: G-MIG, G-VIVO-REV, G-PERSIST.
- Cierra: GC-60.

### F8 — Riesgo, EIDF, incidentes y vigilancia

**F8.T1 Migración M14: riesgo del sistema en GRC**
- Ficheros: `src/hooks/useRisks.ts`.
- Migración: `…_grc_riesgo_ia.sql`: columnas de `risks`; trigger de guardia de `residual_score`, `residual_*`, `measure_codes`, `residual_accepted_artifact_id`, `harm_scale` y `ai_system_id` en las filas con sistema (DS-32; medido: `residual_score` no es generada y `useRisks.ts:119` hace `update(input)` genérico); `REVOKE TRUNCATE, TRIGGER, REFERENCES ON risks FROM authenticated` (GC-140); `fn_grc_proponer_riesgo_ia`, `fn_grc_evaluar_riesgo_ia` (L1-L4 no rebaja) y `fn_grc_aceptar_residual` (con artefacto de Secretaría inmutable y aceptante distinto).
- Aceptación: control positivo: una rebaja apoyada en L3 se rechaza con RESIDUAL_SIN_MEDIDA_ACREDITADA. Un UPDATE directo de `residual_score` en un riesgo con sistema se rechaza; en un riesgo sin sistema (todos los de hoy) sigue pasando.
- Test: G-VIVO-NEG del UPDATE directo y de la rebaja con L3; G-VIVO-REV de la evaluación y la aceptación válidas.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, G-FRONTERA.
- Cierra: GC-74, GC-140.

**F8.T2 RiskEditor, RSK-STRA-005 y aristas de ARGA**
- Ficheros: `src/pages/grc/RiskEditor.tsx`, `RiskDetalle.tsx`, `Risk360.tsx`; crear `scripts/grc/seed-riesgos-ia-arga.ts`.
- Migración: no.
- Aceptación: residual escribible por la RPC. `harm_scale` declarada y «escala sin leyenda aprobada». RSK-STRA-005 (pricing de automóvil, medido) queda **sin sistema**, con nota aditiva en `assessment_provenance` («no hay sistema de pricing de automóvil inventariado»; el título no se toca), salvo que el usuario decida dar de alta un CANDIDATO. RSK-TECH-005 y RSK-TECH-006 se enlazan por `grc_ai_links` a los sistemas que describen. Los tres siguen en ARGA Seguros, S.A.; la diferencia con la sociedad del sujeto (ARGA Vida para ARGA Score) se pinta y se declara en el ledger. Risk360 no suma perspectivas.
- Test: `seed-riesgos-ia-arga.test.ts` (RSK-STRA-005 sin arista a sistema; idempotente) y e2e 10-grc.
- Gates: G-STD, G-PERSIST, e2e 10-grc.
- Cierra: GC-58, GC-74.

**F8.T3 Riesgo en la ficha de AIMS y señal a GRC**
- Ficheros: crear `…/sistema/TabRiesgo.tsx`; `src/lib/aims/plan-adaptacion.ts:54-60`; `readiness.ts:143-156`.
- Migración: no.
- Aceptación: la prioridad sale del residual. La señal a GRC sale del residual no aceptado. Desaparece el disparo por puntuación inferior a 80.
- Test: `plan-adaptacion.test.ts` (sin residual no hay señal; con residual no aceptado, sí) y G-ARISTA.
- Gates: G-STD, G-ARISTA.
- Cierra: GC-52, GC-74.

**F8.T4 Migración M15: EIDF revivida**
- Depende de: D-U7.
- Ficheros: `frontera-backbone.test.ts` (invertido para 2 tablas); `docs/legal/harvey/…-lote-H-07.md`.
- Migración: `…_aims_eidf_revive.sql` (cabecera y referencias cruzadas con las FK a RESTRICT; grants mínimos; `fn_aims_guardar_eidf` y `fn_aims_congelar_eidf`).
- Aceptación: `sections` a)-f) con la e). `dpia_id` → `grc_dpias`. Una referencia a la EIPD marca la sección «completada por la EIPD» y no permite congelar si la sección no tiene contenido propio en las letras que H-07 señale (DS-37). Congelación con hash. La verificación comprueba `confdeltype = 'r'`.
- Test: `aims-eidf-shape.test.ts` (RESTRICT; congelar con una sección solo remitida falla) y G-VIVO-NEG.
- Gates: G-MIG, G-ISO, G-VIVO-NEG, G-HARVEY (H-07).
- Cierra: GC-41, GC-90.

**F8.T5 EIDF: pantalla y predicado**
- Ficheros: crear `…/sistema/TabEidf.tsx` (visible solo si aplica) y `src/components/ai-governance/eidf/*`.
- Migración: no.
- Aceptación: predicado DS-21 (validado, C6). La sección d) enlaza a riesgos de GRC. 27.2 y 27.3 como registro. ARGA Score muestra LATENTE_111_2 sin rojo (C7). La pestaña se rotula «EIDF (art. 27 RIA)», distinta de la EIPD, y cada remisión a la EIPD se pinta como complemento, no como cierre (DS-37).
- Test: `tab-eidf.test.tsx` (visible solo si aplica; rótulo distinto de EIPD; ARGA Score sin rojo).
- Gates: G-STD, G-400.
- Cierra: GC-41, GC-90.

**F8.T6 Calificación del incidente y autoridad**
- Ficheros: crear `src/lib/aims/autoridad-competente.ts` y su test; `…/incidente/EdicionIncidente.tsx`, `FormularioIncidente.tsx` y `SubexpedientesRegimen.tsx:29-38`.
- Migración: `…_aims_incidente_calificacion.sql`: columnas `ria_*` de `ai_incidents`, trigger de guardia (DS-32; medido: la tabla admite UPDATE directo) y `fn_aims_calificar_incidente`.
- Aceptación: letras a)-d) o NO_ES_GRAVE motivado, y solo por la RPC. Autoridad **por entidad** (DS-36, RH-7): régimen, sociedad, Estado miembro y sector (DS-22). Para una sociedad no financiera de España, la autoridad nacional general de IA (previsiblemente AESIA, pendiente de H-15); para la aseguradora del caso DS-22, DGSFP. Editable con motivo. Sin AESIA fijo para todo el tenant.
- Test: `autoridad-competente.test.ts` con una sociedad de cada tenant, la sucursal de Portugal y Garrigues Varsovia; G-VIVO-NEG del UPDATE directo de `ria_qualification`.
- Gates: G-MIG, G-STD, G-ARISTA, G-VIVO-NEG, G-HARVEY (H-15).
- Cierra: GC-77, GC-109.

**F8.T7 Migración M16: regímenes, relojes, informes y compuerta**
- Ficheros: `src/hooks/useAimsMultiregime.ts:87-137`, `…/incidente/RelojesRegulatorios.tsx`.
- Depende de: D-U7.
- Migración: `…_aims_regimenes_relojes_informes.sql`:
  - CHECK de estados;
  - `fn_aims_abrir_regimen` (escribe `entity_id`) y `fn_aims_transicion_regimen`;
  - `aims_regulatory_clocks` y `aims_incident_reports` revividas, con `incident_regime_id` a RESTRICT;
  - `aims_incident_regimes.entity_id → entities` e `incident_id → ai_incidents` de CASCADE a RESTRICT (medido CASCADE);
  - `exigible` calculado, con la regla de DS-35 (el 73 hereda la fecha del anexo y la latencia del 111.2).
- Aceptación: NOTIFIED sin informe falla. El reloj del art. 73 de un sistema no exigible se pinta «simulacro — no exigible». La verificación comprueba `confdeltype = 'r'` en las cuatro FK.
- Test: `incidente-regimenes-escritura.test.ts`; G-VIVO-NEG de NOTIFIED sin informe.
- Gates: G-MIG, G-ISO, G-VIVO-NEG.
- Cierra: GC-01, GC-86, GC-108.

**F8.T8 Reloj por rol y cadena del 26.5**
- Ficheros: `src/lib/aims/incident-clocks.ts:21, 132, 258`, `TabVigilancia.tsx` (rótulo por rol).
- Migración: no.
- Aceptación: el responsable del despliegue ve «informar al proveedor» y la cadena. Suspensión con `suspended_at`. El 73 solo si no se localiza al proveedor (C15, tal como se formuló; el matiz de Harvey sobre el 73.4 no se aplica). d45 y d46 son generables.
- Test: `incident-clocks.test.ts` (responsable del despliegue sin reloj del 73 salvo proveedor no localizado) y G-ARISTA.
- Gates: G-STD, G-ARISTA.
- Cierra: GC-86.

**F8.T9 Investigación del art. 73.6**
- Ficheros: `IncidenteDetalle.tsx`, `EdicionIncidente.tsx:114` (aviso en la ayuda).
- Migración: no.
- Aceptación: registro INVESTIGACION_73_6 con evaluación de riesgo y vínculo al subexpediente. El bloqueo de versión se completa en F9.T1.
- Test: `investigacion-73-6.test.tsx` (el registro exige el subexpediente).
- Gates: G-STD.
- Cierra: GC-110.

**F8.T10 Migración M17: vigilancia con mediciones**
- Ficheros: `TabVigilancia.tsx`, crear `src/hooks/useAimsMediciones.ts`.
- Depende de: D-U7.
- Migración: `…_aims_vigilancia_mediciones.sql`: `aims_monitoring_measurements` (con `indicator_id` a RESTRICT), `indicators.risk_id`, `v_aims_indicator_status`, `fn_aims_registrar_medicion` y `aims_post_market_plans` revivida con `system_id` a RESTRICT.
- Aceptación: un umbral superado propone una acción o un incidente. Se lee el plan de ARGA sin tocarlo. Se admiten datos del desplegador (72.2).
- Test: `v-aims-indicator-status.test.ts` (sin medición, dentro y fuera de umbral) y G-VIVO-NEG del UPDATE sobre una medición.
- Gates: G-MIG, G-ISO, G-STD, G-VIVO-NEG.
- Cierra: GC-50, GC-107.

**F8.T11 Supervisores del 26.2 y datos de entrada del 26.4**
- Ficheros: `TabAlfabetizacion.tsx` o una pestaña de designaciones; secciones 26.2 y 26.4 del protocolo de despliegue d42 (d43 y d44 son alias, §4.4: no hay plantillas propias).
- Migración: no.
- Aceptación: SUPERVISOR_HUMANO_26_2 con competencia, autoridad, alcance y formación enlazada. Medida y sección del protocolo del 26.4. El avance cuenta d42 una sola vez.
- Test: `entregables-esquemas.test.ts` (d42 tiene las secciones 26.1, 26.2 y 26.4; no existen esquemas propios para d43 y d44) y `cuadro-mando.test.ts` (d42 cuenta una vez).
- Gates: G-STD, G-400.
- Cierra: GC-84, GC-85.

**F8.T12 Trabajadores, afectados y art. 86**
- Ficheros: plantillas d48 y d49 (26.7 y 26.11), d50 (modelo de comunicación del 26.11) y **d76** (protocolo de respuesta al art. 86, entregable de OB-65); `TabRequerimientos.tsx` (solicitudes del 86).
- Migración: no.
- Aceptación: 26.7 por sociedad empleadora antes de la puesta en servicio. 26.11 con coordinación con los arts. 13, 14 y 22 RGPD. Solicitudes del 86 con plazo tomado por analogía del 12.3 RGPD, marcado TGMS_AÑADIDO hasta H-10, exclusión del punto 2 y subsidiariedad del 86.3. Los registros SOLICITUD_EXPLICACION_86, INFORMACION_AFECTADOS_26_11 e INFORMACION_TRABAJADORES_26_7 guardan referencias o seudónimos y `retention_until` (DS-33, H-17).
- Test: `entregables-esquemas.test.ts` (d76 cubre el 86.1 y el 86.3 contra el índice congelado) y G-VIVO-NEG de un registro con datos personales sin `retention_until`.
- Gates: G-STD, G-VIVO-NEG, G-HARVEY (H-10, H-17).
- Cierra: GC-87, GC-88, GC-89.

### F9 — Régimen documental del proveedor de alto riesgo

**F9.T1 Migración M18: versiones con clase de cambio**
- Ficheros: `…/sistema/VersionesSistema.tsx` (pregunta obligatoria; incluye VALIDATION); `docs/legal/harvey/…-lote-H-08.md`.
- Migración: `…_aims_versiones_cambio.sql`: columnas de §2.2 con trigger de guardia (DS-32; medido: la UI escribe hoy la tabla directamente); `fn_aims_registrar_version` con VERSION_DURANTE_INVESTIGACION y con SIGNIFICATIVO_111_2 solo si trae `change_consultation_artifact_id` de un dictamen CAMBIO_SIGNIFICATIVO_111_2 aprobado (DS-38, RH-2); `fn_aims_publicar_version` con manifiesto y `retention_until`.
- Aceptación: un cambio significativo marca la clasificación a revisar y abre 43.4 y 27.2. SIGNIFICATIVO_111_2 sin dictamen de consulta interna se rechaza; la herramienta no deduce la clase: la pregunta advierte que «cambio significativo» (111.2) no es «modificación sustancial» (3.23). Registrar una versión con un incidente grave sin notificar falla. Un UPDATE directo de `change_class` se rechaza. La exigibilidad de los deberes conexos sigue DS-35 (P4 de H-08).
- Test: G-VIVO-NEG (UPDATE directo de `change_class`, SIGNIFICATIVO sin dictamen, versión durante investigación) y G-VIVO-REV del registro válido.
- Gates: G-MIG, G-VIVO-NEG, G-VIVO-REV, G-HARVEY (H-08).
- Cierra: GC-72, GC-101, GC-110.

**F9.T2 Migración M19: expediente por versión**
- Ficheros: `TabExpedienteTecnico.tsx`, `useAimsTechnicalFile.ts:128-203`, `expediente-tecnico.ts`.
- Migración: `…_aims_expediente_por_version.sql`: `subsection_code`, `edited_by`, historial (FK a RESTRICT), `fn_aims_revisar_seccion`, trigger de guardia de `status` (REVIEWED, SEALED y APPROVED solo por RPC, DS-32), inmutabilidad al publicar.
- Aceptación: el Motor de triaje puede crear AIV-05 a 09. Evidencia por sección (SECCION). REVIEWED con revisor distinto; un UPDATE directo a REVIEWED, SEALED o APPROVED se rechaza, y los estados de trabajo siguen pasando. Exportación con `manifest_hash`. Variantes 11.1 y 11.2.
- Test: `expediente-tecnico.test.ts` y G-VIVO-NEG del UPDATE directo de `status`.
- Gates: G-MIG, G-ISO, G-CLAIMS, G-VIVO-NEG.
- Cierra: GC-51, GC-94, GC-101.

**F9.T3 Migración M20: datasets revividos**
- Ficheros: crear `…/sistema/TabDatos.tsx`, `src/hooks/useAimsDatasets.ts`; monitor de gobierno del dato.
- Depende de: D-U7.
- Migración: `…_aims_datasets_revive.sql`, con `system_id` a RESTRICT.
- Aceptación: fichas por conjunto y versión (10.2 b/f/g/h, 10.3, 10.4, 10.6, 4 bis con el matiz de C2 en `rat_ref`). El monitor cuenta conjuntos. Inventario exportable (74.12). La verificación comprueba `confdeltype = 'r'`.
- Test: `aims-datasets-shape.test.ts` (RESTRICT; campos del 10.2) y G-400.
- Gates: G-MIG, G-ISO, G-400.
- Cierra: GC-92, GC-93.

**F9.T4 Logs e instrucciones de uso**
- Ficheros: plantillas «protocolo de logs» (único para OB-14, 21 y 34) e «instrucciones 13.3».
- Migración: no.
- Aceptación: cuenta una sola vez en el avance. Instrucciones por letras (a; b i-vii; c-f) enlazadas al 15.3. RECEPCION_INSTRUCCIONES_13 para Palantir y Bloomberg.
- Test: `entregables-esquemas.test.ts`: los `campos_requeridos` de «instrucciones 13.3» cubren 13.3 a), b) i-vii y c)-f), y los del protocolo de logs los fines del 12.2 y el 19/26.6, cotejados contra el índice congelado; `cuadro-mando.test.ts`: el protocolo de logs cuenta una vez para OB-14, 21 y 34.
- Gates: G-STD, G-HARVEY (H-10).
- Cierra: GC-95, GC-96.

**F9.T5 Supervisión humana (14) y precisión y seguridad (15)**
- Ficheros: plantillas de ambas determinaciones; indicadores con valor y umbral.
- Migración: no.
- Aceptación: 14.3 a y b, interfaz, umbral y parada. Métricas del 15.3, 15.4 (con bucles si hay aprendizaje) y 15.5 enlazadas a controles cyber.
- Test: `entregables-esquemas.test.ts`: los campos de la determinación del 14 cubren 14.3 a) y b) y 14.4 a)-e), y los del 15 cubren 15.3, 15.4 y 15.5, contra el índice congelado; un indicador del 15.3 sin umbral pone rojo.
- Gates: G-STD.
- Cierra: GC-97, GC-98.

**F9.T6 No conformidad (20) y evaluación de la conformidad (43)**
- Ficheros: registros NO_CONFORMIDAD_20 y EVALUACION_CONFORMIDAD_43; RETIRADO con motivo.
- Migración: no.
- Aceptación: salida tipificada y destinatarios (art. 20 al proveedor, validado C4). La evaluación del 43 va por versión y usa la evaluación congelada como papel de trabajo.
- Test: G-VIVO-NEG de un NO_CONFORMIDAD_20 sin destinatarios; G-VIVO-REV del camino válido.
- Gates: G-STD, G-VIVO-NEG, G-VIVO-REV.
- Cierra: GC-102, GC-103.

**F9.T7 Declaración (47), marcado CE (48) y registro UE (49)**
- Ficheros: la declaración pasa a entregable persistido; registros MARCADO_CE_48 y REGISTRO_UE_49 con items del anexo VIII.
- Migración: no; la salvaguarda está en `fn_aims_aprobar_entregable`.
- Aceptación: anexo V completo, sociedad y firmante, sin afirmar firma. Marcado CE solo con la 43 y la 47 aprobadas de la misma versión. 49.1, 49.2 (subsiste, C3; alcance tras cotejo F0.T2), 49.4 y 49.5 derivados.
- Test: `entregables-esquemas.test.ts` (la declaración cubre los puntos del anexo V) y G-VIVO-NEG de un MARCADO_CE_48 sin 43 y 47 aprobadas.
- Gates: G-STD, G-CLAIMS, G-VIVO-NEG, G-HARVEY (H-08).
- Cierra: GC-104, GC-105, GC-106.

**F9.T8 Cadena de suministro del 25.4**
- Ficheros: pestaña de componentes en `TabCadenaModelos.tsx`.
- Migración: no; columnas en M10.
- Aceptación: acuerdo escrito con su contenido mínimo, cláusulas tipo y excepción de licencia libre (salvo GPAI), separados del encargo del art. 28 RGPD. Los acuerdos intragrupo (ACUERDO_INTRAGRUPO, DS-39) se registran aparte, con la sociedad contraparte, y el sujeto afectado los cita; sin acuerdo, la ficha dice «reparto intragrupo no documentado».
- Test: `cadena-modelos.test.tsx` (acuerdo intragrupo con sociedad del mismo tenant; tercero rechazado) y los `campos_requeridos` del acuerdo del 25.4 contra el índice congelado.
- Gates: G-STD.
- Cierra: GC-05, GC-115.

### F10 — Capacidades condicionadas

**F10.T1 Proveedor de modelo: detección y anexos XI y XII**
- Ficheros: catálogo de ámbito MODELO; plantillas d61 y d62; `docs/legal/harvey/…-lote-H-09.md`.
- Migración: no.
- Aceptación: G_2 (incluido el ajuste fino por encima del umbral, RH-4) crea un sujeto de modelo PROVEEDOR_GPAI con escala propia, sin anexo IV ni niveles de sistema. CONDICIONADA mientras el hecho no conste.
- Test: tabla SQL = TS con G_2 = SI (APLICA el cap. V) y G_2 = NO con G_1 = SI (NO_APLICA, mera dependencia); plantillas d61 y d62 contra el anexo XI y el XII en el índice congelado.
- Gates: G-STD, G-HARVEY (H-09).
- Cierra: GC-118, GC-119.

**F10.T2 Obligaciones del 53 y riesgo sistémico**
- Ficheros: plantillas de política de derechos de autor (53.1 c) y d63; registro NOTIFICACION_COMISION_52 con alarma de 14 días; items del 55.1 y 55.2.
- Migración: no.
- Aceptación: 53.2, 53.3 y 53.4/56 como obligaciones con predicado. Incidentes del modelo dirigidos a la Oficina de IA.
- Test: tabla SQL = TS con un caso APLICA y uno NO_APLICA por predicado (licencia libre del 53.2; riesgo sistémico del 55); `alarmas.test.ts` con el plazo de 14 días del 52.1.
- Gates: G-STD.
- Cierra: GC-119, GC-120.

**F10.T3 Representante autorizado**
- Ficheros: registro MANDATO_REPRESENTANTE; rol en la ficha.
- Migración: no.
- Aceptación: 22.3 a-e, 22.4 y 54 cuando R_6 o G_6.
- Test: tabla SQL = TS (R_6 = SI APLICA; R_6 = NO y G_6 = NO, NO_APLICA) y los campos del mandato contra el 22.3 a)-e) del índice congelado.
- Gates: G-STD.
- Cierra: GC-121.

**F10.T4 Importador y distribuidor**
- Ficheros: checklists por sistema; registros VERIFICACION_IMPORTADOR_23 y VERIFICACION_DISTRIBUIDOR_24.
- Migración: no.
- Aceptación: 23.1-23.5 (con conservación de 10 años calculada) y 23.7. 24.1-24.4. Importador y distribuidor fuera de ROLES_DE_DESPLIEGUE y sin art. 4.
- Test: `importador-distribuidor.test.ts`: la conservación calculada es de 10 años desde la introducción en el mercado; los checklists cubren 23.1 a)-d) y 24.1 contra el índice congelado; tabla SQL = TS con R_4 y R_5 en APLICA y NO_APLICA; un importador no recibe el art. 4.
- Gates: G-STD.
- Cierra: GC-122, GC-123, GC-124.

**F10.T5 Autoridad pública y excepción policial**
- Ficheros: predicados y plantillas d3, d4, d5 y d52.
- Migración: no.
- Aceptación: 26.8 y 49.3 solo con H_autoridad_publica (49.3 validado, C3; 26.8 con H-09). 5.2-5.4 con la autorización del 5.3. Para privados, NO_APLICA derivado.
- Test: tabla SQL = TS con una autoridad pública (APLICA) y una aseguradora privada (NO_APLICA) para 26.8, 49.3 y 5.2-5.4.
- Gates: G-STD, G-HARVEY (H-09).
- Cierra: GC-91, GC-127.

**F10.T6 Espacio controlado de pruebas y pruebas reales**
- Ficheros: registros de §5.8; estado EN_PRUEBA_NO_PUESTO_EN_SERVICIO en `vocabulario.ts` (sin CHECK en status).
- Migración: no.
- Aceptación: OPCIONAL, nunca en rojo. 60.4 a-k, anexo IX, consentimientos del 61 y retirada del 60.5, que dispara la supresión gobernada de DS-33.
- Test: `alarmas.test.ts` (una OPCIONAL nunca da rojo); los items del 60.4 a)-k) contra el índice congelado; G-VIVO-REV de la retirada con supresión.
- Gates: G-STD, G-VIVO-REV.
- Cierra: GC-125, GC-126.

### F11 — Dato demo y verificación (escalonado)

**F11.T1 Clasificación guiada real en Garrigues y ARGA Assist (antes del 2-12-2026)**
- Ficheros: crear `scripts/aims/clasificacion-guiada-demo.ts` (idempotente, login real, RPC) y `scripts/aims/demo/respuestas-clasificacion.ts` (cada respuesta con su fuente); `docs/legal/harvey/…-lote-H-04.md`.
- Migración: no.
- Depende de: F4, carril rápido de F6 y, para la revisión de ARGA Assist, D-U2, D-U5 y F2.T18. Plan B declarado: si no están antes del 27-11, ARGA Assist queda PROPUESTO con alarma y sin revisión.
- Aceptación: 12 cribados (101 y 102 fuera por `inventory_kind`, 201 fuera por el 2.8). Cuestionarios de los sujetos de Garrigues y de ARGA Assist; las hipótesis sembradas se cierran y se sustituyen (DS-34). H-04 antes de revisar. Revisión cruzada. Segunda corrida sin cambios.
- Test: G-VIVO-NEG de lectura con los dos logins (sujetos VIGENTE con su cuestionario; hipótesis cerradas y no reescritas) y la idempotencia del script.
- Gates: G-VIVO-NEG, G-PERSIST, G-HARVEY (H-04).
- Cierra: GC-13, GC-14, GC-15.

**F11.T2 Harvey reevaluado**
- Ficheros: se ejecuta con la UI o el script con sesión real.
- Migración: no.
- Aceptación: evaluación contra DESPLIEGUE_LIMITADO y ORGANIZACION, congelada por `demo@` y revisada por `admin@`. La del 49 % se conserva marcada.
- Test: G-VIVO-NEG de lectura (dos evaluaciones; la nueva revisada por otra persona).
- Gates: G-VIVO-NEG, G-PERSIST.
- Cierra: GC-56.

**F11.T3 Reclasificación de ARGA**
- Ficheros: `respuestas-clasificacion.ts` (ARGA); ledger.
- Migración: no.
- Depende de: D-U2, D-U5 y F2.T18.
- Aceptación: los 8 por cuestionario con `demo@` y la cuenta de D-U5 designada en el órgano. `nivel_declarado_previo` guardado. Resultado contrastado con H-04. Cambios declarados. Los e2e de ARGA se reescriben sobre invariantes.
- Test: G-VIVO-NEG de lectura y los e2e reescritos.
- Gates: G-VIVO-NEG, G-PERSIST, G-E2E2T.
- Cierra: GC-15.

**F11.T4 Legado sobre el dato vivo**
- Ficheros: tests de `legado.ts` con el dato real.
- Migración: no.
- Aceptación: las 49 comprobaciones traducidas en lectura. Los rótulos de legado aparecen en las fichas de ARGA. 0 UPDATE.
- Test: `legado.test.ts` con el dato real leído por G-VIVO-NEG.
- Gates: G-VIVO-NEG, G-PERSIST.
- Cierra: GC-55, GC-57.

**F11.T5 Simulacro del incidente de sesgo de ARGA Score (tras F8)**
- Ficheros: crear `scripts/aims/caso-guiado-incidente-arga-score.ts`.
- Migración: no.
- Aceptación: calificación 3.49 c) motivada, ARGA Vida, España, reloj «simulacro — no exigible», autoridad propuesta como hipótesis (DGSFP por DS-22, C16), INVESTIGACION_73_6 y acción en GRC. Sin subexpediente RGPD.
- Test: G-VIVO-NEG de lectura del caso (reloj con `exigible = false`) y la idempotencia del script.
- Gates: G-VIVO-NEG, G-PERSIST.
- Cierra: GC-59.

**F11.T6 EIPD, designaciones, formación y programa sembrados**
- Ficheros: crear `scripts/aims/seed-programa-demo.ts` y `scripts/grc/seed-eipd-demo.ts`.
- Migración: no.
- Aceptación: EIPD PENDIENTE de Harvey, GA_IA y ARGA Score. Designaciones y medidas de formación Simulado. Fechas de fase del experto marcadas.
- Test: `seed-programa-demo.test.ts` (idempotente) y G-ISO no vacuo (filas en los dos tenants en cada tabla nueva).
- Gates: G-PERSIST, G-ISO (no vacuo).
- Cierra: GC-30, GC-41.

**F11.T7 Verificación final**
- Ficheros: ledger con el antes y el después; `playwright.production.config.ts` ampliado.
- Migración: no.
- Aceptación:
  - sondas vivas y aislamiento en las dos direcciones sobre todas las tablas nuevas;
  - e2e de AIMS, GRC y Secretaría en los dos tenants;
  - revisión adversarial de rama con 3 lentes (jurídica, técnica y propiedad);
  - producción de solo lectura con los dos logins;
  - H-12 de coherencia;
  - paridad repo/Cloud de todas las migraciones;
  - G-SYNC en verde y ninguna sonda viva ha dejado residuo (recuento de filas PROBE en los dos tenants = 0).
- Test: el conjunto; `fn_verify_audit_chain` medido.
- Gates: todos.
- Cierra: GC-14.

---

## 11. Matriz de trazabilidad (140 cids → tareas)

### 11.1 Gaps añadidos en la v2

| GC | Gap | Origen y prueba | Tareas |
|---|---|---|---|
| GC-138 | `fn_sync_obligation_to_backbone` sincroniza las 21 obligaciones PBC/FT de Garrigues al módulo 'risk' («Riesgos penales») en vez de a 'aml' («PBC/FT»): la rama es `OBL-GARR-PBC-%` y los códigos son `OBL-PBC-%` | Defecto vivo medido por el controlador y re-medido con SELECT el 19-09-2026: 24 filas en el ELSE (21 de Garrigues, 3 de ARGA); `grc_obligations.module_id = 'risk'` en las 21 | F5.T3, F5.T14 |
| GC-139 | El ancla probatoria de Secretaría (`secretaria_document_artifacts`) es editable y borrable, y `anon` y `authenticated` tienen todos los grants, TRUNCATE incluido | Observación 15 del crítico, medida: política FOR ALL, solo el trigger `updated_at`, grants completos | F5.T13 |
| GC-140 | `authenticated` tiene DELETE, TRUNCATE, TRIGGER y REFERENCES sobre `risks` y `action_plans` | Hallazgo al verificar la observación 3, medido en `information_schema.role_table_grants` | F5.T7, F8.T1 |

Las consideraciones de Harvey (RH-1 a RH-8) no son gaps nuevos: amplían gaps existentes y se trazan en sus filas (RH-1 → GC-05 y GC-115; RH-2 → GC-72; RH-3 → GC-93; RH-4 → GC-112, GC-114 y GC-118; RH-5 → GC-41 y GC-90; RH-6 → GC-35; RH-7 → GC-77; RH-8 → GC-111).

### 11.2 Matriz

| GC | Tareas |
|---|---|
| GC-01 | F2.T2, F2.T3, F2.T4, F2.T16, F4.T6, F8.T7 |
| GC-02 | F0.T3, F4.T4, F4.T7 |
| GC-03 | F0.T1, F0.T3, F2.T1, F2.T2, F2.T15 |
| GC-04 | F2.T1, F2.T15 |
| GC-05 | F0.T1, F2.T4, F2.T16, F4.T15, F5.T9, F9.T8 |
| GC-06 | F2.T8, F2.T16, F4.T8 |
| GC-07 | F2.T9, F2.T16 |
| GC-08 | F0.T1, F2.T9, F2.T15, F2.T18 |
| GC-09 | F2.T11 |
| GC-10 | F1.T9, F2.T12 |
| GC-11 | F4.T1, F4.T2 |
| GC-12 | F0.T2, F0.T3, F4.T3, F4.T10, F6.T5 |
| GC-13 | F0.T3, F2.T3, F2.T16, F4.T2, F4.T15, F11.T1 |
| GC-14 | F11.T1, F11.T7 |
| GC-15 | F11.T1, F11.T3 |
| GC-16 | F4.T3, F4.T6, F4.T11 |
| GC-17 | F1.T9, F4.T3, F4.T11 |
| GC-18 | F1.T10, F4.T1, F4.T4, F4.T11 |
| GC-19 | F4.T4, F4.T11, F4.T13, F6.T5 |
| GC-20 | F4.T7, F4.T8 |
| GC-21 | F3.T2, F3.T10, F4.T5 |
| GC-22 | F4.T5 |
| GC-23 | F4.T3, F4.T12 |
| GC-24 | F4.T5 |
| GC-25 | F4.T1, F4.T3, F4.T10, F4.T13, F6.T5 |
| GC-26 | F1.T10, F1.T15, F4.T1, F4.T10 |
| GC-27 | F0.T3, F4.T1, F4.T10 |
| GC-28 | F4.T6, F4.T8, F4.T14, F5.T8, F5.T13 |
| GC-29 | F1.T3, F4.T14 |
| GC-30 | F5.T1, F5.T5, F5.T6, F6.T11, F11.T6 |
| GC-31 | F0.T3, F1.T11 |
| GC-32 | F0.T3, F4.T4 |
| GC-33 | F4.T3, F4.T12 |
| GC-34 | F6.T3, F6.T4 |
| GC-35 | F0.T3, F6.T3, F6.T4, F6.T8 |
| GC-36 | F1.T11, F6.T4, F7.T1 |
| GC-37 | F6.T4 |
| GC-38 | F6.T4 |
| GC-39 | F1.T11, F1.T15, F7.T1 |
| GC-40 | F6.T3 |
| GC-41 | F0.T3, F5.T1, F5.T11, F5.T12, F8.T4, F8.T5, F11.T6 |
| GC-42 | F2.T16, F5.T5, F5.T10 |
| GC-43 | F1.T1 |
| GC-44 | F1.T2 |
| GC-45 | F1.T3 |
| GC-46 | F1.T2 |
| GC-47 | F1.T4, F1.T14 |
| GC-48 | F1.T2, F5.T9 |
| GC-49 | F1.T8, F6.T8 |
| GC-50 | F1.T6, F8.T10 |
| GC-51 | F1.T7, F9.T2 |
| GC-52 | F1.T8, F8.T3 |
| GC-53 | F1.T9, F2.T17 |
| GC-54 | F1.T5 |
| GC-55 | F1.T4, F11.T4 |
| GC-56 | F11.T2 |
| GC-57 | F1.T4, F1.T14, F11.T4 |
| GC-58 | F8.T2 |
| GC-59 | F11.T5 |
| GC-60 | F3.T1, F3.T2, F3.T4, F3.T5, F3.T6, F3.T10, F7.T5 |
| GC-61 | F6.T1, F6.T2, F6.T6 |
| GC-62 | F5.T5, F6.T1, F6.T2 |
| GC-63 | F5.T3, F5.T4 |
| GC-64 | F5.T2 |
| GC-65 | F6.T1, F6.T4, F6.T5, F6.T6, F6.T14 |
| GC-66 | F6.T7 |
| GC-67 | F0.T2, F3.T3, F5.T3 |
| GC-68 | F6.T8 |
| GC-69 | F5.T7, F6.T10 |
| GC-70 | F6.T7, F6.T10 |
| GC-71 | F6.T9 |
| GC-72 | F0.T5, F4.T1, F4.T12, F5.T13, F9.T1 |
| GC-73 | F6.T9 |
| GC-74 | F8.T1, F8.T2, F8.T3 |
| GC-75 | F5.T13 |
| GC-76 | F2.T15, F7.T1, F7.T3 |
| GC-77 | F0.T3, F2.T3, F8.T6 |
| GC-78 | F2.T7, F2.T18, F4.T9 |
| GC-79 | F2.T5, F2.T6 |
| GC-80 | F0.T1, F2.T10 |
| GC-81 | F2.T13, F2.T14 |
| GC-82 | F5.T10 |
| GC-83 | F7.T1, F7.T2 |
| GC-84 | F8.T11 |
| GC-85 | F8.T11 |
| GC-86 | F0.T3, F8.T7, F8.T8 |
| GC-87 | F8.T12 |
| GC-88 | F8.T12 |
| GC-89 | F8.T12 |
| GC-90 | F0.T3, F8.T4, F8.T5 |
| GC-91 | F10.T5 |
| GC-92 | F9.T3 |
| GC-93 | F0.T2, F0.T3, F6.T8, F7.T1, F7.T4, F9.T3 |
| GC-94 | F9.T2 |
| GC-95 | F9.T4 |
| GC-96 | F9.T4 |
| GC-97 | F9.T5 |
| GC-98 | F9.T5 |
| GC-99 | F3.T5, F6.T12 |
| GC-100 | F3.T5, F6.T12 |
| GC-101 | F9.T1, F9.T2 |
| GC-102 | F9.T6 |
| GC-103 | F9.T6 |
| GC-104 | F9.T7 |
| GC-105 | F9.T7 |
| GC-106 | F0.T2, F4.T9, F9.T7 |
| GC-107 | F8.T10 |
| GC-108 | F8.T7 |
| GC-109 | F8.T6 |
| GC-110 | F8.T9, F9.T1 |
| GC-111 | F0.T5, F6.T13 |
| GC-112 | F4.T1, F4.T3, F4.T4, F4.T12 |
| GC-113 | F4.T4 |
| GC-114 | F4.T1, F4.T3, F4.T4, F7.T2 |
| GC-115 | F0.T1, F0.T5, F4.T15, F5.T9, F9.T8 |
| GC-116 | F4.T1, F4.T15 |
| GC-117 | F1.T11, F4.T15 |
| GC-118 | F10.T1 |
| GC-119 | F10.T1, F10.T2 |
| GC-120 | F10.T2 |
| GC-121 | F5.T9, F10.T3 |
| GC-122 | F4.T4, F10.T4 |
| GC-123 | F10.T4 |
| GC-124 | F10.T4 |
| GC-125 | F0.T2, F10.T6 |
| GC-126 | F10.T6 |
| GC-127 | F10.T5 |
| GC-128 | F0.T2, F3.T8 |
| GC-129 | F1.T12 |
| GC-130 | F1.T12 |
| GC-131 | F1.T12 |
| GC-132 | F1.T13 |
| GC-133 | F1.T13 |
| GC-134 | F0.T3, F0.T4, F3.T4, F3.T5, F3.T6, F3.T9, F3.T11 |
| GC-135 | F3.T7 |
| GC-136 | F0.T4, F3.T4, F3.T6, F3.T9, F3.T11 |
| GC-137 | F0.T4, F3.T9 |
| GC-138 | F5.T3, F5.T14 |
| GC-139 | F5.T13 |
| GC-140 | F5.T7, F8.T1 |

Comprobación: 140 de 140 cids con al menos una tarea y 130 tareas (125 de la v1 más F0.T5, F1.T15, F2.T18, F5.T14 y F6.T14). Mapeo generado desde las líneas «Cierra:» de este documento; ninguna tarea de la v1 pierde un cid.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El 2-12-2026 llega sin art. 5.1 b bis/b ter ni 50.2 de ARGA Assist | Tope interno del 13-11 para F4. Carril rápido de F6 (T1, T2, T3, T4, T5, T8 y T14) y F11.T1/T3 antes del 27-11. Si F4 se retrasa, F6.T8 emite una alarma estática fechada, que se retira después. Si falta D-U2, D-U5 o F2.T18, ARGA Assist queda PROPUESTO con alarma (plan B). |
| Deriva entre el DSL y las derivaciones en TS y SQL | Sonda SQL = TS caso a caso (al menos 30 casos más todos los predicados). Paridad TS/Cloud del catálogo en cada corrida. DSL mínimo sin funciones arbitrarias. |
| Inventar criterio al formalizar la columna libre del experto | Solo hechos que el experto nombra o que exige el texto. Un hecho ausente da DEPENDE. H-03 antes de publicar. Sesión con el experto. |
| Harvey no está disponible o contradice | Lotes archivados. «Validado por Harvey» no es dictamen. Sin veredicto, el criterio no se fija y queda PENDIENTE. |
| Doble verdad AIMS/GRC en obligaciones de organización | Regla única de DS-07 (cobertura con `obligationCoverage` y entregables aprobados), C-03. Sonda de paridad con mensaje «re-sincronizar». Sin estado manual en AIMS. |
| Relajar `action_plans.finding_id` rompe GRC o el Board Pack | Los nueve lectores medidos en la instantánea, cada uno con su criterio (LEFT JOIN o filtro `source = 'HALLAZGO'`). Tres gates reescritos sobre la invariante. e2e 10-grc, Board Pack y `/grc/m/audit` en los dos tenants. `tenant_id` SET NOT NULL tras medir. |
| `capability_matrix_action_check` aborta la migración de RBAC | Se amplía en la misma migración (verificado: hoy admite 8 acciones). |
| Escribir branding convierte ARGA en lista blanca | Nunca se escribe el branding de ARGA (gate). `/grc/m/ai` por ruta explícita. `branding.modules` de Garrigues sin cambios. |
| Privilegios heredados o FK entre tenants en unas 20 tablas nuevas o revividas | RS-TABLA con verificación y control positivo. `fn_aims_fk_misma_tenant`. G-ISO con logins reales. Sonda revertida previa. |
| Perder o duplicar dato sembrado de Garrigues | Seeds que solo completan. Índices únicos. Sujetos cerrados con `valid_to`, nunca borrados ni reescritos (DS-34). G-PERSIST. La corrección de GC-138 es un UPDATE declarado de `module_id` en 21 filas, que aborta si no son exactamente 21. |
| Cambio visible en ARGA (niveles, Listo → no medido, nuevas OBL-RIA) | Ledger por fila con el antes y el después. `nivel_declarado_previo`. e2e sobre invariantes. Clasificación con login real y H-04. |
| Cuatro ojos imposible en ARGA | D-U5: segunda cuenta real creada por el usuario y designada en el órgano por Secretaría (F2.T18). No se asigna COMPLIANCE a SECRETARIO (par con aviso de SoD, WARN). Hasta entonces, SIN_ORGANO_ACREDITADO con mensaje. |
| Decisiones pendientes D-U1 a D-U7 | Todo falla cerrado o queda en DEPENDE y la pantalla lo dice. Nada se decide en el producto. |
| Puntos del Ómnibus sin verificar (2.13, 57.1, 49.2, sección 5, 4 bis desde el 27-7-2026, 111.2 para autoridades, considerando 25) | F0.T2 en el DOUE. Hasta entonces, PENDIENTE_LEGAL y sin CHECK; el 4 bis con alarma ámbar. |
| Presentar como exigible lo que es latente | Compuerta de exigibilidad (DS-05). Simulacros rotulados. |
| Afirmaciones probatorias (entregables aprobados, declaración, registro UE, notificaciones) | Constancia interna sin firma ni envío. G-CLAIMS cubre participio, imperativo y estado. `sin-comentarios.ts`. |
| Retirada a medias: se corrige una superficie y sobrevive en otra | Hojas únicas con G-ARISTA (aplicabilidad, legado, mapa de monitores, revisión pendiente, alarmas, autoridad). Revisión adversarial al cerrar cada fase. |
| Crecimiento de pantallas (la ficha pasa de 7 a 14 pestañas) | Un componente por pestaña en `components/ai-governance/{sujeto,registro,programa,eidf,...}`. G-400. |
| Ciclos TDZ al importar hojas | Hojas sin React ni hooks. Gate de imports. |
| Tablas sin `tenant_id` (`ai_risk_assessments`, `ai_compliance_checks`) | Toda escritura nueva va por RPC, con prueba de pertenencia y comprobación de que vuelve fila (PostgREST no filtra la mutación por el join). |
| Crecimiento de la cadena WORM | `fn_audit_worm` solo en sujetos, instancias y entregables. Se mide `fn_verify_audit_chain` en F11.T7. |
| Un carril hace trabajo fuera de ámbito sin declararlo | `git status` contra el perímetro de cada tarea antes del commit. Stage por rutas explícitas (hay material ajeno en el árbol). |
| Canal de Cloud (el CLI cuelga) | MCP `execute_sql` en transacción, registro manual en `schema_migrations`, `db:check-target` antes y después. |
| Una sonda viva deja residuo imborrable (sujetos con RESTRICT, tablas sin DELETE, WORM) | DS-31: G-VIVO-NEG permanente sin escritura; caminos positivos solo en sonda revertida. `aims-cuestionario-live.test.ts` reescrita. F11.T7 cuenta filas PROBE = 0. |
| Un cliente escribe una columna «solo por RPC» de una tabla existente (p. ej. `change_class = NINGUNO` o `NO_ES_GRAVE`) | DS-32: trigger de guardia en cada columna, con control positivo y sonda negativa. |
| Las funciones v1 siguen ejecutables y fijan rol y nivel con la derivación antigua | DS-29: REVOKE EXECUTE en M08 y `CUESTIONARIO_V1_RETIRADO`; sonda negativa. |
| El usuario deniega D-U7 (reabrir las 8 tablas muertas) | M10, M15, M16, M17 y M20 se replantean con tablas nuevas; nada se escribe en las 8; el dato de ARGA sigue legible. |
| Un matiz de Harvey que no está en el texto se aplica como criterio | DS-17: el controlador contrasta cada matiz con el consolidado antes de aplicarlo (caso C15, no aplicado). |
| El dictamen que justifica un residual aceptado se edita o se borra después | GC-139: inmutabilidad del artefacto `ai_system` desde APPROVED y REVOKE de TRUNCATE y de todo a `anon` (F5.T13). |

---

## 13. Registro de cambios de v1 a v2

Cada observación del crítico se verificó antes de aplicarla, en la instantánea (`b1721a5`) o con SELECT sobre Cloud el 19-09-2026 («medido»).

**Observaciones del crítico**

| # | Resultado | Prueba | Dónde se aplicó |
|---|---|---|---|
| 1 | APLICADA | Función leída en Cloud: rama `OBL-GARR-PBC-%`; 24 filas en el ELSE (21 Garrigues, 3 ARGA), las 21 en `module_id = 'risk'`; el segundo fallback no lo usa ninguna fila (medido). ELSE conservado | §2.2 GRC; F5.T3; F5.T14; G-SYNC; GC-138 |
| 2 | APLICADA | `aims-cuestionario-live.test.ts:48-98` limpia confiando en el CASCADE; cuestionarios con CASCADE y DELETE de `ai_systems` para authenticated (medido) | DS-31; §3.3; §10.1; F4.T7; tareas con G-VIVO |
| 3 | APLICADA | UPDATE y políticas FOR ALL en `ai_incidents`, `aims_system_versions`, `aims_technical_file_sections` y `risks`; el trigger de congelación deja escribir la revisión; `residual_score` no generada (medido; la generada es `inherent_score`); `useRisks.ts:119` | DS-32; RS-TABLA 10; §2.2; F2.T3; F5.T7; F8.T1; F8.T6; F9.T1; F9.T2 |
| 4 | APLICADA | Las alarmas de F6.T8 salen de instancias de F6.T2; F6.T4 se aprueba con las RPC de F6.T5; ninguna en el carril rápido | DS-30; §10.2; F6 (cabecera, T2, T5, T8, T14) |
| 5 | APLICADA | `experto/entregables_html.json`: d56 es «Información» (art. 50) y d76 el protocolo del art. 86; sin tarea para d7-d41, d56, d64-d76; F8.T12 usaba d50 | §2.2; §4.4; F3.T6; F6.T4; F6.T5; F6.T14; F8.T12 |
| 6 | APLICADA | `cita-verificable.ts:47-56` devuelve `null` fuera de `NORMATIVO_CATALOG` | §4.2; F3.T8; §10.1 |
| 7 | APLICADA | §3.2 v1: 6.3 «válida solo si PROVEEDOR» y E63_ref_proveedor sin uso; el 6.4 y el 49.2 atribuyen la evaluación al proveedor; C3 no lo cubre | DS-01; §3.1 S6; §3.2; §3.3; F4.T4; H-02 P6 |
| 8 | APLICADA | Literal del 25.1 a): «sin perjuicio de los acuerdos contractuales…»; H-01 solo preguntó el 25.1 c) | §3.1 S2; §3.2; F4.T3; F4.T4; H-02 P3 |
| 9 | APLICADA EN PARTE | §4.3 v1 solo fechaba el cap. III. **No se sostiene** para OB-58 (el 26.5 es cap. III, sec. 3, ya fechado) ni para el art. 49 (sec. 5, ya PENDIENTE_LEGAL); sí para los arts. 71-74 y 86 | DS-35; §4.3; §4.6; F3.T3; F8.T7; F9.T1; H-08 P4 |
| 10 | APLICADA | `harvey/registro.json`: H-01 RESPONDIDA el 19-09-2026 | §1.4; F0.T3; §9; RH-1 a RH-8; F7.T4 |
| 11 | APLICADA | (a)-(c) sin lote; (d) `legal_form` medido: SPK, dos LLP, tres SC; (e) la propuesta de ARGA Digital contradecía §3.3 y C11 (ARGA Digital, S.L. existe, medido) | §4.6; §4.7; §5.7; §8 ARGA 3-4; F0.T1; F2.T16; F6.T3; F7.T2; H-06, H-09, H-10, H-14, H-15 |
| 12 | APLICADA | (a) F3.T5 partía OB-18 y DS-10 no; el experto tiene una fila. (b) §4.4 alias y F8.T11 plantillas; el experto da el mismo título a OB-31, 32 y 33. (c) DS-08 sin chip | DS-08; DS-10; §4.2; §4.4; §4.5; §6.2; F0.T4; F3.T5; F3.T11; F8.T11 |
| 13 | APLICADA, con precisión | F4.T14 exigía F5.T13 sin declararlo. `demo@` ARGA **ya** es SECRETARIO vigente del CATIT y de la Comisión de Riesgos Regulada (medido): solo la segunda cuenta necesita designación; Auth tiene 3 cuentas (medido) | §7; §8 ARGA 6; §10.2; F2.T18; F4.T14; F5.T8; F5.T13; F11.T1; F11.T3 |
| 14 | APLICADA | `confdeltype = 'c'` en las FK de las 8 tablas y en `aims_incident_regimes` hacia `entities` y `ai_incidents` (medido) | RS-TABLA 9; §2.2; F4.T15; F8.T4; F8.T7; F8.T10; F9.T3 |
| 15 | APLICADA | Política FOR ALL, solo trigger `updated_at`, grants completos a `anon` y `authenticated`, `source_domain` en minúsculas (medido). Precisión: inmutabilidad solo para `ai_system`, porque otros dominios actualizan estado (`useSecretariaDocumentArtifacts.ts:539`, `document.ts:247`) | §2.2; C-06; F5.T13; GC-139 |
| 16 | APLICADA | C-03 (Efectivo = CUMPLIDA) frente al trigger de F6.T1; `obligation-coverage.ts` pinta `Inefectivo` como EN PROCESO | DS-07; C-03; §2.2; F6.T1 |
| 17 | APLICADA | `aims_ria_records` sin retención ni supresión y con kinds con datos de terceros | DS-33; §2.2; §5.8; F4.T6; F8.T12; F10.T6; H-17 |
| 18 | APLICADA | CLAUDE.md: frontera D-1 del 08-09 y DA-9 revocaron la escritura; F0.T1 no pedía decisión | §2.2; F0.T1 (D-U7); F4.T15; F8.T4; F8.T7; F8.T10; F9.T3 |
| 19 | APLICADA | Las tres funciones v1 y el alias, ejecutables por authenticated (medido); 0 cuestionarios (medido) | DS-29; §2.2; §3.3; F4.T8; F4.T9 |
| 20 | APLICADA | `tenant-scopes.ts:14`, `src/data/scopes.ts` (9 ámbitos), `readiness.ts:621-643`; `country` NULL en ARGA y «UK» en Garrigues (medido) | §7; F2.T11 |
| 21 | APLICADA | Los cinco ficheros citados y además `sanitized-flow-contracts.ts` | F5.T7; §12 |
| 22 | APLICADA | Las tareas señaladas solo tenían G-STD; se extendió a todas (línea «Test:») | §10.1; todas las tareas |
| 23 | APLICADA | G-FRONTERA solo escaneaba TS; las escrituras cruzadas están en SQL | §2.3; §10.1; F5.T2; F6.T10 |
| 24 | APLICADA | RSK-STRA-005 es pricing de automóvil y los tres riesgos cuelgan de ARGA Seguros, S.A. (medido); `ai_policy_id` es columna nueva y solo se sembraba en Garrigues | §5.3; §8 ARGA 5; F2.T16; F8.T2 |
| 25 | APLICADA | RAISE sin ERRCODE y ADMIN_TENANT siempre pasa; par SoD con WARN; `checked_by_id` ya existe (medido) | DS-11; §2.2; F1.T14; F2.T5 |
| 26 | APLICADA | Ninguna forma «INTEGRACION»; BSVV es LIMITADA; formas en texto libre; SPK presente (medido) | DS-19; §7; F0.T1; F2.T1; H-09 |
| 27 | APLICADA | F1.T11 fijaba en la semana 1 lo que H-06 validaba en noviembre. C10 y C14 ya cubren parte; el lote adelantado solo lleva art. 5 c, d, f y h y las cuatro medidas | F1.T10; F1.T11; F1.T15; H-02A; §10.2 |
| 28 | APLICADA | F4.T8 hacía «upsert» sobre filas de hipótesis sin regla; no había hoja de recuento | DS-34; §2.2; §3.3; §6.2; §8; F2.T16; F4.T2; F4.T8; F11.T1 |

**Verificación del controlador y hallazgo propio**

| Origen | Resultado | Prueba | Dónde se aplicó |
|---|---|---|---|
| Controlador: 24 obligaciones en el ELSE; defecto vivo PBC/FT | APLICADA | Re-medido: rama en `20260820130000_g6_cyber_module_and_sync.sql:48`; 21 `OBL-PBC-*` en 'risk'; 'aml' existe en Garrigues | GC-138; §2.2; F5.T14; F5.T3; G-SYNC; §8 |
| Hallazgo al verificar la observación 3 | AÑADIDO | `authenticated` con DELETE, TRUNCATE, TRIGGER y REFERENCES sobre `risks` y `action_plans` (medido) | GC-140; §2.2; F5.T7; F8.T1 |

**Validación de Harvey (H-01)**

| Elemento | Resultado | Dónde se aplicó |
|---|---|---|
| C1-C17 | VALIDADOS los 17 | §1.4; F0.T3 y F5.T1 hechas; columna «Harvey» de §4.5; preguntas retiradas de H-02, H-03, H-06, H-07 y H-08 |
| Matiz de C2 | APLICADO (documentar las razones en el registro de ese tratamiento; no deber general del art. 30 RGPD) | §4.5 OB-12; F7.T4; F9.T3 |
| Matiz de C15 | NO SE APLICA: el art. 73.4 consolidado no lo contiene; C15 queda CORRECTO tal como se formuló | §1.4; §5.6; F8.T8 |
| Cita de C8 al considerando 25 | PENDIENTE de cotejo | DS-27; F0.T2 |
| RH-1 Acuerdos intragrupo | REQUISITO | DS-39; §2.2; §7; F0.T1; F0.T5; F4.T15; F9.T8 |
| RH-2 Cambio significativo ≠ modificación sustancial | REQUISITO (consulta interna) | DS-38; §3.1 S10; §6.5; F0.T5; F5.T13; F9.T1; H-02 P9 |
| RH-3 Art. 4 bis desde el 27-7-2026 | REQUISITO, PENDIENTE de verificar en el literal | DS-27; §4.3; §6.3; F0.T2; F6.T8; F7.T4 |
| RH-4 Art. 25 y ajuste fino | REQUISITO (criterio de la herramienta) | §3.1; F4.T3; F4.T4; F10.T1; H-02 P5 |
| RH-5 EIDF ≠ EIPD | REQUISITO | DS-37; §5.4; §5.5; F5.T12; F8.T4; F8.T5; H-07 |
| RH-6 Art. 111.4 | REQUISITO (ya estaba; ahora validado) | §4.3; F6.T3; F6.T8 |
| RH-7 Autoridad por sociedad | REQUISITO | DS-36; §5.7; F8.T6; H-15 |
| RH-8 Secreto profesional frente a los arts. 21 y 74 | REQUISITO y punto del Comité de IA | DS-40; §5.8; F0.T5; F5.T13; F6.T13; H-16 |

---

Ficheros de apoyo (no forman parte del repo):
- `/private/tmp/claude-501/-Users-moisesmenendez-Dropbox-DESARROLLO-arga-governance-map/daad2e6f-46e0-4e63-9af8-a475225c5fe2/scratchpad/ria/spec_v2.md` (este documento)
- `/private/tmp/claude-501/-Users-moisesmenendez-Dropbox-DESARROLLO-arga-governance-map/daad2e6f-46e0-4e63-9af8-a475225c5fe2/scratchpad/ria/harvey/01-respuesta.md` y `harvey/registro.json` (H-01)
- `/private/tmp/claude-501/-Users-moisesmenendez-Dropbox-DESARROLLO-arga-governance-map/daad2e6f-46e0-4e63-9af8-a475225c5fe2/scratchpad/ria/diseno.json` (gaps, propuestas y crítica)
---

## 14. Enmiendas vinculantes tras la verificación de la v2 (prevalecen sobre el texto)
Un revisor independiente verificó la v2 contra el dato de Cloud y la instantánea (veredicto: APTA CON CORRECCIONES). Estas 14 enmiendas **prevalecen sobre cualquier sección o tarea que las contradiga**. Cada implementador debe leer las que afectan a su tarea antes de empezar; el ledger registra su cierre.

### E-01 (ALTA) — §2.2 (AIMS, columnas nuevas de ai_risk_assessments y ai_compliance_checks), F1.T14 (M01), F2.T3, F2.T7, F9.T2; §13 obs. 25

**Problema.** Defecto nuevo, introducido al aplicar la obs. 25 c). Medido en Cloud: ai_compliance_checks.checked_by_id y ai_risk_assessments.assessor_id son FK a persons, y ninguna de las 4 cuentas de auth.users es una persona (0 de 4). Si M01 pone `checked_by_id SET DEFAULT auth.uid()`, cada INSERT de comprobaciones que omita la columna fallará por la FK. useAiAssessments.ts:323 la omite, así que desde la semana 1 no se podrá guardar ninguna evaluación en ninguno de los dos tenants. El trigger de F2.T3 `assessor_id := auth.uid()` hace fallar igual todo INSERT de ai_risk_assessments. Además, F2.T7 compara revisor ≠ assessor_id (persona) ≠ created_by y frozen_by_id (usuario: fn_aims_freeze_assessment escribe `frozen_by_id = auth.uid()`), y F9.T2 compara edited_by (usuario) con reviewed_by_id (FK a persons). Al mezclar dominios, el control a cuatro ojos no comprueba nada.

**Corrección obligatoria.** En M01 y F2.T3, resolver la persona así: `(select person_id from user_profiles where user_id = auth.uid() and tenant_id = fn_current_tenant_id())`. Si sale NULL, rechazar con PERFIL_SIN_PERSONA; hacerlo en un trigger BEFORE INSERT, no con un DEFAULT auth.uid(). En DS-11 y F2.T7, comparar siempre en un único dominio, persona, y resolver del mismo modo frozen_by_id, created_by y edited_by. Añadir un test que falle si se compara un id de usuario con uno de persona. Corregir el §13 (obs. 25): «checked_by_id ya existe y es FK a persons».

### E-02 (MEDIA) — §2.1 RS-TABLA 9; F4.T6 (M06), F8.T10 (M17), F9.T1 (M18), F9.T2 (M19); §13 obs. 14

**Problema.** La obs. 14 solo está resuelta para las 8 tablas que se reviven. Medido en Cloud: cuatro tablas vivas que la especificación enmienda y a las que da valor probatorio siguen con ON DELETE CASCADE hacia ai_systems. Son aims_classification_questionnaires (cribado y cuestionario sellados con SHA-512), aims_system_versions (manifest_hash, versión publicada), aims_technical_file_sections y aims_monitoring_indicators. authenticated conserva DELETE sobre ai_systems (DA-16). Un sistema cribado como NO_ES_SISTEMA_IA no tiene sujetos con RESTRICT que lo protejan, así que al borrarlo desaparece el cribado sellado con su motivo. Pasa lo mismo con las versiones y el expediente de un sistema que aún no tiene cuestionario v2.

**Corrección obligatoria.** Ampliar RS-TABLA 9 a «toda tabla, nueva, revivida o viva enmendada, cuyo contenido pase a tener valor probatorio». Pasar a RESTRICT: aims_classification_questionnaires.system_id en M06, aims_system_versions.system_id en M18, aims_technical_file_sections.system_id en M19 y aims_monitoring_indicators.system_id en M17. Comprobar `confdeltype = 'r'` con control positivo en cada bloque de verificación. Declarar en DS-31 que, por esto, ninguna sonda puede limpiar borrando el sistema.

### E-03 (MEDIA) — F4.T6 (M06); §2.2 aims_classification_questionnaires (v2)

**Problema.** Medido: hoy existen `ux_aims_classification_completed_per_system (system_id) WHERE status='COMPLETED'`, `ux_aims_classification_draft_per_system (system_id) WHERE status='DRAFT'` y `UNIQUE (system_id, version)`. La especificación crea índices nuevos por scope y por (system_id, entity_id), pero no retira los existentes. Mientras sigan, no pueden convivir el CRIBADO COMPLETED y varios SUJETO COMPLETED del mismo sistema, uno por sociedad. Eso rompe DS-28 y el paso 5 de §3.3.

**Corrección obligatoria.** M06: `DROP INDEX ux_aims_classification_completed_per_system, ux_aims_classification_draft_per_system` y crear índices parciales por (system_id) WHERE scope='CRIBADO' y por (system_id, entity_id) WHERE scope='SUJETO', separados para COMPLETED y DRAFT. Revisar también `UNIQUE (system_id, version)`: o la RPC numera las versiones de forma monotónica por sistema, o el índice pasa a ser (system_id, scope, entity_id, version). Añadir un control positivo en la verificación: un CRIBADO y dos SUJETO COMPLETED de sociedades distintas sobre el mismo sistema entran; dos SUJETO COMPLETED de la misma sociedad fallan.

### E-04 (MEDIA) — DS-31, F4.T7, F4.T9; §13 obs. 2 y 19

**Problema.** Queda un resto de la obs. 2. src/test/schema/garrigues-ia-owner-write.test.ts es una sonda permanente de camino positivo: en cada corrida da de alta con fn_aims_registrar_sistema y payload de cuestionario v1 (líneas 95 y 156) y limpia con DELETE. La especificación no la menciona; solo reescribe aims-cuestionario-live. Con DS-29, que deja el alias aceptando solo v2, la sonda se pone roja, y con RESTRICT ya no puede limpiar.

**Corrección obligatoria.** Añadir a F4.T9 la reescritura de garrigues-ia-owner-write.test.ts: el aislamiento pasa a leer filas existentes de los dos tenants (G-VIVO-NEG); el alta positiva y el rechazo del tenant forjado pasan a una sonda revertida G-VIVO-REV archivada; el INSERT directo sigue como camino negativo. En DS-31, enumerar todas las sondas vivas con escritura positiva que devuelve un grep (aims-cuestionario-live, garrigues-ia-owner-write, aims-revisar-live).

### E-05 (MEDIA) — DS-29, F4.T8 (M08), F4.T9 (M09), §10.2, §12

**Problema.** Producción (Vercel) y desarrollo comparten governance_OS. Hoy la UI llama a fn_aims_completar_cuestionario v1 (useAimsClasificacion.ts:213) y a fn_aims_registrar_sistema con payload v1 (SistemaNuevo). Si M08 se aplica en Cloud al cerrar su tarea (canal MCP) y M09 y la UI v2 se despliegan más tarde, el alta y la clasificación quedan rotas en producción durante ese intervalo. Pasa lo mismo entre M08 y M09.

**Corrección obligatoria.** Añadir a DS-29 una regla de secuencia. M08 y M09 crean las funciones v2 sin retirar la v1. El REVOKE EXECUTE de la v1 y el rechazo con CUESTIONARIO_V1_RETIRADO van en una migración aparte, que se aplica después del despliegue en producción de la UI v2 (F4.T9 a F4.T12), verificado con el arnés de producción. Añadir la fila correspondiente a §12.

### E-06 (MEDIA) — F2.T18, F0.T1 (D-U5), §7 (RBAC ARGA); §13 obs. 13

**Problema.** F2.T18 declara «Migración: no» y solo usa fn_designar_cargo, que escribe condiciones_persona. Medido: authenticated solo tiene SELECT sobre user_profiles, y una cuenta nueva de Auth no tiene perfil (el login rechaza una autoalta sin perfil). Ninguna tarea escribe la fila de user_profiles de la segunda cuenta de ARGA (tenant …0001, role_code COMPLIANCE) ni su person_id. En Garrigues hizo falta la migración 20260914121000 para lo mismo. Además, §13 dice «Auth tiene 3 cuentas» y hay 4, una sin perfil.

**Corrección obligatoria.** Añadir a F2.T18 una migración G-MIG con el patrón de 20260914121000: alta del perfil (tenant ARGA, COMPLIANCE) y de su person_id, idempotente, que aborte si cambia el perfil de demo@ARGA. Enlazar preferentemente a una persona que ya sea miembro vigente del órgano de D-U2, y usar fn_designar_cargo solo si no la hay, declarando la fila nueva de ARGA. Corregir en §13 el recuento de cuentas de Auth.

### E-07 (MEDIA) — C-02, §3.3 paso 8, §5.1, F6.T2, F11.T1 (plan B)

**Problema.** fn_grc_alta_obligacion_organizacion_ria «falla cerrado» si no hay órgano acreditado, y fn_aims_sincronizar_obligaciones la llama dentro de fn_aims_completar_cuestionario_v2. Mientras falte D-U2, completar cualquier cuestionario de ARGA abortaría en cuanto aparezca una instancia de ORGANIZACION en APLICA. Eso anula el plan B de F11.T1 (ARGA Assist PROPUESTO) y contradice §7 («la instancia de ORGANIZACION de ARGA existe y dice “sin espejo GRC”»).

**Corrección obligatoria.** Fijar en C-02 y en F6.T2 que, si el tenant no tiene órgano acreditado para la especialidad, la sincronización no llama a la RPC de GRC. Deja la instancia con grc_obligation_id NULL y el motivo SIN_ORGANO_ACREDITADO en applicability_basis, sin abortar. Añadir una sonda G-VIVO-REV: completar un cuestionario de ARGA sin D-U2 termina con la instancia de ORGANIZACION creada y sin espejo.

### E-08 (MEDIA) — §2.2 (ai_systems.inventory_kind), DS-34, F2.T3, F2.T16

**Problema.** inventory_kind decide cuentaComoSistema() y saca el sistema del cribado, que no se ofrece a CONTRATO_MODELO ni a HOJA_DE_RUTA. Sin embargo, no figura entre las columnas «solo por RPC» ni lo cubre el trigger ampliado. Un cliente con escritura en ai_systems puede pasar un sistema real a HOJA_DE_RUTA y sacar sus obligaciones de todos los recuentos sin motivo ni sello: es el mismo hueco de la obs. 3. Además, F2.T16 dice «RPC y login real», pero ninguna RPC escribe inventory_kind ni ai_policy_id.

**Corrección obligatoria.** Añadir inventory_kind al trigger de guardia de DS-32 y crear la RPC `fn_aims_fijar_tipo_inventario(p_system_id, p_kind, p_motivo)`, con capacidad AIMS_INVENTARIO, motivo de al menos 40 caracteres y registro. Añadir una sonda G-VIVO-NEG del UPDATE directo. Corregir F2.T16 para que nombre las RPC que usa o declare qué columnas escribe directamente con capacidad.

### E-09 (BAJA) — DS-07, F6.T1

**Problema.** La paridad de F6.T1 solo cubre fn_aims_estado_organizacion(p_cobertura, …). La cobertura calculada en SQL (estados de controls más el marcador «[Marco Prospectivo]» del título) es una segunda implementación de obligationCoverage sin gate de paridad. Es la misma deriva que la obs. 16 pedía evitar.

**Corrección obligatoria.** Crear `fn_grc_cobertura_obligacion(p_title text, p_estados text[])` IMMUTABLE, espejo de obligation-coverage.ts, y una sonda G-VIVO-NEG que compare SQL y TS sobre todas las obligaciones reales de los dos tenants. Incluir control positivo con un título prospectivo y con CTR-008 Inefectivo, que debe dar EN PROCESO.

### E-10 (BAJA) — §2.3 (G-FRONTERA), F5.T2

**Problema.** El escaneo SQL se limita a `supabase/migrations/*aims*`. Hay migraciones de la propia especificación que no casan con ese patrón (`…_ai_columnas_sujeto.sql`, `…_grc_*`, `…_secretaria_dictamen_ia.sql`): una fn_aims_* o un trigger de AIMS definidos en ellas quedarían fuera del gate.

**Corrección obligatoria.** Escanear todas las migraciones y seleccionar por nombre de función (`create or replace function public.fn_aims_*`, última definición), no por nombre de fichero. Aplicar lo mismo a fn_grc_* y fn_secretaria_* para el espejo de C-08 (que no escriban en ai_* ni aims_*). Añadir un señuelo en una migración cuyo nombre no contenga «aims».

### E-11 (BAJA) — F3.T3 / F3.T10 (DS-35); §13 obs. 9

**Problema.** El crítico pedía un test por cada obligación de los capítulos VIII y IX y del art. 86. F3.T3 solo prueba la regla de herencia en abstracto, así que una fila mal curada (predicado de Alto sin herencia) pasaría.

**Corrección obligatoria.** Añadir en F3.T10 un test de propiedad sobre el catálogo publicado: ninguna fila cuyo predicado exija nivel Alto puede dar EXIGIBLE antes del 2-12-2027 (anexo III) o del 2-8-2028 (anexo I), y con puesta en servicio anterior y sin cambio significativo debe dar LATENTE_111_2. Control positivo con una fila de alto riesgo inventada sin herencia.

### E-12 (BAJA) — DS-33, §2.2 aims_ria_records, F4.T6, F0.T1

**Problema.** La supresión gobernada es una excepción al principio de solo anexión, y CLAUDE.md trata WORM como invariante de modelo. La excepción no figura entre las decisiones del usuario, y fn_aims_suprimir_datos_registro no tiene definidos capacidad, motivo ni rastro.

**Corrección obligatoria.** Añadir D-U8 a F0.T1: excepción de redacción RGPD sobre aims_ria_records. En §2.2, fijar que fn_aims_suprimir_datos_registro exige AIMS_GOBIERNO, un motivo, que el registro no esté en legal_hold y una anotación nueva que referencie el registro redactado. Añadir sondas G-VIVO-NEG de redacción sin capacidad y de redacción sobre un registro en legal_hold.

### E-13 (BAJA) — §9 H-14, F6.T3, §10.2

**Problema.** H-14 debe enviarse antes del 13-11 y F6.T3, del carril rápido, exige su veredicto (G-HARVEY). A diferencia del resto de lotes, ninguna tarea lo envía ni lo archiva.

**Corrección obligatoria.** Asignar el envío de H-14 a una tarea con fecha (por ejemplo, F4.T1 o una F4.T16 nueva), con fichero `docs/legal/harvey/…-lote-H-14.md` y entrada en registro.json. Declarar en F6.T3 el plan B si no hay veredicto antes del 14-11: «Cobertura provisional», sin bloquear el carril.

### E-14 (BAJA) — F5.T3, §12

**Problema.** Al convertir el segundo fallback en RAISE, en Garrigues, que no tiene filas en grc_modules para gdpr, dora ni tprm (medido), abortará cualquier siembra futura de un OBL-GDPR-*, OBL-DORA-* u OBL-EIOPA-*. Es el fallo ruidoso que se busca, pero choca con la siembra progresiva de Garrigues y no está declarado. Además, la salida fácil sería renombrar el código para que caiga en el ELSE.

**Corrección obligatoria.** Declarar en F5.T3 y en §12 que el remedio de ese RAISE es crear la fila del módulo en grc_modules para ese tenant (es dato; no abre la vista fixture de DS-14) y nunca cambiar el código de la obligación. Añadir a G-SYNC un caso que falle si una obligación con prefijo de rama nombrada acaba en 'risk'.

### E-15 (ALTA) — DS-38, RH-2, §3.1 S10 F_2, F9.T1, §9 H-02 P9 (añadida al integrar F1, 19-09-2026)

**Problema.** DS-38, RH-2, la ayuda de F_2 y la aceptación de F9.T1 afirman que «cambio significativo» (111.2) **no es** «modificación sustancial» (3.23). Esa premisa viene de Harvey (H-01, consideración 2) y el literal la contradice: el considerando 177 del Reglamento 2024/1689 dice que «el concepto de "cambio significativo" debe entenderse como equivalente en sustancia al de "modificación sustancial"». El 2026/1744 modifica el art. 111.2 y no revisa ese considerando (cotejo en `docs/legal/2026-09-19-verificacion-omnibus-puntos-abiertos.md`, clave `cdo-177`).

**Corrección obligatoria.** Se mantiene el mecanismo de DS-38: la herramienta no deduce la clase, y SIGNIFICATIVO_111_2 exige dictamen de consulta interna. Cambia la premisa. La ayuda de F_2 y el texto de F9.T1 dicen que, según el considerando 177, el cambio significativo equivale en sustancia a la modificación sustancial del art. 3.23. El dictamen (CP-2) parte de ese criterio y, si se aparta, lo justifica. Ninguna superficie afirma que sean conceptos distintos; un gate de texto sobre la ayuda lo vigila. La P9 de H-02 se reformula: se pregunta a Harvey qué alcance tiene el considerando 177 tras el 2026/1744, no si cabe la analogía.
