-- Migration 20260521150000_aims_assessments_rls.sql
-- Enables proper RLS tenant isolation on ai_risk_assessments and ai_compliance_checks

ALTER TABLE public.ai_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_compliance_checks ENABLE ROW LEVEL SECURITY;

-- 1. ai_risk_assessments policies
DROP POLICY IF EXISTS tenant_isolation ON public.ai_risk_assessments;
DROP POLICY IF EXISTS aims_assessments_tenant_isolation ON public.ai_risk_assessments;

CREATE POLICY aims_assessments_tenant_isolation ON public.ai_risk_assessments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_systems
      WHERE ai_systems.id = ai_risk_assessments.system_id
        AND ai_systems.tenant_id = public.fn_current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_systems
      WHERE ai_systems.id = ai_risk_assessments.system_id
        AND ai_systems.tenant_id = public.fn_current_tenant_id()
    )
  );

-- 2. ai_compliance_checks policies
DROP POLICY IF EXISTS tenant_isolation ON public.ai_compliance_checks;
DROP POLICY IF EXISTS aims_compliance_checks_tenant_isolation ON public.ai_compliance_checks;

CREATE POLICY aims_compliance_checks_tenant_isolation ON public.ai_compliance_checks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_systems
      WHERE ai_systems.id = ai_compliance_checks.system_id
        AND ai_systems.tenant_id = public.fn_current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_systems
      WHERE ai_systems.id = ai_compliance_checks.system_id
        AND ai_systems.tenant_id = public.fn_current_tenant_id()
    )
  );
