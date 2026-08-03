import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hook = readFileSync(
  join(process.cwd(), "src/hooks/useAcuerdosSinSesion.ts"),
  "utf8",
);

describe("no-session WORM vote client contract", () => {
  it("does not expose or submit retired QES/ERDS reference fields", () => {
    const voteInput = hook.match(
      /export interface CastNoSessionVoteInput \{[\s\S]*?\n\}/,
    )?.[0] ?? "";
    const voteRpcCall = hook.match(
      /supabase\.rpc\("fn_no_session_cast_response", \{[\s\S]*?\n\s*\}\);/,
    )?.[0] ?? "";

    expect(voteInput).toContain("choice: VoteChoice");
    expect(voteInput).not.toContain("firmaQesRef");
    expect(voteInput).not.toContain("notificacionCertificadaRef");
    expect(voteRpcCall).toContain("p_person_id: targetPersonId");
    expect(voteRpcCall).not.toContain("p_firma_qes_ref");
    expect(voteRpcCall).not.toContain("p_notificacion_certificada_ref");
  });
});
