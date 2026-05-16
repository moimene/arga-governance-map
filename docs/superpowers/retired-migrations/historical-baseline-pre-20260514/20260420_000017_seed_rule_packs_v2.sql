-- =============================================================================
-- Migration: 20260420_000017_seed_rule_packs_v2.sql
-- Purpose: T2-ext — Seed 12 nuevos rule packs LSC v2.1 (28 packs totales)
-- Date: 2026-04-20
-- Tenant: 00000000-0000-0000-0000-000000000001
-- =============================================================================
-- Adds the following rule packs:
--   1. COOPTACION                  — art. 244 LSC (solo SA)
--   2. DIVIDENDO_A_CUENTA          — art. 277 LSC
--   3. EJECUCION_AUMENTO_DELEGADO  — art. 297 LSC (estructural)
--   4. TRASLADO_DOMICILIO_NACIONAL — art. 285.1 LSC
--   5. CUENTAS_CONSOLIDADAS        — arts. 42-49 C.Comercio + LSC
--   6. INFORME_GESTION             — art. 253 LSC
--   7. APROBACION_PRESUPUESTO      — decisión de gestión Consejo
--
-- Plus version-2 payloads for existing packs that need update:
--   8. DELEGACION_FACULTADES       — updated: NO_SESSION mode added
--   9. OPERACION_VINCULADA         — updated: abstenciones cuentan_como_contra confirmed
--  10. NOMBRAMIENTO_AUDITOR        — updated: art. 264 LSC quorum reference
--  11. AUTORIZACION_GARANTIA       — updated: CONSEJO organoTipo (intragrupo)
--  12. RATIFICACION_ACTOS          — updated: NO_SESSION mode added
-- =============================================================================

-- ============================================================================
-- PART 1: INSERT new rule_packs rows (idempotent)
-- ============================================================================

INSERT INTO rule_packs (id, tenant_id, descripcion, materia, organo_tipo)
VALUES
  ('COOPTACION',                 '00000000-0000-0000-0000-000000000001', 'Cooptación de Consejeros (SA art. 244 LSC)',       'COOPTACION',                 'CONSEJO'),
  ('DIVIDENDO_A_CUENTA',         '00000000-0000-0000-0000-000000000001', 'Dividendo a Cuenta (art. 277 LSC)',               'DIVIDENDO_A_CUENTA',         'CONSEJO'),
  ('EJECUCION_AUMENTO_DELEGADO', '00000000-0000-0000-0000-000000000001', 'Ejecución de Aumento de Capital Delegado',        'EJECUCION_AUMENTO_DELEGADO', 'CONSEJO'),
  ('TRASLADO_DOMICILIO_NACIONAL','00000000-0000-0000-0000-000000000001', 'Traslado de Domicilio Social (España)',           'TRASLADO_DOMICILIO_NACIONAL','CONSEJO'),
  ('CUENTAS_CONSOLIDADAS',       '00000000-0000-0000-0000-000000000001', 'Formulación de Cuentas Consolidadas',             'CUENTAS_CONSOLIDADAS',       'CONSEJO'),
  ('INFORME_GESTION',            '00000000-0000-0000-0000-000000000001', 'Formulación del Informe de Gestión',              'INFORME_GESTION',            'CONSEJO'),
  ('APROBACION_PRESUPUESTO',     '00000000-0000-0000-0000-000000000001', 'Aprobación del Presupuesto Anual',                'APROBACION_PRESUPUESTO',     'CONSEJO')
ON CONFLICT (id) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  organo_tipo = EXCLUDED.organo_tipo;

-- ============================================================================
-- PART 2: INSERT / UPSERT rule_pack_versions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. COOPTACION (nueva) — art. 244 LSC — solo SA, Consejo cubre vacante
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'COOPTACION',
  '1.0.0',
  '{
    "id": "COOPTACION",
    "materia": "COOPTACION",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "restriccionTipoSocial": ["SA"],
    "nota": "Cooptación exclusiva de SA (art. 244 LSC). SL no tiene cooptación — vacante se cubre por JGA.",
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "NO APLICA — cooptación no existe en SL"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": []
      },
      "contenidoMinimo": [
        "Identificación del candidato cooptado",
        "Acreditación de vacante por fallecimiento, renuncia o incapacidad",
        "Duración provisional hasta la siguiente JGA"
      ],
      "documentosObligatorios": [
        {"id": "cv_candidato", "nombre": "CV y declaración de idoneidad del candidato", "condicion": "SIEMPRE"},
        {"id": "justificacion_vacante", "nombre": "Documentación acreditativa de la vacante", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "NO_APLICA", "fuente": "LEY", "referencia": "Cooptación no existe en SL"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "cv_candidato", "nombre": "CV del consejero cooptado"},
        {"id": "declaracion_idoneidad", "nombre": "Declaración de idoneidad y aceptación del cargo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Acreditación de vacante", "Candidato propuesto", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Identidad consejero cooptado", "Causa de vacante", "Duración provisional"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "ratificacion_jga": {
        "nota": "El cooptado debe ser ratificado o sustituido en la primera JGA ordinaria posterior (art. 244 LSC)",
        "fuente": "LEY",
        "referencia": "art. 244 LSC"
      }
    },
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false,
      "nota": "Cooptación no inscribible directamente — se inscribe cuando la JGA ratifica o nombra definitivamente"
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 2. DIVIDENDO_A_CUENTA (nuevo) — art. 277 LSC — requiere estado contable
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'DIVIDENDO_A_CUENTA',
  '1.0.0',
  '{
    "id": "DIVIDENDO_A_CUENTA",
    "materia": "DIVIDENDO_A_CUENTA",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Cuantía del dividendo a cuenta propuesto",
        "Referencia al estado contable de liquidez"
      ],
      "documentosObligatorios": [
        {"id": "estado_contable", "nombre": "Estado contable de liquidez (art. 277.2 LSC)", "condicion": "SIEMPRE"},
        {"id": "propuesta_dividendo", "nombre": "Propuesta de distribución de dividendo a cuenta", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "reglaEspecifica": {
      "requiereEstadoContable": true,
      "plazoEstadoContableDias": 3,
      "referencia": "art. 277 LSC",
      "nota": "El estado contable de liquidez debe ser formulado dentro de los 3 meses anteriores a la fecha del acuerdo y verificado por el auditor (si existe)"
    },
    "documentacion": {
      "obligatoria": [
        {"id": "estado_contable_liquidez", "nombre": "Estado contable de liquidez (art. 277.2 LSC) — no puede distribuirse más de lo previsto como beneficio desde el cierre del ejercicio"},
        {"id": "informe_auditor_estado", "nombre": "Informe del auditor sobre el estado contable (si hay auditor nombrado)", "condicion": "SI_AUDITORIA"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Cuantía del dividendo", "Referencia al estado contable", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Cuantía y fecha de pago", "Referencia al estado contable de liquidez"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "pago": {
        "nota": "La Junta General debe fijar fecha de pago; en defecto, el Consejo acuerda fecha concreta",
        "fuente": "ESTATUTOS"
      }
    },
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 3. EJECUCION_AUMENTO_DELEGADO (nuevo) — art. 297 LSC — clase ESTRUCTURAL
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'EJECUCION_AUMENTO_DELEGADO',
  '1.0.0',
  '{
    "id": "EJECUCION_AUMENTO_DELEGADO",
    "materia": "EJECUCION_AUMENTO_DELEGADO",
    "clase": "ESTRUCTURAL",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Referencia al acuerdo de delegación de la JGA",
        "Importe concreto del aumento a ejecutar",
        "Modalidad (dinerario / no dinerario / cargo a reservas)",
        "Plazo de suscripción preferente"
      ],
      "documentosObligatorios": [
        {"id": "acuerdo_delegacion_jga", "nombre": "Acuerdo JGA por el que se delegó la facultad (art. 297 LSC)", "condicion": "SIEMPRE"},
        {"id": "informe_admin_ampliacion", "nombre": "Informe del órgano de administración sobre la emisión (cotizadas)", "condicion": "SI_COTIZADA"},
        {"id": "informe_auditor_aportaciones", "nombre": "Informe del auditor sobre aportaciones no dinerarias", "condicion": "SI_NO_DINERARIO"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "acuerdo_jga_delegacion", "nombre": "Certificación del acuerdo JGA delegante"},
        {"id": "proyecto_escritura", "nombre": "Proyecto de escritura de ampliación de capital"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Referencia al acuerdo delegante", "Importe del aumento", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Importe del aumento", "Modalidad", "Referencia al acuerdo delegante"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 315 LSC — inscripción del aumento de capital en el RM"
      },
      "publicacion": ["BORME"]
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "plazoInscripcionDias": 30,
      "publicacionRequerida": true,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 315 LSC — inscripción aumento de capital"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 4. TRASLADO_DOMICILIO_NACIONAL (nuevo) — art. 285.1 LSC — inscribible 30d
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'TRASLADO_DOMICILIO_NACIONAL',
  '1.0.0',
  '{
    "id": "TRASLADO_DOMICILIO_NACIONAL",
    "materia": "TRASLADO_DOMICILIO_NACIONAL",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "nota": "Traslado dentro de España — competencia del Consejo (art. 285.1 LSC). Traslado al extranjero requiere JGA.",
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Nuevo domicilio social propuesto",
        "Justificación del traslado"
      ],
      "documentosObligatorios": [
        {"id": "certificacion_nuevo_domicilio", "nombre": "Certificación del nuevo domicilio o título jurídico del inmueble", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "certificacion_domicilio", "nombre": "Título o certificación del nuevo domicilio"},
        {"id": "notificacion_hacienda", "nombre": "Notificación a AEAT y registros administrativos relevantes"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Nuevo domicilio acordado", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Nuevo domicilio social completo", "Fecha efectiva del cambio"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 285.1 LSC — plazo de 1 mes desde el acuerdo para presentar escritura en el RM"
      },
      "publicacion": ["BORME"]
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "plazoInscripcionDias": 30,
      "publicacionRequerida": true,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 285.1 LSC — 1 mes desde el acuerdo"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 5. CUENTAS_CONSOLIDADAS (nuevo) — arts. 42-49 C.Comercio + LSC
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'CUENTAS_CONSOLIDADAS',
  '1.0.0',
  '{
    "id": "CUENTAS_CONSOLIDADAS",
    "materia": "CUENTAS_CONSOLIDADAS",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "nota": "Formulación de cuentas consolidadas — obligación de la sociedad dominante (art. 42 C.Comercio). El Consejo formula; la JGA aprueba.",
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Presentación de cuentas consolidadas del grupo",
        "Informe de auditoría del grupo (si aplica)"
      ],
      "documentosObligatorios": [
        {"id": "cuentas_consolidadas_borrador", "nombre": "Borrador de cuentas anuales consolidadas del grupo", "condicion": "SIEMPRE"},
        {"id": "informe_auditoria_grupo", "nombre": "Informe de auditoría del grupo (art. 42.5 C.Comercio)", "condicion": "SI_OBLIGACION_AUDITAR"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "cuentas_consolidadas_firmadas", "nombre": "Cuentas consolidadas firmadas por todos los administradores (art. 43 C.Comercio)"},
        {"id": "informe_gestion_consolidado", "nombre": "Informe de gestión consolidado del grupo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"},
      "plazoFormulacion": {
        "meses": 3,
        "fuente": "LEY",
        "referencia": "art. 253 LSC — 3 meses desde cierre del ejercicio"
      }
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Referencia a las cuentas consolidadas formuladas", "Firma de todos los administradores", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Ejercicio social al que corresponden", "Fecha de formulación"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": true
    },
    "plazosMateriales": {
      "deposito_rm": {
        "nota": "Depósito en el Registro Mercantil dentro del mes siguiente a la aprobación por JGA (art. 279 LSC)",
        "fuente": "LEY",
        "referencia": "art. 279 LSC"
      }
    },
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false,
      "nota": "Formulación es acto interno del Consejo. La aprobación final compete a la JGA."
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 6. INFORME_GESTION (nuevo) — art. 253 LSC — formulación por Consejo
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'INFORME_GESTION',
  '1.0.0',
  '{
    "id": "INFORME_GESTION",
    "materia": "INFORME_GESTION",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "nota": "Formulación del informe de gestión anual — obligatorio para el Consejo junto con las cuentas anuales (art. 253.1 LSC). No inscribible de forma autónoma.",
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Evolución y resultados del negocio",
        "Descripción de principales riesgos e incertidumbres",
        "Información sobre hechos posteriores al cierre",
        "Indicadores clave de rendimiento financiero y no financiero"
      ],
      "documentosObligatorios": [
        {"id": "borrador_informe_gestion", "nombre": "Borrador del informe de gestión del ejercicio", "condicion": "SIEMPRE"},
        {"id": "estado_informacion_no_financiera", "nombre": "Estado de Información No Financiera (cotizadas >500 empleados)", "condicion": "SI_OBLIGACION_EINF"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "informe_gestion_firmado", "nombre": "Informe de gestión firmado por todos los administradores (art. 253 LSC)"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"},
      "plazoFormulacion": {
        "meses": 3,
        "fuente": "LEY",
        "referencia": "art. 253 LSC — 3 meses desde cierre del ejercicio"
      }
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Ejercicio social al que corresponde el informe", "Aprobación del contenido", "Firma de todos los administradores"],
        "consignacion": [],
        "acuerdoEscrito": ["Ejercicio social", "Fecha de formulación"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": true
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 7. APROBACION_PRESUPUESTO (nuevo) — decisión de gestión Consejo
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'APROBACION_PRESUPUESTO',
  '1.0.0',
  '{
    "id": "APROBACION_PRESUPUESTO",
    "materia": "APROBACION_PRESUPUESTO",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "nota": "Aprobación del presupuesto anual — competencia de gestión del Consejo de Administración. No requiere formalidad especial salvo la ordinaria del Consejo.",
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Presentación del presupuesto anual",
        "Cuadros de ingresos, gastos e inversiones"
      ],
      "documentosObligatorios": [
        {"id": "presupuesto_borrador", "nombre": "Borrador del presupuesto anual por áreas de negocio", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "presupuesto_aprobado", "nombre": "Presupuesto anual aprobado en formato definitivo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Ejercicio presupuestado", "Cifras principales", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Ejercicio presupuestado", "Resumen de cifras principales aprobadas"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ============================================================================
-- PART 3: VERSION 1.1.0 payloads for existing packs — updated rules
-- Idempotent: uses ON CONFLICT DO UPDATE
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 8. DELEGACION_FACULTADES v1.1.0 — NO_SESSION mode added, art. 247 LSC
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'DELEGACION_FACULTADES',
  '1.1.0',
  '{
    "id": "DELEGACION_FACULTADES",
    "materia": "DELEGACION_FACULTADES",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "art. 246.1 LSC — Consejo: según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "art. 246.1 LSC"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Materias a deliberar",
        "Identificación del delegado y alcance de la delegación"
      ],
      "documentosObligatorios": [
        {"id": "borrador_delegacion", "nombre": "Borrador del acuerdo de delegación con listado de facultades", "condicion": "SIEMPRE"},
        {"id": "verificacion_249bis", "nombre": "Verificación de exclusión de materias indelegables art. 249 bis LSC", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "listado_facultades", "nombre": "Listado completo de facultades delegadas"},
        {"id": "exclusion_249bis", "nombre": "Verificación de exclusión de materias indelegables art. 249 bis LSC"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Consejeros asistentes", "Alcance de la delegación", "Delegado identificado", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Delegado identificado", "Listado de facultades delegadas", "Vigencia"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM — delegación permanente"
      }
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "ESCRITURA",
      "plazoInscripcionDias": 30,
      "publicacionRequerida": false,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 249.3 LSC — inscripción delegación permanente"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 9. OPERACION_VINCULADA v1.1.0 — abstenciones: cuentan_como_contra confirmed
--    arts. 228-229 LSC — conflicto de interés intragrupo
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'OPERACION_VINCULADA',
  '1.1.0',
  '{
    "id": "OPERACION_VINCULADA",
    "materia": "OPERACION_VINCULADA",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Identificación de la parte vinculada y naturaleza del vínculo",
        "Naturaleza y condiciones económicas de la operación",
        "Beneficios y riesgos para la sociedad",
        "Declaración de abstención de consejeros afectados"
      ],
      "documentosObligatorios": [
        {"id": "informe_condiciones_mercado", "nombre": "Informe de condiciones de mercado o valoración independiente", "condicion": "SIEMPRE"},
        {"id": "informe_comision_auditoria", "nombre": "Informe favorable de Comisión de Auditoría (cotizadas art. 529 ter.1.h LSC)", "condicion": "SI_COTIZADA"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros no vinculados"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC — consejeros no vinculados"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC — sin contar consejeros vinculados"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC — sin contar consejeros vinculados"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 228.e LSC — consejero vinculado se abstiene"}
      },
      "abstenciones": "cuentan_como_contra",
      "nota_abstenciones": "Las abstenciones de consejeros vinculados computan como votos en contra para preservar la integridad del quórum de votación (arts. 228-229 LSC)",
      "referencia_abstenciones": "arts. 228.e y 229.1.a LSC — deber de abstención en situaciones de conflicto de interés",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "informe_valoracion", "nombre": "Informe de valoración o condiciones de mercado"},
        {"id": "declaracion_vinculacion", "nombre": "Declaración de la parte vinculada y naturaleza del vínculo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Identificación parte vinculada y naturaleza del vínculo", "Condiciones económicas de la operación", "Consejeros que se abstienen por conflicto", "Resultado votación excluyendo vinculados"],
        "consignacion": [],
        "acuerdoEscrito": ["Identificación de la operación y parte vinculada", "Condiciones pactadas", "Consejeros que se abstienen"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 10. NOMBRAMIENTO_AUDITOR v1.1.0 — art. 264 LSC quorum reference
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'NOMBRAMIENTO_AUDITOR',
  '1.1.0',
  '{
    "id": "NOMBRAMIENTO_AUDITOR",
    "materia": "NOMBRAMIENTO_AUDITOR",
    "clase": "ORDINARIA",
    "organoTipo": "JUNTA_GENERAL",
    "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"},
        "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}
      },
      "canales": {
        "SA": ["BORME", "WEB_INSCRITA"],
        "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Identificación del auditor o firma auditora propuesta (nombre + ROAC)",
        "Duración del contrato (mínimo 3 años, art. 264.1 LSC)"
      ],
      "documentosObligatorios": [
        {"id": "propuesta_comision_auditoria", "nombre": "Propuesta motivada de la Comisión de Auditoría (cotizadas)", "condicion": "SI_COTIZADA"},
        {"id": "declaracion_independencia", "nombre": "Declaración de independencia del auditor propuesto", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC — quórum ordinario 1ª conv."},
        "SA_2a": {"valor": 0,    "fuente": "LEY", "referencia": "art. 193.1 LSC — sin mínimo en 2ª conv."},
        "SL":    {"valor": 0,    "fuente": "LEY", "referencia": "art. 198 LSC — sin quórum legal"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > 0.5 * capital_presente", "fuente": "LEY", "referencia": "art. 201.1 LSC — mayoría simple del capital presente"},
        "SL":     {"formula": "favor > mitad_capital_con_voto", "fuente": "LEY", "referencia": "art. 198 LSC"},
        "CONSEJO":{"formula": "favor > presentes_mitad", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": false
    },
    "documentacion": {
      "obligatoria": [
        {"id": "propuesta_nombramiento", "nombre": "Propuesta de nombramiento con duración y condiciones del contrato"},
        {"id": "declaracion_independencia_auditor", "nombre": "Declaración de independencia del auditor (art. 21 LAC)"}
      ],
      "ventanaDisponibilidad": {"dias": 15, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_JUNTA",
        "UNIVERSAL": "ACTA_JUNTA"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Asistentes y capital representado", "Auditor nombrado con número ROAC y duración del contrato", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": []
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {
      "inscripcion": {
        "plazo_dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM — nombramiento auditor inscribible"
      }
    },
    "postAcuerdo": {
      "inscribible": true,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 30,
      "publicacionRequerida": false,
      "plazoInscripcion": {
        "dias": 30,
        "fuente": "LEY",
        "referencia": "art. 17 RRM — nombramiento auditor de cuentas"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 11. AUTORIZACION_GARANTIA v1.1.0 — CONSEJO organoTipo (garantía intragrupo)
--     Competencia Consejo para garantías intragrupo (art. 249 bis + 160.f LSC)
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'AUTORIZACION_GARANTIA',
  '1.1.0',
  '{
    "id": "AUTORIZACION_GARANTIA",
    "materia": "AUTORIZACION_GARANTIA",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "nota": "Para garantías/avales cuyo importe NO supera el 25% de los activos sociales, la competencia corresponde al Consejo. Si supera el umbral del art. 160.f LSC, requiere autorización de JGA.",
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Naturaleza y cuantía de la garantía o aval",
        "Beneficiario y operación garantizada",
        "Análisis de riesgo y capacidad de pago del avalado"
      ],
      "documentosObligatorios": [
        {"id": "descripcion_garantia", "nombre": "Descripción de la garantía y evaluación del riesgo", "condicion": "SIEMPRE"},
        {"id": "verificacion_umbral_160f", "nombre": "Verificación de que el importe no supera el 25% de activos (art. 160.f LSC)", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "descripcion_garantia", "nombre": "Descripción de la garantía y análisis de riesgo"},
        {"id": "calculo_umbral", "nombre": "Cálculo del porcentaje sobre activos (art. 160.f LSC — umbral 25%)"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Descripción de la garantía y beneficiario", "Verificación del umbral art. 160.f LSC", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Naturaleza y cuantía de la garantía", "Beneficiario", "Verificación umbral"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 12. RATIFICACION_ACTOS v1.1.0 — NO_SESSION mode added
-- ---------------------------------------------------------------------------
INSERT INTO rule_pack_versions (pack_id, version, payload, is_active)
VALUES (
  'RATIFICACION_ACTOS',
  '1.1.0',
  '{
    "id": "RATIFICACION_ACTOS",
    "materia": "RATIFICACION_ACTOS",
    "clase": "ORDINARIA",
    "organoTipo": "CONSEJO",
    "modosAdopcionPermitidos": ["MEETING", "NO_SESSION"],
    "convocatoria": {
      "antelacionDias": {
        "SA": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"},
        "SL": {"valor": 0, "fuente": "LEY", "referencia": "Convocatoria del Consejo según estatutos/reglamento"}
      },
      "canales": {
        "SA": ["CONVOCATORIA_CONSEJO"],
        "SL": ["CONVOCATORIA_CONSEJO"]
      },
      "contenidoMinimo": [
        "Fecha, hora y lugar",
        "Descripción de los actos o contratos a ratificar",
        "Justificación de la urgencia que motivó la actuación previa"
      ],
      "documentosObligatorios": [
        {"id": "copia_acto_contrato", "nombre": "Copia del acto o contrato a ratificar", "condicion": "SIEMPRE"}
      ]
    },
    "constitucion": {
      "quorum": {
        "SA_1a": {"valor": 0.5, "fuente": "LEY", "referencia": "art. 247 LSC — mayoría miembros del Consejo"},
        "SA_2a": {"valor": 0,   "fuente": "LEY"},
        "SL":    {"valor": 0,   "fuente": "LEY"},
        "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}
      }
    },
    "votacion": {
      "mayoria": {
        "SA":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "SL":     {"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"},
        "CONSEJO":{"formula": "favor > total_miembros / 2", "fuente": "LEY", "referencia": "art. 247.2 LSC"}
      },
      "abstenciones": "no_cuentan",
      "votoCalidadPermitido": true
    },
    "documentacion": {
      "obligatoria": [
        {"id": "copia_acto", "nombre": "Copia del acto o contrato ratificado"},
        {"id": "informe_justificacion", "nombre": "Informe sobre la urgencia y circunstancias del acto previo"}
      ],
      "ventanaDisponibilidad": {"dias": 0, "fuente": "LEY"}
    },
    "acta": {
      "tipoActaPorModo": {
        "MEETING": "ACTA_CONSEJO",
        "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
      },
      "contenidoMinimo": {
        "sesion": ["Fecha y lugar", "Descripción del acto ratificado", "Justificación de la urgencia", "Resultado votación"],
        "consignacion": [],
        "acuerdoEscrito": ["Acto o contrato ratificado", "Fundamento y circunstancias de urgencia"]
      },
      "requiereTranscripcionLibroActas": true,
      "requiereConformidadConjunta": false
    },
    "plazosMateriales": {},
    "postAcuerdo": {
      "inscribible": false,
      "instrumentoRequerido": "NINGUNO",
      "plazoInscripcionDias": 0,
      "publicacionRequerida": false
    }
  }'::jsonb,
  true
)
ON CONFLICT (pack_id, version) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = true;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_new_packs   INT;
  v_new_versions INT;
BEGIN
  SELECT COUNT(*) INTO v_new_packs
  FROM rule_packs
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND id IN (
      'COOPTACION', 'DIVIDENDO_A_CUENTA', 'EJECUCION_AUMENTO_DELEGADO',
      'TRASLADO_DOMICILIO_NACIONAL', 'CUENTAS_CONSOLIDADAS',
      'INFORME_GESTION', 'APROBACION_PRESUPUESTO'
    );

  SELECT COUNT(*) INTO v_new_versions
  FROM rule_pack_versions
  WHERE pack_id IN (
    'COOPTACION', 'DIVIDENDO_A_CUENTA', 'EJECUCION_AUMENTO_DELEGADO',
    'TRASLADO_DOMICILIO_NACIONAL', 'CUENTAS_CONSOLIDADAS',
    'INFORME_GESTION', 'APROBACION_PRESUPUESTO',
    'DELEGACION_FACULTADES', 'OPERACION_VINCULADA',
    'NOMBRAMIENTO_AUDITOR', 'AUTORIZACION_GARANTIA', 'RATIFICACION_ACTOS'
  ) AND version IN ('1.0.0', '1.1.0');

  RAISE NOTICE 'T2-ext verification: new packs = % (expected 7), versions upserted = % (expected 17)',
    v_new_packs, v_new_versions;

  IF v_new_packs < 7 THEN
    RAISE EXCEPTION 'T2-ext FAILED: only % of 7 new rule_packs inserted', v_new_packs;
  END IF;
END $$;
