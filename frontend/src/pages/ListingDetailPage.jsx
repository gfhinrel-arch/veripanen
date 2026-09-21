import { useParams, Link } from "react-router-dom";
import { useBlockNumber } from "wagmi";
import { motion } from "motion/react";
import { ArrowLeft } from "@phosphor-icons/react";

import { useListing } from "../hooks/useListings.js";
import { ListingDetail } from "../components/public/ListingDetail.jsx";
import { EventTimeline } from "../components/public/EventTimeline.jsx";
import { Skeleton, EmptyState, InlineError } from "../components/ui.jsx";
import { CONTRACT_ADDRESS } from "../config/chain.js";

export function ListingDetailPage() {
  const { id } = useParams();
  const { listing, isLoading, error, refetch } = useListing(id);
  const { data: blockNumber } = useBlockNumber({ watch: true });

  if (!CONTRACT_ADDRESS) {
    return (
      <EmptyState
        title="Contract address not configured"
        body="Set VITE_CONTRACT_ADDRESS in the frontend environment to read listings."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        {error ? <InlineError message={error.shortMessage || error.message} /> : (
          <EmptyState title="Listing not found" body={`No listing exists with id #${id}.`} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <BackLink />
      <ListingDetail listing={listing} onChanged={refetch} />
      <EventTimeline listingId={listing.listingId} blockNumber={blockNumber} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/ledger"
      className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-ink-900"
    >
      <ArrowLeft size={14} />
      Public ledger
    </Link>
  );
}
