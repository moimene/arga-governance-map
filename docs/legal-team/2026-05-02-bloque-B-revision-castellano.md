# Bloque B — Revisión legal del paquete de mejoras (16 plantillas)

> **Audiencia:** Comité Legal Garrigues — Secretaría Societaria
> **Documento equivalente legible-por-humanos** del paquete técnico SQL (`sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql`).
> **Estado de evidencia:** demo / operativa.

---

## 1. Resumen ejecutivo

Se os pide revisar **16 plantillas** que el Comité Legal ya firmó previamente como `Comité Legal ARGA — Secretaría Societaria (demo-operativo)`. Se han redactado mejoras estructurales y queremos aplicarlas como **nuevas versiones** de las plantillas activas, manteniendo las versiones anteriores intactas para rollback.

El trabajo se divide en 2 categorías por nivel de cambio:

| Categoría | Plantillas | Tipo de cambio |
|---|---|---|
| **Categoría 1** | 3 plantillas | **Texto Capa 1 NUEVO** con bloques añadidos (cotizada condicional, idempotencia, referencias QTSP) |
| **Categoría 2** | 13 plantillas | **Commit formal sin cambio sustantivo** — el texto Capa 1 se conserva tal como está en Cloud; el bump de versión documenta la firma del Comité |

**Decisión que os pedimos:** autorizar / autorizar parcialmente / rechazar la aplicación del paquete.

**Plazo orientativo:** 1 semana (paralelo a la revisión del Bloque A).

---

## 2. Categoría 1 — Plantillas con texto Capa 1 NUEVO

Estas 3 plantillas reciben texto Capa 1 reescrito. Os pedimos validar el texto íntegro abajo. Si aprobáis, se aplicará como nueva versión bumpeada.

### 2.1. CONVOCATORIA — Junta General (versión 1.1.0 → 1.2.0)

**Cambios respecto a versión actual:**
- Añadido bloque condicional para sociedad cotizada (canales de difusión pública, procedimiento de preguntas, voto a distancia).
- Añadida trazabilidad explícita de `agreements.id` en la convocatoria.
- Añadido sello de tiempo QTSP opcional como referencia.

**Texto Capa 1 propuesto:**

```
CONVOCATORIA DE JUNTA GENERAL DE {{entities.name}}

Por acuerdo del órgano de administración de {{entities.name}} (la "Sociedad"),
adoptado en fecha {{agreements.convocatoria.fecha_adopcion}} y trazado bajo
agreements.id {{agreements.convocatoria.id}}, se convoca a los accionistas/socios
a la Junta General {{meetings.junta.tipo_junta}} que tendrá lugar el día
{{meetings.junta.fecha}} a las {{meetings.junta.hora}} en {{meetings.junta.lugar}},
en modalidad {{meetings.junta.modalidad}}.

Si procede segunda convocatoria, se hace constar que, de no alcanzarse en primera
convocatoria el quórum necesario, la Junta se celebrará en segunda convocatoria
el día {{meetings.junta.fecha_segunda_convocatoria}} a las
{{meetings.junta.hora_segunda_convocatoria}} en {{meetings.junta.lugar}}.

Orden del día. {{meetings.junta.orden_del_dia_resumen}}

Derecho de información y documentación disponible. Los accionistas/socios podrán
solicitar la información y aclaraciones que resulten procedentes respecto de los
asuntos comprendidos en el orden del día en los términos aplicables. La
documentación de soporte estará disponible mediante {{meetings.junta.canal_documentacion}}
y se identifica en el índice del expediente {{agreements.convocatoria.expediente_id}}
como {{agreements.convocatoria.indice_documentacion_ref}}.

Canal de convocatoria y comunicaciones. La presente convocatoria se comunicará/publicará
por {{meetings.junta.canal_convocatoria}} y el expediente conservará prueba
demo/operativa del evento de publicación/envío bajo la referencia
{{meetings.junta.publicacion_ref}}.

Bloque cotizada (condicional por entidad). Si {{entities.es_cotizada}} es "SÍ",
la Sociedad hará constar en el expediente los canales de difusión pública y
acceso no discriminatorio aplicables, así como el procedimiento de preguntas y
solicitudes de información, identificados por {{meetings.junta.cotizada_canal_publicidad}}
y {{meetings.junta.cotizada_procedimiento_preguntas_ref}}. Cuando la Junta se
celebre en modalidad telemática o mixta, el expediente incorporará el
procedimiento de acreditación, participación y voto a distancia identificado por
{{meetings.junta.cotizada_procedimiento_voto_distancia_ref}}.

Este documento es evidencia de apoyo demo/operativa. No constituye evidencia
final productiva.

En {{SISTEMA.lugar_emision}}, a {{SISTEMA.fecha_emision}}.

Firma del órgano convocante: {{QTSP.firma_convocante_ref}}
Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
```

**Referencia legal:** LSC (convocatoria y derecho de información; especialidades cotizadas cuando proceda); estatutos sociales; reglamento de junta (si existe).

**Decisión:** [ ] Aprobar texto · [ ] Rechazar · [ ] Aprobar con modificaciones (especificar)

---

### 2.2. CONVOCATORIA_SL_NOTIFICACION — Notificación individual SL (versión 1.1.0 → 1.2.0)

**Cambios respecto a versión actual:**
- Añadida prueba de envío demo/operativa con referencia de evento y acuse opcional.
- Trazabilidad `agreements.id` explícita.

**Texto Capa 1 propuesto:**

```
NOTIFICACIÓN INDIVIDUAL DE CONVOCATORIA DE JUNTA GENERAL — {{entities.name}} (SL)

Destinatario: {{persons.socio_destinatario.nombre_completo}}
              (NIF {{persons.socio_destinatario.nif}})
Canal/domicilio designado: {{meetings.junta_sl.canal_notificacion}}

Por acuerdo del órgano de administración de la Sociedad adoptado en fecha
{{agreements.convocatoria.fecha_adopcion}} y trazado bajo agreements.id
{{agreements.convocatoria.id}}, se le notifica la convocatoria de la Junta
General {{meetings.junta_sl.tipo_junta}} a celebrar el día
{{meetings.junta_sl.fecha}} a las {{meetings.junta_sl.hora}} en
{{meetings.junta_sl.lugar}}, modalidad {{meetings.junta_sl.modalidad}}.

Orden del día. {{meetings.junta_sl.orden_del_dia_resumen}}

Derecho de información y documentación. La documentación asociada está
disponible en {{meetings.junta_sl.canal_documentacion}} y se identifica en el
expediente como {{agreements.convocatoria.indice_documentacion_ref}}.

Prueba de envío demo/operativa. La notificación se remite por
{{meetings.junta_sl.canal_notificacion}} en fecha {{meetings.junta_sl.fecha_envio}},
con referencia de evento {{meetings.junta_sl.envio_ref}} y, en su caso, acuse
{{meetings.junta_sl.acuse_ref}}.

Este documento es evidencia de apoyo demo/operativa. No constituye evidencia
final productiva.

En {{SISTEMA.lugar_emision}}, a {{SISTEMA.fecha_emision}}.
Firma: {{QTSP.firma_convocante_ref}}.
```

**Referencia legal:** LSC (convocatoria y derecho de información en SL); estatutos (forma de convocatoria).

**Decisión:** [ ] Aprobar texto · [ ] Rechazar · [ ] Aprobar con modificaciones (especificar)

---

### 2.3. ACTA_SESION — Junta General (versión 1.1.0 → 1.2.0)

**Cambios respecto a versión actual:**
- Bloque condicional cotizada con recuento por canal y delegaciones.
- Tratamiento explícito de conflictos y pactos por punto del orden del día.
- Idempotencia documentada (mismo input produce mismo acta).
- Anexos A (lista de asistentes) y B (conflictos/pactos) referenciados.

**Texto Capa 1 propuesto:**

```
ACTA DE LA JUNTA GENERAL DE {{entities.name}}

En {{meetings.junta.lugar}}, a {{meetings.junta.fecha}} a las
{{meetings.junta.hora_inicio}}, se reúne la Junta General de
{{entities.name}}, con datos registrales {{entities.datos_registrales_resumen}},
bajo la presidencia de {{governing_bodies.junta.presidente_nombre}} y actuando
como secretario/a {{governing_bodies.junta.secretario_nombre}}.

Este documento es evidencia demo/operativa. No constituye acta registral
productiva ni evidencia final productiva.

Convocatoria / junta universal. Si {{meetings.junta.es_universal}} es "SÍ", se
declara junta universal con aceptación unánime. Si es "NO", se hace constar
convocatoria realizada por {{meetings.junta.canal_convocatoria}} en fecha
{{meetings.junta.fecha_convocatoria}} y su referencia
{{meetings.junta.publicacion_ref}}. La Junta se celebra en
{{meetings.junta.convocatoria_ordinal}} convocatoria.

Lista de asistentes y capital concurrente. Se incorpora como Anexo A (lista de
asistentes) la relación de asistentes y representados, con capital y derechos
de voto. El capital concurrente con derecho de voto asciende a
{{rule_pack.junta.capital_concurrente_porcentaje}}%
({{rule_pack.junta.capital_concurrente_importe}}), según cálculo
{{rule_pack.junta.calculo_capital_ref}}.

Conflictos, abstenciones y pactos. El estado de conflictos por punto es
{{rule_pack.conflictos.estado_resumen}} y el estado de pactos parasociales
relevantes es {{rule_pack.pactos.estado_resumen}}. Si existen conflictos/pactos
relevantes, se incorpora Anexo B con su tratamiento por punto y efecto en
denominadores de voto.

Orden del día. {{meetings.junta.orden_del_dia_resumen}}

Adopción de acuerdos por punto. Para cada punto se transcribe el acuerdo, el
resultado de votación y su agreements.id.

{{#each meetings.junta.puntos}}
Punto {{numero}} — {{titulo}}
Texto del acuerdo: "{{texto_acuerdo}}"
Resultado: a favor {{votos_favor}}, en contra {{votos_contra}}, abstenciones
{{abstenciones}}, nulos/blanco {{votos_nulos}}.
Mayoría/quórum aplicables: {{mayoria_descripcion}} (verificación
{{rule_pack_ref}}).
Proclamación: el presidente proclama aprobado el acuerdo.
Trazabilidad: agreements.id = {{agreement_id}}.
{{/each}}

Salvedades. {{meetings.junta.salvedades}}

Aprobación del acta. El acta queda {{meetings.junta.modo_aprobacion_acta}};
si no se aprueba al final, se consignan fecha y sistema de aprobación como
{{meetings.junta.detalle_aprobacion_acta}}.

Bloque cotizada. Si {{entities.es_cotizada}} es "SÍ", se deja constancia del
recuento por canal y de delegaciones/voto a distancia conforme al expediente
{{meetings.junta.recuento_por_canal_ref}} y {{meetings.junta.delegaciones_ref}},
y de incidencias técnicas (si las hubo) en {{meetings.junta.incidencias_ref}}.

Cierre: se levanta la sesión a las {{meetings.junta.hora_cierre}}.

Firma Secretario/a: {{QTSP.firma_secretario_ref}}
VºBº Presidente: {{QTSP.firma_presidente_ref}}
Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
```

**Referencia legal:** RRM (lista de asistentes, aprobación del acta, supuestos especiales, acta notarial); LSC (junta y adopción de acuerdos); estatutos/reglamento de junta.

**Notas:** Esta plantilla NO sustituye acta notarial cuando el expediente requiera intervención notarial.

**Decisión:** [ ] Aprobar texto · [ ] Rechazar · [ ] Aprobar con modificaciones (especificar)

---

## 3. Categoría 2 — Plantillas con commit formal sin cambio de texto (13 plantillas)

Estas 13 plantillas mantienen su texto Capa 1 actual de Cloud **sin modificación**. Lo que se propone es:

1. Insertar una nueva fila en `plantillas_protegidas` con `version+1` (la fila ACTIVA actual queda intacta para rollback).
2. La nueva fila lleva el mismo `capa1_inmutable`, `capa2_variables`, `capa3_editables` que la versión actual.
3. La firma del Comité Legal queda registrada en `aprobada_por` y `fecha_aprobacion` con fecha 2026-05-02.

**El propósito jurídico-operativo:** documentar un commit formal del Comité sobre la plantilla aunque su texto no cambie. Es un acto de "ratificación de control" del estado actual, útil para audit trail.

| # | Tipo | Materia | Versión actual → nueva | Justificación |
|---|---|---|---|---|
| 04 | ACTA_SESION | CONSEJO_ADMIN | 1.1.0 → 1.2.0 | Ratificación de control del acta del Consejo |
| 05 | CERTIFICACION | CERTIFICACION_ACUERDOS | 1.2.0 → 1.3.0 | Plantilla transversal de certificación |
| 06 | INFORME_DOCUMENTAL_PRE | EXPEDIENTE_PRE | 1.0.1 → 1.1.0 | Soporte interno pre-acuerdo |
| 07 | INFORME_PRECEPTIVO | CONVOCATORIA_PRE | 1.0.1 → 1.1.0 | Soporte interno pre-convocatoria |
| 08 | ACTA_ACUERDO_ESCRITO | ACUERDO_SIN_SESION | 1.2.0 → 1.3.0 | Acuerdo sin sesión (RRM supuestos especiales) |
| 09 | ACTA_CONSIGNACION | DECISION_SOCIO_UNICO | 1.1.0 → 1.2.0 | Decisión socio único (LSC art. 15) |
| 10 | ACTA_CONSIGNACION | DECISION_ADMIN_UNICO | 1.1.0 → 1.2.0 | Decisión administrador único |
| 11 | ACTA_DECISION_CONJUNTA | CO_APROBACION | 1.0.0 → 1.1.0 | Coaprobación administradores conjuntos |
| 12 | ACTA_ORGANO_ADMIN | ADMIN_SOLIDARIO | 1.0.0 → 1.1.0 | Decisión administrador solidario |
| 13 | MODELO_ACUERDO | APROBACION_CUENTAS | 1.0.0 → 1.1.0 | Aprobación de cuentas anuales |
| 14 | MODELO_ACUERDO | FORMULACION_CUENTAS | 1.0.0 → 1.1.0 | Formulación de cuentas por administradores |
| 15 | MODELO_ACUERDO | DELEGACION_FACULTADES | 1.0.0 → 1.1.0 | Delegación de facultades del Consejo |
| 16 | MODELO_ACUERDO | OPERACION_VINCULADA | 1.0.0 → 1.1.0 | Operación vinculada con tratamiento de conflicto |

---

## 4. Pregunta jurídica que os pedimos resolver

**¿Es procedente bumpear la versión de una plantilla sin cambiar el texto, como acto formal de ratificación del Comité?**

| Si decidís SÍ | Las 13 plantillas se aplican como `version+1` con la firma del Comité documentada. Esto añade un commit auditable al historial de cada plantilla, útil para demostrar que el Comité ratificó el estado actual en 2026-05-02. |
| Si decidís NO | Las 13 entradas se descartan del paquete. Solo las 3 con texto Capa 1 nuevo (Categoría 1) se aplicarían, si las aprobáis. |

---

## 5. Decisión global del paquete

| Opción | Implicación |
|---|---|
| [ ] **Autorizar aplicación íntegra** (3 + 13 = 16 plantillas) | Aplicamos las 3 con texto nuevo + las 13 con commit formal sin cambio |
| [ ] **Autorizar parcialmente** | Especificar cuáles plantillas SÍ y cuáles NO. Por ejemplo: "Sí Categoría 1, No Categoría 2" o "Sí 01, 02, 03, 13; No el resto" |
| [ ] **Rechazar — requiere modificaciones** | Especificar qué cambios necesitamos antes de aplicar |

---

## 6. Formato de respuesta esperado

Devolvednos un único documento markdown con esta estructura:

```md
# Revisión Bloque B — paquete de mejoras 16 plantillas

## Decisión global
[ ] Autorizar aplicación íntegra
[ ] Autorizar parcialmente: <especificar plantillas>
[ ] Rechazar

## Plantillas Categoría 1 (texto Capa 1 nuevo)
- 01 CONVOCATORIA / CONVOCATORIA_JUNTA: [aprobar / rechazar / modificar — indicar]
- 02 CONVOCATORIA_SL_NOTIFICACION: [aprobar / rechazar / modificar]
- 03 ACTA_SESION / JUNTA_GENERAL: [aprobar / rechazar / modificar]

## Plantillas Categoría 2 (commit formal sin cambio)
[ ] El bump como ratificación formal sin cambio de texto se considera procedente.
[ ] No procede — las 13 entradas se descartan del paquete.
[ ] Procede solo para algunas: <especificar>

## Observaciones jurídicas
<libre>

## Firma
- revisado_por: <Nombre y apellidos>, Colegio de Abogados de <ciudad> nº <nº>
- fecha_revision: YYYY-MM-DD
```

---

## 7. Anexo técnico (para ingeniería)

Este documento es la versión humana del paquete técnico SQL ubicado en:

`docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql`

Contiene 16 instrucciones `INSERT` en una transacción `BEGIN..COMMIT`. Las nuevas filas nacen en estado `BORRADOR` (no auto-promoción a `ACTIVA`). Tras vuestra autorización, ingeniería ejecuta el SQL con credencial admin previa `bun run db:check-target` y la promoción `BORRADOR → ACTIVA` queda como paso separado con visto bueno operativo.

**Vosotros NO necesitáis abrir ese SQL.** Vuestro trabajo se cierra en este documento.
