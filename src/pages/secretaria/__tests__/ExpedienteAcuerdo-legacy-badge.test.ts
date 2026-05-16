/**
 * A2 UI Badge — contract guard sobre `ExpedienteAcuerdo.tsx`.
 *
 * El A2 helper (`isLegacyMeetingAdoptionSnapshot`) está testeado puro en
 * `meeting-adoption-snapshot.test.ts`. Este archivo asegura que el
 * componente que lo CONSUME sigue importándolo y montando el badge.
 *
 * Sin esto, alguien podría:
 *   - Quitar el import del helper (lint-clean si no se usa).
 *   - Eliminar el `<span>` del badge (la UI deja de avisar pero el
 *     helper sigue verde en sus tests aislados).
 *   - Cambiar la condición a otra que oculte siempre el badge.
 *
 * Estrategia: static-source guard, mismo patrón que D1
 * (`useAgreementCompliance-organo-resolver.test.ts`). Frágil a
 * refactors superficiales (renombrar variable `a` por `agreement`
 * romperá un regex), por diseño — cualquier cambio del wiring debe
 * pasar por revisión humana, no quick-fix.
 *
 * NO es una alternativa al test de render. Es cinturón. La defensa
 * principal sigue siendo el helper puro.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENT_SOURCE = readFileSync(
  resolve(__dirname, "..", "ExpedienteAcuerdo.tsx"),
  "utf8",
);

describe("A2 UI Badge — ExpedienteAcuerdo wiring guards", () => {
  it("importa isLegacyMeetingAdoptionSnapshot del barrel rules-engine", () => {
    expect(COMPONENT_SOURCE).toMatch(
      /import\s+\{\s*isLegacyMeetingAdoptionSnapshot\s*\}\s+from\s+["']@\/lib\/rules-engine["']/,
    );
  });

  it("invoca el helper sobre `compliance_snapshot` del agreement", () => {
    // Acepta tanto `a.compliance_snapshot` como `agreement.compliance_snapshot`,
    // siempre que el argumento sea el snapshot persistido (no el computed).
    expect(COMPONENT_SOURCE).toMatch(
      /isLegacyMeetingAdoptionSnapshot\(\s*\w+\.compliance_snapshot\s*\)/,
    );
  });

  it("renderiza un span con el texto 'Snapshot anterior' en el header", () => {
    // El badge debe estar literalmente en el JSX, no oculto detrás de
    // alias o constantes que un refactor accidental podría vaciar.
    expect(COMPONENT_SOURCE).toMatch(/Snapshot anterior/);
  });

  it("incluye el copy UX explicativo de divergencia con la evaluación actual", () => {
    expect(COMPONENT_SOURCE).toMatch(
      /Este resultado fue calculado con una versión anterior del sistema\. La evaluación actual puede diferir\./,
    );
  });

  it("no reemplaza el helper por una comparación manual de engine_version", () => {
    // Anti-pattern detectado: alguien podría inline-reemplazar el helper
    // por `a.compliance_snapshot?.engine_version !== "2.1"`. Eso pierde:
    //   - La discriminación por schema_version (false positives en
    //     solidario/co-aprobacion).
    //   - La normalización del campo (corrupciones, ausentes).
    expect(COMPONENT_SOURCE).not.toMatch(
      /compliance_snapshot\??\.engine_version\s*[!=]==/,
    );
  });
});
