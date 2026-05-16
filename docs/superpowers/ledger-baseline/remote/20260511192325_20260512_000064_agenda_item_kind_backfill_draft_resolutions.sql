DO $$
DECLARE
  v_orphan_resolutions int;
BEGIN
  -- Paso 1: promover agenda_items.kind a DECISORIO para puntos con
  -- meeting_resolutions en cualquier status (incluyendo PENDING/DRAFT).
  SET session_replication_role = 'replica';
  UPDATE agenda_items ai
  SET kind = 'DECISORIO'
  WHERE ai.kind != 'DECISORIO'
    AND EXISTS (
      SELECT 1 FROM meeting_resolutions r
      WHERE r.meeting_id = ai.meeting_id
        AND r.agenda_item_index = ai.order_number
    );
  SET session_replication_role = 'origin';

  -- Paso 2: verificación
  SELECT COUNT(*) INTO v_orphan_resolutions
  FROM meeting_resolutions r
  JOIN agenda_items ai
    ON ai.meeting_id = r.meeting_id
   AND ai.order_number = r.agenda_item_index
  WHERE r.kind_resolution = 'DECISION'
    AND ai.kind != 'DECISORIO';

  IF v_orphan_resolutions > 0 THEN
    RAISE EXCEPTION '000064 BLOCKER: % orphan DECISION resolutions tras backfill draft', v_orphan_resolutions;
  END IF;
END $$;
