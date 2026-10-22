import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return {
      response: NextResponse.next({ request }),
      userId: null,
    };
  }

  try {
    const { publishableKey, url } = getSupabaseConfig();
    let response = NextResponse.next({ request });

    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, options, value }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      response,
      userId: user?.id ?? null,
    };
  } catch {
    return {
      response: NextResponse.next({ request }),
      userId: null,
    };
  }
}

