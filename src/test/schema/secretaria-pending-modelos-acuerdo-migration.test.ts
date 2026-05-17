import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MateriaEnum } from "@/lib/secretaria/template-admin/template-import-schema";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260517085421_secretaria_pending_modelos_acuerdo_borrador.sql",
);

const EXPECTED_MATERIAS = [
  "ADQUISICION_PROPIA",
  "AMPLIACION_OBJETO_SOCIAL",
  "CAMBIO_DENOMINACION_SOCIAL",
  "CAMBIO_DOMICILIO_SOCIAL",
  "DELEGACION_CAPITAL",
  "DISOLUCION",
  "EMISION_DEUDA_CONVERTIBLE",
  "EMISION_OBLIGACIONES",
  "ESCISION",
  "EXCLUSION_SOCIO",
  "FUSION",
  "LIQUIDACION",
  "PACTO_PARASOCIAL",
  "PRORROGA_SOCIEDAD",
  "SEPARACION_SOCIO",
] as const;

type Capa2Variable = {
  variable: string;
  fuente: string;
  condicion: string;
};

type Capa3Field = {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
  tipo: string;
  label: string;
};

function dollarBlock(sql: string, prefix: "capa1" | "capa2" | "capa3", materia: string): string {
  const tag = `${prefix}_${materia}`;
  const match = sql.match(new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`));
  if (!match) throw new Error(`No se encontro bloque $${tag}$`);
  return match[1].trim();
}

function placeholders(capa1: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(capa1)) !== null) found.add(match[1]);
  return [...found].sort();
}

describe("secretaria pending MODELO_ACUERDO migration", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const executableSql = sql.replace(/^--.*$/gm, "");

  it("declara exactamente las 15 materias pendientes y las mantiene validables por el gestor", () => {
    for (const materia of EXPECTED_MATERIAS) {
      expect(sql).toContain(`'${materia}'`);
      expect(MateriaEnum.options).toContain(materia);
    }

    const unique = new Set(EXPECTED_MATERIAS);
    expect(unique.size).toBe(15);
  });

  it("crea los modelos como BORRADOR, no como ACTIVA", () => {
    expect(executableSql).toContain("'BORRADOR'");
    expect(executableSql).not.toContain("'ACTIVA'");
  });

  it("mantiene Capa 1, Capa 2 y Capa 3 operativas por materia", () => {
    for (const materia of EXPECTED_MATERIAS) {
      const capa1 = dollarBlock(sql, "capa1", materia);
      const capa2 = JSON.parse(dollarBlock(sql, "capa2", materia)) as Capa2Variable[];
      const capa3 = JSON.parse(dollarBlock(sql, "capa3", materia)) as Capa3Field[];

      expect(capa1.length, `${materia}: capa1_inmutable vacia`).toBeGreaterThan(100);
      expect(Array.isArray(capa2), `${materia}: capa2_variables no es array`).toBe(true);
      expect(capa2.length, `${materia}: capa2_variables vacia`).toBeGreaterThan(0);
      expect(Array.isArray(capa3), `${materia}: capa3_editables no es array`).toBe(true);
      expect(capa3.length, `${materia}: capa3_editables vacia`).toBeGreaterThan(0);

      for (const variable of capa2) {
        expect(variable.variable, `${materia}: variable capa2 sin nombre`).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
        expect(variable.fuente, `${materia}: fuente capa2 sin path`).toMatch(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/);
        expect(variable.condicion, `${materia}: condicion capa2 invalida`).toBe("SIEMPRE");
      }

      for (const field of capa3) {
        expect(field.campo, `${materia}: campo capa3 invalido`).toMatch(/^[a-z_][a-z0-9_]*$/);
        expect(field.obligatoriedad, `${materia}: obligatoriedad capa3`).toBe("OBLIGATORIO");
        expect(field.descripcion, `${materia}: descripcion capa3 vacia`).toBeTruthy();
        expect(field.tipo, `${materia}: tipo capa3 vacio`).toBeTruthy();
        expect(field.label, `${materia}: label capa3 vacio`).toBeTruthy();
      }
    }
  });

  it("declara todos los placeholders de Capa 1 en Capa 2 o Capa 3", () => {
    for (const materia of EXPECTED_MATERIAS) {
      const capa1 = dollarBlock(sql, "capa1", materia);
      const capa2 = JSON.parse(dollarBlock(sql, "capa2", materia)) as Capa2Variable[];
      const capa3 = JSON.parse(dollarBlock(sql, "capa3", materia)) as Capa3Field[];
      const declared = new Set([
        ...capa2.map((v) => v.variable),
        ...capa3.map((f) => f.campo),
      ]);

      for (const placeholder of placeholders(capa1)) {
        expect(declared.has(placeholder), `${materia}: placeholder no declarado ${placeholder}`).toBe(true);
        expect(placeholder, `${materia}: placeholder no plano`).not.toContain(".");
      }
    }
  });
});
