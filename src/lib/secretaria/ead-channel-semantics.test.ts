import { describe, expect, it } from "vitest";
import {
  EAD_INTERPOSITION_CHANNEL,
  channelForNewCapture,
  channelsForNewCapture,
  isLegacyErdsChannel,
  safeEadChannelLabel,
} from "./ead-channel-semantics";

describe("semantica segura del canal EAD", () => {
  it("normaliza ERDS y BUROFAX_ERDS legacy al valor canonico de nueva captura", () => {
    expect(channelForNewCapture("ERDS")).toBe(EAD_INTERPOSITION_CHANNEL);
    expect(channelForNewCapture("BUROFAX_ERDS")).toBe(EAD_INTERPOSITION_CHANNEL);
    expect(channelForNewCapture("SANDBOX_ERDS")).toBe(EAD_INTERPOSITION_CHANNEL);
    expect(channelForNewCapture("SANDBOX_EAD_INTERPOSITION")).toBe(EAD_INTERPOSITION_CHANNEL);
  });

  it("deduplica aliases historicos sin alterar otros canales", () => {
    expect(channelsForNewCapture(["ERDS", "BUROFAX_ERDS", "EMAIL_SIMPLE"]))
      .toEqual([EAD_INTERPOSITION_CHANNEL, "EMAIL_SIMPLE"]);
  });

  it("mantiene identificables los codigos historicos para lectura compatible", () => {
    expect(isLegacyErdsChannel("BUROFAX_ERDS")).toBe(true);
    expect(safeEadChannelLabel("ERDS")).toContain("solo lectura");
    expect(safeEadChannelLabel(EAD_INTERPOSITION_CHANNEL)).toContain("sin firma ni ERDS");
  });
});
