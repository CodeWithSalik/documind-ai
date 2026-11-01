import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 Network Boundary Proxy
 * Handles edge security headers, request tracing, and CORS policies.
 */
export default async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
}
