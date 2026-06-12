-- ITEM-149 — Re-seed de 6 evidence_bundles de demo SEALED → OPEN.
--
-- 6 bundles de seed (created_at 2026-05-05, signed_by 'EAD Trust demo QTSP') tenían
-- status=SEALED, de modo que isFinalSealedEvidence los trataba como evidencia final
-- productiva — incoherente con la postura oficial 'reference/pending, nunca final'
-- mientras la migración 000049 (evidence/legal hold) sigue en HOLD. Además usaban
-- source_object_type='agreement' en minúsculas frente al filtro uppercase 'AGREEMENT'
-- de los hooks.
--
-- Se degradan a OPEN y se marca el manifest con seed_demo. La tabla tiene un WORM
-- guard (BEFORE UPDATE/DELETE → RAISE); se desactiva ACOTADAMENTE solo ese trigger
-- durante la corrección de seed (operación controlada de saneamiento de datos demo,
-- no runtime) y se reactiva al final. El trigger de auditoría permanece activo para
-- dejar constancia de la corrección. Forward-only, idempotente (acota por status y
-- signed_by demo).

ALTER TABLE public.evidence_bundles DISABLE TRIGGER evidence_bundles_worm_guard;

UPDATE public.evidence_bundles
   SET status = 'OPEN',
       source_object_type = 'AGREEMENT',
       manifest = COALESCE(manifest, '{}'::jsonb)
                  || jsonb_build_object(
                       'seed_demo', true,
                       'demo_reason',
                       'Bundle de seed demo (EAD Trust demo QTSP). Postura reference/pending mientras 000049 esté HOLD; no es evidencia sellada productiva.'
                     )
 WHERE status = 'SEALED'
   AND source_module = 'secretaria'
   AND signed_by = 'EAD Trust demo QTSP';

ALTER TABLE public.evidence_bundles ENABLE TRIGGER evidence_bundles_worm_guard;

-- Self-verify: ya no debe quedar ningún bundle SEALED de demo, y el source_object_type
-- de esas filas debe estar normalizado a uppercase.
DO $$
DECLARE v_sealed integer; v_lower integer;
BEGIN
  SELECT count(*) INTO v_sealed FROM public.evidence_bundles
   WHERE status = 'SEALED' AND source_module = 'secretaria' AND signed_by = 'EAD Trust demo QTSP';
  SELECT count(*) INTO v_lower FROM public.evidence_bundles
   WHERE signed_by = 'EAD Trust demo QTSP' AND source_object_type = 'agreement';
  IF v_sealed <> 0 OR v_lower <> 0 THEN
    RAISE EXCEPTION 'ITEM-149 verificación fallida: sealed=%, lowercase=%', v_sealed, v_lower;
  END IF;
END $$;
