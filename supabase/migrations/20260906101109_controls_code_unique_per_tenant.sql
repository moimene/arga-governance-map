-- ARGA tenía DOS controles con código CTR-004 (medido 2026-09-06):
--   faf7131b (2026-04-17) «Procedimiento de notificación de incidentes DORA»
--   db07c309 (2026-04-19) «Gestión de parches ICT críticos en plazo <15 días»
-- useControlByCode hacía .maybeSingle() y la ficha no abría ninguno. El hook
-- ya es determinista; esto cierra la raíz: el segundo pasa a CTR-009 (el mayor
-- de ARGA era CTR-008) y el código deja de poder repetirse por tenant.
DO $fix$
DECLARE n int;
BEGIN
  UPDATE public.controls SET code = 'CTR-009'
   WHERE id = 'db07c309-a873-4fe9-97b5-7e7c4848abc4' AND code = 'CTR-004'
     AND NOT EXISTS (SELECT 1 FROM public.controls x WHERE x.tenant_id = controls.tenant_id AND x.code = 'CTR-009');
  SELECT count(*) INTO n FROM (SELECT tenant_id, code FROM public.controls GROUP BY 1,2 HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'quedan % códigos de control duplicados por tenant', n; END IF;
END
$fix$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_controls_tenant_code ON public.controls (tenant_id, code);
