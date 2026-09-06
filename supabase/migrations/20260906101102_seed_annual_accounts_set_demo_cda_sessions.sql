-- DEMO. Las dos sesiones vivas del CdA de ARGA nacidas de convocatoria
-- (b1fccfb0 y ac961a00) llevan punto FORMULACION_CUENTAS sin conjunto de
-- cuentas fijado, así que fn_generar_acta las rechaza («annual accounts gate:
-- current set is absent»). fn_secretaria_fix_annual_accounts_set exige
-- scheduled_start > now() y esas fechas ya pasaron, de modo que no hay camino
-- en la aplicación. Se clona el ÚNICO conjunto real (FY2025 individual, 6
-- componentes VERIFIED con legal hold, sembrado el 2026-07-20 para c994082c)
-- para cada una: misma entidad, mismo órgano, mismos documentos y hashes. La
-- procedencia queda en el manifiesto. Idempotente.
DO $seed$
DECLARE
  v_src public.secretaria_annual_accounts_sets%ROWTYPE;
  v_t record;
  v_set_id uuid; v_manifest jsonb; v_hash text; v_now timestamptz := clock_timestamp();
  v_ok boolean;
BEGIN
  SELECT * INTO v_src FROM public.secretaria_annual_accounts_sets WHERE id = '93c45b63-da4d-4b8e-88bb-5eb8a9b5e125';
  IF NOT FOUND THEN RAISE EXCEPTION 'conjunto origen 93c45b63 no existe'; END IF;

  FOR v_t IN SELECT * FROM (VALUES
      ('b1fccfb0-3eef-438e-9aad-8ad3b737d9c2'::uuid, '8cadc476-5914-44f8-977b-de06e8133b7c'::uuid),
      ('ac961a00-0a5d-4439-a8d4-618a0dd804b2'::uuid, '747f98a7-d473-4efe-a140-878f3175e99a'::uuid)
    ) t(meeting_id, agenda_item_id)
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.secretaria_annual_accounts_sets s
                          WHERE s.meeting_id = v_t.meeting_id AND s.agenda_item_id = v_t.agenda_item_id);

    -- Coherencia: misma sociedad, mismo órgano, punto decisorio de formulación.
    PERFORM 1
      FROM public.meetings m
      JOIN public.governing_bodies gb ON gb.id = m.body_id
      JOIN public.agenda_items a ON a.meeting_id = m.id
     WHERE m.id = v_t.meeting_id AND a.id = v_t.agenda_item_id
       AND m.tenant_id = v_src.tenant_id AND gb.entity_id = v_src.entity_id AND m.body_id = v_src.body_id
       AND upper(coalesce(a.matter_code,'')) = 'FORMULACION_CUENTAS' AND a.kind = 'DECISORIO';
    IF NOT FOUND THEN RAISE EXCEPTION 'seed cuentas: % no es coherente con el conjunto origen', v_t.meeting_id; END IF;

    v_set_id := gen_random_uuid();
    v_manifest := v_src.manifest || jsonb_build_object(
      'set_id', v_set_id,
      'meeting_id', v_t.meeting_id,
      'agenda_item_id', v_t.agenda_item_id,
      'approved_at', v_now,
      'approval_channel', 'TRUSTED_SERVICE',
      'seed_provenance', jsonb_build_object(
        'cloned_from_set_id', v_src.id,
        'seeded_at', v_now,
        'reason', 'DEMO sin efecto jurídico: misma versión FY2025 sometida al consejo. Sembrada porque fn_secretaria_fix_annual_accounts_set exige fecha futura y las sesiones demo ya han pasado.'
      )
    );
    v_hash := encode(extensions.digest(v_manifest::text, 'sha256'), 'hex');

    INSERT INTO public.secretaria_annual_accounts_sets (
      id, tenant_id, entity_id, body_id, meeting_id, agenda_item_id, fiscal_year, is_consolidated,
      cash_flow_statement_applicable, management_report_applicable, version_number, supersedes_set_id,
      approval_scope, approval_status, immutability_status, manifest, manifest_hash_sha256,
      approved_at, approved_by, immutable_at
    ) VALUES (
      v_set_id, v_src.tenant_id, v_src.entity_id, v_src.body_id, v_t.meeting_id, v_t.agenda_item_id,
      v_src.fiscal_year, v_src.is_consolidated, v_src.cash_flow_statement_applicable,
      v_src.management_report_applicable, 1, NULL, 'BOARD_SUBMISSION_VERSION', 'APPROVED', 'IMMUTABLE',
      v_manifest, v_hash, v_now, v_src.approved_by, v_now
    );

    INSERT INTO public.secretaria_annual_accounts_components (
      tenant_id, annual_accounts_set_id, component_kind, required_for_set, content_hash_sha256,
      content_hash_sha512, evidence_bundle_id, storage_path, storage_object_id, storage_version, evidence_manifest_hash
    )
    SELECT tenant_id, v_set_id, component_kind, required_for_set, content_hash_sha256, content_hash_sha512,
           evidence_bundle_id, storage_path, storage_object_id, storage_version, evidence_manifest_hash
      FROM public.secretaria_annual_accounts_components WHERE annual_accounts_set_id = v_src.id;

    -- Mismos predicados que fn_secretaria_validate_annual_accounts_point, sin
    -- pasar por su aserción de JWT (aquí no hay sesión de usuario).
    SELECT (s.manifest ->> 'approved_at')::timestamptz = s.approved_at
       AND s.manifest ->> 'approved_by' = s.approved_by::text
       AND encode(extensions.digest(s.manifest::text,'sha256'),'hex') = s.manifest_hash_sha256
       AND s.manifest -> 'components' = (
         SELECT jsonb_agg(jsonb_build_object(
           'component_kind', c.component_kind, 'required', c.required_for_set,
           'content_hash_sha256', c.content_hash_sha256, 'content_hash_sha512', c.content_hash_sha512,
           'evidence_bundle_id', c.evidence_bundle_id, 'evidence_manifest_hash', c.evidence_manifest_hash,
           'storage_path', c.storage_path, 'storage_object_id', c.storage_object_id, 'storage_version', c.storage_version
         ) ORDER BY c.component_kind)
         FROM public.secretaria_annual_accounts_components c WHERE c.annual_accounts_set_id = s.id)
      INTO v_ok
      FROM public.secretaria_annual_accounts_sets s WHERE s.id = v_set_id;
    IF v_ok IS NOT TRUE THEN RAISE EXCEPTION 'seed cuentas: el conjunto clonado no supera los predicados del validador'; END IF;
  END LOOP;
END
$seed$;
