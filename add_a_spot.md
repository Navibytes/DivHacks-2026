So, we would take a video. Download it from the location (tiktok/instagram), 

1. Parse video transcript, 2. Check bio, 3. Take screenshots, 4. Try comments. If we only find name we can trigger a web search and ask user if this is what they want


if we get what we need we don't need to go forward in the chain (saves time and resources)

Combine video transcript with bio when sending to gemini, so we do this in one prompt and save resources

this is what claude suggested: 
Download video → yt-dlp (command-line tool, handles TikTok links directly, also extracts caption/metadata as JSON)
Extract screenshots → ffmpeg (industry-standard video tool, -vf fps=1 pulls one frame per second as .jpg files)
Transcribe audio → openai-whisper (Python package, runs locally, no API key or internet needed once installed — converts speech to timestamped text)
Get the caption/bio → also yt-dlp — it's already embedded in the same metadata pull from step 1 (the description field)
Join it all together → plain Python (the script itself) — reads Whisper's output segments, matches timestamps to frame filenames, and writes one combined_report.md
Cleanup → Python's built-in shutil/os — deletes the temp video file after everything's extracted

