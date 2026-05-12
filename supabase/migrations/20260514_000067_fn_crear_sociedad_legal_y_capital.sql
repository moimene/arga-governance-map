-- 20260514_000067_fn_crear_sociedad_legal_y_capital.sql
-- Alta de sociedad D6: campos legales de entities + RPC TX1
-- Guard: run `bun run db:check-target` before applying to any environment.
--
-- Cloud apply is manual via MCP Supabase. Codex must not run `db push`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Entities legal fields. Legacy rows are kept valid: all fields are
-- nullable except support_docs_metadata and onboarding_status after the
-- explicit legacy backfill below.
-- ---------------------------------------------------------------------

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS constitution_date date,
  ADD COLUMN IF NOT EXISTS registration_date date,
  ADD COLUMN IF NOT EXISTS registry_location text,
  ADD COLUMN IF NOT EXISTS registry_volume text,
  ADD COLUMN IF NOT EXISTS registry_folio text,
  ADD COLUMN IF NOT EXISTS registry_sheet text,
  ADD COLUMN IF NOT EXISTS registry_inscription text,
  ADD COLUMN IF NOT EXISTS lei_code text,
  ADD COLUMN IF NOT EXISTS cnae_primary text,
  ADD COLUMN IF NOT EXISTS cnae_secondary text[],
  ADD COLUMN IF NOT EXISTS corporate_purpose text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS fiscal_year_close text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_floor text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS corporate_email text,
  ADD COLUMN IF NOT EXISTS regulated_sector text,
  ADD COLUMN IF NOT EXISTS group_role text,
  ADD COLUMN IF NOT EXISTS support_docs_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Critical order: add without default -> backfill legacy -> set pessimistic
-- default for future inserts. Do not collapse into ADD COLUMN DEFAULT.
ALTER TABLE entities ADD COLUMN IF NOT EXISTS onboarding_status text;

UPDATE entities
   SET onboarding_status = 'OPERATIVA'
 WHERE onboarding_status IS NULL;

ALTER TABLE entities
  ALTER COLUMN onboarding_status SET DEFAULT 'INCOMPLETA_CARGOS',
  ALTER COLUMN onboarding_status SET NOT NULL;

ALTER TABLE entities
  DROP CONSTRAINT IF EXISTS chk_entities_onboarding_status;
ALTER TABLE entities
  ADD CONSTRAINT chk_entities_onboarding_status
  CHECK (onboarding_status IN ('OPERATIVA', 'INCOMPLETA_CARGOS', 'INCOMPLETA_DATOS', 'BORRADOR'));

-- ---------------------------------------------------------------------
-- fn_crear_sociedad_legal_y_capital
--
-- TX1 server-side: persons(PJ), entities, capital profile, share classes,
-- socios/persons, capital holdings, governing bodies, entity_settings and
-- rule_param_overrides. Atomicity comes from exception propagation in one
-- PL/pgSQL function invocation. There is intentionally no transaction
-- control statement in this migration.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_crear_sociedad_legal_y_capital(
  p_tenant_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_root text;
  v_sociedad_pj jsonb;
  v_entity jsonb;
  v_capital_profile jsonb;
  v_item jsonb;
  v_person_id uuid;
  v_entity_id uuid;
  v_share_class_id uuid;
  v_holding_id uuid;
  v_body_id uuid;
  v_holder_person_id uuid;
  v_share_class_ids jsonb := '{}'::jsonb;
  v_person_ids_by_key jsonb := '{}'::jsonb;
  v_body_ids jsonb := '{}'::jsonb;
  v_holding_ids jsonb := '[]'::jsonb;
  v_settings_skipped jsonb := '[]'::jsonb;
  v_tax text;
  v_person_key text;
  v_class_code text;
  v_body_key text;
  v_duplicate_tax text;
  v_capital_escriturado numeric;
  v_capital_desembolsado numeric;
  v_onboarding_status text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO', 'ADMIN_TENANT']);

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload must be a JSON object' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_required_root IN ARRAY ARRAY[
    'sociedad_pj',
    'entity',
    'capital_profile',
    'share_classes',
    'socios',
    'capital_holdings',
    'governing_bodies'
  ] LOOP
    IF NOT (p_payload ? v_required_root) THEN
      RAISE EXCEPTION 'payload root missing: %', v_required_root USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF jsonb_typeof(p_payload -> 'share_classes') <> 'array' THEN
    RAISE EXCEPTION 'share_classes must be an array' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_payload -> 'socios') <> 'array' THEN
    RAISE EXCEPTION 'socios must be an array' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_payload -> 'capital_holdings') <> 'array' THEN
    RAISE EXCEPTION 'capital_holdings must be an array' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_payload -> 'governing_bodies') <> 'array' THEN
    RAISE EXCEPTION 'governing_bodies must be an array' USING ERRCODE = 'P0001';
  END IF;

  v_sociedad_pj := p_payload -> 'sociedad_pj';
  v_entity := p_payload -> 'entity';
  v_capital_profile := p_payload -> 'capital_profile';

  v_capital_escriturado := COALESCE(NULLIF(v_capital_profile ->> 'capital_escriturado', '')::numeric, 0);
  v_capital_desembolsado := COALESCE(NULLIF(v_capital_profile ->> 'capital_desembolsado', '')::numeric, v_capital_escriturado);

  IF v_capital_escriturado <= 0 THEN
    RAISE EXCEPTION 'capital_escriturado must be positive' USING ERRCODE = 'P0001';
  END IF;
  IF v_capital_desembolsado > v_capital_escriturado THEN
    RAISE EXCEPTION 'capital_desembolsado cannot exceed capital_escriturado' USING ERRCODE = 'P0001';
  END IF;

  SELECT tax_id
    INTO v_duplicate_tax
    FROM (
      SELECT upper(trim(value ->> 'tax_id')) AS tax_id
        FROM jsonb_array_elements(p_payload -> 'socios')
       WHERE COALESCE(NULLIF(value ->> 'is_treasury', '')::boolean, false) IS FALSE
         AND NULLIF(trim(value ->> 'tax_id'), '') IS NOT NULL
    ) s
   GROUP BY tax_id
  HAVING count(*) > 1
   LIMIT 1;

  IF v_duplicate_tax IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate tax_id in socios payload: %', v_duplicate_tax USING ERRCODE = 'P0001';
  END IF;

  v_tax := NULLIF(trim(v_sociedad_pj ->> 'tax_id'), '');
  IF v_tax IS NULL THEN
    RAISE EXCEPTION 'sociedad_pj.tax_id is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT id
    INTO v_person_id
    FROM persons
   WHERE tenant_id = p_tenant_id
     AND tax_id = v_tax
   LIMIT 1;

  IF v_person_id IS NULL THEN
    INSERT INTO persons (
      tenant_id,
      full_name,
      denomination,
      tax_id,
      person_type,
      email
    ) VALUES (
      p_tenant_id,
      COALESCE(NULLIF(v_sociedad_pj ->> 'full_name', ''), NULLIF(v_sociedad_pj ->> 'denomination', '')),
      COALESCE(NULLIF(v_sociedad_pj ->> 'denomination', ''), NULLIF(v_sociedad_pj ->> 'full_name', '')),
      v_tax,
      COALESCE(NULLIF(v_sociedad_pj ->> 'person_type', ''), 'PJ'),
      NULLIF(v_sociedad_pj ->> 'email', '')
    )
    RETURNING id INTO v_person_id;
  END IF;

  v_onboarding_status := COALESCE(NULLIF(v_entity ->> 'onboarding_status', ''), 'INCOMPLETA_CARGOS');
  IF v_onboarding_status = 'OPERATIVA' THEN
    RAISE EXCEPTION 'TX1 cannot create an OPERATIVA society; status is promoted only after TX2'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_onboarding_status NOT IN ('INCOMPLETA_CARGOS', 'INCOMPLETA_DATOS', 'BORRADOR') THEN
    RAISE EXCEPTION 'invalid onboarding_status: %', v_onboarding_status USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO entities (
    tenant_id,
    person_id,
    slug,
    legal_name,
    common_name,
    jurisdiction,
    legal_form,
    tipo_social,
    registration_number,
    forma_administracion,
    tipo_organo_admin,
    es_unipersonal,
    es_cotizada,
    entity_status,
    materiality,
    parent_entity_id,
    ownership_percentage,
    constitution_date,
    registration_date,
    registry_location,
    registry_volume,
    registry_folio,
    registry_sheet,
    registry_inscription,
    lei_code,
    cnae_primary,
    cnae_secondary,
    corporate_purpose,
    duration,
    fiscal_year_close,
    address,
    address_street,
    address_number,
    address_floor,
    postal_code,
    city,
    province,
    country,
    website,
    corporate_email,
    regulated_sector,
    group_role,
    onboarding_status,
    support_docs_metadata
  ) VALUES (
    p_tenant_id,
    v_person_id,
    NULLIF(v_entity ->> 'slug', ''),
    COALESCE(NULLIF(v_entity ->> 'legal_name', ''), NULLIF(v_sociedad_pj ->> 'full_name', '')),
    NULLIF(v_entity ->> 'common_name', ''),
    NULLIF(v_entity ->> 'jurisdiction', ''),
    NULLIF(v_entity ->> 'legal_form', ''),
    NULLIF(v_entity ->> 'tipo_social', ''),
    NULLIF(v_entity ->> 'registration_number', ''),
    NULLIF(v_entity ->> 'forma_administracion', ''),
    NULLIF(v_entity ->> 'tipo_organo_admin', ''),
    COALESCE(NULLIF(v_entity ->> 'es_unipersonal', '')::boolean, false),
    COALESCE(NULLIF(v_entity ->> 'es_cotizada', '')::boolean, false),
    COALESCE(NULLIF(v_entity ->> 'entity_status', ''), 'Active'),
    COALESCE(NULLIF(v_entity ->> 'materiality', ''), 'Medium'),
    NULLIF(v_entity ->> 'parent_entity_id', '')::uuid,
    NULLIF(v_entity ->> 'ownership_percentage', '')::numeric,
    NULLIF(v_entity ->> 'constitution_date', '')::date,
    NULLIF(v_entity ->> 'registration_date', '')::date,
    NULLIF(v_entity ->> 'registry_location', ''),
    NULLIF(v_entity ->> 'registry_volume', ''),
    NULLIF(v_entity ->> 'registry_folio', ''),
    NULLIF(v_entity ->> 'registry_sheet', ''),
    NULLIF(v_entity ->> 'registry_inscription', ''),
    NULLIF(v_entity ->> 'lei_code', ''),
    NULLIF(v_entity ->> 'cnae_primary', ''),
    CASE
      WHEN jsonb_typeof(v_entity -> 'cnae_secondary') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_entity -> 'cnae_secondary'))
      ELSE ARRAY[]::text[]
    END,
    NULLIF(v_entity ->> 'corporate_purpose', ''),
    NULLIF(v_entity ->> 'duration', ''),
    NULLIF(v_entity ->> 'fiscal_year_close', ''),
    NULLIF(v_entity ->> 'address', ''),
    NULLIF(v_entity ->> 'address_street', ''),
    NULLIF(v_entity ->> 'address_number', ''),
    NULLIF(v_entity ->> 'address_floor', ''),
    NULLIF(v_entity ->> 'postal_code', ''),
    NULLIF(v_entity ->> 'city', ''),
    NULLIF(v_entity ->> 'province', ''),
    NULLIF(v_entity ->> 'country', ''),
    NULLIF(v_entity ->> 'website', ''),
    NULLIF(v_entity ->> 'corporate_email', ''),
    NULLIF(v_entity ->> 'regulated_sector', ''),
    NULLIF(v_entity ->> 'group_role', ''),
    v_onboarding_status,
    COALESCE(v_entity -> 'support_docs_metadata', '{}'::jsonb)
  )
  RETURNING id INTO v_entity_id;

  INSERT INTO entity_capital_profile (
    tenant_id,
    entity_id,
    currency,
    capital_escriturado,
    capital_desembolsado,
    numero_titulos,
    valor_nominal,
    estado,
    effective_from
  ) VALUES (
    p_tenant_id,
    v_entity_id,
    COALESCE(NULLIF(v_capital_profile ->> 'currency', ''), 'EUR'),
    v_capital_escriturado,
    v_capital_desembolsado,
    NULLIF(v_capital_profile ->> 'numero_titulos', '')::numeric,
    NULLIF(v_capital_profile ->> 'valor_nominal', '')::numeric,
    'VIGENTE',
    COALESCE(NULLIF(v_capital_profile ->> 'effective_from', '')::date, CURRENT_DATE)
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'share_classes') LOOP
    v_class_code := NULLIF(trim(v_item ->> 'class_code'), '');
    IF v_class_code IS NULL THEN
      RAISE EXCEPTION 'share class class_code is required' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO share_classes (
      tenant_id,
      entity_id,
      class_code,
      name,
      votes_per_title,
      economic_rights_coeff,
      voting_rights,
      veto_rights
    ) VALUES (
      p_tenant_id,
      v_entity_id,
      v_class_code,
      COALESCE(NULLIF(v_item ->> 'name', ''), v_class_code),
      COALESCE(NULLIF(v_item ->> 'votes_per_title', '')::numeric, 1),
      COALESCE(NULLIF(v_item ->> 'economic_rights_coeff', '')::numeric, 1),
      COALESCE(NULLIF(v_item ->> 'voting_rights', '')::boolean, true),
      COALESCE(NULLIF(v_item ->> 'veto_rights', '')::boolean, false)
    )
    RETURNING id INTO v_share_class_id;

    v_share_class_ids := v_share_class_ids || jsonb_build_object(v_class_code, v_share_class_id);
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'socios') LOOP
    IF COALESCE(NULLIF(v_item ->> 'is_treasury', '')::boolean, false) THEN
      v_person_key := COALESCE(NULLIF(v_item ->> 'key', ''), '__TREASURY__');
      v_person_ids_by_key := v_person_ids_by_key || jsonb_build_object(v_person_key, v_person_id);
      CONTINUE;
    END IF;

    v_tax := NULLIF(trim(v_item ->> 'tax_id'), '');
    IF v_tax IS NULL THEN
      RAISE EXCEPTION 'socio tax_id is required' USING ERRCODE = 'P0001';
    END IF;

    SELECT id
      INTO v_holder_person_id
      FROM persons
     WHERE tenant_id = p_tenant_id
       AND tax_id = v_tax
     LIMIT 1;

    IF v_holder_person_id IS NULL THEN
      INSERT INTO persons (
        tenant_id,
        full_name,
        denomination,
        tax_id,
        person_type,
        email
      ) VALUES (
        p_tenant_id,
        COALESCE(NULLIF(v_item ->> 'full_name', ''), NULLIF(v_item ->> 'denomination', '')),
        NULLIF(v_item ->> 'denomination', ''),
        v_tax,
        COALESCE(NULLIF(v_item ->> 'person_type', ''), 'PF'),
        NULLIF(v_item ->> 'email', '')
      )
      RETURNING id INTO v_holder_person_id;
    END IF;

    v_person_key := COALESCE(NULLIF(v_item ->> 'key', ''), v_tax);
    v_person_ids_by_key := v_person_ids_by_key || jsonb_build_object(v_person_key, v_holder_person_id);
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'capital_holdings') LOOP
    IF COALESCE(NULLIF(v_item ->> 'is_treasury', '')::boolean, false) THEN
      v_holder_person_id := v_person_id;
    ELSE
      v_person_key := COALESCE(NULLIF(v_item ->> 'holder_key', ''), NULLIF(v_item ->> 'holder_tax_id', ''));
      v_holder_person_id := NULLIF(v_person_ids_by_key ->> v_person_key, '')::uuid;
      IF v_holder_person_id IS NULL AND NULLIF(v_item ->> 'holder_tax_id', '') IS NOT NULL THEN
        SELECT id
          INTO v_holder_person_id
          FROM persons
         WHERE tenant_id = p_tenant_id
           AND tax_id = v_item ->> 'holder_tax_id'
         LIMIT 1;
      END IF;
    END IF;

    IF v_holder_person_id IS NULL THEN
      RAISE EXCEPTION 'holder not resolved for capital holding: %', v_item USING ERRCODE = 'P0001';
    END IF;

    v_class_code := NULLIF(v_item ->> 'share_class_code', '');
    v_share_class_id := NULLIF(v_share_class_ids ->> v_class_code, '')::uuid;

    INSERT INTO capital_holdings (
      tenant_id,
      entity_id,
      holder_person_id,
      share_class_id,
      numero_titulos,
      porcentaje_capital,
      voting_rights,
      is_treasury,
      effective_from,
      metadata
    ) VALUES (
      p_tenant_id,
      v_entity_id,
      v_holder_person_id,
      v_share_class_id,
      COALESCE(NULLIF(v_item ->> 'numero_titulos', '')::numeric, 0),
      NULLIF(v_item ->> 'porcentaje_capital', '')::numeric,
      -- voting_rights se fuerza a false si is_treasury=true (contrato D6
      -- spec §2.5 Q6: autocartera con voting_rights=false). Evita que un
      -- caller que omite voting_rights pero marca is_treasury deje
      -- capital_holdings.voting_rights=true, lo que confundiría a UI/exports
      -- aunque fn_refresh_parte_votante_entity ya zerea pesos.
      COALESCE(NULLIF(v_item ->> 'voting_rights', '')::boolean, true)
        AND NOT COALESCE(NULLIF(v_item ->> 'is_treasury', '')::boolean, false),
      COALESCE(NULLIF(v_item ->> 'is_treasury', '')::boolean, false),
      COALESCE(NULLIF(v_item ->> 'effective_from', '')::date, CURRENT_DATE),
      COALESCE(v_item -> 'metadata', '{}'::jsonb)
    )
    RETURNING id INTO v_holding_id;

    v_holding_ids := v_holding_ids || jsonb_build_array(v_holding_id);
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'governing_bodies') LOOP
    v_body_key := COALESCE(
      NULLIF(v_item ->> 'body_key', ''),
      NULLIF(v_item ->> 'key', ''),
      NULLIF(v_item ->> 'body_type', ''),
      NULLIF(v_item ->> 'name', '')
    );
    IF v_body_key IS NULL THEN
      RAISE EXCEPTION 'governing body key/name is required' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO governing_bodies (
      tenant_id,
      entity_id,
      slug,
      name,
      body_type,
      config,
      quorum_rule
    ) VALUES (
      p_tenant_id,
      v_entity_id,
      NULLIF(v_item ->> 'slug', ''),
      COALESCE(NULLIF(v_item ->> 'name', ''), v_body_key),
      NULLIF(v_item ->> 'body_type', ''),
      COALESCE(v_item -> 'config', '{}'::jsonb),
      COALESCE(v_item -> 'quorum_rule', '{}'::jsonb)
    )
    RETURNING id INTO v_body_id;

    v_body_ids := v_body_ids || jsonb_build_object(v_body_key, v_body_id);
  END LOOP;

  IF jsonb_typeof(COALESCE(p_payload -> 'entity_settings', '[]'::jsonb)) = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'entity_settings', '[]'::jsonb)) LOOP
      IF EXISTS (
        SELECT 1
          FROM entity_settings_catalog esc
         WHERE esc.key = v_item ->> 'key'
           AND esc.estado_catalog = 'ACTIVA'
      ) THEN
        INSERT INTO entity_settings (
          tenant_id,
          entity_id,
          key,
          value
        ) VALUES (
          p_tenant_id,
          v_entity_id,
          v_item ->> 'key',
          COALESCE(v_item -> 'value', 'null'::jsonb)
        )
        ON CONFLICT (entity_id, key)
        DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = now();
      ELSE
        v_settings_skipped := v_settings_skipped || jsonb_build_array(v_item ->> 'key');
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(COALESCE(p_payload -> 'rule_param_overrides', '[]'::jsonb)) = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'rule_param_overrides', '[]'::jsonb)) LOOP
      INSERT INTO rule_param_overrides (
        tenant_id,
        entity_id,
        materia,
        clave,
        valor,
        fuente,
        referencia
      ) VALUES (
        p_tenant_id,
        v_entity_id,
        v_item ->> 'materia',
        v_item ->> 'clave',
        COALESCE(v_item -> 'valor', 'null'::jsonb),
        COALESCE(NULLIF(v_item ->> 'fuente', ''), 'ESTATUTOS'),
        NULLIF(v_item ->> 'referencia', '')
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'entity_id', v_entity_id,
    'person_id', v_person_id,
    'body_ids', v_body_ids,
    'share_class_ids', v_share_class_ids,
    'holding_ids', v_holding_ids,
    'settings_skipped', v_settings_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_crear_sociedad_legal_y_capital(uuid, jsonb)
  TO authenticated;

COMMENT ON FUNCTION fn_crear_sociedad_legal_y_capital(uuid, jsonb)
  IS 'Alta de sociedad D6 TX1: crea estructura legal/capital en una funcion atomica por excepcion. TX2 personas/cargos vive en adapters.ts.';
