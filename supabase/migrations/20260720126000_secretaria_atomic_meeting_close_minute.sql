-- Cierre autoritativo de reunion y generacion de acta como una sola unidad.
--
-- La interfaz historica ejecutaba tres escrituras independientes:
--   1. snapshot WORM; 2. acta; 3. meetings.status = CELEBRADA.
-- Desde que fn_generar_acta recompone el acta en servidor y exige una reunion
-- ya cerrada, ese orden no solo falla: cualquier reordenacion en cliente deja
-- estados parciales si una llamada posterior aborta. Esta RPC mantiene bajo la
-- misma transaccion implicita de PostgreSQL el cierre, el censo WORM y el acta.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_atomic_meeting_close()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_atomic_writer text := current_setting('app.secretaria_atomic_close_rpc', true);
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'CELEBRADA'
     AND (
       current_user <> 'postgres'
       OR v_atomic_writer IS DISTINCT FROM 'fn_secretaria_close_meeting_and_generate_minute'
     ) THEN
    RAISE EXCEPTION
      'ATOMIC_MEETING_CLOSE_REQUIRED: CELEBRADA solo puede alcanzarse junto con snapshot WORM y acta autoritativa'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_00_atomic_meeting_close_guard ON public.meetings;
CREATE TRIGGER trg_00_atomic_meeting_close_guard
  BEFORE UPDATE OF status ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_atomic_meeting_close();

CREATE OR REPLACE FUNCTION public.fn_secretaria_close_meeting_and_generate_minute(
  p_meeting_id uuid,
  p_content text DEFAULT NULL,
  p_canonical_minutes_hash text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  v_meeting record;
  v_existing record;
  v_snapshot_type text;
  v_snapshot_id uuid;
  v_minute_id uuid;
  v_is_junta boolean;
  v_is_universal boolean;
  v_updated integer;
BEGIN
  IF p_meeting_id IS NULL THEN
    RAISE EXCEPTION 'atomic meeting close: meeting_id is required';
  END IF;

  -- El bloqueo serializa cierres concurrentes. Entidad y organo se derivan de
  -- las relaciones persistidas; el cliente no puede proponer ni sustituirlos.
  SELECT
    meeting.*,
    body.entity_id AS resolved_entity_id,
    body.body_type AS resolved_body_type,
    entity.id AS verified_entity_id
    INTO v_meeting
    FROM public.meetings meeting
    JOIN public.governing_bodies body
      ON body.id = meeting.body_id
     AND body.tenant_id = meeting.tenant_id
    JOIN public.entities entity
      ON entity.id = body.entity_id
     AND entity.tenant_id = meeting.tenant_id
   WHERE meeting.id = p_meeting_id
   FOR UPDATE OF meeting;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'atomic meeting close: meeting not found or entity/body scope mismatch';
  END IF;

  IF v_meeting.body_id IS NULL
     OR v_meeting.resolved_entity_id IS NULL
     OR v_meeting.verified_entity_id IS DISTINCT FROM v_meeting.resolved_entity_id
     OR COALESCE(btrim(v_meeting.resolved_body_type), '') = '' THEN
    RAISE EXCEPTION 'atomic meeting close: entity and governing body must be identified and scope-consistent';
  END IF;

  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> v_meeting.tenant_id THEN
      RAISE EXCEPTION 'atomic meeting close: tenant mismatch' USING ERRCODE = '42501';
    END IF;
    PERFORM public.fn_secretaria_assert_role_allowed(
      v_meeting.tenant_id,
      ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]
    );
  END IF;

  -- Este gate se repite deliberadamente dentro del motor de manifiesto que
  -- invoca fn_generar_acta. Tenerlo aqui evita incluso una transicion temporal
  -- para sesiones futuras/abiertas; si la segunda comprobacion fallara, toda la
  -- funcion seguiria haciendo rollback como una unica transaccion.
  IF v_meeting.scheduled_start IS NULL
     OR v_meeting.scheduled_end IS NULL
     OR v_meeting.scheduled_end < v_meeting.scheduled_start THEN
    RAISE EXCEPTION 'atomic meeting close: coherent start and end timestamps are required';
  END IF;
  IF v_meeting.scheduled_start > now()
     OR v_meeting.scheduled_end > now() THEN
    RAISE EXCEPTION 'atomic meeting close: a future or still-open meeting cannot be closed or produce legal minutes';
  END IF;

  -- Reintento seguro: solo se devuelve un acta ya creada si todo el enlace
  -- autoritativo (estado, scope, snapshot y evidencia WORM) sigue intacto.
  SELECT
    minute.id,
    minute.tenant_id,
    minute.meeting_id,
    minute.entity_id,
    minute.body_id,
    minute.snapshot_id,
    minute.authoritative_manifest_hash,
    minute.legal_gate_status,
    snapshot.audit_worm_id,
    audit.hash_sha512 AS audit_hash_sha512
    INTO v_existing
    FROM public.minutes minute
    LEFT JOIN public.censo_snapshot snapshot
      ON snapshot.id = minute.snapshot_id
     AND snapshot.tenant_id = minute.tenant_id
     AND snapshot.meeting_id = minute.meeting_id
    LEFT JOIN public.audit_log audit
      ON audit.id = snapshot.audit_worm_id
     AND audit.tenant_id = snapshot.tenant_id
   WHERE minute.meeting_id = p_meeting_id
   FOR UPDATE OF minute;

  IF FOUND THEN
    IF v_meeting.status <> 'CELEBRADA'
       OR v_existing.tenant_id IS DISTINCT FROM v_meeting.tenant_id
       OR v_existing.entity_id IS DISTINCT FROM v_meeting.resolved_entity_id
       OR v_existing.body_id IS DISTINCT FROM v_meeting.body_id
       OR v_existing.snapshot_id IS NULL
       OR v_existing.audit_worm_id IS NULL
       OR v_existing.audit_hash_sha512 IS NULL
       OR v_existing.audit_hash_sha512 !~ '^[0-9a-f]{128}$'
       OR v_existing.authoritative_manifest_hash IS NULL
       OR v_existing.authoritative_manifest_hash !~ '^[0-9a-f]{64}$'
       OR v_existing.legal_gate_status NOT IN (
         'MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED'
       ) THEN
      RAISE EXCEPTION 'atomic meeting close: existing minute is not a valid idempotent authoritative result';
    END IF;
    RETURN v_existing.id;
  END IF;

  IF v_meeting.status <> 'EN_CURSO' THEN
    RAISE EXCEPTION
      'atomic meeting close: expected EN_CURSO before first close, status=%',
      v_meeting.status;
  END IF;

  v_is_junta := (
    upper(v_meeting.resolved_body_type) IN (
      'JUNTA', 'JGA', 'JUNTA_GENERAL', 'JUNTA_GENERAL_ACCIONISTAS',
      'JUNTA_GENERAL_SOCIOS'
    )
    OR upper(v_meeting.resolved_body_type) LIKE 'JUNTA%'
  );
  v_is_universal :=
    COALESCE((v_meeting.quorum_data ->> 'is_universal')::boolean, false)
    OR COALESCE((v_meeting.quorum_data ->> 'junta_universal')::boolean, false)
    OR COALESCE((v_meeting.quorum_data ->> 'organo_universal')::boolean, false)
    OR upper(COALESCE(v_meeting.meeting_type, '')) LIKE '%UNIVERSAL%';

  IF v_is_universal AND NOT v_is_junta THEN
    RAISE EXCEPTION 'atomic meeting close: UNIVERSAL is only valid for a shareholders meeting';
  END IF;

  v_snapshot_type := CASE
    WHEN v_is_junta AND v_is_universal THEN 'UNIVERSAL'
    WHEN v_is_junta THEN 'ECONOMICO'
    ELSE 'POLITICO'
  END;

  -- El trigger de meetings exige tanto el owner SECURITY DEFINER como esta
  -- capacidad local. Un cliente no puede reproducir ambas condiciones.
  PERFORM pg_catalog.set_config(
    'app.secretaria_atomic_close_rpc',
    'fn_secretaria_close_meeting_and_generate_minute',
    true
  );

  UPDATE public.meetings
     SET status = 'CELEBRADA'
   WHERE id = p_meeting_id
     AND tenant_id = v_meeting.tenant_id
     AND body_id = v_meeting.body_id
     AND status = 'EN_CURSO';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM pg_catalog.set_config('app.secretaria_atomic_close_rpc', '', true);

  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'atomic meeting close: concurrent or invalid status transition';
  END IF;

  v_snapshot_id := public.fn_crear_censo_snapshot(
    p_meeting_id,
    'MEETING',
    v_meeting.resolved_entity_id,
    v_meeting.body_id,
    v_snapshot_type
  );

  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION 'atomic meeting close: census snapshot was not created';
  END IF;

  -- fn_generar_acta ejecuta el motor autoritativo existente: vuelve a bloquear
  -- sesiones futuras/abiertas, valida convocatoria, quorum, votos, constancias,
  -- cuentas anuales y recompone el contenido sin confiar en el cliente.
  v_minute_id := public.fn_generar_acta(
    p_meeting_id,
    COALESCE(p_content, ''),
    v_snapshot_id,
    p_canonical_minutes_hash
  );

  IF v_minute_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM public.minutes minute
      JOIN public.censo_snapshot snapshot
        ON snapshot.id = minute.snapshot_id
       AND snapshot.tenant_id = minute.tenant_id
       AND snapshot.meeting_id = minute.meeting_id
       AND snapshot.entity_id = minute.entity_id
       AND snapshot.body_id IS NOT DISTINCT FROM minute.body_id
      JOIN public.audit_log audit
        ON audit.id = snapshot.audit_worm_id
       AND audit.tenant_id = snapshot.tenant_id
     WHERE minute.id = v_minute_id
       AND minute.meeting_id = p_meeting_id
       AND minute.tenant_id = v_meeting.tenant_id
       AND minute.entity_id = v_meeting.resolved_entity_id
       AND minute.body_id = v_meeting.body_id
       AND minute.snapshot_id = v_snapshot_id
       AND minute.legal_gate_status = 'MANIFEST_READY'
       AND audit.hash_sha512 ~ '^[0-9a-f]{128}$'
  ) THEN
    RAISE EXCEPTION 'atomic meeting close: authoritative minute invariant failed';
  END IF;

  RETURN v_minute_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_close_meeting_and_generate_minute(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_close_meeting_and_generate_minute(uuid, text, text)
  TO authenticated, service_role;

-- El navegador no debe poder recomponer la secuencia antigua invocando el
-- escritor de acta directamente. La RPC atomica lo ejecuta como owner; el
-- service role conserva acceso para reconciliacion operativa controlada.
REVOKE EXECUTE ON FUNCTION public.fn_generar_acta(uuid, text, uuid, text)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_generar_acta(uuid, text, uuid)
  FROM authenticated;

COMMENT ON FUNCTION public.fn_secretaria_close_meeting_and_generate_minute(uuid, text, text) IS
  'Cierra EN_CURSO, crea el censo WORM y genera el acta autoritativa en una unica transaccion idempotente; entidad, organo y tipo de censo se derivan en servidor.';

COMMIT;
