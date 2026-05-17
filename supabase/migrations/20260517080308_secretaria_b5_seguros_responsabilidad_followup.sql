-- B5 follow-up: SEGUROS_RESPONSABILIDAD final P0 corrections.
-- Scope: existing ACTIVA template only. No new tables.
-- Context: B9 catalog is already present in governance_OS; this patch adds the
-- remaining actuarial/listed-insurer fields and explicit regulatory triggers.

BEGIN;

WITH target AS (
  SELECT id, tenant_id, version, capa3_editables
  FROM public.plantillas_protegidas
  WHERE id = 'df75cda9-e558-43c7-a6a9-902e2c06ee97'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
    AND estado = 'ACTIVA'
    AND COALESCE(materia_acuerdo, materia) = 'SEGUROS_RESPONSABILIDAD'
),
fields AS (
  SELECT
    target.*,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(target.capa3_editables, '[]'::jsonb)) item
        WHERE item->>'campo' = 'informe_actuarial_anexo'
      )
      THEN COALESCE(target.capa3_editables, '[]'::jsonb)
      ELSE COALESCE(target.capa3_editables, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'campo', 'informe_actuarial_anexo',
        'tipo', 'textarea',
        'label', 'Informe actuarial o tecnico anexo',
        'descripcion', 'Referencia al informe actuarial, tecnico o de mercado que soporta prima, limites y proporcionalidad de la poliza D&O.',
        'obligatoriedad', 'OPCIONAL',
        'requerido', false,
        'placeholder', 'Referencia del informe actuarial/tecnico o anexo incorporado al expediente'
      ))
    END AS with_informe
  FROM target
),
final_fields AS (
  SELECT
    fields.*,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(fields.with_informe) item
        WHERE item->>'campo' = 'es_aseguradora_cotizada'
      )
      THEN fields.with_informe
      ELSE fields.with_informe || jsonb_build_array(jsonb_build_object(
        'campo', 'es_aseguradora_cotizada',
        'tipo', 'boolean',
        'label', 'Aseguradora cotizada',
        'descripcion', 'Indica si la aseguradora o contraparte pertenece a un grupo cotizado o esta sujeta a obligaciones de mercado de valores.',
        'obligatoriedad', 'OPCIONAL',
        'requerido', false,
        'placeholder', ''
      ))
    END AS next_capa3
  FROM fields
)
UPDATE public.plantillas_protegidas p
SET
  version = CASE WHEN p.version = '1.0.0' THEN '1.0.1' ELSE p.version END,
  capa1_inmutable = 'PRIMERO.- Autorizar la {{tipo_accion_seguro}} del seguro de responsabilidad civil de consejeros y directivos (Directors & Officers) de {{denominacion_social}} con {{aseguradora}}, con las siguientes condiciones principales:

- Modalidad de cobertura: {{modalidad_cobertura}}
- Limite de indemnizacion: {{limite_cobertura}} euros
- Prima total anual: {{prima_anual}} euros
- Periodo de cobertura: desde {{fecha_inicio_cobertura}} hasta {{fecha_fin_cobertura}}
- Retroactividad: {{retroactividad}}

SEGUNDO.- Autorizar, dentro de la poliza anterior, la cobertura Side A hasta el importe de {{limite_side_a}} euros, con objeto de proteger a los administradores ante reclamaciones en las que {{denominacion_social}} no pueda o no deba indemnizarles.

{{#if aseguradora_del_grupo}}TERCERO.- Habiendose identificado que la aseguradora pertenece al grupo de sociedades de {{denominacion_social}}, el presente acuerdo se adopta con las siguientes cautelas de conflicto de interes y operacion vinculada: (a) los consejeros afectados se han abstenido de participar en la deliberacion y votacion cuando procede; (b) se ha recabado soporte de mercado independiente que acredita que las condiciones de la poliza son conformes a mercado; (c) el acuerdo ha sido adoptado conforme a la mayoria aplicable a operaciones vinculadas y, en su caso, a los requisitos del articulo 14 LOSSEAR; y (d) se documentara en el expediente cualquier obligacion de comunicacion a DGSFP, CNMV u otra autoridad que resulte aplicable. Referencia del tratamiento: {{tratamiento_conflicto_intra_grupo}}.{{else}}TERCERO.- Dejar constancia de que no se ha declarado conflicto intra-grupo en la seleccion de la aseguradora.{{/if}}

{{#if es_aseguradora_cotizada}}CUARTO.- Dejar constancia adicional de que la aseguradora o contraparte esta sujeta a obligaciones de mercado de valores, por lo que el expediente incorporara, cuando proceda, la evaluacion de operaciones vinculadas, informacion periodica o comunicacion al supervisor competente.{{else}}CUARTO.- No consta que la aseguradora o contraparte haya sido marcada como cotizada a efectos del presente expediente.{{/if}}

{{#if informe_actuarial_anexo}}QUINTO.- Incorporar al expediente, como soporte de proporcionalidad de prima, limites y condiciones de mercado, el informe o anexo tecnico siguiente: {{informe_actuarial_anexo}}.{{else}}QUINTO.- Dejar constancia de que el expediente no incorpora informe actuarial o tecnico especifico, sin perjuicio del soporte de mercado independiente que resulte exigible por las politicas internas.{{/if}}

SEXTO.- Declarar que la contratacion del seguro se realiza en interes de la Sociedad y de sus administradores y directivos, que la prima es proporcional a los riesgos cubiertos y que no constituye remuneracion encubierta a los efectos del articulo 217 LSC.

SEPTIMO.- Facultar a la Direccion Financiera y al Secretario del Consejo para la firma de la poliza y cuantos documentos sean precisos para su formalizacion, modificacion o cancelacion.',
  capa3_editables = final_fields.next_capa3,
  protecciones = COALESCE(p.protecciones, '{}'::jsonb) || jsonb_build_object(
    'regulatory_triggers',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'DGSFP_INTRAGRUPO_SEGUROS_RESPONSABILIDAD',
        'when', jsonb_build_object('aseguradora_del_grupo', true),
        'authority', 'DGSFP',
        'legal_basis', 'art. 14 LOSSEAR',
        'effect', 'review_required',
        'description', 'Si aseguradora_del_grupo=true, el expediente debe documentar tratamiento de conflicto intragrupo y evaluar obligaciones de comunicacion/supervision.'
      ),
      jsonb_build_object(
        'id', 'CNMV_ASEGURADORA_COTIZADA_SEGUROS_RESPONSABILIDAD',
        'when', jsonb_build_object('es_aseguradora_cotizada', true),
        'authority', 'CNMV',
        'legal_basis', 'art. 529 ter.h LSC y normativa de operaciones vinculadas',
        'effect', 'review_required',
        'description', 'Si es_aseguradora_cotizada=true, el expediente debe evaluar obligaciones de mercado de valores y operaciones vinculadas.'
      )
    )
  ),
  referencia_legal = 'Art. 217 LSC; arts. 1156-1175 CC; Ley 50/1980 de Contrato de Seguro; arts. 236-241 LSC; art. 529 ter.h LSC; art. 14 LOSSEAR; normativa de operaciones vinculadas y supervision DGSFP/CNMV cuando proceda',
  notas_legal = CONCAT_WS(
    E'\n',
    NULLIF(p.notas_legal, ''),
    'B5 follow-up 2026-05-17: modalidad_cobertura obligatoria ya verificada; importes numericos ya verificados; anadidos informe_actuarial_anexo y es_aseguradora_cotizada; regulatory_triggers DGSFP/CNMV documentados en protecciones.'
  )
FROM final_fields
WHERE p.id = final_fields.id;

INSERT INTO public.plantilla_changelog (
  tenant_id,
  plantilla_id,
  from_version,
  to_version,
  bump_type,
  motivo,
  autor,
  diff_summary
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'df75cda9-e558-43c7-a6a9-902e2c06ee97',
  '1.0.0',
  '1.0.1',
  'PATCH',
  'B5 follow-up SEGUROS_RESPONSABILIDAD: completar campos actuariales/cotizada y triggers regulatorios DGSFP/CNMV.',
  'Codex',
  'Anade informe_actuarial_anexo, es_aseguradora_cotizada, protecciones.regulatory_triggers y refuerza Capa 1 condicional.'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.plantilla_changelog
  WHERE plantilla_id = 'df75cda9-e558-43c7-a6a9-902e2c06ee97'
    AND to_version = '1.0.1'
    AND motivo LIKE 'B5 follow-up SEGUROS_RESPONSABILIDAD:%'
);

COMMIT;
