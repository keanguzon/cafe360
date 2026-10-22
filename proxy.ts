import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getAuthRouteRedirect, isPublicAppAsset } from "@/lib/auth/route-guard";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  if (isPublicAppAsset(request.nextUrl.pathname) || !hasSupabaseConfig()) return NextResponse.next({ request });
  const { response, userId } = await updateSession(request);
  const redirectPath = getAuthRouteRedirect(request.nextUrl.pathname, Boolean(userId), request.nextUrl.search);

  if (redirectPath) {
    const redirectUrl = request.nextUrl.clone();
    const [path, query] = redirectPath.split("?");
    redirectUrl.pathname = path;
    redirectUrl.search = query ? `?${query}` : "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$).*)",
  ],
};
