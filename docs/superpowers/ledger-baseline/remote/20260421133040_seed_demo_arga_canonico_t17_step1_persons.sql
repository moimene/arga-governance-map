-- T17 step 1 — Rename existing PJ tax_ids (Fundación, Cartera, ARGA Seguros) + insert Mercado Libre PJ
-- Idempotent: re-apply safe (UPDATE unconditional, INSERT ON CONFLICT DO NOTHING)

-- Fundación ARGA (entity 7b9dd701-...) → canonical tax_id G-99999901
UPDATE persons
   SET tax_id = 'G-99999901',
       full_name = 'Fundación ARGA',
       denomination = 'Fundación ARGA'
 WHERE id = (SELECT person_id FROM entities WHERE id = '7b9dd701-1ed1-4911-88ba-e186a86083bc');

-- Cartera ARGA S.L.U. (entity 00000000-...-020) → canonical tax_id B-99999902
UPDATE persons
   SET tax_id = 'B-99999902',
       full_name = 'Cartera ARGA S.L.U.',
       denomination = 'Cartera ARGA S.L.U.'
 WHERE id = (SELECT person_id FROM entities WHERE id = '00000000-0000-0000-0000-000000000020');

-- ARGA Seguros, S.A. (entity 6d7ed736-...) → canonical tax_id A-99999903
UPDATE persons
   SET tax_id = 'A-99999903',
       full_name = 'ARGA Seguros, S.A.',
       denomination = 'ARGA Seguros, S.A.'
 WHERE id = (SELECT person_id FROM entities WHERE id = '6d7ed736-f263-4531-a59d-c6ca0cd41602');

-- Mercado Libre aggregate PJ (net-new, stable UUID per plan §T17)
INSERT INTO persons (id, tenant_id, person_type, tax_id, full_name, denomination)
VALUES (
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'PJ',
  'X-99999904',
  'Mercado libre (free float agregado)',
  'Mercado libre'
)
ON CONFLICT (id) DO UPDATE SET
  tax_id = EXCLUDED.tax_id,
  full_name = EXCLUDED.full_name,
  denomination = EXCLUDED.denomination;
