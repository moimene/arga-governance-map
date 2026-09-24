-- Remediación W5 — limpiar overrides huérfanos de MOD_ESTATUTOS (2026-06-13).
-- ============================================================================
-- Tras retirar el pack MOD_ESTATUTOS (migración 20260613214000), los
-- rule_param_overrides keyed a la materia 'MOD_ESTATUTOS' quedan huérfanos: la
-- resolución de reglas usa la materia canónica MODIFICACION_ESTATUTOS vía alias
-- (rule-resolution.ts), por lo que un override sobre la grafía legacy nunca se
-- aplicaría. Se eliminan para no dejar configuración muerta. Forward-only,
-- idempotente. Hallazgo de la revisión adversarial /codex de la Fase 1.

DELETE FROM rule_param_overrides WHERE materia = 'MOD_ESTATUTOS';
