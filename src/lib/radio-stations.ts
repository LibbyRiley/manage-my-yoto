export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  category: "Australia" | "Kids" | "Public Radio" | "Music";
  description?: string;
}

export const PRESET_STATIONS: RadioStation[] = [
  // ── Australia ──────────────────────────────────────────────────
  {
    id: "abc-kids-listen",
    name: "ABC Kids Listen",
    streamUrl: "http://live-radio01.mediahubaustralia.com/XTDW/aac/",
    category: "Australia",
    description: "ABC's dedicated kids station — stories, songs & shows",
  },
  {
    id: "abc-classic",
    name: "ABC Classic",
    streamUrl: "http://live-radio01.mediahubaustralia.com/CLSW/aac/",
    category: "Australia",
    description: "Classical music from the Australian Broadcasting Corporation",
  },
  {
    id: "abc-classic-2",
    name: "ABC Classic 2",
    streamUrl: "http://live-radio01.mediahubaustralia.com/FM2W/aac/",
    category: "Australia",
    description: "Deep cuts, rarities & extended works",
  },
  {
    id: "abc-jazz",
    name: "ABC Jazz",
    streamUrl: "http://live-radio01.mediahubaustralia.com/JAZW/aac/",
    category: "Australia",
    description: "Australia's home of jazz, blues & soul",
  },
  {
    id: "triple-j",
    name: "Triple J",
    streamUrl: "http://live-radio01.mediahubaustralia.com/2TJW/aac/",
    category: "Australia",
    description: "ABC's youth radio — indie, alternative & new music",
  },
  {
    id: "double-j",
    name: "Double J",
    streamUrl: "http://live-radio01.mediahubaustralia.com/2DJW/aac/",
    category: "Australia",
    description: "Australian music, deeper cuts for grown-up J fans",
  },
  {
    id: "abc-radio-national",
    name: "ABC Radio National",
    streamUrl: "http://live-radio01.mediahubaustralia.com/RNAW/aac/",
    category: "Australia",
    description: "Ideas, arts, science & culture from the ABC",
  },
  {
    id: "abc-news-radio",
    name: "ABC News Radio",
    streamUrl: "http://live-radio01.mediahubaustralia.com/PBW/aac/",
    category: "Australia",
    description: "24-hour news from the ABC",
  },

  // ── Kids ───────────────────────────────────────────────────────
  {
    id: "fun-kids",
    name: "Fun Kids",
    streamUrl: "https://listen-funkids.sharp-stream.com/funkids.mp3",
    category: "Kids",
    description: "UK kids radio — pop hits, stories & shows",
  },
  {
    id: "fun-kids-junior",
    name: "Fun Kids Junior",
    streamUrl: "https://listen-funkids.sharp-stream.com/funkidsjunior.mp3",
    category: "Kids",
    description: "Gentler shows for younger listeners",
  },
  {
    id: "kpr-pipsqueaks",
    name: "Kids Public Radio – Pipsqueaks",
    streamUrl: "http://kidspublicradio2.got.net:8000/pipsqueaks",
    category: "Kids",
    description: "Upbeat kids music — no ads",
  },
  {
    id: "kpr-jabberwocky",
    name: "Kids Public Radio – Jabberwocky",
    streamUrl: "http://kidspublicradio.got.net:8000/jabberwocky",
    category: "Kids",
    description: "Stories, poems & imaginative audio for kids",
  },
  {
    id: "kpr-lullaby",
    name: "Kids Public Radio – Lullaby",
    streamUrl: "http://kidspublicradio2.got.net:8000/lullaby",
    category: "Kids",
    description: "Soothing songs for sleep & quiet time",
  },
  {
    id: "radioart-kids",
    name: "Radio Art – Music for Kids",
    streamUrl: "https://live.radioart.com/fMusic_for_kids.mp3",
    category: "Kids",
    description: "Cheerful instrumental kids music",
  },
  {
    id: "radioart-disney",
    name: "Radio Art – Disney Music",
    streamUrl: "https://live.radioart.com/fDisney.mp3",
    category: "Kids",
    description: "Disney film & show music",
  },
  {
    id: "keys-for-kids",
    name: "Keys for Kids",
    streamUrl: "https://radio.keysforkids.org/stream",
    category: "Kids",
    description: "Bible stories & Christian music for children",
  },

  // ── Public Radio ───────────────────────────────────────────────
  {
    id: "yourclassical",
    name: "YourClassical (APM)",
    streamUrl: "https://ycradio.stream.publicradio.org/ycradio.aac",
    category: "Public Radio",
    description: "American Public Media — classical music, no talk",
  },
  {
    id: "the-current",
    name: "The Current (MPR)",
    streamUrl: "https://cms.stream.publicradio.org/cms.aac",
    category: "Public Radio",
    description: "Minnesota Public Radio — indie, alternative & new music",
  },
];

export const STATION_CATEGORIES = ["Australia", "Kids", "Public Radio", "Music"] as const;
export type StationCategory = typeof STATION_CATEGORIES[number];
