export interface CardEpisode {
  key: string;
  title: string;
  trackUrl: string;
  iconRef: string;
  duration?: number;
  fileSize?: number;
  channels?: string;
  format?: string;
}

export interface BuildCardBodyOptions {
  cardId?: string;
  title: string;
  description?: string;
  coverMediaUrl?: string;
  episodes: CardEpisode[];
}

function iconDisplay(ref: string) {
  if (!ref) return undefined;
  if (ref.startsWith("http")) return { iconUrl16x16: ref };
  if (ref.startsWith("yoto:#") && ref.length > 6) return { icon16x16: ref };
  return undefined;
}

// Yoto's official app uses 3-digit zero-padded keys ("001", "002"). The
// hardware device firmware appears to require this format to locate
// downloaded files; non-conformant keys (e.g. "01") cause downloads to
// complete but playback to silently fail.
export function buildCardBody({ cardId, title, description, coverMediaUrl, episodes }: BuildCardBodyOptions): Record<string, unknown> {
  const chapters = episodes.map((ep, idx) => {
    const display = iconDisplay(ep.iconRef);
    const isUploaded = ep.trackUrl?.startsWith("yoto:#");
    const isStream = !isUploaded;
    const paddedKey = String(idx + 1).padStart(3, "0");
    const audioMeta = isUploaded
      ? {
          ...(typeof ep.duration === "number" && ep.duration > 0 ? { duration: Math.round(ep.duration) } : {}),
          ...(typeof ep.fileSize === "number" && ep.fileSize > 0 ? { fileSize: ep.fileSize } : {}),
          ...(ep.channels ? { channels: ep.channels } : {}),
        }
      : {};
    const chapterDuration = typeof ep.duration === "number" && ep.duration > 0 ? Math.round(ep.duration) : undefined;
    const chapterFileSize = typeof ep.fileSize === "number" && ep.fileSize > 0 ? ep.fileSize : undefined;
    return {
      key: paddedKey,
      title: ep.title,
      overlayLabel: paddedKey,
      hasStreams: isStream,
      ...(chapterDuration !== undefined ? { duration: chapterDuration } : {}),
      ...(chapterFileSize !== undefined ? { fileSize: chapterFileSize } : {}),
      tracks: [{
        key: paddedKey,
        type: isUploaded ? "audio" : "stream",
        // Yoto's transcoder always outputs opus/ogg for uploaded audio (verified
        // in the transcoded poll response). The hardware device decodes by this
        // field, so it must be "opus" for any yoto:#<sha> reference, regardless
        // of what was stored on a previous (broken) save.
        format: isUploaded ? "opus" : (ep.format ?? "mp3"),
        title: ep.title,
        trackUrl: ep.trackUrl,
        ...audioMeta,
        ...(display ? { display } : {}),
      }],
      ...(display ? { display } : {}),
    };
  });

  const totalDuration = episodes.reduce((sum, ep) => sum + (typeof ep.duration === "number" && ep.duration > 0 ? Math.round(ep.duration) : 0), 0);
  const totalFileSize = episodes.reduce((sum, ep) => sum + (typeof ep.fileSize === "number" && ep.fileSize > 0 ? ep.fileSize : 0), 0);
  const hasStreams = episodes.some((ep) => !ep.trackUrl?.startsWith("yoto:#"));
  const readableFileSize = totalFileSize > 0 ? Number((totalFileSize / 1024 / 1024).toFixed(1)) : 0;

  const body: Record<string, unknown> = {
    title,
    content: {
      activity: "yoto_Player",
      config: {},
      version: "1",
      chapters,
    },
  };
  if (cardId) body.cardId = cardId;
  const metadata: Record<string, unknown> = {
    media: {
      duration: totalDuration,
      fileSize: totalFileSize,
      hasStreams,
      readableFileSize,
    },
  };
  if (coverMediaUrl) metadata.cover = { imageL: coverMediaUrl };
  if (description !== undefined) metadata.description = description;
  body.metadata = metadata;
  return body;
}
