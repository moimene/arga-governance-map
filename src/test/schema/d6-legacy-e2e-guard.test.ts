import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function listE2eSpecs(dir = join(process.cwd(), "e2e")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listE2eSpecs(path);
    return entry.isFile() && entry.name.endsWith(".spec.ts") ? [path] : [];
  });
}

describe("D6 alta sociedad E2E debt guard", () => {
  it("does not keep the retired client-side rollback spec", () => {
    const filenames = listE2eSpecs().map((file) => file.split("/").pop());
    expect(filenames).not.toContain("35-secretaria-alta-rollback.spec.ts");
  });

  it("does not reintroduce the old SociedadNuevaStepper contract", () => {
    const corpus = listE2eSpecs()
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    const retiredRollbackPhrase = ["alta sociedad rollback", "compensatorio"].join(" ");
    const retiredStepperPhrase = ["SociedadNuevaStepper drive", "4 pasos"].join(" ");

    expect(corpus).not.toMatch(new RegExp(retiredRollbackPhrase, "i"));
    expect(corpus).not.toMatch(new RegExp(retiredStepperPhrase, "i"));
  });
});
