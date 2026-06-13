// W6 — capability_matrix.reason completa (guard de regresión).
// Antes de la migración 20260613213000 había 6/35 celdas sin razón jurídica
// (AUDITOR/COMPLIANCE × SNAPSHOT/VOTE/CERTIFICATION). Este test exige 35/35.
import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("W6 — capability_matrix.reason completa (35/35)", () => {
  it("toda celda de capability_matrix tiene razón jurídica anotada", async () => {
    const { data, error } = await supabase
      .from("capability_matrix")
      .select("role, action, reason");
    expect(error).toBeNull();
    const rows = data ?? [];
    // ≥35 (no exacto) para no romper si se añaden capacidades futuras; lo que
    // importa es que NINGUNA fila quede sin razón jurídica anotada.
    expect(rows.length).toBeGreaterThanOrEqual(35);
    const sinReason = rows.filter(
      (r) => !r.reason || String(r.reason).trim() === "",
    );
    expect(sinReason).toEqual([]);
  });
});
