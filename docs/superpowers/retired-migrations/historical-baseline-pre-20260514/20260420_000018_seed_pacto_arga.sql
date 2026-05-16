-- ============================================================
-- Migration 000018 — Seed Pacto Parasocial Fundación ARGA 2024
-- ============================================================

-- Pacto principal
INSERT INTO pactos_parasociales (
  id, tenant_id, entity_id, pacto_ref, fecha_pacto, partes, estado
) VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  'PACTO_FUNDACION_ARGA_2024',
  '2024-01-15T00:00:00Z',
  '[
    {"id": "FUNDACION_ARGA", "nombre": "Fundación ARGA", "tipo": "TITULAR_CONTROL", "capital_pct": 69.69, "via": "Cartera ARGA S.L.U."},
    {"id": "FREE_FLOAT", "nombre": "Free Float", "tipo": "TITULAR_MINORITARIO", "capital_pct": 30.31}
  ]'::jsonb,
  'VIGENTE'
) ON CONFLICT (id) DO NOTHING;

-- Cláusula 1 — VETO sobre operaciones estructurales
INSERT INTO pacto_clausulas (
  pacto_id,
  tipo,
  materia_ambito,
  titulares,
  titular_veto,
  condicion_detallada,
  ventana_respuesta_dias,
  estatutarizada,
  efecto_incumplimiento
) VALUES (
  '00000000-0000-0000-0000-000000000030',
  'VETO',
  '["FUSION", "ESCISION", "TRANSFORMACION", "CESION_GLOBAL_ACTIVO", "DISOLUCION"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE", "nombre": "Fundación ARGA"}]'::jsonb,
  'FUNDACION_ARGA',
  'Fundación ARGA tiene derecho de veto sobre operaciones estructurales conforme al pacto parasocial de 2024. El veto se ejerce mediante comunicación escrita en los 15 días siguientes a la convocatoria.',
  15,
  false,
  'BLOQUEO_PACTO'
);

-- Cláusula 2 — CONSENTIMIENTO_INVERSOR en operaciones de capital
INSERT INTO pacto_clausulas (
  pacto_id,
  tipo,
  materia_ambito,
  titulares,
  titular_veto,
  capital_minimo_pct,
  condicion_detallada,
  ventana_respuesta_dias,
  estatutarizada,
  efecto_incumplimiento
) VALUES (
  '00000000-0000-0000-0000-000000000030',
  'CONSENTIMIENTO_INVERSOR',
  '["AUMENTO_CAPITAL", "REDUCCION_CAPITAL", "EMISION_OBLIGACIONES"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE", "nombre": "Fundación ARGA"}]'::jsonb,
  'FUNDACION_ARGA',
  10,
  'Se requiere consentimiento previo escrito de Fundación ARGA para cualquier modificación del capital social.',
  10,
  false,
  'ALERTA'
);

-- Cláusula 3 — MAYORIA_REFORZADA_PACTADA en operaciones vinculadas
INSERT INTO pacto_clausulas (
  pacto_id,
  tipo,
  materia_ambito,
  titulares,
  umbral_activacion,
  condicion_detallada,
  ventana_respuesta_dias,
  estatutarizada,
  efecto_incumplimiento
) VALUES (
  '00000000-0000-0000-0000-000000000030',
  'MAYORIA_REFORZADA_PACTADA',
  '["OPERACION_VINCULADA"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE", "nombre": "Fundación ARGA"}]'::jsonb,
  0.75,
  'Las operaciones vinculadas con partes relacionadas requieren mayoría reforzada del 75% del capital con derecho a voto.',
  10,
  false,
  'BLOQUEO_PACTO'
);
