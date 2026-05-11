/**
 * Matriz P7 — tests unitarios.
 *
 * Cubre los 5 modos del estado meetings.status × CONSEJO/JUNTA universal/formal
 * × INFO/DELIB/DECIS. Función pura, sin mocks.
 */
import { describe, expect, it } from "vitest";
import {
  checkReclassificationAllowed,
  type ReclassificationCheckInput,
} from "../reclassification-matrix";

function base(overrides: Partial<ReclassificationCheckInput>): ReclassificationCheckInput {
  return {
    meetingStatus: "DRAFT",
    currentKind: "DELIBERATIVO",
    newKind: "DECISORIO",
    organType: "CONSEJO",
    isUniversal: false,
    ...overrides,
  };
}

describe("checkReclassificationAllowed — matriz P7", () => {
  it("rechaza no-op (currentKind === newKind)", () => {
    const r = checkReclassificationAllowed(
      base({ currentKind: "DELIBERATIVO", newKind: "DELIBERATIVO" }),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/ya está clasificado/i);
  });

  it("DRAFT + CONSEJO + DELIB→DECIS: permitido", () => {
    const r = checkReclassificationAllowed(
      base({ meetingStatus: "DRAFT", organType: "CONSEJO" }),
    );
    expect(r.allowed).toBe(true);
  });

  it("DRAFT + JUNTA convocada formalmente + DELIB→DECIS: permitido (aún en draft)", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "DRAFT",
        organType: "JUNTA_GENERAL",
        isUniversal: false,
      }),
    );
    // DRAFT no impone restricción procedimental — aún no se ha convocado
    expect(r.allowed).toBe(true);
  });

  it("CONVOKED + CONSEJO + DELIB→DECIS: permitido (con audit)", () => {
    const r = checkReclassificationAllowed(
      base({ meetingStatus: "CONVOKED", organType: "CONSEJO" }),
    );
    expect(r.allowed).toBe(true);
  });

  it("CONVOKED + JUNTA convocada formalmente + DELIB→DECIS: DENEGADO (vicio procedimiento)", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "CONVOKED",
        organType: "JUNTA_GENERAL",
        isUniversal: false,
      }),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Junta convocada formalmente/i);
    expect(r.reason).toMatch(/vicio de procedimiento|art\. 174/i);
  });

  it("CONVOKED + JUNTA universal + DELIB→DECIS: permitido (unanimidad asumida)", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "CONVOKED",
        organType: "JUNTA_GENERAL",
        isUniversal: true,
      }),
    );
    expect(r.allowed).toBe(true);
  });

  it("CONVOKED + JUNTA convocada formalmente + INFO→DELIB: permitido (no eleva a decisorio)", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "CONVOKED",
        organType: "JUNTA_GENERAL",
        isUniversal: false,
        currentKind: "INFORMATIVO",
        newKind: "DELIBERATIVO",
      }),
    );
    expect(r.allowed).toBe(true);
  });

  it("OPEN + CONSEJO + DELIB→DECIS: permitido (UI debe validar quórum unánime)", () => {
    const r = checkReclassificationAllowed(
      base({ meetingStatus: "OPEN", organType: "CONSEJO" }),
    );
    expect(r.allowed).toBe(true);
  });

  it("OPEN + JUNTA universal + DELIB→DECIS: permitido", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "OPEN",
        organType: "JUNTA",
        isUniversal: true,
      }),
    );
    expect(r.allowed).toBe(true);
  });

  it("OPEN + JUNTA convocada formalmente + DELIB→DECIS: DENEGADO (vicio procedimiento)", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "OPEN",
        organType: "JUNTA",
        isUniversal: false,
      }),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Junta convocada formalmente/i);
  });

  it("CLOSED + cualquier órgano + cualquier kind: DENEGADO (T2 backstop)", () => {
    const r = checkReclassificationAllowed(
      base({ meetingStatus: "CLOSED", organType: "CONSEJO" }),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Reunión cerrada|firmada el acta/i);
  });

  it("organType desconocido (UNKNOWN) en CONVOKED: degradación conservadora permite", () => {
    // Si no podemos resolver organType desde governing_bodies, no
    // bloqueamos por vicio JUNTA — los triggers BD son backstop.
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "CONVOKED",
        organType: "OTRO_DESCONOCIDO",
        isUniversal: false,
      }),
    );
    expect(r.allowed).toBe(true);
  });

  it("CONSEJO_ADMIN se normaliza a CONSEJO", () => {
    const r = checkReclassificationAllowed(
      base({ meetingStatus: "CONVOKED", organType: "CONSEJO_ADMIN" }),
    );
    expect(r.allowed).toBe(true);
  });

  it("body_type='CDA' (Cloud demo) se normaliza a CONSEJO", () => {
    const r = checkReclassificationAllowed(
      base({ meetingStatus: "OPEN", organType: "CDA" }),
    );
    expect(r.allowed).toBe(true);
  });

  it("status case-insensitive: 'open' (lowercase) trata igual que 'OPEN'", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "open",
        organType: "JUNTA",
        isUniversal: false,
      }),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/Junta convocada formalmente/i);
  });

  it("INFO→DECIS en CONVOKED + CONSEJO: permitido (cualquier transición no-op desde no-decisorio)", () => {
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "CONVOKED",
        organType: "CONSEJO",
        currentKind: "INFORMATIVO",
        newKind: "DECISORIO",
      }),
    );
    expect(r.allowed).toBe(true);
  });

  it("DECIS→INFO en CONVOKED + JUNTA formal: permitido (no es elevación)", () => {
    // Aunque sea JUNTA convocada formalmente, degradar de DECIS a INFO
    // NO crea vicio procedimental — solo bloquea elevación TO DECISORIO.
    const r = checkReclassificationAllowed(
      base({
        meetingStatus: "CONVOKED",
        organType: "JUNTA_GENERAL",
        isUniversal: false,
        currentKind: "DECISORIO",
        newKind: "INFORMATIVO",
      }),
    );
    expect(r.allowed).toBe(true);
  });
});
