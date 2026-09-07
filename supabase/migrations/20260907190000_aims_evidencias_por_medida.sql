-- Evidencias probatorias por medida del autodiagnóstico.
--
-- EL HUECO
-- --------
-- Una medida en `L5` («documentada e implementada») sin nada detrás es una
-- autodeclaración. En el primer piloto real hay **40 medidas en L5 y cero
-- evidencias** en toda la instalación: el módulo no tenía dónde guardarlas.
--
-- QUÉ SE PUEDE AFIRMAR Y QUÉ NO
-- -----------------------------
-- El hash se calcula en el NAVEGADOR con Web Crypto y se guarda con el
-- registro. Eso acredita que el fichero no ha cambiado desde que se registró.
-- **No acredita fecha cierta, ni identidad del firmante, ni integridad
-- contextual**: para eso hacen falta un sello de tiempo cualificado y archivo
-- cualificado, que no están integrados.
--
-- Por eso `evidentiary_posture` sólo admite `REFERENCE`. Las posturas
-- superiores (paquete auditado, listo para bloqueo legal) exigen un artefacto
-- que hoy no existe, y dejarlas alcanzables desde la aplicación permitiría
-- acuñar una calidad probatoria que nadie ha producido. Ampliarlas exigirá una
-- migración, que es exactamente la fricción que deben tener.
--
-- ALGORITMO: **SHA-512**, el mismo que la cadena WORM de `audit_log` y los
-- `evidence_bundles`. La propuesta de origen decía SHA-256; se unifica hacia
-- arriba para que todo el backbone tenga un solo estándar.

create table if not exists public.aims_evidence_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  system_id uuid not null references public.ai_systems(id),
  kind text not null,
  title text not null,
  -- Ruta dentro del bucket privado, o referencia externa. Al menos una.
  storage_path text,
  external_ref text,
  /** Hexadecimal SHA-512 del contenido. Nulo si sólo hay referencia externa. */
  content_hash text,
  hash_algorithm text not null default 'SHA-512',
  /** `CLIENTE` mientras no haya un renderizador autoritativo que lo calcule. */
  hash_computed_in text not null default 'CLIENTE',
  document_date date,
  /** Caducidad declarada: una ISO o un SOC 2 valen un año. */
  expires_on date,
  uploaded_by uuid,
  evidentiary_posture text not null default 'REFERENCE',
  /**
   * A qué se vincula. Array de `{"tipo":"MEDIDA"|"SECCION"|"INCIDENTE","ref":"…"}`.
   * Una misma evidencia se ata a varias medidas SIN duplicar el fichero: un
   * informe SOC 2 del proveedor sirve para seguridad, gobernanza y gestión de
   * proveedor a la vez.
   */
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint aims_evidence_items_origen_check
    check (storage_path is not null or external_ref is not null),
  constraint aims_evidence_items_posture_check
    check (evidentiary_posture = 'REFERENCE'),
  constraint aims_evidence_items_hash_algorithm_check
    check (hash_algorithm = 'SHA-512'),
  constraint aims_evidence_items_hash_origen_check
    check (hash_computed_in in ('CLIENTE', 'SERVIDOR')),
  constraint aims_evidence_items_kind_check
    check (kind in ('DOCUMENTO', 'CERTIFICADO', 'INFORME', 'CONTRATO', 'REGISTRO', 'OTRO')),
  constraint aims_evidence_items_links_check
    check (jsonb_typeof(links) = 'array')
);

comment on table public.aims_evidence_items is
  'Evidencia probatoria vinculada a medidas del autodiagnóstico, secciones del expediente técnico o incidentes. Postura REFERENCE: hash de integridad calculado en cliente, sin sello de tiempo cualificado ni archivo cualificado.';

create index if not exists ix_aims_evidence_items_tenant_system
  on public.aims_evidence_items (tenant_id, system_id);
create index if not exists ix_aims_evidence_items_links
  on public.aims_evidence_items using gin (links jsonb_path_ops);
-- Un mismo fichero no se registra dos veces para el mismo sistema.
create unique index if not exists ux_aims_evidence_items_hash
  on public.aims_evidence_items (tenant_id, system_id, content_hash)
  where content_hash is not null;

alter table public.aims_evidence_items enable row level security;

drop policy if exists aims_evidence_items_tenant_select on public.aims_evidence_items;
create policy aims_evidence_items_tenant_select
  on public.aims_evidence_items for select to authenticated
  using (tenant_id = public.fn_current_tenant_id());

drop policy if exists aims_evidence_items_tenant_insert on public.aims_evidence_items;
create policy aims_evidence_items_tenant_insert
  on public.aims_evidence_items for insert to authenticated
  with check (tenant_id = public.fn_current_tenant_id());

-- UPDATE existe sólo para reatar vínculos y declarar caducidad. Lo demás lo
-- congela el trigger de abajo: si el hash o la ruta fueran editables, el
-- registro dejaría de acreditar nada.
drop policy if exists aims_evidence_items_tenant_update on public.aims_evidence_items;
create policy aims_evidence_items_tenant_update
  on public.aims_evidence_items for update to authenticated
  using (tenant_id = public.fn_current_tenant_id())
  with check (tenant_id = public.fn_current_tenant_id());

-- SIN política ni grant de DELETE, a propósito: una evidencia registrada no se
-- borra desde la aplicación. Mismo criterio que el canal SII.

revoke all on public.aims_evidence_items from anon;
grant select, insert, update on public.aims_evidence_items to authenticated;

create or replace function public.fn_aims_evidence_items_inmutable()
returns trigger
language plpgsql
as $fn$
begin
  if new.content_hash is distinct from old.content_hash
     or new.storage_path is distinct from old.storage_path
     or new.title is distinct from old.title
     or new.kind is distinct from old.kind
     or new.document_date is distinct from old.document_date
     or new.uploaded_by is distinct from old.uploaded_by
     or new.tenant_id is distinct from old.tenant_id
     or new.system_id is distinct from old.system_id
     or new.hash_algorithm is distinct from old.hash_algorithm
     or new.hash_computed_in is distinct from old.hash_computed_in then
    raise exception 'EVIDENCIA_INMUTABLE: sólo se pueden actualizar los vínculos y la caducidad'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_aims_evidence_items_inmutable on public.aims_evidence_items;
create trigger trg_aims_evidence_items_inmutable
  before update on public.aims_evidence_items
  for each row execute function public.fn_aims_evidence_items_inmutable();

-- ---------------------------------------------------------------------------
-- Bucket privado por tenant.
--
-- El primer segmento de la ruta ES el tenant y la política lo comprueba. No se
-- resuelve el dueño «por la ruta» como hubo que hacer en `matter-documents`,
-- donde conviven CUATRO convenciones históricas y sólo 70 de 389 objetos
-- llevaban el tenant delante: aquí el bucket nace vacío, así que la convención
-- se impone desde el primer objeto.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('aims-evidence', 'aims-evidence', false, 26214400)
on conflict (id) do nothing;

drop policy if exists aims_evidence_bucket_select on storage.objects;
create policy aims_evidence_bucket_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'aims-evidence'
    and (storage.foldername(name))[1] = public.fn_current_tenant_id()::text
  );

drop policy if exists aims_evidence_bucket_insert on storage.objects;
create policy aims_evidence_bucket_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'aims-evidence'
    and (storage.foldername(name))[1] = public.fn_current_tenant_id()::text
  );

-- Sin UPDATE ni DELETE sobre el bucket: el objeto registrado es inmutable y no
-- se borra desde la aplicación.

do $verificacion$
declare
  v_rls boolean;
  v_pol int;
  v_bucket int;
  v_bucket_publico boolean;
  v_pol_storage int;
  v_delete int;
  v_trg int;
  v_instrumento int;
begin
  select relrowsecurity into v_rls from pg_class where oid = 'public.aims_evidence_items'::regclass;
  if not coalesce(v_rls, false) then
    raise exception 'VERIFICACION: la tabla de evidencias no tiene RLS';
  end if;

  select count(*) into v_pol from pg_policies
   where schemaname = 'public' and tablename = 'aims_evidence_items';
  if v_pol <> 3 then
    raise exception 'VERIFICACION: esperadas 3 políticas en aims_evidence_items, hay %', v_pol;
  end if;

  -- Que NO haya política de borrado es parte del contrato, no un olvido.
  select count(*) into v_delete from pg_policies
   where schemaname = 'public' and tablename = 'aims_evidence_items' and cmd in ('DELETE', 'ALL');
  if v_delete <> 0 then
    raise exception 'VERIFICACION: hay política de borrado sobre las evidencias';
  end if;

  select count(*), bool_or(public) into v_bucket, v_bucket_publico
    from storage.buckets where id = 'aims-evidence';
  if v_bucket <> 1 then
    raise exception 'VERIFICACION: falta el bucket aims-evidence';
  end if;
  if v_bucket_publico then
    raise exception 'VERIFICACION: el bucket aims-evidence es PÚBLICO';
  end if;

  select count(*) into v_pol_storage from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('aims_evidence_bucket_select', 'aims_evidence_bucket_insert');
  if v_pol_storage <> 2 then
    raise exception 'VERIFICACION: esperadas 2 políticas de storage, hay %', v_pol_storage;
  end if;

  select count(*) into v_trg from pg_trigger
   where tgrelid = 'public.aims_evidence_items'::regclass
     and tgname = 'trg_aims_evidence_items_inmutable';
  if v_trg <> 1 then
    raise exception 'VERIFICACION: falta el guard de inmutabilidad';
  end if;

  -- Control positivo del propio instrumento.
  select count(*) into v_instrumento from pg_policies
   where schemaname = 'public' and tablename = 'tabla_que_no_existe_jamas';
  if v_instrumento <> 0 then
    raise exception 'VERIFICACION: el instrumento encuentra lo que no existe';
  end if;

  raise notice 'VERIFICACION OK: RLS, 3 políticas sin borrado, bucket privado, 2 políticas de storage y guard de inmutabilidad';
end;
$verificacion$;
