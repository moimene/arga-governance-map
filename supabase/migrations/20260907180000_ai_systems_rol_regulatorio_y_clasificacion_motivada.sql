-- Rol regulatorio y clasificación motivada en el inventario de sistemas de IA.
--
-- POR QUÉ AQUÍ Y NO EN EL BACKBONE `aims_*`
-- -----------------------------------------
-- Decisión expresa del usuario (2026-09-07): el inventario sigue viviendo en
-- `ai_systems` y el backbone `aims_*` se reserva para lo que no tiene sitio en
-- legacy (evidencias, versiones, registro de modelos y datasets). Migrar el
-- alta al backbone obligaba a reescribir cinco pantallas y a mover los ocho
-- sistemas de ARGA, contra el contrato de cero cambio.
--
-- QUÉ FALTABA, MEDIDO SOBRE EL PRIMER ALTA REAL
-- ---------------------------------------------
-- Harvey (`2f877e8c…`, tenant Garrigues) se dio de alta con ocho campos:
-- nombre, tipo, nivel de riesgo, proveedor, fecha, estado, caso de uso y
-- descripción. Ni responsable, ni rol del despacho respecto al sistema, ni
-- motivación de la clasificación de riesgo.
--
-- El rol importa porque las obligaciones del Reglamento (UE) 2024/1689 se
-- determinan por POSICIÓN REGULATORIA, no por taxonomía técnica: un
-- responsable del despliegue de riesgo limitado no debe medirse contra el
-- catálogo de un proveedor de alto riesgo. La clasificación importa porque el
-- art. 6.3 exige documentar la evaluación cuando se concluye que un sistema del
-- anexo III no es de alto riesgo.
--
-- TODAS LAS COLUMNAS SON NULLABLE: ARGA con NULL = cero cambio.

alter table public.ai_systems
  add column if not exists regulatory_role text,
  add column if not exists regulatory_profile jsonb;

-- Vocabulario cerrado, con los términos del propio Reglamento en su versión
-- española. `RESPONSABLE_DESPLIEGUE` es el art. 3.4 («deployer» en inglés);
-- `PROVEEDOR_POSTERIOR` es el art. 3.68 («downstream provider»). No se añade
-- «entidad financiera usuaria», que no es una figura del Reglamento sino un
-- perfil sectorial de la auditoría de origen.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ai_systems'::regclass and conname = 'ai_systems_regulatory_role_check'
  ) then
    alter table public.ai_systems
      add constraint ai_systems_regulatory_role_check
      check (regulatory_role is null or regulatory_role in (
        'PROVEEDOR',
        'RESPONSABLE_DESPLIEGUE',
        'IMPORTADOR',
        'DISTRIBUIDOR',
        'PROVEEDOR_GPAI',
        'PROVEEDOR_POSTERIOR'
      ));
  end if;
end $$;

comment on column public.ai_systems.regulatory_role is
  'Posición regulatoria de la entidad respecto al sistema (Reglamento (UE) 2024/1689, arts. 3.3, 3.4, 3.6, 3.7 y 3.68). Determina qué obligaciones aplican. NULL = no declarado.';

comment on column public.ai_systems.regulatory_profile is
  'Motivación con fecha y autor: respuestas del cuestionario de calificación de rol (art. 25) y de la clasificación de riesgo (arts. 5, 6, anexo III y 50). NULL = no declarado.';

-- Un código de referencia AIMS repetido dentro del mismo tenant rompe cualquier
-- lectura por código. Parcial porque hoy sólo 3 de 9 sistemas lo tienen, y no
-- se va a inventar uno para los otros seis.
create unique index if not exists ux_ai_systems_tenant_aims_reference_code
  on public.ai_systems (tenant_id, aims_reference_code)
  where aims_reference_code is not null;

-- `ai_systems_owner_id_fkey` apunta a `persons(id)` a secas: acepta el
-- responsable de OTRO tenant. No se puede cerrar con una FK compuesta porque
-- `persons` no tiene UNIQUE (tenant_id, id) y añadírselo tocaría una tabla del
-- núcleo que usa medio producto. Se cierra con el guard mínimo.
create or replace function public.fn_ai_systems_owner_mismo_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_owner_tenant uuid;
begin
  if new.owner_id is null then
    return new;
  end if;
  select p.tenant_id into v_owner_tenant from public.persons p where p.id = new.owner_id;
  if v_owner_tenant is null then
    raise exception 'OWNER_NO_EXISTE: la persona % no existe', new.owner_id
      using errcode = '23503';
  end if;
  if v_owner_tenant <> new.tenant_id then
    raise exception 'OWNER_DE_OTRO_TENANT: el responsable no pertenece al tenant del sistema'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_ai_systems_owner_mismo_tenant on public.ai_systems;
create trigger trg_ai_systems_owner_mismo_tenant
  before insert or update of owner_id, tenant_id on public.ai_systems
  for each row execute function public.fn_ai_systems_owner_mismo_tenant();

-- Verificación que ABORTA la migración entera si algo no quedó cerrado, con
-- control positivo del propio instrumento: sin él, un bloque que no comprobara
-- nada pasaría por verificación.
do $verificacion$
declare
  v_cols int;
  v_check int;
  v_idx int;
  v_trg int;
  v_instrumento int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema = 'public' and table_name = 'ai_systems'
     and column_name in ('regulatory_role', 'regulatory_profile');
  if v_cols <> 2 then
    raise exception 'VERIFICACION: faltan columnas (esperadas 2, encontradas %)', v_cols;
  end if;

  select count(*) into v_check from pg_constraint
   where conrelid = 'public.ai_systems'::regclass and conname = 'ai_systems_regulatory_role_check';
  if v_check <> 1 then
    raise exception 'VERIFICACION: el CHECK del rol regulatorio no existe';
  end if;

  select count(*) into v_idx from pg_indexes
   where schemaname = 'public' and indexname = 'ux_ai_systems_tenant_aims_reference_code';
  if v_idx <> 1 then
    raise exception 'VERIFICACION: falta el único por tenant de aims_reference_code';
  end if;

  select count(*) into v_trg from pg_trigger
   where tgrelid = 'public.ai_systems'::regclass and tgname = 'trg_ai_systems_owner_mismo_tenant';
  if v_trg <> 1 then
    raise exception 'VERIFICACION: falta el guard de tenant del responsable';
  end if;

  -- Control positivo: el instrumento tiene que saber decir que NO cuando la
  -- cosa no está. Si esto devolviera 1, las cuatro comprobaciones de arriba
  -- estarían midiendo cualquier cosa.
  select count(*) into v_instrumento from pg_constraint
   where conrelid = 'public.ai_systems'::regclass and conname = 'constraint_que_no_existe_jamas';
  if v_instrumento <> 0 then
    raise exception 'VERIFICACION: el instrumento encuentra lo que no existe';
  end if;

  raise notice 'VERIFICACION OK: 2 columnas, CHECK del rol, único por tenant y guard del responsable';
end;
$verificacion$;
