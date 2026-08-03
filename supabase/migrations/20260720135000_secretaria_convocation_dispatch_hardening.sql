-- Secretaria -- hardening transaccional de convocatoria, paquete y dispatch.
--
-- Esta migracion NO atribuye firma electronica a EAD Trust. Los servicios EAD
-- se limitan a interposicion, mensajeria y e-archiving cuando exista respuesta
-- real del proveedor. Una marca temporal no acredita envio ni entrega.

BEGIN;

-- RBAC fail-closed: una asignacion legacy sin estado explicito no concede
-- permisos. Las nuevas asignaciones siguen naciendo activas por defecto, pero
-- el estado persistido siempre es booleano y nunca depende de COALESCE.
UPDATE public.rbac_user_roles
   SET is_active = false
 WHERE is_active IS NULL;

ALTER TABLE public.rbac_user_roles
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Contratos persistidos: censo WORM, revision de paquete y lease con token
-- ---------------------------------------------------------------------------

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS censo_snapshot_id uuid,
  ADD COLUMN IF NOT EXISTS censo_snapshot_hash_sha512 text,
  ADD COLUMN IF NOT EXISTS package_revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS package_hash_sha512 text;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'communications_censo_snapshot_id_fkey'
       AND conrelid = 'public.communications'::regclass
  ) THEN
    ALTER TABLE public.communications
      ADD CONSTRAINT communications_censo_snapshot_id_fkey
      FOREIGN KEY (censo_snapshot_id)
      REFERENCES public.censo_snapshot(id)
      ON DELETE RESTRICT;
  END IF;
END;
$block$;

ALTER TABLE public.communications
  DROP CONSTRAINT IF EXISTS communications_censo_snapshot_hash_check;
ALTER TABLE public.communications
  ADD CONSTRAINT communications_censo_snapshot_hash_check
  CHECK (
    censo_snapshot_hash_sha512 IS NULL
    OR censo_snapshot_hash_sha512 ~ '^[0-9a-f]{128}$'
  );

ALTER TABLE public.communications
  DROP CONSTRAINT IF EXISTS communications_package_hash_check;
ALTER TABLE public.communications
  ADD CONSTRAINT communications_package_hash_check
  CHECK (package_hash_sha512 IS NULL OR package_hash_sha512 ~ '^[0-9a-f]{128}$');

ALTER TABLE public.communications
  DROP CONSTRAINT IF EXISTS communications_estado_check;
ALTER TABLE public.communications
  ADD CONSTRAINT communications_estado_check CHECK (estado IN (
    'BORRADOR','PROGRAMADA','ENVIANDO','ENVIADA',
    'ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
    'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL',
    'EXPIRADA','CANCELADA','ERROR','RECONCILIATION_REQUIRED'
  ));

ALTER TABLE public.communication_recipients
  ADD COLUMN IF NOT EXISTS dispatch_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS dispatch_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_idempotency_key text,
  ADD COLUMN IF NOT EXISTS delivery_alternative jsonb;

ALTER TABLE public.communication_recipients
  DROP CONSTRAINT IF EXISTS communication_recipients_estado_entrega_check;
ALTER TABLE public.communication_recipients
  ADD CONSTRAINT communication_recipients_estado_entrega_check CHECK (estado_entrega IN (
    'PENDIENTE','ENVIANDO','ENVIADO','ENTREGADO',
    'LEIDO','RESPONDIDO','REBOTADO','ERROR','RECONCILIATION_REQUIRED'
  ));

ALTER TABLE public.communication_recipients
  DROP CONSTRAINT IF EXISTS communication_recipients_dispatch_lease_check;
ALTER TABLE public.communication_recipients
  ADD CONSTRAINT communication_recipients_dispatch_lease_check CHECK (
    estado_entrega <> 'ENVIANDO'
    OR (
      dispatch_attempt_id IS NOT NULL
      AND dispatch_lease_expires_at IS NOT NULL
      AND provider_idempotency_key IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public.communication_recipients
  DROP CONSTRAINT IF EXISTS communication_recipients_delivery_alternative_check;
ALTER TABLE public.communication_recipients
  ADD CONSTRAINT communication_recipients_delivery_alternative_check CHECK (
    delivery_alternative IS NULL
    OR (
      jsonb_typeof(delivery_alternative) = 'object'
      AND delivery_alternative ->> 'method' IN (
        'ERDS','BUROFAX_POSTAL','PORTAL_VERIFIED','HAND_DELIVERY'
      )
      AND length(btrim(COALESCE(delivery_alternative ->> 'destination', ''))) > 0
      AND length(btrim(COALESCE(delivery_alternative ->> 'reason', ''))) > 0
      AND length(btrim(COALESCE(delivery_alternative ->> 'evidence_reference', ''))) > 0
    )
  );

CREATE INDEX IF NOT EXISTS ix_communication_recipients_dispatch_lease
  ON public.communication_recipients(dispatch_lease_expires_at)
  WHERE estado_entrega = 'ENVIANDO';

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS artifact_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS artifact_verified_by_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS artifact_verified_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS artifact_verified_mime_type text,
  ADD COLUMN IF NOT EXISTS storage_object_etag text;

-- A binary generated in the browser is not authoritative merely because its
-- ZIP structure and hashes are valid. The exact candidate must first be
-- committed by an authenticated, current Secretaría operator against the
-- immutable reviewed source text. Registration then consumes that commitment.
CREATE TABLE IF NOT EXISTS public.convocation_artifact_candidates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  convocatoria_id       uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  artifact_kind         text NOT NULL CHECK (artifact_kind = 'CONVOCATORIA_FINAL'),
  source_hash_sha256    text NOT NULL CHECK (source_hash_sha256 ~ '^[0-9a-f]{64}$'),
  binary_hash_sha256    text NOT NULL CHECK (binary_hash_sha256 ~ '^[0-9a-f]{64}$'),
  binary_hash_sha512    text NOT NULL CHECK (binary_hash_sha512 ~ '^[0-9a-f]{128}$'),
  file_name             text NOT NULL CHECK (file_name ~* '\.docx$'),
  mime_type             text NOT NULL CHECK (
    mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ),
  review_context        jsonb NOT NULL CHECK (jsonb_typeof(review_context) = 'object'),
  review_status         text NOT NULL DEFAULT 'PRECOMMITTED'
    CHECK (review_status IN ('PRECOMMITTED','CONSUMED','REVOKED')),
  reviewed_by           uuid NOT NULL,
  reviewed_at           timestamptz NOT NULL DEFAULT clock_timestamp(),
  consumed_at           timestamptz,
  consumed_attachment_id uuid,
  UNIQUE (tenant_id, convocatoria_id, binary_hash_sha256, binary_hash_sha512)
);

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS artifact_candidate_id uuid;
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'attachments_artifact_candidate_id_fkey'
       AND conrelid = 'public.attachments'::regclass
  ) THEN
    ALTER TABLE public.attachments
      ADD CONSTRAINT attachments_artifact_candidate_id_fkey
      FOREIGN KEY (artifact_candidate_id)
      REFERENCES public.convocation_artifact_candidates(id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'convocation_artifact_candidates_consumed_attachment_id_fkey'
       AND conrelid = 'public.convocation_artifact_candidates'::regclass
  ) THEN
    ALTER TABLE public.convocation_artifact_candidates
      ADD CONSTRAINT convocation_artifact_candidates_consumed_attachment_id_fkey
      FOREIGN KEY (consumed_attachment_id)
      REFERENCES public.attachments(id)
      ON DELETE RESTRICT;
  END IF;
END;
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_convocation_artifact_candidate_consumption
  ON public.convocation_artifact_candidates(consumed_attachment_id)
  WHERE consumed_attachment_id IS NOT NULL;

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_final_candidate_commitment_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_final_candidate_commitment_check CHECK (
    convocatoria_id IS NULL
    OR artifact_kind <> 'CONVOCATORIA_FINAL'
    OR artifact_candidate_id IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_artifact_server_verification_check;
ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_artifact_server_verification_check CHECK (
    convocatoria_id IS NULL
    OR artifact_verified_at IS NULL
    OR (
      artifact_verified_by_service IS TRUE
      AND artifact_verified_size_bytes > 0
      AND artifact_verified_mime_type IN (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      AND file_hash ~ '^[0-9a-f]{64}$'
      AND file_hash_sha512 ~ '^[0-9a-f]{128}$'
    )
  ) NOT VALID;

COMMENT ON COLUMN public.communication_recipients.dispatch_attempt_id IS
  'Token de fencing de un unico worker. Todo revalidate/error/mark exige CAS sobre este valor.';
COMMENT ON COLUMN public.communication_recipients.provider_idempotency_key IS
  'Clave estable de la ruta efectiva del envio; no cambia en reintentos seguros y se renueva al pasar a un canal/destino alternativo.';
COMMENT ON COLUMN public.communication_recipients.delivery_alternative IS
  'Alternativa formal expresa cuando no se usa el email directorio: metodo, destino, causa y referencia de evidencia.';
COMMENT ON COLUMN public.communications.package_hash_sha512 IS
  'SHA-512 del manifiesto canonico cuerpo+coordenadas+censo+adjuntos+destinatarios.';

-- ---------------------------------------------------------------------------
-- 2. Registro de binarios exclusivamente tras verificacion en Edge/service
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_convocation_artifact_candidate_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_internal_writer boolean :=
    current_setting('app.secretaria_artifact_candidate_rpc', true) = 'on';
BEGIN
  IF NOT v_internal_writer THEN
    RAISE EXCEPTION 'convocation artifact candidates are append-only RPC state'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'convocation artifact candidates cannot be deleted'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND (
    NEW.review_status <> 'PRECOMMITTED'
    OR NEW.consumed_at IS NOT NULL
    OR NEW.consumed_attachment_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'artifact candidates must start PRECOMMITTED and unconsumed'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
       OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
       OR NEW.source_hash_sha256 IS DISTINCT FROM OLD.source_hash_sha256
       OR NEW.binary_hash_sha256 IS DISTINCT FROM OLD.binary_hash_sha256
       OR NEW.binary_hash_sha512 IS DISTINCT FROM OLD.binary_hash_sha512
       OR NEW.file_name IS DISTINCT FROM OLD.file_name
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.review_context IS DISTINCT FROM OLD.review_context
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR (
         OLD.consumed_at IS NOT NULL
         AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at
       )
       OR (
         OLD.consumed_attachment_id IS NOT NULL
         AND NEW.consumed_attachment_id IS DISTINCT FROM OLD.consumed_attachment_id
       ) THEN
      RAISE EXCEPTION 'convocation artifact candidate commitment is immutable'
        USING ERRCODE = '42501';
    END IF;
    IF NOT (
      NEW.review_status = OLD.review_status
      OR (OLD.review_status = 'PRECOMMITTED' AND NEW.review_status IN ('CONSUMED','REVOKED'))
    ) THEN
      RAISE EXCEPTION 'invalid artifact candidate transition % -> %',
        OLD.review_status, NEW.review_status USING ERRCODE = '23514';
    END IF;
    IF NEW.review_status = 'CONSUMED'
       AND (NEW.consumed_at IS NULL OR NEW.consumed_attachment_id IS NULL) THEN
      RAISE EXCEPTION 'consumed artifact candidate requires timestamp and attachment'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.review_status <> 'CONSUMED'
       AND (NEW.consumed_at IS NOT NULL OR NEW.consumed_attachment_id IS NOT NULL) THEN
      RAISE EXCEPTION 'only a consumed artifact candidate may bind an attachment'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_convocation_artifact_candidate_guard
  ON public.convocation_artifact_candidates;
CREATE TRIGGER trg_convocation_artifact_candidate_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.convocation_artifact_candidates
  FOR EACH ROW EXECUTE FUNCTION public.fn_convocation_artifact_candidate_guard();

CREATE OR REPLACE FUNCTION public.fn_convocatoria_final_artifact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_verified_writer boolean :=
    current_setting('app.secretaria_verified_artifact_rpc', true) = 'on';
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.convocatoria_id IS NOT NULL THEN
      RAISE EXCEPTION 'verified convocatoria artifacts cannot be deleted directly'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.convocatoria_id IS NOT NULL THEN
    IF NOT v_verified_writer THEN
      RAISE EXCEPTION 'convocatoria artifacts can only be updated by verified registration'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.convocatoria_id IS DISTINCT FROM OLD.convocatoria_id
       OR NEW.agenda_item_index IS DISTINCT FROM OLD.agenda_item_index
       OR NEW.file_name IS DISTINCT FROM OLD.file_name
       OR NEW.file_url IS DISTINCT FROM OLD.file_url
       OR NEW.file_hash IS DISTINCT FROM OLD.file_hash
       OR NEW.file_hash_sha512 IS DISTINCT FROM OLD.file_hash_sha512
       OR NEW.artifact_kind IS DISTINCT FROM OLD.artifact_kind
       OR (
         OLD.artifact_candidate_id IS NOT NULL
         AND NEW.artifact_candidate_id IS DISTINCT FROM OLD.artifact_candidate_id
       ) THEN
      RAISE EXCEPTION 'verified convocatoria artifact identity and hashes are immutable'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.convocatoria_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT v_verified_writer THEN
    RAISE EXCEPTION 'convocatoria artifacts require server-side binary verification'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || NEW.tenant_id::text || ':' || NEW.convocatoria_id::text,
      0
    )
  );

  SELECT * INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact convocatoria/tenant mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.file_url NOT LIKE
     'evidence-bundle://convocatorias/' || NEW.convocatoria_id::text || '/%' THEN
    RAISE EXCEPTION 'artifact storage URI is outside its convocatoria prefix'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.artifact_verified_at IS NULL
     OR NEW.artifact_verified_by_service IS NOT TRUE
     OR COALESCE(NEW.artifact_verified_size_bytes, 0) <= 0 THEN
    RAISE EXCEPTION 'server-side binary verification metadata is required'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.artifact_kind = 'CONVOCATORIA_FINAL'
     AND (
       v_convocatoria.estado <> 'EMITIDA'
       OR v_convocatoria.immutable_at IS NULL
       OR NEW.artifact_candidate_id IS NULL
       OR NEW.agenda_item_index IS NOT NULL
       OR NEW.file_name !~* '\.docx$'
       OR NEW.artifact_verified_mime_type <>
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     ) THEN
    RAISE EXCEPTION 'final artifact requires emitted immutable convocatoria and verified DOCX'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_convocatoria_final_artifact_guard ON public.attachments;
CREATE TRIGGER trg_convocatoria_final_artifact_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.fn_convocatoria_final_artifact_guard();

CREATE OR REPLACE FUNCTION public.fn_register_verified_convocation_attachment(
  p_tenant_id uuid,
  p_convocatoria_id uuid,
  p_artifact_kind text,
  p_agenda_item_index integer,
  p_file_name text,
  p_storage_uri text,
  p_hash_sha256 text,
  p_hash_sha512 text,
  p_size_bytes bigint,
  p_mime_type text,
  p_storage_etag text DEFAULT NULL,
  p_candidate_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing public.attachments%ROWTYPE;
  v_candidate public.convocation_artifact_candidates%ROWTYPE;
  v_convocatoria public.convocatorias%ROWTYPE;
  v_source_hash_sha256 text;
  v_attachment_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for verified artifact registration'
      USING ERRCODE = '42501';
  END IF;
  IF p_tenant_id IS NULL OR p_convocatoria_id IS NULL
     OR p_artifact_kind NOT IN ('SUPPORTING_DOCUMENT', 'CONVOCATORIA_FINAL') THEN
    RAISE EXCEPTION 'verified artifact identity is invalid';
  END IF;
  IF p_artifact_kind = 'SUPPORTING_DOCUMENT'
     AND p_agenda_item_index < 0 THEN
    RAISE EXCEPTION 'supporting artifact agenda item index cannot be negative';
  END IF;
  IF p_artifact_kind = 'CONVOCATORIA_FINAL'
     AND (
       p_candidate_id IS NULL
       OR
       p_agenda_item_index IS NOT NULL
       OR p_mime_type <>
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       OR p_file_name !~* '\.docx$'
     ) THEN
    RAISE EXCEPTION 'final artifact must be a DOCX without agenda item index';
  END IF;
  IF p_artifact_kind = 'SUPPORTING_DOCUMENT' AND p_candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'supporting documents cannot consume a final DOCX candidate';
  END IF;
  IF lower(COALESCE(p_hash_sha256, '')) !~ '^[0-9a-f]{64}$'
     OR lower(COALESCE(p_hash_sha512, '')) !~ '^[0-9a-f]{128}$'
     OR COALESCE(p_size_bytes, 0) <= 0 THEN
    RAISE EXCEPTION 'verified artifact requires actual size and SHA-256/SHA-512';
  END IF;
  IF p_mime_type NOT IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) THEN
    RAISE EXCEPTION 'verified artifact MIME is not allowed';
  END IF;
  IF (p_mime_type = 'application/pdf' AND p_file_name !~* '\.pdf$')
     OR (
       p_mime_type =
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       AND p_file_name !~* '\.docx$'
     ) THEN
    RAISE EXCEPTION 'verified artifact filename extension does not match MIME';
  END IF;
  IF p_storage_uri NOT LIKE
     'evidence-bundle://convocatorias/' || p_convocatoria_id::text || '/%' THEN
    RAISE EXCEPTION 'verified artifact URI is outside its convocatoria prefix';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || p_tenant_id::text || ':' || p_convocatoria_id::text,
      0
    )
  );
  SELECT convocatoria.* INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
     AND convocatoria.tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'verified artifact convocatoria/tenant mismatch';
  END IF;

  IF p_artifact_kind = 'CONVOCATORIA_FINAL' THEN
    v_source_hash_sha256 := encode(
      extensions.digest(convert_to(v_convocatoria.convocatoria_text, 'UTF8'), 'sha256'),
      'hex'
    );
    SELECT candidate.* INTO v_candidate
      FROM public.convocation_artifact_candidates candidate
     WHERE candidate.id = p_candidate_id
       AND candidate.tenant_id = p_tenant_id
       AND candidate.convocatoria_id = p_convocatoria_id
       AND candidate.artifact_kind = 'CONVOCATORIA_FINAL'
     FOR UPDATE;
    IF NOT FOUND
       OR v_candidate.review_status NOT IN ('PRECOMMITTED','CONSUMED')
       OR v_candidate.source_hash_sha256 IS DISTINCT FROM v_source_hash_sha256
       OR v_candidate.binary_hash_sha256 IS DISTINCT FROM lower(p_hash_sha256)
       OR v_candidate.binary_hash_sha512 IS DISTINCT FROM lower(p_hash_sha512)
       OR v_candidate.file_name IS DISTINCT FROM p_file_name
       OR v_candidate.mime_type IS DISTINCT FROM p_mime_type THEN
      RAISE EXCEPTION 'final DOCX differs from its authoritative precommitted candidate'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_existing
    FROM public.attachments attachment
   WHERE attachment.tenant_id = p_tenant_id
     AND attachment.convocatoria_id = p_convocatoria_id
     AND (
       (p_artifact_kind = 'CONVOCATORIA_FINAL'
        AND attachment.artifact_kind = 'CONVOCATORIA_FINAL')
       OR attachment.file_url = p_storage_uri
     )
   ORDER BY attachment.uploaded_at DESC
   LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.artifact_kind IS DISTINCT FROM p_artifact_kind
       OR v_existing.agenda_item_index IS DISTINCT FROM (CASE
            WHEN p_artifact_kind = 'CONVOCATORIA_FINAL' THEN NULL
            ELSE p_agenda_item_index
          END)
       OR v_existing.file_name IS DISTINCT FROM p_file_name
       OR v_existing.file_url IS DISTINCT FROM p_storage_uri
       OR v_existing.file_hash IS DISTINCT FROM lower(p_hash_sha256)
       OR v_existing.file_hash_sha512 IS DISTINCT FROM lower(p_hash_sha512)
       OR (
         p_artifact_kind = 'CONVOCATORIA_FINAL'
         AND v_existing.artifact_candidate_id IS NOT NULL
         AND v_existing.artifact_candidate_id IS DISTINCT FROM p_candidate_id
       )
       OR (
         v_existing.artifact_verified_at IS NOT NULL
         AND (
           v_existing.artifact_verified_size_bytes IS DISTINCT FROM p_size_bytes
           OR v_existing.artifact_verified_mime_type IS DISTINCT FROM p_mime_type
         )
       ) THEN
      RAISE EXCEPTION 'immutable artifact already exists with a different binary'
        USING ERRCODE = '23505';
    END IF;
    IF p_artifact_kind = 'CONVOCATORIA_FINAL'
       AND v_candidate.review_status = 'CONSUMED'
       AND v_candidate.consumed_attachment_id IS DISTINCT FROM v_existing.id THEN
      RAISE EXCEPTION 'artifact candidate was consumed by another attachment'
        USING ERRCODE = '23505';
    END IF;
    IF v_existing.artifact_verified_at IS NULL
       OR (
         p_artifact_kind = 'CONVOCATORIA_FINAL'
         AND v_existing.artifact_candidate_id IS NULL
       ) THEN
      PERFORM set_config('app.secretaria_verified_artifact_rpc', 'on', true);
      UPDATE public.attachments
         SET artifact_verified_at = now(),
             artifact_verified_by_service = true,
             artifact_verified_size_bytes = p_size_bytes,
             artifact_verified_mime_type = p_mime_type,
             storage_object_etag = NULLIF(btrim(p_storage_etag), ''),
             artifact_candidate_id = CASE
               WHEN p_artifact_kind = 'CONVOCATORIA_FINAL' THEN p_candidate_id
               ELSE artifact_candidate_id
             END
       WHERE id = v_existing.id;
      PERFORM set_config('app.secretaria_verified_artifact_rpc', 'off', true);
    END IF;
    IF p_artifact_kind = 'CONVOCATORIA_FINAL'
       AND v_candidate.review_status = 'PRECOMMITTED' THEN
      PERFORM set_config('app.secretaria_artifact_candidate_rpc', 'on', true);
      UPDATE public.convocation_artifact_candidates
         SET review_status = 'CONSUMED',
             consumed_at = clock_timestamp(),
             consumed_attachment_id = v_existing.id
       WHERE id = p_candidate_id;
      PERFORM set_config('app.secretaria_artifact_candidate_rpc', 'off', true);
    END IF;
    RETURN v_existing.id;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.tenant_id = p_tenant_id
       AND communication.convocatoria_id = p_convocatoria_id
       AND communication.tipo_comunicacion = 'CONVOCATORIA'
       AND communication.estado <> 'CANCELADA'
  ) THEN
    RAISE EXCEPTION 'convocatoria package is already assembled and frozen'
      USING ERRCODE = '55000';
  END IF;

  PERFORM set_config('app.secretaria_verified_artifact_rpc', 'on', true);
  INSERT INTO public.attachments (
    tenant_id, convocatoria_id, agenda_item_index,
    file_name, file_url, file_hash, file_hash_sha512,
    artifact_kind, artifact_registered_at, artifact_registered_by,
    artifact_verified_at, artifact_verified_by_service,
    artifact_verified_size_bytes, artifact_verified_mime_type,
    storage_object_etag, artifact_candidate_id
  ) VALUES (
    p_tenant_id,
    p_convocatoria_id,
    CASE WHEN p_artifact_kind = 'CONVOCATORIA_FINAL' THEN NULL ELSE p_agenda_item_index END,
    p_file_name,
    p_storage_uri,
    lower(p_hash_sha256),
    lower(p_hash_sha512),
    p_artifact_kind,
    CASE WHEN p_artifact_kind = 'CONVOCATORIA_FINAL' THEN now() ELSE NULL END,
    NULL,
    now(),
    true,
    p_size_bytes,
    p_mime_type,
    NULLIF(btrim(p_storage_etag), ''),
    p_candidate_id
  ) RETURNING id INTO v_attachment_id;
  PERFORM set_config('app.secretaria_verified_artifact_rpc', 'off', true);

  IF p_artifact_kind = 'CONVOCATORIA_FINAL' THEN
    PERFORM set_config('app.secretaria_artifact_candidate_rpc', 'on', true);
    UPDATE public.convocation_artifact_candidates
       SET review_status = 'CONSUMED',
           consumed_at = clock_timestamp(),
           consumed_attachment_id = v_attachment_id
     WHERE id = p_candidate_id
       AND review_status = 'PRECOMMITTED';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'final DOCX candidate could not be consumed atomically';
    END IF;
    PERFORM set_config('app.secretaria_artifact_candidate_rpc', 'off', true);
  END IF;

  RETURN v_attachment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_register_convocatoria_final_attachment(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_register_verified_convocation_attachment(
  uuid, uuid, text, integer, text, text, text, text, bigint, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_register_verified_convocation_attachment(
  uuid, uuid, text, integer, text, text, text, text, bigint, text, text, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Manifiesto y censo exacto a la fecha efectiva de la reunion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_communication_compute_package_hash(
  p_communication_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_manifest jsonb;
BEGIN
  SELECT jsonb_build_object(
    'communication_id', communication.id,
    'tenant_id', communication.tenant_id,
    'entity_id', communication.entity_id,
    'body_id', communication.body_id,
    'meeting_id', communication.meeting_id,
    'convocatoria_id', communication.convocatoria_id,
    'body_hash_sha512', communication.cuerpo_hash_sha512,
    'censo_snapshot_id', communication.censo_snapshot_id,
    'censo_snapshot_hash_sha512', communication.censo_snapshot_hash_sha512,
    'package_revision', communication.package_revision,
    'attachments', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', attachment.id,
          'source_attachment_id', attachment.source_attachment_id,
          'tipo', attachment.tipo,
          'storage_uri', attachment.storage_uri,
          'hash_sha256', attachment.hash_sha256,
          'hash_sha512', attachment.hash_sha512,
          'mime_type', attachment.mime_type,
          'modo_entrega', attachment.modo_entrega,
          'orden', attachment.orden
        ) ORDER BY attachment.orden, attachment.id
      )
      FROM public.communication_attachments attachment
      WHERE attachment.communication_id = communication.id
    ), '[]'::jsonb),
    'recipients', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', recipient.id,
          'person_id', recipient.person_id,
          'cargo_en_organo', recipient.cargo_en_organo,
          'canal_original', recipient.canal_original,
          'canal_primario', recipient.canal_primario,
          'canal_fallback', recipient.canal_fallback,
          'destino_primario', recipient.destino_primario,
          'destino_fallback', recipient.destino_fallback,
          'delivery_alternative', recipient.delivery_alternative
        ) ORDER BY recipient.person_id, recipient.id
      )
      FROM public.communication_recipients recipient
      WHERE recipient.communication_id = communication.id
    ), '[]'::jsonb)
  ) INTO v_manifest
  FROM public.communications communication
  WHERE communication.id = p_communication_id;

  IF v_manifest IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN encode(
    extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha512'),
    'hex'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_communication_prepare_census(
  p_communication_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_body_type text;
  v_snapshot_type text;
  v_snapshot_id uuid;
  v_snapshot_hash text;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication not found';
  END IF;
  IF v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN NULL;
  END IF;
  IF v_communication.estado <> 'BORRADOR'
     OR v_communication.meeting_id IS NULL
     OR v_communication.body_id IS NULL THEN
    RAISE EXCEPTION 'convocatoria census can only be fixed in BORRADOR with linked meeting';
  END IF;
  IF v_communication.censo_snapshot_id IS NOT NULL THEN
    RETURN v_communication.censo_snapshot_id;
  END IF;

  SELECT upper(COALESCE(body.body_type, '')) INTO v_body_type
    FROM public.governing_bodies body
   WHERE body.id = v_communication.body_id
     AND body.tenant_id = v_communication.tenant_id
     AND body.entity_id = v_communication.entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'communication body scope mismatch';
  END IF;
  v_snapshot_type := CASE
    WHEN v_body_type IN ('JUNTA','JGA','JUNTA_GENERAL','JUNTA_GENERAL_ACCIONISTAS','JUNTA_GENERAL_SOCIOS')
      OR v_body_type LIKE 'JUNTA%'
      THEN 'ECONOMICO'
    WHEN v_body_type IN ('CDA','CONSEJO_ADMIN','CONSEJO_ADMINISTRACION','COMISION','COMITE')
      OR v_body_type LIKE '%CONSEJO%'
      THEN 'POLITICO'
    ELSE NULL
  END;
  IF v_snapshot_type IS NULL THEN
    RAISE EXCEPTION 'communication body has no authoritative census source';
  END IF;

  v_snapshot_id := public.fn_crear_censo_snapshot(
    v_communication.meeting_id,
    'MEETING',
    v_communication.entity_id,
    v_communication.body_id,
    v_snapshot_type
  );
  SELECT lower(audit.hash_sha512)
    INTO v_snapshot_hash
    FROM public.censo_snapshot snapshot
    JOIN public.audit_log audit ON audit.id = snapshot.audit_worm_id
   WHERE snapshot.id = v_snapshot_id
     AND snapshot.tenant_id = v_communication.tenant_id;
  IF v_snapshot_hash !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'communication census WORM hash is missing';
  END IF;

  UPDATE public.communications
     SET censo_snapshot_id = v_snapshot_id,
         censo_snapshot_hash_sha512 = v_snapshot_hash,
         package_revision = package_revision + 1,
         updated_at = now()
   WHERE id = p_communication_id;
  RETURN v_snapshot_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_communication_census_binding_valid(
  p_communication_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
  v_snapshot public.censo_snapshot%ROWTYPE;
  v_snapshot_hash text;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND OR v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN v_communication.id IS NOT NULL;
  END IF;

  SELECT snapshot.*
    INTO v_snapshot
    FROM public.censo_snapshot snapshot
   WHERE snapshot.id = v_communication.censo_snapshot_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  SELECT lower(audit.hash_sha512)
    INTO v_snapshot_hash
    FROM public.audit_log audit
   WHERE audit.id = v_snapshot.audit_worm_id;
  IF v_snapshot.tenant_id IS DISTINCT FROM v_communication.tenant_id
     OR v_snapshot.entity_id IS DISTINCT FROM v_communication.entity_id
     OR v_snapshot.body_id IS DISTINCT FROM v_communication.body_id
     OR v_snapshot.meeting_id IS DISTINCT FROM v_communication.meeting_id
     OR v_snapshot.session_kind <> 'MEETING'
     OR v_snapshot_hash IS DISTINCT FROM v_communication.censo_snapshot_hash_sha512
     OR jsonb_typeof(v_snapshot.payload) <> 'array' THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(v_snapshot.payload) member
     WHERE COALESCE(member ->> 'person_id', '')
           !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RETURN false;
  END IF;

  -- Igualdad de conjuntos: nadie del censo puede faltar y nadie ajeno entra.
  IF EXISTS (
    SELECT DISTINCT (member ->> 'person_id')::uuid AS person_id
      FROM jsonb_array_elements(v_snapshot.payload) member
    EXCEPT
    SELECT recipient.person_id
      FROM public.communication_recipients recipient
     WHERE recipient.communication_id = v_communication.id
  ) OR EXISTS (
    SELECT recipient.person_id
      FROM public.communication_recipients recipient
     WHERE recipient.communication_id = v_communication.id
    EXCEPT
    SELECT DISTINCT (member ->> 'person_id')::uuid
      FROM jsonb_array_elements(v_snapshot.payload) member
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
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
           AND (
             length(btrim(COALESCE(person.email, ''))) = 0
             OR lower(btrim(recipient.destino_primario))
                IS DISTINCT FROM lower(btrim(person.email))
           )
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

-- Conserva todas las comprobaciones autoritativas de 201320 y suma censo,
-- verificacion server-side y hash del manifiesto. El validador anterior queda
-- encapsulado mediante una copia privada antes de reemplazar el nombre publico.
ALTER FUNCTION public.fn_communication_authoritative_binding_valid(uuid)
  RENAME TO fn_communication_authoritative_binding_valid_201320;

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
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF public.fn_communication_authoritative_binding_valid_201320(p_communication_id) IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF v_communication.tipo_comunicacion <> 'CONVOCATORIA' THEN
    RETURN true;
  END IF;
  IF public.fn_communication_census_binding_valid(p_communication_id) IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF v_communication.package_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR v_communication.package_hash_sha512 IS DISTINCT FROM
        public.fn_communication_compute_package_hash(p_communication_id) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.communication_attachments communication_attachment
      LEFT JOIN public.attachments source_attachment
        ON source_attachment.id = communication_attachment.source_attachment_id
     WHERE communication_attachment.communication_id = p_communication_id
       AND (
         source_attachment.id IS NULL
         OR source_attachment.artifact_verified_at IS NULL
         OR source_attachment.artifact_verified_by_service IS NOT TRUE
         OR COALESCE(source_attachment.artifact_verified_size_bytes, 0) <= 0
         OR (
           source_attachment.artifact_kind = 'CONVOCATORIA_FINAL'
           AND NOT EXISTS (
             SELECT 1
               FROM public.convocation_artifact_candidates candidate
               JOIN public.convocatorias convocatoria
                 ON convocatoria.id = candidate.convocatoria_id
                AND convocatoria.tenant_id = candidate.tenant_id
              WHERE candidate.id = source_attachment.artifact_candidate_id
                AND candidate.tenant_id = v_communication.tenant_id
                AND candidate.convocatoria_id = v_communication.convocatoria_id
                AND candidate.review_status = 'CONSUMED'
                AND candidate.consumed_attachment_id = source_attachment.id
                AND candidate.binary_hash_sha256 = source_attachment.file_hash
                AND candidate.binary_hash_sha512 = source_attachment.file_hash_sha512
                AND candidate.source_hash_sha256 = encode(
                  extensions.digest(
                    convert_to(convocatoria.convocatoria_text, 'UTF8'),
                    'sha256'
                  ),
                  'hex'
                )
           )
         )
       )
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;

-- Alias privado util para auditoria y pruebas del contrato base 201320.
CREATE OR REPLACE FUNCTION public.fn_communication_base_binding_without_recipient_directory(
  p_communication_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.fn_communication_authoritative_binding_valid_201320(p_communication_id)
$function$;

-- ---------------------------------------------------------------------------
-- 4. Gate/FSM y agregado fail-closed
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
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado AND NOT (
    (OLD.estado = 'BORRADOR' AND NEW.estado IN ('PROGRAMADA','CANCELADA'))
    OR (OLD.estado = 'PROGRAMADA' AND NEW.estado IN (
      'ENVIANDO','ERROR','CANCELADA','RECONCILIATION_REQUIRED'
    ))
    OR (OLD.estado = 'ENVIANDO' AND NEW.estado IN (
      'PROGRAMADA','ENVIADA','ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
      'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','EXPIRADA','ERROR',
      'RECONCILIATION_REQUIRED'
    ))
    OR (OLD.estado = 'ENVIADA' AND NEW.estado IN (
      'ENTREGADA_PARCIAL','ENTREGADA_TOTAL','RESPONDIDA_PARCIAL',
      'RESPONDIDA_TOTAL','EXPIRADA','ERROR','RECONCILIATION_REQUIRED'
    ))
    OR (OLD.estado = 'ENTREGADA_PARCIAL'
        AND NEW.estado IN (
          'PROGRAMADA','ENTREGADA_TOTAL','RESPONDIDA_PARCIAL',
          'RESPONDIDA_TOTAL','EXPIRADA','ERROR','RECONCILIATION_REQUIRED'
        ))
    OR (OLD.estado = 'ENTREGADA_TOTAL'
        AND NEW.estado IN ('RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','EXPIRADA'))
    OR (OLD.estado = 'RESPONDIDA_PARCIAL'
        AND NEW.estado IN ('RESPONDIDA_TOTAL','EXPIRADA','ERROR'))
    OR (OLD.estado = 'ERROR'
        AND NEW.estado IN (
          'PROGRAMADA','ENVIADA','ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
          'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','RECONCILIATION_REQUIRED'
        ))
    OR (OLD.estado = 'RECONCILIATION_REQUIRED'
        AND NEW.estado IN (
          'PROGRAMADA','ENVIADA','ENTREGADA_PARCIAL','ENTREGADA_TOTAL',
          'RESPONDIDA_PARCIAL','RESPONDIDA_TOTAL','ERROR'
        ))
  ) THEN
    RAISE EXCEPTION 'invalid communication state transition % -> %', OLD.estado, NEW.estado
      USING ERRCODE = '23514';
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
    OR NEW.plazo_legal_dias IS DISTINCT FROM OLD.plazo_legal_dias
    OR NEW.fecha_limite_respuesta IS DISTINCT FROM OLD.fecha_limite_respuesta
    OR NEW.comunicacion_libre IS DISTINCT FROM OLD.comunicacion_libre
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.censo_snapshot_id IS DISTINCT FROM OLD.censo_snapshot_id
    OR NEW.censo_snapshot_hash_sha512 IS DISTINCT FROM OLD.censo_snapshot_hash_sha512
    OR NEW.package_revision IS DISTINCT FROM OLD.package_revision
    OR NEW.package_hash_sha512 IS DISTINCT FROM OLD.package_hash_sha512
  ) THEN
    RAISE EXCEPTION 'communication package is immutable after BORRADOR'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.estado = 'PROGRAMADA' AND OLD.estado IS DISTINCT FROM 'PROGRAMADA' THEN
    IF NEW.fecha_programada IS NULL THEN
      RAISE EXCEPTION 'scheduled communication requires fecha_programada';
    END IF;
    PERFORM public.fn_communication_assert_authoritative_binding(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_communications_recompute_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total integer;
  v_pending integer;
  v_sending integer;
  v_sent integer;
  v_delivered integer;
  v_read integer;
  v_responded integer;
  v_bounced integer;
  v_error integer;
  v_reconciliation integer;
  v_new_state text;
  v_current_state text;
  v_response_type text;
  v_deadline timestamptz;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE estado_entrega = 'PENDIENTE'),
    count(*) FILTER (WHERE estado_entrega = 'ENVIANDO'),
    count(*) FILTER (WHERE estado_entrega = 'ENVIADO'),
    count(*) FILTER (WHERE estado_entrega = 'ENTREGADO'),
    count(*) FILTER (WHERE estado_entrega = 'LEIDO'),
    count(*) FILTER (WHERE estado_entrega = 'RESPONDIDO'),
    count(*) FILTER (WHERE estado_entrega = 'REBOTADO'),
    count(*) FILTER (WHERE estado_entrega = 'ERROR'),
    count(*) FILTER (WHERE estado_entrega = 'RECONCILIATION_REQUIRED')
    INTO v_total, v_pending, v_sending, v_sent, v_delivered, v_read,
         v_responded, v_bounced, v_error, v_reconciliation
    FROM public.communication_recipients
   WHERE communication_id = NEW.communication_id;

  SELECT estado, tipo_respuesta_esperada, fecha_limite_respuesta
    INTO v_current_state, v_response_type, v_deadline
    FROM public.communications
   WHERE id = NEW.communication_id
   FOR UPDATE;
  IF v_total = 0 OR v_current_state IN ('BORRADOR','CANCELADA') THEN
    RETURN NEW;
  END IF;

  IF v_reconciliation > 0 THEN
    v_new_state := 'RECONCILIATION_REQUIRED';
  ELSIF v_sending > 0 THEN
    v_new_state := 'ENVIANDO';
  ELSIF v_pending > 0 THEN
    v_new_state := 'PROGRAMADA';
  ELSIF (v_bounced + v_error) = v_total THEN
    v_new_state := 'ERROR';
  ELSIF (v_delivered + v_read + v_responded + v_bounced + v_error) = v_total THEN
    IF v_response_type = 'INFORMATIVA' OR v_response_type IS NULL THEN
      v_new_state := CASE
        WHEN (v_delivered + v_read + v_responded) = 0 THEN 'ERROR'
        WHEN (v_bounced + v_error) > 0 THEN 'ENTREGADA_PARCIAL'
        ELSE 'ENTREGADA_TOTAL'
      END;
    ELSIF v_responded = v_total THEN
      v_new_state := 'RESPONDIDA_TOTAL';
    ELSIF v_responded > 0 THEN
      v_new_state := 'RESPONDIDA_PARCIAL';
    ELSIF v_deadline IS NOT NULL AND v_deadline < now() THEN
      v_new_state := 'EXPIRADA';
    ELSE
      v_new_state := CASE
        WHEN (v_bounced + v_error) > 0 THEN 'ENTREGADA_PARCIAL'
        ELSE 'ENTREGADA_TOTAL'
      END;
    END IF;
  ELSIF v_sent > 0 AND v_sent + v_bounced + v_error = v_total THEN
    v_new_state := 'ENVIADA';
  ELSE
    -- Estado no demostrable: nunca elevar a ENVIADA por descarte.
    v_new_state := 'RECONCILIATION_REQUIRED';
  END IF;

  UPDATE public.communications
     SET estado = v_new_state,
         tiene_rebotes = v_bounced > 0,
         fecha_envio_efectiva = CASE
           WHEN v_new_state = 'ENVIADA' THEN COALESCE(fecha_envio_efectiva, now())
           ELSE fecha_envio_efectiva
         END,
         updated_at = now()
   WHERE id = NEW.communication_id
     AND estado IS DISTINCT FROM v_new_state;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Creacion/programacion/cancelacion/reintento solo por RPC RBAC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_assert_communication_operator(
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.fn_secretaria_is_service_role() IS TRUE THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL OR public.fn_assert_current_tenant_id() <> p_tenant_id THEN
    RAISE EXCEPTION 'communication tenant access denied' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.rbac_user_roles user_role
      JOIN public.rbac_roles role ON role.id = user_role.role_id
     WHERE user_role.user_id = auth.uid()
       AND user_role.tenant_id = p_tenant_id
       AND role.role_code IN ('SECRETARIO','ADMIN_TENANT')
       AND user_role.is_active IS TRUE
       AND (user_role.expires_at IS NULL OR user_role.expires_at > clock_timestamp())
  ) THEN
    RAISE EXCEPTION 'SECRETARIO or ADMIN_TENANT required' USING ERRCODE = '42501';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_precommit_convocation_final_candidate(
  p_tenant_id uuid,
  p_convocatoria_id uuid,
  p_file_name text,
  p_source_hash_sha256 text,
  p_binary_hash_sha256 text,
  p_binary_hash_sha512 text,
  p_mime_type text,
  p_review_context jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_convocatoria public.convocatorias%ROWTYPE;
  v_expected_source_hash text;
  v_existing public.convocation_artifact_candidates%ROWTYPE;
  v_candidate_id uuid;
BEGIN
  IF auth.uid() IS NULL OR public.fn_secretaria_is_service_role() IS TRUE THEN
    RAISE EXCEPTION 'an authenticated human operator must precommit the final DOCX candidate'
      USING ERRCODE = '42501';
  END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(p_tenant_id);
  IF p_file_name !~* '\.docx$'
     OR p_mime_type <>
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     OR lower(COALESCE(p_source_hash_sha256, '')) !~ '^[0-9a-f]{64}$'
     OR lower(COALESCE(p_binary_hash_sha256, '')) !~ '^[0-9a-f]{64}$'
     OR lower(COALESCE(p_binary_hash_sha512, '')) !~ '^[0-9a-f]{128}$'
     OR jsonb_typeof(COALESCE(p_review_context, 'null'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'final DOCX candidate commitment is malformed';
  END IF;
  IF p_review_context ->> 'renderer' <> 'PROCESS_DOCUMENTS_V1'
     OR p_review_context ->> 'source' <> 'convocatorias.convocatoria_text'
     OR lower(COALESCE(p_review_context ->> 'content_hash_sha256', ''))
        IS DISTINCT FROM lower(p_source_hash_sha256) THEN
    RAISE EXCEPTION 'candidate review context is not bound to the authoritative render';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'CONVOCATION:FINAL:CANDIDATE:' || p_tenant_id::text || ':' || p_convocatoria_id::text,
    0
  ));
  SELECT convocatoria.* INTO v_convocatoria
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = p_convocatoria_id
     AND convocatoria.tenant_id = p_tenant_id
   FOR SHARE;
  IF NOT FOUND
     OR v_convocatoria.estado <> 'EMITIDA'
     OR v_convocatoria.immutable_at IS NULL
     OR length(btrim(COALESCE(v_convocatoria.convocatoria_text, ''))) = 0 THEN
    RAISE EXCEPTION 'candidate requires an emitted immutable reviewed convocatoria';
  END IF;
  v_expected_source_hash := encode(
    extensions.digest(convert_to(v_convocatoria.convocatoria_text, 'UTF8'), 'sha256'),
    'hex'
  );
  IF lower(p_source_hash_sha256) IS DISTINCT FROM v_expected_source_hash THEN
    RAISE EXCEPTION 'candidate source hash differs from immutable convocatoria_text'
      USING ERRCODE = '23514';
  END IF;

  SELECT candidate.* INTO v_existing
    FROM public.convocation_artifact_candidates candidate
   WHERE candidate.tenant_id = p_tenant_id
     AND candidate.convocatoria_id = p_convocatoria_id
     AND candidate.binary_hash_sha256 = lower(p_binary_hash_sha256)
     AND candidate.binary_hash_sha512 = lower(p_binary_hash_sha512)
   LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.review_status = 'REVOKED'
       OR v_existing.source_hash_sha256 IS DISTINCT FROM v_expected_source_hash
       OR v_existing.file_name IS DISTINCT FROM p_file_name
       OR v_existing.mime_type IS DISTINCT FROM p_mime_type
       OR v_existing.review_context IS DISTINCT FROM p_review_context THEN
      RAISE EXCEPTION 'an incompatible or revoked candidate already exists'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  PERFORM set_config('app.secretaria_artifact_candidate_rpc', 'on', true);
  INSERT INTO public.convocation_artifact_candidates (
    tenant_id, convocatoria_id, artifact_kind, source_hash_sha256,
    binary_hash_sha256, binary_hash_sha512, file_name, mime_type,
    review_context, review_status, reviewed_by
  ) VALUES (
    p_tenant_id, p_convocatoria_id, 'CONVOCATORIA_FINAL', v_expected_source_hash,
    lower(p_binary_hash_sha256), lower(p_binary_hash_sha512), p_file_name, p_mime_type,
    p_review_context, 'PRECOMMITTED', auth.uid()
  ) RETURNING id INTO v_candidate_id;
  PERFORM set_config('app.secretaria_artifact_candidate_rpc', 'off', true);
  RETURN v_candidate_id;
END;
$function$;

-- Sustituye la RPC 201320. La insercion sigue siendo BORRADOR; censo,
-- manifiesto y promocion se resuelven dentro de la misma transaccion.
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
  v_tenant_id uuid;
  v_convocatoria_id uuid := NULLIF(p_comm ->> 'convocatoria_id', '')::uuid;
  v_meeting_id uuid := NULLIF(p_comm ->> 'meeting_id', '')::uuid;
  v_linked_meeting_count integer := 0;
  v_requested_state text := upper(COALESCE(NULLIF(p_comm ->> 'estado', ''), 'BORRADOR'));
  v_metadata jsonb;
  v_has_ead_recipient boolean := false;
BEGIN
  IF v_requested_state NOT IN ('BORRADOR','PROGRAMADA') THEN
    RAISE EXCEPTION 'new communication state must be BORRADOR or PROGRAMADA';
  END IF;
  v_tenant_id := COALESCE(
    NULLIF(p_comm ->> 'tenant_id', '')::uuid,
    public.fn_current_tenant_id()
  );
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_tenant_id);

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
    IF v_linked_meeting_count <> 1 THEN
      RAISE EXCEPTION 'convocatoria requires exactly one materialized meeting before communication';
    END IF;
    IF NULLIF(p_comm ->> 'meeting_id', '') IS NOT NULL
       AND v_meeting_id IS DISTINCT FROM (p_comm ->> 'meeting_id')::uuid THEN
      RAISE EXCEPTION 'meeting_id does not match the authoritative agenda binding';
    END IF;
  END IF;
  IF v_requested_state = 'PROGRAMADA'
     AND NULLIF(p_comm ->> 'fecha_programada', '') IS NULL THEN
    RAISE EXCEPTION 'fecha_programada required for PROGRAMADA';
  END IF;

  v_metadata := COALESCE(p_comm -> 'metadata', '{}'::jsonb) || jsonb_build_object(
    'created_via', CASE
      WHEN public.fn_secretaria_is_service_role() IS TRUE THEN 'service_role'
      ELSE 'authenticated_user'
    END
  );
  INSERT INTO public.communications (
    tenant_id, entity_id, body_id, organo_tipo, agreement_id, meeting_id,
    convocatoria_id, template_id, tipo_comunicacion, tipo_respuesta_esperada,
    nivel_certificacion_minimo, asunto, cuerpo_render, cuerpo_hash_sha512,
    estado, fecha_programada, comunicacion_libre, metadata, created_by,
    package_revision
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
    v_user_id,
    1
  ) RETURNING id INTO v_comm_id;

  IF jsonb_typeof(COALESCE(p_recipients, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_recipients, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'at least one recipient is required';
  END IF;
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_recipients) recipient
     WHERE recipient ->> 'canal_primario' = 'BUROFAX_ERDS'
        OR recipient ->> 'canal_fallback' = 'BUROFAX_ERDS'
  ) INTO v_has_ead_recipient;

  IF jsonb_typeof(COALESCE(p_attachments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'communication attachments must be a JSON array';
  END IF;
  IF jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) = 0
     AND NOT (
       p_comm ->> 'tipo_comunicacion' <> 'CONVOCATORIA'
       AND v_has_ead_recipient
       AND v_metadata ->> 'ead_delivery_mode' = 'BASIC_MESSAGE'
     ) THEN
    RAISE EXCEPTION 'zero attachments are allowed only for explicit EAD BASIC_MESSAGE mode';
  END IF;
  IF v_has_ead_recipient
     AND jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) > 0
     AND v_metadata ->> 'ead_delivery_mode' <> 'PACKAGE_WITH_ATTACHMENTS' THEN
    RAISE EXCEPTION 'EAD attachments require explicit PACKAGE_WITH_ATTACHMENTS mode';
  END IF;
  IF v_metadata ->> 'ead_delivery_mode' = 'BASIC_MESSAGE'
     AND jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'EAD BASIC_MESSAGE cannot carry attachments';
  END IF;
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

  INSERT INTO public.communication_recipients (
    communication_id, person_id, cargo_en_organo,
    canal_original, canal_primario, canal_fallback,
    destino_primario, destino_fallback, delivery_alternative
  )
  SELECT
    v_comm_id,
    (recipient ->> 'person_id')::uuid,
    recipient ->> 'cargo_en_organo',
    recipient ->> 'canal_primario',
    recipient ->> 'canal_primario',
    NULLIF(recipient ->> 'canal_fallback', ''),
    recipient ->> 'destino_primario',
    NULLIF(recipient ->> 'destino_fallback', ''),
    CASE
      WHEN jsonb_typeof(recipient -> 'delivery_alternative') = 'object'
        THEN recipient -> 'delivery_alternative'
      ELSE NULL
    END
  FROM jsonb_array_elements(p_recipients) recipient;

  IF p_comm ->> 'tipo_comunicacion' = 'CONVOCATORIA' THEN
    PERFORM public.fn_communication_prepare_census(v_comm_id);
  ELSIF lower(p_comm ->> 'cuerpo_hash_sha512') IS DISTINCT FROM encode(
    extensions.digest(convert_to(p_comm ->> 'cuerpo_render', 'UTF8'), 'sha512'), 'hex'
  ) THEN
    RAISE EXCEPTION 'communication body SHA-512 mismatch';
  END IF;
  UPDATE public.communications
     SET package_hash_sha512 = public.fn_communication_compute_package_hash(v_comm_id),
         updated_at = now()
   WHERE id = v_comm_id;

  IF v_requested_state = 'PROGRAMADA' THEN
    PERFORM public.fn_communication_assert_authoritative_binding(v_comm_id);
    UPDATE public.communications
       SET estado = 'PROGRAMADA', updated_at = now()
     WHERE id = v_comm_id;
  END IF;
  RETURN v_comm_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_program_communication(
  p_communication_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'communication not found'; END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_communication.tenant_id);
  IF v_communication.estado <> 'BORRADOR' THEN
    RAISE EXCEPTION 'only BORRADOR can be programmed';
  END IF;
  IF v_communication.fecha_programada IS NULL THEN
    RAISE EXCEPTION 'fecha_programada required';
  END IF;
  IF v_communication.convocatoria_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || v_communication.tenant_id::text || ':' || v_communication.convocatoria_id::text,
      0
    ));
    PERFORM public.fn_communication_prepare_census(v_communication.id);
  END IF;
  UPDATE public.communications
     SET package_hash_sha512 = public.fn_communication_compute_package_hash(id),
         updated_at = now()
   WHERE id = p_communication_id;
  PERFORM public.fn_communication_assert_authoritative_binding(p_communication_id);
  UPDATE public.communications
     SET estado = 'PROGRAMADA', updated_at = now()
   WHERE id = p_communication_id;
  RETURN p_communication_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_cancel_communication(
  p_communication_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_communication public.communications%ROWTYPE;
BEGIN
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = p_communication_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'communication not found'; END IF;
  PERFORM public.fn_secretaria_assert_communication_operator(v_communication.tenant_id);
  IF v_communication.estado NOT IN ('BORRADOR','PROGRAMADA') THEN
    RAISE EXCEPTION 'communication cannot be cancelled after provider dispatch starts';
  END IF;
  IF v_communication.convocatoria_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'COMMUNICATION:CONVOCATORIA:' || v_communication.tenant_id::text || ':' || v_communication.convocatoria_id::text,
      0
    ));
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.communication_recipients recipient
     WHERE recipient.communication_id = p_communication_id
       AND recipient.estado_entrega = 'ENVIANDO'
  ) THEN
    RAISE EXCEPTION 'active dispatch lease prevents cancellation';
  END IF;
  UPDATE public.communications
     SET estado = 'CANCELADA', updated_at = now()
   WHERE id = p_communication_id;
  RETURN p_communication_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_retry_communication_recipient(
  p_recipient_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_tenant_id uuid;
BEGIN
  SELECT recipient
    INTO v_recipient
    FROM public.communication_recipients recipient
    JOIN public.communications communication ON communication.id = recipient.communication_id
   WHERE recipient.id = p_recipient_id
   FOR UPDATE OF recipient;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipient not found'; END IF;
  SELECT communication.tenant_id INTO v_tenant_id
    FROM public.communications communication
   WHERE communication.id = v_recipient.communication_id;
  PERFORM public.fn_secretaria_assert_communication_operator(v_tenant_id);
  IF v_recipient.estado_entrega NOT IN ('ERROR','REBOTADO') THEN
    RAISE EXCEPTION 'only a definitive ERROR or REBOTADO recipient may be retried';
  END IF;
  IF v_recipient.estado_entrega = 'REBOTADO'
     AND (
       v_recipient.canal_fallback IS NULL
       OR v_recipient.canal_usado IS NOT DISTINCT FROM v_recipient.canal_fallback
     ) THEN
    RAISE EXCEPTION
      'a bounced terminal channel requires a new governed communication; no unused fallback remains';
  END IF;
  UPDATE public.communication_recipients
     SET estado_entrega = 'PENDIENTE',
         canal_usado = CASE
           WHEN v_recipient.canal_fallback IS NOT NULL
                AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback
             THEN v_recipient.canal_fallback
           ELSE v_recipient.canal_usado
         END,
         intento_reenvio_n = CASE
           WHEN v_recipient.canal_fallback IS NOT NULL
                AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback
             THEN 0
           ELSE v_recipient.intento_reenvio_n
         END,
         provider_idempotency_key = CASE
           WHEN v_recipient.canal_fallback IS NOT NULL
                AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback
             THEN NULL
           ELSE v_recipient.provider_idempotency_key
         END,
         ultimo_error = NULL,
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_recipient_id;
  RETURN p_recipient_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Claim/revalidate/mark con fencing token y resultado incierto bloqueado
-- ---------------------------------------------------------------------------

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

  -- Un lease vencido tiene resultado externo desconocido. Nunca se reencola.
  UPDATE public.communication_recipients recipient
     SET estado_entrega = 'RECONCILIATION_REQUIRED',
         ultimo_error = 'dispatch lease expired with unknown provider outcome',
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
    FROM public.communications communication
   WHERE communication.id = recipient.communication_id
     AND recipient.estado_entrega = 'ENVIANDO'
     AND recipient.dispatch_lease_expires_at <= now()
     AND (p_tenant_id IS NULL OR communication.tenant_id = p_tenant_id);

  RETURN QUERY
  UPDATE public.communication_recipients recipient
     SET estado_entrega = 'ENVIANDO',
         dispatch_attempt_id = gen_random_uuid(),
         dispatch_lease_expires_at = now() + interval '5 minutes',
         provider_idempotency_key = COALESCE(
           recipient.provider_idempotency_key,
           encode(extensions.digest(
             convert_to(
               'COMMUNICATION:' || recipient.communication_id::text
               || ':RECIPIENT:' || recipient.id::text
               || ':PACKAGE:' || communication.package_hash_sha512
               || ':CHANNEL:' || COALESCE(recipient.canal_usado, recipient.canal_primario)
               || ':DESTINATION:' || CASE
                    WHEN COALESCE(recipient.canal_usado, recipient.canal_primario)
                         = recipient.canal_fallback
                      THEN COALESCE(recipient.destino_fallback, recipient.destino_primario)
                    ELSE recipient.destino_primario
                  END,
               'UTF8'
             ),
             'sha256'
           ), 'hex')
         ),
         intento_reenvio_n = recipient.intento_reenvio_n + 1,
         updated_at = now()
    FROM public.communications communication
   WHERE communication.id = recipient.communication_id
     AND recipient.id IN (
       SELECT candidate.id
         FROM public.communication_recipients candidate
         JOIN public.communications candidate_communication
           ON candidate_communication.id = candidate.communication_id
        WHERE candidate.estado_entrega = 'PENDIENTE'
          AND candidate.intento_reenvio_n < 3
          AND candidate_communication.estado IN ('PROGRAMADA','ENVIANDO')
          AND candidate_communication.fecha_programada <= now()
          AND candidate_communication.package_hash_sha512 ~ '^[0-9a-f]{128}$'
          AND (p_tenant_id IS NULL OR candidate_communication.tenant_id = p_tenant_id)
          AND public.fn_communication_authoritative_binding_valid(candidate_communication.id) IS TRUE
        ORDER BY candidate_communication.fecha_programada, candidate.id
        LIMIT v_limit
        FOR UPDATE OF candidate SKIP LOCKED
     )
  RETURNING recipient.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_revalidate_recipient_dispatch_attempt(
  p_recipient_id uuid,
  p_dispatch_attempt_id uuid,
  p_expected_tenant_id uuid,
  p_body_hash_sha512 text,
  p_package_revision bigint,
  p_package_hash_sha512 text,
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
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required for dispatch revalidation'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_recipient
    FROM public.communication_recipients
   WHERE id = p_recipient_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_recipient.estado_entrega <> 'ENVIANDO'
     OR v_recipient.dispatch_attempt_id IS DISTINCT FROM p_dispatch_attempt_id
     OR v_recipient.dispatch_lease_expires_at <= now() THEN
    RETURN false;
  END IF;
  SELECT * INTO v_communication
    FROM public.communications
   WHERE id = v_recipient.communication_id
   FOR SHARE;
  IF NOT FOUND
     OR v_communication.estado NOT IN ('PROGRAMADA','ENVIANDO')
     OR (p_expected_tenant_id IS NOT NULL
         AND v_communication.tenant_id IS DISTINCT FROM p_expected_tenant_id)
     OR v_communication.cuerpo_hash_sha512 IS DISTINCT FROM lower(p_body_hash_sha512)
     OR v_communication.package_revision IS DISTINCT FROM p_package_revision
     OR v_communication.package_hash_sha512 IS DISTINCT FROM lower(p_package_hash_sha512)
     OR public.fn_communication_authoritative_binding_valid(v_communication.id) IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(COALESCE(p_verified_attachments, '[]'::jsonb)) <> 'array' THEN
    RETURN false;
  END IF;
  SELECT count(*) INTO v_attachment_count
    FROM public.communication_attachments attachment
   WHERE attachment.communication_id = v_communication.id;
  IF v_attachment_count <> jsonb_array_length(COALESCE(p_verified_attachments, '[]'::jsonb)) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.communication_attachments attachment
     WHERE attachment.communication_id = v_communication.id
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(p_verified_attachments) verified
          WHERE verified ->> 'communication_attachment_id' = attachment.id::text
            AND verified ->> 'source_attachment_id' = attachment.source_attachment_id::text
            AND lower(verified ->> 'hash_sha256') = attachment.hash_sha256
            AND lower(verified ->> 'hash_sha512') = attachment.hash_sha512
            AND verified ->> 'storage_uri' = attachment.storage_uri
       )
  ) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recipient_handle_error_attempt(
  p_recipient_id uuid,
  p_dispatch_attempt_id uuid,
  p_error_message text,
  p_retriable boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_recipient
    FROM public.communication_recipients
   WHERE id = p_recipient_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_recipient.estado_entrega <> 'ENVIANDO'
     OR v_recipient.dispatch_attempt_id IS DISTINCT FROM p_dispatch_attempt_id THEN
    RETURN false;
  END IF;

  IF p_retriable AND v_recipient.intento_reenvio_n < 3 THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'PENDIENTE',
           ultimo_error = p_error_message,
           dispatch_attempt_id = NULL,
           dispatch_lease_expires_at = NULL,
           updated_at = now()
     WHERE id = p_recipient_id;
  ELSIF p_retriable
        AND v_recipient.canal_fallback IS NOT NULL
        AND v_recipient.canal_usado IS DISTINCT FROM v_recipient.canal_fallback THEN
    UPDATE public.communication_recipients
       SET canal_usado = canal_fallback,
           estado_entrega = 'PENDIENTE',
           intento_reenvio_n = 0,
           provider_idempotency_key = NULL,
           ultimo_error = p_error_message,
           dispatch_attempt_id = NULL,
           dispatch_lease_expires_at = NULL,
           updated_at = now()
     WHERE id = p_recipient_id;
  ELSE
    UPDATE public.communication_recipients
       SET estado_entrega = 'ERROR',
           ultimo_error = p_error_message,
           dispatch_attempt_id = NULL,
           dispatch_lease_expires_at = NULL,
           updated_at = now()
     WHERE id = p_recipient_id;
    INSERT INTO public.communication_delivery_events(
      recipient_id, evento, proveedor, payload, hash_self
    ) VALUES (
      p_recipient_id, 'ERROR', 'INTERNAL',
      jsonb_build_object(
        'error', p_error_message,
        'dispatch_attempt_id', p_dispatch_attempt_id
      ), ''
    );
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recipient_mark_sent_attempt(
  p_recipient_id uuid,
  p_dispatch_attempt_id uuid,
  p_idempotency_key text,
  p_canal_usado text,
  p_proveedor text,
  p_proveedor_evento_id text,
  p_evidence_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_existing_recipient_id uuid;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_recipient
    FROM public.communication_recipients
   WHERE id = p_recipient_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_recipient.estado_entrega <> 'ENVIANDO'
     OR v_recipient.dispatch_attempt_id IS DISTINCT FROM p_dispatch_attempt_id
     OR v_recipient.provider_idempotency_key IS DISTINCT FROM p_idempotency_key THEN
    RETURN false;
  END IF;
  IF p_canal_usado IS DISTINCT FROM
       COALESCE(v_recipient.canal_usado, v_recipient.canal_primario) THEN
    RAISE EXCEPTION 'provider result channel differs from the claimed channel';
  END IF;
  IF (p_canal_usado IN ('EMAIL_NORMAL','EMAIL_CERTIFICADO') AND p_proveedor <> 'RESEND')
     OR (p_canal_usado = 'BUROFAX_ERDS' AND p_proveedor <> 'EAD_TRUST') THEN
    RAISE EXCEPTION 'provider does not match the claimed delivery channel';
  END IF;
  IF NULLIF(btrim(p_proveedor_evento_id), '') IS NULL THEN
    RAISE EXCEPTION 'provider event id required before marking SENT';
  END IF;
  IF p_evidence_hash IS NOT NULL AND p_evidence_hash !~ '^[0-9a-fA-F]{128}$' THEN
    RAISE EXCEPTION 'provider evidence hash must be SHA-512';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'PROVIDER:SENT:' || p_proveedor || ':' || btrim(p_proveedor_evento_id),
    0
  ));
  SELECT event.recipient_id
    INTO v_existing_recipient_id
    FROM public.communication_delivery_events event
   WHERE event.evento = 'SENT'
     AND event.proveedor = p_proveedor
     AND event.proveedor_evento_id = btrim(p_proveedor_evento_id)
   LIMIT 1;
  IF v_existing_recipient_id IS NOT NULL THEN
    RAISE EXCEPTION 'provider event id is already bound to recipient %',
      v_existing_recipient_id USING ERRCODE = '23505';
  END IF;
  UPDATE public.communication_recipients
     SET estado_entrega = 'ENVIADO',
         canal_usado = p_canal_usado,
         fecha_envio = now(),
         ultimo_error = NULL,
         acuse_evidence_hash = COALESCE(p_evidence_hash, acuse_evidence_hash),
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_recipient_id;
  INSERT INTO public.communication_delivery_events(
    recipient_id, evento, proveedor, proveedor_evento_id, payload, hash_self
  ) VALUES (
    p_recipient_id, 'SENT', p_proveedor, btrim(p_proveedor_evento_id),
    jsonb_build_object(
      'evidence_hash', p_evidence_hash,
      'dispatch_attempt_id', p_dispatch_attempt_id,
      'provider_idempotency_key', p_idempotency_key
    ), ''
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recipient_mark_reconciliation_required(
  p_recipient_id uuid,
  p_dispatch_attempt_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.communication_recipients
     SET estado_entrega = 'RECONCILIATION_REQUIRED',
         ultimo_error = p_reason,
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_recipient_id
     AND estado_entrega = 'ENVIANDO'
     AND dispatch_attempt_id = p_dispatch_attempt_id;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.communication_delivery_events(
    recipient_id, evento, proveedor, proveedor_evento_id, payload, hash_self
  ) VALUES (
    p_recipient_id, 'ERROR', COALESCE(p_provider, 'INTERNAL'), p_provider_event_id,
    jsonb_build_object(
      'reconciliation_required', true,
      'reason', p_reason,
      'dispatch_attempt_id', p_dispatch_attempt_id
    ), ''
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recipient_mark_ead_notice_result_attempt(
  p_recipient_id uuid,
  p_dispatch_attempt_id uuid,
  p_idempotency_key text,
  p_provider_request_id text,
  p_provider_event_id text,
  p_provider_status text,
  p_requested_at timestamptz,
  p_delivered_at timestamptz,
  p_earchive_status text,
  p_earchive_evidence_id text,
  p_earchive_archived_at timestamptz,
  p_earchive_hash_sha512 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient public.communication_recipients%ROWTYPE;
  v_communication public.communications%ROWTYPE;
  v_attachment_count integer;
  v_delivery_mode text;
  v_expected_archive_hash text;
  v_existing_recipient_id uuid;
  v_existing_requested_at timestamptz;
  v_provider_status text := upper(COALESCE(btrim(p_provider_status), ''));
  v_archive_status text := upper(COALESCE(NULLIF(btrim(p_earchive_status), ''), 'PENDING'));
  v_inserted_request boolean := false;
  v_inserted_delivery boolean := false;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  IF p_recipient_id IS NULL
     OR NULLIF(btrim(p_provider_request_id), '') IS NULL
     OR NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'EAD recipient, request id and idempotency key are required';
  END IF;
  IF v_provider_status NOT IN ('REQUESTED', 'DELIVERED') THEN
    RAISE EXCEPTION 'EAD provider status must be REQUESTED or DELIVERED';
  END IF;
  IF p_requested_at IS NULL OR p_requested_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD requested_at is missing or in the future';
  END IF;
  IF v_provider_status = 'DELIVERED'
     AND (
       NULLIF(btrim(p_provider_event_id), '') IS NULL
       OR p_delivered_at IS NULL
       OR p_delivered_at < p_requested_at
       OR p_delivered_at > now() + interval '5 minutes'
     ) THEN
    RAISE EXCEPTION 'DELIVERED requires a provider event id and consistent delivered_at';
  END IF;
  IF v_provider_status = 'REQUESTED' AND p_delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUESTED response cannot carry delivered_at';
  END IF;
  IF v_archive_status NOT IN ('PENDING', 'COMPLETED', 'ERROR') THEN
    RAISE EXCEPTION 'EAD e-archive status is invalid';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND (
       NULLIF(btrim(p_earchive_evidence_id), '') IS NULL
       OR p_earchive_archived_at IS NULL
       OR p_earchive_hash_sha512 IS NULL
     ) THEN
    RAISE EXCEPTION 'completed EAD e-archive requires evidence id, archived_at and exact SHA-512';
  END IF;
  IF p_earchive_archived_at IS NOT NULL
     AND (
       p_earchive_archived_at < p_requested_at
       OR p_earchive_archived_at > now() + interval '5 minutes'
     ) THEN
    RAISE EXCEPTION 'EAD e-archive archived_at is inconsistent';
  END IF;
  IF p_earchive_hash_sha512 IS NOT NULL
     AND p_earchive_hash_sha512 !~ '^[0-9a-fA-F]{128}$' THEN
    RAISE EXCEPTION 'EAD e-archive SHA-512 is invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('EAD:SENT:' || btrim(p_provider_request_id), 0)
  );
  SELECT recipient.*
    INTO v_recipient
    FROM public.communication_recipients recipient
    JOIN public.communications communication
      ON communication.id = recipient.communication_id
   WHERE recipient.id = p_recipient_id
   FOR UPDATE OF recipient;
  IF NOT FOUND
     OR v_recipient.estado_entrega <> 'ENVIANDO'
     OR v_recipient.dispatch_attempt_id IS DISTINCT FROM p_dispatch_attempt_id
     OR v_recipient.provider_idempotency_key IS DISTINCT FROM p_idempotency_key
     OR COALESCE(v_recipient.canal_usado, v_recipient.canal_primario) <> 'BUROFAX_ERDS' THEN
    RAISE EXCEPTION 'stale EAD dispatch attempt rejected' USING ERRCODE = '40001';
  END IF;
  SELECT communication.*
    INTO v_communication
    FROM public.communications communication
   WHERE communication.id = v_recipient.communication_id
   FOR SHARE;
  IF p_requested_at < v_communication.created_at - interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD requested_at predates the communication';
  END IF;
  SELECT count(*) INTO v_attachment_count
    FROM public.communication_attachments attachment
   WHERE attachment.communication_id = v_communication.id;
  v_delivery_mode := v_communication.metadata ->> 'ead_delivery_mode';
  IF v_delivery_mode = 'BASIC_MESSAGE' AND v_attachment_count = 0 THEN
    v_expected_archive_hash := v_communication.cuerpo_hash_sha512;
  ELSIF v_delivery_mode = 'PACKAGE_WITH_ATTACHMENTS' AND v_attachment_count > 0 THEN
    v_expected_archive_hash := v_communication.package_hash_sha512;
  ELSE
    RAISE EXCEPTION 'EAD delivery mode/attachment cardinality is inconsistent';
  END IF;
  IF v_expected_archive_hash !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'EAD expected archive hash is unavailable';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND lower(p_earchive_hash_sha512) IS DISTINCT FROM v_expected_archive_hash THEN
    RAISE EXCEPTION 'EAD completed e-archive hash differs from the exact message/package hash'
      USING ERRCODE = '23514';
  END IF;

  SELECT event.recipient_id, event.ocurrido_en
    INTO v_existing_recipient_id, v_existing_requested_at
    FROM public.communication_delivery_events event
   WHERE event.proveedor = 'EAD_TRUST'
     AND event.proveedor_evento_id = btrim(p_provider_request_id)
     AND event.evento = 'SENT'
   LIMIT 1;
  IF v_existing_recipient_id IS NOT NULL
     AND v_existing_recipient_id IS DISTINCT FROM p_recipient_id THEN
    RAISE EXCEPTION 'EAD provider request id is already bound to another recipient';
  END IF;
  IF v_existing_recipient_id IS NOT NULL
     AND v_existing_requested_at IS DISTINCT FROM p_requested_at THEN
    RAISE EXCEPTION 'EAD provider request id returned with a different requested_at';
  END IF;

  UPDATE public.communication_recipients
     SET estado_entrega = CASE
           WHEN v_provider_status = 'DELIVERED' THEN 'ENTREGADO'
           ELSE 'ENVIADO'
         END,
         canal_usado = 'BUROFAX_ERDS',
         fecha_envio = p_requested_at,
         fecha_entrega = CASE
           WHEN v_provider_status = 'DELIVERED' THEN p_delivered_at
           ELSE fecha_entrega
         END,
         acuse_evidence_hash = CASE
           WHEN v_archive_status = 'COMPLETED'
                AND p_earchive_hash_sha512 IS NOT NULL
             THEN lower(p_earchive_hash_sha512)
           ELSE acuse_evidence_hash
         END,
         ultimo_error = NULL,
         dispatch_attempt_id = NULL,
         dispatch_lease_expires_at = NULL,
         updated_at = now()
   WHERE id = p_recipient_id;

  IF v_existing_recipient_id IS NULL THEN
    INSERT INTO public.communication_delivery_events (
      recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
      payload, hash_self
    ) VALUES (
      p_recipient_id,
      'SENT',
      p_requested_at,
      'EAD_TRUST',
      btrim(p_provider_request_id),
      jsonb_build_object(
        'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
        'provider_status', 'REQUESTED',
        'provider_response_status', v_provider_status,
        'provider_request_id', btrim(p_provider_request_id),
        'provider_event_id', NULLIF(btrim(p_provider_event_id), ''),
        'provider_requested_at', p_requested_at,
        'provider_idempotency_key', p_idempotency_key,
        'dispatch_attempt_id', p_dispatch_attempt_id,
        'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
        'earchive_status', v_archive_status,
        'earchive_evidence_id', NULLIF(btrim(p_earchive_evidence_id), ''),
        'earchive_archived_at', p_earchive_archived_at,
        'earchive_hash_sha512', lower(p_earchive_hash_sha512)
      ),
      ''
    );
    v_inserted_request := true;
  END IF;

  IF v_provider_status = 'DELIVERED'
     AND NOT EXISTS (
       SELECT 1
         FROM public.communication_delivery_events event
        WHERE event.recipient_id = p_recipient_id
          AND event.proveedor = 'EAD_TRUST'
          AND event.evento = 'DELIVERED'
          AND event.payload ->> 'provider_request_id' = btrim(p_provider_request_id)
     ) THEN
    INSERT INTO public.communication_delivery_events (
      recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
      payload, hash_self
    ) VALUES (
      p_recipient_id,
      'DELIVERED',
      p_delivered_at,
      'EAD_TRUST',
      btrim(p_provider_event_id),
      jsonb_build_object(
        'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
        'provider_status', 'DELIVERED',
        'provider_request_id', btrim(p_provider_request_id),
        'provider_event_id', btrim(p_provider_event_id),
        'provider_requested_at', p_requested_at,
        'provider_delivered_at', p_delivered_at,
        'provider_idempotency_key', p_idempotency_key,
        'dispatch_attempt_id', p_dispatch_attempt_id,
        'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
        'earchive_status', v_archive_status,
        'earchive_evidence_id', NULLIF(btrim(p_earchive_evidence_id), ''),
        'earchive_archived_at', p_earchive_archived_at,
        'earchive_hash_sha512', lower(p_earchive_hash_sha512)
      ),
      ''
    );
    v_inserted_delivery := true;
  END IF;

  RETURN jsonb_build_object(
    'recipient_id', p_recipient_id,
    'provider_request_id', btrim(p_provider_request_id),
    'provider_status', v_provider_status,
    'requested_recorded', v_inserted_request,
    'delivery_recorded', v_inserted_delivery,
    'earchive_status', v_archive_status
  );
END;
$function$;

-- The asynchronous Notice Manager callback is a second persistence path for
-- Evidence Manager facts. It must enforce the same exact-hash rule as the
-- fenced dispatcher response, including on idempotent/replayed callbacks.
CREATE OR REPLACE FUNCTION public.fn_recipient_record_ead_notice_callback(
  p_provider_request_id text,
  p_provider_event_id text,
  p_event_status text,
  p_occurred_at timestamptz,
  p_delivered_at timestamptz,
  p_earchive_status text,
  p_earchive_evidence_id text,
  p_earchive_archived_at timestamptz,
  p_earchive_hash_sha512 text,
  p_provider_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient_id uuid;
  v_recipient_state text;
  v_communication public.communications%ROWTYPE;
  v_requested_at timestamptz;
  v_attachment_count integer;
  v_delivery_mode text;
  v_expected_archive_hash text;
  v_event_status text := upper(COALESCE(btrim(p_event_status), ''));
  v_archive_status text := upper(COALESCE(NULLIF(btrim(p_earchive_status), ''), 'PENDING'));
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_provider_request_id), '') IS NULL
     OR NULLIF(btrim(p_provider_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'EAD callback request/event id required';
  END IF;
  IF v_event_status NOT IN ('DELIVERED', 'ERROR') THEN
    RAISE EXCEPTION 'EAD callback status must be DELIVERED or ERROR';
  END IF;
  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD callback occurred_at missing or in the future';
  END IF;
  IF v_event_status = 'DELIVERED'
     AND (p_delivered_at IS NULL OR p_delivered_at > now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'EAD delivery callback requires a valid delivered_at';
  END IF;
  IF v_event_status = 'ERROR' AND p_delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'EAD failure callback cannot carry delivered_at';
  END IF;
  IF v_archive_status NOT IN ('PENDING', 'COMPLETED', 'ERROR') THEN
    RAISE EXCEPTION 'EAD callback archive status is invalid';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND (
       NULLIF(btrim(p_earchive_evidence_id), '') IS NULL
       OR p_earchive_archived_at IS NULL
       OR p_earchive_hash_sha512 IS NULL
     ) THEN
    RAISE EXCEPTION 'completed callback e-archive requires evidence id, archived_at and exact SHA-512';
  END IF;
  IF p_earchive_archived_at IS NOT NULL
     AND p_earchive_archived_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'EAD callback e-archive archived_at is in the future';
  END IF;
  IF p_earchive_hash_sha512 IS NOT NULL
     AND p_earchive_hash_sha512 !~ '^[0-9a-fA-F]{128}$' THEN
    RAISE EXCEPTION 'EAD callback e-archive SHA-512 is invalid';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('EAD:EVENT:' || btrim(p_provider_event_id), 0)
  );
  SELECT event.recipient_id, event.ocurrido_en
    INTO v_recipient_id, v_requested_at
    FROM public.communication_delivery_events event
   WHERE event.proveedor = 'EAD_TRUST'
     AND event.proveedor_evento_id = btrim(p_provider_request_id)
     AND event.evento = 'SENT'
   LIMIT 1;
  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'EAD callback request id is not bound to a recorded provider request';
  END IF;

  SELECT recipient.estado_entrega
    INTO v_recipient_state
    FROM public.communication_recipients recipient
   WHERE recipient.id = v_recipient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD callback recipient no longer exists';
  END IF;
  SELECT communication.*
    INTO v_communication
    FROM public.communications communication
    JOIN public.communication_recipients recipient
      ON recipient.communication_id = communication.id
   WHERE recipient.id = v_recipient_id
   FOR SHARE OF communication;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EAD callback communication no longer exists';
  END IF;
  SELECT count(*) INTO v_attachment_count
    FROM public.communication_attachments attachment
   WHERE attachment.communication_id = v_communication.id;
  v_delivery_mode := v_communication.metadata ->> 'ead_delivery_mode';
  IF v_delivery_mode = 'BASIC_MESSAGE' AND v_attachment_count = 0 THEN
    v_expected_archive_hash := v_communication.cuerpo_hash_sha512;
  ELSIF v_delivery_mode = 'PACKAGE_WITH_ATTACHMENTS' AND v_attachment_count > 0 THEN
    v_expected_archive_hash := v_communication.package_hash_sha512;
  ELSE
    RAISE EXCEPTION 'EAD callback delivery mode/attachment cardinality is inconsistent';
  END IF;
  IF v_expected_archive_hash !~ '^[0-9a-f]{128}$' THEN
    RAISE EXCEPTION 'EAD callback expected archive hash is unavailable';
  END IF;
  IF v_archive_status = 'COMPLETED'
     AND lower(p_earchive_hash_sha512) IS DISTINCT FROM v_expected_archive_hash THEN
    RAISE EXCEPTION 'EAD callback archive hash differs from the exact message/package hash'
      USING ERRCODE = '23514';
  END IF;

  IF p_occurred_at < v_requested_at
     OR (
       p_delivered_at IS NOT NULL
       AND (
         p_delivered_at < v_requested_at
         OR p_delivered_at > p_occurred_at + interval '5 minutes'
       )
     )
     OR (
       p_earchive_archived_at IS NOT NULL
       AND p_earchive_archived_at < v_requested_at
     ) THEN
    RAISE EXCEPTION 'EAD callback chronology is inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.communication_delivery_events event
     WHERE event.proveedor = 'EAD_TRUST'
       AND event.proveedor_evento_id = btrim(p_provider_event_id)
       AND event.evento = CASE
         WHEN v_event_status = 'DELIVERED' THEN 'DELIVERED'
         ELSE 'ERROR'
       END
  ) THEN
    RETURN jsonb_build_object(
      'recipient_id', v_recipient_id,
      'provider_request_id', btrim(p_provider_request_id),
      'provider_event_id', btrim(p_provider_event_id),
      'provider_status', v_event_status,
      'already_recorded', true
    );
  END IF;

  IF v_event_status = 'DELIVERED' THEN
    UPDATE public.communication_recipients
       SET estado_entrega = CASE
             WHEN estado_entrega IN ('ENTREGADO','LEIDO','RESPONDIDO')
               THEN estado_entrega
             ELSE 'ENTREGADO'
           END,
           fecha_entrega = COALESCE(fecha_entrega, p_delivered_at),
           acuse_evidence_hash = CASE
             WHEN v_archive_status = 'COMPLETED'
               THEN lower(p_earchive_hash_sha512)
             ELSE acuse_evidence_hash
           END,
           ultimo_error = NULL,
           updated_at = now()
     WHERE id = v_recipient_id;
  ELSIF v_recipient_state NOT IN ('ENTREGADO','LEIDO','RESPONDIDO') THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'ERROR',
           ultimo_error = COALESCE(
             NULLIF(p_provider_payload ->> 'error', ''),
             'EAD Notice Manager reported delivery failure'
           ),
           updated_at = now()
     WHERE id = v_recipient_id;
  END IF;

  INSERT INTO public.communication_delivery_events (
    recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
    payload, hash_self
  ) VALUES (
    v_recipient_id,
    CASE WHEN v_event_status = 'DELIVERED' THEN 'DELIVERED' ELSE 'ERROR' END,
    CASE WHEN v_event_status = 'DELIVERED' THEN p_delivered_at ELSE p_occurred_at END,
    'EAD_TRUST',
    btrim(p_provider_event_id),
    COALESCE(p_provider_payload, '{}'::jsonb) || jsonb_build_object(
      'provider_service', 'EAD_TRUST_NOTICE_MANAGER',
      'provider_status', v_event_status,
      'provider_request_id', btrim(p_provider_request_id),
      'provider_event_id', btrim(p_provider_event_id),
      'provider_occurred_at', p_occurred_at,
      'provider_delivered_at', p_delivered_at,
      'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER',
      'earchive_status', v_archive_status,
      'earchive_evidence_id', NULLIF(btrim(p_earchive_evidence_id), ''),
      'earchive_archived_at', p_earchive_archived_at,
      'earchive_hash_sha512', lower(p_earchive_hash_sha512)
    ),
    ''
  );

  RETURN jsonb_build_object(
    'recipient_id', v_recipient_id,
    'provider_request_id', btrim(p_provider_request_id),
    'provider_event_id', btrim(p_provider_event_id),
    'provider_status', v_event_status,
    'already_recorded', false,
    'terminal_delivery_preserved',
      v_recipient_state IN ('ENTREGADO','LEIDO','RESPONDIDO'),
    'earchive_status', v_archive_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recipient_record_resend_callback(
  p_provider_message_id text,
  p_provider_event_id text,
  p_event_status text,
  p_occurred_at timestamptz,
  p_provider_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_recipient_id uuid;
  v_recipient_state text;
  v_sent_at timestamptz;
  v_binding_count integer;
  v_event_status text := upper(COALESCE(btrim(p_event_status), ''));
  v_event_name text;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_provider_message_id), '') IS NULL
     OR NULLIF(btrim(p_provider_event_id), '') IS NULL THEN
    RAISE EXCEPTION 'Resend provider message id and callback event id are required';
  END IF;
  IF v_event_status NOT IN (
    'SENT','DELIVERED','BOUNCED','COMPLAINED','OPENED','CLICKED'
  ) THEN
    RAISE EXCEPTION 'unsupported Resend callback status';
  END IF;
  IF p_occurred_at IS NULL OR p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Resend callback occurred_at is missing or in the future';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('RESEND:EVENT:' || btrim(p_provider_event_id), 0)
  );
  SELECT count(DISTINCT event.recipient_id)
    INTO v_binding_count
    FROM public.communication_delivery_events event
   WHERE event.proveedor = 'RESEND'
     AND event.proveedor_evento_id = btrim(p_provider_message_id)
     AND event.evento = 'SENT';
  IF v_binding_count <> 1 THEN
    RAISE EXCEPTION 'Resend callback message id has no unique recipient binding';
  END IF;
  SELECT event.recipient_id, event.ocurrido_en
    INTO v_recipient_id, v_sent_at
    FROM public.communication_delivery_events event
   WHERE event.proveedor = 'RESEND'
     AND event.proveedor_evento_id = btrim(p_provider_message_id)
     AND event.evento = 'SENT'
   ORDER BY event.ocurrido_en
   LIMIT 1;
  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'Resend callback is not bound to a recorded provider send';
  END IF;
  IF p_occurred_at < v_sent_at - interval '5 minutes' THEN
    RAISE EXCEPTION 'Resend callback chronology is inconsistent';
  END IF;

  -- Dispatcher already persisted the authoritative SENT fact. The provider's
  -- sent webhook is acknowledgement-only and must not duplicate that ledger row.
  IF v_event_status = 'SENT' THEN
    RETURN jsonb_build_object(
      'recipient_id', v_recipient_id,
      'provider_message_id', btrim(p_provider_message_id),
      'provider_event_id', btrim(p_provider_event_id),
      'provider_status', v_event_status,
      'already_recorded', true
    );
  END IF;

  v_event_name := v_event_status;
  IF EXISTS (
    SELECT 1
      FROM public.communication_delivery_events event
     WHERE event.proveedor = 'RESEND'
       AND event.proveedor_evento_id = btrim(p_provider_event_id)
       AND event.evento = v_event_name
  ) THEN
    RETURN jsonb_build_object(
      'recipient_id', v_recipient_id,
      'provider_message_id', btrim(p_provider_message_id),
      'provider_event_id', btrim(p_provider_event_id),
      'provider_status', v_event_status,
      'already_recorded', true
    );
  END IF;

  SELECT recipient.estado_entrega
    INTO v_recipient_state
    FROM public.communication_recipients recipient
   WHERE recipient.id = v_recipient_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resend callback recipient no longer exists';
  END IF;

  -- Never downgrade a terminal delivered/read/responded fact on a late bounce.
  IF v_event_status = 'DELIVERED'
     AND v_recipient_state NOT IN ('ENTREGADO','LEIDO','RESPONDIDO') THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'ENTREGADO',
           fecha_entrega = p_occurred_at,
           ultimo_error = NULL,
           dispatch_attempt_id = NULL,
           dispatch_lease_expires_at = NULL,
           updated_at = now()
     WHERE id = v_recipient_id;
  ELSIF v_event_status = 'BOUNCED'
        AND v_recipient_state NOT IN ('ENTREGADO','LEIDO','RESPONDIDO') THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'REBOTADO',
           ultimo_error = COALESCE(
             NULLIF(p_provider_payload ->> 'error', ''),
             'Resend reported a bounce'
           ),
           dispatch_attempt_id = NULL,
           dispatch_lease_expires_at = NULL,
           updated_at = now()
     WHERE id = v_recipient_id;
  ELSIF v_event_status IN ('OPENED','CLICKED')
        AND v_recipient_state NOT IN ('LEIDO','RESPONDIDO') THEN
    UPDATE public.communication_recipients
       SET estado_entrega = 'LEIDO',
           fecha_entrega = COALESCE(fecha_entrega, p_occurred_at),
           fecha_lectura = p_occurred_at,
           ultimo_error = NULL,
           dispatch_attempt_id = NULL,
           dispatch_lease_expires_at = NULL,
           updated_at = now()
     WHERE id = v_recipient_id;
  END IF;

  INSERT INTO public.communication_delivery_events (
    recipient_id, evento, ocurrido_en, proveedor, proveedor_evento_id,
    payload, hash_self
  ) VALUES (
    v_recipient_id,
    v_event_name,
    p_occurred_at,
    'RESEND',
    btrim(p_provider_event_id),
    COALESCE(p_provider_payload, '{}'::jsonb) || jsonb_build_object(
      'provider_service', 'RESEND',
      'provider_message_id', btrim(p_provider_message_id),
      'provider_callback_event_id', btrim(p_provider_event_id),
      'provider_status', v_event_status,
      'provider_occurred_at', p_occurred_at,
      'terminal_delivery_preserved',
        v_recipient_state IN ('ENTREGADO','LEIDO','RESPONDIDO')
    ),
    ''
  );

  RETURN jsonb_build_object(
    'recipient_id', v_recipient_id,
    'provider_message_id', btrim(p_provider_message_id),
    'provider_event_id', btrim(p_provider_event_id),
    'provider_status', v_event_status,
    'already_recorded', false,
    'terminal_delivery_preserved',
      v_recipient_state IN ('ENTREGADO','LEIDO','RESPONDIDO')
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RLS y privilegios: las mutaciones pasan por RPC estrecha
-- ---------------------------------------------------------------------------

ALTER TABLE public.convocation_artifact_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS convocation_artifact_candidates_read
  ON public.convocation_artifact_candidates;
CREATE POLICY convocation_artifact_candidates_read
  ON public.convocation_artifact_candidates
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_assert_current_tenant_id());

REVOKE ALL ON TABLE public.convocation_artifact_candidates FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.convocation_artifact_candidates
  FROM authenticated;
GRANT SELECT ON TABLE public.convocation_artifact_candidates TO authenticated;

DROP POLICY IF EXISTS attachments_support_insert ON public.attachments;
DROP POLICY IF EXISTS attachments_support_update ON public.attachments;
DROP POLICY IF EXISTS attachments_support_delete ON public.attachments;
DROP POLICY IF EXISTS communications_staff_insert ON public.communications;
DROP POLICY IF EXISTS communications_staff_update ON public.communications;
DROP POLICY IF EXISTS recipients_staff_insert ON public.communication_recipients;
DROP POLICY IF EXISTS recipients_staff_update ON public.communication_recipients;
DROP POLICY IF EXISTS recipients_staff_delete ON public.communication_recipients;
DROP POLICY IF EXISTS communication_attachments_staff_insert ON public.communication_attachments;
DROP POLICY IF EXISTS communication_attachments_staff_update ON public.communication_attachments;
DROP POLICY IF EXISTS communication_attachments_staff_delete ON public.communication_attachments;
DROP POLICY IF EXISTS attachments_staff_insert ON public.communication_attachments;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.attachments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.communications FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.communication_recipients FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.communication_attachments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.communication_delivery_events FROM authenticated;

REVOKE ALL ON FUNCTION public.fn_secretaria_assert_communication_operator(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_precommit_convocation_final_candidate(
  uuid, uuid, text, text, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_precommit_convocation_final_candidate(
  uuid, uuid, text, text, text, text, text, jsonb
) TO authenticated;
REVOKE ALL ON FUNCTION public.fn_convocation_artifact_candidate_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_prepare_census(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_compute_package_hash(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_census_binding_valid(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_authoritative_binding_valid_201320(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_communication_base_binding_without_recipient_directory(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_communication_atomic(jsonb, jsonb, jsonb)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_program_communication(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_cancel_communication(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_retry_communication_recipient(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_program_communication(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancel_communication(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_retry_communication_recipient(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_revalidate_recipient_dispatch_attempt(
  uuid, uuid, uuid, text, bigint, text, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_handle_error_attempt(uuid, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_mark_sent_attempt(
  uuid, uuid, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_mark_reconciliation_required(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_mark_ead_notice_result_attempt(
  uuid, uuid, text, text, text, text, timestamptz, timestamptz,
  text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz,
  text, text, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_recipient_record_resend_callback(
  text, text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_revalidate_recipient_dispatch_attempt(
  uuid, uuid, uuid, text, bigint, text, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_handle_error_attempt(uuid, uuid, text, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_mark_sent_attempt(
  uuid, uuid, text, text, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_mark_reconciliation_required(
  uuid, uuid, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_mark_ead_notice_result_attempt(
  uuid, uuid, text, text, text, text, timestamptz, timestamptz,
  text, text, timestamptz, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_record_ead_notice_callback(
  text, text, text, timestamptz, timestamptz,
  text, text, timestamptz, text, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recipient_record_resend_callback(
  text, text, text, timestamptz, jsonb
) TO service_role;

-- Las versiones sin fencing token dejan de ser superficies validas.
REVOKE ALL ON FUNCTION public.fn_recipient_mark_sent(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_recipient_handle_error(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_revalidate_recipient_dispatch(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_recipient_mark_ead_notice_result(
  uuid, text, text, text, timestamptz, timestamptz, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_claim_recipients_for_dispatch(integer, uuid) IS
  'Claims with a fencing token, stable provider idempotency key and finite lease; expired leases enter RECONCILIATION_REQUIRED and are never resent automatically.';
COMMENT ON FUNCTION public.fn_register_verified_convocation_attachment(
  uuid, uuid, text, integer, text, text, text, text, bigint, text, text, uuid
) IS
  'Service-only persistence boundary after Edge rehash; final DOCX additionally requires and atomically consumes an exact human-reviewed precommitment.';

COMMIT;
