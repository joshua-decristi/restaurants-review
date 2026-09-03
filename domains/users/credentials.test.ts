import { credentialsSchema, normalizeEmail } from "./credentials";

describe("credentialsSchema", () => {
  it("accepts valid credentials", () => {
    const result = credentialsSchema.safeParse({
      email: "dev@takehome.local",
      password: "dev-password-123",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes the email before validating it", () => {
    const result = credentialsSchema.parse({
      email: "  Dev@Takehome.LOCAL ",
      password: "dev-password-123",
    });

    expect(result.email).toBe("dev@takehome.local");
  });

  it("rejects a malformed email", () => {
    const result = credentialsSchema.safeParse({
      email: "not-an-email",
      password: "dev-password-123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = credentialsSchema.safeParse({
      email: "dev@takehome.local",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = credentialsSchema.safeParse({ email: "dev@takehome.local" });

    expect(result.success).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeEmail("  Dev@Takehome.Local ")).toBe("dev@takehome.local");
  });
});
