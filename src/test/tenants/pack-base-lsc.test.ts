// src/test/tenants/pack-base-lsc.test.ts
//
// El snapshot del PACK BASE LSC es texto jurídico revisado, congelado en el repo
// para que un tenant nuevo nazca con suelo. Estos tests vigilan lo que el
// bootstrap da por cierto al clonarlo. No miran Cloud: miran el fichero.
import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PACK_BASE_DIR,
  cargarPackBase,
  mencionaArga,
  packIdPara,
  sha256Hex,
} from "../../../scripts/tenants/bootstrap-lib";
import { TENANT_SPECS } from "../../../scripts/tenants/tenant-spec";

const pack = cargarPackBase();

describe("pack base LSC — integridad del snapshot", () => {
  it("carga, y los tres ficheros casan con el MANIFEST", () => {
    expect(pack.manifest.pack).toBe("LSC_ES");
    expect(pack.rulePacks.length).toBeGreaterThanOrEqual(50);
    expect(pack.ruleSets.length).toBeGreaterThanOrEqual(4);
    expect(pack.plantillas.length).toBeGreaterThanOrEqual(60);
  });

  it("un fichero editado a mano deja de cargar", () => {
    // Control positivo del instrumento: si `cargarPackBase` no comparase hashes,
    // este test sería el único en enterarse.
    const dir = mkdtempSync(join(tmpdir(), "pack-base-"));
    cpSync(PACK_BASE_DIR, dir, { recursive: true });
    const ruta = join(dir, "rule-packs.json");
    // Se cambia UNA regla: la versión del primer pack. Es la edición que más
    // tentaría hacer a mano y la que nunca debe colarse sin regenerar.
    const filas = JSON.parse(readFileSync(ruta, "utf8")) as Array<{ version: string }>;
    filas[0].version = `${filas[0].version}-editada`;
    writeFileSync(ruta, JSON.stringify(filas), "utf8");
    expect(() => cargarPackBase(dir)).toThrow(/no coincide con el MANIFEST/);
    // Y la copia intacta sí carga: lo que falla es la edición, no el directorio.
    const limpio = mkdtempSync(join(tmpdir(), "pack-base-ok-"));
    cpSync(PACK_BASE_DIR, limpio, { recursive: true });
    expect(cargarPackBase(limpio).rulePacks.length).toBe(pack.rulePacks.length);
  });
});

describe("pack base LSC — rule packs", () => {
  it("cada pack trae materia, versión y payload con su hash", () => {
    for (const p of pack.rulePacks) {
      expect(p.materia, p.source_id).toBeTruthy();
      expect(p.version, p.source_id).toBeTruthy();
      expect(Object.keys(p.payload).length, p.source_id).toBeGreaterThan(0);
      expect(p.payload_sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(new Set(pack.rulePacks.map((p) => p.source_id)).size).toBe(pack.rulePacks.length);
  });

  it("cubre las materias sin las que un grupo SA/SL no puede operar", () => {
    const materias = new Set(pack.rulePacks.map((p) => p.materia));
    for (const m of [
      "APROBACION_CUENTAS", "FORMULACION_CUENTAS", "APLICACION_RESULTADO", "NOMBRAMIENTO_CONSEJERO",
      "CESE_CONSEJERO", "NOMBRAMIENTO_AUDITOR", "MODIFICACION_ESTATUTOS", "AUMENTO_CAPITAL",
      "DELEGACION_FACULTADES", "SOCIEDAD_UNIPERSONAL", "ACUERDO_CONVOCATORIA_JUNTA",
    ]) {
      expect(materias.has(m), `falta la materia ${m}`).toBe(true);
    }
  });

  it("ningún payload menciona ARGA ni arrastra reglas de demo", () => {
    for (const p of pack.rulePacks) {
      expect(mencionaArga(p.payload), p.source_id).toBe(false);
      expect(JSON.stringify(p.payload)).not.toContain('"demo_scope"');
    }
  });

  it("los ids con prefijo de cada tenant no pisan ningún id del origen", () => {
    // rule_packs.id es PRIMARY KEY GLOBAL.
    const origen = new Set(pack.rulePacks.map((p) => p.source_id));
    for (const spec of Object.values(TENANT_SPECS)) {
      for (const p of pack.rulePacks) expect(origen.has(packIdPara(spec, p.source_id))).toBe(false);
    }
  });
});

describe("pack base LSC — rule sets de jurisdicción", () => {
  it("solo España, sin pack_id del origen, con las formas SA y SL", () => {
    for (const r of pack.ruleSets) {
      expect(r.jurisdiction).toBe("ES");
      expect(r.pack_id).toBeNull();
    }
    const formas = new Set(pack.ruleSets.map((r) => r.company_form));
    expect(formas.has("SA")).toBe(true);
    expect(formas.has("SL")).toBe(true);
  });
});

describe("pack base LSC — plantillas", () => {
  const RENDERIZABLES = ["capa1_inmutable", "contenido_template", "capa2_variables", "capa3_editables", "variables", "protecciones", "comunicacion_config", "referencia_legal"] as const;

  it("ningún campo que llegue a un documento menciona ARGA", () => {
    for (const p of pack.plantillas) {
      for (const campo of RENDERIZABLES) {
        expect(mencionaArga(p[campo]), `${p.tipo}/${p.materia_acuerdo ?? p.materia} · ${campo}`).toBe(false);
      }
    }
  });

  it("el hash de cada plantilla es sha256(capa1): la fórmula que el servidor recalcula", () => {
    for (const p of pack.plantillas) expect(p.content_hash_sha256).toBe(sha256Hex(p.capa1_inmutable));
  });

  it("la única transformación es el aviso de prototipo, y está contada", () => {
    const neutralizadas = pack.plantillas.filter((p) => p.capa1_neutralizada);
    expect(neutralizadas.length).toBeGreaterThan(0);
    for (const p of neutralizadas) expect(p.capa1_inmutable).toContain("prototipo TGMS");
    for (const p of pack.plantillas.filter((x) => !x.capa1_neutralizada)) {
      expect(p.capa1_inmutable).not.toContain("prototipo TGMS");
    }
  });

  it("no hay dos plantillas con la misma identidad funcional", () => {
    // El índice único de ACTIVA es por (tenant, tipo, jurisdicción, materia,
    // órgano, modo, tipo social): un duplicado abortaría la activación a medias.
    const clave = (p: (typeof pack.plantillas)[number]) =>
      [p.tipo, p.jurisdiccion, (p.materia_acuerdo ?? "").trim() || p.materia, p.organo_tipo, p.adoption_mode, p.tipo_social].join("|");
    const claves = pack.plantillas.map(clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("trae la plantilla que la RPC de emisión de convocatoria exige por versión", () => {
    // fn de emisión: tipo CONVOCATORIA, materia CONVOCATORIA_CDA, versión 1.1.0.
    const cda = pack.plantillas.filter((p) => p.tipo === "CONVOCATORIA" && p.materia === "CONVOCATORIA_CDA");
    expect(cda.map((p) => p.version)).toContain("1.1.0");
  });

  it("cubre los tipos documentales del ciclo societario", () => {
    const tipos = new Set(pack.plantillas.map((p) => p.tipo));
    for (const t of ["CONVOCATORIA", "ACTA_SESION", "CERTIFICACION", "MODELO_ACUERDO", "ACTA_CONSIGNACION", "ACTA_ACUERDO_ESCRITO"]) {
      expect(tipos.has(t), `falta el tipo ${t}`).toBe(true);
    }
  });

  it("los avisos de revisión legal del manifiesto apuntan a plantillas que existen", () => {
    const ids = new Set(pack.plantillas.map((p) => p.source_id));
    for (const a of pack.manifest.avisos_legales) expect(ids.has(a.source_id)).toBe(true);
  });
});
