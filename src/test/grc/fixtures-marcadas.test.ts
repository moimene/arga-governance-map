// src/test/grc/fixtures-marcadas.test.ts
//
// [#107] Las pantallas de módulo GRC que pintan un array literal del código
// deben llevar el aviso de procedencia. `audit/Program.tsx` servía el plan
// anual de auditoría —misiones, recuentos de hallazgos, aprobación por la
// Comisión— con la misma tipografía y los mismos chips que el dato real, sin
// ninguna marca.
//
// La regla se comprueba por BARRIDO, no sobre una lista escrita a mano: una
// pantalla nueva sin origen de dato y sin aviso cae aquí sola. Y va en un solo
// sentido a propósito —«no conectada ⇒ marcada»—, porque una pantalla
// conectada puede tener además una sección de fixture legítimamente marcada.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";

const RAIZ = join(process.cwd(), "src/pages/grc/modules");

function pantallas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return pantallas(p);
    return n.endsWith(".tsx") ? [p] : [];
  });
}

// Único caso sin aviso a propósito, con su motivo. `Thresholds.tsx` no publica
// un conjunto de registros: es un simulador sobre criterios que el usuario
// edita en pantalla, y el resultado lo calcula `classifyDoraIncident`. Marcarlo
// como «contenido de demostración» sería etiquetar mal una calculadora.
const EXCEPCIONES: Record<string, string> = {
  "dora/Thresholds.tsx": "simulador sobre criterios editables, no un conjunto de registros",
};

const rel = (p: string) => p.slice(RAIZ.length + 1);

// Señales de que la pantalla trae su contenido de Cloud.
//
// Se exige una LLAMADA, no una mención. Antes bastaba con que la palabra
// `supabase` apareciera en el fichero, así que un `import { supabase }` sin usar
// —o un comentario que lo nombrara— eximía a la pantalla de llevar el aviso: el
// guard se derrotaba con un señuelo, que es justo la forma de gate vacuo que
// este repo ya tiene documentada.
//
// Las siete pantallas realmente conectadas se midieron una a una: cinco leen
// con `useQuery(` (audit/ActionPlans, audit/Findings, cyber/Vulnerabilities,
// dora/BCM, dora/RTO) y dos con `useIncidents(` (cyber/Incidents,
// dora/Incidents). Ninguna necesita la mención suelta para ser reconocida.
const CONECTADA = /supabase\s*\.\s*from\s*\(|useQuery\s*\(|useIncidents\s*\(/;

describe("#107 — las pantallas de fixture GRC van marcadas", () => {
  const ficheros = pantallas(RAIZ);

  it("el barrido encuentra pantallas de verdad", () => {
    // Control positivo: si la ruta cambiara, la lista quedaría vacía y todas
    // las aserciones de abajo pasarían de forma vacua.
    expect(ficheros.length).toBeGreaterThanOrEqual(10);
  });

  it("toda pantalla sin origen de dato monta DemoFixtureNotice", () => {
    const sinMarca = ficheros.filter((f) => {
      const src = sinComentarios(readFileSync(f, "utf8"));
      if (CONECTADA.test(src)) return false;
      if (EXCEPCIONES[rel(f)]) return false;
      // Con `includes` bastaba un componente cuyo nombre EMPIECE igual
      // (`<DemoFixtureNoticeX`) para satisfacer el gate. Se exige el cierre del
      // nombre: `<DemoFixtureNotice` seguido de espacio, `/` o `>`.
      return !/<DemoFixtureNotice[\s/>]/.test(src);
    });
    expect(sinMarca.map(rel)).toEqual([]);
  });

  it("en concreto, el plan anual de auditoría", () => {
    const src = sinComentarios(readFileSync(join(RAIZ, "audit/Program.tsx"), "utf8"));
    // Control positivo: es el fichero que toca y sigue sirviendo el fixture.
    expect(src).toContain("AUDIT_PLAN_2026");
    expect(src).not.toMatch(CONECTADA);
    expect(src).toContain("<DemoFixtureNotice");
  });

  it("y no se ha marcado en bloque: lo conectado NO lleva el aviso", () => {
    // Si alguien «arregla» el gate poniendo el aviso en todas partes, esto cae:
    // decirle a un usuario que su hallazgo real es una demo es el error opuesto
    // y de la misma familia.
    for (const conectada of ["audit/Findings.tsx", "audit/ActionPlans.tsx", "cyber/Vulnerabilities.tsx"]) {
      const src = sinComentarios(readFileSync(join(RAIZ, conectada), "utf8"));
      expect(src).toMatch(CONECTADA);
      expect(src).not.toContain("<DemoFixtureNotice");
    }
  });

  it("cada excepción declara su motivo y sigue existiendo", () => {
    for (const [ruta, motivo] of Object.entries(EXCEPCIONES)) {
      expect(motivo.length).toBeGreaterThan(20);
      const src = sinComentarios(readFileSync(join(RAIZ, ruta), "utf8"));
      // Lo que sostiene la excepción: no hay conjunto de registros literal,
      // hay un cálculo sobre entrada del usuario.
      expect(src).toContain("classifyDoraIncident");
      expect(src).toContain("useState");
    }
  });
});
