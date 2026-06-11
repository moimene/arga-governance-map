-- ITEM-003 [P0] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Toda acta creada por el flujo operativo (ReunionStepper → fn_generar_acta)
-- nacía con signed_at NULL y NO existía ningún escritor de minutes.signed_at
-- en el producto (cero UPDATE sobre minutes en src/ ni edge functions). El
-- gate de certificación de ActaDetalle (actaApprovalGateReason, RRM arts.
-- 108-109) exige signed_at, así que ninguna acta generada en la app podía
-- emitir certificación: el mensaje pedía "aprobar o firmar el acta", un paso
-- que no existía en la UI. Solo las actas seed con signed_at podían certificar.
--
-- Esta migración crea la acción que faltaba: fn_aprobar_acta aprueba y firma
-- el acta (signed_at) y la bloquea (is_locked=true) en una sola operación
-- atómica. El trigger trg_minutes_lock_guard garantiza la inmutabilidad
-- posterior de content/firmantes/signed_at (chequea OLD.is_locked, por lo que
-- firmar y bloquear en el mismo UPDATE es válido).
--
-- Patrón de seguridad: SECURITY DEFINER con aserción de tenant del caller
-- (fn_current_tenant_id), igual que 20260606165443. Contextos privilegiados
-- sin tenant en el JWT (service_role / jobs) conservan paso libre.
-- Forward-only, idempotente (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.fn_aprobar_acta(
  p_minute_id uuid,
  p_president_persona_id uuid DEFAULT NULL,
  p_secretary_persona_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_minute public.minutes%ROWTYPE;
  v_caller_tenant uuid;
  v_signed_at timestamptz;
BEGIN
  SELECT * INTO v_minute FROM public.minutes WHERE id = p_minute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'acta % no encontrada', p_minute_id;
  END IF;

  v_caller_tenant := public.fn_current_tenant_id();
  IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> v_minute.tenant_id THEN
    RAISE EXCEPTION 'acta tenant mismatch: el caller del tenant % no puede aprobar actas del tenant %',
      v_caller_tenant, v_minute.tenant_id
      USING ERRCODE = '42501';
  END IF;

  -- Idempotente: un acta ya aprobada/firmada no se re-firma ni cambia de fecha.
  IF v_minute.signed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'minute_id', v_minute.id,
      'signed_at', v_minute.signed_at,
      'already_signed', true
    );
  END IF;

  IF COALESCE(v_minute.content, '') = '' THEN
    RAISE EXCEPTION 'el acta % no tiene contenido: genera el documento del acta antes de aprobarla (art. 202 LSC)', p_minute_id;
  END IF;

  v_signed_at := now();

  UPDATE public.minutes
  SET signed_at = v_signed_at,
      is_locked = true,
      signed_by_president_id = COALESCE(p_president_persona_id, signed_by_president_id),
      signed_by_secretary_id = COALESCE(p_secretary_persona_id, signed_by_secretary_id)
  WHERE id = p_minute_id;

  RETURN jsonb_build_object(
    'minute_id', p_minute_id,
    'signed_at', v_signed_at,
    'already_signed', false
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_aprobar_acta(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_aprobar_acta(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_aprobar_acta(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_aprobar_acta(uuid, uuid, uuid) TO service_role;
