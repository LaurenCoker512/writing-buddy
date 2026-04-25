import { auth } from "@/auth";
import { NextResponse } from "next/server";

const protectedPaths = ["/dashboard", "/settings"];

export default auth((req) => {
  const isProtected = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
