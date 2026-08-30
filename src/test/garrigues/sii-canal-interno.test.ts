// Las citas de PI-31, cotejadas contra el PDF cuando está, y consistentes
// siempre.
//
// El PDF vive en `version garrigues/`, que está en `.gitignore`: en un árbol
// limpio no existe. El cotejo literal se salta ahí, pero **el resto no**, y el
// salto se decide DENTRO del `it`, nunca envolviendo el fichero.
//
// GOTCHA que este fichero respeta y que ya costó un gate en G5: `describe.skip`
// **sí ejecuta su callback**. Un guard puesto en el `describe` no protege las
// llamadas del cuerpo — el gate del mapa penal reventaba en todo entorno limpio
// justamente por eso.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  SII_ART_25,
  SII_CANALES_EXTERNOS,
  SII_CANAL_EXTERNO_AVISO,
  SII_POLITICA,
  SII_ROLES,
} from "../../../scripts/garrigues/sii/canal-interno";

const PDF = "version garrigues/Garr_politicas/PI-31. Política Sistema Interno de Información (SII) de Garrigues.pdf";

/** Texto del PDF, o null si no está el fuente. Sin `-layout` los índices en
 *  columnas salen destrozados: es otro gotcha documentado del proyecto. */
function textoPdf(): string | null {
  if (!existsSync(PDF)) return null;
  const salida = "/tmp/pi31-cotejo.txt";
  execFileSync("pdftotext", ["-layout", PDF, salida]);
  return readFileSync(salida, "utf8");
}

/** Compara ignorando los saltos de línea del PDF, que parten las frases. */
const aplanar = (s: string) => s.replace(/\s+/g, " ").trim();

describe("SII Garrigues — las citas de PI-31 dicen lo que dice PI-31", () => {
  it("los dos roles son los de la política, y el Responsable es UNIPERSONAL", () => {
    const responsable = SII_ROLES.find((r) => r.rol === "RESPONSABLE")!;
    const instructor = SII_ROLES.find((r) => r.rol === "INSTRUCTOR")!;
    expect(responsable.cargo).toBe("Senior Partner de la Firma");
    expect(instructor.cargo).toBe("Directora de Cumplimiento Normativo");
    // Lo que la superficie decía antes —«Comisión de Auditoría y Control»,
    // «Comité de Cumplimiento»— son órganos COLEGIADOS de una aseguradora, y
    // en Garrigues no existen. Que el Responsable sea unipersonal cambia quién
    // responde, así que la cita tiene que sostenerlo.
    expect(responsable.cita).toContain("órgano unipersonal");
    expect(SII_ROLES.map((r) => r.cargo).join(" ")).not.toMatch(/comisión|comité/i);
  });

  it("los dos roles tienen prevista su sustitución por conflicto", () => {
    // La política lo prevé para los dos, y omitirlo dejaría el procedimiento
    // sin salida en el único caso en que de verdad hace falta.
    expect(SII_ROLES.every((r) => r.sustitucion.includes("conflicto"))).toBe(true);
  });

  it("los canales externos son los dos que nombra la política", () => {
    expect(SII_CANALES_EXTERNOS.map((c) => c.nombre)).toEqual([
      "Autoridad Independiente de Protección del Informante (A.A.I.)",
      "SEPBLAC",
    ]);
    expect(SII_CANALES_EXTERNOS.every((c) => c.apartado.startsWith("PI-31"))).toBe(true);
  });

  it("y NO se presenta el canal interno como obligatorio ni previo", () => {
    // El matiz del art. 25: el interno es el cauce PREFERENTE, y aun así se
    // puede acudir al externo directamente. Decir lo contrario sería un error
    // jurídico, no una imprecisión de copy.
    expect(SII_CANAL_EXTERNO_AVISO).toContain("no es obligatorio ni previo");
    expect(SII_CANAL_EXTERNO_AVISO).toContain("directamente");
    expect(SII_ART_25.articulo).toBe("art. 25");
    expect(SII_ART_25.rubrica).toBe("Información sobre los canales interno y externo de información");
  });

  it("COTEJO LITERAL contra el PDF, cuando el fuente está disponible", () => {
    const texto = textoPdf();
    if (!texto) {
      // El salto se decide aquí dentro, y se DICE. Un fichero que se salta
      // entero en silencio es un gate verde que no asierta nada.
      console.warn("PI-31.pdf no está en el árbol (está en .gitignore): se omite el cotejo literal.");
      expect(SII_POLITICA.codigo).toBe("PI-31");
      return;
    }
    const plano = aplanar(texto);
    // Si el PDF está, cada cita tiene que aparecer LITERAL. No por palabras
    // clave: entera.
    for (const rol of SII_ROLES) {
      expect(plano, `${rol.rol} (${rol.apartado})`).toContain(aplanar(rol.cita));
    }
    // Y los dos canales externos, por su nombre tal como los llama la fuente.
    expect(plano).toContain("SEPBLAC");
    expect(plano).toContain("Autoridad Independiente de Protección del Informante");
    // El matiz del cauce preferente, que es lo que sostiene el aviso.
    expect(plano).toContain("cauce preferente");
    expect(plano).toContain("bien directamente");
  });
});
