/**
 * MOI-150 (D-28 bis) — contrato estático de
 * `20261002101000_aims_proponer_sujeto_organo.sql`: la única puerta de
 * escritura de `aims_ria_subjects` acepta y escribe el órgano que gobierna la
 * IA, que es lo que lee el panel «Órgano rector» de AIMS
 * (`resolveAiGovernanceBodyId`). El ensayo revertido contra Cloud está en
 * docs/superpowers/reviews/2026-10-02-ensayo-moi150-organo-ia.md.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261002101000_aims_proponer_sujeto_organo.sql"),
  "utf8",
);
const anterior = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260927133000_f2_a3_aims_rpc_sujetos.sql"),
  "utf8",
);

describe("MOI-150 — fn_aims_proponer_sujeto con órgano", () => {
  it("retira la firma de 7 argumentos y crea la de 8 con el órgano opcional", () => {
    expect(sql).toContain(
      "drop function if exists public.fn_aims_proponer_sujeto(uuid, uuid, text, text, text[], text, uuid);",
    );
    expect(sql).toMatch(/p_governing_body_id uuid default null\n\)/);
  });

  it("escribe governing_body_id y solo acepta un órgano del mismo tenant", () => {
    expect(sql).toMatch(/questionnaire_id, rationale, status, governing_body_id/);
    expect(sql).toContain("raise exception 'ORGANO_DE_OTRO_TENANT:");
    expect(sql).toMatch(/b\.id = p_governing_body_id and b\.tenant_id = v_tenant/);
  });

  it("conserva las comprobaciones previas: tenant, capacidad y sistema propio", () => {
    for (const marca of [
      "raise exception 'SIN_TENANT:",
      "perform public.fn_aims_assert_capacidad('AIMS_CLASIFICAR');",
      "raise exception 'SISTEMA_DE_OTRO_TENANT:",
      "raise exception 'NO_PROPUESTO:",
    ]) {
      expect(anterior).toContain(marca);
      expect(sql).toContain(marca);
    }
  });

  it("sin EXECUTE para anon y con verificación que aborta", () => {
    expect(sql).toMatch(
      /revoke all on function public\.fn_aims_proponer_sujeto\(uuid, uuid, text, text, text\[\], text, uuid, uuid\) from public, anon;/,
    );
    expect(sql).toContain("VERIFICACION MOI-150");
  });
});
