import { describe, expect, it } from "vitest";
import { computeCapitalVotingWeights } from "../capital-voting";

describe("computeCapitalVotingWeights", () => {
  it("acciones sin voto computan en capital social pero no en quórum ni votos", () => {
    const result = computeCapitalVotingWeights([
      { holder_id: "socio-a", numero_titulos: 80, voting_rights: true },
      { holder_id: "socio-b", numero_titulos: 20, voting_rights: false },
    ]);

    expect(result.socialCapitalTitles).toBe(100);
    expect(result.quorumDenominator).toBe(80);
    expect(result.votingWeight).toBe(80);
    expect(result.byHolder.find((row) => row.holder_id === "socio-b")?.excluded_from_vote).toBe(true);
  });

  it("acciones de voto doble duplican el peso de voto cuando los estatutos lo prevén", () => {
    const result = computeCapitalVotingWeights([
      { holder_id: "socio-a", numero_titulos: 40, votes_per_title: 2 },
      { holder_id: "socio-b", numero_titulos: 60 },
    ]);

    expect(result.socialCapitalTitles).toBe(100);
    expect(result.quorumDenominator).toBe(100);
    expect(result.votingWeight).toBe(140);
    expect(result.byHolder.find((row) => row.holder_id === "socio-a")?.voting_weight).toBe(80);
  });

  it("participaciones privilegiadas reflejan derechos de voto múltiples por titular", () => {
    const result = computeCapitalVotingWeights([
      { holder_id: "privilegiado", numero_titulos: 10, votes_per_title: 5 },
      { holder_id: "ordinario", numero_titulos: 90, votes_per_title: 1 },
    ]);

    expect(result.socialCapitalTitles).toBe(100);
    expect(result.votingWeight).toBe(140);
    expect(result.byHolder.find((row) => row.holder_id === "privilegiado")?.voting_weight).toBe(50);
  });

  it("autocartera se descuenta del denominador de quórum y recuento de votos", () => {
    const result = computeCapitalVotingWeights([
      { holder_id: "socio-a", numero_titulos: 70 },
      { holder_id: "autocartera", numero_titulos: 30, is_treasury: true },
    ]);

    expect(result.socialCapitalTitles).toBe(100);
    expect(result.quorumDenominator).toBe(70);
    expect(result.votingWeight).toBe(70);
    expect(result.byHolder.find((row) => row.holder_id === "autocartera")?.treasury).toBe(true);
  });

  it("voting_rights=false e is_treasury=true se tratan como no computables", () => {
    const result = computeCapitalVotingWeights([
      { holder_id: "socio-a", numero_titulos: 50 },
      { holder_id: "sin-voto", numero_titulos: 25, voting_rights: false },
      { holder_id: "autocartera", numero_titulos: 25, is_treasury: true },
    ]);

    expect(result.socialCapitalTitles).toBe(100);
    expect(result.quorumDenominator).toBe(50);
    expect(result.votingWeight).toBe(50);
  });
});
