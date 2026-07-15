// Canton settlement verification for x402.
//
// The x402 `X-PAYMENT` header carries a proof that the buyer settled on Canton.
// A production verifier queries the Canton JSON Ledger API for the AlphaSignal
// (or filled SignalPurchase) contract referenced by `settlementRef`, and checks
// it is owned by `payer` for `signalId`. The in-memory verifier below models
// that check so the whole flow is testable without a running participant node.

export interface PaymentProof {
  signalId: string;
  payer: string; // buyer's Canton party
  settlementRef: string; // Canton contract id of the settled purchase
}

export interface SettlementVerifier {
  verify(proof: PaymentProof): Promise<boolean>;
}

interface Settlement {
  payer: string;
  signalId: string;
}

// Test/local implementation. Swap for a JSON-Ledger-API-backed verifier in prod.
export class InMemorySettlement implements SettlementVerifier {
  private settled = new Map<string, Settlement>();

  // Called when Canton confirms a SignalPurchase_Fill (the atomic pay+deliver).
  record(settlementRef: string, payer: string, signalId: string): void {
    this.settled.set(settlementRef, { payer, signalId });
  }

  async verify(proof: PaymentProof): Promise<boolean> {
    const s = this.settled.get(proof.settlementRef);
    return !!s && s.payer === proof.payer && s.signalId === proof.signalId;
  }
}
