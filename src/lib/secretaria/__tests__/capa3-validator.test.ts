import { describe, expect, it } from "vitest";
import { validateCapa3ForMateria } from "../capa3-validator";

function issueCodes(materia: string, values: Record<string, unknown>, context: Parameters<typeof validateCapa3ForMateria>[2] = {}) {
  return validateCapa3ForMateria(materia, values, context).issues.map((issue) => issue.code);
}

describe("capa3-validator — rangos legales por materia", () => {
  describe("NOMBRAMIENTO_AUDITOR", () => {
    it.each([1, 2, 10, 12])("rechaza duracion_anos=%s fuera del rango 3-9", (duracion) => {
      const result = validateCapa3ForMateria("NOMBRAMIENTO_AUDITOR", { duracion_anos: duracion });

      expect(result.ok).toBe(false);
      expect(result.status).toBe("FAIL");
      expect(result.issues[0]).toMatchObject({
        code: "AUDITOR_DURATION_RANGE",
        referencia_legal: "art. 264.1 LSC",
      });
    });

    it.each([3, 5, 9])("acepta duracion_anos=%s dentro del rango legal", (duracion) => {
      const result = validateCapa3ForMateria("NOMBRAMIENTO_AUDITOR", { duracion_anos: duracion });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("PASS");
    });
  });

  describe("NOMBRAMIENTO_CONSEJERO", () => {
    it("rechaza plazo superior a 4 anos en SA cotizada", () => {
      expect(issueCodes("NOMBRAMIENTO_CONSEJERO", { plazo_mandato: 5 }, { tipoSocial: "SA", esCotizada: true }))
        .toContain("CONSEJERO_TERM_RANGE");
    });

    it("acepta plazo de 4 anos en SA cotizada", () => {
      const result = validateCapa3ForMateria("NOMBRAMIENTO_CONSEJERO", { plazo_mandato: 4 }, {
        tipoSocial: "SA",
        esCotizada: true,
      });

      expect(result.ok).toBe(true);
    });

    it("rechaza plazo superior a 6 anos en SA no cotizada", () => {
      expect(issueCodes("NOMBRAMIENTO_CONSEJERO", { plazo_mandato: 7 }, { tipoSocial: "SA", esCotizada: false }))
        .toContain("CONSEJERO_TERM_RANGE");
    });

    it("acepta plazo de 6 anos en SA no cotizada", () => {
      const result = validateCapa3ForMateria("NOMBRAMIENTO_CONSEJERO", { plazo_mandato: 6 }, {
        tipoSocial: "SA",
        esCotizada: false,
      });

      expect(result.ok).toBe(true);
    });

    it("aplica el plazo estatutario si es inferior al maximo legal", () => {
      expect(issueCodes("NOMBRAMIENTO_CONSEJERO", { plazo_mandato: 6 }, {
        tipoSocial: "SA",
        esCotizada: false,
        plazoMandatoEstatutos: 5,
      })).toContain("CONSEJERO_TERM_RANGE");
    });

    it("rechaza cooptacion en SL", () => {
      expect(issueCodes("NOMBRAMIENTO_CONSEJERO", { es_cooptacion: true }, { tipoSocial: "SL" }))
        .toContain("COOPTACION_ONLY_SA");
    });

    it("acepta cooptacion en SA", () => {
      const result = validateCapa3ForMateria("NOMBRAMIENTO_CONSEJERO", { modo_nombramiento: "COOPTACION" }, {
        tipoSocial: "SA",
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("AUMENTO_CAPITAL", () => {
    it("acepta coherencia aritmetica capital anterior + aumento = capital nuevo", () => {
      const result = validateCapa3ForMateria("AUMENTO_CAPITAL", {
        capital_anterior: 1000,
        importe_aumento: 250,
        capital_nuevo: 1250,
        plazo_suscripcion_preferente_dias: 15,
      });

      expect(result.ok).toBe(true);
    });

    it("rechaza capital nuevo inconsistente", () => {
      expect(issueCodes("AUMENTO_CAPITAL", {
        capital_anterior: 1000,
        importe_aumento: 250,
        capital_nuevo: 1249,
      })).toContain("CAPITAL_INCREASE_ARITHMETIC");
    });

    it("rechaza plazo de suscripcion preferente inferior a 15 dias", () => {
      expect(issueCodes("AUMENTO_CAPITAL", { plazo_suscripcion_preferente_dias: 10 }))
        .toContain("PREFERENTIAL_SUBSCRIPTION_PERIOD");
    });

    it("permite elevar por contexto el plazo minimo de suscripcion preferente", () => {
      expect(issueCodes("AUMENTO_CAPITAL", { plazo_suscripcion_preferente_dias: 15 }, {
        plazoSuscripcionPreferenteMinDias: 30,
      })).toContain("PREFERENTIAL_SUBSCRIPTION_PERIOD");
    });
  });

  describe("REDUCCION_CAPITAL", () => {
    it("activa gate de oposicion para reduccion efectiva", () => {
      const result = validateCapa3ForMateria("REDUCCION_CAPITAL", { tipo_reduccion: "devolucion_aportaciones" });

      expect(result.ok).toBe(false);
      expect(result.derived.requiresCreditorOpposition).toBe(true);
      expect(issueCodes("REDUCCION_CAPITAL", { tipo_reduccion: "devolucion_aportaciones" }))
        .toContain("CREDITOR_OPPOSITION_GATE");
    });

    it("no exige oposicion de acreedores si la reduccion es por perdidas", () => {
      const result = validateCapa3ForMateria("REDUCCION_CAPITAL", { tipo_reduccion: "por_perdidas" });

      expect(result.ok).toBe(true);
      expect(result.derived.requiresCreditorOpposition).toBe(false);
    });

    it("acepta reduccion efectiva si el plazo de oposicion esta documentado", () => {
      const result = validateCapa3ForMateria("REDUCCION_CAPITAL", {
        tipo_reduccion: "devolucion_aportaciones",
        oposicion_acreedores_documentada: true,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("POLITICA_REMUNERACION", () => {
    it("rechaza retribucion_maxima_total como texto libre", () => {
      expect(issueCodes("POLITICA_REMUNERACION", { retribucion_maxima_total: "4 millones" }))
        .toContain("CAPA3_NUMERIC_FIELD");
    });

    it("rechaza importes no positivos", () => {
      expect(issueCodes("POLITICA_REMUNERACION", { retribucion_maxima_total: 0 }))
        .toContain("REMUNERATION_POSITIVE_AMOUNT");
    });

    it("acepta retribucion_maxima_total numerica", () => {
      const result = validateCapa3ForMateria("POLITICA_REMUNERACION", { retribucion_maxima_total: 4000000 });

      expect(result.ok).toBe(true);
    });
  });

  describe("SEGUROS_RESPONSABILIDAD", () => {
    it("rechaza importes de poliza como texto libre", () => {
      expect(issueCodes("SEGUROS_RESPONSABILIDAD", {
        prima_total: "cincuenta mil",
        limite_cobertura: 1000000,
        franquicia: 0,
      })).toContain("CAPA3_NUMERIC_FIELD");
    });

    it("bloquea poliza intra-grupo sin tratamiento de conflicto", () => {
      expect(issueCodes("SEGUROS_RESPONSABILIDAD", {
        aseguradora_del_grupo: true,
        prima_total: 50000,
        limite_cobertura: 1000000,
        franquicia: 0,
      })).toContain("GROUP_INSURER_CONFLICT_GATE");
    });

    it("acepta poliza intra-grupo con soporte de mercado independiente", () => {
      const result = validateCapa3ForMateria("SEGUROS_RESPONSABILIDAD", {
        aseguradora_del_grupo: true,
        soporte_mercado_independiente: true,
        prima_total: 50000,
        limite_cobertura: 1000000,
        franquicia: 0,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("FUSION_ESCISION", () => {
    it("rechaza referencia legal LSC generica para modificaciones estructurales", () => {
      expect(issueCodes("FUSION_ESCISION", { referencia_legal: "arts. 22-30 LSC" }))
        .toContain("STRUCTURAL_OPERATION_LEGAL_REF");
    });

    it("acepta referencia RDL 5/2023", () => {
      const result = validateCapa3ForMateria("FUSION_ESCISION", {
        referencia_legal: "arts. 11-90 RDL 5/2023",
      });

      expect(result.ok).toBe(true);
    });

    it("rechaza fusion simplificada si requiere_experto no es false", () => {
      expect(issueCodes("FUSION_ESCISION", {
        referencia_legal: "art. 53 RDL 5/2023",
        tipo_operacion: "fusion_simplificada",
        requiere_experto: true,
      })).toContain("SIMPLIFIED_MERGER_EXPERT_REPORT");
    });

    it("acepta fusion simplificada con experto dispensado", () => {
      const result = validateCapa3ForMateria("FUSION_ESCISION", {
        referencia_legal: "art. 53 RDL 5/2023",
        tipo_operacion: "fusion_simplificada",
        requiere_experto: false,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("COMITES_INTERNOS", () => {
    it("aplica default si articulos_lsc_comite es opcional y viene vacio", () => {
      const result = validateCapa3ForMateria("COMITES_INTERNOS", {
        articulos_lsc_comite: "",
        requerido: false,
        tipo_comite: "Auditoria",
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("WARNING");
      expect(result.normalizedValues.articulos_lsc_comite).toBe("arts. 529 quaterdecies LSC");
      expect(result.issues[0].code).toBe("COMMITTEE_LEGAL_REF_DEFAULTED");
    });
  });

  describe("DISTRIBUCION_DIVIDENDOS", () => {
    it("rechaza dividendo superior al beneficio distribuible", () => {
      expect(issueCodes("DISTRIBUCION_DIVIDENDOS", {
        importe_dividendo: 95,
        resultado_neto: 100,
        dotacion_reserva_legal: 10,
      })).toContain("DIVIDEND_DISTRIBUTABLE_AMOUNT");
    });

    it("acepta dividendo dentro del beneficio distribuible", () => {
      const result = validateCapa3ForMateria("DISTRIBUCION_DIVIDENDOS", {
        importe_dividendo: 90,
        resultado_neto: 100,
        dotacion_reserva_legal: 10,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("RATIFICACION_ACTOS", () => {
    it("rechaza ratificacion sin listado o anexo de actos", () => {
      expect(issueCodes("RATIFICACION_ACTOS", { enumeracion_actos: [] }))
        .toContain("RATIFICATION_ACTS_REQUIRED");
    });

    it("acepta ratificacion con enumeracion de actos", () => {
      const result = validateCapa3ForMateria("RATIFICACION_ACTOS", {
        enumeracion_actos: ["Contrato de prestacion de servicios 2026"],
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("MODIFICACION_ESTATUTOS", () => {
    it("bloquea si la convocatoria no acredita texto integro disponible", () => {
      expect(issueCodes("MODIFICACION_ESTATUTOS", { texto_integro_disponible: false }))
        .toContain("BYLAWS_FULL_TEXT_GATE");
    });

    it("acepta si el texto integro se incluyo en convocatoria", () => {
      const result = validateCapa3ForMateria("MODIFICACION_ESTATUTOS", {
        convocatoria_incluye_texto_integro: true,
      });

      expect(result.ok).toBe(true);
    });
  });
});
