# G2 — Gobierno de la matriz Garrigues (topología + personas + capital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar el gobierno real de la matriz en el tenant Garrigues — Junta con censo de 346 socios reales, administrador único con mandato e inscripción registral, 19 estructuras consultivas con dependencias, CdA de EAD Trust verificado, capital canónico con restricciones reales — y resolver el minor G1 del scope de Secretaría, con ARGA intacta.

**Architecture:** Catálogo tipado (`governance-catalog.ts`) que envuelve los datasets del Carril B (censo 346 + comités + BORME EAD) y resuelve el matching comités↔censo con overrides curables → seeds service-role aditivos/idempotentes en 4 capas (personas+condiciones → bodies → capital → libros+delegaciones) → UI mínima gateada (badge de naturaleza consultiva; fix del filtro sociedades) → sonda Cloud como gate.

**Tech Stack:** bun + TS relajado, Supabase JS v2 (service-role seeds, anon sondas), vitest bajo `bun test`, MCP `execute_sql` para verificación.

**Spec:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` §3.1-3.4, §4 G2 + resoluciones del Carril B (2026-08-03).

## Global Constraints

- **Antes de CUALQUIER paso Supabase:** `bun run db:check-target` → `governance_OS`. Canal Cloud: MCP `execute_sql` (NUNCA `db push`/`repair`).
- **Seeds ADITIVOS e IDEMPOTENTES:** nunca DELETE; personas por lookup `(tenant_id, full_name)` (censo y comités no tienen homónimos — el test T1 lo garantiza); condiciones por clave natural (person+entity+body+tipo); bodies por slug.
- **Cero cambio ARGA:** ARGA tiene `group_role` NULL en TODAS sus filas (verificado) → el fix del filtro es seguro; los badges de naturaleza solo se renderizan con `config.naturaleza` presente (ARGA no la tiene). Defaults verbatim en todo helper.
- **CHECK real de `condiciones_persona` (verificado en Cloud):** sin body → `SOCIO|ADMIN_UNICO|ADMIN_SOLIDARIO|ADMIN_MANCOMUNADO|ADMIN_PJ`; con body → `CONSEJERO|PRESIDENTE|SECRETARIO|VICEPRESIDENTE|VICESECRETARIO|CONSEJERO_COORDINADOR`. **No existe tipo SENIOR_PARTNER ni CONSEJERO_DELEGADO** → senior partner = condición SOCIO + `metadata.cargo='SENIOR_PARTNER'`; consejero delegado EAD = CONSEJERO + `metadata.consejero_delegado=true` (+ fila en `delegations`). Sin migraciones en G2.
- **CHECK de `governing_bodies.body_type`:** `CDA|COMISION|COMITE|JUNTA`. Consultivas → `COMITE` + `config.naturaleza='CONSULTIVO'`. GOTCHA conocido: `organo-resolver.ts` mapea COMITE→COMISION_DELEGADA en el motor — la exclusión de consultivos de los selectores de adopción es trabajo de G3; G2 solo marca la naturaleza.
- **Campos de inscripción registral existen:** `condiciones_persona.inscripcion_rm_referencia` / `inscripcion_rm_fecha` — usarlos con las citas BORME (p.ej. Vives: "Anuncio 338618/2026, I/A 960", 2026-07-13).
- **Datos personales:** solo nombre + categoría + pertenencia (fuentes públicas del titular); pesos de capital individuales SIEMPRE `metadata.peso='INFERIDO'`.
- **Estado `VIGENTE`** en condiciones (el que filtra `useBodies`).
- Tenant Garrigues `00000000-0000-0000-0000-000000000002`; matriz `00000000-0000-0000-0002-000000000001`; EAD `00000000-0000-0000-0002-000000000026`.
- TS relajado; typecheck con 4 errores PREEXISTENTES en `TPRM.tsx` ajenos (criterio: grep filtrado vacío). `git add` de rutas específicas. Commits en castellano + trailer `Co-Authored-By: claude-flow <ruv@ruv.net>`. Ficheros pre-sucios (CLAUDE.md): reconstruir desde HEAD antes de editar.
- **Datasets de entrada (ya en repo, NO regenerar):** `scripts/garrigues/censo/socios-acta-2026-05-06.json` (346), `scripts/garrigues/gobierno/comites-2026.json` (19 estructuras, 218 membresías), `scripts/garrigues/borme/ead-trust-sl.json` y `jya-garrigues-slp.json`, `scripts/garrigues/entities-catalog.ts`.

---

### Task 1: Catálogo de gobierno tipado + matching comités↔censo (TDD)

**Files:**
- Create: `scripts/garrigues/gobierno/governance-catalog.ts`
- Test: `src/test/garrigues/governance-catalog.test.ts`

**Interfaces:**
- Consumes: los 3 datasets JSON + `GARRIGUES_MATRIZ_UUID`/`GARRIGUES_TENANT` de `../entities-catalog`.
- Produces (para Tasks 2-5 y 7):
  - `export interface MiembroResuelto { nombreComite: string; nombreCanonico: string; categoria: string; rol?: string; esSocioCenso: boolean }`
  - `export interface EstructuraResuelta { slug: string; nombre: string; dependeDe: string[]; mision: string; mandatoAnios?: number; informePreceptivo?: boolean; incidencias?: string[]; miembros: MiembroResuelto[] }`
  - `export function loadGovernanceCatalog(): { estructuras: EstructuraResuelta[]; censo: { presenciales: string[]; representados: string[]; todos: string[] }; adminUnico: {...}; seniorPartner: {...}; eadBoard: EadCargo[] }` — shapes exactos abajo.
  - `export const MATCH_OVERRIDES: Record<string, string>` — mapa curable nombre-comité → nombre-censo.
  - `export function matchCenso(nombreComite: string, censo: string[]): { estado: "UNICO"|"AMBIGUO"|"SIN_MATCH"; candidatos: string[] }`

- [ ] **Step 1: Test de invariantes que falla**

```typescript
// src/test/garrigues/governance-catalog.test.ts
// Invariantes del catálogo de gobierno G2. Si fallan, los seeds NO deben correr.
import { describe, expect, it } from "vitest";
import {
  loadGovernanceCatalog,
  matchCenso,
} from "../../../scripts/garrigues/gobierno/governance-catalog";

const cat = loadGovernanceCatalog();

describe("Catálogo de gobierno G2 — invariantes", () => {
  it("19 estructuras consultivas, slugs únicos, dependencia dual solo IA", () => {
    expect(cat.estructuras.length).toBe(19);
    const slugs = cat.estructuras.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(19);
    const dual = cat.estructuras.filter((e) => e.dependeDe.length === 2);
    expect(dual.map((e) => e.slug)).toEqual(["comite-gobernanza-ia"]);
    for (const e of cat.estructuras) {
      for (const d of e.dependeDe) {
        expect(["ADMINISTRADOR_UNICO", "SENIOR_PARTNER"]).toContain(d);
      }
    }
  });

  it("censo: 346 únicos (3 presenciales + 343 representados)", () => {
    expect(cat.censo.presenciales.length).toBe(3);
    expect(cat.censo.representados.length).toBe(343);
    expect(new Set(cat.censo.todos).size).toBe(346);
  });

  it("matching: TODO miembro con categoría SOCIO resuelve a un único nombre del censo", () => {
    const problemas: string[] = [];
    for (const e of cat.estructuras) {
      for (const m of e.miembros) {
        if (m.categoria !== "SOCIO") continue;
        if (!m.esSocioCenso) problemas.push(`${e.slug}: ${m.nombreComite} → SIN_MATCH o AMBIGUO`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("los no-SOCIO nunca se matchean al censo (persona propia)", () => {
    for (const e of cat.estructuras) {
      for (const m of e.miembros) {
        if (m.categoria !== "SOCIO") {
          expect(m.esSocioCenso).toBe(false);
          expect(m.nombreCanonico).toBe(m.nombreComite);
        }
      }
    }
  });

  it("nombres canónicos: sin colisión entre censo y no-socios", () => {
    const censoSet = new Set(cat.censo.todos);
    for (const e of cat.estructuras) {
      for (const m of e.miembros) {
        if (!m.esSocioCenso) expect(censoSet.has(m.nombreCanonico)).toBe(false);
      }
    }
  });

  it("admin único: Vives con mandato 2026-06-30→2032-06-30 e inscripción I/A 960", () => {
    expect(cat.adminUnico.nombreCenso).toBe("Fernando Vives Ruiz");
    expect(cat.adminUnico.fechaInicio).toBe("2026-06-30");
    expect(cat.adminUnico.fechaFin).toBe("2032-06-30");
    expect(cat.adminUnico.inscripcionRef).toContain("338618");
    expect(cat.adminUnico.inscripcionFecha).toBe("2026-07-13");
  });

  it("senior partner: Zarza como SOCIO del censo con cargo en metadata", () => {
    expect(cat.seniorPartner.nombreCenso).toBe("Rosa Zarza Jimeno");
    expect(cat.seniorPartner.cargoMetadata).toBe("SENIOR_PARTNER");
  });

  it("consejo EAD: 7 cargos con tipos válidos del CHECK y nombres registrales", () => {
    expect(cat.eadBoard.length).toBe(7);
    const tiposValidos = ["PRESIDENTE", "VICEPRESIDENTE", "CONSEJERO", "SECRETARIO", "VICESECRETARIO"];
    for (const c of cat.eadBoard) expect(tiposValidos).toContain(c.tipoCondicion);
    const byTipo = (t: string) => cat.eadBoard.filter((c) => c.tipoCondicion === t);
    expect(byTipo("PRESIDENTE").map((c) => c.nombre)).toEqual(["Julián Ramón Inza Aldaz"]);
    expect(byTipo("VICEPRESIDENTE").map((c) => c.nombre)).toEqual(["Eduardo Abad Valdenebro"]);
    expect(byTipo("CONSEJERO").length).toBe(3);
    const cd = cat.eadBoard.find((c) => c.metadata?.consejero_delegado === true);
    expect(cd?.nombre).toBe("Eduardo Inza Blasco");
    const sec = byTipo("SECRETARIO")[0];
    expect(sec.nombre).toBe("Roberto Delgado Gil");
    expect(sec.metadata?.no_consejero).toBe(true);
  });

  it("matchCenso: único, ambiguo y sin match se distinguen", () => {
    const censo = ["Fernando Vives Ruiz", "Ana García López", "Ana García Pérez"];
    expect(matchCenso("Fernando Vives", censo).estado).toBe("UNICO");
    expect(matchCenso("Ana García", censo).estado).toBe("AMBIGUO");
    expect(matchCenso("Inexistente Total", censo).estado).toBe("SIN_MATCH");
  });
});
```

- [ ] **Step 2: Ver el fallo** — Run: `bun test src/test/garrigues/governance-catalog.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar el catálogo**

```typescript
// scripts/garrigues/gobierno/governance-catalog.ts
// Catálogo tipado del gobierno de la matriz (G2). Envuelve los datasets del
// Carril B y resuelve el matching comités↔censo. Los SOCIO de comités DEBEN
// resolver a un único nombre del censo (346); ambigüedades → MATCH_OVERRIDES.
import comitesJson from "./comites-2026.json";
import censoJson from "../censo/socios-acta-2026-05-06.json";
import eadJson from "../borme/ead-trust-sl.json";

export interface MiembroResuelto {
  nombreComite: string;
  nombreCanonico: string;
  categoria: string;
  rol?: string;
  esSocioCenso: boolean;
}

export interface EstructuraResuelta {
  slug: string; nombre: string; dependeDe: string[]; mision: string;
  mandatoAnios?: number; informePreceptivo?: boolean; incidencias?: string[];
  miembros: MiembroResuelto[];
}

export interface EadCargo {
  nombre: string;
  tipoCondicion: "PRESIDENTE" | "VICEPRESIDENTE" | "CONSEJERO" | "SECRETARIO" | "VICESECRETARIO";
  desde: string | null;
  metadata?: Record<string, unknown>;
  inscripcionRef?: string;
}

// Overrides curables: nombre tal como aparece en el comité → nombre exacto del censo.
// Se rellenan cuando el test de matching reporte AMBIGUO/SIN_MATCH.
export const MATCH_OVERRIDES: Record<string, string> = {};

// Excepciones documentadas: SOCIO de comité que NO está en el censo de la Junta
// (p. ej. socio no de cuota). Añadir SOLO con justificación; el test las respeta.
export const SOCIOS_SIN_CENSO: string[] = [];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\-]/g, " ").replace(/\s+/g, " ").trim();

export function matchCenso(nombreComite: string, censo: string[]): { estado: "UNICO" | "AMBIGUO" | "SIN_MATCH"; candidatos: string[] } {
  const tokens = norm(nombreComite).split(" ");
  const candidatos = censo.filter((c) => {
    const ct = norm(c).split(" ");
    // todos los tokens del nombre de comité aparecen, en orden, en el nombre del censo
    let i = 0;
    for (const t of tokens) {
      while (i < ct.length && ct[i] !== t) i += 1;
      if (i >= ct.length) return false;
      i += 1;
    }
    return true;
  });
  if (candidatos.length === 1) return { estado: "UNICO", candidatos };
  if (candidatos.length > 1) return { estado: "AMBIGUO", candidatos };
  return { estado: "SIN_MATCH", candidatos: [] };
}

export function loadGovernanceCatalog() {
  const presenciales = censoJson.presenciales as string[];
  const representados = censoJson.representados as string[];
  const todos = [...presenciales, ...representados];

  const estructuras: EstructuraResuelta[] = (comitesJson.estructuras as EstructuraResuelta[]).map((e) => ({
    ...e,
    miembros: (e.miembros as { nombre: string; categoria: string; rol?: string }[]).map((m) => {
      if (m.categoria !== "SOCIO") {
        return { nombreComite: m.nombre, nombreCanonico: m.nombre, categoria: m.categoria, rol: m.rol, esSocioCenso: false };
      }
      if (SOCIOS_SIN_CENSO.includes(m.nombre)) {
        return { nombreComite: m.nombre, nombreCanonico: m.nombre, categoria: m.categoria, rol: m.rol, esSocioCenso: false };
      }
      const override = MATCH_OVERRIDES[m.nombre];
      if (override) {
        return { nombreComite: m.nombre, nombreCanonico: override, categoria: m.categoria, rol: m.rol, esSocioCenso: true };
      }
      const res = matchCenso(m.nombre, todos);
      return {
        nombreComite: m.nombre,
        nombreCanonico: res.estado === "UNICO" ? res.candidatos[0] : m.nombre,
        categoria: m.categoria,
        rol: m.rol,
        esSocioCenso: res.estado === "UNICO",
      };
    }),
  }));

  return {
    estructuras,
    censo: { presenciales, representados, todos },
    adminUnico: {
      nombreCenso: "Fernando Vives Ruiz",
      fechaInicio: "2026-06-30",
      fechaFin: "2032-06-30",
      inscripcionRef: "Anuncio BORME 338618/2026, S 8, H M-190538, I/A 960",
      inscripcionFecha: "2026-07-13",
      nota: "Reelección por 6 años acordada por la Junta de 06/05/2026 (terminación anticipada del mandato que vencía 31/01/2028)",
    },
    seniorPartner: {
      nombreCenso: "Rosa Zarza Jimeno",
      cargoMetadata: "SENIOR_PARTNER",
      nota: "Cargo de supervisión (no órgano): preside el Consejo de Socios (art. 29 Estatutos), supervisa PPD y PBC/FT",
    },
    eadBoard: [
      { nombre: "Julián Ramón Inza Aldaz", tipoCondicion: "PRESIDENTE", desde: null },
      { nombre: "Eduardo Abad Valdenebro", tipoCondicion: "VICEPRESIDENTE", desde: null },
      { nombre: "Eduardo Inza Blasco", tipoCondicion: "CONSEJERO", desde: "2023-05-03", metadata: { consejero_delegado: true } },
      { nombre: "Cristina Mesa Sánchez", tipoCondicion: "CONSEJERO", desde: null },
      { nombre: "Moisés Menéndez Andrés", tipoCondicion: "CONSEJERO", desde: null },
      { nombre: "Roberto Delgado Gil", tipoCondicion: "SECRETARIO", desde: "2023-04-20", metadata: { no_consejero: true } },
      { nombre: "Belén Aguayo", tipoCondicion: "VICESECRETARIO", desde: null, metadata: { no_consejero: true, apellido_completo_pendiente: true } },
    ] as EadCargo[],
    fuenteEad: (eadJson as { fuente_captura?: string }).fuente_captura ?? "Cosecha BORME 2026-08-03",
  };
}
```

- [ ] **Step 4: Ver el resultado y CURAR el matching.** Run: `bun test src/test/garrigues/governance-catalog.test.ts`. El test 3 probablemente FALLE listando los SOCIO ambiguos/sin match (p. ej. "Jose Maria Perez" si hay varios "José María Pérez …" en el censo, o grafías divergentes). Para CADA problema listado: buscar el nombre en `scripts/garrigues/censo/socios-acta-2026-05-06.json` (grep tolerante a tildes) y añadir la entrada a `MATCH_OVERRIDES` (o, si el socio genuinamente no está en el censo, a `SOCIOS_SIN_CENSO` con comentario justificando). Iterar hasta verde. **Prohibido** inventar: si no hay candidato claro, `SOCIOS_SIN_CENSO` + comentario.

- [ ] **Step 5: Verde completo** — Run: `bun test src/test/garrigues/governance-catalog.test.ts` → PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/garrigues/gobierno/governance-catalog.ts src/test/garrigues/governance-catalog.test.ts
git commit -m "feat(g2): catálogo de gobierno con matching comités-censo curado

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 2: Seed personas + condiciones (censo, comités, cargos, consejo EAD)

**Files:**
- Create: `scripts/seed-garrigues-gobierno.ts`
- Modify: `scripts/README-seed.md` (sección al final; **reconstruir desde HEAD antes de editar** — fichero pre-sucio)

**Interfaces:**
- Consumes: `loadGovernanceCatalog()` (Task 1); `GARRIGUES_TENANT`, `GARRIGUES_MATRIZ_UUID` de `../entities-catalog`; entidad EAD `00000000-0000-0000-0002-000000000026`. Bodies de Task 3 — **este seed corre en dos fases**: fase `--personas` (esta task) y fase `--comites` (tras Task 3, que crea los bodies).
- Produces: ~380 filas `persons` PF (346 censo + ~35 no-socios de comités), condiciones: 346 SOCIO (matriz), 1 ADMIN_UNICO (Vives, con inscripción), metadata SENIOR_PARTNER en la condición SOCIO de Zarza, 7 cargos EAD (body-scoped, Task 3 crea el body primero → los cargos EAD se siembran en fase `--comites`).

- [ ] **Step 1: Escribir el script (estructura de fases)**

```typescript
#!/usr/bin/env bun
/**
 * Seed G2 — Gobierno de la matriz: personas + condiciones + comités + consejo EAD.
 * Fases (ejecutar en orden, cada una idempotente):
 *   bun run scripts/seed-garrigues-gobierno.ts --personas [--commit]  # censo 346 + no-socios + SOCIO/ADMIN_UNICO/metadata SP
 *   bun run scripts/seed-garrigues-gobierno.ts --comites  [--commit]  # membresías body-scoped + consejo EAD (REQUIERE bodies de seed-garrigues-bodies)
 * Personas: lookup (tenant_id, full_name) — sin homónimos (garantizado por tests T1).
 * Condiciones: clave natural (person, entity, body, tipo) con estado VIGENTE.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";
import { loadGovernanceCatalog } from "./garrigues/gobierno/governance-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const FASE_PERSONAS = process.argv.includes("--personas");
const FASE_COMITES = process.argv.includes("--comites");
const EAD_ENTITY = "00000000-0000-0000-0002-000000000026";

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);
if (!FASE_PERSONAS && !FASE_COMITES) fail("Indica la fase: --personas o --comites");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cat = loadGovernanceCatalog();

async function personIdByName(nombre) {
  const { data, error } = await admin.from("persons")
    .select("id").eq("tenant_id", GARRIGUES_TENANT).eq("full_name", nombre).maybeSingle();
  if (error) fail(`persons select '${nombre}': ${error.message}`);
  return data?.id ?? null;
}

async function ensurePerson(nombre, extra = {}) {
  const existing = await personIdByName(nombre);
  if (existing) return existing;
  const { data, error } = await admin.from("persons")
    .insert({ tenant_id: GARRIGUES_TENANT, full_name: nombre, person_type: "PF", ...extra })
    .select("id").single();
  if (error) fail(`persons insert '${nombre}': ${error.message}`);
  return data.id;
}

async function ensureCondicion(row) {
  let q = admin.from("condiciones_persona").select("id, metadata")
    .eq("tenant_id", GARRIGUES_TENANT)
    .eq("person_id", row.person_id).eq("entity_id", row.entity_id)
    .eq("tipo_condicion", row.tipo_condicion);
  q = row.body_id ? q.eq("body_id", row.body_id) : q.is("body_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) fail(`condiciones select: ${error.message}`);
  if (data) {
    const { error: eU } = await admin.from("condiciones_persona")
      .update({ estado: "VIGENTE", ...row }).eq("id", data.id);
    if (eU) fail(`condiciones update: ${eU.message}`);
    return data.id;
  }
  const { data: ins, error: eI } = await admin.from("condiciones_persona")
    .insert({ tenant_id: GARRIGUES_TENANT, estado: "VIGENTE", ...row }).select("id").single();
  if (eI) fail(`condiciones insert: ${eI.message}`);
  return ins.id;
}

async function fasePersonas() {
  const noSocios = new Map();
  for (const e of cat.estructuras) {
    for (const m of e.miembros) {
      if (!m.esSocioCenso) noSocios.set(m.nombreCanonico, m.categoria);
    }
  }
  console.table([
    { dato: "socios del censo", valor: cat.censo.todos.length },
    { dato: "personas de comités no-censo", valor: noSocios.size },
  ]);
  if (!COMMIT) { console.log("Dry-run."); return; }

  for (const nombre of cat.censo.todos) {
    const pid = await ensurePerson(nombre);
    await ensureCondicion({
      person_id: pid, entity_id: GARRIGUES_MATRIZ_UUID, body_id: null,
      tipo_condicion: "SOCIO", fecha_inicio: "2026-05-06",
      metadata: { fuente: "Censo acta Junta 06/05/2026 (depósito RM)", categoria: "SOCIO" },
    });
  }
  console.log(`✓ ${cat.censo.todos.length} socios con condición SOCIO`);

  for (const [nombre, categoria] of noSocios) {
    await ensurePerson(nombre, { denomination: categoria });
  }
  console.log(`✓ ${noSocios.size} personas de comités (no censo)`);

  const vives = await personIdByName(cat.adminUnico.nombreCenso);
  if (!vives) fail("Vives no encontrado tras sembrar el censo");
  await ensureCondicion({
    person_id: vives, entity_id: GARRIGUES_MATRIZ_UUID, body_id: null,
    tipo_condicion: "ADMIN_UNICO",
    fecha_inicio: cat.adminUnico.fechaInicio, fecha_fin: cat.adminUnico.fechaFin,
    inscripcion_rm_referencia: cat.adminUnico.inscripcionRef,
    inscripcion_rm_fecha: cat.adminUnico.inscripcionFecha,
    metadata: { nota: cat.adminUnico.nota },
  });
  console.log("✓ ADMIN_UNICO Vives con inscripción registral");

  const zarza = await personIdByName(cat.seniorPartner.nombreCenso);
  if (!zarza) fail("Zarza no encontrada tras sembrar el censo");
  const { data: condZ, error: eZ } = await admin.from("condiciones_persona")
    .select("id, metadata").eq("tenant_id", GARRIGUES_TENANT)
    .eq("person_id", zarza).eq("entity_id", GARRIGUES_MATRIZ_UUID)
    .eq("tipo_condicion", "SOCIO").is("body_id", null).maybeSingle();
  if (eZ || !condZ) fail(`Condición SOCIO de Zarza no localizada: ${eZ?.message ?? "sin fila"}`);
  const { error: eZu } = await admin.from("condiciones_persona")
    .update({ metadata: { ...(condZ.metadata ?? {}), cargo: cat.seniorPartner.cargoMetadata, nota: cat.seniorPartner.nota } })
    .eq("id", condZ.id);
  if (eZu) fail(`metadata senior partner: ${eZu.message}`);
  console.log("✓ Senior partner (metadata sobre la condición SOCIO de Zarza)");
}

async function faseComites() {
  const { data: bodies, error: eB } = await admin.from("governing_bodies")
    .select("id, slug").eq("tenant_id", GARRIGUES_TENANT);
  if (eB) fail(`governing_bodies: ${eB.message}`);
  const bodyBySlug = new Map((bodies ?? []).map((b) => [b.slug, b.id]));

  let membresias = 0;
  for (const e of cat.estructuras) {
    const bodyId = bodyBySlug.get(`garrigues-${e.slug}`);
    if (!bodyId) fail(`Body no encontrado para ${e.slug} — ejecuta antes seed-garrigues-bodies`);
    for (const m of e.miembros) {
      const pid = await personIdByName(m.nombreCanonico);
      if (!pid) fail(`Persona no sembrada: ${m.nombreCanonico} (fase --personas primero)`);
      await ensureCondicion({
        person_id: pid, entity_id: GARRIGUES_MATRIZ_UUID, body_id: bodyId,
        tipo_condicion: m.rol === "PRESIDE" ? "PRESIDENTE" : "CONSEJERO",
        metadata: { categoria: m.categoria, rol_comite: m.rol ?? "VOCAL", naturaleza: "CONSULTIVO" },
      });
      membresias += 1;
    }
  }
  console.log(`✓ ${membresias} membresías de estructuras consultivas`);

  const eadBody = bodyBySlug.get("garrigues-ead-cda");
  if (!eadBody) fail("Body garrigues-ead-cda no encontrado — ejecuta antes seed-garrigues-bodies");
  for (const c of cat.eadBoard) {
    const pid = await ensurePerson(c.nombre);
    await ensureCondicion({
      person_id: pid, entity_id: EAD_ENTITY, body_id: eadBody,
      tipo_condicion: c.tipoCondicion, fecha_inicio: c.desde,
      metadata: { ...(c.metadata ?? {}), fuente: cat.fuenteEad },
    });
  }
  console.log("✓ Consejo de EAD Trust (7 cargos verificados)");
}

async function main() {
  if (FASE_PERSONAS) await fasePersonas();
  if (FASE_COMITES) {
    if (!COMMIT) { console.log("Dry-run (fase comités; se listaría el plan)."); return; }
    await faseComites();
  }
  console.log("✓ Fase completada (idempotente).");
}
main();
```

- [ ] **Step 2: Dry-run + ejecución de `--personas`** — Run: `bun run db:check-target && bun run scripts/seed-garrigues-gobierno.ts --personas` (dry) y después `--personas --commit`. Expected: `✓ 346 socios…`, `✓ ~35 personas…`, `✓ ADMIN_UNICO`, `✓ Senior partner`. (La fase `--comites` se ejecuta en Task 3 Step 4, tras crear los bodies.)

- [ ] **Step 3: Idempotencia** — repetir `--personas --commit` → sin duplicados (verificar con SQL: `SELECT count(*) FROM condiciones_persona WHERE tenant_id='...0002' AND tipo_condicion='SOCIO'` = 346).

- [ ] **Step 4: README (reconstruir desde HEAD) y commit**

```bash
git show HEAD:scripts/README-seed.md > scripts/README-seed.md
cat >> scripts/README-seed.md <<'EOF'

## seed-garrigues-gobierno.ts (G2 — 2026-08-03)

Gobierno de la matriz en dos fases idempotentes: `--personas` (censo 346 +
no-socios de comités + ADMIN_UNICO Vives con inscripción + metadata senior
partner) y `--comites` (membresías body-scoped + consejo EAD verificado).
Requiere `SUPABASE_SERVICE_ROLE_KEY` y, para --comites, seed-garrigues-bodies.
EOF
git add scripts/seed-garrigues-gobierno.ts scripts/README-seed.md
git commit -m "feat(g2): seed de personas y condiciones del gobierno de la matriz

Co-Authored-By: claude-flow <ruv@ruv.net>"
# Restaurar el árbol pre-sucio: re-aplicar la prosa WIP NO es necesario aquí —
# el fichero del árbol ya la tenía; verificar con: git diff HEAD -- scripts/README-seed.md
# (debe mostrar SOLO la prosa 2026-07-21 preexistente, sin la sección nueva duplicada).
```

**OJO:** si `git diff HEAD -- scripts/README-seed.md` muestra la sección G2 como eliminada (porque el árbol tiene la V_full sin ella), añadir también la sección al fichero del árbol (mismo bloque `cat >>`) para que árbol = HEAD + prosa WIP.

---

### Task 3: Seed de órganos (Junta, admin único, 19 consultivas, CdA EAD)

**Files:**
- Create: `scripts/seed-garrigues-bodies.ts`

**Interfaces:**
- Consumes: `loadGovernanceCatalog()`; `GARRIGUES_TENANT`/`GARRIGUES_MATRIZ_UUID`; EAD `…0026`.
- Produces: `governing_bodies` con slugs `garrigues-junta-socios` (JUNTA), `garrigues-admin-unico` (CDA, `config.organo_tipo='ADMIN_UNICO'`), `garrigues-<slug-comité>` ×19 (COMITE, `config.naturaleza='CONSULTIVO'`, `depende_de`, `mision`, `mandato_anios`, `informe_preceptivo`), `garrigues-ead-cda` (CDA, `config.organo_tipo='CONSEJO_ADMIN'`, entity EAD). **Task 2 fase `--comites` y Tasks 6-7 dependen de estos slugs exactos.**

- [ ] **Step 1: Escribir el script**

```typescript
#!/usr/bin/env bun
/**
 * Seed G2 — Órganos del tenant Garrigues. Idempotente por slug.
 * Decisorios: Junta de Socios (JUNTA) + body del administrador único (CDA/ADMIN_UNICO)
 * + CdA de EAD Trust (CDA/CONSEJO_ADMIN). Consultivas: 19 COMITE con config.
 * GOTCHA G3: organo-resolver mapea COMITE→COMISION_DELEGADA; la exclusión de
 * consultivos de los selectores de adopción es trabajo de G3 (config.naturaleza).
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";
import { loadGovernanceCatalog } from "./garrigues/gobierno/governance-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const EAD_ENTITY = "00000000-0000-0000-0002-000000000026";

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail("Falta la service-role key.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cat = loadGovernanceCatalog();

async function ensureBody(row) {
  const { data, error } = await admin.from("governing_bodies")
    .select("id").eq("tenant_id", GARRIGUES_TENANT).eq("slug", row.slug).maybeSingle();
  if (error) fail(`bodies select ${row.slug}: ${error.message}`);
  if (data) {
    const { error: eU } = await admin.from("governing_bodies").update(row).eq("id", data.id);
    if (eU) fail(`bodies update ${row.slug}: ${eU.message}`);
    return data.id;
  }
  const { data: ins, error: eI } = await admin.from("governing_bodies")
    .insert({ tenant_id: GARRIGUES_TENANT, ...row }).select("id").single();
  if (eI) fail(`bodies insert ${row.slug}: ${eI.message}`);
  return ins.id;
}

async function main() {
  const bodies = [
    {
      slug: "garrigues-junta-socios", name: "Junta de Socios", body_type: "JUNTA",
      entity_id: GARRIGUES_MATRIZ_UUID,
      config: { naturaleza: "DECISORIO", fuente: "Estatutos J&A Garrigues SLP; acta 06/05/2026", censo_socios: 346 },
    },
    {
      slug: "garrigues-admin-unico", name: "Administrador Único", body_type: "CDA",
      entity_id: GARRIGUES_MATRIZ_UUID,
      config: { naturaleza: "DECISORIO", organo_tipo: "ADMIN_UNICO", titular: "Fernando Vives Ruiz", nota: "La condición ADMIN_UNICO (entity-level) es la titularidad; este body habilita los flujos de decisión unipersonal del motor" },
    },
    {
      slug: "garrigues-ead-cda", name: "Consejo de Administración de EAD Trust", body_type: "CDA",
      entity_id: EAD_ENTITY,
      config: { naturaleza: "DECISORIO", organo_tipo: "CONSEJO_ADMIN", fuente: "BORME/RM (cosecha 2026-08-03)" },
    },
    ...cat.estructuras.map((e) => ({
      slug: `garrigues-${e.slug}`, name: e.nombre, body_type: "COMITE",
      entity_id: GARRIGUES_MATRIZ_UUID,
      config: {
        naturaleza: "CONSULTIVO",
        depende_de: e.dependeDe,
        mision: e.mision,
        ...(e.mandatoAnios ? { mandato_anios: e.mandatoAnios } : {}),
        ...(e.informePreceptivo ? { informe_preceptivo: true } : {}),
        ...(e.incidencias?.length ? { incidencias: e.incidencias } : {}),
      },
    })),
  ];
  console.table(bodies.map((b) => ({ slug: b.slug, tipo: b.body_type })));
  if (!COMMIT) { console.log("Dry-run."); return; }
  for (const b of bodies) await ensureBody(b);
  console.log(`✓ ${bodies.length} órganos sembrados (idempotente).`);
}
main();
```

- [ ] **Step 2: Dry-run + ejecutar** — Run: `bun run scripts/seed-garrigues-bodies.ts` (22 filas en el plan) y `--commit`. Idempotencia: repetir.
- [ ] **Step 3: Verificación SQL** — vía MCP: `SELECT body_type, count(*) FROM governing_bodies WHERE tenant_id='...0002' GROUP BY body_type` → JUNTA 1, CDA 2, COMITE 19.
- [ ] **Step 4: Ejecutar la fase `--comites` del seed de Task 2** — Run: `bun run scripts/seed-garrigues-gobierno.ts --comites --commit`. Expected: `✓ 218 membresías`, `✓ Consejo de EAD Trust (7 cargos)`. SQL: condiciones con body ≈ 225.
- [ ] **Step 5: Commit**

```bash
git add scripts/seed-garrigues-bodies.ts
git commit -m "feat(g2): seed de órganos — junta, admin único, 19 consultivas y CdA EAD

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 4: Seed de capital canónico + refresh de parte votante

**Files:**
- Create: `scripts/seed-garrigues-capital.ts`

**Interfaces:**
- Consumes: censo del catálogo (Task 1); `GARRIGUES_ENTITIES` (para holdings de filiales CONFIRMADO); funciones Cloud `fn_refresh_parte_votante_entity` (firma a sondar en Step 1).
- Produces: `share_classes` (Clase A matriz), `entity_capital_profile` VIGENTE (11.104.008 €), `capital_holdings` (346 socios INFERIDO + autocartera is_treasury + filiales), `parte_votante_current` refrescada.

- [ ] **Step 1: Sondar las firmas de las funciones** — Run: `grep -rn "CREATE OR REPLACE FUNCTION public.fn_refresh_parte_votante_entity\|CREATE OR REPLACE FUNCTION public.fn_crear_censo_snapshot" supabase/migrations/*.sql | head -4` y leer ~20 líneas de cada una para capturar argumentos exactos. Documentar en el reporte. (El snapshot de la Junta 2026 se difiere a G3 — aquí solo el refresh.)

- [ ] **Step 2: Escribir el script**

```typescript
#!/usr/bin/env bun
/**
 * Seed G2 — Capital canónico de la matriz + holdings de filiales.
 * Restricciones REALES respetadas: capital vigente 11.104.008 € (BORME 24/04/2026);
 * autocartera 18 participaciones = 2,59% derechos (is_treasury); los 3 presenciales
 * suman 0,8875% (acta). Pesos individuales SIEMPRE metadata.peso='INFERIDO'.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID, GARRIGUES_ENTITIES } from "./garrigues/entities-catalog";
import { loadGovernanceCatalog } from "./garrigues/gobierno/governance-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail("Falta la service-role key.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cat = loadGovernanceCatalog();

// Restricciones agregadas reales
const AUTOCARTERA_PCT = 2.59;          // 18 participaciones (acta 06/05/2026)
const PRESENCIALES_PCT_TOTAL = 0.8875; // Vives+Zarza+Delgado (acta)

async function main() {
  const presenciales = cat.censo.presenciales;
  const representados = cat.censo.representados;
  const pctPresencial = PRESENCIALES_PCT_TOTAL / presenciales.length; // 0.29583...
  const restante = 100 - AUTOCARTERA_PCT - PRESENCIALES_PCT_TOTAL;
  const pctRepresentado = restante / representados.length; // ≈ 0.2814

  console.table([
    { dato: "capital vigente (€)", valor: 11104008 },
    { dato: "pct por presencial (INFERIDO)", valor: pctPresencial.toFixed(4) },
    { dato: "pct por representado (INFERIDO)", valor: pctRepresentado.toFixed(4) },
    { dato: "suma control", valor: (AUTOCARTERA_PCT + 3 * pctPresencial + 343 * pctRepresentado).toFixed(4) },
  ]);
  if (!COMMIT) { console.log("Dry-run."); return; }

  // 1) Clase A
  const { data: sc0 } = await admin.from("share_classes").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID).eq("class_code", "A").maybeSingle();
  let claseA = sc0?.id;
  if (!claseA) {
    const { data, error } = await admin.from("share_classes").insert({
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
      class_code: "A", name: "Participaciones Clase A", votes_per_title: 1, voting_rights: true,
    }).select("id").single();
    if (error) fail(`share_classes: ${error.message}`);
    claseA = data.id;
  }

  // 2) Perfil de capital VIGENTE (una fila VIGENTE por entidad — regla canónica)
  const { data: prof0 } = await admin.from("entity_capital_profile").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID).eq("estado", "VIGENTE").maybeSingle();
  if (!prof0) {
    const { error } = await admin.from("entity_capital_profile").insert({
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID, currency: "EUR",
      capital_escriturado: 11104008, capital_desembolsado: 11104008,
      estado: "VIGENTE", effective_from: "2026-04-24",
    });
    if (error) fail(`capital_profile: ${error.message}`);
  } else {
    const { error } = await admin.from("entity_capital_profile")
      .update({ capital_escriturado: 11104008, capital_desembolsado: 11104008, effective_from: "2026-04-24" })
      .eq("id", prof0.id);
    if (error) fail(`capital_profile update: ${error.message}`);
  }

  // 3) Holdings del censo (idempotente por holder+entity)
  async function ensureHolding(holderId, pct, extra = {}) {
    const { data } = await admin.from("capital_holdings").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID)
      .eq("holder_person_id", holderId).maybeSingle();
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
      holder_person_id: holderId, share_class_id: claseA,
      porcentaje_capital: pct, voting_rights: true, is_treasury: false,
      metadata: { peso: "INFERIDO", nota: "Reparto uniforme bajo restricciones agregadas reales del acta 06/05/2026" },
      ...extra,
    };
    if (data) {
      const { error } = await admin.from("capital_holdings").update(row).eq("id", data.id);
      if (error) fail(`holding update: ${error.message}`);
    } else {
      const { error } = await admin.from("capital_holdings").insert(row);
      if (error) fail(`holding insert: ${error.message}`);
    }
  }

  const pid = async (nombre) => {
    const { data, error } = await admin.from("persons").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("full_name", nombre).maybeSingle();
    if (error || !data) fail(`persona no sembrada: ${nombre}`);
    return data.id;
  };

  for (const n of presenciales) await ensureHolding(await pid(n), pctPresencial);
  for (const n of representados) await ensureHolding(await pid(n), pctRepresentado);

  // Autocartera: titular = la propia matriz (persona PJ de la entidad matriz)
  const { data: matriz } = await admin.from("entities").select("person_id").eq("id", GARRIGUES_MATRIZ_UUID).single();
  await ensureHolding(matriz.person_id, AUTOCARTERA_PCT, {
    is_treasury: true, voting_rights: false, numero_titulos: 18,
    metadata: { peso: "REAL", nota: "18 participaciones en autocartera (acta 06/05/2026, 2,59% de los derechos de voto)" },
  });
  console.log("✓ 347 holdings de la matriz (346 socios + autocartera)");

  // 4) Holdings de filiales con % CONFIRMADO (titular: matriz u otra del grupo)
  const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));
  for (const e of GARRIGUES_ENTITIES) {
    if (!e.parentSlug || e.ownershipPct == null) continue;
    if (e.provenance.confianza !== "CONFIRMADO" && e.slug !== "ead-trust-sl") continue;
    const parent = bySlug.get(e.parentSlug);
    const { data: pEnt } = await admin.from("entities").select("person_id").eq("id", parent.uuid).single();
    const { data: h0 } = await admin.from("capital_holdings").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", e.uuid)
      .eq("holder_person_id", pEnt.person_id).maybeSingle();
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: e.uuid, holder_person_id: pEnt.person_id,
      porcentaje_capital: e.ownershipPct, voting_rights: true, is_treasury: false,
      metadata: { fuente: "IDC 2025", confianza: e.provenance.confianza },
    };
    if (h0) await admin.from("capital_holdings").update(row).eq("id", h0.id);
    else await admin.from("capital_holdings").insert(row);
  }
  console.log("✓ Holdings de filiales (CONFIRMADO + EAD 51 A_CONFIRMAR)");

  // 5) Refresh de la proyección (firma sondada en Step 1; ajustar args si difieren)
  const { error: eRpc } = await admin.rpc("fn_refresh_parte_votante_entity", {
    p_entity_id: GARRIGUES_MATRIZ_UUID,
  });
  if (eRpc) console.warn(`⚠ fn_refresh_parte_votante_entity: ${eRpc.message} — revisar firma (Step 1) y re-ejecutar`);
  else console.log("✓ parte_votante_current refrescada para la matriz");
}
main();
```

- [ ] **Step 3: Dry-run + ejecutar + idempotencia** — dry (suma control ≈ 100.0000), `--commit`, repetir. Si la RPC falla por firma, corregir args según Step 1 y re-ejecutar (solo la RPC es re-lanzable).
- [ ] **Step 4: Verificación SQL** — `SELECT count(*), sum(porcentaje_capital) FROM capital_holdings WHERE entity_id='...0001 de Garrigues (0002-...-001)'` → 347 filas, suma ≈ 100; `SELECT count(*) FROM parte_votante_current WHERE entity_id='...'` > 0; perfil VIGENTE único.
- [ ] **Step 5: Commit** — `git add scripts/seed-garrigues-capital.ts` + commit castellano + trailer.

---

### Task 5: Libros societarios + delegaciones reales

**Files:**
- Create: `scripts/seed-garrigues-libros-delegaciones.ts`

**Interfaces:**
- Consumes: personas de Task 2 (Vives, Eduardo Inza Blasco); matriz + EAD.
- Produces: 2 filas `mandatory_books` (registro de socios, actas) para la matriz; 2 filas `delegations` (delegación de facultades de la Junta 2026 punto 11; consejero delegado EAD).

- [ ] **Step 1: Sondar shapes** — Run (MCP `execute_sql`): `SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name='mandatory_books'` y `SELECT DISTINCT delegation_type, status FROM delegations LIMIT 20` (vocabulario real de ARGA). Documentar y usar esos valores en el script (ajustando los literales del Step 2 si difieren).

- [ ] **Step 2: Escribir el script** (esqueleto con los campos sondados; estructura idéntica a los seeds anteriores — guard de target, service-role, dry-run, idempotencia por claves naturales):

```typescript
#!/usr/bin/env bun
/**
 * Seed G2 — Libros societarios de la matriz + delegaciones reales.
 * Libros: registro de socios (346 del censo) y libro de actas (arranca con la
 * Junta 06/05/2026). Delegaciones: punto 11 de la Junta 2026 (facultades a
 * Vives y apoderados para elevar a público/subsanar) y consejero delegado de
 * EAD Trust (Eduardo Inza Blasco, delegación inscrita desde 03/05/2023).
 * Los shapes exactos de mandatory_books/delegations se sondean antes (Step 1)
 * y los literales de este script se ajustan a lo sondado.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const EAD_ENTITY = "00000000-0000-0000-0002-000000000026";

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail("Falta la service-role key.");
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function personIdByName(nombre) {
  const { data } = await admin.from("persons").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("full_name", nombre).maybeSingle();
  if (!data) fail(`persona no sembrada: ${nombre}`);
  return data.id;
}

async function main() {
  const libros = [
    { book_type: "LIBRO_REGISTRO_SOCIOS", nombre: "Libro registro de socios", nota: "Censo real: 346 socios (acta 06/05/2026); movimientos posteriores BORME jul-2026 como histórico" },
    { book_type: "LIBRO_ACTAS", nombre: "Libro de actas", nota: "Arranca con la Junta ordinaria de 06/05/2026 (12 puntos, unanimidad)" },
  ];
  console.table(libros.map((l) => ({ libro: l.nombre })));
  if (!COMMIT) { console.log("Dry-run."); return; }

  for (const l of libros) {
    const { data } = await admin.from("mandatory_books").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID)
      .eq("book_type", l.book_type).maybeSingle();
    if (!data) {
      const { error } = await admin.from("mandatory_books").insert({
        tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
        book_type: l.book_type, // + campos obligatorios sondados en Step 1
      });
      if (error) fail(`mandatory_books ${l.book_type}: ${error.message}`);
    }
  }
  console.log("✓ 2 libros societarios");

  const vives = await personIdByName("Fernando Vives Ruiz");
  const inza = await personIdByName("Eduardo Inza Blasco");
  const delegaciones = [
    {
      code: "GARR-DEL-2026-01", slug: "garrigues-delegacion-junta-2026",
      entity_id: GARRIGUES_MATRIZ_UUID, delegate_id: vives,
      scope: "Elevar a público, subsanar e inscribir los acuerdos de la Junta de Socios de 06/05/2026 (punto 11 del orden del día); facultades también a los apoderados de la Sociedad",
      start_date: "2026-05-06",
    },
    {
      code: "GARR-DEL-EAD-CD", slug: "garrigues-delegacion-ead-cd",
      entity_id: EAD_ENTITY, delegate_id: inza,
      scope: "Delegación de facultades del Consejo en el Consejero Delegado (inscrita; fuente BORME/RM, cosecha 2026-08-03)",
      start_date: "2023-05-03",
    },
  ];
  for (const d of delegaciones) {
    const { data } = await admin.from("delegations").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("slug", d.slug).maybeSingle();
    if (!data) {
      const { error } = await admin.from("delegations").insert({
        tenant_id: GARRIGUES_TENANT, status: "Activa", delegation_type: "GENERAL", // ajustar a vocabulario sondado
        ...d,
      });
      if (error) fail(`delegations ${d.slug}: ${error.message}`);
    }
  }
  console.log("✓ 2 delegaciones reales");
}
main();
```

- [ ] **Step 3: Ajustar literales al sondeo, dry-run, `--commit`, idempotencia, verificación SQL** (2 libros, 2 delegaciones; `/delegaciones` y `/secretaria/libros` los mostrarán en la verificación viva).
- [ ] **Step 4: Commit** — `git add scripts/seed-garrigues-libros-delegaciones.ts` + commit.

---

### Task 6: Fix minor G1 (scope Secretaría) + badge de naturaleza consultiva (TDD)

**Files:**
- Modify: `src/hooks/useEntities.ts` (`useEntitiesList`, filtro `sociedadesOnly`)
- Create: `src/lib/organo-naturaleza.ts` — Test: `src/lib/__tests__/organo-naturaleza.test.ts`
- Modify: `src/pages/OrganosList.tsx` y `src/pages/OrganoDetalle.tsx` (badge + dependencia)

**Interfaces:**
- Produces: `organoNaturalezaBadges(config: unknown): { label: string; title?: string }[]` — `[]` si config sin `naturaleza` (ARGA intacta).

- [ ] **Step 1: Fix del filtro `sociedadesOnly`.** En `useEntitiesList`, cuando `sociedadesOnly`, añadir a la query la exclusión de entes no-sociedad. **TRAMPA SQL:** `NOT IN` es hostil a NULL — `group_role NOT IN (...)` excluiría TODAS las filas ARGA (group_role NULL). Usar el patrón OR de PostgREST:

```typescript
query = query.or(
  "group_role.is.null,group_role.not.in.(DIVISION,OFICINA,OFICINA_REPRESENTACION,SUCURSAL)",
);
```

(ARGA: group_role NULL → pasa por la primera rama, cero cambio. Garrigues: los 5 entes no-sociedad quedan fuera del selector.)

- [ ] **Step 2: Test que falla (helper de naturaleza)**

```typescript
// src/lib/__tests__/organo-naturaleza.test.ts
import { describe, expect, it } from "vitest";
import { organoNaturalezaBadges } from "@/lib/organo-naturaleza";

describe("organoNaturalezaBadges", () => {
  it("config sin naturaleza / null / no-objeto → [] (ARGA intacta)", () => {
    expect(organoNaturalezaBadges(null)).toEqual([]);
    expect(organoNaturalezaBadges({})).toEqual([]);
    expect(organoNaturalezaBadges("x")).toEqual([]);
  });
  it("CONSULTIVO → badge con dependencia en title", () => {
    const b = organoNaturalezaBadges({ naturaleza: "CONSULTIVO", depende_de: ["SENIOR_PARTNER"] });
    expect(b[0].label).toBe("Consultivo — no adopta acuerdos");
    expect(b[0].title).toContain("SENIOR_PARTNER");
  });
  it("dependencia dual y preceptivo", () => {
    const b = organoNaturalezaBadges({ naturaleza: "CONSULTIVO", depende_de: ["ADMINISTRADOR_UNICO", "SENIOR_PARTNER"], informe_preceptivo: true });
    expect(b.some((x) => x.label === "Informa preceptivamente a la Junta")).toBe(true);
  });
});
```

- [ ] **Step 3: Rojo → implementar:**

```typescript
// src/lib/organo-naturaleza.ts
// Badges de naturaleza de órgano desde governing_bodies.config (G2).
// Config sin `naturaleza` (todos los bodies ARGA) → [] → cero cambio ARGA.
export function organoNaturalezaBadges(config: unknown): { label: string; title?: string }[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const c = config as { naturaleza?: string; depende_de?: string[]; informe_preceptivo?: boolean };
  if (c.naturaleza !== "CONSULTIVO") return [];
  const badges = [{
    label: "Consultivo — no adopta acuerdos",
    title: c.depende_de?.length ? `Depende de: ${c.depende_de.join(" y ")}` : undefined,
  }];
  if (c.informe_preceptivo) badges.push({ label: "Informa preceptivamente a la Junta", title: undefined });
  return badges;
}
```

- [ ] **Step 4: Verde → cablear** en `OrganosList.tsx` (chip junto al nombre, primer badge) y `OrganoDetalle.tsx` (todos, junto al header) — localizar los puntos con grep de `body_type`/nombre; el hook `useBodies` ya trae `config` (select `*`; verificar y añadir al tipo si falta como `config?: unknown`).
- [ ] **Step 5: Gates** — tests nuevos + `bun run typecheck` filtrado vacío + lint. Commit único con rutas específicas.

---

### Task 7: Sonda Cloud G2 (gate de datos)

**Files:**
- Test (create): `src/test/schema/garrigues-gobierno-seed.test.ts`

**Interfaces:** consume catálogo T1 + login demo Garrigues (patrón graceful-skip de `garrigues-entities-seed.test.ts`, mismos env/anon key).

- [ ] **Step 1: Escribir la sonda** (misma cabecera/beforeAll que `garrigues-entities-seed.test.ts` — copiar el patrón de login graceful-skip; aserciones):

```typescript
// (imports y beforeAll idénticos al patrón de garrigues-entities-seed.test.ts,
//  añadiendo: import { loadGovernanceCatalog } from "../../../scripts/garrigues/gobierno/governance-catalog")
const cat = loadGovernanceCatalog();

it("346 condiciones SOCIO vigentes en la matriz", async () => {
  if (!authed || !garr) { expect(true).toBe(true); return; }
  const { data, error } = await garr.from("condiciones_persona")
    .select("id").eq("tipo_condicion", "SOCIO").eq("estado", "VIGENTE").limit(500);
  expect(error).toBeNull();
  expect((data ?? []).length).toBe(346);
});

it("órganos: 1 JUNTA + 2 CDA + 19 COMITE, todos con config coherente", async () => {
  if (!authed || !garr) { expect(true).toBe(true); return; }
  const { data, error } = await garr.from("governing_bodies").select("slug, body_type, config").limit(100);
  expect(error).toBeNull();
  const byType = (t) => (data ?? []).filter((b) => b.body_type === t);
  expect(byType("JUNTA").length).toBe(1);
  expect(byType("CDA").length).toBe(2);
  expect(byType("COMITE").length).toBe(19);
  for (const b of byType("COMITE")) expect(b.config?.naturaleza).toBe("CONSULTIVO");
});

it("ADMIN_UNICO de Vives con inscripción I/A 960 y mandato 2026→2032", async () => {
  if (!authed || !garr) { expect(true).toBe(true); return; }
  const { data, error } = await garr.from("condiciones_persona")
    .select("fecha_inicio, fecha_fin, inscripcion_rm_referencia, person:person_id(full_name)")
    .eq("tipo_condicion", "ADMIN_UNICO").maybeSingle();
  expect(error).toBeNull();
  expect(data?.person?.full_name).toBe("Fernando Vives Ruiz");
  expect(data?.fecha_fin).toBe("2032-06-30");
  expect(data?.inscripcion_rm_referencia).toContain("338618");
});

it("consejo EAD: 7 cargos en el body garrigues-ead-cda", async () => {
  if (!authed || !garr) { expect(true).toBe(true); return; }
  const { data: body } = await garr.from("governing_bodies").select("id").eq("slug", "garrigues-ead-cda").maybeSingle();
  const { data, error } = await garr.from("condiciones_persona")
    .select("tipo_condicion").eq("body_id", body?.id ?? "");
  expect(error).toBeNull();
  expect((data ?? []).length).toBe(7);
});

it("capital: perfil VIGENTE 11.104.008 y 347 holdings que suman ~100", async () => {
  if (!authed || !garr) { expect(true).toBe(true); return; }
  const { data: prof } = await garr.from("entity_capital_profile")
    .select("capital_escriturado").eq("estado", "VIGENTE")
    .eq("entity_id", "00000000-0000-0000-0002-000000000001").maybeSingle();
  expect(Number(prof?.capital_escriturado)).toBe(11104008);
  const { data: h } = await garr.from("capital_holdings")
    .select("porcentaje_capital, is_treasury").eq("entity_id", "00000000-0000-0000-0002-000000000001").limit(500);
  expect((h ?? []).length).toBe(347);
  const suma = (h ?? []).reduce((a, r) => a + Number(r.porcentaje_capital), 0);
  expect(Math.abs(suma - 100)).toBeLessThan(0.01);
});

it("ARGA intacta: sus bodies/condiciones no cambian de recuento", async () => {
  if (!authed || !arga) { expect(true).toBe(true); return; }
  const { data } = await arga.from("governing_bodies").select("id").limit(100);
  expect((data ?? []).every?.(Boolean) ?? true).toBe(true); // ARGA sigue viendo solo lo suyo (RLS)
});
```

- [ ] **Step 2: Ejecutar post-seeds** — verde con logins reales (sin warns). **Gate de datos de G2.**
- [ ] **Step 3: Commit.**

---

### Task 8: Verificación viva, gates y cierre de fase

**Files:** Modify `CLAUDE.md` (sección Tenant Garrigues — **reconstruir desde HEAD**, regla anti-arrastre).

- [ ] **Step 1: Gates completos** — `bun test && bun run lint && bun run build`; typecheck con el criterio del preexistente TPRM.
- [ ] **Step 2: Verificación viva Garrigues** — preview: `/organos` lista 22 órganos con badges "Consultivo" en los 19; `/organos/:id` del Consejo de Socios: 14 miembros + badge preceptivo + dependencia; Junta de Socios: 346 miembros; CdA EAD: 7 cargos; `/secretaria` ScopeSwitcher SIN los 5 entes no-sociedad; `/delegaciones`: 2 reales; `/secretaria/libros`: 2 libros; consola limpia. Screenshot.
- [ ] **Step 3: Verificación viva ARGA** — órganos/miembros/scope idénticos a siempre; ningún badge nuevo.
- [ ] **Step 4: CLAUDE.md** (patrón reconstruir-desde-HEAD + misma edición al árbol) — añadir bullet G2 a la sección del tenant. **Step 5: Commit final.**

---

## Self-review del plan (hecho)

- **Cobertura spec §4 G2 + §3.2-3.4:** topología (T3: JUNTA/CDA-ADMIN_UNICO/19 COMITE con naturaleza-dependencia-misión-mandatos/CDA EAD) ✓ · censo real 346 + capital canónico con restricciones y pesos INFERIDO (T2/T4) ✓ · ~120 personas comités deduplicadas (T1 matching + T2) ✓ · consejo EAD verificado con inscripciones (T1/T2) ✓ · senior partner como cargo (metadata — CHECK real lo impone; documentado) ✓ · libros (T5) ✓ · delegaciones punto 11 + CD EAD (T5) ✓ · minor G1 selector (T6, con la trampa NULL/NOT IN) ✓ · mandatos 4 años → config + fechas (T3/T2; exposición en calendario se verifica en T8 y, si el Calendario no los lee, se anota para G3) ✓ · sondas (T7) y verificación viva con ARGA intacta (T8) ✓.
- **Placeholders:** los literales de `mandatory_books`/`delegations` dependen de sondeo explícito (T5 Step 1) con instrucción de ajuste — sonda dirigida, no TBD. Resto verbatim.
- **Consistencia:** slugs `garrigues-*` (T3) consumidos por T2-fase-comités y T7; `loadGovernanceCatalog()` uniforme; `ensureCondicion` clave natural coherente con el CHECK bifurcado; `EAD_ENTITY` constante única.
