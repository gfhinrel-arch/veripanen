import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import { motion } from "motion/react";
import { Storefront, ArrowUpRight } from "@phosphor-icons/react";

import { harvestEscrowAbi } from "../../lib/abi.js";
import { CONTRACT_ADDRESS } from "../../config/chain.js";
import { useAllListings } from "../../hooks/useListings.js";
import { formatPrice, formatWeight, shortAddress, gatewayUrl } from "../../lib/format.js";
import { Button, EmptyState, Skeleton, GradeBadge, ConfidenceBar, StatusChip } from "../ui.jsx";

export function OpenListingsPanel() {
  const { listings, isLoading, refetch } = useAllListings({ refetchInterval: 12000 });

  // Open = graded and waiting for a buyer.
  const open = useMemo(() => listings.filter((l) => Number(l.status) === 1), [listings]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">
          Open for funding
        </h2>
        <span className="tnum font-mono text-[11px] text-ink-400">
          {open.length.toString().padStart(2, "0")} available
        </span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}

      {!isLoading && open.length === 0 && (
        <EmptyState
          icon={Storefront}
          title="Nothing open right now"
          body="Graded listings appear here as soon as a farmer publishes one and the agent records its grade."
        />
      )}

      {open.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
          {open.map((l, i) => (
            <ListingCard key={l.listingId.toString()} listing={l} index={i} featured={i === 0} onFunded={refetch} />
          ))}
        </div>
      )}
    </section>
  );
}

function ListingCard({ listing, index, featured, onFunded }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const isOwn = address && listing.farmer.toLowerCase() === address.toLowerCase();

  async function fund() {
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: harvestEscrowAbi,
        functionName: "fundEscrow",
        args: [listing.listingId],
        value: listing.priceWei,
      });
      await onFunded?.();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.36), type: "spring", stiffness: 110, damping: 22 }}
      className={[
        "card-surface group flex flex-col overflow-hidden",
        featured ? "md:col-span-2 xl:col-span-1 xl:row-span-1" : "",
      ].join(" ")}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
        {listing.photoURI ? (
          <img
            src={gatewayUrl(listing.photoURI)}
            alt={`${listing.cropType} harvest`}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-ink-400">no photo</div>
        )}
        <div className="absolute left-3 top-3">
          <GradeBadge grade={listing.grade} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/listing/${listing.listingId}`}
              className="flex items-center gap-1 text-[14px] font-semibold tracking-tight text-ink-950 hover:text-leaf-600"
            >
              <span className="truncate">{listing.cropType}</span>
              <ArrowUpRight size={13} className="shrink-0 text-ink-400" />
            </Link>
            <p className="tnum mt-0.5 font-mono text-[11px] text-ink-400">
              #{listing.listingId.toString()} · {shortAddress(listing.farmer)}
            </p>
          </div>
        </div>

        <dl className="flex flex-col gap-2 text-[12.5px]">
          <Row label="Weight" value={formatWeight(listing.weightKg)} />
          <Row label="Confidence" value={<ConfidenceBar value={listing.gradeConfidence} />} />
          <Row label="Price" value={formatPrice(listing.priceWei)} strong />
        </dl>

        <div className="mt-auto pt-2">
          {isOwn ? (
            <StatusChip tone="neutral" label="your listing" />
          ) : (
            <Button
              variant="accent"
              className="w-full"
              disabled={!isConnected}
              onClick={fund}
            >
              {isConnected ? `Fund escrow · ${formatPrice(listing.priceWei)}` : "Connect to fund"}
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-200/60 pt-2 first:border-t-0 first:pt-0">
      <dt className="text-ink-400">{label}</dt>
      <dd className={strong ? "tnum font-medium text-ink-950" : "tnum text-ink-700"}>{value}</dd>
    </div>
  );
}
