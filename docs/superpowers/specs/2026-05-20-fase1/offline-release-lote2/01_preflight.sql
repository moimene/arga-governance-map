-- Preflight Lote 2 - schema/NA rule packs Secretaria 360.
-- Ejecutar contra governance_OS en conexion writer 5432 antes de 02_patch.sql.

select
  current_database() as database_name,
  current_user as db_user,
  current_setting('transaction_read_only') as transaction_read_only,
  pg_is_in_recovery() as pg_is_in_recovery;

with expected(pack_id, materia, organo_tipo, rule_pack_version_id, version, expected_db_payload_hash, requires_lote1, expected_after_lote1_hash) as (
  values
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
    ('TRASLADO_DOMICILIO_NACIONAL', 'TRASLADO_DOMICILIO_NACIONAL', 'CONSEJO', '1c36ee91-4f5b-4040-8e59-8b53a3fddfb2'::uuid, '1.0.0', '6c80eb2109b50c2cf55562f87286676a53ae8ee07270fb5ff0c52562c1e345b3', false, null)
)
select
  count(*) as expected_rows,
  count(*) filter (where rpv.id is not null and rpv.is_active) as active_rows_found,
  count(*) filter (where rpv.payload_hash = expected.expected_db_payload_hash) as rows_at_baseline_hash,
  count(*) filter (where expected.requires_lote1 and rpv.payload_hash = expected.expected_after_lote1_hash) as lote1_overlap_ready_rows,
  count(*) filter (
    where rpv.id is not null
      and rpv.payload_hash <> expected.expected_db_payload_hash
      and (expected.expected_after_lote1_hash is null or rpv.payload_hash <> expected.expected_after_lote1_hash)
  ) as drift_rows
from expected
left join public.rule_pack_versions rpv
  on rpv.id = expected.rule_pack_version_id
 and rpv.pack_id = expected.pack_id
 and rpv.version = expected.version;

with expected(pack_id, rule_pack_version_id, requires_lote1, expected_after_lote1_hash) as (
  values
    ('CESE_CONSEJERO', '4a97f0a9-b5e3-4e85-9829-d2fde0348483'::uuid, true, 'c176d933c3363106690404cad512591efaeee646cbe55498d6cf050cb0fb4d7f'),
    ('ESCISION', '77177821-9ed8-49bf-b7a1-087939530639'::uuid, true, '157cbfc1277a395cdd5d3c6558b5db53622e2e9dde4c01fa96a93579a002b564'),
    ('EXCLUSION_SOCIO', 'e0418837-6f71-434e-bda8-98b809f1cd93'::uuid, true, '78dfc5a2186cf55eaf1338cdc0a000a49e91d5f9a21aa44d90cfa2f16803184b'),
    ('FUSION', 'f274e1db-3a26-485b-b3a7-20fd0a2a0fb7'::uuid, true, 'acf72457801166a62de87aa6e62e1d7eeff59ed49f0bcf03f1eb14931fc908e8'),
    ('MOD_ESTATUTOS', 'd8ac0b64-d438-48d2-b688-13b601902f5b'::uuid, true, '0da02d10692498669365db162dad4afc36e44c285c87fa14202a75140468cd87'),
    ('SUPRESION_PREFERENTE', 'a2f842ae-ba87-4293-9742-bd3ba95ad5b7'::uuid, true, 'ce98a9c06c706b39bd4fb590f0c91f4801ac259af29fdc0d9d0c80c587eea73a')
)
select
  expected.pack_id,
  rpv.payload_hash as current_payload_hash,
  expected.expected_after_lote1_hash,
  (rpv.payload_hash = expected.expected_after_lote1_hash) as lote1_ready
from expected
join public.rule_pack_versions rpv on rpv.id = expected.rule_pack_version_id
order by expected.pack_id;
