# 2026-04-27 — Secretaria Template Coverage Matrix

## Proposito

Matriz docs-only para convertir los modelos entregados por el equipo legal en cobertura funcional de plantillas, sin tocar Supabase.

Este documento sirve para validar con Legal y Producto:

- que materias tienen plantilla de convocatoria, acta, certificacion, informe PRE y documento registral/publicacion;
- que variables requiere cada materia;
- que documentos son obligatorios antes de adoptar el acuerdo;
- que post-acciones deben verse en el expediente;
- donde aparece una necesidad de schema que debe detener el desarrollo.

## Acuerdo 360 como elemento canonico

Esta matriz no sustituye al acuerdo ni convierte la materia en el objeto principal del sistema.

El elemento canonico sigue siendo `agreements.id`:

- la materia (`rule_pack`, `canonical_materia`, `catalog_ref`) clasifica el acuerdo;
- la plantilla documenta una fase o efecto del acuerdo;
- la convocatoria prepara su adopcion;
- la reunion, decision unipersonal, co-aprobacion o acuerdo sin sesion lo adopta o lo materializa;
- el acta lo transcribe;
- la certificacion lo acredita para producir efectos;
- el documento registral/publicacion lo proyecta fuera de la sociedad;
- la evidencia conserva su trazabilidad.

Por tanto, toda plantilla de contenido dispositivo debe poder resolverse, cuando exista expediente, contra un `agreement_id` estable. Las plantillas PRE pueden existir antes del acuerdo materializado, pero deben poder terminar enlazadas al acuerdo 360 cuando se cree o se adopte.

Regla de producto:

```text
materia + plantilla + documento != acuerdo canonico
agreement_id = ciclo de vida canonico del acto societario
```

Implicacion para implementacion bajo freeze:

- podemos preparar matrices, fixtures y normalizadores sin schema;
- no debemos crear un catalogo paralelo de "acuerdos" fuera de `agreements`;
- si una pantalla permite generar una decision/documento sin `agreement_id`, debe tratarlo como borrador PRE o propuesta, y enlazarlo al acuerdo 360 en cuanto exista;
- si ese enlace exige nueva tabla/columna, se detiene y se reporta.

Estado de implementacion 2026-04-27:

- `src/lib/secretaria/agreement-document-contract.ts` implementa la clasificacion pura de documentos vinculados o pendientes de `agreement_id`.
- `src/lib/doc-gen/process-documents.ts` usa ese contrato para incluir trazabilidad Agreement 360 en el footer del DOCX.
- `src/lib/secretaria/__tests__/agreement-document-contract.test.ts` cubre documentos PRE, finales, ids canonicos y footer.
- `src/lib/secretaria/legal-template-normalizer.ts` implementa normalizacion pura de placeholders legales, alias de variables y equivalencias `J-01/CA-03` sin tocar schema.
- `src/lib/doc-gen/process-documents.ts` expande alias legales antes de renderizar DOCX, de modo que plantillas legacy `empresa_*` y variables canonicas coexisten sin duplicar contrato.
- `src/lib/secretaria/__tests__/legal-template-normalizer.test.ts` cubre acentos/case/espacios, placeholders manuales, alias, listas dinamicas y equivalencias criticas.
- `src/lib/secretaria/legal-template-fixtures.ts` convierte modelos Word entregados por Legal en fixtures Handlebars locales. Cobertura actual: convocatoria Junta, convocatoria Consejo, acta Junta, acta Consejo, acta de consignacion socio unico, acta de consignacion administrador unico, acta de acuerdo escrito sin sesion, certificacion, informe preceptivo, informe documental PRE, documento registral y subsanacion registral.
- `src/components/secretaria/ProcessDocxButton.tsx` incorpora captura guiada de Capa 3 en flujos rapidos antes de generar DOCX, usando plantillas Cloud si existen y fixtures locales solo como fallback no persistido.
- `src/lib/secretaria/__tests__/legal-template-fixtures.test.ts` cubre validez Handlebars de fixtures, no duplicacion y render de listas Capa 3.
- `src/lib/secretaria/legal-template-coverage.ts` calcula cobertura documental separando Cloud activa, Cloud pendiente, fixture local y hueco real.
- `src/pages/secretaria/GestorPlantillas.tsx` muestra la cobertura legal con fuente de verdad por familia documental y no confunde fixture local con plantilla Cloud aprobada.
- `src/lib/secretaria/__tests__/legal-template-coverage.test.ts` cubre familias de organo, fixtures temporales, plantillas Cloud pendientes y filtro por jurisdiccion.
- Tanda 2026-04-29: la cobertura separa actas de consignacion por `UNIPERSONAL_SOCIO` y `UNIPERSONAL_ADMIN`, para no mezclar decisiones del socio unico con decisiones del organo de administracion unipersonal.
- Tanda 2026-04-29: `template-routing` dirige actas unipersonales a decisiones unipersonales, acuerdos escritos a acuerdos sin sesion y documentos/subsanaciones registrales al tramitador.
- Tanda 2026-04-29: `DecisionDetalle`, `AcuerdoSinSesionDetalle` y `TramitadorStepper` pasan variables canonicas de Capa 3 a la generacion DOCX sin anadir dependencia de schema.
- Tanda 2026-04-29: `GestorPlantillas` lista fixtures locales navegables con aviso visible "Fixture local no persistido"; la cobertura Cloud se sigue calculando contra plantillas reales para no falsear paridad.
- No se ha creado schema, no se han cargado plantillas y no se ha tocado Supabase.

## Guardrail operativo

Hasta nuevo aviso:

- No aplicar migraciones.
- No crear columnas/tablas.
- No regenerar tipos Supabase.
- No tocar policies/RLS/RPC/storage.
- No insertar ni actualizar plantillas en `plantillas_protegidas`.
- Si una fila exige schema nuevo, queda marcada como bloqueo y no se implementa.

## Fuentes

- `docs/legal-team/specs acuerdos/Plantillas y lógica ✅.md`
- `docs/legal-team/specs acuerdos/CUADRO DE PLANTILLAS EDITABLES EN WORD.md`
- `docs/legal-team/specs acuerdos/LSC_Rule_Engine_Expansion_Master_Reference (1).xlsx`
- `docs/legal-team/specs acuerdos/Especificacion_Tecnica_Motor_Reglas_LSC_v2_1.docx`
- `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md`
- `docs/contratos/variables-plantillas-v1.1.yaml`

## Tipos documentales normalizados

| Familia | Tipo UI/documental actual | Uso |
|---|---|---|
| Convocatoria JGA/Consejo | `CONVOCATORIA`, `CONVOCATORIA_SL_NOTIFICACION` | Preparar convocatoria, orden del dia, canal, plazo y recordatorios. |
| Acta de sesion | `ACTA_SESION` | Junta, Consejo y organos colegiados en `MEETING` o `UNIVERSAL`. |
| Acta sin sesion | `ACTA_ACUERDO_ESCRITO` | `NO_SESSION`, acuerdos escritos, consentimientos. |
| Acta consignacion | `ACTA_CONSIGNACION` | Socio unico o administrador unico. |
| Certificacion | `CERTIFICACION` | Transcripcion literal de acuerdos 360 desde acta/resolucion. |
| Modelo de acuerdo | `MODELO_ACUERDO` | Parte dispositiva por materia, reutilizable en acta/certificacion. |
| Informe preceptivo | `INFORME_PRECEPTIVO` | Informe legal/material exigido por la materia. |
| Informe documental PRE | `INFORME_DOCUMENTAL_PRE` | Checklist o informe de documentacion previa exigida. |
| Registral/publicacion | `DOCUMENTO_REGISTRAL`, `SUBSANACION_REGISTRAL` | Preparacion registral/publicacion/subsanacion, sin schema nuevo. |

## Contrato canonico de variables

Decision docs-only recomendada para el hito humano:

- Canonico operativo: variables estilo Excel/DOCX y resolver actual: `{{denominacion_social}}`, `{{cif}}`, `{{domicilio_social}}`, `{{registro_mercantil}}`, `{{forma_social}}`, `{{fecha}}`, `{{presidente}}`, `{{secretario}}`.
- Compatibilidad: mantener aliases `empresa_*` solo para plantillas legacy si ya existen.
- No versionar ni persistir alias en BD durante el freeze.

### Alias de normalizacion

| Placeholder legal | Variable canonica | Alias legacy local |
|---|---|---|
| `[NOMBRE DE LA SOCIEDAD]` | `{{denominacion_social}}` | `{{empresa_nombre}}` |
| `[CIF]` | `{{cif}}` | `{{empresa_cif}}` |
| `[Domicilio social]` | `{{domicilio_social}}` | `{{empresa_domicilio}}` |
| `[Datos registrales]` | `{{registro_mercantil}}` | `{{empresa_registro_mercantil}}` |
| `[Tipo social]` | `{{forma_social}}` | `{{empresa_tipo_social}}` |
| `[Fecha de reunion]` | `{{fecha}}` | `{{fecha_reunion}}` |
| `[Fecha de emisión]` | `{{fecha_emision}}` | `{{fecha_generacion}}` |
| `[Lugar de celebración]` | `{{lugar}}` | `{{lugar_reunion}}`, `{{lugar_junta}}` |
| `[Presidente]` | `{{presidente}}` | `{{presidente_nombre}}` |
| `[Secretario]` | `{{secretario}}` | `{{secretario_nombre}}` |
| `[Porcentaje de capital presente o representado]` | `{{porcentaje_capital_presente}}` | `{{quorum_observado}}` |
| `[Relación de asistentes]` | `{{miembros_presentes}}` | `{{asistentes_lista}}`, `{{lista_socios}}` |
| `[Punto X del orden del día]` | `{{orden_dia}}` | `{{puntos_orden_dia}}` |
| `[Redaccion del acuerdo X]` | lista `{{acuerdos}}` | `{{texto_decision}}` |
| `[Transcripcion literal de los acuerdos]` | `{{transcripcion_acuerdos}}` | n/a |
| `contenido_acuerdo` / `propuesta_acuerdo` | `{{texto_decision}}` | `{{propuesta_texto}}` |
| `decisor` | `{{identidad_decisor}}` | `{{nombre_decisor}}` |
| `fecha_decision` | `{{fecha}}` | `{{fecha_cierre_expediente}}` |
| `organo_convocante` | `{{organo_nombre}}` | `{{body_name}}` |

## Reglas de cobertura por familia

| Regla | Aplicacion |
|---|---|
| Toda materia colegiada | Debe poder generar convocatoria, acta y certificacion. |
| Toda materia con documentos previos | Debe tener `INFORME_DOCUMENTAL_PRE` o checklist PRE. |
| Toda materia con informe legal/material | Debe tener `INFORME_PRECEPTIVO`. |
| Todo acuerdo inscribible | Debe mostrar post-accion registral y certificacion. |
| Todo acuerdo con escritura/instancia | Debe poder generar documento registral o al menos tarea POST explicable. |
| Todo acuerdo sin sesion/unipersonal/co-aprobacion/solidario | Debe resolver acta especifica por `AdoptionMode`, no acta de sesion generica. |
| Todo documento dispositivo | Debe referenciar o poder terminar referenciando `agreement_id`; si aun no existe, su estado es PRE/propuesta. |

## Matriz de cobertura por materia

Leyenda:

- `Base`: variables comunes `denominacion_social`, `cif`, `domicilio_social`, `registro_mercantil`, `forma_social`, `fecha`, `presidente`, `secretario`.
- `Motor`: variables de quorum/voto/snapshot: `quorum_observado`, `votos_favor`, `votos_contra`, `abstenciones`, `tipo_mayoria`, `porcentaje_favor`, `resultado_gate`, `snapshot_hash`.
- `Manual`: variables que debe capturar Capa 3 o el stepper.
- `Schema`: `none` significa que se puede preparar UI/docs/tests sin nueva dependencia de schema.

| Ref | Materia | Organo | Rule pack | Familias documentales | Variables materia | Documentos requeridos | POST | Schema |
|---|---|---|---|---|---|---|---|---|
| CA-01 | Formulacion cuentas anuales | Consejo | `FORMULACION_CUENTAS` | Convocatoria Consejo, Acta, Certificacion, Informe PRE | Base + Motor + `fecha_cierre`, `informe_auditoria`, `titular_real` | Cuentas anuales, Balance, PyG, Memoria | Firma todos los admins | none |
| CA-02 | Formulacion cuentas consolidadas | Consejo | `CUENTAS_CONSOLIDADAS` | Convocatoria Consejo, Acta, Certificacion, Informe PRE | Base + Motor + `obligacion_consolidar`, `perimetro_grupo` | Cuentas consolidadas, perimetro grupo, informe auditor grupo | Firma todos los admins + deposito RM | none |
| CA-03 | Informe gestion e EINF | Consejo | `INFORME_GESTION` | Convocatoria Consejo, Acta, Informe PRE | Base + Motor + `obligado_einf`, `sujecion_obligatoria` | Informe gestion, EINF si obligado | Deposito RM | none |
| CA-04 | Convocatoria JGA | Consejo | `MOTOR_CONVOCATORIA` | Convocatoria JGA, Informe documental PRE | Base + `tipo_junta`, `orden_dia`, `canal_notificacion`, `fecha_primera_convocatoria` | Texto convocatoria, OdD | Publicacion/envio | none |
| CA-05 | Convocatoria solicitud minoria | Consejo | `CONVOCATORIA_MINORIA` | Convocatoria JGA, Informe documental PRE | Base + `solicitante_minoria`, `umbral_minoria`, `fecha_solicitud` | Solicitud escrita minoria | Emision convocatoria <=2m | none |
| CA-06 | Fijacion texto convocatoria | Consejo | `MOTOR_CONVOCATORIA` | Convocatoria JGA, Informe documental PRE | Base + `orden_dia`, `derecho_informacion`, `documentos_disponibles` | Borrador convocatoria | Publicacion | none |
| CA-07 | Cooptacion consejeros SA | Consejo | `COOPTACION` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `vacantes_sobrevenidas`, `candidato_nombre` | CV candidato, declaracion idoneidad, vacante | Inscripcion RM hasta proxima JGA | none |
| CA-08 | Delegacion facultades | Consejo | `DELEGACION_FACULTADES` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `catalogo_indelegables`, `facultades_delegadas`, `tipo_delegacion`, `contrato_cd_aprobado` | Lista facultades, catalogo indelegables, contrato CD si aplica | Escritura + Inscripcion RM | none |
| CA-09 | Nombramiento CD y contrato | Consejo | `DELEGACION_FACULTADES` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `contrato_cd_aprobado`, `facultades_delegadas`, `tipo_delegacion` | Contrato CD, politica retributiva | Escritura + Inscripcion RM | none |
| CA-10 | Nombramiento secretario no consejero | Consejo | `GENERAL` | Convocatoria Consejo, Acta, Certificacion | Base + Motor + `secretario_designado`, `cargo_designado` | Propuesta nombramiento | Comunicacion interna | none |
| CA-11 | Otorgamiento de poderes | Consejo | `PODERES_APODERADOS` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `apoderado_nombre`, `facultades_texto` | Texto poderes, limites, alcance | Escritura notarial | none |
| CA-12 | Traslado domicilio Espana | Consejo | `TRASLADO_DOMICILIO` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `domicilio_nuevo`, `estatutos_autorizan_traslado` | Certificacion autorizacion estatutaria, nuevo domicilio | Escritura + Inscripcion RM | none |
| CA-13 | Apertura/cierre sucursales | Consejo | `GENERAL` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `accion_sucursal`, `domicilio_sucursal` | Datos sucursal | Inscripcion RM segun caso | none |
| CA-14 | Dividendo a cuenta | Consejo | `DIVIDENDO_A_CUENTA` | Convocatoria Consejo, Acta, Certificacion, Informe PRE | Base + Motor + `base_disponible_dividendo`, `estado_contable_fecha`, `importe_propuesto`, `liquidez_suficiente` | Estado contable, informe liquidez, calculo base disponible | Pago + comunicacion socios | none |
| CA-15 | Ejecucion aumento delegado | Consejo | `EJECUCION_AUMENTO_DELEGADO` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `autorizacion_vigente`, `plazo_vigencia`, `pct_consumido`, `pct_propuesto` | Acuerdo JGA delegacion, estado consumo limite | Escritura + Inscripcion RM | none |
| CA-16 | Informe justificativo | Consejo | `GENERAL` | Convocatoria Consejo, Acta, Informe PRE | Base + Motor + `texto_informe`, `materia_informe` | Informe administradores | Puesta a disposicion socios | none |
| CA-17 | Proyecto fusion/escision | Consejo | `FUSION / ESCISION` | Convocatoria Consejo, Acta, Certificacion, Informe PRE, Registral | Base + Motor + `tipo_operacion`, `proyecto_fecha`, `balance_fecha` | Proyecto comun, balances, informes | Deposito RM + web | none |
| CA-18 | Web corporativa inscrita | Consejo | `WEB_CORPORATIVA` | Convocatoria Consejo, Acta, Certificacion, Registral | Base + Motor + `url_web` | Resolucion consejo, URL, evidencia publicacion | Inscripcion RM | none |
| CA-19 | Reglamento consejo/politicas | Consejo | `GENERAL` | Convocatoria Consejo, Acta, Certificacion, Registral si aplica | Base + Motor + `politicas_listado`, `texto_reglamento` | Texto reglamento/politica | Inscripcion reglamento RM si aplica | none |
| CA-20 | Dispensa competencia art. 230 | Consejo | `OPERACION_VINCULADA` | Convocatoria Consejo, Acta, Certificacion, Informe PRE | Base + Motor + `admin_vinculado_id`, `descripcion_operacion`, `justificacion_mercado` | Solicitud dispensa, justificacion interes social | Registro interno | none |
| CA-21 | Nombramiento/cese directivos | Consejo | `GENERAL` | Convocatoria Consejo, Acta, Certificacion | Base + Motor + `directivo_nombre`, `cargo_directivo`, `condiciones` | Propuesta, contrato directivo | Comunicacion interna | none |
| CA-22 | Dimisiones, cobertura interina | Consejo | `GENERAL` | Convocatoria Consejo, Acta, Certificacion, Registral si aplica | Base + Motor + `dimitido_nombre`, `fecha_efecto`, `sustituto_interino` | Carta dimision | Acta + posible cooptacion | none |
| J1 | Aprobacion cuentas + gestion | Junta General | `APROBACION_CUENTAS` | Convocatoria JGA, Acta Junta, Certificacion, Informe documental PRE | Base + Motor + `fecha_cierre`, `informe_auditoria`, `aplicacion_resultado` | Cuentas formuladas, informe auditoria | Deposito RM <=1 mes | none |
| J2 | Aplicacion resultado | Junta General | `APLICACION_RESULTADO` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE | Base + Motor + `importe_propuesto`, `destino_resultado`, `reservas` | Propuesta aplicacion, informe | Ejecucion pago/dotacion | none |
| J3 | Nombramiento/reeleccion admins | Junta General | `NOMBRAMIENTO_CESE` | Convocatoria JGA, Acta Junta, Certificacion, Registral | Base + Motor + `candidato_nombre`, `fecha_efecto`, `declaracion_idoneidad` | CV, declaracion idoneidad | Inscripcion RM | none |
| J4 | Nombramiento auditor | Junta General | `NOMBRAMIENTO_AUDITOR` | Convocatoria JGA, Acta Junta, Certificacion, Registral | Base + Motor + `auditor_nombre`, `auditor_roac`, `auditor_nif`, `plazo_nombramiento_años` | Oferta auditor, declaracion independencia | Inscripcion RM | none |
| J5 | Modificacion estatutos | Junta General | `MOD_ESTATUTOS` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `texto_estatutos`, `articulo_modificado`, `nueva_redaccion` | Texto modificacion, estatutos refundidos | Escritura + Inscripcion RM | none |
| J6 | Aumento capital dinerario | Junta General | `AUMENTO_CAPITAL` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `importe_aumento`, `numero_participaciones`, `valor_nominal`, `prima_asuncion` | Informe admins, balance, certificacion bancaria | Escritura + Inscripcion RM | none |
| J7 | Aumento capital no dinerario | Junta General | `AUMENTO_CAPITAL_NO_DINERARIO` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `aportacion_descripcion`, `valoracion_aportacion`, `informe_experto` | Informe experto, valoracion, informe admins | Escritura + Inscripcion RM | none |
| J8 | Reduccion capital | Junta General | `REDUCCION_CAPITAL` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `modalidad_reduccion`, `plazo_oposicion_acreedores` | Informe admins, balance | Oposicion 3m + Escritura + Inscripcion | none |
| J9 | Supresion preferente | Junta General | `SUPRESION_PREFERENTE` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `justificacion_supresion`, `informe_auditor` | Informe admins + auditor | Escritura + Inscripcion RM | none |
| J10 | Emision obligaciones SA | Junta General | `EMISION_OBLIGACIONES` | Convocatoria JGA, Acta Junta, Certificacion, Registral | Base + Motor + `condiciones_emision`, `importe_emision` | Condiciones emision | Escritura + Inscripcion RM | none |
| J11 | Transformacion | Junta General | `TRANSFORMACION` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `tipo_transformacion`, `proyecto_transformacion` | Proyecto, balance, informe experto | Escritura + Inscripcion RM | none |
| J12 | Fusion | Junta General | `FUSION` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral/Publicacion | Base + Motor + `proyecto_fecha`, `sociedades_intervinientes`, `balance_fecha` | Proyecto fusion, balances, informes | Escritura + Inscripcion RM | none |
| J13 | Escision | Junta General | `ESCISION` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral/Publicacion | Base + Motor + `proyecto_fecha`, `sociedades_beneficiarias`, `balance_fecha` | Proyecto escision, balances, informes | Escritura + Inscripcion RM | none |
| J14 | Cesion global activo | Junta General | `CESION_GLOBAL_ACTIVO` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral/Publicacion | Base + Motor + `cesionario`, `proyecto_cesion`, `balance_fecha` | Proyecto cesion, balance | Escritura + Inscripcion RM | none |
| J15 | Politica retribucion | Junta General | `RETRIBUCION_ADMIN` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE | Base + Motor + `politica_retributiva`, `periodo_vigencia` | Propuesta politica retributiva | Publicacion web si cotizada | none |
| J16 | Autocartera | Junta General | `AUTOCARTERA` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE | Base + Motor + `tope_autocartera_pct`, `situacion_autocartera` | Informe admins, situacion autocartera | Seguimiento tope 10% | none |
| J17 | Reglamento junta SA | Junta General | `GENERAL` | Convocatoria JGA, Acta Junta, Certificacion, Registral | Base + Motor + `texto_reglamento` | Texto reglamento | Inscripcion RM | none |
| J18 | Disolucion + liquidadores | Junta General | `DISOLUCION_LIQUIDADORES` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral/Publicacion | Base + Motor + `causa_disolucion`, `liquidador_nombre` | Causa legal, propuesta liquidadores | Escritura + Inscripcion RM | none |
| J19 | Reactivacion | Junta General | `GENERAL` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral | Base + Motor + `causa_cesada`, `informe_reactivacion` | Informe causa cesada | Escritura + Inscripcion RM | none |
| J20 | Balance final liquidacion | Junta General | `GENERAL` | Convocatoria JGA, Acta Junta, Certificacion, Registral | Base + Motor + `balance_final`, `informe_liquidadores` | Balance final, informe liquidadores | Escritura + Inscripcion RM | none |
| J21 | Operaciones activos esenciales | Junta General | `GARANTIA_PRESTAMO` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE, Registral si aplica | Base + Motor + `umbral_materialidad_pct`, `activo_total_ultimo_balance`, `contraparte`, `descripcion_operacion` | Valoracion activo, informe admins | Escritura si procede | none |
| J22 | Cambio domicilio JGA | Junta General | `MOD_ESTATUTOS` | Convocatoria JGA, Acta Junta, Certificacion, Registral | Base + Motor + `domicilio_nuevo`, `nueva_redaccion` | Texto modificacion estatutaria | Escritura + Inscripcion RM | none |
| J23 | ESOP/incentivos | Junta General | `GENERAL` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE | Base + Motor + `plan_incentivos`, `beneficiarios`, `condiciones` | Plan incentivos, condiciones | Ejecucion plan | none |
| J24 | Dispensas generales | Junta General | `GENERAL` | Convocatoria JGA, Acta Junta, Certificacion, Informe PRE | Base + Motor + `solicitud_dispensa`, `beneficiario_dispensa`, `justificacion` | Solicitud dispensa | Registro interno | none |

## Equivalencia de codigos legales y catalogo tecnico

| Documento legal | Catalogo tecnico | Materia canonica |
|---|---|---|
| `J-01` | `J1` + `J2` | `APROBACION_CUENTAS` + `APLICACION_RESULTADO` |
| `J-02` | `J3` | `NOMBRAMIENTO_CESE` |
| `J-03` | `J4` | `NOMBRAMIENTO_AUDITOR` |
| `J-04` | `J5` + `J6` + `J7` + `J9` si hay preferencia | `MOD_ESTATUTOS` + `AUMENTO_CAPITAL` + `SUPRESION_PREFERENTE` |
| `J-05` | `J2` | `APLICACION_RESULTADO` / dividendos |
| `J-06` | Punto transversal | Delegacion de facultades de ejecucion |
| `J-07` | `J11` + `J12` + `J13` + `J14` + `J18` | Operaciones estructurales/disolucion |
| `J-08` | `J21` solo si supera umbral | Activos esenciales / garantia / prestamo; si no supera umbral, Consejo/GENERAL |
| `J-09` | `J15` | `RETRIBUCION_ADMIN` |
| `J-10` | `CA-20` o `J24` | Operacion vinculada / dispensa |
| `CA-01` legal | `CA-01` | `FORMULACION_CUENTAS` |
| `CA-02` legal | `CA-19` o `GENERAL` | Politicas corporativas |
| `CA-03` legal | `CA-11`, `J21` segun umbral | Financiacion / garantias |
| `CA-04` legal | `CA-11` | `PODERES_APODERADOS` |
| `CA-05` legal | `GENERAL` | Organizacion del consejo; no reducir a secretario salvo unico objeto |
| `CA-06` legal | Punto transversal | Facultades de protocolizacion |
| `CA-07` legal | `CA-16` | Informe administradores |
| `CA-08` legal | `GENERAL` | Operaciones relevantes no esenciales; no mapear automaticamente a directivos |
| `CA-09` legal | `GENERAL`; `CA-19` solo si aprueba politica/reglamento | Comites internos/politicas |
| `CA-10` legal | `GENERAL` | D&O |

## Gaps funcionales detectados

| Gap | Impacto | Accion permitida ahora | Bloqueo schema |
|---|---|---|---|
| Variables canonicas vs `empresa_*` | Preflight puede marcar faltantes falsos. | Implementado helper puro de alias y test. | No |
| Placeholder `[Campo]` vs `{{campo}}` | Los modelos Word legales no entran tal cual al renderer. | Implementado normalizador puro; carga real de plantillas sigue bloqueada por freeze. | No |
| Catalogo `J-01` vs `J1` | Riesgo de duplicar materias o plantillas. | Implementada tabla de equivalencia en helper puro. | No |
| Plantillas PRE por materia | Falta matriz exacta de informe preceptivo/documental. | Usar esta matriz como input de UI/checklist. | No |
| Carga de plantillas aprobadas | Producto necesita plantillas activas. | Preparar contenido y QA fuera de BD. | Si se inserta en `plantillas_protegidas`, parar. |
| AdoptionMode `CO_APROBACION/SOLIDARIO` | Plantillas deben resolver acta especifica. | UI/docs/tests sobre contratos existentes. | Si requiere constraint nuevo, parar. |
| Evidence final | Documento generado no equivale a evidencia final. | Mostrar nivel real y no declarar final. | Si requiere storage/RPC/RLS, parar. |

## Orden de ejecucion recomendado sin Supabase

1. Preparar paquete para Legal: matrix + variables + texto base + gaps por materia.
2. Cuando se levante freeze, planificar carga no destructiva en `plantillas_protegidas` con migracion/seed revisado.
3. Sustituir fixtures locales por plantillas aprobadas Cloud una vez validado el seed/migracion.
4. Sustituir los fixtures ampliados de modelos unipersonales, sin sesion, informes PRE y documentos registrales por plantillas Cloud aprobadas cuando Legal valide el contenido y se levante el freeze.

## Data contract de esta matriz

- Flow: Secretaria / gestor documental / cobertura plantillas.
- Tables used: none nuevas en esta tanda. Runtime documental existente puede leer `plantillas_protegidas` y, al generar/archivar, usar tablas ya documentadas: `agreements`, `convocatorias`, `meetings`, `meeting_resolutions`, `minutes`, `certifications`, `attachments`, `evidence_bundles`, `audit_log`, `rule_packs`, `rule_pack_versions`.
- Source of truth: documentos legales revisados, fixtures locales y helper puro versionado; Cloud no consultado.
- Owner records: none modified.
- Shared records: none modified.
- Migration required: no.
- Types affected: TypeScript local (`legal-template-normalizer`, `legal-template-fixtures`, `legal-template-coverage`, `ProcessDocxButton`, `GestorPlantillas`); no tipos Supabase.
- RLS/RPC/storage affected: no.
- Evidence level: none, documento de cobertura.
- Cross-module contracts: none modified.
- Parity risk: medio; no hay schema nuevo, pero la pantalla distingue cobertura local temporal y cobertura Cloud real hasta que se carguen plantillas aprobadas.

## Verification

- db:check-target: no ejecutado; no se ha tocado Supabase.
- Typecheck: `bunx tsc --noEmit --pretty false` OK.
- Lint: no ejecutado; cambio UI/documental focalizado.
- Tests: `bun test src/lib/secretaria/__tests__/legal-template-coverage.test.ts src/lib/secretaria/__tests__/legal-template-fixtures.test.ts src/lib/secretaria/__tests__/legal-template-normalizer.test.ts src/lib/doc-gen/__tests__/process-documents.test.ts` OK, 29/29.
- Build: `bun run build` OK.
- e2e: no ejecutado; cambio docs-only.
