import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// MOI-194: la conexión con Supabase debe usar el genérico `Database`
// (`createClient<Database>`), generado desde el esquema real de Cloud, para
// que `bun run typecheck` valide columnas y RPCs contra la estructura real
// en vez de aceptar cualquier `.from(tabla-que-sea)`/`.rpc(loquesea)` como
// `any`. Antes de MOI-194, `src/integrations/supabase/client.ts` construía
// el cliente SIN el genérico y este test no existía: nada impedía volver a
// ese estado sin que ningún gate lo notara (el propio `bun run typecheck`
// pasa igual de "verde" con o sin el genérico si nadie hizo antes el trabajo
// de tipar las 100 llamadas reales que el genérico destapa).
describe("MOI-194 — cliente Supabase tipado contra el esquema real", () => {
  const clientSource = readFileSync(
    join(import.meta.dir, "../../integrations/supabase/client.ts"),
    "utf8",
  );

  it("createClient recibe el genérico Database, no un cliente sin tipar", () => {
    expect(clientSource).toMatch(/createClient<Database>\(/);
  });

  it("importa el tipo Database desde los tipos generados de Cloud", () => {
    expect(clientSource).toMatch(/import\s+type\s+\{\s*Database\s*\}\s+from\s+"\.\/types"/);
  });

  it("src/integrations/supabase/types.ts exporta Database (tipos generados, no vacíos)", () => {
    const typesSource = readFileSync(
      join(import.meta.dir, "../../integrations/supabase/types.ts"),
      "utf8",
    );
    expect(typesSource).toMatch(/export type Database = \{/);
    // Sonda de tablas reales, no de tipos huecos: si esto deja de estar,
    // los tipos se regeneraron desde un proyecto/esquema distinto.
    expect(typesSource).toContain("agreements:");
    expect(typesSource).toContain("meetings:");
  });
});
