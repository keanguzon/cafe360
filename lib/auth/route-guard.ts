const authRoutes = new Set(["/login", "/signup", "/forgot-password"]);
const publicRoutes = new Set(["/callback"]);
const publicAppAssets = new Set([
  "/offline.html", "/icons/cafe360.svg", "/icon-192.png", "/icon-512.png",
  "/apple-touch-icon.png", "/apple-touch-icon-precomposed.png", "/manifest.webmanifest", "/sw.js", "/favicon.ico",
]);
export function isPublicAppAsset(pathname: string) { return publicAppAssets.has(pathname); }
// Routes that redirect logged-in users to /map (remember me / auto-redirect)
const loggedInRedirectRoutes = new Set(["/login", "/signup", "/forgot-password", "/"]);

export function getAuthRouteRedirect(pathname: string, isAuthenticated: boolean, search = ""): string | null {
  const isAuthRoute = authRoutes.has(pathname);
  const isLandingOrAuth = loggedInRedirectRoutes.has(pathname);
  const isPublicRoute =
    isPublicAppAsset(pathname) ||
    pathname === "/" ||
    publicRoutes.has(pathname) ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/api");

  // Auto-redirect logged-in users away from login/signup/landing to dashboard
  if (isAuthenticated && isLandingOrAuth) {
    return "/map";
  }

  if (isPublicRoute || isAuthRoute) {
    return null;
  }

  if (!isAuthenticated) {
    return `/login?next=${encodeURIComponent(pathname + search)}`;
  }

  return null;
}
