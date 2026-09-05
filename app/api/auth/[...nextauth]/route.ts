import { authJsHandlers } from "@/lib/auth/server";

// Thin adapter: the required Auth.js route handlers come from lib/auth.
export const { GET, POST } = authJsHandlers;
