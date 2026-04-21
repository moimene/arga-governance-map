-- supabase/migrations/20260421_000020_bootstrap_identidad.sql
-- T14 — Bootstrap: create persona jurídica per entity + link person_id + seed
-- entity_capital_profile and share_classes defaults.
--
-- After this migration, entities.person_id is NOT NULL. The scope WHERE
-- e.person_id IS NULL becomes empty after a successful first apply, so re-runs
-- are safe (idempotent by scope). Cloud snapshot at dispatch time: 27 entities
-- with person_id IS NULL and ONE pre-existing PJ row (tax_id='B12345679',
-- "ARGA Capital Inversiones SL"). Step 1b's link-back uses the synthetic
-- 'PENDIENTE-<entity.id>' tax_id exclusively so it cannot collide with any
-- pre-existing persons nor with future entities that inherit a
-- registration_number equal to an existing persons.tax_id (persons.tax_id
-- is NOT UNIQUE — only a non-unique btree index).
--
-- SPLIT-TRANSACTION NOTE (deviation 6 — surfaced at apply time, not at dispatch)
-- ---------------------------------------------------------------------------
-- entities carries an AFTER INSERT/UPDATE/DELETE trigger (trg_audit_worm_entities
-- from migration 000006). Postgres refuses to run `ALTER TABLE ... SET NOT NULL`
-- on a table inside the same transaction that still has pending AFTER-trigger
-- events queued from an earlier UPDATE:
--     ERROR 55006: cannot ALTER TABLE "entities" because it has pending
--                  trigger events
-- Splitting the script into two transactions flushes the AFTER triggers of
-- step 1b (and records 27 WORM audit rows for the entity link) before the DDL
-- in step 1c runs. We keep the audit trigger enabled throughout — no use of
-- session_replication_role = 'replica' or DISABLE TRIGGER, both of which would
-- create audit-chain gaps.
--
-- When applying via `supabase db push` locally, the file's explicit BEGIN;/
-- COMMIT; boundaries are honoured; when applying via the Supabase MCP
-- `apply_migration` tool against Cloud, two separate apply_migration calls
-- (one per transaction) are required because the tool wraps each call in a
-- single transaction. T14's orchestrator does the two-step apply.

-- ---------------------------------------------------------------------------
-- Transaction 1 — DML: create PJ rows + link entity.person_id
-- ---------------------------------------------------------------------------
BEGIN;

-- 1a+1b. Crear persona jurídica por cada entity sin person_id, y vincular la
-- entity a esa persona en el mismo CTE.
-- NOTE: person_type = 'PJ' per persons_person_type_check
--       (CHECK (person_type IN ('PF','PJ'))); domain term "persona jurídica"
--       maps to 'PJ' in DB.
-- NOTE: tax_id es SIEMPRE el sintético 'PENDIENTE-<entity.id>', no
--       registration_number. Motivo: persons.tax_id NO es UNIQUE (solo btree),
--       así que si una entity futura trajera un registration_number que
--       coincidiera con un persons.tax_id pre-existente, 1b podría cruzar
--       enlaces. Usando el sintético, el par (tax_id ↔ entity.id) es unívoco
--       por construcción (entity.id es PK). El tax_id real se rellena en una
--       migración posterior cuando registration_number esté capturado.
-- NOTE: El CTE con RETURNING ata 1b estrictamente a las filas creadas en 1a —
--       nunca puede matchear PJs pre-existentes.
WITH inserted AS (
  INSERT INTO persons (id, tenant_id, person_type, tax_id, denomination, full_name)
  SELECT gen_random_uuid(),
         e.tenant_id,
         'PJ',
         'PENDIENTE-' || e.id::text,
         e.legal_name,
         COALESCE(e.common_name, e.legal_name)
  FROM entities e
  WHERE e.person_id IS NULL
  RETURNING id, tax_id
)
UPDATE entities e
   SET person_id = i.id
  FROM inserted i
 WHERE i.tax_id = 'PENDIENTE-' || e.id::text
   AND e.person_id IS NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- Transaction 2 — DDL + stub seeds
-- ---------------------------------------------------------------------------
BEGIN;

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

COMMIT;
