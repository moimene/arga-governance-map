-- MOI-219 — Ensayo transaccional revertido (BEGIN ... ROLLBACK) que ejercita la
-- ramificación nueva de fn_promover_sociedad_operativa
-- (20260925120000_secretaria_promover_sociedad_formas_administracion.sql)
-- cuando una sociedad de forma NO colegiada (Administrador Único) no tiene
-- cargos vigentes suficientes.
--
-- Por qué existe: hoy (26-09-2026) las 67 entidades de governance_OS están
-- OPERATIVA — ninguna está en INCOMPLETA_CARGOS con cargos insuficientes, así
-- que la sonda viva `src/test/schema/secretaria-promover-sociedad-live.test.ts`
-- no puede ejercitar esta rama contra dato real y se salta (ctx.skip) dejando
-- constancia del motivo. Este fichero es el ensayo revertido que exige el
-- issue mientras no exista una entidad real así: fabrica un tenant/persona/
-- entidad EFÍMEROS con UUID exclusivos, invoca la RPC real y comprueba el
-- check_violation — y lo revierte todo con ROLLBACK. No persiste ningún dato,
-- no toca ARGA ni Garrigues, no cambia ninguna pantalla.
--
-- Precondiciones para ejecutarlo:
--   * migración 20260925120000 aplicada (fn_promover_sociedad_operativa con
--     la ramificación por forma_administracion);
--   * ejecutar con un rol que pueda crear filas en tenants/persons/entities
--     (postgres vía MCP execute_sql o psql directo al pooler, igual que el
--     resto de sondas *_probe.sql de este directorio);
--   * ejecutar el fichero COMPLETO. BEGIN + ROLLBACK son parte del contrato:
--     si se corta a medias, hay que revertir a mano.
--
-- Los umbrales jurídicos (Administrador Único = 1, Solidarios/Mancomunados
-- >= 2) NO se cambian aquí: se limita a comprobar que la RPC ya desplegada
-- los aplica. Ratificación de esos umbrales: Comité Legal (pendiente, ver
-- comentario de reapertura del issue).

BEGIN;

-- Sirve para que la RPC nos trate como service_role y no exija sesión de
-- SECRETARIO/ADMIN_TENANT real (fn_secretaria_is_service_role lee esta
-- claim). No concede privilegios adicionales: sigue dentro de la misma
-- transacción que se revierte al final.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);

DO $preconditions$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = 'a1219000-0000-4000-8000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'MOI-219 ensayo: colisión de UUID de tenant fixture' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.entities WHERE id = 'a1219000-0000-4000-8000-000000000003'::uuid) THEN
    RAISE EXCEPTION 'MOI-219 ensayo: colisión de UUID de entidad fixture' USING ERRCODE = 'P0001';
  END IF;
  IF to_regprocedure('public.fn_promover_sociedad_operativa(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MOI-219 ensayo: falta fn_promover_sociedad_operativa — aplicar 20260925120000 antes' USING ERRCODE = 'P0001';
  END IF;
END;
$preconditions$;

-- Fixture mínimo: tenant + persona (self-PJ de la entidad) + entidad
-- ADMINISTRADOR_UNICO en INCOMPLETA_CARGOS, sin ningún condiciones_persona
-- vigente (0 < 1 exigido). Cero filas en condiciones_persona a propósito: es
-- justo el escenario que la ramificación nueva debe rechazar.
INSERT INTO public.tenants (id, name, tenant_type, country_code, is_active)
VALUES ('a1219000-0000-4000-8000-000000000001'::uuid, 'MOI-219 probe tenant', 'entity', 'ZZ', true);

INSERT INTO public.persons (id, tenant_id, full_name, person_type, data_class)
VALUES (
  'a1219000-0000-4000-8000-000000000002'::uuid,
  'a1219000-0000-4000-8000-000000000001'::uuid,
  'MOI-219 Probe Filial Unico, S.L.U.',
  'PJ',
  'TEST'
);

INSERT INTO public.entities (
  id, tenant_id, slug, legal_name, person_id,
  forma_administracion, onboarding_status, data_class
)
VALUES (
  'a1219000-0000-4000-8000-000000000003'::uuid,
  'a1219000-0000-4000-8000-000000000001'::uuid,
  'moi-219-probe-filial-unico',
  'MOI-219 Probe Filial Unico, S.L.U.',
  'a1219000-0000-4000-8000-000000000002'::uuid,
  'ADMINISTRADOR_UNICO',
  'INCOMPLETA_CARGOS',
  'TEST'
);

-- Ejercita la ramificación: debe fallar con check_violation (SQLSTATE 23514),
-- nunca promover.
DO $probe$
DECLARE
  v_result jsonb;
  v_message text;
BEGIN
  BEGIN
    SELECT public.fn_promover_sociedad_operativa(
      'a1219000-0000-4000-8000-000000000001'::uuid,
      'a1219000-0000-4000-8000-000000000003'::uuid
    ) INTO v_result;

    RAISE EXCEPTION 'MOI-219 ensayo: se esperaba check_violation pero la RPC devolvió %', v_result
      USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF position('Administrador Único' IN v_message) = 0 THEN
        RAISE EXCEPTION 'MOI-219 ensayo: check_violation con mensaje inesperado: %', v_message
          USING ERRCODE = 'P0001';
      END IF;
      RAISE NOTICE 'MOI-219 ensayo OK: check_violation esperado — %', v_message;
  END;
END;
$probe$;

-- La entidad fixture debe seguir INCOMPLETA_CARGOS: el check_violation se
-- lanza antes del UPDATE, así que nunca debe haberse promovido.
DO $postcheck$
BEGIN
  IF (
    SELECT onboarding_status FROM public.entities
    WHERE id = 'a1219000-0000-4000-8000-000000000003'::uuid
  ) IS DISTINCT FROM 'INCOMPLETA_CARGOS' THEN
    RAISE EXCEPTION 'MOI-219 ensayo: la entidad fixture se promovió indebidamente' USING ERRCODE = 'P0001';
  END IF;
  RAISE NOTICE 'MOI-219 ensayo OK: la entidad fixture sigue INCOMPLETA_CARGOS (sin escritura indebida)';
END;
$postcheck$;

-- Revierte tenant + persona + entidad fixture. Nada de esto persiste.
ROLLBACK;
