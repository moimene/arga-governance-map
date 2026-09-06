import { describe, expect, it } from "vitest";
import {
  canUseLegacyConvocatoriaFallback,
  extractMeetingSourceLinks,
  patchQuorumDataSourceLinks,
  sourceLinksFromAgendaPoints,
} from "../meeting-links";

describe("canUseLegacyConvocatoriaFallback", () => {
  it("rechaza una reunión vinculada a otra convocatoria aunque coincidan órgano y fecha", () => {
    expect(canUseLegacyConvocatoriaFallback({
      source_links: {
        convocatoria_id: "convocatoria-anterior",
        convocatoria_ids: ["convocatoria-anterior"],
      },
    }, "convocatoria-nueva")).toBe(false);
  });

  it("permite el fallback para reuniones legacy sin vínculo documental", () => {
    expect(canUseLegacyConvocatoriaFallback({}, "convocatoria-nueva")).toBe(true);
  });

  it("permite reutilizar la reunión ya vinculada a la propia convocatoria", () => {
    expect(canUseLegacyConvocatoriaFallback({
      source_links: { convocatoria_ids: ["convocatoria-nueva"] },
    }, "convocatoria-nueva")).toBe(true);
  });
});

describe("meeting source links", () => {
  it("extracts explicit links from quorum_data", () => {
    const links = extractMeetingSourceLinks({
      source_links: {
        convocatoria_id: "conv-1",
        convocatoria_ids: ["conv-1", "conv-2"],
        group_campaign_id: "campaign-1",
        agreement_ids: ["agreement-1"],
        source: "explicit",
      },
    });

    expect(links).toMatchObject({
      convocatoria_id: "conv-1",
      group_campaign_id: "campaign-1",
      agreement_ids: ["agreement-1"],
      source: "explicit",
    });
  });

  it("derives links from agenda point origins", () => {
    const links = sourceLinksFromAgendaPoints([
      {
        punto: "Aprobar cuentas",
        notas: "",
        materia: "APROBACION_CUENTAS",
        tipo: "ORDINARIA",
        origin: "CONVOCATORIA",
        source_table: "convocatorias",
        source_id: "conv-1",
        source_index: 1,
      },
      {
        punto: "Modificar estatutos",
        notas: "",
        materia: "MODIFICACION_ESTATUTOS",
        tipo: "ESTATUTARIA",
        origin: "PREPARED_AGREEMENT",
        source_table: "agreements",
        source_id: "agreement-1",
        source_index: 2,
        agreement_id: "agreement-1",
        group_campaign_id: "campaign-1",
      },
    ]);

    expect(links).toMatchObject({
      convocatoria_id: "conv-1",
      convocatoria_ids: ["conv-1"],
      group_campaign_id: "campaign-1",
      group_campaign_ids: ["campaign-1"],
      agreement_ids: ["agreement-1"],
      source: "derived",
    });
  });

  it("patches quorum_data without losing existing fields", () => {
    const patched = patchQuorumDataSourceLinks(
      { quorum: { reached: true }, source_links: { convocatoria_id: "conv-1" } },
      { convocatoria_id: "conv-2", agreement_ids: ["agreement-1"], source: "derived" }
    );

    expect(patched.quorum).toEqual({ reached: true });
    expect(patched.source_links).toMatchObject({
      convocatoria_id: "conv-2",
      convocatoria_ids: ["conv-1", "conv-2"],
      agreement_ids: ["agreement-1"],
    });
  });
  // El servidor declara inmutable el vínculo a una convocatoria EMITIDA: el
  // trigger `fn_secretaria_guard_meeting_open_transition` rechaza CUALQUIER
  // diferencia en `quorum_data->source_links`. Reescribirlo tiraba el UPDATE
  // entero y con él los `point_snapshots`, dejando el acta inalcanzable en el
  // camino que nace de convocatoria. Se comprueba la IDENTIDAD del objeto, no
  // solo su contenido: una copia con las mismas claves en otro orden ya es
  // `IS DISTINCT FROM` para el trigger.
  it("no toca un vínculo explícito a convocatoria: lo deja idéntico", () => {
    const sourceLinks = {
      source: "explicit",
      convocatoria_id: "conv-emitida",
      convocatoria_ids: ["conv-emitida"],
    };
    const quorumData = { quorum: { reached: true }, source_links: sourceLinks };

    const patched = patchQuorumDataSourceLinks(quorumData, {
      convocatoria_id: null,
      agreement_ids: ["agreement-nuevo"],
      source: "derived",
    });

    expect(patched.source_links).toBe(sourceLinks);
    expect(patched.quorum).toEqual({ reached: true });
  });

  it("y sí lo reescribe cuando el vínculo NO es explícito", () => {
    const patched = patchQuorumDataSourceLinks(
      { source_links: { source: "derived", convocatoria_id: "conv-1" } },
      { convocatoria_id: "conv-1", agreement_ids: ["agreement-1"], source: "derived" }
    );

    expect(patched.source_links).toMatchObject({ agreement_ids: ["agreement-1"] });
  });
});
