import { describe, expect, it } from "vitest";
import {
  deleteCollectionAction,
  getSavedCafesAction,
  getUserCollectionsAction,
  getUserSavedCafeIdsAction,
  isCafeSavedAction,
  toggleSaveCafeAction,
  upsertCafeAction,
} from "./cafe-actions";
import type { CafeSearchResult } from "@/lib/types/places";

describe("cafe-actions", () => {
  const mockCafe: CafeSearchResult = {
    id: "place.starbucks.bacoor",
    name: "Starbucks Bacoor",
    address: "Aguinaldo Hwy, Bacoor, Cavite",
    coordinates: [120.9367, 14.4172],
    priceLevel: 3,
    categories: ["coffee", "cafe"],
  };

  it("gracefully upserts cafe in demo mode when Supabase is not configured", async () => {
    const result = await upsertCafeAction(mockCafe);
    expect(result.success).toBe(true);
    expect(result.cafeId).toBe("place.starbucks.bacoor");
  });

  it("saves a cafe to a collection in demo mode", async () => {
    const saveResult = await toggleSaveCafeAction({
      cafe: mockCafe,
      collection: "Favorites",
      isSaving: true,
      notes: "Great cold brew and wifi",
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.isSaved).toBe(true);

    // Verify isCafeSavedAction
    const checkSaved = await isCafeSavedAction(mockCafe.id, "Favorites");
    expect(checkSaved.isSaved).toBe(true);
    expect(checkSaved.collections).toContain("Favorites");

    // Verify getUserSavedCafeIdsAction
    const savedIds = await getUserSavedCafeIdsAction();
    expect(savedIds).toContain(mockCafe.id);

    // Verify getSavedCafesAction
    const savedList = await getSavedCafesAction("Favorites");
    expect(savedList.length).toBeGreaterThan(0);
    expect(savedList[0].cafe?.name).toBe("Starbucks Bacoor");
    expect(savedList[0].notes).toBe("Great cold brew and wifi");

    // Verify getUserCollectionsAction
    const collections = await getUserCollectionsAction();
    const favCollection = collections.find((c) => c.name === "Favorites");
    expect(favCollection).toBeDefined();
    expect(favCollection?.count).toBeGreaterThan(0);
  });

  it("unsaves a cafe from a collection in demo mode", async () => {
    const unsaveResult = await toggleSaveCafeAction({
      cafe: mockCafe,
      collection: "Favorites",
      isSaving: false,
    });

    expect(unsaveResult.success).toBe(true);
    expect(unsaveResult.isSaved).toBe(false);

    const checkSaved = await isCafeSavedAction(mockCafe.id, "Favorites");
    expect(checkSaved.isSaved).toBe(false);
  });

  it("handles custom collection deletion in demo mode", async () => {
    // Save to custom collection
    await toggleSaveCafeAction({
      cafe: mockCafe,
      collection: "Work Spots",
      isSaving: true,
    });

    const checkBefore = await isCafeSavedAction(mockCafe.id, "Work Spots");
    expect(checkBefore.isSaved).toBe(true);

    const deleteResult = await deleteCollectionAction("Work Spots");
    expect(deleteResult.success).toBe(true);

    const checkAfter = await isCafeSavedAction(mockCafe.id, "Work Spots");
    expect(checkAfter.isSaved).toBe(false);
  });

  it("trims and sanitizes long collection names and notes", async () => {
    const veryLongName = "   " + "A".repeat(150) + "   ";
    const veryLongNotes = "B".repeat(1200);

    const saveResult = await toggleSaveCafeAction({
      cafe: mockCafe,
      collection: veryLongName,
      notes: veryLongNotes,
      isSaving: true,
    });

    expect(saveResult.success).toBe(true);
    const collections = await getUserCollectionsAction();
    const sanitizedCol = collections.find((c) => c.name === "A".repeat(100));
    expect(sanitizedCol).toBeDefined();
  });
});
