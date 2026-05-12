-- Migration: 20260512_000064_agenda_item_kind_backfill_draft_resolutions.sql
--
-- Codex P2 round 13: extiende el backfill 000060 para promover también
-- agenda_items.kind a DECISORIO cuando existen meeting_resolutions con
-- status='PENDING' o 'DRAFT' (sin agreement asociado todavía).
--
-- Bug original: 000060 solo promovía agenda_items.kind='DECISORIO' para
-- status IN ('ADOPTED','REJECTED'). Las resoluciones DRAFT/PENDING
-- (creadas por fn_save_meeting_resolutions con default PENDING) quedaban
-- con kind_resolution='DECISION' default pero su agenda_item permanecía
-- DELIBERATIVO → el verify block contaba orphans → migration abortaba.
--
-- Razonamiento: la mera existencia de una row en meeting_resolutions
-- declara intent decisorio del autor (creó la resolución porque planeaba
-- adoptarla). Promovemos kind a DECISORIO. Si luego el autor decide
-- abandonarla, la matriz P7 permite reclasificar a DELIB/INFO (status
-- DRAFT no bloquea).
--
-- En ARGA Seguros Cloud (governance_OS): este script no encontró rows
-- porque el backfill 000060 corrió antes de que el flujo creara
-- meeting_resolutions DRAFT/PENDING. Idempotente: si no hay candidatos,
-- es no-op. Para deployments donde 000060 falló (orphans > 0), aplicar
-- esta migración cierra el gap.

BEGIN;

SET session_replication_role = 'replica';

-- Paso 1: promover agenda_items.kind a DECISORIO para puntos con
-- meeting_resolutions en cualquier status (incluyendo PENDING/DRAFT).
-- Esto extiende 000060 que solo cubría ADOPTED/REJECTED.
UPDATE agenda_items ai
SET kind = 'DECISORIO'
WHERE ai.kind != 'DECISORIO'
  AND EXISTS (
    SELECT 1 FROM meeting_resolutions r
    WHERE r.meeting_id = ai.meeting_id
      AND r.agenda_item_index = ai.order_number
  );

SET session_replication_role = 'origin';

-- Paso 2: probe de verificación + idempotencia
DO $$
DECLARE
  v_orphan_resolutions int;
  v_total_decis int;
  v_total_delib int;
  v_total_info int;
BEGIN
  SELECT COUNT(*) INTO v_orphan_resolutions
  FROM meeting_resolutions r
  JOIN agenda_items ai
    ON ai.meeting_id = r.meeting_id
   AND ai.order_number = r.agenda_item_index
  WHERE r.kind_resolution = 'DECISION'
    AND ai.kind != 'DECISORIO';

  SELECT
    COUNT(*) FILTER (WHERE kind = 'DECISORIO'),
    COUNT(*) FILTER (WHERE kind = 'DELIBERATIVO'),
    COUNT(*) FILTER (WHERE kind = 'INFORMATIVO')
  INTO v_total_decis, v_total_delib, v_total_info
  FROM agenda_items;

  RAISE NOTICE '000064 VERIFICATION:';
  RAISE NOTICE '  DECISORIO: %, DELIBERATIVO: %, INFORMATIVO: %',
    v_total_decis, v_total_delib, v_total_info;
  RAISE NOTICE '  Orphan DECISION resolutions tras 000064: % (esperado: 0)',
    v_orphan_resolutions;

  IF v_orphan_resolutions > 0 THEN
    RAISE EXCEPTION 'BLOCKER 000064: % orphan DECISION resolutions tras backfill draft. Revisar manualmente.', v_orphan_resolutions;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- END 20260512_000064_agenda_item_kind_backfill_draft_resolutions
-- ============================================================================
