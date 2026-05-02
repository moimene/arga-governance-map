import { describe, expect, it } from "vitest";
import {
  GROUP_CAMPAIGN_TEMPLATES,
  buildGroupCampaignExpedientes,
  buildGroupCampaignLaunchInput,
  determineCampaignAdoptionMode,
  makeDefaultCampaignParams,
  uniqueCampaignJurisdictions,
  type CampaignSocietyInput,
} from "../group-campaign-engine";

function society(overrides: Partial<CampaignSocietyInput>): CampaignSocietyInput {
  return {
    id: "soc-default",
    legal_name: "ARGA Test, S.L.",
    common_name: null,
    jurisdiction: "ES",
    legal_form: "SL",
    tipo_social: "SL",
    entity_status: "Active",
    forma_administracion: "Consejo de administración",
    tipo_organo_admin: "CONSEJO",
    es_unipersonal: false,
    es_cotizada: false,
    ...overrides,
  };
}

describe("group-campaign-engine", () => {
  const cuentas = GROUP_CAMPAIGN_TEMPLATES.find((template) => template.type === "CUENTAS_ANUALES")!;
  const params = makeDefaultCampaignParams(new Date("2026-04-30T10:00:00.000Z"));

  it("determina adoption modes sin bloquear cotizadas y sin aplanar administracion", () => {
    expect(determineCampaignAdoptionMode(society({ tipo_organo_admin: "CONSEJO", es_cotizada: true }), "ADMIN", false)).toBe("MEETING");
    expect(determineCampaignAdoptionMode(society({ tipo_organo_admin: "CONSEJO" }), "ADMIN", true)).toBe("NO_SESSION");
    expect(determineCampaignAdoptionMode(society({ tipo_organo_admin: "ADMINISTRADOR_UNICO", forma_administracion: "Administrador único" }), "ADMIN", false)).toBe("UNIPERSONAL_ADMIN");
    expect(determineCampaignAdoptionMode(society({ tipo_organo_admin: "ADMIN_MANCOMUNADOS", forma_administracion: "Administradores mancomunados" }), "ADMIN", false)).toBe("CO_APROBACION");
    expect(determineCampaignAdoptionMode(society({ tipo_organo_admin: "ADMIN_SOLIDARIOS", forma_administracion: "Administradores solidarios" }), "ADMIN", false)).toBe("SOLIDARIO");
    expect(determineCampaignAdoptionMode(society({ es_unipersonal: true, tipo_social: "SLU" }), "JUNTA", false)).toBe("UNIPERSONAL_SOCIO");
    expect(determineCampaignAdoptionMode(society({}), "POST", false)).toBe("POST_TASK");
  });

  it("descompone cuentas anuales en expedientes explicables por sociedad", () => {
    const expedientes = buildGroupCampaignExpedientes(
      [
        society({ id: "sa-cotizada", legal_name: "ARGA Seguros, S.A.", common_name: "ARGA Seguros", tipo_social: "SA", es_cotizada: true }),
        society({ id: "sl-mancomunada", legal_name: "ARGA Inmobiliaria, S.L.", tipo_organo_admin: "ADM_MANCOMUNADOS", forma_administracion: "Administradores mancomunados" }),
      ],
      cuentas,
      params,
    );

    expect(expedientes).toHaveLength(2);
    expect(expedientes[0]).toMatchObject({
      sociedad: "ARGA Seguros",
      adoptionMode: "POST_TASK",
      deadline: "2026-07-29",
      rulePack: "ES-SA-DEPOSITO_CUENTAS",
    });
    expect(expedientes[0].alertas).toContain("Advertencias LMV activas");
    expect(expedientes[0].explain).toContain("cotizada=true");

    expect(expedientes[1].adoptionMode).toBe("CO_APROBACION");
    expect(expedientes[1].explain).toContain("forma_administracion=ADM_MANCOMUNADOS");
  });

  it("genera payload de lanzamiento con pasos, dependencias y explain por fase", () => {
    const sociedades = [
      society({ id: "sa-consejo", legal_name: "ARGA Seguros, S.A.", tipo_social: "SA" }),
      society({ id: "slu", legal_name: "ARGA Servicios, S.L.U.", tipo_social: "SLU", es_unipersonal: true }),
    ];
    const expedientes = buildGroupCampaignExpedientes(sociedades, cuentas, params);
    const launch = buildGroupCampaignLaunchInput(params, cuentas, sociedades, expedientes);

    expect(launch).toMatchObject({
      campaignType: "CUENTAS_ANUALES",
      name: "Ciclo anual de cuentas 2025",
      plazoLimite: "2026-07-29",
    });
    expect(launch.acuerdosCadena.map((agreement) => agreement.code)).toEqual([
      "FORMULACION_CUENTAS",
      "CONVOCATORIA_JGA",
      "APROBACION_CUENTAS",
      "DEPOSITO_CUENTAS",
    ]);
    expect(launch.expedientes[0].steps).toHaveLength(4);
    expect(launch.expedientes[0].steps[1]).toMatchObject({
      materia: "CONVOCATORIA_JGA",
      dependency: "FORMULACION_CUENTAS",
      adoptionMode: "MEETING",
      deadline: "2026-04-30",
    });
    expect(launch.expedientes[1].steps[2]).toMatchObject({
      materia: "APROBACION_CUENTAS",
      adoptionMode: "UNIPERSONAL_SOCIO",
    });
    expect(launch.expedientes[1].steps[2].explain).toMatchObject({
      unipersonal: true,
      adoption_mode: "UNIPERSONAL_SOCIO",
    });
  });

  it("mantiene jurisdicciones base y añade las reales del alcance", () => {
    expect(uniqueCampaignJurisdictions([
      society({ jurisdiction: "ES" }),
      society({ jurisdiction: "CO" }),
      society({ jurisdiction: null }),
    ])).toEqual(["BR", "CO", "ES", "MX", "PT"]);
  });
});
