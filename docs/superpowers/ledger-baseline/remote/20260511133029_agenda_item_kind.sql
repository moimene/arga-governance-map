-- Migration: 20260512_000059_agenda_item_kind.sql (post B1-B4 fixes)

-- T1.1 agenda_items kind + decision_subtype
ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'DELIBERATIVO'
    CHECK (kind IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO')),
  ADD COLUMN IF NOT EXISTS decision_subtype text
    CHECK (decision_subtype IN ('CONSTITUTIVE', 'RATIFICATORY', 'ELEVATION', 'ACKNOWLEDGEMENT'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agenda_items_decision_subtype_only_for_decisorio'
  ) THEN
    ALTER TABLE agenda_items
      ADD CONSTRAINT agenda_items_decision_subtype_only_for_decisorio
      CHECK (kind = 'DECISORIO' OR decision_subtype IS NULL);
  END IF;
END $$;

COMMENT ON COLUMN agenda_items.kind IS 'Naturaleza del punto: INFORMATIVO (sin decision), DELIBERATIVO (debate sin decision formal), DECISORIO (sometible a votacion). Solo DECISORIO puede materializar agreement. Default conservador DELIBERATIVO.';
COMMENT ON COLUMN agenda_items.decision_subtype IS 'Subtipo opcional de DECISORIO: CONSTITUTIVE, RATIFICATORY, ELEVATION, ACKNOWLEDGEMENT. NULL para INFO/DELIB.';

-- T1.2 meeting_resolutions.kind_resolution
ALTER TABLE meeting_resolutions
  ADD COLUMN IF NOT EXISTS kind_resolution text NOT NULL DEFAULT 'DECISION'
    CHECK (kind_resolution IN ('DECISION', 'DELIBERATION_OUTCOME', 'INFORMATION_NOTED'));

COMMENT ON COLUMN meeting_resolutions.kind_resolution IS 'Tipo de outcome. Cross-validated bidireccional contra agenda_items.kind via trigger T4.';

-- T1.3 audit log table
CREATE TABLE IF NOT EXISTS agenda_item_kind_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agenda_item_id uuid NOT NULL REFERENCES agenda_items(id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  meeting_status_at_change text NOT NULL,
  from_kind text NOT NULL,
  to_kind text NOT NULL,
  motivo text NOT NULL CHECK (length(motivo) >= 3),
  autor uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT changelog_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE agenda_item_kind_changelog IS 'Audit log WORM de cambios de kind. INSERT only via trigger T3.';

DROP TRIGGER IF EXISTS tr_worm_agenda_kind_changelog_update ON agenda_item_kind_changelog;
CREATE TRIGGER tr_worm_agenda_kind_changelog_update
  BEFORE UPDATE ON agenda_item_kind_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS tr_worm_agenda_kind_changelog_delete ON agenda_item_kind_changelog;
CREATE TRIGGER tr_worm_agenda_kind_changelog_delete
  BEFORE DELETE ON agenda_item_kind_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

CREATE INDEX IF NOT EXISTS idx_agenda_kind_changelog_item
  ON agenda_item_kind_changelog(agenda_item_id, created_at DESC);

ALTER TABLE agenda_item_kind_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_kind_changelog_tenant_read ON agenda_item_kind_changelog;
CREATE POLICY agenda_kind_changelog_tenant_read ON agenda_item_kind_changelog FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS agenda_kind_changelog_tenant_insert ON agenda_item_kind_changelog;
CREATE POLICY agenda_kind_changelog_tenant_insert ON agenda_item_kind_changelog FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- T1.4 RPC helper
CREATE OR REPLACE FUNCTION set_kind_change_context(
  p_motivo text,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', p_user_id::text, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION set_kind_change_context FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_kind_change_context TO authenticated;

-- T1 inmutable post-voted (B1 fix: order_number)
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_voted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    IF EXISTS (
      SELECT 1 FROM meeting_resolutions r
      WHERE r.meeting_id = NEW.meeting_id
        AND r.agenda_item_index = NEW.order_number
    ) THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: existe meeting_resolution apuntando al punto. Cambia primero la resolution.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_immutable_after_voted ON agenda_items;
CREATE TRIGGER tr_agenda_kind_immutable_after_voted
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_immutable_after_voted();

-- T2 inmutable post-closed
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF COALESCE(v_meeting_status, '') = 'CLOSED' THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: la reunion esta CLOSED. Reabre la reunion via flujo formal antes de reclasificar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_immutable_after_closed ON agenda_items;
CREATE TRIGGER tr_agenda_kind_immutable_after_closed
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_immutable_after_closed();

-- T3 audit log SECURITY DEFINER + COALESCE tenant_id (B3 + B4 fix)
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
    IF v_meeting_status IN ('CONVOKED', 'OPEN') THEN
      INSERT INTO agenda_item_kind_changelog (
        tenant_id, agenda_item_id, meeting_id, meeting_status_at_change,
        from_kind, to_kind, motivo, autor
      ) VALUES (
        COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
        NEW.id, NEW.meeting_id, v_meeting_status,
        OLD.kind, NEW.kind,
        COALESCE(current_setting('app.kind_change_motivo', true), 'sin_motivo_proporcionado'),
        NULLIF(current_setting('app.user_id', true), '')::uuid
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_agenda_kind_audit_after_convoked ON agenda_items;
CREATE TRIGGER tr_agenda_kind_audit_after_convoked
  AFTER UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_audit_after_convoked();

-- T4 cross-validation bidireccional (B1 fix: order_number)
CREATE OR REPLACE FUNCTION resolution_kind_matches_agenda()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
BEGIN
  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.meeting_id
    AND order_number = NEW.agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'meeting_resolutions.agenda_item_index=% no corresponde a ningun agenda_item de la reunion %', NEW.agenda_item_index, NEW.meeting_id;
  END IF;

  IF NEW.kind_resolution = 'DECISION' AND v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'kind_resolution=DECISION requiere agenda_items.kind=DECISORIO (actual: %).', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'DELIBERATION_OUTCOME' AND v_agenda_kind != 'DELIBERATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=DELIBERATION_OUTCOME requiere agenda_items.kind=DELIBERATIVO (actual: %).', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'INFORMATION_NOTED' AND v_agenda_kind != 'INFORMATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=INFORMATION_NOTED requiere agenda_items.kind=INFORMATIVO (actual: %).', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_resolution_kind_matches_agenda ON meeting_resolutions;
CREATE TRIGGER tr_resolution_kind_matches_agenda
  BEFORE INSERT OR UPDATE ON meeting_resolutions
  FOR EACH ROW EXECUTE FUNCTION resolution_kind_matches_agenda();

-- T5 agreement requires DECISORIO (B1 + D2 fix)
CREATE OR REPLACE FUNCTION agreement_requires_decisorio()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
  v_agenda_item_index int;
BEGIN
  IF NEW.parent_meeting_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.execution_mode IS NULL THEN
    RETURN NEW;
  END IF;

  -- I1 fix: check both top-level and nested execution_mode shapes
  v_agenda_item_index := COALESCE(
    (NEW.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int,
    (NEW.execution_mode ->> 'agenda_item_index')::int
  );
  IF v_agenda_item_index IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.parent_meeting_id
    AND order_number = v_agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'agreement.parent_meeting_id no tiene agenda_item con order_number=%', v_agenda_item_index;
  END IF;

  IF v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'agreement requiere agenda_item.kind=DECISORIO (actual: %). Punto informativo/deliberativo no puede materializar Acuerdo360.', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agreement_requires_decisorio ON agreements;
CREATE TRIGGER tr_agreement_requires_decisorio
  BEFORE INSERT OR UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION agreement_requires_decisorio();

-- T6 DROPPED (B2 fix): meetings.adoption_mode no existe en schema real.
