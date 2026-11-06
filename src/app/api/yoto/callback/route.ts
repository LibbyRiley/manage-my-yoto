import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/?yoto_error=${error ?? "auth_failed"}`, request.url));
  }

  const codeVerifier = request.cookies.get("yoto_code_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(new URL("/?yoto_error=missing_verifier", request.url));
  }

  try {
    const tokenRes = await fetch("https://login.yotoplay.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.YOTO_CLIENT_ID!,
        code,
        code_verifier: codeVerifier,
        redirect_uri: process.env.YOTO_REDIRECT_URI || "http://localhost:3000/api/yoto/callback",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Yoto token exchange failed:", err);
      return NextResponse.redirect(new URL("/?yoto_error=token_failed", request.url));
    }

    const { access_token } = await tokenRes.json();

    const response = NextResponse.redirect(new URL("/?yoto_connected=1", request.url));
    response.cookies.set("yoto_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });
    response.cookies.delete("yoto_code_verifier");
    return response;
  } catch (err) {
    console.error("Yoto OAuth callback error:", err);
    return NextResponse.redirect(new URL("/?yoto_error=exception", request.url));
  }
}
