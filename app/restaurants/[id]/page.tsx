import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getRestaurant, type RestaurantView } from "@/domains/restaurants/server";
import { getRatingSummary, listReviews, type ReviewSort, type ReviewView } from "@/domains/reviews/server";
import { getSession } from "@/lib/auth/server";

import { CreateReviewDialog } from "./create-review-dialog";
import { DeleteReviewButton } from "./delete-review-button";
import { EditReviewDialog } from "./edit-review-dialog";
import { ReviewSortControl } from "./review-sort-control";

function parseReviewSort(value: string | string[] | undefined): ReviewSort {
  const raw = typeof value === "string" ? value : undefined;
  return raw === "lowest" ? "lowest" : "highest";
}

function formatAddress(address: RestaurantView["address"]): string {
  return `${address.street}, ${address.city}, ${address.stateRegion} ${address.postalCode}, ${address.country}`;
}

function formatAverage(averageRating: number | null): string {
  return averageRating === null ? "No ratings yet" : `${averageRating.toFixed(1)} / 5`;
}

function formatTimestamp(value: Date): string {
  return value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ReviewCard({ review, isAuthor }: { review: ReviewView; isAuthor: boolean }) {
  return (
    <li>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base">{review.reviewerName}</CardTitle>
              <CardDescription>
                {review.rating}/5 · {formatTimestamp(review.createdAt)}
                {review.updatedAt.getTime() !== review.createdAt.getTime() ? ` · updated ${formatTimestamp(review.updatedAt)}` : ""}
              </CardDescription>
            </div>
            {isAuthor ? (
              <div className="flex items-center gap-2">
                <EditReviewDialog reviewId={review.id} restaurantId={review.restaurantId} defaults={{ rating: review.rating, content: review.content }} />
                <DeleteReviewButton reviewId={review.id} restaurantId={review.restaurantId} />
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{review.content}</p>
        </CardContent>
      </Card>
    </li>
  );
}

/** Public restaurant detail with inline reviews and basic reviewer controls. */
export default async function RestaurantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reviewSort?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const restaurantId = Number(rawId);
  if (!Number.isSafeInteger(restaurantId) || restaurantId <= 0) notFound();

  // Restaurant 404 is owned here; review queries return empty for missing ids.
  const restaurant = await getRestaurant(restaurantId);
  if (!restaurant) notFound();

  const query = await searchParams;
  const reviewSort = parseReviewSort(query.reviewSort);

  const [session, reviews, summary] = await Promise.all([getSession(), listReviews(restaurantId, reviewSort), getRatingSummary(restaurantId)]);

  const sessionUserId = session ? Number(session.user.id) : NaN;
  const isReviewer = session?.user.role === "reviewer" && Number.isSafeInteger(sessionUserId);
  // Presentation-only match against projected reviewerId; domain auth remains authoritative.
  const ownReview = isReviewer ? reviews.find((review) => review.reviewerId === sessionUserId) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/restaurants">{session?.user.role === "owner" ? "← My restaurants" : "← All restaurants"}</Link>
        </Button>

        <Card>
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
            {/* Asset URLs may be local disk routes or third-party hosts. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={restaurant.imageUrl} alt={restaurant.title} className="h-full w-full object-cover" />
          </div>
          <CardHeader>
            <CardTitle className="text-2xl">{restaurant.title}</CardTitle>
            <CardDescription>{restaurant.cuisine}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{restaurant.description}</p>
            <p className="text-xs text-muted-foreground">{formatAddress(restaurant.address)}</p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-4 text-sm">
            <p>
              <span className="font-medium">{formatAverage(summary.averageRating)}</span>
              <span className="text-muted-foreground">
                {" "}
                · {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}
              </span>
            </p>
          </CardFooter>
        </Card>
      </div>

      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Reviews</h2>
            <p className="text-sm text-muted-foreground">{reviewSort === "lowest" ? "Ordered lowest to highest." : "Ordered highest to lowest."}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ReviewSortControl reviewSort={reviewSort} />
            {!session ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Sign in to review</Link>
              </Button>
            ) : null}
            {isReviewer && !ownReview ? <CreateReviewDialog restaurantId={restaurantId} /> : null}
            {isReviewer && ownReview ? <p className="text-sm text-muted-foreground">You reviewed this restaurant. Edit or delete below.</p> : null}
          </div>
        </header>

        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} isAuthor={ownReview?.id === review.id} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
