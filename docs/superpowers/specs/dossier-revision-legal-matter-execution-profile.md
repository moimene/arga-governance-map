# Dossier de revision legal - MatterExecutionProfile

Fecha: 2026-05-17
Commit tecnico revisado: `08eb9b6 feat(secretaria): add matter execution profile`
Modulo: `src/lib/secretaria/matter-execution-profile.ts`
Suite de contrato: `src/lib/secretaria/__tests__/matter-execution-profile.test.ts`
Estado: pendiente de validacion legal Garrigues antes de conectar UX o TramitadorStepper.

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

## 6. Recomendacion de integracion tras validacion

No conectar todavia a `TramitadorStepper` como checkpoint operativo. La secuencia recomendada es:

1. Validacion legal de este dossier y de los rule packs que alimentan quorum/mayorias.
2. Parametrizar cambios en `matter-execution-profile.ts` y tests.
3. Conectar en UX solo como panel informativo no disruptivo:
   - mostrar gates y prerequisitos;
   - marcar gaps y override sugerido;
   - no impedir generacion documental.
4. Registrar en `agreement-360` el resultado del perfil y los overrides cuando el secretario avance.
5. Solo despues, evaluar si algun gate debe convertirse en checkpoint reforzado.

## 7. Checklist de aprobacion legal

- [ ] Matriz de convocatoria por tipo social validada.
- [ ] Quorum y mayorias reforzadas por materia revisadas contra rule packs.
- [ ] Prerequisitos `BLOCKING` / `WARNING` confirmados.
- [ ] Criterio `VIA_ALTERNATIVA` vs `DESVIACION_CON_RIESGO` aprobado.
- [ ] Riesgos `IMPUGNABILIDAD`, `CALIFICACION_REGISTRAL`, `NULIDAD`, `TRAZABILIDAD_PARCIAL` validados.
- [ ] Materias con incertidumbre priorizadas.
- [ ] Preguntas cerradas respondidas.
- [ ] Autorizacion para conectar panel informativo en TramitadorStepper.
