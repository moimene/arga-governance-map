-- Codex P1 #1 security fix: harden reclassify_agenda_item_kind RPC.
--
-- Bug: RPC granted to 'authenticated' + p_user_id supplied by caller →
-- (a) cualquier user autenticado bypasea useUserRole SECRETARIO check
-- (b) audit author es forgeable via p_user_id parameter
--
-- Fix:
-- 1. Eliminar parámetro p_user_id; derivar de auth.uid() server-side
-- 2. Validar que auth.uid() tenga rol SECRETARIO via rbac_user_roles JOIN rbac_roles
-- 3. Validar tenant scope: el agenda_item.tenant_id debe matchear el tenant del user
-- 4. service_role siempre permitido (bypass para scripts admin)

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
BEGIN
  -- Validación motivo
  IF p_motivo IS NULL OR length(p_motivo) < 3 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 3 caracteres';
  END IF;

  -- Validación kind enum
  IF p_new_kind NOT IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO') THEN
    RAISE EXCEPTION 'p_new_kind invalido: %', p_new_kind;
  END IF;

  -- Authn: identificar caller. service_role bypassa todas las validaciones
  -- (necesario para scripts admin + backfill + tests).
  IF fn_secretaria_is_service_role() THEN
    -- service_role: setear autor como NULL para distinguir de operaciones humanas
    v_user_id := NULL;
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
    -- Validación tenant: el user actual debe pertenecer al tenant del agenda_item
    PERFORM fn_secretaria_assert_tenant_access(v_agenda_tenant_id);

    -- Validación rol: caller debe tener SECRETARIO en rbac_user_roles
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

  -- set_config y UPDATE en la misma transacción → T3 trigger captura motivo + autor
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

-- Drop la versión anterior con p_user_id (signature obsoleta + forgeable)
DROP FUNCTION IF EXISTS reclassify_agenda_item_kind(uuid, uuid, text, text, uuid);

COMMENT ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) IS
  'Codex P1 #1 security fix: RPC seguro que (a) deriva caller desde auth.uid() en lugar de aceptar p_user_id forgeable, (b) valida tenant scope via fn_secretaria_assert_tenant_access, (c) valida rol SECRETARIO en rbac_user_roles. service_role bypasea validaciones (scripts admin + backfill + tests). Audit author (v_user_id) capturado via session var consumida por trigger T3.';
