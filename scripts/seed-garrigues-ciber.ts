#!/usr/bin/env bun
/**
 * scripts/seed-garrigues-ciber.ts
 *
 * G6 — Siembra de obligaciones de Ciberseguridad/SGSI, marco prospectivo NIS2 (EAD Trust)
 * y controles operativos del tenant Garrigues (`00000000-0000-0000-0000-000000000002`).
 *
 * Fuente de verdad: `scripts/garrigues/normativo/obligaciones-ciber.ts`
 * (OBLIGACIONES_CIBER + CONTROLES_CIBER).
 *
 * Uso:
 *   bun run scripts/seed-garrigues-ciber.ts            # dry-run
 *   bun run scripts/seed-garrigues-ciber.ts --apply   # escribe en Cloud
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  OBLIGACIONES_CIBER,
  CONTROLES_CIBER,
  type ObligacionCiber,
  type ControlCiber,
} from "./garrigues/normativo/obligaciones-ciber";

const TENANT = "00000000-0000-0000-0000-000000000002";
const APPLY = process.argv.includes("--apply") || process.argv.includes("--commit");

const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const key = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean);
if (!url || !key) {
  console.error(`Faltan credenciales. Se buscó la service-role en: ${SERVICE_KEY_NAMES.join(", ")}`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// Mapa de slugs a nombres exactos en governing_bodies
const SLUG_TO_BODY_NAME: Record<string, string> = {
  "garrigues-comite-seguridad-privacidad": "Comité de Seguridad y Privacidad",
  "garrigues-ots": "Oficina Técnica de Seguridad (OTS)",
  "garrigues-comite-gobernanza-ia": "Comité de Gobernanza de la Inteligencia Artificial",
  "garrigues-departamento-compliance": "Departamento de Compliance",
  "garrigues-consejo-administracion-ead-trust": "Consejo de Administración de EAD Trust",
};

function deterministicUuid(seed: string): string {
  const hash = createHash("sha256").update(seed).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "4" + hash.substring(13, 16),
    "8" + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join("-");
}

console.log(`=== G6 SEED CIBERSEGURIDAD Y SGSI (${APPLY ? "APLICANDO" : "DRY-RUN"}) ===`);

// 1. Cargar governing_bodies del tenant
const { data: bodies, error: eBodies } = await db
  .from("governing_bodies")
  .select("id, name")
  .eq("tenant_id", TENANT);
if (eBodies || !bodies) {
  console.error("Error al leer governing_bodies:", eBodies?.message);
  process.exit(1);
}
const bodyMap = new Map(bodies.map((b) => [b.name, b.id]));

// 2. Cargar policies del tenant
const { data: policies, error: ePolicies } = await db
  .from("policies")
  .select("id, policy_code, title")
  .eq("tenant_id", TENANT);
if (ePolicies || !policies) {
  console.error("Error al leer policies:", ePolicies?.message);
  process.exit(1);
}
const policyMap = new Map(policies.map((p) => [p.policy_code, p.id]));

// 3. Sembrar obligaciones Ciber / SGSI / NIS2
let oblCreadas = 0, oblActualizadas = 0;
for (const obl of OBLIGACIONES_CIBER) {
  const bodyName = SLUG_TO_BODY_NAME[obl.owner_body_slug];
  const ownerBodyId = bodyMap.get(bodyName);
  if (!ownerBodyId) {
    console.error(`Órgano no encontrado para slug ${obl.owner_body_slug} (${bodyName})`);
    process.exit(1);
  }
  const policyId = policyMap.get(obl.policy_code);
  if (!policyId) {
    console.error(`Política no encontrada para código ${obl.policy_code}`);
    process.exit(1);
  }

  const id = deterministicUuid(`garrigues:obligation:${obl.code}`);
  const payload = {
    id,
    tenant_id: TENANT,
    code: obl.code,
    title: obl.title,
    source: obl.source,
    legal_reference: obl.legal_reference,
    criticality: obl.criticality,
    periodicity: obl.periodicity,
    owner_body_id: ownerBodyId,
    policy_id: policyId,
    country_scope: ["ES"],
  };

  const { data: ya } = await db.from("obligations").select("id").eq("tenant_id", TENANT).eq("code", obl.code).maybeSingle();
  if (!APPLY) {
    if (ya) oblActualizadas++; else oblCreadas++;
    continue;
  }

  const { error } = await db.from("obligations").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error(`Error al sembrar obligación ${obl.code}:`, error.message);
    process.exit(1);
  }
  if (ya) oblActualizadas++; else oblCreadas++;
}

console.log(`Obligaciones Ciber/SGSI: ${oblCreadas} creadas, ${oblActualizadas} actualizadas (${OBLIGACIONES_CIBER.length} total)`);

// 4. Sembrar controles operativos
let ctrCreados = 0, ctrActualizados = 0;
for (const ctr of CONTROLES_CIBER) {
  const bodyName = SLUG_TO_BODY_NAME[ctr.owner_body_slug];
  const ownerBodyId = bodyMap.get(bodyName);
  if (!ownerBodyId) {
    console.error(`Órgano no encontrado para control ${ctr.code} slug ${ctr.owner_body_slug}`);
    process.exit(1);
  }

  // Resolver obligation_id
  const oblId = deterministicUuid(`garrigues:obligation:${ctr.obligation_code}`);
  const id = deterministicUuid(`garrigues:control:${ctr.code}`);

  const payload = {
    id,
    tenant_id: TENANT,
    code: ctr.code,
    name: ctr.name,
    status: ctr.status,
    obligation_id: oblId,
    owner_body_id: ownerBodyId,
  };

  const { data: ya } = await db.from("controls").select("id").eq("tenant_id", TENANT).eq("code", ctr.code).maybeSingle();
  if (!APPLY) {
    ctrActualizados++;
    continue;
  }

  const { error } = await db.from("controls").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error(`Error al sembrar control ${ctr.code}:`, error.message);
    process.exit(1);
  }
  if (ya) ctrActualizados++; else ctrCreados++;
}

console.log(`Controles Ciber Operativos: ${ctrCreados} creados, ${ctrActualizados} actualizados (${CONTROLES_CIBER.length} total)`);

if (!APPLY) console.log("\nModo DRY-RUN. Ejecuta con --apply para persistir en Supabase Cloud.");
