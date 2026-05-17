# Rule packs prioritarios - Extraccion para revision legal

Fecha de extraccion: 2026-05-17
Target verificado: `governance_OS` (`hzqwefkwsxopwrmtksbg`) mediante `bun run db:check-target`.
Consulta ejecutada: `docs/superpowers/specs/2026-05-17-rule-packs-review-extraction.sql`, solo lectura.

## 1. Resumen

- Versiones activas totales en Cloud: `43`.
- Materias distintas con rule pack activo: `35`.
- Organos distintos: `3`.
- Versiones activas extraidas para materias prioritarias/ampliadas: `29`.
- Contextos materia + organo con mas de una version activa: `8`.

Nota tecnica: la existencia de mas de una version activa para la misma materia y organo no modifica datos, pero requiere decision antes de considerar determinista cualquier selector que use `.limit(1)` o equivalente.

## 2. Contextos con multiples versiones activas

| Materia | Organo | Versiones activas | Rule pack version ids | Decision requerida |
|---|---|---|---|---|
| `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `v1.0.0, 1.0.0` | `b7852567-e781-41ad-aea1-48c750882853, 937f4156-d67b-4855-b2aa-5fbe71a93864` | Determinar version canonica o archivar la no vigente |
| `AUMENTO_CAPITAL` | `JUNTA_GENERAL` | `v1.0.0, 1.0.0` | `38eae4fc-586d-4747-a3a1-e5b6eb0217ee, 8e07a7fa-4fc1-4494-91ba-24e3a59ab434` | Determinar version canonica o archivar la no vigente |
| `AUTORIZACION_GARANTIA` | `JUNTA_GENERAL` | `1.1.0, 1.0.0` | `32d9f964-d6eb-42c0-935a-2bfaece1aec1, ad81c829-0b8f-4992-b43b-64caf222083e` | Determinar version canonica o archivar la no vigente |
| `DELEGACION_FACULTADES` | `CONSEJO` | `1.1.0, 1.0.0` | `36a3b08c-c05e-4f4b-846a-2985656d8c43, 77260d09-ae92-491a-a31d-f240a7179be0` | Determinar version canonica o archivar la no vigente |
| `NOMBRAMIENTO_AUDITOR` | `JUNTA_GENERAL` | `1.1.0, 1.0.0` | `cc38f0b4-4e60-44ee-a1fa-ccd739d43a15, 1d65d252-944f-4b7d-8056-e3a6b1e5e278` | Determinar version canonica o archivar la no vigente |
| `OPERACION_VINCULADA` | `CONSEJO` | `1.1.0, 1.0.0` | `c7000f00-7eec-4d57-bc05-3b9dae610ec5, 05fd0c53-ec36-4e3b-8c4d-f55da7498ce5` | Determinar version canonica o archivar la no vigente |
| `RATIFICACION_ACTOS` | `CONSEJO` | `1.1.0, 1.0.0` | `8476e78f-ac8b-437f-81a6-d9bb46793ea4, adab8a7f-9557-468a-a100-664188930ab7` | Determinar version canonica o archivar la no vigente |
| `REDUCCION_CAPITAL` | `JUNTA_GENERAL` | `v1.0.0, 1.0.0` | `15d35f5d-0986-47c5-88b0-6e5ce773c09c, 4f4df151-de14-4c34-a63c-35afcaceee57` | Determinar version canonica o archivar la no vigente |

## 3. Inventario extraido

| Prioridad | Materia | Organo | Versiones activas extraidas | Rule pack ids | Revision legal |
|---|---|---|---|---|---|
| Absoluta - MULTIPLE ACTIVA | `AUMENTO_CAPITAL` | `JUNTA_GENERAL` | `v1.0.0, 1.0.0` | `38eae4fc-586d-4747-a3a1-e5b6eb0217ee, 8e07a7fa-4fc1-4494-91ba-24e3a59ab434` | Pendiente Legal |
| Absoluta | `COOPTACION` | `CONSEJO` | `1.0.0` | `779e9d4c-ddd1-401a-a614-6cbc35eff301` | Pendiente Legal |
| Absoluta - MULTIPLE ACTIVA | `DELEGACION_FACULTADES` | `CONSEJO` | `1.1.0, 1.0.0` | `36a3b08c-c05e-4f4b-846a-2985656d8c43, 77260d09-ae92-491a-a31d-f240a7179be0` | Pendiente Legal |
| Absoluta | `ESCISION` | `JUNTA_GENERAL` | `v1.0.0` | `77177821-9ed8-49bf-b7a1-087939530639` | Pendiente Legal |
| Absoluta | `FUSION` | `JUNTA_GENERAL` | `v1.0.0` | `f274e1db-3a26-485b-b3a7-20fd0a2a0fb7` | Pendiente Legal |
| Absoluta | `MODIFICACION_ESTATUTOS` | `JUNTA_GENERAL` | `1.0.0` | `01c71d6e-d840-4e83-9820-c6c00636c162` | Pendiente Legal |
| Absoluta | `MOD_ESTATUTOS` | `JUNTA_GENERAL` | `v1.0.0` | `d8ac0b64-d438-48d2-b688-13b601902f5b` | Pendiente Legal |
| Absoluta | `NOMBRAMIENTO` | `JUNTA_GENERAL` | `1.0.0` | `76455445-15c7-41d6-9748-2a8a2c09b572` | Pendiente Legal |
| Absoluta - MULTIPLE ACTIVA | `NOMBRAMIENTO_AUDITOR` | `JUNTA_GENERAL` | `1.1.0, 1.0.0` | `cc38f0b4-4e60-44ee-a1fa-ccd739d43a15, 1d65d252-944f-4b7d-8056-e3a6b1e5e278` | Pendiente Legal |
| Absoluta | `NOMBRAMIENTO_CONSEJERO` | `CONSEJO` | `1.0.0` | `3a8028f9-2b9c-414b-8e16-a6b50b3177b2` | Pendiente Legal |
| Absoluta - MULTIPLE ACTIVA | `REDUCCION_CAPITAL` | `JUNTA_GENERAL` | `v1.0.0, 1.0.0` | `15d35f5d-0986-47c5-88b0-6e5ce773c09c, 4f4df151-de14-4c34-a63c-35afcaceee57` | Pendiente Legal |
| Ampliada | `APLICACION_RESULTADO` | `JUNTA_GENERAL` | `v1.0.0` | `879a5646-74bf-4d25-a4df-5353d7e259df` | Pendiente Legal |
| Ampliada - MULTIPLE ACTIVA | `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `v1.0.0, 1.0.0` | `b7852567-e781-41ad-aea1-48c750882853, 937f4156-d67b-4855-b2aa-5fbe71a93864` | Pendiente Legal |
| Ampliada - MULTIPLE ACTIVA | `AUTORIZACION_GARANTIA` | `JUNTA_GENERAL` | `1.1.0, 1.0.0` | `32d9f964-d6eb-42c0-935a-2bfaece1aec1, ad81c829-0b8f-4992-b43b-64caf222083e` | Pendiente Legal |
| Ampliada | `CESE_CONSEJERO` | `JUNTA_GENERAL` | `1.0.0` | `d73aaa52-cd89-4cfc-be79-d573db8c8527` | Pendiente Legal |
| Ampliada | `CESION_GLOBAL_ACTIVO` | `JUNTA_GENERAL` | `v1.0.0` | `ce5d8a12-9655-4b96-88e8-35dccde6dc29` | Pendiente Legal |
| Ampliada | `DISOLUCION` | `JUNTA_GENERAL` | `v1.0.0` | `cf2f5a40-e47c-48e8-9a0f-1bddfb65da7e` | Pendiente Legal |
| Ampliada | `DISTRIBUCION_DIVIDENDOS` | `JUNTA_GENERAL` | `1.0.0` | `678c073b-d18e-407a-9f04-daa47b9bbcc3` | Pendiente Legal |
| Ampliada | `EMISION_OBLIGACIONES` | `JUNTA_GENERAL` | `v1.0.0` | `5951215d-cbe1-46c8-b553-26e511f0d3ac` | Pendiente Legal |
| Ampliada | `FORMULACION_CUENTAS` | `CONSEJO` | `v1.0.0` | `5a43f95d-0589-4888-afdf-147405e0b44e` | Pendiente Legal |
| Ampliada - MULTIPLE ACTIVA | `OPERACION_VINCULADA` | `CONSEJO` | `1.1.0, 1.0.0` | `c7000f00-7eec-4d57-bc05-3b9dae610ec5, 05fd0c53-ec36-4e3b-8c4d-f55da7498ce5` | Pendiente Legal |
| Ampliada | `TRANSFORMACION` | `JUNTA_GENERAL` | `v1.0.0` | `2794af7f-acec-43f7-a086-bea253513367` | Pendiente Legal |

## 4. Detalle por materia y version

### AUMENTO_CAPITAL - JUNTA_GENERAL

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `v1.0.0`

- `rule_pack_id`: `AUMENTO_CAPITAL`
- `rule_pack_version_id`: `38eae4fc-586d-4747-a3a1-e5b6eb0217ee`
- `status`: `ACTIVE`
- `payload_hash`: `5aa7026c2721c0e1f898a2ad2ea5d918ff751904dc9362d5d1f8a462dc965bf4`
- `payload_chars`: `996`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"dobleCondicional":{"mayoriaAlternativa":"2/3 emitidos","umbral":50},"formula":"> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a","fuente":"art. 201.2 LSC"},"SL":{"formula":"> 1/2 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"texto_propuesta","nombre":"Propuesta de Aumento de Capital"},{"id":"informe_admin","nombre":"Informe del Administrador"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `AUMENTO_CAPITAL`
- `rule_pack_version_id`: `8e07a7fa-4fc1-4494-91ba-24e3a59ab434`
- `status`: `ACTIVE`
- `payload_hash`: `d8d774c727e4667ca35c1c53a982c41d1f39273881dcebd6a994efac3a2435d6`
- `payload_chars`: `2197`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Importe del aumento y forma de realizaci\u00f3n","Informaci\u00f3n sobre derecho de suscripci\u00f3n preferente"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"propuesta_aumento","nombre":"Propuesta de acuerdo de aumento de capital"},{"condicion":"SIEMPRE","id":"informe_admin","nombre":"Informe del \u00f3rgano de administraci\u00f3n (art. 296 LSC)"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 194.1 LSC","valor":0.5},"SA_2a":{"fuente":"LEY","valor":0.25},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY"},"SA":{"formula":"favor >= 2/3_emitidos","fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"formula":"favor >= 2/3_capital_con_voto","fuente":"LEY","referencia":"art. 199 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_aumento","nombre":"Propuesta \u00edntegra de aumento de capital"},{"condicion":"SI_NO_DINERARIO","id":"informe_auditoria_aportaciones","nombre":"Informe auditor si aportaci\u00f3n no dineraria"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":60,"fuente":"LEY","referencia":"art. 19 RRM"},"publicacionRequerida":true}` | Pendiente |

### COOPTACION - CONSEJO

#### Version `1.0.0`

- `rule_pack_id`: `COOPTACION`
- `rule_pack_version_id`: `779e9d4c-ddd1-401a-a614-6cbc35eff301`
- `status`: `ACTIVE`
- `payload_hash`: `bf9a5c2ea9b5e9fb26960292224aff423694b02992b65fb83cd818c7e3d75c1f`
- `payload_chars`: `2388`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"Convocatoria Consejo","valor":0},"SL":{"fuente":"LEY","referencia":"NO APLICA","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":[]},"contenidoMinimo":["Identificaci\u00f3n del candidato","Acreditaci\u00f3n de vacante","Duraci\u00f3n provisional"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"cv_candidato","nombre":"CV y declaraci\u00f3n de idoneidad"},{"condicion":"SIEMPRE","id":"justificacion_vacante","nombre":"Documentaci\u00f3n acreditativa de la vacante"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 247 LSC","valor":0.5},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"},"SA":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"},"SL":{"formula":"NO_APLICA","fuente":"LEY"}},"votoCalidadPermitido":true}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"cv_candidato","nombre":"CV del consejero cooptado"},{"id":"declaracion_idoneidad","nombre":"Declaraci\u00f3n de idoneidad"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","plazoInscripcionDias":0,"publicacionRequerida":false}` | Pendiente |

### DELEGACION_FACULTADES - CONSEJO

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `1.1.0`

- `rule_pack_id`: `DELEGACION_FACULTADES`
- `rule_pack_version_id`: `36a3b08c-c05e-4f4b-846a-2985656d8c43`
- `status`: `ACTIVE`
- `payload_hash`: `bc1c75f543a04da3cc3636d5a6428aec30e981ee52b60ab92a532ec323b6c4b2`
- `payload_chars`: `1910`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 246.1 LSC","valor":0},"SL":{"fuente":"LEY","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"contenidoMinimo":["Fecha hora y lugar","Materias a deliberar","Identificaci\u00f3n del delegado y alcance"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"borrador_delegacion","nombre":"Borrador del acuerdo de delegaci\u00f3n"},{"condicion":"SIEMPRE","id":"verificacion_249bis","nombre":"Verificaci\u00f3n de exclusi\u00f3n de materias indelegables art. 249 bis LSC"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"},"SA":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"},"SL":{"formula":"favor > total_miembros / 2","fuente":"LEY"}},"votoCalidadPermitido":true}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"listado_facultades","nombre":"Listado completo de facultades delegadas"},{"id":"exclusion_249bis","nombre":"Verificaci\u00f3n de exclusi\u00f3n art. 249 bis LSC"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":30,"publicacionRequerida":false}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `DELEGACION_FACULTADES`
- `rule_pack_version_id`: `77260d09-ae92-491a-a31d-f240a7179be0`
- `status`: `ACTIVE`
- `payload_hash`: `6a030c36b3f653143669e3b782891cd878b76743b12e725b13c09f15b8024eca`
- `payload_chars`: `1752`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 246.1 LSC","valor":0},"SL":{"fuente":"LEY","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"contenidoMinimo":["Fecha hora y lugar","Materias a deliberar"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"borrador_delegacion","nombre":"Borrador del acuerdo de delegaci\u00f3n"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 247.1 LSC"},"SA":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 247.1 LSC"},"SL":{"formula":"favor > presentes_mitad","fuente":"LEY"}},"votoCalidadPermitido":true}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"listado_facultades","nombre":"Listado completo de facultades delegadas"},{"id":"exclusion_249bis","nombre":"Verificaci\u00f3n de exclusi\u00f3n de materias indelegables art. 249 bis LSC"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 249.3 LSC"},"publicacionRequerida":false}` | Pendiente |

### ESCISION - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `ESCISION`
- `rule_pack_version_id`: `77177821-9ed8-49bf-b7a1-087939530639`
- `status`: `ACTIVE`
- `payload_hash`: `4f0d3425ae001db38b919810536174ab1000f61cadcc4a7066127eeb0e847844`
- `payload_chars`: `995`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":">= 2/3 emitidos SIEMPRE","fuente":"art. 201.2 LSC"},"SL":{"formula":">= 2/3 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"proyecto","nombre":"Proyecto de Escisi\u00f3n"},{"id":"informes","nombre":"Informes de Administrador y Experto"},{"id":"cuentas_base","nombre":"Cuentas Anuales Base"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

### FUSION - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `FUSION`
- `rule_pack_version_id`: `f274e1db-3a26-485b-b3a7-20fd0a2a0fb7`
- `status`: `ACTIVE`
- `payload_hash`: `7fe66174fa50728fed64d9ea2deb7ff634a6983a20eb1b3dd7974f37c3729e70`
- `payload_chars`: `1083`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":">= 2/3 emitidos SIEMPRE","fuente":"art. 201.2 LSC"},"SL":{"formula":">= 2/3 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"proyecto_comun","nombre":"Proyecto Com\u00fan de Fusi\u00f3n"},{"id":"informe_admin","nombre":"Informe del Administrador"},{"id":"informe_experto","nombre":"Informe de Experto Independiente"},{"id":"cuentas_base","nombre":"Cuentas Anuales \u00daltimos Ejercicios"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

### MODIFICACION_ESTATUTOS - JUNTA_GENERAL

#### Version `1.0.0`

- `rule_pack_id`: `MODIFICACION_ESTATUTOS`
- `rule_pack_version_id`: `01c71d6e-d840-4e83-9820-c6c00636c162`
- `status`: `ACTIVE`
- `payload_hash`: `dbb562e7773a7deeaf531e5509da137b1fa1f0556084d0093394c181005536e6`
- `payload_chars`: `2264`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Propuesta de texto \u00edntegro de la modificaci\u00f3n","Texto actual y texto propuesto"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"propuesta_modificacion","nombre":"Texto \u00edntegro de la propuesta de modificaci\u00f3n"},{"condicion":"SIEMPRE","id":"informe_admin","nombre":"Informe del \u00f3rgano de administraci\u00f3n sobre la modificaci\u00f3n"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 194.1 LSC","valor":0.5},"SA_2a":{"fuente":"LEY","referencia":"art. 194.1 LSC","valor":0.25},"SL":{"fuente":"LEY","referencia":"art. 198 LSC","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 247.1 LSC"},"SA":{"formula":"favor >= 2/3_emitidos","fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"formula":"favor >= 2/3_capital_con_voto","fuente":"LEY","referencia":"art. 199 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_modificacion","nombre":"Propuesta \u00edntegra de modificaci\u00f3n"},{"id":"informe_admin_justificacion","nombre":"Informe justificativo de la modificaci\u00f3n"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":60,"fuente":"LEY","referencia":"art. 19 RRM"},"publicacionRequerida":true}` | Pendiente |

### MOD_ESTATUTOS - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `MOD_ESTATUTOS`
- `rule_pack_version_id`: `d8ac0b64-d438-48d2-b688-13b601902f5b`
- `status`: `ACTIVE`
- `payload_hash`: `4967b437bd9acaf2734fdf0cf71c26a1ba15126e3a9ca508f6c421b820bc33a6`
- `payload_chars`: `937`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"dobleCondicional":{"mayoriaAlternativa":"2/3 emitidos","umbral":50},"formula":"> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a","fuente":"art. 201.2 LSC"},"SL":{"formula":"> 1/2 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"texto_integro","nombre":"Texto \u00cdntegro de Estatutos Propuestos"},{"id":"informe_admin","nombre":"Informe del Administrador"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

### NOMBRAMIENTO - JUNTA_GENERAL

#### Version `1.0.0`

- `rule_pack_id`: `NOMBRAMIENTO_CONSEJERO`
- `rule_pack_version_id`: `76455445-15c7-41d6-9748-2a8a2c09b572`
- `status`: `ACTIVE`
- `payload_hash`: `9ab27c635999204930b7a93cc0296fb1743e3b40d6c9ac2129290556e02b8137`
- `payload_chars`: `2146`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA","PUBLICACION_ESTATUTOS"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Orden del d\u00eda con identificaci\u00f3n del candidato","Categor\u00eda propuesta del consejero"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"cv_candidato","nombre":"Curr\u00edculum vitae del candidato"},{"condicion":"SI_COTIZADA","id":"informe_comision_nombramientos","nombre":"Informe de la Comisi\u00f3n de Nombramientos"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 247.1 LSC"},"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 198 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"cv_candidato","nombre":"CV del candidato"},{"id":"declaracion_idoneidad","nombre":"Declaraci\u00f3n de idoneidad y aceptaci\u00f3n del cargo"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 17 RRM"},"publicacionRequerida":false}` | Pendiente |

### NOMBRAMIENTO_AUDITOR - JUNTA_GENERAL

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `1.1.0`

- `rule_pack_id`: `NOMBRAMIENTO_AUDITOR`
- `rule_pack_version_id`: `cc38f0b4-4e60-44ee-a1fa-ccd739d43a15`
- `status`: `ACTIVE`
- `payload_hash`: `1f37e157192138a10d702eddd3bdc8dd6f4f468124c560990dedb6d9e89c953e`
- `payload_chars`: `2086`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Identificaci\u00f3n del auditor o firma auditora (nombre + ROAC)","Duraci\u00f3n m\u00ednimo 3 a\u00f1os (art. 264.1 LSC)"],"documentosObligatorios":[{"condicion":"SI_COTIZADA","id":"propuesta_comision_auditoria","nombre":"Propuesta motivada Comisi\u00f3n Auditor\u00eda"},{"condicion":"SIEMPRE","id":"declaracion_independencia","nombre":"Declaraci\u00f3n independencia del auditor"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY"},"SA":{"formula":"favor > 0.5 * capital_presente","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 198 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_nombramiento","nombre":"Propuesta de nombramiento con duraci\u00f3n"},{"id":"declaracion_independencia_auditor","nombre":"Declaraci\u00f3n independencia (art. 21 LAC)"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"NINGUNO","plazoInscripcionDias":30,"publicacionRequerida":false}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `NOMBRAMIENTO_AUDITOR`
- `rule_pack_version_id`: `1d65d252-944f-4b7d-8056-e3a6b1e5e278`
- `status`: `ACTIVE`
- `payload_hash`: `2eeefd7dabab9a5018f81e0f378e46b30e4c8ba6f97429c77647e82c09bfa97b`
- `payload_chars`: `1960`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Identificaci\u00f3n del auditor o firma propuesta","Duraci\u00f3n del contrato"],"documentosObligatorios":[{"condicion":"SI_COTIZADA","id":"propuesta_auditoria","nombre":"Propuesta de la Comisi\u00f3n de Auditor\u00eda (cotizadas)"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 247.1 LSC"},"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 198 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_nombramiento","nombre":"Propuesta de nombramiento con duraci\u00f3n y condiciones"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"NINGUNO","plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 17 RRM"},"publicacionRequerida":false}` | Pendiente |

### NOMBRAMIENTO_CONSEJERO - CONSEJO

#### Version `1.0.0`

- `rule_pack_id`: `NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO`
- `rule_pack_version_id`: `3a8028f9-2b9c-414b-8e16-a6b50b3177b2`
- `status`: ``
- `payload_hash`: ``
- `payload_chars`: `3092`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 246.1 LSC; estatutos/reglamento del Consejo","valor":0},"SAU":{"fuente":"LEY","referencia":"art. 246.1 LSC; estatutos/reglamento del Consejo","valor":0},"SL":{"fuente":"LEY","referencia":"No aplica cooptacion en SL","valor":0},"SLU":{"fuente":"LEY","referencia":"No aplica cooptacion en SLU","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SAU":["CONVOCATORIA_CONSEJO"],"SL":[],"SLU":[]},"contenidoMinimo":["Vacante anticipada entre juntas","Identificacion del candidato","Informe o propuesta de idoneidad"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"vacante_anticipada","nombre":"Evidencia de vacante anticipada"},{"condicion":"SIEMPRE","id":"cv_candidato","nombre":"Curriculum vitae del candidato"},{"condicion":"SIEMPRE","id":"declaracion_idoneidad","nombre":"Declaracion de idoneidad y aceptacion"},{"condicion":"SI_COTIZADA","id":"informe_comision_nombramientos","nombre":"Informe de la Comision de Nombramientos"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"No aplica: acuerdo de Consejo","valor":0},"SA_2a":{"fuente":"LEY","referencia":"No aplica: acuerdo de Consejo","valor":0},"SL":{"fuente":"LEY","referencia":"No aplica cooptacion en SL","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"arts. 244 y 248.1 LSC"},"SA":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 248.1 LSC"},"SL":{"formula":"no_aplica","fuente":"LEY","referencia":"art. 244 LSC limita cooptacion a SA"}},"votoCalidadPermitido":true}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"vacante_anticipada","nombre":"Evidencia de vacante anticipada"},{"id":"cv_candidato","nombre":"CV del candidato"},{"id":"declaracion_idoneidad","nombre":"Declaracion de idoneidad y aceptacion"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 17 RRM"},"publicacionRequerida":false}` | Pendiente |

### REDUCCION_CAPITAL - JUNTA_GENERAL

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `v1.0.0`

- `rule_pack_id`: `REDUCCION_CAPITAL`
- `rule_pack_version_id`: `15d35f5d-0986-47c5-88b0-6e5ce773c09c`
- `status`: `ACTIVE`
- `payload_hash`: `3d616f32857a9eeb883b7cfd279dc62c137e5d625bf064f1e62cdf2da68d278e`
- `payload_chars`: `970`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":">= 2/3 emitidos SIEMPRE","fuente":"art. 201.2 LSC"},"SL":{"formula":">= 2/3 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"texto_propuesta","nombre":"Propuesta de Reducci\u00f3n de Capital"},{"id":"informe_admin","nombre":"Informe del Administrador"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `REDUCCION_CAPITAL`
- `rule_pack_version_id`: `4f4df151-de14-4c34-a63c-35afcaceee57`
- `status`: `ACTIVE`
- `payload_hash`: `b0509320aac8973613c6678044a16d90c1c84df5df10d6d252ade5827d47c249`
- `payload_chars`: `2300`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Finalidad de la reducci\u00f3n","Procedimiento y efectos para socios y acreedores"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"propuesta_reduccion","nombre":"Propuesta de acuerdo de reducci\u00f3n de capital"},{"condicion":"SEG\u00daN_CASO","id":"balance_intermediario","nombre":"Balance intermedio si no hay cuentas recientes"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 194.1 LSC","valor":0.5},"SA_2a":{"fuente":"LEY","valor":0.25},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY"},"SA":{"formula":"favor >= 2/3_emitidos","fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"formula":"favor >= 2/3_capital_con_voto","fuente":"LEY","referencia":"art. 199 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_reduccion","nombre":"Propuesta \u00edntegra de reducci\u00f3n"},{"condicion":"SI_DEVOLUCION_APORTACIONES","id":"informe_oposicion_acreedores","nombre":"Publicaci\u00f3n BORME para oposici\u00f3n acreedores (art. 319 LSC)"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":60,"fuente":"LEY","referencia":"art. 19 RRM"},"publicacionRequerida":true}` | Pendiente |

### APLICACION_RESULTADO - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `APLICACION_RESULTADO`
- `rule_pack_version_id`: `879a5646-74bf-4d25-a4df-5353d7e259df`
- `status`: `ACTIVE`
- `payload_hash`: `93ff7bb89a944412bb467e8919a2019f8ba0a50836549d6387da53f5d2f79a63`
- `payload_chars`: `822`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 190 LSC","valor":25},"SA_2a":{"fuente":"art. 190 LSC","valor":0},"SL":{"fuente":"art. 196 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":"Favor > Contra","fuente":"art. 201.1 LSC"},"SL":{"formula":"> 1/2 capital presente","fuente":"art. 198 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_aplicacion","nombre":"Propuesta de Aplicaci\u00f3n de Resultado"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

### APROBACION_CUENTAS - JUNTA_GENERAL

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `v1.0.0`

- `rule_pack_id`: `APROBACION_CUENTAS`
- `rule_pack_version_id`: `b7852567-e781-41ad-aea1-48c750882853`
- `status`: `ACTIVE`
- `payload_hash`: `8d0e341dc7b139872c86416ab75a2ae695f9127ab844e28428379f475bb4b6cb`
- `payload_chars`: `2085`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"art. 176.1 LSC","valor":30},"SL":{"fuente":"art. 176.2 LSC","valor":15}},"canales":{"SA":["BORME","DIARIO","WEB_SOCIEDAD"],"SL":["COMUNICACION_INDIVIDUAL"]},"contenidoMinimo":["denominacion_social","fecha_hora_lugar","orden_dia","derecho_informacion"]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 190 LSC","valor":25},"SA_2a":{"fuente":"art. 190 LSC","valor":0},"SL":{"fuente":"art. 196 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":"Favor > Contra","fuente":"art. 201.1 LSC"},"SL":{"formula":"> 1/2 capital presente","fuente":"art. 198 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"cuentas","nombre":"Cuentas Anuales"},{"id":"informe_gestion","nombre":"Informe de Gesti\u00f3n"},{"condicion":"si_auditada","id":"informe_auditor","nombre":"Informe de Auditor"},{"id":"propuesta_resultado","nombre":"Propuesta de Distribuci\u00f3n de Resultado"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `APROBACION_CUENTAS`
- `rule_pack_version_id`: `937f4156-d67b-4855-b2aa-5fbe71a93864`
- `status`: `ACTIVE`
- `payload_hash`: `e973faaa32a5ae71c6a3c15e9ccb72edfb358455cfe81fc183c7516ea7b693f7`
- `payload_chars`: `2621`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA","PUBLICACION_ESTATUTOS"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Orden del d\u00eda con indicaci\u00f3n de asuntos","Cargo o nombre de quien convoca"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"cuentas_anuales","nombre":"Cuentas anuales formuladas"},{"condicion":"SIEMPRE","id":"informe_gestion","nombre":"Informe de gesti\u00f3n"},{"condicion":"SI_AUDITORIA_OBLIGATORIA","id":"informe_auditoria","nombre":"Informe de auditor\u00eda"},{"condicion":"SIEMPRE","id":"propuesta_aplicacion_resultado","nombre":"Propuesta de aplicaci\u00f3n del resultado"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0},"SL":{"fuente":"LEY","referencia":"art. 198 LSC","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 248.1 LSC"},"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 198 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"cuentas_anuales","nombre":"Cuentas anuales firmadas por todos los administradores"},{"id":"informe_gestion","nombre":"Informe de gesti\u00f3n del ejercicio"},{"condicion":"SI_AUDITORIA","id":"informe_auditoria","nombre":"Informe de auditor\u00eda (si obligatoria)"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

### AUTORIZACION_GARANTIA - JUNTA_GENERAL

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `1.1.0`

- `rule_pack_id`: `AUTORIZACION_GARANTIA`
- `rule_pack_version_id`: `32d9f964-d6eb-42c0-935a-2bfaece1aec1`
- `status`: `ACTIVE`
- `payload_hash`: `f08b80ed0f64a33b9a40bc521ab46710e24e2aea2c8209c8b57842b1e7c56acb`
- `payload_chars`: `1811`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"contenidoMinimo":["Naturaleza y cuant\u00eda de la garant\u00eda","Beneficiario","An\u00e1lisis de riesgo"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"descripcion_garantia","nombre":"Descripci\u00f3n de la garant\u00eda"},{"condicion":"SIEMPRE","id":"verificacion_umbral_160f","nombre":"Verificaci\u00f3n umbral 25% activos (art. 160.f LSC)"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY"},"SA":{"formula":"favor > total_miembros / 2","fuente":"LEY"},"SL":{"formula":"favor > total_miembros / 2","fuente":"LEY"}},"votoCalidadPermitido":true}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"descripcion_garantia","nombre":"Descripci\u00f3n de la garant\u00eda y an\u00e1lisis"},{"id":"calculo_umbral","nombre":"C\u00e1lculo del porcentaje sobre activos"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","plazoInscripcionDias":0,"publicacionRequerida":false}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `AUTORIZACION_GARANTIA`
- `rule_pack_version_id`: `ad81c829-0b8f-4992-b43b-64caf222083e`
- `status`: `ACTIVE`
- `payload_hash`: `96e515944d6763b9c26cfe85755ee0cfb356588f3248ce363f453fdb5f62041e`
- `payload_chars`: `1818`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC \u2014 si >25% activo: competencia JGA art. 160.f LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Naturaleza y cuant\u00eda de la garant\u00eda","Beneficiario y operaci\u00f3n garantizada"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"descripcion_garantia","nombre":"Descripci\u00f3n de la garant\u00eda y evaluaci\u00f3n del riesgo"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY"},"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 198 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"descripcion_garantia","nombre":"Descripci\u00f3n de la garant\u00eda y an\u00e1lisis de riesgo"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

### CESE_CONSEJERO - JUNTA_GENERAL

#### Version `1.0.0`

- `rule_pack_id`: `CESE_CONSEJERO`
- `rule_pack_version_id`: `d73aaa52-cd89-4cfc-be79-d573db8c8527`
- `status`: `ACTIVE`
- `payload_hash`: `45bf0b298d41908d32765216821ef89497effedca3e8914344272aeef7821b9f`
- `payload_chars`: `1758`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA","PUBLICACION_ESTATUTOS"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Orden del d\u00eda identificando al consejero afectado"],"documentosObligatorios":[]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 247.1 LSC"},"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 223.1 LSC \u2014 libre separaci\u00f3n"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 223.1 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 17 RRM"},"publicacionRequerida":false}` | Pendiente |

### CESION_GLOBAL_ACTIVO - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `CESION_GLOBAL_ACTIVO`
- `rule_pack_version_id`: `ce5d8a12-9655-4b96-88e8-35dccde6dc29`
- `status`: `ACTIVE`
- `payload_hash`: `b08a8cf6fcc99ad65a3a21626dc6dcb15d27033d70fc9df4b82119e86da6e168`
- `payload_chars`: `885`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":">= 2/3 emitidos SIEMPRE","fuente":"art. 201.2 LSC"},"SL":{"formula":">= 2/3 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"proyecto","nombre":"Proyecto de Cesi\u00f3n Global"},{"id":"informes","nombre":"Informes Administrativos"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

### DISOLUCION - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `DISOLUCION`
- `rule_pack_version_id`: `cf2f5a40-e47c-48e8-9a0f-1bddfb65da7e`
- `status`: `ACTIVE`
- `payload_hash`: `295e4681fa7092277c355804468665818ce5cbd2de46e6e6ae8547d5b971e411`
- `payload_chars`: `750`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":">= 2/3 emitidos SIEMPRE","fuente":"art. 201.2 LSC"},"SL":{"formula":">= 2/3 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

### DISTRIBUCION_DIVIDENDOS - JUNTA_GENERAL

#### Version `1.0.0`

- `rule_pack_id`: `DISTRIBUCION_DIVIDENDOS`
- `rule_pack_version_id`: `678c073b-d18e-407a-9f04-daa47b9bbcc3`
- `status`: `ACTIVE`
- `payload_hash`: `a1d643b6096e07c0efe93e6bfd3723aa3d533cdbe7aada4e5a16857fb81516e3`
- `payload_chars`: `1970`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","referencia":"art. 176.1 LSC","valor":15},"SL":{"fuente":"LEY","valor":15}},"canales":{"SA":["BORME","WEB_INSCRITA","PUBLICACION_ESTATUTOS"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"contenidoMinimo":["Fecha hora y lugar","Orden del d\u00eda","Propuesta de distribuci\u00f3n"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"propuesta_distribucion","nombre":"Propuesta de distribuci\u00f3n de dividendos"},{"condicion":"SI_SL","id":"informe_liquidez","nombre":"Informe de liquidez (art. 348 LSC)"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"},"SA_1a":{"fuente":"LEY","referencia":"art. 193.1 LSC","valor":0.25},"SA_2a":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 248.1 LSC"},"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > mitad_capital_con_voto","fuente":"LEY","referencia":"art. 198 LSC"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"propuesta_distribucion","nombre":"Propuesta de distribuci\u00f3n de dividendos"},{"id":"cuentas_aprobadas","nombre":"Cuentas anuales ya aprobadas (condici\u00f3n previa)"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

### EMISION_OBLIGACIONES - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `EMISION_OBLIGACIONES`
- `rule_pack_version_id`: `5951215d-cbe1-46c8-b553-26e511f0d3ac`
- `status`: `ACTIVE`
- `payload_hash`: `6fba363ec91abde13bfda6581aab8718cddaa50e6ead28fd7b87824666a1b79c`
- `payload_chars`: `937`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"dobleCondicional":{"mayoriaAlternativa":"2/3 emitidos","umbral":50},"formula":"> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a","fuente":"art. 201.2 LSC"},"SL":{"formula":"> 1/2 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"condiciones_emision","nombre":"Condiciones de Emisi\u00f3n"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

### FORMULACION_CUENTAS - CONSEJO

#### Version `v1.0.0`

- `rule_pack_id`: `FORMULACION_CUENTAS`
- `rule_pack_version_id`: `5a43f95d-0589-4888-afdf-147405e0b44e`
- `status`: `ACTIVE`
- `payload_hash`: `4ceb9c22c951fbf058834da9982719ac878b8d177ab2377d0f8ed5068904beb3`
- `payload_chars`: `1670`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"art. 176.1 LSC","valor":30},"SL":{"fuente":"art. 176.2 LSC","valor":15}},"canales":{"SA":["BORME","DIARIO","WEB_SOCIEDAD"],"SL":["COMUNICACION_INDIVIDUAL"]},"contenidoMinimo":["denominacion_social","fecha_hora_lugar","orden_dia","derecho_informacion"]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"Estatutos","valor":"Mayor\u00eda"}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"CONSEJO":{"formula":"Mayor\u00eda","fuente":"Estatutos"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"borrador_cuentas","nombre":"Borrador de Cuentas"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

### OPERACION_VINCULADA - CONSEJO

**Atencion:** hay mas de una version activa para este contexto. Legal puede revisar contenido, pero Ingenieria debe resolver la version canonica antes de usarlo como fuente determinista.

#### Version `1.1.0`

- `rule_pack_id`: `OPERACION_VINCULADA`
- `rule_pack_version_id`: `c7000f00-7eec-4d57-bc05-3b9dae610ec5`
- `status`: `ACTIVE`
- `payload_hash`: `c4064f408b9ea153477b01b3547370b4ceb41f313ed55f0ec815ac8b473f1095`
- `payload_chars`: `1879`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"contenidoMinimo":["Identificaci\u00f3n parte vinculada y naturaleza del v\u00ednculo","Condiciones econ\u00f3micas","Declaraci\u00f3n de abstenci\u00f3n"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"informe_condiciones_mercado","nombre":"Informe de condiciones de mercado"},{"condicion":"SI_COTIZADA","id":"informe_comision_auditoria","nombre":"Informe favorable Comisi\u00f3n Auditor\u00eda (cotizadas)"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"cuentan_como_contra","mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 228.e LSC"},"SA":{"formula":"favor > total_miembros / 2","fuente":"LEY"},"SL":{"formula":"favor > total_miembros / 2","fuente":"LEY"}},"nota_abstenciones":"Abstenciones de consejeros vinculados computan como contra (arts. 228-229 LSC)","votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"informe_valoracion","nombre":"Informe de valoraci\u00f3n"},{"id":"declaracion_vinculacion","nombre":"Declaraci\u00f3n de la parte vinculada"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","plazoInscripcionDias":0,"publicacionRequerida":false}` | Pendiente |

#### Version `1.0.0`

- `rule_pack_id`: `OPERACION_VINCULADA`
- `rule_pack_version_id`: `05fd0c53-ec36-4e3b-8c4d-f55da7498ce5`
- `status`: `ACTIVE`
- `payload_hash`: `2c423229b6d7ee112b93cd25ec26fcb9f69105bbdb2a81a3d63547ae6b1ac5cf`
- `payload_chars`: `1768`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | `{"antelacionDias":{"SA":{"fuente":"LEY","valor":0},"SL":{"fuente":"LEY","valor":0}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"contenidoMinimo":["Identificaci\u00f3n de la parte vinculada","Naturaleza y condiciones econ\u00f3micas","Beneficios y riesgos para la sociedad"],"documentosObligatorios":[{"condicion":"SIEMPRE","id":"informe_condiciones_mercado","nombre":"Informe de condiciones de mercado"},{"condicion":"SI_COTIZADA","id":"informe_comision_auditoria","nombre":"Informe favorable Comisi\u00f3n Auditor\u00eda (cotizadas)"}]}` | Pendiente |
| Constitucion / quorum | `{"quorum":{"CONSEJO":{"fuente":"LEY","referencia":"art. 247.1 LSC","valor":"mayoria_miembros"}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"cuentan_como_contra","mayoria":{"CONSEJO":{"formula":"favor > presentes_mitad_no_vinculados","fuente":"LEY","referencia":"art. 228.e LSC"},"SA":{"formula":"favor > presentes_mitad_no_vinculados","fuente":"LEY","referencia":"art. 228.e LSC"},"SL":{"formula":"favor > presentes_mitad_no_vinculados","fuente":"LEY"}},"votoCalidadPermitido":false}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"informe_valoracion","nombre":"Informe de valoraci\u00f3n"},{"id":"declaracion_vinculacion","nombre":"Declaraci\u00f3n de la parte vinculada"}],"ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false}` | Pendiente |

### TRANSFORMACION - JUNTA_GENERAL

#### Version `v1.0.0`

- `rule_pack_id`: `TRANSFORMACION`
- `rule_pack_version_id`: `2794af7f-acec-43f7-a086-bea253513367`
- `status`: `ACTIVE`
- `payload_hash`: `ddaf544b90dcf8eb6ed5393b83d136178c633273f4d19d57337b0fba1d7b561f`
- `payload_chars`: `939`

| Gate | Valor extraido del rule pack | Revision Legal |
|---|---|---|
| Convocatoria | No informado | Pendiente |
| Constitucion / quorum | `{"quorum":{"SA_1a":{"fuente":"art. 194 LSC","valor":50},"SA_2a":{"fuente":"art. 194 LSC","valor":25},"SL":{"fuente":"art. 197 LSC","valor":50}}}` | Pendiente |
| Votacion / mayoria | `{"abstenciones":"no_cuentan","mayoria":{"SA":{"formula":">= 2/3 emitidos SIEMPRE","fuente":"art. 201.2 LSC"},"SL":{"formula":">= 2/3 capital","fuente":"art. 199 LSC"}}}` | Pendiente |
| Documentacion | `{"obligatoria":[{"id":"proyecto","nombre":"Proyecto de Transformaci\u00f3n"},{"id":"balance","nombre":"Balance de Situaci\u00f3n"}]}` | Pendiente |
| Post-acuerdo / inscripcion | `{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true}` | Pendiente |

## 5. Decisiones solicitadas a Legal

- Confirmar si los valores de convocatoria, quorum, mayoria, documentacion y post-acuerdo coinciden con LSC/RRM/RDL 5/2023 para SA y SL.
- Marcar cualquier divergencia como: override estatutario legitimo, error del rule pack o error de clasificacion del perfil.
- Priorizar las materias inscribibles: modificaciones estatutarias, capital, modificaciones estructurales, nombramientos, delegacion de facultades y auditor.
- En contextos con multiples versiones activas, indicar cual es juridicamente correcta; Ingenieria debera resolver la activacion tecnica.
