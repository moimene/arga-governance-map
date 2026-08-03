-- Materia autónoma para la designación por el Consejo de la persona física que
-- ejercerá, bajo instrucciones, los derechos de ARGA Seguros, S.A. como socia
-- única de una filial S.L.U.
--
-- Esta migración NO reinterpreta NOMBRAMIENTO_REPRESENTANTE_FILIAL. Ese código
-- legacy puede cubrir otros supuestos de representación en participadas. La
-- nueva materia excluye expresamente la representación permanente de una
-- administradora persona jurídica (art. 212 bis LSC) y exige acreditar una de
-- las rutas de representación voluntaria admitidas por el art. 183 LSC.

BEGIN;

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
VALUES (
  'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL',
  'Designación de representante de la socia única en la filial',
  false,
  false,
  false,
  'ORDINARIA',
  'SIMPLE',
  false,
  null,
  'arts. 15 y 183 LSC; arts. 247.2, 248.1 y 248.2 LSC para el Consejo de una S.A.; art. 100 RRM'
)
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

INSERT INTO public.rule_packs (id, tenant_id, descripcion, materia, organo_tipo)
VALUES (
  'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Designación de representante de la socia única en una filial S.L.U.',
  'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL',
  'CONSEJO'
)
ON CONFLICT (id) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  materia = EXCLUDED.materia,
  organo_tipo = EXCLUDED.organo_tipo;

-- Una versión publicada es inmutable. La repetición de la migración admite el
-- mismo payload, pero falla de forma explícita si alguien intenta reutilizar
-- el semver 1.0.0 con un contenido distinto.
DO $migration$
DECLARE
  v_pack_id constant text := 'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL';
  v_version constant text := '1.0.0';
  v_payload constant jsonb := $json${
    "id":"DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
    "materia":"DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
    "clase":"ORDINARIA",
    "organoTipo":"CONSEJO",
    "modosAdopcionPermitidos":["MEETING","NO_SESSION"],
    "convocatoria":{
      "antelacionDias":{
        "SA":{"valor":0,"fuente":"ESTATUTOS","referencia":"estatutos y reglamento del Consejo"},
        "SAU":{"valor":0,"fuente":"ESTATUTOS","referencia":"estatutos y reglamento del Consejo"},
        "SL":{"valor":0,"fuente":"ESTATUTOS","referencia":"estatutos sociales"},
        "SLU":{"valor":0,"fuente":"ESTATUTOS","referencia":"estatutos sociales"}
      },
      "canales":{
        "SA":["CONVOCATORIA_CONSEJO"],
        "SAU":["CONVOCATORIA_CONSEJO"],
        "SL":["CONVOCATORIA_CONSEJO"],
        "SLU":["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo":[
        "Identificación inequívoca de la filial objetivo",
        "Acreditación de la titularidad del cien por cien del capital",
        "Identidad de la persona representante",
        "Título de representación voluntaria aplicable conforme al artículo 183 LSC",
        "Alcance, instrucciones específicas, vigencia y revocación"
      ],
      "documentosObligatorios":[
        {"id":"target_entity_identificada","nombre":"Identificación inequívoca de la filial objetivo","condicion":"SIEMPRE"},
        {"id":"acreditacion_capital_100","nombre":"Acreditación vigente de la titularidad del 100 % del capital de la filial","condicion":"SIEMPRE"},
        {"id":"certificado_no_administrador_pj","nombre":"Verificación de que la socia única no consta como administradora persona jurídica de la filial","condicion":"SIEMPRE"},
        {"id":"titulo_representacion_art183","nombre":"Poder general en documento público con el alcance exigido por el artículo 183.1 LSC","condicion":"SIEMPRE"},
        {"id":"propuesta_instrucciones_representante","nombre":"Propuesta con identidad, alcance, instrucciones específicas, vigencia y revocación","condicion":"SIEMPRE"}
      ]
    },
    "constitucion":{
      "quorum":{
        "SA_1a":{"valor":0,"fuente":"LEY","referencia":"no aplica a Junta; materia exclusiva del Consejo"},
        "SA_2a":{"valor":0,"fuente":"LEY","referencia":"no aplica a Junta; materia exclusiva del Consejo"},
        "SL":{"valor":0,"fuente":"LEY","referencia":"no aplica a Junta; materia exclusiva del Consejo"},
        "CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.2 LSC — mayoría de los vocales del Consejo de la S.A."}
      }
    },
    "votacion":{
      "mayoria":{
        "SA":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 248.1 LSC — mayoría absoluta de los consejeros concurrentes"},
        "SL":{"formula":"favor > presentes_mitad","fuente":"ESTATUTOS","referencia":"art. 245.1 LSC y estatutos sociales"},
        "CONSEJO":{"formula":"favor > presentes_mitad","fuente":"LEY","referencia":"art. 248.1 LSC — mayoría absoluta de los consejeros concurrentes"}
      },
      "abstenciones":"no_cuentan",
      "votoCalidadPermitido":true
    },
    "noSession":{
      "habilitado_por_estatutos":{"valor":true,"fuente":"LEY","referencia":"art. 248.2 LSC"},
      "habilitado_por_reglamento":{"valor":true,"fuente":"LEY","referencia":"art. 248.2 LSC"},
      "condicion_junta_sl":"UNANIMIDAD_CAPITAL",
      "condicion_consejo":"MAYORIA_SIN_OPOSICION",
      "ventana_minima_dias":{"valor":0,"fuente":"REGLAMENTO","referencia":"reglamento del Consejo"},
      "ventana_fuente":"REGLAMENTO",
      "canal_requerido_junta_sl":{"valor":["NOTIFICACION_CERTIFICADA"],"fuente":"LEY","referencia":"no aplicable a esta materia"},
      "canal_requerido_consejo":{"valor":["NOTIFICACION_CERTIFICADA","EMAIL_CON_ACUSE"],"fuente":"REGLAMENTO","referencia":"art. 248.2 LSC y art. 100 RRM"},
      "silencio_equivale_a":"NADA",
      "cierre_anticipado":false,
      "contenido_minimo_propuesta":[
        "filial_objetivo",
        "titularidad_100_por_ciento",
        "identidad_representante",
        "poder_general_publico_art183_1",
        "instrucciones_especificas",
        "plazo_respuesta"
      ]
    },
    "documentacion":{
      "obligatoria":[
        {"id":"target_entity_identificada","nombre":"Identificación inequívoca de la filial objetivo"},
        {"id":"acreditacion_capital_100","nombre":"Acreditación vigente de la titularidad del 100 % del capital de la filial"},
        {"id":"certificado_no_administrador_pj","nombre":"Certificado de que la socia única no es administradora persona jurídica de la filial"},
        {"id":"titulo_representacion_art183","nombre":"Evidencia del poder general en documento público exigido por el artículo 183.1 LSC"},
        {"id":"propuesta_instrucciones_representante","nombre":"Propuesta con alcance, instrucciones específicas, vigencia y revocación"}
      ],
      "ventanaDisponibilidad":{"dias":0,"fuente":"LEY"}
    },
    "acta":{
      "tipoActaPorModo":{"MEETING":"ACTA_CONSEJO","NO_SESSION":"ACTA_ACUERDO_ESCRITO"},
      "contenidoMinimo":{
        "sesion":[
          "fecha_y_lugar",
          "consejeros_asistentes",
          "target_entity_id",
          "titularidad_100_por_ciento",
          "no_administrador_persona_juridica",
          "identidad_representante",
          "poder_general_publico_art183_1",
          "instrucciones_especificas",
          "resultado_votacion"
        ],
        "consignacion":[],
        "acuerdoEscrito":[
          "propuesta_texto",
          "target_entity_id",
          "titularidad_100_por_ciento",
          "no_administrador_persona_juridica",
          "identidad_representante",
          "poder_general_publico_art183_1",
          "instrucciones_especificas",
          "relacion_respuestas",
          "ausencia_oposicion_procedimiento",
          "resultado_evaluacion",
          "fecha_cierre"
        ]
      },
      "requiereTranscripcionLibroActas":true,
      "requiereConformidadConjunta":false
    },
    "plazosMateriales":{},
    "postAcuerdo":{
      "inscribible":false,
      "instrumentoRequerido":"NINGUNO",
      "publicacionRequerida":false
    },
    "reglaEspecifica":{
      "regimenRepresentacion":"SOCIO_UNICO_FILIAL",
      "excluyeRepresentacionAdministradorPJArt212Bis":true,
      "gates":{
        "target_entity":{
          "campo":"target_entity_id",
          "operador":"required",
          "blocking":true
        },
        "capital_socio_unico":{
          "fuente":"capital_holdings",
          "campo":"ownership_percentage",
          "operador":"eq",
          "valor":100,
          "blocking":true
        },
        "no_administrador_persona_juridica":{
          "fuente":"mandates",
          "campo":"source_entity_is_corporate_administrator",
          "operador":"eq",
          "valor":false,
          "blocking":true,
          "failure_route":"REPRESENTANTE_ADMINISTRADOR_PJ_ART_212_BIS"
        },
        "titulo_representacion_art183":{
          "operador":"eq",
          "blocking":true,
          "valor":"GENERAL_PUBLIC_POWER_ART_183_1",
          "evidencia":["poder_general_en_documento_publico","facultad_para_administrar_todo_el_patrimonio_en_territorio_nacional"],
          "referencia":"art. 183.1 LSC"
        }
      }
    }
  }$json$::jsonb;
  v_payload_hash constant text := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');
  v_existing_payload jsonb;
  v_existing_hash text;
BEGIN
  SELECT payload, payload_hash
    INTO v_existing_payload, v_existing_hash
  FROM public.rule_pack_versions
  WHERE pack_id = v_pack_id
    AND version = v_version;

  IF FOUND AND (
    v_existing_payload IS DISTINCT FROM v_payload
    OR v_existing_hash IS DISTINCT FROM v_payload_hash
  ) THEN
    RAISE EXCEPTION
      'La versión %.% ya existe con un payload distinto; publique un semver nuevo',
      v_pack_id,
      v_version;
  END IF;

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
  VALUES (
    v_pack_id,
    v_version,
    v_payload,
    true,
    'ACTIVE',
    now(),
    null,
    now(),
    v_payload_hash
  )
  ON CONFLICT (pack_id, version) DO NOTHING;
END
$migration$;

COMMIT;
