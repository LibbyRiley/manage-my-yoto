import { NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";

export async function GET() {
  return NextResponse.json({ connected: !!getYotoToken() });
}
