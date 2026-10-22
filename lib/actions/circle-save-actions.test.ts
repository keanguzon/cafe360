import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  user: { id: "actor" } as {
    id: string;
  } | null,
  member: true,
  insert: vi.fn(),
  remove: vi.fn(),
  existing: null as null | {
    id: string;
  },
  ingest: vi.fn(),
  resolve: vi.fn(),
  refresh: vi.fn(),
  filters: [] as unknown[][]
}));

vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: m.user } }) },
    from: (table: string) => {
      let deleting = false;
      const q = {
        select: () => q,
        eq: (...args: unknown[]) => {
          m.filters.push(args);
          return q;
        },
        maybeSingle: async () => ({
          data: table === "group_members" ? (m.member ? { user_id: "actor" } : null) : m.existing,
          error: null
        }),
        insert: m.insert,
        delete: () => {
          deleting = true;
          return q;
        },
        then: (resolve: (value: unknown) => unknown) => resolve(deleting ? m.remove() : {
          data: [],
          error: null
        })
      };
      return q;
    }
  }) }));

vi.mock("@/lib/data/cafe-repository", () => ({
  ingestCafe: m.ingest,
  resolveCafeId: m.resolve
}));

vi.mock("next/cache", () => ({ revalidatePath: m.refresh }));

import { saveCafeToCircleAction, removeCafeFromCircleAction } from "./circle-save-actions";

const groupId = "123e4567-e89b-12d3-a456-426614174000";

const internal = "123e4567-e89b-12d3-a456-426614174001";

beforeEach(() => {
  vi.clearAllMocks();
  m.user = { id: "actor" };
  m.member = true;
  m.existing = null;
  m.filters = [];
  m.ingest.mockResolvedValue({ internalId: internal });
  m.resolve.mockResolvedValue(internal);
  m.insert.mockResolvedValue({ error: null });
  m.remove.mockReturnValue({
    data: [{ id: "save" }],
    error: null
  });
});

it("rejects nonmembers before provider ingestion", async () => {
  m.member = false;
  expect((await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "provider",
      id: "place"
    }
  })).success).toBe(false);
  expect(m.ingest).not.toHaveBeenCalled();
});

it("saves provider cafés as the authenticated saver", async () => {
  expect((await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "provider",
      id: "place"
    }
  })).success).toBe(true);
  expect(m.insert).toHaveBeenCalledWith({
    group_id: groupId,
    cafe_id: internal,
    saved_by: "actor"
  });
});

it("resolves internal references without provider ingestion", async () => {
  await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "internal",
      id: internal
    }
  });
  expect(m.resolve).toHaveBeenCalledWith({
    kind: "internal",
    id: internal
  });
  expect(m.ingest).not.toHaveBeenCalled();
});

it("confirms duplicate rows and never replaces their saver", async () => {
  m.insert.mockResolvedValue({ error: {
      code: "23505",
      message: "duplicate"
    }
  });
  expect((await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "internal",
      id: internal
    }
  })).success).toBe(false);
  m.existing = { id: "existing" };
  expect((await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "internal",
      id: internal
    }
  })).success).toBe(true);
  expect(m.filters).toContainEqual(["group_id", groupId]);
  expect(m.filters).toContainEqual(["cafe_id", internal]);
});

it("removes only the actor's exact save and rejects zero removals", async () => {
  expect((await removeCafeFromCircleAction({
    groupId,
    cafe: {
      kind: "internal",
      id: internal
    }
  })).success).toBe(true);
  expect(m.filters).toContainEqual(["saved_by", "actor"]);
  m.remove.mockReturnValue({
    data: [],
    error: null
  });
  expect((await removeCafeFromCircleAction({
    groupId,
    cafe: {
      kind: "internal",
      id: internal
    }
  })).success).toBe(false);
});

it("reports committed saves when route refresh fails", async () => {
  m.refresh.mockImplementation(() => {
    throw Error("refresh");
  });
  expect(await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "provider",
      id: "place"
    }
  })).toMatchObject({
    success: true,
    refreshFailed: true
  });
});

it("rejects malformed references before data access", async () => {
  expect((await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "internal",
      id: "bad"
    }
  })).success).toBe(false);
  expect(m.resolve).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});

it("does not insert when provider ingestion fails", async () => {
  m.ingest.mockRejectedValue(Error("Provider unavailable"));
  expect(await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "provider",
      id: "place"
    }
  }))
    .toMatchObject({
    success: false,
    error: "Provider unavailable"
  });
  expect(m.insert).not.toHaveBeenCalled();
});

it("rejects writes without an authenticated user", async () => {
  m.user = null;
  expect((await saveCafeToCircleAction({
    groupId,
    cafe: {
      kind: "provider",
      id: "place"
    }
  })).success).toBe(false);
  expect(m.ingest).not.toHaveBeenCalled();
  expect(m.insert).not.toHaveBeenCalled();
});
