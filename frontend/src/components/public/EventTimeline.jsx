import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";

import { harvestEscrowAbi } from "../../lib/abi.js";
import { CONTRACT_ADDRESS } from "../../config/chain.js";
import { formatBlockTime, explorerTx, shortAddress, formatPrice } from "../../lib/format.js";
import { Skeleton } from "../ui.jsx";

const EVENT_META = {
  ListingCreated: { label: "Listing created", tone: "text-ink-700" },
  GradePosted: { label: "Grade recorded", tone: "text-leaf-600" },
  EscrowFunded: { label: "Escrow funded", tone: "text-amber-600" },
  ShipmentMarked: { label: "Marked shipped", tone: "text-amber-600" },
  DeliveryVerified: { label: "Delivery verified", tone: "text-leaf-600" },
  ReceiptConfirmed: { label: "Receipt confirmed", tone: "text-leaf-600" },
  TimeoutClaimed: { label: "Timeout claim", tone: "text-amber-600" },
  DisputeResolved: { label: "Dispute resolved", tone: "text-rust-600" },
};

export function EventTimeline({ listingId, blockNumber }) {
  const publicClient = usePublicClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["listing-events", listingId?.toString(), blockNumber?.toString()],
    enabled: Boolean(publicClient && CONTRACT_ADDRESS && listingId !== undefined),
    queryFn: async () => {
      const logs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: harvestEscrowAbi,
        fromBlock: 0n,
        toBlock: "latest",
      });

      const filtered = logs
        .filter((log) => String(log.args.listingId) === String(listingId))
        .sort((a, b) => Number(a.blockNumber - b.blockNumber));

      // Attach block timestamps (cached per unique block).
      const blockCache = new Map();
      const withTime = [];
      for (const log of filtered) {
        const key = log.blockNumber.toString();
        if (!blockCache.has(key)) {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          blockCache.set(key, block.timestamp);
        }
        withTime.push({ ...log, timestamp: blockCache.get(key) });
      }
      return withTime;
    },
  });

  const rows = useMemo(() => (events ?? []).map(describe), [events]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">
        Transaction history
      </h2>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="text-[12.5px] text-ink-500">No events indexed for this listing yet.</p>
      )}

      {rows.length > 0 && (
        <ol className="flex flex-col">
          {rows.map((r, i) => (
            <motion.li
              key={`${r.txHash}-${i}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="flex items-start gap-3 border-t border-ink-200/60 py-3 first:border-t-0"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-300" />
              <div className="min-w-0 flex-1">
                <p className={`text-[12.5px] font-medium ${r.meta.tone}`}>{r.meta.label}</p>
                <p className="tnum font-mono text-[11px] text-ink-400">{formatBlockTime(r.timestamp)}</p>
                {r.detail && <p className="mt-0.5 text-[12px] text-ink-500">{r.detail}</p>}
              </div>
              <a
                href={explorerTx(r.txHash)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-mono text-[10.5px] text-ink-400 underline decoration-ink-300 underline-offset-2 hover:text-ink-800"
              >
                {shortAddress(r.txHash, 6)}
              </a>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

function describe(log) {
  const meta = EVENT_META[log.eventName] ?? { label: log.eventName, tone: "text-ink-700" };
  let detail = null;
  const a = log.args ?? {};

  switch (log.eventName) {
    case "ListingCreated":
      detail = `${a.cropType} · ${a.weightKg?.toString()} kg · ${formatPrice(a.priceWei)}`;
      break;
    case "GradePosted":
      detail = `grade ${a.grade} · confidence ${a.confidence?.toString()}%`;
      break;
    case "EscrowFunded":
      detail = `${formatPrice(a.amount)} from ${shortAddress(a.buyer)}`;
      break;
    case "ShipmentMarked":
      detail = "deadline started";
      break;
    case "DeliveryVerified":
      detail = a.matched ? `matched · confidence ${a.confidence?.toString()}%` : `mismatched · ${a.confidence?.toString()}%`;
      break;
    case "ReceiptConfirmed":
    case "TimeoutClaimed":
      detail = `${formatPrice(a.amount)} released`;
      break;
    case "DisputeResolved":
      detail = a.releaseToFarmer ? `${formatPrice(a.amount)} to grower` : `${formatPrice(a.amount)} refunded`;
      break;
    default:
      detail = null;
  }

  return {
    meta,
    detail,
    txHash: log.transactionHash,
    timestamp: log.timestamp,
  };
}
