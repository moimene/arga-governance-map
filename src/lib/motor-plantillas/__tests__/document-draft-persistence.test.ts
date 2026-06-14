import { describe, expect, it } from "vitest";
import { buildSecretariaDocumentGenerationRequest } from "@/lib/secretaria/document-generation-boundary";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "@/lib/secretaria/legal-template-fixtures";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { prepareDocumentComposition } from "../composer";
import {
  buildEditableDocumentDraftPayload,
  computeEditableDocumentDraftKey,
  staticDocumentDraftSchemaGate,
  toUuidColumn,
} from "../document-draft-persistence";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ENTITY_ID = "00000000-0000-0000-0000-000000000010";

function fixture(id: string): PlantillaProtegidaRow {
  const template = LEGAL_TEAM_TEMPLATE_FIXTURES.find((item) => item.id === id);
  if (!template) throw new Error(`Fixture no encontrada: ${id}`);
  return template;
}

async function preparedConvocatoria(capa3: Record<string, string> = {}) {
  const template = fixture("legal-fixture-convocatoria-consejo-es");
  const request = await buildSecretariaDocumentGenerationRequest({
    documentType: "CONVOCATORIA",
    tenantId: TENANT_ID,
    entityId: ENTITY_ID,
    convocatoriaId: "conv-1",
    templateId: template.id,
    requestId: "request-demo-1",
    requestedAt: "2026-05-03T10:00:00.000Z",
  });

  return prepareDocumentComposition(
    request,
    {
      lugar: "Madrid",
      fecha_primera_convocatoria: "2026-06-01",
      hora_primera_convocatoria: "10:00",
      orden_dia_texto: "Aprobacion de cuentas\nDelegacion de facultades",
      firma_organo_administracion: "El Presidente",
      ...capa3,
    },
    {
      plantilla: template,
      resolveCapa2: false,
      archiveDraft: false,
      generatedAt: "2026-05-03",
      baseVariables: {
        denominacion_social: "ARGA Seguros, S.A.",
        cif: "A00000000",
        domicilio_social: "Madrid",
        registro_mercantil: "Madrid",
        organo_nombre: "Consejo de Administracion",
        fecha: "2026-06-01",
        presidente: "Antonio Rios",
        secretario: "Lucia Paredes",
      },
    },
  );
}

describe("document-draft-persistence", () => {
  it("construye payload Cloud sin mezclar request_id y draft_key estable", async () => {
    const prepared = await preparedConvocatoria();
    const payload = await buildEditableDocumentDraftPayload({
      prepared,
      renderedBodyText: `${prepared.renderedBodyText}\n\nNota revisada por usuario.`,
      draftState: "EDITABLE_DRAFT",
    });

    expect(payload.tenant_id).toBe(TENANT_ID);
    expect(payload.document_request_id).toBe("request-demo-1");
    expect(payload.request_hash_sha256).toBe(prepared.request.request_hash_sha256);
    expect(payload.draft_key_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.rendered_body_text).toContain("Nota revisada por usuario.");
    expect(payload.system_trace_text).toContain("TRAZABILIDAD DOCUMENTAL");
    expect(payload.post_render_validation).toMatchObject({ ok: true });
    expect(payload.content_hash_sha256).toBeNull();
  });

  it("nunca escribe un id no-uuid en columnas uuid: fixture local -> template_id null + trazabilidad en metadata", async () => {
    const prepared = await preparedConvocatoria();
    // sanity: la plantilla es un fixture legal local cuyo id NO es un uuid
    expect(prepared.template.id).toBe("legal-fixture-convocatoria-consejo-es");

    const payload = await buildEditableDocumentDraftPayload({
      prepared,
      renderedBodyText: prepared.renderedBodyText,
      draftState: "EDITABLE_DRAFT",
    });

    // La columna template_id es uuid REFERENCES plantillas_protegidas: un fixture
    // local no puede ir ahí (rompía con "invalid input syntax for type uuid").
    expect(payload.template_id).toBeNull();
    // Pero la traza del fixture no se pierde.
    expect((payload.metadata as Record<string, unknown>).template_ref).toBe(
      "legal-fixture-convocatoria-consejo-es",
    );
  });

  it("toUuidColumn: conserva uuids aceptados por Postgres (incl. seed no-RFC) y descarta lo demas", () => {
    expect(toUuidColumn("legal-fixture-acta-consejo-es")).toBeNull();
    expect(toUuidColumn("meeting:abc:point:3")).toBeNull();
    expect(toUuidColumn(null)).toBeNull();
    expect(toUuidColumn("")).toBeNull();
    // seed demo no-RFC (version '0') que Postgres SI acepta -> debe conservarse
    expect(toUuidColumn("00000000-0000-0000-0000-000000000020")).toBe(
      "00000000-0000-0000-0000-000000000020",
    );
    // uuid v4 real -> se conserva
    expect(toUuidColumn("6d7ed736-f263-4531-a59d-c6ca0cd41602")).toBe(
      "6d7ed736-f263-4531-a59d-c6ca0cd41602",
    );
  });

  it("cambia draft_key cuando cambian valores Capa 3", async () => {
    const a = await preparedConvocatoria({ orden_dia_texto: "Aprobacion de cuentas" });
    const b = await preparedConvocatoria({ orden_dia_texto: "Delegacion de facultades" });

    await expect(computeEditableDocumentDraftKey(a)).resolves.not.toBe(
      await computeEditableDocumentDraftKey(b),
    );
  });

  it("declara schema Cloud exacto cuando no esta disponible", () => {
    const gate = staticDocumentDraftSchemaGate();

    expect(gate.supported).toBe(false);
    expect(gate.table).toBe("secretaria_document_drafts");
    expect(gate.missing).toContain("secretaria_document_drafts.draft_key_sha256");
    expect(gate.missing).toContain("secretaria_document_drafts.rendered_body_text");
  });
});
