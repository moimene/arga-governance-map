-- ITEM-081 (fase 1) — Normalización de taxonomía de claves: agreements huérfanos
-- y pack estatutario duplicado.
--
-- Estado previo (auditoría): 5 agreements demo con agreement_kind sin pack ni
-- plantilla (clave no canónica), y dos packs activos para la misma materia
-- jurídica de modificación de estatutos (MOD_ESTATUTOS alias vs MODIFICACION_
-- ESTATUTOS canónico 1.0.1 ACTIVE).
--
-- Al re-apuntar el agreement_kind, el trigger fn_agreements_majority_check valida
-- que required_majority_code no quede por debajo del mínimo LSC de la NUEVA materia
-- (fn_validar_no_rebaja_ley). Por eso cada re-apunte alinea también
-- required_majority_code al código canónico del catálogo (mismo umbral, código
-- canónico) cuando el agreement tenía un valor distinto; los que ya tienen NULL se
-- dejan (el trigger los exime).
--
-- Diferido (fase 2, documentado en backlog): dedup de materia_catalog
-- (MOD_ESTATUTOS / NOMBRAMIENTO_CESE) con re-binding de plantillas, canonización de
-- organo_tipo (solapa con ITEM-133) y anomalías de versionado.
--
-- Forward-only, idempotente.

-- APROBACION_PRESUPUESTOS (plural, no canónica) → APROBACION_PRESUPUESTO.
-- required_majority_code ya es SIMPLE = mínimo canónico; se deja.
UPDATE public.agreements SET agreement_kind = 'APROBACION_PRESUPUESTO'
 WHERE agreement_kind = 'APROBACION_PRESUPUESTOS';

-- MOD_ESTATUTOS (alias) → MODIFICACION_ESTATUTOS. El mínimo canónico es
-- REFORZADA_2_3 (mismo 2/3 que MAYORIA_DOS_TERCIOS, código canónico).
UPDATE public.agreements
   SET agreement_kind = 'MODIFICACION_ESTATUTOS',
       required_majority_code = 'REFORZADA_2_3'
 WHERE agreement_kind = 'MOD_ESTATUTOS';

-- NOMBRAMIENTO_CESE (clave combinada deprecada) → NOMBRAMIENTO_CONSEJERO.
-- Mínimo canónico SIMPLE.
UPDATE public.agreements
   SET agreement_kind = 'NOMBRAMIENTO_CONSEJERO',
       required_majority_code = 'SIMPLE'
 WHERE agreement_kind = 'NOMBRAMIENTO_CESE';

-- NOMBRAMIENTO_ADMINISTRADOR / NOMBRAMIENTO_DIRECTOR (no existen en materia_catalog)
-- → NOMBRAMIENTO_CONSEJERO. Tienen required_majority_code NULL (el trigger los exime).
UPDATE public.agreements SET agreement_kind = 'NOMBRAMIENTO_CONSEJERO'
 WHERE agreement_kind IN ('NOMBRAMIENTO_ADMINISTRADOR', 'NOMBRAMIENTO_DIRECTOR');

-- Retirar la versión del pack alias MOD_ESTATUTOS (queda MODIFICACION_ESTATUTOS
-- 1.0.1 como único activo para la materia).
UPDATE public.rule_pack_versions
   SET status = 'RETIRED', is_active = false
 WHERE pack_id = 'MOD_ESTATUTOS' AND is_active = true;

-- Self-verify.
DO $$
DECLARE v_orphan integer; v_alias integer;
BEGIN
  SELECT count(*) INTO v_orphan FROM public.agreements
   WHERE agreement_kind IN ('APROBACION_PRESUPUESTOS','MOD_ESTATUTOS','NOMBRAMIENTO_ADMINISTRADOR','NOMBRAMIENTO_DIRECTOR','NOMBRAMIENTO_CESE');
  SELECT count(*) INTO v_alias FROM public.rule_pack_versions
   WHERE pack_id = 'MOD_ESTATUTOS' AND is_active = true;
  IF v_orphan <> 0 OR v_alias <> 0 THEN
    RAISE EXCEPTION 'ITEM-081 verificación fallida: orphan=%, alias_activo=%', v_orphan, v_alias;
  END IF;
END $$;
