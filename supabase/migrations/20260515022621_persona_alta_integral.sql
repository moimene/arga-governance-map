-- 20260515022621_persona_alta_integral.sql
-- Alta integral de persona para Secretaría Societaria.
--
-- Mantiene `persons` como tabla canónica de identidad mínima y añade una
-- extensión 1:1 para datos completos de alta. No se aplica a Cloud desde este
-- archivo; queda como migración local hasta autorización explícita.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_persons_tenant_id_id
  ON public.persons(tenant_id, id);

CREATE TABLE IF NOT EXISTS public.persona_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,

  document_type text NOT NULL CHECK (
    document_type IN (
      'DNI',
      'NIE',
      'NIF',
      'CIF',
      'PASAPORTE',
      'TAX_ID_EXTRANJERO',
      'OTRO'
    )
  ),
  document_country text NOT NULL DEFAULT 'ES',
  nationality text,
  birth_date date,
  birth_place text,

  legal_form text,
  jurisdiction text,
  registry_name text,
  registry_number text,
  lei_code text,

  phone text,
  secondary_email text,
  preferred_language text NOT NULL DEFAULT 'es',

  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  province text,
  country text NOT NULL DEFAULT 'ES',

  notification_address_same boolean NOT NULL DEFAULT true,
  notification_address_line1 text,
  notification_address_line2 text,
  notification_postal_code text,
  notification_city text,
  notification_province text,
  notification_country text,

  governance_role text NOT NULL DEFAULT 'OTRO' CHECK (
    governance_role IN (
      'SOCIO',
      'CONSEJERO',
      'ADMINISTRADOR',
      'REPRESENTANTE',
      'APODERADO',
      'DIRECTIVO',
      'OTRO'
    )
  ),
  kyc_status text NOT NULL DEFAULT 'PENDIENTE' CHECK (
    kyc_status IN ('NO_APLICA', 'PENDIENTE', 'VERIFICADO', 'RECHAZADO')
  ),
  onboarding_status text NOT NULL DEFAULT 'COMPLETO' CHECK (
    onboarding_status IN ('BORRADOR', 'COMPLETO', 'PENDIENTE_EVIDENCIA')
  ),
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),

  CONSTRAINT persona_profiles_unique_person UNIQUE (tenant_id, person_id),
  CONSTRAINT persona_profiles_lei_unique UNIQUE (tenant_id, lei_code),
  CONSTRAINT persona_profiles_person_tenant_fk
    FOREIGN KEY (tenant_id, person_id)
    REFERENCES public.persons(tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_persona_profiles_tenant_person
  ON public.persona_profiles(tenant_id, person_id);

CREATE INDEX IF NOT EXISTS idx_persona_profiles_governance_role
  ON public.persona_profiles(tenant_id, governance_role);

DROP TRIGGER IF EXISTS set_updated_at_persona_profiles
  ON public.persona_profiles;
CREATE TRIGGER set_updated_at_persona_profiles
  BEFORE UPDATE ON public.persona_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.persona_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persona_profiles_select_tenant
  ON public.persona_profiles;
CREATE POLICY persona_profiles_select_tenant
  ON public.persona_profiles
  FOR SELECT
  USING (tenant_id = public.fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS persona_profiles_insert_tenant
  ON public.persona_profiles;
CREATE POLICY persona_profiles_insert_tenant
  ON public.persona_profiles
  FOR INSERT
  WITH CHECK (tenant_id = public.fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS persona_profiles_update_tenant
  ON public.persona_profiles;
CREATE POLICY persona_profiles_update_tenant
  ON public.persona_profiles
  FOR UPDATE
  USING (tenant_id = public.fn_secretaria_current_tenant_id())
  WITH CHECK (tenant_id = public.fn_secretaria_current_tenant_id());

REVOKE ALL ON public.persona_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.persona_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.persona_profiles TO service_role;

COMMENT ON TABLE public.persona_profiles IS
  'Perfil integral 1:1 de persona para Secretaría. `persons` conserva la identidad canónica mínima; esta tabla guarda datos registrales, contacto, domicilio, KYC y evidencias de alta.';

CREATE OR REPLACE FUNCTION public.fn_create_persona_completa(
  p_tenant_id uuid,
  p_payload jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_result jsonb;
  v_result_id uuid;
  v_person_id uuid;
  v_profile_id uuid;
  v_person_type text := NULLIF(btrim(COALESCE(p_payload ->> 'person_type', '')), '');
  v_full_name text := NULLIF(btrim(COALESCE(p_payload ->> 'full_name', '')), '');
  v_tax_id text := NULLIF(btrim(COALESCE(p_payload ->> 'tax_id', '')), '');
  v_email text := NULLIF(btrim(COALESCE(p_payload ->> 'email', '')), '');
  v_denomination text := NULLIF(btrim(COALESCE(p_payload ->> 'denomination', '')), '');
  v_profile jsonb := COALESCE(p_payload -> 'profile', '{}'::jsonb);
  v_evidence jsonb := COALESCE(p_payload -> 'evidence_summary', '{}'::jsonb);
  v_document_type text;
BEGIN
  PERFORM public.fn_secretaria_assert_tenant_access(p_tenant_id);
  PERFORM public.fn_secretaria_assert_capability(p_tenant_id, 'PERSON_WRITE');
  PERFORM public.fn_secretaria_assert_caller_authority_rm(p_tenant_id, NULL, NULL);

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'p_payload must be a JSON object';
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT result_id, result
      INTO v_result_id, v_result
      FROM public.personas_cargos_rpc_operations
     WHERE tenant_id = p_tenant_id
       AND operation = 'fn_create_persona_completa'
       AND idempotency_key = p_idempotency_key;
    IF v_result_id IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END IF;

  IF v_person_type NOT IN ('PF', 'PJ') THEN
    RAISE EXCEPTION 'person_type must be PF or PJ';
  END IF;
  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'full_name is required';
  END IF;
  IF v_tax_id IS NULL THEN
    RAISE EXCEPTION 'tax_id is required for complete person onboarding';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', 'persona_completa_tax_id', p_tenant_id, v_tax_id), 0)
  );

  IF EXISTS (
    SELECT 1
      FROM public.persons p
     WHERE p.tenant_id = p_tenant_id
       AND p.tax_id = v_tax_id
  ) THEN
    RAISE EXCEPTION 'person with tax_id % already exists in tenant %', v_tax_id, p_tenant_id;
  END IF;

  v_document_type := NULLIF(btrim(COALESCE(v_profile ->> 'document_type', '')), '');
  IF v_document_type IS NULL THEN
    v_document_type := CASE WHEN v_person_type = 'PJ' THEN 'CIF' ELSE 'DNI' END;
  END IF;

  INSERT INTO public.persons (
    tenant_id,
    person_type,
    full_name,
    tax_id,
    email,
    denomination
  ) VALUES (
    p_tenant_id,
    v_person_type,
    v_full_name,
    v_tax_id,
    v_email,
    CASE WHEN v_person_type = 'PJ' THEN COALESCE(v_denomination, v_full_name) ELSE v_denomination END
  )
  RETURNING id INTO v_person_id;

  INSERT INTO public.persona_profiles (
    tenant_id,
    person_id,
    document_type,
    document_country,
    nationality,
    birth_date,
    birth_place,
    legal_form,
    jurisdiction,
    registry_name,
    registry_number,
    lei_code,
    phone,
    secondary_email,
    preferred_language,
    address_line1,
    address_line2,
    postal_code,
    city,
    province,
    country,
    notification_address_same,
    notification_address_line1,
    notification_address_line2,
    notification_postal_code,
    notification_city,
    notification_province,
    notification_country,
    governance_role,
    kyc_status,
    onboarding_status,
    evidence_summary,
    notes
  ) VALUES (
    p_tenant_id,
    v_person_id,
    v_document_type,
    COALESCE(NULLIF(btrim(COALESCE(v_profile ->> 'document_country', '')), ''), 'ES'),
    NULLIF(btrim(COALESCE(v_profile ->> 'nationality', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'birth_date', '')), '')::date,
    NULLIF(btrim(COALESCE(v_profile ->> 'birth_place', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'legal_form', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'jurisdiction', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'registry_name', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'registry_number', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'lei_code', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'phone', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'secondary_email', '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(v_profile ->> 'preferred_language', '')), ''), 'es'),
    NULLIF(btrim(COALESCE(v_profile ->> 'address_line1', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'address_line2', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'postal_code', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'city', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'province', '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(v_profile ->> 'country', '')), ''), 'ES'),
    COALESCE(NULLIF(v_profile ->> 'notification_address_same', '')::boolean, true),
    NULLIF(btrim(COALESCE(v_profile ->> 'notification_address_line1', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'notification_address_line2', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'notification_postal_code', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'notification_city', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'notification_province', '')), ''),
    NULLIF(btrim(COALESCE(v_profile ->> 'notification_country', '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(v_profile ->> 'governance_role', '')), ''), 'OTRO'),
    COALESCE(NULLIF(btrim(COALESCE(v_profile ->> 'kyc_status', '')), ''), 'PENDIENTE'),
    COALESCE(NULLIF(btrim(COALESCE(v_profile ->> 'onboarding_status', '')), ''), 'COMPLETO'),
    v_evidence,
    NULLIF(btrim(COALESCE(v_profile ->> 'notes', '')), '')
  )
  RETURNING id INTO v_profile_id;

  v_result := jsonb_build_object(
    'person_id', v_person_id,
    'profile_id', v_profile_id
  );

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    INSERT INTO public.personas_cargos_rpc_operations (
      tenant_id,
      operation,
      idempotency_key,
      result_id,
      result
    ) VALUES (
      p_tenant_id,
      'fn_create_persona_completa',
      p_idempotency_key,
      v_person_id,
      v_result
    )
    ON CONFLICT (tenant_id, operation, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_persona_completa(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_create_persona_completa(uuid, jsonb, text)
  TO authenticated, service_role;

COMMIT;
