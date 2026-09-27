#!/usr/bin/env bun
/**
 * Seed F5.T10 (MOI-175) — aristas GRC↔IA (`grc_ai_links`), tenant Garrigues.
 *
 * Fuente de verdad: docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md
 * §7 "Ciberseguridad": «CTR-GARR-33 se enlaza, sin mover su `obligation_id`,
 * a Harvey, Copilot, GA_IA y la OBL-RIA de IA generativa. OBL-GARR-CYBER-02
 * se enlaza a `ai_incidents`.» Y §7 "Políticas": «Las restricciones de PI-30
 * pasan a controles de GRC ... CTR-RIA-PI30-01/02, enlazados por
 * grc_ai_links» — CTR-RIA-PI30-01/02 son de F5.T5 (obligaciones de
 * organización, no ejecutado aquí): este script sólo siembra lo que ya
 * existe hoy (CTR-GARR-33, OBL-GARR-CYBER-02, OBL-RIA-ORG-04) más los
 * sistemas/incidente reales de Garrigues.
 *
 * «La OBL-RIA de IA generativa» es hoy OBL-RIA-ORG-04 (art. 4, la única
 * OBL-RIA-% viva en Garrigues — medido; OBL-RIA-ORG-05 del art. 5 es F5.T5,
 * ejecutado por otro carril): la obligación se enlaza a los mismos 3
 * sistemas con relation=CUMPLE, sin tocar `controls.obligation_id` (que
 * sigue apuntando a su obligación de PBC/FT nativa) — la relación con la
 * OBL-RIA es una fila de `grc_ai_links` aparte, no un cambio de FK.
 *
 * No hay filas de ARGA en este seed: los tres objetos de partida
 * (CTR-GARR-33, OBL-GARR-CYBER-02, el incidente y los tres sistemas) son
 * todos de Garrigues.
 *
 * Escritura: por la RPC gobernada `fn_grc_vincular_ia` (SECURITY DEFINER,
 * exige capacidad GRC_AI_LINK), con sesión real de una cuenta ADMIN_TENANT o
 * COMPLIANCE de Garrigues — nunca INSERT directo ni service_role, porque la
 * RPC es el único camino de escritura declarado por el diseño (F5.T10) y
 * conviene que el actor quede igual que en la aplicación.
 *
 * Requiere la migración 20260928111000_grc_aristas_ia.sql aplicada.
 *
 * Uso: bun run scripts/grc/seed-aristas-ia.ts [--commit]
 * Variable de entorno: DEMO_PASSWORD_GARRIGUES (login real de admin@garrigues-demo.dev).
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "../garrigues/entities-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.ANON_PUBLIC ?? "";
const ADMIN_EMAIL = "admin@garrigues-demo.dev";
const ADMIN_PASSWORD = process.env.DEMO_PASSWORD_GARRIGUES ?? "";

const COMMIT = process.argv.includes("--commit");

type Enlace = {
  grc_kind: "CONTROL" | "OBLIGATION";
  codigo: string; // solo para el log; se resuelve el id por SELECT antes de sembrar
  objetivo: "sistema" | "incidente";
  nombreObjetivo: string; // idem
  relation: "MITIGA" | "CUMPLE" | "RESTRINGE" | "NOTIFICA_SEGUN";
  rationale: string;
};

const ENLACES_A_SEMBRAR: Enlace[] = [
  { grc_kind: "CONTROL", codigo: "CTR-GARR-33", objetivo: "sistema", nombreObjetivo: "Harvey – Plataforma de IA generativa legal", relation: "MITIGA", rationale: "CTR-GARR-33 mitiga el riesgo de ciberseguridad de Harvey (§7 espec. 2026-09-19)." },
  { grc_kind: "CONTROL", codigo: "CTR-GARR-33", objetivo: "sistema", nombreObjetivo: "Copilot", relation: "MITIGA", rationale: "CTR-GARR-33 mitiga el riesgo de ciberseguridad de Copilot (§7 espec. 2026-09-19)." },
  { grc_kind: "CONTROL", codigo: "CTR-GARR-33", objetivo: "sistema", nombreObjetivo: "Garrigues GA_IA", relation: "MITIGA", rationale: "CTR-GARR-33 mitiga el riesgo de ciberseguridad de GA_IA (§7 espec. 2026-09-19)." },
  { grc_kind: "OBLIGATION", codigo: "OBL-RIA-ORG-04", objetivo: "sistema", nombreObjetivo: "Harvey – Plataforma de IA generativa legal", relation: "CUMPLE", rationale: "OBL-RIA-ORG-04 (art. 4, alfabetización IA) cubierta por el uso de Harvey (§7 espec. 2026-09-19)." },
  { grc_kind: "OBLIGATION", codigo: "OBL-RIA-ORG-04", objetivo: "sistema", nombreObjetivo: "Copilot", relation: "CUMPLE", rationale: "OBL-RIA-ORG-04 (art. 4, alfabetización IA) cubierta por el uso de Copilot (§7 espec. 2026-09-19)." },
  { grc_kind: "OBLIGATION", codigo: "OBL-RIA-ORG-04", objetivo: "sistema", nombreObjetivo: "Garrigues GA_IA", relation: "CUMPLE", rationale: "OBL-RIA-ORG-04 (art. 4, alfabetización IA) cubierta por el uso de GA_IA (§7 espec. 2026-09-19)." },
  { grc_kind: "OBLIGATION", codigo: "OBL-GARR-CYBER-02", objetivo: "incidente", nombreObjetivo: "__incidente_garrigues__", relation: "NOTIFICA_SEGUN", rationale: "OBL-GARR-CYBER-02 enlazada al incidente de IA registrado en Garrigues (§7 espec. 2026-09-19)." },
];

async function main() {
  if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) {
    console.error(`✗ Target inesperado (${SUPABASE_URL}).`);
    process.exit(1);
  }
  if (!ANON_KEY) {
    console.error("✗ Falta VITE_SUPABASE_ANON_KEY / ANON_PUBLIC.");
    process.exit(1);
  }
  if (!ADMIN_PASSWORD) {
    console.error("✗ Falta DEMO_PASSWORD_GARRIGUES en .env (rotación 2026-09-05).");
    process.exit(1);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: errLogin } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (errLogin) {
    console.error(`✗ login ${ADMIN_EMAIL}: ${errLogin.message}`);
    process.exit(1);
  }

  // Resolución por SELECT (RLS ya filtra al tenant de la sesión): nunca se
  // fija un id a mano en el catálogo de arriba.
  const [{ data: controles }, { data: obligaciones }, { data: sistemas }, { data: incidentes }] = await Promise.all([
    client.from("controls").select("id, code").eq("tenant_id", GARRIGUES_TENANT).eq("code", "CTR-GARR-33"),
    client.from("obligations").select("id, code").eq("tenant_id", GARRIGUES_TENANT).in("code", ["OBL-RIA-ORG-04", "OBL-GARR-CYBER-02"]),
    client.from("ai_systems").select("id, name").eq("tenant_id", GARRIGUES_TENANT),
    client.from("ai_incidents").select("id").eq("tenant_id", GARRIGUES_TENANT).limit(1),
  ]);

  const controlId = controles?.[0]?.id as string | undefined;
  const obligacionPorCodigo = new Map((obligaciones ?? []).map((o) => [o.code as string, o.id as string]));
  const sistemaPorNombre = new Map((sistemas ?? []).map((s) => [s.name as string, s.id as string]));
  const incidenteId = incidentes?.[0]?.id as string | undefined;

  if (!controlId) { console.error("✗ CTR-GARR-33 no encontrado en Garrigues."); process.exit(1); }
  if (!obligacionPorCodigo.has("OBL-RIA-ORG-04")) { console.error("✗ OBL-RIA-ORG-04 no encontrada en Garrigues (¿aplicó F5.T3?)."); process.exit(1); }
  if (!obligacionPorCodigo.has("OBL-GARR-CYBER-02")) { console.error("✗ OBL-GARR-CYBER-02 no encontrada en Garrigues."); process.exit(1); }
  if (!incidenteId) { console.error("✗ Garrigues no tiene ningún incidente de IA que enlazar."); process.exit(1); }

  console.log(`Aristas GRC↔IA a sembrar en Garrigues: ${ENLACES_A_SEMBRAR.length}.`);
  for (const e of ENLACES_A_SEMBRAR) {
    console.log(`  [${e.grc_kind}] ${e.codigo} --${e.relation}--> ${e.objetivo === "sistema" ? e.nombreObjetivo : "incidente " + incidenteId}`);
  }

  if (!COMMIT) {
    console.log("\nDry-run (sin --commit): no se ha escrito nada.");
    return;
  }

  for (const e of ENLACES_A_SEMBRAR) {
    const grcId = e.grc_kind === "CONTROL" ? controlId : obligacionPorCodigo.get(e.codigo)!;
    const aiSystemId = e.objetivo === "sistema" ? sistemaPorNombre.get(e.nombreObjetivo) : undefined;
    if (e.objetivo === "sistema" && !aiSystemId) {
      console.error(`✗ sistema "${e.nombreObjetivo}" no encontrado en Garrigues.`);
      process.exit(1);
    }
    const { error } = await client.rpc("fn_grc_vincular_ia", {
      p_tenant_id: GARRIGUES_TENANT,
      p_grc_kind: e.grc_kind,
      p_grc_id: grcId,
      p_relation: e.relation,
      p_ai_system_id: aiSystemId ?? null,
      p_ai_incident_id: e.objetivo === "incidente" ? incidenteId : null,
      p_rationale: e.rationale,
    });
    if (error) {
      console.error(`✗ fn_grc_vincular_ia (${e.codigo} -> ${e.nombreObjetivo}): ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${ENLACES_A_SEMBRAR.length} arista(s) GRC↔IA sembradas/actualizadas en Garrigues.`);
}

main();
