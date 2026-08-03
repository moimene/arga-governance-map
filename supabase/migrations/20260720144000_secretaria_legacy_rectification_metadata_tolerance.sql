BEGIN;

-- El gate canónico sigue gobernando INSERT y cualquier UPDATE ordinario. La
-- cancelación ordenada por fn_transition_convocatoria_lifecycle se separa en
-- un trigger específico para poder preservar, sin normalizar, metadatos legacy
-- en los que los flags negativos aún no se materializaban como claves JSON.
CREATE OR REPLACE FUNCTION secretaria_private.fn_guard_governed_communication_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'secretaria_private', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP IS DISTINCT FROM 'UPDATE'
     OR current_setting('app.secretaria_convocation_lifecycle_rpc', true)
          IS DISTINCT FROM 'on'
     OR OLD.estado NOT IN ('BORRADOR', 'PROGRAMADA')
     OR NEW.estado IS DISTINCT FROM 'CANCELADA' THEN
    RAISE EXCEPTION 'GOVERNED_CONVOCATION_CANCELLATION_CONTEXT_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - 'estado' - 'updated_at')
       IS DISTINCT FROM (to_jsonb(OLD) - 'estado' - 'updated_at') THEN
    RAISE EXCEPTION
      'GOVERNED_CONVOCATION_CANCELLATION_MAY_ONLY_CHANGE_STATE_AND_UPDATED_AT'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.tipo_comunicacion IS DISTINCT FROM 'CONVOCATORIA'
     OR NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb
     OR NEW.fecha_programada IS NOT NULL
     OR NEW.fecha_envio_efectiva IS NOT NULL
     OR NEW.fecha_limite_respuesta IS NOT NULL
     OR NEW.tiene_rebotes IS TRUE
     OR upper(btrim(COALESCE(NEW.nivel_certificacion_minimo, '')))
          IS DISTINCT FROM 'EMAIL_NORMAL'
     OR NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb
     OR (
       NEW.metadata ? 'delivery_allowed'
       AND NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
     )
     OR (
       NEW.metadata ? 'dispatch_allowed'
       AND NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
     )
     OR (
       NEW.metadata ? 'dispatcher_triggered'
       AND NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
     )
     OR (
       NEW.metadata ? 'provider_interaction'
       AND NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
     )
     OR (
       NEW.metadata ? 'ead_delivery_mode'
       AND NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
     )
     OR NOT (
       COALESCE(NEW.metadata -> 'dispatch_forbidden' = 'true'::jsonb, false)
       OR COALESCE(NEW.metadata -> 'dispatch_allowed' = 'false'::jsonb, false)
     )
     OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(NEW.metadata) IS TRUE
     OR (
       NEW.metadata ? 'ead_service'
       AND NEW.metadata -> 'ead_service' IS DISTINCT FROM 'null'::jsonb
       AND (
         NEW.metadata #>> '{ead_service,mode}' IS DISTINCT FROM 'EAD_INTERPOSITION'
         OR NEW.metadata #> '{ead_service,delivery_allowed}'
              IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata #> '{ead_service,provider_interaction}'
              IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata #> '{ead_service,provider_contract_evidence}'
              IS DISTINCT FROM 'null'::jsonb
         OR NEW.metadata #> '{ead_service,signature_claim}'
              IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata #> '{ead_service,erds_claim}'
              IS DISTINCT FROM 'false'::jsonb
       )
     ) THEN
    RAISE EXCEPTION
      'GOVERNED_CONVOCATION_CANCELLATION_REQUIRES_SANDBOX_WITHOUT_EXTERNALITY'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_guard_governed_communication_cancel()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication
  ON public.communications;
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication_insert
  ON public.communications;
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_communication_update
  ON public.communications;
DROP TRIGGER IF EXISTS trg_secretaria_guard_ead_sandbox_governed_cancel
  ON public.communications;

CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication_insert
  BEFORE INSERT ON public.communications
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication();

CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication_update
  BEFORE UPDATE ON public.communications
  FOR EACH ROW
  WHEN (NOT (
    OLD.estado IN ('BORRADOR', 'PROGRAMADA')
    AND NEW.estado = 'CANCELADA'
    AND current_setting('app.secretaria_convocation_lifecycle_rpc', true) = 'on'
  ))
  EXECUTE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication();

CREATE TRIGGER trg_secretaria_guard_ead_sandbox_governed_cancel
  BEFORE UPDATE ON public.communications
  FOR EACH ROW
  WHEN (
    OLD.estado IN ('BORRADOR', 'PROGRAMADA')
    AND NEW.estado = 'CANCELADA'
    AND current_setting('app.secretaria_convocation_lifecycle_rpc', true) = 'on'
  )
  EXECUTE FUNCTION secretaria_private.fn_guard_governed_communication_cancel();

COMMENT ON FUNCTION secretaria_private.fn_guard_governed_communication_cancel() IS
  'Permite únicamente la cancelación autoritativa de una comunicación DEMO pendiente, preservando todos sus datos históricos y rechazando cualquier externalidad.';

NOTIFY pgrst, 'reload schema';

COMMIT;
