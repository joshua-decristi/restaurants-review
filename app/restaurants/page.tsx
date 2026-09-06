import { Suspense } from "react";
import { redirect } from "next/navigation";

import { RestaurantCard } from "@/components/restaurants";
import { getRestaurantFilterOptions, listRestaurants, type RestaurantListOptions } from "@/domains/restaurants/server";
import { getSession } from "@/lib/auth/server";
import type { RestaurantPreferences } from "@/lib/browser-storage/client";

import { RestaurantFilters } from "./restaurant-filters";

type RawSearchParams = Record<string, string | string[] | undefined>;

function scalar(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Map raw list query values into storage-shaped preferences + domain options. */
function resolveListQuery(searchParams: RawSearchParams): {
  preferences: RestaurantPreferences;
  listOptions: RestaurantListOptions;
  hasActiveFilters: boolean;
} {
  const cuisineParam = scalar(searchParams.cuisine);
  const cityParam = scalar(searchParams.city);
  const minRatingParam = scalar(searchParams.minRating);
  const sortParam = scalar(searchParams.sort);

  const cuisine = cuisineParam ?? "";
  const city = cityParam ?? "";
  const minRating = minRatingParam === "3" || minRatingParam === "4" || minRatingParam === "5" ? minRatingParam : "any";
  const sort = sortParam === "worst" ? "worst" : "best";

  const preferences: RestaurantPreferences = { cuisine, city, minRating, sort };
  const listOptions: RestaurantListOptions = {
    ...(cuisine.trim() !== "" ? { cuisine } : {}),
    ...(city.trim() !== "" ? { city } : {}),
    ...(minRating === "any" ? {} : { minRating: Number(minRating) as 3 | 4 | 5 }),
    sort,
  };
  const hasActiveFilters = cuisine.trim() !== "" || city.trim() !== "" || minRating !== "any" || sort !== "best";

  return { preferences, listOptions, hasActiveFilters };
}

function formatAverage(averageRating: number | null): string {
  return averageRating === null ? "No ratings yet" : `${averageRating.toFixed(1)} / 5`;
}

/** Public restaurant list (owner Create/Edit live under /owner/restaurants). */
export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const session = await getSession();
  if (session?.user.role === "owner") redirect("/owner/restaurants");

  const rawSearchParams = await searchParams;
  const { preferences, listOptions, hasActiveFilters } = resolveListQuery(rawSearchParams);
  const [restaurants, filterOptions] = await Promise.all([listRestaurants(listOptions), getRestaurantFilterOptions()]);

  const emptyMessage = hasActiveFilters ? "No restaurants match your filters." : "No restaurants yet.";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
          <p className="text-sm text-muted-foreground">Browse restaurants.</p>
        </div>
      </header>

      <Suspense fallback={null}>
        <RestaurantFilters initialPreferences={preferences} cuisineOptions={filterOptions.cuisines} cityOptions={filterOptions.cities} />
      </Suspense>

      {restaurants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant}>
                <p className="mr-auto text-sm">
                  <span className="font-medium">{formatAverage(restaurant.averageRating)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {restaurant.reviewCount} review{restaurant.reviewCount === 1 ? "" : "s"}
                  </span>
                </p>
              </RestaurantCard>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
