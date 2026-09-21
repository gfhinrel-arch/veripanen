import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import { motion } from "motion/react";
import { ArrowUpRight, Truck } from "@phosphor-icons/react";

import { harvestEscrowAbi } from "../../lib/abi.js";
import { CONTRACT_ADDRESS, STATUS, STATUS_TONE } from "../../config/chain.js";
import { useAllListings } from "../../hooks/useListings.js";
import { formatPrice, formatWeight, formatCountdown } from "../../lib/format.js";
import { Button, EmptyState, Skeleton, StatusChip } from "../ui.jsx";
import { Plant } from "@phosphor-icons/react";

export function MyListingsPanel() {
  const { address, isConnected } = useAccount();
  const { listings, isLoading, refetch } = useAllListings({ refetchInterval: 15000 });

  const mine = useMemo(
    () => listings.filter((l) => address && l.farmer.toLowerCase() === address.toLowerCase()),
    [listings, address],
  );

  return (
    <section className="card-surface flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-ink-200/70 px-6 py-5 md:px-8">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">Your listings</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">Ship and claim from here.</p>
        </div>
        <span className="tnum font-mono text-[11px] text-ink-400">
          {mine.length.toString().padStart(2, "0")}
        </span>
      </header>

      <div className="flex flex-col divide-y divide-ink-200/70">
        {isLoading && (
          <div className="flex flex-col gap-3 p-6 md:p-8">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!isLoading && !isConnected && (
          <div className="p-6 md:p-8">
            <EmptyState
              icon={Plant}
              title="Connect a wallet"
              body="Your listings are keyed to your wallet address. Connect to see them."
            />
          </div>
        )}

        {!isLoading && isConnected && mine.length === 0 && (
          <div className="p-6 md:p-8">
            <EmptyState
              icon={Plant}
              title="No listings yet"
              body="Publish your first harvest on the left. It will appear here with its AI grade."
            />
          </div>
        )}

        {mine.map((l, i) => (
          <ListingRow key={l.listingId.toString()} listing={l} index={i} onChanged={refetch} />
        ))}
      </div>
    </section>
  );
}

function ListingRow({ listing, index, onChanged }) {
  const { writeContractAsync } = useWriteContract();
  const status = Number(listing.status);
  const meta = STATUS[status];
  const tone = STATUS_TONE[status];

  const canShip = status === 2; // Funded
  const canClaim = status === 3; // Shipped
  const deadlinePassed =
    listing.deliveryDeadline > 0n && Number(listing.deliveryDeadline) * 1000 < Date.now();

  async function action(fn) {
    try {
      const hash = await fn();
      await onChanged?.();
      return hash;
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), type: "spring", stiffness: 120, damping: 22 }}
      className="flex flex-col gap-3 px-6 py-4 md:px-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="tnum font-mono text-[11px] text-ink-400">
              #{listing.listingId.toString()}
            </span>
            <Link
              to={`/listing/${listing.listingId}`}
              className="truncate text-[13.5px] font-medium text-ink-900 hover:text-leaf-600"
            >
              {listing.cropType}
            </Link>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
            <span className="tnum">{formatWeight(listing.weightKg)}</span>
            <span className="tnum">{formatPrice(listing.priceWei)}</span>
            {status === 3 && (
              <span className="tnum text-amber-600">{formatCountdown(listing.deliveryDeadline)}</span>
            )}
          </p>
        </div>
        <StatusChip tone={tone} label={meta.label} />
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={`/listing/${listing.listingId}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          view record
          <ArrowUpRight size={12} />
        </Link>

        {canShip && (
          <Button
            size="sm"
            variant="quiet"
            className="ml-auto"
            onClick={() =>
              action(() =>
                writeContractAsync({
                  address: CONTRACT_ADDRESS,
                  abi: harvestEscrowAbi,
                  functionName: "markShipped",
                  args: [listing.listingId],
                }),
              )
            }
          >
            <Truck size={14} />
            Mark shipped
          </Button>
        )}

        {canClaim && deadlinePassed && (
          <Button
            size="sm"
            variant="accent"
            className="ml-auto"
            onClick={() =>
              action(() =>
                writeContractAsync({
                  address: CONTRACT_ADDRESS,
                  abi: harvestEscrowAbi,
                  functionName: "claimAfterTimeout",
                  args: [listing.listingId],
                }),
              )
            }
          >
            Claim escrow
          </Button>
        )}
      </div>
    </motion.div>
  );
}
