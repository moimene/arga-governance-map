-- MOI-175 (F5.T10) — aristas GRC↔IA: tabla `grc_ai_links` y RPC gobernada
-- `fn_grc_vincular_ia`. Referencia: docs/superpowers/specs/2026-09-19-aims-
-- cobertura-ria-experto-design.md §7 (Ciberseguridad, Políticas) y §8.
--
-- El enlace es de solo lectura para `authenticated`: se escribe únicamente
-- por la RPC (SECURITY DEFINER), que exige la capacidad nueva 'GRC_AI_LINK'
-- del `capability_matrix` compartido (reutiliza `fn_secretaria_assert_capability`,
-- ya usado fuera del dominio Secretaría por las RPC de AIMS). Ningún control
-- ni obligación cambia de FK: la arista es una tabla puente, nunca mueve
-- `controls.obligation_id` ni ninguna otra columna existente.

CREATE TABLE IF NOT EXISTS public.grc_ai_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  grc_kind text NOT NULL CHECK (grc_kind IN ('CONTROL', 'OBLIGATION', 'RISK', 'FINDING')),
  -- Polimórfico a propósito (controls.id / obligations.id / risks.id /
  -- findings.id según grc_kind): las cuatro tablas de destino son uuid, pero
  -- no hay una única tabla padre a la que apuntar con una FK nativa. La RPC
  -- comprueba la pertenencia al tenant en el camino de escritura.
  grc_id uuid NOT NULL,
  ai_system_id uuid REFERENCES public.ai_systems(id) ON DELETE RESTRICT,
  ai_incident_id uuid REFERENCES public.ai_incidents(id) ON DELETE RESTRICT,
  -- Generada y NOT NULL: exige que al menos uno de los dos objetos de IA esté
  -- presente (hace de CHECK) y sirve de clave natural para el upsert
  -- idempotente del seed.
  ai_target uuid GENERATED ALWAYS AS (COALESCE(ai_system_id, ai_incident_id)) STORED,
  aims_measure_code text,
  policy_clause text,
  relation text NOT NULL CHECK (relation IN ('MITIGA', 'CUMPLE', 'RESTRINGE', 'NOTIFICA_SEGUN')),
  rationale text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grc_ai_links_target_not_null CHECK (ai_target IS NOT NULL),
  CONSTRAINT grc_ai_links_unico UNIQUE (tenant_id, grc_kind, grc_id, relation, ai_target)
);

COMMENT ON TABLE public.grc_ai_links IS
  'F5.T10: arista GRC↔IA (control/obligación/riesgo/hallazgo hacia un sistema o incidente de IA). Solo se escribe por fn_grc_vincular_ia.';
COMMENT ON COLUMN public.grc_ai_links.grc_id IS
  'id de controls/obligations/risks/findings según grc_kind. Sin FK nativa (destino polimórfico); la RPC valida pertenencia al tenant.';

ALTER TABLE public.grc_ai_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grc_ai_links_tenant_read ON public.grc_ai_links;
CREATE POLICY grc_ai_links_tenant_read ON public.grc_ai_links
  FOR SELECT
  USING (tenant_id = public.fn_current_tenant_id());

-- Sin política de escritura para `authenticated`: el único camino es la RPC
-- SECURITY DEFINER. Se revoca explícitamente TODO antes de conceder SELECT,
-- porque un GRANT es aditivo y ALTER DEFAULT PRIVILEGES del esquema ya
-- concede INSERT/UPDATE/DELETE a anon/authenticated sobre tabla nueva
-- (medido en este proyecto).
REVOKE ALL ON public.grc_ai_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.grc_ai_links TO authenticated;

CREATE INDEX IF NOT EXISTS ix_grc_ai_links_ai_system ON public.grc_ai_links (ai_system_id) WHERE ai_system_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_grc_ai_links_ai_incident ON public.grc_ai_links (ai_incident_id) WHERE ai_incident_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_grc_ai_links_grc ON public.grc_ai_links (tenant_id, grc_kind, grc_id);

-- Capacidad nueva en el capability_matrix compartido (ya usado fuera de
-- Secretaría por las RPC de AIMS, F2.T5). GRC Compass es el dueño de la
-- arista: Secretaría no crea vínculos GRC↔IA (regla de "no debe hacer" del
-- ownership del repo), Consejero/Auditor son de solo lectura.
ALTER TABLE public.capability_matrix DROP CONSTRAINT IF EXISTS capability_matrix_action_check;
ALTER TABLE public.capability_matrix ADD CONSTRAINT capability_matrix_action_check
  CHECK (action = ANY (ARRAY[
    'SNAPSHOT_CREATION', 'VOTE_EMISSION', 'CERTIFICATION', 'CARGO_MANAGEMENT',
    'PERSON_WRITE', 'PERSON_CONSOLIDATE', 'REPRESENTATION_MANAGEMENT', 'CONVOCATION_ISSUE',
    'AIMS_INVENTARIO', 'AIMS_CLASIFICAR', 'AIMS_EVALUAR', 'AIMS_REVISAR', 'AIMS_OBLIGACIONES',
    'AIMS_ENTREGABLE_APROBAR', 'AIMS_INCIDENTE', 'AIMS_REGISTRO', 'AIMS_GOBIERNO',
    'GRC_AI_LINK'
  ]));

INSERT INTO public.capability_matrix (id, role, action, enabled, reason) VALUES
  (gen_random_uuid(), 'SECRETARIO',   'GRC_AI_LINK', false, 'Secretaría no crea vínculos GRC↔IA: no debe dar de alta incidentes/riesgos/controles ni sus aristas (ownership del repo, F5.T10).'),
  (gen_random_uuid(), 'CONSEJERO',    'GRC_AI_LINK', false, 'El consejero supervisa y decide en el órgano; no opera el vínculo GRC↔IA (F5.T10).'),
  (gen_random_uuid(), 'COMPLIANCE',   'GRC_AI_LINK', true,  'GRC Compass es owner-write de controles/obligaciones/riesgos y de sus aristas con IA (F5.T10).'),
  (gen_random_uuid(), 'ADMIN_TENANT', 'GRC_AI_LINK', true,  'Declarado por completitud: fn_secretaria_assert_capability ya deja pasar a ADMIN_TENANT sin consultar esta tabla (medido).'),
  (gen_random_uuid(), 'AUDITOR',      'GRC_AI_LINK', false, 'El auditor es de solo lectura sobre GRC/IA: audita, no vincula (F5.T10).')
ON CONFLICT (role, action) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_grc_vincular_ia(
  p_tenant_id uuid,
  p_grc_kind text,
  p_grc_id uuid,
  p_relation text,
  p_ai_system_id uuid DEFAULT NULL,
  p_ai_incident_id uuid DEFAULT NULL,
  p_aims_measure_code text DEFAULT NULL,
  p_policy_clause text DEFAULT NULL,
  p_rationale text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existe boolean;
BEGIN
  PERFORM public.fn_secretaria_assert_capability(p_tenant_id, 'GRC_AI_LINK');

  IF p_grc_kind NOT IN ('CONTROL', 'OBLIGATION', 'RISK', 'FINDING') THEN
    RAISE EXCEPTION 'GRC_AI_LINK_KIND_INVALIDO: %', p_grc_kind USING ERRCODE = '22023';
  END IF;
  IF p_relation NOT IN ('MITIGA', 'CUMPLE', 'RESTRINGE', 'NOTIFICA_SEGUN') THEN
    RAISE EXCEPTION 'GRC_AI_LINK_RELACION_INVALIDA: %', p_relation USING ERRCODE = '22023';
  END IF;
  IF p_ai_system_id IS NULL AND p_ai_incident_id IS NULL THEN
    RAISE EXCEPTION 'GRC_AI_LINK_SIN_OBJETO_IA' USING ERRCODE = '22023';
  END IF;

  CASE p_grc_kind
    WHEN 'CONTROL' THEN
      SELECT EXISTS(SELECT 1 FROM public.controls WHERE id = p_grc_id AND tenant_id = p_tenant_id) INTO v_existe;
    WHEN 'OBLIGATION' THEN
      SELECT EXISTS(SELECT 1 FROM public.obligations WHERE id = p_grc_id AND tenant_id = p_tenant_id) INTO v_existe;
    WHEN 'RISK' THEN
      SELECT EXISTS(SELECT 1 FROM public.risks WHERE id = p_grc_id AND tenant_id = p_tenant_id) INTO v_existe;
    WHEN 'FINDING' THEN
      SELECT EXISTS(SELECT 1 FROM public.findings WHERE id = p_grc_id AND tenant_id = p_tenant_id) INTO v_existe;
  END CASE;
  IF NOT v_existe THEN
    RAISE EXCEPTION 'GRC_AI_LINK_GRC_ID_NO_PERTENECE_AL_TENANT' USING ERRCODE = '42501';
  END IF;

  IF p_ai_system_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ai_systems WHERE id = p_ai_system_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'GRC_AI_LINK_SISTEMA_NO_PERTENECE_AL_TENANT' USING ERRCODE = '42501';
  END IF;
  IF p_ai_incident_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ai_incidents WHERE id = p_ai_incident_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'GRC_AI_LINK_INCIDENTE_NO_PERTENECE_AL_TENANT' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.grc_ai_links (
    tenant_id, grc_kind, grc_id, ai_system_id, ai_incident_id,
    aims_measure_code, policy_clause, relation, rationale, created_by
  ) VALUES (
    p_tenant_id, p_grc_kind, p_grc_id, p_ai_system_id, p_ai_incident_id,
    p_aims_measure_code, p_policy_clause, p_relation, p_rationale, auth.uid()
  )
  ON CONFLICT (tenant_id, grc_kind, grc_id, relation, ai_target)
  DO UPDATE SET aims_measure_code = EXCLUDED.aims_measure_code,
                policy_clause = EXCLUDED.policy_clause,
                rationale = EXCLUDED.rationale
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_grc_vincular_ia(uuid, text, uuid, text, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_grc_vincular_ia(uuid, text, uuid, text, uuid, uuid, text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_grc_vincular_ia IS
  'F5.T10: único camino de escritura de grc_ai_links. Exige capacidad GRC_AI_LINK y comprueba tenant de grc_id/ai_system_id/ai_incident_id.';

DO $verify$
DECLARE
  v_write_grants int;
  v_cap_rows int;
  v_probe_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_probe_grc_id uuid;
  v_probe_system_id uuid;
  v_link_id uuid;
BEGIN
  -- 0 privilegios de escritura para anon/authenticated: la RPC es el único camino.
  SELECT count(*) INTO v_write_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'grc_ai_links'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type <> 'SELECT';
  IF v_write_grants <> 0 THEN
    RAISE EXCEPTION 'F5.T10: % privilegio(s) de escritura de anon/authenticated sobre grc_ai_links (debe ser 0)', v_write_grants;
  END IF;

  SELECT count(*) INTO v_cap_rows FROM public.capability_matrix WHERE action = 'GRC_AI_LINK';
  IF v_cap_rows <> 5 THEN
    RAISE EXCEPTION 'F5.T10: capability_matrix debía tener 5 filas GRC_AI_LINK (una por rol), hay %', v_cap_rows;
  END IF;
  IF EXISTS (SELECT 1 FROM public.capability_matrix WHERE action = 'GRC_AI_LINK' AND role IN ('SECRETARIO', 'CONSEJERO', 'AUDITOR') AND enabled) THEN
    RAISE EXCEPTION 'F5.T10: SECRETARIO/CONSEJERO/AUDITOR no deben tener GRC_AI_LINK habilitado';
  END IF;

  -- Control positivo del propio instrumento (forma de la tabla y de la RPC,
  -- ejecutado como el rol de la migración, no como `authenticated`: el
  -- camino con capacidad real se ensaya aparte, con JWT de una cuenta real,
  -- en el .probe.sql de esta migración). Subtransacción que se deshace.
  SELECT id INTO v_probe_grc_id FROM public.controls WHERE code = 'CTR-GARR-33';
  SELECT id INTO v_probe_system_id FROM public.ai_systems WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND name = 'Harvey – Plataforma de IA generativa legal';
  IF v_probe_grc_id IS NULL OR v_probe_system_id IS NULL THEN
    RAISE EXCEPTION 'F5.T10: no se encontró CTR-GARR-33 o el sistema Harvey para el control positivo';
  END IF;

  BEGIN
    INSERT INTO public.grc_ai_links (tenant_id, grc_kind, grc_id, ai_system_id, relation, rationale)
    VALUES ('00000000-0000-0000-0000-000000000002', 'CONTROL', v_probe_grc_id, v_probe_system_id, 'MITIGA', 'Sonda F5.T10')
    RETURNING id INTO v_link_id;

    IF NOT EXISTS (SELECT 1 FROM public.grc_ai_links WHERE id = v_link_id AND ai_target = v_probe_system_id) THEN
      RAISE EXCEPTION 'F5.T10: ai_target generada no coincide con ai_system_id';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0911', MESSAGE = 'deshacer sonda F5.T10';
  EXCEPTION
    WHEN SQLSTATE 'P0911' THEN NULL; -- control positivo OK, sin residuo en Garrigues
  END;

  IF EXISTS (SELECT 1 FROM public.grc_ai_links WHERE rationale = 'Sonda F5.T10') THEN
    RAISE EXCEPTION 'F5.T10: quedó residuo de la sonda en grc_ai_links';
  END IF;
END;
$verify$;
