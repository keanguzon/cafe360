import { describe, expect, it } from "vitest";

import {
  validateAvatar,
  validateCredentials,
  validateProfile,
  validateSignUp,
} from "./auth";

describe("validateCredentials", () => {
  it("rejects an invalid email and short password", () => {
    expect(validateCredentials("not-an-email", "short")).toEqual({
      error: "Enter a valid email address.",
    });
  });

  it("accepts a valid email and password", () => {
    expect(validateCredentials("cafe@example.com", "password123")).toEqual({
      email: "cafe@example.com",
      password: "password123",
    });
  });
});

describe("validateSignUp", () => {
  it("normalizes a username", () => {
    expect(
      validateSignUp({
        displayName: "Mika Santos",
        email: "Mika@Example.com ",
        password: "password123",
        username: "Mika Santos",
      }),
    ).toEqual({
      displayName: "Mika Santos",
      email: "mika@example.com",
      password: "password123",
      username: "mika_santos",
    });
  });
});

describe("validateProfile", () => {
  it("rejects invalid profile fields", () => {
    expect(validateProfile({ bio: "", displayName: "", username: "no spaces" })).toEqual({
      error: "Display name is required.",
    });
  });
});

describe("validateAvatar", () => {
  it("rejects files larger than 5 MB", () => {
    expect(validateAvatar({ size: 5_242_881, type: "image/jpeg" })).toEqual({
      error: "Choose an image smaller than 5 MB.",
    });
  });
});
