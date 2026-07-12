-- Corrige dos entidades demo españolas cuya forma jurídica y denominación son
-- S.L., pero cuyo `tipo_social` había quedado cargado como SA. La actualización
-- es forward-only, idempotente y no borra ni renombra filas.
--
-- ✅ ESTADO 2026-07-11: APLICADA en Cloud governance_OS mediante Management
-- API (el MCP execute_sql está en modo read-only) y registrada en
-- supabase_migrations.schema_migrations como 20260711154500. Verificación:
-- ARGA Digital y ARGA LATAM quedan ES / S.L. / SL; 0 conflictos SA↔SL en el
-- tenant demo.

BEGIN;

UPDATE public.entities
   SET tipo_social = 'SL'
 WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
   AND id IN (
     'f653c44c-15ce-4428-b3d3-f4ed17efe93b'::uuid,
     '5248f1a8-5821-413e-a716-1ab2e145747a'::uuid
   )
   AND jurisdiction = 'ES'
   AND legal_form IN ('SL', 'S.L.', 'S.L')
   AND tipo_social = 'SA';

DO $entity_social_type_coherence$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.entities
     WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
       AND id IN (
         'f653c44c-15ce-4428-b3d3-f4ed17efe93b'::uuid,
         '5248f1a8-5821-413e-a716-1ab2e145747a'::uuid
       )
       AND jurisdiction = 'ES'
       AND legal_form IN ('SL', 'S.L.', 'S.L')
       AND tipo_social IS DISTINCT FROM 'SL'
  ) THEN
    RAISE EXCEPTION
      'No se pudo dejar coherente el tipo social SL de ARGA Digital y ARGA LATAM';
  END IF;
END
$entity_social_type_coherence$;

COMMIT;
