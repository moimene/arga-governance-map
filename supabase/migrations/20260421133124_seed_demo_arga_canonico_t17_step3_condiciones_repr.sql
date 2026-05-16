-- T17 step 3 — Condiciones SOCIO + Representación PJ
-- Using INSERT ... WHERE NOT EXISTS (idempotent).

-- Cartera ARGA SOCIO en ARGA Seguros
INSERT INTO condiciones_persona(
  tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  (SELECT person_id FROM entities WHERE id = '00000000-0000-0000-0000-000000000020'),
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  NULL,
  'SOCIO',
  'VIGENTE',
  '2025-01-01'
WHERE NOT EXISTS (
  SELECT 1 FROM condiciones_persona
  WHERE person_id = (SELECT person_id FROM entities WHERE id = '00000000-0000-0000-0000-000000000020')
    AND entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
    AND tipo_condicion = 'SOCIO'
    AND estado = 'VIGENTE'
    AND body_id IS NULL
);

-- Mercado Libre SOCIO en ARGA Seguros
INSERT INTO condiciones_persona(
  tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  NULL,
  'SOCIO',
  'VIGENTE',
  '2025-01-01'
WHERE NOT EXISTS (
  SELECT 1 FROM condiciones_persona
  WHERE person_id = '10000000-0000-0000-0000-000000000004'
    AND entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
    AND tipo_condicion = 'SOCIO'
    AND estado = 'VIGENTE'
    AND body_id IS NULL
);

-- Fundación SOCIO en Cartera ARGA
INSERT INTO condiciones_persona(
  tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  (SELECT person_id FROM entities WHERE id = '7b9dd701-1ed1-4911-88ba-e186a86083bc'),
  '00000000-0000-0000-0000-000000000020',
  NULL,
  'SOCIO',
  'VIGENTE',
  '2025-01-01'
WHERE NOT EXISTS (
  SELECT 1 FROM condiciones_persona
  WHERE person_id = (SELECT person_id FROM entities WHERE id = '7b9dd701-1ed1-4911-88ba-e186a86083bc')
    AND entity_id = '00000000-0000-0000-0000-000000000020'
    AND tipo_condicion = 'SOCIO'
    AND estado = 'VIGENTE'
    AND body_id IS NULL
);

-- Representación: Cartera ARGA representada por un consejero vigente de ARGA Seguros
-- (first one found). Skips cleanly if no consejeros.
INSERT INTO representaciones(
  tenant_id, entity_id, represented_person_id, representative_person_id, scope, effective_from
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  (SELECT person_id FROM entities WHERE id = '00000000-0000-0000-0000-000000000020'),
  (SELECT person_id FROM condiciones_persona
    WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
      AND tipo_condicion = 'CONSEJERO'
      AND estado = 'VIGENTE'
    LIMIT 1),
  'ADMIN_PJ_REPRESENTANTE',
  '2025-01-01'
WHERE EXISTS (
  SELECT 1 FROM condiciones_persona
   WHERE entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
     AND tipo_condicion = 'CONSEJERO'
     AND estado = 'VIGENTE'
)
AND NOT EXISTS (
  SELECT 1 FROM representaciones
   WHERE represented_person_id = (SELECT person_id FROM entities WHERE id = '00000000-0000-0000-0000-000000000020')
     AND scope = 'ADMIN_PJ_REPRESENTANTE'
     AND effective_to IS NULL
);
