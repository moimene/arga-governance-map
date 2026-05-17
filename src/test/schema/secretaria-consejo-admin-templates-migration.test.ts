import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MATTER_GROUP_BY_MATERIA } from "@/lib/secretaria/mesa-control-societaria";
import { MateriaEnum } from "@/lib/secretaria/template-admin/template-import-schema";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260517091518_secretaria_consejo_admin_templates_borrador.sql",
);

const EXPECTED_TEMPLATES = [
  {
    materia: "FORMULACION_CUENTAS",
    tipo: "MODELO_ACUERDO",
    organo: "CONSEJO_ADMIN",
    familia: "CUENTAS_RESULTADO_AUDITORIA",
  },
  {
    materia: "APROBACION_PRESUPUESTOS",
    tipo: "MODELO_ACUERDO",
    organo: "CONSEJO_ADMIN",
    familia: "INFORMACION_SEGUIMIENTO_CONTROL",
  },
  {
    materia: "FINANCIACION",
    tipo: "MODELO_ACUERDO",
    organo: "CONSEJO_ADMIN",
    familia: "CAPITAL_FINANCIACION",
  },
  {
    materia: "CONTRATACION_RELEVANTE",
    tipo: "MODELO_ACUERDO",
    organo: "CONSEJO_ADMIN",
    familia: "OPERACIONES_ESPECIALES_VINCULADAS",
  },
  {
    materia: "CONVOCATORIA_COMISION_DELEGADA",
    tipo: "CONVOCATORIA",
    organo: "COMISION_DELEGADA",
    familia: "GOBIERNO_ORGANOS",
  },
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

describe("secretaria Consejo de Administracion templates migration", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const executableSql = sql.replace(/^--.*$/gm, "");

  it("declara 5 plantillas de Consejo o comision agrupadas por familia", () => {
    const capa1Materias = new Set([...sql.matchAll(/\$capa1_([A-Z_]+)\$/g)].map((m) => m[1]));
    expect(capa1Materias).toEqual(new Set(EXPECTED_TEMPLATES.map((t) => t.materia)));
    expect(sql).toContain("'familia_materia'");

    for (const template of EXPECTED_TEMPLATES) {
      expect(sql).toContain(`'${template.materia}'`);
      expect(sql).toContain(`'${template.tipo}'`);
      expect(sql).toContain(`'${template.organo}'`);
      expect(sql).toContain(`'${template.familia}'`);
      expect(MateriaEnum.options).toContain(template.materia);
      expect(MATTER_GROUP_BY_MATERIA[template.materia]).toBe(template.familia);
    }
  });

  it("mantiene los nuevos textos en BORRADOR y no toca plantillas activas", () => {
    expect(executableSql).toContain("'BORRADOR'");
    expect(executableSql).not.toContain("'ACTIVA'");
    expect(executableSql).toContain("'variables-plantillas-v1.1'");
    expect(executableSql).toContain("true,");
  });

  it("mantiene Capa 1, Capa 2 y Capa 3 operativas", () => {
    for (const { materia } of EXPECTED_TEMPLATES) {
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
        expect(["OBLIGATORIO", "RECOMENDADO", "OPCIONAL"], `${materia}: obligatoriedad capa3`).toContain(field.obligatoriedad);
        expect(field.descripcion, `${materia}: descripcion capa3 vacia`).toBeTruthy();
        expect(field.tipo, `${materia}: tipo capa3 vacio`).toBeTruthy();
        expect(field.label, `${materia}: label capa3 vacio`).toBeTruthy();
      }
    }
  });

  it("declara todos los placeholders de Capa 1 en Capa 2 o Capa 3", () => {
    for (const { materia } of EXPECTED_TEMPLATES) {
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
