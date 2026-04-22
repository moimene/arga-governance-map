-- supabase/migrations/20260421_000021_canonical_model_rbac_and_sod.sql
-- T19.5 — Canonical model RBAC permissions + SoD toxic pair.
--
-- Applied to Cloud via MCP apply_migration (name: t19_5_canonical_model_rbac_and_sod)
-- on 2026-04-21. Mirrored here so the repo history matches Cloud state.
--
-- DEVIATION from plan §T19.5: the plan assumes a `rbac_permissions` +
-- `rbac_role_permissions` schema with permission-level SoD pairs. Cloud
-- uses a single `rbac_roles.permissions` JSONB array of permission strings
-- (e.g. "capital_holdings:*") and role-to-role `sod_toxic_pairs`
-- (role_a, role_b, severity, reason). Translation preserved the plan's
-- intent:
--   (a) Append canonical-model permissions to each role's JSONB array,
--       deduped via jsonb_agg(DISTINCT p ORDER BY p). Idempotent — re-apply
--       is a no-op because duplicates collapse.
--   (b) Encode "snapshot creator cannot vote" as role-pair
--       (SECRETARIO, CONSEJERO) WARN. Coarser than the plan's action-level
--       intent, but the only primitive sod_toxic_pairs exposes. Runtime
--       SodGuard must still enforce per-session separation; this pair
--       surfaces the role co-assignment for awareness, not blocking —
--       Secretarios Consejeros are legally allowed in LSC.
--
-- ADMIN_TENANT already has ["*"] — no row update.
--
-- New permission strings introduced:
--   capital_holdings:*   |  capital_holdings:read
--   condiciones_persona:* |  condiciones_persona:read
--   entity_capital_profile:* |  entity_capital_profile:read
--   share_classes:*      |  share_classes:read
--   representaciones:*   |  representaciones:read
--   censo_snapshot:create (SECRETARIO only)
--   censo_snapshot:read
--   parte_votante_current:read
--   agreement:vote (CONSEJERO only)

-- SECRETARIO: full manage on canonical model + snapshot creation.
UPDATE rbac_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p ORDER BY p)
  FROM jsonb_array_elements_text(
    permissions || jsonb_build_array(
      'capital_holdings:*',
      'condiciones_persona:*',
      'entity_capital_profile:*',
      'share_classes:*',
      'representaciones:*',
      'censo_snapshot:create',
      'censo_snapshot:read',
      'parte_votante_current:read'
    )
  ) AS p
)
WHERE role_code = 'SECRETARIO';

-- CONSEJERO: read canonical model + vote (the permission that conflicts
-- with censo_snapshot:create per the SoD pair below).
UPDATE rbac_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p ORDER BY p)
  FROM jsonb_array_elements_text(
    permissions || jsonb_build_array(
      'capital_holdings:read',
      'condiciones_persona:read',
      'entity_capital_profile:read',
      'share_classes:read',
      'parte_votante_current:read',
      'agreement:vote'
    )
  ) AS p
)
WHERE role_code = 'CONSEJERO';

-- AUDITOR: read-only across the canonical model.
UPDATE rbac_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p ORDER BY p)
  FROM jsonb_array_elements_text(
    permissions || jsonb_build_array(
      'capital_holdings:read',
      'condiciones_persona:read',
      'entity_capital_profile:read',
      'share_classes:read',
      'representaciones:read',
      'censo_snapshot:read',
      'parte_votante_current:read'
    )
  ) AS p
)
WHERE role_code = 'AUDITOR';

-- COMPLIANCE: read canonical model + read snapshots (for oversight).
UPDATE rbac_roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT p ORDER BY p)
  FROM jsonb_array_elements_text(
    permissions || jsonb_build_array(
      'capital_holdings:read',
      'condiciones_persona:read',
      'entity_capital_profile:read',
      'share_classes:read',
      'representaciones:read',
      'censo_snapshot:read',
      'parte_votante_current:read'
    )
  ) AS p
)
WHERE role_code = 'COMPLIANCE';

-- SoD toxic pair: snapshot creator cannot vote in the same session.
-- Role-level proxy for the action-level rule; WARN so it surfaces in
-- SodGuard but doesn't block the legal Secretario Consejero figure.
INSERT INTO sod_toxic_pairs (role_a, role_b, severity, reason)
VALUES (
  'SECRETARIO', 'CONSEJERO', 'WARN',
  'Quien crea el censo de una sesión (SECRETARIO) no debería votar en ella (CONSEJERO). Regla procedimental: si se asignan ambos roles al mismo usuario, SodGuard en runtime debe bloquear la acción contextual por sesión.'
)
ON CONFLICT (role_a, role_b) DO NOTHING;
