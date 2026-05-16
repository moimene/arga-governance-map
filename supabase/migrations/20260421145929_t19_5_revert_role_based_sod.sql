-- T19.5.1 — Revertir el par tóxico (SECRETARIO, CONSEJERO).
--
-- MOTIVO: en derecho societario español (LSC + RRM), el Secretario
-- Consejero votante es la figura habitual, no una incompatibilidad.
-- Modelar SoD como par de roles fuerza la arquitectura hacia un modelo
-- jurídicamente incorrecto. La separación que importa no es "quién es"
-- sino "qué acción hace sobre qué acto" — eso se controla con:
--   (a) Immutabilidad WORM (snapshot + resultado + certificación)
--   (b) Determinismo del motor (snapshot-driven, no user-driven)
--   (c) authority_evidence (capacidad certificante con cargo vigente)
--   (d) capability_matrix (qué acción puede ejecutar cada rol)
-- Ninguno requiere prohibir que la misma persona ostente dos roles.
--
-- Las PERMISSIONS añadidas en T19.5 permanecen — describen capacidades,
-- no separaciones. Solo se revierte el sod_toxic_pair.
DELETE FROM sod_toxic_pairs
 WHERE role_a = 'SECRETARIO'
   AND role_b = 'CONSEJERO';
