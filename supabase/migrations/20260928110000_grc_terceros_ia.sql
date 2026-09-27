-- MOI-175 (F5.T9) — columnas de IA en `grc_third_parties`.
--
-- Abre el hueco de esquema para declarar qué terceros del registro TPRM son
-- proveedores de sistemas o modelos de IA (RIA arts. 3.2/3.4, 25). Los datos
-- (7 terceros: 4 de Garrigues + 3 de ARGA, fijados por la especificación
-- 2026-09-19-aims-cobertura-ria-experto-design.md §8) los siembra
-- `scripts/grc/seed-terceros-ia.ts`, idempotente y aditivo: esta migración
-- NO inserta ni modifica ninguna fila existente.
--
-- Contrato cero-cambio ARGA: las 5 filas TPRM-ARGA-* legacy (DORA, no IA)
-- reciben las columnas nuevas en su valor por defecto (is_ai_supplier=false,
-- ai_roles={}), verificado abajo.

ALTER TABLE public.grc_third_parties
  ADD COLUMN IF NOT EXISTS legal_entity_name text,
  ADD COLUMN IF NOT EXISTS country char(2),
  ADD COLUMN IF NOT EXISTS eu_representative text,
  ADD COLUMN IF NOT EXISTS is_ai_supplier boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_roles text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.grc_third_parties.legal_entity_name IS
  'F5.T9: razón social del tercero cuando difiere de la marca (p.ej. Harvey -> Counsel AI Corporation). NULL si no se documenta.';
COMMENT ON COLUMN public.grc_third_parties.country IS
  'F5.T9: ISO2 del país de establecimiento principal del tercero.';
COMMENT ON COLUMN public.grc_third_parties.eu_representative IS
  'F5.T9: representante en la UE (art. 25 RIA) para un proveedor GPAI fuera de la UE. NULL = no documentado / por declarar.';
COMMENT ON COLUMN public.grc_third_parties.is_ai_supplier IS
  'F5.T9: true si el tercero suministra un sistema o modelo de IA (art. 3.2/3.4 RIA).';
COMMENT ON COLUMN public.grc_third_parties.ai_roles IS
  'F5.T9: roles de IA declarados del tercero (p.ej. PROVEEDOR_MODELO_GPAI). Vacío si no se ha declarado ninguno — no se infiere.';

DO $verify$
DECLARE
  v_cols int;
  v_legacy_afectadas int;
  v_probe_id text := '__PROBE_T9_GRC_TERCEROS__';
BEGIN
  SELECT count(*) INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'grc_third_parties'
     AND column_name IN ('legal_entity_name', 'country', 'eu_representative', 'is_ai_supplier', 'ai_roles');
  IF v_cols <> 5 THEN
    RAISE EXCEPTION 'F5.T9: se esperaban 5 columnas nuevas en grc_third_parties, hay %', v_cols;
  END IF;

  -- G-PERSIST: ninguna fila TPRM-ARGA-* (DORA, sembrada antes de F5.T9)
  -- queda con is_ai_supplier distinto de su default false.
  SELECT count(*) INTO v_legacy_afectadas
    FROM public.grc_third_parties
   WHERE id LIKE 'TPRM-ARGA-%' AND is_ai_supplier IS DISTINCT FROM false;
  IF v_legacy_afectadas <> 0 THEN
    RAISE EXCEPTION 'F5.T9: % fila(s) TPRM-ARGA-%% legacy quedaron con is_ai_supplier != false', v_legacy_afectadas;
  END IF;

  -- Control positivo del propio instrumento, en subtransacción que se
  -- deshace: el tipo/ default deben aceptar y devolver exactamente lo que
  -- el seed va a escribir después.
  BEGIN
    INSERT INTO public.grc_third_parties (
      tenant_id, id, provider, service, criticality, cloud_exposure,
      regulatory_basis, owner, legal_entity_name, country, eu_representative,
      is_ai_supplier, ai_roles
    ) VALUES (
      '00000000-0000-0000-0000-000000000001', v_probe_id, 'Probe', 'Probe', 'Pendiente',
      'Probe', 'Probe', 'Probe', 'Probe Legal, Inc.', 'US', NULL, true, ARRAY['PROVEEDOR_MODELO_GPAI']
    );
    IF NOT EXISTS (
      SELECT 1 FROM public.grc_third_parties
       WHERE id = v_probe_id AND country = 'US' AND is_ai_supplier = true
         AND ai_roles = ARRAY['PROVEEDOR_MODELO_GPAI'] AND legal_entity_name = 'Probe Legal, Inc.'
    ) THEN
      RAISE EXCEPTION 'F5.T9: el control positivo no leyó de vuelta lo que insertó';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0910', MESSAGE = 'deshacer sonda F5.T9';
  EXCEPTION
    WHEN SQLSTATE 'P0910' THEN NULL; -- control positivo OK, sin residuo en ARGA
  END;

  IF EXISTS (SELECT 1 FROM public.grc_third_parties WHERE id = v_probe_id) THEN
    RAISE EXCEPTION 'F5.T9: quedó residuo de la sonda en grc_third_parties';
  END IF;
END;
$verify$;
