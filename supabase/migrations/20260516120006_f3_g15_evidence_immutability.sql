-- =============================================================
-- F3.G15 — Evidence inmutabilidad + append-only supersession
-- Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §5
-- =============================================================
--
-- Concilio Codex K4: el manifest contiene `artifacts[].ref` que entra al
-- SHA-256. Mover objetos in-place invalida el hash. La solución correcta
-- es append-only supersession: nuevo bundle con supersedes_id apuntando
-- al viejo + storage_path nuevo + manifest nuevo. Legacy no se toca.
--
-- IMPORTANTE — Hallazgo durante deploy (drift G8):
--   Cloud ya tiene un trigger WORM externo en evidence_bundles que bloquea
--   TODO UPDATE ("WORM protection: UPDATE operations are not allowed on
--   evidence_bundles", SQLSTATE P0001). Ese trigger NO está en repo (drift).
--   Implicaciones:
--     - No podemos hacer UPDATE de backfill aquí. Storage_path para bundles
--       legacy queda NULL; UI tiene que extraer del document_url legacy
--       dinámicamente (path tras "/matter-documents/").
--     - Mi propio trigger fn_evidence_immutable sería redundante con el
--       WORM existente (que es más estricto). Lo omito.
--     - Los bundles NUEVOS deben setear storage_path/manifest/manifest_hash
--       en el mismo INSERT inicial (forward-only). No habrá UPDATE-to-add
--       después.
--
-- Cambios efectivos:
--   1. ADD COLUMN evidence_bundles.storage_path text (futuros bundles)
--   2. ADD COLUMN evidence_bundles.supersedes_id uuid (chain)
--   3. ADD COLUMN evidence_bundles.manifest jsonb (catálogo artefactos)
--   4. ADD COLUMN evidence_bundles.manifest_hash text (SHA-256 manifest, opcional)
--   5. View evidence_bundles_latest (HEAD por supersession chain)
--
-- Sin UPDATE backfill (bloqueado por WORM existente).
-- Sin trigger inmutable (redundante con WORM existente).

-- §1. Columns (idempotente)
ALTER TABLE public.evidence_bundles
  ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE public.evidence_bundles
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.evidence_bundles(id);
ALTER TABLE public.evidence_bundles
  ADD COLUMN IF NOT EXISTS manifest jsonb;
ALTER TABLE public.evidence_bundles
  ADD COLUMN IF NOT EXISTS manifest_hash text;

COMMENT ON COLUMN public.evidence_bundles.storage_path IS
  'F3.G15: path bajo bucket matter-documents. Forma nueva: <tenant_id>/<agreement_id>/<filename>. NULL en bundles legacy — UI extrae del document_url.';
COMMENT ON COLUMN public.evidence_bundles.supersedes_id IS
  'F3.G15: si este bundle reemplaza a otro, FK al bundle anterior. NULL = bundle original. Enforce supersession en lugar de mutación.';
COMMENT ON COLUMN public.evidence_bundles.manifest IS
  'F3.G15: catálogo de artefactos firmados (artifacts[].ref, .hash, .size). Inmutable post-insert por el WORM trigger existente.';
COMMENT ON COLUMN public.evidence_bundles.manifest_hash IS
  'F3.G15: SHA-256 del manifest serializado. Inmutable post-insert por el WORM trigger existente.';


-- §2. View con HEAD de supersession chain — UI consume esta vista para
-- "última versión" del bundle. Devuelve solo bundles que NO son superseded.
CREATE OR REPLACE VIEW public.evidence_bundles_latest AS
SELECT eb.*
FROM public.evidence_bundles eb
WHERE NOT EXISTS (
  SELECT 1 FROM public.evidence_bundles s WHERE s.supersedes_id = eb.id
);

COMMENT ON VIEW public.evidence_bundles_latest IS
  'F3.G15: para cada cadena de supersession, devuelve solo el bundle HEAD '
  '(el que no es supersedido por nadie). Útil para UI que quiere "última versión".';

GRANT SELECT ON public.evidence_bundles_latest TO authenticated, service_role;


-- §3. Función helper para construir supersession chains: dado un bundle,
-- devuelve la cadena completa de bundles anteriores (recursiva).
CREATE OR REPLACE FUNCTION public.fn_evidence_bundle_chain(p_bundle_id uuid)
RETURNS TABLE (
  bundle_id uuid,
  generation integer,
  supersedes_id uuid,
  manifest_hash text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT id AS bundle_id,
           0 AS generation,
           supersedes_id,
           manifest_hash,
           created_at
    FROM public.evidence_bundles
    WHERE id = p_bundle_id
    UNION ALL
    SELECT eb.id,
           c.generation + 1,
           eb.supersedes_id,
           eb.manifest_hash,
           eb.created_at
    FROM public.evidence_bundles eb
    JOIN chain c ON eb.id = c.supersedes_id
  )
  SELECT bundle_id, generation, supersedes_id, manifest_hash, created_at FROM chain
  ORDER BY generation;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_evidence_bundle_chain(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_evidence_bundle_chain(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_evidence_bundle_chain(uuid) IS
  'F3.G15: recursive CTE que devuelve la cadena de supersession desde un bundle dado hacia atrás. generation=0 es el HEAD; valores mayores = más antiguos.';


-- =============================================================
-- Cierre G15 — Probe mecánico
-- =============================================================
DO $$
DECLARE
  v_has_storage_path boolean;
  v_has_supersedes boolean;
  v_has_manifest boolean;
  v_view_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='evidence_bundles' AND column_name='storage_path')
    INTO v_has_storage_path;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='evidence_bundles' AND column_name='supersedes_id')
    INTO v_has_supersedes;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='evidence_bundles' AND column_name='manifest')
    INTO v_has_manifest;
  SELECT EXISTS (SELECT 1 FROM information_schema.views
                 WHERE table_schema='public' AND table_name='evidence_bundles_latest')
    INTO v_view_exists;

  IF NOT (v_has_storage_path AND v_has_supersedes AND v_has_manifest AND v_view_exists) THEN
    RAISE EXCEPTION 'F3.G15 verification failed: storage_path=%, supersedes_id=%, manifest=%, view=%',
      v_has_storage_path, v_has_supersedes, v_has_manifest, v_view_exists;
  END IF;
  RAISE NOTICE 'F3.G15 verification OK: 3 columns + 1 view present on evidence_bundles';
END;
$$;
