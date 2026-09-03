"use server";

import { logout } from "@/domains/users/server";

export async function logoutAction(): Promise<void> {
  await logout("/");
}
