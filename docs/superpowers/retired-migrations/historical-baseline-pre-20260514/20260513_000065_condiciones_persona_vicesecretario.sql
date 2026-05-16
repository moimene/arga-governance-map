-- 20260513_000065_condiciones_persona_vicesecretario.sql
-- Spec L17: VICESECRETARIO es cargo societario inscribible (RRM art. 109,
-- LSC art. 529 octies). Ampliación CHECK + coherencia body_id.

BEGIN;

ALTER TABLE condiciones_persona
  DROP CONSTRAINT IF EXISTS chk_condiciones_persona_tipo_condicion;

ALTER TABLE condiciones_persona
  ADD CONSTRAINT chk_condiciones_persona_tipo_condicion
  CHECK (tipo_condicion IN (
    'SOCIO',
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ',
    'CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','VICESECRETARIO',
    'CONSEJERO_COORDINADOR'
  ));

ALTER TABLE condiciones_persona
  DROP CONSTRAINT IF EXISTS chk_condicion_body_coherente;

ALTER TABLE condiciones_persona
  ADD CONSTRAINT chk_condicion_body_coherente CHECK (
    (tipo_condicion IN ('SOCIO','ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ')
      AND body_id IS NULL)
    OR
    (tipo_condicion IN ('CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','VICESECRETARIO','CONSEJERO_COORDINADOR')
      AND body_id IS NOT NULL)
  );

COMMIT;
