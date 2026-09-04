import { eq } from "drizzle-orm";

import { db } from "@/lib/db/server";

import { normalizeEmail } from "../credentials";
import { type User, users } from "../schema";

/** User lookup by email; the email is normalized before querying. */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return user;
}
