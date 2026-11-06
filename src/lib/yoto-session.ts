import { cookies } from "next/headers";

const COOKIE_NAME = "yoto_token";

export function getYotoToken(): string | null {
  try {
    return cookies().get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

// Only used by the callback route — all other code reads via getYotoToken()
export function YOTO_TOKEN_COOKIE() {
  return COOKIE_NAME;
}
