-- 20260920130000_grc_modulo_ia_y_rama_ria.sql
--
-- F5.T3 — el RIA necesita un sitio en GRC donde vivir.
--
-- POR QUÉ
-- -------
-- El experto (§7, punto 5) coloca las obligaciones de ORGANIZACIÓN del RIA
-- —art. 4, sistema de gestión de la calidad del art. 17, protocolos del art. 26—
-- en el registro que GRC ya tiene (`obligations`, `controls`, `policies`), y deja
-- que AIMS las LEA sin escribirlas. Hoy eso no se puede hacer: medido el
-- 2026-09-20, `grc_modules` no tiene el módulo `ai` en ningún tenant, y
-- `fn_sync_obligation_to_backbone` no tiene rama para los códigos del RIA, así
-- que una obligación `OBL-RIA-*` caería en el `ELSE` y aparecería como riesgo.
--
-- QUÉ HACE, Y QUÉ NO
-- ------------------
--   * Crea la fila `ai` de `grc_modules` en ARGA y en Garrigues, con su órgano
--     responsable real: el Comité de Gobernanza de la IA en Garrigues y el CATIT
--     en ARGA (decisión D-U2 del usuario, aceptada el 2026-09-20; los dos órganos
--     existen en `governing_bodies`, comprobado).
--   * Añade la rama `OBL-RIA-%` -> 'ai'. El `ELSE 'risk'` **se conserva**.
--   * `authority` se deja NULL a propósito: para una entidad financiera la
--     autoridad del RIA no es AESIA por defecto, y afirmarlo sería fabricar un
--     dato. Lo decide el catálogo, no el trigger.
--   * `state = 'MVP'` y no 'Activo': el módulo existe, pero su programa de
--     obligaciones del RIA arranca con cero filas. Que lo diga el dato.
--   * `route = '/ai-governance'`, que es la pantalla que EXISTE hoy. La spec
--     apunta a `/ai-governance/programa`, que es F6: enlazar a una página que no
--     existe sería un enlace roto.
--   * Índice único `(tenant_id, code)` en `obligations`: medido, 0 duplicados.
--     Es lo que hace de verdad idempotente a la siembra por código, en vez de un
--     SELECT-antes-de-INSERT que se puede colar por carrera.
--   * NO se toca el tenant `…0003`, que es de otra sesión.
--   * NO se convierte en RAISE el segundo repliegue (módulo inexistente en el
--     tenant). Medido: hoy no lo usa ninguna fila, pero `…0003` no tiene 'aml'
--     ni 'dora', y endurecerlo ahora rompería el alta de otra sesión. Queda
--     declarado como deuda; lo vigila el gate G-SYNC, no el servidor.
--
-- Ensayo previo: sonda revertida el 2026-09-20 con control positivo en los dos
-- tenants y ROLLBACK.

begin;

-- 1. El módulo, en los dos tenants del programa. Aditivo e idempotente.
insert into public.grc_modules (tenant_id, id, name, description, state, route, regulations, owner)
values
  ('00000000-0000-0000-0000-000000000001', 'ai', 'Gobernanza de la IA',
   'Obligaciones de organización del Reglamento (UE) 2024/1689 (RIA), modificado por el Reglamento (UE) 2026/1744: alfabetización, gestión de la calidad y protocolos de uso. El inventario de sistemas y su clasificación viven en el módulo de IA.',
   'MVP', '/ai-governance', '["Reglamento (UE) 2024/1689", "Reglamento (UE) 2026/1744"]'::jsonb,
   'Comité Asesor de Tecnología e Innovación (CATIT)'),
  ('00000000-0000-0000-0000-000000000002', 'ai', 'Gobernanza de la IA',
   'Obligaciones de organización del Reglamento (UE) 2024/1689 (RIA), modificado por el Reglamento (UE) 2026/1744: alfabetización, gestión de la calidad y protocolos de uso. El inventario de sistemas y su clasificación viven en el módulo de IA.',
   'MVP', '/ai-governance', '["Reglamento (UE) 2024/1689", "Reglamento (UE) 2026/1744"]'::jsonb,
   'Comité de Gobernanza de la Inteligencia Artificial')
on conflict (tenant_id, id) do nothing;

-- 2. Unicidad por tenant del código de obligación (0 duplicados, medido).
create unique index if not exists ux_obligations_tenant_code
  on public.obligations (tenant_id, code);

-- 3. La rama del RIA en el sincronizador.
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
    -- RIA: obligaciones de organización del Reglamento (UE) 2024/1689.
    WHEN NEW.code LIKE 'OBL-RIA-%' THEN 'ai'
    WHEN NEW.code LIKE 'OBL-NIS2-%'
      OR NEW.code LIKE 'OBL-ISO%'
      OR NEW.code LIKE 'OBL-GARR-CYBER-%'
      OR NEW.code LIKE 'OBL-GARR-NIS2-%' THEN 'cyber'
    -- `OBL-PBC-%` es el prefijo REAL de Garrigues (F5.T14).
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
      -- 'ai' deliberadamente sin autoridad: para una entidad financiera no es
      -- AESIA por defecto, y el trigger no es quien debe decidirlo.
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

-- 4. Verificación que ABORTA, con control positivo del instrumento.
do $verificacion$
declare
  v_mod int;
  v text;
  t uuid;
begin
  select count(*) into v_mod from public.grc_modules
   where id = 'ai' and tenant_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
  if v_mod <> 2 then raise exception 'V1: se esperaban 2 filas del módulo ai y hay %', v_mod; end if;

  -- El tenant de otra sesión no se toca.
  if exists (select 1 from public.grc_modules where id='ai' and tenant_id='00000000-0000-0000-0000-000000000003') then
    raise exception 'V2: se ha creado el módulo ai en un tenant que no es del programa';
  end if;

  -- V3, control positivo REVERTIDO en los DOS tenants.
  foreach t in array array['00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid]
  loop
    begin
      insert into public.obligations (tenant_id, code, title)
      values (t, 'OBL-RIA-VERIF', 'control positivo de la migración');
      select module_id into v from public.grc_obligations where tenant_id = t and reference = 'OBL-RIA-VERIF';
      raise exception 'REVERTIR:%', coalesce(v, '(sin fila)');
    exception when others then
      if sqlerrm <> 'REVERTIR:ai' then
        raise exception 'V3: en % la obligación del RIA no cayó en ai -> %', t, sqlerrm;
      end if;
    end;
  end loop;

  -- V4, control negativo: lo de PBC sigue en aml y el ELSE sigue vivo.
  if (select count(*) from public.grc_obligations
       where tenant_id='00000000-0000-0000-0000-000000000002' and module_id='aml') <> 21 then
    raise exception 'V4: se han movido las 21 de PBC/FT';
  end if;

  raise notice 'F5.T3 OK: módulo ai en los dos tenants, OBL-RIA-%% -> ai, PBC/FT intacto';
end $verificacion$;

commit;
