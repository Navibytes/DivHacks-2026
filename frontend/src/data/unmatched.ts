// Saved videos where the AI couldn't figure out the location.
// Sample data for the demo. Later this can come from the backend.

export type VideoPlatform = "tiktok" | "instagram" | "youtube";

export interface UnmatchedVideo {
  id: string;
  platform: VideoPlatform;
  url: string;
  creator: string;
  caption: string;
  savedAgo: string;
  // What the AI picked up from the video, even though it couldn't pin a spot
  aiClue: string;
}

export const unmatchedVideos: UnmatchedVideo[] = [
  {
    id: "v1",
    platform: "tiktok",
    url: "https://www.tiktok.com/@nyceats/video/1",
    creator: "@nyceats",
    caption: "the BEST hidden dumpling spot 🥟 no sign outside, you just have to know",
    savedAgo: "2 days ago",
    aiClue: "Food spot, maybe Chinatown. No name or sign shown.",
  },
  {
    id: "v2",
    platform: "instagram",
    url: "https://www.instagram.com/reel/abc123/",
    creator: "@citywalks",
    caption: "rooftop sunset vibes ✨ pov: you found the city's best view",
    savedAgo: "4 days ago",
    aiClue: "Rooftop with a Midtown skyline view. Several bars look similar.",
  },
  {
    id: "v3",
    platform: "tiktok",
    url: "https://www.tiktok.com/@bookish.nyc/video/2",
    creator: "@bookish.nyc",
    caption: "cozy used bookstore with a cat 🐈📚",
    savedAgo: "1 week ago",
    aiClue: "Bookstore. Caption and audio don't mention a street or name.",
  },
  {
    id: "v4",
    platform: "instagram",
    url: "https://www.instagram.com/reel/def456/",
    creator: "@matchamoments",
    caption: "new matcha pop-up this weekend only!!",
    savedAgo: "1 week ago",
    aiClue: "Pop-up café. It might have moved or closed.",
  },
  {
    id: "v5",
    platform: "youtube",
    url: "https://www.youtube.com/shorts/abc123xyz89",
    creator: "@weekendwanderer",
    caption: "tiny art gallery tucked behind the flower shop",
    savedAgo: "3 days ago",
    aiClue: "Small gallery entrance spotted, but no readable name or address.",
  },
];

export function platformLabel(platform: VideoPlatform) {
  if (platform === "tiktok") return "TikTok";
  if (platform === "youtube") return "YouTube Shorts";
  return "Instagram Reels";
}

// Guess the platform from a pasted link
export function detectPlatform(url: string): VideoPlatform | null {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com\/shorts\//i.test(url)) return "youtube";
  return null;
}