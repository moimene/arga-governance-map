import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateApprovalDialog } from "../TemplateApprovalDialog";

function todayForDateInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("TemplateApprovalDialog", () => {
  it("abre como diálogo modal, inicializa la fecha y enfoca el aprobador", () => {
    render(<TemplateApprovalDialog onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Confirmar aprobación" }).getAttribute("aria-modal"),
    ).toBe("true");
    const approver = screen.getByLabelText("Aprobada por") as HTMLInputElement;
    expect(approver.value).toBe("");
    expect(document.activeElement).toBe(approver);
    expect((screen.getByLabelText("Fecha de aprobación") as HTMLInputElement).value).toBe(
      todayForDateInput(),
    );
  });

  it("exige ambos campos, anuncia los errores y enfoca el primero", async () => {
    const onConfirm = vi.fn();
    render(<TemplateApprovalDialog onConfirm={onConfirm} onCancel={vi.fn()} />);

    const date = screen.getByLabelText("Fecha de aprobación") as HTMLInputElement;
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprobación" }));

    const approver = screen.getByLabelText("Aprobada por");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(approver.getAttribute("aria-invalid")).toBe("true");
    expect(date.getAttribute("aria-invalid")).toBe("true");
    expect(approver.getAttribute("aria-describedby")).toBe(
      screen.getByText("Indica quién aprobó la plantilla.").id,
    );
    expect(date.getAttribute("aria-describedby")).toBe(
      screen.getByText("Indica la fecha de aprobación.").id,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    await waitFor(() => expect(document.activeElement).toBe(approver));
  });

  it("rechaza y enfoca una fecha de aprobación futura", async () => {
    const onConfirm = vi.fn();
    render(<TemplateApprovalDialog onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Aprobada por"), {
      target: { value: "Comité Legal ARGA" },
    });
    const date = screen.getByLabelText("Fecha de aprobación") as HTMLInputElement;
    fireEvent.change(date, { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprobación" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "La fecha de aprobación no puede ser futura.",
    );
    await waitFor(() => expect(document.activeElement).toBe(date));
  });

  it("confirma una sola vez con el aprobador normalizado y la fecha elegida", () => {
    const onConfirm = vi.fn();
    render(<TemplateApprovalDialog onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Aprobada por"), {
      target: { value: "  Comité Legal ARGA  " },
    });
    fireEvent.change(screen.getByLabelText("Fecha de aprobación"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar aprobación" }).closest("form")!);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith({
      aprobadaPor: "Comité Legal ARGA",
      fechaAprobacion: "2026-07-10",
    });
  });

  it("mantiene el foco dentro del diálogo", () => {
    render(<TemplateApprovalDialog onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Confirmar aprobación" });
    const approver = screen.getByLabelText("Aprobada por");
    const confirm = screen.getByRole("button", { name: "Confirmar aprobación" });

    approver.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    confirm.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(approver);
  });

  it("bloquea acciones mientras la aprobación está en curso", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <TemplateApprovalDialog pending onConfirm={onConfirm} onCancel={onCancel} />,
    );

    expect((screen.getByLabelText("Aprobada por") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Fecha de aprobación") as HTMLInputElement).disabled).toBe(true);
    const confirmButton = screen.getByRole("button", { name: "Aprobando…" }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    expect(confirmButton.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
