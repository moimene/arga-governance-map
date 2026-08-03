import { describe, expect, it } from "vitest";
import { secretariaErrorMessage, secretariaOperationError } from "../supabase-error-message";

describe("secretariaErrorMessage", () => {
  it("serializa PostgrestError sin producir [object Object]", () => {
    const message = secretariaErrorMessage({
      code: "PGRST202",
      message: "Could not find the function public.fn_secretaria_resolve_minute_book_destination",
      details: "The function is missing from the schema cache",
      hint: "Apply the pending migration",
    });

    expect(message).toContain("PGRST202");
    expect(message).toContain("Could not find the function");
    expect(message).toContain("schema cache");
    expect(message).not.toContain("[object Object]");
  });

  it("acepta errores JSON anidados y conserva un fallback seguro", () => {
    expect(secretariaErrorMessage({ error: { message: "tenant mismatch" } })).toBe(
      "tenant mismatch",
    );
    expect(secretariaErrorMessage({}, "Operación no disponible.")).toBe(
      "Operación no disponible.",
    );
    expect(secretariaOperationError({ message: "book closed" }, "fallback")).toEqual(
      new Error("book closed"),
    );
  });
});
