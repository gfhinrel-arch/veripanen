#!/usr/bin/env node
/**
 * Full escrow lifecycle against a PUBLIC testnet (opBNB 5611 or BNB Testnet 97).
 *
 * Why this exists: the deployed contract on opBNB Testnet had exactly one
 * transaction (the deploy). A hackathon submission needs real on-chain activity
 * at the submitted address, and the demo video should show that activity.
 *
 * This is the same lifecycle as scripts/demo.js, minus the AI calls (no API key
 * needed) and minus the local-only Anvil guard.
 *
 * Usage, from the agent/ directory:
 *   node scripts/testnet-demo.js
 *
 * Requires in agent/.env:
 *   CHAIN_ID=5611
 *   BNB_TESTNET_RPC_URL=https://opbnb-testnet-rpc.bnbchain.org
 *   CONTRACT_ADDRESS=0xE07e56Af882368bc604F047Ed092A0C139c72809
 *   ORACLE_PRIVATE_KEY=0x...        (must equal the contract's oracle)
 *   DEMO_FARMER_KEY=0x...           (any funded testnet wallet)
 *   DEMO_BUYER_KEY=0x...            (any funded testnet wallet)
 *
 * Testnet only. Refuses to run on chain 31337 and on any mainnet chain id.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, createPublicClient, http, parseEther, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../src/config.js";
import { bnbTestnet, HARVEST_ESCROW_ABI, getOracleAddress } from "../src/blockchain/escrow.js";

// The agent's ABI only carries the two oracle writes plus getListing — the agent
// never creates, funds, or ships. This script drives the whole lifecycle, so the
// remaining functions are declared here rather than widening the shared ABI.
const DEMO_ABI = [
  ...HARVEST_ESCROW_ABI,
  {
    type: "function",
    name: "createListing",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cropType", type: "string" },
      { name: "weightKg", type: "uint256" },
      { name: "priceWei", type: "uint256" },
      { name: "photoHash", type: "bytes32" },
      { name: "photoURI", type: "string" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundEscrow",
    stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "markShipped",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "listingCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "oracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const MAINNET_IDS = [56, 204];
const RPC = config.chain.rpcUrl;
const CONTRACT = config.chain.contractAddress;
const CHAIN_ID = config.chain.chainId;

if (CHAIN_ID === 31337) {
  console.error("\nRefusing to run: CHAIN_ID=31337 is the local Anvil chain.");
  console.error("Use scripts/demo.js for local runs, or set CHAIN_ID=5611 in agent/.env.\n");
  process.exit(1);
}
if (MAINNET_IDS.includes(CHAIN_ID)) {
  console.error(`\nRefusing to run: chain ${CHAIN_ID} is a mainnet. Testnet only.\n`);
  process.exit(1);
}
if (!CONTRACT || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT)) {
  console.error("\nCONTRACT_ADDRESS is missing or malformed in agent/.env.\n");
  process.exit(1);
}

const farmerKey = process.env.DEMO_FARMER_KEY;
const buyerKey = process.env.DEMO_BUYER_KEY;
if (!farmerKey || !buyerKey) {
  console.error(
    "\nDEMO_FARMER_KEY and DEMO_BUYER_KEY must both be set in agent/.env." +
      "\nUse two funded testnet wallets. They are separate from the oracle key.\n",
  );
  process.exit(1);
}

const oracleAccount = privateKeyToAccount(config.chain.oraclePrivateKey);
const farmerAccount = privateKeyToAccount(farmerKey);
const buyerAccount = privateKeyToAccount(buyerKey);

const wallets = {
  farmer: createWalletClient({ account: farmerAccount, chain: bnbTestnet, transport: http(RPC) }),
  buyer: createWalletClient({ account: buyerAccount, chain: bnbTestnet, transport: http(RPC) }),
  oracle: createWalletClient({ account: oracleAccount, chain: bnbTestnet, transport: http(RPC) }),
};
const pub = createPublicClient({ chain: bnbTestnet, transport: http(RPC) });

const EXPLORER = bnbTestnet.blockExplorers.default.url;
const STATUS = ["Created", "Graded", "Funded", "Shipped", "Completed", "Disputed"];

const evidence = { chain: bnbTestnet.name, chainId: CHAIN_ID, contract: CONTRACT, steps: [] };

function txUrl(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

async function send(role, functionName, args = [], value) {
  const hash = await wallets[role].writeContract({
    address: CONTRACT,
    abi: DEMO_ABI,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted (${hash})`);
  return { hash, block: Number(receipt.blockNumber) };
}

function record(step, detail) {
  evidence.steps.push({ step, ...detail });
  console.log(`  ${step.padEnd(28)} ${detail.tx.slice(0, 20)}…  block ${detail.block}`);
  console.log(`  ${" ".repeat(28)} ${txUrl(detail.tx)}`);
}

async function preflight() {
  const code = await pub.getCode({ address: CONTRACT });
  if (!code || code === "0x") {
    console.error(`\nNo contract bytecode at ${CONTRACT} on chain ${CHAIN_ID}. Aborting.\n`);
    process.exit(1);
  }

  for (const [role, account] of [
    ["oracle", oracleAccount],
    ["farmer", farmerAccount],
    ["buyer", buyerAccount],
  ]) {
    const bal = await pub.getBalance({ address: account.address });
    console.log(
      `  ${role.padEnd(7)} ${account.address}  ${Number(bal) / 1e18} tBNB`,
    );
    if (bal === 0n) {
      console.error(`\n${role} wallet has no tBNB. Fund it before running.\n`);
      process.exit(1);
    }
  }

  const count = await pub.readContract({
    address: CONTRACT,
    abi: DEMO_ABI,
    functionName: "listingCount",
  }).catch(() => null);
  evidence.startingListingCount = count === null ? null : Number(count);
  console.log(`\n  contract has ${count === null ? "unknown" : count} listing(s) so far`);

  // A wrong oracle key would make every postGrade/postDeliveryVerification revert
  // with NotOracle, several transactions into the run. Catch it up front instead.
  const onChainOracle = await pub.readContract({
    address: CONTRACT,
    abi: DEMO_ABI,
    functionName: "oracle",
  });
  if (onChainOracle.toLowerCase() !== oracleAccount.address.toLowerCase()) {
    console.error(`\nORACLE_PRIVATE_KEY does not match the contract's oracle.`);
    console.error(`  contract oracle : ${onChainOracle}`);
    console.error(`  configured key  : ${oracleAccount.address}\n`);
    process.exit(1);
  }
  console.log(`  oracle matches the contract (${onChainOracle})\n`);
}

async function main() {
  console.log("\n" + "=".repeat(72));
  console.log(`VeriPanen — full escrow lifecycle on ${bnbTestnet.name} (chain ${CHAIN_ID})`);
  console.log("=".repeat(72) + "\n");

  await preflight();

  const before = Number(await pub.readContract({
    address: CONTRACT, abi: DEMO_ABI, functionName: "listingCount",
  }));

  // 1. Farmer lists the harvest.
  const photoHash = keccak256(Buffer.from(`veripanen-testnet-${Date.now()}`));
  const price = parseEther("0.001");
  const create = await send("farmer", "createListing", [
    "Lowland Rice", 480n, price, photoHash, "ipfs://veripanen/testnet-photo",
  ]);
  record("createListing", { tx: create.hash, block: create.block, farmer: farmerAccount.address });

  const id = BigInt(before + 1);
  evidence.listingId = Number(id);

  // 2. Oracle posts the AI grade.
  const grade = await send("oracle", "postGrade", [id, "A", "ipfs://veripanen/testnet-grade", 92n]);
  record("postGrade", { tx: grade.hash, block: grade.block, grade: "A", confidence: 92 });

  // 3. Buyer funds escrow.
  const fund = await send("buyer", "fundEscrow", [id], price);
  record("fundEscrow", { tx: fund.hash, block: fund.block, buyer: buyerAccount.address });

  // 4. Farmer ships.
  const ship = await send("farmer", "markShipped", [id]);
  record("markShipped", { tx: ship.hash, block: ship.block });

  // 5. Oracle verifies the delivery — match releases payment.
  const farmerBefore = await pub.getBalance({ address: farmerAccount.address });
  const verify = await send("oracle", "postDeliveryVerification", [
    id, true, 91n, "ipfs://veripanen/testnet-delivery",
  ]);
  const farmerAfter = await pub.getBalance({ address: farmerAccount.address });
  record("postDeliveryVerification", { tx: verify.hash, block: verify.block, matched: true, confidence: 91 });

  const listing = await pub.readContract({
    address: CONTRACT, abi: DEMO_ABI, functionName: "getListing", args: [id],
  });

  const payout = farmerAfter - farmerBefore;
  evidence.finalStatus = STATUS[Number(listing.status)];
  evidence.farmerPayoutWei = payout.toString();
  evidence.oracle = getOracleAddress();
  evidence.finishedAt = new Date().toISOString();

  console.log("\n" + "-".repeat(72));
  console.log(`  final status : ${evidence.finalStatus}`);
  console.log(`  farmer payout: ${payout} wei`);
  console.log(`  listing url  : ${EXPLORER}/address/${CONTRACT}`);
  console.log("-".repeat(72));

  mkdirSync(resolve(root, "evidence"), { recursive: true });
  const out = resolve(root, "evidence", `opbnb-demo-${CHAIN_ID}.json`);
  writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(`\n  evidence written to ${out}\n`);

  if (evidence.finalStatus !== "Completed") {
    console.error("Expected final status Completed. Inspect the explorer before using this run.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFailed:", err.shortMessage || err.message);
  process.exit(1);
});
