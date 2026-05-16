-- supabase/migrations/20260421_000022_revert_role_based_sod.sql
-- T19.5.1 — Revertir el par tóxico (SECRETARIO, CONSEJERO) añadido en T19.5.
--
-- MOTIVO: en derecho societario español (LSC + RRM), el Secretario
-- Consejero votante es la figura habitual, no una incompatibilidad.
-- Modelar SoD como par de roles fuerza la arquitectura hacia un modelo
-- jurídicamente incorrecto. La separación que importa no es "quién es"
-- sino "qué acción hace sobre qué acto" — eso se controlará en fase
-- posterior con:
--   (a) Immutabilidad WORM (snapshot + resultado + certificación)
--   (b) Determinismo del motor (snapshot-driven, no user-driven)
--   (c) authority_evidence (capacidad certificante con cargo vigente)
--   (d) capability_matrix (qué acción puede ejecutar cada rol)
-- Ninguno requiere prohibir que la misma persona ostente dos roles.
--
-- Las PERMISSIONS añadidas en T19.5 (capital_holdings:*, etc.) permanecen —
-- describen capacidades, no separaciones. Solo se revierte el par tóxico.
--
-- Los 4 pares originales preservados (correcto jurídicamente):
--   (ADMIN_TENANT, AUDITOR)   BLOCK
--   (CONSEJERO, COMPLIANCE)   WARN
--   (SECRETARIO, AUDITOR)     BLOCK
--   (SECRETARIO, COMPLIANCE)  WARN
-- Todos refieren a incompatibilidad con auditoría/supervisión independiente,
-- que sí es jurídicamente correcta.
--
-- Applied to Cloud via MCP apply_migration (name: t19_5_revert_role_based_sod)
-- on 2026-04-21. Mirrored here.

DELETE FROM sod_toxic_pairs
 WHERE role_a = 'SECRETARIO'
   AND role_b = 'CONSEJERO';
