import { describe, expect, it } from "bun:test";
import { autoridadConvocante } from "../convocante-autoridad";

const CDA = "cda-1";
const JUNTA = "junta-1";
const presidenteCda = { body_id: CDA, cargo: "PRESIDENTE", person: { full_name: "Carlos Mendoza Ruiz" } };
const secretarioCda = { body_id: CDA, cargo: "SECRETARIO", person: { full_name: "Elena Gómez Blanco" } };

describe("autoridadConvocante (MOI-142)", () => {
  it("Junta: convoca el Presidente del órgano de administración, y su nombre llega al texto", () => {
    const a = autoridadConvocante({
      organoTipo: "JUNTA_GENERAL",
      presidenteDelOrgano: null, // la Junta no tiene Presidente propio
      organoAdministracionId: CDA,
      evidenciasEntidad: [secretarioCda, presidenteCda],
    });
    expect(a?.person.full_name).toBe("Carlos Mendoza Ruiz");
  });

  it("Junta: también el administrador único", () => {
    const admin = { body_id: CDA, cargo: "ADMIN_UNICO", person: { full_name: "A. Único" } };
    expect(
      autoridadConvocante({ organoTipo: "JUNTA_GENERAL", presidenteDelOrgano: null, organoAdministracionId: CDA, evidenciasEntidad: [admin] }),
    ).toBe(admin);
  });

  it("Junta: nunca un cargo de la propia Junta ni un secretario; sin órgano de administración, nadie", () => {
    const deLaJunta = { body_id: JUNTA, cargo: "PRESIDENTE", person: { full_name: "X" } };
    expect(
      autoridadConvocante({ organoTipo: "JUNTA_GENERAL", presidenteDelOrgano: deLaJunta, organoAdministracionId: CDA, evidenciasEntidad: [deLaJunta, secretarioCda] }),
    ).toBeNull();
    expect(
      autoridadConvocante({ organoTipo: "JUNTA_GENERAL", presidenteDelOrgano: null, organoAdministracionId: null, evidenciasEntidad: [presidenteCda] }),
    ).toBeNull();
  });

  it("Consejo: sin cambio, el Presidente vigente del propio órgano", () => {
    expect(
      autoridadConvocante({ organoTipo: "CONSEJO", presidenteDelOrgano: presidenteCda, organoAdministracionId: CDA, evidenciasEntidad: [] }),
    ).toBe(presidenteCda);
  });
});
