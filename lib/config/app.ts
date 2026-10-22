type AppUrlEnvironment = {
  NEXT_PUBLIC_APP_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  NODE_ENV?: string;
};

const invalidUrlMessage =
  "Invalid app URL: use an http or https origin with no credentials, query, fragment, or non-root path.";

export function getAppUrl(env: AppUrlEnvironment): string {
  const configuredUrl = env.NEXT_PUBLIC_APP_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredUrl) {
    if (env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
    }

    return "http://localhost:3000";
  }

  if (!/^https?:\/\//i.test(configuredUrl)) {
    throw new Error(invalidUrlMessage);
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error(invalidUrlMessage);
  }

  const authority = configuredUrl.match(/^https?:\/\/([^/?#]*)/i)?.[1] ?? "";
  const originalPath = configuredUrl.match(/^https?:\/\/[^/?#\\]*([^?#]*)/i)?.[1];
  const hasCredentials = Boolean(url.username || url.password || authority.includes("@"));
  const hasQueryOrFragment = configuredUrl.includes("?") || configuredUrl.includes("#");

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    hasCredentials ||
    hasQueryOrFragment ||
    (originalPath !== "" && originalPath !== "/") ||
    url.pathname !== "/"
  ) {
    throw new Error(invalidUrlMessage);
  }

  return url.origin;
}
