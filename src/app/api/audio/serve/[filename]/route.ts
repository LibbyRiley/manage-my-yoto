import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const DOWNLOADS_DIR = join(process.cwd(), "downloads");

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Strip path separators to prevent directory traversal
  const filename = params.filename.replace(/[/\\]/g, "");
  const filePath = join(DOWNLOADS_DIR, filename);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
