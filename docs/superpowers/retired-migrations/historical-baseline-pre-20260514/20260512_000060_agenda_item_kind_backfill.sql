-- Migration: 20260512_000060_agenda_item_kind_backfill.sql
--
-- Backfill basado en señales relacionales para agenda_items.kind +
-- meeting_resolutions.kind_resolution.
--
-- Estrategia conservadora (G-I2):
--   - DECISORIO si agreement_id o meeting_resolutions.status IN ('ADOPTED','REJECTED')
--   - DELIBERATIVO en el resto (default columna)
--   - INFORMATIVO no se infiere — solo existirá en puntos creados post-migration
--
-- B1 fix: usa order_number (NOT index — spec original era erróneo).
-- I1 fix: revisa AMBOS shapes de execution_mode (top-level y agreement_360 nested).
--
-- IMPORTANTE: el trigger T1 (agenda_kind_immutable_after_voted) bloquea cambios
-- de kind cuando existen meeting_resolutions apuntando al punto. Para el backfill
-- inicial necesitamos desactivar triggers temporalmente con:
--   SET session_replication_role = 'replica'
-- Esto solo afecta a la sesión actual; no es permanente.
--
-- Probe post-backfill: verifica 0 orphan DECISION resolutions y 0 orphan agreements.

BEGIN;

SET session_replication_role = 'replica';

-- Paso 1: agenda_items con señal relacional → DECISORIO
-- Codex P1 round 14: incluir TAMBIÉN resoluciones DRAFT/PENDING. La mera
-- existencia de una row en meeting_resolutions declara intent decisorio
-- (alguien creó la resolución porque planeaba adoptarla). Antes solo se
-- promovían ADOPTED/REJECTED → deployments con DRAFT/PENDING fallaban en
-- el verify block más abajo. 000064 era el patch para Cloud, pero fresh
-- deploys abortaban antes de llegar a 000064.
UPDATE agenda_items ai
SET kind = 'DECISORIO'
WHERE EXISTS (
  SELECT 1 FROM meeting_resolutions r
  WHERE r.meeting_id = ai.meeting_id
    AND r.agenda_item_index = ai.order_number
)
OR EXISTS (
  SELECT 1 FROM agreements a
  WHERE a.parent_meeting_id = ai.meeting_id
    AND COALESCE(
      (a.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int,
      (a.execution_mode ->> 'agenda_item_index')::int
    ) = ai.order_number
);

-- Paso 2: meeting_resolutions con status no finales → DELIBERATION_OUTCOME
-- (O3 fix: PENDING/DRAFT quedan como DECISION default, pueden materializar más tarde)
UPDATE meeting_resolutions
SET kind_resolution = 'DELIBERATION_OUTCOME'
WHERE status NOT IN ('ADOPTED', 'REJECTED', 'PENDING', 'DRAFT')
  AND kind_resolution = 'DECISION';

SET session_replication_role = 'origin';

-- Paso 3: probe de verificación con RAISE EXCEPTION si orphans > 0
DO $$
DECLARE
  v_total int; v_decis int; v_delib int; v_info int;
  v_orphan_resolutions int; v_orphan_agreements int;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE kind = 'DECISORIO'),
         COUNT(*) FILTER (WHERE kind = 'DELIBERATIVO'),
         COUNT(*) FILTER (WHERE kind = 'INFORMATIVO')
  INTO v_total, v_decis, v_delib, v_info FROM agenda_items;

  SELECT COUNT(*) INTO v_orphan_resolutions
  FROM meeting_resolutions r
  JOIN agenda_items ai ON ai.meeting_id = r.meeting_id AND ai.order_number = r.agenda_item_index
  WHERE r.kind_resolution = 'DECISION' AND ai.kind != 'DECISORIO';

  SELECT COUNT(*) INTO v_orphan_agreements
  FROM agreements a
  JOIN agenda_items ai ON ai.meeting_id = a.parent_meeting_id
                       AND ai.order_number = COALESCE(
                         (a.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int,
                         (a.execution_mode ->> 'agenda_item_index')::int
                       )
  WHERE ai.kind != 'DECISORIO';

  RAISE NOTICE 'BACKFILL VERIFICATION:';
  RAISE NOTICE '  Total agenda_items: %', v_total;
  RAISE NOTICE '  DECISORIO: %, DELIBERATIVO: %, INFORMATIVO: %', v_decis, v_delib, v_info;
  RAISE NOTICE '  Orphan DECISION resolutions: % (esperado: 0)', v_orphan_resolutions;
  RAISE NOTICE '  Orphan agreements: % (esperado: 0)', v_orphan_agreements;

  IF v_orphan_resolutions > 0 THEN
    RAISE EXCEPTION 'BLOCKER: % orphan DECISION resolutions detected after backfill', v_orphan_resolutions;
  END IF;
  IF v_orphan_agreements > 0 THEN
    RAISE EXCEPTION 'BLOCKER: % orphan agreements detected after backfill', v_orphan_agreements;
  END IF;
END $$;

COMMIT;

-- Aplicado en Cloud governance_OS 2026-05-11:
--   total=58, DECISORIO=9, DELIBERATIVO=49, INFORMATIVO=0
--   meeting_resolutions: DECISION=13, DELIBERATION_OUTCOME=0, INFORMATION_NOTED=0
--   0 orphans
