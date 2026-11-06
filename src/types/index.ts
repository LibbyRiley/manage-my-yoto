export interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  artworkUrl: string;
  feedUrl: string;
  episodeCount: number;
}

export interface Episode {
  guid: string;
  title: string;
  description: string;
  pubDate: string;
  duration: string;
  audioUrl: string;
  artworkUrl?: string;
  selected: boolean;
}

export interface YotoIcon {
  id: string;
  source: "yoto-library" | "ai-generated" | "artwork-downscale" | "emoji" | "game-icons" | "yotoicons-com" | "custom" | "user-icon";
  title: string;
  tags: string[];
  url: string;
  previewDataUrl?: string;
  reason?: string;
}

export interface IconSelection {
  episodeGuid: string;
  candidates: YotoIcon[];
  selectedIconId: string | null;
}

export interface YotoCard {
  cardId: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  description?: string;
}

export interface PlaylistTrack {
  key: string;
  title: string;
  trackUrl: string;
  iconRef: string;
  iconPreviewUrl?: string;
  episodeGuid?: string;
  sourceAudioUrl?: string;
  trimStart?: number;
  trimEnd?: number;
  duration?: number;
  fileSize?: number;
  channels?: string;
  format?: string;
}

export type WizardStep = "connect" | "library" | "icon-library" | "editor" | "search" | "episodes" | "icons" | "review";
