-- Saneamiento de rule packs SL + Consejo para MatterExecutionProfile.
--
-- Objetivos:
-- 1. Crear versiones patch corregidas en vez de mutar payloads historicos.
-- 2. Archivar duplicados activos para que exista una sola version activa por pack.
-- 3. Separar AUTORIZACION_GARANTIA de Junta y Consejo en packs distintos.
-- 4. Corregir plazo SA art. 176 LSC y mayorias SL arts. 198/199 LSC.
--
-- Guard: ejecutar `bun run db:check-target` antes de aplicar.

INSERT INTO rule_packs (id, tenant_id, descripcion, materia, organo_tipo)
SELECT
  'AUTORIZACION_GARANTIA_CONSEJO',
  tenant_id,
  'Autorizacion de garantia no esencial por Consejo',
  'AUTORIZACION_GARANTIA',
  'CONSEJO'
FROM rule_packs
WHERE id = 'AUTORIZACION_GARANTIA'
ON CONFLICT (id) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  materia = EXCLUDED.materia,
  organo_tipo = EXCLUDED.organo_tipo;

WITH constants AS (
  SELECT
    jsonb_build_object(
      'fuente', 'LEY',
      'formula', 'favor > 1/3_capital_total_con_voto',
      'referencia', 'art. 198 LSC'
    ) AS sl_simple_majority,
    jsonb_build_object(
      'fuente', 'LEY',
      'formula', 'favor > 1/2_capital_total_con_voto',
      'referencia', 'art. 199.a LSC'
    ) AS sl_half_majority
),
targets AS (
  SELECT *
  FROM (VALUES
    ('APROBACION_CUENTAS', '1.0.0', '1.0.1', 'simple', true),
    ('APLICACION_RESULTADO', 'v1.0.0', '1.0.1', 'simple', false),
    ('AUMENTO_CAPITAL', '1.0.0', '1.0.1', 'half', true),
    ('AUTORIZACION_GARANTIA', '1.0.0', '1.0.1', null, true),
    ('CESE_CONSEJERO', '1.0.0', '1.0.1', 'simple', true),
    ('DISTRIBUCION_DIVIDENDOS', '1.0.0', '1.0.1', 'simple', true),
    ('MODIFICACION_ESTATUTOS', '1.0.0', '1.0.1', 'half', true),
    ('NOMBRAMIENTO_CONSEJERO', '1.0.0', '1.0.1', null, true),
    ('NOMBRAMIENTO_AUDITOR', '1.1.0', '1.1.1', 'simple', true),
    ('REDUCCION_CAPITAL', '1.0.0', '1.0.1', 'half', true)
  ) AS t(pack_id, source_version, new_version, sl_majority_class, fix_sa_notice)
),
source_versions AS (
  SELECT
    t.pack_id,
    t.new_version,
    t.sl_majority_class,
    t.fix_sa_notice,
    rpv.id AS supersedes_version_id,
    rpv.payload
  FROM targets t
  JOIN rule_pack_versions rpv
    ON rpv.pack_id = t.pack_id
   AND rpv.version = t.source_version
),
notice_fixed AS (
  SELECT
    pack_id,
    new_version,
    sl_majority_class,
    supersedes_version_id,
    CASE
      WHEN fix_sa_notice THEN
        jsonb_set(
          jsonb_set(
            jsonb_set(
              payload,
              '{convocatoria,antelacionDias,SA,valor}',
              '30'::jsonb,
              true
            ),
            '{convocatoria,antelacionDias,SA,fuente}',
            '"LEY"'::jsonb,
            true
          ),
          '{convocatoria,antelacionDias,SA,referencia}',
          '"art. 176.1 LSC"'::jsonb,
          true
        )
      ELSE payload
    END AS payload
  FROM source_versions
),
fixed AS (
  SELECT
    nf.pack_id,
    nf.new_version,
    nf.supersedes_version_id,
    CASE nf.sl_majority_class
      WHEN 'simple' THEN jsonb_set(nf.payload, '{votacion,mayoria,SL}', c.sl_simple_majority, true)
      WHEN 'half' THEN jsonb_set(nf.payload, '{votacion,mayoria,SL}', c.sl_half_majority, true)
      ELSE nf.payload
    END AS fixed_payload
  FROM notice_fixed nf
  CROSS JOIN constants c
)
INSERT INTO rule_pack_versions (
  pack_id,
  version,
  payload,
  is_active,
  status,
  effective_from,
  effective_to,
  approved_at,
  payload_hash,
  supersedes_version_id
)
SELECT
  pack_id,
  new_version,
  fixed_payload,
  true,
  'ACTIVE',
  now(),
  null,
  now(),
  encode(extensions.digest(fixed_payload::text, 'sha256'), 'hex'),
  supersedes_version_id
FROM fixed
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true,
  status = 'ACTIVE',
  effective_from = COALESCE(rule_pack_versions.effective_from, EXCLUDED.effective_from),
  effective_to = null,
  approved_at = EXCLUDED.approved_at,
  payload_hash = EXCLUDED.payload_hash,
  supersedes_version_id = EXCLUDED.supersedes_version_id;

WITH source AS (
  SELECT
    rpv.id AS supersedes_version_id,
    jsonb_set(
      jsonb_set(rpv.payload, '{id}', '"AUTORIZACION_GARANTIA_CONSEJO"'::jsonb, true),
      '{organoTipo}',
      '"CONSEJO"'::jsonb,
      true
    ) AS fixed_payload
  FROM rule_pack_versions rpv
  WHERE rpv.pack_id = 'AUTORIZACION_GARANTIA'
    AND rpv.version = '1.1.0'
)
INSERT INTO rule_pack_versions (
  pack_id,
  version,
  payload,
  is_active,
  status,
  effective_from,
  effective_to,
  approved_at,
  payload_hash,
  supersedes_version_id
)
SELECT
  'AUTORIZACION_GARANTIA_CONSEJO',
  '1.1.0',
  fixed_payload,
  true,
  'ACTIVE',
  now(),
  null,
  now(),
  encode(extensions.digest(fixed_payload::text, 'sha256'), 'hex'),
  supersedes_version_id
FROM source
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true,
  status = 'ACTIVE',
  effective_from = COALESCE(rule_pack_versions.effective_from, EXCLUDED.effective_from),
  effective_to = null,
  approved_at = EXCLUDED.approved_at,
  payload_hash = EXCLUDED.payload_hash,
  supersedes_version_id = EXCLUDED.supersedes_version_id;

WITH archive_targets AS (
  SELECT *
  FROM (VALUES
    ('APROBACION_CUENTAS', '1.0.0'),
    ('APROBACION_CUENTAS', 'v1.0.0'),
    ('APLICACION_RESULTADO', 'v1.0.0'),
    ('AUMENTO_CAPITAL', '1.0.0'),
    ('AUMENTO_CAPITAL', 'v1.0.0'),
    ('AUTORIZACION_GARANTIA', '1.0.0'),
    ('AUTORIZACION_GARANTIA', '1.1.0'),
    ('CESE_CONSEJERO', '1.0.0'),
    ('DELEGACION_FACULTADES', '1.0.0'),
    ('DISTRIBUCION_DIVIDENDOS', '1.0.0'),
    ('MODIFICACION_ESTATUTOS', '1.0.0'),
    ('NOMBRAMIENTO_CONSEJERO', '1.0.0'),
    ('NOMBRAMIENTO_AUDITOR', '1.0.0'),
    ('NOMBRAMIENTO_AUDITOR', '1.1.0'),
    ('OPERACION_VINCULADA', '1.1.0'),
    ('RATIFICACION_ACTOS', '1.0.0'),
    ('REDUCCION_CAPITAL', '1.0.0'),
    ('REDUCCION_CAPITAL', 'v1.0.0')
  ) AS t(pack_id, version)
)
UPDATE rule_pack_versions rpv
SET
  is_active = false,
  status = 'RETIRED',
  effective_to = COALESCE(rpv.effective_to, now())
FROM archive_targets t
WHERE rpv.pack_id = t.pack_id
  AND rpv.version = t.version
  AND rpv.is_active = true;
