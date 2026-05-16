-- Migration: 20260512_000061_agenda_item_kind_status_espanol.sql
--
-- Fix Codex P1: la migración 000059 definía triggers T2/T3 + comparaciones que
-- usaban estados INGLESES ('CONVOKED', 'OPEN', 'CLOSED', 'DRAFT') que no existen
-- en producción. El CHECK constraint real de meetings.status es:
--
--   CHECK (status IN ('DRAFT', 'CONVOCADA', 'CELEBRADA', 'CANCELADA'))
--
-- Mapeo aplicado (alineado con CHECK constraint de la BD, verified 2026-05-12):
--   'CONVOKED' → 'CONVOCADA'
--   'OPEN'     → 'CELEBRADA'
--   'CLOSED'   → 'CANCELADA'   (no existe 'CERRADA' en el CHECK; estado terminal = CANCELADA)
--   'DRAFT'    → 'DRAFT'        (producción mantiene 'DRAFT' literal en inglés)
--
-- Consecuencia del bug original (Codex P1 detect):
--   "this trigger only writes the WORM changelog for CONVOKED/OPEN.
--    Reclassifications made through the normal UI ... therefore update
--    agenda_items.kind without any audit row"
--
-- Esta migración REEMPLAZA las funciones afectadas:
--   - agenda_kind_immutable_after_closed  (T2)  → 'CLOSED' → 'CANCELADA'
--   - agenda_kind_audit_after_convoked    (T3)  → IN ('CONVOKED','OPEN') → IN ('CONVOCADA','CELEBRADA')
--
-- NO toca:
--   - agenda_kind_immutable_after_voted   (T1)  → no usa meeting.status (usa meeting_resolutions)
--   - resolution_kind_matches_agenda      (T4)  → no usa meeting.status
--   - agreement_requires_decisorio        (T5)  → no usa meeting.status
--   - reclassify_agenda_item_kind         RPC   → no valida meeting.status (delega a triggers)
--   - fn_secretaria_assert_tenant_access        → helper, no toca estados
--   - fn_secretaria_is_service_role             → helper, no toca estados
--
-- Triggers se mantienen sobre las MISMAS funciones (CREATE OR REPLACE FUNCTION)
-- así que no es necesario DROP/CREATE de los triggers.
--
-- Spec referencia: docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md §4.6/§4.7

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.6 — Trigger T2: kind inmutable post-meeting-cerrada (CANCELADA)
-- Reemplaza 'CLOSED' → 'CANCELADA'. Mensaje actualizado a estado español.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF v_meeting_status = 'CANCELADA' THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: la reunión está CANCELADA. Reabre la reunión via flujo formal antes de reclasificar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.7 — Trigger T3: audit log post-CONVOCADA/CELEBRADA
-- Reemplaza IN ('CONVOKED', 'OPEN') → IN ('CONVOCADA', 'CELEBRADA').
-- SECURITY DEFINER + COALESCE tenant_id preservados.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_audit_after_convoked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF v_meeting_status IN ('CONVOCADA', 'CELEBRADA') THEN
      INSERT INTO agenda_item_kind_changelog (
        tenant_id, agenda_item_id, meeting_id, meeting_status_at_change,
        from_kind, to_kind, motivo, autor
      ) VALUES (
        COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
        NEW.id, NEW.meeting_id, v_meeting_status,
        OLD.kind, NEW.kind,
        COALESCE(current_setting('app.kind_change_motivo', true),
                 'sin_motivo_proporcionado'),
        NULLIF(current_setting('app.user_id', true), '')::uuid
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
