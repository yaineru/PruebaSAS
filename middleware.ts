import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Validates the real Supabase session (not just cookie presence) on every
// request. This is required, not optional: a stale/invalid-but-present
// auth cookie (e.g. right after sign-up with email confirmation pending, or
// any expired session the browser hasn't cleared yet) used to cause an
// infinite redirect loop between "/" and "/login" - the page-level
// getTenantContext() correctly saw no valid user and redirected to
// "/login", while this middleware only checked cookie *presence*, saw one,
// and bounced straight back to "/". Calling getUser() here validates the
// token against Supabase and lets the ssr cookie adapter clear/refresh it
// on the response, which breaks that loop at the source.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register") ||
    // Supabase invite/recovery links redirect here with the session tokens
    // in the URL fragment (#access_token=...), which never reaches this
    // middleware (fragments are client-only) - so at the point this request
    // arrives there's no cookie yet and no way to know a session is coming.
    // Treated the same as /login: unauthenticated visitors are let through,
    // and an already-authenticated visitor is bounced to "/" below.
    request.nextUrl.pathname.startsWith("/aceptar-invitacion");
  // /calendar/public/{token} is a deliberately unauthenticated availability
  // page (see app/calendar/public/[token]/page.tsx) - it must never bounce
  // to /login, and it isn't an "auth route" either (a logged-in visitor
  // opening someone else's share link should still see the public page, not
  // get redirected back to "/").
  const isPublicRoute = request.nextUrl.pathname.startsWith("/calendar/public");
  const isAppRoute = !isAuthRoute && !isPublicRoute && !request.nextUrl.pathname.startsWith("/api");

  if (!user && isAppRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"
  ]
};
