-- ============================================================
-- Migration 000033: materia_catalog — formal catalog table
-- Replaces the implicit catalog embedded in rule_packs.materia text field.
-- ============================================================

CREATE TABLE IF NOT EXISTS materia_catalog (
  materia              text PRIMARY KEY,
  materia_label_es     text NOT NULL,
  requires_notary      boolean NOT NULL DEFAULT false,
  requires_registry    boolean NOT NULL DEFAULT false,
  inscribable          boolean NOT NULL DEFAULT false,
  matter_class         text NOT NULL DEFAULT 'ORDINARIA'
                         CHECK (matter_class IN ('ORDINARIA', 'ESTATUTARIA', 'ESTRUCTURAL', 'ESPECIAL')),
  min_majority_code    text,        -- minimum LSC majority code (cannot be lowered)
  publication_required boolean NOT NULL DEFAULT false,
  plazo_inscripcion_dias int,
  referencia_legal     text,
  created_at           timestamptz DEFAULT now() NOT NULL
);

-- Seed: 28 materias from rule packs (migration 000017 + oleada 2)
INSERT INTO materia_catalog (materia, materia_label_es, requires_notary, requires_registry, inscribable, matter_class, min_majority_code, publication_required, plazo_inscripcion_dias, referencia_legal) VALUES
  ('APROBACION_CUENTAS',         'Aprobación de cuentas anuales',              false, false, false, 'ORDINARIA',   'SIMPLE',                false, NULL, 'art. 253 LSC'),
  ('NOMBRAMIENTO_CONSEJERO',     'Nombramiento de consejero',                  false, true,  true,  'ORDINARIA',   'SIMPLE',                false, 10,   'art. 214 LSC'),
  ('CESE_CONSEJERO',             'Cese de consejero',                          false, true,  true,  'ORDINARIA',   'SIMPLE',                false, 10,   'art. 223 LSC'),
  ('DELEGACION_FACULTADES',      'Delegación de facultades del Consejo',        false, true,  true,  'ORDINARIA',   'SIMPLE',                false, 10,   'art. 249 LSC'),
  ('DISTRIBUCION_DIVIDENDOS',    'Distribución de dividendos',                 false, false, false, 'ORDINARIA',   'SIMPLE',                false, NULL, 'art. 275 LSC'),
  ('NOMBRAMIENTO_AUDITOR',       'Nombramiento de auditor de cuentas',         false, true,  true,  'ORDINARIA',   'SIMPLE',                false, 10,   'art. 264 LSC'),
  ('MODIFICACION_ESTATUTOS',     'Modificación de estatutos sociales',         true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         false, 30,   'art. 285 LSC'),
  ('AUMENTO_CAPITAL',            'Aumento de capital social',                  true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         false, 30,   'art. 296 LSC'),
  ('REDUCCION_CAPITAL',          'Reducción de capital social',                true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         true,  30,   'art. 317 LSC'),
  ('FUSION',                     'Fusión de sociedades',                       true,  true,  true,  'ESTRUCTURAL', 'REFORZADA_2_3',         true,  60,   'art. 40 LME'),
  ('ESCISION',                   'Escisión de la sociedad',                    true,  true,  true,  'ESTRUCTURAL', 'REFORZADA_2_3',         true,  60,   'art. 68 LME'),
  ('DISOLUCION',                 'Disolución de la sociedad',                  true,  true,  true,  'ESTRUCTURAL', 'REFORZADA_2_3',         true,  30,   'art. 368 LSC'),
  ('LIQUIDACION',                'Liquidación de la sociedad',                 true,  true,  true,  'ESTRUCTURAL', 'UNANIMIDAD',            true,  30,   'art. 374 LSC'),
  ('TRANSFORMACION',             'Transformación de tipo social',              true,  true,  true,  'ESTRUCTURAL', 'UNANIMIDAD',            false, 30,   'art. 4 LME'),
  ('VENTA_ACTIVOS_ESENCIALES',   'Enajenación de activos esenciales',          true,  false, false, 'ESTRUCTURAL', 'REFORZADA_2_3',         false, NULL, 'art. 160.f LSC'),
  ('OPERACION_VINCULADA',        'Operación con parte vinculada',              false, false, false, 'ORDINARIA',   'SIMPLE',                false, NULL, 'art. 229 LSC'),
  ('PACTO_PARASOCIAL',           'Adhesión o modificación de pacto parasocial',false, false, false, 'ESPECIAL',    'UNANIMIDAD',            false, NULL, 'art. 29 LSC'),
  ('REMUNERACION_CONSEJEROS',    'Política de remuneración de consejeros',     false, false, false, 'ORDINARIA',   'SIMPLE',                false, NULL, 'art. 217 LSC'),
  ('EMISION_OBLIGACIONES',       'Emisión de obligaciones o deuda',            true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         false, 15,   'art. 401 LSC'),
  ('AMPLIACION_OBJETO_SOCIAL',   'Ampliación del objeto social',               true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         false, 30,   'art. 285 LSC'),
  ('CAMBIO_DOMICILIO_SOCIAL',    'Cambio de domicilio social',                 true,  true,  true,  'ESTATUTARIA', 'SIMPLE',                false, 15,   'art. 285 LSC'),
  ('CAMBIO_DENOMINACION_SOCIAL', 'Cambio de denominación social',              true,  true,  true,  'ESTATUTARIA', 'SIMPLE',                false, 15,   'art. 285 LSC'),
  ('EXCLUSION_SOCIO',            'Exclusión de socio',                         true,  false, false, 'ESPECIAL',    'UNANIMIDAD',            false, NULL, 'art. 351 LSC'),
  ('SEPARACION_SOCIO',           'Separación de socio',                        false, false, false, 'ESPECIAL',    'SIMPLE',                false, NULL, 'art. 346 LSC'),
  ('PRORROGA_SOCIEDAD',          'Prórroga de la duración de la sociedad',     true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         false, 30,   'art. 285 LSC'),
  ('ADQUISICION_PROPIA',         'Adquisición de acciones/participaciones propias', false, false, false, 'ORDINARIA', 'SIMPLE',             false, NULL, 'art. 144 LSC'),
  ('EMISION_DEUDA_CONVERTIBLE',  'Emisión de deuda convertible',               true,  true,  true,  'ESTATUTARIA', 'REFORZADA_2_3',         false, 15,   'art. 414 LSC'),
  ('DELEGACION_CAPITAL',         'Delegación en el órgano de administración para aumentar capital', false, true, true, 'ESTATUTARIA', 'REFORZADA_2_3', false, 15, 'art. 297 LSC')
ON CONFLICT (materia) DO UPDATE SET
  materia_label_es     = EXCLUDED.materia_label_es,
  requires_notary      = EXCLUDED.requires_notary,
  requires_registry    = EXCLUDED.requires_registry,
  inscribable          = EXCLUDED.inscribable,
  matter_class         = EXCLUDED.matter_class,
  min_majority_code    = EXCLUDED.min_majority_code,
  publication_required = EXCLUDED.publication_required,
  plazo_inscripcion_dias = EXCLUDED.plazo_inscripcion_dias,
  referencia_legal     = EXCLUDED.referencia_legal;
