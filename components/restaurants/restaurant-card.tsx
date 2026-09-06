import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface RestaurantCardAddress {
  street: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
}

export interface RestaurantCardRestaurant {
  id: number;
  title: string;
  description: string;
  cuisine: string;
  imageUrl: string;
  address: RestaurantCardAddress;
}

export interface RestaurantCardProps {
  restaurant: RestaurantCardRestaurant;
  /** Optional owner controls (Edit/Delete); public list omits this. */
  children?: ReactNode;
}

/** Shared restaurant card used by public browse and owner list. */
export function RestaurantCard({ restaurant, children }: RestaurantCardProps) {
  return (
    <Card className="h-full pt-0">
      <Link href={`/restaurants/${String(restaurant.id)}`} className="block focus-visible:outline-none">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {/* Asset URLs may be local disk routes or third-party hosts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={restaurant.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <CardHeader className="pt-6 pb-4">
          <CardTitle className="hover:underline">{restaurant.title}</CardTitle>
          <CardDescription>{restaurant.cuisine}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="line-clamp-3 text-sm text-muted-foreground">{restaurant.description}</p>
        </CardContent>
      </Link>
      {children ? <CardFooter className="justify-end gap-2">{children}</CardFooter> : null}
    </Card>
  );
}
