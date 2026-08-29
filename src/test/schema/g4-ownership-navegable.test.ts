// src/test/schema/g4-ownership-navegable.test.ts
// G4 — el ownership del catálogo normativo tiene que ser NAVEGABLE, no
// write-only: policies.owner_body_id y obligations.owner_body_id son FK reales
// a governing_bodies y las pantallas deben leerlas y enlazar a la ficha del
// órgano. El defecto sobrevivió a toda la fase porque el dato se sembraba y
// nadie comprobaba que alguna superficie lo leyera: de ahí las dos capas de
// este gate (dato en Cloud + lectura en la UI).
//
// Contrato ARGA: sus 25 políticas y 5 obligaciones tienen owner_body_id NULL,
// así que allí no aparece enlace alguno y se sigue pintando `owner_function`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, sesionDe } from "../helpers/supabase-test-client";
import { isExclusionTitle, exclusionKind, splitFirmeza } from "@/hooks/usePoliciesObligations";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
// El preload de bun test monta JSDOM con localStorage: sin esto los dos
// clientes comparten storageKey y el último login pisa al anterior.
const PERSIST_OFF = { auth: { persistSession: false } } as const;

// Mismo select que usan los hooks. Si alguien retira el embed, esta constante
// deja de cuadrar con el fichero y el test de contrato de abajo cae.
const POLICY_SELECT = "*, approval_body:approval_body_id(name), owner_body:owner_body_id(name, slug)";
const OBLIGATION_SELECT = "*, policy:policy_id(policy_code, title), owner_body:owner_body_id(name, slug)";

type OwnerEmbed = { name: string | null; slug: string | null } | null;

describe("G4 — ownership navegable del catálogo normativo (Cloud)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;

  beforeAll(async () => {
    // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
  });

  it("el embed doble a governing_bodies resuelve (dos FK a la misma tabla)", async () => {
    if (!garr) return;
    // approval_body_id y owner_body_id apuntan ambos a governing_bodies: sin la
    // desambiguación por nombre de columna, PostgREST devolvería PGRST201.
    const { data, error } = await garr.from("policies").select(POLICY_SELECT).order("policy_code");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("Garrigues: las políticas con comité responsable traen nombre Y slug enlazable", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("policies").select(POLICY_SELECT).not("owner_body_id", "is", null);
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ policy_code: string; owner_body: OwnerEmbed }>;
    // Conjunto EXACTO, no un mínimo: el ownership es la afirmación más delicada de la
    // fase y tiene que fallar en las dos direcciones. Si alguien vuelve a atribuir un
    // documento a un comité que su fuente no hace responsable, este test lo caza.
    // Se bajó de 7 a 3 tras la review adversarial: PPD-01, PPD-02, PPD-CAT y CE-2023
    // se quedan sin comité porque su fuente hace responsable al Senior Partner (cargo,
    // no órgano) y al Comité de Práctica Profesional solo lo AUXILIA (PPD-01 §8.1) o
    // le pide INFORME PREVIO (Código Ético art. 43.1). Mismo criterio que ya se aplicó
    // a PI-31.
    expect(rows.map((r) => r.policy_code).sort()).toEqual(["PBC-FT-10", "PI-14", "PI-26", "PI-30"]);
    for (const r of rows) {
      expect(r.owner_body?.name, `${r.policy_code} sin nombre de comité`).toBeTruthy();
      // El slug es lo que hace navegable el enlace: /organos/:id resuelve por
      // slug (useBodyBySlug), no por UUID.
      expect(r.owner_body?.slug, `${r.policy_code} sin slug: enlace imposible`).toBeTruthy();
    }
  });

  it("Garrigues: las 21 obligaciones traen comité responsable enlazable", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("obligations").select(OBLIGATION_SELECT).order("code");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ code: string; owner_body: OwnerEmbed }>;
    expect(rows.length).toBeGreaterThanOrEqual(21);
    for (const r of rows) {
      expect(r.owner_body?.slug, `${r.code} sin comité responsable enlazable`).toBeTruthy();
    }
  });

  it("el comité responsable lleva de verdad a personas (miembros vigentes)", async () => {
    if (!garr) return;
    const { data: pol } = await garr.from("policies").select(POLICY_SELECT).not("owner_body_id", "is", null).limit(50);
    const slugs = Array.from(
      new Set(((pol ?? []) as Array<{ owner_body: OwnerEmbed }>).map((r) => r.owner_body?.slug).filter(Boolean)),
    ) as string[];
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const { data: body } = await garr.from("governing_bodies").select("id").eq("slug", slug).maybeSingle();
      expect(body?.id, `slug ${slug} no resuelve a ningún órgano`).toBeTruthy();
      const { count } = await garr
        .from("condiciones_persona")
        .select("id", { count: "exact", head: true })
        .eq("body_id", (body as { id: string }).id)
        .eq("estado", "VIGENTE");
      expect(count ?? 0, `${slug} sin miembros: el salto → personas no existe`).toBeGreaterThan(0);
    }
  });

  it("ARGA intacta: cero ownership por comité, se sigue pintando owner_function", async () => {
    if (!arga) return;
    const { data: pol, error } = await arga.from("policies").select(POLICY_SELECT);
    expect(error).toBeNull();
    const polRows = (pol ?? []) as Array<{ owner_body: OwnerEmbed; owner_function: string | null }>;
    expect(polRows.length).toBeGreaterThan(0);
    expect(polRows.every((r) => r.owner_body === null)).toBe(true);
    const { data: obl } = await arga.from("obligations").select(OBLIGATION_SELECT);
    expect(((obl ?? []) as Array<{ owner_body: OwnerEmbed }>).every((r) => r.owner_body === null)).toBe(true);
  });
});

describe("G4 — ownership navegable: contrato de UI", () => {
  const hook = read("src/hooks/usePoliciesObligations.ts");

  it("los hooks piden el comité responsable con nombre y slug", () => {
    expect(hook).toContain("owner_body:owner_body_id(name, slug)");
    expect(hook).toContain("owner_body_slug");
    // 4 consultas: policies list/byCode, obligations list/byCode.
    expect(hook.match(/owner_body:owner_body_id\(name, slug\)/g)?.length).toBe(4);
  });

  it("los hooks con tenant en la queryKey están gateados por tenantId", () => {
    // TenantProvider arranca en null: sin el gate, la clave del primer render
    // es la misma para los dos tenants y un cambio de sesión filtra caché.
    for (const key of ['["policies", "list", tenantId]', '["obligations", "list", tenantId]']) {
      const at = hook.indexOf(key);
      expect(at, `no encuentro la queryKey ${key}`).toBeGreaterThan(-1);
      expect(hook.slice(at, at + 400)).toContain("enabled: !!tenantId");
    }
    expect(hook).toContain("enabled: !!code && !!tenantId");
  });

  // `owner_body_slug` seguido de un guard vivo (?/&&): que el identificador
  // aparezca no basta — podría quedar en una rama muerta. Este patrón es lo
  // que efectivamente decide si se pinta enlace o texto.
  const LIVE_GUARD = /owner_body_slug\s*(\?|&&)/;

  it("las 3 superficies de política enlazan el comité en vez de pintar solo texto libre", () => {
    for (const path of [
      "src/pages/PoliticaDetalle.tsx",
      "src/pages/PoliticasList.tsx",
      "src/pages/EntidadDetalle.tsx",
    ]) {
      const src = read(path);
      expect(src, `${path} no decide el enlace por owner_body_slug`).toMatch(LIVE_GUARD);
      expect(src, `${path} no enlaza a la ficha de órgano`).toContain("/organos/${");
      // Fallback ARGA: sin FK se sigue pintando el texto libre de siempre.
      expect(src, `${path} perdió el fallback owner_function`).toContain("owner_function");
    }
  });

  it("las 2 superficies de obligación muestran el comité responsable enlazado", () => {
    for (const path of ["src/pages/ObligacionesList.tsx", "src/pages/ObligacionDetalle.tsx"]) {
      const src = read(path);
      expect(src, `${path} no decide el enlace por owner_body_slug`).toMatch(LIVE_GUARD);
      expect(src, `${path} no enlaza a la ficha de órgano`).toContain("/organos/${");
    }
  });
});

describe("G4 — criterio de exclusión compartido", () => {
  const EX = "Exención — no sujeción de los abogados respecto de la información obtenida";
  const PEND = "Excepción — la comunicación sistemática no es exigible (criterio DEMO_PILOTO, pendiente de confirmación del Comité Legal)";

  it("detecta exclusiones y su naturaleza", () => {
    expect(isExclusionTitle(EX)).toBe(true);
    expect(isExclusionTitle(PEND)).toBe(true);
    expect(isExclusionTitle("Identificación formal del cliente")).toBe(false);
    expect(exclusionKind(EX)).toBe("Exención");
    expect(exclusionKind(PEND)).toBe("Excepción");
  });

  it("el token interno DEMO_PILOTO no llega al título mostrado", () => {
    const { title, pending } = splitFirmeza(PEND);
    expect(title).not.toContain("DEMO_PILOTO");
    expect(pending).toBe("pendiente de confirmación del Comité Legal");
    expect(splitFirmeza(EX)).toEqual({ title: EX, pending: null });
  });

  it("las 3 pantallas que listan obligaciones usan el criterio compartido, no una copia", () => {
    for (const path of [
      "src/pages/ObligacionesList.tsx",
      "src/pages/ObligacionDetalle.tsx",
      "src/pages/PoliticaDetalle.tsx",
    ]) {
      const src = read(path);
      expect(src, `${path} no aplica el criterio de exclusión`).toContain("isExclusionTitle");
      expect(src, `${path} pinta el título sin extraer DEMO_PILOTO`).toContain("splitFirmeza");
      expect(src, `${path} duplica la regex en vez de compartirla`).not.toContain("DEMO_PILOTO,");
    }
  });
});
