# G4 — Sistema normativo interno navegable + PBC/FT (tenant Garrigues) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las 32 políticas internas, el Código Ético, el PPD y el Manual PBC/FT de Garrigues existan en `/politicas` con su comité responsable real y navegable, que las obligaciones de la Ley 10/2010 y los controles del PPD existan como dato en `/obligaciones`, y que los módulos no aplicables a un despacho desaparezcan del menú de ese tenant.

**Architecture:** Una migración forward-only añade `owner_body_id` a `policies`/`obligations`/`controls` más columnas de contenido y referencia legal, todas nullable (ARGA NULL ⇒ cero cambio). Un catálogo JSON versionado en repo — extraído de los PDF reales, no escrito a mano — es la única fuente de verdad del seed. Un helper puro `isModuleEnabled` filtra navegación y rutas por `branding.modules`. Los defectos que hoy pintan datos de ARGA en pantallas de Garrigues se cierran en la misma fase.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui · Supabase JS v2 + TanStack Query v5 · bun · vitest · `pdftotext` (poppler, ya instalado en `/opt/homebrew/bin/pdftotext`).

## Global Constraints

- **Spec de referencia:** `docs/superpowers/specs/2026-08-13-g4-sistema-normativo-garrigues-design.md`. El spec maestro es `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md`.
- **Rama:** `feature/g4-sistema-normativo-garrigues` (ya creada, spec commiteado en `5556899`).
- **Tenants:** Garrigues `00000000-0000-0000-0000-000000000002`, ARGA `00000000-0000-0000-0000-000000000001`. Importar `GARRIGUES_TENANT` desde `scripts/garrigues/entities-catalog`, nunca reescribir el literal.
- **`git add` SOLO de rutas específicas, JAMÁS `-A`.** El árbol compartido tiene strays permanentes: `docs/context/*`, `pkcs11.txt`, `version garrigues/`. Añadirlos rompería el trabajo de otra sesión.
- **Canal Cloud:** `supabase db query -f <fichero> --linked`. **NUNCA** `supabase db query "$(cat fichero.sql)"` — bash expandiría `$assert$` y corrompería el script. `bun run db:check-target` antes de cualquier operación Cloud.
- **Contrato cero-cambio ARGA:** toda columna nueva es nullable; ARGA con NULL debe verse exactamente igual que hoy. Cifras de no-regresión medidas en vivo el 2026-08-13: **ARGA = 25 políticas, 5 obligaciones, 8 controles, 4 evidencias, 52 órganos**.
- **Vocabulario obligado por CHECK** (verificado en vivo): `controls.status` ∈ `Efectivo|Parcial|Inefectivo` · `evidences.status` ∈ `Aprobada|Rechazada|Pendiente` · `obligations.criticality` ∈ `Crítico|Alto|Medio|Bajo` · `policies.normative_tier` ∈ `POLITICA|NORMA|PROCEDIMIENTO|DOCUMENTO` · `policies.scope_level` ∈ `Corporate|Country|Entity` · `policies.status` ∈ `Draft|In Review|Legal Review|Approval Pending|Approved|Published|Superseded|Archived`.
- **Regla de oro del ownership:** `owner_body_id` se siembra SOLO donde la fuente lo dice literalmente. Donde calla → NULL + `owner_function` descriptivo + procedencia etiquetada. **Jamás un comité plausible.**
- **Nunca el nombre real del cliente asegurador** en código, seeds o commits: ARGA es el pseudónimo.
- **Datos personales:** G4 no crea personas. El ownership apunta a órganos.
- Los PDF de `version garrigues/` **no se commitean nunca** (stray untracked, material fuente).

---

### Task 1: Migración de esquema + módulos GRC del tenant

**Files:**
- Create: `supabase/migrations/20260813120000_g4_normative_ownership.sql`
- Create: `src/test/schema/g4-normative-schema.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: columnas `policies.owner_body_id`, `policies.summary`, `policies.content_outline`, `policies.data_provenance`, `obligations.owner_body_id`, `obligations.legal_reference`, `obligations.periodicity`, `controls.owner_body_id`; índice único `ux_policies_tenant_code`; filas `grc_modules` (`aml`, `ethics`, `risk`) para el tenant Garrigues. Las Tasks 3 y 4 escriben en estas columnas.

**Contexto que el implementador necesita:** hoy `policies` solo expresa responsabilidad con `owner_function` (texto libre) y `approval_body_id` (que significa *quién aprueba*, no *quién es responsable*). `obligations` no tiene ninguna columna de ownership y `controls.owner_id` solo apunta a `persons`. Además, el trigger `tg_sync_obligation_to_backbone` inserta en `grc_obligations` con FK a `grc_modules(tenant_id, id)`, y su fallback a `'risk'` **no vuelve a comprobar que ese módulo exista** — con 0 filas para Garrigues, el primer INSERT de obligación muere por FK.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260813120000_g4_normative_ownership.sql
-- G4 Task 1 — Ownership por órgano y contenido del sistema normativo interno.
-- Forward-only. Todas las columnas nullable: ARGA (branding NULL, sin dato en
-- estas columnas) queda exactamente igual que hoy.

BEGIN;

-- 1. Ownership por órgano. Distinto de policies.approval_body_id, que es
--    "quién aprueba"; esto es "qué comité es responsable".
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS owner_body_id uuid REFERENCES public.governing_bodies(id),
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS content_outline jsonb,
  ADD COLUMN IF NOT EXISTS data_provenance jsonb;

ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS owner_body_id uuid REFERENCES public.governing_bodies(id),
  ADD COLUMN IF NOT EXISTS legal_reference text,
  ADD COLUMN IF NOT EXISTS periodicity text;

ALTER TABLE public.controls
  ADD COLUMN IF NOT EXISTS owner_body_id uuid REFERENCES public.governing_bodies(id);

COMMENT ON COLUMN public.policies.owner_body_id IS
  'Órgano responsable del documento normativo. Distinto de approval_body_id (órgano aprobador). NULL = no acreditado en fuente.';
COMMENT ON COLUMN public.policies.summary IS
  'Apartado "Objeto" del documento fuente. NULL = documento citado en fuente pero no incorporado.';
COMMENT ON COLUMN public.policies.content_outline IS
  'Índice de secciones del documento fuente, array JSON de strings.';
COMMENT ON COLUMN public.policies.data_provenance IS
  'Procedencia del dato, mismo patrón que entities.data_provenance (G1). NULL = ARGA, sin badge.';
COMMENT ON COLUMN public.obligations.legal_reference IS
  'Artículo concreto de la norma (p. ej. "art. 7 Ley 10/2010"). source queda como marco.';
COMMENT ON COLUMN public.obligations.periodicity IS
  'Periodicidad de cumplimiento cuando la norma la fija (ANUAL, BIENAL, CONTINUA, PUNTUAL).';

-- 2. Unicidad de policy_code por tenant. No existía NINGUNA: re-ejecutar un
--    seed duplicaba filas en silencio y usePolicyByCode usa .maybeSingle(),
--    que falla con más de una fila. Se asierta primero que no hay duplicados
--    preexistentes en ARGA para que la migración no reviente a ciegas.
DO $assert$
DECLARE
  v_dups int;
BEGIN
  SELECT count(*) INTO v_dups FROM (
    SELECT tenant_id, policy_code FROM public.policies
    GROUP BY tenant_id, policy_code HAVING count(*) > 1
  ) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'G4 Task 1: % pares (tenant_id, policy_code) duplicados preexistentes; resolver antes de crear el índice único', v_dups;
  END IF;
END
$assert$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_policies_tenant_code
  ON public.policies (tenant_id, policy_code);

-- 3. Módulos GRC del tenant Garrigues. Precondición del seed de obligaciones:
--    tg_sync_obligation_to_backbone FKea contra grc_modules(tenant_id, id) y su
--    fallback a 'risk' no re-comprueba existencia. Se siembran las tres claves
--    que la función puede elegir para que cualquier rama encuentre destino.
INSERT INTO public.grc_modules (tenant_id, id, name)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'aml',    'PBC/FT'),
  ('00000000-0000-0000-0000-000000000002', 'ethics', 'Ética y canal interno'),
  ('00000000-0000-0000-0000-000000000002', 'risk',   'Riesgos penales y operacionales')
ON CONFLICT (tenant_id, id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Escribir la sonda de esquema (fallará)**

```ts
// src/test/schema/g4-normative-schema.test.ts
// G4 Task 1 gate: columnas y precondiciones del sistema normativo. Patrón
// graceful-skip de garrigues-rule-packs-seed.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// Fallback con la clave publicable (mismo patrón que
// garrigues-rule-packs-seed.test.ts). Sin él el test se salta SIEMPRE y el
// gate queda verde sin asertar nada.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

// OBLIGATORIO en toda sonda con más de un cliente: el preload de bun test monta
// un JSDOM con localStorage, así que supabase-js usa la MISMA storageKey para
// todos los clientes y el último login pisa a los anteriores. Sin esto, el
// cliente "Garrigues" acaba autenticado como ARGA y la sonda miente en verde.
const PERSIST_OFF = { auth: { persistSession: false } } as const;

describe("G4 Task 1 — esquema de ownership normativo", () => {
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    const { error } = await c.auth.signInWithPassword({
      email: GARRIGUES_DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (!error) { garr = c; authed = true; }
  });

  it("policies expone owner_body_id, summary y content_outline", async () => {
    if (!authed || !garr) return;
    const { error } = await garr
      .from("policies")
      .select("id, owner_body_id, summary, content_outline")
      .limit(1);
    expect(error).toBeNull();
  });

  it("obligations expone owner_body_id, legal_reference y periodicity", async () => {
    if (!authed || !garr) return;
    const { error } = await garr
      .from("obligations")
      .select("id, owner_body_id, legal_reference, periodicity")
      .limit(1);
    expect(error).toBeNull();
  });

  it("controls expone owner_body_id", async () => {
    if (!authed || !garr) return;
    const { error } = await garr.from("controls").select("id, owner_body_id").limit(1);
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 3: Ejecutar la sonda y verificar que falla**

Run: `bun test src/test/schema/g4-normative-schema.test.ts`
Expected: FAIL — PostgREST devuelve error de columna inexistente (`column policies.owner_body_id does not exist`) en los tres tests.

- [ ] **Step 4: Aplicar la migración en Cloud (lo hace el CONTROLLER, no el subagente)**

```bash
bun run db:check-target
supabase db query -f supabase/migrations/20260813120000_g4_normative_ownership.sql --linked
```

Verificar después que `grc_modules` tiene 3 filas nuevas para `…0002` y que `ux_policies_tenant_code` existe.

- [ ] **Step 5: Ejecutar la sonda y verificar que pasa**

Run: `bun test src/test/schema/g4-normative-schema.test.ts`
Expected: PASS 3/3.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260813120000_g4_normative_ownership.sql src/test/schema/g4-normative-schema.test.ts
git commit -m "feat(g4): ownership por órgano en policies/obligations/controls + módulos GRC del tenant"
```

---

### Task 2: Catálogo normativo extraído de los PDF

**Files:**
- Create: `scripts/garrigues/normativo/extract-catalogo.ts`
- Create: `scripts/garrigues/normativo/catalogo-normativo.ts`
- Create: `src/test/schema/garrigues-normativo-catalogo.test.ts`

**Interfaces:**
- Consumes: nada de Task 1 (independiente; puede correr en paralelo).
- Produces: `catalogo-normativo.ts`, que exporta `NORMATIVO_CATALOG: NormativoEntry[]` y el tipo `NormativoEntry`, consumido por la Task 3. **Fichero `.ts`, no JSON**: es el patrón del repo (`scripts/garrigues/entities-catalog.ts` es la única fuente de verdad de G1) y evita depender de la resolución de módulos JSON.

```ts
export type NormativoEntry = {
  policy_code: string;        // "PI-01" | "CE-2023" | "PPD-01" | "PPD-02" | "PBC-FT-10" | "PPD-CAT" | "LGTBI-01"
  title: string;              // sin el prefijo de código
  normative_tier: "POLITICA" | "NORMA" | "PROCEDIMIENTO" | "DOCUMENTO";
  edicion: string | null;     // "Edición 03, marzo 2020" literal, o null
  effective_date: string | null; // "2020-03-01" derivada de edicion, o null
  current_version: number;    // número de edición, 1 si no consta
  summary: string | null;     // apartado "Objeto"
  content_outline: string[];  // índice de secciones
  source_file: string | null; // nombre del PDF, null si no incorporado
  provenance: "PDF_EXTRAIDO" | "CITADO_NO_INCORPORADO";
};
```

**Contexto:** los 32 PI están completos dentro de `version garrigues/Garr_politicas/OneDrive_1_2-8-2026 (1).zip` (la carpeta suelta solo tiene 20). `pdftotext` está instalado. La primera página de cada PI trae `Edición NN, mes AAAA`, un `Índice` numerado y un apartado `1. Objeto`. **Los PDF no se commitean**; solo el JSON resultante.

- [ ] **Step 1: Escribir el test del catálogo (fallará)**

```ts
// src/test/schema/garrigues-normativo-catalogo.test.ts
// G4 Task 2 gate: el catálogo normativo es la única fuente de verdad del
// seed. Test puro sobre el JSON, sin red — patrón entities-catalog de G1.
import { describe, expect, it } from "vitest";
import {
  NORMATIVO_CATALOG as catalogo,
  type NormativoEntry as Entry,
} from "../../../scripts/garrigues/normativo/catalogo-normativo";

describe("G4 Task 2 — catálogo normativo Garrigues", () => {
  it("tiene 38 documentos", () => {
    expect(catalogo).toHaveLength(38);
  });

  it("incluye las 32 PI numeradas PI-01..PI-32 sin huecos", () => {
    const pis = catalogo
      .filter((e: Entry) => e.policy_code.startsWith("PI-"))
      .map((e: Entry) => e.policy_code)
      .sort();
    expect(pis).toHaveLength(32);
    for (let n = 1; n <= 32; n++) {
      expect(pis).toContain(`PI-${String(n).padStart(2, "0")}`);
    }
  });

  it("los códigos son únicos", () => {
    const codes = catalogo.map((e: Entry) => e.policy_code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("incluye los 6 documentos del núcleo", () => {
    const codes = catalogo.map((e: Entry) => e.policy_code);
    for (const c of ["CE-2023", "PPD-01", "PPD-02", "PBC-FT-10", "PPD-CAT", "LGTBI-01"]) {
      expect(codes).toContain(c);
    }
  });

  it("todo normative_tier es un valor admitido por el CHECK", () => {
    const ok = ["POLITICA", "NORMA", "PROCEDIMIENTO", "DOCUMENTO"];
    for (const e of catalogo as Entry[]) expect(ok).toContain(e.normative_tier);
  });

  it("PPD-02 y el Código de Conducta del Socio van etiquetados como no incorporados", () => {
    const ppd02 = (catalogo as Entry[]).find((e) => e.policy_code === "PPD-02");
    expect(ppd02?.provenance).toBe("CITADO_NO_INCORPORADO");
    expect(ppd02?.summary).toBeNull();
  });

  it("todo lo extraído de PDF trae objeto e índice no vacíos", () => {
    const extraidos = (catalogo as Entry[]).filter((e) => e.provenance === "PDF_EXTRAIDO");
    expect(extraidos.length).toBeGreaterThanOrEqual(30);
    for (const e of extraidos) {
      expect(e.summary, `${e.policy_code} sin objeto`).toBeTruthy();
      expect(e.content_outline.length, `${e.policy_code} sin índice`).toBeGreaterThan(0);
    }
  });

  it("effective_date, cuando existe, es ISO y coherente con la edición", () => {
    for (const e of catalogo as Entry[]) {
      if (!e.effective_date) continue;
      expect(e.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.edicion).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun test src/test/schema/garrigues-normativo-catalogo.test.ts`
Expected: FAIL — `Cannot find module '.../catalogo-normativo'`.

- [ ] **Step 3: Escribir el extractor**

```ts
#!/usr/bin/env bun
/**
 * G4 Task 2 — Extractor del catálogo normativo interno de Garrigues.
 *
 * Lee los PDF del sistema normativo (32 PI + núcleo) y produce
 * `catalogo-normativo.ts`, única fuente de verdad del seed de la Task 3.
 * No inventa nada: lo que el PDF no dice queda null y etiquetado.
 *
 * Los PDF viven en `version garrigues/Garr_politicas/`, que es material
 * fuente NO versionado. Las 32 PI están completas solo dentro del zip
 * `OneDrive_1_2-8-2026 (1).zip`; la carpeta suelta tiene 20.
 *
 * Uso: bun run scripts/garrigues/normativo/extract-catalogo.ts [--write]
 * Sin --write imprime un resumen y no toca el JSON.
 */
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = "version garrigues/Garr_politicas";
const ZIP = join(ROOT, "OneDrive_1_2-8-2026 (1).zip");
const WRITE = process.argv.includes("--write");
const OUT = "scripts/garrigues/normativo/catalogo-normativo.ts";

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

function run(cmd: string[]): string {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  return new TextDecoder().decode(p.stdout);
}

/** Texto de las 2 primeras páginas: basta para edición, objeto e índice. */
function pdfHead(path: string): string {
  return run(["pdftotext", "-f", "1", "-l", "2", path, "-"]);
}

/** "Edición 03, marzo 2020" → { edicion, version: 3, date: "2020-03-01" } */
function parseEdicion(text: string) {
  const m = text.match(/Edici[óo]n\s+(\d+)\s*,\s*([a-záéíóú]+)\s+(\d{4})/i);
  if (!m) return { edicion: null, version: 1, date: null };
  const mes = MESES[m[2].toLowerCase()] ?? null;
  return {
    edicion: m[0],
    version: Number(m[1]),
    date: mes ? `${m[3]}-${mes}-01` : null,
  };
}

/** Índice numerado entre "Índice" y el primer apartado desarrollado. */
function parseOutline(text: string): string[] {
  const start = text.search(/\bÍndice\b/i);
  if (start < 0) return [];
  const block = text.slice(start).split(/\n\s*1\.\s*\n/)[0];
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+(\.\d+)*\.?\s+\S/.test(l))
    .map((l) => l.replace(/\s+/g, " "))
    .slice(0, 40);
}

/** Apartado "Objeto": primer párrafo tras el epígrafe. */
function parseObjeto(text: string): string | null {
  const m = text.match(/\n\s*1\.?\s*\n*\s*Objeto\s*\n+([\s\S]{80,1200}?)\n\s*\n/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim() || null;
}

type Entry = {
  policy_code: string; title: string;
  normative_tier: "POLITICA" | "NORMA" | "PROCEDIMIENTO" | "DOCUMENTO";
  edicion: string | null; effective_date: string | null; current_version: number;
  summary: string | null; content_outline: string[];
  source_file: string | null;
  provenance: "PDF_EXTRAIDO" | "CITADO_NO_INCORPORADO";
};

// Núcleo no-PI. `file` null ⇒ citado en fuente, no incorporado.
const NUCLEO: Array<{ code: string; title: string; tier: Entry["normative_tier"]; file: string | null }> = [
  { code: "CE-2023",   title: "Código Ético", tier: "POLITICA", file: "Codigo-Etico-2023-ES.pdf" },
  { code: "PPD-01",    title: "Manual del Sistema de Gestión de Riesgos Penales", tier: "NORMA", file: null },
  { code: "PPD-02",    title: "Modelo Organizativo del Programa de Prevención de Delitos", tier: "NORMA", file: null },
  { code: "PBC-FT-10", title: "Manual de Prevención del Blanqueo de Capitales y de la Financiación del Terrorismo", tier: "NORMA", file: "Manual PBC_FT v.10 noviembre 2025.pdf" },
  { code: "PPD-CAT",   title: "Catálogo ejemplificativo de situaciones susceptibles de generar riesgos penales", tier: "DOCUMENTO", file: null },
  { code: "LGTBI-01",  title: "Medidas para la igualdad de las personas LGTBI y protocolo", tier: "PROCEDIMIENTO", file: "Medidas_para_la_igualdad_de_las_personas_LGTBI_y_protocolo.pdf" },
];

function main() {
  if (!existsSync(ZIP)) {
    console.error(`✗ No encuentro ${ZIP}. Este script necesita el material fuente.`);
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), "garr-pi-"));
  run(["unzip", "-o", "-j", ZIP, "-d", dir]);

  const entries: Entry[] = [];

  for (const f of readdirSync(dir).sort()) {
    const m = f.match(/^PI-(\d{2})[.\s]\s*(.+?)\.pdf$/i);
    if (!m) continue;
    const text = pdfHead(join(dir, f));
    const { edicion, version, date } = parseEdicion(text);
    entries.push({
      policy_code: `PI-${m[1]}`,
      title: m[2].replace(/\s*\.{3,}\s*$/, "").trim(),
      normative_tier: "POLITICA",
      edicion, effective_date: date, current_version: version,
      summary: parseObjeto(text),
      content_outline: parseOutline(text),
      source_file: f,
      provenance: "PDF_EXTRAIDO",
    });
  }

  for (const n of NUCLEO) {
    const path = n.file ? join(ROOT, n.file) : null;
    if (path && existsSync(path)) {
      const text = pdfHead(path);
      const { edicion, version, date } = parseEdicion(text);
      entries.push({
        policy_code: n.code, title: n.title, normative_tier: n.tier,
        edicion, effective_date: date, current_version: version,
        summary: parseObjeto(text), content_outline: parseOutline(text),
        source_file: n.file, provenance: "PDF_EXTRAIDO",
      });
    } else {
      entries.push({
        policy_code: n.code, title: n.title, normative_tier: n.tier,
        edicion: null, effective_date: null, current_version: 1,
        summary: null, content_outline: [], source_file: null,
        provenance: "CITADO_NO_INCORPORADO",
      });
    }
  }

  const sinObjeto = entries.filter((e) => e.provenance === "PDF_EXTRAIDO" && !e.summary);
  const sinIndice = entries.filter((e) => e.provenance === "PDF_EXTRAIDO" && e.content_outline.length === 0);
  console.log(`${entries.length} documentos · ${sinObjeto.length} sin objeto · ${sinIndice.length} sin índice`);
  for (const e of [...sinObjeto, ...sinIndice]) console.log(`  ⚠ ${e.policy_code} (${e.source_file})`);

  if (WRITE) {
    // Se emite un módulo TS (no JSON) para seguir el patrón de
    // entities-catalog.ts y que el consumidor tenga tipos sin depender de
    // la resolución de módulos JSON.
    const header = `// GENERADO por scripts/garrigues/normativo/extract-catalogo.ts — NO EDITAR A MANO.
// Fuente: PDF del sistema normativo interno de Garrigues (material no versionado).
// Regenerar: bun run scripts/garrigues/normativo/extract-catalogo.ts --write

export type NormativoEntry = {
  policy_code: string;
  title: string;
  normative_tier: "POLITICA" | "NORMA" | "PROCEDIMIENTO" | "DOCUMENTO";
  edicion: string | null;
  effective_date: string | null;
  current_version: number;
  summary: string | null;
  content_outline: string[];
  source_file: string | null;
  provenance: "PDF_EXTRAIDO" | "CITADO_NO_INCORPORADO";
};

export const NORMATIVO_CATALOG: NormativoEntry[] = `;
    writeFileSync(OUT, header + JSON.stringify(entries, null, 2) + ";\n");
    console.log(`✓ escrito ${OUT}`);
  } else {
    console.log("(dry-run — usa --write para escribir el catálogo)");
  }
}

main();
```

- [ ] **Step 4: Ejecutar en dry-run y revisar las incidencias**

Run: `bun run scripts/garrigues/normativo/extract-catalogo.ts`
Expected: imprime 38 documentos y la lista de los que no tienen objeto o índice.

**Los PDF no son homogéneos.** Si alguno queda sin objeto o sin índice, ajustar los regex de `parseObjeto`/`parseOutline` mirando su texto real (`pdftotext -f 1 -l 2 "<ruta>" - | head -60`). No rellenar a mano el JSON: **corregir el extractor** hasta que la extracción sea reproducible, porque el JSON es un artefacto derivado. Si un PDF concreto resulta irreducible (p. ej. escaneado sin capa de texto), añadirlo a `NUCLEO` con `file: null` para que quede honestamente etiquetado, y anotarlo en el reporte de la tarea.

- [ ] **Step 5: Escribir el JSON**

Run: `bun run scripts/garrigues/normativo/extract-catalogo.ts --write`

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `bun test src/test/schema/garrigues-normativo-catalogo.test.ts`
Expected: PASS 8/8.

- [ ] **Step 7: Commit**

```bash
git add scripts/garrigues/normativo/extract-catalogo.ts scripts/garrigues/normativo/catalogo-normativo.ts src/test/schema/garrigues-normativo-catalogo.test.ts
git commit -m "feat(g4): catálogo normativo de 38 documentos extraído de los PDF fuente"
```

---

### Task 3: Seed del catálogo normativo con ownership por comité

**Files:**
- Create: `scripts/seed-garrigues-normativo.ts`
- Create: `src/test/schema/garrigues-normativo-seed.test.ts`

**Interfaces:**
- Consumes: `catalogo-normativo.ts` de Task 2; columnas de Task 1.
- Produces: 38 filas en `policies` para `…0002`, con `owner_body_id` resuelto. La Task 4 enlaza obligaciones a `PBC-FT-10` vía `policy_id`.

**Mapa de ownership — literal del spec §6.** Se siembra SOLO lo acreditado:

| `policy_code` | slug de órgano | Fuente |
|---|---|---|
| `PPD-01`, `PPD-02`, `PPD-CAT` | `garrigues-comite-practica-profesional` | Manual PPD §4.1, §7, §8.1 |
| `PBC-FT-10` | `garrigues-caci` | spec maestro §4 G4 |
| `PI-14` | `garrigues-comite-editorial-global` | spec maestro §4 G4 |
| `PI-30` | `garrigues-comite-gobernanza-ia` | spec maestro §4 G4 |
| `CE-2023` | `garrigues-comite-practica-profesional` | página Código Ético |
| resto | **NULL** | fuente no lo acredita |

`PI-31` queda NULL salvo que el propio PDF nombre un órgano responsable — **leerlo antes de decidir** (`pdftotext` sobre `PI-31…pdf`); si nombra uno que existe en Cloud, sembrarlo y anotar la cita en el reporte. Si no, NULL. No suponer que el SII cuelga de Compliance.

- [ ] **Step 1: Escribir la sonda de datos (fallará)**

```ts
// src/test/schema/garrigues-normativo-seed.test.ts
// G4 Task 3 gate de datos: 38 documentos normativos del tenant Garrigues con
// ownership resuelto a órganos REALES, y ARGA intacta. Patrón graceful-skip
// con clientes independientes por tenant (garrigues-rule-packs-seed.test.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// Fallback con la clave publicable (mismo patrón que
// garrigues-rule-packs-seed.test.ts). Sin él el test se salta SIEMPRE y el
// gate queda verde sin asertar nada.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

// OBLIGATORIO en toda sonda con más de un cliente: el preload de bun test monta
// un JSDOM con localStorage, así que supabase-js usa la MISMA storageKey para
// todos los clientes y el último login pisa a los anteriores. Sin esto, el
// cliente "Garrigues" acaba autenticado como ARGA y la sonda miente en verde.
const PERSIST_OFF = { auth: { persistSession: false } } as const;
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

describe("G4 Task 3 — catálogo normativo sembrado (Garrigues) y ARGA intacta", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;
  let argaAuthed = false;
  let seeded = false;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const g = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await g.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD })).error) {
      garr = g; authed = true;
      const { count } = await g.from("policies").select("id", { count: "exact", head: true });
      seeded = (count ?? 0) >= 38;
    }
    const a = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await a.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD })).error) {
      arga = a; argaAuthed = true;
    }
  });

  it("Garrigues ve exactamente 38 documentos normativos", async () => {
    if (!authed || !garr || !seeded) return;
    const { count, error } = await garr.from("policies").select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(38);
  });

  it("las 32 PI están completas", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("policies").select("policy_code").like("policy_code", "PI-%");
    expect(data).toHaveLength(32);
  });

  it("el ownership acreditado apunta a órganos reales del tenant", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies")
      .select("policy_code, owner_body:owner_body_id(slug)")
      .in("policy_code", ["PI-30", "PI-14", "PBC-FT-10", "PPD-01"]);
    const bySlug = Object.fromEntries(
      (data ?? []).map((r: Record<string, unknown>) => [
        r.policy_code as string,
        (r.owner_body as { slug?: string } | null)?.slug ?? null,
      ]),
    );
    expect(bySlug["PI-30"]).toBe("garrigues-comite-gobernanza-ia");
    expect(bySlug["PI-14"]).toBe("garrigues-comite-editorial-global");
    expect(bySlug["PBC-FT-10"]).toBe("garrigues-caci");
    expect(bySlug["PPD-01"]).toBe("garrigues-comite-practica-profesional");
  });

  it("no inventa ownership: hay documentos con owner_body_id NULL", async () => {
    if (!authed || !garr || !seeded) return;
    const { count } = await garr
      .from("policies").select("id", { count: "exact", head: true }).is("owner_body_id", null);
    expect(count).toBeGreaterThan(0);
  });

  it("PPD-02 queda etiquetado sin contenido", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies").select("summary, content_outline").eq("policy_code", "PPD-02").maybeSingle();
    expect(data?.summary).toBeNull();
  });

  it("ARGA sigue con sus 25 políticas y sin ownership por órgano", async () => {
    if (!argaAuthed || !arga) return;
    const { count } = await arga.from("policies").select("id", { count: "exact", head: true });
    expect(count).toBe(25);
    const { count: owned } = await arga
      .from("policies").select("id", { count: "exact", head: true }).not("owner_body_id", "is", null);
    expect(owned).toBe(0);
  });

  it("ARGA no ve ninguna política de Garrigues", async () => {
    if (!argaAuthed || !arga) return;
    const { data } = await arga.from("policies").select("policy_code").like("policy_code", "PI-%");
    expect(data ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun test src/test/schema/garrigues-normativo-seed.test.ts`
Expected: los tests de Garrigues se saltan (`seeded === false`) y **los dos de ARGA pasan** — son la línea base de no-regresión y deben estar en verde desde el minuto uno.

- [ ] **Step 3: Escribir el seed**

Seguir el patrón de `scripts/seed-garrigues-rule-packs.ts`: shebang `#!/usr/bin/env bun`, cabecera explicando qué hace y por qué, resolución de la service-role key por varios nombres de variable, guard de target contra `hzqwefkwsxopwrmtksbg`, **dry-run por defecto y `--commit` para escribir**.

Puntos obligatorios:

```ts
import {
  NORMATIVO_CATALOG,
  type NormativoEntry,
} from "./garrigues/normativo/catalogo-normativo";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";

// Ownership acreditado en fuente. Todo lo demás queda NULL a propósito:
// sembrar un comité plausible sería inventar (spec §6, regla de oro).
const OWNER_BY_CODE: Record<string, string> = {
  "PPD-01": "garrigues-comite-practica-profesional",
  "PPD-02": "garrigues-comite-practica-profesional",
  "PPD-CAT": "garrigues-comite-practica-profesional",
  "CE-2023": "garrigues-comite-practica-profesional",
  "PBC-FT-10": "garrigues-caci",
  "PI-14": "garrigues-comite-editorial-global",
  "PI-30": "garrigues-comite-gobernanza-ia",
};

// owner_function se rellena en paralelo porque tres consultas vivas ya lo
// pintan (PoliticasList "Propietario", PoliticaDetalle, EntidadDetalle).

// Procedencia, mismo patrón que entities.data_provenance de G1. ARGA no
// tiene esta columna poblada => no le sale badge (contrato cero-cambio).
const provenanceFor = (e: NormativoEntry) => ({
  origen: e.provenance,               // PDF_EXTRAIDO | CITADO_NO_INCORPORADO
  fuente: e.source_file ?? "citado en el Sistema Normativo Interno",
  ownership_acreditado: Boolean(OWNER_BY_CODE[e.policy_code]),
});
```

Resolver los slugs a UUID con una consulta previa a `governing_bodies` filtrada por `tenant_id = GARRIGUES_TENANT`, y **abortar si algún slug del mapa no existe** — un slug mal escrito debe romper el seed, no sembrar NULL en silencio. `upsert` con `onConflict: "tenant_id,policy_code"`, que el índice único de la Task 1 hace posible. `status: "Published"`, `scope_level: "Corporate"`, `mandatory: true`.

- [ ] **Step 4: Dry-run, revisar, y sembrar**

```bash
bun run scripts/seed-garrigues-normativo.ts
bun run scripts/seed-garrigues-normativo.ts --commit
```

- [ ] **Step 5: Ejecutar la sonda y verificar que pasa**

Run: `bun test src/test/schema/garrigues-normativo-seed.test.ts`
Expected: PASS 7/7.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-garrigues-normativo.ts src/test/schema/garrigues-normativo-seed.test.ts
git commit -m "feat(g4): siembra 38 documentos normativos de Garrigues con ownership por comité"
```

---

### Task 4: Obligaciones PBC/FT y controles del PPD

**Files:**
- Create: `scripts/garrigues/normativo/obligaciones-pbcft.ts`
- Create: `scripts/seed-garrigues-obligaciones.ts`
- Create: `src/test/schema/garrigues-obligaciones-seed.test.ts`

**Interfaces:**
- Consumes: columnas de Task 1; la fila `PBC-FT-10` de Task 3 (para `policy_id`).
- Produces: ~16 filas en `obligations` y ~15 en `controls` para `…0002`, con `owner_body_id`.

**Trabajo jurídico previo, obligatorio antes de escribir una sola línea de código.** El texto íntegro de la Ley 10/2010 está en `version garrigues/Garr_politicas/OneDrive_1_2-8-2026.zip`, entrada `Documentos de interés/01. Ley 10_2010…pdf`. Extraerlo y **verificar el número de artículo de cada obligación contra ese texto**. No escribir ningún `legal_reference` de memoria: una cita errónea es exactamente el fallo que la audiencia detecta. Materias a cubrir (el artículo lo fija la verificación, no este plan): identificación formal · titular real · propósito e índole de la relación · seguimiento continuo · medidas reforzadas y personas con responsabilidad pública · abstención de ejecución · examen especial · comunicación por indicio · comunicación sistemática · deber de confidencialidad · conservación de documentación · medidas de control interno · representante ante el SEPBLAC · examen externo · formación de empleados.

**La exención del art. 22 se carga como exclusión etiquetada, no como obligación:** la no sujeción de los abogados respecto de la información obtenida al determinar la posición jurídica del cliente o en el ejercicio de su defensa. Verificar también su numeración. Modelarla como una fila de `obligations` con `criticality: "Bajo"`, `periodicity: "PUNTUAL"` y título y descripción que digan explícitamente que es una **exención**, o como nota en el `source` de las demás — el implementador elige, pero **debe aparecer en pantalla**.

**Ownership:** CACI (`garrigues-caci`) para lo PBC/FT nuclear, Departamento de Compliance (`garrigues-departamento-compliance`) para archivo, formación y examen externo, Comité de Prevención de Delitos (`garrigues-comite-prevencion-delitos`) para los controles del PPD.

**Códigos:** prefijo `OBL-PBC-` y `CTR-GARR-`, que no colisionan con los prefijos que el trigger ya mapea (`OBL-GDPR-`, `OBL-DORA-`, `OBL-NIS2-`, `OBL-ISO`, `OBL-LEY2-`, `OBL-EIOPA-`).

**Estado de los controles:** solo `Efectivo`, `Parcial` o `Inefectivo`. `Deficiente` y `No probado` **revientan el INSERT** (CHECK verificado en vivo).

- [ ] **Step 1: Escribir la sonda de datos (fallará)**

```ts
// src/test/schema/garrigues-obligaciones-seed.test.ts
// G4 Task 4 gate: obligaciones PBC/FT y controles del PPD del tenant
// Garrigues, con artículo citado y ownership por comité. ARGA intacta.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// Fallback con la clave publicable (mismo patrón que
// garrigues-rule-packs-seed.test.ts). Sin él el test se salta SIEMPRE y el
// gate queda verde sin asertar nada.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

// OBLIGATORIO en toda sonda con más de un cliente: el preload de bun test monta
// un JSDOM con localStorage, así que supabase-js usa la MISMA storageKey para
// todos los clientes y el último login pisa a los anteriores. Sin esto, el
// cliente "Garrigues" acaba autenticado como ARGA y la sonda miente en verde.
const PERSIST_OFF = { auth: { persistSession: false } } as const;
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

describe("G4 Task 4 — obligaciones PBC/FT y controles del PPD", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false, argaAuthed = false, seeded = false;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const g = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await g.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD })).error) {
      garr = g; authed = true;
      const { count } = await g.from("obligations").select("id", { count: "exact", head: true });
      seeded = (count ?? 0) >= 12;
    }
    const a = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await a.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD })).error) {
      arga = a; argaAuthed = true;
    }
  });

  it("Garrigues tiene al menos 12 obligaciones y todas citan artículo", async () => {
    if (!authed || !garr || !seeded) return;
    const { data, error } = await garr.from("obligations").select("code, legal_reference, owner_body_id");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(12);
    for (const o of data ?? []) {
      expect(o.legal_reference, `${o.code} sin artículo`).toBeTruthy();
      expect(String(o.legal_reference)).toMatch(/Ley 10\/2010/);
    }
  });

  it("toda obligación tiene comité responsable", async () => {
    if (!authed || !garr || !seeded) return;
    const { count } = await garr
      .from("obligations").select("id", { count: "exact", head: true }).is("owner_body_id", null);
    expect(count).toBe(0);
  });

  it("la exención de abogados aparece en el dato", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("obligations").select("code, title, legal_reference");
    const hit = (data ?? []).some(
      (o: Record<string, unknown>) =>
        /exenci|no sujec/i.test(String(o.title)) || /art\.?\s*22/i.test(String(o.legal_reference)),
    );
    expect(hit, "la exención del art. 22 no está representada").toBe(true);
  });

  it("los controles usan solo estados admitidos por el CHECK", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("controls").select("code, status, owner_body_id");
    expect((data ?? []).length).toBeGreaterThanOrEqual(10);
    for (const c of data ?? []) {
      expect(["Efectivo", "Parcial", "Inefectivo"]).toContain(c.status);
      expect(c.owner_body_id, `${c.code} sin comité`).toBeTruthy();
    }
  });

  it("ARGA sigue con 5 obligaciones y 8 controles", async () => {
    if (!argaAuthed || !arga) return;
    const { count: o } = await arga.from("obligations").select("id", { count: "exact", head: true });
    const { count: c } = await arga.from("controls").select("id", { count: "exact", head: true });
    expect(o).toBe(5);
    expect(c).toBe(8);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun test src/test/schema/garrigues-obligaciones-seed.test.ts`
Expected: los de Garrigues se saltan; el de ARGA pasa (línea base 5/8).

- [ ] **Step 3: Extraer y verificar el texto de la Ley 10/2010**

```bash
mkdir -p /tmp/g4-ley && unzip -o -j "version garrigues/Garr_politicas/OneDrive_1_2-8-2026.zip" "Documentos de interés/01*" -d /tmp/g4-ley
pdftotext "/tmp/g4-ley/$(ls /tmp/g4-ley | head -1)" /tmp/g4-ley/ley.txt
grep -n "Artículo" /tmp/g4-ley/ley.txt | head -60
```

Contrastar cada materia con su artículo real antes de escribir el catálogo.

- [ ] **Step 4: Escribir el catálogo de obligaciones y controles**

`scripts/garrigues/normativo/obligaciones-pbcft.ts` exporta dos arrays tipados, `OBLIGACIONES_PBCFT` y `CONTROLES_PPD`, cada entrada con `code`, `title`, `source`, `legal_reference` (verificado), `criticality`, `periodicity`, `owner_slug`, y los controles además con `status`, `obligation_code` y `owner_slug`. Es la única fuente de verdad, igual que `entities-catalog.ts`.

- [ ] **Step 5: Escribir el seed**

`scripts/seed-garrigues-obligaciones.ts`, mismo patrón que Task 3 (dry-run/`--commit`, guard de target, resolución de slugs con abort si falta alguno). Enlazar `obligations.policy_id` a la fila `PBC-FT-10` y `controls.obligation_id` a la obligación que cubren. `country_scope: ["ES"]`.

- [ ] **Step 6: Sembrar y verificar**

```bash
bun run scripts/seed-garrigues-obligaciones.ts
bun run scripts/seed-garrigues-obligaciones.ts --commit
bun test src/test/schema/garrigues-obligaciones-seed.test.ts
```

Expected: PASS 5/5. Si el primer INSERT falla con violación de FK sobre `grc_obligations`, la Task 1 no se aplicó — no sortearlo desactivando el trigger.

- [ ] **Step 7: Commit**

```bash
git add scripts/garrigues/normativo/obligaciones-pbcft.ts scripts/seed-garrigues-obligaciones.ts src/test/schema/garrigues-obligaciones-seed.test.ts
git commit -m "feat(g4): obligaciones PBC/FT Ley 10/2010 y controles del PPD con ownership por comité"
```

---

### Task 5: Mecanismo D-5 — módulos por tenant

**Files:**
- Create: `src/lib/tenant-modules.ts`
- Create: `src/lib/__tests__/tenant-modules.test.ts`
- Modify: `src/context/TenantBrandContext.tsx:37-74`

**Interfaces:**
- Consumes: `TenantBranding` de `@/context/TenantBrandContext`.
- Produces: `isModuleEnabled(branding, key): boolean` y `useTenantBrandingLoading(): boolean`. La Task 6 los consume.

**Contexto crítico:** `useTenantBranding()` devuelve `null` tanto para ARGA como mientras la query está en vuelo. Filtrar navegación con eso falla **abierto**, que es seguro; pero un guard de ruta que redirija con `null` pintaría y rebotaría en cada refresco de Garrigues. Por eso se expone `isLoading` **en un contexto aparte**: cambiar el tipo de `TenantBrandContext` rompería los 11 consumidores de `useTenantBranding()` sin necesidad.

- [ ] **Step 1: Escribir el test (fallará)**

```ts
// src/lib/__tests__/tenant-modules.test.ts
import { describe, expect, it } from "vitest";
import { isModuleEnabled } from "@/lib/tenant-modules";

describe("isModuleEnabled", () => {
  it("branding NULL (ARGA o cargando) habilita todo — falla abierto", () => {
    expect(isModuleEnabled(null, "dora")).toBe(true);
    expect(isModuleEnabled(null, "board-pack")).toBe(true);
    expect(isModuleEnabled(null, "cualquier-cosa")).toBe(true);
  });

  it("branding sin clave modules habilita todo", () => {
    expect(isModuleEnabled({ nombre: "Garrigues" }, "dora")).toBe(true);
  });

  it("modules presente actúa como lista blanca", () => {
    const b = { nombre: "Garrigues", modules: ["secretaria", "grc"] };
    expect(isModuleEnabled(b, "secretaria")).toBe(true);
    expect(isModuleEnabled(b, "dora")).toBe(false);
    expect(isModuleEnabled(b, "country-packs")).toBe(false);
  });

  it("modules vacío deshabilita todo lo gateado", () => {
    expect(isModuleEnabled({ modules: [] }, "dora")).toBe(false);
  });

  it("modules mal formado se ignora y falla abierto", () => {
    expect(isModuleEnabled({ modules: "dora" } as never, "dora")).toBe(true);
    expect(isModuleEnabled({ modules: [1, 2] } as never, "dora")).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun test src/lib/__tests__/tenant-modules.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tenant-modules'`.

- [ ] **Step 3: Escribir el helper**

```ts
// src/lib/tenant-modules.ts
// D-5 — aplicabilidad de módulos por tenant (spec G4 §8).
// branding NULL = ARGA o carga en vuelo → todo visible (falla ABIERTO: el
// contrato cero-cambio de ARGA manda sobre la ocultación). Cuando el tenant
// declara `modules`, la lista actúa como lista blanca.
import type { TenantBranding } from "@/context/TenantBrandContext";

type BrandingWithModules = TenantBranding & { modules?: string[] };

export function isModuleEnabled(
  branding: BrandingWithModules | null,
  moduleKey: string,
): boolean {
  if (!branding) return true;
  const list = branding.modules;
  if (!Array.isArray(list) || !list.every((m) => typeof m === "string")) return true;
  return list.includes(moduleKey);
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `bun test src/lib/__tests__/tenant-modules.test.ts`
Expected: PASS 5/5.

- [ ] **Step 5: Exponer el estado de carga del branding**

En `src/context/TenantBrandContext.tsx`, añadir un segundo contexto sin tocar el existente:

```tsx
const TenantBrandLoadingContext = createContext<boolean>(false);

/** true mientras la query de branding está en vuelo. Necesario para los
 *  guards de ruta: useTenantBranding() devuelve null tanto para ARGA como
 *  durante la carga, y redirigir con esa ambigüedad produce parpadeo. */
export function useTenantBrandingLoading(): boolean {
  return useContext(TenantBrandLoadingContext);
}
```

En `TenantBrandProvider`, cambiar `const { data } = useQuery({...})` por `const { data, isLoading } = useQuery({...})`, calcular `const brandingLoading = !!tenantId && isLoading;` y envolver:

```tsx
return (
  <TenantBrandContext.Provider value={branding}>
    <TenantBrandLoadingContext.Provider value={brandingLoading}>
      {children}
    </TenantBrandLoadingContext.Provider>
  </TenantBrandContext.Provider>
);
```

- [ ] **Step 6: Verificar typecheck y suite**

Run: `bun run typecheck && bun test src/lib/__tests__/tenant-modules.test.ts`
Expected: 0 errores de tipos, PASS 5/5.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tenant-modules.ts src/lib/__tests__/tenant-modules.test.ts src/context/TenantBrandContext.tsx
git commit -m "feat(g4): helper de módulos por tenant y estado de carga del branding"
```

---

### Task 6: Aplicar D-5 a navegación y rutas

**Files:**
- Modify: `src/components/shell/ShellLayout.tsx:37-55,165-190`
- Modify: `src/pages/grc/GrcLayout.tsx:31-40,70`
- Modify: `src/lib/grc/dashboard-readiness.ts:86-102` (o el consumidor `src/pages/grc/Dashboard.tsx:568`)
- Modify: `src/components/secretaria/shell/navigation.ts:36-42,126-137`
- Modify: `src/components/secretaria/shell/useSidebarVisibilityContext.ts:179-204`
- Modify: `src/components/secretaria/shell/SecretariaSidebar.tsx:43-56`
- Modify: `src/App.tsx:256-258,297-298,306-310`
- Modify: `scripts/seed-garrigues-tenant.ts:45-83`

**Interfaces:**
- Consumes: `isModuleEnabled`, `useTenantBrandingLoading` de Task 5.
- Produces: claves de módulo `"dora"`, `"country-packs"`, `"board-pack"` gateadas.

**Claves de módulo y lista blanca de Garrigues.** Añadir a `BRANDING` en `seed-garrigues-tenant.ts`:

```ts
modules: [
  "secretaria", "grc", "ai-governance", "sii",
  "politicas", "obligaciones", "delegaciones", "hallazgos", "conflictos",
  "governance-map", "entidades", "organos",
],
```

Es decir: **`dora`, `country-packs` y `board-pack` quedan fuera**. ARGA no declara `modules`, así que lo ve todo.

**Aviso — no perder el tiempo aquí:** `src/components/shell/sidebar-nav-items.ts`, `src/components/shell/Sidebar.tsx` y `src/components/shell/AppLayout.tsx` **son código muerto**; verificado que nadie fuera de `src/components/shell/` los importa. La navegación viva es `ShellLayout.tsx`.

- [ ] **Step 1: Gatear el sidebar del shell**

`ShellSidebarContent` ya llama a `useTenantBranding()` en la línea 132. Añadir una clave `moduleKey?: string` a `NavItem`, poblarla en `govItems`/`moduleItems`/`siiItem`, y filtrar en el render:

```tsx
{govItems
  .filter((it) => !it.moduleKey || isModuleEnabled(branding, it.moduleKey))
  .map((it) => <NavRow key={it.to} item={it} onNavigate={onNavigate} />)}
```

Aplicar el mismo filtro a `moduleItems` (línea 177) y al `siiItem` (línea 183).

- [ ] **Step 2: Gatear "Packs por País" y la tarjeta DORA**

En `GrcLayout.tsx`, filtrar el item `{ label: "Packs por País", to: "/grc/packs" }` con `isModuleEnabled(branding, "country-packs")`. En el dashboard GRC, filtrar el dominio `dora-ict` con `isModuleEnabled(branding, "dora")` antes del `.map` de `GRC_P0_DOMAINS`.

- [ ] **Step 3: Gatear el Board Pack por el knob ya existente**

`sidebar-visibility.ts` ya soporta `requiresFeatureFlag` (línea 68, evaluado en la 296) y su semántica **ya está cubierta por tests** (`sidebar-visibility.test.ts:360-363`), pero `featureFlags` no lo puebla nadie en producción. Añadir `requiresFeatureFlag: "board-pack"` a los dos items de Board pack de `navigation.ts` (GRUPO en `:36-42`, SOCIEDAD en `:126-137`) y poblar el contexto en `useSidebarVisibilityContext.ts:179-204`:

```ts
featureFlags: {
  "board-pack": isModuleEnabled(branding, "board-pack"),
},
```

**Gotcha obligatorio:** `SecretariaSidebarSkeleton` (`SecretariaSidebar.tsx:43-56`) replica las claves de regla para decidir qué pinta durante la carga. Añadir `requiresFeatureFlag` a `isEntityIndependentItem` o el esqueleto sobre-renderiza y la barra salta al hidratar.

- [ ] **Step 4: Gatear las rutas**

Crear un guard local en `App.tsx` que **espere a que el branding cargue** antes de decidir:

```tsx
function RequireModule({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const branding = useTenantBranding();
  const loading = useTenantBrandingLoading();
  if (loading) return null;                       // no decidir a ciegas
  if (!isModuleEnabled(branding, moduleKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

Envolver con él `/secretaria/board-pack`, `/secretaria/board-pack/:id` y `/secretaria/reuniones/:id/board-pack` (`"board-pack"`), y `/grc/packs`, `/grc/packs/:countryCode` (`"country-packs"`).

- [ ] **Step 5: Sembrar la clave `modules`**

```bash
bun run scripts/seed-garrigues-tenant.ts
bun run scripts/seed-garrigues-tenant.ts --commit
```

- [ ] **Step 6: Verificar gates**

Run: `bun run typecheck && bun run lint && bun test`
Expected: 0 errores de tipos, 0 errores de lint, suite en verde. Prestar atención a `sidebar-visibility.test.ts`: si algún test daba por visible el Board pack sin flags, ahora cambia — **actualizar el test, no relajar la regla**.

- [ ] **Step 7: Commit**

```bash
git add src/components/shell/ShellLayout.tsx src/pages/grc/GrcLayout.tsx src/lib/grc/dashboard-readiness.ts src/pages/grc/Dashboard.tsx src/components/secretaria/shell/navigation.ts src/components/secretaria/shell/useSidebarVisibilityContext.ts src/components/secretaria/shell/SecretariaSidebar.tsx src/App.tsx scripts/seed-garrigues-tenant.ts
git commit -m "feat(g4): D-5 — oculta DORA, packs de país y Board Pack en el perfil despacho"
```

---

### Task 7: Cerrar los defectos P0 de contaminación ARGA

**Files:**
- Modify: `src/pages/PoliticaDetalle.tsx:11,30-38,226-260`
- Modify: `src/pages/ObligacionesList.tsx:55-90,122-175`

**Interfaces:**
- Consumes: `policies.summary` y `content_outline` de Task 1, sembrados en Task 3.
- Produces: nada que consuman tareas posteriores.

**Por qué esto no es refactor oportunista:** hoy la pestaña "Aplicabilidad" itera `entities` importado de `@/data/entities`, un **array estático de entidades de ARGA**. Bajo Garrigues, cada una de las 38 políticas mostraría entidades de ARGA, con un caso especial cableado `arga-turquia` → "EXCEPCIÓN REGULATORIA" → `/hallazgos/HALL-010`. Es lo primero que se ve al abrir una política.

- [ ] **Step 1: Sustituir la pestaña "Aplicabilidad" por dato del tenant**

Eliminar `import { entities } from "@/data/entities";` (línea 11) y leer las entidades del tenant con el hook existente `useEntities` (`src/hooks/useEntities.ts`). Eliminar por completo la rama `isTurkey` y su enlace a `HALL-010`: es dato de ARGA cableado en un componente compartido. Las columnas "Excepción" y "Notas" quedan vacías mientras no haya modelo de excepciones por entidad — es honesto y no inventa.

- [ ] **Step 2: Sustituir la pestaña "Contenido"**

Eliminar la constante `PR008_SECTIONS` (líneas 30-38) y su uso. Renderizar `policy.summary` como objeto y `policy.content_outline` como índice. Cuando ambos sean NULL — caso de `PPD-02` y del Código de Conducta del Socio — mostrar una etiqueta explícita del tipo "Documento citado en el sistema normativo; su texto no se ha incorporado a este entorno", **no** la frase de relleno actual.

Mostrar además la procedencia leyendo `policy.data_provenance`, **gateada por la propia columna**: si es NULL no se pinta nada, que es como ARGA debe seguir viéndose. Antes de escribir un badge nuevo, comprobar si el de G1 (`entities.data_provenance`) ya es reutilizable y, si lo es, extraerlo a un componente compartido en vez de duplicarlo.

- [ ] **Step 3: Derivar del dato las secciones y el filtro de obligaciones**

En `ObligacionesList.tsx`, sustituir los tres grupos cableados (`dora`, `sol`, `others` en las líneas 78-80, y sus encabezados "DORA — Resiliencia Operativa Digital" / "Solvencia II" / "Otros marcos" en 150-173) por una agrupación calculada sobre los `source` presentes en el dato. Sustituir el `<Select>` de marco (líneas 124-133), hoy con `DORA`/`Solv`/`GDPR`/`LGPD` fijos, por las opciones derivadas de esos mismos `source` distintos.

**Las exclusiones no son obligaciones cubiertas.** La Task 4 siembra dos filas que son **exclusiones** (la no sujeción de abogados del art. 22 Ley 10/2010 y la excepción de comunicación sistemática del art. 27.3 RD 304/2014), con el título abriendo por «Exención»/«Excepción». Hoy `ObligacionesList.tsx:67` las pintaría **"CUBIERTA"** en verde por tener control `Efectivo`, y `:83`/`:103` las sumarían al KPI "Total obligaciones". Un abogado leería que el despacho *cumple* una obligación de la que en realidad está *excluido*. Darles tratamiento visual propio y **sacarlas del recuento** de obligaciones.

Al darles tratamiento propio, **sacar la cautela del título**: hoy `OBL-PBC-11` arrastra el token de enum `DEMO_PILOTO` dentro de un título de 176 caracteres que `ObligacionesList.tsx:211` pinta en crudo, sin `truncate`. La frase en castellano («pendiente de confirmación del Comité Legal») ya informa al lector; el token solo filtra internals a una tabla que lee un abogado. Llevarlo a un badge de firmeza y acortar el título en el catálogo. Mostrar además, en la ficha del art. 21, su relación con el carve-out del art. 22 — hoy vive solo en un comentario de código y es justo el emparejamiento que un abogado busca.

**Aviso de postura demo en la superficie.** Los `status` de los controles (`Efectivo`/`Parcial`) son postura de demostración sobre controles reales de la firma, y hoy esa advertencia vive solo en un comentario del catálogo. `Parcial` renderiza "EN REMEDIACIÓN" en ámbar sobre controles nominados del despacho. Subir el aviso a la pantalla, con el patrón de `EvidenceStatusBadge`/`evidence-status-labels` ya usado en Secretaría. Gateado por tenant o por presencia de dato: ARGA no debe ver aviso nuevo.

**Y pintar el artículo desde `legal_reference`.** `source` es el **marco** (`DORA`, `GDPR`, `PBC/FT — Ley 10/2010`) y es lo único que la lista lee hoy; el artículo concreto vive en `legal_reference`, que la Task 4 puebla y que **ninguna superficie lee todavía**. Sin este cambio, el trabajo de verificación jurídica de la Task 4 queda invisible en pantalla. Mostrarlo en la fila de la lista o en la cabecera de `ObligacionDetalle` — donde ya se pintan `source` y `criticality`. Con `legal_reference` NULL (todas las de ARGA) no se pinta nada: cero cambio.

Aprovechar para eliminar el bucket muerto: la línea 64 compara `c.status === "Deficiente"`, valor que el CHECK de `controls.status` **prohíbe**, así que nunca se activa; y el `<SelectItem value="DEFICIENTE">` filtra por un estado inalcanzable. Alinear con los valores reales `Efectivo|Parcial|Inefectivo`.

- [ ] **Step 4: Verificar gates**

Run: `bun run typecheck && bun run lint && bun test`
Expected: verde. `e2e/02-shell.spec.ts` puede acoplarse al prefijo `PR-`; si rompe, se arregla en la Task 8.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PoliticaDetalle.tsx src/pages/ObligacionesList.tsx
git commit -m "fix(g4): saca dato cableado de ARGA de la ficha de política y de la lista de obligaciones"
```

---

### Task 8: Defectos P1/P2 y ampliación del gate de aislamiento

**Files:**
- Modify: `src/hooks/usePoliciesObligations.ts:148-183`
- Modify: `src/hooks/useEntities.ts:217-228`
- Modify: `src/pages/EntidadDetalle.tsx:181-199`
- Modify: `src/pages/ObligacionDetalle.tsx:125-133`
- Modify: `src/components/secretaria/GlobalSearch.tsx:430`
- Modify: `src/test/schema/tenant-isolation.test.ts:25`
- Modify: `e2e/02-shell.spec.ts:34-39`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `DOMAIN_TABLES` ampliado con `policies`, `obligations`, `controls`.

- [ ] **Step 1: Ampliar el gate de aislamiento (fallará si el seed está mal)**

`tenant-isolation.test.ts:25` cubre hoy solo cuatro tablas:

```ts
const DOMAIN_TABLES = ["entities", "document_templates", "rule_packs", "agreements"];
```

Pasar a:

```ts
const DOMAIN_TABLES = [
  "entities", "document_templates", "rule_packs", "agreements",
  "policies", "obligations", "controls",
];
```

**Gotcha de G0, recordatorio:** una escritura cruzada filtrada por RLS devuelve **0 filas sin error**, no `42501`. El test no debe esperar excepción.

- [ ] **Step 2: Ejecutar y verificar**

Run: `bun test src/test/schema/tenant-isolation.test.ts`
Expected: PASS con las 7 tablas en ambas direcciones.

- [ ] **Step 3: Meter `tenantId` en las claves de caché**

`usePoliciesList` (`:150`) y `usePolicyByCode` (`:168`) usan claves `["policies","list"]` y `["policies","byCode",code]` sin tenant, y el fichero **no importa `useTenantContext`**. RLS protege el dato pero no la caché: al cambiar de tenant sin recargar, TanStack sirve las políticas del anterior. Importar `useTenantContext` y añadir `tenantId` a ambas claves. Igual en `useAllPolicies` (`useEntities.ts:217-228`).

- [ ] **Step 4: Filtrar las políticas por entidad en EntidadDetalle**

`EntidadDetalle.tsx:181-199` titula "Políticas aplicables (n)" pero usa `useAllPolicies()`, **sin filtro por entidad**: con 38 filas mostraría las 38 bajo cada entidad. Sin modelo de aplicabilidad política↔entidad, la salida honesta es titular la sección como corporativa del grupo — "Políticas del grupo" — en vez de afirmar una aplicabilidad que el dato no sostiene.

- [ ] **Step 5: Arreglar el enlace roto del buscador**

`GlobalSearch.tsx:430` construye `/politicas/${p.id}` con el **UUID**, pero la ruta resuelve por `policy_code` (`PoliticaDetalle.tsx:58-59` → `usePolicyByCode`). Todo resultado de política cae hoy en "Política no encontrada". Cambiar a `/politicas/${p.policy_code}` y asegurar que la query selecciona `policy_code`.

- [ ] **Step 5a: Copy del tour guiado desfasado**

`src/context/TourContext.tsx:123` (paso `available: true`, ruta `/politicas/PR-008`) dice *«Tab Aplicabilidad: 25 entidades del grupo con ARGA Turquía marcada con excepción vencida ⚠»*. Es falso por partida doble desde la Task 7: el caso cableado de Turquía y su enlace a `HALL-010` se eliminaron, y la pestaña ya no se llama «Aplicabilidad» sino «Entidades del grupo». Es copy visible en el tour de ARGA. Actualizarlo a lo que la pantalla muestra de verdad.

- [ ] **Step 5b: La contradicción de la exclusión no puede sobrevivir a un clic**

La Task 7 sacó las dos exclusiones del recuento de obligaciones y les dio tarjeta propia en la lista. Pero esa tarjeta enlaza a `/obligaciones/OBL-PBC-EX-22` y `/obligaciones/OBL-PBC-11`, y `ObligacionDetalle.tsx:86-107` calcula `coverageLabel` sobre los controles: como ambas tienen un control `Efectivo` (`CTR-GARR-18`, `CTR-GARR-24`), la ficha las pinta **"COMPLETA" en verde**. La lista dice «esto no es una obligación cubierta» y el detalle contiguo dice lo contrario — es exactamente la lectura que la Task 7 quería impedir, movida una pantalla más allá. Detectar la exclusión por el mismo criterio que usa la lista y darle cabecera propia, sin badge de cobertura. Aprovechar para limpiar el título crudo de 169 caracteres que hoy se pinta como H1 con el token `DEMO_PILOTO` dentro.

- [ ] **Step 6: Desacoplar el botón de GRC, el enlace de reuniones y el e2e**

Además del botón, `src/pages/secretaria/ReunionesLista.tsx:211` enlaza a board-pack sin gatear. **Gotcha de método:** ese enlace se construye con template literal (`` `/secretaria/reuniones/${m.id}/board-pack` ``), así que un `grep` de la ruta literal completa **no lo encuentra** — así se escapó en la Task 6. Busca por **sufijo** de ruta (`board-pack`, `/grc/m/dora`, `/grc/packs`), no por la cadena entera. Ninguno de los dos es fuga funcional (las rutas destino ya están gateadas y redirigen), pero son enlaces vivos hacia módulos oficialmente ocultos.


`ObligacionDetalle.tsx:129` navega fijo a `/grc/m/dora/operate/incidents?obligation=…`. Bajo Garrigues, DORA está oculto por D-5: apuntar a `/grc/risk-360` o esconder el botón cuando `isModuleEnabled(branding, "dora")` es falso. En `e2e/02-shell.spec.ts:34-39`, sustituir el acoplamiento al prefijo `PR-` por un selector que valga para ambos tenants.

- [ ] **Step 7: Verificar gates**

Run: `bun run typecheck && bun run lint && bun test`
Expected: verde.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/usePoliciesObligations.ts src/hooks/useEntities.ts src/pages/EntidadDetalle.tsx src/pages/ObligacionDetalle.tsx src/components/secretaria/GlobalSearch.tsx src/test/schema/tenant-isolation.test.ts e2e/02-shell.spec.ts
git commit -m "fix(g4): scoping de caché por tenant, enlace de búsqueda y aislamiento de policies/obligations/controls"
```

---

### Task 9: Verificación viva, documentación y cierre (CONTROLLER)

**Files:**
- Modify: `CLAUDE.md` (bullet G4 en la sección "Tenant Garrigues")
- Modify: `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` (§3.5 incidencia nº10, §4 G4 → ejecutada, D-5 → resuelta en G4, corrección "30 PI" → 32)

Esta tarea la ejecuta el controller, no un subagente: requiere navegador y decisiones de integración.

- [ ] **Step 1: Gates completos sobre árbol limpio**

```bash
bun run db:check-target && bun test && bun run typecheck && bun run lint && bun run build
```

Registrar las cifras exactas. Comparar con la línea base de G3 (3249 pass / 152 skip / 0 fail).

- [ ] **Step 2: Verificación viva — Garrigues**

Login `demo@garrigues-demo.dev` en `/login?tenant=garrigues`. Comprobar y capturar:
1. `/politicas` muestra 38 documentos con sus códigos reales.
2. Abrir `PI-30` → objeto e índice reales → comité responsable **Comité de Gobernanza de la Inteligencia Artificial** → navegar a sus personas.
3. Abrir `PPD-02` → etiqueta de documento no incorporado, sin frase de relleno.
4. La pestaña "Aplicabilidad" muestra entidades **de Garrigues**, y no aparece Turquía ni `HALL-010`.
5. `/obligaciones` agrupa por marcos PBC/FT, sin encabezados de aseguradora, con artículo y comité por obligación; la exención del art. 22 es visible.
6. El sidebar **no** muestra packs de país, tarjeta DORA ni Board Pack; un acceso directo a `/grc/packs` redirige **sin parpadeo**.

- [ ] **Step 3: Verificación viva — ARGA (no regresión)**

Login `demo@arga-seguros.com`. Comprobar: 25 políticas; `/obligaciones` conserva su agrupación DORA/Solvencia II; el menú mantiene DORA, packs y Board Pack; ninguna etiqueta de procedencia nueva; ninguna pantalla cambia respecto de hoy.

- [ ] **Step 4: Actualizar la documentación**

En el spec maestro: registrar la **incidencia de dato nº10** en §3.5 (Manual PPD 2018 atribuye la supervisión a Práctica Profesional; la estructura vigente añade Prevención de Delitos), corregir "30 PI" por **32 PI**, marcar G4 como ejecutada y D-5 como resuelta en G4. En `CLAUDE.md`, un bullet G4 con el mismo nivel de detalle que los de G1/G2/G3, incluyendo los gotchas nuevos: el fallback no-tenant-safe del trigger, la ausencia previa de unicidad en `policy_code` y el desalineamiento CHECK↔UI de `controls.status`.

- [ ] **Step 5: Commit y review adversarial de rama**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md
git commit -m "docs(g4): registra el sistema normativo interno y D-5 — cierre de fase"
```

Después, review adversarial de toda la rama contra el spec, fix único de lo que salga, y **decisión de integración del usuario** (patrón previo: merge `--no-ff` a `main` + push).

---

## Notas de ejecución

- **Orden y paralelismo:** Task 1 y Task 2 son independientes y pueden ir en paralelo. Task 3 necesita 1 y 2. Task 4 necesita 1 y 3. Task 5 es independiente de todo lo anterior. Task 6 necesita 5. Tasks 7 y 8 necesitan 3 para verse con dato real. Task 9 cierra.
- **El controller aplica Cloud**, no los subagentes: migración de Task 1 y `--commit` de los seeds de Tasks 3, 4 y 6.
- **Si un subagente propone desactivar un trigger, ampliar un CHECK o tocar la RLS para que algo pase, es señal de que el diagnóstico está mal.** Ninguna de esas acciones está en el plan.
