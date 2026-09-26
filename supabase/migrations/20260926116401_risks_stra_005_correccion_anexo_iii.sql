-- MOI-164 (D-15, por delegación): corrige el error de derecho en la
-- descripción de RSK-STRA-005 (ARGA).
--
-- ERROR: la descripción afirmaba "regulación AI Act alto riesgo" para un
-- modelo de pricing automatizado de AUTOMÓVIL. El anexo III, punto 5 c), del
-- Reglamento (UE) 2024/1689 alcanza ÚNICAMENTE la evaluación de riesgos y la
-- fijación de precios en los seguros de VIDA y de SALUD — no automóvil. Todo
-- informe que pintara ese riesgo repetía el error (análisis
-- docs/superpowers/reviews/2026-09-20-overlap-aims-grc.md §5).
--
-- DECISIÓN D-15 (por delegación, ver issue MOI-164 y su "Qué te toca a ti"):
-- corregir la descripción — cambio mínimo, con precedente ya usado en este
-- repo para descripciones erróneas en Cloud —, no la nota aditiva sin tocar
-- el texto que preveía F8.T2 (esa vía deja el texto erróneo pintándose). El
-- título "Pricing automatizado ML modelo único" no afirmaba el error y no se
-- toca.
--
-- ALCANCE: EXCEPCIÓN DECLARADA al contrato cero-cambio ARGA — cambio de dato
-- de ARGA explícitamente autorizado por esta decisión, y limitado a esta fila
-- exacta por tenant_id + code + el texto erróneo previo (comprobado en el
-- WHERE, no solo en el filtro por code). Ninguna otra fila de ARGA ni de
-- Garrigues se toca.
--
-- IDEMPOTENTE: el UPDATE sólo afecta a la fila cuya descripción sea todavía
-- la errónea; en una segunda ejecución no encuentra nada que igualar y no
-- hace nada (0 filas), sin fallar.

DO $migracion$
DECLARE
  v_tenant_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_descripcion_erronea text :=
    '[DEMO] Modelo ML pricing automóvil sin alternativa human-in-loop para outliers. Riesgo competitivo + regulación AI Act alto riesgo.';
  v_descripcion_corregida text :=
    '[DEMO] Modelo ML pricing automóvil sin alternativa human-in-loop para outliers. Riesgo competitivo. '
    || 'Corrección 2026-09-26 (MOI-164, decisión D-15): el anexo III, punto 5 c), del Reglamento (UE) 2024/1689 '
    || 'alcanza únicamente la evaluación de riesgos y la fijación de precios en los seguros de vida y de salud; '
    || 'el pricing de automóvil no queda calificado de alto riesgo por ese punto.';
  v_antes record;
  v_filas int;
BEGIN
  -- Declaración de la fila de ARGA tocada, ANTES de tocarla.
  SELECT id, code, description INTO v_antes
    FROM public.risks
   WHERE tenant_id = v_tenant_arga AND code = 'RSK-STRA-005';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MOI-164 D-15: no existe RSK-STRA-005 en el tenant ARGA — nada que corregir ni que declarar';
  END IF;

  RAISE NOTICE 'MOI-164 D-15: RSK-STRA-005 (id=%) ANTES: %', v_antes.id, v_antes.description;

  UPDATE public.risks
     SET description = v_descripcion_corregida
   WHERE tenant_id = v_tenant_arga
     AND code = 'RSK-STRA-005'
     AND description = v_descripcion_erronea;

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RAISE NOTICE 'MOI-164 D-15: filas actualizadas en esta ejecución: %', v_filas;

  -- Declaración de la fila de ARGA tocada, DESPUÉS (ya corregida, en esta
  -- ejecución o en una anterior — el idempotente puede ser el motivo de 0).
  SELECT description INTO v_antes.description
    FROM public.risks
   WHERE tenant_id = v_tenant_arga AND code = 'RSK-STRA-005';
  RAISE NOTICE 'MOI-164 D-15: RSK-STRA-005 DESPUÉS: %', v_antes.description;
END;
$migracion$;

-- Verificación que aborta si el resultado no es el esperado.
DO $verificacion$
DECLARE
  v_tenant_arga uuid := '00000000-0000-0000-0000-000000000001';
  v_desc text;
  v_otras_tocadas int;
BEGIN
  SELECT description INTO v_desc
    FROM public.risks
   WHERE tenant_id = v_tenant_arga AND code = 'RSK-STRA-005';

  IF v_desc IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164 D-15: RSK-STRA-005 no tiene descripción tras la migración';
  END IF;

  -- La afirmación errónea ya no está.
  IF v_desc ILIKE '%AI Act alto riesgo%' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164 D-15: RSK-STRA-005 sigue afirmando "AI Act alto riesgo"';
  END IF;

  -- La corrección sí está, y cita el punto exacto del anexo III.
  IF v_desc NOT ILIKE '%anexo III, punto 5 c)%' OR v_desc NOT ILIKE '%vida y de salud%' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164 D-15: RSK-STRA-005 no contiene la corrección esperada: %', v_desc;
  END IF;

  -- El riesgo competitivo (la parte no errónea del texto original) se conserva.
  IF v_desc NOT ILIKE '%human-in-loop%' OR v_desc NOT ILIKE '%Riesgo competitivo%' THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164 D-15: se perdió contenido original no erróneo: %', v_desc;
  END IF;

  -- Control positivo del alcance: NINGUNA otra fila (de ARGA ni de otro
  -- tenant) lleva la corrección — si esto aparece en más de una fila, el
  -- UPDATE dejó de estar acotado a la fila declarada.
  SELECT count(*) INTO v_otras_tocadas
    FROM public.risks
   WHERE description ILIKE '%MOI-164, decisión D-15%'
     AND NOT (tenant_id = v_tenant_arga AND code = 'RSK-STRA-005');
  IF v_otras_tocadas <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164 D-15: la corrección se coló en % fila(s) fuera del alcance declarado', v_otras_tocadas;
  END IF;
END;
$verificacion$;
