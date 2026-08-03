import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/doc-gen/template-renderer";
import {
  DOCUMENT_DEMO_NOTICE,
  normalizeVisibleDocumentText,
} from "@/lib/doc-gen/document-output-normalizer";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720136000_secretaria_convocation_template_interposition.sql",
  ),
  "utf8",
);

const body = migration.match(/v_body text := \$template\$([\s\S]*?)\$template\$;/)?.[1] ?? "";

describe("CONVOCATORIA_CDA 1.1.0 — interposición sin firma electrónica", () => {
  it("versiona y archiva el predecesor sin reescribir la fila histórica", () => {
    expect(migration).toContain("c955d5b5-5548-4951-80d9-af1478b9e23d");
    expect(migration).toContain("v_old.version IS DISTINCT FROM '1.0.0'");
    expect(migration).toContain("SET estado = 'ARCHIVADA'");
    expect(migration).toContain("'1.1.0', 'ACTIVA'");
    expect(migration).toContain("exists with different immutable content");
    expect(migration).not.toMatch(/ON CONFLICT[\s\S]*DO UPDATE/i);
  });

  it("retira firma y sello del cuerpo y del catálogo de variables", () => {
    expect(body).not.toContain("firma_convocante_ref");
    expect(body).not.toContain("sello_tiempo_ref");
    expect(body).not.toContain("Firma del convocante");
    expect(body).toContain("interposición, mensajería o custodia electrónica por EAD Trust");
    expect(body).toContain("no constituye ni sustituye la actuación, el consentimiento o la firma jurídica del convocante");
    expect(body).toContain("SIMULACIÓN DEMO / SIN EFECTO JURÍDICO");
    expect(body).toContain("no afirma que dicha persona haya ordenado, consentido, emitido o firmado");
    expect(body).not.toContain("Por orden de {{nombre_convocante}}");
    expect(body).not.toContain("Emitida por {{nombre_convocante}}");
    expect(body).not.toContain("se convoca a los miembros");
    expect(migration).not.toContain("QTSP.firma_convocante_ref");
    expect(migration).not.toContain("QTSP.sello_tiempo_ref");
  });

  it("usa las referencias correctas de funcionamiento y convocatoria del Consejo", () => {
    expect(body).toContain("artículos 245.2 y 246");
    expect(body).not.toContain("artículo 245.3");
    expect(migration).toContain("el art. 245.3 regula su frecuencia mínima");
    expect(migration).not.toContain("CONSEJEROS_ART_246_2");
    expect(migration).toContain("authority_evidence.person_id");
    expect(migration).toContain("authority_evidence.cargo");
    expect(migration).toContain("la ruta excepcional del art. 246.2 queda fuera");
  });

  it("renderiza el caso ARGA sin variables sin resolver", () => {
    const rendered = renderTemplate({
      template: body,
      variables: {
        denominacion_social: "ARGA Seguros, S.A.",
        nombre_convocante: "Antonio Ríos",
        cargo_convocante: "PRESIDENTE",
        fecha_sesion: "2026-08-09",
        hora_sesion: "10:00",
        lugar_sesion: "Madrid",
        modalidad_sesion: "PRESENCIAL",
        orden_del_dia_resumen: "1. Informe del Director General.",
        canal_convocatoria: "mensajería EAD y correo electrónico",
        canal_documentacion: "expediente electrónico",
        indice_documentacion_ref: "11 documentos anexos",
        entidad_cotizada: true,
        lugar_emision: "Madrid",
        fecha_emision: "2026-07-20",
      },
    });

    const step7Text = `${DOCUMENT_DEMO_NOTICE}\n\n${normalizeVisibleDocumentText(rendered.text)}`;

    expect(rendered.ok).toBe(true);
    expect(rendered.unresolvedVariables).toEqual([]);
    expect(step7Text).toContain("ARGA Seguros, S.A.");
    expect(step7Text).not.toContain("{{");
    expect(step7Text.length).toBeGreaterThan(1100);
    expect(step7Text.startsWith(
      `${DOCUMENT_DEMO_NOTICE}\n\nSIMULACIÓN DEMO / SIN EFECTO JURÍDICO\n\n` +
      "BORRADOR OPERATIVO DE CONVOCATORIA DE SESIÓN DEL CONSEJO DE ADMINISTRACIÓN DE ARGA Seguros, S.A.\n\n" +
      "A efectos exclusivos de simulación DEMO, se registra un borrador operativo referido al cargo vigente de Presidente, ocupado según el censo autoritativo por Antonio Ríos. " +
      "Esta referencia acredita únicamente la titularidad del cargo y no afirma que dicha persona haya ordenado, consentido, emitido o firmado esta convocatoria.",
    )).toBe(true);
    expect(step7Text).toContain("9 de agosto de 2026");
    expect(step7Text).toContain("\n\nORDEN DEL DÍA\n\n1. Informe del Director General.");
    expect(step7Text).toContain("Esta simulación no produce remisión ni comunicación real.");
    expect(step7Text).toContain(
      "Esta simulación no produce puesta a disposición real ni acredita que los consejeros hayan recibido documentación.",
    );
    expect(step7Text.endsWith(
      "Documento demo/operativo sin efecto jurídico. No constituye una convocatoria emitida ni evidencia final productiva. " +
      "La eventual interposición, mensajería o custodia electrónica por EAD Trust se registra separadamente en el expediente y no constituye ni sustituye la actuación, el consentimiento o la firma jurídica del convocante.",
    )).toBe(true);
  });
});
