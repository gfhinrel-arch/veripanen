import { motion } from "motion/react";

export function BuyerHero() {
  return (
    <section className="grid grid-cols-1 items-end gap-8 pt-4 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] md:gap-12 md:pt-8">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 20 }}
        className="max-w-[14ch] text-4xl font-semibold leading-[0.98] tracking-tighter text-ink-950 md:text-6xl"
      >
        Buy on evidence, not on trust.
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.06 }}
        className="max-w-[62ch]"
      >
        <p className="text-base leading-relaxed text-ink-500">
          Every open listing carries an AI grade that was written to the chain before you arrived.
          Fund the escrow with confidence. When the goods arrive, photograph them. A second AI pass
          compares what you received against what was graded — and the escrow follows that result.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
          If the delivery does not match, funds stay locked and the listing is marked disputed.
          If you go quiet, the farmer can claim after the deadline.
        </p>
      </motion.div>
    </section>
  );
}
