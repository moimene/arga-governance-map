// El clasificador de subexpedientes abría un expediente de IA en casi
// cualquier denuncia escrita en castellano.
//
// `whistleblowing-engine.ts` buscaba la sigla con `text.includes("ia")`, y
// «ia» es una terminación corrientísima: denunc**ia**, famil**ia**,
// mater**ia**, gerenc**ia**, advertenc**ia**, vigilanc**ia**, experienc**ia**.
// Todas abrían un «Subexpediente de Incidente / Evaluación de IA (EU AI Act &
// ISO 42001)» con su autoridad —AESIA— y su responsable.
//
// No es cosmético: el expediente arrastra un subexpediente que nadie va a
// cerrar, dirigido a un regulador que no pinta nada en el caso.
import { describe, expect, it } from "vitest";
import { evaluateSubcasePerimeter } from "@/lib/sii/whistleblowing-engine";

const base = {
  category: "Otros",
  summary: "",
  detailedDescription: "",
};

const evaluar = (
  p: Partial<typeof base> & {
    affectsAI?: boolean;
    affectsICT?: boolean;
    isBoardOrExecutiveTarget?: boolean;
  },
) =>
  evaluateSubcasePerimeter({ ...base, ...p });
const abreIA = (p: Parameters<typeof evaluar>[0]) =>
  evaluar(p).subcasesToCreate.some((s) => s.regime === "AIMS_AI");
const abreDORA = (p: Parameters<typeof evaluar>[0]) =>
  evaluar(p).subcasesToCreate.some((s) => s.regime === "DORA_ICT");
const escala = (p: Parameters<typeof evaluar>[0]) => evaluar(p).escalationRequired;

describe("SII — el clasificador no confunde una terminación con una sigla", () => {
  it("NO abre subexpediente de IA por palabras corrientes acabadas en «ia»", () => {
    // Los seis casos que cualquier denuncia real puede contener.
    expect(abreIA({ summary: "Presento una denuncia sobre un contrato." })).toBe(false);
    expect(abreIA({ summary: "Un familiar del socio interviene en la materia." })).toBe(false);
    expect(abreIA({ summary: "La gerencia hizo caso omiso de la advertencia." })).toBe(false);
    expect(abreIA({ summary: "Falta de vigilancia en la custodia." })).toBe(false);
    expect(abreIA({ detailedDescription: "Tengo experiencia previa en la asesoría." })).toBe(false);
    expect(abreIA({ category: "Incidencia contable" })).toBe(false);
  });

  it("y SÍ lo abre cuando la sigla aparece como palabra", () => {
    // El control que hace que lo anterior signifique algo: si el arreglo
    // hubiera sido borrar la comprobación, esto caería.
    expect(abreIA({ summary: "El sistema de IA puntúa a los candidatos." })).toBe(true);
    expect(abreIA({ summary: "Sesgo del modelo (IA) en la selección." })).toBe(true);
    expect(abreIA({ detailedDescription: "Se usó IA, sin supervisión humana." })).toBe(true);
  });

  it("y sigue abriéndolo por los demás disparadores, que no se tocan", () => {
    expect(abreIA({ summary: "Uso de inteligencia artificial no declarado." })).toBe(true);
    expect(abreIA({ summary: "El algoritmo descarta por código postal." })).toBe(true);
    expect(abreIA({ summary: "Sesgo discriminatorio en el cribado." })).toBe(true);
    expect(abreIA({ affectsAI: true })).toBe(true);
  });

  it("y una denuncia corriente no arrastra NINGÚN subexpediente de más", async () => {
    // Comprobación de efecto, no de la bandera: lo que hacía daño era el
    // subexpediente entero —con su autoridad y su responsable—, no el booleano.
    const r = evaluateSubcasePerimeter({
      category: "Conflicto de interés",
      summary: "Denuncia por materia de familia gestionada con negligencia.",
      detailedDescription: "La gerencia desatendió la advertencia del área.",
    });
    expect(r.subcasesToCreate.filter((s) => s.regime === "AIMS_AI")).toEqual([]);
    expect(r.subcasesToCreate.map((s) => s.authorityTarget))
      .not.toContain("AESIA / Oficina Europea de IA");
  });

  it("y lo mismo con «dora» y «tic», que era peor: 4 de cada 5", () => {
    // Medido antes de arreglarlo: «trabaja-dora», «administra-dora»,
    // «provee-dora», «prac-tic-a» y «estadis-tic-a» abrian todas un
    // subexpediente DORA dirigido a DGSFP / CNMV / EBA.
    expect(abreDORA({ summary: "La trabajadora denuncia una práctica irregular." })).toBe(false);
    expect(abreDORA({ summary: "La administradora firmó sin poder bastante." })).toBe(false);
    expect(abreDORA({ summary: "La proveedora emitió facturas duplicadas." })).toBe(false);
    expect(abreDORA({ summary: "Se incumplió la política de estadística interna." })).toBe(false);
    // Y los verdaderos siguen entrando.
    expect(abreDORA({ summary: "Incidente DORA en el proveedor TIC." })).toBe(true);
    expect(abreDORA({ summary: "Indisponibilidad del proveedor nube." })).toBe(true);
    expect(abreDORA({ affectsICT: true })).toBe(true);
  });

  it("y «ceo» no escala una denuncia al Consejo por decir «buceo»", () => {
    // Escalar de más no es conservador: mete al órgano de gobierno en un
    // expediente que no le corresponde.
    expect(escala({ summary: "Hubo un buceo en las cuentas antiguas." })).toBe(false);
    expect(escala({ summary: "El CEO ordenó el pago." })).toBe(true);
    expect(escala({ summary: "Un consejero intervino en la adjudicación." })).toBe(true);
    expect(escala({ isBoardOrExecutiveTarget: true })).toBe(true);
  });
});
