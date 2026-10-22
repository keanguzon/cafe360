import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { uploadPhotoAction, deleteTemporaryPhotoAction, signVisitPhotoAction } from "./photo-actions";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), upload: vi.fn(), clientRemove: vi.fn(), adminRemove: vi.fn(), createAdmin: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.clientRemove, createSignedUrl: mocks.sign }) },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdmin }));
const actor = "123e4567-e89b-12d3-a456-426614174000";
const path = `${actor}/123e4567-e89b-12d3-a456-426614174001.jpg`;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  mocks.getUser.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.clientRemove.mockResolvedValue({ error: null });
  mocks.adminRemove.mockResolvedValue({ error: null });
  mocks.createAdmin.mockImplementation(() => ({ storage: { from: () => ({ remove: mocks.adminRemove }) } }));
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://example.supabase.co/signed" }, error: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});
async function imageForm(type = "image/png") {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  const form = new FormData();
  form.append("file", new File([new Uint8Array(png)], "../../untrusted.svg", { type }));
  return form;
}
describe("private memory photos", () => {
  it("rejects a string masquerading as a file", async () => {
    const form = new FormData(); form.set("file", "not-a-file");
    expect((await uploadPhotoAction(form)).success).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("decodes and normalizes valid images to random owner-scoped paths", async () => {
    const result = await uploadPhotoAction(await imageForm());
    expect(result.success).toBe(true);
    expect(result.path).toMatch(new RegExp(`^${actor}/[0-9a-f-]{36}\\.jpg$`));
    expect(result.url).toBeUndefined();
    expect(mocks.upload.mock.calls[0][2]).toMatchObject({ contentType: "image/jpeg", upsert: false });
  });
  it("rejects MIME and decoded-format disagreement", async () => {
    expect((await uploadPhotoAction(await imageForm("image/jpeg"))).success).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects invalid image bytes and empty files", async () => {
    for (const bytes of ["", "<svg>pretend png</svg>"]) {
      const form = new FormData(); form.append("file", new File([bytes], "fake.png", { type: "image/png" }));
      expect((await uploadPhotoAction(form)).success).toBe(false);
    }
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects oversized uploads before decoding", async () => {
    const form = new FormData(); form.append("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", { type: "image/png" }));
    expect((await uploadPhotoAction(form)).success).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not upload without authentication", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await uploadPhotoAction(await imageForm())).success).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("signs for sixty seconds only after current authorization", async () => {
    expect((await signVisitPhotoAction(path)).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("can_read_visit_photo", { p_path: path });
    expect(mocks.sign).toHaveBeenCalledWith(path, 60);
  });
  it("does not sign after membership revocation", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await signVisitPhotoAction(path)).success).toBe(false);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("only deletes owned, unattached temporary paths", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect((await deleteTemporaryPhotoAction(path)).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_temporary_photo_delete", { p_path: path });
    expect(mocks.adminRemove).toHaveBeenCalledWith([path]);
    expect(mocks.clientRemove).not.toHaveBeenCalled();
    mocks.adminRemove.mockClear();
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await deleteTemporaryPhotoAction(path)).success).toBe(false);
    expect((await deleteTemporaryPhotoAction(path.replace(actor, "123e4567-e89b-12d3-a456-426614174099"))).success).toBe(false);
    expect(mocks.adminRemove).not.toHaveBeenCalled();
    expect(mocks.clientRemove).not.toHaveBeenCalled();
  });
  it("does not remove bytes when the claim fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    expect((await deleteTemporaryPhotoAction(path)).success).toBe(false);
    expect(mocks.adminRemove).not.toHaveBeenCalled();
    expect(mocks.clientRemove).not.toHaveBeenCalled();
  });
  it("can retry an ambiguous Storage failure without releasing the claim", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.adminRemove.mockResolvedValueOnce({ error: { message: "timeout" } }).mockResolvedValueOnce({ error: null });
    expect((await deleteTemporaryPhotoAction(path)).success).toBe(false);
    expect((await deleteTemporaryPhotoAction(path)).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls.every(([name]) => name === "claim_temporary_photo_delete")).toBe(true);
    expect(mocks.adminRemove).toHaveBeenCalledTimes(2);
    expect(mocks.clientRemove).not.toHaveBeenCalled();
  });
  it("fails before a claim when admin Storage is unavailable", async () => {
    mocks.createAdmin.mockImplementation(() => { throw new Error("Missing service key"); });
    expect((await deleteTemporaryPhotoAction(path)).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.adminRemove).not.toHaveBeenCalled();
    expect(mocks.clientRemove).not.toHaveBeenCalled();
  });
  it("rejects external URLs and path traversal before signing", async () => {
    for (const invalid of ["https://evil.test/photo.jpg", `${actor}/../photo.jpg`]) {
      expect((await signVisitPhotoAction(invalid)).success).toBe(false);
    }
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
