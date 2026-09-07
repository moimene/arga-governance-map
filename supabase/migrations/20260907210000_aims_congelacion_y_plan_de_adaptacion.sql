-- Congelación de un autodiagnóstico y Plan de Adaptación estructurado.
--
-- DOS HUECOS DEL PILOTO
-- ---------------------
-- 1. Una evaluación guardada seguía siendo editable, sin versión ni huella. La
--    custodia tiene que distinguir evidencia VIVA de evidencia CONGELADA, y
--    poder fijar una versión por hito.
-- 2. El Plan de Adaptación vive como PROSA en `notes`. En el piloto de Harvey
--    son seis acciones con responsable, prioridad y fecha, escritas a mano en
--    un párrafo: no se puede filtrar, ni ordenar, ni saber cuántas vencen.
--
-- EL HASH SÍ ES DE SERVIDOR, Y ESO IMPORTA
-- ----------------------------------------
-- A diferencia del de las evidencias —que se calcula en el navegador porque el
-- fichero nunca llega a la base de datos—, aquí el contenido YA ESTÁ en la
-- fila. La RPC lo serializa de forma canónica y lo hashea en el servidor con
-- `sha512`, así que la huella no depende de lo que diga un cliente.
--
-- Lo que sigue sin acreditar: **fecha cierta**. `now()` es la hora del
-- servidor, no un sello de tiempo cualificado. Se registra quién y cuándo, que
-- es lo que hace falta para auditoría interna, y se dice que no es más que eso.
--
-- APROBACIÓN POR PERSONA DISTINTA
-- ------------------------------
-- ISO/IEC 42001 cláusula 9.3 (revisión por la dirección) pide que revise quien
-- no evaluó. El guard es duro: mismo usuario evaluador y aprobador → 42501.

alter table public.ai_risk_assessments
  add column if not exists frozen_at timestamptz,
  add column if not exists frozen_by_id uuid,
  add column if not exists content_hash text,
  add column if not exists reviewed_by_id uuid,
  add column if not exists reviewed_at timestamptz,
  -- Acciones del Plan de Adaptación: `[{id, measureCode, titulo, owner_id,
  -- prioridad, vence_el, estado}]`. Nullable — las 8 filas anteriores no lo
  -- tienen y no se les inventa uno.
  add column if not exists action_plan jsonb;

comment on column public.ai_risk_assessments.content_hash is
  'SHA-512 calculado EN SERVIDOR sobre la serialización canónica de la evaluación al congelarla. Acredita integridad e identidad de quien congela; NO acredita fecha cierta (no hay sello de tiempo cualificado).';
comment on column public.ai_risk_assessments.action_plan is
  'Plan de Adaptación como acciones estructuradas. Antes vivía como prosa en notes.';

-- Una evaluación congelada no se toca. El trigger es la única defensa real:
-- la RLS deja actualizar la fila y el cliente podría enviar cualquier cosa.
create or replace function public.fn_aims_assessment_congelada_inmutable()
returns trigger
language plpgsql
as $fn$
begin
  if old.frozen_at is null then
    return new;
  end if;
  -- Congelada. Sólo se admite el paso de revisión/aprobación, que es
  -- posterior por diseño: se revisa lo que ya no se puede cambiar.
  if new.findings is distinct from old.findings
     or new.status is distinct from old.status
     or new.score is distinct from old.score
     or new.notes is distinct from old.notes
     or new.action_plan is distinct from old.action_plan
     or new.framework is distinct from old.framework
     or new.system_id is distinct from old.system_id
     or new.content_hash is distinct from old.content_hash
     or new.frozen_at is distinct from old.frozen_at
     or new.frozen_by_id is distinct from old.frozen_by_id then
    raise exception 'EVALUACION_CONGELADA: la evaluación % está congelada desde %', old.id, old.frozen_at
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_aims_assessment_congelada_inmutable on public.ai_risk_assessments;
create trigger trg_aims_assessment_congelada_inmutable
  before update on public.ai_risk_assessments
  for each row execute function public.fn_aims_assessment_congelada_inmutable();

/**
 * Congela una evaluación y devuelve su huella.
 *
 * SECURITY DEFINER porque tiene que hashear en servidor, pero **asierta el
 * tenant del llamante**: `ai_risk_assessments` no tiene columna de tenant, así
 * que el scoping va por el join con `ai_systems`. Sin este assert, la RPC
 * sería una escritura cross-tenant con privilegios elevados — el mismo defecto
 * que se cerró en `fn_aims_close_technical_file` el 2026-09-06.
 */
create or replace function public.fn_aims_freeze_assessment(p_assessment_id uuid)
returns table (id uuid, content_hash text, frozen_at timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_row public.ai_risk_assessments%rowtype;
  v_canonico text;
  v_hash text;
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  select a.* into v_row
    from public.ai_risk_assessments a
    join public.ai_systems s on s.id = a.system_id
   where a.id = p_assessment_id and s.tenant_id = v_tenant
   for update;

  if not found then
    raise exception 'NO_ENCONTRADA: la evaluación no existe en este tenant' using errcode = '42501';
  end if;

  if v_row.frozen_at is not null then
    raise exception 'YA_CONGELADA: congelada el %', v_row.frozen_at using errcode = '42501';
  end if;

  if v_row.status = 'BORRADOR' then
    raise exception 'BORRADOR_NO_CONGELABLE: cierra el autodiagnóstico antes de congelarlo'
      using errcode = '42501';
  end if;

  -- Serialización CANÓNICA: claves ordenadas por `jsonb`, así que dos filas
  -- con el mismo contenido dan el mismo hash aunque se hayan escrito en otro
  -- orden. Se incluye el sistema para que la huella no sea transplantable.
  v_canonico := (
    jsonb_build_object(
      'assessment_id', v_row.id,
      'system_id', v_row.system_id,
      'framework', v_row.framework,
      'assessment_date', v_row.assessment_date,
      'status', v_row.status,
      'score', v_row.score,
      'findings', coalesce(v_row.findings, '[]'::jsonb),
      'action_plan', coalesce(v_row.action_plan, '[]'::jsonb),
      'notes', coalesce(v_row.notes, '')
    )
  )::text;
  v_hash := encode(sha512(convert_to(v_canonico, 'UTF8')), 'hex');

  update public.ai_risk_assessments a
     set content_hash = v_hash,
         frozen_at = now(),
         frozen_by_id = auth.uid()
   where a.id = p_assessment_id;

  return query
    select a.id, a.content_hash, a.frozen_at
      from public.ai_risk_assessments a
     where a.id = p_assessment_id;
end;
$fn$;

revoke all on function public.fn_aims_freeze_assessment(uuid) from public, anon;
grant execute on function public.fn_aims_freeze_assessment(uuid) to authenticated;

/**
 * Aprueba una evaluación congelada. La firma quien NO la evaluó.
 */
create or replace function public.fn_aims_review_assessment(p_assessment_id uuid)
returns table (id uuid, reviewed_by_id uuid, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tenant uuid := public.fn_current_tenant_id();
  v_row public.ai_risk_assessments%rowtype;
  v_quien uuid := auth.uid();
begin
  if v_tenant is null then
    raise exception 'SIN_TENANT: la sesión no resuelve un tenant' using errcode = '42501';
  end if;

  select a.* into v_row
    from public.ai_risk_assessments a
    join public.ai_systems s on s.id = a.system_id
   where a.id = p_assessment_id and s.tenant_id = v_tenant
   for update;

  if not found then
    raise exception 'NO_ENCONTRADA: la evaluación no existe en este tenant' using errcode = '42501';
  end if;

  if v_row.frozen_at is null then
    raise exception 'NO_CONGELADA: se revisa lo que ya no puede cambiar' using errcode = '42501';
  end if;

  if v_row.reviewed_at is not null then
    raise exception 'YA_REVISADA: revisada el %', v_row.reviewed_at using errcode = '42501';
  end if;

  -- Cláusula 9.3 de ISO/IEC 42001: revisa quien no evaluó. `frozen_by_id` es
  -- quien cerró la evaluación; si la aprobara la misma cuenta, la revisión no
  -- añadiría ningún control.
  if v_quien is not null and v_quien = v_row.frozen_by_id then
    raise exception 'MISMO_EVALUADOR: la revisión la firma una persona distinta de quien congeló'
      using errcode = '42501';
  end if;

  update public.ai_risk_assessments a
     set reviewed_by_id = v_quien, reviewed_at = now()
   where a.id = p_assessment_id;

  return query
    select a.id, a.reviewed_by_id, a.reviewed_at
      from public.ai_risk_assessments a
     where a.id = p_assessment_id;
end;
$fn$;

revoke all on function public.fn_aims_review_assessment(uuid) from public, anon;
grant execute on function public.fn_aims_review_assessment(uuid) to authenticated;

do $verificacion$
declare
  v_cols int;
  v_fn int;
  v_trg int;
  v_anon int;
  v_instrumento int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_risk_assessments'
     and column_name in ('frozen_at', 'frozen_by_id', 'content_hash', 'reviewed_by_id', 'reviewed_at', 'action_plan');
  if v_cols <> 6 then
    raise exception 'VERIFICACION: esperadas 6 columnas nuevas, hay %', v_cols;
  end if;

  select count(*) into v_fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('fn_aims_freeze_assessment', 'fn_aims_review_assessment');
  if v_fn <> 2 then
    raise exception 'VERIFICACION: faltan RPC (esperadas 2, hay %)', v_fn;
  end if;

  select count(*) into v_trg from pg_trigger
   where tgrelid = 'public.ai_risk_assessments'::regclass
     and tgname = 'trg_aims_assessment_congelada_inmutable';
  if v_trg <> 1 then
    raise exception 'VERIFICACION: falta el guard de inmutabilidad de la congelada';
  end if;

  select count(*) into v_anon from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('fn_aims_freeze_assessment', 'fn_aims_review_assessment')
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_anon <> 0 then
    raise exception 'VERIFICACION: anon puede ejecutar % de las RPC', v_anon;
  end if;

  select count(*) into v_instrumento from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'fn_que_no_existe_jamas';
  if v_instrumento <> 0 then
    raise exception 'VERIFICACION: el instrumento encuentra lo que no existe';
  end if;

  raise notice 'VERIFICACION OK: 6 columnas, 2 RPC sin anon, y el guard de la congelada';
end;
$verificacion$;
