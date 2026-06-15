-- B.1 (Comité Legal, memo junio 2026): categorización del CdA de ARGA Seguros.
-- Asigna metadata.categoria a los 14 consejeros PF sin categoría (item030 ya marcó
-- Presidente=EJECUTIVO y la PJ consejera=DOMINICAL).
-- NOTA estructural: el consejo demo tiene 16 vocales (Presidente + 15 CONSEJERO;
-- Secretario excluido por NON_VOCAL), uno más que los 15 del memo (el Presidente es
-- fila aparte, no uno de los 15). La distribución resultante es 5 EJE / 1 DOM / 10 IND,
-- preservando el intent (5 ejecutivos, 1 dominical, mayoría independiente). La
-- reconciliación a 15 miembros exactos (9 IND) cambia el denominador de quórum y queda
-- como decisión de estructura (no se toca para preservar el golden path 0/0).
-- Additivo, idempotente, no cambia identidades. Dato demo (data_class='DEMO').
WITH pf AS (
  SELECT cp.id, row_number() OVER (ORDER BY cp.person_id) AS rn
  FROM public.condiciones_persona cp
  JOIN public.persons p ON p.id = cp.person_id
  WHERE cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
    AND cp.tipo_condicion = 'CONSEJERO' AND cp.estado = 'VIGENTE'
    AND p.person_type = 'PF'
    AND (cp.metadata->>'categoria') IS NULL
)
UPDATE public.condiciones_persona cp
   SET metadata = COALESCE(cp.metadata, '{}'::jsonb)
       || jsonb_build_object(
            'categoria', CASE WHEN pf.rn <= 4 THEN 'EJECUTIVO' ELSE 'INDEPENDIENTE' END,
            'cargo_consejo', 'VOCAL',
            'source', 'b1_legal_memo_2026_06')
  FROM pf
 WHERE cp.id = pf.id;
