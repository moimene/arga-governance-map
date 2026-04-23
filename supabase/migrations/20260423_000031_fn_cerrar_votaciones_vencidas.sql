-- G6: Auto-close expired VOTING_OPEN no-session resolutions
-- Closes processes where voting_deadline < now() → status = 'RECHAZADO'
-- Can be called from frontend hook or pg_cron (if available on the project plan)

CREATE OR REPLACE FUNCTION fn_cerrar_votaciones_vencidas(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE no_session_resolutions
  SET
    status    = 'RECHAZADO',
    closed_at = now()
  WHERE
    status           = 'VOTING_OPEN'
    AND voting_deadline < now()
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant execution to authenticated users (frontend hook calls it with tenant scope)
GRANT EXECUTE ON FUNCTION fn_cerrar_votaciones_vencidas(uuid) TO authenticated;

COMMENT ON FUNCTION fn_cerrar_votaciones_vencidas IS
  'Cierra procesos de acuerdo sin sesión (VOTING_OPEN) cuyo plazo de votación ha vencido. '
  'Devuelve el número de filas cerradas. Puede invocarse desde frontend o pg_cron.';
