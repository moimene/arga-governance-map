-- ============================================================
-- Note: migration 20260518000007 (no_session_notificaciones VIEW + backfill)
-- was DEFERRED to P2 sem 1 per adversarial M1 review.
-- Legacy table `no_session_notificaciones` remains untouched in P1.
-- Hook `useERDSNotification` continues to operate against legacy table.
-- ============================================================

-- TRIGGER 1: tg_communications_validate_plazo
-- BEFORE INSERT/UPDATE on communications. Calls Edge Function validate-comm-plazo via pg_net.
-- Permissive if app.functions_url not configured (development mode).
CREATE OR REPLACE FUNCTION tg_communications_validate_plazo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_functions_url text;
  v_service_key text;
  v_meeting_date timestamptz;
  v_response jsonb;
  v_request_id bigint;
BEGIN
  v_functions_url := current_setting('app.functions_url', true);
  v_service_key   := current_setting('app.service_role_key', true);
  IF v_functions_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.estado NOT IN ('PROGRAMADA','ENVIANDO','ENVIADA') OR NEW.fecha_programada IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT meeting_date INTO v_meeting_date FROM meetings WHERE id = NEW.meeting_id;
  SELECT net.http_post(
    url := v_functions_url || '/validate-comm-plazo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'tipo_comunicacion', NEW.tipo_comunicacion,
      'organo_tipo', NEW.organo_tipo,
      'entity_id', NEW.entity_id,
      'meeting_date', v_meeting_date,
      'template_id', NEW.template_id,
      'fecha_programada', NEW.fecha_programada
    ),
    timeout_milliseconds := 5000
  ) INTO v_request_id;
  FOR i IN 1..50 LOOP
    SELECT (response).body::jsonb INTO v_response
    FROM net._http_response WHERE id = v_request_id LIMIT 1;
    EXIT WHEN v_response IS NOT NULL;
    PERFORM pg_sleep(0.1);
  END LOOP;
  IF v_response IS NOT NULL AND NOT COALESCE((v_response->>'isValid')::boolean, true) THEN
    RAISE EXCEPTION 'Plazo legal incumplido: %', COALESCE(v_response->>'reason', 'unknown');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_communications_validate_plazo_t
  BEFORE INSERT OR UPDATE ON communications
  FOR EACH ROW EXECUTE FUNCTION tg_communications_validate_plazo();

-- TRIGGER 2: tg_recipient_check_nivel + canal_original capture
CREATE OR REPLACE FUNCTION tg_recipient_check_nivel()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_nivel_minimo text;
  v_canal_rank int;
  v_minimo_rank int;
BEGIN
  SELECT nivel_certificacion_minimo INTO v_nivel_minimo
    FROM communications WHERE id = NEW.communication_id;
  v_canal_rank := CASE NEW.canal_primario
    WHEN 'EMAIL_NORMAL'      THEN 1
    WHEN 'EMAIL_CERTIFICADO' THEN 2
    WHEN 'BUROFAX_ERDS'      THEN 3
    WHEN 'PORTAL_PUSH'       THEN 0
    ELSE 0
  END;
  v_minimo_rank := CASE v_nivel_minimo
    WHEN 'EMAIL_NORMAL'      THEN 1
    WHEN 'EMAIL_CERTIFICADO' THEN 2
    WHEN 'BUROFAX_ERDS'      THEN 3
    ELSE 1
  END;
  IF v_canal_rank < v_minimo_rank AND NEW.canal_primario <> 'PORTAL_PUSH' THEN
    RAISE EXCEPTION 'canal_primario % no cumple nivel_certificacion_minimo % de la comunicación', NEW.canal_primario, v_nivel_minimo;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.canal_original IS NULL THEN
    NEW.canal_original := NEW.canal_primario;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_recipient_check_nivel_t
  BEFORE INSERT OR UPDATE ON communication_recipients
  FOR EACH ROW EXECUTE FUNCTION tg_recipient_check_nivel();

-- TRIGGER 3: tg_communications_recompute_estado
CREATE OR REPLACE FUNCTION tg_communications_recompute_estado()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_total int; v_enviando int; v_enviado int; v_entregado int;
  v_leido int; v_respondido int; v_rebotado int; v_error int;
  v_new_estado text; v_tipo_resp text; v_fecha_limite timestamptz;
  v_tiene_rebotes boolean;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE estado_entrega='ENVIANDO'),
         count(*) FILTER (WHERE estado_entrega='ENVIADO'),
         count(*) FILTER (WHERE estado_entrega='ENTREGADO'),
         count(*) FILTER (WHERE estado_entrega='LEIDO'),
         count(*) FILTER (WHERE estado_entrega='RESPONDIDO'),
         count(*) FILTER (WHERE estado_entrega='REBOTADO'),
         count(*) FILTER (WHERE estado_entrega='ERROR')
  INTO v_total, v_enviando, v_enviado, v_entregado, v_leido, v_respondido, v_rebotado, v_error
  FROM communication_recipients WHERE communication_id = NEW.communication_id;
  v_tiene_rebotes := v_rebotado > 0;
  IF v_total = 0 THEN
    RETURN NEW;
  END IF;
  IF v_enviando > 0 THEN
    v_new_estado := 'ENVIANDO';
  ELSIF (v_rebotado + v_error) = v_total THEN
    v_new_estado := 'ERROR';
  ELSIF (v_entregado + v_leido + v_respondido + v_rebotado + v_error) = v_total THEN
    SELECT tipo_respuesta_esperada, fecha_limite_respuesta
      INTO v_tipo_resp, v_fecha_limite
      FROM communications WHERE id = NEW.communication_id;
    IF v_tipo_resp = 'INFORMATIVA' OR v_tipo_resp IS NULL THEN
      IF (v_entregado + v_leido + v_respondido) > 0 THEN
        v_new_estado := CASE WHEN (v_rebotado + v_error) > 0 THEN 'ENTREGADA_PARCIAL' ELSE 'ENTREGADA_TOTAL' END;
      ELSE
        v_new_estado := 'ERROR';
      END IF;
    ELSE
      IF v_respondido = v_total THEN
        v_new_estado := 'RESPONDIDA_TOTAL';
      ELSIF v_respondido > 0 THEN
        v_new_estado := 'RESPONDIDA_PARCIAL';
      ELSIF v_fecha_limite IS NOT NULL AND v_fecha_limite < now() THEN
        v_new_estado := 'EXPIRADA';
      ELSE
        v_new_estado := CASE WHEN (v_rebotado + v_error) > 0 THEN 'ENTREGADA_PARCIAL' ELSE 'ENTREGADA_TOTAL' END;
      END IF;
    END IF;
  ELSE
    v_new_estado := 'ENVIADA';
  END IF;
  UPDATE communications
     SET estado = v_new_estado,
         tiene_rebotes = v_tiene_rebotes,
         updated_at = now()
   WHERE id = NEW.communication_id;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_communications_recompute_estado_t
  AFTER UPDATE OF estado_entrega ON communication_recipients
  FOR EACH ROW EXECUTE FUNCTION tg_communications_recompute_estado();

-- TRIGGER 4: tg_sync_scope_app_meta
CREATE OR REPLACE FUNCTION tg_sync_scope_app_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_has_staff boolean;
  v_has_member boolean;
  v_scope text;
BEGIN
  IF v_user_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT EXISTS(SELECT 1 FROM rbac_user_roles WHERE user_id = v_user_id) INTO v_has_staff;
  SELECT EXISTS(SELECT 1 FROM portal_memberships WHERE user_id = v_user_id AND estado = 'ACTIVO') INTO v_has_member;
  v_scope := CASE
    WHEN v_has_staff AND v_has_member THEN 'both'
    WHEN v_has_staff THEN 'staff'
    WHEN v_has_member THEN 'member'
    ELSE 'none'
  END;
  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('scope', v_scope)
   WHERE id = v_user_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER tg_sync_scope_portal_t
  AFTER INSERT OR UPDATE OR DELETE ON portal_memberships
  FOR EACH ROW EXECUTE FUNCTION tg_sync_scope_app_meta();

CREATE TRIGGER tg_sync_scope_rbac_t
  AFTER INSERT OR UPDATE OR DELETE ON rbac_user_roles
  FOR EACH ROW EXECUTE FUNCTION tg_sync_scope_app_meta();

-- TRIGGER 5: tg_delivery_events_hash_chain
CREATE OR REPLACE FUNCTION tg_delivery_events_hash_chain()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev text;
BEGIN
  SELECT hash_self INTO v_prev
    FROM communication_delivery_events
   WHERE recipient_id = NEW.recipient_id
   ORDER BY ocurrido_en DESC
   LIMIT 1
   FOR UPDATE;
  NEW.hash_prev := COALESCE(v_prev, 'GENESIS');
  NEW.hash_self := encode(digest(
    COALESCE(NEW.hash_prev,'') || NEW.evento || NEW.ocurrido_en::text || COALESCE(NEW.payload::text,'{}'),
    'sha512'
  ), 'hex');
  RETURN NEW;
END $$;

CREATE TRIGGER tg_delivery_events_hash_chain_t
  BEFORE INSERT ON communication_delivery_events
  FOR EACH ROW EXECUTE FUNCTION tg_delivery_events_hash_chain();

-- TRIGGER 6: tg_validate_comunicacion_config
CREATE OR REPLACE FUNCTION tg_validate_comunicacion_config()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.comunicacion_config IS NOT NULL THEN
    IF NOT (NEW.comunicacion_config ? 'destinatarios_tipo'
            AND NEW.comunicacion_config ? 'tipo_comunicacion_default'
            AND NEW.comunicacion_config ? 'tipo_respuesta_esperada'
            AND NEW.comunicacion_config ? 'nivel_certificacion_minimo') THEN
      RAISE EXCEPTION 'comunicacion_config missing required keys';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_validate_comunicacion_config_t
  BEFORE INSERT OR UPDATE OF comunicacion_config ON plantillas_protegidas
  FOR EACH ROW EXECUTE FUNCTION tg_validate_comunicacion_config();
