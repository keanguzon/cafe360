import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { uploadAvatarAction } from "./profile-actions";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upload: vi.fn(), update: vi.fn(), eq: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  storage: { from: () => ({ upload: mocks.upload, getPublicUrl: () => ({ data: { publicUrl: "https://example.test/avatar.webp" } }) }) },
  from: () => ({ update: mocks.update }),
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.upload.mockResolvedValue({ data: {}, error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ data: null, error: null });
});

function form(bytes: Buffer, type = "image/jpeg") {
  const data = new FormData();
  data.set("avatar", new File([new Uint8Array(bytes)], "untrusted.jpg", { type }));
  return data;
}

describe("public avatar normalization", () => {
  it("uploads oriented, bounded WebP bytes without EXIF or GPS metadata", async () => {
    const original = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "red" } })
      .withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Artist: "Private artist" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "25/1 2/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "121/1 3/1 0/1" } })
      .jpeg().toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    expect(await uploadAvatarAction(form(original))).toEqual({ success: true, avatarUrl: "https://example.test/avatar.webp" });
    const [path, bytes, options] = mocks.upload.mock.calls[0];
    expect(path).toMatch(/^owner\/avatar-\d+\.webp$/);
    expect(options.contentType).toBe("image/webp");
    expect(Buffer.isBuffer(bytes)).toBe(true);
    const metadata = await sharp(bytes).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 256, height: 512 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith({ avatar_url: "https://example.test/avatar.webp" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "owner");
  });

  it.each(["image/png", "image/webp"])("accepts real %s without enlarging small images", async (type) => {
    const source = sharp({ create: { width: 2, height: 3, channels: 3, background: "blue" } });
    const bytes = await (type === "image/png" ? source.png() : source.webp()).toBuffer();
    expect((await uploadAvatarAction(form(bytes, type))).success).toBe(true);
    expect(await sharp(mocks.upload.mock.calls[0][1]).metadata()).toMatchObject({ format: "webp", width: 2, height: 3 });
  });

  it("rejects mismatched formats and corrupt content before storage or profile changes", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const jpeg = await sharp({ create: { width: 100, height: 100, channels: 3, background: "blue" } }).jpeg().toBuffer();
    for (const [bytes, type] of [[png, "image/jpeg"], [Buffer.from("<svg>not a jpeg</svg>"), "image/jpeg"], [png.subarray(0, 40), "image/png"], [jpeg.subarray(0, jpeg.length - 20), "image/jpeg"]] as const) {
      expect((await uploadAvatarAction(form(bytes, type))).error).toBeTruthy();
    }
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects animated images and excessive decoded dimensions", async () => {
    const frames = Buffer.from([...Array.from({ length: 4 }, () => [255, 0, 0]).flat(), ...Array.from({ length: 4 }, () => [0, 0, 255]).flat()]);
    const animated = await sharp(frames, { raw: { width: 2, height: 4, pageHeight: 2, channels: 3 } }).webp({ loop: 0 }).toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    const large = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: "red" } }).png().toBuffer();
    for (const [bytes, type] of [[animated, "image/webp"], [large, "image/png"]] as const) {
      expect((await uploadAvatarAction(form(bytes, type))).error).toBeTruthy();
    }
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("preserves authentication and storage failure behavior", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).jpeg().toBuffer();
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await uploadAvatarAction(form(bytes))).toEqual({ error: "You must be signed in to upload an avatar." });
    expect(mocks.upload).not.toHaveBeenCalled();
    mocks.upload.mockResolvedValueOnce({ error: { message: "Storage unavailable" } });
    expect(await uploadAvatarAction(form(bytes))).toEqual({ error: "Storage unavailable" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
