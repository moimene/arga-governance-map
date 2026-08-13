-- supabase/migrations/20260813120000_g4_normative_ownership.sql
-- G4 Task 1 — Ownership por órgano y contenido del sistema normativo interno.
-- Forward-only. Todas las columnas nullable: ARGA (branding NULL, sin dato en
-- estas columnas) queda exactamente igual que hoy.

BEGIN;

-- 1. Ownership por órgano. Distinto de policies.approval_body_id, que es
--    "quién aprueba"; esto es "qué comité es responsable".
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS owner_body_id uuid REFERENCES public.governing_bodies(id),
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS content_outline jsonb,
  ADD COLUMN IF NOT EXISTS data_provenance jsonb;

ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS owner_body_id uuid REFERENCES public.governing_bodies(id),
  ADD COLUMN IF NOT EXISTS legal_reference text,
  ADD COLUMN IF NOT EXISTS periodicity text;

ALTER TABLE public.controls
  ADD COLUMN IF NOT EXISTS owner_body_id uuid REFERENCES public.governing_bodies(id);

COMMENT ON COLUMN public.policies.owner_body_id IS
  'Órgano responsable del documento normativo. Distinto de approval_body_id (órgano aprobador). NULL = no acreditado en fuente.';
COMMENT ON COLUMN public.policies.summary IS
  'Apartado "Objeto" del documento fuente. NULL = documento citado en fuente pero no incorporado.';
COMMENT ON COLUMN public.policies.content_outline IS
  'Índice de secciones del documento fuente, array JSON de strings.';
COMMENT ON COLUMN public.policies.data_provenance IS
  'Procedencia del dato, mismo patrón que entities.data_provenance (G1). NULL = ARGA, sin badge.';
COMMENT ON COLUMN public.obligations.legal_reference IS
  'Artículo concreto de la norma (p. ej. "art. 7 Ley 10/2010"). source queda como marco.';
COMMENT ON COLUMN public.obligations.periodicity IS
  'Periodicidad de cumplimiento cuando la norma la fija (ANUAL, BIENAL, CONTINUA, PUNTUAL).';

-- 2. Unicidad de policy_code por tenant. No existía NINGUNA: re-ejecutar un
--    seed duplicaba filas en silencio y usePolicyByCode usa .maybeSingle(),
--    que falla con más de una fila. Se asierta primero que no hay duplicados
--    preexistentes en ARGA para que la migración no reviente a ciegas.
DO $assert$
DECLARE
  v_dups int;
BEGIN
  SELECT count(*) INTO v_dups FROM (
    SELECT tenant_id, policy_code FROM public.policies
    GROUP BY tenant_id, policy_code HAVING count(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'G4 Task 1: % pares (tenant_id, policy_code) duplicados preexistentes; resolver antes de crear el índice único', v_dups;
  END IF;
END
$assert$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_policies_tenant_code
  ON public.policies (tenant_id, policy_code);

-- 3. Módulos GRC del tenant Garrigues. Precondición del seed de obligaciones:
--    tg_sync_obligation_to_backbone FKea contra grc_modules(tenant_id, id) y su
--    fallback a 'risk' no re-comprueba existencia. Se siembran las tres claves
--    que la función puede elegir para que cualquier rama encuentre destino.
INSERT INTO public.grc_modules (tenant_id, id, name)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'aml',    'PBC/FT'),
  ('00000000-0000-0000-0000-000000000002', 'ethics', 'Ética y canal interno'),
  ('00000000-0000-0000-0000-000000000002', 'risk',   'Riesgos penales y operacionales')
ON CONFLICT (tenant_id, id) DO NOTHING;

COMMIT;
