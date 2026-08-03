-- Secretaría — semántica explícita de NULL y ANY en plantillas y bindings.
--
-- Plantilla:
--   tipo_social NULL = todos los tipos sociales.
--   organo_tipo NULL = dato ausente; nunca wildcard.
--   adoption_mode NULL = ausente en documentos adoptables y no aplica en los
--   tipos no adoptables definidos por la capa de aplicación.
-- Binding gobernado:
--   organo_tipo/tipo_social/adoption_mode usan siempre un valor explícito;
--   ANY es el único wildcard permitido.

BEGIN;

UPDATE public.materia_template_binding
SET organo_tipo = 'ANY'
WHERE organo_tipo IS NULL OR NULLIF(btrim(organo_tipo), '') IS NULL;

UPDATE public.materia_template_binding
SET tipo_social = 'ANY'
WHERE tipo_social IS NULL OR NULLIF(btrim(tipo_social), '') IS NULL;

UPDATE public.materia_template_binding
SET adoption_mode = 'ANY'
WHERE adoption_mode IS NULL OR NULLIF(btrim(adoption_mode), '') IS NULL;

ALTER TABLE public.materia_template_binding
  ALTER COLUMN organo_tipo SET DEFAULT 'ANY',
  ALTER COLUMN organo_tipo SET NOT NULL,
  ALTER COLUMN tipo_social SET DEFAULT 'ANY',
  ALTER COLUMN tipo_social SET NOT NULL,
  ALTER COLUMN adoption_mode SET DEFAULT 'ANY',
  ALTER COLUMN adoption_mode SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.materia_template_binding'::regclass
      AND conname = 'materia_template_binding_axes_not_blank'
  ) THEN
    ALTER TABLE public.materia_template_binding
      ADD CONSTRAINT materia_template_binding_axes_not_blank CHECK (
        NULLIF(btrim(organo_tipo), '') IS NOT NULL
        AND NULLIF(btrim(tipo_social), '') IS NOT NULL
        AND NULLIF(btrim(adoption_mode), '') IS NOT NULL
      );
  END IF;
END
$constraints$;

COMMENT ON COLUMN public.plantillas_protegidas.tipo_social IS
  'NULL significa todos los tipos sociales. ANY se conserva por compatibilidad de lectura, pero los bindings gobernados usan ANY explícito.';
COMMENT ON COLUMN public.plantillas_protegidas.organo_tipo IS
  'NULL significa metadato ausente y no actúa como wildcard. Las plantillas activables deben informar un órgano específico.';
COMMENT ON COLUMN public.plantillas_protegidas.adoption_mode IS
  'NULL significa metadato ausente en documentos adoptables y no aplica únicamente en documentos no adoptables según la política de metadatos.';
COMMENT ON TABLE public.materia_template_binding IS
  'Binding gobernado con ejes explícitos: organo_tipo, tipo_social y adoption_mode son NOT NULL y usan ANY como wildcard.';

COMMIT;
