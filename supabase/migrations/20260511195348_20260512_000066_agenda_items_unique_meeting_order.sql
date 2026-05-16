-- Codex P2 round 15: UNIQUE constraint en (meeting_id, order_number).
-- Sin él, dos clientes con cache stale (o doble click rapid) pueden hacer
-- INSERT concurrente del mismo punto → duplicate rows → triggers T1/T5
-- con scalar lookup (SELECT INTO) fallan con "multiple rows".
--
-- Idempotente: si ya hay duplicados, primero los limpiamos manteniendo
-- el más antiguo (MIN created_at).
DO $$
DECLARE
  v_dupes_removed int;
BEGIN
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY meeting_id, order_number ORDER BY created_at NULLS LAST) AS rn
    FROM agenda_items
    WHERE meeting_id IS NOT NULL AND order_number IS NOT NULL
  )
  DELETE FROM agenda_items
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
  GET DIAGNOSTICS v_dupes_removed = ROW_COUNT;
  IF v_dupes_removed > 0 THEN
    RAISE NOTICE '000066: removed % duplicate agenda_items', v_dupes_removed;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_agenda_items_meeting_order
  ON agenda_items(meeting_id, order_number);
