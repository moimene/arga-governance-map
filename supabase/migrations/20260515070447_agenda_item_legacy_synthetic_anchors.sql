-- Migration: 20260515070447_agenda_item_legacy_synthetic_anchors.sql
--
-- Secretaría 360 v3.1 — legacy compatibility.
--
-- Some historical MEETING agreements predate the agenda_item ↔ agreement anchor
-- and do not carry execution_mode.agenda_item_index. For those rows we create a
-- synthetic DECISORIO agenda item, append it at the end of the meeting agenda,
-- and link agreements.agenda_item_id to preserve traceability.

BEGIN;

ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS legacy_migrated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_source_agreement_id uuid REFERENCES agreements(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_agenda_items_legacy_source_agreement_id
  ON agenda_items(legacy_source_agreement_id)
  WHERE legacy_source_agreement_id IS NOT NULL;

COMMENT ON COLUMN agenda_items.legacy_migrated IS
  'true cuando el punto fue creado sintéticamente para anclar un agreement histórico anterior a agenda_items.kind v3.1.';
COMMENT ON COLUMN agenda_items.legacy_source_agreement_id IS
  'agreement histórico que originó el agenda_item sintético de compatibilidad.';

WITH legacy_agreements AS (
  SELECT
    a.id AS agreement_id,
    a.tenant_id,
    a.parent_meeting_id AS meeting_id,
    a.agreement_kind,
    a.code,
    a.proposal_text,
    a.decision_text,
    a.created_at,
    COALESCE(mx.max_order, 0)
      + row_number() OVER (
          PARTITION BY a.parent_meeting_id
          ORDER BY a.created_at NULLS LAST, a.id
        ) AS synthetic_order
  FROM agreements a
  LEFT JOIN LATERAL (
    SELECT max(ai.order_number) AS max_order
    FROM agenda_items ai
    WHERE ai.meeting_id = a.parent_meeting_id
  ) mx ON true
  WHERE a.parent_meeting_id IS NOT NULL
    AND a.agenda_item_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM agenda_items ai
      WHERE ai.legacy_source_agreement_id = a.id
    )
),
inserted AS (
  INSERT INTO agenda_items (
    meeting_id,
    order_number,
    title,
    description,
    tenant_id,
    kind,
    decision_subtype,
    created_at,
    updated_at,
    legacy_migrated,
    legacy_source_agreement_id
  )
  SELECT
    l.meeting_id,
    l.synthetic_order,
    left(
      COALESCE(
        NULLIF(trim(l.proposal_text), ''),
        NULLIF(trim(l.decision_text), ''),
        NULLIF(trim(l.code), ''),
        NULLIF(trim(l.agreement_kind), ''),
        'Acuerdo histórico'
      ),
      240
    ) AS title,
    concat(
      'Punto DECISORIO sintético creado por migración v3.1 para anclar el agreement histórico ',
      l.agreement_id::text,
      '.'
    ) AS description,
    l.tenant_id,
    'DECISORIO',
    'CONSTITUTIVE',
    COALESCE(l.created_at, now()),
    now(),
    true,
    l.agreement_id
  FROM legacy_agreements l
  ON CONFLICT DO NOTHING
  RETURNING id, legacy_source_agreement_id
)
UPDATE agreements a
SET agenda_item_id = i.id,
    updated_at = now()
FROM inserted i
WHERE a.id = i.legacy_source_agreement_id;

-- Second pass: if a previous partial run inserted the synthetic point but did
-- not update the agreement, repair the anchor idempotently.
UPDATE agreements a
SET agenda_item_id = ai.id,
    updated_at = now()
FROM agenda_items ai
WHERE a.agenda_item_id IS NULL
  AND ai.legacy_source_agreement_id = a.id;

COMMIT;
