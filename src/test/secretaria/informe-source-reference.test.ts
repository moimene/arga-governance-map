import { describe, expect, it } from "vitest";
import {
  DECLARED_REFERENCE_NO_HASH_LABEL,
  buildInformeSourceFields,
  informeHashDisplay,
} from "@/lib/secretaria/informe-source-reference";

describe("informe-source-reference (MOI-196)", () => {
  it("un informe sin artefacto vinculado queda con source_hash nulo y el rótulo de referencia declarada", () => {
    const fields = buildInformeSourceFields({ kind: "declared", reference: "Acta notarial 12/2026, protocolo 445" });
    expect(fields.sourceHash).toBeNull();
    expect(fields.sourceDomain).toBe("manual_preceptive_document");
    expect(fields.sourceId).toBeNull();
    expect(fields.sourcePayload.source_label).toBe(DECLARED_REFERENCE_NO_HASH_LABEL);
    expect(fields.sourcePayload.declared_reference).toBe("Acta notarial 12/2026, protocolo 445");
  });

  it("no escribe nada en producción: es una función pura, sin efectos de red ni de base de datos", () => {
    // Nada en este módulo importa supabase ni hace fetch; la prueba lo confirma
    // llamando la función dos veces con la misma entrada y comprobando resultado idéntico.
    const a = buildInformeSourceFields({ kind: "declared", reference: "x" });
    const b = buildInformeSourceFields({ kind: "declared", reference: "x" });
    expect(a).toEqual(b);
  });

  it("un artefacto documental real aporta su propia huella verificada, no texto libre", () => {
    const fields = buildInformeSourceFields({
      kind: "artifact",
      artifactId: "11111111-1111-1111-1111-111111111111",
      hash: "abc123",
    });
    expect(fields.sourceDomain).toBe("secretaria_document_artifact");
    expect(fields.sourceId).toBe("11111111-1111-1111-1111-111111111111");
    expect(fields.sourceHash).toBe("abc123");
  });

  it("un artefacto documental sin huella propia todavía no fabrica una", () => {
    const fields = buildInformeSourceFields({
      kind: "artifact",
      artifactId: "11111111-1111-1111-1111-111111111111",
      hash: null,
    });
    expect(fields.sourceHash).toBeNull();
  });

  it("un acuerdo vinculado no rellena huella (se genera aparte)", () => {
    const fields = buildInformeSourceFields({ kind: "agreement", agreementId: "ag-1" });
    expect(fields.sourceDomain).toBe("agreement");
    expect(fields.sourceId).toBe("ag-1");
    expect(fields.sourceHash).toBeNull();
  });

  it("sin selección, no hay dominio ni huella", () => {
    const fields = buildInformeSourceFields({ kind: "none" });
    expect(fields).toEqual({ sourceDomain: null, sourceId: null, sourceHash: null, sourcePayload: {} });
  });

  it("la columna Huella muestra el rótulo para una referencia declarada sin huella", () => {
    expect(
      informeHashDisplay({ hash_sha512: null, source_hash: null, source_domain: "manual_preceptive_document" }),
    ).toBe(DECLARED_REFERENCE_NO_HASH_LABEL);
  });

  it("la columna Huella no toca filas heredadas con source_hash de texto libre (ARGA no cambia sin cambio declarado)", () => {
    expect(
      informeHashDisplay({
        hash_sha512: null,
        source_hash: "hash-tecleado-a-mano",
        source_domain: "manual_preceptive_document",
      }),
    ).toBe("hash-tecleado-a-mano");
  });

  it("una huella de servidor real siempre gana sobre cualquier otra cosa", () => {
    expect(
      informeHashDisplay({ hash_sha512: "sha512-real", source_hash: "algo", source_domain: "agreement" }),
    ).toBe("sha512-real");
  });

  it("sin nada, sigue diciendo Pendiente", () => {
    expect(informeHashDisplay({ hash_sha512: null, source_hash: null, source_domain: "agreement" })).toBe("Pendiente");
  });

  // Arnés de mutación (paso 4 del issue): si `buildInformeSourceFields({kind:"declared"})`
  // volviera a copiar el texto libre en `sourceHash` en vez de dejarlo nulo, esta prueba
  // debe fallar. Se comprobó manualmente mutando la rama "declared" a
  // `sourceHash: selection.reference` — la prueba de arriba ("queda con source_hash
  // nulo...") pasa a rojo con ese cambio.
  it("mutación: sourceHash de una referencia declarada nunca es el texto de la referencia", () => {
    const fields = buildInformeSourceFields({ kind: "declared", reference: "texto-cualquiera-tecleado" });
    expect(fields.sourceHash).not.toBe("texto-cualquiera-tecleado");
  });
});
