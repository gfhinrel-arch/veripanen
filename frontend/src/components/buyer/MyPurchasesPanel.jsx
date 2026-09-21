import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useWriteContract } from "wagmi";
import { motion } from "motion/react";
import { Package, ArrowUpRight } from "@phosphor-icons/react";

import { harvestEscrowAbi } from "../../lib/abi.js";
import { CONTRACT_ADDRESS, STATUS, STATUS_TONE } from "../../config/chain.js";
import { useWalletGuard } from "../../lib/useWalletGuard.js";
import { useAllListings } from "../../hooks/useListings.js";
import { formatPrice, formatWeight, formatCountdown, shortAddress } from "../../lib/format.js";
import { Button, EmptyState, Skeleton, StatusChip, InlineError, TxState } from "../ui.jsx";
import { DeliveryVerificationForm } from "./DeliveryVerificationForm.jsx";

export function MyPurchasesPanel() {
  const { address, isConnected } = useAccount();
  const { listings, isLoading, refetch } = useAllListings({ refetchInterval: 12000 });

  const mine = useMemo(
    () =>
      listings.filter(
        (l) => address && l.buyer !== "0x0000000000000000000000000000000000000000" &&
          l.buyer.toLowerCase() === address.toLowerCase(),
      ),
    [listings, address],
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">Your purchases</h2>
        <span className="tnum font-mono text-[11px] text-ink-400">
          {mine.length.toString().padStart(2, "0")}
        </span>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && !isConnected && (
        <EmptyState
          icon={Package}
          title="Connect a wallet"
          body="Purchases are tracked per wallet address."
        />
      )}

      {!isLoading && isConnected && mine.length === 0 && (
        <EmptyState
          icon={Package}
          title="No purchases yet"
          body="Fund an open listing above. It will show here with its delivery status."
        />
      )}

      <div className="flex flex-col gap-4">
        {mine.map((l) => (
          <PurchaseRow key={l.listingId.toString()} listing={l} onChanged={refetch} />
        ))}
      </div>
    </section>
  );
}

function PurchaseRow({ listing, onChanged }) {
  const { writeContractAsync } = useWriteContract();
  const { guard, mapError } = useWalletGuard();
  const [tx, setTx] = useState(null);
  const [error, setError] = useState(null);

  const status = Number(listing.status);
  const meta = STATUS[status];
  const tone = STATUS_TONE[status];

  async function confirm() {
    setError(null);
    try {
      const { address: from } = guard("Confirm receipt");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: harvestEscrowAbi,
        functionName: "confirmReceipt",
        args: [listing.listingId],
        account: from,
      });
      setTx({ status: "pending", hash });
      await onChanged?.();
      setTx({ status: "success", hash });
    } catch (err) {
      setError(mapError(err, "confirm"));
      setTx({ status: "error" });
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 22 }}
      className="card-surface overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="tnum font-mono text-[11px] text-ink-400">
            #{listing.listingId.toString()}
          </span>
          <Link
            to={`/listing/${listing.listingId}`}
            className="flex items-center gap-1 text-[14px] font-medium text-ink-950 hover:text-leaf-600"
          >
            {listing.cropType}
            <ArrowUpRight size={13} className="text-ink-400" />
          </Link>
        </div>
        <StatusChip tone={tone} label={meta.label} />
      </header>

      <div className="flex flex-col gap-4 px-5 py-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px]">
          <div className="flex gap-1.5">
            <dt className="text-ink-400">Farmer</dt>
            <dd className="tnum font-mono text-ink-700">{shortAddress(listing.farmer)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-400">Weight</dt>
            <dd className="tnum text-ink-700">{formatWeight(listing.weightKg)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-ink-400">Paid</dt>
            <dd className="tnum text-ink-700">{formatPrice(listing.priceWei)}</dd>
          </div>
          {status === 3 && (
            <div className="flex gap-1.5">
              <dt className="text-ink-400">Deadline</dt>
              <dd className="tnum text-amber-600">{formatCountdown(listing.deliveryDeadline)}</dd>
            </div>
          )}
        </dl>

        {listing.deliveryVerified && (
          <div className="rounded-xl border border-ink-200 bg-ink-100/40 px-3.5 py-2.5 text-[12px]">
            <span className="font-medium text-ink-800">Delivery verified: </span>
            <span className={listing.deliveryMatched ? "text-leaf-600" : "text-rust-600"}>
              {listing.deliveryMatched ? "matched" : "mismatched"}
            </span>
            <span className="tnum text-ink-500"> · confidence {listing.deliveryConfidence.toString()}%</span>
          </div>
        )}

        {status === 3 && <DeliveryVerificationForm listing={listing} onDone={onChanged} />}

        {status === 3 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-ink-200/60 pt-4">
            <Button variant="primary" onClick={confirm}>
              Confirm receipt, release to farmer
            </Button>
            <span className="text-[11.5px] text-ink-400">
              Skip verification if the goods are clearly correct.
            </span>
          </div>
        )}

        {status === 4 && Number(listing.deliveryConfidence) > 0 && !listing.deliveryVerified && (
          <p className="text-[12px] text-ink-500">Released via buyer confirmation.</p>
        )}

        {status === 5 && (
          <div className="rounded-xl border border-rust-600/25 bg-rust-100 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-rust-600">
            The agent flagged a mismatch. Funds remain locked while the dispute is resolved by the
            contract owner.
          </div>
        )}

        {error && <InlineError message={error} />}
        {tx && <TxState state={tx} />}
      </div>
    </motion.article>
  );
}
