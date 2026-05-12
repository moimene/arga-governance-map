-- 20260513_000063_persons_tax_id_unique.sql
-- Spec L19: NIF/CIF debe ser único por tenant. Excluye placeholders E2E,
-- PENDIENTE-* y FREE-FLOAT-* que son intencionalmente no-canónicos.
-- Aplicado en preview branch antes de Cloud principal.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_persons_tax_id_real
  ON persons (tenant_id, tax_id)
  WHERE tax_id IS NOT NULL
    AND tax_id NOT LIKE 'PENDIENTE-%'
    AND tax_id NOT LIKE 'E2E-%'
    AND tax_id NOT LIKE 'FREE-FLOAT-%'
    AND tax_id NOT LIKE 'ARCHIVED-%';

COMMIT;
