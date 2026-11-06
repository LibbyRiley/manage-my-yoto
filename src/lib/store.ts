import { create } from "zustand";
import type {
  Podcast,
  Episode,
  IconSelection,
  YotoIcon,
  WizardStep,
  YotoCard,
  PlaylistTrack,
} from "@/types";

interface AppState {
  step: WizardStep;
  setStep: (step: WizardStep) => void;

  podcast: Podcast | null;
  setPodcast: (podcast: Podcast | null) => void;

  episodes: Episode[];
  setEpisodes: (episodes: Episode[]) => void;
  toggleEpisode: (guid: string) => void;
  selectedEpisodes: () => Episode[];

  iconSelections: IconSelection[];
  setIconSelections: (selections: IconSelection[]) => void;
  upsertIconSelection: (episodeGuid: string, icons: YotoIcon[], defaultIconId: string | null) => void;
  selectIcon: (episodeGuid: string, iconId: string) => void;

  selectedCard: YotoCard | null;
  setSelectedCard: (card: YotoCard | null) => void;

  yotoLoggedIn: boolean;
  setYotoLoggedIn: (loggedIn: boolean) => void;

  playerUrl: string | null;
  playerTitle: string;
  setPlayer: (url: string, title: string) => void;
  clearPlayer: () => void;

  playlistTracks: PlaylistTrack[];
  editingCardId: string | null;
  editingTrackKey: string | null;
  // Snapshot of the last server-known state for the loaded card. Used to detect
  // unsaved changes (`isDirty` in PlaylistEditor). Lives here, not in component
  // state, so it survives navigation to /editor/[cardId]/tracks/new etc.
  savedSnapshot: string | null;
  setSavedSnapshot: (s: string | null) => void;
  setPlaylistTracks: (tracks: PlaylistTrack[]) => void;
  appendPlaylistTracks: (tracks: PlaylistTrack[]) => void;
  removePlaylistTrack: (key: string) => void;
  updatePlaylistTrack: (key: string, update: Partial<PlaylistTrack>) => void;
  editingAllTrackIcons: boolean;
  setEditingCardId: (id: string | null) => void;
  setEditingTrackKey: (key: string | null) => void;
  setEditingAllTrackIcons: (v: boolean) => void;

  uploadAudioToYoto: boolean;
  setUploadAudioToYoto: (v: boolean) => void;

  resolvedIconsByGuid: Record<string, { iconRef: string; iconPreviewUrl?: string }>;
  setResolvedIconsByGuid: (m: Record<string, { iconRef: string; iconPreviewUrl?: string }>) => void;

  reset: () => void;
}

const UPLOAD_AUDIO_KEY = "uploadAudioToYoto";
function readUploadAudioPref(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(UPLOAD_AUDIO_KEY) !== "false";
}

function dedupeIcons(icons: YotoIcon[]): YotoIcon[] {
  const seen = new Set<string>();
  return icons.filter((icon) => {
    const key = icon.previewDataUrl ?? icon.url ?? icon.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  step: "connect",
  setStep: (step) => set({ step }),

  podcast: null,
  setPodcast: (podcast) => set({ podcast }),

  episodes: [],
  setEpisodes: (episodes) => set({ episodes }),
  toggleEpisode: (guid) =>
    set((state) => ({
      episodes: state.episodes.map((ep) =>
        ep.guid === guid ? { ...ep, selected: !ep.selected } : ep
      ),
    })),
  selectedEpisodes: () => get().episodes.filter((ep) => ep.selected),

  iconSelections: [],
  setIconSelections: (selections) =>
    set({
      iconSelections: selections.map((s) => ({
        ...s,
        candidates: dedupeIcons(s.candidates),
      })),
    }),
  upsertIconSelection: (episodeGuid, icons, defaultIconId) =>
    set((state) => {
      const deduped = dedupeIcons(icons);
      const existing = state.iconSelections.find((s) => s.episodeGuid === episodeGuid);
      if (existing) {
        return {
          iconSelections: state.iconSelections.map((s) =>
            s.episodeGuid === episodeGuid
              ? { ...s, candidates: dedupeIcons([...s.candidates, ...deduped]) }
              : s
          ),
        };
      }
      return {
        iconSelections: [
          ...state.iconSelections,
          { episodeGuid, candidates: deduped, selectedIconId: defaultIconId },
        ],
      };
    }),
  selectIcon: (episodeGuid, iconId) =>
    set((state) => ({
      iconSelections: state.iconSelections.map((sel) =>
        sel.episodeGuid === episodeGuid
          ? { ...sel, selectedIconId: iconId }
          : sel
      ),
    })),

  selectedCard: null,
  setSelectedCard: (card) => set({ selectedCard: card }),

  yotoLoggedIn: false,
  setYotoLoggedIn: (loggedIn) => set({ yotoLoggedIn: loggedIn }),

  playerUrl: null,
  playerTitle: "",
  setPlayer: (url, title) => set({ playerUrl: url, playerTitle: title }),
  clearPlayer: () => set({ playerUrl: null, playerTitle: "" }),

  playlistTracks: [],
  editingCardId: null,
  editingTrackKey: null,
  savedSnapshot: null,
  setSavedSnapshot: (s) => set({ savedSnapshot: s }),
  setPlaylistTracks: (tracks) => set({ playlistTracks: tracks }),
  appendPlaylistTracks: (tracks) =>
    set((state) => ({ playlistTracks: [...state.playlistTracks, ...tracks] })),
  removePlaylistTrack: (key) =>
    set((state) => ({ playlistTracks: state.playlistTracks.filter((t) => t.key !== key) })),
  updatePlaylistTrack: (key, update) =>
    set((state) => ({
      playlistTracks: state.playlistTracks.map((t) => t.key === key ? { ...t, ...update } : t),
    })),
  editingAllTrackIcons: false,
  setEditingCardId: (id) => set({ editingCardId: id }),
  setEditingTrackKey: (key) => set({ editingTrackKey: key }),
  setEditingAllTrackIcons: (v) => set({ editingAllTrackIcons: v }),

  uploadAudioToYoto: readUploadAudioPref(),
  setUploadAudioToYoto: (v) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UPLOAD_AUDIO_KEY, v ? "true" : "false");
    }
    set({ uploadAudioToYoto: v });
  },

  resolvedIconsByGuid: {},
  setResolvedIconsByGuid: (m) => set({ resolvedIconsByGuid: m }),

  reset: () =>
    set({
      step: "connect",
      podcast: null,
      episodes: [],
      iconSelections: [],
      selectedCard: null,
      playlistTracks: [],
      editingCardId: null,
      editingTrackKey: null,
      savedSnapshot: null,
      resolvedIconsByGuid: {},
      editingAllTrackIcons: false,
      playerUrl: null,
      playerTitle: "",
    }),
}));
