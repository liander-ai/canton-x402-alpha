import { describe, it, expect } from "vitest";
import { AlphaServer, payAndFetch, encodePayment, type PaymentRequirements } from "../src/x402.js";
import { InMemorySettlement } from "../src/settlement.js";
import { generateAgentKeys, signSignal, verifySignal, type SignedSignal } from "../src/signal.js";

function makeServer() {
  const settlement = new InMemorySettlement();
  const server = new AlphaServer(settlement, "canton-devnet");
  const keys = generateAgentKeys();
  server.list({
    signalId: "sig-001",
    price: "25.0",
    asset: "Bank",
    payTo: "Agent",
    reveal: (): SignedSignal =>
      signSignal(
        { agent: "Agent", signalId: "sig-001", assetSymbol: "BTC", direction: "LONG", issuedAt: 1_700_000_000 },
        keys,
      ),
  });
  return { server, settlement };
}

describe("x402 paid alpha endpoint", () => {
  it("returns 402 with Canton payment requirements when unpaid", async () => {
    const { server } = makeServer();
    const res = await server.handle("sig-001");
    expect(res.status).toBe(402);
    const req = (res.body as { accepts: PaymentRequirements[] }).accepts[0];
    expect(req.scheme).toBe("canton");
    expect(req.amount).toBe("25.0");
    expect(req.payTo).toBe("Agent");
    expect(req.signalId).toBe("sig-001");
  });

  it("returns 403 for an unknown signal", async () => {
    const { server } = makeServer();
    const res = await server.handle("does-not-exist");
    expect(res.status).toBe(403);
  });

  it("rejects an unsettled payment", async () => {
    const { server } = makeServer();
    const bogus = encodePayment({ signalId: "sig-001", payer: "Buyer", settlementRef: "never-happened" });
    const res = await server.handle("sig-001", bogus);
    expect(res.status).toBe(402);
  });

  it("delivers a verifiable signal after Canton settlement", async () => {
    const { server, settlement } = makeServer();

    const res = await payAndFetch(server, "sig-001", async (req: PaymentRequirements) => {
      // stand-in for the buyer paying on Canton: a SignalPurchase_Fill produces
      // a contract id we treat as the settlement reference.
      const settlementRef = "canton-cid-abc123";
      settlement.record(settlementRef, "Buyer", req.signalId);
      return { signalId: req.signalId, payer: "Buyer", settlementRef };
    });

    expect(res.status).toBe(200);
    const signal = res.body as SignedSignal;
    expect(verifySignal(signal)).toBe(true);
    expect(signal.payload.direction).toBe("LONG");
  });
});
