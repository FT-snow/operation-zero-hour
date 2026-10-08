import { NextResponse, type NextRequest } from "next/server";

// UX-level route gating only. Real enforcement is server-side in Convex.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("ozh_token")?.value;
  const role = req.cookies.get("ozh_role")?.value;

  const teamPages = ["/story", "/round-3", "/round-4", "/round-5"];
  const adminPages = ["/admin"];

  // Team pages: need team-role session
  if (teamPages.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!token || role !== "team") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Admin pages: need admin-role session (admin/login itself is exempt)
  if (adminPages.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (pathname === "/admin/login") {
      if (token && role === "admin") {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    if (!token || role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/story/:path*", "/round-3/:path*", "/round-4/:path*", "/round-5/:path*", "/admin/:path*", "/admin"],
};
