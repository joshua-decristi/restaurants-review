"use client";

import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { clearRestaurantPreferences, readRestaurantPreferences, type RestaurantPreferences, writeRestaurantPreferences } from "@/lib/browser-storage/client";

export const DEFAULT_RESTAURANT_PREFERENCES: RestaurantPreferences = {
  cuisine: "",
  city: "",
  minRating: "any",
  sort: "best",
};

const RECOGNIZED_PARAM_KEYS = ["cuisine", "city", "minRating", "sort"] as const;

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function hasRecognizedRestaurantParams(searchParams: Pick<URLSearchParams, "has">): boolean {
  return RECOGNIZED_PARAM_KEYS.some((key) => searchParams.has(key));
}

/** Omit empty/default controls so a full default Apply yields a clean URL. */
export function toSearchParams(preferences: RestaurantPreferences): string {
  const params = new URLSearchParams();
  if (preferences.cuisine !== "") params.set("cuisine", preferences.cuisine);
  if (preferences.city !== "") params.set("city", preferences.city);
  if (preferences.minRating !== "any") params.set("minRating", preferences.minRating);
  if (preferences.sort !== "best") params.set("sort", preferences.sort);
  return params.toString();
}

function preferencesKey(preferences: RestaurantPreferences): string {
  return `${preferences.cuisine}\0${preferences.city}\0${preferences.minRating}\0${preferences.sort}`;
}

function withCurrentOption(options: string[], current: string): string[] {
  if (current === "" || options.includes(current)) return options;
  return [current, ...options];
}

export interface RestaurantFiltersProps {
  initialPreferences: RestaurantPreferences;
  cuisineOptions: string[];
  cityOptions: string[];
}

/**
 * Outer shell owns restore/suppress (survives keyed form remounts).
 * Inner form is keyed by server-resolved prefs for Back/Forward draft sync.
 */
export function RestaurantFilters({ initialPreferences, cuisineOptions, cityOptions }: RestaurantFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const suppressNextCleanRestore = useRef(false);

  useEffect(() => {
    if (hasRecognizedRestaurantParams(searchParams)) return;
    if (suppressNextCleanRestore.current) {
      suppressNextCleanRestore.current = false;
      return;
    }

    const saved = readRestaurantPreferences();
    if (!saved) return;

    const query = toSearchParams(saved);
    router.replace(query ? `/restaurants?${query}` : "/restaurants", { scroll: false });
  }, [pathname, searchParams, router]);

  function apply(next: RestaurantPreferences) {
    writeRestaurantPreferences(next);
    const query = toSearchParams(next);
    router.replace(query ? `/restaurants?${query}` : "/restaurants", { scroll: false });
  }

  function resetAll() {
    suppressNextCleanRestore.current = true;
    clearRestaurantPreferences();
    router.replace("/restaurants", { scroll: false });
    // Same clean URL: effect may not re-run; consume so suppress cannot stick.
    if (!hasRecognizedRestaurantParams(searchParams)) {
      suppressNextCleanRestore.current = false;
    }
  }

  return (
    <RestaurantFiltersForm
      key={preferencesKey(initialPreferences)}
      initialPreferences={initialPreferences}
      cuisineOptions={cuisineOptions}
      cityOptions={cityOptions}
      onApply={apply}
      onResetAll={resetAll}
    />
  );
}

interface RestaurantFiltersFormProps {
  initialPreferences: RestaurantPreferences;
  cuisineOptions: string[];
  cityOptions: string[];
  onApply: (next: RestaurantPreferences) => void;
  onResetAll: () => void;
}

function RestaurantFiltersForm({ initialPreferences, cuisineOptions, cityOptions, onApply, onResetAll }: RestaurantFiltersFormProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const cuisineChoices = withCurrentOption(cuisineOptions, preferences.cuisine);
  const cityChoices = withCurrentOption(cityOptions, preferences.city);

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(preferences);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-filter-cuisine">Cuisine</Label>
          <select
            id="restaurant-filter-cuisine"
            className={selectClassName}
            value={preferences.cuisine}
            onChange={(event) => {
              setPreferences((current) => ({ ...current, cuisine: event.target.value }));
            }}
          >
            <option value="">All cuisines</option>
            {cuisineChoices.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurant-filter-city">City</Label>
          <select
            id="restaurant-filter-city"
            className={selectClassName}
            value={preferences.city}
            onChange={(event) => {
              setPreferences((current) => ({ ...current, city: event.target.value }));
            }}
          >
            <option value="">All cities</option>
            {cityChoices.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurant-filter-min-rating">Minimum rating</Label>
          <select
            id="restaurant-filter-min-rating"
            className={selectClassName}
            value={preferences.minRating}
            onChange={(event) => {
              setPreferences((current) => ({
                ...current,
                minRating: event.target.value as RestaurantPreferences["minRating"],
              }));
            }}
          >
            <option value="any">Any</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurant-filter-sort">Sort</Label>
          <select
            id="restaurant-filter-sort"
            className={selectClassName}
            value={preferences.sort}
            onChange={(event) => {
              setPreferences((current) => ({
                ...current,
                sort: event.target.value as RestaurantPreferences["sort"],
              }));
            }}
          >
            <option value="best">Best first</option>
            <option value="worst">Worst first</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Apply</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPreferences(DEFAULT_RESTAURANT_PREFERENCES);
            onResetAll();
          }}
        >
          Reset all
        </Button>
      </div>
    </form>
  );
}
