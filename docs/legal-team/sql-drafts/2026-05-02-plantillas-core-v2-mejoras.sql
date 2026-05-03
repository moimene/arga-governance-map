-- =============================================================================
-- 2026-05-02 — Plantillas core v2: 16 mejoras del Comité Legal ARGA aplicadas
-- como nuevas versiones (version+1) sobre las ACTIVAS existentes en Cloud.
--
-- ESTADO: PROPUESTO — NO APLICADO.
-- Requiere autorización explícita antes de ejecutar.
-- Antes de aplicar: bun run db:check-target.
-- Cloud: governance_OS (hzqwefkwsxopwrmtksbg), región eu-central-1.
--
-- Estrategia: para cada (tipo, materia) target, INSERT una nueva fila con
-- la siguiente version, manteniendo el original ACTIVA inalterado para
-- rollback. Tras verificación, un UPDATE separado puede archivar la versión
-- anterior y promover la nueva a ACTIVA. Ese UPDATE NO está en este packet.
--
-- Plantillas con texto Capa 1 NUEVO del Comité Legal: 01, 02, 03.
-- Plantillas con Capa 1 PRESERVADA del Cloud (sin texto nuevo en el
--   paquete legal — solo encabezado): 04, 05, 06, 07, 08, 09, 10, 11, 12,
--   13, 14, 15, 16. Para estas, la promoción de versión documenta el
--   commit del Comité Legal sobre el contenido vigente; las mejoras
--   estructurales aplicarán cuando el equipo legal entregue texto completo.
--
-- UUIDs Cloud resueltos vía SELECT contra plantillas_protegidas (ACTIVA por
-- (tipo, materia), tomando la última versión por orden de version DESC).
-- Limpieza obligatoria aplicada al texto NUEVO entregado por legal:
--   - Patrón [X](http://X) → X
--   - Patrón [X.Y](http://X.Y)Z → X.YZ
-- Estado de evidencia: DEMO_OPERATIVA. NO constituye evidencia final
-- productiva.
-- =============================================================================

BEGIN;

-- ============================================================
-- 01) CONVOCATORIA / CONVOCATORIA_JUNTA — bump 1.1.0 -> 1.2.0
-- Original UUID Cloud: 76c3260e-2be6-4969-8b21-e3d6b720e38f
-- Versión Cloud actual ACTIVA: 1.1.0
-- Estado del contenido: Texto Capa 1 NUEVO entregado por Comité Legal ARGA el 2026-05-02.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'CONVOCATORIA',
  'CONVOCATORIA_JUNTA',
  'ES',
  'ORGANO_ADMIN',
  'MEETING',
  '1.2.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_01$
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
$capa1_01$,
  $capa2_01$[
  {
    "variable": "entities.name",
    "fuente": "entities.name",
    "condicion": "siempre"
  },
  {
    "variable": "entities.es_cotizada",
    "fuente": "entities.es_cotizada",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.id",
    "fuente": "agreements.id",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.fecha_adopcion",
    "fuente": "agreements.fecha_adopcion",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.expediente_id",
    "fuente": "agreements.expediente_id",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.indice_documentacion_ref",
    "fuente": "agreements.indice_documentacion_ref",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.tipo_junta",
    "fuente": "meetings.tipo_junta",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.fecha",
    "fuente": "meetings.fecha",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.hora",
    "fuente": "meetings.hora",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.lugar",
    "fuente": "meetings.lugar",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.modalidad",
    "fuente": "meetings.modalidad",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.fecha_segunda_convocatoria",
    "fuente": "meetings.fecha_segunda_convocatoria",
    "condicion": "si hay segunda convocatoria"
  },
  {
    "variable": "meetings.junta.hora_segunda_convocatoria",
    "fuente": "meetings.hora_segunda_convocatoria",
    "condicion": "si hay segunda convocatoria"
  },
  {
    "variable": "meetings.junta.orden_del_dia_resumen",
    "fuente": "meetings.orden_del_dia_resumen",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.canal_documentacion",
    "fuente": "meetings.canal_documentacion",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.canal_convocatoria",
    "fuente": "meetings.canal_convocatoria",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.publicacion_ref",
    "fuente": "meetings.publicacion_ref",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.cotizada_canal_publicidad",
    "fuente": "meetings.cotizada_canal_publicidad",
    "condicion": "si es cotizada"
  },
  {
    "variable": "meetings.junta.cotizada_procedimiento_preguntas_ref",
    "fuente": "meetings.cotizada_procedimiento_preguntas_ref",
    "condicion": "si es cotizada"
  },
  {
    "variable": "meetings.junta.cotizada_procedimiento_voto_distancia_ref",
    "fuente": "meetings.cotizada_procedimiento_voto_distancia_ref",
    "condicion": "si es cotizada y hay voto a distancia"
  },
  {
    "variable": "SISTEMA.lugar_emision",
    "fuente": "SISTEMA.lugar_emision",
    "condicion": "siempre"
  },
  {
    "variable": "SISTEMA.fecha_emision",
    "fuente": "SISTEMA.fecha_emision",
    "condicion": "siempre"
  },
  {
    "variable": "QTSP.firma_convocante_ref",
    "fuente": "QTSP.firma_convocante_ref",
    "condicion": "siempre"
  },
  {
    "variable": "QTSP.sello_tiempo_ref",
    "fuente": "QTSP.sello_tiempo_ref",
    "condicion": "si hay sellado"
  }
]$capa2_01$::jsonb,
  $capa3_01$[
  {
    "campo": "meetings.junta.orden_del_dia_resumen",
    "obligatoriedad": "OBLIGATORIO",
    "descripcion": "Redacción final del orden del día si requiere matiz."
  },
  {
    "campo": "meetings.junta.canal_documentacion",
    "obligatoriedad": "RECOMENDADO",
    "descripcion": "Detalle del canal interno (sin URLs públicas) y acceso."
  },
  {
    "campo": "meetings.junta.publicacion_ref",
    "obligatoriedad": "OBLIGATORIO",
    "descripcion": "Referencia de evidencia demo/operativa de envío/publicación."
  }
]$capa3_01$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (convocatoria y derecho de información; especialidades cotizadas cuando proceda); estatutos sociales; reglamento de junta (si existe).',
  now(),
  now()
);

-- ============================================================
-- 02) CONVOCATORIA_SL_NOTIFICACION / NOTIFICACION_CONVOCATORIA_SL — bump 1.1.0 -> 1.2.0
-- Original UUID Cloud: 1e1a7755-de14-4fdc-a913-e19fbe48d64c
-- Versión Cloud actual ACTIVA: 1.1.0
-- Estado del contenido: Texto Capa 1 NUEVO entregado por Comité Legal ARGA el 2026-05-02.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'CONVOCATORIA_SL_NOTIFICACION',
  'NOTIFICACION_CONVOCATORIA_SL',
  'ES',
  'ORGANO_ADMIN',
  'MEETING',
  '1.2.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_02$
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
$capa1_02$,
  $capa2_02$[
  {
    "variable": "entities.name",
    "fuente": "entities.name",
    "condicion": "siempre"
  },
  {
    "variable": "persons.socio_destinatario.nombre_completo",
    "fuente": "persons.nombre_completo",
    "condicion": "siempre"
  },
  {
    "variable": "persons.socio_destinatario.nif",
    "fuente": "persons.nif",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.id",
    "fuente": "agreements.id",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.fecha_adopcion",
    "fuente": "agreements.fecha_adopcion",
    "condicion": "siempre"
  },
  {
    "variable": "agreements.convocatoria.indice_documentacion_ref",
    "fuente": "agreements.indice_documentacion_ref",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta_sl.*",
    "fuente": "meetings.*",
    "condicion": "siempre"
  },
  {
    "variable": "SISTEMA.lugar_emision",
    "fuente": "SISTEMA.lugar_emision",
    "condicion": "siempre"
  },
  {
    "variable": "SISTEMA.fecha_emision",
    "fuente": "SISTEMA.fecha_emision",
    "condicion": "siempre"
  },
  {
    "variable": "QTSP.firma_convocante_ref",
    "fuente": "QTSP.firma_convocante_ref",
    "condicion": "siempre"
  }
]$capa2_02$::jsonb,
  $capa3_02$[
  {
    "campo": "meetings.junta_sl.acuse_ref",
    "obligatoriedad": "RECOMENDADO",
    "descripcion": "Acuse si el canal lo permite."
  },
  {
    "campo": "meetings.junta_sl.canal_documentacion",
    "obligatoriedad": "RECOMENDADO",
    "descripcion": "Detalle del canal interno de documentación."
  }
]$capa3_02$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (convocatoria y derecho de información en SL); estatutos (forma de convocatoria).',
  now(),
  now()
);

-- ============================================================
-- 03) ACTA_SESION / JUNTA_GENERAL — bump 1.1.0 -> 1.2.0
-- Original UUID Cloud: 53b34d3e-a87d-4378-928a-b03d339cb65c
-- Versión Cloud actual ACTIVA: 1.1.0
-- Estado del contenido: Texto Capa 1 NUEVO entregado por Comité Legal ARGA el 2026-05-02.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_SESION',
  'JUNTA_GENERAL',
  'ES',
  'JUNTA_GENERAL',
  'MEETING',
  '1.2.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_03$
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
$capa1_03$,
  $capa2_03$[
  {
    "variable": "entities.name",
    "fuente": "entities.name",
    "condicion": "siempre"
  },
  {
    "variable": "entities.datos_registrales_resumen",
    "fuente": "entities.datos_registrales_resumen",
    "condicion": "siempre"
  },
  {
    "variable": "entities.es_cotizada",
    "fuente": "entities.es_cotizada",
    "condicion": "siempre"
  },
  {
    "variable": "governing_bodies.junta.presidente_nombre",
    "fuente": "governing_bodies.presidente",
    "condicion": "siempre"
  },
  {
    "variable": "governing_bodies.junta.secretario_nombre",
    "fuente": "governing_bodies.secretario",
    "condicion": "siempre"
  },
  {
    "variable": "meetings.junta.*",
    "fuente": "meetings.*",
    "condicion": "siempre"
  },
  {
    "variable": "rule_pack.junta.capital_concurrente_porcentaje",
    "fuente": "rule_pack.calcular*",
    "condicion": "siempre"
  },
  {
    "variable": "rule_pack.junta.capital_concurrente_importe",
    "fuente": "rule_pack.calcular*",
    "condicion": "siempre"
  },
  {
    "variable": "rule_pack.junta.calculo_capital_ref",
    "fuente": "rule_pack.calcular*",
    "condicion": "siempre"
  },
  {
    "variable": "rule_pack.conflictos.estado_resumen",
    "fuente": "rule_pack.evaluar*",
    "condicion": "siempre"
  },
  {
    "variable": "rule_pack.pactos.estado_resumen",
    "fuente": "rule_pack.evaluar*",
    "condicion": "siempre"
  },
  {
    "variable": "QTSP.*",
    "fuente": "QTSP.*",
    "condicion": "según firma/sello"
  }
]$capa2_03$::jsonb,
  $capa3_03$[
  {
    "campo": "meetings.junta.salvedades",
    "obligatoriedad": "OPCIONAL",
    "descripcion": "Reservas, protestas o solicitudes de constancia."
  },
  {
    "campo": "meetings.junta.detalle_aprobacion_acta",
    "obligatoriedad": "RECOMENDADO",
    "descripcion": "Sistema/fecha de aprobación cuando no sea al final."
  },
  {
    "campo": "meetings.junta.incidencias_ref",
    "obligatoriedad": "OBLIGATORIO_SI_TELEMATICA",
    "descripcion": "Detalle/ID de incidencias en telemática/mixta."
  }
]$capa3_03$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'RRM (lista de asistentes, aprobación del acta, supuestos especiales, acta notarial); LSC (junta y adopción de acuerdos); estatutos/reglamento de junta.',
  now(),
  now()
);

-- ============================================================
-- 04) ACTA_SESION / CONSEJO_ADMIN — bump 1.1.0 -> 1.2.0
-- Original UUID Cloud: 36c28a8c-cbe1-4692-90fd-768a83c26480
-- Versión Cloud actual ACTIVA: 1.1.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_SESION',
  'CONSEJO_ADMIN',
  'ES',
  'CONSEJO_ADMIN',
  'MEETING',
  '1.2.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_04$
ACTA DE LA SESIÓN DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}}

En {{REUNION.lugar}}, a {{REUNION.fecha}} a las {{REUNION.hora_inicio}}, se reúne el Consejo de Administración de {{ENTIDAD.denominacion_social}}, sociedad {{ENTIDAD.tipo_sociedad}} con domicilio social en {{ENTIDAD.domicilio_social}}, inscrita en el Registro Mercantil de {{REGISTRO.rm_provincia}}, al tomo {{REGISTRO.tomo}}, folio {{REGISTRO.folio}}, hoja {{REGISTRO.hoja}}, con NIF {{ENTIDAD.nif}} (la “Sociedad”), previa convocatoria realizada por {{REUNION.convocante_nombre}} en su condición de {{REUNION.convocante_cargo}}, conforme a estatutos y, en su caso, al reglamento del consejo.

Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye mecanismos de cierre y custodia productivos (hash/bundle, audit chain, retention, legal hold y QTSP/QSeal/QES productivo).

I. Convocatoria y orden del día

El presidente declara que la convocatoria fue remitida a todos los consejeros por {{REUNION.medio_convocatoria}} en fecha {{REUNION.fecha_convocatoria}}, con la antelación exigible según estatutos y prácticas internas aplicables, incluyendo el orden del día y la documentación de soporte. Se incorpora como Anexo 1 la convocatoria y, cuando proceda, el índice de documentación puesta a disposición.

El orden del día es el siguiente: {{REUNION.orden_del_dia_resumen}}. El consejo acuerda que cualquier asunto no incluido en el orden del día solo podrá tratarse si se cumplen los requisitos internos aplicables y si su tratamiento no vulnera derechos de información ni reglas de gobierno corporativo.

II. Constitución, asistentes y quórum

Asisten a la sesión los siguientes consejeros: {{REUNION.asistentes_presentes_resumen}}. Asisten representados, cuando sea aplicable, los siguientes consejeros: {{REUNION.asistentes_representados_resumen}}. Constan ausentes: {{REUNION.asistentes_ausentes_resumen}}. La lista nominal completa se incorpora como Anexo 2 (Lista de asistentes y representaciones).

Verificada la concurrencia, el presidente declara válidamente constituido el Consejo para deliberar y adoptar acuerdos, al concurrir {{REUNION.quorum_descripcion}}. Se hace constar, cuando aplique, que el secretario ha verificado la identidad de los asistentes y la suficiencia de las representaciones conforme a las reglas internas.

III. Conflictos de interés, deber de abstención y pactos parasociales

Antes de iniciar la deliberación de los puntos del orden del día, se analiza la existencia de conflictos de interés o restricciones de voto. Se deja constancia de que {{REUNION.conflictos_declarados_resumen}}. Si {{REUNION.hay_conflictos}} es “SÍ”, se incorpora como Anexo 3 (Conflictos, abstenciones y tratamiento de cómputo) la información necesaria por punto, incluyendo el consejero afectado, el motivo, el alcance de la abstención y el efecto en la mayoría y quórum, sin aplanar ni sustituir las reglas legales o estatutarias aplicables.

En materia de pactos parasociales, se deja constancia de {{REUNION.pactos_parasociales_estado}}. Si el expediente identifica pactos relevantes para el asunto tratado, se hará constar su verificación a nivel de expediente y, cuando proceda, se anexará extracto estrictamente necesario para justificar el carril de decisión, evitando su transcripción indiscriminada en el cuerpo del acta.

IV. Deliberación y adopción de acuerdos por punto

Se abre deliberación sobre cada punto del orden del día y se someten a votación las propuestas. La documentación de soporte se identifica por referencia a los IDs del expediente y, cuando proceda, se incorpora como anexo.

Punto {{REUNION.punto_1.numero}} — {{REUNION.punto_1.titulo}}. Tras deliberación, el Consejo adopta el siguiente acuerdo: “{{REUNION.punto_1.texto_acuerdo}}”. El resultado de la votación es: votos a favor {{REUNION.punto_1.votos_favor}}, votos en contra {{REUNION.punto_1.votos_contra}}, abstenciones {{REUNION.punto_1.abstenciones}}, con el tratamiento de abstenciones y restricciones reflejado, en su caso, en el Anexo 3. El presidente proclama aprobado el acuerdo. Trazabilidad del acuerdo: agreements.id = {{REUNION.punto_1.agreement_id}}.

Los restantes puntos se documentan con el mismo nivel de precisión, incluyendo texto dispositivo, resultado de votación, proclamación y agreements.id por acuerdo, de modo que no quede acuerdo fuera del carril trazable del expediente.

V. Voto de calidad (si aplica) y constancia

Si {{REUNION.voto_calidad_aplicado}} es “SÍ”, se hace constar que el empate se resolvió mediante el voto de calidad del presidente (o de quien estatutariamente corresponda) y se identifica el punto afectado y el sentido del voto de calidad: {{REUNION.voto_calidad_detalle}}. Si no aplica, se deja constancia de que no se ha ejercitado voto de calidad.

VI. Delegación de facultades (si procede)

Si dentro del orden del día se incluye una delegación permanente de facultades o el nombramiento/cese de consejero delegado o comisión ejecutiva, se hace constar expresamente el régimen de actuación del órgano delegado, los límites y modalidades de la delegación, y los requisitos reforzados de adopción e inscripción cuando sean exigibles, todo ello con referencia por acuerdo a su agreements.id y con remisión al modelo dispositivo específico de delegación (MODELO_ACUERDO_DELEGACION_FACULTADES) incorporado o referenciado en anexo.

VII. Cierre y firmas

No habiendo más asuntos que tratar, se levanta la sesión a las {{REUNION.hora_cierre}}. Las discusiones y acuerdos se incorporan al libro de actas del consejo, firmando el secretario con el visto bueno del presidente.

Firma del Secretario/a: {{QTSP.firma_secretario_ref}} Visto bueno del Presidente: {{QTSP.firma_presidente_ref}} Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
$capa1_04$,
  $capa2_04$[
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.denominacion_social",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificación plena de la sociedad."
  },
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.tipo_sociedad",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "SA/SL y atributo “cotizada” para variantes."
  },
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.nif",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificador fiscal."
  },
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.domicilio_social",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Domicilio social."
  },
  {
    "fuente": "REGISTRO",
    "variable": "REGISTRO.rm_provincia / tomo / folio / hoja",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Encabezamiento y coherencia registral."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.fecha / hora_inicio / hora_cierre / lugar",
    "obligatoria": "Sí (cierre recomendado)",
    "fallback_permitido": "Sí, USUARIO (solo cierre)",
    "descripcion_juridica": "Circunstancias de la sesión."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.convocante_nombre / convocante_cargo",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Trazabilidad de convocatoria."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.medio_convocatoria / fecha_convocatoria",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Evidencia de convocatoria."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.orden_del_dia_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Orden del día trazable."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.asistentes_*_resumen + Anexo 2 nominal",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Asistencia/representación/ausencia."
  },
  {
    "fuente": "MOTOR",
    "variable": "REUNION.quorum_descripcion",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Verificación de constitución."
  },
  {
    "fuente": "MOTOR",
    "variable": "REUNION.hay_conflictos / conflictos_declarados_resumen",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Gobernanza de abstenciones."
  },
  {
    "fuente": "MOTOR",
    "variable": "REUNION.pactos_parasociales_estado",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Señal de verificación de pactos."
  },
  {
    "fuente": "REUNION + MOTOR",
    "variable": "REUNION.punto_i.* + agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto, votación, proclamación y enlace a acto."
  },
  {
    "fuente": "REUNION + USUARIO",
    "variable": "REUNION.voto_calidad_aplicado / detalle",
    "obligatoria": "Opcional",
    "fallback_permitido": "Sí, vacío",
    "descripcion_juridica": "Solo si existe empate y regla aplicable."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.firma_secretario_ref / firma_presidente_ref / sello_tiempo_ref",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO (en demo)",
    "descripcion_juridica": "Referencias de firma/tiempo (demo)."
  }
]$capa2_04$::jsonb,
  $capa3_04$[
  {
    "campo": "anexo_2_lista_asistentes",
    "descripcion": "Lista nominal con presentes/representados/ausentes y poderes.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Exigir consistencia de representaciones y estado de cargo."
  },
  {
    "campo": "anexo_3_conflictos",
    "descripcion": "Detalle por punto de abstenciones y tratamiento de cómputo.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Si MOTOR marca conflicto, exigir este anexo."
  },
  {
    "campo": "texto_acuerdo_por_punto",
    "descripcion": "Redacción final de cada acuerdo.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Prohibir eliminar agreement_id ; control de anclaje a punto."
  },
  {
    "campo": "resultado_votacion_por_punto",
    "descripcion": "Votos por punto.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Total votos coherente con consejeros concurrentes y abstenciones."
  },
  {
    "campo": "deliberaciones_sintesis",
    "descripcion": "Síntesis de deliberaciones relevantes.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Longitud máxima; sin introducir nuevos acuerdos."
  },
  {
    "campo": "voto_calidad_detalle",
    "descripcion": "Detalle cuando se use voto de calidad.",
    "obligatoriedad": "OPCIONAL",
    "validacion_recomendada": "Solo permitido si bandera activada."
  },
  {
    "campo": "anexos_documentacion",
    "descripcion": "Índice de anexos por IDs del expediente.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "No permitir anexos “sin referencia”."
  }
]$capa3_04$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (consejo de administración: convocatoria, quórum, voto de calidad); estatutos; reglamento del consejo.',
  now(),
  now()
);

-- ============================================================
-- 05) CERTIFICACION / CERTIFICACION_ACUERDOS — bump 1.2.0 -> 1.3.0
-- Original UUID Cloud: ca3df363-139a-41aa-8c21-37c7a68bddc7
-- Versión Cloud actual ACTIVA: 1.2.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'CERTIFICACION',
  'CERTIFICACION_ACUERDOS',
  'ES',
  'DERIVADO_DEL_ACTO',
  NULL,
  '1.3.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_05$
CERTIFICACIÓN DE ACUERDOS SOCIALES — {{ENTIDAD.denominacion_social}}

Don/Doña {{CERTIFICACION.certificante_nombre}}, mayor de edad, con DNI/NIE/Pasaporte {{CERTIFICACION.certificante_iddoc}}, en su condición de {{CERTIFICACION.certificante_cargo}} de {{ENTIDAD.denominacion_social}}, con domicilio social en {{ENTIDAD.domicilio_social}} y NIF {{ENTIDAD.nif}}, certifica, a los efectos oportunos y a solicitud de {{EXPEDIENTE.solicitante_resumen}}, que:

I. Base de la certificación y órgano que adoptó el acuerdo

El/los acuerdo(s) que se certifica(n) consta(n) en {{CERTIFICACION.base_documental_tipo}}, identificado como {{CERTIFICACION.base_documental_ref}}, integrado en el expediente {{EXPEDIENTE.expediente_id}} del prototipo ARGA Governance Map, y fue(ron) adoptado(s) por {{CERTIFICACION.organo_adoptante_descripcion}} en fecha {{CERTIFICACION.fecha_adopcion}}.

A los efectos de esta certificación, el modo de adopción fue: {{CERTIFICACION.adoption_mode_origen}}. Si el modo de adopción es “MEETING”, se hace constar el sistema de aprobación del acta: {{CERTIFICACION.sistema_aprobacion_acta}}. Si el modo de adopción es “NO_SESSION”, se hace constar la fecha de cierre del procedimiento y la inexistencia de oposición cuando sea requisito interno: {{CERTIFICACION.fecha_cierre_no_session}}. Si el modo es unipersonal (socio único o administrador único), se hace constar la firma del decisor y la consignación correspondiente.

II. Facultades de certificación, cargo vigente y visto bueno (si procede)

El certificante manifiesta que su cargo se encuentra vigente a la fecha de expedición de la presente certificación y, cuando proceda para su eficacia registral, que el cargo consta inscrito o se inscribirá previa o simultáneamente conforme al carril registral del expediente. Si el certificante es secretario/a de órgano colegiado, la certificación se expide con el visto bueno de {{CERTIFICACION.visto_bueno_nombre}} en su condición de {{CERTIFICACION.visto_bueno_cargo}}.

III. Transcripción del acuerdo certificado y trazabilidad

Se certifica el siguiente acuerdo, con transcripción {{CERTIFICACION.transcripcion_modo}}:

“{{CERTIFICACION.texto_acuerdo_certificado}}”

Resultado y circunstancias relevantes para su calificación: {{CERTIFICACION.circunstancias_validez_resumen}}. Se hace constar, cuando resulte aplicable, el tratamiento de abstenciones, restricciones de voto o conflictos de interés conforme al expediente y a la base documental.

Trazabilidad del acto: agreement_id = {{CERTIFICACION.agreement_id}}.

IV. Manifestación de vigencia y no revocación

El certificante manifiesta que, según consta en el libro de actas / expediente base y en la información disponible en el prototipo, el acuerdo certificado no ha sido revocado, sustituido o dejado sin efecto por acuerdo posterior de órgano competente, salvo que expresamente se indique lo contrario en el propio expediente.

V. Destino y carácter demo-operativo

La presente certificación se expide en {{CERTIFICACION.lugar_expedicion}}, a {{CERTIFICACION.fecha_expedicion}}, como evidencia demo/operativa del prototipo ARGA Governance Map, sin constituir evidencia final productiva.

Firma del certificante: {{QTSP.firma_certificante_ref}} Visto bueno (si procede): {{QTSP.firma_visto_bueno_ref}} Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
$capa1_05$,
  $capa2_05$[
  {
    "fuente": "ORGANO + ENTIDAD",
    "variable": "CERTIFICACION.certificante_*",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identidad y cargo con facultad certificante según régimen de administración/órgano."
  },
  {
    "fuente": "ORGANO",
    "variable": "CERTIFICACION.visto_bueno_*",
    "obligatoria": "Condicional",
    "fallback_permitido": "Sí, USUARIO (solo demo)",
    "descripcion_juridica": "Solo si certifica secretario/a de órgano colegiado y procede VB."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.organo_adoptante_descripcion",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Junta / Consejo / Socio único / Admin único / Coaprobación / Solidario."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.adoption_mode_origen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "MEETING / NO_SESSION / UNIPERSONAL_* / CO_APROBACION / SOLIDARIO."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.base_documental_tipo / ref",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Acta, acta notarial, decisión consignada, expediente."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.fecha_adopcion",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Fecha de adopción."
  },
  {
    "fuente": "REUNION",
    "variable": "CERTIFICACION.sistema_aprobacion_acta",
    "obligatoria": "Condicional",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Solo para MEETING (aprobación en sesión o posterior)."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.fecha_cierre_no_session",
    "obligatoria": "Condicional",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Solo para NO_SESSION/CO_APROBACION/SOLIDARIO si se documenta cierre."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.texto_acuerdo_certificado",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto literal o extracto, gobernado por reglas."
  },
  {
    "fuente": "MOTOR",
    "variable": "CERTIFICACION.transcripcion_modo",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "“LITERAL” si estatutos/modificación estatutaria/inscribible lo exige."
  },
  {
    "fuente": "MOTOR",
    "variable": "CERTIFICACION.circunstancias_validez_resumen",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Quórum, votación, abstenciones si relevantes para calificación."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CERTIFICACION.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace al acto societario."
  },
  {
    "fuente": "USUARIO",
    "variable": "CERTIFICACION.lugar_expedicion / fecha_expedicion",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Circunstancias de emisión."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.*",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Firmas/sello de tiempo (demo)."
  }
]$capa2_05$::jsonb,
  $capa3_05$[
  {
    "campo": "circunstancias_validez",
    "descripcion": "Circunstancias del acta necesarias para calificación registral si inscribible.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Si requiere_salida_registral , exigir completitud mínima."
  },
  {
    "campo": "manifestacion_vigencia",
    "descripcion": "Ajustes si el acuerdo fue revocado/sustituido.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Si hay acuerdo posterior, obligar a indicarlo."
  },
  {
    "campo": "texto_acuerdo",
    "descripcion": "Texto certificado (literal/extracto) gobernado por el expediente.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Bloquear edición que rompa el hash interno del acuerdo en el expediente."
  }
]$capa3_05$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'RRM arts. 108-109 (elevación a público y facultad de certificar; visto bueno; cargos vigentes; prohibición de certificar sin acta aprobada/notarial); RRM supuestos especiales (acuerdos por correspondencia o sin sesión).',
  now(),
  now()
);

-- ============================================================
-- 06) INFORME_DOCUMENTAL_PRE / EXPEDIENTE_PRE — bump 1.0.1 -> 1.1.0
-- Original UUID Cloud: 438fa893-9704-48ee-91b3-9966e6f4df63
-- Versión Cloud actual ACTIVA: 1.0.1
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'INFORME_DOCUMENTAL_PRE',
  'EXPEDIENTE_PRE',
  'ES',
  'SOPORTE_INTERNO',
  NULL,
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_06$
INFORME DOCUMENTAL PREVIO — {{ENTIDAD.denominacion_social}} — Expediente {{EXPEDIENTE.expediente_id}}

Este documento es un informe de apoyo demo-operativo. No constituye acta, certificación, documento registral ni evidencia final productiva. Su finalidad es facilitar la revisión previa del expediente y dejar trazabilidad operativa de las comprobaciones realizadas.

I. Identificación y alcance. Entidad: {{ENTIDAD.denominacion_social}} ({{ENTIDAD.tipo_sociedad}}), NIF {{ENTIDAD.nif}}. Órgano/acto previsto: {{REUNION.organo_previsto}} / {{EXPEDIENTE.materia_prevista}}. Modalidad prevista: {{REUNION.adoption_mode_previsto}}.

II. Checklist documental. Se revisa la documentación requerida por materia y órgano, con el siguiente estado: {{EXPEDIENTE.checklist_estado_resumen}}. El índice detallado se adjunta como Anexo 1 (IDs de expediente).

III. Trazabilidad de reglas y alertas. Versión de reglas: {{MOTOR.ruleset_version}}. Snapshot: {{MOTOR.snapshot_hash}}. Resultado: {{MOTOR.resultado_resumen}}. Alertas activas: {{MOTOR.alertas_resumen}}.

IV. Observaciones operativas. {{USUARIO.observaciones_operativas}}.

Firmado electrónicamente en entorno demo-operativo por {{USUARIO.redactor_nombre}} en fecha {{USUARIO.fecha_emision}}. Referencias QTSP (si aplica): {{QTSP.sello_tiempo_ref}}.
$capa1_06$,
  $capa2_06$[
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.*",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificación entidad."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.expediente_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificador del caso."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.organo_previsto",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Órgano objetivo del acto."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.adoption_mode_previsto",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Modo previsto (MEETING/NO_SESSION/etc.)."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.materia_prevista",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Materia del acto."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.checklist_estado_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Resumen de documentación requerida/aportada/pendiente."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.checklist_detalle_ref",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "ID del índice de documentos."
  },
  {
    "fuente": "MOTOR",
    "variable": "MOTOR.ruleset_version / snapshot_hash / resultado_resumen / alertas_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Traza de evaluación."
  },
  {
    "fuente": "USUARIO",
    "variable": "USUARIO.redactor_nombre / fecha_emision / observaciones_operativas",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Emisión y observaciones."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.sello_tiempo_ref",
    "obligatoria": "Opcional",
    "fallback_permitido": "Sí, vacío",
    "descripcion_juridica": "Sello temporal demo."
  }
]$capa2_06$::jsonb,
  $capa3_06$[
  {
    "campo": "observaciones_operativas",
    "descripcion": "Observaciones del revisor legal.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Longitud máxima; prohibir afirmaciones “certificantes”."
  },
  {
    "campo": "checklist_detalle",
    "descripcion": "Tabla estructurada de documentos (ID, tipo, estado).",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "No admitir filas sin ID; estados normalizados."
  },
  {
    "campo": "alertas_detalle",
    "descripcion": "Desglose de alertas del motor.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Debe concordar con MOTOR.alertas_resumen ."
  }
]$capa3_06$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'Soporte interno del expediente: control de checklist y traza de evaluación motor; no constituye evidencia productiva.',
  now(),
  now()
);

-- ============================================================
-- 07) INFORME_PRECEPTIVO / CONVOCATORIA_PRE — bump 1.0.1 -> 1.1.0
-- Original UUID Cloud: 4c2644ec-474e-486e-9893-28b5167a6bfc
-- Versión Cloud actual ACTIVA: 1.0.1
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'INFORME_PRECEPTIVO',
  'CONVOCATORIA_PRE',
  'ES',
  'SOPORTE_INTERNO',
  NULL,
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_07$
INFORME PRECEPTIVO INTERNO PARA CONVOCATORIA — {{ENTIDAD.denominacion_social}} — Expediente {{EXPEDIENTE.expediente_id}}

Este documento es un informe de apoyo demo-operativo. No constituye acta, certificación, documento registral ni evidencia final productiva. Su finalidad es facilitar la revisión previa del expediente y dejar trazabilidad operativa de las comprobaciones realizadas.

I. Resumen de la convocatoria. Junta/Consejo: {{REUNION.organo_previsto}}. Tipo de junta: {{REUNION.tipo_junta_prevista}}. Fecha/hora/lugar/modalidad: {{REUNION.fecha}} / {{REUNION.hora}} / {{REUNION.lugar}} / {{REUNION.modalidad}}.

II. Orden del día y documentación asociada. Orden del día: {{REUNION.orden_del_dia_resumen}}. Repositorio y referencias: {{EXPEDIENTE.repositorio_documentacion_ref}} (Anexo 1).

III. Verificaciones de cumplimiento. Plazos y canales de convocatoria: {{MOTOR.verificacion_convocatoria_resumen}}. Derecho de información y documentación disponible: {{MOTOR.verificacion_info_resumen}}. Si ENTIDAD.es_cotizada = SÍ: verificaciones cotizadas: {{MOTOR.verificacion_cotizada_resumen}}.

IV. Alertas y recomendaciones. {{MOTOR.alertas_resumen}}. Recomendaciones operativas: {{USUARIO.recomendaciones}}.

Emitido por {{USUARIO.redactor_nombre}} en fecha {{USUARIO.fecha_emision}}. Sellado demo (si aplica): {{QTSP.sello_tiempo_ref}}.
$capa1_07$,
  $capa2_07$[
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.*",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificación."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.expediente_id / repositorio_documentacion_ref",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificador y repositorio."
  },
  {
    "fuente": "REUNION",
    "variable": "REUNION.organo_previsto / tipo_junta_prevista / fecha / hora / lugar / modalidad / orden_del_dia_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Parámetros de la convocatoria."
  },
  {
    "fuente": "MOTOR",
    "variable": "MOTOR.verificacion_convocatoria_resumen / verificacion_info_resumen / verificacion_cotizada_resumen / alertas_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Resultado de reglas."
  },
  {
    "fuente": "USUARIO",
    "variable": "USUARIO.redactor_nombre / fecha_emision / recomendaciones",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Emisión y recomendaciones."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.sello_tiempo_ref",
    "obligatoria": "Opcional",
    "fallback_permitido": "Sí, vacío",
    "descripcion_juridica": "Sello temporal demo."
  }
]$capa2_07$::jsonb,
  $capa3_07$[
  {
    "campo": "recomendaciones",
    "descripcion": "Recomendaciones operativas.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Prohibir lenguaje “validante” o “certificante”."
  },
  {
    "campo": "incidencias_previas",
    "descripcion": "Incidencias detectadas antes de convocar.",
    "obligatoriedad": "OPCIONAL",
    "validacion_recomendada": "Relacionar con IDs del expediente."
  },
  {
    "campo": "evidencias_convocatoria",
    "descripcion": "Tabla de evidencias de canal y plazos.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "No filas sin ID; timestamps consistentes."
  }
]$capa3_07$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'Soporte interno preceptivo previo a la convocatoria: verificación de canales, plazos y derecho de información.',
  now(),
  now()
);

-- ============================================================
-- 08) ACTA_ACUERDO_ESCRITO / ACUERDO_SIN_SESION — bump 1.2.0 -> 1.3.0
-- Original UUID Cloud: 1b1118a6-577d-45ed-96ee-77be89358aa0
-- Versión Cloud actual ACTIVA: 1.2.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_ACUERDO_ESCRITO',
  'ACUERDO_SIN_SESION',
  'ES',
  'JUNTA_GENERAL_O_CONSEJO',
  'NO_SESSION',
  '1.3.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_08$
ACTA DE ADOPCIÓN DE ACUERDO POR ESCRITO Y SIN SESIÓN — {{ENTIDAD.denominacion_social}}

En el marco del expediente {{EXPEDIENTE.expediente_id}}, se documenta la adopción por escrito y sin sesión del acuerdo identificado por agreement_id {{ACUERDO.agreement_id}}, conforme al carril {{ACUERDO.carril_tipo}} y al régimen interno aplicable.

Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva.

I. Identificación del órgano/decisores y regla de admisión del procedimiento

Si {{ACUERDO.carril_tipo}} es “CONSEJO_POR_ESCRITO”, se hace constar que el órgano competente es el Consejo de Administración y que la votación por escrito y sin sesión solo se admite si ningún consejero se opone a este procedimiento, según el régimen aplicable, circunstancia que se acredita en el expediente.

Si {{ACUERDO.carril_tipo}} es “SOCIOS_UNANIMIDAD_ESCRITA”, se hace constar que el acuerdo se adopta por los socios con el grado de unanimidad exigible por el régimen interno aplicable para acuerdos sin sesión, acreditándose en el expediente la identidad de todos los socios con derecho de voto, su porcentaje y su manifestación de voluntad.

II. Propuesta, circulación y recepción de respuestas

La propuesta de acuerdo fue emitida en fecha {{ACUERDO.fecha_propuesta}} y circulada mediante {{ACUERDO.medio_circulacion}} a {{ACUERDO.destinatarios_resumen}}. La recepción de respuestas se produjo entre {{ACUERDO.fecha_inicio_respuestas}} y {{ACUERDO.fecha_cierre}}, constando en el expediente la identidad del respondiente, su sentido de voto y, en su caso, observaciones o reservas.

Si {{ACUERDO.hay_oposicion_procedimiento}} es “SÍ”, se hace constar que el procedimiento por escrito y sin sesión no resulta admisible y que el expediente debe reconducirse a sesión (MEETING) u otro carril aplicable. Si es “NO”, se declara válidamente cerrado el procedimiento en fecha {{ACUERDO.fecha_cierre}}.

III. Conflictos de interés y pactos parasociales

Se deja constancia de {{ACUERDO.conflictos_resumen}} y de {{ACUERDO.pactos_estado}}. Cuando exista abstención, exclusión de cómputo o restricción de voto, el expediente incorpora el tratamiento aplicado por punto y su impacto en el resultado, sin aplanar reglas.

IV. Texto del acuerdo y resultado

El acuerdo adoptado es el siguiente:

“{{ACUERDO.texto_acuerdo}}”

El resultado, en términos de sentido de voto y denominadores aplicables, es {{ACUERDO.resultado_resumen}}. Se hace constar que el acuerdo queda adoptado en la fecha de cierre {{ACUERDO.fecha_cierre}}.

Trazabilidad del acto: agreement_id = {{ACUERDO.agreement_id}}.

V. Consignación y firmas

La presente acta se consigna en el expediente y, cuando aplique, se incorporará al libro correspondiente. Firman {{ACUERDO.firmantes_resumen}}.

Firmas (referencias): {{QTSP.firmas_ref_resumen}} Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
$capa1_08$,
  $capa2_08$[
  {
    "fuente": "EXPEDIENTE",
    "variable": "ACUERDO.carril_tipo",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "“CONSEJO_POR_ESCRITO” o “SOCIOS_UNANIMIDAD_ESCRITA”."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "ACUERDO.fecha_propuesta / medio_circulacion",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Evidencia de circulación."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "ACUERDO.destinatarios_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Quién debía responder."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "ACUERDO.fecha_inicio_respuestas / fecha_cierre",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Ventana y cierre."
  },
  {
    "fuente": "MOTOR",
    "variable": "ACUERDO.hay_oposicion_procedimiento",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Control crítico en consejo por escrito."
  },
  {
    "fuente": "MOTOR",
    "variable": "ACUERDO.conflictos_resumen / pactos_estado",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Señales y resumen."
  },
  {
    "fuente": "EXPEDIENTE + USUARIO",
    "variable": "ACUERDO.texto_acuerdo",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto dispositivo."
  },
  {
    "fuente": "MOTOR",
    "variable": "ACUERDO.resultado_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Resultado computado con reglas."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "ACUERDO.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.*",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Firmas/sello demo."
  }
]$capa2_08$::jsonb,
  $capa3_08$[
  {
    "campo": "tabla_respuestas",
    "descripcion": "Tabla estructurada de respuestas (quién, cuándo, sentido, observaciones).",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Bloquear edición que desincronice con evidencias de firma."
  },
  {
    "campo": "texto_acuerdo",
    "descripcion": "Texto final.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Control de cambios y anclaje a agreement_id ."
  },
  {
    "campo": "nota_conflictos",
    "descripcion": "Nota si hay abstenciones/restricciones.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Obligatorio si MOTOR marca conflicto."
  }
]$capa3_08$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'RRM (supuestos especiales: acuerdos por correspondencia/medios auténticos; acuerdos órgano administración por escrito y sin sesión y ausencia de oposición).',
  now(),
  now()
);

-- ============================================================
-- 09) ACTA_CONSIGNACION / DECISION_SOCIO_UNICO — bump 1.1.0 -> 1.2.0
-- Original UUID Cloud: 6f43fcce-4893-4636-b1d2-551ba6db92fb
-- Versión Cloud actual ACTIVA: 1.1.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_CONSIGNACION',
  'DECISION_SOCIO_UNICO',
  'ES',
  'SOCIO_UNICO',
  'UNIPERSONAL_SOCIO',
  '1.2.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_09$
ACTA DE DECISIONES DEL SOCIO ÚNICO DE {{ENTIDAD.denominacion_social}} ({{ENTIDAD.tipo_sociedad_unipersonal}})

En {{DECISION.lugar}}, a {{DECISION.fecha}}, el socio único de {{ENTIDAD.denominacion_social}}, Don/Doña {{SOCIO_UNICO.nombre}} con documento {{SOCIO_UNICO.iddoc}}, titular del 100% del capital social y de la totalidad de los derechos de voto, ejerce las competencias de la Junta General y adopta la siguiente decisión, que se consigna en acta bajo su firma.

Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva.

I. Antecedentes, pactos y conflictos

El socio único manifiesta que conoce y, en su caso, ha tenido en cuenta los pactos parasociales o reglas internas relevantes identificados en el expediente como {{DECISION.pactos_estado}}. Si el expediente identifica conflicto de interés o restricción de voto como {{DECISION.conflictos_estado}}, se deja constancia del tratamiento aplicable sin aplanar reglas.

II. Decisión

El socio único acuerda lo siguiente:

“{{DECISION.texto_decision}}”

Trazabilidad del acto: agreement_id = {{DECISION.agreement_id}}.

III. Consignación, ejecución y salida documental

La presente decisión se consigna en el libro de actas / expediente del prototipo bajo el identificador {{EXPEDIENTE.expediente_id}}. Cuando proceda elevación a público o inscripción, se emitirá la certificación correspondiente y se seguirá el carril documental del expediente.

En {{DECISION.lugar}}, a {{DECISION.fecha}}.

Firma del socio único: {{QTSP.firma_socio_unico_ref}} Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
$capa1_09$,
  $capa2_09$[
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.* + tipo_sociedad_unipersonal",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificación y SLU/SAU."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "SOCIO_UNICO.*",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identidad socio único."
  },
  {
    "fuente": "USUARIO",
    "variable": "DECISION.lugar/fecha",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Circunstancias."
  },
  {
    "fuente": "USUARIO",
    "variable": "DECISION.texto_decision",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto dispositivo."
  },
  {
    "fuente": "MOTOR",
    "variable": "DECISION.pactos_estado / conflictos_estado",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Flags de revisión."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "DECISION.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.expediente_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificador del caso."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.*",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Firma/sello demo."
  }
]$capa2_09$::jsonb,
  $capa3_09$[
  {
    "campo": "texto_decision",
    "descripcion": "Redacción final de la decisión.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Prohibir omitir agreement_id y exigir objeto claro."
  },
  {
    "campo": "pactos_y_conflictos_nota",
    "descripcion": "Nota si hay pactos/conflictos relevantes.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Si MOTOR marca “relevante”, exigir nota."
  },
  {
    "campo": "anexos",
    "descripcion": "Índice de anexos por IDs.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "No anexos sin ID."
  }
]$capa3_09$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC art. 15 (decisiones socio único en acta bajo su firma); RRM (certificación/elevación a público de decisiones de socio único).',
  now(),
  now()
);

-- ============================================================
-- 10) ACTA_CONSIGNACION / DECISION_ADMIN_UNICO — bump 1.1.0 -> 1.2.0
-- Original UUID Cloud: 56bcbb33-b603-4025-9393-c5ad84ba3808
-- Versión Cloud actual ACTIVA: 1.1.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_CONSIGNACION',
  'DECISION_ADMIN_UNICO',
  'ES',
  'ADMIN_UNICO',
  'UNIPERSONAL_ADMIN',
  '1.2.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_10$
ACTA DE DECISIONES DEL ADMINISTRADOR ÚNICO DE {{ENTIDAD.denominacion_social}}

En {{DECISION.lugar}}, a {{DECISION.fecha}}, Don/Doña {{ADMIN.nombre}}, con documento {{ADMIN.iddoc}}, en su condición de Administrador Único de {{ENTIDAD.denominacion_social}}, adopta, dentro del ámbito de sus competencias y sin invadir competencias reservadas a la Junta General, la siguiente decisión, que se consigna en el expediente y, cuando aplique, en el libro correspondiente.

Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva.

I. Conflictos de interés, pactos y deber de abstención

El administrador declara {{DECISION.conflictos_declaracion_resumen}}. Si el expediente identifica conflicto de interés, operación vinculada o pacto parasocial relevante, se deja constancia del tratamiento aplicable y, si procede, de la elevación del asunto al órgano competente, sin aplanar reglas.

II. Decisión

“{{DECISION.texto_decision}}”

Trazabilidad del acto: agreement_id = {{DECISION.agreement_id}}.

III. Consignación, comunicación interna y salida documental

La presente decisión se consigna en el expediente {{EXPEDIENTE.expediente_id}}. Si la decisión debe comunicarse a otros administradores o a comisiones internas por razones de gobierno corporativo, se deja constancia de {{DECISION.comunicacion_interna_detalle}}. Si procede elevación a público o inscripción, se emitirá certificación o documento de salida conforme al carril del expediente.

Firma del Administrador Único: {{QTSP.firma_admin_ref}} Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
$capa1_10$,
  $capa2_10$[
  {
    "fuente": "ORGANO",
    "variable": "ADMIN.*",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identidad y cargo vigente."
  },
  {
    "fuente": "USUARIO",
    "variable": "DECISION.lugar/fecha",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Circunstancias."
  },
  {
    "fuente": "USUARIO",
    "variable": "DECISION.texto_decision",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto dispositivo."
  },
  {
    "fuente": "USUARIO + MOTOR",
    "variable": "DECISION.conflictos_declaracion_resumen",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Declaración y flags."
  },
  {
    "fuente": "USUARIO",
    "variable": "DECISION.comunicacion_interna_detalle",
    "obligatoria": "Opcional",
    "fallback_permitido": "Sí, vacío",
    "descripcion_juridica": "Comunicación interna."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "DECISION.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "EXPEDIENTE.expediente_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identificador."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.*",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Firma/sello demo."
  }
]$capa2_10$::jsonb,
  $capa3_10$[
  {
    "campo": "texto_decision",
    "descripcion": "Redacción final.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Validar que no sea materia reservada a junta sin carril."
  },
  {
    "campo": "comunicacion_interna",
    "descripcion": "Nota de comunicación a otros órganos.",
    "obligatoriedad": "OPCIONAL",
    "validacion_recomendada": "Si ENTIDAD.es_cotizada , sugerir recomendado."
  },
  {
    "campo": "nota_conflictos",
    "descripcion": "Nota específica si hay conflicto.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Si MOTOR marca conflicto, exigir nota."
  }
]$capa3_10$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (decisiones del administrador único); RRM (certificación/elevación a público de decisiones del administrador único).',
  now(),
  now()
);

-- ============================================================
-- 11) ACTA_DECISION_CONJUNTA / CO_APROBACION — bump 1.0.0 -> 1.1.0
-- Original UUID Cloud: 1e3b82a7-fffc-4a72-8851-b1e0f1649093
-- Versión Cloud actual ACTIVA: 1.0.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_DECISION_CONJUNTA',
  'CO_APROBACION',
  'ES',
  'ADMIN_CONJUNTA_O_COAPROBADORES',
  'CO_APROBACION',
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_11$
ACTA DE DECISIÓN CONJUNTA (COAPROBACIÓN) — {{ENTIDAD.denominacion_social}}

En el expediente {{EXPEDIENTE.expediente_id}}, y conforme al régimen de actuación conjunta / coaprobación aplicable a la administración de la Sociedad, se documenta la adopción de la decisión identificada por agreement_id {{COAP.agreement_id}}.

Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva.

I. Identidad de coaprobadores y regla de actuación conjunta

Son coaprobadores requeridos para la válida adopción de la presente decisión: {{COAP.coaprobadores_resumen}}, con cargo vigente {{COAP.cargos_resumen}}. Se hace constar que la regla aplicable de actuación conjunta es {{COAP.regla_actuacion_conjunta_descripcion}}, conforme a estatutos y/o pacto aplicable identificado en el expediente, y que dicha regla exige la manifestación concurrente de voluntad de todos los coaprobadores indicados (o del subconjunto exigible según regla), sin aplanar ni sustituir el régimen aplicable.

II. Propuesta, manifestaciones de voluntad y cierre

La propuesta de decisión fue emitida en fecha {{COAP.fecha_propuesta}} y puesta a disposición de los coaprobadores mediante {{COAP.medio_circulacion}}. Cada coaprobador ha manifestado su voluntad de manera fehaciente conforme al expediente, con las siguientes referencias de firma o aceptación: {{COAP.evidencias_manifestacion_resumen}}.

La decisión queda adoptada en la fecha de cierre {{COAP.fecha_cierre}}, una vez constatado por el motor del expediente que se cumplen los requisitos de coaprobación, incluido el número y calidad de aprobaciones requeridas y la inexistencia de impedimentos por conflicto o restricción de actuación.

III. Conflictos de interés y pactos parasociales

Se deja constancia de {{COAP.conflictos_resumen}} y de {{COAP.pactos_estado}}. Cuando exista conflicto o restricción que afecte a alguno de los coaprobadores, el expediente debe reflejar su tratamiento (abstención, sustitución o elevación al órgano competente) y su efecto en la validez del acuerdo, sin que el presente documento aplane la regla aplicable.

IV. Acuerdo / decisión adoptada

“{{COAP.texto_decision}}”

Trazabilidad del acto: agreement_id = {{COAP.agreement_id}}.

V. Snapshot del motor y trazabilidad técnica-jurídica

Se incorpora al expediente el snapshot de evaluación del motor en los siguientes términos: hash {{MOTOR.snapshot_hash}}, versión de reglas {{MOTOR.ruleset_version}}, y resultado {{MOTOR.resultado_resumen}}, sin perjuicio de los anexos técnicos del expediente.

VI. Firmas

Firman los coaprobadores requeridos con las siguientes referencias: {{QTSP.firmas_ref_resumen}}. Se incorpora sello de tiempo si aplica: {{QTSP.sello_tiempo_ref}}.
$capa1_11$,
  $capa2_11$[
  {
    "fuente": "ORGANO",
    "variable": "COAP.coaprobadores_resumen + detalle nominal",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identidad completa de quienes deben coaprobar."
  },
  {
    "fuente": "MOTOR + ORGANO",
    "variable": "COAP.regla_actuacion_conjunta_descripcion",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Regla estatutaria/pactada aplicable."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "COAP.fecha_propuesta / medio_circulacion",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Inicio del procedimiento."
  },
  {
    "fuente": "EXPEDIENTE + QTSP",
    "variable": "COAP.evidencias_manifestacion_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Evidencias por coaprobador."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "COAP.fecha_cierre",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Fecha de adopción."
  },
  {
    "fuente": "MOTOR",
    "variable": "COAP.conflictos_resumen / pactos_estado",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Señales y resumen."
  },
  {
    "fuente": "USUARIO",
    "variable": "COAP.texto_decision",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto dispositivo."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "COAP.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace."
  },
  {
    "fuente": "MOTOR",
    "variable": "MOTOR.snapshot_hash / ruleset_version / resultado_resumen",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Trazabilidad de evaluación."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.*",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Firmas/sello demo."
  }
]$capa2_11$::jsonb,
  $capa3_11$[
  {
    "campo": "texto_decision",
    "descripcion": "Redacción final.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Control de cambios; anclaje a agreement_id ."
  },
  {
    "campo": "anexo_conflictos",
    "descripcion": "Detalle si existen conflictos.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Obligatorio si MOTOR marca conflicto."
  },
  {
    "campo": "anexo_pacto_extracto",
    "descripcion": "Extracto mínimo del pacto si necesario.",
    "obligatoriedad": "OPCIONAL",
    "validacion_recomendada": "Solo permitir si “necesario” y con ID."
  }
]$capa3_11$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (administración conjunta / coaprobadores); estatutos/pacto aplicable.',
  now(),
  now()
);

-- ============================================================
-- 12) ACTA_ORGANO_ADMIN / ADMIN_SOLIDARIO — bump 1.0.0 -> 1.1.0
-- Original UUID Cloud: b2409fb5-eb14-480b-89f4-66c72f1cbc5d
-- Versión Cloud actual ACTIVA: 1.0.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ACTA_ORGANO_ADMIN',
  'ADMIN_SOLIDARIO',
  'ES',
  'ADMIN_SOLIDARIOS',
  'SOLIDARIO',
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_12$
ACTA DE ACTUACIÓN / DECISIÓN DE ADMINISTRADOR SOLIDARIO — {{ENTIDAD.denominacion_social}}

En {{ACTO.lugar}}, a {{ACTO.fecha}}, Don/Doña {{ADMIN_SOLIDARIO.nombre}}, con documento {{ADMIN_SOLIDARIO.iddoc}}, en su condición de Administrador Solidario de {{ENTIDAD.denominacion_social}}, adopta o documenta la siguiente actuación/decisión dentro del ámbito de sus facultades de representación y administración, conforme al régimen estatutario de actuación solidaria.

Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva.

I. Base estatutaria del régimen solidario y competencia

El administrador actuante declara que la Sociedad se encuentra administrada bajo régimen de administradores solidarios y que, conforme a estatutos, cada administrador puede actuar por sí solo en los términos y límites aplicables, sin perjuicio de las materias reservadas a Junta General u otros límites legales o internos. Se hace constar que el acto documentado no invade competencias reservadas a junta: {{ACTO.no_invasion_competencia_junta_declaracion}}.

II. Conflictos de interés y pactos parasociales

Se deja constancia de {{ACTO.conflictos_resumen}} y de {{ACTO.pactos_estado}}. Si existe conflicto relevante o parte vinculada, el expediente debe reflejar el carril de autorización o dispensa aplicable y, si procede, la elevación al órgano competente.

III. Actuación / decisión

“{{ACTO.texto_decision}}”

Trazabilidad del acto: agreement_id = {{ACTO.agreement_id}}.

IV. Comunicación interna (si procede)

Si por razones de gobierno corporativo o por exigencia estatutaria se requiere comunicación a otros administradores solidarios, se deja constancia de que se realizará o se ha realizado comunicación por {{ACTO.canal_comunicacion}} en fecha {{ACTO.fecha_comunicacion}}, con referencia {{ACTO.ref_comunicacion}}.

V. Firma

Firma del administrador solidario actuante: {{QTSP.firma_admin_solidario_ref}} Sello de tiempo (si aplica): {{QTSP.sello_tiempo_ref}}
$capa1_12$,
  $capa2_12$[
  {
    "fuente": "ORGANO",
    "variable": "ADMIN_SOLIDARIO.*",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Identidad y cargo vigente."
  },
  {
    "fuente": "USUARIO",
    "variable": "ACTO.lugar/fecha",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Circunstancias."
  },
  {
    "fuente": "USUARIO",
    "variable": "ACTO.no_invasion_competencia_junta_declaracion",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Salvaguarda de competencia."
  },
  {
    "fuente": "MOTOR",
    "variable": "ACTO.conflictos_resumen / pactos_estado",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Señales y resumen."
  },
  {
    "fuente": "USUARIO",
    "variable": "ACTO.texto_decision",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto dispositivo."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "ACTO.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace."
  },
  {
    "fuente": "EXPEDIENTE + USUARIO",
    "variable": "ACTO.canal_comunicacion / fecha_comunicacion / ref_comunicacion",
    "obligatoria": "Opcional",
    "fallback_permitido": "Sí, vacío",
    "descripcion_juridica": "Trazabilidad de comunicación interna."
  },
  {
    "fuente": "QTSP",
    "variable": "QTSP.*",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Firma/sello demo."
  }
]$capa2_12$::jsonb,
  $capa3_12$[
  {
    "campo": "texto_decision",
    "descripcion": "Redacción final.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Validar que no sea materia de junta sin carril."
  },
  {
    "campo": "comunicacion_interna",
    "descripcion": "Nota de comunicación.",
    "obligatoriedad": "OPCIONAL",
    "validacion_recomendada": "Si estatutos lo exigen, pasar a recomendado/obligatorio por MOTOR."
  },
  {
    "campo": "nota_conflictos",
    "descripcion": "Nota de conflicto si aplica.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Obligatorio si MOTOR marca conflicto."
  }
]$capa3_12$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (administradores solidarios); estatutos sociales.',
  now(),
  now()
);

-- ============================================================
-- 13) MODELO_ACUERDO / APROBACION_CUENTAS — bump 1.0.0 -> 1.1.0
-- Original UUID Cloud: affa4219-9b3d-4ded-8c5a-2ed304738c4f
-- Versión Cloud actual ACTIVA: 1.0.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'APROBACION_CUENTAS',
  'ES',
  'JUNTA_GENERAL',
  'MEETING',
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_13$
ACUERDO DE LA JUNTA GENERAL DE {{ENTIDAD.denominacion_social}} SOBRE APROBACIÓN DE CUENTAS, GESTIÓN SOCIAL Y APLICACIÓN DEL RESULTADO CORRESPONDIENTE AL EJERCICIO {{CUENTAS.ejercicio}}

La Junta General de {{ENTIDAD.denominacion_social}}, válidamente constituida en fecha {{REUNION.fecha}}, adopta por mayoría suficiente el siguiente acuerdo:

- Aprobar las cuentas anuales de la Sociedad correspondientes al ejercicio {{CUENTAS.ejercicio}}, integradas por balance, cuenta de pérdidas y ganancias, estado de cambios en el patrimonio neto, estado de flujos de efectivo (si procede) y memoria, así como, en su caso, las cuentas consolidadas, todo ello según documentos incorporados al expediente.
- Aprobar la gestión del órgano de administración correspondiente al ejercicio {{CUENTAS.ejercicio}}.
- Aprobar la aplicación del resultado en los siguientes términos: {{CUENTAS.aplicacion_resultado_texto}}.
Se faculta a {{CERTIFICACION.certificante_cargo_abrev}} para emitir certificación y realizar cuantos actos sean precisos para el depósito de cuentas y, en su caso, para la publicación o trámites que resulten aplicables.

Trazabilidad del acuerdo: agreement_id = {{CUENTAS.agreement_id}}. Carácter demo/operativo (no evidencia final productiva).

Si ENTIDAD.es_cotizada = SÍ: se deja constancia de la difusión/soportes aplicables a la entidad cotizada en el expediente.
$capa1_13$,
  $capa2_13$[
  {
    "fuente": "ENTIDAD",
    "variable": "CUENTAS.ejercicio",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Ejercicio de las cuentas."
  },
  {
    "fuente": "USUARIO",
    "variable": "CUENTAS.aplicacion_resultado_texto",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Texto íntegro de aplicación del resultado."
  },
  {
    "fuente": "EXPEDIENTE",
    "variable": "CUENTAS.agreement_id",
    "obligatoria": "Sí",
    "fallback_permitido": "No",
    "descripcion_juridica": "Enlace del acuerdo."
  },
  {
    "fuente": "ORGANO",
    "variable": "CERTIFICACION.certificante_cargo_abrev",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Cargo habilitado para certificación."
  },
  {
    "fuente": "ENTIDAD",
    "variable": "ENTIDAD.es_cotizada",
    "obligatoria": "Recomendado",
    "fallback_permitido": "Sí, USUARIO",
    "descripcion_juridica": "Activa cláusulas de difusión."
  }
]$capa2_13$::jsonb,
  $capa3_13$[
  {
    "campo": "aplicacion_resultado_desglose",
    "descripcion": "Desglose a reservas/dividendos/compensación pérdidas.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "Sumas coherentes con resultado."
  },
  {
    "campo": "auditoria_estado",
    "descripcion": "Auditada / no auditada; opinión.",
    "obligatoriedad": "RECOMENDADO",
    "validacion_recomendada": "Adjuntar informe si procede."
  },
  {
    "campo": "anexos_cuentas",
    "descripcion": "IDs de documentos de cuentas e informe de gestión.",
    "obligatoriedad": "OBLIGATORIO",
    "validacion_recomendada": "No permitir sin IDs."
  }
]$capa3_13$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (cuentas anuales, aplicación del resultado, gestión social) y RRM (depósito).',
  now(),
  now()
);

-- ============================================================
-- 14) MODELO_ACUERDO / FORMULACION_CUENTAS — bump 1.0.0 -> 1.1.0
-- Original UUID Cloud: 389b0205-8639-49a6-aa5c-777413ea8471
-- Versión Cloud actual ACTIVA: 1.0.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'FORMULACION_CUENTAS',
  'ES',
  'ORGANO_ADMIN',
  'MEETING',
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_14$
ACUERDO DEL ÓRGANO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} DE FORMULACIÓN DE CUENTAS DEL EJERCICIO {{CUENTAS.ejercicio}}

El órgano de administración formula las cuentas anuales del ejercicio {{CUENTAS.ejercicio}}, integradas por los documentos exigidos legalmente, que se incorporan al expediente con IDs {{CUENTAS.documentos_ref}}. Se aprueba igualmente el informe de gestión (si procede) y se acuerda la puesta a disposición de la Junta General para su aprobación en tiempo y forma.

Trazabilidad: agreement_id = {{CUENTAS.agreement_id}}. Carácter demo/operativo.
$capa1_14$,
  $capa2_14$[
  {
    "fuente": "ENTIDAD",
    "fallback": "No",
    "variable": "CUENTAS.ejercicio",
    "obligatoria": "Sí",
    "descripcion_juridica": "Ejercicio formulado."
  },
  {
    "fuente": "EXPEDIENTE",
    "fallback": "No",
    "variable": "CUENTAS.documentos_ref",
    "obligatoria": "Sí",
    "descripcion_juridica": "IDs de documentos de cuentas."
  },
  {
    "fuente": "EXPEDIENTE",
    "fallback": "No",
    "variable": "CUENTAS.agreement_id",
    "obligatoria": "Sí",
    "descripcion_juridica": "Enlace."
  }
]$capa2_14$::jsonb,
  $capa3_14$[
  {
    "campo": "firmas_administradores",
    "validacion": "Consistencia con órgano y cargos.",
    "descripcion": "Relación de firmantes y estado de firma.",
    "obligatoriedad": "OBLIGATORIO"
  }
]$capa3_14$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (formulación de cuentas por el órgano de administración).',
  now(),
  now()
);

-- ============================================================
-- 15) MODELO_ACUERDO / DELEGACION_FACULTADES — bump 1.0.0 -> 1.1.0
-- Original UUID Cloud: 0b1beb86-5a19-45ba-8d0c-68e176844ac2
-- Versión Cloud actual ACTIVA: 1.0.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'DELEGACION_FACULTADES',
  'ES',
  'CONSEJO_ADMIN',
  'MEETING',
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_15$
ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} DE DELEGACIÓN DE FACULTADES

El Consejo acuerda, con el quórum y mayoría reforzada aplicables, delegar las facultades descritas en el Anexo 1 en la figura de {{DELEGACION.modalidad}} (CONSEJERO_DELEGADO o COMISION_EJECUTIVA), con el alcance, límites, régimen de actuación y control que se detallan en dicho anexo. Quedan excluidas las facultades legal o estatutariamente indelegables.

Se faculta al secretario del Consejo, con el visto bueno del presidente, para expedir certificación y elevar a público este acuerdo a efectos de su inscripción. Trazabilidad: agreement_id = {{DELEGACION.agreement_id}}. Carácter demo/operativo.
$capa1_15$,
  $capa2_15$[
  {
    "fuente": "USUARIO",
    "fallback": "No",
    "variable": "DELEGACION.modalidad",
    "descripcion": "CD o Comisión Ejecutiva.",
    "obligatoria": "Sí"
  },
  {
    "fuente": "USUARIO",
    "fallback": "No",
    "variable": "DELEGACION.facultades_texto",
    "descripcion": "Texto íntegro del alcance y límites.",
    "obligatoria": "Sí"
  },
  {
    "fuente": "EXPEDIENTE",
    "fallback": "No",
    "variable": "DELEGACION.agreement_id",
    "descripcion": "Enlace.",
    "obligatoria": "Sí"
  }
]$capa2_15$::jsonb,
  $capa3_15$[
  {
    "campo": "anexo_facultades",
    "validacion": "Verificar que no incluye indelegables.",
    "descripcion": "Texto íntegro de facultades delegadas.",
    "obligatoriedad": "OBLIGATORIO"
  },
  {
    "campo": "quorum_reforzado",
    "validacion": "Reglas de consistencia del órgano.",
    "descripcion": "Constancia de quórum y mayoría aplicada.",
    "obligatoriedad": "OBLIGATORIO"
  }
]$capa3_15$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (delegación de facultades del consejo, indelegables, mayorías reforzadas); RRM (inscripción).',
  now(),
  now()
);

-- ============================================================
-- 16) MODELO_ACUERDO / OPERACION_VINCULADA — bump 1.0.0 -> 1.1.0
-- Original UUID Cloud: 73669c41-0c1e-4616-bfc6-ca9b67277623
-- Versión Cloud actual ACTIVA: 1.0.0
-- Estado del contenido: Contenido Capa 1 conservado de la versión Cloud actual. Mejoras estructurales del paquete legal aplicarán en revisión separada cuando el equipo legal entregue texto completo para esta plantilla.
-- ============================================================

INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia, jurisdiccion, organo_tipo, adoption_mode,
  version, estado,
  capa1_inmutable, capa2_variables, capa3_editables,
  aprobada_por, fecha_aprobacion, referencia_legal,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'OPERACION_VINCULADA',
  'ES',
  'CONSEJO_ADMIN',
  'MEETING',
  '1.1.0',
  'BORRADOR',  -- nueva versión empieza en BORRADOR; promover a ACTIVA tras revisión separada.
  $capa1_16$
ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} SOBRE OPERACIÓN VINCULADA CON {{OV.parte_vinculada_nombre}}

El Consejo, previa identificación de la parte vinculada y de la naturaleza de la vinculación, aprueba la operación descrita en el Anexo 1, con justificación de interés social y referencia al soporte de mercado/razonabilidad incorporado al expediente. El consejero afectado se abstiene de deliberar y votar; su abstención y el tratamiento del cómputo se documentan en el anexo de conflictos. Si el expediente determina umbral o régimen que exige aprobación por Junta, este acuerdo se condiciona a dicha aprobación.

Trazabilidad: agreement_id = {{OV.agreement_id}}. Carácter demo/operativo.
$capa1_16$,
  $capa2_16$[
  {
    "fuente": "EXPEDIENTE",
    "fallback": "No",
    "variable": "OV.parte_vinculada_nombre / tipo_vinculacion",
    "descripcion": "Identificación y naturaleza.",
    "obligatoria": "Sí"
  },
  {
    "fuente": "USUARIO",
    "fallback": "No",
    "variable": "OV.condiciones_esenciales",
    "descripcion": "Precio/valoración/otras condiciones.",
    "obligatoria": "Sí"
  },
  {
    "fuente": "EXPEDIENTE",
    "fallback": "No",
    "variable": "OV.soporte_mercado_ref",
    "descripcion": "ID de valoración/informe.",
    "obligatoria": "Sí"
  },
  {
    "fuente": "EXPEDIENTE",
    "fallback": "No",
    "variable": "OV.agreement_id",
    "descripcion": "Enlace.",
    "obligatoria": "Sí"
  }
]$capa2_16$::jsonb,
  $capa3_16$[
  {
    "campo": "anexo_operacion",
    "validacion": "IDs coherentes; no texto libre sin soporte.",
    "descripcion": "Términos esenciales de la operación.",
    "obligatoriedad": "OBLIGATORIO"
  },
  {
    "campo": "anexo_conflictos",
    "validacion": "Bloqueante si falta con parte vinculada.",
    "descripcion": "Abstenciones y tratamiento de cómputo.",
    "obligatoriedad": "OBLIGATORIO"
  }
]$capa3_16$::jsonb,
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
  '2026-05-02',
  'LSC (operaciones vinculadas, deber de evitar el conflicto, abstención); reglamento del consejo y matriz de conflicto.',
  now(),
  now()
);

COMMIT;

-- =============================================================================
-- Verificación post-aplicación (ejecutar en sesión SEPARADA tras COMMIT):
-- =============================================================================

SELECT id, tipo, materia, version, estado, aprobada_por, fecha_aprobacion
FROM plantillas_protegidas
WHERE estado = 'BORRADOR'
  AND fecha_aprobacion = '2026-05-02'
  AND aprobada_por LIKE 'Comité Legal ARGA%'
ORDER BY tipo, materia;
-- Debe devolver 16 filas, una por cada plantilla nueva.
