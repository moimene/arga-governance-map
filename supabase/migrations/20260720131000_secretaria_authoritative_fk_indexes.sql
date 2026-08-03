-- Índices de cobertura para todas las FK nuevas señaladas por el asesor de
-- rendimiento de Supabase tras desplegar los gates autoritativos.

BEGIN;

CREATE INDEX IF NOT EXISTS ix_cargo_rm_event_audit
  ON public.cargo_rm_registration_events(audit_worm_id);
CREATE INDEX IF NOT EXISTS ix_cargo_rm_event_authority
  ON public.cargo_rm_registration_events(authority_evidence_id);
CREATE INDEX IF NOT EXISTS ix_cargo_rm_event_condition
  ON public.cargo_rm_registration_events(condicion_id);

CREATE INDEX IF NOT EXISTS ix_aa_component_evidence
  ON public.secretaria_annual_accounts_components(evidence_bundle_id);

CREATE INDEX IF NOT EXISTS ix_aa_exec_set
  ON public.secretaria_annual_accounts_execution_artifacts(annual_accounts_set_id);
CREATE INDEX IF NOT EXISTS ix_aa_exec_evidence
  ON public.secretaria_annual_accounts_execution_artifacts(evidence_bundle_id);

CREATE INDEX IF NOT EXISTS ix_aa_expected_person
  ON public.secretaria_annual_accounts_expected_signers(person_id);

CREATE INDEX IF NOT EXISTS ix_aa_set_agenda_item
  ON public.secretaria_annual_accounts_sets(agenda_item_id);
CREATE INDEX IF NOT EXISTS ix_aa_set_body
  ON public.secretaria_annual_accounts_sets(body_id);
CREATE INDEX IF NOT EXISTS ix_aa_set_entity
  ON public.secretaria_annual_accounts_sets(entity_id);
CREATE INDEX IF NOT EXISTS ix_aa_set_meeting
  ON public.secretaria_annual_accounts_sets(meeting_id);
CREATE INDEX IF NOT EXISTS ix_aa_set_supersedes
  ON public.secretaria_annual_accounts_sets(supersedes_set_id);

CREATE INDEX IF NOT EXISTS ix_aa_outcome_evidence
  ON public.secretaria_annual_accounts_signer_outcomes(provider_evidence_bundle_id);
CREATE INDEX IF NOT EXISTS ix_aa_outcome_supersedes
  ON public.secretaria_annual_accounts_signer_outcomes(supersedes_outcome_id);
CREATE INDEX IF NOT EXISTS ix_aa_outcome_request
  ON public.secretaria_annual_accounts_signer_outcomes(signature_request_id);
CREATE INDEX IF NOT EXISTS ix_aa_outcome_expected
  ON public.secretaria_annual_accounts_signer_outcomes(expected_signer_id);

CREATE INDEX IF NOT EXISTS ix_aa_roster_set
  ON public.secretaria_annual_accounts_signer_rosters(annual_accounts_set_id);
CREATE INDEX IF NOT EXISTS ix_aa_roster_agreement
  ON public.secretaria_annual_accounts_signer_rosters(agreement_id);
CREATE INDEX IF NOT EXISTS ix_aa_roster_resolution
  ON public.secretaria_annual_accounts_signer_rosters(resolution_id);
CREATE INDEX IF NOT EXISTS ix_aa_roster_snapshot
  ON public.secretaria_annual_accounts_signer_rosters(snapshot_id);

CREATE INDEX IF NOT EXISTS ix_demo_quarantine_entity
  ON public.secretaria_demo_simulation_quarantine(entity_id);
CREATE INDEX IF NOT EXISTS ix_demo_quarantine_meeting
  ON public.secretaria_demo_simulation_quarantine(meeting_id);

CREATE INDEX IF NOT EXISTS ix_legal_artifact_evidence
  ON public.secretaria_legal_artifacts(evidence_bundle_id);

CREATE INDEX IF NOT EXISTS ix_qtsp_verification_evidence
  ON public.secretaria_qtsp_verifications(provider_evidence_bundle_id);
CREATE INDEX IF NOT EXISTS ix_qtsp_verification_request
  ON public.secretaria_qtsp_verifications(signature_request_id);
CREATE INDEX IF NOT EXISTS ix_qtsp_verification_signer
  ON public.secretaria_qtsp_verifications(signer_person_id);

COMMIT;
