-- G5 — el sync al backbone dejaba de decir la verdad para riesgos sin score.
--
-- fn_sync_risk_to_backbone traducia inherent_score/residual_score a una banda
-- con nombre, y su CASE cae en ELSE 'Bajo' cuando el score es NULL. Un riesgo
-- evaluado por color, que no tiene ejes de probabilidad x impacto, acababa
-- registrado en grc_risks como 'Bajo' sin que ninguna pantalla lo mostrara.
--
-- grc_risks.inherent_severity es NOT NULL DEFAULT 'Medio', asi que no se puede
-- propagar NULL: se amplia el dominio con 'No evaluado', que es lo que es.

CREATE OR REPLACE FUNCTION public.fn_sync_risk_to_backbone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_module_id text;
  v_inherent_severity text;
  v_residual_severity text;
  v_status text;
BEGIN
  v_module_id := COALESCE(NEW.module_id, 'risk');
  IF NOT EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = NEW.tenant_id AND id = v_module_id) THEN
    v_module_id := 'risk';
  END IF;

  v_inherent_severity := CASE
    WHEN NEW.inherent_score IS NULL THEN 'No evaluado'
    WHEN NEW.inherent_score >= 15 THEN 'Critico'
    WHEN NEW.inherent_score >= 10 THEN 'Alto'
    WHEN NEW.inherent_score >= 5  THEN 'Medio'
    ELSE 'Bajo'
  END;

  v_residual_severity := CASE
    WHEN NEW.residual_score IS NULL THEN 'No evaluado'
    WHEN NEW.residual_score >= 15 THEN 'Critico'
    WHEN NEW.residual_score >= 10 THEN 'Alto'
    WHEN NEW.residual_score >= 5  THEN 'Medio'
    ELSE 'Bajo'
  END;

  v_status := CASE
    WHEN NEW.status = 'Abierto' THEN 'Pendiente'
    WHEN NEW.status = 'En tratamiento' THEN 'En revision'
    WHEN NEW.status = 'Mitigado' THEN 'En revision'
    ELSE 'Conforme'
  END;

  INSERT INTO grc_risks (
    tenant_id, id, module_id, obligation_id, title, description,
    inherent_severity, residual_severity, owner, status, payload, updated_at
  ) VALUES (
    NEW.tenant_id, NEW.id::text, v_module_id, NEW.obligation_id::text,
    NEW.title, NEW.description, v_inherent_severity, v_residual_severity,
    'Risk Owner', v_status, '{}'::jsonb, now()
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
$fn$;
