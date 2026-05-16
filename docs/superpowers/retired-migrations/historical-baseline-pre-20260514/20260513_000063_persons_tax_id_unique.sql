-- 20260513_000063_persons_tax_id_unique.sql
-- Spec L19: NIF/CIF debe ser único por tenant. Excluye placeholders E2E,
-- PENDIENTE-* y FREE-FLOAT-* que son intencionalmente no-canónicos.
--
-- ⚠️  PREREQUISITO OPERACIONAL ⚠️
-- Esta migración asume que scripts/consolidate-duplicate-persons.ts ya se
-- ejecutó y consolidó los duplicados de Cartera ARGA, ARGA Seguros y otros.
-- Cloud demo tiene ≥1 par de duplicados con tax_id real al momento de
-- escribir esta migración (ej. "PRUEBA 1" y "SEGUROS TEST A, SL"
-- comparten B88888888). Aplicar SIN ejecutar D2 primero provocará 23505.
--
-- Plan §D2 + §D1.4 documenta el orden correcto.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_persons_tax_id_real
  ON persons (tenant_id, tax_id)
  WHERE tax_id IS NOT NULL
    AND tax_id NOT LIKE 'PENDIENTE-%'
    AND tax_id NOT LIKE 'E2E-%'
    AND tax_id NOT LIKE 'FREE-FLOAT-%'
    AND tax_id NOT LIKE 'ARCHIVED-%';

COMMIT;
