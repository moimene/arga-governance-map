import { describe, expect, it } from "vitest";
import {
  ACTION_PLAN_STATUS_CHIP,
  DPIA_STATUS_CHIP,
  DSAR_STATUS_CHIP,
  EXCEPTION_STATUS_CHIP,
  INCIDENT_STATUS_CHIP,
  NEUTRAL_CHIP,
  NOTIFICATION_STATUS_CHIP,
  NOTIFICATION_STATUS_LABEL,
  RISK_LEVEL_CHIP,
  RISK_STATUS_OPTIONS,
  SEVERITY_CHIP,
  SEVERITY_OPTIONS,
  VULNERABILITY_STATUS_CHIP,
  actionPlanStatusChip,
  dpiaStatusChip,
  dsarStatusChip,
  exceptionStatusChip,
  incidentStatusChip,
  notificationStatusChip,
  notificationStatusLabel,
  riskLevelChip,
  severityChip,
  vulnerabilityStatusChip,
} from "../status-labels";

const FALLBACK_INPUTS: ReadonlyArray<string | null | undefined> = [
  "",
  null,
  undefined,
  "DesconocidoX",
];

describe("grc/status-labels — token contract", () => {
  it("NEUTRAL_CHIP usa los tokens Garrigues correctos", () => {
    expect(NEUTRAL_CHIP).toContain("var(--g-surface-muted)");
    expect(NEUTRAL_CHIP).toContain("var(--g-text-secondary)");
    expect(NEUTRAL_CHIP).toContain("var(--g-border-subtle)");
  });

  it("ningún chip usa colores hex o clases Tailwind nativas prohibidas", () => {
    const allChipMaps = [
      SEVERITY_CHIP,
      INCIDENT_STATUS_CHIP,
      NOTIFICATION_STATUS_CHIP,
      EXCEPTION_STATUS_CHIP,
      VULNERABILITY_STATUS_CHIP,
      ACTION_PLAN_STATUS_CHIP,
      DSAR_STATUS_CHIP,
      DPIA_STATUS_CHIP,
      RISK_LEVEL_CHIP,
    ];
    const forbiddenPatterns = [
      /#[0-9a-fA-F]{3,8}/,                                    // hex literals
      /\b(text|bg|border)-(white|black|gray|amber|green|red|blue|yellow)-/, // Tailwind nativos
    ];
    for (const map of allChipMaps) {
      for (const className of Object.values(map)) {
        for (const pattern of forbiddenPatterns) {
          expect(className).not.toMatch(pattern);
        }
      }
    }
  });
});

describe("grc/status-labels — severity (incidentes/findings/vulns)", () => {
  it("expone exactamente Crítico/Alto/Medio/Bajo", () => {
    expect(Object.keys(SEVERITY_CHIP).sort()).toEqual(["Alto", "Bajo", "Crítico", "Medio"]);
  });

  it("Crítico va a status-error", () => {
    expect(severityChip("Crítico")).toContain("var(--status-error)");
  });

  it("Alto va a status-warning", () => {
    expect(severityChip("Alto")).toContain("var(--status-warning)");
  });

  it("Medio y Bajo van a NEUTRAL (mismo chip que fallback)", () => {
    expect(severityChip("Medio")).toBe(NEUTRAL_CHIP);
    expect(severityChip("Bajo")).toBe(NEUTRAL_CHIP);
  });

  it("fallback NEUTRAL para valores ausentes/desconocidos", () => {
    for (const input of FALLBACK_INPUTS) {
      expect(severityChip(input)).toBe(NEUTRAL_CHIP);
    }
  });
});

describe("grc/status-labels — severity options (canonical order)", () => {
  it("expone Crítico/Alto/Medio/Bajo en orden de gravedad", () => {
    expect(SEVERITY_OPTIONS).toEqual(["Crítico", "Alto", "Medio", "Bajo"]);
  });

  it("las options coinciden con las keys del SEVERITY_CHIP (sin drift)", () => {
    expect([...SEVERITY_OPTIONS].sort()).toEqual(Object.keys(SEVERITY_CHIP).sort());
  });
});

describe("grc/status-labels — incident status", () => {
  it("expone los 5 estados del lifecycle de incidente", () => {
    expect(Object.keys(INCIDENT_STATUS_CHIP).sort()).toEqual([
      "Abierto",
      "Cerrado",
      "En contención",
      "En investigación",
      "Resuelto",
    ]);
  });

  it("Abierto = error, Resuelto = success, Cerrado = NEUTRAL", () => {
    expect(incidentStatusChip("Abierto")).toContain("var(--status-error)");
    expect(incidentStatusChip("Resuelto")).toContain("var(--status-success)");
    expect(incidentStatusChip("Cerrado")).toBe(NEUTRAL_CHIP);
  });

  it("En investigación usa status-info (distintivo de En contención)", () => {
    expect(incidentStatusChip("En investigación")).toContain("var(--status-info)");
    expect(incidentStatusChip("En contención")).toContain("var(--status-warning)");
  });

  it("fallback NEUTRAL para valores ausentes/desconocidos", () => {
    for (const input of FALLBACK_INPUTS) {
      expect(incidentStatusChip(input)).toBe(NEUTRAL_CHIP);
    }
  });
});

describe("grc/status-labels — notificaciones regulatorias", () => {
  it("expone 4 estados (Pendiente/Enviada/Aceptada/Rechazada)", () => {
    expect(Object.keys(NOTIFICATION_STATUS_CHIP).sort()).toEqual([
      "Aceptada",
      "Enviada",
      "Pendiente",
      "Rechazada",
    ]);
  });

  it("Aceptada usa el color brand (no success)", () => {
    expect(notificationStatusChip("Aceptada")).toContain("var(--g-brand-3308)");
    expect(notificationStatusChip("Enviada")).toContain("var(--status-success)");
  });

  it("notificationStatusLabel preserva el patrón uppercase", () => {
    expect(notificationStatusLabel("Pendiente")).toBe("PENDIENTE");
    expect(notificationStatusLabel("Enviada")).toBe("ENVIADA");
    expect(notificationStatusLabel("Aceptada")).toBe("ACEPTADA");
    expect(notificationStatusLabel("Rechazada")).toBe("RECHAZADA");
  });

  it("notificationStatusLabel devuelve el valor crudo para desconocidos", () => {
    expect(notificationStatusLabel("Otro")).toBe("Otro");
    expect(notificationStatusLabel("")).toBe("");
    expect(notificationStatusLabel(null)).toBe("");
    expect(notificationStatusLabel(undefined)).toBe("");
  });

  it("notificationStatusChip fallback NEUTRAL", () => {
    for (const input of FALLBACK_INPUTS) {
      expect(notificationStatusChip(input)).toBe(NEUTRAL_CHIP);
    }
  });
});

describe("grc/status-labels — excepciones", () => {
  it("expone Pendiente/Aprobada/Rechazada/Expirada", () => {
    expect(Object.keys(EXCEPTION_STATUS_CHIP).sort()).toEqual([
      "Aprobada",
      "Expirada",
      "Pendiente",
      "Rechazada",
    ]);
  });

  it("Pendiente=warning, Aprobada=success, Rechazada=error, Expirada=NEUTRAL", () => {
    expect(exceptionStatusChip("Pendiente")).toContain("var(--status-warning)");
    expect(exceptionStatusChip("Aprobada")).toContain("var(--status-success)");
    expect(exceptionStatusChip("Rechazada")).toContain("var(--status-error)");
    expect(exceptionStatusChip("Expirada")).toBe(NEUTRAL_CHIP);
  });

  it("fallback NEUTRAL", () => {
    for (const input of FALLBACK_INPUTS) {
      expect(exceptionStatusChip(input)).toBe(NEUTRAL_CHIP);
    }
  });
});

describe("grc/status-labels — vulnerabilidades", () => {
  it("expone Abierta/En mitigación/Parcheada/Aceptada (femenino)", () => {
    expect(Object.keys(VULNERABILITY_STATUS_CHIP).sort()).toEqual([
      "Abierta",
      "Aceptada",
      "En mitigación",
      "Parcheada",
    ]);
  });

  it("Abierta=error, En mitigación=warning, Parcheada=success, Aceptada=NEUTRAL", () => {
    expect(vulnerabilityStatusChip("Abierta")).toContain("var(--status-error)");
    expect(vulnerabilityStatusChip("En mitigación")).toContain("var(--status-warning)");
    expect(vulnerabilityStatusChip("Parcheada")).toContain("var(--status-success)");
    expect(vulnerabilityStatusChip("Aceptada")).toBe(NEUTRAL_CHIP);
  });

  it("rechaza el masculino 'Abierto' (ese es de incidentes/action plans)", () => {
    expect(vulnerabilityStatusChip("Abierto")).toBe(NEUTRAL_CHIP);
  });
});

describe("grc/status-labels — action plans", () => {
  it("expone Abierto/En curso/Cerrado", () => {
    expect(Object.keys(ACTION_PLAN_STATUS_CHIP).sort()).toEqual([
      "Abierto",
      "Cerrado",
      "En curso",
    ]);
  });

  it("Abierto=error, En curso=warning, Cerrado=success", () => {
    expect(actionPlanStatusChip("Abierto")).toContain("var(--status-error)");
    expect(actionPlanStatusChip("En curso")).toContain("var(--status-warning)");
    expect(actionPlanStatusChip("Cerrado")).toContain("var(--status-success)");
  });

  it("fallback NEUTRAL", () => {
    for (const input of FALLBACK_INPUTS) {
      expect(actionPlanStatusChip(input)).toBe(NEUTRAL_CHIP);
    }
  });
});

describe("grc/status-labels — DSARs (GDPR)", () => {
  it("expone En curso/Resuelto/Pendiente", () => {
    expect(Object.keys(DSAR_STATUS_CHIP).sort()).toEqual([
      "En curso",
      "Pendiente",
      "Resuelto",
    ]);
  });

  it("Resuelto=success, En curso=warning, Pendiente=error", () => {
    expect(dsarStatusChip("Resuelto")).toContain("var(--status-success)");
    expect(dsarStatusChip("En curso")).toContain("var(--status-warning)");
    expect(dsarStatusChip("Pendiente")).toContain("var(--status-error)");
  });
});

describe("grc/status-labels — DPIAs (GDPR)", () => {
  it("expone Aprobada/En revisión/Rechazada", () => {
    expect(Object.keys(DPIA_STATUS_CHIP).sort()).toEqual([
      "Aprobada",
      "En revisión",
      "Rechazada",
    ]);
  });

  it("Aprobada=success, En revisión=warning, Rechazada=error", () => {
    expect(dpiaStatusChip("Aprobada")).toContain("var(--status-success)");
    expect(dpiaStatusChip("En revisión")).toContain("var(--status-warning)");
    expect(dpiaStatusChip("Rechazada")).toContain("var(--status-error)");
  });
});

describe("grc/status-labels — risk level (ROPA + DPIAs)", () => {
  it("escala Alto/Medio/Bajo (sin Crítico — distinta de severity)", () => {
    expect(Object.keys(RISK_LEVEL_CHIP).sort()).toEqual(["Alto", "Bajo", "Medio"]);
    expect(RISK_LEVEL_CHIP).not.toHaveProperty("Crítico");
  });

  it("Alto=error, Medio=warning, Bajo=NEUTRAL", () => {
    expect(riskLevelChip("Alto")).toContain("var(--status-error)");
    expect(riskLevelChip("Medio")).toContain("var(--status-warning)");
    expect(riskLevelChip("Bajo")).toBe(NEUTRAL_CHIP);
  });
});

describe("grc/status-labels — risk status options (RiskEditor)", () => {
  it("expone exactamente las 2 opciones base", () => {
    expect(RISK_STATUS_OPTIONS).toEqual(["Abierto", "En tratamiento"]);
  });

  it("es readonly tuple (preservada en runtime como array)", () => {
    expect(Array.isArray(RISK_STATUS_OPTIONS)).toBe(true);
    expect(RISK_STATUS_OPTIONS.length).toBe(2);
  });
});
