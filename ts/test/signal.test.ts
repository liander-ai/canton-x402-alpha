import { describe, it, expect } from "vitest";
import { generateAgentKeys, signSignal, verifySignal, type SignalPayload } from "../src/signal.js";

const payload: SignalPayload = {
  agent: "Agent",
  signalId: "sig-001",
  assetSymbol: "BTC",
  direction: "LONG",
  issuedAt: 1_700_000_000,
};

describe("signed alpha signals", () => {
  it("verifies a genuine signature", () => {
    const signed = signSignal(payload, generateAgentKeys());
    expect(verifySignal(signed)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const signed = signSignal(payload, generateAgentKeys());
    const tampered = { ...signed, payload: { ...signed.payload, direction: "SHORT" as const } };
    expect(verifySignal(tampered)).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const signed = signSignal(payload, generateAgentKeys());
    const impostor = signSignal(payload, generateAgentKeys());
    expect(verifySignal({ ...signed, signature: impostor.signature })).toBe(false);
  });
});
