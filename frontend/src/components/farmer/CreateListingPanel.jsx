import { useMemo, useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { Sparkle } from "@phosphor-icons/react";

import { harvestEscrowAbi } from "../../lib/abi.js";
import { CONTRACT_ADDRESS } from "../../config/chain.js";
import { Button, InlineError, TxState } from "../ui.jsx";
import { uploadPhoto, gradeHarvest } from "../../lib/agent.js";
import { Field } from "./Field.jsx";
import { ImageDropzone } from "./ImageDropzone.jsx";
import { GradeResultCard } from "./GradeResultCard.jsx";

const INITIAL = { cropType: "", weightKg: "", price: "" };

export function CreateListingPanel() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [form, setForm] = useState(INITIAL);
  const [photo, setPhoto] = useState(null);
  const [step, setStep] = useState("idle"); // idle|uploading|creating|grading|done|error
  const [error, setError] = useState(null);
  const [listingId, setListingId] = useState(null);
  const [gradeResult, setGradeResult] = useState(null);
  const [tx, setTx] = useState(null);

  const errors = useMemo(() => {
    const e = {};
    if (!form.cropType.trim()) e.cropType = "Name the crop.";
    if (!form.weightKg || Number(form.weightKg) <= 0) e.weightKg = "Enter a positive weight.";
    if (!form.price || Number(form.price) <= 0) e.price = "Set a price above zero.";
    if (!photo) e.photo = "Attach a harvest photo.";
    return e;
  }, [form, photo]);

  const busy = step === "uploading" || step === "creating" || step === "grading";
  const canSubmit = isConnected && Object.keys(errors).length === 0 && !busy;

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    try {
      setStep("uploading");
      const uploaded = await uploadPhoto(photo);

      setStep("creating");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: harvestEscrowAbi,
        functionName: "createListing",
        args: [
          form.cropType.trim(),
          BigInt(Math.round(Number(form.weightKg))),
          parseEther(form.price),
          uploaded.hashHex,
          uploaded.uri,
        ],
      });
      setTx({ status: "pending", hash });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const id = extractListingId(receipt);
      if (id === null) throw new Error("Could not read the new listing id from the receipt.");

      setListingId(id);
      setTx({ status: "success", hash });
      setStep("grading");

      const graded = await gradeHarvest({
        listingId: id,
        cropType: form.cropType.trim(),
        weightKg: Number(form.weightKg),
        photoDataUrl: photo.dataUrl,
        photoFilename: photo.filename,
      });
      setGradeResult(graded);
      setStep("done");
    } catch (err) {
      setError(err.shortMessage || err.message || "Something went wrong.");
      setStep("error");
      setTx((t) => (t ? { ...t, status: "error" } : null));
    }
  }

  function reset() {
    setForm(INITIAL);
    setPhoto(null);
    setStep("idle");
    setError(null);
    setListingId(null);
    setGradeResult(null);
    setTx(null);
  }

  return (
    <section className="card-surface overflow-hidden">
      <header className="flex items-center justify-between border-b border-ink-200/70 px-6 py-5 md:px-8">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink-950">Create a listing</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            Photo, weight, price. The agent grades it next.
          </p>
        </div>
        <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400 sm:block">
          stage 1 of 2
        </span>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-6 px-6 py-6 md:px-8 md:py-7">
        <ImageDropzone
          value={photo}
          onChange={setPhoto}
          error={errors.photo}
          disabled={step !== "idle"}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Crop"
            hint="What are you selling?"
            error={errors.cropType}
            value={form.cropType}
            onChange={(v) => update("cropType", v)}
            placeholder="Lowland rice, Grade A"
            disabled={step !== "idle"}
          />
          <Field
            label="Weight (kg)"
            hint="Declared net weight"
            error={errors.weightKg}
            value={form.weightKg}
            onChange={(v) => update("weightKg", v.replace(/[^\d]/g, ""))}
            placeholder="480"
            inputMode="numeric"
            disabled={step !== "idle"}
          />
        </div>

        <Field
          label="Price (tBNB)"
          hint="Held in escrow once a buyer funds it"
          error={errors.price}
          value={form.price}
          onChange={(v) => update("price", v.replace(/[^\d.]/g, ""))}
          placeholder="0.05"
          inputMode="decimal"
          disabled={step !== "idle"}
        />

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <InlineError message={error} />
            </motion.div>
          )}
        </AnimatePresence>

        {tx && <TxState state={tx} />}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="accent" size="lg" disabled={!canSubmit} loading={step !== "idle" && step !== "done" && step !== "error"}>
            <Sparkle size={16} weight="fill" />
            {stepLabel(step)}
          </Button>
          {(step === "done" || step === "error") && (
            <Button type="button" variant="quiet" size="lg" onClick={reset}>
              New listing
            </Button>
          )}
          {!isConnected && (
            <span className="text-[12.5px] text-ink-500">Connect a wallet to publish.</span>
          )}
        </div>

        <AnimatePresence>
          {gradeResult && step === "done" && (
            <GradeResultCard listingId={listingId} result={gradeResult} />
          )}
        </AnimatePresence>
      </form>
    </section>
  );
}

function stepLabel(step) {
  switch (step) {
    case "uploading":
      return "Uploading photo";
    case "creating":
      return "Publishing listing";
    case "grading":
      return "Agent grading";
    case "done":
      return "Listing live";
    default:
      return "Publish and grade";
  }
}

function extractListingId(receipt) {
  // ListingCreated(listingId indexed, farmer indexed, ...). listingId is topics[1].
  for (const log of receipt.logs ?? []) {
    if (log.topics?.[0] && log.topics.length >= 2) {
      try {
        return Number(BigInt(log.topics[1]));
      } catch {
        // not a uint topic, keep scanning
      }
    }
  }
  return null;
}
