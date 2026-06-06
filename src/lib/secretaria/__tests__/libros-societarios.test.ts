import { describe, expect, it } from "vitest";
import {
  actaBookKindForBody,
  bookDefinitionForKind,
  buildSocietaryBookPortfolio,
  classifyBookDeadline,
  expectedBookCodesForEntity,
  normalizeMandatoryBookKind,
  summarizeBookPortfolio,
} from "../libros-societarios";

describe("libros societarios", () => {
  it("normaliza codigos legacy y actuales de mandatory_books", () => {
    expect(normalizeMandatoryBookKind("ACTAS")).toBe("LIBRO_ACTAS");
    expect(normalizeMandatoryBookKind("SOCIOS")).toBe("LIBRO_REGISTRO_SOCIOS");
    expect(normalizeMandatoryBookKind("ACCIONES")).toBe("LIBRO_ACCIONES_NOMINATIVAS");
    expect(normalizeMandatoryBookKind("SOCIO_UNICO")).toBe("LIBRO_CONTRATOS_SOCIO_UNICO");
    expect(normalizeMandatoryBookKind("LIBRO_ACCIONES_NOMINATIVAS")).toBe("LIBRO_ACCIONES_NOMINATIVAS");
  });

  it("deriva libros de actas por organo para junta, consejo y comisiones", () => {
    expect(actaBookKindForBody({ body_type: "JUNTA", name: "Junta General" })).toBe("LIBRO_ACTAS_JUNTA_GENERAL");
    expect(actaBookKindForBody({ body_type: "CDA", name: "Consejo de Administracion" })).toBe("LIBRO_ACTAS_CONSEJO_ADMINISTRACION");
    expect(actaBookKindForBody({ body_type: "COMISION", name: "Comision de Auditoria" })).toBe("LIBRO_ACTAS_COMISION_AUDITORIA");
    expect(actaBookKindForBody({ body_type: "COMITE", name: "Comite de Riesgos" })).toBe("LIBRO_ACTAS_COMISION_RIESGOS");
    expect(actaBookKindForBody({ body_type: "COMISION", name: "Comision Ejecutiva" })).toBe("LIBRO_ACTAS_COMISION_EJECUTIVA");
  });

  it("incluye registros auxiliares sectoriales para aseguradora cotizada", () => {
    const codes = expectedBookCodesForEntity({
      tipo_social: "SA",
      es_cotizada: true,
      regulated_sector: "SEGUROS",
    });

    expect(codes).toContain("LIBRO_ACCIONES_NOMINATIVAS");
    expect(codes).toContain("LIBRO_DIARIO");
    expect(codes).toContain("REGISTRO_COMUNICACIONES_REGULATORIAS");
    expect(codes).toContain("REGISTRO_IDONEIDAD_FIT_PROPER");
    expect(codes).toContain("REGISTRO_SOLVENCIA_II_SUPERVISION");
    expect(codes).not.toContain("LIBRO_REGISTRO_SOCIOS");
  });

  it("clasifica vencimientos sin alertar libros legalizados", () => {
    const now = new Date("2026-05-26T12:00:00Z");
    expect(classifyBookDeadline("2026-04-30", "PENDIENTE", now)).toBe("overdue");
    expect(classifyBookDeadline("2026-06-10", "PENDIENTE", now)).toBe("due_soon");
    expect(classifyBookDeadline("2026-12-31", "PENDIENTE", now)).toBe("in_time");
    expect(classifyBookDeadline("2026-04-30", "LEGALIZADO", now)).toBe("legalized");
    expect(classifyBookDeadline(null, "NO_APLICA", now)).toBe("unknown");
  });

  it("construye cartera con secciones de actas por organo y fallback legacy", () => {
    const portfolio = buildSocietaryBookPortfolio({
      now: new Date("2026-05-26T12:00:00Z"),
      entities: [
        {
          id: "entity-sa",
          tenant_id: "tenant",
          common_name: "ARGA Seguros",
          legal_name: "ARGA Seguros S.A.",
          tipo_social: "SA",
          es_cotizada: true,
          regulated_sector: "SEGUROS",
        },
      ],
      bodies: [
        { id: "junta", entity_id: "entity-sa", body_type: "JUNTA", name: "Junta General" },
        { id: "consejo", entity_id: "entity-sa", body_type: "CDA", name: "Consejo de Administracion" },
        { id: "riesgos", entity_id: "entity-sa", body_type: "COMITE", name: "Comite de Riesgos" },
      ],
      books: [
        {
          id: "book-actas",
          tenant_id: "tenant",
          entity_id: "entity-sa",
          book_kind: "LIBRO_ACTAS",
          volume_number: 1,
          period: 2026,
          status: "OPEN",
          opened_at: "2026-01-01",
          closed_at: null,
          legalization_deadline: "2027-04-30",
          legalization_status: "PENDIENTE",
          legalization_evidence_url: null,
          entity_name: "ARGA Seguros",
          tipo_social: "SA",
          es_cotizada: true,
          regulated_sector: "SEGUROS",
        },
      ],
    });

    const codes = new Set(portfolio.map((book) => book.book_code));
    expect(codes).toContain("LIBRO_ACTAS_JUNTA_GENERAL");
    expect(codes).toContain("LIBRO_ACTAS_CONSEJO_ADMINISTRACION");
    expect(codes).toContain("LIBRO_ACTAS_COMISION_RIESGOS");
    expect(codes).toContain("LIBRO_ACCIONES_NOMINATIVAS");
    expect(codes).toContain("REGISTRO_SOLVENCIA_II_SUPERVISION");
    expect(portfolio.find((book) => book.book_code === "LIBRO_ACTAS_JUNTA_GENERAL")?.source_book_id).toBe("book-actas");

    const summary = summarizeBookPortfolio(portfolio);
    expect(summary.mandatory).toBeGreaterThan(0);
    expect(summary.auxiliary).toBeGreaterThan(0);
    expect(bookDefinitionForKind("LIBRO_CONTRATOS_SOCIO_UNICO").contentRoute).toBe("/secretaria/decisiones-unipersonales");
  });
});
