/**
 * Focused Server Action transport tests: auth boundary and form→domain mapping.
 * Domain business behavior is covered by domains/restaurants integration tests.
 *
 * @jest-environment node
 */

import { revalidatePath } from "next/cache";

import { createRestaurant, updateRestaurant } from "@/domains/restaurants/server";
import { getSession } from "@/lib/auth/server";

import { createRestaurantAction, type RestaurantActionState, updateRestaurantAction } from "../restaurant-actions";

/** Mirror of the actions module seed (kept private there; "use server" cannot export values). */
const initialRestaurantActionState: RestaurantActionState = {
  ok: false,
  error: null,
  fieldErrors: {},
};

jest.mock("@/lib/auth/server", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/domains/restaurants/server", () => ({
  createRestaurant: jest.fn(),
  updateRestaurant: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const getSessionMock = jest.mocked(getSession);
const createRestaurantMock = jest.mocked(createRestaurant);
const updateRestaurantMock = jest.mocked(updateRestaurant);
const revalidatePathMock = jest.mocked(revalidatePath);

function multipart(fields: Record<string, string>, file?: File): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  if (file) formData.set("image", file);
  return formData;
}

const tinyPng = new File([Uint8Array.of(137, 80, 78, 71)], "shot.png", { type: "image/png" });

const validFields = {
  title: "Noodle House",
  description: "Hand-pulled noodles",
  cuisine: "Chinese",
  street: "1 Main St",
  city: "Austin",
  stateRegion: "TX",
  postalCode: "78701",
  country: "US",
};

const validParsedInput = {
  title: "Noodle House",
  description: "Hand-pulled noodles",
  cuisine: "Chinese",
  address: {
    street: "1 Main St",
    city: "Austin",
    stateRegion: "TX",
    postalCode: "78701",
    country: "US",
  },
};

const sampleView = {
  id: 1,
  ownerId: 42,
  title: "Noodle House",
  description: "Hand-pulled noodles",
  cuisine: "Chinese",
  imageUrl: "/api/assets/x",
  address: validParsedInput.address,
} as const;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createRestaurantAction", () => {
  it("returns unauthorized without a session and does not call the domain", async () => {
    getSessionMock.mockResolvedValue(null);

    const state = await createRestaurantAction(initialRestaurantActionState, multipart(validFields, tinyPng));

    expect(state).toEqual({
      ok: false,
      error: "You must be signed in to manage restaurants.",
      fieldErrors: {},
    });
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });

  it("passes the session userId to the domain and ignores form owner fields", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });
    createRestaurantMock.mockResolvedValue({ ok: true, data: sampleView });

    const formData = multipart({ ...validFields, ownerId: "999", userId: "999" }, tinyPng);
    const state = await createRestaurantAction(initialRestaurantActionState, formData);

    expect(state).toEqual({ ok: true, error: null, fieldErrors: {} });
    expect(createRestaurantMock).toHaveBeenCalledTimes(1);
    const [userId, input, image] = createRestaurantMock.mock.calls[0] ?? [];
    expect(userId).toBe(42);
    expect(input).toEqual(validParsedInput);
    expect(image).toBeInstanceOf(File);
    expect(revalidatePathMock).toHaveBeenCalledWith("/restaurants");
  });

  it("maps domain not-owner failures to stable form state", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "7", email: "reviewer@example.com", role: "reviewer" } });
    createRestaurantMock.mockResolvedValue({ ok: false, error: "not-owner" });

    const state = await createRestaurantAction(initialRestaurantActionState, multipart(validFields, tinyPng));

    expect(state).toEqual({
      ok: false,
      error: "Only restaurant owners can perform this action.",
      fieldErrors: {},
    });
  });

  it("requires an image File before calling createRestaurant", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });

    const state = await createRestaurantAction(initialRestaurantActionState, multipart(validFields));

    expect(state).toEqual({
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: { image: "An image is required." },
    });
    expect(createRestaurantMock).not.toHaveBeenCalled();
  });

  it("normalizes dotted address issue paths to flat form keys", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });
    createRestaurantMock.mockResolvedValue({
      ok: false,
      error: "validation",
      issues: [{ path: "address.street", message: "Too short" }],
    });

    const state = await createRestaurantAction(initialRestaurantActionState, multipart(validFields, tinyPng));

    expect(state.fieldErrors).toEqual({ street: "Too short" });
  });
});

describe("updateRestaurantAction", () => {
  it("returns unauthorized without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    const state = await updateRestaurantAction(initialRestaurantActionState, multipart({ id: "1", ...validFields }));

    expect(state.error).toBe("You must be signed in to manage restaurants.");
    expect(updateRestaurantMock).not.toHaveBeenCalled();
  });

  it("passes session userId, restaurant id, and full field payload, ignoring form owner fields", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });
    updateRestaurantMock.mockResolvedValue({ ok: true, data: { ...sampleView, title: "Updated" } });

    const formData = multipart({ id: "9", ...validFields, title: "Updated", ownerId: "999" });
    const state = await updateRestaurantAction(initialRestaurantActionState, formData);

    expect(state.ok).toBe(true);
    expect(updateRestaurantMock).toHaveBeenCalledWith(
      42,
      9,
      {
        ...validParsedInput,
        title: "Updated",
      },
      undefined,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/restaurants");
  });

  it("forwards supplied blank fields as empty strings so domain can validate them", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });
    updateRestaurantMock.mockResolvedValue({
      ok: false,
      error: "validation",
      issues: [{ path: "title", message: "String must contain at least 1 character(s)" }],
    });

    const state = await updateRestaurantAction(
      initialRestaurantActionState,
      multipart({
        id: "9",
        title: "   ",
        description: validFields.description,
        cuisine: validFields.cuisine,
        street: "",
        city: validFields.city,
        stateRegion: validFields.stateRegion,
        postalCode: validFields.postalCode,
        country: validFields.country,
      }),
    );

    expect(updateRestaurantMock).toHaveBeenCalledWith(
      42,
      9,
      {
        title: "   ",
        description: validFields.description,
        cuisine: validFields.cuisine,
        address: {
          street: "",
          city: validFields.city,
          stateRegion: validFields.stateRegion,
          postalCode: validFields.postalCode,
          country: validFields.country,
        },
      },
      undefined,
    );
    expect(state).toEqual({
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: { title: "String must contain at least 1 character(s)" },
    });
  });

  it("maps domain not-found failures to stable form state", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });
    updateRestaurantMock.mockResolvedValue({ ok: false, error: "not-found" });

    const state = await updateRestaurantAction(initialRestaurantActionState, multipart({ id: "1", ...validFields }));

    expect(state).toEqual({
      ok: false,
      error: "Restaurant not found.",
      fieldErrors: {},
    });
  });

  it("rejects a non-numeric restaurant id without calling the domain", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "42", email: "owner@example.com", role: "owner" } });

    const state = await updateRestaurantAction(initialRestaurantActionState, multipart({ id: "abc", ...validFields }));

    expect(state.error).toBe("Restaurant not found.");
    expect(updateRestaurantMock).not.toHaveBeenCalled();
  });
});
