// scripts/aims/harvey/__tests__/registro.test.ts — MOI-169: cada SHA-256 del registro coincide con su prompt archivado.
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../../..");
type Peticion = { id: string; estado: string; prompt: string; respuesta: string; sha256_prompt?: string };
const registro: { peticiones: Peticion[] } = JSON.parse(readFileSync(resolve(ROOT, "docs/legal/harvey/registro.json"), "utf8"));

describe("docs/legal/harvey/registro.json", () => {
  it("las peticiones RESPONDIDAS con SHA lo cumplen contra el prompt y tienen respuesta archivada", () => {
    const conSha = registro.peticiones.filter((p) => p.sha256_prompt);
    expect(conSha.length).toBeGreaterThanOrEqual(6); // control: el lector ve filas
    for (const p of conSha) {
      const f = resolve(ROOT, p.prompt);
      expect(existsSync(f), `${p.id}: falta ${p.prompt}`).toBe(true);
      expect(createHash("sha256").update(readFileSync(f)).digest("hex"), p.id).toBe(p.sha256_prompt);
      if (p.estado === "RESPONDIDA") expect(existsSync(resolve(ROOT, p.respuesta)), `${p.id}: falta ${p.respuesta}`).toBe(true);
    }
  });
});
