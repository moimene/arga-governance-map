// src/test/sii/sii-tenant-scope.test.ts
// El canal interno no comparte expedientes ni identidad entre tenants.
//
// La auditoría midió que un usuario de Garrigues veía las tres denuncias de
// ARGA: clave de localStorage literal, queryKeys constantes, y las 5 rutas
// /sii/* sin gate de módulo.
//
// POR QUÉ ESTE FICHERO CAMBIÓ EL 2026-09-05. Tres de sus guards eran de TEXTO y
// se derrotaban con un señuelo, sin usar ninguna cadena prohibida:
//
//   · Contaba `useQuery(` frente a `enabled:` sin mirar el VALOR: `enabled: true`
//     lo satisfacía.
//   · Recortaba el cuerpo de `getStoredReports` y solo exigía que contuviera
//     `initialReportsFor` y no `INITIAL_SII_REPORTS`. Bastaba con que
//     `initialReportsFor` devolviera SIEMPRE los casos de ARGA para reproducir
//     la fuga entera con el test en verde.
//   · Exigía que cada línea con `path="/sii` contuviera la subcadena
//     `RequireModule`. Con `moduleKey="dora"` en las cinco seguía verde, y
//     Garrigues se quedaba fuera de su propio canal.
//
// Ahora se invocan las funciones y se comprueba el RESULTADO por tenant.
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siiStorageKey, siiQueryKey } from "@/lib/sii/tenant-scope";
import { siiRolesPara } from "@/lib/sii/roles-por-tenant";
import { getStoredReports, initialReportsFor, INITIAL_SII_REPORTS } from "@/hooks/useWhistleblowing";
import { isModuleEnabled } from "@/lib/tenant-modules";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARR = "00000000-0000-0000-0000-000000000002";
const OTRO = "00000000-0000-0000-0000-0000000000ff";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const codigos = (rs: Array<{ code: string }>) => rs.map((r) => r.code).sort();

describe("SII — el almacén y las claves llevan tenant", () => {
  it("dos tenants nunca comparten bucket", () => {
    expect(siiStorageKey(ARGA)).not.toBe(siiStorageKey(GARR));
  });

  it("no hay forma de construir la clave sin tenant", () => {
    expect(() => siiStorageKey("")).toThrow();
  });

  it("dos tenants nunca comparten queryKey", () => {
    expect(siiQueryKey(ARGA, "reports", "list")).not.toEqual(siiQueryKey(GARR, "reports", "list"));
  });

  it("un tenant sin resolver no colisiona con un tenant real", () => {
    // TenantProvider arranca en null y resuelve por red: sin esto, el primer
    // render de todos los tenants compartiría la clave [...,null].
    expect(siiQueryKey(null, "reports")).not.toEqual(siiQueryKey(ARGA, "reports"));
  });
});

describe("SII — la siembra por tenant, invocada (no leída)", () => {
  it("ARGA recibe sus expedientes y NADIE MÁS los recibe", () => {
    const arga = codigos(initialReportsFor(ARGA));
    expect(arga).toEqual(codigos(INITIAL_SII_REPORTS));
    expect(arga.length).toBeGreaterThan(0);

    // El señuelo que el guard de texto anterior no veía: si `initialReportsFor`
    // devolviera los de ARGA para todos, esto cae.
    for (const otro of [GARR, OTRO]) {
      const suyos = codigos(initialReportsFor(otro));
      expect(suyos.filter((c) => arga.includes(c))).toEqual([]);
    }
  });

  it("Garrigues recibe los suyos, y un tenant desconocido arranca VACÍO", () => {
    expect(initialReportsFor(GARR).length).toBe(3);
    expect(initialReportsFor(GARR).every((r) => r.code.startsWith("SII-GARR-"))).toBe(true);
    // Vacío es lo honesto: ese tenant no tiene ninguno.
    expect(initialReportsFor(OTRO)).toEqual([]);
  });
});

describe("SII — LAS TRES PUERTAS del almacén, ejecutadas con localStorage real", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("puerta 2 (bucket vacío): cada tenant estrena el suyo, no el de ARGA", () => {
    const arga = codigos(getStoredReports(ARGA));
    const garr = codigos(getStoredReports(GARR));
    expect(arga.length).toBeGreaterThan(0);
    expect(garr.filter((c) => arga.includes(c))).toEqual([]);
    expect(codigos(getStoredReports(OTRO))).toEqual([]);
  });

  it("puerta 3 (JSON corrupto): no cae a los expedientes de ARGA", () => {
    // Es la más difícil de reproducir: devuelve SIN sembrar, así que no deja
    // rastro en el almacén.
    localStorage.setItem(siiStorageKey(GARR), "{ esto no es JSON");
    const garr = codigos(getStoredReports(GARR));
    expect(garr.filter((c) => codigos(INITIAL_SII_REPORTS).includes(c))).toEqual([]);
  });

  it("lo escrito por un tenant no lo lee el otro", () => {
    getStoredReports(ARGA);
    getStoredReports(GARR);
    expect(localStorage.getItem(siiStorageKey(ARGA))).not.toBe(localStorage.getItem(siiStorageKey(GARR)));
  });
});

describe("SII — la identidad del circuito se resuelve por tenant", () => {
  it("Garrigues no hereda la instructora ni el órgano aprobador de ARGA", () => {
    const arga = siiRolesPara(ARGA);
    const garr = siiRolesPara(GARR);
    expect(garr.instructorName).not.toBe(arga.instructorName);
    expect(garr.ownerName).not.toBe(arga.ownerName);
    expect(garr.organoAprobadorRecusacion).not.toBe(arga.organoAprobadorRecusacion);
    expect(garr.organos).not.toEqual(arga.organos);
    // Órganos de aseguradora fuera del tenant despacho.
    const textoGarr = JSON.stringify(garr);
    expect(textoGarr).not.toMatch(/Comisión de Auditoría/);
    expect(textoGarr).not.toMatch(/Elena Navarro/);
  });

  it("un tenant sin designación NO recibe una persona: recibe el pendiente", () => {
    const otro = siiRolesPara(OTRO);
    expect(otro.hayDesignacion).toBe(false);
    expect(otro.instructorName).toBe("Pendiente de designación");
    expect(otro.ownerName).toBe("Pendiente de designación");
    expect(otro.organoAprobadorRecusacion).toBe("Pendiente de designación");
    expect(JSON.stringify(otro)).not.toMatch(/Elena Navarro|Comisión de Auditoría|Comité de Cumplimiento e/);
    // Y tampoco se le cita una política que no es suya.
    expect(otro.politicaDesignacion).toBeNull();
  });

  it("solo se cita PI-31 en el tenant cuya política es", () => {
    expect(siiRolesPara(GARR).politicaDesignacion).toBe("PI-31 §4");
    expect(siiRolesPara(ARGA).politicaDesignacion).toBeNull();
    expect(siiRolesPara(null).politicaDesignacion).toBeNull();
  });

  it("ARGA conserva exactamente lo que ya veía", () => {
    const arga = siiRolesPara(ARGA);
    expect(arga.instructorName).toBe("Dña. Elena Navarro Pons");
    expect(arga.organoAprobadorRecusacion).toBe("Comité de Cumplimiento e Independencia");
    expect(arga.causaCupulaLabel).toBe("Afectación a Alta Dirección o Consejo (Comisión Auditoría)");
  });
});

describe("SII — el gate de módulo de las rutas", () => {
  const APP = read("src/App.tsx");

  it("las 5 rutas /sii/* van gateadas por el módulo 'sii', no por otro cualquiera", () => {
    // El guard anterior solo exigía la subcadena `RequireModule`: con
    // moduleKey="dora" en las cinco seguía verde y Garrigues perdía su canal.
    const rutas = APP.split("\n").filter((l) => /path="\/sii/.test(l));
    expect(rutas.length).toBe(5);
    for (const linea of rutas) {
      expect(linea).toContain('RequireModule moduleKey="sii"');
    }
  });

  it("el gate que consumen esas rutas cierra de verdad ante una whitelist sin 'sii'", () => {
    // Comportamiento del gate, no su cableado: si `isModuleEnabled` dejara
    // pasar, envolver las rutas no serviría de nada.
    expect(isModuleEnabled({ modules: ["secretaria", "grc"] }, "sii")).toBe(false);
    expect(isModuleEnabled({ modules: ["sii"] }, "sii")).toBe(true);
    // Falla ABIERTO sin whitelist declarada: es el contrato «branding nulo =
    // todo visible» de D-5, y ARGA depende de él.
    expect(isModuleEnabled(null, "sii")).toBe(true);
    expect(isModuleEnabled({}, "sii")).toBe(true);
  });
});
