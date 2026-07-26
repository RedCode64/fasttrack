import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Per-request Content-Security-Policy.
 *
 * `strict-dynamic` plus a nonce means only scripts we stamped can run, and only
 * they can pull in more — an injected `<script>` has no nonce and is refused.
 * Next reads the nonce off the request header and applies it to its own inline
 * bootstrap, so this holds without listing a single script hash.
 *
 * `style-src` still needs `unsafe-inline`: the dashboard styles elements with
 * React `style` props, which server-render as literal `style="…"` attributes.
 * That is a far smaller surface than inline script, and there is no path for a
 * user string to reach a style attribute here.
 *
 * Dev additionally needs `unsafe-eval` and a websocket origin for HMR.
 */
function buildCsp(nonce: string, supabaseUrl: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${supabaseUrl}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl}${IS_DEV ? " ws: wss:" : ""}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];
  if (!IS_DEV) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/**
 * Refreshes the Supabase session cookie on every request, applies the CSP, and
 * gates routes: signed-out users land on /login; signed-in users never see
 * /login again. The no-org → /onboarding redirect lives in the dashboard layout
 * (needs a DB query, which does not belong in middleware).
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce, supabaseUrl);

  // Next picks the nonce up from the request headers and stamps it onto the
  // scripts it renders, so it must be set before the response is built.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const nextOptions = { request: { headers: requestHeaders } };
  let response = NextResponse.next(nextOptions);

  const supabase = createServerClient(supabaseUrl, requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next(nextOptions);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // Publicly reachable without auth: App Store review needs the legal pages to
  // load for a signed-out reviewer, and /auth/* is where emailed recovery links
  // land — they arrive without a session, which is the point of them.
  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/support");

  if (!user && !isPublicRoute) {
    return redirectWithCsp(request, "/login", csp);
  }
  if (user && isAuthRoute) {
    return redirectWithCsp(request, "/", csp);
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/** Redirects carry the CSP too — no response should leave without one. */
function redirectWithCsp(request: NextRequest, pathname: string, csp: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  redirect.headers.set("Content-Security-Policy", csp);
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
