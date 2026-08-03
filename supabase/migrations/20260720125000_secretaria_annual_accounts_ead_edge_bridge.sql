-- Bridge transaccional para el handler server-side de cuentas anuales.
--
-- La migración 20260720122200 define el modelo jurídico WORM: set inmutable,
-- roster de administradores, resultado individual y artefacto FINAL_ARCHIVED.
-- Este bridge no relaja ninguno de esos gates. Limita service_role a dos
-- operaciones verificables que el Edge ejecuta después de consultar EAD Trust:
--   1) fijar el SIGNED_OUTPUT real por cada firmante de una solicitud;
--   2) registrar el e-archive final únicamente con el roster ya resuelto.
--
-- INTERPOSITION es el nivel suficiente y por defecto. ADVANCED se conserva
-- como opción del proveedor; nunca se eleva localmente el nivel de firma.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_secretaria_reconcile_annual_accounts_ead_bundle(
  p_annual_accounts_set_id uuid,
  p_signature_request_id uuid,
  p_storage_path text,
  p_storage_object_id text,
  p_storage_version text,
  p_signed_output_hash_sha256 text,
  p_signed_output_hash_sha512 text,
  p_provider_signature_type text,
  p_signature_packaging text,
  p_completion_certificate_ref text,
  p_completion_package_ref text,
  p_certificate_fingerprint_sha256 text,
  p_completion_package_fingerprint_sha256 text,
  p_signed_at timestamptz,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_roster public.secretaria_annual_accounts_signer_rosters%ROWTYPE;
  v_request public.qtsp_signature_requests%ROWTYPE;
  v_existing_bundle public.evidence_bundles%ROWTYPE;
  v_head public.secretaria_annual_accounts_signer_outcomes%ROWTYPE;
  v_signer jsonb;
  v_expected_signer_id uuid;
  v_bundle_id uuid;
  v_manifest jsonb;
  v_manifest_hash text;
  v_provider_requested_at timestamptz;
  v_provider_signed_at timestamptz;
  v_provider_completed_at timestamptz;
  v_storage_retrieved_at timestamptz;
  v_outcome jsonb;
  v_outcomes jsonb := '[]'::jsonb;
  v_provider_signer_outcomes jsonb := '[]'::jsonb;
  v_provider_signer_outcome jsonb;
  v_provider_signer_outcome_count integer := 0;
  v_unresolved_provider_signer_count integer := 0;
  v_expected_count integer;
  v_resolved_count integer;
  v_signature_state jsonb := NULL;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'annual accounts EAD reconciliation requires service_role'
      USING ERRCODE = '42501';
  END IF;

  p_provider_signature_type := upper(COALESCE(btrim(p_provider_signature_type), ''));
  p_signature_packaging := upper(COALESCE(btrim(p_signature_packaging), ''));
  p_signed_output_hash_sha256 := lower(COALESCE(btrim(p_signed_output_hash_sha256), ''));
  p_signed_output_hash_sha512 := lower(COALESCE(btrim(p_signed_output_hash_sha512), ''));
  p_certificate_fingerprint_sha256 := lower(COALESCE(btrim(p_certificate_fingerprint_sha256), ''));
  p_completion_package_fingerprint_sha256 := lower(COALESCE(btrim(p_completion_package_fingerprint_sha256), ''));

  SELECT set_row.* INTO v_set
    FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.id = p_annual_accounts_set_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     );
  IF NOT FOUND
     OR v_set.approval_status <> 'APPROVED'
     OR v_set.immutability_status <> 'IMMUTABLE'
     OR v_set.manifest_hash_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'annual accounts EAD reconciliation requires the current immutable approved set';
  END IF;

  SELECT * INTO v_roster
    FROM public.secretaria_annual_accounts_signer_rosters
   WHERE tenant_id = v_set.tenant_id
     AND annual_accounts_set_id = v_set.id;
  IF NOT FOUND
     OR encode(digest(v_roster.roster_manifest::text, 'sha256'), 'hex') <> v_roster.roster_hash_sha256 THEN
    RAISE EXCEPTION 'annual accounts EAD reconciliation requires the valid frozen WORM roster';
  END IF;

  SELECT * INTO v_request
    FROM public.qtsp_signature_requests
   WHERE id = p_signature_request_id
     AND tenant_id = v_set.tenant_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_request.sr_status <> 'COMPLETED'
     OR v_request.completed_at IS NULL
     OR v_request.source_domain <> 'ANNUAL_ACCOUNTS'
     OR v_request.source_id <> v_set.id
     OR v_request.artifact_kind <> 'ANNUAL_ACCOUNTS_EXECUTION'
     OR lower(COALESCE(v_request.content_hash_sha256, '')) <> v_set.manifest_hash_sha256
     OR lower(COALESCE(v_request.document_hash, '')) !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(v_request.sr_id), '') = ''
     OR COALESCE(btrim(v_request.document_id), '') = ''
     OR upper(COALESCE(v_request.evidence_status, '')) LIKE '%SANDBOX%'
     OR jsonb_typeof(v_request.signatories) <> 'array'
     OR jsonb_array_length(v_request.signatories) = 0 THEN
    RAISE EXCEPTION 'annual accounts EAD request is not a completed source-bound provider request';
  END IF;

  IF p_provider_signature_type NOT IN ('INTERPOSITION', 'ADVANCED')
     OR p_signature_packaging NOT IN ('ENVELOPED', 'DETACHED', 'PROVIDER_ATTESTATION')
     OR p_signed_output_hash_sha256 !~ '^[0-9a-f]{64}$'
     OR p_signed_output_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR p_certificate_fingerprint_sha256 !~ '^[0-9a-f]{64}$'
     OR p_completion_package_fingerprint_sha256 !~ '^[0-9a-f]{64}$'
     OR COALESCE(btrim(p_storage_path), '') = ''
     OR p_storage_path LIKE 'http%'
     OR p_storage_path LIKE '%..%'
     OR COALESCE(btrim(p_storage_object_id), '') = ''
     OR COALESCE(btrim(p_storage_version), '') = ''
     OR COALESCE(btrim(p_completion_certificate_ref), '') !~ '^https://'
     OR COALESCE(btrim(p_completion_package_ref), '') !~ '^https://' THEN
    RAISE EXCEPTION 'annual accounts EAD reconciliation lacks canonical provider packaging, hashes or storage';
  END IF;
  IF p_signature_packaging = 'ENVELOPED'
     AND lower(v_request.document_hash) = p_signed_output_hash_sha256 THEN
    RAISE EXCEPTION 'annual accounts ENVELOPED output cannot equal its unsigned input';
  END IF;
  IF p_signature_packaging IN ('DETACHED', 'PROVIDER_ATTESTATION')
     AND lower(v_request.document_hash) = p_signed_output_hash_sha256
     AND (SELECT count(DISTINCT fingerprint)
       FROM unnest(ARRAY[
         p_signed_output_hash_sha256,
         p_certificate_fingerprint_sha256,
         p_completion_package_fingerprint_sha256
       ]) AS fingerprints(fingerprint)) <> 3 THEN
    RAISE EXCEPTION 'annual accounts detached/provider-attestation artifacts need independent fingerprints';
  END IF;

  BEGIN
    v_provider_requested_at := NULLIF(btrim(p_provider_payload ->> 'provider_requested_at'), '')::timestamptz;
    v_provider_signed_at := NULLIF(btrim(p_provider_payload ->> 'provider_signed_at'), '')::timestamptz;
    v_provider_completed_at := NULLIF(btrim(p_provider_payload ->> 'provider_completed_at'), '')::timestamptz;
    v_storage_retrieved_at := NULLIF(btrim(p_provider_payload ->> 'storage_retrieved_at'), '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'annual accounts EAD provider chronology is invalid';
  END;
  IF p_signed_at IS NULL
     OR v_provider_requested_at IS NULL
     OR v_provider_signed_at IS NULL
     OR v_provider_completed_at IS NULL
     OR v_storage_retrieved_at IS NULL
     OR v_provider_requested_at IS DISTINCT FROM v_request.requested_at
     OR v_provider_signed_at IS DISTINCT FROM p_signed_at
     OR v_request.requested_at > p_signed_at
     OR p_signed_at > v_provider_completed_at
     OR v_provider_completed_at > now()
     OR v_request.completed_at IS DISTINCT FROM v_provider_completed_at THEN
    RAISE EXCEPTION 'annual accounts EAD request chronology is inconsistent';
  END IF;

  IF p_provider_payload IS NULL
     OR jsonb_typeof(p_provider_payload) <> 'object'
     OR upper(COALESCE(p_provider_payload ->> 'provider', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(p_provider_payload ->> 'provider_document_status', '')) NOT IN ('SIGNED', 'CERTIFIED')
     OR upper(COALESCE(p_provider_payload ->> 'provider_signature_type', '')) <> p_provider_signature_type
     OR upper(COALESCE(p_provider_payload ->> 'signature_packaging', '')) <> p_signature_packaging
     OR p_provider_payload ->> 'provider_request_id' IS DISTINCT FROM v_request.sr_id
     OR p_provider_payload ->> 'provider_document_id' IS DISTINCT FROM v_request.document_id
     OR p_provider_payload ->> 'storage_object_id' IS DISTINCT FROM p_storage_object_id
     OR p_provider_payload ->> 'storage_version' IS DISTINCT FROM p_storage_version
     OR lower(COALESCE(p_provider_payload ->> 'storage_binary_hash_sha256', '')) <> p_signed_output_hash_sha256
     OR lower(COALESCE(p_provider_payload ->> 'storage_binary_hash_sha512', '')) <> p_signed_output_hash_sha512
     OR lower(COALESCE(p_provider_payload ->> 'certificate_fingerprint_sha256', '')) <> p_certificate_fingerprint_sha256
     OR lower(COALESCE(p_provider_payload ->> 'completion_package_fingerprint_sha256', '')) <> p_completion_package_fingerprint_sha256
     OR p_provider_payload ->> 'completion_certificate_ref' IS DISTINCT FROM p_completion_certificate_ref
     OR p_provider_payload ->> 'completion_package_ref' IS DISTINCT FROM p_completion_package_ref
     OR COALESCE(btrim(p_provider_payload ->> 'signed_document_ref'), '') !~ '^https://'
     OR COALESCE(btrim(p_provider_payload ->> 'signature_case_file_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'ead_case_file_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'ead_evidence_group_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'ead_evidence_id'), '') = ''
     OR lower(COALESCE(p_provider_payload ->> 'ead_provider_hash_sha256', '')) <> p_signed_output_hash_sha256
     OR COALESCE((p_provider_payload ->> 'sandbox')::boolean, false) IS TRUE
     OR jsonb_typeof(p_provider_payload -> 'provider_signatory_ids') <> 'array' THEN
    RAISE EXCEPTION 'annual accounts EAD reconciliation payload is not independently provider-bound';
  END IF;

  IF EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_request.signatories) signer
       WHERE signer ->> 'source_domain' IS DISTINCT FROM 'ANNUAL_ACCOUNTS'
          OR signer ->> 'source_id' IS DISTINCT FROM v_set.id::text
          OR signer ->> 'artifact_kind' IS DISTINCT FROM 'ANNUAL_ACCOUNTS_EXECUTION'
          OR lower(COALESCE(signer ->> 'content_hash_sha256', '')) <> v_set.manifest_hash_sha256
          OR upper(COALESCE(signer ->> 'signer_role', '')) <> 'ADMINISTRADOR'
          OR upper(COALESCE(signer ->> 'provider_signature_type', '')) <> p_provider_signature_type
          OR COALESCE(btrim(signer ->> 'provider_signatory_id'), '') = ''
          OR COALESCE(btrim(signer ->> 'case_file_id'), '') = ''
          OR signer ->> 'case_file_id'
               IS DISTINCT FROM (p_provider_payload ->> 'signature_case_file_id')
          OR NOT EXISTS (
            SELECT 1
            FROM public.secretaria_annual_accounts_expected_signers expected
            WHERE expected.tenant_id = v_set.tenant_id
              AND expected.signer_roster_id = v_roster.id
              AND expected.person_id::text = signer ->> 'person_id'
          )
          OR NOT (p_provider_payload -> 'provider_signatory_ids' ? (signer ->> 'provider_signatory_id'))
     )
     OR (SELECT count(DISTINCT signer ->> 'person_id') FROM jsonb_array_elements(v_request.signatories) signer)
          <> jsonb_array_length(v_request.signatories)
     OR (SELECT count(DISTINCT signer ->> 'provider_signatory_id') FROM jsonb_array_elements(v_request.signatories) signer)
          <> jsonb_array_length(v_request.signatories)
     OR (SELECT count(DISTINCT signer ->> 'case_file_id') FROM jsonb_array_elements(v_request.signatories) signer) <> 1
     OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_provider_payload -> 'provider_signatory_ids'))
          <> jsonb_array_length(v_request.signatories) THEN
    RAISE EXCEPTION 'annual accounts EAD signers do not match the persisted WORM roster request';
  END IF;

  -- La presencia del signatoryId en un request COMPLETED no acredita el
  -- resultado individual. Solo el status devuelto por el recurso de firmantes
  -- de EAD puede convertir una persona en SIGNED_EAD. La ausencia o un estado
  -- no final se devuelve como pendiente sin crear bundle ni outcome local.
  IF NOT (p_provider_payload ? 'provider_signer_outcomes') THEN
    RETURN jsonb_build_object(
      'reconciliation_status', 'PENDING_PROVIDER_SIGNER_OUTCOMES',
      'pending_code', 'PROVIDER_SIGNER_OUTCOMES_MISSING',
      'signature_request_id', v_request.id,
      'provider_signer_outcomes', '[]'::jsonb,
      'signer_outcomes', '[]'::jsonb,
      'roster_complete', false
    );
  END IF;
  IF jsonb_typeof(p_provider_payload -> 'provider_signer_outcomes') <> 'array' THEN
    RAISE EXCEPTION 'annual accounts EAD provider signer outcomes must be an array';
  END IF;

  SELECT
    COALESCE(
      jsonb_agg(
        (provider_outcome - 'provider_outcome_hash_sha256')
        || jsonb_build_object(
          'provider_outcome_hash_sha256',
          encode(
            digest((provider_outcome - 'provider_outcome_hash_sha256')::text, 'sha256'),
            'hex'
          )
        )
        ORDER BY provider_outcome ->> 'provider_signatory_id'
      ),
      '[]'::jsonb
    ),
    count(*)::integer
    INTO v_provider_signer_outcomes, v_provider_signer_outcome_count
    FROM jsonb_array_elements(p_provider_payload -> 'provider_signer_outcomes') provider_outcome;

  IF EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_provider_signer_outcomes) provider_outcome
       WHERE jsonb_typeof(provider_outcome) <> 'object'
          OR COALESCE(btrim(provider_outcome ->> 'provider_signatory_id'), '') = ''
          OR COALESCE(btrim(provider_outcome ->> 'person_id'), '') = ''
          OR COALESCE(btrim(provider_outcome ->> 'provider_status'), '') = ''
          OR provider_outcome ->> 'provider_status_source'
               IS DISTINCT FROM 'EAD_DOCUMENT_SIGNATORY_RESOURCE'
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(v_request.signatories) requested_signer
            WHERE requested_signer ->> 'provider_signatory_id'
                    = provider_outcome ->> 'provider_signatory_id'
              AND requested_signer ->> 'person_id'
                    = provider_outcome ->> 'person_id'
          )
     )
     OR (
       SELECT count(DISTINCT provider_outcome ->> 'provider_signatory_id')
       FROM jsonb_array_elements(v_provider_signer_outcomes) provider_outcome
     ) <> v_provider_signer_outcome_count
     OR (
       SELECT count(DISTINCT provider_outcome ->> 'person_id')
       FROM jsonb_array_elements(v_provider_signer_outcomes) provider_outcome
     ) <> v_provider_signer_outcome_count THEN
    RAISE EXCEPTION 'annual accounts EAD provider signer outcomes are duplicated or not source-bound';
  END IF;

  IF v_provider_signer_outcome_count <> jsonb_array_length(v_request.signatories)
     OR EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_request.signatories) requested_signer
       WHERE NOT EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_provider_signer_outcomes) provider_outcome
         WHERE provider_outcome ->> 'provider_signatory_id'
                 = requested_signer ->> 'provider_signatory_id'
           AND provider_outcome ->> 'person_id' = requested_signer ->> 'person_id'
       )
     ) THEN
    RETURN jsonb_build_object(
      'reconciliation_status', 'PENDING_PROVIDER_SIGNER_OUTCOMES',
      'pending_code', 'PROVIDER_SIGNER_OUTCOMES_INCOMPLETE',
      'signature_request_id', v_request.id,
      'provider_signer_outcomes', v_provider_signer_outcomes,
      'signer_outcomes', '[]'::jsonb,
      'roster_complete', false
    );
  END IF;

  SELECT count(*)::integer
    INTO v_unresolved_provider_signer_count
    FROM jsonb_array_elements(v_provider_signer_outcomes) provider_outcome
   WHERE upper(provider_outcome ->> 'provider_status')
           NOT IN ('SIGNED', 'CERTIFIED', 'COMPLETED')
      OR COALESCE(btrim(provider_outcome ->> 'provider_status_at'), '') = ''
      OR CASE
           WHEN provider_outcome ->> 'provider_status_at'
                  ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
             THEN (provider_outcome ->> 'provider_status_at')::timestamptz < v_provider_requested_at
               OR (provider_outcome ->> 'provider_status_at')::timestamptz > v_provider_completed_at
               OR (provider_outcome ->> 'provider_status_at')::timestamptz > now()
           ELSE true
         END;
  IF v_unresolved_provider_signer_count > 0 THEN
    RETURN jsonb_build_object(
      'reconciliation_status', 'PENDING_PROVIDER_SIGNER_OUTCOMES',
      'pending_code', 'PROVIDER_SIGNER_STATUS_NOT_FINAL',
      'signature_request_id', v_request.id,
      'provider_signer_outcomes', v_provider_signer_outcomes,
      'unresolved_provider_signer_count', v_unresolved_provider_signer_count,
      'signer_outcomes', '[]'::jsonb,
      'roster_complete', false
    );
  END IF;

  IF v_request.evidence_id IS NOT NULL THEN
    SELECT * INTO v_existing_bundle
      FROM public.evidence_bundles
     WHERE id = v_request.evidence_id
       AND tenant_id = v_set.tenant_id;
    IF NOT FOUND
       OR v_existing_bundle.status <> 'VERIFIED'
       OR COALESCE(v_existing_bundle.legal_hold, false) IS NOT TRUE
       OR upper(COALESCE(v_existing_bundle.source_object_type, '')) <> 'ANNUAL_ACCOUNTS_SIGNATURE'
       OR v_existing_bundle.source_object_id IS DISTINCT FROM v_request.id::text
       OR v_existing_bundle.storage_path IS DISTINCT FROM p_storage_path
       OR v_existing_bundle.hash_sha512 IS DISTINCT FROM p_signed_output_hash_sha512
       OR v_existing_bundle.manifest #>> '{source,id}' IS DISTINCT FROM v_set.id::text
       OR v_existing_bundle.manifest #>> '{binary,artifact_role}' IS DISTINCT FROM 'SIGNED_OUTPUT'
       OR v_existing_bundle.manifest #>> '{binary,hash_sha256}' IS DISTINCT FROM p_signed_output_hash_sha256
       OR v_existing_bundle.manifest #>> '{verification,signature_request_id}' IS DISTINCT FROM v_request.id::text
       OR v_existing_bundle.manifest #>> '{verification,trust_boundary}' IS DISTINCT FROM 'SERVICE_SIGNATURE_RECONCILIATION'
       OR v_existing_bundle.manifest #> '{verification,provider_signer_outcomes}'
            IS DISTINCT FROM v_provider_signer_outcomes THEN
      RAISE EXCEPTION 'annual accounts request already references different reconciliation evidence';
    END IF;
    v_bundle_id := v_existing_bundle.id;
  ELSE
    v_bundle_id := gen_random_uuid();
    v_manifest := jsonb_build_object(
      'schema_version', 'ead-trust-annual-accounts-signature.v1',
      'source', jsonb_build_object(
        'domain', 'ANNUAL_ACCOUNTS',
        'id', v_set.id,
        'artifact_kind', 'ANNUAL_ACCOUNTS_EXECUTION',
        'content_hash_sha256', v_set.manifest_hash_sha256,
        'signer_roster_id', v_roster.id,
        'signer_roster_hash_sha256', v_roster.roster_hash_sha256
      ),
      'request_input', jsonb_build_object(
        'hash_sha256', lower(v_request.document_hash),
        'provider_request_id', v_request.sr_id,
        'provider_document_id', v_request.document_id
      ),
      'binary', jsonb_build_object(
        'artifact_role', 'SIGNED_OUTPUT',
        'signature_packaging', p_signature_packaging,
        'storage_path', p_storage_path,
        'storage_object_id', p_storage_object_id,
        'storage_version', p_storage_version,
        'retrieved_at', v_storage_retrieved_at,
        'hash_sha256', p_signed_output_hash_sha256,
        'hash_sha512', p_signed_output_hash_sha512
      ),
      'verification', jsonb_build_object(
        'trust_boundary', 'SERVICE_SIGNATURE_RECONCILIATION',
        'provider', 'EAD_TRUST',
        'service', 'EVIDENCE_MANAGER',
        'signature_request_id', v_request.id,
        'provider_request_id', v_request.sr_id,
        'provider_document_id', v_request.document_id,
        'provider_signature_type', p_provider_signature_type,
        'signature_packaging', p_signature_packaging,
        'provider_signatory_ids', p_provider_payload -> 'provider_signatory_ids',
        'provider_signer_outcomes', v_provider_signer_outcomes,
        'completion_certificate_ref', p_completion_certificate_ref,
        'completion_package_ref', p_completion_package_ref,
        'certificate_fingerprint_sha256', p_certificate_fingerprint_sha256,
        'completion_package_fingerprint_sha256', p_completion_package_fingerprint_sha256,
        'signed_at', p_signed_at,
        'provider_completed_at', v_provider_completed_at,
        'ead_case_file_id', p_provider_payload ->> 'ead_case_file_id',
        'ead_evidence_group_id', p_provider_payload ->> 'ead_evidence_group_id',
        'ead_evidence_id', p_provider_payload ->> 'ead_evidence_id',
        'ead_provider_hash_sha256', p_provider_payload ->> 'ead_provider_hash_sha256',
        'sandbox', false
      )
    );
    v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

    INSERT INTO public.evidence_bundles (
      id, tenant_id, agreement_id, source_module, source_object_type,
      source_object_id, reference_code, manifest, manifest_hash, hash_sha512,
      storage_path, document_url, signed_by, signature_date,
      chain_of_custody, legal_hold, status
    ) VALUES (
      v_bundle_id, v_set.tenant_id, v_request.agreement_id, 'secretaria',
      'ANNUAL_ACCOUNTS_SIGNATURE', v_request.id::text,
      'EAD-ANNUAL-SR-' || v_request.sr_id, v_manifest, v_manifest_hash,
      p_signed_output_hash_sha512, p_storage_path,
      'evidence-bundle://' || p_storage_path,
      'EAD Trust Digital Trust API', p_signed_at,
      jsonb_build_array(jsonb_build_object(
        'event', 'EAD_ANNUAL_ACCOUNTS_SIGNATURE_RECONCILED',
        'ts', v_storage_retrieved_at,
        'signature_request_id', v_request.id,
        'provider_request_id', v_request.sr_id,
        'signed_output_hash_sha256', p_signed_output_hash_sha256,
        'signed_output_hash_sha512', p_signed_output_hash_sha512,
        'signature_packaging', p_signature_packaging
      )),
      true, 'VERIFIED'
    );

    UPDATE public.qtsp_signature_requests
       SET evidence_id = v_bundle_id,
           evidence_status = CASE
             WHEN p_provider_signature_type = 'ADVANCED' THEN 'EAD_ADVANCED_EVIDENCE_VERIFIED'
             ELSE 'EAD_INTERPOSITION_EVIDENCE_VERIFIED'
           END
     WHERE id = v_request.id;
  END IF;

  FOR v_signer IN
    SELECT signer
    FROM jsonb_array_elements(v_request.signatories) signer
    ORDER BY signer ->> 'person_id'
  LOOP
    SELECT provider_outcome INTO v_provider_signer_outcome
      FROM jsonb_array_elements(v_provider_signer_outcomes) provider_outcome
     WHERE provider_outcome ->> 'provider_signatory_id'
             = v_signer ->> 'provider_signatory_id'
       AND provider_outcome ->> 'person_id' = v_signer ->> 'person_id';

    SELECT expected.id INTO v_expected_signer_id
      FROM public.secretaria_annual_accounts_expected_signers expected
     WHERE expected.tenant_id = v_set.tenant_id
       AND expected.signer_roster_id = v_roster.id
       AND expected.person_id::text = v_signer ->> 'person_id';

    SELECT outcome.* INTO v_head
      FROM public.secretaria_annual_accounts_signer_outcomes outcome
     WHERE outcome.tenant_id = v_set.tenant_id
       AND outcome.expected_signer_id = v_expected_signer_id
       AND NOT EXISTS (
         SELECT 1
         FROM public.secretaria_annual_accounts_signer_outcomes successor
         WHERE successor.tenant_id = outcome.tenant_id
           AND successor.supersedes_outcome_id = outcome.id
       );
    IF FOUND THEN
      IF v_head.outcome_type <> 'SIGNED_EAD'
         OR v_head.signature_request_id IS DISTINCT FROM v_request.id
         OR v_head.provider_evidence_bundle_id IS DISTINCT FROM v_bundle_id
         OR v_head.provider_reference IS DISTINCT FROM v_signer ->> 'provider_signatory_id'
         OR v_head.outcome_manifest #> '{provider_signer_outcome}'
              IS DISTINCT FROM v_provider_signer_outcome
         OR v_head.outcome_manifest #>> '{provider_signer_outcome_hash_sha256}'
              IS DISTINCT FROM v_provider_signer_outcome ->> 'provider_outcome_hash_sha256' THEN
        RAISE EXCEPTION 'annual accounts signer % already has a different current outcome; explicit supersession is required',
          v_expected_signer_id;
      END IF;
      v_outcome := jsonb_build_object(
        'outcome_id', v_head.id,
        'expected_signer_id', v_expected_signer_id,
        'person_id', v_signer ->> 'person_id',
        'provider_signer_outcome_hash_sha256',
          v_provider_signer_outcome ->> 'provider_outcome_hash_sha256',
        'outcome_type', 'SIGNED_EAD',
        'reused', true
      );
    ELSE
      v_outcome := public.fn_secretaria_record_annual_accounts_signer_outcome(
        v_expected_signer_id,
        'SIGNED_EAD',
        v_request.id,
        v_bundle_id,
        NULL,
        NULL,
        NULL
      ) || jsonb_build_object(
        'expected_signer_id', v_expected_signer_id,
        'person_id', v_signer ->> 'person_id',
        'provider_signer_outcome_hash_sha256',
          v_provider_signer_outcome ->> 'provider_outcome_hash_sha256',
        'reused', false
      );
    END IF;
    v_outcomes := v_outcomes || jsonb_build_array(v_outcome);
  END LOOP;

  SELECT count(*) INTO v_expected_count
    FROM public.secretaria_annual_accounts_expected_signers
   WHERE tenant_id = v_set.tenant_id
     AND signer_roster_id = v_roster.id;
  SELECT count(*) INTO v_resolved_count
    FROM public.secretaria_annual_accounts_expected_signers expected
   WHERE expected.tenant_id = v_set.tenant_id
     AND expected.signer_roster_id = v_roster.id
     AND EXISTS (
       SELECT 1
       FROM public.secretaria_annual_accounts_signer_outcomes outcome
       WHERE outcome.tenant_id = expected.tenant_id
         AND outcome.expected_signer_id = expected.id
         AND NOT EXISTS (
           SELECT 1
           FROM public.secretaria_annual_accounts_signer_outcomes successor
           WHERE successor.tenant_id = outcome.tenant_id
             AND successor.supersedes_outcome_id = outcome.id
         )
     );
  IF v_expected_count > 0 AND v_resolved_count = v_expected_count THEN
    v_signature_state := public.fn_secretaria_validate_annual_accounts_execution(v_set.id);
  END IF;

  RETURN jsonb_build_object(
    'reconciliation_status', 'SIGNERS_RECONCILED',
    'evidence_bundle_id', v_bundle_id,
    'signature_request_id', v_request.id,
    'provider_signature_type', p_provider_signature_type,
    'signature_packaging', p_signature_packaging,
    'signed_output_hash_sha256', p_signed_output_hash_sha256,
    'signed_output_hash_sha512', p_signed_output_hash_sha512,
    'provider_signer_outcomes', v_provider_signer_outcomes,
    'signer_outcomes', v_outcomes,
    'expected_signer_count', v_expected_count,
    'resolved_signer_count', v_resolved_count,
    'roster_complete', v_expected_count > 0 AND v_resolved_count = v_expected_count,
    'signature_state', v_signature_state
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_reconcile_annual_accounts_ead_bundle(
  uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_reconcile_annual_accounts_ead_bundle(
  uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, timestamptz, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(
  p_annual_accounts_set_id uuid,
  p_evidence_bundle_id uuid,
  p_storage_path text,
  p_storage_object_id text,
  p_storage_version text,
  p_binary_hash_sha256 text,
  p_binary_hash_sha512 text,
  p_archived_at timestamptz,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_set public.secretaria_annual_accounts_sets%ROWTYPE;
  v_signature_state jsonb;
  v_manifest jsonb;
  v_manifest_hash text;
  v_bundle public.evidence_bundles%ROWTYPE;
  v_existing_artifact public.secretaria_annual_accounts_execution_artifacts%ROWTYPE;
  v_registered jsonb;
BEGIN
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    RAISE EXCEPTION 'annual accounts final e-archive requires service_role'
      USING ERRCODE = '42501';
  END IF;

  p_binary_hash_sha256 := lower(COALESCE(btrim(p_binary_hash_sha256), ''));
  p_binary_hash_sha512 := lower(COALESCE(btrim(p_binary_hash_sha512), ''));
  SELECT set_row.* INTO v_set
    FROM public.secretaria_annual_accounts_sets set_row
   WHERE set_row.id = p_annual_accounts_set_id
     AND NOT EXISTS (
       SELECT 1 FROM public.secretaria_annual_accounts_sets successor
       WHERE successor.tenant_id = set_row.tenant_id
         AND successor.supersedes_set_id = set_row.id
     )
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'annual accounts final e-archive requires the current set';
  END IF;

  -- Este RPC es la barrera definitiva: si queda un administrador sin firma EAD
  -- o causa individual codificada, la función subyacente aborta antes de crear
  -- bundle, archivo o estado FINAL_ARCHIVED.
  v_signature_state := public.fn_secretaria_validate_annual_accounts_execution(v_set.id);

  IF p_binary_hash_sha256 !~ '^[0-9a-f]{64}$'
     OR p_binary_hash_sha512 !~ '^[0-9a-f]{128}$'
     OR COALESCE(btrim(p_storage_path), '') = ''
     OR p_storage_path LIKE 'http%'
     OR p_storage_path LIKE '%..%'
     OR COALESCE(btrim(p_storage_object_id), '') = ''
     OR COALESCE(btrim(p_storage_version), '') = ''
     OR p_archived_at IS NULL
     OR p_archived_at > now()
     OR p_provider_payload IS NULL
     OR jsonb_typeof(p_provider_payload) <> 'object'
     OR upper(COALESCE(p_provider_payload ->> 'provider', '')) <> 'EAD_TRUST'
     OR upper(COALESCE(p_provider_payload ->> 'service', '')) <> 'EVIDENCE_MANAGER'
     OR upper(COALESCE(p_provider_payload ->> 'provider_status', '')) <> 'COMPLETED'
     OR lower(COALESCE(p_provider_payload ->> 'provider_hash_sha256', '')) <> p_binary_hash_sha256
     OR COALESCE(btrim(p_provider_payload ->> 'case_file_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'evidence_group_id'), '') = ''
     OR COALESCE(btrim(p_provider_payload ->> 'evidence_id'), '') = ''
     OR COALESCE((p_provider_payload ->> 'sandbox')::boolean, false) IS TRUE THEN
    RAISE EXCEPTION 'annual accounts final e-archive lacks verified EAD custody';
  END IF;

  SELECT * INTO v_existing_artifact
    FROM public.secretaria_annual_accounts_execution_artifacts
   WHERE tenant_id = v_set.tenant_id
     AND annual_accounts_set_id = v_set.id;
  IF FOUND THEN
    IF v_existing_artifact.evidence_bundle_id IS DISTINCT FROM p_evidence_bundle_id
       OR v_existing_artifact.storage_path IS DISTINCT FROM p_storage_path
       OR v_existing_artifact.binary_hash_sha256 IS DISTINCT FROM p_binary_hash_sha256
       OR v_existing_artifact.binary_hash_sha512 IS DISTINCT FROM p_binary_hash_sha512 THEN
      RAISE EXCEPTION 'annual accounts set already has a different FINAL_ARCHIVED artifact';
    END IF;
    RETURN jsonb_build_object(
      'execution_artifact_id', v_existing_artifact.id,
      'evidence_bundle_id', v_existing_artifact.evidence_bundle_id,
      'execution_status', 'FINAL_ARCHIVED',
      'execution_manifest_hash_sha256', v_existing_artifact.execution_manifest_hash_sha256,
      'reused', true
    );
  END IF;

  v_manifest := jsonb_build_object(
    'schema_version', 'ead-trust-annual-accounts-execution.v1',
    'source', jsonb_build_object(
      'domain', 'ANNUAL_ACCOUNTS',
      'id', v_set.id,
      'content_hash_sha256', v_set.manifest_hash_sha256
    ),
    'binary', jsonb_build_object(
      'artifact_role', 'ANNUAL_ACCOUNTS_EXECUTION_OUTPUT',
      'storage_path', p_storage_path,
      'storage_object_id', p_storage_object_id,
      'storage_version', p_storage_version,
      'archived_at', p_archived_at,
      'hash_sha256', p_binary_hash_sha256,
      'hash_sha512', p_binary_hash_sha512,
      'legal_render_binding', jsonb_build_object(
        'annual_accounts_set_manifest_hash_sha256', v_set.manifest_hash_sha256,
        'signer_roster_hash_sha256', v_signature_state ->> 'roster_hash_sha256',
        'signer_outcomes_manifest_hash_sha256', v_signature_state ->> 'outcomes_manifest_hash_sha256',
        'missing_signature_causes_manifest_hash_sha256',
          v_signature_state ->> 'missing_signature_causes_manifest_hash_sha256'
      )
    ),
    'verification', jsonb_build_object(
      'trust_boundary', 'SERVICE_EARCHIVE',
      'provider', 'EAD_TRUST',
      'service', 'EVIDENCE_MANAGER',
      'provider_status', 'COMPLETED',
      'case_file_id', p_provider_payload ->> 'case_file_id',
      'evidence_group_id', p_provider_payload ->> 'evidence_group_id',
      'evidence_id', p_provider_payload ->> 'evidence_id',
      'provider_hash_sha256', p_provider_payload ->> 'provider_hash_sha256',
      'verified_at', p_provider_payload ->> 'verified_at',
      'sandbox', false
    )
  );
  v_manifest_hash := encode(digest(v_manifest::text, 'sha256'), 'hex');

  SELECT * INTO v_bundle
    FROM public.evidence_bundles
   WHERE id = p_evidence_bundle_id
     AND tenant_id = v_set.tenant_id;
  IF FOUND THEN
    IF v_bundle.status <> 'VERIFIED'
       OR COALESCE(v_bundle.legal_hold, false) IS NOT TRUE
       OR v_bundle.source_object_type IS DISTINCT FROM 'ANNUAL_ACCOUNTS_SET'
       OR v_bundle.source_object_id IS DISTINCT FROM v_set.id::text
       OR v_bundle.storage_path IS DISTINCT FROM p_storage_path
       OR v_bundle.hash_sha512 IS DISTINCT FROM p_binary_hash_sha512
       OR v_bundle.manifest #>> '{binary,hash_sha256}' IS DISTINCT FROM p_binary_hash_sha256
       OR v_bundle.manifest #>> '{binary,artifact_role}' IS DISTINCT FROM 'ANNUAL_ACCOUNTS_EXECUTION_OUTPUT'
       OR v_bundle.manifest #>> '{binary,legal_render_binding,signer_outcomes_manifest_hash_sha256}'
            IS DISTINCT FROM v_signature_state ->> 'outcomes_manifest_hash_sha256' THEN
      RAISE EXCEPTION 'annual accounts final evidence id is bound to different custody';
    END IF;
  ELSE
    INSERT INTO public.evidence_bundles (
      id, tenant_id, agreement_id, source_module, source_object_type,
      source_object_id, reference_code, manifest, manifest_hash, hash_sha512,
      storage_path, document_url, signed_by, signature_date,
      chain_of_custody, legal_hold, status
    ) VALUES (
      p_evidence_bundle_id, v_set.tenant_id, NULL, 'secretaria',
      'ANNUAL_ACCOUNTS_SET', v_set.id::text,
      'EAD-ANNUAL-EXEC-' || (p_provider_payload ->> 'evidence_id'),
      v_manifest, v_manifest_hash, p_binary_hash_sha512, p_storage_path,
      'evidence-bundle://' || p_storage_path, NULL, NULL,
      jsonb_build_array(jsonb_build_object(
        'event', 'EAD_ANNUAL_ACCOUNTS_EXECUTION_EARCHIVED',
        'ts', p_archived_at,
        'annual_accounts_set_id', v_set.id,
        'binary_hash_sha256', p_binary_hash_sha256,
        'binary_hash_sha512', p_binary_hash_sha512,
        'roster_hash_sha256', v_signature_state ->> 'roster_hash_sha256',
        'outcomes_hash_sha256', v_signature_state ->> 'outcomes_manifest_hash_sha256'
      )),
      true, 'VERIFIED'
    );
  END IF;

  v_registered := public.fn_secretaria_register_annual_accounts_execution_artifact(
    v_set.id,
    p_evidence_bundle_id,
    p_storage_path,
    p_binary_hash_sha256,
    p_binary_hash_sha512
  );
  RETURN v_registered || jsonb_build_object(
    'evidence_bundle_id', p_evidence_bundle_id,
    'signature_state', v_signature_state,
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(
  uuid, uuid, text, text, text, text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_register_annual_accounts_ead_execution(
  uuid, uuid, text, text, text, text, text, timestamptz, jsonb
) TO service_role;

COMMIT;
