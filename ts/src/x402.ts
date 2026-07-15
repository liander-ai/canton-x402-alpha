// x402 protocol layer: a paid alpha endpoint that gates a signed signal behind
// an on-Canton payment. Follows the x402 shape: an unpaid request gets HTTP 402
// with payment requirements; the client settles on Canton and retries with an
// `X-PAYMENT` header; the server verifies settlement and returns the resource.
import type { SettlementVerifier, PaymentProof } from "./settlement.js";
import type { SignedSignal } from "./signal.js";

export interface PaymentRequirements {
  scheme: "canton";
  network: string;
  asset: string; // cash issuer / token identifier
  amount: string; // decimal string
  payTo: string; // agent Canton party
  resource: string;
  signalId: string;
}

export interface X402Response {
  status: 200 | 402 | 403;
  body: unknown;
}

export interface AlphaListing {
  signalId: string;
  price: string;
  asset: string;
  payTo: string;
  reveal: () => SignedSignal; // the signal, disclosed only after payment
}

export function encodePayment(proof: PaymentProof): string {
  return Buffer.from(JSON.stringify(proof), "utf8").toString("base64");
}

export function decodePayment(header: string): PaymentProof {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8")) as PaymentProof;
}

export class AlphaServer {
  private listings = new Map<string, AlphaListing>();

  constructor(
    private readonly settlement: SettlementVerifier,
    private readonly network = "canton-devnet",
  ) {}

  list(listing: AlphaListing): void {
    this.listings.set(listing.signalId, listing);
  }

  async handle(signalId: string, xPayment?: string): Promise<X402Response> {
    const listing = this.listings.get(signalId);
    if (!listing) return { status: 403, body: { error: "unknown signal" } };

    if (!xPayment) {
      const requirements: PaymentRequirements = {
        scheme: "canton",
        network: this.network,
        asset: listing.asset,
        amount: listing.price,
        payTo: listing.payTo,
        resource: `/alpha/${signalId}`,
        signalId,
      };
      return { status: 402, body: { x402Version: 1, accepts: [requirements] } };
    }

    let proof: PaymentProof;
    try {
      proof = decodePayment(xPayment);
    } catch {
      return { status: 402, body: { error: "malformed X-PAYMENT header" } };
    }

    if (proof.signalId !== signalId) {
      return { status: 402, body: { error: "payment is for a different signal" } };
    }

    const settled = await this.settlement.verify(proof);
    if (!settled) {
      return { status: 402, body: { error: "payment not settled on Canton" } };
    }

    return { status: 200, body: listing.reveal() };
  }
}

// Client helper: perform the full 402 -> settle -> retry round-trip. `settle`
// is where the caller pays on Canton and returns a proof of settlement.
export async function payAndFetch(
  server: AlphaServer,
  signalId: string,
  settle: (req: PaymentRequirements) => Promise<PaymentProof>,
): Promise<X402Response> {
  const challenge = await server.handle(signalId);
  if (challenge.status !== 402) return challenge;

  const accepts = (challenge.body as { accepts?: PaymentRequirements[] }).accepts;
  if (!accepts || accepts.length === 0) return challenge;

  const proof = await settle(accepts[0]);
  return server.handle(signalId, encodePayment(proof));
}
