-- W5 — retirar el pack duplicado MOD_ESTATUTOS (2026-06-13).
-- ============================================================================
-- `MOD_ESTATUTOS` es la grafía legacy de la misma materia jurídica que
-- `MODIFICACION_ESTATUTOS` (materia canónica, destino del alias
-- MATERIA_PACK_ALIASES en rule-resolution.ts). El alias ya redirige toda
-- resolución en runtime, por lo que el pack legacy es inerte. Verificado el
-- 2026-06-13: 1 pack + 2 versiones, 0 consumidores (0 agreements.rule_pack_id,
-- 0 rule_evaluation_results, 0 supersedes). Se retira físicamente para dejar
-- una sola entrada de catálogo por materia. Forward-only, idempotente.
-- Las versiones se borran primero por la FK pack_id → rule_packs.

DELETE FROM rule_pack_versions WHERE pack_id = 'MOD_ESTATUTOS';
DELETE FROM rule_packs WHERE id = 'MOD_ESTATUTOS';
