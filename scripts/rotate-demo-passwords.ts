#!/usr/bin/env bun
/**
 * Rotación de contraseñas de las cuentas demo en Auth de governance_OS.
 *
 * Uso:
 *   bun run scripts/rotate-demo-passwords.ts            # dry-run: dice qué haría, no escribe
 *   bun run scripts/rotate-demo-passwords.ts --commit   # aplica y verifica con un login real
 *
 * - Lee las contraseñas NUEVAS de `.env`: DEMO_PASSWORD_ARGA (demo@arga-seguros.com)
 *   y DEMO_PASSWORD_GARRIGUES (demo@ y admin@garrigues-demo.dev). Jamás las imprime.
 * - Lista blanca de cuentas: cualquier otro usuario de Auth queda intacto.
 * - Service-role solo en CLI; guard de target (aborta fuera de governance_OS).
 */
import { createClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.PROJECT_URL ??
  "https://hzqwefkwsxopwrmtksbg.supabase.co";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.ANON_PUBLIC ?? process.env.PUBLISHABLE_KEY ?? "";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SERVICE_ROLE_KEY",
  "SERVICE_ROLE_SECRET",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

const CUENTAS = [
  { email: "demo@arga-seguros.com", env: "DEMO_PASSWORD_ARGA" },
  { email: "demo@garrigues-demo.dev", env: "DEMO_PASSWORD_GARRIGUES" },
  { email: "admin@garrigues-demo.dev", env: "DEMO_PASSWORD_GARRIGUES" },
] as const;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`target no es governance_OS: ${SUPABASE_URL}`);
if (!SERVICE_KEY) fail(`falta la service-role key (${SERVICE_KEY_NAMES.join(" | ")})`);
if (!ANON_KEY) fail("falta ANON_PUBLIC / VITE_SUPABASE_ANON_KEY para la verificación");
for (const c of CUENTAS) {
  const p = process.env[c.env];
  if (!p || p.length < 12) fail(`${c.env} ausente o demasiado corta (<12) en .env`);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const { data: listado, error: eList } = await admin.auth.admin.listUsers({ perPage: 200 });
if (eList) fail(`listUsers: ${eList.message}`);
const usuarios = (listado?.users ?? []) as User[];
const porEmail = new Map<string, string>(usuarios.map((u) => [u.email?.toLowerCase() ?? "", u.id]));

console.log(`${COMMIT ? "APLICANDO" : "DRY-RUN"} rotación en ${SUPABASE_URL}`);
for (const c of CUENTAS) {
  const id = porEmail.get(c.email);
  if (!id) {
    console.log(`  - ${c.email}: NO EXISTE en Auth, se omite`);
    continue;
  }
  if (!COMMIT) {
    console.log(`  - ${c.email} (${id}): se rotaría con ${c.env}`);
    continue;
  }
  const { error } = await admin.auth.admin.updateUserById(id, { password: process.env[c.env] });
  if (error) fail(`updateUserById ${c.email}: ${error.message}`);
  console.log(`  ✓ ${c.email}: contraseña rotada`);
}

if (COMMIT) {
  // Verificación real: la nueva contraseña abre sesión con la anon key (como la app).
  let ok = true;
  for (const c of CUENTAS) {
    if (!porEmail.has(c.email)) continue;
    const cli = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, storageKey: `rotate-${c.email}` },
    });
    const { error } = await cli.auth.signInWithPassword({ email: c.email, password: process.env[c.env]! });
    console.log(`  ${error ? "✗" : "✓"} login ${c.email}: ${error ? error.message : "OK"}`);
    if (error) ok = false;
    else await cli.auth.signOut();
  }
  if (!ok) fail("alguna cuenta no abre sesión con la contraseña nueva");
}
const otros = usuarios.filter((u) => !CUENTAS.some((c) => c.email === u.email?.toLowerCase()));
console.log(`Cuentas fuera de la lista blanca (intactas): ${otros.length}`);
