BEGIN;

ALTER TABLE public.share_classes
  ADD COLUMN IF NOT EXISTS restrictions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.share_classes.restrictions IS
  'JSONB de derechos/restricciones de clase: dividendo preferente, restricciones estatutarias y otros atributos económicos no normalizados.';

DO $$
DECLARE
  v_sql text;
  v_next text;
BEGIN
  SELECT pg_get_functiondef('public.fn_crear_sociedad_legal_y_capital(uuid,jsonb)'::regprocedure)
    INTO v_sql;

  IF position('restrictions' in v_sql) = 0 THEN
    v_next := replace(
      v_sql,
$old$      veto_rights
    ) VALUES ($old$,
$new$      veto_rights,
      restrictions
    ) VALUES ($new$
    );
    IF v_next = v_sql THEN
      RAISE EXCEPTION 'Could not patch fn_crear_sociedad_legal_y_capital share_classes column list';
    END IF;
    v_sql := v_next;

    v_next := replace(
      v_sql,
$old$      COALESCE(NULLIF(v_item ->> 'veto_rights', '')::boolean, false)
    )$old$,
$new$      COALESCE(NULLIF(v_item ->> 'veto_rights', '')::boolean, false),
      COALESCE(v_item -> 'restrictions', '{}'::jsonb)
    )$new$
    );
    IF v_next = v_sql THEN
      RAISE EXCEPTION 'Could not patch fn_crear_sociedad_legal_y_capital share_classes values list';
    END IF;
    v_sql := v_next;

    EXECUTE v_sql;
  END IF;
END $$;

COMMIT;
