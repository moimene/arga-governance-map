-- Secretaría — agregado autoritativo convocatoria/comunicación/binario.
--
-- Principios:
--   * solo BORRADOR es ensamblable;
--   * al programar se congelan cuerpo, coordenadas, adjuntos y destinatarios;
--   * el DOCX final se registra exclusivamente mediante RPC y queda inmutable;
--   * el dispatcher reclama por tenant, recupera leases y revalida justo antes
--     de invocar a un proveedor;
--   * las comunicaciones legacy ambiguas se cancelan, nunca se "reparan" con
--     una apariencia de evidencia que no tenían al crearse.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Esquema y constraints de identidad binaria
-- ---------------------------------------------------------------------------

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS artifact_kind text NOT NULL DEFAULT 'SUPPORTING_DOCUMENT',
  ADD COLUMN IF NOT EXISTS file_hash_sha512 text,
  ADD COLUMN IF NOT EXISTS artifact_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_registered_by uuid;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'attachments_artifact_registered_by_fkey'
       AND conrelid = 'public.attachments'::regclass
  ) THEN
    ALTER TABLE public.attachments
      ADD CONSTRAINT attachments_artifact_registered_by_fkey
      FOREIGN KEY (artifact_registered_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$block$;

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_artifact_kind_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_artifact_kind_check
  CHECK (artifact_kind IN ('SUPPORTING_DOCUMENT', 'CONVOCATORIA_FINAL'));

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_file_hash_sha512_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_file_hash_sha512_check
  CHECK (file_hash_sha512 IS NULL OR file_hash_sha512 ~ '^[0-9a-f]{128}$');

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_convocatoria_final_hashes_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_convocatoria_final_hashes_check
  CHECK (
    (
      artifact_kind = 'SUPPORTING_DOCUMENT'
      AND convocatoria_id IS NOT NULL
      AND file_hash ~ '^[0-9a-f]{64}$'
      AND file_hash_sha512 ~ '^[0-9a-f]{128}$'
      AND file_url LIKE
        'evidence-bundle://convocatorias/' || convocatoria_id::text || '/%'
      AND artifact_registered_at IS NULL
      AND artifact_registered_by IS NULL
    )
    OR (
      artifact_kind = 'CONVOCATORIA_FINAL'
      AND convocatoria_id IS NOT NULL
      AND agenda_item_index IS NULL
      AND file_name ~* '\.docx$'
      AND file_hash ~ '^[0-9a-f]{64}$'
      AND file_hash_sha512 ~ '^[0-9a-f]{128}$'
      AND file_url LIKE 'evidence-bundle://convocatorias/%'
      AND artifact_registered_at IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS convocatoria_id uuid;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'communications_convocatoria_id_fkey'
       AND conrelid = 'public.communications'::regclass
  ) THEN
    ALTER TABLE public.communications
      ADD CONSTRAINT communications_convocatoria_id_fkey
      FOREIGN KEY (convocatoria_id) REFERENCES public.convocatorias(id) ON DELETE RESTRICT;
  END IF;
END;
$block$;

-- service_role no representa a una persona de auth.users. NULL significa actor
-- de sistema y queda además anotado en metadata por la RPC.
ALTER TABLE public.communications
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.communication_attachments
  ADD COLUMN IF NOT EXISTS source_attachment_id uuid,
  ADD COLUMN IF NOT EXISTS hash_sha256 text;

-- Declarada aquí para que el validador base pueda aceptar una alternativa
-- formal expresa. La migración de hardening posterior añade su constraint.
ALTER TABLE public.communication_recipients
  ADD COLUMN IF NOT EXISTS delivery_alternative jsonb;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'communication_attachments_source_attachment_id_fkey'
       AND conrelid = 'public.communication_attachments'::regclass
  ) THEN
    ALTER TABLE public.communication_attachments
      ADD CONSTRAINT communication_attachments_source_attachment_id_fkey
      FOREIGN KEY (source_attachment_id) REFERENCES public.attachments(id) ON DELETE RESTRICT;
  END IF;
END;
$block$;

ALTER TABLE public.communication_attachments
  DROP CONSTRAINT IF EXISTS communication_attachments_hash_sha256_check;
ALTER TABLE public.communication_attachments
  ADD CONSTRAINT communication_attachments_hash_sha256_check
  CHECK (hash_sha256 IS NULL OR hash_sha256 ~ '^[0-9a-f]{64}$');

COMMENT ON COLUMN public.communications.convocatoria_id IS
  'FK autoritativa de la convocatoria; no sustituible por metadata o cronología.';
COMMENT ON COLUMN public.communication_attachments.source_attachment_id IS
  'Fila inmutable de attachments cuyo binario privado se revalida antes del dispatch.';
COMMENT ON COLUMN public.attachments.artifact_kind IS
  'CONVOCATORIA_FINAL solo puede registrarse mediante fn_register_convocatoria_final_attachment.';

CREATE INDEX IF NOT EXISTS ix_attachments_convocatoria_artifact_kind
  ON public.attachments(tenant_id, convocatoria_id, artifact_kind, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS ix_communications_convocatoria
  ON public.communications(tenant_id, convocatoria_id, created_at DESC)
  WHERE convocatoria_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_communication_attachments_source_attachment
  ON public.communication_attachments(source_attachment_id)
  WHERE source_attachment_id IS NOT NULL;

-- Permite reejecutar el fichero durante una reconstrucción local sin que los
-- guards de la versión anterior impidan la cuarentena determinista.
DROP TRIGGER IF EXISTS trg_communication_dispatch_authoritative_gate ON public.communications;
DROP TRIGGER IF EXISTS trg_communication_attachment_immutable_after_draft ON public.communication_attachments;
DROP TRIGGER IF EXISTS trg_communication_recipient_immutable_after_draft ON public.communication_recipients;
DROP TRIGGER IF EXISTS trg_convocatoria_final_artifact_guard ON public.attachments;

-- ---------------------------------------------------------------------------
-- 2. Backfill únicamente de coordenadas demostrables
-- ---------------------------------------------------------------------------

WITH candidate AS (
  SELECT
    communication.id,
    CASE
      WHEN COALESCE(communication.metadata ->> 'convocatoria_id', '')
           ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (communication.metadata ->> 'convocatoria_id')::uuid
      ELSE NULL
    END AS convocatoria_id
  FROM public.communications communication
  WHERE communication.convocatoria_id IS NULL
    AND communication.tipo_comunicacion = 'CONVOCATORIA'
)
UPDATE public.communications communication
   SET convocatoria_id = candidate.convocatoria_id
  FROM candidate
  JOIN public.convocatorias convocatoria
    ON convocatoria.id = candidate.convocatoria_id
 WHERE communication.id = candidate.id
   AND convocatoria.tenant_id = communication.tenant_id
   AND convocatoria.body_id = communication.body_id;

WITH meeting_source AS (
  SELECT
    item.tenant_id,
    item.meeting_id,
    max(item.source_convocatoria_id::text)::uuid AS convocatoria_id
  FROM public.agenda_items item
  WHERE item.source_convocatoria_id IS NOT NULL
  GROUP BY item.tenant_id, item.meeting_id
  HAVING count(DISTINCT item.source_convocatoria_id) = 1
)
UPDATE public.communications communication
   SET convocatoria_id = source.convocatoria_id
  FROM meeting_source source
 WHERE communication.convocatoria_id IS NULL
   AND communication.tipo_comunicacion = 'CONVOCATORIA'
   AND communication.tenant_id = source.tenant_id
   AND communication.meeting_id = source.meeting_id;

WITH convocatoria_meeting AS (
  SELECT
    item.tenant_id,
    item.source_convocatoria_id AS convocatoria_id,
    max(item.meeting_id::text)::uuid AS meeting_id
  FROM public.agenda_items item
  WHERE item.source_convocatoria_id IS NOT NULL
  GROUP BY item.tenant_id, item.source_convocatoria_id
  HAVING count(DISTINCT item.meeting_id) = 1
)
UPDATE public.communications communication
   SET meeting_id = link.meeting_id
  FROM convocatoria_meeting link
 WHERE communication.convocatoria_id = link.convocatoria_id
   AND communication.tenant_id = link.tenant_id
   AND communication.meeting_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Registro autoritativo e inmutable del DOCX final
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_convocatoria_final_artifact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.artifact_kind = 'CONVOCATORIA_FINAL' THEN
    RAISE EXCEPTION 'CONVOCATORIA_FINAL is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.artifact_kind = 'SUPPORTING_DOCUMENT' AND EXISTS (
      SELECT 1
        FROM public.communication_attachments communication_attachment
        JOIN public.communications communication
          ON communication.id = communication_attachment.communication_id
       WHERE communication_attachment.source_attachment_id = OLD.id
         AND communication.estado <> 'BORRADOR'
    ) THEN
      RAISE EXCEPTION 'dispatched supporting attachment is immutable'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.artifact_kind = 'SUPPORTING_DOCUMENT'
     AND EXISTS (
       SELECT 1
         FROM public.communication_attachments communication_attachment
         JOIN public.communications communication
           ON communication.id = communication_attachment.communication_id
        WHERE communication_attachment.source_attachment_id = OLD.id
          AND communication.estado <> 'BORRADOR'
     )
     AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
       OR NEW.agenda_item_index IS DISTINCT FROM OLD.agenda_item_index
       OR NEW.file_name IS DISTINCT FROM OLD.file_name
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_hash IS DISTINCT FROM OLD.file_hash
       OR NEW.file_hash_sha512 IS DISTINCT FROM OLD.file_hash_sha512
       OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
     ) THEN
    RAISE EXCEPTION 'dispatched supporting attachment identity and hashes are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.artifact_kind = 'SUPPORTING_DOCUMENT'
     AND EXISTS (
       SELECT 1
         FROM public.communications communication
        WHERE communication.tenant_id = NEW.tenant_id
          AND communication.convocatoria_id = NEW.convocatoria_id
          AND communication.tipo_comunicacion = 'CONVOCATORIA'
          AND communication.estado NOT IN ('BORRADOR', 'CANCELADA')
     ) THEN
    RAISE EXCEPTION 'supporting package is frozen after communication programming'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.artifact_kind = 'CONVOCATORIA_FINAL' THEN
    IF current_setting('app.secretaria_final_artifact_rpc', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'CONVOCATORIA_FINAL must be registered by the authoritative RPC'
        USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_convocatoria
      FROM public.convocatorias
     WHERE id = NEW.convocatoria_id
       AND tenant_id = NEW.tenant_id;
    IF NOT FOUND
       OR v_convocatoria.estado <> 'EMITIDA'
       OR v_convocatoria.immutable_at IS NULL THEN
      RAISE EXCEPTION 'final convocatoria artifact requires an emitted immutable convocatoria'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.file_url NOT LIKE
       'evidence-bundle://convocatorias/' || NEW.convocatoria_id::text || '/%' THEN
      RAISE EXCEPTION 'final convocatoria artifact storage URI is outside its convocatoria prefix'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_convocatoria_final_artifact_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_convocatoria_final_artifact_guard();

CREATE OR REPLACE FUNCTION public.fn_register_convocatoria_final_attachment(
  p_tenant_id uuid,
  p_convocatoria_id uuid,
  p_file_name text,
  p_file_url text,
  p_hash_sha256 text,
  p_hash_sha512 text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_service_role boolean := public.fn_secretaria_is_service_role() IS TRUE;
  v_role_ok boolean;
  v_existing public.attachments%ROWTYPE;
  v_attachment_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_convocatoria_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id and convocatoria_id are required';
  END IF;
  IF lower(COALESCE(p_hash_sha256, '')) !~ '^[0-9a-f]{64}$'
     OR lower(COALESCE(p_hash_sha512, '')) !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'final convocatoria binary requires SHA-256 and SHA-512';
  END IF;
  IF COALESCE(p_file_name, '') !~* '\.docx$'
     OR p_file_url NOT LIKE
        'evidence-bundle://convocatorias/' || p_convocatoria_id::text || '/%' THEN
    RAISE EXCEPTION 'final convocatoria artifact requires a private DOCX URI';
  END IF;

  IF NOT v_service_role THEN
    IF v_user_id IS NULL OR public.fn_assert_current_tenant_id() <> p_tenant_id THEN
      RAISE EXCEPTION 'final convocatoria artifact tenant mismatch'
        USING ERRCODE = '42501';
    END IF;
    SELECT EXISTS (
      SELECT 1
        FROM public.rbac_user_roles user_role
        JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE user_role.user_id = v_user_id
         AND user_role.tenant_id = p_tenant_id
         AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
         AND COALESCE(user_role.is_active, true) = true
    ) INTO v_role_ok;
    IF v_role_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'SECRETARIO or ADMIN_TENANT required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'CONVOCATORIA_FINAL:' || p_tenant_id::text || ':' || p_convocatoria_id::text,
      0
    )
  );

  PERFORM 1
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
     AND convocatoria.tenant_id = p_tenant_id
     AND convocatoria.estado = 'EMITIDA'
     AND convocatoria.immutable_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convocatoria is not emitted and immutable';
  END IF;

  SELECT * INTO v_existing
    FROM public.attachments attachment
   WHERE attachment.tenant_id = p_tenant_id
     AND attachment.convocatoria_id = p_convocatoria_id
     AND attachment.artifact_kind = 'CONVOCATORIA_FINAL'
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.file_hash = lower(p_hash_sha256)
       AND v_existing.file_hash_sha512 = lower(p_hash_sha512)
       AND v_existing.file_url = p_file_url THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'convocatoria already has a different immutable final artifact'
      USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('app.secretaria_final_artifact_rpc', 'on', true);
  INSERT INTO public.attachments (
    tenant_id, convocatoria_id, agenda_item_index,
    file_name, file_url, file_hash, file_hash_sha512,
    artifact_kind, artifact_registered_at, artifact_registered_by
  ) VALUES (
    p_tenant_id, p_convocatoria_id, NULL,
    p_file_name, p_file_url, lower(p_hash_sha256), lower(p_hash_sha512),
    'CONVOCATORIA_FINAL', now(), v_user_id
  ) RETURNING id INTO v_attachment_id;
  PERFORM set_config('app.secretaria_final_artifact_rpc', 'off', true);

  RETURN v_attachment_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Validador completo del agregado
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_communication_authoritative_binding_valid(
  p_communication_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_body public.governing_bodies%ROWTYPE;
  v_linked_meeting_id uuid;
  v_linked_meeting_count integer := 0;
  v_generated_count integer := 0;
  v_valid_generated_count integer := 0;
  v_attachment_count integer := 0;
  v_valid_attachment_count integer := 0;
  v_support_attachment_count integer := 0;
  v_support_source_count integer := 0;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_communication.cuerpo_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR v_communication.cuerpo_hash_sha512 IS DISTINCT FROM encode(
       extensions.digest(convert_to(v_communication.cuerpo_render, 'UTF8'), 'sha512'),
       'hex'
     ) THEN
    RETURN false;
  END IF;

  IF v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN true;
  END IF;
  IF v_communication.convocatoria_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_convocatoria
    FROM public.convocatorias
   WHERE id = v_communication.convocatoria_id
     AND tenant_id = v_communication.tenant_id;
  IF NOT FOUND
     OR v_convocatoria.estado <> 'EMITIDA'
     OR v_convocatoria.immutable_at IS NULL
     OR v_convocatoria.body_id IS DISTINCT FROM v_communication.body_id THEN
    RETURN false;
  END IF;

  SELECT * INTO v_body
    FROM public.governing_bodies
   WHERE id = v_communication.body_id;
  IF NOT FOUND
     OR v_body.tenant_id IS DISTINCT FROM v_communication.tenant_id
     OR v_body.entity_id IS DISTINCT FROM v_communication.entity_id THEN
    RETURN false;
  END IF;

  SELECT count(DISTINCT item.meeting_id), max(item.meeting_id::text)::uuid
    INTO v_linked_meeting_count, v_linked_meeting_id
    FROM public.agenda_items item
   WHERE item.tenant_id = v_communication.tenant_id
     AND item.source_convocatoria_id = v_communication.convocatoria_id;

  IF v_linked_meeting_count > 1
     OR (v_linked_meeting_count = 0 AND v_communication.meeting_id IS NOT NULL)
     OR (v_linked_meeting_count = 1
         AND v_communication.meeting_id IS DISTINCT FROM v_linked_meeting_id) THEN
    RETURN false;
  END IF;
  IF v_linked_meeting_count = 1 AND NOT EXISTS (
    SELECT 1
      FROM public.meetings meeting
     WHERE meeting.id = v_linked_meeting_id
       AND meeting.tenant_id = v_communication.tenant_id
       AND meeting.body_id = v_communication.body_id
       AND meeting.scheduled_start IS NOT DISTINCT FROM v_convocatoria.fecha_1
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communications other
     WHERE other.id <> v_communication.id
       AND other.tenant_id = v_communication.tenant_id
       AND other.convocatoria_id = v_communication.convocatoria_id
       AND other.tipo_comunicacion = 'CONVOCATORIA'
       AND other.estado <> 'CANCELADA'
  ) THEN
    RETURN false;
  END IF;

  SELECT
    count(*) FILTER (WHERE communication_attachment.tipo = 'DOCUMENTO_GENERADO'),
    count(*) FILTER (
      WHERE communication_attachment.tipo = 'DOCUMENTO_GENERADO'
        AND attachment.id IS NOT NULL
        AND attachment.tenant_id = v_communication.tenant_id
        AND attachment.convocatoria_id = v_communication.convocatoria_id
        AND attachment.agenda_item_index IS NULL
        AND attachment.artifact_kind = 'CONVOCATORIA_FINAL'
        AND attachment.artifact_registered_at IS NOT NULL
        AND attachment.file_hash ~ '^[0-9a-f]{64}$'
        AND attachment.file_hash_sha512 ~ '^[0-9a-f]{128}$'
        AND communication_attachment.hash_sha256 = attachment.file_hash
        AND communication_attachment.hash_sha512 = attachment.file_hash_sha512
        AND communication_attachment.storage_uri = attachment.file_url
        AND communication_attachment.storage_uri LIKE
          'evidence-bundle://convocatorias/' || v_communication.convocatoria_id::text || '/%'
        AND communication_attachment.mime_type =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ),
    count(*),
    count(*) FILTER (WHERE communication_attachment.tipo <> 'DOCUMENTO_GENERADO'),
    count(*) FILTER (
      WHERE attachment.id IS NOT NULL
        AND attachment.tenant_id = v_communication.tenant_id
        AND attachment.convocatoria_id = v_communication.convocatoria_id
        AND attachment.file_hash ~ '^[0-9a-f]{64}$'
        AND attachment.file_hash_sha512 ~ '^[0-9a-f]{128}$'
        AND communication_attachment.hash_sha256 = attachment.file_hash
        AND communication_attachment.hash_sha512 = attachment.file_hash_sha512
        AND communication_attachment.storage_uri = attachment.file_url
        AND communication_attachment.storage_uri LIKE
          'evidence-bundle://convocatorias/' || v_communication.convocatoria_id::text || '/%'
        AND (
          (
            communication_attachment.tipo = 'DOCUMENTO_GENERADO'
            AND attachment.artifact_kind = 'CONVOCATORIA_FINAL'
            AND attachment.agenda_item_index IS NULL
            AND attachment.artifact_registered_at IS NOT NULL
          )
          OR (
            communication_attachment.tipo <> 'DOCUMENTO_GENERADO'
            AND attachment.artifact_kind = 'SUPPORTING_DOCUMENT'
          )
        )
    )
    INTO v_generated_count, v_valid_generated_count,
         v_attachment_count, v_support_attachment_count, v_valid_attachment_count
    FROM public.communication_attachments communication_attachment
    LEFT JOIN public.attachments attachment
      ON attachment.id = communication_attachment.source_attachment_id
   WHERE communication_attachment.communication_id = v_communication.id;

  IF v_attachment_count < 1
     OR v_valid_attachment_count <> v_attachment_count
     OR v_generated_count <> 1
     OR v_valid_generated_count <> 1 THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_support_source_count
    FROM public.attachments attachment
   WHERE attachment.tenant_id = v_communication.tenant_id
     AND attachment.convocatoria_id = v_communication.convocatoria_id
     AND attachment.artifact_kind = 'SUPPORTING_DOCUMENT';

  IF v_support_attachment_count <> v_support_source_count OR EXISTS (
    SELECT 1
      FROM public.attachments attachment
     WHERE attachment.tenant_id = v_communication.tenant_id
       AND attachment.convocatoria_id = v_communication.convocatoria_id
       AND attachment.artifact_kind = 'SUPPORTING_DOCUMENT'
       AND NOT EXISTS (
         SELECT 1
           FROM public.communication_attachments communication_attachment
          WHERE communication_attachment.communication_id = v_communication.id
            AND communication_attachment.source_attachment_id = attachment.id
            AND communication_attachment.tipo <> 'DOCUMENTO_GENERADO'
       )
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.communication_recipients recipient
     WHERE recipient.communication_id = v_communication.id
  ) OR EXISTS (
    SELECT 1
      FROM public.communication_recipients recipient
      LEFT JOIN public.persons person
        ON person.id = recipient.person_id
       AND person.tenant_id = v_communication.tenant_id
     WHERE recipient.communication_id = v_communication.id
       AND (
         person.id IS NULL
         OR (
           recipient.delivery_alternative IS NULL
           AND lower(btrim(COALESCE(recipient.destino_primario, '')))
               IS DISTINCT FROM lower(btrim(COALESCE(person.email, '')))
         )
         OR (
           recipient.delivery_alternative IS NOT NULL
           AND (
             jsonb_typeof(recipient.delivery_alternative) <> 'object'
             OR recipient.delivery_alternative ->> 'method' NOT IN (
               'ERDS','BUROFAX_POSTAL','PORTAL_VERIFIED','HAND_DELIVERY'
             )
             OR length(btrim(COALESCE(recipient.delivery_alternative ->> 'destination', ''))) = 0
             OR recipient.destino_primario IS DISTINCT FROM
                recipient.delivery_alternative ->> 'destination'
             OR length(btrim(COALESCE(recipient.delivery_alternative ->> 'reason', ''))) = 0
             OR length(btrim(COALESCE(recipient.delivery_alternative ->> 'evidence_reference', ''))) = 0
           )
         )
       )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_communication_assert_authoritative_binding(
  p_communication_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.fn_communication_authoritative_binding_valid(p_communication_id) IS NOT TRUE THEN
    RAISE EXCEPTION
      'communication dispatch blocked: aggregate is not authoritative'
      USING ERRCODE = '23514';
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Cuarentena legacy antes de activar unicidad y guards
-- ---------------------------------------------------------------------------

UPDATE public.communications
   SET estado = 'CANCELADA',
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
         'quarantined_at', now(),
         'quarantine_reason', 'expired_demo_communication_with_non_authoritative_document',
         'dispatch_forbidden', true
       ),
       updated_at = now()
 WHERE id = '84dc2d8c-6791-4f33-8170-f1821d2913b9'
   AND tipo_comunicacion = 'CONVOCATORIA'
   AND estado <> 'CANCELADA';

UPDATE public.communications communication
   SET estado = 'CANCELADA',
       metadata = COALESCE(communication.metadata, '{}'::jsonb) || jsonb_build_object(
         'quarantined_at', now(),
         'quarantine_reason', 'legacy_convocatoria_failed_authoritative_gate',
         'dispatch_forbidden', true
       ),
       updated_at = now()
 WHERE communication.tipo_comunicacion = 'CONVOCATORIA'
   AND communication.estado <> 'CANCELADA'
   AND public.fn_communication_authoritative_binding_valid(communication.id) IS NOT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS ux_attachments_one_convocatoria_final
  ON public.attachments(tenant_id, convocatoria_id)
  WHERE artifact_kind = 'CONVOCATORIA_FINAL';

CREATE UNIQUE INDEX IF NOT EXISTS ux_communications_one_active_convocatoria
  ON public.communications(tenant_id, convocatoria_id)
  WHERE tipo_comunicacion = 'CONVOCATORIA'
    AND convocatoria_id IS NOT NULL
    AND estado <> 'CANCELADA';

-- ---------------------------------------------------------------------------
-- 6. Inmutabilidad del agregado después de BORRADOR
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_communication_dispatch_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'BORRADOR' THEN
      RAISE EXCEPTION 'communications must be inserted as BORRADOR'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.tipo_comunicacion = 'CONVOCATORIA' AND NEW.convocatoria_id IS NULL THEN
      RAISE EXCEPTION 'convocatoria_id required for CONVOCATORIA communication'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.estado <> 'BORRADOR' AND (
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
    OR NEW.body_id IS DISTINCT FROM OLD.body_id
    OR NEW.organo_tipo IS DISTINCT FROM OLD.organo_tipo
    OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
    OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
    OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
    OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.tipo_comunicacion IS DISTINCT FROM OLD.tipo_comunicacion
    OR NEW.tipo_respuesta_esperada IS DISTINCT FROM OLD.tipo_respuesta_esperada
    OR NEW.nivel_certificacion_minimo IS DISTINCT FROM OLD.nivel_certificacion_minimo
    OR NEW.asunto IS DISTINCT FROM OLD.asunto
    OR NEW.cuerpo_render IS DISTINCT FROM OLD.cuerpo_render
    OR NEW.cuerpo_hash_sha512 IS DISTINCT FROM OLD.cuerpo_hash_sha512
    OR NEW.fecha_programada IS DISTINCT FROM OLD.fecha_programada
    OR NEW.comunicacion_libre IS DISTINCT FROM OLD.comunicacion_libre
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  ) THEN
    RAISE EXCEPTION 'communication identity and content are immutable after draft'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.estado = 'BORRADOR'
     AND NEW.estado <> 'BORRADOR'
     AND (
       NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.body_id IS DISTINCT FROM OLD.body_id
       OR NEW.organo_tipo IS DISTINCT FROM OLD.organo_tipo
       OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
       OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id
       OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
       OR NEW.template_id IS DISTINCT FROM OLD.template_id
       OR NEW.tipo_comunicacion IS DISTINCT FROM OLD.tipo_comunicacion
       OR NEW.tipo_respuesta_esperada IS DISTINCT FROM OLD.tipo_respuesta_esperada
       OR NEW.nivel_certificacion_minimo IS DISTINCT FROM OLD.nivel_certificacion_minimo
       OR NEW.asunto IS DISTINCT FROM OLD.asunto
       OR NEW.cuerpo_render IS DISTINCT FROM OLD.cuerpo_render
       OR NEW.cuerpo_hash_sha512 IS DISTINCT FROM OLD.cuerpo_hash_sha512
       OR NEW.fecha_programada IS DISTINCT FROM OLD.fecha_programada
       OR NEW.comunicacion_libre IS DISTINCT FROM OLD.comunicacion_libre
       OR NEW.metadata IS DISTINCT FROM OLD.metadata
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
     ) THEN
    RAISE EXCEPTION 'save draft identity and content before promoting the communication'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado = 'PROGRAMADA'
     AND OLD.estado IS DISTINCT FROM 'PROGRAMADA' THEN
    IF NEW.cuerpo_hash_sha512 !~ '^[0-9a-f]{128}$'
       OR NEW.cuerpo_hash_sha512 IS DISTINCT FROM encode(
         extensions.digest(convert_to(NEW.cuerpo_render, 'UTF8'), 'sha512'),
         'hex'
       ) THEN
      RAISE EXCEPTION 'communication body SHA-512 mismatch'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.tipo_comunicacion = 'CONVOCATORIA' THEN
      PERFORM public.fn_communication_assert_authoritative_binding(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_communication_dispatch_authoritative_gate
  BEFORE INSERT OR UPDATE ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.fn_communication_dispatch_gate();

CREATE OR REPLACE FUNCTION public.fn_communication_attachment_immutable_after_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old_state text;
  v_new_state text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT estado INTO v_old_state
      FROM public.communications
     WHERE id = OLD.communication_id;
    IF v_old_state IS DISTINCT FROM 'BORRADOR' THEN
      RAISE EXCEPTION 'communication attachment is immutable after draft'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT estado INTO v_new_state
      FROM public.communications
     WHERE id = NEW.communication_id;
    IF v_new_state IS DISTINCT FROM 'BORRADOR' THEN
      RAISE EXCEPTION 'communication attachments can only be assembled in BORRADOR'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_communication_attachment_immutable_after_draft
  BEFORE INSERT OR UPDATE OR DELETE ON public.communication_attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_communication_attachment_immutable_after_draft();

CREATE OR REPLACE FUNCTION public.fn_communication_recipient_immutable_after_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_state text;
  v_new_state text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT estado INTO v_state FROM public.communications WHERE id = NEW.communication_id;
    IF v_state IS DISTINCT FROM 'BORRADOR' THEN
      RAISE EXCEPTION 'communication recipients can only be inserted in BORRADOR'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT estado INTO v_state FROM public.communications WHERE id = OLD.communication_id;
  IF TG_OP = 'DELETE' THEN
    IF v_state IS DISTINCT FROM 'BORRADOR' THEN
      RAISE EXCEPTION 'communication recipients cannot be deleted after draft'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.communication_id IS DISTINCT FROM OLD.communication_id THEN
    SELECT estado INTO v_new_state
      FROM public.communications
     WHERE id = NEW.communication_id;
    IF v_state IS DISTINCT FROM 'BORRADOR'
       OR v_new_state IS DISTINCT FROM 'BORRADOR' THEN
      RAISE EXCEPTION 'communication recipients can only move between BORRADOR aggregates'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_state IS DISTINCT FROM 'BORRADOR' AND (
    NEW.communication_id IS DISTINCT FROM OLD.communication_id
    OR NEW.person_id IS DISTINCT FROM OLD.person_id
    OR NEW.cargo_en_organo IS DISTINCT FROM OLD.cargo_en_organo
    OR NEW.canal_original IS DISTINCT FROM OLD.canal_original
    OR NEW.canal_primario IS DISTINCT FROM OLD.canal_primario
    OR NEW.canal_fallback IS DISTINCT FROM OLD.canal_fallback
    OR NEW.destino_primario IS DISTINCT FROM OLD.destino_primario
    OR NEW.destino_fallback IS DISTINCT FROM OLD.destino_fallback
    OR NEW.delivery_alternative IS DISTINCT FROM OLD.delivery_alternative
    OR NEW.delegacion_a_person_id IS DISTINCT FROM OLD.delegacion_a_person_id
  ) THEN
    RAISE EXCEPTION 'recipient identity, channel and destination are immutable after draft'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_communication_recipient_immutable_after_draft
  BEFORE INSERT OR UPDATE OR DELETE ON public.communication_recipients
  FOR EACH ROW EXECUTE FUNCTION public.fn_communication_recipient_immutable_after_draft();

-- ---------------------------------------------------------------------------
-- 7. Creación atómica, lock por convocatoria y promoción segura
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_create_communication_atomic(
  p_comm jsonb,
  p_attachments jsonb,
  p_recipients jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_comm_id uuid;
  v_user_id uuid := auth.uid();
  v_service_role boolean := public.fn_secretaria_is_service_role() IS TRUE;
  v_tenant_id uuid;
  v_role_ok boolean;
  v_convocatoria_id uuid := NULLIF(p_comm ->> 'convocatoria_id', '')::uuid;
  v_meeting_id uuid := NULLIF(p_comm ->> 'meeting_id', '')::uuid;
  v_linked_meeting_count integer := 0;
  v_requested_state text := upper(COALESCE(NULLIF(p_comm ->> 'estado', ''), 'BORRADOR'));
  v_metadata jsonb;
BEGIN
  IF v_user_id IS NULL AND NOT v_service_role THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF v_requested_state NOT IN ('BORRADOR', 'PROGRAMADA') THEN
    RAISE EXCEPTION 'new communication state must be BORRADOR or PROGRAMADA';
  END IF;

  v_tenant_id := COALESCE((p_comm ->> 'tenant_id')::uuid, public.fn_current_tenant_id());
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;

  IF NOT v_service_role THEN
    IF public.fn_assert_current_tenant_id() <> v_tenant_id THEN
      RAISE EXCEPTION 'communication tenant mismatch' USING ERRCODE = '42501';
    END IF;
    SELECT EXISTS (
      SELECT 1
        FROM public.rbac_user_roles user_role
        JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE user_role.user_id = v_user_id
         AND user_role.tenant_id = v_tenant_id
         AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
         AND COALESCE(user_role.is_active, true) = true
    ) INTO v_role_ok;
    IF v_role_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'Insufficient role: SECRETARIO or ADMIN_TENANT required';
    END IF;
  END IF;

  IF p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA' THEN
    IF v_convocatoria_id IS NULL THEN
      RAISE EXCEPTION 'convocatoria_id required for CONVOCATORIA communication';
    END IF;
    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'COMMUNICATION:CONVOCATORIA:' || v_tenant_id::text || ':' || v_convocatoria_id::text,
        0
      )
    );

    SELECT count(DISTINCT item.meeting_id), max(item.meeting_id::text)::uuid
      INTO v_linked_meeting_count, v_meeting_id
      FROM public.agenda_items item
     WHERE item.tenant_id = v_tenant_id
       AND item.source_convocatoria_id = v_convocatoria_id;
    IF v_linked_meeting_count > 1 THEN
      RAISE EXCEPTION 'convocatoria has more than one linked meeting';
    END IF;
    IF NULLIF(p_comm ->> 'meeting_id', '') IS NOT NULL
       AND v_meeting_id IS DISTINCT FROM (p_comm ->> 'meeting_id')::uuid THEN
      RAISE EXCEPTION 'meeting_id does not match the authoritative agenda binding';
    END IF;
    IF v_requested_state = 'PROGRAMADA' AND v_linked_meeting_count <> 1 THEN
      RAISE EXCEPTION 'meeting agenda must be materialized before programming the convocatoria';
    END IF;
  END IF;

  v_metadata := COALESCE(p_comm -> 'metadata', '{}'::jsonb) || jsonb_build_object(
    'created_via', CASE WHEN v_service_role THEN 'service_role' ELSE 'authenticated_user' END
  );

  INSERT INTO public.communications (
    tenant_id, entity_id, body_id, organo_tipo, agreement_id, meeting_id,
    convocatoria_id, template_id, tipo_comunicacion, tipo_respuesta_esperada,
    nivel_certificacion_minimo, asunto, cuerpo_render, cuerpo_hash_sha512,
    estado, fecha_programada, comunicacion_libre, metadata, created_by
  ) VALUES (
    v_tenant_id,
    (p_comm ->> 'entity_id')::uuid,
    NULLIF(p_comm ->> 'body_id', '')::uuid,
    p_comm ->> 'organo_tipo',
    NULLIF(p_comm ->> 'agreement_id', '')::uuid,
    v_meeting_id,
    v_convocatoria_id,
    NULLIF(p_comm ->> 'template_id', '')::uuid,
    p_comm ->> 'tipo_comunicacion',
    p_comm ->> 'tipo_respuesta_esperada',
    p_comm ->> 'nivel_certificacion_minimo',
    p_comm ->> 'asunto',
    p_comm ->> 'cuerpo_render',
    lower(p_comm ->> 'cuerpo_hash_sha512'),
    'BORRADOR',
    NULLIF(p_comm ->> 'fecha_programada', '')::timestamptz,
    COALESCE((p_comm ->> 'comunicacion_libre')::boolean, false),
    v_metadata,
    v_user_id
  ) RETURNING id INTO v_comm_id;

  IF p_attachments IS NOT NULL
     AND jsonb_typeof(p_attachments) = 'array'
     AND jsonb_array_length(p_attachments) > 0 THEN
    INSERT INTO public.communication_attachments (
      communication_id, tipo, label, evidence_bundle_id, source_attachment_id,
      storage_uri, hash_sha256, hash_sha512, size_bytes, mime_type, orden,
      modo_entrega, signed_url_expiry_hours
    )
    SELECT
      v_comm_id,
      attachment ->> 'tipo',
      attachment ->> 'label',
      NULLIF(attachment ->> 'evidence_bundle_id', '')::uuid,
      NULLIF(attachment ->> 'source_attachment_id', '')::uuid,
      attachment ->> 'storage_uri',
      lower(NULLIF(attachment ->> 'hash_sha256', '')),
      lower(attachment ->> 'hash_sha512'),
      NULLIF(attachment ->> 'size_bytes', '')::bigint,
      attachment ->> 'mime_type',
      COALESCE((attachment ->> 'orden')::integer, 0),
      COALESCE(attachment ->> 'modo_entrega', 'ADJUNTO'),
      COALESCE((attachment ->> 'signed_url_expiry_hours')::integer, 168)
    FROM jsonb_array_elements(p_attachments) attachment;
  END IF;

  IF p_recipients IS NULL
     OR jsonb_typeof(p_recipients) <> 'array'
     OR jsonb_array_length(p_recipients) = 0 THEN
    RAISE EXCEPTION 'At least one recipient is required';
  END IF;

  INSERT INTO public.communication_recipients (
    communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, canal_fallback,
    destino_primario, destino_fallback
  )
  SELECT
    v_comm_id,
    (recipient ->> 'person_id')::uuid,
    recipient ->> 'cargo_en_organo',
    recipient ->> 'canal_primario',
    recipient ->> 'canal_primario',
    NULLIF(recipient ->> 'canal_fallback', ''),
    recipient ->> 'destino_primario',
    NULLIF(recipient ->> 'destino_fallback', '')
  FROM jsonb_array_elements(p_recipients) recipient;

  IF p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA' THEN
    PERFORM public.fn_communication_assert_authoritative_binding(v_comm_id);
  ELSIF lower(p_comm ->> 'cuerpo_hash_sha512') IS DISTINCT FROM encode(
    extensions.digest(convert_to(p_comm ->> 'cuerpo_render', 'UTF8'), 'sha512'),
    'hex'
  ) THEN
    RAISE EXCEPTION 'communication body SHA-512 mismatch';
  END IF;

  IF v_requested_state = 'PROGRAMADA' THEN
    UPDATE public.communications
       SET estado = 'PROGRAMADA', updated_at = now()
     WHERE id = v_comm_id;
  END IF;

  RETURN v_comm_id;
END;
$function$;

-- La agenda puede completar meeting_id únicamente mientras la comunicación
-- siga siendo un borrador. Una comunicación programada nunca cambia coordenadas.
CREATE OR REPLACE FUNCTION public.fn_sync_convocation_communication_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.source_convocatoria_id IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.communications communication
     SET meeting_id = NEW.meeting_id, updated_at = now()
   WHERE communication.tenant_id = NEW.tenant_id
     AND communication.convocatoria_id = NEW.source_convocatoria_id
     AND communication.tipo_comunicacion = 'CONVOCATORIA'
     AND communication.estado = 'BORRADOR'
     AND communication.meeting_id IS NULL
     AND communication.body_id = (
       SELECT meeting.body_id FROM public.meetings meeting WHERE meeting.id = NEW.meeting_id
     );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_convocation_communication_meeting ON public.agenda_items;
CREATE TRIGGER trg_sync_convocation_communication_meeting
  AFTER INSERT OR UPDATE OF source_convocatoria_id, meeting_id ON public.agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_convocation_communication_meeting();

-- ---------------------------------------------------------------------------
-- 8. Dispatch tenant-scoped, leases y revalidación pre-proveedor
-- ---------------------------------------------------------------------------

-- El fallback cambia el canal efectivo (`canal_usado`), nunca la identidad
-- canal/destino capturada al crear el destinatario.
CREATE OR REPLACE FUNCTION public.fn_recipient_handle_error(
  p_recipient_id uuid,
  p_error_message text,
  p_retriable boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
BEGIN
  SELECT * INTO v_recipient
    FROM public.communication_recipients
   WHERE id = p_recipient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_retriable AND v_recipient.intento_reenvio_n < 3 THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'PENDIENTE',
           intento_reenvio_n = intento_reenvio_n + 1,
           ultimo_error = p_error_message,
           updated_at = now()
     WHERE id = p_recipient_id;
  ELSIF p_retriable
        AND v_recipient.canal_fallback IS NOT NULL
        AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback THEN
    UPDATE public.communication_recipients
       SET canal_usado = canal_fallback,
           estado_entrega = 'PENDIENTE',
           intento_reenvio_n = 0,
           ultimo_error = p_error_message,
           updated_at = now()
     WHERE id = p_recipient_id;
  ELSE
    UPDATE public.communication_recipients
       SET estado_entrega = 'ERROR',
           ultimo_error = p_error_message,
           updated_at = now()
     WHERE id = p_recipient_id;

    INSERT INTO public.communication_delivery_events (
      recipient_id, evento, proveedor, payload, hash_self
    ) VALUES (
      p_recipient_id, 'ERROR', 'INTERNAL',
      jsonb_build_object('error', p_error_message), ''
    );
  END IF;
END;
$function$;

DROP FUNCTION IF EXISTS public.fn_claim_recipients_for_dispatch(integer);
CREATE OR REPLACE FUNCTION public.fn_claim_recipients_for_dispatch(
  p_limit integer DEFAULT 50,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS SETOF public.communication_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_limit integer := greatest(1, least(COALESCE(p_limit, 50), 200));
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for dispatch claim' USING ERRCODE = '42501';
  END IF;

  -- Lease de cinco minutos. Una caída del Edge Function no deja ENVIANDO
  -- permanente; tras tres recuperaciones el destinatario queda en ERROR.
  UPDATE public.communication_recipients recipient
     SET estado_entrega = CASE
           WHEN recipient.intento_reenvio_n >= 3 THEN 'ERROR'
           ELSE 'PENDIENTE'
         END,
         intento_reenvio_n = recipient.intento_reenvio_n + 1,
         ultimo_error = 'dispatch lease expired before provider reconciliation',
         updated_at = now()
    FROM public.communications communication
   WHERE communication.id = recipient.communication_id
     AND recipient.estado_entrega = 'ENVIANDO'
     AND recipient.updated_at < now() - interval '5 minutes'
     AND (p_tenant_id IS NULL OR communication.tenant_id = p_tenant_id);

  RETURN QUERY
  UPDATE public.communication_recipients recipient
     SET estado_entrega = 'ENVIANDO', updated_at = now()
   WHERE recipient.id IN (
     SELECT candidate.id
       FROM public.communication_recipients candidate
       JOIN public.communications communication
         ON communication.id = candidate.communication_id
      WHERE candidate.estado_entrega = 'PENDIENTE'
        AND communication.estado IN ('PROGRAMADA', 'ENVIANDO', 'ENVIADA')
        AND communication.fecha_programada <= now()
        AND (p_tenant_id IS NULL OR communication.tenant_id = p_tenant_id)
        AND public.fn_communication_authoritative_binding_valid(communication.id) IS TRUE
      ORDER BY communication.fecha_programada ASC
      LIMIT v_limit
      FOR UPDATE OF candidate SKIP LOCKED
   )
  RETURNING recipient.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_revalidate_recipient_dispatch(
  p_recipient_id uuid,
  p_expected_tenant_id uuid,
  p_body_hash_sha512 text,
  p_verified_attachments jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_communication public.communications%ROWTYPE;
  v_attachment_count integer;
  v_verified_count integer;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for dispatch revalidation'
      USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(p_verified_attachments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'verified attachments must be an array';
  END IF;

  SELECT * INTO v_recipient
    FROM public.communication_recipients
   WHERE id = p_recipient_id
   FOR UPDATE;
  IF NOT FOUND OR v_recipient.estado_entrega <> 'ENVIANDO' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = v_recipient.communication_id;
  IF NOT FOUND
     OR (p_expected_tenant_id IS NOT NULL
         AND v_communication.tenant_id IS DISTINCT FROM p_expected_tenant_id)
     OR v_communication.cuerpo_hash_sha512 IS DISTINCT FROM lower(p_body_hash_sha512)
     OR v_communication.cuerpo_hash_sha512 IS DISTINCT FROM encode(
       extensions.digest(convert_to(v_communication.cuerpo_render, 'UTF8'), 'sha512'), 'hex'
     )
     OR public.fn_communication_authoritative_binding_valid(v_communication.id) IS NOT TRUE THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_attachment_count
    FROM public.communication_attachments communication_attachment
   WHERE communication_attachment.communication_id = v_communication.id;
  SELECT jsonb_array_length(COALESCE(p_verified_attachments, '[]'::jsonb))
    INTO v_verified_count;
  IF v_attachment_count <> v_verified_count THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communication_attachments communication_attachment
      LEFT JOIN public.attachments source_attachment
        ON source_attachment.id = communication_attachment.source_attachment_id
     WHERE communication_attachment.communication_id = v_communication.id
       AND (
         NOT EXISTS (
           SELECT 1
             FROM jsonb_array_elements(p_verified_attachments) verified
            WHERE verified ->> 'communication_attachment_id' = communication_attachment.id::text
              AND verified ->> 'source_attachment_id'
                  IS NOT DISTINCT FROM communication_attachment.source_attachment_id::text
              AND lower(verified ->> 'hash_sha256')
                  IS NOT DISTINCT FROM communication_attachment.hash_sha256
              AND lower(verified ->> 'hash_sha512')
                  IS NOT DISTINCT FROM communication_attachment.hash_sha512
              AND verified ->> 'storage_uri'
                  IS NOT DISTINCT FROM communication_attachment.storage_uri
         )
         OR (
           communication_attachment.source_attachment_id IS NOT NULL
           AND (
             source_attachment.id IS NULL
             OR source_attachment.tenant_id IS DISTINCT FROM v_communication.tenant_id
             OR source_attachment.file_url IS DISTINCT FROM communication_attachment.storage_uri
             OR source_attachment.file_hash IS DISTINCT FROM communication_attachment.hash_sha256
             OR source_attachment.file_hash_sha512 IS DISTINCT FROM communication_attachment.hash_sha512
             OR (
               v_communication.tipo_comunicacion = 'CONVOCATORIA'
               AND (
                 source_attachment.convocatoria_id IS DISTINCT FROM v_communication.convocatoria_id
                 OR (
                   communication_attachment.tipo = 'DOCUMENTO_GENERADO'
                   AND source_attachment.artifact_kind <> 'CONVOCATORIA_FINAL'
                 )
                 OR (
                   communication_attachment.tipo <> 'DOCUMENTO_GENERADO'
                   AND source_attachment.artifact_kind <> 'SUPPORTING_DOCUMENT'
                 )
               )
             )
           )
         )
         OR (
           v_communication.tipo_comunicacion = 'CONVOCATORIA'
           AND communication_attachment.source_attachment_id IS NULL
         )
       )
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RLS tenant-real y privilegios
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS attachments_tenant_isolation ON public.attachments;
DROP POLICY IF EXISTS attachments_select ON public.attachments;
DROP POLICY IF EXISTS attachments_support_insert ON public.attachments;
DROP POLICY IF EXISTS attachments_support_update ON public.attachments;
DROP POLICY IF EXISTS attachments_support_delete ON public.attachments;
DROP POLICY IF EXISTS attachments_service_all ON public.attachments;

CREATE POLICY attachments_select ON public.attachments
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());
CREATE POLICY attachments_support_insert ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND artifact_kind = 'SUPPORTING_DOCUMENT'
  );
CREATE POLICY attachments_support_update ON public.attachments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND artifact_kind = 'SUPPORTING_DOCUMENT'
  )
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND artifact_kind = 'SUPPORTING_DOCUMENT'
  );
CREATE POLICY attachments_support_delete ON public.attachments
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND artifact_kind = 'SUPPORTING_DOCUMENT'
  );
CREATE POLICY attachments_service_all ON public.attachments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS communications_staff_insert ON public.communications;
DROP POLICY IF EXISTS communications_staff_update ON public.communications;
CREATE POLICY communications_staff_insert ON public.communications
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.fn_current_tenant_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.rbac_user_roles user_role
        JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE user_role.user_id = auth.uid()
         AND user_role.tenant_id = communications.tenant_id
         AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
         AND COALESCE(user_role.is_active, true) = true
    )
  );
CREATE POLICY communications_staff_update ON public.communications
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.fn_current_tenant_id()
    AND EXISTS (
      SELECT 1
        FROM public.rbac_user_roles user_role
        JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE user_role.user_id = auth.uid()
         AND user_role.tenant_id = communications.tenant_id
         AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
         AND COALESCE(user_role.is_active, true) = true
    )
  )
  WITH CHECK (tenant_id = public.fn_current_tenant_id());

DROP POLICY IF EXISTS recipients_staff_insert ON public.communication_recipients;
DROP POLICY IF EXISTS recipients_staff_update ON public.communication_recipients;
DROP POLICY IF EXISTS recipients_staff_delete ON public.communication_recipients;
CREATE POLICY recipients_staff_insert ON public.communication_recipients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.communications communication
        JOIN public.rbac_user_roles user_role
          ON user_role.tenant_id = communication.tenant_id
         AND user_role.user_id = auth.uid()
        JOIN public.rbac_roles role ON role.id = user_role.role_id
       WHERE communication.id = communication_recipients.communication_id
         AND communication.tenant_id = public.fn_current_tenant_id()
         AND role.role_code IN ('SECRETARIO', 'ADMIN_TENANT')
         AND COALESCE(user_role.is_active, true) = true
    )
  );
CREATE POLICY recipients_staff_update ON public.communication_recipients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communications communication
       WHERE communication.id = communication_recipients.communication_id
         AND communication.tenant_id = public.fn_current_tenant_id()
    )
  );
CREATE POLICY recipients_staff_delete ON public.communication_recipients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communications communication
       WHERE communication.id = communication_recipients.communication_id
         AND communication.tenant_id = public.fn_current_tenant_id()
         AND communication.estado = 'BORRADOR'
    )
  );

DROP POLICY IF EXISTS attachments_staff_insert ON public.communication_attachments;
DROP POLICY IF EXISTS attachments_staff_update ON public.communication_attachments;
DROP POLICY IF EXISTS attachments_staff_delete ON public.communication_attachments;
CREATE POLICY attachments_staff_insert ON public.communication_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communications communication
       WHERE communication.id = communication_attachments.communication_id
         AND communication.tenant_id = public.fn_current_tenant_id()
         AND communication.estado = 'BORRADOR'
    )
  );
CREATE POLICY attachments_staff_update ON public.communication_attachments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communications communication
       WHERE communication.id = communication_attachments.communication_id
         AND communication.tenant_id = public.fn_current_tenant_id()
         AND communication.estado = 'BORRADOR'
    )
  );
CREATE POLICY attachments_staff_delete ON public.communication_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.communications communication
       WHERE communication.id = communication_attachments.communication_id
         AND communication.tenant_id = public.fn_current_tenant_id()
         AND communication.estado = 'BORRADOR'
    )
  );

REVOKE ALL ON FUNCTION public.fn_convocatoria_final_artifact_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_register_convocatoria_final_attachment(uuid, uuid, text, text, text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_communication_authoritative_binding_valid(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_assert_authoritative_binding(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_dispatch_gate()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_attachment_immutable_after_draft()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_recipient_immutable_after_draft()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sync_convocation_communication_meeting()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_revalidate_recipient_dispatch(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_handle_error(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_register_convocatoria_final_attachment(uuid, uuid, text, text, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_revalidate_recipient_dispatch(uuid, uuid, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_handle_error(uuid, text, boolean)
  TO service_role;

COMMIT;
