import { describe, expect, it } from "vitest";
import {
  certificationKindExclusion,
  filterCertificationKindsInScope,
  isCertificationKindInScope,
} from "../certification-kind-scope";

/**
 * Filas reales de `standalone_certification_kinds` en governance_OS, leídas el
 * 2026-09-05. Se copian literalmente para que el test caiga si alguien vuelve a
 * ofrecer estos tipos, no importa por qué camino.
 */
const CLOUD_KINDS = [
  { kind_code: "CERT_ERDS_ENTREGA", label: "Certificado de entrega electrónica certificada ERDS", requires_qes: true },
  { kind_code: "CERT_COMUNICACIONES_REGULATORIAS", label: "Certificado de comunicaciones regulatorias", requires_qes: true },
  { kind_code: "CERT_ENVIO_CONVOCATORIA", label: "Certificado de emisión y envío de convocatoria", requires_qes: false },
  { kind_code: "CERT_VIGENCIA_CARGO", label: "Certificado de vigencia de cargo", requires_qes: false },
  { kind_code: "CERT_LIBRO_SOCIOS_TITULARIDAD", label: "Certificado de titularidad en libro de socios/acciones", requires_qes: false },
  { kind_code: "CERT_NOTIFICACION_SL_SOCIO", label: "Certificado individual de notificación a socio de SL", requires_qes: false },
  { kind_code: "CERT_ACUERDO_360", label: "Certificación de acuerdo 360", requires_qes: false },
];

describe("alcance vigente de los tipos de certificación", () => {
  it("no ofrece ERDS, entrega electrónica certificada ni envío", () => {
    expect(certificationKindExclusion(CLOUD_KINDS[0])).toBe("REQUIERE_FIRMA_CUALIFICADA");
    expect(certificationKindExclusion(CLOUD_KINDS[2])).toBe("AFIRMA_ENVIO_O_ENTREGA");
    // Aunque un día dejasen de exigir QES, el rótulo sigue afirmando la entrega.
    expect(
      certificationKindExclusion({ ...CLOUD_KINDS[0], requires_qes: false }),
    ).toBe("AFIRMA_ENVIO_O_ENTREGA");
  });

  it("no ofrece tipos que exijan firma electrónica cualificada", () => {
    expect(isCertificationKindInScope(CLOUD_KINDS[1])).toBe(false);
    expect(certificationKindExclusion({ kind_code: "CERT_X", label: "Certificado X", requires_qes: true }))
      .toBe("REQUIERE_FIRMA_CUALIFICADA");
  });

  it("sigue ofreciendo lo que la Secretaría sí acredita por sí misma", () => {
    // Certificar un hecho societario del propio registro (titularidad, cargo,
    // acuerdo, notificación practicada) no atribuye firma, envío ni entrega a
    // ningún tercero: no puede quedar fuera por este filtro.
    for (const kind of [CLOUD_KINDS[3], CLOUD_KINDS[4], CLOUD_KINDS[5], CLOUD_KINDS[6]]) {
      expect(isCertificationKindInScope(kind)).toBe(true);
    }
  });

  it("el filtro deja fuera exactamente los tres tipos medidos en Cloud", () => {
    const dentro = filterCertificationKindsInScope(CLOUD_KINDS).map((k) => k.kind_code);
    expect(dentro).toEqual([
      "CERT_VIGENCIA_CARGO",
      "CERT_LIBRO_SOCIOS_TITULARIDAD",
      "CERT_NOTIFICACION_SL_SOCIO",
      "CERT_ACUERDO_360",
    ]);
  });

  it("no revienta con filas incompletas y falla cerrado ante lo dudoso", () => {
    expect(isCertificationKindInScope({})).toBe(true);
    expect(isCertificationKindInScope({ kind_code: null, label: null, requires_qes: null })).toBe(true);
    expect(isCertificationKindInScope({ label: "Certificado con sello de tiempo cualificado" })).toBe(false);
    expect(filterCertificationKindsInScope([])).toEqual([]);
  });
});
