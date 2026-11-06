export interface FeaturedPodcast {
  id: string;
  title: string;
  feedUrl: string;
  artwork: string;
  publisher: string;
}

export const FEATURED_PODCASTS: FeaturedPodcast[] = [
  {
    id: "dino-dome",
    title: "Dino Dome",
    feedUrl: "https://www.abc.net.au/feeds/13961702/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/bf/dd/9b/bfdd9b5d-be83-bd1b-7aa2-3ad9c55f743a/mza_3782818523682766856.jpg/300x300bb.jpg",
    publisher: "ABC Kids Listen",
  },
  {
    id: "imagine-this",
    title: "Imagine This",
    feedUrl: "https://www.abc.net.au/feeds/9612558/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/f1/e5/41/f1e54140-f824-87d6-78b4-04942be2af3c/mza_4496787236745097575.jpg/300x300bb.jpg",
    publisher: "ABC Kids Listen",
  },
  {
    id: "classic-kids",
    title: "ABC Classic Kids",
    feedUrl: "https://www.abc.net.au/feeds/9673426/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/c7/f3/4b/c7f34bfd-8311-2679-42bc-31bcf0e42682/mza_12637824050216393445.jpg/300x300bb.jpg",
    publisher: "ABC Kids Listen",
  },
  {
    id: "gardening-australia-junior",
    title: "Gardening Australia Junior",
    feedUrl: "https://www.abc.net.au/feeds/13536302/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/df/69/70/df6970a0-fd20-f7bc-5642-a5e7a21842fd/mza_3169924198104077014.jpg/300x300bb.jpg",
    publisher: "ABC Kids Listen",
  },
  {
    id: "play-school-ears-on",
    title: "Play School: Ears On",
    feedUrl: "https://www.abc.net.au/feeds/102063562/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/83/ff/a9/83ffa987-2771-c6c8-2db1-8ee3a1637274/mza_8963277260094155779.jpg/300x300bb.jpg",
    publisher: "ABC Kids Listen",
  },
  {
    id: "story-salad",
    title: "Story Salad",
    feedUrl: "https://www.abc.net.au/feeds/102038464/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/d6/28/85/d62885da-fdd9-4457-9417-0c34e0ed7e4d/mza_17863646009731482226.jpg/600x600bb.jpg",
    publisher: "ABC Australia",
  },
  {
    id: "story-salad-quest-mode",
    title: "Story Salad Quest Mode",
    feedUrl: "https://www.abc.net.au/feeds/104794490/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/c7/66/76/c7667695-b10f-123d-fec4-813a04107fed/mza_4925963946249440142.jpg/600x600bb.jpg",
    publisher: "ABC Australia",
  },
  {
    id: "noisy-by-nature",
    title: "Noisy by Nature",
    feedUrl: "https://www.abc.net.au/feeds/11453890/podcast.xml",
    artwork: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/c0/4f/14/c04f14fb-fb2d-599f-a299-b3649b6f101a/mza_17700065971896278745.jpg/600x600bb.jpg",
    publisher: "ABC Australia",
  },
];
