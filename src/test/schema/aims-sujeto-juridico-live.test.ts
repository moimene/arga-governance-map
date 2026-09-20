// src/test/schema/aims-sujeto-juridico-live.test.ts
//
// F2.T1, G-VIVO-NEG — el criterio de sujeto contra el dato REAL de los dos
// tenants, leído con logins reales igual que lo lee la pantalla. SÓLO LECTURA.
//
// Qué vigila, y por qué así:
//
//  1. **Toda entidad viva clasifica.** La invariante no es «hay 31 y 33», que
//     se rompería al sembrar —y sembrar Garrigues es requisito desde el
//     2026-09-07—, sino que ninguna entidad cae en `SIN_CLASIFICAR`. Sembrar
//     una sociedad con una forma conocida sigue verde; estrenar una forma que
//     el criterio no conoce se pone rojo, que es exactamente lo que debe pasar:
//     hay que clasificarla, no ignorarla.
//  2. **La copia declarada de ARGA no ha divergido.** `FORMAS_ARGA_MEDIDAS` es
//     una copia congelada, y una copia que nadie contrasta es un verde falso.
//     Aquí se contrasta en las dos direcciones, y el mensaje dice actualizar la
//     copia —nunca revertir Cloud—.
//  3. **Dos sujetos elegibles no comparten etiqueta**, con el dato real: si dos
//     personas jurídicas distintas se llamaran igual en pantalla, sus
//     obligaciones se mezclarían.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe, type CuentaDemo } from "../helpers/supabase-test-client";
import {
  esEntidadElegible,
  etiquetaSociedad,
  normalizaForma,
  type EntidadSujeto,
} from "@/lib/aims/sujeto-juridico";
import { FORMAS_ARGA_MEDIDAS, FORMAS_ARGA_MEDIDAS_EL } from "../aims/formas-juridicas-medidas";

type Fila = {
  slug: string;
  legal_name: string;
  legal_form: string | null;
  group_role: string | null;
  entity_status: string | null;
};

const comoSujeto = (f: Fila): EntidadSujeto => ({
  slug: f.slug,
  legalName: f.legal_name,
  legalForm: f.legal_form,
  groupRole: f.group_role,
  entityStatus: f.entity_status,
});

async function leer(cliente: SupabaseClient, tenant: string): Promise<Fila[]> {
  const { data, error } = await cliente
    .from("entities")
    .select("slug, legal_name, legal_form, group_role, entity_status")
    .eq("tenant_id", tenant);
  if (error) throw new Error(`lectura de entities: ${error.message}`);
  return (data ?? []) as Fila[];
}

const TENANTS: Array<[CuentaDemo, string]> = [
  ["ARGA", DEMO_TENANT],
  ["GARRIGUES", GARRIGUES_TENANT],
];

describe("F2.T1 en vivo — el criterio de sujeto cubre el perímetro real", () => {
  const dato = new Map<CuentaDemo, Fila[]>();

  beforeAll(async () => {
    for (const [cuenta, tenant] of TENANTS) dato.set(cuenta, await leer(await sesionDe(cuenta), tenant));
  }, 30_000);

  it("control positivo: los dos tenants tienen entidades, o la invariante sería vacua", () => {
    for (const [cuenta] of TENANTS) {
      expect(dato.get(cuenta)!.length, `${cuenta} sin entidades`).toBeGreaterThan(10);
    }
  });

  for (const [cuenta] of TENANTS) {
    it(`${cuenta}: ninguna entidad viva queda sin clasificar`, () => {
      const sinClase = dato
        .get(cuenta)!
        .map(comoSujeto)
        .filter((e) => esEntidadElegible(e).clase === "SIN_CLASIFICAR")
        .map((e) => `${e.slug} (${e.legalForm ?? "sin forma"})`);
      expect(
        sinClase,
        `${cuenta}: formas jurídicas que CLASE_POR_FORMA no conoce. Clasifícalas en src/lib/aims/sujeto-juridico.ts`,
      ).toEqual([]);
    });

    it(`${cuenta}: dos entidades elegibles no comparten etiqueta`, () => {
      const etiquetas = dato
        .get(cuenta)!
        .map(comoSujeto)
        .filter((e) => esEntidadElegible(e).elegible)
        .map(etiquetaSociedad);
      expect(etiquetas.length, `${cuenta} sin elegibles`).toBeGreaterThan(5);
      const repetidas = etiquetas.filter((x, i) => etiquetas.indexOf(x) !== i);
      expect([...new Set(repetidas)], `${cuenta}: etiquetas repetidas entre sujetos distintos`).toEqual([]);
    });
  }

  it("la copia declarada de las formas de ARGA sigue cuadrando con Cloud", () => {
    const enCloud = new Set(dato.get("ARGA")!.map((f) => normalizaForma(f.legal_form)));
    const declaradas = new Set(FORMAS_ARGA_MEDIDAS.map(normalizaForma));
    const nuevasEnCloud = [...enCloud].filter((f) => !declaradas.has(f));
    const yaNoEstan = [...declaradas].filter((f) => !enCloud.has(f));
    expect(
      { nuevasEnCloud, yaNoEstan },
      `la copia de src/test/aims/formas-juridicas-medidas.ts (medida el ${FORMAS_ARGA_MEDIDAS_EL}) ha divergido: actualiza la copia, no Cloud`,
    ).toEqual({ nuevasEnCloud: [], yaNoEstan: [] });
  });
});
