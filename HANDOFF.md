# VeriPanen — Session Handoff / Transcript

**Project:** VeriPanen — AI-graded agricultural escrow on BNB Smart Chain Testnet
**Hackathon:** Indonesia Web3 Hackathon 2026, Track 1 (AI Agents)
**Repo:** https://github.com/gfhinrel-arch/veripanen
**Branch:** master
**Date:** 2026-09-22

---

## 1. What VeriPanen Does

Two-stage AI verification of agricultural trade, with funds held in on-chain escrow.

1. **Farmer** creates a listing (crop, weight, price, harvest photo).
2. **AI Stage 1** grades harvest quality from the photo. Result posted on-chain by oracle.
3. **Buyer** funds the escrow.
4. **Farmer** ships. Buyer uploads a delivery photo.
5. **AI Stage 2** verifies the delivered goods match the listing.
6. Payment released to farmer, or dispute opened on mismatch.

Both AI stages enforce a confidence threshold. Below `MIN_CONFIDENCE` the listing goes to `MANUAL_REVIEW` and **nothing is posted on-chain**.

---

## 2. Architecture

| Layer | Tech | Path |
|---|---|---|
| Smart contract | Solidity 0.8.28, Foundry | `contract/src/HarvestEscrow.sol` |
| AI agent | Node.js ESM, viem, HTTP API :8787 | `agent/` |
| Frontend | React 19, Vite, wagmi v2, RainbowKit | `frontend/` |
| AI provider | 9router gateway (`thirty/` models) | `agent/src/ai/glm.js` |

```
Farmer Browser ──> Frontend (Vite :5173)
                      │  upload photo
                      ▼
                   Agent HTTP API (:8787) ──> 9router AI gateway
                      │  grade / verify
                      ▼
                   Oracle wallet ──> HarvestEscrow contract
                      ▲
Buyer Browser ────────┘  fund / verify / confirm
```

---

## 3. Verified Working

| Check | Result |
|---|---|
| `forge test` | **33 passed / 0 failed** |
| Agent `npm test` (node --test) | **26 passed / 0 failed** |
| Frontend `npm test` | **16 passed / 0 failed** |
| `forge build` | clean |
| Frontend `npm run build` | PASS |
| Frontend `npm run lint` | 0 errors (pre-existing warnings: unused `motion` imports) |
| E2E demo (Anvil) | happy path, mismatch→Disputed, timeout claim, unauthorized oracle revert |
| AI Stage 1 live | grade `A`, confidence `88%`, posted on-chain |
| AI Stage 2 live | `matched: true`, confidence `98%`, listing `Completed` |
| **opBNB Testnet deploy** | **LIVE** at `0xE07e56Af882368bc604F047Ed092A0C139c72809` (chain 5611) |

Evidence: `agent/evidence/anvil-demo.json`. Script: `agent/scripts/demo.js`.

---

## 4. Maintenance Work — 6 Tasks (all committed on master)

| Task | Status | Commit |
|---|---|---|
| 1. MIN_CONFIDENCE = 70 + validation + regression tests | PASS | `0b79c02` |
| 2. Align AI provider/model docs | PASS | `9886852` |
| 3. Browser wallet preflight + nonce errors | PASS | `cadd6fa` |
| 4. Testnet deployment readiness | **BLOCKED** (config PASS, deploy blocked) | `e704838` |
| 5. Environment & secret hygiene | PASS | `e463564` |
| 6. SUBMISSION.md | PASS | `e11fbbe` |

### Task 1 — MIN_CONFIDENCE
- `agent/src/config.js`: `resolveMinConfidence()` — default 70, validates finite/0–100, safe fallback to 70, warns to stderr when below 70 or invalid.
- `agent/src/confidence.test.js`: confidence 69 → `MANUAL_REVIEW` with **zero blockchain writes** (proven: fetch mock shows exactly one AI call, no RPC), confidence 70 accepted, invalid env falls back.
- `agent/package.json`: test script now `node --test src/*.test.js`.

### Task 2 — AI provider/model docs
- README + `.env.example`: `GLM_*` named as historical, pointing at 9router gateway, models prefixed `thirty/`. Added explanation that the contract does not call AI directly.
- Remaining "GLM" occurrences are the actual env var names and the provider's model name `glm-5v-turbo` — intentionally not renamed.

### Task 3 — Wallet preflight
- `frontend/src/lib/txGuard.js`: `runPreflight`, `assertExpectedChain`, `assertAccountReady`, `isNonceError`, `describeTxError`.
- `frontend/src/lib/useWalletGuard.js`: hook reading live account/chain via `@wagmi/core` `getAccount`/`getChainId`.
- All **7 write paths** guarded: CreateListingPanel, OpenListingsPanel, MyListingsPanel (×2), MyPurchasesPanel, ListingDetail Actions (×3).
- `txGuard.test.js`: 11 tests.
- README: Troubleshooting section (Anvil nonce reset, "Invalid parameters").

### Task 4 — Testnet deployment: DONE (opBNB 5611)
- **Deployed:** `HarvestEscrow` at `0xE07e56Af882368bc604F047Ed092A0C139c72809` on **opBNB Testnet (chain 5611)**.
- Deploy tx `0xc4685e3569d46ef7041eca662c5c7018ae3b63cfb2357fce3ec26bd778ea9e64`; owner = oracle = `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`.
- Explorer: https://opbnb-testnet.bscscan.com/address/0xE07e56Af882368bc604F047Ed092A0C139c72809
- The oracle account held a small tBNB balance on opBNB; gas is 0.001 gwei so the deploy was affordable.
- Chain id is now taken from `CHAIN_ID` env in `agent/src/blockchain/escrow.js` and `frontend/src/config/chain.js`, so 5611 / 97 / 31337 all resolve correctly.

### Fixes found during live browser E2E (all committed)
- Photos were stored as multi-MB data URLs, which MetaMask rejected (`Invalid parameters`). Now stored as local files with a short `file://` URI; agent serves them via `GET /api/photo`.
- HTTP responses containing viem receipts failed with "Do not know how to serialize a BigInt". `send()` now serializes BigInt.
- Reasoning records (JSON) were saved with an image extension and served as `image/*`. Now `.json` + `application/json`.
- `toDataUrl` returned the stored URI instead of an inline data URL, so the vision model saw "no image". Now builds the data URL from bytes.
- Legacy placeholder record URIs (`ipfs://grade-1`) opened broken pages; the UI now hides unresolvable links.

### Task 5 — Environment hygiene
- `.gitignore` verified: `.env`, `.env.*`, `!.env.example`.
- No `.env` ever committed; only `*.env.example` tracked.
- `agent/scripts/demo.js`: hardcoded Anvil keys → env overrides with public fallback + "never point at real network" note; chainId 31337 guard present.
- README: WalletConnect setup, Pinata requirement, oracle key boundary diagram, credential rotation list.
- **Finding:** default Anvil keys (public, worthless, local-only) exist in `demo.js` history. Reported and documented.
- Audit: frontend contains no `ORACLE_PRIVATE_KEY` / oracle key.

### Task 6 — SUBMISSION.md
- Built from actual repo data. Problem/solution from README. Architecture, AI role, oracle role, escrow flow, two-stage verification, on-chain state, frontend, limitations, security assumptions, Mermaid diagram.
- Missing info marked `TODO — information not yet provided` (team name, demo video, contract address, team roster). No links invented.

---

## 5. Environment

| Item | Value |
|---|---|
| Anvil | `http://127.0.0.1:8545`, chain 31337 |
| Contract (local) | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| **Contract (opBNB testnet)** | **`0xE07e56Af882368bc604F047Ed092A0C139c72809`, chain 5611** |
| Oracle (on-chain) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Agent API | `http://localhost:8787` — `/api/health`, `/api/upload`, `/api/grade`, `/api/verify-delivery`, `/api/photo` |
| Frontend | `http://localhost:5173` |
| Anvil account #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (10,000 ETH) |
| Anvil account #0 key | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |

Switch the agent/frontend between Anvil and opBNB by editing `BNB_TESTNET_RPC_URL` + `CHAIN_ID` + `CONTRACT_ADDRESS` (agent `.env`) and `VITE_BNB_TESTNET_RPC_URL` + `VITE_CHAIN_ID` + `VITE_CONTRACT_ADDRESS` (frontend `.env`).

`MIN_CONFIDENCE=70` (agent `.env`, `.env.example`, and code default all agree).

---

## 6. Open Issues

### 6.1 Testnet deployment — RESOLVED
Deployed on opBNB Testnet (5611). To redeploy (e.g. to chain 97):
```
cd contract
PRIVATE_KEY=<funded key> ORACLE_ADDRESS=<oracle> \
  forge script script/Deploy.s.sol --rpc-url opbnb_testnet --broadcast
```
Then update `VITE_CONTRACT_ADDRESS` (frontend) and `CONTRACT_ADDRESS` (agent).

### 6.2 MetaMask disconnect does not clear the site connection
RainbowKit's `ConnectButton` disconnect does not always revoke an injected MetaMask session. Wallet-side behavior, not an app bug. A dedicated `DisconnectButton` (`useDisconnect`) was added to the header. Wallet-side workaround: MetaMask → Connected sites → remove the dApp.

### 6.3 Anvil chain reset invalidates old state
Restarting Anvil wipes local chain state. Preflight now blocks on wrong chain and maps nonce errors; the README documents the MetaMask reset path.

---

## 7. Security Notes

- Session scan found **no secrets tracked**: only `.env.example` files are in git.
- Oracle key is server-side only; frontend audit confirms it is absent from the bundle.
- Contract logic byte-identical since the initial commit (`git diff 695f093 HEAD -- contract/src/HarvestEscrow.sol` = empty). `onlyOracle` intact on `postGrade` and `postDeliveryVerification`.
- **Rotate before submission if exposed:** deployer private key, oracle private key, `PINATA_JWT`, `GLM_API_KEY`.
- Spec §14: testnet only, never mainnet. No mainnet RPC configured anywhere.

---

## 8. How to Run

```bash
# 1. Local chain
anvil

# 2. Deploy contract
cd contract
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# 3. Agent
cd ../agent
npm install
npm start            # :8787
npm test             # 26 tests

# 4. Frontend
cd ../frontend
npm install
npm run dev          # :5173
npm test             # 16 tests

# 5. End-to-end demo with evidence
cd ../agent
node scripts/demo.js
```

MetaMask setup for local demo:
- Network: Anvil Local — RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `tBNB`
- Import account `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Select the account holding 10,000 ETH

---

## 9. Honest Status Summary

| Area | Status |
|---|---|
| Smart contract | Done, 33/33 tests pass, logic unchanged |
| AI agent (both stages) | Done, live-verified on Anvil, 26/26 tests pass |
| Frontend | Done, 16/16 tests, build clean |
| End-to-end (Anvil) | Done, verified live in the browser |
| **End-to-end (opBNB 5611)** | **Deployed; fund/ship/verify flow runs** |
| Confidence threshold | **Current active: `MIN_CONFIDENCE=70`** (code default + `.env.example`). A local `agent/.env` may hold `20` for demo testing; that is a temporary local override, not the project default. |
| Wallet preflight | All 7 write paths guarded |
| opBNB testnet deploy | **DONE** — `0xE07e56Af882368bc604F047Ed092A0C139c72809` |
| **Overall** | **Demo-ready** — contract deployed, both AI stages live, full browser flow verified |
