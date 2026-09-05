"use server";

import { login } from "@/lib/auth/server";

export interface LoginActionState {
  error: string | null;
}

/** Form fields are strings; file entries are rejected as empty input. */
function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Route-specific form adapter: extracts the form contract and maps the
 * domain's opaque login failure to one user-facing message, so the form never
 * learns whether the email exists. Success redirects to the role's home page.
 */
export async function loginAction(_state: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const result = await login.credentials({ email, password });

  if (!result.ok) return { error: "Invalid email or password." };
  return { error: null };
}
