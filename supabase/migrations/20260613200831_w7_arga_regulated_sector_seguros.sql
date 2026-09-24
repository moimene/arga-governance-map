-- W7 — enriquece ARGA Seguros S.A. con regulated_sector='SEGUROS' (2026-06-13).
-- ============================================================================
-- ARGA Seguros S.A. es asegurador cotizado pero tenía regulated_sector NULL, lo
-- que (a) impedía al evaluador de autorizaciones (W7) verla como entidad
-- regulada y exigir DGSFP, y (b) impedía activar los libros auxiliares de seguros
-- (isInsuranceListedEntity). Dato correcto (el grupo es "ARGA Seguros").
-- Forward-only, idempotente.

UPDATE entities SET regulated_sector = 'SEGUROS'
 WHERE id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
   AND (regulated_sector IS NULL OR btrim(regulated_sector) = '');
