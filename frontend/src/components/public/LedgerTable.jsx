import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { useAllListings } from "../../hooks/useListings.js";
import { STATUS, STATUS_TONE } from "../../config/chain.js";
import {
  formatPrice,
  formatWeight,
  shortAddress,
  formatCountdown,
} from "../../lib/format.js";
import { EmptyState, Skeleton, GradeBadge, StatusChip } from "../ui.jsx";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "1", label: "Graded" },
  { key: "2", label: "Funded" },
  { key: "3", label: "In transit" },
  { key: "4", label: "Completed" },
  { key: "5", label: "Disputed" },
];

export function LedgerTable() {
  const { listings, isLoading } = useAllListings({ refetchInterval: 15000 });
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((l) => Number(l.status) === Number(filter));
  }, [listings, filter]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                "rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors duration-200",
                filter === f.key
                  ? "bg-ink-950 text-white"
                  : "bg-ink-100 text-ink-500 hover:bg-ink-200 hover:text-ink-700",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="tnum font-mono text-[11px] text-ink-400">
          {rows.length.toString().padStart(2, "0")} records
        </span>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          icon={MagnifyingGlass}
          title="No records match this filter"
          body="Change the filter, or check back after a farmer publishes a listing."
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink-200/70 bg-white">
          <div className="hidden grid-cols-[64px_minmax(0,2fr)_100px_120px_120px_1fr_140px] gap-3 border-b border-ink-200/70 px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400 lg:grid">
            <span>id</span>
            <span>crop / grower</span>
            <span>grade</span>
            <span className="text-right">weight</span>
            <span className="text-right">price</span>
            <span>state</span>
            <span className="text-right">deadline</span>
          </div>

          <div className="flex flex-col divide-y divide-ink-200/70">
            {rows.map((l, i) => {
              const status = Number(l.status);
              return (
                <motion.div
                  key={l.listingId.toString()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <Link
                    to={`/listing/${l.listingId}`}
                    className="grid grid-cols-2 gap-3 px-5 py-4 transition-colors hover:bg-ink-100/40 lg:grid-cols-[64px_minmax(0,2fr)_100px_120px_120px_1fr_140px] lg:items-center"
                  >
                    <span className="tnum font-mono text-[12px] text-ink-400">
                      #{l.listingId.toString()}
                    </span>

                    <span className="col-span-1 min-w-0 lg:col-span-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink-900">
                        {l.cropType}
                      </span>
                      <span className="tnum font-mono text-[11px] text-ink-400">
                        {shortAddress(l.farmer)}
                      </span>
                    </span>

                    <span className="flex items-center gap-2">
                      <GradeBadge grade={l.grade} />
                      {l.gradeConfidence > 0n && (
                        <span className="tnum font-mono text-[11px] text-ink-400">
                          {l.gradeConfidence.toString()}%
                        </span>
                      )}
                    </span>

                    <span className="tnum hidden text-right font-mono text-[12.5px] text-ink-700 lg:block">
                      {formatWeight(l.weightKg)}
                    </span>

                    <span className="tnum hidden text-right font-mono text-[12.5px] text-ink-950 lg:block">
                      {formatPrice(l.priceWei)}
                    </span>

                    <span className="col-span-2 lg:col-span-1">
                      <StatusChip tone={STATUS_TONE[status]} label={STATUS[status].label} />
                    </span>

                    <span className="tnum col-span-2 text-right font-mono text-[11.5px] text-ink-500 lg:col-span-1">
                      {status === 3 && l.deliveryDeadline > 0n
                        ? formatCountdown(l.deliveryDeadline)
                        : "—"}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
