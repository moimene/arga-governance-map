// scripts/_lib/session.ts — MOI-170 F2, carril C.
//
// Login real (anon key + signInWithPassword), compartido por los scripts de
// siembra RIA que escriben por RPC o por UPDATE con RLS tenant-scoped, nunca
// con service-role (patrón exigido por la spec §8: "sesión real por RPC,
// nunca service_role"). Contraseñas SOLO de `.env`, nunca impresas.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.ANON_PUBLIC || "";

export const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";
export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";

export interface Cuenta {
  email: string;
  passwordEnv: string;
}

export const ARGA_SECRETARIO: Cuenta = { email: "demo@arga-seguros.com", passwordEnv: "DEMO_PASSWORD_ARGA" };
export const GARRIGUES_SECRETARIO: Cuenta = { email: "demo@garrigues-demo.dev", passwordEnv: "DEMO_PASSWORD_GARRIGUES" };
export const GARRIGUES_ADMIN: Cuenta = { email: "admin@garrigues-demo.dev", passwordEnv: "DEMO_PASSWORD_GARRIGUES" };

export async function iniciarSesion(cuenta: Cuenta): Promise<SupabaseClient> {
  if (!ANON_KEY) {
    throw new Error("falta VITE_SUPABASE_ANON_KEY o ANON_PUBLIC en .env");
  }
  const password = process.env[cuenta.passwordEnv];
  if (!password) {
    throw new Error(`falta ${cuenta.passwordEnv} en .env`);
  }
  const cliente = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email: cuenta.email, password });
  if (error) {
    throw new Error(`login ${cuenta.email} falló (${error.status}): ${error.message}`);
  }
  return cliente;
}
