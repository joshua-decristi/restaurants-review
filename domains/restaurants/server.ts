import "server-only";

export type { FakeRestaurantOverrides } from "./internal/factory";
export { restaurantsFactory } from "./internal/factory";
export { createRestaurant, deleteRestaurant, updateRestaurant } from "./internal/mutations";
export { getRestaurant, getRestaurantFilterOptions, listRestaurants, listRestaurantsByOwner } from "./internal/queries";
export type { Address, NewAddress, NewRestaurant, Restaurant } from "./internal/schema";
export { addresses, restaurants } from "./internal/schema";
export type {
  CreateRestaurantInput,
  FieldIssue,
  RestaurantError,
  RestaurantFilterOptions,
  RestaurantListItem,
  RestaurantListOptions,
  RestaurantMinRating,
  RestaurantResult,
  RestaurantSort,
  RestaurantView,
  UpdateRestaurantInput,
} from "./internal/validation";
