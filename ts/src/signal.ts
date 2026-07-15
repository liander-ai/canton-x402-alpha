// Ed25519 signing of alpha signals — the payload a buyer unlocks after paying.
// Uses Node's built-in crypto (no runtime dependencies).
import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  createPublicKey,
  type KeyObject,
} from "node:crypto";

export interface SignalPayload {
  agent: string; // agent identifier (Canton party)
  signalId: string;
  assetSymbol: string;
  direction: "LONG" | "SHORT";
  issuedAt: number; // unix seconds
}

export interface SignedSignal {
  payload: SignalPayload;
  signature: string; // base64
  publicKey: string; // base64 (SPKI DER)
}

export interface AgentKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export function generateAgentKeys(): AgentKeys {
  return generateKeyPairSync("ed25519");
}

// Deterministic serialization so signing and verification agree byte-for-byte.
function canonical(p: SignalPayload): Buffer {
  return Buffer.from(
    JSON.stringify([p.agent, p.signalId, p.assetSymbol, p.direction, p.issuedAt]),
    "utf8",
  );
}

export function signSignal(payload: SignalPayload, keys: AgentKeys): SignedSignal {
  const signature = cryptoSign(null, canonical(payload), keys.privateKey);
  const publicKey = keys.publicKey.export({ type: "spki", format: "der" }) as Buffer;
  return {
    payload,
    signature: signature.toString("base64"),
    publicKey: publicKey.toString("base64"),
  };
}

export function verifySignal(signed: SignedSignal): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(signed.publicKey, "base64"),
      type: "spki",
      format: "der",
    });
    return cryptoVerify(
      null,
      canonical(signed.payload),
      publicKey,
      Buffer.from(signed.signature, "base64"),
    );
  } catch {
    return false;
  }
}
