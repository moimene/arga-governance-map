-- T14 bootstrap — part 2/2: DDL (set NOT NULL) + stubs (capital profile, share classes)
-- Split from 000020 source file at T1/T2 boundary because the AFTER-trigger
-- events queued by part 1's UPDATE would block the ALTER TABLE inside a
-- single transaction (Postgres error 55006).

-- 1c. NOT NULL tras bootstrap
ALTER TABLE entities ALTER COLUMN person_id SET NOT NULL;

-- 1d. entity_capital_profile: stub para entidades sin datos
INSERT INTO entity_capital_profile(entity_id, tenant_id, capital_escriturado, effective_from)
SELECT e.id, e.tenant_id, 0, CURRENT_DATE
FROM entities e
WHERE NOT EXISTS (
  SELECT 1 FROM entity_capital_profile cp
  WHERE cp.entity_id = e.id AND cp.estado = 'VIGENTE'
);

-- 1e. share_classes: clase ORD por defecto
INSERT INTO share_classes(entity_id, tenant_id, class_code, name)
SELECT e.id, e.tenant_id, 'ORD', 'Ordinaria'
FROM entities e
WHERE NOT EXISTS (
  SELECT 1 FROM share_classes sc WHERE sc.entity_id = e.id AND sc.class_code = 'ORD'
);
