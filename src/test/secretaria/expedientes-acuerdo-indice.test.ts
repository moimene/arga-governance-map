import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GRUPO_NAV_GROUPS,
  SOCIEDAD_NAV_GROUPS,
  getSecretariaSectionLabel,
} from "@/components/secretaria/shell/navigation";

/**
 * MOI-197 — índice navegable de expedientes de acuerdo.
 *
 * Decisión tomada por delegación (el orquestador confirma en nombre de
 * Moisés, ver issue MOI-197 "Qué te toca a ti"): nombre de menú "Expedientes
 * de acuerdo" dentro de la sección "Adopción", tal y como proponía el propio
 * issue.
 *
 * Estos tests son de contrato: no llaman a Supabase, así que caen si el
 * ítem de menú se renombra, se mueve de sección o si la ruta índice deja de
 * existir — antes de que lo note un e2e contra Cloud.
 */

const ROUTE = "/secretaria/acuerdos";
const LABEL = "Expedientes de acuerdo";

describe("MOI-197: ítem de menú «Expedientes de acuerdo»", () => {
  it("existe en el árbol de grupo, dentro de Adopción", () => {
    const adopcion = GRUPO_NAV_GROUPS.find((g) => g.label === "Adopción");
    expect(adopcion, "no hay sección Adopción en GRUPO_NAV_GROUPS").toBeDefined();
    const item = adopcion!.items.find((i) => i.to === ROUTE);
    expect(item?.label).toBe(LABEL);
  });

  it("existe en el árbol de sociedad, dentro de Adopción", () => {
    const adopcion = SOCIEDAD_NAV_GROUPS.find((g) => g.label === "Adopción");
    expect(adopcion, "no hay sección Adopción en SOCIEDAD_NAV_GROUPS").toBeDefined();
    const item = adopcion!.items.find((i) => i.to === ROUTE);
    expect(item?.label).toBe(LABEL);
  });

  it("el rótulo de sección del índice es el propio ítem, distinto del de la ficha", () => {
    expect(getSecretariaSectionLabel(ROUTE, "grupo")).toBe(LABEL);
    expect(getSecretariaSectionLabel(ROUTE, "sociedad")).toBe(LABEL);
    // No debe colisionar con la regex existente para el detalle /:id.
    expect(getSecretariaSectionLabel(`${ROUTE}/11111111-1111-1111-1111-111111111111`, "grupo")).toBe(
      "Expediente"
    );
  });
});

describe("MOI-197: ruta índice montada antes que la ficha", () => {
  const appSrc = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

  it("App.tsx monta /secretaria/acuerdos (índice) y /secretaria/acuerdos/:id (ficha)", () => {
    expect(appSrc).toContain('path="/secretaria/acuerdos"');
    expect(appSrc).toContain('path="/secretaria/acuerdos/:id"');
    expect(appSrc).toContain("ExpedientesAcuerdoLista");
  });
});

describe("MOI-197: la consulta de useAgreementsList sigue pidiendo recuento exacto", () => {
  const hookSrc = readFileSync(resolve(process.cwd(), "src/hooks/useAgreementsList.ts"), "utf8");

  it('conserva count:"exact" (precondición del e2e: content-range en la respuesta)', () => {
    expect(hookSrc).toContain('count: "exact"');
  });

  it("conserva el join a governing_bodies (precondición del filtro por órgano)", () => {
    expect(hookSrc).toContain("governing_bodies(name)");
  });
});
