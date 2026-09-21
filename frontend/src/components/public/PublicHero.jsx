import { motion } from "motion/react";
import { SealCheck } from "@phosphor-icons/react";
import { CONTRACT_ADDRESS } from "../../config/chain.js";
import { explorerAddress } from "../../lib/format.js";

export function PublicHero() {
  return (
    <section className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] md:items-end md:gap-12 md:pt-8">
      <div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-400"
        >
          <SealCheck size={14} weight="fill" className="text-leaf-500" />
          publicly auditable · no login
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          className="max-w-[20ch] text-4xl font-semibold leading-[0.98] tracking-tighter text-ink-950 md:text-6xl"
        >
          Anyone can check the record.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.06 }}
          className="mt-5 max-w-[60ch] text-base leading-relaxed text-ink-500"
        >
          Every listing below is read straight from the chain. Grades, confidences, delivery
          checks, and escrow outcomes are all visible — not a summary, not a screenshot.
        </motion.p>
      </div>

      <div className="rounded-2xl border border-ink-200/70 bg-white px-5 py-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
          escrow contract
        </p>
        <a
          href={explorerAddress(CONTRACT_ADDRESS || "0x0")}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all font-mono text-[12px] text-ink-700 underline decoration-ink-300 underline-offset-2 hover:text-leaf-600"
        >
          {CONTRACT_ADDRESS || "not configured"}
        </a>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-400">
          BNB Smart Chain Testnet · chain 97. This address is the single source of truth.
        </p>
      </div>
    </section>
  );
}
