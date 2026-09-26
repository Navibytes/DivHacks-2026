import type { SourceVideo } from "@/lib/types";

// TikTok: https://www.tiktok.com/@creator/video/1234567890
const TIKTOK = /tiktok\.com\/@([\w.-]+)\/video\/(\d+)/;
// Instagram: https://www.instagram.com/reel/ABC123/ (or /p/ABC123/)
const INSTAGRAM = /instagram\.com\/(reel|p)\/([\w-]+)/;

/** Build a SourceVideo from a pasted link, if it's a full TikTok/Instagram post URL. */
export function videoFromLink(link: string): SourceVideo | undefined {
  const tiktok = link.match(TIKTOK);
  if (tiktok) {
    return { platform: "tiktok", url: link.trim(), creator: `@${tiktok[1]}` };
  }
  if (INSTAGRAM.test(link)) {
    return { platform: "instagram", url: link.trim(), creator: "" };
  }
  return undefined;
}

/** URL for an <iframe> player, or null if the link can't be embedded (e.g. short links). */
export function embedUrl(video: SourceVideo) {
  const tiktok = video.url.match(TIKTOK);
  if (tiktok) {
    return `https://www.tiktok.com/player/v1/${tiktok[2]}?autoplay=1&description=1&music_info=1&rel=0`;
  }
  const instagram = video.url.match(INSTAGRAM);
  if (instagram) {
    return `https://www.instagram.com/${instagram[1]}/${instagram[2]}/embed`;
  }
  return null;
}

export function platformName(video: SourceVideo) {
  return video.platform === "tiktok" ? "TikTok" : "Instagram";
}

/** "@handle on TikTok", or just "Instagram" when the creator is unknown. */
export function videoCredit(video: SourceVideo, joiner = " on ") {
  return video.creator ? `${video.creator}${joiner}${platformName(video)}` : platformName(video);
}
