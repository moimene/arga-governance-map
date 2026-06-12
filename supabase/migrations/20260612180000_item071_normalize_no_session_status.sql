-- ITEM-071 — Normalización de status inglés 'APPROVED' en no_session_resolutions.
--
-- 1 fila demo ('Ratificación nombramiento Director General ARGA Brasil') tenía
-- status='APPROVED' (default inglés del schema original) frente a 20 'APROBADO'.
-- En /secretaria/acuerdos-sin-sesion el filtro por 'Aprobado' (igualdad estricta
-- a 'APROBADO') la excluía: un acuerdo aprobado desaparecía de la vista filtrada.
--
-- Forward-only, idempotente. El DEFAULT del schema se alinea a 'BORRADOR' para
-- que futuros inserts sin status no reintroduzcan la clave inglesa.

UPDATE public.no_session_resolutions
   SET status = 'APROBADO'
 WHERE status = 'APPROVED';

ALTER TABLE public.no_session_resolutions
  ALTER COLUMN status SET DEFAULT 'BORRADOR';

-- Self-verify: no debe quedar ninguna fila con la clave inglesa.
DO $$
DECLARE v_en integer;
BEGIN
  SELECT count(*) INTO v_en FROM public.no_session_resolutions WHERE status = 'APPROVED';
  IF v_en <> 0 THEN
    RAISE EXCEPTION 'ITEM-071 verificación fallida: quedan % filas con status APPROVED', v_en;
  END IF;
END $$;
