-- Lote 2 - Saneamiento schema/NA de rule packs Secretaria 360.
-- Alcance offline: cerrar payloads_incompletos y schema_contract_errors
-- despues de publicar Lote 1. No ejecuta escritura hasta ventana writer.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

CREATE TEMP TABLE tgms_lote2_expected (
  pack_id text PRIMARY KEY,
  materia text NOT NULL,
  organo_tipo text NOT NULL,
  rule_pack_version_id uuid NOT NULL,
  version text NOT NULL,
  expected_db_payload_hash text NOT NULL,
  requires_lote1 boolean NOT NULL DEFAULT false,
  expected_after_lote1_hash text
) ON COMMIT DROP;

INSERT INTO tgms_lote2_expected (
  pack_id,
  materia,
  organo_tipo,
  rule_pack_version_id,
  version,
  expected_db_payload_hash,
  requires_lote1,
  expected_after_lote1_hash
)
VALUES
  ('ACUERDO_CONVOCATORIA_JUNTA', 'ACUERDO_CONVOCATORIA_JUNTA', 'CONSEJO', '710f7ebd-4ba0-4cc3-8e44-1ae505119b18'::uuid, '1.0.0', '514d3bd6bbcb5143bada398b47ff39cf722fa2e2fa7f3d204e64a960b169535d', false, null),
  ('APLICACION_RESULTADO', 'APLICACION_RESULTADO', 'JUNTA_GENERAL', '7f6827ab-b408-4543-9eaa-08bb0e97a375'::uuid, '1.0.1', '9d672605ebe7f797d3345f918d5ca8772deb7d04ebd87dd4956bd89d050539d6', false, null),
  ('APROBACION_PLAN_NEGOCIO', 'APROBACION_PLAN_NEGOCIO', 'CONSEJO', '060cb4c1-3c23-4a70-928e-c5338e74c699'::uuid, '1.0.0', 'f6ac865f8c719a53361d91fb63eabd88092361224c501256584d532df1dcc32f', false, null),
  ('APROBACION_PRESUPUESTO', 'APROBACION_PRESUPUESTO', 'CONSEJO', '558f2a38-92f8-4aef-9414-1094fd8ef0ac'::uuid, '1.0.0', 'defe39f068417bfe6e186ec4dd650c31fb3ed1d09cb78a93cc17bef9059ef09d', false, null),
  ('APROBACION_REGLAMENTO_CONSEJO', 'APROBACION_REGLAMENTO_CONSEJO', 'CONSEJO', '807f042d-9451-4a26-9ca0-b731ae42a8fc'::uuid, '1.0.0', '348aa1f0743c69f88392511311c55d55dca167e3d478ef3f089725f3df473cdb', false, null),
  ('AUMENTO_CAPITAL_NO_DINERARIO', 'AUMENTO_CAPITAL_NO_DINERARIO', 'JUNTA_GENERAL', '4abb47ee-9eda-4d24-937a-f98f0bcdbbad'::uuid, 'v1.0.0', 'c3d9d8b6b580e6f1fe69075d0ef63b510dfdc42b2bf7b3d6ace5827338b738b8', false, null),
  ('AUTORIZACION_GARANTIA_CONSEJO', 'AUTORIZACION_GARANTIA', 'CONSEJO', '07afa00f-a0bb-4ab1-9c82-b3e908e46606'::uuid, '1.1.0', '34e6deeae105948a3b1c7c4fc3dccd89e4e81640e2d38800ac51196d773e3967', false, null),
  ('CESE_CONSEJERO', 'CESE_CONSEJERO', 'JUNTA_GENERAL', '4a97f0a9-b5e3-4e85-9829-d2fde0348483'::uuid, '1.0.1', '7610b59461570a6ab2afb49b5af579b1c221b6c3f23e9db1b26cc485795ceee6', true, 'c176d933c3363106690404cad512591efaeee646cbe55498d6cf050cb0fb4d7f'),
  ('CESION_GLOBAL_ACTIVO', 'CESION_GLOBAL_ACTIVO', 'JUNTA_GENERAL', 'ce5d8a12-9655-4b96-88e8-35dccde6dc29'::uuid, 'v1.0.0', 'b08a8cf6fcc99ad65a3a21626dc6dcb15d27033d70fc9df4b82119e86da6e168', false, null),
  ('CONTRATOS_SOCIO_UNICO_SOCIEDAD', 'CONTRATOS_SOCIO_UNICO_SOCIEDAD', 'SOCIO_UNICO', '94b4ed4a-250a-45e7-9cb8-a3f890bdb62a'::uuid, '1.0.0', '9ae81e64157f33e955778acf1acd93f05d13788a26cebf9186e57198ea39ad48', false, null),
  ('CUENTAS_CONSOLIDADAS', 'CUENTAS_CONSOLIDADAS', 'CONSEJO', '3ff3dc3c-218e-4f45-849d-dce16a29b730'::uuid, '1.0.0', '9680ed0a2d64b2e837a81f2b77ffdcbe7ba9af4991014dd60df0098912e03ab1', false, null),
  ('DELEGACION_FACULTADES', 'DELEGACION_FACULTADES', 'CONSEJO', '36a3b08c-c05e-4f4b-846a-2985656d8c43'::uuid, '1.1.0', 'bc1c75f543a04da3cc3636d5a6428aec30e981ee52b60ab92a532ec323b6c4b2', false, null),
  ('DISOLUCION', 'DISOLUCION', 'JUNTA_GENERAL', 'cf2f5a40-e47c-48e8-9a0f-1bddfb65da7e'::uuid, 'v1.0.0', '295e4681fa7092277c355804468665818ce5cbd2de46e6e6ae8547d5b971e411', false, null),
  ('DISTRIBUCION_CARGOS', 'DISTRIBUCION_CARGOS', 'CONSEJO', 'bdf4e7b0-0890-4f74-bfc1-4f7401f6eb9d'::uuid, '1.0.0', '8b2c3f2e66df394fe79bd449a0793668154ceff6dba68474ae2dacc78a6951d1', false, null),
  ('EJECUCION_AUMENTO_DELEGADO', 'EJECUCION_AUMENTO_DELEGADO', 'CONSEJO', 'b83d9df4-7690-4eb9-b726-d3de3e8d87f3'::uuid, '1.0.0', '337ff4bdf52247fa290ede371e0c01bb8e3f60d0102a125d087ea5612b43233b', false, null),
  ('EMISION_OBLIGACIONES', 'EMISION_OBLIGACIONES', 'JUNTA_GENERAL', '5951215d-cbe1-46c8-b553-26e511f0d3ac'::uuid, 'v1.0.0', '6fba363ec91abde13bfda6581aab8718cddaa50e6ead28fd7b87824666a1b79c', false, null),
  ('ESCISION', 'ESCISION', 'JUNTA_GENERAL', '77177821-9ed8-49bf-b7a1-087939530639'::uuid, 'v1.0.0', '4f0d3425ae001db38b919810536174ab1000f61cadcc4a7066127eeb0e847844', true, '157cbfc1277a395cdd5d3c6558b5db53622e2e9dde4c01fa96a93579a002b564'),
  ('EXCLUSION_SOCIO', 'EXCLUSION_SOCIO', 'JUNTA_GENERAL', 'e0418837-6f71-434e-bda8-98b809f1cd93'::uuid, '1.0.0', 'b0341d37ff36602b9795a3990461b859e26ccb87507dad76dcedf3ad7d3491b0', true, '78dfc5a2186cf55eaf1338cdc0a000a49e91d5f9a21aa44d90cfa2f16803184b'),
  ('FORMULACION_CUENTAS', 'FORMULACION_CUENTAS', 'CONSEJO', '5a43f95d-0589-4888-afdf-147405e0b44e'::uuid, 'v1.0.0', '4ceb9c22c951fbf058834da9982719ac878b8d177ab2377d0f8ed5068904beb3', false, null),
  ('FUSION', 'FUSION', 'JUNTA_GENERAL', 'f274e1db-3a26-485b-b3a7-20fd0a2a0fb7'::uuid, 'v1.0.0', '7fe66174fa50728fed64d9ea2deb7ff634a6983a20eb1b3dd7974f37c3729e70', true, 'acf72457801166a62de87aa6e62e1d7eeff59ed49f0bcf03f1eb14931fc908e8'),
  ('INFORME_GESTION', 'INFORME_GESTION', 'CONSEJO', 'c642e22b-dcd9-42bb-8e7f-085ba2b38abe'::uuid, '1.0.0', '7515fe77fb1e070f341742d3cdd3dbcd5ac3307572fa962844b7ef9397cdd761', false, null),
  ('MOD_ESTATUTOS', 'MOD_ESTATUTOS', 'JUNTA_GENERAL', 'd8ac0b64-d438-48d2-b688-13b601902f5b'::uuid, 'v1.0.0', '4967b437bd9acaf2734fdf0cf71c26a1ba15126e3a9ca508f6c421b820bc33a6', true, '0da02d10692498669365db162dad4afc36e44c285c87fa14202a75140468cd87'),
  ('OPERACION_VINCULADA', 'OPERACION_VINCULADA', 'CONSEJO', '05fd0c53-ec36-4e3b-8c4d-f55da7498ce5'::uuid, '1.0.0', '2c423229b6d7ee112b93cd25ec26fcb9f69105bbdb2a81a3d63547ae6b1ac5cf', false, null),
  ('PODER_REPRESENTACION', 'PODER_REPRESENTACION', 'CONSEJO', '84303883-9aba-46c5-8491-717098d8747c'::uuid, '1.0.0', '78d5e1b334a109f0afbd6779793cfb8f7358b3740dd3588602579de51b007e59', false, null),
  ('PRESTACIONES_ACCESORIAS', 'PRESTACIONES_ACCESORIAS', 'JUNTA_GENERAL', '005eebc0-8920-443d-8603-c86cb3b79908'::uuid, '1.0.0', 'bc727959abac55bc0b43fb1656cda4161c9af4a78d5ec437e0c28e4d36fcec4a', false, null),
  ('RATIFICACION_ACTOS', 'RATIFICACION_ACTOS', 'CONSEJO', '8476e78f-ac8b-437f-81a6-d9bb46793ea4'::uuid, '1.1.0', '8b69575b8da11c03ee35c0aa25cf8814c31156fbdda864439779f250cae9bc34', false, null),
  ('RETRIBUCION_ADMIN', 'RETRIBUCION_ADMIN', 'JUNTA_GENERAL', '29cb30ef-a4e9-4b32-8031-63a35f87ea19'::uuid, 'v1.0.0', '033f7f1da060194c27482016645275fa6b960fc3ca8c27fabcb6ddb0a05a7d5b', false, null),
  ('SEPARACION_SOCIO', 'SEPARACION_SOCIO', 'SOPORTE_INTERNO', '2735e7d3-61ab-469e-ac8e-3aaa922c812b'::uuid, '1.0.0', 'b2d4bc59525a7c00c43a968b920eaeb969dc010c141e5a405953f515f41c9790', false, null),
  ('SOCIEDAD_UNIPERSONAL', 'SOCIEDAD_UNIPERSONAL', 'SOCIO_UNICO', 'add24bc6-e4ca-4b07-960b-c40858b4895c'::uuid, '1.0.0', '8a80cfc5340fe2d66d81afc2a5304fd530a8c431a1a9323831f621c2fce06b69', false, null),
  ('SUPRESION_PREFERENTE', 'SUPRESION_PREFERENTE', 'JUNTA_GENERAL', 'a2f842ae-ba87-4293-9742-bd3ba95ad5b7'::uuid, 'v1.0.0', '86833269b115f6fde2724cd5cb35b5ceff4304e0b31679f4ddac07a38a88349f', true, 'ce98a9c06c706b39bd4fb590f0c91f4801ac259af29fdc0d9d0c80c587eea73a'),
  ('TRANSFORMACION', 'TRANSFORMACION', 'JUNTA_GENERAL', '2794af7f-acec-43f7-a086-bea253513367'::uuid, 'v1.0.0', 'ddaf544b90dcf8eb6ed5393b83d136178c633273f4d19d57337b0fba1d7b561f', false, null),
  ('TRANSMISION_PARTICIPACIONES', 'TRANSMISION_PARTICIPACIONES', 'JUNTA_GENERAL', '6a3e991a-057f-45c9-8556-77d89589c5d1'::uuid, '1.0.0', 'ceaf91cfc1557555611b0075e7f0ff289531f9d900022a72704e9527d43d11d9', false, null),
  ('TRASLADO_DOMICILIO_NACIONAL', 'TRASLADO_DOMICILIO_NACIONAL', 'CONSEJO', '1c36ee91-4f5b-4040-8e59-8b53a3fddfb2'::uuid, '1.0.0', '6c80eb2109b50c2cf55562f87286676a53ae8ee07270fb5ff0c52562c1e345b3', false, null);

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_json_semantic(p_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL
    WHEN jsonb_typeof(p_value) = 'object' AND p_value ? 'valor' THEN p_value -> 'valor'
    WHEN jsonb_typeof(p_value) = 'object' AND p_value ? 'formula' THEN p_value -> 'formula'
    WHEN jsonb_typeof(p_value) = 'object' AND p_value ? 'umbral' THEN p_value -> 'umbral'
    ELSE p_value
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_number_ok(p_value jsonb, p_allow_na boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN false
    WHEN p_allow_na AND pg_temp.tgms_lote2_json_semantic(p_value) = '"NA"'::jsonb THEN true
    ELSE jsonb_typeof(pg_temp.tgms_lote2_json_semantic(p_value)) = 'number'
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_string_ok(p_value jsonb, p_allow_na boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN false
    WHEN p_allow_na AND pg_temp.tgms_lote2_json_semantic(p_value) = '"NA"'::jsonb THEN true
    ELSE jsonb_typeof(pg_temp.tgms_lote2_json_semantic(p_value)) = 'string'
      AND pg_temp.tgms_lote2_json_semantic(p_value) <> '""'::jsonb
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_array_ok(p_value jsonb, p_allow_na boolean)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN false
    WHEN jsonb_typeof(p_value) <> 'array' THEN false
    WHEN p_allow_na THEN true
    ELSE jsonb_array_length(p_value) > 0
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_boolean_ok(p_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_value IS NOT NULL
    AND jsonb_typeof(pg_temp.tgms_lote2_json_semantic(p_value)) = 'boolean';
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_set_if_missing(
  p_payload jsonb,
  p_path text[],
  p_value jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_payload #> p_path IS NULL THEN jsonb_set(p_payload, p_path, p_value, true)
    ELSE p_payload
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_append_doc(
  p_payload jsonb,
  p_doc jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_payload #> '{documentacion,obligatoria}', '[]'::jsonb)) AS existing(doc)
      WHERE existing.doc ->> 'id' = p_doc ->> 'id'
    )
      THEN p_payload
    ELSE jsonb_set(
      p_payload,
      '{documentacion,obligatoria}',
      COALESCE(p_payload #> '{documentacion,obligatoria}', '[]'::jsonb) || jsonb_build_array(p_doc),
      true
    )
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_prepare_parents(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    p_payload,
                    '{convocatoria}',
                    COALESCE(p_payload -> 'convocatoria', '{}'::jsonb),
                    true
                  ),
                  '{convocatoria,antelacionDias}',
                  COALESCE(p_payload #> '{convocatoria,antelacionDias}', '{}'::jsonb),
                  true
                ),
                '{convocatoria,canales}',
                COALESCE(p_payload #> '{convocatoria,canales}', '{}'::jsonb),
                true
              ),
              '{constitucion}',
              COALESCE(p_payload -> 'constitucion', '{}'::jsonb),
              true
            ),
            '{constitucion,quorum}',
            COALESCE(p_payload #> '{constitucion,quorum}', '{}'::jsonb),
            true
          ),
          '{votacion}',
          COALESCE(p_payload -> 'votacion', '{}'::jsonb),
          true
        ),
        '{votacion,mayoria}',
        COALESCE(p_payload #> '{votacion,mayoria}', '{}'::jsonb),
        true
      ),
      '{documentacion}',
      COALESCE(p_payload -> 'documentacion', '{}'::jsonb),
      true
    ),
    '{postAcuerdo}',
    COALESCE(p_payload -> 'postAcuerdo', '{}'::jsonb),
    true
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_set_junta_contract(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pg_temp.tgms_lote2_set_if_missing(
    pg_temp.tgms_lote2_set_if_missing(
      pg_temp.tgms_lote2_set_if_missing(
        pg_temp.tgms_lote2_set_if_missing(
          pg_temp.tgms_lote2_set_if_missing(
            pg_temp.tgms_lote2_prepare_parents(p_payload),
            ARRAY['convocatoria', 'antelacionDias', 'SA'],
            '{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"}'::jsonb
          ),
          ARRAY['convocatoria', 'antelacionDias', 'SL'],
          '{"valor":15,"fuente":"LEY","referencia":"art. 176.2 LSC"}'::jsonb
        ),
        ARRAY['convocatoria', 'canales', 'SA'],
        '["BORME","WEB_INSCRITA","PUBLICACION_ESTATUTOS"]'::jsonb
      ),
      ARRAY['convocatoria', 'canales', 'SL'],
      '["COMUNICACION_INDIVIDUAL_ESCRITA"]'::jsonb
    ),
    ARRAY['convocatoria', 'contenidoMinimo'],
    '["fecha_hora_lugar","orden_dia","derecho_informacion_si_procede"]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_set_non_junta_contract(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pg_temp.tgms_lote2_set_if_missing(
    pg_temp.tgms_lote2_set_if_missing(
      pg_temp.tgms_lote2_set_if_missing(
        pg_temp.tgms_lote2_set_if_missing(
          pg_temp.tgms_lote2_set_if_missing(
            pg_temp.tgms_lote2_set_if_missing(
              pg_temp.tgms_lote2_set_if_missing(
                pg_temp.tgms_lote2_set_if_missing(
                  pg_temp.tgms_lote2_set_if_missing(
                    pg_temp.tgms_lote2_set_if_missing(
                      pg_temp.tgms_lote2_set_if_missing(
                        pg_temp.tgms_lote2_prepare_parents(p_payload),
                        ARRAY['convocatoria', 'antelacionDias', 'SA'],
                        '{"valor":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
                      ),
                      ARRAY['convocatoria', 'antelacionDias', 'SL'],
                      '{"valor":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
                    ),
                    ARRAY['convocatoria', 'canales', 'SA'],
                    '[]'::jsonb
                  ),
                  ARRAY['convocatoria', 'canales', 'SL'],
                  '[]'::jsonb
                ),
                ARRAY['convocatoria', 'contenidoMinimo'],
                '[]'::jsonb
              ),
              ARRAY['constitucion', 'quorum', 'SA_1a'],
              '{"valor":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
            ),
            ARRAY['constitucion', 'quorum', 'SA_2a'],
            '{"valor":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
          ),
          ARRAY['constitucion', 'quorum', 'SL'],
          '{"valor":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
        ),
        ARRAY['votacion', 'mayoria', 'SA'],
        '{"formula":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
      ),
      ARRAY['votacion', 'mayoria', 'SL'],
      '{"formula":"NA","fuente":"NO_APLICA","referencia":"Organo no Junta General"}'::jsonb
    ),
    ARRAY['documentacion', 'obligatoria'],
    COALESCE(p_payload #> '{documentacion,obligatoria}', '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_set_docs_contract(
  p_pack_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_pack_id
    WHEN 'CESE_CONSEJERO' THEN
      pg_temp.tgms_lote2_append_doc(
        pg_temp.tgms_lote2_append_doc(
          p_payload,
          '{"id":"identificacion_cargo","nombre":"Identificacion del cargo afectado","condicion":"SIEMPRE"}'::jsonb
        ),
        '{"id":"causa_o_subtipo","nombre":"Causa o subtipo del cese","condicion":"SIEMPRE"}'::jsonb
      )
    WHEN 'DISOLUCION' THEN
      pg_temp.tgms_lote2_append_doc(
        p_payload,
        '{"id":"NA","nombre":"No aplica documento obligatorio especifico","condicion":"NO_APLICA"}'::jsonb
      )
    WHEN 'SOCIEDAD_UNIPERSONAL' THEN
      pg_temp.tgms_lote2_append_doc(
        p_payload,
        '{"id":"NA","nombre":"Decision de socio unico sin documento obligatorio previo","condicion":"NO_APLICA"}'::jsonb
      )
    ELSE p_payload
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_apply_patch(
  p_pack_id text,
  p_organo_tipo text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_pack_id
    WHEN 'SOCIEDAD_UNIPERSONAL' THEN
      jsonb_set(
        jsonb_set(
          pg_temp.tgms_lote2_set_docs_contract(
            p_pack_id,
            pg_temp.tgms_lote2_set_non_junta_contract(p_payload)
          ),
          '{postAcuerdo,instrumentoRequerido}',
          '"NINGUNO"'::jsonb,
          true
        ),
        '{postAcuerdo,publicacionRequerida}',
        'false'::jsonb,
        true
      )
    ELSE
      pg_temp.tgms_lote2_set_docs_contract(
        p_pack_id,
        CASE
          WHEN p_organo_tipo = 'JUNTA_GENERAL'
            THEN pg_temp.tgms_lote2_set_junta_contract(p_payload)
          ELSE pg_temp.tgms_lote2_set_non_junta_contract(p_payload)
        END
      )
  END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.tgms_lote2_is_fixed(
  p_organo_tipo text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    pg_temp.tgms_lote2_number_ok(p_payload #> '{convocatoria,antelacionDias,SA}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_number_ok(p_payload #> '{convocatoria,antelacionDias,SL}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_array_ok(p_payload #> '{convocatoria,canales,SA}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_array_ok(p_payload #> '{convocatoria,canales,SL}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_array_ok(COALESCE(p_payload #> '{convocatoria,contenidoMinimo}', p_payload #> '{acta,contenidoMinimo,sesion}'), p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_number_ok(p_payload #> '{constitucion,quorum,SA_1a}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_number_ok(p_payload #> '{constitucion,quorum,SA_2a}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_number_ok(p_payload #> '{constitucion,quorum,SL}', true)
    AND pg_temp.tgms_lote2_string_ok(p_payload #> '{votacion,mayoria,SA}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_string_ok(p_payload #> '{votacion,mayoria,SL}', p_organo_tipo <> 'JUNTA_GENERAL')
    AND pg_temp.tgms_lote2_array_ok(COALESCE(p_payload #> '{documentacion,obligatoria}', p_payload -> 'documentacionObligatoria'), false)
    AND pg_temp.tgms_lote2_boolean_ok(COALESCE(p_payload #> '{postAcuerdo,inscribible}', p_payload #> '{inscripcion,inscribible}'))
    AND pg_temp.tgms_lote2_string_ok(COALESCE(p_payload #> '{postAcuerdo,instrumentoRequerido}', p_payload #> '{inscripcion,instrumentoRequerido}'), false)
    AND pg_temp.tgms_lote2_boolean_ok(COALESCE(p_payload #> '{postAcuerdo,publicacionRequerida}', p_payload #> '{inscripcion,publicacionRequerida}'));
$$;

DO $$
DECLARE
  v_count integer;
  v_bad text;
BEGIN
  SELECT count(*) INTO v_count
  FROM tgms_lote2_expected;

  IF v_count <> 33 THEN
    RAISE EXCEPTION 'Lote 2 expected table drift: expected 33 rows, got %', v_count;
  END IF;

  SELECT string_agg(e.pack_id || ':' || e.version, ', ' ORDER BY e.pack_id) INTO v_bad
  FROM tgms_lote2_expected e
  LEFT JOIN public.rule_pack_versions rpv
    ON rpv.id = e.rule_pack_version_id
   AND rpv.pack_id = e.pack_id
   AND rpv.version = e.version
   AND rpv.is_active = true
  WHERE rpv.id IS NULL;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Lote 2 missing or inactive target rows: %', v_bad;
  END IF;

  SELECT string_agg(e.pack_id || ':' || rpv.payload_hash, ', ' ORDER BY e.pack_id) INTO v_bad
  FROM tgms_lote2_expected e
  JOIN public.rule_pack_versions rpv
    ON rpv.id = e.rule_pack_version_id
  WHERE e.requires_lote1
    AND rpv.payload_hash <> e.expected_after_lote1_hash
    AND NOT pg_temp.tgms_lote2_is_fixed(e.organo_tipo, rpv.payload);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Lote 2 requires Lote 1 applied first for overlapping rows: %', v_bad;
  END IF;

  SELECT string_agg(e.pack_id || ':' || rpv.payload_hash, ', ' ORDER BY e.pack_id) INTO v_bad
  FROM tgms_lote2_expected e
  JOIN public.rule_pack_versions rpv
    ON rpv.id = e.rule_pack_version_id
  WHERE rpv.payload_hash <> e.expected_db_payload_hash
    AND (e.expected_after_lote1_hash IS NULL OR rpv.payload_hash <> e.expected_after_lote1_hash)
    AND NOT pg_temp.tgms_lote2_is_fixed(e.organo_tipo, rpv.payload);

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Lote 2 payload drift before patch: %', v_bad;
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT rpv.pack_id
    FROM public.rule_pack_versions rpv
    JOIN tgms_lote2_expected e ON e.pack_id = rpv.pack_id
    WHERE rpv.is_active = true
    GROUP BY rpv.pack_id
    HAVING count(*) > 1
  ) duplicates;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Lote 2 active duplicate targets detected: %', v_count;
  END IF;

  PERFORM rpv.id
  FROM public.rule_pack_versions rpv
  JOIN tgms_lote2_expected e
    ON e.rule_pack_version_id = rpv.id
  FOR UPDATE OF rpv;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 33 THEN
    RAISE EXCEPTION 'Lote 2 row lock count mismatch: expected 33, got %', v_count;
  END IF;
END $$;

CREATE TEMP TABLE tgms_lote2_patch ON COMMIT DROP AS
WITH source AS (
  SELECT
    rpv.id,
    rpv.pack_id,
    e.materia,
    e.organo_tipo,
    rpv.version,
    rpv.payload AS old_payload,
    rpv.payload_hash AS old_hash,
    pg_temp.tgms_lote2_apply_patch(e.pack_id, e.organo_tipo, rpv.payload) AS new_payload
  FROM public.rule_pack_versions rpv
  JOIN tgms_lote2_expected e
    ON e.rule_pack_version_id = rpv.id
  WHERE NOT pg_temp.tgms_lote2_is_fixed(e.organo_tipo, rpv.payload)
    AND (
      rpv.payload_hash = e.expected_db_payload_hash
      OR rpv.payload_hash = e.expected_after_lote1_hash
    )
)
SELECT
  source.*,
  encode(extensions.digest(source.new_payload::text, 'sha256'), 'hex') AS new_hash
FROM source
WHERE source.old_payload IS DISTINCT FROM source.new_payload;

INSERT INTO public.audit_log (
  tenant_id,
  action,
  object_type,
  object_id,
  previous_hash,
  current_hash,
  delta
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX',
  'rule_pack_versions',
  p.id,
  p.old_hash,
  p.new_hash,
  jsonb_build_object(
    'migration', '20260521102000_secretaria_rulepacks_lote2_schema_fix',
    'pack_id', p.pack_id,
    'materia', p.materia,
    'organo_tipo', p.organo_tipo,
    'version', p.version,
    'before_payload', p.old_payload,
    'after_payload', p.new_payload,
    'reason', 'Fase 1 Lote 2: saneamiento de contrato schema/NA sin cambios de equivalencia legal'
  )
FROM tgms_lote2_patch p;

UPDATE public.rule_pack_versions rpv
SET
  payload = p.new_payload,
  payload_hash = p.new_hash,
  status = 'ACTIVE',
  is_active = true,
  approved_at = COALESCE(rpv.approved_at, now())
FROM tgms_lote2_patch p
WHERE rpv.id = p.id
  AND rpv.payload_hash = p.old_hash;

DO $$
DECLARE
  v_count integer;
  v_bad text;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rule_pack_versions rpv
  JOIN tgms_lote2_expected e
    ON e.rule_pack_version_id = rpv.id
  WHERE pg_temp.tgms_lote2_is_fixed(e.organo_tipo, rpv.payload);

  IF v_count <> 33 THEN
    SELECT string_agg(e.pack_id, ', ' ORDER BY e.pack_id) INTO v_bad
    FROM tgms_lote2_expected e
    JOIN public.rule_pack_versions rpv
      ON rpv.id = e.rule_pack_version_id
    WHERE NOT pg_temp.tgms_lote2_is_fixed(e.organo_tipo, rpv.payload);

    RAISE EXCEPTION 'Lote 2 postflight failed: fixed rows %, pending %', v_count, v_bad;
  END IF;
END $$;

COMMIT;
