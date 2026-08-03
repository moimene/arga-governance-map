import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluarDocumentacion } from "@/lib/rules-engine/documentacion-engine";
import type { RulePack } from "@/lib/rules-engine/types";

const migration = readFileSync(
  "supabase/migrations/20260720134000_secretaria_representante_socio_unico_alignment.sql",
  "utf8",
);

const payloadMatch = migration.match(/\$json\$([\s\S]*?)\$json\$/);
if (!payloadMatch) throw new Error("No se encontró el payload JSON del RulePack");
const pack = JSON.parse(payloadMatch[1]) as RulePack;

describe("alineación de la representación del socio único en la filial", () => {
  it("crea una identidad nueva sin reinterpretar la materia legacy", () => {
    expect(migration).toContain("'DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL'");
    expect(migration).not.toMatch(
      /WHERE\s+(?:materia|pack_id|id)\s*=\s*'NOMBRAMIENTO_REPRESENTANTE_FILIAL'/,
    );
    expect(pack.id).toBe("DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL");
    expect(pack.materia).toBe("DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL");
  });

  it("publica una versión inmutable e idempotente", () => {
    expect(migration).toContain("v_version constant text := '1.0.0'");
    expect(migration).toContain("v_existing_payload IS DISTINCT FROM v_payload");
    expect(migration).toContain("ON CONFLICT (pack_id, version) DO NOTHING");
    expect(migration).not.toContain("ON CONFLICT (pack_id, version) DO UPDATE SET");
  });

  it("limita la materia al Consejo y aplica las reglas correctas de la S.A.", () => {
    expect(pack.organoTipo).toBe("CONSEJO");
    expect(pack.constitucion.quorum.CONSEJO.referencia).toContain("art. 247.2 LSC");
    expect(pack.votacion.mayoria.CONSEJO).toMatchObject({
      formula: "favor > presentes_mitad",
      referencia: expect.stringContaining("art. 248.1 LSC"),
    });
    expect(pack.modosAdopcionPermitidos).toEqual(["MEETING", "NO_SESSION"]);
    expect(pack.noSession?.condicion_consejo).toBe("MAYORIA_SIN_OPOSICION");
    expect(pack.noSession?.habilitado_por_estatutos.referencia).toContain("art. 248.2 LSC");
  });

  it("expresa los cuatro gates autoritativos y desvía el art. 212 bis", () => {
    const gates = pack.reglaEspecifica?.gates as Record<string, Record<string, unknown>>;
    expect(gates.target_entity).toMatchObject({ operador: "required", blocking: true });
    expect(gates.capital_socio_unico).toMatchObject({
      fuente: "capital_holdings",
      campo: "ownership_percentage",
      operador: "eq",
      valor: 100,
      blocking: true,
    });
    expect(gates.no_administrador_persona_juridica).toMatchObject({
      valor: false,
      blocking: true,
      failure_route: "REPRESENTANTE_ADMINISTRADOR_PJ_ART_212_BIS",
    });
    expect(gates.titulo_representacion_art183).toMatchObject({
      operador: "eq",
      valor: "GENERAL_PUBLIC_POWER_ART_183_1",
      blocking: true,
      referencia: "art. 183.1 LSC",
    });
    expect(gates.titulo_representacion_art183).not.toHaveProperty("rutas");
  });

  it("es un RulePack completo y ejecutable por evaluarDocumentacion", () => {
    expect(pack.acta.tipoActaPorModo).toEqual({
      MEETING: "ACTA_CONSEJO",
      NO_SESSION: "ACTA_ACUERDO_ESCRITO",
    });
    expect(pack.acta.contenidoMinimo.sesion).toContain("target_entity_id");
    expect(pack.plazosMateriales).toEqual({});
    expect(pack.postAcuerdo).toMatchObject({
      inscribible: false,
      instrumentoRequerido: "NINGUNO",
      publicacionRequerida: false,
    });

    const documentosDisponibles = pack.documentacion.obligatoria.map(({ id }) => ({ id }));
    const ok = evaluarDocumentacion(
      {
        adoptionMode: "MEETING",
        materias: [pack.materia],
        documentosDisponibles,
      },
      [pack],
    );
    expect(ok.ok).toBe(true);
    expect(ok.documentosFaltantes).toEqual([]);

    const missingCapital = evaluarDocumentacion(
      {
        adoptionMode: "MEETING",
        materias: [pack.materia],
        documentosDisponibles: documentosDisponibles.filter(
          ({ id }) => id !== "acreditacion_capital_100",
        ),
      },
      [pack],
    );
    expect(missingCapital.ok).toBe(false);
    expect(missingCapital.documentosFaltantes).toContainEqual({
      id: "acreditacion_capital_100",
      nombre: "Acreditación vigente de la titularidad del 100 % del capital de la filial",
    });
  });
});
