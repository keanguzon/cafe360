// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoUpload } from "./photo-upload";
import * as photoPreparation from "@/lib/utils/prepare-photo";

const { uploadPhotoActionMock, deleteTemporaryPhotoActionMock } = vi.hoisted(() => ({
  uploadPhotoActionMock: vi.fn(),
  deleteTemporaryPhotoActionMock: vi.fn(),
}));

vi.mock("@/lib/actions/photo-actions", () => ({
  uploadPhotoAction: uploadPhotoActionMock,
  deleteTemporaryPhotoAction: deleteTemporaryPhotoActionMock,
}));

describe("PhotoUpload", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  const createObjectURLMock = vi.fn();
  const revokeObjectURLMock = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    createObjectURLMock.mockImplementation((blob: Blob) => {
      const name = blob instanceof File ? blob.name : "photo";
      return `blob:mock/${name}`;
    });
    revokeObjectURLMock.mockImplementation(() => {});

    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
    if (typeof window !== "undefined") {
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    if (typeof window !== "undefined") {
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  async function selectFiles(input: HTMLInputElement, files: File[]) {
    Object.defineProperty(input, "files", {
      value: files,
      configurable: true,
      writable: true,
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }

  it("blocks offline selection even when the change handler is invoked directly", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await act(async () => { root?.render(<PhotoUpload onUploadSuccess={vi.fn()} />); });
      const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
      expect(input.disabled).toBe(true);
      await selectFiles(input, [new File(["photo"], "coffee.jpg", { type: "image/jpeg" })]);
      expect(uploadPhotoActionMock).not.toHaveBeenCalled();
      expect(createObjectURLMock).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("rejects unsupported file types or >5 files with role=\"alert\" and uploads valid JPEG/PNG/WebP files, passing their storage paths to onUploadSuccess", async () => {
    const onUploadSuccess = vi.fn();
    act(() => {
      root?.render(<PhotoUpload onUploadSuccess={onUploadSuccess} />);
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input).not.toBeNull();

    // 1. Rejects unsupported file types (e.g. text/plain)
    const invalidFile = new File(["not an image"], "notes.txt", { type: "text/plain" });
    await selectFiles(input, [invalidFile]);

    const typeAlert = container.querySelector('[role="alert"]');
    expect(typeAlert).not.toBeNull();
    expect(typeAlert?.textContent).toBe("Choose JPEG, PNG or WebP photos up to 5 MB each.");
    expect(uploadPhotoActionMock).not.toHaveBeenCalled();
    expect(onUploadSuccess).not.toHaveBeenCalled();

    // 2. Rejects > 5 files
    const sixFiles = Array.from({ length: 6 }, (_, index) =>
      new File(["img content"], `photo-${index}.jpg`, { type: "image/jpeg" })
    );
    uploadPhotoActionMock.mockResolvedValue({ success: true, path: "storage/photo.jpg" });

    await selectFiles(input, sixFiles);
    const countAlert = container.querySelector('[role="alert"]');
    expect(countAlert).not.toBeNull();
    expect(countAlert?.textContent).toBe("You can attach up to five photos.");

    // 3. Uploads valid JPEG/PNG/WebP files, passing their storage paths to onUploadSuccess
    act(() => {
      root?.unmount();
    });
    root = createRoot(container);
    onUploadSuccess.mockClear();
    uploadPhotoActionMock.mockReset();

    act(() => {
      root?.render(<PhotoUpload onUploadSuccess={onUploadSuccess} />);
    });
    const freshInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;

    const jpegFile = new File(["jpeg-data"], "photo.jpeg", { type: "image/jpeg" });
    const pngFile = new File(["png-data"], "photo.png", { type: "image/png" });
    const webpFile = new File(["webp-data"], "photo.webp", { type: "image/webp" });

    uploadPhotoActionMock
      .mockResolvedValueOnce({ success: true, path: "storage/photo-1.jpeg" })
      .mockResolvedValueOnce({ success: true, path: "storage/photo-2.png" })
      .mockResolvedValueOnce({ success: true, path: "storage/photo-3.webp" });

    await selectFiles(freshInput, [jpegFile, pngFile, webpFile]);

    expect(uploadPhotoActionMock).toHaveBeenCalledTimes(3);
    expect(onUploadSuccess).toHaveBeenLastCalledWith([
      "storage/photo-1.jpeg",
      "storage/photo-2.png",
      "storage/photo-3.webp",
    ]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("retains a photo when connectivity drops during preparation and uploads only on manual retry", async () => {
    const file = new File(["photo"], "retained.jpg", { type: "image/jpeg" });
    let finish!: (file: File) => void;
    const prepare = vi.spyOn(photoPreparation, "prepareMemoryPhoto").mockImplementationOnce(() => new Promise<File>((resolve) => { finish = resolve; }));
    const busy = vi.fn();
    try {
      await act(async () => root?.render(<PhotoUpload onUploadSuccess={vi.fn()} onBusyChange={busy} />));
      await selectFiles(container.querySelector<HTMLInputElement>('input[type="file"]')!, [file]);
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      await act(async () => { window.dispatchEvent(new Event("offline")); finish(file); });
      expect(container.querySelector('img[alt="Selected memory photo"]')).not.toBeNull();
      expect(uploadPhotoActionMock).not.toHaveBeenCalled();
      expect(busy).toHaveBeenLastCalledWith(true);
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      await act(async () => { window.dispatchEvent(new Event("online")); });
      expect(uploadPhotoActionMock).not.toHaveBeenCalled();
      uploadPhotoActionMock.mockResolvedValueOnce({ success: true, path: "storage/retained.jpg" });
      await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Retry photo upload"]')!.click(); });
      expect(uploadPhotoActionMock).toHaveBeenCalledOnce();
      expect(busy).toHaveBeenLastCalledWith(false);
    } finally {
      prepare.mockRestore();
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("releases previews without attempting offline cleanup when a draft closes", async () => {
    await act(async () => root?.render(<PhotoUpload onUploadSuccess={vi.fn()} />));
    uploadPhotoActionMock.mockResolvedValueOnce({ success: true, path: "storage/abandoned.png" });
    await selectFiles(container.querySelector<HTMLInputElement>('input[type="file"]')!, [new File(["photo"], "coffee.png", { type: "image/png" })]);
    deleteTemporaryPhotoActionMock.mockClear();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      act(() => root?.unmount());
      root = null;
      expect(deleteTemporaryPhotoActionMock).not.toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock/coffee.png");
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("calls deleteTemporaryPhotoAction(path) and URL.revokeObjectURL when clicking 'Remove photo'", async () => {
    const onUploadSuccess = vi.fn();
    act(() => {
      root?.render(<PhotoUpload onUploadSuccess={onUploadSuccess} />);
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["data"], "test.png", { type: "image/png" });
    uploadPhotoActionMock.mockResolvedValueOnce({ success: true, path: "storage/temp-pic.png" });
    deleteTemporaryPhotoActionMock.mockResolvedValueOnce({ success: true });

    await selectFiles(input, [file]);

    expect(uploadPhotoActionMock).toHaveBeenCalledTimes(1);
    expect(onUploadSuccess).toHaveBeenLastCalledWith(["storage/temp-pic.png"]);

    const removeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Remove photo"]');
    expect(removeBtn).not.toBeNull();

    await act(async () => {
      removeBtn!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(deleteTemporaryPhotoActionMock).toHaveBeenCalledWith("storage/temp-pic.png");
    expect(revokeObjectURLMock).toHaveBeenCalledWith(expect.stringContaining("blob:mock/test.png"));
    expect(onUploadSuccess).toHaveBeenLastCalledWith([]);
    expect(container.querySelectorAll('button[aria-label="Remove photo"]').length).toBe(0);
  });

  it("calls deleteTemporaryPhotoAction(path) and URL.revokeObjectURL on unmount when disabled={false}, but only calls URL.revokeObjectURL without deleteTemporaryPhotoAction after re-rendering with disabled={true}", async () => {
    const onUploadSuccess = vi.fn();

    // Part 1: Unmounting while disabled={false}
    act(() => {
      root?.render(<PhotoUpload onUploadSuccess={onUploadSuccess} disabled={false} />);
    });

    const input1 = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file1 = new File(["data1"], "test1.jpg", { type: "image/jpeg" });
    uploadPhotoActionMock.mockResolvedValueOnce({ success: true, path: "storage/uncommitted.jpg" });

    await selectFiles(input1, [file1]);
    expect(onUploadSuccess).toHaveBeenLastCalledWith(["storage/uncommitted.jpg"]);

    deleteTemporaryPhotoActionMock.mockClear();
    revokeObjectURLMock.mockClear();

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(deleteTemporaryPhotoActionMock).toHaveBeenCalledWith("storage/uncommitted.jpg");
    expect(revokeObjectURLMock).toHaveBeenCalledWith(expect.stringContaining("blob:mock/test1.jpg"));

    // Part 2: Unmounting after re-rendering with disabled={true} (committed visit)
    root = createRoot(container);
    act(() => {
      root?.render(<PhotoUpload onUploadSuccess={onUploadSuccess} disabled={false} />);
    });

    const input2 = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file2 = new File(["data2"], "test2.jpg", { type: "image/jpeg" });
    uploadPhotoActionMock.mockResolvedValueOnce({ success: true, path: "storage/committed.jpg" });

    await selectFiles(input2, [file2]);
    expect(onUploadSuccess).toHaveBeenLastCalledWith(["storage/committed.jpg"]);

    // Re-render with disabled={true} (as log-visit-form does when isSubmitted becomes true)
    act(() => {
      root?.render(<PhotoUpload onUploadSuccess={onUploadSuccess} disabled={true} />);
    });

    deleteTemporaryPhotoActionMock.mockClear();
    revokeObjectURLMock.mockClear();

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(revokeObjectURLMock).toHaveBeenCalledWith(expect.stringContaining("blob:mock/test2.jpg"));
    expect(deleteTemporaryPhotoActionMock).not.toHaveBeenCalled();
  });
});
