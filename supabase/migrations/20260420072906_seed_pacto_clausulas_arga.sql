-- ============================================================
-- Seed: pacto_clausulas para Pacto Fundación ARGA 2024
-- Usa el row VETO existente (7428296e) como pacto padre
-- ============================================================

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
  '7428296e-bb7f-44ce-b250-de0c99adc3ab',
  'VETO',
  '["FUSION", "ESCISION", "TRANSFORMACION", "CESION_GLOBAL_ACTIVO", "DISOLUCION"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE", "nombre": "Fundación ARGA"}]'::jsonb,
  'FUNDACION_ARGA',
  'Fundación ARGA tiene derecho de veto sobre operaciones estructurales conforme al pacto parasocial de 2024. El veto se ejerce mediante comunicación escrita en los 15 días siguientes a la convocatoria.',
  15,
  false,
  'BLOQUEO_PACTO'
) ON CONFLICT DO NOTHING;

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
  '7428296e-bb7f-44ce-b250-de0c99adc3ab',
  'CONSENTIMIENTO_INVERSOR',
  '["AUMENTO_CAPITAL", "REDUCCION_CAPITAL", "EMISION_OBLIGACIONES"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE", "nombre": "Fundación ARGA"}]'::jsonb,
  'FUNDACION_ARGA',
  10,
  'Se requiere consentimiento previo escrito de Fundación ARGA para cualquier modificación del capital social.',
  10,
  false,
  'ALERTA'
) ON CONFLICT DO NOTHING;

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
  '7428296e-bb7f-44ce-b250-de0c99adc3ab',
  'MAYORIA_REFORZADA_PACTADA',
  '["OPERACION_VINCULADA"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE", "nombre": "Fundación ARGA"}]'::jsonb,
  0.75,
  'Las operaciones vinculadas con partes relacionadas requieren mayoría reforzada del 75% del capital con derecho a voto.',
  10,
  false,
  'BLOQUEO_PACTO'
) ON CONFLICT DO NOTHING;
