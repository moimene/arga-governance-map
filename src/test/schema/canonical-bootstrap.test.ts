// src/test/schema/canonical-bootstrap.test.ts
/**
 * Canonical bootstrap — T14 PJ creation and person_id linking.
 *
 * Verifies migration supabase/migrations/20260421_000020_bootstrap_identidad.sql
 * landed on cloud project `hzqwefkwsxopwrmtksbg`. Concretely the bootstrap must:
 *   - create one persona jurídica (persons.person_type = 'PJ') per entity that
 *     previously had person_id IS NULL,
 *   - link entities.person_id to that persona,
 *   - set entities.person_id NOT NULL,
 *   - seed entity_capital_profile (capital = 0, estado = 'VIGENTE') and one
 *     share_classes row (class_code = 'ORD') per entity that lacked them.
 *
 * DEVIATIONS from the plan text (2026-04-21-modelo-canonico-fase-0-1-plan.md
 * lines 1559–1676), pre-approved before dispatch:
 *
 *   1. person_type literal is 'PJ', not 'JURIDICA'. The Cloud CHECK constraint
 *      `persons_person_type_check` restricts values to 'PF' | 'PJ'; the domain
 *      term "persona jurídica" maps to 'PJ' at the DB layer.
 *
 *   2. The probes below use PostgREST instead of the `execute_sql` RPC, because
 *      that RPC is NOT exposed on this Cloud project (same constraint noted at
 *      the top of canonical-model.test.ts and canonical-triggers.test.ts).
 *
 *   3. describe.skipIf(!hasAdminClient()) wraps the whole block so local dev
 *      runs without .env.local skip cleanly instead of failing.
 *
 *   4. No cleanup (afterAll/afterEach) is possible or needed — bootstrap is a
 *      one-shot persistent state change on Cloud (persons rows + NOT NULL
 *      constraint on entities.person_id). Re-runs of the suite are safe:
 *      the WHERE e.person_id IS NULL scope in the migration becomes empty
 *      after the first successful apply.
 *
 * Runtime env: requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * `.env.local`. Without those, hasAdminClient() returns false and the describe
 * block is skipped.
 */
import { describe, it, expect } from "vitest";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_ENTITY_ARGA,
  DEMO_ENTITY_CARTERA,
  DEMO_PJ_ARGA_SEGUROS_TAX_ID,
  DEMO_PJ_CARTERA_TAX_ID,
  DEMO_PJ_FUNDACION_TAX_ID,
  DEMO_PJ_MERCADO_LIBRE_TAX_ID,
} from "../helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "Canonical bootstrap — PJ creation and person_id linking",
  () => {
    it("toda entity tiene person_id NOT NULL tras bootstrap", async () => {
      const { data, error } = await supabaseAdmin!
        .from("entities")
        .select("id, person_id")
        .is("person_id", null);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("cada entity tiene exactamente una PJ asociada", async () => {
      const { data, error } = await supabaseAdmin!
        .from("entities")
        .select("id, person_id, persons:person_id(person_type)")
        .not("person_id", "is", null);
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      const wrong = (data ?? []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => !e.persons || e.persons.person_type !== "PJ"
      );
      expect(wrong).toEqual([]);
    });

    it("person_id es único globalmente por entity", async () => {
      const { data, error } = await supabaseAdmin!
        .from("entities")
        .select("id, person_id")
        .not("person_id", "is", null);
      expect(error).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = (data ?? []).map((e: any) => e.person_id as string);
      const uniq = new Set(ids);
      expect(ids.length).toBe(uniq.size);
    });

    // Hardening test (T14 code-quality review, "Important #3"):
    // Verifica que cada PJ creada por el bootstrap apunta al entity correcto
    // vía el tax_id sintético 'PENDIENTE-<entity.id>'. Un cross-link (la misma
    // entity apuntando a la PJ equivocada) pasaría los 3 tests anteriores pero
    // fallaría aquí. Cubre el riesgo de colisión de tax_id con PJs
    // pre-existentes — el CTE+RETURNING en la migración ya lo bloquea en
    // origen; este test es el guardrail que lo verifica en Cloud.
    it("cada PJ creada por bootstrap tiene tax_id = PENDIENTE-<entity.id>", async () => {
      const { data, error } = await supabaseAdmin!
        .from("entities")
        .select("id, registration_number, persons:person_id(tax_id)")
        .not("person_id", "is", null);
      expect(error).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrong = (data ?? []).filter((e: any) => {
        const expected = `PENDIENTE-${e.id}`;
        return e.persons?.tax_id !== expected;
      });
      expect(wrong).toEqual([]);
    });

    // T15 — Backfill condiciones_persona desde mandates.role.
    // Verifica que cada mandate (con role) tiene su condicion_persona
    // equivalente. El test original del plan usaba execute_sql RPC (no
    // disponible en este proyecto); se reescribe como join cliente-lado
    // contra PostgREST: fetch mandates + FK-embed governing_bodies.entity_id,
    // fetch condiciones, comparar por la clave natural (person_id, entity_id,
    // body_id).
    it("toda row de mandates con role tiene una condicion_persona equivalente", async () => {
      const { data: mandates, error: mErr } = await supabaseAdmin!
        .from("mandates")
        .select("id, person_id, body_id, governing_bodies:body_id(entity_id)")
        .not("role", "is", null);
      expect(mErr).toBeNull();

      const { data: cond, error: cErr } = await supabaseAdmin!
        .from("condiciones_persona")
        .select("person_id, entity_id, body_id");
      expect(cErr).toBeNull();

      const condKeys = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cond ?? []).map((c: any) => `${c.person_id}|${c.entity_id}|${c.body_id}`)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missing = (mandates ?? []).filter((m: any) => {
        const entityId = m.governing_bodies?.entity_id;
        return !condKeys.has(`${m.person_id}|${entityId}|${m.body_id}`);
      });
      expect(missing).toEqual([]);
    });

    // T16 — Backfill capital_holdings desde mandates.porcentaje_capital.
    // Dos invariantes del plan: (a) cada mandate con porcentaje tiene holding
    // equivalente; (b) la suma de porcentaje por entidad coincide entre
    // mandates y capital_holdings (tolerancia 0.01).
    // Tests reescritos en PostgREST (execute_sql no expuesto).
    it("toda row de mandates con porcentaje_capital tiene capital_holdings equivalente", async () => {
      const { data: mandates, error: mErr } = await supabaseAdmin!
        .from("mandates")
        .select("id, person_id, body_id, governing_bodies:body_id(entity_id)")
        .not("porcentaje_capital", "is", null);
      expect(mErr).toBeNull();

      const { data: holdings, error: hErr } = await supabaseAdmin!
        .from("capital_holdings")
        .select("entity_id, holder_person_id")
        .is("effective_to", null);
      expect(hErr).toBeNull();

      const holdingKeys = new Set(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (holdings ?? []).map((h: any) => `${h.holder_person_id}|${h.entity_id}`)
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const missing = (mandates ?? []).filter((m: any) => {
        const entityId = m.governing_bodies?.entity_id;
        return !holdingKeys.has(`${m.person_id}|${entityId}`);
      });
      expect(missing).toEqual([]);
    });

    it("la suma de porcentaje_capital por entidad es consistente entre mandates y capital_holdings", async () => {
      const { data: mandates, error: mErr } = await supabaseAdmin!
        .from("mandates")
        .select("porcentaje_capital, governing_bodies:body_id(entity_id)")
        .not("porcentaje_capital", "is", null);
      expect(mErr).toBeNull();

      const { data: holdings, error: hErr } = await supabaseAdmin!
        .from("capital_holdings")
        .select("entity_id, porcentaje_capital, is_treasury")
        .is("effective_to", null);
      expect(hErr).toBeNull();

      // Sumar por entity_id en ambos lados, luego comparar con tolerancia.
      const mSums: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const m of mandates ?? [] as any[]) {
        const eid = m.governing_bodies?.entity_id as string | undefined;
        if (!eid) continue;
        mSums[eid] = (mSums[eid] ?? 0) + Number(m.porcentaje_capital);
      }
      const hSums: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const h of holdings ?? [] as any[]) {
        if (h.is_treasury) continue;
        const eid = h.entity_id as string;
        hSums[eid] = (hSums[eid] ?? 0) + Number(h.porcentaje_capital ?? 0);
      }
      const mismatches = Object.keys(mSums).filter(
        (eid) => hSums[eid] !== undefined && Math.abs(mSums[eid] - hSums[eid]) > 0.01
      );
      expect(mismatches).toEqual([]);
    });
  }
);

// ---------------------------------------------------------------------------
// T17 — Seed demo ARGA canónico (estructura Fundación → Cartera → ARGA Seguros).
//
// Verifica el resultado de `scripts/seed-demo-arga-canonico.ts` (o equivalente
// aplicado vía apply_migration en Cloud al ejecutar T17) contra la tabla
// capital objetivo IAR 2025:
//   - Fundación ARGA ─100%→ Cartera ARGA S.L.U.
//   - Cartera ARGA ─69.69%→ ARGA Seguros S.A.
//   - Free Float (Mercado libre) ─30.31%→ ARGA Seguros S.A.
//
// DEVIATIONS vs plan §T17:
//   1. Plan usa `supabaseAdmin.rpc("execute_sql", ...)` que NO está expuesto
//      en este Cloud project. Reescrito como PostgREST: SELECT + sumar/aserto
//      client-side. Patrón idéntico al de los tests T15/T16.
//   2. Plan hardcoda tax_ids literales. Usamos las constantes
//      DEMO_PJ_*_TAX_ID del helper (canonical tax_ids centralizados).
//   3. Plan usa `.persons!inner(...)` — funciona pero la sintaxis de embed
//      embed filtering en PostgREST varía. Usamos `.persons:person_id(...)`
//      + filtro client-side, consistente con los otros tests del archivo.
// ---------------------------------------------------------------------------
describe.skipIf(!hasAdminClient())(
  "Canonical bootstrap — seed ARGA canónico (T17)",
  () => {
    it(`ARGA Seguros tiene PJ asociada con tax_id ${DEMO_PJ_ARGA_SEGUROS_TAX_ID}`, async () => {
      const { data, error } = await supabaseAdmin!
        .from("entities")
        .select("id, person_id, persons:person_id(tax_id, person_type)")
        .eq("id", DEMO_ENTITY_ARGA)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((data as any)?.persons?.tax_id).toBe(DEMO_PJ_ARGA_SEGUROS_TAX_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((data as any)?.persons?.person_type).toBe("PJ");
    });

    it(`Cartera ARGA tiene PJ asociada con tax_id ${DEMO_PJ_CARTERA_TAX_ID}`, async () => {
      const { data, error } = await supabaseAdmin!
        .from("entities")
        .select("id, persons:person_id(tax_id)")
        .eq("id", DEMO_ENTITY_CARTERA)
        .maybeSingle();
      expect(error).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((data as any)?.persons?.tax_id).toBe(DEMO_PJ_CARTERA_TAX_ID);
    });

    it(`Mercado Libre PJ existe con tax_id ${DEMO_PJ_MERCADO_LIBRE_TAX_ID}`, async () => {
      const { data, error } = await supabaseAdmin!
        .from("persons")
        .select("id, tax_id, person_type")
        .eq("tax_id", DEMO_PJ_MERCADO_LIBRE_TAX_ID);
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((data as any)?.[0].person_type).toBe("PJ");
    });

    it(`Fundación ARGA tiene PJ asociada con tax_id ${DEMO_PJ_FUNDACION_TAX_ID}`, async () => {
      // Fundación ARGA es la raíz de la cadena Cartera. Probe por tax_id (no
      // conocemos el UUID del entity de Fundación centralmente; el DEMO_*
      // centraliza solo ARGA y Cartera).
      const { data, error } = await supabaseAdmin!
        .from("persons")
        .select("id, tax_id, person_type, full_name")
        .eq("tax_id", DEMO_PJ_FUNDACION_TAX_ID);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    it("capital holdings de ARGA Seguros suman 100% (69.69 Cartera + 30.31 Mercado Libre)", async () => {
      const { data, error } = await supabaseAdmin!
        .from("capital_holdings")
        .select("porcentaje_capital, is_treasury, holder_person_id")
        .eq("entity_id", DEMO_ENTITY_ARGA)
        .is("effective_to", null);
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data as any[]) ?? [];
      const total = rows
        .filter((r) => !r.is_treasury)
        .reduce((sum, r) => sum + Number(r.porcentaje_capital ?? 0), 0);
      expect(total).toBeCloseTo(100, 1);
      // Should be exactly 2 holders (Cartera + Mercado Libre).
      expect(rows.length).toBe(2);
    });

    it("entity_capital_profile VIGENTE de ARGA Seguros tiene ~3.079M titulos y valor_nominal 0.1", async () => {
      const { data, error } = await supabaseAdmin!
        .from("entity_capital_profile")
        .select("numero_titulos, valor_nominal, capital_escriturado")
        .eq("entity_id", DEMO_ENTITY_ARGA)
        .eq("estado", "VIGENTE")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = data as any;
      expect(Number(p?.numero_titulos)).toBeGreaterThan(3_000_000_000);
      expect(Number(p?.valor_nominal)).toBe(0.1);
    });

    it("Cartera ARGA tiene 1 holding al 100% por Fundación ARGA", async () => {
      const { data, error } = await supabaseAdmin!
        .from("capital_holdings")
        .select("porcentaje_capital, holder_person_id")
        .eq("entity_id", DEMO_ENTITY_CARTERA)
        .is("effective_to", null);
      expect(error).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data as any[]) ?? [];
      expect(rows.length).toBe(1);
      expect(Number(rows[0].porcentaje_capital)).toBeCloseTo(100, 1);
    });

    it("condiciones SOCIO incluyen Cartera + Mercado Libre en ARGA + Fundación en Cartera", async () => {
      const { data: argaSocios, error: e1 } = await supabaseAdmin!
        .from("condiciones_persona")
        .select("person_id, tipo_condicion, estado, body_id")
        .eq("entity_id", DEMO_ENTITY_ARGA)
        .eq("tipo_condicion", "SOCIO")
        .eq("estado", "VIGENTE");
      expect(e1).toBeNull();
      expect((argaSocios ?? []).length).toBeGreaterThanOrEqual(2);

      const { data: carteraSocios, error: e2 } = await supabaseAdmin!
        .from("condiciones_persona")
        .select("person_id, tipo_condicion, estado")
        .eq("entity_id", DEMO_ENTITY_CARTERA)
        .eq("tipo_condicion", "SOCIO")
        .eq("estado", "VIGENTE");
      expect(e2).toBeNull();
      expect((carteraSocios ?? []).length).toBeGreaterThanOrEqual(1);
    });
  }
);
