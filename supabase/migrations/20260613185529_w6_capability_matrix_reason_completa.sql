-- W6 — completar capability_matrix.reason (2026-06-13).
-- ============================================================================
-- Quedaban 6/35 celdas sin razón jurídica anotada: las acciones nucleares
-- (SNAPSHOT_CREATION / VOTE_EMISSION / CERTIFICATION) para los roles
-- supervisores AUDITOR y COMPLIANCE (todas enabled=false). Se anota la base
-- jurídica de su exclusión, para que la matriz de capacidades sea defendible
-- 35/35 ante auditor/perito. Forward-only, idempotente (solo rellena nulos).

UPDATE capability_matrix SET reason =
  'El auditor verifica, no certifica: la facultad certificante corresponde al Secretario con Vº Bº del Presidente (art. 109 RRM). Certificar comprometería su independencia (Ley 22/2015 de Auditoría de Cuentas).'
  WHERE role='AUDITOR' AND action='CERTIFICATION' AND (reason IS NULL OR btrim(reason)='');

UPDATE capability_matrix SET reason =
  'El auditor no congela el censo: la ordenación de la sesión y la fijación del censo es acto del Secretario (art. 106 RRM). Su función es de revisión independiente, no de ejecución societaria.'
  WHERE role='AUDITOR' AND action='SNAPSHOT_CREATION' AND (reason IS NULL OR btrim(reason)='');

UPDATE capability_matrix SET reason =
  'El auditor no es miembro del órgano y no emite voto; su cometido es la verificación independiente de cuentas y cumplimiento (Ley 22/2015), incompatible con participar en la adopción del acuerdo.'
  WHERE role='AUDITOR' AND action='VOTE_EMISSION' AND (reason IS NULL OR btrim(reason)='');

UPDATE capability_matrix SET reason =
  'Compliance supervisa el cumplimiento, no certifica acuerdos (facultad del Secretario, art. 109 RRM). La separación garantiza la independencia del control interno (segregación de funciones).'
  WHERE role='COMPLIANCE' AND action='CERTIFICATION' AND (reason IS NULL OR btrim(reason)='');

UPDATE capability_matrix SET reason =
  'Compliance no congela el censo (acto de ordenación de la sesión del Secretario, art. 106 RRM); su rol es de supervisión del cumplimiento, no de ejecución de la sesión.'
  WHERE role='COMPLIANCE' AND action='SNAPSHOT_CREATION' AND (reason IS NULL OR btrim(reason)='');

UPDATE capability_matrix SET reason =
  'Compliance no es miembro del órgano y no emite voto; supervisa el cumplimiento sin participar en la adopción del acuerdo, preservando la independencia del control.'
  WHERE role='COMPLIANCE' AND action='VOTE_EMISSION' AND (reason IS NULL OR btrim(reason)='');
