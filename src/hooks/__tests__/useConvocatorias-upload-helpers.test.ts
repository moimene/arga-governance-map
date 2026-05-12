/**
 * Tests para helpers del upload de adjuntos de convocatoria (M5).
 *
 * Cubre las superficies que no requieren mock completo de Supabase:
 *   - SHA-512 sobre contenido conocido (RFC vectors)
 *   - sanitizeFileName: normaliza caracteres peligrosos
 *   - ATTACHMENT_MAX_BYTES: límite constante
 *
 * Las superficies que SÍ requieren mock supabase (cleanup on insert fail,
 * upsert: false, storage path generation) se cubren en el hook test con
 * renderHook + vi.mock("@/integrations/supabase/client").
 */

import { describe, it, expect } from "vitest";
import {
  computeFileHashSha512,
  sanitizeFileName,
  ATTACHMENT_MAX_BYTES,
} from "../useConvocatorias";

// Codex P1 rounds 1+2 (PR #3): polyfill SIEMPRE `arrayBuffer()` en los
// fixtures de test. Razón:
//
//   1. Bun expone Blob/File.arrayBuffer correctamente (devuelve ArrayBuffer
//      compatible con SubtleCrypto). Bajo `bun test` los tests pasan sin
//      polyfill.
//   2. jsdom 26.x según versión puntual devuelve cosas distintas:
//      - en algunas: el método no existe (round 1 — polyfill condicional
//        funcionaba)
//      - en otras: el método existe pero devuelve un Node Buffer cuyo
//        backing store NO es transferible a `SubtleCrypto.digest` →
//        TypeError "2nd argument is not instance of ArrayBuffer, Buffer,
//        TypedArray, or DataView" (round 2 — el guard condicional saltaba
//        el polyfill y caía el test del Uint8Array fixture en CI).
//
// Decisión: SIEMPRE override (`configurable: true`), sin checks. El test
// fixture controla totalmente el shape devuelto a SubtleCrypto. Bun y
// jsdom convergen al mismo path determinista. Cero impacto en producción
// — sólo aplica al test file que define `makeFile`.
function makeFile(contents: string | Uint8Array, name = "test.bin"): File {
  const bytes = typeof contents === "string"
    ? new TextEncoder().encode(contents)
    : contents;
  const file = new File([bytes], name);
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => {
      // Construir un ArrayBuffer fresco copiando bytes (no slice del view,
      // que conservaría el byteOffset y podría ser un SharedArrayBuffer en
      // algunos runners). El nuevo buffer es ArrayBuffer puro, compatible
      // garantizado con SubtleCrypto.digest.
      const out = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(out).set(bytes);
      return out;
    },
  });
  return file;
}

describe("computeFileHashSha512", () => {
  it("string vacío → SHA-512 conocido (RFC test vector)", async () => {
    // SHA-512 de string vacío:
    // cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce
    // 47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
    const file = makeFile("", "empty.txt");
    const hash = await computeFileHashSha512(file);
    expect(hash).toBe(
      "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    );
  });

  it("'abc' → SHA-512 conocido (RFC test vector)", async () => {
    // SHA-512("abc") =
    // ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a
    // 2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f
    const file = makeFile("abc", "abc.txt");
    const hash = await computeFileHashSha512(file);
    expect(hash).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    );
  });

  it("longitud del hash es siempre 128 chars (SHA-512 hex)", async () => {
    const file = makeFile(new Uint8Array(1024 * 1024), "blob.bin"); // 1 MB de ceros
    const hash = await computeFileHashSha512(file);
    expect(hash).toHaveLength(128);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it("dos archivos con el mismo contenido producen el mismo hash", async () => {
    const a = makeFile("mismo contenido", "a.txt");
    const b = makeFile("mismo contenido", "b.txt");
    const ha = await computeFileHashSha512(a);
    const hb = await computeFileHashSha512(b);
    expect(ha).toBe(hb);
  });

  it("dos archivos con contenido distinto producen hashes distintos", async () => {
    const a = makeFile("contenido A", "a.txt");
    const b = makeFile("contenido B", "b.txt");
    const ha = await computeFileHashSha512(a);
    const hb = await computeFileHashSha512(b);
    expect(ha).not.toBe(hb);
  });
});

describe("sanitizeFileName", () => {
  it("preserva alfanuméricos, dots, dash y underscore", () => {
    expect(sanitizeFileName("informe_gestion-2025.pdf")).toBe("informe_gestion-2025.pdf");
  });

  it("reemplaza espacios por _", () => {
    expect(sanitizeFileName("Mi documento.pdf")).toBe("Mi_documento.pdf");
  });

  it("reemplaza caracteres no ASCII por _", () => {
    expect(sanitizeFileName("acción_legal.pdf")).toBe("acci_n_legal.pdf");
  });

  it("reemplaza separadores de path por _ (dots se preservan, slashes no)", () => {
    // El sanitize permite dots (extensiones legítimas como .tar.gz). El
    // Storage path final está controlado por convocatorias/{id}/{uuid}-{name}
    // — los dots residuales en el name NO se resuelven como path traversal
    // porque Supabase Storage normaliza paths sin soporte de ".." relativo.
    expect(sanitizeFileName("../etc/passwd")).toBe(".._etc_passwd");
  });

  it("reemplaza backslash de Windows por _", () => {
    expect(sanitizeFileName("C:\\Users\\foo.pdf")).toBe("C__Users_foo.pdf");
  });

  it("trunca a 200 caracteres máximo", () => {
    const long = "a".repeat(300) + ".pdf";
    const sanitized = sanitizeFileName(long);
    expect(sanitized).toHaveLength(200);
  });

  it("string vacío → string vacío (no crash)", () => {
    expect(sanitizeFileName("")).toBe("");
  });

  it("solo caracteres prohibidos → string de underscores", () => {
    expect(sanitizeFileName("$$$!!!")).toBe("______");
  });
});

describe("ATTACHMENT_MAX_BYTES", () => {
  it("es exactamente 25 MB", () => {
    expect(ATTACHMENT_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(ATTACHMENT_MAX_BYTES).toBe(26_214_400);
  });
});
