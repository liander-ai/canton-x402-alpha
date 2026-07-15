# canton-x402-alpha

**x402 paid alpha endpoints, settled on the [Canton Network](https://www.canton.network/).**
An AI trading agent sells Ed25519-signed trading signals through HTTP **402 Payment
Required** endpoints; each purchase settles **atomically on Canton** (pay-and-deliver
in one transaction), and every sale is an on-ledger record the buyer co-observes —
so the agent's track record is **verifiable alpha** that can't be quietly edited.

This is the multi-chain sibling of my Algorand build (`x402-payloop`): the same
[x402](https://www.x402.org/) protocol and "verifiable alpha" idea, now with a
**Canton/Daml settlement rail**. x402 landed on Canton as a Foundation-funded
integration — this shows an agentic paid-endpoint product built on it.

## Two layers

### 1. Canton settlement (`daml/Alpha.daml`)
- **`Iou`** — cash token (issuer-signed), transferred via propose-accept.
- **`SignalPurchase`** — the buyer pre-funds a cash transfer to the agent and requests a signal. The agent's **`SignalPurchase_Fill`** verifies the payment (right recipient, full price, agreed cash issuer) and then, in **one atomic transaction**, takes the cash *and* issues the signal. No pay-without-delivery; no signal-without-payment.
- **`AlphaSignal`** — the delivered signal, signed by the agent and observed by the buyer: an immutable on-ledger record.
- **`AlphaSignal_Resolve` → `ResolvedSignal`** — the agent records WIN/LOSS. Because the buyer already co-observes every purchase, the agent can't hide that a call was made — the track record is honest by construction.

Tests (`daml/Test.daml`, Daml.Script, in-memory ledger — **no node/Docker**):
`testPaidSignalDelivery`, `testUnderpaymentFails` (`submitMustFail`), `testTrackRecord`.

### 2. x402 HTTP layer (`ts/`)
Framework-agnostic, zero runtime dependencies (Node `crypto`):
- **`x402.ts`** — `AlphaServer.handle()` returns **402** with Canton `PaymentRequirements` when unpaid; on retry with an `X-PAYMENT` header it verifies settlement and returns **200** with the signed signal. `payAndFetch()` runs the full 402 → settle → retry round-trip.
- **`settlement.ts`** — `SettlementVerifier` interface. `InMemorySettlement` models the check for tests; a production verifier queries the **Canton JSON Ledger API** for the filled purchase contract owned by the payer.
- **`signal.ts`** — Ed25519 sign/verify of the signal payload, so the buyer can prove the signal came from the agent.

Tests (`ts/test`, Vitest): unpaid → 402 with requirements; unknown signal → 403; unsettled payment → 402; settled → 200 with a signature that verifies.

## The trust story

The payment **rail** (Canton) guarantees atomic pay-for-signal and an immutable,
buyer-visible purchase history. The signal **authenticity** (Ed25519) proves origin.
Together: a paid signals product where the seller's alpha track record is
*verifiable*, not self-reported.

## Run it

```bash
# Canton / Daml layer
curl -sSL https://get.daml.com/ | sh   # installs latest; tested on 2.10.4
export PATH="$HOME/.daml/bin:$PATH"
daml test

# x402 / TypeScript layer
cd ts && npm install && npm run typecheck && npm test
```

CI (`.github/workflows/ci.yml`) runs both layers on every push.

## License

MIT — see [LICENSE](LICENSE).
