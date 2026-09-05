import { describe, expect, it } from "vitest";
import {
  assertRegistryRpcResult,
  canRegistryTransition,
  statusForQualification,
  isRegistryTerminal,
  registryTerminal,
} from "../registry-lifecycle";

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("registry lifecycle v2", () => {
  it("distingue los recorridos por documento de base", () => {
    expect(canRegistryTransition("PREPARADA", "ELEVADA", "ESCRITURA")).toBe(true);
    expect(canRegistryTransition("PREPARADA", "ELEVADA", "INSTANCIA")).toBe(false);
    expect(canRegistryTransition("PREPARADA", "PRESENTADA", "INSTANCIA")).toBe(true);
    expect(canRegistryTransition("PREPARADA", "PRESENTADA", "CERTIFICACION")).toBe(true);
  });

  it("permite ciclos de suspensión y subsanación sin convertirlos en denegación", () => {
    expect(statusForQualification("SUSPENSION_SUBSANABLE")).toBe("SUBSANACION");
    expect(statusForQualification("DENEGACION")).toBe("DENEGADA");
    expect(statusForQualification("POSITIVA")).toBe("PRESENTADA");
    expect(canRegistryTransition("SUBSANACION", "PRESENTADA", "INSTANCIA")).toBe(true);
  });

  it("rechaza el éxito aparente cuando la RPC no confirma exactamente una fila", () => {
    expect(() => assertRegistryRpcResult({ affected_count: 0 })).toThrow(/exactamente una fila/i);
    expect(() => assertRegistryRpcResult({ affected_count: 2 })).toThrow(/exactamente una fila/i);
    expect(() => assertRegistryRpcResult({ affected_count: 1, filing_id: "filing-1", status: "PRESENTADA" }))
      .not.toThrow();
  });

  it("no llama inscripción a un depósito ni a una legalización", () => {
    expect(registryTerminal("DEPOSITO_CUENTAS").status).toBe("DEPOSITADA");
    expect(registryTerminal("LEGALIZACION_LIBROS").status).toBe("LEGALIZADA");
    // Acto inscribible y cualquier vía no reconocida caen en el terminal por defecto.
    expect(registryTerminal("ESCRITURA").status).toBe("INSCRITA");
    expect(registryTerminal(null).status).toBe("INSCRITA");
    expect(registryTerminal("  deposito_cuentas  ").status).toBe("DEPOSITADA");
    // El acceso por clave arbitraria no puede alcanzar el prototipo.
    expect(registryTerminal("__proto__").status).toBe("INSCRITA");
    expect(registryTerminal("constructor").status).toBe("INSCRITA");
  });

  it("redacta cada vía sin desacuerdo de género", () => {
    for (const code of ["DEPOSITO_CUENTAS", "LEGALIZACION_LIBROS", "ESCRITURA"]) {
      const t = registryTerminal(code);
      const esFemenino = t.article === "la";
      expect(t.participle).toBe(esFemenino ? "acreditada" : "acreditado");
      expect(t.noun).not.toMatch(/^(el|la) /);
    }
  });

  it("abre la publicación desde los tres terminales y solo desde ellos", () => {
    for (const terminal of ["INSCRITA", "DEPOSITADA", "LEGALIZADA"]) {
      expect(isRegistryTerminal(terminal)).toBe(true);
      expect(canRegistryTransition(terminal as never, "PUBLICADA", "INSTANCIA")).toBe(true);
    }
    for (const noTerminal of ["PREPARADA", "ELEVADA", "PRESENTADA", "SUBSANACION", "DENEGADA", "PUBLICADA"]) {
      expect(isRegistryTerminal(noTerminal)).toBe(false);
    }
  });

  it("mantiene el mapa de vías alineado con la migración que manda en el servidor", () => {
    // ANTES leía UNA ruta de migración fija. Eso ata el test a un nombre de
    // fichero concreto: en cuanto una migración POSTERIOR redefiniese la RPC,
    // el test seguiría verde comprobando el fichero viejo, y en un árbol donde
    // ese fichero no exista el test revienta por una razón que no es la suya.
    // Ahora se resuelve la migración VIGENTE: la última que redefine la RPC.
    //
    // Contra Cloud (governance_OS, medido 2026-09-05) la función desplegada es
    // md5(prosrc) = cc0215249c2f50476078194f5f305c47, con DEPOSITO_CUENTAS y
    // LEGALIZACION_LIBROS presentes en el cuerpo. `execute_sql` no está
    // expuesto en este proyecto, así que ese hash se deja anotado como
    // evidencia de la medición, no como aserción que nadie puede ejecutar.
    const dir = resolve(process.cwd(), "supabase/migrations");
    const definenLaRpc = readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) =>
        /CREATE OR REPLACE FUNCTION public\.fn_registry_record_inscription/i.test(
          readFileSync(resolve(dir, name), "utf8"),
        ),
      );
    expect(
      definenLaRpc.length,
      "ninguna migración define fn_registry_record_inscription: el mapa de TS no tiene contraparte",
    ).toBeGreaterThan(0);

    const sql = readFileSync(resolve(dir, definenLaRpc[definenLaRpc.length - 1]), "utf8");
    // Si el cliente y el servidor divergen, este test cae. El servidor es la
    // autoridad; el mapa de TS solo existe para rotular y abrir la publicación.
    for (const [code, status] of [
      ["DEPOSITO_CUENTAS", "DEPOSITADA"],
      ["LEGALIZACION_LIBROS", "LEGALIZADA"],
    ] as const) {
      expect(registryTerminal(code).status).toBe(status);
      expect(sql).toMatch(new RegExp(`WHEN '${code}'[\\s]*THEN '${status}'`));
    }
    expect(sql).toMatch(/ELSE 'INSCRITA'/);
  });
});
