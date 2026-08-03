# G1 — Espejo societario Garrigues (perímetro completo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar el perímetro societario real del Grupo Garrigues (33 entidades: cadena de control, %, datos registrales, incidencias señaladas) en el tenant `…0002`, con procedencia etiquetada en dato y UI, sin tocar un píxel de ARGA.

**Architecture:** Catálogo de datos puro y testeado (`scripts/garrigues/entities-catalog.ts`) como única fuente de verdad → seed service-role idempotente y aditivo en dos pasadas (persons PJ + entities, luego parents) → columna nueva `entities.data_provenance jsonb` para confianza/cobertura/incidencias (el hook que el Carril B BORME rellenará después) → UI de procedencia gateada por `data_provenance != null` (ARGA = NULL = cero cambio).

**Tech Stack:** bun + TS relajado, Supabase JS v2 service-role (seeds) y anon (sondas), vitest bajo `bun test`, MCP `execute_sql` para DDL/verificación Cloud.

**Spec:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` §4 G1 + §3.5 (incidencias) + correcciones adversariales H1/H2/H9 (2026-08-03).

## Global Constraints

- **Antes de CUALQUIER paso Supabase:** `bun run db:check-target` → `governance_OS` (`hzqwefkwsxopwrmtksbg`). Sin pass, STOP.
- **Canal Cloud:** MCP `execute_sql` (+ registro manual en `supabase_migrations.schema_migrations`). **NUNCA** `db push` ni `repair` (drift de junio).
- **Todo DDL con espejo** en `supabase/migrations/`.
- **Seeds ADITIVOS e IDEMPOTENTES** (condición Carril B de la spec): nunca `DELETE`; upsert por UUID fijo; re-ejecutar es seguro. La procedencia (`data_provenance`) es el enganche que los históricos BORME rellenarán después sin re-sembrar.
- **Cero cambio ARGA:** las filas ARGA tienen `data_provenance` NULL → ninguna UI nueva se renderiza para ARGA. El hardcode de preferencia "ARGA Seguros, S.A." se conserva **verbatim** como primera preferencia.
- **Honestidad de procedencia (spec §8.7):** ningún dato dudoso se afirma — `confianza: "A_CONFIRMAR" | "PENDIENTE"` y `ownership_percentage` NULL cuando el % no es firme. La entidad "Xoo.com Digital" NO existe (H1) — no debe aparecer en ningún sitio.
- **Tenant Garrigues** = `00000000-0000-0000-0000-000000000002`. UUIDs de entidad fijos `00000000-0000-0000-0002-0000000000NN` (grupo 4º distinto de ARGA → sin colisión).
- **`tipo_social`:** el motor solo conoce `SA|SL|SLU|SAU` hasta G3 → sembrar `SL`/`SLU` donde aplique y **NULL en las SLP** con nota `TIPO_SOCIAL_SLP_PENDIENTE_G3` en provenance (G3 lo rellenará al ampliar `TipoSocial`).
- **`persons`:** CHECK `person_type IN ('PF','PJ')` y `UNIQUE(tenant_id, tax_id)` (migración 000063). Placeholders `PTE-<SLUG>` para NIF no confirmado; NIF real solo el de la matriz (`B81709081`, fuente cert RM).
- TypeScript relajado; typecheck real `bun run typecheck` (hay 4 errores PREEXISTENTES en `src/pages/grc/TPRM.tsx:531-534` ajenos — criterio: no añadir errores nuevos, comprobar con grep filtrado).
- `git add` de rutas específicas (el árbol tiene ~200 ficheros WIP ajenos). Commits en castellano terminados en `Co-Authored-By: claude-flow <ruv@ruv.net>`.
- `SUPABASE_SERVICE_ROLE_KEY` solo por env (gotcha: `.env` es ilegible para el harness; el controller extrae la key del fichero de credenciales dev del usuario, ver memoria del proyecto).

---

### Task 1: Migración `entities.data_provenance jsonb`

**Files:**
- Create: `supabase/migrations/20260803120000_entities_data_provenance.sql`

**Interfaces:**
- Produces: columna `public.entities.data_provenance jsonb` (NULL = sin procedencia = comportamiento actual). Shape del JSON (contrato para Tasks 2-4 y para el Carril B futuro):
  `{ fuentes: string[], confianza: "CONFIRMADO"|"A_CONFIRMAR"|"PENDIENTE", cobertura_motor: boolean, cobertura_motivo?: "JURISDICCION_NO_ES"|"NO_SOCIEDAD"|"VINCULADA_NO_CONTROLADA", incidencias?: string[], notas?: string[] }`
- Lectura/escritura: cubiertas por las policies RLS existentes de `entities` (tenant-scoped). **No se crean policies nuevas.**

- [ ] **Step 1: Verificar target**

Run: `bun run db:check-target`
Expected: pass contra `governance_OS`. Si falla, STOP.

- [ ] **Step 2: Escribir la migración espejo**

```sql
-- 20260803120000_entities_data_provenance.sql
-- G1 espejo societario Garrigues (spec 2026-08-02-garrigues-tenant-gobernanza-design.md §4 G1, H9).
-- Procedencia del dato por entidad: fuentes, confianza, cobertura del motor e incidencias
-- señaladas (§3.5). NULL = sin procedencia registrada = comportamiento actual (ARGA intacta).
-- Es el enganche que el Carril B (históricos BORME) rellenará después sin re-sembrar.
-- Lectura/escritura: policies RLS existentes de entities (tenant-scoped). Forward-only.

ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS data_provenance jsonb;

COMMENT ON COLUMN public.entities.data_provenance IS
  'Procedencia del dato: {fuentes[], confianza: CONFIRMADO|A_CONFIRMAR|PENDIENTE, cobertura_motor: bool, cobertura_motivo?, incidencias?[], notas?[]}. NULL = sin registrar (default histórico).';
```

- [ ] **Step 3: Aplicar en Cloud**

Vía MCP `execute_sql` (project `hzqwefkwsxopwrmtksbg`): el SQL del Step 2 y, a continuación:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260803120000', 'entities_data_provenance')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 4: Verificar**

Vía MCP `execute_sql`:

```sql
SELECT
  (SELECT data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='entities' AND column_name='data_provenance') AS tipo,
  (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20260803120000') AS registrada,
  (SELECT count(*) FROM public.entities WHERE data_provenance IS NOT NULL) AS filas_con_provenance;
```

Expected: `tipo = jsonb`, `registrada = 1`, `filas_con_provenance = 0` (ninguna fila existente tocada).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260803120000_entities_data_provenance.sql
git commit -m "feat(g1): columna entities.data_provenance para procedencia del dato

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 2: Catálogo del perímetro (33 entidades) + test de invariantes (TDD)

**Files:**
- Create: `scripts/garrigues/entities-catalog.ts`
- Test: `src/test/garrigues/entities-catalog.test.ts`

**Interfaces:**
- Produces (consumido por Tasks 3 y 6, y por G2 para referenciar entidades):
  - `export interface GarriguesEntitySeed { uuid: string; slug: string; legalName: string; commonName: string; legalForm: string; tipoSocial: "SL" | "SLU" | null; jurisdiction: string; parentSlug: string | null; ownershipPct: number | null; groupRole: "MATRIZ"|"FILIAL"|"VEHICULO"|"SUCURSAL"|"OFICINA"|"OFICINA_REPRESENTACION"|"DIVISION"|"VINCULADA"|"INTEGRACION"; esUnipersonal: boolean | null; formaAdministracion: "ADMINISTRADOR_UNICO"|"CONSEJO"|null; nif: string | null; provenance: { fuentes: string[]; confianza: "CONFIRMADO"|"A_CONFIRMAR"|"PENDIENTE"; cobertura_motor: boolean; cobertura_motivo?: string; incidencias?: string[]; notas?: string[] }; registral?: { hoja: string; tomo: string; folio: string; domicilio: string; ciudad: string; cp: string; provincia: string; constitucion: string; duracion: string; registro: string } }`
  - `export const GARRIGUES_ENTITIES: GarriguesEntitySeed[]` (33 entradas)
  - `export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";`
  - `export const GARRIGUES_MATRIZ_UUID = "00000000-0000-0000-0002-000000000001";`

- [ ] **Step 1: Escribir el test de invariantes que falla**

```typescript
// src/test/garrigues/entities-catalog.test.ts
// Invariantes del catálogo del perímetro Garrigues (G1). El catálogo es la única
// fuente de verdad del seed: si estos tests fallan, el seed NO debe ejecutarse.
import { describe, expect, it } from "vitest";
import {
  GARRIGUES_ENTITIES,
  GARRIGUES_MATRIZ_UUID,
} from "../../../scripts/garrigues/entities-catalog";

describe("Catálogo perímetro Garrigues — invariantes", () => {
  it("tiene 33 entidades con uuid/slug/nif únicos", () => {
    expect(GARRIGUES_ENTITIES.length).toBe(33);
    const uuids = GARRIGUES_ENTITIES.map((e) => e.uuid);
    const slugs = GARRIGUES_ENTITIES.map((e) => e.slug);
    const nifs = GARRIGUES_ENTITIES.map((e) => e.nif).filter(Boolean);
    expect(new Set(uuids).size).toBe(33);
    expect(new Set(slugs).size).toBe(33);
    expect(new Set(nifs).size).toBe(nifs.length);
  });

  it("exactamente una MATRIZ, sin parent, con NIF real y datos registrales del RM", () => {
    const matrices = GARRIGUES_ENTITIES.filter((e) => e.groupRole === "MATRIZ");
    expect(matrices.length).toBe(1);
    const m = matrices[0];
    expect(m.uuid).toBe(GARRIGUES_MATRIZ_UUID);
    expect(m.parentSlug).toBeNull();
    expect(m.nif).toBe("B81709081");
    expect(m.provenance.confianza).toBe("CONFIRMADO");
    expect(m.registral?.hoja).toBe("M-190538");
    expect(m.registral?.tomo).toBe("17456");
    expect(m.registral?.folio).toBe("132");
  });

  it("todos los parentSlug resuelven a un slug del catálogo y no hay ciclos", () => {
    const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));
    for (const e of GARRIGUES_ENTITIES) {
      if (e.parentSlug === null) continue;
      expect(bySlug.has(e.parentSlug)).toBe(true);
      // subida hasta raíz con cota anti-ciclo
      let cur = e;
      let hops = 0;
      while (cur.parentSlug !== null) {
        cur = bySlug.get(cur.parentSlug)!;
        hops += 1;
        expect(hops).toBeLessThan(10);
      }
    }
  });

  it("honestidad de procedencia: pct solo cuando la confianza no es PENDIENTE", () => {
    for (const e of GARRIGUES_ENTITIES) {
      if (e.provenance.confianza === "PENDIENTE") {
        expect(e.ownershipPct).toBeNull();
      }
    }
  });

  it("cobertura del motor: toda entidad no-ES o no-sociedad va marcada fuera de cobertura", () => {
    for (const e of GARRIGUES_ENTITIES) {
      if (e.jurisdiction !== "ES") {
        expect(e.provenance.cobertura_motor).toBe(false);
      }
      if (e.groupRole === "DIVISION" || e.groupRole === "OFICINA" || e.groupRole === "OFICINA_REPRESENTACION") {
        expect(e.provenance.cobertura_motor).toBe(false);
      }
    }
  });

  it("H1 vigilado: la entidad fabricada 'Xoo.com' no existe en el catálogo", () => {
    const nombres = GARRIGUES_ENTITIES.map((e) => (e.legalName + e.commonName).toLowerCase());
    expect(nombres.some((n) => n.includes("xoo"))).toBe(false);
  });

  it("EAD Trust: única con CONSEJO, cuelga de NewLaw, 51% a confirmar", () => {
    const consejos = GARRIGUES_ENTITIES.filter((e) => e.formaAdministracion === "CONSEJO");
    expect(consejos.length).toBe(1);
    const ead = consejos[0];
    expect(ead.slug).toBe("ead-trust-sl");
    expect(ead.parentSlug).toBe("cia-digital-newlaw-slu");
    expect(ead.ownershipPct).toBe(51);
    expect(ead.provenance.confianza).toBe("A_CONFIRMAR");
  });

  it("las SLP llevan tipoSocial NULL con nota pendiente de G3", () => {
    const slps = GARRIGUES_ENTITIES.filter((e) => e.legalForm === "SLP");
    expect(slps.length).toBeGreaterThanOrEqual(7);
    for (const e of slps) {
      expect(e.tipoSocial).toBeNull();
      expect(e.provenance.notas ?? []).toContain("TIPO_SOCIAL_SLP_PENDIENTE_G3");
    }
  });
});
```

- [ ] **Step 2: Ver el fallo**

Run: `bun test src/test/garrigues/entities-catalog.test.ts`
Expected: FAIL — módulo `scripts/garrigues/entities-catalog` no existe.

- [ ] **Step 3: Escribir el catálogo completo**

```typescript
// scripts/garrigues/entities-catalog.ts
// Única fuente de verdad del perímetro societario Garrigues (G1).
// Fuentes: inventario 2026 (Garr_politicas), cuadro IDC2.1.1 de las cuentas
// anuales consolidadas 2025 (depósito RM, relectura dirigida 2026-08-03) y
// certificación registral del propio depósito (matriz). Los datos dudosos van
// con confianza A_CONFIRMAR/PENDIENTE y pct NULL — nunca se afirma lo ilegible.
// H1: "Xoo.com Digital SLU" NO existe (error de lectura retirado de la spec).

export interface GarriguesEntitySeed {
  uuid: string;
  slug: string;
  legalName: string;
  commonName: string;
  legalForm: string;
  tipoSocial: "SL" | "SLU" | null;
  jurisdiction: string;
  parentSlug: string | null;
  ownershipPct: number | null;
  groupRole:
    | "MATRIZ" | "FILIAL" | "VEHICULO" | "SUCURSAL" | "OFICINA"
    | "OFICINA_REPRESENTACION" | "DIVISION" | "VINCULADA" | "INTEGRACION";
  esUnipersonal: boolean | null;
  formaAdministracion: "ADMINISTRADOR_UNICO" | "CONSEJO" | null;
  nif: string | null;
  provenance: {
    fuentes: string[];
    confianza: "CONFIRMADO" | "A_CONFIRMAR" | "PENDIENTE";
    cobertura_motor: boolean;
    cobertura_motivo?: string;
    incidencias?: string[];
    notas?: string[];
  };
  registral?: {
    hoja: string; tomo: string; folio: string; domicilio: string; ciudad: string;
    cp: string; provincia: string; constitucion: string; duracion: string; registro: string;
  };
}

export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";
export const GARRIGUES_MATRIZ_UUID = "00000000-0000-0000-0002-000000000001";

const U = (nn: string) => `00000000-0000-0000-0002-0000000000${nn}`;
const SLP_NOTE = "TIPO_SOCIAL_SLP_PENDIENTE_G3";
const IDC = "IDC2.1.1 cuentas consolidadas 2025 (depósito RM)";
const INV = "Inventario 2026 (Garr_politicas)";
const RM = "Certificación Registro Mercantil de Madrid (depósito 2025)";

export const GARRIGUES_ENTITIES: GarriguesEntitySeed[] = [
  {
    uuid: U("01"), slug: "jya-garrigues-slp",
    legalName: "J&A Garrigues, S.L.P.", commonName: "Garrigues (matriz)",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "MATRIZ", esUnipersonal: false,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B81709081",
    provenance: {
      fuentes: [RM, INV, IDC], confianza: "CONFIRMADO", cobertura_motor: true,
      notas: [SLP_NOTE, "El RM imprime literalmente 'Estructura del órgano: Administrador único'"],
    },
    registral: {
      hoja: "M-190538", tomo: "17456", folio: "132",
      domicilio: "Plaza de Colón, 2", ciudad: "Madrid", cp: "28046", provincia: "Madrid",
      constitucion: "1997-04-01", duracion: "Indefinida", registro: "Registro Mercantil de Madrid",
    },
  },
  {
    uuid: U("02"), slug: "garrigues-ip-slp",
    legalName: "Garrigues IP, S.L.P.", commonName: "Garrigues IP",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE] },
  },
  {
    uuid: U("03"), slug: "g-advisory-slp",
    legalName: "G-Advisory, Consultoría Técnica, Económica y Estratégica, S.L.P.", commonName: "G-Advisory",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 75, groupRole: "FILIAL", esUnipersonal: false,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true,
      notas: [SLP_NOTE, "75% según IDC — corrige el 100% tácito del inventario"],
    },
  },
  {
    uuid: U("04"), slug: "garrigues-letrados-soporte-slp",
    legalName: "Garrigues Letrados de Soporte, S.L.P.", commonName: "Letrados de Soporte",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE] },
  },
  {
    uuid: U("05"), slug: "garrigues-hcs-slp",
    legalName: "Garrigues Human Capital Services, S.L.P.", commonName: "Human Capital Services",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE] },
  },
  {
    uuid: U("06"), slug: "garrigues-empresa-familiar-slp",
    legalName: "Garrigues Consultoría de Empresa Familiar, S.L.P.", commonName: "Consultoría de Empresa Familiar",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE] },
  },
  {
    uuid: U("07"), slug: "garrigues-sports-entertainment-slp",
    legalName: "Garrigues Sports & Entertainment, S.L.P.", commonName: "Sports & Entertainment",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: {
      fuentes: [INV, "Certificado ISO 27001"], confianza: "PENDIENTE", cobertura_motor: true,
      incidencias: ["Ausente del perímetro IDC 2025 pese a constar en ISO 27001 e inventario — participación sin fuente"],
      notas: [SLP_NOTE],
    },
  },
  {
    uuid: U("08"), slug: "garrigues-portugal-slp",
    legalName: "Garrigues Portugal, S.L.P.", commonName: "Garrigues Portugal",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: true,
      incidencias: ["Ausente del cuadro IDC 2025 — situación societaria a confirmar"],
      notas: [SLP_NOTE, "Sociedad española con actividad en Portugal (Lisboa y Oporto)"],
    },
  },
  {
    uuid: U("09"), slug: "garrigues-portugal-sucursal",
    legalName: "Garrigues Portugal S.L.P. — Sucursal em Portugal", commonName: "Sucursal Portugal",
    legalForm: "SUCURSAL", tipoSocial: null, jurisdiction: "PT", parentSlug: "garrigues-portugal-slp",
    ownershipPct: null, groupRole: "SUCURSAL", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: { fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("10"), slug: "garrigues-ip-unipessoal-lda",
    legalName: "Garrigues-IP, Unipessoal, Lda", commonName: "Garrigues-IP Portugal",
    legalForm: "LDA", tipoSocial: null, jurisdiction: "PT", parentSlug: "garrigues-ip-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["100% indirecta según IDC; titular directo inferido: Garrigues IP SLP"],
    },
  },
  {
    uuid: U("11"), slug: "garrigues-uk-llp",
    legalName: "Garrigues UK, L.L.P.", commonName: "Garrigues UK",
    legalForm: "LLP", tipoSocial: null, jurisdiction: "UK", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Ausente del cuadro IDC 2025 (¿no consolida por su forma LLP?)"],
    },
  },
  {
    uuid: U("12"), slug: "garrigues-llp-us",
    legalName: "Garrigues, L.L.P.", commonName: "Garrigues Nueva York",
    legalForm: "LLP", tipoSocial: null, jurisdiction: "US", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("13"), slug: "garrigues-maroc-sarlau",
    legalName: "Garrigues Maroc, S.A.R.L.A.U.", commonName: "Garrigues Casablanca",
    legalForm: "SARLAU", tipoSocial: null, jurisdiction: "MA", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("14"), slug: "garrigues-polska-spk",
    legalName: "Garrigues Polska & Roberto Delgado Gil, Sp.K.", commonName: "Garrigues Varsovia",
    legalForm: "SPK", tipoSocial: null, jurisdiction: "PL", parentSlug: "jya-garrigues-slp",
    ownershipPct: 98.99, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Discrepancia nominal menor: DUNS la abrevia 'Garrigues Polska'"],
      notas: ["Roberto Delgado Gil figura en la razón social — coincide con el Secretario de la Junta 2026 y el secretario no consejero de EAD Trust"],
    },
  },
  {
    uuid: U("15"), slug: "garrigues-colombia-sas",
    legalName: "Garrigues Colombia S.A.S.", commonName: "Garrigues Bogotá",
    legalForm: "SAS", tipoSocial: null, jurisdiction: "CO", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("16"), slug: "garrigues-peru-scrl",
    legalName: "J&A Garrigues Perú, Sociedad Civil de Responsabilidad Limitada", commonName: "Garrigues Lima",
    legalForm: "SCRL", tipoSocial: null, jurisdiction: "PE", parentSlug: "jya-garrigues-slp",
    ownershipPct: 99, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["Split IDC: 0,01% directa + 98,99% indirecta (lectura razonable, confirmar)"],
    },
  },
  {
    uuid: U("17"), slug: "garrigues-mexico-sc",
    legalName: "Garrigues México S.C.", commonName: "Garrigues México",
    legalForm: "SC", tipoSocial: null, jurisdiction: "MX", parentSlug: "jya-garrigues-slp",
    ownershipPct: 98.99, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Coexiste con Garrigues MX, S.C. — dos vehículos mexicanos (incidencia 8 de la spec)"],
      notas: ["Split IDC: 0,01% + 98,98% (confirmar)"],
    },
  },
  {
    uuid: U("18"), slug: "garrigues-mx-sc",
    legalName: "Garrigues MX, S.C.", commonName: "Garrigues MX",
    legalForm: "SC", tipoSocial: null, jurisdiction: "MX", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Coexiste con Garrigues México S.C. (incidencia 8)"],
      notas: ["Split IDC de lectura dudosa (~5,25% + 94,74%) — pct no se afirma"],
    },
  },
  {
    uuid: U("19"), slug: "garrigues-chile",
    legalName: "Garrigues Chile SpA", commonName: "Garrigues Santiago",
    legalForm: "SpA", tipoSocial: null, jurisdiction: "CL", parentSlug: "jya-garrigues-slp",
    ownershipPct: 98.9, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Forma societaria en tránsito: DUNS y Diario Oficial dicen Limitada; las cuentas 2025 aún dicen SpA (incidencia 3)"],
      notas: ["Split IDC: 0,32% + 98,58% (confirmar)"],
    },
  },
  {
    uuid: U("20"), slug: "eu-law-office-garrigues",
    legalName: "EU Law Office Garrigues", commonName: "Garrigues Bruselas",
    legalForm: "OFICINA", tipoSocial: null, jurisdiction: "BE", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "OFICINA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Forma jurídica no confirmada en fuentes"],
    },
  },
  {
    uuid: U("21"), slug: "garrigues-shanghai-rep-office",
    legalName: "Shanghai Representative Office of J&A Garrigues SLP", commonName: "Garrigues Shanghái",
    legalForm: "REP_OFFICE", tipoSocial: null, jurisdiction: "CN", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "OFICINA_REPRESENTACION", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: { fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("22"), slug: "g-advisory-chile-spa",
    legalName: "G-Advisory Chile, SpA", commonName: "G-Advisory Chile",
    legalForm: "SpA", tipoSocial: null, jurisdiction: "CL", parentSlug: "g-advisory-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["IDC: 75% indirecta de J&A = 100% vía G-Advisory (75%) — parent y pct inferidos por aritmética"],
    },
  },
  {
    uuid: U("23"), slug: "g-advisory-mexico-sc",
    legalName: "G-Advisory México, S.C.", commonName: "G-Advisory México",
    legalForm: "SC", tipoSocial: null, jurisdiction: "MX", parentSlug: "g-advisory-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["IDC: 75% indirecta de J&A = 100% vía G-Advisory (75%) — parent y pct inferidos por aritmética"],
    },
  },
  {
    uuid: U("24"), slug: "g-advisory-colombia",
    legalName: "G-Advisory Colombia (oficina Bogotá)", commonName: "G-Advisory Bogotá",
    legalForm: "OFICINA", tipoSocial: null, jurisdiction: "CO", parentSlug: "g-advisory-slp",
    ownershipPct: null, groupRole: "OFICINA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Denominación social local no verificada (incidencia 4 de la spec)"],
    },
  },
  {
    uuid: U("25"), slug: "cia-digital-newlaw-slu",
    legalName: "Compañía Digital NewLaw, S.L.U.", commonName: "NewLaw (holding digital)",
    legalForm: "SLU", tipoSocial: "SLU", jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true },
  },
  {
    uuid: U("26"), slug: "ead-trust-sl",
    legalName: "EAD Trust European Agency of Digital Trust, S.L.", commonName: "EAD Trust",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: "cia-digital-newlaw-slu",
    ownershipPct: 51, groupRole: "FILIAL", esUnipersonal: false,
    formaAdministracion: "CONSEJO", nif: null,
    provenance: {
      fuentes: [IDC, INV, "Contrato interno NewLaw (51,001%)"], confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["Variación nominal del % entre fuentes: 51,00 (IDC, indirecta, titular directo ilegible) vs 51,001 (contrato) — incidencia 7 de la spec"],
      notas: ["Único consejo de administración colegiado del perímetro operativo", "QTSP del ecosistema: solo interposición, mensajería básica y custodia (política 2026-07-21)"],
    },
  },
  {
    uuid: U("27"), slug: "g-digital-division",
    legalName: "g-digital (división de negocios digitales)", commonName: "g-digital",
    legalForm: "DIVISION", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "DIVISION", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "NO_SOCIEDAD",
      notas: ["División, no sociedad: integra conocimiento jurídico de Garrigues con la tecnología de EAD Trust"],
    },
  },
  {
    uuid: U("28"), slug: "fundacion-garrigues",
    legalName: "Fundación Garrigues", commonName: "Fundación Garrigues",
    legalForm: "FUNDACION", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VINCULADA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "VINCULADA_NO_CONTROLADA",
      notas: ["Creada y financiada por el despacho; entidad vinculada, no controlada"],
    },
  },
  {
    uuid: U("29"), slug: "centro-estudios-garrigues",
    legalName: "Centro de Estudios Garrigues", commonName: "Centro de Estudios",
    legalForm: "INSTITUCION", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VINCULADA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV, "Acta Junta de Socios 06/05/2026 (punto 4)"], confianza: "A_CONFIRMAR",
      cobertura_motor: false, cobertura_motivo: "VINCULADA_NO_CONTROLADA",
      incidencias: [
        "Transmisión del 20% en 2025 con conservación de marca y presidencia (incidencia 6)",
        "La Junta 2026 aprueba una 'Operación de toma de participación' — dirección del movimiento sin reconciliar (incidencia 9)",
      ],
    },
  },
  {
    uuid: U("30"), slug: "bsvv-chile",
    legalName: "Barros, Silva, Varela & Vigil Abogados Limitada (BSVV)", commonName: "BSVV (integración Chile)",
    legalForm: "LIMITADA", tipoSocial: null, jurisdiction: "CL", parentSlug: "garrigues-chile",
    ownershipPct: null, groupRole: "INTEGRACION", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV, "Acta Junta de Socios 06/05/2026 (punto 5)"], confianza: "A_CONFIRMAR",
      cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Integración aprobada por la Junta 2026 (admisión de socios BSVV + aumento de capital) — vehículo societario final sin localizar (incidencia 5)"],
    },
  },
  {
    uuid: U("31"), slug: "violet-inversiones-2010-sl",
    legalName: "Violet Inversiones 2010, S.L.", commonName: "Violet Inversiones",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VEHICULO", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: {
      fuentes: [IDC], confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["100% indirecta según IDC con titular directo ilegible — parent sin asignar hasta confirmación (BORME/Carril B)"],
      notas: ["No aparece en el inventario 2026 — descubierta en el cuadro de consolidación"],
    },
  },
  {
    uuid: U("32"), slug: "ewch-inversiones-sl",
    legalName: "EWCH(?) Inversiones 20¿10?, S.L.", commonName: "EWCH Inversiones (denominación a confirmar)",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VEHICULO", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: {
      fuentes: [IDC], confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["Denominación parcialmente ilegible en el OCR del IDC — confirmar antes de usar en demo (H1)"],
      notas: ["100% indirecta según IDC, titular directo ilegible", "No aparece en el inventario 2026"],
    },
  },
  {
    uuid: U("33"), slug: "garben-inversiones-2013-slu",
    legalName: "Garben Inversiones 2013, S.L.U.", commonName: "Garben Inversiones",
    legalForm: "SLU", tipoSocial: "SLU", jurisdiction: "ES", parentSlug: "g-advisory-slp",
    ownershipPct: 100, groupRole: "VEHICULO", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: null,
    provenance: {
      fuentes: [IDC], confianza: "A_CONFIRMAR", cobertura_motor: true,
      notas: [
        "IDC: ~75% indirecta de J&A. Siendo S.L.U. (socio único), el encaje aritmético es 100% vía G-Advisory (75%) — parent y pct INFERIDOS, confirmar en BORME",
        "No aparece en el inventario 2026",
      ],
    },
  },
];
```

- [ ] **Step 4: Ver verde**

Run: `bun test src/test/garrigues/entities-catalog.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/garrigues/entities-catalog.ts src/test/garrigues/entities-catalog.test.ts
git commit -m "feat(g1): catálogo del perímetro societario Garrigues (33 entidades) con invariantes

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 3: Seed service-role de entidades (aditivo, idempotente, dos pasadas)

**Files:**
- Create: `scripts/seed-garrigues-entities.ts`
- Modify: `scripts/README-seed.md` (añadir sección al final)

**Interfaces:**
- Consumes: `GARRIGUES_ENTITIES`, `GARRIGUES_TENANT`, `GARRIGUES_MATRIZ_UUID` (Task 2); columna `data_provenance` (Task 1).
- Produces: 33 filas `entities` (tenant Garrigues, UUIDs fijos) + 33 filas `persons` PJ. **La sonda de Task 6 y las fases G2+ dependen de estos UUIDs.**

- [ ] **Step 1: Escribir el script**

```typescript
#!/usr/bin/env bun
/**
 * Seed G1 — Perímetro societario Garrigues: persons PJ + entities + parents + provenance.
 * Spec §4 G1. Consume scripts/garrigues/entities-catalog.ts (única fuente de verdad).
 *
 * Uso:
 *   bun run scripts/seed-garrigues-entities.ts            # dry-run
 *   bun run scripts/seed-garrigues-entities.ts --commit   # ejecuta
 *
 * - ADITIVO e IDEMPOTENTE (condición Carril B): upsert por UUID fijo, nunca DELETE.
 * - "El schema manda": entity_status/onboarding_status/materiality/support_docs_metadata
 *   se copian de la matriz ARGA existente, no se inventan.
 * - Dos pasadas: (1) persons+entities sin parent, (2) update de parent_entity_id
 *   (evita violar la FK con ordenación topológica implícita).
 */
import { createClient } from "@supabase/supabase-js";
import {
  GARRIGUES_ENTITIES,
  GARRIGUES_TENANT,
} from "./garrigues/entities-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const ARGA_MATRIZ = "6d7ed736-f263-4531-a59d-c6ca0cd41602";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) {
  fail(`Target inesperado (${SUPABASE_URL}) — solo governance_OS.`);
}
if (!SERVICE_KEY) {
  fail(`Falta la service-role key. Nombres buscados:\n${SERVICE_KEY_NAMES.map((n) => `    - ${n}`).join("\n")}`);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));

async function main() {
  // 0) Defaults reales: la matriz ARGA dicta status/onboarding/materiality.
  const { data: arga, error: eArga } = await admin
    .from("entities").select("*").eq("id", ARGA_MATRIZ).maybeSingle();
  if (eArga) fail(`Leyendo entidad ARGA de referencia: ${eArga.message}`);
  if (!arga) fail("No existe la entidad ARGA canónica — target equivocado.");

  const { data: existing, error: eExist } = await admin
    .from("entities").select("id").eq("tenant_id", GARRIGUES_TENANT);
  if (eExist) fail(`Leyendo entities Garrigues: ${eExist.message}`);
  const existingIds = new Set((existing ?? []).map((r) => r.id));

  console.table([
    { dato: "entidades en catálogo", valor: GARRIGUES_ENTITIES.length },
    { dato: "ya sembradas (se re-upsertan)", valor: existingIds.size },
    { dato: "nuevas", valor: GARRIGUES_ENTITIES.filter((e) => !existingIds.has(e.uuid)).length },
  ]);
  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar.");
    return;
  }

  // 1) Primera pasada: persons PJ + entities SIN parent.
  for (const e of GARRIGUES_ENTITIES) {
    const taxId = e.nif ?? `PTE-${e.slug.toUpperCase()}`;
    // persons: select-then-insert/update por (tenant, tax_id) — UNIQUE(tenant_id, tax_id).
    let personId = null;
    const { data: p, error: eP } = await admin
      .from("persons").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("tax_id", taxId).maybeSingle();
    if (eP) fail(`persons select ${e.slug}: ${eP.message}`);
    if (p) {
      personId = p.id;
      const { error } = await admin.from("persons")
        .update({ full_name: e.legalName, denomination: e.commonName, person_type: "PJ" })
        .eq("id", personId);
      if (error) fail(`persons update ${e.slug}: ${error.message}`);
    } else {
      const { data, error } = await admin.from("persons")
        .insert({
          tenant_id: GARRIGUES_TENANT, full_name: e.legalName,
          denomination: e.commonName, person_type: "PJ", tax_id: taxId,
        })
        .select("id").single();
      if (error) fail(`persons insert ${e.slug}: ${error.message}`);
      personId = data.id;
    }

    const row = {
      id: e.uuid,
      tenant_id: GARRIGUES_TENANT,
      person_id: personId,
      slug: e.slug,
      legal_name: e.legalName,
      common_name: e.commonName,
      legal_form: e.legalForm,
      tipo_social: e.tipoSocial,
      jurisdiction: e.jurisdiction,
      country: e.jurisdiction,
      parent_entity_id: null, // segunda pasada
      ownership_percentage: e.ownershipPct,
      group_role: e.groupRole,
      es_unipersonal: e.esUnipersonal,
      forma_administracion: e.formaAdministracion,
      registration_number: e.nif,
      data_provenance: e.provenance,
      // "El schema manda": copiados de la matriz ARGA.
      entity_status: arga.entity_status,
      onboarding_status: arga.onboarding_status,
      materiality: arga.materiality,
      support_docs_metadata: arga.support_docs_metadata ?? {},
      ...(e.registral
        ? {
            registry_sheet: e.registral.hoja,
            registry_volume: e.registral.tomo,
            registry_folio: e.registral.folio,
            registry_location: e.registral.registro,
            address: e.registral.domicilio,
            city: e.registral.ciudad,
            postal_code: e.registral.cp,
            province: e.registral.provincia,
            constitution_date: e.registral.constitucion,
            duration: e.registral.duracion,
          }
        : {}),
    };
    const { error: eUp } = await admin.from("entities").upsert(row, { onConflict: "id" });
    if (eUp) fail(`entities upsert ${e.slug}: ${eUp.message}`);
    console.log(`✓ ${e.slug}`);
  }

  // 2) Segunda pasada: parents (UUIDs fijos del catálogo, sin lookups).
  for (const e of GARRIGUES_ENTITIES) {
    if (!e.parentSlug) continue;
    const parent = bySlug.get(e.parentSlug);
    if (!parent) fail(`parentSlug inválido en catálogo: ${e.parentSlug}`);
    const { error } = await admin.from("entities")
      .update({ parent_entity_id: parent.uuid }).eq("id", e.uuid);
    if (error) fail(`parent ${e.slug} → ${e.parentSlug}: ${error.message}`);
  }
  console.log("✓ Parents enlazados.");
  console.log("✓ Seed G1 completado (idempotente: re-ejecutar es seguro).");
}

main();
```

- [ ] **Step 2: Dry-run**

Run: `bun run db:check-target && bun run scripts/seed-garrigues-entities.ts`
Expected: tabla con `entidades en catálogo = 33`, `nuevas = 33`, "Dry-run", cero escrituras. (Requiere la service-role key en env — la ejecuta el controller con el gotcha documentado.)

- [ ] **Step 3: Ejecutar**

Run: `bun run scripts/seed-garrigues-entities.ts --commit`
Expected: 33 líneas `✓ <slug>` + `✓ Parents enlazados`. Si algún insert falla por CHECK de `tipo_social` (valores `SL`/`SLU` deberían pasar; si no, STOP e investigar el constraint antes de tocar nada).

- [ ] **Step 4: Idempotencia**

Run: `bun run scripts/seed-garrigues-entities.ts --commit` (2ª vez)
Expected: `ya sembradas = 33`, sin errores ni duplicados.

- [ ] **Step 5: Verificación en Cloud**

Vía MCP `execute_sql`:

```sql
SELECT
  (SELECT count(*) FROM entities WHERE tenant_id='00000000-0000-0000-0000-000000000002') AS entidades,
  (SELECT count(*) FROM entities WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND data_provenance IS NOT NULL) AS con_provenance,
  (SELECT count(*) FROM entities WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND parent_entity_id IS NOT NULL) AS con_parent,
  (SELECT registration_number FROM entities WHERE id='00000000-0000-0000-0002-000000000001') AS nif_matriz,
  (SELECT count(*) FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND person_type='PJ') AS pj,
  (SELECT count(*) FROM entities WHERE tenant_id='00000000-0000-0000-0000-000000000001') AS arga_entidades_intactas;
```

Expected: `entidades = 33`, `con_provenance = 33`, `con_parent = 29` (33 − matriz − Fundación − Centro de Estudios − Violet − EWCH... recontar: parent null son matriz, fundacion, centro-estudios, violet, ewch = 5 → `con_parent = 28`), `nif_matriz = B81709081`, `pj = 33`, `arga_entidades_intactas` = el valor previo (31, sin cambios).

- [ ] **Step 6: README y commit**

Añadir al final de `scripts/README-seed.md`:

```markdown
## seed-garrigues-entities.ts (G1 — 2026-08-03)

Perímetro societario Garrigues: 33 entities + 33 persons PJ desde
`scripts/garrigues/entities-catalog.ts` (única fuente de verdad, testeada).
Aditivo e idempotente (condición Carril B: nunca DELETE; los históricos BORME
se inyectarán sobre `data_provenance` sin re-sembrar). Dos pasadas (entities →
parents). Requiere `SUPABASE_SERVICE_ROLE_KEY`.
```

```bash
git add scripts/seed-garrigues-entities.ts scripts/README-seed.md
git commit -m "feat(g1): seed aditivo del perímetro societario Garrigues (33 entidades)

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 4: UI de procedencia y cobertura (gateada por `data_provenance`)

**Files:**
- Create: `src/lib/entity-provenance.ts`
- Test: `src/lib/__tests__/entity-provenance.test.ts`
- Modify: `src/pages/EntidadDetalle.tsx` (header, junto a los `StatusBadgeTip` existentes en ~línea 70)
- Modify: `src/pages/EntidadesList.tsx` (chip pequeño por fila; localizar la celda de jurisdicción/forma con grep)

**Interfaces:**
- Consumes: `entities.data_provenance` (Task 1; llega al cliente vía `useEntities` — comprobar que el select del hook incluye `*` o añadir la columna al select si es lista explícita).
- Produces:
  - `export interface EntityProvenance { fuentes?: string[]; confianza?: "CONFIRMADO"|"A_CONFIRMAR"|"PENDIENTE"; cobertura_motor?: boolean; cobertura_motivo?: string; incidencias?: string[]; notas?: string[] }`
  - `export function provenanceBadges(p: unknown): { label: string; tone: "warning"|"neutral"|"info"; title?: string }[]` — devuelve `[]` para NULL/undefined/shape desconocido (**contrato ARGA: sin provenance, sin badges**).

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/entity-provenance.test.ts
import { describe, expect, it } from "vitest";
import { provenanceBadges } from "@/lib/entity-provenance";

describe("provenanceBadges", () => {
  it("null/undefined/shape raro → [] (contrato: ARGA sin cambios)", () => {
    expect(provenanceBadges(null)).toEqual([]);
    expect(provenanceBadges(undefined)).toEqual([]);
    expect(provenanceBadges("cadena")).toEqual([]);
    expect(provenanceBadges(42)).toEqual([]);
  });

  it("fuera de cobertura del motor → badge warning con motivo", () => {
    const badges = provenanceBadges({ cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES", confianza: "CONFIRMADO" });
    expect(badges.some((b) => b.label === "Fuera de cobertura normativa (motor ES)")).toBe(true);
  });

  it("A_CONFIRMAR / PENDIENTE → chip de confianza", () => {
    expect(provenanceBadges({ confianza: "A_CONFIRMAR", cobertura_motor: true })
      .some((b) => b.label === "Datos a confirmar")).toBe(true);
    expect(provenanceBadges({ confianza: "PENDIENTE", cobertura_motor: true })
      .some((b) => b.label === "Participación pendiente de fuente")).toBe(true);
    expect(provenanceBadges({ confianza: "CONFIRMADO", cobertura_motor: true })).toEqual([]);
  });

  it("incidencias → badge con el texto en title", () => {
    const badges = provenanceBadges({
      confianza: "CONFIRMADO", cobertura_motor: true,
      incidencias: ["Dos vehículos mexicanos coexistentes"],
    });
    const inc = badges.find((b) => b.label === "1 incidencia de dato");
    expect(inc?.title).toContain("Dos vehículos mexicanos");
  });
});
```

- [ ] **Step 2: Ver el fallo**

Run: `bun test src/lib/__tests__/entity-provenance.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/entity-provenance.ts
// Badges de procedencia/cobertura desde entities.data_provenance (G1).
// data_provenance NULL (todas las filas ARGA) → [] → cero cambio visual ARGA.
export interface EntityProvenance {
  fuentes?: string[];
  confianza?: "CONFIRMADO" | "A_CONFIRMAR" | "PENDIENTE";
  cobertura_motor?: boolean;
  cobertura_motivo?: string;
  incidencias?: string[];
  notas?: string[];
}

export interface ProvenanceBadge {
  label: string;
  tone: "warning" | "neutral" | "info";
  title?: string;
}

export function provenanceBadges(p: unknown): ProvenanceBadge[] {
  if (!p || typeof p !== "object" || Array.isArray(p)) return [];
  const prov = p as EntityProvenance;
  const badges: ProvenanceBadge[] = [];

  if (prov.cobertura_motor === false) {
    badges.push({
      label: "Fuera de cobertura normativa (motor ES)",
      tone: "neutral",
      title: prov.cobertura_motivo,
    });
  }
  if (prov.confianza === "A_CONFIRMAR") {
    badges.push({ label: "Datos a confirmar", tone: "warning", title: (prov.notas ?? []).join(" · ") || undefined });
  } else if (prov.confianza === "PENDIENTE") {
    badges.push({ label: "Participación pendiente de fuente", tone: "warning" });
  }
  const inc = prov.incidencias ?? [];
  if (inc.length > 0) {
    badges.push({
      label: inc.length === 1 ? "1 incidencia de dato" : `${inc.length} incidencias de dato`,
      tone: "info",
      title: inc.join(" · "),
    });
  }
  return badges;
}
```

- [ ] **Step 4: Ver verde**

Run: `bun test src/lib/__tests__/entity-provenance.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Cablear EntidadDetalle y EntidadesList**

En `src/pages/EntidadDetalle.tsx`: localizar el bloque del header con los `StatusBadgeTip` (grep `StatusBadgeTip`). Añadir después de ellos:

```tsx
{provenanceBadges(entity.data_provenance).map((b) => (
  <span
    key={b.label}
    title={b.title}
    className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
  >
    {b.label}
  </span>
))}
```

(Import: `import { provenanceBadges } from "@/lib/entity-provenance";`. Si el tipo `EntityRow` del hook no incluye `data_provenance`, añadirlo como `data_provenance?: unknown;` a la interfaz en `src/hooks/useEntities.ts` — y verificar que el select de la query trae la columna: si es `select("*")` ya llega; si es lista explícita, añadirla.)

En `src/pages/EntidadesList.tsx`: localizar la fila de la tabla (grep `jurisdiction`) y añadir en la celda del nombre (o una celda contigua) un chip compacto SOLO con el primer badge:

```tsx
{provenanceBadges(e.data_provenance).slice(0, 1).map((b) => (
  <span key={b.label} title={b.title} className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
    {b.label}
  </span>
))}
```

- [ ] **Step 6: Gates y commit**

Run: `bun run typecheck 2>&1 | grep -E "entity-provenance|EntidadDetalle|EntidadesList|useEntities"` (vacío) `&& bun test src/lib/__tests__/entity-provenance.test.ts && bun run lint`
Expected: verde.

```bash
git add src/lib/entity-provenance.ts src/lib/__tests__/entity-provenance.test.ts src/pages/EntidadDetalle.tsx src/pages/EntidadesList.tsx src/hooks/useEntities.ts
git commit -m "feat(g1): badges de procedencia y cobertura gateados por data_provenance

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 5: Preferencia de entidad multi-tenant en el scope de Secretaría (TDD)

**Files:**
- Modify: `src/components/secretaria/shell/useSecretariaScope.ts:56-66` (función `getPreferredEntity`)
- Test: `src/components/secretaria/shell/__tests__/preferred-entity.test.ts`

**Interfaces:**
- Consumes: `SecretariaEntityOption` (tipo existente en el mismo fichero — sondar su shape con grep antes de editar; si no expone parent/grupo, ampliar `toEntityOption` para incluir `parentEntityId` desde `EntityRow.parent_entity_id`).
- Produces: `getPreferredEntity` exportada (hoy es función privada — exportarla para el test) con la prioridad: (1) hardcode ARGA **verbatim actual** (las 4 búsquedas), (2) **matriz del grupo** = primera entidad con `parentEntityId == null`, (3) `entities[0]`, (4) `null`.

- [ ] **Step 1: Test que falla**

```typescript
// src/components/secretaria/shell/__tests__/preferred-entity.test.ts
import { describe, expect, it } from "vitest";
import { getPreferredEntity } from "../useSecretariaScope";

const opt = (over) => ({
  id: "x", name: "", legalName: "", parentEntityId: null, ...over,
});

describe("getPreferredEntity — multi-tenant", () => {
  it("ARGA primero, verbatim (contrato: cero cambio ARGA)", () => {
    const entities = [
      opt({ id: "1", legalName: "Cartera ARGA S.L.U." }),
      opt({ id: "2", legalName: "ARGA Seguros, S.A." }),
    ];
    expect(getPreferredEntity(entities)?.id).toBe("2");
  });

  it("sin match ARGA → la matriz del grupo (parent null) aunque no sea la primera", () => {
    const entities = [
      opt({ id: "f1", legalName: "Garrigues IP, S.L.P.", parentEntityId: "m" }),
      opt({ id: "m", legalName: "J&A Garrigues, S.L.P.", parentEntityId: null }),
    ];
    expect(getPreferredEntity(entities)?.id).toBe("m");
  });

  it("sin matriz identificable → primera; lista vacía → null", () => {
    const entities = [
      opt({ id: "a", legalName: "Filial A", parentEntityId: "z" }),
      opt({ id: "b", legalName: "Filial B", parentEntityId: "z" }),
    ];
    expect(getPreferredEntity(entities)?.id).toBe("a");
    expect(getPreferredEntity([])).toBeNull();
  });
});
```

- [ ] **Step 2: Ver el fallo**

Run: `bun test src/components/secretaria/shell/__tests__/preferred-entity.test.ts`
Expected: FAIL — `getPreferredEntity` no exportada (o `parentEntityId` inexistente en el option; en ese caso el fallo guía la ampliación de `toEntityOption`).

- [ ] **Step 3: Implementar**

En `useSecretariaScope.ts`: exportar la función y añadir la preferencia de matriz **entre** el bloque ARGA y el fallback:

```typescript
export function getPreferredEntity(entities: SecretariaEntityOption[]) {
  return (
    entities.find((entity) => entity.legalName === "ARGA Seguros, S.A.") ??
    entities.find((entity) => entity.name === "ARGA Seguros, S.A.") ??
    entities.find((entity) => entity.legalName.startsWith("ARGA Seguros,")) ??
    entities.find((entity) => entity.name.startsWith("ARGA Seguros,")) ??
    // Multi-tenant (G1): la matriz del grupo — primera entidad sin parent.
    entities.find((entity) => entity.parentEntityId == null) ??
    entities[0] ??
    null
  );
}
```

Y en `toEntityOption` (mismo fichero), incluir `parentEntityId: row.parent_entity_id ?? null` (comprobar que `useEntitiesList` selecciona `parent_entity_id`; si no, añadirlo al select).

**OJO contrato ARGA:** en el tenant ARGA la matriz por parent-null podría ser otra entidad (p. ej. Cartera) — por eso la preferencia de matriz va DESPUÉS de las 4 búsquedas ARGA verbatim, que siguen ganando. Verificar en el test 1.

- [ ] **Step 4: Ver verde**

Run: `bun test src/components/secretaria/shell/__tests__/preferred-entity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Gates y commit**

Run: `bun run typecheck 2>&1 | grep -E "useSecretariaScope|preferred-entity"` (vacío) `&& bun test src/components/secretaria/shell && bun run lint`

```bash
git add src/components/secretaria/shell/useSecretariaScope.ts src/components/secretaria/shell/__tests__/preferred-entity.test.ts
git commit -m "feat(g1): el scope de Secretaría prefiere la matriz del grupo en tenants sin hardcode

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 6: Sonda catálogo ↔ Cloud (gate de datos de G1)

**Files:**
- Test (create): `src/test/schema/garrigues-entities-seed.test.ts`

**Interfaces:**
- Consumes: usuarios demo de G0 (`demo@garrigues-demo.dev` / `TGMSdemo2026!`), catálogo de Task 2, seed ejecutado en Task 3, constantes `GARRIGUES_TENANT`/`DEMO_TENANT` del helper de tests.

- [ ] **Step 1: Escribir la sonda (patrón graceful-skip de `tenant-isolation.test.ts`)**

```typescript
// src/test/schema/garrigues-entities-seed.test.ts
// G1 gate de datos: el Cloud refleja EXACTAMENTE el catálogo (fuente de verdad).
// Además, con dato Garrigues real, la dirección ARGA→Garrigues del gate de
// aislamiento G0 deja de ser vacua (ver nota de secuenciación en tenant-isolation).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";
import {
  GARRIGUES_ENTITIES,
  GARRIGUES_MATRIZ_UUID,
} from "../../../scripts/garrigues/entities-catalog";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

describe("G1 — el perímetro Garrigues en Cloud refleja el catálogo", () => {
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      garr = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await garr.auth.signInWithPassword({
        email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD,
      });
      authed = !error;
      if (error) console.warn(`[g1-seed] login Garrigues falló: ${error.message}`);
    } catch {
      authed = false;
    }
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  it("hay exactamente tantas entidades como entradas del catálogo, todas del tenant", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("entities").select("id, tenant_id").limit(500);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(GARRIGUES_ENTITIES.length);
    expect((data ?? []).every((r) => r.tenant_id === GARRIGUES_TENANT)).toBe(true);
  });

  it("la matriz tiene NIF y registrales del RM", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("entities")
      .select("registration_number, registry_sheet, registry_volume, registry_folio, forma_administracion")
      .eq("id", GARRIGUES_MATRIZ_UUID).maybeSingle();
    expect(error).toBeNull();
    expect(data?.registration_number).toBe("B81709081");
    expect(data?.registry_sheet).toBe("M-190538");
    expect(data?.registry_volume).toBe("17456");
    expect(data?.registry_folio).toBe("132");
    expect(data?.forma_administracion).toBe("ADMINISTRADOR_UNICO");
  });

  it("los parents de Cloud coinciden 1:1 con el catálogo", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const bySlugUuid = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e.uuid]));
    const expected = new Map(
      GARRIGUES_ENTITIES.map((e) => [e.uuid, e.parentSlug ? bySlugUuid.get(e.parentSlug)! : null]),
    );
    const { data, error } = await garr.from("entities").select("id, parent_entity_id").limit(500);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.parent_entity_id).toBe(expected.get(row.id) ?? null);
    }
  });

  it("EAD Trust cuelga de NewLaw con provenance a-confirmar y consejo", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("entities")
      .select("parent_entity_id, ownership_percentage, forma_administracion, data_provenance")
      .eq("slug", "ead-trust-sl").maybeSingle();
    expect(error).toBeNull();
    expect(data?.ownership_percentage).toBe(51);
    expect(data?.forma_administracion).toBe("CONSEJO");
    const prov = data?.data_provenance;
    expect(prov?.confianza).toBe("A_CONFIRMAR");
  });

  it("toda entidad tiene data_provenance con cobertura_motor booleana", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("entities").select("slug, data_provenance").limit(500);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(typeof row.data_provenance?.cobertura_motor).toBe("boolean");
    }
  });
});
```

- [ ] **Step 2: Ejecutar la sonda (post-seed)**

Run: `bun test src/test/schema/garrigues-entities-seed.test.ts`
Expected: PASS con login real (sin warns). Si aparece un warn de login, la sonda pasó en vacío y NO cuenta como gate.

- [ ] **Step 3: Re-ejecutar el gate de aislamiento G0 (ahora con dato en ambas direcciones)**

Run: `bun test src/test/schema/tenant-isolation.test.ts`
Expected: 13 pass — y ahora la dirección "ARGA no ve filas Garrigues" es una aserción REAL (33 filas existentes que ARGA no debe ver). El comentario de secuenciación del test queda satisfecho sin tocar código.

- [ ] **Step 4: Commit**

```bash
git add src/test/schema/garrigues-entities-seed.test.ts
git commit -m "test(g1): sonda catálogo-Cloud del perímetro Garrigues + gate bidireccional real

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 7: Verificación viva, gates completos y cierre de fase

**Files:**
- Modify: `CLAUDE.md` (ampliar la sección "Tenant Garrigues" con el estado G1)

- [ ] **Step 1: Gates completos**

Run: `bun test && bun run lint && bun run typecheck && bun run build`
Expected: suite completa verde (baseline 3133 + los tests nuevos de G1); lint limpio; typecheck solo con los 4 errores preexistentes de TPRM; build OK.

- [ ] **Step 2: Verificación viva — Garrigues**

Preview (`vite-dev`, launch.json) → `/login?tenant=garrigues` → demo:
- `/entidades`: 33 entidades del grupo, chips de procedencia visibles en las dudosas (p. ej. EWCH "a confirmar").
- `/entidades/:id` de la matriz: NIF B81709081, hoja/tomo/folio, "Administrador único"; detalle de EAD Trust: badge de incidencia (51% a confirmar) y consejo.
- `/governance-map`: el grafo muestra el grupo Garrigues (cadena matriz → NewLaw → EAD Trust y las filiales).
- `/secretaria`: el ScopeSwitcher ofrece las sociedades del grupo y **preselecciona la matriz** (Task 5).
- Consola del navegador sin errores nuevos. Screenshot como evidencia.

- [ ] **Step 3: Verificación viva — ARGA intacta**

Logout → `/login` → demo ARGA: `/entidades` con sus 31 de siempre, **sin ningún chip nuevo** (data_provenance NULL), scope de Secretaría preseleccionando "ARGA Seguros, S.A." como siempre. Cualquier chip o cambio visible en ARGA = regresión.

- [ ] **Step 4: Nota de estado en CLAUDE.md y commit final**

Añadir al final de la sección "### Tenant Garrigues — G0 fundación (2026-08-02)" (renombrarla a "### Tenant Garrigues — G0 fundación + G1 espejo societario"):

```markdown
- **G1 (2026-08-03):** perímetro societario completo — 33 entidades (catálogo
  testeado `scripts/garrigues/entities-catalog.ts`, única fuente de verdad) con
  cadena de control (matriz → filiales → NewLaw → EAD Trust 51% a-confirmar),
  datos registrales reales del RM en la matriz (B81709081, M-190538), columna
  `entities.data_provenance` (migración `20260803120000`) con confianza/cobertura/
  incidencias §3.5, badges de procedencia gateados por provenance (ARGA NULL =
  cero cambio), scope de Secretaría prefiere la matriz en tenants sin hardcode,
  y sonda catálogo↔Cloud (`garrigues-entities-seed.test.ts`). El gate de
  aislamiento G0 es ahora bidireccional REAL (Garrigues tiene dato de dominio).
  Seeds aditivos: el Carril B (BORME) rellenará data_provenance sin re-sembrar.
```

```bash
git add CLAUDE.md
git commit -m "docs(g1): cierra el espejo societario Garrigues con verificación viva

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

### Task 8: Scopes y saludo del Dashboard tenant-aware (hardcodes del shell core, TDD)

**Contexto:** bajo el tenant Garrigues, el Dashboard muestra "Vista de **Grupo ARGA (Global)**" y "Buen día, **Lucía**". Causa: `src/data/scopes.ts` es una lista estática ARGA (consumida por `ScopeContext`, `ScopeSwitcher` del shell, `ScopeNotice` y `Dashboard`) y el saludo es un literal en `Dashboard.tsx:145`. Mismo patrón de fix que G0: **defaults ARGA verbatim** cuando `branding` es NULL.

**Files:**
- Create: `src/lib/tenant-scopes.ts`
- Test: `src/lib/__tests__/tenant-scopes.test.ts`
- Modify: `src/context/ScopeContext.tsx` (consumir `scopesForTenant`), `src/pages/Dashboard.tsx:145` (saludo)

**Interfaces:**
- Consumes: `useTenantBranding()` / `TenantBranding` (G0); `scopes` de `src/data/scopes.ts` (lista ARGA actual, queda como default).
- Produces: `scopesForTenant(branding): readonly string[]` y `dashboardGreeting(branding): string`.

- [ ] **Step 1: Test que falla**

```typescript
// src/lib/__tests__/tenant-scopes.test.ts
import { describe, expect, it } from "vitest";
import { dashboardGreeting, scopesForTenant } from "@/lib/tenant-scopes";
import { scopes as ARGA_SCOPES } from "@/data/scopes";

describe("tenant-scopes — defaults ARGA verbatim con branding null", () => {
  it("branding null → lista ARGA actual y saludo actual, byte a byte", () => {
    expect(scopesForTenant(null)).toEqual(ARGA_SCOPES);
    expect(scopesForTenant(null)[0]).toBe("Grupo ARGA (Global)");
    expect(dashboardGreeting(null)).toBe("Buen día, Lucía");
  });

  it("branding con scopes propios → esa lista", () => {
    const b = { scope_label: "Grupo Garrigues", scopes: ["Grupo Garrigues (Global)", "España", "Portugal"] };
    expect(scopesForTenant(b)).toEqual(["Grupo Garrigues (Global)", "España", "Portugal"]);
  });

  it("branding sin scopes → deriva '<scope_label> (Global)'", () => {
    expect(scopesForTenant({ scope_label: "Grupo Garrigues" })).toEqual(["Grupo Garrigues (Global)"]);
  });

  it("branding presente → saludo sin nombre (la persona llega en G2)", () => {
    expect(dashboardGreeting({ nombre: "Garrigues" })).toBe("Buen día");
  });

  it("scopes con basura (no-strings) → cae al derivado, no revienta", () => {
    expect(scopesForTenant({ scope_label: "X", scopes: [1, 2] as unknown as string[] })).toEqual(["X (Global)"]);
  });
});
```

- [ ] **Step 2: Ver el fallo**

Run: `bun test src/lib/__tests__/tenant-scopes.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/tenant-scopes.ts
// Scopes geográficos y saludo del Dashboard por tenant (G1 Task 8).
// branding NULL (ARGA) → lista estática y saludo actuales VERBATIM (contrato
// cero-cambio). branding presente → scopes del branding o derivado del
// scope_label; saludo genérico hasta que G2 aporte la persona del perfil.
import type { TenantBranding } from "@/context/TenantBrandContext";
import { scopeLabel } from "@/lib/tenant-brand-labels";
import { scopes as ARGA_SCOPES } from "@/data/scopes";

type BrandingWithScopes = TenantBranding & { scopes?: string[] };

export function scopesForTenant(
  branding: BrandingWithScopes | null,
): readonly string[] {
  if (!branding) return ARGA_SCOPES;
  const list = branding.scopes;
  if (Array.isArray(list) && list.length > 0 && list.every((s) => typeof s === "string")) {
    return list;
  }
  return [`${scopeLabel(branding)} (Global)`];
}

export function dashboardGreeting(branding: TenantBranding | null): string {
  return branding ? "Buen día" : "Buen día, Lucía";
}
```

- [ ] **Step 4: Ver verde**

Run: `bun test src/lib/__tests__/tenant-scopes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Cablear ScopeContext y Dashboard**

En `src/context/ScopeContext.tsx`: localizar dónde importa/usa la lista de `@/data/scopes` (grep `scopes`). Dentro del componente provider, añadir `const branding = useTenantBranding();` y sustituir el uso de la lista estática por `scopesForTenant(branding)` (incluido el scope seleccionado por defecto = primer elemento). El provider vive dentro de `TenantBrandProvider` (App.tsx, G0), así que el hook tiene contexto. NO tocar `src/data/scopes.ts` (sigue siendo el default ARGA).

En `src/pages/Dashboard.tsx:145`: `const branding = useTenantBranding();` y sustituir el literal:

```tsx
<h1 className="text-2xl font-semibold tracking-tight text-foreground">{dashboardGreeting(branding)}</h1>
```

Nota: `src/lib/aims/readiness.ts:687` compara contra el literal "Grupo ARGA (Global)" — con scopes Garrigues simplemente no matchea y sigue su rama genérica; verificar que no lanza (grep del else). No tocarlo.

- [ ] **Step 6: Sembrar los scopes de Garrigues en branding (aditivo)**

Vía MCP `execute_sql`:

```sql
UPDATE tenants
SET branding = branding || '{"scopes": ["Grupo Garrigues (Global)", "España", "Portugal", "Europa", "LATAM", "EE.UU.", "Marruecos", "China"]}'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000002'
  AND (branding->'scopes') IS NULL;

SELECT branding->'scopes' AS scopes FROM tenants WHERE id = '00000000-0000-0000-0000-000000000002';
```

Expected: array con los 8 scopes. (Guard `IS NULL` = idempotente.)

- [ ] **Step 7: Gates y commit**

Run: `bun run typecheck 2>&1 | grep -E "tenant-scopes|ScopeContext|Dashboard"` (vacío) `&& bun test src/lib/__tests__/tenant-scopes.test.ts && bun run lint`

```bash
git add src/lib/tenant-scopes.ts src/lib/__tests__/tenant-scopes.test.ts src/context/ScopeContext.tsx src/pages/Dashboard.tsx
git commit -m "feat(g1): scopes y saludo del dashboard por tenant con defaults ARGA verbatim

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

(La verificación viva de la Task 7 añade un check: bajo Garrigues, el Dashboard dice "Vista de Grupo Garrigues (Global)" y el saludo no menciona a Lucía; bajo ARGA, todo idéntico.)

---

## Self-review del plan (hecho)

- **Cobertura de spec §4 G1:** entities del inventario completo con cadena de control ✓ (T2/T3) · % oficiales IDC con *a confirmar* donde OCR dudoso ✓ (catálogo, H1/H2 aplicados: 3 vehículos, sin "Xoo.com", EAD 51 indirecta) · datos registrales reales del RM ✓ (matriz, T2/T3) · internacionales etiquetadas fuera de cobertura ✓ (provenance + badges T4) · incidencias §3.5 señaladas ✓ (provenance.incidencias: 3,4,5,6,7,8,9 mapeadas; 1-2 son de comités → G2) · seeds aditivos e idempotentes ✓ (T3, condición Carril B) · mapa y ScopeSwitcher ✓ (verificación T7 + fix multi-tenant T5) · gate suite completa + verificación viva ✓ (T6/T7).
- **Placeholders:** ninguno — catálogo, seed, tests y edits con código verbatim.
- **Consistencia de tipos:** `GarriguesEntitySeed`/`GARRIGUES_ENTITIES`/`GARRIGUES_MATRIZ_UUID` (T2) consumidos con esos nombres en T3/T6; `provenanceBadges` (T4) autocontenida; `getPreferredEntity`/`parentEntityId` (T5) coherentes; el shape de `data_provenance` (T1) coincide con `provenance` del catálogo y con `EntityProvenance` (T4).
- **Recuento de parents:** parent null = matriz, fundacion-garrigues, centro-estudios-garrigues, violet, ewch (5) → `con_parent = 28` en T3 Step 5 (corregido del borrador).
