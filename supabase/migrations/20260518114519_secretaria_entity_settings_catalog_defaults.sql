-- Seed operativo del catalogo global de entity_settings usado por
-- SociedadNuevaStepper TX1. Sin estas claves activas, el builder filtra todo
-- el payload y fn_crear_sociedad_legal_y_capital crea sociedades sin settings.

INSERT INTO public.entity_settings_catalog (
  key,
  value_type,
  allowed_values,
  default_value,
  descripcion,
  categoria,
  usado_por_plantillas,
  estado_catalog
)
VALUES
  (
    'quorum_primera_pct',
    'number',
    NULL,
    '50'::jsonb,
    'Porcentaje estatutario o operativo de quorum en primera convocatoria para la sociedad.',
    'PERFIL_SOCIETARIO',
    ARRAY['MODELO_ACUERDO', 'CONVOCATORIA', 'ACTA'],
    'ACTIVA'
  ),
  (
    'quorum_segunda_pct',
    'number',
    NULL,
    '0'::jsonb,
    'Porcentaje estatutario o operativo de quorum en segunda convocatoria para la sociedad.',
    'PERFIL_SOCIETARIO',
    ARRAY['MODELO_ACUERDO', 'CONVOCATORIA', 'ACTA'],
    'ACTIVA'
  ),
  (
    'mayoria_simple_pct',
    'number',
    NULL,
    '50'::jsonb,
    'Porcentaje de mayoria simple operativo por defecto para acuerdos societarios ordinarios.',
    'PERFIL_SOCIETARIO',
    ARRAY['MODELO_ACUERDO', 'ACTA'],
    'ACTIVA'
  ),
  (
    'convocatoria_dias',
    'number',
    NULL,
    '15'::jsonb,
    'Dias de antelacion configurados para convocatorias de la sociedad cuando proceda override estatutario u operativo.',
    'PERFIL_SOCIETARIO',
    ARRAY['CONVOCATORIA', 'MODELO_ACUERDO'],
    'ACTIVA'
  ),
  (
    'convocatoria_medio',
    'text',
    NULL,
    '"WEB_EMAIL"'::jsonb,
    'Medio operativo preferente de convocatoria informado durante el alta de sociedad.',
    'PERFIL_SOCIETARIO',
    ARRAY['CONVOCATORIA'],
    'ACTIVA'
  ),
  (
    'voto_calidad_presidente',
    'boolean',
    NULL,
    'true'::jsonb,
    'Indica si el organo de administracion admite voto de calidad del presidente en el modelo operativo de la sociedad.',
    'PERFIL_SOCIETARIO',
    ARRAY['ACTA', 'MODELO_ACUERDO'],
    'ACTIVA'
  )
ON CONFLICT (key) DO UPDATE SET
  value_type = EXCLUDED.value_type,
  allowed_values = EXCLUDED.allowed_values,
  default_value = EXCLUDED.default_value,
  descripcion = EXCLUDED.descripcion,
  categoria = EXCLUDED.categoria,
  usado_por_plantillas = EXCLUDED.usado_por_plantillas,
  estado_catalog = 'ACTIVA';
