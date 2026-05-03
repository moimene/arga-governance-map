# Paquete entregable equipo legal — 17 plantillas (2026-05-02)

> **Estado:** archivado como entregable bruto del equipo legal. Contiene auto-link artifacts del frontend (`[name](http://name)`) que deben limpiarse antes de aplicar a Cloud.
>
> **Procesado por:** Agent B (carril B — aplicar 16 como nuevas versiones de ACTIVAS).
>
> **Para Path A (17 reales legacy):** solo plantilla #17 POLITICA_REMUNERACION coincide con la lista real Cloud. Las otras 16 son mejoras cualitativas a plantillas ya APROBADAS por el Comité Legal ARGA — se aplican como `version+1`.

---

## Convención de fuentes Capa 2 (recordatorio)

- `entities.*` / `agreement.*` / `agreements.*` → ENTIDAD/EXPEDIENTE
- `governing_bodies.*` / `mandate.*` → ORGANO
- `meetings.*` → REUNION
- `capital_holdings.*` / `cap_table.*` / `parte_votante.*` → CAP_TABLE
- `persons.*` → PERSONA
- `LEY` / `ESTATUTOS` / `PACTO_PARASOCIAL` / `REGLAMENTO` → snapshot motor
- `rule_pack.*` / `evaluar*` / `calcular*` → snapshot motor
- `QTSP.*` / `SISTEMA.*` → técnico

Disclaimer en todos los textos: "Este documento es evidencia demo/operativa. No constituye evidencia final productiva."

---

## 01) CONVOCATORIA — Junta General (SA / variante cotizada)

**tipo:** CONVOCATORIA
**materia:** CONVOCATORIA_JUNTA
**organo_tipo:** ORGANO_ADMIN
**adoption_mode:** MEETING
**referencia_legal:** LSC (convocatoria y derecho de información; especialidades cotizadas cuando proceda); estatutos sociales; reglamento de junta (si existe).

### Capa 1

```
CONVOCATORIA DE JUNTA GENERAL DE {{entities.name}}

Por acuerdo del órgano de administración de {{entities.name}} (la "Sociedad"), adoptado en fecha {{agreements.convocatoria.fecha_adopcion}} y trazado bajo agreements.id {{agreements.convocatoria.id}}, se convoca a los accionistas/socios a la Junta General {{meetings.junta.tipo_junta}} que tendrá lugar el día {{meetings.junta.fecha}} a las {{meetings.junta.hora}} en {{meetings.junta.lugar}}, en modalidad {{meetings.junta.modalidad}}.

Si procede segunda convocatoria, se hace constar que, de no alcanzarse en primera convocatoria el quórum necesario, la Junta se celebrará en segunda convocatoria el día {{meetings.junta.fecha_segunda_convocatoria}} a las {{meetings.junta.hora_segunda_convocatoria}} en {{meetings.junta.lugar}}.

Orden del día. {{meetings.junta.orden_del_dia_resumen}}

Derecho de información y documentación disponible. Los accionistas/socios podrán solicitar la información y aclaraciones que resulten procedentes respecto de los asuntos comprendidos en el orden del día en los términos aplicables. La documentación de soporte estará disponible mediante {{meetings.junta.canal_documentacion}} y se identifica en el índice del expediente {{agreements.convocatoria.expediente_id}} como {{agreements.convocatoria.indice_documentacion_ref}}.

Canal de convocatoria y comunicaciones. La presente convocatoria se comunicará/publicará por {{meetings.junta.canal_convocatoria}} y el expediente conservará prueba demo/operativa del evento de publicación/envío bajo la referencia {{meetings.junta.publicacion_ref}}.

Bloque cotizada (condicional por entidad). Si {{entities.es_cotizada}} es "SÍ", la Sociedad hará constar en el expediente los canales de difusión pública y acceso no discriminatorio aplicables, así como el procedimiento de preguntas y solicitudes de información, identificados por {{meetings.junta.cotizada_canal_publicidad}} y {{meetings.junta.cotizada_procedimiento_preguntas_ref}}. Cuando la Junta se celebre en modalidad telemática o mixta, el expediente incorporará el procedimiento de acreditación, participación y voto a distancia identificado por {{meetings.junta.cotizada_procedimiento_voto_distancia_ref}}.

Este documento es evidencia de apoyo demo/operativa. No constituye evidencia final productiva.

En {{SISTEMA.lugar_emision}}, a {{SISTEMA.fecha_emision}}.

Firma del órgano convocante: {{QTSP.firma_convocante_ref}}
Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
```

### Capa 2

| variable | fuente | condicion |
|---|---|---|
| entities.name | entities.name | siempre |
| entities.es_cotizada | entities.es_cotizada | siempre |
| agreements.convocatoria.id | agreements.id | siempre |
| agreements.convocatoria.fecha_adopcion | agreements.fecha_adopcion | siempre |
| agreements.convocatoria.expediente_id | agreements.expediente_id | siempre |
| agreements.convocatoria.indice_documentacion_ref | agreements.indice_documentacion_ref | siempre |
| meetings.junta.tipo_junta | meetings.tipo_junta | siempre |
| meetings.junta.fecha | meetings.fecha | siempre |
| meetings.junta.hora | meetings.hora | siempre |
| meetings.junta.lugar | meetings.lugar | siempre |
| meetings.junta.modalidad | meetings.modalidad | siempre |
| meetings.junta.fecha_segunda_convocatoria | meetings.fecha_segunda_convocatoria | si hay segunda convocatoria |
| meetings.junta.hora_segunda_convocatoria | meetings.hora_segunda_convocatoria | si hay segunda convocatoria |
| meetings.junta.orden_del_dia_resumen | meetings.orden_del_dia_resumen | siempre |
| meetings.junta.canal_documentacion | meetings.canal_documentacion | siempre |
| meetings.junta.canal_convocatoria | meetings.canal_convocatoria | siempre |
| meetings.junta.publicacion_ref | meetings.publicacion_ref | siempre |
| meetings.junta.cotizada_canal_publicidad | meetings.cotizada_canal_publicidad | si es cotizada |
| meetings.junta.cotizada_procedimiento_preguntas_ref | meetings.cotizada_procedimiento_preguntas_ref | si es cotizada |
| meetings.junta.cotizada_procedimiento_voto_distancia_ref | meetings.cotizada_procedimiento_voto_distancia_ref | si es cotizada y hay voto a distancia |
| SISTEMA.lugar_emision | SISTEMA.lugar_emision | siempre |
| SISTEMA.fecha_emision | SISTEMA.fecha_emision | siempre |
| QTSP.firma_convocante_ref | QTSP.firma_convocante_ref | siempre |
| QTSP.sello_tiempo_ref | QTSP.sello_tiempo_ref | si hay sellado |

### Capa 3

| campo | obligatoriedad | descripcion |
|---|---|---|
| meetings.junta.orden_del_dia_resumen | OBLIGATORIO | Redacción final del orden del día si requiere matiz. |
| meetings.junta.canal_documentacion | RECOMENDADO | Detalle del canal interno (sin URLs públicas) y acceso. |
| meetings.junta.publicacion_ref | OBLIGATORIO | Referencia de evidencia demo/operativa de envío/publicación. |

**Aprobada por:** Comité Legal ARGA — Secretaría Societaria (demo-operativo)
**Fecha aprobación:** 2026-05-02
**Estado solicitado:** APROBADA (aplicar como nueva versión sobre ACTIVA existente)

---

## 02) CONVOCATORIA_SL_NOTIFICACION

**tipo:** CONVOCATORIA_SL_NOTIFICACION
**materia:** NOTIFICACION_CONVOCATORIA_SL
**organo_tipo:** ORGANO_ADMIN
**adoption_mode:** MEETING
**referencia_legal:** LSC (convocatoria y derecho de información en SL); estatutos (forma de convocatoria).

### Capa 1

```
NOTIFICACIÓN INDIVIDUAL DE CONVOCATORIA DE JUNTA GENERAL — {{entities.name}} (SL)

Destinatario: {{persons.socio_destinatario.nombre_completo}} (NIF {{persons.socio_destinatario.nif}})
Canal/domicilio designado: {{meetings.junta_sl.canal_notificacion}}

Por acuerdo del órgano de administración de la Sociedad adoptado en fecha {{agreements.convocatoria.fecha_adopcion}} y trazado bajo agreements.id {{agreements.convocatoria.id}}, se le notifica la convocatoria de la Junta General {{meetings.junta_sl.tipo_junta}} a celebrar el día {{meetings.junta_sl.fecha}} a las {{meetings.junta_sl.hora}} en {{meetings.junta_sl.lugar}}, modalidad {{meetings.junta_sl.modalidad}}.

Orden del día. {{meetings.junta_sl.orden_del_dia_resumen}}

Derecho de información y documentación. La documentación asociada está disponible en {{meetings.junta_sl.canal_documentacion}} y se identifica en el expediente como {{agreements.convocatoria.indice_documentacion_ref}}.

Prueba de envío demo/operativa. La notificación se remite por {{meetings.junta_sl.canal_notificacion}} en fecha {{meetings.junta_sl.fecha_envio}}, con referencia de evento {{meetings.junta_sl.envio_ref}} y, en su caso, acuse {{meetings.junta_sl.acuse_ref}}.

Este documento es evidencia de apoyo demo/operativa. No constituye evidencia final productiva.

En {{SISTEMA.lugar_emision}}, a {{SISTEMA.fecha_emision}}.
Firma: {{QTSP.firma_convocante_ref}}.
```

### Capa 2

| variable | fuente | condicion |
|---|---|---|
| entities.name | entities.name | siempre |
| persons.socio_destinatario.nombre_completo | persons.nombre_completo | siempre |
| persons.socio_destinatario.nif | persons.nif | siempre |
| agreements.convocatoria.id | agreements.id | siempre |
| agreements.convocatoria.fecha_adopcion | agreements.fecha_adopcion | siempre |
| agreements.convocatoria.indice_documentacion_ref | agreements.indice_documentacion_ref | siempre |
| meetings.junta_sl.* | meetings.* | siempre |
| SISTEMA.lugar_emision | SISTEMA.lugar_emision | siempre |
| SISTEMA.fecha_emision | SISTEMA.fecha_emision | siempre |
| QTSP.firma_convocante_ref | QTSP.firma_convocante_ref | siempre |

### Capa 3

| campo | obligatoriedad | descripcion |
|---|---|---|
| meetings.junta_sl.acuse_ref | RECOMENDADO | Acuse si el canal lo permite. |
| meetings.junta_sl.canal_documentacion | RECOMENDADO | Detalle del canal interno de documentación. |

**Aprobada por:** Comité Legal ARGA — Secretaría Societaria (demo-operativo)
**Fecha aprobación:** 2026-05-02
**Estado solicitado:** APROBADA (aplicar como nueva versión sobre ACTIVA existente)

---

## 03) ACTA_SESION — Junta General

**tipo:** ACTA_SESION
**materia:** JUNTA_GENERAL
**organo_tipo:** JUNTA_GENERAL
**adoption_mode:** MEETING
**referencia_legal:** RRM (lista de asistentes, aprobación del acta, supuestos especiales, acta notarial); LSC (junta y adopción de acuerdos); estatutos/reglamento de junta.

### Capa 1

```
ACTA DE LA JUNTA GENERAL DE {{entities.name}}

En {{meetings.junta.lugar}}, a {{meetings.junta.fecha}} a las {{meetings.junta.hora_inicio}}, se reúne la Junta General de {{entities.name}}, con datos registrales {{entities.datos_registrales_resumen}}, bajo la presidencia de {{governing_bodies.junta.presidente_nombre}} y actuando como secretario/a {{governing_bodies.junta.secretario_nombre}}.

Este documento es evidencia demo/operativa. No constituye acta registral productiva ni evidencia final productiva.

Convocatoria / junta universal. Si {{meetings.junta.es_universal}} es "SÍ", se declara junta universal con aceptación unánime. Si es "NO", se hace constar convocatoria realizada por {{meetings.junta.canal_convocatoria}} en fecha {{meetings.junta.fecha_convocatoria}} y su referencia {{meetings.junta.publicacion_ref}}. La Junta se celebra en {{meetings.junta.convocatoria_ordinal}} convocatoria.

Lista de asistentes y capital concurrente. Se incorpora como Anexo A (lista de asistentes) la relación de asistentes y representados, con capital y derechos de voto. El capital concurrente con derecho de voto asciende a {{rule_pack.junta.capital_concurrente_porcentaje}}% ({{rule_pack.junta.capital_concurrente_importe}}), según cálculo {{rule_pack.junta.calculo_capital_ref}}.

Conflictos, abstenciones y pactos. El estado de conflictos por punto es {{rule_pack.conflictos.estado_resumen}} y el estado de pactos parasociales relevantes es {{rule_pack.pactos.estado_resumen}}. Si existen conflictos/pactos relevantes, se incorpora Anexo B con su tratamiento por punto y efecto en denominadores de voto.

Orden del día. {{meetings.junta.orden_del_dia_resumen}}

Adopción de acuerdos por punto. Para cada punto se transcribe el acuerdo, el resultado de votación y su agreements.id.

{{#each meetings.junta.puntos}}
Punto {{numero}} — {{titulo}}
Texto del acuerdo: "{{texto_acuerdo}}"
Resultado: a favor {{votos_favor}}, en contra {{votos_contra}}, abstenciones {{abstenciones}}, nulos/blanco {{votos_nulos}}.
Mayoría/quórum aplicables: {{mayoria_descripcion}} (verificación {{rule_pack_ref}}).
Proclamación: el presidente proclama aprobado el acuerdo.
Trazabilidad: agreements.id = {{agreement_id}}.
{{/each}}

Salvedades. {{meetings.junta.salvedades}}

Aprobación del acta. El acta queda {{meetings.junta.modo_aprobacion_acta}}; si no se aprueba al final, se consignan fecha y sistema de aprobación como {{meetings.junta.detalle_aprobacion_acta}}.

Bloque cotizada. Si {{entities.es_cotizada}} es "SÍ", se deja constancia del recuento por canal y de delegaciones/voto a distancia conforme al expediente {{meetings.junta.recuento_por_canal_ref}} y {{meetings.junta.delegaciones_ref}}, y de incidencias técnicas (si las hubo) en {{meetings.junta.incidencias_ref}}.

Cierre: se levanta la sesión a las {{meetings.junta.hora_cierre}}.

Firma Secretario/a: {{QTSP.firma_secretario_ref}}
VºBº Presidente: {{QTSP.firma_presidente_ref}}
Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
```

### Capa 2

| variable | fuente | condicion |
|---|---|---|
| entities.name | entities.name | siempre |
| entities.datos_registrales_resumen | entities.datos_registrales_resumen | siempre |
| entities.es_cotizada | entities.es_cotizada | siempre |
| governing_bodies.junta.presidente_nombre | governing_bodies.presidente | siempre |
| governing_bodies.junta.secretario_nombre | governing_bodies.secretario | siempre |
| meetings.junta.* | meetings.* | siempre |
| rule_pack.junta.capital_concurrente_porcentaje | rule_pack.calcular* | siempre |
| rule_pack.junta.capital_concurrente_importe | rule_pack.calcular* | siempre |
| rule_pack.junta.calculo_capital_ref | rule_pack.calcular* | siempre |
| rule_pack.conflictos.estado_resumen | rule_pack.evaluar* | siempre |
| rule_pack.pactos.estado_resumen | rule_pack.evaluar* | siempre |
| QTSP.* | QTSP.* | según firma/sello |

### Capa 3

| campo | obligatoriedad | descripcion |
|---|---|---|
| meetings.junta.salvedades | OPCIONAL | Reservas, protestas o solicitudes de constancia. |
| meetings.junta.detalle_aprobacion_acta | RECOMENDADO | Sistema/fecha de aprobación cuando no sea al final. |
| meetings.junta.incidencias_ref | OBLIGATORIO_SI_TELEMATICA | Detalle/ID de incidencias en telemática/mixta. |

**Aprobada por:** Comité Legal ARGA — Secretaría Societaria (demo-operativo)
**Fecha aprobación:** 2026-05-02
**Estado solicitado:** APROBADA (aplicar como nueva versión sobre ACTIVA existente)
**Notas:** Esta plantilla no sustituye acta notarial cuando el expediente requiera intervención notarial.

---

## 04) ACTA_SESION — Consejo de Administración

**tipo:** ACTA_SESION
**materia:** CONSEJO_ADMIN
**organo_tipo:** CONSEJO_ADMIN
**adoption_mode:** MEETING

(Estructura análoga a #03 adaptada al órgano consejo: convocatoria por consejero/presidente, quórum del consejo, voto de calidad opcional, lista nominal de consejeros presentes/representados/ausentes.)

---

## 05) CERTIFICACION transversal

**tipo:** CERTIFICACION
**materia:** CERTIFICACION_ACUERDOS
**organo_tipo:** DERIVADO_DEL_ACTO
**adoption_mode:** null
**referencia_legal:** RRM arts. 108-109 (elevación a público y facultad de certificar; visto bueno; cargos vigentes; prohibición de certificar sin acta aprobada/notarial); RRM supuestos especiales (acuerdos por correspondencia o sin sesión).

(Texto certificación con manifestación de vigencia, trazabilidad agreements.id, VºBº condicional, snapshot motor.)

---

## 06) INFORME_DOCUMENTAL_PRE

**tipo:** INFORME_DOCUMENTAL_PRE
**materia:** EXPEDIENTE_PRE
**organo_tipo:** SOPORTE_INTERNO
**adoption_mode:** null
**Endurecido:** require_entity_id=true

---

## 07) INFORME_PRECEPTIVO (pre-convocatoria)

**tipo:** INFORME_PRECEPTIVO
**materia:** CONVOCATORIA_PRE
**organo_tipo:** SOPORTE_INTERNO
**adoption_mode:** null

---

## 08) ACTA_ACUERDO_ESCRITO — Sin sesión

**tipo:** ACTA_ACUERDO_ESCRITO
**materia:** ACUERDO_SIN_SESION
**organo_tipo:** JUNTA_GENERAL_O_CONSEJO
**adoption_mode:** NO_SESSION
**referencia_legal:** RRM (supuestos especiales: acuerdos por correspondencia/medios auténticos; acuerdos órgano administración por escrito y sin sesión y ausencia de oposición).

---

## 09) ACTA_CONSIGNACION — Socio único (SLU/SAU)

**tipo:** ACTA_CONSIGNACION
**materia:** DECISION_SOCIO_UNICO
**organo_tipo:** SOCIO_UNICO
**adoption_mode:** UNIPERSONAL_SOCIO
**referencia_legal:** LSC art. 15 (decisiones socio único en acta bajo su firma); RRM (certificación/elevación a público de decisiones de socio único).

---

## 10) ACTA_CONSIGNACION — Administrador único

**tipo:** ACTA_CONSIGNACION
**materia:** DECISION_ADMIN_UNICO
**organo_tipo:** ADMIN_UNICO
**adoption_mode:** UNIPERSONAL_ADMIN

---

## 11) ACTA_DECISION_CONJUNTA — CO_APROBACION

**tipo:** ACTA_DECISION_CONJUNTA
**materia:** CO_APROBACION
**organo_tipo:** ADMIN_CONJUNTA_O_COAPROBADORES
**adoption_mode:** CO_APROBACION

---

## 12) ACTA_ORGANO_ADMIN — SOLIDARIO

**tipo:** ACTA_ORGANO_ADMIN
**materia:** ADMIN_SOLIDARIO
**organo_tipo:** ADMIN_SOLIDARIOS
**adoption_mode:** SOLIDARIO

---

## 13) MODELO_ACUERDO — APROBACION_CUENTAS

**tipo:** MODELO_ACUERDO
**materia:** APROBACION_CUENTAS
**organo_tipo:** JUNTA_GENERAL
**adoption_mode:** MEETING

---

## 14) MODELO_ACUERDO — FORMULACION_CUENTAS

**tipo:** MODELO_ACUERDO
**materia:** FORMULACION_CUENTAS
**organo_tipo:** ORGANO_ADMIN
**adoption_mode:** MEETING

---

## 15) MODELO_ACUERDO — DELEGACION_FACULTADES

**tipo:** MODELO_ACUERDO
**materia:** DELEGACION_FACULTADES
**organo_tipo:** CONSEJO_ADMIN
**adoption_mode:** MEETING

---

## 16) MODELO_ACUERDO — OPERACION_VINCULADA

**tipo:** MODELO_ACUERDO
**materia:** OPERACION_VINCULADA
**organo_tipo:** CONSEJO_ADMIN
**adoption_mode:** MEETING

---

## 17) MODELO_ACUERDO — POLITICA_REMUNERACION

**tipo:** MODELO_ACUERDO
**materia:** POLITICA_REMUNERACION
**organo_tipo:** JUNTA_GENERAL
**adoption_mode:** MEETING
**Cobertura legacy real:** UUID `ee72efde-299b-42fc-86ba-57e29a187a7c` (la única coincidente con las 17 reales legacy)

---

## Mapping Cloud (resumen)

| # legal | tipo + materia | organo_tipo legal | UUID Cloud existente | versión Cloud actual | acción Path B |
|---|---|---|---|---|---|
| 01 | CONVOCATORIA / CONVOCATORIA_JUNTA | ORGANO_ADMIN | (consultar Agent A) | 1.1.0 | bump → 1.2.0 |
| 02 | CONVOCATORIA_SL_NOTIFICACION | ORGANO_ADMIN | (consultar) | 1.1.0 | bump → 1.2.0 |
| 03 | ACTA_SESION / JUNTA_GENERAL | JUNTA_GENERAL | (consultar) | 1.1.0 | bump → 1.2.0 |
| 04 | ACTA_SESION / CONSEJO_ADMIN | CONSEJO_ADMIN | (consultar) | 1.1.0 | bump → 1.2.0 |
| 05 | CERTIFICACION | DERIVADO_DEL_ACTO | (consultar) | 1.2.0 | bump → 1.3.0 |
| 06 | INFORME_DOCUMENTAL_PRE | SOPORTE_INTERNO | (consultar) | 1.0.1 | bump → 1.1.0 |
| 07 | INFORME_PRECEPTIVO | SOPORTE_INTERNO | (consultar) | 1.0.1 | bump → 1.1.0 |
| 08 | ACTA_ACUERDO_ESCRITO | JUNTA_GENERAL_O_CONSEJO | (consultar) | 1.2.0 | bump → 1.3.0 |
| 09 | ACTA_CONSIGNACION / DECISION_SOCIO_UNICO | SOCIO_UNICO | (consultar) | 1.1.0 | bump → 1.2.0 |
| 10 | ACTA_CONSIGNACION / DECISION_ADMIN_UNICO | ADMIN_UNICO | (consultar) | 1.1.0 | bump → 1.2.0 |
| 11 | ACTA_DECISION_CONJUNTA | ADMIN_CONJUNTA_O_COAPROBADORES | (consultar) | 1.0.0 | bump → 1.1.0 |
| 12 | ACTA_ORGANO_ADMIN | ADMIN_SOLIDARIOS | (consultar) | 1.0.0 | bump → 1.1.0 |
| 13 | MODELO_ACUERDO / APROBACION_CUENTAS | JUNTA_GENERAL | (consultar) | 1.0.0 | bump → 1.1.0 |
| 14 | MODELO_ACUERDO / FORMULACION_CUENTAS | ORGANO_ADMIN | (consultar) | 1.0.0 | bump → 1.1.0 |
| 15 | MODELO_ACUERDO / DELEGACION_FACULTADES | CONSEJO_ADMIN | (consultar) | 1.0.0 | bump → 1.1.0 |
| 16 | MODELO_ACUERDO / OPERACION_VINCULADA | CONSEJO_ADMIN | (consultar) | 1.0.0 | bump → 1.1.0 |
| 17 | MODELO_ACUERDO / POLITICA_REMUNERACION | JUNTA_GENERAL | `ee72efde-299b-42fc-86ba-57e29a187a7c` | "1" | promote → 1.0.0 + completar metadatos null |

NOTA: el contenido completo de los 16 paquetes 01-16 está en la conversación origen (transcripción del equipo legal del 2026-05-02). Este archivo conserva los encabezados y referencias para Agent B; los textos íntegros se reproducen en el SQL packet generado.
