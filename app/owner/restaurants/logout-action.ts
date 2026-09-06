"use server";

import { logout } from "@/lib/auth/server";

/** Clears the session and sends the owner home (`/` → public list when logged out). */
export async function logoutAction(): Promise<void> {
  await logout("/");
}
