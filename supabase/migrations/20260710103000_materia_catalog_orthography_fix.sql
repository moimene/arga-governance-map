-- Corrección ortográfica de materia_catalog (Oleada 1 UX Materias y Reglas).
--
-- La migración 20260518070443_secretaria_rule_pack_stabilization.sql sembró
-- 18 materia_label_es sin tildes y, vía ON CONFLICT (materia) DO UPDATE,
-- sobrescribió labels correctamente acentuados del seed original
-- 20260424155408_000033_materia_catalog.sql (p.ej. "Exclusión de socio").
-- Este fix es forward-only y solo toca presentación (labels y una
-- referencia_legal); los códigos `materia` no cambian.
--
-- Plan: docs/superpowers/plans/2026-07-10-ux-materias-reglas-oleada1-plan.md
--
-- ✅ ESTADO 2026-07-11: APLICADA en Cloud (governance_OS) vía Management API
-- (POST /v1/projects/hzqwefkwsxopwrmtksbg/database/query — mismo canal que
-- MCP execute_sql) y registrada en supabase_migrations.schema_migrations como
-- '20260710103000'. Verificado con SELECT: los 18 labels y la referencia_legal
-- coinciden exactamente con este archivo y no quedan labels sin tilde.
-- El overlay temporal MATERIA_LABEL_ORTHOGRAPHY_OVERRIDES de
-- src/lib/secretaria/mesa-control-societaria.ts se retiró el 2026-07-11
-- (junto con sus tests) al quedar la BD como única fuente de verdad.

UPDATE materia_catalog SET materia_label_es = 'Acuerdo del órgano de administración por el que se convoca la Junta' WHERE materia = 'ACUERDO_CONVOCATORIA_JUNTA';
UPDATE materia_catalog SET materia_label_es = 'Aplicación del resultado' WHERE materia = 'APLICACION_RESULTADO';
UPDATE materia_catalog SET materia_label_es = 'Aprobación del presupuesto anual' WHERE materia = 'APROBACION_PRESUPUESTO';
UPDATE materia_catalog SET materia_label_es = 'Aprobación o modificación del Reglamento del Consejo' WHERE materia = 'APROBACION_REGLAMENTO_CONSEJO';
UPDATE materia_catalog SET materia_label_es = 'Autorización de garantía o aval' WHERE materia = 'AUTORIZACION_GARANTIA';
UPDATE materia_catalog SET materia_label_es = 'Autorización de transmisión de participaciones sociales' WHERE materia = 'TRANSMISION_PARTICIPACIONES';
UPDATE materia_catalog SET materia_label_es = 'Contratos entre socio único y sociedad' WHERE materia = 'CONTRATOS_SOCIO_UNICO_SOCIEDAD';
UPDATE materia_catalog SET materia_label_es = 'Creación, modificación o supresión de prestaciones accesorias' WHERE materia = 'PRESTACIONES_ACCESORIAS';
UPDATE materia_catalog SET materia_label_es = 'Distribución de cargos del Consejo' WHERE materia = 'DISTRIBUCION_CARGOS';
UPDATE materia_catalog SET materia_label_es = 'Distribución de dividendo a cuenta' WHERE materia = 'DIVIDENDO_A_CUENTA';
UPDATE materia_catalog SET materia_label_es = 'Ejecución de aumento de capital delegado' WHERE materia = 'EJECUCION_AUMENTO_DELEGADO';
UPDATE materia_catalog SET materia_label_es = 'Ejercicio del derecho de separación de socio' WHERE materia = 'SEPARACION_SOCIO';
UPDATE materia_catalog SET materia_label_es = 'Exclusión de socio' WHERE materia = 'EXCLUSION_SOCIO';
UPDATE materia_catalog SET materia_label_es = 'Exclusión del derecho de suscripción preferente' WHERE materia = 'EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE';
UPDATE materia_catalog SET materia_label_es = 'Formulación de cuentas consolidadas' WHERE materia = 'CUENTAS_CONSOLIDADAS';
UPDATE materia_catalog SET materia_label_es = 'Otorgamiento o modificación de poderes de representación' WHERE materia = 'PODER_REPRESENTACION';
UPDATE materia_catalog SET materia_label_es = 'Supresión del derecho de suscripción preferente' WHERE materia = 'SUPRESION_PREFERENTE';
UPDATE materia_catalog SET materia_label_es = 'Traslado de domicilio social dentro de España' WHERE materia = 'TRASLADO_DOMICILIO_NACIONAL';

UPDATE materia_catalog SET referencia_legal = 'art. 107.2 LSC (mayoría ordinaria, art. 198 LSC)' WHERE materia = 'TRANSMISION_PARTICIPACIONES';
