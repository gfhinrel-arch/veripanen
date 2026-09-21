import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, CheckCircle, XCircle } from "@phosphor-icons/react";

import { readFileAsDataUrl, verifyDelivery } from "../../lib/agent.js";
import { Button, InlineError } from "../ui.jsx";
import { ConfidenceBar } from "../ui.jsx";

export function DeliveryVerificationForm({ listing, onDone }) {
  const [photo, setPhoto] = useState(null);
  const [step, setStep] = useState("idle"); // idle | verifying | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function onFile(file) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhoto({ dataUrl, filename: file.name });
    } catch (err) {
      setError(err.message);
    }
  }

  async function run() {
    if (!photo) return;
    setError(null);
    setStep("verifying");
    try {
      const res = await verifyDelivery({
        listingId: Number(listing.listingId),
        deliveryPhotoDataUrl: photo.dataUrl,
        deliveryFilename: photo.filename,
      });
      setResult(res);
      setStep("done");
      await onDone?.();
    } catch (err) {
      setError(err.shortMessage || err.message);
      setStep("error");
    }
  }

  if (step === "done" && result) {
    const matched = result.matched;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={[
          "rounded-xl border px-4 py-3.5",
          matched ? "border-leaf-400/40 bg-leaf-100/60" : "border-rust-600/25 bg-rust-100",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          {matched ? (
            <CheckCircle size={16} weight="fill" className="text-leaf-600" />
          ) : (
            <XCircle size={16} weight="fill" className="text-rust-600" />
          )}
          <span className={`text-[13px] font-medium ${matched ? "text-leaf-600" : "text-rust-600"}`}>
            {matched ? "Delivery matched — funds released to farmer" : "Mismatch recorded — funds locked"}
          </span>
        </div>
        <div className="mt-2.5">
          <ConfidenceBar value={result.confidence} tone={matched ? "leaf" : "rust"} />
        </div>
        {result.differences?.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-1">
            {result.differences.map((d, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-rust-600">
                {d}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-ink-100/30 px-4 py-4">
      <p className="text-[12.5px] font-medium text-ink-800">Verify what arrived</p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
        Photograph the delivered goods. The agent compares this against listing{" "}
        #{listing.listingId.toString()}'s original photo and locked grade.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink-800 transition-colors hover:border-ink-300">
          <Camera size={15} />
          {photo ? "Replace photo" : "Attach delivery photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        {photo && (
          <img
            src={photo.dataUrl}
            alt="Delivery preview"
            className="size-11 rounded-lg border border-ink-200 object-cover"
          />
        )}

        <Button
          variant="accent"
          size="sm"
          className="ml-auto"
          disabled={!photo || step === "verifying"}
          loading={step === "verifying"}
          onClick={run}
        >
          {step === "verifying" ? "Verifying" : "Run verification"}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3">
            <InlineError message={error} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
