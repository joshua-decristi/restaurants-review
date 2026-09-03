import { authRouteHandlers } from "@/domains/users/server";

// Thin adapter: the required Auth.js route handlers come from the users
export const { GET, POST } = authRouteHandlers;
