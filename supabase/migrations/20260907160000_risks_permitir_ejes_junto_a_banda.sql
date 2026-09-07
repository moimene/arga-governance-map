-- Retira `risks_banda_sin_ejes_check`.
--
-- QUIÉN Y CUÁNDO: decisión expresa del usuario el 2026-09-07, que cambia la
-- orden vigente sobre el tenant Garrigues: «se va a ir sembrando, de forma
-- progresiva, con datos SIMULADOS PERO BASADOS EN LA REALIDAD, y ese dato DEBE
-- PERSISTIR». La CHECK que se retira aquí impedía exactamente eso: los 82
-- riesgos del mapa penal tienen banda, y con la restricción puesta la base
-- rechaza cualquier probabilidad, impacto o score residual sobre ellos.
--
-- QUÉ SE PIERDE. La CHECK era la ÚNICA defensa estructural contra fabricar
-- ejes sobre un riesgo cuya fuente no los descompone. Al retirarla, la base
-- deja de distinguir un eje medido de uno inventado: esa distinción pasa a
-- vivir solo en `risks.assessment_provenance` (que es dato, no restricción) y
-- en la disciplina del seed. Y aparece una fila que hasta hoy era
-- inalcanzable: un riesgo con DOS evaluaciones a la vez —su banda y sus
-- ejes— que pueden contradecirse sin que nada lo impida.
--
-- QUÉ NO SE TOCA. Ni el dato ni las otras dos restricciones:
--   * `risks_assessed_band_check` sigue acotando el vocabulario de bandas.
--   * `risks_probability_check` / `risks_impact_check` siguen acotando 1..5.
-- Medido read-only contra Cloud el 2026-09-07 antes de escribir esto:
--   ARGA (…0001): 167 riesgos, 167 con ejes, 0 con banda.
--   Garrigues (…0002): 82 riesgos, 82 con banda, 0 con ejes.
--   Filas con banda Y ejes a la vez: 0 en ambos tenants.
-- Esta migración no cambia ninguna fila: solo hace escribible una celda que
-- hoy está vacía. ARGA no puede notarlo — no tiene ni una sola banda.
--
-- CÓMO SE PINTA LO QUE ESTO HABILITA. La precedencia entre las dos lecturas no
-- se decide en cada pantalla: vive en `src/lib/grc/assessed-band.ts`
-- (`lecturaRiesgo`). Con las dos presentes se pintan LAS DOS y la pantalla
-- declara que son dos evaluaciones distintas que no se concilian; la escala
-- 1-25 (filtros, KPI de severidad, mapa de calor) sigue alimentándose solo de
-- los ejes, y una banda nunca entra en ella.
--
-- Forward-only e idempotente. No se vuelve a crear la restricción: volver a
-- ponerla dejaría los datos sembrados sin poder guardarse.

ALTER TABLE public.risks
  DROP CONSTRAINT IF EXISTS risks_banda_sin_ejes_check;

COMMENT ON COLUMN public.risks.assessed_band IS
  'Banda de color evaluada en origen, para riesgos que la fuente no descompone en probabilidad x impacto. NULL = el riesgo usa solo los ejes clasicos. Desde 2026-09-07 puede convivir con probability/impact/residual_score: cuando conviven son DOS evaluaciones distintas y ninguna se deriva de la otra (ver src/lib/grc/assessed-band.ts).';
