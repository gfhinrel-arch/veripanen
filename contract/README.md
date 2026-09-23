# HarvestEscrow

Solidity contract for VeriPanen. One contract, one escrow lifecycle.

## Dependencies

`lib/` is not committed. Restore it before building:

```bash
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
```

Remappings live in `foundry.toml`.

## Commands

```bash
forge build
forge test
forge test -vv            # with traces
forge test --match-test test_Timeout   # single test
```

## Deploy

Required environment variables:

| Variable | Meaning |
| --- | --- |
| `PRIVATE_KEY` | Deployer wallet (becomes the contract owner) |
| `ORACLE_ADDRESS` | Trusted AI agent oracle wallet |
| `OPBNB_TESTNET_RPC_URL` | opBNB Testnet RPC (used by the `opbnb_testnet` alias) |
| `BNB_TESTNET_RPC_URL` | BNB Smart Chain Testnet RPC (used by the `bnb_testnet` alias) |
| `BSCSCAN_API_KEY` | Explorer API key, for `--verify` only |

**Testnet only.** Chain ID 97 (BNB Smart Chain Testnet) or 5611 (opBNB Testnet). Verify the chain ID
before broadcasting; never deploy to mainnet.

```bash
# opBNB Testnet (chain 5611) — the chain the project is deployed on
forge script script/Deploy.s.sol \
  --rpc-url opbnb_testnet \
  --broadcast \
  --verify \
  --etherscan-api-key "$BSCSCAN_API_KEY"

# BNB Smart Chain Testnet (chain 97) — alternative target
forge script script/Deploy.s.sol \
  --rpc-url bnb_testnet \
  --broadcast \
  --verify \
  --etherscan-api-key "$BSCSCAN_API_KEY"
```

Each `--rpc-url` alias in `foundry.toml` reads its URL from the environment. Verification is a
separate concern: a `--verify` flag does not by itself prove the contract is verified — open the
explorer and confirm the source tab is populated. The explorer for opBNB Testnet is
`https://opbnb-testnet.bscscan.com`.

For a local dry run against Anvil:

```bash
anvil &
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

## Contract surface

Roles: `owner` (deployer), `oracle` (AI agent), `farmer`, `buyer`.

Lifecycle: `Created → Graded → Funded → Shipped → Completed | Disputed`.

| Function | Caller | Requires |
| --- | --- | --- |
| `createListing` | anyone | price > 0 |
| `postGrade` | oracle | status `Created`, grade A/B/C, confidence ≤ 100 |
| `fundEscrow` | buyer | status `Graded`, exact price |
| `markShipped` | farmer | status `Funded` |
| `postDeliveryVerification` | oracle | status `Shipped` |
| `confirmReceipt` | buyer | status `Shipped` |
| `claimAfterTimeout` | farmer | status `Shipped`, deadline passed |
| `resolveDispute` | owner | status `Disputed` |
| `setOracle` | owner | — |
| `setDeliveryTimeout` | owner | — |

Default delivery timeout: 7 days.

## Security model

- Only the oracle address can post AI results. The owner cannot forge them, only
  replace the oracle.
- A posted grade is immutable: `postGrade` requires `Created`.
- Every value transfer updates state before the external call and is guarded by
  `ReentrancyGuard`.
- `Completed` and `Disputed` block every further release path (no double payment).

Run `forge test` to see the suite covering happy path, mismatch, timeout,
unauthorized oracle, grade immutability, double-spend, and reentrancy.
