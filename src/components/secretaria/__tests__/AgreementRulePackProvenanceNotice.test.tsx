/**
 * MOI-207 — el panel del expediente debe mostrar el aviso de procedencia
 * cuando la selección del rule pack es poco fiable (`FALLBACK_ORGANO_DISTINTO`
 * o `FALLBACK_AMBIGUO`), y quedar mudo en los demás casos. Advierte, no
 * bloquea — no hay ningún `disabled` ni control de flujo en este componente.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgreementRulePackProvenanceNotice } from "../AgreementRulePackProvenanceNotice";

describe("AgreementRulePackProvenanceNotice", () => {
  it("no muestra nada cuando el pack coincide con el órgano del acuerdo", () => {
    const { container } = render(
      <AgreementRulePackProvenanceNotice reason="ORGANO_COINCIDE" packOrgano="CONSEJO" agreementOrgano="CONSEJO" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("no muestra nada cuando hay un único pack sin órgano conocido", () => {
    const { container } = render(
      <AgreementRulePackProvenanceNotice reason="UNICO_PACK_SIN_ORGANO_CONOCIDO" packOrgano="JUNTA_GENERAL" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("no muestra nada cuando no hay ningún pack (reason null)", () => {
    const { container } = render(<AgreementRulePackProvenanceNotice reason={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("advierte cuando la regla aplicada es de otro órgano, nombrando ambos", () => {
    render(
      <AgreementRulePackProvenanceNotice
        reason="FALLBACK_ORGANO_DISTINTO"
        packOrgano="JUNTA_GENERAL"
        agreementOrgano="CONSEJO"
      />,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Junta General");
    expect(notice).toHaveTextContent("Consejo de Administración");
    expect(notice).toHaveTextContent(/dictamen de validez/i);
  });

  it("advierte cuando la elección entre varios packs es ambigua", () => {
    render(<AgreementRulePackProvenanceNotice reason="FALLBACK_AMBIGUO" />);
    expect(screen.getByRole("status")).toHaveTextContent(/varias reglas activas/i);
  });

  it("no bloquea: no hay ningún atributo disabled ni de control de flujo", () => {
    render(
      <AgreementRulePackProvenanceNotice reason="FALLBACK_ORGANO_DISTINTO" packOrgano="CONSEJO" agreementOrgano="JUNTA_GENERAL" />,
    );
    expect(screen.getByRole("status")).not.toHaveAttribute("disabled");
  });
});
