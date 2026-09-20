-- 20260920120000_grc_sync_obligaciones_pbc_aml.sql
--
-- F5.T14 — corrección de un defecto VIVO del carril GRC.
--
-- QUÉ ESTÁ MAL HOY
-- ----------------
-- `fn_sync_obligation_to_backbone` clasifica cada obligación en un módulo de GRC
-- por el prefijo de su código. Su rama de prevención del blanqueo dice
-- `OBL-GARR-PBC-%` (20260820130000_g6_cyber_module_and_sync.sql), pero los
-- códigos reales del tenant Garrigues son `OBL-PBC-%`. Resultado medido el
-- 2026-09-20, fila a fila: las **21** obligaciones de PBC/FT de Garrigues
-- (OBL-PBC-01 … OBL-PBC-20 y OBL-PBC-EX-22) cayeron en el `ELSE` y están en
-- `grc_obligations.module_id = 'risk'` («Riesgos penales») en vez de 'aml'
-- («PBC/FT»), que SÍ existe en su tenant. Ningún test lo vigilaba: el de
-- ciberseguridad solo comprueba las suyas.
--
-- QUÉ NO SE TOCA, Y POR QUÉ
-- -------------------------
--   * El `ELSE 'risk'` **se conserva**. Las 3 obligaciones de ARGA que caen ahí
--     (OBL-LGPD-001, OBL-ORSA-001, OBL-SII-001) no están mal clasificadas por un
--     defecto: ARGA no tiene módulo de LGPD ni de Solvencia II, y el catch-all es
--     la respuesta honesta. Convertirlo en RAISE rompería su alta.
--   * La rama vieja `OBL-GARR-PBC-%` se conserva aunque hoy no case con nada:
--     retirarla no arregla nada y podría romper un código futuro.
--   * No se toca `public.obligations`: solo el espejo `grc_obligations`.
--   * ARGA no se altera. Ninguna obligación suya empieza por `OBL-PBC-` (medido).
--
-- Ensayo previo: sonda revertida completa el 2026-09-20 (P1-P6), con el UPDATE
-- moviendo exactamente 21 filas, control positivo (OBL-PBC-TEST → 'aml') y
-- control negativo (código sin módulo en ARGA → 'risk'), todo con ROLLBACK.

begin;

-- 1. La función, con la rama que faltaba.
create or replace function public.fn_sync_obligation_to_backbone()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_module_id text;
  v_severity text;
BEGIN
  v_module_id := CASE
    WHEN NEW.code LIKE 'OBL-GDPR-%' THEN 'gdpr'
    WHEN NEW.code LIKE 'OBL-DORA-%' THEN 'dora'
    WHEN NEW.code LIKE 'OBL-NIS2-%'
      OR NEW.code LIKE 'OBL-ISO%'
      OR NEW.code LIKE 'OBL-GARR-CYBER-%'
      OR NEW.code LIKE 'OBL-GARR-NIS2-%' THEN 'cyber'
    -- `OBL-PBC-%` es el prefijo REAL de Garrigues; `OBL-GARR-PBC-%` se conserva
    -- aunque hoy no case con ninguna fila.
    WHEN NEW.code LIKE 'OBL-LEY2-%'
      OR NEW.code LIKE 'OBL-GARR-PBC-%'
      OR NEW.code LIKE 'OBL-PBC-%' THEN 'aml'
    WHEN NEW.code LIKE 'OBL-EIOPA-%' THEN 'tprm'
    ELSE 'risk'
  END;

  IF NOT EXISTS (SELECT 1 FROM grc_modules WHERE tenant_id = NEW.tenant_id AND id = v_module_id) THEN
    v_module_id := 'risk';
  END IF;

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

-- 2. Re-sincronización DECLARADA de las filas ya escritas.
--    Cambiar la función no mueve lo escrito: el trigger solo dispara al insertar
--    o actualizar la obligación. Este UPDATE es acotado y tiene que afectar a
--    exactamente 21 filas; si no, algo no es lo que se midió y aborta.
do $resync$
declare n int;
begin
  update public.grc_obligations
     set module_id = 'aml', updated_at = now()
   where tenant_id = '00000000-0000-0000-0000-000000000002'
     and reference like 'OBL-PBC-%'
     and module_id = 'risk';
  get diagnostics n = row_count;
  if n <> 21 then
    raise exception 'RESYNC: se esperaban 21 filas de Garrigues y se movieron %', n;
  end if;
end $resync$;

-- 3. Verificación que ABORTA, con control positivo del propio instrumento.
do $verificacion$
declare
  v_aml int;
  v_risk_garr int;
  v_risk_arga int;
  v text;
begin
  select count(*) into v_aml from public.grc_obligations
   where tenant_id = '00000000-0000-0000-0000-000000000002' and module_id = 'aml';
  if v_aml <> 21 then raise exception 'V1: Garrigues debería tener 21 en aml y tiene %', v_aml; end if;

  select count(*) into v_risk_garr from public.grc_obligations
   where tenant_id = '00000000-0000-0000-0000-000000000002' and module_id = 'risk';
  if v_risk_garr <> 0 then raise exception 'V2: a Garrigues le quedan % en risk', v_risk_garr; end if;

  -- ARGA no se altera: sus 3 del ELSE siguen donde estaban, más OBL-ERM-APPETITE.
  select count(*) into v_risk_arga from public.grc_obligations
   where tenant_id = '00000000-0000-0000-0000-000000000001' and module_id = 'risk';
  if v_risk_arga <> 4 then raise exception 'V3: ARGA debería conservar 4 en risk y tiene %', v_risk_arga; end if;

  -- V4, control positivo REVERTIDO: una obligación PBC nueva cae en aml.
  begin
    insert into public.obligations (tenant_id, code, title)
    values ('00000000-0000-0000-0000-000000000002', 'OBL-PBC-VERIF', 'control positivo de la migración');
    select module_id into v from public.grc_obligations
     where tenant_id = '00000000-0000-0000-0000-000000000002' and reference = 'OBL-PBC-VERIF';
    raise exception 'REVERTIR:%', coalesce(v, '(sin fila)');
  exception when others then
    if sqlerrm <> 'REVERTIR:aml' then
      raise exception 'V4: el control positivo no cayó en aml -> %', sqlerrm;
    end if;
  end;

  -- V5, control negativo REVERTIDO: el ELSE sigue vivo donde no hay módulo.
  begin
    insert into public.obligations (tenant_id, code, title)
    values ('00000000-0000-0000-0000-000000000001', 'OBL-ZZZ-VERIF', 'control negativo de la migración');
    select module_id into v from public.grc_obligations
     where tenant_id = '00000000-0000-0000-0000-000000000001' and reference = 'OBL-ZZZ-VERIF';
    raise exception 'REVERTIR:%', coalesce(v, '(sin fila)');
  exception when others then
    if sqlerrm <> 'REVERTIR:risk' then
      raise exception 'V5: el ELSE dejó de funcionar -> %', sqlerrm;
    end if;
  end;

  raise notice 'F5.T14 OK: 21 de Garrigues en aml, ARGA con sus 4 en risk, ELSE vivo';
end $verificacion$;

commit;
