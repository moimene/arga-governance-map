-- T19.5 — Canonical model RBAC permissions + SoD toxic pair.
--
-- DEVIATION from plan: the plan assumes `rbac_permissions` +
-- `rbac_role_permissions` tables + permission-level SoD pairs. Cloud uses
-- a single `rbac_roles.permissions` JSONB array of permission strings
-- (e.g. "capital_holdings:*") and a role-to-role `sod_toxic_pairs`
-- (role_a, role_b, severity, reason). We translate the plan's intent to
-- that schema:
--   (a) Append canonical model permissions to the appropriate roles'
--       JSONB arrays, deduping via jsonb_agg(DISTINCT ...).
--   (b) Encode the "snapshot creator cannot vote" rule as a role-pair
--       (SECRETARIO, CONSEJERO) WARN. This is a coarser proxy — the real
--       rule is action-contextual (same session). Runtime SodGuard should
--       still enforce per-session separation. WARN, not BLOCK, because
--       Secretarios Consejeros are legally allowed in LSC; the nudge is
--       operational.
--
-- ADMIN_TENANT already has `["*"]` (matches all), so no row update.
-- New permission strings introduced:
--   capital_holdings:*    condiciones_persona:*    entity_capital_profile:*
--   share_classes:*       representaciones:*       censo_snapshot:create
--   censo_snapshot:read   parte_votante_current:read   agreement:vote
-- Read-only variants (capital_holdings:read, etc.) for AUDITOR/CONSEJERO/COMPLIANCE.

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
-- Role-level proxy for the action-level rule.
INSERT INTO sod_toxic_pairs (role_a, role_b, severity, reason)
VALUES (
  'SECRETARIO', 'CONSEJERO', 'WARN',
  'Quien crea el censo de una sesión (SECRETARIO) no debería votar en ella (CONSEJERO). Regla procedimental: si se asignan ambos roles al mismo usuario, SodGuard en runtime debe bloquear la acción contextual por sesión.'
)
ON CONFLICT (role_a, role_b) DO NOTHING;
