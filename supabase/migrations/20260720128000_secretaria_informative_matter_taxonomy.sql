-- Taxonomía canónica de puntos informativos del Consejo.
--
-- Estas filas clasifican constancias del orden del día. No son materias de
-- acuerdo: no tienen mayoría, rule pack, efecto registral, publicación ni
-- instrumentación. `ESPECIAL` es la clase conservadora ya excluida por los
-- selectores que materializan `agreements`; la naturaleza autoritativa de cada
-- punto sigue siendo `agenda_items.kind = 'INFORMATIVO'`.

BEGIN;

INSERT INTO public.materia_catalog (
  materia,
  materia_label_es,
  requires_notary,
  requires_registry,
  inscribable,
  matter_class,
  min_majority_code,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
)
VALUES
  (
    'INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD',
    'Informe de la Dirección General sobre la marcha de la sociedad',
    false,
    false,
    false,
    'ESPECIAL',
    null,
    false,
    null,
    null
  ),
  (
    'INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO',
    'Informe de gobierno corporativo y cumplimiento',
    false,
    false,
    false,
    'ESPECIAL',
    null,
    false,
    null,
    null
  )
ON CONFLICT (materia) DO UPDATE SET
  materia_label_es = EXCLUDED.materia_label_es,
  requires_notary = false,
  requires_registry = false,
  inscribable = false,
  matter_class = 'ESPECIAL',
  min_majority_code = null,
  publication_required = false,
  plazo_inscripcion_dias = null,
  referencia_legal = null;

DO $assert$
BEGIN
  IF (
    SELECT count(*)
    FROM public.materia_catalog
    WHERE materia IN (
      'INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD',
      'INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO'
    )
      AND matter_class = 'ESPECIAL'
      AND min_majority_code IS NULL
      AND NOT requires_notary
      AND NOT requires_registry
      AND NOT inscribable
      AND NOT publication_required
      AND plazo_inscripcion_dias IS NULL
  ) <> 2 THEN
    RAISE EXCEPTION 'informative matter taxonomy: catálogo con efectos decisorios inesperados';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rule_packs
    WHERE materia IN (
      'INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD',
      'INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO'
    )
  ) THEN
    RAISE EXCEPTION 'informative matter taxonomy: un punto informativo no puede tener rule pack';
  END IF;
END;
$assert$;

COMMIT;
