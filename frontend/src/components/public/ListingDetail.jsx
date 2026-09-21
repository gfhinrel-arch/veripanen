import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { motion } from "motion/react";
import { Hash, Certificate, Package, TruckIcon } from "@phosphor-icons/react";

import { harvestEscrowAbi } from "../../lib/abi.js";
import { CONTRACT_ADDRESS, STATUS, STATUS_TONE } from "../../config/chain.js";
import { useWalletGuard } from "../../lib/useWalletGuard.js";
import {
  formatPrice,
  formatWeight,
  formatCountdown,
  formatDate,
  shortAddress,
  gatewayUrl,
  explorerAddress,
  isResolvableRecordUri,
} from "../../lib/format.js";
import { StatusChip, GradeBadge, ConfidenceBar, Button, InlineError } from "../ui.jsx";

export function ListingDetail({ listing, onChanged }) {
  const { address } = useAccount();
  const status = Number(listing.status);
  const meta = STATUS[status];

  const isFarmer = address && listing.farmer.toLowerCase() === address.toLowerCase();
  const isBuyer = address && listing.buyer !== "0x0000000000000000000000000000000000000000" &&
    listing.buyer.toLowerCase() === address.toLowerCase();
  const deadlinePassed =
    listing.deliveryDeadline > 0n && Number(listing.deliveryDeadline) * 1000 < Date.now();

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
      {/* Left: the visual evidence */}
      <div className="flex flex-col gap-4">
        <div className="card-surface overflow-hidden">
          <div className="aspect-[4/3] w-full bg-ink-100">
            {listing.photoURI ? (
              <img
                src={gatewayUrl(listing.photoURI)}
                alt={`${listing.cropType} harvest`}
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center text-ink-400">no photo</div>
            )}
          </div>
          <div className="flex items-start gap-2.5 border-t border-ink-200/70 px-5 py-4">
            <Hash size={15} className="mt-0.5 shrink-0 text-ink-400" />
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
                on-chain photo hash
              </p>
              <p className="break-all font-mono text-[11.5px] text-ink-700">{listing.photoHash}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                If the photo is altered, this hash no longer matches. That is the point.
              </p>
            </div>
          </div>
        </div>

        <EvidenceBlock
          icon={Certificate}
          title="Stage 1 · harvest grade"
          rows={[
            { label: "Grade", value: listing.grade ? <GradeBadge grade={listing.grade} /> : "pending" },
            { label: "Confidence", value: <ConfidenceBar value={listing.gradeConfidence} /> },
          ]}
          footer={
            isResolvableRecordUri(listing.gradeReasonURI) ? (
              <a
                href={gatewayUrl(listing.gradeReasonURI)}
                target="_blank"
                rel="noreferrer"
                className="text-[11.5px] text-ink-500 underline decoration-ink-300 underline-offset-2 hover:text-leaf-600"
              >
                open AI reasoning record
              </a>
            ) : listing.gradeReasonURI ? (
              <p className="text-[11px] leading-relaxed text-ink-400">
                Reasoning stored as <span className="font-mono">{listing.gradeReasonURI}</span> — a
                legacy placeholder with no retrievable payload.
              </p>
            ) : null
          }
        />

        <EvidenceBlock
          icon={Package}
          title="Stage 2 · delivery verification"
          rows={[
            {
              label: "Result",
              value: listing.deliveryVerified ? (
                <span className={listing.deliveryMatched ? "text-leaf-600" : "text-rust-600"}>
                  {listing.deliveryMatched ? "matched" : "mismatched"}
                </span>
              ) : (
                "not yet performed"
              ),
            },
            {
              label: "Confidence",
              value: listing.deliveryVerified ? (
                <ConfidenceBar
                  value={listing.deliveryConfidence}
                  tone={listing.deliveryMatched ? "leaf" : "rust"}
                />
              ) : (
                "—"
              ),
            },
          ]}
          footer={
            isResolvableRecordUri(listing.deliveryReasonURI) ? (
              <a
                href={gatewayUrl(listing.deliveryReasonURI)}
                target="_blank"
                rel="noreferrer"
                className="text-[11.5px] text-ink-500 underline decoration-ink-300 underline-offset-2 hover:text-leaf-600"
              >
                open delivery reasoning record
              </a>
            ) : listing.deliveryReasonURI ? (
              <p className="text-[11px] leading-relaxed text-ink-400">
                Reasoning stored as <span className="font-mono">{listing.deliveryReasonURI}</span> —
                a legacy placeholder with no retrievable payload.
              </p>
            ) : null
          }
        />
      </div>

      {/* Right: the machine-readable record */}
      <div className="flex flex-col gap-6">
        <div>
          <StatusChip tone={STATUS_TONE[status]} label={meta.label} />
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tighter text-ink-950 md:text-4xl">
            {listing.cropType}
          </h1>
          <p className="tnum mt-1 font-mono text-[12px] text-ink-400">
            listing #{listing.listingId.toString()}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-200/70 bg-ink-200/70 sm:grid-cols-3">
          <Cell label="Weight" value={formatWeight(listing.weightKg)} />
          <Cell label="Price" value={formatPrice(listing.priceWei)} />
          <Cell label="Escrow" value={status >= 2 ? "funded" : "unfunded"} />
          <Cell label="Grower" value={shortAddress(listing.farmer)} mono />
          <Cell
            label="Buyer"
            value={
              listing.buyer === "0x0000000000000000000000000000000000000000"
                ? "—"
                : shortAddress(listing.buyer)
            }
            mono
          />
          <Cell
            label="Deadline"
            value={listing.deliveryDeadline > 0n ? formatCountdown(listing.deliveryDeadline) : "—"}
          />
        </dl>

        <div className="flex flex-col gap-2 text-[12px] text-ink-500">
          <p>
            <span className="text-ink-400">Grower address · </span>
            <a
              href={explorerAddress(listing.farmer)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline decoration-ink-300 underline-offset-2 hover:text-leaf-600"
            >
              {listing.farmer}
            </a>
          </p>
          {listing.deliveryDeadline > 0n && (
            <p className="tnum">
              <span className="text-ink-400">Deadline set · </span>
              {formatDate(listing.deliveryDeadline)}
            </p>
          )}
        </div>

        <Actions
          listing={listing}
          status={status}
          isFarmer={isFarmer}
          isBuyer={isBuyer}
          deadlinePassed={deadlinePassed}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

function EvidenceBlock({ icon: Icon, title, rows, footer }) {
  return (
    <div className="card-surface px-5 py-4">
      <div className="flex items-center gap-2">
        <Icon size={16} weight="duotone" className="text-ink-400" />
        <h3 className="text-[13px] font-semibold tracking-tight text-ink-900">{title}</h3>
      </div>
      <dl className="mt-3 flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-ink-400">{r.label}</dt>
            <dd className="text-[12.5px] text-ink-800">{r.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <div className="mt-3 border-t border-ink-200/60 pt-3">{footer}</div>}
    </div>
  );
}

function Cell({ label, value, mono }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400">{label}</dt>
      <dd className={`mt-1 text-[13.5px] text-ink-900 ${mono ? "tnum font-mono text-[12.5px]" : "tnum"}`}>
        {value}
      </dd>
    </div>
  );
}

function Actions({ listing, status, isFarmer, isBuyer, deadlinePassed, onChanged }) {
  const { writeContractAsync } = useWriteContract();
  const { guard, mapError } = useWalletGuard();
  const [error, setError] = useState(null);

  const run = async (context, functionName, value) => {
    setError(null);
    try {
      const { address: from } = guard(context);
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: harvestEscrowAbi,
        functionName,
        args: [listing.listingId],
        account: from,
        ...(value !== undefined ? { value } : {}),
      });
      await onChanged?.();
    } catch (err) {
      setError(mapError(err, context));
    }
  };

  const buttons = [];

  if (status === 2 && isFarmer) {
    buttons.push(
      <Button key="ship" variant="primary" onClick={() => run("Mark shipped", "markShipped")}>
        <TruckIcon size={15} />
        Mark shipped
      </Button>,
    );
  }

  if (status === 3 && isBuyer) {
    buttons.push(
      <Button key="confirm" variant="accent" onClick={() => run("Confirm receipt", "confirmReceipt")}>
        Confirm receipt
      </Button>,
    );
  }

  if (status === 3 && isFarmer && deadlinePassed) {
    buttons.push(
      <Button
        key="claim"
        variant="accent"
        onClick={() => run("Claim after timeout", "claimAfterTimeout")}
      >
        Claim after timeout
      </Button>,
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        {buttons.length > 0 && <div className="flex flex-wrap gap-3">{buttons}</div>}
        <InlineError message={error} />
      </div>
    );
  }

  if (buttons.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300/80 px-5 py-4">
        <p className="text-[12.5px] leading-relaxed text-ink-500">
          No action available to this wallet for the current state. Connect the relevant farmer or
          buyer wallet to act.
        </p>
      </div>
    );
  }

  return <div className="flex flex-wrap gap-3">{buttons}</div>;
}
