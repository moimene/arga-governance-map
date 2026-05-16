-- GAP 3: Asegurar FK obligation_id en incidents y vincular incidente DORA a OBL-DORA-003
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS obligation_id uuid REFERENCES obligations(id);

-- Vincular el incidente DORA activo a OBL-DORA-003 (si no está ya vinculado)
UPDATE incidents
SET obligation_id = (
  SELECT id FROM obligations
  WHERE code = 'OBL-DORA-003'
    AND tenant_id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1
)
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND incident_type = 'DORA'
  AND status NOT IN ('Cerrado', 'Resuelto')
  AND obligation_id IS NULL;
