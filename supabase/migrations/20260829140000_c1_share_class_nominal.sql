-- RENUMERADA de 20260829130000 a 20260829140000 el 2026-08-29.
-- Motivo: `20260829130000` la tomó otra migración de un carril paralelo
-- (`aims_close_technical_file_sin_atribucion`). Mi INSERT de registro llevaba
-- `ON CONFLICT (version) DO NOTHING`, que ante una clave ya ocupada es un
-- no-op SILENCIOSO: devuelve éxito y cero filas, exactamente igual que un
-- registro correcto. Lo leí como aplicado. El DDL sí se aplicó; la fila de
-- registro nunca llegó a existir.
-- Lección, ya norma de programa: tras registrar una versión hay que LEER la
-- fila y comprobar que el `name` es el propio. `max(version)` no dice de quién
-- es la versión — ese fue justo mi error de lectura en el post-probe.
--
-- C1 — el art. 7 de los Estatutos de J&A Garrigues, S.L.P. define DOS clases con
-- nominales distintos (A: 16.000 €, B: 1 €). `share_classes` no tenía dónde
-- guardarlo y `entity_capital_profile.valor_nominal` es único por entidad.
-- Columnas NULLABLE y sin default: ARGA queda con NULL = cero cambio de
-- comportamiento (su clase única sigue leyendo el nominal del perfil).
ALTER TABLE public.share_classes
  ADD COLUMN IF NOT EXISTS nominal_value numeric,
  ADD COLUMN IF NOT EXISTS total_titulos integer;

COMMENT ON COLUMN public.share_classes.nominal_value IS
  'Valor nominal por participación de la clase. NULL = usar entity_capital_profile.valor_nominal (caso de entidad con clase única).';
COMMENT ON COLUMN public.share_classes.total_titulos IS
  'Participaciones emitidas de la clase según Estatutos. NULL = no acreditado.';

DO $assert$
DECLARE
  v_cols integer;
  v_arga integer;
BEGIN
  -- (1) Comprobación que SÍ puede fallar en esta misma ejecución: el DDL tomó.
  SELECT count(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'share_classes'
    AND column_name IN ('nominal_value', 'total_titulos');
  IF v_cols <> 2 THEN
    RAISE EXCEPTION 'c1 share_class_nominal: se esperaban 2 columnas nuevas, encontradas=%', v_cols;
  END IF;

  -- (2) Guarda de ARGA. En la PRIMERA aplicación es necesariamente vacua: un
  -- ADD COLUMN sin DEFAULT deja NULL en todas las filas preexistentes, así que
  -- este count es 0 por construcción. Se deja porque la migración es
  -- idempotente y en cualquier reejecución posterior al seed de Garrigues sí
  -- discrimina. La prueba real de "ARGA con NULL = cero cambio" es la sonda de
  -- la tarea siguiente (garrigues-capital-firme.test.ts), que lee ARGA DESPUÉS
  -- de sembrar Garrigues.
  SELECT count(*) INTO v_arga
  FROM public.share_classes
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND (nominal_value IS NOT NULL OR total_titulos IS NOT NULL);
  IF v_arga <> 0 THEN
    RAISE EXCEPTION 'c1 share_class_nominal: ARGA no debe recibir valores (filas=%)', v_arga;
  END IF;
END $assert$;
