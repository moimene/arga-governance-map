-- Secretaria 360 - estabilizacion integral de rule packs y Matter Registry.
--
-- Alcance:
-- - Cierra gaps sustantivos con rule pack activo pero sin plantilla/binding.
-- - Archiva NOMBRAMIENTO_CESE como materia agregada no ejecutable.
-- - Incorpora materias SL/Consejo criticas con catalogo + rule pack +
--   plantilla + binding.
-- - Normaliza bindings legacy de CONSEJO a CONSEJO_ADMIN para que el
--   registry resuelva contra organos canonicos de UI/plantillas.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Catalogo juridico minimo para materias operativas.
-- ---------------------------------------------------------------------------

INSERT INTO public.materia_catalog (
  materia,
  materia_label_es,
  requires_notary,
  requires_registry,
  inscribable,
  matter_class,
  min_majority_code,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
)
VALUES
  ('APLICACION_RESULTADO', 'Aplicacion del resultado', false, false, false, 'ORDINARIA', 'SIMPLE', false, null, 'arts. 273 y 274 LSC'),
  ('APROBACION_PRESUPUESTO', 'Aprobacion del presupuesto anual', false, false, false, 'ORDINARIA', 'SIMPLE', false, null, 'arts. 225, 245 y 247 LSC'),
  ('AUTORIZACION_GARANTIA', 'Autorizacion de garantia o aval', false, false, false, 'ESPECIAL', 'SIMPLE', false, null, 'arts. 160.f y 162 LSC'),
  ('CUENTAS_CONSOLIDADAS', 'Formulacion de cuentas consolidadas', false, false, false, 'ORDINARIA', 'SIMPLE', false, null, 'arts. 253, 262 y 279 LSC'),
  ('DIVIDENDO_A_CUENTA', 'Distribucion de dividendo a cuenta', false, true, false, 'ORDINARIA', 'SIMPLE', false, null, 'art. 277 LSC'),
  ('EJECUCION_AUMENTO_DELEGADO', 'Ejecucion de aumento de capital delegado', true, true, true, 'ESTATUTARIA', 'SIMPLE', true, 30, 'art. 297 LSC'),
  ('SUPRESION_PREFERENTE', 'Supresion del derecho de suscripcion preferente', true, true, true, 'ESTATUTARIA', 'REFORZADA_2_3', true, 30, 'art. 308 LSC'),
  ('EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE', 'Exclusion del derecho de suscripcion preferente', true, true, true, 'ESTATUTARIA', 'REFORZADA_2_3', true, 30, 'art. 308 LSC'),
  ('TRASLADO_DOMICILIO_NACIONAL', 'Traslado de domicilio social dentro de Espana', true, true, true, 'ESTATUTARIA', 'SIMPLE', true, 30, 'art. 285.2 LSC'),
  ('TRANSMISION_PARTICIPACIONES', 'Autorizacion de transmision de participaciones sociales', true, true, true, 'ESPECIAL', 'REFORZADA_1_2', false, 30, 'arts. 107 y 108 LSC'),
  ('PRESTACIONES_ACCESORIAS', 'Creacion, modificacion o supresion de prestaciones accesorias', true, true, true, 'ESTATUTARIA', 'REFORZADA_1_2', false, 30, 'arts. 86 a 89 LSC'),
  ('CONTRATOS_SOCIO_UNICO_SOCIEDAD', 'Contratos entre socio unico y sociedad', false, false, false, 'ESPECIAL', 'NO_APLICA', false, null, 'art. 16 LSC'),
  ('ACUERDO_CONVOCATORIA_JUNTA', 'Acuerdo del organo de administracion convocando Junta', false, false, false, 'ORDINARIA', 'SIMPLE', false, null, 'arts. 166, 176 y 247 LSC'),
  ('EXCLUSION_SOCIO', 'Exclusion de socio', true, true, true, 'ESPECIAL', 'REFORZADA_1_2', false, 30, 'arts. 350 a 352 LSC'),
  ('SEPARACION_SOCIO', 'Ejercicio del derecho de separacion de socio', true, true, true, 'ESPECIAL', 'NO_APLICA', false, 30, 'arts. 346 a 349 LSC'),
  ('DISTRIBUCION_CARGOS', 'Distribucion de cargos del Consejo', true, true, true, 'ORDINARIA', 'SIMPLE', false, 10, 'art. 245.2 LSC; art. 124 RRM'),
  ('APROBACION_REGLAMENTO_CONSEJO', 'Aprobacion o modificacion del Reglamento del Consejo', true, true, true, 'ESPECIAL', 'SIMPLE', true, 30, 'art. 528 LSC'),
  ('PODER_REPRESENTACION', 'Otorgamiento o modificacion de poderes de representacion', true, true, true, 'ORDINARIA', 'SIMPLE', false, 10, 'arts. 249 y 249 bis LSC; art. 94 RRM')
ON CONFLICT (materia) DO UPDATE SET
  materia_label_es = EXCLUDED.materia_label_es,
  requires_notary = EXCLUDED.requires_notary,
  requires_registry = EXCLUDED.requires_registry,
  inscribable = EXCLUDED.inscribable,
  matter_class = EXCLUDED.matter_class,
  min_majority_code = EXCLUDED.min_majority_code,
  publication_required = EXCLUDED.publication_required,
  plazo_inscripcion_dias = EXCLUDED.plazo_inscripcion_dias,
  referencia_legal = EXCLUDED.referencia_legal;

-- ---------------------------------------------------------------------------
-- 2. NOMBRAMIENTO_CESE queda como agregado de navegacion, no perfil final.
-- ---------------------------------------------------------------------------

UPDATE public.rule_pack_versions
SET
  is_active = false,
  status = 'RETIRED',
  effective_to = COALESCE(effective_to, now())
WHERE pack_id = 'NOMBRAMIENTO_CESE'
  AND is_active = true;

UPDATE public.rule_packs
SET descripcion = 'Agregado retirado: resolver siempre a NOMBRAMIENTO_CONSEJERO o CESE_CONSEJERO antes de construir el perfil.'
WHERE id = 'NOMBRAMIENTO_CESE';

-- ---------------------------------------------------------------------------
-- 3. Rule packs nuevos para materias SL/Consejo criticas.
-- ---------------------------------------------------------------------------

INSERT INTO public.rule_packs (id, tenant_id, descripcion, materia, organo_tipo)
VALUES
  ('TRANSMISION_PARTICIPACIONES', '00000000-0000-0000-0000-000000000001'::uuid, 'Autorizacion de transmision de participaciones sociales', 'TRANSMISION_PARTICIPACIONES', 'JUNTA_GENERAL'),
  ('PRESTACIONES_ACCESORIAS', '00000000-0000-0000-0000-000000000001'::uuid, 'Prestaciones accesorias en SL', 'PRESTACIONES_ACCESORIAS', 'JUNTA_GENERAL'),
  ('CONTRATOS_SOCIO_UNICO_SOCIEDAD', '00000000-0000-0000-0000-000000000001'::uuid, 'Contratos entre socio unico y sociedad', 'CONTRATOS_SOCIO_UNICO_SOCIEDAD', 'SOCIO_UNICO'),
  ('ACUERDO_CONVOCATORIA_JUNTA', '00000000-0000-0000-0000-000000000001'::uuid, 'Acuerdo del Consejo para convocar Junta', 'ACUERDO_CONVOCATORIA_JUNTA', 'CONSEJO'),
  ('EXCLUSION_SOCIO', '00000000-0000-0000-0000-000000000001'::uuid, 'Exclusion de socio', 'EXCLUSION_SOCIO', 'JUNTA_GENERAL'),
  ('SEPARACION_SOCIO', '00000000-0000-0000-0000-000000000001'::uuid, 'Toma de razon del ejercicio del derecho de separacion', 'SEPARACION_SOCIO', 'SOPORTE_INTERNO'),
  ('DISTRIBUCION_CARGOS', '00000000-0000-0000-0000-000000000001'::uuid, 'Distribucion de cargos del Consejo', 'DISTRIBUCION_CARGOS', 'CONSEJO'),
  ('APROBACION_REGLAMENTO_CONSEJO', '00000000-0000-0000-0000-000000000001'::uuid, 'Aprobacion o modificacion del Reglamento del Consejo', 'APROBACION_REGLAMENTO_CONSEJO', 'CONSEJO'),
  ('PODER_REPRESENTACION', '00000000-0000-0000-0000-000000000001'::uuid, 'Otorgamiento de poderes de representacion', 'PODER_REPRESENTACION', 'CONSEJO')
ON CONFLICT (id) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  materia = EXCLUDED.materia,
  organo_tipo = EXCLUDED.organo_tipo;

WITH payloads AS (
  SELECT *
  FROM (
    VALUES
      (
        'TRANSMISION_PARTICIPACIONES',
        '1.0.0',
        $json${
          "id":"TRANSMISION_PARTICIPACIONES",
          "materia":"TRANSMISION_PARTICIPACIONES",
          "clase":"ESPECIAL",
          "organoTipo":"JUNTA_GENERAL",
          "restriccionTipoSocial":["SL","SLU"],
          "modosAdopcionPermitidos":["MEETING","UNIVERSAL"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"LEY","referencia":"art. 176.1 LSC"}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"documentosObligatorios":[{"id":"comunicacion_transmision","nombre":"Comunicacion del socio transmitente"},{"id":"restricciones_estatutarias","nombre":"Verificacion de restricciones estatutarias y derecho de adquisicion preferente"}]},
          "constitucion":{"quorum":{"SA_1a":{"valor":0.25,"fuente":"LEY","referencia":"art. 193 LSC"},"SA_2a":{"valor":0,"fuente":"LEY"},"SL":{"valor":0,"fuente":"LEY"}}},
          "votacion":{"mayoria":{"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > 1/2_capital_total_con_voto","fuente":"LEY","referencia":"art. 199.a LSC"}},"abstenciones":"socio_afectado_no_computa_si_conflicto"},
          "documentacion":{"obligatoria":[{"id":"comunicacion_transmision","nombre":"Comunicacion de transmision proyectada"},{"id":"libro_registro_socios","nombre":"Anotacion posterior en libro registro de socios"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":30,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'PRESTACIONES_ACCESORIAS',
        '1.0.0',
        $json${
          "id":"PRESTACIONES_ACCESORIAS",
          "materia":"PRESTACIONES_ACCESORIAS",
          "clase":"ESTATUTARIA",
          "organoTipo":"JUNTA_GENERAL",
          "restriccionTipoSocial":["SL","SLU"],
          "modosAdopcionPermitidos":["MEETING","UNIVERSAL"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"LEY","referencia":"art. 176.1 LSC"}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"documentosObligatorios":[{"id":"texto_estatutario","nombre":"Texto integro de la modificacion estatutaria"},{"id":"consentimiento_socio_afectado","nombre":"Consentimiento individual del socio obligado"}]},
          "constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194 LSC"},"SL":{"valor":0,"fuente":"LEY"}}},
          "votacion":{"mayoria":{"SA":{"formula":"reforzada art. 201.2 LSC","fuente":"LEY","referencia":"art. 201.2 LSC"},"SL":{"formula":"favor > 1/2_capital_total_con_voto","fuente":"LEY","referencia":"art. 199.a LSC"}},"abstenciones":"no_cuentan"},
          "documentacion":{"obligatoria":[{"id":"texto_estatutario","nombre":"Texto estatutario completo"},{"id":"consentimiento_individual","nombre":"Consentimiento escrito del socio afectado"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":30,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'CONTRATOS_SOCIO_UNICO_SOCIEDAD',
        '1.0.0',
        $json${
          "id":"CONTRATOS_SOCIO_UNICO_SOCIEDAD",
          "materia":"CONTRATOS_SOCIO_UNICO_SOCIEDAD",
          "clase":"ESPECIAL",
          "organoTipo":"SOCIO_UNICO",
          "modosAdopcionPermitidos":["UNIPERSONAL_SOCIO"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":0,"fuente":"NO_APLICA","referencia":"art. 15 LSC"},"SL":{"valor":0,"fuente":"NO_APLICA","referencia":"art. 15 LSC"}},"canales":{"SA":["NO_APLICA"],"SL":["NO_APLICA"]},"documentosObligatorios":[{"id":"contrato_socio_unico","nombre":"Contrato o minuta con el socio unico"}]},
          "constitucion":{"quorum":{"SL":{"valor":1,"fuente":"SOCIO_UNICO","referencia":"arts. 15 y 16 LSC"},"SA_1a":{"valor":1,"fuente":"SOCIO_UNICO","referencia":"arts. 15 y 16 LSC"}}},
          "votacion":{"mayoria":{"SA":{"formula":"decision del socio unico","fuente":"LEY","referencia":"art. 15 LSC"},"SL":{"formula":"decision del socio unico","fuente":"LEY","referencia":"art. 15 LSC"}},"abstenciones":"no_aplica"},
          "documentacion":{"obligatoria":[{"id":"contrato","nombre":"Contrato firmado o minuta aprobada"},{"id":"libro_registro_contratos_socio_unico","nombre":"Constancia en libro-registro especial art. 16 LSC"}]},
          "postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","plazoInscripcionDias":0,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'ACUERDO_CONVOCATORIA_JUNTA',
        '1.0.0',
        $json${
          "id":"ACUERDO_CONVOCATORIA_JUNTA",
          "materia":"ACUERDO_CONVOCATORIA_JUNTA",
          "clase":"ORDINARIA",
          "organoTipo":"CONSEJO",
          "modosAdopcionPermitidos":["MEETING","NO_SESSION"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"},"SL":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"documentosObligatorios":[{"id":"borrador_convocatoria_junta","nombre":"Borrador de convocatoria de Junta y orden del dia"}]},
          "constitucion":{"quorum":{"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},
          "votacion":{"mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"}},"abstenciones":"no_cuentan","votoCalidadPermitido":true},
          "documentacion":{"obligatoria":[{"id":"orden_dia","nombre":"Orden del dia propuesto"},{"id":"fecha_lugar_modalidad","nombre":"Fecha, hora, lugar y modalidad de Junta"}]},
          "postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","plazoInscripcionDias":0,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'EXCLUSION_SOCIO',
        '1.0.0',
        $json${
          "id":"EXCLUSION_SOCIO",
          "materia":"EXCLUSION_SOCIO",
          "clase":"ESPECIAL",
          "organoTipo":"JUNTA_GENERAL",
          "restriccionTipoSocial":["SL","SLU"],
          "modosAdopcionPermitidos":["MEETING","UNIVERSAL"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"LEY","referencia":"art. 176.1 LSC"}},"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_ESCRITA"]},"documentosObligatorios":[{"id":"causa_exclusion","nombre":"Acreditacion de causa legal o estatutaria de exclusion"}]},
          "constitucion":{"quorum":{"SA_1a":{"valor":0.25,"fuente":"LEY","referencia":"art. 193 LSC"},"SA_2a":{"valor":0,"fuente":"LEY"},"SL":{"valor":0,"fuente":"LEY"}}},
          "votacion":{"mayoria":{"SA":{"formula":"favor > contra","fuente":"LEY","referencia":"art. 201.1 LSC"},"SL":{"formula":"favor > 1/2_capital_total_con_voto","fuente":"LEY","referencia":"art. 199.a LSC"}},"abstenciones":"socio_afectado_no_computa"},
          "documentacion":{"obligatoria":[{"id":"causa_exclusion","nombre":"Informe/documentacion de causa de exclusion"},{"id":"valoracion_participaciones","nombre":"Procedimiento de valoracion y reembolso"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":30,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'SEPARACION_SOCIO',
        '1.0.0',
        $json${
          "id":"SEPARACION_SOCIO",
          "materia":"SEPARACION_SOCIO",
          "clase":"ESPECIAL",
          "organoTipo":"SOPORTE_INTERNO",
          "modosAdopcionPermitidos":["NO_SESSION"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":0,"fuente":"NO_APLICA","referencia":"arts. 346-349 LSC"},"SL":{"valor":0,"fuente":"NO_APLICA","referencia":"arts. 346-349 LSC"}},"canales":{"SA":["NO_APLICA"],"SL":["NO_APLICA"]},"documentosObligatorios":[{"id":"comunicacion_socio","nombre":"Comunicacion de ejercicio del derecho de separacion"}]},
          "constitucion":{"quorum":{"SL":{"valor":0,"fuente":"NO_APLICA"},"SA_1a":{"valor":0,"fuente":"NO_APLICA"}}},
          "votacion":{"mayoria":{"SA":{"formula":"no aplica: derecho individual del socio","fuente":"LEY","referencia":"art. 346 LSC"},"SL":{"formula":"no aplica: derecho individual del socio","fuente":"LEY","referencia":"art. 346 LSC"}},"abstenciones":"no_aplica"},
          "documentacion":{"obligatoria":[{"id":"causa_separacion","nombre":"Acreditacion de causa de separacion"},{"id":"comunicacion_socio","nombre":"Comunicacion del socio en plazo"},{"id":"valoracion_participaciones","nombre":"Procedimiento de valoracion y reembolso"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":30,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'DISTRIBUCION_CARGOS',
        '1.0.0',
        $json${
          "id":"DISTRIBUCION_CARGOS",
          "materia":"DISTRIBUCION_CARGOS",
          "clase":"ORDINARIA",
          "organoTipo":"CONSEJO",
          "modosAdopcionPermitidos":["MEETING","NO_SESSION"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"},"SL":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"documentosObligatorios":[{"id":"propuesta_cargos","nombre":"Propuesta de distribucion de cargos"}]},
          "constitucion":{"quorum":{"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},
          "votacion":{"mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"}},"abstenciones":"no_cuentan","votoCalidadPermitido":true},
          "documentacion":{"obligatoria":[{"id":"aceptaciones_cargos","nombre":"Aceptacion de cargos internos cuando proceda"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":10,"publicacionRequerida":false}
        }$json$::jsonb
      ),
      (
        'APROBACION_REGLAMENTO_CONSEJO',
        '1.0.0',
        $json${
          "id":"APROBACION_REGLAMENTO_CONSEJO",
          "materia":"APROBACION_REGLAMENTO_CONSEJO",
          "clase":"ESPECIAL",
          "organoTipo":"CONSEJO",
          "modosAdopcionPermitidos":["MEETING","NO_SESSION"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"},"SL":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"documentosObligatorios":[{"id":"texto_reglamento","nombre":"Texto integro del Reglamento del Consejo"}]},
          "constitucion":{"quorum":{"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},
          "votacion":{"mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"}},"abstenciones":"no_cuentan","votoCalidadPermitido":true},
          "documentacion":{"obligatoria":[{"id":"texto_reglamento","nombre":"Texto integro aprobado o modificado"},{"id":"informe_gobierno_corporativo","nombre":"Informe de gobierno corporativo si cotizada"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":30,"publicacionRequerida":true}
        }$json$::jsonb
      ),
      (
        'PODER_REPRESENTACION',
        '1.0.0',
        $json${
          "id":"PODER_REPRESENTACION",
          "materia":"PODER_REPRESENTACION",
          "clase":"ORDINARIA",
          "organoTipo":"CONSEJO",
          "modosAdopcionPermitidos":["MEETING","NO_SESSION"],
          "convocatoria":{"antelacionDias":{"SA":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"},"SL":{"valor":0,"fuente":"LEY","referencia":"convocatoria del Consejo"}},"canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},"documentosObligatorios":[{"id":"propuesta_poder","nombre":"Propuesta de apoderamiento y alcance de facultades"}]},
          "constitucion":{"quorum":{"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},
          "votacion":{"mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"}},"abstenciones":"no_cuentan","votoCalidadPermitido":true},
          "documentacion":{"obligatoria":[{"id":"identificacion_apoderado","nombre":"Identificacion completa del apoderado"},{"id":"facultades_poder","nombre":"Listado de facultades y limites"}]},
          "postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","plazoInscripcionDias":10,"publicacionRequerida":false}
        }$json$::jsonb
      )
  ) AS v(pack_id, version, payload)
)
INSERT INTO public.rule_pack_versions (
  pack_id,
  version,
  payload,
  is_active,
  status,
  effective_from,
  effective_to,
  approved_at,
  payload_hash
)
SELECT
  pack_id,
  version,
  payload,
  true,
  'ACTIVE',
  now(),
  null,
  now(),
  encode(extensions.digest(payload::text, 'sha256'), 'hex')
FROM payloads
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true,
  status = 'ACTIVE',
  effective_to = null,
  approved_at = EXCLUDED.approved_at,
  payload_hash = EXCLUDED.payload_hash;

-- ---------------------------------------------------------------------------
-- 4. Plantillas activas: gaps sustantivos + nuevas materias criticas.
-- ---------------------------------------------------------------------------

WITH templates AS (
  SELECT *
  FROM (
    VALUES
      (
        'fa2538c6-4cc6-4a8e-ac85-3af72334a7f0'::uuid,
        'MODELO_ACUERDO',
        'APLICACION_RESULTADO',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Arts. 273 y 274 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda aprobar la aplicacion del resultado correspondiente al ejercicio {{ejercicio}}, conforme a la propuesta formulada por el organo de administracion.

SEGUNDO.- El resultado se aplicara en los siguientes terminos: dotacion a reserva legal {{dotacion_reserva_legal}}, distribucion de dividendos {{importe_dividendo}}, dotacion a reservas voluntarias {{dotacion_reservas_voluntarias}} y remanente {{remanente}}.

TERCERO.- Se deja constancia de que las cuentas anuales del ejercicio han sido aprobadas previamente por la Junta General y de que, tras la aplicacion acordada, el patrimonio neto no resulta inferior al capital social conforme al articulo 273.2 LSC.

CUARTO.- Se faculta al organo de administracion para ejecutar el acuerdo, realizar los apuntes contables correspondientes y practicar las comunicaciones internas necesarias.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"ejercicio","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Ejercicio"},{"campo":"dotacion_reserva_legal","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Dotacion reserva legal"},{"campo":"importe_dividendo","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Importe dividendo"},{"campo":"dotacion_reservas_voluntarias","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Reservas voluntarias"},{"campo":"remanente","obligatoriedad":"OPCIONAL","tipo":"number","label":"Remanente"}]'::jsonb,
        'Plantilla propia: no colapsar con APROBACION_CUENTAS ni DISTRIBUCION_DIVIDENDOS. Gate bloqueante: cuentas aprobadas.'
      ),
      (
        '3dde14f1-a6a1-4604-9026-d0083ee15dee'::uuid,
        'MODELO_ACUERDO',
        'APROBACION_PRESUPUESTO',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Arts. 225, 245 y 247 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, aprueba el presupuesto anual correspondiente al ejercicio {{ejercicio_presupuestario}}.

SEGUNDO.- El presupuesto aprobado comprende previsiones de ingresos, gastos, inversiones, financiacion y principales hipotesis de gestion, conforme al resumen incorporado al expediente: {{presupuesto_resumen}}.

TERCERO.- Se autoriza a {{directivo_ejecutor}} para ejecutar el presupuesto dentro de los limites aprobados y se establece que cualquier desviacion superior a {{umbral_reformulacion}} debera someterse nuevamente al Consejo.

CUARTO.- Se faculta al Secretario del Consejo para expedir certificaciones y realizar las comunicaciones internas necesarias para la implementacion del presupuesto.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"ejercicio_presupuestario","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Ejercicio presupuestario"},{"campo":"presupuesto_resumen","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Resumen del presupuesto"},{"campo":"directivo_ejecutor","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Directivo ejecutor"},{"campo":"umbral_reformulacion","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Umbral de reformulacion"}]'::jsonb,
        'Materia independiente de APROBACION_PLAN_NEGOCIO; usar como presupuesto anual operativo separado.'
      ),
      (
        '396f8fcf-6718-4124-9b2e-cf0fb11b8e6d'::uuid,
        'MODELO_ACUERDO',
        'AUTORIZACION_GARANTIA',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Arts. 160.f, 162, 225, 245 y 247 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda autorizar la garantia descrita en el expediente a favor de {{beneficiario_garantia}}, por importe maximo de {{importe_garantia}} euros.

SEGUNDO.- La garantia tendra la naturaleza {{tipo_garantia}} y cubrira la obligacion principal siguiente: {{obligacion_garantizada}}.

TERCERO.- El Consejo deja constancia de que, segun la informacion incorporada al expediente, la garantia no supera el 25 por ciento del activo de la sociedad, no se concede a favor de administrador ni persona vinculada en terminos que exijan autorizacion de Junta, y no afecta a activos esenciales.

CUARTO.- Si cualquiera de las condiciones anteriores dejara de cumplirse antes de la formalizacion, el expediente debera escalarse a Junta General conforme a los articulos 160.f y 162 LSC.

QUINTO.- Se faculta a {{persona_firmante}} para formalizar la garantia dentro de los limites aprobados.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"beneficiario_garantia","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Beneficiario"},{"campo":"importe_garantia","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Importe garantia"},{"campo":"tipo_garantia","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Tipo de garantia"},{"campo":"obligacion_garantizada","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Obligacion garantizada"},{"campo":"persona_firmante","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Firmante autorizado"},{"campo":"porcentaje_activo","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Porcentaje sobre activo"},{"campo":"beneficiario_es_administrador","obligatoriedad":"OBLIGATORIO","tipo":"boolean","label":"Beneficiario administrador o vinculado"}]'::jsonb,
        'Variante Consejo para garantias ordinarias. Si se supera 25% activo o hay administrador/vinculado, usar binding Junta.'
      ),
      (
        'fb568f11-52a7-4dd2-82b6-141710a0b9aa'::uuid,
        'MODELO_ACUERDO',
        'CUENTAS_CONSOLIDADAS',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Arts. 253, 262 y 279 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda formular las cuentas anuales consolidadas del grupo correspondientes al ejercicio {{ejercicio}}.

SEGUNDO.- Las cuentas consolidadas comprenden el perimetro de consolidacion descrito en {{perimetro_consolidacion}} y se formulan junto con el informe de gestion consolidado y, cuando proceda, el informe del auditor de grupo.

TERCERO.- Se acuerda remitir la documentacion formulada al auditor y preparar su sometimiento a la Junta General junto con las cuentas individuales.

CUARTO.- Se faculta al Secretario del Consejo para certificar el acuerdo e incorporar la documentacion al expediente digital.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"ejercicio","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Ejercicio"},{"campo":"perimetro_consolidacion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Perimetro de consolidacion"},{"campo":"auditor_grupo","obligatoriedad":"OPCIONAL","tipo":"text","label":"Auditor de grupo"}]'::jsonb,
        'Prerequisito funcional: formulacion individual de sociedades del grupo y documentacion consolidada.'
      ),
      (
        'b1a526d7-a251-4bb3-ba01-c96dc2cecfb2'::uuid,
        'MODELO_ACUERDO',
        'DISOLUCION',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Arts. 360 a 378 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda la disolucion de la sociedad por la causa {{subtipo_disolucion}}: {{causa_disolucion}}.

SEGUNDO.- Si la causa invocada exige soporte contable o patrimonial, se deja constancia de que el expediente incorpora el balance o documentacion justificativa correspondiente: {{soporte_causa_disolucion}}.

TERCERO.- Desde la eficacia del acuerdo se abre el periodo de liquidacion de la sociedad, con cese de los administradores en sus funciones de gestion ordinaria y sustitucion por los liquidadores que resulten designados conforme a la Ley, los Estatutos o acuerdo especifico.

CUARTO.- Se faculta a las personas designadas en el expediente para elevar a publico el acuerdo, gestionar su inscripcion, practicar publicaciones y realizar comunicaciones necesarias.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"subtipo_disolucion","obligatoriedad":"OBLIGATORIO","tipo":"select","label":"Subtipo disolucion","opciones":["VOLUNTARIA","CAUSA_LEGAL_PERDIDAS","REDUCCION_SIN_REMEDIO"]},{"campo":"causa_disolucion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Causa de disolucion"},{"campo":"soporte_causa_disolucion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Soporte de la causa"}]'::jsonb,
        'Subtipo obligatorio en perfil. Coordinar con nombramiento de liquidadores y periodo de liquidacion.'
      ),
      (
        '66d771b9-29a1-4980-a6aa-bb2a8fd78901'::uuid,
        'MODELO_ACUERDO',
        'DIVIDENDO_A_CUENTA',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Art. 277 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda distribuir un dividendo a cuenta del ejercicio {{ejercicio}} por importe total de {{importe_dividendo}} euros.

SEGUNDO.- El pago se realizara en fecha {{fecha_pago}}, conforme al detalle de beneficiarios y reglas de reparto incorporados al expediente.

TERCERO.- El Consejo deja constancia de que se ha formulado un estado contable que acredita liquidez suficiente, que no existen perdidas de ejercicios anteriores que impidan la distribucion y que se han respetado las dotaciones legales.

CUARTO.- Se faculta a {{persona_ejecucion}} para ejecutar el pago, realizar las retenciones y conservar el estado contable en el expediente y, cuando proceda, depositarlo en el Registro Mercantil.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"ejercicio","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Ejercicio"},{"campo":"importe_dividendo","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Importe dividendo"},{"campo":"fecha_pago","obligatoriedad":"OBLIGATORIO","tipo":"date","label":"Fecha de pago"},{"campo":"estado_contable_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Referencia estado contable"},{"campo":"persona_ejecucion","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Persona de ejecucion"}]'::jsonb,
        'Gate bloqueante: estado contable de liquidez art. 277 LSC.'
      ),
      (
        'd082aee7-e5b6-4a02-8ee4-d539730d84e6'::uuid,
        'MODELO_ACUERDO',
        'EJECUCION_AUMENTO_DELEGADO',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Art. 297 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda ejecutar la delegacion conferida por la Junta General mediante acuerdo {{acuerdo_junta_delegacion_ref}}.

SEGUNDO.- El aumento se ejecuta por importe nominal de {{importe_aumento}} euros, mediante la modalidad {{modalidad_aumento}}, con las condiciones de desembolso, suscripcion y, en su caso, prima descritas en el expediente.

TERCERO.- Se deja constancia de que la delegacion de la Junta esta vigente, inscrita cuando proceda y no agotada por ejecuciones anteriores.

CUARTO.- Se faculta a las personas designadas para elevar a publico el acuerdo, otorgar la escritura de aumento, declarar su ejecucion e inscribirlo en el Registro Mercantil.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"acuerdo_junta_delegacion_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Acuerdo delegante"},{"campo":"importe_aumento","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Importe aumento"},{"campo":"modalidad_aumento","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Modalidad aumento"},{"campo":"condiciones_suscripcion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Condiciones de suscripcion"}]'::jsonb,
        'Gate bloqueante: delegacion previa de Junta vigente e inscrita cuando proceda.'
      ),
      (
        '31f1d0a7-23be-43c1-9a91-a6896baefc58'::uuid,
        'MODELO_ACUERDO',
        'EMISION_OBLIGACIONES',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Arts. 401, 414 y 415 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda aprobar la emision de obligaciones u otros instrumentos de deuda por importe nominal maximo de {{importe_maximo_emision}} euros.

SEGUNDO.- La emision tendra subtipo {{subtipo_emision}} y se regira por las condiciones financieras siguientes: {{condiciones_financieras}}.

TERCERO.- En caso de obligaciones convertibles o canjeables, se aprueban las bases de conversion o canje {{bases_conversion}} y se incorpora al expediente el informe de administradores exigible.

CUARTO.- Si la operacion incorpora exclusion o limitacion del derecho de suscripcion preferente, su eficacia queda condicionada al acuerdo especifico y al informe justificativo correspondiente.

QUINTO.- Se faculta al organo de administracion para completar, formalizar, elevar a publico, inscribir y ejecutar la emision dentro del marco aprobado.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"subtipo_emision","obligatoriedad":"OBLIGATORIO","tipo":"select","label":"Subtipo emision","opciones":["SIMPLE","CONVERTIBLE","CANJEABLE"]},{"campo":"importe_maximo_emision","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Importe maximo"},{"campo":"condiciones_financieras","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Condiciones financieras"},{"campo":"bases_conversion","obligatoriedad":"CONDICIONAL","tipo":"textarea","label":"Bases conversion o canje"}]'::jsonb,
        'Subtipo CONVERTIBLE/CANJEABLE activa documentacion condicional arts. 414-415 LSC.'
      ),
      (
        '94087463-1c88-4f39-a1aa-064ff2f88571'::uuid,
        'MODELO_ACUERDO',
        'SUPRESION_PREFERENTE',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Art. 308 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda suprimir o excluir el derecho de suscripcion preferente en relacion con el aumento de capital identificado como {{aumento_capital_ref}}.

SEGUNDO.- La supresion se justifica por el interes social en los terminos expuestos en el informe de administradores incorporado al expediente: {{justificacion_interes_social}}.

TERCERO.- Se deja constancia de que el informe de administradores y, cuando proceda, los informes complementarios exigibles han estado a disposicion de socios o accionistas en los terminos legales.

CUARTO.- El acuerdo queda vinculado al aumento de capital correspondiente y debera formalizarse, elevarse a publico e inscribirse conjuntamente cuando proceda.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"aumento_capital_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Aumento capital vinculado"},{"campo":"justificacion_interes_social","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Justificacion interes social"},{"campo":"informe_admin_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Informe administradores"}]'::jsonb,
        'Binding separado aunque pueda ejecutarse junto con AUMENTO_CAPITAL; no colapsar por documentacion reforzada art. 308 LSC.'
      ),
      (
        '1c7fd0e8-2b97-4501-ad09-b9d35a23de6b'::uuid,
        'MODELO_ACUERDO',
        'TRASLADO_DOMICILIO_NACIONAL',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Art. 285.2 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda trasladar el domicilio social dentro del territorio nacional a {{nuevo_domicilio}}.

SEGUNDO.- Se acuerda modificar el articulo estatutario relativo al domicilio social para reflejar la nueva direccion, con efectos desde {{fecha_efectos}}.

TERCERO.- Se deja constancia de que los Estatutos no reservan expresamente esta competencia a la Junta General o, en su caso, de que se ha verificado la habilitacion del Consejo conforme al articulo 285.2 LSC.

CUARTO.- Se faculta a las personas designadas para elevar a publico el acuerdo, inscribirlo en el Registro Mercantil, publicar cuando proceda y actualizar registros administrativos.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"nuevo_domicilio","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Nuevo domicilio"},{"campo":"fecha_efectos","obligatoriedad":"OBLIGATORIO","tipo":"date","label":"Fecha efectos"},{"campo":"certificacion_domicilio_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Soporte domicilio"},{"campo":"traslado_domicilio_reservado_junta","obligatoriedad":"OBLIGATORIO","tipo":"boolean","label":"Reservado a Junta por estatutos"}]'::jsonb,
        'Si los estatutos reservan competencia a Junta, el perfil debe bloquear Consejo.'
      ),
      (
        'b6df4e34-3bc9-4885-b4f2-e2569a43c6cb'::uuid,
        'MODELO_ACUERDO',
        'TRANSMISION_PARTICIPACIONES',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Arts. 107, 108 y 199 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda autorizar la transmision de participaciones sociales comunicada por {{socio_transmitente}} a favor de {{adquirente}}.

SEGUNDO.- La transmision se proyecta por {{numero_participaciones}} participaciones y precio o contraprestacion de {{precio_transmision}}, quedando sujeta a las restricciones legales, estatutarias y pactadas incorporadas al expediente.

TERCERO.- Se deja constancia de la verificacion del derecho de adquisicion preferente y demas restricciones estatutarias: {{restricciones_estatutarias}}.

CUARTO.- Se faculta al organo de administracion para practicar las anotaciones en el libro registro de socios y emitir las comunicaciones necesarias.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"socio_transmitente","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Socio transmitente"},{"campo":"adquirente","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Adquirente"},{"campo":"numero_participaciones","obligatoriedad":"OBLIGATORIO","tipo":"number","label":"Participaciones"},{"campo":"precio_transmision","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Precio"},{"campo":"restricciones_estatutarias","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Restricciones"}]'::jsonb,
        'Materia SL/SLU. Verificar pactos, estatutos y derecho de adquisicion preferente.'
      ),
      (
        'd1b87e5a-57b3-4a7b-a2ed-ccf6cc472957'::uuid,
        'MODELO_ACUERDO',
        'PRESTACIONES_ACCESORIAS',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Arts. 86 a 89 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda {{tipo_actuacion}} las prestaciones accesorias reguladas en los Estatutos Sociales.

SEGUNDO.- La nueva regulacion estatutaria o modificacion aprobada es la siguiente: {{redaccion_prestacion_accesoria}}.

TERCERO.- Se deja constancia de que el socio o socios afectados han prestado consentimiento individual escrito cuando resulta exigible conforme al articulo 89 LSC.

CUARTO.- Se faculta a las personas designadas para elevar a publico el acuerdo, inscribirlo y realizar comunicaciones necesarias.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"tipo_actuacion","obligatoriedad":"OBLIGATORIO","tipo":"select","label":"Actuacion","opciones":["CREAR","MODIFICAR","SUPRIMIR"]},{"campo":"redaccion_prestacion_accesoria","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Redaccion estatutaria"},{"campo":"consentimientos_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Consentimientos afectados"}]'::jsonb,
        'Materia SL/SLU con consentimiento individual obligatorio del socio afectado cuando proceda.'
      ),
      (
        '64fd400f-0b35-4b4c-8078-80d4c41985da'::uuid,
        'MODELO_ACUERDO',
        'CONTRATOS_SOCIO_UNICO_SOCIEDAD',
        'SOCIO_UNICO',
        'UNIPERSONAL_SOCIO',
        '1.0.0',
        'Art. 16 LSC',
        $tpl$PRIMERO.- El socio unico de {{denominacion_social}} deja constancia de la aprobacion, formalizacion o toma de razon del contrato entre socio unico y sociedad identificado como {{contrato_ref}}.

SEGUNDO.- El contrato tiene por objeto {{objeto_contrato}}, con contraprestacion o valor economico {{valor_contrato}} y condiciones principales {{condiciones_principales}}.

TERCERO.- Se ordena su constancia en el libro-registro especial de contratos entre el socio unico y la sociedad, con referencia al articulo 16 LSC.

CUARTO.- Se faculta a {{persona_ejecucion}} para formalizar, custodiar y comunicar el contrato cuando proceda.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"contrato_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Referencia contrato"},{"campo":"objeto_contrato","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Objeto contrato"},{"campo":"valor_contrato","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Valor contrato"},{"campo":"condiciones_principales","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Condiciones principales"},{"campo":"persona_ejecucion","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Persona ejecucion"}]'::jsonb,
        'No es acuerdo colegiado; documento de constancia y registro art. 16 LSC.'
      ),
      (
        'd0beadd2-21e8-4f1d-ae23-eed1bd7c2ce9'::uuid,
        'MODELO_ACUERDO',
        'ACUERDO_CONVOCATORIA_JUNTA',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Arts. 166, 176 y 247 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda convocar Junta General de socios o accionistas.

SEGUNDO.- La Junta se celebrara en fecha {{fecha_junta_convocada}}, a las {{hora_junta_convocada}}, en {{lugar_junta_convocada}}, bajo modalidad {{modalidad_junta}}, con el orden del dia siguiente: {{orden_dia}}.

TERCERO.- Se ordena emitir la convocatoria por los canales legales, estatutarios y, en su caso, electronicos aplicables al tipo social y a la configuracion estatutaria de la sociedad.

CUARTO.- Se faculta al Presidente y al Secretario para completar detalles no sustanciales, firmar la convocatoria y remitirla a los destinatarios.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"fecha_junta_convocada","obligatoriedad":"OBLIGATORIO","tipo":"date","label":"Fecha Junta"},{"campo":"hora_junta_convocada","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Hora Junta"},{"campo":"lugar_junta_convocada","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Lugar Junta"},{"campo":"modalidad_junta","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Modalidad"},{"campo":"orden_dia","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Orden del dia"}]'::jsonb,
        'Acuerdo de Consejo para convocar Junta; no sustituye la convocatoria emitida.'
      ),
      (
        '206eae8c-51d2-4ab6-b4d4-2183b6cab519'::uuid,
        'MODELO_ACUERDO',
        'EXCLUSION_SOCIO',
        'JUNTA_GENERAL',
        'MEETING',
        '1.0.0',
        'Arts. 350 a 352 LSC',
        $tpl$PRIMERO.- La Junta General de {{denominacion_social}}, validamente constituida como {{organo_nombre}} en fecha {{fecha_junta}}, acuerda la exclusion del socio {{socio_afectado_nombre}} por concurrir la causa {{causa_exclusion}}.

SEGUNDO.- Se deja constancia de la documentacion que acredita la causa de exclusion y de la observancia de las cautelas legales, estatutarias y pactadas aplicables.

TERCERO.- Se reconoce el derecho del socio excluido a la valoracion y reembolso de sus participaciones conforme al procedimiento {{procedimiento_valoracion}}.

CUARTO.- Se faculta a las personas designadas para formalizar, elevar a publico, inscribir cuando proceda y ejecutar las actuaciones necesarias.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"},{"variable":"fecha_junta","fuente":"meetings.date","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"socio_afectado_nombre","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Socio afectado"},{"campo":"causa_exclusion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Causa exclusion"},{"campo":"procedimiento_valoracion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Procedimiento valoracion"}]'::jsonb,
        'Materia SL/SLU. Abstencion/no computo del socio afectado cuando proceda.'
      ),
      (
        '01618e42-4929-46ad-9b65-e0b094468b81'::uuid,
        'MODELO_ACUERDO',
        'SEPARACION_SOCIO',
        'SOPORTE_INTERNO',
        'NO_SESSION',
        '1.0.0',
        'Arts. 346 a 349 LSC',
        $tpl$PRIMERO.- Se deja constancia en el expediente de que el socio {{socio_afectado_nombre}} ha ejercitado el derecho de separacion respecto de {{denominacion_social}} por la causa {{causa_separacion}}.

SEGUNDO.- La sociedad toma razon de la comunicacion recibida, verifica el plazo y la concurrencia de la causa alegada, y activa el procedimiento de valoracion y reembolso de las participaciones o acciones afectadas.

TERCERO.- El metodo y procedimiento de valoracion previsto es {{metodo_valoracion}}, sin perjuicio de los derechos de discrepancia, auditor o experto que correspondan.

CUARTO.- Se faculta a las personas designadas para documentar, custodiar y formalizar las actuaciones societarias derivadas, incluida reduccion o adquisicion si proceden.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"socio_afectado_nombre","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Socio separado"},{"campo":"causa_separacion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Causa separacion"},{"campo":"metodo_valoracion","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Metodo valoracion"}]'::jsonb,
        'No es acuerdo constitutivo; soporte documental de ejercicio de derecho individual.'
      ),
      (
        '0eefc6df-1317-4e68-b87b-be2602479f8a'::uuid,
        'MODELO_ACUERDO',
        'APROBACION_REGLAMENTO_CONSEJO',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Art. 528 LSC',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda aprobar o modificar el Reglamento del Consejo en los terminos del texto incorporado al expediente.

SEGUNDO.- La actuacion aprobada consiste en {{tipo_actuacion_reglamento}} y el resumen de cambios es {{resumen_cambios}}.

TERCERO.- Si la sociedad es cotizada, se ordena su comunicacion, deposito registral y publicacion en la pagina web corporativa conforme al articulo 528 LSC.

CUARTO.- Se faculta al Secretario del Consejo para expedir certificaciones, gestionar el deposito y actualizar la normativa interna.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"tipo_actuacion_reglamento","obligatoriedad":"OBLIGATORIO","tipo":"select","label":"Actuacion","opciones":["APROBACION","MODIFICACION"]},{"campo":"resumen_cambios","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Resumen cambios"},{"campo":"texto_reglamento_ref","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Texto reglamento"}]'::jsonb,
        'Especialmente relevante en cotizadas: deposito RM y publicidad web.'
      ),
      (
        '60251fcd-9450-4812-8bbb-2946581d6d19'::uuid,
        'MODELO_ACUERDO',
        'PODER_REPRESENTACION',
        'CONSEJO_ADMIN',
        'MEETING',
        '1.0.0',
        'Arts. 249 y 249 bis LSC; art. 94 RRM',
        $tpl$PRIMERO.- El Consejo de Administracion de {{denominacion_social}}, reunido el {{fecha_consejo}} y validamente constituido como {{organo_nombre}}, acuerda otorgar poder de representacion a favor de {{apoderado_nombre}}.

SEGUNDO.- El poder tendra el alcance y limites siguientes: {{facultades_poder}}, con las restricciones internas {{limitaciones_poder}}.

TERCERO.- Se acuerda elevar a publico el poder e inscribirlo en el Registro Mercantil cuando proceda.

CUARTO.- Se faculta a las personas designadas para otorgar escritura, subsanar y ejecutar los actos necesarios para la plena eficacia del poder.$tpl$,
        '[{"variable":"denominacion_social","fuente":"entities.legal_name","condicion":"SIEMPRE"},{"variable":"fecha_consejo","fuente":"meetings.date","condicion":"SIEMPRE"},{"variable":"organo_nombre","fuente":"governing_bodies.name","condicion":"SIEMPRE"}]'::jsonb,
        '[{"campo":"apoderado_nombre","obligatoriedad":"OBLIGATORIO","tipo":"text","label":"Apoderado"},{"campo":"facultades_poder","obligatoriedad":"OBLIGATORIO","tipo":"textarea","label":"Facultades"},{"campo":"limitaciones_poder","obligatoriedad":"OPCIONAL","tipo":"textarea","label":"Limitaciones"}]'::jsonb,
        'Poder inscribible si contiene facultades mercantiles representativas.'
      )
  ) AS v(id, tipo, materia, organo_tipo, adoption_mode, version, referencia_legal, capa1_inmutable, capa2_variables, capa3_editables, notas_legal)
),
updated AS (
  UPDATE public.plantillas_protegidas p
  SET
    tipo = t.tipo,
    materia_acuerdo = t.materia,
    materia = t.materia,
    jurisdiccion = 'ES',
    version = t.version,
    estado = 'ACTIVA',
    aprobada_por = 'Comite Legal ARGA - Secretaria Societaria (demo-operativo)',
    fecha_aprobacion = now(),
    organo_tipo = t.organo_tipo,
    adoption_mode = t.adoption_mode,
    contenido_template = 'Modelo operativo - ' || t.materia,
    variables = '[]'::jsonb,
    protecciones = jsonb_build_object(
      'secciones_inmutables', jsonb_build_array('CAPA1_DISPOSITIVA'),
      'capa1_inmutable', true,
      'capa2_auto', true,
      'capa3_editable', true,
      'normalizacion', '2026-05-18',
      'paquete', 'rule_pack_stabilization'
    ),
    snapshot_rule_pack_required = true,
    contrato_variables_version = 'variables-plantillas-v1.1',
    capa1_inmutable = t.capa1_inmutable,
    capa2_variables = t.capa2_variables,
    capa3_editables = t.capa3_editables,
    referencia_legal = t.referencia_legal,
    notas_legal = t.notas_legal,
    reviewed_by = 'Comite Legal ARGA - Secretaria Societaria (demo-operativo)',
    review_date = now(),
    review_notes = 'Activada por estabilizacion Matter Registry/rule packs 2026-05-18.',
    approved_by_role = 'SECRETARIO',
    approval_checklist = jsonb_build_array('CAPA1_OPERATIVA', 'CAPA2_CANONICA', 'CAPA3_GATE_COMPATIBLE', 'BINDING_MATTER_REGISTRY'),
    content_hash_sha256 = encode(extensions.digest(t.capa1_inmutable, 'sha256'), 'hex'),
    activated_at = now()
  FROM templates t
  WHERE p.id = t.id
  RETURNING p.id
)
INSERT INTO public.plantillas_protegidas (
  id,
  tenant_id,
  tipo,
  materia_acuerdo,
  materia,
  jurisdiccion,
  version,
  estado,
  aprobada_por,
  fecha_aprobacion,
  organo_tipo,
  adoption_mode,
  contenido_template,
  variables,
  protecciones,
  snapshot_rule_pack_required,
  contrato_variables_version,
  capa1_inmutable,
  capa2_variables,
  capa3_editables,
  referencia_legal,
  notas_legal,
  reviewed_by,
  review_date,
  review_notes,
  approved_by_role,
  approval_checklist,
  content_hash_sha256,
  activated_at,
  created_at
)
SELECT
  t.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  t.tipo,
  t.materia,
  t.materia,
  'ES',
  t.version,
  'ACTIVA',
  'Comite Legal ARGA - Secretaria Societaria (demo-operativo)',
  now(),
  t.organo_tipo,
  t.adoption_mode,
  'Modelo operativo - ' || t.materia,
  '[]'::jsonb,
  jsonb_build_object(
    'secciones_inmutables', jsonb_build_array('CAPA1_DISPOSITIVA'),
    'capa1_inmutable', true,
    'capa2_auto', true,
    'capa3_editable', true,
    'normalizacion', '2026-05-18',
    'paquete', 'rule_pack_stabilization'
  ),
  true,
  'variables-plantillas-v1.1',
  t.capa1_inmutable,
  t.capa2_variables,
  t.capa3_editables,
  t.referencia_legal,
  t.notas_legal,
  'Comite Legal ARGA - Secretaria Societaria (demo-operativo)',
  now(),
  'Activada por estabilizacion Matter Registry/rule packs 2026-05-18.',
  'SECRETARIO',
  jsonb_build_array('CAPA1_OPERATIVA', 'CAPA2_CANONICA', 'CAPA3_GATE_COMPATIBLE', 'BINDING_MATTER_REGISTRY'),
  encode(extensions.digest(t.capa1_inmutable, 'sha256'), 'hex'),
  now(),
  now()
FROM templates t
WHERE NOT EXISTS (SELECT 1 FROM updated u WHERE u.id = t.id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.plantillas_protegidas p
    WHERE p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND p.estado = 'ACTIVA'
      AND p.tipo = t.tipo
      AND COALESCE(p.materia_acuerdo, p.materia) = t.materia
      AND COALESCE(p.organo_tipo, 'ANY') = t.organo_tipo
      AND COALESCE(p.adoption_mode, 'ANY') = t.adoption_mode
  );

-- ---------------------------------------------------------------------------
-- 5. Normalizacion de bindings legacy + nuevos bindings deterministas.
-- ---------------------------------------------------------------------------

WITH conflicts AS (
  SELECT b.id
  FROM public.materia_template_binding b
  WHERE b.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND b.active = true
    AND b.organo_tipo = 'CONSEJO'
    AND EXISTS (
      SELECT 1
      FROM public.materia_template_binding c
      WHERE c.tenant_id = b.tenant_id
        AND c.active = true
        AND c.materia = b.materia
        AND c.organo_tipo = 'CONSEJO_ADMIN'
        AND c.tipo_social = b.tipo_social
        AND c.jurisdiccion = b.jurisdiccion
        AND c.adoption_mode = b.adoption_mode
        AND c.doc_type = b.doc_type
        AND c.priority = b.priority
    )
)
UPDATE public.materia_template_binding b
SET
  active = false,
  selection_reason = b.selection_reason || ' Retirado por normalizacion CONSEJO -> CONSEJO_ADMIN con binding canonico existente.'
FROM conflicts c
WHERE b.id = c.id;

UPDATE public.materia_template_binding
SET
  organo_tipo = 'CONSEJO_ADMIN',
  selection_reason = selection_reason || ' Normalizado organo CONSEJO -> CONSEJO_ADMIN.'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND active = true
  AND organo_tipo = 'CONSEJO';

WITH candidate_bindings AS (
  SELECT *
  FROM (
    VALUES
      ('APLICACION_RESULTADO','JUNTA_GENERAL','ANY','MEETING','MODELO_ACUERDO','APLICACION_RESULTADO','JUNTA_GENERAL',0,'Backfill estabilizacion: plantilla ACTIVA especifica + rule pack activo.'),
      ('APROBACION_PRESUPUESTO','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','APROBACION_PRESUPUESTO','CONSEJO_ADMIN',0,'Backfill estabilizacion: presupuesto anual Consejo independiente de plan de negocio.'),
      ('AUTORIZACION_GARANTIA','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','AUTORIZACION_GARANTIA','CONSEJO_ADMIN',0,'Backfill estabilizacion: variante Consejo para garantia ordinaria; escalado preventivo a Junta.'),
      ('CUENTAS_CONSOLIDADAS','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','CUENTAS_CONSOLIDADAS','CONSEJO_ADMIN',0,'Backfill estabilizacion: formulacion de cuentas consolidadas por Consejo.'),
      ('DISOLUCION','JUNTA_GENERAL','ANY','MEETING','MODELO_ACUERDO','DISOLUCION','JUNTA_GENERAL',0,'Backfill estabilizacion: disolucion con subtipo obligatorio.'),
      ('DIVIDENDO_A_CUENTA','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','DIVIDENDO_A_CUENTA','CONSEJO_ADMIN',0,'Backfill estabilizacion: dividendo a cuenta con estado contable art. 277 LSC.'),
      ('EJECUCION_AUMENTO_DELEGADO','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','EJECUCION_AUMENTO_DELEGADO','CONSEJO_ADMIN',0,'Backfill estabilizacion: ejecucion de aumento con delegacion previa de Junta.'),
      ('EMISION_OBLIGACIONES','JUNTA_GENERAL','ANY','MEETING','MODELO_ACUERDO','EMISION_OBLIGACIONES','JUNTA_GENERAL',0,'Backfill estabilizacion: emision con subtipo simple/convertible/canjeable.'),
      ('SUPRESION_PREFERENTE','JUNTA_GENERAL','ANY','MEETING','MODELO_ACUERDO','SUPRESION_PREFERENTE','JUNTA_GENERAL',0,'Backfill estabilizacion: supresion de preferente con informe art. 308 LSC.'),
      ('TRASLADO_DOMICILIO_NACIONAL','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','TRASLADO_DOMICILIO_NACIONAL','CONSEJO_ADMIN',0,'Backfill estabilizacion: traslado nacional por Consejo art. 285.2 LSC.'),
      ('TRANSMISION_PARTICIPACIONES','JUNTA_GENERAL','SL','MEETING','MODELO_ACUERDO','TRANSMISION_PARTICIPACIONES','JUNTA_GENERAL',0,'Nueva materia SL: autorizacion de transmision de participaciones.'),
      ('TRANSMISION_PARTICIPACIONES','JUNTA_GENERAL','SLU','MEETING','MODELO_ACUERDO','TRANSMISION_PARTICIPACIONES','JUNTA_GENERAL',0,'Nueva materia SLU: autorizacion de transmision de participaciones.'),
      ('PRESTACIONES_ACCESORIAS','JUNTA_GENERAL','SL','MEETING','MODELO_ACUERDO','PRESTACIONES_ACCESORIAS','JUNTA_GENERAL',0,'Nueva materia SL: prestaciones accesorias con consentimiento individual.'),
      ('PRESTACIONES_ACCESORIAS','JUNTA_GENERAL','SLU','MEETING','MODELO_ACUERDO','PRESTACIONES_ACCESORIAS','JUNTA_GENERAL',0,'Nueva materia SLU: prestaciones accesorias con consentimiento individual.'),
      ('CONTRATOS_SOCIO_UNICO_SOCIEDAD','SOCIO_UNICO','SLU','UNIPERSONAL_SOCIO','MODELO_ACUERDO','CONTRATOS_SOCIO_UNICO_SOCIEDAD','SOCIO_UNICO',0,'Nueva materia unipersonal: contratos socio unico-sociedad art. 16 LSC.'),
      ('CONTRATOS_SOCIO_UNICO_SOCIEDAD','SOCIO_UNICO','SAU','UNIPERSONAL_SOCIO','MODELO_ACUERDO','CONTRATOS_SOCIO_UNICO_SOCIEDAD','SOCIO_UNICO',0,'Nueva materia unipersonal: contratos socio unico-sociedad art. 16 LSC.'),
      ('ACUERDO_CONVOCATORIA_JUNTA','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','ACUERDO_CONVOCATORIA_JUNTA','CONSEJO_ADMIN',0,'Nueva materia Consejo: acuerdo formal de convocatoria de Junta.'),
      ('EXCLUSION_SOCIO','JUNTA_GENERAL','SL','MEETING','MODELO_ACUERDO','EXCLUSION_SOCIO','JUNTA_GENERAL',0,'Nueva materia SL: exclusion de socio.'),
      ('EXCLUSION_SOCIO','JUNTA_GENERAL','SLU','MEETING','MODELO_ACUERDO','EXCLUSION_SOCIO','JUNTA_GENERAL',0,'Nueva materia SLU: exclusion de socio.'),
      ('SEPARACION_SOCIO','SOPORTE_INTERNO','ANY','NO_SESSION','MODELO_ACUERDO','SEPARACION_SOCIO','SOPORTE_INTERNO',0,'Nueva materia soporte: ejercicio de derecho individual de separacion.'),
      ('DISTRIBUCION_CARGOS','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','DISTRIBUCION_CARGOS','CONSEJO_ADMIN',0,'Nueva materia Consejo: distribucion de cargos.'),
      ('APROBACION_REGLAMENTO_CONSEJO','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','APROBACION_REGLAMENTO_CONSEJO','CONSEJO_ADMIN',0,'Nueva materia Consejo: Reglamento del Consejo.'),
      ('PODER_REPRESENTACION','CONSEJO_ADMIN','ANY','MEETING','MODELO_ACUERDO','PODER_REPRESENTACION','CONSEJO_ADMIN',0,'Nueva materia Consejo: poder de representacion.')
  ) AS v(materia, organo_tipo, tipo_social, adoption_mode, doc_type, template_materia, template_organo_tipo, priority, selection_reason)
),
selected_templates AS (
  SELECT DISTINCT ON (
    cb.materia,
    cb.organo_tipo,
    cb.tipo_social,
    cb.adoption_mode,
    cb.doc_type,
    cb.priority
  )
    '00000000-0000-0000-0000-000000000001'::uuid AS tenant_id,
    cb.materia,
    cb.organo_tipo,
    cb.tipo_social,
    cb.adoption_mode,
    cb.doc_type,
    cb.priority,
    cb.selection_reason,
    p.id AS template_id
  FROM candidate_bindings cb
  JOIN public.plantillas_protegidas p
    ON p.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND p.estado = 'ACTIVA'
   AND p.tipo = cb.doc_type
   AND COALESCE(p.materia_acuerdo, p.materia) = cb.template_materia
   AND COALESCE(p.organo_tipo, 'ANY') = cb.template_organo_tipo
   AND COALESCE(p.adoption_mode, cb.adoption_mode) = cb.adoption_mode
  ORDER BY
    cb.materia,
    cb.organo_tipo,
    cb.tipo_social,
    cb.adoption_mode,
    cb.doc_type,
    cb.priority,
    p.fecha_aprobacion DESC NULLS LAST,
    p.created_at DESC NULLS LAST,
    p.version DESC NULLS LAST,
    p.id
)
INSERT INTO public.materia_template_binding (
  tenant_id,
  materia,
  organo_tipo,
  tipo_social,
  jurisdiccion,
  adoption_mode,
  doc_type,
  template_id,
  priority,
  active,
  selection_reason
)
SELECT
  tenant_id,
  materia,
  organo_tipo,
  tipo_social,
  'ES',
  adoption_mode,
  doc_type,
  template_id,
  priority,
  true,
  selection_reason
FROM selected_templates
ON CONFLICT (tenant_id, materia, jurisdiccion, tipo_social, organo_tipo, adoption_mode, doc_type, priority)
WHERE active = true
DO UPDATE SET
  template_id = EXCLUDED.template_id,
  active = true,
  selection_reason = EXCLUDED.selection_reason;

COMMIT;
