import { describe, expect, it, beforeAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fechaConHoraSiConsta,
  horaNoAcreditadaEn,
} from "@/lib/secretaria/fecha-sin-hora-acreditada";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

describe("C1 — la hora que no consta no se pinta como si constara", () => {
  it("con bandera: día sí, hora no", () => {
    expect(fechaConHoraSiConsta("2026-05-06T00:00:00.000Z", true))
      .toBe("6 may 2026 · hora no acreditada");
  });

  it("SIN bandera: se pinta EXACTAMENTE lo de antes (es el caso de ARGA)", () => {
    // La mitad que importa del contrato, y la que se me escapó primero: no
    // basta con que la hora siga estando. Los cuatro puntos de llamada usaban
    // TRES formatos distintos, y un helper con formato único le cambiaba a ARGA
    // «20/8/2026, 10:00:00» por «20 ago 2026, 10:00». La hora seguía ahí y aun
    // así era un cambio a ARGA, que es lo que el contrato prohíbe. Se comprueba
    // contra el literal que producía cada sitio ANTES del cambio.
    const iso = "2026-12-17T08:00:00.000Z";
    const d = new Date(iso);
    // Listas y detalle de convocatoria: `toLocaleString("es-ES")` pelado.
    expect(fechaConHoraSiConsta(iso, false)).toBe(d.toLocaleString("es-ES"));
    // Paso 1 del stepper.
    expect(fechaConHoraSiConsta(iso, false, { dateStyle: "medium", timeStyle: "short" }))
      .toBe(d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }));
    // Contenido del acta.
    expect(fechaConHoraSiConsta(iso, false, { dateStyle: "long", timeStyle: "short" }))
      .toBe(d.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" }));
  });

  it("sin fecha, guion; y la bandera tolera null y formas raras", () => {
    expect(fechaConHoraSiConsta(null, true)).toBe("—");
    expect(horaNoAcreditadaEn(null)).toBe(false);
    expect(horaNoAcreditadaEn({})).toBe(false);
    expect(horaNoAcreditadaEn({ hora_no_acreditada: "true" })).toBe(false);  // solo el boolean
    expect(horaNoAcreditadaEn({ hora_no_acreditada: true })).toBe(true);
  });
});

describe("C1 — la bandera está donde la leen las cuatro superficies, y ARGA no la tiene", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;
  beforeAll(async () => {
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
  });

  it("la reunión y la convocatoria de la Junta la declaran", async () => {
    const { data: m, error: eM } = await garr.from("meetings")
      .select("quorum_data").eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
    expect(eM).toBeNull();
    expect(horaNoAcreditadaEn(m!.quorum_data)).toBe(true);

    // `convocatorias.rule_trace`: sin esto, la lista y el detalle seguían
    // pintando «2:00» aunque la reunión ya lo declarase. Son dos tablas y hacen
    // falta las dos banderas.
    const { data: c, error: eC } = await garr.from("convocatorias")
      .select("rule_trace").eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
    expect(eC).toBeNull();
    expect(horaNoAcreditadaEn(c!.rule_trace)).toBe(true);
  });

  it("ARGA no la lleva en ninguna fila — y sus expedientes existen", async () => {
    const { data: reunionesArga } = await arga.from("meetings")
      .select("quorum_data").eq("tenant_id", DEMO_TENANT).limit(50);
    // Control: si esto fuera 0 filas, el «ninguna la lleva» sería vacuo.
    expect((reunionesArga ?? []).length).toBeGreaterThan(0);
    expect((reunionesArga ?? []).filter((r) => horaNoAcreditadaEn(r.quorum_data))).toHaveLength(0);

    const { data: convArga } = await arga.from("convocatorias")
      .select("rule_trace").eq("tenant_id", DEMO_TENANT).limit(50);
    expect((convArga ?? []).length).toBeGreaterThan(0);
    expect((convArga ?? []).filter((c) => horaNoAcreditadaEn(c.rule_trace))).toHaveLength(0);
  });
});
