#!/usr/bin/env bun
/**
 * Seed G0 — Tenant Garrigues: fila `tenants` + branding + usuarios demo + RBAC.
 * Spec: docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md §4 G0.
 *
 * Uso:
 *   bun run scripts/seed-garrigues-tenant.ts            # dry-run (imprime plan, no escribe)
 *   bun run scripts/seed-garrigues-tenant.ts --commit   # ejecuta
 *
 * - Service-role: usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS). Solo CLI, nunca UI.
 * - Idempotente: re-ejecutar con --commit no duplica nada (upsert/select-then-insert).
 * - Guard de target: aborta si la URL no es governance_OS.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "https://hzqwefkwsxopwrmtksbg.supabase.co";

// La service-role key se busca por varios nombres habituales para tolerar
// distintas convenciones de .env. NUNCA se imprime el valor, solo su ausencia.
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SB_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_SECRET",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";
export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";

const DEMO_PASSWORD = "TGMSdemo2026!";
const USERS = [
  { email: "demo@garrigues-demo.dev", role: "SECRETARIO" },
  { email: "admin@garrigues-demo.dev", role: "ADMIN_TENANT" },
];

// Paleta Garrigues (CLAUDE.md §Design Systems, valores verbatim) mapeada a los
// tokens --t-* del shell + overrides shadcn/sidebar de :root (src/index.css).
// D-5 — lista blanca de módulos del tenant Garrigues (spec G4 §8). "dora",
// "country-packs" y "board-pack" quedan fuera a propósito. ARGA no declara
// `modules`, así que isModuleEnabled() falla abierto y lo ve todo.
const BRANDING = {
  nombre: "Garrigues",
  shell_label: "GARRIGUES GOBERNANZA",
  scope_label: "Grupo Garrigues",
  sii_org_label: "Garrigues",
  modules: [
    "secretaria", "grc", "ai-governance", "sii",
    "politicas", "obligaciones", "delegaciones", "hallazgos", "conflictos",
    "governance-map", "entidades", "organos",
  ],
  tokens: {
    "--t-brand": "#004438",
    "--t-brand-hover": "#007362",
    "--t-brand-bright": "#009a77",
    "--t-surface-subtle": "#d8ece7",
    "--t-sec-primary": "#6dc1b0",
    "--t-surface-page": "#f0f0f0",
    "--t-surface-card": "#ffffff",
    "--t-surface-muted": "hsl(60, 1%, 88%)",
    "--t-text-primary": "#4a4a49",
    "--t-text-secondary": "#50564f",
    "--t-text-inverse": "#ffffff",
    "--t-border-default": "#b7bfb0",
    "--t-border-subtle": "#b9babb",
    "--t-border-focus": "#004438",
    "--t-status-success": "#009a77",
    "--t-status-warning": "#878989",
    "--t-status-error": "hsl(0, 84%, 60%)",
    "--t-status-info": "#596f7b",
    "--t-sidebar-bg": "#004438",
    "--t-sidebar-fg": "#FFFFFF",
    "--t-sidebar-active": "rgba(255,255,255,0.20)",
    "--t-sidebar-hover": "rgba(255,255,255,0.12)",
    "--t-sidebar-label": "rgba(255,255,255,0.55)",
    "--t-sidebar-scope-bg": "rgba(255,255,255,0.12)",
    "--primary": "168 100% 13%",
    "--primary-foreground": "0 0% 100%",
    "--accent": "165 34% 89%",
    "--accent-foreground": "168 100% 13%",
    "--ring": "168 100% 13%",
    "--sidebar-background": "168 100% 13%",
    "--sidebar-foreground": "0 0% 100%",
  },
};

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) {
  fail(`Target inesperado (${SUPABASE_URL}) — este seed solo corre contra governance_OS.`);
}
if (!SERVICE_KEY) {
  fail(
    `Falta la service-role key en el entorno. Se buscó bajo estos nombres:\n` +
      SERVICE_KEY_NAMES.map((n) => `    - ${n}`).join("\n") +
      `\n  Renombra tu variable de .env a SUPABASE_SERVICE_ROLE_KEY (o cualquiera\n` +
      `  de los anteriores), o expórtala antes de ejecutar:\n` +
      `    set -a; source .env; set +a; bun run scripts/seed-garrigues-tenant.ts`,
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers: ${error.message}`);
    // `listUsers` devuelve una UNION de formas y TS colapsa `data.users` a
    // `never[]` al intersecarlas. La lista es de usuarios de Auth; se dice.
    const users = data.users as Array<{ id: string; email?: string }>;
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function main() {
  // 1) Referencia ARGA: el schema manda (tenant_type se copia, no se inventa).
  const { data: arga, error: eArga } = await admin
    .from("tenants").select("*").eq("id", ARGA_TENANT).maybeSingle();
  if (eArga) fail(`Leyendo tenant ARGA: ${eArga.message}`);
  if (!arga) fail("No existe el tenant ARGA de referencia — target equivocado.");

  // 2) Roles RBAC por role_code (verificado en Cloud: rbac_roles usa `role_code`,
  //    no `code`; codes presentes incluyen SECRETARIO y ADMIN_TENANT).
  const roleCodes = USERS.map((u) => u.role);
  const { data: roles, error: eRoles } = await admin
    .from("rbac_roles").select("id, role_code").in("role_code", roleCodes);
  if (eRoles) fail(`Leyendo rbac_roles: ${eRoles.message}`);
  const roleByCode = new Map((roles ?? []).map((r) => [r.role_code, r.id]));
  for (const code of roleCodes) {
    if (!roleByCode.has(code)) fail(`rbac_roles sin code=${code}`);
  }

  // 3) Plan (dry-run visible siempre).
  const { data: existingTenant } = await admin
    .from("tenants").select("id").eq("id", GARRIGUES_TENANT).maybeSingle();
  const plan = [
    {
      accion: existingTenant
        ? "tenants: UPDATE branding (fila ya existe)"
        : "tenants: INSERT fila Garrigues + branding",
    },
  ];
  for (const u of USERS) {
    const existing = await findUserByEmail(u.email);
    plan.push({
      accion: `${u.email}: ${existing ? "reutiliza auth user" : "crea auth user"} + perfil ${u.role} + rbac_user_roles`,
    });
  }
  console.table(plan);
  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar.");
    return;
  }

  // 4) Tenant + branding.
  const { error: eUp } = await admin.from("tenants").upsert(
    {
      id: GARRIGUES_TENANT,
      name: "Garrigues",
      tenant_type: arga.tenant_type,
      country_code: "ES",
      is_active: true,
      branding: BRANDING,
    },
    { onConflict: "id" },
  );
  if (eUp) fail(`Upsert tenant: ${eUp.message}`);
  console.log(`✓ tenants ${GARRIGUES_TENANT} (branding poblado)`);

  // 5) Usuarios + perfiles + roles.
  for (const u of USERS) {
    let userId = await findUserByEmail(u.email);
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) fail(`createUser ${u.email}: ${error.message}`);
      userId = data.user.id;
    }

    const { data: prof, error: eProf } = await admin
      .from("user_profiles").select("id").eq("user_id", userId).maybeSingle();
    if (eProf) fail(`Leyendo user_profiles ${u.email}: ${eProf.message}`);
    if (prof) {
      const { error } = await admin
        .from("user_profiles")
        .update({ tenant_id: GARRIGUES_TENANT, role_code: u.role })
        .eq("user_id", userId);
      if (error) fail(`update user_profiles ${u.email}: ${error.message}`);
    } else {
      const { error } = await admin
        .from("user_profiles")
        .insert({ user_id: userId, tenant_id: GARRIGUES_TENANT, role_code: u.role });
      if (error) fail(`insert user_profiles ${u.email}: ${error.message}`);
    }

    const roleId = roleByCode.get(u.role);
    const { data: link, error: eLink } = await admin
      .from("rbac_user_roles").select("id")
      .eq("user_id", userId).eq("role_id", roleId).eq("tenant_id", GARRIGUES_TENANT)
      .maybeSingle();
    if (eLink) fail(`Leyendo rbac_user_roles ${u.email}: ${eLink.message}`);
    if (!link) {
      const { error } = await admin.from("rbac_user_roles").insert({
        user_id: userId,
        role_id: roleId,
        tenant_id: GARRIGUES_TENANT,
        is_active: true,
      });
      if (error) fail(`insert rbac_user_roles ${u.email}: ${error.message}`);
    }
    console.log(`✓ ${u.email} → ${u.role}`);
  }

  console.log("✓ Seed G0 completado (idempotente: re-ejecutar es seguro).");
}

main();
