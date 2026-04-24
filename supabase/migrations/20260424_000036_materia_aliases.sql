-- Legacy materia aliases found in SQL/seed inputs:
--   MOD_ESTATUTOS -> MODIFICACION_ESTATUTOS
--   AMPLIACION_CAPITAL -> AUMENTO_CAPITAL
--   NOMBRAMIENTO_CESE -> NOMBRAMIENTO_CONSEJERO

INSERT INTO materia_catalog (
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
SELECT
  'MOD_ESTATUTOS',
  materia_label_es,
  requires_notary,
  requires_registry,
  inscribable,
  matter_class,
  min_majority_code,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
FROM materia_catalog
WHERE materia = 'MODIFICACION_ESTATUTOS'
ON CONFLICT (materia) DO NOTHING;

INSERT INTO materia_catalog (
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
SELECT
  'AMPLIACION_CAPITAL',
  materia_label_es,
  requires_notary,
  requires_registry,
  inscribable,
  matter_class,
  min_majority_code,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
FROM materia_catalog
WHERE materia = 'AUMENTO_CAPITAL'
ON CONFLICT (materia) DO NOTHING;

INSERT INTO materia_catalog (
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
SELECT
  'NOMBRAMIENTO_CESE',
  materia_label_es,
  requires_notary,
  requires_registry,
  inscribable,
  matter_class,
  min_majority_code,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
FROM materia_catalog
WHERE materia = 'NOMBRAMIENTO_CONSEJERO'
ON CONFLICT (materia) DO NOTHING;
