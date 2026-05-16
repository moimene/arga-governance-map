-- View: public.sii_cases_view
-- Exposes sii.cases through the public schema (no API settings change needed)
-- Aliases column names to match the useSii.ts hook expectations
CREATE OR REPLACE VIEW public.sii_cases_view AS
SELECT
  c.id,
  c.tenant_id,
  c.case_ref              AS reference,
  c.channel,
  c.is_anonymous,
  c.country,
  c.classification,
  c.status,
  c.investigator_id,
  c.opened_at             AS received_date,
  c.closed_at             AS closed_date,
  c.resolution            AS closing_reason,
  p.full_name             AS investigator_name
FROM sii.cases c
LEFT JOIN public.persons p ON c.investigator_id = p.id;

-- View: public.sii_evidences_view
CREATE OR REPLACE VIEW public.sii_evidences_view AS
SELECT
  id,
  case_id,
  title,
  file_url,
  is_encrypted,
  uploaded_at             AS created_at,
  'Cifrado'::text         AS status,
  NULL::text              AS type
FROM sii.evidences;

-- View: public.sii_actions_view
-- Maps sii.audit_log to the action timeline format expected by the hook
CREATE OR REPLACE VIEW public.sii_actions_view AS
SELECT
  al.id,
  al.case_id,
  al.action,
  al.created_at           AS action_date,
  p.full_name             AS actor
FROM sii.audit_log al
LEFT JOIN public.persons p ON al.actor_id = p.id;
