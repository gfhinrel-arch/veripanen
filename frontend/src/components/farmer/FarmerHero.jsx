import { motion } from "motion/react";
import { Plant, CurrencyCircleDollar, ShieldCheck } from "@phosphor-icons/react";

const STEPS = [
  {
    icon: Plant,
    title: "The harvest gets graded",
    body: "Photograph the crop. The agent assesses colour, defects, and condition, then an oracle writes the grade and its confidence to BNB Chain. It can never be quietly edited afterwards.",
  },
  {
    icon: CurrencyCircleDollar,
    title: "The buyer pays into escrow",
    body: "A buyer sees the grade before spending anything, then funds the exact price. The money sits in the contract, not with the farmer and not with the buyer.",
  },
  {
    icon: ShieldCheck,
    title: "Delivery is checked against the grade",
    body: "When goods arrive, a second photo is compared with the original. Match releases payment. Mismatch locks the funds and opens a dispute.",
  },
];

export function FarmerHero() {
  return (
    <section className="flex flex-col gap-14 pt-4 md:pt-8">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-16">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
            className="max-w-[15ch] text-5xl font-semibold leading-[0.95] tracking-tighter text-ink-950 md:text-6xl lg:text-7xl"
          >
            Prove your harvest is good before the buyer pays.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.06 }}
            className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-ink-500"
          >
            Photograph the crop. An AI inspector grades it against clear visual criteria and the
            result is written to BNB Chain, where nobody, including you, can quietly change it
            later.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.12 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <a
              href="#create"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-[13.5px] font-medium text-white transition-colors hover:bg-ink-800 active:translate-y-[1px]"
            >
              <Plant size={16} weight="fill" className="text-leaf-400" />
              Publish a harvest
            </a>
            <a
              href="/ledger"
              className="inline-flex h-11 items-center rounded-lg border border-ink-200 bg-white px-5 text-[13.5px] font-medium text-ink-800 transition-colors hover:border-ink-300 hover:bg-ink-100"
            >
              Browse the public ledger
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 80, damping: 20, delay: 0.18 }}
        >
          <SampleRecord />
        </motion.div>
      </div>

      <div className="flex flex-col">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 + i * 0.08, type: "spring", stiffness: 100, damping: 22 }}
            className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-5 border-t border-ink-200/70 py-7 transition-colors md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-8"
          >
            <span className="grid size-10 place-items-center rounded-lg border border-ink-200 bg-white text-leaf-600">
              <s.icon size={20} weight="duotone" />
            </span>
            <h3 className="mt-2 text-[16px] font-semibold tracking-tight text-ink-950 md:mt-0 md:self-center">
              {s.title}
            </h3>
            <p className="col-span-2 text-[13.5px] leading-relaxed text-ink-500 md:col-span-1 md:self-center">
              {s.body}
            </p>
          </motion.div>
        ))}
        <div className="border-t border-ink-200/70" />
      </div>
    </section>
  );
}

/**
 * A sample record card. It is explicitly labelled as a sample so it is never
 * mistaken for a real on-chain listing.
 */
function SampleRecord() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-200/70 px-5 py-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
          sample record
        </span>
        <span className="rounded-md border border-ink-300/60 bg-ink-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-500">
          not live
        </span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-ink-950">Lowland rice</p>
            <p className="tnum mt-0.5 font-mono text-[11.5px] text-ink-500">
              480 kg · 0.05 tBNB
            </p>
          </div>
          <span className="grid size-12 place-items-center rounded-lg border border-leaf-400/50 bg-leaf-100 text-xl font-semibold text-leaf-600">
            A
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-200/70 pt-4">
          <Row label="Confidence" value="92%" />
          <Row label="Photo hash" value="0x7d3f…a91c" mono />
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div className="h-full w-[92%] rounded-full bg-leaf-500" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-ink-400">{label}</span>
      <span className={`text-[12.5px] text-ink-800 ${mono ? "tnum font-mono" : "tnum"}`}>
        {value}
      </span>
    </div>
  );
}
