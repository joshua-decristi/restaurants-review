import { hashPassword, verifyPassword } from "../server";

describe("password verification", () => {
  const password = "dev-password-123";
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(password);
  });

  it("verifies the correct password", async () => {
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("salts hashes so the same password hashes differently", async () => {
    const otherHash = await hashPassword(password);

    expect(otherHash).not.toBe(passwordHash);
    await expect(verifyPassword(password, otherHash)).resolves.toBe(true);
  });
});
