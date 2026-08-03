BEGIN;

-- Una rectificación gobernada debe poder cancelar el agregado operativo aun
-- cuando conserva metadatos legacy que ya no coinciden con el manifiesto. La
-- cancelación no corrige ni reescribe esa historia: solo cambia el estado y la
-- fecha de actualización. Cualquier otro cambio o cualquier externalidad sigue
-- bloqueado por el mismo gate.
CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_governed_cancel boolean := false;
  v_manifest public.convocation_manifests%ROWTYPE;
  v_is_demo_sandbox boolean := false;
  v_manifest_ead_requested boolean := false;
  v_canonical_ead_service jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_governed_cancel :=
      current_setting('app.secretaria_convocation_lifecycle_rpc', true) = 'on'
      AND OLD.estado IN ('BORRADOR', 'PROGRAMADA')
      AND NEW.estado = 'CANCELADA';

    IF v_governed_cancel THEN
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
         OR NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
         OR NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
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
    END IF;
  END IF;

  IF NEW.tipo_comunicacion = 'CONVOCATORIA' THEN
    SELECT manifest.* INTO v_manifest
      FROM public.convocation_manifests manifest
     WHERE manifest.tenant_id = NEW.tenant_id
       AND manifest.convocatoria_id = NEW.convocatoria_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_MANIFEST_REQUIRED'
        USING ERRCODE = '23514';
    END IF;
    v_is_demo_sandbox := COALESCE(
      v_manifest.data_class = 'DEMO'
      AND v_manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
      AND v_manifest.manifest_json #>> '{publication,delivery_mode}' = 'SANDBOX_ONLY'
      AND v_manifest.manifest_json #> '{publication,real_delivery_allowed}'
            = 'false'::jsonb,
      false
    );
    IF NOT v_is_demo_sandbox THEN
      RAISE EXCEPTION 'CONVOCATION_COMMUNICATION_REQUIRES_CANONICAL_DEMO_SANDBOX'
        USING ERRCODE = '23514';
    END IF;
    v_manifest_ead_requested := EXISTS (
      SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(v_manifest.manifest_json -> 'recipients') = 'array'
              THEN v_manifest.manifest_json -> 'recipients'
            ELSE '[]'::jsonb
          END
        ) recipient
       WHERE recipient ->> 'channel' = 'EAD_INTERPOSITION'
    );
    v_canonical_ead_service := jsonb_build_object(
      'mode', 'EAD_INTERPOSITION',
      'policy_scope', jsonb_build_array(
        'BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING'
      ),
      'environment', 'SANDBOX',
      'delivery_allowed', false,
      'provider_interaction', false,
      'provider_contract_evidence', NULL,
      'signature_claim', false,
      'erds_claim', false
    );
    IF v_manifest_ead_requested THEN
      IF NEW.metadata #> '{ead_service}'
           IS DISTINCT FROM v_canonical_ead_service THEN
        RAISE EXCEPTION 'CONVOCATION_EAD_SERVICE_CANONICAL_METADATA_REQUIRED'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.metadata ? 'ead_service'
       AND NEW.metadata -> 'ead_service' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'CONVOCATION_NON_EAD_CANNOT_ASSERT_EAD_SERVICE'
        USING ERRCODE = '23514';
    END IF;

    IF (NEW.metadata ? 'sandbox_only'
          AND NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb)
       OR (NEW.metadata ? 'delivery_disabled'
          AND NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb)
       OR (NEW.metadata ? 'delivery_allowed'
          AND NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'dispatch_allowed'
          AND NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'dispatcher_triggered'
          AND NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'provider_interaction'
          AND NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb)
       OR (NEW.metadata ? 'ead_delivery_mode'
          AND NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb) THEN
      RAISE EXCEPTION 'CONVOCATION_DEMO_SANDBOX_METADATA_CONTRADICTION'
        USING ERRCODE = '23514';
    END IF;
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'sandbox_only', true,
      'delivery_disabled', true,
      'delivery_allowed', false,
      'dispatch_allowed', false,
      'dispatcher_triggered', false,
      'provider_interaction', false,
      'ead_delivery_mode', NULL
    );
    IF v_manifest_ead_requested THEN
      NEW.metadata := NEW.metadata || jsonb_build_object(
        'ead_service', v_canonical_ead_service
      );
    ELSE
      NEW.metadata := NEW.metadata - 'ead_service';
    END IF;
    NEW.nivel_certificacion_minimo := 'EMAIL_NORMAL';

    IF NEW.estado <> 'BORRADOR'
       OR NEW.fecha_programada IS NOT NULL
       OR NEW.fecha_envio_efectiva IS NOT NULL
       OR NEW.fecha_limite_respuesta IS NOT NULL
       OR NEW.tiene_rebotes IS TRUE
       OR upper(btrim(COALESCE(NEW.nivel_certificacion_minimo, '')))
            IS DISTINCT FROM 'EMAIL_NORMAL'
       OR NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb
       OR NEW.metadata -> 'delivery_disabled' IS DISTINCT FROM 'true'::jsonb
       OR NEW.metadata -> 'delivery_allowed' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb
       OR NEW.metadata -> 'ead_delivery_mode' IS DISTINCT FROM 'null'::jsonb
       OR public.fn_secretaria_jsonb_has_forbidden_signature_claim(NEW.metadata) IS TRUE
       OR (
         NEW.metadata #>> '{ead_service,mode}' = 'EAD_INTERPOSITION'
         AND (
           NEW.metadata #> '{ead_service,delivery_allowed}' IS DISTINCT FROM 'false'::jsonb
           OR NEW.metadata #> '{ead_service,provider_interaction}' IS DISTINCT FROM 'false'::jsonb
           OR NEW.metadata #> '{ead_service,signature_claim}' IS DISTINCT FROM 'false'::jsonb
           OR NEW.metadata #> '{ead_service,erds_claim}' IS DISTINCT FROM 'false'::jsonb
         )
       ) THEN
      RAISE EXCEPTION
        'DEMO convocation communication is immutable as BORRADOR/no-dispatch except governed lifecycle cancellation'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()
  TO service_role;

COMMENT ON FUNCTION public.fn_secretaria_guard_ead_sandbox_communication() IS
  'Canoniza comunicaciones DEMO sin externalidad. Solo la RPC autoritativa de ciclo de vida puede cambiar BORRADOR/PROGRAMADA a CANCELADA, preservando íntegramente el agregado histórico.';

NOTIFY pgrst, 'reload schema';

COMMIT;
