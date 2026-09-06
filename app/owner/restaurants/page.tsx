import { redirect } from "next/navigation";

import { logoutAction } from "@/app/login/login-action";
import { RestaurantCard } from "@/components/restaurants";
import { Button } from "@/components/ui/button";
import { listRestaurantsByOwner } from "@/domains/restaurants/server";
import { getSession } from "@/lib/auth/server";

import { CreateRestaurantDialog } from "./create-restaurant-dialog";
import { DeleteRestaurantDialog } from "./delete-restaurant-dialog";
import { EditRestaurantDialog } from "./edit-restaurant-dialog";

/** Owner home: session-scoped restaurant list with Create / Edit / Delete and Log out. */
export default async function OwnerRestaurantsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "owner") redirect("/restaurants");

  const userId = Number(session.user.id);
  const restaurants = await listRestaurantsByOwner(userId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My restaurants</h1>
          <p className="text-sm text-muted-foreground">Manage the restaurants you own.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateRestaurantDialog />
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              Log out
            </Button>
          </form>
        </div>
      </header>

      {restaurants.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant}>
                <EditRestaurantDialog
                  restaurantId={restaurant.id}
                  defaults={{
                    title: restaurant.title,
                    description: restaurant.description,
                    cuisine: restaurant.cuisine,
                    address: restaurant.address,
                  }}
                />
                <DeleteRestaurantDialog restaurantId={restaurant.id} restaurantTitle={restaurant.title} />
              </RestaurantCard>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No restaurants yet.</p>
      )}
    </main>
  );
}
