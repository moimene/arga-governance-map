// C1 Task 1 — paridad entre la migración y su espejo en el seed.
//
// Por qué existe: los dos tests de Cloud de garrigues-rule-packs-seed.test.ts
// comprueban lo que HAY en la base, no lo que dicen los artefactos del repo.
// Una vez aplicada la migración, borrarla y revertir el seed dejaría aquéllos
// en verde (hallazgo P1 de la review adversarial). La triple copia
// SQL/seed/fixture del payload de packs ya es deuda catalogada de este
// programa; este test evita que crezca en silencio.
//
// Puro: no toca red. Importar el seed ejecuta su main(), que sin --commit solo
// imprime una tabla y retorna.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PACKS } from "../../../scripts/seed-garrigues-rule-packs";

const MIGRACION_V110 = "supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql";
const MIGRACION_V100 = "supabase/migrations/20260804070000_g3_garrigues_rule_packs.sql";

/** Extrae el literal JSON del INSERT de un pack/versión concretos. */
function payloadDeMigracion(ruta: string, packId: string, version: string) {
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    if (!linea.includes(`'${packId}'`) || !linea.includes(`'${version}'`) || !linea.includes("'{")) continue;
    return JSON.parse(linea.slice(linea.indexOf("'{") + 1, linea.lastIndexOf("}'") + 1));
  }
  throw new Error(`No se encontró el payload de ${packId}@${version} en ${ruta}`);
}

describe("C1 Task 1 — GARR_CONSEJO_EAD: migración y seed no divergen", () => {
  const v110 = payloadDeMigracion(MIGRACION_V110, "GARR_CONSEJO_EAD", "1.1.0");
  const v100 = payloadDeMigracion(MIGRACION_V100, "GARR_CONSEJO_EAD", "1.0.0");
  const enSeed = PACKS.find((p) => p.id === "GARR_CONSEJO_EAD");

  it("el seed declara la versión 1.1.0 para este pack", () => {
    expect(enSeed).toBeDefined();
    expect(enSeed.version).toBe("1.1.0");
  });

  it("el payload del seed es idéntico al de la migración", () => {
    expect(JSON.parse(JSON.stringify(enSeed.payload))).toEqual(v110);
  });

  it("v1.1.0 solo añade reglaEspecifica.antelacionConsejo sobre v1.0.0", () => {
    const copia = JSON.parse(JSON.stringify(v110));
    const añadida = copia.reglaEspecifica.antelacionConsejo;
    expect(añadida).toBeDefined();
    delete copia.reglaEspecifica.antelacionConsejo;
    // Todo lo demás, byte a byte: mayorías, quórum, canales, plazos, cautela EAD.
    expect(copia).toEqual(v100);
  });

  it("los 5 días no se presentan como plazo legal en ninguna de las dos copias", () => {
    for (const payload of [v110, JSON.parse(JSON.stringify(enSeed.payload))]) {
      for (const forma of ["SA", "SL"]) {
        const dias = payload.convocatoria.antelacionDias[forma];
        expect(dias.valor).toBe(5);
        expect(dias.fuente).toBe("ESTATUTOS");
        expect(dias.referencia).toBe("art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente");
      }
      expect(payload.reglaEspecifica.antelacionConsejo.naturaleza).toBe("PRACTICA_SOCIETARIA_CONFIRMADA");
      expect(payload.reglaEspecifica.antelacionConsejo.nota).toContain("no fija plazo mínimo");
      expect(payload.reglaEspecifica.antelacionConsejo.nota).toContain("no suelo legal");
    }
  });

  it("la clave documental no lleva atribución nominal ni rutas internas del repo", () => {
    // `rule_pack_versions` no tiene RLS por tenant: ARGA lee este payload.
    // El quién y el dónde viven en la cabecera de la migración y en docs/legal/.
    const k = v110.reglaEspecifica.antelacionConsejo;
    expect(Object.keys(k).sort()).toEqual(["fechaConfirmacion", "naturaleza", "nota", "valorDias"]);
    expect(JSON.stringify(k)).not.toContain("docs/legal");
    expect(JSON.stringify(k)).not.toContain("Consejero de la entidad");
  });
});
