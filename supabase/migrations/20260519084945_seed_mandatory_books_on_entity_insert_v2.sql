CREATE OR REPLACE FUNCTION public.fn_seed_mandatory_books(p_entity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_entity record;
  v_tipo text;
  v_period integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_deadline date := make_date(v_period + 1, 4, 30);
  v_books text[];
  v_book text;
BEGIN
  SELECT id, tenant_id, tipo_social, legal_form
    INTO v_entity
    FROM entities
   WHERE id = p_entity_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_tipo := UPPER(COALESCE(NULLIF(v_entity.tipo_social, ''), v_entity.legal_form, ''));

  v_books := ARRAY['LIBRO_ACTAS']::text[];
  IF v_tipo IN ('SL', 'SLU') THEN
    v_books := array_append(v_books, 'LIBRO_REGISTRO_SOCIOS');
  ELSIF v_tipo IN ('SA', 'SAU') THEN
    v_books := array_append(v_books, 'LIBRO_ACCIONES_NOMINATIVAS');
  END IF;
  IF v_tipo IN ('SLU', 'SAU') THEN
    v_books := array_append(v_books, 'LIBRO_CONTRATOS_SOCIO_UNICO');
  END IF;

  FOREACH v_book IN ARRAY v_books LOOP
    INSERT INTO mandatory_books (
      tenant_id, entity_id, book_kind, volume_number, period,
      status, opened_at, legalization_deadline, legalization_status
    )
    VALUES (
      v_entity.tenant_id, p_entity_id, v_book, 1, v_period,
      'OPEN', CURRENT_DATE, v_deadline, 'PENDIENTE'
    )
    ON CONFLICT (entity_id, book_kind, period, volume_number) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_seed_mandatory_books_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.fn_seed_mandatory_books(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entities_seed_mandatory_books ON public.entities;
CREATE TRIGGER trg_entities_seed_mandatory_books
AFTER INSERT ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.fn_seed_mandatory_books_trigger();

DO $$
DECLARE
  v_eid uuid;
  v_period integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
BEGIN
  FOR v_eid IN
    SELECT e.id FROM entities e
    WHERE NOT EXISTS (
      SELECT 1 FROM mandatory_books mb
       WHERE mb.entity_id = e.id AND mb.period = v_period
    )
  LOOP
    PERFORM public.fn_seed_mandatory_books(v_eid);
  END LOOP;
END $$;;
