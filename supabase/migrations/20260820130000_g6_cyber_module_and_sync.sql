-- supabase/migrations/20260820130000_g6_cyber_module_and_sync.sql
-- G6 — Módulo de Ciberseguridad/SGSI, atribución de PI-26 y enrutamiento de sincronización.
-- Forward-only. Cero cambio para ARGA (00000000-0000-0000-0000-000000000001).

BEGIN;

-- 1. Siembra del módulo cyber en grc_modules para Garrigues
INSERT INTO public.grc_modules (tenant_id, id, name, description, owner)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'cyber',
  'Ciberseguridad y SGSI',
  'Sistema de Gestión de Seguridad de la Información (ISO/IEC 27001 + ENS) y marco prospectivo NIS2.',
  'Comité de Seguridad y Privacidad'
)
ON CONFLICT (tenant_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  owner = EXCLUDED.owner;

-- 2. Atribución del ownership de PI-26 al Comité de Seguridad y Privacidad
UPDATE public.policies
SET
  owner_body_id = '55a47d24-f355-416f-a313-ebf7e018eb4c',
  owner_function = 'Comité de Seguridad de la Información y Privacidad'
WHERE tenant_id = '00000000-0000-0000-0000-000000000002'
  AND policy_code = 'PI-26';

-- 3. Actualización de fn_sync_obligation_to_backbone para enrutar códigos ciber/NIS2
CREATE OR REPLACE FUNCTION public.fn_sync_obligation_to_backbone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_module_id text;
  v_severity text;
BEGIN
  -- Deduce module_id with resilient fallback
  v_module_id := CASE
    WHEN NEW.code LIKE 'OBL-GDPR-%' THEN 'gdpr'
    WHEN NEW.code LIKE 'OBL-DORA-%' THEN 'dora'
    WHEN NEW.code LIKE 'OBL-NIS2-%'
      OR NEW.code LIKE 'OBL-ISO%'
      OR NEW.code LIKE 'OBL-GARR-CYBER-%'
      OR NEW.code LIKE 'OBL-GARR-NIS2-%' THEN 'cyber'
    WHEN NEW.code LIKE 'OBL-LEY2-%' OR NEW.code LIKE 'OBL-GARR-PBC-%' THEN 'aml'
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
    CASE
      WHEN v_module_id = 'gdpr' THEN 'AEPD'
      WHEN v_module_id = 'dora' THEN 'Supervisor financiero'
      WHEN v_module_id = 'cyber' THEN 'CCN-CERT / INCIBE-CERT'
      ELSE NULL
    END,
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
$function$;

COMMIT;
