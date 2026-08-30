// La declaración de aislamiento se comprueba contra Cloud ANTES de que el gate
// la use.
//
// Es el paso que G4 documentó y que casi todo el mundo se salta: si una tabla
// no tiene filas en uno de los dos tenants, la aserción de aislamiento en esa
// dirección pasa **sin comprobar nada**. Verde y vacía.
//
// Aquí la vacuidad no se tolera ni se prohíbe: se DECLARA, con su motivo y su
// fuente, y la declaración se contrasta con lo que hay. Una ausencia esperada
// que deja de serlo rompe igual que una presencia esperada que falta.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";
import {
  AISLAMIENTO_DECLARADO,
  ARGA,
  CON_AUSENCIA_DECLARADA,
  GARRIGUES,
} from "./aislamiento-declarado";

describe("C3 Tarea 8 — la declaración de aislamiento cuadra con Cloud", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    // Sin graceful-skip. Una sonda que se salta a sí misma cuando no puede
    // autenticar es un gate verde que no asierta nada — que es justo el vicio
    // que este fichero existe para no repetir.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 30_000);

  it("cada presencia declarada es la que hay, en los dos tenants", async () => {
    for (const t of AISLAMIENTO_DECLARADO) {
      const { data: ra, error: ea } = await arga.from(t.tabla)
        .select("id").eq("tenant_id", ARGA).limit(1);
      const { data: rg, error: eg } = await garr.from(t.tabla)
        .select("id").eq("tenant_id", GARRIGUES).limit(1);
      expect(ea, `${t.tabla} (ARGA)`).toBeNull();
      expect(eg, `${t.tabla} (Garrigues)`).toBeNull();

      // `ALGUNA` que sale vacía = seed roto. `NINGUNA` que sale con filas =
      // la decisión de no sembrar se revirtió sin actualizar la declaración.
      // Las dos rompen, y es lo que convierte la declaración en aserción.
      expect(ra.length > 0, `${t.tabla}: ARGA declarada ${t.arga}`).toBe(t.arga === "ALGUNA");
      expect(rg.length > 0, `${t.tabla}: Garrigues declarada ${t.garrigues}`)
        .toBe(t.garrigues === "ALGUNA");
    }
  });

  it("toda ausencia declarada trae motivo Y fuente", () => {
    // Sin esto, «vacía a propósito» es indistinguible de «vacía porque alguien
    // quería que el gate callara». Es el mismo corte que `INFERIDO` vs
    // `no consta` en el resto del proyecto.
    expect(CON_AUSENCIA_DECLARADA.length).toBeGreaterThan(0);
    for (const t of CON_AUSENCIA_DECLARADA) {
      expect(t.motivo, `${t.tabla} declara una ausencia sin motivo`).toBeTruthy();
      expect(t.motivo!.texto.length).toBeGreaterThan(60);
      // La fuente tiene que apuntar a algo comprobable: una política con su
      // apartado, o la decisión con su commit.
      expect(t.motivo!.fuente).toMatch(/§|commit|art\./);
    }
  });

  it("y ninguna tabla sin ausencia arrastra un motivo huérfano", () => {
    // Control inverso: un motivo colgando en una tabla que sí tiene filas en
    // los dos lados sería una excusa preparada para cuando haga falta.
    const sinAusencia = AISLAMIENTO_DECLARADO.filter(
      (t) => t.arga === "ALGUNA" && t.garrigues === "ALGUNA",
    );
    expect(sinAusencia.filter((t) => t.motivo)).toEqual([]);
  });

  it("los marcadores existen donde se declaran y NO en el otro tenant", async () => {
    // La invariante de aislamiento, escrita a mano. No se comparan dos
    // conjuntos traídos con la misma consulta —eso probaría que la consulta es
    // determinista—: se pinan identificadores concretos y se exige que no
    // crucen.
    for (const t of AISLAMIENTO_DECLARADO) {
      for (const code of t.marcadores.garrigues ?? []) {
        const { data: propio } = await garr.from(t.tabla)
          .select("code").eq("tenant_id", GARRIGUES).eq("code", code);
        expect(propio, `${t.tabla}: ${code} debería existir en Garrigues`).toHaveLength(1);

        const { data: ajeno, error } = await arga.from(t.tabla)
          .select("code").eq("code", code);
        expect(error).toBeNull();
        // RLS filtra: un code de Garrigues no puede llegarle a ARGA.
        expect(ajeno, `${t.tabla}: ${code} NO puede verse desde ARGA`).toEqual([]);
      }
    }
  });
});
