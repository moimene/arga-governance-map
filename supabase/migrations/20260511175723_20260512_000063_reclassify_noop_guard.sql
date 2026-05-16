-- Patch: añade no-op check al inicio del RPC reclassify_agenda_item_kind
-- para evitar contaminar agenda_item_kind_changelog WORM con filas
-- redundantes from=to. Idempotente (CREATE OR REPLACE FUNCTION).
-- Reviewer adversarial H1 round 4.

CREATE OR REPLACE FUNCTION reclassify_agenda_item_kind(
  p_agenda_item_id uuid,
  p_meeting_id uuid,
  p_new_kind text,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_agenda_tenant_id uuid;
  v_has_secretario_role boolean;
  v_meeting_status text;
  v_is_universal boolean;
  v_body_type text;
  v_body_type_upper text;
  v_current_kind text;
BEGIN
  IF p_motivo IS NULL OR length(p_motivo) < 3 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 3 caracteres';
  END IF;

  IF p_new_kind NOT IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO') THEN
    RAISE EXCEPTION 'p_new_kind invalido: %', p_new_kind;
  END IF;

  -- No-op guard (Reviewer adversarial H1 round 4)
  SELECT kind INTO v_current_kind
  FROM agenda_items
  WHERE id = p_agenda_item_id AND meeting_id = p_meeting_id;
  IF v_current_kind IS NOT NULL AND v_current_kind = p_new_kind THEN
    RAISE EXCEPTION 'P7: el punto ya está clasificado como % — reclasificación no-op rechazada (no contamina WORM audit).', p_new_kind;
  END IF;

  IF fn_secretaria_is_service_role() THEN
    v_user_id := NULL;
  ELSE
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION '401: usuario no autenticado';
    END IF;
  END IF;

  SELECT tenant_id INTO v_agenda_tenant_id
  FROM agenda_items
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;
  IF v_agenda_tenant_id IS NULL THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;

  IF NOT fn_secretaria_is_service_role() THEN
    PERFORM fn_secretaria_assert_tenant_access(v_agenda_tenant_id);
    SELECT EXISTS (
      SELECT 1
      FROM rbac_user_roles ur
      JOIN rbac_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id
        AND ur.tenant_id = v_agenda_tenant_id
        AND ur.is_active = true
        AND r.role_code = 'SECRETARIO'
    ) INTO v_has_secretario_role;
    IF NOT v_has_secretario_role THEN
      RAISE EXCEPTION '403: usuario % no tiene rol SECRETARIO en tenant %', v_user_id, v_agenda_tenant_id;
    END IF;
  END IF;

  SELECT
    m.status,
    COALESCE((m.quorum_data->>'is_universal')::boolean, false),
    gb.body_type
  INTO v_meeting_status, v_is_universal, v_body_type
  FROM meetings m
  LEFT JOIN governing_bodies gb ON gb.id = m.body_id
  WHERE m.id = p_meeting_id;

  IF v_meeting_status = 'CANCELADA' THEN
    RAISE EXCEPTION 'P7: reclasificación bloqueada (meeting CANCELADA). Reabre via flujo formal antes de reclasificar.';
  END IF;

  IF v_meeting_status IN ('CONVOCADA', 'CELEBRADA') THEN
    v_body_type_upper := UPPER(COALESCE(v_body_type, ''));
    IF v_body_type_upper IN ('JUNTA', 'JUNTA_GENERAL', 'JGA', 'JUNTA_ACCIONISTAS')
       AND v_is_universal = false
       AND p_new_kind = 'DECISORIO' THEN
      RAISE EXCEPTION 'P7: junta convocada formalmente — no se puede elevar a DECISORIO sin reconvocar (vicio de procedimiento, art. 174 LSC). Solo admisible en Junta Universal con unanimidad de los presentes.';
    END IF;
  END IF;

  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', COALESCE(v_user_id::text, ''), true);

  UPDATE agenda_items
  SET kind = p_new_kind
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;
END;
$$;
