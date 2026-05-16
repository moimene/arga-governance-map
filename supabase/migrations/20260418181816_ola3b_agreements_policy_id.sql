-- Añade vínculo directo política → acuerdo (1:N)
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES policies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agreements_policy_id ON agreements(policy_id);

-- Ensancha FK al resto de APROBACION_POLITICA (derivado de policy_agreements APPROVES)
UPDATE agreements a
SET policy_id = pa.policy_id
FROM policy_agreements pa
WHERE pa.agreement_id = a.id
  AND pa.relationship_kind = 'APPROVES'
  AND a.policy_id IS NULL;

-- Vincula el acuerdo de aprobación de PR-008 al Consejo 22/04/2026 con decisión firme
UPDATE agreements
SET parent_meeting_id = 'c3305c16-57c1-4ece-884b-6b6644f2d20e',
    adoption_mode = 'MEETING',
    decision_date = '2026-04-22',
    effective_date = '2026-04-22',
    matter_class = COALESCE(matter_class, 'ORDINARIA'),
    status = 'CERTIFIED'
WHERE id = 'fe6e92b7-9341-4ebe-9a63-efb3f994861d';
