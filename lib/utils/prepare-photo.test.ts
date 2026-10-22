// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { prepareMemoryPhoto } from "./prepare-photo";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("keeps small supported photos unchanged", async () => {
  const file = new File(["small"], "photo.jpg", { type: "image/jpeg" });
  expect(await prepareMemoryPhoto(file)).toBe(file);
});
it("rejects unsupported, empty and oversized source photos", async () => {
  for (const file of [new File(["x"], "x.svg", { type: "image/svg+xml" }), new File([], "empty.jpg", { type: "image/jpeg" }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })]) {
    await expect(prepareMemoryPhoto(file)).rejects.toThrow();
  }
});
it("compresses a valid five-MB source below the serverless payload limit and releases its URL", async () => {
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: () => "blob:large-photo", revokeObjectURL: revoke });
  vi.stubGlobal("Image", class {
    width = 3000; height = 2000; onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["compressed"], { type: "image/jpeg" })));
  const file = new File([new Uint8Array(5 * 1024 * 1024)], "camera.png", { type: "image/png" });
  const prepared = await prepareMemoryPhoto(file);
  expect(prepared.type).toBe("image/jpeg");
  expect(prepared.size).toBeLessThanOrEqual(3 * 1024 * 1024);
  expect(revoke).toHaveBeenCalledWith("blob:large-photo");
});
