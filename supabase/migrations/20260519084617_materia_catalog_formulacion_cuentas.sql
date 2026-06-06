INSERT INTO public.materia_catalog (
  materia, materia_label_es, matter_class, min_majority_code,
  requires_notary, requires_registry, inscribable, publication_required,
  plazo_inscripcion_dias, referencia_legal
)
VALUES (
  'FORMULACION_CUENTAS',
  'Formulación de cuentas anuales por el órgano de administración',
  'ORDINARIA',
  'SIMPLE',
  false, false, false, false,
  NULL,
  'art. 253 LSC'
)
ON CONFLICT (materia) DO UPDATE
SET materia_label_es = EXCLUDED.materia_label_es,
    matter_class = EXCLUDED.matter_class,
    min_majority_code = EXCLUDED.min_majority_code,
    requires_notary = EXCLUDED.requires_notary,
    requires_registry = EXCLUDED.requires_registry,
    inscribable = EXCLUDED.inscribable,
    publication_required = EXCLUDED.publication_required,
    plazo_inscripcion_dias = EXCLUDED.plazo_inscripcion_dias,
    referencia_legal = EXCLUDED.referencia_legal;;
