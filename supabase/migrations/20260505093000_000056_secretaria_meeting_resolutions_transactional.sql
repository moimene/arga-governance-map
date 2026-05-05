-- ============================================================
-- Migration 000056: Secretaria meeting resolutions transactional save
--
-- Moves meeting/junta point persistence behind a SECURITY DEFINER RPC.
-- The client may prepare legal payloads, but all writes to agreements,
-- meeting_resolutions, meeting_votes and rule_evaluation_results happen
-- in one database transaction.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_resolutions_point
  ON meeting_resolutions(tenant_id, meeting_id, agenda_item_index)
  WHERE meeting_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_agreements_meeting_agenda_point
  ON agreements(
    tenant_id,
    parent_meeting_id,
    (execution_mode #>> '{agreement_360,agenda_item_index}')
  )
  WHERE parent_meeting_id IS NOT NULL
    AND adoption_mode = 'MEETING'
    AND execution_mode #>> '{agreement_360,agenda_item_index}' IS NOT NULL;

CREATE OR REPLACE FUNCTION fn_save_meeting_resolutions(
  p_tenant_id uuid,
  p_meeting_id uuid,
  p_rows jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting record;
  v_row jsonb;
  v_vote jsonb;
  v_idx integer;
  v_action text;
  v_payload jsonb;
  v_snapshot jsonb;
  v_agreement_id uuid;
  v_resolution_agreement_id uuid;
  v_resolution_id uuid;
  v_prepared jsonb := '[]'::jsonb;
  v_output jsonb := '[]'::jsonb;
  v_agreement_360 jsonb;
  v_eval_explain jsonb;
  v_eval_without_hash jsonb;
  v_eval_hash text;
  v_etapa text;
BEGIN
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);

  IF p_meeting_id IS NULL THEN
    RAISE EXCEPTION 'p_meeting_id is required';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT m.id, m.scheduled_start, m.body_id, gb.entity_id
    INTO v_meeting
    FROM meetings m
    JOIN governing_bodies gb ON gb.id = m.body_id
   WHERE m.id = p_meeting_id
     AND m.tenant_id = p_tenant_id
   FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'meeting % not found for tenant %', p_meeting_id, p_tenant_id;
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := NULLIF(v_row ->> 'agenda_item_index', '')::integer;
    IF v_idx IS NULL THEN
      RAISE EXCEPTION 'agenda_item_index is required';
    END IF;

    v_action := COALESCE(NULLIF(v_row ->> 'agreement_action', ''), 'NONE');
    v_payload := v_row -> 'agreement_payload';
    v_snapshot := v_row -> 'adoption_snapshot';
    v_agreement_id := NULLIF(v_row ->> 'agreement_id', '')::uuid;

    IF v_agreement_id IS NULL THEN
      SELECT mr.agreement_id
        INTO v_agreement_id
        FROM meeting_resolutions mr
       WHERE mr.tenant_id = p_tenant_id
         AND mr.meeting_id = p_meeting_id
         AND mr.agenda_item_index = v_idx
         AND mr.agreement_id IS NOT NULL
       LIMIT 1;
    END IF;

    IF v_agreement_id IS NULL THEN
      SELECT a.id
        INTO v_agreement_id
        FROM agreements a
       WHERE a.tenant_id = p_tenant_id
         AND a.parent_meeting_id = p_meeting_id
         AND (
           a.execution_mode ->> 'agenda_item_index' = v_idx::text OR
           a.execution_mode #>> '{agreement_360,agenda_item_index}' = v_idx::text
         )
       ORDER BY a.updated_at DESC
       LIMIT 1;
    END IF;

    IF v_action = 'UPSERT' THEN
      IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object' THEN
        RAISE EXCEPTION 'agreement_payload object is required for UPSERT';
      END IF;

      IF v_agreement_id IS NULL THEN
        INSERT INTO agreements (
          tenant_id,
          entity_id,
          body_id,
          agreement_kind,
          matter_class,
          inscribable,
          adoption_mode,
          status,
          parent_meeting_id,
          proposal_text,
          decision_text,
          decision_date,
          required_majority_code,
          compliance_snapshot,
          compliance_explain,
          execution_mode,
          updated_at
        ) VALUES (
          p_tenant_id,
          NULLIF(v_payload ->> 'entity_id', '')::uuid,
          NULLIF(v_payload ->> 'body_id', '')::uuid,
          v_payload ->> 'agreement_kind',
          v_payload ->> 'matter_class',
          COALESCE((v_payload ->> 'inscribable')::boolean, false),
          COALESCE(v_payload ->> 'adoption_mode', 'MEETING'),
          COALESCE(v_payload ->> 'status', 'ADOPTED'),
          p_meeting_id,
          v_payload ->> 'proposal_text',
          v_payload ->> 'decision_text',
          NULLIF(v_payload ->> 'decision_date', '')::date,
          v_payload ->> 'required_majority_code',
          v_payload -> 'compliance_snapshot',
          v_payload -> 'compliance_explain',
          v_payload -> 'execution_mode',
          COALESCE(NULLIF(v_payload ->> 'updated_at', '')::timestamptz, now())
        )
        RETURNING id INTO v_agreement_id;
      ELSE
        UPDATE agreements
           SET entity_id = NULLIF(v_payload ->> 'entity_id', '')::uuid,
               body_id = NULLIF(v_payload ->> 'body_id', '')::uuid,
               agreement_kind = v_payload ->> 'agreement_kind',
               matter_class = v_payload ->> 'matter_class',
               inscribable = COALESCE((v_payload ->> 'inscribable')::boolean, false),
               adoption_mode = COALESCE(v_payload ->> 'adoption_mode', 'MEETING'),
               status = COALESCE(v_payload ->> 'status', 'ADOPTED'),
               parent_meeting_id = p_meeting_id,
               proposal_text = v_payload ->> 'proposal_text',
               decision_text = v_payload ->> 'decision_text',
               decision_date = NULLIF(v_payload ->> 'decision_date', '')::date,
               required_majority_code = v_payload ->> 'required_majority_code',
               compliance_snapshot = v_payload -> 'compliance_snapshot',
               compliance_explain = v_payload -> 'compliance_explain',
               execution_mode = v_payload -> 'execution_mode',
               updated_at = COALESCE(NULLIF(v_payload ->> 'updated_at', '')::timestamptz, now())
         WHERE id = v_agreement_id
           AND tenant_id = p_tenant_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'agreement % not found for tenant %', v_agreement_id, p_tenant_id;
        END IF;
      END IF;
      v_resolution_agreement_id := v_agreement_id;
    ELSIF v_action = 'RESET' THEN
      IF v_agreement_id IS NOT NULL AND v_payload IS NOT NULL AND jsonb_typeof(v_payload) = 'object' THEN
        UPDATE agreements
           SET agreement_kind = v_payload ->> 'agreement_kind',
               matter_class = v_payload ->> 'matter_class',
               status = COALESCE(v_payload ->> 'status', 'DRAFT'),
               decision_text = v_payload ->> 'decision_text',
               decision_date = NULLIF(v_payload ->> 'decision_date', '')::date,
               proposal_text = v_payload ->> 'proposal_text',
               required_majority_code = v_payload ->> 'required_majority_code',
               compliance_snapshot = v_payload -> 'compliance_snapshot',
               compliance_explain = v_payload -> 'compliance_explain',
               execution_mode = v_payload -> 'execution_mode',
               updated_at = COALESCE(NULLIF(v_payload ->> 'updated_at', '')::timestamptz, now())
         WHERE id = v_agreement_id
           AND tenant_id = p_tenant_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'agreement % not found for tenant %', v_agreement_id, p_tenant_id;
        END IF;
      END IF;
      v_resolution_agreement_id := NULL;
    ELSE
      v_resolution_agreement_id := v_agreement_id;
    END IF;

    v_prepared := v_prepared || jsonb_build_array(
      v_row || jsonb_build_object('_agreement_id', v_resolution_agreement_id)
    );
  END LOOP;

  DELETE FROM meeting_votes mv
   WHERE mv.resolution_id IN (
     SELECT mr.id
       FROM meeting_resolutions mr
      WHERE mr.tenant_id = p_tenant_id
        AND mr.meeting_id = p_meeting_id
   );

  DELETE FROM meeting_resolutions mr
   WHERE mr.tenant_id = p_tenant_id
     AND mr.meeting_id = p_meeting_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(v_prepared)
  LOOP
    v_idx := (v_row ->> 'agenda_item_index')::integer;
    v_resolution_agreement_id := NULLIF(v_row ->> '_agreement_id', '')::uuid;
    v_snapshot := v_row -> 'adoption_snapshot';

    INSERT INTO meeting_resolutions (
      tenant_id,
      meeting_id,
      agenda_item_index,
      resolution_text,
      resolution_type,
      required_majority_code,
      status,
      agreement_id
    ) VALUES (
      p_tenant_id,
      p_meeting_id,
      v_idx,
      v_row ->> 'resolution_text',
      v_row ->> 'resolution_type',
      v_row ->> 'required_majority_code',
      COALESCE(v_row ->> 'status', 'PENDING'),
      v_resolution_agreement_id
    )
    RETURNING id INTO v_resolution_id;

    FOR v_vote IN SELECT value FROM jsonb_array_elements(COALESCE(v_row -> 'votes', '[]'::jsonb))
    LOOP
      INSERT INTO meeting_votes (
        resolution_id,
        attendee_id,
        vote_value,
        conflict_flag,
        reason,
        tenant_id
      ) VALUES (
        v_resolution_id,
        NULLIF(v_vote ->> 'attendee_id', '')::uuid,
        COALESCE(v_vote ->> 'vote_value', 'ABSTAIN'),
        COALESCE((v_vote ->> 'conflict_flag')::boolean, false),
        v_vote ->> 'reason',
        p_tenant_id
      );
    END LOOP;

    IF v_resolution_agreement_id IS NOT NULL AND v_snapshot IS NOT NULL AND jsonb_typeof(v_snapshot) = 'object' THEN
      v_agreement_360 := jsonb_build_object(
        'version', 'agreement-360.v1',
        'source', 'meeting_resolutions',
        'meeting_id', p_meeting_id,
        'agenda_item_index', v_idx,
        'agreement_id', v_resolution_agreement_id,
        'resolution_id', v_resolution_id,
        'materialized', true
      );

      UPDATE agreements
         SET compliance_snapshot = v_snapshot || jsonb_build_object(
               'agreement_id', v_resolution_agreement_id,
               'resolution_id', v_resolution_id
             ),
             compliance_explain = COALESCE(compliance_explain, '{}'::jsonb) || jsonb_build_object(
               'agreement_360',
                 COALESCE(compliance_explain -> 'agreement_360', '{}'::jsonb) || v_agreement_360,
               'societary_validity', v_snapshot -> 'societary_validity',
               'pacto_compliance', v_snapshot -> 'pacto_compliance'
             ),
             execution_mode = COALESCE(execution_mode, '{}'::jsonb) || jsonb_build_object(
               'agreement_360',
                 COALESCE(execution_mode -> 'agreement_360', '{}'::jsonb) || v_agreement_360
             ),
             updated_at = now()
       WHERE id = v_resolution_agreement_id
         AND tenant_id = p_tenant_id;

      IF v_snapshot #>> '{rule_trace,source}' = 'V2_CLOUD'
         AND NULLIF(v_snapshot #>> '{rule_trace,rule_pack_version_id}', '') IS NOT NULL
         AND NULLIF(v_snapshot #>> '{rule_trace,payload_hash}', '') IS NOT NULL
         AND NULLIF(v_snapshot #>> '{rule_trace,ruleset_snapshot_id}', '') IS NOT NULL THEN
        v_etapa := 'MEETING_ADOPTION_POINT_' || v_idx::text;
        v_eval_explain := jsonb_build_object(
          'schema_version', 'rule-evaluation-result.meeting-adoption.v1',
          'source', 'meeting_adoption_snapshot',
          'agenda_item_index', v_idx,
          'materia', v_snapshot -> 'materia',
          'materia_clase', v_snapshot -> 'materia_clase',
          'status_resolucion', v_snapshot -> 'status_resolucion',
          'vote_summary', v_snapshot -> 'vote_summary',
          'vote_completeness', v_snapshot -> 'vote_completeness',
          'voting_context', v_snapshot -> 'voting_context',
          'societary_validity', v_snapshot -> 'societary_validity',
          'pacto_compliance', v_snapshot -> 'pacto_compliance',
          'dual_evaluation', COALESCE(v_snapshot -> 'dual_evaluation', 'null'::jsonb),
          'rule_trace', v_snapshot -> 'rule_trace'
        );
        v_eval_without_hash := jsonb_build_object(
          'tenant_id', p_tenant_id,
          'agreement_id', v_resolution_agreement_id,
          'etapa', v_etapa,
          'ok',
            COALESCE((v_snapshot #>> '{societary_validity,ok}')::boolean, false)
            AND v_snapshot ->> 'status_resolucion' = 'ADOPTED',
          'explain', v_eval_explain,
          'blocking_issues',
            COALESCE(v_snapshot #> '{societary_validity,blocking_issues}', '[]'::jsonb) ||
            COALESCE(v_snapshot #> '{pacto_compliance,blocking_issues}', '[]'::jsonb),
          'warnings',
            COALESCE(v_snapshot #> '{societary_validity,warnings}', '[]'::jsonb) ||
            COALESCE(v_snapshot #> '{pacto_compliance,warnings}', '[]'::jsonb) ||
            COALESCE(v_snapshot #> '{rule_trace,warnings}', '[]'::jsonb),
          'rule_pack_id', v_snapshot #>> '{rule_trace,rule_pack_id}',
          'rule_pack_version', v_snapshot #>> '{rule_trace,rule_pack_version}',
          'rule_pack_version_id', v_snapshot #>> '{rule_trace,rule_pack_version_id}',
          'ruleset_snapshot_id', v_snapshot #>> '{rule_trace,ruleset_snapshot_id}',
          'payload_hash', v_snapshot #>> '{rule_trace,payload_hash}',
          'severity', COALESCE(v_snapshot #>> '{societary_validity,severity}', 'INFO')
        );
        v_eval_hash := encode(digest(v_eval_without_hash::text, 'sha256'), 'hex');

        DELETE FROM rule_evaluation_results rer
         WHERE rer.tenant_id = p_tenant_id
           AND rer.agreement_id = v_resolution_agreement_id
           AND rer.etapa = v_etapa;

        INSERT INTO rule_evaluation_results (
          tenant_id,
          agreement_id,
          etapa,
          ok,
          explain,
          blocking_issues,
          warnings,
          rule_pack_id,
          rule_pack_version,
          rule_pack_version_id,
          ruleset_snapshot_id,
          payload_hash,
          severity,
          evaluation_hash
        ) VALUES (
          p_tenant_id,
          v_resolution_agreement_id,
          v_etapa,
          (v_eval_without_hash ->> 'ok')::boolean,
          v_eval_explain,
          v_eval_without_hash -> 'blocking_issues',
          v_eval_without_hash -> 'warnings',
          v_snapshot #>> '{rule_trace,rule_pack_id}',
          v_snapshot #>> '{rule_trace,rule_pack_version}',
          NULLIF(v_snapshot #>> '{rule_trace,rule_pack_version_id}', '')::uuid,
          v_snapshot #>> '{rule_trace,ruleset_snapshot_id}',
          v_snapshot #>> '{rule_trace,payload_hash}',
          COALESCE(v_snapshot #>> '{societary_validity,severity}', 'INFO'),
          v_eval_hash
        );
      END IF;
    END IF;

    v_output := v_output || jsonb_build_array(jsonb_build_object(
      'agenda_item_index', v_idx,
      'resolution_id', v_resolution_id,
      'agreement_id', v_resolution_agreement_id,
      'adoption_snapshot',
        CASE
          WHEN v_snapshot IS NULL OR jsonb_typeof(v_snapshot) <> 'object' THEN NULL
          ELSE v_snapshot || jsonb_build_object(
            'agreement_id', v_resolution_agreement_id,
            'resolution_id', v_resolution_id
          )
        END
    ));
  END LOOP;

  RETURN v_output;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_save_meeting_resolutions(uuid, uuid, jsonb)
  TO authenticated, service_role;
