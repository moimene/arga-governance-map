// src/test/schema/eipd-pantalla.test.ts
//
// MOI-175 F5.T12 — la pantalla de EIPD se rotula "EIPD (art. 35 RGPD)" y
// NUNCA "EIDF" (DS-37, RH-5: son objetos distintos — la EIDF cubre derechos
// más amplios que la EIPD no evalúa). Se juzga lo RENDERIZADO, no la prosa
// que lo explica: por eso se descartan los comentarios antes de mirar
// (patrón `sinComentarios`, ver su cabecera).
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";

const PAGINA = join(process.cwd(), "src/pages/grc/Eipd.tsx");

describe("MOI-175 F5.T12 — rótulos de la pantalla EIPD", () => {
  const fuenteSinComentarios = sinComentarios(readFileSync(PAGINA, "utf-8"));

  it("dice 'EIPD (art. 35 RGPD)' — control positivo del propio instrumento", () => {
    expect(fuenteSinComentarios).toMatch(/EIPD \(art\. 35 RGPD\)/);
  });

  it("nunca llama 'EIDF' al objeto que renderiza — solo la nombra para decir que es OTRO objeto", () => {
    const menciones = fuenteSinComentarios.match(/[^\n]*EIDF[^\n]*/g) ?? [];
    expect(menciones.length, "el fichero no menciona EIDF en absoluto").toBeGreaterThan(0);
    for (const linea of menciones) {
      expect(linea, `mención de EIDF sin marcarla como objeto distinto: ${linea}`).toMatch(
        /distint[ao]|objeto distinto/i
      );
    }
  });

  it("no vive bajo /grc/m/gdpr (esa es la ficha fija de demo, DS-37 pide un objeto propio)", () => {
    expect(fuenteSinComentarios).not.toMatch(/grc\/m\/gdpr/);
  });
});
