-- Migration: 20260420_000014_tipo_social_slu.sql
-- Purpose: Add SLU/SAU as valid entity types + seed Cartera ARGA S.L.U.
-- LSC arts. 13, 15, 126, 173.3 — sociedades unipersonales

-- 1. Add tipo_social column to entities
--    (es_unipersonal already added in 000001)
ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS tipo_social TEXT DEFAULT 'SA';

-- 2. Rule pack for SOCIEDAD_UNIPERSONAL
--    rule_packs.id is TEXT PRIMARY KEY — use descriptive text ID
INSERT INTO rule_packs (id, tenant_id, descripcion, materia, organo_tipo)
VALUES (
  'SOCIEDAD_UNIPERSONAL',
  '00000000-0000-0000-0000-000000000001',
  'Decisiones Sociedad Unipersonal',
  'SOCIEDAD_UNIPERSONAL',
  'SOCIO_UNICO'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'SOCIEDAD_UNIPERSONAL',
  '1.0.0',
  '{
    "id": "SOCIEDAD_UNIPERSONAL",
    "materia": "SOCIEDAD_UNIPERSONAL",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["UNIPERSONAL_SOCIO"],
    "convocatoria": {
      "plazoDiasSA": 0,
      "plazoDiasSL": 0,
      "noRequiereConvocatoria": true,
      "baseJuridica": "Art. 173.3 LSC — sociedad unipersonal no requiere convocatoria formal",
      "canales": [],
      "documentosObligatorios": []
    },
    "constitucion": {
      "quorumSA_1conv": 0,
      "quorumSA_2conv": 0,
      "quorumSL": 0,
      "quorumConsejo": "NO_APLICA",
      "nota": "Socio único — quórum no aplica (art. 15 LSC)"
    },
    "votacion": {
      "mayoriaBase": "SIMPLE",
      "umbralesSA": {},
      "umbralesSL": {},
      "abstenciones": "NO_CUENTAN",
      "permitirVotoCalidad": false
    },
    "documentacion": {
      "documentosPreSesion": [],
      "tipoActaRequerido": "DECISION_SOCIO_UNICO",
      "requiereInformeAuditor": false,
      "requiereInformeAdministradores": false
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoPublico": "NUNCA",
      "plazoInscripcionDias": 180,
      "publicacionBORME": false,
      "plazoPrescripcionImpugnacion": "1_AÑO",
      "notaInscripcion": "Inscripción de unipersonalidad obligatoria (art. 13 LSC — 6 meses)"
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = EXCLUDED.is_active;

-- 3. Seed Cartera ARGA S.L.U. as an entity
--    Using actual entities table columns: legal_name, common_name, jurisdiction,
--    legal_form, entity_status, materiality, slug, es_unipersonal, tipo_social, tenant_id
--    parent_entity_id = Fundación ARGA (not seeded here — use NULL to avoid FK violation)
INSERT INTO entities (
  id,
  tenant_id,
  slug,
  legal_name,
  common_name,
  jurisdiction,
  legal_form,
  entity_status,
  materiality,
  es_unipersonal,
  tipo_social
) VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'cartera-arga-slu',
  'Cartera ARGA S.L.U.',
  'Cartera ARGA',
  'ES',
  'SLU',
  'ACTIVE',
  'HIGH',
  true,
  'SLU'
)
ON CONFLICT (id) DO UPDATE SET
  es_unipersonal = true,
  tipo_social = 'SLU';
