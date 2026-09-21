import { motion } from "motion/react";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { GradeBadge, ConfidenceBar, StatusChip } from "../ui.jsx";

export function GradeResultCard({ listingId, result }) {
  const manual = result.status === "MANUAL_REVIEW";
  const tone = manual ? "amber" : result.grade === "A" ? "leaf" : result.grade === "B" ? "amber" : "rust";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 22 }}
      className="rounded-2xl border border-ink-200 bg-white p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <GradeBadge grade={result.grade} size="lg" />
          <div>
            <p className="text-[13.5px] font-semibold tracking-tight text-ink-950">
              {manual ? "Held for manual review" : "Graded and recorded"}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Listing #{listingId} · {result.model}
            </p>
          </div>
        </div>
        <StatusChip
          tone={manual ? "amber" : "leaf"}
          label={manual ? "manual review" : "on-chain"}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          <span className="font-medium text-ink-700">Confidence</span>
          <ConfidenceBar value={result.confidence} tone={tone} />
        </div>

        {result.reasons?.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1.5">
            {result.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-600">
                {manual ? (
                  <Warning size={13} weight="fill" className="mt-1 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle size={13} weight="fill" className="mt-1 shrink-0 text-leaf-500" />
                )}
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      {manual && (
        <p className="mt-4 rounded-xl bg-amber-100 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-600">
          The agent refused to post this result on-chain because confidence fell below the
          threshold. It is logged for manual review instead.
        </p>
      )}
    </motion.div>
  );
}
