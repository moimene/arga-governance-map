BEGIN;

COMMENT ON COLUMN public.registry_filing_events.effective_at IS
  'Timestamp tecnico inmutable del asiento en el ledger. No sustituye las fechas juridicas declaradas del negocio, como registry_filings.deed_date o presentation_date, que se conservan en el expediente y payload.';

COMMENT ON COLUMN public.registry_filing_events.created_at IS
  'Timestamp de persistencia del evento WORM; se muestra como traza tecnica y nunca como prueba automatica de efectos registrales.';

COMMENT ON COLUMN public.minutes.signed_at IS
  'Timestamp tecnico de aprobacion/firma en la aplicacion. En escenarios demo futuros debe mostrarse separado de la fecha societaria declarada y no acredita por si solo una firma productiva.';

COMMIT;
