-- 2026-05-12-plantillas-baseline.sql
-- Snapshot read-only del catálogo plantillas_protegidas para tenant demo ARGA.
-- Fecha: 2026-05-12. Generado durante Sprint 1 baseline.
-- Spec: docs/superpowers/specs/2026-05-12-gestor-plantillas-sprint1-design.md §2.

-- 1. Counts por estado
SELECT estado, COUNT(*) AS n
FROM plantillas_protegidas
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
GROUP BY estado
ORDER BY estado;
-- Resultado esperado: ACTIVA 41, ARCHIVADA 35
-- Resultado real:
-- [{"estado":"ACTIVA","n":41},{"estado":"ARCHIVADA","n":35}]

-- 2. Counts ACTIVA por tipo
SELECT tipo, COUNT(*) AS n
FROM plantillas_protegidas
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND estado = 'ACTIVA'
GROUP BY tipo
ORDER BY n DESC, tipo;
-- Resultado real:
-- [{"tipo":"MODELO_ACUERDO","n":25},
--  {"tipo":"ACTA_SESION","n":3},
--  {"tipo":"CONVOCATORIA","n":3},
--  {"tipo":"ACTA_CONSIGNACION","n":2},
--  {"tipo":"ACTA_ACUERDO_ESCRITO","n":1},
--  {"tipo":"ACTA_DECISION_CONJUNTA","n":1},
--  {"tipo":"ACTA_ORGANO_ADMIN","n":1},
--  {"tipo":"CERTIFICACION","n":1},
--  {"tipo":"CONVOCATORIA_SL_NOTIFICACION","n":1},
--  {"tipo":"INFORME_DOCUMENTAL_PRE","n":1},
--  {"tipo":"INFORME_GESTION","n":1},
--  {"tipo":"INFORME_PRECEPTIVO","n":1}]

-- 3. IDs y materia de las plantillas ACTIVA
SELECT id, tipo, COALESCE(materia_acuerdo, materia) AS materia,
       organo_tipo, adoption_mode, version
FROM plantillas_protegidas
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND estado = 'ACTIVA'
ORDER BY tipo, materia;
-- Resultado real:
-- [
--  {"id":"2c15640c-de2f-41ea-aa8d-304147124a6e","tipo":"ACTA_ACUERDO_ESCRITO","materia":"ACUERDO_SIN_SESION","organo_tipo":"JUNTA_GENERAL_O_CONSEJO","adoption_mode":"NO_SESSION","version":"1.3.0"},
--  {"id":"383d7f4c-1df6-42a2-bc5c-df3a4e1685fe","tipo":"ACTA_CONSIGNACION","materia":"DECISION_ADMIN_UNICO","organo_tipo":"ADMIN_UNICO","adoption_mode":"UNIPERSONAL_ADMIN","version":"1.2.1"},
--  {"id":"2d9134d5-7935-4f3c-a6de-de1c6fc35227","tipo":"ACTA_CONSIGNACION","materia":"DECISION_SOCIO_UNICO","organo_tipo":"SOCIO_UNICO","adoption_mode":"UNIPERSONAL_SOCIO","version":"1.2.1"},
--  {"id":"ae44ec3b-ba47-4fd7-a119-5ac70346fdc0","tipo":"ACTA_DECISION_CONJUNTA","materia":"CO_APROBACION","organo_tipo":"ADMIN_CONJUNTA_O_COAPROBADORES","adoption_mode":"CO_APROBACION","version":"1.1.1"},
--  {"id":"b5f436c9-e8e6-4a01-92e7-25fe51ed83f3","tipo":"ACTA_ORGANO_ADMIN","materia":"ADMIN_SOLIDARIO","organo_tipo":"ADMIN_SOLIDARIOS","adoption_mode":"SOLIDARIO","version":"1.1.1"},
--  {"id":"e23480e7-66c4-41a3-8148-bc8ca289e52c","tipo":"ACTA_SESION","materia":"ACTA_COMISION_DELEGADA","organo_tipo":"COMISION_DELEGADA","adoption_mode":"MEETING","version":"1.0.0"},
--  {"id":"77191407-4d5b-4279-b09e-041985026aa4","tipo":"ACTA_SESION","materia":"CONSEJO_ADMIN","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.2.1"},
--  {"id":"b9c17ef0-cf3d-4ba8-a753-7f4dafc2793e","tipo":"ACTA_SESION","materia":"JUNTA_GENERAL","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.2.1"},
--  {"id":"79bc76c7-512e-4734-9849-31cdc73b0e84","tipo":"CERTIFICACION","materia":"CERTIFICACION_ACUERDOS","organo_tipo":"DERIVADO_DEL_ACTO","adoption_mode":null,"version":"1.3.0"},
--  {"id":"c955d5b5-5548-4951-80d9-af1478b9e23d","tipo":"CONVOCATORIA","materia":"CONVOCATORIA_CDA","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.0.0"},
--  {"id":"92ee684b-8a34-4e8c-b3ca-c1827f7fa05f","tipo":"CONVOCATORIA","materia":"CONVOCATORIA_COMISION_DELEGADA","organo_tipo":"COMISION_DELEGADA","adoption_mode":"MEETING","version":"1.0.0"},
--  {"id":"8dcfc85c-9422-4456-aa31-ceea5da6d64d","tipo":"CONVOCATORIA","materia":"CONVOCATORIA_JUNTA","organo_tipo":"ORGANO_ADMIN","adoption_mode":"MEETING","version":"1.2.1"},
--  {"id":"1d7d5671-2588-4071-a9f6-e9b377d337bc","tipo":"CONVOCATORIA_SL_NOTIFICACION","materia":"NOTIFICACION_CONVOCATORIA_SL","organo_tipo":"ORGANO_ADMIN","adoption_mode":"MEETING","version":"1.2.1"},
--  {"id":"62da5ae6-1cff-4a7c-8032-29e489d3e877","tipo":"INFORME_DOCUMENTAL_PRE","materia":"EXPEDIENTE_PRE","organo_tipo":"SOPORTE_INTERNO","adoption_mode":null,"version":"1.1.0"},
--  {"id":"944ff8d4-27e5-453e-82b5-8597b97a7300","tipo":"INFORME_GESTION","materia":"GESTION_SOCIEDAD","organo_tipo":"ORGANO_ADMIN","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"24e1b9cb-9c4c-49a2-9259-d49b5b6647a1","tipo":"INFORME_PRECEPTIVO","materia":"CONVOCATORIA_PRE","organo_tipo":"SOPORTE_INTERNO","adoption_mode":null,"version":"1.1.0"},
--  {"id":"f698a2f2-aa22-41dc-9063-f64a2f0b6219","tipo":"MODELO_ACUERDO","materia":"ACCION_SOCIAL_RESPONSABILIDAD","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.0"},
--  {"id":"0f724a0d-3773-4cdf-a56f-d888fa30126f","tipo":"MODELO_ACUERDO","materia":"ACTIVOS_ESENCIALES","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"c8da1e61-ef2a-4a5c-895b-a5d100916ecf","tipo":"MODELO_ACUERDO","materia":"APROBACION_CUENTAS","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"68da89bc-03cd-4820-80f1-8a549b0c7d78","tipo":"MODELO_ACUERDO","materia":"APROBACION_PLAN_NEGOCIO","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.0.0"},
--  {"id":"2d814072-3fb0-4ffd-a181-875d9c4a5c0d","tipo":"MODELO_ACUERDO","materia":"AUMENTO_CAPITAL","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"f5b08793-36a3-46f9-8063-eb20c5c7cf06","tipo":"MODELO_ACUERDO","materia":"AUTORIZACION_GARANTIA","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"ba214d42-1933-497f-a2c0-0867c7c7a55f","tipo":"MODELO_ACUERDO","materia":"CESE_CONSEJERO","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.1.1"},
--  {"id":"433da411-ba65-410c-8375-24db637f7e75","tipo":"MODELO_ACUERDO","materia":"CESE_CONSEJERO","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.1.1"},
--  {"id":"313e7609-8b11-4ef5-a8fd-e9fdcf99d22c","tipo":"MODELO_ACUERDO","materia":"COMITES_INTERNOS","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"d3e08b42-a67e-4b33-9bbb-2689b5d8d4cf","tipo":"MODELO_ACUERDO","materia":"DELEGACION_FACULTADES","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"a09cc4bf-c927-470a-b392-43d2db424279","tipo":"MODELO_ACUERDO","materia":"DISTRIBUCION_CARGOS","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"395ca996-fdf0-4203-b7ae-f894d3012c8b","tipo":"MODELO_ACUERDO","materia":"DISTRIBUCION_DIVIDENDOS","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"c90edc8c-4655-46b5-a708-31543faadd2e","tipo":"MODELO_ACUERDO","materia":"FORMULACION_CUENTAS","organo_tipo":"ORGANO_ADMIN","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"e3697ad9-e0c2-4baf-9144-c80a11808c07","tipo":"MODELO_ACUERDO","materia":"FUSION_ESCISION","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"2.0.0"},
--  {"id":"29739424-5641-42bd-8b5a-58f81ee5c471","tipo":"MODELO_ACUERDO","materia":"MODIFICACION_ESTATUTOS","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"e64ce755-9e76-4b57-8fb7-750afb94857c","tipo":"MODELO_ACUERDO","materia":"NOMBRAMIENTO_AUDITOR","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"10f90d59-39d3-4633-83ff-81140eff50d5","tipo":"MODELO_ACUERDO","materia":"NOMBRAMIENTO_CONSEJERO","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.1.1"},
--  {"id":"27be9063-8977-44c7-b72c-eb26ecb3c49b","tipo":"MODELO_ACUERDO","materia":"NOMBRAMIENTO_CONSEJERO","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.1.1"},
--  {"id":"64fa1683-8cb8-4c4c-b8d6-e09f91cafa59","tipo":"MODELO_ACUERDO","materia":"OPERACION_VINCULADA","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"ee72efde-299b-42fc-86ba-57e29a187a7c","tipo":"MODELO_ACUERDO","materia":"POLITICA_REMUNERACION","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"b846bb03-9329-4470-840b-30d614adc613","tipo":"MODELO_ACUERDO","materia":"POLITICAS_CORPORATIVAS","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"edd5c389-0187-476c-9592-c020058fdc69","tipo":"MODELO_ACUERDO","materia":"RATIFICACION_ACTOS","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.1.0"},
--  {"id":"c06957aa-ce9d-4560-9d4e-501756ed5e4f","tipo":"MODELO_ACUERDO","materia":"REDUCCION_CAPITAL","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.1"},
--  {"id":"df75cda9-e558-43c7-a6a9-902e2c06ee97","tipo":"MODELO_ACUERDO","materia":"SEGUROS_RESPONSABILIDAD","organo_tipo":"CONSEJO_ADMIN","adoption_mode":"MEETING","version":"1.0.0"},
--  {"id":"5f8212a8-3d37-4504-b066-dc06fe995dce","tipo":"MODELO_ACUERDO","materia":"TRANSFORMACION","organo_tipo":"JUNTA_GENERAL","adoption_mode":"MEETING","version":"1.0.0"}
-- ]

-- 4. IDs P0 conocidos (documentados en Memory of state 2026-05-12)
-- e3697ad9-e0c2-4baf-9144-c80a11808c07 — FUSION_ESCISION (Junta General):
--   capa1_inmutable no condiciona informe de experto en fusiones simplificadas (art. 53 RDL 5/2023).
-- edd5c389-0187-476c-9592-c020058fdc69 — RATIFICACION_ACTOS (Consejo Admin):
--   capa3_editables sin campo obligatorio para identificación de actos.

-- 5. Hash SHA-256 de IDs ACTIVA ordenados (oráculo)
SELECT encode(digest(string_agg(id::text, ',' ORDER BY id), 'sha256'), 'hex') AS hash_activos
FROM plantillas_protegidas
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND estado = 'ACTIVA';
-- Resultado real:
-- [{"hash_activos":"5dce4ce999c194d68f1bf17f151c11e3ba5898c83f30a6abcf3663ac9e3a8b95"}]
