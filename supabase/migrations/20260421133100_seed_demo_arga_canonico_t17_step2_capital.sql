-- T17 step 2 — Capital profile (IAR 2025 values) + close legacy holdings + canonical cap table

-- (a) Capital profile: close old VIGENTE, insert new one with IAR 2025 values
UPDATE entity_capital_profile
   SET estado = 'HISTORICO', effective_to = CURRENT_DATE
 WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
   AND estado = 'VIGENTE';

INSERT INTO entity_capital_profile(
  tenant_id, entity_id, capital_escriturado, numero_titulos, valor_nominal, estado, effective_from
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  307955327.3,
  3079553273,
  0.1,
  'VIGENTE',
  '2025-01-01'
);

-- (b) Close legacy holdings on ARGA Seguros (9 from T16 backfill)
UPDATE capital_holdings
   SET effective_to = CURRENT_DATE
 WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
   AND effective_to IS NULL;

-- (c) Insert canonical holdings: Cartera 69.69%, Mercado Libre 30.31%
INSERT INTO capital_holdings(
  tenant_id, entity_id, holder_person_id, porcentaje_capital, numero_titulos,
  voting_rights, effective_from
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    (SELECT person_id FROM entities WHERE id = '00000000-0000-0000-0000-000000000020'),
    69.69,
    2145754856,
    true,
    '2025-01-01'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    '6d7ed736-f263-4531-a59d-c6ca0cd41602',
    '10000000-0000-0000-0000-000000000004',
    30.31,
    933798417,
    true,
    '2025-01-01'
  );

-- (d) Close legacy holdings on Cartera ARGA (none expected, but idempotent)
UPDATE capital_holdings
   SET effective_to = CURRENT_DATE
 WHERE entity_id = '00000000-0000-0000-0000-000000000020'
   AND effective_to IS NULL;

-- (e) Insert canonical holding: Fundación → 100% Cartera ARGA
INSERT INTO capital_holdings(
  tenant_id, entity_id, holder_person_id, porcentaje_capital, numero_titulos,
  voting_rights, effective_from
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000020',
  (SELECT person_id FROM entities WHERE id = '7b9dd701-1ed1-4911-88ba-e186a86083bc'),
  100,
  1,
  true,
  '2025-01-01'
);
