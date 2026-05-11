-- Migration: 20260512_000062_agenda_item_kind_p7_enforcement.sql
--
-- Codex PR #2 — tres hallazgos sobre 000059/000061 que se cierran aquí:
--
-- TAREA 1 (P1): Enforce P7 inside reclassify_agenda_item_kind RPC.
--   Sin esto, un SECRETARIO autenticado puede llamar el RPC directo y elevar
--   un punto a DECISORIO en una Junta CONVOCADA/CELEBRADA no universal,
--   bypaseando el bloqueo P7 client-side (src/lib/secretaria/reclassification-matrix.ts).
--   Refleja exactamente la matriz P7 TS:
--     CANCELADA            → BLOCK (mensaje específico terminal)
--     DRAFT                → ALLOW
--     CONVOCADA|CELEBRADA + JUNTA + !is_universal + DECISORIO → BLOCK (art. 174 LSC)
--     resto (CONSEJO, JUNTA universal, INFO↔DELIB en JUNTA formal) → ALLOW
--
-- TAREA 2 (P1): T2 chequea minute.signed_at, no solo meeting.status.
--   La BD permite meeting.status='CELEBRADA' con minutes.signed_at IS NOT NULL
--   ("celebrada con acta firmada"). En ese estado agenda_items.kind debe ser
--   inmutable también. T2 original solo bloqueaba CANCELADA → falso negativo.
--
-- TAREA 3 (P2): T5 acepta execution_mode.agenda_item_index top-level.
--   La función canónica TS `extractAgendaItemIndexFromExecutionMode`
--   (src/lib/secretaria/agreement-360.ts:143-154) acepta TANTO
--   execution_mode->>'agenda_item_index' como
--   execution_mode->'agreement_360'->>'agenda_item_index'.
--   T5 original solo leía el nested → falsos negativos en el path top-level.
--
-- NO modifica 000059 ni 000061 ya aplicadas; usa CREATE OR REPLACE FUNCTION
-- en las 3 superficies y mantiene los triggers/grants existentes.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- TAREA 1 — RPC reclassify_agenda_item_kind con enforcement P7 server-side
-- ──────────────────────────────────────────────────────────────────────────────
-- Preserva firma + grants del 000059. Añade lookup de meeting.status + body_type
-- + is_universal (de quorum_data) ANTES del UPDATE y aplica la matriz P7.
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
  -- Validación motivo
  IF p_motivo IS NULL OR length(p_motivo) < 3 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 3 caracteres';
  END IF;

  -- Validación kind enum
  IF p_new_kind NOT IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO') THEN
    RAISE EXCEPTION 'p_new_kind invalido: %', p_new_kind;
  END IF;

  -- Reviewer adversarial H1 (round 4): no-op check ANTES de set_config + UPDATE
  -- para evitar contaminar agenda_item_kind_changelog WORM con filas
  -- redundantes from=to. Paridad con TS reclassification-matrix.ts:137-141.
  SELECT kind INTO v_current_kind
  FROM agenda_items
  WHERE id = p_agenda_item_id AND meeting_id = p_meeting_id;
  IF v_current_kind IS NOT NULL AND v_current_kind = p_new_kind THEN
    RAISE EXCEPTION 'P7: el punto ya está clasificado como % — reclasificación no-op rechazada (no contamina WORM audit).', p_new_kind;
  END IF;

  -- Authn: identificar caller. service_role bypassa todas las validaciones.
  IF fn_secretaria_is_service_role() THEN
    v_user_id := NULL; -- distinguir ops humanas vs scripts admin en audit
  ELSE
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION '401: usuario no autenticado';
    END IF;
  END IF;

  -- Resolver tenant del agenda_item
  SELECT tenant_id INTO v_agenda_tenant_id
  FROM agenda_items
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;
  IF v_agenda_tenant_id IS NULL THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;

  -- AuthZ tenant + role (skip para service_role)
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

  -- ─── P7 enforcement (matriz TS server-side) ──────────────────────────────
  -- Refleja src/lib/secretaria/reclassification-matrix.ts.
  SELECT
    m.status,
    COALESCE((m.quorum_data->>'is_universal')::boolean, false),
    gb.body_type
  INTO v_meeting_status, v_is_universal, v_body_type
  FROM meetings m
  LEFT JOIN governing_bodies gb ON gb.id = m.body_id
  WHERE m.id = p_meeting_id;

  -- Hard block: meeting terminal (CANCELADA)
  IF v_meeting_status = 'CANCELADA' THEN
    RAISE EXCEPTION 'P7: reclasificación bloqueada (meeting CANCELADA). Reabre via flujo formal antes de reclasificar.';
  END IF;

  -- DRAFT permisivo (cae al UPDATE).
  -- CONVOCADA/CELEBRADA: validar vicio procedimiento Junta formal.
  IF v_meeting_status IN ('CONVOCADA', 'CELEBRADA') THEN
    v_body_type_upper := UPPER(COALESCE(v_body_type, ''));
    -- Junta formal no universal: bloquear elevación a DECISORIO.
    IF v_body_type_upper IN ('JUNTA', 'JUNTA_GENERAL', 'JGA', 'JUNTA_ACCIONISTAS')
       AND v_is_universal = false
       AND p_new_kind = 'DECISORIO' THEN
      RAISE EXCEPTION 'P7: junta convocada formalmente — no se puede elevar a DECISORIO sin reconvocar (vicio de procedimiento, art. 174 LSC). Solo admisible en Junta Universal con unanimidad de los presentes.';
    END IF;
    -- CONSEJO o JUNTA universal o reclassify INFO<->DELIB: permitir.
  END IF;
  -- DRAFT y otros estados fuera de catálogo: permitir (degradación conservadora,
  -- triggers T1/T2 son backstop).
  -- ──────────────────────────────────────────────────────────────────────────

  -- set_config y UPDATE en la misma transacción → T3 captura motivo + autor
  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', COALESCE(v_user_id::text, ''), true);

  -- Codex P2 round 14: si el nuevo kind NO es DECISORIO, limpiar
  -- decision_subtype para satisfacer el CHECK constraint 000059
  -- (decision_subtype IS NULL cuando kind != 'DECISORIO').
  -- Sin esto, downgrade DECISORIO→DELIB/INFO sobre rows con subtype set
  -- fallaba con check-constraint error.
  UPDATE agenda_items
  SET kind = p_new_kind,
      decision_subtype = CASE WHEN p_new_kind = 'DECISORIO' THEN decision_subtype ELSE NULL END
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;
END;
$$;

-- Grants ya estaban concedidos en 000059. Idempotente.
REVOKE EXECUTE ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) IS
  'Codex PR#2 TAREA 1: añade enforcement P7 server-side. Matriz: CANCELADA→BLOCK, DRAFT→ALLOW, CONVOCADA/CELEBRADA + JUNTA no universal + DECISORIO→BLOCK (art. 174 LSC), resto→ALLOW. Refleja src/lib/secretaria/reclassification-matrix.ts; cierra bypass vía RPC directo. Authn/AuthZ y audit trail preservados desde 000059.';

-- ──────────────────────────────────────────────────────────────────────────────
-- TAREA 2 — T2 expandido: bloquea también con acta firmada (minute.signed_at)
-- ──────────────────────────────────────────────────────────────────────────────
-- meeting.status='CELEBRADA' + minute.signed_at NOT NULL = "celebrada con acta
-- firmada" → agenda_items.kind debe ser inmutable. Original solo bloqueaba
-- CANCELADA. Mantiene el trigger existente (CREATE OR REPLACE de la función).
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
  v_acta_firmada boolean;
BEGIN
  -- Skip si no hay cambio efectivo.
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
  'Codex PR#2 TAREA 2: bloquea cambio de kind cuando meeting.status=CANCELADA O cuando existe una minute firmada (signed_at NOT NULL). Original 000061 solo cubría CANCELADA → falsos negativos en CELEBRADA + acta firmada.';

-- ──────────────────────────────────────────────────────────────────────────────
-- TAREA 3 — T5 acepta agenda_item_index en path top-level (paridad TS)
-- ──────────────────────────────────────────────────────────────────────────────
-- La función canónica TS extractAgendaItemIndexFromExecutionMode acepta:
--   execution_mode->>'agenda_item_index'                  (top-level)
--   execution_mode->'agreement_360'->>'agenda_item_index' (nested)
-- T5 original solo leía el nested → falsos negativos en path top-level.
CREATE OR REPLACE FUNCTION agreement_requires_decisorio()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
  v_agenda_item_index int;
BEGIN
  IF NEW.parent_meeting_id IS NULL THEN
    RETURN NEW; -- No-MEETING agreement (NO_SESSION, UNIPERSONAL_*, etc.)
  END IF;

  IF NEW.execution_mode IS NULL THEN
    RETURN NEW; -- Legacy agreement sin execution_mode populated
  END IF;

  -- Paridad con extractAgendaItemIndexFromExecutionMode (top-level → nested).
  v_agenda_item_index := COALESCE(
    (NEW.execution_mode->>'agenda_item_index')::int,
    (NEW.execution_mode->'agreement_360'->>'agenda_item_index')::int
  );

  IF v_agenda_item_index IS NULL THEN
    RETURN NEW; -- Sin trazabilidad de punto explícita (compatibilidad legacy)
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
  'Codex PR#2 TAREA 3: lee agenda_item_index también del path top-level execution_mode->>agenda_item_index (no solo nested agreement_360). Paridad con src/lib/secretaria/agreement-360.ts extractAgendaItemIndexFromExecutionMode.';

COMMIT;
