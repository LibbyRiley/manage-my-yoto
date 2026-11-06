import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { getYotoToken } from "@/lib/yoto-session";
import { trackRefPath } from "@/lib/audio-cache";
import { probeAudio } from "@/lib/ffprobe";
import { buildCardBody, type CardEpisode } from "@/lib/yoto-card-body";

async function buildMediaIdToUrlMap(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const [pubRes, userRes] = await Promise.allSettled([
    fetch("https://api.yotoplay.com/media/displayIcons/user/yoto", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch("https://api.yotoplay.com/media/displayIcons/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);
  for (const result of [pubRes, userRes]) {
    if (result.status === "fulfilled" && result.value.ok) {
      const d = await result.value.json();
      for (const ic of d.displayIcons ?? []) {
        if (ic.mediaId && ic.url) map.set(ic.mediaId, ic.url);
      }
    }
  }
  return map;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const token = getYotoToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [cardRes, iconMap] = await Promise.all([
    fetch(`https://api.yotoplay.com/content/${params.cardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    buildMediaIdToUrlMap(token),
  ]);

  if (!cardRes.ok) return NextResponse.json({ error: `Yoto API error: ${cardRes.status}` }, { status: cardRes.status });

  const data = await cardRes.json();
  const card = data.card ?? data;

  const chapters = await Promise.all(((card.content?.chapters ?? []) as any[]).map(async (ch) => {
    const iconRef: string = ch.display?.icon16x16 ?? ch.display?.iconUrl16x16 ?? "";
    let iconPreviewUrl: string | undefined;
    if (iconRef.startsWith("http")) {
      iconPreviewUrl = iconRef;
    } else if (iconRef.startsWith("yoto:#")) {
      iconPreviewUrl = iconMap.get(iconRef.slice(6));
    }
    const firstTrack = ch.tracks?.[0];
    const trackUrl: string = firstTrack?.trackUrl ?? "";
    const rawDur = firstTrack?.duration ?? firstTrack?.trackLength ?? ch.duration;
    let duration = typeof rawDur === "number" && rawDur > 0 ? rawDur : undefined;
    const rawSize = firstTrack?.fileSize ?? ch.fileSize;
    let fileSize = typeof rawSize === "number" && rawSize > 0 ? rawSize : undefined;
    let channels = typeof firstTrack?.channels === "string" ? firstTrack.channels : undefined;
    let format = typeof firstTrack?.format === "string" ? firstTrack.format : undefined;

    // Fill in any fields Yoto didn't return by ffprobing the locally-cached
    // file (saved at upload time). Older saves missed `channels`/`format` so
    // this lets a plain Save-to-Yoto round-trip recover them without re-uploading.
    if (trackUrl.startsWith("yoto:#") && (!channels || !format || !duration || !fileSize)) {
      const cached = trackRefPath(trackUrl);
      if (cached && existsSync(cached)) {
        const probed = await probeAudio(cached);
        if (!duration && probed.duration) duration = probed.duration;
        if (!channels && probed.channels) channels = probed.channels;
        if (!format && probed.format) format = probed.format;
        if (!fileSize) {
          try {
            const { stat } = await import("fs/promises");
            const s = await stat(cached);
            fileSize = s.size > 0 ? s.size : fileSize;
          } catch { /* ignore */ }
        }
      }
    }

    return {
      key: ch.key,
      title: ch.title ?? "",
      iconRef,
      iconPreviewUrl,
      trackUrl,
      duration,
      fileSize,
      channels,
      format,
    };
  }));

  const coverImage = card.metadata?.cover?.imageL ?? card.metadata?.cover?.imageS ?? null;
  const description: string = card.metadata?.description ?? "";
  // Surface metadata.media for diagnostics — device playback may depend on this aggregate.
  const metadataMedia = card.metadata?.media ?? null;
  const contentMeta = {
    activity: card.content?.activity ?? null,
    version: card.content?.version ?? null,
    hasConfig: card.content?.config !== undefined,
  };
  return NextResponse.json({ cardId: card.cardId, title: card.title, slug: card.slug ?? "", coverImage, description, chapters, metadataMedia, contentMeta });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const token = getYotoToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { title, description, coverMediaUrl, episodes } = await req.json() as {
    title: string;
    description?: string;
    coverMediaUrl?: string;
    episodes: CardEpisode[];
  };

  const body = buildCardBody({ cardId: params.cardId, title, description, coverMediaUrl, episodes });
  console.log(`[cards/post] sending body for ${params.cardId}:`, JSON.stringify(body, null, 2));
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

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const token = getYotoToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const res = await fetch(`https://api.yotoplay.com/content/${params.cardId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}
