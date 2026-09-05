-- Terminal registral por vía de procedimiento.
--
-- El ciclo v2 (20260719130000) tenía un único terminal de éxito, INSCRITA, para
-- las tres vías que el cliente ya distingue en `procedure_profile_code`:
-- acto inscribible, depósito de cuentas y legalización de libros. Un depósito
-- completado quedaba marcado «Inscrita», que es falso: el depósito de cuentas
-- (arts. 279 y ss. LSC, 365 y ss. RRM) no causa inscripción, y la legalización
-- de libros (arts. 329 y ss. RRM) tampoco.
--
-- Forward-only y aditiva: no reinterpreta ninguna fila. Verificado antes de
-- aplicar que en Cloud no hay ningún expediente en terminal ni ningún evento
-- INSCRIPCION_ACREDITADA, de modo que no hay backfill ni riesgo de replay
-- idempotente contra un tipo de evento distinto.

BEGIN;

-- 1. Vocabulario de estado v2: dos terminales nuevos junto a INSCRITA.
ALTER TABLE public.registry_filings
  DROP CONSTRAINT IF EXISTS registry_filings_v2_status_check;
ALTER TABLE public.registry_filings
  ADD CONSTRAINT registry_filings_v2_status_check
  CHECK (
    workflow_version = 1
    OR status IN (
      'PREPARADA',
      'ELEVADA',
      'PRESENTADA',
      'SUBSANACION',
      'DENEGADA',
      'INSCRITA',
      'DEPOSITADA',
      'LEGALIZADA',
      'PUBLICADA'
    )
  );

-- 2. Tipos de evento: el rastro WORM no puede llamar «inscripción» a un depósito.
ALTER TABLE public.registry_filing_events
  DROP CONSTRAINT IF EXISTS registry_filing_events_event_type_check;
ALTER TABLE public.registry_filing_events
  ADD CONSTRAINT registry_filing_events_event_type_check
  CHECK (event_type IN (
    'EXPEDIENTE_PREPARADO',
    'DOCUMENTO_BASE_VINCULADO',
    'PRESENTACION_ASENTADA',
    'CALIFICACION_REGISTRADA',
    'SUBSANACION_PREPARADA',
    'SUBSANACION_PRESENTADA',
    'INSCRIPCION_ACREDITADA',
    'DEPOSITO_ACREDITADO',
    'LEGALIZACION_ACREDITADA',
    'PUBLICACION_ACREDITADA'
  ));

-- 3. El terminal lo decide la vía, no el nombre de la RPC.
--    CREATE OR REPLACE conserva los GRANT/REVOKE del lockdown 20260719180000
--    porque la firma no cambia.
CREATE OR REPLACE FUNCTION public.fn_registry_record_inscription(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_inscription_number text,
  p_registered_at timestamptz,
  p_evidence_artifact_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
  v_profile text;
  v_to_status text;
  v_event_type text;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR NULLIF(btrim(p_inscription_number), '') IS NULL
    OR p_registered_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'operation, inscription number and date are required';
  END IF;

  -- Lectura sin bloqueo, solo para resolver la vía antes de comprobar la
  -- idempotencia: el tipo de evento esperado depende de ella. El SELECT ... FOR
  -- UPDATE autoritativo sigue ocurriendo después, en el mismo orden que antes.
  SELECT filing.procedure_profile_code
  INTO v_profile
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id;

  v_to_status := CASE upper(btrim(coalesce(v_profile, '')))
    WHEN 'DEPOSITO_CUENTAS'    THEN 'DEPOSITADA'
    WHEN 'LEGALIZACION_LIBROS' THEN 'LEGALIZADA'
    ELSE 'INSCRITA'
  END;
  v_event_type := CASE v_to_status
    WHEN 'DEPOSITADA' THEN 'DEPOSITO_ACREDITADO'
    WHEN 'LEGALIZADA' THEN 'LEGALIZACION_ACREDITADA'
    ELSE 'INSCRIPCION_ACREDITADA'
  END;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'inscription_number', btrim(p_inscription_number),
      'registered_at_epoch', extract(epoch FROM p_registered_at),
      'evidence_artifact_id', p_evidence_artifact_id
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    v_event_type,
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    true
  );

  IF v_before.status <> 'PRESENTADA'
    OR v_before.qualification_outcome <> 'POSITIVA' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'a positive qualification is required before inscription';
  END IF;

  UPDATE registry_filings AS filing
  SET inscription_number = btrim(p_inscription_number),
      registered_at = p_registered_at,
      status = v_to_status,
      resolution_document_url = (
        SELECT artifact.document_url
        FROM public.secretaria_document_artifacts AS artifact
        WHERE artifact.id = p_evidence_artifact_id
          AND artifact.tenant_id = p_tenant_id
          AND artifact.entity_id = v_before.entity_id
      ),
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'inscription expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    v_event_type,
    v_before.status,
    v_to_status,
    v_state_version,
    p_registered_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_build_object(
      'inscription_number', btrim(p_inscription_number),
      'procedure_profile_code', v_profile
    )
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', v_to_status,
    'state_version', v_state_version
  );
END;
$function$;

-- 4. La publicación acredita el anuncio de cualquiera de los tres terminales.
--    Sin esto, DEPOSITADA y LEGALIZADA serían callejones sin salida donde antes
--    (mal etiquetado como INSCRITA) sí había continuación.
CREATE OR REPLACE FUNCTION public.fn_registry_record_publication(
  p_tenant_id uuid,
  p_filing_id uuid,
  p_operation_id uuid,
  p_publication_reference text,
  p_published_at timestamptz,
  p_evidence_artifact_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_existing jsonb;
  v_before public.registry_filings%ROWTYPE;
  v_event_id uuid;
  v_state_version bigint;
  v_request_fingerprint text;
  v_affected integer;
BEGIN
  PERFORM public.fn_registry_assert_writer(p_tenant_id);

  IF p_operation_id IS NULL
    OR NULLIF(btrim(p_publication_reference), '') IS NULL
    OR p_published_at IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'operation, publication reference and date are required';
  END IF;

  v_request_fingerprint := public.fn_registry_request_fingerprint(
    jsonb_build_object(
      'filing_id', p_filing_id,
      'publication_reference', btrim(p_publication_reference),
      'published_at_epoch', extract(epoch FROM p_published_at),
      'evidence_artifact_id', p_evidence_artifact_id
    )
  );
  v_existing := public.fn_registry_existing_operation(
    p_tenant_id,
    p_operation_id,
    'PUBLICACION_ACREDITADA',
    p_filing_id,
    v_request_fingerprint
  );
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT filing.*
  INTO v_before
  FROM public.registry_filings AS filing
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_before.workflow_version <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'v2 filing not found';
  END IF;

  PERFORM public.fn_registry_assert_artifact(
    p_tenant_id,
    v_before.entity_id,
    p_evidence_artifact_id,
    false,
    true
  );

  IF v_before.status NOT IN ('INSCRITA', 'DEPOSITADA', 'LEGALIZADA') THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'only a filing with an accredited registral outcome can record publication';
  END IF;

  UPDATE registry_filings AS filing
  SET publication_reference = btrim(p_publication_reference),
      published_at = p_published_at,
      status = 'PUBLICADA',
      state_version = filing.state_version + 1,
      updated_at = now()
  WHERE filing.id = p_filing_id
    AND filing.tenant_id = p_tenant_id
    AND filing.state_version = v_before.state_version;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'publication expected exactly one affected filing';
  END IF;

  v_state_version := v_before.state_version + 1;
  v_event_id := public.fn_registry_emit_event(
    p_tenant_id,
    p_filing_id,
    p_operation_id,
    'PUBLICACION_ACREDITADA',
    v_before.status,
    'PUBLICADA',
    v_state_version,
    p_published_at,
    p_evidence_artifact_id,
    v_request_fingerprint,
    jsonb_build_object('publication_reference', btrim(p_publication_reference))
  );

  RETURN jsonb_build_object(
    'affected_count', 1,
    'idempotent_replay', false,
    'filing_id', p_filing_id,
    'event_id', v_event_id,
    'status', 'PUBLICADA',
    'state_version', v_state_version
  );
END;
$function$;

COMMENT ON COLUMN public.registry_filings.procedure_profile_code IS
  'Vía registral del expediente. Decide el terminal de éxito del ciclo v2: DEPOSITO_CUENTAS -> DEPOSITADA, LEGALIZACION_LIBROS -> LEGALIZADA, resto -> INSCRITA. Un depósito o una legalización nunca causan inscripción.';

-- Self-verify.
DO $verify$
DECLARE
  v_status_def text;
  v_event_def text;
  v_src text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_status_def
  FROM pg_constraint
  WHERE conrelid = 'public.registry_filings'::regclass
    AND conname = 'registry_filings_v2_status_check';
  IF v_status_def IS NULL
    OR v_status_def NOT LIKE '%DEPOSITADA%'
    OR v_status_def NOT LIKE '%LEGALIZADA%'
    OR v_status_def NOT LIKE '%INSCRITA%' THEN
    RAISE EXCEPTION 'verificación fallida: el CHECK de estado v2 no admite los tres terminales';
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_event_def
  FROM pg_constraint
  WHERE conrelid = 'public.registry_filing_events'::regclass
    AND conname = 'registry_filing_events_event_type_check';
  IF v_event_def IS NULL
    OR v_event_def NOT LIKE '%DEPOSITO_ACREDITADO%'
    OR v_event_def NOT LIKE '%LEGALIZACION_ACREDITADA%' THEN
    RAISE EXCEPTION 'verificación fallida: el CHECK de tipo de evento no admite depósito ni legalización';
  END IF;

  SELECT p.prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_registry_record_inscription';
  IF v_src IS NULL
    OR v_src NOT LIKE '%DEPOSITO_CUENTAS%'
    OR v_src NOT LIKE '%LEGALIZACION_LIBROS%'
    OR v_src LIKE '%status = ''INSCRITA''%' THEN
    RAISE EXCEPTION 'verificación fallida: la RPC de inscripción no resuelve el terminal por vía';
  END IF;

  SELECT p.prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_registry_record_publication';
  IF v_src IS NULL OR v_src NOT LIKE '%DEPOSITADA%' THEN
    RAISE EXCEPTION 'verificación fallida: la publicación no admite los terminales nuevos';
  END IF;
END $verify$;

COMMIT;
