-- C2 — Siembra la materia FORMULACION_CUENTAS en materia_catalog.
--
-- El catálogo distinguía sólo APROBACION_CUENTAS (Junta) y
-- CUENTAS_CONSOLIDADAS (consolidación). El acto de FORMULACIÓN de cuentas
-- por el órgano de administración (art. 253 LSC) carecía de fila propia,
-- por lo que `DecisionUnipersonalStepper` no podía exponer la materia
-- y los tests Ruflo (T5) tenían que disfrazarse como APROBACION_CUENTAS.
-- Esta migración rellena el hueco.

BEGIN;

INSERT INTO public.materia_catalog (
  materia,
  materia_label_es,
  matter_class,
  min_majority_code,
  requires_notary,
  requires_registry,
  inscribable,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
)
VALUES (
  'FORMULACION_CUENTAS',
  'Formulación de cuentas anuales por el órgano de administración',
  'ORDINARIA',
  'SIMPLE',
  false,
  false,
  false,
  false,
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
    referencia_legal = EXCLUDED.referencia_legal;

COMMIT;
