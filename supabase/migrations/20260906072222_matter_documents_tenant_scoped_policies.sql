-- DA-1 (informe 2026-09-02, único P0 unánime 3/3): el bucket privado
-- `matter-documents` tenía tres políticas de `storage.objects` que
-- discriminaban SOLO por `bucket_id`:
--
--   matter_documents_authenticated_select  USING (bucket_id = 'matter-documents')
--   matter_documents_authenticated_insert  WITH CHECK (bucket_id = 'matter-documents')
--   matter_documents_authenticated_update  ambas, idénticas
--
-- Ninguna nombraba el tenant, así que cualquier sesión autenticada leía y
-- escribía los documentos registrales de cualquier tenant. Medido en vivo el
-- 2026-09-06 con dos logins reales: la sesión de Garrigues descargaba y
-- listaba los justificantes registrales de ARGA
-- (src/test/schema/storage-tenant-isolation.test.ts, en rojo antes de esto).
--
-- POR QUÉ NO SE NORMALIZAN LAS RUTAS. El bucket tiene hoy 389 objetos con
-- CUATRO convenciones de ruta distintas, y solo una lleva el tenant delante:
--
--   convocatorias/<convocatoria_id>/supporting/…   285  (useConvocatorias.ts:651)
--   <tenant_id>/…                                   70  (storage-archiver.ts:126,
--                                                        standalone-certifications/document.ts:328)
--   agreements/<agreement_id>/…                     31  (legado: ningún escritor vivo)
--   registry/<entity_id>/…                           3  (useRegistryEvidenceUpload.ts:41)
--
-- Mover 319 objetos obligaría a reescribir los `document_url` ya persistidos en
-- varias tablas y las URLs firmadas emitidas. La decisión (usuario, 2026-09-06)
-- es cerrar la exposición SIN mover ficheros: se resuelve el tenant dueño a
-- partir de la ruta, con una rama por convención.
--
-- Cobertura medida antes de aplicar: 371 de 389 objetos resuelven tenant
-- (271/285 convocatorias, 27/31 agreements, 3/3 registry, 70/70 prefijo de
-- tenant). Los 18 restantes son objetos cuya fila dueña ya no existe: dejan de
-- ser legibles, que es el comportamiento correcto para un huérfano y no una
-- regresión — ninguna pantalla los referencia.

-- Resolutor del tenant dueño de un objeto del bucket.
-- SECURITY DEFINER a propósito: debe devolver el dueño REAL, no «el que yo
-- puedo ver». Si dependiera de la RLS de las tablas consultadas, la
-- comprobación sería circular y un tenant sin visibilidad sobre la fila dueña
-- obtendría NULL, que aquí significa «deniega» pero por el motivo equivocado.
create or replace function public.fn_matter_document_tenant(p_name text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'storage'
as $fn$
  select case
    -- Prefijo de tenant: `<uuid>/…`. Es el esquema que escriben hoy el
    -- archivador de documentos y las certificaciones autónomas.
    when (storage.foldername(p_name))[1] ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then ((storage.foldername(p_name))[1])::uuid

    when (storage.foldername(p_name))[1] = 'convocatorias'
      then (select c.tenant_id from public.convocatorias c
             where c.id::text = (storage.foldername(p_name))[2])

    when (storage.foldername(p_name))[1] = 'agreements'
      then (select a.tenant_id from public.agreements a
             where a.id::text = (storage.foldername(p_name))[2])

    when (storage.foldername(p_name))[1] = 'registry'
      then (select e.tenant_id from public.entities e
             where e.id::text = (storage.foldername(p_name))[2])

    -- Cualquier convención nueva cae aquí y se DENIEGA. Falla cerrado a
    -- propósito: un esquema de ruta que nadie ha revisado no debe ser legible
    -- por defecto. Si aparece un escritor nuevo, esta función es el sitio.
    else null
  end
$fn$;

comment on function public.fn_matter_document_tenant(text) is
  'Tenant dueño de un objeto del bucket matter-documents, resuelto por su ruta. NULL = deniega (DA-1).';

revoke all on function public.fn_matter_document_tenant(text) from public;
grant execute on function public.fn_matter_document_tenant(text) to authenticated, service_role;

-- Sustitución de las tres políticas. Se dejan caer por nombre exacto: si el
-- nombre cambiara, el DROP fallaría y la migración se pararía en vez de dejar
-- conviviendo la política vieja (permisiva, luego se OR-earían y la nueva no
-- restringiría nada — es el patrón que dejó pública `jurisdiction_rule_sets`).
drop policy if exists matter_documents_authenticated_select on storage.objects;
drop policy if exists matter_documents_authenticated_insert on storage.objects;
drop policy if exists matter_documents_authenticated_update on storage.objects;

create policy matter_documents_tenant_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'matter-documents'
    and public.fn_matter_document_tenant(name) = public.fn_current_tenant_id()
  );

create policy matter_documents_tenant_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'matter-documents'
    and public.fn_matter_document_tenant(name) = public.fn_current_tenant_id()
  );

create policy matter_documents_tenant_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'matter-documents'
    and public.fn_matter_document_tenant(name) = public.fn_current_tenant_id()
  )
  with check (
    bucket_id = 'matter-documents'
    and public.fn_matter_document_tenant(name) = public.fn_current_tenant_id()
  );

-- `fn_current_tenant_id()` devuelve NULL para una sesión sin perfil, y
-- `NULL = x` es NULL, que la RLS trata como falso: falla cerrado.
