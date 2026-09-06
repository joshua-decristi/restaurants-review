export interface RestaurantPreferences {
  cuisine: string;
  city: string;
  minRating: "any" | "3" | "4" | "5";
  sort: "best" | "worst";
}

export interface ReviewSortPreference {
  reviewSort: "highest" | "lowest";
}

const RESTAURANT_PREFERENCES_KEY = "restaurant-browse-preferences";
const REVIEW_SORT_PREFERENCE_KEY = "review-sort-preference";

const MIN_RATINGS = new Set(["any", "3", "4", "5"]);
const RESTAURANT_SORTS = new Set(["best", "worst"]);
const REVIEW_SORTS = new Set(["highest", "lowest"]);

function isRestaurantPreferences(value: unknown): value is RestaurantPreferences {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cuisine === "string" &&
    typeof candidate.city === "string" &&
    typeof candidate.minRating === "string" &&
    MIN_RATINGS.has(candidate.minRating) &&
    typeof candidate.sort === "string" &&
    RESTAURANT_SORTS.has(candidate.sort)
  );
}

function isReviewSortPreference(value: unknown): value is ReviewSortPreference {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.reviewSort === "string" && REVIEW_SORTS.has(candidate.reviewSort);
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; callers keep working from the URL.
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; callers keep working from the URL.
  }
}

export function readRestaurantPreferences(): RestaurantPreferences | null {
  const value = readJson(RESTAURANT_PREFERENCES_KEY);
  return isRestaurantPreferences(value) ? value : null;
}

export function writeRestaurantPreferences(preferences: RestaurantPreferences): void {
  writeJson(RESTAURANT_PREFERENCES_KEY, preferences);
}

export function clearRestaurantPreferences(): void {
  removeKey(RESTAURANT_PREFERENCES_KEY);
}

export function readReviewSortPreference(): ReviewSortPreference | null {
  const value = readJson(REVIEW_SORT_PREFERENCE_KEY);
  return isReviewSortPreference(value) ? value : null;
}

export function writeReviewSortPreference(preference: ReviewSortPreference): void {
  writeJson(REVIEW_SORT_PREFERENCE_KEY, preference);
}

export function clearReviewSortPreference(): void {
  removeKey(REVIEW_SORT_PREFERENCE_KEY);
}
