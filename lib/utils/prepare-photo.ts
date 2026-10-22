const SOURCE_MAX_BYTES = 5 * 1024 * 1024;
const TRANSPORT_MAX_BYTES = 3 * 1024 * 1024;

export async function prepareMemoryPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > SOURCE_MAX_BYTES) {
    throw new Error("Choose JPEG, PNG or WebP photos up to 5 MB each.");
  }
  if (file.size <= TRANSPORT_MAX_BYTES) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not open this photo. Choose another image."));
      image.src = url;
    });
    if (!image.width || !image.height || image.width * image.height > 16_000_000) {
      throw new Error("Photo dimensions are too large. Choose a smaller image.");
    }
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this photo. Choose another image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Leave multipart overhead below Vercel's 4.5 MB function payload limit.
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size > 0 && blob.size <= TRANSPORT_MAX_BYTES) {
        return new File([blob], "memory.jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("Could not reduce this photo for upload. Choose a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
