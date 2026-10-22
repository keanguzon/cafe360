export function getSafeRedirectPath(
  input: string | null,
  trustedOrigin: string,
  fallback = "/map",
): string {
  if (!input?.startsWith("/") || input.startsWith("//") || /[\u0000-\u0020\u007f\\]/.test(input)) {
    return fallback;
  }

  const rawPath = input.split(/[?#]/, 1)[0];
  if (/%(?:2f|5c|25)/i.test(rawPath)) return fallback;

  try {
    decodeURIComponent(input);
    const base = new URL(trustedOrigin);
    const destination = new URL(input, base.origin);
    if (destination.origin !== base.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
