BEGIN;

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
