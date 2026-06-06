-- ============================================================
-- Migration 20260521140000 — GRC Legacy Sync Triggers & Alignment
-- ============================================================
-- Consolidates GRC V3 by syncing legacy transactional tables to the GRC Backbone
-- and adds payload support to legacy incidents for DORA RTS classification data.

-- 1. Hardening: Add payload to incidents legacy if not exists
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Sync Trigger for obligations -> grc_obligations
CREATE OR REPLACE FUNCTION public.fn_sync_obligation_to_backbone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_id text;
  v_severity text;
BEGIN
  -- Deduce module_id with resilient fallback
  v_module_id := CASE
    WHEN NEW.code LIKE 'OBL-GDPR-%' THEN 'gdpr'
    WHEN NEW.code LIKE 'OBL-DORA-%' THEN 'dora'
    WHEN NEW.code LIKE 'OBL-NIS2-%' OR NEW.code LIKE 'OBL-ISO%' THEN 'cyber'
    WHEN NEW.code LIKE 'OBL-LEY2-%' THEN 'ethics'
    WHEN NEW.code LIKE 'OBL-EIOPA-%' THEN 'tprm'
    ELSE 'risk'
  END;

  -- Ensure target module exists for this tenant
  IF NOT EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = NEW.tenant_id AND id = v_module_id) THEN
    v_module_id := 'risk';
  END IF;

  -- Convert legacy criticality to GRC severity
  v_severity := CASE
    WHEN NEW.criticality = 'Crítico' THEN 'Critico'
    WHEN NEW.criticality = 'Alto' THEN 'Alto'
    WHEN NEW.criticality = 'Medio' THEN 'Medio'
    ELSE 'Bajo'
  END;

  INSERT INTO grc_obligations (
    tenant_id, id, module_id, framework, reference, obligation, owner, status, severity, authority, payload, updated_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id::text,
    v_module_id,
    COALESCE(NEW.source, 'General'),
    NEW.code,
    NEW.title,
    'Compliance Manager',
    'En revision',
    v_severity,
    CASE WHEN v_module_id = 'gdpr' THEN 'AEPD' WHEN v_module_id = 'dora' THEN 'Supervisor financiero' ELSE NULL END,
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    framework = EXCLUDED.framework,
    reference = EXCLUDED.reference,
    obligation = EXCLUDED.obligation,
    severity = EXCLUDED.severity,
    authority = EXCLUDED.authority,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_obligation_to_backbone ON public.obligations;
CREATE TRIGGER tg_sync_obligation_to_backbone
  AFTER INSERT OR UPDATE ON public.obligations
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_obligation_to_backbone();

-- 3. Sync Trigger for risks -> grc_risks
CREATE OR REPLACE FUNCTION public.fn_sync_risk_to_backbone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_id text;
  v_inherent_severity text;
  v_residual_severity text;
  v_status text;
BEGIN
  -- Deduce module_id with resilient fallback
  v_module_id := COALESCE(NEW.module_id, 'risk');
  IF NOT EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = NEW.tenant_id AND id = v_module_id) THEN
    v_module_id := 'risk';
  END IF;

  -- Map severity from score scales
  v_inherent_severity := CASE
    WHEN NEW.inherent_score >= 15 THEN 'Critico'
    WHEN NEW.inherent_score >= 10 THEN 'Alto'
    WHEN NEW.inherent_score >= 5 THEN 'Medio'
    ELSE 'Bajo'
  END;

  v_residual_severity := CASE
    WHEN NEW.residual_score >= 15 THEN 'Critico'
    WHEN NEW.residual_score >= 10 THEN 'Alto'
    WHEN NEW.residual_score >= 5 THEN 'Medio'
    ELSE 'Bajo'
  END;

  -- Map status
  v_status := CASE
    WHEN NEW.status = 'Abierto' THEN 'Pendiente'
    WHEN NEW.status = 'En tratamiento' THEN 'En revision'
    WHEN NEW.status = 'Mitigado' THEN 'En revision'
    ELSE 'Conforme'
  END;

  INSERT INTO grc_risks (
    tenant_id, id, module_id, obligation_id, title, description, inherent_severity, residual_severity, owner, status, payload, updated_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id::text,
    v_module_id,
    NEW.obligation_id::text,
    NEW.title,
    NEW.description,
    v_inherent_severity,
    v_residual_severity,
    'Risk Owner',
    v_status,
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    obligation_id = EXCLUDED.obligation_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    inherent_severity = EXCLUDED.inherent_severity,
    residual_severity = EXCLUDED.residual_severity,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_risk_to_backbone ON public.risks;
CREATE TRIGGER tg_sync_risk_to_backbone
  AFTER INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_risk_to_backbone();

-- 4. Sync Trigger for controls -> grc_controls
CREATE OR REPLACE FUNCTION public.fn_sync_control_to_backbone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module_id text;
  v_risk_id text;
  v_status text;
BEGIN
  -- Seek corresponding risk or module
  SELECT id::text, module_id INTO v_risk_id, v_module_id 
    FROM risks 
   WHERE obligation_id = NEW.obligation_id 
   LIMIT 1;

  v_module_id := COALESCE(v_module_id, 'risk');
  IF NOT EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = NEW.tenant_id AND id = v_module_id) THEN
    v_module_id := 'risk';
  END IF;

  v_status := CASE
    WHEN NEW.status = 'Efectivo' THEN 'Conforme'
    WHEN NEW.status = 'Parcial' THEN 'En revision'
    ELSE 'Pendiente'
  END;

  INSERT INTO grc_controls (
    tenant_id, id, module_id, obligation_id, risk_id, name, description, owner, frequency, status, evidence_required, payload, updated_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id::text,
    v_module_id,
    NEW.obligation_id::text,
    v_risk_id,
    NEW.name,
    'Control mitigante sincronizado de forma transparente.',
    'Control Owner',
    'Mensual',
    v_status,
    '[]'::jsonb,
    '{}'::jsonb,
    now()
  )
  ON CONFLICT (tenant_id, id) DO UPDATE SET
    module_id = EXCLUDED.module_id,
    obligation_id = EXCLUDED.obligation_id,
    risk_id = EXCLUDED.risk_id,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_control_to_backbone ON public.controls;
CREATE TRIGGER tg_sync_control_to_backbone
  AFTER INSERT OR UPDATE ON public.controls
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_control_to_backbone();

-- 5. Direct Declarative Backfill of existing records with FK gatekeepers
-- Obligations
INSERT INTO public.grc_obligations (
  tenant_id, id, module_id, framework, reference, obligation, owner, status, severity, authority, payload, updated_at
)
SELECT
  tenant_id,
  id::text,
  CASE
    WHEN code LIKE 'OBL-GDPR-%' THEN 'gdpr'
    WHEN code LIKE 'OBL-DORA-%' THEN 'dora'
    WHEN code LIKE 'OBL-NIS2-%' OR code LIKE 'OBL-ISO%' THEN 'cyber'
    WHEN code LIKE 'OBL-LEY2-%' THEN 'ethics'
    WHEN code LIKE 'OBL-EIOPA-%' THEN 'tprm'
    ELSE 'risk'
  END AS v_module,
  COALESCE(source, 'General'),
  code,
  title,
  'Compliance Manager',
  'En revision',
  CASE
    WHEN criticality = 'Crítico' THEN 'Critico'
    WHEN criticality = 'Alto' THEN 'Alto'
    WHEN criticality = 'Medio' THEN 'Medio'
    ELSE 'Bajo'
  END,
  CASE
    WHEN code LIKE 'OBL-GDPR-%' THEN 'AEPD'
    WHEN code LIKE 'OBL-DORA-%' THEN 'Supervisor financiero'
    ELSE NULL
  END,
  '{}'::jsonb,
  now()
FROM public.obligations
ON CONFLICT (tenant_id, id) DO UPDATE SET
  module_id = EXCLUDED.module_id,
  framework = EXCLUDED.framework,
  reference = EXCLUDED.reference,
  obligation = EXCLUDED.obligation,
  severity = EXCLUDED.severity,
  authority = EXCLUDED.authority,
  updated_at = now();

-- Risks
INSERT INTO public.grc_risks (
  tenant_id, id, module_id, obligation_id, title, description, inherent_severity, residual_severity, owner, status, payload, updated_at
)
SELECT
  r.tenant_id,
  r.id::text,
  CASE 
    WHEN EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = r.tenant_id AND id = r.module_id) THEN r.module_id 
    ELSE 'risk' 
  END AS v_mod,
  r.obligation_id::text,
  r.title,
  r.description,
  CASE
    WHEN r.inherent_score >= 15 THEN 'Critico'
    WHEN r.inherent_score >= 10 THEN 'Alto'
    WHEN r.inherent_score >= 5 THEN 'Medio'
    ELSE 'Bajo'
  END,
  CASE
    WHEN r.residual_score >= 15 THEN 'Critico'
    WHEN r.residual_score >= 10 THEN 'Alto'
    WHEN r.residual_score >= 5 THEN 'Medio'
    ELSE 'Bajo'
  END,
  'Risk Owner',
  CASE
    WHEN r.status = 'Abierto' THEN 'Pendiente'
    WHEN r.status = 'En tratamiento' THEN 'En revision'
    WHEN r.status = 'Mitigado' THEN 'En revision'
    ELSE 'Conforme'
  END,
  '{}'::jsonb,
  now()
FROM public.risks r
ON CONFLICT (tenant_id, id) DO UPDATE SET
  module_id = EXCLUDED.module_id,
  obligation_id = EXCLUDED.obligation_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  inherent_severity = EXCLUDED.inherent_severity,
  residual_severity = EXCLUDED.residual_severity,
  status = EXCLUDED.status,
  updated_at = now();

-- Controls (de-duplicated via DISTINCT ON)
INSERT INTO public.grc_controls (
  tenant_id, id, module_id, obligation_id, risk_id, name, description, owner, frequency, status, evidence_required, payload, updated_at
)
SELECT DISTINCT ON (c.id)
  c.tenant_id,
  c.id::text,
  CASE 
    WHEN EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = c.tenant_id AND id = r.module_id) THEN r.module_id 
    ELSE 'risk' 
  END AS v_mod,
  c.obligation_id::text,
  r.id::text,
  c.name,
  'Control mitigante sincronizado de forma transparente.',
  'Control Owner',
  'Mensual',
  CASE
    WHEN c.status = 'Efectivo' THEN 'Conforme'
    WHEN c.status = 'Parcial' THEN 'En revision'
    ELSE 'Pendiente'
  END,
  '[]'::jsonb,
  '{}'::jsonb,
  now()
FROM public.controls c
LEFT JOIN public.risks r ON r.obligation_id = c.obligation_id
ORDER BY c.id, r.created_at DESC
ON CONFLICT (tenant_id, id) DO UPDATE SET
  module_id = EXCLUDED.module_id,
  obligation_id = EXCLUDED.obligation_id,
  risk_id = EXCLUDED.risk_id,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = now();
