-- W2 — golden path registral demo (2026-06-13).
-- ============================================================================
-- Los informes y la Parte II/III del documento legal señalan que ningún
-- expediente registral alcanzaba estado terminal (0 INSCRITA / 0 DENEGADA), por
-- lo que la demo no podía mostrar el cierre del ciclo. Este seed lleva tres
-- expedientes existentes a estados terminales con datos registrales realistas
-- (inscription_number + borme_ref + defect_details), cubriendo los tres caminos
-- que pedían los informes: INSCRITA directa, INSCRITA tras subsanación resuelta,
-- y DENEGADA con defecto calificado. Solo toca registry_filings (no cambia el
-- estado de agreements para no romper coherencia de expedientes multi-filing).
-- Forward-only, idempotente (filtra por el estado de origen esperado).

-- 1) INSCRITA directa (vía electrónica, BORME).
UPDATE registry_filings
   SET status = 'INSCRITA',
       inscription_number = '15',
       borme_ref = 'BORME-A-2026-098',
       elevated_at = '2026-05-12T10:00:00Z'
 WHERE id = '03a26f8e-885e-4e76-b27f-d1aa8d4cd47c'
   AND status = 'PRESENTADA';

-- 2) INSCRITA tras subsanación resuelta.
UPDATE registry_filings
   SET status = 'INSCRITA',
       inscription_number = '16',
       borme_ref = 'BORME-A-2026-101',
       elevated_at = '2026-05-20T10:00:00Z',
       defect_details = jsonb_build_object(
         'historico', jsonb_build_array(
           jsonb_build_object(
             'calificacion', 'negativa_subsanable',
             'defecto', 'Falta acreditación de la vigencia del cargo certificante (art. 109 RRM)',
             'subsanable', true,
             'subsanado', true,
             'fecha_calificacion', '2026-05-14',
             'fecha_subsanacion', '2026-05-18'
           )
         ),
         'resultado', 'INSCRITA tras subsanación'
       )
 WHERE id = '486b9f21-e76e-46fa-b0ff-5d600f49cf7e'
   AND status = 'SUBSANACION';

-- 3) DENEGADA con defecto calificado no subsanable.
UPDATE registry_filings
   SET status = 'DENEGADA',
       defect_details = jsonb_build_object(
         'calificacion', 'negativa',
         'defectos', jsonb_build_array(
           jsonb_build_object(
             'codigo', 'RRM-58',
             'descripcion', 'Acuerdo no inscribible: no consta el quórum reforzado exigido por el art. 194 LSC para la modificación estatutaria',
             'subsanable', false
           )
         ),
         'fecha', '2026-05-15'
       )
 WHERE id = 'ad6718b1-fdea-40dd-87eb-345938f2060b'
   AND status = 'EN_TRAMITE';
