import { redirect } from "next/navigation";

import { RestaurantCard } from "@/components/restaurants";
import { listRestaurants } from "@/domains/restaurants/server";
import { getSession } from "@/lib/auth/server";

/** Public restaurant list (owner Create/Edit live under /owner/restaurants). */
export default async function RestaurantsPage() {
  const session = await getSession();
  if (session?.user.role === "owner") redirect("/owner/restaurants");

  const restaurants = await listRestaurants();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
          <p className="text-sm text-muted-foreground">Browse restaurants.</p>
        </div>
      </header>

      {restaurants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No restaurants yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
