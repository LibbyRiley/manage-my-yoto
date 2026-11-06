import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

function base64url(buffer: Buffer): string {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function GET() {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.YOTO_CLIENT_ID!,
    redirect_uri: process.env.YOTO_REDIRECT_URI || "http://localhost:3000/api/yoto/callback",
    scope: "user:icons:manage family:library:view user:content:view user:content:manage",
    audience: "https://api.yotoplay.com",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://login.yotoplay.com/authorize?${params}`
  );
  response.cookies.set("yoto_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
