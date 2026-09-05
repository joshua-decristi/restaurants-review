"use server";

import { redirect } from "next/navigation";

import { registerUser } from "@/domains/users/server";
import { getSession, login, POST_SIGNIN_URL } from "@/lib/auth/server";

export interface RegisterActionState {
  ok: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function registerAction(_state: RegisterActionState, formData: FormData): Promise<RegisterActionState> {
  if (await getSession()) redirect(POST_SIGNIN_URL);

  const password = formString(formData, "password");
  const result = await registerUser({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password,
    // Re-validated inside registerUser; empty string fails roleSchema.
    role: formString(formData, "role") as "reviewer" | "owner",
  });

  if (!result.ok) {
    if (result.error === "already-exists") {
      return { ok: false, error: null, fieldErrors: { email: "An account with this email already exists" } };
    }
    return { ok: false, error: null, fieldErrors: result.fieldErrors };
  }

  // Success path exits via Auth.js redirect to POST_SIGNIN_URL ("/post-login").
  const signIn = await login.credentials({ email: result.user.email, password });
  if (!signIn.ok) {
    return { ok: false, error: "Account created but sign-in failed. Please log in.", fieldErrors: {} };
  }
  return { ok: true, error: null, fieldErrors: {} };
}
