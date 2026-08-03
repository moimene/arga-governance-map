-- Secretaría — destino determinista para libros de actas dedicados a un órgano.
--
-- `fn_seed_mandatory_books` ya crea un volumen de actas con `body_id` para
-- cada órgano, pero la tabla de secciones nació después y no recibió ese
-- backfill. El resolver de actas encontraba por ello cero candidatos aunque
-- el libro correcto existiera. Un libro dedicado y abierto no requiere una
-- decisión jurídica adicional: su única sección MINUTES hereda el órgano del
-- propio libro. La configuración queda persistida y auditable.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_secretaria_ensure_dedicated_minute_book_section()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_body_name text;
  v_section_code text;
BEGIN
  IF NEW.body_id IS NULL
     OR upper(COALESCE(NEW.book_kind, '')) NOT LIKE '%ACTA%'
     OR NEW.status <> 'OPEN'
     OR NEW.closed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name
    INTO v_body_name
    FROM public.governing_bodies
   WHERE id = NEW.body_id
     AND tenant_id = NEW.tenant_id
     AND entity_id = NEW.entity_id;

  IF v_body_name IS NULL THEN
    RETURN NEW;
  END IF;

  v_section_code := 'MINUTES_' || upper(replace(NEW.body_id::text, '-', '_'));

  IF EXISTS (
    SELECT 1
      FROM public.societary_book_sections
     WHERE book_id = NEW.id
       AND body_id = NEW.body_id
       AND section_kind = 'MINUTES'
       AND routing_status = 'ACTIVE'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.secretaria_book_section_rpc', '1', true);
  INSERT INTO public.societary_book_sections (
    tenant_id,
    book_id,
    body_id,
    section_code,
    section_label,
    section_kind,
    routing_status,
    metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.body_id,
    v_section_code,
    'Actas — ' || v_body_name,
    'MINUTES',
    'ACTIVE',
    jsonb_build_object(
      'configured_by', 'DEDICATED_BOOK_INHERITANCE',
      'book_kind', NEW.book_kind
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mandatory_books_ensure_minute_section
  ON public.mandatory_books;
CREATE TRIGGER trg_mandatory_books_ensure_minute_section
  AFTER INSERT OR UPDATE OF body_id, book_kind, status, closed_at
  ON public.mandatory_books
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_secretaria_ensure_dedicated_minute_book_section();

DO $backfill$
DECLARE
  v_book public.mandatory_books%ROWTYPE;
BEGIN
  FOR v_book IN
    SELECT *
      FROM public.mandatory_books
     WHERE body_id IS NOT NULL
       AND upper(COALESCE(book_kind, '')) LIKE '%ACTA%'
       AND status = 'OPEN'
       AND closed_at IS NULL
  LOOP
    PERFORM set_config('app.secretaria_book_section_rpc', '1', true);
    INSERT INTO public.societary_book_sections (
      tenant_id,
      book_id,
      body_id,
      section_code,
      section_label,
      section_kind,
      routing_status,
      metadata
    )
    SELECT
      v_book.tenant_id,
      v_book.id,
      v_book.body_id,
      'MINUTES_' || upper(replace(v_book.body_id::text, '-', '_')),
      'Actas — ' || body.name,
      'MINUTES',
      'ACTIVE',
      jsonb_build_object(
        'configured_by', 'DEDICATED_BOOK_BACKFILL',
        'book_kind', v_book.book_kind
      )
    FROM public.governing_bodies AS body
    WHERE body.id = v_book.body_id
      AND body.tenant_id = v_book.tenant_id
      AND body.entity_id = v_book.entity_id
      AND NOT EXISTS (
        SELECT 1
          FROM public.societary_book_sections AS existing
         WHERE existing.book_id = v_book.id
           AND existing.body_id = v_book.body_id
           AND existing.section_kind = 'MINUTES'
           AND existing.routing_status = 'ACTIVE'
      );
  END LOOP;
END;
$backfill$;

REVOKE ALL ON FUNCTION public.fn_secretaria_ensure_dedicated_minute_book_section()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_secretaria_ensure_dedicated_minute_book_section()
  TO service_role;

COMMIT;
