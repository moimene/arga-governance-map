-- T14 bootstrap — part 1/2: DML (create PJ rows, link entity.person_id)
-- Split from 000020 source file at T1/T2 boundary to flush AFTER-trigger
-- events (trg_audit_worm_entities) before the DDL in part 2.

-- 1a. Crear persona jurídica por cada entity sin person_id.
-- NOTE: person_type = 'PJ' per persons_person_type_check
--       (CHECK (person_type IN ('PF','PJ'))); domain term "persona jurídica"
--       maps to 'PJ' in DB.
INSERT INTO persons (id, tenant_id, person_type, tax_id, denomination, full_name)
SELECT gen_random_uuid(),
       e.tenant_id,
       'PJ',
       COALESCE(e.registration_number, 'PENDIENTE-' || e.id::text),
       e.legal_name,
       COALESCE(e.common_name, e.legal_name)
FROM entities e
WHERE e.person_id IS NULL;

-- 1b. Vincular entity → person
UPDATE entities e
   SET person_id = p.id
  FROM persons p
 WHERE p.person_type = 'PJ'
   AND e.person_id IS NULL
   AND (
     p.tax_id = e.registration_number
     OR (e.registration_number IS NULL AND p.tax_id = 'PENDIENTE-' || e.id::text)
   );
