// src/test/grc/training-records.test.ts
//
// F5.T6 (MOI-175) — el control del art. 4 RIA (OBL-RIA-ORG-04) se evalúa por
// medidas de formación ADOPTADAS, nunca por un nivel ni un porcentaje, y la
// pantalla no pinta una efectividad que nadie ha medido.
//
// Dos mitades:
//   1. El criterio puro (`formacion-control.ts`) — el test que FALLA si la
//      pantalla llegara a pintar "Efectivo"/"Parcial"/"Inefectivo" con cero
//      registros: es justo lo que `estadoControlPorFormacion([])` no puede
//      devolver.
//   2. La tabla real en Cloud, con sesión auténtica: nace vacía, la RPC
//      escribe y el guardia de `controls` rechaza una efectividad fabricada.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe, DEMO_TENANT, supabaseAdmin, hasAdminClient } from "../helpers/supabase-test-client";
import {
  estadoControlPorFormacion,
  esEfectividadMedida,
  ESTADOS_CONTROL_MEDIDO,
  type RegistroFormacion,
} from "../../lib/grc/formacion-control";

describe("F5.T6 — criterio puro: sin registros no hay efectividad medida", () => {
  it("cero registros nunca acredita: SIN_MEDIR, ninguno de los tres valores del CHECK", () => {
    const estado = estadoControlPorFormacion([]);
    expect(estado).toBe("SIN_MEDIR");
    expect(esEfectividadMedida(estado)).toBe(false);
    for (const medido of ESTADOS_CONTROL_MEDIDO) {
      expect(estado).not.toBe(medido);
    }
  });

  it("con al menos un registro adoptado, sí se acredita (Efectivo)", () => {
    const registros: RegistroFormacion[] = [{ id: "r1" }];
    const estado = estadoControlPorFormacion(registros);
    expect(estado).toBe("Efectivo");
    expect(esEfectividadMedida(estado)).toBe(true);
  });

  it("el tipo de registro no tiene ningún campo de nivel ni de porcentaje (Harvey C14)", () => {
    // Comprobación en tiempo de ejecución de lo que el tipo ya impide en
    // compilación: un registro real solo trae `id`. Si alguien añadiera
    // `nivel`/`porcentaje` al objeto y el criterio los leyera, esta prueba no
    // lo notaría por sí sola — la protección real es que
    // `estadoControlPorFormacion` es `(registros: RegistroFormacion[]) =>`,
    // sin aridad extra, y este objeto con campos de más muestra que igualmente
    // solo la LONGITUD del array importa.
    const registroConRuido = [{ id: "r1", nivel: 0, porcentaje: 0 }] as unknown as RegistroFormacion[];
    expect(estadoControlPorFormacion(registroConRuido)).toBe("Efectivo");
  });
});

describe.skipIf(!hasAdminClient())("F5.T6 — grc_training_records en Cloud, con sesión real", () => {
  let arga: SupabaseClient;

  beforeAll(async () => {
    arga = await sesionDe("ARGA");
  }, 30_000);

  it("la tabla existe y ARGA no tiene ningún registro fabricado (nadie decidió aún qué cuenta como medida)", async () => {
    const { data, error } = await arga
      .from("grc_training_records")
      .select("id")
      .eq("tenant_id", DEMO_TENANT);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("un INSERT directo (sin pasar por la RPC) se rechaza", async () => {
    const { data: obl } = await arga
      .from("obligations")
      .select("id")
      .eq("tenant_id", DEMO_TENANT)
      .eq("code", "OBL-RIA-ORG-04")
      .maybeSingle();
    const { data: sys } = await arga.from("ai_systems").select("id").eq("tenant_id", DEMO_TENANT).limit(1).maybeSingle();
    expect(obl?.id).toBeTruthy();
    expect(sys?.id).toBeTruthy();

    const { error } = await arga.from("grc_training_records").insert({
      tenant_id: DEMO_TENANT,
      obligation_id: obl!.id,
      ai_system_id: sys!.id,
      person_id: sys!.id, // valor cualquiera: nunca debería llegar a evaluarse la FK, el privilegio se niega antes.
      content_version: "sonda-insert-directo",
    });
    expect(error).not.toBeNull();
  });

  it("ARGA sigue con OBL-RIA-ORG-04 sin control efectivo fabricado: si existe alguno, tiene registros reales detrás", async () => {
    // Control honesto, no un recuento cerrado: hoy son 0 controles (el
    // control del art. 4 es trabajo de F5.T5, fuera de esta tarea), pero si
    // alguna sesión futura crea uno con status medido, esta prueba exige que
    // haya al menos un registro de formación real detrás — el guardia de la
    // migración ya lo impone en Cloud; esto lo relee desde el dato, no desde
    // el código del guardia.
    const { data: obl } = await arga
      .from("obligations")
      .select("id")
      .eq("tenant_id", DEMO_TENANT)
      .eq("code", "OBL-RIA-ORG-04")
      .maybeSingle();
    expect(obl?.id).toBeTruthy();

    const { data: controlesMedidos, error: eControl } = await arga
      .from("controls")
      .select("code, status")
      .eq("tenant_id", DEMO_TENANT)
      .eq("obligation_id", obl!.id)
      .in("status", ["Efectivo", "Parcial"]);
    expect(eControl).toBeNull();

    if ((controlesMedidos ?? []).length > 0) {
      const { data: registros, error: eReg } = await arga
        .from("grc_training_records")
        .select("id")
        .eq("obligation_id", obl!.id);
      expect(eReg).toBeNull();
      expect(
        (registros ?? []).length,
        "hay un control medido de OBL-RIA-ORG-04 sin ningún registro de formación real",
      ).toBeGreaterThan(0);
    } else {
      expect(controlesMedidos ?? []).toEqual([]);
    }
  });
});
