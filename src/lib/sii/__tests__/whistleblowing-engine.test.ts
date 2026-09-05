import { describe, expect, it } from "vitest";
import {
  computeWhistleblowingDeadlines,
  evaluateSubcasePerimeter,
  sanitizeMetadata,
  evaluateConflictOfInterest,
  evaluateAntiRetaliationRisk,
  validateCaseCloseoutGuard,
  generateLibroRegistroEntry,
  type WhistleblowingReport,
  type WhistleblowingSubcase,
} from "../whistleblowing-engine";

describe("Whistleblowing Engine — Ley 2/2023 & Harvey Mandate", () => {
  describe("1. Relojes legales (Ley 2/2023 arts. 9.2.c, 9.2.d y 26.2)", () => {
    it("computes 7 natural days acknowledgment deadline and 3 calendar months resolution", () => {
      const intakeDate = new Date("2026-03-01T10:00:00Z");
      const result = computeWhistleblowingDeadlines(intakeDate);

      // 7 natural days: 2026-03-08
      expect(result.ackDeadline7d.toISOString().slice(0, 10)).toBe("2026-03-08");

      // 3 calendar months from 7d deadline: 2026-06-08
      expect(result.resolutionDeadline3m.toISOString().slice(0, 10)).toBe("2026-06-08");

      // 10 years retention limit: 2036-03-01
      expect(result.libroRetention10y.toISOString().slice(0, 10)).toBe("2036-03-01");
    });

    it("los 3 meses arrancan en la RECEPCIÓN cuando se remitió acuse (art. 9.2.d)", () => {
      // ESTE TEST FIJABA EL ERROR. Esperaba 2026-06-03 —tres meses desde la
      // fecha del ACUSE—, y el art. 9.2.d dice, literal contra el consolidado
      // del BOE (BOE-A-2023-4513, cotejado el 2026-09-05):
      //
      //   «…no podrá ser superior a tres meses a contar desde la recepción de
      //   la comunicación o, si no se remitió un acuse de recibo al informante,
      //   a tres meses a partir del vencimiento del plazo de siete días…»
      //
      // Es decir: si HAY acuse, se cuenta desde la recepción. Con el cálculo
      // anterior el vencimiento mostrado quedaba hasta SIETE DÍAS por encima
      // del máximo legal, y un expediente vencido se pintaba en plazo.
      const intakeDate = new Date("2026-03-01T10:00:00Z");
      const actualAckDate = new Date("2026-03-03T14:00:00Z");
      const result = computeWhistleblowingDeadlines(intakeDate, actualAckDate);

      expect(result.resolutionDeadline3m.toISOString().slice(0, 10)).toBe("2026-06-01");
      // Y nunca puede pasarse del tope de la recepción + 3 meses.
      const topeLegal = new Date("2026-06-01T10:00:00Z");
      expect(result.resolutionDeadline3m.getTime()).toBeLessThanOrEqual(topeLegal.getTime());
    });

    it("sin acuse remitido, los 3 meses arrancan al vencer los 7 días (art. 9.2.d)", () => {
      const result = computeWhistleblowingDeadlines(new Date("2026-03-01T10:00:00Z"));
      expect(result.resolutionDeadline3m.toISOString().slice(0, 10)).toBe("2026-06-08");
    });

    it("un acuse tardío no alarga el plazo, y se marca como fuera de plazo", () => {
      // `ackIsOverdue` mide contra HOY y vale true en todo expediente antiguo:
      // no sirve para contar cumplimiento. `ackSentOnTime` sí.
      const intake = new Date("2026-03-01T10:00:00Z");
      const enPlazo = computeWhistleblowingDeadlines(intake, new Date("2026-03-05T10:00:00Z"));
      const tarde = computeWhistleblowingDeadlines(intake, new Date("2026-03-20T10:00:00Z"));

      expect(enPlazo.ackSentOnTime).toBe(true);
      expect(tarde.ackSentOnTime).toBe(false);
      expect(computeWhistleblowingDeadlines(intake).ackSentOnTime).toBeNull();

      // El acuse tardío NO compra plazo: mismo vencimiento que el puntual.
      expect(tarde.resolutionDeadline3m.toISOString()).toBe(enPlazo.resolutionDeadline3m.toISOString());

      // Y el reloj no lo declara "COMPLETADO" por el mero hecho de existir.
      const reloj = (r: typeof tarde) => r.clocks.find((c) => c.type === "ACUSE_7D")!;
      expect(reloj(enPlazo).status).toBe("COMPLETADO");
      expect(reloj(tarde).status).toBe("VENCIDO");
    });

    it("handles extension to 6 months for special complexity", () => {
      const intakeDate = new Date("2026-03-01T10:00:00Z");
      const result = computeWhistleblowingDeadlines(intakeDate, null, true);

      // 6 months from 2026-03-08 -> 2026-09-08
      expect(result.maxExtendedDeadline6m.toISOString().slice(0, 10)).toBe("2026-09-08");
      expect(result.clocks.some((c) => c.type === "PRORROGA_3M")).toBe(true);
    });
  });

  describe("2. Autonomous Subcases Perimeter Engine", () => {
    it("generates Penal subcase for corruption / bribery allegations", () => {
      const res = evaluateSubcasePerimeter({
        category: "Corrupción y Fraude",
        summary: "Pago indebido de comisiones a funcionario público",
        detailedDescription: "Se alega presunto soborno en licitación inmobiliaria.",
      });

      expect(res.subcasesToCreate.some((s) => s.regime === "PENAL_31BIS")).toBe(true);
      expect(res.subcasesToCreate.find((s) => s.regime === "PENAL_31BIS")?.ownerRole).toBe("Responsable de Cumplimiento Penal");
    });

    it("generates RGPD subcase for personal data breach allegations", () => {
      const res = evaluateSubcasePerimeter({
        category: "Seguridad y Datos",
        summary: "Filtración masiva de pólizas y datos de salud",
        detailedDescription: "Acceso no autorizado y brecha de seguridad en base de datos de clientes.",
        affectsPersonalData: true,
      });

      expect(res.subcasesToCreate.some((s) => s.regime === "RGPD_BREACH")).toBe(true);
      expect(res.subcasesToCreate.find((s) => s.regime === "RGPD_BREACH")?.ownerRole).toBe("Data Protection Officer (DPO)");
    });

    it("generates DORA and AIMS 360 subcases when ICT and AI systems are involved", () => {
      const res = evaluateSubcasePerimeter({
        category: "Tecnología e IA",
        summary: "Fallo crítico en algoritmo de suscripción automatizado con sesgo discriminatorio",
        detailedDescription: "El sistema core DORA se interrumpió y el modelo LLM produjo alucinaciones graves en siniestros.",
        affectsAI: true,
        affectsICT: true,
      });

      expect(res.subcasesToCreate.some((s) => s.regime === "DORA_ICT")).toBe(true);
      expect(res.subcasesToCreate.some((s) => s.regime === "AIMS_AI")).toBe(true);
    });

    it("requires escalation to Audit Committee when targeting Board level members", () => {
      const res = evaluateSubcasePerimeter({
        category: "Conflicto de Interés",
        summary: "Operación vinculada irregular del Consejero Delegado",
        detailedDescription: "Aprobación de inversión sin abstención del CEO.",
        isBoardOrExecutiveTarget: true,
      });

      expect(res.escalationRequired).toBe(true);
      expect(res.escalationTarget).toBe("COMITE_AUDITORIA");
    });
  });

  describe("3. Saneado del NOMBRE de archivo (no del contenido)", () => {
    // `expect(removedMetadata.length).toBeGreaterThan(0)` se cumplía SIEMPRE:
    // los dos `push` que lo llenaban estaban fuera de todo `if`, así que con la
    // función ignorando por completo su entrada el test seguía verde. Ahora se
    // compara el resultado con la entrada.
    it("descarta la ruta local y sustituye el nombre original", () => {
      const sanitized = sanitizeMetadata("C:\\Users\\JuanPerez\\Documents\\Contrato_JuanPerez_v1.docx");

      expect(sanitized.sanitizedFilename).toMatch(/^EVIDENCIA_SII_[A-Z0-9]+\.docx$/);
      expect(sanitized.sanitizedFilename).not.toContain("JuanPerez");
      expect(sanitized.removedMetadata.join(" ")).toMatch(/Ruta del sistema local/);
    });

    it("un nombre limpio NO produce descartes que no han ocurrido", () => {
      // Aquí caía el guard de constantes: sin ruta ni caracteres raros no hay
      // nada que descartar salvo el propio nombre.
      const sanitized = sanitizeMetadata("informe.pdf");
      expect(sanitized.removedMetadata).toEqual([
        "Nombre original del archivo, sustituido por una referencia neutra",
      ]);
      expect(sanitized.removedMetadata.join(" ")).not.toMatch(/EXIF|software|autor/i);
    });

    it("no afirma haber tocado el contenido: solo describe el nombre", () => {
      // El contenido ni se lee ni se sube. Si alguien vuelve a meter una línea
      // sobre EXIF o huella de software, esto cae.
      for (const n of ["a.jpg", "/tmp/x y z.png", "sin_extension", ""]) {
        expect(sanitizeMetadata(n).removedMetadata.join(" ")).not.toMatch(/EXIF|huella de software|Autor del documento/i);
      }
      expect(sanitizeMetadata("").removedMetadata).toEqual([]);
    });
  });

  describe("4. Conflict of Interest & Recusation Engine", () => {
    it("triggers automatic recusation when investigator belongs to target department", () => {
      const investigator = { id: "inv-1", name: "Dña. Laura Gómez", department: "Inversiones" };
      const res = evaluateConflictOfInterest(investigator, { targetDepartment: "Inversiones" });

      expect(res.hasConflict).toBe(true);
      expect(res.actionRequired).toBe("RECUSACION_AUTOMATICA");
      expect(res.reason).toBe("UNIDAD_DENUNCIADA");
    });

    it("triggers escalation to Audit Committee when targeting a Board member", () => {
      const investigator = { id: "inv-1", name: "Dña. Elena Navarro", department: "Cumplimiento" };
      const res = evaluateConflictOfInterest(investigator, { isBoardTarget: true });

      expect(res.hasConflict).toBe(true);
      expect(res.actionRequired).toBe("ESCALADO_COMITE_AUDITORIA");
      expect(res.reason).toBe("CONSEJO_ALTA_DIRECCION");
    });

    it("approves ordinary assignment when no conflict exists", () => {
      const investigator = { id: "inv-1", name: "Dña. Elena Navarro", department: "Cumplimiento" };
      const res = evaluateConflictOfInterest(investigator, { targetDepartment: "Siniestros Auto" });

      expect(res.hasConflict).toBe(false);
      expect(res.actionRequired).toBe("ASIGNACION_ORDINARIA");
    });
  });

  describe("5. Anti-Retaliation Risk Engine", () => {
    it("evaluates high/critical risk for employee reporting high-level executive", () => {
      const evalResult = evaluateAntiRetaliationRisk({
        isAnonymous: false,
        informantRole: "EMPLEADO",
        reportedTargetSeniority: "ALTA_DIRECCION",
        hasPriorThreats: true,
      });

      expect(evalResult.riskLevel).toBe("CRITICO");
      expect(evalResult.monitoringFrequency).toBe("QUINCENAL");
      expect(evalResult.recommendedMeasures.some((m) => m.includes("Inmunidad laboral"))).toBe(true);
    });

    it("evaluates low risk for anonymous informant with safe inbox monitoring", () => {
      const evalResult = evaluateAntiRetaliationRisk({
        isAnonymous: true,
        informantRole: "EMPLEADO",
        reportedTargetSeniority: "MANDO_INTERMEDIO",
      });

      expect(evalResult.riskLevel).toBe("BAJO");
      expect(evalResult.monitoringFrequency).toBe("TRIMESTRAL");
    });
  });

  describe("6. Case Closeout Guard (Anti-Cross-Closeout)", () => {
    it("blocks root case closure when acknowledgment is pending without exemption", () => {
      const mockReport: Pick<WhistleblowingReport, "status" | "subcases" | "acknowledgmentSentDate" | "acknowledgmentExemptReason"> = {
        status: "EN_INVESTIGACION",
        acknowledgmentSentDate: null,
        acknowledgmentExemptReason: null,
        subcases: [],
      };

      const res = validateCaseCloseoutGuard(mockReport);
      expect(res.canClose).toBe(false);
      expect(res.blockingReasons.some((r) => r.includes("acuse de recibo"))).toBe(true);
    });

    it("blocks root case closure when open subcases remain", () => {
      const mockSubcase: WhistleblowingSubcase = {
        id: "sub-1",
        reportId: "rep-1",
        regime: "PENAL_31BIS",
        label: "Subexpediente Penal",
        authorityTarget: "Fiscalía",
        ownerRole: "Compliance Penal",
        ownerName: "Pedro Silva",
        status: "EN_INSTRUCCION",
        createdAt: "2026-03-01",
        requiresIndependentClose: true,
      };

      const mockReport: Pick<WhistleblowingReport, "status" | "subcases" | "acknowledgmentSentDate" | "acknowledgmentExemptReason"> = {
        status: "EN_INVESTIGACION",
        acknowledgmentSentDate: "2026-03-02",
        acknowledgmentExemptReason: null,
        subcases: [mockSubcase],
      };

      const res = validateCaseCloseoutGuard(mockReport);
      expect(res.canClose).toBe(false);
      expect(res.openSubcasesCount).toBe(1);
    });

    it("allows root case closure when all subcases are resolved or transferred to remediation", () => {
      const closedSubcase: WhistleblowingSubcase = {
        id: "sub-1",
        reportId: "rep-1",
        regime: "PENAL_31BIS",
        label: "Subexpediente Penal",
        authorityTarget: "Fiscalía",
        ownerRole: "Compliance Penal",
        ownerName: "Pedro Silva",
        status: "CERRADO",
        createdAt: "2026-03-01",
        closedAt: "2026-05-15",
        closingReason: "Falta de indicios probatorios",
        requiresIndependentClose: true,
      };

      const mockReport: Pick<WhistleblowingReport, "status" | "subcases" | "acknowledgmentSentDate" | "acknowledgmentExemptReason"> = {
        status: "EN_INVESTIGACION",
        acknowledgmentSentDate: "2026-03-02",
        acknowledgmentExemptReason: null,
        subcases: [closedSubcase],
      };

      const res = validateCaseCloseoutGuard(mockReport);
      expect(res.canClose).toBe(true);
      expect(res.blockingReasons.length).toBe(0);
    });
  });

  describe("7. Official Libro-Registro Generator (Art. 26 Ley 2/2023)", () => {
    it("genera el asiento con referencia propia y límite de retención de 10 años", () => {
      const mockReport: WhistleblowingReport = {
        id: "rep-101",
        code: "SII-2026-08-009",
        trackingToken: "SEC-9F8A-72B1-K82M",
        trackingTokenReference: "REF-TOKEN-101",
        intakeDate: "2026-08-10T09:00:00Z",
        channel: "WEB_ANONIMO",
        anonymityMode: "ANONIMO_ESTRICTO",
        entityId: "ent-1",
        entityName: "ARGA Seguros S.A.",
        jurisdiction: "ES",
        category: "Corrupción y Fraude",
        severity: "GRAVE",
        status: "EN_INVESTIGACION",
        summary: "Denuncia sobre irregularidad en contratación",
        detailedDescription: "Hechos relativos a favorecimiento de proveedor.",
        resolutionDeadline: "2026-11-17T09:00:00Z",
        extensionApproved: false,
        assignedInvestigatorId: "inv-1",
        assignedInvestigatorName: "Dña. Elena Navarro Pons",
        isEscalatedToBoardCommittee: false,
        subcases: [],
        messages: [],
        recusations: [],
        evidences: [],
      };

      const entry = generateLibroRegistroEntry(mockReport, {
        outcome: "Investigación completada y confirmada",
        actionsTaken: ["Entrevistas", "Análisis forense"],
      });

      expect(entry.recordNumber).toBe("REG-SII-2026-08-009");
      expect(entry.reportCode).toBe("SII-2026-08-009");
      // El asiento lleva una REFERENCIA, no una prueba criptográfica. El campo
      // se llamaba `immutableProofHash` y su valor iba prefijado como si fuera
      // un digest, cuando lo produce un hash JS de 32 bits: identifica, no prueba.
      expect(entry.referenciaAsiento).toContain("REF-SII-");
      expect(entry.referenciaAsiento).not.toMatch(/SHA/i);
      expect(entry.retentionLimitDate.slice(0, 4)).toBe("2036");
      // Con cierre, el asiento se incorpora; sin cierre se calcula al vuelo y
      // la pantalla del libro-registro tiene que decirlo.
      expect(entry.incorporadoAlCierre).toBe(true);
      expect(generateLibroRegistroEntry(mockReport).incorporadoAlCierre).toBe(false);
    });
  });
});
