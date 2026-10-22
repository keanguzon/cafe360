import { describe, expect, it } from "vitest";
import { checkUsernameSetAction, setUsernameAction } from "./username-actions";

describe("username-actions (demo / validation)", () => {
  it("checks username set status in demo mode", async () => {
    const result = await checkUsernameSetAction();
    expect(result).toBeDefined();
  });

  it("validates invalid usernames", async () => {
    const result = await setUsernameAction({
      displayName: "Mika Santos",
      username: "ab", // too short (needs >= 3)
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("validates empty display name", async () => {
    const result = await setUsernameAction({
      displayName: "   ",
      username: "mika_santos",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Display name is required.");
  });

  it("accepts valid username and display name", async () => {
    const result = await setUsernameAction({
      displayName: "Mika Santos",
      username: "mika_santos",
    });
    expect(result.success).toBe(true);
  });
});
