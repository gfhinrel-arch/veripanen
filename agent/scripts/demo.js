#!/usr/bin/env node
/**
 * End-to-end demo against the local Anvil chain. Runs all four VeriPanen
 * scenarios and prints the on-chain evidence for each.
 *
 * Usage: node scripts/demo.js
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const RPC = process.env.ANVIL_RPC || "http://127.0.0.1:8545";
const CONTRACT = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Deterministic Anvil accounts.
const KEYS = {
  farmer: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  oracle: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  buyer: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  outsider: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
};

const chain = {
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const ABI = [
  { type: "function", name: "createListing", stateMutability: "nonpayable",
    inputs: [
      { name: "cropType", type: "string" }, { name: "weightKg", type: "uint256" },
      { name: "priceWei", type: "uint256" }, { name: "photoHash", type: "bytes32" },
      { name: "photoURI", type: "string" }],
    outputs: [{ name: "listingId", type: "uint256" }] },
  { type: "function", name: "postGrade", stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" }, { name: "grade", type: "string" },
      { name: "reasonURI", type: "string" }, { name: "confidence", type: "uint256" }],
    outputs: [] },
  { type: "function", name: "fundEscrow", stateMutability: "payable",
    inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "markShipped", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "postDeliveryVerification", stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" }, { name: "matched", type: "bool" },
      { name: "confidence", type: "uint256" }, { name: "reasonURI", type: "string" }],
    outputs: [] },
  { type: "function", name: "confirmReceipt", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "claimAfterTimeout", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "resolveDispute", stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" }, { name: "releaseToFarmer", type: "bool" }],
    outputs: [] },
  { type: "function", name: "getListing", stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "listingId", type: "uint256" }, { name: "farmer", type: "address" },
      { name: "buyer", type: "address" }, { name: "cropType", type: "string" },
      { name: "weightKg", type: "uint256" }, { name: "priceWei", type: "uint256" },
      { name: "photoHash", type: "bytes32" }, { name: "photoURI", type: "string" },
      { name: "grade", type: "string" }, { name: "gradeReasonURI", type: "string" },
      { name: "gradeConfidence", type: "uint256" }, { name: "deliveryVerified", type: "bool" },
      { name: "deliveryMatched", type: "bool" }, { name: "deliveryReasonURI", type: "string" },
      { name: "deliveryConfidence", type: "uint256" }, { name: "status", type: "uint8" },
      { name: "deliveryDeadline", type: "uint256" }] }] },
  { type: "function", name: "listingCount", stateMutability: "view", inputs: [],
    outputs: [{ name: "", type: "uint256" }] },
];

const STATUS = ["Created", "Graded", "Funded", "Shipped", "Completed", "Disputed"];

const pub = createPublicClient({ chain, transport: http(RPC) });
const clients = Object.fromEntries(
  Object.entries(KEYS).map(([name, key]) => {
    const account = privateKeyToAccount(key);
    return [name, { account, wallet: createWalletClient({ account, chain, transport: http(RPC) }) }];
  }),
);

const evidence = [];

async function send(role, functionName, args = [], value) {
  const { wallet } = clients[role];
  const hash = await wallet.writeContract({
    address: CONTRACT, abi: ABI, functionName, args,
    ...(value !== undefined ? { value } : {}),
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { hash, block: receipt.blockNumber, status: receipt.status };
}

async function read(id) {
  return pub.readContract({ address: CONTRACT, abi: ABI, functionName: "getListing", args: [BigInt(id)] });
}

function log(section, text) {
  console.log(`\n${section}`);
  console.log(`  ${text}`);
}

function record(scenario, step, detail) {
  evidence.push({ scenario, step, ...detail });
}

async function gasPrice() {
  return pub.getGasPrice();
}

// ---------------------------------------------------------------- scenarios

async function scenarioHappyPath() {
  console.log("\n" + "=".repeat(72));
  console.log("SCENARIO 1 — Happy path: matched delivery releases payment to farmer");
  console.log("=".repeat(72));

  const hash = keccak256(Buffer.from("demo-rice-photo-1"));
  const create = await send("farmer", "createListing", ["Lowland Rice", 480n, parseEther("0.05"), hash, "ipfs://demo-rice-1"]);
  const id = Number(await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "listingCount" }));
  log("createListing", `listing #${id} · tx ${create.hash.slice(0, 18)}…`);
  record("happy-path", "createListing", { listingId: id, tx: create.hash });

  const grade = await send("oracle", "postGrade", [BigInt(id), "A", "ipfs://grade-1", 92n]);
  log("postGrade", `grade A · confidence 92% · tx ${grade.hash.slice(0, 18)}…`);
  record("happy-path", "postGrade", { tx: grade.hash });

  const fund = await send("buyer", "fundEscrow", [BigInt(id)], parseEther("0.05"));
  log("fundEscrow", `0.05 tBNB locked · tx ${fund.hash.slice(0, 18)}…`);
  record("happy-path", "fundEscrow", { tx: fund.hash });

  const ship = await send("farmer", "markShipped", [BigInt(id)]);
  log("markShipped", `deadline started · tx ${ship.hash.slice(0, 18)}…`);
  record("happy-path", "markShipped", { tx: ship.hash });

  const farmerBefore = await pub.getBalance({ address: clients.farmer.account.address });
  const verify = await send("oracle", "postDeliveryVerification", [BigInt(id), true, 91n, "ipfs://delivery-1"]);
  const farmerAfter = await pub.getBalance({ address: clients.farmer.account.address });
  const l = await read(id);

  log("postDeliveryVerification", `matched: true · confidence 91% · tx ${verify.hash.slice(0, 18)}…`);
  log("RESULT", `status: ${STATUS[Number(l.status)]} · farmer paid ${(farmerAfter - farmerBefore)} wei`);
  record("happy-path", "postDeliveryVerification", { tx: verify.hash, matched: true, status: STATUS[Number(l.status)] });
  record("happy-path", "farmer-paid", { deltaWei: (farmerAfter - farmerBefore).toString() });

  return { id, farmerBefore, farmerAfter };
}

async function scenarioMismatch() {
  console.log("\n" + "=".repeat(72));
  console.log("SCENARIO 2 — Mismatch: goods differ, escrow stays locked, listing disputed");
  console.log("=".repeat(72));

  const hash = keccak256(Buffer.from("demo-corn-photo-2"));
  await send("farmer", "createListing", ["Yellow Corn", 300n, parseEther("0.03"), hash, "ipfs://demo-corn-2"]);
  const id = Number(await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "listingCount" }));

  await send("oracle", "postGrade", [BigInt(id), "B", "ipfs://grade-2", 85n]);
  await send("buyer", "fundEscrow", [BigInt(id)], parseEther("0.03"));
  await send("farmer", "markShipped", [BigInt(id)]);

  const escrowBefore = await pub.getBalance({ address: CONTRACT });
  const verify = await send("oracle", "postDeliveryVerification", [BigInt(id), false, 88n, "ipfs://delivery-2"]);
  const escrowAfter = await pub.getBalance({ address: CONTRACT });
  const l = await read(id);

  log("postDeliveryVerification", `matched: false · confidence 88% · tx ${verify.hash.slice(0, 18)}…`);
  log("RESULT", `status: ${STATUS[Number(l.status)]} · escrow still holds ${escrowAfter} wei`);
  record("mismatch", "postDeliveryVerification", { tx: verify.hash, matched: false, status: STATUS[Number(l.status)] });
  record("mismatch", "escrow-locked", { balanceWei: escrowAfter.toString() });

  // Owner resolves in the farmer's favour, proving the payout path works.
  // The deployer (Anvil account #0) is the contract owner, which is also the
  // `farmer` account in this demo.
  const farmerBefore = await pub.getBalance({ address: clients.farmer.account.address });
  const resolve = await send("farmer", "resolveDispute", [BigInt(id), true]);
  const farmerAfter = await pub.getBalance({ address: clients.farmer.account.address });

  log("resolveDispute", `released to farmer · tx ${resolve.hash.slice(0, 18)}…`);
  record("mismatch", "resolveDispute", { tx: resolve.hash, deltaWei: (farmerAfter - farmerBefore).toString() });
}

async function scenarioTimeout() {
  console.log("\n" + "=".repeat(72));
  console.log("SCENARIO 3 — Buyer disappears: deadline passes, farmer claims the escrow");
  console.log("=".repeat(72));

  const hash = keccak256(Buffer.from("demo-soy-photo-3"));
  await send("farmer", "createListing", ["Soybean", 200n, parseEther("0.02"), hash, "ipfs://demo-soy-3"]);
  const id = Number(await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "listingCount" }));

  await send("oracle", "postGrade", [BigInt(id), "A", "ipfs://grade-3", 94n]);
  await send("buyer", "fundEscrow", [BigInt(id)], parseEther("0.02"));
  await send("farmer", "markShipped", [BigInt(id)]);

  // 1. Claim too early must revert.
  let earlyReverted = false;
  try {
    await send("farmer", "claimAfterTimeout", [BigInt(id)]);
  } catch {
    earlyReverted = true;
  }
  log("claimAfterTimeout (too early)", earlyReverted ? "reverted as expected (DeadlineNotReached)" : "UNEXPECTEDLY SUCCEEDED");
  record("timeout", "early-claim-reverted", { reverted: earlyReverted });

  // 2. Advance the chain clock past the 7-day deadline.
  await pub.request({ method: "evm_increaseTime", params: [7 * 24 * 60 * 60 + 60] });
  await pub.request({ method: "evm_mine", params: [] });

  const farmerBefore = await pub.getBalance({ address: clients.farmer.account.address });
  const claim = await send("farmer", "claimAfterTimeout", [BigInt(id)]);
  const farmerAfter = await pub.getBalance({ address: clients.farmer.account.address });
  const l = await read(id);

  log("evm_increaseTime", "clock advanced 7 days");
  log("claimAfterTimeout", `tx ${claim.hash.slice(0, 18)}…`);
  log("RESULT", `status: ${STATUS[Number(l.status)]} · farmer paid ${(farmerAfter - farmerBefore)} wei`);
  record("timeout", "claimAfterTimeout", { tx: claim.hash, status: STATUS[Number(l.status)], deltaWei: (farmerAfter - farmerBefore).toString() });
}

async function scenarioUnauthorizedOracle() {
  console.log("\n" + "=".repeat(72));
  console.log("SCENARIO 4 — Outsider tries to post a grade: transaction reverts");
  console.log("=".repeat(72));

  const hash = keccak256(Buffer.from("demo-target-photo-4"));
  await send("farmer", "createListing", ["Demo Crop", 100n, parseEther("0.01"), hash, "ipfs://demo-4"]);
  const id = Number(await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "listingCount" }));

  const results = [];
  for (const role of ["farmer", "buyer", "outsider"]) {
    let reverted = false;
    let reason = "";
    try {
      await send(role, "postGrade", [BigInt(id), "A", "ipfs://forged", 99n]);
    } catch (err) {
      reverted = true;
      reason = (err.shortMessage || err.message || "").split("\n")[0].slice(0, 80);
    }
    results.push({ role, reverted });
    log(`postGrade as ${role}`, reverted ? `reverted: ${reason || "NotOracle"}` : "UNEXPECTEDLY SUCCEEDED");
  }

  log("RESULT", results.every((r) => r.reverted) ? "all unauthorized callers blocked by the oracle guard" : "SECURITY FAILURE");
  record("unauthorized", "outsiders-blocked", { results });

  // The real oracle can still post.
  const legit = await send("oracle", "postGrade", [BigInt(id), "A", "ipfs://legit", 90n]);
  const l = await read(id);
  log("postGrade as oracle", `accepted · grade ${l.grade} · tx ${legit.hash.slice(0, 18)}…`);
  record("unauthorized", "oracle-accepted", { tx: legit.hash, grade: l.grade });
}

// --------------------------------------------------------------------- main

async function main() {
  console.log("\nVeriPanen — end-to-end demo");
  console.log(`Chain:     Anvil (${RPC})`);
  console.log(`Contract:  ${CONTRACT}`);
  console.log(`Started:   ${new Date().toISOString()}`);

  const chainId = await pub.getChainId();
  if (chainId !== 31337) {
    console.error(`\nExpected Anvil chain id 31337, got ${chainId}. Start anvil first.`);
    process.exit(1);
  }

  await scenarioHappyPath();
  await scenarioMismatch();
  await scenarioTimeout();
  await scenarioUnauthorizedOracle();

  const dir = resolve(root, "evidence");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const out = {
    generatedAt: new Date().toISOString(),
    chain: { id: 31337, name: "Anvil (local, for development)", rpc: RPC },
    contract: CONTRACT,
    accounts: Object.fromEntries(Object.entries(clients).map(([k, v]) => [k, v.account.address])),
    scenarios: evidence,
  };
  writeFileSync(resolve(dir, "anvil-demo.json"), JSON.stringify(out, null, 2));

  console.log("\n" + "=".repeat(72));
  console.log("SUMMARY");
  console.log("=".repeat(72));
  const total = await pub.readContract({ address: CONTRACT, abi: ABI, functionName: "listingCount" });
  console.log(`  listings created: ${total}`);
  console.log(`  evidence file:    evidence/anvil-demo.json`);
  console.log("\nAll four scenarios completed. Every transaction above is real and readable");
  console.log("from the same contract state — nothing here is mocked.\n");
}

main().catch((err) => {
  console.error("\nDEMO FAILED:", err.shortMessage || err.message);
  process.exit(1);
});
