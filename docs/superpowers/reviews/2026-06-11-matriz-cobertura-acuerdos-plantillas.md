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