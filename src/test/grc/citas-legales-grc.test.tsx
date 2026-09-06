// src/test/grc/citas-legales-grc.test.tsx
//
// Dos citas legales que la pantalla afirmaba y la norma no sostiene.
//
// [#1113] La CLASIFICACIÓN de un incidente TIC como grave se decide por el
// art. 18 de DORA (Reglamento (UE) 2022/2554) y por el Reglamento Delegado
// (UE) 2024/1772, que es el RTS de criterios y umbrales de importancia
// relativa y completa el art. 18.4. El art. 19 y el Reglamento Delegado (UE)
// 2025/301 son otra cosa: el CONTENIDO y los PLAZOS de la notificación
// (2025/301 completa el art. 20). Cotejado el 2026-09-06 contra el texto de
// EUR-Lex de ambos delegados: el título de 2024/1772 dice "criterios para la
// clasificación… y umbrales de importancia relativa"; el de 2025/301 dice
// "contenido y los plazos para la notificación inicial y los informes
// intermedio y final".
//
// [#1114] La categoría 5 de la taxonomía penal se titula "Propiedad
// Intelectual e Industrial" y citaba solo "Art. 270 CP | Ley de Patentes". El
// art. 270 CP tipifica únicamente la propiedad intelectual (arts. 270-272);
// la industrial son los arts. 273 a 277 (273 patentes y modelos de utilidad,
// 274 marcas). Y "Ley de Patentes" sin número no identifica norma: la vigente
// es la Ley 24/2015, que derogó la Ley 11/1986.
//
// Se comprueba el DATO y el DOM, nunca el fuente: un guard sobre el texto del
// fichero se dispara contra el comentario que explica la retirada.
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyDoraIncident } from "@/lib/grc/regulatory-clocks";
import { sinComentarios } from "../helpers/sin-comentarios";

afterEach(() => cleanup());

const GRAVE = {
  clientsAffectedPct: 12,
  durationHours: 3.5,
  economicImpactEuros: 150000,
  affectsCriticalFunctions: true,
  dataIntegrityLoss: false,
  thirdPartyImpact: true,
};
const MENOR = {
  clientsAffectedPct: 0,
  durationHours: 0,
  economicImpactEuros: 0,
  affectsCriticalFunctions: false,
  dataIntegrityLoss: false,
  thirdPartyImpact: false,
};

describe("#1113 — la clasificación no se atribuye a la norma de los plazos", () => {
  it("control positivo: el motor sigue clasificando como grave y como no grave", () => {
    expect(classifyDoraIncident(GRAVE).isMajorIncident).toBe(true);
    expect(classifyDoraIncident(MENOR).isMajorIncident).toBe(false);
  });

  it("el porqué de la clasificación cita el art. 18 y el RTS 2024/1772", () => {
    const motivo = classifyDoraIncident(GRAVE).rationale;
    expect(motivo).toContain("18");
    expect(motivo).toContain("2024/1772");
  });

  it("y NO se la atribuye al art. 19 ni al delegado de plazos 2025/301", () => {
    const motivo = classifyDoraIncident(GRAVE).rationale;
    expect(motivo).not.toContain("2025/301");
    expect(/\bart\.?\s*19\b/i.test(motivo)).toBe(false);
    expect(/\bartículo\s*19\b/i.test(motivo)).toBe(false);
  });

  it("la regla propia se declara simplificación de demostración, no la norma", () => {
    // El motor marca grave con dos criterios cualesquiera, o con función
    // esencial más 1h o 50.000 €. El art. 8 del RTS exige afección a servicios
    // esenciales MÁS los umbrales de sus arts. 9 y 10. Si el número que se
    // enseña no es el de la norma, la pantalla tiene que decirlo.
    const motivo = classifyDoraIncident(GRAVE).rationale.toLowerCase();
    expect(motivo).toContain("simplificada");
    expect(motivo).toContain("demostración");
  });
});

describe("#1113 — la pantalla de umbrales atribuye la clasificación al art. 18", () => {
  async function montar() {
    const { default: Thresholds } = await import("@/pages/grc/modules/dora/Thresholds");
    render(<Thresholds />);
  }

  it("el subtítulo nombra el art. 18 y el Reglamento Delegado 2024/1772", async () => {
    await montar();
    // Control positivo del instrumento: la pantalla ha montado de verdad.
    expect(screen.getByText(/Umbrales DORA/i)).toBeTruthy();
    // Sobre el SUBTÍTULO, no sobre el body: el cuerpo también pinta el motivo
    // del motor, y medir ahí haría pasar el test con el subtítulo revertido.
    const subtitulo = screen.getByText(/criterios de materialidad/i).textContent ?? "";
    expect(subtitulo).toMatch(/materialidad conforme a DORA art\. 18/i);
    expect(subtitulo).toContain("2024/1772");
  });

  it("y ya no dice que los criterios de materialidad sean el art. 19", async () => {
    await montar();
    const texto = document.body.textContent ?? "";
    expect(texto).not.toContain("materialidad conforme a DORA Art. 19");
    expect(texto).not.toContain("criterios de materialidad conforme a DORA Art. 19");
  });
});

describe("#1113 — el alta de incidente tampoco atribuye la clasificación al art. 19", () => {
  // BACKSTOP, Y ES LA CAPA DÉBIL: esto mira el FUENTE. El stepper es un
  // formulario de 5 pasos con su propio estado y montarlo entero para dos
  // rótulos estáticos no compra nada que este guard no dé. Se pasa por
  // `sinComentarios` porque el comentario que explica la retirada contiene la
  // frase retirada y dispararía el gate contra su propia justificación.
  const SRC = sinComentarios(
    readFileSync(join(process.cwd(), "src/pages/grc/IncidenteStepper.tsx"), "utf8"),
  );

  it("control positivo: los dos rótulos de clasificación siguen ahí", () => {
    expect(SRC).toContain("Momento de clasificación como Grave TIC");
    expect(SRC).toContain("Criterios de Clasificación");
  });

  it("y los dos citan el art. 18 y el RTS 2024/1772", () => {
    // El bucle filtra DOS veces, así que puede no ejecutarse ni una vez y dejar
    // el test verde con cero aserciones: si alguien retira la cita legal por
    // completo, el segundo filtro descarta las líneas y el bucle no mira nada.
    // El control positivo de arriba NO lo tapa —comprueba subcadenas que
    // sobreviven a esa retirada—, así que se cuenta lo examinado. Lo señaló la
    // review adversarial de rama.
    let examinadas = 0;
    for (const linea of SRC.split("\n")) {
      if (!/clasificaci[óo]n/i.test(linea)) continue;
      // Solo las líneas que CITAN una norma concreta. "clasificación de
      // perímetro DORA/NIS2" no atribuye nada y no tiene que citar.
      if (!/art\.?\s*1[89]\b|2024\/1772|2025\/301/i.test(linea)) continue;
      examinadas += 1;
      expect(linea, linea.trim()).toContain("2024/1772");
      expect(/\bart\.?\s*19\b/i.test(linea), linea.trim()).toBe(false);
    }
    expect(
      examinadas,
      "el bucle no examinó ninguna línea: la cita legal desapareció del stepper y este gate se quedó mirando al vacío",
    ).toBeGreaterThan(0);
  });
});

describe("#1114 — la categoría penal de propiedad intelectual e industrial", () => {
  it("cita los dos bloques del CP, no solo el de propiedad intelectual", async () => {
    const { DELITOS_TAXONOMY } = await import("@/lib/grc/penal-taxonomia");
    const cat = DELITOS_TAXONOMY.find((d) => d.id === "propiedad-intelectual");
    // Control positivo: la categoría existe y sigue cubriendo ambas materias.
    expect(cat).toBeTruthy();
    expect(cat!.title).toContain("Industrial");
    expect(cat!.lawRef).toContain("270");
    expect(cat!.lawRef).toContain("273");
  });

  it("identifica la ley de patentes por su número vigente", async () => {
    const { DELITOS_TAXONOMY } = await import("@/lib/grc/penal-taxonomia");
    const cat = DELITOS_TAXONOMY.find((d) => d.id === "propiedad-intelectual")!;
    expect(cat.lawRef).toContain("24/2015");
    // "Ley de Patentes" a secas no identifica norma: hubo dos, y la de 1986
    // está derogada desde el 1 de abril de 2017.
    expect(/Ley de Patentes/.test(cat.lawRef.replace("Ley 24/2015 de Patentes", ""))).toBe(false);
  });

  it("ninguna categoría de la taxonomía se queda sin referencia legal", async () => {
    const { DELITOS_TAXONOMY } = await import("@/lib/grc/penal-taxonomia");
    expect(DELITOS_TAXONOMY.length).toBeGreaterThan(0);
    for (const d of DELITOS_TAXONOMY) {
      expect(d.lawRef.trim().length, d.id).toBeGreaterThan(0);
    }
  });
});
