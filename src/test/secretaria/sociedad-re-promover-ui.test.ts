import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MOI-234 — Interfaz para re-promover sociedades en estado INCOMPLETA_CARGOS", () => {
  const root = process.cwd();
  const read = (path: string) => readFileSync(resolve(root, path), "utf8");

  it("la ficha de sociedad (SociedadDetalle.tsx) contiene el botón y handler de re-promoción", () => {
    const fileContent = read("src/pages/secretaria/SociedadDetalle.tsx");

    // Verificar presencia del botón con la copy jurídica exacta
    expect(fileContent).toContain("Re-evaluar y promover a operativa");
    expect(fileContent).toContain("Re-evaluando…");

    // Verificar invocación de la RPC server-side
    expect(fileContent).toContain('supabase.rpc(\n        "fn_promover_sociedad_operativa"');

    // Verificar invalidación reactiva de queries tras promoción
    expect(fileContent).toContain('queryClient.invalidateQueries({ queryKey: ["sociedades"] })');

    // Verificar feedback al usuario
    expect(fileContent).toContain("Sociedad promovida a OPERATIVA correctamente");

    // Verificar cumplimiento de accesibilidad y diseño Garrigues
    expect(fileContent).toContain("aria-busy={isPromoting}");
    expect(fileContent).toContain("bg-[var(--g-brand-3308)]");
    expect(fileContent).toContain("var(--g-radius-md)");
  });
});
