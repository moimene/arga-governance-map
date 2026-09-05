import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { minuteHasLegalSignature } from "../authoritative-legal-state";
import { classifyBookDeadline } from "../libros-societarios";
import { REGISTRY_IN_PROGRESS_STATUSES } from "../registry-lifecycle";

/**
 * Criterios del panel de Secretaría (`/secretaria`), fijados sobre las FORMAS
 * REALES de las filas de `governance_OS` medidas el 2026-09-05.
 *
 * Los tres nacieron de la misma raíz: el Dashboard reescribió a mano un
 * criterio que ya existía en otro sitio, y las dos copias divergieron. Este
 * fichero prueba el criterio canónico contra el dato real y comprueba que el
 * panel lo CONSUME en vez de tener el suyo.
 */

const DASHBOARD = resolve(process.cwd(), "src/pages/secretaria/Dashboard.tsx");
const fuenteDashboard = () => readFileSync(DASHBOARD, "utf8");

describe("actas pendientes de aprobación — criterio autoritativo, no la marca legacy", () => {
  /**
   * `minutes` de ARGA en Cloud (2026-09-05), agrupadas tal cual salen:
   * 4 DEMO_SIMULATION firmadas y bloqueadas, 4 LEGACY_REVIEW idem, 3
   * DEMO_SIMULATION sin firmar y 1 DRAFT. `approval_canonical_status` es NULL
   * en las doce: NINGUNA está aprobada según el gate.
   */
  const ACTAS_CLOUD_ARGA = [
    { n: 4, legal_gate_status: "DEMO_SIMULATION", approval_canonical_status: null, signed_at: "2026-04-22T10:00:00Z", is_locked: true },
    { n: 4, legal_gate_status: "LEGACY_REVIEW", approval_canonical_status: null, signed_at: "2026-04-22T10:00:00Z", is_locked: true },
    { n: 3, legal_gate_status: "DEMO_SIMULATION", approval_canonical_status: null, signed_at: null, is_locked: false },
    { n: 1, legal_gate_status: "DRAFT", approval_canonical_status: null, signed_at: null, is_locked: false },
  ];

  const aprobada = (row: (typeof ACTAS_CLOUD_ARGA)[number]) =>
    minuteHasLegalSignature({
      legalGateStatus: row.legal_gate_status as never,
      signedAt: row.signed_at,
      isLocked: row.is_locked,
      approvalEvidenceMode: "INTERPOSITION",
      approvalSignatureClaim: false,
      approvalCanonicalStatus: row.approval_canonical_status,
    });

  it("una simulación demo firmada NO cuenta como aprobada", () => {
    // Con el criterio legacy (`signed_at IS NULL`) estas 8 actas de ARGA
    // contaban como aprobadas y el panel decía «Todas aprobadas».
    expect(aprobada(ACTAS_CLOUD_ARGA[0])).toBe(false);
    expect(aprobada(ACTAS_CLOUD_ARGA[1])).toBe(false);
  });

  it("sobre el dato real de ARGA, 0 aprobadas y 12 pendientes (no 4)", () => {
    const total = ACTAS_CLOUD_ARGA.reduce((acc, row) => acc + row.n, 0);
    const aprobadas = ACTAS_CLOUD_ARGA.reduce((acc, row) => acc + (aprobada(row) ? row.n : 0), 0);
    expect(total).toBe(12);
    expect(aprobadas).toBe(0);
    expect(total - aprobadas).toBe(12);
    // El criterio legacy contaba 4 pendientes: las que no tenían signed_at.
    const pendientesLegacy = ACTAS_CLOUD_ARGA.reduce((acc, row) => acc + (row.signed_at ? 0 : row.n), 0);
    expect(pendientesLegacy).toBe(4);
  });

  it("sí cuenta aprobada la que cumple el gate completo", () => {
    expect(
      minuteHasLegalSignature({
        legalGateStatus: "APPROVED_SIGNED",
        signedAt: "2026-08-01T09:00:00Z",
        isLocked: true,
        approvalEvidenceMode: "INTERPOSITION",
        approvalSignatureClaim: false,
        approvalCanonicalStatus: "APPROVED_EVIDENCED",
      }),
    ).toBe(true);
  });

  it("el panel consume el criterio canónico y no reescribe el suyo", () => {
    const src = fuenteDashboard();
    expect(src).toContain("minuteHasLegalSignature(");
    // La marca legacy no puede volver a decidir quién está aprobada.
    expect(src).not.toContain('.is("signed_at", null)');
  });
});

describe("libros en alerta — un libro legalizado no está en alerta", () => {
  /** `mandatory_books` de ARGA con plazo dentro de 30 días (Cloud 2026-09-05). */
  const LIBROS_CLOUD_ARGA = [
    { n: 1, legalization_deadline: "2026-07-26", legalization_status: "LEGALIZADO" },
    { n: 2, legalization_deadline: "2026-07-26", legalization_status: "PENDIENTE" },
  ];
  const AHORA = new Date("2026-07-10T00:00:00Z");

  const enAlerta = (row: (typeof LIBROS_CLOUD_ARGA)[number]) => {
    const estado = classifyBookDeadline(row.legalization_deadline, row.legalization_status, AHORA);
    return estado === "overdue" || estado === "due_soon";
  };

  it("el legalizado queda fuera y los pendientes dentro", () => {
    expect(enAlerta(LIBROS_CLOUD_ARGA[0])).toBe(false);
    expect(enAlerta(LIBROS_CLOUD_ARGA[1])).toBe(true);
  });

  it("sobre el dato real el panel debe decir 2, no 3", () => {
    const soloPorFecha = LIBROS_CLOUD_ARGA.reduce((acc, row) => acc + row.n, 0);
    const conCriterio = LIBROS_CLOUD_ARGA.reduce((acc, row) => acc + (enAlerta(row) ? row.n : 0), 0);
    expect(soloPorFecha).toBe(3);
    expect(conCriterio).toBe(2);
  });

  it("el panel usa la misma función que /secretaria/libros", () => {
    expect(fuenteDashboard()).toContain("classifyBookDeadline(");
  });
});

describe("tramitaciones en curso — el ciclo v2 también está en curso", () => {
  it("PREPARADA y ELEVADA están en el vocabulario en curso", () => {
    // Los 4 expedientes de Garrigues en PREPARADA (Cloud 2026-09-05) eran
    // invisibles en la Mesa hasta que avanzaban.
    expect(REGISTRY_IN_PROGRESS_STATUSES).toContain("PREPARADA");
    expect(REGISTRY_IN_PROGRESS_STATUSES).toContain("ELEVADA");
    expect(REGISTRY_IN_PROGRESS_STATUSES).toContain("EN_TRAMITE");
    expect(REGISTRY_IN_PROGRESS_STATUSES).toContain("PRESENTADA");
  });

  it("no incluye terminales ni estados de bloqueo", () => {
    for (const fuera of ["INSCRITA", "DEPOSITADA", "LEGALIZADA", "PUBLICADA", "DENEGADA", "SUBSANACION"]) {
      expect(REGISTRY_IN_PROGRESS_STATUSES).not.toContain(fuera);
    }
  });

  it("el panel y su agenda leen el vocabulario del ciclo, no una copia", () => {
    const src = fuenteDashboard();
    expect(src).toContain("REGISTRY_IN_PROGRESS_STATUSES");
    expect(src).not.toContain('["EN_TRAMITE", "PRESENTADA"]');
  });
});
