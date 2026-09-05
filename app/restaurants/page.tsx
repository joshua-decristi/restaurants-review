import Link from "next/link";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { listRestaurants, type RestaurantView } from "@/domains/restaurants/server";
import { getSession } from "@/lib/auth/server";

import { CreateRestaurantDialog } from "./create-restaurant-dialog";
import { EditRestaurantDialog } from "./edit-restaurant-dialog";

function formatAddress(address: RestaurantView["address"]): string {
  return `${address.street}, ${address.city}, ${address.stateRegion} ${address.postalCode}, ${address.country}`;
}

/** Public restaurant list. Owners see Create and per-owned Edit controls. */
export default async function RestaurantsPage() {
  const [session, restaurants] = await Promise.all([getSession(), listRestaurants()]);
  const sessionUserId = session ? Number(session.user.id) : NaN;
  const isOwner = session?.user.role === "owner" && Number.isSafeInteger(sessionUserId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
          <p className="text-sm text-muted-foreground">Browse restaurants. Owners can create and edit their own.</p>
        </div>
        {isOwner ? <CreateRestaurantDialog /> : null}
      </header>

      {restaurants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No restaurants yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => {
            // Presentation-only; domain ownership checks remain authoritative.
            const showEdit = isOwner && restaurant.ownerId === sessionUserId;

            return (
              <li key={restaurant.id}>
                <Card className="h-full">
                  <Link href={`/restaurants/${String(restaurant.id)}`} className="block focus-visible:outline-none">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                      {/* Asset URLs may be local disk routes or third-party hosts. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={restaurant.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <CardHeader>
                      <CardTitle className="hover:underline">{restaurant.title}</CardTitle>
                      <CardDescription>{restaurant.cuisine}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="line-clamp-3 text-sm text-muted-foreground">{restaurant.description}</p>
                      <p className="text-xs text-muted-foreground">{formatAddress(restaurant.address)}</p>
                    </CardContent>
                  </Link>
                  {showEdit ? (
                    <CardFooter className="justify-end">
                      <EditRestaurantDialog
                        restaurantId={restaurant.id}
                        defaults={{
                          title: restaurant.title,
                          description: restaurant.description,
                          cuisine: restaurant.cuisine,
                          street: restaurant.address.street,
                          city: restaurant.address.city,
                          stateRegion: restaurant.address.stateRegion,
                          postalCode: restaurant.address.postalCode,
                          country: restaurant.address.country,
                        }}
                      />
                    </CardFooter>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
