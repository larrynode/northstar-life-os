import { NextRequest, NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function isLocalOrigin(value: string | null, request: NextRequest): boolean {
  if (!value) return true;
  try {
    const origin = new URL(value);
    return LOCAL_HOSTS.has(origin.hostname) && origin.port === request.nextUrl.port;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const origin = request.headers.get("origin");
  if (!LOCAL_HOSTS.has(host) || !isLocalOrigin(origin, request)) return new NextResponse("Local access only", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=() ");
  response.headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

export default proxy;
