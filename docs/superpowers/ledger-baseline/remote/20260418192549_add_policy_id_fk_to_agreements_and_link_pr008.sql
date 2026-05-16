-- GAP 2: Asegurar FK policy_id en agreements y vincular acuerdo CdA → PR-008
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES policies(id);

-- Vincular el acuerdo de aprobación PR-008 al acuerdo del CdA (si no está ya vinculado)
UPDATE agreements
SET policy_id = (SELECT id FROM policies WHERE policy_code = 'PR-008' AND tenant_id = '00000000-0000-0000-0000-000000000001' LIMIT 1)
WHERE parent_meeting_id = (SELECT id FROM meetings WHERE slug = 'cda-22-04-2026' LIMIT 1)
  AND agreement_kind = 'APROBACION_POLITICA'
  AND tenant_id = '00000000-0000-0000-0000-000000000001'
  AND policy_id IS NULL;
