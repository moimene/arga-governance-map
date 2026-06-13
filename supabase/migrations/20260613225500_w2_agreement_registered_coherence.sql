-- Remediación W2 (hallazgo /codex) — coherencia timeline expediente↔registro.
-- ============================================================================
-- ExpedienteAcuerdo renderiza el badge/timeline desde agreements.status (no
-- desde la última registry_filing). Tras llevar dos filings a INSCRITA, sus
-- agreements seguían en CERTIFIED/INSTRUMENTED, mostrando "Certificado" con la
-- timeline parada en el paso 4 mientras el registro decía "Inscrita". Se
-- promueven esos agreements a REGISTERED. El agreement de la filing DENEGADA
-- (1e017412) se deja en CERTIFIED a propósito: tiene una segunda filing en
-- PREPARADA (re-presentación en curso), por lo que no es terminal. Forward-only,
-- idempotente (guarda por estado de origen).

UPDATE agreements SET status = 'REGISTERED'
 WHERE id IN (
   '3c217750-e2bd-4ef3-8d9f-f2c0e6062dd0',
   'ace30b81-9038-43ee-be91-2bb937be76b1'
 )
   AND status IN ('CERTIFIED', 'INSTRUMENTED', 'FILED');
