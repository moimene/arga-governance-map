import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOI-142 — la Junta no tenía forma de emitirse: la única RPC que llamaba
 * el cliente (`fn_emit_convocatoria`) rechaza cualquier body_type distinto
 * de 'CDA'. El servidor ya tiene la RPC hermana `fn_emit_convocatoria_junta`
 * (migración 20260926114200) para JUNTA; estos tests fijan que el cliente
 * bifurca por `body_type` sin tocar el camino de Consejo, que debe seguir
 * llamando exactamente igual que antes.
 */
const hook = readFileSync(
  resolve(process.cwd(), "src/hooks/useConvocatorias.ts"),
  "utf8",
);
const stepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriasStepper.tsx"),
  "utf8",
);
const artifactRegister = readFileSync(
  resolve(process.cwd(), "supabase/functions/convocation-artifact-register/index.ts"),
  "utf8",
);

describe("convocatoria — bifurcación de emisión Junta/Consejo (MOI-142)", () => {
  it("useCreateConvocatoria enruta por body_type sin dejar de llamar al Consejo igual que antes", () => {
    expect(hook).toContain("body_type?: string | null");
    // El Consejo sigue llamando literalmente a la misma RPC de siempre.
    expect(hook).toContain('.rpc("fn_emit_convocatoria", { p_payload: payload })');
    // La Junta llama a la RPC hermana, nunca a la de Consejo.
    expect(hook).toContain('.rpc("fn_emit_convocatoria_junta", { p_payload: payload })');
    expect(hook).toContain('(input.body_type ?? "").toUpperCase() === "JUNTA"');
  });

  it("no reconstruye el payload por rama: un único objeto payload para ambas RPC", () => {
    const mutation = hook.match(/mutationFn:[\s\S]*?onSuccess:/)?.[0] ?? "";
    expect(mutation).toContain("const payload =");
    expect((mutation.match(/const payload =/g) ?? []).length).toBe(1);
  });

  it("el stepper deja de bloquear la emisión de Junta en el gate de Consejo", () => {
    expect(stepper).toContain(
      'organoTipo !== "CONSEJO" && organoTipo !== "JUNTA_GENERAL"',
    );
    // El Consejo conserva exactamente su mensaje y su validación de Presidente.
    expect(stepper).toContain('convocanteAuthority?.cargo === "PRESIDENTE"');
    expect(stepper).toContain('convocanteAuthority?.cargo !== "PRESIDENTE"');
  });

  it("un solo criterio de quién convoca para la emisión y para el texto (arista; el comportamiento lo fija convocante-autoridad.test.ts)", () => {
    expect(stepper).toContain('from "@/lib/secretaria/convocante-autoridad"');
    expect(stepper).toContain("autoridadConvocante({");
    expect(stepper).toContain('(b.body_type ?? "").toUpperCase() === "CDA"');
    // La emisión de Junta se bloquea sin convocante...
    expect(stepper).toContain('organoTipo === "JUNTA_GENERAL" && !convocanteDelActo');
    // ...y el texto nombra a ESE mismo convocante (antes leía el Presidente
    // del órgano de la Junta, que no existe, y firmaba «: .»).
    expect(stepper).toContain('convocanteNombre: convocanteDelActo?.person?.full_name');
    expect(stepper).toContain('nombre_convocante: convocanteDelActo?.person?.full_name');
    expect(stepper).not.toContain("convocanteNombre: convocanteAuthority");
    expect(stepper).not.toContain("nombre_convocante: convocanteAuthority");
  });

  it("propaga body_type al crear la convocatoria, para que el hook sepa qué RPC llamar", () => {
    expect(stepper).toContain("body_type: selectedBody?.body_type ?? null");
  });

  it("el renderer del documento final acepta la fuente de destinatarios de Junta (capital_holdings), no solo la de Consejo", () => {
    // Medido en vivo (grupo nuevo, 2026-09-27): sin este fix, generar el
    // DOCX de una Junta EMITIDA devolvía 409 "Manifest recipient snapshot is
    // incomplete or inconsistent" — el Edge Function seguía exigiendo
    // literalmente recipientSelection.source === 'condiciones_persona'
    // aunque el trigger de servidor (migración 20260926114200) ya escribe
    // 'capital_holdings' para una Junta.
    expect(artifactRegister).toContain(
      "!['condiciones_persona', 'capital_holdings'].includes(String(recipientSelection.source))",
    );
    expect(artifactRegister).not.toContain(
      "recipientSelection.source !== 'condiciones_persona'",
    );
  });
});
