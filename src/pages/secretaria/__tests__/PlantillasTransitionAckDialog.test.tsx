import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransitionAckDialog } from "../Plantillas";

const issues = [
  {
    severity: "WARNING" as const,
    code: "LEGAL_REFERENCE_WARNING",
    message: "Revisa la referencia legal antes de continuar.",
  },
];

describe("TransitionAckDialog", () => {
  it("abre modal, enfoca el motivo, atrapa el foco y permite Escape", () => {
    const onCancel = vi.fn();
    render(
      <TransitionAckDialog
        issues={issues}
        pending={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Revisar advertencias de la comprobación documental",
    });
    const warnings = screen.getByRole("region", {
      name: "Advertencias que requieren reconocimiento",
    });
    const textarea = screen.getByRole("textbox", { name: "Motivo (≥20 caracteres)" });
    const cancel = screen.getByRole("button", { name: "Cancelar" });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(textarea);
    warnings.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
    cancel.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(warnings);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("solo confirma un reconocimiento suficiente y bloquea acciones pendientes", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <TransitionAckDialog
        issues={issues}
        pending={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirm = screen.getByRole("button", {
      name: "Confirmar y marcar como vigente",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo (≥20 caracteres)" }), {
      target: { value: "Revisión legal completada y aceptada." },
    });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Revisión legal completada y aceptada.");

    rerender(
      <TransitionAckDialog
        issues={issues}
        pending
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect((screen.getByRole("textbox", { name: "Motivo (≥20 caracteres)" }) as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
