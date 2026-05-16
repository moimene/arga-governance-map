-- Migration: 20260512_000062_agenda_item_kind_p7_enforcement.sql
-- Codex PR #2 — TAREA 1 (RPC P7) + TAREA 2 (T2 signed_at) + TAREA 3 (T5 top-level)

-- TAREA 1 — RPC reclassify_agenda_item_kind con enforcement P7 server-side
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
BEGIN
  IF p_motivo IS NULL OR length(p_motivo) < 3 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 3 caracteres';
  END IF;
  IF p_new_kind NOT IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO') THEN
    RAISE EXCEPTION 'p_new_kind invalido: %', p_new_kind;
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

  -- P7 enforcement (matriz TS server-side)
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

REVOKE EXECUTE ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) IS
  'Codex PR#2 TAREA 1: añade enforcement P7 server-side. Matriz: CANCELADA->BLOCK, DRAFT->ALLOW, CONVOCADA/CELEBRADA + JUNTA no universal + DECISORIO->BLOCK (art. 174 LSC), resto->ALLOW. Refleja src/lib/secretaria/reclassification-matrix.ts; cierra bypass via RPC directo.';

-- TAREA 2 — T2: bloquea también con acta firmada (minute.signed_at)
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
  v_acta_firmada boolean;
BEGIN
  IF OLD.kind IS NOT DISTINCT FROM NEW.kind THEN
    RETURN NEW;
  END IF;
  SELECT
    m.status,
    EXISTS (
      SELECT 1
      FROM minutes mn
      WHERE mn.meeting_id = m.id
        AND mn.signed_at IS NOT NULL
    )
  INTO v_meeting_status, v_acta_firmada
  FROM meetings m
  WHERE m.id = NEW.meeting_id;
  IF v_meeting_status = 'CANCELADA' OR v_acta_firmada THEN
    RAISE EXCEPTION 'agenda_items.kind inmutable: reunión cerrada (CANCELADA o acta firmada). Reclasificación bloqueada por T2.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION agenda_kind_immutable_after_closed() IS
  'Codex PR#2 TAREA 2: bloquea cambio de kind cuando meeting.status=CANCELADA O cuando existe una minute firmada (signed_at NOT NULL).';

-- TAREA 3 — T5 acepta agenda_item_index top-level (paridad TS)
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
  v_agenda_item_index := COALESCE(
    (NEW.execution_mode->>'agenda_item_index')::int,
    (NEW.execution_mode->'agreement_360'->>'agenda_item_index')::int
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

COMMENT ON FUNCTION agreement_requires_decisorio() IS
  'Codex PR#2 TAREA 3: lee agenda_item_index también del path top-level execution_mode->>agenda_item_index. Paridad con src/lib/secretaria/agreement-360.ts.';
