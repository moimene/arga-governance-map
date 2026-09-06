// src/test/sii/sii-anonimo-via-postal.test.tsx
//
// La comunicación ANÓNIMA del Canal Interno de Garrigues se presenta por
// correo postal. No es una preferencia de diseño: PI-31, Anexo §3.c lo dice
// con todas las letras —«Las comunicaciones podrán realizarse de forma anónima
// mediante el envío de una comunicación postal conforme a lo indicado en el
// apartado a) (ii) anterior, sin identificación del remitente»— y el apartado
// a) reserva el formulario web a la otra vía.
//
// El portal ofrecía el formulario web para el anónimo estricto y los tres
// casos demo se sembraban así, con lo que el Libro-registro y la columna
// «Canal / Modalidad» del listado enseñaban una vía que la política del
// despacho no da para esa modalidad.
//
// SE JUZGA EL DATO ESCRITO, no el rótulo: el caso decisivo captura lo que la
// pantalla ENVÍA a la mutación. Leer «Correo Postal» resaltado no probaría que
// el expediente se registre con ese canal.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockearModulos } from "../garrigues/_mock-restaurable";
import { SII_TENANT } from "../../../scripts/garrigues/sii/canal-interno";
import { CASOS_DEMO_GARRIGUES } from "../../../scripts/garrigues/sii/casos-demo";

const ARGA = "00000000-0000-0000-0000-000000000001";

if (typeof globalThis.getComputedStyle === "undefined" && typeof window !== "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}
// La mutación resuelve DESPUÉS del clic y su `setStep(4)` cae fuera de act():
// sin declararlo, la salida se llena de avisos que taparían un fallo real.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let tenantActual: string | null = SII_TENANT;
let altaRecibida: Record<string, unknown> | null = null;

const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  [
    "@/hooks/useEntities",
    () => ({
      useEntitiesList: () => ({
        data: [{ id: "ent-1", common_name: "J&A Garrigues", legal_name: "J&A Garrigues, S.L.P.", jurisdiction: "ES" }],
        isLoading: false,
      }),
    }),
  ],
  [
    "@/hooks/useWhistleblowing",
    () => ({
      useCreateWhistleblowingReport: () => ({
        mutateAsync: async (args: Record<string, unknown>) => {
          altaRecibida = args;
          return { code: "SII-TEST-001", trackingToken: "SEC-TEST-0001" };
        },
        isPending: false,
      }),
    }),
  ],
]);
afterAll(restaurarMocks);
afterEach(() => {
  cleanup();
  altaRecibida = null;
});

async function montar(tenant: string | null) {
  tenantActual = tenant;
  const { default: SiiPortalIntake } = await import("@/pages/sii/SiiPortalIntake");
  render(
    <MemoryRouter>
      <SiiPortalIntake />
    </MemoryRouter>,
  );
}

/** Paso 1 → paso 2. El selector de canal vive en el paso 2. */
const irACanal = () => fireEvent.click(screen.getByText(/Continuar a Hechos y Canal/));

const boton = (label: RegExp) =>
  screen.getByText(label).closest("button") as HTMLButtonElement;

describe("SII Garrigues — el anónimo entra por la vía que prevé PI-31 Anexo §3.c", () => {
  it("la pantalla no ofrece el formulario web para el anónimo estricto, y cita el apartado", async () => {
    await montar(SII_TENANT);
    irACanal();
    expect(boton(/Formulario Web Seguro/).disabled).toBe(true);
    expect(boton(/Correo Postal/).disabled).toBe(false);
    expect(screen.getByText(/PI-31, Anexo §3\.c/)).toBeTruthy();
  });

  it("y el expediente se REGISTRA con canal postal: lo que se escribe, no lo que se pinta", async () => {
    await montar(SII_TENANT);
    irACanal();
    fireEvent.change(screen.getByDisplayValue("— Seleccione la entidad —").closest("select")!, {
      target: { value: "ent-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Presunta irregularidad/), {
      target: { value: "Hechos comunicados de forma anónima." },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describa los hechos|Detalle/i), {
      target: { value: "Descripción de los hechos sin datos identificativos innecesarios." },
    });
    fireEvent.click(screen.getByText(/Continuar a Evidencias/));
    await act(async () => {
      fireEvent.click(screen.getByText(/^Registrar comunicación$/));
    });

    expect(altaRecibida).not.toBeNull();
    expect(altaRecibida!.anonymityMode).toBe("ANONIMO_ESTRICTO");
    expect(altaRecibida!.channel).toBe("POSTAL");
  });

  it("CONTROL: en modalidad confidencial el formulario web sigue disponible", async () => {
    // Sin esto, deshabilitar el web SIEMPRE pasaría el caso de arriba. El
    // §3.a (i) sí prevé la aplicación web: lo que la política reconduce al
    // postal es el anónimo, no toda comunicación.
    await montar(SII_TENANT);
    fireEvent.click(screen.getByText(/Confidencial con Identificación/));
    irACanal();
    expect(boton(/Formulario Web Seguro/).disabled).toBe(false);
    expect(screen.queryByText(/PI-31, Anexo §3\.c/)).toBeNull();
  });

  it("CONTROL ARGA: PI-31 no es su política y su portal no cambia", async () => {
    await montar(ARGA);
    irACanal();
    expect(boton(/Formulario Web Seguro/).disabled).toBe(false);
    expect(boton(/Correo Postal/).disabled).toBe(false);
    expect(screen.queryByText(/PI-31/)).toBeNull();
  });
});

describe("SII Garrigues — los casos demo se siembran por la vía que les corresponde", () => {
  it("todo caso anónimo estricto entra por POSTAL", () => {
    const anonimos = CASOS_DEMO_GARRIGUES.filter((c) => c.anonymityMode === "ANONIMO_ESTRICTO");
    expect(anonimos.length).toBeGreaterThan(0);
    for (const c of anonimos) expect(c.channel).toBe("POSTAL");
  });

  it("CONTROL: y los que NO son anónimos conservan el formulario web", () => {
    // Poner los tres en POSTAL satisfaría el caso anterior sin decir nada.
    const identificados = CASOS_DEMO_GARRIGUES.filter(
      (c) => c.anonymityMode !== "ANONIMO_ESTRICTO",
    );
    expect(identificados.length).toBeGreaterThan(0);
    expect(identificados.every((c) => c.channel === "WEB_ANONIMO")).toBe(true);
  });
});

describe("SII Garrigues — el canal corregido atraviesa el caché del navegador", () => {
  // ESTE es el bloque que faltaba, y lo señaló la review adversarial de rama.
  // Los dos de arriba comprueban el CATÁLOGO y el formulario de alta; ninguno
  // toca `getStoredReports`, que solo siembra cuando la clave NO existe. Un
  // navegador que ya hubiera abierto /sii —el de la demo, sin ir más lejos—
  // seguía devolviendo `WEB_ANONIMO` desde localStorage, y ese canal viciado
  // se pinta en el listado, en la ficha y en el asiento del Libro-registro.
  // Es el mismo patrón de arista rota por CACHÉ que ya ocurrió con `firmeza`.
  const sembrarClaveVieja = async () => {
    const { siiStorageKey } = await import("@/lib/sii/tenant-scope");
    const previos = CASOS_DEMO_GARRIGUES.map((c) => ({ ...c, channel: "WEB_ANONIMO" }));
    localStorage.setItem(siiStorageKey(SII_TENANT), JSON.stringify(previos));
  };

  afterEach(() => localStorage.clear());

  it("con la clave YA creada, los anónimos se leen como POSTAL", async () => {
    await sembrarClaveVieja();
    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const leidos = getStoredReports(SII_TENANT);

    const anonimos = leidos.filter((r) => r.anonymityMode === "ANONIMO_ESTRICTO");
    expect(anonimos.length, "sin anónimos la aserción sería vacua").toBeGreaterThan(0);
    for (const r of anonimos) expect(r.channel, `${r.code} sigue viniendo del caché`).toBe("POSTAL");
  });

  it("CONTROL: la reaplicación no arrasa los expedientes dados de alta", async () => {
    // Sin esto, «reaplicar el catálogo entero» pasaría el caso anterior
    // borrando lo que el usuario haya registrado.
    const { siiStorageKey } = await import("@/lib/sii/tenant-scope");
    const propio = { ...CASOS_DEMO_GARRIGUES[0], code: "SII-ALTA-PROPIA", channel: "WEB_ANONIMO" };
    localStorage.setItem(
      siiStorageKey(SII_TENANT),
      JSON.stringify([...CASOS_DEMO_GARRIGUES, propio]),
    );
    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const propioLeido = getStoredReports(SII_TENANT).find((r) => r.code === "SII-ALTA-PROPIA");
    expect(propioLeido, "el expediente de alta desapareció").toBeDefined();
    expect(propioLeido!.channel, "no está en el catálogo: nadie decide su canal").toBe("WEB_ANONIMO");
  });
});
