import { motion } from "motion/react";

const VARIANTS = {
  primary:
    "bg-ink-950 text-white hover:bg-ink-800 disabled:bg-ink-300 disabled:text-ink-500",
  accent:
    "bg-leaf-600 text-white hover:bg-leaf-500 disabled:bg-ink-200 disabled:text-ink-400",
  quiet:
    "bg-white text-ink-800 border border-ink-200 hover:border-ink-300 hover:bg-ink-100 disabled:text-ink-400",
  danger:
    "bg-rust-600 text-white hover:bg-rust-600/90 disabled:bg-ink-200 disabled:text-ink-400",
};

export function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  children,
  className = "",
  loading = false,
  ...rest
}) {
  const dims = size === "lg" ? "h-12 px-6 text-[14px]" : size === "sm" ? "h-9 px-3.5 text-[12.5px]" : "h-11 px-5 text-[13.5px]";
  const MotionTag = motion.create(Tag);

  return (
    <MotionTag
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight",
        "transition-colors duration-200 active:translate-y-[1px]",
        "disabled:cursor-not-allowed",
        dims,
        VARIANTS[variant] ?? VARIANTS.primary,
        className,
      ].join(" ")}
      whileTap={{ scale: 0.98 }}
      {...rest}
    >
      {loading && (
        <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </MotionTag>
  );
}
