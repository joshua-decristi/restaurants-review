import bcrypt from "bcryptjs";

/** bcrypt cost factor; bcryptjs is portable pure JavaScript. */
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Constant-safe library comparison of a candidate password against a hash. */
export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
