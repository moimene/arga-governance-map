// La declaración de aislamiento se comprueba contra Cloud ANTES de que el gate
// la use.
//
// Es el paso que G4 documentó y que casi todo el mundo se salta: si una tabla
// no tiene filas en uno de los dos tenants, la aserción de aislamiento en esa
// dirección pasa **sin comprobar nada**. Verde y vacía.
//
// Aquí la vacuidad no se tolera ni se prohíbe: se MIDE y se cuenta contra un
// techo commiteado (`VACUIDAD_MAXIMA`). Sembrar lo baja —progresar es verde—;
// perder dato sembrado lo sube por encima del techo y rompe.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";
import {
  AISLAMIENTO_DECLARADO,
  ARGA,
  CON_AUSENCIA_DECLARADA,
  GARRIGUES,
  VACUIDAD_MAXIMA,
  direccionesVacuas,
  type Conteo,
} from "./aislamiento-declarado";
import { verificarCita } from "./cita-verificable";

describe("C3 Tarea 8 — la declaración de aislamiento cuadra con Cloud", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;
  /** Lo que hay de verdad. Se mide UNA vez y lo usan la declaración y el trinquete. */
  const medido = new Map<string, Conteo>();

  beforeAll(async () => {
    // Sin graceful-skip. Una sonda que se salta a sí misma cuando no puede
    // autenticar es un gate verde que no asierta nada — que es justo el vicio
    // que este fichero existe para no repetir.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);

    await Promise.all(
      AISLAMIENTO_DECLARADO.map(async (t) => {
        const [ra, rg] = await Promise.all([
          arga.from(t.tabla).select("id").eq("tenant_id", ARGA).limit(1),
          garr.from(t.tabla).select("id").eq("tenant_id", GARRIGUES).limit(1),
        ]);
        // Una medición fallida NO puede contarse como «cero filas»: eso
        // convertiría un error de red en una vacuidad falsa, o peor, en un
        // trinquete que baja solo. Se lanza y la suite se pone roja.
        if (ra.error || rg.error) {
          throw new Error(`${t.tabla}: medición fallida — ${(ra.error ?? rg.error)!.message}`);
        }
        medido.set(t.tabla, { arga: ra.data.length, garrigues: rg.data.length });
      }),
    );
  }, 60_000);

  it("cada presencia declarada es la que hay, en los dos tenants", () => {
    for (const t of AISLAMIENTO_DECLARADO) {
      const c = medido.get(t.tabla)!;
      for (const [tenant, presencia, filas] of [
        ["ARGA", t.arga, c.arga],
        ["Garrigues", t.garrigues, c.garrigues],
      ] as const) {
        if (presencia === "ALGUNA") {
          // LA PERSISTENCIA. Dato sembrado que desaparece es un defecto, no una
          // limpieza: si esto se pone rojo, alguien borró o pisó filas del
          // tenant y hay que recuperarlas, no bajar la declaración a PENDIENTE.
          expect(filas, `${t.tabla}: ${tenant} declarada ALGUNA y no tiene NI UNA fila`)
            .toBeGreaterThan(0);
        } else if (presencia === "NINGUNA") {
          // Ausencia permanente que deja de serlo: la decisión se revirtió sin
          // decirlo. Rompe igual que la de arriba.
          expect(filas, `${t.tabla}: ${tenant} declarada NINGUNA y tiene filas`).toBe(0);
        }
        // `PENDIENTE` no asierta el conteo A PROPÓSITO: con filas o sin ellas
        // pasa, para que avanzar la siembra nunca ponga la corrida en rojo. Su
        // vacuidad la vigila el trinquete, que mide y no cree a la etiqueta.
      }
    }
  });

  it("el trinquete: sembrar baja la vacuidad, perder dato la sube por encima del techo", () => {
    const vacuas = direccionesVacuas(medido);
    expect(
      vacuas.length,
      `Hay ${vacuas.length} direcciones de aislamiento vacuas y el techo commiteado es ` +
        `${VACUIDAD_MAXIMA}. Vacuas ahora mismo:\n  - ${vacuas.join("\n  - ")}\n\n` +
        "Si acabas de BORRAR dato de un tenant, eso es el defecto: recupéralo. Cambiar la " +
        "declaración de ALGUNA a PENDIENTE no arregla esto — el conteo mide filas, no " +
        "etiquetas. Si has AÑADIDO una tabla nueva cuya dirección es vacua, sube " +
        "VACUIDAD_MAXIMA a mano con la medición al lado: una aserción vacua más es una " +
        "decisión, no un descuido.",
    ).toBeLessThanOrEqual(VACUIDAD_MAXIMA);

    // Control del INSTRUMENTO: el trinquete tiene que estar contando algo. Con
    // el mapa a medias, `direccionesVacuas` lanza; con el mapa completo pero
    // todas las tablas llenas, este número sería 0 y el techo dejaría de tener
    // sentido — habría que bajarlo. Se afirma lo que hoy es cierto.
    expect(medido.size, "hay tablas declaradas sin medir").toBe(AISLAMIENTO_DECLARADO.length);
    expect(vacuas.length, "si ya no queda vacuidad, baja VACUIDAD_MAXIMA a 0").toBeGreaterThan(0);
  });

  it("motivo y ausencia permanente van juntos, en los dos sentidos", () => {
    // Un solo control, con las dos direcciones dentro y el arreglo en el
    // mensaje. Antes eran dos tests: quien cambiaba solo el flag se comía un
    // segundo rojo en otro sitio que no explicaba su causa.
    expect(CON_AUSENCIA_DECLARADA.length).toBeGreaterThan(0);
    for (const t of AISLAMIENTO_DECLARADO) {
      const permanente = t.arga === "NINGUNA" || t.garrigues === "NINGUNA";
      expect(
        !!t.motivo,
        permanente
          ? `${t.tabla} declara NINGUNA y no trae motivo. Sin motivo, «vacía a propósito» es ` +
            "indistinguible de «vacía porque alguien quería que el gate callara»."
          : `${t.tabla} arrastra un motivo sin declarar ninguna ausencia permanente ` +
            `(arga=${t.arga}, garrigues=${t.garrigues}). Si acabas de cambiar el flag, QUITA ` +
            "también el motivo aquí mismo: documenta una ausencia que ya no existe.",
      ).toBe(permanente);
    }

    for (const t of CON_AUSENCIA_DECLARADA) {
      expect(t.motivo!.texto.length).toBeGreaterThan(60);
      // La fuente tiene que apuntar a algo COMPROBABLE. Dos formas valen, y la
      // segunda es más fuerte que la primera:
      //
      //   - una cita localizable —política con apartado, artículo, commit—, o
      //   - una `alternativa`, que no es prosa: el test de abajo va a Cloud y
      //     comprueba que el dato está donde la declaración dice.
      const citaLocalizable = /§|commit|art\./.test(t.motivo!.fuente);
      expect(citaLocalizable || !!t.alternativa,
        `${t.tabla}: motivo sin cita localizable NI alternativa comprobable`).toBe(true);

      // Y si la cita apunta a un apartado de un documento interno, ese apartado
      // tiene que EXISTIR en su índice. El regex de arriba es de FORMA: acepta
      // «§246» igual que «§4.2», y «§246» no existe — son posiciones de párrafo
      // del volcado del PDF escritas con signo de apartado. Lo cazó la lente
      // adversarial, y tenía razón: el mecanismo que este fichero presentaba
      // como su logro era imposible de fallar.
      const verificada = verificarCita(t.motivo!.fuente);
      if (verificada) {
        expect(
          verificada.existe,
          `${t.tabla}: cita a ${verificada.codigo} §${verificada.apartado}, que NO está en su índice`,
        ).toBe(true);
      }
    }
  });

  it("donde se declara una alternativa, el dato SÍ está allí", async () => {
    // Lo que convierte la inferencia en invariante. Si alguien migrara las
    // plantillas a `document_templates`, esta mitad bajaría a cero y la
    // declaración dejaría de cuadrar — que es justo lo que debe pasar.
    const conAlternativa = AISLAMIENTO_DECLARADO.filter((t) => t.alternativa);
    expect(conAlternativa.length).toBeGreaterThan(0);
    for (const t of conAlternativa) {
      const { data, error } = await garr.from(t.alternativa!.tabla)
        .select("id").eq("tenant_id", GARRIGUES).limit(500);
      expect(error, `${t.alternativa!.tabla}`).toBeNull();
      expect(data.length, `${t.tabla} declara que el dato vive en ${t.alternativa!.tabla}`)
        .toBeGreaterThanOrEqual(t.alternativa!.minimo);
    }
  });

  it("los marcadores existen donde se declaran y NO en el otro tenant", async () => {
    // La invariante de aislamiento, escrita a mano. No se comparan dos
    // conjuntos traídos con la misma consulta —eso probaría que la consulta es
    // determinista—: se pinan identificadores concretos y se exige que no
    // crucen.
    //
    // Es además la otra mitad de la PERSISTENCIA: un marcador es una fila
    // concreta y sembrada. Si desaparece, esto rompe aunque la tabla siga
    // teniendo otras filas y la presencia siga cuadrando.
    for (const t of AISLAMIENTO_DECLARADO) {
      for (const code of t.marcadores.garrigues ?? []) {
        const { data: propio } = await garr.from(t.tabla)
          .select("code").eq("tenant_id", GARRIGUES).eq("code", code);
        expect(propio, `${t.tabla}: ${code} debería existir en Garrigues`).toHaveLength(1);

        // Control POSITIVO del cliente de ARGA, no del de Garrigues. Si la
        // sesión de ARGA estuviera caída o RLS le tapara la tabla entera, la
        // ausencia de abajo pasaría **por ceguera**, no por aislamiento. Y el
        // `propio` de arriba no sirve: comprueba el OTRO cliente.
        const { data: veLoSuyo } = await arga.from(t.tabla)
          .select("id").eq("tenant_id", ARGA).limit(1);
        expect(veLoSuyo, `${t.tabla}: ARGA no ve ni lo suyo`).toHaveLength(1);

        const { data: ajeno, error } = await arga.from(t.tabla)
          .select("code").eq("code", code);
        expect(error).toBeNull();
        // RLS filtra: un code de Garrigues no puede llegarle a ARGA.
        expect(ajeno, `${t.tabla}: ${code} NO puede verse desde ARGA`).toEqual([]);
      }
    }
  });
});
