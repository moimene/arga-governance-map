-- 20260802120000_tenants_branding.sql
-- G0 tenant Garrigues (spec 2026-08-02-garrigues-tenant-gobernanza-design.md §4 G0).
-- Perfil de marca por tenant, leído por TenantBrandProvider tras el login.
-- NULL = marca por defecto del producto (ARGA/TGMS actual): cero cambio visual.
-- Lectura: cubierta por la policy existente tenants_public_read (SELECT USING true).
-- Escritura: sin policy → solo service-role. Forward-only.

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS branding jsonb;

COMMENT ON COLUMN public.tenants.branding IS
  'Perfil de marca por tenant: {nombre, shell_label, scope_label, sii_org_label, tokens: {"--css-var": "valor"}}. NULL = defaults del producto (ARGA/TGMS).';
