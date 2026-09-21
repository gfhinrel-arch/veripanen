import { useReadContract, useReadContracts } from "wagmi";
import { harvestEscrowAbi } from "../lib/abi.js";
import { CONTRACT_ADDRESS } from "../config/chain.js";

export const LISTING_FIELDS = [
  "listingId",
  "farmer",
  "buyer",
  "cropType",
  "weightKg",
  "priceWei",
  "photoHash",
  "photoURI",
  "grade",
  "gradeReasonURI",
  "gradeConfidence",
  "deliveryVerified",
  "deliveryMatched",
  "deliveryReasonURI",
  "deliveryConfidence",
  "status",
  "deliveryDeadline",
];

/**
 * viem decodes a named-output tuple into an object keyed by field name, but
 * positional arrays still show up in some paths. Normalise both shapes into a
 * plain object so consumers can rely on named fields.
 */
export function listingToObject(tuple) {
  if (!tuple) return null;

  // Named-output path (the common case with a typed ABI).
  if (!Array.isArray(tuple) && typeof tuple === "object") {
    const o = {};
    for (const k of LISTING_FIELDS) o[k] = tuple[k];
    // Guard: if the named lookup produced nothing, fall through to positional.
    if (o.listingId !== undefined) return o;
  }

  // Positional array path.
  const o = {};
  LISTING_FIELDS.forEach((k, i) => {
    o[k] = tuple[i];
  });
  return o;
}

export function useListingCount() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: harvestEscrowAbi,
    functionName: "listingCount",
    query: { enabled: Boolean(CONTRACT_ADDRESS) },
  });
}

export function useListing(id) {
  const query = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: harvestEscrowAbi,
    functionName: "getListing",
    args: id ? [BigInt(id)] : undefined,
    query: { enabled: Boolean(CONTRACT_ADDRESS && id) },
  });

  return { ...query, listing: listingToObject(query.data) };
}

/** Reads every listing 1..count in a single multicall. */
export function useAllListings({ refetchInterval } = {}) {
  const { data: count } = useListingCount();
  const total = count ? Number(count) : 0;
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));

  const query = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS,
      abi: harvestEscrowAbi,
      functionName: "getListing",
      args: [id],
    })),
    query: {
      enabled: Boolean(CONTRACT_ADDRESS) && total > 0,
      refetchInterval,
    },
  });

  const listings = (query.data ?? [])
    .map((r) => (r.status === "success" ? listingToObject(r.result) : null))
    .filter(Boolean);

  return { ...query, listings, total };
}
