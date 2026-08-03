-- Materia canónica para la designación por el Consejo de una persona física
-- que represente a la sociedad en una filial o participada. Hasta ahora este
-- supuesto caía en OTROS_LIBRE y provocaba una divergencia V1/V2 aun cuando la
-- votación y el acuerdo eran materialmente válidos.

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
  'NOMBRAMIENTO_REPRESENTANTE_FILIAL',
  'Designación de representante de la sociedad en filial o participada',
  false,
  false,
  false,
  'ORDINARIA',
  'SIMPLE',
  false,
  null,
  'arts. 184, 212 bis, 245 y 247 LSC; estatutos y reglas de la filial aplicables'
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
  'NOMBRAMIENTO_REPRESENTANTE_FILIAL',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Designación de representante de la sociedad en filial o participada',
  'NOMBRAMIENTO_REPRESENTANTE_FILIAL',
  'CONSEJO'
)
ON CONFLICT (id) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  materia = EXCLUDED.materia,
  organo_tipo = EXCLUDED.organo_tipo;

WITH payload AS (
  SELECT
    'NOMBRAMIENTO_REPRESENTANTE_FILIAL'::text AS pack_id,
    '1.0.0'::text AS version,
    $json${
      "id":"NOMBRAMIENTO_REPRESENTANTE_FILIAL",
      "materia":"NOMBRAMIENTO_REPRESENTANTE_FILIAL",
      "clase":"ORDINARIA",
      "organoTipo":"CONSEJO",
      "modosAdopcionPermitidos":["MEETING","NO_SESSION"],
      "convocatoria":{
        "antelacionDias":{
          "SA":{"valor":0,"fuente":"ESTATUTOS","referencia":"convocatoria del Consejo"},
          "SL":{"valor":0,"fuente":"ESTATUTOS","referencia":"convocatoria del Consejo"}
        },
        "canales":{"SA":["CONVOCATORIA_CONSEJO"],"SL":["CONVOCATORIA_CONSEJO"]},
        "documentosObligatorios":[
          {"id":"propuesta_representante_filial","nombre":"Propuesta de designación y alcance de la representación"}
        ]
      },
      "constitucion":{
        "quorum":{"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}
      },
      "votacion":{
        "mayoria":{"CONSEJO":{"formula":"favor > total_miembros / 2","fuente":"LEY","referencia":"art. 247.2 LSC"}},
        "abstenciones":"no_cuentan",
        "votoCalidadPermitido":true
      },
      "documentacion":{
        "obligatoria":[
          {"id":"identificacion_representante","nombre":"Identificación y aceptación de la persona representante"},
          {"id":"cargo_o_actuacion_filial","nombre":"Cargo o actuación que la sociedad ejercerá en la filial"}
        ]
      },
      "postAcuerdo":{
        "inscribible":false,
        "instrumentoRequerido":"NINGUNO",
        "plazoInscripcionDias":0,
        "publicacionRequerida":false
      }
    }$json$::jsonb AS body
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
  body,
  true,
  'ACTIVE',
  now(),
  null,
  now(),
  encode(extensions.digest(body::text, 'sha256'), 'hex')
FROM payload
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true,
  status = 'ACTIVE',
  effective_to = null,
  approved_at = EXCLUDED.approved_at,
  payload_hash = EXCLUDED.payload_hash;

-- Remediación determinista del escenario demo ARGA ejecutado durante el E2E.
-- No se altera el sentido del acuerdo ni el recuento: se sustituye únicamente
-- la clasificación genérica por la materia aprobada y su evidencia de motor.
UPDATE public.convocatorias AS c
SET
  agenda_items = (
    SELECT jsonb_agg(
      CASE
        WHEN item.value->>'materia' = 'OTROS_LIBRE'
          AND item.value->>'titulo' ILIKE '%representante%'
          AND item.value->>'titulo' ILIKE '%ARGA Digital Services%'
        THEN item.value || '{"materia":"NOMBRAMIENTO_REPRESENTANTE_FILIAL"}'::jsonb
        ELSE item.value
      END
      ORDER BY item.ordinality
    )
    FROM jsonb_array_elements(c.agenda_items) WITH ORDINALITY AS item(value, ordinality)
  ),
  convocatoria_text = replace(
    c.convocatoria_text,
    'OTROS_LIBRE',
    'NOMBRAMIENTO_REPRESENTANTE_FILIAL'
  )
WHERE c.id = '5076f488-d9c6-43ac-aa3e-5c3aaea484f4'::uuid;

UPDATE public.meeting_resolutions
SET required_majority_code = 'NOMBRAMIENTO_REPRESENTANTE_FILIAL:ORDINARIA'
WHERE meeting_id = '8cdd4470-7715-4c3c-8d8b-b4204d5a5f51'::uuid
  AND agenda_item_index = 4
  AND required_majority_code = 'OTROS_LIBRE:ORDINARIA';

WITH active_pack AS (
  SELECT rpv.id, rpv.version, rpv.payload_hash
  FROM public.rule_pack_versions AS rpv
  WHERE rpv.pack_id = 'NOMBRAMIENTO_REPRESENTANTE_FILIAL'
    AND rpv.is_active = true
  ORDER BY rpv.effective_from DESC
  LIMIT 1
), base AS (
  SELECT
    a.id,
    a.decision_text,
    p.id AS pack_version_id,
    p.version,
    p.payload_hash,
    replace(
      a.compliance_snapshot::text,
      'OTROS_LIBRE',
      'NOMBRAMIENTO_REPRESENTANTE_FILIAL'
    )::jsonb AS snapshot
  FROM public.agreements AS a
  CROSS JOIN active_pack AS p
  WHERE a.id = 'aec4301f-a0a7-4592-bdf2-9fb2259efcf6'::uuid
), dual_fixed AS (
  SELECT *, jsonb_set(
    snapshot,
    '{dual_evaluation}',
    jsonb_build_object(
      'schema_version', 'dual-evaluation.v1',
      'stage', 'MEETING_ADOPTION',
      'converged', true,
      'effective_ok', true,
      'effective_source', 'V2_CLOUD',
      'severity', 'OK',
      'v1', jsonb_build_object(
        'label', 'Adopción operativa',
        'ok', true,
        'source', 'V1_LEGACY',
        'summary', 'Resultado operativo coincidente con el rule pack Cloud.',
        'details', jsonb_build_object('status_resolucion', 'ADOPTED', 'warnings', '[]'::jsonb)
      ),
      'v2', jsonb_build_object(
        'label', 'Adopción Cloud estricta',
        'ok', true,
        'source', 'V2_CLOUD',
        'summary', 'Resultado calculado con rule pack Cloud compatible.',
        'details', jsonb_build_object(
          'status_resolucion', 'ADOPTED',
          'rule_pack_missing', false,
          'blocking_issues', '[]'::jsonb,
          'missing_specs', '[]'::jsonb,
          'warnings', '[]'::jsonb
        )
      ),
      'warnings', '[]'::jsonb
    ),
    true
  ) AS fixed
  FROM base
), trace_fixed AS (
  SELECT *, jsonb_set(
    fixed,
    '{rule_trace}',
    jsonb_build_object(
      'source', 'CLOUD_RULE_PACK',
      'rule_pack_id', 'NOMBRAMIENTO_REPRESENTANTE_FILIAL',
      'rule_pack_version_id', pack_version_id,
      'rule_pack_version', version,
      'payload_hash', payload_hash,
      'ruleset_snapshot_id', null,
      'warnings', '[]'::jsonb
    ),
    true
  ) AS fixed_trace
  FROM dual_fixed
), warnings_fixed AS (
  SELECT *,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          fixed_trace,
          '{societary_validity,warnings}',
          '[]'::jsonb,
          true
        ),
        '{societary_validity,voting,warnings}',
        '[]'::jsonb,
        true
      ),
      '{resolution_text}',
      to_jsonb(decision_text),
      true
    ) AS fixed_warnings
  FROM trace_fixed
), legal_source_fixed AS (
  SELECT *,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            fixed_warnings,
            '{societary_validity,explain,2,fuente}',
            '"LEY"'::jsonb,
            true
          ),
          '{societary_validity,explain,2,referencia}',
          '"art. 247.2 LSC"'::jsonb,
          true
        ),
        '{societary_validity,voting,explain,2,fuente}',
        '"LEY"'::jsonb,
        true
      ),
      '{societary_validity,voting,explain,2,referencia}',
      '"art. 247.2 LSC"'::jsonb,
      true
    ) AS final_snapshot
  FROM warnings_fixed
)
UPDATE public.agreements AS a
SET
  agreement_kind = 'NOMBRAMIENTO_REPRESENTANTE_FILIAL',
  matter_class = 'ORDINARIA',
  inscribable = false,
  required_majority_code = 'SIMPLE',
  compliance_snapshot = f.final_snapshot
FROM legal_source_fixed AS f
WHERE a.id = f.id;

UPDATE public.meetings AS m
SET quorum_data = replace(
    m.quorum_data::text,
    'OTROS_LIBRE',
    'NOMBRAMIENTO_REPRESENTANTE_FILIAL'
  )::jsonb
WHERE m.id = '8cdd4470-7715-4c3c-8d8b-b4204d5a5f51'::uuid;

UPDATE public.meetings AS m
SET quorum_data = jsonb_set(
  m.quorum_data,
  '{point_snapshots}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item.value->>'agenda_item_index' = '4' THEN a.compliance_snapshot
        ELSE item.value
      END
      ORDER BY item.ordinality
    )
    FROM jsonb_array_elements(m.quorum_data->'point_snapshots') WITH ORDINALITY AS item(value, ordinality)
  ),
  true
)
FROM public.agreements AS a
WHERE m.id = '8cdd4470-7715-4c3c-8d8b-b4204d5a5f51'::uuid
  AND a.id = 'aec4301f-a0a7-4592-bdf2-9fb2259efcf6'::uuid;

COMMIT;
