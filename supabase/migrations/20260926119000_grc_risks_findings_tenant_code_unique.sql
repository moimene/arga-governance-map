-- MOI-190: los códigos de riesgos y hallazgos deben ser únicos DENTRO de cada
-- grupo (tenant_id, code), no globalmente. Hoy `findings.code` tiene un UNIQUE
-- global (`findings_code_key`, columna definida como UNIQUE en
-- 20260417121410_001_core_schema.sql) y `risks.code` no tiene ninguna
-- unicidad. Medido en solo lectura antes de escribir esta migración
-- (2026-09-26, governance_OS): 0 duplicados de (tenant_id, code) en risks
-- (249 filas) y 0 en findings (13 filas), 0 códigos NULL en ambas, y ninguna
-- FK apunta a `findings.code` (las tres FK existentes —action_plans,
-- conflicts_of_interest, risks— referencian `findings.id`). No hace falta
-- fusionar ni renombrar ningún código existente.
--
-- ARGA (…0001) y Garrigues (…0002) no comparten ningún código hoy, así que
-- el paso no muta ninguna fila: solo sustituye la restricción.
DO $verify_before$
DECLARE
  v_risks_dupes int;
  v_findings_dupes int;
  v_null_codes int;
BEGIN
  SELECT count(*) INTO v_risks_dupes
    FROM (SELECT tenant_id, code FROM public.risks WHERE code IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d;
  SELECT count(*) INTO v_findings_dupes
    FROM (SELECT tenant_id, code FROM public.findings WHERE code IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d;
  SELECT
    (SELECT count(*) FROM public.risks WHERE code IS NULL)
    + (SELECT count(*) FROM public.findings WHERE code IS NULL)
    INTO v_null_codes;

  IF v_risks_dupes > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % códigos (tenant_id, code) duplicados en risks; requiere decisión antes de crear el índice único', v_risks_dupes;
  END IF;
  IF v_findings_dupes > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % códigos (tenant_id, code) duplicados en findings; requiere decisión antes de crear el índice único', v_findings_dupes;
  END IF;
  IF v_null_codes > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % filas con code NULL en risks/findings; el índice único los trataría como distintos entre sí sin avisar', v_null_codes;
  END IF;
END
$verify_before$;

-- 1. Retirar la unicidad global de findings.code (UNIQUE de columna ⇒
--    findings_code_key). Sustituida por el índice (tenant_id, code) de abajo.
ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_code_key;

-- 2. Índices únicos por grupo, mismo patrón que ux_controls_tenant_code /
--    ux_policies_tenant_code.
CREATE UNIQUE INDEX IF NOT EXISTS ux_risks_tenant_code ON public.risks (tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_findings_tenant_code ON public.findings (tenant_id, code);

-- Verificación que aborta si el resultado no es el esperado, con control
-- positivo del propio instrumento (comprueba que el índice ENFORCEA, no solo
-- que existe: pg_index.indisunique + las dos columnas exactas, en ese orden).
DO $verify_after$
DECLARE
  v_old_constraint_exists boolean;
  v_risks_idx_ok boolean;
  v_findings_idx_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'findings_code_key'
  ) INTO v_old_constraint_exists;
  IF v_old_constraint_exists THEN
    RAISE EXCEPTION 'ABORTADO: findings_code_key sigue existiendo tras el DROP CONSTRAINT';
  END IF;

  SELECT i.indisunique
    AND array_agg(a.attname ORDER BY k.ord) = ARRAY['tenant_id','code']
    INTO v_risks_idx_ok
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE c.relname = 'ux_risks_tenant_code'
    GROUP BY i.indisunique;
  IF v_risks_idx_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ABORTADO: ux_risks_tenant_code no es un índice único (tenant_id, code) tal cual esperado';
  END IF;

  SELECT i.indisunique
    AND array_agg(a.attname ORDER BY k.ord) = ARRAY['tenant_id','code']
    INTO v_findings_idx_ok
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE c.relname = 'ux_findings_tenant_code'
    GROUP BY i.indisunique;
  IF v_findings_idx_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ABORTADO: ux_findings_tenant_code no es un índice único (tenant_id, code) tal cual esperado';
  END IF;
END
$verify_after$;
