import { NextRequest, NextResponse } from "next/server";
import { convertToYotoIcon, replaceBlackPixelsInBuffer } from "@/lib/image-processing";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const yotoIcon = await convertToYotoIcon(buffer);
    const safeIcon = await replaceBlackPixelsInBuffer(yotoIcon);
    const dataUrl = `data:image/png;base64,${safeIcon.toString("base64")}`;

    return NextResponse.json({ dataUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Conversion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
