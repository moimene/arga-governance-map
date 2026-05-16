-- Codex review P1 #1 fix: RPC transaccional consolidado
-- Reemplaza el patrón "set_kind_change_context + UPDATE" (2 transacciones HTTP
-- separadas via PostgREST → session vars se pierden) por un RPC único que
-- hace set_config + UPDATE en una sola transacción atómica.
CREATE OR REPLACE FUNCTION reclassify_agenda_item_kind(
  p_agenda_item_id uuid,
  p_meeting_id uuid,
  p_new_kind text,
  p_motivo text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validación motivo (defensa además del CHECK BD en agenda_item_kind_changelog)
  IF length(p_motivo) < 3 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 3 caracteres';
  END IF;

  -- Validación kind enum
  IF p_new_kind NOT IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO') THEN
    RAISE EXCEPTION 'p_new_kind invalido: %', p_new_kind;
  END IF;

  -- Setear session vars EN LA MISMA TRANSACCIÓN del UPDATE.
  -- Por estar dentro de la misma función PL/pgSQL, el set_config con scope
  -- 'true' (local) se ve por el trigger T3 que ejecuta inmediatamente después
  -- del UPDATE.
  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', p_user_id::text, true);

  -- UPDATE — dispara T3 (audit log) que captura motivo + autor via current_setting
  UPDATE agenda_items
  SET kind = p_new_kind
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION reclassify_agenda_item_kind FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclassify_agenda_item_kind TO authenticated;

COMMENT ON FUNCTION reclassify_agenda_item_kind IS
  'Codex P1 #1 fix: RPC consolidado que ejecuta set_config + UPDATE en una sola transaccion atomica. El trigger T3 ve los session vars porque corren en la misma transaccion. Reemplaza el patron set_kind_change_context + supabase.from(agenda_items).update() que dividia en 2 HTTP requests separados sin compartir session.';

-- Codex P1 #2 fix: derive kind_resolution desde agenda.kind ANTES de validar
-- en T4. Esto permite que fn_save_meeting_resolutions inserte sin especificar
-- kind_resolution y el trigger lo deriva automáticamente. Cambio de la
-- función validator para que opere como BEFORE INSERT con auto-derive.
CREATE OR REPLACE FUNCTION resolution_kind_matches_agenda()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
BEGIN
  -- Look up agenda kind
  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.meeting_id
    AND order_number = NEW.agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'meeting_resolutions.agenda_item_index=% no corresponde a ningun agenda_item de la reunion %', NEW.agenda_item_index, NEW.meeting_id;
  END IF;

  -- P1 #2 fix: auto-derive kind_resolution from agenda.kind cuando viene con
  -- el DEFAULT 'DECISION' pero agenda no es DECISORIO. Esto previene que
  -- fn_save_meeting_resolutions (que no pasa kind_resolution) rompa el save
  -- de cualquier reunion con puntos INFO/DELIB.
  -- Conditional: solo auto-derive si kind_resolution viene con el default.
  -- Si el caller pasa explicitamente DELIBERATION_OUTCOME sobre INFORMATIVO,
  -- todavia rechazamos (errores explicitos del usuario no se silencian).
  IF NEW.kind_resolution = 'DECISION' AND v_agenda_kind = 'DELIBERATIVO' THEN
    NEW.kind_resolution := 'DELIBERATION_OUTCOME';
  ELSIF NEW.kind_resolution = 'DECISION' AND v_agenda_kind = 'INFORMATIVO' THEN
    NEW.kind_resolution := 'INFORMATION_NOTED';
  END IF;

  -- Bidireccional D1 — validación POST-derivación
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

COMMENT ON FUNCTION resolution_kind_matches_agenda IS
  'Trigger T4 cross-validation BIDIRECCIONAL + auto-derive (Codex P1 #2 fix). Si kind_resolution viene con DEFAULT DECISION pero agenda es DELIB/INFO, lo deriva automaticamente. Esto permite que fn_save_meeting_resolutions y otros legacy callers sigan funcionando sin pasar kind_resolution explicitamente. Errores explicitos del caller (ej. pasar DELIBERATION_OUTCOME sobre INFORMATIVO) siguen rechazados.';
