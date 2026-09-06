import {
  clearRestaurantPreferences,
  clearReviewSortPreference,
  readRestaurantPreferences,
  readReviewSortPreference,
  type RestaurantPreferences,
  type ReviewSortPreference,
  writeRestaurantPreferences,
  writeReviewSortPreference,
} from "../client";

const restaurantPreferences: RestaurantPreferences = {
  cuisine: "Italian",
  city: "Rome",
  minRating: "4",
  sort: "worst",
};

const reviewSortPreference: ReviewSortPreference = {
  reviewSort: "lowest",
};

describe("browser-storage client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("RestaurantPreferences", () => {
    it("write stores the expected JSON and read returns the validated value", () => {
      writeRestaurantPreferences(restaurantPreferences);

      expect(readRestaurantPreferences()).toEqual(restaurantPreferences);
      expect(JSON.parse(localStorage.getItem("restaurant-browse-preferences") ?? "null")).toEqual(restaurantPreferences);
    });

    it("clear removes the value and read returns null", () => {
      writeRestaurantPreferences(restaurantPreferences);

      clearRestaurantPreferences();

      expect(readRestaurantPreferences()).toBeNull();
      expect(localStorage.getItem("restaurant-browse-preferences")).toBeNull();
    });

    it("malformed JSON returns null without throwing", () => {
      localStorage.setItem("restaurant-browse-preferences", "{not-json");

      expect(() => readRestaurantPreferences()).not.toThrow();
      expect(readRestaurantPreferences()).toBeNull();
    });
  });

  describe("ReviewSortPreference", () => {
    it("write stores the expected JSON and read returns the validated value", () => {
      writeReviewSortPreference(reviewSortPreference);

      expect(readReviewSortPreference()).toEqual(reviewSortPreference);
      expect(JSON.parse(localStorage.getItem("review-sort-preference") ?? "null")).toEqual(reviewSortPreference);
    });

    it("clear removes the value and read returns null", () => {
      writeReviewSortPreference(reviewSortPreference);

      clearReviewSortPreference();

      expect(readReviewSortPreference()).toBeNull();
      expect(localStorage.getItem("review-sort-preference")).toBeNull();
    });

    it("malformed JSON returns null without throwing", () => {
      localStorage.setItem("review-sort-preference", "{not-json");

      expect(() => readReviewSortPreference()).not.toThrow();
      expect(readReviewSortPreference()).toBeNull();
    });
  });
});
