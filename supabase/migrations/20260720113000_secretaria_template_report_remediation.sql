-- Remediación del informe técnico de documentos TGMS (2026-07-20).
--
-- Objetivos:
--   1. La certificación acredita vigencia del cargo y sistema/fecha de
--      aprobación del acta, con cronología jurídica explícita.
--   2. Ninguna plantilla activa conserva la fuente legacy ENTIDAD.
--   3. Los datos de persona objeto de nombramiento/cese tienen una sola
--      fuente: la captura jurídica de Capa 3, no un mandato distinto inferido.
--   4. Se retiran declaraciones Capa 2 escalares que ya no participan en el
--      cuerpo visible tras eliminar la trazabilidad técnica.

BEGIN;

UPDATE public.plantillas_protegidas
SET version = '1.5.0',
    capa1_inmutable = $template$CERTIFICACIÓN DE ACUERDOS

{{nombre_certificante}}, en calidad de {{cargo_certificante}} de {{denominacion_social}}, cargo vigente y en ejercicio, certifica:

Que en la reunión celebrada el día {{fecha}} se adoptaron válidamente los siguientes acuerdos:

{{transcripcion_acuerdos}}

El acta fue aprobada mediante {{metodo_aprobacion_acta}} el {{fecha_aprobacion_acta}}. La presente certificación se expide sobre la base de dicha acta y recoge exclusivamente el texto resolutivo de los acuerdos adoptados.

Y para que así conste, se expide en {{ciudad_emision}}, a {{fecha_emision}}.

Firma de la Secretaría: {{nombre_certificante}}.
Visto bueno de la Presidencia: {{presidente}}.

Documento demo/operativo. No constituye evidencia final productiva ni sustituye la firma y el sellado cualificados que resulten exigibles.$template$,
    capa2_variables = jsonb_build_array(
      jsonb_build_object('variable', 'denominacion_social', 'fuente', 'entities.legal_name', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'nombre_certificante', 'fuente', 'ORGANO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'cargo_certificante', 'fuente', 'ORGANO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'presidente', 'fuente', 'ORGANO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'metodo_aprobacion_acta', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha_aprobacion_acta', 'fuente', 'REUNION', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'transcripcion_acuerdos', 'fuente', 'EXPEDIENTE', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'ciudad_emision', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO'),
      jsonb_build_object('variable', 'fecha_emision', 'fuente', 'USUARIO', 'condicion', 'OBLIGATORIO')
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.5.0: acredita cargo vigente y en ejercicio, y expresa sistema y fecha de aprobación del acta; la fecha societaria queda separada de la traza técnica.'
    )
WHERE id = '79bc76c7-512e-4734-9849-31cdc73b0e84'
  AND tipo = 'CERTIFICACION'
  AND estado = 'ACTIVA';

-- El condicional de cotizada no se imprime como pseudocódigo/booleano.
UPDATE public.plantillas_protegidas
SET version = '1.2.0',
    capa1_inmutable = replace(
      capa1_inmutable,
      'Si ENTIDAD.es_cotizada = SÍ: se deja constancia de la difusión/soportes aplicables a la entidad cotizada en el expediente.',
      '{{#if ENTIDAD.es_cotizada}}Al tratarse de una sociedad cotizada, se deja constancia en el expediente de la difusión y de los soportes exigibles.{{/if}}'
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.2.0: la condición de sociedad cotizada se resuelve como condicional y nunca se imprime como booleano o pseudocódigo.'
    )
WHERE id = 'c8da1e61-ef2a-4a5c-895b-a5d100916ecf'
  AND estado = 'ACTIVA';

-- Canonicalización de todas las fuentes ENTIDAD todavía activas.
UPDATE public.plantillas_protegidas AS p
SET capa2_variables = (
  SELECT coalesce(
    jsonb_agg(
      CASE
        WHEN item->>'fuente' <> 'ENTIDAD' THEN item
        ELSE jsonb_set(
          item,
          '{fuente}',
          to_jsonb(
            CASE item->>'variable'
              WHEN 'denominacion_social' THEN 'entities.legal_name'
              WHEN 'CUENTAS.ejercicio' THEN 'entities.ejercicio_referido'
              WHEN 'ENTIDAD.es_cotizada' THEN 'entities.es_cotizada'
              ELSE 'entities.*'
            END::text
          )
        )
      END
      ORDER BY ordinality
    ),
    '[]'::jsonb
  ) AS variables
  FROM jsonb_array_elements(coalesce(p.capa2_variables, '[]'::jsonb))
       WITH ORDINALITY AS source(item, ordinality)
)
WHERE p.estado = 'ACTIVA'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p.capa2_variables, '[]'::jsonb)) AS item
    WHERE item->>'fuente' = 'ENTIDAD'
  );

-- Una persona candidata o cesada no se deduce del censo vigente: se captura
-- en Capa 3. Se conserva como automática únicamente la sociedad emisora.
WITH conflict_targets(template_id, variable) AS (
  VALUES
    ('ba214d42-1933-497f-a2c0-0867c7c7a55f'::uuid, 'nombre_consejero'),
    ('ba214d42-1933-497f-a2c0-0867c7c7a55f'::uuid, 'dni_consejero'),
    ('ba214d42-1933-497f-a2c0-0867c7c7a55f'::uuid, 'cargo_denominacion'),
    ('433da411-ba65-410c-8375-24db637f7e75'::uuid, 'nombre_consejero'),
    ('433da411-ba65-410c-8375-24db637f7e75'::uuid, 'dni_consejero'),
    ('433da411-ba65-410c-8375-24db637f7e75'::uuid, 'cargo_denominacion'),
    ('27be9063-8977-44c7-b72c-eb26ecb3c49b'::uuid, 'nombre_candidato'),
    ('27be9063-8977-44c7-b72c-eb26ecb3c49b'::uuid, 'dni_candidato'),
    ('27be9063-8977-44c7-b72c-eb26ecb3c49b'::uuid, 'cargo_denominacion'),
    ('27be9063-8977-44c7-b72c-eb26ecb3c49b'::uuid, 'categoria_consejero'),
    ('10f90d59-39d3-4633-83ff-81140eff50d5'::uuid, 'nombre_candidato'),
    ('10f90d59-39d3-4633-83ff-81140eff50d5'::uuid, 'dni_candidato'),
    ('10f90d59-39d3-4633-83ff-81140eff50d5'::uuid, 'cargo_denominacion'),
    ('10f90d59-39d3-4633-83ff-81140eff50d5'::uuid, 'categoria_consejero'),
    ('10f90d59-39d3-4633-83ff-81140eff50d5'::uuid, 'plazo_mandato')
), cleaned AS (
  SELECT p.id,
         coalesce(jsonb_agg(item ORDER BY ordinality) FILTER (
           WHERE NOT EXISTS (
             SELECT 1 FROM conflict_targets target
             WHERE target.template_id = p.id
               AND target.variable = item->>'variable'
           )
         ), '[]'::jsonb) AS variables
  FROM public.plantillas_protegidas p
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.capa2_variables, '[]'::jsonb))
       WITH ORDINALITY AS source(item, ordinality)
  WHERE p.id IN (SELECT template_id FROM conflict_targets)
    AND p.estado = 'ACTIVA'
  GROUP BY p.id
)
UPDATE public.plantillas_protegidas p
SET capa2_variables = cleaned.variables
FROM cleaned
WHERE p.id = cleaned.id;

-- Declaraciones huérfanas verificadas contra el cuerpo activo. La evidencia
-- técnica asociada permanece en metadata/audit_log, no en Capa 2 visible.
WITH orphan_targets(template_id, variable) AS (
  VALUES
    ('2c15640c-de2f-41ea-aa8d-304147124a6e'::uuid, 'ACUERDO.agreement_id'),
    ('383d7f4c-1df6-42a2-bc5c-df3a4e1685fe'::uuid, 'DECISION.agreement_id'),
    ('383d7f4c-1df6-42a2-bc5c-df3a4e1685fe'::uuid, 'EXPEDIENTE.expediente_id'),
    ('2d9134d5-7935-4f3c-a6de-de1c6fc35227'::uuid, 'DECISION.agreement_id'),
    ('2d9134d5-7935-4f3c-a6de-de1c6fc35227'::uuid, 'EXPEDIENTE.expediente_id'),
    ('ae44ec3b-ba47-4fd7-a119-5ac70346fdc0'::uuid, 'COAP.agreement_id'),
    ('b5f436c9-e8e6-4a01-92e7-25fe51ed83f3'::uuid, 'ACTO.agreement_id'),
    ('e23480e7-66c4-41a3-8148-bc8ca289e52c'::uuid, 'fecha_emision'),
    ('e23480e7-66c4-41a3-8148-bc8ca289e52c'::uuid, 'quorum_resumen'),
    ('1d7d5671-2588-4071-a9f6-e9b377d337bc'::uuid, 'agreements.convocatoria.fecha_adopcion'),
    ('1d7d5671-2588-4071-a9f6-e9b377d337bc'::uuid, 'agreements.convocatoria.id'),
    ('62da5ae6-1cff-4a7c-8032-29e489d3e877'::uuid, 'EXPEDIENTE.checklist_detalle_ref'),
    ('62da5ae6-1cff-4a7c-8032-29e489d3e877'::uuid, 'EXPEDIENTE.expediente_id'),
    ('944ff8d4-27e5-453e-82b5-8597b97a7300'::uuid, 'periodo'),
    ('c8da1e61-ef2a-4a5c-895b-a5d100916ecf'::uuid, 'CUENTAS.agreement_id'),
    ('1ab35703-4c08-4b1a-b5e4-85dd06a68021'::uuid, 'fecha_junta'),
    ('64fa1683-8cb8-4c4c-b8d6-e09f91cafa59'::uuid, 'OV.agreement_id'),
    ('64fa1683-8cb8-4c4c-b8d6-e09f91cafa59'::uuid, 'OV.condiciones_esenciales'),
    ('64fa1683-8cb8-4c4c-b8d6-e09f91cafa59'::uuid, 'OV.soporte_mercado_ref'),
    ('5f8212a8-3d37-4504-b066-dc06fe995dce'::uuid, 'fecha_balance_motor'),
    ('5f8212a8-3d37-4504-b066-dc06fe995dce'::uuid, 'fecha_emision')
), cleaned AS (
  SELECT p.id,
         coalesce(jsonb_agg(item ORDER BY ordinality) FILTER (
           WHERE NOT EXISTS (
             SELECT 1 FROM orphan_targets target
             WHERE target.template_id = p.id
               AND target.variable = item->>'variable'
           )
         ), '[]'::jsonb) AS variables
  FROM public.plantillas_protegidas p
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.capa2_variables, '[]'::jsonb))
       WITH ORDINALITY AS source(item, ordinality)
  WHERE p.id IN (SELECT template_id FROM orphan_targets)
    AND p.estado = 'ACTIVA'
  GROUP BY p.id
)
UPDATE public.plantillas_protegidas p
SET capa2_variables = cleaned.variables
FROM cleaned
WHERE p.id = cleaned.id;

-- Un único incremento PATCH por plantilla afectada, aunque concurra en más de
-- una limpieza. La certificación y APROBACION_CUENTAS ya recibieron su bump.
WITH changed_ids(id) AS (
  VALUES
    ('2c15640c-de2f-41ea-aa8d-304147124a6e'::uuid),
    ('383d7f4c-1df6-42a2-bc5c-df3a4e1685fe'::uuid),
    ('2d9134d5-7935-4f3c-a6de-de1c6fc35227'::uuid),
    ('ae44ec3b-ba47-4fd7-a119-5ac70346fdc0'::uuid),
    ('b5f436c9-e8e6-4a01-92e7-25fe51ed83f3'::uuid),
    ('e23480e7-66c4-41a3-8148-bc8ca289e52c'::uuid),
    ('1d7d5671-2588-4071-a9f6-e9b377d337bc'::uuid),
    ('62da5ae6-1cff-4a7c-8032-29e489d3e877'::uuid),
    ('24e1b9cb-9c4c-49a2-9259-d49b5b6647a1'::uuid),
    ('8dcfc85c-9422-4456-aa31-ceea5da6d64d'::uuid),
    ('944ff8d4-27e5-453e-82b5-8597b97a7300'::uuid),
    ('1ab35703-4c08-4b1a-b5e4-85dd06a68021'::uuid),
    ('64fa1683-8cb8-4c4c-b8d6-e09f91cafa59'::uuid),
    ('5f8212a8-3d37-4504-b066-dc06fe995dce'::uuid),
    ('ba214d42-1933-497f-a2c0-0867c7c7a55f'::uuid),
    ('433da411-ba65-410c-8375-24db637f7e75'::uuid),
    ('27be9063-8977-44c7-b72c-eb26ecb3c49b'::uuid),
    ('10f90d59-39d3-4633-83ff-81140eff50d5'::uuid)
)
UPDATE public.plantillas_protegidas p
SET version = concat(
      split_part(p.version, '.', 1), '.',
      split_part(p.version, '.', 2), '.',
      (split_part(p.version, '.', 3)::integer + 1)::text
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(p.notas_legal, ''),
      '2026-07-20: fuentes canonicalizadas y declaraciones duplicadas o huérfanas retiradas conforme al Gate PRE reforzado.'
    )
FROM changed_ids
WHERE p.id = changed_ids.id
  AND p.estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET content_hash_sha256 = encode(digest(convert_to(capa1_inmutable, 'UTF8'), 'sha256'), 'hex')
WHERE estado = 'ACTIVA'
  AND id IN (
    '79bc76c7-512e-4734-9849-31cdc73b0e84',
    'c8da1e61-ef2a-4a5c-895b-a5d100916ecf',
    '2c15640c-de2f-41ea-aa8d-304147124a6e',
    '383d7f4c-1df6-42a2-bc5c-df3a4e1685fe',
    '2d9134d5-7935-4f3c-a6de-de1c6fc35227',
    'ae44ec3b-ba47-4fd7-a119-5ac70346fdc0',
    'b5f436c9-e8e6-4a01-92e7-25fe51ed83f3',
    'e23480e7-66c4-41a3-8148-bc8ca289e52c',
    '1d7d5671-2588-4071-a9f6-e9b377d337bc',
    '62da5ae6-1cff-4a7c-8032-29e489d3e877',
    '24e1b9cb-9c4c-49a2-9259-d49b5b6647a1',
    '8dcfc85c-9422-4456-aa31-ceea5da6d64d',
    '944ff8d4-27e5-453e-82b5-8597b97a7300',
    '1ab35703-4c08-4b1a-b5e4-85dd06a68021',
    '64fa1683-8cb8-4c4c-b8d6-e09f91cafa59',
    '5f8212a8-3d37-4504-b066-dc06fe995dce',
    'ba214d42-1933-497f-a2c0-0867c7c7a55f',
    '433da411-ba65-410c-8375-24db637f7e75',
    '27be9063-8977-44c7-b72c-eb26ecb3c49b',
    '10f90d59-39d3-4633-83ff-81140eff50d5'
  );

COMMIT;
