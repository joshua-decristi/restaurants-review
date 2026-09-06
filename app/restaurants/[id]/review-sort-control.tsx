"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { readReviewSortPreference, writeReviewSortPreference } from "@/lib/browser-storage/client";

export type ReviewSortValue = "highest" | "lowest";

const SELECT_CLASS =
  "flex h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function isReviewSort(value: string): value is ReviewSortValue {
  return value === "highest" || value === "lowest";
}

/** Client detail sort control: URL-authoritative with shared localStorage restore. */
export function ReviewSortControl({ reviewSort }: { reviewSort: ReviewSortValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Restore only on clean URLs; re-run on pathname/query transitions, not just mount.
    if (searchParams.has("reviewSort")) return;

    const saved = readReviewSortPreference();
    if (!saved) return;

    router.replace(`${pathname}?reviewSort=${saved.reviewSort}`, { scroll: false });
  }, [pathname, router, searchParams]);

  function apply(next: ReviewSortValue) {
    writeReviewSortPreference({ reviewSort: next });
    router.replace(`${pathname}?reviewSort=${next}`, { scroll: false });
  }

  return (
    <select
      key={reviewSort}
      aria-label="Sort reviews"
      className={SELECT_CLASS}
      defaultValue={reviewSort}
      onChange={(event) => {
        const value = event.target.value;
        if (isReviewSort(value)) apply(value);
      }}
    >
      <option value="highest">Highest first</option>
      <option value="lowest">Lowest first</option>
    </select>
  );
}
