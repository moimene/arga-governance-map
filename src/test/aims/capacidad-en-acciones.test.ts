import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { CAPABILITY_LABELS } from "@/hooks/useCapabilityMatrix";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

/**
 * F2.T6 (MOI-170) — cada acción de escritura de AIMS consulta su capacidad
 * antes de ofrecerse, y sin ella no desaparece en silencio: queda el aviso
 * "Tu rol puede consultar esta información, pero no ejecutar esta acción."
 * (mismo texto que ya usa `DocumentosPendientesRevision.tsx` en Secretaría).
 *
 * Gate de ARISTA, no de rótulo: no basta con importar el hook (import
 * muerto), tiene que llamarse con la acción AIMS_* correcta Y el fichero
 * tiene que poder pintar el aviso cuando la capacidad falta. Un botón que
 * sólo se deshabilita (`disabled`) sin ocultarse y sin aviso no cumple el
 * criterio de aceptación de F2.T6 ("los botones no aparecen").
 */

const ACCIONES: Record<string, string> = {
  "src/pages/ai-governance/SistemaNuevo.tsx": "AIMS_INVENTARIO",
  "src/components/ai-governance/clasificacion/ClasificacionGuiada.tsx": "AIMS_CLASIFICAR",
  "src/components/ai-governance/evaluacion/PasoRevision.tsx": "AIMS_EVALUAR",
  "src/pages/ai-governance/EvaluacionNueva.tsx": "AIMS_EVALUAR",
  "src/pages/ai-governance/IncidenteNuevo.tsx": "AIMS_INCIDENTE",
};

const read = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("control positivo del instrumento", () => {
  it("los cinco ficheros de F2.T6 existen (un directorio vacío no probaría nada)", () => {
    for (const f of Object.keys(ACCIONES)) {
      expect(existsSync(f), `${f} no existe`).toBe(true);
    }
    expect(Object.keys(ACCIONES).length).toBe(5);
  });

  it("las 9 capacidades AIMS_* están en el catálogo (control positivo del propio type)", () => {
    const claves = Object.keys(CAPABILITY_LABELS).filter((k) => k.startsWith("AIMS_"));
    expect(claves.length).toBe(9);
    for (const accion of Object.values(ACCIONES)) {
      expect(claves, `${accion} no está declarada en Capability/CAPABILITY_LABELS`).toContain(accion);
    }
  });
});

describe("arista — cada acción de escritura de AIMS llama useHasCapability", () => {
  it("las cinco importan useHasCapability de @/hooks/useCapabilityMatrix", () => {
    for (const f of Object.keys(ACCIONES)) {
      const src = read(f);
      expect(/useHasCapability/.test(src), `${f}: no importa useHasCapability`).toBe(true);
      expect(src, `${f}: no importa desde @/hooks/useCapabilityMatrix`).toContain(
        "@/hooks/useCapabilityMatrix",
      );
    }
  });

  it("y no se quedan en el import: cada una llama useHasCapability(rol, '<su acción>')", () => {
    // El rol puede resolverse inline (`useCurrentUserRole().primaryRole`), así
    // que no se puede parar en el primer `)`: se admite un tramo corto de
    // cualquier carácter antes de la acción, no una lista de argumentos sin
    // paréntesis anidados.
    for (const [f, accion] of Object.entries(ACCIONES)) {
      const src = read(f);
      const patron = new RegExp(`useHasCapability\\([\\s\\S]{0,120}?["']${accion}["']\\)`);
      expect(patron.test(src), `${f}: no llama useHasCapability con ${accion}`).toBe(true);
    }
  });

  it("cada fichero resuelve el rol con useCurrentUserRole (no un rol fijo)", () => {
    for (const f of Object.keys(ACCIONES)) {
      const src = read(f);
      expect(/useCurrentUserRole/.test(src), `${f}: no resuelve el rol actual`).toBe(true);
    }
  });
});

// EvaluacionNueva.tsx sólo compone: el botón de "Guardar autodiagnóstico"
// vive en su hijo PasoRevision.tsx, que es quien pinta el aviso. La página
// se queda con la defensa en el `handleSubmit` (ya cubierta arriba, "arista").
const CON_BOTON_PROPIO = [
  "src/pages/ai-governance/SistemaNuevo.tsx",
  "src/components/ai-governance/clasificacion/ClasificacionGuiada.tsx",
  "src/components/ai-governance/evaluacion/PasoRevision.tsx",
  "src/pages/ai-governance/IncidenteNuevo.tsx",
];

describe("sin capacidad, el botón no aparece y hay aviso de lectura", () => {
  it("control positivo: EvaluacionNueva.tsx queda fuera adrede (delega el JSX en PasoRevision)", () => {
    expect(CON_BOTON_PROPIO.length).toBe(4);
    expect(CON_BOTON_PROPIO).not.toContain("src/pages/ai-governance/EvaluacionNueva.tsx");
  });

  it("las cuatro que pintan el botón importan y muestran SIN_CAPACIDAD_AVISO condicionado a la capacidad", () => {
    for (const f of CON_BOTON_PROPIO) {
      const src = read(f);
      expect(src, `${f}: no importa SIN_CAPACIDAD_AVISO`).toContain("SIN_CAPACIDAD_AVISO");
      // La variable de capacidad (puedeX) debe aparecer en una condición
      // ternaria/lógica que decide entre el botón y el aviso — no basta con
      // declararla y no usarla en el JSX (import muerto de la variable).
      const usosFueraDeLaLlamada = (src.match(/\bpuede\w*/g) ?? []).length;
      expect(usosFueraDeLaLlamada, `${f}: la variable de capacidad no se referencia en el JSX`).toBeGreaterThan(1);
    }
  });

  it("el ternario del JSX decide con la variable real, no con un literal (`{true ? (` la derrotaría)", () => {
    // Cazado en vivo: reemplazar `{puedeX ? (` por `{true ? (` deja pasar la
    // comprobación de arriba (la variable se sigue "usando" en el guard de
    // `handleSubmit`), pero el botón vuelve a aparecer siempre. El ternario
    // del JSX tiene que llevar `puede\w+` pegado al `?`.
    for (const f of CON_BOTON_PROPIO) {
      const src = read(f);
      const patron = /\{[^{}]*\bpuede\w+\b[^{}]*\?\s*\(/;
      expect(patron.test(src), `${f}: el ternario que muestra el botón no depende de la capacidad`).toBe(true);
    }
  });

  it("EvaluacionNueva.tsx bloquea el envío en el handler aunque el botón viva en PasoRevision", () => {
    const src = read("src/pages/ai-governance/EvaluacionNueva.tsx");
    expect(/if\s*\(!puedeEvaluar\)/.test(src), "handleSubmit no comprueba puedeEvaluar antes de escribir").toBe(true);
  });
});
