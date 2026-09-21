import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ImageSquare, Hash, X, Copy } from "@phosphor-icons/react";
import { readFileAsDataUrl, sha256HexFromDataUrl } from "../../lib/agent.js";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

export function ImageDropzone({ value, onChange, error, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setLocalError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setLocalError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Image is larger than 8 MB.");
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const hashHex = await sha256HexFromDataUrl(dataUrl);
      onChange({ file, dataUrl, filename: file.name, hashHex });
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
        className="overflow-hidden rounded-2xl border border-ink-200"
      >
        <div className="relative aspect-[16/10] w-full bg-ink-100">
          <img src={value.dataUrl} alt="Selected harvest" className="size-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-ink-950/80 text-white backdrop-blur transition-colors hover:bg-ink-950"
              aria-label="Remove photo"
            >
              <X size={15} weight="bold" />
            </button>
          )}
        </div>
        <div className="flex items-start gap-2.5 bg-white px-4 py-3">
          <Hash size={15} className="mt-0.5 shrink-0 text-ink-400" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
              integrity hash
            </p>
            <p className="truncate font-mono text-[11.5px] text-ink-700" title={value.hashHex}>
              {value.hashHex}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(value.hashHex)}
            className="ml-auto mt-0.5 text-ink-400 transition-colors hover:text-ink-800"
            aria-label="Copy hash"
          >
            <Copy size={14} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFile(e.dataTransfer.files?.[0]);
        }}
        className={[
          "flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors duration-200",
          dragOver ? "border-leaf-500 bg-leaf-100/50" : "border-ink-300 hover:border-ink-400 hover:bg-ink-100/40",
          disabled ? "cursor-not-allowed opacity-60" : "",
          error ? "border-rust-600/50" : "",
        ].join(" ")}
      >
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div
              key="busy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="shimmer size-9 rounded-lg"
            />
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <ImageSquare size={26} weight="duotone" className="text-ink-400" />
            </motion.span>
          )}
        </AnimatePresence>
        <div>
          <p className="text-[13px] font-medium text-ink-800">
            {busy ? "Hashing image…" : "Drop a harvest photo"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-400">JPEG, PNG, or WebP · up to 8 MB</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled}
      />
      {error && <p className="text-[11.5px] text-rust-600">{error}</p>}
      {localError && <p className="text-[11.5px] text-rust-600">{localError}</p>}
    </div>
  );
}
