import { motion } from "motion/react";

export { Button } from "./Button.jsx";

const TONES = {
  leaf: "bg-leaf-100 text-leaf-600 border-leaf-400/40",
  amber: "bg-amber-100 text-amber-600 border-amber-600/25",
  rust: "bg-rust-100 text-rust-600 border-rust-600/25",
  neutral: "bg-ink-100 text-ink-500 border-ink-300/60",
};

/**
 * Status label. The dot marks a real state (in-progress states only) and does
 * not glow or loop: motion here would be decoration on a static label.
 */
export function StatusChip({ tone = "neutral", label, live = false }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]",
        TONES[tone] ?? TONES.neutral,
      ].join(" ")}
    >
      {live && <span className="size-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}

const GRADES = {
  A: "bg-leaf-100 text-leaf-600 border-leaf-400/50",
  B: "bg-amber-100 text-amber-600 border-amber-600/30",
  C: "bg-rust-100 text-rust-600 border-rust-600/30",
};

export function GradeBadge({ grade, size = "md" }) {
  if (!grade) {
    return (
      <span className="inline-flex items-center rounded-lg border border-dashed border-ink-300 px-3 py-2 font-mono text-xs text-ink-400">
        not graded
      </span>
    );
  }
  const dims = size === "lg" ? "size-14 text-2xl" : "size-10 text-lg";
  return (
    <span
      className={[
        "inline-grid place-items-center rounded-lg border font-semibold",
        dims,
        GRADES[grade] ?? GRADES.C,
      ].join(" ")}
      aria-label={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}

export function ConfidenceBar({ value, tone = "leaf" }) {
  if (value === undefined || value === null) return null;
  const pct = Math.max(0, Math.min(100, Number(value)));
  const barTone =
    { leaf: "bg-leaf-500", amber: "bg-amber-600", rust: "bg-rust-600" }[tone] ?? "bg-leaf-500";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-ink-100">
        <motion.div
          className={`h-full rounded-full ${barTone}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          style={{ originX: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
      <span className="tnum font-mono text-[12px] text-ink-500">{pct}%</span>
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

/**
 * Empty states name the cause and the next action, per the antislop rule that
 * "No data" tells the user nothing.
 */
export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-ink-300/80 bg-white/50 px-6 py-12">
      {Icon && <Icon size={26} weight="duotone" className="text-ink-400" />}
      <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
      {body && <p className="max-w-[56ch] text-[13px] leading-relaxed text-ink-500">{body}</p>}
      {action}
    </div>
  );
}

export function InlineError({ message }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rust-600/25 bg-rust-100 px-3.5 py-2.5">
      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-rust-600" />
      <p className="text-[12.5px] leading-relaxed text-rust-600">{message}</p>
    </div>
  );
}

export function TxState({ state }) {
  if (!state) return null;
  const map = {
    pending: { label: "Waiting for signature / confirmation", tone: "text-amber-600" },
    success: { label: "Confirmed", tone: "text-leaf-600" },
    error: { label: "Transaction failed", tone: "text-rust-600" },
  };
  const info = map[state.status];
  if (!info) return null;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-ink-200 bg-white px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`text-[12.5px] font-medium ${info.tone}`}>{info.label}</span>
      </div>
      {state.hash && (
        <a
          href={`https://testnet.bscscan.com/tx/${state.hash}`}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-[11px] text-ink-500 underline decoration-ink-300 underline-offset-2 hover:text-ink-800"
        >
          {state.hash}
        </a>
      )}
      {state.message && <p className="text-[11.5px] text-ink-500">{state.message}</p>}
    </div>
  );
}
