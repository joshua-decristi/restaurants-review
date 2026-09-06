/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { clearRestaurantPreferences, readRestaurantPreferences, type RestaurantPreferences, writeRestaurantPreferences } from "@/lib/browser-storage/client";

import { DEFAULT_RESTAURANT_PREFERENCES, RestaurantFilters, toSearchParams } from "../restaurant-filters";

interface ReplaceOptions {
  scroll?: boolean;
}

const replace = jest.fn();
const router = { replace };
let currentSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/restaurants",
  useSearchParams: () => currentSearchParams,
}));

const savedPreferences: RestaurantPreferences = {
  cuisine: "Italian",
  city: "Rome",
  minRating: "4",
  sort: "worst",
};

function parseReplaceUrl(callIndex = 0): { pathname: string; params: URLSearchParams; options: ReplaceOptions | undefined } {
  const rawCall: unknown = replace.mock.calls[callIndex];
  const href = Array.isArray(rawCall) && typeof rawCall[0] === "string" ? rawCall[0] : "";
  const options =
    Array.isArray(rawCall) && rawCall[1] !== undefined && typeof rawCall[1] === "object" && rawCall[1] !== null ? (rawCall[1] as ReplaceOptions) : undefined;
  const parsed = new URL(href, "http://localhost");
  return { pathname: parsed.pathname, params: parsed.searchParams, options };
}

function renderFilters(initialPreferences: RestaurantPreferences = DEFAULT_RESTAURANT_PREFERENCES) {
  return render(<RestaurantFilters initialPreferences={initialPreferences} cuisineOptions={["Italian", "Thai"]} cityOptions={["Rome", "Paris"]} />);
}

describe("RestaurantFilters", () => {
  beforeEach(() => {
    localStorage.clear();
    replace.mockReset();
    currentSearchParams = new URLSearchParams();
  });

  it("treats recognized query parameters as authoritative and does not restore storage", async () => {
    currentSearchParams = new URLSearchParams("cuisine=Thai&city=Paris&minRating=3&sort=best");
    writeRestaurantPreferences(savedPreferences);

    renderFilters({
      cuisine: "Thai",
      city: "Paris",
      minRating: "3",
      sort: "best",
    });

    expect(screen.getByLabelText("Cuisine")).toHaveValue("Thai");
    expect(screen.getByLabelText("City")).toHaveValue("Paris");
    expect(screen.getByLabelText("Minimum rating")).toHaveValue("3");
    expect(screen.getByLabelText("Sort")).toHaveValue("best");

    await waitFor(() => {
      expect(replace).not.toHaveBeenCalled();
    });
    expect(readRestaurantPreferences()).toEqual(savedPreferences);
  });

  it("restores a valid saved configuration through router.replace when the query is empty", async () => {
    writeRestaurantPreferences(savedPreferences);

    renderFilters();

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });

    const { pathname, params, options } = parseReplaceUrl();
    expect(pathname).toBe("/restaurants");
    expect(params.get("cuisine")).toBe("Italian");
    expect(params.get("city")).toBe("Rome");
    expect(params.get("minRating")).toBe("4");
    expect(params.get("sort")).toBe("worst");
    expect(options).toEqual({ scroll: false });
  });

  it("Apply writes the complete configuration and replaces the URL with matching parameters", async () => {
    renderFilters();

    fireEvent.change(screen.getByLabelText("Cuisine"), { target: { value: "Italian" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Rome" } });
    fireEvent.change(screen.getByLabelText("Minimum rating"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "worst" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(readRestaurantPreferences()).toEqual(savedPreferences);

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });

    const { pathname, params, options } = parseReplaceUrl();
    expect(pathname).toBe("/restaurants");
    expect(params.get("cuisine")).toBe("Italian");
    expect(params.get("city")).toBe("Rome");
    expect(params.get("minRating")).toBe("4");
    expect(params.get("sort")).toBe("worst");
    expect(toSearchParams(savedPreferences)).toBe(params.toString());
    expect(options).toEqual({ scroll: false });
  });

  it("Reset all restores defaults, clears storage, navigates to /restaurants, and suppresses the next clean restore", async () => {
    currentSearchParams = new URLSearchParams(toSearchParams(savedPreferences));
    writeRestaurantPreferences(savedPreferences);

    const view = renderFilters(savedPreferences);

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

    expect(screen.getByLabelText("Cuisine")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("Minimum rating")).toHaveValue("any");
    expect(screen.getByLabelText("Sort")).toHaveValue("best");
    expect(readRestaurantPreferences()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/restaurants", { scroll: false });

    // Simulate a failed clear leaving stale prefs, then the clean-URL navigation.
    writeRestaurantPreferences(savedPreferences);
    replace.mockReset();
    currentSearchParams = new URLSearchParams();
    view.rerender(
      <RestaurantFilters initialPreferences={DEFAULT_RESTAURANT_PREFERENCES} cuisineOptions={["Italian", "Thai"]} cityOptions={["Rome", "Paris"]} />,
    );

    await waitFor(() => {
      expect(replace).not.toHaveBeenCalled();
    });
    expect(readRestaurantPreferences()).toEqual(savedPreferences);

    clearRestaurantPreferences();
  });
});
