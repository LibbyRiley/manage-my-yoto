import { NextRequest, NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";
import { buildCardBody, type CardEpisode } from "@/lib/yoto-card-body";

export async function POST(req: NextRequest) {
  const token = getYotoToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated with Yoto" }, { status: 401 });
  }

  const { title, description, coverMediaUrl, episodes } = await req.json() as {
    title: string;
    description?: string;
    coverMediaUrl?: string;
    episodes: CardEpisode[];
  };

  const body = buildCardBody({ title, description, coverMediaUrl, episodes });
  console.log(`[cards/post] creating new card:`, JSON.stringify(body, null, 2));

  const res = await fetch("https://api.yotoplay.com/content", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  console.log(`[cards/post] Yoto response ${res.status}:`, responseText.slice(0, 2000));
  if (!res.ok) {
    return NextResponse.json({ error: responseText }, { status: res.status });
  }

  const data = JSON.parse(responseText);
  return NextResponse.json({ success: true, cardId: data.card?.cardId ?? data.cardId });
}

export async function GET() {
  const token = getYotoToken();
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated with Yoto" },
      { status: 401 }
    );
  }

  try {
    const res = await fetch("https://api.yotoplay.com/content/mine", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch cards: ${res.status}`);
    }

    const data = await res.json();
    const cards = (data.cards || []).map((card: {
      cardId: string; title: string; slug: string; cardType?: string;
      metadata?: { cover?: { imageL?: string; imageS?: string } };
      content?: { chapters?: unknown[] };
    }) => ({
      cardId: card.cardId,
      title: card.title || "Untitled Card",
      slug: card.slug || "",
      cardType: card.cardType || "",
      coverImage: card.metadata?.cover?.imageL ?? card.metadata?.cover?.imageS ?? null,
      trackCount: card.content?.chapters?.length ?? null,
    }));

    return NextResponse.json({ cards });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch cards";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
