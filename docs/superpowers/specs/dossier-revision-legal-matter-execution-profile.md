# Dossier de revision legal - MatterExecutionProfile

Fecha: 2026-05-17
Commit tecnico revisado: `08eb9b6 feat(secretaria): add matter execution profile`
Modulo: `src/lib/secretaria/matter-execution-profile.ts`
Suite de contrato: `src/lib/secretaria/__tests__/matter-execution-profile.test.ts`
Estado: criterio legal P1-P14 recibido y aplicado (2026-05-18, ver
`2026-05-18-criterio-garrigues-legal-matter-execution-profile.md` y commits
f851f73/03aea48/d932361). Fase 1 (panel informativo no disruptivo en
TramitadorStepper) AUTORIZADA y conectada el 2026-07-18 — ver checklist §9.
Los checkpoints operativos (fase 2+) siguen requiriendo decision expresa.

## 0. Proposito del dossier

Este dossier traduce el contrato tecnico `MatterExecutionProfile` a lenguaje de revision legal. El objetivo es validar si la logica computable de adopcion, prerequisitos, documentacion y post-acuerdo refleja correctamente la funcion de secretaria societaria antes de que el modulo se use en el flujo operativo.

El `MatterExecutionProfile` no selecciona plantillas. Esa funcion corresponde al `Matter Registry`. Este modulo modela como se adopta validamente un acuerdo y que ocurre despues de adoptarlo:

- gates formales evaluables: convocatoria, constitucion, votacion, documentacion y post-acuerdo;
- prerequisitos como grafo de materias;
- workflow posterior: libro de actas, certificacion, escritura, inscripcion y publicacion;
- overrides tipificados por via legal alternativa o desviacion con riesgo;
- eficiencia de Capa 3 para rutas rapidas de duplicacion de expedientes.

Principio operativo actual: ningun gate elimina el control del secretario. Todos los gaps son `overridable: true`. La diferencia juridica se conserva en trazabilidad mediante `override_tipo` y `risk_flag`.

## 1. Matriz de gates por materia

La tabla refleja el contrato actual del modulo, no una opinion legal cerrada. Cuando el valor procede del `rulePackPayload`, Legal debe revisar que el rule pack vigente expresa correctamente la regla sustantiva para la combinacion materia + organo + tipo social.

| Materia / contexto | Convocatoria | Constitucion | Votacion | Documentacion | Post-acuerdo | Fuente base en perfil |
|---|---|---|---|---|---|---|
| `APROBACION_CUENTAS` - Junta SA | Plazo de `rulePackPayload.convocatoria.antelacionDias.SA`; en tests: 30 dias | Quorum de `constitucion.quorum.SA_1a`; en tests: 25% | Mayoria de `votacion.mayoria.SA`; en tests: `favor > contra` | Cuentas formuladas | No inscribible por defecto; deposito posterior no modelado como inscripcion del acuerdo | Arts. 176, 193, 201 y 253 LSC |
| `APROBACION_CUENTAS` - Junta SL | Plazo de `antelacionDias.SL`; en tests: 15 dias | Quorum de `constitucion.quorum.SL`; en tests: 0 | Mayoria de `votacion.mayoria.SL`; en tests: `favor >= 1/3 capital` | Cuentas formuladas | No inscribible por defecto | Arts. 176, 198 y 253 LSC |
| `FORMULACION_CUENTAS` - organo de administracion | Depende de rule pack del organo; en modos unipersonales no exige convocatoria | Quorum de Consejo si aplica | Mayoria de Consejo si aplica | Cuentas, informe de gestion y propuesta de aplicacion del resultado como campos/documentos del expediente | Paso previo a aprobacion por Junta | Art. 253 LSC |
| `DISTRIBUCION_DIVIDENDOS` - Junta | Plazo de convocatoria de Junta segun tipo social | Quorum de Junta segun rule pack | Mayoria de Junta segun rule pack | Debe constar base de cuentas aprobadas y beneficio distribuible en expediente | No inscribible por defecto salvo acuerdos complementarios | Art. 273 LSC |
| `NOMBRAMIENTO_AUDITOR` | Plazo de convocatoria de Junta si se adopta en reunion | Quorum de Junta segun rule pack | Mayoria de Junta segun rule pack | Propuesta de nombramiento y duracion del encargo | Puede exigir certificacion / inscripcion segun rule pack | Art. 264 LSC |
| `NOMBRAMIENTO_AUDITOR` - duracion | No aplica como gate propio | No aplica | No aplica | `evaluateFormalGate` marca `BLOCKING` si `duracion_anos` esta fuera de 3-9 | Riesgo de calificacion si se fuerza override | Art. 264 LSC |
| `NOMBRAMIENTO_CONSEJERO` - Junta | Plazo de Junta segun tipo social | Quorum de Junta | Mayoria de Junta | Identidad, aceptacion y, si procede, condicion del consejero | Normalmente certificacion e inscripcion si el rule pack lo marca | Arts. 214, 217-219 LSC |
| `NOMBRAMIENTO_CONSEJERO` - cooptacion Consejo | Convocatoria de Consejo segun rule pack/estatutos | Quorum de Consejo; en tests: `mayoria_miembros` | Mayoria de Consejo; en tests: `mayoria_consejeros` | Vacante y aceptacion del cooptado | Inscripcion segun rule pack | Art. 244 LSC |
| `NOMBRAMIENTO_CONSEJERO` - cooptacion en SL | Igual que cooptacion, pero el perfil genera gap | Igual | Igual | Requiere revision estatutaria expresa | Riesgo de impugnabilidad si se fuerza | Art. 244 LSC |
| `CESE_CONSEJERO` - Consejo | Convocatoria de Consejo | Quorum de Consejo; en tests: `mayoria_miembros` | Mayoria de Consejo; en tests: `mayoria_consejeros` | Debe individualizar causa/renuncia si procede | Inscripcion segun rule pack | Arts. 223, 245-248 LSC |
| `CESE_CONSEJERO` - Junta | Convocatoria de Junta | Quorum de Junta; en tests SA: 25% | Mayoria de Junta; en tests SA: `favor > contra` | Identificacion del consejero cesado | Inscripcion segun rule pack | Art. 223 LSC |
| `DELEGACION_FACULTADES` - Consejo | Convocatoria de Consejo | Quorum de Consejo | Mayoria de Consejo | Nombramiento previo del consejero delegado o miembro de Consejo | Inscripcion cuando el rule pack lo exija | Art. 249 LSC |
| `MODIFICACION_ESTATUTOS` | Convocatoria de Junta; Legal debe validar derecho de informacion reforzado | Quorum reforzado si procede por materia/tipo social | Mayoria reforzada si procede | Texto integro de la modificacion estatutaria | Habitualmente certificacion, escritura, inscripcion y, si procede, publicacion | Arts. 285-290 LSC |
| `AMPLIACION_OBJETO_SOCIAL` | Convocatoria de Junta con texto integro disponible | Quorum reforzado si procede | Mayoria reforzada si procede | Texto integro de nueva redaccion | Habitualmente escritura, RM y BORME | Arts. 285-290 LSC |
| `FUSION` | Convocatoria de Junta y regimen de modificaciones estructurales | Quorum segun rule pack y subtipo | Mayoria segun rule pack y subtipo | Proyecto comun e informes exigidos cuando procedan | Forzado por perfil: certificacion, escritura, RM y BORME | RDL 5/2023, arts. 11-25 y 35-52 |
| `ESCISION` | Convocatoria de Junta y regimen de modificaciones estructurales | Quorum segun rule pack y subtipo | Mayoria segun rule pack y subtipo | Proyecto comun e informes exigidos cuando procedan | Forzado por perfil: certificacion, escritura, RM y BORME | RDL 5/2023, arts. 11-25 y 60-67 |
| `FUSION_ESCISION` generica | Igual que modificacion estructural, pero requiere subtipo | Igual | Igual | Gap `SUBTIPO_MODIFICACION_ESTRUCTURAL_PENDIENTE` si no hay subtipo | Forzado por perfil: certificacion, escritura, RM y BORME | RDL 5/2023 |
| `OPERACION_VINCULADA` | Convocatoria segun organo competente | Quorum segun rule pack | Mayoria segun rule pack | El perfil incorpora abstenciones obligatorias de consejeros afectados | Depende de rule pack y regimen aplicable | Arts. 228-229 LSC y regimen de vinculadas |
| `CERTIFICACION_ACUERDOS` | No es adopcion sustantiva; depende del acto certificado | No aplica como acuerdo sustantivo | No aplica como acuerdo sustantivo | Acta aprobada del acuerdo certificado | Certificacion como pieza de ejecucion/tramitacion | RRM arts. 108-109 |
| `FINANCIACION` | Consejo/Junta segun competencia y rule pack | Segun organo | Segun organo | Term sheet, condiciones esenciales y garantias | Puede requerir escritura/inscripcion si hay garantias | Regimen general del organo y cautelas de activos esenciales |
| `CONTRATACION_RELEVANTE` | Consejo/Junta segun competencia y rule pack | Segun organo | Segun organo | Contrato, condiciones esenciales, contraparte y firmante | No inscribible por defecto; puede escalar si afecta activos esenciales | Art. 160.f LSC y cautelas de vinculadas |

### Observaciones de revision sobre la matriz

- El modulo usa `adoption_mode` para desactivar convocatoria en vias alternativas o modos no reunidos: `UNIPERSONAL_SOCIO`, `UNIPERSONAL_ADMIN`, `SOLIDARIO`, `CO_APROBACION` y `UNIVERSAL`.
- `segunda_convocatoria` queda actualmente derivada de tipo social SA/SAU. Legal debe confirmar como tratar SL con prevision estatutaria expresa.
- Los valores de quorum y mayoria no estan hardcodeados en este modulo: se leen del rule pack. La revision legal debe cubrir tanto este dossier como los rule packs vigentes.
- Las modificaciones estructurales estan reforzadas en el perfil: aunque el rule pack no lo indique, el modulo fuerza workflow de certificacion, escritura, inscripcion registral y publicacion BORME.

## 2. Tabla de prerequisitos y severidad

El modulo modela prerequisitos como grafo, no como texto narrativo. Cada prerequisito declara materia requerida, organo requerido si aplica, estado minimo, fuente, si es verificable automaticamente y severidad.

| Materia principal | Prerequisito | Organo requerido | Estado minimo | Severity | Verificable automaticamente | Fuente | Estado en `08eb9b6` |
|---|---|---|---|---|---|---|---|
| `APROBACION_CUENTAS` | `FORMULACION_CUENTAS` | `ORGANO_ADMIN` | `APROBADO` | `BLOCKING` | Si | Art. 253 LSC | Implementado |
| `DISTRIBUCION_DIVIDENDOS` | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `APROBADO` | `BLOCKING` | Si | Art. 273 LSC | Implementado |
| `DISTRIBUCION_DIVIDENDOS` | `FORMULACION_CUENTAS` | `ORGANO_ADMIN` | `APROBADO` | `WARNING` | Si | Art. 253 LSC por cadena `APROBACION_CUENTAS` | Implementado |
| `FUSION` | `PROYECTO_COMUN_MODIFICACION_ESTRUCTURAL` | No aplica | `DOCUMENTADO` | `WARNING` | No | Arts. 11-25 RDL 5/2023 | Implementado |
| `ESCISION` | `PROYECTO_COMUN_MODIFICACION_ESTRUCTURAL` | No aplica | `DOCUMENTADO` | `WARNING` | No | Arts. 11-25 RDL 5/2023 | Implementado |
| `FUSION_ESCISION` | `PROYECTO_COMUN_MODIFICACION_ESTRUCTURAL` | No aplica | `DOCUMENTADO` | `WARNING` | No | Arts. 11-25 RDL 5/2023 | Implementado |
| `DELEGACION_FACULTADES` | `NOMBRAMIENTO_CONSEJERO` | No fijado | `INSCRITO` | `WARNING` | Si | Art. 249 LSC | Implementado |
| `CERTIFICACION_ACUERDOS` | `ACTA_APROBADA` | No aplica | `APROBADO` | `BLOCKING` | Si | RRM arts. 108-109 | Implementado |

### Criterio actual de gaps de prerequisito

- Si falta un prerequisito `BLOCKING`, el gap se emite como `DESVIACION_CON_RIESGO` con `risk_flag: TRAZABILIDAD_PARCIAL`.
- Si falta un prerequisito `WARNING`, el gap se emite como advertencia trazable y overridable.
- El secretario puede avanzar en ambos casos, pero el snapshot debe conservar la desviacion.

### Puntos que Legal debe confirmar

- Si `DELEGACION_FACULTADES -> NOMBRAMIENTO_CONSEJERO` debe ser `BLOCKING` y no `WARNING`.
- Si el proyecto comun de fusion/escision debe ser `BLOCKING` desde el inicio del expediente o `WARNING` hasta el checkpoint de convocatoria.
- Si la formulacion de cuentas en la cadena de dividendos debe mantenerse como prerequisito transitorio `WARNING` o eliminarse cuando ya exista aprobacion de cuentas.

## 3. Criterio de overrides

El modulo distingue dos clases juridicas de override:

| Tipo | Descripcion | Consecuencia juridica en perfil | Ejemplos |
|---|---|---|---|
| `VIA_ALTERNATIVA` | El secretario no ignora la regla, usa una via legal alternativa que dispensa o sustituye el requisito ordinario | No lleva `risk_flag` ni `consecuencia` negativa por defecto | Junta universal art. 178 LSC; consentimiento unanime; regimen simplificado si Legal lo valida |
| `DESVIACION_CON_RIESGO` | Se avanza pese a un defecto, carencia o incertidumbre formal | Debe llevar `risk_flag`, consecuencia y trazabilidad en `compliance_snapshot` | Convocatoria con plazo inferior; duracion auditor fuera de rango; certificacion sin acta aprobada; modificacion estructural sin subtipo |

### Risk flags actuales

| `risk_flag` | Uso previsto |
|---|---|
| `IMPUGNABILIDAD` | Defectos de convocatoria, competencia, quorum, mayoria o cooptacion dudosa |
| `CALIFICACION_REGISTRAL` | Riesgos que pueden afectar elevacion, escritura, inscripcion o calificacion del registrador |
| `NULIDAD` | Reservado para supuestos de invalidez estructural grave que Legal debe concretar |
| `TRAZABILIDAD_PARCIAL` | Falta de prerequisito o documento que impide reconstruccion completa del expediente |

### Ejemplos implementados

| Caso | Resultado |
|---|---|
| Junta universal o consentimiento unanime en gate `CONVOCATORIA` | `PASSED` + override informativo `VIA_ALTERNATIVA`, fundamento `Art. 178 LSC junta universal / consentimiento unanime` |
| Plazo de convocatoria inferior al minimo del perfil | `OVERRIDE_REQUIRED`, gap `NOTICE_PERIOD_SHORT`, `DESVIACION_CON_RIESGO`, `risk_flag: IMPUGNABILIDAD` |
| Nombramiento de auditor por duracion inferior a 3 o superior a 9 anos | `OVERRIDE_REQUIRED`, gap `AUDITOR_DURATION_OUT_OF_RANGE`, `risk_flag: CALIFICACION_REGISTRAL` |
| Documento obligatorio no aportado | `WARNING`, gap `DOCUMENT_REQUIRED_NOT_FOUND`, `risk_flag: TRAZABILIDAD_PARCIAL` |

### Decision pendiente

Legal debe confirmar si el termino `allowed: true` debe mantenerse como invariante absoluto o si existen supuestos en los que la UI debe exigir una doble confirmacion reforzada aunque tecnicamente siga permitiendo avanzar.

## 4. Materias con incertidumbre o cobertura incompleta

Estas materias no quedan cerradas por el contrato actual y requieren decision legal antes de convertir el perfil en panel UX o checkpoint operativo.

| Materia / bloque | Incertidumbre | Impacto tecnico |
|---|---|---|
| `DISOLUCION` | Causas legales/estatutarias, mayorias y coordinacion con liquidadores | Nuevos prerequisitos y `post_acuerdo` especifico |
| `LIQUIDACION` | Nombramiento de liquidadores, balance inicial/final, proyecto de division | Workflow post-acuerdo y documentos obligatorios |
| `EMISION_OBLIGACIONES` | Competencia Junta/Consejo, formalidades e inscripcion segun instrumento | Gate de competencia y documentacion financiera |
| `EMISION_DEUDA_CONVERTIBLE` | Bases de conversion, derechos preferentes, informes y posible aumento de capital | Prerequisitos y documentacion preceptiva reforzada |
| `ADQUISICION_PROPIA` | Diferencias SA/SL, limites cuantitativos, finalidad y vigencia | Parametros numericos y validaciones de regla |
| `EXCLUSION_SOCIO` | Causa legal/estatutaria, socio afectado, valoracion/reembolso | Prerequisitos probatorios y riesgos de impugnacion |
| `SEPARACION_SOCIO` | Ejercicio del derecho, causa y metodo de valoracion | Gate documental y workflow de ejecucion |
| `PACTO_PARASOCIAL` | Competencia de Junta vs toma de razon, eficacia inter partes | Tratamiento como acuerdo societario o evidencia privada |
| `FINANCIACION` | Activos esenciales, garantias reales, partes vinculadas, Solvencia II | Veto checks, documentacion y comunicacion regulador |
| `CONTRATACION_RELEVANTE` | Umbral art. 160.f LSC, vinculadas y delegaciones de firma | Escalado a Junta y booleanos Capa 3 |

### Parametros estatutarios no modelados todavia

| Parametro | Estado actual | Riesgo |
|---|---|---|
| Plazo de convocatoria de Consejo | Entra via rule pack/overrides, no tabla versionada de estatutos | El perfil no puede resolver por si solo reglas estatutarias historicas |
| Segunda convocatoria en SL | Actualmente `segunda_convocatoria` solo se activa por SA/SAU | Puede infrarepresentar sociedades SL con prevision estatutaria |
| Voto de calidad | Modelado en otros motores, no como gate formal propio del perfil | Puede afectar proclamacion de acuerdo |
| Quorum/mayorias reforzadas estatutarias | Via `rule_param_overrides`, no repositorio estatutario versionado | Trazabilidad parcial del fundamento estatutario |
| Reglamentos internos de Consejo/comisiones | No modelados como fuente versionada | Riesgo en comisiones y Consejo cotizado |

### Zonas grises interpretativas

- Cese ad nutum por Consejo: el modulo bifurca Consejo/Junta, pero Legal debe confirmar si el caso Consejo debe limitarse a renuncia, toma de razon o supuestos especificos.
- Cooptacion en SL: actualmente genera `WARNING` con riesgo, no bloqueo. Legal debe confirmar si debe degradar a `BLOCKING`.
- Operaciones vinculadas en no cotizadas: el perfil solo incorpora abstencion si la materia es `OPERACION_VINCULADA`; falta decision sobre umbrales y escalado.
- Cotizadas: el perfil conserva `is_listed`, pero no codifica todavia especialidades completas LMV/LSC para sociedades cotizadas.
- Solvencia II / ARGA: el perfil no modela todavia comunicaciones o condicionantes regulatorios sectoriales para financiacion, operaciones estructurales, gobierno o remuneraciones.

### Mini-dossier pendiente: `DISOLUCION` y `LIQUIDACION`

`DISOLUCION` y `LIQUIDACION` no deben cerrarse con una unica pregunta binaria. Son dos materias conectadas, pero distintas: la disolucion abre el periodo de liquidacion y la liquidacion despliega una cadena documental hasta la extincion registral.

#### `DISOLUCION` - mapa minimo que Legal debe completar

| Causa | Fuente | Organo competente | Adoption mode | Quorum | Mayoria | Documentacion preceptiva |
|---|---|---|---|---|---|---|
| Voluntaria por acuerdo de Junta | Art. 368 LSC | `JUNTA_GENERAL` | `MEETING` / `UNIVERSAL` | Pendiente Legal | Pendiente Legal | Acta de Junta |
| Causa legal por perdidas | Art. 363.1.e LSC | `JUNTA_GENERAL` | `MEETING` / `UNIVERSAL` | Pendiente Legal | Pendiente Legal | Balance actualizado + informe administradores |
| Judicial a instancia de interesado | Art. 366 LSC | Juzgado | Fuera del perfil ordinario | N/A | N/A | Demanda + resolucion judicial |
| De pleno derecho por transcurso de plazo | Art. 360 LSC | N/A | Fuera del perfil ordinario | N/A | N/A | Constancia registral / estatutaria |
| Reduccion bajo minimo sin remedio | Art. 363.1.f LSC | `JUNTA_GENERAL` | `MEETING` / `UNIVERSAL` | Pendiente Legal | Pendiente Legal | Balance + acuerdo de no transformacion/aumento |

Decision tecnica recomendada: `DISOLUCION` deberia exigir `subtipo_materia` obligatorio. Si no se informa la causa, el perfil deberia emitir `SUBTIPO_DISOLUCION_PENDIENTE` con severity a confirmar por Legal.

Prerequisitos candidatos:

| Causa | Prerequisito | Estado minimo | Severity propuesta |
|---|---|---|---|
| Perdidas art. 363.1.e | Balance actualizado que acredite patrimonio neto inferior a la mitad del capital | `DOCUMENTADO` | `BLOCKING` |
| Voluntaria | Sin prerequisito sustantivo especifico | N/A | N/A |
| Reduccion bajo minimo sin remedio | Evidencia de no transformacion/aumento simultaneo | `DOCUMENTADO` | `WARNING` |

Post-acuerdo candidato:

`CERTIFICACION -> ESCRITURA_PUBLICA -> INSCRIPCION_REGISTRAL -> PUBLICACION_BORME -> NOMBRAMIENTO_LIQUIDADORES si procede -> APERTURA_PERIODO_LIQUIDACION`

Legal debe decidir si el plazo de dos meses del art. 367 LSC se modela como gate temporal de convocatoria o como warning informativo del panel.

#### `LIQUIDACION` - actos formales y decision arquitectonica

| Acto | Fuente | Organo | Documentacion | Inscribible |
|---|---|---|---|---|
| Nombramiento de liquidadores si no son administradores | Art. 376 LSC | `JUNTA_GENERAL` | Acta + aceptacion | Si |
| Inventario y balance inicial | Art. 383 LSC | Liquidadores | Balance inicial | No per se |
| Operaciones de liquidacion | Arts. 384-387 LSC | Liquidadores | Evidencia de cobros, pagos y realizacion de activo | No |
| Balance final de liquidacion | Art. 390 LSC | Liquidadores / Junta para aprobacion | Balance final + informe | Base para extincion |
| Proyecto de division del haber social | Art. 391 LSC | Liquidadores | Proyecto de division | No per se |
| Aprobacion de balance final y proyecto | Art. 390 LSC | `JUNTA_GENERAL` | Acta aprobatoria | Si, como base de escritura |
| Escritura de extincion | Art. 395 LSC | Liquidadores | Escritura publica | Si, cancelacion registral |

Grafo candidato de liquidacion:

`DISOLUCION (INSCRITA) -> NOMBRAMIENTO_LIQUIDADORES (INSCRITO, si procede) -> BALANCE_INICIAL_LIQUIDACION (DOCUMENTADO) -> OPERACIONES_LIQUIDACION (DOCUMENTADO) -> BALANCE_FINAL + PROYECTO_DIVISION (DOCUMENTADO) -> APROBACION_BALANCE_FINAL (APROBADO) -> PAGO_CUOTA_LIQUIDACION (EJECUTADO) -> ESCRITURA_EXTINCION (INSCRITA)`

Decision Legal necesaria:

- Opcion A: `DISOLUCION` y `LIQUIDACION` como dos materias con perfil propio. Es mas completa y permite gates para aprobacion del balance final.
- Opcion B: `DISOLUCION` como materia con perfil y `LIQUIDACION` como workflow extendido post-acuerdo. Es mas simple, pero pierde granularidad formal.

## 5. Preguntas cerradas para Garrigues / Legal

Responder cada punto con una opcion. La columna "impacto tecnico" indica el campo exacto a parametrizar.

| # | Pregunta | Opciones | Impacto tecnico |
|---|---|---|---|
| 1 | Para Junta General SA, debe mantenerse el plazo base de 30 dias en todos los acuerdos ordinarios? | (a) Si, salvo override estatutario; (b) No, diferenciar ordinarios/especiales; (c) Revisar por materia | `convocatoria.plazo_minimo_dias` y rule packs |
| 2 | Para SL, debe contemplarse segunda convocatoria si los estatutos lo prevén? | (a) Si, via override estatutario; (b) No mostrar hasta tabla estatutos; (c) Warning manual | `convocatoria.segunda_convocatoria` |
| 3 | La falta de proyecto comun en fusion/escision debe ser `BLOCKING` desde el inicio? | (a) Si; (b) Warning hasta convocatoria; (c) Warning siempre | `MatterPrerequisite.severity` |
| 4 | La delegacion de facultades exige consejero previamente inscrito como `BLOCKING`? | (a) Si; (b) Warning; (c) Depende de facultad delegada | `DELEGACION_FACULTADES` prerequisito |
| 5 | La cooptacion en SL debe bloquearse como desviacion de alto riesgo? | (a) `BLOCKING`; (b) `WARNING`; (c) Permitida si estatutos lo prevén | gap `COOPTACION_SOLO_SA` |
| 6 | El cese por Consejo debe limitarse a renuncia/toma de razon? | (a) Si; (b) Admitir otros supuestos; (c) Requiere subtipo obligatorio | `subtipo_materia` y Matter Registry |
| 7 | Las operaciones vinculadas no cotizadas requieren gate especifico de abstencion siempre? | (a) Si; (b) Solo si conflicto declarado; (c) Solo por importe/umbral | `votacion.abstenciones_obligatorias` |
| 8 | Activos esenciales en financiacion/contratacion deben activar prerequisito de Junta? | (a) Siempre si supera 25%; (b) Tambien por relevancia funcional; (c) Solo warning | `votacion.veto_checks` y prerequisitos |
| 9 | Para ARGA cotizada/aseguradora, que materias requieren comunicacion o revision regulatoria sectorial? | (a) Estructurales; (b) Financiacion/garantias; (c) Remuneraciones/gobierno; (d) Todas las anteriores | `post_acuerdo.comunicacion_regulador` futuro |
| 10 | Los gaps `BLOCKING` deben exigir doble confirmacion en UX aunque sigan siendo overridable? | (a) Si; (b) No, basta justificacion; (c) Solo para impugnabilidad/calificacion | politica UX de override |
| 11 | La adquisicion de acciones/participaciones propias requiere perfil formal propio o se subsume en otro gate? | (a) Perfil propio `ADQUISICION_PROPIA`; (b) Subtipo de `OPERACION_VINCULADA`; (c) Warning documental hasta nueva version | Nueva materia o `subtipo_materia` |
| 12 | Exclusion y separacion de socio deben modelarse como materias independientes? | (a) Dos perfiles independientes; (b) Un perfil comun con subtipo; (c) Workflow derivado de otra materia | Nuevas materias, prerequisitos y gates de votacion |
| 13 | Deuda convertible debe separarse de emision de obligaciones? | (a) Perfil independiente; (b) Subtipo de `EMISION_OBLIGACIONES`; (c) Diferir hasta segunda ronda | `subtipo_materia` y documentacion preceptiva |
| 14 | Pactos parasociales con veto deben generar gate de votacion o solo warning informativo? | (a) Gate global en materias afectadas; (b) Warning informativo; (c) Solo si el pacto esta registrado y vigente | `votacion.veto_checks` y `pactosParasociales` |

## 6. Casos de prueba legales solicitados

Legal deberia devolver 10-15 expedientes ejemplo con resultado esperado. Cada fila debe ser atomica y convertible a un `it()` de Vitest sin interpretacion intermedia.

Columnas obligatorias:

| Columna | Uso | Ejemplo |
|---|---|---|
| `materia` | Valor exacto del enum del sistema | `APROBACION_CUENTAS` |
| `organo_tipo` | Valor exacto del enum | `JUNTA_GENERAL` |
| `tipo_social` | `SA`, `SL`, `SAU` o `SLU` | `SA` |
| `escenario` | Hechos del expediente: que existe, que falta y que es irregular | Formulacion previa aprobada; convocatoria 30 dias; quorum 40%; unanimidad |
| `resultado_esperado` | Resultado determinista | `PASSED_LIMPIO`, `PASSED_CON_WARNING`, `OVERRIDE_REQUIRED` o `BLOCKING_GAP` |

Columnas adicionales:

| Columna | Obligatoriedad recomendada | Ejemplo |
|---|---|---|
| `adoption_mode` | Obligatoria en materias inscribibles | `MEETING`, `UNIVERSAL`, `NO_SESSION` |
| `subtipo_materia` | Obligatoria si el subtipo cambia gates | `COOPTACION`, `FUSION_ABSORCION`, `RENUNCIA` |
| `override_esperado` | Obligatoria si hay gap, warning u override | `DESVIACION_CON_RIESGO`, `risk_flag: IMPUGNABILIDAD` |

Reglas de calidad para Legal:

- No mezclar varios escenarios en una misma fila.
- No usar resultados ambiguos como "segun proceda" o "si aplica".
- No inventar materias fuera del catalogo; si es materia nueva, marcarla como propuesta.
- En materias inscribibles, informar siempre `adoption_mode`.
- En materias con bifurcacion legal, informar siempre `subtipo_materia`.
- Si el resultado esperado incluye gap, informar `override_esperado`.

Ejemplos de filas:

| # | materia | organo_tipo | tipo_social | adoption_mode | subtipo_materia | escenario | resultado_esperado | override_esperado |
|---|---|---|---|---|---|---|---|---|
| 1 | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `SA` | `MEETING` | N/A | Formulacion previa aprobada; convocatoria 30 dias; quorum 40%; unanimidad | `PASSED_LIMPIO`, 0 gaps | N/A |
| 2 | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `SA` | `MEETING` | N/A | Sin formulacion previa en expediente | `BLOCKING_GAP`: prerequisito `FORMULACION_CUENTAS` no encontrado | `DESVIACION_CON_RIESGO`, `TRAZABILIDAD_PARCIAL` |
| 3 | `CESE_CONSEJERO` | `JUNTA_GENERAL` | `SA` | `UNIVERSAL` | `AD_NUTUM` | Junta universal art. 178 LSC; todos presentes aceptan orden del dia | `PASSED_CON_WARNING`: via alternativa de convocatoria | `VIA_ALTERNATIVA`, sin risk_flag |
| 4 | `NOMBRAMIENTO_CONSEJERO` | `CONSEJO_ADMIN` | `SL` | `MEETING` | `COOPTACION` | Cooptacion sin prevision estatutaria expresa | `OVERRIDE_REQUIRED`: gap `COOPTACION_SOLO_SA` | `DESVIACION_CON_RIESGO`, `IMPUGNABILIDAD` |
| 5 | `NOMBRAMIENTO_AUDITOR` | `JUNTA_GENERAL` | `SA` | `MEETING` | N/A | Duracion propuesta de 2 anos | `BLOCKING_GAP`: `AUDITOR_DURATION_OUT_OF_RANGE` | `DESVIACION_CON_RIESGO`, `CALIFICACION_REGISTRAL` |

## 7. Validacion de rule packs vigentes

El `MatterExecutionProfile` no hardcodea quorum y mayorias ordinarias. Lee del `rulePackPayload`. Por tanto, la validacion legal debe cubrir el dossier y los payloads de los rule packs vigentes.

La revision recomendada no es por materia completa ni por muestreo aleatorio. Debe hacerse por gate x tipo social:

1. Extraer de `rule_pack_versions.payload` los valores vigentes de convocatoria, quorum, mayoria y documentacion.
2. Cruzarlos con la regla LSC base por tipo social y materia reforzada.
3. Clasificar divergencias como:
   - override estatutario legitimo;
   - error del rule pack;
   - error de clasificacion del perfil.
4. Priorizar materias inscribibles o sujetas a calificacion registral.

Materias de prioridad absoluta:

| Materia | Gates criticos | Tipo social | Motivo |
|---|---|---|---|
| `MODIFICACION_ESTATUTOS` | Quorum, mayoria, documentacion | SA y SL | Inscribible; regimen reforzado |
| `AUMENTO_CAPITAL` | Quorum, mayoria, documentacion | SA y SL | Inscribible; regimen reforzado |
| `REDUCCION_CAPITAL` | Quorum, mayoria, documentacion, acreedores | SA y SL | Inscribible; oposicion de acreedores |
| `FUSION_ESCISION` / `FUSION` / `ESCISION` | Quorum, mayoria, documentacion | SA y SL | Inscribible; RDL 5/2023 |
| `NOMBRAMIENTO_CONSEJERO` | Mayoria, documentacion, subtipo | SA y SL | Inscribible; cooptacion solo SA |
| `DELEGACION_FACULTADES` | Mayoria especial, documentacion | SA y SL | Inscribible; art. 249 LSC |
| `NOMBRAMIENTO_AUDITOR` | Duracion 3-9, documentacion | SA y SL | Inscribible; calificacion registral |

Fuentes base que deben contrastarse:

| Bloque | Fuente | Regla base |
|---|---|---|
| Junta SA ordinaria | Art. 193.1 LSC | Primera convocatoria con 25% capital; segunda sin minimo legal |
| Junta SA reforzada | Art. 194.1 LSC | Primera 50%; segunda 25% |
| Junta SL | Arts. 198-200 LSC | Sin quorum legal de constitucion; mayorias sobre participaciones segun materia |
| Mayoria SA ordinaria | Art. 201.1 LSC | Mas votos a favor que en contra del capital presente o representado |
| Mayoria SA reforzada | Art. 201.2 LSC | En segunda convocatoria con quorum 25%-50%, dos tercios del capital presente o representado |
| Consejo | Arts. 245-248 LSC | Constitucion por mayoria de miembros y acuerdos por mayoria absoluta de concurrentes |
| Delegacion permanente | Art. 249.2 LSC | Voto favorable de dos tercios de componentes del Consejo |
| Junta universal | Art. 178 LSC | Dispensa convocatoria, no modifica mayoria sustantiva |

## 8. Recomendacion de integracion tras validacion

No conectar todavia a `TramitadorStepper` como checkpoint operativo. La secuencia recomendada es:

1. Validacion legal de este dossier y de los rule packs que alimentan quorum/mayorias.
2. Parametrizar cambios en `matter-execution-profile.ts` y tests.
3. Conectar en UX solo como panel informativo no disruptivo:
   - mostrar gates y prerequisitos;
   - marcar gaps y override sugerido;
   - no impedir generacion documental.
4. Registrar en `agreement-360` el resultado del perfil y los overrides cuando el secretario avance.
5. Solo despues, evaluar si algun gate debe convertirse en checkpoint reforzado.

## 9. Checklist de aprobacion legal

- [ ] Matriz de convocatoria por tipo social validada.
- [ ] Quorum y mayorias reforzadas por materia revisadas contra rule packs.
- [ ] Prerequisitos `BLOCKING` / `WARNING` confirmados.
- [ ] Criterio `VIA_ALTERNATIVA` vs `DESVIACION_CON_RIESGO` aprobado.
- [ ] Riesgos `IMPUGNABILIDAD`, `CALIFICACION_REGISTRAL`, `NULIDAD`, `TRAZABILIDAD_PARCIAL` validados.
- [ ] Materias con incertidumbre priorizadas.
- [x] Preguntas cerradas P1-P14 respondidas. (2026-05-18, criterio Garrigues-Legal aplicado al contrato en f851f73/03aea48/d932361)
- [ ] Decision sobre mini-dossier `DISOLUCION` / `LIQUIDACION` tomada.
- [ ] Casos legales de prueba entregados en formato determinista.
- [ ] Rule packs prioritarios validados por gate x tipo social.
- [x] Autorizacion para conectar panel informativo en TramitadorStepper.
      (2026-07-18, autorizada por el product owner en la conversacion de
      coherencia de configuracion de Secretaria — solo fase 1 informativa,
      sin gates bloqueantes; implementada en
      src/components/secretaria/MatterExecutionProfilePanel.tsx)
