import { describe, expect, it } from "vitest";
import {
  extractMeetingSourceLinks,
  patchQuorumDataSourceLinks,
  sourceLinksFromAgendaPoints,
} from "../meeting-links";

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
});
